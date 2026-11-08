import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'dart:convert';
import '../services/http_service.dart' as http;
import '../services/leave_service.dart';
import '../services/auth_service.dart';
import '../services/account_service.dart';
import '../main.dart';
import '../widgets/change_password_dialog.dart';
import 'full_screen_image_screen.dart';
import 'academic_year_migration_screen.dart';
import 'penalty_screen.dart';
import 'restrictions_screen.dart';
import '../widgets/verify_password_dialog.dart';
import 'set_app_lock_pin_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';

class SettingsScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole;
  final int? selectedStudentId;
  final bool? isPrincipal;
  final bool? isFeeCollector;

  const SettingsScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
    this.isPrincipal,
    this.isFeeCollector,
  }) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _userName = '';
  String _schoolName = '';
  String _userPhone = '';
  String _userPhoto = '';
  String _workingBaseUrl = '';
  bool _notificationsEnabled = true;
  String _currentTheme = 'Light Mode';
  
  List<dynamic> _children = [];
  int? _activeStudentId;

  bool _isFeeCollector = false;
  bool _isPrincipal = false;
  bool _isAppLockEnabled = false;
  List<dynamic> _academicYears = [];
  int? _selectedAcademicYearId;
  String _selectedAcademicYearName = '';
  String _selectedAcademicYearStatus = 'ACTIVE';

  DeletionRequest? _deletionRequest;
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    final role = widget.userRole.toUpperCase();
    _isPrincipal = widget.isPrincipal == true ||
        role == 'PRINCIPAL' ||
        role == 'SCHOOL_ADMIN' ||
        role == 'SUPER_ADMIN';
    _isFeeCollector = widget.isFeeCollector == true;
    _loadSettingsData();
    _loadDeletionRequest();
    _loadAppVersion();
  }

  /// Read the version out of the build rather than hardcoding it — a literal
  /// here is wrong the moment a new build ships, and it is the sort of thing
  /// users quote back in bug reports.
  Future<void> _loadAppVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() => _appVersion = '${info.version} (${info.buildNumber})');
      }
    } catch (_) {
      // Leave it blank rather than showing something untrue.
    }
  }

  AccountService get _accountService => AccountService(
        baseUrl: widget.leaveService.baseUrl,
        token: widget.leaveService.token,
      );

  Future<void> _loadDeletionRequest() async {
    try {
      final request = await _accountService.getDeletionRequest();
      if (mounted) setState(() => _deletionRequest = request);
    } catch (_) {
      // Non-critical: the tile still works, it just won't show pending state.
    }
  }

  Future<void> _loadSettingsData() async {
    final prefs = await SharedPreferences.getInstance();
    final role = (prefs.getString('user_role') ?? widget.userRole).toUpperCase();
    final bool isP = prefs.getBool('is_principal') == true ||
        widget.isPrincipal == true ||
        role == 'PRINCIPAL' ||
        role == 'SCHOOL_ADMIN' ||
        role == 'SUPER_ADMIN';
    final bool isFC = prefs.getBool('is_fee_collector') == true ||
        widget.isFeeCollector == true;

    if (mounted) {
      setState(() {
        _isPrincipal = isP;
        _isFeeCollector = isFC;
        _userName = prefs.getString('user_name') ?? 'User';
        _schoolName = (prefs.getString('school_name') ?? 'Shiksha Pilot Academy').toUpperCase();
        _userPhone = prefs.getString('user_phone') ?? '';
        _userPhoto = prefs.getString('user_photo') ?? '';
        _workingBaseUrl = prefs.getString('base_url') ?? '';
        _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
        _currentTheme = prefs.getString('theme_mode') ?? 'Light Mode';
        _activeStudentId = prefs.getInt('selected_student_id') ?? widget.selectedStudentId;
        _selectedAcademicYearStatus = prefs.getString('selected_academic_year_status') ?? 'ACTIVE';
        final currentUid = prefs.getInt('user_id') ?? 0;
        final currentPhone = (prefs.getString('user_phone') ?? '').trim();
        final hasUserLock = (currentPhone.isNotEmpty && prefs.getBool('app_lock_enabled_$currentPhone') == true) ||
            (currentUid > 0 && prefs.getBool('app_lock_enabled_user_$currentUid') == true);
        _isAppLockEnabled = hasUserLock;
        prefs.remove('is_app_lock_enabled');
        prefs.remove('app_lock_pin');
      });
    }

    if (role == 'PARENT' || role == 'STUDENT') {
      await _fetchChildrenList();
    }
    if (_canSwitchAcademicYear) {
      await _fetchAcademicYears();
    }
  }

  bool get _canSwitchAcademicYear {
    final role = widget.userRole.toUpperCase();
    return _isFeeCollector || role == 'SCHOOL_ADMIN' || role == 'SUPER_ADMIN' || role == 'PRINCIPAL';
  }

  bool get _canManagePenaltyAndPermission {
    return _isFeeCollector;
  }

  bool get _isPrincipalUser => _isPrincipal;

  Future<void> _fetchAcademicYears() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/academic-years');
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        List<dynamic> years = [];
        if (data is Map && data['academic_years'] != null) {
          years = List<dynamic>.from(data['academic_years']);
        } else if (data is Map && data['data'] != null) {
          years = List<dynamic>.from(data['data']);
        } else if (data is List) {
          years = List<dynamic>.from(data);
        }

        // Order: 1) Draft Academic Year at top, 2) Active Year below Draft, 3) Archived Years below Active
        int getStatusPriority(dynamic y) {
          final s = (y['status'] ?? '').toString().toUpperCase();
          final bool isCurrent = y['is_current'] == 1 || y['is_current'] == true;
          if (s == 'DRAFT') return 0; // Draft at top
          if (s == 'ACTIVE' || isCurrent) return 1; // Active below draft
          return 2; // Archived below active
        }

        years.sort((a, b) {
          final pA = getStatusPriority(a);
          final pB = getStatusPriority(b);
          if (pA != pB) return pA.compareTo(pB);
          final startA = (a['start_date'] ?? '').toString();
          final startB = (b['start_date'] ?? '').toString();
          return startB.compareTo(startA);
        });

        int? savedAyId = prefs.getInt('selected_academic_year_id');
        String savedAyName = prefs.getString('selected_academic_year_name') ?? '';
        String savedAyStatus = prefs.getString('selected_academic_year_status') ?? '';

        dynamic matched;
        if (savedAyId != null) {
          matched = years.firstWhere(
            (y) => (y['id'] is int ? y['id'] : int.tryParse(y['id'].toString())) == savedAyId,
            orElse: () => null,
          );
        }

        if (matched == null && years.isNotEmpty) {
          matched = years.firstWhere(
            (y) => y['is_current'] == 1 || y['is_current'] == true || (y['status'] ?? '').toString().toUpperCase() == 'ACTIVE',
            orElse: () => years.first,
          );
          savedAyId = (matched['id'] is int) ? matched['id'] : int.tryParse(matched['id'].toString());
        }

        if (matched != null) {
          savedAyName = matched['name']?.toString() ?? '';
          savedAyStatus = (matched['status'] ?? (matched['is_current'] == 1 ? 'ACTIVE' : '')).toString();
          if (savedAyId != null) {
            await prefs.setInt('selected_academic_year_id', savedAyId);
            await prefs.setString('selected_academic_year_name', savedAyName);
            await prefs.setString('selected_academic_year_status', savedAyStatus);
          }
        }

        if (mounted) {
          setState(() {
            _academicYears = years;
            _selectedAcademicYearId = savedAyId;
            _selectedAcademicYearName = savedAyName;
            _selectedAcademicYearStatus = savedAyStatus.isNotEmpty ? savedAyStatus : 'ACTIVE';
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching academic years in settings: $e');
    }
  }

  Future<void> _handleSwitchAcademicYear(int yearId, String yearName, String yearStatus) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('selected_academic_year_id', yearId);
    await prefs.setString('selected_academic_year_name', yearName);
    await prefs.setString('selected_academic_year_status', yearStatus);

    if (mounted) {
      setState(() {
        _selectedAcademicYearId = yearId;
        _selectedAcademicYearName = yearName;
        _selectedAcademicYearStatus = yearStatus;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Switched Academic Year to $yearName ($yearStatus)',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 3),
          backgroundColor: const Color(0xFF1E293B),
        ),
      );
    }
  }

  Future<void> _showSwitchAcademicYearSheet() async {
    final prefs = await SharedPreferences.getInstance();
    final role = (prefs.getString('user_role') ?? widget.userRole).toUpperCase();
    if (mounted) {
      setState(() {
        _isPrincipal = prefs.getBool('is_principal') == true ||
            widget.isPrincipal == true ||
            role == 'PRINCIPAL' ||
            role == 'SCHOOL_ADMIN' ||
            role == 'SUPER_ADMIN';
        _isFeeCollector = prefs.getBool('is_fee_collector') == true ||
            widget.isFeeCollector == true;
      });
    }

    if (_academicYears.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Loading academic sessions, please try again in a moment...'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _fetchAcademicYears();
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.calendar_month_rounded,
                        color: Color(0xFFD97706),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Switch Academic Year',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Select session to view student dues & deposit fees',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (_isPrincipalUser) ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () => _handleCreateDraftAcademicYear(ctx),
                      icon: const Icon(Icons.add_circle_outline_rounded, size: 16, color: Colors.white),
                      label: const Text(
                        'Create Draft AY',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(context).size.height * 0.45,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _academicYears.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final yr = _academicYears[index];
                      final yrId = yr['id'] is int ? yr['id'] as int : int.tryParse(yr['id'].toString()) ?? 0;
                      final yrName = (yr['name'] ?? '').toString();
                      final yrStatus = (yr['status'] ?? (yr['is_current'] == 1 ? 'ACTIVE' : '')).toString();
                      final isSelected = yrId == _selectedAcademicYearId;
                      final isCurrentActive = yrStatus.toUpperCase() == 'ACTIVE' || yr['is_current'] == 1;

                      return InkWell(
                        onTap: () => _onSelectAcademicYear(yr, ctx),
                        borderRadius: BorderRadius.circular(14),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFFEF3C7).withOpacity(0.4) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
                              width: isSelected ? 1.5 : 1.0,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? const Color(0xFFD97706)
                                      : (isCurrentActive ? const Color(0xFF10B981).withOpacity(0.12) : const Color(0xFFE2E8F0)),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  Icons.event_note_rounded,
                                  color: isSelected
                                      ? Colors.white
                                      : (isCurrentActive ? const Color(0xFF059669) : const Color(0xFF64748B)),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          yrName,
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                                            color: const Color(0xFF0F172A),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        _buildAyStatusBadge(yrStatus),
                                      ],
                                    ),
                                    if (yr['start_date'] != null && yr['end_date'] != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        '${yr['start_date']}  to  ${yr['end_date']}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              // Migrate button: ONLY for Principal, ONLY on Active year, NEVER on Draft year, NEVER for Fee Collector
                              if (_isPrincipalUser && isCurrentActive && yrStatus.toUpperCase() != 'DRAFT') ...[
                                const SizedBox(width: 6),
                                ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    _handleStartMigration(yr);
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD97706),
                                    foregroundColor: Colors.white,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                  child: const Text(
                                    'Migrate',
                                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colors.white),
                                  ),
                                ),
                              ],
                              if (isSelected) ...[
                                const SizedBox(width: 6),
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Color(0xFFD97706),
                                  size: 22,
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleCreateDraftAcademicYear(BuildContext? sheetContext) async {
    final hasDraft = _academicYears.any(
      (y) => (y['status'] ?? '').toString().toUpperCase() == 'DRAFT',
    );
    if (hasDraft) {
      if (sheetContext != null && sheetContext.mounted) {
        Navigator.pop(sheetContext);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A Draft academic year already exists. Promote or delete it first.'),
          backgroundColor: Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    String nextSessionName = '';
    String nextStartDate = '';
    String nextEndDate = '';

    final sorted = List<dynamic>.from(_academicYears);
    sorted.sort((a, b) {
      final endA = DateTime.tryParse(a['end_date']?.toString() ?? '') ?? DateTime(1970);
      final endB = DateTime.tryParse(b['end_date']?.toString() ?? '') ?? DateTime(1970);
      return endB.compareTo(endA);
    });

    if (sorted.isNotEmpty) {
      final nameStr = sorted[0]['name']?.toString() ?? '';
      final parts = nameStr.trim().split(RegExp(r'[-\u2013\u2014]'));
      if (parts.length == 2) {
        final start = int.tryParse(parts[0].trim()) ?? 0;
        final end = int.tryParse(parts[1].trim()) ?? 0;
        if (start > 0 && end > 0) {
          nextSessionName = '${start + 1}\u2013${end + 1}';
          nextStartDate = '${start + 1}-04-01';
          nextEndDate = '${end + 1}-03-31';
        }
      }
    }

    if (nextSessionName.isEmpty) {
      final curr = DateTime.now().year;
      nextSessionName = '$curr\u2013${curr + 1}';
      nextStartDate = '$curr-04-01';
      nextEndDate = '${curr + 1}-03-31';
    }

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
                      Icons.post_add_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Create Draft Academic Year',
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
                'Create upcoming academic session $nextSessionName ($nextStartDate to $nextEndDate) in Draft status?',
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
                    Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFFB45309)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'This session will remain in Draft mode until rollover migration. Live session records are completely untouched.',
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
                          'Create Draft',
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

    if (confirmed != true) return;

    if (sheetContext != null && sheetContext.mounted) {
      Navigator.pop(sheetContext);
    }

    if (!mounted) return;

    // Show persistent spinner loader modal dialog
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
                    'Creating Draft Academic Year...',
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
      final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/academic-years');

      final res = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'name': nextSessionName,
          'start_date': nextStartDate,
          'end_date': nextEndDate,
        }),
      );

      final data = json.decode(res.body);
      if (res.statusCode == 200 || res.statusCode == 201) {
        await _fetchAcademicYears();
        if (loaderCtx != null && loaderCtx!.mounted) {
          Navigator.pop(loaderCtx!);
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Draft Academic Year $nextSessionName created successfully.'),
            backgroundColor: const Color(0xFF15803D),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        if (loaderCtx != null && loaderCtx!.mounted) {
          Navigator.pop(loaderCtx!);
        }
        String msg = data['message'] ?? data['error'] ?? 'Failed to create Draft Academic Year.';
        if (data['errors'] != null && data['errors'] is Map) {
          final errs = (data['errors'] as Map).values.map((v) => v.toString()).join('\n');
          if (errs.isNotEmpty) msg = errs;
        }
        throw Exception(msg);
      }
    } catch (e) {
      if (loaderCtx != null && loaderCtx!.mounted) {
        Navigator.pop(loaderCtx!);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleStartMigration(dynamic selectedYear) async {
    final draftYear = _academicYears.firstWhere(
      (y) => (y['status'] ?? '').toString().toUpperCase() == 'DRAFT',
      orElse: () => null,
    );

    if (draftYear == null) {
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
                          'Draft Academic Year Required',
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
                  'A Draft Academic Year is required before migration can begin. No Draft Academic Year exists for the upcoming session.',
                  style: TextStyle(
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
                      Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFFB45309)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Create a Draft Academic Year first to set up student promotions and rollover structures safely.',
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
                          onPressed: () => Navigator.pop(ctx),
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
                          onPressed: () {
                            Navigator.pop(ctx);
                            _handleCreateDraftAcademicYear(null);
                          },
                          child: const Text(
                            'Create Draft AY',
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
      return;
    }

    final activeYear = _academicYears.firstWhere(
      (y) => (y['status'] ?? '').toString().toUpperCase() == 'ACTIVE' || y['is_current'] == 1,
      orElse: () => selectedYear,
    );

    bool penaltyConfigured = false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final res = await http.get(
        Uri.parse('${widget.leaveService.baseUrl}/api/school/late-payment-penalty-config'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (res.statusCode == 200) {
        final d = json.decode(res.body);
        penaltyConfigured = (d is Map && (d['configured'] == true || d['data']?['configured'] == true));
      }
    } catch (_) {}

    if (!penaltyConfigured) {
      if (!mounted) return;
      final proceed = await showDialog<bool>(
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
                        Icons.payments_rounded,
                        color: Color(0xFFD97706),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Text(
                          'Late Payment Penalty Alert',
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
                  'Students with outstanding dues will be migrated without any Late Payment Penalty being applied.\n\nIf you wish to charge a penalty on pending dues, configure it before proceeding with Academic Year Migration.\n\nYou may continue the migration without configuring a penalty if your school does not wish to apply one.',
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
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Continue Migration', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
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
      if (proceed != true) return;
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final res = await http.get(
        Uri.parse('${widget.leaveService.baseUrl}/api/school/financial-reports'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (res.statusCode == 200) {
        final d = json.decode(res.body);
        List<dynamic> reports = [];
        if (d is Map && d['reports'] is List) {
          reports = d['reports'];
        } else if (d is List) {
          reports = d;
        }

        final unsettledReport = reports.firstWhere(
          (r) => (r['status'] ?? '').toString() != 'Settled',
          orElse: () => null,
        );

        if (unsettledReport != null) {
          final repId = unsettledReport['report_id'] ?? 'Report';
          final repStatus = unsettledReport['status'] ?? 'Pending';
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
                              'Unsettled Financial Report',
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
                      'Cannot start Academic Year Migration because Financial Report \'$repId\' is currently in \'$repStatus\' status.\n\nPlease make sure all financial reports in the active session are settled or cleared before proceeding with migration.',
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
          return;
        }
      }
    } catch (err) {
      debugPrint('Failed to check financial reports: $err');
    }

    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => AcademicYearMigrationScreen(
          leaveService: widget.leaveService,
          activeYear: activeYear,
          draftYear: draftYear,
          academicYears: _academicYears,
          onMigrationSuccess: () async {
            await _fetchAcademicYears();
            if (mounted) setState(() {});
          },
        ),
      ),
    );
  }

  Future<void> _onSelectAcademicYear(dynamic targetYear, BuildContext bottomSheetContext) async {
    final int nextId = targetYear['id'] is int ? targetYear['id'] as int : int.tryParse(targetYear['id'].toString()) ?? 0;
    final String nextName = (targetYear['name'] ?? '').toString();
    final String nextStatus = (targetYear['status'] ?? (targetYear['is_current'] == 1 ? 'ACTIVE' : '')).toString();

    if (nextId == _selectedAcademicYearId) {
      Navigator.pop(bottomSheetContext);
      return;
    }

    final bool isLeavingActive = (_selectedAcademicYearStatus.toUpperCase() == 'ACTIVE') &&
        (nextStatus.toUpperCase() != 'ACTIVE' && targetYear['is_current'] != 1);

    if (isLeavingActive) {
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: true,
        builder: (dialogCtx) => Dialog(
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
                        Icons.swap_horiz_rounded,
                        color: Color(0xFFD97706),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          'Switch to $nextName ($nextStatus)?',
                          style: const TextStyle(
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
                  'All dashboards, fees, and student records will show $nextName data until you switch back.\n\nFees deposited for inactive or alumni students will be credited to the active academic year.',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.45),
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
                          onPressed: () => Navigator.pop(dialogCtx, false),
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
                          onPressed: () => Navigator.pop(dialogCtx, true),
                          child: const Text('Switch Year', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
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
    }

    if (!mounted) return;
    if (bottomSheetContext.mounted) {
      Navigator.pop(bottomSheetContext);
    }
    await _handleSwitchAcademicYear(nextId, nextName, nextStatus);
  }

  Widget _buildAyStatusBadge(String status) {
    final sUpper = status.toUpperCase();
    final bool isActive = sUpper == 'ACTIVE';
    final bool isDraft = sUpper == 'DRAFT';
    final Color bgColor = isActive
        ? const Color(0xFFDCFCE7)
        : (isDraft ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9));
    final Color textColor = isActive
        ? const Color(0xFF15803D)
        : (isDraft ? const Color(0xFFB45309) : const Color(0xFF64748B));
    final Color borderColor = isActive
        ? const Color(0xFF86EFAC)
        : (isDraft ? const Color(0xFFFDE68A) : const Color(0xFFCBD5E1));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: borderColor, width: 0.8),
      ),
      child: Text(
        isActive ? 'Active' : (isDraft ? 'Draft' : 'Archived'),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: textColor,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  Future<void> _fetchChildrenList() async {
    try {
      final childrenList = await widget.leaveService.getChildren();
      if (mounted) {
        setState(() {
          _children = childrenList;
          if (_activeStudentId != null) {
            final active = _children.firstWhere(
              (c) {
                final cId = c['id'] is int ? c['id'] as int : int.parse(c['id'].toString());
                return cId == _activeStudentId;
              },
              orElse: () => null,
            );
            if (active != null) {
              _userName = active['name']?.toString() ?? _userName;
              _userPhoto = active['photo_path']?.toString() ?? _userPhoto;
            }
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading children in settings: $e');
    }
  }

  Future<void> _handleSwitchStudent(int childId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('selected_student_id', childId);
    
    final active = _children.firstWhere(
      (c) {
        final cId = c['id'] is int ? c['id'] as int : int.parse(c['id'].toString());
        return cId == childId;
      },
      orElse: () => null,
    );
    
    if (active != null) {
      final name = active['name']?.toString() ?? '';
      final photo = active['photo_path']?.toString() ?? '';
      await prefs.setString('user_name', name);
      await prefs.setString('user_photo', photo);
      
      setState(() {
        _userName = name;
        _userPhoto = photo;
        _activeStudentId = childId;
      });
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Switched profile to $_userName'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    final allKeys = prefs.getKeys();
    final preserved = <String, dynamic>{};
    for (final k in allKeys) {
      if (k.startsWith('app_lock_enabled_') || k.startsWith('app_lock_pin_') || k == 'base_url' || k == 'selected_base_url') {
        preserved[k] = prefs.get(k);
      }
    }
    await prefs.clear();
    for (final e in preserved.entries) {
      if (e.value is bool) await prefs.setBool(e.key, e.value as bool);
      else if (e.value is String) await prefs.setString(e.key, e.value as String);
      else if (e.value is int) await prefs.setInt(e.key, e.value as int);
    }

    appThemeNotifier.value = ThemeMode.light;

    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _showSwitchStudentDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          surfaceTintColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.swap_horiz_rounded,
                        color: Color(0xFF2563EB),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Switch Account',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Select student profile',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Container(
                  constraints: const BoxConstraints(maxHeight: 280),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _children.length,
                    itemBuilder: (context, index) {
                      final child = _children[index];
                      final childId = child['id'] as int;
                      final isCurrent = childId == _activeStudentId;

                      final childPhoto = child['photo_path']?.toString() ?? '';
                      Widget leadingWidget;
                      if (childPhoto.isNotEmpty) {
                        final String cleanPath = childPhoto.startsWith('/') ? childPhoto : '/$childPhoto';
                        final fullUrl = childPhoto.startsWith('http') ? childPhoto : '${widget.leaveService.baseUrl}$cleanPath';
                        leadingWidget = CircleAvatar(
                          backgroundImage: CachedNetworkImageProvider(fullUrl),
                          backgroundColor: const Color(0xFFEFF6FF),
                        );
                      } else {
                        leadingWidget = CircleAvatar(
                          backgroundColor: isCurrent ? const Color(0xFFD97706) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                          foregroundColor: isCurrent ? Colors.white : (isDark ? Colors.white70 : const Color(0xFF475569)),
                          child: const Icon(Icons.person, size: 20),
                        );
                      }

                      return Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          color: isCurrent
                              ? (isDark ? const Color(0xFF334155) : const Color(0xFFFEF3C7).withOpacity(0.5))
                              : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC)),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isCurrent ? const Color(0xFFD97706) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                          ),
                        ),
                        child: ListTile(
                          leading: leadingWidget,
                          title: Text(
                            child['name'] ?? '',
                            style: TextStyle(
                              fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                              color: isCurrent
                                  ? const Color(0xFFD97706)
                                  : (isDark ? Colors.white : const Color(0xFF0F172A)),
                            ),
                          ),
                          trailing: isCurrent ? const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706)) : null,
                          onTap: () {
                            Navigator.pop(context);
                            _handleSwitchStudent(childId);
                          },
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      'Close',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF475569),
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

  void _showChangePasswordDialog() {
    ChangePasswordDialog.show(
      context,
      baseUrl: widget.leaveService.baseUrl,
      token: widget.leaveService.token,
    );
  }

  Future<void> _handleAppLockTapped() async {
    final prefs = await SharedPreferences.getInstance();
    final token = widget.leaveService.token;
    final baseUrl = widget.leaveService.baseUrl;

    if (!_isAppLockEnabled) {
      final verified = await VerifyPasswordDialog.show(
        context,
        baseUrl: baseUrl,
        token: token,
        title: 'Verify Password to Set App Lock',
        actionButtonText: 'Verify & Continue',
      );
      if (verified == true && mounted) {
        final pinSet = await Navigator.push<bool>(
          context,
          MaterialPageRoute(builder: (_) => const SetAppLockPinScreen()),
        );
        if (pinSet == true && mounted) {
          setState(() => _isAppLockEnabled = true);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: const [
                  Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'App Lock enabled successfully.',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFFD97706),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      }
    } else {
      final verified = await VerifyPasswordDialog.show(
        context,
        baseUrl: baseUrl,
        token: token,
        title: 'Remove App Lock',
        actionButtonText: 'Verify & Remove Lock',
      );
      if (verified == true && mounted) {
        final uid = prefs.getInt('user_id') ?? 0;
        final phone = (prefs.getString('user_phone') ?? '').trim();
        await prefs.remove('is_app_lock_enabled');
        await prefs.remove('app_lock_pin');
        if (uid > 0) {
          await prefs.setBool('app_lock_enabled_user_$uid', false);
          await prefs.remove('app_lock_pin_user_$uid');
        }
        if (phone.isNotEmpty) {
          await prefs.setBool('app_lock_enabled_$phone', false);
          await prefs.remove('app_lock_pin_$phone');
        }
        if (mounted) {
          setState(() => _isAppLockEnabled = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: const [
                  Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'App Lock removed successfully.',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFFD97706),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      }
    }
  }

  void _showProfileDetails() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.person_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Profile Details',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Your account information',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                width: double.maxFinite,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDetailRow('NAME', _userName, isDark),
                    const Divider(height: 16),
                    _buildDetailRow('PHONE', _userPhone, isDark),
                    const Divider(height: 16),
                    _buildDetailRow('ASSOCIATED SCHOOL', _schoolName, isDark),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    'Close',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : const Color(0xFF475569),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10.5,
            color: Color(0xFF94A3B8),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value.isNotEmpty ? value : '-',
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  void _showThemeSelector() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final themeModes = [
          {
            'mode': 'Light Mode',
            'title': 'Light Mode',
            'desc': 'Clean and bright appearance',
            'icon': Icons.light_mode_rounded,
            'color': const Color(0xFFD97706),
            'bgColor': const Color(0xFFFEF3C7),
          },
          {
            'mode': 'Dark Mode',
            'title': 'Dark Mode',
            'desc': 'Easy on the eyes in low light',
            'icon': Icons.dark_mode_rounded,
            'color': const Color(0xFF6366F1),
            'bgColor': const Color(0xFFEEF2FF),
          },
          {
            'mode': 'System Defaults',
            'title': 'System Defaults',
            'desc': 'Follow your device system setting',
            'icon': Icons.settings_brightness_rounded,
            'color': const Color(0xFF0D9488),
            'bgColor': const Color(0xFFCCFBF1),
          },
        ];

        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          surfaceTintColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E8FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.palette_rounded,
                        color: Color(0xFF8B5CF6),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Appearance Theme',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Choose your preferred visual theme',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                ...themeModes.map((item) {
                  final mode = item['mode'] as String;
                  final isSelected = _currentTheme == mode;
                  final color = item['color'] as Color;
                  final bgColor = item['bgColor'] as Color;

                  return GestureDetector(
                    onTap: () async {
                      final prefs = await SharedPreferences.getInstance();
                      await prefs.setString('theme_mode', mode);
                      if (mode == 'Dark Mode') {
                        appThemeNotifier.value = ThemeMode.dark;
                      } else if (mode == 'System Defaults' || mode == 'System') {
                        appThemeNotifier.value = ThemeMode.system;
                      } else {
                        appThemeNotifier.value = ThemeMode.light;
                      }
                      setState(() {
                        _currentTheme = mode;
                      });
                      Navigator.pop(ctx);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                                const SizedBox(width: 8),
                                Text('Appearance theme set to $mode'),
                              ],
                            ),
                            behavior: SnackBarBehavior.floating,
                            backgroundColor: const Color(0xFF0F766E),
                          ),
                        );
                      }
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (isDark ? const Color(0xFF334155) : const Color(0xFFFEF3C7).withOpacity(0.5))
                            : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC)),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected ? const Color(0xFFD97706) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: bgColor,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(item['icon'] as IconData, color: color, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item['title'] as String,
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected
                                        ? const Color(0xFFD97706)
                                        : (isDark ? Colors.white : const Color(0xFF0F172A)),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item['desc'] as String,
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (isSelected)
                            const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706), size: 20)
                          else
                            Icon(
                              Icons.radio_button_unchecked_rounded,
                              color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1),
                              size: 20,
                            ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      'Close',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF475569),
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

  void _showHelpSupport() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.support_agent_rounded,
                      color: Color(0xFF0284C7),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Help & Support',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Customer & Technical Assistance',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.email_outlined, color: Color(0xFF0284C7), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Technical Support Email',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'support@shikshapilot.com',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0284C7),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Divider(height: 1),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.school_outlined, color: Color(0xFF0D9488), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'School Administration',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'For student, fee, or exam inquiries, please visit your school administrative office.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                  height: 1.3,
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
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Got it',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAboutDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.info_outline_rounded,
                      color: Color(0xFF475569),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Shiksha Pilot',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _appVersion.isEmpty ? 'v1.0.0' : 'Version $_appVersion',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Container(
                width: double.maxFinite,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                ),
                child: Text(
                  'Comprehensive school management suite for attendance, fees, examinations, timetables, and real-time updates for school admins, teachers, and parents.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                    height: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    'Close',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : const Color(0xFF475569),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFAF9F6),
      appBar: AppBar(
        title: Text(
          'Settings',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            color: isDark ? Colors.white : const Color(0xFF0F172A),
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 18,
            color: isDark ? Colors.white : const Color(0xFF1E293B),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0.5,
        scrolledUnderElevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDark ? 0.2 : 0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // 1. Change Password
                  _buildSettingsTile(
                    icon: Icons.lock_reset_rounded,
                    iconColor: const Color(0xFFD97706),
                    iconBgColor: const Color(0xFFFEF3C7),
                    title: 'Change Password',
                    subtitle: 'Update account password',
                    onTap: _showChangePasswordDialog,
                  ),
                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // App Lock
                  _buildSettingsTile(
                    icon: Icons.security_rounded,
                    iconColor: const Color(0xFF0F766E),
                    iconBgColor: const Color(0xFFCCFBF1),
                    title: 'App Lock',
                    subtitle: _isAppLockEnabled ? '4-Digit PIN Security Active' : 'Protect app with 4-digit PIN',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isAppLockEnabled) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF86EFAC)),
                            ),
                            child: const Text(
                              'Active',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 13,
                          color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                        ),
                      ],
                    ),
                    onTap: _handleAppLockTapped,
                  ),
                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // 2. Notifications
                  _buildSettingsTile(
                    icon: Icons.notifications_active_outlined,
                    iconColor: const Color(0xFF6366F1),
                    iconBgColor: const Color(0xFFEEF2FF),
                    title: 'Notifications',
                    subtitle: 'Toggle push alerts',
                    trailing: Switch(
                      value: _notificationsEnabled,
                      onChanged: (val) async {
                        final prefs = await SharedPreferences.getInstance();
                        await prefs.setBool('notifications_enabled', val);
                        setState(() {
                          _notificationsEnabled = val;
                        });
                      },
                      activeColor: Colors.white,
                      activeTrackColor: const Color(0xFFD97706),
                    ),
                  ),

                  // 3. Switch Account (if parent/student)
                  if ((widget.userRole.toUpperCase() == 'STUDENT' || widget.userRole.toUpperCase() == 'PARENT') && _children.length > 1) ...[
                    Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),
                    _buildSettingsTile(
                      icon: Icons.swap_horiz_rounded,
                      iconColor: const Color(0xFF2563EB),
                      iconBgColor: const Color(0xFFEFF6FF),
                      title: 'Switch Account',
                      subtitle: 'Change active student profile',
                      onTap: _showSwitchStudentDialog,
                    ),
                  ],

                  // 4. Switch Academic Year
                  if (_canSwitchAcademicYear) ...[
                    Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),
                    _buildSettingsTile(
                      icon: Icons.calendar_month_rounded,
                      iconColor: const Color(0xFF0D9488),
                      iconBgColor: const Color(0xFFCCFBF1),
                      title: 'Switch Academic Year',
                      subtitle: _selectedAcademicYearName.isNotEmpty
                          ? '$_selectedAcademicYearName (${_selectedAcademicYearStatus.toUpperCase()})'
                          : 'Select Academic Session',
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildAyStatusBadge(_selectedAcademicYearStatus),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 13,
                            color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                          ),
                        ],
                      ),
                      onTap: _showSwitchAcademicYearSheet,
                    ),
                  ],

                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // 5. Appearance Theme
                  _buildSettingsTile(
                    icon: Icons.palette_outlined,
                    iconColor: const Color(0xFF8B5CF6),
                    iconBgColor: const Color(0xFFF3E8FF),
                    title: 'Appearance Theme',
                    subtitle: _currentTheme,
                    onTap: _showThemeSelector,
                  ),

                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // 6. Help & Support
                  _buildSettingsTile(
                    icon: Icons.support_agent_rounded,
                    iconColor: const Color(0xFF0284C7),
                    iconBgColor: const Color(0xFFE0F2FE),
                    title: 'Help & Support',
                    subtitle: 'Get customer assistance',
                    onTap: _showHelpSupport,
                  ),

                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // 7. About
                  _buildSettingsTile(
                    icon: Icons.info_outline_rounded,
                    iconColor: const Color(0xFF475569),
                    iconBgColor: const Color(0xFFF1F5F9),
                    title: 'About',
                    subtitle: 'Application version info',
                    onTap: _showAboutDialog,
                  ),

                  if (_canManagePenaltyAndPermission) ...[
                    Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),
                    _buildSettingsTile(
                      icon: Icons.timer_outlined,
                      iconColor: const Color(0xFFD97706),
                      iconBgColor: const Color(0xFFFEF3C7),
                      title: 'Penalty',
                      subtitle: 'Late fee penalty configuration',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => PenaltyScreen(
                              leaveService: widget.leaveService,
                            ),
                          ),
                        );
                      },
                    ),
                    Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),
                    _buildSettingsTile(
                      icon: Icons.shield_outlined,
                      iconColor: const Color(0xFF4F46E5),
                      iconBgColor: const Color(0xFFE0E7FF),
                      title: 'Restrictions',
                      subtitle: 'Student document access restrictions',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => RestrictionsScreen(
                              leaveService: widget.leaveService,
                            ),
                          ),
                        );
                      },
                    ),
                  ],

                  Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9), indent: 64, endIndent: 16),

                  // 8. Delete Account
                  _buildSettingsTile(
                    icon: Icons.person_remove_outlined,
                    iconColor: const Color(0xFFDC2626),
                    iconBgColor: const Color(0xFFFEE2E2),
                    title: 'Delete my account',
                    subtitle: _deletionRequest?.isPending == true
                        ? 'Request pending with your school'
                        : 'Request removal of your account',
                    onTap: _showDeleteAccountSheet,
                    danger: true,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Entry point for PF-04. Shows the pending state if one exists, otherwise
  /// walks the user through confirming.
  Future<void> _showDeleteAccountSheet() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pending = _deletionRequest?.isPending == true ? _deletionRequest : null;

    if (pending != null) {
      final withdraw = await showDialog<bool>(
        context: context,
        builder: (ctx) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          surfaceTintColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.hourglass_top_rounded,
                        color: Color(0xFFD97706),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Deletion Pending',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Request under review',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    'Your school administrator has your account deletion request and will review it. Your account continues to work normally until then.\n\nDo you want to withdraw this request?',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155),
                      height: 1.4,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Keep request', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD97706),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
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

      if (withdraw != true) return;

      try {
        await _accountService.cancelDeletion(pending.id);
        if (!mounted) return;
        setState(() => _deletionRequest = null);
        _toast('Deletion request withdrawn.');
      } catch (e) {
        if (mounted) _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
      }
      return;
    }

    final reasonController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.person_remove_outlined,
                      color: Color(0xFFDC2626),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Delete My Account',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Irreversible action',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFFDC2626),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF450A0A).withOpacity(0.2) : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'This sends an account deletion request to your school administrator:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '• Your login credentials will be permanently deactivated.\n• Profile details and personal contact information will be removed.\n• Historical fees, marks, and attendance records stay with your school.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFFB91C1C), height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: reasonController,
                maxLines: 2,
                maxLength: 250,
                style: TextStyle(fontSize: 13, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                decoration: InputDecoration(
                  hintText: 'Reason for deletion (optional)',
                  hintStyle: TextStyle(fontSize: 12, color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF475569),
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
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Request Deletion', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
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

    if (confirmed != true) {
      reasonController.dispose();
      return;
    }

    final reason = reasonController.text.trim();
    reasonController.dispose();

    try {
      await _accountService.requestDeletion(reason: reason.isEmpty ? null : reason);
      await _loadDeletionRequest();
      if (!mounted) return;
      _toast('Request sent to your school administrator.');
    } catch (e) {
      if (mounted) _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    }
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red.shade700 : null,
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
    bool danger = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: danger ? const Color(0xFFDC2626) : (isDark ? Colors.white : const Color(0xFF0F172A)),
                        letterSpacing: 0.1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null)
                trailing
              else
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
