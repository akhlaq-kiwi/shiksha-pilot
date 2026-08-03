import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/leave_service.dart';
import '../main.dart';

class ApplyLeaveScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole; // 'TEACHER' or 'PARENT'
  final int? selectedStudentId; // only relevant for parent role

  const ApplyLeaveScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
  }) : super(key: key);

  @override
  _ApplyLeaveScreenState createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  final _formKey = GlobalKey<FormState>();
  
  String _leaveType = 'Sick Leave';
  DateTime? _fromDate;
  DateTime? _toDate;
  final TextEditingController _reasonController = TextEditingController();
  File? _attachment;
  String? _uploadedAttachmentPath;
  bool _isUploadingAttachment = false;

  Future<void> _pickAttachment() async {
    if (_isUploadingAttachment) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    );

    if (result != null && result.files.single.path != null) {
      final selectedFile = File(result.files.single.path!);
      final fileName = path.basename(selectedFile.path);

      setState(() {
        _attachment = selectedFile;
        _isUploadingAttachment = true;
        _uploadedAttachmentPath = null;
      });

      try {
        final uploadedPath = await widget.leaveService.uploadAttachment(selectedFile);
        if (mounted) {
          setState(() {
            _uploadedAttachmentPath = uploadedPath;
            _isUploadingAttachment = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Attachment '$fileName' uploaded successfully! ✓",
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _attachment = null;
            _uploadedAttachmentPath = null;
            _isUploadingAttachment = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Failed to upload attachment: ${e.toString()}"),
              backgroundColor: Colors.red,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;
    
    if (_fromDate == null || _toDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select both start and end dates.')),
      );
      return;
    }

    if (_toDate!.isBefore(_fromDate!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End date cannot be earlier than start date.')),
      );
      return;
    }

    if (_charCount > 300) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 300 characters allowed.')),
      );
      return;
    }

    if (_isUploadingAttachment) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please wait while attachment is uploading...')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final fromDateStr = "${_fromDate!.year}-${_fromDate!.month.toString().padLeft(2, '0')}-${_fromDate!.day.toString().padLeft(2, '0')}";
      final toDateStr = "${_toDate!.year}-${_toDate!.month.toString().padLeft(2, '0')}-${_toDate!.day.toString().padLeft(2, '0')}";

      await widget.leaveService.applyLeaveRequest(
        leaveType: _leaveType,
        fromDate: fromDateStr,
        toDate: toDateStr,
        reason: _reasonController.text,
        studentId: widget.selectedStudentId,
        attachment: _attachment,
        attachmentPath: _uploadedAttachmentPath,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Leave request submitted successfully.')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      final errorMsg = e.toString();
      if (errorMsg.contains('Unauthorized') || errorMsg.contains('login')) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.clear();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Session expired. Please login again.')),
          );
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (context) => const LoginScreen()),
            (route) => false,
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMsg)),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apply for Leave'),
      ),
      body: _isSubmitting
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Submitting leave application...'),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Leave Type',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _leaveType,
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      items: _leaveTypes.map((type) {
                        return DropdownMenuItem(
                          value: type,
                          child: Text(type),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _leaveType = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Start Date',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              InkWell(
                                onTap: () => _selectDate(context, true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey[450] ?? Colors.grey),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _fromDate == null
                                            ? 'Select Date'
                                            : "${_fromDate!.day.toString().padLeft(2, '0')}/${_fromDate!.month.toString().padLeft(2, '0')}/${_fromDate!.year}",
                                        style: TextStyle(
                                          color: _fromDate == null ? Colors.grey[600] : Colors.black,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'End Date',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              InkWell(
                                onTap: () => _selectDate(context, false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey[450] ?? Colors.grey),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _toDate == null
                                            ? 'Select Date'
                                            : "${_toDate!.day.toString().padLeft(2, '0')}/${_toDate!.month.toString().padLeft(2, '0')}/${_toDate!.year}",
                                        style: TextStyle(
                                          color: _toDate == null ? Colors.grey[600] : Colors.black,
                                          fontSize: 13,
                                        ),
                                      ),
                                      const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Reason for Leave',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          '$_charCount/300 Characters',
                          style: TextStyle(
                            color: _charCount >= 300 ? Colors.red : Colors.grey[600],
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _reasonController,
                      maxLines: 4,
                      maxLength: 300,
                      decoration: InputDecoration(
                        hintText: 'Enter detailed reason (max 300 characters)...',
                        counterText: '',
                        helperText: _charCount >= 300 ? 'Maximum 300 characters allowed.' : null,
                        helperStyle: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter the reason for leave.';
                        }
                        if (val.length > 300) {
                          return 'Maximum 300 characters allowed.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Supporting Document (Optional)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: _pickAttachment,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: _uploadedAttachmentPath != null
                                ? const Color(0xFF059669)
                                : (_isUploadingAttachment ? Colors.indigo : Colors.grey[300]!),
                            width: _uploadedAttachmentPath != null || _isUploadingAttachment ? 1.5 : 1,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          color: _uploadedAttachmentPath != null
                              ? const Color(0xFFECFDF5)
                              : (_isUploadingAttachment ? Colors.indigo.shade50 : Colors.grey[50]),
                        ),
                        child: Column(
                          children: [
                            if (_isUploadingAttachment) ...[
                              const SizedBox(
                                width: 28,
                                height: 28,
                                child: CircularProgressIndicator(color: Colors.indigo, strokeWidth: 2.5),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Uploading ${_attachment != null ? path.basename(_attachment!.path) : "file"}...',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.indigo),
                              ),
                              const SizedBox(height: 4),
                              const Text('Please wait while attachment is uploading to server...', style: TextStyle(color: Colors.grey, fontSize: 11)),
                            ] else if (_uploadedAttachmentPath != null) ...[
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 24),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      path.basename(_attachment!.path),
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF065F46)),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.cancel_rounded, color: Colors.red, size: 20),
                                    onPressed: () {
                                      setState(() {
                                        _attachment = null;
                                        _uploadedAttachmentPath = null;
                                      });
                                    },
                                  )
                                ],
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Uploaded Successfully ✓ (Tap to change file)',
                                style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 11),
                              ),
                            ] else ...[
                              const Icon(Icons.cloud_upload_outlined, size: 32, color: Colors.grey),
                              const SizedBox(height: 8),
                              Text(
                                _attachment == null ? 'Click to select document' : path.basename(_attachment!.path),
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'Supports PDF, Images, Word docs (max 5MB)',
                                style: TextStyle(color: Colors.grey, fontSize: 10),
                              ),
                            ]
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _submitForm,
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Text('SUBMIT APPLICATION', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
