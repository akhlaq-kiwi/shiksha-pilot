import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:school_hub/services/fee_service.dart';

class FeesCollectionHistoryScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const FeesCollectionHistoryScreen({
    super.key,
    required this.baseUrl,
    required this.token,
  });

  @override
  State<FeesCollectionHistoryScreen> createState() => _FeesCollectionHistoryScreenState();
}

class _FeesCollectionHistoryScreenState extends State<FeesCollectionHistoryScreen> {
  late FeeService _feeService;

  bool _isLoading = true;
  bool _isLoadingMore = false;
  String _errorMessage = '';

  List<dynamic> _transactions = [];
  Map<String, dynamic> _stats = {
    'total_collected': 0,
    'today_collection': 0,
    'this_month_collection': 0,
    'total_transactions': 0,
  };

  List<String> _availablePeriods = ['ALL TIME', 'SINCE LAST REPORT'];
  List<Map<String, dynamic>> _availableCollectors = [
    {'name': 'All Users', 'display_name': 'All Users', 'phone': '', 'label': 'All Users'}
  ];

  String _selectedPeriod = 'ALL TIME';
  String _selectedCollector = 'All Users';
  String _searchQuery = '';

  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  Timer? _debounceTimer;

  int _currentPage = 1;
  int _totalPages = 1;
  final int _pageSize = 20;

