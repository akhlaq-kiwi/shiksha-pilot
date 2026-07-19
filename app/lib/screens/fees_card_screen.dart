import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:file_picker/file_picker.dart';

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
        
        final savedPath = await FilePicker.platform.saveFile(
          fileName: defaultFilename,
          bytes: response.bodyBytes,
        );

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(savedPath != null ? 'Receipt saved successfully.' : 'Download cancelled.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: savedPath != null ? Colors.green : Colors.grey.shade700,
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
      setState(() {
        _isDownloading = false;
      });
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
          'Fees Dashboard',
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
          ? const Center(child: CircularProgressIndicator(color: Colors.indigo))
          : _errorText.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorText, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _fetchFeesData,
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo),
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
                                  CircularProgressIndicator(color: Colors.indigo),
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
        gradient: LinearGradient(
          colors: [Colors.indigo.shade800, Colors.indigo.shade600],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.indigo.shade200.withOpacity(0.5),
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
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '₹${_totalOutstanding.toStringAsFixed(2)}',
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
                        style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${_monthlyDue.toStringAsFixed(2)}',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                width: 1,
                height: 30,
                color: Colors.white24,
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
                        style: TextStyle(color: Colors.white60, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${_additionalDue.toStringAsFixed(2)}',
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
            color: isSelected ? Colors.indigo : Colors.grey.shade300,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
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
                    final isPaid = item['status'] == 'Paid';
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
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isPaid
                                    ? 'Paid: ${_formatDate(item['payment_date'])}'
                                    : 'Amount: ₹${(item['amount'] ?? 0.0).toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              if (isPaid)
                                OutlinedButton(
                                  onPressed: () => _downloadReceipt(
                                    item['id'],
                                    false,
                                    item['month'],
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.indigo,
                                    side: const BorderSide(color: Colors.indigo),
                                    padding: const EdgeInsets.symmetric(horizontal: 12),
                                  ),
                                  child: const Text('Receipt'),
                                )
                              else
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade50,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'UNPAID',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.red.shade700,
                                    ),
                                  ),
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
                          final isPaid = item['status'] == 'Paid';
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
                                      const SizedBox(height: 4),
                                      Text(
                                        isPaid
                                            ? 'Paid: ${_formatDate(item['payment_date'])}'
                                            : 'Amount: ₹${(item['amount'] ?? 0.0).toStringAsFixed(2)}',
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
                                  children: [
                                    if (isPaid)
                                      OutlinedButton(
                                        onPressed: () => _downloadReceipt(
                                          item['id'],
                                          true,
                                          item['description'],
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.indigo,
                                          side: const BorderSide(color: Colors.indigo),
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                        ),
                                        child: const Text('Receipt'),
                                      )
                                    else
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.shade50,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          'PENDING',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.amber.shade800,
                                          ),
                                        ),
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
        ),
      ),
    );
  }
}
