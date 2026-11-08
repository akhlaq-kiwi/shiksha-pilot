import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/main.dart';
import 'package:school_hub/services/push_notification_service.dart';
import 'package:school_hub/services/local_notification_scheduler.dart';

class UserProfileScreen extends StatefulWidget {
  final String userName;
  final String userRole;
  final String schoolName;
  final String userPhone;
  final String photoUrl;
  final List<dynamic> children;
  final int? activeStudentId;
  final Function(int)? onSwitchChild;
  final String? baseUrl;

  const UserProfileScreen({
    Key? key,
    required this.userName,
    required this.userRole,
    required this.schoolName,
    required this.userPhone,
    required this.photoUrl,
    this.children = const [],
    this.activeStudentId,
    this.onSwitchChild,
    this.baseUrl,
  }) : super(key: key);

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  int? _currentActiveChildId;
  String _baseUrl = '';

  @override
  void initState() {
    super.initState();
    _currentActiveChildId = widget.activeStudentId;
    _initBaseUrl();
  }

  Future<void> _initBaseUrl() async {
    if (widget.baseUrl != null && widget.baseUrl!.isNotEmpty) {
      if (mounted) {
        setState(() {
          _baseUrl = widget.baseUrl!;
        });
      }
    } else {
      final prefs = await SharedPreferences.getInstance();
      final savedBaseUrl = prefs.getString('base_url') ?? '';
      if (mounted) {
        setState(() {
          _baseUrl = savedBaseUrl;
        });
      }
    }
  }

