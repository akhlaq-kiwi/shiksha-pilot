import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
import 'package:school_hub/screens/full_screen_image_screen.dart';
import 'package:workmanager/workmanager.dart';
import 'package:school_hub/main.dart';
import 'package:school_hub/services/exam_service.dart';
import 'package:school_hub/screens/exam_list_screen.dart';
import 'package:school_hub/screens/achievements_screen.dart';
import 'package:school_hub/screens/homework_list_screen.dart';
import 'package:school_hub/screens/achievements_screen.dart';
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

  const HomeScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
    this.isPrincipal,
    this.isFeeCollector,
    this.userPhoto,
    this.userName,
  }) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  Timer? _notifTimer;
  String _userName = '';
  String _userRoleDisplay = '';
  String _schoolName = '';
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
  bool _isFetchingNotifications = false;
  
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
      name: 'Mark Attendance',
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
      name: 'Exams',
      icon: Icons.assignment_turned_in_rounded,
      color: Colors.red,
      allowedRoles: ['PARENT', 'TEACHER', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Notice',
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
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'TSD',
      icon: Icons.payments_rounded,
      color: const Color(0xFF0D9488),
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Class Teacher',
      icon: Icons.supervised_user_circle_rounded,
      color: const Color(0xFF1E3A8A),
      allowedRoles: ['TEACHER', 'PRINCIPAL', 'SCHOOL_ADMIN'],
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
    final savedBase = prefs.getString('base_url');
    if (savedBase != null && savedBase.isNotEmpty) {
      _workingBaseUrl = savedBase;
    } else {
      _workingBaseUrl = widget.leaveService.baseUrl;
      await prefs.setString('base_url', widget.leaveService.baseUrl);
    }
    await prefs.setString('user_role', widget.userRole);

    final roleUpper = widget.userRole.toUpperCase();
    final savedId = prefs.getInt('selected_student_id');

    setState(() {
      _userName = (widget.userName != null && widget.userName!.isNotEmpty)
          ? widget.userName!
          : (prefs.getString('user_name') ?? 'User');
      _schoolName = (prefs.getString('school_name') ?? 'Shiksha Pilot Academy').toUpperCase();
      _userPhone = prefs.getString('user_phone') ?? '';
      final savedPhoto = prefs.getString('user_photo') ?? '';
      _userPhoto = savedPhoto.isNotEmpty ? savedPhoto : (widget.userPhoto ?? _userPhoto);
      _isPrincipal = (prefs.getBool('is_principal') == true) ||
          (widget.isPrincipal == true) ||
          (roleUpper == 'PRINCIPAL');
      _isFeeCollector = (prefs.getBool('is_fee_collector') == true) ||
          (widget.isFeeCollector == true);

      if ((roleUpper == 'PARENT' || roleUpper == 'STUDENT') && savedId != null) {
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
      } else if (roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'PRINCIPAL') {
        _userRoleDisplay = 'Principal Profile';
      } else {
        _userRoleDisplay = roleUpper;
      }
    });

    if (roleUpper == 'PARENT' || roleUpper == 'STUDENT') {
      _resolveActiveStudentName();
    }

    // Refresh profile details dynamically in background to sync profile pictures immediately!
    final token = prefs.getString('auth_token');
    if (token != null && token.isNotEmpty) {
      _syncProfileDetails(token);
    }
    _fetchUnreadNotificationsCount();
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

      if (latestPhoto.isNotEmpty) await prefs.setString('user_photo', latestPhoto);
      if (latestName.isNotEmpty) await prefs.setString('user_name', latestName);

      if (mounted) {
        setState(() {
          if (latestPhoto.isNotEmpty) _userPhoto = latestPhoto;
          if (latestName.isNotEmpty) _userName = latestName;
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
          _resolveActiveStudentName();
        });
        _fetchUnreadNotificationsCount();
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

  void _resolveActiveStudentName() {
    if (_children.isEmpty) return;
    Map<String, dynamic>? active;
    if (_activeStudentId != null) {
      for (final child in _children) {
        final cId = child['id'] is int ? child['id'] as int : int.parse(child['id'].toString());
        if (cId == _activeStudentId) {
          active = Map<String, dynamic>.from(child);
          break;
        }
      }
    }
    active ??= Map<String, dynamic>.from(_children.first);
    
    final resolvedId = active['id'] is int ? active['id'] as int : int.parse(active['id'].toString());
    _activeStudentId = resolvedId;

    final resolvedName = active['name']?.toString() ?? '';
    final resolvedPhoto = active['photo_path']?.toString() ?? '';

    setState(() {
      _activeStudentName = resolvedName;
      _activeStudentClass = active!['class_name']?.toString() ?? '';
      _userName = resolvedName;
      if (resolvedPhoto.isNotEmpty) {
        _userPhoto = resolvedPhoto;
      }
    });

    SharedPreferences.getInstance().then((prefs) {
      prefs.setInt('selected_student_id', resolvedId);
      prefs.setString('user_name', resolvedName);
      prefs.setString('user_photo', resolvedPhoto);
    });
  }

  Future<void> _fetchUnreadNotificationsCount() async {
    if (_isFetchingNotifications) return;
    _isFetchingNotifications = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      if (token.isEmpty) return;
      final baseUrl = widget.leaveService.baseUrl;

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

      final uri = Uri.parse('$baseUrl$path');

      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (!isSchoolStaff && _activeStudentId != null) 'X-Student-Id': _activeStudentId.toString(),
      };

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final decodedBody = json.decode(response.body);
        final List<dynamic> data = isSchoolStaff 
            ? (decodedBody['notifications'] ?? decodedBody['data'] ?? [])
            : (decodedBody['data'] ?? []);

        int count = data.where((n) => n['is_read'] == 0 || n['is_read'] == false || n['is_read'] == '0').length;
        if (mounted) {
          setState(() {
            _unreadNotificationCount = count;
          });
        }

        if (data.isNotEmpty) {
          int lastNotifiedId = prefs.getInt('last_notified_id_${widget.userRole}') ?? 0;
          int maxId = lastNotifiedId;

          final unreadNotifs = data.where((n) {
            final isUnread = n['is_read'] == 0 || n['is_read'] == false || n['is_read'] == '0';
            final int nId = n['id'] is int ? n['id'] : int.parse(n['id'].toString());
            return isUnread && nId > lastNotifiedId;
          }).toList();

          unreadNotifs.sort((a, b) {
            final int aId = a['id'] is int ? a['id'] : int.parse(a['id'].toString());
            final int bId = b['id'] is int ? b['id'] : int.parse(b['id'].toString());
            return aId.compareTo(bId);
          });

          if (unreadNotifs.isNotEmpty) {
            for (final notif in unreadNotifs) {
              final int nId = notif['id'] is int ? notif['id'] : int.parse(notif['id'].toString());
              if (nId > maxId) maxId = nId;
              await NotificationHelper.showNotification(notif, badgeCount: count);
            }
            await prefs.setInt('last_notified_id_${widget.userRole}', maxId);
          }
        }
      }
    } catch (e) {
      // Ignore
    } finally {
      _isFetchingNotifications = false;
    }
  }

  void _showPushNotificationToast(dynamic notif) {
    final title = notif['title'] ?? 'New Notification';
    final message = notif['message'] ?? '';

    late OverlayEntry overlayEntry;
    overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 10,
        left: 16,
        right: 16,
        child: Material(
          color: Colors.transparent,
          child: GestureDetector(
            onTap: () {
              overlayEntry.remove();

              // Handle deep linking on click
              final titleLower = title.toString().toLowerCase();
              final msgLower = message.toString().toLowerCase();

              final isLeaveApprovalOrReqNotif = titleLower.contains('approve') || titleLower.contains('reject') || msgLower.contains('approve') || msgLower.contains('reject') || titleLower.contains('request') || msgLower.contains('request');
              final isHolidayNotif = titleLower.contains('holiday') || msgLower.contains('holiday');
              if (titleLower.contains('leave') || msgLower.contains('leave') || isHolidayNotif) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => LeaveListScreen(
                      leaveService: widget.leaveService,
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      initialTabIndex: isLeaveApprovalOrReqNotif ? 1 : 0,
                    ),
                  ),
                ).then((_) => _loadSessionInfo());
              } else if (titleLower.contains('timetable') || msgLower.contains('timetable')) {
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
                );
              } else if (titleLower.contains('homework') || msgLower.contains('homework') || titleLower.contains('assignment') || msgLower.contains('assignment')) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => HomeworkListScreen(
                      userRole: widget.userRole,
                      selectedStudentId: _activeStudentId,
                      baseUrl: widget.leaveService.baseUrl,
                    ),
                  ),
                );
              } else if (titleLower.contains('achievement') || msgLower.contains('achievement')) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AchievementsScreen(
                      baseUrl: widget.leaveService.baseUrl,
                      token: widget.leaveService.token,
                      userRole: widget.userRole,
                      studentId: _activeStudentId,
                    ),
                  ),
                );
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
                ).then((_) => _loadSessionInfo());
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
    final bool isStaffTeacher = (role == 'TEACHER' || role == 'PRINCIPAL');
    
    // Filter by allowed role first
    final List<LauncherFeature> roleScoped = _allFeatures.where((f) {
      if (f.name == 'TAR') {
        return (_isPrincipal == true || role == 'PRINCIPAL');
      }
      if (f.name == 'Fees Portal') {
        return _isFeeCollector == true || _isPrincipal == true || role == 'PRINCIPAL' || role == 'SCHOOL_ADMIN';
      }
      if (f.name == 'TSD') {
        return _isFeeCollector == true;
      }
      if (f.name == 'Class Teacher') {
        return (_isPrincipal == true || role == 'PRINCIPAL');
      }
      if (isStaffTeacher) {
        return f.allowedRoles.contains('TEACHER') || f.allowedRoles.contains('PRINCIPAL');
      }
      return f.allowedRoles.contains(role);
    }).toList();

    // Filter by search query
    if (_searchQuery.trim().isEmpty) {
      return roleScoped;
    }
    
    final query = _searchQuery.toLowerCase().trim();
    return roleScoped.where((f) => f.name.toLowerCase().contains(query)).toList();
  }

  Future<void> _handleSwitchStudent(int childId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('selected_student_id', childId);
    
    setState(() {
      _activeStudentId = childId;
      _resolveActiveStudentName();
    });

    // Close bottom sheet
    Navigator.pop(context);
    _fetchUnreadNotificationsCount();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Switched profile to $_activeStudentName'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _handleLogout() async {
    // Detach push and clear scheduled reminders BEFORE wiping prefs — both
    // need the auth token and the stored FCM token to do their work, and
    // prefs.clear() destroys them. Otherwise the next person to log in on a
    // shared family phone inherits this user's notifications.
    await PushNotificationService.unregisterDevice();
    await LocalNotificationScheduler.cancelAll();

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();

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
      final active = _children.firstWhere(
        (c) => c['id'] == _activeStudentId,
        orElse: () => null,
      );
      if (active != null) {
        photoUrl = active['photo_path'] ?? '';
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
          onSwitchChild: (newId) {
            setState(() {
              _activeStudentId = newId;
              _resolveActiveStudentName();
            });
            _fetchUnreadNotificationsCount();
          },
        ),
      ),
    );
  }

  void _onFeatureTap(LauncherFeature feature) async {
    if (feature.isAvailable) {
      if (feature.name == 'Leaves') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => LeaveListScreen(
              leaveService: widget.leaveService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              initialTabIndex: 0, // Always open Official Holidays on normal icon click
            ),
          ),
        ).then((_) => _loadSessionInfo()); // reload details in case anything changed
      } else if (feature.name == 'Settings') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SettingsScreen(
              leaveService: widget.leaveService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
            ),
          ),
        ).then((_) => _loadSessionInfo());
      } else if (feature.name == 'Attendance') {
        final attService = AttendanceService(
          baseUrl: widget.leaveService.baseUrl,
          token: widget.leaveService.token,
        );
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AttendanceScreen(
              attendanceService: attService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
            ),
          ),
        );
      } else if (feature.name == 'Fees Card') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FeesCardScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: widget.leaveService.token,
              studentId: _activeStudentId,
            ),
          ),
        ).then((_) => _fetchUnreadNotificationsCount());
      } else if (feature.name == 'Mark Attendance' || feature.name == 'Teacher Attendance') {
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
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SalaryCardScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token,
            ),
          ),
        );
      } else if (feature.name == 'Notice' || feature.name == 'Notice Board' || feature.name == 'Notices') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? '';
        Navigator.push(
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
      } else if (feature.name == 'Notifications' || feature.name == 'Messages') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? '';
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => NotificationCenterScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token.isNotEmpty ? token : widget.leaveService.token,
              studentId: _activeStudentId,
              userRole: widget.userRole,
            ),
          ),
        ).then((_) => _fetchUnreadNotificationsCount());
      } else if (feature.name == 'Homework') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => HomeworkListScreen(
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
              baseUrl: widget.leaveService.baseUrl,
            ),
          ),
        );
      } else if (feature.name == 'Timetable') {
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
        );
      } else if (feature.name == 'Exams') {
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
            ),
          ),
        );
      } else if (feature.name == 'Achievements') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        Navigator.push(
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
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PrincipalTarScreen(
              leaveService: widget.leaveService,
            ),
          ),
        );
      } else if (feature.name == 'Fees Portal') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('127.0.0.1')) {
          final savedBase = prefs.getString('base_url') ?? _workingBaseUrl;
          if (savedBase.isNotEmpty && !savedBase.contains('127.0.0.1')) {
            effectiveBase = savedBase;
          }
        }
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FeesPortalScreen(
              baseUrl: effectiveBase,
              token: token,
            ),
          ),
        );
      } else if (feature.name == 'TSD') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('127.0.0.1')) {
          final savedBase = prefs.getString('base_url') ?? _workingBaseUrl;
          if (savedBase.isNotEmpty && !savedBase.contains('127.0.0.1')) {
            effectiveBase = savedBase;
          }
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
      } else if (feature.name == 'Class Teacher') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? widget.leaveService.token;
        String effectiveBase = widget.leaveService.baseUrl;
        if (effectiveBase.isEmpty || effectiveBase.contains('127.0.0.1')) {
          final savedBase = prefs.getString('base_url') ?? _workingBaseUrl;
          if (savedBase.isNotEmpty && !savedBase.contains('127.0.0.1')) {
            effectiveBase = savedBase;
          }
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
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
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
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: Colors.black87,
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
                          backgroundColor: Colors.indigo.shade50,
                          child: Builder(
                            builder: (context) {
                              String photoUrl = '';
                              if (widget.userRole.toUpperCase() == 'PARENT' || widget.userRole.toUpperCase() == 'STUDENT') {
                                final active = _children.firstWhere(
                                  (c) => c['id'] == _activeStudentId,
                                  orElse: () => null,
                                );
                                if (active != null) {
                                  photoUrl = active['photo_path'] ?? '';
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
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                    decoration: const InputDecoration(
                      hintText: 'Search Features...',
                      hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                      prefixIcon: Icon(Icons.search_rounded, color: Colors.grey),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                            Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              'No features match "${_searchQuery}"',
                              style: TextStyle(
                                color: Colors.grey.shade500,
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
                        crossAxisCount: 4,
                        crossAxisSpacing: 14,
                        mainAxisSpacing: 24,
                        childAspectRatio: 0.75, // accommodates icon + padding + label
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (BuildContext context, int index) {
                          final feature = filteredFeatures[index];
                          return GestureDetector(
                            onTap: () => _onFeatureTap(feature),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Circular Feature Icon Button
                                AspectRatio(
                                  aspectRatio: 1.0,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: feature.color.withOpacity(0.08),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: feature.color.withOpacity(0.25),
                                        width: 1.5,
                                      ),
                                    ),
                                    child: Center(
                                      child: Icon(
                                        feature.icon,
                                        size: 28,
                                        color: feature.color,
                                      ),
                                    ),
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
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.grey.shade800,
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
    );
  }
}
