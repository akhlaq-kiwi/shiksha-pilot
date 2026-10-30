import 'package:school_hub/screens/attachment_gallery_screen.dart';
import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:school_hub/screens/teachers_screen.dart' show kIndianStatesAndCities;
import 'package:school_hub/services/class_management_service.dart';

// ----------------------------------------------------------------------------
// PREDEFINED CLASSES HELPERS (Mirrors web predefinedClasses.js)
// ----------------------------------------------------------------------------
const List<Map<String, String>> kPredefinedClasses = [
  {'name': 'Pre Nursery', 'category': 'Pre-Primary'},
  {'name': 'Nursery', 'category': 'Pre-Primary'},
  {'name': 'Lower Kindergarten (LKG)', 'category': 'Pre-Primary'},
  {'name': 'Upper Kindergarten (UKG)', 'category': 'Pre-Primary'},
  {'name': 'KG', 'category': 'Pre-Primary'},
  {'name': 'Class 1', 'category': 'Primary'},
  {'name': 'Class 2', 'category': 'Primary'},
  {'name': 'Class 3', 'category': 'Primary'},
  {'name': 'Class 4', 'category': 'Primary'},
  {'name': 'Class 5', 'category': 'Primary'},
  {'name': 'Class 6', 'category': 'Middle'},
  {'name': 'Class 7', 'category': 'Middle'},
  {'name': 'Class 8', 'category': 'Middle'},
  {'name': 'Class 9', 'category': 'Secondary'},
  {'name': 'Class 10', 'category': 'Secondary'},
  {'name': 'Class 11', 'category': 'Senior Secondary'},
  {'name': 'Class 12', 'category': 'Senior Secondary'},
];

const List<String> kAlphabetSections = ['A', 'B', 'C', 'D'];
const List<String> kColorSections = ['Red', 'Blue', 'Green', 'Yellow'];

String getShortClassName(String className) {
  if (className.isEmpty) return '';
  final lower = className.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

  if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower == 'lkg') {
    return 'LKG';
  }
  if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower == 'ukg') {
    return 'UKG';
  }
  if (lower == 'playgroup' || lower == 'pg') {
    return 'Playgroup';
  }
  if (lower.contains('prenursery') || lower == 'pnc') {
    return 'PNC';
  }
  if (lower.contains('nursery') || lower == 'nc') {
    return 'NC';
  }
  if (lower == 'kg' || lower == 'kindergarten') {
    return 'KG';
  }
  return className.trim();
}

int getClassIndex(String className) {
  if (className.isEmpty) return -1;
  final clean = className.trim();
  final lower = clean.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

  if (lower.contains('prenursery') || lower == 'pnc' || lower == 'playgroup' || lower == 'pg') {
    return kPredefinedClasses.indexWhere((c) => c['name'] == 'Pre Nursery');
  }
  if (lower.contains('nursery') || lower == 'nc') {
    return kPredefinedClasses.indexWhere((c) => c['name'] == 'Nursery');
  }
  if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower == 'lkg') {
    return kPredefinedClasses.indexWhere((c) => c['name']!.contains('LKG'));
  }
  if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower == 'ukg') {
    return kPredefinedClasses.indexWhere((c) => c['name']!.contains('UKG'));
  }
  if (lower == 'kg' || lower == 'kindergarten') {
    return kPredefinedClasses.indexWhere((c) => c['name'] == 'KG');
  }

  final idx = kPredefinedClasses.indexWhere((c) => c['name']!.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '') == lower);
  if (idx != -1) return idx;

  final match = RegExp(r'\d+').firstMatch(clean);
  if (match != null) {
    final num = int.tryParse(match.group(0)!) ?? 0;
    return 4 + num;
  }
  return -1;
}

List<Map<String, dynamic>> getEligibleNextClasses(String currentClassName, List<Map<String, dynamic>> schoolClasses) {
  final currentIdx = getClassIndex(currentClassName);
  if (currentIdx == -1) return [];
  return schoolClasses.where((c) => getClassIndex(c['name']?.toString() ?? '') > currentIdx).toList();
}

// ----------------------------------------------------------------------------
// MAIN CLASSES SCREEN
// ----------------------------------------------------------------------------
class ClassesScreen extends StatefulWidget {
  final ClassManagementService classService;
  final String userRole;
  final bool isPrincipal;
  final bool isFeeCollector;

