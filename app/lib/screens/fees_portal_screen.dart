import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'dart:math';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:printing/printing.dart';
import 'package:school_hub/services/fee_service.dart';
import 'package:school_hub/screens/fees_collection_history_screen.dart';
import 'package:school_hub/screens/manage_finance_fees_screen.dart';
import 'package:school_hub/screens/pending_discount_requests_screen.dart';
import 'package:school_hub/screens/full_screen_image_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FeesPortalScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final int? initialStudentId;

  const FeesPortalScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    this.initialStudentId,
  }) : super(key: key);

  @override
  State<FeesPortalScreen> createState() => _FeesPortalScreenState();
}

class _FeesPortalScreenState extends State<FeesPortalScreen> {
  late FeeService _feeService;
  bool _isLoading = true;
  String _errorMessage = '';
  int _pendingDiscountCount = 0;
  bool _initialLedgerOpened = false;

  List<dynamic> _rawStudents = [];
  List<dynamic> _classes = [];
  List<dynamic> _feePayments = [];
  List<dynamic> _classFeeConfigs = [];
  List<dynamic> _additionalPayments = [];

  List<Map<String, dynamic>> _processedStudents = [];
  List<Map<String, dynamic>> _filteredStudents = [];

  // Summary Stat Cards (Synced with School Admin Portal)
  double _todayCollection = 0.0;
  double _yesterdayCollection = 0.0;
  double _feeCollected = 0.0;
  double _duesPending = 0.0;
  bool _hasBackendStats = false;
  bool _showYesterday = false;

  final TextEditingController _searchController = TextEditingController();
  String _selectedClassFilter = 'ALL'; // 'ALL' or class name / id
  String _selectedStatusFilter = 'ALL'; // 'ALL', 'PENDING', 'PAID'
  String _selectedSort = 'OUTSTANDING_DESC'; // 'OUTSTANDING_DESC', 'OUTSTANDING_ASC', 'NAME_ASC', 'ROLL_ASC'

  String _workingAyName = '';
  String _workingAyStatus = 'ACTIVE';

  static const List<String> _academicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  @override
  void initState() {
    super.initState();
    _feeService = FeeService(baseUrl: widget.baseUrl, token: widget.token);
    _searchController.addListener(_applyFilters);
    _loadPortalData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPortalData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      try {
        final prefs = await SharedPreferences.getInstance();
        _workingAyName = prefs.getString('selected_academic_year_name') ?? '';
        _workingAyStatus = prefs.getString('selected_academic_year_status') ?? 'ACTIVE';
      } catch (_) {}

      final data = await _feeService.fetchPortalData();
      _rawStudents = List<dynamic>.from(data['students'] ?? []);
      _classes = List<dynamic>.from(data['classes'] ?? []);
      _feePayments = List<dynamic>.from(data['fee_payments'] ?? []);
      _classFeeConfigs = List<dynamic>.from(data['class_fee_configs'] ?? []);
      _additionalPayments = List<dynamic>.from(data['additional_payments'] ?? []);

      // Synchronize 3 Stat Cards from School Admin Portal (/api/school/stats)
      final stats = data['stats'] is Map ? Map<String, dynamic>.from(data['stats']) : <String, dynamic>{};
      if (stats.isNotEmpty) {
        _hasBackendStats = true;
        _todayCollection = (stats['today_collection'] as num?)?.toDouble() ?? 0.0;
        _yesterdayCollection = (stats['yesterday_collection'] as num?)?.toDouble() ?? 0.0;
        _feeCollected = (stats['total_collected'] as num?)?.toDouble() ?? 0.0;
        _duesPending = (stats['pending_fees'] as num?)?.toDouble() ?? 0.0;
      } else {
        _hasBackendStats = false;
      }

      _computeStudentDues();

      int pendingCount = 0;
      try {
        final reqData = await _feeService.getDiscountRequests(status: 'PENDING');
        final reqList = (reqData['requests'] as List<dynamic>?) ?? [];
        pendingCount = reqList.length;
      } catch (_) {}
      if (mounted) {
        setState(() {
          _pendingDiscountCount = pendingCount;
        });
      }

      _checkInitialStudentLedger();
    } catch (e) {
      debugPrint('Error loading fees portal data: $e');
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  void _computeStudentDues() {
    // Group monthly tuition payments by key: "${student_id}_${academic_year_id}_${month}"
    final Map<String, double> monthlyPaidMap = {};
    for (final p in _feePayments) {
      final status = (p['status'] ?? '').toString().toUpperCase();
      if (status == 'PAID' || status == 'PARTIAL') {
        final studentId = int.tryParse(p['student_id']?.toString() ?? '') ?? 0;
        final ayId = int.tryParse(p['academic_year_id']?.toString() ?? '') ?? 0;
        final mName = (p['fee_month'] ?? '').toString().trim();
        if (studentId > 0 && mName.isNotEmpty) {
          final key = '${studentId}_${ayId}_$mName';
          final paidAmt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
          final discAmt = double.tryParse(p['discount_amount']?.toString() ?? '0') ?? 0.0;
          monthlyPaidMap[key] = (monthlyPaidMap[key] ?? 0.0) + (paidAmt + discAmt);
        }
      }
    }

    // Map fee configs by: "${academic_year_id}_${class_id}"
    final Map<String, Map<String, dynamic>> configMap = {};
    for (final cfg in _classFeeConfigs) {
      final ayId = int.tryParse(cfg['academic_year_id']?.toString() ?? '') ?? 0;
      final classId = int.tryParse(cfg['class_id']?.toString() ?? '') ?? 0;
      final key = '${ayId}_$classId';
      dynamic mf = cfg['monthly_fees'];
      if (mf is String) {
        try {
          mf = json.decode(mf);
        } catch (_) {
          mf = {};
        }
      }
      if (mf is Map) {
        configMap[key] = Map<String, dynamic>.from(mf);
      }
    }

    // Additional unpaid fee payments (all unpaid fees for this student)
    final Map<int, double> additionalUnpaidMap = {};
    for (final p in _additionalPayments) {
      final pStatus = (p['status'] ?? '').toString().toLowerCase();
      if (pStatus == 'pending' || pStatus == 'partial') {
        final sId = int.tryParse(p['student_id']?.toString() ?? '') ?? 0;
        if (sId > 0) {
          final totalAmt = double.tryParse(p['amount']?.toString() ?? '0') ?? 0.0;
          final paidAmt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
          final discAmt = double.tryParse(p['discount_amount']?.toString() ?? '0') ?? 0.0;
          final remDue = (totalAmt - paidAmt - discAmt).clamp(0.0, double.infinity);
          additionalUnpaidMap[sId] = (additionalUnpaidMap[sId] ?? 0.0) + remDue;
        }
      }
    }

    // Build authoritative classId -> name map
    final Map<int, String> classIdToName = {};
    for (final c in _classes) {
      final id = int.tryParse(c['id']?.toString() ?? '') ?? 0;
      final name = (c['name'] ?? '').toString().trim();
      if (id > 0 && name.isNotEmpty) {
        classIdToName[id] = name;
      }
    }

    // Process each student for all 12 academic months (consistent with student ledger)
    final List<Map<String, dynamic>> processed = [];
    for (final s in _rawStudents) {
      final sId = int.tryParse(s['id']?.toString() ?? '') ?? 0;
      final studentAyId = int.tryParse(s['academic_year_id']?.toString() ?? '') ?? 0;
      final studentClassId = int.tryParse(s['class_id']?.toString() ?? '') ?? 0;
      final configKey = '${studentAyId}_$studentClassId';
      Map<String, dynamic> monthlyFees = configMap[configKey] ?? {};
      if (monthlyFees.isEmpty) {
        final ayFallbackKey = configMap.keys.firstWhere(
          (k) => k.startsWith('${studentAyId}_'),
          orElse: () => '',
        );
        if (ayFallbackKey.isNotEmpty) {
          monthlyFees = configMap[ayFallbackKey] ?? {};
        } else if (configMap.isNotEmpty) {
          monthlyFees = configMap.values.first;
        }
      }


      double outstandingDues = 0.0;
      for (final m in _academicMonths) {
        final payKey = '${sId}_${studentAyId}_$m';
        final alreadyPaid = monthlyPaidMap[payKey] ?? 0.0;
        final configuredFee = double.tryParse(monthlyFees[m]?.toString() ?? '0') ?? 0.0;
        final remForMonth = (configuredFee - alreadyPaid).clamp(0.0, double.infinity);
        if (remForMonth > 0 && configuredFee > 0) {
          outstandingDues += remForMonth;
        }
      }

      final addUnpaid = additionalUnpaidMap[sId] ?? 0.0;
      outstandingDues += addUnpaid;

      final status = outstandingDues > 0 ? 'PENDING' : 'PAID';

      final rawClass = (s['class_name'] ?? '').toString().trim();
      final resolvedClass = classIdToName[studentClassId] ?? (rawClass.isNotEmpty ? rawClass : 'N/A');

      processed.add({
        'id': sId,
        'name': (s['name'] ?? 'Unnamed Student').toString(),
        'class_id': studentClassId,
        'class_name': resolvedClass,
        'roll_no': (s['roll_no'] ?? '').toString(),
        'outstanding_dues': outstandingDues.round(),
        'calculated_status': status,
        'raw': s,
      });
    }

    _processedStudents = processed;

    // Fallback calculation for cards if backend stats endpoint was unreachable
    if (!_hasBackendStats) {
      double totalDues = 0.0;
      for (final s in processed) {
        totalDues += (s['outstanding_dues'] as num?)?.toDouble() ?? 0.0;
      }
      _duesPending = totalDues;

      double totalCollected = 0.0;
      double todayCollected = 0.0;
      double yesterdayCollected = 0.0;
      final todayStr = DateTime.now().toIso8601String().substring(0, 10);
      final yesterdayStr = DateTime.now().subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);

      for (final p in _feePayments) {
        final st = (p['status'] ?? '').toString().toUpperCase();
        if (st == 'PAID' || st == 'PARTIAL') {
          final amt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
          totalCollected += amt;
          final pDate = (p['payment_date'] ?? p['created_at'] ?? '').toString();
          if (pDate.startsWith(todayStr)) {
            todayCollected += amt;
          } else if (pDate.startsWith(yesterdayStr)) {
            yesterdayCollected += amt;
          }
        }
      }

      for (final p in _additionalPayments) {
        final amt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
        totalCollected += amt;
        final pDate = (p['payment_date'] ?? p['created_at'] ?? '').toString();
        if (pDate.startsWith(todayStr)) {
          todayCollected += amt;
        } else if (pDate.startsWith(yesterdayStr)) {
          yesterdayCollected += amt;
        }
      }

      _feeCollected = totalCollected;
      _todayCollection = todayCollected;
      _yesterdayCollection = yesterdayCollected;
    }

    _applyFilters();
    setState(() {
      _isLoading = false;
    });
  }

