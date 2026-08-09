import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import '../services/attendance_service.dart';

class AttendanceScreen extends StatefulWidget {
  final AttendanceService attendanceService;
  final String userRole; // 'PARENT' or 'STUDENT' or 'TEACHER'
  final int? selectedStudentId; // Relevant for PARENT role

  const AttendanceScreen({
    Key? key,
    required this.attendanceService,
    required this.userRole,
    this.selectedStudentId,
  }) : super(key: key);

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  // Common States
  bool _isOffline = false;
  Timer? _offlineRetryTimer;

  // Student States
  List<dynamic> _studentRecords = [];
  bool _isLoadingStudent = true;
  late DateTime _studentToday;
  late DateTime _academicYearStart;
  late PageController _studentMonthPageController;
  int _studentMonthPageIndex = 500;

  // Teacher States
  List<dynamic> _classes = [];
  int? _selectedClassId;
  String _selectedClassName = '';
  List<dynamic> _students = [];
  List<dynamic> _markedHistory = [];
  Map<int, String> _tempAttendance = {}; // studentId -> status ('Present' | 'Absent' | 'Leave')
  bool _isLoadingTeacherData = false;
  bool _isTeacherSubmitting = false;
  bool _isSubmittedForSelectedDate = false;
  bool _isLoadingAttendanceForDate = false;
  late DateTime _teacherToday;
  late DateTime _teacherAcademicYearStart;
  late int _teacherTotalDays;
  late PageController _teacherPageController;
  int _teacherCurrentPageIndex = 0;
  DateTime? _teacherSelectedDate;
  List<dynamic> _holidays = [];
  int? _highlightedStudentId;
  final ScrollController _teacherListScrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();

    // Determine Academic Year Bounds (April 1st to March 31st)
    DateTime ayStart;
    if (now.month >= 4) {
      ayStart = DateTime(now.year, 4, 1);
    } else {
      ayStart = DateTime(now.year - 1, 4, 1);
    }

    if (widget.userRole.toUpperCase() == 'TEACHER') {
      _teacherToday = DateTime(now.year, now.month, now.day);
      _teacherAcademicYearStart = ayStart;
      _teacherTotalDays = _teacherToday.difference(_teacherAcademicYearStart).inDays + 1;
      _teacherCurrentPageIndex = _teacherTotalDays - 1;
      _teacherSelectedDate = _teacherToday;
      _teacherPageController = PageController(initialPage: _teacherCurrentPageIndex);

      _loadTeacherData();
    } else {
      _studentToday = DateTime(now.year, now.month, now.day);
      _academicYearStart = ayStart;
      _studentMonthPageIndex = 500;
      _studentMonthPageController = PageController(initialPage: 500);

      _loadStudentData();
    }

