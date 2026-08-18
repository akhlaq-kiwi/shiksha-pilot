import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:school_hub/services/exam_service.dart';
import 'package:school_hub/services/notification_helper.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';
import 'package:school_hub/screens/due_restriction_screen.dart';

class ExamDetailScreen extends StatefulWidget {
  final ExamService examService;
  final int examId;
  final String examName;
  final String userRole;
  final int? studentId;

  const ExamDetailScreen({
    Key? key,
    required this.examService,
    required this.examId,
    required this.examName,
    required this.userRole,
    this.studentId,
  }) : super(key: key);

  @override
  _ExamDetailScreenState createState() => _ExamDetailScreenState();
}

class _ExamDetailScreenState extends State<ExamDetailScreen> {
  Map<String, dynamic> _details = {};
  bool _isLoading = true;
  bool _isDownloading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await widget.examService.getExamDetails(
        widget.examId,
        widget.userRole,
        widget.studentId,
      );
      setState(() {
        _details = data;
        _isLoading = false;
      });
    } catch (err) {
      setState(() {
        _errorMessage = err.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final monthsShort = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${date.day} ${monthsShort[date.month - 1]} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatTime(String timeStr) {
    try {
      final parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      int hour = int.parse(parts[0]);
      final minute = parts[1];
      final ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour == 0) hour = 12;
      return '$hour:$minute $ampm';
    } catch (_) {
      return timeStr;
    }
  }

  String _formatMarks(String? marksStr) {
    if (marksStr == null) return '0';
    try {
      final double val = double.parse(marksStr);
      if (val == val.toInt()) {
        return val.toInt().toString();
      }
      String s = val.toString();
      if (s.endsWith('.0')) {
        s = s.substring(0, s.length - 2);
      }
      return s;
    } catch (_) {
      return marksStr;
    }
  }

  void _showSchemeModal() {
    final List<dynamic> scheme = _details['scheme'] ?? [];
    final List<dynamic> publishedClassSchemes = (_details['published_class_schemes'] as List<dynamic>?) ?? [];
    final bool isTeacher = (widget.userRole == 'TEACHER');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        int? expandedClassIndex;

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.8,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Examination Timetable Scheme',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.examName,
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                  ),
                  const Divider(height: 24),
                  Expanded(
                    child: isTeacher
                        ? (publishedClassSchemes.isEmpty
                            ? const Center(child: Text('No published examination schemes found.'))
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: publishedClassSchemes.length,
                                itemBuilder: (context, index) {
                                  final item = publishedClassSchemes[index];
                                  final className = item['class_name'] ?? 'Class';
                                  final List<dynamic> papers = (item['scheme'] as List<dynamic>?) ?? [];
                                  final isExpanded = (expandedClassIndex == index);

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: isExpanded ? Colors.indigo.shade300 : Colors.grey.shade200,
                                        width: isExpanded ? 1.5 : 1,
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.03),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      children: [
                                        InkWell(
                                          borderRadius: BorderRadius.circular(16),
                                          onTap: () {
                                            setModalState(() {
                                              expandedClassIndex = isExpanded ? null : index;
                                            });
                                          },
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Row(
                                                  children: [
                                                    Container(
                                                      padding: const EdgeInsets.all(8),
                                                      decoration: BoxDecoration(
                                                        color: isExpanded ? Colors.indigo.shade50 : Colors.grey.shade100,
                                                        borderRadius: BorderRadius.circular(10),
                                                      ),
                                                      child: Icon(
                                                        Icons.class_rounded,
                                                        color: isExpanded ? Colors.indigo.shade800 : Colors.grey.shade600,
                                                        size: 20,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    Text(
                                                      className,
                                                      style: TextStyle(
                                                        fontSize: 15,
                                                        fontWeight: FontWeight.bold,
                                                        color: isExpanded ? Colors.indigo.shade900 : Colors.black87,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                Icon(
                                                  isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                                                  color: isExpanded ? Colors.indigo.shade800 : Colors.grey.shade500,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                        if (isExpanded) ...[
                                          const Divider(height: 1),
                                          Padding(
                                            padding: const EdgeInsets.all(12),
                                            child: papers.isEmpty
                                                ? const Padding(
                                                    padding: EdgeInsets.all(16),
                                                    child: Text('No scheduled papers for this class.', style: TextStyle(fontSize: 13, color: Colors.grey)),
                                                  )
                                                : Column(
                                                    children: papers.map((paper) => _buildPaperItemCard(paper)).toList(),
                                                  ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  );
                                },
                              ))
                        : (scheme.isEmpty
                            ? const Center(child: Text('No timetable entries found.'))
                            : ListView.builder(
                                padding: const EdgeInsets.all(16),
                                itemCount: scheme.length,
                                itemBuilder: (context, index) {
                                  return _buildPaperItemCard(scheme[index]);
                                },
                              )),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildPaperItemCard(dynamic paper) {
    final sub = paper['subject_name'] ?? 'Subject';
    final date = paper['exam_date'] ?? '';
    final start = paper['start_time'] ?? '';
    final end = paper['end_time'] ?? '';
    final maxM = paper['max_marks']?.toString() ?? '100';
    final passM = paper['passing_marks']?.toString() ?? '33';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            sub,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Date: ',
                          style: TextStyle(fontSize: 13, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: Text(
                            _formatDate(date),
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Text(
                          'Max: ',
                          style: TextStyle(fontSize: 12, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: Text(
                            '${_formatMarks(maxM)} Marks',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Time: ',
                          style: TextStyle(fontSize: 13, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: Text(
                            '${_formatTime(start)} - ${_formatTime(end)}',
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Text(
                          'Pass: ',
                          style: TextStyle(fontSize: 12, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                        ),
                        Expanded(
                          child: Text(
                            '${_formatMarks(passM)} Marks',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getFullPositionName(String pos) {
    if (pos == 'L' || pos.toLowerCase() == 'left') return 'LEFT';
    if (pos == 'M' || pos.toLowerCase() == 'middle' || pos.toLowerCase() == 'center') return 'CENTER';
    if (pos == 'R' || pos.toLowerCase() == 'right') return 'RIGHT';
    return pos;
  }

  void _showToast(String message) {
    if (!mounted) return;
    final overlay = Overlay.of(context);
    final overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        bottom: 100,
        left: 24,
        right: 24,
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade900.withOpacity(0.9),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.green, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(overlayEntry);
    Future.delayed(const Duration(seconds: 3), () {
      overlayEntry.remove();
    });
  }

  void _showErrorToast(String message) {
    if (!mounted) return;
    final overlay = Overlay.of(context);
    final overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        bottom: 100,
        left: 24,
        right: 24,
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.red.shade900.withOpacity(0.9),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(overlayEntry);
    Future.delayed(const Duration(seconds: 3), () {
      overlayEntry.remove();
    });
  }

  void _showEnterMarksModal() async {
    List<dynamic> scheme = (_details['scheme'] as List<dynamic>?) ?? [];
    if (scheme.isEmpty) {
      try {
        final freshData = await widget.examService.getExamDetails(
          widget.examId,
          widget.userRole,
          widget.studentId,
        );
        if (mounted) {
          setState(() {
            _details = freshData;
          });
        }
        scheme = (freshData['scheme'] as List<dynamic>?) ?? [];
      } catch (_) {}
    }

    if (scheme.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No scheduled subjects found for this exam timetable.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    int selectedSubjectId = (scheme.first['subject_id'] is int)
        ? scheme.first['subject_id'] as int
        : int.tryParse(scheme.first['subject_id'].toString()) ?? 0;

    Map<String, dynamic>? marksSheetData;
    bool isLoadingSheet = false;
    bool isSaving = false;
    bool hasSavedForCurrentSubject = false;
    bool isEditingMode = false;
    String? sheetError;

    final Map<int, TextEditingController> marksControllers = {};
    final Map<int, bool> absentMap = {};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext modalContext) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {

            Future<void> loadMarksForSubject(int subId) async {
              setModalState(() {
                isLoadingSheet = true;
                sheetError = null;
                hasSavedForCurrentSubject = false;
                isEditingMode = false;
              });
              try {
                final data = await widget.examService.getMarksSheet(widget.examId, subId);
                marksControllers.forEach((_, c) => c.dispose());
                marksControllers.clear();
                absentMap.clear();

                bool anyExistingMarks = false;
                final students = (data['students'] as List<dynamic>?) ?? [];
                for (var s in students) {
                  final sId = s['student_id'] as int;
                  final marksObtained = s['marks_obtained'];
                  final isAbsent = (s['is_absent'] == 1 || s['is_absent'] == true);
                  
                  if (marksObtained != null || isAbsent) {
                    anyExistingMarks = true;
                  }

                  marksControllers[sId] = TextEditingController(
                    text: (marksObtained != null && !isAbsent) ? marksObtained.toString() : '',
                  );
                  absentMap[sId] = isAbsent;
                }

                setModalState(() {
                  marksSheetData = data;
                  isLoadingSheet = false;
                  hasSavedForCurrentSubject = anyExistingMarks;
                  isEditingMode = !anyExistingMarks; // Read-only if marks already exist, Edit mode if new
                });
              } catch (e) {
                setModalState(() {
                  sheetError = e.toString().replaceAll('Exception: ', '');
                  isLoadingSheet = false;
                });
              }
            }

            if (marksSheetData == null && !isLoadingSheet && sheetError == null) {
              loadMarksForSubject(selectedSubjectId);
            }

            final className = marksSheetData?['class_name']?.toString() ?? '';
            final maxM = (marksSheetData?['max_marks'] ?? 100.0).toDouble();
            final passM = (marksSheetData?['passing_marks'] ?? 33.0).toDouble();
            final isResultPublished = (marksSheetData?['is_result_published'] == true || _details['result_status'] == 'Published');
            final studentsList = (marksSheetData?['students'] as List<dynamic>?) ?? [];

            // Force read-only if result is published
            if (isResultPublished && isEditingMode) {
              isEditingMode = false;
            }

            Future<void> saveMarks() async {
              if (isResultPublished) return;
              setModalState(() {
                isSaving = true;
              });
              try {
                final isGradeSubject = (marksSheetData?['evaluation_type'] == 'grade') || (maxM == 0.0);
                List<Map<String, dynamic>> marksPayload = [];
                for (var s in studentsList) {
                  final sId = s['student_id'] as int;
                  final isAb = absentMap[sId] ?? false;
                  final valStr = marksControllers[sId]?.text.trim() ?? '';
                  
                  dynamic val;
                  if (isGradeSubject) {
                    val = isAb ? null : (valStr.isEmpty ? null : valStr);
                  } else {
                    val = isAb ? null : double.tryParse(valStr);
                  }

                  marksPayload.add({
                    'student_id': sId,
                    'is_absent': isAb ? 1 : 0,
                    'marks_obtained': isAb ? null : val,
                  });
                }

                await widget.examService.saveMarksSheet(widget.examId, {
                  'subject_id': selectedSubjectId,
                  'marks': marksPayload,
                });

                if (mounted) {
                  setModalState(() {
                    isSaving = false;
                    hasSavedForCurrentSubject = true;
                    isEditingMode = false; // Lock back to Read-only mode after save
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Marks saved successfully! Reflected on Admin Portal.'),
                      backgroundColor: Color(0xFF059669),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } catch (e) {
                setModalState(() {
                  isSaving = false;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Failed to save marks: ${e.toString().replaceAll('Exception: ', '')}'),
                    backgroundColor: Colors.red,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            }

            final bottomInset = MediaQuery.of(context).viewInsets.bottom;

            return Padding(
              padding: EdgeInsets.only(bottom: bottomInset),
              child: Container(
                height: MediaQuery.of(context).size.height * 0.85,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  children: [
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 12, bottom: 8),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  // Header with Class Name: "Enter Marks - Class X"
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                className.isNotEmpty ? 'Enter Marks - $className' : 'Enter Marks',
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.indigo),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                _details['exam_name'] ?? 'Exam Marks Sheet',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(modalContext),
                          icon: const Icon(Icons.close_rounded),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),

                  // Subjects Bar (Only if no error)
                  if (sheetError == null) ...[
                    Container(
                      height: 50,
                      color: Colors.grey.shade50,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: scheme.length,
                        itemBuilder: (context, idx) {
                          final item = scheme[idx];
                          final subId = (item['subject_id'] is int)
                              ? item['subject_id'] as int
                              : int.tryParse(item['subject_id'].toString()) ?? 0;
                          final subName = item['subject_name'] ?? 'Subject';
                          final isSelected = subId == selectedSubjectId;

                          return GestureDetector(
                            onTap: () {
                              if (subId != selectedSubjectId) {
                                setModalState(() {
                                  selectedSubjectId = subId;
                                  marksSheetData = null;
                                });
                                loadMarksForSubject(subId);
                              }
                            },
                            child: Container(
                              margin: const EdgeInsets.only(right: 10),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected ? Colors.indigo.shade700 : Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isSelected ? Colors.indigo.shade700 : Colors.grey.shade300,
                                ),
                              ),
                              child: Text(
                                subName,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: isSelected ? Colors.white : Colors.indigo.shade900,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const Divider(height: 1),
                  ],

                  Expanded(
                    child: isLoadingSheet
                        ? const Center(child: CircularProgressIndicator())
                        : sheetError != null
                            ? Center(
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(20),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.shade50,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          Icons.assignment_ind_outlined,
                                          size: 48,
                                          color: Colors.amber.shade800,
                                        ),
                                      ),
                                      const SizedBox(height: 20),
                                      const Text(
                                        'No class Assigned to you yet',
                                        style: TextStyle(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.black87,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Please contact school administrator to assign a class to your teacher profile.',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                          color: Colors.grey.shade600,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : Column(
                                children: [
                                  // Lock Banner if Result Published
                                  if (isResultPublished)
                                    Container(
                                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: Colors.amber.shade50,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: Colors.amber.shade400),
                                      ),
                                      child: Row(
                                        children: [
                                          Icon(Icons.lock_rounded, color: Colors.amber.shade900, size: 20),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              'Report Card Published. Marks are locked and cannot be updated.',
                                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                                  // Max Marks (Left Aligned) & Passing Marks (Right Aligned)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                    color: Colors.indigo.shade50.withOpacity(0.5),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text('Max Marks: ${maxM.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                                        Text('Passing Marks: ${passM.toStringAsFixed(0)}', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.indigo.shade700)),
                                      ],
                                    ),
                                  ),

                                  Expanded(
                                    child: studentsList.isEmpty
                                        ? const Center(child: Text('No students found in this class.', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)))
                                        : ListView.separated(
                                            padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 12),
                                            itemCount: studentsList.length,
                                            separatorBuilder: (_, __) => const Divider(height: 16),
                                            itemBuilder: (context, index) {
                                              final st = studentsList[index];
                                              final sId = st['student_id'] as int;
                                              final name = st['student_name'] ?? 'Student';
                                              final roll = st['roll_no']?.toString() ?? '—';
                                              final isAb = absentMap[sId] ?? false;

                                              return Row(
                                                children: [
                                                  Expanded(
                                                    flex: 3,
                                                    child: Column(
                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                      children: [
                                                        Text(
                                                          name,
                                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                                          overflow: TextOverflow.ellipsis,
                                                        ),
                                                        const SizedBox(height: 2),
                                                        Text(
                                                          'Roll No: $roll',
                                                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                  Row(
                                                    children: [
                                                      Text(
                                                        'Absent',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.bold,
                                                          color: isAb ? Colors.red : Colors.grey,
                                                        ),
                                                      ),
                                                      Switch(
                                                        value: isAb,
                                                        activeTrackColor: Colors.red.shade400,
                                                        onChanged: (isEditingMode && !isResultPublished)
                                                            ? (val) {
                                                                setModalState(() {
                                                                  absentMap[sId] = val;
                                                                  if (val) {
                                                                    marksControllers[sId]?.clear();
                                                                  }
                                                                });
                                                              }
                                                            : null,
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(width: 8),

                                                  // Marks/Grade Field - Editable only in Edit Mode & if Result Not Published
                                                  (() {
                                                    final currentPaper = scheme.firstWhere(
                                                      (p) => ((p['subject_id'] is int) ? p['subject_id'] : int.tryParse(p['subject_id'].toString()) ?? 0) == selectedSubjectId,
                                                      orElse: () => null,
                                                    );
                                                    final isGradeSubject = (marksSheetData?['evaluation_type'] == 'grade') ||
                                                        (currentPaper?['evaluation_type'] == 'grade') ||
                                                        (maxM == 0.0) ||
                                                        ((double.tryParse(currentPaper?['max_marks']?.toString() ?? '') ?? -1) == 0.0);
                                                    if (isGradeSubject) {
                                                      final currentVal = marksControllers[sId]?.text.trim().toUpperCase();
                                                      final apiGrades = (marksSheetData?['available_grades'] as List<dynamic>?)?.map((e) => e.toString()).toList();
                                                      final validGrades = (apiGrades != null && apiGrades.isNotEmpty) ? apiGrades : ['A', 'B', 'C', 'D'];
                                                      final selectedGrade = validGrades.contains(currentVal) ? currentVal : null;

                                                      return SizedBox(
                                                        width: 95,
                                                        height: 42,
                                                        child: DropdownButtonFormField<String>(
                                                          value: isAb ? null : selectedGrade,
                                                          decoration: InputDecoration(
                                                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                                            filled: true,
                                                            fillColor: isAb
                                                                ? Colors.red.shade50
                                                                : ((isEditingMode && !isResultPublished) ? Colors.white : Colors.grey.shade100),
                                                          ),
                                                          hint: Text(isAb ? 'ABS' : 'Grade', style: TextStyle(fontSize: 11, color: isAb ? Colors.red : Colors.grey, fontWeight: FontWeight.bold)),
                                                          items: validGrades
                                                              .map((g) => DropdownMenuItem<String>(
                                                                    value: g,
                                                                    child: Text(g, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                                                  ))
                                                              .toList(),
                                                          onChanged: (isEditingMode && !isAb && !isResultPublished)
                                                              ? (val) {
                                                                  setModalState(() {
                                                                    marksControllers[sId]?.text = val ?? '';
                                                                  });
                                                                }
                                                              : null,
                                                        ),
                                                      );
                                                    } else {
                                                      return SizedBox(
                                                        width: 75,
                                                        height: 42,
                                                        child: TextField(
                                                          controller: marksControllers[sId],
                                                          enabled: isEditingMode && !isAb && !isResultPublished,
                                                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                                          inputFormatters: [
                                                            FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                                                            MaxValueTextInputFormatter(maxM),
                                                          ],
                                                          textAlign: TextAlign.center,
                                                          style: TextStyle(
                                                            fontWeight: FontWeight.bold,
                                                            fontSize: 14,
                                                            color: (isEditingMode && !isResultPublished) ? Colors.black87 : Colors.indigo.shade900,
                                                          ),
                                                          decoration: InputDecoration(
                                                            hintText: isAb ? 'ABS' : '0.0',
                                                            hintStyle: TextStyle(fontSize: 12, color: isAb ? Colors.red : Colors.grey),
                                                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                                            filled: true,
                                                            fillColor: isAb ? Colors.red.shade50 : ((isEditingMode && !isResultPublished) ? Colors.white : Colors.grey.shade100),
                                                          ),
                                                        ),
                                                      );
                                                    }
                                                  })(),
                                                ],
                                              );
                                            },
                                          ),
                                  ),
                                ],
                              ),
                  ),

                  // Action Button (Hidden if Result Published or if error state)
                  if (!isResultPublished && sheetError == null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, -5),
                          ),
                        ],
                      ),
                      child: SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: (isSaving || isLoadingSheet)
                              ? null
                              : () {
                                  if (!isEditingMode) {
                                    setModalState(() {
                                      isEditingMode = true;
                                    });
                                  } else {
                                    saveMarks();
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isEditingMode ? Colors.indigo.shade700 : Colors.amber.shade800,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: isSaving
                              ? const SizedBox.shrink()
                              : Icon(isEditingMode ? Icons.save_rounded : Icons.edit_rounded, size: 20),
                          label: isSaving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : Text(
                                  !isEditingMode
                                      ? 'Update Marks'
                                      : (hasSavedForCurrentSubject ? 'Save Updated Marks' : 'Save Marks'),
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                ),
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
  );
}

  Future<void> _downloadAdmitCardPDF(Map<String, dynamic> admit, StateSetter setModalState) async {
    setModalState(() {
      _isDownloading = true;
    });
    try {
      final pdf = pw.Document();
      
      final String rawAcademicYear = (admit['academic_year'] ?? '2026-2027').toString();
      final String academicYear = rawAcademicYear
          .replaceAll('–', '-')
          .replaceAll('—', '-')
          .replaceAll('−', '-');

      pdf.addPage(
        pw.Page(
          pageFormat: const PdfPageFormat(406, 296, marginAll: 3),
          build: (pw.Context context) {
            return pw.Container(
              width: 400,
              height: 290,
              padding: const pw.EdgeInsets.all(16),
              decoration: pw.BoxDecoration(
                color: PdfColors.white,
                borderRadius: pw.BorderRadius.circular(16),
                border: pw.Border.all(color: PdfColors.black, width: 3),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                mainAxisSize: pw.MainAxisSize.max,
                children: [
                  pw.Center(
                    child: pw.Text(
                      (admit['school_name'] ?? 'School Name').toString().toUpperCase(),
                      style: pw.TextStyle(
                        fontSize: 16,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColors.black,
                      ),
                      textAlign: pw.TextAlign.center,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        widget.examName.toUpperCase(),
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.black,
                        ),
                      ),
                      pw.Text(
                        'AY ${academicYear.toUpperCase()}',
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.black,
                        ),
                      ),
                    ],
                  ),
                  pw.SizedBox(height: 4),
                  pw.Divider(color: PdfColors.black, thickness: 2),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    'CANDIDATE NAME',
                    style: const pw.TextStyle(
                      fontSize: 8,
                      color: PdfColors.grey600,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    (admit['student_name'] ?? 'STUDENT NAME').toString().toUpperCase(),
                    style: pw.TextStyle(
                      fontSize: 18,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.black,
                    ),
                  ),
                  pw.SizedBox(height: 12),
                  pw.Row(
                    children: [
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'CLASS',
                              style: const pw.TextStyle(
                                fontSize: 8,
                                color: PdfColors.grey600,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              (admit['class_name'] ?? 'CLASS').toString().toUpperCase(),
                              style: pw.TextStyle(
                                  fontSize: 13,
                                  fontWeight: pw.FontWeight.bold,
                                  color: PdfColors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'ROLL NUMBER',
                              style: const pw.TextStyle(
                                fontSize: 8,
                                color: PdfColors.grey600,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              (admit['roll_no'] ?? '—').toString().toUpperCase(),
                              style: pw.TextStyle(
                                fontSize: 13,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  pw.SizedBox(height: 10),
                  pw.Divider(color: PdfColors.grey300, thickness: 1),
                  pw.SizedBox(height: 10),
                  pw.Row(
                    children: [
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'EXAM ROOM',
                              style: const pw.TextStyle(
                                fontSize: 8,
                                color: PdfColors.grey600,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              (admit['room_name'] ?? '—').toString().toUpperCase(),
                              style: pw.TextStyle(
                                fontSize: 13,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'BENCH',
                              style: const pw.TextStyle(
                                fontSize: 8,
                                color: PdfColors.grey600,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              'BENCH ${admit['bench_number'] ?? '—'}'.toUpperCase(),
                              style: pw.TextStyle(
                                fontSize: 13,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              'POSITION',
                              style: const pw.TextStyle(
                                fontSize: 8,
                                color: PdfColors.grey600,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              _getFullPositionName(admit['seat_position']?.toString() ?? '—').toUpperCase(),
                              style: pw.TextStyle(
                                fontSize: 13,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.black,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  pw.Spacer(),
                  pw.Divider(color: PdfColors.grey300, thickness: 1),
                  pw.SizedBox(height: 4),
                  pw.Center(
                    child: pw.Text(
                      'OFFICIAL ADMIT CARD',
                      style: const pw.TextStyle(
                        fontSize: 10,
                        color: PdfColors.grey500,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );

      final pdfBytes = await pdf.save();
      final timestamp = DateTime.now().millisecondsSinceEpoch.toString().substring(8);
      final defaultFilename = 'Admit_Card_${(admit['student_name'] ?? 'Student').toString().replaceAll(RegExp(r'\s+'), '_')}_$timestamp.pdf';
      
      String? savedPath;

      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          final savedUri = await platform.invokeMethod<String>(
            'saveFileToDownloads',
            {
              'fileName': defaultFilename,
              'bytes': pdfBytes,
            },
          );
          savedPath = savedUri;
        } catch (e) {
          debugPrint('MethodChannel save failed: $e');
          final appExternalDir = await getExternalStorageDirectory();
          if (appExternalDir != null) {
            final fallbackFile = File('${appExternalDir.path}/$defaultFilename');
            await fallbackFile.writeAsBytes(pdfBytes);
            savedPath = fallbackFile.path;
          }
        }
      } else {
        final appDocDir = await getApplicationDocumentsDirectory();
        final file = File('${appDocDir.path}/$defaultFilename');
        await file.writeAsBytes(pdfBytes);
        savedPath = file.path;
      }

      if (savedPath != null) {
        try {
          await NotificationHelper.showDownloadNotification(
            title: 'Admit Card Downloaded',
            fileName: defaultFilename,
            bytes: pdfBytes,
          );
        } catch (_) {}
        _showToast('Admit Card downloaded successfully');
      } else {
        _showErrorToast('Failed to download Admit Card.');
      }
    } catch (e) {
      _showErrorToast('Failed to download Admit Card: ${e.toString()}');
    } finally {
      setModalState(() {
        _isDownloading = false;
      });
    }
  }

  void _showAdmitCardModal() {
    final Map<String, dynamic>? admit = _details['admit_card'] != null 
        ? Map<String, dynamic>.from(_details['admit_card']) 
        : null;

    final String rawAcademicYear = admit != null ? (admit['academic_year'] ?? '2026-2027').toString() : '2026-2027';
    final String academicYear = rawAcademicYear
        .replaceAll('–', '-')
        .replaceAll('—', '-')
        .replaceAll('−', '-');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setModalState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.85,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Examination Admit Card',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
                ),
                const SizedBox(height: 8),
                Text(
                  widget.examName,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                ),
                const Divider(height: 24),
                Expanded(
                  child: admit == null
                      ? const Center(child: Text('No seating allocation details found.'))
                      : SingleChildScrollView(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            children: [
                              AspectRatio(
                                aspectRatio: 1.38,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(color: Colors.black, width: 3),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Center(
                                        child: Text(
                                          (admit['school_name'] ?? 'School Name').toString().toUpperCase(),
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w900,
                                            color: Colors.black,
                                            letterSpacing: 0.5,
                                          ),
                                          textAlign: TextAlign.center,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            widget.examName.toUpperCase(),
                                            style: const TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.black87,
                                            ),
                                          ),
                                          Text(
                                            'AY ${academicYear.toUpperCase()}',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.black87,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      const Divider(color: Colors.black, thickness: 2, height: 6),
                                      const SizedBox(height: 6),
                                      Text(
                                        'CANDIDATE NAME',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.grey.shade600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        (admit['student_name'] ?? 'STUDENT NAME').toString().toUpperCase(),
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.black,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'CLASS',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  (admit['class_name'] ?? 'CLASS').toString().toUpperCase(),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.black,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'ROLL NUMBER',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  (admit['roll_no'] ?? '—').toString().toUpperCase(),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.black,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Divider(color: Colors.grey.shade300, thickness: 1, height: 6),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'EXAM ROOM',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  (admit['room_name'] ?? '—').toString().toUpperCase(),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.black,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'BENCH',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  'BENCH ${admit['bench_number'] ?? '—'}'.toUpperCase(),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.black,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  'POSITION',
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  _getFullPositionName(admit['seat_position']?.toString() ?? '—').toUpperCase(),
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.black,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const Spacer(),
                                      Divider(color: Colors.grey.shade300, thickness: 1, height: 6),
                                      const SizedBox(height: 4),
                                      Center(
                                        child: Text(
                                          'OFFICIAL ADMIT CARD',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.grey.shade500,
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              ElevatedButton.icon(
                                onPressed: _isDownloading ? null : () => _downloadAdmitCardPDF(admit, setModalState),
                                icon: _isDownloading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.download_rounded),
                                label: Text(_isDownloading ? 'Downloading...' : 'Download Admit Card (PDF)'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.black,
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size.fromHeight(50),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.amber.shade200),
                                ),
                                child: Row(
                                  children: [
                                    Icon(Icons.info_outline_rounded, color: Colors.amber.shade800, size: 20),
                                    const SizedBox(width: 10),
                                    const Expanded(
                                      child: Text(
                                        'Please carry this admit card info. Verification will be done before entering the exam room.',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isHighlight ? 16 : 14,
            color: isHighlight ? Colors.indigo.shade800 : Colors.black87,
            fontWeight: isHighlight ? FontWeight.w900 : FontWeight.bold,
          ),
        ),
      ],
    );
  }

  void _showResultModal() {
    if (widget.userRole == 'TEACHER') {
      _showTeacherResultsModal();
    } else {
      _showStudentResultsModal();
    }
  }

  void _showStudentResultsModal() {
    final Map<String, dynamic> rcData = _details['report_card'] != null 
        ? Map<String, dynamic>.from(_details['report_card']) 
        : (_details['result'] != null ? _buildFallbackReportCardData(_details['result']) : {});

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setModalState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.88,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.workspace_premium_rounded, color: Colors.indigo.shade900, size: 24),
                    const SizedBox(width: 8),
                    const Text(
                      'Academic Report Card',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.black87),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  widget.examName,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                ),
                const Divider(height: 24),
                Expanded(
                  child: rcData.isEmpty
                      ? const Center(child: Text('No report card details found.'))
                      : SingleChildScrollView(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              // Formatted Report Card Container (Dynamic Active Template Match)
                              Builder(
                                builder: (context) {
                                  final String templateCode = (rcData['template_code'] ?? 'traditional').toString().toLowerCase();
                                  final theme = _getTemplateTheme(templateCode);
                                  final Color primaryColor = theme['primaryColor'] as Color;
                                  final Color cardBg = theme['cardBg'] as Color;
                                  final BoxBorder border = theme['border'] as BoxBorder;
                                  final String badgeTitle = theme['badgeTitle'] as String;

                                  final bool isFinalReport = (rcData['is_final_session_report'] == true) || 
                                      (rcData['badge_title']?.toString().toUpperCase() == 'FINAL ACADEMIC REPORT CARD') ||
                                      ((rcData['exam_name'] ?? widget.examName).toString().toLowerCase().contains('annual'));

                                  return Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: cardBg,
                                      borderRadius: BorderRadius.circular(16),
                                      border: border,
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.04),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                         // School Banner (Matching School Admin Modern Banner Header)
                                         Container(
                                           padding: const EdgeInsets.all(14),
                                           decoration: BoxDecoration(
                                             gradient: LinearGradient(
                                               colors: [Colors.teal.shade900, Colors.teal.shade800],
                                               begin: Alignment.topLeft,
                                               end: Alignment.bottomRight,
                                             ),
                                             borderRadius: BorderRadius.circular(12),
                                             border: Border.all(color: Colors.amber.shade400.withOpacity(0.4)),
                                           ),
                                           child: Row(
                                             crossAxisAlignment: CrossAxisAlignment.center,
                                             children: [
                                               // School Logo
                                               if (rcData['school_logo'] != null && rcData['school_logo'].toString().isNotEmpty)
                                                 ClipRRect(
                                                   borderRadius: BorderRadius.circular(10),
                                                   child: Image.network(
                                                     rcData['school_logo'].toString(),
                                                     width: 54,
                                                     height: 54,
                                                     fit: BoxFit.cover,
                                                     errorBuilder: (_, __, ___) => Container(
                                                       width: 54,
                                                       height: 54,
                                                       decoration: BoxDecoration(
                                                         color: Colors.amber.shade400,
                                                         borderRadius: BorderRadius.circular(10),
                                                       ),
                                                       child: Center(
                                                         child: Text(
                                                           (rcData['school_name'] ?? 'S').toString().isNotEmpty
                                                               ? (rcData['school_name'] ?? 'S').toString()[0].toUpperCase()
                                                               : 'S',
                                                           style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                                                         ),
                                                       ),
                                                     ),
                                                   ),
                                                 )
                                               else
                                                 Container(
                                                   width: 54,
                                                   height: 54,
                                                   decoration: BoxDecoration(
                                                     color: Colors.amber.shade400,
                                                     borderRadius: BorderRadius.circular(10),
                                                   ),
                                                   child: Center(
                                                     child: Text(
                                                       (rcData['school_name'] ?? 'S').toString().isNotEmpty
                                                           ? (rcData['school_name'] ?? 'S').toString()[0].toUpperCase()
                                                           : 'S',
                                                       style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                                                     ),
                                                   ),
                                                 ),
                                               const SizedBox(width: 12),
                                               // School Text Meta
                                               Expanded(
                                                 child: Column(
                                                   crossAxisAlignment: CrossAxisAlignment.start,
                                                   children: [
                                                     Text(
                                                       (rcData['school_name'] ?? 'SCHOOL NAME').toString().toUpperCase(),
                                                       style: TextStyle(
                                                         fontSize: 15,
                                                         fontWeight: FontWeight.w900,
                                                         color: Colors.amber.shade300,
                                                         letterSpacing: 0.2,
                                                       ),
                                                       maxLines: 1,
                                                       overflow: TextOverflow.ellipsis,
                                                     ),
                                                     if ((rcData['school_address'] ?? '').toString().isNotEmpty) ...[
                                                       const SizedBox(height: 2),
                                                       Text(
                                                         rcData['school_address'].toString(),
                                                         style: TextStyle(fontSize: 10, color: Colors.teal.shade50, fontWeight: FontWeight.w500),
                                                         maxLines: 1,
                                                         overflow: TextOverflow.ellipsis,
                                                       ),
                                                     ],
                                                     const SizedBox(height: 6),
                                                     Row(
                                                       children: [
                                                         Container(
                                                           padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                           decoration: BoxDecoration(
                                                             color: Colors.amber.shade400,
                                                             borderRadius: BorderRadius.circular(4),
                                                           ),
                                                           child: Text(
                                                             isFinalReport 
                                                                 ? 'FINAL ACADEMIC REPORT CARD'
                                                                 : (rcData['exam_name'] ?? widget.examName).toString().toUpperCase(),
                                                             style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                                                           ),
                                                         ),
                                                         const SizedBox(width: 8),
                                                         Text(
                                                           'Session: ${rcData['academic_year_name'] ?? '2026-2027'}',
                                                           style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white70),
                                                         ),
                                                       ],
                                                     ),
                                                   ],
                                                 ),
                                               ),
                                             ],
                                           ),
                                         ),
                                         const SizedBox(height: 14),

                                         // Student Details Grid (Exact matching Admin Portal structure with DOB & SR/Roll)
                                         Container(
                                           padding: const EdgeInsets.all(12),
                                           decoration: BoxDecoration(
                                             color: Colors.grey.shade50,
                                             borderRadius: BorderRadius.circular(10),
                                             border: Border.all(color: Colors.grey.shade300),
                                           ),
                                           child: Column(
                                             children: [
                                               Row(
                                                 children: [
                                                   Expanded(child: _buildStudentDetailCell('STUDENT NAME', (rcData['student_name'] ?? '').toString(), isBold: true)),
                                                   Expanded(child: _buildStudentDetailCell("FATHER'S NAME", (rcData['father_name'] ?? '—').toString(), isBold: true)),
                                                   Expanded(child: _buildStudentDetailCell("MOTHER'S NAME", (rcData['mother_name'] ?? '—').toString(), isBold: true)),
                                                 ],
                                               ),
                                               const SizedBox(height: 8),
                                               Row(
                                                 children: [
                                                   Expanded(child: _buildStudentDetailCell('CLASS & SECTION', '${rcData['class_name'] ?? ''} ${rcData['class_section'] != null ? '(${rcData['class_section']})' : ''}', isBold: true)),
                                                   Expanded(child: _buildStudentDetailCell('ROLL / SR NO', '${rcData['roll_no'] ?? '—'} | ${rcData['admission_no'] ?? '—'}', isBold: true)),
                                                   Expanded(child: _buildStudentDetailCell('DATE OF BIRTH', (rcData['dob'] ?? '—').toString(), isBold: true)),
                                                 ],
                                               ),
                                             ],
                                           ),
                                         ),
                                         const SizedBox(height: 16),

                                         // Scholastic Performance Marks Table
                                         if (isFinalReport)
                                           _buildFinalReportCardTable(rcData)
                                         else
                                           Container(
                                             decoration: BoxDecoration(
                                               borderRadius: BorderRadius.circular(8),
                                               border: Border.all(color: Colors.teal.shade900),
                                             ),
                                             child: Column(
                                               children: [
                                                 // Table Header
                                                 Container(
                                                   padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                   decoration: const BoxDecoration(
                                                     color: Color(0xFF042F2E),
                                                     borderRadius: BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(6)),
                                                   ),
                                                   child: const Row(
                                                     children: [
                                                       Expanded(flex: 3, child: Text('SUBJECT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                       Expanded(flex: 2, child: Text('OBTAINED', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                       Expanded(flex: 2, child: Text('MAX', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                       Expanded(flex: 2, child: Text('PASS', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                       Expanded(flex: 2, child: Text('GRADE', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                       Expanded(flex: 2, child: Text('VERDICT', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                                                     ],
                                                   ),
                                                 ),
                                                 // Table Rows
                                                 ...((rcData['subjects'] as List? ?? []).map((sub) {
                                                   final String sName = (sub['subject_name'] ?? '').toString();
                                                   final String maxM = (sub['max_marks'] ?? '-').toString();
                                                   final String passM = (sub['passing_marks'] ?? '-').toString();
                                                   final String obt = (sub['marks_obtained'] ?? '-').toString();
                                                   final String grade = (sub['grade'] ?? '-').toString();
                                                   final String res = (sub['result'] ?? 'PASS').toString().toUpperCase();
                                                   final bool isFail = res == 'FAIL';

                                                   return Container(
                                                     padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                     decoration: BoxDecoration(
                                                       border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
                                                     ),
                                                     child: Row(
                                                       children: [
                                                         Expanded(flex: 3, child: Text(sName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87))),
                                                         Expanded(flex: 2, child: Text(obt, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: isFail ? Colors.red.shade700 : Colors.teal.shade900))),
                                                         Expanded(flex: 2, child: Text(maxM, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.black87))),
                                                         Expanded(flex: 2, child: Text(passM, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.black54))),
                                                         Expanded(flex: 2, child: Text(grade, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isFail ? Colors.red.shade700 : Colors.teal.shade900))),
                                                         Expanded(
                                                           flex: 2,
                                                           child: Center(
                                                             child: Container(
                                                               padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                               decoration: BoxDecoration(
                                                                 color: isFail ? Colors.red.shade100 : Colors.teal.shade100,
                                                                 borderRadius: BorderRadius.circular(4),
                                                               ),
                                                               child: Text(
                                                                 res,
                                                                 style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: isFail ? Colors.red.shade900 : Colors.teal.shade900),
                                                               ),
                                                             ),
                                                           ),
                                                         ),
                                                       ],
                                                     ),
                                                   );
                                                 })).toList(),
                                               ],
                                             ),
                                           ),
                                         const SizedBox(height: 16),

                                         // Performance Summary Cards Row (5 columns matching Admin Portal)
                                         Row(
                                           children: [
                                             Expanded(child: _buildSummaryMetricCard('TOTAL MARKS', '${rcData['total_obtained'] ?? 0} / ${rcData['total_max'] ?? 0}', Colors.teal.shade50, const Color(0xFF042F2E))),
                                             const SizedBox(width: 4),
                                             Expanded(child: _buildSummaryMetricCard('PERCENTAGE', '${rcData['percentage'] ?? 0}%', Colors.amber.shade50, const Color(0xFF451A03))),
                                             const SizedBox(width: 4),
                                             Expanded(child: _buildSummaryMetricCard('OVERALL GRADE', 'Grade ${rcData['grade'] ?? 'A'}', Colors.teal.shade50, const Color(0xFF042F2E))),
                                             const SizedBox(width: 4),
                                             Expanded(child: _buildSummaryMetricCard('ATTENDANCE', '${rcData['attendance']?['attendance_rate'] ?? 100}%', Colors.amber.shade50, const Color(0xFF451A03))),
                                             const SizedBox(width: 4),
                                             Expanded(child: _buildSummaryMetricCard('CLASS RANK', '${(rcData['class_rank'] ?? '1').toString().split(' ')[0]}', Colors.teal.shade50, const Color(0xFF042F2E))),
                                           ],
                                         ),
                                         const SizedBox(height: 16),

                                         // Teacher Remarks (If exists)
                                         if (rcData['report_card_remark'] != null && rcData['report_card_remark'].toString().trim().isNotEmpty) ...[
                                           Padding(
                                             padding: const EdgeInsets.symmetric(horizontal: 4),
                                             child: RichText(
                                               text: TextSpan(
                                                 style: const TextStyle(fontSize: 11, color: Colors.black87),
                                                 children: [
                                                   const TextSpan(text: 'Teacher Remarks: ', style: TextStyle(fontWeight: FontWeight.bold)),
                                                   TextSpan(text: rcData['report_card_remark'].toString()),
                                                 ],
                                               ),
                                             ),
                                           ),
                                           const SizedBox(height: 16),
                                         ],

                                         // Footer Signatures Box
                                         Row(
                                           mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                           children: [
                                             Column(
                                               children: [
                                                 Container(width: 120, height: 1, color: Colors.grey.shade500),
                                                 const SizedBox(height: 4),
                                                 const Text('CLASS TEACHER SIGNATURE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.black87)),
                                               ],
                                             ),
                                             Column(
                                               children: [
                                                 Container(width: 120, height: 1, color: Colors.grey.shade500),
                                                 const SizedBox(height: 4),
                                                 const Text('PRINCIPAL SIGNATURE & STAMP', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.black87)),
                                               ],
                                             ),
                                           ],
                                         ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Map<String, dynamic> _buildFallbackReportCardData(Map<String, dynamic> result) {
    final List<dynamic> papers = result['papers'] ?? [];
    final double totalMax = double.tryParse((result['total_max_marks'] ?? 0.0).toString()) ?? 0.0;
    final double totalObt = double.tryParse((result['total_marks_obtained'] ?? 0.0).toString()) ?? 0.0;
    final double pct = totalMax > 0 ? (totalObt / totalMax * 100) : 0.0;

    return {
      'exam_name': widget.examName,
      'school_name': 'ACADEMIC INSTITUTION',
      'academic_year_name': '2026-2027',
      'student_name': 'STUDENT',
      'class_name': 'CLASS',
      'roll_no': '—',
      'father_name': '—',
      'mother_name': '—',
      'admission_no': '—',
      'subjects': papers.map((p) => {
        'subject_name': p['subject_name'] ?? 'Subject',
        'max_marks': p['max_marks'],
        'passing_marks': p['passing_marks'],
        'marks_obtained': p['is_absent'] == 1 ? 'ABSENT' : p['marks_obtained'],
        'grade': p['is_absent'] == 1 ? 'F' : 'A',
        'result': p['is_absent'] == 1 ? 'FAIL' : 'PASS',
      }).toList(),
      'total_max': totalMax,
      'total_obtained': totalObt,
      'percentage': pct.toStringAsFixed(1),
      'grade': pct >= 80 ? 'A' : (pct >= 60 ? 'B' : 'C'),
      'result': result['status']?.toUpperCase() ?? 'PASS',
      'class_rank': '1 of 1',
      'attendance': {'attendance_rate': 100},
    };
  }

  Widget _buildFinalReportCardTable(Map<String, dynamic> rcData) {
    final List<dynamic> subjects = (rcData['subjects'] as List?) ?? [];
    final List<dynamic> sessionExams = (rcData['session_exams'] as List?) ?? ['Quarterly Examination', 'Half Yearly Examination', 'Annual Examination'];

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF042F2E)),
      ),
      child: Column(
        children: [
          // Top Header Row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
            decoration: const BoxDecoration(
              color: Color(0xFF042F2E),
              borderRadius: BorderRadius.only(topLeft: Radius.circular(6), topRight: Radius.circular(6)),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    const Expanded(flex: 3, child: Text('SUBJECT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white))),
                    ...sessionExams.map((exName) {
                      final shortName = exName.toString().toUpperCase();
                      return Expanded(
                        flex: 4,
                        child: Text(
                          shortName,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    const Expanded(flex: 4, child: Text('GRAND TOTAL', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white))),
                    const Expanded(flex: 2, child: Text('GRADE', textAlign: TextAlign.center, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white))),
                  ],
                ),
                const SizedBox(height: 4),
                const Divider(color: Colors.white24, height: 1),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Expanded(flex: 3, child: SizedBox()),
                    ...sessionExams.map((_) {
                      return const Expanded(
                        flex: 4,
                        child: Row(
                          children: [
                            Expanded(child: Text('M.M.', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, color: Colors.amber, fontWeight: FontWeight.bold))),
                            Expanded(child: Text('OBT.', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, color: Colors.amber, fontWeight: FontWeight.bold))),
                          ],
                        ),
                      );
                    }).toList(),
                    const Expanded(
                      flex: 4,
                      child: Row(
                        children: [
                          Expanded(child: Text('MAX', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, color: Colors.amber, fontWeight: FontWeight.bold))),
                          Expanded(child: Text('OBT.', textAlign: TextAlign.center, style: TextStyle(fontSize: 8, color: Colors.amber, fontWeight: FontWeight.bold))),
                        ],
                      ),
                    ),
                    const Expanded(flex: 2, child: SizedBox()),
                  ],
                ),
              ],
            ),
          ),

          // Data Rows
          ...subjects.map((sub) {
            final String sName = (sub['subject_name'] ?? '').toString();
            final Map<String, dynamic> examScores = Map<String, dynamic>.from(sub['exam_scores'] ?? {});
            final String grandMax = (sub['grand_total_max'] ?? sub['max_marks'] ?? '-').toString();
            final String grandObt = (sub['grand_total_obtained'] ?? sub['marks_obtained'] ?? '-').toString();
            final String grade = (sub['grade'] ?? '-').toString();

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
              ),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Text(
                      sName,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
                    ),
                  ),
                  ...sessionExams.map((exName) {
                    final sc = examScores[exName] ?? examScores[exName.toString()];
                    final String mm = sc != null ? (sc['max_marks'] ?? '-').toString() : '100';
                    final String obt = sc != null ? (sc['marks_obtained'] ?? '-').toString() : '—';
                    final bool isAbs = sc != null && (sc['is_absent'] == true || obt == 'ABSENT');

                    return Expanded(
                      flex: 4,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              mm,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 10, color: Colors.black54),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              obt,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isAbs ? Colors.red.shade700 : Colors.teal.shade900,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                  Expanded(
                    flex: 4,
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            grandMax,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black87),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            grandObt,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.teal.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(
                      grade,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.teal.shade900),
                    ),
                  ),
                ],
              ),
            );
          }).toList(),

          // Total Marks Footer Row (matching Admin Portal report card)
          Builder(
            builder: (context) {
              final Map<String, dynamic> examTotalsMap = Map<String, dynamic>.from(rcData['exam_totals'] ?? {});
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.teal.shade50,
                  borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(6), bottomRight: Radius.circular(6)),
                  border: Border(top: BorderSide(color: Colors.teal.shade900, width: 1.5)),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      flex: 3,
                      child: Text(
                        'Total Marks',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                      ),
                    ),
                    ...sessionExams.map((exName) {
                      final exTot = Map<String, dynamic>.from(examTotalsMap[exName] ?? examTotalsMap[exName.toString()] ?? {});
                      return Expanded(
                        flex: 4,
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${exTot['max_marks'] ?? 0}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black87),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                '${exTot['marks_obtained'] ?? 0}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                    Expanded(
                      flex: 4,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${rcData['total_max'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              '${rcData['total_obtained'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        '${rcData['grade'] ?? '—'}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF042F2E)),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _getTemplateTheme(String templateCode) {
    switch (templateCode) {
      case 'modern':
        return {
          'primaryColor': Colors.indigo.shade900,
          'headerBg': Colors.indigo.shade900,
          'headerText': Colors.white,
          'border': Border.all(color: Colors.indigo.shade900, width: 2),
          'cardBg': Colors.indigo.shade50.withOpacity(0.3),
          'badgeTitle': 'MODERN ACADEMIC REPORT CARD',
        };
      case 'cbse_classic':
        return {
          'primaryColor': Colors.blue.shade900,
          'headerBg': Colors.blue.shade900,
          'headerText': Colors.white,
          'border': Border.all(color: Colors.blue.shade900, width: 2.5),
          'cardBg': Colors.white,
          'badgeTitle': 'CLASSIC CBSE REPORT CARD',
        };
      case 'primary_compact':
        return {
          'primaryColor': Colors.teal.shade900,
          'headerBg': Colors.teal.shade900,
          'headerText': Colors.white,
          'border': Border.all(color: Colors.teal.shade800, width: 2),
          'cardBg': Colors.teal.shade50.withOpacity(0.3),
          'badgeTitle': 'PRIMARY COMPACT REPORT CARD',
        };
      case 'traditional':
      default:
        return {
          'primaryColor': Colors.indigo.shade900,
          'headerBg': Colors.indigo.shade900,
          'headerText': Colors.white,
          'border': Border.all(color: Colors.indigo.shade900, width: 2.5),
          'cardBg': Colors.amber.shade50.withOpacity(0.2),
          'badgeTitle': 'OFFICIAL ACADEMIC REPORT CARD',
        };
    }
  }

  Widget _buildStudentDetailCell(String label, String value, {bool isBold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.grey.shade600)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(fontSize: isBold ? 11 : 10, fontWeight: isBold ? FontWeight.w900 : FontWeight.bold, color: Colors.black87),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildSummaryMetricCard(String label, String value, Color bg, Color textCol) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: textCol.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 7, fontWeight: FontWeight.bold, color: textCol)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: textCol)),
        ],
      ),
    );
  }

  Future<void> _downloadReportCardPDF(Map<String, dynamic> reportCard, StateSetter setModalState) async {
    setModalState(() {
      _isDownloading = true;
    });
    try {
      final pdf = pw.Document();

      final String schoolName = (reportCard['school_name'] ?? 'ACADEMIC INSTITUTION').toString().toUpperCase();
      final String examName = (reportCard['exam_name'] ?? widget.examName).toString();
      final String academicYear = (reportCard['academic_year_name'] ?? '2026-2027').toString();
      final String studentName = (reportCard['student_name'] ?? 'Student Name').toString().toUpperCase();
      final String className = (reportCard['class_name'] ?? '').toString();
      final String classSection = (reportCard['class_section'] ?? '').toString();
      final String fullClass = classSection.isNotEmpty ? '$className ($classSection)' : className;
      final String rollNo = (reportCard['roll_no'] ?? '-').toString();
      final String fatherName = (reportCard['father_name'] ?? '-').toString();
      final String motherName = (reportCard['mother_name'] ?? '-').toString();
      final String admissionNo = (reportCard['admission_no'] ?? '-').toString();
      final List<dynamic> subjects = reportCard['subjects'] as List? ?? [];
      final bool isPdfFinalReport = false;

      final double totalMax = double.tryParse((reportCard['total_max'] ?? reportCard['total_max_marks'] ?? 0.0).toString()) ?? 0.0;
      final double totalObtained = double.tryParse((reportCard['total_obtained'] ?? reportCard['total_marks_obtained'] ?? 0.0).toString()) ?? 0.0;
      final double percentage = double.tryParse((reportCard['percentage'] ?? 0.0).toString()) ?? (totalMax > 0 ? (totalObtained / totalMax * 100) : 0.0);
      final String grade = (reportCard['grade'] ?? 'F').toString();
      final String result = (reportCard['result'] ?? reportCard['status'] ?? 'PASS').toString().toUpperCase();
      final String classRank = (reportCard['class_rank'] ?? '1 of 1').toString();
      final String remark = (reportCard['report_card_remark'] ?? '').toString();
      final Map<String, dynamic> attendance = reportCard['attendance'] is Map ? Map<String, dynamic>.from(reportCard['attendance']) : {};
      final String attRate = '${attendance['attendance_rate'] ?? 100}%';

      final String schoolAddress = (reportCard['school_address'] ?? '').toString();
      final String schoolLogo = (reportCard['school_logo'] ?? '').toString();
      final String dob = (reportCard['dob'] ?? '-').toString();

      pw.MemoryImage? logoImage;
      if (schoolLogo.isNotEmpty) {
        try {
          final response = await http.get(Uri.parse(schoolLogo));
          if (response.statusCode == 200) {
            logoImage = pw.MemoryImage(response.bodyBytes);
          }
        } catch (_) {}
      }

      final int subCount = subjects.length;

      // Dynamic layout density scaling matching Web Report Card
      double cellPaddingV = 4.0;
      double headerPaddingV = 6.0;
      double tableFontSize = 8.5;
      double headerFontSize = 8.5;
      double sectionGap = 12.0;
      double infoPaddingV = 10.0;
      double summaryLabelSize = 7.0;
      double summaryValueSize = 11.0;
      double summaryPaddingV = 6.0;

      if (subCount <= 4) {
        // 4 or fewer subjects: Expanded rows & font sizes to fill A4 page naturally
        cellPaddingV = 22.0;
        headerPaddingV = 14.0;
        tableFontSize = 11.5;
        headerFontSize = 11.0;
        sectionGap = 24.0;
        infoPaddingV = 14.0;
        summaryLabelSize = 8.5;
        summaryValueSize = 14.0;
        summaryPaddingV = 10.0;
      } else if (subCount == 5) {
        cellPaddingV = 18.0;
        headerPaddingV = 12.0;
        tableFontSize = 11.0;
        headerFontSize = 10.5;
        sectionGap = 20.0;
        infoPaddingV = 13.0;
        summaryLabelSize = 8.0;
        summaryValueSize = 13.5;
        summaryPaddingV = 9.0;
      } else if (subCount == 6) {
        cellPaddingV = 14.0;
        headerPaddingV = 10.0;
        tableFontSize = 10.5;
        headerFontSize = 10.0;
        sectionGap = 18.0;
        infoPaddingV = 12.0;
        summaryLabelSize = 7.8;
        summaryValueSize = 13.0;
        summaryPaddingV = 8.0;
      } else if (subCount <= 8) {
        cellPaddingV = 10.0;
        headerPaddingV = 8.0;
        tableFontSize = 9.5;
        headerFontSize = 9.0;
        sectionGap = 15.0;
        infoPaddingV = 11.0;
        summaryLabelSize = 7.5;
        summaryValueSize = 12.0;
        summaryPaddingV = 7.0;
      }

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          build: (pw.Context context) {
            return pw.Container(
              height: double.infinity,
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColor.fromHex('#042F2E'), width: 2),
                borderRadius: pw.BorderRadius.circular(10),
              ),
              padding: const pw.EdgeInsets.all(16),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // School Banner Header
                  pw.Container(
                    padding: const pw.EdgeInsets.all(12),
                    decoration: pw.BoxDecoration(
                      color: PdfColor.fromHex('#042F2E'),
                      borderRadius: pw.BorderRadius.circular(8),
                    ),
                    child: pw.Row(
                      children: [
                        pw.Container(
                          width: 52,
                          height: 52,
                          decoration: pw.BoxDecoration(
                            borderRadius: pw.BorderRadius.circular(8),
                            color: PdfColors.amber400,
                          ),
                          padding: const pw.EdgeInsets.all(4),
                          child: logoImage != null
                              ? pw.Image(logoImage, fit: pw.BoxFit.contain)
                              : pw.Center(
                                  child: pw.Text(
                                    schoolName.isNotEmpty ? schoolName[0] : 'S',
                                    style: pw.TextStyle(
                                      fontSize: 26,
                                      fontWeight: pw.FontWeight.bold,
                                      color: PdfColor.fromHex('#042F2E'),
                                    ),
                                  ),
                                ),
                        ),
                        pw.SizedBox(width: 12),
                        pw.Expanded(
                          child: pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text(
                                schoolName,
                                style: pw.TextStyle(
                                  fontSize: 17,
                                  fontWeight: pw.FontWeight.bold,
                                  color: PdfColors.amber300,
                                ),
                              ),
                              if (schoolAddress.isNotEmpty) ...[
                                pw.SizedBox(height: 2),
                                pw.Text(
                                  schoolAddress,
                                  style: const pw.TextStyle(fontSize: 9.5, color: PdfColors.teal100),
                                ),
                              ],
                              pw.SizedBox(height: 5),
                              pw.Row(
                                children: [
                                  pw.Container(
                                    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: pw.BoxDecoration(
                                      color: PdfColors.amber400,
                                      borderRadius: pw.BorderRadius.circular(4),
                                    ),
                                    child: pw.Text(
                                      (isPdfFinalReport ? 'FINAL ACADEMIC REPORT CARD' : examName).toUpperCase(),
                                      style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#042F2E')),
                                    ),
                                  ),
                                  pw.SizedBox(width: 10),
                                  pw.Text(
                                    'Session: $academicYear',
                                    style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  pw.SizedBox(height: sectionGap),

                  // Student Details Grid
                  pw.Container(
                    padding: pw.EdgeInsets.symmetric(horizontal: 12, vertical: infoPaddingV),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey100,
                      borderRadius: pw.BorderRadius.circular(8),
                      border: pw.Border.all(color: PdfColors.grey300),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Row(
                          children: [
                            pw.Expanded(child: _pdfInfoCell('STUDENT NAME', studentName, isBold: true)),
                            pw.Expanded(child: _pdfInfoCell("FATHER'S NAME", fatherName, isBold: true)),
                            pw.Expanded(child: _pdfInfoCell("MOTHER'S NAME", motherName, isBold: true)),
                          ],
                        ),
                        pw.SizedBox(height: 8),
                        pw.Row(
                          children: [
                            pw.Expanded(child: _pdfInfoCell('CLASS & SECTION', fullClass, isBold: true)),
                            pw.Expanded(child: _pdfInfoCell('ROLL / SR NO', '$rollNo | $admissionNo', isBold: true)),
                            pw.Expanded(child: _pdfInfoCell('DATE OF BIRTH', dob, isBold: true)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  pw.SizedBox(height: sectionGap),

                  // Marks Table (Exact Matching Image 2 Web PDF layout)
                  if (isPdfFinalReport)
                    pw.Table(
                      border: pw.TableBorder.all(color: PdfColor.fromHex('#042F2E')),
                      columnWidths: {
                        0: const pw.FlexColumnWidth(3.2), // SUBJECT
                        1: const pw.FlexColumnWidth(1.4), // Q1 MM
                        2: const pw.FlexColumnWidth(1.4), // Q1 OBT
                        3: const pw.FlexColumnWidth(1.4), // HY MM
                        4: const pw.FlexColumnWidth(1.4), // HY OBT
                        5: const pw.FlexColumnWidth(1.4), // AN MM
                        6: const pw.FlexColumnWidth(1.4), // AN OBT
                        7: const pw.FlexColumnWidth(1.6), // GRAND MAX
                        8: const pw.FlexColumnWidth(1.6), // GRAND OBT
                        9: const pw.FlexColumnWidth(1.4), // GRADE
                      },
                      children: [
                        // Header Row 1
                        pw.TableRow(
                          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#042F2E')),
                          children: [
                            _pdfTableHeaderCell('SUBJECT', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            ...((reportCard['session_exams'] as List? ?? ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map((ex) {
                              return pw.Container(
                                padding: pw.EdgeInsets.symmetric(vertical: headerPaddingV, horizontal: 2),
                                alignment: pw.Alignment.center,
                                child: pw.Text(
                                  ex.toString().toUpperCase().replaceAll('EXAMINATION', 'EXAM'),
                                  textAlign: pw.TextAlign.center,
                                  style: pw.TextStyle(color: PdfColors.white, fontSize: headerFontSize - 1.5, fontWeight: pw.FontWeight.bold),
                                ),
                              );
                            })),
                            pw.Container(
                              padding: pw.EdgeInsets.symmetric(vertical: headerPaddingV, horizontal: 2),
                              alignment: pw.Alignment.center,
                              child: pw.Text('GRAND TOTAL', textAlign: pw.TextAlign.center, style: pw.TextStyle(color: PdfColors.white, fontSize: headerFontSize - 1.5, fontWeight: pw.FontWeight.bold)),
                            ),
                            _pdfTableHeaderCell('GRADE', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                          ],
                        ),
                        // Header Row 2 (M.M. and OBT.)
                        pw.TableRow(
                          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#033E3B')),
                          children: [
                            _pdfTableHeaderCell('', verticalPadding: 3, fontSize: 7),
                            ...((reportCard['session_exams'] as List? ?? ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).expand((_) => [
                              _pdfTableHeaderCell('M.M.', verticalPadding: 3, fontSize: 7.5, color: PdfColors.amber300),
                              _pdfTableHeaderCell('OBT.', verticalPadding: 3, fontSize: 7.5, color: PdfColors.amber300),
                            ])),
                            _pdfTableHeaderCell('MAX', verticalPadding: 3, fontSize: 7.5, color: PdfColors.amber300),
                            _pdfTableHeaderCell('OBT.', verticalPadding: 3, fontSize: 7.5, color: PdfColors.amber300),
                            _pdfTableHeaderCell('', verticalPadding: 3, fontSize: 7),
                          ],
                        ),
                        // Data Rows
                        ...subjects.map((sub) {
                          final String sName = (sub['subject_name'] ?? '').toString();
                          final Map<String, dynamic> examScores = Map<String, dynamic>.from(sub['exam_scores'] ?? {});
                          final String grandMax = (sub['grand_total_max'] ?? sub['max_marks'] ?? '-').toString();
                          final String grandObt = (sub['grand_total_obtained'] ?? sub['marks_obtained'] ?? '-').toString();
                          final String sGrade = (sub['grade'] ?? '-').toString();
                          final List<dynamic> sessionExams = (reportCard['session_exams'] as List?) ?? ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam'];

                          return pw.TableRow(
                            children: [
                              _pdfTableCell(sName, alignLeft: true, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              ...sessionExams.expand((exName) {
                                final sc = examScores[exName] ?? examScores[exName.toString()];
                                final String mm = sc != null ? (sc['max_marks'] ?? '-').toString() : '100';
                                final String obt = sc != null ? (sc['marks_obtained'] ?? '-').toString() : '-';
                                return [
                                  _pdfTableCell(mm, isBold: false, color: PdfColors.grey700, verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                                  _pdfTableCell(obt, isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                                ];
                              }),
                              _pdfTableCell(grandMax, isBold: true, color: PdfColors.grey900, verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                              _pdfTableCell(grandObt, isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                              _pdfTableCell(sGrade, isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize),
                            ],
                          );
                        }).toList(),
                        // Total Marks Footer Row
                        pw.TableRow(
                          decoration: const pw.BoxDecoration(color: PdfColors.teal50),
                          children: [
                            _pdfTableCell('Total Marks', alignLeft: true, isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize),
                            ...((reportCard['session_exams'] as List? ?? ['Quarterly Examination', 'Half Yearly Examination', 'Annual Examination']).expand((exName) {
                              final Map<String, dynamic> examTotalsMap = Map<String, dynamic>.from(reportCard['exam_totals'] ?? {});
                              final exTot = Map<String, dynamic>.from(examTotalsMap[exName] ?? examTotalsMap[exName.toString()] ?? {});
                              final String exMax = (exTot['max_marks'] ?? 0).toString();
                              final String exObt = (exTot['marks_obtained'] ?? 0).toString();
                              return [
                                _pdfTableCell(exMax, isBold: true, color: PdfColors.grey900, verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                                _pdfTableCell(exObt, isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                              ];
                            })),
                            _pdfTableCell('${reportCard['total_max'] ?? 0}', isBold: true, color: PdfColors.grey900, verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                            _pdfTableCell('${reportCard['total_obtained'] ?? 0}', isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize - 0.5),
                            _pdfTableCell('${reportCard['grade'] ?? '—'}', isBold: true, color: PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize),
                          ],
                        ),
                      ],
                    )
                  else
                    pw.Table(
                      border: pw.TableBorder.all(color: PdfColors.grey400),
                      children: [
                        // Header Row
                        pw.TableRow(
                          decoration: pw.BoxDecoration(color: PdfColor.fromHex('#042F2E')),
                          children: [
                            _pdfTableHeaderCell('SUBJECT', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            _pdfTableHeaderCell('OBTAINED', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            _pdfTableHeaderCell('MAX', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            _pdfTableHeaderCell('PASS', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            _pdfTableHeaderCell('GRADE', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                            _pdfTableHeaderCell('VERDICT', verticalPadding: headerPaddingV, fontSize: headerFontSize),
                          ],
                        ),
                        // Data Rows
                        ...subjects.map((sub) {
                          final String sName = (sub['subject_name'] ?? '').toString();
                          final String maxM = (sub['max_marks'] ?? '-').toString();
                          final String passM = (sub['passing_marks'] ?? '-').toString();
                          final String obt = (sub['marks_obtained'] ?? '-').toString();
                          final String sGrade = (sub['grade'] ?? '-').toString();
                          final String sRes = (sub['result'] ?? (sub['is_absent'] == 1 ? 'FAIL' : 'PASS')).toString().toUpperCase();
                          final bool isFail = sRes == 'FAIL';

                          return pw.TableRow(
                            children: [
                              _pdfTableCell(sName, alignLeft: true, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              _pdfTableCell(obt, isBold: true, color: isFail ? PdfColors.red700 : PdfColor.fromHex('#042F2E'), verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              _pdfTableCell(maxM, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              _pdfTableCell(passM, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              _pdfTableCell(sGrade, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                              _pdfTableCell(sRes, color: isFail ? PdfColors.red700 : PdfColor.fromHex('#042F2E'), isBold: true, verticalPadding: cellPaddingV, fontSize: tableFontSize),
                            ],
                          );
                        }).toList(),
                      ],
                    ),
                  pw.SizedBox(height: sectionGap),

                  // Summary Cards Row
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      _pdfSummaryBox('TOTAL MARKS', '${totalObtained.toStringAsFixed(0)} / ${totalMax.toStringAsFixed(0)}', PdfColors.teal50, PdfColor.fromHex('#042F2E'), labelFontSize: summaryLabelSize, valueFontSize: summaryValueSize, verticalPadding: summaryPaddingV),
                      _pdfSummaryBox('PERCENTAGE', '${percentage.toStringAsFixed(1)}%', PdfColors.amber50, PdfColors.amber900, labelFontSize: summaryLabelSize, valueFontSize: summaryValueSize, verticalPadding: summaryPaddingV),
                      _pdfSummaryBox('OVERALL GRADE', 'Grade $grade', PdfColors.teal50, PdfColor.fromHex('#042F2E'), labelFontSize: summaryLabelSize, valueFontSize: summaryValueSize, verticalPadding: summaryPaddingV),
                      _pdfSummaryBox('ATTENDANCE', attRate, PdfColors.amber50, PdfColors.amber900, labelFontSize: summaryLabelSize, valueFontSize: summaryValueSize, verticalPadding: summaryPaddingV),
                      _pdfSummaryBox('CLASS RANK', classRank.split(' ')[0], PdfColors.teal50, PdfColor.fromHex('#042F2E'), labelFontSize: summaryLabelSize, valueFontSize: summaryValueSize, verticalPadding: summaryPaddingV),
                    ],
                  ),
                  pw.SizedBox(height: 12),

                  if (remark.isNotEmpty) ...[
                    pw.Container(
                      width: double.infinity,
                      padding: const pw.EdgeInsets.all(8),
                      decoration: pw.BoxDecoration(
                        color: PdfColors.grey50,
                        border: pw.Border.all(color: PdfColors.grey300),
                        borderRadius: pw.BorderRadius.circular(4),
                      ),
                      child: pw.Text('Remarks: $remark', style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.grey800)),
                    ),
                    pw.SizedBox(height: 12),
                  ],

                  pw.Spacer(),

                  // Signatures Footer
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Column(
                        children: [
                          pw.SizedBox(height: 38), // Increased blank space by 35% for physical stamp & signature
                          pw.Container(width: 140, height: 1, color: PdfColors.black),
                          pw.SizedBox(height: 4),
                          pw.Text('CLASS TEACHER SIGNATURE', style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: PdfColors.grey700)),
                        ],
                      ),
                      pw.Column(
                        children: [
                          pw.SizedBox(height: 38), // Increased blank space by 35% for physical stamp & signature
                          pw.Container(width: 140, height: 1, color: PdfColors.black),
                          pw.SizedBox(height: 4),
                          pw.Text('PRINCIPAL SIGNATURE & STAMP', style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: PdfColors.grey700)),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      );

      final pdfBytes = await pdf.save();
      final timestamp = DateTime.now().millisecondsSinceEpoch.toString().substring(8);
      final defaultFilename = 'Report_Card_${studentName.replaceAll(RegExp(r'\s+'), '_')}_$timestamp.pdf';

      String? savedPath;

      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          final savedUri = await platform.invokeMethod<String>(
            'saveFileToDownloads',
            {
              'fileName': defaultFilename,
              'bytes': pdfBytes,
            },
          );
          savedPath = savedUri;
        } catch (e) {
          debugPrint('MethodChannel save failed: $e');
          final appExternalDir = await getExternalStorageDirectory();
          if (appExternalDir != null) {
            final fallbackFile = File('${appExternalDir.path}/$defaultFilename');
            await fallbackFile.writeAsBytes(pdfBytes);
            savedPath = fallbackFile.path;
          }
        }
      } else {
        final appDocDir = await getApplicationDocumentsDirectory();
        final file = File('${appDocDir.path}/$defaultFilename');
        await file.writeAsBytes(pdfBytes);
        savedPath = file.path;
      }

      if (savedPath != null) {
        try {
          await NotificationHelper.showDownloadNotification(
            title: 'Report Card Downloaded',
            fileName: defaultFilename,
            bytes: pdfBytes,
          );
        } catch (_) {}
        _showToast('Report Card downloaded successfully');
      } else {
        _showErrorToast('Failed to download Report Card.');
      }
    } catch (e) {
      _showErrorToast('Failed to download Report Card: ${e.toString()}');
    } finally {
      setModalState(() {
        _isDownloading = false;
      });
    }
  }

  pw.Widget _pdfInfoCell(String label, String value, {bool isBold = false}) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey600)),
        pw.SizedBox(height: 2),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontSize: isBold ? 10.5 : 9.5,
            fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
            color: PdfColors.black,
          ),
        ),
      ],
    );
  }

  pw.Widget _pdfTableHeaderCell(String text, {double verticalPadding = 4, double fontSize = 8, PdfColor? color}) {
    return pw.Padding(
      padding: pw.EdgeInsets.symmetric(horizontal: 4, vertical: verticalPadding),
      child: pw.Text(
        text,
        style: pw.TextStyle(fontSize: fontSize, fontWeight: pw.FontWeight.bold, color: color ?? PdfColors.white),
        textAlign: pw.TextAlign.center,
      ),
    );
  }

  pw.Widget _pdfTableCell(String text, {bool alignLeft = false, bool isBold = false, PdfColor? color, double verticalPadding = 3, double fontSize = 8}) {
    return pw.Padding(
      padding: pw.EdgeInsets.symmetric(horizontal: 6, vertical: verticalPadding),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: fontSize,
          fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: color ?? PdfColors.black,
        ),
        textAlign: alignLeft ? pw.TextAlign.left : pw.TextAlign.center,
      ),
    );
  }

  pw.Widget _pdfSummaryBox(String label, String value, PdfColor bg, PdfColor textCol, {double labelFontSize = 7, double valueFontSize = 11, double verticalPadding = 6}) {
    return pw.Container(
      width: 92,
      padding: pw.EdgeInsets.symmetric(vertical: verticalPadding, horizontal: 4),
      decoration: pw.BoxDecoration(
        color: bg,
        borderRadius: pw.BorderRadius.circular(6),
        border: pw.Border.all(color: textCol, width: 0.5),
      ),
      child: pw.Column(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: labelFontSize, fontWeight: pw.FontWeight.bold, color: textCol)),
          pw.SizedBox(height: 3),
          pw.Text(value, style: pw.TextStyle(fontSize: valueFontSize, fontWeight: pw.FontWeight.bold, color: textCol)),
        ],
      ),
    );
  }

  void _showTeacherResultsModal() {
    final List<dynamic> studentsResults = _details['result'] ?? [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Class Performance Summary',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: studentsResults.isEmpty
                  ? const Center(child: Text('No student performance records found.'))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: studentsResults.length,
                      itemBuilder: (context, index) {
                        final stRes = studentsResults[index];
                        final name = stRes['student_name'] ?? 'Student';
                        final roll = stRes['roll_number']?.toString() ?? '—';
                        final obt = stRes['total_marks_obtained'];
                        final max = stRes['total_max_marks'];
                        final status = stRes['status'] ?? 'Pass';
                        final List<dynamic> papers = stRes['papers'] ?? [];

                        final isPass = status.toUpperCase() == 'PASS';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: ExpansionTile(
                            tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            title: Text(
                              name,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Text(
                                'Roll No: $roll  |  Total: $obt / $max',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                              ),
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: isPass ? Colors.green.shade50 : Colors.red.shade50,
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: isPass ? Colors.green.shade200 : Colors.red.shade200),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: isPass ? Colors.green.shade700 : Colors.red.shade700,
                                ),
                              ),
                            ),
                            children: [
                              Container(
                                color: Colors.grey.shade50,
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'SUBJECT MARKS BREAKDOWN',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 8),
                                    ...papers.map((p) {
                                      final isAbs = p['is_absent'] == 1;
                                      final pObt = p['marks_obtained'];
                                      final pMax = p['max_marks'];
                                      final pPass = p['passing_marks'];
                                      final pPassFlag = !isAbs && pObt != null && pObt >= pPass;

                                      return Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              p['subject_name'] ?? '',
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black87),
                                            ),
                                            Text(
                                              isAbs ? 'ABSENT' : '$pObt / $pMax  (${pPassFlag ? 'Pass' : 'Fail'})',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w900,
                                                color: isAbs 
                                                    ? Colors.red.shade700 
                                                    : (pPassFlag ? Colors.green.shade700 : Colors.red.shade700),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ],
                                ),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool schemePub = _details['scheme_published'] == 1;
    final bool admitPub = _details['admit_card_published'] == 1;
    final bool resultPub = _details['result_published'] == 1;
    final bool hasPapers = (_details['has_papers'] == 1) || (_details['scheme'] is List && (_details['scheme'] as List).isNotEmpty);
    
    final bool admitCardRestricted = _details['admit_card_restricted'] == true;
    final bool resultRestricted = _details['result_restricted'] == true;
    final double outstandingDue = double.tryParse(_details['outstanding_due']?.toString() ?? '0') ?? 0.0;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          widget.examName,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.indigo.shade800,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? (() {
                  final isNoClass = _errorMessage!.contains('No class') || _errorMessage!.contains('Class Teacher') || _errorMessage!.contains('assigned');
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade50,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              isNoClass ? Icons.assignment_ind_outlined : Icons.error_outline_rounded,
                              size: 48,
                              color: isNoClass ? Colors.amber.shade800 : Colors.red.shade400,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            isNoClass ? 'No class Assigned to you yet' : _errorMessage!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 17, color: Colors.black87, fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            isNoClass
                                ? 'Please contact school administrator to assign a class to your teacher profile.'
                                : 'An error occurred while loading examination details.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                          ),
                          if (!isNoClass) ...[
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: _loadDetails,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.indigo.shade700,
                                foregroundColor: Colors.white,
                              ),
                              child: const Text('Try Again'),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                })()
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      'Examination Components',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.indigo.shade900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 1. Exam Scheme Card (Always accessible)
                    _buildFeatureCard(
                      title: 'Exam Scheme',
                      subtitle: schemePub ? 'View examination timetable scheme' : 'Not Published Yet',
                      icon: Icons.calendar_month_rounded,
                      isPublished: schemePub,
                      disabledMessage: 'Examination scheme is not published yet.',
                      onTap: _showSchemeModal,
                    ),

                    // 1b. Enter Marks Card (TEACHER only - Requires papers added)
                    if (widget.userRole == 'TEACHER')
                      _buildFeatureCard(
                        title: 'Enter Marks',
                        subtitle: hasPapers ? 'Input student marks for assigned class' : 'No Papers Added Yet',
                        icon: Icons.edit_note_rounded,
                        isPublished: hasPapers,
                        disabledMessage: 'No papers have been added for this examination yet.',
                        onTap: _showEnterMarksModal,
                      ),

                    // 2. Admit Card Card (STUDENT/PARENT only)
                    if (widget.userRole != 'TEACHER')
                      _buildFeatureCard(
                        title: 'Admit Card',
                        subtitle: admitPub ? 'View room & seat allocations' : 'Not Published Yet',
                        icon: Icons.badge_rounded,
                        isPublished: admitPub,
                        disabledMessage: 'Admit card is not published yet.',
                        onTap: admitCardRestricted
                            ? () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => DueRestrictionScreen(
                                      title: 'Admit Card Temporarily Unavailable',
                                      message: 'Your admit card is temporarily unavailable because your outstanding fee amount is higher than the limit set by the school. Please clear the pending dues or contact the school office to access your admit card.',
                                      outstandingDue: outstandingDue,
                                      baseUrl: widget.examService.baseUrl,
                                      token: widget.examService.token,
                                      studentId: widget.studentId,
                                    ),
                                  ),
                                );
                              }
                            : _showAdmitCardModal,
                      ),

                    // 3. Result Card (STUDENT/PARENT only - Hidden for Teachers to protect fee dues compliance)
                    if (widget.userRole != 'TEACHER')
                      _buildFeatureCard(
                        title: 'Exam Result',
                        subtitle: resultPub ? 'View your report card' : 'Not Published Yet',
                        icon: Icons.workspace_premium_rounded,
                        isPublished: resultPub,
                        disabledMessage: 'Report card is not published yet.',
                        onTap: resultRestricted
                            ? () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => DueRestrictionScreen(
                                      title: 'Exam Result Temporarily Unavailable',
                                      message: 'Your exam result is temporarily unavailable because your outstanding fee amount is higher than the limit set by the school. Please clear the pending dues or contact the school office for assistance.',
                                      outstandingDue: outstandingDue,
                                      baseUrl: widget.examService.baseUrl,
                                      token: widget.examService.token,
                                      studentId: widget.studentId,
                                    ),
                                  ),
                                );
                              }
                            : _showResultModal,
                      ),
                  ],
                ),
    );
  }

  Widget _buildFeatureCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isPublished,
    required VoidCallback onTap,
    String? disabledMessage,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isPublished ? Colors.white : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPublished ? Colors.indigo.shade50 : Colors.grey.shade200,
          width: 1.5,
        ),
        boxShadow: isPublished
            ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            if (isPublished) {
              onTap();
            } else if (disabledMessage != null && disabledMessage.isNotEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(disabledMessage),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: isPublished ? Colors.indigo.shade50 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    icon,
                    color: isPublished ? Colors.indigo.shade800 : Colors.grey.shade400,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: isPublished ? Colors.black87 : Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isPublished ? Colors.indigo.shade600 : Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isPublished ? Icons.arrow_forward_ios_rounded : Icons.lock_outline_rounded,
                  color: isPublished ? Colors.indigo.shade800 : Colors.grey.shade400,
                  size: 16,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MaxValueTextInputFormatter extends TextInputFormatter {
  final double maxValue;
  MaxValueTextInputFormatter(this.maxValue);

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }
    final double? value = double.tryParse(newValue.text);
    if (value == null) {
      return oldValue;
    }
    if (value > maxValue) {
      return oldValue;
    }
    return newValue;
  }
}
