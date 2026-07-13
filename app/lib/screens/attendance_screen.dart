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
  late int _studentTotalDays;
  late PageController _studentPageController;
  int _studentCurrentPageIndex = 0;
  DateTime? _studentSelectedDate;
  String _selectedMonthYear = ''; // e.g. "July 2026"
  List<String> _selectableMonths = [];

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
      _studentTotalDays = _studentToday.difference(_academicYearStart).inDays + 1;
      _studentCurrentPageIndex = _studentTotalDays - 1;
      _studentSelectedDate = _studentToday;
      _studentPageController = PageController(initialPage: _studentCurrentPageIndex);

      // Generate selectable months from academic year start to current month
      _generateSelectableMonths();
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
      _studentPageController.dispose();
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
    final dateStr = date.toIso8601String().split('T')[0];
    final match = _studentRecords.firstWhere(
      (rec) => rec['date'] == dateStr,
      orElse: () => null,
    );
    if (match != null) {
      return match['status'] as String;
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

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isTeacher ? 'Mark Attendance' : 'Attendance',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
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
          
          Expanded(
            child: isTeacher ? _buildTeacherView() : _buildStudentView(),
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------------
  // STUDENT VIEW BUILDERS
  // -----------------------------------------------------------------------------
  Widget _buildStudentView() {
    if (_isLoadingStudent) {
      return const Center(child: CircularProgressIndicator());
    }

    final monthStats = _calculateStatsForMonth(_selectedMonthYear);
    final overallStats = _calculateOverallStats();

    return Column(
      children: [
        // Month Selector Dropdown
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedMonthYear,
                isExpanded: true,
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87, fontSize: 14),
                items: _selectableMonths.map((month) {
                  return DropdownMenuItem<String>(
                    value: month,
                    child: Text(month),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() {
                      _selectedMonthYear = val;
                    });
                  }
                },
              ),
            ),
          ),
        ),

        // Swipable Daily Card Area
        Expanded(
          flex: 2,
          child: PageView.builder(
            controller: _studentPageController,
            itemCount: _studentTotalDays,
            onPageChanged: (idx) {
              setState(() {
                _studentCurrentPageIndex = idx;
                _studentSelectedDate = _academicYearStart.add(Duration(days: idx));
                _selectedMonthYear = _getMonthYearKey(_studentSelectedDate!);
              });
            },
            itemBuilder: (context, index) {
              final date = _academicYearStart.add(Duration(days: index));
              final status = _getStudentStatusForDate(date);
              
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: Colors.grey.shade200),
                  ),
                  color: Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _formatDisplayDate(date),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey),
                        ),
                        const SizedBox(height: 20),
                        if (status.isNotEmpty) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                            decoration: BoxDecoration(
                              color: _getStatusColor(status).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(color: _getStatusColor(status).withOpacity(0.2)),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 18, 
                                fontWeight: FontWeight.w900, 
                                color: _getStatusColor(status),
                              ),
                            ),
                          ),
                        ] else ...[
                          const Icon(Icons.help_outline_rounded, size: 48, color: Colors.grey),
                          const SizedBox(height: 12),
                          const Text(
                            'Attendance not available yet.',
                            style: TextStyle(fontSize: 14, color: Colors.grey, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        // Monthly Summary Card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '$_selectedMonthYear Summary',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.black87),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.indigo.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Rate: ${monthStats['rate']}%',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.indigo),
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMiniStat('Present', '${monthStats['present']} Days', Colors.green),
                      _buildMiniStat('Absent', '${monthStats['absent']} Days', Colors.red),
                      _buildMiniStat('Leave', '${monthStats['leave']} Day', Colors.amber),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),

        // Overall Academic Year Card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            color: Colors.indigo.shade900,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Overall Academic Year',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Colors.white),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Rate: ${overallStats['rate']}%',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white),
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMiniStat('Present', '${overallStats['present']}', Colors.white, Colors.white70),
                      _buildMiniStat('Absent', '${overallStats['absent']}', Colors.white, Colors.white70),
                      _buildMiniStat('Leave', '${overallStats['leave']}', Colors.white, Colors.white70),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildMiniStat(String label, String value, Color valueColor, [Color? labelColor]) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: valueColor),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: labelColor ?? Colors.grey.shade600),
        ),
      ],
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
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue.shade700,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
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
                                '📅 No Attendance Required',
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

                        final isEditable = !_isSubmittedForSelectedDate;
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
        if (_teacherSelectedDate != null && 
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.blue.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.blue.shade200),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: 14, color: Colors.blue.shade700),
            const SizedBox(width: 4),
            Text(
              'Attendance Submitted',
              style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold, fontSize: 10),
            ),
          ],
        ),
      );
    }

    final isSelectedDateToday = _teacherSelectedDate != null &&
        _teacherSelectedDate!.day == _teacherToday.day &&
        _teacherSelectedDate!.month == _teacherToday.month &&
        _teacherSelectedDate!.year == _teacherToday.year;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isSelectedDateToday ? Colors.amber.shade50 : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isSelectedDateToday ? Colors.amber.shade200 : Colors.grey.shade300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isSelectedDateToday ? Icons.pending_actions_rounded : Icons.lock_outline_rounded,
            size: 14,
            color: isSelectedDateToday ? Colors.amber.shade800 : Colors.grey.shade600,
          ),
          const SizedBox(width: 4),
          Text(
            isSelectedDateToday ? 'Pending Submission' : 'Read Only',
            style: TextStyle(
              color: isSelectedDateToday ? Colors.amber.shade800 : Colors.grey.shade600,
              fontWeight: FontWeight.bold,
              fontSize: 10,
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
