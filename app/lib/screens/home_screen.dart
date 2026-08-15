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
import 'package:cached_network_image/cached_network_image.dart';
import 'package:school_hub/screens/user_profile_screen.dart';
import 'package:school_hub/widgets/change_password_dialog.dart';

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

  const HomeScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
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
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Leaves',
      icon: Icons.edit_document,
      color: Colors.amber.shade800,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Fees Card',
      icon: Icons.payments_rounded,
      color: Colors.green,
      allowedRoles: ['PARENT', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Salary',
      icon: Icons.currency_rupee_rounded,
      color: Colors.teal,
      allowedRoles: ['TEACHER'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Homework',
      icon: Icons.menu_book_rounded,
      color: Colors.indigo,
      allowedRoles: ['PARENT', 'TEACHER', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Timetable',
      icon: Icons.schedule_rounded,
      color: Colors.blue,
      allowedRoles: ['PARENT', 'TEACHER', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Exams',
      icon: Icons.assignment_turned_in_rounded,
      color: Colors.red,
      allowedRoles: ['PARENT', 'TEACHER', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Reports',
      icon: Icons.bar_chart_rounded,
      color: Colors.deepPurple,
      allowedRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Notice',
      icon: Icons.campaign_rounded,
      color: Colors.orange.shade700,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),

    LauncherFeature(
      name: 'Notifications',
      icon: Icons.notifications_rounded,
      color: Colors.indigo,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Settings',
      icon: Icons.settings_rounded,
      color: Colors.grey.shade700,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Teachers',
      icon: Icons.people_rounded,
      color: Colors.pink,
      allowedRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Students',
      icon: Icons.school_rounded,
      color: Colors.cyan,
      allowedRoles: ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Finance',
      icon: Icons.monetization_on_rounded,
      color: Colors.green.shade700,
      allowedRoles: ['SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Achievements',
      icon: Icons.emoji_events_rounded,
      color: Colors.amber.shade700,
      allowedRoles: ['PARENT', 'STUDENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
      isAvailable: true,
    ),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _activeStudentId = widget.selectedStudentId;
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

  Future<void> _loadSessionInfo() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', widget.leaveService.baseUrl);
    await prefs.setString('user_role', widget.userRole);
    setState(() {
      _userName = prefs.getString('user_name') ?? 'User';
      _schoolName = (prefs.getString('school_name') ?? 'Shiksha Pilot Academy').toUpperCase();
      _userPhone = prefs.getString('user_phone') ?? '';
      _userPhoto = prefs.getString('user_photo') ?? '';
      
      final role = widget.userRole.toUpperCase();
      if (role == 'PARENT') {
        _userRoleDisplay = 'Parent Profile';
      } else if (role == 'TEACHER') {
        _userRoleDisplay = 'Teacher Profile';
      } else if (role == 'SCHOOL_ADMIN' || role == 'PRINCIPAL') {
        _userRoleDisplay = 'Principal Profile';
      } else {
        _userRoleDisplay = role;
      }
    });

    final roleUpper = widget.userRole.toUpperCase();
    if (roleUpper == 'PARENT' || roleUpper == 'STUDENT') {
      final savedId = prefs.getInt('selected_student_id');
      if (savedId != null) {
        setState(() {
          _activeStudentId = savedId;
        });
      }
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
      final authService = AuthService(baseUrl: widget.leaveService.baseUrl);
      final profile = await authService.fetchProfile(token);
      
      final latestPhoto = (profile['photo_path'] as String?) ?? (profile['staff_photo_path'] as String?) ?? '';
      final latestName = (profile['name'] as String?) ?? '';
      
      final role = widget.userRole.toUpperCase();
      final isStaff = role == 'TEACHER' || role == 'SCHOOL_ADMIN' || role == 'PRINCIPAL';
      
      final prefs = await SharedPreferences.getInstance();
      if (isStaff) {
        await prefs.setString('user_photo', latestPhoto);
        await prefs.setString('user_name', latestName);

        if (mounted) {
          setState(() {
            _userPhoto = latestPhoto;
            _userName = latestName;
          });
        }
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
    if (_children.isEmpty || _activeStudentId == null) return;
    final active = _children.firstWhere(
      (c) => c['id'] == _activeStudentId,
      orElse: () => null,
    );
    if (active != null) {
      setState(() {
        _activeStudentName = active['name'] ?? '';
        _activeStudentClass = active['class_name'] ?? '';
      });
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString('user_name', active['name'] ?? '');
        prefs.setString('user_photo', active['photo_path']?.toString() ?? '');
      });
    }
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
      if (roleUpper == 'TEACHER') {
        path = '/api/teacher/notifications';
        isSchoolStaff = true;
      } else if (roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'PRINCIPAL' || roleUpper == 'SUPER_ADMIN') {
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
    
    // Filter by allowed role first
    final List<LauncherFeature> roleScoped = _allFeatures.where((f) {
      return f.allowedRoles.contains(role) || 
             (role == 'SCHOOL_ADMIN' && f.allowedRoles.contains('PRINCIPAL')) ||
             (role == 'PRINCIPAL' && f.allowedRoles.contains('SCHOOL_ADMIN'));
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

    final fullPhotoUrl = photoUrl.isNotEmpty
        ? (photoUrl.startsWith('http') ? photoUrl : '${widget.leaveService.baseUrl}$photoUrl')
        : '';

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
          baseUrl: widget.leaveService.baseUrl,
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
                                final fullUrl = photoUrl.startsWith('http') ? photoUrl : '${widget.leaveService.baseUrl}$photoUrl';
                                return ClipOval(
                                  child: CachedNetworkImage(
                                    imageUrl: fullUrl,
                                    width: 48,
                                    height: 48,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Icon(Icons.person, size: 28, color: Colors.indigo.shade800),
                                    errorWidget: (context, url, error) => Icon(Icons.person, size: 28, color: Colors.indigo.shade800),
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
