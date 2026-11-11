import 'package:cached_network_image/cached_network_image.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/leave_service.dart';

const List<Map<String, String>> predefinedClasses = [
  {'name': 'Pre Nursery', 'category': 'Pre-Primary'},
  {'name': 'Nursery', 'category': 'Pre-Primary'},
  {'name': 'Lower Kindergarten (LKG)', 'category': 'Pre-Primary'},
  {'name': 'Upper Kindergarten (UKG)', 'category': 'Pre-Primary'},
  {'name': 'KG', 'category': 'Pre-Primary'},
  {'name': 'Class 1', 'category': 'Primary'},
  {'name': 'Class 2', 'category': 'Primary'},
  {'name': 'Class 3', 'category': 'Primary'},
  {'name': 'Class 4', 'category': 'Primary'},
  {'name': 'Class 5', 'category': 'Primary'},
  {'name': 'Class 6', 'category': 'Middle'},
  {'name': 'Class 7', 'category': 'Middle'},
  {'name': 'Class 8', 'category': 'Middle'},
  {'name': 'Class 9', 'category': 'Secondary'},
  {'name': 'Class 10', 'category': 'Secondary'},
  {'name': 'Class 11', 'category': 'Senior Secondary'},
  {'name': 'Class 12', 'category': 'Senior Secondary'},
];

int getClassIndex(String? className) {
  if (className == null || className.trim().isEmpty) return -1;
  final clean = className.trim();
  final lower = clean.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

  if (lower.contains('prenursery') || lower == 'pnc' || lower == 'playgroup' || lower == 'pg') {
    return predefinedClasses.indexWhere((c) => c['name'] == 'Pre Nursery');
  }
  if (lower.contains('nursery') || lower == 'nc') {
    return predefinedClasses.indexWhere((c) => c['name'] == 'Nursery');
  }
  if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower.contains('lkg') || lower == 'lkg') {
    return predefinedClasses.indexWhere((c) => c['name']!.contains('LKG'));
  }
  if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower.contains('ukg') || lower == 'ukg') {
    return predefinedClasses.indexWhere((c) => c['name']!.contains('UKG'));
  }
  if (lower == 'kg' || lower == 'kindergarten') {
    return predefinedClasses.indexWhere((c) => c['name'] == 'KG');
  }

  final idx = predefinedClasses.indexWhere((c) => c['name']!.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '') == lower);
  if (idx != -1) return idx;

  final match = RegExp(r'\d+').firstMatch(clean);
  if (match != null) {
    final num = int.tryParse(match.group(0)!) ?? 0;
    return 4 + num;
  }
  return -1;
}

String getNextClassLabel(String? className) {
  final name = className ?? '';
  final lower = name.toLowerCase();
  if (lower.contains('nursery')) return 'LKG';
  if (lower.contains('lkg')) return 'UKG';
  if (lower.contains('ukg')) return 'Class 1';

  final match = RegExp(r'\d+').firstMatch(name);
  if (match != null) {
    final num = int.tryParse(match.group(0)!) ?? 0;
    return name.replaceFirst(match.group(0)!, '${num + 1}');
  }
  return 'Next Class';
}

class AcademicYearMigrationScreen extends StatefulWidget {
  final LeaveService leaveService;
  final dynamic activeYear;
  final dynamic draftYear;
  final List<dynamic> academicYears;
  final VoidCallback onMigrationSuccess;

  const AcademicYearMigrationScreen({
    Key? key,
    required this.leaveService,
    required this.activeYear,
    required this.draftYear,
    required this.academicYears,
    required this.onMigrationSuccess,
  }) : super(key: key);

  @override
  State<AcademicYearMigrationScreen> createState() => _AcademicYearMigrationScreenState();
}

class _AcademicYearMigrationScreenState extends State<AcademicYearMigrationScreen> {
  int _currentStep = 1; // 1: Teachers, 2: Students, 3: Review
  bool _isLoading = true;
  bool _isExecuting = false;
  String? _errorMessage;

