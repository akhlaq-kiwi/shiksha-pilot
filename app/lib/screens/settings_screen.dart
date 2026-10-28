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
import 'package:cached_network_image/cached_network_image.dart';

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
  String _workingBaseUrl = '';
  bool _notificationsEnabled = true;
  String _currentTheme = 'Light Mode';
  
  List<dynamic> _children = [];
  int? _activeStudentId;

  bool _isFeeCollector = false;
  List<dynamic> _academicYears = [];
  int? _selectedAcademicYearId;
  String _selectedAcademicYearName = '';
  String _selectedAcademicYearStatus = 'ACTIVE';

  DeletionRequest? _deletionRequest;
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
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
    setState(() {
      _userName = prefs.getString('user_name') ?? 'User';
      _schoolName = (prefs.getString('school_name') ?? 'Shiksha Pilot Academy').toUpperCase();
      _userPhone = prefs.getString('user_phone') ?? '';
      _userPhoto = prefs.getString('user_photo') ?? '';
      _workingBaseUrl = prefs.getString('base_url') ?? '';
      _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
      _currentTheme = prefs.getString('theme_mode') ?? 'Light Mode';
      _activeStudentId = prefs.getInt('selected_student_id') ?? widget.selectedStudentId;
    });

    final role = widget.userRole.toUpperCase();
    _isFeeCollector = prefs.getBool('is_fee_collector') == true;
    _selectedAcademicYearStatus = prefs.getString('selected_academic_year_status') ?? 'ACTIVE';

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

        // Sort: Active first, then Archived by name DESC, then Draft
        years.sort((a, b) {
          final aStatus = (a['status'] ?? '').toString().toUpperCase();
          final bStatus = (b['status'] ?? '').toString().toUpperCase();
          if (aStatus == 'ACTIVE' || a['is_current'] == 1) return -1;
          if (bStatus == 'ACTIVE' || b['is_current'] == 1) return 1;
          final aName = (a['name'] ?? '').toString();
          final bName = (b['name'] ?? '').toString();
          return bName.compareTo(aName);
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

  void _showSwitchAcademicYearSheet() {
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
                const SizedBox(height: 18),
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
                              if (isSelected)
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Color(0xFFD97706),
                                  size: 22,
                                ),
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
        builder: (dialogCtx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Switch from active year to $nextName?',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
          ),
          content: Text(
            'All dashboards, fees, and student records will show $nextName data until you switch back.\n\n'
            'Fees deposited for inactive or alumni students will be credited to the active academic year.',
            style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF334155)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx, false),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogCtx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Switch Year', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );

      if (confirmed != true) return;
    }

    if (!mounted) return;
    Navigator.pop(bottomSheetContext);
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
                  final String cleanPath = childPhoto.startsWith('/') ? childPhoto : '/$childPhoto';
                  final fullUrl = childPhoto.startsWith('http') ? childPhoto : '${widget.leaveService.baseUrl}$cleanPath';
                  leadingWidget = CircleAvatar(
                    backgroundImage: CachedNetworkImageProvider(fullUrl),
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
            children: [
              const Text('Shiksha Pilot', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                _appVersion.isEmpty ? 'Version unavailable' : 'Version $_appVersion',
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 12),
              const Text('Attendance, fees, results, timetables and notices for teachers, parents and school staff.'),
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
      final String cleanPath = photoUrl.startsWith('/') ? photoUrl : '/$photoUrl';
      final String base = (_workingBaseUrl.isNotEmpty && !_workingBaseUrl.contains('127.0.0.1'))
          ? _workingBaseUrl
          : widget.leaveService.baseUrl;
      final fullUrl = photoUrl.startsWith('http') ? photoUrl : '${base.replaceAll(RegExp(r'/+$'), '')}$cleanPath';
      avatarWidget = CircleAvatar(
        radius: 46,
        backgroundImage: CachedNetworkImageProvider(fullUrl),
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
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                  if (_canSwitchAcademicYear) ...[
                    const Divider(height: 1, indent: 56),
                    _buildSettingsTile(
                      icon: Icons.calendar_month_rounded,
                      title: 'Switch Academic Year',
                      subtitle: _selectedAcademicYearName.isNotEmpty
                          ? '$_selectedAcademicYearName (${_selectedAcademicYearStatus.toUpperCase()})'
                          : 'Select Academic Session',
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _buildAyStatusBadge(_selectedAcademicYearStatus),
                          const SizedBox(width: 6),
                          const Icon(Icons.chevron_right_rounded, color: Colors.grey),
                        ],
                      ),
                      onTap: _showSwitchAcademicYearSheet,
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
                  const Divider(height: 1, indent: 56),
                  _buildSettingsTile(
                    icon: Icons.person_remove_outlined,
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
    final pending = _deletionRequest?.isPending == true ? _deletionRequest : null;

    if (pending != null) {
      final withdraw = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Deletion request pending'),
          content: const Text(
            'Your school administrator has your request and will action it. '
            'Your account still works until they do.\n\n'
            'Do you want to withdraw the request?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep request'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Withdraw'),
            ),
          ],
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
      builder: (ctx) => AlertDialog(
        title: const Text('Delete my account'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'This sends a request to your school administrator. When they action it:',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 10),
              const Text(
                '\u2022 your name, mobile number and password are permanently removed\n'
                '\u2022 you will no longer be able to sign in\n'
                '\u2022 attendance, fee and exam records stay with your school',
                style: TextStyle(fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 12),
              const Text(
                'This cannot be undone once actioned.',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'Reason (optional)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red.shade700),
            child: const Text('Request deletion'),
          ),
        ],
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
    required String title,
    required String subtitle,
    Widget? trailing,
    VoidCallback? onTap,
    bool danger = false,
  }) {
    final accent = danger ? Colors.red.shade700 : Colors.indigo;
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: (danger ? Colors.red.shade50 : Colors.indigo.shade50).withOpacity(0.5),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: accent, size: 20),
      ),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: danger ? accent : null)),
      subtitle: Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      trailing: trailing ?? const Icon(Icons.chevron_right_rounded, color: Colors.grey),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  }
}
