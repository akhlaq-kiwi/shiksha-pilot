import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:school_hub/screens/question_paper_designer_screen.dart';
import 'package:school_hub/services/leave_service.dart';
import 'package:school_hub/services/notification_helper.dart';
import 'package:school_hub/services/school_examination_service.dart';
import 'package:school_hub/utils/class_formatter.dart';

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

  // Timetable view states
  List<dynamic> _timetablePapers = [];
  bool _loadingTimetable = false;
  bool _isSchemePublished = false;

  // Marks Spreadsheet view states
  int? _selectedSubjectId;
  Map<String, dynamic>? _marksSheetData;
  bool _loadingMarks = false;
  final Map<int, TextEditingController> _markControllers = {};
  final Map<int, TextEditingController> _remarkControllers = {};
  final Map<int, bool> _absentStates = {};
  final Set<int> _savingMarkStudentIds = {};

  // Report Cards view states
  List<dynamic> _reportCards = [];
  bool _loadingReportCards = false;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  @override
  void dispose() {
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

      // Default to first class if available
      String? defaultClassId;
      if (statuses.isNotEmpty) {
        defaultClassId = (statuses.first['class_id'] ?? statuses.first['id'])?.toString();
      } else if (_classes.isNotEmpty) {
        defaultClassId = (_classes.first['id'] ?? _classes.first['class_id'])?.toString();
      }

      setState(() {
        _examClassStatuses = statuses;
        _selectedClassId = defaultClassId;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  // --------------------------------------------------------------------------
  // TIMETABLE ACTIONS
  // --------------------------------------------------------------------------

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
      final isPub = data['scheme_published'] == 1 || data['scheme_published'] == true;

      setState(() {
        _timetablePapers = papers;
        _isSchemePublished = isPub;
        _loadingTimetable = false;
      });
    } catch (e) {
      setState(() {
        _loadingTimetable = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading timetable: $e')),
      );
    }
  }

  Future<void> _toggleSchemePublish() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    setState(() => _loadingTimetable = true);
    try {
      if (_isSchemePublished) {
        await widget.examService.unpublishExamScheme(examId, classId);
        setState(() => _isSchemePublished = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Examination scheme reverted to Draft.')),
        );
      } else {
        await widget.examService.publishExamScheme(examId, classId);
        setState(() => _isSchemePublished = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Examination scheme published successfully!')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    } finally {
      setState(() => _loadingTimetable = false);
    }
  }

  Future<void> _showAddPaperDialog() async {
    int? selectedSubId = _subjects.isNotEmpty ? int.tryParse(_subjects.first['id'].toString()) : null;
    final dateCtrl = TextEditingController(text: _selectedExam?['start_date'] ?? _getTodayDateStr());
    final startTimeCtrl = TextEditingController(text: '09:00');
    final endTimeCtrl = TextEditingController(text: '11:00');
    final maxMarksCtrl = TextEditingController(text: _selectedExam?['max_marks']?.toString() ?? '100');
    final passMarksCtrl = TextEditingController(text: '40');
    final roomCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDlgState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text(
                'Schedule Exam Paper',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<int>(
                      value: selectedSubId,
                      decoration: const InputDecoration(labelText: 'Subject', border: OutlineInputBorder()),
                      items: _subjects.map<DropdownMenuItem<int>>((s) {
                        return DropdownMenuItem<int>(
                          value: int.tryParse(s['id'].toString()),
                          child: Text(s['name'] ?? ''),
                        );
                      }).toList(),
                      onChanged: (val) => setDlgState(() => selectedSubId = val),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: dateCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Exam Date (YYYY-MM-DD)',
                        border: OutlineInputBorder(),
                        suffixIcon: Icon(Icons.calendar_today_rounded),
                      ),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.tryParse(dateCtrl.text) ?? DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (picked != null) {
                          dateCtrl.text = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: startTimeCtrl,
                            decoration: const InputDecoration(labelText: 'Start Time', border: OutlineInputBorder()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: endTimeCtrl,
                            decoration: const InputDecoration(labelText: 'End Time', border: OutlineInputBorder()),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: maxMarksCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Max Marks', border: OutlineInputBorder()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: passMarksCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Passing Marks', border: OutlineInputBorder()),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: roomCtrl,
                      decoration: const InputDecoration(labelText: 'Room (Optional)', border: OutlineInputBorder()),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC25E00),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () async {
                    if (selectedSubId == null) return;
                    Navigator.pop(ctx);
                    final examId = int.parse(_selectedExam!['id'].toString());
                    final classId = int.parse(_selectedClassId!);

                    final updatedPapers = List<Map<String, dynamic>>.from(
                      _timetablePapers.map((p) => Map<String, dynamic>.from(p)),
                    );

                    updatedPapers.add({
                      'subject_id': selectedSubId,
                      'exam_date': dateCtrl.text.trim(),
                      'start_time': startTimeCtrl.text.trim(),
                      'end_time': endTimeCtrl.text.trim(),
                      'evaluation_type': 'marks',
                      'grading_scale': 'A,B,C,D,E',
                      'max_marks': maxMarksCtrl.text.trim(),
                      'passing_marks': passMarksCtrl.text.trim(),
                      'room': roomCtrl.text.trim(),
                    });

                    setState(() => _loadingTimetable = true);
                    try {
                      await widget.examService.saveExamTimetable(examId, classId, updatedPapers);
                      await _openTimetable();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Exam paper scheduled successfully!')),
                      );
                    } catch (e) {
                      setState(() => _loadingTimetable = false);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                      );
                    }
                  },
                  child: const Text('Add Paper'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _deletePaper(int index) async {
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    final updated = List<Map<String, dynamic>>.from(_timetablePapers.map((p) => Map<String, dynamic>.from(p)));
    updated.removeAt(index);

    setState(() => _loadingTimetable = true);
    try {
      await widget.examService.saveExamTimetable(examId, classId, updated);
      await _openTimetable();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paper removed successfully.')),
      );
    } catch (e) {
      setState(() => _loadingTimetable = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  // --------------------------------------------------------------------------
  // MARKS SPREADSHEET ACTIONS
  // --------------------------------------------------------------------------

  Future<void> _openMarksEntry() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    setState(() {
      _activeView = 'marks';
      _loadingMarks = true;
    });

    try {
      final examId = int.parse(_selectedExam!['id'].toString());
      final classId = int.parse(_selectedClassId!);

      // Load timetable to get subjects list
      final ttData = await widget.examService.getExamTimetable(examId, classId);
      final papers = (ttData['papers'] as List<dynamic>?) ?? [];

      int? firstSubId;
      if (papers.isNotEmpty) {
        firstSubId = int.tryParse(papers.first['subject_id']?.toString() ?? '');
      } else if (_subjects.isNotEmpty) {
        firstSubId = int.tryParse(_subjects.first['id']?.toString() ?? '');
      }

      if (_subjects.isEmpty) {
        try {
          _subjects = await widget.examService.getSubjects();
        } catch (_) {}
      }
      _selectedSubjectId = firstSubId;

      if (_selectedSubjectId != null) {
        await _fetchMarksSheet(examId, classId, _selectedSubjectId!);
      } else {
        setState(() => _loadingMarks = false);
      }
    } catch (e) {
      setState(() => _loadingMarks = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading marks entry: $e')),
      );
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load marks sheet: $e')),
      );
    }
  }

  Future<void> _saveStudentMark(int studentId) async {
    if (_selectedExam == null || _selectedClassId == null || _selectedSubjectId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    final markText = _markControllers[studentId]?.text.trim() ?? '';
    final remarkText = _remarkControllers[studentId]?.text.trim() ?? '';
    final isAbsent = _absentStates[studentId] ?? false;

    setState(() => _savingMarkStudentIds.add(studentId));

    try {
      await widget.examService.saveExamMark(examId, {
        'student_id': studentId,
        'class_id': classId,
        'subject_id': _selectedSubjectId,
        'marks_obtained': isAbsent ? null : (markText.isEmpty ? null : markText),
        'is_absent': isAbsent ? 1 : 0,
        'remarks': remarkText,
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving mark: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _savingMarkStudentIds.remove(studentId));
      }
    }
  }

  // --------------------------------------------------------------------------
  // REPORT CARDS ACTIONS
  // --------------------------------------------------------------------------

  Future<void> _openReportCards() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    setState(() {
      _activeView = 'reports';
      _loadingReportCards = true;
    });

    try {
      final examId = int.parse(_selectedExam!['id'].toString());
      final classId = int.parse(_selectedClassId!);
      final list = await widget.examService.getReportCards(examId, classId);

      setState(() {
        _reportCards = list;
        _loadingReportCards = false;
      });
    } catch (e) {
      setState(() => _loadingReportCards = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading report cards: $e')),
      );
    }
  }

  Future<void> _downloadReportCardPdf(Map<String, dynamic> card) async {
    try {
      final pdf = pw.Document();
      final studentName = card['student_name'] ?? 'Student';
      final rollNo = card['roll_no']?.toString() ?? '—';
      final subjects = (card['subjects'] as List<dynamic>?) ?? [];
      final totalMarks = card['total_marks']?.toString() ?? '—';
      final maxMarks = card['max_marks']?.toString() ?? '—';
      final percentage = card['percentage']?.toString() ?? '—';
      final grade = card['grade']?.toString() ?? '—';
      final rank = card['class_rank']?.toString() ?? '—';

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (pw.Context ctx) {
            return pw.Container(
              padding: const pw.EdgeInsets.all(24),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Center(
                    child: pw.Text(
                      _schoolProfile?['school_name']?.toString().toUpperCase() ?? 'REPORT CARD',
                      style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Center(
                    child: pw.Text(
                      _selectedExam?['name']?.toString().toUpperCase() ?? 'EXAMINATION REPORT',
                      style: const pw.TextStyle(fontSize: 14),
                    ),
                  ),
                  pw.SizedBox(height: 16),
                  pw.Divider(),
                  pw.SizedBox(height: 10),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Student Name: $studentName', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      pw.Text('Roll No: $rollNo'),
                    ],
                  ),
                  pw.SizedBox(height: 14),
                  pw.TableHelper.fromTextArray(
                    headers: ['Subject', 'Max Marks', 'Marks Obtained', 'Grade'],
                    data: subjects.map((sub) {
                      return [
                        sub['subject_name'] ?? 'Subject',
                        sub['max_marks']?.toString() ?? '—',
                        sub['marks_obtained']?.toString() ?? (sub['is_absent'] == 1 ? 'ABS' : '—'),
                        sub['grade']?.toString() ?? '—',
                      ];
                    }).toList(),
                  ),
                  pw.SizedBox(height: 16),
                  pw.Divider(),
                  pw.SizedBox(height: 8),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('Total: $totalMarks / $maxMarks', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      pw.Text('Percentage: $percentage%', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      pw.Text('Grade: $grade', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                      pw.Text('Class Rank: $rank', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    ],
                  ),
                  if (_schoolProfile?['report_card_remark'] != null &&
                      _schoolProfile!['report_card_remark'].toString().trim().isNotEmpty) ...[
                    pw.SizedBox(height: 16),
                    pw.Text('Principal Remark:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 4),
                    pw.Text(_schoolProfile!['report_card_remark'].toString(), style: const pw.TextStyle(fontSize: 11)),
                  ]
                ],
              ),
            );
          },
        ),
      );

      final pdfBytes = await pdf.save();
      final filename = 'Report_Card_${studentName.replaceAll(RegExp(r'\s+'), '_')}.pdf';

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
        title: 'Report Card Downloaded',
        fileName: filename,
        bytes: pdfBytes,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$filename downloaded successfully!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to download report card: $e')),
      );
    }
  }

  // --------------------------------------------------------------------------
  // RESULT PUBLISH STATUS TOGGLE
  // --------------------------------------------------------------------------

  Future<void> _toggleClassResultPublish() async {
    if (_selectedExam == null || _selectedClassId == null) return;
    final examId = int.parse(_selectedExam!['id'].toString());
    final classId = int.parse(_selectedClassId!);

    final currentClassStatus = _examClassStatuses.firstWhere(
      (c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId,
      orElse: () => null,
    );

    final isPublished = currentClassStatus?['status'] == 'Published';
    final targetStatus = isPublished ? 'Draft' : 'Published';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isPublished ? 'Unpublish Results?' : 'Publish Examination Results?'),
        content: Text(
          isPublished
              ? 'Are you sure you want to revert these results back to Draft? Students will no longer see their result cards.'
              : 'Are you sure you want to publish these examination results? Students and parents will be able to view their report cards.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isPublished ? Colors.red : Colors.green,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isPublished ? 'Unpublish' : 'Publish'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await widget.examService.publishExamResults(examId, classId, status: targetStatus);
      // Reload class statuses
      final statuses = await widget.examService.getExamClassStatuses(examId);
      setState(() {
        _examClassStatuses = statuses;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Results status updated to $targetStatus successfully!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  // --------------------------------------------------------------------------
  // TOP ACTION 1: FINAL ACADEMIC REPORT CARD MODAL
  // --------------------------------------------------------------------------

  Future<void> _showFinalAcademicReportCardModal() async {
    String? pickedClassId = _classes.isNotEmpty ? _classes.first['id']?.toString() : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.7,
              decoration: const BoxDecoration(
                color: Color(0xFFFAF7F2),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFC25E00).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.workspace_premium_outlined, color: Color(0xFFC25E00), size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'FINAL ACADEMIC REPORT CARD',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Cumulative session report cards for all terminal examinations',
                              style: TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const Text('SELECT CLASS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: pickedClassId,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                    ),
                    items: _classes.map<DropdownMenuItem<String>>((c) {
                      return DropdownMenuItem<String>(
                        value: c['id']?.toString(),
                        child: Text(formatShortClassName(c['name'], section: c['section'])),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => pickedClassId = val),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline_rounded, color: Colors.amber.shade800, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Generates the consolidated annual report card calculating Term 1, Term 2 and Final assessments based on school grading policy.',
                            style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFC25E00),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.download_rounded),
                      label: const Text('Download Session Cumulative Cards', style: TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: () {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Generating cumulative session report cards...')),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // TOP ACTION 2: REPORT CARD TEMPLATES MODAL
  // --------------------------------------------------------------------------

  Future<void> _showTemplatesModal() async {
    final themes = [
      {'key': 'ocean_teal', 'name': 'Ocean Teal', 'color': const Color(0xFF0D9488)},
      {'key': 'classic', 'name': 'Classic Maroon', 'color': const Color(0xFF881337)},
      {'key': 'modern_royal', 'name': 'Modern Royal', 'color': const Color(0xFF1E3A8A)},
      {'key': 'vibrant_ruby', 'name': 'Vibrant Ruby', 'color': const Color(0xFFBE123C)},
      {'key': 'minimal_slate', 'name': 'Minimal Slate', 'color': const Color(0xFF334155)},
      {'key': 'vintage_gold', 'name': 'Vintage Gold', 'color': const Color(0xFFB45309)},
    ];

    String activeKey = _schoolProfile?['report_card_color_theme'] ?? 'ocean_teal';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              decoration: const BoxDecoration(
                color: Color(0xFFFAF7F2),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFC25E00).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.palette_outlined, color: Color(0xFFC25E00), size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'REPORT CARD TEMPLATES',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Select professional color styling theme for generated report cards',
                              style: TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Expanded(
                    child: GridView.builder(
                      itemCount: themes.length,
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.3,
                      ),
                      itemBuilder: (context, idx) {
                        final t = themes[idx];
                        final isSelected = activeKey == t['key'];
                        final color = t['color'] as Color;

                        return InkWell(
                          onTap: () async {
                            setModalState(() => activeKey = t['key'] as String);
                            try {
                              await widget.examService.updateSchoolProfile({'report_card_color_theme': t['key']});
                              setState(() {
                                _schoolProfile?['report_card_color_theme'] = t['key'];
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Template theme updated to ${t['name']}!')),
                              );
                            } catch (e) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to update theme: $e')),
                              );
                            }
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected ? const Color(0xFFC25E00) : Colors.grey.shade200,
                                width: isSelected ? 2.5 : 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.03),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        color: color,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const Spacer(),
                                    if (isSelected)
                                      const Icon(Icons.check_circle_rounded, color: Color(0xFFC25E00), size: 20),
                                  ],
                                ),
                                const Spacer(),
                                Text(
                                  t['name'] as String,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                ),
                                Text(
                                  isSelected ? 'Active Theme' : 'Tap to apply',
                                  style: TextStyle(fontSize: 11, color: isSelected ? const Color(0xFFC25E00) : Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // TOP ACTION 3: GRADE CONFIGURATION SCALE MODAL
  // --------------------------------------------------------------------------

  Future<void> _showGradeConfigurationsModal() async {
    if (_gradeScales.isEmpty) {
      try {
        _gradeScales = await widget.examService.getGradeConfigurations();
      } catch (_) {}
    }
    final List<Map<String, dynamic>> scales = List<Map<String, dynamic>>.from(
      _gradeScales.map((s) => Map<String, dynamic>.from(s)),
    );

    final remarkCtrl = TextEditingController(text: _schoolProfile?['report_card_remark'] ?? '');

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: const BoxDecoration(
                color: Color(0xFFFAF7F2),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFC25E00).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.format_list_numbered_rounded, color: Color(0xFFC25E00), size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'GRADE CONFIGURATION SCALE',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Percentage thresholds, grades, points, and remarks',
                              style: TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFC25E00),
                          side: const BorderSide(color: Color(0xFFC25E00)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        icon: const Icon(Icons.add_rounded, size: 16),
                        label: const Text('Add Row', style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          setModalState(() {
                            scales.add({
                              'min_percentage': 0,
                              'max_percentage': 0,
                              'grade': '',
                              'grade_point': 0,
                              'remark': '',
                            });
                          });
                        },
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.grey.shade700,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Reset Defaults', style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          setModalState(() {
                            scales.clear();
                            scales.addAll([
                              {'min_percentage': 75, 'max_percentage': 100, 'grade': 'A', 'grade_point': 10, 'remark': 'Excellent performance.'},
                              {'min_percentage': 60, 'max_percentage': 74, 'grade': 'B', 'grade_point': 8, 'remark': 'Good performance, keep working hard.'},
                              {'min_percentage': 40, 'max_percentage': 59, 'grade': 'C', 'grade_point': 6, 'remark': 'Average performance, needs more practice.'},
                              {'min_percentage': 0, 'max_percentage': 39, 'grade': 'D', 'grade_point': 0, 'remark': 'Needs immediate attention and improvement.'},
                            ]);
                          });
                        },
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.rate_review_outlined, color: Color(0xFFC25E00)),
                        tooltip: 'Edit Principal Remark',
                        onPressed: () async {
                          await showDialog(
                            context: context,
                            builder: (dCtx) => AlertDialog(
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              title: const Text('Principal Report Card Remark', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              content: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Maximum 12 words shown on student report cards.', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: remarkCtrl,
                                    maxLines: 3,
                                    decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'e.g. Keep up the good work and strive for excellence!'),
                                  ),
                                ],
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(dCtx), child: const Text('Cancel')),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFC25E00), foregroundColor: Colors.white),
                                  onPressed: () async {
                                    final words = remarkCtrl.text.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
                                    if (words > 12) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Remark cannot exceed 12 words!')),
                                      );
                                      return;
                                    }
                                    Navigator.pop(dCtx);
                                    await widget.examService.updateSchoolProfile({'report_card_remark': remarkCtrl.text.trim()});
                                    setState(() {
                                      _schoolProfile?['report_card_remark'] = remarkCtrl.text.trim();
                                    });
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Principal remark saved successfully!')),
                                    );
                                  },
                                  child: const Text('Save Remark'),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: ListView.separated(
                      itemCount: scales.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final s = scales[idx];
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    flex: 2,
                                    child: TextFormField(
                                      initialValue: s['grade']?.toString() ?? '',
                                      decoration: const InputDecoration(labelText: 'Grade', isDense: true, border: OutlineInputBorder()),
                                      onChanged: (val) => s['grade'] = val,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    flex: 2,
                                    child: TextFormField(
                                      initialValue: s['min_percentage']?.toString() ?? '',
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(labelText: 'Min %', isDense: true, border: OutlineInputBorder()),
                                      onChanged: (val) => s['min_percentage'] = double.tryParse(val) ?? 0,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    flex: 2,
                                    child: TextFormField(
                                      initialValue: s['max_percentage']?.toString() ?? '',
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(labelText: 'Max %', isDense: true, border: OutlineInputBorder()),
                                      onChanged: (val) => s['max_percentage'] = double.tryParse(val) ?? 0,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                                    onPressed: () => setModalState(() => scales.removeAt(idx)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              TextFormField(
                                initialValue: s['remark']?.toString() ?? '',
                                decoration: const InputDecoration(labelText: 'Remark', isDense: true, border: OutlineInputBorder()),
                                onChanged: (val) => s['remark'] = val,
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFC25E00),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () async {
                        try {
                          await widget.examService.saveGradeConfigurations(scales);
                          setState(() => _gradeScales = scales);
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Grade configuration saved successfully!')),
                          );
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed to save grades: $e')),
                          );
                        }
                      },
                      child: const Text('Save Grade Scale', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

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
          }
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFAF7F2),
        appBar: AppBar(
          backgroundColor: const Color(0xFFFAF7F2),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
            onPressed: () {
              if (_activeView == 'dashboard') {
                Navigator.pop(context);
              } else if (_activeView == 'classes') {
                setState(() => _activeView = 'dashboard');
              } else {
                setState(() => _activeView = 'classes');
              }
            },
          ),
          title: Text(
            _activeView == 'dashboard'
                ? 'EXAMINATIONS'
                : _activeView == 'classes'
                    ? 'Class-wise Exam Management'
                    : _activeView == 'timetable'
                        ? 'Exam Timetable'
                        : _activeView == 'marks'
                            ? 'Marks Spreadsheet'
                            : 'Student Report Cards',
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 0.6,
            ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0F172A)),
              tooltip: 'Refresh',
              onPressed: () {
                if (_activeView == 'dashboard') {
                  _loadDashboardData();
                } else if (_activeView == 'classes') {
                  if (_selectedExam != null) _openClassWorkspace(_selectedExam!, _selectedTerm);
                } else if (_activeView == 'timetable') {
                  _openTimetable();
                } else if (_activeView == 'marks') {
                  _openMarksEntry();
                } else if (_activeView == 'reports') {
                  _openReportCards();
                }
              },
            ),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFFC25E00)))
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
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFC25E00), foregroundColor: Colors.white),
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
      color: const Color(0xFFC25E00),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // 1. Top Three Action Buttons (Matching Screenshot)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildTopActionButton(
                  icon: Icons.military_tech_outlined,
                  label: 'Final Academic Report Card',
                  onTap: _showFinalAcademicReportCardModal,
                ),
                const SizedBox(width: 8),
                _buildTopActionButton(
                  icon: Icons.palette_outlined,
                  label: 'Report Card Templates',
                  onTap: _showTemplatesModal,
                ),
                const SizedBox(width: 8),
                _buildTopActionButton(
                  icon: Icons.format_list_numbered_rounded,
                  label: 'Grade Configuration Scale',
                  onTap: _showGradeConfigurationsModal,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 2. Filter / Stat Cards (5 Cards in Row matching Screenshot)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildStatCard('total', 'TOTAL EXAMS', _getTotalExamsCount(), const Color(0xFF18181B)),
                const SizedBox(width: 8),
                _buildStatCard('upcoming', 'UPCOMING', _getUpcomingCount(), const Color(0xFFC25E00)),
                const SizedBox(width: 8),
                _buildStatCard('ongoing', 'ONGOING', _getOngoingCount(), const Color(0xFFD97706)),
                const SizedBox(width: 8),
                _buildStatCard('draft', 'DRAFT MODE', _getDraftCount(), const Color(0xFF52525B)),
                const SizedBox(width: 8),
                _buildStatCard('published', 'PUBLISHED RESULTS', _getPublishedCount(), const Color(0xFF16A34A)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 3. Terminal Examination Cards
          if (_exams.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
              ),
              child: const Center(
                child: Text('No terminal examinations scheduled for this session.', style: TextStyle(color: Colors.grey)),
              ),
            )
          else
            ..._exams.map((term) => _buildTerminalCard(term)),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildTopActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFC25E00),
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      ),
      icon: Icon(icon, size: 16),
      label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
      onPressed: onTap,
    );
  }

  Widget _buildStatCard(String id, String label, int count, Color numberColor) {
    final bool isActive = _activeFilter == id;

    return InkWell(
      onTap: () => setState(() => _activeFilter = id),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 110,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFFFFF7ED) : const Color(0xFFFFFDF9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? const Color(0xFFC25E00) : const Color(0xFFE5DECF),
            width: isActive ? 2 : 1,
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
          children: [
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 10,
                letterSpacing: 0.5,
                color: isActive ? const Color(0xFFC25E00) : Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              count.toString(),
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: numberColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTerminalCard(dynamic term) {
    final termName = term['name']?.toString().toUpperCase() ?? 'TERMINAL EXAMINATION';
    final List<dynamic> allSubTests = (term['sub_tests'] as List<dynamic>?) ?? [];
    final subTests = allSubTests.where(_matchesFilter).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDF9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5DECF)),
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
                const Icon(Icons.description_outlined, color: Color(0xFFC25E00), size: 20),
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
                  onSelected: (val) {
                    if (val == 'edit') {
                      _showEditExamDialog(term);
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(value: 'edit', child: Text('Edit Terminal')),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE5DECF)),

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
                headingRowColor: WidgetStateProperty.all(const Color(0xFFFBF8F2)),
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
                  final maxM = st['max_marks'] != null && st['max_marks'].toString().isNotEmpty
                      ? '${st['max_marks']} Marks'
                      : '—';

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
                              color: const Color(0xFFC25E00),
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
                      // Max Marks
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
                          onSelected: (action) {
                            if (action == 'edit') {
                              _showEditExamDialog(st);
                            } else if (action == 'workspace') {
                              _openClassWorkspace(st, term);
                            }
                          },
                          itemBuilder: (ctx) => [
                            const PopupMenuItem(value: 'workspace', child: Text('Open Class Workspace')),
                            const PopupMenuItem(value: 'edit', child: Text('Edit Test Details')),
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

  Future<void> _showEditExamDialog(dynamic exam) async {
    final nameCtrl = TextEditingController(text: exam['name'] ?? '');
    final startCtrl = TextEditingController(text: exam['start_date'] ?? '');
    final endCtrl = TextEditingController(text: exam['end_date'] ?? '');
    final maxMarksCtrl = TextEditingController(text: exam['max_marks']?.toString() ?? '');

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Edit ${exam['name'] ?? 'Exam'}'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Examination Name', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(
                controller: startCtrl,
                decoration: const InputDecoration(labelText: 'Start Date (YYYY-MM-DD)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: endCtrl,
                decoration: const InputDecoration(labelText: 'End Date (YYYY-MM-DD)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: maxMarksCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Max Marks', border: OutlineInputBorder()),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFC25E00), foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              final examId = int.parse(exam['id'].toString());
              try {
                await widget.examService.updateExamination(examId, {
                  'name': nameCtrl.text.trim(),
                  'start_date': startCtrl.text.trim(),
                  'end_date': endCtrl.text.trim(),
                  'max_marks': maxMarksCtrl.text.trim().isEmpty ? null : maxMarksCtrl.text.trim(),
                });
                _loadDashboardData();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Examination updated successfully!')),
                );
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to update exam: $e')),
                );
              }
            },
            child: const Text('Save Changes'),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 2: CLASS-WISE EXAMINATION WORKSPACE
  // --------------------------------------------------------------------------

  Widget _buildClassesWorkspaceView() {
    final currentStatusObj = _examClassStatuses.firstWhere(
      (c) => (c['class_id'] ?? c['id'])?.toString() == _selectedClassId,
      orElse: () => null,
    );

    final currentClass = _classes.firstWhere(
      (c) => c['id']?.toString() == _selectedClassId,
      orElse: () => {'name': 'Class'},
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
          '${_selectedExam?['name'] ?? ''} (${_formatDate(_selectedExam?['start_date'])} to ${_formatDate(_selectedExam?['end_date'])})',
          style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 14),

        // Class Selector
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFDF9),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5DECF)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('SELECT CLASS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedClassId,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                ),
                items: _classes.map<DropdownMenuItem<String>>((c) {
                  final cid = c['id']?.toString();
                  final st = _examClassStatuses.firstWhere(
                    (s) => (s['class_id'] ?? s['id'])?.toString() == cid,
                    orElse: () => null,
                  );
                  final stName = st?['status'] ?? 'Draft';

                  return DropdownMenuItem<String>(
                    value: cid,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(formatShortClassName(c['name'], section: c['section']), style: const TextStyle(fontWeight: FontWeight.bold)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: stName == 'Published' ? const Color(0xFFDCFCE7) : const Color(0xFFF4F4F5),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            stName.toUpperCase(),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: stName == 'Published' ? const Color(0xFF16A34A) : const Color(0xFF71717A),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  setState(() => _selectedClassId = val);
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

          // Card 2: Question Paper Designer
          _buildWorkspaceCard(
            icon: Icons.menu_book_rounded,
            title: 'Question Paper Designer',
            subtitle: 'Create professional examination question papers with formatting tools, diagrams, tables, images, and automatic PDF generation.',
            buttonLabel: 'Open Question Paper Designer',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => QuestionPaperDesignerScreen(
                    leaveService: widget.leaveService,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 14),

          // Card 3: Enter Marks
          _buildWorkspaceCard(
            icon: Icons.edit_note_rounded,
            title: 'Enter Marks',
            subtitle: 'Enter and manage subject-wise marks, absent records, and teacher remarks in a real-time auto-saving spreadsheet.',
            buttonLabel: 'Open Marks Entry',
            onTap: _openMarksEntry,
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
              color: const Color(0xFFFFFDF9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5DECF)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.settings_rounded, color: Color(0xFFC25E00), size: 20),
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
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isPublished ? Colors.red.shade700 : const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: Icon(isPublished ? Icons.close_rounded : Icons.check_circle_outline_rounded, size: 18),
                    label: Text(
                      isPublished ? 'Unpublish Results' : 'Publish Results',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    onPressed: _toggleClassResultPublish,
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
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDF9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5DECF)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFFC25E00), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A))),
              ),
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
                backgroundColor: const Color(0xFFC25E00),
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

  // --------------------------------------------------------------------------
  // VIEW 3: TIMETABLE VIEW
  // --------------------------------------------------------------------------

  Widget _buildTimetableView() {
    if (_loadingTimetable) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFC25E00)));
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFC25E00),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Add Exam Paper', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                onPressed: _showAddPaperDialog,
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isSchemePublished ? Colors.amber.shade700 : Colors.green.shade700,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: Icon(_isSchemePublished ? Icons.undo_rounded : Icons.check_circle_rounded, size: 16),
              label: Text(_isSchemePublished ? 'Unpublish Scheme' : 'Publish Scheme', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              onPressed: _toggleSchemePublish,
            ),
          ],
        ),
        const SizedBox(height: 16),

        if (_timetablePapers.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: const Center(
              child: Text('No examination papers scheduled yet. Tap "+ Add Exam Paper" to begin.'),
            ),
          )
        else
          ..._timetablePapers.asMap().entries.map((entry) {
            final idx = entry.key;
            final p = entry.value;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p['subject_name'] ?? 'Subject',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${_formatDate(p['exam_date'])} | ${p['start_time'] ?? ''} - ${p['end_time'] ?? ''}',
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Max Marks: ${p['max_marks'] ?? '100'} | Passing: ${p['passing_marks'] ?? '40'}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
                    onPressed: () => _deletePaper(idx),
                  ),
                ],
              ),
            );
          }).toList(),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 4: MARKS SPREADSHEET VIEW
  // --------------------------------------------------------------------------

  Widget _buildMarksSpreadsheetView() {
    if (_loadingMarks) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFC25E00)));
    }

    final students = (_marksSheetData?['students'] as List<dynamic>?) ?? [];
    final maxMarks = _marksSheetData?['max_marks']?.toString() ?? '100';

    return Column(
      children: [
        // Subject Selector Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: const Color(0xFFFFFDF9),
          child: Row(
            children: [
              const Text('SUBJECT:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey)),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: _selectedSubjectId,
                  decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
                  items: _subjects.map<DropdownMenuItem<int>>((s) {
                    return DropdownMenuItem<int>(
                      value: int.tryParse(s['id'].toString()),
                      child: Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      _selectedSubjectId = val;
                      final examId = int.parse(_selectedExam!['id'].toString());
                      final classId = int.parse(_selectedClassId!);
                      _fetchMarksSheet(examId, classId, val);
                    }
                  },
                ),
              ),
              const SizedBox(width: 8),
              Text('Max: $maxMarks', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFC25E00))),
            ],
          ),
        ),
        const Divider(height: 1),

        // Students Table
        Expanded(
          child: students.isEmpty
              ? const Center(child: Text('No students found in this class.'))
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: students.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final s = students[idx];
                    final stId = int.tryParse(s['student_id']?.toString() ?? s['id']?.toString() ?? '0') ?? 0;
                    final isSaving = _savingMarkStudentIds.contains(stId);
                    final isAbsent = _absentStates[stId] ?? false;

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 14,
                                backgroundColor: const Color(0xFFC25E00).withOpacity(0.1),
                                child: Text(
                                  (s['roll_no']?.toString() ?? '${idx + 1}'),
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFC25E00)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  s['student_name'] ?? s['name'] ?? 'Student',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                              Row(
                                children: [
                                  const Text('ABS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                                  Switch(
                                    value: isAbsent,
                                    activeThumbColor: Colors.red,
                                    onChanged: (val) {
                                      setState(() {
                                        _absentStates[stId] = val;
                                        if (val) {
                                          _markControllers[stId]?.text = '';
                                        }
                                      });
                                      _saveStudentMark(stId);
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  controller: _markControllers[stId],
                                  enabled: !isAbsent,
                                  keyboardType: TextInputType.number,
                                  decoration: InputDecoration(
                                    labelText: 'Marks / $maxMarks',
                                    isDense: true,
                                    border: const OutlineInputBorder(),
                                    suffixIcon: isSaving
                                        ? const SizedBox(
                                            width: 14,
                                            height: 14,
                                            child: Padding(
                                              padding: EdgeInsets.all(10.0),
                                              child: CircularProgressIndicator(strokeWidth: 2),
                                            ),
                                          )
                                        : null,
                                  ),
                                  onFieldSubmitted: (_) => _saveStudentMark(stId),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 3,
                                child: TextFormField(
                                  controller: _remarkControllers[stId],
                                  decoration: const InputDecoration(
                                    labelText: 'Remarks',
                                    isDense: true,
                                    border: OutlineInputBorder(),
                                  ),
                                  onFieldSubmitted: (_) => _saveStudentMark(stId),
                                ),
                              ),
                              const SizedBox(width: 4),
                              IconButton(
                                icon: const Icon(Icons.save_rounded, color: Color(0xFFC25E00)),
                                onPressed: () => _saveStudentMark(stId),
                              ),
                            ],
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
      return const Center(child: CircularProgressIndicator(color: Color(0xFFC25E00)));
    }

    if (_reportCards.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text('No report cards generated yet. Complete marks entry to generate cards.', textAlign: TextAlign.center),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: _reportCards.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, idx) {
        final card = _reportCards[idx];
        final studentName = card['student_name'] ?? 'Student';
        final rollNo = card['roll_no']?.toString() ?? '—';
        final totalMarks = card['total_marks']?.toString() ?? '—';
        final maxMarks = card['max_marks']?.toString() ?? '—';
        final percentage = card['percentage']?.toString() ?? '—';
        final grade = card['grade']?.toString() ?? '—';
        final rank = card['class_rank']?.toString() ?? '—';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFFC25E00).withOpacity(0.1),
                child: Text(
                  rollNo,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFC25E00)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(studentName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(
                      'Score: $totalMarks/$maxMarks | $percentage% | Grade: $grade',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    Text('Rank: #$rank', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFC25E00))),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.download_rounded, color: Color(0xFFC25E00)),
                tooltip: 'Download PDF',
                onPressed: () => _downloadReportCardPdf(card),
              ),
            ],
          ),
        );
      },
    );
  }
}
