import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:school_hub/services/http_service.dart' as http_svc;
import 'package:school_hub/services/school_examination_service.dart';
import 'package:school_hub/utils/class_formatter.dart';
import 'package:school_hub/screens/full_screen_image_screen.dart';

class MarksSpreadsheetScreen extends StatefulWidget {
  final int examId;
  final String examName;
  final int classId;
  final String className;
  final List<dynamic>? assignedClasses;
  final List<dynamic>? initialSubjects;
  final String baseUrl;
  final String token;
  final String userRole;

  const MarksSpreadsheetScreen({
    Key? key,
    required this.examId,
    required this.examName,
    required this.classId,
    required this.className,
    this.assignedClasses,
    this.initialSubjects,
    required this.baseUrl,
    required this.token,
    required this.userRole,
  }) : super(key: key);

  @override
  _MarksSpreadsheetScreenState createState() => _MarksSpreadsheetScreenState();
}

class _MarksSpreadsheetScreenState extends State<MarksSpreadsheetScreen> {
  late SchoolExaminationService _examService;

  late int _selectedClassId;
  late String _currentClassName;

  List<dynamic> _scheduledSubjects = [];
  int? _selectedSubjectId;

  Map<String, dynamic>? _marksSheetData;
  bool _loadingMarks = true;
  String? _errorMessage;

  final Set<int> _savingMarkStudentIds = {};
  final Map<int, TextEditingController> _markControllers = {};
  final Map<int, TextEditingController> _remarkControllers = {};
  final Map<int, FocusNode> _markFocusNodes = {};
  final Map<int, bool> _absentStates = {};
  final ScrollController _subjectScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _examService = SchoolExaminationService(
      baseUrl: widget.baseUrl,
      token: widget.token,
    );
    _selectedClassId = widget.classId;
    _currentClassName = widget.className;

