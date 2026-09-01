import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class TeacherAttendanceHistoryScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const TeacherAttendanceHistoryScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  }) : super(key: key);

  @override
  State<TeacherAttendanceHistoryScreen> createState() => _TeacherAttendanceHistoryScreenState();
}

class _TeacherAttendanceHistoryScreenState extends State<TeacherAttendanceHistoryScreen> {
  bool _isLoading = true;
  String _teacherName = '';
  String _empId = '';
  String _ayName = '';
  List<dynamic> _months = [];
  List<dynamic> _allRecords = [];
  int _selectedMonthIndex = 0;
  late PageController _pageController;

  final TextEditingController _manualQrController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _loadHistory();
  }

  @override
  void dispose() {
    _manualQrController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('auth_token') ?? widget.token;

      final url = Uri.parse('${widget.baseUrl}/api/teacher/attendance/my-history');
      final response = await http.get(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final bool isSuccess = (body['status'] == 'success' || body['success'] == true);
        if (isSuccess) {
          final data = body['data'] ?? {};
          final monthsList = (data['months'] as List?) ?? [];
          final recordsList = (data['records'] as List?) ?? [];

          final currentKey = "${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}";
          int matchIdx = monthsList.indexWhere((m) => (m is Map && m['key'] == currentKey));
          int newIndex = (matchIdx != -1) ? matchIdx : 0;

          if (mounted) {
            setState(() {
              _teacherName = data['teacher_name'] ?? 'Teacher';
              _empId = data['emp_id'] ?? '';
              _ayName = data['academic_year_name'] ?? '';
              _months = monthsList;
              _allRecords = recordsList;
              _selectedMonthIndex = newIndex;
              _isLoading = false;
            });

            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _pageController.hasClients) {
                try {
                  _pageController.jumpToPage(newIndex);
                } catch (_) {}
              }
            });
          }
        } else {
          if (mounted) {
            setState(() {
              _isLoading = false;
            });
          }
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  List<dynamic> _getRecordsForMonth(dynamic monthObj) {
    if (monthObj is Map && monthObj.containsKey('records') && monthObj['records'] != null) {
      final recs = monthObj['records'];
      if (recs is List && recs.isNotEmpty) {
        return recs;
      }
    }
    final monthKey = (monthObj is Map ? monthObj['key'] : null) ?? '';
    return _allRecords.where((r) {
      if (r is! Map) return false;
      final mKey = (r['month_key'] as String?) ?? '';
      final dStr = (r['date'] as String?) ?? '';
      return mKey == monthKey || (monthKey.isNotEmpty && dStr.startsWith(monthKey));
    }).toList();
  }

  Future<void> _processQrPayload(String rawPayload) async {
    if (rawPayload.trim().isEmpty) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 20),
            Expanded(child: Text("Verifying & recording attendance...")),
          ],
        ),
      ),
    );

    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('auth_token') ?? widget.token;

      final url = Uri.parse('${widget.baseUrl}/api/teacher/attendance/scan-qr');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: json.encode({'qr_payload': rawPayload}),
      );

      if (mounted) Navigator.pop(context); // Close loading dialog

      final body = json.decode(response.body);
      final bool isSuccess = response.statusCode == 200 && (body['status'] == 'success' || body['success'] == true);

      if (isSuccess) {
        final data = body['data'] ?? {};
        final bool alreadyMarked = data['already_marked'] == true;
        final String teacherName = data['teacher_name'] ?? _teacherName;
        final String empId = data['emp_id'] ?? _empId;
        final String reachTime = data['reach_time'] ?? '—';
        final String status = data['status'] ?? 'Present';
        final bool isLate = data['is_late'] == true;
        final String? lateText = data['late_text'];
        final bool isEarly = data['is_early'] == true;
        final String? earlyText = data['early_text'];
        final String message = data['message'] ?? body['message'] ?? 'Attendance recorded successfully.';

        if (mounted) {
          _showResultDialog(
            isAlreadyMarked: alreadyMarked,
            teacherName: teacherName,
            empId: empId,
            reachTime: reachTime,
            status: status,
            isLate: isLate,
            lateText: lateText,
            isEarly: isEarly,
            earlyText: earlyText,
            message: message,
          );
        }
      } else {
        final errorMsg = body['message'] ?? 'Invalid or unverified QR Code.';
        if (mounted) {
          _showErrorDialog(errorMsg);
        }
      }
    } catch (e) {
      if (mounted) Navigator.pop(context);
      if (mounted) {
        _showErrorDialog("Network error: ${e.toString()}");
      }
    }
  }

  void _openRealtimeCameraScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TeacherQrScannerModalWidget(
        onScanned: (rawValue) {
          _processQrPayload(rawValue);
        },
      ),
    );
  }

  void _showResultDialog({
    required bool isAlreadyMarked,
    required String teacherName,
    required String empId,
    required String reachTime,
    required String status,
    required bool isLate,
    String? lateText,
    required bool isEarly,
    String? earlyText,
    required String message,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.all(24),
        content: SizedBox(
          width: MediaQuery.of(context).size.width * 0.82,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isAlreadyMarked ? Colors.amber.shade50 : Colors.green.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isAlreadyMarked ? Icons.info_outline : Icons.check_circle_rounded,
                color: isAlreadyMarked ? Colors.amber.shade800 : Colors.green.shade600,
                size: 48,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isAlreadyMarked ? "Already Scanned Today" : "Attendance Marked!",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isAlreadyMarked ? Colors.amber.shade900 : Colors.green.shade900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
            ),
            const Divider(height: 24),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  _buildDetailRow("Teacher Name", teacherName),
                  const SizedBox(height: 8),
                  _buildDetailRow("EMP ID", empId),
                  const SizedBox(height: 8),
                  _buildDetailRow("Entry Time", reachTime),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Status", style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.green.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (isLate || (lateText != null && lateText.isNotEmpty)) ...[
                    const SizedBox(height: 8),
                    _buildDetailRow("Late", lateText ?? "Late", valueColor: Colors.red.shade700),
                  ] else if (isEarly || (earlyText != null && earlyText.isNotEmpty)) ...[
                    const SizedBox(height: 8),
                    _buildDetailRow("Early", earlyText ?? "Early", valueColor: Colors.green.shade700),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isAlreadyMarked ? Colors.amber.shade800 : Colors.green.shade600,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.pop(context);
                  _loadHistory();
                },
                child: const Text(
                  "OK",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

  void _openCardDetailModal(Map<String, dynamic> r) {
    final String status = r['status'] ?? 'Pending';
    final String statusType = r['status_type'] ?? 'normal';
    final String? genericMessage = r['generic_message'];
    final bool isLate = r['is_late'] == true;
    final String? lateText = r['late_text'];
    final bool isEarly = r['is_early'] == true;
    final String? earlyText = r['early_text'];
    final String dateFormatted = r['date_formatted'] ?? r['date'];
    final String dayName = r['day_name'] ?? '';
    final String entryTime = r['entry_time'] ?? '—';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      dateFormatted,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      dayName,
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(height: 24),

            if (statusType == 'sunday' || statusType == 'holiday') ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.purple.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.purple.shade100),
                ),
                child: Column(
                  children: [
                    Icon(
                      statusType == 'sunday' ? Icons.wb_sunny_rounded : Icons.event_available_rounded,
                      color: Colors.purple.shade700,
                      size: 40,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      statusType == 'sunday' ? "Sunday - School Closed" : (genericMessage ?? "School Holiday"),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.purple.shade900),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "Attendance is not recorded on Sundays or declared School Holidays.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.purple.shade700),
                    ),
                  ],
                ),
              ),
            ] else if (statusType == 'pending' && status == 'Pending') ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  children: [
                    Icon(Icons.pending_actions_rounded, color: Colors.grey.shade700, size: 40),
                    const SizedBox(height: 10),
                    const Text(
                      "Attendance Pending",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "Attendance for this day has not been recorded.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.indigo.shade100),
                ),
                child: Column(
                  children: [
                    _buildDetailRow("Teacher Name", _teacherName),
                    const SizedBox(height: 8),
                    _buildDetailRow("EMP ID", _empId),
                    const SizedBox(height: 8),
                    _buildDetailRow("Reach Time", entryTime),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("Status", style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: status == 'Present'
                                ? Colors.green.shade100
                                : (status == 'Absent' ? Colors.red.shade100 : Colors.orange.shade100),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: status == 'Present'
                                  ? Colors.green.shade800
                                  : (status == 'Absent' ? Colors.red.shade800 : Colors.orange.shade800),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (isLate || (lateText != null && lateText.isNotEmpty)) ...[
                      const SizedBox(height: 8),
                      _buildDetailRow("Late", lateText ?? "Late", valueColor: Colors.red.shade700),
                    ] else if (isEarly || (earlyText != null && earlyText.isNotEmpty)) ...[
                      const SizedBox(height: 8),
                      _buildDetailRow("Early", earlyText ?? "Early", valueColor: Colors.green.shade700),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              height: 44,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo.shade800,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text("OK", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showErrorDialog(String errorMsg) {
    final bool isExpired = errorMsg.toLowerCase().contains("expired");
    final bool isDiffSchool = errorMsg.toLowerCase().contains("different school");

    String titleText = "Attendance Error";
    String contentText = errorMsg;

    if (isExpired) {
      titleText = "QR Code Expired";
      contentText = "This QR code has expired. Please scan the newly updated QR Code at school entrance.";
    } else if (isDiffSchool) {
      titleText = "Invalid School QR Code";
      contentText = "This QR Code belongs to a different school. You can only mark attendance at your assigned school.";
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.error_outline, color: (isExpired || isDiffSchool) ? Colors.orange.shade800 : Colors.red),
            const SizedBox(width: 10),
            Text(titleText),
          ],
        ),
        content: Text(contentText),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("OK"),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: valueColor ?? Colors.black87,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentMonthName = _months.isNotEmpty && _selectedMonthIndex < _months.length
        ? _months[_selectedMonthIndex]['month_name']
        : 'Month';

    return Scaffold(
      appBar: AppBar(
        title: const Text("Teacher Attendance"),
        backgroundColor: Colors.indigo.shade800,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.camera_alt_rounded, size: 34),
            tooltip: "Open Camera QR Scanner",
            onPressed: _openRealtimeCameraScanner,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadHistory,
              child: Column(
                children: [
                  // Month Navigation & Title Header
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    color: Colors.indigo.shade50,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_left_rounded, size: 28),
                          onPressed: _selectedMonthIndex > 0
                              ? () {
                                  _pageController.previousPage(
                                    duration: const Duration(milliseconds: 300),
                                    curve: Curves.easeInOut,
                                  );
                                }
                              : null,
                        ),
                        Expanded(
                          child: Text(
                            "Attendance for $currentMonthName",
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Colors.indigo,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right_rounded, size: 28),
                          onPressed: _selectedMonthIndex < _months.length - 1
                              ? () {
                                  _pageController.nextPage(
                                    duration: const Duration(milliseconds: 300),
                                    curve: Curves.easeInOut,
                                  );
                                }
                              : null,
                        ),
                      ],
                    ),
                  ),

                  // Month Pages List
                  Expanded(
                    child: _months.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 120),
                              Center(
                                child: Text(
                                  "No attendance records found for this academic year.",
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ),
                            ],
                          )
                        : PageView.builder(
                            controller: _pageController,
                            itemCount: _months.length,
                            onPageChanged: (idx) {
                              setState(() {
                                _selectedMonthIndex = idx;
                              });
                            },
                            itemBuilder: (context, monthIdx) {
                              final m = _months[monthIdx];
                              final records = _getRecordsForMonth(m);

                              if (records.isEmpty) {
                                return ListView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  children: [
                                    const SizedBox(height: 100),
                                    Center(
                                      child: Text(
                                        "No attendance records for ${m['month_name']}.",
                                        style: const TextStyle(color: Colors.grey),
                                      ),
                                    ),
                                  ],
                                );
                              }

                              return ListView.separated(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                itemCount: records.length,
                                separatorBuilder: (context, index) => const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final r = records[index];
                                  final String status = r['status'] ?? 'Pending';
                                  final String statusType = r['status_type'] ?? 'normal';
                                  final String? genericMessage = r['generic_message'];
                                  final String dateFormatted = r['date_formatted'] ?? r['date'];
                                  final String dayName = r['day_name'] ?? '';

                                  Color statusColor = Colors.green;
                                  String badgeText = status;

                                  if (statusType == 'sunday') {
                                    statusColor = Colors.purple;
                                    badgeText = 'Sunday';
                                  } else if (statusType == 'holiday') {
                                    statusColor = Colors.purple;
                                    badgeText = r['holiday_name'] ?? 'Holiday';
                                  } else if (statusType == 'pending' || status == 'Pending') {
                                    statusColor = Colors.grey;
                                    badgeText = 'Pending';
                                  } else if (status == 'Absent') {
                                    statusColor = Colors.red;
                                  } else if (status == 'Leave') {
                                    statusColor = Colors.orange;
                                  }

                                  return GestureDetector(
                                    onTap: () => _openCardDetailModal(r),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(color: Colors.grey.shade200),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.03),
                                            blurRadius: 6,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        children: [
                                          // Date Badge
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                            decoration: BoxDecoration(
                                              color: statusType == 'sunday' || statusType == 'holiday'
                                                  ? Colors.purple.shade50
                                                  : Colors.indigo.shade50,
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: Column(
                                              children: [
                                                Text(
                                                  dateFormatted.split(' ')[0],
                                                  style: TextStyle(
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: statusType == 'sunday' || statusType == 'holiday'
                                                        ? Colors.purple.shade900
                                                        : Colors.indigo.shade900,
                                                  ),
                                                ),
                                                Text(
                                                  dateFormatted.split(' ').skip(1).join(' '),
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    color: statusType == 'sunday' || statusType == 'holiday'
                                                        ? Colors.purple.shade700
                                                        : Colors.indigo.shade700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 16),

                                          // Day Name
                                          Expanded(
                                            child: Text(
                                              dayName,
                                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                            ),
                                          ),

                                          // Status Badge
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: statusColor.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(8),
                                              border: Border.all(color: statusColor.withOpacity(0.3)),
                                            ),
                                            child: Text(
                                              badgeText,
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: statusColor,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _TeacherQrScannerModalWidget extends StatefulWidget {
  final Function(String) onScanned;

  const _TeacherQrScannerModalWidget({Key? key, required this.onScanned}) : super(key: key);

  @override
  State<_TeacherQrScannerModalWidget> createState() => _TeacherQrScannerModalWidgetState();
}

class _TeacherQrScannerModalWidgetState extends State<_TeacherQrScannerModalWidget> {
  late MobileScannerController _scannerController;
  bool _isScanned = false;
  bool _isTorchOn = false;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController(
      autoStart: false,
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _scannerController.start();
      }
    });
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_isScanned) return;
    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final String? rawValue = barcode.rawValue;
      if (rawValue != null && rawValue.trim().isNotEmpty) {
        _isScanned = true;
        Navigator.pop(context);
        widget.onScanned(rawValue);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.camera_alt_rounded, color: Colors.indigo, size: 24),
                  SizedBox(width: 10),
                  Text(
                    "Scan Attendance QR",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    icon: Icon(
                      _isTorchOn ? Icons.flash_on : Icons.flash_off,
                      color: _isTorchOn ? Colors.amber : Colors.grey,
                    ),
                    onPressed: () async {
                      try {
                        await _scannerController.toggleTorch();
                        if (mounted) {
                          setState(() {
                            _isTorchOn = !_isTorchOn;
                          });
                        }
                      } catch (_) {}
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 280,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  MobileScanner(
                    controller: _scannerController,
                    errorBuilder: (context, error, child) {
                      final String errCode = error.errorCode.name;
                      final String? errDetail = error.errorDetails?.message;
                      return Container(
                        color: Colors.black,
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.camera_alt_outlined, color: Colors.amber, size: 40),
                            const SizedBox(height: 10),
                            Text(
                              "Camera status ($errCode):\n${errDetail ?? 'Tap retry to restart camera stream'}",
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 14),
                            ElevatedButton.icon(
                              onPressed: () async {
                                try {
                                  await _scannerController.stop();
                                } catch (_) {}
                                if (mounted) {
                                  _scannerController.start();
                                }
                              },
                              icon: const Icon(Icons.refresh, size: 18),
                              label: const Text("Retry Camera"),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.indigo,
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    onDetect: _handleDetect,
                  ),
                  Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.indigo, width: 3),
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  Positioned(
                    bottom: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        "Point camera at School Attendance QR Code",
                        style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
