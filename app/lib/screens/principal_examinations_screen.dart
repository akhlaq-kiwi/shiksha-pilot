import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:school_hub/services/leave_service.dart';
import 'package:school_hub/services/notification_helper.dart';
import 'package:school_hub/services/school_examination_service.dart';
import 'package:school_hub/utils/class_formatter.dart';
import 'package:school_hub/screens/principal_seating_plan_screen.dart';

class PrincipalExaminationsScreen extends StatefulWidget {
  final SchoolExaminationService examService;
  final LeaveService leaveService;
  final String userRole;

  const PrincipalExaminationsScreen({
    Key? key,
    required this.examService,
    required this.leaveService,
    required this.userRole,
  }) : super(key: key);

  @override
  _PrincipalExaminationsScreenState createState() => _PrincipalExaminationsScreenState();
}

class _PrincipalExaminationsScreenState extends State<PrincipalExaminationsScreen> {
  // Navigation views: 'dashboard', 'classes', 'timetable', 'marks', 'reports'
  String _activeView = 'dashboard';

  // Data states
  List<dynamic> _exams = [];
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  List<dynamic> _holidays = [];
  Map<String, dynamic>? _schoolProfile;
  List<dynamic> _gradeScales = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Active filter for stat cards: 'total', 'upcoming', 'ongoing', 'draft', 'published'
  String _activeFilter = 'total';

  // Selected contexts
  Map<String, dynamic>? _selectedExam; // The sub-test or component exam
  Map<String, dynamic>? _selectedTerm; // The parent terminal examination
  String? _selectedClassId;
  List<dynamic> _examClassStatuses = [];

  // Class Marks Status for Enter Marks Card ('Done', 'Pending', or null if no papers)
  String? _currentClassMarksStatus;
  bool _loadingClassMarksStatus = false;

  // Seating Plan Status ('Open Seating Plan' vs 'Create Seating Plan')
  bool _hasSeatingPlan = false;

  // Timetable view states (Full Web Parity)
  List<dynamic> _timetablePapers = [];
  bool _loadingTimetable = false;
  bool _isSchemePublished = false;
  bool _togglingSchemePublish = false;
  bool _togglingResultPublish = false;
  bool _downloadingScheme = false;
  int? _ttSubjectId;
  String _ttExamDate = '';
  String _ttEvaluationType = 'marks'; // 'marks' or 'grade'
  String _ttGradingScale = 'A,B,C,D';
  TimeOfDay _ttStartTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _ttEndTime = const TimeOfDay(hour: 11, minute: 0);
  final TextEditingController _ttMaxMarksCtrl = TextEditingController(text: '30');
  final TextEditingController _ttPassMarksCtrl = TextEditingController(text: '10');
  Map<String, dynamic>? _editingPaper;
  bool _submittingTimetable = false;

  // Marks Spreadsheet view states
  int? _selectedSubjectId;
  List<dynamic> _marksScheduledSubjects = [];
  Map<String, dynamic>? _marksSheetData;
  bool _loadingMarks = false;
  final Map<int, TextEditingController> _markControllers = {};
  final Map<int, TextEditingController> _remarkControllers = {};
  final Map<int, bool> _absentStates = {};
  final Map<int, FocusNode> _markFocusNodes = {};
  final Set<int> _savingMarkStudentIds = {};

