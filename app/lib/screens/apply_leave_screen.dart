import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as path;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/leave_service.dart';
import '../main.dart';

class ApplyLeaveScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole; // 'TEACHER' or 'PARENT' or 'STUDENT'
  final int? selectedStudentId; // only relevant for parent role

  const ApplyLeaveScreen({
    super.key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
  });

  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  String _leaveType = 'Sick Leave';
  DateTime? _fromDate;
  DateTime? _toDate;
  final TextEditingController _reasonController = TextEditingController();

  File? _attachment;
  String? _uploadedAttachmentPath;
  bool _isUploadingAttachment = false;

  bool _isSubmitting = false;
  String? _errorMessage;
  int _charCount = 0;

  // Parent child selection
  List<dynamic> _children = [];
  int? _selectedStudentId;
  bool _isLoadingChildren = false;

  final List<String> _leaveTypes = [
    'Sick Leave',
    'Personal Leave',
    'Casual Leave',
    'Emergency Leave',
    'Other',
  ];

  static const Color _primary = Color(0xFFD97706);
  static const Color _textPrimary = Color(0xFF0F172A);
  static const Color _textSecondary = Color(0xFF64748B);
  static const Color _inputBg = Color(0xFFF8FAFC);
  static const Color _inputBorder = Color(0xFFCBD5E1);

  @override
  void initState() {
    super.initState();
    _selectedStudentId = widget.selectedStudentId;
    _reasonController.addListener(_updateCharCount);
    if (widget.userRole.toUpperCase() == 'PARENT') {
      _loadChildren();
    }
  }

  @override
  void dispose() {
    _reasonController.removeListener(_updateCharCount);
    _reasonController.dispose();
    super.dispose();
  }

  void _updateCharCount() {
    setState(() {
      _charCount = _reasonController.text.length;
    });
  }

  Future<void> _loadChildren() async {
    setState(() {
      _isLoadingChildren = true;
    });
    try {
      final list = await widget.leaveService.getChildren();
      if (mounted) {
        setState(() {
          _children = list;
          if (_selectedStudentId == null && _children.isNotEmpty) {
            final firstId = _children[0]['id'];
            _selectedStudentId = firstId is int ? firstId : int.tryParse(firstId.toString());
          }
          _isLoadingChildren = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoadingChildren = false;
        });
      }
    }
  }

  IconData _getLeaveTypeIcon(String type) {
    switch (type) {
      case 'Sick Leave':
        return Icons.medical_services_outlined;
      case 'Personal Leave':
        return Icons.person_outline_rounded;
      case 'Casual Leave':
        return Icons.beach_access_rounded;
      case 'Emergency Leave':
        return Icons.warning_amber_rounded;
      default:
        return Icons.edit_note_rounded;
    }
  }

  String _formatDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
  }

  Future<void> _pickDate(BuildContext context, bool isFromDate) async {
    FocusScope.of(context).unfocus();
    final now = DateTime.now();
    final initial = isFromDate
        ? (_fromDate ?? now)
        : (_toDate ?? _fromDate ?? now);

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now.subtract(const Duration(days: 60)),
      lastDate: now.add(const Duration(days: 365)),
      builder: (pickerCtx, child) {
        return Theme(
          data: Theme.of(pickerCtx).copyWith(
            colorScheme: const ColorScheme.light(
              primary: _primary,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: _textPrimary,
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: _primary,
                textStyle: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _errorMessage = null;
        if (isFromDate) {
          _fromDate = picked;
          if (_toDate != null && _toDate!.isBefore(picked)) {
            _toDate = picked;
          }
        } else {
          _toDate = picked;
        }
      });
    }
  }

  Future<void> _pickAttachment() async {
    if (_isUploadingAttachment) return;
    FocusScope.of(context).unfocus();

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    );

    if (result != null && result.files.single.path != null) {
      final selectedFile = File(result.files.single.path!);

      setState(() {
        _attachment = selectedFile;
        _isUploadingAttachment = true;
        _uploadedAttachmentPath = null;
        _errorMessage = null;
      });

      try {
        final uploadedPath = await widget.leaveService.uploadAttachment(selectedFile);
        if (mounted) {
          setState(() {
            _uploadedAttachmentPath = uploadedPath;
            _isUploadingAttachment = false;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _attachment = null;
            _uploadedAttachmentPath = null;
            _isUploadingAttachment = false;
            _errorMessage = 'Failed to upload attachment: ${e.toString()}';
          });
        }
      }
    }
  }

  Future<void> _submitForm() async {
    FocusScope.of(context).unfocus();

    if (widget.userRole.toUpperCase() == 'PARENT' && _selectedStudentId == null) {
      setState(() {
        _errorMessage = 'Please select a child to apply leave for.';
      });
      return;
    }

    if (_fromDate == null || _toDate == null) {
      setState(() {
        _errorMessage = 'Please select both start and end dates.';
      });
      return;
    }

    if (_toDate!.isBefore(_fromDate!)) {
      setState(() {
        _errorMessage = 'End date cannot be earlier than start date.';
      });
      return;
    }

    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter reason for leave.';
      });
      return;
    }

    if (_charCount > 300) {
      setState(() {
        _errorMessage = 'Maximum 300 characters allowed for reason.';
      });
      return;
    }

    final wordCount = reason.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    if (wordCount > 100) {
      setState(() {
        _errorMessage = 'Reason cannot exceed 100 words (current: $wordCount).';
      });
      return;
    }

    if (_isUploadingAttachment) {
      setState(() {
        _errorMessage = 'Please wait while attachment is uploading...';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final fromDateStr =
          "${_fromDate!.year}-${_fromDate!.month.toString().padLeft(2, '0')}-${_fromDate!.day.toString().padLeft(2, '0')}";
      final toDateStr =
          "${_toDate!.year}-${_toDate!.month.toString().padLeft(2, '0')}-${_toDate!.day.toString().padLeft(2, '0')}";

      await widget.leaveService.applyLeaveRequest(
        leaveType: _leaveType,
        fromDate: fromDateStr,
        toDate: toDateStr,
        reason: reason,
        studentId: _selectedStudentId ?? widget.selectedStudentId,
        attachment: _attachment,
        attachmentPath: _uploadedAttachmentPath,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request submitted successfully.'),
          backgroundColor: Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 3),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      final errorMsg = e.toString().replaceAll('Exception:', '').trim();
      if (mounted) {
        if (errorMsg.contains('Unauthorized') || errorMsg.contains('login')) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.clear();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Session expired. Please login again.')),
          );
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (context) => const LoginScreen()),
            (route) => false,
          );
        } else {
          setState(() {
            _errorMessage = errorMsg.isNotEmpty ? errorMsg : 'Failed to submit leave request.';
          });
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Widget _buildCurvedDropdown(BuildContext context) {
    return Builder(
      builder: (btnContext) {
        return InkWell(
          onTap: () async {
            FocusScope.of(context).unfocus();
            final renderBox = btnContext.findRenderObject() as RenderBox?;
            if (renderBox == null) return;
            final offset = renderBox.localToGlobal(Offset.zero);
            final size = renderBox.size;
            final overlay = Overlay.of(context).context.findRenderObject() as RenderBox?;
            if (overlay == null) return;

            final position = RelativeRect.fromRect(
              Rect.fromLTWH(offset.dx, offset.dy + size.height + 4, size.width, size.height),
              Offset.zero & overlay.size,
            );

            final selected = await showMenu<String>(
              context: context,
              position: position,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.white,
              surfaceTintColor: Colors.transparent,
              elevation: 6,
              constraints: BoxConstraints(
                minWidth: size.width,
                maxWidth: size.width,
              ),
              items: _leaveTypes.map((type) {
                final isSelected = type == _leaveType;
                return PopupMenuItem<String>(
                  value: type,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFFEF3C7) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              _getLeaveTypeIcon(type),
                              size: 18,
                              color: isSelected ? _primary : _textSecondary,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              type,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                color: isSelected ? const Color(0xFFB45309) : _textPrimary,
                              ),
                            ),
                          ],
                        ),
                        if (isSelected)
                          const Icon(Icons.check_rounded, size: 18, color: _primary),
                      ],
                    ),
                  ),
                );
              }).toList(),
            );

            if (selected != null && selected != _leaveType) {
              setState(() {
                _leaveType = selected;
              });
            }
          },
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: _inputBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _inputBorder, width: 1.2),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(_getLeaveTypeIcon(_leaveType), size: 18, color: _primary),
                    const SizedBox(width: 10),
                    Text(
                      _leaveType,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _textPrimary,
                      ),
                    ),
                  ],
                ),
                const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: _textSecondary,
                  size: 20,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDatePickerBox({
    required BuildContext context,
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
  }) {
    final dateText = date == null ? 'Select date...' : _formatDate(date);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: _textSecondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: _inputBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _inputBorder, width: 1.2),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    dateText,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: date != null ? FontWeight.w700 : FontWeight.w500,
                      color: date != null ? _textPrimary : const Color(0xFF94A3B8),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(
                  Icons.calendar_month_rounded,
                  size: 18,
                  color: _primary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDurationBadge() {
    if (_fromDate == null || _toDate == null) return const SizedBox.shrink();
    final diff = _toDate!.difference(_fromDate!).inDays + 1;
    final days = diff > 0 ? diff : 1;
    final text = days == 1 ? 'Total duration: 1 Day' : 'Total duration: $days Days';
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.info_outline_rounded, size: 14, color: _primary),
          const SizedBox(width: 6),
          Text(
            text,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFFB45309),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentSelector() {
    if (widget.userRole.toUpperCase() != 'PARENT') {
      return const SizedBox.shrink();
    }
    if (_isLoadingChildren) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 16),
        child: LinearProgressIndicator(color: _primary),
      );
    }
    if (_children.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SELECT CHILD *',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: _textSecondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: _inputBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _inputBorder, width: 1.2),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              value: _selectedStudentId,
              isExpanded: true,
              hint: const Text('Select child...', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
              items: _children.map<DropdownMenuItem<int>>((c) {
                final id = c['id'] is int ? c['id'] as int : int.tryParse(c['id'].toString()) ?? 0;
                final name = c['name'] ?? '${c['first_name'] ?? ''} ${c['last_name'] ?? ''}'.trim();
                return DropdownMenuItem<int>(
                  value: id,
                  child: Text(
                    name.isNotEmpty ? name : 'Student #$id',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: _textPrimary),
                  ),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _selectedStudentId = val;
                  });
                }
              },
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F2),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: _textPrimary, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: const Text(
          'APPLY FOR LEAVE',
          style: TextStyle(
            color: _textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 16,
            letterSpacing: 0.5,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Error Message
            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 18, color: Colors.redAccent),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Child Selector (if Parent)
            _buildStudentSelector(),

            // 1. Leave Type (Latest Theme Dropdown)
            const Text(
              'LEAVE TYPE *',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _textSecondary,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            _buildCurvedDropdown(context),
            const SizedBox(height: 16),

            // 2. Start Date and End Date (Latest Theme Calendar)
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerBox(
                    context: context,
                    label: 'START DATE *',
                    date: _fromDate,
                    onTap: () => _pickDate(context, true),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDatePickerBox(
                    context: context,
                    label: 'END DATE *',
                    date: _toDate,
                    onTap: () => _pickDate(context, false),
                  ),
                ),
              ],
            ),
            _buildDurationBadge(),
            const SizedBox(height: 16),

            // 3. Reason for Leave
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'REASON FOR LEAVE *',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  '$_charCount/300 Characters',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _charCount > 300 ? Colors.redAccent : _textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonController,
              maxLines: 3,
              maxLength: 300,
              style: const TextStyle(
                fontSize: 13,
                color: _textPrimary,
                fontWeight: FontWeight.w600,
              ),
              decoration: InputDecoration(
                hintText: 'Enter detailed reason (max 300 characters)...',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                counterText: '',
                filled: true,
                fillColor: _inputBg,
                contentPadding: const EdgeInsets.all(14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _inputBorder, width: 1.2),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _inputBorder, width: 1.2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _primary, width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 4. Supporting Document (Optional)
            const Text(
              'SUPPORTING DOCUMENT (OPTIONAL)',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: _textSecondary,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickAttachment,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: _uploadedAttachmentPath != null
                      ? const Color(0xFFECFDF5)
                      : (_isUploadingAttachment ? const Color(0xFFFFFBEB) : _inputBg),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _uploadedAttachmentPath != null
                        ? const Color(0xFF059669)
                        : (_isUploadingAttachment ? _primary : _inputBorder),
                    width: 1.2,
                  ),
                ),
                child: _isUploadingAttachment
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: _primary, strokeWidth: 2),
                          ),
                          SizedBox(width: 10),
                          Text(
                            'Uploading attachment to server...',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _primary,
                            ),
                          ),
                        ],
                      )
                    : _uploadedAttachmentPath != null
                        ? Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _attachment != null ? path.basename(_attachment!.path) : 'Uploaded Document',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                        color: Color(0xFF065F46),
                                      ),
                                    ),
                                    const Text(
                                      'Uploaded Successfully ✓ (Tap to replace)',
                                      style: TextStyle(fontSize: 10, color: Color(0xFF059669), fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.cancel_rounded, color: Colors.redAccent, size: 20),
                                onPressed: () {
                                  setState(() {
                                    _attachment = null;
                                    _uploadedAttachmentPath = null;
                                  });
                                },
                              ),
                            ],
                          )
                        : Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFFFBEB),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.cloud_upload_outlined, color: _primary, size: 20),
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Click to select document',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: _textPrimary,
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Supports PDF, Images, Word docs (max 5MB)',
                                      style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
              ),
            ),
            const SizedBox(height: 28),

            // 5. Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.2,
                        ),
                      )
                    : const Text(
                        'SUBMIT APPLICATION',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
