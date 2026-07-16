import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:school_hub/services/leave_service.dart';
import 'package:school_hub/services/auth_service.dart';
import 'package:school_hub/screens/leave_list_screen.dart';
import 'package:school_hub/screens/attendance_screen.dart';
import 'package:school_hub/screens/fees_card_screen.dart';
import 'package:school_hub/screens/salary_card_screen.dart';
import 'package:school_hub/screens/notification_center_screen.dart';
import 'package:school_hub/screens/notice_screen.dart';
import 'package:school_hub/services/attendance_service.dart';
import 'package:school_hub/main.dart';

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

class _HomeScreenState extends State<HomeScreen> {
  String _userName = '';
  String _userRoleDisplay = '';
  String _schoolName = '';
  String _userPhone = '';
  int? _activeStudentId;
  String _activeStudentName = '';
  String _userPhoto = '';
  
  List<dynamic> _children = [];
  bool _isLoadingChildren = false;
  String _searchQuery = '';
  int _unreadNotificationCount = 0;
  
  final TextEditingController _searchController = TextEditingController();

  // Unified list of features in system
  final List<LauncherFeature> _allFeatures = [
    LauncherFeature(
      name: 'Attendance',
      icon: Icons.calendar_month_rounded,
      color: Colors.teal,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Leave',
      icon: Icons.edit_document,
      color: Colors.amber.shade800,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Fees Card',
      icon: Icons.payments_rounded,
      color: Colors.green,
      allowedRoles: ['PARENT', 'SCHOOL_ADMIN', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Salary',
      icon: Icons.price_check_rounded,
      color: Colors.teal,
      allowedRoles: ['TEACHER'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Homework',
      icon: Icons.menu_book_rounded,
      color: Colors.indigo,
      allowedRoles: ['PARENT', 'TEACHER'],
    ),
    LauncherFeature(
      name: 'Timetable',
      icon: Icons.schedule_rounded,
      color: Colors.blue,
      allowedRoles: ['TEACHER'],
    ),
    LauncherFeature(
      name: 'Exams',
      icon: Icons.assignment_turned_in_rounded,
      color: Colors.red,
      allowedRoles: ['PARENT'],
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
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
      isAvailable: true,
    ),
    LauncherFeature(
      name: 'Transport',
      icon: Icons.directions_bus_rounded,
      color: Colors.blueGrey,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Library',
      icon: Icons.local_library_rounded,
      color: Colors.brown,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Messages',
      icon: Icons.chat_rounded,
      color: Colors.purple,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
    ),
    LauncherFeature(
      name: 'Settings',
      icon: Icons.settings_rounded,
      color: Colors.grey.shade700,
      allowedRoles: ['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL'],
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
  ];

  @override
  void initState() {
    super.initState();
    _activeStudentId = widget.selectedStudentId;
    _loadSessionInfo();
    _fetchChildrenList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSessionInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('user_name') ?? 'User';
      _schoolName = prefs.getString('school_name') ?? 'Shiksha Pilot Academy';
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

    if (widget.userRole.toUpperCase() == 'PARENT') {
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
      final authService = AuthService(baseUrl: 'http://10.227.152.71:8000');
      final profile = await authService.fetchProfile(token);
      
      final latestPhoto = (profile['staff_photo_path'] as String?) ?? '';
      final latestName = (profile['name'] as String?) ?? '';
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_photo', latestPhoto);
      await prefs.setString('user_name', latestName);

      if (mounted) {
        setState(() {
          _userPhoto = latestPhoto;
          _userName = latestName;
        });
      }
    } catch (e) {
      debugPrint('Error syncing profile details: $e');
    }
  }

  Future<void> _fetchChildrenList() async {
    if (widget.userRole.toUpperCase() != 'PARENT') return;
    
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
      });
    }
  }