  List<dynamic> _staff = [];
  List<dynamic> _students = [];
  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  List<dynamic> _draftClasses = [];

  final Map<int, bool> _selectedTeachers = {};
  final Map<int, String> _studentActions = {};

  bool _showHighestClassToggleCard = false;
  bool _promoteHighestClassToggle = false;
  String _highestClassName = '';
  int _highestIdx = -1;
  String? _nextClassName;

  @override
  void initState() {
    super.initState();
    _loadMigrationData();
  }

  Future<void> _loadMigrationData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final baseUrl = widget.leaveService.baseUrl;
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

      final draftId = widget.draftYear['id'];

      final results = await Future.wait([
        http.get(Uri.parse('$baseUrl/api/school/staff'), headers: headers),
        http.get(Uri.parse('$baseUrl/api/school/students'), headers: headers),
        http.get(Uri.parse('$baseUrl/api/school/classes'), headers: headers),
        http.get(Uri.parse('$baseUrl/api/school/subjects'), headers: headers),
        http.get(Uri.parse('$baseUrl/api/school/classes?academic_year_id=$draftId'), headers: headers),
      ]);

      for (final res in results) {
        if (res.statusCode != 200) {
          throw Exception('Failed to load school data (HTTP ${res.statusCode})');
        }
      }

      List<dynamic> parseList(String body) {
        final decoded = json.decode(body);
        if (decoded is List) return decoded;
        if (decoded is Map) {
          if (decoded['staff'] is List) return decoded['staff'];
          if (decoded['students'] is List) return decoded['students'];
          if (decoded['classes'] is List) return decoded['classes'];
          if (decoded['subjects'] is List) return decoded['subjects'];
          if (decoded['data'] is List) return decoded['data'];
        }
        return [];
      }

      _staff = parseList(results[0].body);
      _students = parseList(results[1].body);
      _classes = parseList(results[2].body);
      _subjects = parseList(results[3].body);
      _draftClasses = parseList(results[4].body);

      // 1. Teachers: Select all active teachers by default
      _selectedTeachers.clear();
      for (final s in _staff) {
        final role = (s['role'] ?? '').toString().toUpperCase();
        final status = (s['status'] ?? '').toString().toUpperCase();
        if ((role == 'TEACHER' || role == 'Teacher') && status == 'ACTIVE') {
          final id = s['id'] is int ? s['id'] as int : int.tryParse(s['id'].toString()) ?? 0;
          if (id > 0) _selectedTeachers[id] = true;
        }
      }

      // 2. Highest class detection
      _highestIdx = -1;
      _highestClassName = '';
      for (final c in _classes) {
        final cName = (c['name'] ?? '').toString();
        final idx = getClassIndex(cName);
        if (idx > _highestIdx) {
          _highestIdx = idx;
          _highestClassName = cName;
        }
      }

      final class12Idx = getClassIndex('Class 12');
      final isClass12 = _highestIdx >= class12Idx;

      _nextClassName = null;
      bool hasNextClassInDraft = false;

      if (!isClass12 && _highestIdx >= 0 && _highestIdx + 1 < predefinedClasses.length) {
        _nextClassName = predefinedClasses[_highestIdx + 1]['name'];
        hasNextClassInDraft = _draftClasses.any((dc) {
          final dcName = (dc['name'] ?? '').toString();
          return getClassIndex(dcName) == _highestIdx + 1 ||
              dcName.trim().toLowerCase() == _nextClassName!.toLowerCase();
        });
      }

      if (!isClass12 && _highestIdx >= 0) {
        _showHighestClassToggleCard = true;
        _promoteHighestClassToggle = hasNextClassInDraft;
      } else {
        _showHighestClassToggleCard = false;
        _promoteHighestClassToggle = false;
      }

