import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'dart:math';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:printing/printing.dart';
import 'package:school_hub/services/fee_service.dart';
import 'package:school_hub/screens/fees_collection_history_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FeesPortalScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const FeesPortalScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  }) : super(key: key);

  @override
  State<FeesPortalScreen> createState() => _FeesPortalScreenState();
}

class _FeesPortalScreenState extends State<FeesPortalScreen> {
  late FeeService _feeService;
  bool _isLoading = true;
  String _errorMessage = '';

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
    final availableClasses = _getAvailableClassNames();

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F2),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1E293B)),
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
            const Text(
              'FEES PORTAL',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 18,
                letterSpacing: 1.1,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Refresh',
            onPressed: _loadPortalData,
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFFFBEB), Color(0xFFFEF5D6)],
        ),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isClickable ? const Color(0xFFF59E0B) : const Color(0xFFFCD34D),
          width: isClickable ? 1.2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
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
    return Container(
      color: Colors.white,
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
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _searchController,
              textAlignVertical: TextAlignVertical.center,
              textInputAction: TextInputAction.search,
              style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Search by Student Name...',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8), fontWeight: FontWeight.normal),
                prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                prefixIconConstraints: const BoxConstraints(minWidth: 42, minHeight: 44),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 16, color: Color(0xFF94A3B8)),
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
    final name = student['name'] ?? 'Unnamed';
    final className = student['class_name'] ?? 'N/A';
    final rollNo = student['roll_no']?.toString().isNotEmpty == true ? student['roll_no'] : '—';
    final outstanding = student['outstanding_dues'] as int;
    final status = student['calculated_status'] as String;

    final isPending = status == 'PENDING';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
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
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
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
                      'OPEN LEDGER',
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
        return _StudentLedgerSheet(
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

// =============================================================================
// STUDENT LEDGER SHEET COMPONENT
// =============================================================================
class _StudentLedgerSheet extends StatefulWidget {
  final int studentId;
  final Map<String, dynamic> studentSummary;
  final FeeService feeService;
  final VoidCallback onPaymentSuccess;

  const _StudentLedgerSheet({
    Key? key,
    required this.studentId,
    required this.studentSummary,
    required this.feeService,
    required this.onPaymentSuccess,
  }) : super(key: key);

  @override
  State<_StudentLedgerSheet> createState() => _StudentLedgerSheetState();
}

class _StudentLedgerSheetState extends State<_StudentLedgerSheet> {
  bool _isLoading = true;
  String _errorMessage = '';
  Map<String, dynamic> _studentDetail = {};
  int _selectedLedgerTab = 0; // 0: Monthly Tuition Fees, 1: Additional Fees

  static const List<String> _academicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  @override
  void initState() {
    super.initState();
    _fetchDetail();
  }

  Future<void> _fetchDetail() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      final data = await widget.feeService.fetchStudentDetail(widget.studentId);
      if (mounted) {
        setState(() {
          _studentDetail = data;
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

    final name = (studentInfo['name'] ?? widget.studentSummary['name'] ?? 'Student').toString();
    final className = (studentInfo['class_name'] ?? widget.studentSummary['class_name'] ?? 'N/A').toString();
    final rollNo = (studentInfo['roll_no'] ?? widget.studentSummary['roll_no'] ?? '—').toString();
    final srNo = (studentInfo['sr_no'] ?? '—').toString();
    final photoRaw = (studentInfo['photo_path'] ?? widget.studentSummary['photo_path'] ?? studentInfo['photo'] ?? widget.studentSummary['photo'] ?? '').toString().trim();
    String photoUrl = '';
    if (photoRaw.isNotEmpty) {
      if (photoRaw.startsWith('http')) {
        photoUrl = photoRaw;
      } else {
        final cleanPath = photoRaw.startsWith('/') ? photoRaw : '/$photoRaw';
        photoUrl = '${widget.feeService.baseUrl}$cleanPath';
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
      final feeName = (item['fee_name'] ?? 'Additional Fee').toString();
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
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                      _buildLedgerStudentAvatar(photoUrl, name),
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
                  const Text(
                    'Monthly Tuition Fees Breakdown',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: monthRows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      itemBuilder: (context, index) {
                        final mRow = monthRows[index];
                        final mStatus = mRow['status'] as String;
                        final isPaid = mStatus == 'PAID';
                        final isPartial = mStatus == 'PARTIAL';
                        final monthPayments = payments
                            .where((p) => (p['fee_month'] ?? '').toString().trim().toLowerCase() == (mRow['month'] as String).toLowerCase())
                            .map((p) => {
                                  if (p is Map) ...Map<String, dynamic>.from(p),
                                  'remaining': mRow['remaining'],
                                  'fee': mRow['fee'],
                                })
                            .toList();

                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 85,
                                child: Text(
                                  mRow['month'],
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      (mRow['paid'] is num && mRow['paid'] > 0)
                                          ? 'Fee: ₹${mRow['fee']}  •  Paid: ₹${mRow['paid']}'
                                          : 'Fee: ₹${mRow['fee']}',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                    ),
                                    if (!isPaid)
                                      Text(
                                        'Due: ₹${mRow['remaining']}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          color: isPartial ? Colors.blue.shade700 : const Color(0xFFDC2626),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
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
                                  if (isPaid || isPartial) ...[
                                    const SizedBox(width: 6),
                                    InkWell(
                                      onTap: () {
                                        _showReceiptBottomSheet(
                                          studentInfo: studentInfo,
                                          title: '${mRow['month']} Tuition Fee',
                                          payments: monthPayments,
                                          isAdditional: false,
                                        );
                                      },
                                      borderRadius: BorderRadius.circular(8),
                                      child: Container(
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
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
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

                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: !isPaid ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0),
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
                                      title,
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                    ),
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
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
                                      if (isPaid || isPartial) ...[
                                        const SizedBox(width: 6),
                                        InkWell(
                                          onTap: () {
                                            _showReceiptBottomSheet(
                                              studentInfo: studentInfo,
                                              title: title,
                                              payments: [
                                                {
                                                  if (af['raw'] is Map)
                                                    ...Map<String, dynamic>.from(af['raw'])
                                                  else
                                                    ...Map<String, dynamic>.from(af),
                                                  'remaining': rem,
                                                  'fee': total,
                                                }
                                              ],
                                              isAdditional: true,
                                            );
                                          },
                                          borderRadius: BorderRadius.circular(8),
                                          child: Container(
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
                                          ),
                                        ),
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
                                    ElevatedButton(
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
                  ? ElevatedButton.icon(
                      onPressed: totalTuitionDues <= 0
                          ? null
                          : () => _openDepositModal(
                                student: studentInfo,
                                payments: payments,
                                classFeeConfig: _studentDetail['class_fee_config'] ?? studentInfo['class_fee_config'],
                              ),
                      icon: const Icon(Icons.payment_rounded, size: 18),
                      label: Text(
                        totalTuitionDues > 0
                            ? 'Deposit Tuition Fees (₹${totalTuitionDues.round()})'
                            : (monthRows.every((m) => (m['fee'] as num) == 0)
                                ? 'Tuition Fee Not Configured'
                                : 'Tuition Fees Fully Paid'),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),

                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade300,
                        disabledForegroundColor: Colors.grey.shade600,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    )
                  : ElevatedButton.icon(
                      onPressed: unpaidAdditional.isEmpty
                          ? null
                          : () => _openAdditionalDepositModal(
                                student: studentInfo,
                                unpaidFees: unpaidAdditional,
                              ),
                      icon: const Icon(Icons.add_card_rounded, size: 18),
                      label: Text(
                        unpaidAdditional.isNotEmpty
                            ? 'Deposit Additional Fees (₹${totalAdditionalDues.round()})'
                            : 'All Additional Fees Paid',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: Colors.grey.shade300,
                        disabledForegroundColor: Colors.grey.shade600,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
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

  void _showReceiptBottomSheet({
    required Map<String, dynamic> studentInfo,
    required String title,
    required List<dynamic> payments,
    required bool isAdditional,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ReceiptShareSheet(
        studentInfo: studentInfo,
        title: title,
        payments: payments,
        isAdditional: isAdditional,
        feeService: widget.feeService,
      ),
    );
  }

  Widget _buildLedgerStudentAvatar(String photoUrl, String name) {
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'S';
    return Container(
      width: 66,
      height: 66,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFFF1F5F9),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
      ),
      child: ClipOval(
        child: photoUrl.isNotEmpty
            ? CachedNetworkImage(
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
                        widget.title,
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
                        Text(
                          studentName.isNotEmpty ? studentName : 'Student',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
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

                  if (widget.payments.isEmpty)
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
                    ...widget.payments.map((p) {
                      final pid = int.tryParse(p['id']?.toString() ?? '0') ?? 0;
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
                                          : () => _shareReceipt(pid, receiptNo, widget.title),
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
                    }).toList(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
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

  const _DepositDialog({
    Key? key,
    required this.studentId,
    required this.student,
    required this.payments,
    required this.classFeeConfig,
    required this.feeService,
    required this.onSuccess,
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
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _partialAmountController = TextEditingController();

  String _paymentMethod = 'Cash';
  final List<String> _paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  bool _isSaving = false;
  String _errorMessage = '';

  Map<String, dynamic> _monthlyFeeConfig = {};

  String _workingAyName = '';
  String _workingAyStatus = 'ACTIVE';

  @override
  void initState() {
    super.initState();
    _loadWorkingAy();
    _initMonthlyConfig();
    _autoSelectEarliestUnpaid();
  }

  Future<void> _loadWorkingAy() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        setState(() {
          _workingAyName = prefs.getString('selected_academic_year_name') ?? '';
          _workingAyStatus = prefs.getString('selected_academic_year_status') ?? 'ACTIVE';
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
      if (disc >= gross) {
        return 'Discount amount (₹$disc) must be less than payable fee (₹$gross).';
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
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
                                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
                              'Deposit (₹$totalDeposit)',
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
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _partialAmountController = TextEditingController();

  String _paymentMethod = 'Cash';
  final List<String> _paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

  bool _isSaving = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _initSelection();
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
      if (disc >= gross) {
        return 'Discount amount (₹$disc) must be less than payable fee (₹$gross).';
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
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
                                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
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
                              'Deposit (₹$totalDeposit)',
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
