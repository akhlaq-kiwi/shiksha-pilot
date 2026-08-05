import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/leave_request.dart';
import '../services/leave_service.dart';
import '../main.dart';
import 'apply_leave_screen.dart';

class LeaveListScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole; // 'TEACHER' or 'PARENT' or 'STUDENT'
  final int? selectedStudentId; // only relevant for parent role
  final int initialTabIndex; // 0 for Official Holidays, 1 for Leave Requests (default 0)

  const LeaveListScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
    this.initialTabIndex = 0,
  }) : super(key: key);

  @override
  _LeaveListScreenState createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  List<LeaveRequest> _leaves = [];
  List<dynamic> _holidays = [];
  bool _isLoadingLeaves = true;
  bool _isLoadingHolidays = true;

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return '${date.day} ${months[date.month - 1]} ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  @override
  void initState() {
    super.initState();
    _loadLeaves();
    _loadHolidays();
  }

  Future<void> _loadLeaves() async {
    setState(() {
      _isLoadingLeaves = true;
    });

    try {
      final viewType = widget.userRole == 'TEACHER' ? 'OWN' : null;
      final data = await widget.leaveService.getLeaveRequests(
        viewType: viewType,
        studentId: widget.selectedStudentId,
      );
      setState(() {
        _leaves = data;
      });
    } catch (e) {
      final errorMsg = e.toString();
      if (errorMsg.contains('Unauthorized') || errorMsg.contains('login')) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.clear();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Session expired. Please login again.')),
          );
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (context) => const LoginScreen()),
            (route) => false,
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMsg)),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingLeaves = false;
        });
      }
    }
  }

  Future<void> _loadHolidays() async {
    setState(() {
      _isLoadingHolidays = true;
    });
    try {
      final data = await widget.leaveService.getHolidays();
      setState(() {
        _holidays = data;
      });
    } catch (e) {
      debugPrint('Error loading holidays: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingHolidays = false;
        });
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return Colors.orange;
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      case 'CANCELLED':
      default:
        return Colors.grey;
    }
  }

  Future<void> _confirmCancelLeave(LeaveRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Leave Request'),
        content: Text('Are you sure you want to cancel this leave request for ${request.leaveType}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('NO'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('YES, CANCEL'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await widget.leaveService.cancelLeaveRequest(request.id);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Leave request cancelled successfully.')),
        );
        _loadLeaves();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  void _showLeaveDetails(LeaveRequest leave) {
    final bool hasStudent = leave.studentName != null;
    final bool isRejected = leave.status.toUpperCase() == 'REJECTED';
    
    final String boxLabel = isRejected ? 'ADMIN REMARKS / REJECTION REASON' : 'REASON';
    final String boxText = isRejected ? (leave.rejectReason ?? '') : leave.reason;
    final Color boxBgColor = isRejected ? Colors.red.shade50 : Colors.grey.shade50;
    final Color boxBorderColor = isRejected ? Colors.red.shade100 : Colors.grey.shade200;
    final Color boxTextColor = isRejected ? Colors.red.shade900 : Colors.black87;

    // Fixed height dialog content container
    final double dialogContentHeight = hasStudent ? 400 : 350;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          contentPadding: const EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 12),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Request Details',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _getStatusColor(leave.status).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: _getStatusColor(leave.status).withOpacity(0.3),
                  ),
                ),
                child: Text(
                  leave.status,
                  style: TextStyle(
                    color: _getStatusColor(leave.status),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          content: Container(
            width: 300,
            height: dialogContentHeight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPopupDetailRow('Leave Type', leave.leaveType),
                const SizedBox(height: 18),
                _buildPopupDetailRow('Duration', '${_formatDate(leave.fromDate)} to ${_formatDate(leave.toDate)}'),
                if (hasStudent) ...[
                  const SizedBox(height: 18),
                  _buildPopupDetailRow('Student Name', leave.studentName!),
                ],
                const SizedBox(height: 18),
                Text(
                  boxLabel,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 6),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: boxBgColor,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: boxBorderColor),
                    ),
                    child: Scrollbar(
                      thumbVisibility: true,
                      child: SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: Text(
                            boxText,
                            style: TextStyle(
                              fontSize: 13,
                              color: boxTextColor,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 1), // Exact 1px padding from top edge of Close button
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (leave.status.toUpperCase() == 'PENDING') ...[
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          _confirmCancelLeave(leave);
                        },
                        child: const Text('Cancel Request', style: TextStyle(color: Colors.red)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.indigo,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPopupDetailRow(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            color: Colors.grey,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
            height: 1.3,
          ),
        ),
      ],
    );
  }

  Widget _buildHolidaysTab() {
    if (_isLoadingHolidays) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_holidays.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.beach_access_rounded, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No Official Holidays Registered',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }

    final todayStr = DateTime.now().toIso8601String().split('T')[0];

    return RefreshIndicator(
      onRefresh: _loadHolidays,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _holidays.length,
        itemBuilder: (context, index) {
          final holiday = _holidays[index];
          final String hName = holiday['name'] ?? 'Holiday';
          final String hDateStr = holiday['date'] ?? '';
          final String hDesc = holiday['description'] ?? 'School Holiday';

          // Determine status
          bool isToday = hDateStr == todayStr;
          bool isUpcoming = false;
          try {
            if (!isToday && hDateStr.isNotEmpty) {
              final hDate = DateTime.parse(hDateStr);
              final todayDate = DateTime.parse(todayStr);
              isUpcoming = hDate.isAfter(todayDate);
            }
          } catch (_) {}

          // Styling variables
          Color borderColor = Colors.grey.shade200;
          Color bgColor = Colors.white;
          Widget? badge;

          if (isToday) {
            borderColor = Colors.green.shade600;
            bgColor = Colors.green.shade50.withOpacity(0.3);
            badge = Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.green.shade600,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Today',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            );
          } else if (isUpcoming) {
            borderColor = Colors.blue.shade300;
            bgColor = Colors.blue.shade50.withOpacity(0.15);
            badge = Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.blue.shade600,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Upcoming',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            );
          }

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderColor, width: isToday ? 2 : 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.015),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                hName,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                            ),
                            if (badge != null) ...[
                              const SizedBox(width: 8),
                              badge,
                            ],
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.calendar_month_rounded, size: 14, color: Colors.grey),
                            const SizedBox(width: 6),
                            Text(
                              _formatDate(hDateStr),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.black54,
                              ),
                            ),
                          ],
                        ),
                        if (hDesc.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            hDesc,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRequestsTab() {
    if (_isLoadingLeaves) {
      return const Center(child: CircularProgressIndicator());
    }

    Widget content;
    if (_leaves.isEmpty) {
      content = Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No Leaves Registered',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Apply for leave by tapping the button below.',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
      );
    } else {
      content = RefreshIndicator(
        onRefresh: _loadLeaves,
        child: ListView.builder(
          padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 88),
          itemCount: _leaves.length,
          itemBuilder: (context, index) {
            final leave = _leaves[index];
            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.015),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () => _showLeaveDetails(leave),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(
                          color: _getStatusColor(leave.status),
                          width: 6,
                        ),
                      ),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.grey[100],
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                leave.leaveType,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: _getStatusColor(leave.status).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: _getStatusColor(leave.status).withOpacity(0.3),
                                ),
                              ),
                              child: Text(
                                leave.status,
                                style: TextStyle(
                                  color: _getStatusColor(leave.status),
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (leave.studentName != null) ...[
                          Text(
                            'Student: ${leave.studentName}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        Row(
                          children: [
                            const Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey),
                            const SizedBox(width: 6),
                            Text(
                              '${_formatDate(leave.fromDate)} to ${_formatDate(leave.toDate)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          leave.reason,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, height: 1.4, color: Colors.black54),
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

    return Stack(
      children: [
        content,
        Positioned(
          bottom: 16,
          right: 16,
          child: FloatingActionButton(
            backgroundColor: Colors.indigo,
            foregroundColor: Colors.white,
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ApplyLeaveScreen(
                    leaveService: widget.leaveService,
                    userRole: widget.userRole,
                    selectedStudentId: widget.selectedStudentId,
                  ),
                ),
              );
              if (result == true) {
                _loadLeaves();
              }
            },
            child: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTabIndex,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text('Leaves', style: TextStyle(fontWeight: FontWeight.w900)),
          backgroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Official Holidays'),
              Tab(text: 'Leave Requests'),
            ],
            indicatorColor: Colors.indigo,
            labelColor: Colors.indigo,
            unselectedLabelColor: Colors.grey,
            labelStyle: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        body: TabBarView(
          children: [
            _buildHolidaysTab(),
            _buildRequestsTab(),
          ],
        ),
      ),
    );
  }
}