      // 3. Students: Pre-fill promotion actions
      _studentActions.clear();
      for (final s in _students) {
        final status = (s['status'] ?? '').toString().toUpperCase();
        if (status != 'ACTIVE') continue;

        final sid = s['id'] is int ? s['id'] as int : int.tryParse(s['id'].toString()) ?? 0;
        if (sid <= 0) continue;

        final sClassId = s['class_id'];
        final sClass = _classes.firstWhere(
          (c) => c['id'].toString() == sClassId?.toString(),
          orElse: () => null,
        );
        final cIdx = sClass != null ? getClassIndex(sClass['name']) : -1;
        final isHighest = cIdx == _highestIdx;

        if (isHighest) {
          if (isClass12 || !_promoteHighestClassToggle) {
            _studentActions[sid] = 'graduate_alumni';
          } else {
            _studentActions[sid] = 'promote';
          }
        } else {
          _studentActions[sid] = 'promote';
        }
      }

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = http.formatErrorMessage(e);
      });
    }
  }

  void _handleHighestClassToggleChange(bool checked) {
    setState(() {
      _promoteHighestClassToggle = checked;
      final targetAction = checked ? 'promote' : 'graduate_alumni';

      for (final s in _students) {
        final status = (s['status'] ?? '').toString().toUpperCase();
        if (status != 'ACTIVE') continue;

        final sid = s['id'] is int ? s['id'] as int : int.tryParse(s['id'].toString()) ?? 0;
        final sClassId = s['class_id'];
        final sClass = _classes.firstWhere(
          (c) => c['id'].toString() == sClassId?.toString(),
          orElse: () => null,
        );
        final cIdx = sClass != null ? getClassIndex(sClass['name']) : -1;
        if (cIdx == _highestIdx) {
          _studentActions[sid] = targetAction;
        }
      }
    });
  }

  Future<void> _confirmAndExecuteMigration() async {
    final draftName = (widget.draftYear['name'] ?? 'Upcoming Session').toString();
    final confirmed = await showDialog<bool>(
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
                      Icons.sync_alt_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Confirm Migration',
                        style: TextStyle(
                          fontSize: 15,
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
                'Migrating to this Academic Year will copy classes, subjects, timetables, and execute configured student promotions into $draftName.',
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFB45309)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'This action will activate the new session and archive the current session. Live data will transition to the new session.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF92400E), height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
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
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
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
                        child: const Text(
                          'Migrate & Activate',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
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

    if (confirmed == true) {
      _executeMigration();
    }
  }

  Future<void> _executeMigration() async {
    setState(() {
      _isExecuting = true;
    });

    BuildContext? loaderCtx;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (lCtx) {
        loaderCtx = lCtx;
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: Colors.white,
          insetPadding: const EdgeInsets.symmetric(horizontal: 32),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 26),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.8,
                    color: Color(0xFFD97706),
                  ),
                ),
                SizedBox(width: 18),
                Expanded(
                  child: Text(
                    'Migration is in progress... Please wait.',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final baseUrl = widget.leaveService.baseUrl;
      final activeYearId = widget.activeYear['id'];

      final teacherMigrations = _selectedTeachers.entries
          .where((e) => e.value)
          .map((e) => e.key)
          .toList();

      final studentMigrations = _studentActions.entries.map((e) {
        return {
          'student_id': e.key,
          'action': e.value,
        };
      }).toList();

      final payload = {
        'teacher_migrations': teacherMigrations,
        'student_migrations': studentMigrations,
      };

      final url = Uri.parse('$baseUrl/api/school/academic-years/$activeYearId/migrate');
      final res = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode(payload),
      );

      final resData = json.decode(res.body);

      if (loaderCtx != null && loaderCtx!.mounted) {
        Navigator.pop(loaderCtx!);
      }

      if (res.statusCode == 200 || res.statusCode == 201) {
        final draftId = widget.draftYear['id'] is int
            ? widget.draftYear['id'] as int
            : int.tryParse(widget.draftYear['id'].toString()) ?? activeYearId;
        final draftName = (widget.draftYear['name'] ?? '').toString();

        await prefs.setInt('selected_academic_year_id', draftId);
        await prefs.setString('selected_academic_year_name', draftName);
        await prefs.setString('selected_academic_year_status', 'ACTIVE');

        if (!mounted) return;

        // Show well-designed migration completion popup with "Go To Dashboard"
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => PopScope(
            canPop: false,
            child: Dialog(
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
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.check_circle_rounded,
                            color: Color(0xFF16A34A),
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(top: 2),
                            child: Text(
                              'Migration Complete!',
                              style: TextStyle(
                                fontSize: 16,
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
                      'Academic session has been successfully migrated to $draftName. All classes, subjects, timetables, and student promotions are now active for the upcoming academic year. Wishing your school a successful and prosperous new session!',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF475569),
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.school_rounded, size: 18, color: Color(0xFF15803D)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Current Active Session',
                                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  draftName,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF14532D)),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Active',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF15803D)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Divider(color: Color(0xFFE2E8F0), height: 1),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
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
                          widget.onMigrationSuccess();
                          // Navigate straight back to Dashboard (Home)
                          Navigator.of(context).popUntil((route) => route.isFirst);
                        },
                        child: const Text(
                          'Go To Dashboard',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      } else {
        String msg = resData['message'] ?? resData['error'] ?? 'Migration failed';
        if (resData['errors'] != null && resData['errors'] is Map) {
          final errs = (resData['errors'] as Map).values.map((v) => v.toString()).join('\n');
          if (errs.isNotEmpty) msg = errs;
        }
        throw Exception(msg);
      }
    } catch (e) {
      if (loaderCtx != null && loaderCtx!.mounted) {
        Navigator.pop(loaderCtx!);
      }
      if (!mounted) return;
      showDialog(
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
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFDC2626),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Text(
                          'Migration Failed',
                          style: TextStyle(
                            fontSize: 15,
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
                  http.formatErrorMessage(e),
                  style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.45),
                ),
                const SizedBox(height: 18),
                const Divider(color: Color(0xFFE2E8F0), height: 1),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Understood', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isExecuting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldQuit = await _confirmQuitMigration();
        if (shouldQuit && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text(
            'Academic Year Migration',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFF0F172A)),
          ),
          backgroundColor: Colors.white,
          elevation: 0.5,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
            onPressed: () async {
              final shouldQuit = await _confirmQuitMigration();
              if (shouldQuit && context.mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: _buildStepIndicator(),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFD97706)),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Colors.red, size: 48),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadMigrationData,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
                          child: const Text('Retry', style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                  ),
                )
              : _buildStepContent(),
      bottomNavigationBar: _isLoading ? null : _buildFooterControls(),
    ),
    );
  }

  Widget _buildStepIndicator() {
    final steps = [
      {'step': 1, 'label': 'Teachers'},
      {'step': 2, 'label': 'Students'},
      {'step': 3, 'label': 'Review'},
    ];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: steps.map((s) {
          final sNum = s['step'] as int;
          final sLabel = s['label'] as String;
          final isDone = _currentStep > sNum;
          final isCurrent = _currentStep == sNum;

          return Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCurrent
                      ? const Color(0xFFD97706)
                      : (isDone ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9)),
                  border: Border.all(
                    color: isCurrent
                        ? const Color(0xFFD97706)
                        : (isDone ? const Color(0xFF16A34A) : const Color(0xFFCBD5E1)),
                  ),
                ),
                child: Center(
                  child: isDone
                      ? const Icon(Icons.check, size: 14, color: Color(0xFF16A34A))
                      : Text(
                          '$sNum',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: isCurrent ? Colors.white : const Color(0xFF64748B),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                sLabel,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                  color: isCurrent ? const Color(0xFFD97706) : const Color(0xFF64748B),
                ),
              ),
              if (sNum < 3) ...[
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF94A3B8)),
                const SizedBox(width: 8),
              ],
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTeacherAvatar(String? photoPath, String name, {double size = 38}) {
    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final cleanInitials = initials.isEmpty ? 'T' : initials;

    final String photo = (photoPath ?? '').trim();
    if (photo.isNotEmpty) {
      String fullUrl = photo;
      if (!fullUrl.startsWith('http')) {
        final base = widget.leaveService.baseUrl.replaceAll(RegExp(r'/+$'), '');
        final cleanPath = photo.startsWith('/') ? photo : '/$photo';
        fullUrl = '$base$cleanPath';
      }
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: fullUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _avatarInitials(cleanInitials, size),
          errorWidget: (_, __, ___) => _avatarInitials(cleanInitials, size),
        ),
      );
    }
    return _avatarInitials(cleanInitials, size);
  }

  Widget _avatarInitials(String initials, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
      ),
      child: Center(
        child: Text(
          initials,
          style: TextStyle(
            fontSize: size * 0.38,
            fontWeight: FontWeight.w800,
            color: const Color(0xFFB45309),
          ),
        ),
      ),
    );
  }

  Future<bool> _confirmQuitMigration() async {
    final shouldQuit = await showDialog<bool>(
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
                      Icons.warning_amber_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Quit Migration?',
                        style: TextStyle(
                          fontSize: 15,
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
                'Are you sure you want to quit migration? Any unconfirmed step configurations and progress will be lost.',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 18),
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
                          'Stay',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
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
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text(
                          'Quit Migration',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
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

    return shouldQuit == true;
  }

  Widget _buildStepContent() {
    if (_currentStep == 1) {
      return _buildTeachersStep();
    } else if (_currentStep == 2) {
      return _buildStudentsStep();
    } else {
      return _buildReviewStep();
    }
  }

  // --- STEP 1: TEACHERS MIGRATION ---
  Widget _buildTeachersStep() {
    final activeTeachers = _staff.where((s) {
      final role = (s['role'] ?? '').toString().toUpperCase();
      final status = (s['status'] ?? '').toString().toUpperCase();
      return (role == 'TEACHER' || role == 'Teacher') && status == 'ACTIVE';
    }).toList();

    final inactiveTeachersCount = _staff.where((s) {
      final role = (s['role'] ?? '').toString().toUpperCase();
      final status = (s['status'] ?? '').toString().toUpperCase();
      return (role == 'TEACHER' || role == 'Teacher') && status != 'ACTIVE';
    }).length;

    final selectedCount = _selectedTeachers.values.where((b) => b).length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ACTIVE TEACHERS MIGRATION',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$selectedCount of ${activeTeachers.length} Selected',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                ),
              ],
            ),
            if (inactiveTeachersCount > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Text(
                  'Inactive Teachers ($inactiveTeachersCount)',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (activeTeachers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Text(
                'No active teachers found to migrate.',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
            ),
          )
        else
          ...activeTeachers.map((t) {
            final tid = t['id'] is int ? t['id'] as int : int.tryParse(t['id'].toString()) ?? 0;
            final isChecked = _selectedTeachers[tid] == true;
            final tName = (t['name'] ?? 'Teacher').toString();

            final tPhoto = (t['photo_path'] ?? t['photo'] ?? t['staff_photo_path'] ?? '').toString();

            // Find subjects if any (do not show 'No subject assigned')
            final tSubjects = _subjects
                .where((sub) => (sub['teacher_name'] == tName || sub['teacher_id'] == tid))
                .map((sub) => sub['name']?.toString() ?? '')
                .where((n) => n.isNotEmpty)
                .toList();
            final String? subjectDisplay = tSubjects.isNotEmpty ? tSubjects.join(', ') : null;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isChecked ? const Color(0xFFD97706).withOpacity(0.5) : const Color(0xFFE2E8F0)),
              ),
              child: CheckboxListTile(
                value: isChecked,
                activeColor: const Color(0xFFD97706),
                dense: true,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                onChanged: (val) {
                  setState(() {
                    _selectedTeachers[tid] = val == true;
                  });
                },
                title: Text(
                  tName,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Color(0xFF0F172A)),
                ),
                subtitle: subjectDisplay != null
                    ? Text(
                        subjectDisplay,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      )
                    : null,
                secondary: _buildTeacherAvatar(tPhoto, tName, size: 38),
              ),
            );
          }).toList(),
      ],
    );
  }

  // --- STEP 2: STUDENTS PROMOTION ---
  Widget _buildStudentsStep() {
    final inactiveStudentsCount = _students.where((s) => (s['status'] ?? '').toString().toUpperCase() != 'ACTIVE').length;

    // Sort classes by predefined order then section
    final sortedClasses = List<dynamic>.from(_classes);
    sortedClasses.sort((a, b) {
      final idxA = getClassIndex(a['name']?.toString());
      final idxB = getClassIndex(b['name']?.toString());
      if (idxA != idxB) {
        if (idxA == -1) return 1;
        if (idxB == -1) return -1;
        return idxA.compareTo(idxB);
      }
      return (a['section'] ?? '').toString().compareTo((b['section'] ?? '').toString());
    });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'CLASS-WISE STUDENT PROMOTIONS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: Color(0xFF334155),
              ),
            ),
            if (inactiveStudentsCount > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Text(
                  'Inactive Students ($inactiveStudentsCount)',
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),

        // Highest Class Toggle Card
        if (_showHighestClassToggleCard && _nextClassName != null)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.school_rounded, size: 18, color: Color(0xFFD97706)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Promote $_highestClassName to $_nextClassName',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF78350F)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch.adaptive(
                      value: _promoteHighestClassToggle,
                      activeColor: const Color(0xFFD97706),
                      onChanged: _handleHighestClassToggleChange,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Do you want to promote students of your highest active class ($_highestClassName) to $_nextClassName in the new academic session (${widget.draftYear['name']})? If enabled, $_nextClassName will be automatically created upon migration and students will be promoted into it. If disabled, all $_highestClassName students will graduate as Alumni.',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF92400E), height: 1.35),
                ),
              ],
            ),
          ),

        // Classes list
        ...sortedClasses.map((c) {
          final cId = c['id'];
          final cName = (c['name'] ?? '').toString();
          final cSection = (c['section'] ?? '').toString();
          final cIdx = getClassIndex(cName);
          final isHighestClass = cIdx == _highestIdx;
          final isClass12 = cIdx >= getClassIndex('Class 12');
          final nextClassLabel = getNextClassLabel(cName);

          final showPromoteOption = !isClass12 && (!isHighestClass || _promoteHighestClassToggle);
          final showGraduateOption = isClass12 || (isHighestClass && !_promoteHighestClassToggle);

          // Get active students in this class
          final classStudents = _students.where((s) {
            return s['class_id']?.toString() == cId?.toString() &&
                (s['status'] ?? '').toString().toUpperCase() == 'ACTIVE';
          }).toList();

          classStudents.sort((a, b) {
            final rollA = int.tryParse((a['roll_no'] ?? a['roll_number'] ?? '0').toString()) ?? 0;
            final rollB = int.tryParse((b['roll_no'] ?? b['roll_number'] ?? '0').toString()) ?? 0;
            if (rollA > 0 && rollB > 0) return rollA.compareTo(rollB);
            final nameA = (a['name'] ?? a['student_name'] ?? '').toString();
            final nameB = (b['name'] ?? b['student_name'] ?? '').toString();
            return nameA.compareTo(nameB);
          });

          if (classStudents.isEmpty) return const SizedBox.shrink();

          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Class Header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
                    border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        cSection.isNotEmpty ? '$cName - $cSection' : cName,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${classStudents.length} Students',
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                        ),
                      ),
                    ],
                  ),
                ),

                // Student items
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: classStudents.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  itemBuilder: (context, i) {
                    final s = classStudents[i];
                    final sid = s['id'] is int ? s['id'] as int : int.tryParse(s['id'].toString()) ?? 0;
                    final sName = (s['name'] ?? s['student_name'] ?? 'Student #$sid').toString();
                    final rollNo = (s['roll_no'] ?? s['roll_number'] ?? '').toString();
                    final displayName = rollNo.isNotEmpty ? '$sName (${rollNo.padLeft(2, '0')})' : sName;

                    final currentAction = _studentActions[sid] ?? (showPromoteOption ? 'promote' : 'graduate_alumni');

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 12,
                            runSpacing: 4,
                            children: [
                              if (showPromoteOption)
                                _buildActionRadio(
                                  label: 'Promote $nextClassLabel',
                                  value: 'promote',
                                  groupValue: currentAction,
                                  onChanged: () => setState(() => _studentActions[sid] = 'promote'),
                                  activeColor: const Color(0xFFD97706),
                                ),
                              if (showGraduateOption)
                                _buildActionRadio(
                                  label: 'Graduate (Alumni)',
                                  value: 'graduate_alumni',
                                  groupValue: currentAction,
                                  onChanged: () => setState(() => _studentActions[sid] = 'graduate_alumni'),
                                  activeColor: const Color(0xFF4F46E5),
                                ),
                              _buildActionRadio(
                                label: 'Repeat',
                                value: 'repeat',
                                groupValue: currentAction,
                                onChanged: () => setState(() => _studentActions[sid] = 'repeat'),
                                activeColor: const Color(0xFFD97706),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _buildActionRadio({
    required String label,
    required String value,
    required String groupValue,
    required VoidCallback onChanged,
    required Color activeColor,
  }) {
    final isSelected = value == groupValue;
    return InkWell(
      onTap: onChanged,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? activeColor : const Color(0xFF94A3B8),
                  width: isSelected ? 4 : 1.5,
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? activeColor : const Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- STEP 3: REVIEW ---
  Widget _buildReviewStep() {
    final activeTeachersSelected = _selectedTeachers.values.where((b) => b).length;
    final inactiveTeachersCount = _staff.where((s) {
      final role = (s['role'] ?? '').toString().toUpperCase();
      final status = (s['status'] ?? '').toString().toUpperCase();
      return (role == 'TEACHER' || role == 'Teacher') && status != 'ACTIVE';
    }).length;

    final promotedCount = _studentActions.values.where((a) => a == 'promote').length;
    final repeatingCount = _studentActions.values.where((a) => a == 'repeat').length;
    final graduatedCount = _studentActions.values.where((a) => a == 'graduate_alumni' || a == 'graduate').length;
    final inactiveStudentsCount = _students.where((s) => (s['status'] ?? '').toString().toUpperCase() != 'ACTIVE').length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'FINAL MIGRATION REVIEW',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
            color: Color(0xFF334155),
          ),
        ),
        const SizedBox(height: 12),

        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.6,
          children: [
            _buildStatCard('Target Session', widget.draftYear['name']?.toString() ?? '', const Color(0xFFD97706)),
            _buildStatCard('Migrated Teachers', '$activeTeachersSelected', const Color(0xFF0F172A)),
            _buildStatCard('Inactive Teachers Skipped', '$inactiveTeachersCount', const Color(0xFFDC2626)),
            _buildStatCard('Students Promoted', '$promotedCount', const Color(0xFF0D9488)),
            _buildStatCard('Students Repeating', '$repeatingCount', const Color(0xFFD97706)),
            _buildStatCard('Inactive Students Skipped', '$inactiveStudentsCount', const Color(0xFFDC2626)),
          ],
        ),
        const SizedBox(height: 10),
        _buildStatCardWide('Graduated / Alumni', '$graduatedCount', const Color(0xFF4F46E5)),

        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF16A34A)),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'All existing academic data (fee payments, grades, attendance, logs) for the previous sessions will remain permanently preserved and locked.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF475569), height: 1.35),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String val, Color valColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.3),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            val,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: valColor),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCardWide(String title, String val, Color valColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.3),
          ),
          Text(
            val,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: valColor),
          ),
        ],
      ),
    );
  }

  Widget _buildFooterControls() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentStep > 1)
              Expanded(
                flex: 1,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: _isExecuting
                      ? null
                      : () => setState(() => _currentStep--),
                  child: const Text('Back', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                ),
              )
            else
              const Spacer(),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _currentStep == 3 ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: _isExecuting
                    ? null
                    : () {
                        if (_currentStep < 3) {
                          setState(() => _currentStep++);
                        } else {
                          _confirmAndExecuteMigration();
                        }
                      },
                child: _isExecuting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        _currentStep == 3 ? 'Execute Rollover Migration' : 'Next',
                        style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13.5),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