  void _checkInitialStudentLedger() {
    if (_initialLedgerOpened || widget.initialStudentId == null) return;
    _initialLedgerOpened = true;
    final target = _processedStudents.firstWhere(
      (s) => s['id'] == widget.initialStudentId,
      orElse: () => {'id': widget.initialStudentId, 'name': 'Student'},
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _openStudentLedger(target);
      }
    });
  }

  void _applyFilters() {
    final query = _searchController.text.trim().toLowerCase();
    List<Map<String, dynamic>> result = List.from(_processedStudents);

    // Filter by Search Name or Roll No
    if (query.isNotEmpty) {
      result = result.where((s) {
        final name = s['name'].toString().toLowerCase();
        final roll = s['roll_no'].toString().toLowerCase();
        return name.contains(query) || roll.contains(query);
      }).toList();
    }

    // Filter by Class (case-insensitive & matches raw name or short name)
    if (_selectedClassFilter != 'ALL') {
      final selectedLower = _selectedClassFilter.trim().toLowerCase();
      result = result.where((s) {
        final cName = (s['class_name'] ?? '').toString().trim().toLowerCase();
        final cShort = _getShortClassName(cName).toLowerCase();
        final cId = (s['class_id'] ?? '').toString();
        return cName == selectedLower || cShort == selectedLower || cId == _selectedClassFilter;
      }).toList();
    }

    // Filter by Status
    if (_selectedStatusFilter != 'ALL') {
      result = result.where((s) => s['calculated_status'] == _selectedStatusFilter).toList();
    }

    // Sorting (Highest Outstanding or Lowest Outstanding, with class ascending as tie-breaker)
    if (_selectedSort == 'OUTSTANDING_ASC') {
      result.sort((a, b) {
        final cmp = (a['outstanding_dues'] as int).compareTo(b['outstanding_dues'] as int);
        if (cmp != 0) return cmp;
        final idxA = _getClassIndex(a['class_name']?.toString());
        final idxB = _getClassIndex(b['class_name']?.toString());
        if (idxA != idxB) return idxA.compareTo(idxB);
        return (a['name'] ?? '').toString().compareTo((b['name'] ?? '').toString());
      });
    } else {
      // Default to OUTSTANDING_DESC
      result.sort((a, b) {
        final cmp = (b['outstanding_dues'] as int).compareTo(a['outstanding_dues'] as int);
        if (cmp != 0) return cmp;
        final idxA = _getClassIndex(a['class_name']?.toString());
        final idxB = _getClassIndex(b['class_name']?.toString());
        if (idxA != idxB) return idxA.compareTo(idxB);
        return (a['name'] ?? '').toString().compareTo((b['name'] ?? '').toString());
      });
    }

    setState(() {
      _filteredStudents = result;
    });
  }

  // Predefined class hierarchy index (matching School Admin portal predefinedClasses.js)
  static int _getClassIndex(String? className) {
    if (className == null || className.trim().isEmpty) return 999;
    final clean = className.trim();
    final lower = clean.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

    if (lower.contains('prenursery') || lower == 'pnc' || lower == 'playgroup' || lower == 'pg') {
      return 0;
    }
    if (lower.contains('nursery') || lower == 'nc') {
      return 1;
    }
    if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower.contains('lkg') || lower == 'lkg') {
      return 2;
    }
    if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower.contains('ukg') || lower == 'ukg') {
      return 3;
    }
    if (lower == 'kg' || lower == 'kindergarten') {
      return 4;
    }

    final match = RegExp(r'\d+').firstMatch(clean);
    if (match != null) {
      final num = int.tryParse(match.group(0)!) ?? 0;
      return 4 + num;
    }
    return 999;
  }

  // Predefined short class name mapping (matching School Admin portal predefinedClasses.js)
  static String _getShortClassName(String? className) {
    if (className == null || className.trim().isEmpty) return '';
    final clean = className.trim();
    final lower = clean.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

    if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower.contains('lkg') || lower == 'lkg') {
      return 'LKG';
    }
    if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower.contains('ukg') || lower == 'ukg') {
      return 'UKG';
    }
    if (lower == 'playgroup' || lower == 'pg') {
      return 'Playgroup';
    }
    if (lower.contains('prenursery') || lower == 'pnc') {
      return 'PNC';
    }
    if (lower.contains('nursery') || lower == 'nc') {
      return 'NC';
    }
    if (lower == 'kg' || lower == 'kindergarten') {
      return 'KG';
    }
    return clean;
  }

  // List of distinct, unique class names in ascending order matching School Admin portal
  List<String> _getAvailableClassNames() {
    final Map<String, String> canonical = {};
    for (final c in _classes) {
      final rawName = (c['name'] ?? '').toString().trim();
      if (rawName.isNotEmpty) {
        final shortName = _getShortClassName(rawName);
        final section = (c['section'] ?? '').toString().trim();
        final label = section.isNotEmpty ? '$shortName ($section)' : shortName;
        canonical[label.toLowerCase()] = label;
      }
    }
    for (final s in _processedStudents) {
      final cn = (s['class_name'] ?? '').toString().trim();
      if (cn.isNotEmpty && cn != 'N/A') {
        final shortName = _getShortClassName(cn);
        if (!canonical.containsKey(shortName.toLowerCase())) {
          canonical[shortName.toLowerCase()] = shortName;
        }
      }
    }
    final sorted = canonical.values.toList();
    sorted.sort((a, b) {
      final idxA = _getClassIndex(a);
      final idxB = _getClassIndex(b);
      if (idxA != idxB) {
        return idxA.compareTo(idxB);
      }
      return a.toLowerCase().compareTo(b.toLowerCase());
    });
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final availableClasses = _getAvailableClassNames();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFBF9F2),
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
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706).withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.account_balance_rounded,
                color: Color(0xFFD97706),
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'FEES PORTAL',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 18,
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: Center(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PendingDiscountRequestsScreen(
                          feeService: _feeService,
                          allStudents: _processedStudents,
                        ),
                      ),
                    );
                    if (mounted) {
                      _loadPortalData();
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFD97706).withValues(alpha: 0.2),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'D',
                          style: TextStyle(
                            color: Color(0xFFB45309),
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      if (_pendingDiscountCount > 0)
                        Positioned(
                          top: -3,
                          right: -3,
                          child: Container(
                            padding: const EdgeInsets.all(3.5),
                            decoration: const BoxDecoration(
                              color: Color(0xFFDC2626),
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                            child: Text(
                              _pendingDiscountCount > 9 ? '9+' : '$_pendingDiscountCount',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                height: 1,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 14.0),
            child: Center(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ManageFinanceFeesScreen(
                          feeService: _feeService,
                        ),
                      ),
                    );
                    _loadPortalData();
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD97706).withValues(alpha: 0.35),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706)),
              ),
            )
          : _errorMessage.isNotEmpty
              ? _buildErrorView()
              : Column(
                  children: [
                    if (_workingAyStatus.toUpperCase() != 'ACTIVE' && _workingAyName.isNotEmpty)
                      _buildWorkingAcademicYearBanner(),
                    // Filter and Search Header
                    _buildFilterSection(availableClasses),
                    // Students List
                    Expanded(
                      child: _filteredStudents.isEmpty
                          ? _buildEmptyState()
                          : RefreshIndicator(
                              onRefresh: _loadPortalData,
                              color: const Color(0xFFD97706),
                              child: ListView.separated(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                itemCount: _filteredStudents.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final s = _filteredStudents[index];
                                  return _buildStudentCard(s);
                                },
                              ),
                            ),
                    ),
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
            const Icon(Icons.error_outline_rounded, color: Colors.red, size: 48),
            const SizedBox(height: 14),
            Text(
              _errorMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF475569)),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _loadPortalData,
              icon: const Icon(Icons.refresh),
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

  Widget _buildSummaryBanner() {
    int totalPending = 0;
    int totalPaid = 0;
    int totalOutstandingAmt = 0;

    for (final s in _filteredStudents) {
      final dues = s['outstanding_dues'] as int;
      if (dues > 0) {
        totalPending++;
        totalOutstandingAmt += dues;
      } else {
        totalPaid++;
      }
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 8, 14, 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        border: Border.all(color: const Color(0xFFFDE68A)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.people_alt_outlined, size: 16, color: Color(0xFF92400E)),
              const SizedBox(width: 6),
              Text(
                '${_filteredStudents.length} Students',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF92400E),
                ),
              ),
            ],
          ),
          Text(
            totalPaid > 0 ? 'Pending: $totalPending  •  Paid: $totalPaid' : 'Pending: $totalPending',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFFB45309),
            ),
          ),
          Text(
            '₹$totalOutstandingAmt',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: Color(0xFFDC2626),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkingAcademicYearBanner() {
    final isArchived = _workingAyStatus.toUpperCase() == 'ARCHIVED';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFFEF3C7),
        border: Border(
          bottom: BorderSide(color: Color(0xFFFDE68A), width: 1),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(Icons.history_rounded, color: Colors.white, size: 14),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      'Session: $_workingAyName',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF92400E),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDE68A),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        isArchived ? 'ARCHIVED' : _workingAyStatus.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF78350F),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 1),
                const Text(
                  'Inactive & alumni students enabled · Deposits credited to active year',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFFB45309),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatIndianCurrency(num value) {
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

  Widget _buildStatsCards() {
    final firstCardTitle = _showYesterday ? "YESTERDAY'S COLLECTION" : "TODAY'S COLLECTION";
    final firstCardAmount = _showYesterday ? _yesterdayCollection : _todayCollection;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Today's / Yesterday's Collection (Double Tap toggles)
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onDoubleTap: () {
                HapticFeedback.lightImpact();
                setState(() {
                  _showYesterday = !_showYesterday;
                });
              },
              child: _buildSingleStatCard(
                title: firstCardTitle,
                amount: firstCardAmount,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // 2. Fee collected (Clickable -> Opens FeesCollectionHistoryScreen)
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => FeesCollectionHistoryScreen(
                        baseUrl: widget.baseUrl,
                        token: widget.token,
                      ),
                    ),
                  );
                },
                child: _buildSingleStatCard(
                  title: "FEE COLLECTED",
                  amount: _feeCollected,
                  isClickable: true,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // 3. Dues pending
          Expanded(
            child: _buildSingleStatCard(
              title: "DUES PENDING",
              amount: _duesPending,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSingleStatCard({
    required String title,
    required num amount,
    bool isClickable = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : null,
        gradient: isDark ? null : const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFBEB), Color(0xFFFEF5D6)],
        ),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isClickable ? const Color(0xFFF59E0B) : (isDark ? const Color(0xFF334155) : const Color(0xFFFCD34D)),
          width: isClickable ? 1.2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.02),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    title,
                    maxLines: 1,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFB45309),
                      letterSpacing: 0.1,
                    ),
                  ),
                ),
              ),
              if (isClickable) ...[
                const SizedBox(width: 2),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 8.5,
                  color: Color(0xFFB45309),
                ),
              ],
            ],
          ),
          const SizedBox(height: 5),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _formatIndianCurrency(amount),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Color(0xFF92400E),
                letterSpacing: -0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterSection(List<String> availableClasses) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      color: isDark ? const Color(0xFF1E293B) : Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: Column(
        children: [
          // 3 Stat Cards above Search Bar (Today's Collection, Fee collected, Dues pending)
          _buildStatsCards(),
          const SizedBox(height: 10),
          // Search box
          Container(
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _searchController,
              textAlignVertical: TextAlignVertical.center,
              textInputAction: TextInputAction.search,
              style: TextStyle(fontSize: 13, color: isDark ? Colors.white : const Color(0xFF0F172A), fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Search by Student Name...',
                hintStyle: TextStyle(fontSize: 13, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF94A3B8), fontWeight: FontWeight.normal),
                prefixIcon: Icon(Icons.search, size: 20, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                prefixIconConstraints: const BoxConstraints(minWidth: 42, minHeight: 44),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.clear, size: 16, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF94A3B8)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 44),
                        onPressed: () {
                          _searchController.clear();
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Filter Dropdowns Row (Equal size, inline with searchbox, rectangular curved)
          Row(
            children: [
              // Class filter
              Expanded(
                child: _buildFilterChip(
                  label: _selectedClassFilter == 'ALL' ? 'All Classes' : _selectedClassFilter,
                  onTap: () => _showClassFilterMenu(availableClasses),
                ),
              ),
              const SizedBox(width: 8),
              // Status filter
              Expanded(
                child: _buildFilterChip(
                  label: _selectedStatusFilter == 'ALL'
                      ? 'All Statuses'
                      : _selectedStatusFilter == 'PENDING' ? 'Pending' : 'Paid',
                  onTap: _showStatusFilterMenu,
                ),
              ),
              const SizedBox(width: 8),
              // Sort / Filter
              Expanded(
                child: _buildFilterChip(
                  label: _selectedSort == 'OUTSTANDING_ASC' ? 'Lowest Dues' : 'Highest Dues',
                  icon: Icons.sort_rounded,
                  onTap: _showSortMenu,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    IconData? icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: const Color(0xFFF59E0B),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: const Color(0xFF78350F)),
              const SizedBox(width: 3),
            ],
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF78350F),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 2),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 16,
              color: Color(0xFF78350F),
            ),
          ],
        ),
      ),
    );
  }

  void _showClassFilterMenu(List<String> classes) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Select Class', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              Expanded(
                child: ListView(
                  children: [
                    ListTile(
                      title: const Text('All Classes'),
                      trailing: _selectedClassFilter == 'ALL' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                      onTap: () {
                        setState(() => _selectedClassFilter = 'ALL');
                        _applyFilters();
                        Navigator.pop(context);
                      },
                    ),
                    ...classes.map((cls) => ListTile(
                          title: Text(cls),
                          trailing: _selectedClassFilter.toLowerCase() == cls.toLowerCase() ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                          onTap: () {
                            setState(() => _selectedClassFilter = cls);
                            _applyFilters();
                            Navigator.pop(context);
                          },
                        )),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showStatusFilterMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Filter by Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              ListTile(
                title: const Text('All Statuses'),
                trailing: _selectedStatusFilter == 'ALL' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                onTap: () {
                  setState(() => _selectedStatusFilter = 'ALL');
                  _applyFilters();
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Pending Only'),
                trailing: _selectedStatusFilter == 'PENDING' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                onTap: () {
                  setState(() => _selectedStatusFilter = 'PENDING');
                  _applyFilters();
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Paid Only'),
                trailing: _selectedStatusFilter == 'PAID' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                onTap: () {
                  setState(() => _selectedStatusFilter = 'PAID');
                  _applyFilters();
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSortMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Sort Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
              ListTile(
                title: const Text('Highest Outstanding First'),
                trailing: _selectedSort == 'OUTSTANDING_DESC' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                onTap: () {
                  setState(() => _selectedSort = 'OUTSTANDING_DESC');
                  _applyFilters();
                  Navigator.pop(context);
                },
              ),
              ListTile(
                title: const Text('Lowest Outstanding First'),
                trailing: _selectedSort == 'OUTSTANDING_ASC' ? const Icon(Icons.check, color: Color(0xFFD97706)) : null,
                onTap: () {
                  setState(() => _selectedSort = 'OUTSTANDING_ASC');
                  _applyFilters();
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_rounded, size: 56, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          const Text(
            'No matching student records found.',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () {
              _searchController.clear();
              setState(() {
                _selectedClassFilter = 'ALL';
                _selectedStatusFilter = 'ALL';
              });
              _applyFilters();
            },
            child: const Text('Reset Filters', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> student) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final name = student['name'] ?? 'Unnamed';
    final className = student['class_name'] ?? 'N/A';
    final rollNo = student['roll_no']?.toString().isNotEmpty == true ? student['roll_no'] : '—';
    final outstanding = student['outstanding_dues'] as int;
    final status = student['calculated_status'] as String;

    final isPending = status == 'PENDING';

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Student basic info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _getShortClassName(className).isNotEmpty ? _getShortClassName(className) : className,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Roll No: $rollNo',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      () {
                        final rawStatus = (student['raw']?['status'] ?? '').toString();
                        final isInactive = rawStatus.toLowerCase() == 'inactive';
                        final isAlumni = rawStatus.toLowerCase() == 'alumni';
                        if (!isInactive && !isAlumni) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: isAlumni ? const Color(0xFFF3E8FF) : const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: isAlumni ? const Color(0xFFDDD6FE) : const Color(0xFFFECACA),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              isAlumni ? 'Alumni' : 'Inactive',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: isAlumni ? const Color(0xFF7E22CE) : const Color(0xFFDC2626),
                              ),
                            ),
                          ),
                        );
                      }(),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // Dues & status pill
                  Row(
                    children: [
                      Text(
                        '₹$outstanding',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: isPending ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: isPending ? const Color(0xFFFEF3C7) : const Color(0xFFD1FAE5),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isPending ? const Color(0xFFFCD34D) : const Color(0xFFA7F3D0),
                          ),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: isPending ? const Color(0xFFB45309) : const Color(0xFF047857),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Action Button: OPEN LEDGER > (for Active AY, or Inactive/Alumni in Archived AY) vs Fees Migrated
            () {
              final isArchivedAY = _workingAyStatus.trim().toUpperCase() == 'ARCHIVED' ||
                  (student['raw']?['academic_year_status']?.toString().toUpperCase() == 'ARCHIVED');
              final rawStatus = (student['raw']?['status'] ?? '').toString().trim().toLowerCase();
              final isInactiveOrAlumni = rawStatus == 'inactive' || rawStatus == 'alumni';
              final bool feesMigrated = isArchivedAY && !isInactiveOrAlumni;

              if (feesMigrated) {
                return InkWell(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          "Fees for ${student['name']} have migrated to the active academic year. Switch to active year to collect fees.",
                        ),
                        backgroundColor: const Color(0xFF475569),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        duration: const Duration(seconds: 3),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFCBD5E1), width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.lock_outline_rounded, size: 13, color: Color(0xFF64748B)),
                        SizedBox(width: 4),
                        Text(
                          'Fees Migrated',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return ElevatedButton(
                onPressed: () => _openStudentLedger(student),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFEF3C7),
                  foregroundColor: const Color(0xFF92400E),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: const BorderSide(color: Color(0xFFFCD34D), width: 1),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  visualDensity: VisualDensity.compact,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Text(
                      'FEES CARD',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    SizedBox(width: 3),
                    Icon(Icons.chevron_right_rounded, size: 16),
                  ],
                ),
              );
            }(),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // STUDENT LEDGER MODAL / SHEET
  // ---------------------------------------------------------------------------
  void _openStudentLedger(Map<String, dynamic> studentSummary) {
    final isArchivedAY = _workingAyStatus.trim().toUpperCase() == 'ARCHIVED' ||
        (studentSummary['raw']?['academic_year_status']?.toString().toUpperCase() == 'ARCHIVED');
    final rawStatus = (studentSummary['raw']?['status'] ?? '').toString().trim().toLowerCase();
    final isInactiveOrAlumni = rawStatus == 'inactive' || rawStatus == 'alumni';
    if (isArchivedAY && !isInactiveOrAlumni) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Fees for ${studentSummary['name']} have migrated to the active academic year. Switch to active year to collect fees.",
          ),
          backgroundColor: const Color(0xFF475569),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StudentLedgerSheet(
          studentId: studentSummary['id'],
          studentSummary: studentSummary,
          feeService: _feeService,
          onPaymentSuccess: () {
            _loadPortalData();
          },
        );
      },
    );
  }
}

void openStudentLedgerSheet({
  required BuildContext context,
  required int studentId,
  required Map<String, dynamic> studentSummary,
  required FeeService feeService,
  VoidCallback? onRefreshNeeded,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return StudentLedgerSheet(
        studentId: studentId,
        studentSummary: studentSummary,
        feeService: feeService,
        onPaymentSuccess: onRefreshNeeded ?? () {},
      );
    },
  );
}

