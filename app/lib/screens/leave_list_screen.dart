import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/leave_request.dart';
import '../services/leave_service.dart';
import '../main.dart';
import 'apply_leave_bottom_sheet.dart';
import '../widgets/profile_avatar_view.dart';

class LeaveListScreen extends StatefulWidget {
  final LeaveService leaveService;
  final String userRole; // 'TEACHER' or 'PARENT' or 'STUDENT' or 'PRINCIPAL'
  final int? selectedStudentId; // only relevant for parent role
  final int initialTabIndex; // 0 for Official Holidays, 1 for Leave Requests (default 0)
  final bool? isPrincipal;

  const LeaveListScreen({
    Key? key,
    required this.leaveService,
    required this.userRole,
    this.selectedStudentId,
    this.initialTabIndex = 0,
    this.isPrincipal,
  }) : super(key: key);

  @override
  _LeaveListScreenState createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> with SingleTickerProviderStateMixin {
  List<LeaveRequest> _leaves = [];
  List<dynamic> _holidays = [];
  bool _isLoadingLeaves = true;
  bool _isLoadingHolidays = true;
  bool _isPrincipal = false;
  final ScrollController _holidaysScrollController = ScrollController();
  late TabController _tabController;

  @override
  void dispose() {
    _tabController.dispose();
    _holidaysScrollController.dispose();
    super.dispose();
  }

  // Principal Filters
  String _statusFilter = 'ALL'; // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'
  String _roleFilter = 'ALL'; // 'ALL', 'TEACHER', 'STUDENT' - 'All' selected by default

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

  String _formatLeaveDays(String fromDateStr, String toDateStr) {
    try {
      final from = DateTime.parse(fromDateStr);
      final to = DateTime.parse(toDateStr);
      final fromClean = DateTime(from.year, from.month, from.day);
      final toClean = DateTime(to.year, to.month, to.day);
      final diff = toClean.difference(fromClean).inDays + 1;
      final days = diff > 0 ? diff : 1;
      if (days == 1) {
        return '1 Day leave';
      } else {
        return '$days Days leave';
      }
    } catch (_) {
      return '1 Day leave';
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _tabController.addListener(() {
      if (mounted) {
        setState(() {});
      }
      if (_tabController.index == 1) {
        _markLeaveNotificationsAsRead();
      }
    });
    final roleUpper = widget.userRole.toUpperCase();
    _isPrincipal = widget.isPrincipal ?? (roleUpper == 'PRINCIPAL');
    _initPrincipalAndLoad();
    _markLeaveNotificationsAsRead();
  }

  Future<void> _markLeaveNotificationsAsRead() async {
    try {
      final baseUrl = widget.leaveService.baseUrl;
      final token = widget.leaveService.token;
      if (token.isEmpty) return;

      final roleUpper = widget.userRole.toUpperCase();
      final bool isSchoolStaff = (roleUpper == 'TEACHER' ||
          roleUpper == 'PRINCIPAL' ||
          roleUpper == 'SCHOOL_ADMIN' ||
          roleUpper == 'SUPER_ADMIN');
      final String path = isSchoolStaff
          ? ((roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'SUPER_ADMIN')
              ? '/api/school/notifications/0/read'
              : '/api/teacher/notifications/0/read')
          : '/api/student/notifications/0/read';

      final uri = Uri.parse('$baseUrl$path');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (!isSchoolStaff && widget.selectedStudentId != null)
          'X-Student-Id': widget.selectedStudentId.toString(),
      };

      await http.post(
        uri,
        headers: headers,
        body: json.encode({'module': 'leaves'}),
      );
    } catch (e) {
      debugPrint('Error marking leave notifications as read: $e');
    }
  }

  Future<void> _initPrincipalAndLoad() async {
    final prefs = await SharedPreferences.getInstance();
    final roleUpper = widget.userRole.toUpperCase();
    final isP = widget.isPrincipal ??
        (roleUpper == 'PRINCIPAL' || (prefs.getBool('is_principal') == true));

    if (mounted) {
      setState(() {
        _isPrincipal = isP;
      });
      _loadLeaves();
      _loadHolidays();
    }
  }

  Future<void> _loadLeaves() async {
    setState(() {
      _isLoadingLeaves = true;
    });

    try {
      final roleUpper = widget.userRole.toUpperCase();
      // If Principal, do not restrict viewType to OWN, fetch all school leaves
      final viewType = _isPrincipal ? null : (roleUpper == 'TEACHER' ? 'OWN' : null);
      final data = await widget.leaveService.getLeaveRequests(
        viewType: viewType,
        studentId: _isPrincipal ? null : widget.selectedStudentId,
      );
      data.sort((a, b) {
        final aPending = a.status.toUpperCase() == 'PENDING';
        final bPending = b.status.toUpperCase() == 'PENDING';
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        return b.id.compareTo(a.id);
      });
      if (mounted) {
        setState(() {
          _leaves = data;
        });
      }
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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(errorMsg)),
          );
        }
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
      final sortedHolidays = List<dynamic>.from(data);
      sortedHolidays.sort((a, b) {
        final da = (a['date'] ?? '').toString();
        final db = (b['date'] ?? '').toString();
        return da.compareTo(db);
      });
      if (mounted) {
        setState(() {
          _holidays = sortedHolidays;
        });
        _scrollToFirstUpcoming();
      }
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

