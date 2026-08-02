import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:school_hub/services/notification_helper.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

class AchievementsScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? studentId;

  const AchievementsScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.studentId,
  }) : super(key: key);

  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isLoading = true;
  String _errorText = '';

  Map<String, dynamic> _data = {};
  List<dynamic> _achievements = [];
  List<dynamic> _classes = [];
  List<dynamic> _academicYears = [];

  String? _selectedYearId;
  String _selectedClassId = 'ALL';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  String? _expandedClassKey;

  String get _selectedYearName {
    if (_selectedYearId != null) {
      final found = _academicYears.firstWhere(
        (y) => y['id'].toString() == _selectedYearId,
        orElse: () => null,
      );
      if (found != null) {
        return (found['name'] ?? found['academic_year_name'] ?? _selectedYearId).toString();
      }
    }
    if (_academicYears.isNotEmpty) {
      final first = _academicYears.first;
      return (first['name'] ?? first['academic_year_name'] ?? '').toString();
    }
    return '2026–2027';
  }

  String _formatClassName(dynamic raw) {
    if (raw == null) return '';
    final str = raw.toString().trim();
    if (str.isEmpty) return '';
    if (str.toLowerCase().startsWith('class ')) {
      return str;
    }
    return 'Class $str';
  }

  String _formatClassScope(dynamic raw) {
    if (raw == null) return '';
    final str = raw.toString().trim();
    if (str.isEmpty) return '';
    if (str.toLowerCase().startsWith('class ')) {
      return str.toUpperCase();
    }
    return 'CLASS $str'.toUpperCase();
  }

  Map<String, List<dynamic>> _groupClassAchievements(List<dynamic> items) {
    final Map<String, List<dynamic>> grouped = {};
    for (var item in items) {
      if (item['level'] != 'school' && item['class_id'] != null) {
        final cName = _formatClassName(item['class_name']);
        grouped.putIfAbsent(cName, () => []).add(item);
      }
    }
    grouped.forEach((key, list) {
      list.sort((a, b) {
        final rA = (a['rank'] is int) ? a['rank'] as int : int.tryParse(a['rank'].toString()) ?? 99;
        final rB = (b['rank'] is int) ? b['rank'] as int : int.tryParse(b['rank'].toString()) ?? 99;
        return rA.compareTo(rB);
      });
    });
    return grouped;
  }

  List<dynamic> _getSchoolOverallAchievements(List<dynamic> items) {
    final list = items.where((item) => item['level'] == 'school' || item['class_id'] == null).toList();
    list.sort((a, b) {
      final rA = (a['rank'] is int) ? a['rank'] as int : int.tryParse(a['rank'].toString()) ?? 99;
      final rB = (b['rank'] is int) ? b['rank'] as int : int.tryParse(b['rank'].toString()) ?? 99;
      return rA.compareTo(rB);
    });
    return list;
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchAchievements();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchAchievements() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/school/achievements').replace(
        queryParameters: {
          if (_selectedYearId != null) 'academic_year_id': _selectedYearId,
          if (_selectedClassId != 'ALL') 'class_id': _selectedClassId,
        },
      );

      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final resData = body['data'] ?? body;
        setState(() {
          _data = resData;
          _achievements = resData['achievements'] ?? [];
          _classes = resData['classes'] ?? [];
          _academicYears = resData['academic_years'] ?? [];
          if (_selectedYearId == null && resData['academic_year_id'] != null) {
            _selectedYearId = resData['academic_year_id'].toString();
          }
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorText = 'Failed to load achievements (${response.statusCode})';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorText = 'Network error: $e';
        _isLoading = false;
      });
    }
  }

  List<dynamic> _filterCategory(String category) {
    return _achievements.filter((item) {
      final cat = item['category'] ?? item['feature_type'];
      if (category == 'attendance' && cat != 'attendance_champions' && cat != 'attendance_leaderboard') {
        return false;
      }
      if (category == 'academic' && cat != 'academic_excellence') {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final name = (item['student_name'] ?? '').toString().toLowerCase();
        final roll = (item['roll_number'] ?? '').toString().toLowerCase();
        final cname = (item['class_name'] ?? '').toString().toLowerCase();
        if (!name.contains(_searchQuery) && !roll.contains(_searchQuery) && !cname.contains(_searchQuery)) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  String? _getPhotoUrl(String? rawPhoto) {
    if (rawPhoto == null || rawPhoto.trim().isEmpty) return null;
    final photoStr = rawPhoto.trim();
    if (photoStr.startsWith('http://') || photoStr.startsWith('https://')) {
      return photoStr;
    }
    final base = widget.baseUrl.endsWith('/') ? widget.baseUrl.substring(0, widget.baseUrl.length - 1) : widget.baseUrl;
    final path = photoStr.startsWith('/') ? photoStr : '/$photoStr';
    return '$base$path';
  }

  pw.Widget _buildPdfInitialsAvatar(String initials) {
    return pw.Container(
      width: 68,
      height: 68,
      decoration: pw.BoxDecoration(
        shape: pw.BoxShape.circle,
        color: PdfColors.grey200,
        border: pw.Border.all(color: PdfColors.amber400, width: 2.5),
      ),
      alignment: pw.Alignment.center,
      child: pw.Text(
        initials,
        style: pw.TextStyle(
          fontSize: 20,
          fontWeight: pw.FontWeight.bold,
          color: PdfColors.black,
        ),
      ),
    );
  }

  Future<void> _downloadCertificatePdf(Map<String, dynamic> item) async {
    final rank = item['rank'] ?? 1;
    final isAcademic = (item['category'] ?? item['feature_type']) == 'academic_excellence';
    final level = item['level'] ?? (item['class_id'] == null ? 'school' : 'class');
    final meta = item['metadata'] is Map ? item['metadata'] : {};

    final presentDays = meta['present_days'];
    final totalWorkingDays = meta['total_working_days'];
    final totalObtained = meta['total_obtained'];
    final totalMax = meta['total_max'];

    final studentName = (item['student_name'] ?? 'Student').toString();
    final className = (item['class_name'] ?? '').toString();
    final rollNumber = item['roll_number']?.toString();
    final score = (item['achievement_score'] ?? '').toString();
    final schoolName = (_data['school_name'] ?? 'Jamiya Sams Academy').toString();
    final sessionName = (_data['academic_year_name'] ?? '2026–2027').toString();

    final initials = studentName.isNotEmpty
        ? studentName.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join('').toUpperCase()
        : 'ST';

    final photoUrl = _getPhotoUrl(item['student_photo']?.toString());
    pw.Widget pdfAvatarWidget = _buildPdfInitialsAvatar(initials);

    if (photoUrl != null) {
      try {
        final res = await http.get(Uri.parse(photoUrl));
        if (res.statusCode == 200) {
          final img = pw.MemoryImage(res.bodyBytes);
          pdfAvatarWidget = pw.Container(
            width: 68,
            height: 68,
            decoration: pw.BoxDecoration(
              shape: pw.BoxShape.circle,
              border: pw.Border.all(color: PdfColors.amber400, width: 2.5),
            ),
            child: pw.ClipOval(
              child: pw.Image(img, width: 68, height: 68, fit: pw.BoxFit.cover),
            ),
          );
        }
      } catch (_) {}
    }

    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(20),
        build: (pw.Context context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.amber700, width: 4),
              borderRadius: pw.BorderRadius.circular(20),
            ),
            child: pw.Container(
              padding: const pw.EdgeInsets.all(20),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.amber400, width: 2),
                borderRadius: pw.BorderRadius.circular(14),
                color: PdfColors.white,
              ),
              child: pw.Column(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  // School Name & Header
                  pw.Column(
                    children: [
                      pw.Text(
                        schoolName.toUpperCase(),
                        style: pw.TextStyle(
                          fontSize: 15,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.grey800,
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        isAcademic
                            ? 'CERTIFICATE OF ACADEMIC EXCELLENCE'
                            : 'CERTIFICATE OF ATTENDANCE ACHIEVEMENT',
                        textAlign: pw.TextAlign.center,
                        style: pw.TextStyle(
                          fontSize: 18,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.black,
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        'Academic Session: $sessionName',
                        style: const pw.TextStyle(
                          fontSize: 11,
                          color: PdfColors.grey700,
                        ),
                      ),
                      pw.SizedBox(height: 8),
                      pw.Divider(color: PdfColors.grey300, thickness: 1),
                    ],
                  ),

                  // Presentation text
                  pw.Column(
                    children: [
                      pw.Text(
                        'This certificate is honorably presented to the top ${isAcademic ? 'academic' : 'attendance'} achievers of',
                        style: const pw.TextStyle(
                          fontSize: 12,
                          fontStyle: pw.FontStyle.italic,
                          color: PdfColors.grey700,
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        level == 'school' ? 'SCHOOL OVERALL' : _formatClassScope(className),
                        style: pw.TextStyle(
                          fontSize: 15,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.black,
                        ),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        isAcademic
                            ? 'For demonstrating outstanding academic performance, subject mastery, and intellectual excellence.'
                            : 'For demonstrating exceptional commitment, consistency, and dedication to learning throughout the academic session.',
                        textAlign: pw.TextAlign.center,
                        style: const pw.TextStyle(
                          fontSize: 10,
                          color: PdfColors.grey600,
                        ),
                      ),
                    ],
                  ),

                  // Center Card Box
                  pw.Container(
                    width: 260,
                    padding: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: pw.BoxDecoration(
                      color: PdfColor.fromHex('FFFDF5'),
                      border: pw.Border.all(color: PdfColors.amber400, width: 2),
                      borderRadius: pw.BorderRadius.circular(14),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Text(
                          'Rank #$rank',
                          style: pw.TextStyle(
                            fontSize: 13,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.amber900,
                          ),
                        ),
                        pw.SizedBox(height: 6),
                        pdfAvatarWidget,
                        pw.SizedBox(height: 6),
                        pw.Text(
                          studentName,
                          textAlign: pw.TextAlign.center,
                          style: pw.TextStyle(
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.black,
                          ),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          '${rollNumber != null && rollNumber.isNotEmpty ? 'Roll No. $rollNumber · ' : ''}${_formatClassName(className)}',
                          style: const pw.TextStyle(
                            fontSize: 10,
                            color: PdfColors.grey700,
                          ),
                        ),
                        pw.SizedBox(height: 6),
                        pw.Text(
                          '$score%',
                          style: pw.TextStyle(
                            fontSize: 22,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColor.fromHex('059669'),
                          ),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          isAcademic
                              ? (totalObtained != null && totalMax != null
                                  ? 'Total: $totalObtained / $totalMax Marks'
                                  : 'Final Score')
                              : (presentDays != null && totalWorkingDays != null
                                  ? 'Present: $presentDays / $totalWorkingDays Days'
                                  : 'Attendance Rate'),
                          style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.grey700,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Signatures
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Container(width: 100, height: 1, color: PdfColors.grey500),
                          pw.SizedBox(height: 4),
                          pw.Text('Teacher Sign', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                      pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.end,
                        children: [
                          pw.Container(width: 100, height: 1, color: PdfColors.grey500),
                          pw.SizedBox(height: 4),
                          pw.Text('Principal Sign', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
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
      final timestamp = DateTime.now().millisecondsSinceEpoch.toString().substring(8);
      final filename = 'Certificate_${studentName.replaceAll(RegExp(r'\s+'), '_')}_$timestamp.pdf';

      String? savedPath;
      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          savedPath = await platform.invokeMethod<String>(
            'saveFileToDownloads',
            {
              'fileName': filename,
              'bytes': pdfBytes,
            },
          );
        } catch (_) {
          final extDir = await getExternalStorageDirectory();
          if (extDir != null) {
            final f = File('${extDir.path}/$filename');
            await f.writeAsBytes(pdfBytes);
            savedPath = f.path;
          }
        }
      } else {
        final appDocDir = await getApplicationDocumentsDirectory();
        final f = File('${appDocDir.path}/$filename');
        await f.writeAsBytes(pdfBytes);
        savedPath = f.path;
      }

      // Trigger top notification banner with tap-to-open capability
      try {
        await NotificationHelper.showDownloadNotification(
          title: 'Certificate Downloaded',
          fileName: filename,
          bytes: pdfBytes,
        );
      } catch (e) {
        debugPrint('Notification trigger error: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Certificate downloaded successfully!',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            action: SnackBarAction(
              label: 'OPEN',
              textColor: Colors.amber.shade300,
              onPressed: () async {
                await Printing.sharePdf(bytes: pdfBytes, filename: filename);
              },
            ),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download certificate: $e'),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showCertificateDialog(Map<String, dynamic> item) {
    final rank = item['rank'] ?? 1;
    final medal = rank == 1 ? '🥇' : rank == 2 ? '🥈' : '🥉';
    final isAcademic = (item['category'] ?? item['feature_type']) == 'academic_excellence';
    final level = item['level'] ?? (item['class_id'] == null ? 'school' : 'class');
    final meta = item['metadata'] is Map ? item['metadata'] : {};

    final presentDays = meta['present_days'];
    final totalWorkingDays = meta['total_working_days'];
    final totalObtained = meta['total_obtained'];
    final totalMax = meta['total_max'];

    final studentName = (item['student_name'] ?? 'Student').toString();
    final initials = studentName.isNotEmpty
        ? studentName.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join('').toUpperCase()
        : 'ST';

    final photoUrl = _getPhotoUrl(item['student_photo']?.toString());
    bool isDownloading = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          insetPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 480),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.amber.shade600, width: 4),
              color: Colors.white,
            ),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.amber.shade400, width: 2),
                color: Colors.white,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Top Close Icon Header
                    Align(
                      alignment: Alignment.topRight,
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.grey.shade100,
                          ),
                          child: const Icon(Icons.close, size: 18, color: Colors.grey),
                        ),
                      ),
                    ),

                    // School Name
                    Text(
                      _data['school_name'] ?? 'Jamiya Sams Academy',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade700,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Title
                    Text(
                      isAcademic
                          ? 'CERTIFICATE OF ACADEMIC EXCELLENCE'
                          : 'CERTIFICATE OF ATTENDANCE ACHIEVEMENT',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: Colors.black87,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Session
                    Text(
                      'Academic Session: ${_data['academic_year_name'] ?? '2026–2027'}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 8),
                    Divider(color: Colors.grey.shade300, thickness: 1),
                    const SizedBox(height: 8),

                    // Presentation text
                    Text(
                      'This certificate is honorably presented to the top ${isAcademic ? 'academic' : 'attendance'} achievers of',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey),
                    ),
                    const SizedBox(height: 4),

                    // Scope
                    Text(
                      level == 'school' ? 'SCHOOL OVERALL' : _formatClassScope(item['class_name']),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Colors.black87),
                    ),
                    const SizedBox(height: 4),

                    // Description
                    Text(
                      isAcademic
                          ? 'For demonstrating outstanding academic performance, subject mastery, and intellectual excellence.'
                          : 'For demonstrating exceptional commitment, consistency, and dedication to learning throughout the academic session.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade600, height: 1.3),
                    ),
                    const SizedBox(height: 14),

                    // CENTER CARD BOX
                    Container(
                      width: 240,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFDF5),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.amber.shade400, width: 2),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(medal, style: const TextStyle(fontSize: 26)),
                          Text(
                            'Rank #$rank',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: Colors.amber.shade900,
                            ),
                          ),
                          const SizedBox(height: 6),

                          // Avatar (25% size increase: 68x68)
                          Container(
                            width: 68,
                            height: 68,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.grey.shade200,
                              border: Border.all(color: Colors.amber.shade400, width: 2),
                            ),
                            alignment: Alignment.center,
                            child: photoUrl != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(34),
                                    child: Image.network(
                                      photoUrl,
                                      width: 68,
                                      height: 68,
                                      fit: BoxFit.cover,
                                      errorBuilder: (c, o, s) => Text(
                                        initials,
                                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
                                      ),
                                    ),
                                  )
                                : Text(
                                    initials,
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
                                  ),
                          ),
                          const SizedBox(height: 6),

                          // Name
                          Text(
                            studentName,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 14, fontStyle: FontStyle.normal, fontWeight: FontWeight.w900, color: Colors.black87),
                          ),
                          const SizedBox(height: 2),

                          // Roll & Class
                          Text(
                            '${item['roll_number'] != null ? 'Roll No. ${item['roll_number']} · ' : ''}${_formatClassName(item['class_name'])}',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey),
                          ),
                          const SizedBox(height: 6),

                          // Percentage
                          Text(
                            '${item['achievement_score']}%',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF059669),
                            ),
                          ),
                          const SizedBox(height: 2),

                          // Days / Marks detail
                          Text(
                            isAcademic
                                ? (totalObtained != null && totalMax != null ? 'Total: $totalObtained / $totalMax Marks' : 'Final Score')
                                : (presentDays != null && totalWorkingDays != null ? 'Present: $presentDays / $totalWorkingDays Days' : 'Attendance Rate'),
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Signatures
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(width: 80, height: 1, color: Colors.grey.shade400),
                            const SizedBox(height: 4),
                            const Text('Teacher Sign', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black87)),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Container(width: 80, height: 1, color: Colors.grey.shade400),
                            const SizedBox(height: 4),
                            const Text('Principal Sign', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black87)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Download Certificate Button with Spinner Loader
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isDownloading
                            ? null
                            : () async {
                                setModalState(() {
                                  isDownloading = true;
                                });
                                try {
                                  await _downloadCertificatePdf(item);
                                } finally {
                                  if (context.mounted) {
                                    setModalState(() {
                                      isDownloading = false;
                                    });
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.amber.shade800,
                          disabledBackgroundColor: Colors.amber.shade400,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: isDownloading
                            ? Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5,
                                    ),
                                  ),
                                  SizedBox(width: 10),
                                  Text(
                                    'Downloading Certificate...',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ],
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  Icon(Icons.download_rounded, color: Colors.white, size: 18),
                                  SizedBox(width: 8),
                                  Text(
                                    'Download Certificate',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ],
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

  Future<void> _fetchAndShowReportCard(Map<String, dynamic> item) async {
    final achievementId = item['id'];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/school/achievements/$achievementId/report-card');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
      );

      if (!mounted) return;
      Navigator.pop(context); // Close loader

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final rc = body['data'] ?? body;
        _showReportCardDialog(rc);
      } else {
        final body = json.decode(response.body);
        final msg = body['message'] ?? 'Report card access is restricted to authorized users.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading report card: $e'), backgroundColor: Colors.red.shade700),
      );
    }
  }

  void _showReportCardDialog(Map<String, dynamic> rc) {
    final subjects = (rc['subjects'] as List?) ?? [];

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Container(
          padding: const EdgeInsets.all(16),
          constraints: const BoxConstraints(maxHeight: 500),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    rc['student_name'] ?? 'Report Card',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF6EE7B7)),
                    ),
                    child: Text(
                      rc['result'] ?? 'PASS',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Class ${rc['class_name'] ?? ''} · Total: ${rc['total_obtained']}/${rc['total_max']} (${rc['percentage']}%)',
                style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
              ),
              const Divider(height: 20),
              Expanded(
                child: SingleChildScrollView(
                  child: Table(
                    border: TableBorder.all(color: Colors.grey.shade300, width: 1),
                    columnWidths: const {
                      0: FlexColumnWidth(2),
                      1: FlexColumnWidth(1),
                      2: FlexColumnWidth(1),
                    },
                    children: [
                      TableRow(
                        decoration: BoxDecoration(color: Colors.grey.shade100),
                        children: const [
                          Padding(padding: EdgeInsets.all(6), child: Text('Subject', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                          Padding(padding: EdgeInsets.all(6), child: Text('Marks', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                          Padding(padding: EdgeInsets.all(6), child: Text('Grade', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                        ],
                      ),
                      ...subjects.map((s) => TableRow(
                            children: [
                              Padding(padding: const EdgeInsets.all(6), child: Text(s['subject_name'] ?? '', style: const TextStyle(fontSize: 11))),
                              Padding(padding: const EdgeInsets.all(6), child: Text('${s['marks_obtained']}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
                              Padding(padding: const EdgeInsets.all(6), child: Text('${s['grade']}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
                            ],
                          )),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attItems = _filterCategory('attendance');
    final acadItems = _filterCategory('academic');

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Hall of Fame & Achievements',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: -0.2),
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: Colors.amber.shade800,
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: 'Attendance (${attItems.length})'),
            Tab(text: 'Academic (${acadItems.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.amber.shade50,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by student name or class...',
                      hintStyle: const TextStyle(fontSize: 12),
                      prefixIcon: const Icon(Icons.search, size: 18),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      fillColor: Colors.white,
                      filled: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Colors.amber),
                  onPressed: _fetchAchievements,
                ),
              ],
            ),
          ),

          // Content Tabs
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorText.isNotEmpty
                    ? Center(child: Text(_errorText, style: const TextStyle(color: Colors.red)))
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildGrid(attItems, false),
                          _buildGrid(acadItems, true),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildGrid(List<dynamic> items, bool isAcademic) {
    final groupedClasses = _groupClassAchievements(items);
    final schoolOverallList = _getSchoolOverallAchievements(items);

    if (groupedClasses.isEmpty && schoolOverallList.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.emoji_events_outlined, size: 48, color: Colors.grey),
            SizedBox(height: 8),
            Text('No achievements found', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    final classNames = groupedClasses.keys.toList()..sort();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Class Listing Cards
        ...classNames.map((cName) {
          final toppers = groupedClasses[cName]!;
          final isExpanded = _searchQuery.isNotEmpty || (_expandedClassKey == cName);

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.amber.shade400, width: 1.5),
            ),
            elevation: 2,
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                // Class Card Header
                ListTile(
                  tileColor: Colors.amber.shade50.withOpacity(0.7),
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.school_rounded, color: Colors.amber.shade900, size: 20),
                  ),
                  title: Text(
                    cName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black87),
                  ),
                  subtitle: Text(
                    '${toppers.length} Top Achievers (Rank 1 - Rank ${toppers.length})',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                  ),
                  trailing: Icon(
                    isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                    color: Colors.amber.shade900,
                  ),
                  onTap: () {
                    setState(() {
                      if (_expandedClassKey == cName) {
                        _expandedClassKey = null;
                      } else {
                        _expandedClassKey = cName;
                      }
                    });
                  },
                ),

                // Expanded Toppers List (Rank 1 at top -> Rank 2 in middle -> Rank 3 at bottom)
                if (isExpanded) ...[
                  const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: toppers.map((topper) => _buildTopperItemCard(topper, isAcademic)).toList(),
                    ),
                  ),
                ],
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildTopperItemCard(Map<String, dynamic> item, bool isAcademic) {
    final rank = item['rank'] ?? 1;
    final medal = rank == 1 ? '🥇' : rank == 2 ? '🥈' : '🥉';
    final borderCol = rank == 1 ? Colors.amber : rank == 2 ? Colors.grey.shade400 : Colors.amber.shade700;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: borderCol, width: 2),
      ),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(medal, style: const TextStyle(fontSize: 26)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['student_name'] ?? 'Student',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${_formatClassName(item['class_name'])} · Roll No. ${item['roll_number'] ?? '—'}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF6EE7B7)),
                  ),
                  child: Text(
                    '${item['achievement_score']}%',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _showCertificateDialog(item),
                    icon: const Icon(Icons.remove_red_eye_rounded, size: 16),
                    label: const Text('Certificate', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.amber.shade900,
                      side: BorderSide(color: Colors.amber.shade700),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                if (isAcademic) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _fetchAndShowReportCard(item),
                      icon: const Icon(Icons.assessment_rounded, size: 16),
                      label: const Text('Report Card', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber.shade800,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

extension ListFilter<T> on List<T> {
  List<T> filter(bool Function(T element) test) {
    return where(test).toList();
  }
}