// =============================================================================
// STUDENT LEDGER SHEET COMPONENT
// =============================================================================
class StudentLedgerSheet extends StatefulWidget {
  final int studentId;
  final Map<String, dynamic> studentSummary;
  final FeeService feeService;
  final VoidCallback onPaymentSuccess;

  const StudentLedgerSheet({
    Key? key,
    required this.studentId,
    required this.studentSummary,
    required this.feeService,
    required this.onPaymentSuccess,
  }) : super(key: key);

  @override
  State<StudentLedgerSheet> createState() => _StudentLedgerSheetState();
}

class _StudentLedgerSheetState extends State<StudentLedgerSheet> {
  bool _isLoading = true;
  String _errorMessage = '';
  int _pendingDiscountCount = 0;
  bool _initialLedgerOpened = false;
  Map<String, dynamic> _studentDetail = {};
  Map<String, dynamic>? _pendingDiscountRequest;
  Map<String, int> _monthToPendingRequestId = {};
  Map<int, int> _additionalFeeToPendingRequestId = {};
  Map<String, int> _additionalFeeNameToPendingRequestId = {};
  Map<int, Map<String, dynamic>> _pendingRequestsMap = {};
  int _currentUserId = 0;
  String _currentUserRole = '';
  String _currentUserName = '';
  int _selectedLedgerTab = 0; // 0: Monthly Tuition Fees, 1: Additional Fees

