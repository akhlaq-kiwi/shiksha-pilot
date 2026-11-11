import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../services/school_examination_service.dart';
import '../services/http_service.dart' as http_svc;
import '../utils/class_formatter.dart';

class PrincipalSeatingPlanScreen extends StatefulWidget {
  final SchoolExaminationService examService;
  final Map<String, dynamic> exam;
  final String? initialClassId;
  final List<dynamic>? preloadedClasses;
  final Map<String, dynamic>? schoolProfile;

  const PrincipalSeatingPlanScreen({
    super.key,
    required this.examService,
    required this.exam,
    this.initialClassId,
    this.preloadedClasses,
    this.schoolProfile,
  });

  @override
  State<PrincipalSeatingPlanScreen> createState() => _PrincipalSeatingPlanScreenState();
}

class _RoomConfigItem {
  final TextEditingController nameCtrl;
  final TextEditingController benchCtrl;

  _RoomConfigItem({required String name, required String count})
      : nameCtrl = TextEditingController(text: name),
        benchCtrl = TextEditingController(text: count);

  void dispose() {
    nameCtrl.dispose();
    benchCtrl.dispose();
  }
}

class _PrincipalSeatingPlanScreenState extends State<PrincipalSeatingPlanScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  String? _successMessage;
  Timer? _messageTimer;

  void _showSuccess(String message) {
    if (!mounted) return;
    _messageTimer?.cancel();
    setState(() {
      _successMessage = message;
      _errorMessage = null;
    });
    _messageTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() => _successMessage = null);
      }
    });
  }

  void _showError(String message) {
    if (!mounted) return;
    _messageTimer?.cancel();
    setState(() {
      _errorMessage = message;
      _successMessage = null;
    });
    _messageTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() => _errorMessage = null);
      }
    });
  }

  // View state: 'config' or 'slips'
  String _currentView = 'config';

  // Config Form States
  List<dynamic> _classes = [];
  List<dynamic> _students = [];
  List<int> _selectedClassIds = [];
  String _studentsPerBench = '2';
  int _roomCount = 1;
  final List<_RoomConfigItem> _roomConfigs = [];
  bool _confirmed = false;

  // Preview State
  Map<String, dynamic>? _previewData;
  bool _previewLoading = false;
  final ScrollController _scrollController = ScrollController();

  // Generated Plan State
  Map<String, dynamic>? _generatedPlan;
  String _selectedRoomFilter = 'all';
  List<dynamic> _examClassStatuses = [];

  // Modals & Action loadings
  bool _regenerateLoading = false;
  bool _submittingPublishAdmit = false;
  bool _submittingUnpublishAdmit = false;
  bool _downloadingPdf = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void dispose() {
    _messageTimer?.cancel();
    for (final rc in _roomConfigs) {
      rc.dispose();
    }
    _scrollController.dispose();
    super.dispose();
  }

  int get _examId {
    final raw = widget.exam['id'];
    return raw is int ? raw : int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  String get _examName => widget.exam['name']?.toString() ?? 'Examination';

  String get _schoolName {
    if (_generatedPlan != null && (_generatedPlan!['school_name']?.toString().isNotEmpty ?? false)) {
      return _generatedPlan!['school_name'].toString();
    }
    return widget.schoolProfile?['school_name'] ?? widget.schoolProfile?['name'] ?? 'School';
  }

  String get _academicYear {
    return widget.schoolProfile?['academic_year'] ??
        widget.schoolProfile?['current_academic_year'] ??
        '2026-2027';
  }

  Future<void> _initData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        widget.examService.getClasses().catchError((_) => <dynamic>[]),
        widget.examService.getStudents(status: 'ACTIVE', limit: 10000).catchError((_) => <dynamic>[]),
        widget.examService.getSeatingPlan(_examId).catchError((_) => null),
        widget.examService.getExamClassStatuses(_examId).catchError((_) => <dynamic>[]),
      ]);

      final fetchedClasses = (results[0] as List<dynamic>?) ?? [];
      final fetchedStudents = (results[1] as List<dynamic>?) ?? [];
      final planDetails = results[2] as Map<String, dynamic>?;
      final statuses = (results[3] as List<dynamic>?) ?? [];

      _classes = sortClassesAscending(List<dynamic>.from(fetchedClasses.isNotEmpty ? fetchedClasses : (widget.preloadedClasses ?? [])));
      _students = fetchedStudents;
      _examClassStatuses = statuses;

      if (planDetails != null && planDetails['plan'] != null) {
        _generatedPlan = planDetails;
        _currentView = 'slips';
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.jumpTo(0);
          }
        });

        // Extract class IDs from allocations
        final allocations = (planDetails['allocations'] as List<dynamic>?) ?? [];
        final classIdsFromAlloc = allocations
            .map((a) => int.tryParse(a['class_id']?.toString() ?? ''))
            .whereType<int>()
            .toSet()
            .toList();

        _selectedClassIds = classIdsFromAlloc;
        _studentsPerBench = planDetails['plan']['students_per_bench']?.toString() ?? '2';

        final rawRoomConfigs = (planDetails['plan']['room_configs'] as List<dynamic>?) ?? [];
        _roomConfigs.clear();
        for (final rc in rawRoomConfigs) {
          _roomConfigs.add(_RoomConfigItem(
            name: rc['room_name']?.toString() ?? 'Room',
            count: rc['bench_count']?.toString() ?? '',
          ));
        }
        _roomCount = _roomConfigs.isEmpty ? 1 : _roomConfigs.length;
        if (_roomConfigs.isEmpty) {
          _roomConfigs.add(_RoomConfigItem(name: 'Room 1', count: ''));
        }
        _selectedRoomFilter = 'all';
      } else {
        _generatedPlan = null;
        _currentView = 'config';
        _selectedClassIds = [];
        if (widget.initialClassId != null && widget.initialClassId!.isNotEmpty) {
          final initId = int.tryParse(widget.initialClassId!);
          if (initId != null) _selectedClassIds.add(initId);
        }

        _roomConfigs.clear();
        _roomConfigs.add(_RoomConfigItem(name: 'Room 1', count: ''));
        _roomCount = 1;
        _studentsPerBench = '2';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------

  int _getStudentCountForClass(dynamic classId) {
    final cIdStr = classId.toString();
    return _students.where((s) => s['class_id']?.toString() == cIdStr && (s['status'] == 'ACTIVE' || s['status'] == null)).length;
  }

  int get _totalSelectedStudents {
    return _selectedClassIds.fold(0, (sum, cid) => sum + _getStudentCountForClass(cid));
  }

  int get _requiredBenches {
    final spb = int.tryParse(_studentsPerBench) ?? 2;
    if (spb <= 0) return 0;
    return (_totalSelectedStudents / spb).ceil();
  }

  int get _totalEnteredBenches {
    return _roomConfigs.fold(0, (sum, rc) => sum + (int.tryParse(rc.benchCtrl.text.trim()) ?? 0));
  }

  int get _remainingBenches => _requiredBenches - _totalEnteredBenches;

  List<String> get _uniqueRooms {
    if (_generatedPlan == null) return [];
    final allocs = (_generatedPlan!['allocations'] as List<dynamic>?) ?? [];
    final names = allocs.map((a) => a['room_name']?.toString() ?? '').where((n) => n.isNotEmpty).toSet().toList();
    names.sort();
    return names;
  }

  List<dynamic> get _filteredAllocations {
    if (_generatedPlan == null) return [];
    final allocs = (_generatedPlan!['allocations'] as List<dynamic>?) ?? [];
    if (_selectedRoomFilter == 'all') return allocs;
    return allocs.where((a) => a['room_name']?.toString() == _selectedRoomFilter).toList();
  }

  bool get _isAllClassesSelected => _classes.isNotEmpty && _selectedClassIds.length == _classes.length;

  bool get _allAdmitCardsPublished {
    if (_selectedClassIds.isEmpty) return false;
    return _selectedClassIds.every((classId) {
      final st = _examClassStatuses.firstWhere(
        (c) => (c['class_id'] ?? c['id'])?.toString() == classId.toString(),
        orElse: () => null,
      );
      return st != null && (st['admit_card_published'] == 1 || st['admit_card_published'] == true);
    });
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  void _handleClassToggle(int classId) {
    setState(() {
      if (_selectedClassIds.contains(classId)) {
        _selectedClassIds.remove(classId);
      } else {
        _selectedClassIds.add(classId);
      }
      _previewData = null;
      _confirmed = false;
    });
  }

  void _handleSelectAllClasses() {
    setState(() {
      if (_isAllClassesSelected) {
        _selectedClassIds.clear();
      } else {
        _selectedClassIds = _classes
            .map((c) => int.tryParse(c['id']?.toString() ?? ''))
            .whereType<int>()
            .toList();
      }
      _previewData = null;
      _confirmed = false;
    });
  }

  void _handleRoomCountChange(int count) {
    if (count < 1 || count > 20) return;
    setState(() {
      _roomCount = count;
      if (count > _roomConfigs.length) {
        for (int i = _roomConfigs.length; i < count; i++) {
          _roomConfigs.add(_RoomConfigItem(name: 'Room ${i + 1}', count: ''));
        }
      } else if (count < _roomConfigs.length) {
        final removed = _roomConfigs.sublist(count);
        for (final rc in removed) {
          rc.dispose();
        }
        _roomConfigs.removeRange(count, _roomConfigs.length);
      }
      _previewData = null;
      _confirmed = false;
    });
  }

  Future<void> _handlePreview() async {
    setState(() {
      _errorMessage = null;
      _successMessage = null;
    });

    if (_selectedClassIds.isEmpty) {
      _showError('Please select at least one class.');
      return;
    }

    final activeRoomConfigs = _roomConfigs
        .where((rc) => (int.tryParse(rc.benchCtrl.text.trim()) ?? 0) > 0)
        .map((rc) => {
              'room_name': rc.nameCtrl.text.trim().isNotEmpty ? rc.nameCtrl.text.trim() : 'Room',
              'bench_count': int.parse(rc.benchCtrl.text.trim()),
            })
        .toList();

    if (activeRoomConfigs.isEmpty) {
      _showError('Please enter a valid bench count for at least one room.');
      return;
    }

    setState(() => _previewLoading = true);

    try {
      final res = await widget.examService.previewSeatingPlan(_examId, {
        'classes': _selectedClassIds,
        'students_per_bench': int.parse(_studentsPerBench),
        'room_configs': activeRoomConfigs,
      });

      setState(() {
        _previewData = res;
        _previewLoading = false;
      });

      // Smooth scroll down to preview
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeInOut,
          );
        }
      });
    } catch (e) {
      setState(() => _previewLoading = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _handleGenerate() async {
    if (!_confirmed) {
      _showError('Please check the confirmation box.');
      return;
    }
    if (_previewData == null || _previewData!['enough_benches'] != true) {
      _showError('Please verify that you have sufficient benches before generating.');
      return;
    }

    final activeRoomConfigs = _roomConfigs
        .where((rc) => (int.tryParse(rc.benchCtrl.text.trim()) ?? 0) > 0)
        .map((rc) => {
              'room_name': rc.nameCtrl.text.trim().isNotEmpty ? rc.nameCtrl.text.trim() : 'Room',
              'bench_count': int.parse(rc.benchCtrl.text.trim()),
            })
        .toList();

    setState(() => _previewLoading = true);

    try {
      await widget.examService.generateSeatingPlan(_examId, {
        'classes': _selectedClassIds,
        'students_per_bench': int.parse(_studentsPerBench),
        'room_configs': activeRoomConfigs,
      });

      final planDetails = await widget.examService.getSeatingPlan(_examId);
      final statuses = await widget.examService.getExamClassStatuses(_examId);

      setState(() {
        _generatedPlan = planDetails;
        _examClassStatuses = statuses;
        _selectedRoomFilter = 'all';
        _currentView = 'slips';
        _previewLoading = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(0);
        }
      });
      _showSuccess('Seating plan generated successfully.');
    } catch (e) {
      setState(() => _previewLoading = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _handleRegenerateConfirm() async {
    Navigator.pop(context); // close dialog
    setState(() => _regenerateLoading = true);

    try {
      await widget.examService.deleteSeatingPlan(_examId);
      setState(() {
        _generatedPlan = null;
        _previewData = null;
        _currentView = 'config';
        _confirmed = false;
        _regenerateLoading = false;
      });
      _showSuccess('Existing seating plan cleared. You can now configure a new one.');
    } catch (e) {
      setState(() => _regenerateLoading = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  void _showRegenerateDialog() {
    showDialog(
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
                    child: const Icon(
                      Icons.refresh_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Regenerate Seating Plan?',
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
              const Text(
                'You are about to regenerate the seating plan for this examination.',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.45),
              ),
              const SizedBox(height: 8),
              const Text(
                'Regenerating the seating plan will permanently remove the currently generated seating arrangement and student seating slips.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 8),
              const Text(
                'You will be redirected to the Seating Plan Configuration page to create a new seating arrangement.',
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
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
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
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
                        onPressed: () {
                          Navigator.pop(ctx);
                          _handleRegenerateConfirm();
                        },
                        child: const Text(
                          'Yes, Regenerate',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.3),
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
  }

  void _showPublishAdmitDialog() {
    showDialog(
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
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.check_circle_outline_rounded,
                      color: Color(0xFF16A34A),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Publish Admit Cards',
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
              const Text(
                'You are about to publish the admit cards. Once published, students will be able to access the admit cards in the mobile application.',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.45),
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
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _confirmPublishAdmitCards();
                        },
                        child: const Text(
                          'Publish',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.3),
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
  }

  Future<void> _confirmPublishAdmitCards() async {
    setState(() => _submittingPublishAdmit = true);

    try {
      for (final cid in _selectedClassIds) {
        await widget.examService.publishExamAdmitCards(_examId, cid);
      }
      final statuses = await widget.examService.getExamClassStatuses(_examId);
      setState(() {
        _examClassStatuses = statuses;
        _submittingPublishAdmit = false;
      });
      _showSuccess('Admit Cards Published Successfully.');
    } catch (e) {
      setState(() => _submittingPublishAdmit = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  void _showUnpublishAdmitDialog() {
    showDialog(
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
                    child: const Icon(
                      Icons.undo_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Revert Admit Cards to Draft',
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
              const Text(
                'Are you sure you want to revert the admit cards to Draft? Once reverted, they will disappear from the mobile application, and students/parents will receive a notification alert.',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF475569), height: 1.45),
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
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
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
                        onPressed: () {
                          Navigator.pop(ctx);
                          _confirmUnpublishAdmitCards();
                        },
                        child: const Text(
                          'Confirm Revert',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.3),
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
  }

  Future<void> _confirmUnpublishAdmitCards() async {
    setState(() => _submittingUnpublishAdmit = true);

    try {
      for (final cid in _selectedClassIds) {
        await widget.examService.unpublishExamAdmitCards(_examId, cid);
      }
      final statuses = await widget.examService.getExamClassStatuses(_examId);
      setState(() {
        _examClassStatuses = statuses;
        _submittingUnpublishAdmit = false;
      });
      _showSuccess('Admit Cards Reverted to Draft Successfully.');
    } catch (e) {
      setState(() => _submittingUnpublishAdmit = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  // ---------------------------------------------------------------------------
  // PDF Generation & Print
  // ---------------------------------------------------------------------------

  String _getFullPositionName(dynamic pos) {
    if (pos == 'L') return 'LEFT';
    if (pos == 'M') return 'CENTER';
    if (pos == 'R') return 'RIGHT';
    return pos?.toString().toUpperCase() ?? '';
  }

  pw.Widget _buildPdfSlipCard(Map<String, dynamic> alloc) {
    final studentName = (alloc['student_name'] ?? '—').toString();
    final className = (alloc['class_name'] ?? '—').toString();
    final section = (alloc['class_section'] ?? alloc['section'] ?? '').toString();
    final fullClassName = formatShortClassName(className, section: section);
    final rollNo = (alloc['roll_no'] ?? '—').toString();
    final roomName = (alloc['room_name'] ?? '—').toString();
    final benchNumber = (alloc['bench_number'] ?? '—').toString();
    final position = _getFullPositionName(alloc['seat_position']);

    return pw.Container(
      width: 88 * PdfPageFormat.mm,
      height: 59 * PdfPageFormat.mm,
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border.all(color: PdfColors.black, width: 1.8),
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(8)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.stretch,
        children: [
          // 1. Header: School Name, Exam Name, AY
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 1.2)),
            ),
            child: pw.Column(
              children: [
                pw.Text(
                  _schoolName.toUpperCase(),
                  textAlign: pw.TextAlign.center,
                  maxLines: 1,
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 8.5,
                    color: PdfColors.black,
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      _examName.toUpperCase(),
                      style: const pw.TextStyle(fontSize: 6.5, color: PdfColors.grey700),
                    ),
                    pw.Text(
                      'AY $_academicYear',
                      style: const pw.TextStyle(fontSize: 6.5, color: PdfColors.grey700),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 2. Middle Body: Student Info
          pw.Expanded(
            child: pw.Padding(
              padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisAlignment: pw.MainAxisAlignment.spaceEvenly,
                children: [
                  // Student Name
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        'STUDENT NAME',
                        style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600),
                      ),
                      pw.SizedBox(height: 1),
                      pw.Text(
                        studentName.toUpperCase(),
                        maxLines: 1,
                        style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold,
                          fontSize: 9.5,
                          color: PdfColors.black,
                        ),
                      ),
                    ],
                  ),

                  // Class & Roll Number Row
                  pw.Container(
                    padding: const pw.EdgeInsets.only(top: 2),
                    decoration: const pw.BoxDecoration(
                      border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 0.6)),
                    ),
                    child: pw.Row(
                      children: [
                        pw.Expanded(
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text('CLASS', style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600)),
                              pw.SizedBox(height: 1),
                              pw.Text(
                                fullClassName,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, color: PdfColors.black),
                              ),
                            ],
                          ),
                        ),
                        pw.Expanded(
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text('ROLL NUMBER', style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600)),
                              pw.SizedBox(height: 1),
                              pw.Text(
                                rollNo,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, color: PdfColors.black),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Seating Location (Exam Room, Bench, Position)
                  pw.Container(
                    padding: const pw.EdgeInsets.only(top: 2),
                    decoration: const pw.BoxDecoration(
                      border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 0.6)),
                    ),
                    child: pw.Row(
                      children: [
                        pw.Expanded(
                          flex: 4,
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text('EXAM ROOM', style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600)),
                              pw.SizedBox(height: 1),
                              pw.Text(
                                roomName,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, color: PdfColors.black),
                              ),
                            ],
                          ),
                        ),
                        pw.Expanded(
                          flex: 3,
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text('BENCH', style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600)),
                              pw.SizedBox(height: 1),
                              pw.Text(
                                'Bench $benchNumber',
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, color: PdfColors.black),
                              ),
                            ],
                          ),
                        ),
                        pw.Expanded(
                          flex: 3,
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.end,
                            children: [
                              pw.Text('POSITION', style: const pw.TextStyle(fontSize: 5.5, color: PdfColors.grey600)),
                              pw.SizedBox(height: 1),
                              pw.Text(
                                position,
                                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, color: PdfColors.amber800),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 3. Footer Bar: Official Admit Card
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(vertical: 2.5),
            decoration: const pw.BoxDecoration(
              color: PdfColors.grey100,
              border: pw.Border(top: pw.BorderSide(color: PdfColors.grey400, width: 0.8)),
            ),
            child: pw.Center(
              child: pw.Text(
                'OFFICIAL ADMIT CARD',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6, color: PdfColors.grey700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handlePrintOrDownloadPdf() async {
    final allocations = _filteredAllocations;
    if (allocations.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: const [
              Icon(Icons.info_outline_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'No seating slips to print for current filter.',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFFD97706),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      );
      return;
    }

    setState(() => _downloadingPdf = true);

    try {
      final pdf = pw.Document();

      // Group cards into pages: max 8 cards per A4 page (2 columns x 4 rows)
      const int slipsPerPage = 8;
      for (int i = 0; i < allocations.length; i += slipsPerPage) {
        final chunk = allocations.sublist(
          i,
          (i + slipsPerPage > allocations.length) ? allocations.length : i + slipsPerPage,
        );

        final List<pw.Widget> pageRows = [];
        for (int r = 0; r < chunk.length; r += 2) {
          final allocLeft = chunk[r];
          final allocRight = (r + 1 < chunk.length) ? chunk[r + 1] : null;

          pageRows.add(
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                _buildPdfSlipCard(allocLeft as Map<String, dynamic>),
                if (allocRight != null)
                  _buildPdfSlipCard(allocRight as Map<String, dynamic>)
                else
                  pw.SizedBox(width: 88 * PdfPageFormat.mm),
              ],
            ),
          );

          if (r + 2 < chunk.length) {
            pageRows.add(pw.SizedBox(height: 4 * PdfPageFormat.mm));
          }
        }

        pdf.addPage(
          pw.Page(
            pageFormat: PdfPageFormat.a4,
            margin: const pw.EdgeInsets.symmetric(
              horizontal: 14 * PdfPageFormat.mm,
              vertical: 12 * PdfPageFormat.mm,
            ),
            build: (pw.Context context) {
              return pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: pageRows,
              );
            },
          ),
        );
      }

      final Uint8List pdfBytes = await pdf.save();
      final filename = 'Examination_Slips_${_selectedRoomFilter}_${_examName.replaceAll(RegExp(r'\s+'), '_')}';

      await Printing.layoutPdf(
        onLayout: (format) async => pdfBytes,
        name: filename,
        format: PdfPageFormat.a4,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              http_svc.isNetworkError(e)
                  ? http_svc.kNetworkErrorMessage
                  : 'Failed to generate PDF: ${http_svc.formatErrorMessage(e)}',
            ),
            backgroundColor: const Color(0xFFD97706),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  // ---------------------------------------------------------------------------
  // Build UI
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context, _generatedPlan != null),
        ),
        title: Text(
          '${_examName.toUpperCase()} SEATING PLAN',
          style: const TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
            fontSize: 15,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
          : _errorMessage != null && _classes.isEmpty
              ? _buildErrorView()
              : _buildMainBody(),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'An error occurred',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _initData,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
              child: const Text('Try Again', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainBody() {
    return ListView(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        // Global Alert Bar
        if (_errorMessage != null)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

        if (_successMessage != null)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _successMessage!,
                    style: const TextStyle(color: Color(0xFF15803D), fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

        // Current View: Config or Slips
        if (_currentView == 'config') _buildConfigView() else _buildSlipsView(),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STATE A: CONFIGURATION VIEW
  // ---------------------------------------------------------------------------

  Widget _buildConfigView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // STEP 1 CARD: CLASSES SELECTION
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Step 1: Classes Selection',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                  ),
                  if (_classes.isNotEmpty)
                    TextButton(
                      onPressed: _handleSelectAllClasses,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        _isAllClassesSelected ? 'Deselect All' : 'Select All',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'CLASSES TO INCLUDE',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
              const SizedBox(height: 8),

              // Class Checkboxes Grid
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _classes.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 2.3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemBuilder: (context, index) {
                  final c = _classes[index];
                  final cid = int.tryParse(c['id']?.toString() ?? '') ?? 0;
                  final isSelected = _selectedClassIds.contains(cid);
                  final stuCount = _getStudentCountForClass(cid);
                  final shortName = formatShortClassName(c['name'], section: c['section']);

                  return InkWell(
                    onTap: () => _handleClassToggle(cid),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFFFFBEB) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Checkbox(
                            value: isSelected,
                            onChanged: (_) => _handleClassToggle(cid),
                            activeColor: const Color(0xFF16A34A),
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  shortName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF0F172A)),
                                ),
                                Text(
                                  '$stuCount students',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 10, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),

              // Class stats summary
              if (_selectedClassIds.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Students: $_totalSelectedStudents',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF1E293B)),
                      ),
                      Text(
                        'Required Benches: $_requiredBenches',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFFD97706)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),

        // STEP 2 CARD: ROOMS SETUP
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
                'Step 2: Rooms Setup',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 14),

              // Students per bench & Room count row
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'STUDENTS PER BENCH',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        _buildDropdownAnchor<String>(
                          hint: 'Students / Bench',
                          value: _studentsPerBench,
                          displayText: '$_studentsPerBench ${_studentsPerBench == '1' ? 'Student' : 'Students'}',
                          items: const [
                            DropdownMenuItemModel(value: '1', label: '1 Student'),
                            DropdownMenuItemModel(value: '2', label: '2 Students'),
                            DropdownMenuItemModel(value: '3', label: '3 Students'),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _studentsPerBench = val;
                                _previewData = null;
                                _confirmed = false;
                              });
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
                        const Text(
                          'NUMBER OF ROOMS',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        _buildDropdownAnchor<int>(
                          hint: 'Rooms',
                          value: _roomCount,
                          displayText: '$_roomCount ${_roomCount == 1 ? 'Room' : 'Rooms'}',
                          items: List.generate(20, (i) => i + 1)
                              .map((n) => DropdownMenuItemModel(value: n, label: '$n ${n == 1 ? 'Room' : 'Rooms'}'))
                              .toList(),
                          onChanged: (val) {
                            if (val != null) {
                              _handleRoomCountChange(val);
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              if (_selectedClassIds.isNotEmpty) ...[
                const SizedBox(height: 14),

                // Room Configs list
                const Text(
                  'CONFIGURE ROOMS AVAILABLE BENCHES',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),

                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _roomConfigs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final rc = _roomConfigs[idx];
                    return Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: TextField(
                              controller: rc.nameCtrl,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              decoration: InputDecoration(
                                labelText: 'Room Name',
                                labelStyle: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              onChanged: (_) => setState(() => _previewData = null),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 2,
                            child: TextField(
                              controller: rc.benchCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              decoration: InputDecoration(
                                labelText: 'Bench Count',
                                labelStyle: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              onChanged: (_) => setState(() => _previewData = null),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: 12),

                // Live Bench Distribution Status Counter
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                          children: [
                            const TextSpan(text: 'Distributed: ', style: TextStyle(fontWeight: FontWeight.bold)),
                            TextSpan(
                              text: '$_totalEnteredBenches / $_requiredBenches',
                              style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFD97706)),
                            ),
                          ],
                        ),
                      ),
                      if (_remainingBenches > 0)
                        Text(
                          'Remaining: $_remainingBenches Benches',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFD97706)),
                        )
                      else
                        Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 16),
                            const SizedBox(width: 4),
                            Text(
                              'All Distributed (${_remainingBenches.abs()} surplus)',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF16A34A)),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),

                // Warning if not enough benches
                if (_totalEnteredBenches < _requiredBenches) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'You still need to distribute $_remainingBenches more benches before continuing.',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 14),

                // Preview Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: (_previewLoading || _selectedClassIds.isEmpty || _totalEnteredBenches < _requiredBenches)
                        ? null
                        : _handlePreview,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      disabledBackgroundColor: const Color(0xFFD97706).withOpacity(0.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _previewLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : const Text(
                            'Preview Seating Plan',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.white),
                          ),
                  ),
                ),
              ],
            ],
          ),
        ),

        // STEP 3: PREVIEW CARD (Rendered directly below when previewData exists)
        if (_previewData != null) ...[
          const SizedBox(height: 14),
          _buildPreviewSection(),
        ],
      ],
    );
  }

  Widget _buildPreviewSection() {
    final preview = _previewData!;
    final totalStudents = preview['total_students']?.toString() ?? '0';
    final spb = preview['students_per_bench']?.toString() ?? '2';
    final reqBenches = preview['required_benches']?.toString() ?? '0';
    final availBenches = preview['available_benches']?.toString() ?? '0';
    final roomDetails = (preview['room_details'] as List<dynamic>?) ?? [];
    final enoughBenches = preview['enough_benches'] == true;

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
          const Text(
            'Seating Allocation Preview',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 14),

          // 4 Stat Cards
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.2,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            children: [
              _buildPreviewStatTile('TOTAL STUDENTS', totalStudents),
              _buildPreviewStatTile('BENCH CAPACITY', '$spb / Bench'),
              _buildPreviewStatTile('REQUIRED BENCHES', reqBenches),
              _buildPreviewStatTile('AVAILABLE BENCHES', availBenches),
            ],
          ),
          const SizedBox(height: 14),

          // Room Details
          const Text(
            'ROOM ALLOCATION DETAILS',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: roomDetails.length,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (context, idx) {
              final r = roomDetails[idx];
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      r['room_name']?.toString() ?? 'Room',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      'Allocated Students: ${r['allocated'] ?? 0}',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFFD97706)),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 14),

          // Confirmation and Action
          if (enoughBenches) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: InkWell(
                onTap: () => setState(() => _confirmed = !_confirmed),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _confirmed,
                      onChanged: (val) => setState(() => _confirmed = val ?? false),
                      activeColor: const Color(0xFFD97706),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'I confirm that the entered bench counts match the actual benches available in all selected examination rooms.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569), height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: (!_confirmed || _previewLoading) ? null : _handleGenerate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  disabledBackgroundColor: const Color(0xFF16A34A).withOpacity(0.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _previewLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text(
                        'Generate Seating Plan',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.white),
                      ),
              ),
            ),
          ] else ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Insufficient benches! Total $totalStudents students require $reqBenches benches, but only $availBenches bench(es) are available. Please add more benches or rooms above.',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB91C1C), height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPreviewStatTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // STATE B: GENERATED SLIPS VIEW
  // ---------------------------------------------------------------------------

  Widget _buildSlipsView() {
    final allocations = _filteredAllocations;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Action Header & Filter Card
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
              // Room Filter + Slips Count
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ROOM FILTER',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 6),
                        _buildDropdownAnchor<String>(
                          hint: 'All Rooms',
                          value: _selectedRoomFilter,
                          displayText: _selectedRoomFilter == 'all' ? 'All Rooms' : _selectedRoomFilter,
                          items: [
                            const DropdownMenuItemModel(value: 'all', label: 'All Rooms'),
                            ..._uniqueRooms.map((r) => DropdownMenuItemModel(value: r, label: r)),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedRoomFilter = val);
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Text(
                        'Slips: ${allocations.length}',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFFD97706)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Action Buttons Row 1: Regenerate Plan & Admit Cards
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _regenerateLoading ? null : _showRegenerateDialog,
                      icon: _regenerateLoading
                          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.refresh_rounded, size: 16),
                      label: const Text('Regenerate Plan', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0F172A),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _allAdmitCardsPublished
                        ? OutlinedButton.icon(
                            onPressed: _submittingUnpublishAdmit ? null : _showUnpublishAdmitDialog,
                            icon: const Icon(Icons.undo_rounded, size: 16, color: Color(0xFFE11D48)),
                            label: const Text('Revert to Draft', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFE11D48),
                              side: const BorderSide(color: Color(0xFFFECDD3)),
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          )
                        : OutlinedButton.icon(
                            onPressed: _submittingPublishAdmit ? null : _showPublishAdmitDialog,
                            icon: const Icon(Icons.check_circle_outline_rounded, size: 16, color: Color(0xFF16A34A)),
                            label: const Text('Publish Cards', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF16A34A),
                              side: const BorderSide(color: Color(0xFFBBF7D0)),
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Action Buttons Row 2: Download all admit cards
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  onPressed: _downloadingPdf ? null : _handlePrintOrDownloadPdf,
                  icon: _downloadingPdf
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.download_rounded, size: 18, color: Colors.white),
                  label: Text(
                    _downloadingPdf ? 'Generating PDF...' : 'Download all admit cards',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // RENDERED SLIPS LIST
        if (allocations.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Center(
              child: Text(
                'No student seating slips found for the selected filter.',
                style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B), fontSize: 13),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: allocations.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, idx) {
              final alloc = allocations[idx];
              return _buildSlipCard(alloc);
            },
          ),
      ],
    );
  }

  Widget _buildSlipCard(dynamic alloc) {
    final studentName = alloc['student_name']?.toString() ?? '—';
    final className = alloc['class_name']?.toString() ?? '—';
    final section = alloc['class_section']?.toString() ?? alloc['section']?.toString() ?? '';
    final fullClassName = formatShortClassName(className, section: section);
    final rollNo = alloc['roll_no']?.toString() ?? '—';
    final roomName = alloc['room_name']?.toString() ?? '—';
    final benchNumber = alloc['bench_number']?.toString() ?? '—';
    final position = _getFullPositionName(alloc['seat_position']);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0F172A), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: School Name, Exam Name, AY
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFCBD5E1), width: 1)),
            ),
            child: Column(
              children: [
                Text(
                  _schoolName.toUpperCase(),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF0F172A), letterSpacing: 0.3),
                ),
                const SizedBox(height: 2),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _examName.toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 10, color: Color(0xFF64748B)),
                    ),
                    Text(
                      'AY $_academicYear',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 10, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Student Details
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Student Name
                const Text(
                  'STUDENT NAME',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 9, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                ),
                const SizedBox(height: 2),
                Text(
                  studentName.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 8),

                // Class & Roll Number Row
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'CLASS',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 9, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            fullClassName,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ROLL NUMBER',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 9, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            rollNo,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF1E293B), fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 8),

                // Seating Location (Room, Bench, Position)
                Row(
                  children: [
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'EXAM ROOM',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 8.5, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            roomName,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'BENCH',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 8.5, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Bench $benchNumber',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'POSITION',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 8.5, color: Color(0xFF94A3B8), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            position,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFFD97706)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Bottom Bar: Official Admit Card
          Container(
            padding: const EdgeInsets.symmetric(vertical: 5),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.only(bottomLeft: Radius.circular(14), bottomRight: Radius.circular(14)),
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: const Center(
              child: Text(
                'OFFICIAL ADMIT CARD',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 9, color: Color(0xFF64748B), letterSpacing: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Custom Dropdown Anchor (Opens directly downward below field)
  // ---------------------------------------------------------------------------

  Widget _buildDropdownAnchor<T>({
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
                            color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                          ),
                        ),
                      );
                    }).toList(),
                  );

                  if (selected != null) {
                    onChanged(selected);
                  }
                },
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
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
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: displayText.isNotEmpty ? const Color(0xFF1E293B) : const Color(0xFF64748B),
                    ),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 18),
              ],
            ),
          ),
        );
      },
    );
  }
}

class DropdownMenuItemModel<T> {
  final T value;
  final String label;
  const DropdownMenuItemModel({required this.value, required this.label});
}

