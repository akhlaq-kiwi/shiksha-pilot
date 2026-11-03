import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:school_hub/services/http_service.dart' as http_service;
import 'package:school_hub/services/leave_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'principal_tar_settings_screen.dart';

class PrincipalTarScreen extends StatefulWidget {
  final LeaveService leaveService;

  const PrincipalTarScreen({
    Key? key,
    required this.leaveService,
  }) : super(key: key);

  @override
  State<PrincipalTarScreen> createState() => _PrincipalTarScreenState();
}

class _PrincipalTarScreenState extends State<PrincipalTarScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // ---------------------------------------------------------------------------
  // Daily Attendance State
  // ---------------------------------------------------------------------------
  DateTime _selectedDate = DateTime.now();
  bool _isLoadingDaily = false;
  Map<String, dynamic>? _dailyData;

  // ---------------------------------------------------------------------------
  // Monthly Report State
  // ---------------------------------------------------------------------------
  int _reportMonth = DateTime.now().month;
  bool _isLoadingReport = false;
  List<dynamic> _reportRecords = [];
  String _reportSearchQuery = '';

  static const List<Map<String, dynamic>> _kMonths = [
    {'value': 4, 'name': 'April'},
    {'value': 5, 'name': 'May'},
    {'value': 6, 'name': 'June'},
    {'value': 7, 'name': 'July'},
    {'value': 8, 'name': 'August'},
    {'value': 9, 'name': 'September'},
    {'value': 10, 'name': 'October'},
    {'value': 11, 'name': 'November'},
    {'value': 12, 'name': 'December'},
    {'value': 1, 'name': 'January'},
    {'value': 2, 'name': 'February'},
    {'value': 3, 'name': 'March'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        if (_tabController.index == 0 && _dailyData == null) {
          _fetchDailyAttendance();
        } else if (_tabController.index == 1 && _reportRecords.isEmpty) {
          _fetchMonthlyReport();
        }
      }
    });

    _fetchDailyAttendance();
    _fetchMonthlyReport();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) {
    final year = d.year.toString().padLeft(4, '0');
    final month = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  String _formatDisplayDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  // ---------------------------------------------------------------------------
  // Daily Attendance API
  // ---------------------------------------------------------------------------
  Future<void> _fetchDailyAttendance() async {
    setState(() => _isLoadingDaily = true);
    final dateStr = _formatDate(_selectedDate);
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance?date=$dateStr');

    try {
      final res = await http_service.get(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200) {
        final decoded = json.decode(res.body);
        final data = decoded['data'] ?? decoded;
        setState(() {
          _dailyData = data;
        });
      } else {
        _showSnackBar('Failed to load attendance (${res.statusCode})', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error loading attendance: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoadingDaily = false);
    }
  }

  // ---------------------------------------------------------------------------
  // Monthly Report API
  // ---------------------------------------------------------------------------
  Future<void> _fetchMonthlyReport() async {
    setState(() => _isLoadingReport = true);
    final url = Uri.parse(
      '${widget.leaveService.baseUrl}/api/school/teacher-attendance/report?month=$_reportMonth',
    );

    try {
      final res = await http_service.get(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200) {
        final decoded = json.decode(res.body);
        final data = decoded['data'] ?? decoded;
        final recs = (data['records'] as List<dynamic>?) ?? (data['teachers'] as List<dynamic>?) ?? [];
        setState(() {
          _reportRecords = recs;
        });
      } else {
        _showSnackBar('Failed to load monthly report (${res.statusCode})', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error loading monthly report: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoadingReport = false);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF0F766E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Build Methods
  // ---------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F2), // warm elegant canvas matching web portal
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Padding(
          padding: EdgeInsets.only(top: 4.0),
          child: Text(
            'TEACHERS ATTENDANCE REPORT',
            style: TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 0.6,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF1E293B), size: 22),
            tooltip: 'Settings & QR Code',
            onPressed: () async {
              final updated = await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => PrincipalTarSettingsScreen(leaveService: widget.leaveService),
                ),
              );
              if (updated == true) {
                _fetchDailyAttendance();
              }
            },
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
            ),
            child: TabBar(
              controller: _tabController,
              splashFactory: NoSplash.splashFactory,
              overlayColor: const WidgetStatePropertyAll(Colors.transparent),
              labelColor: const Color(0xFF0F766E),
              unselectedLabelColor: const Color(0xFF64748B),
              indicatorColor: const Color(0xFF0F766E),
              indicatorWeight: 3,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              tabs: const [
                Tab(
                  icon: Icon(Icons.calendar_today_rounded, size: 16),
                  text: 'Daily Attendance',
                ),
                Tab(
                  icon: Icon(Icons.groups_rounded, size: 18),
                  text: 'Monthly Report',
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDailyAttendanceTab(),
          _buildMonthlyReportTab(),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 1: DAILY ATTENDANCE (VIEW-ONLY OVERSIGHT)
  // ===========================================================================
  Widget _buildDailyAttendanceTab() {
    if (_isLoadingDaily && _dailyData == null) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)));
    }

    final records = (_dailyData?['records'] as List<dynamic>?) ?? [];
    final bool isSunday = _dailyData?['is_sunday'] == true;
    final bool isHoliday = _dailyData?['is_holiday'] == true;
    final bool isDisabled = _dailyData?['is_disabled'] == true || isSunday || isHoliday;
    final String? disabledReason = _dailyData?['disabled_reason'];

    int presentCount = 0;
    int absentCount = 0;
    int leaveCount = 0;
    int lateCount = 0;

    for (final r in records) {
      final st = (r['status'] as String?) ?? 'Absent';
      if (st == 'Present') {
        presentCount++;
        final isLate = r['is_late'] == true;
        final lateText = r['late_text'] as String?;
        if (isLate || (lateText != null && lateText.isNotEmpty)) {
          lateCount++;
        }
      } else if (st == 'Absent') {
        absentCount++;
      } else if (st == 'Leave') {
        leaveCount++;
      }
    }

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: _fetchDailyAttendance,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          // Date navigation selector bar
          _buildDateSelectorBar(),
          const SizedBox(height: 12),

          // Sunday / Holiday banner
          if (isDisabled)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: Colors.amber.shade800, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      disabledReason ?? (isSunday ? 'Sunday • Regular holiday' : 'Official School Holiday'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // Stats Counters Bar: Present, Absent, Leave, Late (Total removed, Late on far right)
          _buildDailyCounters(presentCount, absentCount, leaveCount, lateCount),
          const SizedBox(height: 14),

          // Section Title
          Text(
            'STAFF MEMBERS (${records.length})',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: Color(0xFF64748B),
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 8),

          // Teachers Cards
          if (records.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              alignment: Alignment.center,
              child: const Text('No teacher staff records found for this date.', style: TextStyle(color: Colors.grey)),
            )
          else
            ...records.map((r) => _buildTeacherDailyCard(r)),
        ],
      ),
    );
  }

  Widget _buildDateSelectorBar() {
    final isToday = _formatDate(_selectedDate) == _formatDate(DateTime.now());

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, size: 24, color: Color(0xFF1E293B)),
            splashRadius: 20,
            onPressed: () {
              setState(() {
                _selectedDate = _selectedDate.subtract(const Duration(days: 1));
              });
              _fetchDailyAttendance();
            },
          ),
          InkWell(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
                builder: (context, child) {
                  return Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: const ColorScheme.light(
                        primary: Color(0xFF0F766E),
                        onPrimary: Colors.white,
                      ),
                    ),
                    child: child!,
                  );
                },
              );
              if (picked != null) {
                setState(() => _selectedDate = picked);
                _fetchDailyAttendance();
              }
            },
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              child: Row(
                children: [
                  const Icon(Icons.calendar_month_rounded, size: 18, color: Color(0xFF0F766E)),
                  const SizedBox(width: 8),
                  Text(
                    _formatDisplayDate(_selectedDate),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Row(
            children: [
              if (!isToday)
                TextButton(
                  onPressed: () {
                    setState(() => _selectedDate = DateTime.now());
                    _fetchDailyAttendance();
                  },
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Today', style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              IconButton(
                icon: const Icon(Icons.chevron_right_rounded, size: 24, color: Color(0xFF1E293B)),
                splashRadius: 20,
                onPressed: () {
                  setState(() {
                    _selectedDate = _selectedDate.add(const Duration(days: 1));
                  });
                  _fetchDailyAttendance();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDailyCounters(int present, int absent, int leave, int late) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniStat('Present', '$present', const Color(0xFF16A34A)),
          _buildMiniStat('Absent', '$absent', const Color(0xFFDC2626)),
          _buildMiniStat('Leave', '$leave', const Color(0xFFD97706)),
          _buildMiniStat('Late', '$late', const Color(0xFFEA580C)),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String count, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Teacher Daily Card (Read-Only Status, Timing, Early & Late Indicator)
  // ---------------------------------------------------------------------------
  Widget _buildTeacherDailyCard(dynamic r) {
    final staffId = r['staff_id'] as int;
    final name = (r['name'] as String?) ?? 'Teacher';
    final empId = (r['emp_id'] as String?) ?? 'EMP-$staffId';
    final photo = (r['photo_path'] as String?) ?? '';
    final status = (r['status'] as String?) ?? 'Absent';
    final entryTime = (r['entry_time'] as String?) ?? '—';
    final isLate = r['is_late'] == true;
    final lateText = (r['late_text'] as String?) ?? (isLate ? 'Late' : null);
    final isEarly = r['is_early'] == true;
    final earlyText = (r['early_text'] as String?) ?? (isEarly ? 'Early' : null);

    Color statusColor;
    Color statusBgColor;
    IconData statusIcon;

    if (status == 'Present') {
      statusColor = const Color(0xFF16A34A);
      statusBgColor = const Color(0xFFDCFCE7);
      statusIcon = Icons.check_circle_rounded;
    } else if (status == 'Leave') {
      statusColor = const Color(0xFFD97706);
      statusBgColor = const Color(0xFFFEF3C7);
      statusIcon = Icons.event_busy_rounded;
    } else if (status == 'Sunday' || status == 'Holiday') {
      statusColor = const Color(0xFF64748B);
      statusBgColor = const Color(0xFFF1F5F9);
      statusIcon = Icons.beach_access_rounded;
    } else {
      statusColor = const Color(0xFFDC2626);
      statusBgColor = const Color(0xFFFEE2E2);
      statusIcon = Icons.cancel_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == 'Present'
              ? const Color(0xFFE2E8F0)
              : (status == 'Absent' ? Colors.red.shade100 : Colors.amber.shade100),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                // Avatar
                CircleAvatar(
                  radius: 22,
                  backgroundColor: const Color(0xFFF1F5F9),
                  backgroundImage: photo.isNotEmpty
                      ? CachedNetworkImageProvider(
                          photo.startsWith('http') ? photo : '${widget.leaveService.baseUrl}$photo',
                        )
                      : null,
                  child: photo.isEmpty
                      ? Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'T',
                          style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF0F766E), fontSize: 16),
                        )
                      : null,
                ),
                const SizedBox(width: 12),

                // Name & EMP ID (Subjects removed per request, increased name font size)
                Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            color: Color(0xFF0F172A),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          empId,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Status & Timing Details Row (Replaces the marking buttons)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Status Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusBgColor,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: statusColor),
                        const SizedBox(width: 5),
                        Text(
                          status,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Timing and Early/Late details
                  if (status == 'Present') ...[
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (entryTime != '—') ...[
                          const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Text(
                            entryTime,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        if (isLate || lateText != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.warning_amber_rounded, size: 11, color: Colors.red.shade700),
                                const SizedBox(width: 3),
                                Text(
                                  lateText ?? 'Late',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.red.shade700,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (isEarly || earlyText != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.green.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.schedule_rounded, size: 11, color: Colors.green.shade700),
                                const SizedBox(width: 3),
                                Text(
                                  earlyText ?? 'Early',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.green.shade700,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.teal.shade50,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.teal.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_rounded, size: 11, color: Colors.teal.shade700),
                                const SizedBox(width: 3),
                                Text(
                                  'On Time',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.teal.shade700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ] else ...[
                    Text(
                      status == 'Leave' ? 'On Approved Leave' : (status == 'Sunday' || status == 'Holiday' ? 'Holiday' : 'Absent today'),
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 2: MONTHLY REPORT
  // ===========================================================================
  Widget _buildMonthlyReportTab() {
    if (_isLoadingReport && _reportRecords.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)));
    }

    final filtered = _reportRecords.where((r) {
      if (_reportSearchQuery.trim().isEmpty) return true;
      final q = _reportSearchQuery.toLowerCase().trim();
      final name = (r['name'] as String? ?? '').toLowerCase();
      final empId = (r['emp_id'] as String? ?? '').toLowerCase();
      return name.contains(q) || empId.contains(q);
    }).toList();

    final selectedMonthObj = _kMonths.firstWhere(
      (m) => m['value'] == _reportMonth,
      orElse: () => {'name': 'Month'},
    );

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: _fetchMonthlyReport,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 30),
        children: [
          // Month & Year Selector Header Bar (matches Screenshot 2)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'ATTENDANCE REPORT FOR ${selectedMonthObj['name'].toString().toUpperCase()}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Month Dropdown with curved floating menu
                    Builder(
                      builder: (btnContext) {
                        final selectedMonthName = selectedMonthObj['name'] as String? ?? 'Month';
                        return InkWell(
                          onTap: () async {
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

                            final selected = await showMenu<int>(
                              context: context,
                              position: position,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              color: Colors.white,
                              elevation: 6,
                              constraints: BoxConstraints(
                                minWidth: size.width < 140 ? 140 : size.width,
                                maxWidth: size.width < 160 ? 160 : size.width,
                                maxHeight: 320,
                              ),
                              items: _kMonths.map((m) {
                                final isSelected = m['value'] == _reportMonth;
                                return PopupMenuItem<int>(
                                  value: m['value'] as int,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  child: Text(
                                    m['name'] as String,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                      color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF1E293B),
                                    ),
                                  ),
                                );
                              }).toList(),
                            );

                            if (selected != null) {
                              setState(() => _reportMonth = selected);
                              _fetchMonthlyReport();
                            }
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  selectedMonthName,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.arrow_drop_down, color: Color(0xFF0F766E), size: 18),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Search field
                TextField(
                  onChanged: (val) => setState(() => _reportSearchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search teacher or EMP ID...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF64748B)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Cards List
          if (filtered.isEmpty)
            Container(
              padding: const EdgeInsets.all(36),
              alignment: Alignment.center,
              child: const Text('No attendance records found for this period.', style: TextStyle(color: Colors.grey)),
            )
          else
            ...filtered.map((r) => _buildMonthlyTeacherCard(r)),
        ],
      ),
    );
  }

  Widget _buildMonthlyTeacherCard(dynamic r) {
    final staffId = r['staff_id'];
    final name = (r['name'] as String?) ?? 'Teacher';
    final empId = (r['emp_id'] as String?) ?? 'EMP-$staffId';
    final totalWorkingDays = r['total_working_days'] ?? 0;
    final present = r['present_days'] ?? 0;
    final absent = r['absent_days'] ?? 0;
    final leave = r['leave_days'] ?? 0;
    final late = r['late_days'] ?? 0;
    final attPercentage = r['attendance_percentage'] ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => _showTeacherMonthlyBreakdown(r),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top line: EMP ID and Name
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          empId,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  // Attendance %
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: attPercentage >= 75
                          ? Colors.green.shade50
                          : (attPercentage >= 50 ? Colors.amber.shade50 : Colors.red.shade50),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$attPercentage%',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: attPercentage >= 75
                            ? Colors.green.shade700
                            : (attPercentage >= 50 ? Colors.amber.shade800 : Colors.red.shade700),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Breakdown numbers matching table columns:
              // TOTAL WORKING DAYS | PRESENT | ABSENT | LEAVE | LATE DAYS
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF8F2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTableStat('Working', '$totalWorkingDays', Colors.blueGrey),
                    _buildTableStat('Present', '$present', const Color(0xFF16A34A)),
                    _buildTableStat('Absent', '$absent', const Color(0xFFDC2626)),
                    _buildTableStat('Leave', '$leave', const Color(0xFFD97706)),
                    _buildTableStat('Late', '$late', Colors.deepOrange),
                  ],
                ),
              ),

              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: const [
                  Text(
                    'Tap to view date breakdown',
                    style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF94A3B8)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTableStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Date Breakdown Bottom Sheet (Without 4 top boxes, with 4 tabs including Late Days)
  // ---------------------------------------------------------------------------
  final Set<String> _markingDates = {};

  void _showTeacherMonthlyBreakdown(dynamic teacher) {
    final name = teacher['name'] ?? 'Teacher';
    final empId = teacher['emp_id'] ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final presentDates = (teacher['present_dates'] as List<dynamic>?) ?? [];
            final absentDates = (teacher['absent_dates'] as List<dynamic>?) ?? [];
            final leaveDates = (teacher['leave_dates'] as List<dynamic>?) ?? [];
            final lateDates = (teacher['late_dates'] as List<dynamic>?) ?? [];

            return Container(
              height: MediaQuery.of(context).size.height * 0.78,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // Sheet handle
                  Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 6),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  // Sheet Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$empId • Attendance Breakdown',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF64748B),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),

                  // 4 Tabs: Present, Absent, Leave, Late Days
                  Expanded(
                    child: DefaultTabController(
                      length: 4,
                      child: Column(
                        children: [
                          Container(
                            color: Colors.white,
                            child: TabBar(
                              splashFactory: NoSplash.splashFactory,
                              overlayColor: const WidgetStatePropertyAll(Colors.transparent),
                              labelColor: const Color(0xFF0F766E),
                              unselectedLabelColor: const Color(0xFF64748B),
                              indicatorColor: const Color(0xFF0F766E),
                              labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                              labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                              tabs: [
                                Tab(text: 'Present (${presentDates.length})'),
                                Tab(text: 'Absent (${absentDates.length})'),
                                Tab(text: 'Leave (${leaveDates.length})'),
                                Tab(text: 'Late Days (${lateDates.length})'),
                              ],
                            ),
                          ),
                          const Divider(height: 1),
                          Expanded(
                            child: Container(
                              color: const Color(0xFFF8FAFC),
                              child: TabBarView(
                                children: [
                                  _buildDateList(
                                    presentDates,
                                    teacher,
                                    setSheetState,
                                    isPresentTab: true,
                                  ),
                                  _buildDateList(
                                    absentDates,
                                    teacher,
                                    setSheetState,
                                    isAbsentTab: true,
                                  ),
                                  _buildDateList(
                                    leaveDates,
                                    teacher,
                                    setSheetState,
                                    isLeaveTab: true,
                                  ),
                                  _buildDateList(
                                    lateDates,
                                    teacher,
                                    setSheetState,
                                    isLateTab: true,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
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

  void _showMarkPresentConfirmDialog(
    dynamic teacher,
    dynamic item,
    void Function(void Function()) setSheetState,
  ) {
    final staffName = teacher['name'] ?? 'Teacher';
    final dateStr = (item['date'] as String?) ?? '';
    final formattedDate = _formatBreakdownDate(dateStr);

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
                      Icons.how_to_reg_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Mark as Present?',
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
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF475569),
                    height: 1.45,
                  ),
                  children: [
                    const TextSpan(text: 'Are you sure you want to mark '),
                    TextSpan(
                      text: staffName,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const TextSpan(text: ' as Present on '),
                    TextSpan(
                      text: formattedDate,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    const TextSpan(text: '?'),
                  ],
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
                        'This will update the teacher\'s attendance record to Present (On Time) and recalculate the monthly report.',
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
                        onPressed: () {
                          Navigator.pop(ctx);
                          _executeMarkPresent(teacher, item, setSheetState);
                        },
                        child: const Text(
                          'Mark Present',
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
  }

  Future<void> _executeMarkPresent(
    dynamic teacher,
    dynamic item,
    void Function(void Function()) setSheetState,
  ) async {
    final staffId = teacher['staff_id'] ?? teacher['id'];
    final dateStr = (item['date'] as String?) ?? '';
    if (staffId == null || dateStr.isEmpty) return;

    setSheetState(() {
      _markingDates.add(dateStr);
    });

    final teacherName = teacher['staff_name'] ?? teacher['name'] ?? 'Teacher';
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance');
    try {
      final res = await http_service.post(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: json.encode({
          'date': dateStr,
          'records': [
            {
              'staff_id': staffId,
              'status': 'Present',
              'is_status_changed': true,
            }
          ],
        }),
      );

      if (res.statusCode == 200) {
        _showSnackBar('$teacherName marked as Present for $dateStr');

        final absentDates = (teacher['absent_dates'] as List<dynamic>?) ?? [];
        final presentDates = (teacher['present_dates'] as List<dynamic>?) ?? [];

        absentDates.removeWhere((x) => x['date'] == dateStr);
        presentDates.add({
          'date': dateStr,
          'status': 'Present',
          'entry_time': '08:30 AM',
          'official_entry_time': '08:30 AM',
          'diff_text': 'On Time',
          'is_late': false,
          'is_early': false,
        });

        presentDates.sort((a, b) => (a['date'] ?? '').toString().compareTo((b['date'] ?? '').toString()));

        final int currentPresent = int.tryParse(teacher['present_days']?.toString() ?? '0') ?? 0;
        final int currentAbsent = int.tryParse(teacher['absent_days']?.toString() ?? '0') ?? 0;
        final int totalWorking = int.tryParse(teacher['total_working_days']?.toString() ?? '0') ?? 0;

        teacher['present_days'] = currentPresent + 1;
        teacher['absent_days'] = (currentAbsent - 1).clamp(0, 999);
        if (totalWorking > 0) {
          teacher['attendance_percentage'] = double.parse(((teacher['present_days'] / totalWorking) * 100).toStringAsFixed(1));
        }

        setSheetState(() {});

        _fetchMonthlyReport();
        if (_dailyData != null) {
          _fetchDailyAttendance();
        }
      } else {
        String msg = 'Failed to mark attendance';
        try {
          final body = json.decode(res.body);
          msg = body['message'] ?? body['error'] ?? msg;
        } catch (_) {}
        _showSnackBar(msg, isError: true);
      }
    } catch (e) {
      _showSnackBar('Error marking attendance: $e', isError: true);
    } finally {
      setSheetState(() {
        _markingDates.remove(dateStr);
      });
    }
  }

  String _formatBreakdownDate(String dateStr) {
    try {
      final parsed = DateTime.parse(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final monthName = months[parsed.month - 1];
      final dayName = days[parsed.weekday - 1];
      return '${parsed.day} $monthName ${parsed.year} - $dayName';
    } catch (_) {
      return dateStr;
    }
  }

  String _getBreakdownDateOnly(String dateStr) {
    try {
      final parsed = DateTime.parse(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final monthName = months[parsed.month - 1];
      return '${parsed.day} $monthName ${parsed.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _getBreakdownDayOnly(String dateStr) {
    try {
      final parsed = DateTime.parse(dateStr);
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[parsed.weekday - 1];
    } catch (_) {
      return '';
    }
  }

  String? _calculateTimeDiff(String? entryTimeStr, {String? officialTimeStr, bool? isLate}) {
    if (entryTimeStr == null || entryTimeStr == '—' || entryTimeStr.isEmpty) {
      return isLate == true ? 'Late' : null;
    }
    try {
      final officialStr = (officialTimeStr != null && officialTimeStr.isNotEmpty) ? officialTimeStr : '08:30 AM';
      final entryMins = _parseTimeToMinutes(entryTimeStr);
      final officialMins = _parseTimeToMinutes(officialStr);
      if (entryMins == null || officialMins == null) {
        return isLate == true ? 'Late' : null;
      }
      if (entryMins > officialMins) {
        final diff = entryMins - officialMins;
        return '${diff}m Late';
      } else if (entryMins < officialMins) {
        final diff = officialMins - entryMins;
        return '${diff}m Early';
      } else {
        return 'On Time';
      }
    } catch (_) {
      return isLate == true ? 'Late' : null;
    }
  }

  int? _parseTimeToMinutes(String timeStr) {
    try {
      final clean = timeStr.trim().toUpperCase();
      final isPM = clean.contains('PM');
      final isAM = clean.contains('AM');
      final parts = clean.replaceAll('AM', '').replaceAll('PM', '').trim().split(':');
      if (parts.length >= 2) {
        int h = int.parse(parts[0].trim());
        final m = int.parse(parts[1].trim());
        if (isPM && h < 12) h += 12;
        if (isAM && h == 12) h = 0;
        return h * 60 + m;
      }
    } catch (_) {}
    return null;
  }

  String _formatMinutes(int minutes) {
    if (minutes <= 0) return '0 min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0 && m > 0) {
      return '$h hr $m min';
    } else if (h > 0) {
      return '$h hr';
    } else {
      return '$m min';
    }
  }

  Widget _buildEmptyTabState({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color iconColor,
    required Color iconBg,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: iconBg,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: iconColor),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateList(
    List<dynamic> items,
    dynamic teacher,
    void Function(void Function()) setSheetState, {
    bool isPresentTab = false,
    bool isAbsentTab = false,
    bool isLeaveTab = false,
    bool isLateTab = false,
  }) {
    if (items.isEmpty) {
      if (isPresentTab) {
        return _buildEmptyTabState(
          icon: Icons.event_available_rounded,
          title: 'No Present Records',
          subtitle: 'No attendance marked as present for this month.',
          iconColor: const Color(0xFF16A34A),
          iconBg: const Color(0xFFDCFCE7),
        );
      } else if (isAbsentTab) {
        return _buildEmptyTabState(
          icon: Icons.verified_rounded,
          title: 'Zero Absences!',
          subtitle: 'Great! All working days accounted for this teacher.',
          iconColor: const Color(0xFF16A34A),
          iconBg: const Color(0xFFDCFCE7),
        );
      } else if (isLeaveTab) {
        return _buildEmptyTabState(
          icon: Icons.event_note_rounded,
          title: 'No Leave Records',
          subtitle: 'No approved or recorded leaves for this month.',
          iconColor: const Color(0xFF64748B),
          iconBg: const Color(0xFFF1F5F9),
        );
      } else {
        return _buildEmptyTabState(
          icon: Icons.alarm_on_rounded,
          title: 'Punctual Every Day',
          subtitle: 'No late arrivals recorded this month.',
          iconColor: const Color(0xFF0F766E),
          iconBg: const Color(0xFFCCFBF1),
        );
      }
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      itemCount: items.length,
      itemBuilder: (context, i) {
        final it = items[i];
        final date = (it['date'] as String?) ?? '—';
        final entryTime = (it['entry_time'] as String?) ?? '—';
        final isLate = it['is_late'] == true;
        final bool isMarking = _markingDates.contains(date);

        final diffText = (it['diff_text'] ?? it['late_text'] ?? it['early_text'])?.toString() ??
            _calculateTimeDiff(
              entryTime,
              officialTimeStr: it['official_entry_time']?.toString(),
              isLate: isLate || isLateTab,
            );

        Color cardBorderColor = const Color(0xFFE2E8F0);
        Color iconBg = const Color(0xFFF0FDF4);
        Color iconBorder = const Color(0xFFDCFCE7);
        Color iconColor = const Color(0xFF16A34A);
        IconData cardIcon = Icons.check_circle_rounded;

        if (isAbsentTab) {
          cardBorderColor = const Color(0xFFFEE2E2);
          iconBg = const Color(0xFFFEF2F2);
          iconBorder = const Color(0xFFFECACA);
          iconColor = const Color(0xFFDC2626);
          cardIcon = Icons.event_busy_rounded;
        } else if (isLeaveTab) {
          cardBorderColor = const Color(0xFFFEF3C7);
          iconBg = const Color(0xFFFFFBEB);
          iconBorder = const Color(0xFFFDE68A);
          iconColor = const Color(0xFFD97706);
          cardIcon = Icons.beach_access_rounded;
        } else if (isLateTab) {
          cardBorderColor = const Color(0xFFFFEDD5);
          iconBg = const Color(0xFFFFF7ED);
          iconBorder = const Color(0xFFFED7AA);
          iconColor = const Color(0xFFEA580C);
          cardIcon = Icons.alarm_rounded;
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: cardBorderColor),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: iconBorder),
                ),
                child: Icon(cardIcon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getBreakdownDateOnly(date),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _getBreakdownDayOnly(date),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 11.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              if (isAbsentTab) ...[
                ElevatedButton.icon(
                  onPressed: isMarking
                      ? null
                      : () => _showMarkPresentConfirmDialog(teacher, it, setSheetState),
                  icon: isMarking
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.how_to_reg_rounded, size: 14, color: Colors.white),
                  label: Text(
                    isMarking ? 'Updating...' : 'Mark as present',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ] else if (isLeaveTab) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Text(
                    'On Leave',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFB45309),
                    ),
                  ),
                ),
              ] else ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (entryTime != '—' && entryTime.isNotEmpty) ...[
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.access_time_rounded, size: 11, color: Color(0xFF64748B)),
                          const SizedBox(width: 3),
                          Text(
                            entryTime,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                    ],
                    if (diffText != null && diffText.isNotEmpty)
                      Builder(
                        builder: (_) {
                          final bool isLateRecord = diffText.toLowerCase().contains('late') || isLate || isLateTab;
                          final bool isEarlyRecord = diffText.toLowerCase().contains('early');
                          final Color badgeBg = isLateRecord
                              ? const Color(0xFFFEF2F2)
                              : (isEarlyRecord ? const Color(0xFFF0FDF4) : const Color(0xFFF0FDFA));
                          final Color badgeBorder = isLateRecord
                              ? const Color(0xFFFECACA)
                              : (isEarlyRecord ? const Color(0xFFBBF7D0) : const Color(0xFF99F6E4));
                          final Color badgeText = isLateRecord
                              ? const Color(0xFFDC2626)
                              : (isEarlyRecord ? const Color(0xFF16A34A) : const Color(0xFF0F766E));

                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                            decoration: BoxDecoration(
                              color: badgeBg,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: badgeBorder),
                            ),
                            child: Text(
                              diffText,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: badgeText,
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