  // Report Cards view states
  List<dynamic> _reportCards = [];
  bool _loadingReportCards = false;
  String _reportCardSearchQuery = '';
  final TextEditingController _reportCardSearchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  @override
  void dispose() {
    _reportCardSearchCtrl.dispose();
    _ttMaxMarksCtrl.dispose();
    _ttPassMarksCtrl.dispose();
    for (var f in _markFocusNodes.values) {
      f.dispose();
    }
    for (var c in _markControllers.values) {
      c.dispose();
    }
    for (var c in _remarkControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // DATA LOADING
  // --------------------------------------------------------------------------

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // 1. Fetch examinations, classes, and profile in parallel
      final results = await Future.wait([
        widget.examService.getExaminations(),
        widget.examService.getClasses(),
        widget.examService.getSchoolProfile().catchError((_) => null),
      ]);

      final exams = results[0] as List<dynamic>;
      final rawClasses = results[1] as List<dynamic>;
      final profile = results[2] as Map<String, dynamic>?;

      // Sort classes nicely using compareClassItems
      final sortedClasses = List<dynamic>.from(rawClasses)..sort(compareClassItems);

      if (mounted) {
        setState(() {
          _exams = exams;
          _classes = sortedClasses;
          _schoolProfile = profile;
          _isLoading = false;
        });
      }

      // 2. Preload non-blocking secondary data in background
      Future.microtask(() async {
        try {
          final extra = await Future.wait([
            widget.examService.getSubjects().catchError((_) => []),
            widget.examService.getGradeConfigurations().catchError((_) => []),
            widget.examService.getHolidays().catchError((_) => []),
          ]);
          if (mounted) {
            setState(() {
              _subjects = extra[0] as List<dynamic>;
              _gradeScales = extra[1] as List<dynamic>;
              _holidays = extra[2] as List<dynamic>;
            });
          }
        } catch (_) {}
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // FILTERING & STATS
  // --------------------------------------------------------------------------

  List<dynamic> _getAllSubTests() {
    final List<dynamic> tests = [];
    for (final exam in _exams) {
      if (exam['sub_tests'] != null && exam['sub_tests'] is List) {
        tests.addAll(exam['sub_tests']);
      } else {
        tests.add(exam);
      }
    }
    return tests;
  }

  String _getTodayDateStr() {
    final now = DateTime.now();
    final y = now.year.toString();
    final m = now.month.toString().padLeft(2, '0');
    final d = now.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  int _getTotalExamsCount() => _getAllSubTests().length;

  int _getUpcomingCount() {
    final today = _getTodayDateStr();
    return _getAllSubTests().where((e) {
      final s = e['start_date']?.toString();
      return s != null && s.isNotEmpty && s.compareTo(today) > 0;
    }).length;
  }

  int _getOngoingCount() {
    final today = _getTodayDateStr();
    return _getAllSubTests().where((e) {
      final s = e['start_date']?.toString() ?? '';
      final ed = e['end_date']?.toString() ?? '';
      return s.isNotEmpty && ed.isNotEmpty && s.compareTo(today) <= 0 && ed.compareTo(today) >= 0;
    }).length;
  }

  int _getDraftCount() {
    return _getAllSubTests().where((e) {
      final status = (e['status'] ?? '').toString().toLowerCase();
      return status != 'published';
    }).length;
  }

  int _getPublishedCount() {
    return _getAllSubTests().where((e) {
      final status = (e['status'] ?? '').toString().toLowerCase();
      return status == 'published';
    }).length;
  }

  bool _matchesFilter(dynamic test) {
    if (_activeFilter == 'total') return true;
    final today = _getTodayDateStr();
    final s = test['start_date']?.toString() ?? '';
    final ed = test['end_date']?.toString() ?? '';
    final status = (test['status'] ?? '').toString().toLowerCase();

    if (_activeFilter == 'upcoming') {
      return s.isNotEmpty && s.compareTo(today) > 0;
    }
    if (_activeFilter == 'ongoing') {
      return s.isNotEmpty && ed.isNotEmpty && s.compareTo(today) <= 0 && ed.compareTo(today) >= 0;
    }
    if (_activeFilter == 'draft') {
      return status != 'published';
    }
    if (_activeFilter == 'published') {
      return status == 'published';
    }
    return true;
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null || dateStr.toString().trim().isEmpty || dateStr.toString() == '-') {
      return '—';
    }
    try {
      final dt = DateTime.parse(dateStr.toString());
      final monthsShort = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${monthsShort[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  String _formatMarkValue(dynamic val, {String defaultVal = '0'}) {
    if (val == null) return defaultVal;
    final s = val.toString().trim();
    if (s.isEmpty || s == '—' || s == '-') return defaultVal;
    final numVal = double.tryParse(s);
    if (numVal == null) return s;
    if (numVal % 1 == 0) {
      return numVal.toInt().toString();
    }
    return numVal.toString();
  }

  void _showAppSnackBar(
    String message, {
    bool isError = false,
    bool isWarning = false,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();

    final bg = isError
        ? const Color(0xFFDC2626)
        : (isWarning ? const Color(0xFFD97706) : const Color(0xFF16A34A));

    final icon = isError
        ? Icons.error_outline_rounded
        : (isWarning ? Icons.info_outline_rounded : Icons.check_circle_rounded);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: bg,
        behavior: SnackBarBehavior.floating,
        elevation: 4,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: duration,
        action: action,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // WORKSPACE NAVIGATION
  // --------------------------------------------------------------------------

  Future<void> _openClassWorkspace(Map<String, dynamic> testExam, [Map<String, dynamic>? parentTerm]) async {
    setState(() {
      _selectedExam = testExam;
      _selectedTerm = parentTerm;
      _activeView = 'classes';
      _isLoading = true;
    });

    try {
      final examId = testExam['id'] is int ? testExam['id'] : int.tryParse(testExam['id'].toString()) ?? 0;
      final statuses = await widget.examService.getExamClassStatuses(examId);

      // Default to smallest/first class according to school class hierarchy (e.g. PNC)
      String? defaultClassId;
      if (_classes.isNotEmpty) {
        _classes.sort(compareClassItems);
        defaultClassId = (_classes.first['id'] ?? _classes.first['class_id'])?.toString();
      } else if (statuses.isNotEmpty) {
        final sortedStatuses = List<dynamic>.from(statuses)..sort(compareClassItems);
        defaultClassId = (sortedStatuses.first['class_id'] ?? sortedStatuses.first['id'])?.toString();
      }

      setState(() {
        _examClassStatuses = statuses;
        _selectedClassId = defaultClassId;
        _isLoading = false;
      });
      _loadClassMarksStatus(defaultClassId);
      _checkSeatingPlanStatus(examId);
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<void> _checkSeatingPlanStatus(int examId) async {
    if (examId == 0) return;
    try {
      final res = await widget.examService.getSeatingPlan(examId);
      if (mounted) {
        setState(() {
          _hasSeatingPlan = res != null && res['plan'] != null;
        });
      }
    } catch (_) {}
  }

  Future<void> _openSeatingPlan() async {
    if (_selectedExam == null) return;
    final examId = int.tryParse(_selectedExam!['id'].toString()) ?? 0;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PrincipalSeatingPlanScreen(
          examService: widget.examService,
          exam: _selectedExam!,
          initialClassId: _selectedClassId,
          preloadedClasses: _classes,
          schoolProfile: _schoolProfile,
        ),
      ),
    );
    if (examId > 0) {
      _checkSeatingPlanStatus(examId);
    }
  }

  Future<void> _loadClassMarksStatus(String? classId) async {
    if (_selectedExam == null || classId == null || classId.isEmpty) {
      if (mounted) {
        setState(() {
          _currentClassMarksStatus = null;
          _loadingClassMarksStatus = false;
        });
      }
      return;
    }

    final examId = int.tryParse(_selectedExam!['id'].toString()) ?? 0;
    final cId = int.tryParse(classId) ?? 0;
    if (examId == 0 || cId == 0) return;

    if (mounted) {
      setState(() => _loadingClassMarksStatus = true);
    }

    try {
      final res = await widget.examService.getExamTimetable(examId, cId);
      final papers = (res['papers'] as List<dynamic>?) ?? [];

      String? status;
      if (papers.isEmpty) {
        status = null; // No papers added -> Do NOT show badge
      } else {
        final bool allDone = papers.every((p) => p['marks_completed'] == true || p['marks_completed'] == 1);
        status = allDone ? 'Done' : 'Pending';
      }

      if (mounted && _selectedClassId == classId) {
        setState(() {
          _currentClassMarksStatus = status;
          _loadingClassMarksStatus = false;
        });
      }
    } catch (_) {
      if (mounted && _selectedClassId == classId) {
        setState(() => _loadingClassMarksStatus = false);
      }
    }
  }

  Widget? _buildMarksStatusBadge() {
    if (_loadingClassMarksStatus) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 10,
              height: 10,
              child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF94A3B8)),
            ),
            SizedBox(width: 5),
            Text(
              'Checking...',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      );
    }

    if (_currentClassMarksStatus == null) {
      // If papers haven't been added yet, do not show badge
      return null;
    }

    final bool isDone = _currentClassMarksStatus == 'Done';
    final Color bgColor = isDone ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7);
    final Color textColor = isDone ? const Color(0xFF15803D) : const Color(0xFFB45309);
    final Color borderColor = isDone ? const Color(0xFF86EFAC) : const Color(0xFFFDE68A);
    final IconData statusIcon = isDone ? Icons.check_circle_rounded : Icons.pending_actions_rounded;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusIcon, size: 14, color: textColor),
          const SizedBox(width: 4),
          Text(
            isDone ? 'Done' : 'Pending',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: textColor,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // TIMETABLE ACTIONS (WEB PARITY: LOGICS, CONDITIONS & VALIDATION)
  // --------------------------------------------------------------------------

  String _formatDisplayDate(String dateStr) {
    final dt = DateTime.tryParse(dateStr);
    if (dt == null) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  String _suggestNextExamDate(Map<String, dynamic>? exam, List<dynamic> papers, List<dynamic> holidays) {
    if (exam == null || exam['start_date'] == null || exam['end_date'] == null) return '';
    final startStr = exam['start_date'].toString();
    final endStr = exam['end_date'].toString();
    DateTime? current = DateTime.tryParse(startStr);
    DateTime? end = DateTime.tryParse(endStr);
    if (current == null || end == null) return startStr;

    final holidayDates = holidays.map((h) => h['date']?.toString()).whereType<String>().toSet();
    final usedDates = papers.map((p) => p['exam_date']?.toString()).whereType<String>().toSet();

    while (!current!.isAfter(end)) {
      final dateStr = "${current.year.toString().padLeft(4, '0')}-${current.month.toString().padLeft(2, '0')}-${current.day.toString().padLeft(2, '0')}";
      final isSunday = current.weekday == DateTime.sunday;
      final isHoliday = holidayDates.contains(dateStr);
      final isUsed = usedDates.contains(dateStr);

      if (!isSunday && !isHoliday && !isUsed) {
        return dateStr;
      }
      current = current.add(const Duration(days: 1));
    }
    return startStr;
  }

  String _formatDisplayTime(TimeOfDay tod) {
    final hour = tod.hourOfPeriod == 0 ? 12 : tod.hourOfPeriod;
    final minute = tod.minute.toString().padLeft(2, '0');
    final period = tod.period == DayPeriod.am ? 'AM' : 'PM';
    return '${hour.toString().padLeft(2, '0')}:$minute $period';
  }

  String _formatTimeString(String? raw) {
    if (raw == null || raw.isEmpty) return '--:--';
    final parts = raw.split(':');
    if (parts.length >= 2) {
      final h = int.tryParse(parts[0]) ?? 0;
      final m = int.tryParse(parts[1]) ?? 0;
      return _formatDisplayTime(TimeOfDay(hour: h, minute: m));
    }
    return raw;
  }

  TimeOfDay? _parseTimeString(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final parts = raw.split(':');
    if (parts.length >= 2) {
      final h = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      if (h != null && m != null) return TimeOfDay(hour: h, minute: m);
    }
    return null;
  }

  bool _isPaperGrade(dynamic paper) {
    if (paper == null) return false;
    if (paper is! Map) return false;
    if (paper['evaluation_type']?.toString().toLowerCase() == 'grade') return true;
    final maxM = double.tryParse(paper['max_marks']?.toString() ?? '');
    return maxM != null && maxM == 0.0;
  }

  void _resetTimetableForm({bool resetTime = false}) {
    _editingPaper = null;
    final examMaxDouble = double.tryParse(_selectedExam?['max_marks']?.toString() ?? '') ?? 30.0;
    final examMax = examMaxDouble.toInt();
    final examPass = (examMax * 0.33).ceil();
    _ttSubjectId = null;
    _ttEvaluationType = 'marks';
    _ttGradingScale = 'A,B,C,D';
    if (resetTime) {
      _ttStartTime = const TimeOfDay(hour: 9, minute: 0);
      _ttEndTime = const TimeOfDay(hour: 11, minute: 0);
    }
    _ttMaxMarksCtrl.text = examMax.toString();
    _ttPassMarksCtrl.text = examPass.toString();
    _ttExamDate = _suggestNextExamDate(_selectedExam, _timetablePapers, _holidays);
  }

  Future<void> _openTimetable() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    setState(() {
      _activeView = 'timetable';
      _loadingTimetable = true;
    });

    try {
      final data = await widget.examService.getExamTimetable(examId, classId);
      final papers = (data['papers'] as List<dynamic>?) ?? [];
      final curStatus = _examClassStatuses.firstWhere((c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId?.toString(), orElse: () => null);
      final isPub = data['scheme_published'] == 1 || data['scheme_published'] == true || curStatus?['scheme_published'] == 1;

      setState(() {
        _timetablePapers = papers;
        _isSchemePublished = isPub;
        _loadingTimetable = false;
        _resetTimetableForm(resetTime: false);
      });
    } catch (e) {
      setState(() {
        _loadingTimetable = false;
      });
      _showAppSnackBar('Error loading timetable: $e', isError: true);
    }
  }

  Future<void> _toggleSchemePublish() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);
    final testName = (_selectedExam?['name'] ?? 'Exam').toString();
    final selectedClass = _classes.firstWhere(
      (c) => c['id']?.toString() == _selectedClassId,
      orElse: () => null,
    );
    final className = selectedClass != null
        ? formatShortClassName(selectedClass['name'], section: selectedClass['section'])
        : 'Class';

    final bool? confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
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
                        _isSchemePublished ? 'Revert $testName scheme to Draft' : 'Publish $testName scheme',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                _isSchemePublished
                    ? 'Are you sure you want to revert the examination scheme for $className back to Draft? Students and parents will no longer be able to view their exam timetable.'
                    : 'Are you sure you want to publish the examination scheme for $className? Students and parents will be able to view their exam timetable.',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _isSchemePublished
                    ? 'Once reverted to Draft, the examination schedule will remain hidden until you publish it again.'
                    : 'Publishing the scheme makes the examination dates, timings, and papers visible on the student and parent portal.',
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(
                          _isSchemePublished ? 'Revert to Draft' : 'Publish',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
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

    if (confirmed != true) return;

    setState(() => _togglingSchemePublish = true);
    try {
      if (_isSchemePublished) {
        await widget.examService.unpublishExamScheme(examId, classId);
        setState(() => _isSchemePublished = false);
        if (mounted) {
          _showAppSnackBar('Examination scheme reverted to Draft.', isWarning: true);
        }
      } else {
        await widget.examService.publishExamScheme(examId, classId);
        setState(() => _isSchemePublished = true);
        if (mounted) {
          _showAppSnackBar('Examination scheme published successfully!');
        }
      }
      final statuses = await widget.examService.getExamClassStatuses(examId);
      if (mounted) {
        setState(() {
          _examClassStatuses = statuses;
        });
      }
    } catch (e) {
      if (mounted) {
        _showAppSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    } finally {
      if (mounted) setState(() => _togglingSchemePublish = false);
    }
  }

  Future<void> _downloadExamScheme() async {
    if (_selectedExam == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    setState(() => _downloadingScheme = true);
    try {
      final schemesData = await widget.examService.getAllExamSchemes(examId);
      final classes = (schemesData['classes'] as List<dynamic>?) ?? [];
      final dates = (schemesData['dates'] as List<dynamic>?) ?? [];
      final exam = schemesData['exam'] as Map<String, dynamic>?;
      final schoolProfile = schemesData['school_profile'] as Map<String, dynamic>?;

      if (classes.isEmpty) {
        if (mounted) {
          _showAppSnackBar('No examination papers have been scheduled for any class in this examination.', isWarning: true);
        }
        return;
      }

      final examName = (exam?['name'] ?? _selectedExam?['name'] ?? 'EXAMINATION').toString().toUpperCase();
      final schoolName = (schoolProfile?['name'] ?? 'SCHOOL TIMETABLE').toString().toUpperCase();
      final ayName = (exam?['academic_year_name'] ?? '').toString();

      final StringBuffer html = StringBuffer();
      html.writeln('<!DOCTYPE html><html><head><meta charset="utf-8">');
      html.writeln('<style>');
      html.writeln('@page { size: A4 landscape; margin: 8mm; }');
      html.writeln('body { font-family: sans-serif; margin: 0; padding: 0; color: #18181b; }');
      html.writeln('.card { border: 3px double #71717a; padding: 14px; border-radius: 4px; }');
      html.writeln('.header { text-align: center; border-bottom: 2px solid #27272a; padding-bottom: 8px; margin-bottom: 12px; }');
      html.writeln('.school-title { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }');
      html.writeln('.exam-title { font-size: 14px; font-weight: 700; margin: 4px 0 0 0; color: #27272a; }');
      html.writeln('.ay-title { font-size: 11px; font-weight: 600; color: #71717a; margin-top: 2px; }');
      html.writeln('table { width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; margin-top: 8px; }');
      html.writeln('th, td { border: 1px solid #a1a1aa; padding: 6px 4px; vertical-align: middle; text-align: center; }');
      html.writeln('th { background-color: #e4e4e7; font-weight: 800; }');
      html.writeln('.class-cell { background-color: #f4f4f5; font-weight: 800; white-space: nowrap; }');
      html.writeln('.subject-cell { font-weight: 700; color: #09090b; }');
      html.writeln('.empty-cell { color: #a1a1aa; }');
      html.writeln('</style></head><body>');

      html.writeln('<div class="card">');
      html.writeln('<div class="header">');
      html.writeln('<div class="school-title">$schoolName</div>');
      html.writeln('<div class="exam-title">$examName EXAMINATION SCHEME</div>');
      if (ayName.isNotEmpty) {
        html.writeln('<div class="ay-title">Academic Year: $ayName</div>');
      }
      html.writeln('</div>');

      html.writeln('<table>');
      html.writeln('<thead><tr>');
      html.writeln('<th style="width: 14%;">CLASS</th>');
      for (var d in dates) {
        final dStr = d.toString();
        final parsed = DateTime.tryParse(dStr);
        String formattedDate = dStr;
        if (parsed != null) {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          formattedDate = '${weekdays[parsed.weekday - 1]}, ${parsed.day} ${months[parsed.month - 1]}';
        }
        html.writeln('<th>$formattedDate</th>');
      }
      html.writeln('</tr></thead>');
      html.writeln('<tbody>');

      for (var cls in classes) {
        final clsMap = cls as Map<String, dynamic>;
        final clsName = (clsMap['display_name'] ?? clsMap['name'] ?? 'Class').toString();
        final datePaperMap = (clsMap['date_paper_map'] as Map<String, dynamic>?) ?? {};

        html.writeln('<tr>');
        html.writeln('<td class="class-cell">$clsName</td>');
        for (var d in dates) {
          final pData = datePaperMap[d.toString()] as Map<String, dynamic>?;
          if (pData != null && pData['subject_name'] != null) {
            final sName = pData['subject_name'].toString();
            html.writeln('<td class="subject-cell">$sName</td>');
          } else {
            html.writeln('<td class="empty-cell">-</td>');
          }
        }
        html.writeln('</tr>');
      }

      html.writeln('</tbody></table>');
      html.writeln('</div></body></html>');

      final filename = '${examName.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}_Scheme.pdf';
      await Printing.layoutPdf(
        onLayout: (format) async => await Printing.convertHtml(
          format: PdfPageFormat.a4.landscape,
          html: html.toString(),
        ),
        name: filename,
        format: PdfPageFormat.a4.landscape,
      );
    } catch (e) {
      if (mounted) {
        _showAppSnackBar('Failed to download scheme: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _downloadingScheme = false);
    }
  }

  Future<void> _pickExamDate() async {
    final startStr = _selectedExam?['start_date']?.toString();
    final endStr = _selectedExam?['end_date']?.toString();
    final startDate = DateTime.tryParse(startStr ?? '') ?? DateTime(2020);
    final endDate = DateTime.tryParse(endStr ?? '') ?? DateTime(2035);

    DateTime initialDate = DateTime.tryParse(_ttExamDate) ?? startDate;
    if (initialDate.isBefore(startDate)) initialDate = startDate;
    if (initialDate.isAfter(endDate)) initialDate = endDate;

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: startDate,
      lastDate: endDate,
      selectableDayPredicate: (DateTime day) {
        if (day.weekday == DateTime.sunday) return false;
        final dateKey = "${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}";
        final isHoliday = _holidays.any((h) => h['date']?.toString() == dateKey);
        return !isHoliday;
      },
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFD97706),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final formatted = "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() => _ttExamDate = formatted);
    }
  }

  Future<void> _pickTime({required bool isStartTime}) async {
    final initial = isStartTime ? _ttStartTime : _ttEndTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFD97706),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        if (isStartTime) {
          _ttStartTime = picked;
        } else {
          _ttEndTime = picked;
        }
      });
    }
  }

  void _startEditPaper(Map<String, dynamic> paper) {
    setState(() {
      _editingPaper = paper;
      _ttSubjectId = int.tryParse(paper['subject_id']?.toString() ?? '');
      _ttExamDate = paper['exam_date']?.toString() ?? '';
      final isGrade = _isPaperGrade(paper);
      _ttEvaluationType = isGrade ? 'grade' : 'marks';
      _ttGradingScale = paper['grading_scale']?.toString() ?? 'A,B,C,D';
      _ttStartTime = _parseTimeString(paper['start_time']?.toString()) ?? const TimeOfDay(hour: 9, minute: 0);
      _ttEndTime = _parseTimeString(paper['end_time']?.toString()) ?? const TimeOfDay(hour: 11, minute: 0);
      _ttMaxMarksCtrl.text = isGrade ? '0' : _formatMarkValue(paper['max_marks'], defaultVal: '30');
      _ttPassMarksCtrl.text = isGrade ? '0' : _formatMarkValue(paper['passing_marks'], defaultVal: '10');
    });
  }

  Future<void> _savePaperLocal() async {
    if (_ttSubjectId == null) {
      _showAppSnackBar('Please select a subject.', isWarning: true);
      return;
    }
    if (_ttExamDate.isEmpty) {
      _showAppSnackBar('Please select an exam date.', isWarning: true);
      return;
    }

    final startMin = _ttStartTime.hour * 60 + _ttStartTime.minute;
    final endMin = _ttEndTime.hour * 60 + _ttEndTime.minute;
    if (endMin <= startMin) {
      _showAppSnackBar('End Time must be after Start Time.', isWarning: true);
      return;
    }

    final startDateStr = _selectedExam?['start_date']?.toString();
    final endDateStr = _selectedExam?['end_date']?.toString();
    if (startDateStr != null && _ttExamDate.compareTo(startDateStr) < 0) {
      _showAppSnackBar('Exam date cannot be before ${_formatDate(startDateStr)}.', isWarning: true);
      return;
    }
    if (endDateStr != null && _ttExamDate.compareTo(endDateStr) > 0) {
      _showAppSnackBar('Exam date cannot be after ${_formatDate(endDateStr)}.', isWarning: true);
      return;
    }

    final parsedDate = DateTime.tryParse(_ttExamDate);
    if (parsedDate != null && parsedDate.weekday == DateTime.sunday) {
      _showAppSnackBar('Examinations cannot be scheduled on Sundays.', isWarning: true);
      return;
    }

    final isHoliday = _holidays.any((h) => h['date']?.toString() == _ttExamDate);
    if (isHoliday) {
      _showAppSnackBar('Examinations cannot be scheduled on holidays.', isWarning: true);
      return;
    }

    final isDuplicate = _timetablePapers.any((p) {
      if (_editingPaper != null && p['subject_id']?.toString() == _editingPaper!['subject_id']?.toString()) {
        return false;
      }
      return p['subject_id']?.toString() == _ttSubjectId.toString();
    });
    if (isDuplicate) {
      _showAppSnackBar('This subject is already scheduled for this exam.', isWarning: true);
      return;
    }

    final newStartStr = "${_ttStartTime.hour.toString().padLeft(2, '0')}:${_ttStartTime.minute.toString().padLeft(2, '0')}";
    final newEndStr = "${_ttEndTime.hour.toString().padLeft(2, '0')}:${_ttEndTime.minute.toString().padLeft(2, '0')}";

    final hasOverlap = _timetablePapers.any((p) {
      if (_editingPaper != null && p['subject_id']?.toString() == _editingPaper!['subject_id']?.toString()) {
        return false;
      }
      if (p['exam_date']?.toString() == _ttExamDate) {
        final pStart = (p['start_time']?.toString() ?? '').substring(0, 5);
        final pEnd = (p['end_time']?.toString() ?? '').substring(0, 5);
        return (newStartStr.compareTo(pEnd) < 0) && (newEndStr.compareTo(pStart) > 0);
      }
      return false;
    });
    if (hasOverlap) {
      _showAppSnackBar('Time conflict detected. Another paper is scheduled at this time.', isWarning: true);
      return;
    }

    final isGrade = _ttEvaluationType == 'grade';
    int maxMarksVal = 0;
    int passMarksVal = 0;
    if (!isGrade) {
      final maxM = int.tryParse(_ttMaxMarksCtrl.text.trim()) ?? double.tryParse(_ttMaxMarksCtrl.text.trim())?.toInt();
      final passM = int.tryParse(_ttPassMarksCtrl.text.trim()) ?? double.tryParse(_ttPassMarksCtrl.text.trim())?.toInt();
      if (maxM == null || maxM <= 0) {
        _showAppSnackBar('Maximum Marks must be a positive number.', isWarning: true);
        return;
      }
      if (passM == null || passM < 0) {
        _showAppSnackBar('Passing Marks must be a non-negative number.', isWarning: true);
        return;
      }
      if (passM > maxM) {
        _showAppSnackBar('Passing Marks cannot exceed Maximum Marks.', isWarning: true);
        return;
      }
      maxMarksVal = maxM;
      passMarksVal = passM;
    }

    final matchedSubject = _subjects.firstWhere(
      (s) => s['id']?.toString() == _ttSubjectId.toString(),
      orElse: () => null,
    );
    final subjectName = matchedSubject != null ? (matchedSubject['name'] ?? 'Subject') : 'Subject';

    final paperData = {
      'subject_id': _ttSubjectId,
      'subject_name': subjectName,
      'exam_date': _ttExamDate,
      'start_time': newStartStr,
      'end_time': newEndStr,
      'evaluation_type': _ttEvaluationType,
      'grading_scale': _ttGradingScale,
      'max_marks': isGrade ? '0' : maxMarksVal.toString(),
      'passing_marks': isGrade ? '0' : passMarksVal.toString(),
      'room': '',
    };

    List<Map<String, dynamic>> updatedPapers = [];
    if (_editingPaper != null) {
      updatedPapers = _timetablePapers.map<Map<String, dynamic>>((p) {
        if (p['subject_id']?.toString() == _editingPaper!['subject_id']?.toString()) {
          return Map<String, dynamic>.from(paperData);
        }
        return Map<String, dynamic>.from(p);
      }).toList();
    } else {
      updatedPapers = _timetablePapers.map<Map<String, dynamic>>((p) => Map<String, dynamic>.from(p)).toList();
      updatedPapers.add(paperData);
    }

    setState(() => _submittingTimetable = true);
    try {
      final examId = int.parse(_selectedExam!['id'].toString());
      final classId = int.parse(_selectedClassId!);
      await widget.examService.saveExamTimetable(examId, classId, updatedPapers);
      final refreshed = await widget.examService.getExamTimetable(examId, classId);
      final papers = (refreshed['papers'] as List<dynamic>?) ?? [];
      final isPub = refreshed['scheme_published'] == 1 || refreshed['scheme_published'] == true;
      setState(() {
        _timetablePapers = papers;
        _isSchemePublished = isPub;
        _resetTimetableForm();
      });
      if (mounted) {
        _showAppSnackBar(_editingPaper != null ? 'Exam paper updated successfully.' : 'Exam paper added successfully.');
      }
    } catch (e) {
      if (mounted) {
        _showAppSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    } finally {
      if (mounted) setState(() => _submittingTimetable = false);
    }
  }

  Future<void> _confirmDeletePaper(Map<String, dynamic> paper, int index) async {
    final subName = paper['subject_name'] ?? 'this subject';
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (dCtx) => Dialog(
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
                  const Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Remove Exam Paper',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Are you sure you want to remove $subName from the examination timetable?',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'This will remove this subject examination schedule for this class.',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(dCtx, false),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(dCtx, true),
                        child: const Text(
                          'Delete',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
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

    if (confirm == true) {
      final examId = int.parse(_selectedExam!['id'].toString());
      final classId = int.parse(_selectedClassId!);
      final updated = List<Map<String, dynamic>>.from(_timetablePapers.map((p) => Map<String, dynamic>.from(p)));
      updated.removeAt(index);

      setState(() => _loadingTimetable = true);
      try {
        await widget.examService.saveExamTimetable(examId, classId, updated);
        final refreshed = await widget.examService.getExamTimetable(examId, classId);
        final papers = (refreshed['papers'] as List<dynamic>?) ?? [];
        final isPub = refreshed['scheme_published'] == 1 || refreshed['scheme_published'] == true;
        setState(() {
          _timetablePapers = papers;
          _isSchemePublished = isPub;
          _loadingTimetable = false;
          if (_editingPaper != null && _editingPaper!['subject_id']?.toString() == paper['subject_id']?.toString()) {
            _resetTimetableForm();
          }
        });
        if (mounted) {
          _showAppSnackBar('Paper removed successfully.');
        }
      } catch (e) {
        setState(() => _loadingTimetable = false);
        if (mounted) {
          _showAppSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // WORKSPACE ACTION VALIDATION POPUP (EXACT WEB PARITY)
  // --------------------------------------------------------------------------

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
        bool popped = false;
        void dismiss() {
          if (!popped && Navigator.of(ctx).canPop()) {
            popped = true;
            Navigator.of(ctx).pop();
          }
        }
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
                const SizedBox(height: 14),
                const Divider(color: Color(0xFFE2E8F0), height: 1),
                const SizedBox(height: 12),
                Text(
                  actionHeader.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                ...bulletPoints.map((point) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 5, right: 8),
                        width: 5,
                        height: 5,
                        decoration: const BoxDecoration(
                          color: Color(0xFFD97706),
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          point,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B),
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: Listener(
                    behavior: HitTestBehavior.opaque,
                    onPointerDown: (_) => dismiss(),
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: dismiss,
                      child: const Text(
                        'Got it',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // MARKS SPREADSHEET ACTIONS
  // --------------------------------------------------------------------------

  Future<void> _openMarksEntry() async {
    if (_selectedExam == null || _selectedClassId == null) return;

    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    // Pre-check: Timetable papers check before opening marks entry (Exact Web Parity)
    List<dynamic> papers = [];
    try {
      final ttData = await widget.examService.getExamTimetable(examId, classId);
      papers = (ttData['papers'] as List<dynamic>?) ?? [];
    } catch (_) {}

    if (papers.isEmpty) {
      if (!mounted) return;
      _showValidationPopup(
        title: 'MARKS ENTRY IS NOT AVAILABLE YET',
        message1: 'Marks entry cannot be opened because no examination papers have been scheduled for this class.',
        message2: 'Please create the examination timetable and add at least one paper before entering student marks.',
        actionHeader: 'Required Action',
        bulletPoints: [
          'Create the examination timetable.',
          'Add examination papers for this class.',
          'Return and open Marks Entry again.',
        ],
      );
      return;
    }

    setState(() {
      _activeView = 'marks';
      _loadingMarks = true;
      _marksScheduledSubjects = [];
    });

    try {
      if (_subjects.isEmpty) {
        try {
          _subjects = await widget.examService.getSubjects();
        } catch (_) {}
      }

      // Load timetable to get scheduled papers for this exam & class
      final ttData = await widget.examService.getExamTimetable(examId, classId);
      final papers = (ttData['papers'] as List<dynamic>?) ?? [];

      // ONLY include subjects that have papers added in the timetable!
      final List<dynamic> scheduledSubs = [];
      final Set<String> addedSubIds = {};
      for (final p in papers) {
        final sid = p['subject_id']?.toString() ?? '';
        if (sid.isNotEmpty && !addedSubIds.contains(sid)) {
          addedSubIds.add(sid);
          final matched = _subjects.firstWhere(
            (s) => s['id']?.toString() == sid,
            orElse: () => null,
          );
          final sName = p['subject_name'] ?? (matched != null ? matched['name'] : 'Subject');
          final bool pIsGrade = _isPaperGrade(p);
          scheduledSubs.add({
            'id': int.tryParse(sid) ?? sid,
            'name': sName,
            'max_marks': p['max_marks'],
            'passing_marks': p['passing_marks'],
            'evaluation_type': pIsGrade ? 'grade' : (p['evaluation_type'] ?? 'marks'),
            'grading_scale': p['grading_scale'] ?? 'A,B,C,D',
          });
        }
      }

      setState(() {
        _marksScheduledSubjects = scheduledSubs;
      });

      int? firstSubId;
      if (_marksScheduledSubjects.isNotEmpty) {
        firstSubId = int.tryParse(_marksScheduledSubjects.first['id']?.toString() ?? '');
      }

      _selectedSubjectId = firstSubId;

      if (_selectedSubjectId != null) {
        await _fetchMarksSheet(examId, classId, _selectedSubjectId!);
      } else {
        setState(() => _loadingMarks = false);
      }
    } catch (e) {
      setState(() => _loadingMarks = false);
      _showAppSnackBar('Error loading marks entry: $e', isError: true);
    }
  }

  Future<void> _fetchMarksSheet(int examId, int classId, int subjectId) async {
    setState(() => _loadingMarks = true);
    try {
      final sheet = await widget.examService.getExamMarksSheet(examId, classId, subjectId);
      final students = (sheet['students'] as List<dynamic>?) ?? [];

      _markControllers.clear();
      _remarkControllers.clear();
      _absentStates.clear();
      for (var f in _markFocusNodes.values) {
        f.dispose();
      }
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

      setState(() {
        _marksSheetData = sheet;
        _loadingMarks = false;
      });
    } catch (e) {
      setState(() => _loadingMarks = false);
      _showAppSnackBar('Failed to load marks sheet: $e', isError: true);
    }
  }

  bool get _isCurrentClassExamPublished {
    if (_marksSheetData != null && _marksSheetData!['status'] == 'Published') {
      return true;
    }
    final curStatusObj = _examClassStatuses.firstWhere(
      (c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId?.toString(),
      orElse: () => null,
    );
    return curStatusObj?['status'] == 'Published';
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
    final testName = (_selectedExam?['name'] ?? 'Exam').toString().trim();
    _showValidationPopup(
      title: 'MARKS CANNOT BE UPDATED',
      message1: 'Marks can not be updated because $testName result has already been published.',
      message2: 'If you want to update marks please unpublish the result.',
      actionHeader: 'Required Action',
      bulletPoints: [
        'Go to Result Status card.',
        'Click on Unpublish Results.',
        'Return to Marks Spreadsheet and update student marks.',
      ],
    );
  }

  Future<void> _saveStudentMark(int studentId) async {
    if (_selectedExam == null || _selectedClassId == null || _selectedSubjectId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);
    final targetSubId = _selectedSubjectId!;

    final isPublished = _marksSheetData?['status'] == 'Published' || _isCurrentClassExamPublished;
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
      await widget.examService.saveExamMark(examId, {
        'student_id': studentId,
        'class_id': classId,
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
      _showAppSnackBar('Error saving mark: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _savingMarkStudentIds.remove(studentId));
      }
    }
  }

  void _flushPendingMarkInBackground(int examId, int classId, int subId) {
    final students = (_marksSheetData?['students'] as List<dynamic>?) ?? [];
    final Map<int, dynamic> serverMarksMap = {};
    for (var s in students) {
      final sid = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0') ?? 0;
      serverMarksMap[sid] = s;
    }

    for (final entry in _markControllers.entries) {
      final stId = entry.key;
      final currentText = entry.value.text.trim();
      final isAbs = _absentStates[stId] ?? false;
      final serverStudent = serverMarksMap[stId];
      final serverMark = (serverStudent?['marks_obtained']?.toString() ?? '').trim();
      final serverAbs = serverStudent?['is_absent'] == 1 || serverStudent?['is_absent'] == true;

      final bool isDirty = (currentText != serverMark) || (isAbs != serverAbs);
      if (isDirty) {
        final markToSave = isAbs ? null : (currentText.isEmpty ? null : currentText);
        final absToSave = isAbs ? 1 : 0;
        final remarkToSave = _remarkControllers[stId]?.text.trim() ?? '';

        widget.examService.saveExamMark(examId, {
          'student_id': stId,
          'class_id': classId,
          'subject_id': subId,
          'marks_obtained': markToSave,
          'is_absent': absToSave,
          'remarks': remarkToSave,
        }).catchError((_) {});
      }
    }
  }

  // --------------------------------------------------------------------------
  // REPORT CARDS ACTIONS
  // --------------------------------------------------------------------------

  Future<void> _openReportCards() async {
    if (_selectedExam == null || _selectedClassId == null) return;

    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    // Pre-check: Timetable papers check before opening report cards (Exact Web Parity)
    List<dynamic> papers = [];
    try {
      final ttData = await widget.examService.getExamTimetable(examId, classId);
      papers = (ttData['papers'] as List<dynamic>?) ?? [];
    } catch (_) {}

    if (papers.isEmpty) {
      if (!mounted) return;
      _showValidationPopup(
        title: 'REPORT CARDS ARE NOT AVAILABLE YET',
        message1: 'Report cards cannot be opened because no examination timetable has been created for this class.',
        message2: 'Please create the examination timetable and schedule at least one examination paper before opening Student Report Cards.',
        actionHeader: 'Required Action',
        bulletPoints: [
          'Create the examination timetable.',
          'Add examination papers for this class.',
          'Complete marks entry after examinations.',
          'Return and open Student Report Cards.',
        ],
      );
      return;
    }

    final pendingPapers = papers.where((p) => p['marks_completed'] != true && p['marks_completed'] != 1).toList();
    if (pendingPapers.isNotEmpty || _currentClassMarksStatus == 'Pending') {
      if (!mounted) return;
      final List<String> bulletPoints = pendingPapers.isNotEmpty
          ? pendingPapers.map((p) => (p['subject_name'] ?? 'Subject').toString()).toList()
          : ['Complete marks entry for all scheduled subjects.'];

      _showValidationPopup(
        title: 'REPORT CARDS CANNOT BE GENERATED YET',
        message1: 'Report cards cannot be generated because marks have not yet been completed for all scheduled subjects in this class.',
        message2: 'Please complete marks entry for the following subject(s) before opening Student Report Cards.',
        actionHeader: bulletPoints.length == 1 ? 'Pending Subject' : 'Pending Subjects',
        bulletPoints: bulletPoints,
      );
      return;
    }

    setState(() {
      _activeView = 'reports';
      _loadingReportCards = true;
    });

    try {
      final list = await widget.examService.getReportCards(examId, classId);

      setState(() {
        _reportCards = list;
        _loadingReportCards = false;
      });
    } catch (e) {
      setState(() => _loadingReportCards = false);
      _showAppSnackBar('Error loading report cards: $e', isError: true);
    }
  }

  bool _isGradeSubject(Map<String, dynamic> sub) {
    if (sub['is_grade_only'] == true || sub['is_grade_based'] == true) return true;
    if (sub['evaluation_type'] == 'grade') return true;
    final maxM = sub['max_marks']?.toString().toUpperCase().trim() ?? '';
    if (maxM == 'GRADE' || maxM == '-' || maxM == '—' || maxM == '0' || maxM == '0.0') return true;
    final grandMax = sub['grand_total_max']?.toString().toUpperCase().trim() ?? '';
    if (grandMax == 'GRADE' || grandMax == '-' || grandMax == '—' || grandMax == '0' || grandMax == '0.0') return true;
    final parsedMax = double.tryParse(maxM);
    if (parsedMax != null && parsedMax == 0.0) return true;
    final obt = sub['marks_obtained']?.toString().toUpperCase().trim() ?? '';
    if (['A+', 'A', 'B', 'C', 'D', 'E', 'F'].contains(obt) && obt != 'ABSENT') return true;
    return false;
  }

  List<Map<String, dynamic>> _sortSubjectsWithGradeAtBottom(List<dynamic> subjects) {
    final list = List<Map<String, dynamic>>.from(
      subjects.map((e) => Map<String, dynamic>.from(e as Map))
    );
    list.sort((a, b) {
      final aGrade = _isGradeSubject(a);
      final bGrade = _isGradeSubject(b);
      if (aGrade != bGrade) return aGrade ? 1 : -1;
      final idA = int.tryParse(a['subject_id']?.toString() ?? '') ?? 0;
      final idB = int.tryParse(b['subject_id']?.toString() ?? '') ?? 0;
      return idA.compareTo(idB);
    });
    return list;
  }

  String _formatDob(dynamic dobVal) {
    if (dobVal == null || dobVal.toString().trim().isEmpty || dobVal.toString() == '-' || dobVal.toString() == '—') {
      return '-';
    }
    final str = dobVal.toString().trim();
    final parts = str.split(RegExp(r'[-/]'));
    if (parts.length == 3) {
      if (parts[0].length == 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        return '${parts[2].padLeft(2, '0')}/${parts[1].padLeft(2, '0')}/${parts[0]}';
      }
    }
    return str;
  }

  String _formatMarksNumber(dynamic val) {
    if (val == null || val.toString().trim().isEmpty || val.toString() == '-' || val.toString() == '—') {
      return '-';
    }
    final d = double.tryParse(val.toString());
    if (d != null) {
      if (d == d.roundToDouble()) {
        return d.toInt().toString();
      }
      return d.toStringAsFixed(1);
    }
    return val.toString();
  }

  Future<pw.MemoryImage?> _loadSchoolLogo(Map<String, dynamic> card) async {
    final logoUrl = card['school_logo'] ?? _schoolProfile?['logo_path'];
    if (logoUrl != null && logoUrl.toString().trim().isNotEmpty) {
      try {
        String fullUrl = logoUrl.toString();
        if (!fullUrl.startsWith('http')) {
          fullUrl = '${widget.examService.baseUrl}/$fullUrl'.replaceAll(RegExp(r'(?<!:)/+'), '/');
        }
        final resp = await http.get(Uri.parse(fullUrl)).timeout(const Duration(seconds: 4));
        if (resp.statusCode == 200 && resp.bodyBytes.isNotEmpty) {
          return pw.MemoryImage(resp.bodyBytes);
        }
      } catch (_) {}
    }
    try {
      final byteData = await rootBundle.load('assets/images/logo-icon.png');
      return pw.MemoryImage(byteData.buffer.asUint8List());
    } catch (_) {}
    return null;
  }

  pw.Widget _buildInfoCell(String text, {bool isLabel = false, bool isBold = false}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 3.8),
      color: isLabel ? PdfColor.fromHex('#F1F5F9') : PdfColors.white,
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 8.5,
          fontWeight: isBold || isLabel ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: isLabel ? PdfColor.fromHex('#334155') : PdfColors.black,
        ),
      ),
    );
  }

  pw.Widget _buildMarksHeaderCell(String text, {pw.TextAlign align = pw.TextAlign.center}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5.5),
      alignment: align == pw.TextAlign.left ? pw.Alignment.centerLeft : pw.Alignment.center,
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: 8.2,
          fontWeight: pw.FontWeight.bold,
          color: PdfColors.black,
        ),
      ),
    );
  }

  pw.Widget _buildMarksDataCell(
    String text, {
    pw.TextAlign align = pw.TextAlign.center,
    double fontSize = 8.5,
    double padV = 4.5,
    bool isBold = false,
  }) {
    return pw.Container(
      padding: pw.EdgeInsets.symmetric(horizontal: 6, vertical: padV),
      alignment: align == pw.TextAlign.left ? pw.Alignment.centerLeft : pw.Alignment.center,
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: fontSize,
          fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: PdfColors.black,
        ),
      ),
    );
  }

  pw.Widget _buildSummaryBox(String label, String value) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: PdfColors.black, width: 0.8),
          borderRadius: const pw.BorderRadius.all(pw.Radius.circular(3)),
        ),
        child: pw.Column(
          mainAxisSize: pw.MainAxisSize.min,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(
              label,
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                fontSize: 6.5,
                fontWeight: pw.FontWeight.bold,
                color: PdfColor.fromHex('#475569'),
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              value,
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(
                fontSize: 9.5,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }

  pw.Page _buildReportCardPage({
    required Map<String, dynamic> card,
    required pw.MemoryImage? logoImage,
    required String schoolName,
    required String schoolAddress,
    required String academicYear,
    required String examName,
  }) {
    final studentName = (card['student_name'] ?? card['name'] ?? 'Student').toString();
    final rollNo = (card['roll_no'] ?? '').toString().trim();
    final srNo = (card['admission_no'] ?? card['sr_no'] ?? '').toString().trim();
    final rollSrDisplay = rollNo.isNotEmpty && srNo.isNotEmpty
        ? '$rollNo | $srNo'
        : (rollNo.isNotEmpty ? rollNo : (srNo.isNotEmpty ? srNo : '-'));

    final className = (card['class_name'] ?? _classes.firstWhere((c) => c['id']?.toString() == _selectedClassId, orElse: () => null)?['name'] ?? 'Class').toString();
    final section = (card['class_section'] ?? '').toString().trim();
    final classSecDisplay = section.isNotEmpty ? '$className ($section)' : className;

    final fatherName = (card['father_name'] ?? '').toString().trim().isNotEmpty ? card['father_name'].toString().trim() : '-';
    final motherName = (card['mother_name'] ?? '').toString().trim().isNotEmpty ? card['mother_name'].toString().trim() : '-';
    final dobDisplay = _formatDob(card['dob'] ?? card['date_of_birth']);

    final rawSubs = List<Map<String, dynamic>>.from(
      ((card['subjects'] as List<dynamic>?) ?? []).map((e) => Map<String, dynamic>.from(e as Map))
    );

    rawSubs.sort((a, b) {
      final aGrade = _isGradeSubject(a);
      final bGrade = _isGradeSubject(b);
      if (aGrade != bGrade) return aGrade ? 1 : -1;
      final idA = int.tryParse(a['subject_id']?.toString() ?? '') ?? 0;
      final idB = int.tryParse(b['subject_id']?.toString() ?? '') ?? 0;
      return idA.compareTo(idB);
    });

    double calcTotalMax = 0;
    double calcTotalObt = 0;
    for (final s in rawSubs) {
      if (!_isGradeSubject(s)) {
        final maxVal = double.tryParse(s['max_marks']?.toString() ?? '') ?? 0;
        final obtVal = double.tryParse(s['marks_obtained']?.toString() ?? '') ?? 0;
        calcTotalMax += maxVal;
        calcTotalObt += obtVal;
      }
    }

    final totalMaxStr = (card['total_max'] != null && (double.tryParse(card['total_max'].toString()) ?? 0) > 0)
        ? _formatMarksNumber(card['total_max'])
        : (calcTotalMax > 0 ? _formatMarksNumber(calcTotalMax) : '-');

    final totalObtStr = (card['total_obtained'] != null && (double.tryParse(card['total_obtained'].toString()) ?? 0) >= 0)
        ? _formatMarksNumber(card['total_obtained'])
        : (calcTotalObt > 0 ? _formatMarksNumber(calcTotalObt) : '0');

    double pctVal = 0;
    if (card['percentage'] != null) {
      pctVal = double.tryParse(card['percentage'].toString()) ?? 0;
    } else if (calcTotalMax > 0) {
      pctVal = (calcTotalObt / calcTotalMax) * 100;
    }
    final pctStr = '${pctVal.toStringAsFixed(2)}%';

    final overallGrade = (card['grade'] ?? 'A').toString();
    final overallResult = (card['result'] ?? (pctVal >= 33 ? 'PASS' : 'FAIL')).toString().toUpperCase();

    String rankDisplay = (card['class_rank'] ?? '1').toString().trim();
    final rankMatch = RegExp(r'^(\d+)').firstMatch(rankDisplay);
    if (rankMatch != null) {
      rankDisplay = rankMatch.group(1)!;
    }

    String attDisplay = '0%';
    if (card['attendance'] is Map) {
      final attMap = card['attendance'] as Map;
      final rate = attMap['attendance_rate'];
      if (rate != null) {
        final rNum = double.tryParse(rate.toString()) ?? 0;
        attDisplay = '${rNum.round()}%';
      }
    } else if (card['attendance_rate'] != null) {
      final rNum = double.tryParse(card['attendance_rate'].toString()) ?? 0;
      attDisplay = '${rNum.round()}%';
    }

    final remarkText = (card['teacher_remark'] ?? card['report_card_remark'] ?? '').toString().trim();

    final int subCount = rawSubs.length;
    double cellPadV = 5.0;
    double tableFontSize = 8.5;
    if (subCount <= 4) {
      cellPadV = 8.0;
      tableFontSize = 9.5;
    } else if (subCount <= 6) {
      cellPadV = 5.8;
      tableFontSize = 9.0;
    } else if (subCount <= 8) {
      cellPadV = 4.2;
      tableFontSize = 8.5;
    } else {
      cellPadV = 2.8;
      tableFontSize = 8.0;
    }

    return pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(16),
      build: (pw.Context ctx) {
        return pw.Container(
          // Outer Border
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: PdfColors.black, width: 1.5),
          ),
          padding: const pw.EdgeInsets.all(3.5),
          child: pw.Container(
            // Inner Border
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.black, width: 1.0),
            ),
            padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.stretch,
              children: [
                // 1. School Header Block
                if (logoImage != null)
                  pw.Center(
                    child: pw.Image(logoImage, height: 44, width: 44, fit: pw.BoxFit.contain),
                  ),
                pw.SizedBox(height: 3),
                pw.Center(
                  child: pw.Text(
                    schoolName,
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.black,
                    ),
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Center(
                  child: pw.Text(
                    schoolAddress,
                    style: pw.TextStyle(
                      fontSize: 7.5,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromHex('#475569'),
                    ),
                  ),
                ),
                pw.SizedBox(height: 5),
                pw.Container(height: 1.0, color: PdfColors.black),
                pw.SizedBox(height: 4),
                pw.Center(
                  child: pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 3),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.black, width: 1.0),
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(3)),
                    ),
                    child: pw.Text(
                      '$examName REPORT CARD ($academicYear)'.toUpperCase(),
                      style: pw.TextStyle(
                        fontSize: 8.5,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.black,
                      ),
                    ),
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Container(height: 1.0, color: PdfColors.black),
                pw.SizedBox(height: 7),

                // 2. Student Info Grid (3 rows x 4 cols)
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColors.black, width: 0.8),
                  columnWidths: const {
                    0: pw.FlexColumnWidth(1.2),
                    1: pw.FlexColumnWidth(2.0),
                    2: pw.FlexColumnWidth(1.2),
                    3: pw.FlexColumnWidth(2.0),
                  },
                  children: [
                    pw.TableRow(
                      children: [
                        _buildInfoCell('Student Name', isLabel: true),
                        _buildInfoCell(studentName.toUpperCase(), isBold: true),
                        _buildInfoCell('Class & Sec', isLabel: true),
                        _buildInfoCell(classSecDisplay, isBold: true),
                      ],
                    ),
                    pw.TableRow(
                      children: [
                        _buildInfoCell("Father's Name", isLabel: true),
                        _buildInfoCell(fatherName, isBold: true),
                        _buildInfoCell("Mother's Name", isLabel: true),
                        _buildInfoCell(motherName, isBold: true),
                      ],
                    ),
                    pw.TableRow(
                      children: [
                        _buildInfoCell('Date of Birth', isLabel: true),
                        _buildInfoCell(dobDisplay, isBold: true),
                        _buildInfoCell('Roll / SR No', isLabel: true),
                        _buildInfoCell(rollSrDisplay, isBold: true),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 8),

                // 3. Marks Table
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColors.black, width: 0.8),
                  columnWidths: const {
                    0: pw.FlexColumnWidth(3.0),
                    1: pw.FlexColumnWidth(1.4),
                    2: pw.FlexColumnWidth(1.4),
                    3: pw.FlexColumnWidth(1.6),
                    4: pw.FlexColumnWidth(1.2),
                    5: pw.FlexColumnWidth(1.4),
                  },
                  children: [
                    // Header Row
                    pw.TableRow(
                      decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E2E8F0')),
                      children: [
                        _buildMarksHeaderCell('SUBJECT', align: pw.TextAlign.left),
                        _buildMarksHeaderCell('MAX MARKS'),
                        _buildMarksHeaderCell('PASS MARKS'),
                        _buildMarksHeaderCell('MARKS OBTAINED'),
                        _buildMarksHeaderCell('GRADE'),
                        _buildMarksHeaderCell('RESULT'),
                      ],
                    ),
                    // Subject Rows
                    ...rawSubs.map((sub) {
                      final isGrade = _isGradeSubject(sub);
                      final subName = (sub['subject_name'] ?? sub['name'] ?? 'Subject').toString();

                      String maxMStr = isGrade ? 'GRADE' : _formatMarksNumber(sub['max_marks']);
                      String passMStr = isGrade ? 'C' : _formatMarksNumber(sub['passing_marks']);
                      String obtMStr = isGrade
                          ? (sub['marks_obtained']?.toString() ?? sub['grade']?.toString() ?? 'A')
                          : (sub['is_absent'] == 1 ? 'ABS' : _formatMarksNumber(sub['marks_obtained']));
                      String gradeStr = (sub['grade'] ?? (isGrade ? obtMStr : '-')).toString();
                      String resultStr = isGrade ? 'PASS' : (sub['result'] ?? (sub['is_absent'] == 1 ? 'FAIL' : 'PASS')).toString().toUpperCase();

                      return pw.TableRow(
                        children: [
                          _buildMarksDataCell(subName, align: pw.TextAlign.left, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                          _buildMarksDataCell(maxMStr, fontSize: tableFontSize, padV: cellPadV),
                          _buildMarksDataCell(passMStr, fontSize: tableFontSize, padV: cellPadV),
                          _buildMarksDataCell(obtMStr, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                          _buildMarksDataCell(gradeStr, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                          _buildMarksDataCell(resultStr, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                        ],
                      );
                    }),
                    // Grand Total Row
                    pw.TableRow(
                      decoration: pw.BoxDecoration(color: PdfColor.fromHex('#E2E8F0')),
                      children: [
                        _buildMarksDataCell('Grand Total', align: pw.TextAlign.left, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                        _buildMarksDataCell(totalMaxStr, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                        _buildMarksDataCell('-', fontSize: tableFontSize, padV: cellPadV),
                        _buildMarksDataCell(totalObtStr, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                        _buildMarksDataCell(overallGrade, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                        _buildMarksDataCell(overallResult, fontSize: tableFontSize, padV: cellPadV, isBold: true),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 7),

                // 4. Performance Summary Cards (5 columns)
                pw.Row(
                  children: [
                    _buildSummaryBox('TOTAL MARKS', '$totalObtStr / $totalMaxStr'),
                    pw.SizedBox(width: 5),
                    _buildSummaryBox('PERCENTAGE', pctStr),
                    pw.SizedBox(width: 5),
                    _buildSummaryBox('OVERALL GRADE', 'Grade $overallGrade'),
                    pw.SizedBox(width: 5),
                    _buildSummaryBox('ATTENDANCE', attDisplay),
                    pw.SizedBox(width: 5),
                    _buildSummaryBox('CLASS RANK', rankDisplay),
                  ],
                ),

                // 5. Teacher Remarks (if exists)
                if (remarkText.isNotEmpty) ...[
                  pw.SizedBox(height: 7),
                  pw.Padding(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 4),
                    child: pw.RichText(
                      text: pw.TextSpan(
                        children: [
                          pw.TextSpan(
                            text: 'Teacher Remarks: ',
                            style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: PdfColors.black),
                          ),
                          pw.TextSpan(
                            text: remarkText,
                            style: pw.TextStyle(fontSize: 8.5, fontStyle: pw.FontStyle.italic, color: PdfColors.black),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                pw.Spacer(),

                // 6. Dual Signatures
                pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 16),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Column(
                        children: [
                          pw.Container(width: 135, height: 1.0, color: PdfColors.black),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            'CLASS TEACHER SIGNATURE',
                            style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: PdfColors.black),
                          ),
                        ],
                      ),
                      pw.Column(
                        children: [
                          pw.Container(width: 155, height: 1.0, color: PdfColors.black),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            'PRINCIPAL SIGNATURE & STAMP',
                            style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: PdfColors.black),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                pw.SizedBox(height: 4),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _saveAndNotifyPdf(Uint8List pdfBytes, String filename, String title) async {
    if (Platform.isAndroid) {
      const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
      try {
        await platform.invokeMethod<String>('saveFileToDownloads', {
          'fileName': filename,
          'bytes': pdfBytes,
        });
      } catch (_) {
        final dir = await getExternalStorageDirectory();
        if (dir != null) {
          final file = File('${dir.path}/$filename');
          await file.writeAsBytes(pdfBytes);
        }
      }
    } else {
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/$filename');
      await file.writeAsBytes(pdfBytes);
    }

    await NotificationHelper.showDownloadNotification(
      title: title,
      fileName: filename,
      bytes: pdfBytes,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$filename downloaded successfully!'),
          action: SnackBarAction(
            label: 'VIEW / PRINT',
            textColor: Colors.amber.shade300,
            onPressed: () async {
              await Printing.layoutPdf(onLayout: (_) async => pdfBytes, name: filename);
            },
          ),
          duration: const Duration(seconds: 5),
        ),
      );
    }

    try {
      await Printing.layoutPdf(onLayout: (_) async => pdfBytes, name: filename);
    } catch (_) {}
  }

  Future<void> _downloadReportCardPdf(Map<String, dynamic> card) async {
    try {
      final examId = int.tryParse(_selectedExam?['id']?.toString() ?? '') ?? 0;
      final classId = int.tryParse(_selectedClassId ?? card['class_id']?.toString() ?? '') ?? 0;
      final studentId = int.tryParse(card['student_id']?.toString() ?? '');
      final studentName = (card['student_name'] ?? card['name'] ?? 'Student').toString();
      final filename = 'Report_Card_${studentName.replaceAll(RegExp(r'\s+'), '_')}.pdf';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Downloading report card for $studentName...'),
            duration: const Duration(seconds: 2),
          ),
        );
      }

      final htmlContent = await widget.examService.getReportCardPrintHtml(
        examId,
        classId,
        studentId: studentId,
      );

      final pdfBytes = await Printing.convertHtml(
        format: PdfPageFormat.a4,
        html: htmlContent,
      );

      await _saveAndNotifyPdf(pdfBytes, filename, 'Report Card Downloaded');
    } catch (e) {
      if (mounted) {
        _showAppSnackBar('Failed to download report card: $e', isError: true);
      }
    }
  }

  Future<void> _downloadAllReportCardsPdf() async {
    if (_reportCards.isEmpty) return;
    try {
      final examId = int.tryParse(_selectedExam?['id']?.toString() ?? '') ?? 0;
      final classId = int.tryParse(_selectedClassId ?? '') ?? 0;
      final selClass = _classes.firstWhere((c) => c['id']?.toString() == _selectedClassId, orElse: () => null);
      final className = (selClass?['name'] ?? 'Class').toString().replaceAll(RegExp(r'\s+'), '_');
      final examName = (_selectedExam?['name'] ?? 'Exam').toString().replaceAll(RegExp(r'\s+'), '_');
      final filename = 'All_Report_Cards_${className}_$examName.pdf';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Downloading all report cards from server...'),
            duration: Duration(seconds: 3),
          ),
        );
      }

      final htmlContent = await widget.examService.getReportCardPrintHtml(
        examId,
        classId,
      );

      final pdfBytes = await Printing.convertHtml(
        format: PdfPageFormat.a4,
        html: htmlContent,
      );

      await _saveAndNotifyPdf(pdfBytes, filename, 'All Report Cards Downloaded');
    } catch (e) {
      if (mounted) {
        _showAppSnackBar('Failed to download all report cards: $e', isError: true);
      }
    }
  }

  // --------------------------------------------------------------------------
  // RESULT PUBLISH STATUS TOGGLE
  // --------------------------------------------------------------------------

  Future<void> _toggleClassResultPublish() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);
    final testName = (_selectedExam?['name'] ?? 'Exam').toString().trim();

    final currentClassStatus = _examClassStatuses.firstWhere(
      (c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId,
      orElse: () => null,
    );

    final isPublished = currentClassStatus?['status'] == 'Published';
    final targetStatus = isPublished ? 'Draft' : 'Published';

    // Pre-check when publishing (Exact Web Parity)
    if (!isPublished) {
      List<dynamic> papers = [];
      try {
        final ttData = await widget.examService.getExamTimetable(examId, classId);
        papers = (ttData['papers'] as List<dynamic>?) ?? [];
      } catch (_) {}

      if (papers.isEmpty) {
        if (!mounted) return;
        _showValidationPopup(
          title: 'RESULTS CANNOT BE PUBLISHED YET',
          message1: 'Results cannot be published because no examination timetable has been created for this class.',
          message2: 'Please create the examination timetable, schedule examination papers, and complete marks entry before publishing examination results.',
          actionHeader: 'Required Action',
          bulletPoints: [
            'Create the examination timetable.',
            'Add examination papers.',
            'Complete marks entry for all scheduled subjects.',
            'Publish examination results.',
          ],
        );
        return;
      }

      final pendingPapers = papers.where((p) => p['marks_completed'] != true && p['marks_completed'] != 1).toList();
      if (pendingPapers.isNotEmpty) {
        if (!mounted) return;
        final List<String> bulletPoints = pendingPapers.map((p) => (p['subject_name'] ?? 'Subject').toString()).toList();
        _showValidationPopup(
          title: 'RESULTS CANNOT BE PUBLISHED YET',
          message1: 'Results cannot be published because marks have not yet been completed for all scheduled subjects in this class.',
          message2: 'Please complete marks entry for the following subject(s) before publishing examination results.',
          actionHeader: bulletPoints.length == 1 ? 'Pending Subject' : 'Pending Subjects',
          bulletPoints: bulletPoints,
        );
        return;
      }
    }

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
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
                    child: Icon(
                      Icons.error_outline_rounded,
                      color: const Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        isPublished ? 'Revert $testName to Draft' : 'Publish $testName result',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                isPublished
                    ? 'Are you sure you want to revert $testName results back to Draft? Students and parents will no longer be able to view their report cards.'
                    : 'Are you sure you want to publish $testName results? Students and parents will be able to view their report cards.',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isPublished
                    ? 'Once marked as Draft, you will be able to edit scheduled papers and marks sheet entries again.'
                    : 'Publishing results will lock marks and allow students and parents to view their report cards on their portal.',
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(
                          isPublished ? 'Revert to Draft' : 'Publish',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
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

    if (confirmed != true) return;

    setState(() => _togglingResultPublish = true);
    try {
      await widget.examService.publishExamResults(examId, classId, status: targetStatus);
      // Reload class statuses
      final statuses = await widget.examService.getExamClassStatuses(examId);
      setState(() {
        _examClassStatuses = statuses;
      });
      _showAppSnackBar('Results status updated to $targetStatus successfully!');
    } catch (e) {
      _showAppSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _togglingResultPublish = false);
    }
  }

  // --------------------------------------------------------------------------
  // EXAMINATION CONFIGURATION (GRADE CONFIGURATION SCALE)
  // Note: "Report card templates" are managed exclusively on the web portal.
  // --------------------------------------------------------------------------

  Future<void> _openExaminationConfiguration() async {
    if (_gradeScales.isEmpty) {
      try {
        _gradeScales = await widget.examService.getGradeConfigurations();
      } catch (_) {}
    }
    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ExaminationConfigurationScreen(
          examService: widget.examService,
          gradeScales: _gradeScales,
        ),
      ),
    );
    _loadDashboardData();
  }

  Future<void> _openExaminationSettings() => _openExaminationConfiguration();

  // --------------------------------------------------------------------------
  // UI RENDERING: MAIN BUILD
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _activeView == 'dashboard',
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          if (_activeView == 'classes') {
            setState(() => _activeView = 'dashboard');
          } else if (_activeView == 'timetable' || _activeView == 'marks' || _activeView == 'reports') {
            setState(() => _activeView = 'classes');
            _loadClassMarksStatus(_selectedClassId);
          }
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFAF8F5),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0.5,
          titleSpacing: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
            onPressed: () async {
              if (_activeView == 'dashboard') {
                Navigator.pop(context);
              } else if (_activeView == 'classes') {
                setState(() => _activeView = 'dashboard');
              } else {
                if (_activeView == 'marks') {
                  FocusScope.of(context).unfocus();
                  final prevSubId = _selectedSubjectId;
                  if (_selectedExam != null && _selectedClassId != null && prevSubId != null) {
                    final examId = int.parse(_selectedExam!['id'].toString());
                    final classId = int.parse(_selectedClassId!);
                    _flushPendingMarkInBackground(examId, classId, prevSubId);
                  }
                }
                if (!mounted) return;
                setState(() => _activeView = 'classes');
                _loadClassMarksStatus(_selectedClassId);
              }
            },
          ),
          title: Text(
            _activeView == 'dashboard'
                ? 'EXAMINATIONS'
                : _activeView == 'classes'
                    ? 'CLASS-WISE EXAM MANAGEMENT'
                    : _activeView == 'timetable'
                        ? 'MANAGE EXAM TIMETABLE'
                        : _activeView == 'marks'
                            ? 'MARKS SPREADSHEET'
                            : 'STUDENT REPORT CARDS',
            style: TextStyle(
              color: const Color(0xFF0F172A),
              fontWeight: FontWeight.w900,
              fontSize: (_activeView == 'marks' || _activeView == 'timetable') ? 14 : 16,
              letterSpacing: 0.5,
            ),
          ),
          actions: [
            if (_activeView == 'dashboard')
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: _openExaminationConfiguration,
                      child: Tooltip(
                        message: 'Configuration',
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD97706).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFD97706).withOpacity(0.2)),
                          ),
                          child: const Icon(
                            Icons.settings_rounded,
                            color: Color(0xFFD97706),
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            else if (_activeView == 'marks')
              Builder(
                builder: (context) {
                  final selectedClass = _classes.firstWhere(
                    (c) => c['id']?.toString() == _selectedClassId?.toString(),
                    orElse: () => null,
                  );
                  final className = selectedClass != null
                      ? formatShortClassName(selectedClass['name'], section: selectedClass['section'])
                      : 'Class';
                  final curSub = _marksScheduledSubjects.firstWhere(
                    (s) => s['id']?.toString() == _selectedSubjectId?.toString(),
                    orElse: () => null,
                  );
                  final isGradeSheet = _isPaperGrade(_marksSheetData) || _isPaperGrade(curSub);
                  final maxMarks = _marksSheetData?['max_marks']?.toString() ?? '100';

                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Text(
                            className,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
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
                  );
                },
              )
            else if (_activeView == 'reports' || _activeView == 'timetable')
              Builder(
                builder: (context) {
                  final selectedClass = _classes.firstWhere(
                    (c) => c['id']?.toString() == _selectedClassId?.toString(),
                    orElse: () => null,
                  );
                  final className = selectedClass != null
                      ? formatShortClassName(selectedClass['name'], section: selectedClass['section'])
                      : 'Class';

                  return Padding(
                    padding: const EdgeInsets.only(right: 14),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Text(
                          className,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              )
            else
              const SizedBox.shrink(),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
            : _errorMessage != null
                ? _buildErrorView()
                : _activeView == 'dashboard'
                    ? _buildDashboardView()
                    : _activeView == 'classes'
                        ? _buildClassesWorkspaceView()
                        : _activeView == 'timetable'
                            ? _buildTimetableView()
                            : _activeView == 'marks'
                                ? _buildMarksSpreadsheetView()
                                : _buildReportCardsView(),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              _errorMessage ?? 'An error occurred',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706), foregroundColor: Colors.white),
              onPressed: _loadDashboardData,
              child: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 1: DASHBOARD VIEW
  // --------------------------------------------------------------------------

  Widget _buildDashboardView() {
    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: const Color(0xFFD97706),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Stat Cards (4 Cards responsive row: TOTAL EXAMS, UPCOMING, ONGOING, PUBLISHED)
          Row(
            children: [
              Expanded(child: _buildStatCard('TOTAL EXAMS', _getTotalExamsCount(), const Color(0xFF0F172A))),
              const SizedBox(width: 6),
              Expanded(child: _buildStatCard('UPCOMING', _getUpcomingCount(), const Color(0xFFD97706))),
              const SizedBox(width: 6),
              Expanded(child: _buildStatCard('ONGOING', _getOngoingCount(), const Color(0xFFD97706))),
              const SizedBox(width: 6),
              Expanded(child: _buildStatCard('PUBLISHED', _getPublishedCount(), const Color(0xFF16A34A))),
            ],
          ),
          const SizedBox(height: 20),

          // Terminal Examination Cards
          if (_exams.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Center(
                child: Text('No terminal examinations scheduled for this session.', style: TextStyle(color: Color(0xFF64748B))),
              ),
            )
          else
            ..._exams.map((term) => _buildTerminalCard(term)),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, int count, Color numberColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 10,
                letterSpacing: 0.3,
                color: Color(0xFF64748B),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            count.toString(),
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: numberColor,
            ),
          ),
        ],
      ),
    );
  }

