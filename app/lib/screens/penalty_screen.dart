import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/http_service.dart' as http;
import '../services/leave_service.dart';

class PenaltyScreen extends StatefulWidget {
  final LeaveService leaveService;

  const PenaltyScreen({
    super.key,
    required this.leaveService,
  });

  @override
  State<PenaltyScreen> createState() => _PenaltyScreenState();
}

class _PenaltyScreenState extends State<PenaltyScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  // Top Stats
  String _academicSession = 'N/A';
  int _totalStudents = 0;
  int _studentsWithDue = 0;
  double _totalOutstanding = 0.0;
  String? _lastAppliedDate;
  String? _lastAppliedBy;

  // Penalty Config States
  final TextEditingController _penaltyPercentageController = TextEditingController();
  final TextEditingController _penaltyDescController = TextEditingController();
  bool _isPenaltySaved = false;
  String _penaltyStatus = 'Active';
  bool _isSavingPenalty = false;
  bool _isRemovingPenalty = false;

  String _formatCurrency(double amount) {
    final intVal = amount.round();
    final s = intVal.toString();
    if (s.length <= 3) return '₹$s';
    final lastThree = s.substring(s.length - 3);
    final rest = s.substring(0, s.length - 3);
    final reg = RegExp(r'\B(?=(\d{2})+(?!\d))');
    final formattedRest = rest.replaceAll(reg, ',');
    return '₹$formattedRest,$lastThree';
  }

  String _formatDateFull(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return 'N/A';
    try {
      final dt = DateTime.parse(dateStr);
      final months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateStr;
    }
  }

  @override
  void initState() {
    super.initState();
    _penaltyPercentageController.addListener(_onPercentageChanged);
    _loadData();
  }

  void _onPercentageChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _penaltyPercentageController.removeListener(_onPercentageChanged);
    _penaltyPercentageController.dispose();
    _penaltyDescController.dispose();
    super.dispose();
  }

  bool get _canSavePenalty {
    if (_isSavingPenalty || _isRemovingPenalty) return false;
    final text = _penaltyPercentageController.text.trim();
    if (text.isEmpty) return false;
    final val = double.tryParse(text);
    return val != null && val > 0 && val <= 100;
  }

  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token') ?? widget.leaveService.token;
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final headers = await _getHeaders();
      final baseUrl = widget.leaveService.baseUrl;

      final statsFuture = http.get(
        Uri.parse('$baseUrl/api/school/late-payment-penalty/stats'),
        headers: headers,
      );

      final configFuture = http.get(
        Uri.parse('$baseUrl/api/school/late-payment-penalty/config'),
        headers: headers,
      );

      final responses = await Future.wait([statsFuture, configFuture]);
      final statsRes = responses[0];
      final configRes = responses[1];

      // 1. Process Stats
      if (statsRes.statusCode == 200) {
        final data = json.decode(statsRes.body);
        final statsData = (data is Map && data['data'] != null) ? data['data'] : data;
        if (statsData is Map) {
          _academicSession = statsData['current_academic_session']?.toString() ?? 'N/A';
          _totalStudents = int.tryParse(statsData['total_students']?.toString() ?? '0') ?? 0;
          _studentsWithDue = int.tryParse(statsData['students_having_due']?.toString() ?? '0') ?? 0;
          _totalOutstanding = double.tryParse(statsData['total_outstanding_due']?.toString() ?? '0') ?? 0.0;
          _lastAppliedDate = statsData['last_applied_date']?.toString();
          _lastAppliedBy = statsData['last_applied_by']?.toString();
        }
      }

      // 2. Process Penalty Config
      if (configRes.statusCode == 200) {
        final data = json.decode(configRes.body);
        final configData = (data is Map && data['data'] != null) ? data['data'] : data;
        if (configData is Map && configData['percentage'] != null && configData['percentage'].toString().isNotEmpty) {
          final pctVal = double.tryParse(configData['percentage'].toString());
          if (pctVal != null && pctVal > 0) {
            _penaltyPercentageController.text = pctVal.toStringAsFixed(2);
            _penaltyDescController.text = configData['description']?.toString() ?? 'Late Payment Penalty $_academicSession';
            _penaltyStatus = configData['status']?.toString() ?? 'Active';
            _isPenaltySaved = true;
          } else {
            _isPenaltySaved = false;
            _penaltyPercentageController.text = '';
            _penaltyDescController.text = 'Late Payment Penalty $_academicSession';
          }
        } else {
          _isPenaltySaved = false;
          _penaltyPercentageController.text = '';
          _penaltyDescController.text = 'Late Payment Penalty $_academicSession';
        }
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Future<void> _savePenaltyConfig() async {
    final pctText = _penaltyPercentageController.text.trim();
    if (pctText.isEmpty) {
      _showSnackBar('Please enter a penalty percentage.', isError: true);
      return;
    }

    final pct = double.tryParse(pctText);
    if (pct == null || pct <= 0 || pct > 100) {
      _showSnackBar('Penalty percentage must be between 0.01 and 100.', isError: true);
      return;
    }

    String desc = _penaltyDescController.text.trim();
    if (desc.isEmpty) {
      desc = 'Late Payment Penalty $_academicSession';
      _penaltyDescController.text = desc;
    }

    setState(() => _isSavingPenalty = true);

    try {
      final headers = await _getHeaders();
      final baseUrl = widget.leaveService.baseUrl;

      final response = await http.post(
        Uri.parse('$baseUrl/api/school/late-payment-penalty/config'),
        headers: headers,
        body: json.encode({
          'percentage': pct,
          'description': desc,
          'status': _penaltyStatus,
        }),
      );

      final resData = json.decode(response.body);
      if (response.statusCode == 200 && resData['status'] == 'success') {
        if (mounted) {
          setState(() {
            _isPenaltySaved = true;
          });
          _showSnackBar(resData['message'] ?? 'Penalty configuration saved successfully.');
        }
      } else {
        final errMsg = resData['message'] ?? 'Failed to save penalty configuration.';
        _showSnackBar(errMsg, isError: true);
      }
    } catch (e) {
      _showSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _isSavingPenalty = false);
    }
  }

  Future<void> _confirmRemovePenalty() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 22),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Remove Penalty',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to remove the Late Payment Penalty configuration? This will cancel the automatic penalty application during Academic Year Migration.',
          style: TextStyle(fontSize: 13.5, color: Color(0xFF334155), fontWeight: FontWeight.w500, height: 1.45),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Remove', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );

    if (confirmed == true) {
      _removePenaltyConfig();
    }
  }

  Future<void> _removePenaltyConfig() async {
    setState(() => _isRemovingPenalty = true);

    try {
      final headers = await _getHeaders();
      final baseUrl = widget.leaveService.baseUrl;

      final response = await http.delete(
        Uri.parse('$baseUrl/api/school/late-payment-penalty/config'),
        headers: headers,
      );

      final resData = json.decode(response.body);
      if (response.statusCode == 200 && resData['status'] == 'success') {
        if (mounted) {
          setState(() {
            _isPenaltySaved = false;
            _penaltyPercentageController.text = '';
            _penaltyDescController.text = 'Late Payment Penalty $_academicSession';
          });
          _showSnackBar(resData['message'] ?? 'Penalty configuration removed successfully.');
        }
      } else {
        final errMsg = resData['message'] ?? 'Failed to remove penalty configuration.';
        _showSnackBar(errMsg, isError: true);
      }
    } catch (e) {
      _showSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _isRemovingPenalty = false);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.check_circle_rounded,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFFD97706),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFBF8F2),
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: isDark ? Colors.white : const Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2E2415) : const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A)),
              ),
              child: const Icon(Icons.timer_outlined, color: Color(0xFFD97706), size: 18),
            ),
            const SizedBox(width: 10),
            Text(
              'PENALTY',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 16,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0.5,
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.opaque,
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Color(0xFFD97706),
                ),
              )
            : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFDC2626)),
                          const SizedBox(height: 12),
                          Text(
                            _errorMessage!,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 14, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569), fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: _loadData,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Retry'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    color: const Color(0xFFD97706),
                    onRefresh: _loadData,
                    child: SingleChildScrollView(
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Top Statistics Grid
                          _buildTopStatsGrid(isDark),

                          if (_lastAppliedDate != null && _lastAppliedDate!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            _buildLastAppliedBanner(isDark),
                          ],

                          const SizedBox(height: 18),

                          // Late Payment Penalty Card
                          _buildPenaltySection(isDark),

                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
      ),
    );
  }

  Widget _buildTopStatsGrid(bool isDark) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final double itemWidth = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _buildStatCard(
              width: itemWidth,
              title: 'ACADEMIC SESSION',
              value: _academicSession,
              icon: Icons.calendar_month_rounded,
              iconColor: const Color(0xFFD97706),
              valueColor: isDark ? Colors.white : const Color(0xFF0F172A),
              isDark: isDark,
            ),
            _buildStatCard(
              width: itemWidth,
              title: 'TOTAL STUDENTS',
              value: _totalStudents.toString(),
              icon: Icons.people_alt_outlined,
              iconColor: const Color(0xFF6366F1),
              valueColor: isDark ? Colors.white : const Color(0xFF0F172A),
              isDark: isDark,
            ),
            _buildStatCard(
              width: itemWidth,
              title: 'STUDENTS WITH DUE',
              value: _studentsWithDue.toString(),
              icon: Icons.warning_amber_rounded,
              iconColor: const Color(0xFFD97706),
              valueColor: const Color(0xFFD97706),
              isDark: isDark,
            ),
            _buildStatCard(
              width: itemWidth,
              title: 'TOTAL OUTSTANDING',
              value: _formatCurrency(_totalOutstanding),
              icon: Icons.account_balance_outlined,
              iconColor: const Color(0xFF059669),
              valueColor: const Color(0xFF059669),
              isDark: isDark,
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatCard({
    required double width,
    required String title,
    required String value,
    required IconData icon,
    required Color iconColor,
    required Color valueColor,
    required bool isDark,
  }) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFFFFDF8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFF1EDE4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.02),
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
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              Icon(icon, size: 16, color: iconColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLastAppliedBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF064E3B).withOpacity(0.3) : const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? const Color(0xFF065F46) : const Color(0xFFBBF7D0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 17),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 11, color: isDark ? const Color(0xFF86EFAC) : const Color(0xFF166534), height: 1.35),
                children: [
                  const TextSpan(text: 'Late Payment Penalty was last successfully applied for this session on '),
                  TextSpan(
                    text: _formatDateFull(_lastAppliedDate),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (_lastAppliedBy != null && _lastAppliedBy!.isNotEmpty) ...[
                    const TextSpan(text: ' by '),
                    TextSpan(
                      text: _lastAppliedBy!,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                  const TextSpan(text: '.'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPenaltySection(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFFFFDF8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFF1EDE4), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.02),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2E2415) : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.timer_outlined, color: Color(0xFFD97706), size: 16),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'LATE PAYMENT PENALTY FOR AY ($_academicSession)',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          Divider(color: isDark ? const Color(0xFF334155) : const Color(0xFFF1EDE4), height: 1),
          const SizedBox(height: 14),

          // 1. Penalty Percentage (%)
          _buildFieldLabel('PENALTY PERCENTAGE (%)', isDark),
          const SizedBox(height: 6),
          TextFormField(
            controller: _penaltyPercentageController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
            decoration: _inputDecoration(
              hintText: 'e.g. 5.50',
              isDark: isDark,
              suffixIcon: const Icon(Icons.percent_rounded, size: 18, color: Color(0xFF94A3B8)),
            ),
          ),

          const SizedBox(height: 14),

          // 2. Custom Description
          _buildFieldLabel('CUSTOM DESCRIPTION', isDark),
          const SizedBox(height: 6),
          TextFormField(
            controller: _penaltyDescController,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A)),
            decoration: _inputDecoration(
              hintText: 'Late Payment Penalty $_academicSession',
              isDark: isDark,
            ),
          ),

          const SizedBox(height: 14),

          // 3. Target Academic Session (Read-only)
          _buildFieldLabel('TARGET ACADEMIC SESSION', isDark),
          const SizedBox(height: 6),
          TextFormField(
            initialValue: _academicSession,
            enabled: false,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
            decoration: _inputDecoration(
              filled: true,
              isDark: isDark,
              fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
            ),
          ),

          const SizedBox(height: 14),

          // Information box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2E2415) : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFD97706)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'LATE PAYMENT PENALTY INFORMATION',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: isDark ? const Color(0xFFF59E0B) : const Color(0xFFB45309),
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'If you configure a Late Payment Penalty, it will be added automatically after the Academic Year Migration is completed. Only students who have pending dues will receive the penalty. Students who have no pending dues will not be affected. You can change or remove this configuration anytime before migration.',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _canSavePenalty ? _savePenaltyConfig : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _canSavePenalty ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                    foregroundColor: _canSavePenalty ? Colors.white : const Color(0xFF94A3B8),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSavingPenalty
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          _isPenaltySaved ? 'UPDATE CONFIGURATION' : 'SAVE CONFIGURATION',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                        ),
                ),
              ),
              if (_isPenaltySaved) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isRemovingPenalty ? null : _confirmRemovePenalty,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFFCA5A5)),
                      backgroundColor: const Color(0xFFFEF2F2),
                      foregroundColor: const Color(0xFFDC2626),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isRemovingPenalty
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFDC2626)),
                          )
                        : const Text(
                            'REMOVE',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                          ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String label, [bool isDark = false]) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
        letterSpacing: 0.3,
      ),
    );
  }

  InputDecoration _inputDecoration({
    String? hintText,
    Widget? suffixIcon,
    bool filled = false,
    Color? fillColor,
    bool isDark = false,
  }) {
    return InputDecoration(
      hintText: hintText,
      hintStyle: TextStyle(fontSize: 13, color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8), fontWeight: FontWeight.normal),
      suffixIcon: suffixIcon,
      filled: filled,
      fillColor: fillColor ?? (isDark ? const Color(0xFF0F172A) : Colors.white),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0)),
      ),
    );
  }
}

