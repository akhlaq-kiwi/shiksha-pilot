import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;
import 'notice_screen.dart';
import 'timetable_screen.dart';
import 'leave_list_screen.dart';
import '../services/leave_service.dart';
import 'exam_list_screen.dart';
import 'exam_detail_screen.dart';
import '../services/exam_service.dart';
import 'fees_card_screen.dart';

class NotificationCenterScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final int? studentId;
  final String? userRole;
  final bool isEmbedded;

  const NotificationCenterScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    this.studentId,
    this.userRole,
    this.isEmbedded = false,
  }) : super(key: key);

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 10;
  String _errorText = '';

  @override
  void initState() {
    super.initState();
    _fetchInitialNotifications();
    _markAllRead();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 100 &&
        !_isLoadingMore &&
        !_isLoading &&
        _hasMore) {
      _fetchMoreNotifications();
    }
  }

  Future<void> _fetchInitialNotifications() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
      _offset = 0;
      _hasMore = true;
      _notifications = [];
    });
    try {
      final isStaff = widget.studentId == null;
      final endpoint = isStaff ? '/api/school/notifications' : '/api/student/notifications';
      final uri = Uri.parse('${widget.baseUrl}$endpoint?limit=$_limit&offset=0');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        List<dynamic> fetched = [];
        if (decoded['data'] is List) {
          fetched = decoded['data'];
        } else if (decoded['data'] is Map && decoded['data']['notifications'] != null) {
          fetched = decoded['data']['notifications'];
        }
        setState(() {
          _notifications = fetched;
          _isLoading = false;
          _offset = fetched.length;
          if (fetched.length < _limit) {
            _hasMore = false;
          }
        });
      } else {
        setState(() {
          _errorText = 'Failed to load notifications';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorText = 'An error occurred. Please check connection.';
        _isLoading = false;
      });
    }
  }

  Future<void> _fetchMoreNotifications() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() {
      _isLoadingMore = true;
    });

    try {
      final isStaff = widget.studentId == null;
      final endpoint = isStaff ? '/api/school/notifications' : '/api/student/notifications';
      final uri = Uri.parse('${widget.baseUrl}$endpoint?limit=$_limit&offset=$_offset');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        List<dynamic> fetched = [];
        if (decoded['data'] is List) {
          fetched = decoded['data'];
        } else if (decoded['data'] is Map && decoded['data']['notifications'] != null) {
          fetched = decoded['data']['notifications'];
        }
        setState(() {
          _notifications.addAll(fetched);
          _offset += fetched.length;
          _isLoadingMore = false;
          if (fetched.length < _limit) {
            _hasMore = false;
          }
        });
      } else {
        setState(() {
          _isLoadingMore = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _deleteNotification(int id, int index) async {
    final deletedItem = _notifications[index];
    setState(() {
      _notifications.removeAt(index);
    });

    try {
      final isStaff = widget.studentId == null;
      final endpoint = isStaff ? '/api/school/notifications/$id' : '/api/student/notifications/$id';
      final uri = Uri.parse('${widget.baseUrl}$endpoint');
      final response = await http.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Notification permanently deleted.'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Colors.red,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        if (mounted) {
          setState(() {
            _notifications.insert(index, deletedItem);
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to delete notification.'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _notifications.insert(index, deletedItem);
        });
      }
    }
  }

  Future<void> _markAllRead() async {
    try {
      final isStaff = widget.studentId == null;
      final endpoint = isStaff ? '/api/school/notifications/read-all' : '/api/student/notifications/read-all';
      final uri = Uri.parse('${widget.baseUrl}$endpoint');
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
        },
      );
    } catch (e) {
      // Ignore
    }
  }

  String _formatDateTime(String? createdDate) {
    if (createdDate == null || createdDate.trim().isEmpty) return '—';
    try {
      final dt = DateTime.parse(createdDate.replaceFirst(' ', 'T'));
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final day = dt.day.toString().padLeft(2, '0');
      final month = months[dt.month - 1];
      final year = dt.year;

      int hour = dt.hour;
      final minute = dt.minute.toString().padLeft(2, '0');
      final ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour == 0) hour = 12;
      final hourStr = hour.toString().padLeft(2, '0');

      return '$day $month $year, $hourStr:$minute $ampm';
    } catch (_) {
      return createdDate;
    }
  }

  String _getDynamicNotificationHeading(dynamic notif) {
    final title = (notif['title'] ?? '').toString().toLowerCase();
    final message = (notif['message'] ?? '').toString().toLowerCase();
    final link = (notif['link'] ?? '').toString().toLowerCase();

    if (link.contains('leave') || title.contains('leave') || message.contains('leave') ||
        link.contains('holiday') || title.contains('holiday') || message.contains('holiday')) {
      return 'Leave Notification';
    } else if (link.contains('attendance') || title.contains('attendance') || message.contains('attendance')) {
      return 'Attendance Notification';
    } else if (link.contains('fee') || title.contains('fee') || message.contains('fee')) {
      return 'Fee Notification';
    } else if (link.contains('timetable') || title.contains('timetable') || message.contains('timetable')) {
      return 'Timetable Notification';
    }
    return notif['title'] ?? 'Notification';
  }

  @override
  Widget build(BuildContext context) {
    final Widget bodyContent = _isLoading
        ? const Center(child: CircularProgressIndicator(color: Colors.indigo))
        : _errorText.isNotEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_errorText, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _fetchInitialNotifications,
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            : _notifications.isEmpty
                ? RefreshIndicator(
                    onRefresh: _fetchInitialNotifications,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: Container(
                        height: MediaQuery.of(context).size.height * 0.7,
                        alignment: Alignment.center,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.notifications_off_outlined, size: 64, color: Colors.grey.shade400),
                            const SizedBox(height: 16),
                            Text(
                              'No new notifications',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _fetchInitialNotifications,
                    child: ListView.builder(
                      controller: _scrollController,
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      itemCount: _notifications.length + (_isLoadingMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _notifications.length) {
                          return Container(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.indigo),
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'Loading Notifications...',
                                  style: TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ],
                            ),
                          );
                        }

                        final notif = _notifications[index];
                        final isUnread = notif['is_read'] == 0 || notif['is_read'] == false || notif['is_read'] == '0';
                        final notifId = (notif['id'] is int) ? notif['id'] as int : int.tryParse(notif['id'].toString()) ?? index;

                        return Dismissible(
                          key: Key('notif_$notifId'),
                          direction: DismissDirection.startToEnd, // Right swipe delete
                          background: Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.only(left: 24),
                            decoration: BoxDecoration(
                              color: Colors.red.shade600,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.delete_forever_rounded, color: Colors.white, size: 26),
                                SizedBox(width: 8),
                                Text(
                                  'DELETE',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                                ),
                              ],
                            ),
                          ),
                          onDismissed: (direction) {
                            _deleteNotification(notifId, index);
                          },
                          child: Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 1,
                          color: isUnread ? Colors.indigo.shade50.withOpacity(0.4) : Colors.white,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () async {
                              final titleLower = (notif['title'] ?? '').toString().toLowerCase();
                              final msgLower = (notif['message'] ?? '').toString().toLowerCase();
                              final linkStr = (notif['link'] ?? '').toString().toLowerCase();

                              // Instantly mark notification as read in UI state
                              setState(() {
                                notif['is_read'] = 1;
                              });

                              // Fire background API call to update notification state to read
                              try {
                                final isSchoolStaff = widget.studentId == null;
                                final path = isSchoolStaff 
                                    ? '/api/school/notifications/${notif['id']}/read'
                                    : '/api/student/notifications/${notif['id']}/read';
                                final uri = Uri.parse('${widget.baseUrl}$path');
                                final headers = {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ${widget.token}',
                                  if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
                                };
                                http.post(uri, headers: headers).catchError((_) => http.Response('', 500));
                              } catch (_) {}

                              final isHolidayNotif = titleLower.contains('holiday') || msgLower.contains('holiday');
                              if (linkStr.contains('leaves') || titleLower.contains('leave') || msgLower.contains('leave') || isHolidayNotif) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => LeaveListScreen(
                                      leaveService: LeaveService(baseUrl: widget.baseUrl, token: widget.token),
                                      userRole: widget.studentId != null ? 'PARENT' : 'TEACHER',
                                      selectedStudentId: widget.studentId,
                                      initialTabIndex: isHolidayNotif ? 0 : 1,
                                    ),
                                  ),
                                );
                                return;
                              }

                              if (linkStr.contains('timetable') || titleLower.contains('timetable') || msgLower.contains('timetable')) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => TimetableScreen(
                                      baseUrl: widget.baseUrl,
                                      token: widget.token,
                                      userRole: widget.studentId != null ? 'PARENT' : 'TEACHER',
                                      selectedStudentId: widget.studentId,
                                    ),
                                  ),
                                );
                                return;
                              }

                              if (linkStr.contains('exams') || titleLower.contains('admit card') || msgLower.contains('admit card') || titleLower.contains('exam') || msgLower.contains('exam')) {
                                showDialog(
                                  context: context,
                                  barrierDismissible: false,
                                  builder: (context) => const Center(child: CircularProgressIndicator()),
                                );

                                try {
                                  final examService = ExamService(
                                    baseUrl: widget.baseUrl,
                                    token: widget.token,
                                  );
                                  final effectiveRole = widget.userRole ?? (widget.studentId != null ? 'PARENT' : 'TEACHER');
                                  final exams = await examService.getExamsList(effectiveRole, widget.studentId);
                                  
                                  if (Navigator.canPop(context)) {
                                    Navigator.pop(context);
                                  }

                                  final targetExam = exams.firstWhere(
                                    (e) => e['name'].toString().trim().toLowerCase() == notif['title'].toString().trim().toLowerCase(),
                                    orElse: () => null,
                                  );

                                  if (context.mounted) {
                                    if (targetExam != null) {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => ExamDetailScreen(
                                            examService: examService,
                                            examId: targetExam['id'] as int,
                                            examName: targetExam['name'] ?? 'Exam Detail',
                                            userRole: effectiveRole,
                                            studentId: widget.studentId,
                                          ),
                                        ),
                                      );
                                    } else {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => ExamListScreen(
                                            examService: examService,
                                            userRole: effectiveRole,
                                            selectedStudentId: widget.studentId,
                                          ),
                                        ),
                                      );
                                    }
                                  }
                                } catch (_) {
                                  if (Navigator.canPop(context)) {
                                    Navigator.pop(context);
                                  }
                                  if (context.mounted) {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => ExamListScreen(
                                          examService: ExamService(
                                            baseUrl: widget.baseUrl,
                                            token: widget.token,
                                          ),
                                          userRole: widget.studentId != null ? 'PARENT' : 'STUDENT',
                                          selectedStudentId: widget.studentId,
                                        ),
                                      ),
                                    );
                                  }
                                }
                                return;
                              }

                              if (linkStr.contains('fees') || titleLower.contains('fee') || msgLower.contains('fee')) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => FeesCardScreen(
                                      baseUrl: widget.baseUrl,
                                      token: widget.token,
                                      studentId: widget.studentId,
                                    ),
                                  ),
                                );
                                return;
                              }

                              showDialog(
                                context: context,
                                barrierDismissible: false,
                                builder: (context) => const Center(child: CircularProgressIndicator()),
                              );

                              try {
                                final noticesUri = Uri.parse('${widget.baseUrl}/api/student/announcements');
                                final headers = {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ${widget.token}',
                                  if (widget.studentId != null) 'X-Student-Id': widget.studentId.toString(),
                                };
                                final response = await http.get(noticesUri, headers: headers);
                                
                                if (Navigator.canPop(context)) {
                                  Navigator.pop(context);
                                }

                                if (response.statusCode == 200) {
                                  final decoded = json.decode(response.body);
                                  final List<dynamic> notices = decoded['data'] ?? decoded;
                                  
                                  final matchingNotice = notices.firstWhere(
                                    (n) => n['subject'].toString().trim().toLowerCase() == notif['title'].toString().trim().toLowerCase(),
                                    orElse: () => null,
                                  );

                                  if (matchingNotice != null) {
                                    final int noticeId = matchingNotice['id'] as int;
                                    final readUri = Uri.parse('${widget.baseUrl}/api/student/announcements/$noticeId/read');
                                    await http.post(readUri, headers: headers);

                                    if (context.mounted) {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => NoticeDetailsScreen(
                                            subject: matchingNotice['subject'] ?? '',
                                            description: matchingNotice['description'] ?? '',
                                            publishDate: _formatDate(matchingNotice['created_at']),
                                          ),
                                        ),
                                      );
                                    }
                                  } else {
                                    if (context.mounted) {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => NoticeScreen(
                                            baseUrl: widget.baseUrl,
                                            token: widget.token,
                                            userRole: widget.studentId != null ? 'PARENT' : 'STUDENT',
                                            studentId: widget.studentId,
                                          ),
                                        ),
                                      );
                                    }
                                  }
                                }
                              } catch (e) {
                                if (Navigator.canPop(context)) {
                                  Navigator.pop(context);
                                }
                                if (context.mounted) {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => NoticeScreen(
                                        baseUrl: widget.baseUrl,
                                        token: widget.token,
                                        userRole: widget.studentId != null ? 'PARENT' : 'STUDENT',
                                        studentId: widget.studentId,
                                      ),
                                    ),
                                  );
                                }
                              }
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: isUnread ? Colors.indigo.shade100 : Colors.grey.shade100,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      notif['title'].toString().contains('Fee')
                                          ? Icons.payments_rounded
                                          : Icons.notifications_rounded,
                                      color: isUnread ? Colors.indigo : Colors.grey.shade600,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                _getDynamicNotificationHeading(notif),
                                                style: TextStyle(
                                                  fontSize: 15,
                                                  fontWeight: isUnread ? FontWeight.w800 : FontWeight.bold,
                                                  color: Colors.black87,
                                                ),
                                              ),
                                            ),
                                            if (isUnread)
                                              Container(
                                                width: 8,
                                                height: 8,
                                                decoration: const BoxDecoration(
                                                  color: Colors.red,
                                                  shape: BoxShape.circle,
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          notif['message'] ?? '',
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            color: Colors.grey.shade700,
                                            height: 1.3,
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        Text(
                                          _formatDateTime(notif['created_at']),
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey.shade500,
                                            fontWeight: FontWeight.bold,
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

    if (widget.isEmbedded) {
      return bodyContent;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.w900, color: Colors.black87),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: bodyContent,
    );
  }
}
