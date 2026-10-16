import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:school_hub/services/notification_helper.dart';

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
        final rawData = decoded['data'];
        
        Map<String, dynamic> currentYr = {};
        Map<String, dynamic> prevYr = {};

        if (rawData is Map) {
          if (rawData['current_year'] is Map) {
            currentYr = Map<String, dynamic>.from(rawData['current_year']);
          }
          if (rawData['previous_year'] is Map) {
            prevYr = Map<String, dynamic>.from(rawData['previous_year']);
          }
        }

        if (mounted) {
          setState(() {
            _currentYearData = currentYr;
            _previousYearData = prevYr;
            _hasUnpaidPrev = _previousYearData['has_unpaid'] == true;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _errorText = 'Failed to load salary details.';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      debugPrint('Salary fetch error: $e');
      if (mounted) {
        setState(() {
          _errorText = 'An error occurred while loading salary.';
          _isLoading = false;
        });
      }
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

        if (savedPath != null) {
          try {
            await NotificationHelper.showDownloadNotification(
              title: 'Salary Slip Downloaded',
              fileName: defaultFilename,
              bytes: response.bodyBytes,
            );
          } catch (_) {}
        }

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(savedPath != null ? 'Salary Slip saved successfully.' : 'Download failed.'),
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
      backgroundColor: const Color(0xFFFBF8F2),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Padding(
          padding: EdgeInsets.only(top: 4.0),
          child: Text(
            'Salary Card',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 16,
              color: Color(0xFF0F172A),
              letterSpacing: 0.5,
            ),
          ),
        ),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Color(0xFF1E293B), size: 20),
              tooltip: 'Refresh',
              onPressed: _fetchSalariesData,
            ),
          const SizedBox(width: 4),
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
    final List<dynamic> payments = yearData['payments'] ?? [];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 18.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Academic Year: $yearName',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 14),
              const Divider(color: Color(0xFFE2E8F0), thickness: 1.2, height: 1),
              Expanded(
                child: ListView.separated(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: payments.length,
                  separatorBuilder: (ctx, idx) => const Divider(color: Color(0xFFE2E8F0), thickness: 1, height: 1),
                  itemBuilder: (ctx, idx) {
                    final item = payments[idx];
                    final isPaid = item['status'] == 'Paid';
                    final disbursedDate = item['disbursed_date'];
                    final paymentId = item['id'] ?? 0;
                    final monthUpper = (item['month'] ?? '').toString().toUpperCase();

                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Left: Month name (CAPITALIZED) & optional disbursed date if paid
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  monthUpper,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                if (isPaid && disbursedDate != null && disbursedDate.toString().isNotEmpty) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    'Disbursed: ${_formatDate(disbursedDate)}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF64748B),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),

                          // Right: Status badge & optional Slip download button
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: isPaid ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: isPaid ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A),
                                  ),
                                ),
                                child: Text(
                                  isPaid ? 'PAID' : 'PENDING',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: isPaid ? const Color(0xFF047857) : const Color(0xFFB45309),
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                              if (isPaid) ...[
                                const SizedBox(width: 8),
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: paymentId > 0
                                      ? () => _downloadSalarySlip(paymentId, item['month'])
                                      : null,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFCBD5E1)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.download_rounded, size: 14, color: Color(0xFF0F766E)),
                                        SizedBox(width: 4),
                                        Text(
                                          'Slip',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF0F766E),
                                          ),
                                        ),
                                      ],
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
