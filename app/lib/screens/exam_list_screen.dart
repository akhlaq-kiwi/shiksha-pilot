import 'package:flutter/material.dart';
import 'package:school_hub/services/exam_service.dart';
import 'package:school_hub/screens/exam_detail_screen.dart';

class ExamListScreen extends StatefulWidget {
  final ExamService examService;
  final String userRole;
  final int? selectedStudentId;

  const ExamListScreen({
    Key? key,
    required this.examService,
    required this.userRole,
    this.selectedStudentId,
  }) : super(key: key);

  @override
  _ExamListScreenState createState() => _ExamListScreenState();
}

class _ExamListScreenState extends State<ExamListScreen> {
  List<dynamic> _exams = [];
  List<dynamic> _assignedClasses = [];
  Map<String, dynamic>? _selectedClass;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  Future<void> _loadExams() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (widget.userRole == 'TEACHER') {
        final assigned = await widget.examService.getTeacherAssignedClasses();
        _assignedClasses = assigned;

        if (assigned.isEmpty) {
          setState(() {
            _errorMessage = 'You have no assigned class.';
            _isLoading = false;
          });
          return;
        }

        if (assigned.length == 1) {
          _selectedClass = assigned.first;
        }

        if (_selectedClass != null) {
          final int classId = _selectedClass!['id'];
          final data = await widget.examService.getExamsList(
            widget.userRole,
            widget.selectedStudentId,
            classId: classId,
          );
          setState(() {
            _exams = data;
            _isLoading = false;
          });
        } else {
          // Multiple assigned classes, show class selection list
          setState(() {
            _exams = [];
            _isLoading = false;
          });
        }
      } else {
        final data = await widget.examService.getExamsList(
          widget.userRole,
          widget.selectedStudentId,
        );
        setState(() {
          _exams = data;
          _isLoading = false;
        });
      }
    } catch (err) {
      setState(() {
        _errorMessage = err.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final monthsShort = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${date.day} ${monthsShort[date.month - 1]} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'UPCOMING':
        return Colors.indigo.shade600;
      case 'CURRENT':
        return Colors.green.shade600;
      case 'COMPLETED':
      default:
        return Colors.grey.shade600;
    }
  }

  Color _getStatusBgColor(String status) {
    switch (status.toUpperCase()) {
      case 'UPCOMING':
        return Colors.indigo.shade50;
      case 'CURRENT':
        return Colors.green.shade50;
      case 'COMPLETED':
      default:
        return Colors.grey.shade100;
    }
  }

  Widget _buildNoAssignedClassView() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.20),
        Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.assignment_ind_outlined,
                    size: 64,
                    color: Colors.amber.shade800,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'You have no assigned class.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade800,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Contact your school admin to assign you as a Class Teacher in order to view scheme and enter marks.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade600,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildClassSelectionList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _assignedClasses.length,
      itemBuilder: (context, index) {
        final item = _assignedClasses[index];
        final cName = item['name'] ?? '';
        final sec = item['section'] ?? '';
        final fullClassName = (sec != null && sec.toString().isNotEmpty) ? '$cName - $sec' : '$cName';

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.indigo.shade100, width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                setState(() {
                  _selectedClass = item;
                });
                _loadExams();
              },
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.class_rounded,
                        color: Colors.indigo.shade800,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullClassName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Tap to view examination scheme & enter marks',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: Colors.indigo.shade600,
                      size: 26,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isCBSEClassic = _exams.isNotEmpty && 
        (_exams.first['template_code'] == 'cbse_classic' || _exams.first['is_terminal'] == true);

    final String selectedClassName = _selectedClass != null
        ? (_selectedClass!['section'] != null && _selectedClass!['section'].toString().isNotEmpty
            ? '${_selectedClass!['name']} - ${_selectedClass!['section']}'
            : '${_selectedClass!['name']}')
        : '';

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          widget.userRole == 'TEACHER' && _assignedClasses.length > 1 && _selectedClass == null
              ? 'Select Class'
              : 'Examinations',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 20,
            color: Colors.white,
          ),
        ),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.indigo.shade800,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: _loadExams,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? _errorMessage!.contains('assigned class')
                    ? _buildNoAssignedClassView()
                    : Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.error_outline_rounded, size: 64, color: Colors.red.shade400),
                              const SizedBox(height: 16),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 16, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadExams,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.indigo.shade700,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Try Again'),
                              ),
                            ],
                          ),
                        ),
                      )
                : widget.userRole == 'TEACHER' && _assignedClasses.length > 1 && _selectedClass == null
                    ? _buildClassSelectionList()
                    : Column(
                        children: [
                          if (widget.userRole == 'TEACHER' && _assignedClasses.length > 1 && _selectedClass != null)
                            Container(
                              width: double.infinity,
                              color: Colors.indigo.shade50,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.school_rounded, size: 18, color: Colors.indigo.shade800),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Class: $selectedClassName',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: Colors.indigo.shade900,
                                        ),
                                      ),
                                    ],
                                  ),
                                  TextButton(
                                    onPressed: () {
                                      setState(() {
                                        _selectedClass = null;
                                        _exams = [];
                                      });
                                    },
                                    style: TextButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    child: Text(
                                      'Change Class',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                        color: Colors.indigo.shade700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          Expanded(
                            child: _exams.isEmpty
                                ? ListView(
                                    children: [
                                      SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                                      Center(
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.assignment_outlined, size: 80, color: Colors.grey.shade400),
                                            const SizedBox(height: 16),
                                            Text(
                                              'No examinations scheduled yet',
                                              style: TextStyle(fontSize: 16, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  )
                                : isCBSEClassic
                                    ? ListView.builder(
                                        padding: const EdgeInsets.all(16),
                                        physics: const AlwaysScrollableScrollPhysics(),
                                        itemCount: _exams.length,
                                        itemBuilder: (context, index) {
                                          final term = _exams[index];
                                          final termName = term['name'] ?? 'TERMINAL EXAMINATION';
                                          final termDesc = term['description'] ?? '';
                                          final List<dynamic> subTests = term['sub_tests'] ?? [];

                                          return Container(
                                            margin: const EdgeInsets.only(bottom: 16),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(16),
                                              border: Border.all(color: Colors.indigo.shade100, width: 1.2),
                                              boxShadow: [
                                                BoxShadow(
                                                  color: Colors.black.withOpacity(0.04),
                                                  blurRadius: 10,
                                                  offset: const Offset(0, 4),
                                                ),
                                              ],
                                            ),
                                            child: Material(
                                              color: Colors.transparent,
                                              borderRadius: BorderRadius.circular(16),
                                              child: InkWell(
                                                borderRadius: BorderRadius.circular(16),
                                                onTap: () {
                                                  Navigator.push(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (context) => TermSubTestsScreen(
                                                        termName: termName,
                                                        description: termDesc,
                                                        subTests: subTests,
                                                        examService: widget.examService,
                                                        userRole: widget.userRole,
                                                        studentId: widget.selectedStudentId,
                                                        classId: _selectedClass?['id'],
                                                      ),
                                                    ),
                                                  );
                                                },
                                                child: Padding(
                                                  padding: const EdgeInsets.all(20.0),
                                                  child: Row(
                                                    children: [
                                                      Container(
                                                        padding: const EdgeInsets.all(14),
                                                        decoration: BoxDecoration(
                                                          color: Colors.indigo.shade50,
                                                          borderRadius: BorderRadius.circular(14),
                                                        ),
                                                        child: Icon(
                                                          Icons.assignment_rounded,
                                                          color: Colors.indigo.shade800,
                                                          size: 28,
                                                        ),
                                                      ),
                                                      const SizedBox(width: 16),
                                                      Expanded(
                                                        child: Column(
                                                          crossAxisAlignment: CrossAxisAlignment.start,
                                                          children: [
                                                            Text(
                                                              termName,
                                                              style: const TextStyle(
                                                                fontSize: 17,
                                                                fontWeight: FontWeight.w800,
                                                                color: Colors.black87,
                                                                letterSpacing: 0.2,
                                                              ),
                                                            ),
                                                            if (termDesc.isNotEmpty) ...[
                                                              const SizedBox(height: 4),
                                                              Text(
                                                                termDesc,
                                                                style: TextStyle(
                                                                  fontSize: 13,
                                                                  color: Colors.grey.shade600,
                                                                  fontWeight: FontWeight.w500,
                                                                ),
                                                              ),
                                                            ],
                                                          ],
                                                        ),
                                                      ),
                                                      Icon(
                                                        Icons.chevron_right_rounded,
                                                        color: Colors.indigo.shade600,
                                                        size: 24,
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      )
                                    : ListView.builder(
                                        padding: const EdgeInsets.all(16),
                                        physics: const AlwaysScrollableScrollPhysics(),
                                        itemCount: _exams.length,
                                        itemBuilder: (context, index) {
                                          final exam = _exams[index];
                                          final name = exam['name'] ?? 'Exam';
                                          final start = exam['start_date'] ?? '';
                                          final end = exam['end_date'] ?? '';
                                          final status = exam['status'] ?? 'Upcoming';
                                          final statusColor = _getStatusColor(status);
                                          final statusBg = _getStatusBgColor(status);

                                          return Container(
                                            margin: const EdgeInsets.only(bottom: 16),
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
                                            child: Material(
                                              color: Colors.transparent,
                                              borderRadius: BorderRadius.circular(16),
                                              child: InkWell(
                                                borderRadius: BorderRadius.circular(16),
                                                onTap: () {
                                                  Navigator.push(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (context) => ExamDetailScreen(
                                                        examService: widget.examService,
                                                        examId: exam['id'],
                                                        examName: name,
                                                        userRole: widget.userRole,
                                                        studentId: widget.selectedStudentId,
                                                        classId: _selectedClass?['id'],
                                                      ),
                                                    ),
                                                  );
                                                },
                                                child: Padding(
                                                  padding: const EdgeInsets.all(18.0),
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Row(
                                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Expanded(
                                                            child: Text(
                                                              name,
                                                              style: const TextStyle(
                                                                fontSize: 18,
                                                                fontWeight: FontWeight.w800,
                                                                color: Colors.black87,
                                                              ),
                                                            ),
                                                          ),
                                                          const Icon(
                                                            Icons.chevron_right_rounded,
                                                            color: Colors.grey,
                                                          ),
                                                        ],
                                                      ),
                                                      const SizedBox(height: 12),
                                                      Row(
                                                        children: [
                                                          Icon(
                                                            Icons.calendar_month_rounded,
                                                            size: 16,
                                                            color: Colors.grey.shade500,
                                                          ),
                                                          const SizedBox(width: 8),
                                                          Text(
                                                            '${_formatDate(start)}  →  ${_formatDate(end)}',
                                                            style: TextStyle(
                                                              fontSize: 14,
                                                              color: Colors.grey.shade600,
                                                              fontWeight: FontWeight.bold,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                      const SizedBox(height: 16),
                                                      Row(
                                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                        children: [
                                                          Container(
                                                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                                            decoration: BoxDecoration(
                                                              color: statusBg,
                                                              borderRadius: BorderRadius.circular(8),
                                                              border: Border.all(color: statusColor.withOpacity(0.2)),
                                                            ),
                                                            child: Row(
                                                              mainAxisSize: MinAxisSize.min,
                                                              children: [
                                                                Container(
                                                                  width: 8,
                                                                  height: 8,
                                                                  decoration: BoxDecoration(
                                                                    color: statusColor,
                                                                    shape: BoxShape.circle,
                                                                  ),
                                                                ),
                                                                const SizedBox(width: 6),
                                                                Text(
                                                                  status,
                                                                  style: TextStyle(
                                                                    fontSize: 12,
                                                                    fontWeight: FontWeight.bold,
                                                                    color: statusColor,
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ],
                                                  ),
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

class TermSubTestsScreen extends StatelessWidget {
  final String termName;
  final String description;
  final List<dynamic> subTests;
  final ExamService examService;
  final String userRole;
  final int? studentId;
  final int? classId;

  const TermSubTestsScreen({
    Key? key,
    required this.termName,
    required this.description,
    required this.subTests,
    required this.examService,
    required this.userRole,
    this.studentId,
    this.classId,
  }) : super(key: key);

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final monthsShort = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${date.day} ${monthsShort[date.month - 1]} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'UPCOMING':
        return Colors.indigo.shade600;
      case 'CURRENT':
        return Colors.green.shade600;
      case 'COMPLETED':
      default:
        return Colors.grey.shade600;
    }
  }

  Color _getStatusBgColor(String status) {
    switch (status.toUpperCase()) {
      case 'UPCOMING':
        return Colors.indigo.shade50;
      case 'CURRENT':
        return Colors.green.shade50;
      case 'COMPLETED':
      default:
        return Colors.grey.shade100;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          termName,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.indigo.shade800,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: subTests.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.indigo.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.assignment_late_outlined,
                        size: 64,
                        color: Colors.indigo.shade400,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'No Exams Published Yet',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'No examination or test has been published under $termName by school administration.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: subTests.length,
              itemBuilder: (context, index) {
                final test = subTests[index];
                final name = test['name'] ?? 'Test';
                final start = test['start_date'] ?? '';
                final end = test['end_date'] ?? '';
                final status = test['status'] ?? 'Upcoming';
                final maxMarks = test['max_marks'];
                final statusColor = _getStatusColor(status);
                final statusBg = _getStatusBgColor(status);

                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
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
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => ExamDetailScreen(
                              examService: examService,
                              examId: test['id'],
                              examName: name,
                              userRole: userRole,
                              studentId: studentId,
                              classId: classId,
                            ),
                          ),
                        );
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(18.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.black87,
                                        ),
                                      ),
                                      if (maxMarks != null) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          'Max Marks: ${maxMarks.toString().replaceAll('.00', '')}',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.indigo.shade700,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  color: Colors.grey,
                                ),
                              ],
                            ),
                            if (start.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Icon(
                                    Icons.calendar_month_rounded,
                                    size: 16,
                                    color: Colors.grey.shade500,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    end.isNotEmpty ? '${_formatDate(start)}  →  ${_formatDate(end)}' : _formatDate(start),
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey.shade600,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: statusColor.withOpacity(0.2)),
                              ),
                              child: Row(
                                mainAxisSize: MinAxisSize.min,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color: statusColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    status,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: statusColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
