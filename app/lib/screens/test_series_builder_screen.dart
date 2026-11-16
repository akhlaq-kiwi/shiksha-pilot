import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import '../constants/app_colors.dart';
import '../services/http_service.dart' as http;
import '../services/test_series_service.dart';
import '../widgets/test_series_shared.dart';
import 'test_series_attempt_screen.dart';

class _InstructionsTextController extends TextEditingController {
  _InstructionsTextController([String? text]) : super(text: text);

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final text = this.text;
    if (text.isEmpty) {
      return TextSpan(style: style, text: '');
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bulletColor = isDark ? TsColors.amber300 : TsColors.accent;

    final spans = <InlineSpan>[];
    final lines = text.split('\n');

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final bulletMatch = RegExp(r'^(\s*[•●\-\*]\s*)').firstMatch(line);
      if (bulletMatch != null) {
        final bulletStr = bulletMatch.group(1)!;
        final restStr = line.substring(bulletStr.length);
        spans.add(TextSpan(
          text: bulletStr,
          style: (style ?? const TextStyle()).copyWith(
            color: bulletColor,
            fontWeight: FontWeight.w900,
            fontSize: (style?.fontSize ?? 13.5) + 3.0,
          ),
        ));
        if (restStr.isNotEmpty) {
          spans.add(TextSpan(text: restStr, style: style));
        }
      } else {
        spans.add(TextSpan(text: line, style: style));
      }

      if (i < lines.length - 1) {
        spans.add(const TextSpan(text: '\n'));
      }
    }

    return TextSpan(style: style, children: spans);
  }
}

class _OptionDraft {
  int? id;
  final TextEditingController textController;
  final FocusNode focusNode;
  String imageUrl;
  bool isUploading;

  _OptionDraft({
    this.id,
    String text = '',
    this.imageUrl = '',
  })  : textController = TextEditingController(text: text),
        focusNode = FocusNode(),
        isUploading = false;

  void dispose() {
    textController.dispose();
    focusNode.dispose();
  }
}

class _QuestionDraft {
  int? id;
  final TextEditingController textController;
  String imageUrl;
  bool isUploadingImage;
  int correctOptionIndex;
  final List<_OptionDraft> options;

  _QuestionDraft({
    this.id,
    String text = '',
    this.imageUrl = '',
    this.correctOptionIndex = 0,
    List<_OptionDraft>? options,
  })  : textController = TextEditingController(text: text),
        isUploadingImage = false,
        options = options ??
            [
              _OptionDraft(),
              _OptionDraft(),
              _OptionDraft(),
              _OptionDraft(),
            ];

  void dispose() {
    textController.dispose();
    for (final o in options) {
      o.dispose();
    }
  }
}

class TestSeriesBuilderScreen extends StatefulWidget {
  final TestSeriesService service;
  final int? targetClassId;
  final String? targetClassName;
  final String? targetSectionName;
  final int? existingId;
  final String? initialDraftId;
  final Map<String, dynamic>? initialDraft;

  const TestSeriesBuilderScreen({
    super.key,
    required this.service,
    this.targetClassId,
    this.targetClassName,
    this.targetSectionName,
    this.existingId,
    this.initialDraftId,
    this.initialDraft,
  });

  @override
  State<TestSeriesBuilderScreen> createState() => _TestSeriesBuilderScreenState();
}

class _TestSeriesBuilderScreenState extends State<TestSeriesBuilderScreen> {
  static const int _maxTitleLength = 35;
  static const String _kDefaultInstructions =
      '• Read each question carefully before selecting your answer.\n'
      '• All questions are compulsory and carry equal marks.\n'
      '• Do not refresh or close the app once you begin the test.\n'
      '• Review all your selected answers before tapping Finish.\n'
      '• Ranks, Toppers and Merit Certificates unlock after closing time.';

  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = _InstructionsTextController();
  String _lastSavedSnapshot = '';

  int? _targetClassId;
  String _targetClassName = '';
  String _targetSectionName = '';
  String? _currentDraftId;
  DateTime? _startsAt;
  DateTime? _endsAt;

  final List<_QuestionDraft> _questions = [];
  bool _showTimer = false;
  bool _negativeMarkingEnabled = false;
  double _negativeMarkValue = 0.25;
  bool _instructionsExpanded = false;
  double _instructionsDragExtraHeight = 0.0;
  bool _isLoadingDetail = false;
  bool _isSaving = false;
  bool _isEditMode = false;
  bool _scheduleChanged = false;
  bool _startTimeExplicitlyPicked = false;
  bool _allowPop = false;
  bool _exitDialogOpen = false;
  String _loadError = '';

  void _onDescriptionChanged() {
    if (mounted) setState(() {});
  }

  String _currentSnapshot() {
    try {
      final map = _toDraftMap();
      map.remove('saved_at');
      return jsonEncode(map);
    } catch (_) {
      return '';
    }
  }

  bool _isQuestionFullyFilled(_QuestionDraft q) {
    final hasPrompt = q.textController.text.trim().isNotEmpty ||
        q.imageUrl.trim().isNotEmpty;
    if (!hasPrompt) return false;
    if (q.options.length < 2) return false;
    for (final opt in q.options) {
      if (opt.textController.text.trim().isEmpty &&
          opt.imageUrl.trim().isEmpty) {
        return false;
      }
    }
    return true;
  }

  bool get _canSaveDraft {
    if (_isSaving) return false;
    return _questions.any(_isQuestionFullyFilled);
  }