  String _formatMarksDisplay(dynamic marks) {
    if (marks == null) return '—';
    final s = marks.toString().trim();
    if (s.isEmpty || s == '—' || s == '-') return '—';
    final numVal = double.tryParse(s);
    if (numVal != null) {
      return '${numVal.round()} Marks';
    }
    return '$s Marks';
  }

  String _formatMarksInt(dynamic marks) {
    if (marks == null) return '';
    final s = marks.toString().trim();
    if (s.isEmpty || s == '—' || s == '-') return '';
    final numVal = double.tryParse(s);
    if (numVal != null) {
      return '${numVal.round()}';
    }
    return s;
  }

  Widget _buildTerminalCard(dynamic term) {
    final termName = term['name']?.toString().toUpperCase() ?? 'TERMINAL EXAMINATION';
    final List<dynamic> allSubTests = (term['sub_tests'] as List<dynamic>?) ?? [];
    final subTests = allSubTests;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                const Icon(Icons.description_outlined, color: Color(0xFFD97706), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    termName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      letterSpacing: 0.6,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, color: Colors.grey, size: 20),
                  color: Colors.white,
                  surfaceTintColor: Colors.transparent,
                  elevation: 6,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  onSelected: (val) {
                    if (val == 'edit') {
                      _showEditTerminalBottomSheet(term);
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(
                      value: 'edit',
                      height: 40,
                      child: Row(
                        children: [
                          Icon(Icons.edit_outlined, size: 16, color: Color(0xFF0F172A)),
                          SizedBox(width: 8),
                          Text(
                            'Edit Terminal',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Sub Tests Table / List
          if (subTests.isEmpty)
            const Padding(
              padding: EdgeInsets.all(20.0),
              child: Center(
                child: Text('No tests match the selected filter under this terminal.', style: TextStyle(fontSize: 12, color: Colors.grey)),
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 40,
                dataRowMinHeight: 48,
                dataRowMaxHeight: 54,
                horizontalMargin: 16,
                columnSpacing: 24,
                headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
                columns: const [
                  DataColumn(label: Text('TEST NAME', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                  DataColumn(label: Text('MAX MARKS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                  DataColumn(label: Text('START DATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                  DataColumn(label: Text('END DATE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                  DataColumn(label: Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                  DataColumn(label: Text('ACTIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey))),
                ],
                rows: subTests.map<DataRow>((st) {
                  final isPublished = (st['status'] ?? '').toString().toLowerCase() == 'published';
                  final maxM = _formatMarksDisplay(st['max_marks']);

                  return DataRow(
                    onSelectChanged: (_) => _openClassWorkspace(st, term),
                    cells: [
                      // Test Name with left orange bar
                      DataCell(
                        Row(
                          children: [
                            Container(
                              width: 3,
                              height: 22,
                              color: const Color(0xFFD97706),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              st['name'] ?? '',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right_rounded, size: 16, color: Colors.grey),
                          ],
                        ),
                      ),
                      // Max Marks (No Decimals)
                      DataCell(
                        Text(
                          maxM,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                        ),
                      ),
                      // Start Date
                      DataCell(Text(_formatDate(st['start_date']), style: const TextStyle(fontSize: 12, color: Colors.grey))),
                      // End Date
                      DataCell(Text(_formatDate(st['end_date']), style: const TextStyle(fontSize: 12, color: Colors.grey))),
                      // Status Badge
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isPublished ? const Color(0xFFDCFCE7) : const Color(0xFFF4F4F5),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            isPublished ? 'PUBLISHED' : 'DRAFT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isPublished ? const Color(0xFF16A34A) : const Color(0xFF71717A),
                            ),
                          ),
                        ),
                      ),
                      // Actions Menu
                      DataCell(
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert_rounded, size: 18, color: Colors.grey),
                          color: Colors.white,
                          surfaceTintColor: Colors.transparent,
                          elevation: 6,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          onSelected: (action) {
                            if (action == 'edit') {
                              _showEditTestBottomSheet(st, term);
                            } else if (action == 'workspace') {
                              _openClassWorkspace(st, term);
                            }
                          },
                          itemBuilder: (ctx) => [
                            const PopupMenuItem(
                              value: 'workspace',
                              height: 40,
                              child: Row(
                                children: [
                                  Icon(Icons.school_outlined, size: 16, color: Color(0xFF0F172A)),
                                  SizedBox(width: 8),
                                  Text(
                                    'Open Class Workspace',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                  ),
                                ],
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'edit',
                              height: 40,
                              child: Row(
                                children: [
                                  Icon(Icons.edit_outlined, size: 16, color: Color(0xFF0F172A)),
                                  SizedBox(width: 8),
                                  Text(
                                    'Edit Test Details',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // EDIT TERMINAL BOTTOM SHEET (Only Examination Name can be changed)
  // --------------------------------------------------------------------------
  Future<void> _showEditTerminalBottomSheet(dynamic term) async {
    final nameCtrl = TextEditingController(text: term['name'] ?? '');
    String? localError;
    bool isSaving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bCtx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: bottomInset + 20,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Edit Terminal Examination',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Update examination name for this terminal.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (localError != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                localError!,
                                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    const Text(
                      'EXAMINATION NAME *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nameCtrl,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: 'e.g. FIRST TERM EXAMINATION',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF64748B),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            onPressed: isSaving ? null : () => Navigator.pop(bCtx),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final trimmed = nameCtrl.text.trim();
                                    if (trimmed.isEmpty) {
                                      setSheetState(() => localError = 'Please enter examination name.');
                                      return;
                                    }
                                    setSheetState(() {
                                      isSaving = true;
                                      localError = null;
                                    });
                                    final examId = int.parse(term['id'].toString());
                                    try {
                                      await widget.examService.updateExamination(examId, {'name': trimmed});
                                      if (mounted) Navigator.pop(bCtx);
                                      await _loadDashboardData();
                                      if (mounted) {
                                        _showAppSnackBar('Terminal examination name updated successfully!');
                                      }
                                    } catch (e) {
                                      setSheetState(() {
                                        isSaving = false;
                                        localError = 'Failed to update terminal: $e';
                                      });
                                    }
                                  },
                            child: isSaving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
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
  }

  int _getSubTestRank(String name) {
    final lower = name.toLowerCase();
    final match = RegExp(r'(?:unit\s*test|ut|test|term)\s*(\d+)', caseSensitive: false).firstMatch(lower);
    if (match != null) {
      return int.tryParse(match.group(1) ?? '') ?? 99;
    }
    if (lower.contains('quarterly')) return 1;
    if (lower.contains('half')) return 2;
    if (lower.contains('annual')) return 3;
    return 99;
  }

  DateTime? _getExamMinStartDate(dynamic targetTest, dynamic parentTerm) {
    List<dynamic> siblings = [];
    if (parentTerm != null && parentTerm['sub_tests'] is List) {
      siblings = List<dynamic>.from(parentTerm['sub_tests']);
    } else if (_exams.isNotEmpty) {
      final targetId = targetTest['id']?.toString();
      for (final ex in _exams) {
        if (ex['sub_tests'] is List) {
          final subs = ex['sub_tests'] as List;
          if (subs.any((s) => s['id']?.toString() == targetId)) {
            siblings = List<dynamic>.from(subs);
            break;
          }
        }
      }
    }

    if (siblings.isEmpty) return null;

    final sorted = List<dynamic>.from(siblings)..sort((a, b) {
      final rA = _getSubTestRank((a['name'] ?? '').toString());
      final rB = _getSubTestRank((b['name'] ?? '').toString());
      if (rA != rB) return rA.compareTo(rB);
      final idA = int.tryParse(a['id']?.toString() ?? '') ?? 0;
      final idB = int.tryParse(b['id']?.toString() ?? '') ?? 0;
      return idA.compareTo(idB);
    });

    final targetId = targetTest['id']?.toString();
    final targetIdx = targetId != null ? sorted.indexWhere((e) => e['id']?.toString() == targetId) : -1;

    final preceding = sorted.where((e) {
      final idx = sorted.indexOf(e);
      final isBefore = (targetIdx == -1 || idx < targetIdx) && e['id']?.toString() != targetId;
      final hasEnd = (e['end_date'] ?? '').toString().trim().isNotEmpty;
      return isBefore && hasEnd;
    }).toList();

    if (preceding.isEmpty) return null;

    String latestEndDate = '';
    for (final e in preceding) {
      final ed = (e['end_date'] ?? '').toString().trim();
      if (latestEndDate.isEmpty || ed.compareTo(latestEndDate) > 0) {
        latestEndDate = ed;
      }
    }

    if (latestEndDate.isEmpty) return null;
    final dt = DateTime.tryParse(latestEndDate);
    return dt != null ? dt.add(const Duration(days: 1)) : null;
  }

  DateTime? _getExamMaxEndDate(dynamic targetTest, dynamic parentTerm) {
    List<dynamic> siblings = [];
    if (parentTerm != null && parentTerm['sub_tests'] is List) {
      siblings = List<dynamic>.from(parentTerm['sub_tests']);
    } else if (_exams.isNotEmpty) {
      final targetId = targetTest['id']?.toString();
      for (final ex in _exams) {
        if (ex['sub_tests'] is List) {
          final subs = ex['sub_tests'] as List;
          if (subs.any((s) => s['id']?.toString() == targetId)) {
            siblings = List<dynamic>.from(subs);
            break;
          }
        }
      }
    }

    if (siblings.isEmpty) return null;

    final sorted = List<dynamic>.from(siblings)..sort((a, b) {
      final rA = _getSubTestRank((a['name'] ?? '').toString());
      final rB = _getSubTestRank((b['name'] ?? '').toString());
      if (rA != rB) return rA.compareTo(rB);
      final idA = int.tryParse(a['id']?.toString() ?? '') ?? 0;
      final idB = int.tryParse(b['id']?.toString() ?? '') ?? 0;
      return idA.compareTo(idB);
    });

    final targetId = targetTest['id']?.toString();
    final targetIdx = targetId != null ? sorted.indexWhere((e) => e['id']?.toString() == targetId) : -1;
    if (targetIdx == -1) return null;

    final succeeding = sorted.where((e) {
      final idx = sorted.indexOf(e);
      final isAfter = idx > targetIdx && e['id']?.toString() != targetId;
      final hasStart = (e['start_date'] ?? '').toString().trim().isNotEmpty;
      return isAfter && hasStart;
    }).toList();

    if (succeeding.isEmpty) return null;

    String earliestStartDate = '';
    for (final e in succeeding) {
      final sd = (e['start_date'] ?? '').toString().trim();
      if (earliestStartDate.isEmpty || sd.compareTo(earliestStartDate) < 0) {
        earliestStartDate = sd;
      }
    }

    if (earliestStartDate.isEmpty) return null;
    final dt = DateTime.tryParse(earliestStartDate);
    return dt != null ? dt.subtract(const Duration(days: 1)) : null;
  }

  String _formatDateIso(DateTime d) {
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  // --------------------------------------------------------------------------
  // EDIT TEST DETAILS BOTTOM SHEET (With Exact Web Logic, Date Boundaries & Reset Papers Confirm)
  // --------------------------------------------------------------------------
  Future<void> _showEditTestBottomSheet(dynamic test, dynamic parentTerm) async {
    final nameCtrl = TextEditingController(text: test['name'] ?? '');
    final maxMarksCtrl = TextEditingController(text: _formatMarksInt(test['max_marks']));
    final startCtrl = TextEditingController(text: test['start_date'] ?? '');
    final endCtrl = TextEditingController(text: test['end_date'] ?? '');
    final minAllowedStart = _getExamMinStartDate(test, parentTerm);
    final maxAllowedEnd = _getExamMaxEndDate(test, parentTerm);
    String? localError;
    bool isSaving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bCtx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottomInset = MediaQuery.of(context).viewInsets.bottom;
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: bottomInset + 20,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Edit Test Details',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Update details for this test or component.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (localError != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                localError!,
                                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Test Name
                    const Text(
                      'TEST NAME *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nameCtrl,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: 'e.g. Unit Test 1',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Max Marks (Integer Only - No Decimals)
                    const Text(
                      'MAX MARKS (OPTIONAL, E.G. 100, 50, 20)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: maxMarksCtrl,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: 'e.g. 100',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Start Date & End Date Row
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'START DATE *',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(height: 6),
                              InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () async {
                                  final firstStartLimit = minAllowedStart ?? DateTime(2020);
                                  final lastStartLimit = maxAllowedEnd ?? DateTime(2035);
                                  DateTime cur = DateTime.tryParse(startCtrl.text) ?? (minAllowedStart ?? DateTime.now());
                                  if (cur.isBefore(firstStartLimit)) cur = firstStartLimit;
                                  if (cur.isAfter(lastStartLimit)) cur = lastStartLimit;

                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: cur,
                                    firstDate: firstStartLimit,
                                    lastDate: lastStartLimit,
                                    builder: (context, child) {
                                      return Theme(
                                        data: Theme.of(context).copyWith(
                                          colorScheme: const ColorScheme.light(
                                            primary: Color(0xFFD97706),
                                            onPrimary: Colors.white,
                                            onSurface: Color(0xFF0F172A),
                                          ),
                                        ),
                                        child: child!,
                                      );
                                    },
                                  );
                                  if (picked != null) {
                                    final pickedStr = _formatDateIso(picked);
                                    setSheetState(() {
                                      startCtrl.text = pickedStr;
                                      final curEnd = DateTime.tryParse(endCtrl.text);
                                      if (curEnd != null && curEnd.isBefore(picked)) {
                                        endCtrl.text = pickedStr;
                                      }
                                    });
                                  }
                                },
                                child: IgnorePointer(
                                  child: TextField(
                                    controller: startCtrl,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                    decoration: InputDecoration(
                                      hintText: 'YYYY-MM-DD',
                                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                                      suffixIcon: const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFFD97706)),
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'END DATE *',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(height: 6),
                              InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: () async {
                                  final selectedStart = DateTime.tryParse(startCtrl.text);
                                  final firstEndLimit = selectedStart ?? minAllowedStart ?? DateTime(2020);
                                  final lastEndLimit = maxAllowedEnd ?? DateTime(2035);
                                  DateTime cur = DateTime.tryParse(endCtrl.text) ?? (selectedStart ?? minAllowedStart ?? DateTime.now());
                                  if (cur.isBefore(firstEndLimit)) cur = firstEndLimit;
                                  if (cur.isAfter(lastEndLimit)) cur = lastEndLimit;

                                  final picked = await showDatePicker(
                                    context: context,
                                    initialDate: cur,
                                    firstDate: firstEndLimit,
                                    lastDate: lastEndLimit,
                                    builder: (context, child) {
                                      return Theme(
                                        data: Theme.of(context).copyWith(
                                          colorScheme: const ColorScheme.light(
                                            primary: Color(0xFFD97706),
                                            onPrimary: Colors.white,
                                            onSurface: Color(0xFF0F172A),
                                          ),
                                        ),
                                        child: child!,
                                      );
                                    },
                                  );
                                  if (picked != null) {
                                    setSheetState(() {
                                      endCtrl.text = _formatDateIso(picked);
                                    });
                                  }
                                },
                                child: IgnorePointer(
                                  child: TextField(
                                    controller: endCtrl,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                    decoration: InputDecoration(
                                      hintText: 'YYYY-MM-DD',
                                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                                      suffixIcon: const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFFD97706)),
                                      filled: true,
                                      fillColor: const Color(0xFFF8FAFC),
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Actions
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF64748B),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            onPressed: isSaving ? null : () => Navigator.pop(bCtx),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final trimmedName = nameCtrl.text.trim();
                                    if (trimmedName.isEmpty) {
                                      setSheetState(() => localError = 'Please enter test name.');
                                      return;
                                    }

                                    final marksStr = maxMarksCtrl.text.trim();
                                    if (marksStr.isNotEmpty) {
                                      if (marksStr.contains('.') || int.tryParse(marksStr) == null) {
                                        setSheetState(() => localError = 'Max Marks must be a whole number. Decimal marks are not allowed.');
                                        return;
                                      }
                                      if ((int.tryParse(marksStr) ?? 0) <= 0) {
                                        setSheetState(() => localError = 'Max Marks must be greater than 0.');
                                        return;
                                      }
                                    }

                                    final sDate = startCtrl.text.trim();
                                    final eDate = endCtrl.text.trim();
                                    if (sDate.isEmpty || eDate.isEmpty) {
                                      setSheetState(() => localError = 'Please select both Start Date and End Date.');
                                      return;
                                    }

                                    if (eDate.compareTo(sDate) < 0) {
                                      setSheetState(() => localError = 'End Date cannot be before Start Date.');
                                      return;
                                    }

                                    // Sibling date sequence checks (matching web exactly)
                                    if (minAllowedStart != null && sDate.compareTo(_formatDateIso(minAllowedStart)) < 0) {
                                      final prevEnd = _formatDateIso(minAllowedStart.subtract(const Duration(days: 1)));
                                      setSheetState(() => localError = 'Start Date cannot be before ${_formatDateIso(minAllowedStart)} because previous test/examination is scheduled until $prevEnd.');
                                      return;
                                    }
                                    if (maxAllowedEnd != null && eDate.compareTo(_formatDateIso(maxAllowedEnd)) > 0) {
                                      final nextStart = _formatDateIso(maxAllowedEnd.add(const Duration(days: 1)));
                                      setSheetState(() => localError = 'End Date cannot be after ${_formatDateIso(maxAllowedEnd)} because subsequent test/examination is scheduled to start on $nextStart.');
                                      return;
                                    }

                                    // Confirmation Popup Logic (Matching Web Exactly)
                                    final origStart = (test['start_date'] ?? '').toString().trim();
                                    final origEnd = (test['end_date'] ?? '').toString().trim();
                                    final datesChanged = (sDate != origStart) || (eDate != origEnd);

                                    if (datesChanged) {
                                      // Web's Modify Dates & Reset Papers confirmation dialog
                                      final bool? confirm = await showDialog<bool>(
                                        context: context,
                                        barrierDismissible: false,
                                        builder: (dCtx) {
                                          return AlertDialog(
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                            backgroundColor: Colors.white,
                                            surfaceTintColor: Colors.transparent,
                                            contentPadding: const EdgeInsets.all(20),
                                            content: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Container(
                                                  width: 50,
                                                  height: 50,
                                                  decoration: const BoxDecoration(
                                                    color: Color(0xFFFEF3C7),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 30),
                                                ),
                                                const SizedBox(height: 14),
                                                const Text(
                                                  'Modify Examination Dates & Reset Papers?',
                                                  textAlign: TextAlign.center,
                                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                                ),
                                                const SizedBox(height: 8),
                                                const Text(
                                                  'Previously added exam papers & scheme will be reset!',
                                                  textAlign: TextAlign.center,
                                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                                                ),
                                                const SizedBox(height: 8),
                                                Text(
                                                  'You modified the Start Date / End Date for ${test['name']}. Since papers and timetable entries have already been configured for this examination, changing the dates will reset (delete) all previously added papers and marks schemes. You will need to schedule a fresh paper scheme according to the new examination dates.\n\nDo you want to proceed and reset added papers for the new dates?',
                                                  textAlign: TextAlign.center,
                                                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                                                ),
                                              ],
                                            ),
                                            actionsPadding: const EdgeInsets.only(left: 20, right: 20, bottom: 20),
                                            actions: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: OutlinedButton(
                                                      style: OutlinedButton.styleFrom(
                                                        foregroundColor: const Color(0xFF64748B),
                                                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                                      ),
                                                      onPressed: () => Navigator.pop(dCtx, false),
                                                      child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 10),
                                                  Expanded(
                                                    child: ElevatedButton(
                                                      style: ElevatedButton.styleFrom(
                                                        backgroundColor: const Color(0xFFD97706),
                                                        foregroundColor: Colors.white,
                                                        elevation: 0,
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                                      ),
                                                      onPressed: () => Navigator.pop(dCtx, true),
                                                      child: const Text('Yes, Reset Papers', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          );
                                        },
                                      );

                                      if (confirm != true) return;
                                      Navigator.pop(bCtx);
                                      await _executeUpdateTest(test['id'], trimmedName, marksStr, sDate, eDate, true);
                                    } else {
                                      // Confirmation dialog for test update
                                      final bool? confirm = await showDialog<bool>(
                                        context: context,
                                        builder: (dCtx) {
                                          return AlertDialog(
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                                            backgroundColor: Colors.white,
                                            surfaceTintColor: Colors.transparent,
                                            title: const Text('Confirm Test Update', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                                            content: Text('Are you sure you want to update the details for "${test['name']}"?', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(dCtx, false),
                                                child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                                              ),
                                              ElevatedButton(
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: const Color(0xFFD97706),
                                                  foregroundColor: Colors.white,
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                ),
                                                onPressed: () => Navigator.pop(dCtx, true),
                                                child: const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
                                              ),
                                            ],
                                          );
                                        },
                                      );

                                      if (confirm != true) return;
                                      Navigator.pop(bCtx);
                                      await _executeUpdateTest(test['id'], trimmedName, marksStr, sDate, eDate, false);
                                    }
                                  },
                            child: isSaving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
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
  }

  Future<void> _executeUpdateTest(
    dynamic testId,
    String name,
    String maxMarksStr,
    String sDate,
    String eDate,
    bool resetPapers,
  ) async {
    setState(() => _isLoading = true);
    try {
      final examId = int.parse(testId.toString());
      await widget.examService.updateExamination(examId, {
        'name': name,
        'max_marks': maxMarksStr.isEmpty ? null : maxMarksStr,
        'start_date': sDate,
        'end_date': eDate,
        'reset_papers': resetPapers,
      });
      await _loadDashboardData();
      if (mounted) {
        _showAppSnackBar(
          resetPapers
              ? 'Test dates updated and timetable papers reset successfully.'
              : 'Test details updated successfully.',
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        _showAppSnackBar('Failed to update test: $e', isError: true);
      }
    }
  }

  // --------------------------------------------------------------------------
  // VIEW 2: CLASS-WISE EXAMINATION WORKSPACE
  // --------------------------------------------------------------------------

  Widget _buildClassesWorkspaceView() {
    final sortedClasses = List<dynamic>.from(_classes)..sort(compareClassItems);

    final currentStatusObj = _examClassStatuses.firstWhere(
      (c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId,
      orElse: () => null,
    );

    final currentClass = sortedClasses.firstWhere(
      (c) => c['id']?.toString() == _selectedClassId,
      orElse: () => (sortedClasses.isNotEmpty ? sortedClasses.first : {'name': 'Class'}),
    );

    final className = formatShortClassName(currentClass['name'], section: currentClass['section']);
    final publishStatus = currentStatusObj?['status'] ?? 'Draft';
    final publishDate = currentStatusObj?['publish_date'] ?? '—';
    final isPublished = publishStatus == 'Published';

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        // Subtitle header
        Text(
          '${_selectedExam?['name']?.toString().toUpperCase() ?? ''} (${_formatDate(_selectedExam?['start_date'])} to ${_formatDate(_selectedExam?['end_date'])})',
          style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 14),

        // Class Selector
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'SELECT CLASS',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 8),
              _buildDownwardDropdownAnchor<String>(
                context: context,
                hint: 'Select a class',
                value: sortedClasses.any((c) => c['id']?.toString() == _selectedClassId) ? _selectedClassId : null,
                displayText: sortedClasses.any((c) => c['id']?.toString() == _selectedClassId)
                    ? formatShortClassName(currentClass['name'], section: currentClass['section'])
                    : 'Select a class',
                items: sortedClasses.map((c) {
                  final cid = c['id']?.toString() ?? '';
                  final label = formatShortClassName(c['name'], section: c['section']);
                  return DropdownMenuItemModel<String>(value: cid, label: label);
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedClassId = val);
                    _loadClassMarksStatus(val);
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        if (_selectedClassId == null)
          const Center(child: Text('Select a class above to open its workspace.'))
        else ...[
          // Card 1: Exam Timetable
          _buildWorkspaceCard(
            icon: Icons.calendar_month_rounded,
            title: 'Exam Timetable',
            subtitle: 'Configure exam papers, schedule dates/times, max marks, and room assignments for $className.',
            buttonLabel: 'Open Timetable',
            onTap: _openTimetable,
          ),
          const SizedBox(height: 14),

          // Card 2: Seating Plan
          _buildWorkspaceCard(
            icon: Icons.group_rounded,
            title: 'Seating Plan',
            subtitle: 'Generate examination seating arrangements, room allocation, student seating slips, and printable seating plans.',
            buttonLabel: _hasSeatingPlan ? 'Open Seating Plan' : 'Create Seating Plan',
            onTap: _openSeatingPlan,
          ),
          const SizedBox(height: 14),

          // Card 3: Enter Marks
          _buildWorkspaceCard(
            icon: Icons.edit_note_rounded,
            title: 'Enter Marks',
            subtitle: 'Enter and manage subject-wise marks, absent records, and teacher remarks in a real-time auto-saving spreadsheet.',
            buttonLabel: 'Open Marks Entry',
            onTap: _openMarksEntry,
            badge: _buildMarksStatusBadge(),
          ),
          const SizedBox(height: 14),

          // Card 4: Single Exam Report Cards
          _buildWorkspaceCard(
            icon: Icons.workspace_premium_rounded,
            title: '${_selectedExam?['name'] ?? 'Test'} Report Cards',
            subtitle: 'Generate, preview, print, or download individual exam report cards with automated class ranks, section ranks, and attendance.',
            buttonLabel: 'Open Report Cards',
            onTap: _openReportCards,
          ),
          const SizedBox(height: 14),

          // Card 5: Result Status
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.settings_rounded, color: Color(0xFFD97706), size: 20),
                    SizedBox(width: 8),
                    Text('Result Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Publish Status:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isPublished ? const Color(0xFFDCFCE7) : const Color(0xFFF4F4F5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        publishStatus.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isPublished ? const Color(0xFF16A34A) : const Color(0xFF71717A),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Publish Date:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    Text(publishDate, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isPublished ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _togglingResultPublish ? null : _toggleClassResultPublish,
                    child: _togglingResultPublish
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : (isPublished
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.undo_rounded, size: 16),
                                  SizedBox(width: 8),
                                  Text(
                                    'Revert to Draft',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ],
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.check_circle_outline_rounded, size: 18),
                                  SizedBox(width: 8),
                                  Text(
                                    'Publish Results',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ],
                              )),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ],
    );
  }

  Widget _buildWorkspaceCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String buttonLabel,
    required VoidCallback onTap,
    Widget? badge,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFFD97706), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
              ),
              if (badge != null) ...[
                const SizedBox(width: 8),
                badge,
              ],
            ],
          ),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.grey, height: 1.4)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: onTap,
              child: Text(buttonLabel, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }

  // Custom Dropdown Anchor (Opens directly downward below the field with 16px curved corners)
  Widget _buildDownwardDropdownAnchor<T>({
    required BuildContext context,
    required String hint,
    required T? value,
    required String displayText,
    required List<DropdownMenuItemModel<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Builder(
      builder: (btnContext) {
        return InkWell(
          onTap: items.isEmpty
              ? null
              : () async {
                  final renderBox = btnContext.findRenderObject() as RenderBox?;
                  if (renderBox == null) return;
                  final offset = renderBox.localToGlobal(Offset.zero);
                  final size = renderBox.size;
                  final overlay = Overlay.of(context).context.findRenderObject() as RenderBox?;
                  if (overlay == null) return;

                  final position = RelativeRect.fromRect(
                    Rect.fromLTWH(offset.dx, offset.dy + size.height + 4, size.width, size.height),
                    Offset.zero & overlay.size,
                  );

                  final selected = await showMenu<T>(
                    context: context,
                    position: position,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    color: Colors.white,
                    elevation: 6,
                    constraints: BoxConstraints(
                      minWidth: size.width,
                      maxWidth: size.width,
                      maxHeight: 280,
                    ),
                    items: items.map((item) {
                      final isSelected = item.value == value;
                      return PopupMenuItem<T>(
                        value: item.value,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Text(
                          item.label,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                            color: isSelected ? const Color(0xFFD97706) : const Color(0xFF0F172A),
                          ),
                        ),
                      );
                    }).toList(),
                  );

                  if (selected != null) {
                    onChanged(selected);
                  }
                },
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    displayText.isNotEmpty ? displayText : hint,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: displayText.isNotEmpty && displayText != hint ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 22),
              ],
            ),
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 3: TIMETABLE VIEW (FULL WEB PARITY UX & DESIGN)
  // --------------------------------------------------------------------------

  Widget _buildTimetableView() {
    if (_loadingTimetable) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)));
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [

        // 2. Card 1: Add Paper / Edit Paper (Matching Web Screen)
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Card Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                  border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: _editingPaper != null
                    ? Row(
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Edit Paper',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                              ),
                              const SizedBox(width: 8),
                              InkWell(
                                onTap: () => setState(() => _resetTimetableForm(resetTime: false)),
                                borderRadius: BorderRadius.circular(6),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text('Cancel Edit', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            icon: _submittingTimetable
                                ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.save_rounded, size: 15),
                            label: Text(
                              _submittingTimetable ? 'Saving...' : 'Save Changes',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5),
                            ),
                            onPressed: _submittingTimetable ? null : _savePaperLocal,
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          const Text(
                            'Add Paper',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.only(right: 10),
                            decoration: const BoxDecoration(
                              border: Border(right: BorderSide(color: Color(0xFFE2E8F0))),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text('SUBJECTS COMPLETED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.3)),
                                Text(
                                  '${_timetablePapers.length}',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFFD97706), height: 1.1),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            icon: _submittingTimetable
                                ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.add_rounded, size: 15),
                            label: Text(
                              _submittingTimetable ? 'Adding...' : 'Add Paper',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5),
                            ),
                            onPressed: _submittingTimetable ? null : _savePaperLocal,
                          ),
                        ],
                      ),
              ),

              // Form Body
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ROW 1: SELECT SUBJECT
                    const Text('SELECT SUBJECT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          borderRadius: BorderRadius.circular(14),
                          dropdownColor: Colors.white,
                          value: _subjects.any((s) => int.tryParse(s['id'].toString()) == _ttSubjectId) ? _ttSubjectId : null,
                          isExpanded: true,
                          hint: const Text('-- Choose Subject --', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                          items: _subjects.map<DropdownMenuItem<int>>((s) {
                            final sid = int.tryParse(s['id'].toString());
                            final isCreated = _timetablePapers.any((p) =>
                              p['subject_id']?.toString() == sid?.toString() &&
                              (_editingPaper == null || _editingPaper!['subject_id']?.toString() != sid?.toString())
                            );
                            return DropdownMenuItem<int>(
                              value: sid,
                              enabled: !isCreated,
                              child: Text(
                                '${s['name'] ?? 'Subject'}${isCreated ? ' (Created)' : ''}',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: isCreated ? FontWeight.normal : FontWeight.w600,
                                  color: isCreated ? Colors.grey : const Color(0xFF0F172A),
                                ),
                              ),
                            );
                          }).toList(),
                          onChanged: _editingPaper != null ? null : (val) {
                            if (val != null) setState(() => _ttSubjectId = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // ROW 2: EXAM DATE
                    const Text('EXAM DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: _pickExamDate,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _ttExamDate.isNotEmpty ? _formatDisplayDate(_ttExamDate) : 'Select date',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _ttExamDate.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                              ),
                            ),
                            const Icon(Icons.calendar_month_outlined, size: 18, color: Color(0xFF64748B)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // ROW 3: EVALUATION TYPE
                    const Text('EVALUATION TYPE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          borderRadius: BorderRadius.circular(14),
                          dropdownColor: Colors.white,
                          value: (_ttEvaluationType == 'grade') ? 'grade' : 'marks',
                          isExpanded: true,
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                          items: const [
                            DropdownMenuItem(value: 'marks', child: Text('Marks Based (0-100)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                            DropdownMenuItem(value: 'grade', child: Text('Grade Based (A, B, C, D)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _ttEvaluationType = val;
                                if (val == 'marks') {
                                  final examMax = int.tryParse(_selectedExam?['max_marks']?.toString() ?? '') ?? 30;
                                  _ttMaxMarksCtrl.text = examMax.toString();
                                  _ttPassMarksCtrl.text = (examMax * 0.33).ceil().toString();
                                }
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // ROW 4: START TIME & END TIME
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('START TIME', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                              const SizedBox(height: 6),
                              InkWell(
                                onTap: () => _pickTime(isStartTime: true),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(_formatDisplayTime(_ttStartTime), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                                      const Icon(Icons.access_time_rounded, size: 16, color: Color(0xFF64748B)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('END TIME', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                              const SizedBox(height: 6),
                              InkWell(
                                onTap: () => _pickTime(isStartTime: false),
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(_formatDisplayTime(_ttEndTime), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                                      const Icon(Icons.access_time_rounded, size: 16, color: Color(0xFF64748B)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // ROW 5: MARKS OR GRADING SCALE
                    if (_ttEvaluationType == 'grade') ...[
                      const Text('GRADING SCALE (DIRECT GRADE)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFD97706), letterSpacing: 0.5)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            borderRadius: BorderRadius.circular(14),
                            dropdownColor: Colors.white,
                            value: 'A,B,C,D',
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                            items: const [
                              DropdownMenuItem(value: 'A,B,C,D', child: Text('4-Tier Scale (A, B, C, D)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _ttGradingScale = val);
                            },
                          ),
                        ),
                      ),
                    ] else ...[
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('MAXIMUM MARKS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _ttMaxMarksCtrl,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: Colors.white,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
                                  ),
                                  onChanged: (val) {
                                    final numVal = int.tryParse(val) ?? 0;
                                    if (numVal > 0) {
                                      final calcPass = (numVal * 0.33).ceil();
                                      _ttPassMarksCtrl.text = calcPass.toString();
                                    }
                                  },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('PASSING MARKS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _ttPassMarksCtrl,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: Colors.white,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // 3. Card 2: Exam Papers List (Matching Web Screen)
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                  border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: Row(
                  children: [
                    const Text(
                      'Exam Papers',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                    ),
                    const Spacer(),
                    if (_timetablePapers.isNotEmpty) ...[
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isSchemePublished ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        icon: _togglingSchemePublish
                            ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Icon(_isSchemePublished ? Icons.undo_rounded : Icons.check_circle_rounded, size: 14),
                        label: Text(
                          _togglingSchemePublish
                              ? 'Saving...'
                              : (_isSchemePublished ? 'Revert to Draft' : 'Publish Scheme'),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                        onPressed: _togglingSchemePublish ? null : _toggleSchemePublish,
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        icon: _downloadingScheme
                            ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.download_rounded, size: 14),
                        label: Text(
                          _downloadingScheme ? 'Loading...' : 'Download Scheme',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                        onPressed: _downloadingScheme ? null : _downloadExamScheme,
                      ),
                    ],
                  ],
                ),
              ),

              // Content / Table
              if (_timetablePapers.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                  child: Center(
                    child: Text(
                      'No papers scheduled for this examination yet. Use the form above to add papers.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _timetablePapers.length,
                  separatorBuilder: (context, index) => const Divider(height: 1, color: Color(0xFFE2E8F0)),
                  itemBuilder: (context, idx) {
                    final p = _timetablePapers[idx];
                    final isGrade = _isPaperGrade(p);

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      p['subject_name'] ?? 'Subject',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                                    ),
                                    if (isGrade) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(color: const Color(0xFFFCD34D)),
                                        ),
                                        child: const Text('GRADE BASED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF92400E))),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFF64748B)),
                                    const SizedBox(width: 4),
                                    Text(_formatDisplayDate(p['exam_date'] ?? ''), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                    const SizedBox(width: 10),
                                    const Icon(Icons.access_time_rounded, size: 12, color: Color(0xFF64748B)),
                                    const SizedBox(width: 4),
                                    Text('${_formatTimeString(p['start_time'])} - ${_formatTimeString(p['end_time'])}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                if (isGrade)
                                  Text(
                                    'Grade Based (${(p['grading_scale'] ?? 'A, B, C, D').toString().replaceAll("E,", "").replaceAll(",E", "").replaceAll(", E", "")})',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
                                  )
                                else
                                  Text(
                                    'Max Marks: ${_formatMarkValue(p['max_marks'], defaultVal: '30')} | Passing: ${_formatMarkValue(p['passing_marks'], defaultVal: '10')}',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                                  ),
                              ],
                            ),
                          ),
                          // Action Buttons
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, color: Color(0xFFD97706), size: 20),
                            tooltip: 'Edit Paper',
                            onPressed: () => _startEditPaper(Map<String, dynamic>.from(p)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Paper',
                            onPressed: () => _confirmDeletePaper(Map<String, dynamic>.from(p), idx),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 4: MARKS SPREADSHEET VIEW
  // --------------------------------------------------------------------------

  String _resolveStudentPhotoUrl(String path) {
    if (path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final base = widget.examService.baseUrl.endsWith('/')
        ? widget.examService.baseUrl.substring(0, widget.examService.baseUrl.length - 1)
        : widget.examService.baseUrl;
    final clean = path.startsWith('/') ? path : '/$path';
    return '$base$clean';
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

    if (photo.toString().trim().isNotEmpty) {
      final fullUrl = _resolveStudentPhotoUrl(photo.toString().trim());
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
        ),
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: fullUrl,
            width: size,
            height: size,
            fit: BoxFit.cover,
            placeholder: (_, __) => _avatarFallback(size, cleanInitials),
            errorWidget: (_, __, ___) => _avatarFallback(size, cleanInitials),
          ),
        ),
      );
    }
    return _avatarFallback(size, cleanInitials);
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

  Widget _buildMarksSpreadsheetView() {
    if (_loadingMarks) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)));
    }

    if (_marksScheduledSubjects.isEmpty) {
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
    final curSub = _marksScheduledSubjects.firstWhere(
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
    final bool isPublished = _marksSheetData?['status'] == 'Published' || _isCurrentClassExamPublished;

    return Column(
      children: [
        // HORIZONTAL SUBJECT TABS (ONLY SCHEDULED PAPERS!)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: _marksScheduledSubjects.map((sub) {
                final subId = int.tryParse(sub['id']?.toString() ?? '0');
                final isSelected = subId == _selectedSubjectId;
                final subName = sub['name']?.toString() ?? 'Subject';

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      if (subId != null && subId != _selectedSubjectId) {
                        FocusScope.of(context).unfocus();
                        final prevSubId = _selectedSubjectId;
                        if (_selectedExam != null && _selectedClassId != null && prevSubId != null) {
                          final examId = int.parse(_selectedExam!['id'].toString());
                          final classId = int.parse(_selectedClassId!);
                          _flushPendingMarkInBackground(examId, classId, prevSubId);
                        }
                        setState(() => _selectedSubjectId = subId);
                        final examId = int.parse(_selectedExam!['id'].toString());
                        final classId = int.parse(_selectedClassId!);
                        _fetchMarksSheet(examId, classId, subId);
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
                          // 1. LEFT: BIG CIRCULAR PROFILE AVATAR (Circumference almost touches top & bottom borders)
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

    // --------------------------------------------------------------------------
  // VIEW 5: REPORT CARDS VIEW
  // --------------------------------------------------------------------------

  Widget _buildReportCardsView() {
    if (_loadingReportCards) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)));
    }

    if (_reportCards.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text('No report cards generated yet. Complete marks entry to generate cards.', textAlign: TextAlign.center),
        ),
      );
    }

    final query = _reportCardSearchQuery.trim().toLowerCase();
    final filteredCards = query.isEmpty
        ? _reportCards
        : _reportCards.where((card) {
            final name = (card['student_name'] ?? card['name'] ?? '').toString().toLowerCase();
            final roll = (card['roll_no'] ?? '').toString().toLowerCase();
            final sr = (card['admission_no'] ?? card['sr_no'] ?? '').toString().toLowerCase();
            return name.contains(query) || roll.contains(query) || sr.contains(query);
          }).toList();

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => FocusScope.of(context).unfocus(),
      child: Column(
        children: [
          // Search Bar for Students
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: TextField(
              controller: _reportCardSearchCtrl,
              onTapOutside: (_) => FocusScope.of(context).unfocus(),
            onChanged: (val) {
              setState(() {
                _reportCardSearchQuery = val;
              });
            },
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Search student by name or roll number...',
              hintStyle: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF94A3B8),
              ),
              prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
              suffixIcon: _reportCardSearchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, color: Color(0xFF64748B), size: 18),
                      onPressed: () {
                        _reportCardSearchCtrl.clear();
                        setState(() => _reportCardSearchQuery = '');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
        ),

        // Filtered List or Empty State
        Expanded(
          child: filteredCards.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Text(
                      'No students found matching "$_reportCardSearchQuery"',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                )
              : ListView.separated(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  itemCount: filteredCards.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final card = filteredCards[idx];
        final studentName = (card['student_name'] ?? 'Student').toString();
        final rollNo = (card['roll_no']?.toString() ?? '').trim();
        final srNo = (card['admission_no']?.toString() ?? card['sr_no']?.toString() ?? '').trim();
        final totalMarks = card['total_max'] != null 
            ? '${_formatMarksNumber(card['total_obtained'])}/${_formatMarksNumber(card['total_max'])}' 
            : '${card['total_marks'] ?? '-'}';
        final percentage = card['percentage'] != null 
            ? '${double.tryParse(card['percentage'].toString())?.toStringAsFixed(2) ?? card['percentage']}%' 
            : '-';
        final grade = (card['grade']?.toString() ?? '-').trim();
        final rank = (card['class_rank']?.toString() ?? '1').split(' ')[0].replaceAll('#', '');

        final rollSrStr = [
          if (rollNo.isNotEmpty && rollNo != '-') 'Roll: $rollNo',
          if (srNo.isNotEmpty && srNo != '-') 'SR: $srNo',
        ].join(' • ');

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.025),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // 1. LEFT: STUDENT PROFILE AVATAR
              _buildMarksStudentAvatar(card, size: 44),
              const SizedBox(width: 10),

              // 2. CENTER: NAME, RANK, ROLL/SR, SCORE, PCT, GRADE
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            studentName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Text(
                            'Rank #$rank',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (rollSrStr.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        rollSrStr,
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    // Score, Percentage, Grade Chips Row (Single line with FittedBox to prevent wrap)
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildReportCardMetricChip(label: 'Score', value: totalMarks, color: const Color(0xFF0F172A)),
                          const SizedBox(width: 4),
                          _buildReportCardMetricChip(label: 'Pct', value: percentage, color: const Color(0xFF2563EB)),
                          const SizedBox(width: 4),
                          _buildReportCardMetricChip(label: 'Grade', value: grade, color: const Color(0xFF16A34A)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // 3. RIGHT: VIEW BUTTON
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  elevation: 0,
                  minimumSize: const Size(0, 32),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.visibility_rounded, size: 13, color: Colors.white),
                label: const Text(
                  'View',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, letterSpacing: 0.2),
                ),
                onPressed: () => _showReportCardViewer(card),
              ),
            ],
          ),
        );
      },
    ),
  ),
]),
    );
  }

  void _showReportCardViewer(Map<String, dynamic> rcData) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.90,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.workspace_premium_rounded, color: Colors.indigo.shade900, size: 22),
                const SizedBox(width: 8),
                const Text(
                  'Academic Report Card',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              (rcData['exam_name'] ?? _selectedExam?['name'] ?? 'EXAMINATION').toString().toUpperCase(),
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 20, color: Color(0xFFE2E8F0)),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: _buildStudentReportCardModalContent(rcData),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentReportCardModalContent(Map<String, dynamic> rcData) {
    final schoolName = (rcData['school_name'] ?? _schoolProfile?['name'] ?? 'SPLENDID PUBLIC SCHOOL').toString().toUpperCase();
    final schoolAddress = (_schoolProfile?['street_address'] ?? _schoolProfile?['address'] ?? rcData['school_address'] ?? 'CIVIL LINES, CENTRAL EDUCATION HUB').toString().toUpperCase();
    final schoolLogo = rcData['school_logo'] ?? _schoolProfile?['logo_path'] ?? '';
    final examName = (rcData['exam_name'] ?? _selectedExam?['name'] ?? 'UNIT TEST 1').toString().toUpperCase();
    final ayName = (rcData['academic_year_name'] ?? _selectedExam?['academic_year_name'] ?? '2026-2027').toString();

    final studentName = (rcData['student_name'] ?? rcData['name'] ?? 'Student').toString().toUpperCase();
    final fatherName = (rcData['father_name'] ?? '—').toString();
    final motherName = (rcData['mother_name'] ?? '—').toString();
    final className = '${rcData['class_name'] ?? ''} ${rcData['class_section'] != null && rcData['class_section'].toString().isNotEmpty ? '(${rcData['class_section']})' : ''}'.trim();
    final rollNo = (rcData['roll_no'] ?? '—').toString();
    final admissionNo = (rcData['admission_no'] ?? '—').toString();
    final dob = _formatDob(rcData['dob'] ?? rcData['date_of_birth']);

    final subjects = _sortSubjectsWithGradeAtBottom(rcData['subjects'] as List? ?? []);
    final totalMax = _formatMarksNumber(rcData['total_max']);
    final totalObtained = _formatMarksNumber(rcData['total_obtained']);
    final percentage = rcData['percentage'] != null ? '${double.tryParse(rcData['percentage'].toString())?.toStringAsFixed(2) ?? rcData['percentage']}%' : '—';
    final grade = (rcData['grade'] ?? '—').toString();
    final result = (rcData['result'] ?? 'PASS').toString().toUpperCase();
    final classRank = (rcData['class_rank'] ?? '1').toString().split(' ')[0];
    final attRate = rcData['attendance'] is Map && rcData['attendance']['attendance_rate'] != null
        ? '${double.tryParse(rcData['attendance']['attendance_rate'].toString())?.round() ?? 0}%'
        : '0%';
    final teacherRemark = (rcData['teacher_remark'] ?? rcData['report_card_remark'] ?? '').toString().trim();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF042F2E), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. School Banner (Matching Student Portal Gradient Header)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.teal.shade900, Colors.teal.shade800],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.shade400.withOpacity(0.4)),
            ),
            child: Row(
              children: [
                if (schoolLogo.toString().isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl: schoolLogo.toString(),
                      width: 48,
                      height: 48,
                      fit: BoxFit.contain,
                      errorWidget: (_, __, ___) => _buildSchoolLogoPlaceholder(schoolName),
                    ),
                  )
                else
                  _buildSchoolLogoPlaceholder(schoolName),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        schoolName,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Colors.amber.shade300,
                          letterSpacing: 0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (schoolAddress.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          schoolAddress,
                          style: TextStyle(fontSize: 9.5, color: Colors.teal.shade50, fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade400,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '$examName REPORT CARD',
                              style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Session: $ayName',
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white70),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2. Student Details Grid (3 columns x 2 rows)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: _buildReportCardDetailCell('STUDENT NAME', studentName, isBold: true)),
                    Expanded(child: _buildReportCardDetailCell("FATHER'S NAME", fatherName, isBold: true)),
                    Expanded(child: _buildReportCardDetailCell("MOTHER'S NAME", motherName, isBold: true)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: _buildReportCardDetailCell('CLASS & SECTION', className, isBold: true)),
                    Expanded(child: _buildReportCardDetailCell('ROLL / SR NO', '$rollNo | $admissionNo', isBold: true)),
                    Expanded(child: _buildReportCardDetailCell('DATE OF BIRTH', dob, isBold: true)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 3. Scholastic Performance Marks Table
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF042F2E)),
            ),
            child: Column(
              children: [
                // Table Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                  decoration: const BoxDecoration(
                    color: Color(0xFF042F2E),
                    borderRadius: BorderRadius.only(topLeft: Radius.circular(7), topRight: Radius.circular(7)),
                  ),
                  child: const Row(
                    children: [
                      Expanded(flex: 3, child: Text('SUBJECT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                      Expanded(flex: 2, child: Text('OBTAINED', textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                      Expanded(flex: 2, child: Text('MAX', textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                      Expanded(flex: 2, child: Text('PASS', textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                      Expanded(flex: 2, child: Text('GRADE', textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                      Expanded(flex: 2, child: Text('RESULT', textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white))),
                    ],
                  ),
                ),
                // Subject Rows
                ...subjects.map((sub) {
                  final String sName = (sub['subject_name'] ?? '').toString();
                  final bool isGrade = _isGradeSubject(sub);
                  final String maxM = isGrade ? 'GRADE' : _formatMarkValue(sub['max_marks'], defaultVal: '—');
                  final String passM = isGrade ? 'C' : _formatMarkValue(sub['passing_marks'], defaultVal: '—');
                  final String obt = isGrade
                      ? ((sub['marks_obtained'] ?? '').toString().isNotEmpty ? sub['marks_obtained'].toString() : (sub['grade'] ?? 'A').toString())
                      : _formatMarksNumber(sub['marks_obtained']);
                  final String subGrade = (sub['grade'] ?? '—').toString();
                  final String subRes = (sub['result'] ?? 'PASS').toString().toUpperCase();
                  final bool isFail = subRes == 'FAIL';

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                    ),
                    child: Row(
                      children: [
                        Expanded(flex: 3, child: Text(sName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)))),
                        Expanded(flex: 2, child: Text(obt, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: isFail ? Colors.red.shade700 : const Color(0xFF042F2E)))),
                        Expanded(flex: 2, child: Text(maxM, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Color(0xFF334155)))),
                        Expanded(flex: 2, child: Text(passM, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
                        Expanded(flex: 2, child: Text(subGrade, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isFail ? Colors.red.shade700 : const Color(0xFF042F2E)))),
                        Expanded(
                          flex: 2,
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: isFail ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                subRes,
                                style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: isFail ? const Color(0xFF991B1B) : const Color(0xFF166534)),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                // Total Marks Row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade50,
                    borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(7), bottomRight: Radius.circular(7)),
                    border: Border(top: BorderSide(color: Colors.teal.shade900, width: 1.5)),
                  ),
                  child: Row(
                    children: [
                      const Expanded(flex: 3, child: Text('Grand Total', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)))),
                      Expanded(flex: 2, child: Text(totalObtained, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)))),
                      Expanded(flex: 2, child: Text(totalMax, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)))),
                      const Expanded(flex: 2, child: Text('—', textAlign: TextAlign.center, style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B)))),
                      Expanded(flex: 2, child: Text(grade, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)))),
                      Expanded(
                        flex: 2,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: result == 'PASS' ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              result,
                              style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: result == 'PASS' ? const Color(0xFF166534) : const Color(0xFF991B1B)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 4. Performance Summary Cards (Row of 5)
          Row(
            children: [
              Expanded(child: _buildReportCardSummaryCard('TOTAL MARKS', '$totalObtained / $totalMax', Colors.teal.shade50, const Color(0xFF042F2E))),
              const SizedBox(width: 4),
              Expanded(child: _buildReportCardSummaryCard('PERCENTAGE', percentage, Colors.amber.shade50, const Color(0xFF78350F))),
              const SizedBox(width: 4),
              Expanded(child: _buildReportCardSummaryCard('OVERALL GRADE', 'Grade $grade', Colors.teal.shade50, const Color(0xFF042F2E))),
              const SizedBox(width: 4),
              Expanded(child: _buildReportCardSummaryCard('ATTENDANCE', attRate, Colors.amber.shade50, const Color(0xFF78350F))),
              const SizedBox(width: 4),
              Expanded(child: _buildReportCardSummaryCard('CLASS RANK', '#$classRank', Colors.teal.shade50, const Color(0xFF042F2E))),
            ],
          ),
          const SizedBox(height: 12),

          // 5. Teacher Remarks (if available)
          if (teacherRemark.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 11, color: Color(0xFF0F172A)),
                  children: [
                    const TextSpan(text: 'Teacher Remarks: ', style: TextStyle(fontWeight: FontWeight.bold)),
                    TextSpan(text: teacherRemark, style: const TextStyle(fontStyle: FontStyle.italic)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // 6. Dual Signatures
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  children: [
                    Container(width: 110, height: 1, color: Colors.grey.shade500),
                    const SizedBox(height: 4),
                    const Text('CLASS TEACHER SIGNATURE', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                  ],
                ),
                Column(
                  children: [
                    Container(width: 110, height: 1, color: Colors.grey.shade500),
                    const SizedBox(height: 4),
                    const Text('PRINCIPAL SIGNATURE & STAMP', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSchoolLogoPlaceholder(String schoolName) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: Colors.amber.shade400,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Text(
          schoolName.isNotEmpty ? schoolName[0] : 'S',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
        ),
      ),
    );
  }

  Widget _buildReportCardDetailCell(String label, String value, {bool isBold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.bold, color: Colors.grey.shade600)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: isBold ? 10.5 : 9.5,
            fontWeight: isBold ? FontWeight.w900 : FontWeight.bold,
            color: const Color(0xFF0F172A),
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildReportCardSummaryCard(String label, String value, Color bg, Color textCol) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: textCol.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 6.5, fontWeight: FontWeight.bold, color: textCol)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: textCol)),
        ],
      ),
    );
  }

