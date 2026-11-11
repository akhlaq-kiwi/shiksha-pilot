import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/config.dart';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/services.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:school_hub/services/leave_service.dart';
import 'package:school_hub/services/auth_service.dart';
import 'package:school_hub/screens/leave_list_screen.dart';
import 'package:school_hub/screens/settings_screen.dart';
import 'package:school_hub/screens/attendance_screen.dart';
import 'package:school_hub/screens/fees_card_screen.dart';
import 'package:school_hub/screens/salary_card_screen.dart';
import 'package:school_hub/screens/notification_center_screen.dart';
import 'package:school_hub/screens/notice_screen.dart';
import 'package:school_hub/screens/timetable_screen.dart';
import 'package:school_hub/services/attendance_service.dart';
import 'package:school_hub/services/notification_helper.dart';
import 'package:school_hub/services/push_notification_service.dart';
import 'package:school_hub/services/local_notification_scheduler.dart';
import 'package:school_hub/services/student_session_helper.dart';
import 'package:school_hub/screens/full_screen_image_screen.dart';
import 'package:workmanager/workmanager.dart';
import 'package:school_hub/main.dart';
import 'package:school_hub/services/exam_service.dart';
import 'package:school_hub/screens/exam_list_screen.dart';
import 'package:school_hub/screens/achievements_screen.dart';
import 'package:school_hub/screens/homework_list_screen.dart';
import 'package:school_hub/screens/outstanding_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:school_hub/screens/user_profile_screen.dart';
import 'package:school_hub/widgets/change_password_dialog.dart';
import 'package:school_hub/screens/teacher_qr_scanner_screen.dart';
import 'package:school_hub/screens/teacher_attendance_history_screen.dart';
import 'package:school_hub/screens/question_paper_designer_screen.dart';
import 'package:school_hub/screens/principal_tar_screen.dart';
import 'package:school_hub/screens/fees_portal_screen.dart';
import 'package:school_hub/screens/teacher_salary_disbursement_screen.dart';
import 'package:school_hub/screens/class_teacher_assignment_screen.dart';
import 'package:school_hub/screens/expense_screen.dart';
import 'package:school_hub/services/expense_service.dart';
import 'package:school_hub/screens/teachers_screen.dart';
import 'package:school_hub/services/teacher_management_service.dart';
import 'package:school_hub/screens/classes_screen.dart';
import 'package:school_hub/services/class_management_service.dart';
import 'package:school_hub/screens/revenue_screen.dart';
import 'package:school_hub/services/financial_report_service.dart';
import 'package:school_hub/screens/principal_examinations_screen.dart';
import 'package:school_hub/services/school_examination_service.dart';
import 'package:school_hub/screens/fee_reminder_screen.dart';
import 'package:school_hub/services/fee_reminder_service.dart';
import 'package:school_hub/screens/manage_discount_screen.dart';
import 'package:school_hub/services/fee_service.dart';

class LauncherFeature {
  final String name;
  final IconData icon;
  final Color color;
  final List<String> allowedRoles;
  final bool isAvailable;

  LauncherFeature({
    required this.name,
    required this.icon,
    required this.color,
    required this.allowedRoles,
    this.isAvailable = false,
  });
}

class HomeScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole;
  final int? selectedStudentId;
  final bool? isPrincipal;
  final bool? isFeeCollector;
  final String? userPhoto;
  final String? userName;
  final String? schoolName;

  const HomeScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
    this.isPrincipal,
    this.isFeeCollector,
    this.userPhoto,
    this.userName,
    this.schoolName,
  }) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  Timer? _notifTimer;
  String _userName = '';
  String _userRoleDisplay = '';
  late String _schoolName = (widget.schoolName != null && widget.schoolName!.trim().isNotEmpty)
      ? widget.schoolName!.trim().toUpperCase()
      : '';
  String _userPhone = '';
  int? _activeStudentId;
  String _activeStudentName = '';
  String _activeStudentClass = '';
  String _userPhoto = '';
  bool _isPrincipal = false;
  bool _isFeeCollector = false;
  String _workingBaseUrl = '';
  
  List<dynamic> _children = [];
  bool _isLoadingChildren = false;
  String _searchQuery = '';
  int _unreadNotificationCount = 0;
  Future<void>? _currentNotificationsFetch;
  int _notificationsFetchSeq = 0;
  int _unreadNoticeCount = 0;
  int _unreadExpenseCount = 0;
  int _unreadFinancialReportCount = 0;
  int _latestPendingExpenseMaxId = 0;
  int _latestPendingReportMaxId = 0;
  int _latestPendingDiscountMaxId = 0;
  Future<void>? _currentNoticesFetch;
  int _noticesFetchSeq = 0;
  int _unreadTimetableCount = 0;
  int _unreadSalaryCount = 0;
  int _unreadExamsCount = 0;
  int _unreadFeeReminderCount = 0;
  int _unreadDiscountRequestCount = 0;
  int _unreadTarCount = 0;
  int _unreadFeesPortalCount = 0;
  int _unreadLeaveCount = 0;
  int _unreadAttendanceCount = 0;
  int _unreadFeesCount = 0;
  int _unreadHomeworkCount = 0;
  int _unreadAchievementsCount = 0;
  DateTime? _lastBackPressTime;
  
  final TextEditingController _searchController = TextEditingController();

  // Unified list of features in system
  final List<LauncherFeature> _allFeatures = [
    LauncherFeature(
      name: 'Attendance',
      icon: Icons.calendar_month_rounded,
      color: Colors.teal,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Leaves',
      icon: Icons.edit_document,
      color: Colors.amber.shade800,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Fees Card',
      icon: Icons.payments_rounded,
      color: Colors.green,
      allowedRoles: ['PARENT', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Scanner',
      icon: Icons.qr_code_scanner_rounded,
      color: Colors.indigo,
      allowedRoles: ['TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Salary',
      icon: Icons.currency_rupee_rounded,
      color: Colors.teal,
      allowedRoles: ['TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Homework',
      icon: Icons.menu_book_rounded,
      color: Colors.indigo,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Timetable',
      icon: Icons.schedule_rounded,
      color: const Color(0xFFC26600),
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Examinations',
      icon: Icons.assignment_turned_in_rounded,
      color: Colors.red,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Notice Board',
      icon: Icons.campaign_rounded,
      color: Colors.orange.shade700,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Notifications',
      icon: Icons.notifications_rounded,
      color: Colors.indigo,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Settings',
      icon: Icons.settings_rounded,
      color: Colors.grey.shade700,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Outstanding',
      icon: Icons.receipt_long_rounded,
      color: Colors.cyan,
      allowedRoles: ['TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Achievements',
      icon: Icons.emoji_events_rounded,
      color: Colors.amber.shade700,
      allowedRoles: ['PARENT', 'STUDENT', 'TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Paper Designer',
      icon: Icons.design_services_rounded,
      color: Colors.deepOrange,
      allowedRoles: ['TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'TAR',
      icon: Icons.assignment_ind_rounded,
      color: const Color(0xFF0F766E),
      allowedRoles: ['TEACHER', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Fees Portal',
      icon: Icons.account_balance_rounded,
      color: const Color(0xFFD97706),
      allowedRoles: ['TEACHER', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'TSD',
      icon: Icons.payments_rounded,
      color: const Color(0xFF0D9488),
      allowedRoles: ['TEACHER', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Expense',
      icon: Icons.receipt_long_rounded,
      color: const Color(0xFFE11D48),
      allowedRoles: ['TEACHER', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Class Assignment',
      icon: Icons.supervised_user_circle_rounded,
      color: const Color(0xFF1E3A8A),
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Faculty',
      icon: Icons.badge_rounded,
      color: const Color(0xFF0D9488),
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Classes',
      icon: Icons.meeting_room_rounded,
      color: const Color(0xFFD97706),
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Financial Report',
      icon: Icons.trending_up_rounded,
      color: const Color(0xFFD97706),
      allowedRoles: ['TEACHER', 'FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Fee Reminder',
      icon: Icons.pending_actions_rounded,
      color: const Color(0xFFD97706),
      allowedRoles: ['FEE_COLLECTOR'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Manage Discount',
      icon: Icons.percent_rounded,
      color: const Color(0xFFD97706),
      allowedRoles: ['SCHOOL_ADMIN'],
      isAvailable: true,
    ),
  ];


  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _activeStudentId = widget.selectedStudentId;
    if (widget.isPrincipal == true) _isPrincipal = true;
    if (widget.isFeeCollector == true) _isFeeCollector = true;
    if (widget.userPhoto != null && widget.userPhoto!.isNotEmpty) _userPhoto = widget.userPhoto!;
    if (widget.userName != null && widget.userName!.isNotEmpty) _userName = widget.userName!;
    _loadSessionInfo();
    _fetchChildrenList();
    _notifTimer = Timer.periodic(const Duration(minutes: 5), (timer) {
      _fetchUnreadNotificationsCount();
      _fetchUnreadNoticesCount();
      _fetchPendingExpenseCount();
      _fetchPendingFinancialReportCount();
      _fetchPendingDiscountRequestCount();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notifTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      Workmanager().registerOneOffTask(
        "oneoff_fetch_background_${DateTime.now().millisecondsSinceEpoch}",
        fetchNotificationsTask,
        initialDelay: const Duration(seconds: 5),
        existingWorkPolicy: ExistingWorkPolicy.append,
      );
    }
  }

  String _buildFullPhotoUrl(String photoUrl) {
    if (photoUrl.isEmpty) return '';
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return photoUrl;
    }
    final String base = (_workingBaseUrl.isNotEmpty && !_workingBaseUrl.contains('127.0.0.1'))
        ? _workingBaseUrl
        : widget.leaveService.baseUrl;
    final cleanBase = base.replaceAll(RegExp(r'/+$'), '');
    final cleanPath = photoUrl.startsWith('/') ? photoUrl : '/$photoUrl';
    return '$cleanBase$cleanPath';
  }

  Future<void> _loadSessionInfo() async {
    final prefs = await SharedPreferences.getInstance();
    final roleUpper = widget.userRole.toUpperCase();
    final isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
    final savedId = StudentSessionHelper.readSavedStudentId(prefs);
    final savedSchool = prefs.getString('school_name') ?? '';
    final prefsName = (prefs.getString('user_name') ?? '').trim();
    final savedName = (roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'ADMIN')
        ? 'Admin'
        : (prefsName.isNotEmpty
            ? prefsName
            : ((widget.userName != null && widget.userName!.isNotEmpty)
                ? widget.userName!
                : 'User'));
    final hasSavedPhoto = prefs.containsKey('user_photo');
    final savedPhoto = prefs.getString('user_photo') ?? '';

    // Immediately reflect cached data in state without waiting for network/background tasks!
    if (mounted) {
      setState(() {
        if (_schoolName.isEmpty) {
          _schoolName = (savedSchool.isNotEmpty ? savedSchool : 'Shiksha Pilot Academy').toUpperCase();
        }
        _userName = savedName;
        _userPhone = prefs.getString('user_phone') ?? '';
        _userPhoto = isStudentOrParent && hasSavedPhoto
            ? savedPhoto
            : (savedPhoto.isNotEmpty ? savedPhoto : (widget.userPhoto ?? _userPhoto));
        _isPrincipal = (prefs.getBool('is_principal') == true) ||
            (widget.isPrincipal == true) ||
            (roleUpper == 'PRINCIPAL');
        _isFeeCollector = (prefs.getBool('is_fee_collector') == true) ||
            (widget.isFeeCollector == true);

        if (isStudentOrParent && savedId != null) {
          if (_activeStudentId != null && _activeStudentId != savedId) {
            _notificationsFetchSeq++;
            _noticesFetchSeq++;
            _unreadNotificationCount = 0;
            _unreadNoticeCount = 0;
            _unreadLeaveCount = 0;
            _unreadTimetableCount = 0;
            _unreadSalaryCount = 0;
            _unreadExamsCount = 0;
            _unreadFeeReminderCount = 0;
            _unreadTarCount = 0;
            _unreadFeesPortalCount = 0;
            _unreadAttendanceCount = 0;
            _unreadFeesCount = 0;
            _unreadHomeworkCount = 0;
            _unreadAchievementsCount = 0;
          }
          _activeStudentId = savedId;
        }
        
        if (roleUpper == 'PARENT') {
          _userRoleDisplay = 'Parent Profile';
        } else if (roleUpper == 'TEACHER') {
          if (_isPrincipal) {
            _userRoleDisplay = 'Teacher (Principal)';
          } else if (_isFeeCollector) {
            _userRoleDisplay = 'Teacher (Fee Collector)';
          } else {
            _userRoleDisplay = 'Teacher Profile';
          }
        } else if (roleUpper == 'SCHOOL_ADMIN') {
          _userRoleDisplay = 'School Admin Profile';
        } else if (roleUpper == 'PRINCIPAL') {
          _userRoleDisplay = 'Principal Profile';
        } else {
          _userRoleDisplay = roleUpper;
        }
      });
    }

    final savedBase = prefs.getString('base_url');
    if (savedBase != null && savedBase.isNotEmpty) {
      _workingBaseUrl = savedBase;
    } else {
      _workingBaseUrl = widget.leaveService.baseUrl;
      await prefs.setString('base_url', widget.leaveService.baseUrl);
    }
    await prefs.setString('user_role', widget.userRole);

    try {
      await PushNotificationService.init();
      await PushNotificationService.registerDevice();
    } catch (_) {}

    if (isStudentOrParent) {
      await _resolveActiveStudentName();
      if (_children.isEmpty && !_isLoadingChildren) {
        await _fetchChildrenList();
      }
    }

    // Refresh profile details dynamically in background to sync profile pictures immediately!
    final token = prefs.getString('auth_token');
    if (token != null && token.isNotEmpty) {
      _syncProfileDetails(token);
    }
    _fetchUnreadNotificationsCount();
    _fetchUnreadNoticesCount();
    _fetchPendingExpenseCount();
    _fetchPendingFinancialReportCount();
    _fetchPendingDiscountRequestCount();
  }

  Future<void> _syncProfileDetails(String token) async {
    try {
      final effectiveBase = (_workingBaseUrl.isNotEmpty && !_workingBaseUrl.contains('127.0.0.1'))
          ? _workingBaseUrl
          : widget.leaveService.baseUrl;
      final authService = AuthService(baseUrl: effectiveBase);
      final profile = await authService.fetchProfile(token);
      
      final latestPhoto = (profile['photo_path'] as String?) ?? (profile['staff_photo_path'] as String?) ?? '';
      final latestName = (profile['name'] as String?) ?? '';
      final latestSchool = (profile['school_name'] as String?) ?? '';
      final bool isPrincipal = profile['is_principal'] == true ||
          profile['is_principal'] == 1 ||
          profile['is_principal'] == '1' ||
          (profile['role']?.toString().toUpperCase() == 'PRINCIPAL');
      final bool isFeeCollector = profile['is_fee_collector'] == true ||
          profile['is_fee_collector'] == 1 ||
          profile['is_fee_collector'] == '1';
      
      final role = widget.userRole.toUpperCase();
      final isStaff = role == 'TEACHER' || role == 'SCHOOL_ADMIN' || role == 'PRINCIPAL';
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_principal', isPrincipal);
      await prefs.setBool('is_fee_collector', isFeeCollector);

      // /api/auth/profile always returns the primary users row (account owner).
      // For PARENT/STUDENT accounts with multiple siblings on one phone, overwriting
      // user_name/user_photo here would clobber the switched sibling's identity.
      if (isStaff) {
        if (latestPhoto.isNotEmpty) await prefs.setString('user_photo', latestPhoto);
        if (latestName.isNotEmpty) await prefs.setString('user_name', latestName);
      }
      if (latestSchool.isNotEmpty) await prefs.setString('school_name', latestSchool.toUpperCase());

      if (mounted) {
        setState(() {
          if (isStaff) {
            if (latestPhoto.isNotEmpty) _userPhoto = latestPhoto;
            if (latestName.isNotEmpty) _userName = latestName;
          }
          if (latestSchool.isNotEmpty) _schoolName = latestSchool.toUpperCase();
          _isPrincipal = isPrincipal;
          _isFeeCollector = isFeeCollector;
          if (role == 'TEACHER') {
            if (isPrincipal) {
              _userRoleDisplay = 'Teacher (Principal)';
            } else if (isFeeCollector) {
              _userRoleDisplay = 'Teacher (Fee Collector)';
            } else {
              _userRoleDisplay = 'Teacher Profile';
            }
          } else if (role == 'SCHOOL_ADMIN') {
            _userRoleDisplay = 'School Admin Profile';
          }
        });
      }
    } catch (e) {
      debugPrint('Error syncing profile details: $e');
    }
  }

  Future<void> _fetchChildrenList() async {
    final roleUpper = widget.userRole.toUpperCase();
    if (roleUpper != 'PARENT' && roleUpper != 'STUDENT') return;
    
    setState(() {
      _isLoadingChildren = true;
    });

    try {
      final childrenList = await widget.leaveService.getChildren();
      if (mounted) {
        setState(() {
          _children = childrenList;
          _isLoadingChildren = false;
        });
        await _resolveActiveStudentName();
        _fetchUnreadNotificationsCount();
        _fetchUnreadNoticesCount();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingChildren = false;
        });
      }
      debugPrint('Error loading children in Home: $e');
    }
  }

  Future<void> _resolveActiveStudentName() async {
    if (_children.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;

    final savedId = StudentSessionHelper.readSavedStudentId(prefs);
    final savedAdmNo = prefs.getString(StudentSessionHelper.prefSelectedStudentAdmissionNo);
    final savedName = prefs.getString(StudentSessionHelper.prefSelectedStudentName);
    final preferredId = _activeStudentId ?? widget.selectedStudentId ?? savedId;

    final active = StudentSessionHelper.resolveActiveChild(
      _children,
      preferredStudentId: preferredId,
      savedAdmissionNo: savedAdmNo,
      savedName: savedName,
    );
    if (active == null) return;

    final resolvedId = StudentSessionHelper.parseId(active['id']);
    if (resolvedId == null) return;

    final resolvedName = (active['name'] ?? '').toString().trim();
    final resolvedPhoto = (active['photo_path'] ?? active['photo'] ?? '').toString().trim();

    if (mounted) {
      setState(() {
        _activeStudentId = resolvedId;
        _activeStudentName = resolvedName;
        _activeStudentClass = active['class_name']?.toString() ?? '';
        _userName = resolvedName;
        _userPhoto = resolvedPhoto;
      });
    }

    await StudentSessionHelper.persistSelectedChild(prefs, active);
  }

  Future<void> _fetchUnreadNotificationsCount() async {
    final int seq = ++_notificationsFetchSeq;
    final Future<void>? previous = _currentNotificationsFetch;
    final Future<void> run = () async {
      if (previous != null) {
        try {
          await previous;
        } catch (_) {}
      }
      if (!mounted || seq != _notificationsFetchSeq) return;
      await _performFetchUnreadNotificationsCount(seq);
    }();
    _currentNotificationsFetch = run;
    await run;
    if (identical(_currentNotificationsFetch, run)) {
      _currentNotificationsFetch = null;
    }
  }

  Future<void> _performFetchUnreadNotificationsCount(int fetchSeq) async {
    final int? scopedStudentId = _activeStudentId;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted || fetchSeq != _notificationsFetchSeq) return;
      final token = prefs.getString('auth_token') ?? '';
      if (token.isEmpty) return;
      final baseUrl = widget.leaveService.baseUrl.isNotEmpty
          ? widget.leaveService.baseUrl
          : resolveBaseUrlFrom(prefs);

      final roleUpper = widget.userRole.toUpperCase();
      final String path;
      final bool isSchoolStaff;
      if (roleUpper == 'TEACHER' || roleUpper == 'PRINCIPAL') {
        path = '/api/teacher/notifications';
        isSchoolStaff = true;
      } else if (roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'SUPER_ADMIN') {
        path = '/api/school/notifications';
        isSchoolStaff = true;
      } else {
        path = '/api/student/notifications';
        isSchoolStaff = false;
      }

      final uri = Uri.parse('$baseUrl$path').replace(
        queryParameters: {
          'limit': '100',
          if (!isSchoolStaff && scopedStudentId != null) 'student_id': scopedStudentId.toString(),
        },
      );

      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (!isSchoolStaff && scopedStudentId != null) 'X-Student-Id': scopedStudentId.toString(),
      };

      final response = await http.get(uri, headers: headers);
      if (!mounted || fetchSeq != _notificationsFetchSeq) return;
      if (response.statusCode == 200) {
        final decodedBody = json.decode(response.body);
        final dynamic rawData = decodedBody is Map ? decodedBody['data'] : null;
        final List<dynamic> data = isSchoolStaff
            ? ((decodedBody is Map && decodedBody['notifications'] is List)
                ? decodedBody['notifications'] as List<dynamic>
                : (rawData is Map && rawData['notifications'] is List
                    ? rawData['notifications'] as List<dynamic>
                    : (rawData is List ? rawData : [])))
            : (rawData is List ? rawData : []);

        bool isUnread(dynamic n) =>
            n['is_read'] == 0 || n['is_read'] == false || n['is_read'] == '0';

        bool isNoticeNotif(dynamic n) {
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final catStr = (n['category'] ?? '').toString().toUpperCase();
          final evtStr = (n['event_key'] ?? '').toString().toUpperCase();
          return linkStr == '/notice' ||
              linkStr.contains('/notice') ||
              catStr == 'ANNOUNCEMENT' ||
              catStr == 'NOTICE' ||
              evtStr == 'ANNOUNCEMENT_PUBLISHED';
        }

        String? canonicalModuleOf(dynamic n) {
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final catStr = (n['category'] ?? '').toString().toUpperCase();
          final evtStr = (n['event_key'] ?? '').toString().toUpperCase();
          if (isNoticeNotif(n)) return 'notice';
          if (catStr == 'ACHIEVEMENT' ||
              evtStr.contains('ACHIEVEMENT') ||
              linkStr.contains('achievement')) {
            return 'achievements';
          }
          if (evtStr.contains('HOMEWORK') ||
              catStr == 'HOMEWORK' ||
              linkStr.contains('homework')) {
            return 'homework';
          }
          if (catStr == 'EXAM' ||
              evtStr.contains('EXAM') ||
              linkStr.contains('/exam')) {
            return 'exams';
          }
          if (evtStr.contains('TIMETABLE') ||
              evtStr == 'SUBSTITUTE_ASSIGNED' ||
              catStr == 'TIMETABLE' ||
              linkStr.contains('timetable')) {
            return 'timetable';
          }
          if (evtStr.contains('LEAVE') ||
              evtStr == 'HOLIDAY_ANNOUNCED' ||
              catStr == 'LEAVE' ||
              catStr == 'LEAVE_MANAGEMENT' ||
              linkStr.contains('leave')) {
            return 'leaves';
          }
          if (evtStr == 'LATE_TEACHERS_ALERT' ||
              linkStr.contains('teacher-attendance') ||
              linkStr.contains('/tar')) {
            return 'tar';
          }
          if (evtStr == 'ATTENDANCE_MARKED_ABSENT' ||
              catStr == 'ATTENDANCE' ||
              linkStr.contains('attendance')) {
            return 'attendance';
          }
          if (evtStr == 'SALARY_DISBURSED' ||
              evtStr.contains('SALARY') ||
              catStr == 'SALARY' ||
              catStr == 'FINANCE' ||
              linkStr.contains('salary')) {
            return 'salary';
          }
          if (evtStr.contains('FEE_REMINDER') ||
              evtStr.contains('FEE_FOLLOWUP') ||
              catStr == 'FEE_REMINDER' ||
              linkStr.contains('fee-reminder') ||
              linkStr.contains('fee-follow-up')) {
            return 'fee_reminder';
          }
          if (evtStr == 'DISCOUNT_REQUEST_APPROVED' ||
              evtStr == 'DISCOUNT_REQUEST_REJECTED' ||
              linkStr.contains('fees-portal')) {
            return 'fees_portal';
          }
          if (evtStr.startsWith('EXPENSE') ||
              evtStr.startsWith('FINANCIAL_REPORT') ||
              evtStr.startsWith('DISCOUNT_REQUEST')) {
            return 'admin_finance';
          }
          const feeEvents = {
            'FEE_ADMISSION_ADDED',
            'FEE_ANNUAL_ADDED',
            'FEE_TRANSPORT_GENERATED',
            'FEE_PAYMENT_RECORDED',
            'FEE_PAYMENT_REVERTED',
            'FEE_PENALTY_APPLIED',
            'FEE_DUE_REMINDER',
          };
          if (feeEvents.contains(evtStr) ||
              catStr == 'FEES' ||
              linkStr.contains('/student/fees') ||
              linkStr.contains('fees-card')) {
            return 'fees';
          }
          return null;
        }

        bool isTimetableNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'timetable';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('timetable') ||
              titleStr.contains('timetable') ||
              titleStr.contains('time table');
        }

        bool isSalaryNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'salary';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('salary') || titleStr.contains('salary');
        }

        bool isExamsNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'exams';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('exam') ||
              titleStr.contains('exam') ||
              titleStr.contains('examination') ||
              titleStr.contains('admit card') ||
              titleStr.contains('report card') ||
              titleStr.contains('scheme') ||
              titleStr.contains('datesheet');
        }

        bool isFeeReminderNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'fee_reminder';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('fee-reminder') ||
              linkStr.contains('fee-follow-up') ||
              titleStr.contains('fee reminder') ||
              titleStr.contains('fee follow-up') ||
              titleStr.contains('due today');
        }

        bool isLeaveNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'leaves';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('leave') ||
              titleStr.contains('leave') ||
              titleStr.contains('holiday');
        }

        bool isAttendanceNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'attendance';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('attendance') ||
              titleStr.contains('absent') ||
              titleStr.contains('attendance');
        }

        bool isFeesCardNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'fees';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('/student/fees') ||
              linkStr.contains('fees-card') ||
              titleStr.contains('fee deposited') ||
              titleStr.contains('fee payment') ||
              titleStr.contains('late payment penalty') ||
              titleStr.contains('admission fee') ||
              titleStr.contains('annual fee') ||
              titleStr.contains('transport fee');
        }

        bool isHomeworkNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'homework';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('homework') ||
              titleStr.contains('homework');
        }

        bool isAchievementsNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'achievements';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('achievement') ||
              titleStr.contains('achievement') ||
              titleStr.contains('certificate') ||
              titleStr.contains('champion') ||
              titleStr.contains('topper');
        }

        bool isTarNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'tar';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('teacher-attendance') ||
              linkStr.contains('/tar') ||
              titleStr.contains('late teacher');
        }

        bool isFeesPortalNotif(dynamic n) {
          final canon = canonicalModuleOf(n);
          if (canon != null) return canon == 'fees_portal';
          final linkStr = (n['link'] ?? '').toString().toLowerCase();
          final titleStr = (n['title'] ?? '').toString().toLowerCase();
          return linkStr.contains('fees-portal') ||
              titleStr.contains('discount request');
        }

        int count = data.where((n) {
          if (!isUnread(n)) return false;
          if (isNoticeNotif(n)) return false;
          if (roleUpper == 'SCHOOL_ADMIN' && isLeaveNotif(n)) return false;
          return true;
        }).length;

        int timetableCount = data.where((n) => isUnread(n) && isTimetableNotif(n)).length;
        int salaryCount = data.where((n) => isUnread(n) && isSalaryNotif(n)).length;
        int examsCount = data.where((n) => isUnread(n) && isExamsNotif(n)).length;
        int feeReminderCount = data.where((n) => isUnread(n) && isFeeReminderNotif(n)).length;
        int tarCount = isSchoolStaff ? data.where((n) => isUnread(n) && isTarNotif(n)).length : 0;
        int feesPortalCount = isSchoolStaff ? data.where((n) => isUnread(n) && isFeesPortalNotif(n)).length : 0;
        int leaveCount = roleUpper == 'SCHOOL_ADMIN' ? 0 : data.where((n) => isUnread(n) && isLeaveNotif(n)).length;
        int attendanceCount = !isSchoolStaff ? data.where((n) => isUnread(n) && isAttendanceNotif(n)).length : 0;
        int feesCount = !isSchoolStaff ? data.where((n) => isUnread(n) && isFeesCardNotif(n)).length : 0;
        int homeworkCount = !isSchoolStaff ? data.where((n) => isUnread(n) && isHomeworkNotif(n)).length : 0;
        int achievementsCount = data.where((n) => isUnread(n) && isAchievementsNotif(n)).length;

        if (mounted && fetchSeq == _notificationsFetchSeq) {
          setState(() {
            _unreadNotificationCount = count;
            _unreadTimetableCount = timetableCount;
            _unreadSalaryCount = salaryCount;
            _unreadExamsCount = examsCount;
            _unreadFeeReminderCount = feeReminderCount;
            _unreadTarCount = tarCount;
            _unreadFeesPortalCount = feesPortalCount;
            _unreadLeaveCount = leaveCount;
            _unreadAttendanceCount = attendanceCount;
            _unreadFeesCount = feesCount;
            _unreadHomeworkCount = homeworkCount;
            _unreadAchievementsCount = achievementsCount;
          });
        }

        if (data.isNotEmpty && fetchSeq == _notificationsFetchSeq) {
          final String lastNotifiedKey = (!isSchoolStaff && scopedStudentId != null)
              ? 'last_notified_id_${widget.userRole}_$scopedStudentId'
              : 'last_notified_id_${widget.userRole}';
          int lastNotifiedId = prefs.getInt(lastNotifiedKey) ?? 0;
          int maxId = lastNotifiedId;
          for (final n in data) {
            final int? nId = n['id'] is int ? n['id'] as int : int.tryParse(n['id']?.toString() ?? '');
            if (nId != null && nId > maxId) {
              maxId = nId;
            }
          }
          if (maxId > lastNotifiedId) {
            await prefs.setInt(lastNotifiedKey, maxId);
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  Future<void> _fetchUnreadNoticesCount() async {
    final int seq = ++_noticesFetchSeq;
    final Future<void>? previous = _currentNoticesFetch;
    final Future<void> run = () async {
      if (previous != null) {
        try {
          await previous;
        } catch (_) {}
      }
      if (!mounted || seq != _noticesFetchSeq) return;
      await _performFetchUnreadNoticesCount(seq);
    }();
    _currentNoticesFetch = run;
    await run;
    if (identical(_currentNoticesFetch, run)) {
      _currentNoticesFetch = null;
    }
  }

  Future<void> _performFetchUnreadNoticesCount(int fetchSeq) async {
    final int? scopedStudentId = _activeStudentId;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted || fetchSeq != _noticesFetchSeq) return;
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = widget.leaveService.baseUrl.isNotEmpty
          ? widget.leaveService.baseUrl
          : resolveBaseUrlFrom(prefs);

      final roleUpper = widget.userRole.toUpperCase();
      final bool isStudentOrParent = (roleUpper == 'PARENT' || roleUpper == 'STUDENT');

      final uri = Uri.parse('$baseUrl/api/student/announcements/unread-count').replace(
        queryParameters: (isStudentOrParent && scopedStudentId != null)
            ? {'student_id': scopedStudentId.toString()}
            : null,
      );
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (isStudentOrParent && scopedStudentId != null) 'X-Student-Id': scopedStudentId.toString(),
      };

      final response = await http.get(uri, headers: headers);
      if (!mounted || fetchSeq != _noticesFetchSeq) return;
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? decoded;
        final count = (data['unread_count'] as num?)?.toInt() ?? 0;
        if (mounted && fetchSeq == _noticesFetchSeq) {
          setState(() {
            _unreadNoticeCount = count;
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching unread notices count: $e');
    }
  }

  Future<void> _fetchPendingExpenseCount() async {
    final roleUpper = widget.userRole.toUpperCase();
    if (roleUpper != 'SCHOOL_ADMIN') return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = resolveBaseUrlFrom(prefs);
      final expService = ExpenseService(baseUrl: baseUrl, token: token);
      final info = await expService.getPendingExpenseBadgeInfo();
      final int unread = info['unread_count'] ?? 0;
      final int maxId = info['max_pending_id'] ?? 0;

      if (mounted) {
        setState(() {
          _unreadExpenseCount = unread;
          _latestPendingExpenseMaxId = maxId;
        });
      }
    } catch (e) {
      debugPrint('Error fetching pending expense count: $e');
    }
  }

  Future<void> _fetchPendingFinancialReportCount() async {
    final roleUpper = widget.userRole.toUpperCase();
    if (roleUpper != 'SCHOOL_ADMIN' && roleUpper != 'SUPER_ADMIN') return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = resolveBaseUrlFrom(prefs);
      final repService = FinancialReportService(baseUrl: baseUrl, token: token);
      final info = await repService.getPendingFinancialReportBadgeInfo();
      final int unread = info['unread_count'] ?? 0;
      final int maxId = info['max_pending_id'] ?? 0;

      if (mounted) {
        setState(() {
          _unreadFinancialReportCount = unread;
          _latestPendingReportMaxId = maxId;
        });
      }
    } catch (e) {
      debugPrint('Error fetching pending financial report count: $e');
    }
  }

  Future<void> _fetchPendingDiscountRequestCount() async {
    final roleUpper = widget.userRole.toUpperCase();
    if (roleUpper != 'SCHOOL_ADMIN' && roleUpper != 'SUPER_ADMIN') return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = resolveBaseUrlFrom(prefs);
      final feeService = FeeService(baseUrl: baseUrl, token: token);
      final isApprovalReq = await feeService.getDiscountApprovalRequired();
      if (!isApprovalReq) {
        if (mounted) {
          setState(() {
            _unreadDiscountRequestCount = 0;
            _latestPendingDiscountMaxId = 0;
          });
        }
        return;
      }
      final pendingData = await feeService.getDiscountRequests(status: 'PENDING');
      final dynamic summaryRaw = pendingData['summary'];
      final Map<String, dynamic> summary = summaryRaw is Map<String, dynamic>
          ? summaryRaw
          : (summaryRaw is Map ? Map<String, dynamic>.from(summaryRaw) : <String, dynamic>{});
      final int unread = (summary['unseen_pending'] as num?)?.toInt() ??
          ((summary['pending'] as num?)?.toInt() ?? 0);
      final int maxId = (summary['max_pending_id'] as num?)?.toInt() ?? 0;

      if (mounted) {
        setState(() {
          _unreadDiscountRequestCount = unread;
          _latestPendingDiscountMaxId = maxId;
        });
      }
    } catch (e) {
      debugPrint('Error fetching pending discount request count: $e');
    }
  }

  void _showPushNotificationToast(dynamic notif) {
    final title = notif['title'] ?? 'New Notification';
    final message = notif['message'] ?? '';

    if (widget.userRole.toUpperCase() == 'SCHOOL_ADMIN') {
      final cat = (notif['category'] ?? '').toString().toUpperCase();
      final link = (notif['link'] ?? notif['target_screen'] ?? '').toString().toLowerCase();
      final titleStr = title.toString().toLowerCase();
      final msgStr = message.toString().toLowerCase();
      if (cat == 'LEAVE' ||
          cat == 'LEAVE_MANAGEMENT' ||
          titleStr.contains('leave') ||
          msgStr.contains('leave') ||
          link.contains('leave')) {
        return;
      }
    }

    late OverlayEntry overlayEntry;
    overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 10,
        left: 16,
        right: 16,
        child: Material(
          color: Colors.transparent,
          child: GestureDetector(
            onTap: () async {
              overlayEntry.remove();

              // Handle deep linking on click
              final titleLower = title.toString().toLowerCase();
              final msgLower = message.toString().toLowerCase();
              final eventKey = (notif['event_key'] ?? '').toString().toUpperCase();
              final linkLower = (notif['link'] ?? '').toString().toLowerCase();

              final isLeaveApprovalOrReqNotif = titleLower.contains('approve') || titleLower.contains('reject') || msgLower.contains('approve') || msgLower.contains('reject') || titleLower.contains('request') || msgLower.contains('request');
              final isHolidayNotif = titleLower.contains('holiday') || msgLower.contains('holiday');
              if (eventKey == 'LATE_TEACHERS_ALERT' || linkLower.contains('teacher-attendance') || linkLower.contains('/tar') || titleLower.contains('late teacher')) {
                if (mounted) {
                  setState(() {
                    _unreadTarCount = 0;
                  });
                }
                final Future<void> markFuture = _markFeatureNotificationsRead('tar');
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => PrincipalTarScreen(
                      leaveService: widget.leaveService,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadTarCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('tar');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('leave') || msgLower.contains('leave') || isHolidayNotif) {
                if (mounted) {
                  setState(() {
                    _unreadLeaveCount = 0;
                  });
                }
                final Future<void> markFuture = _markFeatureNotificationsRead('leaves');
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => LeaveListScreen(
                      leaveService: widget.leaveService,
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      initialTabIndex: isLeaveApprovalOrReqNotif ? 1 : 0,
                      isPrincipal: _isPrincipal,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadLeaveCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('leaves');
                  await _loadSessionInfo();
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('timetable') || msgLower.contains('timetable')) {
                setState(() {
                  _unreadTimetableCount = 0;
                });
                final Future<void> markFuture = _markFeatureNotificationsRead('timetable');
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => TimetableScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      isPrincipal: _isPrincipal,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadTimetableCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('timetable');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('salary') || msgLower.contains('salary')) {
                setState(() {
                  _unreadSalaryCount = 0;
                });
                final Future<void> markFuture = _markFeatureNotificationsRead('salary');
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => SalaryCardScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadSalaryCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('salary');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('exam') || msgLower.contains('exam') ||
                  titleLower.contains('examination') || msgLower.contains('examination') ||
                  titleLower.contains('admit card') || msgLower.contains('admit card') ||
                  titleLower.contains('report card') || msgLower.contains('report card') ||
                  titleLower.contains('scheme') || msgLower.contains('scheme') ||
                  titleLower.contains('datesheet') || msgLower.contains('datesheet')) {
                setState(() {
                  _unreadExamsCount = 0;
                });
                final Future<void> markFuture = _markFeatureNotificationsRead('exams');
                final examService = ExamService(
                  baseUrl: widget.leaveService.baseUrl,
                  token: widget.leaveService.token,
                );
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => ExamListScreen(
                      examService: examService,
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      isPrincipal: _isPrincipal,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadExamsCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('exams');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('homework') || msgLower.contains('homework') || titleLower.contains('assignment') || msgLower.contains('assignment')) {
                final roleUpper = widget.userRole.toUpperCase();
                final bool isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
                Future<void>? markFuture;
                if (isStudentOrParent) {
                  setState(() {
                    _unreadHomeworkCount = 0;
                  });
                  markFuture = _markFeatureNotificationsRead('homework');
                }
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => HomeworkListScreen(
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      baseUrl: widget.leaveService.baseUrl,
                    ),
                  ),
                ).then((_) async {
                  if (isStudentOrParent) {
                    if (mounted) {
                      setState(() {
                        _unreadHomeworkCount = 0;
                      });
                    }
                    if (markFuture != null) await markFuture;
                    await _markFeatureNotificationsRead('homework');
                    if (mounted) {
                      await _fetchUnreadNotificationsCount();
                    }
                  }
                });
              } else if (eventKey == 'EXPENSE_APPROVAL_REQUEST' || linkLower.contains('expense') || titleLower.contains('expense') || msgLower.contains('expense')) {
                if (mounted) {
                  setState(() {
                    _unreadExpenseCount = 0;
                  });
                }
                final prefs = await SharedPreferences.getInstance();
                final token = prefs.getString('auth_token') ?? widget.leaveService.token;
                final effectiveBase = widget.leaveService.baseUrl.isNotEmpty
                    ? widget.leaveService.baseUrl
                    : resolveBaseUrlFrom(prefs);
                final expService = ExpenseService(baseUrl: effectiveBase, token: token);
                final Future<void> markSeenFuture = expService.markExpenseBadgeSeen(
                  maxId: _latestPendingExpenseMaxId > 0 ? _latestPendingExpenseMaxId : null,
                );
                final Future<void> markNotifFuture = _markFeatureNotificationsRead('expense');
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => ExpenseScreen(
                      baseUrl: effectiveBase,
                      token: token,
                      userRole: widget.userRole,
                    ),
                  ),
                ).then((_) async {
                  await markSeenFuture;
                  await markNotifFuture;
                  await _markFeatureNotificationsRead('expense');
                  if (mounted) {
                    await Future.wait([
                      _fetchPendingExpenseCount(),
                      _fetchUnreadNotificationsCount(),
                    ]);
                  }
                });
              } else if (eventKey == 'FINANCIAL_REPORT_APPROVAL_REQUEST' || titleLower.contains('financial report') || msgLower.contains('financial report') || titleLower.contains('settlement') || msgLower.contains('settlement')) {
                if (mounted) {
                  setState(() {
                    _unreadFinancialReportCount = 0;
                  });
                }
                final prefs = await SharedPreferences.getInstance();
                final token = prefs.getString('auth_token') ?? widget.leaveService.token;
                final effectiveBase = widget.leaveService.baseUrl.isNotEmpty
                    ? widget.leaveService.baseUrl
                    : resolveBaseUrlFrom(prefs);
                final repService = FinancialReportService(
                  baseUrl: effectiveBase,
                  token: token,
                );
                final Future<void> markSeenFuture = repService.markFinancialReportBadgeSeen(
                  maxId: _latestPendingReportMaxId > 0 ? _latestPendingReportMaxId : null,
                );
                final Future<void> markNotifFuture = _markFeatureNotificationsRead('financial_report');
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => RevenueScreen(
                      reportService: repService,
                      userRole: widget.userRole,
                      isFeeCollector: _isFeeCollector,
                    ),
                  ),
                ).then((_) async {
                  await markSeenFuture;
                  await markNotifFuture;
                  await _markFeatureNotificationsRead('financial_report');
                  if (mounted) {
                    await Future.wait([
                      _fetchPendingFinancialReportCount(),
                      _fetchUnreadNotificationsCount(),
                    ]);
                  }
                });
              } else if (titleLower.contains('fee reminder') || msgLower.contains('fee reminder') || titleLower.contains('fee follow-up') || msgLower.contains('fee follow-up') || eventKey == 'FEE_FOLLOWUP_DUE_TODAY') {
                if (mounted) {
                  setState(() {
                    _unreadFeeReminderCount = 0;
                  });
                }
                final Future<void> markFuture = _markFeatureNotificationsRead('fee_reminder');
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => FeeReminderScreen(
                      service: FeeReminderService(
                        baseUrl: widget.leaveService.baseUrl,
                        token: widget.leaveService.token,
                      ),
                      userRole: widget.userRole,
                      isPrincipal: _isPrincipal || (widget.userRole.toUpperCase() == 'SCHOOL_ADMIN'),
                      isFeeCollector: true,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadFeeReminderCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('fee_reminder');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('achievement') || msgLower.contains('achievement')) {
                if (mounted) {
                  setState(() {
                    _unreadAchievementsCount = 0;
                  });
                }
                final Future<void> markFuture = _markFeatureNotificationsRead('achievements');
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => AchievementsScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                      userRole: widget.userRole,
                      studentId: _activeStudentId,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadAchievementsCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('achievements');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else if (titleLower.contains('discount request') ||
                  msgLower.contains('discount request') ||
                  eventKey.contains('DISCOUNT_REQUEST')) {
                int? targetStudentId;
                try {
                  final rawLink = (notif['link'] ?? '').toString();
                  final cleanLink = rawLink.startsWith('http') ? rawLink : 'http://localhost$rawLink';
                  final uri = Uri.parse(cleanLink);
                  final idStr = uri.queryParameters['student_id'] ?? uri.queryParameters['studentId'];
                  if (idStr != null) targetStudentId = int.tryParse(idStr);
                } catch (_) {}
                if (targetStudentId == null && notif['student_id'] != null) {
                  targetStudentId = int.tryParse(notif['student_id'].toString());
                }
                if (mounted) {
                  setState(() {
                    _unreadFeesPortalCount = 0;
                  });
                }
                final Future<void> markFuture = _markFeatureNotificationsRead('fees_portal');
                final prefs = await SharedPreferences.getInstance();
                final token = prefs.getString('auth_token') ?? widget.leaveService.token;
                final baseUrl = resolveBaseUrlFrom(prefs);
                if (!mounted) return;
                Navigator.of(this.context).push(
                  MaterialPageRoute(
                    builder: (_) => FeesPortalScreen(
                      baseUrl: baseUrl,
                      token: token,
                      initialStudentId: targetStudentId,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadFeesPortalCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('fees_portal');
                  if (mounted) {
                    await Future.wait([
                      _fetchUnreadNotificationsCount(),
                      _fetchPendingDiscountRequestCount(),
                    ]);
                  }
                });
              } else if ((titleLower.contains('absent') || msgLower.contains('absent') || titleLower.contains('attendance')) && !(notif['event_key']?.toString() == 'LATE_TEACHERS_ALERT')) {
                final roleUpper = widget.userRole.toUpperCase();
                final bool isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
                Future<void>? markFuture;
                if (isStudentOrParent) {
                  setState(() {
                    _unreadAttendanceCount = 0;
                  });
                  markFuture = _markFeatureNotificationsRead('attendance');
                }
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AttendanceScreen(
                      attendanceService: AttendanceService(
                        baseUrl: widget.leaveService.baseUrl,
                        token: widget.leaveService.token,
                      ),
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                    ),
                  ),
                ).then((_) async {
                  if (isStudentOrParent) {
                    if (mounted) {
                      setState(() {
                        _unreadAttendanceCount = 0;
                      });
                    }
                    if (markFuture != null) await markFuture;
                    await _markFeatureNotificationsRead('attendance');
                    if (mounted) {
                      await _fetchUnreadNotificationsCount();
                    }
                  }
                });
              } else if ((titleLower.contains('fee') || msgLower.contains('fee')) && (widget.userRole.toUpperCase() == 'PARENT' || widget.userRole.toUpperCase() == 'STUDENT')) {
                setState(() {
                  _unreadFeesCount = 0;
                });
                final Future<void> markFuture = _markFeatureNotificationsRead('fees');
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => FeesCardScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                      studentId: _activeStudentId,
                    ),
                  ),
                ).then((_) async {
                  if (mounted) {
                    setState(() {
                      _unreadFeesCount = 0;
                    });
                  }
                  await markFuture;
                  await _markFeatureNotificationsRead('fees');
                  if (mounted) {
                    await _fetchUnreadNotificationsCount();
                  }
                });
              } else {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => NotificationCenterScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                      studentId: _activeStudentId,
                      userRole: widget.userRole,
                    ),
                  ),
                ).then((_) async {
                  await _markFeatureNotificationsRead('all');
                  await _loadSessionInfo();
                });
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.indigo.shade100, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  )
                ],
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.indigo.shade50,
                    radius: 20,
                    child: Icon(
                      title.toString().toLowerCase().contains('leave')
                          ? Icons.edit_document
                          : Icons.notifications_active_rounded,
                      color: Colors.indigo,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          message,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18, color: Colors.grey),
                    onPressed: () {
                      overlayEntry.remove();
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    Overlay.of(context).insert(overlayEntry);

    // Auto remove after 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      if (overlayEntry.mounted) {
        overlayEntry.remove();
      }
    });
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 17) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  }

  List<LauncherFeature> _getFilteredFeatures() {
    final role = widget.userRole.toUpperCase();
    final bool isSchoolAdmin = (role == 'SCHOOL_ADMIN');
    final bool isStaffTeacher = (role == 'TEACHER' || role == 'PRINCIPAL');

    if (isSchoolAdmin) {
      // School Admin explicit 12 features in exact ordered sequence:
      // 1 - Timetable
      // 2 - Examinations
      // 3 - Notifications
      // 4 - Settings
      // 5 - Achievements
      // 6 - TAR
      // 7 - TSD
      // 8 - Fees Portal
      // 9 - Financial report
      // 10 - Teachers
      // 11 - Classes
      // 12 - Expense
      const orderedFeatureNames = [
        'Fees Portal',
        'Expense',
        'Financial Report',
        'Fee Reminder',
        'TAR',
        'TSD',
        'Faculty',
        'Classes',
        'Manage Discount',
        'Examinations',
        'Achievements',
        'Notifications',
        'Settings',
      ];
      final Map<String, LauncherFeature> featureMap = {
        for (var f in _allFeatures) f.name: f
      };
      final List<LauncherFeature> schoolAdminFeatures = [];
      for (final name in orderedFeatureNames) {
        if (name == 'Fee Reminder' && !(_isFeeCollector == true)) continue;
        if (featureMap.containsKey(name)) {
          schoolAdminFeatures.add(featureMap[name]!);
        }
      }

      if (_searchQuery.trim().isEmpty) {
        return schoolAdminFeatures;
      }
      final query = _searchQuery.toLowerCase().trim();
      return schoolAdminFeatures.where((f) {
        if (f.name.toLowerCase().contains(query)) return true;
        if (f.name == 'Faculty' && (query.contains('teach') || 'teachers'.contains(query) || 'teacher'.contains(query))) return true;
        return false;
      }).toList();
    }
    
    // Filter and order for Teachers & Staff
    if (isStaffTeacher) {
      const teacherOrderedFeatureNames = [
        'Scanner',
        'Attendance',
        'Fees Portal',
        'Expense',
        'Financial Report',
        'Fee Reminder',
        'Notice Board',
        'TAR',
        'TSD',
        'Timetable',
        'Homework',
        'Examinations',
        'Leaves',
        'Notifications',
        'Salary',
        'Class Assignment',
        'Outstanding',
        'Classes',
        'Faculty',
        'Paper Designer',
        'Achievements',
        'Settings',
      ];

      final Map<String, LauncherFeature> featureMap = {
        for (var f in _allFeatures) f.name: f
      };
      final List<LauncherFeature> teacherFeatures = [];
      for (final name in teacherOrderedFeatureNames) {
        if (!featureMap.containsKey(name)) continue;
        final f = featureMap[name]!;

        // Permission check
        if (f.name == 'TAR') {
          if (!(_isPrincipal == true || role == 'PRINCIPAL')) continue;
        } else if (f.name == 'Fees Portal') {
          if (!(_isFeeCollector == true)) continue;
        } else if (f.name == 'TSD') {
          if (!(_isFeeCollector == true)) continue;
        } else if (f.name == 'Expense') {
          if (!(_isFeeCollector == true)) continue;
        } else if (f.name == 'Financial Report' || f.name == 'Financial report' || f.name == 'Revenue') {
          if (!(_isFeeCollector == true)) continue;
        } else if (f.name == 'Fee Reminder') {
          if (!(_isFeeCollector == true)) continue;
        } else if (f.name == 'Class Assignment' || f.name == 'Class assignment' || f.name == 'Class Teacher') {
          if (!(_isPrincipal == true || role == 'PRINCIPAL')) continue;
        } else if (f.name == 'Faculty' || f.name == 'Teachers') {
          if (!(_isPrincipal == true || role == 'PRINCIPAL' || _isFeeCollector == true)) continue;
        } else if (f.name == 'Classes') {
          if (!(_isPrincipal == true || role == 'PRINCIPAL' || _isFeeCollector == true)) continue;
        } else {
          if (!(f.allowedRoles.contains('TEACHER') || f.allowedRoles.contains('PRINCIPAL'))) continue;
        }

        teacherFeatures.add(f);
      }

      if (_searchQuery.trim().isEmpty) {
        return teacherFeatures;
      }
      final query = _searchQuery.toLowerCase().trim();
      return teacherFeatures.where((f) {
        if (f.name.toLowerCase().contains(query)) return true;
        if (f.name == 'Faculty' && (query.contains('teach') || 'teachers'.contains(query) || 'teacher'.contains(query))) return true;
        return false;
      }).toList();
    }

    // Role-scoped for Parents / Students
    final List<LauncherFeature> roleScoped = _allFeatures.where((f) {
      return f.allowedRoles.contains(role);
    }).toList();

    // Filter by search query
    if (_searchQuery.trim().isEmpty) {
      return roleScoped;
    }
    
    final query = _searchQuery.toLowerCase().trim();
    return roleScoped.where((f) {
      if (f.name.toLowerCase().contains(query)) return true;
      if (f.name == 'Faculty' && (query.contains('teach') || 'teachers'.contains(query) || 'teacher'.contains(query))) return true;
      return false;
    }).toList();
  }

  Future<void> _handleSwitchStudent(int childId) async {
    _notificationsFetchSeq++;
    _noticesFetchSeq++;
    final prefs = await SharedPreferences.getInstance();
    final matched = StudentSessionHelper.findChildById(_children, childId);
    if (matched != null) {
      await StudentSessionHelper.persistSelectedChild(prefs, matched);
    } else {
      await prefs.setInt('selected_student_id', childId);
    }
    
    setState(() {
      _activeStudentId = childId;
      _unreadNotificationCount = 0;
      _unreadNoticeCount = 0;
      _unreadLeaveCount = 0;
      _unreadTimetableCount = 0;
      _unreadSalaryCount = 0;
      _unreadExamsCount = 0;
      _unreadFeeReminderCount = 0;
      _unreadTarCount = 0;
      _unreadFeesPortalCount = 0;
      _unreadAttendanceCount = 0;
      _unreadFeesCount = 0;
      _unreadHomeworkCount = 0;
      _unreadAchievementsCount = 0;
    });
    await _resolveActiveStudentName();

    // Close bottom sheet
    if (mounted && Navigator.canPop(context)) {
      Navigator.pop(context);
    }
    _fetchUnreadNotificationsCount();
    _fetchUnreadNoticesCount();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Switched profile to $_activeStudentName'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    // Detach push and clear scheduled reminders BEFORE wiping prefs — both
    // need the auth token and the stored FCM token to do their work, and
    // prefs.clear() destroys them. Otherwise the next person to log in on a
    // shared family phone inherits this user's notifications.
    await PushNotificationService.unregisterDevice();
    await LocalNotificationScheduler.cancelAll();

    final prefs = await SharedPreferences.getInstance();
    final allKeys = prefs.getKeys();
    final preserved = <String, dynamic>{};
    for (final k in allKeys) {
      if (k.startsWith('app_lock_enabled_') || k.startsWith('app_lock_digest_') || k == 'base_url' || k == 'selected_base_url') {
        preserved[k] = prefs.get(k);
      }
    }
    await prefs.clear();
    for (final e in preserved.entries) {
      if (e.value is bool) await prefs.setBool(e.key, e.value as bool);
      else if (e.value is String) await prefs.setString(e.key, e.value as String);
      else if (e.value is int) await prefs.setInt(e.key, e.value as int);
    }

    if (mounted) {
      // Redirect to LoginScreen
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _showChangePasswordDialog() {
    ChangePasswordDialog.show(context, baseUrl: widget.leaveService.baseUrl);
  }

  void _navigateToProfileScreen() {
    String photoUrl = '';
    if (widget.userRole.toUpperCase() == 'PARENT' || widget.userRole.toUpperCase() == 'STUDENT') {
      final active = StudentSessionHelper.findChildById(_children, _activeStudentId);
      if (active != null) {
        photoUrl = (active['photo_path'] ?? active['photo'] ?? '').toString();
      } else {
        photoUrl = _userPhoto;
      }
    } else {
      photoUrl = _userPhoto;
    }

    final fullPhotoUrl = _buildFullPhotoUrl(photoUrl);
    final effectiveBase = (_workingBaseUrl.isNotEmpty && !_workingBaseUrl.contains('127.0.0.1'))
        ? _workingBaseUrl
        : widget.leaveService.baseUrl;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => UserProfileScreen(
          userName: _userName,
          userRole: widget.userRole,
          schoolName: _schoolName,
          userPhone: _userPhone,
          photoUrl: fullPhotoUrl,
          children: _children,
          activeStudentId: _activeStudentId,
          baseUrl: effectiveBase,
          onSwitchChild: (newId) async {
            _notificationsFetchSeq++;
            _noticesFetchSeq++;
            final prefs = await SharedPreferences.getInstance();
            final matched = StudentSessionHelper.findChildById(_children, newId);
            if (matched != null) {
              await StudentSessionHelper.persistSelectedChild(prefs, matched);
            } else {
              await prefs.setInt('selected_student_id', newId);
            }
            if (mounted) {
              setState(() {
                _activeStudentId = newId;
                _unreadNotificationCount = 0;
                _unreadNoticeCount = 0;
                _unreadLeaveCount = 0;
                _unreadTimetableCount = 0;
                _unreadSalaryCount = 0;
                _unreadExamsCount = 0;
                _unreadFeeReminderCount = 0;
                _unreadTarCount = 0;
                _unreadFeesPortalCount = 0;
                _unreadAttendanceCount = 0;
                _unreadFeesCount = 0;
                _unreadHomeworkCount = 0;
                _unreadAchievementsCount = 0;
              });
            }
            await _resolveActiveStudentName();
            await Future.wait([
              _fetchUnreadNotificationsCount(),
              _fetchUnreadNoticesCount(),
            ]);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Switched profile to $_activeStudentName'),
                  behavior: SnackBarBehavior.floating,
                  duration: const Duration(seconds: 2),
                ),
              );
            }
          },
        ),
      ),
    );
  }

  Future<void> _markFeatureNotificationsRead(String module) async {
    final int? scopedStudentId = _activeStudentId;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = widget.leaveService.baseUrl.isNotEmpty
          ? widget.leaveService.baseUrl
          : resolveBaseUrlFrom(prefs);

      final roleUpper = widget.userRole.toUpperCase();
      final bool isSchoolStaff = (roleUpper == 'TEACHER' ||
          roleUpper == 'PRINCIPAL' ||
          roleUpper == 'SCHOOL_ADMIN' ||
          roleUpper == 'SUPER_ADMIN');
      final String path = isSchoolStaff
          ? ((roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'SUPER_ADMIN')
              ? '/api/school/notifications/0/read'
              : '/api/teacher/notifications/0/read')
          : '/api/student/notifications/0/read';

      final uri = Uri.parse('$baseUrl$path').replace(
        queryParameters: (!isSchoolStaff && scopedStudentId != null)
            ? {'student_id': scopedStudentId.toString()}
            : null,
      );
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (!isSchoolStaff && scopedStudentId != null) 'X-Student-Id': scopedStudentId.toString(),
      };

      await http.post(
        uri,
        headers: headers,
        body: json.encode({'module': module}),
      );
    } catch (e) {
      debugPrint('Error marking $module notifications as read: $e');
    }
  }

  Future<void> _markAllNoticesRead() async {
    final int? scopedStudentId = _activeStudentId;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      if (token.isEmpty) return;
      final baseUrl = widget.leaveService.baseUrl.isNotEmpty
          ? widget.leaveService.baseUrl
          : resolveBaseUrlFrom(prefs);
      final roleUpper = widget.userRole.toUpperCase();
      final bool isStudentOrParent = (roleUpper == 'PARENT' || roleUpper == 'STUDENT');
      final uri = Uri.parse('$baseUrl/api/student/announcements/read-all').replace(
        queryParameters: (isStudentOrParent && scopedStudentId != null)
            ? {'student_id': scopedStudentId.toString()}
            : null,
      );
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (isStudentOrParent && scopedStudentId != null) 'X-Student-Id': scopedStudentId.toString(),
      };
      await http.post(uri, headers: headers);
    } catch (e) {
      debugPrint('Error marking notices as read: $e');
    }
  }

  void _onFeatureTap(LauncherFeature feature) async {
    if (feature.isAvailable) {
      if (feature.name == 'Leaves') {
        if (mounted) {
          setState(() {
            _unreadLeaveCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('leaves');
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => LeaveListScreen(
              leaveService: widget.leaveService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              initialTabIndex: 0, // Always open Official Holidays on normal icon click
              isPrincipal: _isPrincipal,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadLeaveCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('leaves');
        _loadSessionInfo();
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Settings') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SettingsScreen(
              leaveService: widget.leaveService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              isPrincipal: _isPrincipal,
              isFeeCollector: _isFeeCollector,
            ),
          ),
        ).then((_) => _loadSessionInfo());
      } else if (feature.name == 'Attendance') {
        final roleUpper = widget.userRole.toUpperCase();
        final bool isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
        Future<void>? markFuture;
        if (isStudentOrParent) {
          if (mounted) {
            setState(() {
              _unreadAttendanceCount = 0;
            });
          }
          markFuture = _markFeatureNotificationsRead('attendance');
        }
        final attService = AttendanceService(
          baseUrl: widget.leaveService.baseUrl,
          token: widget.leaveService.token,
        );
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AttendanceScreen(
              attendanceService: attService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
            ),
          ),
        );
        if (isStudentOrParent) {
          if (mounted) {
            setState(() {
              _unreadAttendanceCount = 0;
            });
          }
          if (markFuture != null) await markFuture;
          await _markFeatureNotificationsRead('attendance');
          if (mounted) {
            await _fetchUnreadNotificationsCount();
          }
        }
      } else if (feature.name == 'Fees Card') {
        if (mounted) {
          setState(() {
            _unreadFeesCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('fees');
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FeesCardScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: widget.leaveService.token,
              studentId: _activeStudentId,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadFeesCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('fees');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Scanner' || feature.name == 'Mark Attendance' || feature.name == 'Teacher Attendance') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TeacherAttendanceHistoryScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: widget.leaveService.token,
            ),
          ),
        );
      } else if (feature.name == 'Salary' || feature.name == 'Staff Salary' || feature.name == 'Salaries') {
        if (mounted) {
          setState(() {
            _unreadSalaryCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('salary');
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        final baseUrl = prefs.getString('base_url') ?? widget.leaveService.baseUrl;
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SalaryCardScreen(
              baseUrl: baseUrl,
              token: token,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadSalaryCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('salary');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Notice' || feature.name == 'Notice Board' || feature.name == 'Notices') {
        if (mounted) {
          setState(() {
            _unreadNoticeCount = 0;
          });
        }
        final Future<void> markNoticesFuture = _markAllNoticesRead();
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? '';
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => NoticeScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token.isNotEmpty ? token : widget.leaveService.token,
              userRole: widget.userRole,
              studentId: _activeStudentId,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadNoticeCount = 0;
          });
        }
        await markNoticesFuture;
        await _markAllNoticesRead();
        if (mounted) {
          await _fetchUnreadNoticesCount();
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Notifications' || feature.name == 'Messages') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? '';
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => NotificationCenterScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token.isNotEmpty ? token : widget.leaveService.token,
              studentId: _activeStudentId,
              userRole: widget.userRole,
            ),
          ),
        );
        final roleUpper = widget.userRole.toUpperCase();
        final bool isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
        if (mounted) {
          setState(() {
            _unreadNotificationCount = 0;
            if (isStudentOrParent) {
              _unreadLeaveCount = 0;
              _unreadAttendanceCount = 0;
              _unreadFeesCount = 0;
              _unreadHomeworkCount = 0;
              _unreadTimetableCount = 0;
              _unreadExamsCount = 0;
              _unreadAchievementsCount = 0;
            } else {
              _unreadLeaveCount = 0;
              _unreadTimetableCount = 0;
              _unreadSalaryCount = 0;
              _unreadExamsCount = 0;
              _unreadFeeReminderCount = 0;
              _unreadTarCount = 0;
              _unreadFeesPortalCount = 0;
              _unreadAchievementsCount = 0;
            }
          });
        }
        await _markFeatureNotificationsRead('all');
        if (mounted) {
          await Future.wait([
            _fetchUnreadNotificationsCount(),
            _fetchPendingExpenseCount(),
            _fetchPendingFinancialReportCount(),
            _fetchPendingDiscountRequestCount(),
          ]);
        }
      } else if (feature.name == 'Homework') {
        final roleUpper = widget.userRole.toUpperCase();
        final bool isStudentOrParent = roleUpper == 'PARENT' || roleUpper == 'STUDENT';
        Future<void>? markFuture;
        if (isStudentOrParent) {
          if (mounted) {
            setState(() {
              _unreadHomeworkCount = 0;
            });
          }
          markFuture = _markFeatureNotificationsRead('homework');
        }
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => HomeworkListScreen(
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              baseUrl: widget.leaveService.baseUrl,
            ),
          ),
        );
        if (isStudentOrParent) {
          if (mounted) {
            setState(() {
              _unreadHomeworkCount = 0;
            });
          }
          if (markFuture != null) await markFuture;
          await _markFeatureNotificationsRead('homework');
          if (mounted) {
            await _fetchUnreadNotificationsCount();
          }
        }
      } else if (feature.name == 'Timetable' || feature.name == 'Time Table') {
        if (mounted) {
          setState(() {
            _unreadTimetableCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('timetable');
        final prefs = await SharedPreferences.getInstance();
        final baseUrl = widget.leaveService.baseUrl.isNotEmpty
            ? widget.leaveService.baseUrl
            : resolveBaseUrlFrom(prefs);
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TimetableScreen(
              baseUrl: baseUrl,
              token: widget.leaveService.token,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              isPrincipal: _isPrincipal,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadTimetableCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('timetable');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Examinations' || feature.name == 'Exams' || feature.name == 'Exam') {
        if (mounted) {
          setState(() {
            _unreadExamsCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('exams');
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        final baseUrl = widget.leaveService.baseUrl.isNotEmpty
            ? widget.leaveService.baseUrl
            : resolveBaseUrlFrom(prefs);
        final examService = ExamService(
          baseUrl: baseUrl,
          token: token,
        );
        if (_isPrincipal || widget.userRole.toUpperCase() == 'PRINCIPAL' || widget.userRole.toUpperCase() == 'SCHOOL_ADMIN') {
          final schoolExamService = SchoolExaminationService(
            baseUrl: baseUrl,
            token: token,
          );
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PrincipalExaminationsScreen(
                examService: schoolExamService,
                leaveService: widget.leaveService,
                userRole: widget.userRole,
              ),
            ),
          );
        } else {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ExamListScreen(
                examService: examService,
                userRole: widget.userRole,
                selectedStudentId: _activeStudentId,
                isPrincipal: _isPrincipal,
              ),
            ),
          );
        }
        if (mounted) {
          setState(() {
            _unreadExamsCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('exams');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Achievements') {
        if (mounted) {
          setState(() {
            _unreadAchievementsCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('achievements');
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AchievementsScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token,
              userRole: widget.userRole,
              studentId: _activeStudentId,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadAchievementsCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('achievements');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Outstanding') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OutstandingScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token,
            ),
          ),
        );
      } else if (feature.name == 'Paper Designer' || feature.name == 'Question Paper Designer') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => QuestionPaperDesignerScreen(
              leaveService: widget.leaveService,
            ),
          ),
        );
      } else if (feature.name == 'TAR') {
        if (mounted) {
          setState(() {
            _unreadTarCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('tar');
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PrincipalTarScreen(
              leaveService: widget.leaveService,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadTarCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('tar');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Fees Portal') {
        if (mounted) {
          setState(() {
            _unreadFeesPortalCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('fees_portal');
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FeesPortalScreen(
              baseUrl: effectiveBase,
              token: token,
            ),
          ),
        );
        if (mounted) {
          setState(() {
            _unreadFeesPortalCount = 0;
          });
        }
        await markFuture;
        await _markFeatureNotificationsRead('fees_portal');
        if (mounted) {
          await Future.wait([
            _fetchUnreadNotificationsCount(),
            _fetchPendingDiscountRequestCount(),
          ]);
        }
      } else if (feature.name == 'TSD') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TeacherSalaryDisbursementScreen(
              baseUrl: effectiveBase,
              token: token,
            ),
          ),
        );
      } else if (feature.name == 'Expense') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }

        // Immediately clear badge count on tap and persist seen state on backend DB
        if (mounted) {
          setState(() {
            _unreadExpenseCount = 0;
          });
        }
        final expService = ExpenseService(baseUrl: effectiveBase, token: token);
        final Future<void> markSeenFuture = expService.markExpenseBadgeSeen(
          maxId: _latestPendingExpenseMaxId > 0 ? _latestPendingExpenseMaxId : null,
        );
        final Future<void> markNotifFuture = _markFeatureNotificationsRead('expense');

        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExpenseScreen(
              baseUrl: effectiveBase,
              token: token,
              userRole: widget.userRole,
            ),
          ),
        );
        await markSeenFuture;
        await markNotifFuture;
        await _markFeatureNotificationsRead('expense');
        if (mounted) {
          await Future.wait([
            _fetchPendingExpenseCount(),
            _fetchUnreadNotificationsCount(),
          ]);
        }
      } else if (feature.name == 'Class Assignment' || feature.name == 'Class assignment' || feature.name == 'Class Teacher') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ClassTeacherAssignmentScreen(
              baseUrl: effectiveBase,
              token: token,
            ),
          ),
        );
      } else if (feature.name == 'Faculty' || feature.name == 'Teachers') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => TeachersScreen(
              teacherService: TeacherManagementService(
                baseUrl: effectiveBase,
                token: token,
              ),
              userRole: widget.userRole,
              isPrincipal: _isPrincipal || (widget.userRole.toUpperCase() == 'SCHOOL_ADMIN'),
              isFeeCollector: _isFeeCollector,
            ),
          ),
        );
      } else if (feature.name == 'Classes') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ClassesScreen(
              classService: ClassManagementService(
                baseUrl: effectiveBase,
                token: token,
              ),
              userRole: widget.userRole,
              isPrincipal: _isPrincipal || (widget.userRole.toUpperCase() == 'SCHOOL_ADMIN'),
              isFeeCollector: _isFeeCollector,
            ),
          ),
        );
      } else if (feature.name == 'Financial Report' || feature.name == 'Financial report' || feature.name == 'Revenue') {
        final prefs = await SharedPreferences.getInstance();
        if (mounted) {
          setState(() {
            _unreadFinancialReportCount = 0;
          });
        }
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        final repService = FinancialReportService(
          baseUrl: effectiveBase,
          token: token,
        );
        final Future<void> markSeenFuture = repService.markFinancialReportBadgeSeen(
          maxId: _latestPendingReportMaxId > 0 ? _latestPendingReportMaxId : null,
        );
        final Future<void> markNotifFuture = _markFeatureNotificationsRead('financial_report');

        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => RevenueScreen(
              reportService: repService,
              userRole: widget.userRole,
              isFeeCollector: _isFeeCollector,
            ),
          ),
        );
        await markSeenFuture;
        await markNotifFuture;
        await _markFeatureNotificationsRead('financial_report');
        if (mounted) {
          await Future.wait([
            _fetchPendingFinancialReportCount(),
            _fetchUnreadNotificationsCount(),
          ]);
        }
      } else if (feature.name == 'Fee Reminder') {
        if (!(_isFeeCollector == true)) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Access restricted to Fee Collector only.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
          return;
        }
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        // Immediately clear badge count on tap per user requirement
        if (mounted) {
          setState(() {
            _unreadFeeReminderCount = 0;
          });
        }
        final Future<void> markFuture = _markFeatureNotificationsRead('fee_reminder');

        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FeeReminderScreen(
              service: FeeReminderService(
                baseUrl: effectiveBase,
                token: token,
              ),
              userRole: widget.userRole,
              isPrincipal: _isPrincipal || (widget.userRole.toUpperCase() == 'SCHOOL_ADMIN'),
              isFeeCollector: _isFeeCollector,
            ),
          ),
        );
        await markFuture;
        await _markFeatureNotificationsRead('fee_reminder');
        if (mounted) {
          await _fetchUnreadNotificationsCount();
        }
      } else if (feature.name == 'Manage Discount') {
        final prefs = await SharedPreferences.getInstance();
        if (mounted) {
          setState(() {
            _unreadDiscountRequestCount = 0;
          });
        }
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('10.22.6.71') || effectiveBase.contains('10.155.82.71')) {
          effectiveBase = resolveBaseUrlFrom(prefs);
        }
        final feeService = FeeService(baseUrl: effectiveBase, token: token);
        final Future<void> markSeenFuture = feeService.markDiscountBadgeSeen(
          maxId: _latestPendingDiscountMaxId > 0 ? _latestPendingDiscountMaxId : null,
        );
        final Future<void> markNotifFuture = _markFeatureNotificationsRead('discount');

        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ManageDiscountScreen(
              baseUrl: effectiveBase,
              token: token,
              userRole: widget.userRole,
            ),
          ),
        );
        await markSeenFuture;
        await markNotifFuture;
        await _markFeatureNotificationsRead('discount');
        if (mounted) {
          await Future.wait([
            _fetchPendingDiscountRequestCount(),
            _fetchUnreadNotificationsCount(),
          ]);
        }
      }
    } else {

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${feature.name} feature is currently under development.'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredFeatures = _getFilteredFeatures();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        final now = DateTime.now();
        if (_lastBackPressTime == null || now.difference(_lastBackPressTime!) > const Duration(seconds: 3)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'Tap again to exit',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.1,
                ),
              ),
              backgroundColor: const Color(0xFF262626),
              behavior: SnackBarBehavior.floating,
              elevation: 4,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              margin: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              duration: const Duration(seconds: 3),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).clearSnackBars();
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () {
          FocusScope.of(context).unfocus();
        },
        child: SafeArea(
          child: NotificationListener<ScrollNotification>(
            onNotification: (scrollInfo) {
              if (scrollInfo is UserScrollNotification) {
                FocusScope.of(context).unfocus();
              }
              return false;
            },
            child: CustomScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
            // Home Header bar
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(left: 20, right: 20, top: 24, bottom: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          _schoolName.toUpperCase(),
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: isDark ? Colors.white : Colors.black87,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: _navigateToProfileScreen,
                      child: Hero(
                        tag: 'user_profile_icon',
                        child: CircleAvatar(
                          radius: 24,
                          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.indigo.shade50,
                          child: Builder(
                            builder: (context) {
                              String photoUrl = '';
                              if (widget.userRole.toUpperCase() == 'PARENT' || widget.userRole.toUpperCase() == 'STUDENT') {
                                final active = StudentSessionHelper.findChildById(_children, _activeStudentId);
                                if (active != null) {
                                  photoUrl = (active['photo_path'] ?? active['photo'] ?? '').toString();
                                } else {
                                  photoUrl = _userPhoto;
                                }
                              } else {
                                photoUrl = _userPhoto;
                              }

                              if (photoUrl.isNotEmpty) {
                                final fullUrl = _buildFullPhotoUrl(photoUrl);
                                return ClipOval(
                                  child: CachedNetworkImage(
                                    imageUrl: fullUrl,
                                    width: 48,
                                    height: 48,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(
                                      width: 48,
                                      height: 48,
                                      color: Colors.indigo.shade50,
                                      child: Center(
                                        child: SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigo.shade400),
                                        ),
                                      ),
                                    ),
                                    errorWidget: (context, url, error) {
                                      if ((url.contains('127.0.0.1') || url.contains('localhost')) &&
                                          _workingBaseUrl.isNotEmpty &&
                                          !_workingBaseUrl.contains('127.0.0.1') &&
                                          !_workingBaseUrl.contains('localhost')) {
                                        final fallbackUrl = url.replaceAll(RegExp(r'http://(127\.0\.0\.1|localhost):8000'), _workingBaseUrl);
                                        return CachedNetworkImage(
                                          imageUrl: fallbackUrl,
                                          width: 48,
                                          height: 48,
                                          fit: BoxFit.cover,
                                          errorWidget: (c, u, e) => Icon(Icons.person, size: 28, color: Colors.indigo.shade800),
                                        );
                                      }
                                      return Icon(Icons.person, size: 28, color: Colors.indigo.shade800);
                                    },
                                  ),
                                );
                              }
                              return Icon(Icons.person, size: 28, color: Colors.indigo.shade800);
                            },
                          ),
                        ),
                      ),
                    )
                  ],
                ),
              ),
            ),

            // Search Bar component
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: isDark ? Border.all(color: const Color(0xFF334155)) : null,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    onTapOutside: (_) => FocusScope.of(context).unfocus(),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                    decoration: InputDecoration(
                      hintText: 'Search Features...',
                      hintStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : Colors.grey, fontSize: 14),
                      prefixIcon: Icon(Icons.search_rounded, color: isDark ? const Color(0xFF94A3B8) : Colors.grey),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ),
              ),
            ),

            // Features Grid
            SliverPadding(
              padding: const EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 40),
              sliver: filteredFeatures.isEmpty
                  ? SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off_rounded, size: 48, color: isDark ? const Color(0xFF64748B) : Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'No features match "${_searchQuery}"',
                              style: TextStyle(
                                color: isDark ? const Color(0xFF94A3B8) : Colors.grey.shade500,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 18,
                        mainAxisSpacing: 22,
                        childAspectRatio: 0.80,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (BuildContext context, int index) {
                          final feature = filteredFeatures[index];
                          final bool isNotice = feature.name == 'Notice' || feature.name == 'Notice Board' || feature.name == 'Notices';
                          final bool isNotification = feature.name == 'Notifications' || feature.name == 'Messages';
                          final bool isLeaves = feature.name == 'Leaves' || feature.name == 'Leave';
                          final bool isTimetable = feature.name == 'Timetable' || feature.name == 'Time Table';
                          final bool isSalary = feature.name == 'Salary' || feature.name == 'Staff Salary' || feature.name == 'Salaries';
                          final bool isExams = feature.name == 'Examinations' || feature.name == 'Exams' || feature.name == 'Exam';
                          final bool isExpense = feature.name == 'Expense' || feature.name == 'Expenses';
                          final bool isFinancialReport = feature.name == 'Financial Report' || feature.name == 'Financial report' || feature.name == 'Revenue';
                          final bool isAttendance = feature.name == 'Attendance';
                          final bool isFeesCard = feature.name == 'Fees Card';
                          final bool isHomework = feature.name == 'Homework';
                          final bool isAchievements = feature.name == 'Achievements';
                          final bool isFeeReminder = feature.name == 'Fee Reminder';
                          final bool isManageDiscount = feature.name == 'Manage Discount';
                          final bool isTar = feature.name == 'TAR';
                          final bool isFeesPortal = feature.name == 'Fees Portal';
                          int badgeCount = 0;
                          if (isNotice) {
                            badgeCount = _unreadNoticeCount;
                          } else if (isNotification) {
                            badgeCount = _unreadNotificationCount;
                          } else if (isLeaves) {
                            badgeCount = _unreadLeaveCount;
                          } else if (isAttendance) {
                            badgeCount = _unreadAttendanceCount;
                          } else if (isFeesCard) {
                            badgeCount = _unreadFeesCount;
                          } else if (isHomework) {
                            badgeCount = _unreadHomeworkCount;
                          } else if (isTimetable) {
                            badgeCount = _unreadTimetableCount;
                          } else if (isSalary) {
                            badgeCount = _unreadSalaryCount;
                          } else if (isExams) {
                            badgeCount = _unreadExamsCount;
                          } else if (isAchievements) {
                            badgeCount = _unreadAchievementsCount;
                          } else if (isExpense) {
                            badgeCount = _unreadExpenseCount;
                          } else if (isFinancialReport) {
                            badgeCount = _unreadFinancialReportCount;
                          } else if (isFeeReminder) {
                            badgeCount = _unreadFeeReminderCount;
                          } else if (isManageDiscount) {
                            badgeCount = _unreadDiscountRequestCount;
                          } else if (isTar) {
                            badgeCount = _unreadTarCount;
                          } else if (isFeesPortal) {
                            badgeCount = _unreadFeesPortalCount;
                          }

                          return GestureDetector(
                            onTap: () => _onFeatureTap(feature),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Rounded Square Feature Icon Button with Badge
                                AspectRatio(
                                  aspectRatio: 1.0,
                                  child: Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      Container(
                                        width: double.infinity,
                                        height: double.infinity,
                                        decoration: BoxDecoration(
                                          color: isDark ? feature.color.withOpacity(0.16) : feature.color.withValues(alpha: 0.08),
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(
                                            color: isDark ? feature.color.withOpacity(0.4) : feature.color.withValues(alpha: 0.25),
                                            width: 1.8,
                                          ),
                                        ),
                                        child: Center(
                                          child: Icon(
                                            feature.icon,
                                            size: 38,
                                            color: feature.color,
                                          ),
                                        ),
                                      ),
                                      if (badgeCount > 0)
                                        Positioned(
                                          top: -4,
                                          right: -4,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                            constraints: const BoxConstraints(minWidth: 19, minHeight: 19),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFEF4444),
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(color: Colors.white, width: 2),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                                                  blurRadius: 4,
                                                  offset: const Offset(0, 2),
                                                ),
                                              ],
                                            ),
                                            child: Center(
                                              child: Text(
                                                badgeCount > 99 ? '99+' : badgeCount.toString(),
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w900,
                                                  height: 1.0,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                // Text label below
                                Text(
                                  feature.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isDark ? const Color(0xFFE2E8F0) : Colors.grey.shade800,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                        childCount: filteredFeatures.length,
                      ),
                    ),
            ),
          ],
        ),
      ),
    ),
  ),
),
);
  }
}