  void _scrollToFirstUpcoming() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _holidays.isEmpty) return;
      final todayStr = DateTime.now().toIso8601String().split('T')[0];
      int targetIndex = -1;
      for (int i = 0; i < _holidays.length; i++) {
        final dStr = (_holidays[i]['date'] ?? '').toString();
        if (dStr.isNotEmpty && dStr.compareTo(todayStr) >= 0) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex > 0 && _holidaysScrollController.hasClients) {
        const double itemHeight = 78.0;
        final targetOffset = (targetIndex * itemHeight).clamp(0.0, _holidaysScrollController.position.maxScrollExtent);
        _holidaysScrollController.animateTo(
          targetOffset,
          duration: const Duration(milliseconds: 380),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  List<LeaveRequest> get _filteredLeaves {
    if (!_isPrincipal) return _leaves;

    final list = _leaves.where((leave) {
      // Status filter
      if (_statusFilter != 'ALL' && leave.status.toUpperCase() != _statusFilter) {
        return false;
      }

      // Role filter
      if (_roleFilter != 'ALL' && leave.applicantRole.toUpperCase() != _roleFilter) {
        return false;
      }

      return true;
    }).toList();

    // Sort so that PENDING requests ALWAYS appear at the top of the listing
    list.sort((a, b) {
      final aPending = a.status.toUpperCase() == 'PENDING';
      final bPending = b.status.toUpperCase() == 'PENDING';

      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // Within the same status category, order by ID descending (newest first)
      return b.id.compareTo(a.id);
    });

    return list;
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return const Color(0xFFD97706);
      case 'APPROVED':
        return const Color(0xFF059669);
      case 'REJECTED':
        return const Color(0xFFDC2626);
      case 'CANCELLED':
      default:
        return const Color(0xFF64748B);
    }
  }

  Color _getStatusBgColor(String status) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return const Color(0xFFECFDF5);
      case 'REJECTED':
        return const Color(0xFFFEF2F2);
      case 'PENDING':
      default:
        return const Color(0xFFFFFBEB);
    }
  }

  Color _getStatusBorderColor(String status) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return const Color(0xFFA7F3D0);
      case 'REJECTED':
        return const Color(0xFFFECACA);
      case 'PENDING':
      default:
        return const Color(0xFFFDE68A);
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return Icons.check_circle_rounded;
      case 'REJECTED':
        return Icons.cancel_rounded;
      case 'PENDING':
      default:
        return Icons.access_time_rounded;
    }
  }

  Future<void> _confirmCancelLeave(LeaveRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626), size: 22),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Cancel Leave Request',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to cancel this leave request for ${request.leaveType}?',
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF334155), fontWeight: FontWeight.w500),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('No', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Yes, Cancel', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await widget.leaveService.cancelLeaveRequest(request.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Leave request cancelled successfully.')),
          );
          _loadLeaves();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString())),
          );
        }
      }
    }
  }

  Future<void> _handleApprove(LeaveRequest leave) async {
    final applicantName = leave.applicantRole.toUpperCase() == 'TEACHER'
        ? (leave.teacherName ?? 'Teacher')
        : (leave.studentName ?? 'Student');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Approve Leave',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to approve leave for $applicantName?',
              style: const TextStyle(fontSize: 13.5, color: Color(0xFF334155), fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB).withOpacity(0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.event_note_rounded, size: 15, color: Color(0xFFD97706)),
                      const SizedBox(width: 7),
                      Text(
                        leave.leaveType,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '•  ${_formatLeaveDays(leave.fromDate, leave.toDate)}',
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFFB45309)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.calendar_month_rounded, size: 15, color: Color(0xFFD97706)),
                      const SizedBox(width: 7),
                      Text(
                        '${_formatDate(leave.fromDate)} to ${_formatDate(leave.toDate)}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Attendance for these dates will automatically be updated to "Leave".',
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Approve', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await widget.leaveService.updateLeaveRequestStatus(leave.id, status: 'APPROVED');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Leave request approved successfully.'),
              backgroundColor: Color(0xFF059669),
            ),
          );
          _loadLeaves();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString().replaceAll('Exception: ', '')),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _handleReject(LeaveRequest leave) async {
    final applicantName = leave.applicantRole.toUpperCase() == 'TEACHER'
        ? (leave.teacherName ?? 'Teacher')
        : (leave.studentName ?? 'Student');

    final reasonController = TextEditingController();
    String? errorText;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626), size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Reject Leave Request',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Please specify the reason for rejecting leave for $applicantName:',
                    style: const TextStyle(fontSize: 13.5, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonController,
                    maxLines: 3,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      hintText: 'Enter rejection reason (required)...',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      errorText: errorText,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFDC2626), width: 1.5),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                    ),
                  ),
                ],
              ),
              actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              actions: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context, false),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          final reason = reasonController.text.trim();
                          if (reason.isEmpty) {
                            setDialogState(() {
                              errorText = 'Rejection reason is required.';
                            });
                            return;
                          }
                          Navigator.pop(context, true);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed == true) {
      try {
        await widget.leaveService.updateLeaveRequestStatus(
          leave.id,
          status: 'REJECTED',
          rejectReason: reasonController.text.trim(),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Leave request rejected successfully.'),
              backgroundColor: Color(0xFFDC2626),
            ),
          );
          _loadLeaves();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString().replaceAll('Exception: ', '')),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  void _showAddHolidaySheet() {
    final titleController = TextEditingController();
    DateTime? startDate;
    DateTime? endDate;
    String? formError;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final keyboardPadding = MediaQuery.of(context).viewInsets.bottom;
            final startText = startDate == null
                ? 'Select start date'
                : _formatDate('${startDate!.year}-${startDate!.month.toString().padLeft(2, '0')}-${startDate!.day.toString().padLeft(2, '0')}');
            final endText = endDate == null
                ? 'Select end date (optional)'
                : _formatDate('${endDate!.year}-${endDate!.month.toString().padLeft(2, '0')}-${endDate!.day.toString().padLeft(2, '0')}');

            return Container(
              margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.fromLTRB(20, 14, 20, 24 + keyboardPadding),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Add Official Holiday',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Add official holiday or school leave day to the calendar.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 16),

                    if (formError != null) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 16, color: Colors.redAccent),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                formError!,
                                style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // LEAVE TITLE *
                    const Text(
                      'LEAVE TITLE *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: titleController,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                        decoration: const InputDecoration(
                          hintText: 'e.g. Diwali Holidays',
                          hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // START DATE *
                    const Text(
                      'START DATE *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final now = DateTime.now();
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: startDate ?? now,
                          firstDate: DateTime(now.year - 1),
                          lastDate: DateTime(now.year + 5),
                          builder: (ctx, child) {
                            return Theme(
                              data: Theme.of(ctx).copyWith(
                                colorScheme: const ColorScheme.light(primary: Color(0xFFD97706)),
                                dialogTheme: DialogThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
                              ),
                              child: child!,
                            );
                          },
                        );
                        if (picked != null) {
                          setSheetState(() {
                            startDate = picked;
                            formError = null;
                            if (endDate != null && endDate!.isBefore(picked)) {
                              endDate = picked;
                            }
                          });
                        }
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              startText,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: startDate == null ? FontWeight.normal : FontWeight.bold,
                                color: startDate == null ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                              ),
                            ),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFD97706)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // END DATE (OPTIONAL)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'END DATE (OPTIONAL)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        if (endDate != null)
                          InkWell(
                            onTap: () {
                              setSheetState(() {
                                endDate = null;
                              });
                            },
                            child: const Text(
                              'Clear',
                              style: TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final now = startDate ?? DateTime.now();
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: endDate ?? now,
                          firstDate: startDate ?? DateTime(now.year - 1),
                          lastDate: DateTime(now.year + 5),
                          builder: (ctx, child) {
                            return Theme(
                              data: Theme.of(ctx).copyWith(
                                colorScheme: const ColorScheme.light(primary: Color(0xFFD97706)),
                                dialogTheme: DialogThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
                              ),
                              child: child!,
                            );
                          },
                        );
                        if (picked != null) {
                          setSheetState(() {
                            endDate = picked;
                            formError = null;
                          });
                        }
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              endText,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: endDate == null ? FontWeight.normal : FontWeight.bold,
                                color: endDate == null ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                              ),
                            ),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: Color(0xFFD97706)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Actions
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B), fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSaving
                                ? null
                                : () async {
                                    final title = titleController.text.trim();
                                    if (title.isEmpty) {
                                      setSheetState(() {
                                        formError = 'Leave title is required.';
                                      });
                                      return;
                                    }
                                    if (startDate == null) {
                                      setSheetState(() {
                                        formError = 'Start date is required.';
                                      });
                                      return;
                                    }
                                    if (endDate != null && endDate!.isBefore(startDate!)) {
                                      setSheetState(() {
                                        formError = 'End date cannot be before start date.';
                                      });
                                      return;
                                    }

                                    setSheetState(() {
                                      isSaving = true;
                                      formError = null;
                                    });

                                    final startStr = '${startDate!.year}-${startDate!.month.toString().padLeft(2, '0')}-${startDate!.day.toString().padLeft(2, '0')}';
                                    final endStr = endDate == null
                                        ? startStr
                                        : '${endDate!.year}-${endDate!.month.toString().padLeft(2, '0')}-${endDate!.day.toString().padLeft(2, '0')}';

                                    try {
                                      await widget.leaveService.createHoliday(
                                        name: title,
                                        startDate: startStr,
                                        endDate: endStr,
                                      );
                                      if (context.mounted) {
                                        Navigator.pop(context);
                                      }
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('Official holiday created successfully.'),
                                            backgroundColor: Color(0xFFD97706),
                                            behavior: SnackBarBehavior.floating,
                                          ),
                                        );
                                        _loadHolidays();
                                      }
                                    } catch (e) {
                                      setSheetState(() {
                                        formError = e.toString().replaceAll('Exception: ', '');
                                        isSaving = false;
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: isSaving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    ),
                                  )
                                : const Text(
                                    'Save',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
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
          },
        );
      },
    );
  }

  void _showLeaveDetails(LeaveRequest leave) {
    final bool isStudent = leave.applicantRole.toUpperCase() == 'STUDENT';
    final bool isTeacher = leave.applicantRole.toUpperCase() == 'TEACHER';
    final bool isRejected = leave.status.toUpperCase() == 'REJECTED';
    final bool isPending = leave.status.toUpperCase() == 'PENDING';

    final String applicantName = isTeacher
        ? (leave.teacherName ?? 'Teacher')
        : (leave.studentName ?? (isStudent ? 'Student' : 'Staff'));

    final String boxLabel = isRejected ? 'ADMIN REMARKS / REJECTION REASON' : 'REASON';
    final String boxText = isRejected ? (leave.rejectReason ?? '') : leave.reason;
    final Color boxBgColor = isRejected ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC);
    final Color boxBorderColor = isRejected ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0);
    final Color boxTextColor = isRejected ? const Color(0xFF991B1B) : const Color(0xFF0F172A);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 12,
            bottom: 24 + keyboardPadding,
          ),
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(modalCtx).size.height * 0.88,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Grab Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Header Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Leave Request Details',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                      onPressed: () => Navigator.pop(modalCtx),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Overview Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFDF8),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFDE68A).withOpacity(0.6)),
                  ),
                  child: Row(
                    children: [
                      ProfileAvatarView(
                        photoUrl: leave.photoPath ?? '',
                        baseUrl: widget.leaveService.baseUrl,
                        name: applicantName,
                        size: 52,
                        entityType: isTeacher ? 'teacher' : 'student',
                        enableZoom: true,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              applicantName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            if (isTeacher && leave.formattedEmpId != null && leave.formattedEmpId!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                'EMP ID: ${leave.formattedEmpId}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                              ),
                            ] else if (isStudent && leave.classLabel != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                '${leave.classLabel!}${leave.rollNo != null && leave.rollNo!.trim().isNotEmpty ? ' • Roll No: ${leave.rollNo}' : ''}',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getStatusBgColor(leave.status),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: _getStatusBorderColor(leave.status)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_getStatusIcon(leave.status), size: 12, color: _getStatusColor(leave.status)),
                            const SizedBox(width: 4),
                            Text(
                              leave.status.toUpperCase(),
                              style: TextStyle(
                                color: _getStatusColor(leave.status),
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Details Grid / Info Rows
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      _buildPopupDetailRow('Leave Type', leave.leaveType),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                      ),
                      _buildPopupDetailRow('Leave Duration', _formatLeaveDays(leave.fromDate, leave.toDate)),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                      ),
                      _buildPopupDetailRow(
                        'Period',
                        '${_formatDate(leave.fromDate)} to ${_formatDate(leave.toDate)}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Reason section
                Text(
                  boxLabel,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: boxBgColor,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: boxBorderColor),
                  ),
                  child: Text(
                    boxText.isNotEmpty ? boxText : 'No reason specified',
                    style: TextStyle(
                      fontSize: 13,
                      color: boxTextColor,
                      height: 1.45,
                    ),
                  ),
                ),

                // Attachment preview if present
                if (leave.attachmentPath != null && leave.attachmentPath!.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  InkWell(
                    onTap: () {
                      _showAttachmentPreview(leave.attachmentPath!);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        children: const [
                          Icon(Icons.attach_file_rounded, size: 18, color: Color(0xFFD97706)),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'View Attached Document / Image',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF92400E),
                              ),
                            ),
                          ),
                          Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFD97706)),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),

                // Action Buttons
                if (_isPrincipal && isPending) ...[
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(modalCtx);
                            _handleReject(leave);
                          },
                          icon: const Icon(Icons.close_rounded, size: 16),
                          label: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            side: const BorderSide(color: Color(0xFFFECACA)),
                            backgroundColor: const Color(0xFFFEF2F2),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(modalCtx);
                            _handleApprove(leave);
                          },
                          icon: const Icon(Icons.check_rounded, size: 16),
                          label: const Text('Approve', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF059669),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ] else if (!_isPrincipal && isPending) ...[
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(modalCtx);
                        _confirmCancelLeave(leave);
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFECACA)),
                        backgroundColor: const Color(0xFFFEF2F2),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Cancel Leave Request', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  void _showAttachmentPreview(String attachmentPath) {
    String fullUrl = attachmentPath;
    if (!fullUrl.startsWith('http')) {
      final base = widget.leaveService.baseUrl.replaceAll(RegExp(r'/+$'), '');
      fullUrl = '$base/${attachmentPath.replaceAll(RegExp(r'^/+'), '')}';
    }

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Attachment Preview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 450),
                child: InteractiveViewer(
                  child: Image.network(
                    fullUrl,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.broken_image_rounded, size: 48, color: Colors.grey),
                          SizedBox(height: 12),
                          Text('Unable to display attachment preview.', style: TextStyle(color: Colors.grey, fontSize: 13)),
                        ],
                      ),
                    ),
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPopupDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF64748B),
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
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
        controller: _holidaysScrollController,
        cacheExtent: 5000,
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: !_isPrincipal ? 88 : 16,
        ),
        itemCount: _holidays.length,
        itemBuilder: (context, index) {
          final holiday = _holidays[index];
          final String hName = holiday['name'] ?? 'Holiday';
          final String hDateStr = holiday['date'] ?? '';

          // Determine status
          bool isToday = hDateStr == todayStr;
          bool isUpcoming = false;
          bool isPast = false;
          try {
            if (!isToday && hDateStr.isNotEmpty) {
              final hDate = DateTime.parse(hDateStr);
              final todayDate = DateTime.parse(todayStr);
              if (hDate.isAfter(todayDate)) {
                isUpcoming = true;
              } else if (hDate.isBefore(todayDate)) {
                isPast = true;
              }
            }
          } catch (_) {}

          // Styling variables
          Color borderColor = const Color(0xFFE2E8F0);
          double borderWidth = 1.0;
          Color bgColor = Colors.white;
          Widget? badge;

          if (isToday) {
            borderColor = const Color(0xFF16A34A);
            borderWidth = 1.8;
            bgColor = const Color(0xFFF0FDF4);
            badge = Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Today',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            );
          } else if (isUpcoming) {
            // Yellow/amber highlight according to platform theme
            borderColor = const Color(0xFFF59E0B);
            borderWidth = 1.6;
            bgColor = const Color(0xFFFFFBEB);
            badge = Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Upcoming',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
              ),
            );
          } else if (isPast) {
            // Past leaves highlighted with green border
            borderColor = const Color(0xFF22C55E);
            borderWidth = 1.3;
            bgColor = Colors.white;
          }

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: borderWidth),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
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
                                  color: Color(0xFF0F172A),
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
                            const Icon(Icons.calendar_month_rounded, size: 14, color: Color(0xFF64748B)),
                            const SizedBox(width: 6),
                            Text(
                              _formatDate(hDateStr),
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
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

  // Custom Curved Dropdown Helper matching modern app design system
  Widget _buildCurvedDropdown({
    required BuildContext context,
    required String value,
    required Map<String, String> items,
    required ValueChanged<String> onChanged,
  }) {
    final displayText = items[value] ?? value;
    return Builder(
      builder: (btnContext) {
        return InkWell(
          onTap: () async {
            FocusScope.of(context).unfocus();
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

            final selected = await showMenu<String>(
              context: context,
              position: position,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.white,
              surfaceTintColor: Colors.transparent,
              elevation: 6,
              constraints: BoxConstraints(
                minWidth: size.width < 140 ? 140 : size.width,
                maxWidth: size.width < 180 ? 180 : size.width,
                maxHeight: 280,
              ),
              items: items.entries.map((entry) {
                final isSelected = entry.key == value;
                return PopupMenuItem<String>(
                  value: entry.key,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFFEF3C7) : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          entry.value,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
                          ),
                        ),
                        if (isSelected)
                          const Icon(Icons.check_rounded, size: 16, color: Color(0xFFD97706)),
                      ],
                    ),
                  ),
                );
              }).toList(),
            );

            if (selected != null && selected != value) {
              onChanged(selected);
            }
          },
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  displayText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 20,
                color: Color(0xFF475569),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPrincipalHeaderFilters() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // 1. Status Dropdown (Equal 50% width, curved dropdown with no clipping)
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
              ),
              child: _buildCurvedDropdown(
                context: context,
                value: _statusFilter,
                items: const {
                  'ALL': 'All',
                  'PENDING': 'Pending',
                  'APPROVED': 'Approved',
                  'REJECTED': 'Rejected',
                },
                onChanged: (val) {
                  setState(() {
                    _statusFilter = val;
                  });
                },
              ),
            ),
          ),
          const SizedBox(width: 12),

          // 2. Teacher/Student Dropdown (Equal 50% width, curved dropdown with no clipping)
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
              ),
              child: _buildCurvedDropdown(
                context: context,
                value: _roleFilter,
                items: const {
                  'ALL': 'All',
                  'TEACHER': 'Teacher',
                  'STUDENT': 'Student',
                },
                onChanged: (val) {
                  setState(() {
                    _roleFilter = val;
                  });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestsTab() {
    if (_isLoadingLeaves) {
      return const Center(child: CircularProgressIndicator());
    }

    final leavesToDisplay = _isPrincipal ? _filteredLeaves : _leaves;

    Widget content;
    if (leavesToDisplay.isEmpty) {
      content = Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              _isPrincipal ? 'No Matching Leave Requests' : 'No Leaves Registered',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _isPrincipal
                  ? 'Try adjusting your filters or search query.'
                  : 'Apply for leave by tapping the button below.',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
      );
    } else {
      content = RefreshIndicator(
        onRefresh: _loadLeaves,
        child: ListView.builder(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 14,
            bottom: _isPrincipal ? 24 : 88,
          ),
          itemCount: leavesToDisplay.length,
          itemBuilder: (context, index) {
            final leave = leavesToDisplay[index];
            final bool isStudent = leave.applicantRole.toUpperCase() == 'STUDENT';
            final bool isTeacher = leave.applicantRole.toUpperCase() == 'TEACHER';

            final String applicantName = isTeacher
                ? (leave.teacherName ?? 'Teacher')
                : (leave.studentName ?? (isStudent ? 'Student' : 'Staff'));

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: () => _showLeaveDetails(leave),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Top row: Avatar + Name & Class & Days count + Status badge
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ProfileAvatarView(
                              photoUrl: leave.photoPath ?? '',
                              baseUrl: widget.leaveService.baseUrl,
                              name: applicantName,
                              size: 46,
                              entityType: isTeacher ? 'teacher' : 'student',
                              enableZoom: true,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          applicantName,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            color: Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: _getStatusBgColor(leave.status),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: _getStatusBorderColor(leave.status)),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(_getStatusIcon(leave.status), size: 11, color: _getStatusColor(leave.status)),
                                            const SizedBox(width: 4),
                                            Text(
                                              leave.status.toUpperCase(),
                                              style: TextStyle(
                                                color: _getStatusColor(leave.status),
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (isTeacher && leave.formattedEmpId != null && leave.formattedEmpId!.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'EMP ID: ${leave.formattedEmpId}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                  ] else if (isStudent && leave.classLabel != null && leave.classLabel!.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        Text(
                                          leave.classLabel!,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                        if (leave.rollNo != null && leave.rollNo!.trim().isNotEmpty) ...[
                                          const SizedBox(width: 6),
                                          Text(
                                            '•  Roll No: ${leave.rollNo}',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF64748B),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 10),
                        // Bottom row: Leave Type + Details button
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.event_note_rounded, size: 14, color: Color(0xFF64748B)),
                                const SizedBox(width: 5),
                                Text(
                                  _formatLeaveDays(leave.fromDate, leave.toDate),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF475569),
                                  ),
                                ),
                              ],
                            ),
                            ElevatedButton(
                              onPressed: () => _showLeaveDetails(leave),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFD97706),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              child: const Text(
                                'Details',
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
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
      );
    }

    if (_isPrincipal) {
      return Column(
        children: [
          _buildPrincipalHeaderFilters(),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Expanded(child: content),
        ],
      );
    }

    // For non-principal users (Teachers, Parents, Students), content is returned
    return content;
  }

  void _showApplyLeaveBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ApplyLeaveBottomSheet(
        leaveService: widget.leaveService,
        userRole: widget.userRole,
        selectedStudentId: widget.selectedStudentId,
        onSuccess: () {
          _loadLeaves();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F2),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Icon(Icons.date_range_rounded, color: Color(0xFFD97706), size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'LEAVES',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 16,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          if (_isPrincipal)
            AnimatedBuilder(
              animation: _tabController.animation ?? _tabController,
              builder: (context, child) {
                final double animValue =
                    _tabController.animation?.value ?? _tabController.index.toDouble();
                if (animValue >= 0.15) {
                  return const SizedBox.shrink();
                }
                final double opacity = (1.0 - (animValue / 0.15)).clamp(0.0, 1.0);
                return Opacity(
                  opacity: opacity,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 14, top: 9, bottom: 9),
                    child: ElevatedButton.icon(
                      onPressed: _showAddHolidaySheet,
                      icon: const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                      label: const Text(
                        'Add Leave',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFD97706),
          indicatorWeight: 3,
          labelColor: const Color(0xFFD97706),
          unselectedLabelColor: const Color(0xFF64748B),
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Official Holidays'),
            Tab(text: 'Leave Requests'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildHolidaysTab(),
          _buildRequestsTab(),
        ],
      ),
      bottomNavigationBar: !_isPrincipal
          ? AnimatedBuilder(
              animation: _tabController.animation ?? _tabController,
              builder: (context, child) {
                final animValue = _tabController.animation?.value ?? _tabController.index.toDouble();
                if (animValue <= 0.5) {
                  return const SizedBox.shrink();
                }
                return Container(
                  color: Colors.white,
                  padding: EdgeInsets.fromLTRB(
                    16,
                    10,
                    16,
                    MediaQuery.of(context).padding.bottom > 0
                        ? MediaQuery.of(context).padding.bottom + 6
                        : 14,
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD97706).withOpacity(0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: _showApplyLeaveBottomSheet,
                        icon: const Icon(Icons.add_rounded, size: 20, color: Colors.white),
                        label: const Text(
                          'Apply for Leave',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                            color: Colors.white,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            )
          : null,
    );
  }
}
