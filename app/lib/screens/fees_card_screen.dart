import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:school_hub/services/notification_helper.dart';

class FeesCardScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final int? studentId;

  const FeesCardScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    this.studentId,
  });

  @override
  State<FeesCardScreen> createState() => _FeesCardScreenState();
}

class _FeesCardScreenState extends State<FeesCardScreen> {
  late final PageController _pageController;
  int _selectedTab = 0; // 0: Monthly, 1: Additional
  bool _isLoading = true;
  String _errorText = '';

  double _monthlyDue = 0.0;
  double _additionalDue = 0.0;
  List<dynamic> _monthlyFees = [];
  List<dynamic> _additionalFees = [];

  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _selectedTab);
    _markFeesNotificationsRead();
    _fetchFeesData();
  }

  Future<void> _markFeesNotificationsRead() async {
    try {
      if (widget.token.isEmpty) return;
      final uri = Uri.parse('${widget.baseUrl}/api/student/notifications/0/read').replace(
        queryParameters: widget.studentId != null
            ? {'student_id': widget.studentId.toString()}
            : null,
      );
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
        body: json.encode({'module': 'fees'}),
      );
    } catch (_) {}
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _fetchFeesData() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/student/fees/card').replace(
        queryParameters: widget.studentId != null
            ? {'student_id': widget.studentId.toString()}
            : null,
      );
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? {};
        setState(() {
          _monthlyDue = (data['monthly_due'] ?? 0.0).toDouble();
          _additionalDue = (data['additional_due'] ?? 0.0).toDouble();
          _monthlyFees = data['monthly_fees'] ?? [];
          _additionalFees = data['additional_fees'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorText = 'Failed to load fees details.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorText = http.formatErrorMessage(e, fallback: 'Failed to load fees details.');
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadReceipt(int paymentId, bool isAdditional, String monthOrDesc, {String? receiptNo}) async {
    setState(() {
      _isDownloading = true;
    });
    try {
      final addParam = isAdditional ? '1' : '0';
      final rParam = (receiptNo != null && receiptNo.trim().isNotEmpty) ? '&receipt_no=${Uri.encodeComponent(receiptNo.trim())}' : '';
      final sParam = widget.studentId != null ? '&student_id=${widget.studentId}' : '';
      final uri = Uri.parse('${widget.baseUrl}/api/student/fees/receipt?id=$paymentId&additional=$addParam$rParam$sParam');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        final cleanMonth = monthOrDesc.replaceAll(RegExp(r'\s+'), '_');
        final suffix = (receiptNo != null && receiptNo.trim().isNotEmpty) ? '_$receiptNo' : '';
        final defaultFilename = '$cleanMonth${suffix}_Fee_Receipt.pdf';

        String? savedPath;

        if (Platform.isAndroid) {
          const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
          try {
            final savedUri = await platform.invokeMethod<String>(
              'saveFileToDownloads',
              {
                'fileName': defaultFilename,
                'bytes': response.bodyBytes,
              },
            );
            savedPath = savedUri;
          } catch (e) {
            debugPrint('MethodChannel save failed: $e');
            final appExternalDir = await getExternalStorageDirectory();
            if (appExternalDir != null) {
              final fallbackFile = File('${appExternalDir.path}/$defaultFilename');
              await fallbackFile.writeAsBytes(response.bodyBytes);
              savedPath = fallbackFile.path;
            }
          }
        } else {
          final appDocDir = await getApplicationDocumentsDirectory();
          final file = File('${appDocDir.path}/$defaultFilename');
          await file.writeAsBytes(response.bodyBytes);
          savedPath = file.path;
        }

        if (savedPath != null) {
          try {
            await NotificationHelper.showDownloadNotification(
              title: 'Fee Receipt Downloaded',
              fileName: defaultFilename,
              bytes: response.bodyBytes,
            );
          } catch (_) {}
        }

        if (!mounted) return;
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(savedPath != null ? 'Fee Receipt saved to Downloads.' : 'Download failed.'),
            duration: const Duration(seconds: 3),
            action: savedPath != null
                ? SnackBarAction(
                    label: 'OPEN',
                    textColor: Colors.amber.shade300,
                    onPressed: () async {
                      await Printing.layoutPdf(onLayout: (_) async => response.bodyBytes, name: defaultFilename);
                    },
                  )
                : null,
            behavior: SnackBarBehavior.floating,
            backgroundColor: savedPath != null ? const Color(0xFF059669) : Colors.red,
          ),
        );
      } else {
        throw Exception('Server error: ${response.statusCode}');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            http.isNetworkError(e)
                ? http.kNetworkErrorMessage
                : 'Failed to download receipt: ${http.formatErrorMessage(e)}',
          ),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
      }
    }
  }

  void _showPartiallyPaidDialog(Map<String, dynamic> item, String title, {bool isAdditional = false}) {
    final amount = ((item['amount'] ?? 0) as num).round();
    final paidAmount = ((item['paid_amount'] ?? 0) as num).round();
    final discountAmount = ((item['discount_amount'] ?? 0) as num).round();
    final remainingAmount = ((item['remaining_amount'] ?? 0) as num).round();
    final payments = (item['payments'] as List<dynamic>?) ?? [];

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.pie_chart_outline, color: Colors.amber.shade800),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildDetailRow('Payable Amount', '₹$amount', isBold: true),
            const Divider(height: 16),
            _buildDetailRow('Partially Paid Amount', '₹$paidAmount', valueColor: Colors.green.shade700),
            if (discountAmount > 0)
              _buildDetailRow('Discount Amount', '- ₹$discountAmount', valueColor: Colors.indigo.shade700),
            const Divider(height: 16),
            _buildDetailRow('Remaining Amount', '₹$remainingAmount', valueColor: Colors.red.shade700, isBold: true),
          ],
        ),
        actions: [
          if (paidAmount > 0) ...[
            if (payments.length > 1)
              ...List.generate(payments.length, (idx) {
                final p = payments[idx];
                final pid = (p['id'] ?? item['id'] ?? 0) as int;
                final rno = p['receipt_no']?.toString();
                return TextButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _downloadReceipt(
                      pid,
                      isAdditional,
                      '$title Part ${idx + 1}',
                      receiptNo: rno,
                    );
                  },
                  icon: const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFFB45309)),
                  label: Text('Receipt ${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                );
              })
            else if (item['id'] != null && item['id'] != 0)
              TextButton.icon(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _downloadReceipt(
                    item['id'],
                    isAdditional,
                    isAdditional ? (item['description'] ?? 'Fee') : (item['month'] ?? 'Fee'),
                    receiptNo: item['receipt_no']?.toString(),
                  );
                },
                icon: const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFFB45309)),
                label: const Text('Download Receipt', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
              ),
          ],
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo)),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor, bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade700,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.bold,
              color: valueColor ?? Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty || dateStr == '—' || dateStr == '-') {
      return '—';
    }
    try {
      final parts = dateStr.split(' ')[0].split('-');
      if (parts.length != 3) return dateStr;
      final year = parts[0];
      final monthInt = int.parse(parts[1]);
      final dayInt = int.parse(parts[2]);

      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      if (monthInt < 1 || monthInt > 12) return dateStr;
      final formattedDay = dayInt.toString().padLeft(2, '0');
      return '$formattedDay ${months[monthInt - 1]} $year';
    } catch (e) {
      return dateStr;
    }
  }

  Widget _buildReceiptButtons({
    required List<dynamic> payments,
    required bool isAdditional,
    required String title,
    int fallbackId = 0,
    String? fallbackReceiptNo,
  }) {
    final cleanPayments = payments.where((p) {
      if (p is Map) {
        final pid = p['id'] ?? 0;
        final rno = p['receipt_no'];
        return (pid != null && pid != 0) || (rno != null && rno.toString().trim().isNotEmpty);
      }
      return false;
    }).toList();

    if (cleanPayments.isEmpty) {
      if (fallbackId != 0 || (fallbackReceiptNo != null && fallbackReceiptNo.isNotEmpty)) {
        cleanPayments.add({
          'id': fallbackId,
          'receipt_no': fallbackReceiptNo,
        });
      } else {
        return const SizedBox.shrink();
      }
    }

    cleanPayments.sort((a, b) => ((a['id'] ?? 0) as num).compareTo((b['id'] ?? 0) as num));

    if (cleanPayments.length == 1) {
      final p = cleanPayments.first;
      final pid = (p['id'] ?? fallbackId ?? 0) as int;
      final rno = (p['receipt_no'] ?? fallbackReceiptNo)?.toString();
      return _buildSingleReceiptIcon(
        onTap: () => _downloadReceipt(pid, isAdditional, title, receiptNo: rno),
        badgeNumber: null,
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(cleanPayments.length, (idx) {
        final p = cleanPayments[idx];
        final pid = (p['id'] ?? fallbackId ?? 0) as int;
        final rno = (p['receipt_no'] ?? fallbackReceiptNo)?.toString();
        final isLast = idx == cleanPayments.length - 1;
        return Padding(
          padding: EdgeInsets.only(right: isLast ? 0 : 8),
          child: _buildSingleReceiptIcon(
            onTap: () => _downloadReceipt(pid, isAdditional, '$title Part ${idx + 1}', receiptNo: rno),
            badgeNumber: idx + 1,
          ),
        );
      }),
    );
  }

  Widget _buildSingleReceiptIcon({
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6),
      appBar: AppBar(
        title: const Text(
          'FEES CARD',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFF0F172A), letterSpacing: 0.5),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: const Icon(Icons.refresh, color: Color(0xFF0F172A)),
              onPressed: _fetchFeesData,
            )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
          : _errorText.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorText, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _fetchFeesData,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    Column(
                      children: [
                        // Segmented tabs at top
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          child: _buildSegmentedTabs(),
                        ),
                        // Swipable PageView for Monthly & Additional
                        Expanded(
                          child: PageView(
                            controller: _pageController,
                            onPageChanged: (index) {
                              setState(() => _selectedTab = index);
                            },
                            children: [
                              RefreshIndicator(
                                onRefresh: _fetchFeesData,
                                color: const Color(0xFFD97706),
                                child: SingleChildScrollView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      _buildMonthlyTabContent(),
                                      const SizedBox(height: 24),
                                    ],
                                  ),
                                ),
                              ),
                              RefreshIndicator(
                                onRefresh: _fetchFeesData,
                                color: const Color(0xFFD97706),
                                child: SingleChildScrollView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      _buildAdditionalTabContent(),
                                      const SizedBox(height: 24),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (_isDownloading)
                      Container(
                        color: Colors.black.withValues(alpha: 0.3),
                        child: const Center(
                          child: Card(
                            margin: EdgeInsets.all(24),
                            child: Padding(
                              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircularProgressIndicator(color: Color(0xFFD97706)),
                                  SizedBox(width: 16),
                                  Text(
                                    'Downloading receipt...',
                                    style: TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }

  Widget _buildSegmentedTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                _pageController.animateToPage(
                  0,
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: _selectedTab == 0 ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _selectedTab == 0
                      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Monthly',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: _selectedTab == 0 ? FontWeight.w800 : FontWeight.w600,
                        color: _selectedTab == 0 ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                      ),
                    ),
                    if (_monthlyDue > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '₹${_monthlyDue.round()}',
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
              onTap: () {
                _pageController.animateToPage(
                  1,
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeInOut,
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: _selectedTab == 1 ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _selectedTab == 1
                      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Additional',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: _selectedTab == 1 ? FontWeight.w800 : FontWeight.w600,
                        color: _selectedTab == 1 ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                      ),
                    ),
                    if (_additionalDue > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '₹${_additionalDue.round()}',
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
    );
  }

  Widget _buildMonthlyTabContent() {
    final unpaidCount = _monthlyFees.where((m) {
      final s = (m['status'] ?? '').toString().toUpperCase();
      final rem = ((m['remaining_amount'] ?? 0) as num).toDouble();
      return s != 'PAID' && rem > 0;
    }).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Monthly Tuition Fees Breakdown',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            if (unpaidCount > 0)
              Text(
                '$unpaidCount Unpaid',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (_monthlyFees.isEmpty)
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
                Icon(Icons.calendar_today_outlined, size: 36, color: Color(0xFF94A3B8)),
                SizedBox(height: 8),
                Text(
                  'No monthly fee records found.',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                ),
              ],
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _monthlyFees.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final item = _monthlyFees[index];
              final monthName = (item['month'] ?? '').toString();
              final rawStatus = (item['status'] ?? '').toString();
              final isPaid = rawStatus == 'Paid' || rawStatus == 'PAID';
              final isPartial = rawStatus == 'Partially Paid' ||
                  rawStatus == 'PARTIAL' ||
                  (!isPaid && ((item['paid_amount'] ?? 0) as num) > 0);
              final fee = ((item['amount'] ?? 0) as num).round();
              final paid = ((item['paid_amount'] ?? 0) as num).round();
              final rem = ((item['remaining_amount'] ?? 0) as num).round();
              final paymentId = item['id'];
              final itemPayments = (item['payments'] as List<dynamic>?) ?? [];

              final statusText = isPaid ? 'PAID' : (isPartial ? 'PARTIAL' : 'UNPAID');

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
                            monthName.toUpperCase(),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            GestureDetector(
                              onTap: isPartial
                                  ? () => _showPartiallyPaidDialog(
                                        Map<String, dynamic>.from(item),
                                        '$monthName Fee Details',
                                        isAdditional: false,
                                      )
                                  : null,
                              child: Container(
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
                                  statusText,
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
                            ),
                            if (isPaid || isPartial) ...[
                              const SizedBox(width: 6),
                              _buildReceiptButtons(
                                payments: itemPayments,
                                isAdditional: false,
                                title: monthName,
                                fallbackId: paymentId ?? 0,
                                fallbackReceiptNo: item['receipt_no']?.toString(),
                              ),
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
                              paid > 0 ? 'Amount: ₹$fee  •  Paid: ₹$paid' : 'Amount: ₹$fee',
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
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildAdditionalTabContent() {
    final unpaidCount = _additionalFees.where((f) {
      final s = (f['status'] ?? '').toString().toUpperCase();
      final rem = ((f['remaining_amount'] ?? 0) as num).toDouble();
      return s != 'PAID' && rem > 0;
    }).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Additional & Annual Fees',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            if (unpaidCount > 0)
              Text(
                '$unpaidCount Unpaid',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706)),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (_additionalFees.isEmpty)
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
            itemCount: _additionalFees.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, idx) {
              final item = _additionalFees[idx];
              final title = (item['description'] ?? 'Fee').toString();
              final customDesc = (item['custom_description'] ?? '').toString();
              final rawStatus = (item['status'] ?? '').toString();
              final isPaid = rawStatus == 'Paid' || rawStatus == 'PAID';
              final isPartial = rawStatus == 'Partially Paid' ||
                  rawStatus == 'PARTIAL' ||
                  (!isPaid && ((item['paid_amount'] ?? 0) as num) > 0);
              final fee = ((item['amount'] ?? 0) as num).round();
              final paid = ((item['paid_amount'] ?? 0) as num).round();
              final rem = ((item['remaining_amount'] ?? 0) as num).round();
              final dueDate = item['due_date'];
              final paymentId = item['id'];
              final itemPayments = (item['payments'] as List<dynamic>?) ?? [];

              final statusText = isPaid ? 'PAID' : (isPartial ? 'PARTIAL' : 'UNPAID');

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
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title.toUpperCase(),
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              ),
                              if (customDesc.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    customDesc,
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            GestureDetector(
                              onTap: isPartial
                                  ? () => _showPartiallyPaidDialog(
                                        Map<String, dynamic>.from(item),
                                        '$title Details',
                                        isAdditional: true,
                                      )
                                  : null,
                              child: Container(
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
                                  statusText,
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
                            ),
                            if (isPaid || isPartial) ...[
                              const SizedBox(width: 6),
                              _buildReceiptButtons(
                                payments: itemPayments,
                                isAdditional: true,
                                title: title,
                                fallbackId: paymentId ?? 0,
                                fallbackReceiptNo: item['receipt_no']?.toString(),
                              ),
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
                                  : (dueDate != null && dueDate.toString().isNotEmpty && dueDate.toString() != '—'
                                      ? 'Amount: ₹$fee  •  Due: ${_formatDate(dueDate.toString())}'
                                      : 'Amount: ₹$fee'),
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
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
