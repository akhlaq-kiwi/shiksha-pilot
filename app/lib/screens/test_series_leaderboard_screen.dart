import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:school_hub/services/notification_helper.dart';
import '../constants/app_colors.dart';
import '../services/test_series_service.dart';
import '../widgets/test_series_shared.dart';
import 'full_screen_image_screen.dart';

class TestSeriesLeaderboardScreen extends StatefulWidget {
  final TestSeriesService service;
  final int testSeriesId;
  final bool isTeacherOrPrincipal;
  final int? studentId;
  final String? initialTitle;

  const TestSeriesLeaderboardScreen({
    super.key,
    required this.service,
    required this.testSeriesId,
    required this.isTeacherOrPrincipal,
    this.studentId,
    this.initialTitle,
  });

  @override
  State<TestSeriesLeaderboardScreen> createState() =>
      _TestSeriesLeaderboardScreenState();
}

class _TestSeriesLeaderboardScreenState
    extends State<TestSeriesLeaderboardScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String _error = '';

  Map<String, dynamic> _series = {};
  bool _isClosed = false;
  int _totalParticipants = 0;
  List<Map<String, dynamic>> _toppers = [];
  List<Map<String, dynamic>> _leaderboard = [];
  Map<String, dynamic>? _myResult;
  List<Map<String, dynamic>> _answerReview = [];
  String _effectiveBaseUrl = '';

  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    _effectiveBaseUrl = widget.service.baseUrl;
    _loadData();
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  String _resolveUrl(String? raw) {
    if (raw == null || raw.trim().isEmpty) return '';
    final val = raw.trim();
    if (val.startsWith('http://') || val.startsWith('https://')) {
      return val;
    }
    final cleanBase = (_effectiveBaseUrl.isNotEmpty
            ? _effectiveBaseUrl
            : widget.service.baseUrl)
        .replaceAll(RegExp(r'/+$'), '');
    final cleanPath = val.startsWith('/') ? val : '/$val';
    return '$cleanBase$cleanPath';
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      try {
        final prefs = await SharedPreferences.getInstance();
        final saved = (prefs.getString('base_url') ?? '').trim();
        if (saved.isNotEmpty && saved.startsWith('http')) {
          _effectiveBaseUrl = saved;
        }
      } catch (_) {}

      final res = widget.isTeacherOrPrincipal
          ? await widget.service.fetchTeacherLeaderboard(widget.testSeriesId)
          : await widget.service.fetchStudentLeaderboard(
              widget.testSeriesId,
              studentId: widget.studentId,
            );

      final series =
          Map<String, dynamic>.from(res['test_series'] as Map? ?? {});
      final isClosed = res['is_closed'] == true;
      final toppers = (res['toppers'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final leaderboard = (res['leaderboard'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final myResult = res['my_result'] is Map
          ? Map<String, dynamic>.from(res['my_result'] as Map)
          : null;
      final review = (res['answer_review'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      if (!mounted) return;
      final needReviewTab =
          !widget.isTeacherOrPrincipal && isClosed && review.isNotEmpty;
      final desiredTabs = needReviewTab ? 2 : 1;
      if (_tabController == null || _tabController!.length != desiredTabs) {
        _tabController?.dispose();
        _tabController = TabController(length: desiredTabs, vsync: this);
      }

      setState(() {
        _series = series;
        _isClosed = isClosed;
        _totalParticipants = (res['total_participants'] as num?)?.toInt() ?? 0;
        _toppers = toppers;
        _leaderboard = leaderboard;
        _myResult = myResult;
        _answerReview = review;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = http.isNetworkError(e)
            ? http.kNetworkErrorMessage
            : (e is TestSeriesApiException
                ? e.message
                : http.formatErrorMessage(e));
        _isLoading = false;
      });
    }
  }

  Future<Uint8List?> _fetchImageBytesSafe(String rawUrl) async {
    final full = _resolveUrl(rawUrl);
    if (full.isEmpty) return null;
    try {
      final isLocalHosted = full.contains('127.0.0.1') ||
          full.contains('localhost') ||
          full.contains(_effectiveBaseUrl) ||
          full.contains('/uploads/');
      final res = isLocalHosted
          ? await http.get(Uri.parse(full))
          : await http.getRaw(Uri.parse(full));
      if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
        return res.bodyBytes;
      }
    } catch (_) {
      try {
        final res = await http.getRaw(Uri.parse(full));
        if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
          return res.bodyBytes;
        }
      } catch (_) {}
    }
    return null;
  }

  bool get _showTimer => _series['show_timer'] == true || _series['show_timer'] == 1;
  bool get _canViewTime => widget.isTeacherOrPrincipal || _showTimer;
  bool get _negEnabled =>
      _series['negative_marking_enabled'] == true ||
      _series['negative_marking_enabled'] == 1;
  String get _negLabel => (_series['negative_mark_label'] ?? '').toString();

  Future<void> _downloadCertificatePdf(Map<String, dynamic> entry) async {
    final rank = (entry['rank'] as num?)?.toInt() ?? 1;
    if (rank > 3) return;

    final studentName = (entry['student_name'] ?? 'Student').toString();
    final rollNo = (entry['roll_no'] ?? '').toString().trim();
    final className =
        (entry['class_name'] ?? _series['full_class_name'] ?? '').toString();
    final correct = (entry['correct_count'] as num?)?.toInt() ?? 0;
    final totalQ = (entry['total_questions'] as num?)?.toInt() ??
        (_series['total_questions'] as num?)?.toInt() ??
        0;
    final obtained = (entry['obtained_marks'] as num?)?.toDouble() ?? correct.toDouble();
    final scorePct = (entry['score_percent'] ?? 0).toString();
    final timeTaken = formatDurationSeconds(
      (entry['time_taken_seconds'] as num?)?.toInt() ?? 0,
    );

    final testTitle = (_series['title'] ?? 'Test Series').toString();
    final subjectName = (_series['subject_name'] ?? '').toString().trim();
    final schoolName = (_series['school_name'] ?? 'School').toString();
    final teacherName = (_series['created_by_name'] ?? 'Teacher').toString();
    final sessionName = (_series['academic_year_name'] ?? '')
        .toString()
        .replaceAll(RegExp(r'[\u2010-\u2015\u2212–—]'), '-');
    final heldDate = formatTestDateTime(_series['ends_at']?.toString());

    final initials = studentInitials(studentName);

    final results = await Future.wait([
      _fetchImageBytesSafe(entry['student_photo']?.toString() ?? ''),
      _fetchImageBytesSafe(_series['school_logo_path']?.toString() ?? ''),
      _fetchImageBytesSafe(
          _series['principal_signature_path']?.toString() ?? ''),
    ]);

    final studentPhotoBytes = results[0];
    final schoolLogoBytes = results[1];
    final principalSigBytes = results[2];

    final pw.Widget pdfAvatar = studentPhotoBytes != null
        ? pw.Container(
            width: 74,
            height: 74,
            decoration: pw.BoxDecoration(
              shape: pw.BoxShape.circle,
              border: pw.Border.all(color: PdfColors.amber600, width: 2.5),
            ),
            child: pw.ClipOval(
              child: pw.Image(
                pw.MemoryImage(studentPhotoBytes),
                width: 74,
                height: 74,
                fit: pw.BoxFit.cover,
              ),
            ),
          )
        : pw.Container(
            width: 74,
            height: 74,
            decoration: pw.BoxDecoration(
              shape: pw.BoxShape.circle,
              color: PdfColor.fromHex('FEF3C7'),
              border: pw.Border.all(color: PdfColor.fromHex('C26600'), width: 2.5),
            ),
            alignment: pw.Alignment.center,
            child: pw.Text(
              initials,
              style: pw.TextStyle(
                fontSize: 22,
                fontWeight: pw.FontWeight.bold,
                color: PdfColor.fromHex('C26600'),
              ),
            ),
          );

    final rankTitle = rank == 1
        ? 'FIRST PLACE  ·  RANK #1'
        : (rank == 2 ? 'SECOND PLACE  ·  RANK #2' : 'THIRD PLACE  ·  RANK #3');

    final pdf = pw.Document();
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(18),
        build: (pw.Context ctx) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColor.fromHex('1E293B'), width: 4),
              borderRadius: pw.BorderRadius.circular(18),
            ),
            child: pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 26, vertical: 18),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColor.fromHex('C26600'), width: 2),
                borderRadius: pw.BorderRadius.circular(12),
                color: PdfColor.fromHex('FFFDF7'),
              ),
              child: pw.Column(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  // Header
                  pw.Column(
                    children: [
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.center,
                        children: [
                          if (schoolLogoBytes != null) ...[
                            pw.Image(
                              pw.MemoryImage(schoolLogoBytes),
                              width: 34,
                              height: 34,
                              fit: pw.BoxFit.contain,
                            ),
                            pw.SizedBox(width: 10),
                          ],
                          pw.Text(
                            schoolName.toUpperCase(),
                            style: pw.TextStyle(
                              fontSize: 15,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColor.fromHex('1E293B'),
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                      pw.SizedBox(height: 5),
                      pw.Text(
                        'CERTIFICATE OF MERIT · TEST SERIES TOPPER',
                        textAlign: pw.TextAlign.center,
                        style: pw.TextStyle(
                          fontSize: 19,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColor.fromHex('1E293B'),
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Container(
                        padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        decoration: pw.BoxDecoration(
                          color: PdfColor.fromHex('FEF3C7'),
                          borderRadius: pw.BorderRadius.circular(14),
                          border: pw.Border.all(color: PdfColor.fromHex('FDE68A')),
                        ),
                        child: pw.Text(
                          subjectName.isNotEmpty
                              ? '$testTitle  ($subjectName)'
                              : testTitle,
                          style: pw.TextStyle(
                            fontSize: 13,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColor.fromHex('C26600'),
                          ),
                        ),
                      ),
                      if (sessionName.isNotEmpty) ...[
                        pw.SizedBox(height: 3),
                        pw.Text(
                          'Academic Session: $sessionName',
                          style: const pw.TextStyle(
                            fontSize: 9.5,
                            color: PdfColors.grey700,
                          ),
                        ),
                      ],
                    ],
                  ),

                  // Body Presentation
                  pw.Column(
                    children: [
                      pw.Text(
                        'This honor is proudly awarded for securing top merit among participants of $className in the above Test Series',
                        textAlign: pw.TextAlign.center,
                        style: const pw.TextStyle(
                          fontSize: 10.5,
                          fontStyle: pw.FontStyle.italic,
                          color: PdfColors.grey700,
                        ),
                      ),
                      pw.SizedBox(height: 10),
                      pw.Container(
                        width: 340,
                        padding: const pw.EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        decoration: pw.BoxDecoration(
                          color: PdfColor.fromHex('FFFDF5'),
                          border: pw.Border.all(color: PdfColors.amber500, width: 2),
                          borderRadius: pw.BorderRadius.circular(14),
                        ),
                        child: pw.Column(
                          children: [
                            pw.Container(
                              padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 3),
                              decoration: pw.BoxDecoration(
                                color: PdfColors.amber100,
                                borderRadius: pw.BorderRadius.circular(12),
                              ),
                              child: pw.Text(
                                rankTitle,
                                style: pw.TextStyle(
                                  fontSize: 11,
                                  fontWeight: pw.FontWeight.bold,
                                  color: PdfColors.amber900,
                                ),
                              ),
                            ),
                            pw.SizedBox(height: 8),
                            pdfAvatar,
                            pw.SizedBox(height: 8),
                            pw.Text(
                              studentName,
                              textAlign: pw.TextAlign.center,
                              style: pw.TextStyle(
                                fontSize: 17,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.black,
                              ),
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              '${rollNo.isNotEmpty ? 'Roll No. $rollNo · ' : ''}$className',
                              style: const pw.TextStyle(
                                fontSize: 10.5,
                                color: PdfColors.grey700,
                              ),
                            ),
                            pw.SizedBox(height: 8),
                            pw.Row(
                              mainAxisAlignment: pw.MainAxisAlignment.center,
                              children: [
                                pw.Text(
                                  '$scorePct%',
                                  style: pw.TextStyle(
                                    fontSize: 22,
                                    fontWeight: pw.FontWeight.bold,
                                    color: PdfColor.fromHex('059669'),
                                  ),
                                ),
                                pw.SizedBox(width: 12),
                                pw.Container(
                                  height: 22,
                                  width: 1,
                                  color: PdfColors.grey300,
                                ),
                                pw.SizedBox(width: 12),
                                pw.Column(
                                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                                  children: [
                                    pw.Text(
                                      _negEnabled
                                          ? 'Marks: ${formatMarks(obtained)} / $totalQ'
                                          : 'Correct: $correct / $totalQ',
                                      style: pw.TextStyle(
                                        fontSize: 10,
                                        fontWeight: pw.FontWeight.bold,
                                        color: PdfColors.grey800,
                                      ),
                                    ),
                                    if (_canViewTime)
                                      pw.Text(
                                        'Time: $timeTaken',
                                        style: const pw.TextStyle(
                                          fontSize: 9.5,
                                          color: PdfColors.grey600,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Signatures & Date
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            teacherName,
                            style: pw.TextStyle(
                              fontSize: 10,
                              fontStyle: pw.FontStyle.italic,
                              color: PdfColors.grey700,
                            ),
                          ),
                          pw.SizedBox(height: 2),
                          pw.Container(width: 120, height: 1, color: PdfColors.grey500),
                          pw.SizedBox(height: 3),
                          pw.Text('Subject Teacher',
                              style: pw.TextStyle(
                                  fontSize: 9.5, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                      if (heldDate.isNotEmpty)
                        pw.Text(
                          'Issued on $heldDate',
                          style: const pw.TextStyle(
                              fontSize: 9.5, color: PdfColors.grey600),
                        ),
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.end,
                        children: [
                          if (principalSigBytes != null)
                            pw.Image(
                              pw.MemoryImage(principalSigBytes),
                              width: 85,
                              height: 28,
                              fit: pw.BoxFit.contain,
                            ),
                          pw.Container(width: 120, height: 1, color: PdfColors.grey500),
                          pw.SizedBox(height: 3),
                          pw.Text('Principal Signature',
                              style: pw.TextStyle(
                                  fontSize: 9.5, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    try {
      final pdfBytes = await pdf.save();
      final cleanTitle =
          testTitle.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_').replaceAll(RegExp(r'^_+|_+$'), '');
      final cleanStudent =
          studentName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_').replaceAll(RegExp(r'^_+|_+$'), '');
      final filename = 'TestSeries_${cleanTitle}_Rank${rank}_$cleanStudent.pdf';

      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          await platform.invokeMethod<String>(
            'saveFileToDownloads',
            {'fileName': filename, 'bytes': pdfBytes},
          );
        } catch (_) {
          final extDir = await getExternalStorageDirectory();
          if (extDir != null) {
            final f = File('${extDir.path}/$filename');
            await f.writeAsBytes(pdfBytes);
          }
        }
      } else {
        final appDocDir = await getApplicationDocumentsDirectory();
        final f = File('${appDocDir.path}/$filename');
        await f.writeAsBytes(pdfBytes);
      }

      try {
        await NotificationHelper.showDownloadNotification(
          title: 'Test Series Certificate Downloaded',
          fileName: filename,
          bytes: pdfBytes,
        );
      } catch (_) {}

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Certificate saved to Downloads!',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            action: SnackBarAction(
              label: 'OPEN',
              textColor: Colors.amber.shade200,
              onPressed: () async {
                await Printing.layoutPdf(
                  onLayout: (_) async => pdfBytes,
                  name: filename,
                );
              },
            ),
            backgroundColor: AppColors.success600,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(http.formatErrorMessage(e)),
            backgroundColor: AppColors.danger600,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showCertificatePreviewDialog(Map<String, dynamic> entry) {
    final rank = (entry['rank'] as num?)?.toInt() ?? 1;
    if (rank > 3) return;

    final studentName = (entry['student_name'] ?? 'Student').toString();
    final photoUrl = _resolveUrl(entry['student_photo']?.toString());
    final className =
        (entry['class_name'] ?? _series['full_class_name'] ?? '').toString();
    final rollNo = (entry['roll_no'] ?? '').toString().trim();
    final scorePct = (entry['score_percent'] ?? 0).toString();
    final correct = (entry['correct_count'] as num?)?.toInt() ?? 0;
    final totalQ = (entry['total_questions'] as num?)?.toInt() ??
        (_series['total_questions'] as num?)?.toInt() ??
        0;
    final obtained =
        (entry['obtained_marks'] as num?)?.toDouble() ?? correct.toDouble();
    final timeTaken = formatDurationSeconds(
      (entry['time_taken_seconds'] as num?)?.toInt() ?? 0,
    );
    final schoolName = (_series['school_name'] ?? 'School').toString();
    final testTitle = (_series['title'] ?? 'Test Series').toString();
    final subjectName = (_series['subject_name'] ?? '').toString().trim();
    final teacherName = (_series['created_by_name'] ?? 'Teacher').toString();
    final sessionName = (_series['academic_year_name'] ?? '').toString();
    final medal = rank == 1 ? '🥇' : (rank == 2 ? '🥈' : '🥉');

    bool isDownloading = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          insetPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 460),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: TsColors.ink, width: 4),
              color: TsColors.cardIvory,
            ),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: TsColors.accent, width: 2),
                color: TsColors.cardIvory,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Align(
                      alignment: Alignment.topRight,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(ctx),
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: TsColors.slate100,
                          ),
                          child: const Icon(Icons.close_rounded,
                              size: 18, color: TsColors.inkMuted),
                        ),
                      ),
                    ),
                    Text(
                      schoolName.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: TsColors.inkMuted,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'CERTIFICATE OF MERIT',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: TsColors.ink,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: TsColors.accentSoft,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: TsColors.accentBorder),
                      ),
                      child: Text(
                        subjectName.isNotEmpty
                            ? '$testTitle · $subjectName'
                            : testTitle,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: TsColors.accent,
                        ),
                      ),
                    ),
                    if (sessionName.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Session: $sessionName',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFDF5),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: TsColors.amber400, width: 2),
                      ),
                      child: Column(
                        children: [
                          Text(medal, style: const TextStyle(fontSize: 28)),
                          Text(
                            'Rank #$rank Topper',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: TsColors.amber800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          StudentAvatarCircle(
                            photoUrl: photoUrl,
                            name: studentName,
                            radius: 34,
                            borderColor: AppColors.warning500,
                            borderWidth: 2.5,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            studentName,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${rollNo.isNotEmpty ? 'Roll No. $rollNo · ' : ''}$className',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '$scorePct%',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: AppColors.success600,
                            ),
                          ),
                          Text(
                            '${_negEnabled ? 'Marks: ${formatMarks(obtained)} / $totalQ' : 'Correct: $correct / $totalQ'}${_canViewTime ? '  ·  Time: $timeTaken' : ''}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              teacherName,
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontStyle: FontStyle.italic,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            Container(
                              width: 96,
                              height: 1,
                              color: AppColors.borderStrong,
                              margin: const EdgeInsets.symmetric(vertical: 2),
                            ),
                            const Text(
                              'Teacher',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'Verified',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontStyle: FontStyle.italic,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            Container(
                              width: 96,
                              height: 1,
                              color: AppColors.borderStrong,
                              margin: const EdgeInsets.symmetric(vertical: 2),
                            ),
                            const Text(
                              'Principal',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: isDownloading
                            ? null
                            : () async {
                                setModalState(() => isDownloading = true);
                                await _downloadCertificatePdf(entry);
                                if (ctx.mounted) {
                                  setModalState(() => isDownloading = false);
                                }
                              },
                        icon: isDownloading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.download_rounded, size: 19),
                        label: Text(
                          isDownloading
                              ? 'Generating Certificate...'
                              : 'Download PDF Certificate',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: TsColors.ink,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasTabs = _tabController != null && _tabController!.length > 1;

    final fullClassName = (_series['full_class_name'] ?? '').toString().trim();

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkSurfaceRaised : Colors.transparent,
        scrolledUnderElevation: 0,
        foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
        elevation: 0,
        titleSpacing: 0,
        surfaceTintColor: Colors.transparent,
        title: Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Row(
            children: [
              Flexible(
                child: Text(
                  (_series['title'] ?? widget.initialTitle ?? 'Leaderboard')
                      .toString()
                      .toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900),
                ),
              ),
              if (fullClassName.isNotEmpty) ...[
                const SizedBox(width: 8),
                TestSeriesClassBadges(
                  classLabel: fullClassName,
                  isDark: isDark,
                ),
              ],
            ],
          ),
        ),
        bottom: hasTabs
            ? TabBar(
                controller: _tabController,
                labelColor: TsColors.ink,
                unselectedLabelColor:
                    isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
                indicatorColor: TsColors.accent,
                indicatorWeight: 3,
                labelStyle: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 13.5),
                tabs: const [
                  Tab(icon: Icon(Icons.emoji_events_rounded, size: 18), text: 'Leaderboard'),
                  Tab(icon: Icon(Icons.fact_check_rounded, size: 18), text: 'Answer Review'),
                ],
              )
            : null,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: TsColors.accent))
          : _error.isNotEmpty
              ? _buildErrorView(isDark)
              : !_isClosed
                  ? _buildPendingCloseView(isDark)
                  : hasTabs
                      ? TabBarView(
                          controller: _tabController,
                          children: [
                            _buildLeaderboardTab(isDark),
                            _buildAnswerReviewTab(isDark),
                          ],
                        )
                      : _buildLeaderboardTab(isDark),
    );
  }

  Widget _buildErrorView(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                  color: TsColors.accentSoft, shape: BoxShape.circle),
              child: const Icon(Icons.hourglass_top_rounded,
                  size: 40, color: TsColors.accent),
            ),
            const SizedBox(height: 16),
            Text(
              _error,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
              ),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Refresh'),
              style: ElevatedButton.styleFrom(
                backgroundColor: TsColors.ink,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingCloseView(bool isDark) {
    final status = (_series['status'] ?? 'LIVE').toString();
    final startsAt = formatTestDateTime(_series['starts_at']?.toString());
    final endsAt = formatTestDateTime(_series['ends_at']?.toString());

    return RefreshIndicator(
      color: TsColors.accent,
      onRefresh: _loadData,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 460),
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                        color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 68,
                        height: 68,
                        decoration: const BoxDecoration(
                          color: TsColors.accentSoft,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.leaderboard_rounded,
                            size: 36, color: TsColors.accent),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        status == 'UPCOMING'
                            ? 'Test Series Upcoming'
                            : 'Test Series Currently Live',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '3 Toppers, Ranks & Certificates will generate automatically once the test closes.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13.5,
                          color:
                              isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? TsColors.darkSurfaceElevated
                              : AppColors.surfaceSunken,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          children: [
                            _InfoLine(
                              label: 'Submitted So Far',
                              value: '$_totalParticipants Students',
                              isDark: isDark,
                            ),
                            const SizedBox(height: 6),
                            _InfoLine(
                              label: 'Starts',
                              value: startsAt,
                              isDark: isDark,
                            ),
                            const SizedBox(height: 6),
                            _InfoLine(
                              label: 'Closes At',
                              value: endsAt,
                              isDark: isDark,
                            ),
                          ],
                        ),
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

  Widget _buildLeaderboardTab(bool isDark) {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          if (!widget.isTeacherOrPrincipal && _myResult != null) ...[
            _buildStudentRankBanner(isDark, _myResult!),
            const SizedBox(height: 16),
          ],
          if (_toppers.isNotEmpty) ...[
            _buildToppersPodiumCard(isDark),
            const SizedBox(height: 18),
          ],
          Row(
            children: [
              Text(
                'All Rankings',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? TsColors.darkSurfaceElevated : TsColors.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_totalParticipants Participants',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: isDark ? TsColors.amber300 : TsColors.accent,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_leaderboard.isEmpty)
            Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                    color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
              ),
              child: Column(
                children: [
                  Icon(Icons.people_outline_rounded,
                      size: 44,
                      color: isDark ? AppColors.darkTextMuted : AppColors.textMuted),
                  const SizedBox(height: 10),
                  Text(
                    'No student submitted this Test Series before closing.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          else
            ..._leaderboard.map((entry) => _buildLeaderboardRow(isDark, entry)),
        ],
      ),
    );
  }

  Widget _buildStudentRankBanner(bool isDark, Map<String, dynamic> mine) {
    final attempted = mine['attempted'] == true;
    if (!attempted) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? TsColors.darkSurfaceElevated : TsColors.slate100,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.info_outline_rounded,
                  color: AppColors.textMuted),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'You did not submit this Test Series before the closing time. View the class toppers below!',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color:
                      isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final rank = (mine['rank'] as num?)?.toInt() ?? 0;
    final canDownload = mine['can_download_certificate'] == true && rank <= 3;
    final score = mine['score_percent'] ?? 0;
    final correct = (mine['correct_count'] as num?)?.toInt() ?? 0;
    final wrong = (mine['wrong_count'] as num?)?.toInt() ?? 0;
    final total = (mine['total_questions'] as num?)?.toInt() ?? 0;
    final obtained =
        (mine['obtained_marks'] as num?)?.toDouble() ?? correct.toDouble();
    final deducted = (mine['deducted_marks'] as num?)?.toDouble() ?? 0.0;
    final timeTaken =
        formatDurationSeconds((mine['time_taken_seconds'] as num?)?.toInt() ?? 0);

    final bannerStats = _negEnabled
        ? 'Marks: ${formatMarks(obtained)}/$total ($score%)${deducted > 0 ? ' · -${formatMarks(deducted)} Neg. ($wrong wrong)' : ''}${_canViewTime ? ' · $timeTaken' : ''}'
        : 'Score: $score%  ·  $correct / $total Correct${_canViewTime ? '  ·  $timeTaken' : ''}';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: canDownload
            ? const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF78350F), Color(0xFFC26600)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF334155)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: (canDownload ? TsColors.accent : Colors.black)
                .withValues(alpha: 0.18),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StudentAvatarCircle(
                photoUrl: _resolveUrl(mine['student_photo']?.toString()),
                name: (mine['student_name'] ?? 'Student').toString(),
                radius: 26,
                borderColor: canDownload ? TsColors.amber300 : Colors.white54,
                borderWidth: 2,
                baseUrl: _effectiveBaseUrl,
                heroTag: 'my_rank_avatar_${widget.studentId ?? 'me'}',
                enableZoom: true,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      canDownload
                          ? 'Topper Rank #$rank!'
                          : 'Your Rank: #$rank of $_totalParticipants',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      bannerStats,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (canDownload) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showCertificatePreviewDialog(mine),
                icon: const Icon(Icons.workspace_premium_rounded, size: 20),
                label: const Text(
                  'View & Download Merit Certificate',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: TsColors.ink,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ] else ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(Icons.auto_awesome_rounded,
                      color: TsColors.amber300, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Certificates are awarded to the Top 3 Rankers. Check Answer Review tab to improve next time!',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildToppersPodiumCard(bool isDark) {
    final first = _toppers.isNotEmpty ? _toppers[0] : null;
    final second = _toppers.length >= 2 ? _toppers[1] : null;
    final third = _toppers.length >= 3 ? _toppers[2] : null;

    final rawClass = (_series['full_class_name'] ?? _series['class_name'] ?? _series['class'] ?? '').toString().trim();
    final podiumTitle = rawClass.isNotEmpty
        ? '${rawClass.toUpperCase()} TEST SERIES TOPPERS'
        : 'TEST SERIES TOPPERS';

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF334155)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: TsColors.amber400.withValues(alpha: 0.4), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: TsColors.ink.withValues(alpha: 0.24),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.emoji_events_rounded,
                  color: TsColors.amber300, size: 22),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  podiumTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: second != null
                    ? _PodiumSpot(
                        entry: second,
                        photoUrl: _resolveUrl(second['student_photo']?.toString()),
                        podiumHeight: 68,
                        accentColor: const Color(0xFFE2E8F0),
                        badgeText: '#2',
                        avatarRadius: 35,
                        negEnabled: _negEnabled,
                      )
                    : const SizedBox.shrink(),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: first != null
                    ? _PodiumSpot(
                        entry: first,
                        photoUrl: _resolveUrl(first['student_photo']?.toString()),
                        podiumHeight: 92,
                        accentColor: TsColors.amber300,
                        badgeText: '#1',
                        avatarRadius: 45,
                        isCrown: true,
                        negEnabled: _negEnabled,
                      )
                    : const SizedBox.shrink(),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: third != null
                    ? _PodiumSpot(
                        entry: third,
                        photoUrl: _resolveUrl(third['student_photo']?.toString()),
                        podiumHeight: 54,
                        accentColor: const Color(0xFFF59E0B),
                        badgeText: '#3',
                        avatarRadius: 32.5,
                        negEnabled: _negEnabled,
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLeaderboardRow(bool isDark, Map<String, dynamic> entry) {
    final rank = (entry['rank'] as num?)?.toInt() ?? 0;
    final isTopper = entry['is_topper'] == true || rank <= 3;
    final isMe = entry['is_me'] == true;
    final name = (entry['student_name'] ?? 'Student').toString();
    final roll = (entry['roll_no'] ?? '').toString().trim();
    final score = entry['score_percent'] ?? 0;
    final correct = (entry['correct_count'] as num?)?.toInt() ?? 0;
    final wrong = (entry['wrong_count'] as num?)?.toInt() ?? 0;
    final total = (entry['total_questions'] as num?)?.toInt() ?? 0;
    final obtained =
        (entry['obtained_marks'] as num?)?.toDouble() ?? correct.toDouble();
    final deducted = (entry['deducted_marks'] as num?)?.toDouble() ?? 0.0;
    final timeTaken = formatDurationSeconds(
      (entry['time_taken_seconds'] as num?)?.toInt() ?? 0,
    );

    final rowMeta = _negEnabled
        ? '${roll.isNotEmpty ? 'Roll $roll · ' : ''}${formatMarks(obtained)}/$total Marks${deducted > 0 ? ' (-${formatMarks(deducted)} Neg. · $wrong wrong)' : ''}${_canViewTime ? ' · $timeTaken' : ''}'
        : '${roll.isNotEmpty ? 'Roll $roll · ' : ''}$correct/$total Correct${_canViewTime ? ' · $timeTaken' : ''}';

    Color badgeBg =
        isDark ? TsColors.darkSurfaceElevated : TsColors.slate100;
    Color badgeFg = isDark ? AppColors.darkTextPrimary : AppColors.textSecondary;
    if (rank == 1) {
      badgeBg = TsColors.amber100;
      badgeFg = TsColors.amber800;
    } else if (rank == 2) {
      badgeBg = const Color(0xFFE2E8F0);
      badgeFg = AppColors.textPrimary;
    } else if (rank == 3) {
      badgeBg = const Color(0xFFFDE68A);
      badgeFg = TsColors.amber900;
    }

    final resolvedPhotoUrl = _resolveUrl(entry['student_photo']?.toString());
    final heroTag = 'ranking_avatar_${entry['student_id'] ?? rank}_$rank';

    void openProfileView() {
      if (resolvedPhotoUrl.isNotEmpty) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => FullScreenImageScreen(
              imageUrl: resolvedPhotoUrl,
              title: name,
              heroTag: heroTag,
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No profile photo uploaded for this student.'),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isMe
            ? (isDark
                ? TsColors.amber900.withValues(alpha: 0.35)
                : TsColors.cardIvory)
            : (isDark ? AppColors.darkSurfaceRaised : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isMe
              ? TsColors.accent
              : (isTopper
                  ? TsColors.amber400.withValues(alpha: 0.7)
                  : (isDark ? TsColors.darkBorder : TsColors.border)),
          width: isMe ? 1.8 : 1.1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: openProfileView,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '#$rank',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      color: badgeFg,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                StudentAvatarCircle(
                  photoUrl: resolvedPhotoUrl,
                  name: name,
                  radius: 27.5,
                  borderColor: isTopper ? TsColors.amber400 : TsColors.border,
                  baseUrl: _effectiveBaseUrl,
                  heroTag: heroTag,
                  enableZoom: true,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w800,
                                color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                              ),
                            ),
                          ),
                          if (isMe) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: TsColors.ink,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'YOU',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        rowMeta,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : TsColors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '$score%',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: isTopper
                            ? AppColors.success600
                            : (isDark ? AppColors.darkTextPrimary : TsColors.ink),
                      ),
                    ),
                    if (isTopper)
                      const Text(
                        'TOPPER',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.warning600,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnswerReviewTab(bool isDark) {
    final correctTotal = (_myResult?['correct_count'] as num?)?.toInt() ?? 0;
    final wrongTotal = (_myResult?['wrong_count'] as num?)?.toInt() ?? 0;
    final skippedTotal = (_myResult?['unanswered_count'] as num?)?.toInt() ?? 0;
    final totalQuestions =
        (_myResult?['total_questions'] as num?)?.toInt() ?? _answerReview.length;
    final obtainedMarks = (_myResult?['obtained_marks'] as num?)?.toDouble() ??
        correctTotal.toDouble();
    final deductedMarks =
        (_myResult?['deducted_marks'] as num?)?.toDouble() ?? 0.0;

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
      itemCount: _answerReview.length + 1,
      itemBuilder: (_, idx) {
        if (idx == 0) {
          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                  color: isDark ? TsColors.darkBorder : AppColors.borderSubtle),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _ReviewStatBox(
                          label: 'Correct',
                          count: correctTotal,
                          color: AppColors.success600),
                    ),
                    Expanded(
                      child: _ReviewStatBox(
                          label: 'Wrong',
                          count: wrongTotal,
                          color: AppColors.danger600),
                    ),
                    Expanded(
                      child: _ReviewStatBox(
                          label: 'Skipped',
                          count: skippedTotal,
                          color: AppColors.textMuted),
                    ),
                  ],
                ),
                if (_negEnabled) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isDark
                          ? TsColors.amber900.withValues(alpha: 0.3)
                          : TsColors.accentSoft,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDark
                            ? TsColors.amber800
                            : TsColors.accentBorder,
                      ),
                    ),
                    child: Text(
                      'Final Score: ${formatMarks(obtainedMarks)} / $totalQuestions'
                      '${deductedMarks > 0 ? '  ·  Deducted: -${formatMarks(deductedMarks)} ($wrongTotal × ${_negLabel.isNotEmpty ? _negLabel : 'Neg.'})' : '  ·  No Negative Deduction'}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: isDark ? TsColors.amber300 : TsColors.amber800,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        }

        final q = _answerReview[idx - 1];
        final qText = (q['question_text'] ?? '').toString().trim();
        final qImg = _resolveUrl(q['question_image_url']?.toString());
        final selectedOptId = (q['selected_option_id'] as num?)?.toInt();
        final correctOptId = (q['correct_option_id'] as num?)?.toInt();
        final isCorrect = q['is_student_correct'] == true;
        final isSkipped = selectedOptId == null;
        final options = (q['options'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isSkipped
                  ? (isDark ? TsColors.darkBorder : AppColors.borderStrong)
                  : (isCorrect ? AppColors.success500 : AppColors.danger500)
                      .withValues(alpha: 0.55),
              width: 1.4,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'Question $idx',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: TsColors.accent,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(
                      color: isSkipped
                          ? (isDark
                              ? TsColors.darkSurfaceElevated
                              : TsColors.slate100)
                          : (isCorrect
                              ? AppColors.success50
                              : AppColors.danger50),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      isSkipped ? 'Skipped' : (isCorrect ? 'Correct' : 'Wrong'),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: isSkipped
                            ? AppColors.textMuted
                            : (isCorrect
                                ? AppColors.success600
                                : AppColors.danger600),
                      ),
                    ),
                  ),
                ],
              ),
              if (qText.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  qText,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                  ),
                ),
              ],
              if (qImg.isNotEmpty) ...[
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => showTestSeriesImageZoom(context, qImg,
                      caption: qText.isNotEmpty ? qText : 'Question $idx'),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: AspectRatio(
                      aspectRatio: 300 / 185,
                      child: CachedNetworkImage(
                        imageUrl: qImg,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              ...List.generate(options.length, (oIdx) {
                final opt = options[oIdx];
                final oId = (opt['id'] as num).toInt();
                final letter = String.fromCharCode(65 + oIdx);
                final oText = (opt['option_text'] ?? '').toString().trim();
                final oImg = _resolveUrl(opt['option_image_url']?.toString());
                final isRightAnswer = oId == correctOptId;
                final wasChosen = oId == selectedOptId;

                Color bg = isDark ? TsColors.darkSurfaceElevated : AppColors.surfaceSunken;
                Color border = isDark ? TsColors.darkBorder : AppColors.borderSubtle;
                IconData? statusIcon;
                Color? statusColor;

                if (isRightAnswer) {
                  bg = isDark
                      ? TsColors.emerald900.withValues(alpha: 0.35)
                      : AppColors.success50;
                  border = AppColors.success500;
                  statusIcon = Icons.check_circle_rounded;
                  statusColor = AppColors.success600;
                } else if (wasChosen && !isRightAnswer) {
                  bg = isDark
                      ? TsColors.rose900.withValues(alpha: 0.35)
                      : AppColors.danger50;
                  border = AppColors.danger500;
                  statusIcon = Icons.cancel_rounded;
                  statusColor = AppColors.danger600;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: border, width: (isRightAnswer || wasChosen) ? 1.6 : 1),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 13,
                        backgroundColor: isRightAnswer
                            ? AppColors.success600
                            : (wasChosen ? AppColors.danger600 : AppColors.borderStrong),
                        child: Text(
                          letter,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 10),
                      if (oImg.isNotEmpty) ...[
                        GestureDetector(
                          onTap: () => showTestSeriesImageZoom(context, oImg,
                              caption: 'Option $letter'),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: oImg,
                              width: 70,
                              height: 50,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: Text(
                          oText.isNotEmpty ? oText : 'Option $letter',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: (isRightAnswer || wasChosen)
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                          ),
                        ),
                      ),
                      if (statusIcon != null)
                        Icon(statusIcon, color: statusColor, size: 20),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}

class _PodiumSpot extends StatelessWidget {
  final Map<String, dynamic> entry;
  final String photoUrl;
  final double podiumHeight;
  final Color accentColor;
  final String badgeText;
  final double avatarRadius;
  final bool isCrown;
  final bool negEnabled;

  const _PodiumSpot({
    required this.entry,
    required this.photoUrl,
    required this.podiumHeight,
    required this.accentColor,
    required this.badgeText,
    required this.avatarRadius,
    this.isCrown = false,
    this.negEnabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final name = (entry['student_name'] ?? 'Student').toString();
    final score = entry['score_percent'] ?? 0;
    final correct = (entry['correct_count'] as num?)?.toInt() ?? 0;
    final total = (entry['total_questions'] as num?)?.toInt() ?? 0;
    final obtained =
        (entry['obtained_marks'] as num?)?.toDouble() ?? correct.toDouble();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isCrown)
          const Padding(
            padding: EdgeInsets.only(bottom: 4),
            child: Icon(Icons.workspace_premium_rounded,
                color: TsColors.amber300, size: 24),
          ),
        Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            StudentAvatarCircle(
              photoUrl: photoUrl,
              name: name,
              radius: avatarRadius,
              borderColor: accentColor,
              borderWidth: isCrown ? 3.5 : 2.5,
              heroTag: 'topper_avatar_${entry['student_id']}_$badgeText',
              enableZoom: false,
            ),
            Positioned(
              bottom: -6,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: Text(
                  badgeText,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            height: 1.2,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          height: podiumHeight,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: isCrown ? 0.22 : 0.14),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            border: Border.all(color: accentColor.withValues(alpha: 0.5)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$score%',
                style: TextStyle(
                  color: accentColor,
                  fontSize: isCrown ? 17 : 14.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                negEnabled
                    ? '${formatMarks(obtained)}/$total'
                    : '$correct/$total',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoLine extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;

  const _InfoLine({
    required this.label,
    required this.value,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color:
                isDark ? AppColors.darkTextSecondary : AppColors.textMuted,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: isDark ? TsColors.amber300 : TsColors.accent,
          ),
        ),
      ],
    );
  }
}

class _ReviewStatBox extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _ReviewStatBox(
      {required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$count',
            style: TextStyle(
                fontSize: 19, fontWeight: FontWeight.w900, color: color)),
        Text(label,
            style: TextStyle(
                fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}