  Future<void> _confirmAndLogout() async {
    bool isLoggingOut = false;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return PopScope(
              canPop: !isLoggingOut,
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
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.logout_rounded,
                              color: Color(0xFFD97706),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Text(
                                'Log Out',
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
                        'Are you sure you want to log out of your account?',
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
                                onPressed: isLoggingOut ? null : () => Navigator.of(dialogContext).pop(),
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
                                onPressed: isLoggingOut
                                    ? null
                                    : () async {
                                        setDialogState(() {
                                          isLoggingOut = true;
                                        });
                                        await _handleLogout();
                                      },
                                child: isLoggingOut
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.2,
                                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                        ),
                                      )
                                    : const Text(
                                        'Log Out',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800,
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
          },
        );
      },
    );
  }

  Future<void> _handleLogout() async {
    try {
      await PushNotificationService.unregisterDevice();
      await LocalNotificationScheduler.cancelAll();
    } catch (_) {}

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

    if (mounted) {
      Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final roleUpper = widget.userRole.toUpperCase();
    final bool isAdminRole = roleUpper == 'ADMIN' || roleUpper == 'SCHOOL_ADMIN';
    final isStudentOrParent = roleUpper == 'STUDENT' || roleUpper == 'PARENT';

    // Resolve active student details if student/parent
    Map<String, dynamic>? activeStudent;
    if (isStudentOrParent && widget.children.isNotEmpty) {
      activeStudent = widget.children.firstWhere(
        (c) => c['id'] == _currentActiveChildId,
        orElse: () => widget.children.first,
      ) as Map<String, dynamic>?;
    }

    final String displayName = isAdminRole
        ? 'Admin'
        : (isStudentOrParent && activeStudent != null
            ? (activeStudent['name'] ?? widget.userName)
            : widget.userName);

    String photo = isStudentOrParent && activeStudent != null
        ? (activeStudent['photo_path']?.toString() ?? activeStudent['photo']?.toString() ?? widget.photoUrl)
        : widget.photoUrl;

    final effectiveBaseUrl = (widget.baseUrl != null && widget.baseUrl!.isNotEmpty)
        ? widget.baseUrl!
        : _baseUrl;

    if (photo.isNotEmpty && !photo.startsWith('http')) {
      if (effectiveBaseUrl.isNotEmpty) {
        photo = photo.startsWith('/')
            ? '$effectiveBaseUrl$photo'
            : '$effectiveBaseUrl/$photo';
      }
    }

    // Student fields
    final String className = activeStudent?['class_name']?.toString() ?? '';
    final String sectionName = activeStudent?['section_name']?.toString() ?? activeStudent?['section']?.toString() ?? '';
    final String classSecDisplay = sectionName.trim().isNotEmpty
        ? '$className - $sectionName'
        : className;
    final String rollNoDisplay = activeStudent?['roll_no']?.toString() ?? activeStudent?['roll_number']?.toString() ?? '—';
    final String phoneDisplay = widget.userPhone.trim().isNotEmpty
        ? widget.userPhone
        : (activeStudent?['parent_phone']?.toString() ?? activeStudent?['student_mobile']?.toString() ?? '—');

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFF2196F3),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            const SizedBox(height: 12),
            // Profile Image (Avatar)
            Center(
              child: ClipOval(
                child: photo.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: photo,
                        width: 100,
                        height: 100,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          width: 100,
                          height: 100,
                          color: isDark ? const Color(0xFF1E293B) : Colors.blue.shade50,
                          child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                        ),
                        errorWidget: (context, url, error) {
                          final currentBase = widget.baseUrl;
                          if ((url.contains('127.0.0.1') || url.contains('localhost')) &&
                              currentBase != null &&
                              currentBase.isNotEmpty &&
                              !currentBase.contains('127.0.0.1') &&
                              !currentBase.contains('localhost')) {
                            final fallbackUrl = url.replaceAll(RegExp(r'http://(127\.0\.0\.1|localhost):8000'), currentBase);
                            return CachedNetworkImage(
                              imageUrl: fallbackUrl,
                              width: 100,
                              height: 100,
                              fit: BoxFit.cover,
                              errorWidget: (c, u, e) => Container(
                                width: 100,
                                height: 100,
                                color: isDark ? const Color(0xFF1E293B) : Colors.blue.shade50,
                                child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                              ),
                            );
                          }
                          return Container(
                            width: 100,
                            height: 100,
                            color: isDark ? const Color(0xFF1E293B) : Colors.blue.shade50,
                            child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                          );
                        },
                      )
                    : Container(
                        width: 100,
                        height: 100,
                        color: isDark ? const Color(0xFF1E293B) : Colors.blue.shade50,
                        child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                      ),
              ),
            ),
            const SizedBox(height: 16),

            // User / Student Name
            Text(
              displayName,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 24),

            // Multi-child switcher if multiple children exist
            if (isStudentOrParent && widget.children.length > 1) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? const Color(0xFF334155) : Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SWITCH STUDENT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark ? const Color(0xFF94A3B8) : Colors.grey,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Column(
                      children: widget.children.map((child) {
                        final childId = child['id'];
                        final isSelected = childId == _currentActiveChildId;
                        return InkWell(
                          onTap: () {
                            setState(() {
                              _currentActiveChildId = childId;
                            });
                            if (widget.onSwitchChild != null) {
                              widget.onSwitchChild!(childId);
                            }
                          },
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isDark ? const Color(0xFF1E3A8A).withOpacity(0.4) : Colors.blue.shade50)
                                  : (isDark ? const Color(0xFF0F172A) : Colors.grey.shade50),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF2196F3) : Colors.transparent,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                                  color: isSelected ? const Color(0xFF2196F3) : Colors.grey,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  child['name'] ?? '',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                    color: isDark ? Colors.white : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ],

            // Details Container
            Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isDark ? const Color(0xFF334155) : Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(isDark ? 0.2 : 0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: isStudentOrParent
                    ? [
                        // STUDENT FIELDS IN EXACT SPECIFIED ORDER:
                        // 1. SCHOOL NAME
                        _buildProfileField(
                          icon: Icons.school_rounded,
                          label: 'SCHOOL NAME',
                          value: widget.schoolName,
                          isDark: isDark,
                        ),
                        _buildDivider(isDark),

                        // 2. Class/Sec (Show section if available)
                        if (classSecDisplay.isNotEmpty) ...[
                          _buildProfileField(
                            icon: Icons.class_rounded,
                            label: 'CLASS / SECTION',
                            value: classSecDisplay,
                            isDark: isDark,
                          ),
                          _buildDivider(isDark),
                        ],

                        // 3. Roll No
                        _buildProfileField(
                          icon: Icons.badge_rounded,
                          label: 'ROLL NO',
                          value: rollNoDisplay,
                          isDark: isDark,
                        ),
                        _buildDivider(isDark),

                        // 4. Mobile Number
                        _buildProfileField(
                          icon: Icons.phone_android_rounded,
                          label: 'MOBILE NUMBER',
                          value: phoneDisplay.isNotEmpty ? phoneDisplay : '—',
                          isDark: isDark,
                        ),
                      ]
                    : [
                        // TEACHER FIELDS IN EXACT SPECIFIED ORDER:
                        // 1. School Name
                        _buildProfileField(
                          icon: Icons.school_rounded,
                          label: 'SCHOOL NAME',
                          value: widget.schoolName,
                          isDark: isDark,
                        ),
                        _buildDivider(isDark),

                        // 2. Mobile Number
                        _buildProfileField(
                          icon: Icons.phone_android_rounded,
                          label: 'MOBILE NUMBER',
                          value: phoneDisplay.isNotEmpty ? phoneDisplay : '—',
                          isDark: isDark,
                        ),
                      ],
              ),
            ),

            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _confirmAndLogout,
                icon: const Icon(Icons.logout_rounded, color: Colors.white),
                label: const Text(
                  'Log Out',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF44336),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileField({
    required IconData icon,
    required String label,
    required String value,
    bool isDark = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E3A8A).withOpacity(0.3) : Colors.blue.shade50,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: const Color(0xFF2196F3)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isDark ? const Color(0xFF94A3B8) : Colors.grey.shade500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider([bool isDark = false]) {
    return Divider(height: 1, thickness: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9));
  }
}
