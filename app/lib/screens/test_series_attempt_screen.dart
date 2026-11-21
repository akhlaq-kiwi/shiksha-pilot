import 'dart:async';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/http_service.dart' as http;
import '../constants/app_colors.dart';
import '../services/test_series_service.dart';
import '../widgets/test_series_shared.dart';

class TestSeriesAttemptScreen extends StatefulWidget {
  final TestSeriesService service;
  final int testSeriesId;
  final int? studentId;
  final String? initialTitle;
  final bool isPreview;
  final Map<String, dynamic>? previewSeries;
  final List<Map<String, dynamic>>? previewQuestions;

  const TestSeriesAttemptScreen({
    super.key,
    required this.service,
    required this.testSeriesId,
    this.studentId,
    this.initialTitle,
    this.isPreview = false,
    this.previewSeries,
    this.previewQuestions,
  });

  @override
  State<TestSeriesAttemptScreen> createState() => _TestSeriesAttemptScreenState();
}

class _TestSeriesAttemptScreenState extends State<TestSeriesAttemptScreen>
    with WidgetsBindingObserver {
  bool _isLoading = true;
  bool _isSubmitting = false;
  String _error = '';

  Map<String, dynamic> _seriesInfo = {};
  List<Map<String, dynamic>> _questions = [];
  final Map<int, int?> _selectedOptions = {};
  int _currentIndex = 0;

  Timer? _tickerTimer;
  DateTime? _closingDeadline;
  int _elapsedSeconds = 0;
  int _localDraftElapsed = 0;
  int _lastPauseSyncedSeconds = 0;
  bool _timerPaused = false;
  Map<String, dynamic>? _submissionResult;

  String get _draftStorageKey =>
      'ts_draft_${widget.testSeriesId}_${widget.studentId ?? 0}';

  bool get _showTimer => _seriesInfo['show_timer'] == true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAttempt();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tickerTimer?.cancel();
    if (!widget.isPreview &&
        _submissionResult == null &&
        !_isLoading &&
        _error.isEmpty) {
      unawaited(_pauseElapsedAndSync());
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (widget.isPreview || _submissionResult != null || _isLoading || _error.isNotEmpty) {
      return;
    }
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _pauseElapsedAndSync();
    } else if (state == AppLifecycleState.resumed) {
      if (_closingDeadline != null && !DateTime.now().isBefore(_closingDeadline!)) {
        if (!_isSubmitting) {
          _submitTest(autoTriggered: true);
        }
        return;
      }
      if (mounted) {
        setState(() => _timerPaused = false);
      } else {
        _timerPaused = false;
      }
    }
  }

  Future<void> _pauseElapsedAndSync() async {
    _timerPaused = true;
    await _persistDraftAnswers();
    if (widget.isPreview ||
        _submissionResult != null ||
        widget.testSeriesId <= 0) {
      return;
    }
    if (_elapsedSeconds > _lastPauseSyncedSeconds) {
      final secSnapshot = _elapsedSeconds;
      _lastPauseSyncedSeconds = secSnapshot;
      try {
        await widget.service.pauseStudentAttempt(
          widget.testSeriesId,
          secSnapshot,
          studentId: widget.studentId,
        );
      } catch (_) {}
    }
  }

  Future<void> _restoreDraftAnswers() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_draftStorageKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = json.decode(raw);
      if (decoded is! Map) return;

      final validQIds = _questions.map((q) => (q['id'] as num).toInt()).toSet();
      Map<dynamic, dynamic> answerMap = decoded;
      if (decoded['answers'] is Map) {
        answerMap = decoded['answers'] as Map;
        final savedElapsed = (decoded['elapsed_seconds'] as num?)?.toInt() ?? 0;
        if (savedElapsed > 0) {
          _localDraftElapsed = savedElapsed;
        }
      }

      answerMap.forEach((k, v) {
        final qid = int.tryParse(k.toString());
        final oid = v is num ? v.toInt() : int.tryParse(v?.toString() ?? '');
        if (qid != null && validQIds.contains(qid) && oid != null) {
          final q = _questions.firstWhere((e) => (e['id'] as num).toInt() == qid);
          final opts = (q['options'] as List? ?? []);
          final optExists = opts.any((o) => (o['id'] as num?)?.toInt() == oid);
          if (optExists) {
            _selectedOptions[qid] = oid;
          }
        }
      });
    } catch (_) {}
  }

  Future<void> _persistDraftAnswers() async {
    if (widget.isPreview) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final answersMap = <String, int>{};
      _selectedOptions.forEach((qid, oid) {
        if (oid != null) answersMap[qid.toString()] = oid;
      });
      await prefs.setString(
        _draftStorageKey,
        json.encode({
          'answers': answersMap,
          'elapsed_seconds': _elapsedSeconds,
        }),
      );
    } catch (_) {}
  }

  Future<void> _clearDraftAnswers() async {
    if (widget.isPreview) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_draftStorageKey);
    } catch (_) {}
  }

  Future<void> _loadAttempt() async {
    if (widget.isPreview) {
      final series = Map<String, dynamic>.from(widget.previewSeries ?? {});
      final questions = (widget.previewQuestions ?? [])
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      setState(() {
        _seriesInfo = series;
        _questions = questions;
        _elapsedSeconds = 0;
        _timerPaused = false;
        _closingDeadline = null;
        _isLoading = false;
        _error = '';
      });
      _startTicker();
      return;
    }

    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final res = await widget.service.startStudentAttempt(
        widget.testSeriesId,
        studentId: widget.studentId,
      );

      final series = Map<String, dynamic>.from(res['test_series'] as Map? ?? {});
      final rawQuestions = (res['questions'] as List? ?? []);
      final questions = rawQuestions
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      _questions = questions;
      _localDraftElapsed = 0;
      await _restoreDraftAnswers();

      final secs = (series['seconds_remaining'] as num?)?.toInt() ?? 0;
      final serverElapsed = (res['elapsed_seconds'] as num?)?.toInt() ?? 0;
      final initialElapsed =
          serverElapsed > _localDraftElapsed ? serverElapsed : _localDraftElapsed;

      if (!mounted) return;
      setState(() {
        _seriesInfo = series;
        _elapsedSeconds = initialElapsed < 0 ? 0 : initialElapsed;
        _lastPauseSyncedSeconds = serverElapsed;
        _timerPaused = false;
        _closingDeadline =
            secs > 0 ? DateTime.now().add(Duration(seconds: secs)) : null;
        _isLoading = false;
      });

      _startTicker();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = http.isNetworkError(e)
            ? http.kNetworkErrorMessage
            : (e is TestSeriesApiException ? e.message : http.formatErrorMessage(e));
        _isLoading = false;
      });
    }
  }

  void _startTicker() {
    _tickerTimer?.cancel();
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _submissionResult != null) {
        timer.cancel();
        return;
      }

      if (!widget.isPreview &&
          _closingDeadline != null &&
          !DateTime.now().isBefore(_closingDeadline!)) {
        timer.cancel();
        if (!_isSubmitting) {
          _submitTest(autoTriggered: true);
        }
        return;
      }

      if (_timerPaused) return;

      setState(() {
        _elapsedSeconds++;
      });

      if (!widget.isPreview && _elapsedSeconds % 5 == 0) {
        _persistDraftAnswers();
      }
    });
  }

  int get _answeredCount =>
      _selectedOptions.values.where((v) => v != null).length;

  void _selectOption(int questionId, int optionId) {
    if (_isSubmitting || _submissionResult != null) return;
    setState(() {
      _selectedOptions[questionId] = optionId;
    });
    _persistDraftAnswers();
  }

  void _showUnansweredDialog(BuildContext sheetCtx, bool isDark) {
    final unansweredIndices = <int>[];
    for (int i = 0; i < _questions.length; i++) {
      final qId = (_questions[i]['id'] as num).toInt();
      if (_selectedOptions[qId] == null) {
        unansweredIndices.add(i);
      }
    }
    if (unansweredIndices.isEmpty) return;

    final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
    final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) => Dialog(
        backgroundColor: bg,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: borderCol, width: 1.5),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420, maxHeight: 520),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
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
                        Icons.help_outline_rounded,
                        size: 24,
                        color: isDark ? TsColors.amber300 : TsColors.accent,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Unanswered Questions',
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${unansweredIndices.length} of ${_questions.length} questions skipped',
                            style: TextStyle(
                              color: textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close_rounded, size: 20, color: textSecondary),
                      onPressed: () => Navigator.pop(dialogCtx),
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Close',
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Divider(color: isDark ? TsColors.darkBorder : TsColors.border, height: 1),
                const SizedBox(height: 14),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tap on any question number below to answer it:',
                          style: TextStyle(
                            color: textSecondary,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: unansweredIndices.map((index) {
                            final qNum = index + 1;
                            return Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () {
                                  Navigator.pop(dialogCtx);
                                  Navigator.pop(sheetCtx, false);
                                  setState(() {
                                    _currentIndex = index;
                                  });
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? TsColors.amber900.withValues(alpha: 0.3)
                                        : AppColors.warning50,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isDark
                                          ? TsColors.amber800.withValues(alpha: 0.6)
                                          : AppColors.warning500.withValues(alpha: 0.6),
                                      width: 1.2,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'Question $qNum',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                          color: isDark
                                              ? const Color(0xFFFDE68A)
                                              : AppColors.warning700,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Icon(
                                        Icons.arrow_forward_ios_rounded,
                                        size: 11,
                                        color: isDark
                                            ? const Color(0xFFFDE68A)
                                            : AppColors.warning700,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(dialogCtx),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: textPrimary,
                      side: BorderSide(color: isDark ? TsColors.darkBorder : TsColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Back to Submit Dialog', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmAndSubmit() async {
    final total = _questions.length;
    final answered = _answeredCount;
    final unanswered = total - answered;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sheetBg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;

    if (widget.isPreview) {
      final exitPreview = await showModalBottomSheet<bool>(
        context: context,
        backgroundColor: sheetBg,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (ctx) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? TsColors.darkBorder : AppColors.borderStrong,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Live Preview Complete',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'This is the exact interface students see when attempting the test. Preview responses are not saved.',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryPill(
                          label: 'Answered',
                          value: '$answered / $total',
                          color: AppColors.success600,
                          bgColor: isDark
                              ? TsColors.emerald900.withValues(alpha: 0.3)
                              : AppColors.success50,
                        ),
                      ),
                      if (_showTimer) ...[
                        const SizedBox(width: 12),
                        Expanded(
                          child: _SummaryPill(
                            label: 'Preview Timer',
                            value: formatTimerClock(_elapsedSeconds),
                            color: TsColors.accent,
                            bgColor: isDark
                                ? TsColors.amber900.withValues(alpha: 0.3)
                                : TsColors.accentSoft,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: isDark
                                ? AppColors.darkTextPrimary
                                : TsColors.ink,
                            side: BorderSide(
                              color: isDark ? TsColors.darkBorder : TsColors.border,
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text('Keep Previewing'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => Navigator.pop(ctx, true),
                          icon: const Icon(Icons.edit_rounded, size: 18),
                          label: const Text(
                            'Back to Editor',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: TsColors.ink,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
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
      if (exitPreview == true && mounted) {
        Navigator.pop(context, false);
      }
      return;
    }

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: sheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? TsColors.darkBorder : AppColors.borderStrong,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Submit Test Series?',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Once submitted, answers cannot be edited. Results & Rank unlock automatically after closing.',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _SummaryPill(
                        label: 'Answered',
                        value: '$answered / $total',
                        color: AppColors.success600,
                        bgColor: isDark ? TsColors.emerald900.withValues(alpha: 0.3) : AppColors.success50,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _SummaryPill(
                        label: 'Unanswered',
                        value: '$unanswered',
                        color: unanswered > 0 ? AppColors.warning600 : AppColors.textMuted,
                        bgColor: unanswered > 0
                            ? (isDark ? TsColors.amber900.withValues(alpha: 0.3) : AppColors.warning50)
                            : (isDark ? TsColors.darkSurfaceElevated : TsColors.slate100),
                        onTap: unanswered > 0 ? () => _showUnansweredDialog(ctx, isDark) : null,
                      ),
                    ),
                  ],
                ),
                if (unanswered > 0) ...[
                  const SizedBox(height: 12),
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _showUnansweredDialog(ctx, isDark),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isDark ? TsColors.amber900.withValues(alpha: 0.2) : AppColors.warning50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.warning500.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: AppColors.warning600, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'You still have $unanswered unanswered question${unanswered == 1 ? '' : 's'}. Tap to view.',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.warning700,
                                ),
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded, color: AppColors.warning600, size: 18),
                          ],
                        ),
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
                          foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                          side: BorderSide(color: isDark ? TsColors.darkBorder : TsColors.border),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Review Answers'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => Navigator.pop(ctx, true),
                        icon: const Icon(Icons.check_circle_rounded, size: 18),
                        label: const Text('Submit Now', style: TextStyle(fontWeight: FontWeight.w700)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success600,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

    if (confirmed == true) {
      await _submitTest(autoTriggered: false);
    }
  }

  Future<void> _submitTest({required bool autoTriggered}) async {
    if (widget.isPreview || _isSubmitting || _submissionResult != null) return;
    _timerPaused = true;
    setState(() {
      _isSubmitting = true;
    });

    try {
      final answers = _questions.map((q) {
        final qid = (q['id'] as num).toInt();
        return {
          'question_id': qid,
          'selected_option_id': _selectedOptions[qid],
        };
      }).toList();

      final result = await widget.service.submitStudentAttempt(
        widget.testSeriesId,
        answers,
        studentId: widget.studentId,
        elapsedSeconds: _elapsedSeconds,
      );

      _tickerTimer?.cancel();
      await _clearDraftAnswers();

      if (!mounted) return;
      setState(() {
        _submissionResult = {
          ...result,
          'auto_submitted': autoTriggered,
        };
        _isSubmitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      _timerPaused = false;
      setState(() {
        _isSubmitting = false;
      });
      final msg = http.isNetworkError(e)
          ? http.kNetworkErrorMessage
          : (e is TestSeriesApiException ? e.message : http.formatErrorMessage(e));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: AppColors.danger600,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<bool> _handleExitPrompt() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary =
        isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
    final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

    final leave = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
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
                  Icons.pause_circle_outline_rounded,
                  size: 28,
                  color: isDark ? TsColors.amber300 : TsColors.accent,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Leave Test for Now?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your selected answers are saved on this device so you can resume anytime before the test closes.',
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
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: textPrimary,
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
                        'Stay Here',
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
                        'Leave',
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
      ),
    );
    if (leave == true) {
      await _pauseElapsedAndSync();
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canPopDirect =
        widget.isPreview || _submissionResult != null || _isLoading || _error.isNotEmpty;
    final showLiveStopwatch =
        _showTimer && _submissionResult == null && !_isLoading && _error.isEmpty && _questions.isNotEmpty;

    return PopScope(
      canPop: canPopDirect,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        final ok = await _handleExitPrompt();
        if (ok && mounted) {
          navigator.pop(false);
        }
      },
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas,
        appBar: AppBar(
          backgroundColor: isDark ? AppColors.darkSurfaceRaised : Colors.transparent,
          scrolledUnderElevation: 0,
          foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                (_seriesInfo['title'] ?? widget.initialTitle ?? 'Test Series')
                    .toString()
                    .toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
              if ((_seriesInfo['subject_name'] ?? '').toString().trim().isNotEmpty)
                Text(
                  _seriesInfo['subject_name'].toString().toUpperCase(),
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
                  ),
                ),
            ],
          ),
          actions: [
            if (widget.isPreview)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isDark ? TsColors.amber900.withValues(alpha: 0.5) : TsColors.accentSoft,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDark ? TsColors.amber800 : TsColors.accentBorder,
                  ),
                ),
                child: Text(
                  'PREVIEW',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.4,
                    color: isDark ? TsColors.amber300 : TsColors.amber800,
                  ),
                ),
              ),
            if (showLiveStopwatch)
              Container(
                margin: const EdgeInsets.only(right: 12),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isDark ? TsColors.darkSurfaceElevated : TsColors.ink,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isDark ? TsColors.darkBorder : TsColors.ink,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.timer_outlined, size: 14, color: TsColors.amber300),
                    const SizedBox(width: 5),
                    Text(
                      formatTimerClock(_elapsedSeconds),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? _buildErrorState(isDark)
                : _submissionResult != null
                    ? _buildSubmittedView(isDark)
                    : _questions.isEmpty
                        ? Center(
                            child: Text(
                              'No questions available in this Test Series.',
                              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                            ),
                          )
                        : _buildQuestionBody(isDark),
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.danger50,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.lock_clock_rounded, size: 42, color: AppColors.danger600),
            ),
            const SizedBox(height: 16),
            Text(
              _error,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Go Back'),
                ),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: _loadAttempt,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: TsColors.ink,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmittedView(bool isDark) {
    final res = _submissionResult!;
    final answered = res['answered_count'] ?? _answeredCount;
    final total = res['total_questions'] ?? _questions.length;
    final submittedAt = formatTestDateTime(res['submitted_at']?.toString());
    final endsAt = formatTestDateTime((res['ends_at'] ?? _seriesInfo['ends_at'])?.toString());
    final autoSubmitted = res['auto_submitted'] == true;
    final showTimer = res['show_timer'] == true || _showTimer;
    final timeTaken = (res['time_taken_seconds'] as num?)?.toInt() ?? _elapsedSeconds;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 460),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [TsColors.success, TsColors.accent],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, color: Colors.white, size: 44),
              ),
              const SizedBox(height: 18),
              Text(
                autoSubmitted ? 'Time Up! Test Submitted' : 'Test Submitted!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                (_seriesInfo['title'] ?? 'Test Series').toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: TsColors.accent,
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _SummaryPill(
                      label: 'Questions Answered',
                      value: '$answered / $total',
                      color: AppColors.success600,
                      bgColor: isDark ? TsColors.emerald900.withValues(alpha: 0.25) : AppColors.success50,
                    ),
                  ),
                  if (showTimer) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: _SummaryPill(
                        label: 'Time Taken',
                        value: formatDurationSeconds(timeTaken),
                        color: TsColors.accent,
                        bgColor: isDark ? TsColors.amber900.withValues(alpha: 0.25) : TsColors.accentSoft,
                      ),
                    ),
                  ],
                ],
              ),
              if (submittedAt.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Submitted on $submittedAt',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? TsColors.amber900.withValues(alpha: 0.35) : TsColors.accentSoft,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: TsColors.accentBorder),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.emoji_events_rounded, color: TsColors.accent, size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Results & Leaderboard Locked Until Close',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: isDark ? TsColors.amber300 : TsColors.amber800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            endsAt.isNotEmpty
                                ? 'Your exact rank, score, answer review & Top-3 certificates unlock on $endsAt.'
                                : 'Your rank, score & leaderboard will unlock automatically when the test closes.',
                            style: TextStyle(
                              fontSize: 12,
                              height: 1.35,
                              color: isDark ? AppColors.darkTextSecondary : TsColors.inkSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pop(context, true),
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Back to Test Series', style: TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: TsColors.ink,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuestionBody(bool isDark) {
    final question = _questions[_currentIndex];
    final qId = (question['id'] as num).toInt();
    final qText = (question['question_text'] ?? '').toString().trim();
    final qImgRaw = (question['question_image_url'] ?? '').toString().trim();
    final qImgUrl = widget.service.resolveMediaUrl(qImgRaw);
    final options = (question['options'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final selectedOptionId = _selectedOptions[qId];
    final hasAnyOptionImage = options.any(
      (o) => (o['option_image_url'] ?? '').toString().trim().isNotEmpty,
    );

    final progress = _questions.isEmpty ? 0.0 : _answeredCount / _questions.length;

    return Column(
      children: [
        LinearProgressIndicator(
          value: progress,
          minHeight: 4,
          backgroundColor: isDark ? TsColors.darkBorder : TsColors.border,
          valueColor: const AlwaysStoppedAnimation<Color>(TsColors.accent),
        ),

        // Scrollable Question + Options
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.03),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: TsColors.ink,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'Question ${_currentIndex + 1}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 12.5,
                              ),
                            ),
                          ),
                          if (_seriesInfo['negative_marking_enabled'] == true &&
                              (_seriesInfo['negative_mark_label'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.danger50,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppColors.danger500.withValues(alpha: 0.3),
                                ),
                              ),
                              child: Text(
                                '-${_seriesInfo['negative_mark_label']} Negative',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.danger600,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: selectedOptionId != null
                                  ? (isDark ? TsColors.emerald900.withValues(alpha: 0.4) : AppColors.success50)
                                  : (isDark ? TsColors.darkSurfaceElevated : TsColors.slate100),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              selectedOptionId != null ? 'Answered' : 'Not Answered',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: selectedOptionId != null
                                    ? AppColors.success600
                                    : (isDark ? AppColors.darkTextMuted : AppColors.textMuted),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (qText.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Text(
                          qText,
                          style: TextStyle(
                            fontSize: 17,
                            height: 1.4,
                            fontWeight: FontWeight.w700,
                            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                          ),
                        ),
                      ],
                      if (qImgUrl.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        GestureDetector(
                          onTap: () => showTestSeriesImageZoom(context, qImgUrl, caption: qText.isNotEmpty ? qText : 'Question ${_currentIndex + 1}'),
                          child: Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: AspectRatio(
                                  aspectRatio: 300 / 185,
                                  child: CachedNetworkImage(
                                    imageUrl: qImgUrl,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                    placeholder: (_, __) => Container(
                                      color: isDark ? TsColors.darkSurfaceElevated : TsColors.slate100,
                                      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                    ),
                                    errorWidget: (_, __, ___) => Container(
                                      color: isDark ? TsColors.darkSurfaceElevated : TsColors.slate100,
                                      child: const Center(child: Icon(Icons.broken_image_rounded, size: 36)),
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 8,
                                right: 8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.65),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.zoom_in_rounded, color: Colors.white, size: 14),
                                      SizedBox(width: 4),
                                      Text('Zoom', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 16),
                Text(
                  hasAnyOptionImage ? 'Tap the correct picture card' : 'Choose the correct option',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 10),

                if (hasAnyOptionImage)
                  Column(
                    children: [
                      for (int row = 0; row < options.length; row += 2) ...[
                        if (row > 0) const SizedBox(height: 12),
                        IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: _buildImageOptionCard(
                                  qId: qId,
                                  option: options[row],
                                  index: row,
                                  isSelected: selectedOptionId ==
                                      (options[row]['id'] as num).toInt(),
                                  isDark: isDark,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: row + 1 < options.length
                                    ? _buildImageOptionCard(
                                        qId: qId,
                                        option: options[row + 1],
                                        index: row + 1,
                                        isSelected: selectedOptionId ==
                                            (options[row + 1]['id'] as num)
                                                .toInt(),
                                        isDark: isDark,
                                      )
                                    : const SizedBox.shrink(),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  )
                else
                  Column(
                    children: List.generate(options.length, (idx) {
                      final opt = options[idx];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _buildTextOptionCard(
                          qId: qId,
                          option: opt,
                          index: idx,
                          isSelected: selectedOptionId == (opt['id'] as num).toInt(),
                          isDark: isDark,
                        ),
                      );
                    }),
                  ),
              ],
            ),
          ),
        ),

        // Bottom Prev / Next Bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
            border: Border(top: BorderSide(color: isDark ? TsColors.darkBorder : AppColors.borderSubtle)),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _currentIndex > 0
                        ? () => setState(() => _currentIndex--)
                        : null,
                    icon: const Icon(Icons.chevron_left_rounded),
                    label: const Text('Previous'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    '$_answeredCount/${_questions.length}',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                ),
                Expanded(
                  child: _currentIndex < _questions.length - 1
                      ? ElevatedButton.icon(
                          onPressed: () => setState(() => _currentIndex++),
                          icon: const Icon(Icons.chevron_right_rounded),
                          label: const Text('Next', style: TextStyle(fontWeight: FontWeight.w800)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: TsColors.ink,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        )
                      : ElevatedButton.icon(
                          onPressed: _isSubmitting ? null : _confirmAndSubmit,
                          icon: _isSubmitting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.check_circle_rounded, size: 18),
                          label: const Text('Finish', style: TextStyle(fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success600,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildImageOptionCard({
    required int qId,
    required Map<String, dynamic> option,
    required int index,
    required bool isSelected,
    required bool isDark,
  }) {
    final optId = (option['id'] as num).toInt();
    final letter = String.fromCharCode(65 + index);
    final optText = (option['option_text'] ?? '').toString().trim();
    final imgUrl = widget.service.resolveMediaUrl(option['option_image_url']?.toString());

    return GestureDetector(
      onTap: () => _selectOption(qId, optId),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? TsColors.amber900.withValues(alpha: 0.4) : TsColors.cardIvory)
              : (isDark ? AppColors.darkSurfaceRaised : Colors.white),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? TsColors.accent
                : (isDark ? TsColors.darkBorder : TsColors.border),
            width: isSelected ? 2.5 : 1.2,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: TsColors.accent.withValues(alpha: 0.16),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? TsColors.accent
                        : (isDark ? TsColors.darkSurfaceElevated : TsColors.slate100),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    letter,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: isSelected
                          ? Colors.white
                          : (isDark ? AppColors.darkTextPrimary : TsColors.ink),
                    ),
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.check_circle_rounded, color: TsColors.accent, size: 22)
                else
                  Icon(
                    Icons.radio_button_unchecked_rounded,
                    color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                    size: 20,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            AspectRatio(
              aspectRatio: 280 / 200,
              child: imgUrl.isNotEmpty
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            color: isDark ? TsColors.darkSurfaceElevated : AppColors.surfaceSunken,
                            child: CachedNetworkImage(
                              imageUrl: imgUrl,
                              fit: BoxFit.cover,
                              placeholder: (_, __) => const Center(
                                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                              ),
                              errorWidget: (_, __, ___) => const Icon(Icons.broken_image_rounded, color: AppColors.textMuted),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 5,
                          bottom: 5,
                          child: GestureDetector(
                            onTap: () => showTestSeriesImageZoom(context, imgUrl, caption: optText.isNotEmpty ? 'Option $letter: $optText' : 'Option $letter'),
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.65),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.zoom_in_rounded, color: Colors.white, size: 14),
                            ),
                          ),
                        ),
                      ],
                    )
                  : Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isDark ? TsColors.darkSurfaceElevated : AppColors.surfaceSunken,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        optText.isNotEmpty ? optText : 'Option $letter',
                        textAlign: TextAlign.center,
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                    ),
            ),
            if (optText.isNotEmpty && imgUrl.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                optText,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: isSelected
                      ? (isDark ? TsColors.amber300 : TsColors.accent)
                      : (isDark ? AppColors.darkTextPrimary : TsColors.ink),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTextOptionCard({
    required int qId,
    required Map<String, dynamic> option,
    required int index,
    required bool isSelected,
    required bool isDark,
  }) {
    final optId = (option['id'] as num).toInt();
    final letter = String.fromCharCode(65 + index);
    final optText = (option['option_text'] ?? '').toString().trim();

    return GestureDetector(
      onTap: () => _selectOption(qId, optId),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? TsColors.amber900.withValues(alpha: 0.4) : TsColors.cardIvory)
              : (isDark ? AppColors.darkSurfaceRaised : Colors.white),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? TsColors.accent
                : (isDark ? TsColors.darkBorder : TsColors.border),
            width: isSelected ? 2 : 1.1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected
                    ? TsColors.accent
                    : (isDark ? TsColors.darkSurfaceElevated : TsColors.slate100),
                shape: BoxShape.circle,
              ),
              child: Text(
                letter,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: isSelected
                      ? Colors.white
                      : (isDark ? AppColors.darkTextPrimary : TsColors.ink),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                optText.isNotEmpty ? optText : 'Option $letter',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
              color: isSelected
                  ? TsColors.accent
                  : (isDark ? AppColors.darkTextMuted : TsColors.inkMuted),
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final Color bgColor;
  final VoidCallback? onTap;

  const _SummaryPill({
    required this.label,
    required this.value,
    required this.color,
    required this.bgColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: onTap != null
            ? Border.all(color: color.withValues(alpha: 0.4), width: 1.2)
            : null,
      ),
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
              if (onTap != null) ...[
                const SizedBox(width: 4),
                Icon(Icons.touch_app_rounded, size: 14, color: color),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: pill,
        ),
      );
    }
    return pill;
  }
}