  static const List<String> _academicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  @override
  void initState() {
    super.initState();
    _loadCurrentUserInfo();
    _fetchDetail();
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

  bool _canCancelRequest(int reqId) {
    if (_currentUserRole == 'SCHOOL_ADMIN' || _currentUserRole == 'SUPER_ADMIN' || _currentUserRole == 'ADMIN') {
      return true;
    }
    final r = _pendingRequestsMap[reqId];
    if (r == null) return false;
    final reqUserId = int.tryParse(r['requested_by_id']?.toString() ?? '') ?? 0;
    if (reqUserId > 0 && _currentUserId > 0) {
      return reqUserId == _currentUserId;
    }
    final reqUserName = (r['requested_by'] ?? '').toString().trim();
    if (reqUserName.isNotEmpty && _currentUserName.isNotEmpty) {
      return reqUserName.toLowerCase() == _currentUserName.toLowerCase();
    }
    return false;
  }

  Future<void> _fetchDetail() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      final data = await widget.feeService.fetchStudentDetail(widget.studentId);
      Map<String, dynamic>? pendingReq;
      final Map<String, int> pendingMonthsMap = {};
      final Map<int, int> pendingAddFeesMap = {};
      final Map<String, int> pendingAddFeeNamesMap = {};
      final Map<int, Map<String, dynamic>> pendingRequestsMap = {};
      try {
        final reqs = await widget.feeService.getDiscountRequests(status: 'PENDING');
        final list = (reqs['requests'] as List<dynamic>?) ?? [];
        for (final r in list) {
          final sId = int.tryParse(r['student_id']?.toString() ?? '') ?? 0;
          if (sId == widget.studentId) {
            final reqId = int.tryParse(r['id']?.toString() ?? '') ?? 0;
            if (reqId > 0) {
              pendingRequestsMap[reqId] = Map<String, dynamic>.from(r as Map);
            }
            pendingReq ??= Map<String, dynamic>.from(r as Map);
            final feeType = (r['fee_type'] ?? '').toString().toUpperCase();

            dynamic payload = r['deposit_payload'];
            if (payload is String) {
              try {
                payload = json.decode(payload);
              } catch (_) {}
            }

            if (feeType == 'MONTHLY') {
              List<String> months = [];
              if (payload is Map && payload['months'] is List) {
                months = (payload['months'] as List).map((m) => m.toString()).toList();
              } else if (r['fee_items_summary'] != null) {
                months = r['fee_items_summary']
                    .toString()
                    .split(',')
                    .map((m) => m.trim())
                    .where((m) => m.isNotEmpty)
                    .toList();
              }
              for (final m in months) {
                pendingMonthsMap[m] = reqId;
              }
            } else if (feeType == 'ADDITIONAL') {
              if (payload is Map && payload['fees'] is List) {
                for (final f in payload['fees']) {
                  final fid = int.tryParse(f['id']?.toString() ?? '') ?? 0;
                  if (fid > 0) {
                    pendingAddFeesMap[fid] = reqId;
                  }
                }
              }
              if (r['fee_items_summary'] != null) {
                final names = r['fee_items_summary']
                    .toString()
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .where((s) => s.isNotEmpty);
                for (final name in names) {
                  pendingAddFeeNamesMap[name] = reqId;
                }
              }
            }
          }
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _studentDetail = data;
          _pendingDiscountRequest = pendingReq;
          _monthToPendingRequestId = pendingMonthsMap;
          _additionalFeeToPendingRequestId = pendingAddFeesMap;
          _additionalFeeNameToPendingRequestId = pendingAddFeeNamesMap;
          _pendingRequestsMap = pendingRequestsMap;
          _isLoading = false;
        });
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

  Future<void> _handleCancelDiscountRequest(int reqId, String itemLabel) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Cancel Discount Request',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
            ),
          ),
          content: Text(
            'Are you sure you want to cancel the pending discount request for $itemLabel? Once cancelled, the fee will be available for normal deposit again.',
            style: TextStyle(
              fontSize: 13.5,
              height: 1.4,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                'Keep Request',
                style: TextStyle(
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
              child: const Text('Cancel Request', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        );
      },
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
            backgroundColor: Color(0xFFD97706),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      _fetchDetail();
      widget.onPaymentSuccess();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.92;

    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: Color(0xFFFBF9F2),
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Top Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD97706).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFD97706), size: 20),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'STUDENT LEDGER',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          // Body content
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706))),
                  )
                : _errorMessage.isNotEmpty
                    ? Center(child: Text(_errorMessage, style: const TextStyle(color: Colors.red)))
                    : _buildLedgerBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildLedgerBody() {
    final Map<String, dynamic> studentInfo = (_studentDetail['student'] is Map)
        ? Map<String, dynamic>.from(_studentDetail['student'])
        : Map<String, dynamic>.from(_studentDetail);
    final int resolvedId = studentInfo['id'] != null
        ? (int.tryParse(studentInfo['id'].toString()) ?? widget.studentId)
        : widget.studentId;
    studentInfo['id'] = resolvedId;
    if ((studentInfo['parent_phone'] == null || studentInfo['parent_phone'].toString().trim().isEmpty) &&
        widget.studentSummary['parent_phone'] != null) {
      studentInfo['parent_phone'] = widget.studentSummary['parent_phone'];
    }
    if ((studentInfo['student_mobile'] == null || studentInfo['student_mobile'].toString().trim().isEmpty) &&
        widget.studentSummary['student_mobile'] != null) {
      studentInfo['student_mobile'] = widget.studentSummary['student_mobile'];
    }

    final name = (studentInfo['name'] ?? widget.studentSummary['name'] ?? 'Student').toString();
    final className = (studentInfo['class_name'] ?? widget.studentSummary['class_name'] ?? 'N/A').toString();
    final rollNo = (studentInfo['roll_no'] ?? widget.studentSummary['roll_no'] ?? '—').toString();
    final srNo = (studentInfo['sr_no'] ?? '—').toString();
    final photoRaw = (studentInfo['photo_path'] ??
            widget.studentSummary['photo_path'] ??
            studentInfo['photo'] ??
            widget.studentSummary['photo'] ??
            studentInfo['student_photo'] ??
            widget.studentSummary['student_photo'] ??
            studentInfo['profile_image'] ??
            widget.studentSummary['profile_image'] ??
            _studentDetail['photo_path'] ??
            _studentDetail['photo'] ??
            '').toString().trim();
    String photoUrl = '';
    if (photoRaw.isNotEmpty && photoRaw != 'null' && photoRaw != '—') {
      if (photoRaw.startsWith('http')) {
        photoUrl = photoRaw;
      } else {
        final cleanBase = widget.feeService.baseUrl.replaceAll(RegExp(r'/+$'), '');
        final cleanPath = photoRaw.startsWith('/') ? photoRaw : '/$photoRaw';
        photoUrl = '$cleanBase$cleanPath';
      }
    }

    // Payments list
    final List<dynamic> payments = List<dynamic>.from(
        _studentDetail['fee_summary']?['payments'] ??
        studentInfo['fee_summary']?['payments'] ??
        []);

    // Class fee config monthly fees
    dynamic cfgMonthly = _studentDetail['class_fee_config']?['monthly_fees'] ?? studentInfo['class_fee_config']?['monthly_fees'];
    Map<String, dynamic> monthlyFeeConfig = {};
    if (cfgMonthly is String) {
      try {
        monthlyFeeConfig = Map<String, dynamic>.from(json.decode(cfgMonthly));
      } catch (_) {}
    } else if (cfgMonthly is Map) {
      monthlyFeeConfig = Map<String, dynamic>.from(cfgMonthly);
    }

    // Additional fees list (reads backend additional_fee_payments)
    final List<dynamic> rawAdditional = List<dynamic>.from(
        _studentDetail['additional_fee_payments'] ??
        _studentDetail['additional_fees'] ??
        studentInfo['additional_fee_payments'] ??
        studentInfo['additional_fees'] ??
        []);

    double totalAdditionalDues = 0.0;
    final List<Map<String, dynamic>> processedAdditional = [];
    for (final item in rawAdditional) {
      final id = int.tryParse(item['id']?.toString() ?? '0') ?? 0;
      final feeName = (item['fee_name'] ?? 'Additional Fee').toString().trim().toUpperCase();
      final total = double.tryParse(item['amount']?.toString() ?? '0') ?? 0.0;
      final paid = double.tryParse(item['amount_paid']?.toString() ?? '0') ?? 0.0;
      final disc = double.tryParse(item['discount_amount']?.toString() ?? '0') ?? 0.0;
      final rem = (total - paid - disc).clamp(0.0, double.infinity);
      final rawStatus = (item['status'] ?? 'Pending').toString();
      String status = 'Pending';
      if (rem <= 0.01 || rawStatus.toLowerCase() == 'paid') {
        status = 'Paid';
      } else if ((paid + disc) > 0.01) {
        status = 'Partially Paid';
      }
      if (status != 'Paid') {
        totalAdditionalDues += rem;
      }
      processedAdditional.add({
        'id': id,
        'fee_name': feeName,
        'amount': total,
        'amount_paid': paid,
        'discount_amount': disc,
        'remaining': rem,
        'status': status,
        'due_date': item['due_date'],
        'raw': item,
      });
    }

    final List<Map<String, dynamic>> unpaidAdditional = processedAdditional
        .where((f) => (f['remaining'] as double) > 0.01)
        .toList();

    // Compute monthly breakdown
    double totalTuitionDues = 0.0;
    final List<Map<String, dynamic>> monthRows = [];

    for (final m in _academicMonths) {
      final configuredFee = double.tryParse(monthlyFeeConfig[m]?.toString() ?? '0') ?? 0.0;
      final paidThisMonth = payments
          .where((p) => (p['fee_month'] ?? '').toString().trim() == m)
          .fold<double>(0.0, (sum, p) {
        final amt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
        final disc = double.tryParse(p['discount_amount']?.toString() ?? '0') ?? 0.0;
        return sum + amt + disc;
      });

      final remaining = (configuredFee - paidThisMonth).clamp(0.0, double.infinity);
      totalTuitionDues += remaining;

      String status = 'UNPAID';
      if (configuredFee > 0 && remaining <= 0.01) {
        status = 'PAID';
      } else if (paidThisMonth > 0 && remaining > 0.01) {
        status = 'PARTIAL';
      }

      monthRows.add({
        'month': m,
        'fee': configuredFee.round(),
        'paid': paidThisMonth.round(),
        'remaining': remaining.round(),
        'status': status,
      });
    }

    return Column(
      children: [
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onHorizontalDragEnd: (details) {
              if (details.primaryVelocity != null) {
                if (details.primaryVelocity! < -200) {
                  // Swipe Left -> Additional Tab
                  if (_selectedLedgerTab != 1) {
                    setState(() => _selectedLedgerTab = 1);
                  }
                } else if (details.primaryVelocity! > 200) {
                  // Swipe Right -> Monthly Tab
                  if (_selectedLedgerTab != 0) {
                    setState(() => _selectedLedgerTab = 0);
                  }
                }
              }
            },
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_pendingDiscountRequest != null) ...[
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shield_outlined, size: 20, color: Color(0xFFD97706)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Discount Approval Pending',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF92400E),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'A discount request of ₹${(double.tryParse(_pendingDiscountRequest!['discount_amount']?.toString() ?? '0') ?? 0).round()} has been submitted and is awaiting School Admin approval.',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFB45309),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  // Student Profile Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Left aligned student photo
                      _buildLedgerStudentAvatar(photoUrl, name, resolvedId),
                      const SizedBox(width: 14),

                      // Right: Student details
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Student Name
                            Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 6),
                            // Class, Roll No & SR No as plain text
                            Wrap(
                              spacing: 14,
                              runSpacing: 3,
                              children: [
                                Text(
                                  'Class: $className',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                Text(
                                  'Roll No: $rollNo',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                Text(
                                  'SR No: $srNo',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Tab Switcher (Monthly vs Additional)
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedLedgerTab = 0),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              color: _selectedLedgerTab == 0 ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(9),
                              boxShadow: _selectedLedgerTab == 0
                                  ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]
                                  : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Monthly',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: _selectedLedgerTab == 0 ? FontWeight.w800 : FontWeight.w600,
                                    color: _selectedLedgerTab == 0 ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                                  ),
                                ),
                                if (totalTuitionDues > 0) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEE2E2),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '₹${totalTuitionDues.round()}',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedLedgerTab = 1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              color: _selectedLedgerTab == 1 ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(9),
                              boxShadow: _selectedLedgerTab == 1
                                  ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]
                                  : null,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Additional',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: _selectedLedgerTab == 1 ? FontWeight.w800 : FontWeight.w600,
                                    color: _selectedLedgerTab == 1 ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                                  ),
                                ),
                                if (totalAdditionalDues > 0) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      '₹${totalAdditionalDues.round()}',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // TAB 0: MONTHLY TUITION BREAKDOWN
                if (_selectedLedgerTab == 0) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Monthly Tuition Fees Breakdown',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                      ),
                      if (monthRows.where((m) => (m['status'] as String) != 'PAID' && (m['fee'] as num) > 0).isNotEmpty)
                        Text(
                          '${monthRows.where((m) => (m['status'] as String) != 'PAID' && (m['fee'] as num) > 0).length} Unpaid',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: monthRows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final mRow = monthRows[index];
                      final monthName = (mRow['month'] as String);
                      final mStatus = mRow['status'] as String;
                      final isPaid = mStatus == 'PAID';
                      final isPartial = mStatus == 'PARTIAL';
                      final fee = (mRow['fee'] as num).round();
                      final paid = (mRow['paid'] as num).round();
                      final rem = (mRow['remaining'] as num).round();
                      final monthPayments = payments
                          .where((p) => (p['fee_month'] ?? '').toString().trim().toLowerCase() == monthName.toLowerCase())
                          .map((p) => {
                                if (p is Map) ...Map<String, dynamic>.from(p),
                                'remaining': mRow['remaining'],
                                'fee': mRow['fee'],
                              })
                          .toList();
                      final pendingReqId = _monthToPendingRequestId[monthName];
                      final isWaitingApproval = pendingReqId != null;

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isWaitingApproval
                                ? const Color(0xFFFDE68A)
                                : (!isPaid ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0)),
                            width: isWaitingApproval ? 1.5 : 1.0,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    monthName.toUpperCase(),
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                  ),
                                ),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isWaitingApproval)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFFDE68A)),
                                        ),
                                        child: const Text(
                                          'WAITING FOR APPROVAL',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                            color: Color(0xFFD97706),
                                          ),
                                        ),
                                      )
                                    else
                                      Container(
                                        width: 62,
                                        height: 24,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: isPaid
                                              ? const Color(0xFFD1FAE5)
                                              : isPartial
                                                  ? const Color(0xFFDBEAFE)
                                                  : const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          mStatus,
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                            color: isPaid
                                              ? const Color(0xFF065F46)
                                              : isPartial
                                                  ? const Color(0xFF1E40AF)
                                                  : const Color(0xFF92400E),
                                          ),
                                        ),
                                      ),
                                    if (!isWaitingApproval && (isPaid || isPartial)) ...[
                                      () {
                                        final cleanMonthPayments = monthPayments.where((p) {
                                          if (p is Map) {
                                            final r = p['receipt_no']?.toString().trim();
                                            final pid = p['id'];
                                            return (r != null && r.isNotEmpty) || (pid != null && pid != 0);
                                          }
                                          return false;
                                        }).toList();
                                        cleanMonthPayments.sort((a, b) => ((a['id'] ?? 0) as num).compareTo((b['id'] ?? 0) as num));

                                        if (cleanMonthPayments.isEmpty) {
                                          return const SizedBox.shrink();
                                        }

                                        if (cleanMonthPayments.length == 1) {
                                          return Padding(
                                            padding: const EdgeInsets.only(left: 6),
                                            child: _buildReceiptIconBtn(
                                              onTap: () {
                                                _showReceiptBottomSheet(
                                                  studentInfo: studentInfo,
                                                  title: '$monthName Tuition Fee',
                                                  payments: _expandMonthlyPaymentsByReceipt(
                                                    cleanMonthPayments,
                                                    payments,
                                                    monthRows,
                                                  ),
                                                  isAdditional: false,
                                                );
                                              },
                                            ),
                                          );
                                        }

                                        return Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: List.generate(cleanMonthPayments.length, (idx) {
                                            final p = cleanMonthPayments[idx];
                                            return Padding(
                                              padding: const EdgeInsets.only(left: 6),
                                              child: _buildReceiptIconBtn(
                                                badgeNumber: idx + 1,
                                                onTap: () {
                                                  _showReceiptBottomSheet(
                                                    studentInfo: studentInfo,
                                                    title: '$monthName Tuition Fee (Part ${idx + 1})',
                                                    payments: _expandMonthlyPaymentsByReceipt(
                                                      [p],
                                                      payments,
                                                      monthRows,
                                                    ),
                                                    isAdditional: false,
                                                  );
                                                },
                                              ),
                                            );
                                          }),
                                        );
                                      }(),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                            const Divider(height: 16, color: Color(0xFFF1F5F9)),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      paid > 0
                                          ? 'Amount: ₹$fee  •  Paid: ₹$paid'
                                          : 'Amount: ₹$fee',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      rem > 0 ? 'Due: ₹$rem' : 'Paid in Full',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: rem > 0 ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                                      ),
                                    ),
                                  ],
                                ),
                                if (rem > 0.01)
                                  isWaitingApproval
                                      ? (_canCancelRequest(pendingReqId)
                                          ? ElevatedButton(
                                              onPressed: () => _handleCancelDiscountRequest(pendingReqId, monthName),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(0xFFDC2626),
                                                foregroundColor: Colors.white,
                                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                minimumSize: Size.zero,
                                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                              ),
                                              child: const Text('Cancel Request', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                                            )
                                          : const SizedBox.shrink())
                                      : ElevatedButton(
                                          onPressed: () => _openDepositModal(
                                            student: studentInfo,
                                            payments: payments,
                                            classFeeConfig: _studentDetail['class_fee_config'] ?? studentInfo['class_fee_config'],
                                            initialSelectedMonth: monthName,
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFFD97706),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                            minimumSize: Size.zero,
                                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                          ),
                                          child: const Text('Deposit', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                                        ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],

                // TAB 1: ADDITIONAL & ANNUAL FEES
                if (_selectedLedgerTab == 1) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Additional & Annual Fees',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                      ),
                      if (unpaidAdditional.isNotEmpty)
                        Text(
                          '${unpaidAdditional.length} Unpaid',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (processedAdditional.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: const [
                          Icon(Icons.inventory_2_outlined, size: 36, color: Color(0xFF94A3B8)),
                          SizedBox(height: 8),
                          Text(
                            'No additional fees found for this student.',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: processedAdditional.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, idx) {
                        final af = processedAdditional[idx];
                        final feeId = af['id'] as int;
                        final title = af['fee_name'] as String;
                        final total = af['amount'] as double;
                        final paid = af['amount_paid'] as double;
                        final disc = af['discount_amount'] as double;
                        final rem = af['remaining'] as double;
                        final status = af['status'] as String;
                        final isPaid = status == 'Paid';
                        final isPartial = status == 'Partially Paid';
                        final dueDate = af['due_date'];
                        final pendingReqId = _additionalFeeToPendingRequestId[feeId] ?? _additionalFeeNameToPendingRequestId[title.toUpperCase()];
                        final isWaitingApproval = pendingReqId != null;

                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isWaitingApproval
                                  ? const Color(0xFFFDE68A)
                                  : (!isPaid ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0)),
                              width: isWaitingApproval ? 1.5 : 1.0,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      title.toUpperCase(),
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                    ),
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (isWaitingApproval)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEF3C7),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: const Color(0xFFFDE68A)),
                                          ),
                                          child: const Text(
                                            'WAITING FOR APPROVAL',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: 0.3,
                                              color: Color(0xFFD97706),
                                            ),
                                          ),
                                        )
                                      else
                                        Container(
                                          width: 62,
                                          height: 24,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: isPaid
                                                ? const Color(0xFFD1FAE5)
                                                : isPartial
                                                    ? const Color(0xFFDBEAFE)
                                                    : const Color(0xFFFEF3C7),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            isPartial ? 'PARTIAL' : (isPaid ? 'PAID' : 'UNPAID'),
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: 0.3,
                                              color: isPaid
                                                  ? const Color(0xFF065F46)
                                                  : isPartial
                                                      ? const Color(0xFF1E40AF)
                                                      : const Color(0xFF92400E),
                                            ),
                                          ),
                                        ),
                                      if (!isWaitingApproval && (isPaid || isPartial)) ...[
                                        () {
                                          final cleanAfPayments = _extractCleanAfPayments(af);

                                          if (cleanAfPayments.isEmpty) {
                                            return const SizedBox.shrink();
                                          }

                                          if (cleanAfPayments.length == 1) {
                                            final p = cleanAfPayments.first;
                                            return Padding(
                                              padding: const EdgeInsets.only(left: 6),
                                              child: _buildReceiptIconBtn(
                                                onTap: () {
                                                  _showReceiptBottomSheet(
                                                    studentInfo: studentInfo,
                                                    title: title,
                                                    payments: _expandAdditionalPaymentsByReceipt(
                                                      [p],
                                                      processedAdditional,
                                                    ),
                                                    isAdditional: true,
                                                  );
                                                },
                                              ),
                                            );
                                          }

                                          return Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: List.generate(cleanAfPayments.length, (idx) {
                                              final p = cleanAfPayments[idx];
                                              return Padding(
                                                padding: const EdgeInsets.only(left: 6),
                                                child: _buildReceiptIconBtn(
                                                  badgeNumber: idx + 1,
                                                  onTap: () {
                                                    _showReceiptBottomSheet(
                                                      studentInfo: studentInfo,
                                                      title: '$title (Part ${idx + 1})',
                                                      payments: _expandAdditionalPaymentsByReceipt(
                                                        [p],
                                                        processedAdditional,
                                                      ),
                                                      isAdditional: true,
                                                    );
                                                  },
                                                ),
                                              );
                                            }),
                                          );
                                        }(),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                              if (dueDate != null && dueDate.toString().isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  'Due Date: $dueDate',
                                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                                ),
                              ],
                              const Divider(height: 16, color: Color(0xFFF1F5F9)),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        paid > 0
                                            ? 'Amount: ₹${total.round()}  •  Paid: ₹${paid.round()}${disc > 0 ? ' (Disc: ₹${disc.round()})' : ''}'
                                            : 'Amount: ₹${total.round()}${disc > 0 ? ' (Disc: ₹${disc.round()})' : ''}',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        rem > 0 ? 'Due: ₹${rem.round()}' : 'Paid in Full',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: rem > 0 ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (rem > 0.01)
                                    isWaitingApproval
                                        ? (_canCancelRequest(pendingReqId)
                                            ? ElevatedButton(
                                                onPressed: () => _handleCancelDiscountRequest(pendingReqId, title),
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: const Color(0xFFDC2626),
                                                  foregroundColor: Colors.white,
                                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                  minimumSize: Size.zero,
                                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                ),
                                                child: const Text('Cancel Request', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                                              )
                                            : const SizedBox.shrink())
                                        : ElevatedButton(
                                            onPressed: () => _openAdditionalDepositModal(
                                              student: studentInfo,
                                              unpaidFees: unpaidAdditional,
                                              initialSelectedIds: [feeId],
                                            ),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(0xFFD97706),
                                              foregroundColor: Colors.white,
                                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                            ),
                                            child: const Text('Deposit', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                                          ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                ],
              ],
            ),
          ),
        ),
        ),

        // Bottom Action Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SafeArea(
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: _selectedLedgerTab == 0
                  ? () {
                      final availableMonths = monthRows.where((m) => (m['remaining'] as num) > 0.01 && !_monthToPendingRequestId.containsKey(m['month'])).toList();
                      final allPending = totalTuitionDues > 0 && availableMonths.isEmpty && _monthToPendingRequestId.isNotEmpty;

                      return ElevatedButton.icon(
                        onPressed: (totalTuitionDues <= 0 || allPending)
                            ? null
                            : () => _openDepositModal(
                                  student: studentInfo,
                                  payments: payments,
                                  classFeeConfig: _studentDetail['class_fee_config'] ?? studentInfo['class_fee_config'],
                                ),
                        icon: const Icon(Icons.payment_rounded, size: 18),
                        label: Text(
                          allPending
                              ? 'Tuition Fees Waiting for Approval'
                              : (totalTuitionDues > 0
                                  ? 'Deposit Tuition Fees (₹${totalTuitionDues.round()})'
                                  : (monthRows.every((m) => (m['fee'] as num) == 0)
                                      ? 'Tuition Fee Not Configured'
                                      : 'Tuition Fees Fully Paid')),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.grey.shade300,
                          disabledForegroundColor: Colors.grey.shade600,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      );
                    }()
                  : () {
                      final availableAddFees = unpaidAdditional.where((f) {
                        final id = f['id'];
                        final name = (f['fee_name'] ?? '').toString().trim().toUpperCase();
                        return !_additionalFeeToPendingRequestId.containsKey(id) &&
                            !_additionalFeeNameToPendingRequestId.containsKey(name);
                      }).toList();
                      final allPending = unpaidAdditional.isNotEmpty &&
                          availableAddFees.isEmpty &&
                          (_additionalFeeToPendingRequestId.isNotEmpty || _additionalFeeNameToPendingRequestId.isNotEmpty);

                      return ElevatedButton.icon(
                        onPressed: (unpaidAdditional.isEmpty || allPending)
                            ? null
                            : () => _openAdditionalDepositModal(
                                  student: studentInfo,
                                  unpaidFees: availableAddFees,
                                ),
                        icon: const Icon(Icons.add_card_rounded, size: 18),
                        label: Text(
                          allPending
                              ? 'Additional Fees Waiting for Approval'
                              : (unpaidAdditional.isNotEmpty
                                  ? 'Deposit Additional Fees (₹${totalAdditionalDues.round()})'
                                  : 'All Additional Fees Paid'),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.grey.shade300,
                          disabledForegroundColor: Colors.grey.shade600,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      );
                    }(),
            ),
          ),
        ),
      ],
    );
  }

  void _openDepositModal({
    required Map<String, dynamic> student,
    required List<dynamic> payments,
    required dynamic classFeeConfig,
    String? initialSelectedMonth,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return _DepositDialog(
          studentId: widget.studentId,
          student: student,
          payments: payments,
          classFeeConfig: classFeeConfig,
          feeService: widget.feeService,
          initialSelectedMonth: initialSelectedMonth,
          onSuccess: () {
            _fetchDetail();
            widget.onPaymentSuccess();
          },
        );
      },
    );
  }

  void _openAdditionalDepositModal({
    required Map<String, dynamic> student,
    required List<Map<String, dynamic>> unpaidFees,
    List<int>? initialSelectedIds,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return _AdditionalDepositModal(
          studentId: widget.studentId,
          student: student,
          unpaidFees: unpaidFees,
          initialSelectedIds: initialSelectedIds ?? [],
          feeService: widget.feeService,
          onSuccess: () {
            _fetchDetail();
            widget.onPaymentSuccess();
          },
        );
      },
    );
  }

  Widget _buildReceiptIconBtn({
    required VoidCallback onTap,
    int? badgeNumber,
  }) {
    final baseButton = Container(
      width: 28,
      height: 24,
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: const Icon(
        Icons.receipt_long_rounded,
        size: 14,
        color: Color(0xFFB45309),
      ),
    );

    if (badgeNumber == null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: baseButton,
      );
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          baseButton,
          Positioned(
            top: -6,
            right: -6,
            child: Container(
              padding: const EdgeInsets.all(2.5),
              constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.2),
              ),
              child: Center(
                child: Text(
                  '$badgeNumber',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    height: 1.0,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _expandMonthlyPaymentsByReceipt(
    List<dynamic> seedPayments,
    List<dynamic> allPayments,
    List<Map<String, dynamic>> monthRows,
  ) {
    final Map<String, dynamic> remainingByMonth = {};
    final Map<String, dynamic> feeByMonth = {};
    for (final m in monthRows) {
      final key = (m['month'] ?? '').toString().trim().toLowerCase();
      if (key.isNotEmpty) {
        remainingByMonth[key] = m['remaining'];
        feeByMonth[key] = m['fee'];
      }
    }

    final Set<String> targetReceipts = {};
    for (final p in seedPayments) {
      if (p is Map) {
        final rno = (p['receipt_no'] ?? '').toString().trim();
        if (rno.isNotEmpty && rno != '—' && !rno.startsWith('REC-0')) {
          targetReceipts.add(rno);
        }
      }
    }

    final List<Map<String, dynamic>> combined = [];
    final Set<String> seenKeys = {};

    void addRow(dynamic raw) {
      if (raw is! Map) return;
      final p = Map<String, dynamic>.from(raw);
      final key = '${p['id'] ?? ''}_${p['fee_month'] ?? ''}_${p['receipt_no'] ?? ''}';
      if (seenKeys.contains(key)) return;
      seenKeys.add(key);

      final mKey = (p['fee_month'] ?? '').toString().trim().toLowerCase();
      if (remainingByMonth.containsKey(mKey)) {
        p['remaining'] = remainingByMonth[mKey];
      }
      if (feeByMonth.containsKey(mKey)) {
        p['fee'] = feeByMonth[mKey];
      }
      combined.add(p);
    }

    for (final p in seedPayments) {
      addRow(p);
    }
    if (targetReceipts.isNotEmpty) {
      for (final p in allPayments) {
        if (p is Map) {
          final rno = (p['receipt_no'] ?? '').toString().trim();
          if (targetReceipts.contains(rno)) {
            addRow(p);
          }
        }
      }
    }

    return combined;
  }

  List<Map<String, dynamic>> _extractCleanAfPayments(Map<String, dynamic> af) {
    final title = (af['fee_name'] ?? 'Additional Fee').toString();
    final rawMap = af['raw'] is Map ? Map<String, dynamic>.from(af['raw']) : Map<String, dynamic>.from(af);
    final afPayments = ((rawMap['payments'] ?? af['payments']) as List<dynamic>?) ?? [];
    final clean = <Map<String, dynamic>>[];

    for (final p in afPayments) {
      if (p is Map) {
        final r = p['receipt_no']?.toString().trim();
        final pid = p['id'];
        if ((r != null && r.isNotEmpty) || (pid != null && pid != 0)) {
          clean.add({
            ...Map<String, dynamic>.from(p),
            'fee_name': title,
            'remaining': af['remaining'],
            'fee': af['amount'] ?? af['fee'],
          });
        }
      }
    }

    if (clean.isEmpty) {
      final curRno = (rawMap['receipt_no'] ?? af['receipt_no'] ?? '').toString().trim();
      if (curRno.isNotEmpty || (af['id'] != null && af['id'] != 0)) {
        clean.add({
          ...rawMap,
          'fee_name': title,
          'remaining': af['remaining'],
          'fee': af['amount'] ?? af['fee'],
        });
      }
    }

    clean.sort((a, b) => ((a['id'] ?? 0) as num).compareTo((b['id'] ?? 0) as num));
    return clean;
  }

  List<Map<String, dynamic>> _expandAdditionalPaymentsByReceipt(
    List<Map<String, dynamic>> seedPayments,
    List<Map<String, dynamic>> processedAdditional,
  ) {
    final Set<String> targetReceipts = {};
    for (final p in seedPayments) {
      final rno = (p['receipt_no'] ?? '').toString().trim();
      if (rno.isNotEmpty && rno != '—' && !rno.startsWith('REC-0')) {
        targetReceipts.add(rno);
      }
    }

    final List<Map<String, dynamic>> combined = [];
    final Set<String> seenKeys = {};

    void addRow(Map<String, dynamic> raw) {
      final p = Map<String, dynamic>.from(raw);
      final key = '${p['id'] ?? ''}_${p['fee_name'] ?? ''}_${p['receipt_no'] ?? ''}';
      if (seenKeys.contains(key)) return;
      seenKeys.add(key);
      combined.add(p);
    }

    for (final p in seedPayments) {
      addRow(p);
    }
    if (targetReceipts.isNotEmpty) {
      for (final af in processedAdditional) {
        for (final p in _extractCleanAfPayments(af)) {
          final rno = (p['receipt_no'] ?? '').toString().trim();
          if (targetReceipts.contains(rno)) {
            addRow(p);
          }
        }
      }
    }

    return combined;
  }

  void _showReceiptBottomSheet({
    required Map<String, dynamic> studentInfo,
    required String title,
    required List<dynamic> payments,
    required bool isAdditional,
  }) {
    final mergedStudentInfo = Map<String, dynamic>.from(studentInfo);
    if ((mergedStudentInfo['parent_phone'] == null || mergedStudentInfo['parent_phone'].toString().trim().isEmpty) &&
        widget.studentSummary['parent_phone'] != null) {
      mergedStudentInfo['parent_phone'] = widget.studentSummary['parent_phone'];
    }
    if ((mergedStudentInfo['student_mobile'] == null || mergedStudentInfo['student_mobile'].toString().trim().isEmpty) &&
        widget.studentSummary['student_mobile'] != null) {
      mergedStudentInfo['student_mobile'] = widget.studentSummary['student_mobile'];
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ReceiptShareSheet(
        studentInfo: mergedStudentInfo,
        title: title,
        payments: payments,
        isAdditional: isAdditional,
        feeService: widget.feeService,
      ),
    );
  }

  Widget _buildLedgerStudentAvatar(String photoUrl, String name, [dynamic studentId]) {
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'S';
    final heroTag = 'ledger_student_avatar_${studentId ?? name}';
    return GestureDetector(
      onTap: () {
        if (photoUrl.isNotEmpty) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => FullScreenImageScreen(
                imageUrl: photoUrl,
                title: name,
                heroTag: heroTag,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No profile photo uploaded for this student.'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );
        }
      },
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFFF1F5F9),
              border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
            ),
            child: ClipOval(
              child: photoUrl.isNotEmpty
                  ? Hero(
                      tag: heroTag,
                      child: CachedNetworkImage(
                        imageUrl: photoUrl,
                        width: 66,
                        height: 66,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Center(
                          child: Text(
                            initial,
                            style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ),
                        errorWidget: (context, url, error) => Center(
                          child: Text(
                            initial,
                            style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ),
            ),
          ),
          if (photoUrl.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(3.5),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.18),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: const Icon(
                Icons.fullscreen_rounded,
                size: 13,
                color: Color(0xFF475569),
              ),
            ),
        ],
      ),
    );
  }
}

