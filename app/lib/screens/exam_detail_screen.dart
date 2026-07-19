import 'package:flutter/material.dart';
import 'package:school_hub/services/exam_service.dart';

class ExamDetailScreen extends StatefulWidget {
  final ExamService examService;
  final int examId;
  final String examName;
  final String userRole;
  final int? studentId;

  const ExamDetailScreen({
    Key? key,
    required this.examService,
    required this.examId,
    required this.examName,
    required this.userRole,
    this.studentId,
  }) : super(key: key);

  @override
  _ExamDetailScreenState createState() => _ExamDetailScreenState();
}

class _ExamDetailScreenState extends State<ExamDetailScreen> {
  Map<String, dynamic> _details = {};
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await widget.examService.getExamDetails(
        widget.examId,
        widget.userRole,
        widget.studentId,
      );
      setState(() {
        _details = data;
        _isLoading = false;
      });
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

  String _formatTime(String timeStr) {
    try {
      final parts = timeStr.split(':');
      if (parts.length >= 2) {
        final hour = int.parse(parts[0]);
        final min = parts[1];
        final period = hour >= 12 ? 'PM' : 'AM';
        final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
        return '$displayHour:$min $period';
      }
      return timeStr;
    } catch (_) {
      return timeStr;
    }
  }

  void _showSchemeModal() {
    final List<dynamic> scheme = _details['scheme'] ?? [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Examination Timetable Scheme',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: scheme.isEmpty
                  ? const Center(child: Text('No timetable entries found.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: scheme.length,
                      itemBuilder: (context, index) {
                        final paper = scheme[index];
                        final sub = paper['subject_name'] ?? 'Subject';
                        final date = paper['exam_date'] ?? '';
                        final start = paper['start_time'] ?? '';
                        final end = paper['end_time'] ?? '';
                        final maxM = paper['max_marks']?.toString() ?? '100';
                        final passM = paper['passing_marks']?.toString() ?? '33';
                        final room = paper['room'] ?? 'As scheduled';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sub,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.black87),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Icon(Icons.calendar_today_rounded, size: 14, color: Colors.indigo.shade600),
                                  const SizedBox(width: 6),
                                  Text(
                                    _formatDate(date),
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(width: 16),
                                  Icon(Icons.access_time_rounded, size: 14, color: Colors.indigo.shade600),
                                  const SizedBox(width: 6),
                                  Text(
                                    '${_formatTime(start)} - ${_formatTime(end)}',
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                  Text(
                                    'Max/Pass: $maxM/$passM',
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    'Room: $room',
                                    style: TextStyle(fontSize: 12, color: Colors.indigo.shade800, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ],
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

  void _showAdmitCardModal() {
    final Map<String, dynamic>? admit = _details['admit_card'] != null 
        ? Map<String, dynamic>.from(_details['admit_card']) 
        : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Examination Admit Card',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: admit == null
                  ? const Center(child: Text('No seating allocation details found.'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.indigo.shade100, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.indigo.shade50.withOpacity(0.5),
                              blurRadius: 15,
                              offset: const Offset(0, 5),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.indigo.shade50,
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                child: Text(
                                  'OFFICIAL ADMIT CARD',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.indigo.shade800,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            _buildInfoRow('Exam Name', widget.examName),
                            const Divider(height: 20),
                            _buildInfoRow('Seat Number', admit['seat_number']?.toString() ?? '—', isHighlight: true),
                            const Divider(height: 20),
                            _buildInfoRow('Room / Hall', admit['room']?.toString() ?? '—', isHighlight: true),
                            const SizedBox(height: 24),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.amber.shade50,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.amber.shade200),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.info_outline_rounded, color: Colors.amber.shade800, size: 20),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Text(
                                      'Please carry this admit card info. Verification will be done before entering the exam room.',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
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
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isHighlight ? 16 : 14,
            color: isHighlight ? Colors.indigo.shade800 : Colors.black87,
            fontWeight: isHighlight ? FontWeight.w900 : FontWeight.bold,
          ),
        ),
      ],
    );
  }

  void _showResultModal() {
    if (widget.userRole == 'TEACHER') {
      _showTeacherResultsModal();
    } else {
      _showStudentResultsModal();
    }
  }

  void _showStudentResultsModal() {
    final Map<String, dynamic>? result = _details['result'] != null 
        ? Map<String, dynamic>.from(_details['result']) 
        : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Examination Report Card',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: result == null
                  ? const Center(child: Text('No result records found.'))
                  : Column(
                      children: [
                        // Summary Card
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: result['status']?.toUpperCase() == 'PASS'
                                  ? [Colors.green.shade700, Colors.green.shade900]
                                  : [Colors.red.shade700, Colors.red.shade900],
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'GRAND TOTAL',
                                    style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${result['total_marks_obtained']} / ${result['total_max_marks']}',
                                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                child: Text(
                                  result['status']?.toUpperCase() ?? 'FAIL',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'SUBJECT DETAILS',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.grey),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: (result['papers'] as List).length,
                            itemBuilder: (context, index) {
                              final paper = result['papers'][index];
                              final sub = paper['subject_name'] ?? '';
                              final obt = paper['marks_obtained'];
                              final max = paper['max_marks'];
                              final pass = paper['passing_marks'];
                              final isAbs = paper['is_absent'] == 1;

                              final isPassed = !isAbs && obt != null && obt >= pass;

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.grey.shade200),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            sub,
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black87),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Passing Marks: $pass',
                                            style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          isAbs ? 'ABSENT' : '$obt / $max',
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w900,
                                            color: isAbs 
                                                ? Colors.red.shade700 
                                                : (isPassed ? Colors.green.shade700 : Colors.red.shade700),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          isAbs ? 'Fail' : (isPassed ? 'Pass' : 'Fail'),
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: isAbs 
                                                ? Colors.red.shade700 
                                                : (isPassed ? Colors.green.shade600 : Colors.red.shade600),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
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

  void _showTeacherResultsModal() {
    final List<dynamic> studentsResults = _details['result'] ?? [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Class Performance Summary',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              widget.examName,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            Expanded(
              child: studentsResults.isEmpty
                  ? const Center(child: Text('No student performance records found.'))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: studentsResults.length,
                      itemBuilder: (context, index) {
                        final stRes = studentsResults[index];
                        final name = stRes['student_name'] ?? 'Student';
                        final roll = stRes['roll_number']?.toString() ?? '—';
                        final obt = stRes['total_marks_obtained'];
                        final max = stRes['total_max_marks'];
                        final status = stRes['status'] ?? 'Pass';
                        final List<dynamic> papers = stRes['papers'] ?? [];

                        final isPass = status.toUpperCase() == 'PASS';

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: ExpansionTile(
                            tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            title: Text(
                              name,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Text(
                                'Roll No: $roll  |  Total: $obt / $max',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.bold),
                              ),
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: isPass ? Colors.green.shade50 : Colors.red.shade50,
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: isPass ? Colors.green.shade200 : Colors.red.shade200),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: isPass ? Colors.green.shade700 : Colors.red.shade700,
                                ),
                              ),
                            ),
                            children: [
                              Container(
                                color: Colors.grey.shade50,
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'SUBJECT MARKS BREAKDOWN',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey),
                                    ),
                                    const SizedBox(height: 8),
                                    ...papers.map((p) {
                                      final isAbs = p['is_absent'] == 1;
                                      final pObt = p['marks_obtained'];
                                      final pMax = p['max_marks'];
                                      final pPass = p['passing_marks'];
                                      final pPassFlag = !isAbs && pObt != null && pObt >= pPass;

                                      return Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              p['subject_name'] ?? '',
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black87),
                                            ),
                                            Text(
                                              isAbs ? 'ABSENT' : '$pObt / $pMax  (${pPassFlag ? 'Pass' : 'Fail'})',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w900,
                                                color: isAbs 
                                                    ? Colors.red.shade700 
                                                    : (pPassFlag ? Colors.green.shade700 : Colors.red.shade700),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
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
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool schemePub = _details['scheme_published'] == 1;
    final bool admitPub = _details['admit_card_published'] == 1;
    final bool resultPub = _details['result_published'] == 1;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          widget.examName,
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
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
                          onPressed: _loadDetails,
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
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      'Examination Components',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.indigo.shade900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 1. Exam Scheme Card
                    _buildFeatureCard(
                      title: 'Exam Scheme',
                      subtitle: schemePub ? 'View examination timetable scheme' : 'Not Published Yet',
                      icon: Icons.calendar_month_rounded,
                      isPublished: schemePub,
                      onTap: _showSchemeModal,
                    ),

                    // 2. Admit Card Card (STUDENT/PARENT only)
                    if (widget.userRole != 'TEACHER')
                      _buildFeatureCard(
                        title: 'Admit Card',
                        subtitle: admitPub ? 'View room & seat allocations' : 'Not Published Yet',
                        icon: Icons.badge_rounded,
                        isPublished: admitPub,
                        onTap: _showAdmitCardModal,
                      ),

                    // 3. Result Card
                    _buildFeatureCard(
                      title: widget.userRole == 'TEACHER' ? 'Student Results' : 'Exam Result',
                      subtitle: resultPub 
                          ? (widget.userRole == 'TEACHER' ? 'View class performance breakdown' : 'View your report card')
                          : 'Not Published Yet',
                      icon: Icons.workspace_premium_rounded,
                      isPublished: resultPub,
                      onTap: _showResultModal,
                    ),
                  ],
                ),
    );
  }

  Widget _buildFeatureCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isPublished,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isPublished ? Colors.white : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPublished ? Colors.indigo.shade50 : Colors.grey.shade200,
          width: 1.5,
        ),
        boxShadow: isPublished
            ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: isPublished ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: isPublished ? Colors.indigo.shade50 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    icon,
                    color: isPublished ? Colors.indigo.shade800 : Colors.grey.shade400,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: isPublished ? Colors.black87 : Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isPublished ? Colors.indigo.shade600 : Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isPublished ? Icons.arrow_forward_ios_rounded : Icons.lock_outline_rounded,
                  color: isPublished ? Colors.indigo.shade800 : Colors.grey.shade400,
                  size: 16,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
