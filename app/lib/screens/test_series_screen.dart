import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/http_service.dart' as http;
import '../config.dart';
import '../constants/app_colors.dart';
import '../services/test_series_service.dart';
import '../widgets/profile_avatar_view.dart';
import '../widgets/test_series_shared.dart';
import 'test_series_attempt_screen.dart';
import 'test_series_builder_screen.dart';
import 'test_series_leaderboard_screen.dart';

class TestSeriesScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? studentId;
  final bool? isPrincipal;
  final bool? initialCanCreate;
  final int? targetClassId;
  final String? targetClassLabel;
  final String? targetSectionLabel;

  const TestSeriesScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.studentId,
    this.isPrincipal,
    this.initialCanCreate,
    this.targetClassId,
    this.targetClassLabel,
    this.targetSectionLabel,
  });

  @override
  State<TestSeriesScreen> createState() => _TestSeriesScreenState();
}

class _TestSeriesScreenState extends State<TestSeriesScreen> {
  static const List<String> _kTabKeys = ['LIVE', 'UPCOMING', 'CLOSED'];

  late TestSeriesService _service;
  late PageController _pageController;
  bool _isLoading = true;
  bool _isActionLoading = false;
  String _error = '';

  bool _canCreate = false;
  bool _hasDraft = false;
  int _draftCount = 0;
  List<Map<String, dynamic>> _items = [];

  int _statusIndex = 0; // 0: LIVE, 1: UPCOMING, 2: CLOSED

  Timer? _ticker;
  int _elapsedSeconds = 0;
  bool _autoRefreshTriggered = false;

  bool get _isTeacherOrPrincipal {
    final r = widget.userRole.toUpperCase();
    return r == 'TEACHER' || r == 'PRINCIPAL';
  }

  @override
  void initState() {
    super.initState();
    _canCreate = widget.initialCanCreate == true ||
        widget.isPrincipal == true ||
        widget.userRole.toUpperCase() == 'PRINCIPAL';
    _pageController = PageController(initialPage: 0);
    _service = TestSeriesService(baseUrl: widget.baseUrl, token: widget.token);
    _markNotificationsRead();
    _refreshDraftState();
    _loadData();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _isLoading || _items.isEmpty) return;
      bool needsBoundaryRefresh = false;
      bool hasActiveTimer = false;
      for (final item in _items) {
        final st = (item['status'] ?? '').toString();
        if (st == 'LIVE') {
          hasActiveTimer = true;
          final r = (item['seconds_remaining'] as num?)?.toInt() ?? 0;
          if (r - (_elapsedSeconds + 1) <= 0) {
            needsBoundaryRefresh = true;
          }
        }
      }
      if (hasActiveTimer) {
        setState(() {
          _elapsedSeconds++;
        });
      }
      if (needsBoundaryRefresh && !_autoRefreshTriggered) {
        _autoRefreshTriggered = true;
        _loadData(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _syncServiceFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.token;
      String base = resolveBaseUrlFrom(prefs);
      final active = (http.activeLocalBaseUrl ?? '').trim();
      if (active.isNotEmpty && active.startsWith('http') && !base.contains('shikshapilot.com')) {
        base = active;
      }
      if (base.isEmpty) base = widget.baseUrl;
      _service = TestSeriesService(baseUrl: base, token: token);
    } catch (_) {}
  }

