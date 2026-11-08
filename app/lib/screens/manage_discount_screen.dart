import 'package:flutter/material.dart';
import '../services/fee_service.dart';

String formatFeeSummary(String? feeType, String? summary) {
  final raw = (summary ?? '').trim();
  if (raw.isEmpty) return 'Fee Discount';

  final isMonthly = (feeType ?? 'MONTHLY').toUpperCase() == 'MONTHLY';
  if (isMonthly) {
    var clean = raw;
    if (clean.toLowerCase().startsWith('tuition:')) {
      clean = clean.substring(8).trim();
    }
    final months = clean
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    if (months.length > 1) {
      return 'Tuition: ${months.first} to ${months.last}';
    } else if (months.length == 1) {
      return 'Tuition: ${months.first}';
    }
    return 'Tuition: $raw';
  } else {
    var clean = raw;
    if (clean.toLowerCase().startsWith('additional:')) {
      clean = clean.substring(11).trim();
    }
    return 'Additional: $clean';
  }
}

class ManageDiscountScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;

  const ManageDiscountScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
  }) : super(key: key);

  @override
  State<ManageDiscountScreen> createState() => _ManageDiscountScreenState();
}

class _ManageDiscountScreenState extends State<ManageDiscountScreen> {
  late FeeService _feeService;

  bool _isLoading = true;
  bool _isTogglingSetting = false;
  bool _discountApprovalRequired = false;

  List<dynamic> _requests = [];
  Map<String, dynamic> _summary = {
    'total': 0,
    'pending': 0,
    'approved': 0,
    'rejected': 0,
    'cancelled': 0,
  };

  String _selectedStatus = 'ALL';
  String _selectedPeriod = 'ALL TIME';
  String _selectedCollector = 'All Users';
  List<String> _availablePeriods = ['ALL TIME', 'SINCE LAST REPORT'];
  List<Map<String, dynamic>> _availableCollectors = [
    {'name': 'All Users', 'label': 'All Collectors'}
  ];

  @override
  void initState() {
    super.initState();
    _feeService = FeeService(baseUrl: widget.baseUrl, token: widget.token);
    _loadInitialData();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final reqBool = await _feeService.getDiscountApprovalRequired();
      if (mounted) {
        setState(() {
          _discountApprovalRequired = reqBool;
        });
      }
      await _fetchRequests();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showToast(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    }
  }