  const ClassesScreen({
    super.key,
    required this.classService,
    required this.userRole,
    this.isPrincipal = false,
    this.isFeeCollector = false,
  });

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  bool _isLoading = true;
  String _errorMessage = '';
  String _successBanner = '';
  Timer? _bannerTimer;

  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _students = [];
  Map<String, dynamic> _schoolProfile = {};
  List<Map<String, dynamic>> _academicYears = [];

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    super.dispose();
  }

  void _showSuccess(String message) {
    _bannerTimer?.cancel();
    setState(() {
      _successBanner = message;
    });
    _bannerTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _successBanner = '';
        });
      }
    });
  }

  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final results = await Future.wait([
        widget.classService.getClasses(),
        widget.classService.getStudents(),
        widget.classService.getSchoolProfile(),
        widget.classService.getAcademicYears(),
      ]);

      if (!mounted) return;

      setState(() {
        _classes = results[0] as List<Map<String, dynamic>>;
        _students = results[1] as List<Map<String, dynamic>>;
        _schoolProfile = results[2] as Map<String, dynamic>;
        _academicYears = results[3] as List<Map<String, dynamic>>;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
        _isLoading = false;
      });
    }
  }

  /// Groups classes by base name (merging sections into one class card, identical to web)
  List<Map<String, dynamic>> get _groupedClasses {
    final Map<String, Map<String, dynamic>> grouped = {};

    for (final c in _classes) {
      final name = (c['name'] ?? '').toString().trim();
      if (name.isEmpty) continue;

      final section = (c['section'] ?? '').toString().trim();
      final classId = int.tryParse(c['id']?.toString() ?? '0') ?? 0;

      if (!grouped.containsKey(name)) {
        grouped[name] = {
          'name': name,
          'sections': <String>[],
          'classIds': <int>[],
          'originalNames': <String>[],
          'studentCount': 0,
        };
      }

      if (section.isNotEmpty && !(grouped[name]!['sections'] as List<String>).contains(section)) {
        (grouped[name]!['sections'] as List<String>).add(section);
      }
      if (classId > 0 && !(grouped[name]!['classIds'] as List<int>).contains(classId)) {
        (grouped[name]!['classIds'] as List<int>).add(classId);
      }
      if (!(grouped[name]!['originalNames'] as List<String>).contains(name)) {
        (grouped[name]!['originalNames'] as List<String>).add(name);
      }
    }

    // Calculate student count per grouped class and collect any student sections
    for (final s in _students) {
      final clsName = (s['class_name'] ?? s['class'] ?? '').toString().trim();
      final sec = (s['section'] ?? '').toString().trim();
      if (grouped.containsKey(clsName)) {
        grouped[clsName]!['studentCount'] = (grouped[clsName]!['studentCount'] as int) + 1;
        if (sec.isNotEmpty && !(grouped[clsName]!['sections'] as List<String>).contains(sec)) {
          (grouped[clsName]!['sections'] as List<String>).add(sec);
        }
      }
    }

    for (final g in grouped.values) {
      (g['sections'] as List<String>).sort();
    }

    final list = grouped.values.toList();
    list.sort((a, b) {
      final idxA = getClassIndex(a['name']);
      final idxB = getClassIndex(b['name']);
      if (idxA != -1 && idxB != -1) return idxA - idxB;
      if (idxA != -1) return -1;
      if (idxB != -1) return 1;
      return (a['name'] as String).compareTo(b['name'] as String);
    });

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedClasses;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF8F5),
      appBar: AppBar(
        title: const Text(
          'Classes',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 20,
            letterSpacing: -0.3,
            color: Color(0xFF0F172A),
          ),
        ),
        centerTitle: false,
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      body: RefreshIndicator(
        onRefresh: _loadAllData,
        color: const Color(0xFFD97706),
        child: _isLoading
            ? const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Color(0xFFD97706)),
                    SizedBox(height: 12),
                    Text(
                      'LOADING CLASSES...',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.1,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              )
            : CustomScrollView(
                slivers: [
                  // Top Banner Header Container
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_successBanner.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFF86EFAC)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _successBanner,
                                      style: const TextStyle(
                                        color: Color(0xFF15803D),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          if (_errorMessage.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFFCA5A5)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _errorMessage,
                                      style: const TextStyle(
                                        color: Color(0xFFB91C1C),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.close, size: 16, color: Color(0xFFB91C1C)),
                                    onPressed: () => setState(() => _errorMessage = ''),
                                  ),
                                ],
                              ),
                            ),

                          // Classes Header Container (Matching web design)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.02),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'CLASSES',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                ElevatedButton.icon(
                                  onPressed: _openAddClassDialog,
                                  icon: const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                                  label: const Text(
                                    'ADD CLASS',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: Colors.white,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD97706),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Classes Grid (Matching web screenshot exactly)
                  if (grouped.isEmpty)
                    SliverToBoxAdapter(
                      child: Container(
                        margin: const EdgeInsets.all(24),
                        padding: const EdgeInsets.all(36),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Center(
                          child: Text(
                            'No classes registered. Click "+ ADD CLASS" above to get started.',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      sliver: SliverGrid(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 1.6,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final gc = grouped[index];
                            return _buildClassCard(gc);
                          },
                          childCount: grouped.length,
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }

  Widget _buildClassCard(Map<String, dynamic> gc) {
    final String fullName = gc['name']?.toString() ?? 'Class';
    final String displayName = getShortClassName(fullName);
    final int studentCount = gc['studentCount'] as int? ?? 0;
    final List<String> sections = (gc['sections'] as List<String>?) ?? [];
    final bool hasSections = sections.isNotEmpty;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => _openClassRoster(fullName),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Stack(
            children: [
              // Centered Class Name
              Center(
                child: Text(
                  displayName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),

              // Top Right 3-dots Menu
              Positioned(
                top: 0,
                right: 0,
                child: PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF64748B)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  onSelected: (action) => _handleClassMenuAction(action, gc),
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'manage_sections',
                      child: Row(
                        children: [
                          Icon(Icons.tune_rounded, size: 16, color: Color(0xFFD97706)),
                          SizedBox(width: 8),
                          Text('Manage Sections', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    if (hasSections)
                      const PopupMenuItem(
                        value: 'transfer_students',
                        child: Row(
                          children: [
                            Icon(Icons.swap_horiz_rounded, size: 16, color: Color(0xFF4F46E5)),
                            SizedBox(width: 8),
                            Text('Transfer Students', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    const PopupMenuItem(
                      value: 'delete_class',
                      child: Row(
                        children: [
                          Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                          SizedBox(width: 8),
                          Text('Delete Class', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFDC2626))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Bottom Student count
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '$studentCount students',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleClassMenuAction(String action, Map<String, dynamic> gc) {
    switch (action) {
      case 'manage_sections':
        _openManageSectionsDialog(gc);
        break;
      case 'transfer_students':
        _openTransferStudentsModal(gc);
        break;
      case 'delete_class':
        _handleDeleteClass(gc);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // CLASS ROSTER (VIEW STUDENTS)
  // --------------------------------------------------------------------------
  void _openClassRoster(String className) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _ClassRosterScreen(
          className: className,
          allClasses: _classes,
          allStudents: _students,
          schoolProfile: _schoolProfile,
          academicYears: _academicYears,
          classService: widget.classService,
        ),
      ),
    ).then((_) => _loadAllData());
  }

  // --------------------------------------------------------------------------
  // ADD CLASS MODAL
  // --------------------------------------------------------------------------
  void _openAddClassDialog() {
    final addedLower = _classes.map((c) => (c['name'] ?? '').toString().trim().toLowerCase()).toSet();
    final available = kPredefinedClasses.where((p) => !addedLower.contains(p['name']!.toLowerCase())).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AddClassModal(
        availableClasses: available,
        classService: widget.classService,
        onSuccess: (msg) {
          Navigator.pop(context);
          _showSuccess(msg);
          _loadAllData();
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // MANAGE SECTIONS MODAL
  // --------------------------------------------------------------------------
  void _openManageSectionsDialog(Map<String, dynamic> gc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ManageSectionsModal(
        classGroup: gc,
        classService: widget.classService,
        onSuccess: (msg) {
          Navigator.pop(context);
          _showSuccess(msg);
          _loadAllData();
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // TRANSFER STUDENTS MODAL
  // --------------------------------------------------------------------------
  void _openTransferStudentsModal(Map<String, dynamic> gc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TransferStudentsModal(
        classGroup: gc,
        allStudents: _students,
        classService: widget.classService,
        onSuccess: (msg) {
          Navigator.pop(context);
          _showSuccess(msg);
          _loadAllData();
        },
      ),
    );
  }

  // --------------------------------------------------------------------------
  // DELETE CLASS (With exact web conditions)
  // --------------------------------------------------------------------------
  void _handleDeleteClass(Map<String, dynamic> gc) {
    final int studentCount = gc['studentCount'] as int? ?? 0;
    final String className = gc['name']?.toString() ?? '';

    // Condition 1: If students are currently enrolled, cannot delete!
    if (studentCount > 0) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 22),
              SizedBox(width: 8),
              Text('Cannot Delete Class', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
          content: const Text(
            'This action can not be done because students are currently enrolled in this class.\n\nPlease transfer or remove all students before deleting this class.',
            style: TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF475569)),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
              child: const Text('OK', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
      return;
    }

    // Condition 2: Confirmation dialog
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Class', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
        content: Text(
          'Are you sure you want to delete "$className"?\n\nThis class will be permanently removed.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              try {
                await widget.classService.deleteClass(className);
                _showSuccess('Class "$className" deleted successfully.');
                _loadAllData();
              } catch (e) {
                setState(() {
                  _isLoading = false;
                  _errorMessage = e.toString().replaceAll('Exception:', '').trim();
                });
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CLASS IDENTITY CARDS
  // --------------------------------------------------------------------------
  // ignore: unused_element
  void _openClassIdCards(String className) {
    final classStudents = _students.where((s) {
      final cName = (s['class_name'] ?? s['class'] ?? '').toString().trim();
      return cName.toLowerCase() == className.toLowerCase();
    }).toList();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _ClassIdCardsPreviewScreen(
          className: className,
          students: classStudents,
          schoolProfile: _schoolProfile,
          academicYears: _academicYears,
          classService: widget.classService,
        ),
      ),
    );
  }
}

// ============================================================================
// ADD CLASS MODAL (Supports multi-select or single class with sections)
// ============================================================================
class _AddClassModal extends StatefulWidget {
  final List<Map<String, String>> availableClasses;
  final ClassManagementService classService;
  final Function(String) onSuccess;

  const _AddClassModal({
    required this.availableClasses,
    required this.classService,
    required this.onSuccess,
  });

  @override
  State<_AddClassModal> createState() => _AddClassModalState();
}

class _AddClassModalState extends State<_AddClassModal> {
  final Set<String> _selectedClassNames = {};
  String _sectionType = 'Alphabet Sections'; // 'Alphabet Sections' | 'Color Sections' | ''
  final Set<String> _selectedSections = {};
  bool _saving = false;
  String _error = '';

  List<String> get _currentSectionPool =>
      _sectionType == 'Color Sections' ? kColorSections : kAlphabetSections;

  Future<void> _handleSave() async {
    if (_selectedClassNames.isEmpty) {
      setState(() => _error = 'Please select at least one class.');
      return;
    }

    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      if (_selectedClassNames.length == 1) {
        // Single class with custom sections
        final name = _selectedClassNames.first;
        await widget.classService.createClass(
          name: name,
          sections: _selectedSections.toList(),
        );
        widget.onSuccess('Class "$name" created successfully.');
      } else {
        // Multiple classes creation
        for (final name in _selectedClassNames) {
          await widget.classService.createClass(name: name, sections: []);
        }
        widget.onSuccess('${_selectedClassNames.length} classes created successfully.');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final available = widget.availableClasses;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Add Class',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Body
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w700)),
                    ),

                  const Text(
                    'SELECT CLASSES TO ADD',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 10),

                  if (available.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Text('All standard classes are already registered.', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: available.map((c) {
                        final name = c['name']!;
                        final isSelected = _selectedClassNames.contains(name);
                        return FilterChip(
                          label: Text(
                            name,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: isSelected ? Colors.white : const Color(0xFF334155),
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: const Color(0xFFD97706),
                          backgroundColor: const Color(0xFFF1F5F9),
                          checkmarkColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                            side: BorderSide(
                              color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          onSelected: (val) {
                            setState(() {
                              if (val) {
                                _selectedClassNames.add(name);
                              } else {
                                _selectedClassNames.remove(name);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),

                  // If single class selected: Sections configuration section
                  if (_selectedClassNames.length == 1) ...[
                    const SizedBox(height: 24),
                    const Text(
                      'SECTIONS (OPTIONAL)',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 8),

                    // Section Type selector
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Alphabet (A, B, C, D)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                            selected: _sectionType == 'Alphabet Sections',
                            selectedColor: const Color(0xFF0F172A),
                            labelStyle: TextStyle(color: _sectionType == 'Alphabet Sections' ? Colors.white : const Color(0xFF334155)),
                            onSelected: (_) => setState(() {
                              _sectionType = 'Alphabet Sections';
                              _selectedSections.clear();
                            }),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ChoiceChip(
                            label: const Center(child: Text('Color (Red, Blue...)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                            selected: _sectionType == 'Color Sections',
                            selectedColor: const Color(0xFF0F172A),
                            labelStyle: TextStyle(color: _sectionType == 'Color Sections' ? Colors.white : const Color(0xFF334155)),
                            onSelected: (_) => setState(() {
                              _sectionType = 'Color Sections';
                              _selectedSections.clear();
                            }),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _currentSectionPool.map((sec) {
                        final isSelected = _selectedSections.contains(sec);
                        return FilterChip(
                          label: Text(
                            sec,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                              color: isSelected ? Colors.white : const Color(0xFF334155),
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: const Color(0xFF059669),
                          checkmarkColor: Colors.white,
                          onSelected: (val) {
                            setState(() {
                              if (val) {
                                if (_selectedSections.length >= 4) {
                                  _error = 'Maximum 4 sections allowed.';
                                  return;
                                }
                                _selectedSections.add(sec);
                              } else {
                                _selectedSections.remove(sec);
                              }
                            });
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Action Buttons Footer
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saving || _selectedClassNames.isEmpty ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Add Class (${_selectedClassNames.length})', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// MANAGE SECTIONS MODAL
// ============================================================================
class _ManageSectionsModal extends StatefulWidget {
  final Map<String, dynamic> classGroup;
  final ClassManagementService classService;
  final Function(String) onSuccess;

  const _ManageSectionsModal({
    required this.classGroup,
    required this.classService,
    required this.onSuccess,
  });

  @override
  State<_ManageSectionsModal> createState() => _ManageSectionsModalState();
}

class _ManageSectionsModalState extends State<_ManageSectionsModal> {
  late String _className;
  String _sectionType = 'Alphabet Sections';
  final Set<String> _selectedSections = {};
  bool _saving = false;
  String _error = '';

  List<String> get _currentSectionPool =>
      _sectionType == 'Color Sections' ? kColorSections : kAlphabetSections;

  @override
  void initState() {
    super.initState();
    _className = widget.classGroup['name']?.toString() ?? '';
    final existingSecs = widget.classGroup['sections'] as List<String>? ?? [];
    _selectedSections.addAll(existingSecs);

    if (existingSecs.isNotEmpty) {
      final first = existingSecs.first;
      if (kColorSections.any((c) => c.toLowerCase() == first.toLowerCase())) {
        _sectionType = 'Color Sections';
      }
    }
  }

  Future<void> _handleSave() async {
    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      await widget.classService.updateClass(
        oldName: _className,
        name: _className,
        sections: _selectedSections.toList(),
      );
      widget.onSuccess('Sections updated for "$_className".');
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Manage Sections: $_className',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
              ),
              IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const Divider(height: 16),
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
              child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
            ),

          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Center(child: Text('Alphabet (A, B, C, D)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                  selected: _sectionType == 'Alphabet Sections',
                  selectedColor: const Color(0xFF0F172A),
                  labelStyle: TextStyle(color: _sectionType == 'Alphabet Sections' ? Colors.white : const Color(0xFF334155)),
                  onSelected: (_) => setState(() {
                    _sectionType = 'Alphabet Sections';
                    _selectedSections.clear();
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  label: const Center(child: Text('Color (Red, Blue...)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
                  selected: _sectionType == 'Color Sections',
                  selectedColor: const Color(0xFF0F172A),
                  labelStyle: TextStyle(color: _sectionType == 'Color Sections' ? Colors.white : const Color(0xFF334155)),
                  onSelected: (_) => setState(() {
                    _sectionType = 'Color Sections';
                    _selectedSections.clear();
                  }),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _currentSectionPool.map((sec) {
              final isSelected = _selectedSections.contains(sec);
              return FilterChip(
                label: Text(
                  sec,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    color: isSelected ? Colors.white : const Color(0xFF334155),
                  ),
                ),
                selected: isSelected,
                selectedColor: const Color(0xFF059669),
                checkmarkColor: Colors.white,
                onSelected: (val) {
                  setState(() {
                    if (val) {
                      if (_selectedSections.length >= 4) {
                        _error = 'Maximum 4 sections allowed.';
                        return;
                      }
                      _selectedSections.add(sec);
                    } else {
                      _selectedSections.remove(sec);
                    }
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 20),

          ElevatedButton(
            onPressed: _saving ? null : _handleSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD97706),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// TRANSFER STUDENTS MODAL
// ============================================================================
class _TransferStudentsModal extends StatefulWidget {
  final Map<String, dynamic> classGroup;
  final List<Map<String, dynamic>> allStudents;
  final ClassManagementService classService;
  final Function(String) onSuccess;

  const _TransferStudentsModal({
    required this.classGroup,
    required this.allStudents,
    required this.classService,
    required this.onSuccess,
  });

  @override
  State<_TransferStudentsModal> createState() => _TransferStudentsModalState();
}

class _TransferStudentsModalState extends State<_TransferStudentsModal> {
  String _sourceSection = '';
  String _destSection = '';
  final Set<int> _selectedStudentIds = {};
  bool _isSubmitting = false;
  String _error = '';

  List<String> get _sections {
    final raw = (widget.classGroup['sections'] as List<String>? ?? []).toList();
    raw.sort();
    return raw;
  }

  List<Map<String, dynamic>> get _sourceStudents {
    if (_sourceSection.isEmpty) return [];
    final fullName = (widget.classGroup['name'] ?? '').toString().trim().toLowerCase();
    final shortName = getShortClassName(widget.classGroup['name'] ?? '').toLowerCase();

    final list = widget.allStudents.where((s) {
      final cName = (s['class_name'] ?? s['class'] ?? '').toString().trim().toLowerCase();
      final matchClass = cName == fullName || cName == shortName;
      final sec = (s['section'] ?? '').toString().trim().toUpperCase();
      final matchSec = sec == _sourceSection.trim().toUpperCase();
      final status = (s['status'] ?? 'ACTIVE').toString().toUpperCase();
      return matchClass && matchSec && status == 'ACTIVE';
    }).toList();

    list.sort((a, b) {
      final rollA = int.tryParse((a['roll_no'] ?? a['roll'] ?? '999999').toString()) ?? 999999;
      final rollB = int.tryParse((b['roll_no'] ?? b['roll'] ?? '999999').toString()) ?? 999999;
      if (rollA != rollB) return rollA.compareTo(rollB);
      return (a['name'] ?? '').toString().compareTo((b['name'] ?? '').toString());
    });
    return list;
  }

  Future<void> _handleTransfer() async {
    if (_sourceSection.isEmpty || _destSection.isEmpty || _selectedStudentIds.isEmpty) return;

    setState(() {
      _isSubmitting = true;
      _error = '';
    });

    try {
      await widget.classService.transferStudents(
        className: widget.classGroup['name']?.toString() ?? '',
        fromSection: _sourceSection,
        toSection: _destSection,
        studentIds: _selectedStudentIds.toList(),
      );
      widget.onSuccess('Transferred ${_selectedStudentIds.length} students to Section $_destSection successfully');
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception:', '').trim();
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final className = widget.classGroup['name']?.toString() ?? 'Class';
    final displayName = getShortClassName(className);
    final sections = _sections;
    final destSections = sections.where((s) => s.toUpperCase() != _sourceSection.toUpperCase()).toList();
    final sourceStudents = _sourceStudents;
    final totalCount = sourceStudents.length;
    final selectedCount = _selectedStudentIds.length;
    final bool allSelected = totalCount > 0 && selectedCount == totalCount;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Transfer Students',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Class: $displayName',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const Divider(height: 18),

          // Error banner
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error,
                      style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

          // 2 Section Dropdowns in a Row
          Row(
            children: [
              // Source Section
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SOURCE SECTION *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Builder(
                      builder: (btnContext) {
                        return InkWell(
                          onTap: sections.isEmpty
                              ? null
                              : () async {
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
                                    items: sections.map((sec) {
                                      final isSelected = sec == _sourceSection;
                                      return PopupMenuItem<String>(
                                        value: sec,
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                        child: Text(
                                          'Section $sec',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                            color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  );

                                  if (selected != null) {
                                    setState(() {
                                      _sourceSection = selected;
                                      _selectedStudentIds.clear();
                                      if (_destSection == _sourceSection) {
                                        _destSection = '';
                                      }
                                    });
                                  }
                                },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 44,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    _sourceSection.isNotEmpty ? 'Section $_sourceSection' : 'Select...',
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: _sourceSection.isNotEmpty ? FontWeight.w700 : FontWeight.w500,
                                      color: _sourceSection.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ),
                                const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 18),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 12),

              // Destination Section
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'DESTINATION SECTION *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Builder(
                      builder: (btnContext) {
                        final bool isEnabled = _sourceSection.isNotEmpty && destSections.isNotEmpty;
                        return InkWell(
                          onTap: !isEnabled
                              ? null
                              : () async {
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
                                    items: destSections.map((sec) {
                                      final isSelected = sec == _destSection;
                                      return PopupMenuItem<String>(
                                        value: sec,
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                        child: Text(
                                          'Section $sec',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                            color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  );

                                  if (selected != null) {
                                    setState(() {
                                      _destSection = selected;
                                    });
                                  }
                                },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            height: 44,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: isEnabled ? Colors.white : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    _destSection.isNotEmpty ? 'Section $_destSection' : 'Select...',
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: _destSection.isNotEmpty ? FontWeight.w700 : FontWeight.w500,
                                      color: _destSection.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ),
                                const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 18),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Students List Section
          if (_sourceSection.isNotEmpty) ...[
            // Student list header with Select All
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text(
                      'SELECT STUDENTS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    if (totalCount > 0) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Text(
                          '$selectedCount / $totalCount',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (totalCount > 0)
                  InkWell(
                    onTap: () {
                      setState(() {
                        if (allSelected) {
                          _selectedStudentIds.clear();
                        } else {
                          _selectedStudentIds.addAll(sourceStudents.map((s) => int.parse(s['id'].toString())));
                        }
                      });
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: Checkbox(
                              value: allSelected,
                              activeColor: const Color(0xFFD97706),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                              onChanged: (_) {
                                setState(() {
                                  if (allSelected) {
                                    _selectedStudentIds.clear();
                                  } else {
                                    _selectedStudentIds.addAll(sourceStudents.map((s) => int.parse(s['id'].toString())));
                                  }
                                });
                              },
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'Select All',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // List of students or Empty message
            if (sourceStudents.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Center(
                  child: Text(
                    'No active students in Section $_sourceSection',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                  ),
                ),
              )
            else
              Flexible(
                child: Container(
                  constraints: const BoxConstraints(maxHeight: 220),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.all(8),
                    itemCount: sourceStudents.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      final s = sourceStudents[index];
                      final id = int.tryParse(s['id'].toString()) ?? 0;
                      final isSelected = _selectedStudentIds.contains(id);
                      final name = (s['name'] ?? 'Student').toString();
                      final roll = (s['roll_no'] ?? s['roll'] ?? '-').toString();

                      return InkWell(
                        onTap: () {
                          setState(() {
                            if (isSelected) {
                              _selectedStudentIds.remove(id);
                            } else {
                              _selectedStudentIds.add(id);
                            }
                          });
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFFEF3C7).withValues(alpha: 0.6) : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFD97706) : const Color(0xFFE2E8F0),
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: Checkbox(
                                  value: isSelected,
                                  activeColor: const Color(0xFFD97706),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                  onChanged: (_) {
                                    setState(() {
                                      if (isSelected) {
                                        _selectedStudentIds.remove(id);
                                      } else {
                                        _selectedStudentIds.add(id);
                                      }
                                    });
                                  },
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                        color: const Color(0xFF0F172A),
                                      ),
                                    ),
                                    Text(
                                      'Roll No: $roll',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
          ] else ...[
            Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Center(
                child: Text(
                  'Select a source section to view and transfer students.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ],

          const SizedBox(height: 18),

          // Action buttons: Cancel & Transfer
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF64748B),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: (_isSubmitting || _sourceSection.isEmpty || _destSection.isEmpty || _selectedStudentIds.isEmpty)
                      ? null
                      : _handleTransfer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    disabledBackgroundColor: const Color(0xFFE2E8F0),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: const Color(0xFF94A3B8),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.swap_horiz_rounded, size: 18),
                            const SizedBox(width: 6),
                            Text(
                              _selectedStudentIds.isEmpty ? 'Transfer Students' : 'Transfer (${_selectedStudentIds.length})',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                            ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// CLASS ROSTER SCREEN (VIEW STUDENTS)
// ============================================================================
class _ClassRosterScreen extends StatefulWidget {
  final String className;
  final List<Map<String, dynamic>> allClasses;
  final List<Map<String, dynamic>> allStudents;
  final Map<String, dynamic> schoolProfile;
  final List<Map<String, dynamic>> academicYears;
  final ClassManagementService classService;

  const _ClassRosterScreen({
    required this.className,
    required this.allClasses,
    required this.allStudents,
    required this.schoolProfile,
    required this.academicYears,
    required this.classService,
  });

  @override
  State<_ClassRosterScreen> createState() => _ClassRosterScreenState();
}

class _ClassRosterScreenState extends State<_ClassRosterScreen> {
  late List<Map<String, dynamic>> _students;
  String _search = '';
  String _statusFilter = 'ALL'; // 'ALL', 'ACTIVE', 'INACTIVE'
  String _sectionFilter = 'ALL'; // 'ALL' or specific section name
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _students = widget.allStudents;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<String> get _classSections {
    final sections = <String>{};
    for (final c in widget.allClasses) {
      if ((c['name'] ?? '').toString().trim().toLowerCase() == widget.className.toLowerCase()) {
        final sec = (c['section'] ?? '').toString().trim();
        if (sec.isNotEmpty) sections.add(sec);
      }
    }
    for (final s in _classStudents) {
      final sec = (s['section'] ?? '').toString().trim();
      if (sec.isNotEmpty) sections.add(sec);
    }
    final list = sections.toList()..sort();
    return list;
  }

  List<Map<String, dynamic>> get _classStudents {
    return _students.where((s) {
      final cName = (s['class_name'] ?? s['class'] ?? '').toString().trim();
      return cName.toLowerCase() == widget.className.toLowerCase();
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredStudents {
    final list = _classStudents.where((s) {
      final name = (s['name'] ?? '').toString().toLowerCase();
      final roll = (s['roll_no'] ?? s['roll'] ?? '').toString().toLowerCase();
      final srNo = (s['admission_no'] ?? s['sr_no'] ?? '').toString().toLowerCase();
      final query = _search.trim().toLowerCase();

      final matchesQuery = query.isEmpty || name.contains(query) || roll.contains(query) || srNo.contains(query);
      if (!matchesQuery) return false;

      // Status filter
      if (_statusFilter != 'ALL') {
        final status = (s['status'] ?? 'ACTIVE').toString().toUpperCase();
        if (status != _statusFilter) return false;
      }

      // Section filter
      if (_sectionFilter != 'ALL') {
        final sec = (s['section'] ?? '').toString().trim().toUpperCase();
        if (sec != _sectionFilter.toUpperCase()) return false;
      }

      return true;
    }).toList();

    list.sort((a, b) {
      final rollA = int.tryParse((a['roll_no'] ?? a['roll'] ?? '999999').toString()) ?? 999999;
      final rollB = int.tryParse((b['roll_no'] ?? b['roll'] ?? '999999').toString()) ?? 999999;
      if (rollA != rollB) return rollA.compareTo(rollB);
      return (a['name'] ?? '').toString().compareTo((b['name'] ?? '').toString());
    });
    return list;
  }

  Future<void> _refreshStudents() async {
    final list = await widget.classService.getStudents();
    if (mounted) {
      setState(() => _students = list);
    }
  }

  void _openEnrollDialog(Map<String, dynamic>? student) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _StudentEnrollModal(
        existingStudent: student,
        defaultClassName: widget.className,
        allClasses: widget.allClasses,
        classService: widget.classService,
        onSuccess: (msg) {
          Navigator.pop(context);
          _refreshStudents();
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
        },
      ),
    );
  }

  void _openStudentDetails(Map<String, dynamic> student) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _StudentDetailsScreen(
          studentId: int.parse(student['id'].toString()),
          initialData: student,
          classService: widget.classService,
          onEdit: () {
            Navigator.pop(context);
            _openEnrollDialog(student);
          },
        ),
      ),
    ).then((_) => _refreshStudents());
  }

  void _openCredentialsDialog(Map<String, dynamic> student) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _StudentCredentialsModal(
        student: student,
        classService: widget.classService,
      ),
    );
  }

  String _resolveFileUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = widget.classService.baseUrl;
    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }

  Widget _buildStudentAvatar(String photoPath, String name, {double size = 96}) {
    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final cleanInitials = initials.isEmpty ? 'ST' : initials;

    if (photoPath.isNotEmpty) {
      final fullUrl = _resolveFileUrl(photoPath);
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: fullUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _avatarInitials(cleanInitials, size),
          errorWidget: (_, __, ___) => _avatarInitials(cleanInitials, size),
        ),
      );
    }
    return _avatarInitials(cleanInitials, size);
  }

  Widget _avatarInitials(String initials, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFBAE6FD), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.35,
          fontWeight: FontWeight.w900,
          color: const Color(0xFF0369A1),
        ),
      ),
    );
  }

  Widget _buildStudentCard(Map<String, dynamic> s) {
    final name = (s['name'] ?? 'Student').toString();
    final rawRoll = (s['roll_no'] ?? s['roll'] ?? '').toString().trim();
    final formattedRoll = rawRoll.isEmpty || rawRoll == '-'
        ? '-'
        : (int.tryParse(rawRoll) != null ? rawRoll.padLeft(2, '0') : rawRoll);
    final srNo = (s['admission_no'] ?? s['sr_no'] ?? '').toString().trim();
    final sec = (s['section'] ?? '').toString().trim();
    final status = (s['status'] ?? 'ACTIVE').toString().toUpperCase();
    final photo = (s['photo_path'] ?? '').toString();
    final bool isActive = status == 'ACTIVE';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => _openStudentDetails(s),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
          child: Column(
            children: [
              // Top Row: Section Badge & 3-dots Menu
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (sec.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Text(
                        'Sec $sec',
                        style: const TextStyle(
                          color: Color(0xFF475569),
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    )
                  else
                    const SizedBox.shrink(),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF64748B)),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    onSelected: (action) {
                      if (action == 'edit') _openEnrollDialog(s);
                      if (action == 'credentials') _openCredentialsDialog(s);
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 16, color: Color(0xFFD97706)),
                            SizedBox(width: 8),
                            Text('Edit Profile', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'credentials',
                        child: Row(
                          children: [
                            Icon(Icons.lock_reset_rounded, size: 16, color: Color(0xFF4F46E5)),
                            SizedBox(width: 8),
                            Text('Credentials', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 6),

              // Enlarged Profile Avatar (size: 96, same as teachers)
              _buildStudentAvatar(photo, name, size: 96),

              const SizedBox(height: 8),

              // Student Name
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),

              const SizedBox(height: 2),

              // Roll No: 04 (dynamic)
              Text(
                'Roll No: $formattedRoll',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: Color(0xFF64748B),
                ),
              ),

              const Spacer(),

              // Bottom Status & SR No Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isActive ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                      ),
                    ),
                    child: Text(
                      isActive ? 'ACTIVE' : 'INACTIVE',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: isActive ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                      ),
                    ),
                  ),
                  if (srNo.isNotEmpty && srNo != '-')
                    Text(
                      'SR: $srNo',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // STUDENTS STATUS & SECTION FILTER BOTTOM SHEET
  // --------------------------------------------------------------------------
  void _openStudentFilterBottomSheet() {
    String tempStatus = _statusFilter;
    String tempSection = _sectionFilter;

    final allCount = _classStudents.length;
    final activeCount = _classStudents.where((s) => (s['status'] ?? 'ACTIVE').toString().toUpperCase() == 'ACTIVE').length;
    final inactiveCount = _classStudents.where((s) => (s['status'] ?? 'ACTIVE').toString().toUpperCase() == 'INACTIVE').length;
    final sections = _classSections;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final isFiltered = tempStatus != 'ALL' || tempSection != 'ALL';

            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),

                    // Header row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Filter Students',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (isFiltered)
                          TextButton(
                            onPressed: () {
                              setModalState(() {
                                tempStatus = 'ALL';
                                tempSection = 'ALL';
                              });
                            },
                            child: const Text(
                              'Reset All',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // STATUS SECTION
                    const Text(
                      'STUDENT STATUS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _buildFilterChip(
                          label: 'All ($allCount)',
                          selected: tempStatus == 'ALL',
                          onTap: () => setModalState(() => tempStatus = 'ALL'),
                        ),
                        _buildFilterChip(
                          label: 'Active ($activeCount)',
                          selected: tempStatus == 'ACTIVE',
                          onTap: () => setModalState(() => tempStatus = 'ACTIVE'),
                        ),
                        _buildFilterChip(
                          label: 'Inactive ($inactiveCount)',
                          selected: tempStatus == 'INACTIVE',
                          onTap: () => setModalState(() => tempStatus = 'INACTIVE'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // CLASS SECTION FILTER
                    const Text(
                      'CLASS SECTION',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (sections.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Text(
                          'No specific sections defined for this class.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                        ),
                      )
                    else
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _buildFilterChip(
                            label: 'All Sections ($allCount)',
                            selected: tempSection == 'ALL',
                            onTap: () => setModalState(() => tempSection = 'ALL'),
                          ),
                          ...sections.map((sec) {
                            final count = _classStudents
                                .where((s) => (s['section'] ?? '').toString().trim().toUpperCase() == sec.toUpperCase())
                                .length;
                            return _buildFilterChip(
                              label: 'Section $sec ($count)',
                              selected: tempSection.toUpperCase() == sec.toUpperCase(),
                              onTap: () => setModalState(() => tempSection = sec),
                            );
                          }),
                        ],
                      ),

                    const SizedBox(height: 24),

                    // Apply Button
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _statusFilter = tempStatus;
                          _sectionFilter = tempSection;
                        });
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text(
                        'Apply Filter',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
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

  Widget _buildFilterChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFEF3C7) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? const Color(0xFFD97706) : const Color(0xFFCBD5E1),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              const Icon(Icons.check_rounded, size: 16, color: Color(0xFFD97706)),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? const Color(0xFF92400E) : const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredStudents;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF8F5),
      appBar: AppBar(
        title: Text(
          widget.className,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          IconButton(
            tooltip: 'Enroll Student',
            icon: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFFD97706)),
            onPressed: () => _openEnrollDialog(null),
          ),
        ],
      ),
      body: Column(
        children: [
          // Top Search Bar (Fixed at top, does not scroll)
          Container(
            color: const Color(0xFFFAF8F5),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (val) => setState(() => _search = val),
                decoration: InputDecoration(
                  hintText: 'Search roster by name or roll number...',
                  hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                  prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_search.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF64748B)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _search = '');
                          },
                        ),
                      if (_search.isNotEmpty) const SizedBox(width: 4),
                      Container(
                        height: 20,
                        width: 1,
                        color: const Color(0xFFCBD5E1),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                      InkWell(
                        onTap: _openStudentFilterBottomSheet,
                        borderRadius: BorderRadius.circular(20),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Icon(
                                Icons.tune_rounded,
                                size: 20,
                                color: (_statusFilter != 'ALL' || _sectionFilter != 'ALL')
                                    ? const Color(0xFFD97706)
                                    : const Color(0xFF0F172A),
                              ),
                              if (_statusFilter != 'ALL' || _sectionFilter != 'ALL')
                                Positioned(
                                  top: -2,
                                  right: -2,
                                  child: Container(
                                    width: 7,
                                    height: 7,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFD97706),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  isDense: true,
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                  ),
                ),
              ),
            ),
          ),

          // Students Cards Grid (Scrollable)
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshStudents,
              color: const Color(0xFFD97706),
              child: filtered.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Container(
                          margin: const EdgeInsets.all(24),
                          padding: const EdgeInsets.all(36),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  (_search.isNotEmpty || _statusFilter != 'ALL' || _sectionFilter != 'ALL')
                                      ? 'No students match the current filters.'
                                      : 'No students found in this class roster.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
                                ),
                                if (_search.isNotEmpty || _statusFilter != 'ALL' || _sectionFilter != 'ALL') ...[
                                  const SizedBox(height: 12),
                                  OutlinedButton(
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() {
                                        _search = '';
                                        _statusFilter = 'ALL';
                                        _sectionFilter = 'ALL';
                                      });
                                    },
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFFD97706),
                                      side: const BorderSide(color: Color(0xFFD97706)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    ),
                                    child: const Text('Reset Filters', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : GridView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.70,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (context, idx) {
                        return _buildStudentCard(filtered[idx]);
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// STUDENT DETAILS SCREEN
// ============================================================================
class _StudentDetailsScreen extends StatefulWidget {
  final int studentId;
  final Map<String, dynamic> initialData;
  final ClassManagementService classService;
  final VoidCallback? onEdit;

  const _StudentDetailsScreen({
    required this.studentId,
    required this.initialData,
    required this.classService,
    this.onEdit,
  });

  @override
  State<_StudentDetailsScreen> createState() => _StudentDetailsScreenState();
}

class _StudentDetailsScreenState extends State<_StudentDetailsScreen> {
  bool _loading = true;
  Map<String, dynamic> _details = {};
  bool _docsExpanded = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialData['student'] is Map) {
      _details = Map<String, dynamic>.from(widget.initialData['student']);
    } else {
      _details = Map<String, dynamic>.from(widget.initialData);
    }
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final res = await widget.classService.getStudentById(widget.studentId);
      if (mounted) {
        setState(() {
          Map<String, dynamic> studentData = {};
          if (res['student'] is Map) {
            studentData = Map<String, dynamic>.from(res['student']);
          } else if (res.isNotEmpty) {
            studentData = Map<String, dynamic>.from(res);
          } else {
            studentData = Map<String, dynamic>.from(widget.initialData);
          }

          if (res['documents'] is List) {
            studentData['documents'] = res['documents'];
          }

          _details = studentData;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _resolveFileUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final base = widget.classService.baseUrl;
    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }

  Widget _buildStudentAvatar(String photoPath, String name, {double size = 96}) {
    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final cleanInitials = initials.isEmpty ? 'ST' : initials;

    if (photoPath.isNotEmpty) {
      final fullUrl = _resolveFileUrl(photoPath);
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: fullUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _avatarInitials(cleanInitials, size),
          errorWidget: (_, __, ___) => _avatarInitials(cleanInitials, size),
        ),
      );
    }
    return _avatarInitials(cleanInitials, size);
  }

  Widget _avatarInitials(String initials, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFE0F2FE),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFBAE6FD), width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.35,
          fontWeight: FontWeight.w900,
          color: const Color(0xFF0369A1),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = (_details['student'] is Map)
        ? Map<String, dynamic>.from(_details['student'])
        : _details;
    final name = (s['name'] != null && s['name'].toString().trim().isNotEmpty)
        ? s['name'].toString().trim()
        : '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
    final displayName = name.isNotEmpty ? name : 'Student Profile';
    final roll = (s['roll_no'] ?? s['roll'] ?? '-').toString();
    final formattedRoll = roll == '-' || roll.isEmpty ? '-' : (int.tryParse(roll) != null ? roll.padLeft(2, '0') : roll);
    final srNo = (s['admission_no'] ?? s['sr_no'] ?? '-').toString();
    final cls = (s['class_name'] ?? s['class'] ?? '').toString();
    final sec = (s['section'] ?? '').toString();
    final status = (s['status'] ?? 'ACTIVE').toString().toUpperCase();
    final photo = (s['photo_path'] ?? '').toString();
    final father = (s['father_name'] ?? '—').toString();
    final mother = (s['mother_name'] ?? '—').toString();
    final phone = (s['student_mobile'] ?? s['phone'] ?? s['parent_phone'] ?? s['father_phone'] ?? '—').toString();
    final gender = (s['gender'] ?? '—').toString();
    final dob = (s['dob'] ?? s['date_of_birth'] ?? '—').toString();
    final admissionDate = (s['admission_date'] ?? '—').toString();
    final List<Map<String, dynamic>> documents = [];
    if (s['documents'] is List) {
      for (final d in s['documents']) {
        if (d is Map) {
          documents.add(Map<String, dynamic>.from(d));
        }
      }
    }
    final legacyDocs = [
      {'key': 'birth_cert_path', 'label': 'Birth Certificate'},
      {'key': 'aadhaar_path', 'label': 'Aadhaar Card'},
      {'key': 'transfer_cert_path', 'label': 'Transfer Certificate'},
      {'key': 'report_card_path', 'label': 'Previous Report Card'},
      {'key': 'additional_docs_path', 'label': 'Additional Documents'},
    ];
    for (final ld in legacyDocs) {
      final p = (s[ld['key']] ?? '').toString().trim();
      if (p.isNotEmpty) {
        final already = documents.any((d) => (d['file_path'] ?? d['path'] ?? '') == p);
        if (!already) {
          documents.add({
            'category': ld['label'],
            'file_name': p.split('/').last,
            'file_path': p,
          });
        }
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Student Profile', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD97706)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Profile Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        _buildStudentAvatar(photo, displayName, size: 96),
                        const SizedBox(height: 12),
                        Text(displayName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                        const SizedBox(height: 4),
                        Text('Roll: $formattedRoll • SR No: $srNo', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: status == 'ACTIVE' ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: status == 'ACTIVE' ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                '$cls ${sec.isNotEmpty ? "(Sec $sec)" : ""}',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 28, color: Color(0xFFE2E8F0)),

                        _buildRow("Father's Name", father),
                        _buildRow("Mother's Name", mother),
                        _buildRow("Contact Phone", phone),
                        _buildRow("Gender", gender),
                        _buildRow("Date of Birth", dob),
                        _buildRow("Admission Date", admissionDate),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Address Details
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('ADDRESS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF475569))),
                        const SizedBox(height: 8),
                        Text(
                          '${s['current_address_line'] ?? s['address'] ?? '—'}\n${s['current_city'] ?? ''} ${s['current_state'] ?? ''} ${s['current_pin_code'] ?? ''}'.trim(),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Documents Collapsible
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: () => setState(() => _docsExpanded = !_docsExpanded),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.folder_open_rounded, size: 18, color: Color(0xFFD97706)),
                                    const SizedBox(width: 8),
                                    Text(
                                      'DOCUMENTS (${documents.length})',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                        color: Color(0xFF475569),
                                      ),
                                    ),
                                  ],
                                ),
                                AnimatedRotation(
                                  turns: _docsExpanded ? 0.5 : 0.0,
                                  duration: const Duration(milliseconds: 200),
                                  child: const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        AnimatedCrossFade(
                          firstChild: const SizedBox(width: double.infinity, height: 0),
                          secondChild: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              if (documents.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text(
                                    'No joining documents uploaded for this student.',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                )
                              else
                                ListView.separated(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  padding: const EdgeInsets.all(12),
                                  itemCount: documents.length,
                                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                                  itemBuilder: (context, idx) {
                                    final doc = documents[idx];
                                    final rawPath = doc['file_path'] ?? doc['path'] ?? '';
                                    final cat = doc['category'] ?? doc['file_name'] ?? 'Document';
                                    return Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  cat.toString().toUpperCase(),
                                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                                                ),
                                                Text(
                                                  doc['file_name']?.toString() ?? '',
                                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (rawPath.toString().isNotEmpty)
                                            TextButton.icon(
                                              onPressed: () {
                                                final galleryList = documents.map((docItem) {
                                                  final itemMap = docItem;
                                                  final itemRaw = (itemMap['file_path'] ?? itemMap['path'] ?? '').toString();
                                                  final catName = (itemMap['category'] ?? itemMap['file_name'] ?? 'Document').toString();
                                                  final fileName = (itemMap['file_name'] != null && itemMap['file_name'].toString().isNotEmpty)
                                                      ? itemMap['file_name'].toString()
                                                      : catName;
                                                  final isPdf = fileName.toLowerCase().endsWith('.pdf') || itemRaw.toLowerCase().endsWith('.pdf');
                                                  return {
                                                    'file_path': itemRaw,
                                                    'file_name': fileName,
                                                    'category': catName,
                                                    'file_type': isPdf ? 'pdf' : 'image',
                                                  };
                                                }).toList();

                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (context) => AttachmentGalleryScreen(
                                                      attachments: galleryList,
                                                      initialIndex: idx,
                                                      baseUrl: widget.classService.baseUrl,
                                                    ),
                                                  ),
                                                );
                                              },
                                              icon: const Icon(Icons.visibility_outlined, size: 14),
                                              label: const Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                            ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                            ],
                          ),
                          crossFadeState: _docsExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                          duration: const Duration(milliseconds: 200),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}

// ============================================================================
// PHOTO CROP DIALOG (Interactive Zoom / Pan Crop)
// ============================================================================
class _PhotoCropDialog extends StatefulWidget {
  final File imageFile;

  const _PhotoCropDialog({required this.imageFile});

  @override
  State<_PhotoCropDialog> createState() => _PhotoCropDialogState();
}

class _PhotoCropDialogState extends State<_PhotoCropDialog> {
  final GlobalKey _cropKey = GlobalKey();
  final TransformationController _transformController = TransformationController();
  bool _isProcessing = false;

  Future<void> _cropAndFinish() async {
    setState(() => _isProcessing = true);
    try {
      final boundary = _cropKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;

      final bytes = byteData.buffer.asUint8List();
      final tempDir = await getTemporaryDirectory();
      final croppedFile = File('${tempDir.path}/crop_${DateTime.now().millisecondsSinceEpoch}.png');
      await croppedFile.writeAsBytes(bytes);

      if (mounted) {
        Navigator.pop(context, croppedFile);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessing = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error cropping image: $e')));
      }
    }
  }

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF0F172A),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Adjust Photo',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pinch to zoom and drag to position within the circle.',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 20),
            Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFD97706), width: 3),
                ),
                child: ClipOval(
                  child: RepaintBoundary(
                    key: _cropKey,
                    child: Container(
                      color: Colors.black,
                      width: 260,
                      height: 260,
                      child: InteractiveViewer(
                        transformationController: _transformController,
                        minScale: 0.5,
                        maxScale: 4.0,
                        boundaryMargin: const EdgeInsets.all(200),
                        child: Image.file(
                          widget.imageFile,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isProcessing ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0xFF334155)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isProcessing ? null : _cropAndFinish,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _isProcessing
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Done', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// ENROLL / EDIT STUDENT MODAL FORM (4-Step Wizard matching Web 1:1)
// ============================================================================
class _StudentEnrollModal extends StatefulWidget {
  final Map<String, dynamic>? existingStudent;
  final String defaultClassName;
  final List<Map<String, dynamic>> allClasses;
  final ClassManagementService classService;
  final Function(String) onSuccess;

  const _StudentEnrollModal({
    this.existingStudent,
    required this.defaultClassName,
    required this.allClasses,
    required this.classService,
    required this.onSuccess,
  });

  @override
  State<_StudentEnrollModal> createState() => _StudentEnrollModalState();
}

class _StudentEnrollModalState extends State<_StudentEnrollModal> {
  int _activeTab = 0; // 0: Basic Details, 1: Address, 2: Document Uploads, 3: Review & Submit
  bool _loading = true;
  bool _submitting = false;
  String _error = '';
  final Map<String, String> _errors = {};

  // Form State & Controllers - Step 1: Basic Details
  final TextEditingController _studentNameCtrl = TextEditingController();
  final TextEditingController _fatherNameCtrl = TextEditingController();
  final TextEditingController _motherNameCtrl = TextEditingController();
  final TextEditingController _parentOccupationCtrl = TextEditingController();
  String _gender = 'Male';
  final TextEditingController _dobCtrl = TextEditingController();
  final TextEditingController _admissionDateCtrl = TextEditingController();
  final TextEditingController _admissionFeeCtrl = TextEditingController();
  String? _studentCategory;
  String? _bloodGroup;
  String? _category;
  String? _religion;
  final TextEditingController _aadhaarCtrl = TextEditingController();
  final TextEditingController _mobileCtrl = TextEditingController();
  final TextEditingController _srNoCtrl = TextEditingController();
  final TextEditingController _rollCtrl = TextEditingController();
  final TextEditingController _exitDateCtrl = TextEditingController();

  // Academic dependencies & Class/Section selection
  List<Map<String, dynamic>> _academicYears = [];
  List<Map<String, dynamic>> _classesList = [];
  int? _selectedAcademicYearId;
  String _selectedClassName = '';
  String _selectedSectionName = '';
  int? _selectedClassId;
  List<String> _availableSections = [];

  // Form State & Controllers - Step 2: Address
  final TextEditingController _currentAddress1Ctrl = TextEditingController();
  final TextEditingController _currentAddress2Ctrl = TextEditingController();
  String _currentState = '';
  String _currentCity = '';
  final TextEditingController _currentCountryCtrl = TextEditingController(text: 'India');
  final TextEditingController _currentPinCtrl = TextEditingController();

  bool _sameAsCurrent = true;
  final TextEditingController _permAddress1Ctrl = TextEditingController();
  final TextEditingController _permAddress2Ctrl = TextEditingController();
  String _permState = '';
  String _permCity = '';
  final TextEditingController _permCountryCtrl = TextEditingController(text: 'India');
  final TextEditingController _permPinCtrl = TextEditingController();

  // Form State - Step 3: Document Uploads
  String _photoPath = '';
  String _birthCertPath = '';
  String _aadhaarPath = '';
  String _transferCertPath = '';
  String _reportCardPath = '';
  String _additionalDocsPath = '';
  final Map<String, bool> _uploadingMap = {};

  // Initial values snapshot for dirty check
  Map<String, dynamic> _initialSnapshot = {};

  @override
  void initState() {
    super.initState();
    _selectedClassName = widget.defaultClassName;
    _classesList = widget.allClasses;
    _initDependenciesAndData();
  }

  Future<void> _initDependenciesAndData() async {
    setState(() => _loading = true);
    try {
      final years = await widget.classService.getAcademicYears();
      final sortedYears = List<Map<String, dynamic>>.from(years);
      sortedYears.sort((a, b) {
        final da = DateTime.tryParse(a['start_date']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
        final db = DateTime.tryParse(b['start_date']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
        return da.compareTo(db);
      });
      _academicYears = sortedYears;

      if (_classesList.isEmpty) {
        _classesList = await widget.classService.getClasses();
      }

      if (widget.existingStudent != null) {
        // Edit Mode: fetch full student details to get complete address and document fields
        final sId = int.parse(widget.existingStudent!['id'].toString());
        Map<String, dynamic> studentData = widget.existingStudent!;
        try {
          final res = await widget.classService.getStudentById(sId);
          if (res['student'] is Map) {
            studentData = Map<String, dynamic>.from(res['student'] as Map);
          } else if (res.isNotEmpty) {
            studentData = res;
          }
        } catch (e) {
          debugPrint('Failed to load full student details: $e');
        }

        final cleanLastName = (studentData['last_name']?.toString() ?? '') == '.'
            ? ''
            : (studentData['last_name']?.toString() ?? '');
        final fullName = [
          studentData['first_name']?.toString() ?? '',
          studentData['middle_name']?.toString() ?? '',
          cleanLastName
        ].where((part) => part.trim().isNotEmpty).join(' ');

        _studentNameCtrl.text = fullName.isNotEmpty ? fullName : (studentData['name']?.toString() ?? '');
        _fatherNameCtrl.text = studentData['father_name']?.toString() ?? '';
        _motherNameCtrl.text = studentData['mother_name']?.toString() ?? '';
        _parentOccupationCtrl.text = studentData['father_occupation']?.toString() ??
            studentData['parent_occupation']?.toString() ??
            '';
        _gender = studentData['gender']?.toString() ?? 'Male';
        _dobCtrl.text = studentData['dob']?.toString() ?? studentData['date_of_birth']?.toString() ?? '';
        _admissionDateCtrl.text = studentData['admission_date']?.toString() ?? '';
        _admissionFeeCtrl.text = studentData['admission_fee'] != null ? studentData['admission_fee'].toString() : '';
        _studentCategory = studentData['student_category']?.toString();
        _bloodGroup = studentData['blood_group']?.toString();
        _category = studentData['category']?.toString();
        _religion = _normalizeReligion(studentData['religion']?.toString());
        _aadhaarCtrl.text = studentData['aadhaar_no']?.toString() ?? '';
        _mobileCtrl.text = studentData['student_mobile']?.toString() ?? studentData['phone']?.toString() ?? '';
        _srNoCtrl.text = studentData['admission_no']?.toString() ?? studentData['sr_no']?.toString() ?? '';
        _rollCtrl.text = studentData['roll_no']?.toString() ?? studentData['roll']?.toString() ?? '';
        _exitDateCtrl.text = studentData['exit_date']?.toString() ?? '';

        _selectedAcademicYearId = int.tryParse(studentData['academic_year_id']?.toString() ?? '');

        // Address
        _currentAddress1Ctrl.text = studentData['current_address_line_1']?.toString() ??
            studentData['current_address_line']?.toString() ??
            '';
        _currentAddress2Ctrl.text = studentData['current_address_line_2']?.toString() ?? '';
        _currentState = studentData['current_state']?.toString() ?? '';
        _currentCity = studentData['current_city']?.toString() ?? '';
        _currentCountryCtrl.text = studentData['current_country']?.toString() ?? 'India';
        _currentPinCtrl.text = studentData['current_pin_code']?.toString() ?? '';

        final perm1 = studentData['permanent_address_line_1']?.toString() ??
            studentData['permanent_address_line']?.toString() ??
            '';
        final isSame = studentData['same_as_current'] == 1 ||
            studentData['same_as_current'] == true ||
            perm1.isEmpty ||
            perm1 == _currentAddress1Ctrl.text;
        _sameAsCurrent = isSame;

        if (!isSame) {
          _permAddress1Ctrl.text = perm1;
          _permAddress2Ctrl.text = studentData['permanent_address_line_2']?.toString() ?? '';
          _permState = studentData['permanent_state']?.toString() ?? '';
          _permCity = studentData['permanent_city']?.toString() ?? '';
          _permCountryCtrl.text = studentData['permanent_country']?.toString() ?? 'India';
          _permPinCtrl.text = studentData['permanent_pin_code']?.toString() ?? '';
        }

        // Documents
        _photoPath = studentData['photo_path']?.toString() ?? '';
        _birthCertPath = studentData['birth_cert_path']?.toString() ?? '';
        _aadhaarPath = studentData['aadhaar_path']?.toString() ?? '';
        _transferCertPath = studentData['transfer_cert_path']?.toString() ?? '';
        _reportCardPath = studentData['report_card_path']?.toString() ?? '';
        _additionalDocsPath = studentData['additional_docs_path']?.toString() ?? '';

        // Class & Section matching
        final cId = studentData['class_id'];
        final matchedClass = _classesList.firstWhere(
          (c) => c['id']?.toString() == cId?.toString(),
          orElse: () => <String, dynamic>{},
        );
        if (matchedClass.isNotEmpty) {
          _selectedClassName = matchedClass['name']?.toString() ?? widget.defaultClassName;
          _selectedSectionName = matchedClass['section']?.toString() ?? '';
          _selectedClassId = int.tryParse(matchedClass['id'].toString());
        } else {
          _selectedClassName = studentData['class_name']?.toString() ?? widget.defaultClassName;
          _selectedSectionName = studentData['section']?.toString() ?? '';
        }
      } else {
        // Enroll / New Student
        _admissionDateCtrl.text = DateTime.now().toIso8601String().split('T')[0];

        // Academic Year Selection (current or draft or first)
        final currentYear = _academicYears.firstWhere(
          (y) => y['is_current'] == 1 || y['is_current'] == true,
          orElse: () => _academicYears.firstWhere(
            (y) => y['status'] == 'Draft',
            orElse: () => _academicYears.isNotEmpty ? _academicYears.first : <String, dynamic>{},
          ),
        );
        if (currentYear.isNotEmpty) {
          _selectedAcademicYearId = int.tryParse(currentYear['id'].toString());
        }

        _resolveClassAndSection(widget.defaultClassName);

        // If not first year session, pre-fetch next SR No
        if (!_isFirstYear) {
          final nextSr = await widget.classService.getNextSrNo();
          if (nextSr.isNotEmpty) {
            _srNoCtrl.text = nextSr;
            _studentCategory = 'New Admission';
          }
        }
      }

      _updateAvailableSections();
      _takeSnapshot();
    } catch (e) {
      debugPrint('Error loading dependencies: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _resolveClassAndSection(String className) {
    _selectedClassName = className;
    final matching = _classesList.where((c) => c['name'] == className).toList();
    final sections = matching
        .where((c) => c['section'] != null && c['section'].toString().isNotEmpty)
        .map((c) => c['section'].toString())
        .toSet()
        .toList()
      ..sort();

    _availableSections = sections;
    if (sections.isNotEmpty) {
      _selectedSectionName = sections.first;
      final matchedClass = matching.firstWhere(
        (c) => c['section']?.toString() == _selectedSectionName,
        orElse: () => matching.first,
      );
      _selectedClassId = int.tryParse(matchedClass['id']?.toString() ?? '');
    } else if (matching.isNotEmpty) {
      _selectedSectionName = '';
      _selectedClassId = int.tryParse(matching.first['id']?.toString() ?? '');
    }

    if (widget.existingStudent == null && _selectedClassId != null) {
      _fetchNextRollNo(_selectedClassId!);
    }
  }

  void _updateAvailableSections() {
    final matching = _classesList.where((c) => c['name'] == _selectedClassName).toList();
    _availableSections = matching
        .where((c) => c['section'] != null && c['section'].toString().isNotEmpty)
        .map((c) => c['section'].toString())
        .toSet()
        .toList()
      ..sort();
  }

  Future<void> _fetchNextRollNo(int classId) async {
    try {
      final nextRoll = await widget.classService.getNextRollNo(classId);
      if (mounted && widget.existingStudent == null && nextRoll > 0) {
        setState(() => _rollCtrl.text = nextRoll.toString());
      }
    } catch (e) {
      debugPrint('Failed to get next roll no: $e');
    }
  }

  String? _normalizeReligion(String? val) {
    if (val == null || val.trim().isEmpty) return null;
    final s = val.trim();
    if (['Hindu', '1', 'Hinduism', 'hindu', 'hinduism'].contains(s)) return 'Hindu';
    if (['Muslim', '2', 'Islam', 'muslim', 'islam'].contains(s)) return 'Muslim';
    if (['Sikh', '3', 'Sikhism', 'sikh', 'sikhism'].contains(s)) return 'Sikh';
    if (['Christian', '4', 'Christianity', 'christian', 'christianity'].contains(s)) return 'Christian';
    return s;
  }

  bool get _isFirstYear {
    if (_academicYears.length <= 1) return true;
    if (_selectedAcademicYearId == null) return true;
    final sorted = List<Map<String, dynamic>>.from(_academicYears);
    sorted.sort((a, b) {
      final da = DateTime.tryParse(a['start_date']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final db = DateTime.tryParse(b['start_date']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
      final c = da.compareTo(db);
      if (c != 0) return c;
      return (int.tryParse(a['id']?.toString() ?? '0') ?? 0)
          .compareTo(int.tryParse(b['id']?.toString() ?? '0') ?? 0);
    });
    final earliestId = sorted.first['id']?.toString();
    return _selectedAcademicYearId?.toString() == earliestId;
  }

  bool get _shouldShowAdmissionFee {
    final cat = (_studentCategory ?? '').trim().toLowerCase();
    if (cat.contains('existing')) return false;
    if (widget.existingStudent != null && cat != 'new admission') return false;
    return true;
  }

  void _takeSnapshot() {
    _initialSnapshot = {
      'student_name': _studentNameCtrl.text.trim(),
      'father_name': _fatherNameCtrl.text.trim(),
      'mother_name': _motherNameCtrl.text.trim(),
      'parent_occupation': _parentOccupationCtrl.text.trim(),
      'gender': _gender,
      'dob': _dobCtrl.text.trim(),
      'admission_date': _admissionDateCtrl.text.trim(),
      'admission_fee': _admissionFeeCtrl.text.trim(),
      'student_category': _studentCategory ?? '',
      'blood_group': _bloodGroup ?? '',
      'category': _category ?? '',
      'religion': _religion ?? '',
      'aadhaar_no': _aadhaarCtrl.text.trim(),
      'student_mobile': _mobileCtrl.text.trim(),
      'sr_no': _srNoCtrl.text.trim(),
      'roll_no': _rollCtrl.text.trim(),
      'exit_date': _exitDateCtrl.text.trim(),
      'selected_class': _selectedClassName,
      'selected_section': _selectedSectionName,
      'current_address_1': _currentAddress1Ctrl.text.trim(),
      'current_address_2': _currentAddress2Ctrl.text.trim(),
      'current_state': _currentState,
      'current_city': _currentCity,
      'current_pin': _currentPinCtrl.text.trim(),
      'same_as_current': _sameAsCurrent,
      'perm_address_1': _permAddress1Ctrl.text.trim(),
      'perm_address_2': _permAddress2Ctrl.text.trim(),
      'perm_state': _permState,
      'perm_city': _permCity,
      'perm_pin': _permPinCtrl.text.trim(),
      'photo_path': _photoPath,
      'birth_cert_path': _birthCertPath,
      'aadhaar_path': _aadhaarPath,
      'transfer_cert_path': _transferCertPath,
      'report_card_path': _reportCardPath,
      'additional_docs_path': _additionalDocsPath,
    };
  }

  bool _isDirty() {
    if (_initialSnapshot.isEmpty) return false;
    return _studentNameCtrl.text.trim() != _initialSnapshot['student_name'] ||
        _fatherNameCtrl.text.trim() != _initialSnapshot['father_name'] ||
        _motherNameCtrl.text.trim() != _initialSnapshot['mother_name'] ||
        _parentOccupationCtrl.text.trim() != _initialSnapshot['parent_occupation'] ||
        _gender != _initialSnapshot['gender'] ||
        _dobCtrl.text.trim() != _initialSnapshot['dob'] ||
        _admissionDateCtrl.text.trim() != _initialSnapshot['admission_date'] ||
        _admissionFeeCtrl.text.trim() != _initialSnapshot['admission_fee'] ||
        (_studentCategory ?? '') != _initialSnapshot['student_category'] ||
        (_bloodGroup ?? '') != _initialSnapshot['blood_group'] ||
        (_category ?? '') != _initialSnapshot['category'] ||
        (_religion ?? '') != _initialSnapshot['religion'] ||
        _aadhaarCtrl.text.trim() != _initialSnapshot['aadhaar_no'] ||
        _mobileCtrl.text.trim() != _initialSnapshot['student_mobile'] ||
        _srNoCtrl.text.trim() != _initialSnapshot['sr_no'] ||
        _rollCtrl.text.trim() != _initialSnapshot['roll_no'] ||
        _exitDateCtrl.text.trim() != _initialSnapshot['exit_date'] ||
        _selectedClassName != _initialSnapshot['selected_class'] ||
        _selectedSectionName != _initialSnapshot['selected_section'] ||
        _currentAddress1Ctrl.text.trim() != _initialSnapshot['current_address_1'] ||
        _currentAddress2Ctrl.text.trim() != _initialSnapshot['current_address_2'] ||
        _currentState != _initialSnapshot['current_state'] ||
        _currentCity != _initialSnapshot['current_city'] ||
        _currentPinCtrl.text.trim() != _initialSnapshot['current_pin'] ||
        _sameAsCurrent != _initialSnapshot['same_as_current'] ||
        _permAddress1Ctrl.text.trim() != _initialSnapshot['perm_address_1'] ||
        _permAddress2Ctrl.text.trim() != _initialSnapshot['perm_address_2'] ||
        _permState != _initialSnapshot['perm_state'] ||
        _permCity != _initialSnapshot['perm_city'] ||
        _permPinCtrl.text.trim() != _initialSnapshot['perm_pin'] ||
        _photoPath != _initialSnapshot['photo_path'] ||
        _birthCertPath != _initialSnapshot['birth_cert_path'] ||
        _aadhaarPath != _initialSnapshot['aadhaar_path'] ||
        _transferCertPath != _initialSnapshot['transfer_cert_path'] ||
        _reportCardPath != _initialSnapshot['report_card_path'] ||
        _additionalDocsPath != _initialSnapshot['additional_docs_path'];
  }

  Future<bool> _showDiscardDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Discard Changes?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        content: const Text(
          'You have unsaved changes. Are you sure you want to discard them and exit?',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Editing', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Discard', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _handleClose() async {
    if (_isDirty()) {
      final discard = await _showDiscardDialog();
      if (discard && mounted) Navigator.pop(context);
    } else {
      Navigator.pop(context);
    }
  }

  @override
  void dispose() {
    _studentNameCtrl.dispose();
    _fatherNameCtrl.dispose();
    _motherNameCtrl.dispose();
    _parentOccupationCtrl.dispose();
    _dobCtrl.dispose();
    _admissionDateCtrl.dispose();
    _admissionFeeCtrl.dispose();
    _aadhaarCtrl.dispose();
    _mobileCtrl.dispose();
    _srNoCtrl.dispose();
    _rollCtrl.dispose();
    _exitDateCtrl.dispose();
    _currentAddress1Ctrl.dispose();
    _currentAddress2Ctrl.dispose();
    _currentCountryCtrl.dispose();
    _currentPinCtrl.dispose();
    _permAddress1Ctrl.dispose();
    _permAddress2Ctrl.dispose();
    _permCountryCtrl.dispose();
    _permPinCtrl.dispose();
    super.dispose();
  }

  // Validation logic matching Web 1:1
  bool _validateTab(int tabNum) {
    _errors.clear();

    if (tabNum == 0) {
      if (_studentNameCtrl.text.trim().isEmpty) {
        _errors['student_name'] = 'Student Name is required';
      }
      if (_fatherNameCtrl.text.trim().isEmpty) {
        _errors['father_name'] = 'Father name is required';
      }
      if (_motherNameCtrl.text.trim().isEmpty) {
        _errors['mother_name'] = 'Mother name is required';
      }
      if (_gender.trim().isEmpty) {
        _errors['gender'] = 'Gender is required';
      }
      if (_dobCtrl.text.trim().isEmpty) {
        _errors['dob'] = 'Date of birth is required';
      } else {
        final dobDate = DateTime.tryParse(_dobCtrl.text.trim());
        if (dobDate != null && dobDate.isAfter(DateTime.now())) {
          _errors['dob'] = 'Date of birth cannot be a future date';
        }
      }
      if (_admissionDateCtrl.text.trim().isEmpty) {
        _errors['admission_date'] = 'Admission Date is required';
      }
      if (_shouldShowAdmissionFee && _admissionFeeCtrl.text.trim().isNotEmpty) {
        final fee = double.tryParse(_admissionFeeCtrl.text.trim()) ?? 0;
        if (fee < 0) {
          _errors['admission_fee'] = 'Admission Fee cannot be negative.';
        }
      }
      if (_isFirstYear && widget.existingStudent == null && (_studentCategory == null || _studentCategory!.isEmpty)) {
        _errors['student_category'] = 'Student Category is required.';
      }
      if (_mobileCtrl.text.trim().isEmpty) {
        _errors['student_mobile'] = 'Contact Number is required.';
      } else if (!RegExp(r'^\d{10}$').hasMatch(_mobileCtrl.text.trim())) {
        _errors['student_mobile'] = 'Mobile No should be exactly 10 digits';
      }
      if (_aadhaarCtrl.text.trim().isNotEmpty && !RegExp(r'^\d{12}$').hasMatch(_aadhaarCtrl.text.trim())) {
        _errors['aadhaar_no'] = 'Aadhaar number must contain exactly 12 numeric digits.';
      }
      if (_isFirstYear) {
        if (_srNoCtrl.text.trim().isEmpty) {
          _errors['sr_no'] = 'SR Number is required';
        } else if (!RegExp(r'^\d+$').hasMatch(_srNoCtrl.text.trim())) {
          _errors['sr_no'] = 'Only numeric digits are allowed.';
        } else if ((int.tryParse(_srNoCtrl.text.trim()) ?? 0) <= 0) {
          _errors['sr_no'] = 'SR Number must be a positive integer.';
        }
      }
      if (_availableSections.isNotEmpty && _selectedSectionName.isEmpty) {
        _errors['section_name'] = 'Please select a section.';
      }
    }

    if (tabNum == 1) {
      if (_currentAddress1Ctrl.text.trim().isEmpty) {
        _errors['current_address_line_1'] = 'Current address is required';
      } else if (_currentAddress1Ctrl.text.trim().length > 50) {
        _errors['current_address_line_1'] = 'Address cannot exceed 50 characters.';
      }
      if (_currentState.isEmpty) {
        _errors['current_state'] = 'Current state is required';
      }
      if (_currentCity.isEmpty) {
        _errors['current_city'] = 'Current city is required';
      }
      if (_currentPinCtrl.text.trim().isEmpty) {
        _errors['current_pin_code'] = 'Current PIN Code is required';
      }

      if (!_sameAsCurrent) {
        if (_permAddress1Ctrl.text.trim().isEmpty) {
          _errors['permanent_address_line_1'] = 'Permanent address is required.';
        } else if (_permAddress1Ctrl.text.trim().length > 50) {
          _errors['permanent_address_line_1'] = 'Address cannot exceed 50 characters.';
        }
        if (_permState.isEmpty) {
          _errors['permanent_state'] = 'Permanent state is required.';
        }
        if (_permCity.isEmpty) {
          _errors['permanent_city'] = 'Permanent city is required.';
        }
        if (_permPinCtrl.text.trim().isEmpty) {
          _errors['permanent_pin_code'] = 'Permanent PIN Code is required.';
        }
      }
    }

    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _handleTabChange(int targetTab) async {
    if (targetTab == _activeTab) return;
    if (targetTab > _activeTab) {
      if (_activeTab == 0 || (_activeTab < 0 && targetTab > 0)) {
        if (!_validateTab(0)) return;
        // Verify SR No uniqueness if first year
        if (_isFirstYear && _srNoCtrl.text.trim().isNotEmpty) {
          final sId = widget.existingStudent != null ? int.tryParse(widget.existingStudent!['id'].toString()) : null;
          final exists = await widget.classService.checkSrNoExists(_srNoCtrl.text.trim(), excludeId: sId);
          if (exists) {
            setState(() {
              _errors['sr_no'] = 'SR Number already exists. Please enter a unique SR Number.';
            });
            return;
          }
        }
      }
      if (_activeTab == 1 || (_activeTab < 1 && targetTab > 1)) {
        if (!_validateTab(1)) return;
      }
    }
    setState(() => _activeTab = targetTab);
  }

  Future<void> _handleNext() async {
    await _handleTabChange(_activeTab + 1);
  }

  void _handlePrev() {
    FocusManager.instance.primaryFocus?.unfocus();
    if (_activeTab > 0) {
      setState(() => _activeTab--);
    }
  }

  Map<String, String> _splitName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) {
      return {'first_name': '', 'middle_name': '', 'last_name': ''};
    }
    if (parts.length == 1) {
      return {
        'first_name': parts[0],
        'middle_name': '',
        'last_name': '.', // fallback to satisfy backend requirement
      };
    }
    if (parts.length == 2) {
      return {
        'first_name': parts[0],
        'middle_name': '',
        'last_name': parts[1],
      };
    }
    return {
      'first_name': parts[0],
      'middle_name': parts.sublist(1, parts.length - 1).join(' '),
      'last_name': parts.last,
    };
  }

  Future<void> _handleSubmit() async {
    if (!_validateTab(0) || !_validateTab(1)) {
      setState(() => _activeTab = 0);
      return;
    }

    setState(() {
      _submitting = true;
      _error = '';
    });

    try {
      final nameParts = _splitName(_studentNameCtrl.text);
      final isSame = _sameAsCurrent;
      final currentAddress = [_currentAddress1Ctrl.text.trim(), _currentAddress2Ctrl.text.trim()]
          .where((s) => s.isNotEmpty)
          .join(', ');
      final permanentAddress = isSame
          ? currentAddress
          : [_permAddress1Ctrl.text.trim(), _permAddress2Ctrl.text.trim()]
              .where((s) => s.isNotEmpty)
              .join(', ');

      // Resolve class_id
      int? finalClassId = _selectedClassId;
      if (finalClassId == null) {
        final match = _classesList.firstWhere(
          (c) => c['name'] == _selectedClassName && (c['section']?.toString() ?? '') == _selectedSectionName,
          orElse: () => _classesList.firstWhere(
            (c) => c['name'] == _selectedClassName,
            orElse: () => <String, dynamic>{},
          ),
        );
        if (match.isNotEmpty && match['id'] != null) {
          finalClassId = int.tryParse(match['id'].toString());
        }
      }

      final docsList = <Map<String, dynamic>>[];
      if (_birthCertPath.isNotEmpty) {
        docsList.add({
          'category': 'Birth Certificate',
          'file_name': _birthCertPath.split('/').last,
          'file_path': _birthCertPath,
          'file_size': 1024,
        });
      }
      if (_aadhaarPath.isNotEmpty) {
        docsList.add({
          'category': 'Aadhaar Card',
          'file_name': _aadhaarPath.split('/').last,
          'file_path': _aadhaarPath,
          'file_size': 1024,
        });
      }
      if (_transferCertPath.isNotEmpty) {
        docsList.add({
          'category': 'Transfer Certificate',
          'file_name': _transferCertPath.split('/').last,
          'file_path': _transferCertPath,
          'file_size': 1024,
        });
      }
      if (_reportCardPath.isNotEmpty) {
        docsList.add({
          'category': 'Previous Report Card',
          'file_name': _reportCardPath.split('/').last,
          'file_path': _reportCardPath,
          'file_size': 1024,
        });
      }
      if (_additionalDocsPath.isNotEmpty) {
        docsList.add({
          'category': 'Additional Documents',
          'file_name': _additionalDocsPath.split('/').last,
          'file_path': _additionalDocsPath,
          'file_size': 1024,
        });
      }

      final payload = <String, dynamic>{
        'student_name': _studentNameCtrl.text.trim(),
        'first_name': nameParts['first_name'],
        'middle_name': nameParts['middle_name'],
        'last_name': nameParts['last_name'],
        'father_name': _fatherNameCtrl.text.trim(),
        'mother_name': _motherNameCtrl.text.trim(),
        'father_occupation': _parentOccupationCtrl.text.trim(),
        'parent_occupation': _parentOccupationCtrl.text.trim(),
        'gender': _gender,
        'dob': _dobCtrl.text.trim(),
        'admission_date': _admissionDateCtrl.text.trim(),
        'academic_year_id': _selectedAcademicYearId,
        'student_category': _studentCategory ?? '',
        'blood_group': _bloodGroup ?? '',
        'category': _category ?? '',
        'religion': _religion ?? '',
        'aadhaar_no': _aadhaarCtrl.text.trim(),
        'student_mobile': _mobileCtrl.text.trim(),
        'phone': _mobileCtrl.text.trim(),
        'sr_no': _srNoCtrl.text.trim(),
        'admission_no': _srNoCtrl.text.trim(),
        'roll_no': _rollCtrl.text.trim(),
        'documents': docsList,
        'class_id': finalClassId,
        'class_name': _selectedClassName,
        'section': _selectedSectionName,
        'status': _exitDateCtrl.text.trim().isNotEmpty ? 'Inactive' : 'ACTIVE',
        'exit_date': _exitDateCtrl.text.trim(),
        'current_address_line_1': _currentAddress1Ctrl.text.trim(),
        'current_address_line_2': _currentAddress2Ctrl.text.trim(),
        'current_address_line': currentAddress,
        'current_city': _currentCity,
        'current_state': _currentState,
        'current_country': _currentCountryCtrl.text.trim().isEmpty ? 'India' : _currentCountryCtrl.text.trim(),
        'current_pin_code': _currentPinCtrl.text.trim(),
        'same_as_current': isSame ? 1 : 0,
        'permanent_address_line_1': isSame ? _currentAddress1Ctrl.text.trim() : _permAddress1Ctrl.text.trim(),
        'permanent_address_line_2': isSame ? _currentAddress2Ctrl.text.trim() : _permAddress2Ctrl.text.trim(),
        'permanent_address_line': permanentAddress,
        'permanent_city': isSame ? _currentCity : _permCity,
        'permanent_state': isSame ? _currentState : _permState,
        'permanent_country': isSame
            ? (_currentCountryCtrl.text.trim().isEmpty ? 'India' : _currentCountryCtrl.text.trim())
            : (_permCountryCtrl.text.trim().isEmpty ? 'India' : _permCountryCtrl.text.trim()),
        'permanent_pin_code': isSame ? _currentPinCtrl.text.trim() : _permPinCtrl.text.trim(),
        'photo_path': _photoPath,
        'birth_cert_path': _birthCertPath,
        'aadhaar_path': _aadhaarPath,
        'transfer_cert_path': _transferCertPath,
        'report_card_path': _reportCardPath,
        'additional_docs_path': _additionalDocsPath,
      };

      if (_shouldShowAdmissionFee && _admissionFeeCtrl.text.trim().isNotEmpty) {
        payload['admission_fee'] = _admissionFeeCtrl.text.trim();
      }

      if (widget.existingStudent != null) {
        final sId = int.parse(widget.existingStudent!['id'].toString());
        await widget.classService.updateStudent(sId, payload);
        widget.onSuccess('Student profile updated successfully.');
      } else {
        await widget.classService.createStudent(payload);
        widget.onSuccess('Student enrolled successfully.');
      }
    } catch (e) {
      final msg = e.toString().replaceAll('Exception:', '').trim();
      setState(() {
        _error = msg;
        _activeTab = 0; // Jump back to Basic Details so user sees inline fields
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Document Pickers
  Future<void> _pickPhoto() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']);
    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      final bytes = await file.length();
      if (bytes > 5 * 1024 * 1024) {
        if (mounted) setState(() => _error = 'Photo file size cannot exceed 5 MB.');
        return;
      }
      if (!mounted) return;
      final cropped = await showDialog<File?>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _PhotoCropDialog(imageFile: file),
      );
      if (cropped == null || !mounted) return;
      setState(() => _uploadingMap['photo'] = true);
      try {
        final url = await widget.classService.uploadFile(cropped, category: 'student-photos');
        if (mounted) setState(() { _photoPath = url; _uploadingMap['photo'] = false; });
      } catch (e) {
        if (mounted) setState(() { _uploadingMap['photo'] = false; _error = 'Failed to upload photo: $e'; });
      }
    }
  }

  Future<void> _pickDocument(String docKey, ValueSetter<String> onUploaded) async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg']);
    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      final bytes = await file.length();
      if (bytes > 5 * 1024 * 1024) {
        if (mounted) setState(() => _error = 'Document file size cannot exceed 5 MB.');
        return;
      }
      setState(() => _uploadingMap[docKey] = true);
      try {
        final url = await widget.classService.uploadFile(file, category: 'student-documents');
        if (mounted) {
          setState(() {
            onUploaded(url);
            _uploadingMap[docKey] = false;
          });
        }
      } catch (e) {
        if (mounted) setState(() { _uploadingMap[docKey] = false; _error = 'Failed to upload document: $e'; });
      }
    }
  }

  // Date Pickers
  Future<void> _pickDob() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final now = DateTime.now();
    final current = DateTime.tryParse(_dobCtrl.text) ?? DateTime(now.year - 6, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isAfter(now) ? now : current,
      firstDate: DateTime(1980),
      lastDate: now,
    );
    if (picked != null) {
      setState(() {
        _dobCtrl.text = "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
        _errors.remove('dob');
      });
    }
  }

  Future<void> _pickAdmissionDate() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final now = DateTime.now();
    final current = DateTime.tryParse(_admissionDateCtrl.text) ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _admissionDateCtrl.text = "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
        _errors.remove('admission_date');
      });
    }
  }

  Future<void> _pickExitDate() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final now = DateTime.now();
    final current = DateTime.tryParse(_exitDateCtrl.text) ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        _exitDateCtrl.text = "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      });
    }
  }

  // Searchable Picker Bottom Sheet for State and City
  Future<void> _showSearchablePicker({
    required String title,
    required List<String> items,
    required String currentVal,
    required ValueChanged<String> onSelected,
  }) async {
    FocusManager.instance.primaryFocus?.unfocus();
    String query = '';
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = items
                .where((item) => item.toLowerCase().contains(query.toLowerCase()))
                .toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.7,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    autofocus: true,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF94A3B8)),
                      hintText: 'Search $title...',
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
                      ),
                    ),
                    onChanged: (val) {
                      setModalState(() => query = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No options found', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                          )
                        : NotificationListener<ScrollNotification>(
                            onNotification: (scrollInfo) {
                              if (scrollInfo is ScrollUpdateNotification && (scrollInfo.scrollDelta?.abs() ?? 0) > 0) {
                                FocusScope.of(context).unfocus();
                              }
                              return false;
                            },
                            child: ListView.separated(
                              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                            itemBuilder: (context, idx) {
                              final opt = filtered[idx];
                              final isSelected = opt == currentVal;
                              return ListTile(
                                dense: true,
                                title: Text(
                                  opt,
                                  style: TextStyle(
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                                  ),
                                ),
                                trailing: isSelected ? const Icon(Icons.check, color: Color(0xFFD97706), size: 18) : null,
                                onTap: () {
                                  FocusManager.instance.primaryFocus?.unfocus();
                                  onSelected(opt);
                                  Navigator.pop(ctx);
                                  WidgetsBinding.instance.addPostFrameCallback((_) {
                                    FocusManager.instance.primaryFocus?.unfocus();
                                  });
                                },
                              );
                            },
                          ),
                        ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existingStudent != null;

    if (_loading) {
      return Container(
        height: MediaQuery.of(context).size.height * 0.92,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFFD97706)),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleClose();
      },
      child: Container(
        height: MediaQuery.of(context).size.height * 0.92,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isEdit ? 'Edit Student Profile' : 'Enroll Student',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                    onPressed: _handleClose,
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // 4-Step Tabs Indicator
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _buildTabHeader(0, '1. Basic Details'),
                  _buildTabHeader(1, '2. Address'),
                  _buildTabHeader(2, '3. Document Uploads'),
                  _buildTabHeader(3, '4. Review & Submit'),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Content Area
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  FocusManager.instance.primaryFocus?.unfocus();
                },
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                    if (_error.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error,
                                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),

                    if (_activeTab == 0) _buildTab1BasicDetails(),
                    if (_activeTab == 1) _buildTab2Address(),
                    if (_activeTab == 2) _buildTab3Documents(),
                    if (_activeTab == 3) _buildTab4ReviewSubmit(),
                  ],
                ),
              ),
            ),
            ),

            // Footer Navigation Buttons
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  if (_activeTab > 0)
                    OutlinedButton(
                      onPressed: _handlePrev,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF475569),
                        side: const BorderSide(color: Color(0xFFCBD5E1)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      child: const Text('Previous', style: TextStyle(fontWeight: FontWeight.w700)),
                    )
                  else
                    const SizedBox.shrink(),
                  const Spacer(),
                  TextButton(
                    onPressed: _handleClose,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF64748B),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 8),
                  if (_activeTab < 3)
                    ElevatedButton(
                      onPressed: _handleNext,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                      child: const Text('Next Step', style: TextStyle(fontWeight: FontWeight.w800)),
                    )
                  else
                    ElevatedButton(
                      onPressed: _submitting ? null : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                      ),
                      child: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              isEdit ? 'Save Changes' : 'Submit',
                              style: const TextStyle(fontWeight: FontWeight.w800),
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

  Widget _buildTabHeader(int index, String label) {
    final isActive = _activeTab == index;
    return InkWell(
      onTap: () {
        FocusManager.instance.primaryFocus?.unfocus();
        _handleTabChange(index);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isActive ? const Color(0xFFD97706) : Colors.transparent,
              width: 2.5,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
            color: isActive ? const Color(0xFFD97706) : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: BASIC DETAILS
  // ---------------------------------------------------------------------------
  Widget _buildTab1BasicDetails() {
    final isEdit = widget.existingStudent != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildFieldLabel('STUDENT NAME', required: true),
        _buildTextInput(_studentNameCtrl, 'Student Name', errorKey: 'student_name'),
        const SizedBox(height: 14),

        _buildFieldLabel('FATHER NAME', required: true),
        _buildTextInput(_fatherNameCtrl, 'Father Name', errorKey: 'father_name'),
        const SizedBox(height: 14),

        _buildFieldLabel('MOTHER NAME', required: true),
        _buildTextInput(_motherNameCtrl, 'Mother Name', errorKey: 'mother_name'),
        const SizedBox(height: 14),

        _buildFieldLabel('PARENT OCCUPATION'),
        _buildTextInput(_parentOccupationCtrl, 'e.g. Government Employee'),
        const SizedBox(height: 14),

        _buildFieldLabel('GENDER', required: true),
        _buildDropdownInput(
          value: _gender,
          hint: 'Select Gender',
          items: const ['Male', 'Female', 'Other'],
          onChanged: (val) {
            if (val != null) setState(() => _gender = val);
          },
          errorKey: 'gender',
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('DATE OF BIRTH', required: true),
        InkWell(
          onTap: _pickDob,
          child: IgnorePointer(
            child: _buildTextInput(
              _dobCtrl,
              'YYYY-MM-DD',
              errorKey: 'dob',
              suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFF94A3B8)),
            ),
          ),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('ADMISSION DATE', required: true),
        InkWell(
          onTap: _pickAdmissionDate,
          child: IgnorePointer(
            child: _buildTextInput(
              _admissionDateCtrl,
              'YYYY-MM-DD',
              errorKey: 'admission_date',
              suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFF94A3B8)),
            ),
          ),
        ),
        const SizedBox(height: 14),

        if (_shouldShowAdmissionFee) ...[
          _buildFieldLabel('ADMISSION FEE'),
          _buildTextInput(
            _admissionFeeCtrl,
            '0.00',
            isNumeric: true,
            prefixText: '₹ ',
            errorKey: 'admission_fee',
          ),
          const SizedBox(height: 14),
        ],

        if (_isFirstYear && !isEdit) ...[
          _buildFieldLabel('STUDENT CATEGORY', required: true),
          _buildDropdownInput(
            value: _studentCategory,
            hint: 'Select Student Category',
            items: const ['Existing Student', 'New Admission'],
            onChanged: (val) => setState(() => _studentCategory = val),
            errorKey: 'student_category',
          ),
          const SizedBox(height: 14),
        ],

        _buildFieldLabel('BLOOD GROUP'),
        _buildDropdownInput(
          value: _bloodGroup,
          hint: 'Select Blood Group',
          items: const ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
          onChanged: (val) => setState(() => _bloodGroup = val),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('CATEGORY'),
        _buildDropdownInput(
          value: _category,
          hint: 'Select Category',
          items: const ['General', 'OBC', 'SC', 'ST'],
          onChanged: (val) => setState(() => _category = val),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('RELIGION'),
        _buildDropdownInput(
          value: _religion,
          hint: 'Select Religion',
          items: const ['Hindu', 'Muslim', 'Sikh', 'Christian'],
          onChanged: (val) => setState(() => _religion = val),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('AADHAAR NUMBER'),
        _buildTextInput(
          _aadhaarCtrl,
          '12 digit Aadhaar',
          isNumeric: true,
          maxLength: 12,
          errorKey: 'aadhaar_no',
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('CONTACT NUMBER', required: true),
        _buildTextInput(
          _mobileCtrl,
          '10 digit contact number',
          isNumeric: true,
          maxLength: 10,
          errorKey: 'student_mobile',
        ),
        const SizedBox(height: 14),

        if (_isFirstYear) ...[
          _buildFieldLabel('SR NUMBER', required: true),
          _buildTextInput(
            _srNoCtrl,
            'Enter SR Number',
            isNumeric: true,
            errorKey: 'sr_no',
          ),
          const SizedBox(height: 14),
        ] else ...[
          _buildFieldLabel('SR NUMBER (AUTO GENERATED)'),
          _buildTextInput(
            _srNoCtrl,
            'Auto Assigned',
            enabled: false,
          ),
          const SizedBox(height: 14),
        ],

        if (_availableSections.isNotEmpty) ...[
          _buildFieldLabel('SELECT SECTION', required: true),
          _buildDropdownInput(
            value: _selectedSectionName.isNotEmpty ? _selectedSectionName : null,
            hint: 'Select Section',
            items: _availableSections,
            itemLabel: (sec) => sec.length == 1 ? 'Section $sec' : sec,
            onChanged: (val) {
              if (val != null) {
                setState(() {
                  _selectedSectionName = val;
                  final match = _classesList.firstWhere(
                    (c) => c['name'] == _selectedClassName && (c['section']?.toString() ?? '') == val,
                    orElse: () => <String, dynamic>{},
                  );
                  if (match.isNotEmpty && match['id'] != null) {
                    _selectedClassId = int.tryParse(match['id'].toString());
                    if (!isEdit && _selectedClassId != null) {
                      _fetchNextRollNo(_selectedClassId!);
                    }
                  }
                });
              }
            },
            errorKey: 'section_name',
          ),
          const SizedBox(height: 14),
        ],

        if (!isEdit) ...[
          _buildFieldLabel('ROLL NUMBER (AUTO GENERATED)'),
          _buildTextInput(
            _rollCtrl,
            'Auto Assigned',
            enabled: false,
          ),
          const SizedBox(height: 14),
        ] else ...[
          _buildFieldLabel('ROLL NUMBER'),
          _buildTextInput(_rollCtrl, 'e.g. 15', isNumeric: true, errorKey: 'roll_no'),
          const SizedBox(height: 14),
        ],

        if (isEdit) ...[
          _buildFieldLabel('EXIT DATE (OPTIONAL)'),
          InkWell(
            onTap: _pickExitDate,
            child: IgnorePointer(
              child: _buildTextInput(
                _exitDateCtrl,
                'YYYY-MM-DD',
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_exitDateCtrl.text.isNotEmpty)
                      IconButton(
                        icon: const Icon(Icons.clear, size: 16),
                        onPressed: () => setState(() => _exitDateCtrl.clear()),
                      ),
                    const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 2: ADDRESS DETAILS
  // ---------------------------------------------------------------------------
  Widget _buildTab2Address() {
    final stateList = kIndianStatesAndCities.keys.toList();
    final cityList = _currentState.isNotEmpty ? (kIndianStatesAndCities[_currentState] ?? []) : <String>[];
    final permCityList = _permState.isNotEmpty ? (kIndianStatesAndCities[_permState] ?? []) : <String>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'CURRENT ADDRESS',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: 0.5),
        ),
        const SizedBox(height: 12),

        _buildFieldLabel('ADDRESS', required: true),
        _buildTextInput(
          _currentAddress1Ctrl,
          'Max 50 characters allowed',
          maxLength: 50,
          errorKey: 'current_address_line_1',
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('STATE', required: true),
        InkWell(
          onTap: () {
            FocusManager.instance.primaryFocus?.unfocus();
            _showSearchablePicker(
              title: 'State',
              items: stateList,
              currentVal: _currentState,
              onSelected: (val) {
                setState(() {
                  _currentState = val;
                  _currentCity = '';
                  _errors.remove('current_state');
                });
              },
            );
          },
          child: _buildPickerBox(
            value: _currentState,
            placeholder: 'Select or Search State...',
            errorKey: 'current_state',
          ),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('CITY', required: true),
        InkWell(
          onTap: () {
            FocusManager.instance.primaryFocus?.unfocus();
            if (_currentState.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Please select a state first.')),
              );
              return;
            }
            _showSearchablePicker(
              title: 'City',
              items: cityList,
              currentVal: _currentCity,
              onSelected: (val) {
                setState(() {
                  _currentCity = val;
                  _errors.remove('current_city');
                });
              },
            );
          },
          child: _buildPickerBox(
            value: _currentCity,
            placeholder: _currentState.isEmpty ? 'Select state first' : 'Select or Search City...',
            errorKey: 'current_city',
          ),
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('COUNTRY'),
        _buildTextInput(_currentCountryCtrl, 'Country'),
        const SizedBox(height: 14),

        _buildFieldLabel('PIN CODE', required: true),
        _buildTextInput(
          _currentPinCtrl,
          'ZIP/PIN Code',
          isNumeric: true,
          maxLength: 6,
          errorKey: 'current_pin_code',
        ),
        const SizedBox(height: 20),

        // Same as current checkbox (tap on either checkbox or label toggles)
        InkWell(
          onTap: () {
            FocusManager.instance.primaryFocus?.unfocus();
            setState(() {
              _sameAsCurrent = !_sameAsCurrent;
              if (_sameAsCurrent) {
                _permAddress1Ctrl.text = _currentAddress1Ctrl.text;
                _permAddress2Ctrl.text = _currentAddress2Ctrl.text;
                _permState = _currentState;
                _permCity = _currentCity;
                _permCountryCtrl.text = _currentCountryCtrl.text;
                _permPinCtrl.text = _currentPinCtrl.text;
              }
            });
          },
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Checkbox(
                  value: _sameAsCurrent,
                  activeColor: const Color(0xFFD97706),
                  onChanged: (val) {
                    FocusManager.instance.primaryFocus?.unfocus();
                    setState(() {
                      _sameAsCurrent = val ?? true;
                      if (_sameAsCurrent) {
                        _permAddress1Ctrl.text = _currentAddress1Ctrl.text;
                        _permAddress2Ctrl.text = _currentAddress2Ctrl.text;
                        _permState = _currentState;
                        _permCity = _currentCity;
                        _permCountryCtrl.text = _currentCountryCtrl.text;
                        _permPinCtrl.text = _currentPinCtrl.text;
                      }
                    });
                  },
                ),
                const Expanded(
                  child: Text(
                    'PERMANENT ADDRESS SAME AS CURRENT ADDRESS',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                  ),
                ),
              ],
            ),
          ),
        ),

        if (!_sameAsCurrent) ...[
          const SizedBox(height: 16),
          const Text(
            'PERMANENT ADDRESS',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),

          _buildFieldLabel('PERMANENT ADDRESS', required: true),
          _buildTextInput(
            _permAddress1Ctrl,
            'Max 50 characters allowed',
            maxLength: 50,
            errorKey: 'permanent_address_line_1',
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('STATE', required: true),
          InkWell(
            onTap: () {
              FocusManager.instance.primaryFocus?.unfocus();
              _showSearchablePicker(
                title: 'Permanent State',
                items: stateList,
                currentVal: _permState,
                onSelected: (val) {
                  setState(() {
                    _permState = val;
                    _permCity = '';
                    _errors.remove('permanent_state');
                  });
                },
              );
            },
            child: _buildPickerBox(
              value: _permState,
              placeholder: 'Select or Search State...',
              errorKey: 'permanent_state',
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('CITY', required: true),
          InkWell(
            onTap: () {
              FocusManager.instance.primaryFocus?.unfocus();
              if (_permState.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please select permanent state first.')),
                );
                return;
              }
              _showSearchablePicker(
                title: 'Permanent City',
                items: permCityList,
                currentVal: _permCity,
                onSelected: (val) {
                  setState(() {
                    _permCity = val;
                    _errors.remove('permanent_city');
                  });
                },
              );
            },
            child: _buildPickerBox(
              value: _permCity,
              placeholder: _permState.isEmpty ? 'Select state first' : 'Select or Search City...',
              errorKey: 'permanent_city',
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('COUNTRY'),
          _buildTextInput(_permCountryCtrl, 'Country'),
          const SizedBox(height: 14),

          _buildFieldLabel('PIN CODE', required: true),
          _buildTextInput(
            _permPinCtrl,
            'ZIP/PIN Code',
            isNumeric: true,
            maxLength: 6,
            errorKey: 'permanent_pin_code',
          ),
        ],
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 3: DOCUMENT UPLOADS
  // ---------------------------------------------------------------------------
  Widget _buildTab3Documents() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'STUDENT RECORDS UPLOAD',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: 0.5),
        ),
        const SizedBox(height: 4),
        const Text(
          'Upload scanned copies/images of primary documentation. Accepted: PNG, JPG, PDF (Max 5MB).',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 16),

        // 1. Student Photo
        _buildDocumentCard(
          title: 'STUDENT PHOTO',
          filePath: _photoPath,
          isPhoto: true,
          isUploading: _uploadingMap['photo'] == true,
          onUploadTap: _pickPhoto,
          onRemoveTap: () => setState(() => _photoPath = ''),
        ),
        const SizedBox(height: 12),

        // 2. Birth Certificate
        _buildDocumentCard(
          title: 'BIRTH CERTIFICATE',
          filePath: _birthCertPath,
          isUploading: _uploadingMap['birth_cert'] == true,
          onUploadTap: () => _pickDocument('birth_cert', (url) => _birthCertPath = url),
          onRemoveTap: () => setState(() => _birthCertPath = ''),
        ),
        const SizedBox(height: 12),

        // 3. Aadhaar Card
        _buildDocumentCard(
          title: 'AADHAAR CARD',
          filePath: _aadhaarPath,
          isUploading: _uploadingMap['aadhaar'] == true,
          onUploadTap: () => _pickDocument('aadhaar', (url) => _aadhaarPath = url),
          onRemoveTap: () => setState(() => _aadhaarPath = ''),
        ),
        const SizedBox(height: 12),

        // 4. Transfer Certificate (TC)
        _buildDocumentCard(
          title: 'TRANSFER CERTIFICATE (TC)',
          filePath: _transferCertPath,
          isUploading: _uploadingMap['transfer_cert'] == true,
          onUploadTap: () => _pickDocument('transfer_cert', (url) => _transferCertPath = url),
          onRemoveTap: () => setState(() => _transferCertPath = ''),
        ),
        const SizedBox(height: 12),

        // 5. Previous Report Card
        _buildDocumentCard(
          title: 'PREVIOUS REPORT CARD',
          filePath: _reportCardPath,
          isUploading: _uploadingMap['report_card'] == true,
          onUploadTap: () => _pickDocument('report_card', (url) => _reportCardPath = url),
          onRemoveTap: () => setState(() => _reportCardPath = ''),
        ),
        const SizedBox(height: 12),

        // 6. Additional Documents
        _buildDocumentCard(
          title: 'ADDITIONAL DOCUMENTS',
          filePath: _additionalDocsPath,
          isUploading: _uploadingMap['additional_docs'] == true,
          onUploadTap: () => _pickDocument('additional_docs', (url) => _additionalDocsPath = url),
          onRemoveTap: () => setState(() => _additionalDocsPath = ''),
        ),
      ],
    );
  }

  Widget _buildDocumentCard({
    required String title,
    required String filePath,
    bool isPhoto = false,
    required bool isUploading,
    required VoidCallback onUploadTap,
    required VoidCallback onRemoveTap,
  }) {
    final hasFile = filePath.isNotEmpty;
    final fileName = hasFile ? filePath.split('/').last : '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF475569)),
              ),
              if (hasFile)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'UPLOADED',
                        style: TextStyle(color: Color(0xFF16A34A), fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              if (isPhoto && hasFile) ...[
                ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: widget.classService.baseUrl.startsWith('http') && !filePath.startsWith('http')
                        ? '${widget.classService.baseUrl}/$filePath'
                        : filePath,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => const SizedBox(
                      width: 44,
                      height: 44,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFD97706)),
                    ),
                    errorWidget: (_, __, ___) => const Icon(Icons.person, size: 28, color: Color(0xFF94A3B8)),
                  ),
                ),
                const SizedBox(width: 12),
              ],

              ElevatedButton.icon(
                onPressed: isUploading ? null : onUploadTap,
                icon: isUploading
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.upload_file_rounded, size: 15),
                label: Text(
                  hasFile ? 'Change File' : 'Choose File',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),

              if (hasFile) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 18),
                  onPressed: onRemoveTap,
                  tooltip: 'Remove',
                ),
              ],

              if (hasFile && !isPhoto) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 4: REVIEW & SUBMIT
  // ---------------------------------------------------------------------------
  Widget _buildTab4ReviewSubmit() {
    final yearName = _academicYears.firstWhere(
      (y) => y['id']?.toString() == _selectedAcademicYearId?.toString(),
      orElse: () => <String, dynamic>{'name': 'Current Session'},
    )['name']?.toString() ?? 'Current Session';

    final currentAddrStr = [
      _currentAddress1Ctrl.text.trim(),
      _currentAddress2Ctrl.text.trim(),
      _currentCity,
      _currentState,
      _currentPinCtrl.text.trim().isNotEmpty ? 'PIN: ${_currentPinCtrl.text.trim()}' : '',
      _currentCountryCtrl.text.trim(),
    ].where((s) => s.isNotEmpty).join(', ');

    final permAddrStr = _sameAsCurrent
        ? 'Same as Current Address'
        : [
            _permAddress1Ctrl.text.trim(),
            _permAddress2Ctrl.text.trim(),
            _permCity,
            _permState,
            _permPinCtrl.text.trim().isNotEmpty ? 'PIN: ${_permPinCtrl.text.trim()}' : '',
            _permCountryCtrl.text.trim(),
          ].where((s) => s.isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'REVIEW ENROLLMENT SUMMARY',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A), letterSpacing: 0.5),
        ),
        const SizedBox(height: 14),

        // Card 1: Student Profile
        _buildReviewSection(
          title: 'STUDENT PROFILE',
          items: [
            _buildReviewRow('Full Name', _studentNameCtrl.text.trim()),
            _buildReviewRow('Gender / DOB', '${_gender.toUpperCase()} / ${_dobCtrl.text.trim()}'),
            _buildReviewRow('Aadhaar No', _aadhaarCtrl.text.trim().isNotEmpty ? _aadhaarCtrl.text.trim() : '-'),
            _buildReviewRow('Contact Mobile', _mobileCtrl.text.trim().isNotEmpty ? _mobileCtrl.text.trim() : '-'),
            if (_bloodGroup != null && _bloodGroup!.isNotEmpty) _buildReviewRow('Blood Group', _bloodGroup!),
            if (_category != null && _category!.isNotEmpty) _buildReviewRow('Category', _category!),
            if (_religion != null && _religion!.isNotEmpty) _buildReviewRow('Religion', _religion!),
          ],
        ),
        const SizedBox(height: 14),

        // Card 2: Academic Details
        _buildReviewSection(
          title: 'ACADEMIC DETAILS',
          items: [
            _buildReviewRow('Academic Year', yearName),
            _buildReviewRow(
              'Class Assigned',
              '$_selectedClassName${_selectedSectionName.isNotEmpty ? ' - Section $_selectedSectionName' : ''}',
            ),
            _buildReviewRow('Roll Number', _rollCtrl.text.trim().isNotEmpty ? _rollCtrl.text.trim() : '-'),
            _buildReviewRow('SR Number', _srNoCtrl.text.trim().isNotEmpty ? _srNoCtrl.text.trim() : 'Auto Assigned'),
            _buildReviewRow('Admission Date', _admissionDateCtrl.text.trim()),
            if (_shouldShowAdmissionFee && _admissionFeeCtrl.text.trim().isNotEmpty)
              _buildReviewRow('Admission Fee', '₹ ${_admissionFeeCtrl.text.trim()}'),
            if (_exitDateCtrl.text.trim().isNotEmpty)
              _buildReviewRow('Exit Date', _exitDateCtrl.text.trim(), isDestructive: true),
          ],
        ),
        const SizedBox(height: 14),

        // Card 3: Parent Info
        _buildReviewSection(
          title: 'PARENT INFO',
          items: [
            _buildReviewRow('Father Name', _fatherNameCtrl.text.trim()),
            _buildReviewRow('Mother Name', _motherNameCtrl.text.trim()),
            if (_parentOccupationCtrl.text.trim().isNotEmpty)
              _buildReviewRow('Occupation', _parentOccupationCtrl.text.trim()),
          ],
        ),
        const SizedBox(height: 14),

        // Card 4: Address Details
        _buildReviewSection(
          title: 'ADDRESS DETAILS',
          items: [
            _buildReviewRow('Current Address', currentAddrStr),
            _buildReviewRow('Permanent Address', permAddrStr),
          ],
        ),
        const SizedBox(height: 14),

        // Card 5: Uploaded Documents Summary
        _buildReviewSection(
          title: 'UPLOADED DOCUMENTS',
          items: [
            _buildReviewDocStatus('Student Photo', _photoPath.isNotEmpty),
            _buildReviewDocStatus('Birth Certificate', _birthCertPath.isNotEmpty),
            _buildReviewDocStatus('Aadhaar Card', _aadhaarPath.isNotEmpty),
            _buildReviewDocStatus('Transfer Certificate (TC)', _transferCertPath.isNotEmpty),
            _buildReviewDocStatus('Previous Report Card', _reportCardPath.isNotEmpty),
            _buildReviewDocStatus('Additional Documents', _additionalDocsPath.isNotEmpty),
          ],
        ),
      ],
    );
  }

  Widget _buildReviewSection({required String title, required List<Widget> items}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706), letterSpacing: 0.5),
          ),
          const SizedBox(height: 10),
          ...items,
        ],
      ),
    );
  }

  Widget _buildReviewRow(String label, String value, {bool isDestructive = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
          ),
          const Text(': ', style: TextStyle(color: Color(0xFF94A3B8))),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isDestructive ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewDocStatus(String title, bool isUploaded) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
          ),
          if (isUploaded)
            const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 13),
                SizedBox(width: 4),
                Text('Uploaded', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
              ],
            )
          else
            const Text(
              'Not Uploaded',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF94A3B8)),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // HELPER FORM WIDGETS
  // ---------------------------------------------------------------------------
  Widget _buildFieldLabel(String text, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(
            text,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF475569), letterSpacing: 0.3),
          ),
          if (required) ...[
            const SizedBox(width: 4),
            const Text('*', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  Widget _buildTextInput(
    TextEditingController ctrl,
    String placeholder, {
    bool isNumeric = false,
    bool enabled = true,
    int? maxLength,
    String? prefixText,
    Widget? suffixIcon,
    String? errorKey,
  }) {
    final hasErr = errorKey != null && _errors.containsKey(errorKey);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: ctrl,
          enabled: enabled,
          keyboardType: isNumeric ? TextInputType.number : TextInputType.text,
          inputFormatters: isNumeric ? [FilteringTextInputFormatter.digitsOnly] : null,
          maxLength: maxLength,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: enabled ? const Color(0xFF0F172A) : const Color(0xFF64748B),
          ),
          decoration: InputDecoration(
            counterText: '',
            prefixText: prefixText,
            prefixStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
            suffixIcon: suffixIcon,
            hintText: placeholder,
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
            filled: true,
            fillColor: enabled ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: hasErr ? const Color(0xFFDC2626) : const Color(0xFFCBD5E1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: hasErr ? const Color(0xFFDC2626) : const Color(0xFFCBD5E1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
          onChanged: (_) {
            if (hasErr) setState(() => _errors.remove(errorKey));
          },
        ),
        if (hasErr)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              _errors[errorKey]!,
              style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }

  Widget _buildDropdownInput({
    required String? value,
    required String hint,
    required List<String> items,
    required ValueChanged<String?> onChanged,
    String Function(String)? itemLabel,
    String? errorKey,
  }) {
    final hasErr = errorKey != null && _errors.containsKey(errorKey);
    final displayText = (value != null && value.isNotEmpty)
        ? (itemLabel != null ? itemLabel(value) : value)
        : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Builder(
          builder: (btnContext) {
            return InkWell(
              onTap: items.isEmpty
                  ? null
                  : () async {
                      FocusManager.instance.primaryFocus?.unfocus();
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
                        items: items.map((opt) {
                          final isSelected = opt == value;
                          final label = itemLabel != null ? itemLabel(opt) : opt;
                          return PopupMenuItem<String>(
                            value: opt,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                                color: isSelected ? const Color(0xFFD97706) : const Color(0xFF1E293B),
                              ),
                            ),
                          );
                        }).toList(),
                      );

                      if (selected != null) {
                        onChanged(selected);
                        if (hasErr) setState(() => _errors.remove(errorKey));
                      }
                    },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: hasErr ? const Color(0xFFDC2626) : const Color(0xFFCBD5E1),
                    width: hasErr ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        displayText.isNotEmpty ? displayText : hint,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: displayText.isNotEmpty ? FontWeight.w700 : FontWeight.w500,
                          color: displayText.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                    const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 20),
                  ],
                ),
              ),
            );
          },
        ),
        if (hasErr)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              _errors[errorKey]!,
              style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }

  Widget _buildPickerBox({
    required String value,
    required String placeholder,
    String? errorKey,
  }) {
    final hasErr = errorKey != null && _errors.containsKey(errorKey);
    final hasVal = value.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: hasErr ? const Color(0xFFDC2626) : const Color(0xFFCBD5E1)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                hasVal ? value : placeholder,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: hasVal ? FontWeight.w700 : FontWeight.w500,
                  color: hasVal ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                ),
              ),
              const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B)),
            ],
          ),
        ),
        if (hasErr)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              _errors[errorKey]!,
              style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

// ============================================================================
// STUDENT CREDENTIALS MODAL
// ============================================================================
class _StudentCredentialsModal extends StatefulWidget {
  final Map<String, dynamic> student;
  final ClassManagementService classService;

  const _StudentCredentialsModal({required this.student, required this.classService});

  @override
  State<_StudentCredentialsModal> createState() => _StudentCredentialsModalState();
}

class _StudentCredentialsModalState extends State<_StudentCredentialsModal> {
  bool _isLoading = true;
  String _username = '';
  String _password = '';
  bool _showPassword = false;
  String _error = '';
  bool _resetting = false;
  final TextEditingController _newPass = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _newPass.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final id = int.tryParse(widget.student['id'].toString()) ?? 0;
    try {
      final res = await widget.classService.getCredentials(id);
      if (mounted) {
        setState(() {
          _username = res['phone']?.toString() ??
              res['username']?.toString() ??
              widget.student['student_mobile']?.toString() ??
              widget.student['phone']?.toString() ??
              '';
          _password = res['plain_password']?.toString() ??
              res['password']?.toString() ??
              res['generated_password']?.toString() ??
              '';
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _username = widget.student['student_mobile']?.toString() ?? widget.student['phone']?.toString() ?? '';
          _password = '';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _updatePassword() async {
    final pass = _newPass.text.trim();
    if (pass.length < 6) {
      setState(() => _error = 'New password must be at least 6 characters.');
      return;
    }

    final id = int.tryParse(widget.student['id'].toString()) ?? 0;
    setState(() {
      _resetting = true;
      _error = '';
    });

    try {
      await widget.classService.updateCredentials(studentId: id, newPassword: pass);
      if (mounted) {
        setState(() {
          _password = pass;
          _newPass.clear();
          _resetting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password updated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _resetting = false;
          _error = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  widget.student['name']?.toString() ?? 'Credentials',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  final textToCopy = 'Login Number: $_username\nPassword: $_password';
                  Clipboard.setData(ClipboardData(text: textToCopy));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Credentials copied to clipboard!'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.copy_rounded, size: 14, color: Color(0xFF2563EB)),
                      SizedBox(width: 6),
                      Text(
                        'Copy Credential',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 16, color: Color(0xFFE2E8F0)),
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
              child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
            ),
          if (_isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Login Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      Text(_username, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                    ],
                  ),
                  const Divider(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Current Password', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _showPassword
                                ? (_password.isNotEmpty ? _password : 'Not Set')
                                : (_password.isNotEmpty ? '••••••••' : '••••••••'),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 4),
                          IconButton(
                            icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: const Color(0xFF64748B)),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                            visualDensity: VisualDensity.compact,
                            splashRadius: 18,
                            padding: const EdgeInsets.all(4),
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text('RESET PASSWORD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _newPass,
                    decoration: InputDecoration(
                      hintText: 'Enter new password (min 6 chars)',
                      hintStyle: const TextStyle(fontSize: 12),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _resetting ? null : _updatePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  child: _resetting
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Update', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================================
// CLASS IDENTITY CARDS PREVIEW & PDF
// ============================================================================
class _ClassIdCardsPreviewScreen extends StatefulWidget {
  final String className;
  final List<Map<String, dynamic>> students;
  final Map<String, dynamic> schoolProfile;
  final List<Map<String, dynamic>> academicYears;
  final ClassManagementService classService;

  const _ClassIdCardsPreviewScreen({
    required this.className,
    required this.students,
    required this.schoolProfile,
    required this.academicYears,
    required this.classService,
  });

  @override
  State<_ClassIdCardsPreviewScreen> createState() => _ClassIdCardsPreviewScreenState();
}

class _ClassIdCardsPreviewScreenState extends State<_ClassIdCardsPreviewScreen> {
  bool _generating = false;

  String get _schoolName => widget.schoolProfile['name']?.toString() ?? 'SHIKSHA PILOT SCHOOL';

  String get _academicYearName {
    if (widget.academicYears.isNotEmpty) {
      final current = widget.academicYears.firstWhere(
        (y) => y['is_current'] == 1 || y['is_current'] == true,
        orElse: () => widget.academicYears.first,
      );
      return current['name']?.toString() ?? '2028–2029';
    }
    return '2028–2029';
  }

  Future<void> _handleDownloadPdf() async {
    setState(() => _generating = true);

    try {
      final pdf = pw.Document();
      final students = widget.students;

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(24),
          build: (pw.Context context) {
            return [
              pw.Header(
                level: 0,
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(_schoolName.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('STUDENT IDENTITY CARDS - ${widget.className} ($_academicYearName)', style: const pw.TextStyle(fontSize: 10)),
                  ],
                ),
              ),
              pw.SizedBox(height: 12),
              pw.Wrap(
                spacing: 16,
                runSpacing: 16,
                children: students.map((s) {
                  final name = s['name'] ?? 'Student';
                  final father = s['father_name'] ?? '—';
                  final roll = s['roll_no'] ?? s['roll'] ?? '—';
                  final srNo = s['admission_no'] ?? s['sr_no'] ?? '—';

                  return pw.Container(
                    width: 250,
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.black, width: 1.5),
                      borderRadius: const pw.BorderRadius.all(pw.Radius.circular(10)),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                      children: [
                        pw.Container(
                          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: const pw.BoxDecoration(
                            color: PdfColors.teal800,
                            borderRadius: pw.BorderRadius.vertical(top: pw.Radius.circular(8)),
                          ),
                          child: pw.Row(
                            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                            children: [
                              pw.Text(_schoolName, style: pw.TextStyle(color: PdfColors.amber, fontWeight: pw.FontWeight.bold, fontSize: 9)),
                              pw.Text(_academicYearName, style: const pw.TextStyle(color: PdfColors.amber, fontSize: 8)),
                            ],
                          ),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(10),
                          child: pw.Row(
                            children: [
                              pw.Container(
                                width: 50,
                                height: 60,
                                decoration: pw.BoxDecoration(
                                  border: pw.Border.all(color: PdfColors.grey),
                                  borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
                                ),
                                alignment: pw.Alignment.center,
                                child: pw.Text('PHOTO', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey)),
                              ),
                              pw.SizedBox(width: 10),
                              pw.Expanded(
                                child: pw.Column(
                                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                                  children: [
                                    pw.Text(name.toString().toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                                    pw.SizedBox(height: 2),
                                    pw.Text('Class: ${widget.className}', style: const pw.TextStyle(fontSize: 8)),
                                    pw.Text('Roll No: $roll • SR: $srNo', style: const pw.TextStyle(fontSize: 8)),
                                    pw.Text('Father: $father', style: const pw.TextStyle(fontSize: 8)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ];
          },
        ),
      );

      final pdfBytes = await pdf.save();

      const platform = MethodChannel('com.shikshapilot.app/media');
      final fileName = 'ID_Cards_${widget.className.replaceAll(" ", "_")}.pdf';

      final result = await platform.invokeMethod('saveFileToDownloads', {
        'bytes': pdfBytes,
        'fileName': fileName,
      });

      if (mounted) {
        setState(() => _generating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result != null ? 'ID Cards saved to Downloads folder!' : 'PDF Generated.'),
            action: SnackBarAction(
              label: 'PRINT / SHARE',
              textColor: Colors.amber,
              onPressed: () {
                Printing.layoutPdf(onLayout: (_) => pdfBytes);
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _generating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate PDF: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = widget.students;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF8F5),
      appBar: AppBar(
        title: Text('${widget.className} Identity Cards', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A))),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        actions: [
          IconButton(
            tooltip: 'Print / Share',
            icon: const Icon(Icons.print_rounded),
            onPressed: _handleDownloadPdf,
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE2E8F0)))),
        child: ElevatedButton.icon(
          onPressed: _generating ? null : _handleDownloadPdf,
          icon: _generating
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.download_rounded, color: Colors.white),
          label: Text(_generating ? 'Generating PDF...' : 'Download PDF', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF059669),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
      body: students.isEmpty
          ? const Center(child: Text('No students in this class.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: students.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, idx) {
                final s = students[idx];
                final name = (s['name'] ?? 'Student').toString();
                final father = (s['father_name'] ?? '—').toString();
                final roll = (s['roll_no'] ?? s['roll'] ?? '—').toString();
                final srNo = (s['admission_no'] ?? s['sr_no'] ?? '—').toString();
                final photo = (s['photo_path'] ?? '').toString();

                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF1E293B), width: 1.5),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF065F46), Color(0xFF0D9488)],
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_schoolName.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFFDE68A))),
                            Text(_academicYearName, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFFDE68A))),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              width: 70,
                              height: 84,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: photo.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: widget.classService.baseUrl.startsWith('http') ? '${widget.classService.baseUrl}/$photo' : photo,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) => const Icon(Icons.person, color: Color(0xFF94A3B8)),
                                    )
                                  : const Icon(Icons.person, color: Color(0xFF94A3B8)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name.toUpperCase(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                                  const SizedBox(height: 4),
                                  Text('Class: ${widget.className}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
                                  Text('Roll: $roll • SR: $srNo', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                                  Text('Father: $father', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      SizedBox(
                                        width: 34,
                                        height: 34,
                                        child: QrImageView(data: 'STUDENT:$srNo:$name:${widget.className}', version: QrVersions.auto, size: 34),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text('OFFICIAL ID', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF059669))),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