  Widget _buildReportCardMetricChip({required String label, required String value, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 9.5),
          children: [
            TextSpan(text: '$label: ', style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}


// ============================================================================
// EXAMINATION CONFIGURATION SCREEN (GRADE CONFIGURATION SCALE)
// Note: "Report card templates" are managed exclusively on the web portal.
// ============================================================================

class ExaminationConfigurationScreen extends StatefulWidget {
  final SchoolExaminationService examService;
  final List<dynamic>? classes;
  final List<dynamic>? exams;
  final List<dynamic>? subjects;
  final Map<String, dynamic>? schoolProfile;
  final List<dynamic> gradeScales;

  const ExaminationConfigurationScreen({
    super.key,
    required this.examService,
    this.classes,
    this.exams,
    this.subjects,
    this.schoolProfile,
    this.gradeScales = const [],
  });

  @override
  State<ExaminationConfigurationScreen> createState() => _ExaminationConfigurationScreenState();
}

typedef ExaminationSettingsScreen = ExaminationConfigurationScreen;

class _GradeScaleItem {
  final TextEditingController gradeCtrl;
  final TextEditingController minCtrl;
  final TextEditingController maxCtrl;
  final TextEditingController remarkCtrl;
  int gradePoint;

  _GradeScaleItem({
    required String grade,
    required double minPct,
    required double maxPct,
    required String remark,
    this.gradePoint = 0,
  })  : gradeCtrl = TextEditingController(text: grade),
        minCtrl = TextEditingController(text: minPct.toStringAsFixed(minPct.truncateToDouble() == minPct ? 0 : 2)),
        maxCtrl = TextEditingController(text: maxPct.toStringAsFixed(maxPct.truncateToDouble() == maxPct ? 0 : 2)),
        remarkCtrl = TextEditingController(text: remark);

  void dispose() {
    gradeCtrl.dispose();
    minCtrl.dispose();
    maxCtrl.dispose();
    remarkCtrl.dispose();
  }
}

class _ExaminationConfigurationScreenState extends State<ExaminationConfigurationScreen> {
  final List<_GradeScaleItem> _items = [];
  bool _loading = true;
  bool _saving = false;
  String? _errorMessage;
  String? _successMessage;

  static const List<Map<String, dynamic>> _defaultScales = [
    {
      'grade': 'A',
      'min_percentage': 75.0,
      'max_percentage': 100.0,
      'grade_point': 10,
      'remark': 'It was excellent performance by you really appreciable work you have done.',
    },
    {
      'grade': 'B',
      'min_percentage': 60.0,
      'max_percentage': 74.0,
      'grade_point': 8,
      'remark': 'Good performance in examinations, keep working hard to excel further.',
    },
    {
      'grade': 'C',
      'min_percentage': 40.0,
      'max_percentage': 59.0,
      'grade_point': 6,
      'remark': 'Average performance, needs to pay more attention and practice in studies.',
    },
    {
      'grade': 'D',
      'min_percentage': 0.0,
      'max_percentage': 39.0,
      'grade_point': 0,
      'remark': 'Poor performance, requires immediate attention and improvement.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadGradeConfigurations();
  }

  @override
  void dispose() {
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _populateItems(List<dynamic> list) {
    for (final item in _items) {
      item.dispose();
    }
    _items.clear();

    for (final s in list) {
      final grade = s['grade']?.toString() ?? '';
      final minPct = double.tryParse(s['min_percentage']?.toString() ?? '0') ?? 0.0;
      final maxPct = double.tryParse(s['max_percentage']?.toString() ?? '0') ?? 0.0;
      final remark = s['remark']?.toString() ?? '';
      final gp = int.tryParse(s['grade_point']?.toString() ?? '0') ?? 0;

      _items.add(
        _GradeScaleItem(
          grade: grade,
          minPct: minPct,
          maxPct: maxPct,
          remark: remark,
          gradePoint: gp,
        ),
      );
    }
  }

  Future<void> _loadGradeConfigurations() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final fetched = await widget.examService.getGradeConfigurations();
      final listToUse = (fetched.isNotEmpty)
          ? fetched
          : (widget.gradeScales.isNotEmpty ? widget.gradeScales : _defaultScales);
      _populateItems(listToUse);
    } catch (_) {
      final fallback = widget.gradeScales.isNotEmpty ? widget.gradeScales : _defaultScales;
      _populateItems(fallback);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _addGradeRow() {
    setState(() {
      _errorMessage = null;
      _successMessage = null;
      _items.add(
        _GradeScaleItem(
          grade: '',
          minPct: 0,
          maxPct: 0,
          remark: '',
          gradePoint: 0,
        ),
      );
    });
  }

  void _removeGradeRow(int index) {
    if (index < 0 || index >= _items.length) return;
    setState(() {
      _errorMessage = null;
      _successMessage = null;
      final removed = _items.removeAt(index);
      removed.dispose();
    });
  }

  void _resetToDefaults() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset to Defaults?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text(
          'This will reset the grading configuration scale to the 4 standard CBSE ranges (A, B, C, D). Any unsaved custom ranges will be replaced.',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _populateItems(_defaultScales);
                _errorMessage = null;
                _successMessage = 'Reset to default grading scales. Click "Save Grading Scale" to persist changes.';
              });
            },
            child: const Text('Reset', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _saveGradingScale() async {
    setState(() {
      _errorMessage = null;
      _successMessage = null;
    });

    if (_items.isEmpty) {
      setState(() => _errorMessage = 'Please add at least one grade row before saving.');
      return;
    }

    // 1. Validate Grade Codes and Range numbers
    for (int i = 0; i < _items.length; i++) {
      final row = _items[i];
      final grade = row.gradeCtrl.text.trim();
      if (grade.isEmpty) {
        setState(() => _errorMessage = 'Row ${i + 1}: Grade Code cannot be empty.');
        return;
      }
      final minVal = double.tryParse(row.minCtrl.text.trim());
      final maxVal = double.tryParse(row.maxCtrl.text.trim());
      if (minVal == null || maxVal == null) {
        setState(() => _errorMessage = 'Grade $grade: Please enter valid numbers for Min and Max percentage.');
        return;
      }
      if (minVal < 0 || maxVal < 0 || minVal > 100 || maxVal > 100) {
        setState(() => _errorMessage = 'Grade $grade: Percentage values must be between 0 and 100.');
        return;
      }
      if (maxVal < minVal) {
        setState(() => _errorMessage = 'Grade $grade: Max percentage cannot be less than Min percentage.');
        return;
      }
    }

    // 2. Validate Overlapping Ranges
    for (int i = 0; i < _items.length; i++) {
      final r1 = _items[i];
      final g1 = r1.gradeCtrl.text.trim().toUpperCase();
      final min1 = double.parse(r1.minCtrl.text.trim());
      final max1 = double.parse(r1.maxCtrl.text.trim());

      for (int j = i + 1; j < _items.length; j++) {
        final r2 = _items[j];
        final g2 = r2.gradeCtrl.text.trim().toUpperCase();
        final min2 = double.parse(r2.minCtrl.text.trim());
        final max2 = double.parse(r2.maxCtrl.text.trim());

        if (min1 <= max2 && min2 <= max1) {
          setState(() => _errorMessage = 'Overlapping ranges detected between Grade $g1 ($min1% - $max1%) and Grade $g2 ($min2% - $max2%).');
          return;
        }
      }
    }

    setState(() => _saving = true);

    try {
      final payload = _items.map<Map<String, dynamic>>((row) {
        return {
          'grade': row.gradeCtrl.text.trim().toUpperCase(),
          'min_percentage': double.parse(row.minCtrl.text.trim()),
          'max_percentage': double.parse(row.maxCtrl.text.trim()),
          'grade_point': row.gradePoint,
          'remark': row.remarkCtrl.text.trim(),
        };
      }).toList();

      await widget.examService.saveGradeConfigurations(payload);
      final fresh = await widget.examService.getGradeConfigurations();
      if (fresh.isNotEmpty) {
        _populateItems(fresh);
      }

      setState(() {
        _saving = false;
        _successMessage = 'Grading configurations saved successfully.';
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Grading configurations saved successfully.', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _saving = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage ?? 'Failed to save grading configurations.'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  Widget _buildGradeConfigurationTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Icon(Icons.tune_rounded, color: Color(0xFFD97706), size: 22),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'GRADE CONFIGURATION SCALE',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            letterSpacing: 0.3,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Configure grade scale ranges to automatically calculate marks grades.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _resetToDefaults,
                      icon: const Icon(Icons.restore_rounded, size: 16, color: Color(0xFF64748B)),
                      label: const Text('Reset to Defaults', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF334155))),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _addGradeRow,
                      icon: const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                      label: const Text('Add Grade Row', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        if (_errorMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFECACA)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                  ),
                ),
              ],
            ),
          ),
        ],

        if (_successMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _successMessage!,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF166534)),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 14),

        // Grade Rows List
        if (_items.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                Icon(Icons.format_list_bulleted_rounded, size: 40, color: Colors.grey.shade400),
                const SizedBox(height: 10),
                const Text(
                  'No Grade Scales Configured',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF334155)),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Click "Reset to Defaults" to populate standard CBSE ranges.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          )
        else
          ..._items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 6, offset: const Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Row 1: Index Badge, Grade Code, Delete
                  Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFFBEB),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${idx + 1}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFFD97706)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'GRADE CODE',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF475569)),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 70,
                        height: 38,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        alignment: Alignment.center,
                        child: TextField(
                          controller: item.gradeCtrl,
                          textAlign: TextAlign.center,
                          textCapitalization: TextCapitalization.characters,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFFD97706)),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                            isDense: true,
                          ),
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 20),
                        tooltip: 'Remove Row',
                        onPressed: () => _removeGradeRow(idx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Row 2: Min % and Max %
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'MIN %',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 44,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: TextField(
                                controller: item.minCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 12),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'MAX %',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 44,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: TextField(
                                controller: item.maxCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 12),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Row 3: Teacher Remark
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'TEACHER REMARK',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          controller: item.remarkCtrl,
                          maxLines: 2,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            hintText: 'Enter auto-populated remark for this grade...',
                            hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 80),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF8F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'CONFIGURATION',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w800,
            fontSize: 16,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Reset to Defaults',
            icon: const Icon(Icons.restore_rounded, color: Color(0xFFD97706)),
            onPressed: _resetToDefaults,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
          : _buildGradeConfigurationTab(),
      bottomNavigationBar: (!_loading)
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 10,
                    offset: const Offset(0, -3),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _saveGradingScale,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.save_rounded, color: Colors.white, size: 20),
                    label: Text(
                      _saving ? 'Saving Grading Scale...' : 'Save Grading Scale',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
            )
          : null,
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