  Future<void> _fetchRequests() async {
    try {
      final data = await _feeService.getDiscountRequests(
        status: _selectedStatus,
        period: _selectedPeriod,
        requestedBy: _selectedCollector,
      );

      if (mounted) {
        setState(() {
          _requests = (data['requests'] as List<dynamic>?) ?? [];
          final periods = (data['available_periods'] as List<dynamic>?)?.map((p) => p.toString()).toList();
          if (periods != null && periods.isNotEmpty) {
            _availablePeriods = periods;
          }
          final cols = (data['available_collectors'] as List<dynamic>?)
              ?.map((c) => Map<String, dynamic>.from(c as Map))
              .toList();
          if (cols != null && cols.isNotEmpty) {
            _availableCollectors = cols;
          }
          if (data['summary'] is Map) {
            _summary = Map<String, dynamic>.from(data['summary']);
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showToast(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    }
  }

  Future<void> _handleToggleDiscountApproval(bool value) async {
    setState(() => _isTogglingSetting = true);
    try {
      final updated = await _feeService.updateDiscountSettings(value);
      if (mounted) {
        setState(() {
          _discountApprovalRequired = updated;
          _isTogglingSetting = false;
        });
        _showToast(
          updated
              ? 'Discount approval requirement enabled'
              : 'Discount approval requirement disabled',
          isError: false,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTogglingSetting = false);
        _showToast(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    }
  }

  Future<void> _handleApprove(int id, String studentName, double discountAmount) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Approve Discount',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
            ),
          ),
          content: Text(
            'Are you sure you want to approve the discount of ₹${discountAmount.round()} for $studentName? The fee payment will be committed into collection records immediately.',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel', style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Approve Fee'),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      await _feeService.approveDiscountRequest(id);
      _showToast('Discount approved and fee recorded successfully!', isError: false);
      await _fetchRequests();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showToast(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    }
  }

  Future<void> _handleReject(int id, String studentName) async {
    final reasonController = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return Dialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF7F1D1D).withValues(alpha: 0.3) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Reject Discount',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Are you sure you want to reject this discount request for $studentName? The fee will remain unpaid.',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                      width: 1.2,
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: TextField(
                    controller: reasonController,
                    minLines: 3,
                    maxLines: 6,
                    keyboardType: TextInputType.multiline,
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                    ),
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      hintText: 'Reason for rejection (Optional)...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          side: BorderSide(
                            color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1),
                          ),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text(
                          'Cancel',
                          style: TextStyle(
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text(
                          'Reject Request',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      await _feeService.rejectDiscountRequest(id, reason: reasonController.text.trim());
      _showToast('Discount request rejected.', isError: false);
      await _fetchRequests();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showToast(e.toString().replaceAll('Exception: ', ''), isError: true);
      }
    }
  }

  void _showToast(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFFD97706),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  String _formatDate(String isoStr) {
    if (isoStr.isEmpty) return '';
    try {
      final dt = DateTime.parse(isoStr).toLocal();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      final day = dt.day.toString().padLeft(2, '0');
      final month = months[dt.month - 1];
      final year = dt.year;
      final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$day $month $year, $hour:$min $ampm';
    } catch (_) {
      return isoStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final primaryText = isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A);
    final secondaryText = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: Text(
          'Manage Discount',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: primaryText,
            letterSpacing: 0.3,
          ),
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: primaryText),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _fetchRequests,
          ),
        ],
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: RefreshIndicator(
          color: const Color(0xFFD97706),
          onRefresh: _fetchRequests,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 1. Admin Approval Toggle Card
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Container(
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _discountApprovalRequired
                            ? const Color(0xFFD97706).withOpacity(0.4)
                            : borderColor,
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxSet.subtle(isDark),
                      ],
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _discountApprovalRequired
                                    ? const Color(0xFFFEF3C7)
                                    : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.percent_rounded,
                                color: _discountApprovalRequired
                                    ? const Color(0xFFD97706)
                                    : secondaryText,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Require Approval for Fee Discounts',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: primaryText,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _discountApprovalRequired
                                        ? 'Active - Fee collectors must obtain your approval'
                                        : 'Disabled - Collectors can apply discounts directly',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: _discountApprovalRequired
                                          ? const Color(0xFFD97706)
                                          : secondaryText,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (_isTogglingSetting)
                              const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)),
                                ),
                              )
                            else
                              Switch(
                                value: _discountApprovalRequired,
                                activeColor: const Color(0xFFD97706),
                                onChanged: _handleToggleDiscountApproval,
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: borderColor),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline_rounded, size: 16, color: secondaryText),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'When enabled, fee collectors must obtain your approval before applying any discount on fee deposits. Deposits with discounts remain pending and will not reflect in collections, history, or financial reports until approved.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    height: 1.4,
                                    color: secondaryText,
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 2. Filter Dropdowns Row (Request By, Status, Filter Period)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          // 1. REQUEST BY Filter Pill
                          Expanded(
                            flex: 11,
                            child: InkWell(
                              onTap: () => _showCollectorSelector(context, isDark),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                height: 38,
                                padding: const EdgeInsets.symmetric(horizontal: 7),
                                decoration: BoxDecoration(
                                  color: _selectedCollector != 'All Users'
                                      ? (isDark ? const Color(0xFF78350F).withOpacity(0.3) : const Color(0xFFFEF3C7))
                                      : (isDark ? cardColor : Colors.white),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _selectedCollector != 'All Users'
                                        ? const Color(0xFFFCD34D)
                                        : borderColor,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.person_rounded,
                                      size: 14,
                                      color: _selectedCollector != 'All Users'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _selectedCollector == 'All Users'
                                            ? 'REQUEST BY'
                                            : _selectedCollector.toUpperCase(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                          color: _selectedCollector != 'All Users'
                                              ? const Color(0xFFB45309)
                                              : primaryText,
                                        ),
                                      ),
                                    ),
                                    Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      size: 15,
                                      color: _selectedCollector != 'All Users'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(width: 6),

                          // 2. STATUS Filter Pill (Pending / Approved / Rejected / Cancelled)
                          Expanded(
                            flex: 11,
                            child: InkWell(
                              onTap: () => _showStatusSelector(context, isDark),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                height: 38,
                                padding: const EdgeInsets.symmetric(horizontal: 7),
                                decoration: BoxDecoration(
                                  color: _selectedStatus != 'ALL'
                                      ? (isDark ? const Color(0xFF78350F).withOpacity(0.3) : const Color(0xFFFEF3C7))
                                      : (isDark ? cardColor : Colors.white),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _selectedStatus != 'ALL'
                                        ? const Color(0xFFFCD34D)
                                        : borderColor,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.tune_rounded,
                                      size: 14,
                                      color: _selectedStatus != 'ALL'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _selectedStatus == 'ALL'
                                            ? 'STATUS'
                                            : _selectedStatus.toUpperCase(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                          color: _selectedStatus != 'ALL'
                                              ? const Color(0xFFB45309)
                                              : primaryText,
                                        ),
                                      ),
                                    ),
                                    Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      size: 15,
                                      color: _selectedStatus != 'ALL'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(width: 6),

                          // 3. PERIOD Filter Pill (All Time / Since Last Report)
                          Expanded(
                            flex: 11,
                            child: InkWell(
                              onTap: () => _showPeriodSelector(context, isDark),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                height: 38,
                                padding: const EdgeInsets.symmetric(horizontal: 7),
                                decoration: BoxDecoration(
                                  color: _selectedPeriod != 'ALL TIME'
                                      ? (isDark ? const Color(0xFF78350F).withOpacity(0.3) : const Color(0xFFFEF3C7))
                                      : (isDark ? cardColor : Colors.white),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _selectedPeriod != 'ALL TIME'
                                        ? const Color(0xFFFCD34D)
                                        : borderColor,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.calendar_today_rounded,
                                      size: 13,
                                      color: _selectedPeriod != 'ALL TIME'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _selectedPeriod == 'ALL TIME'
                                            ? 'ALL TIME'
                                            : _selectedPeriod.toUpperCase(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                          color: _selectedPeriod != 'ALL TIME'
                                              ? const Color(0xFFB45309)
                                              : primaryText,
                                        ),
                                      ),
                                    ),
                                    Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      size: 15,
                                      color: _selectedPeriod != 'ALL TIME'
                                          ? const Color(0xFFB45309)
                                          : secondaryText,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_selectedCollector != 'All Users' || _selectedStatus != 'ALL' || _selectedPeriod != 'ALL TIME') ...[
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            InkWell(
                              onTap: () {
                                setState(() {
                                  _selectedCollector = 'All Users';
                                  _selectedStatus = 'ALL';
                                  _selectedPeriod = 'ALL TIME';
                                  _isLoading = true;
                                });
                                _fetchRequests();
                              },
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: const [
                                    Icon(Icons.close_rounded, size: 14, color: Color(0xFFDC2626)),
                                    SizedBox(width: 4),
                                    Text(
                                      'Reset Filters',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFFDC2626),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // 3. Requests List or Loading or Empty
              if (_isLoading)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFFD97706)),
                  ),
                )
              else if (_requests.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.receipt_long_outlined,
                            size: 54,
                            color: secondaryText.withOpacity(0.4),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No Discount Requests Found',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: primaryText,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _selectedStatus == 'ALL'
                                ? 'No fee discount approval requests have been submitted yet.'
                                : 'No discount requests matching "$_selectedStatus" status.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              color: secondaryText,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final req = _requests[index];
                        return _buildRequestCard(req, isDark, cardColor, primaryText, secondaryText, borderColor);
                      },
                      childCount: _requests.length,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCollectorSelector(BuildContext context, bool isDark) {
    final sheetBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final primaryText = isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A);
    final secondaryText = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    showModalBottomSheet(
      context: context,
      backgroundColor: sheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline_rounded, size: 20, color: Color(0xFFD97706)),
                    const SizedBox(width: 8),
                    Text(
                      'Filter by REQUEST BY',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _availableCollectors.length,
                  itemBuilder: (context, idx) {
                    final c = _availableCollectors[idx];
                    final name = c['name']?.toString() ?? '';
                    final label = c['label']?.toString() ?? name;
                    final isSelected = _selectedCollector == name;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: isSelected
                            ? (isDark ? const Color(0xFF78350F).withOpacity(0.4) : const Color(0xFFFEF3C7))
                            : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                        child: Icon(
                          name == 'All Users' ? Icons.groups_rounded : Icons.person_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : secondaryText,
                        ),
                      ),
                      title: Text(
                        label,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFD97706) : primaryText,
                        ),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706), size: 20)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx);
                        if (_selectedCollector != name) {
                          setState(() {
                            _selectedCollector = name;
                            _isLoading = true;
                          });
                          _fetchRequests();
                        }
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showStatusSelector(BuildContext context, bool isDark) {
    final sheetBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final primaryText = isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A);

    final statusOptions = [
      {'key': 'ALL', 'label': 'All Requests', 'count': _summary['total'] ?? 0, 'color': const Color(0xFF64748B)},
      {'key': 'PENDING', 'label': 'Pending', 'count': _summary['pending'] ?? 0, 'color': const Color(0xFFD97706)},
      {'key': 'APPROVED', 'label': 'Approved', 'count': _summary['approved'] ?? 0, 'color': const Color(0xFF059669)},
      {'key': 'REJECTED', 'label': 'Rejected', 'count': _summary['rejected'] ?? 0, 'color': const Color(0xFFDC2626)},
      {'key': 'CANCELLED', 'label': 'Cancelled', 'count': _summary['cancelled'] ?? 0, 'color': const Color(0xFF64748B)},
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: sheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.tune_rounded, size: 20, color: Color(0xFFD97706)),
                    const SizedBox(width: 8),
                    Text(
                      'Filter by STATUS',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: statusOptions.length,
                  itemBuilder: (context, idx) {
                    final opt = statusOptions[idx];
                    final key = opt['key'] as String;
                    final label = opt['label'] as String;
                    final count = opt['count'] as int;
                    final color = opt['color'] as Color;
                    final isSelected = _selectedStatus == key;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: isSelected
                            ? (isDark ? const Color(0xFF78350F).withOpacity(0.4) : const Color(0xFFFEF3C7))
                            : color.withOpacity(0.12),
                        child: Icon(
                          key == 'PENDING'
                              ? Icons.hourglass_top_rounded
                              : key == 'APPROVED'
                                  ? Icons.check_circle_outline_rounded
                                  : key == 'REJECTED'
                                      ? Icons.cancel_outlined
                                      : key == 'CANCELLED'
                                          ? Icons.block_rounded
                                          : Icons.all_inclusive_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : color,
                        ),
                      ),
                      title: Row(
                        children: [
                          Text(
                            label,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected ? const Color(0xFFD97706) : primaryText,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFD97706) : color.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '$count',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: isSelected ? Colors.white : color,
                              ),
                            ),
                          ),
                        ],
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706), size: 20)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx);
                        if (_selectedStatus != key) {
                          setState(() {
                            _selectedStatus = key;
                            _isLoading = true;
                          });
                          _fetchRequests();
                        }
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPeriodSelector(BuildContext context, bool isDark) {
    final sheetBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final primaryText = isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A);
    final secondaryText = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    showModalBottomSheet(
      context: context,
      backgroundColor: sheetBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_rounded, size: 20, color: Color(0xFFD97706)),
                    const SizedBox(width: 8),
                    Text(
                      'Filter by PERIOD',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: primaryText,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _availablePeriods.length,
                  itemBuilder: (context, idx) {
                    final p = _availablePeriods[idx];
                    final isSelected = _selectedPeriod == p;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: isSelected
                            ? (isDark ? const Color(0xFF78350F).withOpacity(0.4) : const Color(0xFFFEF3C7))
                            : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                        child: Icon(
                          p == 'ALL TIME' ? Icons.history_rounded : Icons.fiber_new_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : secondaryText,
                        ),
                      ),
                      title: Text(
                        p,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFD97706) : primaryText,
                        ),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706), size: 20)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx);
                        if (_selectedPeriod != p) {
                          setState(() {
                            _selectedPeriod = p;
                            _isLoading = true;
                          });
                          _fetchRequests();
                        }
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRequestCard(
    dynamic req,
    bool isDark,
    Color cardColor,
    Color primaryText,
    Color secondaryText,
    Color borderColor,
  ) {
    final id = int.tryParse(req['id']?.toString() ?? '0') ?? 0;
    final studentName = req['student_name']?.toString() ?? 'Unknown Student';
    final rollNo = req['roll_no']?.toString() ?? req['admission_no']?.toString() ?? '';
    final className = req['class_name']?.toString() ?? 'Class N/A';
    final feeType = req['fee_type']?.toString().toUpperCase() ?? 'MONTHLY';
    final feeItems = req['fee_items_summary']?.toString() ?? '';
    final totalAmount = double.tryParse(req['total_amount']?.toString() ?? '0') ?? 0.0;
    final paidAmount = double.tryParse(req['paid_amount']?.toString() ?? '0') ?? 0.0;
    final discountAmount = double.tryParse(req['discount_amount']?.toString() ?? '0') ?? 0.0;
    final paymentMethod = req['payment_method']?.toString() ?? 'Cash';
    final requestedBy = req['requested_by']?.toString() ?? 'Fee Collector';
    final status = req['status']?.toString().toUpperCase() ?? 'PENDING';
    final createdAt = req['created_at']?.toString() ?? '';
    final approvedBy = req['approved_by']?.toString() ?? '';
    final rejectionReason = req['rejection_reason']?.toString() ?? '';

    String formattedDate = _formatDate(createdAt);

    // Status colors
    Color statusBg;
    Color statusBorder;
    Color statusColor;
    IconData statusIcon;
    String statusLabel = 'PENDING';

    switch (status) {
      case 'APPROVED':
        statusBg = const Color(0xFFD1FAE5);
        statusBorder = const Color(0xFFA7F3D0);
        statusColor = const Color(0xFF059669);
        statusIcon = Icons.check_circle_rounded;
        statusLabel = 'APPROVED';
        break;
      case 'REJECTED':
        statusBg = const Color(0xFFFEE2E2);
        statusBorder = const Color(0xFFFECACA);
        statusColor = const Color(0xFFDC2626);
        statusIcon = Icons.cancel_rounded;
        statusLabel = 'REJECTED';
        break;
      case 'CANCELLED':
        statusBg = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);
        statusBorder = isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0);
        statusColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
        statusIcon = Icons.block_rounded;
        statusLabel = 'CANCELLED';
        break;
      case 'PENDING':
      default:
        statusBg = const Color(0xFFFEF3C7);
        statusBorder = const Color(0xFFFDE68A);
        statusColor = const Color(0xFFD97706);
        statusIcon = Icons.hourglass_top_rounded;
        statusLabel = 'PENDING';
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == 'PENDING'
              ? const Color(0xFFFDE68A)
              : (status == 'APPROVED' ? const Color(0xFFA7F3D0) : (status == 'REJECTED' ? const Color(0xFFFECACA) : borderColor)),
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD97706).withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Student Name + Status Badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        studentName,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: primaryText,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${className.isNotEmpty ? className : "Class"}  •  Roll No: ${rollNo.isNotEmpty ? rollNo : "--"}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: secondaryText,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 11, color: statusColor),
                      const SizedBox(width: 3),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Fee Type & Items Chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: borderColor),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    feeType == 'ADDITIONAL'
                        ? Icons.inventory_2_outlined
                        : Icons.calendar_today_rounded,
                    size: 13,
                    color: secondaryText,
                  ),
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(
                      formatFeeSummary(feeType, feeItems),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Financial Breakdown Card
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFFEF3C7)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payable Fee',
                        style: TextStyle(fontSize: 10, color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '₹${totalAmount.round()}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: primaryText,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        'Discount',
                        style: TextStyle(fontSize: 10, color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '₹${discountAmount.round()}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'To Collect ($paymentMethod)',
                        style: TextStyle(fontSize: 10, color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '₹${paidAmount.round()}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF047857),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Requested by info & notes
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: secondaryText),
                    children: [
                      const TextSpan(text: 'Requested by '),
                      TextSpan(
                        text: requestedBy,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                ),
                if (formattedDate.isNotEmpty)
                  Text(
                    formattedDate,
                    style: TextStyle(fontSize: 10.5, color: secondaryText),
                  ),
              ],
            ),
            if (status == 'APPROVED' && approvedBy.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'Approved by $approvedBy',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
              ),
            ],
            if (status == 'REJECTED' && rejectionReason.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'Reason: $rejectionReason',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFDC2626)),
              ),
            ],
            if (status == 'CANCELLED') ...[
              const SizedBox(height: 4),
              Text(
                'Cancelled by fee collector. This request cannot be approved or rejected.',
                style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: secondaryText),
              ),
            ],

            // Action Buttons: Reject & Approve (ONLY FOR PENDING!)
            if (status == 'PENDING') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _handleReject(id, studentName),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626), width: 1.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(vertical: 9),
                      ),
                      child: const Text(
                        'Reject',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _handleApprove(id, studentName, discountAmount),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(vertical: 9),
                      ),
                      child: const Text(
                        'Approve',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class BoxSet {
  static BoxShadow subtle(bool isDark) {
    return BoxShadow(
      color: isDark ? Colors.black.withOpacity(0.2) : Colors.black.withOpacity(0.04),
      blurRadius: 8,
      offset: const Offset(0, 2),
    );
  }
}