  void _addInstructionBullet() {
    final text = _descriptionController.text;
    final lines = text.split('\n');
    int bulletCount = 0;
    for (final l in lines) {
      final t = l.trim();
      if (t.startsWith('•') || t.startsWith('-') || t.startsWith('*')) {
        bulletCount++;
      }
    }
    if (bulletCount >= 10) {
      _showSnack('Maximum 10 instructions allowed.', isError: true);
      return;
    }

    if (text.trim().isEmpty) {
      _descriptionController.value = const TextEditingValue(
        text: '• ',
        selection: TextSelection.collapsed(offset: 2),
      );
      return;
    }

    final trimmed = text.trimRight();
    if (trimmed.endsWith('•')) {
      final newText = '$trimmed ';
      _descriptionController.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: newText.length),
      );
      return;
    }

    final appendStr = text.endsWith('\n') ? '• ' : '\n• ';
    final newText = '$text$appendStr';
    _descriptionController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: newText.length),
    );
  }

  String _formatNegLabel(double val) {
    if ((val - 1.0).abs() < 0.01) return '1';
    if ((val - 0.5).abs() < 0.01) return '1/2';
    return '1/4';
  }

  double _parseNegValue(dynamic raw, {double fallback = 0.25}) {
    if (raw == null) return fallback;
    final str = raw.toString().trim();
    if (str == '1' || str == '1.0' || str == '1.00') return 1.0;
    if (str == '1/2' || str == '0.5' || str == '0.50') return 0.5;
    if (str == '1/4' || str == '0.25') return 0.25;
    final numVal = raw is num ? raw.toDouble() : double.tryParse(str);
    if (numVal != null) {
      if ((numVal - 1.0).abs() < 0.01) return 1.0;
      if ((numVal - 0.5).abs() < 0.01) return 0.5;
      if ((numVal - 0.25).abs() < 0.01) return 0.25;
    }
    return fallback;
  }

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.existingId != null;
    _currentDraftId = widget.initialDraftId ?? widget.initialDraft?['id']?.toString();

    _startsAt = null;
    _endsAt = null;

    _targetClassId = widget.targetClassId;
    final parsed = TestSeriesClassBadges.parse(
      widget.targetClassName ?? '',
      widget.targetSectionName,
    );
    _targetClassName = parsed.className;
    _targetSectionName = parsed.sectionName;

    _descriptionController.addListener(_onDescriptionChanged);

    if (_isEditMode) {
      _loadExisting();
    } else {
      _descriptionController.text = _kDefaultInstructions;
      _questions.add(_QuestionDraft());
      if (widget.initialDraft != null) {
        _applyDraftData(widget.initialDraft!);
      } else if (widget.initialDraftId != null) {
        _loadSpecificDraft(widget.initialDraftId!);
      } else {
        _lastSavedSnapshot = _currentSnapshot();
      }
    }
  }

  @override
  void dispose() {
    _descriptionController.removeListener(_onDescriptionChanged);
    _titleController.dispose();
    _descriptionController.dispose();
    for (final q in _questions) {
      q.dispose();
    }
    super.dispose();
  }

  Future<void> _loadSpecificDraft(String draftId) async {
    final cid = _targetClassId ?? 0;
    if (cid <= 0) return;
    final draft = await TestSeriesDraftStore.loadDraftById(cid, draftId);
    if (!mounted || draft == null) return;
    _applyDraftData(draft);
  }

  void _applyDraftData(Map<String, dynamic> draft) {
    final now = DateTime.now();
    final nowMinute = DateTime(now.year, now.month, now.day, now.hour, now.minute);

    _currentDraftId = draft['id']?.toString() ?? _currentDraftId;
    final rawTitle = (draft['title'] ?? '').toString();
    _titleController.text = rawTitle.length > _maxTitleLength
        ? rawTitle.substring(0, _maxTitleLength)
        : rawTitle;
    _descriptionController.text = (draft['description'] ?? '').toString();
    _scheduleChanged = draft['schedule_changed'] == true;
    _showTimer = draft['show_timer'] == true;
    _negativeMarkingEnabled = draft['negative_marking_enabled'] == true;
    _negativeMarkValue = _parseNegValue(draft['negative_mark_value']);

    final parsedStart = DateTime.tryParse((draft['starts_at'] ?? '').toString());
    final parsedEnd = DateTime.tryParse((draft['ends_at'] ?? '').toString());
    if (parsedStart != null) {
      _startsAt = parsedStart.isBefore(nowMinute) ? nowMinute : parsedStart;
    } else {
      _startsAt = null;
    }
    if (parsedEnd != null && (_startsAt == null || parsedEnd.isAfter(_startsAt!)) && parsedEnd.isAfter(nowMinute)) {
      _endsAt = parsedEnd;
    } else {
      _endsAt = null;
    }

    final rawQuestions = (draft['questions'] as List?) ?? [];
    if (rawQuestions.isNotEmpty) {
      for (final old in _questions) {
        old.dispose();
      }
      _questions.clear();
      for (final rawQ in rawQuestions) {
        if (rawQ is! Map) continue;
        final qMap = Map<String, dynamic>.from(rawQ);
        final rawOpts = (qMap['options'] as List?) ?? [];
        final optDrafts = <_OptionDraft>[];
        for (final rawO in rawOpts) {
          if (rawO is! Map) continue;
          final oMap = Map<String, dynamic>.from(rawO);
          optDrafts.add(
            _OptionDraft(
              text: (oMap['option_text'] ?? '').toString(),
              imageUrl: (oMap['option_image_url'] ?? '').toString(),
            ),
          );
        }
        while (optDrafts.length < 2) {
          optDrafts.add(_OptionDraft());
        }
        final corrIdx = ((qMap['correct_option_index'] as num?)?.toInt() ?? 0)
            .clamp(0, optDrafts.length - 1);
        _questions.add(
          _QuestionDraft(
            text: (qMap['question_text'] ?? '').toString(),
            imageUrl: (qMap['question_image_url'] ?? '').toString(),
            correctOptionIndex: corrIdx,
            options: optDrafts,
          ),
        );
      }
      if (_questions.isEmpty) {
        _questions.add(_QuestionDraft());
      }
    }

    _lastSavedSnapshot = _currentSnapshot();
    if (mounted) {
      setState(() {});
    }
  }

  bool get _hasUnsavedContent {
    return _currentSnapshot() != _lastSavedSnapshot;
  }

  Map<String, dynamic> _toDraftMap() {
    return {
      'id': _currentDraftId,
      'class_id': _targetClassId,
      'title': _titleController.text,
      'description': _descriptionController.text,
      'schedule_changed': _scheduleChanged,
      'show_timer': _showTimer,
      'negative_marking_enabled': _negativeMarkingEnabled,
      'negative_mark_value': _negativeMarkValue,
      'starts_at': _startsAt?.toIso8601String(),
      'ends_at': _endsAt?.toIso8601String(),
      'saved_at': DateTime.now().toIso8601String(),
      'questions': [
        for (final q in _questions)
          {
            'question_text': q.textController.text,
            'question_image_url': q.imageUrl.trim(),
            'correct_option_index': q.correctOptionIndex,
            'options': [
              for (final o in q.options)
                {
                  'option_text': o.textController.text,
                  'option_image_url': o.imageUrl.trim(),
                },
            ],
          },
      ],
    };
  }

  Future<void> _saveAsDraftExplicit() async {
    final cid = _targetClassId ?? 0;
    if (cid <= 0) {
      _showSnack('Class ID missing, cannot save draft.', isError: true);
      return;
    }
    _currentDraftId = await TestSeriesDraftStore.saveDraft(
      cid,
      _toDraftMap(),
      draftId: _currentDraftId,
    );
    _lastSavedSnapshot = _currentSnapshot();
    if (mounted) {
      _showSnack('Draft saved successfully!');
      setState(() {});
    }
  }

  Future<void> _handleAttemptExit() async {
    if (_isSaving || _isEditMode || _allowPop) {
      if (!_allowPop && mounted) {
        setState(() => _allowPop = true);
        Navigator.pop(context, false);
      }
      return;
    }

    if (!_hasUnsavedContent) {
      if (!mounted) return;
      setState(() => _allowPop = true);
      Navigator.pop(context, false);
      return;
    }

    if (_exitDialogOpen) return;
    _exitDialogOpen = true;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final decision = await showDialog<String>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
        final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
        final textSecondary = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
        final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

        return Dialog(
          backgroundColor: bg,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: BorderSide(color: borderCol, width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: isDark
                        ? TsColors.amber900.withValues(alpha: 0.45)
                        : TsColors.accentSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDark ? TsColors.amber800 : TsColors.accentBorder,
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    Icons.edit_note_rounded,
                    size: 30,
                    color: isDark ? TsColors.amber300 : TsColors.accent,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Save Test in Draft?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'You haven\'t published this Test Series yet. Save it in Draft so when you return, you can continue right from where you left off.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textSecondary,
                    fontSize: 13.5,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, 'discard'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.danger600,
                          side: BorderSide(
                            color: AppColors.danger500.withValues(alpha: 0.45),
                            width: 1.4,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Discard',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, 'save'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isDark ? TsColors.accent : TsColors.ink,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Save Draft',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    _exitDialogOpen = false;
    if (!mounted || decision == null) return;

    final cid = _targetClassId ?? 0;
    if (decision == 'save' && cid > 0) {
      _currentDraftId = await TestSeriesDraftStore.saveDraft(cid, _toDraftMap(), draftId: _currentDraftId);
    }
    if (!mounted) return;
    setState(() => _allowPop = true);
    Navigator.pop(context, false);
  }

  Future<void> _loadExisting() async {
    setState(() {
      _isLoadingDetail = true;
      _loadError = '';
    });

    try {
      final data = await widget.service.fetchTeacherDetail(widget.existingId!);
      if (!mounted) return;

      final rawTitle = (data['title'] ?? '').toString();
      _titleController.text = rawTitle.length > _maxTitleLength
          ? rawTitle.substring(0, _maxTitleLength)
          : rawTitle;
      _descriptionController.text = (data['description'] ?? '').toString();
      _targetClassId = (data['class_id'] as num?)?.toInt() ?? _targetClassId;
      final loadedClassName = (data['full_class_name'] ?? '').toString().trim();
      if (loadedClassName.isNotEmpty) {
        final parsed = TestSeriesClassBadges.parse(loadedClassName, null);
        _targetClassName = parsed.className;
        if (parsed.sectionName.isNotEmpty) {
          _targetSectionName = parsed.sectionName;
        }
      }

      final sDt = DateTime.tryParse((data['starts_at'] ?? '').toString().replaceFirst(' ', 'T'));
      final eDt = DateTime.tryParse((data['ends_at'] ?? '').toString().replaceFirst(' ', 'T'));
      if (sDt != null) _startsAt = sDt;
      if (eDt != null) _endsAt = eDt;

      _showTimer = data['show_timer'] == true || data['show_timer'] == 1;
      _negativeMarkingEnabled = data['negative_marking_enabled'] == true ||
          data['negative_marking_enabled'] == 1;
      _negativeMarkValue = _parseNegValue(
        data['negative_mark_value'] ?? data['negative_mark_label'],
      );

      for (final old in _questions) {
        old.dispose();
      }
      _questions.clear();

      final rawQuestions = (data['questions'] as List?) ?? [];
      for (final rawQ in rawQuestions) {
        final qMap = Map<String, dynamic>.from(rawQ as Map);
        final rawOpts = (qMap['options'] as List?) ?? [];
        int corrIdx = 0;
        final optDrafts = <_OptionDraft>[];
        for (int i = 0; i < rawOpts.length; i++) {
          final oMap = Map<String, dynamic>.from(rawOpts[i] as Map);
          if (oMap['is_correct'] == true || oMap['is_correct'] == 1) {
            corrIdx = i;
          }
          optDrafts.add(
            _OptionDraft(
              id: (oMap['id'] as num?)?.toInt(),
              text: (oMap['option_text'] ?? '').toString(),
              imageUrl: (oMap['option_image_url'] ?? '').toString(),
            ),
          );
        }
        if (optDrafts.length < 2) {
          while (optDrafts.length < 2) {
            optDrafts.add(_OptionDraft());
          }
        }
        _questions.add(
          _QuestionDraft(
            id: (qMap['id'] as num?)?.toInt(),
            text: (qMap['question_text'] ?? '').toString(),
            imageUrl: (qMap['question_image_url'] ?? '').toString(),
            correctOptionIndex: corrIdx,
            options: optDrafts,
          ),
        );
      }
      if (_questions.isEmpty) {
        _questions.add(_QuestionDraft());
      }

      setState(() {
        _isLoadingDetail = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = http.isNetworkError(e)
            ? http.kNetworkErrorMessage
            : http.formatErrorMessage(e);
        _isLoadingDetail = false;
      });
    }
  }

  Future<void> _pickDateTime({required bool isStart}) async {
    if (_isEditMode && isStart) {
      _showSnack('Start date & time cannot be edited after creation.', isError: true);
      return;
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final lastDate = DateTime(now.year + 2);
    final initial = (isStart ? _startsAt : _endsAt) ??
        (isStart
            ? DateTime(now.year, now.month, now.day, now.hour, now.minute)
            : (_startsAt != null
                ? _startsAt!.add(const Duration(hours: 2))
                : DateTime(now.year, now.month, now.day + 1, 23, 59)));
    final clampedInitial = initial.isBefore(today)
        ? today
        : (initial.isAfter(lastDate) ? lastDate : initial);

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: clampedInitial,
      firstDate: today,
      lastDate: lastDate,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: TsColors.accent,
              onPrimary: Colors.white,
              onSurface: TsColors.ink,
            ),
          ),
          child: child!,
        );
      },
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: TsColors.accent,
              onPrimary: Colors.white,
              onSurface: TsColors.ink,
            ),
          ),
          child: child!,
        );
      },
    );
    if (pickedTime == null || !mounted) return;

    final combined = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );

    final currentNow = DateTime.now();
    final nowMinute = DateTime(
      currentNow.year,
      currentNow.month,
      currentNow.day,
      currentNow.hour,
      currentNow.minute,
    );

    if (isStart && combined.isBefore(nowMinute)) {
      _showSnack('Start date & time cannot be in the past.', isError: true);
      return;
    }
    if (!isStart) {
      if (_startsAt != null && !combined.isAfter(_startsAt!)) {
        _showSnack('End date & time must be after Start date & time.', isError: true);
        return;
      }
      if (!combined.isAfter(nowMinute)) {
        _showSnack('End date & time must be in the future.', isError: true);
        return;
      }
    }

    setState(() {
      _scheduleChanged = true;
      if (isStart) {
        _startTimeExplicitlyPicked = true;
        _startsAt = combined;
        if (_endsAt != null && !_endsAt!.isAfter(_startsAt!)) {
          _endsAt = _startsAt!.add(const Duration(hours: 2));
        }
      } else {
        _endsAt = combined;
      }
    });
  }

  Future<File?> _pickAndCropImage({required bool isQuestion}) async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image);
    if (result == null || result.files.isEmpty || result.files.single.path == null) {
      return null;
    }
    final file = File(result.files.single.path!);
    if (!mounted) return null;

    int fileSize = result.files.single.size;
    try {
      if (await file.exists()) {
        final diskLen = await file.length();
        if (diskLen > fileSize) fileSize = diskLen;
      }
    } catch (_) {}

    if (fileSize > 2 * 1024 * 1024) {
      _showSnack('File size cannot exceed 2 MB.', isError: true);
      return null;
    }

    if (!mounted) return null;

    return showDialog<File?>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RectangularPhotoCropDialog(
        imageFile: file,
        cropWidth: isQuestion ? 300 : 280,
        cropHeight: isQuestion ? 185 : 200,
        title: isQuestion ? 'Crop Question Photo' : 'Crop Option Photo',
      ),
    );
  }

  Future<void> _pickAndUploadQuestionImage(int qIdx) async {
    File? croppedFile;
    try {
      croppedFile = await _pickAndCropImage(isQuestion: true);
      if (croppedFile == null || !mounted) return;

      final cropSize = await croppedFile.length();
      if (cropSize > 2 * 1024 * 1024) {
        _showSnack('File size cannot exceed 2 MB.', isError: true);
        return;
      }

      setState(() => _questions[qIdx].isUploadingImage = true);

      final uploaded = await widget.service.uploadImage(croppedFile);
      if (!mounted) return;
      setState(() {
        _questions[qIdx].imageUrl = (uploaded['url'] ?? '').toString();
        _questions[qIdx].isUploadingImage = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _questions[qIdx].isUploadingImage = false);
      _showSnack(
        http.isNetworkError(e) ? http.kNetworkErrorMessage : http.formatErrorMessage(e),
        isError: true,
      );
    } finally {
      if (croppedFile != null) {
        try {
          if (await croppedFile.exists()) await croppedFile.delete();
        } catch (_) {}
      }
    }
  }

  Future<void> _pickAndUploadOptionImage(int qIdx, int oIdx) async {
    File? croppedFile;
    try {
      croppedFile = await _pickAndCropImage(isQuestion: false);
      if (croppedFile == null || !mounted) return;

      final cropSize = await croppedFile.length();
      if (cropSize > 2 * 1024 * 1024) {
        _showSnack('File size cannot exceed 2 MB.', isError: true);
        return;
      }

      setState(() => _questions[qIdx].options[oIdx].isUploading = true);

      final uploaded = await widget.service.uploadImage(croppedFile);
      if (!mounted) return;
      setState(() {
        _questions[qIdx].options[oIdx].imageUrl = (uploaded['url'] ?? '').toString();
        _questions[qIdx].options[oIdx].isUploading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _questions[qIdx].options[oIdx].isUploading = false);
      _showSnack(
        http.isNetworkError(e) ? http.kNetworkErrorMessage : http.formatErrorMessage(e),
        isError: true,
      );
    } finally {
      if (croppedFile != null) {
        try {
          if (await croppedFile.exists()) await croppedFile.delete();
        } catch (_) {}
      }
    }
  }

  void _addQuestion() {
    if (_questions.length >= 100) {
      _showSnack('Maximum 100 questions allowed.', isError: true);
      return;
    }
    setState(() {
      _questions.add(_QuestionDraft());
    });
  }

  void _removeQuestion(int qIdx) {
    if (_questions.length <= 1) {
      _showSnack('At least 1 question is required.', isError: true);
      return;
    }
    setState(() {
      final removed = _questions.removeAt(qIdx);
      removed.dispose();
    });
  }

  void _addOption(int qIdx) {
    final q = _questions[qIdx];
    if (q.options.length >= 5) {
      _showSnack('Maximum 5 options allowed per question.', isError: true);
      return;
    }
    setState(() {
      q.options.add(_OptionDraft());
    });
  }

  void _removeOption(int qIdx, int oIdx) {
    final q = _questions[qIdx];
    if (q.options.length <= 2) {
      _showSnack('Minimum 2 options are required per question.', isError: true);
      return;
    }
    setState(() {
      final removed = q.options.removeAt(oIdx);
      removed.dispose();
      if (q.correctOptionIndex == oIdx) {
        q.correctOptionIndex = 0;
      } else if (q.correctOptionIndex > oIdx) {
        q.correctOptionIndex--;
      }
    });
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: isError ? AppColors.danger600 : AppColors.success600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _openLivePreview() {
    FocusScope.of(context).unfocus();
    for (final q in _questions) {
      if (q.isUploadingImage || q.options.any((o) => o.isUploading)) {
        _showSnack('Please wait for image uploads to complete.', isError: true);
        return;
      }
    }

    final rawTitle = _titleController.text.trim();
    final previewTitle = rawTitle.isEmpty ? 'Test Series Preview' : rawTitle;
    final negLabel = _formatNegLabel(_negativeMarkValue);

    final previewSeries = <String, dynamic>{
      'id': widget.existingId ?? 0,
      'title': previewTitle,
      'description': _descriptionController.text.trim(),
      'starts_at': formatSqlDateTime(_startsAt ?? DateTime.now()),
      'ends_at': formatSqlDateTime(
          _endsAt ?? DateTime.now().add(const Duration(days: 1))),
      'total_questions': _questions.length,
      'seconds_remaining': 0,
      'show_timer': _showTimer,
      'negative_marking_enabled': _negativeMarkingEnabled,
      'negative_mark_value': _negativeMarkingEnabled ? _negativeMarkValue : 0.0,
      'negative_mark_label': _negativeMarkingEnabled ? negLabel : '',
    };

    final previewQuestions = <Map<String, dynamic>>[];
    for (int qi = 0; qi < _questions.length; qi++) {
      final q = _questions[qi];
      final qText = q.textController.text.trim();
      final qImg = q.imageUrl.trim();
      previewQuestions.add({
        'id': q.id ?? -(qi + 1),
        'sort_order': qi + 1,
        'question_text': qText.isEmpty && qImg.isEmpty
            ? 'Question ${qi + 1} preview'
            : qText,
        'question_image_url': qImg,
        'options': [
          for (int oi = 0; oi < q.options.length; oi++)
            {
              'id': q.options[oi].id ?? -((qi + 1) * 100 + oi + 1),
              'sort_order': oi + 1,
              'option_text': q.options[oi].textController.text.trim().isEmpty &&
                      q.options[oi].imageUrl.trim().isEmpty
                  ? 'Option ${String.fromCharCode(65 + oi)}'
                  : q.options[oi].textController.text.trim(),
              'option_image_url': q.options[oi].imageUrl.trim(),
            },
        ],
      });
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TestSeriesAttemptScreen(
          service: widget.service,
          testSeriesId: widget.existingId ?? 0,
          initialTitle: previewTitle,
          isPreview: true,
          previewSeries: previewSeries,
          previewQuestions: previewQuestions,
        ),
      ),
    );
  }

  Future<void> _showNegativeMarkingDialog() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    bool tempEnabled = _negativeMarkingEnabled;
    String tempLabel = _formatNegLabel(_negativeMarkValue);

    final applied = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
        final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
        final textSecondary =
            isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
        final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return Dialog(
              backgroundColor: bg,
              insetPadding: const EdgeInsets.symmetric(horizontal: 24),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: BorderSide(color: borderCol, width: 1.5),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDark
                                ? TsColors.amber900.withValues(alpha: 0.45)
                                : TsColors.accentSoft,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isDark
                                  ? TsColors.amber800
                                  : TsColors.accentBorder,
                              width: 1.3,
                            ),
                          ),
                          child: Icon(
                            Icons.remove_circle_outline_rounded,
                            size: 22,
                            color: isDark ? TsColors.amber300 : TsColors.accent,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Negative Marking',
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Applies to all questions in this test',
                                style: TextStyle(
                                  color: textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.darkSurfaceCanvas
                            : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: tempEnabled
                              ? TsColors.accent.withValues(alpha: 0.65)
                              : (isDark ? TsColors.darkBorder : TsColors.border),
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Enable Negative Marking',
                                  style: TextStyle(
                                    color: textPrimary,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  tempEnabled
                                      ? 'Deducts marks on wrong answers'
                                      : 'No marks deducted for wrong answers',
                                  style: TextStyle(
                                    color: textSecondary,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Switch.adaptive(
                            value: tempEnabled,
                            activeTrackColor: TsColors.accent,
                            activeThumbColor: Colors.white,
                            onChanged: (val) {
                              setDialogState(() => tempEnabled = val);
                            },
                          ),
                        ],
                      ),
                    ),
                    if (tempEnabled) ...[
                      const SizedBox(height: 14),
                      Text(
                        'Select Negative Mark Deduction',
                        style: TextStyle(
                          color: textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      LayoutBuilder(
                        builder: (context, fieldConstraints) {
                          return PopupMenuButton<String>(
                            position: PopupMenuPosition.under,
                            offset: const Offset(0, 6),
                            color: bg,
                            surfaceTintColor: Colors.transparent,
                            elevation: 8,
                            constraints: BoxConstraints(
                              minWidth: fieldConstraints.maxWidth,
                              maxWidth: fieldConstraints.maxWidth,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: isDark
                                    ? TsColors.darkBorder
                                    : TsColors.accentBorder,
                                width: 1.4,
                              ),
                            ),
                            onSelected: (val) {
                              setDialogState(() => tempLabel = val);
                            },
                            itemBuilder: (_) => [
                              for (final opt in const ['1', '1/2', '1/4'])
                                PopupMenuItem<String>(
                                  value: opt,
                                  height: 44,
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          opt,
                                          style: TextStyle(
                                            color: opt == tempLabel
                                                ? (isDark
                                                    ? TsColors.amber300
                                                    : TsColors.accent)
                                                : textPrimary,
                                            fontSize: 14,
                                            fontWeight: opt == tempLabel
                                                ? FontWeight.w900
                                                : FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      if (opt == tempLabel)
                                        Icon(
                                          Icons.check_circle_rounded,
                                          size: 18,
                                          color: isDark
                                              ? TsColors.amber300
                                              : TsColors.accent,
                                        ),
                                    ],
                                  ),
                                ),
                            ],
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? AppColors.darkSurfaceCanvas
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: TsColors.accent.withValues(alpha: 0.65),
                                  width: 1.4,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      tempLabel,
                                      style: TextStyle(
                                        color: textPrimary,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: isDark
                                        ? TsColors.amber300
                                        : TsColors.accent,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isDark
                              ? TsColors.amber900.withValues(alpha: 0.35)
                              : TsColors.accentSoft,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isDark
                                ? TsColors.amber800
                                : TsColors.accentBorder,
                          ),
                        ),
                        child: Text(
                          '+1 for correct answer and -$tempLabel for each wrong answer',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: isDark
                                ? TsColors.amber300
                                : TsColors.amber800,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: textSecondary,
                              side: BorderSide(
                                color: isDark
                                    ? TsColors.darkBorder
                                    : TsColors.border,
                                width: 1.4,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  isDark ? TsColors.accent : TsColors.ink,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text(
                              'Apply',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (applied == true && mounted) {
      setState(() {
        _negativeMarkingEnabled = tempEnabled;
        _negativeMarkValue = _parseNegValue(tempLabel);
      });
    }
  }

  Widget _buildPublishSummaryRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required Color textPrimary,
    required Color textSecondary,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: TextStyle(
            color: textSecondary,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              color: textPrimary,
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }

  Future<bool?> _showPublishConfirmationDialog({
    required DateTime effectiveStartsAt,
    required DateTime effectiveEndsAt,
    required String title,
  }) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
    final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

    return showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          backgroundColor: bg,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: BorderSide(color: borderCol, width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: isDark
                        ? TsColors.amber900.withValues(alpha: 0.45)
                        : TsColors.accentSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDark ? TsColors.amber800 : TsColors.accentBorder,
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    _isEditMode ? Icons.edit_note_rounded : Icons.rocket_launch_rounded,
                    size: 26,
                    color: isDark ? TsColors.amber300 : TsColors.accent,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _isEditMode ? 'Save & Update Test?' : 'Publish Test Series?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textPrimary,
                    fontSize: 18.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Review test details before making it live for students.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textSecondary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurfaceCanvas : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark ? TsColors.darkBorder : TsColors.accentBorder,
                      width: 1.2,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          color: textPrimary,
                          fontSize: 15.5,
                          fontWeight: FontWeight.w900,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 12),
                      Divider(
                        height: 1,
                        thickness: 1,
                        color: isDark ? TsColors.darkBorder : TsColors.accentBorder.withValues(alpha: 0.5),
                      ),
                      const SizedBox(height: 12),
                      _buildPublishSummaryRow(
                        icon: Icons.quiz_rounded,
                        iconColor: TsColors.accent,
                        label: 'Total Questions',
                        value: '${_questions.length}',
                        textPrimary: textPrimary,
                        textSecondary: textSecondary,
                      ),
                      const SizedBox(height: 9),
                      _buildPublishSummaryRow(
                        icon: Icons.play_circle_outline_rounded,
                        iconColor: isDark ? TsColors.amber300 : TsColors.ink,
                        label: 'Start Date & Time',
                        value: formatDateSingleLine(effectiveStartsAt),
                        textPrimary: textPrimary,
                        textSecondary: textSecondary,
                      ),
                      const SizedBox(height: 9),
                      _buildPublishSummaryRow(
                        icon: Icons.flag_circle_outlined,
                        iconColor: TsColors.accent,
                        label: 'End Date & Time',
                        value: formatDateSingleLine(effectiveEndsAt),
                        textPrimary: textPrimary,
                        textSecondary: textSecondary,
                      ),
                      const SizedBox(height: 9),
                      _buildPublishSummaryRow(
                        icon: Icons.timer_outlined,
                        iconColor: _showTimer
                            ? (isDark ? TsColors.amber300 : TsColors.accent)
                            : (isDark ? AppColors.darkTextSecondary : TsColors.inkMuted),
                        label: 'Attempt Timer',
                        value: _showTimer ? 'Visible to students' : 'Hidden from students',
                        textPrimary: textPrimary,
                        textSecondary: textSecondary,
                      ),
                      if (_negativeMarkingEnabled) ...[
                        const SizedBox(height: 9),
                        _buildPublishSummaryRow(
                          icon: Icons.remove_circle_outline_rounded,
                          iconColor: AppColors.danger500,
                          label: 'Negative Marking',
                          value: '-${_formatNegLabel(_negativeMarkValue)} mark',
                          textPrimary: textPrimary,
                          textSecondary: textSecondary,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: textSecondary,
                          side: BorderSide(
                            color: isDark ? TsColors.darkBorder : TsColors.border,
                            width: 1.4,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Review & Edit',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isDark ? TsColors.accent : TsColors.ink,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          _isEditMode ? 'Confirm & Update' : 'Confirm & Publish',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();

    final title = _titleController.text.trim();
    if (title.isEmpty) {
      _showSnack('Please enter Test Series Title.', isError: true);
      return;
    }
    if (title.length > _maxTitleLength) {
      _showSnack(
        'Test Series Title can be at most $_maxTitleLength characters.',
        isError: true,
      );
      return;
    }
    if (_targetClassId == null || _targetClassId! <= 0) {
      _showSnack('Target class is missing. Please go back and select a class.', isError: true);
      return;
    }
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final nowMinute = DateTime(now.year, now.month, now.day, now.hour, now.minute);

    if (!_isEditMode) {
      if (_startsAt == null) {
        _showSnack('Please select Start Date & Time.', isError: true);
        return;
      }
      if (_endsAt == null) {
        _showSnack('Please select End Date & Time.', isError: true);
        return;
      }
    }

    DateTime effectiveStartsAt = _startsAt ?? nowMinute;
    if (!_isEditMode) {
      // If teacher kept default "Start Now" while preparing questions, advance to current minute
      if (!_startTimeExplicitlyPicked && effectiveStartsAt.isBefore(nowMinute)) {
        effectiveStartsAt = nowMinute;
      }
      if (effectiveStartsAt.isBefore(todayStart) ||
          effectiveStartsAt.isBefore(nowMinute.subtract(const Duration(minutes: 2)))) {
        _showSnack('Start date & time cannot be in the past.', isError: true);
        return;
      }
    }

    final effectiveEndsAt =
        _endsAt ?? effectiveStartsAt.add(const Duration(hours: 2));
    if (!effectiveEndsAt.isAfter(effectiveStartsAt)) {
      _showSnack('End date & time must be after Start date & time.', isError: true);
      return;
    }
    if (!effectiveEndsAt.isAfter(now)) {
      _showSnack('End date & time must be in the future.', isError: true);
      return;
    }

    for (int qi = 0; qi < _questions.length; qi++) {
      final q = _questions[qi];
      if (q.isUploadingImage || q.options.any((o) => o.isUploading)) {
        _showSnack('Please wait for image uploads to complete.', isError: true);
        return;
      }
      if (q.textController.text.trim().isEmpty && q.imageUrl.trim().isEmpty) {
        _showSnack('Question ${qi + 1} needs question text or an image.', isError: true);
        return;
      }
      if (q.options.length < 2 || q.options.length > 5) {
        _showSnack('Question ${qi + 1} must have 2 to 5 options.', isError: true);
        return;
      }
      for (int oi = 0; oi < q.options.length; oi++) {
        final o = q.options[oi];
        if (o.textController.text.trim().isEmpty && o.imageUrl.trim().isEmpty) {
          _showSnack(
            'Question ${qi + 1}, Option ${String.fromCharCode(65 + oi)} needs text or an image.',
            isError: true,
          );
          return;
        }
      }
    }

    final confirmed = await _showPublishConfirmationDialog(
      effectiveStartsAt: effectiveStartsAt,
      effectiveEndsAt: effectiveEndsAt,
      title: title,
    );
    if (confirmed != true) return;

    final payload = {
      'title': title,
      'description': _descriptionController.text.trim(),
      'class_id': _targetClassId,
      'starts_at': formatSqlDateTime(effectiveStartsAt),
      'ends_at': formatSqlDateTime(effectiveEndsAt),
      'show_timer': _showTimer,
      'negative_marking_enabled': _negativeMarkingEnabled,
      'negative_mark_value': _negativeMarkingEnabled ? _negativeMarkValue : 0.0,
      'questions': [
        for (final q in _questions)
          {
            if (q.id != null) 'id': q.id,
            'question_text': q.textController.text.trim(),
            'question_image_url': q.imageUrl.trim(),
            'options': [
              for (int oi = 0; oi < q.options.length; oi++)
                {
                  if (q.options[oi].id != null) 'id': q.options[oi].id,
                  'option_text': q.options[oi].textController.text.trim(),
                  'option_image_url': q.options[oi].imageUrl.trim(),
                  'is_correct': oi == q.correctOptionIndex,
                },
            ],
          },
      ],
    };

    setState(() => _isSaving = true);
    try {
      if (_isEditMode) {
        await widget.service.updateTestSeries(widget.existingId!, payload);
        if (!mounted) return;
        _showSnack('Test Series updated & changes are live!');
      } else {
        await widget.service.createTestSeries(payload);
        if (_targetClassId != null && _targetClassId! > 0) {
          if (_currentDraftId != null && _currentDraftId!.isNotEmpty) {
            await TestSeriesDraftStore.deleteDraft(
                _targetClassId!, _currentDraftId!);
          }
          await TestSeriesDraftStore.clearDraft(_targetClassId!);
        }
        if (!mounted) return;
        _showSnack('Test Series published successfully!');
      }
      _allowPop = true;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack(
        http.isNetworkError(e) ? http.kNetworkErrorMessage : http.formatErrorMessage(e),
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas;
    final cardColor = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
    final borderColor = isDark ? TsColors.darkBorder : TsColors.border;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;

    return PopScope(
      canPop: _isEditMode || _allowPop,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleAttemptExit();
      },
      child: Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkSurfaceRaised : Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        titleSpacing: 0,
        iconTheme: IconThemeData(color: textPrimary),
        title: Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Row(
            children: [
              Flexible(
                child: Text(
                  _isEditMode ? 'EDIT TEST SERIES' : 'CREATE TEST SERIES',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: textPrimary,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              if (_targetClassName.isNotEmpty) ...[
                const SizedBox(width: 8),
                TestSeriesClassBadges(
                  classLabel: _targetClassName,
                  sectionLabel: _targetSectionName,
                  isDark: isDark,
                ),
              ],
            ],
          ),
        ),
        actions: [
          if (!_isEditMode)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: () {
                final canSave = _canSaveDraft;
                return TextButton.icon(
                  onPressed: canSave ? _saveAsDraftExplicit : null,
                  icon: Icon(
                    Icons.bookmark_outline_rounded,
                    size: 16,
                    color: canSave
                        ? (isDark ? TsColors.amber300 : TsColors.amber800)
                        : (isDark ? Colors.white24 : Colors.black26),
                  ),
                  label: Text(
                    'Save Draft',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: canSave
                          ? (isDark ? TsColors.amber300 : TsColors.amber800)
                          : (isDark ? Colors.white24 : Colors.black26),
                    ),
                  ),
                  style: TextButton.styleFrom(
                    backgroundColor: canSave
                        ? (isDark
                            ? TsColors.amber900.withValues(alpha: 0.45)
                            : TsColors.accentSoft)
                        : (isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.04)),
                    foregroundColor: canSave
                        ? (isDark ? TsColors.amber300 : TsColors.amber800)
                        : (isDark ? Colors.white24 : Colors.black26),
                    side: BorderSide(
                      color: canSave
                          ? (isDark ? TsColors.amber400.withValues(alpha: 0.65) : TsColors.accentBorder)
                          : (isDark ? Colors.white12 : Colors.black12),
                      width: 1.2,
                    ),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                );
              }(),
            ),
        ],
      ),
      body: _isLoadingDetail
          ? const Center(child: CircularProgressIndicator(color: TsColors.accent))
          : _loadError.isNotEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger500),
                        const SizedBox(height: 12),
                        Text(_loadError, textAlign: TextAlign.center, style: TextStyle(color: textSecondary)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadExisting,
                          style: ElevatedButton.styleFrom(backgroundColor: TsColors.ink, foregroundColor: Colors.white),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: Form(
                        key: _formKey,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
                          children: [
                            if (_isEditMode)
                              Container(
                                margin: const EdgeInsets.only(bottom: 14),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: TsColors.accentSoft,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: TsColors.accentBorder),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.bolt_rounded, color: TsColors.accent, size: 20),
                                    SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Edits apply instantly to upcoming or running tests and automatically re-grade submitted responses.',
                                        style: TextStyle(
                                          color: TsColors.amber800,
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                            // Basic Details Card
                            _SectionCard(
                              cardColor: cardColor,
                              isDark: isDark,
                              children: [
                                Stack(
                                  children: [
                                    TextFormField(
                                      controller: _titleController,
                                      maxLength: _maxTitleLength,
                                      maxLengthEnforcement:
                                          MaxLengthEnforcement.enforced,
                                      maxLines: 1,
                                      cursorColor: isDark ? TsColors.amber300 : TsColors.accent,
                                      buildCounter: (
                                        context, {
                                        required int currentLength,
                                        required bool isFocused,
                                        required int? maxLength,
                                      }) =>
                                          null,
                                      style: TextStyle(
                                        color: textPrimary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      decoration: _inputDecoration(
                                        label: 'Test Series Title *',
                                        hint:
                                            'e.g., Animal Picture Quiz or Weekly Science',
                                        isDark: isDark,
                                        bottomPadding: 24,
                                      ),
                                    ),
                                    Positioned(
                                      right: 12,
                                      bottom: 5,
                                      child: IgnorePointer(
                                        child: ValueListenableBuilder<
                                            TextEditingValue>(
                                          valueListenable: _titleController,
                                          builder: (context, value, _) {
                                            final len = value.text.length
                                                .clamp(0, _maxTitleLength);
                                            return Text(
                                              '$len/$_maxTitleLength',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: isDark
                                                    ? AppColors.darkTextMuted
                                                    : TsColors.inkMuted,
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                () {
                                  final dragLines =
                                      (_instructionsDragExtraHeight / 20.0)
                                          .round();
                                  return Stack(
                                    children: [
                                      TextFormField(
                                        controller: _descriptionController,
                                        minLines: _instructionsExpanded
                                            ? (6 + dragLines)
                                            : 2,
                                        maxLines: _instructionsExpanded
                                            ? (12 + dragLines)
                                            : 3,
                                        keyboardType: TextInputType.multiline,
                                        cursorColor: isDark ? TsColors.amber300 : TsColors.accent,
                                        style: TextStyle(
                                          color: textPrimary,
                                          fontSize: 13.5,
                                          height: 1.45,
                                        ),
                                        decoration: _inputDecoration(
                                          label: 'Instructions (Optional)',
                                          hint:
                                              'Type test instructions for students.\nTap "B" button to insert a new bullet point.',
                                          isDark: isDark,
                                          alignLabelWithHint: true,
                                          rightPadding: 48,
                                        ),
                                      ),
                                      Positioned(
                                        top: 8,
                                        right: 8,
                                        child: Tooltip(
                                          message: _instructionsExpanded
                                              ? 'Collapse instructions'
                                              : 'Expand instructions',
                                          child: Material(
                                            color: isDark
                                                ? TsColors.amber900
                                                    .withValues(alpha: 0.45)
                                                : TsColors.accentSoft,
                                            borderRadius:
                                                BorderRadius.circular(10),
                                            child: InkWell(
                                              onTap: () => setState(() {
                                                _instructionsExpanded =
                                                    !_instructionsExpanded;
                                                if (!_instructionsExpanded) {
                                                  _instructionsDragExtraHeight =
                                                      0.0;
                                                }
                                              }),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              child: Container(
                                                width: 32,
                                                height: 32,
                                                decoration: BoxDecoration(
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                  border: Border.all(
                                                    color: isDark
                                                        ? TsColors.amber800
                                                        : TsColors.accentBorder,
                                                  ),
                                                ),
                                                child: Icon(
                                                  _instructionsExpanded
                                                      ? Icons
                                                          .close_fullscreen_rounded
                                                      : Icons
                                                          .open_in_full_rounded,
                                                  size: 16,
                                                  color: isDark
                                                      ? TsColors.amber300
                                                      : TsColors.accent,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                      if (_instructionsExpanded)
                                        Positioned(
                                          top: 46,
                                          right: 8,
                                          child: Tooltip(
                                            message: 'Add Bullet Point (Tap "B")',
                                            child: Material(
                                              color: isDark
                                                  ? TsColors.amber900
                                                      .withValues(alpha: 0.45)
                                                  : TsColors.accentSoft,
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              child: InkWell(
                                                onTap: _addInstructionBullet,
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                                child: Container(
                                                  width: 32,
                                                  height: 32,
                                                  decoration: BoxDecoration(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            10),
                                                    border: Border.all(
                                                      color: isDark
                                                          ? TsColors.amber800
                                                          : TsColors
                                                              .accentBorder,
                                                    ),
                                                  ),
                                                  child: Center(
                                                    child: Text(
                                                      'B',
                                                      style: TextStyle(
                                                        fontSize: 16,
                                                        fontWeight:
                                                            FontWeight.w900,
                                                        color: isDark
                                                            ? TsColors.amber300
                                                            : TsColors.accent,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      Positioned(
                                        bottom: 2,
                                        right: 4,
                                        child: GestureDetector(
                                          behavior: HitTestBehavior.opaque,
                                          onVerticalDragStart: (_) {
                                            if (!_instructionsExpanded) {
                                              setState(() =>
                                                  _instructionsExpanded = true);
                                            }
                                          },
                                          onVerticalDragUpdate: (details) {
                                            setState(() {
                                              if (!_instructionsExpanded) {
                                                _instructionsExpanded = true;
                                              }
                                              _instructionsDragExtraHeight =
                                                  (_instructionsDragExtraHeight +
                                                          details.delta.dy)
                                                      .clamp(0.0, 320.0);
                                            });
                                          },
                                          child: Tooltip(
                                            message: 'Drag to expand height',
                                            child: Container(
                                              width: 32,
                                              height: 28,
                                              alignment:
                                                  Alignment.bottomRight,
                                              padding: const EdgeInsets.only(
                                                  right: 4, bottom: 4),
                                              color: Colors.transparent,
                                              child: Transform.rotate(
                                                angle: -0.785398,
                                                child: Icon(
                                                  Icons.drag_handle_rounded,
                                                  size: 16,
                                                  color: isDark
                                                      ? TsColors.amber400
                                                          .withValues(
                                                              alpha: 0.65)
                                                      : TsColors.inkMuted
                                                          .withValues(
                                                              alpha: 0.6),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                }(),
                                const SizedBox(height: 14),
                                _DateTimeTile(
                                  label: 'Start Date & Time',
                                  value: _startsAt != null
                                      ? formatDateSingleLine(_startsAt!)
                                      : 'Select Start Date & Time ->',
                                  icon: Icons.play_circle_outline_rounded,
                                  accent: TsColors.ink,
                                  isDark: isDark,
                                  enabled: !_isEditMode,
                                  onTap: _isEditMode ? null : () => _pickDateTime(isStart: true),
                                ),
                                const SizedBox(height: 10),
                                _DateTimeTile(
                                  label: 'End Date & Time',
                                  value: _endsAt != null
                                      ? formatDateSingleLine(_endsAt!)
                                      : 'Select End Date & Time ->',
                                  icon: Icons.flag_circle_outlined,
                                  accent: TsColors.accent,
                                  isDark: isDark,
                                  onTap: () => _pickDateTime(isStart: false),
                                ),
                                const SizedBox(height: 10),
                                _TimerToggleTile(
                                  value: _showTimer,
                                  isDark: isDark,
                                  onChanged: (val) {
                                    setState(() => _showTimer = val);
                                  },
                                ),
                              ],
                            ),

                            const SizedBox(height: 16),

                            if (_negativeMarkingEnabled)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: InkWell(
                                    onTap: _showNegativeMarkingDialog,
                                    borderRadius: BorderRadius.circular(20),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                      decoration: BoxDecoration(
                                        color: isDark
                                            ? TsColors.amber900.withValues(alpha: 0.45)
                                            : TsColors.accentSoft,
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: isDark
                                              ? TsColors.amber800
                                              : TsColors.accentBorder,
                                        ),
                                      ),
                                      child: Text(
                                        'Negative: -${_formatNegLabel(_negativeMarkValue)}',
                                        style: TextStyle(
                                          color: isDark
                                              ? TsColors.amber300
                                              : TsColors.amber800,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                            const SizedBox(height: 8),

                            // Question Cards
                            for (int qIdx = 0; qIdx < _questions.length; qIdx++)
                              _buildQuestionCard(qIdx, isDark, cardColor, textPrimary, textSecondary),

                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: _addQuestion,
                              icon: const Icon(Icons.add_circle_outline_rounded),
                              label: const Text(
                                'Add Another Question',
                                style: TextStyle(fontWeight: FontWeight.w800),
                              ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                                backgroundColor: isDark ? AppColors.darkSurfaceRaised : Colors.white,
                                side: BorderSide(color: isDark ? TsColors.darkBorder : TsColors.border, width: 1.5),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Sticky Bottom Submit Bar
                    Container(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
                      decoration: BoxDecoration(
                        color: cardColor,
                        border: Border(top: BorderSide(color: borderColor)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, -4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _isSaving ? null : _openLivePreview,
                              icon: const Icon(Icons.visibility_rounded, size: 18),
                              label: const Text(
                                'Live Preview',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: TsColors.ink,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                elevation: 0,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _isSaving ? null : _save,
                              icon: _isSaving
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : Icon(_isEditMode ? Icons.check_rounded : Icons.rocket_launch_rounded, size: 18),
                              label: Text(
                                _isSaving
                                    ? 'Saving...'
                                    : (_isEditMode ? 'Save Changes' : 'Publish Test'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: TsColors.ink,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                elevation: 0,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
      ),
    );
  }

  Widget _buildQuestionCard(
    int qIdx,
    bool isDark,
    Color cardColor,
    Color textPrimary,
    Color textSecondary,
  ) {
    final q = _questions[qIdx];
    final resolvedQImg = widget.service.resolveMediaUrl(q.imageUrl);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TsColors.accent, width: 1.8),
        boxShadow: [
          BoxShadow(
            color: TsColors.accent.withValues(alpha: isDark ? 0.14 : 0.08),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Question header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: TsColors.ink,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Question ${qIdx + 1}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: q.isUploadingImage ? null : () => _pickAndUploadQuestionImage(qIdx),
                style: TextButton.styleFrom(foregroundColor: TsColors.accent),
                icon: q.isUploadingImage
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: TsColors.accent))
                    : const Icon(Icons.add_photo_alternate_rounded, size: 18),
                label: Text(
                  q.imageUrl.isNotEmpty ? 'Change Photo' : 'Question Photo',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Question Options',
                color: isDark ? TsColors.darkSurfaceElevated : TsColors.cardIvory,
                elevation: 8,
                surfaceTintColor: Colors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                    color: isDark ? TsColors.darkBorder : TsColors.accentBorder,
                    width: 1.2,
                  ),
                ),
                icon: Icon(
                  Icons.more_vert_rounded,
                  color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                  size: 20,
                ),
                onSelected: (action) {
                  if (action == 'negative') {
                    _showNegativeMarkingDialog();
                  } else if (action == 'delete') {
                    _removeQuestion(qIdx);
                  }
                },
                itemBuilder: (ctx) => [
                  PopupMenuItem<String>(
                    value: 'negative',
                    child: Row(
                      children: [
                        Icon(
                          Icons.remove_circle_outline_rounded,
                          size: 18,
                          color: isDark ? TsColors.amber300 : TsColors.accent,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Negative',
                          style: TextStyle(
                            color: textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (qIdx > 0)
                    const PopupMenuItem<String>(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(
                            Icons.delete_outline_rounded,
                            size: 18,
                            color: AppColors.danger500,
                          ),
                          SizedBox(width: 10),
                          Text(
                            'Delete',
                            style: TextStyle(
                              color: AppColors.danger500,
                              fontWeight: FontWeight.w700,
                              fontSize: 13.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: q.textController,
            keyboardType: TextInputType.multiline,
            textInputAction: TextInputAction.newline,
            maxLines: 4,
            minLines: 1,
            cursorColor: isDark ? TsColors.amber300 : TsColors.accent,
            onChanged: (_) => setState(() {}),
            style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 14.5),
            decoration: _inputDecoration(
              hint: 'Type question here (e.g., "Which one is Tiger?")',
              isDark: isDark,
            ),
          ),
          if (resolvedQImg.isNotEmpty) ...[
            const SizedBox(height: 10),
            Stack(
              children: [
                GestureDetector(
                  onTap: () => showTestSeriesImageZoom(context, resolvedQImg),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: AspectRatio(
                      aspectRatio: 300 / 185,
                      child: CachedNetworkImage(
                        imageUrl: resolvedQImg,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.surfaceSunken,
                          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.surfaceSunken,
                          child: const Center(child: Icon(Icons.broken_image_rounded)),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 6,
                  right: 6,
                  child: InkWell(
                    onTap: () => setState(() => q.imageUrl = ''),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                      child: const Icon(Icons.close_rounded, color: Colors.white, size: 16),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Text(
                'Options (${q.options.length}/5)',
                style: TextStyle(color: textSecondary, fontWeight: FontWeight.w700, fontSize: 12.5),
              ),
              const Spacer(),
              Text(
                'Tap circle to mark Correct Answer',
                style: TextStyle(color: AppColors.success600, fontWeight: FontWeight.w700, fontSize: 11.5),
              ),
            ],
          ),
          const SizedBox(height: 8),

          for (int oIdx = 0; oIdx < q.options.length; oIdx++)
            _buildOptionRow(qIdx, oIdx, isDark, textPrimary, textSecondary),

          if (q.options.length < 5)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _addOption(qIdx),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Option', style: TextStyle(fontWeight: FontWeight.w800)),
                style: TextButton.styleFrom(foregroundColor: TsColors.accent),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOptionRow(
    int qIdx,
    int oIdx,
    bool isDark,
    Color textPrimary,
    Color textSecondary,
  ) {
    final q = _questions[qIdx];
    final opt = q.options[oIdx];
    final isCorrect = q.correctOptionIndex == oIdx;
    final letter = String.fromCharCode(65 + oIdx);
    final resolvedOptImg = widget.service.resolveMediaUrl(opt.imageUrl);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isCorrect
            ? (isDark ? AppColors.success700.withValues(alpha: 0.22) : AppColors.success50)
            : (isDark ? AppColors.darkSurfaceCanvas : AppColors.surfaceSunken),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isCorrect
              ? AppColors.success600
              : (isDark ? const Color(0xFF334155) : AppColors.borderSubtle),
          width: isCorrect ? 1.6 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Mark Correct selector
              InkWell(
                onTap: () => setState(() => q.correctOptionIndex = oIdx),
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: isCorrect ? AppColors.success600 : (isDark ? const Color(0xFF334155) : Colors.white),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isCorrect ? AppColors.success600 : AppColors.borderStrong,
                            width: 1.5,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: isCorrect
                            ? const Icon(Icons.check_rounded, color: Colors.white, size: 17)
                            : Text(
                                letter,
                                style: TextStyle(
                                  color: textPrimary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12.5,
                                ),
                              ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isCorrect ? 'Correct ($letter)' : 'Option $letter',
                        style: TextStyle(
                          color: isCorrect ? AppColors.success700 : textSecondary,
                          fontWeight: FontWeight.w800,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              // Image upload button for Option
              InkWell(
                onTap: opt.isUploading ? null : () => _pickAndUploadOptionImage(qIdx, oIdx),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: TsColors.accentSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: TsColors.accentBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (opt.isUploading)
                        const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 2, color: TsColors.accent))
                      else
                        const Icon(Icons.image_outlined, size: 15, color: TsColors.accent),
                      const SizedBox(width: 4),
                      Text(
                        opt.imageUrl.isNotEmpty ? 'Change' : 'Image',
                        style: const TextStyle(
                          color: TsColors.accent,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (q.options.length > 2) ...[
                const SizedBox(width: 6),
                InkWell(
                  onTap: () => _removeOption(qIdx, oIdx),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(Icons.close_rounded, color: AppColors.danger500, size: 18),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          () {
            final isLastOption = oIdx == q.options.length - 1;
            return TextFormField(
              controller: opt.textController,
              focusNode: opt.focusNode,
              textInputAction: isLastOption ? TextInputAction.done : TextInputAction.next,
              onFieldSubmitted: (_) {
                if (!isLastOption) {
                  FocusScope.of(context).requestFocus(q.options[oIdx + 1].focusNode);
                } else {
                  FocusScope.of(context).unfocus();
                }
              },
              cursorColor: isDark ? TsColors.amber300 : TsColors.accent,
              onChanged: (_) => setState(() {}),
              style: TextStyle(color: textPrimary, fontSize: 13.5, fontWeight: FontWeight.w600),
              decoration: _inputDecoration(
                hint: opt.imageUrl.isNotEmpty
                    ? 'Optional label under image...'
                    : 'Option $letter text (or upload image)',
                isDark: isDark,
                compact: true,
              ),
            );
          }(),
          if (resolvedOptImg.isNotEmpty) ...[
            const SizedBox(height: 8),
            Stack(
              children: [
                GestureDetector(
                  onTap: () => showTestSeriesImageZoom(context, resolvedOptImg),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      width: 168,
                      child: AspectRatio(
                        aspectRatio: 280 / 200,
                        child: CachedNetworkImage(
                          imageUrl: resolvedOptImg,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: Colors.black12,
                            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            color: Colors.black12,
                            child: const Icon(Icons.broken_image_rounded),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: InkWell(
                    onTap: () => setState(() => opt.imageUrl = ''),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                      child: const Icon(Icons.close_rounded, color: Colors.white, size: 14),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({
    String? label,
    required String hint,
    required bool isDark,
    bool compact = false,
    bool alignLabelWithHint = false,
    double? rightPadding,
    double? bottomPadding,
  }) {
    return InputDecoration(
      labelText: label,
      alignLabelWithHint: alignLabelWithHint,
      labelStyle: TextStyle(
        color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
      ),
      floatingLabelStyle: const TextStyle(
        color: TsColors.accent,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
      hintText: hint,
      hintStyle: TextStyle(
        color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
      filled: true,
      fillColor: isDark ? AppColors.darkSurfaceCanvas : Colors.white,
      isDense: compact,
      contentPadding: EdgeInsets.fromLTRB(
        14,
        compact ? 10 : 12,
        rightPadding ?? 14,
        bottomPadding ?? (compact ? 10 : 12),
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : TsColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : TsColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: TsColors.accent, width: 1.5),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final Color cardColor;
  final bool isDark;
  final List<Widget> children;

  const _SectionCard({
    required this.cardColor,
    required this.isDark,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TsColors.accent, width: 1.8),
        boxShadow: [
          BoxShadow(
            color: TsColors.accent.withValues(alpha: isDark ? 0.14 : 0.08),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _DateTimeTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final bool isDark;
  final bool enabled;
  final VoidCallback? onTap;

  const _DateTimeTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.isDark,
    this.enabled = true,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveAccent = enabled
        ? accent
        : (isDark ? AppColors.darkTextMuted : TsColors.inkMuted);

    return SizedBox(
      width: double.infinity,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: enabled
                ? (isDark ? AppColors.darkSurfaceCanvas : accent.withValues(alpha: 0.06))
                : (isDark ? AppColors.darkSurfaceCanvas.withValues(alpha: 0.6) : TsColors.slate100),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: enabled
                  ? accent.withValues(alpha: 0.35)
                  : (isDark ? TsColors.darkBorder : TsColors.border),
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: effectiveAccent.withValues(alpha: isDark ? 0.22 : 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: effectiveAccent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      enabled ? label : '$label (Locked)',
                      style: TextStyle(
                        color: effectiveAccent,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: enabled
                            ? (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary)
                            : (isDark ? AppColors.darkTextSecondary : TsColors.inkMuted),
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                enabled ? Icons.edit_calendar_rounded : Icons.lock_outline_rounded,
                size: 18,
                color: effectiveAccent.withValues(alpha: 0.85),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimerToggleTile extends StatelessWidget {
  final bool value;
  final bool isDark;
  final ValueChanged<bool> onChanged;

  const _TimerToggleTile({
    required this.value,
    required this.isDark,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final accent = value
        ? TsColors.accent
        : (isDark ? AppColors.darkTextSecondary : TsColors.ink);

    return SizedBox(
      width: double.infinity,
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurfaceCanvas
                : accent.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: value
                  ? TsColors.accent.withValues(alpha: 0.5)
                  : accent.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: isDark ? 0.22 : 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.timer_outlined, size: 18, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Attempt Timer',
                      style: TextStyle(
                        color: accent,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value
                          ? 'Show completion time to students'
                          : 'Hide completion time from students',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.darkTextPrimary
                            : AppColors.textPrimary,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: value,
                activeTrackColor: TsColors.accent,
                activeThumbColor: Colors.white,
                onChanged: onChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RectangularPhotoCropDialog extends StatefulWidget {
  final File imageFile;
  final double cropWidth;
  final double cropHeight;
  final String title;

  const _RectangularPhotoCropDialog({
    required this.imageFile,
    this.cropWidth = 280,
    this.cropHeight = 200,
    this.title = 'Crop Photo',
  });

  @override
  State<_RectangularPhotoCropDialog> createState() =>
      _RectangularPhotoCropDialogState();
}

class _RectangularPhotoCropDialogState
    extends State<_RectangularPhotoCropDialog> {
  final GlobalKey _cropKey = GlobalKey();
  final TransformationController _transformController =
      TransformationController();
  bool _isProcessing = false;

  Future<void> _cropAndFinish() async {
    setState(() => _isProcessing = true);
    try {
      final boundary = _cropKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) {
        if (mounted) setState(() => _isProcessing = false);
        return;
      }
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData =
          await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        if (mounted) setState(() => _isProcessing = false);
        return;
      }

      final bytes = byteData.buffer.asUint8List();
      if (bytes.length > 2 * 1024 * 1024) {
        if (mounted) {
          setState(() => _isProcessing = false);
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'File size cannot exceed 2 MB.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              backgroundColor: AppColors.danger600,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          );
        }
        return;
      }
      final tempDir = await getTemporaryDirectory();
      final croppedFile = File(
        '${tempDir.path}/ts_crop_${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await croppedFile.writeAsBytes(bytes);

      if (mounted) {
        Navigator.pop(context, croppedFile);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error cropping image: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: TsColors.ink,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  widget.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                  onPressed: _isProcessing ? null : () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pinch to zoom and drag to position within the rectangle.',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 18),
            Center(
              child: Container(
                width: widget.cropWidth,
                height: widget.cropHeight,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: TsColors.accentBright, width: 3),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: RepaintBoundary(
                    key: _cropKey,
                    child: Container(
                      color: Colors.black,
                      width: widget.cropWidth,
                      height: widget.cropHeight,
                      child: InteractiveViewer(
                        transformationController: _transformController,
                        minScale: 0.5,
                        maxScale: 4.0,
                        boundaryMargin: const EdgeInsets.all(200),
                        child: Image.file(
                          widget.imageFile,
                          width: widget.cropWidth,
                          height: widget.cropHeight,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed:
                        _isProcessing ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0xFF334155)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Text('Cancel',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isProcessing ? null : _cropAndFinish,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: TsColors.accentBright,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _isProcessing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2),
                          )
                        : const Text('Done',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
