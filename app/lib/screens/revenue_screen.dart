import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:school_hub/services/financial_report_service.dart';
import 'package:school_hub/services/notification_helper.dart';

class RevenueScreen extends StatefulWidget {
  final FinancialReportService reportService;
  final String userRole;
  final bool isFeeCollector;

  const RevenueScreen({
    super.key,
    required this.reportService,
    required this.userRole,
    this.isFeeCollector = false,
  });

  @override
  State<RevenueScreen> createState() => _RevenueScreenState();
}

class _RevenueScreenState extends State<RevenueScreen> {
  bool _isLoading = true;
  String _error = '';
  String _success = '';

  // Inspection date filters
  DateTime _fromDate = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime _toDate = DateTime.now();
  String _fromTimeStr = '12:00 AM';

  // Preview state
  Map<String, dynamic>? _previewData;
  bool _previewLoading = false;
  String _previewError = '';

  // History reports
  List<dynamic> _reports = [];

  // Action states
  bool _generatingReport = false;
  int? _handingOverId;
  int? _deletingReportId;
  bool _isExporting = false;
  Timer? _successTimer;

  void _showSuccess(String message) {
    _successTimer?.cancel();
    if (mounted) {
      setState(() {
        _success = message;
      });
    }
    _successTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _success = '';
        });
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _successTimer?.cancel();
    super.dispose();
  }

  String _formatCurrency(num val) {
    final isNegative = val < 0;
    final s = val.abs().round().toString();
    if (s.length <= 3) {
      return (isNegative ? '-₹' : '₹') + s;
    }
    final last3 = s.substring(s.length - 3);
    final remaining = s.substring(0, s.length - 3);
    final buffer = StringBuffer();
    for (int i = 0; i < remaining.length; i++) {
      if (i > 0 && (remaining.length - i) % 2 == 0) {
        buffer.write(',');
      }
      buffer.write(remaining[i]);
    }
    final prefix = isNegative ? '-₹' : '₹';
    return '$prefix${buffer.toString()},$last3';
  }

  String _formatDateFull(String dateStr) {
    if (dateStr.isEmpty) return '—';
    try {
      final parts = dateStr.split('-');
      if (parts.length == 3) {
        final year = int.parse(parts[0]);
        final month = int.parse(parts[1]);
        final day = int.parse(parts[2]);
        final months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return '$day ${months[month - 1]} $year';
      }
      final dt = DateTime.parse(dateStr);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatServerTimestamp(String dateStr) {
    if (dateStr.isEmpty) return '—';
    try {
      final dt = DateTime.parse(dateStr).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final monthName = months[dt.month - 1];
      final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final min = dt.minute.toString().padLeft(2, '0');
      return '${dt.day} $monthName ${dt.year} at $hour:$min $ampm';
    } catch (_) {
      return dateStr;
    }
  }

  String _toIsoDate(DateTime dt) {
    return '${dt.year.toString().padLeft(4, '0')}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final res = await widget.reportService.getFinancialReports();
      final reports = res['reports'] as List<dynamic>;
      final suggestedStart = res['next_suggested_start_date']?.toString() ?? '';
      final fromTime = res['from_time']?.toString() ?? '12:00 AM';
      final ayStart = res['academic_year_start_date']?.toString() ?? '';

      DateTime effectiveFrom;
      if (suggestedStart.isNotEmpty) {
        effectiveFrom = DateTime.tryParse(suggestedStart) ??
            (ayStart.isNotEmpty ? DateTime.tryParse(ayStart) ?? DateTime(DateTime.now().year, 4, 1) : DateTime(DateTime.now().year, 4, 1));
      } else if (ayStart.isNotEmpty) {
        effectiveFrom = DateTime.tryParse(ayStart) ?? DateTime(DateTime.now().year, 4, 1);
      } else {
        effectiveFrom = DateTime(DateTime.now().year, 4, 1);
        if (effectiveFrom.isAfter(DateTime.now())) {
          effectiveFrom = DateTime(DateTime.now().year - 1, 4, 1);
        }
      }

      if (mounted) {
        setState(() {
          _reports = reports;
          _fromTimeStr = fromTime;
          _fromDate = effectiveFrom;
          _toDate = DateTime.now();
          _isLoading = false;
        });

        _fetchPreview(
          fromDateStr: _toIsoDate(effectiveFrom),
          toDateStr: _toIsoDate(DateTime.now()),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Future<void> _fetchPreview({String? fromDateStr, String? toDateStr}) async {
    final start = fromDateStr ?? _toIsoDate(_fromDate);
    final end = toDateStr ?? _toIsoDate(_toDate);

    if (_toDate.isBefore(_fromDate)) {
      setState(() {
        _previewError = 'To Date cannot be earlier than From Date.';
      });
      return;
    }

    setState(() {
      _previewLoading = true;
      _previewError = '';
    });

    try {
      final data = await widget.reportService.getFinancialPreview(
        fromDate: start,
        toDate: end,
      );
      if (mounted) {
        setState(() {
          _previewData = data;
          _previewLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _previewLoading = false;
          _previewError = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }


  void _onStartGenerate() {
    // Exact web rule:
    // if (reports.length > 0 && reports[0].status !== 'Settled') -> show Blocked dialog!
    if (_reports.isNotEmpty) {
      final latest = _reports[0];
      final latestStatus = (latest['status'] ?? '').toString();
      if (latestStatus != 'Settled') {
        _showBlockedDialog(latest);
        return;
      }
    }

    _showGenerateConfirmDialog();
  }

  void _showBlockedDialog(dynamic blockedReport) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.error_outline_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Settlement Required',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Cannot Generate New Report',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: Color(0xFF92400E)),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'You cannot generate a new financial report because the last generated report (${blockedReport['report_id']}) is currently in ${blockedReport['status']} status.',
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF78350F), height: 1.4),
                    ),
                    const SizedBox(height: 8),
                    const Divider(color: Color(0xFFFDE68A), height: 1),
                    const SizedBox(height: 8),
                    const Text(
                      'Please make sure the previous report is settled or deleted before generating a new financial report.',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF92400E)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text(
                    'Understand & Close',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showGenerateConfirmDialog() {
    final fromStr = _formatDateFull(_toIsoDate(_fromDate));
    final toStr = _formatDateFull(_toIsoDate(_toDate));

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.error_outline_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Generate Financial Report?',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Are you sure you want to generate a financial report for the period $fromStr ($_fromTimeStr) to $toStr (Till now)?',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: const Text(
                  'This will freeze transactions for this period into your history with status Hand Over.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF92400E),
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _handleGenerateReport();
                        },
                        child: const Text(
                          'Generate Report',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleGenerateReport() async {
    setState(() {
      _generatingReport = true;
      _error = '';
      _success = '';
    });

    try {
      await widget.reportService.createFinancialReport(
        fromDate: _toIsoDate(_fromDate),
        toDate: _toIsoDate(_toDate),
      );
      if (mounted) {
        _showSuccess('Financial report generated successfully.');
        await _loadInitialData();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _generatingReport = false;
        });
      }
    }
  }

  void _showHandOverConfirmDialog(dynamic report) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.error_outline_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Hand Over Financial Report?',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Are you sure you want to hand over report ${report['report_id']} to the School Admin / Owner?',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'An email containing the financial statement summary and Excel file attachment will be sent to the School Admin email address.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF92400E), height: 1.35),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'The status will update to Pending until approved or rejected via email.',
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF78350F), fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _handleConfirmHandOver(report);
                        },
                        child: const Text(
                          'Hand Over',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleConfirmHandOver(dynamic report) async {
    final int reportId = int.parse(report['id'].toString());
    setState(() {
      _handingOverId = reportId;
      _error = '';
      _success = '';
    });

    try {
      await widget.reportService.submitSettlementRequest(reportId);
      if (mounted) {
        _showSuccess('Hand over request submitted successfully. Email notification sent to School Admin.');
        if (_reports.isNotEmpty) {
          for (var r in _reports) {
            if (r is Map && r['id'] != null && r['id'].toString() == reportId.toString()) {
              r['status'] = 'Pending';
            }
          }
        }
        setState(() {
          _handingOverId = null;
        });
        _loadInitialData();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _handingOverId = null;
        });
      }
    }
  }

  void _showDeleteConfirmDialog(dynamic report) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.delete_outline_rounded,
                      color: Color(0xFFDC2626),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Text(
                        'Delete Unsettled Report?',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Are you sure you want to delete report ${report['report_id']}?',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Transaction Safety Guaranteed:',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'All fee payments, salary disbursements, and expenses from this period will remain safe in the database and will automatically be included in your next generated report.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF7F1D1D), height: 1.35),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _handleDeleteReport(report);
                        },
                        child: const Text(
                          'Delete Report',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleDeleteReport(dynamic report) async {
    final int reportId = int.parse(report['id'].toString());
    setState(() {
      _deletingReportId = reportId;
      _error = '';
      _success = '';
    });

    try {
      await widget.reportService.deleteFinancialReport(reportId);
      if (mounted) {
        _showSuccess('Financial report ${report['report_id']} deleted successfully.');
        await _loadInitialData();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _deletingReportId = null;
        });
      }
    }
  }

  Future<void> _handleExportReport(dynamic report) async {
    final int reportId = int.parse(report['id'].toString());
    setState(() => _isExporting = true);

    try {
      final bytes = await widget.reportService.exportFinancialReportBytes(reportId);
      final filename = 'Financial_Report_${report['report_id']}.xlsx';

      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          final savedPathOrUri = await platform.invokeMethod<String>('saveFileToDownloads', {
            'fileName': filename,
            'bytes': bytes,
          });

          await NotificationHelper.showDownloadNotification(
            title: 'Financial Report Downloaded',
            fileName: filename,
            bytes: bytes,
          );

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('$filename saved to Downloads!'),
                backgroundColor: const Color(0xFF059669),
                behavior: SnackBarBehavior.floating,
                action: SnackBarAction(
                  label: 'OPEN',
                  textColor: Colors.white,
                  onPressed: () async {
                    try {
                      await platform.invokeMethod('openFile', {
                        'fileName': filename,
                        'fileUri': savedPathOrUri,
                      });
                    } catch (e) {
                      debugPrint('Error opening exported file: $e');
                    }
                  },
                ),
              ),
            );
          }
          return;
        } catch (e) {
          debugPrint('saveFileToDownloads error: $e');
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Report exported (${bytes.lengthInBytes} bytes)'),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Export failed: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFDFBF7),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'FINANCIAL REPORT',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
            letterSpacing: -0.5,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFD97706)),
            )
          : RefreshIndicator(
              color: const Color(0xFFD97706),
              onRefresh: _loadInitialData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [


                    // Error & Success alerts
                    if (_error.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error,
                                style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (_success.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _success,
                                style: const TextStyle(fontSize: 12, color: Color(0xFF166534), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Card 1: Ongoing Month Inspection
                    _buildOngoingMonthCard(),

                    const SizedBox(height: 16),

                    // Card 2: Financial Statement Preview
                    _buildPreviewCard(),

                    const SizedBox(height: 24),

                    // Card 3: Financial Statements History
                    _buildHistorySection(),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildOngoingMonthCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1EAD9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ONGOING MONTH INSPECTION',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Color(0xFF334155),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Text(
              'View live transactions from the last financial report up to now. Click "Generate Financial Report" below to freeze these transactions into an official statement with status Hand Over, ready for owner settlement.',
              style: TextStyle(
                fontSize: 11.5,
                color: Color(0xFF64748B),
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Date Display Row (Read-only, without calendar icons)
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'FROM DATE',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDFBF7),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          '${_toIsoDate(_fromDate)} ($_fromTimeStr)',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'TO DATE',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDFBF7),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          '${_toIsoDate(_toDate)} (Till now)',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (_previewError.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              _previewError,
              style: const TextStyle(fontSize: 11, color: Colors.red, fontWeight: FontWeight.w600),
            ),
          ],

          const SizedBox(height: 16),

          // Preview Report Button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _previewLoading ? null : () => _fetchPreview(),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF334155),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _previewLoading
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF64748B)),
                        ),
                        SizedBox(width: 8),
                        Text('CALCULATING...', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    )
                  : const Text(
                      'PREVIEW REPORT',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 0.5),
                    ),
            ),
          ),

          const SizedBox(height: 10),

          // Generate Financial Report Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_previewLoading || _generatingReport) ? null : _onStartGenerate,
              icon: _generatingReport
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.auto_awesome_rounded, size: 16, color: Colors.white),
              label: Text(
                _generatingReport ? 'GENERATING...' : 'GENERATE FINANCIAL REPORT',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewCard() {
    final fromStr = _formatDateFull(_toIsoDate(_fromDate));
    final toStr = _formatDateFull(_toIsoDate(_toDate));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1EAD9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'FINANCIAL STATEMENT PREVIEW',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Color(0xFF334155),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'REPORT PERIOD',
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
              ),
              Text(
                '$fromStr ➔ $toStr (Till now)',
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (_previewLoading)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36),
              alignment: Alignment.center,
              child: Column(
                children: const [
                  CircularProgressIndicator(color: Color(0xFFD97706), strokeWidth: 2.5),
                  SizedBox(height: 10),
                  Text(
                    'Computing transactions ledgers...',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            )
          else if (_previewData != null) ...[
            // 2 Stat boxes (Total Fees Collected, Total Expenses & Salaries)
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFD97706), Color(0xFFB45309)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD97706).withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TOTAL FEES COLLECTED',
                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 0.3),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _formatCurrency(_previewData!['fees_collected'] ?? 0),
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFD97706), Color(0xFFB45309)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD97706).withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TOTAL EXPENSES & SALARIES',
                          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 0.3),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _formatCurrency(_previewData!['salary_paid'] ?? 0),
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Net Financial Outcome Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFD97706), Color(0xFFB45309)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD97706).withOpacity(0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'NET FINANCIAL OUTCOME',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        ((_previewData!['profit_loss'] ?? 0) as num) >= 0
                            ? 'Profit: ${_formatCurrency(_previewData!['profit_loss'] ?? 0)}'
                            : 'Loss: ${_formatCurrency(((_previewData!['profit_loss'] ?? 0) as num).abs())}',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      '₹',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ] else
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('No preview loaded. Click PREVIEW REPORT above.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHistorySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'FINANCIAL STATEMENTS HISTORY',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: Color(0xFF334155),
                letterSpacing: 0.8,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Text(
                '${_reports.length} REPORTS',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (_reports.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1EAD9)),
            ),
            alignment: Alignment.center,
            child: const Text(
              'No financial statement history recorded. Create your first report above.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _reports.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (ctx, idx) {
              final r = _reports[idx];
              return _buildReportHistoryCard(r);
            },
          ),
      ],
    );
  }

  Widget _buildReportHistoryCard(dynamic r) {
    final int reportId = int.parse(r['id'].toString());
    final status = (r['status'] ?? '').toString();
    final bool isProfit = ((r['profit_loss'] ?? 0) as num) >= 0;
    final isHandingOver = _handingOverId == reportId;
    final isDeleting = _deletingReportId == reportId;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1EAD9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row (Report ID, Status Badge / Action Button, Export, Delete)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Report ID & Status
              Row(
                children: [
                  Text(
                    r['report_id'] ?? '',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Status Action Badge
                  if (isHandingOver)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        children: const [
                          SizedBox(
                            width: 10,
                            height: 10,
                            child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFFB45309)),
                          ),
                          SizedBox(width: 4),
                          Text('Handing Over...', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                        ],
                      ),
                    )
                  else if (status == 'Hand Over')
                    InkWell(
                      onTap: () => _showHandOverConfirmDialog(r),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFF59E0B)),
                        ),
                        child: const Text(
                          'HAND OVER',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFB45309)),
                        ),
                      ),
                    )
                  else if (status == 'Pending' || status == 'Request Sent')
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Text(
                        'PENDING',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                      ),
                    )
                  else if (status == 'Settled' || status == 'Handed Over')
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Text(
                        'SETTLED',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF166534)),
                      ),
                    )
                  else if (status == 'Rejected')
                    InkWell(
                      onTap: () => _showHandOverConfirmDialog(r),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: const Text(
                          'REJECTED',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                        ),
                      ),
                    ),
                ],
              ),

              // Export & Delete Actions
              Row(
                children: [
                  InkWell(
                    onTap: _isExporting ? null : () => _handleExportReport(r),
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.all(4.0),
                      child: Row(
                        children: const [
                          Icon(Icons.download_rounded, size: 14, color: Color(0xFF059669)),
                          SizedBox(width: 3),
                          Text(
                            'EXPORT',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (status != 'Settled') ...[
                    const SizedBox(width: 4),
                    isDeleting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red),
                          )
                        : IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFF94A3B8)),
                            onPressed: () => _showDeleteConfirmDialog(r),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            tooltip: 'Delete Unsettled Report',
                          ),
                  ],
                ],
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Period Dates
          Text(
            'Report Period',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey.shade500, letterSpacing: 0.3),
          ),
          const SizedBox(height: 2),
          Text(
            '${_formatDateFull(r['from_date'] ?? '')} ➔ ${_formatDateFull(r['to_date'] ?? '')}',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
          ),

          const SizedBox(height: 10),
          const Divider(color: Color(0xFFF1EAD9), height: 1),
          const SizedBox(height: 10),

          // Revenue & Expenses
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TOTAL REVENUE',
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatCurrency(r['fees_collected'] ?? 0),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SALARIES & EXPENSES',
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatCurrency(r['salary_paid'] ?? 0),
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFFDC2626)),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Outcome box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isProfit ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: isProfit ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Outcome',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.grey.shade600),
                ),
                Text(
                  isProfit
                      ? 'Profit: ${_formatCurrency(r['profit_loss'] ?? 0)}'
                      : 'Loss: ${_formatCurrency(((r['profit_loss'] ?? 0) as num).abs())}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: isProfit ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),
          const Divider(color: Color(0xFFF1EAD9), height: 1),
          const SizedBox(height: 8),

          // Generated timestamp
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Generated',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey.shade500),
              ),
              Text(
                _formatServerTimestamp(r['created_at'] ?? ''),
                style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
