import 'package:school_hub/screens/attachment_gallery_screen.dart';
import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:school_hub/services/teacher_management_service.dart';

class TeachersScreen extends StatefulWidget {
  final TeacherManagementService teacherService;
  final String userRole;
  final bool isPrincipal;
  final bool isFeeCollector;

  const TeachersScreen({
    super.key,
    required this.teacherService,
    required this.userRole,
    this.isPrincipal = false,
    this.isFeeCollector = false,
  });

  @override
  State<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends State<TeachersScreen> {
  bool _isLoading = true;
  String _errorMessage = '';
  String _successBanner = '';
  Timer? _bannerTimer;

  List<Map<String, dynamic>> _teachers = [];
  Map<String, dynamic> _schoolProfile = {};
  List<Map<String, dynamic>> _academicYears = [];
  int _totalPeriodsLimit = 8;

  String _searchQuery = '';
  String _statusFilter = 'ALL'; // 'ALL', 'ACTIVE', 'INACTIVE'

  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _showSuccess(String message) {
    _bannerTimer?.cancel();
    setState(() {
      _successBanner = message;
    });
    _bannerTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _successBanner = '';
        });
      }
    });
  }

  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final results = await Future.wait([
        widget.teacherService.getStaff(),
        widget.teacherService.getSchoolProfile(),
        widget.teacherService.getTimetableSettings(),
        widget.teacherService.getAcademicYears(),
      ]);

      if (!mounted) return;

      final staffList = results[0] as List<Map<String, dynamic>>;
      final profile = results[1] as Map<String, dynamic>;
      final timetable = results[2] as Map<String, dynamic>;
      final years = results[3] as List<Map<String, dynamic>>;

      int maxPeriods = 8;
      if (timetable['total_periods'] != null) {
        maxPeriods = int.tryParse(timetable['total_periods'].toString()) ?? 8;
      }

      setState(() {
        _teachers = staffList;
        _schoolProfile = profile;
        _academicYears = years;
        _totalPeriodsLimit = maxPeriods > 0 ? maxPeriods : 8;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        _isLoading = false;
      });
    }
  }

  String _resolveFileUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = widget.teacherService.baseUrl;
    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }


  List<Map<String, dynamic>> get _filteredTeachers {
    return _teachers.where((t) {
      final name = (t['name'] ?? '').toString().toLowerCase();
      final dept = (t['department'] ?? '').toString().toLowerCase();
      final phone = (t['phone'] ?? '').toString();

      final query = _searchQuery.trim().toLowerCase();
      final matchesQuery = query.isEmpty ||
          name.contains(query) ||
          dept.contains(query) ||
          phone.contains(query);
      if (!matchesQuery) return false;

      if (_statusFilter != 'ALL') {
        final status = (t['status'] ?? 'ACTIVE').toString().toUpperCase();
        if (status != _statusFilter) return false;
      }

      return true;
    }).toList();
  }


  @override
  Widget build(BuildContext context) {
    final filtered = _filteredTeachers;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'TEACHERS',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: 0.5,
            color: Color(0xFF0F172A),
          ),
        ),
        centerTitle: false,
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          IconButton(
            tooltip: 'Add Teacher',
            icon: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFFD97706)),
            onPressed: () => _openAddEditTeacherDialog(null),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Color(0xFFD97706)),
                  SizedBox(height: 12),
                  Text(
                    'LOADING TEACHERS...',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                // Top Search Header (Fixed at top, does not scroll)
                Container(
                  color: const Color(0xFFF8FAFC),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_successBanner.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF86EFAC)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _successBanner,
                                  style: const TextStyle(
                                    color: Color(0xFF15803D),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (_errorMessage.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFCA5A5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage,
                                  style: const TextStyle(
                                    color: Color(0xFFB91C1C),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, size: 16, color: Color(0xFFB91C1C)),
                                onPressed: () => setState(() => _errorMessage = ''),
                              ),
                            ],
                          ),
                        ),

                      // Search Bar Only
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val;
                            });
                          },
                          decoration: InputDecoration(
                            hintText: 'Search teachers...',
                            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                            suffixIcon: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (_searchQuery.isNotEmpty)
                                  IconButton(
                                    icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF64748B)),
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _searchQuery = '');
                                    },
                                  ),
                                if (_searchQuery.isNotEmpty) const SizedBox(width: 4),
                                Container(
                                  height: 20,
                                  width: 1,
                                  color: const Color(0xFFCBD5E1),
                                  margin: const EdgeInsets.symmetric(horizontal: 4),
                                ),
                                InkWell(
                                  onTap: _openStatusFilterBottomSheet,
                                  borderRadius: BorderRadius.circular(20),
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                                    child: Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        Icon(
                                          Icons.tune_rounded,
                                          size: 20,
                                          color: _statusFilter != 'ALL'
                                              ? const Color(0xFFD97706)
                                              : const Color(0xFF0F172A),
                                        ),
                                        if (_statusFilter != 'ALL')
                                          Positioned(
                                            top: -2,
                                            right: -2,
                                            child: Container(
                                              width: 7,
                                              height: 7,
                                              decoration: const BoxDecoration(
                                                color: Color(0xFFD97706),
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            isDense: true,
                            filled: true,
                            fillColor: Colors.white,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(30),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(30),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(30),
                              borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Teachers Cards Grid (Scrollable)
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadAllData,
                    color: const Color(0xFFD97706),
                    child: filtered.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              Container(
                                margin: const EdgeInsets.all(24),
                                padding: const EdgeInsets.all(36),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        (_searchQuery.isNotEmpty || _statusFilter != 'ALL')
                                            ? 'No teachers match the current filters.'
                                            : 'No teachers found.',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
                                      ),
                                      if (_searchQuery.isNotEmpty || _statusFilter != 'ALL') ...[
                                        const SizedBox(height: 12),
                                        OutlinedButton(
                                          onPressed: () {
                                            _searchController.clear();
                                            setState(() {
                                              _searchQuery = '';
                                              _statusFilter = 'ALL';
                                            });
                                          },
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: const Color(0xFFD97706),
                                            side: const BorderSide(color: Color(0xFFD97706)),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                          ),
                                          child: const Text('Reset Filters', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          )
                        : GridView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 0.70,
                            ),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              return _buildTeacherCard(filtered[index]);
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildTeacherCard(Map<String, dynamic> t) {
    final bool isPrincipal = (t['role']?.toString().toUpperCase() == 'PRINCIPAL') ||
        t['is_principal'] == 1 ||
        t['is_principal'] == true ||
        t['is_principal'] == '1';

    final bool isFeeCollector = t['is_fee_collector'] == 1 ||
        t['is_fee_collector'] == true ||
        t['is_fee_collector'] == '1';

    final String name = (t['name'] ?? 'Teacher').toString();
    final String dept = (t['department'] ?? 'General').toString();
    final String photoPath = (t['photo_path'] ?? '').toString();
    final String status = (t['status'] ?? 'ACTIVE').toString().toUpperCase();

    final int rawAssigned = int.tryParse(t['assigned_periods']?.toString() ?? '0') ?? 0;
    final int maxPeriods = _totalPeriodsLimit;
    final int assigned = rawAssigned > maxPeriods ? maxPeriods : rawAssigned;

    final bool isInactive = status == 'INACTIVE';
    final bool isOccupied = assigned >= maxPeriods;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => _openTeacherDetails(t),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
          child: Column(
            children: [
              // Top Badges & 3-dots Menu Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      if (isPrincipal)
                        Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: const Text(
                            'P',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      if (isPrincipal && isFeeCollector) const SizedBox(width: 4),
                      if (isFeeCollector)
                        Container(
                          width: 22,
                          height: 22,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: const Color(0xFF059669),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: const Text(
                            'FC',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                    ],
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF64748B)),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    onSelected: (action) => _handleCardMenuAction(action, t),
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit_profile',
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 16, color: Color(0xFFD97706)),
                            SizedBox(width: 8),
                            Text('Edit Profile', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'credentials',
                        child: Row(
                          children: [
                            Icon(Icons.lock_reset_rounded, size: 16, color: Color(0xFF4F46E5)),
                            SizedBox(width: 8),
                            Text('Credentials', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 6),

              // Enlarged Avatar (60% increase: size 96, shifted upwards)
              _buildTeacherAvatar(photoPath, name, size: 96),

              const SizedBox(height: 8),

              // Teacher Name
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 2),

              // Teacher Subject / Department
              Text(
                dept.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: Color(0xFF64748B),
                ),
              ),

              const Spacer(),

              // Bottom Status & Workload Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isInactive
                          ? const Color(0xFFFEE2E2)
                          : isOccupied
                              ? const Color(0xFFFFEDD5)
                              : const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isInactive
                            ? const Color(0xFFFCA5A5)
                            : isOccupied
                                ? const Color(0xFFFDBA74)
                                : const Color(0xFFFDE68A),
                      ),
                    ),
                    child: Text(
                      isInactive ? 'INACTIVE' : isOccupied ? 'OCCUPIED' : 'AVAILABLE',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: isInactive
                            ? const Color(0xFFDC2626)
                            : isOccupied
                                ? const Color(0xFFC2410C)
                                : const Color(0xFF92400E),
                      ),
                    ),
                  ),
                  Text(
                    'Assigned $assigned/$maxPeriods',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTeacherAvatar(String photoPath, String name, {double size = 96}) {
    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final cleanInitials = initials.isEmpty ? 'TC' : initials;

    if (photoPath.isNotEmpty) {
      final fullUrl = _resolveFileUrl(photoPath);
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
        color: const Color(0xFFE0F2FE),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFBAE6FD), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.35,
          fontWeight: FontWeight.w900,
          color: const Color(0xFF0369A1),
        ),
      ),
    );
  }

  void _handleCardMenuAction(String action, Map<String, dynamic> t) {
    switch (action) {
      case 'view_details':
        _openTeacherDetails(t);
        break;
      case 'id_card':
        _openIdentityCardsScreen(t['id']);
        break;
      case 'edit_profile':
        _openAddEditTeacherDialog(t);
        break;
      case 'credentials':
        _openCredentialsDialog(t);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // TEACHER PROFILE DETAILS VIEW
  // --------------------------------------------------------------------------
  void _openTeacherDetails(Map<String, dynamic> teacher) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _TeacherDetailsScreen(
          teacherId: int.tryParse(teacher['id'].toString()) ?? 0,
          initialData: teacher,
          teacherService: widget.teacherService,
          schoolProfile: _schoolProfile,
          academicYears: _academicYears,
          onEdit: () {
            Navigator.pop(context);
            _openAddEditTeacherDialog(teacher);
          },
          onIdCard: () {
            _openIdentityCardsScreen(teacher['id']);
          },
        ),
      ),
    ).then((_) => _loadAllData());
  }

  // --------------------------------------------------------------------------
  // TEACHERS STATUS FILTER BOTTOM SHEET
  // --------------------------------------------------------------------------
  void _openStatusFilterBottomSheet() {
    String tempStatus = _statusFilter;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Filter Teachers',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (tempStatus != 'ALL')
                          TextButton(
                            onPressed: () {
                              setModalState(() => tempStatus = 'ALL');
                            },
                            child: const Text(
                              'Reset',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'STATUS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildFilterOption(
                      label: 'All Teachers',
                      subtitle: 'Show both active and inactive teachers',
                      selected: tempStatus == 'ALL',
                      onTap: () => setModalState(() => tempStatus = 'ALL'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Active Teachers',
                      subtitle: 'Show only currently active teachers',
                      selected: tempStatus == 'ACTIVE',
                      onTap: () => setModalState(() => tempStatus = 'ACTIVE'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Inactive Teachers',
                      subtitle: 'Show only inactive teachers',
                      selected: tempStatus == 'INACTIVE',
                      onTap: () => setModalState(() => tempStatus = 'INACTIVE'),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => _statusFilter = tempStatus);
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Apply Filter', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFilterOption({
    required String label,
    required String subtitle,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFEF3C7).withValues(alpha: 0.5) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                      color: selected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
              color: selected ? const Color(0xFFD97706) : const Color(0xFF94A3B8),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // ADD / EDIT TEACHER FORM DIALOG
  // --------------------------------------------------------------------------
  void _openAddEditTeacherDialog(Map<String, dynamic>? existingTeacher) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AddEditTeacherModal(
        existingTeacher: existingTeacher,
        teacherService: widget.teacherService,
        onSuccess: (msg) {
          Navigator.pop(context);
          _showSuccess(msg);
          _loadAllData();
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CREDENTIALS DIALOG
  // --------------------------------------------------------------------------
  void _openCredentialsDialog(Map<String, dynamic> teacher) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TeacherCredentialsModal(
        teacher: teacher,
        teacherService: widget.teacherService,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // IDENTITY CARDS PREVIEW & PDF DOWNLOAD
  // --------------------------------------------------------------------------
  void _openIdentityCardsScreen(dynamic singleTeacherId) {
    final int? targetId = singleTeacherId != null ? int.tryParse(singleTeacherId.toString()) : null;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _TeacherIdCardsPreviewScreen(
          teachers: _teachers,
          singleTeacherId: targetId,
          schoolProfile: _schoolProfile,
          academicYears: _academicYears,
          teacherService: widget.teacherService,
        ),
      ),
    );
  }
}

// ============================================================================
// DETAILS SCREEN
// ============================================================================
class _TeacherDetailsScreen extends StatefulWidget {
  final int teacherId;
  final Map<String, dynamic> initialData;
  final TeacherManagementService teacherService;
  final Map<String, dynamic> schoolProfile;
  final List<Map<String, dynamic>> academicYears;
  final VoidCallback onEdit;
  final VoidCallback onIdCard;

  const _TeacherDetailsScreen({
    required this.teacherId,
    required this.initialData,
    required this.teacherService,
    required this.schoolProfile,
    required this.academicYears,
    required this.onEdit,
    required this.onIdCard,
  });

  @override
  State<_TeacherDetailsScreen> createState() => _TeacherDetailsScreenState();
}

class _TeacherDetailsScreenState extends State<_TeacherDetailsScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _details = {};
  String _error = '';
  bool _docsExpanded = false;

  @override
  void initState() {
    super.initState();
    _details = widget.initialData;
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    try {
      final res = await widget.teacherService.getStaffDetails(widget.teacherId);
      if (mounted) {
        setState(() {
          _details = res.isNotEmpty ? res : widget.initialData;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  String _resolveFileUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = widget.teacherService.baseUrl;
    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }

  @override
  Widget build(BuildContext context) {
    final t = _details;
    final String name = (t['name'] ?? 'Teacher Profile').toString();
    final String empId = (t['employee_id'] ?? (t['id'] != null ? 'TCH-${t['id'].toString().padLeft(4, '0')}' : '-')).toString();
    final String status = (t['status'] ?? 'ACTIVE').toString().toUpperCase();
    final String dept = (t['department'] ?? 'General').toString();
    final String photoPath = (t['photo_path'] ?? '').toString();

    final List documents = (t['documents'] is List) ? (t['documents'] as List) : [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Teacher Profile',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                    ),

                  // Profile Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        _buildBigAvatar(photoPath, name),
                        const SizedBox(height: 12),
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Employee ID: $empId',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: status == 'ACTIVE' ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: status == 'ACTIVE' ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                                ),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: status == 'ACTIVE' ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                dept.toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF334155),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 28, color: Color(0xFFE2E8F0)),

                        // Personal details table
                        _buildDetailRow("Father's Name", t['father_name']?.toString() ?? '—'),
                        _buildDetailRow("Mother's Name", t['mother_name']?.toString() ?? '—'),
                        _buildDetailRow("Contact Phone", t['phone']?.toString() ?? '—'),
                        _buildDetailRow("Joining Date", t['joining_date']?.toString() ?? '—'),
                        if (t['exit_date'] != null && t['exit_date'].toString().isNotEmpty)
                          _buildDetailRow("Exit Date", t['exit_date'].toString(), isAlert: true),
                        _buildDetailRow("Monthly Salary", t['salary'] != null ? '₹${t['salary']}' : '—'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Address Details Card
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ADDRESS DETAILS',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                            color: Color(0xFF475569),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text('Current Address', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 4),
                        Text(
                          '${t['current_address_line'] ?? '—'}\n${t['current_city'] ?? ''} ${t['current_state'] ?? ''} ${t['current_pin_code'] ?? ''}'.trim(),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                        ),
                        const Divider(height: 20, color: Color(0xFFF1F5F9)),
                        const Text('Permanent Address', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 4),
                        Text(
                          t['same_as_current'] == 1 || t['same_as_current'] == true
                              ? 'Same as Current Address'
                              : '${t['permanent_address_line'] ?? '—'}\n${t['permanent_city'] ?? ''} ${t['permanent_state'] ?? ''} ${t['permanent_pin_code'] ?? ''}'.trim(),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Documents Card (Collapsible - Smooth animation without blinking)
                  Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: () => setState(() => _docsExpanded = !_docsExpanded),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.folder_open_rounded, size: 18, color: Color(0xFFD97706)),
                                    const SizedBox(width: 8),
                                    Text(
                                      'DOCUMENTS (${documents.length})',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                        color: Color(0xFF475569),
                                      ),
                                    ),
                                  ],
                                ),
                                AnimatedRotation(
                                  turns: _docsExpanded ? 0.5 : 0.0,
                                  duration: const Duration(milliseconds: 200),
                                  child: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        AnimatedCrossFade(
                          firstChild: const SizedBox(width: double.infinity, height: 0),
                          secondChild: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              if (documents.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text(
                                    'No joining documents uploaded for this teacher.',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                )
                              else
                                ListView.separated(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  padding: const EdgeInsets.all(12),
                                  itemCount: documents.length,
                                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                                  itemBuilder: (context, idx) {
                                    final doc = documents[idx];
                                    final rawPath = doc['file_path'] ?? doc['path'] ?? '';
                                    final cat = doc['category'] ?? doc['file_name'] ?? 'Document';
                                    return Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  cat.toString().toUpperCase(),
                                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                                                ),
                                                Text(
                                                  doc['file_name']?.toString() ?? '',
                                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (rawPath.toString().isNotEmpty)
                                          if (rawPath.toString().isNotEmpty)
                                            TextButton.icon(
                                              onPressed: () {
                                                final galleryList = documents.map((docItem) {
                                                  final itemRaw = (docItem['file_path'] ?? docItem['path'] ?? '').toString();
                                                  final catName = (docItem['category'] ?? docItem['file_name'] ?? 'Document').toString();
                                                  final fileName = (docItem['file_name'] != null && docItem['file_name'].toString().isNotEmpty)
                                                      ? docItem['file_name'].toString()
                                                      : catName;
                                                  final isPdf = fileName.toLowerCase().endsWith('.pdf') || itemRaw.toLowerCase().endsWith('.pdf');
                                                  return {
                                                    'file_path': itemRaw,
                                                    'file_name': fileName,
                                                    'category': catName,
                                                    'file_type': isPdf ? 'pdf' : 'image',
                                                  };
                                                }).toList();

                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (context) => AttachmentGalleryScreen(
                                                      attachments: galleryList,
                                                      initialIndex: idx,
                                                      baseUrl: widget.teacherService.baseUrl,
                                                    ),
                                                  ),
                                                );
                                              },
                                              icon: const Icon(Icons.visibility_outlined, size: 14),
                                              label: const Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                            ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                            ],
                          ),
                          crossFadeState: _docsExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                          duration: const Duration(milliseconds: 200),
                        ),
                      ],
                    ),
                  ),

                ],
              ),
            ),
    );
  }

  Widget _buildBigAvatar(String photoPath, String name) {
    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final cleanInitials = initials.isEmpty ? 'TC' : initials;

    if (photoPath.isNotEmpty) {
      final fullUrl = _resolveFileUrl(photoPath);
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: fullUrl,
          width: 96,
          height: 96,
          fit: BoxFit.cover,
          placeholder: (_, __) => _avatarBigInitials(cleanInitials),
          errorWidget: (_, __, ___) => _avatarBigInitials(cleanInitials),
        ),
      );
    }
    return _avatarBigInitials(cleanInitials);
  }

  Widget _avatarBigInitials(String initials) {
    return Container(
      width: 96,
      height: 96,
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFBAE6FD), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          fontSize: 34,
          fontWeight: FontWeight.w900,
          color: Color(0xFF0369A1),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isAlert = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isAlert ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// INDIAN STATES AND CITIES DATA & DOCUMENT CATEGORIES
// ============================================================================
const List<String> kDocumentCategories = [
  'Aadhaar Card',
  'PAN Card',
  'Qualification Certificates',
  'Degree Certificates',
  'Experience Certificates',
  'Resume / CV',
  'Appointment Letter',
  'Identity Proof',
  'Address Proof',
  'Other Documents',
];

const Map<String, List<String>> kIndianStatesAndCities = {
  'Andhra Pradesh': [
    'Anantapur', 'Chittoor', 'Eluru', 'Guntur', 'Kadapa', 'Kakinada', 'Kurnool',
    'Machilipatnam', 'Nellore', 'Ongole', 'Rajahmundry', 'Srikakulam', 'Tirupati',
    'Vijayawada', 'Visakhapatnam', 'Vizianagaram'
  ],
  'Arunachal Pradesh': [
    'Along', 'Bomdila', 'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'
  ],
  'Assam': [
    'Barpeta', 'Bongaigaon', 'Dibrugarh', 'Guwahati', 'Jorhat', 'Karimganj',
    'Nagaon', 'Sibsagar', 'Silchar', 'Tezpur', 'Tinsukia'
  ],
  'Bihar': [
    'Arrah', 'Begusarai', 'Bettiah', 'Bhagalpur', 'Bihar Sharif', 'Chhapra',
    'Darbhanga', 'Gaya', 'Hajipur', 'Katihar', 'Munger', 'Muzaffarpur', 'Patna',
    'Purnia', 'Saharsa', 'Sasaram'
  ],
  'Chhattisgarh': [
    'Ambikapur', 'Bhilai', 'Bilaspur', 'Dhamtari', 'Jagdalpur', 'Korba',
    'Raigarh', 'Raipur', 'Rajnandgaon'
  ],
  'Goa': [
    'Margao', 'Marmagao', 'Panaji', 'Mapusa', 'Ponda'
  ],
  'Gujarat': [
    'Ahmedabad', 'Amreli', 'Anand', 'Bharuch', 'Bhavnagar', 'Bhuj', 'Dahod',
    'Gandhidham', 'Gandhinagar', 'Godhra', 'Jamnagar', 'Junagadh', 'Morbi',
    'Nadiad', 'Navsari', 'Patan', 'Porbandar', 'Rajkot', 'Surat', 'Surendranagar',
    'Vadodara', 'Valsad', 'Vapi'
  ],
  'Haryana': [
    'Ambala', 'Bahadurgarh', 'Bhiwani', 'Faridabad', 'Gurugram', 'Hisar',
    'Jind', 'Kaithal', 'Karnal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak',
    'Sirsa', 'Sonipat', 'Yamunanagar'
  ],
  'Himachal Pradesh': [
    'Bilaspur', 'Chamba', 'Dharamshala', 'Hamirpur', 'Kullu', 'Mandi', 'Nahan',
    'Shimla', 'Solan', 'Una'
  ],
  'Jharkhand': [
    'Bokaro Steel City', 'Chaibasa', 'Deoghar', 'Dhanbad', 'Dumka', 'Giridih',
    'Hazaribagh', 'Jamshedpur', 'Medininagar', 'Phusro', 'Ramgarh', 'Ranchi'
  ],
  'Karnataka': [
    'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru', 'Bhadravati', 'Bidar',
    'Chikkamagaluru', 'Chitradurga', 'Davangere', 'Dharwad', 'Gadag', 'Hassan',
    'Hosapete', 'Hubballi', 'Kalaburagi', 'Kolar', 'Mandya', 'Mangaluru', 'Mysuru',
    'Raichur', 'Shivamogga', 'Tumakuru', 'Udupi', 'Vijayapura'
  ],
  'Kerala': [
    'Alappuzha', 'Kochi', 'Kollam', 'Kottayam', 'Kozhikode', 'Palakkad',
    'Thalassery', 'Thiruvananthapuram', 'Thrissur'
  ],
  'Madhya Pradesh': [
    'Betul', 'Bhind', 'Bhopal', 'Chhindwara', 'Dewas', 'Guna', 'Gwalior',
    'Indore', 'Jabalpur', 'Khandwa', 'Khargone', 'Mandsaur', 'Morena', 'Murwara',
    'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Shivpuri', 'Singrauli', 'Ujjain',
    'Vidisha'
  ],
  'Maharashtra': [
    'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Bhandara',
    'Bhiwandi', 'Bhusawal', 'Chandrapur', 'Dhule', 'Gondia', 'Ichalkaranji',
    'Jalgaon', 'Jalna', 'Kalyan-Dombivli', 'Kolhapur', 'Latur', 'Mumbai', 'Nagpur',
    'Nanded', 'Nandurbar', 'Nashik', 'Navi Mumbai', 'Osmanabad', 'Parbhani', 'Pune',
    'Sangli', 'Satara', 'Solapur', 'Thane', 'Ulhasnagar', 'Vasai-Virar', 'Wardha',
    'Yavatmal'
  ],
  'Manipur': [
    'Bishnupur', 'Churachandpur', 'Imphal', 'Senapati', 'Thoubal'
  ],
  'Meghalaya': [
    'Jowai', 'Nongstoin', 'Shillong', 'Tura'
  ],
  'Mizoram': [
    'Aizawl', 'Champhai', 'Kolasib', 'Lunglei', 'Saiha'
  ],
  'Nagaland': [
    'Dimapur', 'Kohima', 'Mokokchung', 'Tuensang', 'Wokha'
  ],
  'Odisha': [
    'Balangir', 'Baleshwar', 'Baripada', 'Bhadrak', 'Bhawanipatna', 'Bhubaneswar',
    'Cuttack', 'Dhenkanal', 'Jeypore', 'Jharsuguda', 'Puri', 'Raurkela', 'Sambalpur'
  ],
  'Punjab': [
    'Abohar', 'Amritsar', 'Barnala', 'Bathinda', 'Firozpur', 'Hoshiarpur',
    'Jalandhar', 'Khanna', 'Ludhiana', 'Malerkotla', 'Moga', 'Mohali', 'Muktsar',
    'Pathankot', 'Patiala', 'Phagwara', 'Sri Muktsar Sahib'
  ],
  'Rajasthan': [
    'Ajmer', 'Alwar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh',
    'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jhalawar', 'Jhunjhunu', 'Jodhpur',
    'Kishangarh', 'Kota', 'Pali', 'Sikar', 'Sri Ganganagar', 'Tonk', 'Udaipur'
  ],
  'Sikkim': [
    'Gangtok', 'Gyalshing', 'Mangan', 'Namchi'
  ],
  'Tamil Nadu': [
    'Ambattur', 'Avadi', 'Chennai', 'Coimbatore', 'Dindigul', 'Erode',
    'Kancheepuram', 'Karur', 'Madurai', 'Nagercoil', 'Salem', 'Thanjavur',
    'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Thoothukudi', 'Vellore'
  ],
  'Telangana': [
    'Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahbubnagar', 'Miryalaguda',
    'Nalgonda', 'Nizamabad', 'Ramagundam', 'Secunderabad', 'Suryapet', 'Warangal'
  ],
  'Tripura': [
    'Agartala', 'Belonia', 'Dharmanagar', 'Kailasahar', 'Khowai', 'Udaipur'
  ],
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Allahabad (Prayagraj)', 'Amroha', 'Auraiya', 'Azamgarh',
    'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly',
    'Basti', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Deoria', 'Etah',
    'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar',
    'Ghaziabad', 'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi',
    'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur', 'Kasganj',
    'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Maharajganj',
    'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur', 'Moradabad',
    'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Rae Bareli', 'Rampur', 'Saharanpur',
    'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti',
    'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'
  ],
  'Uttarakhand': [
    'Dehradun', 'Haldwani', 'Haridwar', 'Kashipur', 'Mussoorie', 'Nainital',
    'Pithoragarh', 'Rishikesh', 'Roorkee', 'Rudrapur'
  ],
  'West Bengal': [
    'Asansol', 'Baharampur', 'Bally', 'Baranagar', 'Bardhaman', 'Bhatpara',
    'Gopalpur', 'Habra', 'Howrah', 'Kamarhati', 'Kharagpur', 'Kolkata',
    'Kulti', 'Madhyamgram', 'Maheshtala', 'Malda', 'Midnapore', 'Naihati',
    'Panihati', 'Rajpur Sonarpur', 'Siliguri', 'South Dumdum', 'Uluberia'
  ],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  'Delhi': [
    'Delhi', 'New Delhi', 'Noida', 'Gurugram', 'Faridabad', 'Ghaziabad',
    'Dwarka', 'Rohini', 'Narela', 'Saket'
  ],
  'Jammu and Kashmir': [
    'Anantnag', 'Baramulla', 'Jammu', 'Kathua', 'Srinagar', 'Udhampur'
  ],
  'Ladakh': ['Kargil', 'Leh'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam']
};

// ============================================================================
// PHOTO CROP & POSITION DIALOG
// ============================================================================
class _PhotoCropDialog extends StatefulWidget {
  final File imageFile;

  const _PhotoCropDialog({required this.imageFile});

  @override
  State<_PhotoCropDialog> createState() => _PhotoCropDialogState();
}

class _PhotoCropDialogState extends State<_PhotoCropDialog> {
  final GlobalKey _cropKey = GlobalKey();
  final TransformationController _transformController = TransformationController();
  bool _isProcessing = false;

  Future<void> _cropAndFinish() async {
    setState(() => _isProcessing = true);
    try {
      final boundary = _cropKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();
      final tempDir = await getTemporaryDirectory();
      final croppedFile = File('${tempDir.path}/crop_${DateTime.now().millisecondsSinceEpoch}.png');
      await croppedFile.writeAsBytes(bytes);

      if (mounted) {
        Navigator.pop(context, croppedFile);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error cropping image: $e')));
      }
    }
  }

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF0F172A),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Adjust Photo',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pinch to zoom and drag to position within the circle.',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 20),
            Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFD97706), width: 3),
                ),
                child: ClipOval(
                  child: RepaintBoundary(
                    key: _cropKey,
                    child: Container(
                      color: Colors.black,
                      width: 260,
                      height: 260,
                      child: InteractiveViewer(
                        transformationController: _transformController,
                        minScale: 0.5,
                        maxScale: 4.0,
                        boundaryMargin: const EdgeInsets.all(200),
                        child: Image.file(
                          widget.imageFile,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isProcessing ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0xFF334155)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isProcessing ? null : _cropAndFinish,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _isProcessing
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Done', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// ADD / EDIT TEACHER MODAL FORM
// ============================================================================
class _AddEditTeacherModal extends StatefulWidget {
  final Map<String, dynamic>? existingTeacher;
  final TeacherManagementService teacherService;
  final Function(String) onSuccess;

  const _AddEditTeacherModal({
    this.existingTeacher,
    required this.teacherService,
    required this.onSuccess,
  });

  @override
  State<_AddEditTeacherModal> createState() => _AddEditTeacherModalState();
}

class _AddEditTeacherModalState extends State<_AddEditTeacherModal> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameCtrl;
  late TextEditingController _fatherNameCtrl;
  late TextEditingController _motherNameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _salaryCtrl;
  late TextEditingController _departmentCtrl;
  late TextEditingController _joiningDateCtrl;
  late TextEditingController _exitDateCtrl;

  late TextEditingController _currAddressCtrl;
  late TextEditingController _currCityCtrl;
  late TextEditingController _currStateCtrl;
  late TextEditingController _currPinCtrl;

  late TextEditingController _permAddressCtrl;
  late TextEditingController _permCityCtrl;
  late TextEditingController _permStateCtrl;
  late TextEditingController _permPinCtrl;

  bool _sameAsCurrent = false;
  String _photoPath = '';
  bool _uploadingPhoto = false;
  bool _submitting = false;
  String _errorMessage = '';

  List<Map<String, dynamic>> _documents = [];
  bool _uploadingDoc = false;
  String _selectedDocCat = 'Aadhaar Card';

  // Tracking initial values to detect unsaved changes
  late String _initName;
  late String _initFatherName;
  late String _initMotherName;
  late String _initPhone;
  late String _initSalary;
  late String _initDepartment;
  late String _initJoiningDate;
  late String _initExitDate;
  late String _initCurrAddress;
  late String _initCurrCity;
  late String _initCurrState;
  late String _initCurrPin;
  late String _initPermAddress;
  late String _initPermCity;
  late String _initPermState;
  late String _initPermPin;
  late bool _initSameAsCurrent;
  late String _initPhotoPath;
  late int _initDocsCount;

  @override
  void initState() {
    super.initState();
    final t = widget.existingTeacher ?? {};

    _nameCtrl = TextEditingController(text: t['name']?.toString() ?? '');
    _fatherNameCtrl = TextEditingController(text: t['father_name']?.toString() ?? '');
    _motherNameCtrl = TextEditingController(text: t['mother_name']?.toString() ?? '');
    _phoneCtrl = TextEditingController(text: t['phone']?.toString() ?? '');
    _salaryCtrl = TextEditingController(text: t['salary']?.toString() ?? '');
    _departmentCtrl = TextEditingController(text: t['department']?.toString() ?? '');
    _joiningDateCtrl = TextEditingController(text: t['joining_date']?.toString() ?? DateTime.now().toIso8601String().split('T')[0]);
    _exitDateCtrl = TextEditingController(text: t['exit_date']?.toString() ?? '');

    _currAddressCtrl = TextEditingController(text: t['current_address_line']?.toString() ?? '');
    _currCityCtrl = TextEditingController(text: t['current_city']?.toString() ?? '');
    _currStateCtrl = TextEditingController(text: t['current_state']?.toString() ?? '');
    _currPinCtrl = TextEditingController(text: t['current_pin_code']?.toString() ?? '');

    _permAddressCtrl = TextEditingController(text: t['permanent_address_line']?.toString() ?? '');
    _permCityCtrl = TextEditingController(text: t['permanent_city']?.toString() ?? '');
    _permStateCtrl = TextEditingController(text: t['permanent_state']?.toString() ?? '');
    _permPinCtrl = TextEditingController(text: t['permanent_pin_code']?.toString() ?? '');

    _sameAsCurrent = t['same_as_current'] == 1 || t['same_as_current'] == true;
    _photoPath = t['photo_path']?.toString() ?? '';

    if (t['documents'] is List) {
      _documents = (t['documents'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }

    _initName = _nameCtrl.text.trim();
    _initFatherName = _fatherNameCtrl.text.trim();
    _initMotherName = _motherNameCtrl.text.trim();
    _initPhone = _phoneCtrl.text.trim();
    _initSalary = _salaryCtrl.text.trim();
    _initDepartment = _departmentCtrl.text.trim();
    _initJoiningDate = _joiningDateCtrl.text.trim();
    _initExitDate = _exitDateCtrl.text.trim();
    _initCurrAddress = _currAddressCtrl.text.trim();
    _initCurrCity = _currCityCtrl.text.trim();
    _initCurrState = _currStateCtrl.text.trim();
    _initCurrPin = _currPinCtrl.text.trim();
    _initPermAddress = _permAddressCtrl.text.trim();
    _initPermCity = _permCityCtrl.text.trim();
    _initPermState = _permStateCtrl.text.trim();
    _initPermPin = _permPinCtrl.text.trim();
    _initSameAsCurrent = _sameAsCurrent;
    _initPhotoPath = _photoPath;
    _initDocsCount = _documents.length;

    if (widget.existingTeacher != null && widget.existingTeacher!['id'] != null) {
      _loadExistingDocuments();
    }
  }

  Future<void> _loadExistingDocuments() async {
    try {
      final id = int.parse(widget.existingTeacher!['id'].toString());
      final details = await widget.teacherService.getStaffDetails(id);
      if (mounted && details['documents'] is List) {
        setState(() {
          _documents = (details['documents'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _initDocsCount = _documents.length;
        });
      }
    } catch (e) {
      debugPrint('Failed to load existing teacher documents: $e');
    }
  }

  bool _isDirty() {
    if (_nameCtrl.text.trim() != _initName) return true;
    if (_fatherNameCtrl.text.trim() != _initFatherName) return true;
    if (_motherNameCtrl.text.trim() != _initMotherName) return true;
    if (_phoneCtrl.text.trim() != _initPhone) return true;
    if (_salaryCtrl.text.trim() != _initSalary) return true;
    if (_departmentCtrl.text.trim() != _initDepartment) return true;
    if (_joiningDateCtrl.text.trim() != _initJoiningDate) return true;
    if (_exitDateCtrl.text.trim() != _initExitDate) return true;
    if (_currAddressCtrl.text.trim() != _initCurrAddress) return true;
    if (_currCityCtrl.text.trim() != _initCurrCity) return true;
    if (_currStateCtrl.text.trim() != _initCurrState) return true;
    if (_currPinCtrl.text.trim() != _initCurrPin) return true;
    if (_permAddressCtrl.text.trim() != _initPermAddress) return true;
    if (_permCityCtrl.text.trim() != _initPermCity) return true;
    if (_permStateCtrl.text.trim() != _initPermState) return true;
    if (_permPinCtrl.text.trim() != _initPermPin) return true;
    if (_sameAsCurrent != _initSameAsCurrent) return true;
    if (_photoPath != _initPhotoPath) return true;
    if (_documents.length != _initDocsCount) return true;
    return false;
  }

  Future<bool> _showDiscardDialog() async {
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Unsaved Changes', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A))),
        content: const Text(
          'You have unsaved changes. If you leave without saving, your changes will be discarded. Do you want to discard your changes?',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Editing', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Discard', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  Future<void> _handleClose() async {
    if (_isDirty()) {
      final discard = await _showDiscardDialog();
      if (discard && mounted) {
        Navigator.pop(context);
      }
    } else {
      Navigator.pop(context);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _fatherNameCtrl.dispose();
    _motherNameCtrl.dispose();
    _phoneCtrl.dispose();
    _salaryCtrl.dispose();
    _departmentCtrl.dispose();
    _joiningDateCtrl.dispose();
    _exitDateCtrl.dispose();
    _currAddressCtrl.dispose();
    _currCityCtrl.dispose();
    _currStateCtrl.dispose();
    _currPinCtrl.dispose();
    _permAddressCtrl.dispose();
    _permCityCtrl.dispose();
    _permStateCtrl.dispose();
    _permPinCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadPhoto() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png'],
      );

      if (result != null && result.files.single.path != null) {
        final file = File(result.files.single.path!);
        final bytes = await file.length();
        if (bytes > 5 * 1024 * 1024) {
          if (mounted) setState(() => _errorMessage = 'Photo file size cannot exceed 5 MB.');
          return;
        }

        // Allow user to select and position which part of photo to show in placeholder
        if (!mounted) return;
        final croppedFile = await showDialog<File?>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => _PhotoCropDialog(imageFile: file),
        );

        if (croppedFile == null || !mounted) return;

        setState(() => _uploadingPhoto = true);
        final url = await widget.teacherService.uploadFile(croppedFile, category: 'staff-photos');
        if (mounted) {
          setState(() {
            _photoPath = url;
            _uploadingPhoto = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _uploadingPhoto = false;
          _errorMessage = 'Failed to upload photo: ${e.toString().replaceAll('Exception:', '').trim()}';
        });
      }
    }
  }

  Future<void> _pickAndUploadDoc() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
      );

      if (result != null && result.files.single.path != null) {
        final file = File(result.files.single.path!);
        final bytes = await file.length();
        if (bytes > 10 * 1024 * 1024) {
          if (mounted) setState(() => _errorMessage = 'Maximum file size is 10 MB.');
          return;
        }
        final ext = file.path.split('.').last.toLowerCase();
        if (!['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'].contains(ext)) {
          if (mounted) setState(() => _errorMessage = 'This file type is not supported. Supported: PDF, JPG, PNG, DOC, DOCX.');
          return;
        }
        setState(() => _uploadingDoc = true);
        final url = await widget.teacherService.uploadFile(file, category: 'staff-documents');
        if (mounted) {
          final currentIndex = kDocumentCategories.indexOf(_selectedDocCat);
          String nextCat = _selectedDocCat;
          if (currentIndex != -1 && currentIndex + 1 < kDocumentCategories.length) {
            nextCat = kDocumentCategories[currentIndex + 1];
          }

          setState(() {
            _documents.add({
              'category': _selectedDocCat,
              'file_name': file.path.split(Platform.pathSeparator).last,
              'file_path': url,
              'file_size': bytes,
              'upload_date': DateTime.now().toIso8601String(),
            });
            _selectedDocCat = nextCat;
            _uploadingDoc = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _uploadingDoc = false;
          _errorMessage = 'Failed to upload document: ${e.toString().replaceAll('Exception:', '').trim()}';
        });
      }
    }
  }

  void _openStatePicker({required bool isCurrent}) {
    FocusManager.instance.primaryFocus?.unfocus();
    final stateList = kIndianStatesAndCities.keys.toList()..sort();
    final currentVal = isCurrent ? _currStateCtrl.text : _permStateCtrl.text;

    _showSearchablePicker(
      title: 'Select State',
      options: stateList,
      selectedValue: currentVal,
      onSelected: (selectedState) {
        setState(() {
          if (isCurrent) {
            _currStateCtrl.text = selectedState;
            _currCityCtrl.text = '';
          } else {
            _permStateCtrl.text = selectedState;
            _permCityCtrl.text = '';
          }
        });
      },
    );
  }

  void _openCityPicker({required bool isCurrent}) {
    FocusManager.instance.primaryFocus?.unfocus();
    final selectedState = isCurrent ? _currStateCtrl.text.trim() : _permStateCtrl.text.trim();
    if (selectedState.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select State first.')),
      );
      return;
    }

    final cityList = (kIndianStatesAndCities[selectedState] ?? []).toList()..sort();
    final currentVal = isCurrent ? _currCityCtrl.text : _permCityCtrl.text;

    _showSearchablePicker(
      title: 'Select City ($selectedState)',
      options: cityList,
      selectedValue: currentVal,
      onSelected: (selectedCity) {
        setState(() {
          if (isCurrent) {
            _currCityCtrl.text = selectedCity;
          } else {
            _permCityCtrl.text = selectedCity;
          }
        });
      },
    );
  }

  Future<void> _showSearchablePicker({
    required String title,
    required List<String> options,
    required String selectedValue,
    required ValueChanged<String> onSelected,
  }) async {
    FocusManager.instance.primaryFocus?.unfocus();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        String filter = '';
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final filtered = options.where((o) => o.toLowerCase().contains(filter.toLowerCase())).toList();
            return Container(
              height: MediaQuery.of(ctx).size.height * 0.7,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: [
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Search...',
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
                    ),
                    onChanged: (val) => setModalState(() => filter = val.trim()),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(child: Text('No options found', style: TextStyle(color: Color(0xFF94A3B8))))
                        : NotificationListener<ScrollNotification>(
                            onNotification: (scrollInfo) {
                              if (scrollInfo is ScrollUpdateNotification && (scrollInfo.scrollDelta?.abs() ?? 0) > 0) {
                                FocusScope.of(context).unfocus();
                              }
                              return false;
                            },
                            child: ListView.separated(
                              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                            itemBuilder: (ctx, idx) {
                              final item = filtered[idx];
                              final isSel = item.toLowerCase() == selectedValue.toLowerCase();
                              return ListTile(
                                dense: true,
                                title: Text(
                                  item,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSel ? FontWeight.w800 : FontWeight.w500,
                                    color: isSel ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                                  ),
                                ),
                                trailing: isSel ? const Icon(Icons.check, color: Color(0xFFD97706), size: 18) : null,
                                onTap: () {
                                  FocusManager.instance.primaryFocus?.unfocus();
                                  onSelected(item);
                                  Navigator.pop(ctx);
                                  WidgetsBinding.instance.addPostFrameCallback((_) {
                                    FocusManager.instance.primaryFocus?.unfocus();
                                  });
                                },
                              );
                            },
                          ),
                        ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final currAddr = _currAddressCtrl.text.trim();
    if (currAddr.isEmpty) {
      setState(() => _errorMessage = 'Current address is required.');
      return;
    }
    if (currAddr.length > 50) {
      setState(() => _errorMessage = 'Current address cannot exceed 50 characters.');
      return;
    }
    if (_currStateCtrl.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Current state is required.');
      return;
    }
    if (_currCityCtrl.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Current city is required.');
      return;
    }
    if (_currPinCtrl.text.trim().length != 6) {
      setState(() => _errorMessage = 'Current PIN Code must be exactly 6 digits.');
      return;
    }

    if (!_sameAsCurrent) {
      final permAddr = _permAddressCtrl.text.trim();
      if (permAddr.isEmpty) {
        setState(() => _errorMessage = 'Permanent address is required.');
        return;
      }
      if (permAddr.length > 50) {
        setState(() => _errorMessage = 'Permanent address cannot exceed 50 characters.');
        return;
      }
      if (_permStateCtrl.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Permanent state is required.');
        return;
      }
      if (_permCityCtrl.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Permanent city is required.');
        return;
      }
      if (_permPinCtrl.text.trim().length != 6) {
        setState(() => _errorMessage = 'Permanent PIN Code must be exactly 6 digits.');
        return;
      }
    }

    if (_exitDateCtrl.text.trim().isNotEmpty && _joiningDateCtrl.text.trim().isNotEmpty) {
      final exitDate = DateTime.tryParse(_exitDateCtrl.text.trim());
      final joinDate = DateTime.tryParse(_joiningDateCtrl.text.trim());
      if (exitDate != null && joinDate != null && exitDate.isBefore(joinDate)) {
        setState(() => _errorMessage = 'Exit date cannot be earlier than joining date.');
        return;
      }
    }

    final phone = _phoneCtrl.text.trim();

    setState(() {
      _submitting = true;
      _errorMessage = '';
    });

    final payload = {
      'name': _nameCtrl.text.trim(),
      'father_name': _fatherNameCtrl.text.trim(),
      'mother_name': _motherNameCtrl.text.trim(),
      'phone': phone,
      'salary': double.tryParse(_salaryCtrl.text.trim()) ?? 0,
      'department': _departmentCtrl.text.trim(),
      'joining_date': _joiningDateCtrl.text.trim(),
      'exit_date': _exitDateCtrl.text.trim().isNotEmpty ? _exitDateCtrl.text.trim() : null,
      'photo_path': _photoPath,
      'role': 'Teacher',
      'current_address_line': _currAddressCtrl.text.trim(),
      'current_city': _currCityCtrl.text.trim(),
      'current_state': _currStateCtrl.text.trim(),
      'current_country': 'India',
      'current_pin_code': _currPinCtrl.text.trim(),
      'permanent_address_line': _sameAsCurrent ? _currAddressCtrl.text.trim() : _permAddressCtrl.text.trim(),
      'permanent_city': _sameAsCurrent ? _currCityCtrl.text.trim() : _permCityCtrl.text.trim(),
      'permanent_state': _sameAsCurrent ? _currStateCtrl.text.trim() : _permStateCtrl.text.trim(),
      'permanent_country': 'India',
      'permanent_pin_code': _sameAsCurrent ? _currPinCtrl.text.trim() : _permPinCtrl.text.trim(),
      'same_as_current': _sameAsCurrent ? 1 : 0,
      'documents': _documents,
    };

    try {
      if (widget.existingTeacher != null && widget.existingTeacher!['id'] != null) {
        final id = int.parse(widget.existingTeacher!['id'].toString());
        await widget.teacherService.updateStaff(id, payload);
        widget.onSuccess('Teacher profile updated successfully.');
      } else {
        await widget.teacherService.createStaff(payload);
        widget.onSuccess('Teacher created successfully.');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existingTeacher != null;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handleClose();
      },
      child: Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Header Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isEdit ? 'Edit Teacher Profile' : 'Add Teacher Profile',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: _handleClose,
                  ),
                ],
              ),
            ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Scrollable Form Body
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                FocusManager.instance.primaryFocus?.unfocus();
              },
              child: SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                    if (_errorMessage.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Text(
                          _errorMessage,
                          style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700, fontSize: 12),
                        ),
                      ),

                    // Photo Section (Upload & Remove photo side-by-side in single line, matching badge size)
                    Row(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                          ),
                          alignment: Alignment.center,
                          child: _uploadingPhoto
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                              : _photoPath.isNotEmpty
                                  ? ClipOval(
                                      child: CachedNetworkImage(
                                        imageUrl: widget.teacherService.baseUrl.startsWith('http')
                                            ? '${widget.teacherService.baseUrl}/$_photoPath'
                                            : _photoPath,
                                        width: 58,
                                        height: 58,
                                        fit: BoxFit.cover,
                                        errorWidget: (_, __, ___) => const Icon(Icons.person, size: 30, color: Color(0xFF94A3B8)),
                                      ),
                                    )
                                  : const Icon(Icons.person_outline_rounded, size: 30, color: Color(0xFF94A3B8)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Row(
                            children: [
                              ElevatedButton.icon(
                                onPressed: _uploadingPhoto ? null : _pickAndUploadPhoto,
                                icon: const Icon(Icons.upload_rounded, size: 14),
                                label: Text(
                                  _photoPath.isNotEmpty ? 'Change Photo' : 'Upload Photo',
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFF1F5F9),
                                  foregroundColor: const Color(0xFF0F172A),
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                  minimumSize: const Size(0, 36),
                                  maximumSize: const Size(double.infinity, 36),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                              if (_photoPath.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                ElevatedButton.icon(
                                  onPressed: () => setState(() => _photoPath = ''),
                                  icon: const Icon(Icons.delete_outline_rounded, size: 14, color: Color(0xFFDC2626)),
                                  label: const Text(
                                    'Remove Photo',
                                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFFEE2E2),
                                    foregroundColor: const Color(0xFFDC2626),
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                    minimumSize: const Size(0, 36),
                                    maximumSize: const Size(double.infinity, 36),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Basic Details (Labels above input box, text/hint inside box)
                    const Text('BASIC DETAILS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                    const SizedBox(height: 12),
                    _buildTextField(_nameCtrl, 'Full Name', required: true, minLength: 3),
                    const SizedBox(height: 12),
                    _buildTextField(_fatherNameCtrl, 'Father Name', required: true, minLength: 3),
                    const SizedBox(height: 12),
                    _buildTextField(_motherNameCtrl, 'Mother Name', required: true, minLength: 3),
                    const SizedBox(height: 12),
                    _buildTextField(_phoneCtrl, 'Contact Number (10 digits)', required: true, isDigits: true, exactLength: 10),
                    const SizedBox(height: 12),
                    _buildDateField(_joiningDateCtrl, 'Joining Date', required: true),
                    const SizedBox(height: 12),
                    _buildDateField(_exitDateCtrl, 'Exit Date (Optional)'),
                    const SizedBox(height: 12),
                    _buildTextField(_salaryCtrl, 'Monthly Salary', isNumber: true),
                    const SizedBox(height: 12),
                    _buildTextField(_departmentCtrl, 'Subject / Department (e.g. Mathematics)'),
                    const SizedBox(height: 24),

                    // Current Address
                    const Text('CURRENT ADDRESS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                    const SizedBox(height: 12),
                    _buildTextField(_currAddressCtrl, 'Address Line', required: true, maxLength: 50),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildSelectPicker(
                            label: 'State',
                            value: _currStateCtrl.text,
                            placeholder: 'Select State...',
                            required: true,
                            onTap: () => _openStatePicker(isCurrent: true),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildSelectPicker(
                            label: 'City',
                            value: _currCityCtrl.text,
                            placeholder: 'Select City...',
                            required: true,
                            onTap: () => _openCityPicker(isCurrent: true),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildTextField(_currPinCtrl, 'Pin Code', required: true, isDigits: true, exactLength: 6),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildReadOnlyField(label: 'Country', value: 'India'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Permanent Address
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('PERMANENT ADDRESS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                        InkWell(
                          onTap: () {
                            FocusManager.instance.primaryFocus?.unfocus();
                            setState(() => _sameAsCurrent = !_sameAsCurrent);
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Checkbox(
                                  value: _sameAsCurrent,
                                  activeColor: const Color(0xFFD97706),
                                  onChanged: (val) {
                                    FocusManager.instance.primaryFocus?.unfocus();
                                    setState(() => _sameAsCurrent = val ?? false);
                                  },
                                ),
                                const Text('Same as Current', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (!_sameAsCurrent) ...[
                      const SizedBox(height: 12),
                      _buildTextField(_permAddressCtrl, 'Address Line', required: true, maxLength: 50),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildSelectPicker(
                              label: 'State',
                              value: _permStateCtrl.text,
                              placeholder: 'Select State...',
                              required: true,
                              onTap: () => _openStatePicker(isCurrent: false),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildSelectPicker(
                              label: 'City',
                              value: _permCityCtrl.text,
                              placeholder: 'Select City...',
                              required: true,
                              onTap: () => _openCityPicker(isCurrent: false),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildTextField(_permPinCtrl, 'Pin Code', required: true, isDigits: true, exactLength: 6),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildReadOnlyField(label: 'Country', value: 'India'),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),

                    // Documents Upload (Synchronized with web)
                    const Text('ATTACH DOCUMENTS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    const Text(
                      'Choose File (PDF, JPG, PNG, DOC, DOCX up to 10MB)',
                      style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Builder(
                            builder: (btnContext) {
                              return InkWell(
                                onTap: () async {
                                  FocusManager.instance.primaryFocus?.unfocus();
                                  final renderBox = btnContext.findRenderObject() as RenderBox?;
                                  if (renderBox == null) return;
                                  final offset = renderBox.localToGlobal(Offset.zero);
                                  final size = renderBox.size;
                                  final overlay = Overlay.of(context).context.findRenderObject() as RenderBox?;
                                  if (overlay == null) return;

                                  final position = RelativeRect.fromRect(
                                    Rect.fromLTWH(offset.dx, offset.dy + size.height + 4, size.width, size.height),
                                    Offset.zero & overlay.size,
                                  );

                                  final selected = await showMenu<String>(
                                    context: context,
                                    position: position,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                    color: Colors.white,
                                    elevation: 6,
                                    constraints: BoxConstraints(
                                      minWidth: size.width,
                                      maxWidth: size.width,
                                      maxHeight: 280,
                                    ),
                                    items: kDocumentCategories.map((cat) {
                                      final isSelected = cat == _selectedDocCat;
                                      return PopupMenuItem<String>(
                                        value: cat,
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                        child: Text(
                                          cat,
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                            color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  );

                                  if (selected != null) {
                                    setState(() => _selectedDocCat = selected);
                                  }
                                },
                                borderRadius: BorderRadius.circular(10),
                                child: Container(
                                  height: 44,
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _selectedDocCat,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF0F172A),
                                          ),
                                        ),
                                      ),
                                      const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 18),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        ElevatedButton.icon(
                          onPressed: _uploadingDoc ? null : _pickAndUploadDoc,
                          icon: _uploadingDoc
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.attach_file_rounded, size: 16),
                          label: Text(_uploadingDoc ? 'Uploading...' : 'Upload', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFD97706),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            minimumSize: const Size(0, 44),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                    if (_documents.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      ..._documents.map((d) => Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.description_outlined, size: 18, color: Color(0xFF64748B)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        (d['category'] ?? 'DOCUMENT').toString().toUpperCase(),
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                                      ),
                                      Text(
                                        d['file_name']?.toString() ?? 'Document',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFFDC2626)),
                                  onPressed: () => setState(() => _documents.remove(d)),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ],
                            ),
                          )),
                    ],
                  ],
                ),
              ),
            ),
            ),
          ),

          // Action Buttons Footer
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : _handleClose,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _handleSubmit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _submitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(isEdit ? 'Save Changes' : 'Add Teacher', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }

  Widget _buildTextField(
    TextEditingController ctrl,
    String label, {
    bool required = false,
    int? minLength,
    int? maxLength,
    int? exactLength,
    bool isDigits = false,
    bool isNumber = false,
    bool isEmail = false,
    String? hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
            children: [
              if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          maxLength: maxLength,
          keyboardType: isDigits || isNumber
              ? TextInputType.number
              : isEmail
                  ? TextInputType.emailAddress
                  : TextInputType.text,
          style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            counterText: '',
            hintText: hint ?? 'Enter $label',
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            isDense: true,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626))),
            focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5)),
          ),
          validator: (val) {
            final text = val?.trim() ?? '';
            if (required && text.isEmpty) return '$label is required.';
            if (minLength != null && text.isNotEmpty && text.length < minLength) {
              return '$label must be at least $minLength characters.';
            }
            if (maxLength != null && text.isNotEmpty && text.length > maxLength) {
              return '$label cannot exceed $maxLength characters.';
            }
            if (exactLength != null && text.isNotEmpty && text.length != exactLength) {
              return '$label must be exactly $exactLength digits.';
            }
            if (isEmail && text.isNotEmpty && !text.contains('@')) {
              return 'Enter a valid email address.';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildDateField(TextEditingController ctrl, String label, {bool required = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
            children: [
              if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          readOnly: true,
          style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A), fontWeight: FontWeight.w500),
          onTap: () async {
            FocusManager.instance.primaryFocus?.unfocus();
            final now = DateTime.now();
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.tryParse(ctrl.text) ?? now,
              firstDate: DateTime(1980),
              lastDate: DateTime(2050),
            );
            if (picked != null) {
              ctrl.text = picked.toIso8601String().split('T')[0];
            }
          },
          decoration: InputDecoration(
            hintText: 'Select $label',
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFF64748B)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            isDense: true,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
            errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626))),
            focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5)),
          ),
          validator: (val) {
            if (required && (val == null || val.trim().isEmpty)) return '$label is required.';
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildSelectPicker({
    required String label,
    required String value,
    required String placeholder,
    required VoidCallback onTap,
    bool required = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            text: label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
            children: [
              if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: () {
            FocusManager.instance.primaryFocus?.unfocus();
            onTap();
          },
          borderRadius: BorderRadius.circular(10),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    value.isNotEmpty ? value : placeholder,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: value.isNotEmpty ? FontWeight.w600 : FontWeight.w400,
                      color: value.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: Color(0xFF64748B)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReadOnlyField({required String label, required String value}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
        const SizedBox(height: 6),
        Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// CREDENTIALS MODAL
// ============================================================================
class _TeacherCredentialsModal extends StatefulWidget {
  final Map<String, dynamic> teacher;
  final TeacherManagementService teacherService;

  const _TeacherCredentialsModal({
    required this.teacher,
    required this.teacherService,
  });

  @override
  State<_TeacherCredentialsModal> createState() => _TeacherCredentialsModalState();
}

class _TeacherCredentialsModalState extends State<_TeacherCredentialsModal> {
  bool _isLoading = true;
  String _username = '';
  String _password = '';
  bool _showPassword = false;
  String _error = '';
  bool _isResetting = false;
  final TextEditingController _newPassCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchCreds();
  }

  @override
  void dispose() {
    _newPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchCreds() async {
    final staffId = int.tryParse(widget.teacher['id'].toString()) ?? 0;
    try {
      final res = await widget.teacherService.getCredentials(staffId);
      if (mounted) {
        setState(() {
          _username = res['phone']?.toString() ?? res['username']?.toString() ?? widget.teacher['phone']?.toString() ?? '';
          _password = res['plain_password']?.toString() ?? res['password']?.toString() ?? res['generated_password']?.toString() ?? '';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _username = widget.teacher['phone']?.toString() ?? '';
          _password = '';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleResetPassword() async {
    final newPass = _newPassCtrl.text.trim();
    if (newPass.length < 6) {
      setState(() => _error = 'New password must be at least 6 characters.');
      return;
    }

    final staffId = int.tryParse(widget.teacher['id'].toString()) ?? 0;
    setState(() {
      _isResetting = true;
      _error = '';
    });

    try {
      await widget.teacherService.updateCredentials(staffId: staffId, newPassword: newPass);
      if (mounted) {
        setState(() {
          _password = newPass;
          _newPassCtrl.clear();
          _isResetting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isResetting = false;
          _error = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  widget.teacher['name']?.toString() ?? 'Credentials',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  final textToCopy = 'Login Number: $_username\nPassword: $_password';
                  Clipboard.setData(ClipboardData(text: textToCopy));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Credentials copied to clipboard!'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.copy_rounded, size: 14, color: Color(0xFF2563EB)),
                      SizedBox(width: 6),
                      Text(
                        'Copy Credential',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 16, color: Color(0xFFE2E8F0)),
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
              child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
            ),
          if (_isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Login Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      Text(_username, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                    ],
                  ),
                  const Divider(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Current Password', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _showPassword
                                ? (_password.isNotEmpty ? _password : 'Not Set')
                                : (_password.isNotEmpty ? '••••••••' : '••••••••'),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 4),
                          IconButton(
                            icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: const Color(0xFF64748B)),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                            visualDensity: VisualDensity.compact,
                            splashRadius: 18,
                            padding: const EdgeInsets.all(4),
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text('RESET PASSWORD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _newPassCtrl,
                    decoration: InputDecoration(
                      hintText: 'Enter new password (min 6 chars)',
                      hintStyle: const TextStyle(fontSize: 12),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _isResetting ? null : _handleResetPassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  child: _isResetting
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Update', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================================
// TEACHER ID CARDS PREVIEW & PDF DOWNLOAD
// ============================================================================
class _TeacherIdCardsPreviewScreen extends StatefulWidget {
  final List<Map<String, dynamic>> teachers;
  final int? singleTeacherId;
  final Map<String, dynamic> schoolProfile;
  final List<Map<String, dynamic>> academicYears;
  final TeacherManagementService teacherService;

  const _TeacherIdCardsPreviewScreen({
    required this.teachers,
    this.singleTeacherId,
    required this.schoolProfile,
    required this.academicYears,
    required this.teacherService,
  });

  @override
  State<_TeacherIdCardsPreviewScreen> createState() => _TeacherIdCardsPreviewScreenState();
}

class _TeacherIdCardsPreviewScreenState extends State<_TeacherIdCardsPreviewScreen> {
  bool _isGeneratingPdf = false;

  List<Map<String, dynamic>> get _targetTeachers {
    if (widget.singleTeacherId != null) {
      return widget.teachers.where((t) => t['id'] == widget.singleTeacherId).toList();
    }
    return widget.teachers.where((t) => (t['status'] ?? 'ACTIVE').toString().toUpperCase() == 'ACTIVE').toList();
  }

  String get _schoolName => widget.schoolProfile['name']?.toString() ?? 'SHIKSHA PILOT SCHOOL';

  String get _academicYearName {
    if (widget.academicYears.isNotEmpty) {
      final current = widget.academicYears.firstWhere(
        (y) => y['is_current'] == 1 || y['is_current'] == true,
        orElse: () => widget.academicYears.first,
      );
      return current['name']?.toString() ?? '2028–2029';
    }
    return '2028–2029';
  }

  Future<void> _handleDownloadPdf() async {
    setState(() => _isGeneratingPdf = true);

    try {
      final pdf = pw.Document();
      final teachers = _targetTeachers;

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(24),
          build: (pw.Context context) {
            return [
              pw.Header(
                level: 0,
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(_schoolName.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('TEACHER IDENTITY CARDS - $_academicYearName', style: const pw.TextStyle(fontSize: 10)),
                  ],
                ),
              ),
              pw.SizedBox(height: 12),
              pw.Wrap(
                spacing: 16,
                runSpacing: 16,
                children: teachers.map((t) {
                  final empId = t['employee_id'] ?? (t['id'] != null ? 'TCH-${t['id'].toString().padLeft(4, '0')}' : '—');
                  final name = t['name'] ?? 'Teacher';
                  final father = t['father_name'] ?? '—';
                  final phone = t['phone'] ?? '—';

                  return pw.Container(
                    width: 250,
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.black, width: 1.5),
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(10)),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                      children: [
                        // Card Header
                        pw.Container(
                          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: const pw.BoxDecoration(
                            color: PdfColors.teal800,
                            borderRadius: pw.BorderRadius.vertical(top: pw.Radius.circular(8)),
                          ),
                          child: pw.Row(
                            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                            children: [
                              pw.Text(_schoolName, style: pw.TextStyle(color: PdfColors.amber, fontWeight: pw.FontWeight.bold, fontSize: 9)),
                              pw.Text(_academicYearName, style: const pw.TextStyle(color: PdfColors.amber, fontSize: 8)),
                            ],
                          ),
                        ),
                        // Card Body
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(10),
                          child: pw.Row(
                            children: [
                              pw.Container(
                                width: 50,
                                height: 60,
                                decoration: pw.BoxDecoration(
                                  border: pw.Border.all(color: PdfColors.grey),
                                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                                ),
                                alignment: pw.Alignment.center,
                                child: pw.Text('PHOTO', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey)),
                              ),
                              pw.SizedBox(width: 10),
                              pw.Expanded(
                                child: pw.Column(
                                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                                  children: [
                                    pw.Text(name.toString().toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                                    pw.SizedBox(height: 2),
                                    pw.Text('Father: $father', style: const pw.TextStyle(fontSize: 8)),
                                    pw.Text('Emp ID: $empId', style: const pw.TextStyle(fontSize: 8)),
                                    pw.Text('Phone: $phone', style: const pw.TextStyle(fontSize: 8)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ];
          },
        ),
      );

      final pdfBytes = await pdf.save();

      // Save via native method channel
      const platform = MethodChannel('com.shikshapilot.app/media');
      final fileName = widget.singleTeacherId != null
          ? 'Teacher_ID_Card_${widget.singleTeacherId}.pdf'
          : 'Teacher_Identity_Cards.pdf';

      final result = await platform.invokeMethod('saveFileToDownloads', {
        'bytes': pdfBytes,
        'fileName': fileName,
      });

      if (mounted) {
        setState(() => _isGeneratingPdf = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result != null ? 'Teacher ID Card saved to Downloads folder!' : 'PDF Generated.'),
            action: SnackBarAction(
              label: 'PRINT / SHARE',
              textColor: Colors.amber,
              onPressed: () {
                Printing.layoutPdf(onLayout: (_) => pdfBytes);
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isGeneratingPdf = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate PDF: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final teachers = _targetTeachers;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Teacher Identity Cards',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          IconButton(
            tooltip: 'Print / Share',
            icon: const Icon(Icons.print_rounded, color: Color(0xFF0F172A)),
            onPressed: () async {
              _handleDownloadPdf();
            },
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: ElevatedButton.icon(
          onPressed: _isGeneratingPdf ? null : _handleDownloadPdf,
          icon: _isGeneratingPdf
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.download_rounded, color: Colors.white),
          label: Text(
            _isGeneratingPdf ? 'Generating PDF...' : 'Download PDF',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF059669),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      body: teachers.isEmpty
          ? const Center(child: Text('No active teachers found.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: teachers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, idx) {
                final t = teachers[idx];
                return _buildIdCardWidget(t);
              },
            ),
    );
  }

  Widget _buildIdCardWidget(Map<String, dynamic> t) {
    final empId = t['employee_id'] ?? (t['id'] != null ? 'TCH-${t['id'].toString().padLeft(4, '0')}' : '—');
    final name = (t['name'] ?? 'Teacher').toString();
    final father = (t['father_name'] ?? '—').toString();
    final phone = (t['phone'] ?? '—').toString();
    final photoPath = (t['photo_path'] ?? '').toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF065F46), Color(0xFF0D9488)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _schoolName.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFFDE68A),
                      ),
                    ),
                    const Text(
                      'TEACHER IDENTITY CARD',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                        color: Color(0xFFCCFBF1),
                      ),
                    ),
                  ],
                ),
                Text(
                  _academicYearName,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFFDE68A),
                  ),
                ),
              ],
            ),
          ),

          // Body
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Photo
                Container(
                  width: 76,
                  height: 92,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: photoPath.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: widget.teacherService.baseUrl.startsWith('http')
                              ? '${widget.teacherService.baseUrl}/$photoPath'
                              : photoPath,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => const Icon(Icons.person, size: 36, color: Color(0xFF94A3B8)),
                        )
                      : const Icon(Icons.person, size: 36, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(width: 14),

                // Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text('Father: $father', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                      Text('Emp ID: $empId', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      Text('Mobile: $phone', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                      const SizedBox(height: 6),
                      // Mini QR Code
                      Row(
                        children: [
                          SizedBox(
                            width: 38,
                            height: 38,
                            child: QrImageView(
                              data: 'STAFF:$empId:$name:$phone',
                              version: QrVersions.auto,
                              size: 38,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'OFFICIAL\nID BADGE',
                            style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

