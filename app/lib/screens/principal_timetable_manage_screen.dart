import 'package:flutter/material.dart';
import '../services/timetable_service.dart';

class DropdownMenuItemModel<T> {
  final T value;
  final String label;

  DropdownMenuItemModel({required this.value, required this.label});
}

class PrincipalTimetableManageScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const PrincipalTimetableManageScreen({
    super.key,
    required this.baseUrl,
    required this.token,
  });

  @override
  State<PrincipalTimetableManageScreen> createState() =>
      _PrincipalTimetableManageScreenState();
}

class _PrincipalTimetableManageScreenState
    extends State<PrincipalTimetableManageScreen> {
  late TimetableService _service;

  bool _isLoading = true;
  bool _isActionLoading = false;
  String _errorText = '';

  List<dynamic> _classes = [];
  int? _selectedClassId;

  DateTime _currentDate = DateTime.now();
  final List<String> _days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  int _selectedDayIndex = 0; // 0 = Monday

  Map<String, dynamic> _timetableData = {};
  List<dynamic> _periodConfigs = [];
  List<dynamic> _staff = [];
  List<dynamic> _subjects = [];
  List<dynamic> _allTimetableEntries = [];
  List<dynamic> _holidays = [];
  Map<String, dynamic>? _timetableSettings;

  // Copied schedule buffer
  Map<String, dynamic>? _copiedSchedule;

  // Inline Add Period Form state per day
  final Map<String, int?> _selectedSubjectIdPerDay = {};
  final Map<String, int?> _selectedTeacherIdPerDay = {};

  @override
  void initState() {
    super.initState();
    _service = TimetableService(baseUrl: widget.baseUrl, token: widget.token);

    // If current date is Sunday, advance to Monday
    if (_currentDate.weekday == DateTime.sunday) {
      _currentDate = _currentDate.add(const Duration(days: 1));
    }
    _selectedDayIndex = (_currentDate.weekday - 1).clamp(0, 5);

    _initData();
  }

  // Monday date of current selected week
  DateTime get _mondayDate {
    final diff = _currentDate.weekday - DateTime.monday;
    return DateTime(_currentDate.year, _currentDate.month, _currentDate.day)
        .subtract(Duration(days: diff));
  }

  // Saturday date of current selected week
  DateTime get _saturdayDate {
    return _mondayDate.add(const Duration(days: 5));
  }

  // Map of weekday name to resolved DateTime
  Map<String, DateTime> get _weekDayDates {
    final map = <String, DateTime>{};
    for (int i = 0; i < 6; i++) {
      map[_days[i]] = _mondayDate.add(Duration(days: i));
    }
    return map;
  }

  String _formatYYYYMMDD(DateTime dt) {
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  String _formatShortMonthDay(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  String _formatDateInput(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }

  String _formatTime12Hr(dynamic timeStr) {
    if (timeStr == null || timeStr.toString().isEmpty) return '';
    try {
      final parts = timeStr.toString().split(':');
      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      final period = hour >= 12 ? 'PM' : 'AM';
      final formattedHour = hour % 12 == 0 ? 12 : hour % 12;
      final formattedMinute = minute.toString().padLeft(2, '0');
      return '$formattedHour:$formattedMinute $period';
    } catch (_) {
      return timeStr.toString();
    }
  }

  String _getShortClassName(dynamic name, dynamic section) {
    final n = (name ?? '').toString();
    final s = (section ?? '').toString().trim();
    if (s.isNotEmpty) {
      return '$n - $s';
    }
    return n;
  }

  Future<void> _initData() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    try {
      final results = await Future.wait([
        _service.getClasses().catchError((_) => <dynamic>[]),
        _service.getSubjects().catchError((_) => <dynamic>[]),
        _service.getHolidays().catchError((_) => <dynamic>[]),
        _service.getTimetableSettings().catchError((_) => null),
      ]);

      _classes = results[0] as List<dynamic>;
      _subjects = results[1] as List<dynamic>;
      _holidays = results[2] as List<dynamic>;
      if (results[3] != null && results[3] is Map<String, dynamic>) {
        _timetableSettings = results[3] as Map<String, dynamic>;
      }

      if (_classes.isNotEmpty) {
        _selectedClassId = _classes.first['id'];
      }

      await _loadWeekTimetable();
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorText = 'Failed to load timetable options.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadWeekTimetable({bool silent = false}) async {
    if (_selectedClassId == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorText = '';
      });
    }

    final dateStr = _formatYYYYMMDD(_currentDate);

    try {
      final responses = await Future.wait([
        _service.getAdminTimetable(
          classId: _selectedClassId!,
          date: dateStr,
        ),
        _service.getPeriodConfigurations(date: dateStr).catchError((_) => <dynamic>[]),
        _service.getStaff(date: dateStr).catchError((_) => <dynamic>[]),
        _service.getAllTimetableEntries(date: dateStr).catchError((_) => <dynamic>[]),
        _service.getSubjects(classId: _selectedClassId).catchError((_) => <dynamic>[]),
      ]);

      if (mounted) {
        setState(() {
          _timetableData = responses[0] as Map<String, dynamic>;
          _periodConfigs = responses[1] as List<dynamic>;
          _staff = responses[2] as List<dynamic>;
          _allTimetableEntries = responses[3] as List<dynamic>;
          if ((responses[4] as List<dynamic>).isNotEmpty) {
            _subjects = responses[4] as List<dynamic>;
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorText = 'Failed to load timetable for selected week.';
          _isLoading = false;
        });
      }
    }
  }

  void _showSuccessToast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: const Color(0xFFC26600),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _onPrevWeek() {
    setState(() {
      _currentDate = _currentDate.subtract(const Duration(days: 7));
    });
    _loadWeekTimetable();
  }

  void _onNextWeek() {
    setState(() {
      _currentDate = _currentDate.add(const Duration(days: 7));
    });
    _loadWeekTimetable();
  }

  Future<void> _onPickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _currentDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      selectableDayPredicate: (d) => d.weekday != DateTime.sunday,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFC26600),
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _currentDate = picked;
        _selectedDayIndex = (picked.weekday - 1).clamp(0, 5);
      });
      _loadWeekTimetable();
    }
  }

  String _getTimingStr(int periodNumber) {
    for (var cfg in _periodConfigs) {
      if (cfg['period_number'] == periodNumber) {
        final start = _formatTime12Hr(cfg['start_time']);
        final end = _formatTime12Hr(cfg['end_time']);
        if (start.isNotEmpty && end.isNotEmpty) {
          return '$start – $end';
        }
      }
    }
    return '';
  }

  // Custom Dropdown Anchor (Opens directly downward below the field with curved corners)
  Widget _buildDropdownAnchor<T>({
    required BuildContext context,
    required String hint,
    required T? value,
    required String displayText,
    required List<DropdownMenuItemModel<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Builder(
      builder: (btnContext) {
        return InkWell(
          onTap: items.isEmpty
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

                  final selected = await showMenu<T>(
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
                      final isSelected = item.value == value;
                      return PopupMenuItem<T>(
                        value: item.value,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Text(
                          item.label,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                            color: isSelected ? const Color(0xFFC26600) : const Color(0xFF1E293B),
                          ),
                        ),
                      );
                    }).toList(),
                  );

                  if (selected != null) {
                    onChanged(selected);
                  }
                },
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    displayText.isNotEmpty ? displayText : hint,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: displayText.isNotEmpty ? const Color(0xFF1E293B) : const Color(0xFF64748B),
                    ),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 18),
              ],
            ),
          ),
        );
      },
    );
  }

  // Add Period Handler
  Future<void> _handleAddPeriod(String dayName) async {
    final dayData = _timetableData[dayName] as Map<String, dynamic>? ?? {};
    final dayDate = dayData['date'] ?? _formatYYYYMMDD(_weekDayDates[dayName]!);
    final todayStr = _formatYYYYMMDD(DateTime.now());

    // Back date check (Requirement 9)
    if (dayDate.compareTo(todayStr) < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot add or modify timetable periods for past dates.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final subjectId = _selectedSubjectIdPerDay[dayName];
    final teacherId = _selectedTeacherIdPerDay[dayName];

    if (subjectId == null || teacherId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select both a Subject and a Teacher.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final periods = (dayData['periods'] as List<dynamic>?) ?? [];
    final scheduledNums = periods.map((p) => p['period_number'] as int?).whereType<int>().toSet();

    final availableConfigs = _periodConfigs.where((c) => !scheduledNums.contains(c['period_number'])).toList();
    if (availableConfigs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All configured period slots for this day are already scheduled.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final nextPeriodNum = availableConfigs.first['period_number'];

    setState(() => _isActionLoading = true);

    try {
      await _service.addTimetablePeriod(
        classId: _selectedClassId!,
        subjectId: subjectId,
        teacherId: teacherId,
        dayOfWeek: dayName,
        periodNumber: nextPeriodNum,
        startDate: dayDate,
      );

      // Reset selection for this day
      setState(() {
        _selectedSubjectIdPerDay[dayName] = null;
        _selectedTeacherIdPerDay[dayName] = null;
      });

      // Silently refresh data; no success toast message per requirement 6
      await _loadWeekTimetable(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  // Delete Period
  Future<void> _handleDeletePeriod(int periodId, String date) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Period', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to delete this period from schedule?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionLoading = true);
    try {
      await _service.deleteTimetablePeriod(id: periodId, date: date);
      await _loadWeekTimetable(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  // Publish Day
  Future<void> _handlePublishDay(String dayName, String dateStr) async {
    setState(() => _isActionLoading = true);
    try {
      await _service.publishTimetableDay(
        classId: _selectedClassId!,
        dayOfWeek: dayName,
        date: dateStr,
      );
      await _loadWeekTimetable(silent: true);
      if (mounted) {
        _showSuccessToast('$dayName timetable published successfully!');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  // Copy Schedule
  void _handleCopySchedule(String dayName) {
    final dayData = _timetableData[dayName] as Map<String, dynamic>? ?? {};
    final periods = (dayData['periods'] as List<dynamic>?) ?? [];
    if (periods.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot copy an empty schedule.')),
      );
      return;
    }

    setState(() {
      _copiedSchedule = {
        'class_id': _selectedClassId,
        'source_day': dayName,
        'periods': periods,
      };
    });

    _showSuccessToast('$dayName schedule copied! Select another day to paste.');
  }

  // Paste Schedule
  Future<void> _handlePasteSchedule(String destinationDay) async {
    if (_copiedSchedule == null) return;

    final sourceDay = _copiedSchedule!['source_day'] as String;
    final destDate = _timetableData[destinationDay]?['date'] ??
        _formatYYYYMMDD(_weekDayDates[destinationDay]!);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Paste Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Do you want to paste the schedule from $sourceDay to $destinationDay ($destDate)? This will overwrite existing periods.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFC26600),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Paste', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionLoading = true);
    try {
      await _service.pasteTimetableSchedule(
        classId: _selectedClassId!,
        sourceDay: sourceDay,
        destinationDay: destinationDay,
        destinationDate: destDate,
      );
      await _loadWeekTimetable(silent: true);
      if (mounted) {
        _showSuccessToast('Schedule pasted to $destinationDay successfully.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  // Clear Day Timetable
  Future<void> _handleClearDay(String dayName) async {
    final dayData = _timetableData[dayName] as Map<String, dynamic>? ?? {};
    final dateStr = dayData['date'] ?? _formatYYYYMMDD(_weekDayDates[dayName]!);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Clear $dayName Timetable', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to delete all scheduled periods for $dayName ($dateStr)?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isActionLoading = true);
    try {
      await _service.deleteDayTimetable(
        classId: _selectedClassId!,
        dayOfWeek: dayName,
        date: dateStr,
      );
      await _loadWeekTimetable(silent: true);
      if (mounted) {
        _showSuccessToast('$dayName timetable cleared.');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  // Assign Backup Teacher Dialog
  Future<void> _showBackupTeacherDialog(dynamic period, String date) async {
    int? selectedBackupId;

    final availableTeachers = _staff.where((t) {
      final role = (t['role'] ?? '').toString().toUpperCase();
      final isPrincipal = t['is_principal'] == true || t['is_principal'] == 1 || t['is_principal'] == '1';
      return t['status'] == 'ACTIVE' && (role == 'TEACHER' || role == 'PRINCIPAL' || isPrincipal);
    }).toList();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Assign Backup Teacher',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Period ${period['period_number']}: ${period['subject_name']} ($date)',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const Text('Select Backup Teacher:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    initialValue: selectedBackupId,
                    borderRadius: BorderRadius.circular(16),
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                    ),
                    hint: const Text('Choose teacher'),
                    items: availableTeachers.map((t) {
                      return DropdownMenuItem<int>(
                        value: t['id'] as int,
                        child: Text(t['name'] ?? 'Teacher #${t['id']}'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setModalState(() => selectedBackupId = val);
                    },
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFC26600),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: selectedBackupId == null
                          ? null
                          : () async {
                              Navigator.pop(ctx);
                              setState(() => _isActionLoading = true);
                              try {
                                await _service.assignBackupTeacher(
                                  timetableId: period['id'] as int,
                                  date: date,
                                  backupTeacherId: selectedBackupId!,
                                );
                                await _loadWeekTimetable(silent: true);
                                if (mounted) {
                                  _showSuccessToast('Backup teacher assigned successfully.');
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(e.toString().replaceAll('Exception: ', '')),
                                      backgroundColor: Colors.redAccent,
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted) setState(() => _isActionLoading = false);
                              }
                            },
                      child: const Text('Confirm Backup Teacher', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
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

  // Replace Teacher Dialog
  Future<void> _showReplaceTeacherDialog(dynamic period, String date) async {
    int? selectedNewTeacherId;

    final availableTeachers = _staff.where((t) {
      final role = (t['role'] ?? '').toString().toUpperCase();
      final isPrincipal = t['is_principal'] == true || t['is_principal'] == 1 || t['is_principal'] == '1';
      return t['status'] == 'ACTIVE' && (role == 'TEACHER' || role == 'PRINCIPAL' || isPrincipal);
    }).toList();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Replace Teacher Permanently',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Period ${period['period_number']}: ${period['subject_name']}',
                    style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const Text('Select New Teacher:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    initialValue: selectedNewTeacherId,
                    borderRadius: BorderRadius.circular(16),
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                    ),
                    hint: const Text('Choose replacement teacher'),
                    items: availableTeachers.map((t) {
                      return DropdownMenuItem<int>(
                        value: t['id'] as int,
                        child: Text(t['name'] ?? 'Teacher #${t['id']}'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setModalState(() => selectedNewTeacherId = val);
                    },
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFC26600),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: selectedNewTeacherId == null
                          ? null
                          : () async {
                              Navigator.pop(ctx);
                              setState(() => _isActionLoading = true);
                              try {
                                await _service.replaceTeacher(
                                  timetableId: period['id'] as int,
                                  date: date,
                                  newTeacherId: selectedNewTeacherId!,
                                );
                                await _loadWeekTimetable(silent: true);
                                if (mounted) {
                                  _showSuccessToast('Teacher replaced successfully.');
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(e.toString().replaceAll('Exception: ', '')),
                                      backgroundColor: Colors.redAccent,
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted) setState(() => _isActionLoading = false);
                              }
                            },
                      child: const Text('Replace Teacher', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
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

  // Helper to format minutes to 12-hour format string (e.g. "08:00 AM")
  String _formatMinutesTo12Hr(int totalMins) {
    final h = (totalMins ~/ 60) % 24;
    final m = totalMins % 60;
    final period = h >= 12 ? 'PM' : 'AM';
    final displayH = h % 12 == 0 ? 12 : h % 12;
    return '${displayH.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')} $period';
  }

  // Dynamic preview slots computation matching backend and web portal
  List<Map<String, dynamic>> _computePreviewSlots({
    required TimeOfDay startTime,
    required int periodDuration,
    required int intervalDuration,
    required int intervalAfterPeriod,
    required int totalPeriods,
  }) {
    final List<Map<String, dynamic>> slots = [];
    int currentMinutes = startTime.hour * 60 + startTime.minute;

    for (int i = 1; i <= totalPeriods; i++) {
      final startMin = currentMinutes;
      final endMin = currentMinutes + periodDuration;
      slots.add({
        'type': 'period',
        'period_number': i,
        'start_time': _formatMinutesTo12Hr(startMin),
        'end_time': _formatMinutesTo12Hr(endMin),
      });
      currentMinutes = endMin;

      if (i == intervalAfterPeriod && intervalDuration > 0) {
        final breakStart = currentMinutes;
        final breakEnd = currentMinutes + intervalDuration;
        slots.add({
          'type': 'interval',
          'period_number': 0,
          'start_time': _formatMinutesTo12Hr(breakStart),
          'end_time': _formatMinutesTo12Hr(breakEnd),
        });
        currentMinutes = breakEnd;
      }
    }

    return slots;
  }

  // Curved Time Picker Dialog matching Screenshot 3
  Future<TimeOfDay?> _showCurvedTimePicker(BuildContext context, TimeOfDay initialTime) async {
    int selectedHour = initialTime.hourOfPeriod == 0 ? 12 : initialTime.hourOfPeriod;
    int selectedMinute = initialTime.minute;
    DayPeriod selectedPeriod = initialTime.period;

    return showDialog<TimeOfDay>(
      context: context,
      builder: (dlgContext) {
        return StatefulBuilder(
          builder: (dlgContext, setDialogState) {
            return Dialog(
              backgroundColor: Colors.white,
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Select Start Time',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)),
                          onPressed: () => Navigator.pop(dlgContext),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    // Formatted Selected Display
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Center(
                        child: Text(
                          '${selectedHour.toString().padLeft(2, '0')} : ${selectedMinute.toString().padLeft(2, '0')} ${selectedPeriod == DayPeriod.am ? 'AM' : 'PM'}',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                            color: Color(0xFFC26600),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // 3 Columns: Hour, Minute, AM/PM
                    SizedBox(
                      height: 200,
                      child: Row(
                        children: [
                          // Hours
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text('HOUR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B))),
                                const SizedBox(height: 6),
                                Expanded(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: ListView.builder(
                                      padding: const EdgeInsets.symmetric(vertical: 4),
                                      itemCount: 12,
                                      itemBuilder: (ctx, idx) {
                                        final h = idx + 1;
                                        final isSel = h == selectedHour;
                                        return InkWell(
                                          onTap: () => setDialogState(() => selectedHour = h),
                                          borderRadius: BorderRadius.circular(12),
                                          child: Container(
                                            margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            padding: const EdgeInsets.symmetric(vertical: 8),
                                            decoration: BoxDecoration(
                                              color: isSel ? const Color(0xFFC26600) : Colors.transparent,
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Center(
                                              child: Text(
                                                h.toString().padLeft(2, '0'),
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                  color: isSel ? Colors.white : const Color(0xFF1E293B),
                                                ),
                                              ),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Minutes (00 to 55 in 5m steps)
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text('MINUTE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B))),
                                const SizedBox(height: 6),
                                Expanded(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: ListView.builder(
                                      padding: const EdgeInsets.symmetric(vertical: 4),
                                      itemCount: 12,
                                      itemBuilder: (ctx, idx) {
                                        final m = idx * 5;
                                        final isSel = m == selectedMinute;
                                        return InkWell(
                                          onTap: () => setDialogState(() => selectedMinute = m),
                                          borderRadius: BorderRadius.circular(12),
                                          child: Container(
                                            margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            padding: const EdgeInsets.symmetric(vertical: 8),
                                            decoration: BoxDecoration(
                                              color: isSel ? const Color(0xFFC26600) : Colors.transparent,
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Center(
                                              child: Text(
                                                m.toString().padLeft(2, '0'),
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                  color: isSel ? Colors.white : const Color(0xFF1E293B),
                                                ),
                                              ),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          // AM / PM Column
                          Expanded(
                            flex: 3,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text('PERIOD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B))),
                                const SizedBox(height: 6),
                                Expanded(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
                                    child: Column(
                                      children: [
                                        Expanded(
                                          child: InkWell(
                                            onTap: () => setDialogState(() => selectedPeriod = DayPeriod.am),
                                            borderRadius: BorderRadius.circular(12),
                                            child: Container(
                                              decoration: BoxDecoration(
                                                color: selectedPeriod == DayPeriod.am ? const Color(0xFFC26600) : Colors.transparent,
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              alignment: Alignment.center,
                                              child: Text(
                                                'AM',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                  color: selectedPeriod == DayPeriod.am ? Colors.white : const Color(0xFF1E293B),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Expanded(
                                          child: InkWell(
                                            onTap: () => setDialogState(() => selectedPeriod = DayPeriod.pm),
                                            borderRadius: BorderRadius.circular(12),
                                            child: Container(
                                              decoration: BoxDecoration(
                                                color: selectedPeriod == DayPeriod.pm ? const Color(0xFFC26600) : Colors.transparent,
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              alignment: Alignment.center,
                                              child: Text(
                                                'PM',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                  color: selectedPeriod == DayPeriod.pm ? Colors.white : const Color(0xFF1E293B),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(dlgContext),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () {
                              final hour24 = selectedPeriod == DayPeriod.am
                                  ? (selectedHour == 12 ? 0 : selectedHour)
                                  : (selectedHour == 12 ? 12 : selectedHour + 12);
                              Navigator.pop(dlgContext, TimeOfDay(hour: hour24, minute: selectedMinute));
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFC26600),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            child: const Text('Apply', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
      },
    );
  }

  Widget _buildConfigTextField({
    required TextEditingController controller,
    required ValueChanged<String> onChanged,
  }) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      alignment: Alignment.center,
      child: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        onChanged: onChanged,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
        decoration: const InputDecoration(
          isDense: true,
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }

  // School Settings & Timetable Configuration Modal (Principal Configuration Feature)
  void _showConfigurationModal() {
    TimeOfDay initialStartTime = const TimeOfDay(hour: 8, minute: 0);
    if (_timetableSettings != null && _timetableSettings!['school_start_time'] != null) {
      try {
        final parts = _timetableSettings!['school_start_time'].toString().split(':');
        initialStartTime = TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
      } catch (_) {}
    }
    TimeOfDay selectedStartTime = initialStartTime;

    final initialPeriodDur = int.tryParse((_timetableSettings?['period_duration'] ?? 40).toString()) ?? 40;
    final initialIntervalDur = int.tryParse((_timetableSettings?['interval_duration'] ?? 20).toString()) ?? 20;
    final initialIntervalAfter = int.tryParse((_timetableSettings?['interval_after_period'] ?? 4).toString()) ?? 4;
    final initialTotalP = int.tryParse((_timetableSettings?['total_periods'] ?? 8).toString()) ?? 8;

    final periodDurationController = TextEditingController(
      text: initialPeriodDur.toString(),
    );
    final intervalDurationController = TextEditingController(
      text: initialIntervalDur.toString(),
    );
    final intervalAfterController = TextEditingController(
      text: initialIntervalAfter.toString(),
    );
    final totalPeriodsController = TextEditingController(
      text: initialTotalP.toString(),
    );

    final initialTotalPeriods = _timetableSettings?['total_periods'] != null
        ? int.tryParse(_timetableSettings!['total_periods'].toString())
        : null;

    bool isSaving = false;
    String? formError;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final periodDur = int.tryParse(periodDurationController.text) ?? 40;
            final intervalDur = int.tryParse(intervalDurationController.text) ?? 20;
            final intervalAfter = int.tryParse(intervalAfterController.text) ?? 4;
            final totalP = int.tryParse(totalPeriodsController.text) ?? 8;

            final bool isChanged = (selectedStartTime.hour != initialStartTime.hour ||
                    selectedStartTime.minute != initialStartTime.minute) ||
                periodDurationController.text.trim() != initialPeriodDur.toString() ||
                intervalDurationController.text.trim() != initialIntervalDur.toString() ||
                intervalAfterController.text.trim() != initialIntervalAfter.toString() ||
                totalPeriodsController.text.trim() != initialTotalP.toString();

            final previewSlots = _computePreviewSlots(
              startTime: selectedStartTime,
              periodDuration: periodDur > 0 ? periodDur : 40,
              intervalDuration: intervalDur >= 0 ? intervalDur : 0,
              intervalAfterPeriod: intervalAfter,
              totalPeriods: totalP > 0 ? totalP : 8,
            );

            final startTimeFormatted =
                '${(selectedStartTime.hourOfPeriod == 0 ? 12 : selectedStartTime.hourOfPeriod).toString().padLeft(2, '0')}:${selectedStartTime.minute.toString().padLeft(2, '0')} ${selectedStartTime.period == DayPeriod.am ? 'AM' : 'PM'}';

            Future<void> executeSave(bool clearTimetable) async {
              setModalState(() {
                isSaving = true;
                formError = null;
              });

              final time24 =
                  '${selectedStartTime.hour.toString().padLeft(2, '0')}:${selectedStartTime.minute.toString().padLeft(2, '0')}:00';
              final todayStr = _formatYYYYMMDD(DateTime.now());

              try {
                await _service.saveTimetableSettings({
                  'school_start_time': time24,
                  'period_duration': periodDur,
                  'interval_duration': intervalDur,
                  'interval_after_period': intervalAfter,
                  'total_periods': totalP,
                  'clear_timetable': clearTimetable,
                  'date': todayStr,
                });

                if (mounted) {
                  setState(() {
                    _timetableSettings = {
                      'school_start_time': time24,
                      'period_duration': periodDur,
                      'interval_duration': intervalDur,
                      'interval_after_period': intervalAfter,
                      'total_periods': totalP,
                    };
                  });
                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                  }
                  _loadWeekTimetable();
                  _showSuccessToast('Timetable settings saved and periods generated successfully.');
                }
              } catch (e) {
                setModalState(() {
                  isSaving = false;
                  formError = e.toString().replaceAll('Exception:', '').trim();
                });
              }
            }

            void handleSave() {
              if (periodDur <= 0) {
                setModalState(() => formError = 'Period duration must be greater than 0.');
                return;
              }
              if (intervalDur < 0) {
                setModalState(() => formError = 'Interval duration must be 0 or greater.');
                return;
              }
              if (totalP <= 0) {
                setModalState(() => formError = 'Total periods must be greater than 0.');
                return;
              }
              if (intervalAfter < 1 || intervalAfter > totalP) {
                setModalState(() => formError = 'Interval break must be placed between Period 1 and Period $totalP.');
                return;
              }

              final isCountChanged = initialTotalPeriods != null && totalP != initialTotalPeriods;
              if (isCountChanged) {
                showDialog(
                  context: context,
                  builder: (confirmCtx) => AlertDialog(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    title: const Text('Update Total Periods?', style: TextStyle(fontWeight: FontWeight.w900)),
                    content: const Text(
                      'Changing the total periods will reset period configurations and may affect existing timetables. Do you want to proceed?',
                      style: TextStyle(fontSize: 13),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(confirmCtx),
                        child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.pop(confirmCtx);
                          executeSave(true);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC26600),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Proceed', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                );
              } else {
                executeSave(false);
              }
            }

            return Container(
              height: MediaQuery.of(ctx).size.height * 0.85,
              padding: EdgeInsets.only(
                left: 18,
                right: 18,
                top: 18,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Modal Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'School Settings & Timetable Configuration',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                            ),
                            SizedBox(height: 3),
                            Text(
                              'Define structural settings for classroom schedulers and faculty workload computation.',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const Divider(height: 20),
                  // Scrollable Form & Preview
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (formError != null) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFFCA5A5)),
                              ),
                              child: Text(
                                formError!,
                                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          // School Start Time
                          const Text(
                            'SCHOOL START TIME',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 6),
                          InkWell(
                            onTap: () async {
                              final picked = await _showCurvedTimePicker(context, selectedStartTime);
                              if (picked != null) {
                                setModalState(() {
                                  selectedStartTime = picked;
                                });
                              }
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              height: 44,
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    startTimeFormatted,
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                                  ),
                                  const Icon(Icons.access_time, size: 18, color: Color(0xFF64748B)),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 4, left: 2),
                            child: Text(
                              'Selected: $startTimeFormatted',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                          ),
                          const SizedBox(height: 14),
                          // Row 1: Period Duration & Interval Duration
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'PERIOD DURATION (MINUTES)',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.3),
                                    ),
                                    const SizedBox(height: 6),
                                    _buildConfigTextField(
                                      controller: periodDurationController,
                                      onChanged: (_) => setModalState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'INTERVAL DURATION (MINUTES)',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.3),
                                    ),
                                    const SizedBox(height: 6),
                                    _buildConfigTextField(
                                      controller: intervalDurationController,
                                      onChanged: (_) => setModalState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          // Row 2: Interval After Period & Total Periods
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'INTERVAL AFTER PERIOD',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.3),
                                    ),
                                    const SizedBox(height: 6),
                                    _buildConfigTextField(
                                      controller: intervalAfterController,
                                      onChanged: (_) => setModalState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'TOTAL PERIODS PER DAY',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 0.3),
                                    ),
                                    const SizedBox(height: 6),
                                    _buildConfigTextField(
                                      controller: totalPeriodsController,
                                      onChanged: (_) => setModalState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          // Save Configuration Button
                          SizedBox(
                            width: double.infinity,
                            height: 44,
                            child: ElevatedButton(
                              onPressed: (isSaving || !isChanged) ? null : handleSave,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFC26600),
                                disabledBackgroundColor: const Color(0xFFE2E8F0),
                                disabledForegroundColor: const Color(0xFF94A3B8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                              child: isSaving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Text(
                                      'Save Configuration',
                                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          // Generated Timetable Preview
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'GENERATED TIMETABLE PREVIEW',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF64748B),
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                ...previewSlots.map((slot) {
                                  final isInterval = slot['type'] == 'interval';
                                  if (isInterval) {
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: const Color(0xFFFDE68A)),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'Interval Break',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFD97706)),
                                          ),
                                          Text(
                                            '${slot['start_time']} – ${slot['end_time']}',
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFD97706)),
                                          ),
                                        ],
                                      ),
                                    );
                                  }

                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'Period ${slot['period_number']}',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                                        ),
                                        Text(
                                          '${slot['start_time']} – ${slot['end_time']}',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
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

  // Manage Subjects Modal Bottom Sheet (Supports comma-separated subjects & delete confirmation)
  void _showManageSubjectsModal() {
    final textController = TextEditingController();
    bool isAdding = false;
    int? deletingSubjectId;
    String? subjectErrorMessage;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Container(
              height: MediaQuery.of(ctx).size.height * 0.78,
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Manage Subjects',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Create and delete subjects catalog.',
                            style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Add Subject Row (Supports comma separation)
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: textController,
                          decoration: InputDecoration(
                            hintText: 'Add subject(s) e.g. Math, Science...',
                            hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFC26600),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        ),
                        onPressed: isAdding
                            ? null
                            : () async {
                                final rawInput = textController.text.trim();
                                if (rawInput.isEmpty) return;

                                // Split by comma (Requirement 7)
                                final names = rawInput
                                    .split(',')
                                    .map((n) => n.trim())
                                    .where((n) => n.isNotEmpty)
                                    .toList();

                                final toCreate = <String>[];
                                for (final n in names) {
                                  final inToCreate = toCreate.any((c) => c.toLowerCase() == n.toLowerCase());
                                  final inExisting = _subjects.any((s) => (s['name'] ?? '').toString().toLowerCase() == n.toLowerCase());
                                  if (!inToCreate && !inExisting) {
                                    toCreate.add(n);
                                  }
                                }

                                if (toCreate.isEmpty) {
                                  if (ctx.mounted) {
                                    ScaffoldMessenger.of(ctx).showSnackBar(
                                      SnackBar(
                                        content: Text(names.length == 1
                                            ? 'This subject already exists.'
                                            : 'All specified subjects already exist.'),
                                        backgroundColor: Colors.amber.shade800,
                                      ),
                                    );
                                  }
                                  return;
                                }

                                setModalState(() {
                                  isAdding = true;
                                  subjectErrorMessage = null;
                                });
                                try {
                                  for (final name in toCreate) {
                                    await _service.createSubject(name);
                                  }
                                  textController.clear();
                                  final updatedSubjects = await _service.getSubjects();
                                  setState(() {
                                    _subjects = updatedSubjects;
                                  });
                                  setModalState(() {});
                                } catch (e) {
                                  if (ctx.mounted) {
                                    ScaffoldMessenger.of(ctx).showSnackBar(
                                      SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                    );
                                  }
                                } finally {
                                  setModalState(() => isAdding = false);
                                }
                              },
                        child: isAdding
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Add', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    ],
                  ),
                  if (subjectErrorMessage != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 2),
                            child: Icon(Icons.error_outline, size: 18, color: Color(0xFFDC2626)),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              subjectErrorMessage!,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFFDC2626),
                                fontWeight: FontWeight.bold,
                                height: 1.3,
                              ),
                            ),
                          ),
                          InkWell(
                            onTap: () => setModalState(() => subjectErrorMessage = null),
                            child: const Padding(
                              padding: EdgeInsets.only(left: 4, top: 1),
                              child: Icon(Icons.close, size: 16, color: Color(0xFFDC2626)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  const Text('Existing Subjects:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Expanded(
                    child: _subjects.isEmpty
                        ? const Center(child: Text('No subjects added yet.'))
                        : ListView.separated(
                            itemCount: _subjects.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (ctx, idx) {
                              final sub = _subjects[idx];
                              final subId = sub['id'] as int;
                              final isThisDeleting = deletingSubjectId == subId;

                              return ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.book_outlined, color: Color(0xFFC26600), size: 20),
                                title: Text(
                                  sub['name'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                trailing: isThisDeleting
                                    ? const SizedBox(
                                        width: 32,
                                        height: 32,
                                        child: Center(
                                          child: SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Color(0xFFC26600),
                                            ),
                                          ),
                                        ),
                                      )
                                    : IconButton(
                                        icon: Icon(Icons.delete_outline, color: Colors.red.shade400, size: 20),
                                        onPressed: (deletingSubjectId != null || isAdding)
                                            ? null
                                            : () async {
                                                setModalState(() => subjectErrorMessage = null);

                                                // Confirmation dialog before deleting subject
                                                final confirmed = await showDialog<bool>(
                                                  context: ctx,
                                                  builder: (dCtx) => AlertDialog(
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                                    title: const Text('Delete Subject', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                                                    content: Text('Are you sure you want to delete "${sub['name']}"? This action cannot be undone.'),
                                                    actions: [
                                                      TextButton(
                                                        onPressed: () => Navigator.pop(dCtx, false),
                                                        child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                                                      ),
                                                      ElevatedButton(
                                                        style: ElevatedButton.styleFrom(
                                                          backgroundColor: Colors.red.shade700,
                                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                                        ),
                                                        onPressed: () => Navigator.pop(dCtx, true),
                                                        child: const Text('Delete', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                                                      ),
                                                    ],
                                                  ),
                                                );

                                                if (confirmed != true) return;

                                                setModalState(() {
                                                  deletingSubjectId = subId;
                                                  subjectErrorMessage = null;
                                                });

                                                try {
                                                  await _service.deleteSubject(subId);
                                                  final updated = await _service.getSubjects();
                                                  setState(() {
                                                    _subjects = updated;
                                                  });
                                                  setModalState(() {});
                                                } catch (e) {
                                                  final rawMsg = e.toString().replaceAll('Exception: ', '').trim();
                                                  final validationMsg = rawMsg.isNotEmpty
                                                      ? rawMsg
                                                      : '${sub['name']} is already included in report card it can not be deleted';
                                                  setModalState(() {
                                                    subjectErrorMessage = validationMsg;
                                                  });
                                                  if (ctx.mounted) {
                                                    showDialog(
                                                      context: ctx,
                                                      builder: (errCtx) => AlertDialog(
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                                        title: const Row(
                                                          children: [
                                                            Icon(Icons.warning_amber_rounded, color: Colors.red, size: 24),
                                                            SizedBox(width: 8),
                                                            Text('Cannot Delete Subject', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                                                          ],
                                                        ),
                                                        content: Text(
                                                          validationMsg,
                                                          style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), height: 1.4),
                                                        ),
                                                        actions: [
                                                          TextButton(
                                                            onPressed: () => Navigator.pop(errCtx),
                                                            child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFC26600))),
                                                          ),
                                                        ],
                                                      ),
                                                    );
                                                  }
                                                } finally {
                                                  setModalState(() => deletingSubjectId = null);
                                                }
                                              },
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
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeRangeStr =
        '${_formatShortMonthDay(_mondayDate)} – ${_formatShortMonthDay(_saturdayDate)}';
    final currentDayName = _days[_selectedDayIndex];
    final currentDayDate = _weekDayDates[currentDayName]!;
    final currentDayDateStr = _formatYYYYMMDD(currentDayDate);

    final dayData = _timetableData[currentDayName] as Map<String, dynamic>? ?? {};
    final periodsList = (dayData['periods'] as List<dynamic>?) ?? [];
    final isPublished = periodsList.isNotEmpty &&
        periodsList.every((p) => p['is_published'] == 1 || p['is_published'] == true);
    final isHoliday = _holidays.any((h) => h['date'] == currentDayDateStr);

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6EE), // Warm modern off-white/cream
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF1E293B)),
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 14, left: 6),
          child: Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: OutlinedButton.icon(
                    onPressed: _showConfigurationModal,
                    icon: const Icon(Icons.settings_outlined, size: 15, color: Color(0xFF1E293B)),
                    label: const Text(
                      'Configuration',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      side: const BorderSide(color: Color(0xFFD1D5DB)),
                      backgroundColor: Colors.white,
                      elevation: 0,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: OutlinedButton.icon(
                    onPressed: _showManageSubjectsModal,
                    icon: const Icon(Icons.menu_book_outlined, size: 15, color: Color(0xFF1E293B)),
                    label: const Text(
                      'Manage Subjects',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      side: const BorderSide(color: Color(0xFFD1D5DB)),
                      backgroundColor: Colors.white,
                      elevation: 0,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: Stack(
        children: [
          SafeArea(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFC26600)),
                  )
                : _errorText.isNotEmpty
                    ? _buildErrorView()
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Manage weekly recurring schedules and track workloads.',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Top Controls Card (Class selection & Week Navigation)
                            _buildControlCard(activeRangeStr),

                            const SizedBox(height: 16),

                            // Weekday Tabs Selector (Requirement 4 & 5: Equal dimensions, centered, no dots)
                            _buildWeekdaySelector(),

                            const SizedBox(height: 16),

                            // Day Schedule Card (Matching Screenshot 2 & 3)
                            _buildDayCard(
                              dayName: currentDayName,
                              dayDate: currentDayDate,
                              dateStr: currentDayDateStr,
                              periodsList: periodsList,
                              isPublished: isPublished,
                              isHoliday: isHoliday,
                            ),
                          ],
                        ),
                      ),
          ),
          if (_isActionLoading)
            Container(
              color: Colors.black.withOpacity(0.35),
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFFC26600)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildControlCard(String activeRangeStr) {
    String selectedClassDisplay = '';
    if (_selectedClassId != null) {
      final selectedObj = _classes.firstWhere(
        (c) => c['id'] == _selectedClassId,
        orElse: () => null,
      );
      if (selectedObj != null) {
        selectedClassDisplay = _getShortClassName(selectedObj['name'], selectedObj['section']);
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
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
          // Class Selection Dropdown (Requirement 2 & 3: Opens below field with curved corners)
          const Text(
            'CLASS SELECTION',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          _buildDropdownAnchor<int>(
            context: context,
            hint: 'Select Class',
            value: _selectedClassId,
            displayText: selectedClassDisplay,
            items: _classes.map((c) {
              return DropdownMenuItemModel<int>(
                value: c['id'] as int,
                label: _getShortClassName(c['name'], c['section']),
              );
            }).toList(),
            onChanged: (newClassId) {
              if (newClassId != null && newClassId != _selectedClassId) {
                setState(() {
                  _selectedClassId = newClassId;
                });
                _loadWeekTimetable();
              }
            },
          ),
          const SizedBox(height: 14),

          // Weekly Calendar Navigation Row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'WEEKLY CALENDAR NAVIGATION',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        // Left button
                        InkWell(
                          onTap: _onPrevWeek,
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: const Icon(Icons.chevron_left_rounded, size: 20),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Date selector pill
                        Expanded(
                          child: InkWell(
                            onTap: _onPickDate,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    _formatDateInput(_currentDate),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 13,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF64748B)),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Right button
                        InkWell(
                          onTap: _onNextWeek,
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: const Icon(Icons.chevron_right_rounded, size: 20),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Active Range
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ACTIVE RANGE',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                activeRangeStr,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Requirement 4 & 5: Equal dimensions, centered, equal spacing, and removed red/amber dots
  Widget _buildWeekdaySelector() {
    return Row(
      children: List.generate(6, (idx) {
        final day = _days[idx];
        final date = _weekDayDates[day]!;
        final isSelected = _selectedDayIndex == idx;

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2.5),
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedDayIndex = idx;
                });
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 54,
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      day.substring(0, 3),
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w900,
                        color: isSelected ? Colors.white : const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${date.day}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.white70 : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildDayCard({
    required String dayName,
    required DateTime dayDate,
    required String dateStr,
    required List<dynamic> periodsList,
    required bool isPublished,
    required bool isHoliday,
  }) {
    final todayStr = _formatYYYYMMDD(DateTime.now());
    // Requirement 9: Check if day is back date
    final isPastDay = dateStr.compareTo(todayStr) < 0;

    final scheduledPeriodNums =
        periodsList.map((p) => p['period_number'] as int?).whereType<int>().toSet();

    final availableConfigs =
        _periodConfigs.where((c) => !scheduledPeriodNums.contains(c['period_number'])).toList();
    final nextPeriodNum =
        availableConfigs.isNotEmpty ? availableConfigs.first['period_number'] : null;

    // Available subjects: not already in this day's schedule
    final availableSubjects = _subjects.where((s) {
      return !periodsList.any((p) => (p['subject_id'] ?? 0) == s['id']);
    }).toList();

    // Filter teachers: Active teachers & not occupied in this next period slot in another class
    final availableTeachers = _staff.where((t) {
      final role = (t['role'] ?? '').toString().toUpperCase();
      final isPrincipal = t['is_principal'] == true ||
          t['is_principal'] == 1 ||
          t['is_principal'] == '1';
      final isTeacher =
          t['status'] == 'ACTIVE' && (role == 'TEACHER' || role == 'PRINCIPAL' || isPrincipal);
      if (!isTeacher) return false;

      // Check if occupied in another class at this period slot
      if (nextPeriodNum != null) {
        final isOccupied = _allTimetableEntries.any((entry) {
          final isSameSlot = entry['day_of_week'] == dayName &&
              entry['period_number'] == nextPeriodNum;
          final isSameTeacher = (entry['active_teacher_id'] == t['id']) ||
              (entry['teacher_id'] == t['id']);
          final isOtherClass =
              entry['class_id']?.toString() != _selectedClassId?.toString();
          return isSameSlot && isSameTeacher && isOtherClass;
        });
        if (isOccupied) return false;
      }

      return true;
    }).toList();

    final hasAvailableSlot = periodsList.length < _periodConfigs.length;

    // Display text for currently selected subject & teacher in inline add form
    final currentSubId = _selectedSubjectIdPerDay[dayName];
    final currentSubName = availableSubjects.firstWhere(
      (s) => s['id'] == currentSubId,
      orElse: () => null,
    )?['name'] ?? '';

    final currentTeacherId = _selectedTeacherIdPerDay[dayName];
    final currentTeacherName = availableTeachers.firstWhere(
      (t) => t['id'] == currentTeacherId,
      orElse: () => null,
    )?['name'] ?? '';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDF7), // Soft ivory card background
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFE5E7EB), width: 1.5),
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
          // Day Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    dayName,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatShortMonthDay(dayDate),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  // Status Badge
                  if (isHoliday)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'HOLIDAY',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF4338CA),
                          letterSpacing: 0.5,
                        ),
                      ),
                    )
                  else if (periodsList.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isPublished ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isPublished ? 'PUBLISHED' : 'DRAFT',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: isPublished ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  const SizedBox(width: 8),

                  // 3-dots menu for Day (Curved popup menu)
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF64748B)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    onSelected: (val) {
                      if (val == 'copy') {
                        _handleCopySchedule(dayName);
                      } else if (val == 'paste') {
                        _handlePasteSchedule(dayName);
                      } else if (val == 'clear') {
                        _handleClearDay(dayName);
                      }
                    },
                    itemBuilder: (ctx) => [
                      PopupMenuItem(
                        value: 'copy',
                        enabled: periodsList.isNotEmpty,
                        child: Row(
                          children: const [
                            Icon(Icons.copy_rounded, size: 18),
                            SizedBox(width: 10),
                            Text('Copy Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'paste',
                        enabled: _copiedSchedule != null && !isPastDay,
                        child: Row(
                          children: const [
                            Icon(Icons.paste_rounded, size: 18),
                            SizedBox(width: 10),
                            Text('Paste Schedule', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'clear',
                        enabled: periodsList.isNotEmpty && !isPastDay,
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline_rounded, size: 18, color: Colors.red.shade700),
                            const SizedBox(width: 10),
                            Text('Clear Schedule', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red.shade700)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 16),

          // Periods List
          if (periodsList.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36),
              alignment: Alignment.center,
              child: const Text(
                'No periods scheduled.',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF94A3B8),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: periodsList.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, idx) {
                final p = periodsList[idx];
                final periodNum = p['period_number'] ?? (idx + 1);
                final subName = p['subject_name'] ?? 'Subject';
                final isBackup = p['is_backup'] == true;
                final teacherName = isBackup
                    ? (p['backup_teacher_name'] ?? 'Backup Teacher')
                    : (p['teacher_name'] ?? 'Teacher');
                final timingStr = _getTimingStr(periodNum);

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Period $periodNum: $subName',
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    teacherName,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: isBackup ? const Color(0xFFD97706) : const Color(0xFF475569),
                                    ),
                                  ),
                                ),
                                if (timingStr.isNotEmpty) ...[
                                  Text(
                                    ' | $timingStr',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                                if (isBackup) ...[
                                  const SizedBox(width: 4),
                                  const Text(
                                    '(Backup)',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFFD97706),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      // 3-dots menu for this period (disabled on past dates)
                      if (!isPastDay)
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF64748B), size: 20),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          onSelected: (val) {
                            if (val == 'backup') {
                              _showBackupTeacherDialog(p, dateStr);
                            } else if (val == 'replace') {
                              _showReplaceTeacherDialog(p, dateStr);
                            } else if (val == 'delete') {
                              _handleDeletePeriod(p['id'] as int, dateStr);
                            }
                          },
                          itemBuilder: (ctx) => [
                            PopupMenuItem(
                              value: 'backup',
                              child: Row(
                                children: const [
                                  Icon(Icons.person_add_alt_1_outlined, size: 18),
                                  SizedBox(width: 10),
                                  Text('Assign Backup Teacher', style: TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                            PopupMenuItem(
                              value: 'replace',
                              child: Row(
                                children: const [
                                  Icon(Icons.swap_horiz_rounded, size: 18),
                                  SizedBox(width: 10),
                                  Text('Replace Teacher', style: TextStyle(fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                            PopupMenuItem(
                              value: 'delete',
                              child: Row(
                                children: [
                                  Icon(Icons.delete_outline_rounded, size: 18, color: Colors.red.shade700),
                                  const SizedBox(width: 10),
                                  Text('Delete Period', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red.shade700)),
                                ],
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                );
              },
            ),

          const SizedBox(height: 20),

          // Requirement 9: Back date lock condition (Matching Screenshot 3)
          if (isHoliday)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.lock_outline_rounded, size: 16, color: Color(0xFF64748B)),
                  SizedBox(width: 8),
                  Text(
                    'School Holiday – Timetable cannot be created for this date.',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          else if (isPastDay)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.lock_outline_rounded, size: 16, color: Color(0xFF64748B)),
                  SizedBox(width: 8),
                  Text(
                    'Schedule locked (Past day)',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          else ...[
            // Add Period Inline Form (Requirement 2 & 3: Dropdowns open downward with curved corners)
            if (hasAvailableSlot) ...[
              Row(
                children: [
                  // Subject Dropdown
                  Expanded(
                    child: _buildDropdownAnchor<int>(
                      context: context,
                      hint: 'Select Subject',
                      value: currentSubId,
                      displayText: currentSubName,
                      items: availableSubjects.map((s) {
                        return DropdownMenuItemModel<int>(
                          value: s['id'] as int,
                          label: s['name'] ?? '',
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedSubjectIdPerDay[dayName] = val;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Teacher Dropdown
                  Expanded(
                    child: _buildDropdownAnchor<int>(
                      context: context,
                      hint: 'Select Teacher',
                      value: currentTeacherId,
                      displayText: currentTeacherName,
                      items: availableTeachers.map((t) {
                        return DropdownMenuItemModel<int>(
                          value: t['id'] as int,
                          label: t['name'] ?? '',
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedTeacherIdPerDay[dayName] = val;
                        });
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // + Add Period Button
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC26600), // Rich amber as in Screenshot 2
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: () => _handleAddPeriod(dayName),
                  icon: const Icon(Icons.add, size: 18, color: Colors.white),
                  label: const Text(
                    'Add Period',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Publish Button
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFC26600),
                  disabledBackgroundColor: const Color(0xFFE2B77B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: (isPublished || periodsList.isEmpty)
                    ? null
                    : () => _handlePublishDay(dayName, dateStr),
                child: Text(
                  isPublished ? 'Published' : 'Publish',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 48),
            const SizedBox(height: 12),
            Text(
              _errorText,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _initData,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFC26600),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Retry', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
