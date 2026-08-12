import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/timetable_service.dart';

class TimetableScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? selectedStudentId;
  final DateTime? targetDate;

  const TimetableScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.selectedStudentId,
    this.targetDate,
  }) : super(key: key);

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  late TimetableService _service;
  late DateTime _selectedDate;
  final ScrollController _scrollController = ScrollController();
  
  List<dynamic> _periods = [];
  List<dynamic> _holidays = [];
  bool _isLoading = true;
  bool _isOffline = false;
  String _errorText = '';

  // Stats for Teacher
  int _totalPeriods = 0;
  int _completedPeriods = 0;
  int _remainingPeriods = 0;

  @override
  void initState() {
    super.initState();
    _service = TimetableService(baseUrl: widget.baseUrl, token: widget.token);
    _selectedDate = widget.targetDate ?? DateTime.now();
    // If target day is Sunday, default to Monday
    if (_selectedDate.weekday == DateTime.sunday) {
      _selectedDate = _selectedDate.add(const Duration(days: 1));
    }
    _loadSchedule();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  String _getWeekdayName(int weekday) {
    switch (weekday) {
      case DateTime.monday: return 'Monday';
      case DateTime.tuesday: return 'Tuesday';
      case DateTime.wednesday: return 'Wednesday';
      case DateTime.thursday: return 'Thursday';
      case DateTime.friday: return 'Friday';
      case DateTime.saturday: return 'Saturday';
      case DateTime.sunday: return 'Sunday';
      default: return '';
    }
  }

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (month >= 1 && month <= 12) {
      return months[month - 1];
    }
    return '';
  }

  String _formatDateYYYYMMDD(DateTime date) {
    final year = date.year;
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  String _formatDateFriendly(DateTime date) {
    final day = date.day;
    final month = _getMonthName(date.month);
    final year = date.year;
    return '$day $month $year';
  }

  Future<void> _loadSchedule() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    final dateStr = _formatDateYYYYMMDD(_selectedDate);

    try {
      try {
        final list = await _service.getHolidays();
        _holidays = list;
      } catch (_) {}

      final roleUpper = widget.userRole.toUpperCase();
      if (roleUpper == 'PARENT' || roleUpper == 'STUDENT') {
        final res = await _service.getStudentTimetable(
          studentId: widget.selectedStudentId,
          date: dateStr,
        );
        if (mounted) {
          setState(() {
            _periods = res['data'] ?? [];
            _isOffline = res['isOffline'] ?? false;
            _isLoading = false;
          });
        }
      } else {
        // Teacher
        final prefs = await SharedPreferences.getInstance();
        final userId = prefs.getInt('user_id') ?? 0;
        final res = await _service.getTeacherSchedule(
          teacherId: userId,
          date: dateStr,
        );
        if (mounted) {
          setState(() {
            _periods = res['data'] ?? [];
            _isOffline = res['isOffline'] ?? false;
            _calculateTeacherStats();
            _isLoading = false;
          });

          // Auto scroll to current period if today is selected
          _scrollToCurrentPeriod();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorText = 'Failed to load timetable. Please check connection.';
          _isLoading = false;
        });
      }
    }
  }

  void _calculateTeacherStats() {
    int total = 0;
    int completed = 0;
    int remaining = 0;

    final now = DateTime.now();
    final todayStr = _formatDateYYYYMMDD(now);
    final selectedStr = _formatDateYYYYMMDD(_selectedDate);
    final isToday = selectedStr == todayStr;

    for (var p in _periods) {
      if (p['is_free'] == true) continue;
      total++;

      final status = _getPeriodStatus(p['start_time'], p['end_time'], isToday, _selectedDate, now);
      if (status == 'Completed') {
        completed++;
      } else {
        remaining++;
      }
    }

    _totalPeriods = total;
    _completedPeriods = completed;
    _remainingPeriods = remaining;
  }

  void _scrollToCurrentPeriod() {
    if (_periods.isEmpty) return;
    
    final now = DateTime.now();
    final todayStr = _formatDateYYYYMMDD(now);
    final selectedStr = _formatDateYYYYMMDD(_selectedDate);
    if (selectedStr != todayStr) return;

    int currentIndex = -1;
    for (int i = 0; i < _periods.length; i++) {
      final p = _periods[i];
      if (p['is_free'] == true) continue;
      final status = _getPeriodStatus(p['start_time'], p['end_time'], true, _selectedDate, now);
      if (status == 'Current') {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex != -1) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          final targetOffset = currentIndex * 125.0;
          _scrollController.animateTo(
            targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeInOut,
          );
        }
      });
    }
  }

  String _getPeriodStatus(
    dynamic startTime,
    dynamic endTime,
    bool isToday,
    DateTime selectedDate,
    DateTime now,
  ) {
    if (startTime == null || endTime == null) return 'Upcoming';

    // If it's a past day, all are completed
    if (selectedDate.isBefore(DateTime(now.year, now.month, now.day))) {
      return 'Completed';
    }
    // If it's a future day, all are upcoming
    if (selectedDate.isAfter(DateTime(now.year, now.month, now.day))) {
      return 'Upcoming';
    }

    try {
      final startParts = startTime.toString().split(':');
      final endParts = endTime.toString().split(':');

      final startMin = int.parse(startParts[0]) * 60 + int.parse(startParts[1]);
      final endMin = int.parse(endParts[0]) * 60 + int.parse(endParts[1]);
      final currentMin = now.hour * 60 + now.minute;

      if (currentMin > endMin) {
        return 'Completed';
      } else if (currentMin >= startMin && currentMin <= endMin) {
        return 'Current';
      } else {
        return 'Upcoming';
      }
    } catch (e) {
      return 'Upcoming';
    }
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
    } catch (e) {
      return timeStr.toString();
    }
  }

  void _onSwipe(DragEndDetails details) {
    if (details.primaryVelocity == null) return;
    if (details.primaryVelocity! < 0) {
      // Swipe Left -> Next Day
      _changeDate(1);
    } else if (details.primaryVelocity! > 0) {
      // Swipe Right -> Previous Day
      _changeDate(-1);
    }
  }

  void _changeDate(int offset) {
    DateTime target = _selectedDate.add(Duration(days: offset));
    if (target.weekday == DateTime.sunday) {
      target = target.add(Duration(days: offset > 0 ? 1 : -1));
    }
    setState(() {
      _selectedDate = target;
    });
    _loadSchedule();
  }

  void _selectWeekday(int index) {
    final currentDayOfWeek = _selectedDate.weekday; // Mon=1, Sat=6
    final targetDayOfWeek = index + 1; // index 0 = Mon (1)
    final diff = targetDayOfWeek - currentDayOfWeek;
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: diff));
    });
    _loadSchedule();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      selectableDayPredicate: (date) => date.weekday != DateTime.sunday,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: Colors.indigo.shade800,
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
      _loadSchedule();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTeacher = widget.userRole.toUpperCase() == 'TEACHER';
    final now = DateTime.now();
    final isTodaySelected = _formatDateYYYYMMDD(now) == _formatDateYYYYMMDD(_selectedDate);
    final dateStr = _formatDateYYYYMMDD(_selectedDate);
    final isHoliday = _holidays.any((h) => h['date'] == dateStr);
    final isSunday = _selectedDate.weekday == DateTime.sunday;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isTeacher ? "Today's Schedule" : "Today's Timetable",
          style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white),
        ),
        backgroundColor: Colors.indigo.shade800,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_rounded, color: Colors.white),
            onPressed: _pickDate,
          ),
        ],
      ),
      body: Column(
        children: [
          // Weekly Nav Row
          Container(
            color: Colors.indigo.shade800,
            padding: const EdgeInsets.only(bottom: 12, left: 8, right: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(6, (index) {
                final dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index];
                // Check if this weekday matches current selected date
                final isSelected = _selectedDate.weekday == (index + 1);

                return InkWell(
                  onTap: () => _selectWeekday(index),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      dayShort,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.indigo.shade900 : Colors.white70,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          // Date display bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getWeekdayName(_selectedDate.weekday),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDateFriendly(_selectedDate),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
                if (isTodaySelected)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'TODAY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Colors.indigo,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Offline Banner
          if (_isOffline)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              color: Colors.amber.shade700,
              child: Row(
                children: const [
                  Icon(Icons.wifi_off_rounded, size: 16, color: Colors.white),
                  SizedBox(width: 8),
                  Text(
                    'Offline Mode. Showing last synced timetable.',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),

          // Teacher Summary Card
          if (isTeacher && _periods.isNotEmpty && !_isLoading && _errorText.isEmpty)
            _buildTeacherSummaryCard(),

          // Main List
          Expanded(
            child: RefreshIndicator(
              color: Colors.indigo,
              onRefresh: _loadSchedule,
              child: GestureDetector(
                onHorizontalDragEnd: _onSwipe,
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Colors.indigo))
                    : _errorText.isNotEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [_buildErrorWidget()],
                          )
                        : (_periods.isEmpty || isHoliday || isSunday)
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [_buildEmptyStateWidget()],
                              )
                            : ListView.builder(
                                controller: _scrollController,
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                itemCount: _periods.length,
                                itemBuilder: (context, index) {
                                  final p = _periods[index];
                                  if (p['is_free'] == true) {
                                    return _buildFreePeriodCard(p);
                                  }
                                  return isTeacher 
                                      ? _buildTeacherPeriodCard(p, isTodaySelected, now)
                                      : _buildStudentPeriodCard(p);
                                },
                              ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeacherSummaryCard() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildSummaryItem('Today\'s Classes', _totalPeriods.toString(), Colors.black87),
          _buildSummaryItem('Completed', _completedPeriods.toString(), Colors.green.shade700),
          _buildSummaryItem('Remaining', _remainingPeriods.toString(), Colors.indigo.shade800),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(String label, String val, Color valColor) {
    return Column(
      children: [
        Text(
          val,
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: valColor),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey.shade500),
        ),
      ],
    );
  }

  Widget _buildStudentPeriodCard(dynamic p) {
    final isSub = p['is_substitute'] == true;
    final tName = p['teacher_name'] ?? 'No Teacher';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            // Period Number circle
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  'P${p['period_number']}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Colors.indigo.shade800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            // Middle Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          p['subject_name'] ?? 'No Subject',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                      if (isSub)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Substitute',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.person_outline, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        tName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: isSub ? Colors.amber.shade900 : Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.access_time_rounded, size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        '${_formatTime12Hr(p['start_time'])} – ${_formatTime12Hr(p['end_time'])}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildTeacherPeriodCard(dynamic p, bool isTodaySelected, DateTime now) {
    final status = _getPeriodStatus(p['start_time'], p['end_time'], isTodaySelected, _selectedDate, now);
    final isBackup = p['is_backup'] == true;
    final hasConflict = p['has_conflict'] == true;
    final isCurrent = status == 'Current';

    final className = p['class_name'] ?? '';
    final classSection = p['class_section'] ?? '';
    String classDisplay = classSection.isNotEmpty 
        ? '$className-$classSection' 
        : className;
    if (classDisplay.isNotEmpty && !classDisplay.toLowerCase().startsWith('class')) {
      classDisplay = 'Class $classDisplay';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: isCurrent ? const Color(0xFFEEF2FF) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCurrent ? Colors.indigo.shade600 : Colors.grey.shade200, 
          width: isCurrent ? 2 : 1,
        ),
        boxShadow: isCurrent 
            ? [
                BoxShadow(
                  color: Colors.indigo.shade800.withOpacity(0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isCurrent ? Colors.indigo.shade100 : Colors.indigo.shade50,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    'P${p['period_number']}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.indigo.shade800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p['subject_name'] ?? 'No Subject',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${_formatTime12Hr(p['start_time'])} – ${_formatTime12Hr(p['end_time'])}',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (classDisplay.isNotEmpty)
                    Text(
                      classDisplay,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Colors.indigo.shade800,
                      ),
                    ),
                  if (isBackup) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade100,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Backup',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          if (hasConflict) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 16, color: Colors.red.shade900),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Schedule Conflict. Please contact School Administration.',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFB71C1C),
                      ),
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

  Widget _buildFreePeriodCard(dynamic p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200, width: 1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    'P${p['period_number']}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Free Period',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${_formatTime12Hr(p['start_time'])} – ${_formatTime12Hr(p['end_time'])}',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Icon(Icons.coffee_rounded, size: 20, color: Colors.grey.shade400),
        ],
      ),
    );
  }

  Widget _buildEmptyStateWidget() {
    final dateStr = _formatDateYYYYMMDD(_selectedDate);
    final isHoliday = _holidays.any((h) => h['date'] == dateStr);
    final isSunday = _selectedDate.weekday == DateTime.sunday;

    String msg = 'No classes scheduled today.';
    IconData icon = Icons.schedule_rounded;

    if (isSunday) {
      msg = 'No timetable scheduled for today.';
      icon = Icons.calendar_today_rounded;
    } else if (isHoliday) {
      final hName = _holidays.firstWhere((h) => h['date'] == dateStr, orElse: () => null)?['name'] ?? 'School Holiday';
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.beach_access_rounded, size: 64, color: Colors.indigo.shade400),
              const SizedBox(height: 16),
              Text(
                hName,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'No periods are scheduled today.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            msg,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _errorText,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadSchedule,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo.shade800,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
