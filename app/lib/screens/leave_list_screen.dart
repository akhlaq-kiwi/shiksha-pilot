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

  const LeaveListScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
  }) : super(key: key);

  @override
  _LeaveListScreenState createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  List<LeaveRequest> _leaves = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadLeaves();
  }

  Future<void> _loadLeaves() async {
    setState(() {
      _isLoading = true;
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
          _isLoading = false;
        });
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
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

  Future<void> _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Requests'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadLeaves,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadLeaves,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _leaves.isEmpty
                ? Center(
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
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _leaves.length,
                    itemBuilder: (context, index) {
                      final leave = _leaves[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: Colors.grey[200]!),
                        ),
                        child: Padding(
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
                                    '${leave.fromDate} to ${leave.toDate}',
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
                                style: const TextStyle(fontSize: 12, height: 1.4),
                              ),
                              if (leave.rejectReason != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: Colors.red[50],
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Rejection Reason:',
                                        style: TextStyle(
                                          color: Colors.red[700],
                                          fontWeight: FontWeight.bold,
                                          fontSize: 10,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        leave.rejectReason!,
                                        style: TextStyle(color: Colors.red[900], fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              if (leave.status == 'PENDING') ...[
                                const SizedBox(height: 12),
                                const Divider(height: 1),
                                const SizedBox(height: 8),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    onPressed: () => _confirmCancelLeave(leave),
                                    icon: const Icon(Icons.cancel_outlined, size: 16, color: Colors.red),
                                    label: const Text(
                                      'Cancel Request',
                                      style: TextStyle(color: Colors.red, fontSize: 12),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
      floatingActionButton: FloatingActionButton(
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
    );
  }
}
