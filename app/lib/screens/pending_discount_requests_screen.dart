import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/fee_service.dart';
import 'package:school_hub/screens/fees_portal_screen.dart';

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

class PendingDiscountRequestsScreen extends StatefulWidget {
  final FeeService feeService;
  final List<dynamic>? allStudents;
  final Function(Map<String, dynamic> studentSummary)? onOpenStudentCard;

  const PendingDiscountRequestsScreen({
    super.key,
    required this.feeService,
    this.allStudents,
    this.onOpenStudentCard,
  });

  @override
  State<PendingDiscountRequestsScreen> createState() => _PendingDiscountRequestsScreenState();
}

class _PendingDiscountRequestsScreenState extends State<PendingDiscountRequestsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  List<Map<String, dynamic>> _allRequests = [];
  List<Map<String, dynamic>> _filteredRequests = [];
  bool _isLoading = true;
  String _errorMessage = '';

  int _currentUserId = 0;
  String _currentUserRole = '';
  String _currentUserName = '';

  // Filter States (matching School Admin)
  String _selectedStatus = 'ALL';
  String _selectedPeriod = 'ALL TIME';
  String _selectedCollector = 'All Users';
  List<String> _availablePeriods = ['ALL TIME', 'SINCE LAST REPORT'];
  List<Map<String, dynamic>> _availableCollectors = [
    {'name': 'All Users', 'label': 'All Collectors'}
  ];
  Map<String, dynamic> _summary = {
    'total': 0,
    'pending': 0,
    'approved': 0,
    'rejected': 0,
    'cancelled': 0,
  };

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_applySearch);
    _loadCurrentUserInfo();
    _loadRequests();
  }

  Future<void> _loadCurrentUserInfo() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        setState(() {
          _currentUserId = prefs.getInt('user_id') ?? 0;
          _currentUserRole = (prefs.getString('user_role') ?? '').toUpperCase();
          _currentUserName = (prefs.getString('user_name') ?? '').trim();
        });
      }
    } catch (_) {}
  }

  bool _canUserCancel(Map<String, dynamic> req) {
    if (_currentUserRole == 'SCHOOL_ADMIN' || _currentUserRole == 'SUPER_ADMIN' || _currentUserRole == 'ADMIN') {
      return true;
    }
    final reqUserId = int.tryParse(req['requested_by_id']?.toString() ?? '') ?? 0;
    if (reqUserId > 0 && _currentUserId > 0) {
      return reqUserId == _currentUserId;
    }
    final reqUserName = (req['requested_by'] ?? '').toString().trim();
    if (reqUserName.isNotEmpty && _currentUserName.isNotEmpty) {
      return reqUserName.toLowerCase() == _currentUserName.toLowerCase();
    }
    return false;
  }

  @override
  void dispose() {
    _searchController.removeListener(_applySearch);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      final res = await widget.feeService.getDiscountRequests(
        status: _selectedStatus,
        period: _selectedPeriod,
        requestedBy: _selectedCollector,
      );
      final list = (res['requests'] as List<dynamic>?) ?? [];
      final parsed = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final periods = (res['available_periods'] as List<dynamic>?)?.map((p) => p.toString()).toList();
      final cols = (res['available_collectors'] as List<dynamic>?)
          ?.map((c) => Map<String, dynamic>.from(c as Map))
          .toList();

      if (mounted) {
        setState(() {
          _allRequests = parsed;
          if (periods != null && periods.isNotEmpty) {
            _availablePeriods = periods;
          }
          if (cols != null && cols.isNotEmpty) {
            _availableCollectors = cols;
          }
          if (res['summary'] is Map) {
            _summary = Map<String, dynamic>.from(res['summary']);
          }
          _isLoading = false;
        });
        _applySearch();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  void _applySearch() {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) {
      setState(() {
        _filteredRequests = List.from(_allRequests);
      });
      return;
    }
    setState(() {
      _filteredRequests = _allRequests.where((r) {
        final name = (r['student_name'] ?? '').toString().toLowerCase();
        final roll = (r['roll_no'] ?? '').toString().toLowerCase();
        final cls = (r['class_name'] ?? '').toString().toLowerCase();
        final summary = (r['fee_items_summary'] ?? '').toString().toLowerCase();
        final feeType = (r['fee_type'] ?? '').toString().toLowerCase();
        final reqBy = (r['requested_by'] ?? '').toString().toLowerCase();
        return name.contains(query) ||
            roll.contains(query) ||
            cls.contains(query) ||
            summary.contains(query) ||
            feeType.contains(query) ||
            reqBy.contains(query);
      }).toList();
    });
  }

  Future<void> _handleCancelRequest(int reqId, String studentName, double discAmount) async {
    _searchFocusNode.unfocus();
    final bool? confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 24),
            SizedBox(width: 8),
            Text(
              'Cancel Discount Request',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to cancel the discount request of ₹${discAmount.round()} for $studentName?',
          style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Request', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Yes, Cancel', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await widget.feeService.cancelDiscountRequest(reqId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Discount request cancelled successfully.',
              style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
            ),
            backgroundColor: Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
        _loadRequests();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to cancel request: $e'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _navigateToStudentCard(Map<String, dynamic> req) {
    _searchFocusNode.unfocus();
    final studentId = int.tryParse(req['student_id']?.toString() ?? '') ?? 0;
    if (studentId <= 0) return;

    Map<String, dynamic>? studentSummary;
    if (widget.allStudents != null && widget.allStudents!.isNotEmpty) {
      studentSummary = widget.allStudents!.firstWhere(
        (s) => (s['id']?.toString() ?? '') == studentId.toString(),
        orElse: () => <String, dynamic>{},
      );
    }
    if (studentSummary == null || studentSummary.isEmpty) {
      studentSummary = {
        'id': studentId,
        'name': req['student_name'] ?? 'Student',
        'class_name': req['class_name'] ?? '',
        'roll_no': req['roll_no'] ?? '',
        'raw': {
          'id': studentId,
          'name': req['student_name'] ?? 'Student',
          'class_name': req['class_name'] ?? '',
          'roll_no': req['roll_no'] ?? '',
        },
      };
    } else if (studentSummary['raw'] == null) {
      studentSummary = Map<String, dynamic>.from(studentSummary);
      studentSummary['raw'] = {
        'id': studentId,
        'name': studentSummary['name'] ?? req['student_name'] ?? 'Student',
        'class_name': studentSummary['class_name'] ?? req['class_name'] ?? '',
        'roll_no': studentSummary['roll_no'] ?? req['roll_no'] ?? '',
      };
    }

    if (widget.onOpenStudentCard != null) {
      widget.onOpenStudentCard!(studentSummary);
    }
    openStudentLedgerSheet(
      context: context,
      studentId: studentId,
      studentSummary: studentSummary,
      feeService: widget.feeService,
      onRefreshNeeded: () => _loadRequests(),
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

  Widget _buildStatusBadge(String status) {
    final s = status.toUpperCase();
    if (s == 'PENDING') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFFDE68A)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.hourglass_top_rounded, size: 11, color: Color(0xFFD97706)),
            SizedBox(width: 3),
            Text(
              'WAITING FOR APPROVAL',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
                color: Color(0xFFD97706),
              ),
            ),
          ],
        ),
      );
    } else if (s == 'APPROVED') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFD1FAE5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.check_circle_rounded, size: 11, color: Color(0xFF059669)),
            SizedBox(width: 3),
            Text(
              'APPROVED',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
                color: Color(0xFF059669),
              ),
            ),
          ],
        ),
      );
    } else if (s == 'REJECTED') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFFECACA)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.cancel_rounded, size: 11, color: Color(0xFFDC2626)),
            SizedBox(width: 3),
            Text(
              'REJECTED',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
                color: Color(0xFFDC2626),
              ),
            ),
          ],
        ),
      );
    } else if (s == 'CANCELLED') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.block_rounded, size: 11, color: Color(0xFF64748B)),
            SizedBox(width: 3),
            Text(
              'CANCELLED',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  void _showCollectorSelector(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
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
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.person_outline_rounded, size: 20, color: Color(0xFFD97706)),
                    SizedBox(width: 8),
                    Text(
                      'Filter by REQUEST BY',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
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
                        backgroundColor: isSelected ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                        child: Icon(
                          name == 'All Users' ? Icons.groups_rounded : Icons.person_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF64748B),
                        ),
                      ),
                      title: Text(
                        label,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF0F172A),
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
                          _loadRequests();
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

  void _showStatusSelector(BuildContext context) {
    final statusOptions = [
      {'key': 'ALL', 'label': 'All Requests', 'count': _summary['total'] ?? 0, 'color': const Color(0xFF64748B)},
      {'key': 'PENDING', 'label': 'Waiting for Approval', 'count': _summary['pending'] ?? 0, 'color': const Color(0xFFD97706)},
      {'key': 'APPROVED', 'label': 'Approved', 'count': _summary['approved'] ?? 0, 'color': const Color(0xFF059669)},
      {'key': 'REJECTED', 'label': 'Rejected', 'count': _summary['rejected'] ?? 0, 'color': const Color(0xFFDC2626)},
      {'key': 'CANCELLED', 'label': 'Cancelled', 'count': _summary['cancelled'] ?? 0, 'color': const Color(0xFF64748B)},
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
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
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.tune_rounded, size: 20, color: Color(0xFFD97706)),
                    SizedBox(width: 8),
                    Text(
                      'Filter by STATUS',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
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
                            ? const Color(0xFFFEF3C7)
                            : color.withValues(alpha: 0.12),
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
                              color: isSelected ? const Color(0xFFD97706) : const Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFD97706) : color.withValues(alpha: 0.12),
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
                          _loadRequests();
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

  void _showPeriodSelector(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
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
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.calendar_today_rounded, size: 20, color: Color(0xFFD97706)),
                    SizedBox(width: 8),
                    Text(
                      'Filter by PERIOD',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFE2E8F0)),
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
                        backgroundColor: isSelected ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                        child: Icon(
                          p == 'ALL TIME' ? Icons.history_rounded : Icons.fiber_new_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF64748B),
                        ),
                      ),
                      title: Text(
                        p,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF0F172A),
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
                          _loadRequests();
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

  Color _getCardBorderColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return const Color(0xFFFDE68A);
      case 'APPROVED':
        return const Color(0xFFA7F3D0);
      case 'REJECTED':
        return const Color(0xFFFECACA);
      case 'CANCELLED':
      default:
        return const Color(0xFFE2E8F0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusPillText = _selectedStatus == 'ALL'
        ? 'STATUS'
        : _selectedStatus == 'PENDING'
            ? 'WAITING FOR APPROVAL'
            : _selectedStatus.toUpperCase();

    final subtitleText = _selectedStatus == 'PENDING'
        ? '${_summary['pending'] ?? 0} Waiting for Approval'
        : _selectedStatus == 'ALL'
            ? '${_summary['pending'] ?? 0} Waiting for Approval'
            : '${_filteredRequests.length} ${_selectedStatus == 'APPROVED' ? 'Approved' : _selectedStatus == 'REJECTED' ? 'Rejected' : 'Cancelled'}';

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFDFBF7),
        appBar: AppBar(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          elevation: 0.5,
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : const Color(0xFF1E293B)),
            onPressed: () => Navigator.pop(context),
          ),
          title: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'D',
                  style: TextStyle(
                    color: Color(0xFFB45309),
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'DISCOUNT REQUESTS',
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    subtitleText,
                    style: const TextStyle(
                      color: Color(0xFFD97706),
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Color(0xFF1E293B)),
              tooltip: 'Refresh',
              onPressed: _loadRequests,
            ),
          ],
        ),
        body: Column(
          children: [
            // Search Bar & 3 Filter Dropdowns Row Container
            Container(
              color: isDark ? const Color(0xFF1E293B) : Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Column(
                children: [
                  // Search Input
                  Container(
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                    ),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: 'Search student by name, roll no, class...',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF94A3B8)),
                                onPressed: () {
                                  _searchController.clear();
                                  _searchFocusNode.unfocus();
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // 3 Filter Pills Row (Request By, Status, Period)
                  Row(
                    children: [
                      // 1. REQUEST BY Filter Pill
                      Expanded(
                        flex: 11,
                        child: InkWell(
                          onTap: () => _showCollectorSelector(context),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 7),
                            decoration: BoxDecoration(
                              color: _selectedCollector != 'All Users'
                                  ? const Color(0xFFFEF3C7)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _selectedCollector != 'All Users'
                                    ? const Color(0xFFFCD34D)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.person_rounded,
                                  size: 14,
                                  color: _selectedCollector != 'All Users'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
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
                                          : const Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                                Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 15,
                                  color: _selectedCollector != 'All Users'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(width: 6),

                      // 2. STATUS Filter Pill (Waiting for Approval / Approved / Rejected / Cancelled)
                      Expanded(
                        flex: 11,
                        child: InkWell(
                          onTap: () => _showStatusSelector(context),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 7),
                            decoration: BoxDecoration(
                              color: _selectedStatus != 'ALL'
                                  ? const Color(0xFFFEF3C7)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _selectedStatus != 'ALL'
                                    ? const Color(0xFFFCD34D)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.tune_rounded,
                                  size: 14,
                                  color: _selectedStatus != 'ALL'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    statusPillText,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                      color: _selectedStatus != 'ALL'
                                          ? const Color(0xFFB45309)
                                          : const Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                                Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 15,
                                  color: _selectedStatus != 'ALL'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
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
                          onTap: () => _showPeriodSelector(context),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 7),
                            decoration: BoxDecoration(
                              color: _selectedPeriod != 'ALL TIME'
                                  ? const Color(0xFFFEF3C7)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _selectedPeriod != 'ALL TIME'
                                    ? const Color(0xFFFCD34D)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.calendar_today_rounded,
                                  size: 13,
                                  color: _selectedPeriod != 'ALL TIME'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
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
                                          : const Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                                Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  size: 15,
                                  color: _selectedPeriod != 'ALL TIME'
                                      ? const Color(0xFFB45309)
                                      : const Color(0xFF64748B),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),

            // Content List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
                  : _errorMessage.isNotEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.error_outline_rounded, size: 44, color: Color(0xFFDC2626)),
                                const SizedBox(height: 12),
                                Text(
                                  _errorMessage,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 14),
                                ElevatedButton(
                                  onPressed: _loadRequests,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD97706),
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : _filteredRequests.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      _allRequests.isEmpty
                                          ? Icons.check_circle_outline_rounded
                                          : Icons.search_off_rounded,
                                      size: 54,
                                      color: _allRequests.isEmpty ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                                    ),
                                    const SizedBox(height: 14),
                                    Text(
                                      _allRequests.isEmpty
                                          ? (_selectedStatus == 'PENDING'
                                              ? 'No Requests Waiting for Approval'
                                              : _selectedStatus == 'APPROVED'
                                                  ? 'No Approved Requests'
                                                  : _selectedStatus == 'REJECTED'
                                                      ? 'No Rejected Requests'
                                                      : _selectedStatus == 'CANCELLED'
                                                          ? 'No Cancelled Requests'
                                                          : 'No Discount Requests Found')
                                          : 'No matching requests found',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      _allRequests.isEmpty
                                          ? 'No discount requests matching the selected filters.'
                                          : 'Try searching with another student name or roll number.',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : RefreshIndicator(
                              color: const Color(0xFFD97706),
                              onRefresh: _loadRequests,
                              child: ListView.separated(
                                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                itemCount: _filteredRequests.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final req = _filteredRequests[index];
                                  final reqId = int.tryParse(req['id']?.toString() ?? '') ?? 0;
                                  final studentName = (req['student_name'] ?? 'Student').toString();
                                  final className = (req['class_name'] ?? '').toString();
                                  final rollNo = (req['roll_no'] ?? '').toString();
                                  final feeType = (req['fee_type'] ?? 'MONTHLY').toString().toUpperCase();
                                  final itemsSummary = (req['fee_items_summary'] ?? '').toString();
                                  final totalAmt = double.tryParse(req['total_amount']?.toString() ?? '0') ?? 0.0;
                                  final paidAmt = double.tryParse(req['paid_amount']?.toString() ?? req['amount_after_discount']?.toString() ?? '0') ?? 0.0;
                                  final discAmt = double.tryParse(req['discount_amount']?.toString() ?? '0') ?? 0.0;
                                  final payMethod = (req['payment_method'] ?? 'Cash').toString();
                                  final status = (req['status'] ?? 'PENDING').toString().toUpperCase();
                                  final requestedBy = (req['requested_by'] ?? 'Fee Collector').toString();
                                  final approvedBy = (req['approved_by'] ?? '').toString();
                                  final rejectionReason = (req['rejection_reason'] ?? '').toString();
                                  final formattedDate = _formatDate(req['created_at']?.toString() ?? '');

                                  return Container(
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF1E293B) : Colors.white,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: _getCardBorderColor(status), width: 1.4),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
                                          blurRadius: 8,
                                          offset: const Offset(0, 3),
                                        ),
                                      ],
                                    ),
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(16),
                                        onTap: () => _navigateToStudentCard(req),
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
                                                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                                                          ),
                                                        ),
                                                        const SizedBox(height: 2),
                                                        Text(
                                                          '${className.isNotEmpty ? className : "Class"}  •  Roll No: ${rollNo.isNotEmpty ? rollNo : "--"}',
                                                          style: const TextStyle(
                                                            fontSize: 12,
                                                            fontWeight: FontWeight.w600,
                                                            color: Color(0xFF64748B),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                  _buildStatusBadge(status),
                                                ],
                                              ),
                                              const SizedBox(height: 10),

                                              // Fee Type & Items Chip
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFF8FAFC),
                                                  borderRadius: BorderRadius.circular(8),
                                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(
                                                      feeType == 'ADDITIONAL'
                                                          ? Icons.inventory_2_outlined
                                                          : Icons.calendar_today_rounded,
                                                      size: 13,
                                                      color: const Color(0xFF475569),
                                                    ),
                                                    const SizedBox(width: 5),
                                                    Flexible(
                                                      child: Text(
                                                        formatFeeSummary(feeType, itemsSummary),
                                                        overflow: TextOverflow.ellipsis,
                                                        style: const TextStyle(
                                                          fontSize: 11.5,
                                                          fontWeight: FontWeight.w700,
                                                          color: Color(0xFF334155),
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
                                                  color: const Color(0xFFFFFBEB),
                                                  borderRadius: BorderRadius.circular(10),
                                                  border: Border.all(color: const Color(0xFFFEF3C7)),
                                                ),
                                                child: Row(
                                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                  children: [
                                                    Column(
                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                      children: [
                                                        const Text(
                                                          'Payable Fee',
                                                          style: TextStyle(fontSize: 10, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                                                        ),
                                                        const SizedBox(height: 1),
                                                        Text(
                                                          '₹${totalAmt.round()}',
                                                          style: const TextStyle(
                                                            fontSize: 13,
                                                            fontWeight: FontWeight.w800,
                                                            color: Color(0xFF1E293B),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                    Column(
                                                      crossAxisAlignment: CrossAxisAlignment.center,
                                                      children: [
                                                        const Text(
                                                          'Discount',
                                                          style: TextStyle(fontSize: 10, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                                                        ),
                                                        const SizedBox(height: 1),
                                                        Text(
                                                          '₹${discAmt.round()}',
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
                                                          'To Collect ($payMethod)',
                                                          style: const TextStyle(fontSize: 10, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                                                        ),
                                                        const SizedBox(height: 1),
                                                        Text(
                                                          '₹${paidAmt.round()}',
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

                                              // Requested by info & date
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  RichText(
                                                    text: TextSpan(
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w600,
                                                        color: Color(0xFF64748B),
                                                      ),
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
                                                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
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
                                                const Text(
                                                  'Cancelled by fee collector. This request cannot be approved or rejected.',
                                                  style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Color(0xFF64748B)),
                                                ),
                                              ],

                                              const SizedBox(height: 12),

                                              // Bottom Row: Navigation Hint & Action
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  InkWell(
                                                    onTap: () => _navigateToStudentCard(req),
                                                    borderRadius: BorderRadius.circular(6),
                                                    child: Padding(
                                                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: const [
                                                          Icon(Icons.credit_card_rounded, size: 14, color: Color(0xFFD97706)),
                                                          SizedBox(width: 4),
                                                          Text(
                                                            'View Fee Card',
                                                            style: TextStyle(
                                                              fontSize: 11.5,
                                                              fontWeight: FontWeight.w800,
                                                              color: Color(0xFFD97706),
                                                            ),
                                                          ),
                                                          Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFFD97706)),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                  if (status == 'PENDING') ...[
                                                    if (_canUserCancel(req))
                                                      ElevatedButton(
                                                        onPressed: () => _handleCancelRequest(reqId, studentName, discAmt),
                                                        style: ElevatedButton.styleFrom(
                                                          backgroundColor: const Color(0xFFDC2626),
                                                          foregroundColor: Colors.white,
                                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                                          minimumSize: Size.zero,
                                                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                          elevation: 0,
                                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                        ),
                                                        child: const Text(
                                                          'Cancel Request',
                                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                                                        ),
                                                      )
                                                    else
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                        decoration: BoxDecoration(
                                                          color: const Color(0xFFF8FAFC),
                                                          borderRadius: BorderRadius.circular(8),
                                                          border: Border.all(color: const Color(0xFFE2E8F0)),
                                                        ),
                                                        child: Row(
                                                          mainAxisSize: MainAxisSize.min,
                                                          children: [
                                                            const Icon(Icons.person_outline_rounded, size: 13, color: Color(0xFF64748B)),
                                                            const SizedBox(width: 4),
                                                            RichText(
                                                              text: TextSpan(
                                                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                                children: [
                                                                  const TextSpan(text: 'Requested: ', style: TextStyle(fontWeight: FontWeight.w600)),
                                                                  TextSpan(
                                                                    text: requestedBy,
                                                                    style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                                                                  ),
                                                                ],
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                  ] else if (status == 'APPROVED') ...[
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: const [
                                                        Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF059669)),
                                                        SizedBox(width: 4),
                                                        Text(
                                                          'Approved',
                                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF059669)),
                                                        ),
                                                      ],
                                                    ),
                                                  ] else if (status == 'REJECTED') ...[
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: const [
                                                        Icon(Icons.cancel_rounded, size: 14, color: Color(0xFFDC2626)),
                                                        SizedBox(width: 4),
                                                        Text(
                                                          'Rejected',
                                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
                                                        ),
                                                      ],
                                                    ),
                                                  ] else if (status == 'CANCELLED') ...[
                                                    Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: const [
                                                        Icon(Icons.block_rounded, size: 14, color: Color(0xFF64748B)),
                                                        SizedBox(width: 4),
                                                        Text(
                                                          'Cancelled',
                                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
