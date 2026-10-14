import 'package:flutter/material.dart';
import 'package:school_hub/services/staff_salary_service.dart';
import 'package:school_hub/screens/teacher_salary_profile_screen.dart';

class TeacherSalaryDisbursementScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const TeacherSalaryDisbursementScreen({
    super.key,
    required this.baseUrl,
    required this.token,
  });

  @override
  State<TeacherSalaryDisbursementScreen> createState() => _TeacherSalaryDisbursementScreenState();
}

class _TeacherSalaryDisbursementScreenState extends State<TeacherSalaryDisbursementScreen> {
  late StaffSalaryService _salaryService;
  bool _isLoading = true;
  String _errorMessage = '';

  static const List<String> _academicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  late String _selectedMonth;
  String _academicYearName = '2026–2027';
  String? _academicYearStartDate;

  List<Map<String, dynamic>> _teachersList = [];
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _monthScrollController = ScrollController();
  final Map<String, GlobalKey> _monthKeys = {};
  String _searchQuery = '';
  String _statusFilter = 'ALL'; // 'ALL', 'PENDING', 'PAID'

  @override
  void initState() {
    super.initState();
    for (final m in _academicMonths) {
      _monthKeys[m] = GlobalKey();
    }
    _salaryService = StaffSalaryService(baseUrl: widget.baseUrl, token: widget.token);
    _selectedMonth = _getInitialMonth();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim();
      });
    });
    _loadInitialData();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToMonth(_selectedMonth, animate: false);
      Future.delayed(const Duration(milliseconds: 150), () {
        if (mounted) _scrollToMonth(_selectedMonth, animate: true);
      });
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted) _scrollToMonth(_selectedMonth, animate: true);
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _monthScrollController.dispose();
    super.dispose();
  }

  void _scrollToMonth(String month, {bool animate = true}) {
    final key = _monthKeys[month];
    final currentContext = key?.currentContext;
    if (currentContext != null) {
      Scrollable.ensureVisible(
        currentContext,
        duration: animate ? const Duration(milliseconds: 300) : Duration.zero,
        curve: Curves.easeOutCubic,
        alignment: 0.5,
      );
    } else if (_monthScrollController.hasClients) {
      final idx = _academicMonths.indexOf(month);
      if (idx != -1) {
        const monthApproxWidths = [67.0, 60.0, 64.0, 62.0, 80.0, 107.0, 85.0, 95.0, 95.0, 85.0, 90.0, 75.0];
        double cumulativeOffset = 0.0;
        for (int i = 0; i < idx && i < monthApproxWidths.length; i++) {
          cumulativeOffset += monthApproxWidths[i] + 8.0;
        }
        final currentWidth = idx < monthApproxWidths.length ? monthApproxWidths[idx] : 80.0;
        final screenWidth = MediaQuery.of(context).size.width;
        final centerTarget = (cumulativeOffset + (currentWidth / 2)) - (screenWidth / 2);
        final target = centerTarget.clamp(0.0, _monthScrollController.position.maxScrollExtent);
        if (animate) {
          _monthScrollController.animateTo(
            target,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutCubic,
          );
        } else {
          _monthScrollController.jumpTo(target);
        }
      }
    }
  }

  String _getInitialMonth() {
    final now = DateTime.now();
    const allMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final monthName = allMonths[now.month - 1];
    if (_academicMonths.contains(monthName)) {
      return monthName;
    }
    return 'April';
  }

  String _formatCurrency(num amount) {
    return amount.round().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final years = await _salaryService.getAcademicYears();
      final current = years.firstWhere(
        (y) => y['is_current'] == 1 || y['is_current'] == true || y['is_current'] == '1',
        orElse: () => years.isNotEmpty ? years.first : {},
      );
      if (current.isNotEmpty) {
        _academicYearName = current['name']?.toString() ?? _academicYearName;
        _academicYearStartDate = current['start_date']?.toString();
      }

      await _fetchMonthPayments(_selectedMonth);
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _fetchMonthPayments(String month) async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final list = await _salaryService.getStaffPayments(month);
      if (mounted) {
        setState(() {
          _teachersList = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  void _onMonthChanged(String newMonth) {
    if (_selectedMonth == newMonth) return;
    setState(() {
      _selectedMonth = newMonth;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToMonth(newMonth, animate: true);
    });
    _fetchMonthPayments(newMonth);
  }

  void _navigateToTeacherProfile(int staffId, String? teacherName) async {
    final updated = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TeacherProfileSalaryScreen(
          baseUrl: widget.baseUrl,
          token: widget.token,
          staffId: staffId,
          initialTeacherName: teacherName,
          academicYearName: _academicYearName,
          academicYearStartDate: _academicYearStartDate,
        ),
      ),
    );

    if (updated == true || mounted) {
      _fetchMonthPayments(_selectedMonth);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Computations exactly matching web
    final totalSalary = _teachersList.fold<double>(
      0.0,
      (sum, t) => sum + (double.tryParse((t['payable_salary'] ?? 0).toString()) ?? 0.0),
    );

    final disbursedSalary = _teachersList
        .where((t) => (t['status'] ?? '').toString().toLowerCase() == 'paid')
        .fold<double>(
          0.0,
          (sum, t) => sum + (double.tryParse((t['payable_salary'] ?? 0).toString()) ?? 0.0),
        );

    final pendingSalary = totalSalary - disbursedSalary;

    // Filter by search & status
    final filteredList = _teachersList.where((t) {
      final name = (t['name'] ?? '').toString().toLowerCase();
      final desig = (t['designation'] ?? '').toString().toLowerCase();
      final query = _searchQuery.toLowerCase();
      final matchesQuery = query.isEmpty || name.contains(query) || desig.contains(query);

      final status = (t['status'] ?? '').toString().toUpperCase();
      final matchesStatus = _statusFilter == 'ALL' ||
          (_statusFilter == 'PAID' && status == 'PAID') ||
          (_statusFilter == 'PENDING' && status != 'PAID');

      return matchesQuery && matchesStatus;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            'TEACHER SALARY DISBURSEMENT',
            style: TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.bold,
              fontSize: 16.5,
              letterSpacing: 0.2,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            onPressed: () => _fetchMonthPayments(_selectedMonth),
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Month Selector Dropdown / Bar
          _buildMonthSelectorHeader(),

          // Main scrollable area
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _fetchMonthPayments(_selectedMonth),
              color: const Color(0xFF0D9488),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 2. Summary Cards (Total, Disbursed, Pending)
                    _buildSummaryCards(totalSalary, disbursedSalary, pendingSalary),

                    const SizedBox(height: 16),

                    // 3. Search and Filter Bar
                    _buildSearchAndFilterBar(filteredList.length),

                    const SizedBox(height: 12),

                    // 4. Staff Payroll List
                    if (_isLoading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 60),
                        child: Center(
                          child: CircularProgressIndicator(color: Color(0xFF0D9488)),
                        ),
                      )
                    else if (_errorMessage.isNotEmpty)
                      _buildErrorState()
                    else if (filteredList.isEmpty)
                      _buildEmptyState()
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: filteredList.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final teacher = filteredList[index];
                          return _buildTeacherCard(teacher);
                        },
                      ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthSelectorHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: SizedBox(
        height: 38,
        child: ListView.separated(
          controller: _monthScrollController,
          scrollDirection: Axis.horizontal,
          itemCount: _academicMonths.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, idx) {
            final month = _academicMonths[idx];
            final isSelected = month == _selectedMonth;
            return GestureDetector(
              key: _monthKeys[month],
              onTap: () => _onMonthChanged(month),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0D9488) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF0D9488) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Center(
                  child: Text(
                    month,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.white : const Color(0xFF475569),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildSummaryCards(double total, double disbursed, double pending) {
    return Row(
      children: [
        // 1. Total Salary
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text(
                      'TOTAL',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Icon(Icons.account_balance_outlined, size: 16, color: Color(0xFF64748B)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '₹${_formatCurrency(total)}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),

        // 2. Salary Disbursed
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text(
                      'DISBURSED',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF16A34A),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Icon(Icons.check_circle_outline, size: 16, color: Color(0xFF16A34A)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '₹${_formatCurrency(disbursed)}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),

        // 3. Salary Pending
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text(
                      'PENDING',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFD97706),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Icon(Icons.access_time_rounded, size: 16, color: Color(0xFFD97706)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '₹${_formatCurrency(pending)}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFD97706),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSearchAndFilterBar(int resultCount) {
    return Column(
      children: [
        // Search Input
        Container(
          height: 44,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              const Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                  decoration: const InputDecoration(
                    hintText: 'Search teacher name or role...',
                    hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              if (_searchQuery.isNotEmpty)
                GestureDetector(
                  onTap: () {
                    _searchController.clear();
                  },
                  child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                ),
            ],
          ),
        ),

        const SizedBox(height: 10),

        // Filter Pills: All, Pending, Paid
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                _buildFilterChip('ALL', 'All'),
                const SizedBox(width: 6),
                _buildFilterChip('PENDING', 'Pending'),
                const SizedBox(width: 6),
                _buildFilterChip('PAID', 'Paid'),
              ],
            ),
            Text(
              '$resultCount Staff',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _statusFilter == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _statusFilter = value;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildTeacherCard(Map<String, dynamic> teacher) {
    final staffId = int.tryParse(teacher['id'].toString()) ?? 0;
    final name = teacher['name']?.toString() ?? 'Teacher';
    final status = (teacher['status'] ?? '').toString();
    final isPaid = status.toLowerCase() == 'paid';
    final date = teacher['date']?.toString() ?? '—';
    final payableSalary = double.tryParse((teacher['payable_salary'] ?? 0).toString()) ?? 0.0;
    final isProrated = teacher['proration_details'] != null;
    final photo = teacher['photo_path']?.toString() ?? '';

    final initials = name.split(' ').where((s) => s.isNotEmpty).map((s) => s[0]).take(2).join('').toUpperCase();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPaid ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          // Top Row: Avatar + Name (no subjects below name) + Status Badge
          Row(
            children: [
              // Avatar
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                clipBehavior: Clip.antiAlias,
                child: photo.isNotEmpty
                    ? Image.network(
                        photo.startsWith('http') ? photo : '${widget.baseUrl}$photo',
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(
                          child: Text(
                            initials.isNotEmpty ? initials : '??',
                            style: const TextStyle(
                              color: Color(0xFF475569),
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          initials.isNotEmpty ? initials : '??',
                          style: const TextStyle(
                            color: Color(0xFF475569),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 12),

              // Name (Clean, prominent, no subjects)
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),

              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isPaid ? const Color(0xFFBBF7D0) : const Color(0xFFFDE68A),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPaid ? Icons.check_circle_rounded : Icons.access_time_rounded,
                      size: 12,
                      color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isPaid ? 'Paid' : 'Pending',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Bottom Row: Salary Amount on Left, Disburse Button on Right
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Salary Amount (Aligned to Left)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SALARY AMOUNT',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF94A3B8),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        '₹${_formatCurrency(payableSalary)}',
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      if (isProrated) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: const Text(
                            'Prorated',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),

              // Payment Date (if paid)
              if (isPaid && date != '—')
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PAYMENT DATE',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      date,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ],
                ),

              // Disburse Button on Right (Clickable, navigates to Teacher Detail page)
              if (!isPaid)
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                  onPressed: () => _navigateToTeacherProfile(staffId, name),
                  child: const Text(
                    'Disburse',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                )
              else
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0D9488),
                    side: const BorderSide(color: Color(0xFF0D9488)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  ),
                  onPressed: () => _navigateToTeacherProfile(staffId, name),
                  child: const Text(
                    'View Cards',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: const [
            Icon(Icons.people_outline_rounded, size: 48, color: Color(0xFFCBD5E1)),
            SizedBox(height: 12),
            Text(
              'No active teachers found matching criteria.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(
              _errorMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => _fetchMonthPayments(_selectedMonth),
              child: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