    _setupScheduledSubjectsAndLoad();
  }

  @override
  void dispose() {
    for (final c in _markControllers.values) {
      c.dispose();
    }
    for (final c in _remarkControllers.values) {
      c.dispose();
    }
    for (final f in _markFocusNodes.values) {
      f.dispose();
    }
    _subjectScrollController.dispose();
    super.dispose();
  }

  bool _isPaperGrade(dynamic p) {
    if (p == null) return false;
    final evalType = (p['evaluation_type'] ?? '').toString().toLowerCase();
    final maxM = double.tryParse((p['max_marks'] ?? '').toString()) ?? 100.0;
    return evalType == 'grade' || maxM == 0;
  }

  String _resolveStudentPhotoUrl(String path) {
    if (path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final base = widget.baseUrl.endsWith('/')
        ? widget.baseUrl.substring(0, widget.baseUrl.length - 1)
        : widget.baseUrl;
    final clean = path.startsWith('/') ? path : '/$path';
    return '$base$clean';
  }

  Future<void> _setupScheduledSubjectsAndLoad() async {
    setState(() {
      _loadingMarks = true;
      _errorMessage = null;
    });

    List<dynamic> subjectsList = [];

    if (widget.initialSubjects != null && widget.initialSubjects!.isNotEmpty) {
      final Set<String> seenIds = {};
      for (final p in widget.initialSubjects!) {
        final sid = (p['subject_id'] ?? p['id'])?.toString() ?? '';
        if (sid.isNotEmpty && !seenIds.contains(sid)) {
          seenIds.add(sid);
          final sName = (p['subject_name'] ?? p['name'] ?? 'Subject').toString().toUpperCase();
          final bool pIsGrade = _isPaperGrade(p);
          subjectsList.add({
            'id': int.tryParse(sid) ?? sid,
            'name': sName,
            'max_marks': p['max_marks'],
            'passing_marks': p['passing_marks'],
            'evaluation_type': pIsGrade ? 'grade' : (p['evaluation_type'] ?? 'marks'),
            'grading_scale': p['grading_scale'] ?? 'A,B,C,D',
          });
        }
      }
    }

    if (subjectsList.isEmpty) {
      try {
        final ttData = await _examService.getExamTimetable(widget.examId, _selectedClassId);
        final papers = (ttData['papers'] as List<dynamic>?) ?? [];
        final Set<String> seenIds = {};
        for (final p in papers) {
          final sid = (p['subject_id'] ?? p['id'])?.toString() ?? '';
          if (sid.isNotEmpty && !seenIds.contains(sid)) {
            seenIds.add(sid);
            final sName = (p['subject_name'] ?? p['name'] ?? 'Subject').toString().toUpperCase();
            final bool pIsGrade = _isPaperGrade(p);
            subjectsList.add({
              'id': int.tryParse(sid) ?? sid,
              'name': sName,
              'max_marks': p['max_marks'],
              'passing_marks': p['passing_marks'],
              'evaluation_type': pIsGrade ? 'grade' : (p['evaluation_type'] ?? 'marks'),
              'grading_scale': p['grading_scale'] ?? 'A,B,C,D',
            });
          }
        }
      } catch (_) {}
    }

    if (!mounted) return;

    setState(() {
      _scheduledSubjects = subjectsList;
    });

    if (subjectsList.isNotEmpty) {
      final firstSubId = int.tryParse(subjectsList.first['id']?.toString() ?? '');
      _selectedSubjectId = firstSubId;
      if (firstSubId != null) {
        await _fetchMarksSheet(widget.examId, _selectedClassId, firstSubId);
      } else {
        setState(() => _loadingMarks = false);
      }
    } else {
      setState(() => _loadingMarks = false);
    }
  }

  Future<void> _fetchMarksSheet(int examId, int classId, int subjectId) async {
    setState(() => _loadingMarks = true);
    try {
      final sheet = await _examService.getExamMarksSheet(examId, classId, subjectId);
      final students = (sheet['students'] as List<dynamic>?) ?? [];

      _markControllers.forEach((_, c) => c.dispose());
      _markControllers.clear();
      _remarkControllers.forEach((_, c) => c.dispose());
      _remarkControllers.clear();
      _absentStates.clear();
      _markFocusNodes.forEach((_, f) => f.dispose());
      _markFocusNodes.clear();

      for (var s in students) {
        final stId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0') ?? 0;
        final marksObtained = s['marks_obtained'] != null ? s['marks_obtained'].toString() : '';
        final remark = s['remarks']?.toString() ?? '';
        final isAbsent = s['is_absent'] == 1 || s['is_absent'] == true;

        _markControllers[stId] = TextEditingController(text: marksObtained);
        _remarkControllers[stId] = TextEditingController(text: remark);
        _absentStates[stId] = isAbsent;
      }

      if (mounted) {
        setState(() {
          _marksSheetData = sheet;
          _loadingMarks = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingMarks = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              http_svc.isNetworkError(e)
                  ? http_svc.kNetworkErrorMessage
                  : 'Failed to load marks sheet: ${http_svc.formatErrorMessage(e)}',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  bool get _isCurrentClassExamPublished {
    return _marksSheetData?['status'] == 'Published';
  }

  void _revertStudentMarksField(int studentId) {
    final students = (_marksSheetData?['students'] as List<dynamic>?) ?? [];
    for (var s in students) {
      final sId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0');
      if (sId == studentId) {
        final marksObtained = s['marks_obtained'] != null ? s['marks_obtained'].toString() : '';
        final isAbs = s['is_absent'] == 1 || s['is_absent'] == true;
        _markControllers[studentId]?.text = marksObtained;
        _absentStates[studentId] = isAbs;
        if (mounted) setState(() {});
        break;
      }
    }
  }

  void _showPublishedMarksLockedPopup() {
    _showValidationPopup(
      title: 'MARKS CANNOT BE UPDATED',
      message1: 'Marks can not be updated because ${widget.examName} result has already been published.',
      message2: 'If you want to update marks please ask School Admin to unpublish the result.',
      actionHeader: 'Required Action',
      bulletPoints: [
        'Contact School Admin to unpublish the result.',
        'Return to Marks Spreadsheet and update student marks.',
      ],
    );
  }

  void _showValidationPopup({
    required String title,
    required String message1,
    required String message2,
    required String actionHeader,
    required List<String> bulletPoints,
  }) {
    FocusManager.instance.primaryFocus?.unfocus();
    FocusScope.of(context).unfocus();
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: Colors.white,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFD97706),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  message1,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF475569),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  message2,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF475569),
                    height: 1.45,
                  ),
                ),
                if (bulletPoints.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          actionHeader,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...bulletPoints.map((bp) => Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('• ', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold)),
                                  Expanded(
                                    child: Text(
                                      bp,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF1E293B),
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            )),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      elevation: 0,
                    ),
                    child: const Text('OK, Understood', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _saveStudentMark(int studentId) async {
    if (_selectedSubjectId == null) return;
    final targetSubId = _selectedSubjectId!;

    final isPublished = _isCurrentClassExamPublished;
    if (isPublished) {
      FocusManager.instance.primaryFocus?.unfocus();
      FocusScope.of(context).unfocus();
      _revertStudentMarksField(studentId);
      _showPublishedMarksLockedPopup();
      return;
    }

    final markText = _markControllers[studentId]?.text.trim() ?? '';
    final remarkText = _remarkControllers[studentId]?.text.trim() ?? '';
    final isAbsent = _absentStates[studentId] ?? false;

    setState(() => _savingMarkStudentIds.add(studentId));

    try {
      await _examService.saveExamMark(widget.examId, {
        'student_id': studentId,
        'class_id': _selectedClassId,
        'subject_id': targetSubId,
        'marks_obtained': isAbsent ? null : (markText.isEmpty ? null : markText),
        'is_absent': isAbsent ? 1 : 0,
        'remarks': remarkText,
      });

      if (_marksSheetData != null && _marksSheetData!['students'] is List) {
        final list = _marksSheetData!['students'] as List<dynamic>;
        for (var s in list) {
          final sId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0');
          if (sId == studentId) {
            s['marks_obtained'] = isAbsent ? null : (markText.isEmpty ? null : markText);
            s['is_absent'] = isAbsent ? 1 : 0;
            break;
          }
        }
      }
    } catch (e) {
      if (e.toString().contains('Cannot edit marks') || e.toString().contains('published')) {
        FocusManager.instance.primaryFocus?.unfocus();
        FocusScope.of(context).unfocus();
        _revertStudentMarksField(studentId);
        _showPublishedMarksLockedPopup();
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            http_svc.isNetworkError(e)
                ? http_svc.kNetworkErrorMessage
                : 'Error saving mark: ${http_svc.formatErrorMessage(e)}',
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _savingMarkStudentIds.remove(studentId));
      }
    }
  }

  void _flushPendingMarkInBackground(int examId, int classId, int subId) {
    for (final entry in _markFocusNodes.entries) {
      if (entry.value.hasFocus) {
        final stId = entry.key;
        final markText = _markControllers[stId]?.text.trim() ?? '';
        final remarkText = _remarkControllers[stId]?.text.trim() ?? '';
        final isAbsent = _absentStates[stId] ?? false;

        _examService.saveExamMark(examId, {
          'student_id': stId,
          'class_id': classId,
          'subject_id': subId,
          'marks_obtained': isAbsent ? null : (markText.isEmpty ? null : markText),
          'is_absent': isAbsent ? 1 : 0,
          'remarks': remarkText,
        }).catchError((_) {});
      }
    }
  }

  Widget _buildMarksStudentAvatar(dynamic s, {double size = 68}) {
    final photo = s['photo_path'] ?? s['photo'] ?? s['student_photo'] ?? s['profile_image'] ?? '';
    final String name = (s['student_name'] ?? s['name'] ?? 'Student').toString();
    final parts = name.trim().split(' ');
    String cleanInitials = '';
    for (final p in parts) {
      final trimmed = p.trim();
      if (trimmed.isNotEmpty) {
        cleanInitials += trimmed[0].toUpperCase();
        if (cleanInitials.length >= 2) break;
      }
    }
    if (cleanInitials.isEmpty) cleanInitials = 'ST';

    final hasPhoto = photo.toString().trim().isNotEmpty;
    final fullUrl = hasPhoto ? _resolveStudentPhotoUrl(photo.toString().trim()) : '';

    return GestureDetector(
      onTap: () {
        if (fullUrl.isNotEmpty) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => FullScreenImageScreen(
                imageUrl: fullUrl,
                title: name,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('No profile photo uploaded for $name.'),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
        ),
        child: ClipOval(
          child: hasPhoto
              ? CachedNetworkImage(
                  imageUrl: fullUrl,
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => _avatarFallback(size, cleanInitials),
                  errorWidget: (_, __, ___) => _avatarFallback(size, cleanInitials),
                )
              : _avatarFallback(size, cleanInitials),
        ),
      ),
    );
  }

  Widget _avatarFallback(double size, String initials) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.38,
          fontWeight: FontWeight.w900,
          color: const Color(0xFFD97706),
        ),
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    final curSub = _scheduledSubjects.firstWhere(
      (s) => s['id']?.toString() == _selectedSubjectId?.toString(),
      orElse: () => null,
    );
    final bool isGradeSheet = _isPaperGrade(_marksSheetData) || _isPaperGrade(curSub);
    final maxMarks = _marksSheetData?['max_marks']?.toString() ?? '100';

    final shortClass = formatShortClassName(_currentClassName);

    return Scaffold(
      backgroundColor: const Color(0xFFFAF8F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF0F172A)),
          onPressed: () {
            FocusScope.of(context).unfocus();
            final prevSubId = _selectedSubjectId;
            if (prevSubId != null) {
              _flushPendingMarkInBackground(widget.examId, _selectedClassId, prevSubId);
            }
            Navigator.pop(context);
          },
        ),
        title: const Text(
          'MARKS SPREADSHEET',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
            fontSize: 14,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Class Badge (Display only)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Text(
                    shortClass,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const SizedBox(width: 8),

                // Max Marks Pill
                if (isGradeSheet)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.star_rounded, size: 14, color: Color(0xFFD97706)),
                        SizedBox(width: 4),
                        Text(
                          'Grade Based',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Text(
                      'Max: $maxMarks',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        color: Color(0xFFD97706),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loadingMarks) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)));
    }

    if (_scheduledSubjects.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.event_busy_rounded, size: 54, color: Colors.amber.shade700),
              const SizedBox(height: 14),
              const Text(
                'No Exam Papers Scheduled',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please add papers in the Exam Timetable for this class first.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    final students = (_marksSheetData?['students'] as List<dynamic>?) ?? [];
    final curSub = _scheduledSubjects.firstWhere(
      (s) => s['id']?.toString() == _selectedSubjectId?.toString(),
      orElse: () => null,
    );
    final bool isGradeSheet = _isPaperGrade(_marksSheetData) || _isPaperGrade(curSub);
    final List<String> availableGrades = () {
      String? scaleStr = _marksSheetData?['grading_scale']?.toString() ?? curSub?['grading_scale']?.toString();
      if (scaleStr != null && scaleStr.isNotEmpty) {
        final list = scaleStr.split(',').map((g) => g.trim().toUpperCase()).where((g) => g.isNotEmpty && g != 'E').toList();
        if (list.isNotEmpty) return list;
      }
      return ['A', 'B', 'C', 'D'];
    }();
    final maxMarks = _marksSheetData?['max_marks']?.toString() ?? '100';

    int enteredCount = 0;
    for (final s in students) {
      final stId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0') ?? 0;
      final isAbs = _absentStates[stId] ?? false;
      final val = _markControllers[stId]?.text.trim() ?? '';
      if (isAbs || val.isNotEmpty) {
        enteredCount++;
      }
    }
    final bool isAllDone = students.isNotEmpty && enteredCount == students.length;
    final bool isPublished = _isCurrentClassExamPublished;

    return Column(
      children: [
        // HORIZONTAL SUBJECT TABS
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SingleChildScrollView(
            key: const PageStorageKey('marks_spreadsheet_subjects_scroll'),
            controller: _subjectScrollController,
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: _scheduledSubjects.map((sub) {
                final subId = int.tryParse(sub['id']?.toString() ?? '0');
                final isSelected = subId == _selectedSubjectId;
                final subName = (sub['name']?.toString() ?? 'Subject').toUpperCase();

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      if (subId != null && subId != _selectedSubjectId) {
                        FocusScope.of(context).unfocus();
                        final prevSubId = _selectedSubjectId;
                        if (prevSubId != null) {
                          _flushPendingMarkInBackground(widget.examId, _selectedClassId, prevSubId);
                        }
                        setState(() => _selectedSubjectId = subId);
                        _fetchMarksSheet(widget.examId, _selectedClassId, subId);
                      }
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFD97706) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                          width: 1.2,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFFD97706).withOpacity(0.22),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : null,
                      ),
                      child: Text(
                        subName,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: isSelected ? Colors.white : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),

        // SUB-HEADER BAR: Students Enrolled Count + Pending/Done Status Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: const Color(0xFFFAF8F5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'STUDENTS ENROLLED (${students.length})',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isAllDone ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isAllDone ? const Color(0xFF86EFAC) : const Color(0xFFFCD34D),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isAllDone ? Icons.check_circle_rounded : Icons.pending_actions_rounded,
                      size: 13,
                      color: isAllDone ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      isAllDone ? 'DONE' : 'PENDING ($enteredCount/${students.length})',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                        color: isAllDone ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFE2E8F0)),

        // STUDENTS LIST
        Expanded(
          child: students.isEmpty
              ? const Center(
                  child: Text(
                    'No students found in this class.',
                    style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: students.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final s = students[idx];
                    final stId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0') ?? 0;
                    final isSaving = _savingMarkStudentIds.contains(stId);
                    final isAbsent = _absentStates[stId] ?? false;
                    final sName = s['student_name'] ?? s['name'] ?? 'Student';
                    final rollNo = s['roll_no']?.toString() ?? '';
                    final srNo = s['admission_no']?.toString() ?? s['sr_no']?.toString() ?? '';
                    final metaStr = [
                      if (rollNo.isNotEmpty) 'Roll No: $rollNo',
                      if (srNo.isNotEmpty) 'SR: $srNo',
                    ].join(' • ');

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.02),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // 1. LEFT: BIG CIRCULAR PROFILE AVATAR (Size 68, tap to view full)
                          _buildMarksStudentAvatar(s, size: 68),
                          const SizedBox(width: 12),

                          // 2. RIGHT: NAME, ROLL/SR, ABS & COMPACT MARKS INPUT
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Top row: Name & ABS Switch
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            sName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 14.5,
                                              color: Color(0xFF0F172A),
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            metaStr,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 11,
                                              color: Color(0xFF64748B),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    // ABS Switch
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'ABS',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: isAbsent ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                                          ),
                                        ),
                                        Transform.scale(
                                          scale: 0.75,
                                          child: Switch(
                                            value: isAbsent,
                                            activeColor: const Color(0xFFEF4444),
                                            onChanged: (val) {
                                              if (isPublished) {
                                                _showPublishedMarksLockedPopup();
                                                return;
                                              }
                                              setState(() {
                                                _absentStates[stId] = val;
                                                if (val) {
                                                  _markControllers[stId]?.text = '';
                                                }
                                              });
                                              _saveStudentMark(stId);
                                            },
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 7),

                                // Bottom row: Marks Input OR Grade Dropdown + Checkmark
                                Row(
                                  children: [
                                    if (isGradeSheet)
                                      Container(
                                        width: 140,
                                        height: 38,
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                        decoration: BoxDecoration(
                                          color: isAbsent
                                              ? const Color(0xFFFEF2F2)
                                              : ((_markControllers[stId]?.text.trim().isNotEmpty == true)
                                                  ? const Color(0xFFFFFBEB)
                                                  : const Color(0xFFF8FAFC)),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: isAbsent
                                                ? const Color(0xFFFCA5A5)
                                                : ((_markControllers[stId]?.text.trim().isNotEmpty == true)
                                                    ? const Color(0xFFD97706)
                                                    : const Color(0xFFCBD5E1)),
                                            width: (_markControllers[stId]?.text.trim().isNotEmpty == true) ? 1.4 : 1.0,
                                          ),
                                        ),
                                        child: DropdownButtonHideUnderline(
                                          child: DropdownButton<String>(
                                            borderRadius: BorderRadius.circular(16),
                                            dropdownColor: Colors.white,
                                            elevation: 4,
                                            value: (() {
                                              final curVal = _markControllers[stId]?.text.trim() ?? '';
                                              if (isAbsent || curVal.isEmpty) return null;
                                              return availableGrades.contains(curVal) ? curVal : null;
                                            })(),
                                            isExpanded: true,
                                            hint: Text(
                                              isAbsent ? 'Absent' : '-- Grade --',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: isAbsent ? const Color(0xFFEF4444) : const Color(0xFF94A3B8),
                                              ),
                                            ),
                                            icon: const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFF64748B)),
                                            items: [
                                              const DropdownMenuItem<String>(
                                                value: '',
                                                child: Text('-- Grade --', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                                              ),
                                              ...availableGrades.map((g) {
                                                return DropdownMenuItem<String>(
                                                  value: g,
                                                  child: Text(
                                                    'Grade $g',
                                                    style: const TextStyle(
                                                      fontSize: 13,
                                                      fontWeight: FontWeight.w800,
                                                      color: Color(0xFF0F172A),
                                                    ),
                                                  ),
                                                );
                                              }),
                                            ],
                                            onChanged: isAbsent
                                                ? null
                                                : (val) {
                                                    if (isPublished) {
                                                      _showPublishedMarksLockedPopup();
                                                      return;
                                                    }
                                                    setState(() {
                                                      _markControllers[stId]?.text = val ?? '';
                                                    });
                                                    _saveStudentMark(stId);
                                                  },
                                          ),
                                        ),
                                      )
                                    else if (isPublished)
                                      InkWell(
                                        onTap: _showPublishedMarksLockedPopup,
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          width: 135,
                                          height: 38,
                                          alignment: Alignment.centerLeft,
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: isAbsent ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: isAbsent ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
                                          ),
                                          child: Text(
                                            isAbsent
                                                ? 'Absent'
                                                : (_markControllers[stId]?.text.isEmpty ?? true
                                                    ? 'Marks (Max: $maxMarks)'
                                                    : _markControllers[stId]!.text),
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                              color: isAbsent
                                                  ? const Color(0xFFEF4444)
                                                  : (_markControllers[stId]?.text.isEmpty ?? true
                                                      ? const Color(0xFF94A3B8)
                                                      : const Color(0xFF0F172A)),
                                            ),
                                          ),
                                        ),
                                      )
                                    else
                                      SizedBox(
                                        width: 135,
                                        height: 38,
                                        child: TextFormField(
                                          controller: _markControllers[stId],
                                          focusNode: _markFocusNodes.putIfAbsent(stId, () {
                                            final n = FocusNode();
                                            n.addListener(() {
                                              if (!n.hasFocus) {
                                                _saveStudentMark(stId);
                                              }
                                            });
                                            return n;
                                          }),
                                          enabled: !isAbsent,
                                          readOnly: false,
                                          keyboardType: TextInputType.number,
                                          inputFormatters: [
                                            FilteringTextInputFormatter.digitsOnly,
                                            MaxMarksTextInputFormatter(double.tryParse(maxMarks.toString()) ?? 100.0),
                                          ],
                                          textInputAction: (idx < students.length - 1) ? TextInputAction.next : TextInputAction.done,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF0F172A),
                                          ),
                                          decoration: InputDecoration(
                                            hintText: isAbsent ? 'Absent' : 'Marks (Max: $maxMarks)',
                                            hintStyle: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                            filled: true,
                                            fillColor: isAbsent ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
                                            border: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                            ),
                                            enabledBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                            ),
                                            focusedBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                                            ),
                                            disabledBorder: OutlineInputBorder(
                                              borderRadius: BorderRadius.circular(10),
                                              borderSide: const BorderSide(color: Color(0xFFFCA5A5)),
                                            ),
                                          ),
                                          onChanged: (val) {
                                            setState(() {});
                                            final maxNum = double.tryParse(maxMarks.toString()) ?? 100.0;
                                            final bool shouldAdvance = (maxNum < 100 && val.length >= 2) || (val.length >= 3);
                                            if (shouldAdvance) {
                                              _saveStudentMark(stId);
                                              if (idx + 1 < students.length) {
                                                final nextSt = students[idx + 1];
                                                final nextId = int.tryParse(nextSt['student_id']?.toString() ?? nextSt['id']?.toString() ?? '0') ?? 0;
                                                final nextFocus = _markFocusNodes.putIfAbsent(nextId, () {
                                                  final n = FocusNode();
                                                  n.addListener(() {
                                                    if (!n.hasFocus) {
                                                      _saveStudentMark(nextId);
                                                    }
                                                  });
                                                  return n;
                                                });
                                                FocusScope.of(context).requestFocus(nextFocus);
                                              } else {
                                                _saveStudentMark(stId);
                                                FocusScope.of(context).unfocus();
                                              }
                                            }
                                          },
                                          onFieldSubmitted: (val) {
                                            _saveStudentMark(stId);
                                            if (idx + 1 < students.length) {
                                              final nextSt = students[idx + 1];
                                              final nextId = int.tryParse(nextSt['student_id']?.toString() ?? nextSt['id']?.toString() ?? '0') ?? 0;
                                              final nextFocus = _markFocusNodes.putIfAbsent(nextId, () {
                                                final n = FocusNode();
                                                n.addListener(() {
                                                  if (!n.hasFocus) {
                                                    _saveStudentMark(nextId);
                                                  }
                                                });
                                                return n;
                                              });
                                              FocusScope.of(context).requestFocus(nextFocus);
                                            } else {
                                              FocusScope.of(context).unfocus();
                                            }
                                          },
                                        ),
                                      ),
                                    const SizedBox(width: 8),
                                    if (isSaving)
                                      const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(color: Color(0xFFD97706), strokeWidth: 2),
                                      )
                                    else if (!isAbsent && _markControllers[stId]?.text.trim().isNotEmpty == true)
                                      const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class MaxMarksTextInputFormatter extends TextInputFormatter {
  final double maxMarks;
  MaxMarksTextInputFormatter(this.maxMarks);

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }
    if (!RegExp(r'^\d+$').hasMatch(newValue.text)) {
      return oldValue;
    }
    final val = double.tryParse(newValue.text);
    if (val == null || val > maxMarks) {
      return oldValue;
    }
    return newValue;
  }
}
