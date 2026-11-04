import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../services/fee_service.dart';
import '../utils/class_formatter.dart';

class ClassFeeGroup {
  final String name;
  final String primaryId;
  final List<String> allIds;
  final bool isConfigured;
  final dynamic config;

  ClassFeeGroup({
    required this.name,
    required this.primaryId,
    required this.allIds,
    required this.isConfigured,
    this.config,
  });
}

class ManageFinanceFeesScreen extends StatefulWidget {
  final FeeService feeService;

  const ManageFinanceFeesScreen({Key? key, required this.feeService}) : super(key: key);

  @override
  State<ManageFinanceFeesScreen> createState() => _ManageFinanceFeesScreenState();
}

class _ManageFinanceFeesScreenState extends State<ManageFinanceFeesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isLoading = true;
  String _errorMessage = '';

  // Data
  List<dynamic> _feeTypes = [];
  List<dynamic> _transportFees = [];
  List<dynamic> _classes = [];
  List<dynamic> _students = [];
  List<dynamic> _academicYears = [];
  List<dynamic> _classFeeConfigs = [];
  List<dynamic> _classCourseFeeConfigs = [];

  // Tab 4: Monthly Fee State
  String? _monthlySelectedShortName;
  final TextEditingController _monthlyAmountController = TextEditingController();
  bool _monthlySaving = false;
  String _monthlySuccessMessage = '';
  String _monthlyErrorMessage = '';
  bool _downloadingMonthlyPdf = false;

  // Tab 5: Course Fee State
  String? _courseSelectedShortName;
  final TextEditingController _courseAmountController = TextEditingController();
  bool _courseSaving = false;
  String _courseSuccessMessage = '';
  String _courseErrorMessage = '';
  bool _downloadingCoursePdf = false;

  // Search & Filters
  String _additionalFeeSearch = '';
  final TextEditingController _transportSearchController = TextEditingController();
  String _transportSearch = '';
  String _transportStatusFilter = 'All'; // 'All' | 'Active' | 'Inactive'

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadAllData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _monthlyAmountController.dispose();
    _courseAmountController.dispose();
    _transportSearchController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final years = await widget.feeService.getAcademicYears();
      int? activeYearId;
      for (final y in years) {
        if (y['is_current'] == true || y['is_current'] == 1 || y['is_current'] == '1') {
          activeYearId = y['id'] is int ? y['id'] : int.tryParse(y['id'].toString());
          break;
        }
      }
      activeYearId ??= years.isNotEmpty
          ? (years.first['id'] is int ? years.first['id'] : int.tryParse(years.first['id'].toString()))
          : null;

      final results = await Future.wait([
        widget.feeService.getAdditionalFeeTypes(),
        widget.feeService.getTransportFees(),
        widget.feeService.getClasses(),
        widget.feeService.getStudents(limit: 1000),
        widget.feeService.getClassFeeConfigurations(academicYearId: activeYearId),
        widget.feeService.getClassCourseFeeConfigurations(academicYearId: activeYearId),
      ]);

      if (mounted) {
        setState(() {
          _academicYears = years;
          _feeTypes = results[0];
          _transportFees = results[1];
          _classes = results[2];
          _students = results[3];
          _classFeeConfigs = results[4];
          _classCourseFeeConfigs = results[5];
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

  Future<void> _reloadTransportFees() async {
    try {
      final list = await widget.feeService.getTransportFees(status: _transportStatusFilter);
      if (mounted) {
        setState(() {
          _transportFees = list;
        });
      }
    } catch (_) {}
  }

  Future<void> _reloadFeeTypes() async {
    try {
      final list = await widget.feeService.getAdditionalFeeTypes();
      if (mounted) {
        setState(() {
          _feeTypes = list;
        });
      }
    } catch (_) {}
  }

  Future<void> _reloadMonthlyFeeConfigs() async {
    try {
      final activeYear = _getCurrentAcademicYear();
      final activeYearId = activeYear != null
          ? (activeYear['id'] is int ? activeYear['id'] : int.tryParse(activeYear['id'].toString()))
          : null;
      final list = await widget.feeService.getClassFeeConfigurations(academicYearId: activeYearId);
      if (mounted) {
        setState(() {
          _classFeeConfigs = list;
        });
      }
    } catch (_) {}
  }

  Future<void> _reloadCourseFeeConfigs() async {
    try {
      final activeYear = _getCurrentAcademicYear();
      final activeYearId = activeYear != null
          ? (activeYear['id'] is int ? activeYear['id'] : int.tryParse(activeYear['id'].toString()))
          : null;
      final list = await widget.feeService.getClassCourseFeeConfigurations(academicYearId: activeYearId);
      if (mounted) {
        setState(() {
          _classCourseFeeConfigs = list;
        });
      }
    } catch (_) {}
  }

  Map<String, dynamic>? _getCurrentAcademicYear() {
    for (final y in _academicYears) {
      if (y['is_current'] == true || y['is_current'] == 1 || y['is_current'] == '1') {
        return y as Map<String, dynamic>;
      }
    }
    if (_academicYears.isNotEmpty) {
      return _academicYears.first as Map<String, dynamic>;
    }
    return null;
  }

  List<ClassFeeGroup> _getUniqueClassFeeGroups({required bool isCourse}) {
    final Map<String, List<dynamic>> groupMap = {};
    for (final c in _classes) {
      final rawName = (c['name'] ?? '').toString().trim();
      if (rawName.isEmpty) continue;
      final shortName = formatShortClassName(rawName);
      groupMap.putIfAbsent(shortName, () => []).add(c);
    }

    final configs = isCourse ? _classCourseFeeConfigs : _classFeeConfigs;

    final List<ClassFeeGroup> list = [];
    for (final entry in groupMap.entries) {
      final shortName = entry.key;
      final items = entry.value;
      final allIds = items.map((i) => i['id'].toString()).toList();
      final primaryId = allIds.isNotEmpty ? allIds.first : '';

      dynamic matchedConfig;
      bool isConfigured = false;

      for (final cfg in configs) {
        final cfgClassId = cfg['class_id']?.toString() ?? '';
        if (allIds.contains(cfgClassId)) {
          isConfigured = true;
          matchedConfig = cfg;
          break;
        }
        final matchedClass = _classes.firstWhere(
          (cl) => cl['id']?.toString() == cfgClassId,
          orElse: () => null,
        );
        if (matchedClass != null && formatShortClassName(matchedClass['name']) == shortName) {
          isConfigured = true;
          matchedConfig = cfg;
          break;
        }
      }

      list.add(ClassFeeGroup(
        name: shortName,
        primaryId: primaryId,
        allIds: allIds,
        isConfigured: isConfigured,
        config: matchedConfig,
      ));
    }

    list.sort((a, b) => getClassSortRank(a.name).compareTo(getClassSortRank(b.name)));
    return list;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  List<Map<String, dynamic>> _getUniqueClasses() {
    final Map<String, Map<String, dynamic>> classMap = {};
    for (final c in _classes) {
      final name = (c['name'] ?? '').toString().trim();
      if (name.isEmpty) continue;
      if (!classMap.containsKey(name)) {
        classMap[name] = {
          'name': name,
          'ids': [c['id']],
          'displayName': formatShortClassName(name),
        };
      } else {
        (classMap[name]!['ids'] as List).add(c['id']);
      }
    }
    final list = classMap.values.toList();
    list.sort((a, b) => getClassSortRank(a['name']).compareTo(getClassSortRank(b['name'])));
    return list;
  }

  String _formatCurrency(dynamic amount) {
    if (amount == null) return '₹0';
    final num val = amount is num ? amount : (num.tryParse(amount.toString()) ?? 0);
    final isNegative = val < 0;
    final absVal = val.abs().round();
    final str = absVal.toString();
    if (str.length <= 3) return '${isNegative ? '-' : ''}₹$str';
    final last3 = str.substring(str.length - 3);
    final remaining = str.substring(0, str.length - 3);
    final chunks = <String>[];
    for (int i = remaining.length; i > 0; i -= 2) {
      final start = (i - 2) < 0 ? 0 : i - 2;
      chunks.insert(0, remaining.substring(start, i));
    }
    return '${isNegative ? '-' : ''}₹${chunks.join(',')},$last3';
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null || dateStr.toString().trim().isEmpty) return '—';
    try {
      final dt = DateTime.parse(dateStr.toString().trim().split(' ')[0]);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateStr.toString();
    }
  }

  String _getLocalDateString() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  // Filtered Additional Fee Types (excluding internal types)
  List<dynamic> get _filteredAdditionalFees {
    return _feeTypes.where((ft) {
      final name = (ft['name'] ?? '').toString();
      final cat = (ft['category'] ?? '').toString();
      if (name == 'Transport Fees' || name == 'Admission Fee' || cat == 'System Generated') {
        return false;
      }
      if (_additionalFeeSearch.trim().isEmpty) return true;

      final queryWords = _additionalFeeSearch.toLowerCase().trim().split(RegExp(r'\s+'));
      final feeName = name.toLowerCase();
      return queryWords.every((w) => feeName.contains(w));
    }).toList();
  }

  // Applied Annual Fee (if any)
  dynamic get _appliedAnnualFee {
    try {
      return _feeTypes.firstWhere((ft) {
        final name = (ft['name'] ?? '').toString().trim().toLowerCase();
        final cat = (ft['category'] ?? '').toString().trim().toLowerCase();
        return name == 'annual fee' || cat == 'annual fee';
      });
    } catch (_) {
      return null;
    }
  }

  // Filtered Transport Fees
  List<dynamic> get _filteredTransportFees {
    return _transportFees.where((tf) {
      final status = (tf['status'] ?? '').toString();
      final matchesStatus = _transportStatusFilter == 'All' || status == _transportStatusFilter;
      if (!matchesStatus) return false;

      if (_transportSearch.trim().isEmpty) return true;

      final queryWords = _transportSearch.toLowerCase().trim().split(RegExp(r'\s+'));
      final stuName = (tf['student_name'] ?? '').toString().toLowerCase();
      final admNo = (tf['admission_no'] ?? tf['sr_no'] ?? '').toString().toLowerCase();
      return queryWords.every((w) => stuName.contains(w) || admNo.contains(w));
    }).toList();
  }

  // ---------------------------------------------------------------------------
  // Build Screen
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Icon(Icons.account_balance_rounded, color: Color(0xFFD97706), size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'MANAGE FEES',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 16,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFD97706),
          indicatorWeight: 3,
          labelColor: const Color(0xFFD97706),
          unselectedLabelColor: const Color(0xFF64748B),
          labelPadding: const EdgeInsets.symmetric(horizontal: 2),
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: -0.3),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11, letterSpacing: -0.3),
          tabs: const [
            Tab(text: 'ADDITIONAL', icon: Icon(Icons.local_offer_outlined, size: 17)),
            Tab(text: 'ANNUAL', icon: Icon(Icons.calendar_month_outlined, size: 17)),
            Tab(text: 'TRANSPORT', icon: Icon(Icons.directions_bus_outlined, size: 17)),
            Tab(text: 'MONTHLY', icon: Icon(Icons.event_repeat_rounded, size: 17)),
            Tab(text: 'COURSE', icon: Icon(Icons.school_outlined, size: 17)),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706)),
              ),
            )
          : _errorMessage.isNotEmpty
              ? _buildErrorView()
              : TabBarView(
                  controller: _tabController,
                  physics: const BouncingScrollPhysics(),
                  children: [
                    _buildAdditionalFeeTab(),
                    _buildAnnualFeeTab(),
                    _buildTransportFeeTab(),
                    _buildMonthlyFeeTab(),
                    _buildCourseFeeTab(),
                  ],
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
            const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 48),
            const SizedBox(height: 12),
            Text(
              _errorMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF475569), fontSize: 14),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _loadAllData,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 1: ADDITIONAL FEE
  // ===========================================================================

  Widget _buildAdditionalFeeTab() {
    final fees = _filteredAdditionalFees;
    return RefreshIndicator(
      onRefresh: _reloadFeeTypes,
      color: const Color(0xFFD97706),
      child: Column(
        children: [
          // Search & Add Action Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: TextField(
                      onChanged: (val) {
                        setState(() {
                          _additionalFeeSearch = val;
                        });
                      },
                      style: const TextStyle(fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Search by Fee Description...',
                        hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton.icon(
                  onPressed: () => _openApplyAdditionalFeeModal(),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Add Fee'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),

          // List of Fees
          Expanded(
            child: fees.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 100.0),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.local_offer_outlined, size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              Text(
                                _additionalFeeSearch.trim().isEmpty
                                    ? 'No additional fees created.'
                                    : 'No additional fees matching search.',
                                style: TextStyle(color: Colors.grey.shade600, fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: fees.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final ft = fees[index];
                      return _buildAdditionalFeeCard(ft);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildAdditionalFeeCard(dynamic ft) {
    final name = (ft['name'] ?? '').toString();
    final assignedTo = (ft['assigned_to'] ?? 'For All Classes').toString();
    final dueDate = ft['due_date'];
    final amount = ft['amount'];
    final isAnnual = name.trim().toLowerCase() == 'annual fee';
    final totalAmount = ft['total_amount'];
    final collectedAmount = ft['collected_amount'];
    final pendingAmount = ft['pending_amount'];
    final collectedStudents = int.tryParse((ft['collected_students'] ?? 0).toString()) ?? 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (isAnnual) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'ANNUAL',
                              style: TextStyle(
                                color: Color(0xFF92400E),
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Assigned: $assignedTo',
                      style: const TextStyle(
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF64748B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                color: Colors.white,
                elevation: 4,
                onSelected: (val) {
                  if (val == 'view') {
                    _openFeeDetailsModal(ft);
                  } else if (val == 'edit') {
                    _openEditFeeModal(ft);
                  } else if (val == 'delete') {
                    _confirmDeleteFee(ft);
                  }
                },
                itemBuilder: (ctx) => [
                  const PopupMenuItem(
                    value: 'view',
                    child: Row(
                      children: [
                        Icon(Icons.visibility_outlined, size: 18, color: Color(0xFF475569)),
                        SizedBox(width: 10),
                        Text('View Details', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  if (!isAnnual) ...[
                    const PopupMenuItem(
                      value: 'edit',
                      child: Row(
                        children: [
                          Icon(Icons.edit_outlined, size: 18, color: Color(0xFF475569)),
                          SizedBox(width: 10),
                          Text('Edit', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(Icons.delete_outline_rounded, size: 18, color: Colors.redAccent),
                          SizedBox(width: 10),
                          Text('Delete', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.redAccent)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),

          const Divider(height: 20, color: Color(0xFFF1F5F9)),

          // Info row: Due Date & Amount
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 6),
                  Text(
                    'Due: ${_formatDate(dueDate)}',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              Text(
                _formatCurrency(amount),
                style: const TextStyle(
                  color: Color(0xFFD97706),
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ],
          ),

          // Mini summary bar (if stats available)
          if (totalAmount != null || collectedAmount != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Collected: ${_formatCurrency(collectedAmount ?? 0)}',
                    style: const TextStyle(
                      color: Color(0xFF16A34A),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Pending: ${_formatCurrency(pendingAmount ?? 0)}',
                    style: const TextStyle(
                      color: Color(0xFFDC2626),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Paid: $collectedStudents',
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 2: ANNUAL FEE
  // ===========================================================================

  Widget _buildAnnualFeeTab() {
    final annualFee = _appliedAnnualFee;

    return RefreshIndicator(
      onRefresh: _reloadFeeTypes,
      color: const Color(0xFFD97706),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Annual Fee can be applied once per academic session either for the entire school or class-wise. Once applied, it cannot be modified or deleted. New admissions in current academic session will automatically be excluded.',
                    style: TextStyle(
                      color: Color(0xFF92400E),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // If Annual Fee already applied
          if (annualFee != null) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFF86EFAC)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.green.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 14),
                            SizedBox(width: 4),
                            Text(
                              'APPLIED FOR CURRENT SESSION',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        _formatCurrency(annualFee['amount']),
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Annual Fee',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Assigned To: ${annualFee['assigned_to'] ?? 'For All Classes'}',
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Due Date: ${_formatDate(annualFee['due_date'])}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                  const Divider(height: 24),

                  // Summary metrics
                  Row(
                    children: [
                      Expanded(
                        child: _buildMetricTile(
                          'Total',
                          _formatCurrency(annualFee['total_amount'] ?? 0),
                          const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricTile(
                          'Collected',
                          _formatCurrency(annualFee['collected_amount'] ?? 0),
                          const Color(0xFF16A34A),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildMetricTile(
                          'Pending',
                          _formatCurrency(annualFee['pending_amount'] ?? 0),
                          const Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),

                  // Class wise breakdown if present
                  if (annualFee['class_amounts'] != null && (annualFee['class_amounts'] as List).isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Class-Wise Allocation',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: (annualFee['class_amounts'] as List).map<Widget>((ca) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  formatShortClassName(ca['class_name']?.toString()),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  _formatCurrency(ca['amount']),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFD97706)),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],

                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.lock_rounded, size: 16, color: Color(0xFF64748B)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Annual Fee cannot be edited or deleted once applied.',
                            style: TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            // Empty state card with action button
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 36),
              child: Column(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Icon(Icons.school_rounded, color: Color(0xFFD97706), size: 28),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Annual Fee Configured',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'You haven\'t applied Annual Fee for this academic session yet. Tap below to set up school-wide or class-wise annual fees.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => _openApplyAnnualFeeModal(),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Apply Annual Fee'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                      elevation: 2,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 3: TRANSPORT FEE
  // ===========================================================================

  Widget _buildTransportFeeTab() {
    final list = _filteredTransportFees;

    return RefreshIndicator(
      onRefresh: _reloadTransportFees,
      color: const Color(0xFFD97706),
      child: Column(
        children: [
          // Filter Row & Action
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Container(
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
                      controller: _transportSearchController,
                      onChanged: (val) {
                        setState(() {
                          _transportSearch = val;
                        });
                      },
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Search by Student Name or SR ...',
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
                        suffixIcon: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_transportSearch.isNotEmpty)
                              IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF64748B)),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () {
                                  _transportSearchController.clear();
                                  setState(() => _transportSearch = '');
                                },
                              ),
                            if (_transportSearch.isNotEmpty) const SizedBox(width: 4),
                            Container(
                              height: 20,
                              width: 1,
                              color: const Color(0xFFCBD5E1),
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                            ),
                            InkWell(
                              onTap: _openTransportStatusFilterBottomSheet,
                              borderRadius: BorderRadius.circular(20),
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Icon(
                                      Icons.tune_rounded,
                                      size: 20,
                                      color: _transportStatusFilter != 'All'
                                          ? const Color(0xFFD97706)
                                          : const Color(0xFF0F172A),
                                    ),
                                    if (_transportStatusFilter != 'All')
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
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton.icon(
                  onPressed: () => _openAssignTransportFeeModal(null),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Assign Fee'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),

          // List
          Expanded(
            child: list.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 100.0),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.directions_bus_outlined, size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              Text(
                                _transportSearch.trim().isEmpty
                                    ? 'No transport fees configured.'
                                    : 'No transport fees matching search.',
                                style: TextStyle(color: Colors.grey.shade600, fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final tf = list[index];
                      return _buildTransportFeeCard(tf);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransportFeeCard(dynamic tf) {
    final studentName = (tf['student_name'] ?? '—').toString();
    final srNo = (tf['sr_no'] ?? '—').toString();
    final rollNo = (tf['roll_no'] ?? '—').toString();
    final rawClass = (tf['class_name'] ?? '').toString();
    final section = (tf['class_section'] ?? '').toString();
    final className = formatShortClassName(rawClass, section: section);
    final monthlyFee = tf['monthly_fee'];
    final startDate = tf['start_date'];
    final status = (tf['status'] ?? 'Active').toString();
    final nextCharge = tf['next_charge'];
    final isActive = status == 'Active';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Student Name & Status badge + Menu
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      studentName,
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$className • SR: $srNo • Roll: $rollNo',
                      style: const TextStyle(
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(
                    color: isActive ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF64748B)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                color: Colors.white,
                elevation: 4,
                onSelected: (val) {
                  if (val == 'edit') {
                    _openAssignTransportFeeModal(tf);
                  } else if (val == 'toggle') {
                    _toggleTransportStatus(tf);
                  } else if (val == 'delete') {
                    _confirmDeleteTransport(tf);
                  }
                },
                itemBuilder: (ctx) => [
                  const PopupMenuItem(
                    value: 'edit',
                    child: Row(
                      children: [
                        Icon(Icons.edit_outlined, size: 18, color: Color(0xFF475569)),
                        SizedBox(width: 10),
                        Text('Edit Config', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'toggle',
                    child: Row(
                      children: [
                        Icon(Icons.sync_rounded, size: 18, color: Color(0xFF475569)),
                        SizedBox(width: 10),
                        Text('Mark ${isActive ? 'Inactive' : 'Active'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline_rounded, size: 18, color: Colors.redAccent),
                        SizedBox(width: 10),
                        Text('Delete', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.redAccent)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          const Divider(height: 20, color: Color(0xFFF1F5F9)),

          // Row 2: Monthly fee & Start Date & Next charge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Monthly Fee', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    _formatCurrency(monthlyFee),
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFD97706)),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text('Start Date', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    _formatDate(startDate),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Next Charge', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    isActive ? _formatCurrency(nextCharge) : '—',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: isActive ? const Color(0xFF16A34A) : const Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // MODALS & DIALOGS
  // ===========================================================================

  // 1. View Fee Details Modal
  void _openFeeDetailsModal(dynamic ft) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final name = (ft['name'] ?? '').toString();
        final assignedTo = (ft['assigned_to'] ?? 'For All Classes').toString();
        final dueDate = ft['due_date'];
        final amount = ft['amount'];
        final totalAmount = ft['total_amount'] ?? 0;
        final collectedAmount = ft['collected_amount'] ?? 0;
        final pendingAmount = ft['pending_amount'] ?? 0;
        final classAmounts = ft['class_amounts'] as List<dynamic>? ?? [];

        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Assigned: $assignedTo',
                style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Due Date: ${_formatDate(dueDate)}', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
                  Text('Amount: ${_formatCurrency(amount)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                ],
              ),
              const Divider(height: 24),

              // Collection Summary
              const Text('Collection Summary', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _buildMetricTile('Total Amount', _formatCurrency(totalAmount), const Color(0xFF0F172A))),
                  const SizedBox(width: 8),
                  Expanded(child: _buildMetricTile('Collected Amount', _formatCurrency(collectedAmount), const Color(0xFF16A34A))),
                  const SizedBox(width: 8),
                  Expanded(child: _buildMetricTile('Pending Amount', _formatCurrency(pendingAmount), const Color(0xFFDC2626))),
                ],
              ),

              if (classAmounts.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Class Breakdown', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                const SizedBox(height: 8),
                Container(
                  constraints: const BoxConstraints(maxHeight: 180),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: classAmounts.length,
                    separatorBuilder: (_, __) => const Divider(height: 8),
                    itemBuilder: (_, i) {
                      final item = classAmounts[i];
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(formatShortClassName(item['class_name']?.toString()), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          Text(_formatCurrency(item['amount']), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                        ],
                      );
                    },
                  ),
                ),
              ],
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  // 2. Apply Additional Fee Modal
  void _openApplyAdditionalFeeModal() {
    final uniqueClasses = _getUniqueClasses();
    String applyType = 'school'; // 'school' | 'classes' | 'student'
    String description = '';
    String schoolAmount = '';
    String dueDate = _getLocalDateString();
    final Map<String, String> classAmounts = {for (var uc in uniqueClasses) uc['name'] as String: ''};
    dynamic selectedStudent;
    String studentQuery = '';
    bool isSubmitting = false;
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;

            final activeStudents = _students.where((s) {
              if (s['status'] != 'ACTIVE') return false;
              if (studentQuery.trim().isEmpty) return true;
              final q = studentQuery.toLowerCase().trim();
              final name = (s['name'] ?? '').toString().toLowerCase();
              final sr = (s['sr_no'] ?? '').toString().toLowerCase();
              final roll = (s['roll_no'] ?? '').toString().toLowerCase();
              return name.contains(q) || sr.contains(q) || roll.contains(q);
            }).toList();

            return Container(
              margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + keyboardPadding),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Apply Additional Fee',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Apply custom fees for entire school, selected classes, or individual student.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 16),

                    if (error.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(error, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Apply Type Radios
                    const Text('APPLY TO *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _buildRadioOption('Entire School', 'school', applyType, (val) {
                          setModalState(() => applyType = val);
                        }),
                        const SizedBox(width: 6),
                        _buildRadioOption('Classes', 'classes', applyType, (val) {
                          setModalState(() => applyType = val);
                        }),
                        const SizedBox(width: 6),
                        _buildRadioOption('Student', 'student', applyType, (val) {
                          setModalState(() => applyType = val);
                        }),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Individual Student Selector
                    if (applyType == 'student') ...[
                      const Text('SELECT STUDENT *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      if (selectedStudent == null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: TextField(
                            onChanged: (val) => setModalState(() => studentQuery = val),
                            style: const TextStyle(fontSize: 13),
                            decoration: const InputDecoration(
                              hintText: 'Search active student by Name or SR No...',
                              hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                              prefixIcon: Icon(Icons.person_search_rounded, size: 20, color: Color(0xFF94A3B8)),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          constraints: const BoxConstraints(maxHeight: 140),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: activeStudents.isEmpty
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Center(child: Text('No active students found', style: TextStyle(fontSize: 12, color: Colors.grey))),
                                )
                              : ListView.separated(
                                  shrinkWrap: true,
                                  itemCount: activeStudents.take(20).length,
                                  separatorBuilder: (_, __) => const Divider(height: 1),
                                  itemBuilder: (_, i) {
                                    final s = activeStudents[i];
                                    final sClass = formatShortClassName(s['class_name']?.toString(), section: s['section']?.toString());
                                    return ListTile(
                                      dense: true,
                                      title: Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      subtitle: Text('Class: $sClass • SR: ${s['sr_no'] ?? '—'}', style: const TextStyle(fontSize: 11)),
                                      trailing: const Text('Select', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold, fontSize: 12)),
                                      onTap: () {
                                        setModalState(() {
                                          selectedStudent = s;
                                        });
                                      },
                                    );
                                  },
                                ),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(selectedStudent['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Class: ${formatShortClassName(selectedStudent['class_name']?.toString(), section: selectedStudent['section']?.toString())} • SR: ${selectedStudent['sr_no'] ?? '—'}',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF047857)),
                                  ),
                                ],
                              ),
                              TextButton(
                                onPressed: () => setModalState(() => selectedStudent = null),
                                child: const Text('Change', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                    ],

                    // Fee Description (max 27 chars)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('FEE DESCRIPTION *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        Text('${description.length}/27', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: description.length >= 27 ? Colors.red : Colors.grey)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        maxLength: 27,
                        onChanged: (val) => setModalState(() => description = val),
                        style: const TextStyle(fontSize: 13),
                        decoration: const InputDecoration(
                          hintText: 'e.g. Annual Sports Fee',
                          hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          counterText: '',
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Amount input for School or Student
                    if (applyType == 'school' || applyType == 'student') ...[
                      const Text('AMOUNT (₹) *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          keyboardType: TextInputType.number,
                          onChanged: (val) => setModalState(() => schoolAmount = val),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                            hintText: 'e.g. 500',
                            hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Class wise allocation inputs
                    if (applyType == 'classes') ...[
                      const Text('CLASS DUES ALLOCATION *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 200),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: uniqueClasses.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final uc = uniqueClasses[i];
                            final ucName = uc['name'] as String;
                            return Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      uc['displayName'] ?? ucName,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 100,
                                    height: 38,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFCBD5E1)),
                                      ),
                                      child: TextField(
                                        keyboardType: TextInputType.number,
                                        onChanged: (val) {
                                          classAmounts[ucName] = val;
                                        },
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                        decoration: const InputDecoration(
                                          hintText: '₹ Amount',
                                          hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                          border: InputBorder.none,
                                          isDense: true,
                                          contentPadding: EdgeInsets.symmetric(vertical: 8),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Due Date Picker
                    const Text('DUE DATE *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                          builder: (ctx, child) {
                              return Theme(
                                data: Theme.of(ctx).copyWith(
                                  colorScheme: const ColorScheme.light(primary: Color(0xFFD97706)),
                                  dialogTheme: DialogThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
                                ),
                                child: child!,
                              );
                          },
                        );
                        if (picked != null) {
                          setModalState(() {
                            dueDate = '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_formatDate(dueDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFD97706)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    // Validations
                                    if (description.trim().isEmpty) {
                                      setModalState(() => error = 'Fee description is required.');
                                      return;
                                    }
                                    final payload = <String, dynamic>{
                                      'name': description.trim(),
                                      'due_date': dueDate,
                                      'effective_date': _getLocalDateString(),
                                      'apply_type': applyType,
                                    };

                                    if (applyType == 'student') {
                                      if (selectedStudent == null) {
                                        setModalState(() => error = 'Please select a student.');
                                        return;
                                      }
                                      final amt = int.tryParse(schoolAmount.trim());
                                      if (amt == null || amt <= 0) {
                                        setModalState(() => error = 'Fee amount must be a positive whole number.');
                                        return;
                                      }
                                      payload['student_id'] = selectedStudent['id'];
                                      payload['amount'] = amt;
                                    } else if (applyType == 'school') {
                                      final amt = int.tryParse(schoolAmount.trim());
                                      if (amt == null || amt <= 0) {
                                        setModalState(() => error = 'Fee amount must be a positive whole number.');
                                        return;
                                      }
                                      payload['amount'] = amt;
                                    } else {
                                      final classAmountsPayload = <String, dynamic>{};
                                      final missing = <String>[];
                                      final invalid = <String>[];
                                      for (final uc in uniqueClasses) {
                                        final val = classAmounts[uc['name'] as String]?.trim() ?? '';
                                        if (val.isEmpty) {
                                          missing.add(uc['displayName'] ?? uc['name']);
                                        } else {
                                          final amt = int.tryParse(val);
                                          if (amt == null || amt <= 0) {
                                            invalid.add(uc['displayName'] ?? uc['name']);
                                          } else {
                                            for (final cid in uc['ids']) {
                                              classAmountsPayload[cid.toString()] = amt;
                                            }
                                          }
                                        }
                                      }
                                      if (missing.isNotEmpty) {
                                        setModalState(() => error = 'Amount required for: ${missing.join(', ')}');
                                        return;
                                      }
                                      if (invalid.isNotEmpty) {
                                        setModalState(() => error = 'Positive whole number required for: ${invalid.join(', ')}');
                                        return;
                                      }
                                      payload['class_amounts'] = classAmountsPayload;
                                    }

                                    setModalState(() {
                                      isSubmitting = true;
                                      error = '';
                                    });

                                    try {
                                      await widget.feeService.createAdditionalFeeType(payload);
                                      if (context.mounted) {
                                        Navigator.pop(modalCtx);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Fee Applied Successfully')),
                                        );
                                      }
                                      await _reloadFeeTypes();
                                    } catch (err) {
                                      setModalState(() {
                                        isSubmitting = false;
                                        error = err.toString().replaceAll('Exception:', '').trim();
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              textStyle: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            child: isSubmitting
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                                : const Text('Apply Fee'),
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
      },
    );
  }

  Widget _buildRadioOption(String label, String value, String selectedValue, Function(String) onSelect) {
    final isSelected = value == selectedValue;
    return Expanded(
      child: InkWell(
        onTap: () => onSelect(value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? const Color(0xFFD97706) : const Color(0xFFCBD5E1)),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected ? const Color(0xFFD97706) : const Color(0xFF475569),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // 3. Edit Additional Fee Modal
  void _openEditFeeModal(dynamic ft) {
    final feeId = ft['id'] as int;
    String description = (ft['name'] ?? '').toString();
    String amount = (ft['amount'] ?? '').toString();
    String dueDate = (ft['due_date'] ?? _getLocalDateString()).toString();
    final isAllClasses = (ft['assigned_to'] ?? '').toString().contains('For All');
    final collectedStudents = int.tryParse((ft['collected_students'] ?? 0).toString()) ?? 0;
    bool isSubmitting = false;
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;
            return Container(
              margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 50),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + keyboardPadding),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text('Edit Additional Fee', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                    const SizedBox(height: 14),

                    if (error.isNotEmpty) ...[
                      Text(error, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                    ],

                    const Text('FEE DESCRIPTION *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: TextEditingController(text: description)..selection = TextSelection.collapsed(offset: description.length),
                        maxLength: 27,
                        onChanged: (val) => description = val,
                        decoration: const InputDecoration(border: InputBorder.none, counterText: ''),
                      ),
                    ),
                    const SizedBox(height: 14),

                    if (isAllClasses) ...[
                      const Text('AMOUNT (₹) *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: collectedStudents > 0 ? const Color(0xFFF1F5F9) : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          enabled: collectedStudents == 0,
                          controller: TextEditingController(text: amount)..selection = TextSelection.collapsed(offset: amount.length),
                          keyboardType: TextInputType.number,
                          onChanged: (val) => amount = val,
                          decoration: const InputDecoration(border: InputBorder.none),
                        ),
                      ),
                      if (collectedStudents > 0)
                        const Padding(
                          padding: EdgeInsets.only(top: 4.0),
                          child: Text('Amount cannot be changed as some students have already paid.', style: TextStyle(fontSize: 11, color: Color(0xFFD97706))),
                        ),
                      const SizedBox(height: 14),
                    ],

                    const Text('DUE DATE *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.tryParse(dueDate) ?? DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (picked != null) {
                          setModalState(() {
                            dueDate = '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_formatDate(dueDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFD97706)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    if (description.trim().isEmpty) {
                                      setModalState(() => error = 'Description is required.');
                                      return;
                                    }
                                    final payload = <String, dynamic>{
                                      'name': description.trim(),
                                      'due_date': dueDate,
                                    };
                                    if (isAllClasses && collectedStudents == 0) {
                                      final amt = int.tryParse(amount.trim());
                                      if (amt == null || amt <= 0) {
                                        setModalState(() => error = 'Valid positive amount required.');
                                        return;
                                      }
                                      payload['amount'] = amt;
                                    }

                                    setModalState(() => isSubmitting = true);
                                    try {
                                      await widget.feeService.updateAdditionalFeeType(feeId, payload);
                                      if (context.mounted) {
                                        Navigator.pop(modalCtx);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Additional fee updated successfully.')),
                                        );
                                      }
                                      await _reloadFeeTypes();
                                    } catch (err) {
                                      setModalState(() {
                                        isSubmitting = false;
                                        error = err.toString().replaceAll('Exception:', '').trim();
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
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
      },
    );
  }

  // 4. Confirm Delete Additional Fee
  void _confirmDeleteFee(dynamic ft) {
    final feeId = ft['id'] as int;
    final collectedStudents = int.tryParse((ft['collected_students'] ?? 0).toString()) ?? 0;
    if (collectedStudents > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot delete this additional fee because some students have already paid.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Additional Fee', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Text('Are you sure you want to delete "${ft['name']}"? This action cannot be undone.', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () async {
              Navigator.pop(dlgCtx);
              try {
                await widget.feeService.deleteAdditionalFeeType(feeId);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Additional fee deleted successfully.')),
                  );
                }
                await _reloadFeeTypes();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim()), backgroundColor: Colors.redAccent),
                  );
                }
              }
            },
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // 5. Apply Annual Fee Modal
  void _openApplyAnnualFeeModal() {
    final uniqueClasses = _getUniqueClasses();
    String applyType = 'school'; // 'school' | 'classes'
    String amount = '';
    final Map<String, String> classAmounts = {for (var uc in uniqueClasses) uc['name'] as String: ''};
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;
            return Container(
              margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 30),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + keyboardPadding),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text('Apply Annual Fee', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Text(
                        'Annual Fee will NOT be applied to students who were admitted during the current academic year. Once applied, it cannot be modified or deleted.',
                        style: TextStyle(fontSize: 11, color: Color(0xFF92400E), height: 1.35, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const SizedBox(height: 14),

                    if (error.isNotEmpty) ...[
                      Text(error, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                    ],

                    const Text('APPLICATION TYPE *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _buildRadioOption('Entire School', 'school', applyType, (val) => setModalState(() => applyType = val)),
                        const SizedBox(width: 8),
                        _buildRadioOption('Class-Wise', 'classes', applyType, (val) => setModalState(() => applyType = val)),
                      ],
                    ),
                    const SizedBox(height: 14),

                    if (applyType == 'school') ...[
                      const Text('ANNUAL FEE AMOUNT (₹) *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          keyboardType: TextInputType.number,
                          onChanged: (val) => setModalState(() => amount = val),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                            hintText: 'e.g. 5000',
                            hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ] else ...[
                      const Text('CLASS ALLOCATION *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 220),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: uniqueClasses.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final uc = uniqueClasses[i];
                            final ucName = uc['name'] as String;
                            return Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      uc['displayName'] ?? ucName,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 100,
                                    height: 38,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFCBD5E1)),
                                      ),
                                      child: TextField(
                                        keyboardType: TextInputType.number,
                                        onChanged: (val) => classAmounts[ucName] = val,
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                        decoration: const InputDecoration(
                                          hintText: '₹ Amount',
                                          hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                          border: InputBorder.none,
                                          isDense: true,
                                          contentPadding: EdgeInsets.symmetric(vertical: 8),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () {
                              // Initial validation
                              if (applyType == 'school') {
                                final amt = double.tryParse(amount.trim());
                                if (amt == null || amt <= 0) {
                                  setModalState(() => error = 'Annual Fee amount must be greater than 0.');
                                  return;
                                }
                                if (amt > 10000000) {
                                  setModalState(() => error = 'Annual Fee amount exceeds system maximum.');
                                  return;
                                }
                              } else {
                                final missing = <String>[];
                                final invalid = <String>[];
                                for (final uc in uniqueClasses) {
                                  final val = classAmounts[uc['name'] as String]?.trim() ?? '';
                                  if (val.isEmpty) {
                                    missing.add(uc['displayName'] ?? uc['name']);
                                  } else {
                                    final amt = double.tryParse(val);
                                    if (amt == null || amt <= 0) {
                                      invalid.add(uc['displayName'] ?? uc['name']);
                                    }
                                  }
                                }
                                if (missing.isNotEmpty) {
                                  setModalState(() => error = 'Fee amount for all classes is mandatory. Missing: ${missing.join(', ')}');
                                  return;
                                }
                                if (invalid.isNotEmpty) {
                                  setModalState(() => error = 'Fee amount must be greater than zero for: ${invalid.join(', ')}');
                                  return;
                                }
                              }

                              Navigator.pop(modalCtx);
                              _showAnnualFeeConfirmDialog(applyType, amount, classAmounts, uniqueClasses);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Next Step', style: TextStyle(fontWeight: FontWeight.bold)),
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
      },
    );
  }

  // 6. Annual Fee Confirmation Dialog
  void _showAnnualFeeConfirmDialog(
    String applyType,
    String amount,
    Map<String, String> classAmounts,
    List<Map<String, dynamic>> uniqueClasses,
  ) {
    bool isSubmitting = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dlgCtx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 24),
              SizedBox(width: 8),
              Flexible(child: Text('Confirm Annual Fee', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'Please review carefully before applying:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B)),
              ),
              SizedBox(height: 8),
              Text(
                '• Once added for this academic year, Annual Fee cannot be edited or deleted.',
                style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.3),
              ),
              SizedBox(height: 4),
              Text(
                '• It will be applied only to eligible existing students. New admissions in current academic session are automatically excluded.',
                style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.3),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(dlgCtx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      setDlgState(() => isSubmitting = true);
                      try {
                        final payload = <String, dynamic>{
                          'apply_type': applyType,
                          'amount': amount,
                        };
                        if (applyType == 'classes') {
                          final classAmountsPayload = <String, dynamic>{};
                          for (final uc in uniqueClasses) {
                            final val = classAmounts[uc['name'] as String]?.trim();
                            if (val != null && val.isNotEmpty) {
                              for (final cid in uc['ids']) {
                                classAmountsPayload[cid.toString()] = double.tryParse(val) ?? 0;
                              }
                            }
                          }
                          payload['class_amounts'] = classAmountsPayload;
                        }

                        await widget.feeService.createAnnualFee(payload);
                        if (context.mounted) {
                          Navigator.pop(dlgCtx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Annual Fee created successfully.')),
                          );
                        }
                        await _reloadFeeTypes();
                      } catch (err) {
                        setDlgState(() => isSubmitting = false);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(err.toString().replaceAll('Exception:', '').trim()), backgroundColor: Colors.redAccent),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: isSubmitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                  : const Text('Confirm & Apply', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  // TRANSPORT STATUS FILTER BOTTOM SHEET
  void _openTransportStatusFilterBottomSheet() {
    String tempStatus = _transportStatusFilter;
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
                          'Filter Transport Status',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (tempStatus != 'All')
                          TextButton(
                            onPressed: () {
                              setModalState(() => tempStatus = 'All');
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
                    _buildTransportFilterOption(
                      label: 'All Statuses',
                      subtitle: 'Show all active and inactive transport records',
                      selected: tempStatus == 'All',
                      onTap: () => setModalState(() => tempStatus = 'All'),
                    ),
                    const SizedBox(height: 8),
                    _buildTransportFilterOption(
                      label: 'Active Only',
                      subtitle: 'Show only active transport fee records',
                      selected: tempStatus == 'Active',
                      onTap: () => setModalState(() => tempStatus = 'Active'),
                    ),
                    const SizedBox(height: 8),
                    _buildTransportFilterOption(
                      label: 'Inactive Only',
                      subtitle: 'Show only inactive transport records',
                      selected: tempStatus == 'Inactive',
                      onTap: () => setModalState(() => tempStatus = 'Inactive'),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () {
                        setState(() => _transportStatusFilter = tempStatus);
                        Navigator.pop(ctx);
                        _reloadTransportFees();
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

  Widget _buildTransportFilterOption({
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

  // 7. Assign / Edit Transport Fee Modal
  void _openAssignTransportFeeModal(dynamic transportToEdit) {
    final isEditing = transportToEdit != null;
    dynamic selectedStudent;
    if (isEditing) {
      selectedStudent = {
        'id': transportToEdit['student_id'],
        'name': transportToEdit['student_name'],
        'sr_no': transportToEdit['sr_no'],
        'roll_no': transportToEdit['roll_no'],
        'class_name': transportToEdit['class_name'],
        'section': transportToEdit['class_section'],
      };
    }
    String studentQuery = '';
    String monthlyFee = isEditing ? (transportToEdit['monthly_fee'] ?? '').toString() : '';
    String startDate = isEditing ? (transportToEdit['start_date'] ?? _getLocalDateString()) : _getLocalDateString();
    String status = isEditing ? (transportToEdit['status'] ?? 'Active') : 'Active';
    bool isSubmitting = false;
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;
            final activeStudents = _students.where((s) {
              if (s['status'] != 'ACTIVE') return false;
              if (studentQuery.trim().isEmpty) return true;
              final q = studentQuery.toLowerCase().trim();
              final name = (s['name'] ?? '').toString().toLowerCase();
              final sr = (s['sr_no'] ?? '').toString().toLowerCase();
              final roll = (s['roll_no'] ?? '').toString().toLowerCase();
              return name.contains(q) || sr.contains(q) || roll.contains(q);
            }).toList();

            return Container(
              margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 30),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + keyboardPadding),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      isEditing ? 'Edit Transport Fee Details' : 'Assign Transport Fee',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 14),

                    if (error.isNotEmpty) ...[
                      Text(error, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                    ],

                    // Student Picker
                    const Text('STUDENT *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    if (selectedStudent == null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          onChanged: (val) => setModalState(() => studentQuery = val),
                          style: const TextStyle(fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Search student by Name, SR No, Roll No...',
                            hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            prefixIcon: Icon(Icons.person_search_rounded, size: 20, color: Color(0xFF94A3B8)),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 140),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: activeStudents.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: Center(child: Text('No active students found', style: TextStyle(fontSize: 12, color: Colors.grey))),
                              )
                            : ListView.separated(
                                shrinkWrap: true,
                                itemCount: activeStudents.take(20).length,
                                separatorBuilder: (_, __) => const Divider(height: 1),
                                itemBuilder: (_, i) {
                                  final s = activeStudents[i];
                                  final sClass = formatShortClassName(s['class_name']?.toString(), section: s['section']?.toString());
                                  return ListTile(
                                    dense: true,
                                    title: Text(s['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    subtitle: Text('Class: $sClass • SR: ${s['sr_no'] ?? '—'} • Roll: ${s['roll_no'] ?? '—'}', style: const TextStyle(fontSize: 11)),
                                    trailing: const Text('Select', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold, fontSize: 12)),
                                    onTap: () => setModalState(() => selectedStudent = s),
                                  );
                                },
                              ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(selectedStudent['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                const SizedBox(height: 2),
                                Text(
                                  'Class: ${formatShortClassName(selectedStudent['class_name']?.toString(), section: selectedStudent['section']?.toString())} • SR: ${selectedStudent['sr_no'] ?? '—'}',
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF047857)),
                                ),
                              ],
                            ),
                            if (!isEditing)
                              TextButton(
                                onPressed: () => setModalState(() => selectedStudent = null),
                                child: const Text('Clear', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12)),
                              ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),

                    // Monthly fee input
                    const Text('MONTHLY TRANSPORT FEE (₹) *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: TextEditingController(text: monthlyFee)..selection = TextSelection.collapsed(offset: monthlyFee.length),
                        keyboardType: TextInputType.number,
                        onChanged: (val) => monthlyFee = val,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        decoration: const InputDecoration(
                          hintText: 'e.g. 1000',
                          hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Transport Start Date
                    const Text('TRANSPORT START DATE *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.tryParse(startDate) ?? DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (picked != null) {
                          setModalState(() {
                            startDate = '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_formatDate(startDate), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFD97706)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Status Dropdown with Curved corners
                    const Text('STATUS *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: status,
                          isExpanded: true,
                          borderRadius: BorderRadius.circular(16),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          items: const [
                            DropdownMenuItem(value: 'Active', child: Text('Active')),
                            DropdownMenuItem(value: 'Inactive', child: Text('Inactive')),
                          ],
                          onChanged: (val) {
                            if (val != null) setModalState(() => status = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    if (selectedStudent == null) {
                                      setModalState(() => error = 'Student selection is required.');
                                      return;
                                    }
                                    final amt = double.tryParse(monthlyFee.trim());
                                    if (amt == null || amt < 0) {
                                      setModalState(() => error = 'Valid non-negative monthly fee is required.');
                                      return;
                                    }
                                    if (startDate.trim().isEmpty) {
                                      setModalState(() => error = 'Start date is required.');
                                      return;
                                    }

                                    setModalState(() => isSubmitting = true);
                                    final payload = <String, dynamic>{
                                      'student_id': selectedStudent['id'],
                                      'monthly_fee': amt,
                                      'start_date': startDate,
                                      'status': status,
                                    };

                                    try {
                                      if (isEditing) {
                                        await widget.feeService.updateTransportFee(transportToEdit['id'] as int, payload);
                                        if (context.mounted) {
                                          Navigator.pop(modalCtx);
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Transport fee updated successfully.')),
                                          );
                                        }
                                      } else {
                                        await widget.feeService.assignTransportFee(payload);
                                        if (context.mounted) {
                                          Navigator.pop(modalCtx);
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(content: Text('Transport fee successfully assigned.')),
                                          );
                                        }
                                      }
                                      await _reloadTransportFees();
                                    } catch (err) {
                                      setModalState(() {
                                        isSubmitting = false;
                                        error = err.toString().replaceAll('Exception:', '').trim();
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                                : Text(isEditing ? 'Save Changes' : 'Assign Fee', style: const TextStyle(fontWeight: FontWeight.bold)),
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
      },
    );
  }

  // 8. Toggle Transport Status
  void _toggleTransportStatus(dynamic tf) {
    final nextStatus = tf['status'] == 'Active' ? 'Inactive' : 'Active';

    if (nextStatus == 'Inactive') {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Mark as Inactive?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: const Text(
            'Are you sure you want to mark this transport assignment as Inactive? Agle month se new fees add nahi hogi.',
            style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                await _performToggleTransportStatus(tf['id'] as int, 'Inactive');
              },
              child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
    } else {
      _performToggleTransportStatus(tf['id'] as int, 'Active');
    }
  }

  Future<void> _performToggleTransportStatus(int id, String nextStatus) async {
    try {
      await widget.feeService.toggleTransportFeeStatus(id, status: nextStatus);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Transport fee marked as $nextStatus.')),
        );
      }
      await _reloadTransportFees();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim()), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  // 9. Confirm Delete Transport Fee
  void _confirmDeleteTransport(dynamic tf) {
    final transportId = tf['id'] as int;

    showDialog(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Transport Fee Assignment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text(
          'Are you sure you want to delete this transport fee assignment?\n\nNote: Deletion will fail if a billing invoice has already been generated.',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dlgCtx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () async {
              Navigator.pop(dlgCtx);
              try {
                await widget.feeService.deleteTransportFee(transportId);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Transport fee deleted successfully.')),
                  );
                }
                await _reloadTransportFees();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim()), backgroundColor: Colors.redAccent),
                  );
                }
              }
            },
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // TAB 4: MONTHLY FEE (CLASS FEE CONFIGURATION)
  // ===========================================================================

  Widget _buildMonthlyFeeTab() {
    final classGroups = _getUniqueClassFeeGroups(isCourse: false);
    final ClassFeeGroup? selectedGroup = _monthlySelectedShortName != null
        ? classGroups.firstWhere(
            (g) => g.name == _monthlySelectedShortName,
            orElse: () => classGroups.first,
          )
        : null;

    final isConfigured = selectedGroup?.isConfigured ?? false;

    return RefreshIndicator(
      onRefresh: _reloadMonthlyFeeConfigs,
      color: const Color(0xFFD97706),
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          // Header / Info Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Icon(Icons.event_repeat_rounded, color: Color(0xFFD97706), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Class Fee Configuration',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF0F172A)),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Define standard monthly tuition fees for each academic class. All sections of the class inherit this configuration.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(
                    onPressed: _downloadingMonthlyPdf ? null : _downloadFeeStructurePdf,
                    icon: _downloadingMonthlyPdf
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)))
                        : const Icon(Icons.download_rounded, size: 16, color: Color(0xFFD97706)),
                    label: Text(
                      _downloadingMonthlyPdf ? 'Generating...' : 'Download Fee Structure',
                      style: const TextStyle(color: Color(0xFFD97706), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFFDE68A)),
                      backgroundColor: const Color(0xFFFFFBEB),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Main Configuration Form Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_monthlyErrorMessage.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _monthlyErrorMessage,
                            style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                if (_monthlySuccessMessage.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _monthlySuccessMessage,
                            style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Class Dropdown Label
                const Text(
                  'CLASS *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),

                // Curved Class Dropdown
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _monthlySelectedShortName,
                      isExpanded: true,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: Colors.white,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                      hint: const Text(
                        '-- Select Class --',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.normal),
                      ),
                      items: classGroups.map((group) {
                        return DropdownMenuItem<String>(
                          value: group.name,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                group.name,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF0F172A)),
                              ),
                              if (group.isConfigured)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFA7F3D0)),
                                  ),
                                  child: const Text(
                                    'Configured',
                                    style: TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _monthlySelectedShortName = val;
                          _monthlyErrorMessage = '';
                          _monthlySuccessMessage = '';
                          if (val != null) {
                            final sel = classGroups.firstWhere((g) => g.name == val);
                            if (sel.isConfigured && sel.config != null) {
                              final cfg = sel.config;
                              if (cfg['mode'] == 'SAME') {
                                final amt = cfg['monthly_fees']?['April'] ?? cfg['same_amount'] ?? '';
                                _monthlyAmountController.text = amt.toString().replaceAll(RegExp(r'\.00$'), '');
                              } else if (cfg['monthly_fees'] is Map) {
                                final fees = cfg['monthly_fees'] as Map;
                                final firstVal = fees.values.firstWhere(
                                  (v) => v != null && v.toString().isNotEmpty,
                                  orElse: () => '',
                                );
                                _monthlyAmountController.text = firstVal.toString().replaceAll(RegExp(r'\.00$'), '');
                              }
                            } else {
                              _monthlyAmountController.clear();
                            }
                          }
                        });
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 18),
                const Divider(color: Color(0xFFE2E8F0), height: 1),
                const SizedBox(height: 18),

                // Monthly Fee Amount Field
                const Text(
                  'FEE AMOUNT',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),

                TextFormField(
                  controller: _monthlyAmountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  enabled: _monthlySelectedShortName != null && !isConfigured,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isConfigured ? const Color(0xFF64748B) : const Color(0xFF0F172A),
                  ),
                  decoration: InputDecoration(
                    prefixText: '₹  ',
                    prefixStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF64748B)),
                    hintText: 'e.g. 1500',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    filled: isConfigured,
                    fillColor: isConfigured ? const Color(0xFFF8FAFC) : Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                    ),
                    disabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                ),

                const SizedBox(height: 6),
                const Text(
                  'This amount will be applied to all 12 academic months automatically.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),

                const SizedBox(height: 24),

                // Status or Save Button
                if (_monthlySelectedShortName != null && isConfigured) ...[
                  // Locked Banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: Color(0xFFE2E8F0),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.lock_rounded, size: 16, color: Color(0xFF64748B)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Fee Configuration Locked',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1E293B)),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'This class fee configuration is permanently saved and locked for this academic year.',
                                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: const Text(
                            'LOCKED',
                            style: TextStyle(color: Color(0xFF475569), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: const Text('Fee Configured'),
                      style: ElevatedButton.styleFrom(
                        disabledBackgroundColor: const Color(0xFFE2E8F0),
                        disabledForegroundColor: const Color(0xFF94A3B8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ] else ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: (_monthlySelectedShortName == null || _monthlySaving)
                          ? null
                          : () => _showSaveMonthlyFeeDialog(selectedGroup!),
                      icon: _monthlySaving
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_rounded, size: 18),
                      label: Text(_monthlySaving ? 'Saving...' : 'Save Fee Configuration'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFFCBD5E1),
                        disabledForegroundColor: Colors.white70,
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showSaveMonthlyFeeDialog(ClassFeeGroup group) {
    final amountText = _monthlyAmountController.text.trim();
    final amount = double.tryParse(amountText);
    if (amount == null || amount <= 0) {
      setState(() {
        _monthlyErrorMessage = 'Monthly fee must be greater than ₹0.';
        _monthlySuccessMessage = '';
      });
      return;
    }

    showDialog(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
        title: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Icon(Icons.help_outline_rounded, color: Color(0xFFD97706), size: 30),
            ),
            const SizedBox(height: 14),
            const Text(
              'Confirm Save',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Are you sure you want to save the class fee configuration for ${group.name}?\n\nThis will update future unpaid billing cycles.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Monthly Fee:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF92400E))),
                  Text('₹${amount.toStringAsFixed(0)} / month', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF92400E))),
                ],
              ),
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(dlgCtx),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(dlgCtx);
                    _saveMonthlyFeeConfig(group, amount);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _saveMonthlyFeeConfig(ClassFeeGroup group, double amount) async {
    setState(() {
      _monthlySaving = true;
      _monthlyErrorMessage = '';
      _monthlySuccessMessage = '';
    });

    try {
      final activeYear = _getCurrentAcademicYear();
      final activeYearId = activeYear != null
          ? (activeYear['id'] is int ? activeYear['id'] : int.tryParse(activeYear['id'].toString()))
          : null;

      final feesMap = <String, dynamic>{};
      for (final m in [
        'April', 'May', 'June', 'July', 'August', 'September',
        'October', 'November', 'December', 'January', 'February', 'March'
      ]) {
        feesMap[m] = amount;
      }

      for (final cid in group.allIds) {
        await widget.feeService.saveClassFeeConfiguration({
          'class_id': int.parse(cid),
          'academic_year_id': activeYearId,
          'mode': 'SAME',
          'monthly_fees': feesMap,
        });
      }

      await _reloadMonthlyFeeConfigs();

      if (mounted) {
        setState(() {
          _monthlySuccessMessage = 'Fee configuration saved successfully.';
          _monthlySaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fee configuration saved successfully.'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _monthlyErrorMessage = e.toString().replaceAll('Exception:', '').trim();
          _monthlySaving = false;
        });
      }
    }
  }

  Future<void> _downloadFeeStructurePdf() async {
    setState(() => _downloadingMonthlyPdf = true);
    try {
      final activeYear = _getCurrentAcademicYear();
      final yearName = activeYear?['name']?.toString() ?? '2026-2027';

      String startYr = '2026';
      String endYr = '2027';
      final yearMatch = RegExp(r'(\d{4})\s*[-–—]\s*(\d{4})').firstMatch(yearName);
      if (yearMatch != null) {
        startYr = yearMatch.group(1)!;
        endYr = yearMatch.group(2)!;
      }

      final headerTitle = 'FEE STRUCTURE FOR $startYr - $endYr';
      final headerSubtitle = '(Applicable from 1st April to 31st March $endYr)';

      final classGroups = _getUniqueClassFeeGroups(isCourse: false);

      final pdf = pw.Document();

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  headerTitle,
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColor.fromHex('#0F172A'),
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  headerSubtitle,
                  style: pw.TextStyle(
                    fontSize: 10,
                    color: PdfColor.fromHex('#475569'),
                  ),
                ),
                pw.SizedBox(height: 16),
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColor.fromHex('#CBD5E1'), width: 0.5),
                  columnWidths: {
                    0: const pw.FixedColumnWidth(40),
                    1: const pw.FlexColumnWidth(),
                    2: const pw.FixedColumnWidth(80),
                  },
                  children: [
                    // Header Row
                    pw.TableRow(
                      decoration: pw.BoxDecoration(color: PdfColor.fromHex('#0F172A')),
                      children: [
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                          child: pw.Text('S. NO.', textAlign: pw.TextAlign.center, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          child: pw.Text('CLASS', textAlign: pw.TextAlign.left, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          child: pw.Text('AMOUNT (Rs.)', textAlign: pw.TextAlign.right, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                      ],
                    ),
                    // Data Rows
                    ...classGroups.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final grp = entry.value;
                      final isEven = idx % 2 == 1;

                      double feeAmt = 0;
                      if (grp.config != null) {
                        final cfg = grp.config;
                        if (cfg['mode'] == 'SAME') {
                          feeAmt = double.tryParse((cfg['monthly_fees']?['April'] ?? cfg['same_amount'] ?? 0).toString()) ?? 0;
                        } else if (cfg['monthly_fees'] is Map) {
                          final vals = (cfg['monthly_fees'] as Map)
                              .values
                              .map((v) => double.tryParse(v.toString()) ?? 0)
                              .where((v) => v > 0)
                              .toList();
                          if (vals.isNotEmpty) feeAmt = vals.first;
                        }
                      }

                      return pw.TableRow(
                        decoration: isEven ? pw.BoxDecoration(color: PdfColor.fromHex('#F8FAFC')) : const pw.BoxDecoration(),
                        children: [
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 6),
                            child: pw.Text('${idx + 1}', textAlign: pw.TextAlign.center, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey800)),
                          ),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                            child: pw.Text(grp.name, textAlign: pw.TextAlign.left, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0F172A'))),
                          ),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                            child: pw.Text('Rs. ${feeAmt.round()}', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0F172A'))),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ],
            );
          },
        ),
      );

      final pdfBytes = await pdf.save();
      await Printing.layoutPdf(
        onLayout: (_) async => pdfBytes,
        name: 'Fee_Structure_$startYr-$endYr.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate PDF: ${e.toString().replaceAll('Exception:', '').trim()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _downloadingMonthlyPdf = false);
      }
    }
  }

  // ===========================================================================
  // TAB 5: COURSE FEE CONFIGURATION
  // ===========================================================================

  Widget _buildCourseFeeTab() {
    final classGroups = _getUniqueClassFeeGroups(isCourse: true);
    final ClassFeeGroup? selectedGroup = _courseSelectedShortName != null
        ? classGroups.firstWhere(
            (g) => g.name == _courseSelectedShortName,
            orElse: () => classGroups.first,
          )
        : null;

    final isConfigured = selectedGroup?.isConfigured ?? false;

    return RefreshIndicator(
      onRefresh: _reloadCourseFeeConfigs,
      color: const Color(0xFFD97706),
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          // Header / Info Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Icon(Icons.school_outlined, color: Color(0xFFD97706), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Course Fee Configuration',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF0F172A)),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Define one-time or course-based fees per class. Course fees are maintained separately from monthly academic fees.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(
                    onPressed: _downloadingCoursePdf ? null : _downloadCourseFeeStructurePdf,
                    icon: _downloadingCoursePdf
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)))
                        : const Icon(Icons.download_rounded, size: 16, color: Color(0xFFD97706)),
                    label: Text(
                      _downloadingCoursePdf ? 'Generating...' : 'Download Course Fee Structure',
                      style: const TextStyle(color: Color(0xFFD97706), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFFDE68A)),
                      backgroundColor: const Color(0xFFFFFBEB),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Main Configuration Form Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_courseErrorMessage.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _courseErrorMessage,
                            style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                if (_courseSuccessMessage.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _courseSuccessMessage,
                            style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Class Dropdown Label
                const Text(
                  'CLASS *',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),

                // Curved Class Dropdown
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _courseSelectedShortName,
                      isExpanded: true,
                      borderRadius: BorderRadius.circular(14),
                      dropdownColor: Colors.white,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                      hint: const Text(
                        '-- Select Class --',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.normal),
                      ),
                      items: classGroups.map((group) {
                        return DropdownMenuItem<String>(
                          value: group.name,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                group.name,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF0F172A)),
                              ),
                              if (group.isConfigured)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFA7F3D0)),
                                  ),
                                  child: const Text(
                                    'Configured',
                                    style: TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _courseSelectedShortName = val;
                          _courseErrorMessage = '';
                          _courseSuccessMessage = '';
                          if (val != null) {
                            final sel = classGroups.firstWhere((g) => g.name == val);
                            if (sel.isConfigured && sel.config != null) {
                              final amt = sel.config['amount'] ?? '';
                              _courseAmountController.text = amt.toString().replaceAll(RegExp(r'\.00$'), '');
                            } else {
                              _courseAmountController.clear();
                            }
                          }
                        });
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 18),
                const Divider(color: Color(0xFFE2E8F0), height: 1),
                const SizedBox(height: 18),

                // Course Fee Amount Field
                const Text(
                  'COURSE FEE',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),

                TextFormField(
                  controller: _courseAmountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  enabled: _courseSelectedShortName != null && !isConfigured,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isConfigured ? const Color(0xFF64748B) : const Color(0xFF0F172A),
                  ),
                  decoration: InputDecoration(
                    prefixText: '₹  ',
                    prefixStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF64748B)),
                    hintText: 'e.g. 1500',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    filled: isConfigured,
                    fillColor: isConfigured ? const Color(0xFFF8FAFC) : Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                    ),
                    disabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                ),

                const SizedBox(height: 6),
                Text(
                  isConfigured
                      ? 'Course fee for this class has been configured.'
                      : 'Course fee is maintained separately from monthly academic fees.',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),

                const SizedBox(height: 24),

                // Status or Save Button
                if (_courseSelectedShortName != null && isConfigured) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: null,
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: const Text('Course Fee Configured'),
                      style: ElevatedButton.styleFrom(
                        disabledBackgroundColor: const Color(0xFFE2E8F0),
                        disabledForegroundColor: const Color(0xFF94A3B8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ] else ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: (_courseSelectedShortName == null || _courseSaving)
                          ? null
                          : () => _saveCourseFeeConfig(selectedGroup!),
                      icon: _courseSaving
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_rounded, size: 18),
                      label: Text(_courseSaving ? 'Saving...' : 'Save Course Fee Configuration'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFFCBD5E1),
                        disabledForegroundColor: Colors.white70,
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _saveCourseFeeConfig(ClassFeeGroup group) async {
    final amountText = _courseAmountController.text.trim();
    final amount = double.tryParse(amountText);
    if (amount == null || amount <= 0) {
      setState(() {
        _courseErrorMessage = 'Please enter a valid positive course fee amount.';
        _courseSuccessMessage = '';
      });
      return;
    }

    setState(() {
      _courseSaving = true;
      _courseErrorMessage = '';
      _courseSuccessMessage = '';
    });

    try {
      final activeYear = _getCurrentAcademicYear();
      final activeYearId = activeYear != null
          ? (activeYear['id'] is int ? activeYear['id'] : int.tryParse(activeYear['id'].toString()))
          : null;

      await widget.feeService.saveClassCourseFeeConfiguration({
        'class_id': int.parse(group.primaryId),
        'academic_year_id': activeYearId,
        'amount': amount,
      });

      await _reloadCourseFeeConfigs();

      if (mounted) {
        setState(() {
          _courseSuccessMessage = 'Course fee configuration saved successfully.';
          _courseSaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Course fee configuration saved successfully.'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _courseErrorMessage = e.toString().replaceAll('Exception:', '').trim();
          _courseSaving = false;
        });
      }
    }
  }

  Future<void> _downloadCourseFeeStructurePdf() async {
    setState(() => _downloadingCoursePdf = true);
    try {
      final activeYear = _getCurrentAcademicYear();
      final yearName = activeYear?['name']?.toString() ?? '2026-2027';

      String startYr = '2026';
      String endYr = '2027';
      final yearMatch = RegExp(r'(\d{4})\s*[-–—]\s*(\d{4})').firstMatch(yearName);
      if (yearMatch != null) {
        startYr = yearMatch.group(1)!;
        endYr = yearMatch.group(2)!;
      }

      final headerTitle = 'COURSE FEE STRUCTURE FOR $startYr - $endYr';
      final headerSubtitle = '(Applicable for $startYr - $endYr)';

      final classGroups = _getUniqueClassFeeGroups(isCourse: true);

      final pdf = pw.Document();

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  headerTitle,
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColor.fromHex('#0F172A'),
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  headerSubtitle,
                  style: pw.TextStyle(
                    fontSize: 10,
                    color: PdfColor.fromHex('#475569'),
                  ),
                ),
                pw.SizedBox(height: 16),
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColor.fromHex('#CBD5E1'), width: 0.5),
                  columnWidths: {
                    0: const pw.FixedColumnWidth(40),
                    1: const pw.FlexColumnWidth(),
                    2: const pw.FixedColumnWidth(80),
                  },
                  children: [
                    // Header Row
                    pw.TableRow(
                      decoration: pw.BoxDecoration(color: PdfColor.fromHex('#0F172A')),
                      children: [
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                          child: pw.Text('S. NO.', textAlign: pw.TextAlign.center, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          child: pw.Text('CLASS', textAlign: pw.TextAlign.left, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                          child: pw.Text('AMOUNT (Rs.)', textAlign: pw.TextAlign.right, style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 10)),
                        ),
                      ],
                    ),
                    // Data Rows
                    ...classGroups.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final grp = entry.value;
                      final isEven = idx % 2 == 1;

                      final double feeAmt = grp.config != null
                          ? (double.tryParse((grp.config['amount'] ?? 0).toString()) ?? 0)
                          : 0;

                      return pw.TableRow(
                        decoration: isEven ? pw.BoxDecoration(color: PdfColor.fromHex('#F8FAFC')) : const pw.BoxDecoration(),
                        children: [
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 6),
                            child: pw.Text('${idx + 1}', textAlign: pw.TextAlign.center, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey800)),
                          ),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                            child: pw.Text(grp.name, textAlign: pw.TextAlign.left, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0F172A'))),
                          ),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                            child: pw.Text('Rs. ${feeAmt.round()}', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0F172A'))),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ],
            );
          },
        ),
      );

      final pdfBytes = await pdf.save();
      await Printing.layoutPdf(
        onLayout: (_) async => pdfBytes,
        name: 'Course_Fee_Structure_$startYr-$endYr.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate PDF: ${e.toString().replaceAll('Exception:', '').trim()}'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _downloadingCoursePdf = false);
      }
    }
  }
}
