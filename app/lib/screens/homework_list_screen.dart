import 'package:flutter/material.dart';
import '../services/homework_service.dart';
import '../widgets/create_edit_homework_modal.dart';
import 'attachment_gallery_screen.dart';

class HomeworkListScreen extends StatefulWidget {
  final String userRole;
  final int? selectedStudentId;
  final String baseUrl;

  const HomeworkListScreen({
    Key? key,
    required this.userRole,
    this.selectedStudentId,
    required this.baseUrl,
  }) : super(key: key);

  @override
  State<HomeworkListScreen> createState() => _HomeworkListScreenState();
}

class _HomeworkListScreenState extends State<HomeworkListScreen> {
  late HomeworkService _homeworkService;
  List<dynamic> _homeworkList = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initServiceAndFetch();
  }

  Future<void> _initServiceAndFetch() async {
    _homeworkService = await HomeworkService.create();
    _fetchHomework();
  }

  Future<void> _fetchHomework() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _homeworkService.fetchHomeworkList(
        userRole: widget.userRole,
        selectedStudentId: widget.selectedStudentId,
      );
      if (mounted) {
        setState(() {
          _homeworkList = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  bool get _isTeacher {
    final role = widget.userRole.toUpperCase();
    return role == 'TEACHER' || role == 'SCHOOL_ADMIN' || role == 'PRINCIPAL';
  }

  Future<void> _openCreateModal() async {
    final res = await CreateEditHomeworkModal.show(
      context,
      homeworkService: _homeworkService,
    );
    if (res == true) {
      _fetchHomework();
    }
  }

  Future<void> _openEditModal(Map<String, dynamic> homework) async {
    final res = await CreateEditHomeworkModal.show(
      context,
      homeworkService: _homeworkService,
      initialHomework: homework,
    );
    if (res == true) {
      _fetchHomework();
    }
  }

  Future<void> _confirmDelete(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Homework'),
        content: const Text('Are you sure you want to delete this homework? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _homeworkService.deleteHomework(id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Homework deleted successfully'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Colors.red,
              duration: Duration(seconds: 2),
            ),
          );
          _fetchHomework();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString().replaceAll('Exception: ', '')),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      }
    }
  }

  void _openGalleryView(List attachments, [int initialIndex = 0]) {
    if (attachments.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AttachmentGalleryScreen(
          attachments: attachments,
          initialIndex: initialIndex,
          baseUrl: widget.baseUrl,
        ),
      ),
    );
  }



  String _formatDateHeader(String rawDateStr) {
    if (rawDateStr.isEmpty) return 'Earlier';
    try {
      DateTime? dt;
      if (RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(rawDateStr)) {
        dt = DateTime.parse(rawDateStr);
      } else {
        final parts = rawDateStr.split(' ');
        if (parts.length >= 3) {
          final day = int.tryParse(parts[0]) ?? 1;
          final monthStr = parts[1].toLowerCase();
          final year = int.tryParse(parts[2]) ?? DateTime.now().year;
          final months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          final monthIndex = months.indexWhere((m) => monthStr.startsWith(m));
          if (monthIndex != -1) {
            dt = DateTime(year, monthIndex + 1, day);
          }
        }
      }

      if (dt == null) return rawDateStr;

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final targetDate = DateTime(dt.year, dt.month, dt.day);
      final diffDays = today.difference(targetDate).inDays;

      if (diffDays == 0) {
        return 'Today';
      } else if (diffDays == 1) {
        return 'Yesterday';
      } else if (diffDays > 1 && diffDays < 7) {
        final days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days[dt.weekday - 1];
      } else {
        return rawDateStr;
      }
    } catch (_) {
      return rawDateStr;
    }
  }

  Widget _buildDateHeader(String dateLabel) {
    return Center(
      child: Container(
        margin: const EdgeInsets.only(top: 8, bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          dateLabel,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Colors.grey.shade800,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text(
          'Homework',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      floatingActionButton: _isTeacher
          ? FloatingActionButton.extended(
              onPressed: _openCreateModal,
              backgroundColor: Colors.indigo,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Assign Homework', style: TextStyle(fontWeight: FontWeight.bold)),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _fetchHomework,
        color: Colors.indigo,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.indigo),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, size: 54, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchHomework,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (_homeworkList.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.25),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.menu_book_rounded, size: 64, color: Colors.indigo.shade200),
                const SizedBox(height: 16),
                Text(
                  'No Homework Assigned Yet',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _isTeacher
                      ? 'Tap "Assign Homework" to post your first assignment.'
                      : 'Check back later for new homework from your teachers.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _homeworkList.length,
      itemBuilder: (context, index) {
        final item = Map<String, dynamic>.from(_homeworkList[index]);
        final currentDateLabel = _formatDateHeader(item['assigned_date'] ?? '');

        bool showHeader = false;
        if (index == 0) {
          showHeader = true;
        } else {
          final prevItem = Map<String, dynamic>.from(_homeworkList[index - 1]);
          final prevDateLabel = _formatDateHeader(prevItem['assigned_date'] ?? '');
          if (currentDateLabel != prevDateLabel) {
            showHeader = true;
          }
        }

        if (showHeader) {
          return Column(
            children: [
              _buildDateHeader(currentDateLabel),
              _buildHomeworkCard(item),
            ],
          );
        }

        return _buildHomeworkCard(item);
      },
    );
  }

  Widget _buildHomeworkCard(Map<String, dynamic> item) {
    final int id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());
    final String title = item['title'] ?? '';
    final String description = item['description'] ?? '';
    final String className = item['class_name'] ?? '';
    final String assignedDate = item['assigned_date'] ?? '';
    final String assignedTime = item['assigned_time'] ?? '';
    final int attCount = item['attachments_count'] ?? 0;
    final List attachments = (item['attachments'] is List) ? item['attachments'] : [];

    final String subjectDisplay = title.isNotEmpty ? title : 'General';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: attachments.isNotEmpty ? () => _openGalleryView(attachments, 0) : null,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Row: Subject Name + Class/Teacher Subtitle + Actions (Edit / Delete)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.indigo.shade50,
                    radius: 20,
                    child: const Icon(Icons.menu_book_rounded, color: Colors.indigo, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Subject Name
                        Text(
                          subjectDisplay,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        if (_isTeacher) ...[
                          const SizedBox(height: 2),
                          Text(
                            className.isNotEmpty ? className : 'All Classes',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (_isTeacher) ...[
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, color: Colors.indigo, size: 20),
                      constraints: const BoxConstraints(),
                      padding: const EdgeInsets.all(6),
                      onPressed: () => _openEditModal(item),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
                      constraints: const BoxConstraints(),
                      padding: const EdgeInsets.all(6),
                      onPressed: () => _confirmDelete(id),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),

              // Description
              if (description.isNotEmpty) ...[
                SelectableText(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Attachment Count Badge (Click opens Gallery View)
              if (attachments.isNotEmpty) ...[
                const Divider(height: 1),
                const SizedBox(height: 10),
                InkWell(
                  onTap: () => _openGalleryView(attachments, 0),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.attach_file_rounded, size: 18, color: Colors.indigo),
                        const SizedBox(width: 6),
                        Text(
                          '$attCount ${attCount == 1 ? 'Attachment' : 'Attachments'}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.indigo,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.chevron_right_rounded, size: 18, color: Colors.indigo),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],

              // Footer: Date & Time
              const Divider(height: 1),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.calendar_today_rounded, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        assignedDate,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Icon(Icons.access_time_rounded, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        assignedTime,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