  Future<void> _markNotificationsRead() async {
    try {
      await _syncServiceFromPrefs();
      _refreshDraftState();
      if (_service.token.isEmpty) return;
      final path = _isTeacherOrPrincipal
          ? '/api/teacher/notifications/0/read'
          : '/api/student/notifications/0/read';
      final uri = Uri.parse('${_service.baseUrl}$path').replace(
        queryParameters: (!_isTeacherOrPrincipal && widget.studentId != null)
            ? {'student_id': widget.studentId.toString()}
            : null,
      );
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${_service.token}',
          if (!_isTeacherOrPrincipal && widget.studentId != null)
            'X-Student-Id': widget.studentId.toString(),
        },
        body: '{"module":"test_series"}',
      );
    } catch (_) {}
  }

  Future<void> _refreshDraftState() async {
    final cid = widget.targetClassId ?? 0;
    if (cid <= 0) return;
    final count = await TestSeriesDraftStore.getDraftCount(cid);
    if (!mounted) return;
    if (_hasDraft != (count > 0) || _draftCount != count) {
      setState(() {
        _hasDraft = count > 0;
        _draftCount = count;
      });
    }
  }

  Future<void> _loadData({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _error = '';
      });
    }

    try {
      await _syncServiceFromPrefs();
      _refreshDraftState();
      final Map<String, dynamic> data;
      if (_isTeacherOrPrincipal) {
        data = await _service.fetchTeacherTestSeries(
          classId: widget.targetClassId,
          status: 'ALL',
        );
      } else {
        data = await _service.fetchStudentTestSeries(
          studentId: widget.studentId,
          status: 'ALL',
        );
      }

      if (!mounted) return;
      setState(() {
        _elapsedSeconds = 0;
        _autoRefreshTriggered = false;
        if (_isTeacherOrPrincipal) {
          _canCreate = data['can_create'] == true;
        }
        _items = (data['items'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
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

  Future<void> _openCreateScreen({
    String? draftId,
    Map<String, dynamic>? initialDraft,
  }) async {
    await _syncServiceFromPrefs();
    if (!mounted) return;
    if (widget.targetClassId == null || widget.targetClassId! <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a class first.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => TestSeriesBuilderScreen(
          service: _service,
          targetClassId: widget.targetClassId,
          targetClassName: widget.targetClassLabel,
          targetSectionName: widget.targetSectionLabel,
          initialDraftId: draftId,
          initialDraft: initialDraft,
        ),
      ),
    );
    await _refreshDraftState();
    if (created == true) {
      _loadData();
    }
  }

  Future<void> _openDraftsList() async {
    final cid = widget.targetClassId ?? 0;
    if (cid <= 0) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _TestSeriesDraftsSheet(
        classId: cid,
        classLabel: widget.targetClassLabel ?? 'Class',
        sectionLabel: widget.targetSectionLabel ?? '',
        onSelectDraft: (draft) async {
          Navigator.pop(ctx);
          await _openCreateScreen(
            draftId: draft['id']?.toString(),
            initialDraft: draft,
          );
        },
        onCreateNew: () async {
          Navigator.pop(ctx);
          await _openCreateScreen();
        },
        onDraftsChanged: () {
          _refreshDraftState();
        },
      ),
    );
    await _refreshDraftState();
  }

  Future<void> _openEditScreen(int testSeriesId) async {
    await _syncServiceFromPrefs();
    if (!mounted) return;
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => TestSeriesBuilderScreen(
          service: _service,
          targetClassId: widget.targetClassId,
          targetClassName: widget.targetClassLabel,
          targetSectionName: widget.targetSectionLabel,
          existingId: testSeriesId,
        ),
      ),
    );
    if (updated == true) {
      _loadData();
    }
  }

  Future<void> _confirmAndDelete(Map<String, dynamic> item) async {
    final id = (item['id'] as num).toInt();
    final title = (item['title'] ?? 'this Test Series').toString();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
        final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
        final textSecondary =
            isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
        final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

        return Dialog(
          backgroundColor: bg,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: BorderSide(color: borderCol, width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.danger700.withValues(alpha: 0.25)
                        : AppColors.danger50,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDark
                          ? AppColors.danger700
                          : AppColors.danger500.withValues(alpha: 0.28),
                      width: 1.4,
                    ),
                  ),
                  child: Icon(
                    Icons.delete_outline_rounded,
                    size: 27,
                    color: isDark ? AppColors.danger500 : AppColors.danger600,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Delete Test Series?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Are you sure you want to permanently delete "$title"? All questions, images, student submissions, and leaderboard records for this test will be removed.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: textSecondary,
                    fontSize: 13.5,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: textPrimary,
                          side: BorderSide(
                            color:
                                isDark ? TsColors.darkBorder : TsColors.border,
                            width: 1.4,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.danger600,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: const Text(
                          'Delete',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );

    if (confirmed != true) return;
    setState(() => _isActionLoading = true);
    try {
      await _service.deleteTestSeries(id);
      if (!mounted) return;
      setState(() => _isActionLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Test Series deleted successfully.'),
          backgroundColor: AppColors.success600,
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadData();
    } catch (e) {
      if (!mounted) return;
      setState(() => _isActionLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(http.isNetworkError(e)
              ? http.kNetworkErrorMessage
              : (e is TestSeriesApiException
                  ? e.message
                  : http.formatErrorMessage(e))),
          backgroundColor: AppColors.danger600,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  List<Map<String, dynamic>> _itemsForTabIndex(int index) {
    final key = _kTabKeys[index.clamp(0, _kTabKeys.length - 1)];
    if (key == 'ALL') return _items;
    return _items.where((it) => (it['status'] ?? '').toString() == key).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    int liveCount = 0;
    int upcomingCount = 0;
    int closedCount = 0;
    for (final it in _items) {
      final st = (it['status'] ?? '').toString();
      if (st == 'LIVE') {
        liveCount++;
      } else if (st == 'UPCOMING') {
        upcomingCount++;
      } else if (st == 'CLOSED') {
        closedCount++;
      }
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: const Text(
          'TEST SERIES',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          if (_isTeacherOrPrincipal && _canCreate && widget.targetClassId != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextButton(
                    onPressed: _isActionLoading ? null : _openDraftsList,
                    style: TextButton.styleFrom(
                      backgroundColor: isDark
                          ? TsColors.amber900.withValues(alpha: 0.55)
                          : TsColors.accentSoft,
                      foregroundColor:
                          isDark ? TsColors.amber300 : TsColors.amber800,
                      side: BorderSide(
                        color: isDark
                            ? TsColors.amber400.withValues(alpha: 0.65)
                            : TsColors.accent,
                        width: 1.2,
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 7),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      _draftCount > 0 ? 'In Draft ($_draftCount)' : 'In Draft',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: _isActionLoading ? null : () => _openCreateScreen(),
                    style: TextButton.styleFrom(
                      backgroundColor: TsColors.ink,
                      foregroundColor: Colors.white,
                      side: BorderSide.none,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 11, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Create Test',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              _buildFilterBar(isDark),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: TsColors.accent))
                    : _error.isNotEmpty
                        ? _buildErrorState(isDark)
                        : PageView.builder(
                            controller: _pageController,
                            itemCount: _kTabKeys.length,
                            onPageChanged: (idx) {
                              setState(() => _statusIndex = idx);
                            },
                            itemBuilder: (_, pageIdx) {
                              final pageItems = _itemsForTabIndex(pageIdx);
                              return RefreshIndicator(
                                color: TsColors.accent,
                                onRefresh: _loadData,
                                child: ListView(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  padding: const EdgeInsets.fromLTRB(
                                      16, 10, 16, 28),
                                  children: [
                                    _buildHeroBanner(
                                      isDark: isDark,
                                      liveCount: liveCount,
                                      upcomingCount: upcomingCount,
                                      closedCount: closedCount,
                                    ),
                                    const SizedBox(height: 16),
                                    if (pageItems.isEmpty)
                                      _buildEmptyState(isDark)
                                    else
                                      ...pageItems.map(
                                        (item) =>
                                            _buildTestCard(isDark, item),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
          if (_isActionLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.25),
              child: const Center(
                child: CircularProgressIndicator(color: TsColors.accent),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeroBanner({
    required bool isDark,
    required int liveCount,
    required int upcomingCount,
    required int closedCount,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? TsColors.darkBorder : TsColors.border,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _HeroStatTile(
            label: 'Live Now',
            value: '$liveCount',
            valueColor: TsColors.success,
            isDark: isDark,
          ),
          _HeroStatTile(
            label: 'Upcoming',
            value: '$upcomingCount',
            valueColor: TsColors.accent,
            isDark: isDark,
          ),
          _HeroStatTile(
            label: 'Results Out',
            value: '$closedCount',
            valueColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(bool isDark) {
    const labels = ['Live', 'Upcoming', 'Closed'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(
        children: List.generate(labels.length, (idx) {
          final selected = _statusIndex == idx;
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                left: idx == 0 ? 0 : 4,
                right: idx == labels.length - 1 ? 0 : 4,
              ),
              child: InkWell(
                onTap: () {
                  if (_statusIndex == idx) return;
                  setState(() => _statusIndex = idx);
                  _pageController.animateToPage(
                    idx,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                  );
                },
                borderRadius: BorderRadius.circular(14),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected
                        ? (isDark ? TsColors.accent : TsColors.ink)
                        : (isDark
                            ? AppColors.darkSurfaceRaised
                            : Colors.white),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected
                          ? (isDark ? TsColors.accent : TsColors.ink)
                          : (isDark ? TsColors.darkBorder : TsColors.border),
                      width: selected ? 1.5 : 1,
                    ),
                    boxShadow: selected
                        ? [
                            BoxShadow(
                              color: TsColors.ink.withValues(alpha: 0.12),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    labels[idx],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight:
                          selected ? FontWeight.w900 : FontWeight.w800,
                      color: selected
                          ? Colors.white
                          : (isDark
                              ? AppColors.darkTextPrimary
                              : TsColors.ink),
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  void _showInstructionsPopup({
    required bool isDark,
    required String title,
    required String instructions,
  }) {
    final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary =
        isDark ? AppColors.darkTextSecondary : TsColors.inkSecondary;
    final borderCol = isDark ? TsColors.darkBorder : TsColors.accentBorder;

    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return Dialog(
          backgroundColor: bg,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: BorderSide(color: borderCol, width: 1.5),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isDark
                            ? TsColors.amber900.withValues(alpha: 0.45)
                            : TsColors.accentSoft,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isDark
                              ? TsColors.amber800
                              : TsColors.accentBorder,
                        ),
                      ),
                      child: Icon(
                        Icons.menu_book_rounded,
                        size: 20,
                        color: isDark ? TsColors.amber300 : TsColors.accent,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Instructions',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                              color:
                                  isDark ? TsColors.amber300 : TsColors.accent,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: Icon(Icons.close_rounded,
                          size: 20, color: textSecondary),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Flexible(
                  child: Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxHeight: 340),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkSurfaceCanvas
                          : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isDark ? TsColors.darkBorder : TsColors.border,
                      ),
                    ),
                    child: Scrollbar(
                      child: SingleChildScrollView(
                        child: () {
                          final lines = instructions
                              .split(RegExp(r'\r?\n'))
                              .map((e) => e
                                  .trim()
                                  .replaceFirst(RegExp(r'^[•\-\*]\s*'), '')
                                  .trim())
                              .where((e) => e.isNotEmpty)
                              .toList();
                          if (lines.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (int i = 0; i < lines.length; i++) ...[
                                if (i > 0) const SizedBox(height: 10),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 7,
                                      height: 7,
                                      margin: const EdgeInsets.only(
                                          top: 6.5, right: 10),
                                      decoration: BoxDecoration(
                                        color: isDark
                                            ? TsColors.amber300
                                            : TsColors.accent,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        lines[i],
                                        style: TextStyle(
                                          fontSize: 13.5,
                                          height: 1.45,
                                          fontWeight: FontWeight.w600,
                                          color: textPrimary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          );
                        }(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? TsColors.accent : TsColors.ink,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Got It',
                    style:
                        TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildTestCard(bool isDark, Map<String, dynamic> item) {
    final id = (item['id'] as num).toInt();
    final title = (item['title'] ?? 'Test Series').toString();
    final description = (item['description'] ?? '').toString().trim();
    final creator = (item['created_by_name'] ?? 'Teacher').toString();
    final totalQuestions = (item['total_questions'] as num?)?.toInt() ?? 0;
    final status = (item['status'] ?? 'UPCOMING').toString();

    final rawRemaining = (item['seconds_remaining'] as num?)?.toInt() ?? 0;
    final secsRemaining = (rawRemaining - _elapsedSeconds).clamp(0, 99999999);

    Color statusBg = TsColors.accentSoft;
    Color statusFg = TsColors.accent;
    String statusText = 'UPCOMING';
    if (status == 'LIVE') {
      statusBg = isDark
          ? TsColors.emerald900.withValues(alpha: 0.45)
          : AppColors.success50;
      statusFg = TsColors.success;
      statusText = 'LIVE NOW';
    } else if (status == 'CLOSED') {
      statusBg =
          isDark ? TsColors.darkSurfaceElevated : TsColors.slate100;
      statusFg = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;
      statusText = 'CLOSED';
    } else if (isDark) {
      statusBg = TsColors.amber900.withValues(alpha: 0.45);
      statusFg = TsColors.amber300;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkSurfaceRaised
            : (status == 'LIVE' ? TsColors.cardIvory : Colors.white),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: status == 'LIVE'
              ? TsColors.accent
              : (isDark ? TsColors.darkBorder : TsColors.border),
          width: status == 'LIVE' ? 1.8 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: status == 'LIVE'
                ? TsColors.accent.withValues(alpha: isDark ? 0.14 : 0.08)
                : Colors.black.withValues(alpha: isDark ? 0.18 : 0.02),
            blurRadius: status == 'LIVE' ? 12 : 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Pills
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (status == 'LIVE') ...[
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: AppColors.success500,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusFg,
                      ),
                    ),
                  ],
                ),
              ),
              () {
                final hasInstructions = description.trim().isNotEmpty &&
                    description
                        .split(RegExp(r'\r?\n'))
                        .map((e) => e
                            .trim()
                            .replaceFirst(RegExp(r'^[•●\-\*]\s*'), '')
                            .trim())
                        .any((e) => e.isNotEmpty);
                if (!hasInstructions) return const SizedBox.shrink();
                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 8),
                    Material(
                      color: isDark
                          ? TsColors.amber900.withValues(alpha: 0.45)
                          : TsColors.accentSoft,
                      borderRadius: BorderRadius.circular(20),
                      child: InkWell(
                        onTap: () => _showInstructionsPopup(
                          isDark: isDark,
                          title: title,
                          instructions: description,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark
                                  ? TsColors.amber800
                                  : TsColors.accentBorder,
                              width: 1.1,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.info_outline_rounded,
                                size: 13,
                                color: isDark
                                    ? TsColors.amber300
                                    : TsColors.accent,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Instructions',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: isDark
                                      ? TsColors.amber300
                                      : TsColors.accent,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }(),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),

          // Metadata Chips
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              _MetaChip(
                label: 'Questions:',
                value: '$totalQuestions',
                isDark: isDark,
              ),
              _MetaChip(
                label: 'Posted by:',
                value: creator,
                isDark: isDark,
              ),
              if (_isTeacherOrPrincipal)
                _MetaChip(
                  label: 'Submitted:',
                  value: '${item['submitted_count'] ?? 0}',
                  isDark: isDark,
                ),
            ],
          ),
          const SizedBox(height: 8),
          () {
            final timingColor = status == 'LIVE'
                ? TsColors.success
                : (status == 'UPCOMING'
                    ? TsColors.accent
                    : (isDark
                        ? AppColors.darkTextSecondary
                        : TsColors.inkSecondary));
            final timingIconColor = status == 'LIVE'
                ? TsColors.success
                : (status == 'UPCOMING'
                    ? TsColors.accent
                    : (isDark
                        ? AppColors.darkTextSecondary
                        : TsColors.inkMuted));
            final stripDecoration = BoxDecoration(
              color: isDark
                  ? TsColors.darkSurfaceElevated
                  : TsColors.canvas,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? TsColors.darkBorder : TsColors.border,
              ),
            );
            return Column(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                  decoration: stripDecoration,
                  child: Row(
                    children: [
                      Icon(
                        Icons.play_circle_outline_rounded,
                        size: 16,
                        color: isDark ? TsColors.amber300 : TsColors.accent,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Starting Time: ${formatShortDateTime(item['starts_at']?.toString())}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isDark ? TsColors.amber300 : TsColors.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                  decoration: stripDecoration,
                  child: Row(
                    children: [
                      Icon(
                        status == 'CLOSED'
                            ? Icons.event_available_rounded
                            : Icons.timer_outlined,
                        size: 16,
                        color: timingIconColor,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          status == 'CLOSED'
                              ? 'Closed At: ${formatShortDateTime(item['ends_at']?.toString())}'
                              : 'Closing Time: ${formatShortDateTime(item['ends_at']?.toString())}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: timingColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }(),

          const SizedBox(height: 14),
          if (_isTeacherOrPrincipal)
            _buildTeacherActions(isDark, item, id, title)
          else
            _buildStudentActions(isDark, item, id, title, status, secsRemaining),
        ],
      ),
    );
  }

  Widget _buildTeacherActions(
      bool isDark, Map<String, dynamic> item, int id, String title) {
    final canEdit = item['can_edit'] == true;
    final canDelete = item['can_delete'] == true;
    final hasMenu = canEdit || canDelete;

    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => TestSeriesLeaderboardScreen(
                    service: _service,
                    testSeriesId: id,
                    isTeacherOrPrincipal: true,
                    initialTitle: title,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.leaderboard_rounded, size: 18),
            label: const Text('Leaderboard',
                style: TextStyle(fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
              side: BorderSide(
                color: isDark ? TsColors.darkBorder : TsColors.border,
                width: 1.5,
              ),
              backgroundColor:
                  isDark ? TsColors.darkSurfaceElevated : Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
        if (hasMenu) ...[
          const SizedBox(width: 8),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isDark ? TsColors.darkSurfaceElevated : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? TsColors.darkBorder : TsColors.border,
                width: 1.5,
              ),
            ),
            child: PopupMenuButton<String>(
              padding: EdgeInsets.zero,
              icon: Icon(
                Icons.more_vert_rounded,
                size: 20,
                color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
              ),
              tooltip: 'Options',
              color: isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory,
              surfaceTintColor: Colors.transparent,
              elevation: 6,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(
                  color: isDark ? TsColors.darkBorder : TsColors.accentBorder,
                  width: 1.2,
                ),
              ),
              onSelected: (value) {
                if (value == 'edit') {
                  _openEditScreen(id);
                } else if (value == 'delete') {
                  _confirmAndDelete(item);
                }
              },
              itemBuilder: (_) => [
                if (canEdit)
                  PopupMenuItem<String>(
                    value: 'edit',
                    child: Row(
                      children: [
                        Icon(
                          Icons.edit_rounded,
                          size: 18,
                          color: isDark ? TsColors.amber300 : TsColors.accent,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'Edit Test Series',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : TsColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (canDelete)
                  const PopupMenuItem<String>(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline_rounded,
                            size: 18, color: AppColors.danger600),
                        SizedBox(width: 10),
                        Text(
                          'Delete Test Series',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            color: AppColors.danger600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStudentActions(
    bool isDark,
    Map<String, dynamic> item,
    int id,
    String title,
    String status,
    int secsRemaining,
  ) {
    final attemptStatus = (item['attempt_status'] ?? 'NOT_STARTED').toString();

    if (status == 'UPCOMING') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 14),
        decoration: BoxDecoration(
          color: isDark
              ? TsColors.amber900.withValues(alpha: 0.35)
              : TsColors.accentSoft,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? TsColors.amber800 : TsColors.accentBorder,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.schedule_rounded,
                size: 18, color: isDark ? TsColors.amber300 : TsColors.accent),
            const SizedBox(width: 8),
            Text(
              'Not Started Yet · Opens ${formatShortDateTime(item['starts_at']?.toString())}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: isDark ? TsColors.amber300 : TsColors.accent,
              ),
            ),
          ],
        ),
      );
    }

    if (status == 'LIVE') {
      if (attemptStatus == 'SUBMITTED') {
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 14),
          decoration: BoxDecoration(
            color: isDark
                ? TsColors.emerald900.withValues(alpha: 0.35)
                : AppColors.success50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: AppColors.success500.withValues(alpha: 0.45)),
          ),
          child: Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  size: 19, color: AppColors.success600),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Submitted! Rank & Leaderboard unlock in ${formatCountdown(secsRemaining)}.',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.success600,
                  ),
                ),
              ),
            ],
          ),
        );
      }

      final isResume = attemptStatus == 'IN_PROGRESS';
      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () async {
            final submitted = await Navigator.push<bool>(
              context,
              MaterialPageRoute(
                builder: (_) => TestSeriesAttemptScreen(
                  service: _service,
                  testSeriesId: id,
                  studentId: widget.studentId,
                  initialTitle: title,
                ),
              ),
            );
            if (submitted == true || mounted) {
              _loadData();
            }
          },
          icon: Icon(
            isResume ? Icons.play_circle_filled_rounded : Icons.quiz_rounded,
            size: 20,
          ),
          label: Text(
            isResume ? 'Resume Test Series' : 'Start Test Series',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: isDark ? TsColors.accent : TsColors.ink,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      );
    }

    // CLOSED state for Students/Parents
    final myRank = (item['my_rank'] as num?)?.toInt();
    final totalParticipants = (item['total_participants'] as num?)?.toInt() ?? 0;
    final isTopper = item['can_download_certificate'] == true &&
        myRank != null &&
        myRank <= 3;
    final myScore = item['my_score_percent'];
    final negEnabled = item['negative_marking_enabled'] == true;
    final showTimer = item['show_timer'] == true;
    final totalQuestions = (item['total_questions'] as num?)?.toInt() ?? 0;
    final myObtained = (item['my_obtained_marks'] as num?)?.toDouble();
    final myDeducted = (item['my_deducted_marks'] as num?)?.toDouble() ?? 0.0;
    final myTimeSecs = (item['my_time_taken_seconds'] as num?)?.toInt();

    final scoreLabel = (negEnabled && myObtained != null)
        ? '${formatMarks(myObtained)}/$totalQuestions (${myScore ?? 0}%)${myDeducted > 0 ? ' · -${formatMarks(myDeducted)} Neg.' : ''}'
        : '${myScore ?? 0}%';
    final timeSuffix =
        (showTimer && myTimeSecs != null && myTimeSecs > 0) ? ' · ${formatDurationSeconds(myTimeSecs)}' : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (myRank != null) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: isTopper
                  ? (isDark
                      ? TsColors.amber900.withValues(alpha: 0.35)
                      : TsColors.accentSoft)
                  : (isDark
                      ? TsColors.darkSurfaceElevated
                      : TsColors.slate100),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isTopper
                    ? TsColors.amber400.withValues(alpha: 0.7)
                    : (isDark ? TsColors.darkBorder : TsColors.border),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  isTopper
                      ? Icons.workspace_premium_rounded
                      : Icons.military_tech_rounded,
                  color: isTopper ? TsColors.accent : TsColors.ink,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isTopper
                        ? 'Topper Rank #$myRank of $totalParticipants · $scoreLabel$timeSuffix · Certificate Ready!'
                        : 'Your Rank: #$myRank of $totalParticipants · Score: $scoreLabel$timeSuffix',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: isTopper
                          ? (isDark ? TsColors.amber300 : TsColors.amber800)
                          : (isDark
                              ? AppColors.darkTextPrimary
                              : TsColors.ink),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        ElevatedButton.icon(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => TestSeriesLeaderboardScreen(
                  service: _service,
                  testSeriesId: id,
                  isTeacherOrPrincipal: false,
                  studentId: widget.studentId,
                  initialTitle: title,
                ),
              ),
            );
          },
          icon: Icon(
            isTopper
                ? Icons.workspace_premium_rounded
                : Icons.emoji_events_rounded,
            size: 19,
          ),
          label: Text(
            isTopper
                ? 'Certificate & Leaderboard'
                : (myRank != null
                    ? 'View Leaderboard & Answers'
                    : 'View Toppers Leaderboard'),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: isTopper ? TsColors.accent : TsColors.ink,
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isDark ? TsColors.darkBorder : TsColors.border),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark
                  ? TsColors.amber900.withValues(alpha: 0.4)
                  : TsColors.accentSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.quiz_outlined,
                size: 40, color: TsColors.accent),
          ),
          const SizedBox(height: 14),
          Text(
            'No Test Series Found',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _isTeacherOrPrincipal
                ? (_canCreate
                    ? (_hasDraft
                        ? 'Tap "In Draft" above to resume your unfinished Test Series.'
                        : 'Tap "+ Create Test" above to publish a Test Series for this class.')
                    : 'No Test Series available in this tab.')
                : 'No Test Series available here yet. Swipe or check back soon!',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded,
                size: 44, color: AppColors.danger600),
            const SizedBox(height: 12),
            Text(
              _error,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try Again',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: TsColors.ink,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroStatTile extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;
  final bool isDark;

  const _HeroStatTile({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final bool isDark;

  const _MetaChip({
    required this.label,
    required this.value,
    this.valueColor,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$label ',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color:
                  isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
            ),
          ),
          TextSpan(
            text: value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: valueColor ?? (isDark ? TsColors.amber300 : TsColors.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class TestSeriesPermissionsSheet extends StatefulWidget {
  final TestSeriesService service;

  const TestSeriesPermissionsSheet({super.key, required this.service});

  @override
  State<TestSeriesPermissionsSheet> createState() =>
      _TestSeriesPermissionsSheetState();
}

class _TestSeriesPermissionsSheetState
    extends State<TestSeriesPermissionsSheet> {
  bool _loading = true;
  String _error = '';
  String _search = '';
  List<Map<String, dynamic>> _teachers = [];
  final Set<int> _savingIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final list = await widget.service.getPermissions();
      if (!mounted) return;
      setState(() {
        final Map<String, Map<String, dynamic>> deduped = {};
        for (final raw in list) {
          final t = Map<String, dynamic>.from(raw);
          final isPrin = t['is_principal'] == true ||
              (t['designation'] ?? '').toString().toLowerCase().contains('principal') ||
              (t['role'] ?? '').toString().toLowerCase().contains('principal');
          if (isPrin) continue;

          final phone = (t['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
          final key = phone.length >= 10
              ? phone.substring(phone.length - 10)
              : (t['name'] ?? '').toString().trim().toLowerCase();

          if (deduped.containsKey(key)) {
            if (t['can_create'] == true) {
              deduped[key]!['can_create'] = true;
            }
          } else {
            deduped[key] = t;
          }
        }
        _teachers = deduped.values.toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = http.isNetworkError(e)
            ? http.kNetworkErrorMessage
            : (e is TestSeriesApiException
                ? e.message
                : http.formatErrorMessage(e));
        _loading = false;
      });
    }
  }

  Future<void> _toggleTeacher(Map<String, dynamic> teacher, bool newVal) async {
    final staffId = (teacher['staff_id'] as num).toInt();
    final oldVal = teacher['can_create'] == true;
    setState(() {
      teacher['can_create'] = newVal;
      _savingIds.add(staffId);
    });

    try {
      await widget.service.setPermission(staffId: staffId, canCreate: newVal);
      if (!mounted) return;
      setState(() {
        _savingIds.remove(staffId);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        teacher['can_create'] = oldVal;
        _savingIds.remove(staffId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(http.isNetworkError(e)
              ? http.kNetworkErrorMessage
              : (e is TestSeriesApiException
                  ? e.message
                  : http.formatErrorMessage(e))),
          backgroundColor: AppColors.danger600,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _teachers.where((t) {
      final isPrin = t['is_principal'] == true ||
          (t['designation'] ?? '').toString().toLowerCase().contains('principal') ||
          (t['role'] ?? '').toString().toLowerCase().contains('principal');
      if (isPrin) return false;
      if (_search.isEmpty) return true;
      final q = _search.toLowerCase();
      final name = (t['name'] ?? '').toString().toLowerCase();
      final subj = (t['designation'] ?? '').toString().toLowerCase();
      final phone = (t['phone'] ?? '').toString().toLowerCase();
      return name.contains(q) || subj.contains(q) || phone.contains(q);
    }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.78,
      minChildSize: 0.5,
      maxChildSize: 0.94,
      builder: (_, scrollCtrl) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceRaised : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? TsColors.darkBorder : AppColors.borderStrong,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 16, 10),
                child: Row(
                  children: [
                    const Icon(Icons.admin_panel_settings_rounded,
                        color: TsColors.accent),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Teacher Creator Access',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: isDark
                                  ? AppColors.darkTextPrimary
                                  : AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            'Grant teachers permission to create Test Series',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppColors.darkTextSecondary
                                  : AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  onChanged: (v) => setState(() => _search = v.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search teacher by name or subject...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    isDense: true,
                    filled: true,
                    fillColor: isDark
                        ? TsColors.darkSurfaceElevated
                        : AppColors.surfaceSunken,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _error.isNotEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Text(_error, textAlign: TextAlign.center),
                            ),
                          )
                        : filtered.isEmpty
                            ? const Center(child: Text('No teachers found.'))
                            : ListView.separated(
                                controller: scrollCtrl,
                                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                                itemCount: filtered.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, i) {
                                  final t = filtered[i];
                                  final staffId = (t['staff_id'] as num).toInt();
                                  final isPrincipalStaff =
                                      t['is_principal'] == true;
                                  final canCreate = t['can_create'] == true;
                                  final saving = _savingIds.contains(staffId);
                                  final name = (t['name'] ?? 'Teacher').toString();
                                  final subj =
                                      (t['designation'] ?? '')
                                          .toString()
                                          .trim();

                                  return Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? TsColors.darkSurfaceElevated
                                          : AppColors.surfaceSunken,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isDark
                                            ? TsColors.darkBorder
                                            : AppColors.borderSubtle,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        ProfileAvatarView(
                                          photoUrl: widget.service
                                              .resolveMediaUrl(
                                                  t['photo_path']?.toString()),
                                          baseUrl: widget.service.baseUrl,
                                          name: name,
                                          size: 42,
                                          entityType: 'teacher',
                                          heroTag:
                                              'ts_perm_teacher_${staffId}_$name',
                                          fallbackColor: TsColors.accent,
                                          fallbackBgColor: TsColors.accentSoft,
                                          borderColor: TsColors.accentBorder,
                                          enableZoom: true,
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                name,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w800,
                                                  color: isDark
                                                      ? AppColors.darkTextPrimary
                                                      : AppColors.textPrimary,
                                                ),
                                              ),
                                              Text(
                                                isPrincipalStaff
                                                    ? 'Principal (Always Allowed)'
                                                    : (subj.isNotEmpty
                                                        ? subj
                                                        : 'Teacher'),
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  color: isDark
                                                      ? AppColors
                                                          .darkTextSecondary
                                                      : AppColors.textMuted,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (saving)
                                          const SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: TsColors.accent,
                                            ),
                                          )
                                        else
                                          Switch.adaptive(
                                            value: canCreate,
                                            activeTrackColor: TsColors.accent,
                                            onChanged: isPrincipalStaff
                                                ? null
                                                : (v) => _toggleTeacher(t, v),
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TestSeriesDraftsSheet extends StatefulWidget {
  final int classId;
  final String classLabel;
  final String sectionLabel;
  final Future<void> Function(Map<String, dynamic> draft) onSelectDraft;
  final VoidCallback onCreateNew;
  final VoidCallback onDraftsChanged;

  const _TestSeriesDraftsSheet({
    required this.classId,
    required this.classLabel,
    required this.sectionLabel,
    required this.onSelectDraft,
    required this.onCreateNew,
    required this.onDraftsChanged,
  });

  @override
  State<_TestSeriesDraftsSheet> createState() => _TestSeriesDraftsSheetState();
}

class _TestSeriesDraftsSheetState extends State<_TestSeriesDraftsSheet> {
  bool _loading = true;
  List<Map<String, dynamic>> _drafts = [];

  @override
  void initState() {
    super.initState();
    _loadDrafts();
  }

  Future<void> _loadDrafts() async {
    final list = await TestSeriesDraftStore.loadDrafts(widget.classId);
    if (!mounted) return;
    setState(() {
      _drafts = list;
      _loading = false;
    });
  }

  Future<void> _confirmDelete(Map<String, dynamic> draft) async {
    final title = (draft['title'] ?? 'Untitled Draft').toString().trim();
    final displayName = title.isNotEmpty ? title : 'Untitled Draft';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (dCtx) => AlertDialog(
        backgroundColor: isDark ? AppColors.darkSurfaceRaised : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          'Delete Draft?',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 17,
            color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
          ),
        ),
        content: Text(
          'Are you sure you want to delete "$displayName"? This cannot be undone.',
          style: TextStyle(
            fontSize: 13.5,
            color: isDark ? AppColors.darkTextSecondary : TsColors.inkSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dCtx, false),
            child: Text(
              'Cancel',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextSecondary : TsColors.inkMuted,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dCtx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger600,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final draftId = draft['id']?.toString() ?? '';
      await TestSeriesDraftStore.deleteDraft(widget.classId, draftId);
      widget.onDraftsChanged();
      await _loadDrafts();
    }
  }

  String _formatSavedTime(String? raw) {
    if (raw == null || raw.isEmpty) return 'Draft';
    final dt = DateTime.tryParse(raw);
    if (dt == null) return 'Draft';
    final local = dt.toLocal();
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final m = months[local.month - 1];
    final hr = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final ampm = local.hour >= 12 ? 'PM' : 'AM';
    final min = local.minute.toString().padLeft(2, '0');
    return '${local.day} $m, $hr:$min $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.darkSurfaceRaised : TsColors.canvas;
    final cardBg = isDark ? AppColors.darkSurfaceCanvas : Colors.white;
    final borderCol = isDark ? TsColors.darkBorder : TsColors.border;
    final textPrimary = isDark ? AppColors.darkTextPrimary : TsColors.ink;
    final textSecondary = isDark ? AppColors.darkTextSecondary : TsColors.inkMuted;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.82,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: borderCol, width: 1.5)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 44,
              height: 4.5,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.black12,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isDark ? TsColors.amber900.withValues(alpha: 0.45) : TsColors.accentSoft,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.drafts_outlined,
                      size: 20,
                      color: isDark ? TsColors.amber300 : TsColors.accent,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Row(
                      children: [
                        Text(
                          'In Draft',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: textPrimary,
                          ),
                        ),
                        if (!_loading && _drafts.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark ? TsColors.amber900.withValues(alpha: 0.6) : TsColors.accentSoft,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isDark ? TsColors.amber800 : TsColors.accentBorder,
                                width: 1,
                              ),
                            ),
                            child: Text(
                              '${_drafts.length}',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w900,
                                color: isDark ? TsColors.amber300 : TsColors.amber800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (widget.classLabel.isNotEmpty)
                    TestSeriesClassBadges(
                      classLabel: widget.classLabel,
                      isDark: isDark,
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Divider(height: 1, color: borderCol),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: TsColors.accent),
                    )
                  : _drafts.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? TsColors.amber900.withValues(alpha: 0.35)
                                        : TsColors.accentSoft,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    Icons.edit_note_rounded,
                                    size: 34,
                                    color: isDark ? TsColors.amber300 : TsColors.accent,
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  'No Drafts Saved Yet',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'You haven\'t saved any drafts for this class.\nSave your unfinished test series to publish whenever needed.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    color: textSecondary,
                                    height: 1.4,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                ElevatedButton.icon(
                                  onPressed: widget.onCreateNew,
                                  icon: const Icon(Icons.add_rounded, size: 18),
                                  label: const Text('Create New Test', style: TextStyle(fontWeight: FontWeight.w800)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: TsColors.ink,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    elevation: 0,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                          itemCount: _drafts.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (ctx, idx) {
                            final d = _drafts[idx];
                            final rawTitle = (d['title'] ?? '').toString().trim();
                            final title = rawTitle.isNotEmpty ? rawTitle : 'Untitled Test Series';
                            final qCount = ((d['questions'] as List?) ?? []).length;
                            final savedAtStr = _formatSavedTime((d['saved_at'] ?? d['updated_at'])?.toString());
                            final startsAt = d['starts_at']?.toString();
                            final hasSchedule = startsAt != null && startsAt.isNotEmpty;

                            return Container(
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isDark ? TsColors.darkBorder : TsColors.accentBorder.withValues(alpha: 0.65),
                                  width: 1.3,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: isDark
                                        ? Colors.black.withValues(alpha: 0.25)
                                        : TsColors.accent.withValues(alpha: 0.05),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(15),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(15),
                                  onTap: () => widget.onSelectDraft(d),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      // Separate Header for Test Series Name
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                        decoration: BoxDecoration(
                                          color: isDark
                                              ? TsColors.darkSurfaceElevated
                                              : TsColors.canvas,
                                          border: Border(
                                            bottom: BorderSide(
                                              color: isDark
                                                  ? TsColors.darkBorder
                                                  : TsColors.accentBorder.withValues(alpha: 0.45),
                                              width: 1.0,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 28,
                                              height: 28,
                                              decoration: BoxDecoration(
                                                color: isDark
                                                    ? TsColors.amber900.withValues(alpha: 0.4)
                                                    : TsColors.accentSoft,
                                                borderRadius: BorderRadius.circular(8),
                                                border: Border.all(
                                                  color: isDark ? TsColors.amber800 : TsColors.accentBorder,
                                                  width: 1,
                                                ),
                                              ),
                                              child: Icon(
                                                Icons.edit_note_rounded,
                                                size: 16,
                                                color: isDark ? TsColors.amber300 : TsColors.accent,
                                              ),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Text(
                                                title,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 14.5,
                                                  fontWeight: FontWeight.w800,
                                                  color: textPrimary,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Material(
                                              color: Colors.transparent,
                                              child: InkWell(
                                                borderRadius: BorderRadius.circular(8),
                                                onTap: () => _confirmDelete(d),
                                                child: const Padding(
                                                  padding: EdgeInsets.all(4),
                                                  child: Icon(
                                                    Icons.delete_outline_rounded,
                                                    size: 20,
                                                    color: AppColors.danger600,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),

                                      // Card Body
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                _MetaChip(
                                                  label: 'Questions:',
                                                  value: '$qCount',
                                                  isDark: isDark,
                                                ),
                                                const SizedBox(width: 18),
                                                _MetaChip(
                                                  label: 'Scheduled:',
                                                  value: hasSchedule ? 'Yes' : 'Not',
                                                  valueColor: hasSchedule
                                                      ? TsColors.success
                                                      : (isDark ? AppColors.darkTextMuted : AppColors.textMuted),
                                                  isDark: isDark,
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),
                                            Row(
                                              children: [
                                                Icon(
                                                  Icons.schedule_rounded,
                                                  size: 13,
                                                  color: textSecondary,
                                                ),
                                                const SizedBox(width: 5),
                                                Expanded(
                                                  child: Text(
                                                    'Saved $savedAtStr',
                                                    style: TextStyle(
                                                      fontSize: 11.5,
                                                      fontWeight: FontWeight.w500,
                                                      color: textSecondary,
                                                    ),
                                                  ),
                                                ),
                                                Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Text(
                                                      'Tap to Edit & Publish',
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.w800,
                                                        color: isDark ? TsColors.amber300 : TsColors.accent,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 3),
                                                    Icon(
                                                      Icons.arrow_forward_rounded,
                                                      size: 14,
                                                      color: isDark ? TsColors.amber300 : TsColors.accent,
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
                                ),
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
}