    // Auto-retry connection timer
    _offlineRetryTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_isOffline) {
        if (widget.userRole.toUpperCase() == 'TEACHER') {
          if (_classes.isEmpty) {
            _loadTeacherData();
          } else {
            _fetchTeacherAttendanceForDate();
          }
        } else {
          _loadStudentData();
        }
      }
    });
  }

  @override
  void dispose() {
    _offlineRetryTimer?.cancel();
    if (widget.userRole.toUpperCase() == 'TEACHER') {
      _teacherPageController.dispose();
    } else {
      _studentMonthPageController.dispose();
    }
    super.dispose();
  }

  // -----------------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------------
  String _formatDisplayDate(DateTime date) {
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final day = date.day.toString().padLeft(2, '0');
    final month = months[date.month - 1];
    return '$day $month ${date.year}';
  }

  String _getMonthYearKey(DateTime date) {
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[date.month - 1]} ${date.year}';
  }

  void _generateSelectableMonths() {
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    List<String> list = [];
    DateTime current = DateTime(_academicYearStart.year, _academicYearStart.month, 1);
    final target = DateTime(_studentToday.year, _studentToday.month, 1);

    while (!current.isAfter(target)) {
      list.add('${months[current.month - 1]} ${current.year}');
      current = DateTime(current.year, current.month + 1, 1);
    }
    
    setState(() {
      _selectableMonths = list.reversed.toList();
      _selectedMonthYear = _getMonthYearKey(_studentToday);
    });
  }

  // -----------------------------------------------------------------------------
  // Student API Handlers
  // -----------------------------------------------------------------------------
  Future<void> _loadStudentData() async {
    setState(() {
      _isLoadingStudent = true;
    });

    try {
      final data = await widget.attendanceService.getStudentAttendance(widget.selectedStudentId);
      setState(() {
        _studentRecords = data;
        _isOffline = false;
      });
    } catch (e) {
      if (e is SocketException || e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')) {
        setState(() {
          _isOffline = true;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim())),
        );
      }
    } finally {
      setState(() {
        _isLoadingStudent = false;
      });
    }
  }

  // -----------------------------------------------------------------------------
  // Teacher API Handlers
  // -----------------------------------------------------------------------------
  Future<void> _loadTeacherData() async {
    setState(() {
      _isLoadingTeacherData = true;
      _isLoadingAttendanceForDate = true;
    });

    try {
      final classesList = await widget.attendanceService.getTeacherClasses();
      List<dynamic> holidaysList = [];
      try {
        holidaysList = await widget.attendanceService.getHolidays();
      } catch (he) {
        debugPrint('Error loading holidays: $he');
      }
      setState(() {
        _classes = classesList;
        _holidays = holidaysList;
        _isOffline = false;
      });
      if (classesList.isNotEmpty) {
        _selectedClassId = classesList[0]['id'];
        final firstClass = classesList[0];
        final section = firstClass['section'];
        _selectedClassName = (section != null && section.toString().isNotEmpty)
            ? '${firstClass['name']}-$section'
            : firstClass['name'];
        await _fetchTeacherStudentsAndHistory();
      }
    } catch (e) {
      if (e is SocketException || e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')) {
        setState(() {
          _isOffline = true;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim())),
        );
      }
    } finally {
      setState(() {
        _isLoadingTeacherData = false;
      });
    }
  }

  Future<void> _fetchTeacherStudentsAndHistory() async {
    if (_selectedClassId == null) return;
    setState(() {
      _isLoadingTeacherData = true;
      _isLoadingAttendanceForDate = true;
    });

    try {
      final studentsList = await widget.attendanceService.getTeacherStudents(_selectedClassId!);
      setState(() {
        _students = studentsList;
        _tempAttendance.clear();
      });
      await _fetchTeacherAttendanceForDate();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim())),
      );
    } finally {
      setState(() {
        _isLoadingTeacherData = false;
      });
    }
  }

  Future<void> _fetchTeacherAttendanceForDate() async {
    if (_selectedClassId == null || _teacherSelectedDate == null) return;
    final dateStr = _teacherSelectedDate!.toIso8601String().split('T')[0];

    try {
      final history = await widget.attendanceService.getTeacherAttendanceHistory(_selectedClassId!, dateStr);
      setState(() {
        _markedHistory = history;
        _isSubmittedForSelectedDate = history.isNotEmpty;
        _isOffline = false;

        // If already submitted, map status
        if (_isSubmittedForSelectedDate) {
          for (var record in history) {
            final sId = record['student_id'] as int;
            final status = record['status'] as String;
            _tempAttendance[sId] = status;
          }
        } else {
          // If not submitted, clear temp marking
          _tempAttendance.clear();
        }
      });
    } catch (e) {
      if (e is SocketException || e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')) {
        setState(() {
          _isOffline = true;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception:', '').trim())),
        );
      }
    } finally {
      setState(() {
        _isLoadingAttendanceForDate = false;
      });
    }
  }

  Future<void> _submitAttendance() async {
    // Validations
    if (_selectedClassId == null || _teacherSelectedDate == null) return;

    // Check for unmarked students
    for (int i = 0; i < _students.length; i++) {
      final s = _students[i];
      final sId = s['id'] as int;
      if (!_tempAttendance.containsKey(sId) || _tempAttendance[sId] == null) {
        final sName = s['name'] ?? 'Student';
        
        setState(() {
          _highlightedStudentId = sId;
        });

        if (_teacherListScrollController.hasClients) {
          _teacherListScrollController.animateTo(
            i * 82.0,
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeInOut,
          );
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Please mark attendance for $sName'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade700,
          ),
        );

        // Reset highlight after 3 seconds
        Timer(const Duration(seconds: 3), () {
          if (mounted) {
            setState(() {
              if (_highlightedStudentId == sId) {
                _highlightedStudentId = null;
              }
            });
          }
        });

        return;
      }
    }

    setState(() {
      _isTeacherSubmitting = true;
    });

    final dateStr = _teacherSelectedDate!.toIso8601String().split('T')[0];

    try {
      // Mark attendance sequentially / concurrently for all students in sheet
      List<Future<void>> markFutures = [];
      _tempAttendance.forEach((studentId, status) {
        markFutures.add(
          widget.attendanceService.markTeacherAttendance(
            studentId: studentId,
            classId: _selectedClassId!,
            dateYyyyMmDd: dateStr,
            status: status,
          )
        );
      });

      await Future.wait(markFutures);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attendance Submitted'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.green,
        ),
      );

      // Refresh data
      await _fetchTeacherAttendanceForDate();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception:', '').trim()),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isTeacherSubmitting = false;
      });
    }
  }

  // -----------------------------------------------------------------------------
  // Student calculations helper
  // -----------------------------------------------------------------------------
  Map<String, dynamic> _calculateStatsForMonth(String monthYearKey) {
    int present = 0;
    int absent = 0;
    int leave = 0;

    for (var rec in _studentRecords) {
      final dateStr = rec['date'] as String; // YYYY-MM-DD
      try {
        final parsed = DateTime.parse(dateStr);
        final key = _getMonthYearKey(parsed);
        if (key == monthYearKey) {
          final status = (rec['status'] as String).toLowerCase();
          if (status == 'present') present++;
          if (status == 'absent') absent++;
          if (status == 'leave') leave++;
        }
      } catch (_) {}
    }

    final total = present + absent + leave;
    final rate = total > 0 ? ((present / total) * 100).round() : 0;

    return {
      'present': present,
      'absent': absent,
      'leave': leave,
      'total': total,
      'rate': rate,
    };
  }

  Map<String, dynamic> _calculateOverallStats() {
    int present = 0;
    int absent = 0;
    int leave = 0;

    for (var rec in _studentRecords) {
      final status = (rec['status'] as String).toLowerCase();
      if (status == 'present') present++;
      if (status == 'absent') absent++;
      if (status == 'leave') leave++;
    }

    final total = present + absent + leave;
    final rate = total > 0 ? ((present / total) * 100).round() : 0;

    return {
      'present': present,
      'absent': absent,
      'leave': leave,
      'total': total,
      'rate': rate,
    };
  }

  String _getStudentStatusForDate(DateTime date) {
    final year = date.year.toString();
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final targetDateStr = '$year-$month-$day';

    for (var rec in _studentRecords) {
      final recDate = rec['date'] as String?;
      if (recDate != null && recDate.startsWith(targetDateStr)) {
        return rec['status'] as String? ?? '';
      }
    }
    return '';
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PRESENT':
        return Colors.green;
      case 'ABSENT':
        return Colors.red;
      case 'LEAVE':
        return Colors.amber;
      default:
        return Colors.grey;
    }
  }

  // -----------------------------------------------------------------------------
  // BUILD METHOD
  // -----------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    final isTeacher = widget.userRole.toUpperCase() == 'TEACHER';

    if (!isTeacher) {
      return _buildStudentView();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Mark Attendance',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
        ),
        centerTitle: false,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_rounded, size: 20),
            onPressed: () => _openCalendarPicker(context, isTeacher),
          ),
        ],
      ),
      body: Column(
        children: [
          // Offline Banner
          if (_isOffline)
            Container(
              color: Colors.red.shade600,
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.wifi_off_rounded, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'No internet connection. Retrying...',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

          Expanded(child: _buildTeacherView()),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------------
  // STUDENT VIEW BUILDERS (Matching Reference Image Design)
  // -----------------------------------------------------------------------------
  Widget _buildStudentView() {
    if (_isLoadingStudent) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: const Text('Monthly Attendance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
          backgroundColor: const Color(0xFF2196F3),
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final currentMonth = DateTime(
      _studentToday.year,
      _studentToday.month + (_studentMonthPageIndex - 500),
      1,
    );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Monthly Attendance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
        backgroundColor: const Color(0xFF2196F3),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(
        children: [
          if (_isOffline)
            Container(
              color: Colors.red.shade600,
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.wifi_off_rounded, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Text(
                    'No internet connection. Retrying...',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),

          // 1. Top Summary Stats Card (Total Present, Total Absent, Total Leaves, Total Working Days)
          _buildStudentSummaryStats(currentMonth),

          // 2. Month Navigation Control Bar (< Today Month Year 📅 >)
          _buildMonthNavigationBar(currentMonth),

          // 3. Swipable Calendar Grid View (Horizontal Left/Right Swipe Support)
          Expanded(
            child: PageView.builder(
              controller: _studentMonthPageController,
              itemCount: 1000,
              onPageChanged: (idx) {
                setState(() {
                  _studentMonthPageIndex = idx;
                });
              },
              itemBuilder: (context, index) {
                final pageMonth = DateTime(
                  _studentToday.year,
                  _studentToday.month + (index - 500),
                  1,
                );
                return _buildMonthCalendarGrid(pageMonth);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStudentSummaryStats(DateTime month) {
    int presentCount = 0;
    int absentCount = 0;
    int leaveCount = 0;

    for (var rec in _studentRecords) {
      final dateStr = rec['date'] as String?;
      if (dateStr != null) {
        try {
          final dt = DateTime.parse(dateStr);
          if (dt.year == month.year && dt.month == month.month) {
            final status = (rec['status'] as String? ?? '').toUpperCase();
            if (status == 'PRESENT') presentCount++;
            else if (status == 'ABSENT') absentCount++;
            else if (status == 'LEAVE') leaveCount++;
          }
        } catch (_) {}
      }
    }

    final totalWorkingDays = presentCount + absentCount + leaveCount;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildStatRow('Total Present', '$presentCount', const Color(0xFF4CAF50)),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Divider(height: 1, color: Color(0xFFEEEEEE)),
          ),
          _buildStatRow('Total Absent', '$absentCount', const Color(0xFFF44336)),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Divider(height: 1, color: Color(0xFFEEEEEE)),
          ),
          _buildStatRow('Total Leaves', '$leaveCount', const Color(0xFFFF9800)),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Divider(height: 1, color: Color(0xFFEEEEEE)),
          ),
          _buildStatRow('Total Working Days', '$totalWorkingDays', const Color(0xFF2196F3)),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildMonthNavigationBar(DateTime month) {
    final monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    final monthStr = '${monthNames[month.month - 1]} ${month.year}';

    return Container(
      color: const Color(0xFF2196F3),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 28),
                onPressed: () {
                  _studentMonthPageController.previousPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
              ),
              InkWell(
                onTap: () {
                  _studentMonthPageController.animateToPage(
                    500,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(
                    'Today',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                monthStr,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 20),
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: month,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2030),
                  );
                  if (picked != null) {
                    final targetMonth = DateTime(picked.year, picked.month, 1);
                    final baseMonth = DateTime(_studentToday.year, _studentToday.month, 1);
                    final diffInMonths = (targetMonth.year - baseMonth.year) * 12 + (targetMonth.month - baseMonth.month);
                    _studentMonthPageController.animateToPage(
                      500 + diffInMonths,
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                },
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 28),
                onPressed: () {
                  _studentMonthPageController.nextPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMonthCalendarGrid(DateTime month) {
    final weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    final firstDayOfMonth = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final startOffset = firstDayOfMonth.weekday % 7; // 0 for Sun, 1 for Mon, ..., 6 for Sat
    final prevMonthLastDay = DateTime(month.year, month.month, 0).day;
    final totalGridItems = ((startOffset + daysInMonth) > 35) ? 42 : 35;

    return Column(
      children: [
        // Days of week header
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: weekDays.map((day) {
              return Expanded(
                child: Text(
                  day,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: Colors.grey.shade800,
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const Divider(height: 1, color: Color(0xFFE0E0E0)),
        // Calendar Grid
        Expanded(
          child: GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 0.85,
            ),
            itemCount: totalGridItems,
            itemBuilder: (context, index) {
              int dayNumber;
              bool isCurrentMonth = false;
              DateTime cellDate;

              if (index < startOffset) {
                dayNumber = prevMonthLastDay - (startOffset - 1 - index);
                cellDate = DateTime(month.year, month.month - 1, dayNumber);
              } else if (index < startOffset + daysInMonth) {
                dayNumber = index - startOffset + 1;
                isCurrentMonth = true;
                cellDate = DateTime(month.year, month.month, dayNumber);
              } else {
                dayNumber = index - (startOffset + daysInMonth) + 1;
                cellDate = DateTime(month.year, month.month + 1, dayNumber);
              }

              final isToday = cellDate.year == _studentToday.year &&
                  cellDate.month == _studentToday.month &&
                  cellDate.day == _studentToday.day;

              final status = isCurrentMonth ? _getStudentStatusForDate(cellDate) : '';

              return Container(
                decoration: BoxDecoration(
                  color: isToday ? Colors.blue.shade50.withOpacity(0.4) : Colors.white,
                  border: Border.all(
                    color: isToday ? const Color(0xFF2196F3) : Colors.grey.shade300,
                    width: isToday ? 1.5 : 0.5,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    const SizedBox(height: 4),
                    Text(
                      '$dayNumber',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isToday || isCurrentMonth ? FontWeight.bold : FontWeight.normal,
                        color: isCurrentMonth
                            ? (isToday ? const Color(0xFF2196F3) : Colors.black87)
                            : Colors.grey.shade400,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (isCurrentMonth && status.isNotEmpty) ...[
                      _buildStatusBadge(status),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    String text;
    final st = status.toUpperCase();

    if (st == 'PRESENT') {
      bg = const Color(0xFF4CAF50);
      text = 'P';
    } else if (st == 'ABSENT') {
      bg = const Color(0xFFF44336);
      text = 'A';
    } else if (st == 'LEAVE') {
      bg = const Color(0xFFFF9800);
      text = 'L';
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 11,
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------------
  // TEACHER VIEW BUILDERS
  // -----------------------------------------------------------------------------
  Widget _buildTeacherView() {
    if (_isLoadingTeacherData) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_classes.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.assignment_ind_rounded,
                  size: 70,
                  color: Colors.blue.shade700,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Class Assigned',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You have not been assigned as a class teacher yet. Please contact the administrator to assign you to a class.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.blue.shade700, width: 1.5),
                        foregroundColor: Colors.blue.shade700,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () {
                        Navigator.of(context).pop();
                      },
                      child: const Text(
                        'Back',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue.shade700,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () {
                        _loadTeacherData();
                      },
                      child: const Text(
                        'Refresh',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // Class Selector dropdown + Info row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: _classes.length <= 1
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.blue.shade100),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.class_rounded, color: Colors.blue.shade700, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              _selectedClassName,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade900,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _selectedClassId,
                            isExpanded: true,
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 14),
                            items: _classes.map((cls) {
                              return DropdownMenuItem<int>(
                                value: cls['id'] as int,
                                child: Text(
                                  (cls['section'] != null && cls['section'].toString().isNotEmpty)
                                      ? '${cls['name']}-${cls['section']}'
                                      : cls['name'],
                                ),
                              );
                            }).toList(),
                            onChanged: _isLoadingTeacherData ? null : (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedClassId = val;
                                  final matched = _classes.firstWhere((c) => c['id'] == val);
                                  final sec = matched['section'];
                                  _selectedClassName = (sec != null && sec.toString().isNotEmpty)
                                      ? '${matched['name']}-$sec'
                                      : matched['name'];
                                });
                                _fetchTeacherStudentsAndHistory();
                              }
                            },
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              // Status Badge
              _buildTeacherStatusBadge(),
            ],
          ),
        ),

        // Swipable Days Page Area for teacher
        Expanded(
          child: PageView.builder(
            controller: _teacherPageController,
            itemCount: _teacherTotalDays,
            onPageChanged: (idx) {
              setState(() {
                _teacherCurrentPageIndex = idx;
                _teacherSelectedDate = _teacherAcademicYearStart.add(Duration(days: idx));
                _isLoadingAttendanceForDate = true;
              });
              _fetchTeacherAttendanceForDate();
            },
            itemBuilder: (context, index) {
              final date = _teacherAcademicYearStart.add(Duration(days: index));
              final isSelectedDateToday = date.day == _teacherToday.day && date.month == _teacherToday.month && date.year == _teacherToday.year;
              final isSunday = date.weekday == DateTime.sunday;
              final dateStr = date.toIso8601String().split('T')[0];
              final isHoliday = _holidays.any((h) => h['date'] == dateStr);

              if (_isLoadingTeacherData) {
                return const Center(child: CircularProgressIndicator());
              }

              if (isSunday || isHoliday) {
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        _formatDisplayDate(date) + (isSelectedDateToday ? ' (Today)' : ''),
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey),
                      ),
                    ),
                    Expanded(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade50,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.calendar_today_rounded,
                                  size: 48,
                                  color: Colors.amber.shade800,
                                ),
                              ),
                              const SizedBox(height: 24),
                              const Text(
                                'No Attendance Required',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Attendance is not required for the selected date because it is a scheduled holiday or weekend.\n\nPlease choose another working day to mark student attendance.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.grey.shade600,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }

              if (_students.isEmpty) {
                return const Center(
                  child: Text(
                    'No active students found in this class.',
                    style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
                  ),
                );
              }

              return Column(
                children: [
                  // Heading showing Swipe date
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      _formatDisplayDate(date) + (isSelectedDateToday ? ' (Today)' : ''),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.grey),
                    ),
                  ),
                  
                  Expanded(
                    child: ListView.builder(
                      controller: _teacherListScrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _students.length,
                      itemBuilder: (context, idx) {
                        final student = _students[idx];
                        final sId = student['id'] as int;
                        final rollNo = student['roll_no'] ?? student['roll_number'] ?? '—';
                        final sName = student['name'] ?? '';
                        final currentMark = _tempAttendance[sId];

                        final isEditable = !_isSubmittedForSelectedDate && !_isLoadingAttendanceForDate;
                        final isHighlighted = sId == _highlightedStudentId;

                        return Container(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isHighlighted ? Colors.red.shade50 : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isHighlighted
                                ? Colors.red
                                : (currentMark != null 
                                    ? _getStatusColor(currentMark).withOpacity(0.3) 
                                    : Colors.grey.shade200),
                              width: isHighlighted ? 2.5 : (currentMark != null ? 1.5 : 1.0),
                            ),
                          ),
                          child: Row(
                            children: [
                              // Roll & Name block
                              Expanded(
                                flex: 2,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Roll No. $rollNo',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      sName,
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.black87),
                                    ),
                                  ],
                                ),
                              ),
                              
                              // Segmented Controls (Radio buttons design chip style)
                              Expanded(
                                flex: 3,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    _buildStatusChip('Present', 'Present', sId, isEditable),
                                    const SizedBox(width: 4),
                                    _buildStatusChip('Absent', 'Absent', sId, isEditable),
                                    const SizedBox(width: 4),
                                    _buildStatusChip('Leave', 'Leave', sId, isEditable),
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
              );
            },
          ),
        ),

        // Submit Button (only for past/today if not already submitted, and not Sunday/holiday)
        if (!_isLoadingAttendanceForDate &&
            _teacherSelectedDate != null && 
            !_teacherSelectedDate!.isAfter(_teacherToday) && 
            !_isSubmittedForSelectedDate && 
            _students.isNotEmpty &&
            _teacherSelectedDate!.weekday != DateTime.sunday &&
            !_holidays.any((h) => h['date'] == _teacherSelectedDate!.toIso8601String().split('T')[0]))
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isTeacherSubmitting ? null : _submitAttendance,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _isTeacherSubmitting
                    ? const CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(Colors.white))
                    : const Text(
                        'Submit Attendance',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                      ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildStatusChip(String label, String value, int studentId, bool isEditable) {
    final isSelected = _tempAttendance[studentId] == value;
    final color = _getStatusColor(value);

    return InkWell(
      onTap: isEditable 
          ? () {
              setState(() {
                _tempAttendance[studentId] = value;
              });
            }
          : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.12) : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade300,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label[0], // P / A / L
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 12,
            color: isSelected ? color : Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  Widget _buildTeacherStatusBadge() {
    if (_isSubmittedForSelectedDate) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.blue.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: 16, color: Colors.blue.shade700),
            const SizedBox(width: 6),
            Text(
              'Attendance Submitted',
              style: TextStyle(
                color: Colors.blue.shade700,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.pending_actions_rounded,
            size: 16,
            color: Colors.amber.shade800,
          ),
          const SizedBox(width: 6),
          Text(
            'Attendance Pending',
            style: TextStyle(
              color: Colors.amber.shade800,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------------
  // Calendar Dialog Picker
  // -----------------------------------------------------------------------------
  Future<void> _openCalendarPicker(BuildContext context, bool isTeacher) async {
    final DateTime initial = isTeacher ? _teacherSelectedDate! : _studentSelectedDate!;
    final DateTime startLimit = isTeacher ? _teacherAcademicYearStart : _academicYearStart;
    final DateTime endLimit = isTeacher ? _teacherToday : _studentToday;

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: startLimit,
      lastDate: endLimit,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Colors.indigo,
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      if (isTeacher) {
        final page = picked.difference(_teacherAcademicYearStart).inDays;
        _teacherPageController.jumpToPage(page);
      } else {
        final page = picked.difference(_academicYearStart).inDays;
        _studentPageController.jumpToPage(page);
      }
    }
  }
}
