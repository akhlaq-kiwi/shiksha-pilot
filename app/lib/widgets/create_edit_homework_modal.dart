import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/homework_service.dart';

class CreateEditHomeworkModal extends StatefulWidget {
  final HomeworkService homeworkService;
  final Map<String, dynamic>? initialHomework; // null for Create, object for Edit

  const CreateEditHomeworkModal({
    Key? key,
    required this.homeworkService,
    this.initialHomework,
  }) : super(key: key);

  static Future<bool?> show(
    BuildContext context, {
    required HomeworkService homeworkService,
    Map<String, dynamic>? initialHomework,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CreateEditHomeworkModal(
        homeworkService: homeworkService,
        initialHomework: initialHomework,
      ),
    );
  }

  @override
  State<CreateEditHomeworkModal> createState() => _CreateEditHomeworkModalState();
}

class _CreateEditHomeworkModalState extends State<CreateEditHomeworkModal> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();

  List<dynamic> _classesList = [];
  int? _selectedClassId;
  bool _isLoadingClasses = false;

  List<Map<String, dynamic>> _attachments = [];
  bool _isUploading = false;
  bool _isSubmitting = false;
  String? _uploadStatusText;

  @override
  void initState() {
    super.initState();
    if (widget.initialHomework != null) {
      _titleController.text = widget.initialHomework!['title'] ?? '';
      _descController.text = widget.initialHomework!['description'] ?? '';
      _selectedClassId = widget.initialHomework!['class_id'];
      if (widget.initialHomework!['attachments'] is List) {
        _attachments = List<Map<String, dynamic>>.from(
          (widget.initialHomework!['attachments'] as List).map((e) => Map<String, dynamic>.from(e)),
        );
      }
    }
    _fetchClasses();
  }

  Future<void> _fetchClasses() async {
    setState(() {
      _isLoadingClasses = true;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final baseUrl = widget.homeworkService.baseUrl;

      final response = await http.get(
        Uri.parse('$baseUrl/api/teacher/classes'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final list = decoded['data'] ?? decoded['classes'] ?? [];
        if (mounted) {
          setState(() {
            final rawList = list is List ? list : [];
            final Set<int> seenIds = {};
            final List uniqueClasses = [];
            for (var c in rawList) {
              final int? id = c['id'] is int ? c['id'] : int.tryParse(c['id'].toString());
              if (id != null && !seenIds.contains(id)) {
                seenIds.add(id);
                uniqueClasses.add(c);
              }
            }
            _classesList = uniqueClasses;
            if (_selectedClassId == null && _classesList.isNotEmpty) {
              final first = _classesList.first;
              _selectedClassId = first['id'] is int ? first['id'] : int.tryParse(first['id'].toString());
            }
            _isLoadingClasses = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _isLoadingClasses = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingClasses = false;
        });
      }
    }
  }

  Future<void> _pickAndUploadAttachment() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        allowMultiple: false,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      if (file.path == null) return;

      final ioFile = File(file.path!);
      final ext = file.extension?.toLowerCase() ?? '';
      final allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

      if (!allowed.contains(ext)) {
        _showErrorSnackBar('Unsupported file format.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        _showErrorSnackBar('File size exceeds the allowed limit.');
        return;
      }

      setState(() {
        _isUploading = true;
        _uploadStatusText = 'Uploading attachment...';
      });

      final uploadedData = await widget.homeworkService.uploadAttachment(ioFile);

      if (mounted) {
        setState(() {
          _attachments.add(uploadedData);
          _isUploading = false;
          _uploadStatusText = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Attachment uploaded successfully.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUploading = false;
          _uploadStatusText = null;
        });
        final errText = e.toString().replaceAll('Exception: ', '');
        _showErrorSnackBar(errText.isNotEmpty ? errText : 'Unable to upload attachment. Please try again.');
      }
    }
  }

  void _removeAttachment(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.red.shade700,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _handleSubmit() async {
    final title = _titleController.text.trim();
    final description = _descController.text.trim();

    if (_selectedClassId == null) {
      _showErrorSnackBar('Please select a target class.');
      return;
    }

    if (description.isEmpty && _attachments.isEmpty) {
      _showErrorSnackBar('Please enter a homework description or upload at least one attachment.');
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      if (widget.initialHomework == null) {
        // Create
        await widget.homeworkService.createHomework(
          title: title,
          description: description,
          classId: _selectedClassId,
          attachments: _attachments,
        );
      } else {
        // Update
        final id = widget.initialHomework!['id'];
        await widget.homeworkService.updateHomework(
          id,
          title: title,
          description: description,
          classId: _selectedClassId,
          attachments: _attachments,
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.initialHomework == null
                  ? 'Homework uploaded successfully.'
                  : 'Homework updated successfully.',
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
        final errStr = e.toString().replaceAll('Exception: ', '');
        _showErrorSnackBar(errStr.isNotEmpty ? errStr : 'Failed to save homework');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.initialHomework != null;
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(bottom: bottomPadding),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Modal Handle Bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Modal Header with Title & Class Dropdown
            Row(
              children: [
                Text(
                  isEdit ? 'Edit Homework' : 'Assign Homework',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _isLoadingClasses
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigo),
                        )
                      : Container(
                          height: 34,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                          decoration: BoxDecoration(
                            color: Colors.indigo.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.indigo.shade200),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value: _selectedClassId,
                              isExpanded: true,
                              isDense: true,
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.indigo, size: 18),
                              hint: const Text(
                                'Select Class',
                                style: TextStyle(fontSize: 12, color: Colors.indigo, fontWeight: FontWeight.bold),
                              ),
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.indigo),
                              items: _classesList.map((c) {
                                final int id = c['id'] is int ? c['id'] : int.parse(c['id'].toString());
                                final String name = c['name'] ?? '';
                                final String sec = c['section'] ?? '';
                                final label = name + (sec.isNotEmpty ? ' - $sec' : '');
                                return DropdownMenuItem<int>(
                                  value: id,
                                  child: Text(label, overflow: TextOverflow.ellipsis),
                                );
                              }).toList(),
                              onChanged: (val) {
                                setState(() {
                                  _selectedClassId = val;
                                });
                              },
                            ),
                          ),
                        ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Subject Name Field
            TextField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: 'Enter Subject Name',
                hintText: 'e.g. Mathematics, Science, English',
                prefixIcon: const Icon(Icons.menu_book_rounded, color: Colors.indigo),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),

            const SizedBox(height: 14),

            // Description Field
            TextField(
              controller: _descController,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Description',
                hintText: 'e.g. Learn tables from 2 to 10.',
                alignLabelWithHint: true,
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(bottom: 50),
                  child: Icon(Icons.description_outlined, color: Colors.indigo),
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),

            const SizedBox(height: 16),

            // Attachments Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Attachments (PDF / Images)',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                TextButton.icon(
                  onPressed: (_isUploading || _isSubmitting) ? null : _pickAndUploadAttachment,
                  icon: const Icon(Icons.attach_file_rounded, size: 18),
                  label: const Text('Add File'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.indigo,
                  ),
                ),
              ],
            ),

            // Upload Progress Status
            if (_isUploading)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.indigo.shade100),
                ),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.indigo),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _uploadStatusText ?? 'Uploading attachment...',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.indigo,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Uploaded Attachments List
            if (_attachments.isEmpty && !_isUploading)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Center(
                  child: Text(
                    'No files attached yet.',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  ),
                ),
              )
            else
              Column(
                children: List.generate(_attachments.length, (index) {
                  final att = _attachments[index];
                  final name = att['file_name'] ?? 'File';
                  final type = att['file_type'] ?? 'file';
                  final isPdf = type == 'pdf' || name.toLowerCase().endsWith('.pdf');

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded,
                          color: isPdf ? Colors.red.shade700 : Colors.indigo,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
                          onPressed: (_isUploading || _isSubmitting) ? null : () => _removeAttachment(index),
                        ),
                      ],
                    ),
                  );
                }),
              ),

            const SizedBox(height: 20),

            // Submit Button
            ElevatedButton(
              onPressed: (_isUploading || _isSubmitting) ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Text(
                      isEdit ? 'Update Homework' : 'Assign Homework',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}