// =============================================================================
// FEE RECEIPT BOTTOM SHEET & SHARING
// =============================================================================
class _ReceiptShareSheet extends StatefulWidget {
  final Map<String, dynamic> studentInfo;
  final String title;
  final List<dynamic> payments;
  final bool isAdditional;
  final FeeService feeService;

  const _ReceiptShareSheet({
    Key? key,
    required this.studentInfo,
    required this.title,
    required this.payments,
    required this.isAdditional,
    required this.feeService,
  }) : super(key: key);

  @override
  State<_ReceiptShareSheet> createState() => _ReceiptShareSheetState();
}

class _ReceiptShareSheetState extends State<_ReceiptShareSheet> {
  int? _loadingPaymentId;

  Future<void> _shareReceipt(int paymentId, String receiptNo, String itemTitle) async {
    setState(() => _loadingPaymentId = paymentId);
    try {
      final studentId = int.tryParse(widget.studentInfo['id']?.toString() ?? '0') ?? 0;
      final pdfBytes = await widget.feeService.downloadFeeReceipt(
        studentId,
        paymentId,
        isAdditional: widget.isAdditional,
        receiptNo: receiptNo,
      );
      final cleanName = itemTitle.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final fileName = '${cleanName}_Receipt_${receiptNo}.pdf';

      bool nativeShared = false;
      try {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        final res = await platform.invokeMethod('sharePdf', {
          'fileName': fileName,
          'bytes': pdfBytes,
        });
        if (res == true) {
          nativeShared = true;
        }
      } catch (nativeErr) {
        debugPrint('Native sharePdf failed: $nativeErr');
      }

      if (!nativeShared) {
        await Printing.sharePdf(
          bytes: pdfBytes,
          filename: fileName,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to share receipt: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loadingPaymentId = null);
      }
    }
  }

  String _formatReceiptDate(dynamic payment) {
    if (payment is! Map) return '—';
    final p = Map<String, dynamic>.from(payment);
    String datePart = '';
    final rawDate = (p['payment_date'] ?? p['created_at'] ?? '').toString().trim();
    if (rawDate.isNotEmpty) {
      final dateOnly = rawDate.split(' ')[0].split('T')[0];
      final parts = dateOnly.split('-');
      if (parts.length == 3) {
        if (parts[0].length == 4) {
          // YYYY-MM-DD -> DD-MM-YYYY
          datePart = '${parts[2].padLeft(2, '0')}-${parts[1].padLeft(2, '0')}-${parts[0]}';
        } else {
          datePart = dateOnly;
        }
      } else {
        datePart = dateOnly;
      }
    } else {
      datePart = '—';
    }

    String timePart = '';
    final rawCreatedAt = (p['created_at'] ?? p['updated_at'] ?? p['payment_date'] ?? '').toString().trim();
    if (rawCreatedAt.isNotEmpty && (rawCreatedAt.contains(' ') || rawCreatedAt.contains('T'))) {
      try {
        final dt = DateTime.parse(rawCreatedAt.replaceFirst(' ', 'T')).toLocal();
        final hour = dt.hour;
        final minute = dt.minute.toString().padLeft(2, '0');
        final period = hour >= 12 ? 'PM' : 'AM';
        final h12 = hour % 12 == 0 ? 12 : hour % 12;
        timePart = '$h12:$minute $period';
      } catch (_) {
        final timeMatch = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(rawCreatedAt);
        if (timeMatch != null) {
          final int h = int.tryParse(timeMatch.group(1)!) ?? 0;
          final String m = timeMatch.group(2)!;
          final String period = h >= 12 ? 'PM' : 'AM';
          final int h12 = h % 12 == 0 ? 12 : h % 12;
          timePart = '$h12:$m $period';
        }
      }
    }

    if (timePart.isNotEmpty) {
      return '$datePart ($timePart)';
    }
    return datePart;
  }

