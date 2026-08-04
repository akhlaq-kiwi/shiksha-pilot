import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/leave_service.dart';
import '../services/auth_service.dart';
import '../main.dart';
import '../widgets/change_password_dialog.dart';
import 'full_screen_image_screen.dart';

class SettingsScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole;
  final int? selectedStudentId;

  const SettingsScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
  }) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _userName = '';
  String _schoolName = '';
  String _userPhone = '';
  String _userPhoto = '';
  bool _notificationsEnabled = true;
  String _currentTheme = 'Light Mode';
  
  List<dynamic> _children = [];
  int? _activeStudentId;

  List<dynamic> _academicYears = [];
  int? _selectedAcademicYearId;
  String _selectedAcademicYearName = '';

  @override
  void initState() {
    super.initState();
    _loadSettingsData();
  }

  Future<void> _loadSettingsData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('user_name') ?? 'User';
      _schoolName = (prefs.getString('school_name') ?? 'Shiksha Pilot Academy').toUpperCase();
      _userPhone = prefs.getString('user_phone') ?? '';
      _userPhoto = prefs.getString('user_photo') ?? '';
      _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
      _currentTheme = prefs.getString('theme_mode') ?? 'Light Mode';
      _activeStudentId = prefs.getInt('selected_student_id') ?? widget.selectedStudentId;
    });

    final role = widget.userRole.toUpperCase();
    if (role == 'PARENT' || role == 'STUDENT') {
      await _fetchChildrenList();
    }
    await _fetchAcademicYears();
  }

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
          years = data['academic_years'];
        } else if (data is Map && data['data'] != null) {
          years = data['data'];
        } else if (data is List) {
          years = data;
        }

        final prefs = await SharedPreferences.getInstance();
        int? savedAyId = prefs.getInt('selected_academic_year_id');
        String savedAyName = prefs.getString('selected_academic_year_name') ?? '';

        if (savedAyId == null && years.isNotEmpty) {
          final currentYr = years.firstWhere(
            (y) => y['is_current'] == 1 || y['is_current'] == true || y['status'] == 'ACTIVE',
            orElse: () => years.first,
          );
          savedAyId = (currentYr['id'] is int) ? currentYr['id'] : int.tryParse(currentYr['id'].toString());
          savedAyName = currentYr['name'] ?? '';
          if (savedAyId != null) {
            await prefs.setInt('selected_academic_year_id', savedAyId);
            await prefs.setString('selected_academic_year_name', savedAyName);
          }
        } else if (savedAyId != null && savedAyName.isEmpty && years.isNotEmpty) {
          final matched = years.firstWhere(
            (y) => (y['id'] is int ? y['id'] : int.tryParse(y['id'].toString())) == savedAyId,
            orElse: () => null,
          );
          if (matched != null) {
            savedAyName = matched['name']?.toString() ?? '';
          }
        }

        if (mounted) {
          setState(() {
            _academicYears = years;
            _selectedAcademicYearId = savedAyId;
            _selectedAcademicYearName = savedAyName;
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching academic years in settings: $e');
    }
  }

  Future<void> _handleSwitchAcademicYear(int yearId, String yearName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('selected_academic_year_id', yearId);
    await prefs.setString('selected_academic_year_name', yearName);

    if (mounted) {
      setState(() {
        _selectedAcademicYearId = yearId;
        _selectedAcademicYearName = yearName;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Switched Academic Year to $yearName'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          backgroundColor: Colors.indigo.shade800,
        ),
      );
    }
  }

  Future<void> _fetchChildrenList() async {
    try {
      final childrenList = await widget.leaveService.getChildren();
      setState(() {
        _children = childrenList;
      });
    } catch (e) {
      debugPrint('Error loading children in settings: $e');
    }
  }

  Future<void> _handleSwitchStudent(int childId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('selected_student_id', childId);
    
    final active = _children.firstWhere(
      (c) => c['id'] == childId,
      orElse: () => null,
    );
    
    if (active != null) {
      final name = active['name'] ?? '';
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
    await prefs.clear();

    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _showSwitchStudentDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Switch Account', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Container(
            width: double.maxFinite,
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
                  final fullUrl = childPhoto.startsWith('http') ? childPhoto : '${widget.leaveService.baseUrl}$childPhoto';
                  leadingWidget = CircleAvatar(
                    backgroundImage: NetworkImage(fullUrl),
                    backgroundColor: Colors.indigo.shade50,
                  );
                } else {
                  leadingWidget = CircleAvatar(
                    backgroundColor: isCurrent ? Colors.indigo : Colors.grey.shade200,
                    foregroundColor: isCurrent ? Colors.white : Colors.grey.shade700,
                    child: const Icon(Icons.person),
                  );
                }

                return Container(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    color: isCurrent ? Colors.indigo.shade50.withOpacity(0.4) : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ListTile(
                    leading: leadingWidget,
                    title: Text(
                      child['name'] ?? '',
                      style: TextStyle(
                        fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                        color: isCurrent ? Colors.indigo.shade800 : Colors.black87,
                      ),
                    ),
                    trailing: isCurrent ? Icon(Icons.check_circle, color: Colors.indigo.shade800) : null,
                    onTap: () {
                      Navigator.pop(context);
                      _handleSwitchStudent(childId);
                    },
                  ),
                );
              },
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

  void _showProfileDetails() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Profile Details', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Container(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDetailRow('Name', _userName),
              _buildDetailRow('Phone', _userPhone),
              _buildDetailRow('Associated School', _schoolName),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87)),
        ],
      ),
    );
  }

  void _showThemeSelector() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Appearance Theme', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        content: Container(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: ['Light Mode', 'Dark Mode', 'System Defaults'].map((mode) {
              final isSelected = _currentTheme == mode;
              return Container(
                margin: const EdgeInsets.symmetric(vertical: 4),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.indigo.shade50.withOpacity(0.4) : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListTile(
                  leading: Icon(
                    mode == 'Light Mode'
                        ? Icons.light_mode_rounded
                        : mode == 'Dark Mode'
                            ? Icons.dark_mode_rounded
                            : Icons.settings_brightness_rounded,
                    color: isSelected ? Colors.indigo.shade800 : Colors.grey.shade700,
                  ),
                  title: Text(
                    mode,
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      color: isSelected ? Colors.indigo.shade800 : Colors.black87,
                    ),
                  ),
                  trailing: isSelected ? Icon(Icons.check_circle, color: Colors.indigo.shade800) : null,
                  onTap: () async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.setString('theme_mode', mode);
                    setState(() {
                      _currentTheme = mode;
                    });
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Theme changed to $mode.'), behavior: SnackBarBehavior.floating),
                    );
                  },
                ),
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showHelpSupport() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Help & Support', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Container(
          width: double.maxFinite,
          child: const Text(
            'For any queries, please reach out to the school administration office or contact Shiksha Pilot technical support at support@shikshapilot.com.',
            style: TextStyle(height: 1.4),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('About App', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Container(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('Shiksha Pilot School Hub', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              SizedBox(height: 4),
              Text('Version: 1.0.0 (Production-Build)', style: TextStyle(color: Colors.grey, fontSize: 12)),
              SizedBox(height: 12),
              Text('A unified school portals platform designed for parents, teachers, and administrators.'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    String photoUrl = _userPhoto;
    Widget avatarWidget;
    if (photoUrl.isNotEmpty) {
      final fullUrl = photoUrl.startsWith('http') ? photoUrl : '${widget.leaveService.baseUrl}$photoUrl';
      avatarWidget = CircleAvatar(
        radius: 46,
        backgroundImage: NetworkImage(fullUrl),
        backgroundColor: Colors.indigo.shade50,
      );
    } else {
      avatarWidget = CircleAvatar(
        radius: 46,
        backgroundColor: Colors.indigo.shade50,
        child: Icon(Icons.person, size: 50, color: Colors.indigo.shade800),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.indigo.shade200, width: 1),
                ),
                child: PopupMenuButton<int>(
                  tooltip: 'Switch Academic Year',
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  offset: const Offset(0, 42),
                  elevation: 4,
                  onSelected: (int selectedId) {
                    final yr = _academicYears.firstWhere(
                      (y) => (y['id'] is int ? y['id'] : int.tryParse(y['id'].toString())) == selectedId,
                      orElse: () => null,
                    );
                    if (yr != null) {
                      _handleSwitchAcademicYear(selectedId, yr['name']?.toString() ?? '');
                    }
                  },
                  itemBuilder: (BuildContext context) {
                    if (_academicYears.isEmpty) {
                      return [
                        PopupMenuItem<int>(
                          value: _selectedAcademicYearId ?? 0,
                          child: Row(
                            children: [
                              Icon(Icons.check_circle_rounded, size: 16, color: Colors.indigo.shade700),
                              const SizedBox(width: 8),
                              Text(
                                _selectedAcademicYearName.isNotEmpty ? _selectedAcademicYearName : '2026-2027 (Active)',
                                style: TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo.shade900, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ];
                    }
                    return _academicYears.map((yr) {
                      final yrId = (yr['id'] is int) ? yr['id'] as int : int.tryParse(yr['id'].toString()) ?? 0;
                      final isSelected = yrId == _selectedAcademicYearId;
                      final isCurrent = yr['is_current'] == 1 || yr['is_current'] == true || yr['status'] == 'ACTIVE';

                      return PopupMenuItem<int>(
                        value: yrId,
                        child: Row(
                          children: [
                            Icon(
                              isSelected ? Icons.check_circle_rounded : Icons.calendar_today_rounded,
                              size: 16,
                              color: isSelected ? Colors.indigo.shade700 : Colors.grey.shade600,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${yr['name']}${isCurrent ? ' (Current)' : ''}',
                              style: TextStyle(
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? Colors.indigo.shade900 : Colors.black87,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList();
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.calendar_month_rounded, size: 16, color: Colors.indigo.shade700),
                      const SizedBox(width: 6),
                      Text(
                        _selectedAcademicYearName.isNotEmpty
                            ? _selectedAcademicYearName
                            : '2026-2027',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo.shade900,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.arrow_drop_down_rounded, size: 18, color: Colors.indigo.shade700),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Profile Card Header (Fixed, non-scrollable)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.only(top: 24, bottom: 20, left: 20, right: 20),
              width: double.infinity,
              child: Column(
                children: [
                  GestureDetector(
                    onTap: () {
                      if (_userPhoto.isNotEmpty) {
                        final fullUrl = _userPhoto.startsWith('http') ? _userPhoto : '${widget.leaveService.baseUrl}$_userPhoto';
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => FullScreenImageScreen(imageUrl: fullUrl),
                          ),
                        );
                      }
                    },
                    child: Hero(
                      tag: 'user_profile_icon',
                      child: avatarWidget,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _userName,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.black87),
                  ),
                ],
              ),
            ),
            
            // Associated School Name Box (Fixed, non-scrollable)
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.indigo.shade100, width: 1),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.indigo,
                      radius: 20,
                      child: const Icon(Icons.school, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'ASSOCIATED SCHOOL',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.indigo, letterSpacing: 0.8),
                          ),
                          const SizedBox(height: 2),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(
                              _schoolName.toUpperCase(),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.black87),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // Scrollable Middle Options ("Profile Details" to "About")
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
                      ],
                    ),
                    child: Column(
                      children: [
                        _buildSettingsTile(
                          icon: Icons.person_outline_rounded,
                          title: 'Profile Details',
                          subtitle: 'View user profile attributes',
                          onTap: _showProfileDetails,
                        ),
                        const Divider(height: 1, indent: 56),
                        _buildSettingsTile(
                          icon: Icons.lock_open_rounded,
                          title: 'Change Password',
                          subtitle: 'Update account password',
                          onTap: _showChangePasswordDialog,
                        ),
                        const Divider(height: 1, indent: 56),
                        _buildSettingsTile(
                          icon: Icons.notifications_active_outlined,
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
                            activeColor: Colors.indigo,
                          ),
                        ),
                        if ((widget.userRole.toUpperCase() == 'STUDENT' || widget.userRole.toUpperCase() == 'PARENT') && _children.length > 1) ...[
                          const Divider(height: 1, indent: 56),
                          _buildSettingsTile(
                            icon: Icons.swap_horiz_rounded,
                            title: 'Switch Account',
                            subtitle: 'Change active student profile',
                            onTap: _showSwitchStudentDialog,
                          ),
                        ],
                        const Divider(height: 1, indent: 56),
                        _buildSettingsTile(
                          icon: Icons.color_lens_outlined,
                          title: 'Appearance Theme',
                          subtitle: _currentTheme,
                          onTap: _showThemeSelector,
                        ),
                        const Divider(height: 1, indent: 56),
                        _buildSettingsTile(
                          icon: Icons.help_outline_rounded,
                          title: 'Help & Support',
                          subtitle: 'Get customer assistance',
                          onTap: _showHelpSupport,
                        ),
                        const Divider(height: 1, indent: 56),
                        _buildSettingsTile(
                          icon: Icons.info_outline_rounded,
                          title: 'About',
                          subtitle: 'Application version info',
                          onTap: _showAboutDialog,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Danger Logout Action (Fixed, non-scrollable at the bottom)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Container(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Confirm Logout'),
                        content: const Text('Are you sure you want to log out from this device?'),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel'),
                          ),
                          ElevatedButton(
                            onPressed: () {
                              Navigator.pop(context);
                              _handleLogout();
                            },
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                            child: const Text('Log Out'),
                          ),
                        ],
                      ),
                    );
                  },
                  icon: const Icon(Icons.logout_rounded, color: Colors.white),
                  label: const Text('LOG OUT', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.8)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade600,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.indigo.shade50.withOpacity(0.5),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.indigo, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
      subtitle: Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      trailing: trailing ?? const Icon(Icons.chevron_right_rounded, color: Colors.grey),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  }
}
