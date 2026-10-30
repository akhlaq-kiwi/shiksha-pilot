import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:school_hub/services/http_service.dart' as http_service;
import 'package:school_hub/services/leave_service.dart';
import 'package:school_hub/services/notification_helper.dart';

class PrincipalTarSettingsScreen extends StatefulWidget {
  final LeaveService leaveService;

  const PrincipalTarSettingsScreen({
    Key? key,
    required this.leaveService,
  }) : super(key: key);

  @override
  State<PrincipalTarSettingsScreen> createState() => _PrincipalTarSettingsScreenState();
}

class _PrincipalTarSettingsScreenState extends State<PrincipalTarSettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Settings State
  bool _isLoadingSettings = false;
  bool _isSavingSettings = false;
  String _entryHour = '08';
  String _entryMinute = '30';
  String _entryPeriod = 'AM';
  final TextEditingController _leavesController = TextEditingController(text: '0');
  final TextEditingController _penaltyController = TextEditingController(text: '0');

  // Baseline initial state for dirty check
  String _initialTime = '08:30 AM';
  String _initialLeaves = '0';
  String _initialPenalty = '0';

  // QR Code State
  bool _isLoadingQr = false;
  bool _isRefreshingQr = false;
  String _qrPayload = '';
  String _qrSchoolName = '';

  bool _hasSavedChanges = false;

  final List<String> _hours = List.generate(12, (i) => (i + 1).toString().padLeft(2, '0'));
  final List<String> _minutes = List.generate(12, (i) => (i * 5).toString().padLeft(2, '0'));
  final List<String> _periods = ['AM', 'PM'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _leavesController.addListener(() => setState(() {}));
    _penaltyController.addListener(() => setState(() {}));
    _loadSettings();
    _loadQrToken();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _leavesController.dispose();
    _penaltyController.dispose();
    super.dispose();
  }

  bool get _isDirty {
    final currentTime = '$_entryHour:$_entryMinute $_entryPeriod';
    final currentLeaves = _leavesController.text.trim();
    final currentPenalty = _penaltyController.text.trim();
    return currentTime != _initialTime ||
        currentLeaves != _initialLeaves ||
        currentPenalty != _initialPenalty;
  }

  void _parseTimeString(String timeStr) {
    try {
      final trimmed = timeStr.trim().toUpperCase();
      final parts = trimmed.split(' ');
      final period = parts.length > 1 ? parts[1] : 'AM';
      final timeParts = parts[0].split(':');
      final hour = timeParts[0].padLeft(2, '0');
      final minute = timeParts.length > 1 ? timeParts[1].padLeft(2, '0') : '00';

      setState(() {
        _entryHour = _hours.contains(hour) ? hour : '08';
        _entryMinute = _minutes.contains(minute) ? minute : '30';
        _entryPeriod = _periods.contains(period) ? period : 'AM';
        _initialTime = '$_entryHour:$_entryMinute $_entryPeriod';
      });
    } catch (_) {
      setState(() {
        _entryHour = '08';
        _entryMinute = '30';
        _entryPeriod = 'AM';
        _initialTime = '08:30 AM';
      });
    }
  }

  // ---------------------------------------------------------------------------
  // API Calls
  // ---------------------------------------------------------------------------

  Future<void> _loadSettings() async {
    setState(() => _isLoadingSettings = true);
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance/settings');

    try {
      final res = await http_service.get(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200) {
        final decoded = json.decode(res.body);
        final data = decoded['data'] ?? decoded;

        final rawTime = (data['entry_time'] as String?) ?? '08:30 AM';
        _parseTimeString(rawTime);

        final leaves = data['allowed_leaves'] != null ? data['allowed_leaves'].toString() : '0';
        final penalty = data['late_penalty_amount'] != null ? data['late_penalty_amount'].toString() : '0';

        setState(() {
          _leavesController.text = leaves;
          _penaltyController.text = penalty;
          _initialLeaves = leaves;
          _initialPenalty = penalty;
        });
      }
    } catch (e) {
      _showSnackBar('Failed to load configurations: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoadingSettings = false);
    }
  }

  Future<void> _loadQrToken() async {
    setState(() => _isLoadingQr = true);
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance/qr-token');

    try {
      final res = await http_service.get(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200) {
        final decoded = json.decode(res.body);
        final data = decoded['data'] ?? decoded;
        setState(() {
          _qrPayload = (data['qr_payload'] as String?) ?? '';
          _qrSchoolName = (data['school_name'] as String?) ?? 'School Attendance';
        });
      }
    } catch (e) {
      _showSnackBar('Failed to load QR code: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoadingQr = false);
    }
  }

  Future<void> _saveSettings() async {
    if (!_isDirty) return;

    setState(() => _isSavingSettings = true);
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance/settings');
    final formattedTime = '$_entryHour:$_entryMinute $_entryPeriod';

    try {
      final leavesVal = int.tryParse(_leavesController.text.trim()) ?? 0;
      final penaltyVal = double.tryParse(_penaltyController.text.trim()) ?? 0.0;

      final res = await http_service.post(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: json.encode({
          'entry_time': formattedTime,
          'allowed_leaves': leavesVal,
          'late_penalty_amount': penaltyVal,
        }),
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        _hasSavedChanges = true;
        setState(() {
          _initialTime = formattedTime;
          _initialLeaves = _leavesController.text.trim();
          _initialPenalty = _penaltyController.text.trim();
        });
        _showSnackBar('Teacher attendance configurations updated successfully.');
      } else {
        _showSnackBar('Failed to update configurations (${res.statusCode})', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error updating configurations: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSavingSettings = false);
    }
  }

  Future<void> _regenerateQrToken() async {
    setState(() => _isRefreshingQr = true);
    final url = Uri.parse('${widget.leaveService.baseUrl}/api/school/teacher-attendance/qr-token/refresh');

    try {
      final res = await http_service.post(
        url,
        headers: {
          'Authorization': 'Bearer ${widget.leaveService.token}',
          'Accept': 'application/json',
        },
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        final decoded = json.decode(res.body);
        final data = decoded['data'] ?? decoded;
        setState(() {
          _qrPayload = (data['qr_payload'] as String?) ?? '';
          _qrSchoolName = (data['school_name'] as String?) ?? _qrSchoolName;
        });
        _showSnackBar('QR Code regenerated successfully! Previous QR code is now expired.');
      } else {
        _showSnackBar('Failed to regenerate QR code (${res.statusCode})', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error regenerating QR code: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isRefreshingQr = false);
    }
  }

  void _showRegenerateConfirmationDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: const [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 24),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Regenerate Attendance QR Code?',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
              ),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to regenerate the Teacher Attendance QR Code? Once regenerated, the previous QR code will immediately expire and teachers will need to scan the new QR code to mark their attendance.',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _regenerateQrToken();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Regenerate QR Code', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadQrCodePdf() async {
    if (_qrPayload.isEmpty) return;

    try {
      final doc = pw.Document();
      final schoolTitle = _qrSchoolName.isNotEmpty ? _qrSchoolName : 'School Attendance';

      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (pw.Context context) {
            return pw.Center(
              child: pw.Column(
                mainAxisAlignment: pw.MainAxisAlignment.center,
                children: [
                  pw.Text(
                    schoolTitle,
                    style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold, color: PdfColors.blueGrey900),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    'Teacher Attendance QR Code',
                    style: pw.TextStyle(fontSize: 16, color: PdfColors.grey700),
                  ),
                  pw.SizedBox(height: 28),
                  pw.BarcodeWidget(
                    barcode: pw.Barcode.qrCode(),
                    data: _qrPayload,
                    width: 260,
                    height: 260,
                  ),
                  pw.SizedBox(height: 24),
                  pw.Text(
                    'Display or print this QR Code at the school entrance for teachers to scan via the Teacher Mobile App.',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(fontSize: 11, color: PdfColors.grey600),
                  ),
                ],
              ),
            );
          },
        ),
      );

      final safeName = schoolTitle.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
      final defaultFilename = 'Teacher_Attendance_QR_$safeName.pdf';
      final Uint8List pdfBytes = await doc.save();

      String? savedPath;
      if (Platform.isAndroid) {
        const platform = MethodChannel('com.shikshapilot.schoolhub/battery');
        try {
          savedPath = await platform.invokeMethod<String>(
            'saveFileToDownloads',
            {
              'fileName': defaultFilename,
              'bytes': pdfBytes,
            },
          );
        } catch (_) {
          final extDir = await getExternalStorageDirectory();
          if (extDir != null) {
            final f = File('${extDir.path}/$defaultFilename');
            await f.writeAsBytes(pdfBytes);
            savedPath = f.path;
          }
        }
      } else {
        final appDocDir = await getApplicationDocumentsDirectory();
        final f = File('${appDocDir.path}/$defaultFilename');
        await f.writeAsBytes(pdfBytes);
        savedPath = f.path;
      }

      if (savedPath != null) {
        debugPrint('File saved to: $savedPath');
      }

      // Trigger top notification with tap-to-open capability
      try {
        await NotificationHelper.showDownloadNotification(
          title: 'QR Code Downloaded Successfully',
          fileName: defaultFilename,
          bytes: pdfBytes,
        );
      } catch (e) {
        debugPrint('Download notification trigger error: $e');
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
                    'QR Code downloaded successfully to File Manager!',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF0F766E),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      _showSnackBar('Failed to download QR code: $e', isError: true);
    }
  }

  void _showSnackBar(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF0F766E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Build Methods
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        Navigator.pop(context, _hasSavedChanges);
        return false;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFBF8F2),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
          titleSpacing: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 20),
            onPressed: () => Navigator.pop(context, _hasSavedChanges),
          ),
          title: const Text(
            'SETTINGS & QR CODE',
            style: TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 0.6,
            ),
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(48),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
              ),
              child: TabBar(
                controller: _tabController,
                splashFactory: NoSplash.splashFactory,
                overlayColor: const WidgetStatePropertyAll(Colors.transparent),
                labelColor: const Color(0xFF0F766E),
                unselectedLabelColor: const Color(0xFF64748B),
                indicatorColor: const Color(0xFF0F766E),
                indicatorWeight: 3,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                tabs: const [
                  Tab(
                    icon: Icon(Icons.tune_rounded, size: 16),
                    text: 'Configurations',
                  ),
                  Tab(
                    icon: Icon(Icons.qr_code_2_rounded, size: 18),
                    text: 'Attendance QR Code',
                  ),
                ],
              ),
            ),
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildConfigurationsTab(),
            _buildQrCodeTab(),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TAB 1: CONFIGURATIONS
  // ===========================================================================

  Widget _buildConfigurationsTab() {
    if (_isLoadingSettings) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)));
    }

    final isDirty = _isDirty;

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: _loadSettings,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade200, width: 1.2),
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
                // Header Row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(Icons.access_time_rounded, color: Colors.amber.shade800, size: 18),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Teacher Attendance Configurations',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),

                // 1. Official Teacher Entry Time
                const Text(
                  'OFFICIAL TEACHER ENTRY TIME',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF334155), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    // Hour Dropdown
                    Expanded(
                      child: _buildTimeDropdown(
                        value: _entryHour,
                        items: _hours,
                        onChanged: (v) => setState(() => _entryHour = v!),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Minute Dropdown
                    Expanded(
                      child: _buildTimeDropdown(
                        value: _entryMinute,
                        items: _minutes,
                        onChanged: (v) => setState(() => _entryMinute = v!),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Period Dropdown
                    Expanded(
                      child: _buildTimeDropdown(
                        value: _entryPeriod,
                        items: _periods,
                        onChanged: (v) => setState(() => _entryPeriod = v!),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Teachers scanning after this time will be automatically flagged as Late.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),

                const SizedBox(height: 20),

                // 2. Allowed Teacher Leaves for each month
                const Text(
                  'ALLOWED TEACHER LEAVES FOR EACH MONTH',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF334155), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _leavesController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'If configured, leaves beyond this limit will automatically calculate extra unpaid leave deduction on monthly salary cards.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),

                const SizedBox(height: 20),

                // 3. Late Entry Penalty Amount per day (₹)
                const Text(
                  'LATE ENTRY PENALTY AMOUNT PER DAY (₹)',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF334155), letterSpacing: 0.5),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _penaltyController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    prefixText: '₹ ',
                    prefixStyle: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'If configured (e.g. ₹10 per day late), per day late entries will automatically deduct penalty amount from monthly teacher salary cards.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),

                const SizedBox(height: 26),

                // Save Settings Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: isDirty && !_isSavingSettings ? _saveSettings : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDirty ? const Color(0xFF0F766E) : const Color(0xFFE2E8F0),
                      foregroundColor: isDirty ? Colors.white : const Color(0xFF94A3B8),
                      elevation: isDirty ? 2 : 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSavingSettings
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text(
                            isDirty ? 'Save Settings' : 'Saved',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                              color: isDirty ? Colors.white : const Color(0xFF94A3B8),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeDropdown({
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Builder(
      builder: (btnContext) {
        return InkWell(
          onTap: () async {
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
              elevation: 6,
              constraints: BoxConstraints(
                minWidth: size.width,
                maxWidth: size.width,
                maxHeight: 280,
              ),
              items: items.map((item) {
                final isSelected = item == value;
                return PopupMenuItem<String>(
                  value: item,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Center(
                    child: Text(
                      item,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                        color: isSelected ? const Color(0xFF0F766E) : const Color(0xFF1E293B),
                      ),
                    ),
                  ),
                );
              }).toList(),
            );

            if (selected != null) {
              onChanged(selected);
            }
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Center(
                    child: Text(
                      value,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                    ),
                  ),
                ),
                const Icon(Icons.arrow_drop_down, color: Color(0xFF0F766E), size: 18),
              ],
            ),
          ),
        );
      },
    );
  }

  // ===========================================================================
  // TAB 2: ATTENDANCE QR CODE
  // ===========================================================================

  Widget _buildQrCodeTab() {
    if (_isLoadingQr) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)));
    }

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: _loadQrToken,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade200, width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(
              children: [
                // Card Title
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: Colors.teal.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.qr_code_2_rounded, color: Color(0xFF0F766E), size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Teacher Attendance QR Code',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),

                // QR Container
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.grey.shade300, width: 1.5),
                  ),
                  child: _qrPayload.isNotEmpty
                      ? QrImageView(
                          data: _qrPayload,
                          version: QrVersions.auto,
                          size: 210,
                          backgroundColor: Colors.white,
                        )
                      : Container(
                          width: 210,
                          height: 210,
                          alignment: Alignment.center,
                          child: const Text('No QR Code available', style: TextStyle(color: Colors.grey)),
                        ),
                ),

                const SizedBox(height: 14),

                // School Name
                Text(
                  _qrSchoolName.isNotEmpty ? _qrSchoolName : 'School Attendance',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Display or print this QR Code at the school entrance for teachers to scan via the Teacher Mobile App.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: 20),

                // Action Buttons Row
                Row(
                  children: [
                    // Download QR Code
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _downloadQrCodePdf,
                        icon: const Icon(Icons.download_rounded, size: 16),
                        label: const Text('Download QR Code'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          elevation: 1,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Regenerate QR Code
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _isRefreshingQr ? null : _showRegenerateConfirmationDialog,
                        icon: _isRefreshingQr
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.refresh_rounded, size: 16),
                        label: Text(_isRefreshingQr ? 'Refreshing...' : 'Regenerate QR Code'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          elevation: 1,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
