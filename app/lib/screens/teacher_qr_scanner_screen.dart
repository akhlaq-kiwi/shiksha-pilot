import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class TeacherQrScannerScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const TeacherQrScannerScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  }) : super(key: key);

  @override
  State<TeacherQrScannerScreen> createState() => _TeacherQrScannerScreenState();
}

class _TeacherQrScannerScreenState extends State<TeacherQrScannerScreen> {
  final TextEditingController _manualQrController = TextEditingController();
  bool _isProcessing = false;

  Future<void> _processQrPayload(String rawPayload) async {
    if (rawPayload.trim().isEmpty) return;

    setState(() {
      _isProcessing = true;
    });

    // Show Loading Dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 20),
            Expanded(child: Text("Verifying teacher attendance...")),
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

      // Dismiss Loading Dialog
      if (mounted) Navigator.pop(context);

      final body = json.decode(response.body);

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] ?? {};
        final bool alreadyMarked = data['already_marked'] == true;
        final String teacherName = data['teacher_name'] ?? 'Teacher';
        final String empId = data['emp_id'] ?? 'EMP-001';
        final String reachTime = data['reach_time'] ?? '—';
        final String status = data['status'] ?? 'Present';
        final bool isLate = data['is_late'] == true;
        final String message = data['message'] ?? 'Attendance recorded.';

        if (mounted) {
          _showResultDialog(
            isSuccess: !alreadyMarked,
            isAlreadyMarked: alreadyMarked,
            teacherName: teacherName,
            empId: empId,
            reachTime: reachTime,
            status: status,
            isLate: isLate,
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
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  void _showResultDialog({
    required bool isSuccess,
    required bool isAlreadyMarked,
    required String teacherName,
    required String empId,
    required String reachTime,
    required String status,
    required bool isLate,
    required String message,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isAlreadyMarked
                    ? Colors.amber.shade50
                    : Colors.green.shade50,
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
                  _buildDetailRow("Reach Time", reachTime),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Status", style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
                          if (isLate) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.red.shade100,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                "Late",
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red.shade800,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
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
                  Navigator.pop(context); // Close Dialog
                  Navigator.pop(context); // Return to Dashboard
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
    );
  }

  void _showErrorDialog(String errorMsg) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: Colors.red),
            SizedBox(width: 10),
            Text("Attendance Error"),
          ],
        ),
        content: Text(errorMsg),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("OK"),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Mark Teacher Attendance"),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Info Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.indigo.shade600, Colors.indigo.shade800],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.indigo.withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Column(
                children: [
                  Icon(Icons.qr_code_scanner, size: 56, color: Colors.white),
                  SizedBox(height: 12),
                  Text(
                    "Teacher Attendance QR Scanner",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    "Scan the official School QR Code to record your daily attendance and reach time.",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Camera / Scan Trigger Area
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  Icon(Icons.camera_alt_outlined, size: 64, color: Colors.indigo.shade400),
                  const SizedBox(height: 16),
                  const Text(
                    "Ready to Scan",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "Point camera at School Admin Attendance QR Code",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 24),

                  // Manual Payload Input for Dev / Testing
                  TextField(
                    controller: _manualQrController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: "Enter / Paste QR Code payload text...",
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                  const SizedBox(height: 16),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.indigo,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _isProcessing
                          ? null
                          : () => _processQrPayload(_manualQrController.text),
                      icon: const Icon(Icons.qr_code, color: Colors.white),
                      label: const Text(
                        "Submit QR Payload",
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
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