  @override
  Widget build(BuildContext context) {
    final studentName = (widget.studentInfo['name'] ??
            '${widget.studentInfo['first_name'] ?? ''} ${widget.studentInfo['last_name'] ?? ''}')
        .toString()
        .trim();
    final className = (widget.studentInfo['class_name'] ?? '—').toString();
    final rollNo = (widget.studentInfo['roll_no'] ?? '—').toString();
    final srNo = (widget.studentInfo['sr_no'] ?? '—').toString();
    final phone = (widget.studentInfo['parent_phone'] ??
            widget.studentInfo['student_mobile'] ??
            widget.studentInfo['mobile_number'] ??
            widget.studentInfo['mobile'] ??
            widget.studentInfo['phone'] ??
            widget.studentInfo['emergency_phone'] ??
            widget.studentInfo['father_phone'] ??
            widget.studentInfo['mother_phone'] ??
            '')
        .toString()
        .trim();
    final hasValidPhone = phone.isNotEmpty && phone != '—' && phone != 'null';

    // Consolidate payments by receipt_no so multiple months / additional fees deposited in 1 transaction form 1 single receipt slip!
    const academicMonths = [
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
      'January',
      'February',
      'March',
    ];
    final List<Map<String, dynamic>> consolidatedSlips = [];
    final Map<String, List<Map<String, dynamic>>> byReceipt = {};
    final List<Map<String, dynamic>> noReceipt = [];

    for (final rawP in widget.payments) {
      if (rawP is! Map) continue;
      final p = Map<String, dynamic>.from(rawP);
      final rno = (p['receipt_no'] ?? '').toString().trim();
      if (rno.isNotEmpty && rno != '—' && !rno.startsWith('REC-0')) {
        byReceipt.putIfAbsent(rno, () => []).add(p);
      } else {
        noReceipt.add(p);
      }
    }

    for (final entry in byReceipt.entries) {
      final rno = entry.key;
      final group = entry.value;
      final first = group.first;
      final primaryPid = int.tryParse(first['id']?.toString() ?? '0') ?? 0;

      final totalAmt = group.fold<double>(0.0, (sum, item) {
        final amt = double.tryParse(item['amount_paid']?.toString() ?? item['amount']?.toString() ?? '0') ?? 0.0;
        return sum + amt;
      });
      final totalDisc = group.fold<double>(0.0, (sum, item) {
        return sum + (double.tryParse(item['discount_amount']?.toString() ?? '0') ?? 0.0);
      });

      final Map<String, double> remByItem = {};
      for (final item in group) {
        final itemKey = widget.isAdditional
            ? (item['fee_name'] ?? item['name'] ?? item['id'] ?? '').toString().trim().toLowerCase()
            : (item['fee_month'] ?? item['month'] ?? item['id'] ?? '').toString().trim().toLowerCase();
        final remVal = double.tryParse(item['remaining']?.toString() ?? '0') ?? 0.0;
        if (!remByItem.containsKey(itemKey) || remVal > remByItem[itemKey]!) {
          remByItem[itemKey] = remVal;
        }
      }
      final totalRem = remByItem.values.fold<double>(0.0, (sum, v) => sum + v);

      String desc = '';
      if (widget.isAdditional) {
        final names = group
            .map((item) => (item['fee_name'] ?? item['name'] ?? item['fee_month'] ?? '').toString().trim())
            .where((n) => n.isNotEmpty)
            .toSet()
            .toList();
        desc = names.isNotEmpty ? names.join(', ') : widget.title;
      } else {
        final months = group
            .map((item) => (item['fee_month'] ?? item['month'] ?? '').toString().trim())
            .where((m) => m.isNotEmpty)
            .toSet()
            .toList();
        months.sort((a, b) {
          final idxA = academicMonths.indexWhere((m) => m.toLowerCase() == a.toLowerCase());
          final idxB = academicMonths.indexWhere((m) => m.toLowerCase() == b.toLowerCase());
          return (idxA == -1 ? 99 : idxA).compareTo(idxB == -1 ? 99 : idxB);
        });

        if (months.length > 1) {
          final indices = months
              .map((m) => academicMonths.indexWhere((am) => am.toLowerCase() == m.toLowerCase()))
              .where((idx) => idx != -1)
              .toList();
          final isConsecutive = indices.length == months.length &&
              List.generate(indices.length - 1, (i) => indices[i + 1] == indices[i] + 1).every((ok) => ok);
          desc = isConsecutive ? '${months.first} to ${months.last}' : months.join(', ');
        } else if (months.length == 1) {
          desc = months.first;
        } else {
          desc = widget.title;
        }
      }

      final hasPartial = group.any((item) {
            final st = (item['status'] ?? '').toString().toUpperCase();
            return st.contains('PART');
          }) ||
          totalRem > 0.01;

      final collectedByRaw = group
          .map((item) => (item['collected_by'] ?? '').toString().trim())
          .firstWhere((c) => c.isNotEmpty, orElse: () => 'ADMIN');

      consolidatedSlips.add({
        'id': primaryPid,
        'receipt_no': rno,
        'raw_receipt_no': rno,
        'amount_paid': totalAmt,
        'discount_amount': totalDisc,
        'remaining': totalRem,
        'status': hasPartial ? 'PARTIAL' : 'PAID',
        'collected_by': collectedByRaw,
        'payment_date': first['payment_date'] ?? first['created_at'],
        'created_at': first['created_at'],
        'description': desc,
      });
    }

    for (final p in noReceipt) {
      final pid = int.tryParse(p['id']?.toString() ?? '0') ?? 0;
      final desc = widget.isAdditional
          ? (p['fee_name'] ?? widget.title).toString()
          : (p['fee_month'] ?? widget.title).toString();
      consolidatedSlips.add({
        ...p,
        'id': pid,
        'description': desc,
      });
    }

    final headerTitle = (consolidatedSlips.length == 1 && (consolidatedSlips.first['description'] ?? '').toString().isNotEmpty)
        ? consolidatedSlips.first['description'].toString()
        : widget.title;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFB45309), size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Fee Receipt',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        headerTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Body
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Student Info Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Text(
                                studentName.isNotEmpty ? studentName : 'Student',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            if (hasValidPhone) ...[
                              const SizedBox(width: 8),
                              InkWell(
                                onTap: () {
                                  Clipboard.setData(ClipboardData(text: phone));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Copied $phone to clipboard'),
                                      behavior: SnackBarBehavior.floating,
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                },
                                borderRadius: BorderRadius.circular(8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.phone_outlined, size: 14, color: Color(0xFF64748B)),
                                      const SizedBox(width: 5),
                                      Text(
                                        phone,
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                      const SizedBox(width: 5),
                                      const Icon(Icons.copy_rounded, size: 12, color: Color(0xFF94A3B8)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 12,
                          runSpacing: 2,
                          children: [
                            Text('Class: $className', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                            Text('Roll No: $rollNo', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                            Text('SR No: $srNo', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (consolidatedSlips.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: const [
                          Icon(Icons.receipt_outlined, size: 36, color: Color(0xFF94A3B8)),
                          SizedBox(height: 8),
                          Text(
                            'No receipt record found for this fee.',
                            style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    )
                  else
                    ...consolidatedSlips.map((p) {
                      final pid = int.tryParse(p['id']?.toString() ?? '0') ?? 0;
                      final rawReceiptNo = (p['raw_receipt_no'] ?? p['receipt_no'] ?? '').toString().trim();
                      var receiptNo = (p['receipt_no'] ?? (pid > 0 ? 'REC-$pid' : '—')).toString();
                      if (receiptNo.length == 15 && RegExp(r'^\d{15}$').hasMatch(receiptNo)) {
                        receiptNo = receiptNo.substring(0, 12);
                      }
                      final amount = double.tryParse(p['amount_paid']?.toString() ?? p['amount']?.toString() ?? '0') ?? 0.0;
                      final disc = double.tryParse(p['discount_amount']?.toString() ?? '0') ?? 0.0;
                      final remaining = double.tryParse(p['remaining']?.toString() ?? '0') ?? 0.0;
                      final rawCollector = (p['collected_by'] ?? 'ADMIN').toString().trim();
                      final lowerCollector = rawCollector.toLowerCase();
                      final String collectedBy = (lowerCollector.isEmpty ||
                              lowerCollector == 'school admin' ||
                              lowerCollector == 'admin' ||
                              lowerCollector.endsWith('admin') ||
                              lowerCollector.contains('school admin') ||
                              lowerCollector.contains('accounts office'))
                          ? 'ADMIN'
                          : rawCollector;
                      final rawStatus = (p['status'] ?? (widget.isAdditional ? 'Paid' : 'PAID')).toString().toUpperCase();
                      final isPart = rawStatus.contains('PART');
                      final isSharing = _loadingPaymentId == pid;
                      final itemDescription = (p['description'] ?? '').toString().trim();

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header of card
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: const BoxDecoration(
                                color: Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.vertical(top: Radius.circular(13)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.receipt_rounded, size: 16, color: Color(0xFF475569)),
                                      const SizedBox(width: 6),
                                      Text(
                                        'Ref No: $receiptNo',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                                      ),
                                      const SizedBox(width: 6),
                                      InkWell(
                                        onTap: () async {
                                          await Clipboard.setData(ClipboardData(text: receiptNo.toString().trim()));
                                          HapticFeedback.lightImpact();
                                          if (!context.mounted) return;
                                          ScaffoldMessenger.of(context).hideCurrentSnackBar();
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 16),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    'Ref No copied: $receiptNo',
                                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.white),
                                                  ),
                                                ],
                                              ),
                                              duration: const Duration(seconds: 2),
                                              behavior: SnackBarBehavior.floating,
                                              backgroundColor: const Color(0xFF0F172A),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                              margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                                            ),
                                          );
                                        },
                                        borderRadius: BorderRadius.circular(4),
                                        child: const Padding(
                                          padding: EdgeInsets.all(3),
                                          child: Icon(
                                            Icons.copy_rounded,
                                            size: 15,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isPart ? const Color(0xFFDBEAFE) : const Color(0xFFD1FAE5),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      isPart ? 'PARTIAL' : 'PAID',
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color: isPart ? const Color(0xFF1E40AF) : const Color(0xFF065F46),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Details
                            Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (itemDescription.isNotEmpty) ...[
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                      margin: const EdgeInsets.only(bottom: 12),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                      ),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            widget.isAdditional ? 'Description: ' : 'Billing Months: ',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w700),
                                          ),
                                          Expanded(
                                            child: Text(
                                              itemDescription,
                                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF0F172A), fontWeight: FontWeight.w800),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Amount Paid',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '₹${amount.round()}',
                                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF16A34A)),
                                          ),
                                        ],
                                      ),
                                      if (isPart && remaining > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEF2F2),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: const Color(0xFFFCA5A5)),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              const Text(
                                                'Remaining Due',
                                                style: TextStyle(fontSize: 10, color: Color(0xFF991B1B), fontWeight: FontWeight.w600),
                                              ),
                                              Text(
                                                '₹${remaining.round()}',
                                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFDC2626)),
                                              ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  ),
                                  if (disc > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        'Discount: ₹${disc.round()}',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      if (collectedBy.isNotEmpty)
                                        Flexible(
                                          child: Text(
                                            'Collected By: $collectedBy',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                          ),
                                        )
                                      else
                                        const SizedBox(),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Date: ${_formatReceiptDate(p)}',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),

                                  const Divider(height: 20, color: Color(0xFFF1F5F9)),

                                  // Actions: Full-width Share Receipt button
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton.icon(
                                      onPressed: (pid <= 0 || isSharing)
                                          ? null
                                          : () => _shareReceipt(
                                                pid,
                                                rawReceiptNo.isNotEmpty ? rawReceiptNo : receiptNo,
                                                itemDescription.isNotEmpty ? itemDescription : widget.title,
                                              ),
                                      icon: isSharing
                                          ? const SizedBox(
                                              width: 16,
                                              height: 16,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                            )
                                          : const Icon(Icons.share_rounded, size: 18),
                                      label: Text(
                                        isSharing ? 'Preparing Receipt...' : 'Share Receipt',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF16A34A),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class MaxIntInputFormatter extends TextInputFormatter {
  final int Function() maxGetter;
  MaxIntInputFormatter(this.maxGetter);

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }
    final int? val = int.tryParse(newValue.text);
    if (val == null) {
      return oldValue;
    }
    final int max = maxGetter();
    if (max >= 0 && val > max) {
      return oldValue;
    }
    return newValue;
  }
}

// =============================================================================
// TUITION DEPOSIT DIALOG (Replicates Screenshot 2 & Web DepositModal Exactly)
// =============================================================================
class _DepositDialog extends StatefulWidget {
  final int studentId;
  final Map<String, dynamic> student;
  final List<dynamic> payments;
  final dynamic classFeeConfig;
  final FeeService feeService;
  final VoidCallback onSuccess;
  final String? initialSelectedMonth;

  const _DepositDialog({
    Key? key,
    required this.studentId,
    required this.student,
    required this.payments,
    required this.classFeeConfig,
    required this.feeService,
    required this.onSuccess,
    this.initialSelectedMonth,
  }) : super(key: key);

  @override
  State<_DepositDialog> createState() => _DepositDialogState();
}

class _DepositDialogState extends State<_DepositDialog> {
  static const List<String> _academicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  final List<String> _selectedMonths = [];
  final Map<String, int> _depositAmounts = {};
  bool _applyDiscount = false;
  bool _isApprovalRequired = false;
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _partialAmountController = TextEditingController();

  String _paymentMethod = 'Cash';
  final List<String> _paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  bool _isSaving = false;
  String _errorMessage = '';

  Map<String, dynamic> _monthlyFeeConfig = {};

  String _workingAyName = '';
  String _workingAyStatus = 'ACTIVE';
  String _currentUserName = '';

  @override
  void initState() {
    super.initState();
    _loadWorkingAy();
    _initMonthlyConfig();
    widget.feeService.getDiscountApprovalRequired().then((val) {
      if (mounted) setState(() => _isApprovalRequired = val);
    });
    final partial = _getPartialMonth();
    if (widget.initialSelectedMonth != null) {
      if (partial != null && widget.initialSelectedMonth != partial) {
        _errorMessage = 'Month $partial has a remaining balance of ₹${_getRemainingFee(partial).round()} and must be deposited separately first.';
        _selectedMonths.add(partial);
        final rem = _getRemainingFee(partial).round();
        _depositAmounts[partial] = rem;
        _partialAmountController.text = rem.toString();
      } else if (!_isMonthFullyPaid(widget.initialSelectedMonth!)) {
        _selectedMonths.add(widget.initialSelectedMonth!);
        final rem = _getRemainingFee(widget.initialSelectedMonth!).round();
        _depositAmounts[widget.initialSelectedMonth!] = rem;
        _partialAmountController.text = rem.toString();
      } else {
        _autoSelectEarliestUnpaid();
      }
    } else {
      _autoSelectEarliestUnpaid();
    }
  }

  Future<void> _loadWorkingAy() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        setState(() {
          _workingAyName = prefs.getString('selected_academic_year_name') ?? '';
          _workingAyStatus = prefs.getString('selected_academic_year_status') ?? 'ACTIVE';
          _currentUserName = (prefs.getString('user_name') ?? '').trim();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _discountController.dispose();
    _partialAmountController.dispose();
    super.dispose();
  }

  void _initMonthlyConfig() {
    dynamic cfgMonthly = widget.classFeeConfig?['monthly_fees'];
    if (cfgMonthly is String) {
      try {
        _monthlyFeeConfig = Map<String, dynamic>.from(json.decode(cfgMonthly));
      } catch (_) {}
    } else if (cfgMonthly is Map) {
      _monthlyFeeConfig = Map<String, dynamic>.from(cfgMonthly);
    }
  }

  double _getMonthlyFee(String m) {
    if (_monthlyFeeConfig.containsKey(m)) {
      return double.tryParse(_monthlyFeeConfig[m]?.toString() ?? '0') ?? 0.0;
    }
    return 0.0;
  }

  double _getPaidSoFar(String m) {
    return widget.payments
        .where((p) => (p['fee_month'] ?? '').toString().trim() == m)
        .fold<double>(0.0, (sum, p) {
      final amt = double.tryParse(p['amount_paid']?.toString() ?? '0') ?? 0.0;
      final disc = double.tryParse(p['discount_amount']?.toString() ?? '0') ?? 0.0;
      return sum + amt + disc;
    });
  }

  double _getRemainingFee(String m) {
    return (_getMonthlyFee(m) - _getPaidSoFar(m)).clamp(0.0, double.infinity);
  }

  bool _isMonthFullyPaid(String m) {
    final fee = _getMonthlyFee(m);
    if (fee <= 0) return false;
    return _getRemainingFee(m) <= 0.01;
  }

  String? _getPartialMonth() {
    for (final m in _academicMonths) {
      if (!_isMonthFullyPaid(m) && _getPaidSoFar(m) > 0 && _getRemainingFee(m) > 0.01) {
        return m;
      }
    }
    return null;
  }

  String? _getEarliestUnpaid() {
    for (final m in _academicMonths) {
      if (!_isMonthFullyPaid(m)) {
        return m;
      }
    }
    return null;
  }

  void _autoSelectEarliestUnpaid() {
    final partial = _getPartialMonth();
    if (partial != null) {
      _selectedMonths.add(partial);
      final rem = _getRemainingFee(partial).round();
      _depositAmounts[partial] = rem;
      _partialAmountController.text = rem.toString();
    } else {
      final earliest = _getEarliestUnpaid();
      if (earliest != null) {
        _selectedMonths.add(earliest);
        final rem = _getRemainingFee(earliest).round();
        _depositAmounts[earliest] = rem;
        _partialAmountController.text = rem.toString();
      }
    }
  }

  void _handleMonthToggle(String month) {
    if (_isMonthFullyPaid(month)) return;

    final partial = _getPartialMonth();
    if (partial != null) {
      if (month != partial) {
        setState(() {
          _errorMessage = 'Month $partial has a remaining balance of ₹${_getRemainingFee(partial).round()} and must be deposited separately first.';
        });
        return;
      }
      setState(() {
        if (_selectedMonths.contains(partial)) {
          _selectedMonths.clear();
          _depositAmounts.clear();
          _partialAmountController.clear();
        } else {
          _selectedMonths.add(partial);
          final rem = _getRemainingFee(partial).round();
          _depositAmounts[partial] = rem;
          _partialAmountController.text = rem.toString();
        }
        _errorMessage = '';
      });
      return;
    }

    final earliest = _getEarliestUnpaid();
    if (earliest == null) return;

    final idxOfToggle = _academicMonths.indexOf(month);
    final idxOfEarliest = _academicMonths.indexOf(earliest);

    setState(() {
      _errorMessage = '';
      if (_selectedMonths.contains(month)) {
        // Deselecting month: remove this month and subsequent ones
        _selectedMonths.removeWhere((m) => _academicMonths.indexOf(m) >= idxOfToggle);
        _depositAmounts.removeWhere((m, _) => _academicMonths.indexOf(m) >= idxOfToggle);
        if (_selectedMonths.length > 1) {
          for (final mName in _selectedMonths) {
            _depositAmounts[mName] = _getRemainingFee(mName).round();
          }
        } else if (_selectedMonths.length == 1) {
          final m = _selectedMonths[0];
          _partialAmountController.text = (_depositAmounts[m] ?? _getRemainingFee(m).round()).toString();
        }
      } else {
        // Checking month: ensure all months from earliestUnpaid to month are checked
        if (idxOfToggle < idxOfEarliest) {
          _errorMessage = 'Invalid month selection.';
          return;
        }
        _selectedMonths.clear();
        _depositAmounts.clear();
        for (int i = idxOfEarliest; i <= idxOfToggle; i++) {
          final mName = _academicMonths[i];
          if (!_isMonthFullyPaid(mName)) {
            _selectedMonths.add(mName);
            _depositAmounts[mName] = _getRemainingFee(mName).round();
          }
        }
        if (_selectedMonths.length == 1) {
          final m = _selectedMonths[0];
          _partialAmountController.text = _depositAmounts[m].toString();
        }
      }
      final gross = _calculateGrossTotal();
      final currentDisc = int.tryParse(_discountController.text.trim()) ?? 0;
      if (currentDisc > gross) {
        _discountController.text = gross > 0 ? gross.toString() : '';
      }
    });
  }

  void _handleToggleApplyDiscount(bool checked) {
    setState(() {
      _applyDiscount = checked;
      if (!checked) {
        _discountController.clear();
      }
      _errorMessage = '';
      for (final m in _selectedMonths) {
        _depositAmounts[m] = _getRemainingFee(m).round();
      }
      if (_selectedMonths.length == 1) {
        _partialAmountController.text = _getRemainingFee(_selectedMonths[0]).round().toString();
      }
    });
  }

  int _getDiscAmount() {
    if (!_applyDiscount) return 0;
    return int.tryParse(_discountController.text.trim()) ?? 0;
  }

  int _calculateGrossTotal() {
    int sum = 0;
    if (_selectedMonths.length == 1) {
      final m = _selectedMonths[0];
      final userTyped = int.tryParse(_partialAmountController.text.trim()) ?? _depositAmounts[m] ?? _getRemainingFee(m).round();
      sum += userTyped;
    } else {
      for (final m in _selectedMonths) {
        sum += (_depositAmounts[m] ?? _getRemainingFee(m).round());
      }
    }
    return sum;
  }

  int _calculateTotalDeposit() {
    final gross = _calculateGrossTotal();
    final disc = _getDiscAmount();
    return (gross - disc).clamp(0, 99999999);
  }

  String? _validateForm() {
    if (_selectedMonths.isEmpty) {
      return 'Please select at least one month.';
    }
    final gross = _calculateGrossTotal();
    final disc = _getDiscAmount();

    if (_applyDiscount && _discountController.text.trim().isNotEmpty) {
      if (disc < 0) {
        return 'Please enter a valid positive whole number for discount amount.';
      }
      if (disc > gross) {
        return 'Discount amount (₹$disc) cannot exceed payable fee (₹$gross).';
      }
    }

    if (_selectedMonths.length == 1) {
      final m = _selectedMonths[0];
      final remaining = _getRemainingFee(m).round();
      final val = int.tryParse(_partialAmountController.text.trim());
      if (val == null || val <= 0) {
        return 'Please enter a valid positive whole number for $m.';
      }
      if (val > remaining) {
        return 'Amount cannot exceed the remaining fee of ₹$remaining for $m.';
      }
    }
    return null;
  }

  Future<void> _submitDeposit() async {
    final err = _validateForm();
    if (err != null) {
      setState(() => _errorMessage = err);
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = '';
    });

    try {
      final discApplied = _getDiscAmount();
      final isSingle = _selectedMonths.length == 1;

      final Map<String, int> monthAmountsPayload = {};
      for (final m in _selectedMonths) {
        final amt = isSingle
            ? (int.tryParse(_partialAmountController.text.trim()) ?? _depositAmounts[m] ?? _getRemainingFee(m).round())
            : (_depositAmounts[m] ?? _getRemainingFee(m).round());
        final netPaid = (amt - discApplied).clamp(0, 99999999);
        monthAmountsPayload[m] = netPaid;
      }

      final int resolvedStudentId = widget.studentId != 0
          ? widget.studentId
          : (int.tryParse(widget.student['id']?.toString() ?? '') ?? 0);

      if (resolvedStudentId == 0) {
        setState(() {
          _errorMessage = 'Student ID is missing.';
          _isSaving = false;
        });
        return;
      }

      final payload = {
        'student_id': resolvedStudentId,
        'months': _selectedMonths,
        'month_amounts': monthAmountsPayload,
        'discount_amount': discApplied,
        'payment_method': _paymentMethod,
      };

      if (discApplied > 0) {
        bool isApprovalRequired = _isApprovalRequired;
        try {
          isApprovalRequired = await widget.feeService.getDiscountApprovalRequired();
        } catch (_) {}
        if (isApprovalRequired) {
          final shouldSend = await _showDiscountApprovalNoticeDialog(context);
          if (!shouldSend) {
            if (mounted) setState(() => _isSaving = false);
            return;
          }

          final gross = _calculateGrossTotal();
          final net = _calculateTotalDeposit();
          final discountPayload = {
            'student_id': resolvedStudentId,
            'fee_type': 'MONTHLY',
            'fee_items_summary': _selectedMonths.join(', '),
            'total_amount': gross,
            'paid_amount': net,
            'discount_amount': discApplied,
            'payment_method': _paymentMethod,
            'deposit_payload': payload,
            'requested_by': _currentUserName,
          };

          await widget.feeService.createDiscountRequest(discountPayload);
          if (mounted) {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Discount request sent for Admin approval.',
                  style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                ),
                backgroundColor: Color(0xFFD97706),
                behavior: SnackBarBehavior.floating,
              ),
            );
            widget.onSuccess();
          }
          return;
        }
      }

