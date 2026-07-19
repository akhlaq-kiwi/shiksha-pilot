import 'package:flutter/material.dart';
import 'package:school_hub/services/exam_service.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';

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
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
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
              child: scheme.isEmpty
                  ? const Center(child: Text('No timetable entries found.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: scheme.length,
                      itemBuilder: (context, index) {
                        final paper = scheme[index];
                        final sub = paper['subject_name'] ?? 'Subject';
                        final date = paper['exam_date'] ?? '';
                        final start = paper['start_time'] ?? '';
                        final end = paper['end_time'] ?? '';
                        final maxM = paper['max_marks']?.toString() ?? '100';
                        final passM = paper['passing_marks']?.toString() ?? '33';
                        final room = paper['room'] ?? 'As scheduled';

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
                                children: [
                                  Text(
                                    'Date: ',
                                    style: TextStyle(fontSize: 13, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    _formatDate(date),
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 20),
                                  Text(
                                    'Time: ',
                                    style: TextStyle(fontSize: 13, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    '${_formatTime(start)} - ${_formatTime(end)}',
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
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
                                  Text(
                                    '${_formatMarks(maxM)} Marks',
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 20),
                                  Text(
                                    'Pass: ',
                                    style: TextStyle(fontSize: 12, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    '${_formatMarks(passM)} Marks',
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
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
        _showToast('Downloaded successfully');
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
    final Map<String, dynamic>? result = _details['result'] != null 
        ? Map<String, dynamic>.from(_details['result']) 
        : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
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
              'Examination Report Card',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: result == null
                  ? const Center(child: Text('No result records found.'))
                  : Column(
                      children: [
                        // Summary Card
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: result['status']?.toUpperCase() == 'PASS'
                                  ? [Colors.green.shade700, Colors.green.shade900]
                                  : [Colors.red.shade700, Colors.red.shade900],
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'GRAND TOTAL',
                                    style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${result['total_marks_obtained']} / ${result['total_max_marks']}',
                                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                child: Text(
                                  result['status']?.toUpperCase() ?? 'FAIL',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'SUBJECT DETAILS',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.grey),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: (result['papers'] as List).length,
                            itemBuilder: (context, index) {
                              final paper = result['papers'][index];
                              final sub = paper['subject_name'] ?? '';
                              final obt = paper['marks_obtained'];
                              final max = paper['max_marks'];
                              final pass = paper['passing_marks'];
                              final isAbs = paper['is_absent'] == 1;

                              final isPassed = !isAbs && obt != null && obt >= pass;

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.grey.shade200),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            sub,
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black87),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Passing Marks: $pass',
                                            style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          isAbs ? 'ABSENT' : '$obt / $max',
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w900,
                                            color: isAbs 
                                                ? Colors.red.shade700 
                                                : (isPassed ? Colors.green.shade700 : Colors.red.shade700),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          isAbs ? 'Fail' : (isPassed ? 'Pass' : 'Fail'),
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: isAbs 
                                                ? Colors.red.shade700 
                                                : (isPassed ? Colors.green.shade600 : Colors.red.shade600),
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
          ],
        ),
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
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline_rounded, size: 64, color: Colors.red.shade400),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 16, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                        ),
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
                    ),
                  ),
                )
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

                    // 1. Exam Scheme Card
                    _buildFeatureCard(
                      title: 'Exam Scheme',
                      subtitle: schemePub ? 'View examination timetable scheme' : 'Not Published Yet',
                      icon: Icons.calendar_month_rounded,
                      isPublished: schemePub,
                      onTap: _showSchemeModal,
                    ),

                    // 2. Admit Card Card (STUDENT/PARENT only)
                    if (widget.userRole != 'TEACHER')
                      _buildFeatureCard(
                        title: 'Admit Card',
                        subtitle: admitPub ? 'View room & seat allocations' : 'Not Published Yet',
                        icon: Icons.badge_rounded,
                        isPublished: admitPub,
                        onTap: _showAdmitCardModal,
                      ),

                    // 3. Result Card
                    _buildFeatureCard(
                      title: widget.userRole == 'TEACHER' ? 'Student Results' : 'Exam Result',
                      subtitle: resultPub 
                          ? (widget.userRole == 'TEACHER' ? 'View class performance breakdown' : 'View your report card')
                          : 'Not Published Yet',
                      icon: Icons.workspace_premium_rounded,
                      isPublished: widget.userRole == 'TEACHER' ? true : resultPub,
                      onTap: _showResultModal,
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
          onTap: isPublished ? onTap : null,
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
