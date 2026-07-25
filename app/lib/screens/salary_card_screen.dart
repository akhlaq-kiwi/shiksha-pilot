import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:school_hub/services/http_service.dart' as http;

class SalaryCardScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const SalaryCardScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  }) : super(key: key);

  @override
  State<SalaryCardScreen> createState() => _SalaryCardScreenState();
}

class _SalaryCardScreenState extends State<SalaryCardScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isLoading = true;
  String _errorText = '';

  Map<String, dynamic> _currentYearData = {};
  Map<String, dynamic> _previousYearData = {};
  bool _hasUnpaidPrev = false;

  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _fetchSalariesData();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _fetchSalariesData() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/teacher/salaries');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? {};
        setState(() {
          _currentYearData = data['current_year'] ?? {};
          _previousYearData = data['previous_year'] ?? {};
          _hasUnpaidPrev = _previousYearData['has_unpaid'] == true;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorText = 'Failed to load salary details.';
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

  Future<void> _downloadSalarySlip(int paymentId, String month) async {
    setState(() {
      _isDownloading = true;
    });
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/teacher/salaries/receipt?id=$paymentId');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        final defaultFilename = 'Salary_Slip_${month}.pdf';
        
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

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(savedPath != null ? 'Salary slip saved successfully.' : 'Download failed.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: savedPath != null ? Colors.green : Colors.red,
          ),
        );
      } else {
        throw Exception('Server error: ${response.statusCode}');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to download salary slip: ${e.toString()}'),
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
    // Only show 2 pages if there is unpaid salary in previous year
    final totalPages = _hasUnpaidPrev ? 2 : 1;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Salary Ledger',
          style: TextStyle(fontWeight: FontWeight.w900, color: Colors.black87),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _fetchSalariesData,
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
                        onPressed: _fetchSalariesData,
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
                        // Page view indicator (only if 2 pages)
                        if (totalPages > 1) ...[
                          const SizedBox(height: 16),
                          _buildPageIndicator(totalPages),
                        ],
                        const SizedBox(height: 12),
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
                              _buildYearSalaryCard(_currentYearData, 'Current Academic Year'),
                              if (_hasUnpaidPrev)
                                _buildYearSalaryCard(_previousYearData, 'Previous Academic Year'),
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
                                    'Downloading salary slip...',
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

  Widget _buildPageIndicator(int totalPages) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalPages, (idx) {
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

  Widget _buildYearSalaryCard(Map<String, dynamic> yearData, String yearLabel) {
    final yearName = yearData['academic_year_name'] ?? '—';
    final baseSalary = (yearData['salary'] ?? 0.0).toDouble();
    final List<dynamic> payments = yearData['payments'] ?? [];

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        yearLabel,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo.shade800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Academic Year: $yearName',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '₹${baseSalary.toStringAsFixed(2)} / mo',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.indigo.shade900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  itemCount: payments.length,
                  separatorBuilder: (ctx, idx) => Divider(color: Colors.grey.shade100, height: 1),
                  itemBuilder: (ctx, idx) {
                    final item = payments[idx];
                    final isPaid = item['status'] == 'Paid';
                    final disbursedDate = item['disbursed_date'];
                    final paymentId = item['id'] ?? 0;

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
                                    ? 'Disbursed: ${_formatDate(disbursedDate)}'
                                    : 'Waiting for disbursement',
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
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isPaid ? Colors.green.shade50 : Colors.amber.shade50,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isPaid ? 'PAID' : 'PENDING',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isPaid ? Colors.green.shade700 : Colors.amber.shade800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              isPaid
                                  ? OutlinedButton(
                                      onPressed: paymentId > 0
                                          ? () => _downloadSalarySlip(paymentId, item['month'])
                                          : null,
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: Colors.indigo,
                                        side: const BorderSide(color: Colors.indigo),
                                        padding: const EdgeInsets.symmetric(horizontal: 12),
                                      ),
                                      child: const Text('Slip'),
                                    )
                                  : OutlinedButton(
                                      onPressed: null,
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: Colors.grey.shade400,
                                        side: BorderSide(color: Colors.grey.shade300),
                                        padding: const EdgeInsets.symmetric(horizontal: 12),
                                      ),
                                      child: const Text('Waiting'),
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
