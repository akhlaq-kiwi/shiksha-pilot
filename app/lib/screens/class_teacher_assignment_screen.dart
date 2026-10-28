import 'dart:async';
import 'package:flutter/material.dart';
import 'package:school_hub/services/class_teacher_service.dart';

class ClassTeacherAssignmentScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const ClassTeacherAssignmentScreen({
    super.key,
    required this.baseUrl,
    required this.token,
  });

  @override
  State<ClassTeacherAssignmentScreen> createState() => _ClassTeacherAssignmentScreenState();
}

class _ClassTeacherAssignmentScreenState extends State<ClassTeacherAssignmentScreen> {
  late ClassTeacherService _classTeacherService;
  bool _isLoading = true;
  String _errorMessage = '';
  String _successBanner = '';
  Timer? _bannerTimer;

  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _teachers = [];
  final Map<int, int?> _localAssignments = {};
  int? _savingClassId;

  @override
  void initState() {
    super.initState();
    _classTeacherService = ClassTeacherService(
      baseUrl: widget.baseUrl,
      token: widget.token,
    );
    _loadData();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    super.dispose();
  }

  void _showSuccessBanner(String msg) {
    _bannerTimer?.cancel();
    setState(() {
      _successBanner = msg;
    });
    _bannerTimer = Timer(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _successBanner = '';
        });
      }
    });
  }

  String _getShortClassName(String? className) {
    if (className == null || className.isEmpty) return '';
    final clean = className.trim();
    final lower = clean.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (lower.contains('lowerkindergarten') || lower.contains('lowerkg') || lower.contains('lkg') || lower == 'lkg') {
      return 'LKG';
    }
    if (lower.contains('upperkindergarten') || lower.contains('upperkg') || lower.contains('ukg') || lower == 'ukg') {
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
    return clean;
  }

  int _getClassOrderRank(String className) {
    if (className.isEmpty) return 999;
    final clean = className.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

    // Playgroup (Rank 1)
    if (clean.contains('playgroup') || clean == 'pg' || clean.contains('play')) {
      return 1;
    }
    // Pre-Nursery / PNC (Rank 2) - MUST come BEFORE Nursery / NC
    if (clean.contains('prenursery') || clean == 'pnc' || clean.contains('prenurs') || clean.contains('prek')) {
      return 2;
    }
    // Nursery / NC (Rank 3)
    if (clean.contains('nursery') || clean == 'nc') {
      return 3;
    }
    // Lower Kindergarten / LKG (Rank 4)
    if (clean.contains('lowerkindergarten') || clean.contains('lowerkg') || clean.contains('lkg')) {
      return 4;
    }
    // Upper Kindergarten / UKG (Rank 5)
    if (clean.contains('upperkindergarten') || clean.contains('upperkg') || clean.contains('ukg')) {
      return 5;
    }
    // KG / Kindergarten (Rank 6)
    if (clean == 'kg' || clean.contains('kindergarten')) {
      return 6;
    }
    // Prep (Rank 7)
    if (clean.contains('prep')) {
      return 7;
    }

    final match = RegExp(r'\d+').firstMatch(clean);
    if (match != null) {
      final num = int.tryParse(match.group(0) ?? '');
      if (num != null) return 10 + num;
    }
    return 999;
  }

  String _formatClassLabel(Map<String, dynamic> c) {
    final shortName = _getShortClassName(c['name']?.toString() ?? '');
    final section = (c['section']?.toString() ?? '').trim();
    return section.isNotEmpty ? '$shortName-$section' : shortName;
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final res = await _classTeacherService.getClassTeacherAssignments();
      final rawClasses = (res['classes'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final rawTeachers = (res['teachers'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      // Sort classes naturally
      rawClasses.sort((a, b) {
        final nameA = a['name']?.toString() ?? '';
        final nameB = b['name']?.toString() ?? '';
        final rankA = _getClassOrderRank(nameA);
        final rankB = _getClassOrderRank(nameB);
        if (rankA != rankB) return rankA.compareTo(rankB);

        final secA = (a['section']?.toString() ?? '').trim();
        final secB = (b['section']?.toString() ?? '').trim();
        if (secA != secB) return secA.compareTo(secB);
        return nameA.compareTo(nameB);
      });

      // Sort teachers alphabetically
      rawTeachers.sort((a, b) {
        final nameA = a['name']?.toString() ?? '';
        final nameB = b['name']?.toString() ?? '';
        return nameA.toLowerCase().compareTo(nameB.toLowerCase());
      });

      _localAssignments.clear();
      for (final c in rawClasses) {
        final cid = c['id'] is int ? c['id'] as int : int.parse(c['id'].toString());
        final rawTid = c['assigned_teacher_id'];
        final tid = rawTid != null ? (rawTid is int ? rawTid : int.tryParse(rawTid.toString())) : null;
        _localAssignments[cid] = tid;
      }

      if (mounted) {
        setState(() {
          _classes = rawClasses;
          _teachers = rawTeachers;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _executeAutoSave(int classId, int? newTeacherId, int? previousTeacherId) async {
    setState(() {
      _savingClassId = classId;
      _localAssignments[classId] = newTeacherId;
      _errorMessage = '';
    });

    try {
      // Build assignment payload for all classes
      final assignments = _classes.map((c) {
        final cid = c['id'] is int ? c['id'] as int : int.parse(c['id'].toString());
        final tid = cid == classId ? newTeacherId : _localAssignments[cid];
        return {
          'class_id': cid,
          'teacher_id': tid,
        };
      }).toList();

      await _classTeacherService.saveClassTeacherAssignments(assignments: assignments);

      if (mounted) {
        _showSuccessBanner(
          newTeacherId != null
              ? 'Class teacher assigned successfully.'
              : 'Class teacher unassigned successfully.',
        );
      }
      await _loadData();
    } catch (err) {
      if (mounted) {
        setState(() {
          _localAssignments[classId] = previousTeacherId;
          _errorMessage = 'Unable to save changes. Please try again.';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMessage),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _savingClassId = null;
        });
      }
    }
  }

  void _onClassTeacherChange(int classId, int? newTeacherId) {
    final previousTeacherId = _localAssignments[classId];

    if (newTeacherId == null) {
      _executeAutoSave(classId, null, previousTeacherId);
      return;
    }

    if (previousTeacherId != null && previousTeacherId != newTeacherId) {
      final prevTeacher = _teachers.firstWhere(
        (t) => (t['id'] is int ? t['id'] : int.parse(t['id'].toString())) == previousTeacherId,
        orElse: () => {'name': 'Unknown'},
      );
      final newTeacher = _teachers.firstWhere(
        (t) => (t['id'] is int ? t['id'] : int.parse(t['id'].toString())) == newTeacherId,
        orElse: () => {'name': 'Unknown'},
      );

      _showReplaceConfirmDialog(
        classId: classId,
        prevTeacherName: prevTeacher['name']?.toString() ?? 'Unknown',
        newTeacherId: newTeacherId,
        newTeacherName: newTeacher['name']?.toString() ?? 'Unknown',
        previousTeacherId: previousTeacherId,
      );
    } else {
      _executeAutoSave(classId, newTeacherId, previousTeacherId);
    }
  }

  void _showReplaceConfirmDialog({
    required int classId,
    required String prevTeacherName,
    required int newTeacherId,
    required String newTeacherName,
    required int previousTeacherId,
  }) {
    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          title: const Text(
            'Replace Existing Class Teacher?',
            style: TextStyle(
              fontSize: 16.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF0F172A),
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Selecting this teacher will replace the currently assigned teacher for this class.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 16),
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
                        const Text(
                          'Previous Teacher:',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                        Text(
                          prevTeacherName,
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'New Teacher:',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                        Text(
                          newTeacherName,
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text(
                'Cancel',
                style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              ),
              onPressed: () {
                Navigator.pop(dialogCtx);
                _executeAutoSave(classId, newTeacherId, previousTeacherId);
              },
              child: const Text('Replace', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showTeacherSelectionBottomSheet(int classId, String classLabel) {
    final currentTeacherId = _localAssignments[classId];
    final sheetSearchController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            final query = sheetSearchController.text.trim().toLowerCase();
            final filteredTeachers = _teachers.where((t) {
              if (query.isEmpty) return true;
              final name = (t['name']?.toString() ?? '').toLowerCase();
              return name.contains(query);
            }).toList();

            return SafeArea(
              child: Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.75,
                ),
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(ctx).viewInsets.bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Drag indicator handle
                    Container(
                      margin: const EdgeInsets.only(top: 10, bottom: 8),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),

                    // Header title
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Assign Teacher for $classLabel',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Select a teacher from the active faculty',
                                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                    ),

                    // Search input
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: Container(
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          children: [
                            const Icon(Icons.search_rounded, size: 18, color: Color(0xFF94A3B8)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: sheetSearchController,
                                onChanged: (_) => setModalState(() {}),
                                style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                                decoration: const InputDecoration(
                                  hintText: 'Search teacher name...',
                                  hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                            if (sheetSearchController.text.isNotEmpty)
                              GestureDetector(
                                onTap: () {
                                  sheetSearchController.clear();
                                  setModalState(() {});
                                },
                                child: const Icon(Icons.close, size: 16, color: Color(0xFF94A3B8)),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const Divider(height: 12, thickness: 1, color: Color(0xFFF1F5F9)),

                    // Teacher list
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        children: [
                          // 1. Unassign Option
                          InkWell(
                            onTap: () {
                              Navigator.pop(ctx);
                              _onClassTeacherChange(classId, null);
                            },
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: currentTeacherId == null ? const Color(0xFFFEF2F2) : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: currentTeacherId == null
                                    ? Border.all(color: const Color(0xFFFECACA))
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: const Color(0xFFFEE2E2),
                                    child: Icon(
                                      Icons.person_off_rounded,
                                      size: 16,
                                      color: Colors.red.shade600,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      '-- Unassigned --',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: currentTeacherId == null ? FontWeight.bold : FontWeight.w500,
                                        color: currentTeacherId == null
                                            ? Colors.red.shade700
                                            : const Color(0xFF64748B),
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                  ),
                                  if (currentTeacherId == null)
                                    Icon(Icons.check_circle_rounded, color: Colors.red.shade600, size: 20),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 4),

                          // 2. Active Teachers list
                          ...filteredTeachers.map((teacher) {
                            final tid = teacher['id'] is int ? teacher['id'] as int : int.parse(teacher['id'].toString());
                            final isSelected = tid == currentTeacherId;
                            final name = teacher['name']?.toString() ?? '';

                            return InkWell(
                              onTap: () {
                                Navigator.pop(ctx);
                                _onClassTeacherChange(classId, tid);
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                                margin: const EdgeInsets.symmetric(vertical: 2),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFF0FDFA) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                  border: isSelected
                                      ? Border.all(color: const Color(0xFF99F6E4))
                                      : null,
                                ),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 16,
                                      backgroundColor: isSelected
                                          ? const Color(0xFFCCFBF1)
                                          : const Color(0xFFF1F5F9),
                                      child: Text(
                                        name.isNotEmpty ? name[0].toUpperCase() : 'T',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: isSelected
                                              ? const Color(0xFF0F766E)
                                              : const Color(0xFF475569),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                              color: isSelected
                                                  ? const Color(0xFF0F766E)
                                                  : const Color(0xFF0F172A),
                                            ),
                                          ),
                                          if (teacher['department'] != null && teacher['department'].toString().isNotEmpty)
                                            Text(
                                              teacher['department'].toString(),
                                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                            ),
                                        ],
                                      ),
                                    ),
                                    if (isSelected)
                                      const Icon(
                                        Icons.check_circle_rounded,
                                        color: Color(0xFF0D9488),
                                        size: 20,
                                      ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),

                          if (filteredTeachers.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 36),
                              child: Center(
                                child: Text(
                                  'No matching teachers found.',
                                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
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
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalClasses = _classes.length;
    final assignedCount = _localAssignments.values.where((id) => id != null).length;

    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6), // Warm background matching web portal design
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Align(
          alignment: Alignment.centerLeft,
          child: Text(
            'CLASS TEACHER ASSIGNMENT',
            style: TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.bold,
              fontSize: 16.5,
              letterSpacing: 0.2,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF0D9488)),
            )
          : RefreshIndicator(
              onRefresh: _loadData,
              color: const Color(0xFF0D9488),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Success Banner
                    if (_successBanner.isNotEmpty) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _successBanner,
                                style: const TextStyle(
                                  color: Color(0xFF15803D),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Error Banner
                    if (_errorMessage.isNotEmpty) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _errorMessage,
                                style: const TextStyle(
                                  color: Color(0xFFB91C1C),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // 3 Rectangular Cards with Curved Corners & Identical Color (Requirements 3 & 4)
                    Row(
                      children: [
                        Expanded(
                          child: _buildSummaryCard(
                            title: 'TOTAL',
                            value: '$totalClasses Classes',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildSummaryCard(
                            title: 'ASSIGNED',
                            value: '$assignedCount',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildSummaryCard(
                            title: 'UNASSIGNED',
                            value: '${totalClasses - assignedCount}',
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Main Table Card
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Table Column Headers (Top rounded corners match card)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: const BoxDecoration(
                              color: Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                            ),
                            child: Row(
                              children: const [
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    'Class',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF334155),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 12),
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    'Assigned Teacher',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF334155),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Class Rows
                          if (_classes.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 36),
                              child: Center(
                                child: Text(
                                  'No classes found in active academic year.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                              ),
                            )
                          else
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _classes.length,
                              separatorBuilder: (_, __) => const Divider(
                                height: 1,
                                thickness: 1,
                                color: Color(0xFFF1F5F9),
                              ),
                              itemBuilder: (ctx, index) {
                                final c = _classes[index];
                                final cid = c['id'] is int ? c['id'] as int : int.parse(c['id'].toString());
                                final classLabel = _formatClassLabel(c);
                                final assignedId = _localAssignments[cid];
                                final isSaving = _savingClassId == cid;

                                String teacherName = '-- Unassigned --';
                                bool isAssigned = false;
                                if (assignedId != null) {
                                  final matched = _teachers.firstWhere(
                                    (t) => (t['id'] is int ? t['id'] : int.parse(t['id'].toString())) == assignedId,
                                    orElse: () => {},
                                  );
                                  if (matched.isNotEmpty && matched['name'] != null) {
                                    teacherName = matched['name'].toString();
                                    isAssigned = true;
                                  }
                                }

                                return Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      // Left: Class name (e.g. Class 1, Class 2, Class 3)
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          classLabel,
                                          style: const TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF0F172A),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),

                                      // Right: Curved Dropdown button exactly as screenshot
                                      Expanded(
                                        flex: 3,
                                        child: GestureDetector(
                                          onTap: isSaving ? null : () => _showTeacherSelectionBottomSheet(cid, classLabel),
                                          child: Container(
                                            height: 42,
                                            padding: const EdgeInsets.symmetric(horizontal: 14),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(22),
                                              border: Border.all(
                                                color: isSaving
                                                    ? const Color(0xFF0D9488)
                                                    : const Color(0xFFCBD5E1),
                                                width: 1.0,
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    teacherName,
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight: isAssigned ? FontWeight.w600 : FontWeight.normal,
                                                      color: isAssigned
                                                          ? const Color(0xFF0F172A)
                                                          : const Color(0xFF64748B),
                                                      fontStyle: isAssigned ? FontStyle.normal : FontStyle.italic,
                                                    ),
                                                  ),
                                                ),
                                                if (isSaving)
                                                  const SizedBox(
                                                    width: 16,
                                                    height: 16,
                                                    child: CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                      color: Color(0xFF0D9488),
                                                    ),
                                                  )
                                                else
                                                  const Icon(
                                                    Icons.keyboard_arrow_down_rounded,
                                                    size: 20,
                                                    color: Color(0xFF64748B),
                                                  ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}
