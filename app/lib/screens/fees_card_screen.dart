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
    Key? key,
    required this.baseUrl,
    required this.token,
    this.studentId,
  }) : super(key: key);

  @override
  State<FeesCardScreen> createState() => _FeesCardScreenState();
}

class _FeesCardScreenState extends State<FeesCardScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isLoading = true;
  String _errorText = '';

  double _totalOutstanding = 0.0;
  double _monthlyDue = 0.0;
  double _additionalDue = 0.0;
  List<dynamic> _monthlyFees = [];
  List<dynamic> _additionalFees = [];

  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _fetchFeesData();
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
      final uri = Uri.parse('${widget.baseUrl}/api/student/fees/card');
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
          _totalOutstanding = (data['total_outstanding'] ?? 0.0).toDouble();
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
        _errorText = 'An error occurred. Please check connection.';
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadReceipt(int paymentId, bool isAdditional, String monthOrDesc) async {
    setState(() {
      _isDownloading = true;
    });
    try {
      final addParam = isAdditional ? '1' : '0';
      final uri = Uri.parse('${widget.baseUrl}/api/student/fees/receipt?id=$paymentId&additional=$addParam');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        final cleanMonth = monthOrDesc.replaceAll(RegExp(r'\s+'), '_');
        final defaultFilename = '${cleanMonth}_Fee_Receipt.pdf';
        
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(savedPath != null ? 'Fee Receipt saved to Downloads.' : 'Download failed.'),
            action: savedPath != null ? SnackBarAction(
              label: 'OPEN',
              textColor: Colors.amber.shade300,
              onPressed: () async {
                await Printing.layoutPdf(onLayout: (_) async => response.bodyBytes, name: defaultFilename);
              },
            ) : null,
            behavior: SnackBarBehavior.floating,
            backgroundColor: savedPath != null ? const Color(0xFF059669) : Colors.red,
          ),
        );
      } else {
        throw Exception('Server error: ${response.statusCode}');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to download receipt: ${e.toString()}'),
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
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      if (monthInt < 1 || monthInt > 12) return dateStr;
      final formattedDay = dayInt.toString().padLeft(2, '0');
      return '$formattedDay ${months[monthInt - 1]} $year';
    } catch (e) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Fees Card',
          style: TextStyle(fontWeight: FontWeight.w900, color: Colors.black87),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _fetchFeesData,
            )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: const Color(0xFFD97706)))
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
                        // Outstanding summary card
                        _buildSummaryCard(),
                        const SizedBox(height: 10),
                        // Page view indicator
                        _buildPageIndicator(),
                        const SizedBox(height: 8),
                        // Swipable card contents
                        Expanded(
                          child: PageView(
                            controller: _pageController,
                            onPageChanged: (idx) {
                              setState(() {
                                _currentPage = idx;
                              });
                            },
                            children: [
                              _buildMonthWiseCard(),
                              _buildAdditionalFeeCard(),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (_isDownloading)
                      Container(
                        color: Colors.black.withOpacity(0.3),
                        child: const Center(
                          child: Card(
                            margin: EdgeInsets.all(24),
                            child: Padding(
                              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircularProgressIndicator(color: const Color(0xFFD97706)),
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

  Widget _buildSummaryCard() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFD97706), Color(0xFFB45309)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD97706).withValues(alpha: 0.35),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TOTAL OUTSTANDING',
            style: TextStyle(
              color: Color(0xFFFEF3C7),
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '₹${_totalOutstanding.round()}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  _pageController.animateToPage(
                    0,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Monthly Dues',
                        style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${_monthlyDue.round()}',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                width: 1,
                height: 30,
                color: Colors.white.withValues(alpha: 0.25),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  _pageController.animateToPage(
                    1,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Additional Dues',
                        style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${_additionalDue.round()}',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPageIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(2, (idx) {
        final isSelected = _currentPage == idx;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isSelected ? 20 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }

  void _showPartiallyPaidDialog(Map<String, dynamic> item, String title, {bool isAdditional = false}) {
    final amount = (item['amount'] ?? 0).round();
    final paidAmount = (item['paid_amount'] ?? 0).round();
    final discountAmount = (item['discount_amount'] ?? 0).round();
    final remainingAmount = (item['remaining_amount'] ?? 0).round();

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
          if (paidAmount > 0 && item['id'] != null && item['id'] != 0)
            TextButton.icon(
              onPressed: () {
                Navigator.of(ctx).pop();
                _downloadReceipt(
                  item['id'],
                  isAdditional,
                  isAdditional ? (item['description'] ?? 'Fee') : (item['month'] ?? 'Fee'),
                );
              },
              icon: const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFFB45309)),
              label: const Text('Download Receipt', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
            ),
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

  Widget _buildMonthWiseCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Month-wise Fees',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  itemCount: _monthlyFees.length,
                  separatorBuilder: (ctx, idx) => Divider(color: Colors.grey.shade100, height: 1),
                  itemBuilder: (ctx, idx) {
                    final item = _monthlyFees[idx];
                    final status = (item['status'] ?? '').toString();
                    final isPaid = status == 'Paid';
                    final isPartiallyPaid = !isPaid && (status == 'Partially Paid' || ((item['paid_amount'] ?? 0) as num) > 0);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['month'] ?? '',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text.rich(
                                TextSpan(
                                  children: [
                                    if (isPaid)
                                      TextSpan(
                                        text: 'Fee: ₹${(item['amount'] ?? 0).round()}   •   Paid: ₹${(item['paid_amount'] ?? item['amount'] ?? 0).round()}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      )
                                    else if (isPartiallyPaid) ...[
                                      TextSpan(
                                        text: 'Fee: ₹${(item['amount'] ?? 0).round()}   •   Paid: ₹${(item['paid_amount'] ?? 0).round()}   •   ',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      TextSpan(
                                        text: 'Due: ₹${(item['remaining_amount'] ?? 0).round()}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFDC2626),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ] else ...[
                                      TextSpan(
                                        text: 'Fee: ₹${(item['amount'] ?? 0).round()}   •   ',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      TextSpan(
                                        text: 'Due: ₹${(item['remaining_amount'] ?? item['amount'] ?? 0).round()}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: Color(0xFFDC2626),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isPaid) ...[
                                Container(
                                  height: 24,
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD1FAE5),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'PAID',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                      color: Color(0xFF065F46),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: () => _downloadReceipt(
                                    item['id'],
                                    false,
                                    item['month'],
                                  ),
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    height: 24,
                                    width: 28,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFFBEB),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: const Color(0xFFFDE68A)),
                                    ),
                                    child: const Icon(
                                      Icons.receipt_long_rounded,
                                      size: 14,
                                      color: Color(0xFFB45309),
                                    ),
                                  ),
                                ),
                              ] else if (isPartiallyPaid) ...[
                                InkWell(
                                  onTap: () => _showPartiallyPaidDialog(item, '${item['month']} Fee Details', isAdditional: false),
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    height: 24,
                                    padding: const EdgeInsets.symmetric(horizontal: 8),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDBEAFE),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'PARTIAL',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                            color: Color(0xFF1E40AF),
                                          ),
                                        ),
                                        SizedBox(width: 2),
                                        Icon(Icons.info_outline, size: 12, color: Color(0xFF1E40AF)),
                                      ],
                                    ),
                                  ),
                                ),
                                if (item['id'] != null && item['id'] != 0) ...[
                                  const SizedBox(width: 6),
                                  InkWell(
                                    onTap: () => _downloadReceipt(
                                      item['id'],
                                      false,
                                      item['month'],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                    child: Container(
                                      height: 24,
                                      width: 28,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFFBEB),
                                        borderRadius: BorderRadius.circular(6),
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
                              ] else ...[
                                Container(
                                  height: 24,
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'UNPAID',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                      color: Color(0xFF92400E),
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
          ),
        ),
      ),
    );
  }

  Widget _buildAdditionalFeeCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Additional Fees',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _additionalFees.isEmpty
                    ? Center(
                        child: Text(
                          'No additional fees configured.',
                          style: TextStyle(color: Colors.grey.shade500),
                        ),
                      )
                    : ListView.separated(
                        physics: const BouncingScrollPhysics(),
                        itemCount: _additionalFees.length,
                        separatorBuilder: (ctx, idx) => Divider(color: Colors.grey.shade100, height: 1),
                        itemBuilder: (ctx, idx) {
                          final item = _additionalFees[idx];
                          final status = (item['status'] ?? '').toString();
                          final isPaid = status == 'Paid';
                          final isPartiallyPaid = !isPaid && (status == 'Partially Paid' || ((item['paid_amount'] ?? 0) as num) > 0);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item['description'] ?? '',
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      if (item['custom_description'] != null && item['custom_description'].toString().isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2, bottom: 2),
                                          child: Text(
                                            item['custom_description'],
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey.shade500,
                                            ),
                                          ),
                                        ),
                                      const SizedBox(height: 4),
                                      Text(
                                        isPaid
                                            ? 'Paid: ${_formatDate(item['payment_date'])}'
                                            : isPartiallyPaid
                                                ? 'Paid: ₹${(item['paid_amount'] ?? 0).round()}   •   Rem: ₹${(item['remaining_amount'] ?? 0).round()}'
                                                : 'Amount: ₹${(item['amount'] ?? 0).round()}${item['due_date'] != null && item['due_date'].toString().isNotEmpty ? '   •   Due: ${_formatDate(item['due_date'])}' : ''}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade600,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isPaid) ...[
                                      Container(
                                        height: 24,
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFD1FAE5),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          'PAID',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                            color: Color(0xFF065F46),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      InkWell(
                                        onTap: () => _downloadReceipt(
                                          item['id'],
                                          true,
                                          item['description'],
                                        ),
                                        borderRadius: BorderRadius.circular(6),
                                        child: Container(
                                          height: 24,
                                          width: 28,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFFFBEB),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(color: const Color(0xFFFDE68A)),
                                          ),
                                          child: const Icon(
                                            Icons.receipt_long_rounded,
                                            size: 14,
                                            color: Color(0xFFB45309),
                                          ),
                                        ),
                                      ),
                                    ] else if (isPartiallyPaid) ...[
                                      InkWell(
                                        onTap: () => _showPartiallyPaidDialog(item, '${item['description']} Details', isAdditional: true),
                                        borderRadius: BorderRadius.circular(6),
                                        child: Container(
                                          height: 24,
                                          padding: const EdgeInsets.symmetric(horizontal: 8),
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFDBEAFE),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: const Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                'PARTIAL',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: 0.3,
                                                  color: Color(0xFF1E40AF),
                                                ),
                                              ),
                                              SizedBox(width: 2),
                                              Icon(Icons.info_outline, size: 12, color: Color(0xFF1E40AF)),
                                            ],
                                          ),
                                        ),
                                      ),
                                      if (item['id'] != null && item['id'] != 0) ...[
                                        const SizedBox(width: 6),
                                        InkWell(
                                          onTap: () => _downloadReceipt(
                                            item['id'],
                                            true,
                                            item['description'],
                                          ),
                                          borderRadius: BorderRadius.circular(6),
                                          child: Container(
                                            height: 24,
                                            width: 28,
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFFFFBEB),
                                              borderRadius: BorderRadius.circular(6),
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
                                    ] else ...[
                                      Container(
                                        height: 24,
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          'PENDING',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                            color: Color(0xFF92400E),
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
          ),
        ),
      ),
    );
  }
}
