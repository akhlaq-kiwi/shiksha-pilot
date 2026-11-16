import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/http_service.dart' as http;
import '../config.dart';
import '../constants/app_colors.dart';
import '../services/test_series_service.dart';
import '../widgets/test_series_shared.dart';
import 'classes_screen.dart' show getClassIndex, getShortClassName;
import 'test_series_screen.dart';

class TestSeriesClassesScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final bool? isPrincipal;

  const TestSeriesClassesScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.isPrincipal,
  });

  @override
  State<TestSeriesClassesScreen> createState() =>
      _TestSeriesClassesScreenState();
}

class _TestSeriesClassesScreenState extends State<TestSeriesClassesScreen> {
  late TestSeriesService _service;
  bool _isLoading = true;
  String _error = '';

  bool _isPrincipal = false;
  bool _canCreate = false;
  List<Map<String, dynamic>> _classes = [];

  @override
  void initState() {
    super.initState();
    _isPrincipal = widget.isPrincipal == true ||
        widget.userRole.toUpperCase() == 'PRINCIPAL';
    _service = TestSeriesService(baseUrl: widget.baseUrl, token: widget.token);
    _loadData();
  }

  Future<void> _syncServiceFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.token;
      String base = resolveBaseUrlFrom(prefs);
      final active = (http.activeLocalBaseUrl ?? '').trim();
      if (active.isNotEmpty &&
          active.startsWith('http') &&
          !base.contains('shikshapilot.com')) {
        base = active;
      }
      if (base.isEmpty) base = widget.baseUrl;
      _service = TestSeriesService(baseUrl: base, token: token);
    } catch (_) {}
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
      final data = await _service.getTeacherAccess();
      if (!mounted) return;
      setState(() {
        _isPrincipal = data['is_principal'] == true;
        _canCreate = data['can_create'] == true;
        _classes = (data['classes'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (!silent) {
          _error = http.isNetworkError(e)
              ? http.kNetworkErrorMessage
              : (e is TestSeriesApiException
                  ? e.message
                  : http.formatErrorMessage(e));
        }
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _groupedClasses {
    final Map<String, Map<String, dynamic>> grouped = {};

    for (final c in _classes) {
      final name = (c['name'] ?? '').toString().trim();
      if (name.isEmpty) continue;
      final section = (c['section'] ?? '').toString().trim();
      final totalTests = (c['total_tests'] as num?)?.toInt() ?? 0;
      final liveTests = (c['live_tests'] as num?)?.toInt() ?? 0;

      grouped.putIfAbsent(name, () {
        return {
          'name': name,
          'rows': <Map<String, dynamic>>[],
          'sections': <String>[],
          'total_tests': 0,
          'live_tests': 0,
        };
      });

      final entry = grouped[name]!;
      (entry['rows'] as List<Map<String, dynamic>>).add(c);
      if (section.isNotEmpty &&
          !(entry['sections'] as List<String>).contains(section)) {
        (entry['sections'] as List<String>).add(section);
      }
      entry['total_tests'] = (entry['total_tests'] as int) + totalTests;
      entry['live_tests'] = (entry['live_tests'] as int) + liveTests;
    }

    for (final entry in grouped.values) {
      (entry['sections'] as List<String>).sort();
      (entry['rows'] as List<Map<String, dynamic>>).sort((a, b) {
        final sa = (a['section'] ?? '').toString().trim();
        final sb = (b['section'] ?? '').toString().trim();
        return sa.compareTo(sb);
      });
    }

    final list = grouped.values.toList();
    list.sort((a, b) {
      final idxA = getClassIndex(a['name'] as String);
      final idxB = getClassIndex(b['name'] as String);
      if (idxA != -1 && idxB != -1) return idxA - idxB;
      if (idxA != -1) return -1;
      if (idxB != -1) return 1;
      return (a['name'] as String).compareTo(b['name'] as String);
    });

    return list;
  }

  void _openPermissionsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TestSeriesPermissionsSheet(service: _service),
    );
  }

  Future<void> _onTapClassGroup(Map<String, dynamic> gc) async {
    final className = (gc['name'] ?? 'Class').toString();
    final rows = List<Map<String, dynamic>>.from(gc['rows'] as List);
    final sectionRows = rows
        .where((r) => (r['section'] ?? '').toString().trim().isNotEmpty)
        .toList();

    if (sectionRows.isNotEmpty) {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => TestSeriesSectionsScreen(
            baseUrl: _service.baseUrl,
            token: _service.token,
            userRole: widget.userRole,
            isPrincipal: _isPrincipal,
            canCreate: _canCreate,
            className: className,
            sectionRows: sectionRows,
          ),
        ),
      );
      if (mounted) _loadData(silent: true);
      return;
    }

    if (rows.isEmpty) return;
    final first = rows.first;
    final classId = (first['id'] as num?)?.toInt();
    if (classId == null || classId <= 0) return;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TestSeriesScreen(
          baseUrl: _service.baseUrl,
          token: _service.token,
          userRole: widget.userRole,
          isPrincipal: _isPrincipal,
          initialCanCreate: _canCreate,
          targetClassId: classId,
          targetClassLabel: className,
        ),
      ),
    );
    if (mounted) _loadData(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final grouped = _groupedClasses;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'TEST SERIES',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          if (_isPrincipal)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: TextButton.icon(
                onPressed: _openPermissionsSheet,
                icon: const Icon(Icons.admin_panel_settings_rounded, size: 18),
                label: const Text('Access',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                style: TextButton.styleFrom(
                  foregroundColor: TsColors.accent,
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: TsColors.accent),
            )
          : _error.isNotEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.wifi_off_rounded,
                            size: 46, color: AppColors.danger600),
                        const SizedBox(height: 12),
                        Text(
                          _error,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: isDark
                                ? AppColors.darkTextSecondary
                                : TsColors.inkSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadData,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: TsColors.ink,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: TsColors.accent,
                  onRefresh: _loadData,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      if (grouped.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(28),
                              child: Text(
                                'No active classes found.',
                                style: TextStyle(
                                  color: isDark
                                      ? AppColors.darkTextSecondary
                                      : TsColors.inkMuted,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 1.5,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, index) => _buildClassCard(
                                isDark,
                                grouped[index],
                              ),
                              childCount: grouped.length,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildClassCard(bool isDark, Map<String, dynamic> gc) {
    final fullName = (gc['name'] ?? 'Class').toString();
    final displayName = getShortClassName(fullName);
    final sections = (gc['sections'] as List<String>?) ?? [];
    final totalTests = (gc['total_tests'] as num?)?.toInt() ?? 0;
    final liveTests = (gc['live_tests'] as num?)?.toInt() ?? 0;

    final String subtitle;
    if (sections.isNotEmpty) {
      final secLabel =
          '${sections.length} ${sections.length == 1 ? 'Section' : 'Sections'}';
      subtitle = totalTests > 0
          ? '$secLabel · $totalTests ${totalTests == 1 ? 'Test' : 'Tests'}'
          : secLabel;
    } else {
      subtitle = totalTests > 0
          ? '$totalTests Test Series'
          : 'No Test Series';
    }

    return Material(
      color: isDark ? AppColors.darkSurfaceRaised : TsColors.cardIvory,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: () => _onTapClassGroup(gc),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isDark ? TsColors.darkBorder : TsColors.border,
              width: 1.3,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.025),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Stack(
            children: [
              if (liveTests > 0)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDark
                          ? TsColors.emerald900.withValues(alpha: 0.45)
                          : AppColors.success50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 5.5,
                          height: 5.5,
                          decoration: const BoxDecoration(
                            color: TsColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$liveTests Live',
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            color: TsColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Text(
                    displayName,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                      color: isDark ? AppColors.darkTextPrimary : TsColors.ink,
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : TsColors.inkMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TestSeriesSectionsScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final bool isPrincipal;
  final bool canCreate;
  final String className;
  final List<Map<String, dynamic>> sectionRows;

  const TestSeriesSectionsScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    required this.isPrincipal,
    required this.canCreate,
    required this.className,
    required this.sectionRows,
  });

  @override
  State<TestSeriesSectionsScreen> createState() =>
      _TestSeriesSectionsScreenState();
}

class _TestSeriesSectionsScreenState extends State<TestSeriesSectionsScreen> {
  late TestSeriesService _service;
  late List<Map<String, dynamic>> _rows;

  @override
  void initState() {
    super.initState();
    _service = TestSeriesService(baseUrl: widget.baseUrl, token: widget.token);
    _rows = List<Map<String, dynamic>>.from(widget.sectionRows);
  }

  Future<void> _refreshSections() async {
    try {
      final data = await _service.getTeacherAccess();
      if (!mounted) return;
      final all = (data['classes'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .where((c) =>
              (c['name'] ?? '').toString().trim() == widget.className.trim() &&
              (c['section'] ?? '').toString().trim().isNotEmpty)
          .toList()
        ..sort((a, b) => (a['section'] ?? '')
            .toString()
            .compareTo((b['section'] ?? '').toString()));
      if (all.isNotEmpty) {
        setState(() => _rows = all);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final shortClass = getShortClassName(widget.className);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkSurfaceCanvas : TsColors.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? AppColors.darkTextPrimary : TsColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Row(
            children: [
              const Flexible(
                child: Text(
                  'SELECT SECTION',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16.5,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              TestSeriesClassBadges(
                classLabel: shortClass,
                isDark: isDark,
              ),
            ],
          ),
        ),
        actions: [
          if (widget.isPrincipal)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: TextButton.icon(
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) =>
                        TestSeriesPermissionsSheet(service: _service),
                  );
                },
                icon: const Icon(Icons.admin_panel_settings_rounded, size: 18),
                label: const Text('Access',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                style: TextButton.styleFrom(
                  foregroundColor: TsColors.accent,
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: TsColors.accent,
        onRefresh: _refreshSections,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.5,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final sec = _rows[index];
                    final secId = (sec['id'] as num?)?.toInt();
                    final secName = (sec['section'] ?? '').toString().trim();
                    final totalTests =
                        (sec['total_tests'] as num?)?.toInt() ?? 0;
                    final liveTests = (sec['live_tests'] as num?)?.toInt() ?? 0;
                    final secTitle =
                        secName.length == 1 ? 'Section $secName' : secName;

                    return Material(
                      color: isDark
                          ? AppColors.darkSurfaceRaised
                          : TsColors.cardIvory,
                      borderRadius: BorderRadius.circular(18),
                      child: InkWell(
                        onTap: secId == null
                            ? null
                            : () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => TestSeriesScreen(
                                      baseUrl: _service.baseUrl,
                                      token: _service.token,
                                      userRole: widget.userRole,
                                      isPrincipal: widget.isPrincipal,
                                      initialCanCreate: widget.canCreate,
                                      targetClassId: secId,
                                      targetClassLabel: widget.className,
                                      targetSectionLabel: secName,
                                    ),
                                  ),
                                );
                                if (mounted) _refreshSections();
                              },
                        borderRadius: BorderRadius.circular(18),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: isDark
                                  ? TsColors.darkBorder
                                  : TsColors.border,
                              width: 1.3,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black
                                    .withValues(alpha: isDark ? 0.18 : 0.025),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          child: Stack(
                            children: [
                              if (liveTests > 0)
                                Positioned(
                                  top: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? TsColors.emerald900
                                              .withValues(alpha: 0.45)
                                          : AppColors.success50,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          width: 5.5,
                                          height: 5.5,
                                          decoration: const BoxDecoration(
                                            color: TsColors.success,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          '$liveTests Live',
                                          style: const TextStyle(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            color: TsColors.success,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              Center(
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 14),
                                  child: Text(
                                    secTitle,
                                    textAlign: TextAlign.center,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -0.3,
                                      color: isDark
                                          ? AppColors.darkTextPrimary
                                          : TsColors.ink,
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 0,
                                left: 0,
                                right: 0,
                                child: Text(
                                  totalTests > 0
                                      ? '$totalTests Test Series'
                                      : 'No Test Series',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : TsColors.inkMuted,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                  childCount: _rows.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