  @override
  void initState() {
    super.initState();
    _feeService = FeeService(baseUrl: widget.baseUrl, token: widget.token);
    _scrollController.addListener(_onScroll);
    _loadHistory(reset: true);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoading && !_isLoadingMore && _currentPage < _totalPages) {
        _loadHistory(reset: false);
      }
    }
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      if (mounted) {
        setState(() {
          _searchQuery = value.trim();
        });
        _loadHistory(reset: true);
      }
    });
  }

  Future<void> _loadHistory({bool reset = false}) async {
    if (reset) {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
        _currentPage = 1;
      });
    } else {
      setState(() {
        _isLoadingMore = true;
      });
    }

    try {
      final nextPage = reset ? 1 : _currentPage + 1;
      final res = await _feeService.getCollectionHistory(
        period: _selectedPeriod,
        depositBy: _selectedCollector,
        search: _searchQuery,
        page: nextPage,
        limit: _pageSize,
      );

      final newTx = (res['transactions'] as List<dynamic>?) ?? [];
      final rawStats = (res['stats'] as Map<String, dynamic>?) ?? {};
      final rawPagination = (res['pagination'] as Map<String, dynamic>?) ?? {};

      // Parse available periods
      final rawPeriods = (res['available_periods'] ?? res['available_months']) as List<dynamic>?;
      if (rawPeriods != null && rawPeriods.isNotEmpty) {
        final parsedPeriods = rawPeriods.map((p) => p.toString()).toList();
        if (!parsedPeriods.contains('ALL TIME')) parsedPeriods.insert(0, 'ALL TIME');
        if (!parsedPeriods.contains('SINCE LAST REPORT')) parsedPeriods.insert(1, 'SINCE LAST REPORT');
        _availablePeriods = parsedPeriods;
      }

      // Parse available collectors
      final rawCollectors = res['available_collectors'] as List<dynamic>?;
      if (rawCollectors != null && rawCollectors.isNotEmpty) {
        _availableCollectors = rawCollectors.map((c) {
          if (c is Map) {
            return {
              'name': c['name']?.toString() ?? '',
              'display_name': c['display_name']?.toString() ?? c['name']?.toString() ?? '',
              'phone': c['phone']?.toString() ?? '',
              'label': c['label']?.toString() ?? c['display_name']?.toString() ?? c['name']?.toString() ?? '',
            };
          }
          return {
            'name': c.toString(),
            'display_name': c.toString(),
            'phone': '',
            'label': c.toString(),
          };
        }).toList();
      }

      setState(() {
        if (reset) {
          _transactions = newTx;
        } else {
          // Avoid duplicate rows
          final existingIds = _transactions.map((t) => '${t['type']}-${t['id']}').toSet();
          for (final item in newTx) {
            if (!existingIds.contains('${item['type']}-${item['id']}')) {
              _transactions.add(item);
            }
          }
        }
        _stats = rawStats;
        _currentPage = rawPagination['page'] is int ? rawPagination['page'] : nextPage;
        _totalPages = rawPagination['pages'] is int ? rawPagination['pages'] : 1;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isLoadingMore = false;
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  String _formatCurrency(num value) {
    final intVal = value.round();
    final isNegative = intVal < 0;
    final absVal = intVal.abs();
    final str = absVal.toString();
    if (str.length <= 3) {
      return '${isNegative ? '-' : ''}₹$str';
    }
    final last3 = str.substring(str.length - 3);
    var remaining = str.substring(0, str.length - 3);
    final chunks = <String>[];
    while (remaining.isNotEmpty) {
      if (remaining.length > 2) {
        chunks.insert(0, remaining.substring(remaining.length - 2));
        remaining = remaining.substring(0, remaining.length - 2);
      } else {
        chunks.insert(0, remaining);
        remaining = '';
      }
    }
    return '${isNegative ? '-' : ''}₹${chunks.join(',')},$last3';
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.trim().isEmpty) return '—';
    try {
      final dt = DateTime.parse(dateStr.replaceFirst(' ', 'T')).toLocal();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null || timeStr.trim().isEmpty) return '';
    try {
      final dt = DateTime.parse(timeStr.replaceFirst(' ', 'T')).toLocal();
      final hour = dt.hour;
      final minute = dt.minute.toString().padLeft(2, '0');
      final period = hour >= 12 ? 'PM' : 'AM';
      final h12 = hour % 12 == 0 ? 12 : hour % 12;
      return '$h12:$minute $period';
    } catch (_) {
      return '';
    }
  }

  String _cleanStudentName(String? name) {
    if (name == null || name.trim().isEmpty) return 'Unknown Student';
    final trimmed = name.trim();
    return trimmed.endsWith('.') ? trimmed.substring(0, trimmed.length - 1).trim() : trimmed;
  }

  void _showCollectorSelector() {
    HapticFeedback.lightImpact();
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
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.person_outline_rounded, size: 20, color: Color(0xFFB45309)),
                    SizedBox(width: 8),
                    Text(
                      'Filter by Deposit By',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _availableCollectors.length,
                  itemBuilder: (context, idx) {
                    final c = _availableCollectors[idx];
                    final name = c['name'] ?? '';
                    final label = c['label'] ?? name;
                    final phone = c['phone'] ?? '';
                    final isSelected = _selectedCollector == name;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: isSelected ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                        child: Icon(
                          name == 'ADMIN'
                              ? Icons.admin_panel_settings_rounded
                              : name == 'All Users'
                                  ? Icons.groups_rounded
                                  : Icons.person_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF64748B),
                        ),
                      ),
                      title: Text(
                        label,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
                        ),
                      ),
                      subtitle: phone.isNotEmpty && phone != label
                          ? Text(
                              phone,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            )
                          : null,
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: Color(0xFFD97706), size: 20)
                          : null,
                      onTap: () {
                        Navigator.pop(ctx);
                        if (_selectedCollector != name) {
                          setState(() {
                            _selectedCollector = name;
                          });
                          _loadHistory(reset: true);
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

  void _showPeriodSelector() {
    HapticFeedback.lightImpact();
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
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: const [
                    Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFB45309)),
                    SizedBox(width: 8),
                    Text(
                      'Filter by Period',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
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
                          Icons.access_time_filled_rounded,
                          size: 18,
                          color: isSelected ? const Color(0xFFD97706) : const Color(0xFF64748B),
                        ),
                      ),
                      title: Text(
                        p,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
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
                          });
                          _loadHistory(reset: true);
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

  @override
  Widget build(BuildContext context) {
    final num totalCollected = _stats['total_collected'] ?? 0;
    final num periodCollection = _stats['this_month_collection'] ?? totalCollected;
    final int totalCount = _stats['total_transactions'] ?? _transactions.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                color: Color(0xFFD97706),
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'COLLECTION HISTORY',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 17,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Refresh',
            onPressed: () => _loadHistory(reset: true),
          ),
        ],
      ),
      body: Column(
        children: [
          // Top Stats Summary Bar
          _buildSummaryBar(totalCollected, periodCollection, totalCount),

          // Filters Section (Search + Deposit By + Period)
          _buildFilterControls(),

          // Transactions List / States
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706)),
                    ),
                  )
                : _errorMessage.isNotEmpty
                    ? _buildErrorView()
                    : _transactions.isEmpty
                        ? _buildEmptyView()
                        : RefreshIndicator(
                            onRefresh: () => _loadHistory(reset: true),
                            color: const Color(0xFFD97706),
                            child: ListView.separated(
                              controller: _scrollController,
                              padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
                              itemCount: _transactions.length + (_isLoadingMore ? 1 : 0),
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                if (index == _transactions.length) {
                                  return const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 16),
                                    child: Center(
                                      child: SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.5,
                                          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706)),
                                        ),
                                      ),
                                    ),
                                  );
                                }
                                return _buildTransactionCard(_transactions[index]);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryBar(num totalCollected, num periodCollection, int totalCount) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFBEB), Color(0xFFFEF3C7)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFCD34D), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Total Collection stat
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _selectedPeriod == 'ALL TIME' ? 'TOTAL COLLECTION' : 'PERIOD COLLECTION',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFB45309),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 3),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _formatCurrency(_selectedPeriod == 'ALL TIME' ? totalCollected : periodCollection),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF92400E),
                      letterSpacing: -0.3,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Total Transactions Count Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.receipt_rounded, size: 14, color: Color(0xFF92400E)),
                const SizedBox(width: 5),
                Text(
                  '$totalCount Records',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF92400E),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterControls() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        children: [
          // Search Bar
          Container(
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              textAlignVertical: TextAlignVertical.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Search student, receipt, class...',
                hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                prefixIcon: const Icon(Icons.search_rounded, size: 19, color: Color(0xFF94A3B8)),
                prefixIconConstraints: const BoxConstraints(minWidth: 38, minHeight: 42),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 42),
                        icon: const Icon(Icons.clear_rounded, size: 17, color: Color(0xFF64748B)),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Filter Dropdowns Row (Deposit By & Filter Period)
          Row(
            children: [
              // 1. Deposit By Filter Pill
              Expanded(
                child: InkWell(
                  onTap: _showCollectorSelector,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: _selectedCollector != 'All Users' ? const Color(0xFFFEF3C7) : Colors.white,
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
                          size: 15,
                          color: _selectedCollector != 'All Users'
                              ? const Color(0xFFB45309)
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            _selectedCollector == 'All Users'
                                ? 'Deposit By'
                                : _selectedCollector,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: _selectedCollector != 'All Users'
                                  ? const Color(0xFFB45309)
                                  : const Color(0xFF334155),
                            ),
                          ),
                        ),
                        Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 17,
                          color: _selectedCollector != 'All Users'
                              ? const Color(0xFFB45309)
                              : const Color(0xFF94A3B8),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // 2. Filter Period Pill
              Expanded(
                child: InkWell(
                  onTap: _showPeriodSelector,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: _selectedPeriod != 'ALL TIME' ? const Color(0xFFFEF3C7) : Colors.white,
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
                          Icons.calendar_month_rounded,
                          size: 15,
                          color: _selectedPeriod != 'ALL TIME'
                              ? const Color(0xFFB45309)
                              : const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            _selectedPeriod,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: _selectedPeriod != 'ALL TIME'
                                  ? const Color(0xFFB45309)
                                  : const Color(0xFF334155),
                            ),
                          ),
                        ),
                        Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 17,
                          color: _selectedPeriod != 'ALL TIME'
                              ? const Color(0xFFB45309)
                              : const Color(0xFF94A3B8),
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
    );
  }

  /// Individual Transaction Card
  /// Columns strictly shown:
  /// 1. Deposit by
  /// 2. Date & Time
  /// 3. Class
  /// 4. Description
  /// 5. Amount (Strictly deposited amount only!)
  /// Individual Transaction Card
  Widget _buildTransactionCard(Map<String, dynamic> tx) {
    final bool isAdmin = tx['is_admin_collector'] == true;
    final String depositBy = isAdmin
        ? 'ADMIN'
        : (tx['display_collector_name']?.toString() ?? tx['collected_by']?.toString() ?? 'ADMIN');
    final String collectorPhone = tx['collector_phone']?.toString().trim() ?? '';
    final String displayDepositBy = collectorPhone.isNotEmpty
        ? '$depositBy ($collectorPhone)'
        : depositBy;

    final String paymentDate = _formatDate(tx['payment_date']?.toString());
    final String paymentTime = _formatTime(tx['created_at']?.toString());
    final String formattedDateTime = paymentTime.isNotEmpty
        ? '$paymentDate ($paymentTime)'
        : paymentDate;

    final String className = tx['class_name']?.toString() ?? 'N/A';
    final String rollNo = (tx['student_roll_no']?.toString().trim() ?? tx['roll_no']?.toString().trim() ?? '');
    final String displayRollNo = rollNo.isNotEmpty ? rollNo : '—';
    final String description = tx['fee_name']?.toString() ?? 'Tuition Fee';
    final num amount = (tx['amount'] is num) ? tx['amount'] : (double.tryParse(tx['amount']?.toString() ?? '0') ?? 0);

    final String studentName = _cleanStudentName(tx['student_name']?.toString());
    String receiptNo = tx['receipt_no']?.toString().trim() ?? tx['id']?.toString() ?? '—';
    if (receiptNo.length == 15 && RegExp(r'^\d{15}$').hasMatch(receiptNo)) {
      receiptNo = receiptNo.substring(0, 12);
    }
    final String paymentMethod = tx['payment_method']?.toString().trim() ?? 'Cash';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header Row: ONLY Student Name (left) and Amount Badge (right)
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  studentName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Text(
                  '+ ${_formatCurrency(amount)}',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF059669),
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // 2. Details Box: Formatted Key-Value Rows (No line wrapping)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFEDF2F7)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDetailRow('Class', className),
                _buildDetailRow('Roll No', displayRollNo),
                _buildDetailRow('Description', description),
                _buildDetailRow('Date & Time', formattedDateTime),
                _buildDetailRow('Ref No.', receiptNo, isMonospace: true),
                _buildDetailRow('Deposit By', displayDepositBy),
                _buildDetailRow('Payment Type', paymentMethod),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(
    String label,
    String value, {
    Widget? customValue,
    bool isMonospace = false,
    bool alignRight = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            '$label - ',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          if (alignRight) const Spacer(),
          if (customValue != null)
            customValue
          else
            Expanded(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0F172A),
                  fontFamily: isMonospace ? 'monospace' : null,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                size: 40,
                color: Color(0xFFD97706),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No Collection History Found',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'No fee collection transactions were recorded matching the selected filter criteria.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.5,
                color: Color(0xFF64748B),
                height: 1.4,
              ),
            ),
            if (_selectedPeriod != 'ALL TIME' || _selectedCollector != 'All Users' || _searchQuery.isNotEmpty) ...[
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () {
                  setState(() {
                    _selectedPeriod = 'ALL TIME';
                    _selectedCollector = 'All Users';
                    _searchQuery = '';
                    _searchController.clear();
                  });
                  _loadHistory(reset: true);
                },
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Reset All Filters'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB45309),
                  side: const BorderSide(color: Color(0xFFFCD34D)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: Colors.red, size: 44),
            const SizedBox(height: 12),
            Text(
              _errorMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _loadHistory(reset: true),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
