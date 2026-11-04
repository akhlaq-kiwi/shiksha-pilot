import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:school_hub/services/expense_service.dart';
import 'package:school_hub/screens/full_screen_image_screen.dart';

class ExpenseScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String? userRole;

  const ExpenseScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    this.userRole,
  });

  @override
  State<ExpenseScreen> createState() => _ExpenseScreenState();
}

class _ExpenseScreenState extends State<ExpenseScreen> {
  late ExpenseService _expenseService;
  bool _isLoading = true;
  String _errorMessage = '';
  bool _isSchoolAdmin = false;
  bool _approvalRequired = false;
  bool _isUpdatingToggle = false;
  int? _currentUserId;

  int? _extractUserIdFromToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length >= 2) {
        var payload = parts[1];
        while (payload.length % 4 != 0) {
          payload += '=';
        }
        final decoded = utf8.decode(base64Url.decode(payload));
        final Map<String, dynamic> data = json.decode(decoded);
        return int.tryParse((data['id'] ?? data['user_id'] ?? data['sub'] ?? '').toString());
      }
    } catch (_) {}
    return null;
  }

  static const List<String> _academicMonths = [
    'ALL',
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  String _selectedMonth = 'ALL';
  List<Map<String, dynamic>> _expenses = [];

  final TextEditingController _searchController = TextEditingController();
  final ScrollController _monthScrollController = ScrollController();
  final Map<String, GlobalKey> _monthKeys = {};
  String _searchQuery = '';
  String _selectedAddedBy = 'ALL';
  String _selectedStatus = 'ALL'; // 'ALL', 'APPROVED', 'PENDING', 'REJECTED'
  String _selectedLock = 'ALL'; // 'ALL', 'LOCKED', 'UNLOCKED'

  String _formatCreatorName(String? name) {
    if (name == null || name.trim().isEmpty) return '';
    final trimmed = name.trim();
    final lower = trimmed.toLowerCase();
    if (lower == 'admin' ||
        lower == 'school admin' ||
        lower.endsWith(' admin') ||
        lower.contains('admin')) {
      return 'Admin';
    }
    return trimmed;
  }

  bool _isExpenseLocked(Map<String, dynamic> item) {
    final approvalStatus = (item['approval_status'] ?? 'Approved').toString().toLowerCase();
    final isPending = approvalStatus == 'pending';
    final isRejected = approvalStatus == 'rejected';
    return ((item['is_locked'] == true) && !isPending) || isRejected;
  }

  @override
  void initState() {
    super.initState();
    _expenseService = ExpenseService(baseUrl: widget.baseUrl, token: widget.token);
    _isSchoolAdmin = (widget.userRole?.toUpperCase() == 'SCHOOL_ADMIN');
    for (final m in _academicMonths) {
      _monthKeys[m] = GlobalKey();
    }
    _selectedMonth = _getCurrentMonthName();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim();
      });
    });

    _initRoleAndSettings();
    _loadExpenses();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 150), () {
        if (mounted) {
          _scrollToMonth(_selectedMonth, animate: false);
        }
      });
    });
  }

  Future<void> _initRoleAndSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final role = (prefs.getString('user_role') ?? widget.userRole ?? '').toUpperCase();
      _currentUserId = prefs.getInt('user_id') ?? _extractUserIdFromToken(widget.token);
      if (role == 'SCHOOL_ADMIN') {
        if (mounted) setState(() => _isSchoolAdmin = true);
        _loadSettings();
      }
    } catch (_) {}
  }

  Future<void> _loadSettings() async {
    try {
      final settings = await _expenseService.getExpenseSettings();
      if (mounted) {
        setState(() {
          _approvalRequired = settings['expense_approval_required'] == true ||
              settings['expense_approval_required'] == 1 ||
              settings['expense_approval_required'] == '1';
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleApprovalSetting(bool value) async {
    setState(() {
      _isUpdatingToggle = true;
    });
    try {
      final res = await _expenseService.updateExpenseSettings(value);
      if (mounted) {
        setState(() {
          _approvalRequired = res['expense_approval_required'] == true;
          _isUpdatingToggle = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Text(
                  value
                      ? 'Expense approval workflow enabled.'
                      : 'Expense approval workflow disabled.',
                ),
              ],
            ),
            backgroundColor: const Color(0xFF0F766E),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUpdatingToggle = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception:', '').trim()),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  // Reusable Modern Confirmation Dialog matching app design system
  Future<bool> _showModernConfirmDialog({
    required String title,
    required String subtitle,
    required String desc,
    required double amount,
    required String creatorName,
    required String infoText,
    required String actionButtonText,
    required Color actionColor,
    required IconData icon,
    required Color iconBgColor,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
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
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      icon,
                      color: actionColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Expense Detail Card inside Dialog
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            desc,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '₹${_formatCurrency(amount)}',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: actionColor,
                          ),
                        ),
                      ],
                    ),
                    if (creatorName.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Added by: $creatorName',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),
              // Notice / explanation text
              Text(
                infoText,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 20),
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
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
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
                          backgroundColor: actionColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(
                          actionButtonText,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
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

    return result == true;
  }

  Future<void> _confirmApproveExpense(Map<String, dynamic> item) async {
    final desc = item['description'] ?? 'Expense';
    final amt = double.tryParse((item['amount'] ?? 0).toString()) ?? 0.0;
    final creator = _formatCreatorName(item['creator_name']?.toString());

    final confirmed = await _showModernConfirmDialog(
      title: 'Approve Expense?',
      subtitle: 'Confirmation required',
      desc: desc,
      amount: amt,
      creatorName: creator,
      infoText: 'This expense will be officially approved and included in the generated financial report.',
      actionButtonText: 'Approve',
      actionColor: const Color(0xFF059669),
      icon: Icons.check_circle_rounded,
      iconBgColor: const Color(0xFFECFDF5),
    );

    if (confirmed) {
      _approveExpense(item);
    }
  }

  Future<void> _approveExpense(Map<String, dynamic> item) async {
    final id = item['id'] as int;
    try {
      final updated = await _expenseService.approveExpense(id);
      if (mounted) {
        setState(() {
          final idx = _expenses.indexWhere((e) => e['id'] == id);
          if (idx != -1) {
            _expenses[idx] = updated.isNotEmpty
                ? updated
                : {
                    ..._expenses[idx],
                    'approval_status': 'Approved',
                  };
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Expense approved and included in financial report!'),
              ],
            ),
            backgroundColor: Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception:', '').trim()),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _confirmRejectExpense(Map<String, dynamic> item) async {
    final desc = item['description'] ?? 'Expense';
    final amt = double.tryParse((item['amount'] ?? 0).toString()) ?? 0.0;
    final creator = _formatCreatorName(item['creator_name']?.toString());

    final confirmed = await _showModernConfirmDialog(
      title: 'Reject Expense?',
      subtitle: 'Confirmation required',
      desc: desc,
      amount: amt,
      creatorName: creator,
      infoText: 'This expense will be marked as rejected and locked. It cannot be deleted or included in financial reports.',
      actionButtonText: 'Reject',
      actionColor: const Color(0xFFDC2626),
      icon: Icons.cancel_rounded,
      iconBgColor: const Color(0xFFFEF2F2),
    );

    if (confirmed) {
      _rejectExpense(item);
    }
  }

  Future<void> _rejectExpense(Map<String, dynamic> item) async {
    final id = item['id'] as int;
    try {
      final updated = await _expenseService.rejectExpense(id);
      if (mounted) {
        setState(() {
          final idx = _expenses.indexWhere((e) => e['id'] == id);
          if (idx != -1) {
            _expenses[idx] = updated.isNotEmpty
                ? updated
                : {
                    ..._expenses[idx],
                    'approval_status': 'Rejected',
                  };
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.cancel_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Expense rejected and excluded from financial report.'),
              ],
            ),
            backgroundColor: Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception:', '').trim()),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _monthScrollController.dispose();
    super.dispose();
  }

  String _getCurrentMonthName() {
    final now = DateTime.now();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final current = months[now.month - 1];
    if (_academicMonths.contains(current)) {
      return current;
    }
    return 'ALL';
  }

  void _scrollToMonth(String month, {bool animate = true}) {
    final targetIndex = _academicMonths.indexOf(month);
    if (targetIndex > 0 && _monthScrollController.hasClients) {
      const itemExtent = 95.0;
      final screenWidth = MediaQuery.of(context).size.width;
      final targetOffset = (targetIndex * itemExtent) - (screenWidth / 2) + (itemExtent / 2);
      final maxScroll = _monthScrollController.position.maxScrollExtent;
      final clampedOffset = targetOffset.clamp(0.0, maxScroll > 0 ? maxScroll : targetOffset);
      if (animate) {
        _monthScrollController.animateTo(
          clampedOffset,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
      } else {
        _monthScrollController.jumpTo(clampedOffset);
      }
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final key = _monthKeys[month];
      final currentContext = key?.currentContext;
      if (currentContext != null) {
        Scrollable.ensureVisible(
          currentContext,
          duration: animate ? const Duration(milliseconds: 200) : Duration.zero,
          curve: Curves.easeOutCubic,
          alignment: 0.5,
        );
      }
    });
  }

  Future<void> _markExpenseNotificationsAsRead() async {
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/school/notifications/0/read');
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: json.encode({'module': 'expense'}),
      );
    } catch (_) {}
  }

  Future<void> _loadExpenses() async {
    _markExpenseNotificationsAsRead();
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final list = await _expenseService.getExpenses(
        month: _selectedMonth == 'ALL' ? null : _selectedMonth,
      );
      if (mounted) {
        setState(() {
          _expenses = list;
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
    _loadExpenses();
  }

  String _formatCurrency(num amount) {
    return amount
        .toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2)
        .replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '';
    try {
      final parts = dateStr.split('-');
      if (parts.length == 3) {
        final y = parts[0];
        final m = int.tryParse(parts[1]) ?? 1;
        final d = parts[2];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return '$d ${months[m - 1]} $y';
      }
    } catch (_) {}
    return dateStr;
  }

  void _openAddExpenseModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddExpenseBottomSheet(
        expenseService: _expenseService,
        onExpenseAdded: (newExpense) {
          setState(() {
            _expenses.insert(0, newExpense);
          });
          final isPending = (newExpense['approval_status'] ?? '').toString().toLowerCase() == 'pending';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  Icon(
                    isPending ? Icons.schedule_rounded : Icons.check_circle_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    isPending
                        ? 'Expense recorded! Awaiting School Admin approval.'
                        : 'Expense recorded successfully!',
                  ),
                ],
              ),
              backgroundColor: isPending ? const Color(0xFFD97706) : const Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDeleteExpense(Map<String, dynamic> expense) async {
    // Exact web behavior: do not allow deletion if expense is locked in a report or rejected
    if (_isExpenseLocked(expense)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This action can not be done, This is already included in financial report'),
          backgroundColor: Color(0xFFD97706),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final desc = expense['description'] ?? 'Expense';
    final amt = double.tryParse((expense['amount'] ?? 0).toString()) ?? 0.0;
    final creator = _formatCreatorName(expense['creator_name']?.toString());

    final confirmed = await _showModernConfirmDialog(
      title: 'Delete Expense?',
      subtitle: 'Permanent removal',
      desc: desc,
      amount: amt,
      creatorName: creator,
      infoText: 'Are you sure you want to delete this expense entry? This action cannot be undone.',
      actionButtonText: 'Delete',
      actionColor: const Color(0xFFDC2626),
      icon: Icons.delete_outline_rounded,
      iconBgColor: const Color(0xFFFEF2F2),
    );

    if (confirmed) {
      try {
        await _expenseService.deleteExpense(expense['id'] as int);
        setState(() {
          _expenses.removeWhere((e) => e['id'] == expense['id']);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Expense deleted successfully'),
              backgroundColor: Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString().replaceAll('Exception:', '').trim()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredExpenses = _expenses.where((e) {
      if (_searchQuery.isNotEmpty) {
        final desc = (e['description'] ?? '').toString().toLowerCase();
        final q = _searchQuery.toLowerCase();
        if (!desc.contains(q)) return false;
      }
      if (_selectedAddedBy != 'ALL') {
        final creator = _formatCreatorName((e['creator_name'] ?? '').toString());
        if (creator.toLowerCase() != _selectedAddedBy.toLowerCase()) return false;
      }
      if (_selectedStatus != 'ALL') {
        final status = (e['approval_status'] ?? 'Approved').toString().toUpperCase();
        if (status != _selectedStatus) return false;
      }
      if (_selectedLock != 'ALL') {
        final locked = _isExpenseLocked(e);
        if (_selectedLock == 'LOCKED' && !locked) return false;
        if (_selectedLock == 'UNLOCKED' && locked) return false;
      }
      return true;
    }).toList();

    final totalExpenseAmount = filteredExpenses
        .where((e) => (e['approval_status'] ?? 'Approved').toString().toLowerCase() != 'rejected')
        .fold<double>(
          0.0,
          (sum, e) => sum + (double.tryParse((e['amount'] ?? 0).toString()) ?? 0.0),
        );
    final totalApprovedAmount = filteredExpenses
        .where((e) => (e['approval_status'] ?? 'Approved').toString().toLowerCase() == 'approved')
        .fold<double>(
          0.0,
          (sum, e) => sum + (double.tryParse((e['amount'] ?? 0).toString()) ?? 0.0),
        );
    final pendingCount = filteredExpenses
        .where((e) => (e['approval_status'] ?? 'Approved').toString().toLowerCase() == 'pending')
        .length;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'EXPENSES',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.bold,
            fontSize: 16.5,
            letterSpacing: 0.2,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFD97706),
        foregroundColor: Colors.white,
        elevation: 3,
        icon: const Icon(Icons.add_rounded, size: 22),
        label: const Text(
          'ADD EXPENSE',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
            fontSize: 13,
          ),
        ),
        onPressed: _openAddExpenseModal,
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.opaque,
        child: NotificationListener<ScrollNotification>(
          onNotification: (scrollNotif) {
            if (scrollNotif is ScrollUpdateNotification && scrollNotif.scrollDelta != null && scrollNotif.scrollDelta! != 0) {
              FocusScope.of(context).unfocus();
            }
            return false;
          },
          child: Column(
            children: [
              // 1. Month Selector Bar
              _buildMonthSelectorHeader(),

              // Main scrollable area
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadExpenses,
                  color: const Color(0xFFD97706),
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_isSchoolAdmin) _buildApprovalToggleCard(),
                    // 2. Summary Card: Total Expenses for Selected Month
                    _buildTotalExpenseCard(
                      totalExpenseAmount,
                      filteredExpenses.length,
                      pendingCount: pendingCount,
                      approvedTotal: totalApprovedAmount,
                    ),

                    const SizedBox(height: 12),

                    // Two Filter Dropdowns (Added By & Approved/Pending)
                    _buildFilterDropdowns(),

                    const SizedBox(height: 12),

                    // 3. Search Field
                    _buildSearchField(),

                    const SizedBox(height: 14),

                    // 4. Expenses List
                    if (_isLoading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 60),
                        child: Center(
                          child: CircularProgressIndicator(color: Color(0xFFD97706)),
                        ),
                      )
                    else if (_errorMessage.isNotEmpty)
                      _buildErrorCard()
                    else if (filteredExpenses.isEmpty)
                      _buildEmptyState()
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: filteredExpenses.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, idx) {
                          final item = filteredExpenses[idx];
                          return _buildExpenseCard(item);
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  ),
    );
  }

  Widget _buildMonthSelectorHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
            final label = month == 'ALL' ? 'All Months' : month;
            return GestureDetector(
              key: _monthKeys[month],
              onTap: () => _onMonthChanged(month),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFD97706) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Center(
                  child: Text(
                    label,
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

  Widget _buildApprovalToggleCard() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _approvalRequired ? const Color(0xFF0D9488).withOpacity(0.4) : const Color(0xFFE2E8F0),
          width: _approvalRequired ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: (_approvalRequired ? const Color(0xFF0D9488) : const Color(0xFF64748B)).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.verified_user_rounded,
                  color: _approvalRequired ? const Color(0xFF0D9488) : const Color(0xFF64748B),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Require Expense Approval',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _approvalRequired
                          ? 'Approval workflow is currently ACTIVE'
                          : 'Approval workflow is currently INACTIVE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _approvalRequired ? const Color(0xFF0D9488) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              if (_isUpdatingToggle)
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D9488)),
                )
              else
                Switch.adaptive(
                  value: _approvalRequired,
                  activeColor: const Color(0xFF0D9488),
                  onChanged: _toggleApprovalSetting,
                ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0D9488).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('ON', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0F766E))),
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Fee collector expenses require School Admin approval before being included in the financial report.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF334155), height: 1.3),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF64748B).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('OFF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Expenses are automatically approved and instantly added to the financial report without review.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF334155), height: 1.3),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalExpenseCard(double total, int count, {int pendingCount = 0, double approvedTotal = 0}) {
    final monthLabel = _selectedMonth == 'ALL' ? 'Selected Period' : _selectedMonth;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEF4444), size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TOTAL EXPENSES FOR $monthLabel'.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '₹${_formatCurrency(total)}',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count ${count == 1 ? 'entry' : 'entries'}',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF475569),
                  ),
                ),
              ),
            ],
          ),

        ],
      ),
    );
  }

  // Filter Dropdowns Row: Added By, Status, Locked/Unlocked (Compact, No Top Header Text, Entire Box Clickable)
  Widget _buildFilterDropdowns() {
    final List<String> rawCreators = _expenses
        .map((e) => _formatCreatorName((e['creator_name'] ?? '').toString()))
        .where((name) => name.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    final List<String> creators = [];
    if (rawCreators.contains('Admin')) {
      creators.add('Admin');
      rawCreators.remove('Admin');
    }
    creators.addAll(rawCreators);

    final Map<String, String> addedByOptions = {
      'ALL': 'All Users',
      for (final name in creators) name: name,
    };
    if (_selectedAddedBy != 'ALL' && !addedByOptions.containsKey(_selectedAddedBy)) {
      addedByOptions[_selectedAddedBy] = _selectedAddedBy;
    }

    final Map<String, String> statusOptions = {
      'ALL': 'All Statuses',
      'APPROVED': 'Approved',
      'PENDING': 'Pending',
      'REJECTED': 'Rejected',
    };

    final Map<String, String> lockOptions = {
      'ALL': 'All Locks',
      'LOCKED': 'Locked',
      'UNLOCKED': 'Unlocked',
    };

    return Row(
      children: [
        // 1. Added By Dropdown
        Expanded(
          child: _buildWholeClickableDropdown(
            context: context,
            value: _selectedAddedBy,
            items: addedByOptions,
            onChanged: (val) {
              setState(() {
                _selectedAddedBy = val;
              });
            },
          ),
        ),
        const SizedBox(width: 8),

        // 2. Status Dropdown
        Expanded(
          child: _buildWholeClickableDropdown(
            context: context,
            value: _selectedStatus,
            items: statusOptions,
            onChanged: (val) {
              setState(() {
                _selectedStatus = val;
              });
            },
          ),
        ),
        const SizedBox(width: 8),

        // 3. Locked/Unlocked Dropdown
        Expanded(
          child: _buildWholeClickableDropdown(
            context: context,
            value: _selectedLock,
            items: lockOptions,
            onChanged: (val) {
              setState(() {
                _selectedLock = val;
              });
            },
          ),
        ),
      ],
    );
  }

  // Entire compact box is clickable to open curved dropdown matching modern app design system
  Widget _buildWholeClickableDropdown({
    required BuildContext context,
    required String value,
    required Map<String, String> items,
    required ValueChanged<String> onChanged,
  }) {
    final displayText = items[value] ?? (value == 'ALL' ? 'All' : value);
    return Builder(
      builder: (btnContext) {
        return Material(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              FocusScope.of(context).unfocus();
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
                surfaceTintColor: Colors.transparent,
                elevation: 6,
                constraints: BoxConstraints(
                  minWidth: size.width < 140 ? 140 : size.width,
                  maxWidth: size.width < 220 ? 220 : size.width,
                  maxHeight: 280,
                ),
                items: items.entries.map((entry) {
                  final isSelected = entry.key == value;
                  return PopupMenuItem<String>(
                    value: entry.key,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFFEF3C7) : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              entry.value,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                color: isSelected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
                              ),
                            ),
                          ),
                          if (isSelected)
                            const Icon(Icons.check_rounded, size: 16, color: Color(0xFFD97706)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );

              if (selected != null && selected != value) {
                onChanged(selected);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      displayText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: Color(0xFF475569),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchField() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(fontSize: 13.5, color: Color(0xFF0F172A)),
        decoration: InputDecoration(
          hintText: 'Search by Description...',
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF94A3B8)),
                  onPressed: () => _searchController.clear(),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        ),
      ),
    );
  }

  Widget _buildExpenseCard(Map<String, dynamic> item) {
    final approvalStatus = (item['approval_status'] ?? 'Approved').toString();
    final isPending = approvalStatus.toLowerCase() == 'pending';
    final isRejected = approvalStatus.toLowerCase() == 'rejected';
    // Only approved expenses covered by a generated financial report OR rejected expenses are locked
    final isLocked = _isExpenseLocked(item);
    final createdBy = int.tryParse((item['created_by'] ?? '').toString()) ?? 0;
    final isCreator = (_currentUserId != null && _currentUserId != 0 && createdBy == _currentUserId);
    final billUrl = item['bill_attachment_path']?.toString();
    final creatorName = _formatCreatorName(item['creator_name']?.toString());
    final amount = double.tryParse((item['amount'] ?? 0).toString()) ?? 0.0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: Date & Amount & Status Badges
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(Icons.calendar_today_rounded, size: 13, color: Color(0xFF64748B)),
              const SizedBox(width: 5),
              Text(
                _formatDate(item['expense_date']?.toString()),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF475569),
                ),
              ),
              if (isPending) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.schedule_rounded, size: 11, color: Color(0xFFB45309)),
                      SizedBox(width: 3),
                      Text(
                        'Pending',
                        style: TextStyle(
                          color: Color(0xFFB45309),
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (isRejected) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cancel_rounded, size: 11, color: Color(0xFFDC2626)),
                      SizedBox(width: 3),
                      Text(
                        'Rejected',
                        style: TextStyle(
                          color: Color(0xFFDC2626),
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded, size: 11, color: Color(0xFF15803D)),
                      SizedBox(width: 3),
                      Text(
                        'Approved',
                        style: TextStyle(
                          color: Color(0xFF15803D),
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (isLocked) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: isRejected ? const Color(0xFFF1F5F9) : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: isRejected ? const Color(0xFFCBD5E1) : const Color(0xFFFDE68A)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.lock_rounded, size: 11, color: isRejected ? const Color(0xFF64748B) : const Color(0xFFB45309)),
                      const SizedBox(width: 3),
                      Text(
                        'Locked',
                        style: TextStyle(
                          color: isRejected ? const Color(0xFF64748B) : const Color(0xFFB45309),
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const Spacer(),
              // Amount in bold red (strike-through if rejected)
              Text(
                '₹${_formatCurrency(amount)}',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: isRejected ? const Color(0xFF94A3B8) : const Color(0xFFEF4444),
                  decoration: isRejected ? TextDecoration.lineThrough : null,
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Description
          Text(
            item['description'] ?? '',
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: isRejected ? const Color(0xFF64748B) : const Color(0xFF0F172A),
              height: 1.3,
            ),
          ),

          const SizedBox(height: 10),

          // Bottom Info: Creator, Bill Attachment, Actions
          Row(
            children: [
              if (creatorName.isNotEmpty) ...[
                const Icon(Icons.person_outline_rounded, size: 13, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    'Added by $creatorName',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ] else
                const Spacer(),

              // Bill Attachment preview button
              if (billUrl != null && billUrl.isNotEmpty) ...[
                GestureDetector(
                  onTap: () {
                    final fullUrl = billUrl.startsWith('http')
                        ? billUrl
                        : '${widget.baseUrl}${billUrl.startsWith('/') ? '' : '/'}$billUrl';
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => FullScreenImageScreen(imageUrl: fullUrl),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.attach_file_rounded, size: 13, color: Color(0xFFD97706)),
                        SizedBox(width: 3),
                        Text(
                          'Bill',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],

              // Approve & Reject buttons for School Admin when expense is pending
              if (_isSchoolAdmin && isPending) ...[
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.check_rounded, size: 14),
                  label: const Text(
                    'Approve',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () => _confirmApproveExpense(item),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFEE2E2),
                    foregroundColor: const Color(0xFFDC2626),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.close_rounded, size: 14, color: Color(0xFFDC2626)),
                  label: const Text(
                    'Reject',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                  ),
                  onPressed: () => _confirmRejectExpense(item),
                ),
                const SizedBox(width: 8),
              ],

              // Delete button or Locked indicator:
              // Only Creator can delete their expense (when not locked and not rejected).
              // Rejected expenses are locked and cannot be deleted.
              if (isLocked)
                Tooltip(
                  message: isRejected
                      ? 'This expense was rejected and cannot be deleted.'
                      : 'This expense is locked in a financial report and cannot be deleted.',
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock_outline_rounded, size: 12, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 3),
                        Text(
                          isRejected ? 'Locked' : 'In Report',
                          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                )
              else if (isCreator)
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFEF4444)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  tooltip: 'Delete Expense',
                  onPressed: () => _confirmDeleteExpense(item),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
      margin: const EdgeInsets.only(top: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFFFEF3C7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.receipt_long_outlined, size: 36, color: Color(0xFFD97706)),
          ),
          const SizedBox(height: 14),
          const Text(
            'No expense entries logged.',
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF334155),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _errorMessage,
              style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
          ),
          TextButton(
            onPressed: _loadExpenses,
            child: const Text('Retry', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Add Expense Bottom Sheet Modal (Simplified: Description, Amount, Date, Bill)
// ---------------------------------------------------------------------------
class _AddExpenseBottomSheet extends StatefulWidget {
  final ExpenseService expenseService;
  final ValueChanged<Map<String, dynamic>> onExpenseAdded;

  const _AddExpenseBottomSheet({
    required this.expenseService,
    required this.onExpenseAdded,
  });

  @override
  State<_AddExpenseBottomSheet> createState() => _AddExpenseBottomSheetState();
}

class _AddExpenseBottomSheetState extends State<_AddExpenseBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _descController = TextEditingController();
  final TextEditingController _amountController = TextEditingController();

  late DateTime _selectedDate;

  File? _pickedFile;
  String? _uploadedBillUrl;
  bool _isUploadingFile = false;
  bool _isSubmitting = false;
  String _formError = '';

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
  }

  @override
  void dispose() {
    _descController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  String _formatDateYmd(DateTime d) {
    final y = d.year.toString();
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  String _formatDateDmy(DateTime d) {
    final y = d.year.toString();
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$day/$m/$y';
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFD97706),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _pickBillFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    );

    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      setState(() {
        _pickedFile = file;
        _isUploadingFile = true;
        _formError = '';
      });

      try {
        final url = await widget.expenseService.uploadBillAttachment(file);
        if (mounted) {
          setState(() {
            _uploadedBillUrl = url;
            _isUploadingFile = false;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isUploadingFile = false;
            _pickedFile = null;
            _uploadedBillUrl = null;
            _formError = 'Failed to upload bill receipt: ${e.toString().replaceAll('Exception:', '').trim()}';
          });
        }
      }
    }
  }

  Future<void> _submitExpense() async {
    if (!_formKey.currentState!.validate()) return;

    final amountVal = double.tryParse(_amountController.text.trim());
    if (amountVal == null || amountVal <= 0) {
      setState(() {
        _formError = 'Please enter a valid amount greater than 0';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _formError = '';
    });

    try {
      final res = await widget.expenseService.createExpense(
        description: _descController.text.trim(),
        amount: amountVal,
        expenseDate: _formatDateYmd(_selectedDate),
        billAttachmentPath: _uploadedBillUrl,
      );

      if (mounted) {
        widget.onExpenseAdded(res);
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _formError = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD97706).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFD97706), size: 20),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Record School Expense',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Scrollable Form content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_formError.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _formError,
                                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Description Field
                    const Text(
                      'DESCRIPTION *',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569), letterSpacing: 0.3),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _descController,
                      validator: (val) {
                        if (val == null || val.trim().length < 3) {
                          return 'Description must be at least 3 characters.';
                        }
                        return null;
                      },
                      style: const TextStyle(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'e.g., Office stationery, Electrician repair, Sports kits',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Amount & Date in a 2-column row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Amount
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'AMOUNT (₹) *',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569), letterSpacing: 0.3),
                              ),
                              const SizedBox(height: 6),
                              TextFormField(
                                controller: _amountController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                validator: (val) {
                                  if (val == null || val.trim().isEmpty) return 'Enter amount';
                                  final numVal = double.tryParse(val.trim());
                                  if (numVal == null || numVal <= 0) return 'Must be > 0';
                                  return null;
                                },
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFEF4444)),
                                decoration: InputDecoration(
                                  prefixText: '₹ ',
                                  prefixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFEF4444), fontSize: 14),
                                  hintText: '0.00',
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5)),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Date Picker
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'EXPENSE DATE *',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569), letterSpacing: 0.3),
                              ),
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: _pickDate,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.calendar_month_rounded, size: 18, color: Color(0xFFD97706)),
                                      const SizedBox(width: 8),
                                      Text(
                                        _formatDateDmy(_selectedDate),
                                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // Bill Attachment (Optional)
                    const Text(
                      'BILL / INVOICE ATTACHMENT (OPTIONAL)',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569), letterSpacing: 0.3),
                    ),
                    const SizedBox(height: 6),
                    if (_isUploadingFile)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: const Row(
                          children: [
                            SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706))),
                            SizedBox(width: 12),
                            Text('Uploading bill attachment...', style: TextStyle(fontSize: 12.5, color: Color(0xFF475569))),
                          ],
                        ),
                      )
                    else if (_pickedFile != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.description_rounded, size: 20, color: Color(0xFFD97706)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _pickedFile!.path.split(Platform.pathSeparator).last,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFFEF4444)),
                              onPressed: () {
                                setState(() {
                                  _pickedFile = null;
                                  _uploadedBillUrl = null;
                                });
                              },
                            ),
                          ],
                        ),
                      )
                    else
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF475569),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        icon: const Icon(Icons.attach_file_rounded, size: 18, color: Color(0xFFD97706)),
                        label: const Text('Attach Bill Image or PDF', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        onPressed: _pickBillFile,
                      ),

                    const SizedBox(height: 24),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 1,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: (_isSubmitting || _isUploadingFile) ? null : _submitExpense,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'RECORD EXPENSE',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14.5,
                                  letterSpacing: 0.5,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