      await widget.feeService.depositFeePayment(payload);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Fee payment deposited successfully!'),
            backgroundColor: Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
        widget.onSuccess();
      }
    } catch (e) {
      debugPrint('Error depositing fees: $e');
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSingleMonth = _selectedMonths.length == 1;
    final totalDeposit = _calculateTotalDeposit();
    final partialMonth = _getPartialMonth();

    return Dialog(
      backgroundColor: const Color(0xFFFDFBF7),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
          maxWidth: 440,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Modal Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 14, 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Deposit Fees',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      if (_workingAyName.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              'Session: $_workingAyName',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(width: 5),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: _workingAyStatus.toUpperCase() == 'ACTIVE'
                                    ? const Color(0xFFDCFCE7)
                                    : const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                _workingAyStatus.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w800,
                                  color: _workingAyStatus.toUpperCase() == 'ACTIVE'
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFFB45309),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.pop(context),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Scrollable Modal Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // APPLY DISCOUNT TOGGLE BOX (Matches Screenshot 2)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Switch(
                                value: _applyDiscount,
                                activeColor: const Color(0xFFD97706),
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                onChanged: (val) => _handleToggleApplyDiscount(val),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'APPLY DISCOUNT',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          if (_applyDiscount) ...[
                            const SizedBox(height: 10),
                            TextField(
                              controller: _discountController,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                MaxIntInputFormatter(() => _calculateGrossTotal()),
                              ],
                              onChanged: (_) => setState(() => _errorMessage = ''),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText: 'Enter discount amount',
                                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                prefixText: '₹ ',
                                prefixStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                isDense: true,
                              ),
                            ),
                            if (_isApprovalRequired) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFFDE68A)),
                                ),
                                child: Row(
                                  children: const [
                                    Icon(Icons.shield_outlined, size: 16, color: Color(0xFFD97706)),
                                    SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Admin approval is enabled. Submitting will send a discount request to the School Admin.',
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF92400E),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // PAYMENT METHOD (Matches Screenshot 2)
                    const Text(
                      'PAYMENT METHOD',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _paymentMethod,
                          isExpanded: true,
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF475569)),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                          items: _paymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _paymentMethod = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (_errorMessage.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage,
                                style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // MONTH CARDS LIST (Matches Screenshot 2)
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _academicMonths.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final m = _academicMonths[idx];
                        final totalFee = _getMonthlyFee(m);
                        final paidSoFar = _getPaidSoFar(m);
                        final remaining = _getRemainingFee(m);
                        final isPaid = _isMonthFullyPaid(m);
                        final isPartial = paidSoFar > 0 && remaining > 0.01;
                        final isChecked = _selectedMonths.contains(m);
                        final shouldExpand = isSingleMonth && isChecked && !isPaid && !_applyDiscount;

                        final typedAmt = _partialAmountController.text.trim();
                        final numAmt = int.tryParse(typedAmt) ?? _depositAmounts[m] ?? remaining.round();
                        final remAfter = (remaining.round() - numAmt).clamp(0, 999999);
                        final isOver = numAmt > remaining.round();

                        final isInteractive = !isPaid && !(partialMonth != null && m != partialMonth);

                        return Container(
                          decoration: BoxDecoration(
                            color: isPaid ? const Color(0xFFF8FAFC) : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: shouldExpand
                                  ? const Color(0xFFD97706)
                                  : isChecked
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFFE2E8F0),
                              width: shouldExpand ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              InkWell(
                                onTap: isInteractive ? () => _handleMonthToggle(m) : null,
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  child: Row(
                                    children: [
                                      IgnorePointer(
                                        child: Checkbox(
                                          value: isPaid || isChecked,
                                          activeColor: isPaid ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                          onChanged: isInteractive
                                              ? (_) => _handleMonthToggle(m)
                                              : null,
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Row(
                                          children: [
                                            Text(
                                              m.toUpperCase(),
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                                color: isPaid ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                                              ),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              '(₹${totalFee.round()})',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: isPaid ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (isPaid)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFDCFCE7),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Text(
                                            'PAID',
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF16A34A)),
                                          ),
                                        )
                                      else if (isPartial)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEF3C7),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Text(
                                            'Partially Paid',
                                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                                          ),
                                        )
                                      else
                                        const Text(
                                          'Pending',
                                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                                        ),
                                    ],
                                  ),
                                ),
                              ),

                              // EXPANDED PARTIAL AMOUNT BOX (Exact match with Screenshot 2)
                              if (shouldExpand) ...[
                                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'AMOUNT TO DEPOSIT',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF64748B),
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          Container(
                                            width: 140,
                                            height: 38,
                                            padding: const EdgeInsets.symmetric(horizontal: 12),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(
                                                color: isOver ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                                                width: 1.8,
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                const Text(
                                                  '₹ ',
                                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                                ),
                                                Expanded(
                                                  child: TextField(
                                                    controller: _partialAmountController,
                                                    keyboardType: TextInputType.number,
                                                    inputFormatters: [
                                                      FilteringTextInputFormatter.digitsOnly,
                                                      MaxIntInputFormatter(() => remaining.round()),
                                                    ],
                                                    textAlign: TextAlign.center,
                                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                                    decoration: const InputDecoration(
                                                      border: InputBorder.none,
                                                      isDense: true,
                                                      contentPadding: EdgeInsets.zero,
                                                    ),
                                                    onChanged: (_) => setState(() => _errorMessage = ''),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'Remaining after payment:',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                          ),
                                          Text(
                                            '₹$remAfter',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: remAfter > 0 ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (isOver) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          'Amount cannot exceed remaining fee of ₹${remaining.round()}',
                                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),

            // Modal Footer (Matches Screenshot 2)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSaving ? null : () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: (_isSaving || _selectedMonths.isEmpty || _validateForm() != null)
                          ? null
                          : _submitDeposit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade300,
                        disabledForegroundColor: Colors.grey.shade600,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSaving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(
                              _isApprovalRequired && _getDiscAmount() > 0
                                  ? 'Request Approval (₹$totalDeposit)'
                                  : 'Deposit (₹$totalDeposit)',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                            ),
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
}

// =============================================================================
// ADDITIONAL FEES DEPOSIT MODAL (Replicates Web AdditionalDepositModal)
// =============================================================================
class _AdditionalDepositModal extends StatefulWidget {
  final int studentId;
  final Map<String, dynamic> student;
  final List<Map<String, dynamic>> unpaidFees;
  final List<int> initialSelectedIds;
  final FeeService feeService;
  final VoidCallback onSuccess;

  const _AdditionalDepositModal({
    Key? key,
    required this.studentId,
    required this.student,
    required this.unpaidFees,
    required this.initialSelectedIds,
    required this.feeService,
    required this.onSuccess,
  }) : super(key: key);

  @override
  State<_AdditionalDepositModal> createState() => _AdditionalDepositModalState();
}

class _AdditionalDepositModalState extends State<_AdditionalDepositModal> {
  final List<int> _selectedIds = [];
  final Map<int, int> _depositAmounts = {};
  bool _applyDiscount = false;
  bool _isApprovalRequired = false;
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _partialAmountController = TextEditingController();

  String _paymentMethod = 'Cash';
  final List<String> _paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  bool _isSaving = false;
  String _errorMessage = '';
  String _currentUserName = '';

  @override
  void initState() {
    super.initState();
    _initSelection();
    _loadUserName();
    widget.feeService.getDiscountApprovalRequired().then((val) {
      if (mounted) setState(() => _isApprovalRequired = val);
    });
  }

  Future<void> _loadUserName() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        setState(() {
          _currentUserName = (prefs.getString('user_name') ?? '').trim();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _discountController.dispose();
    _partialAmountController.dispose();
    super.dispose();
  }

  bool _isFeePartial(Map<String, dynamic> fee) {
    final paid = (fee['amount_paid'] as num? ?? 0.0) + (fee['discount_amount'] as num? ?? 0.0);
    final rem = (fee['remaining'] as num? ?? 0.0);
    return paid > 0 && rem > 0.01;
  }

  void _initSelection() {
    if (widget.initialSelectedIds.isNotEmpty) {
      _selectedIds.addAll(widget.initialSelectedIds);
      if (_selectedIds.length == 1) {
        final id = _selectedIds[0];
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
        if (f.isNotEmpty) {
          final rem = (f['remaining'] as num).round();
          _depositAmounts[id] = rem;
          _partialAmountController.text = rem.toString();
        }
      }
    } else {
      // If any fee is partially paid, select only that fee
      final partialFee = widget.unpaidFees.firstWhere((f) => _isFeePartial(f), orElse: () => {});
      if (partialFee.isNotEmpty) {
        final id = partialFee['id'] as int;
        _selectedIds.add(id);
        final rem = (partialFee['remaining'] as num).round();
        _depositAmounts[id] = rem;
        _partialAmountController.text = rem.toString();
      } else if (widget.unpaidFees.isNotEmpty) {
        final first = widget.unpaidFees.first;
        final id = first['id'] as int;
        _selectedIds.add(id);
        final rem = (first['remaining'] as num).round();
        _depositAmounts[id] = rem;
        _partialAmountController.text = rem.toString();
      }
    }
  }

  void _handleToggle(int id) {
    final targetFee = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
    if (targetFee.isEmpty) return;

    final isTargetPartial = _isFeePartial(targetFee);

    setState(() {
      _errorMessage = '';
      if (isTargetPartial) {
        if (_selectedIds.contains(id)) {
          _selectedIds.clear();
          _depositAmounts.clear();
          _partialAmountController.clear();
        } else {
          _selectedIds.clear();
          _selectedIds.add(id);
          final rem = (targetFee['remaining'] as num).round();
          _depositAmounts[id] = rem;
          _partialAmountController.text = rem.toString();
        }
        return;
      }

      // If a partial fee was previously selected, clear it
      final hasSelectedPartial = _selectedIds.any((sId) {
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == sId, orElse: () => {});
        return f.isNotEmpty && _isFeePartial(f);
      });
      if (hasSelectedPartial) {
        _selectedIds.clear();
        _depositAmounts.clear();
      }

      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
        _depositAmounts.remove(id);
      } else {
        _selectedIds.add(id);
        _depositAmounts[id] = (targetFee['remaining'] as num).round();
      }

      if (_selectedIds.length > 1) {
        for (final fId in _selectedIds) {
          final f = widget.unpaidFees.firstWhere((x) => x['id'] == fId, orElse: () => {});
          if (f.isNotEmpty) {
            _depositAmounts[fId] = (f['remaining'] as num).round();
          }
        }
      } else if (_selectedIds.length == 1) {
        final fId = _selectedIds[0];
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == fId, orElse: () => {});
        if (f.isNotEmpty) {
          final rem = (f['remaining'] as num).round();
          _depositAmounts[fId] = rem;
          _partialAmountController.text = rem.toString();
        }
      }
      final gross = _calculateGrossTotal();
      final currentDisc = int.tryParse(_discountController.text.trim()) ?? 0;
      if (currentDisc > gross) {
        _discountController.text = gross > 0 ? gross.toString() : '';
      }
    });
  }

  void _handleToggleApplyDiscount(bool checked) {
    setState(() {
      _applyDiscount = checked;
      if (!checked) {
        _discountController.clear();
      }
      _errorMessage = '';
      for (final id in _selectedIds) {
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
        if (f.isNotEmpty) {
          _depositAmounts[id] = (f['remaining'] as num).round();
        }
      }
      if (_selectedIds.length == 1) {
        final id = _selectedIds[0];
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
        if (f.isNotEmpty) {
          _partialAmountController.text = (f['remaining'] as num).round().toString();
        }
      }
    });
  }

  int _getDiscAmount() {
    if (!_applyDiscount) return 0;
    return int.tryParse(_discountController.text.trim()) ?? 0;
  }

  int _calculateGrossTotal() {
    int sum = 0;
    if (_selectedIds.length == 1) {
      final id = _selectedIds[0];
      final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
      final rem = f.isNotEmpty ? (f['remaining'] as num).round() : 0;
      final userTyped = int.tryParse(_partialAmountController.text.trim()) ?? _depositAmounts[id] ?? rem;
      sum += userTyped;
    } else {
      for (final id in _selectedIds) {
        final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
        final rem = f.isNotEmpty ? (f['remaining'] as num).round() : 0;
        sum += (_depositAmounts[id] ?? rem);
      }
    }
    return sum;
  }

  int _calculateTotalDeposit() {
    final gross = _calculateGrossTotal();
    final disc = _getDiscAmount();
    return (gross - disc).clamp(0, 99999999);
  }

  String? _validateForm() {
    if (_selectedIds.isEmpty) {
      return 'Please select at least one fee.';
    }
    final gross = _calculateGrossTotal();
    final disc = _getDiscAmount();

    if (_applyDiscount && _discountController.text.trim().isNotEmpty) {
      if (disc < 0) {
        return 'Please enter a valid positive whole number for discount amount.';
      }
      if (disc > gross) {
        return 'Discount amount (₹$disc) cannot exceed payable fee (₹$gross).';
      }
    }

    if (_selectedIds.length == 1) {
      final id = _selectedIds[0];
      final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
      if (f.isNotEmpty) {
        final remaining = (f['remaining'] as num).round();
        final val = int.tryParse(_partialAmountController.text.trim());
        if (val == null || val <= 0) {
          return 'Please enter a valid positive whole number for ${f['fee_name']}.';
        }
        if (val > remaining) {
          return 'Amount cannot exceed the remaining fee of ₹$remaining for ${f['fee_name']}.';
        }
      }
    }
    return null;
  }

  Future<void> _submitDeposit() async {
    final err = _validateForm();
    if (err != null) {
      setState(() => _errorMessage = err);
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = '';
    });

    try {
      final totalDiscount = _getDiscAmount();

      if (totalDiscount > 0) {
        bool isApprovalRequired = _isApprovalRequired;
        try {
          isApprovalRequired = await widget.feeService.getDiscountApprovalRequired();
        } catch (_) {}
        if (isApprovalRequired) {
          final shouldSend = await _showDiscountApprovalNoticeDialog(context);
          if (!shouldSend) {
            if (mounted) setState(() => _isSaving = false);
            return;
          }

          final List<Map<String, dynamic>> feesList = [];
          final List<String> feeNames = [];
          int remainingDiscount = totalDiscount;
          final isSingleFee = _selectedIds.length == 1;

          final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
          final rnd = Random().nextInt(90) + 10;
          final sharedReceiptNo = '$nowSec$rnd';

          for (int i = 0; i < _selectedIds.length; i++) {
            final id = _selectedIds[i];
            final fee = widget.unpaidFees.firstWhere((f) => f['id'] == id);
            feeNames.add(fee['fee_name']?.toString() ?? 'Additional Fee');
            final remaining = (fee['remaining'] as num).round();
            final userTypedAmt = isSingleFee
                ? (int.tryParse(_partialAmountController.text.trim()) ?? _depositAmounts[id] ?? remaining)
                : (_depositAmounts[id] ?? remaining);

            int feeDisc = 0;
            if (isSingleFee) {
              feeDisc = totalDiscount.clamp(0, userTypedAmt);
            } else {
              feeDisc = remainingDiscount.clamp(0, userTypedAmt);
              remainingDiscount -= feeDisc;
            }

            final netCashPaid = (userTypedAmt - feeDisc).clamp(0, 99999999);
            feesList.add({
              'id': id,
              'payment_method': _paymentMethod,
              'amount_paid': netCashPaid,
              'discount_amount': feeDisc,
              'receipt_no': sharedReceiptNo,
            });
          }

          final int resolvedStudentId = widget.studentId != 0
              ? widget.studentId
              : (int.tryParse(widget.student['id']?.toString() ?? '') ?? 0);

          final discountPayload = {
            'student_id': resolvedStudentId,
            'fee_type': 'ADDITIONAL',
            'fee_items_summary': feeNames.join(', '),
            'total_amount': _calculateGrossTotal(),
            'paid_amount': _calculateTotalDeposit(),
            'discount_amount': totalDiscount,
            'payment_method': _paymentMethod,
            'deposit_payload': {
              'fees': feesList,
            },
            'requested_by': _currentUserName,
          };

          await widget.feeService.createDiscountRequest(discountPayload);
          if (mounted) {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Discount request sent for Admin approval.',
                  style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                ),
                backgroundColor: Color(0xFFD97706),
                behavior: SnackBarBehavior.floating,
              ),
            );
            widget.onSuccess();
          }
          return;
        }
      }

      int remainingDiscount = totalDiscount;
      final isSingleFee = _selectedIds.length == 1;

      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final rnd = Random().nextInt(90) + 10;
      final sharedReceiptNo = '$nowSec$rnd';

      for (int i = 0; i < _selectedIds.length; i++) {
        final id = _selectedIds[i];
        final fee = widget.unpaidFees.firstWhere((f) => f['id'] == id);
        final remaining = (fee['remaining'] as num).round();
        final userTypedAmt = isSingleFee
            ? (int.tryParse(_partialAmountController.text.trim()) ?? _depositAmounts[id] ?? remaining)
            : (_depositAmounts[id] ?? remaining);

        int feeDisc = 0;
        if (isSingleFee) {
          feeDisc = totalDiscount.clamp(0, userTypedAmt);
        } else {
          feeDisc = remainingDiscount.clamp(0, userTypedAmt);
          remainingDiscount -= feeDisc;
        }

        final netCashPaid = (userTypedAmt - feeDisc).clamp(0, 99999999);

        await widget.feeService.collectAdditionalFeePayment(id, {
          'payment_method': _paymentMethod,
          'amount_paid': netCashPaid,
          'discount_amount': feeDisc,
          'receipt_no': sharedReceiptNo,
        });
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Additional fee payment deposited successfully!'),
            backgroundColor: Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
        widget.onSuccess();
      }
    } catch (e) {
      debugPrint('Error depositing additional fees: $e');
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSingleFee = _selectedIds.length == 1;
    final totalDeposit = _calculateTotalDeposit();

    final selectedPartialId = _selectedIds.where((id) {
      final f = widget.unpaidFees.firstWhere((x) => x['id'] == id, orElse: () => {});
      return f.isNotEmpty && _isFeePartial(f);
    }).firstOrNull;

    return Dialog(
      backgroundColor: const Color(0xFFFDFBF7),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
          maxWidth: 440,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Modal Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 14, 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Deposit Additional Fees',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.pop(context),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Scrollable Modal Body
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // APPLY DISCOUNT TOGGLE BOX
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Switch(
                                value: _applyDiscount,
                                activeColor: const Color(0xFFD97706),
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                onChanged: (val) => _handleToggleApplyDiscount(val),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'APPLY DISCOUNT',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          if (_applyDiscount) ...[
                            const SizedBox(height: 10),
                            TextField(
                              controller: _discountController,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                MaxIntInputFormatter(() => _calculateGrossTotal()),
                              ],
                              onChanged: (_) => setState(() => _errorMessage = ''),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText: 'Enter discount amount',
                                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                prefixText: '₹ ',
                                prefixStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                isDense: true,
                              ),
                            ),
                            if (_isApprovalRequired) ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFFDE68A)),
                                ),
                                child: Row(
                                  children: const [
                                    Icon(Icons.shield_outlined, size: 16, color: Color(0xFFD97706)),
                                    SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Admin approval is enabled. Submitting will send a discount request to the School Admin.',
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF92400E),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // PAYMENT METHOD
                    const Text(
                      'PAYMENT METHOD',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _paymentMethod,
                          isExpanded: true,
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF475569)),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                          items: _paymentMethods.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _paymentMethod = val);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (_errorMessage.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage,
                                style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // UNPAID ADDITIONAL FEE CARDS
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: widget.unpaidFees.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final fee = widget.unpaidFees[idx];
                        final feeId = fee['id'] as int;
                        final title = fee['fee_name'] as String;
                        final total = (fee['amount'] as num).round();
                        final paid = (fee['amount_paid'] as num).round();
                        final disc = (fee['discount_amount'] as num).round();
                        final rem = (fee['remaining'] as num).round();
                        final isPartial = _isFeePartial(fee);
                        final isChecked = _selectedIds.contains(feeId);
                        final shouldExpand = isSingleFee && isChecked && !_applyDiscount;

                        // Checkbox disabled if a partial fee is selected and it's not this one
                        final isDisabled = selectedPartialId != null && selectedPartialId != feeId;

                        final typedAmt = _partialAmountController.text.trim();
                        final numAmt = int.tryParse(typedAmt) ?? _depositAmounts[feeId] ?? rem;
                        final remAfter = (rem - numAmt).clamp(0, 999999);
                        final isOver = numAmt > rem;

                        return Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: shouldExpand
                                  ? const Color(0xFFD97706)
                                  : isChecked
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFFE2E8F0),
                              width: shouldExpand ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              InkWell(
                                onTap: isDisabled ? null : () => _handleToggle(feeId),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  child: Row(
                                    children: [
                                      IgnorePointer(
                                        child: Checkbox(
                                          value: isChecked,
                                          activeColor: const Color(0xFF2563EB),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                          onChanged: isDisabled ? null : (_) => _handleToggle(feeId),
                                        ),
                                      ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            title.toUpperCase(),
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                          ),
                                          const SizedBox(height: 1),
                                          Text(
                                            (paid + disc) > 0
                                                ? 'Amount: ₹$total • Paid: ₹${paid + disc} | Remaining ₹$rem'
                                                : 'Amount: ₹$total | Remaining ₹$rem',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (isPartial)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Text(
                                          'Partially Paid',
                                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                                        ),
                                      )
                                    else
                                      const Text(
                                        'Pending',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                                      ),
                                  ],
                                ),
                              ),
                            ),

                              // EXPANDED PARTIAL AMOUNT BOX
                              if (shouldExpand) ...[
                                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'AMOUNT TO DEPOSIT',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF64748B),
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          Container(
                                            width: 140,
                                            height: 38,
                                            padding: const EdgeInsets.symmetric(horizontal: 12),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(
                                                color: isOver ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                                                width: 1.8,
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                const Text(
                                                  '₹ ',
                                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                                ),
                                                Expanded(
                                                  child: TextField(
                                                    controller: _partialAmountController,
                                                    keyboardType: TextInputType.number,
                                                    inputFormatters: [
                                                      FilteringTextInputFormatter.digitsOnly,
                                                      MaxIntInputFormatter(() => rem),
                                                    ],
                                                    textAlign: TextAlign.center,
                                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                                    decoration: const InputDecoration(
                                                      border: InputBorder.none,
                                                      isDense: true,
                                                      contentPadding: EdgeInsets.zero,
                                                    ),
                                                    onChanged: (_) => setState(() => _errorMessage = ''),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'Remaining after payment:',
                                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                          ),
                                          Text(
                                            '₹$remAfter',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: remAfter > 0 ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (isOver) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          'Amount cannot exceed remaining fee of ₹$rem',
                                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFDC2626)),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),

            // Modal Footer
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSaving ? null : () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF475569))),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: (_isSaving || _selectedIds.isEmpty || _validateForm() != null)
                          ? null
                          : _submitDeposit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade300,
                        disabledForegroundColor: Colors.grey.shade600,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSaving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(
                              _isApprovalRequired && _getDiscAmount() > 0
                                  ? 'Request Approval (₹$totalDeposit)'
                                  : 'Deposit (₹$totalDeposit)',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                            ),
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
}