  Future<void> _fetchUnreadNotificationsCount() async {
    if (widget.userRole.toUpperCase() != 'PARENT') return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final baseUrl = widget.leaveService.baseUrl;
      final uri = Uri.parse('$baseUrl/api/student/notifications');
      
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (_activeStudentId != null) 'X-Student-Id': _activeStudentId.toString(),
      };
      
      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body)['data'] ?? [];
        int count = data.where((n) => n['is_read'] == 0 || n['is_read'] == false || n['is_read'] == '0').length;
        if (mounted) {
          setState(() {
            _unreadNotificationCount = count;
          });
        }
      }
    } catch (e) {
      // Ignore
    }
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
    final _formKey = GlobalKey<FormState>();
    final _newPasswordController = TextEditingController();
    bool _isUpdating = false;
    String _errorText = '';

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text(
                'Change Password',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              content: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _newPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'New Password',
                        hintText: 'Enter at least 6 characters',
                        prefixIcon: Icon(Icons.lock_outline_rounded),
                        border: OutlineInputBorder(),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Password cannot be empty';
                        }
                        if (val.trim().length < 6) {
                          return 'Password must be at least 6 characters';
                        }
                        return null;
                      },
                    ),
                    if (_errorText.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        _errorText,
                        style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: _isUpdating ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: _isUpdating
                      ? null
                      : () async {
                          if (!_formKey.currentState!.validate()) return;
                          
                          setDialogState(() {
                            _isUpdating = true;
                            _errorText = '';
                          });

                          try {
                            final prefs = await SharedPreferences.getInstance();
                            final token = prefs.getString('auth_token') ?? '';
                            final authService = AuthService(baseUrl: 'http://10.227.152.71:8000');
                            await authService.changePassword(token, _newPasswordController.text.trim());
                            
                            if (context.mounted) {
                              Navigator.pop(context); // close password dialog
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Password changed successfully.'),
                                  behavior: SnackBarBehavior.floating,
                                  backgroundColor: Colors.green,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() {
                              _isUpdating = false;
                              _errorText = e.toString().replaceAll('Exception:', '').trim();
                            });
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    foregroundColor: Colors.white,
                  ),
                  child: _isUpdating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                        )
                      : const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showProfilePopup() {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.2),
      builder: (BuildContext context) {
        // Resolve profile image
        String photoUrl = '';
        if (widget.userRole.toUpperCase() == 'PARENT') {
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

        Widget avatarChild;
        if (photoUrl.isNotEmpty) {
          final fullUrl = photoUrl.startsWith('http') ? photoUrl : 'http://10.227.152.71:8000' + photoUrl;
          avatarChild = ClipOval(
            child: Image.network(
              fullUrl,
              width: 54,
              height: 54,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Icon(Icons.person, size: 30, color: Colors.indigo.shade800);
              },
            ),
          );
        } else {
          avatarChild = Icon(Icons.person, size: 30, color: Colors.indigo.shade800);
        }

        return Dialog(
          alignment: Alignment.topRight,
          insetPadding: const EdgeInsets.only(top: 60, right: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Container(
            width: 260,
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header (Profile Avatar and Name only!)
                Row(
                  children: [
                    CircleAvatar(
                      radius: 27,
                      backgroundColor: Colors.indigo.shade50,
                      child: avatarChild,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _userName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 12),

                // Switch child list (if PARENT and multiple children), placed ABOVE Change Password!
                if (widget.userRole.toUpperCase() == 'PARENT' && _children.length > 1) ...[
                  const Text(
                    'SWITCH STUDENT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 180),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: _children.length,
                      itemBuilder: (context, index) {
                        final child = _children[index];
                        final childId = child['id'] as int;
                        final isCurrent = childId == _activeStudentId;
                        final childName = child['name'] ?? '';
                        
                        return Container(
                          margin: const EdgeInsets.symmetric(vertical: 2),
                          decoration: BoxDecoration(
                            color: isCurrent ? Colors.indigo.shade50.withOpacity(0.4) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () async {
                              Navigator.pop(context); // Close popup dialog
                              await _handleSwitchStudent(childId);
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.child_care_rounded,
                                    size: 16,
                                    color: isCurrent ? Colors.indigo.shade800 : Colors.grey.shade600,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      childName,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                        color: isCurrent ? Colors.indigo.shade800 : Colors.black87,
                                      ),
                                    ),
                                  ),
                                  if (isCurrent)
                                    Icon(Icons.check, size: 14, color: Colors.indigo.shade800),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                ],

                // Action Menu: Change Password (above Logout)
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () {
                    Navigator.pop(context); // Close profile popup
                    _showChangePasswordDialog();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                    child: Row(
                      children: const [
                        Icon(Icons.lock_open_rounded, size: 18, color: Colors.black54),
                        SizedBox(width: 12),
                        Text(
                          'Change Password',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 4),

                // Action Menu: Log Out
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () {
                    Navigator.pop(context); // Close profile popup
                    _handleLogout();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                    child: Row(
                      children: [
                        Icon(Icons.logout_rounded, size: 18, color: Colors.red.shade600),
                        const SizedBox(width: 12),
                        Text(
                          'Log Out',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.red.shade600),
                        ),
                      ],
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

  void _onFeatureTap(LauncherFeature feature) async {
    if (feature.isAvailable) {
      if (feature.name == 'Leave') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => LeaveListScreen(
              leaveService: widget.leaveService,
              userRole: widget.userRole,
              selectedStudentId: _activeStudentId,
            ),
          ),
        ).then((_) => _loadSessionInfo()); // reload details in case anything changed
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
      } else if (feature.name == 'Salary') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SalaryCardScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: widget.leaveService.token,
            ),
          ),
        );
      } else if (feature.name == 'Notice') {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token') ?? '';
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => NoticeScreen(
              baseUrl: widget.leaveService.baseUrl,
              token: token,
              userRole: widget.userRole,
              studentId: _activeStudentId,
            ),
          ),
        ).then((_) => _fetchUnreadNotificationsCount());
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _getGreeting(),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _userName,
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (widget.userRole.toUpperCase() == 'PARENT') ...[
                      Stack(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.notifications_none_rounded, size: 28, color: Colors.black87),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => NotificationCenterScreen(
                                    baseUrl: widget.leaveService.baseUrl,
                                    token: widget.leaveService.token,
                                    studentId: _activeStudentId,
                                  ),
                                ),
                              ).then((_) {
                                _fetchUnreadNotificationsCount();
                              });
                            },
                          ),
                          if (_unreadNotificationCount > 0)
                            Positioned(
                              right: 8,
                              top: 8,
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 8),
                    ],
                    GestureDetector(
                      onTap: _showProfilePopup,
                      child: Hero(
                        tag: 'user_profile_icon',
                        child: CircleAvatar(
                          radius: 24,
                          backgroundColor: Colors.indigo.shade50,
                          child: Builder(
                            builder: (context) {
                              String photoUrl = '';
                              if (widget.userRole.toUpperCase() == 'PARENT') {
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
                                final fullUrl = photoUrl.startsWith('http') ? photoUrl : 'http://10.227.152.71:8000' + photoUrl;
                                return ClipOval(
                                  child: Image.network(
                                    fullUrl,
                                    width: 48,
                                    height: 48,
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) {
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
