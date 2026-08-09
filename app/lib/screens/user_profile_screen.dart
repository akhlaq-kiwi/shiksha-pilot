import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';

class UserProfileScreen extends StatefulWidget {
  final String userName;
  final String userRole;
  final String schoolName;
  final String userPhone;
  final String photoUrl;
  final List<dynamic> children;
  final int? activeStudentId;
  final Function(int)? onSwitchChild;

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
  }) : super(key: key);

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  int? _currentActiveChildId;

  @override
  void initState() {
    super.initState();
    _currentActiveChildId = widget.activeStudentId;
  }

  Future<void> _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();

    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isStudentOrParent = widget.userRole.toUpperCase() == 'STUDENT' || widget.userRole.toUpperCase() == 'PARENT';

    // Resolve active student details if student/parent
    Map<String, dynamic>? activeStudent;
    if (isStudentOrParent && widget.children.isNotEmpty) {
      activeStudent = widget.children.firstWhere(
        (c) => c['id'] == _currentActiveChildId,
        orElse: () => widget.children.first,
      ) as Map<String, dynamic>?;
    }

    final String displayName = isStudentOrParent && activeStudent != null
        ? (activeStudent['name'] ?? widget.userName)
        : widget.userName;

    String photo = isStudentOrParent && activeStudent != null
        ? (activeStudent['photo_path']?.toString() ?? widget.photoUrl)
        : widget.photoUrl;

    // Student fields
    final String className = activeStudent?['class_name']?.toString() ?? '';
    final String sectionName = activeStudent?['section_name']?.toString() ?? activeStudent?['section']?.toString() ?? '';
    final String classSecDisplay = sectionName.trim().isNotEmpty
        ? '$className - $sectionName'
        : className;
    final String rollNoDisplay = activeStudent?['roll_no']?.toString() ?? activeStudent?['roll_number']?.toString() ?? '—';
    final String phoneDisplay = isStudentOrParent && activeStudent != null
        ? (activeStudent['student_mobile']?.toString() ?? activeStudent['parent_phone']?.toString() ?? widget.userPhone)
        : widget.userPhone;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        backgroundColor: const Color(0xFF2196F3),
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
                          color: Colors.blue.shade50,
                          child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                        ),
                        errorWidget: (context, url, error) => Container(
                          width: 100,
                          height: 100,
                          color: Colors.blue.shade50,
                          child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                        ),
                      )
                    : Container(
                        width: 100,
                        height: 100,
                        color: Colors.blue.shade50,
                        child: const Icon(Icons.person, size: 50, color: Color(0xFF2196F3)),
                      ),
              ),
            ),
            const SizedBox(height: 16),

            // User / Student Name
            Text(
              displayName,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 24),

            // Multi-child switcher if multiple children exist
            if (isStudentOrParent && widget.children.length > 1) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 20),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SWITCH STUDENT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
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
                              color: isSelected ? Colors.blue.shade50 : Colors.grey.shade50,
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
                                    color: Colors.black87,
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
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
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
                        ),
                        _buildDivider(),

                        // 2. Class/Sec (Show section if available)
                        if (classSecDisplay.isNotEmpty) ...[
                          _buildProfileField(
                            icon: Icons.class_rounded,
                            label: 'CLASS / SECTION',
                            value: classSecDisplay,
                          ),
                          _buildDivider(),
                        ],

                        // 3. Roll No
                        _buildProfileField(
                          icon: Icons.badge_rounded,
                          label: 'ROLL NO',
                          value: rollNoDisplay,
                        ),
                        _buildDivider(),

                        // 4. Mobile Number
                        _buildProfileField(
                          icon: Icons.phone_android_rounded,
                          label: 'MOBILE NUMBER',
                          value: phoneDisplay.isNotEmpty ? phoneDisplay : '—',
                        ),
                      ]
                    : [
                        // TEACHER FIELDS IN EXACT SPECIFIED ORDER:
                        // 1. School Name
                        _buildProfileField(
                          icon: Icons.school_rounded,
                          label: 'SCHOOL NAME',
                          value: widget.schoolName,
                        ),
                        _buildDivider(),

                        // 2. Mobile Number
                        _buildProfileField(
                          icon: Icons.phone_android_rounded,
                          label: 'MOBILE NUMBER',
                          value: phoneDisplay.isNotEmpty ? phoneDisplay : '—',
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
                onPressed: _handleLogout,
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
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
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
                    color: Colors.grey.shade500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9));
  }
}