// =============================================================================
// DISCOUNT APPROVAL NOTICE DIALOG & COLLECTOR DISCOUNT REQUESTS SHEET
// =============================================================================

Future<bool> _showDiscountApprovalNoticeDialog(BuildContext context) async {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      return AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.shield_outlined, color: Color(0xFFD97706), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Admin Approval Required',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Applying a discount requires School Admin permission.',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Once submitted, this fee deposit will remain pending and will not reflect in fee collections, collection history, or financial reports until approved by the School Admin.',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16, color: Color(0xFFD97706)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Status will remain "Pending" until approved.',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF334155),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            child: const Text(
              'Send Request',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      );
    },
  ) ?? false;
}

class _CollectorDiscountRequestsSheet extends StatefulWidget {
  final FeeService feeService;
  final VoidCallback onDataChanged;

  const _CollectorDiscountRequestsSheet({
    Key? key,
    required this.feeService,
    required this.onDataChanged,
  }) : super(key: key);

  @override
  State<_CollectorDiscountRequestsSheet> createState() => _CollectorDiscountRequestsSheetState();
}

class _CollectorDiscountRequestsSheetState extends State<_CollectorDiscountRequestsSheet> {
  bool _isLoading = true;
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final res = await widget.feeService.getDiscountRequests();
      if (mounted) {
        setState(() {
          _requests = (res['requests'] as List<dynamic>?) ?? [];
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleCancel(int id, String studentName) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Cancel Discount Request'),
          content: Text('Are you sure you want to cancel the discount request for $studentName? Once cancelled, the Admin will no longer be able to approve or reject it.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep Request'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              child: const Text('Cancel Request'),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    try {
      await widget.feeService.cancelDiscountRequest(id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Discount request cancelled.'),
          backgroundColor: Color(0xFFD97706),
          behavior: SnackBarBehavior.floating,
        ),
      );
      widget.onDataChanged();
      _loadRequests();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.percent_rounded, color: Color(0xFFD97706), size: 18),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Discount Requests',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
                : _requests.isEmpty
                    ? Center(
                        child: Text(
                          'No discount requests found.',
                          style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _requests.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (ctx, i) {
                          final req = _requests[i];
                          final id = int.tryParse(req['id']?.toString() ?? '0') ?? 0;
                          final studentName = req['student_name']?.toString() ?? 'Student';
                          final className = req['class_name']?.toString() ?? '';
                          final summary = req['fee_items_summary']?.toString() ?? '';
                          final disc = double.tryParse(req['discount_amount']?.toString() ?? '0') ?? 0.0;
                          final paid = double.tryParse(req['paid_amount']?.toString() ?? '0') ?? 0.0;
                          final status = req['status']?.toString().toUpperCase() ?? 'PENDING';

                          Color badgeBg = const Color(0xFFFEF3C7);
                          Color badgeText = const Color(0xFFD97706);
                          if (status == 'APPROVED') {
                            badgeBg = const Color(0xFFD1FAE5);
                            badgeText = const Color(0xFF059669);
                          } else if (status == 'REJECTED') {
                            badgeBg = const Color(0xFFFEE2E2);
                            badgeText = const Color(0xFFDC2626);
                          } else if (status == 'CANCELLED') {
                            badgeBg = const Color(0xFFF1F5F9);
                            badgeText = const Color(0xFF64748B);
                          }

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '$studentName ($className)',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14,
                                          color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: badgeBg,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        status,
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badgeText),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  summary,
                                  style: TextStyle(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Discount: ₹${disc.round()} | Paid: ₹${paid.round()}',
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
                                    ),
                                    if (status == 'PENDING')
                                      TextButton(
                                        onPressed: () => _handleCancel(id, studentName),
                                        style: TextButton.styleFrom(
                                          foregroundColor: const Color(0xFFDC2626),
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                        child: const Text('Cancel Request', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
