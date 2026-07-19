import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class NoticeScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? studentId;

  const NoticeScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.studentId,
  }) : super(key: key);

  @override
  State<NoticeScreen> createState() => _NoticeScreenState();
}

class _NoticeScreenState extends State<NoticeScreen> {
  List<dynamic> _allNotices = [];
  List<dynamic> _filteredNotices = [];
  bool _isLoading = true;
  String _errorText = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchNotices();
    _searchController.addListener(_filterNotices);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchNotices() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/student/announcements');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
        if (widget.userRole.toUpperCase() == 'PARENT' && widget.studentId != null)
          'X-Student-Id': widget.studentId.toString(),
      };

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final List<dynamic> data = decoded['data'] ?? [];
        if (mounted) {
          setState(() {
            _allNotices = data;
            _filteredNotices = data;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _errorText = 'Unable to load announcements.\nPlease check your internet connection.';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorText = 'Unable to load announcements.\nPlease check your internet connection.';
          _isLoading = false;
        });
      }
    }
  }

  void _filterNotices() {
    final query = _searchController.text.toLowerCase().trim();
    if (query.isEmpty) {
      setState(() {
        _filteredNotices = _allNotices;
      });
      return;
    }

    setState(() {
      _filteredNotices = _allNotices.where((notice) {
        final subject = (notice['subject'] ?? '').toString().toLowerCase();
        final description = (notice['description'] ?? '').toString().toLowerCase();
        return subject.contains(query) || description.contains(query);
      }).toList();
    });
  }

  Future<void> _markAsRead(int noticeId) async {
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/student/announcements/$noticeId/read');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      };

      final response = await http.post(uri, headers: headers);
      if (response.statusCode == 200) {
        // Update local list read state
        setState(() {
          for (var notice in _allNotices) {
            if (notice['id'] == noticeId) {
              notice['is_read'] = 1;
            }
          }
          _filterNotices();
        });
      }
    } catch (e) {
      // Ignore background marking failure
    }
  }

  String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return '${date.day} ${months[date.month - 1]} ${date.year}';
    } catch (e) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Notice Board',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        backgroundColor: Colors.indigo.shade800,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Search box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.indigo.shade900,
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search notices...',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 14),
                prefixIcon: const Icon(Icons.search, color: Colors.white70, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white70, size: 18),
                        onPressed: () {
                          _searchController.clear();
                        },
                      )
                    : null,
                filled: true,
                fillColor: Colors.white.withOpacity(0.15),
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Main body area
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.indigo),
                  )
                : _errorText.isNotEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.wifi_off_rounded, size: 64, color: Colors.grey.shade400),
                              const SizedBox(height: 16),
                              Text(
                                _errorText,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 14, color: Colors.black54, height: 1.5, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 24),
                              ElevatedButton.icon(
                                onPressed: _fetchNotices,
                                icon: const Icon(Icons.refresh_rounded, size: 18),
                                label: const Text('RETRY'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.indigo.shade800,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredNotices.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.campaign_outlined, size: 72, color: Colors.grey.shade300),
                                  const SizedBox(height: 18),
                                  const Text(
                                    'No Announcements Available',
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'There are currently no announcements for you.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 13, color: Colors.grey),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchNotices,
                            child: ListView.builder(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(12),
                              itemCount: _filteredNotices.length,
                              itemBuilder: (context, index) {
                                final notice = _filteredNotices[index];
                                final int noticeId = notice['id'] as int;
                                final String subject = notice['subject'] ?? '';
                                final String description = notice['description'] ?? '';
                                final String dateStr = notice['created_at'] ?? '';
                                final bool isRead = (notice['is_read'] ?? 0) == 1;

                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  elevation: 2,
                                  shadowColor: Colors.black26,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () {
                                      if (!isRead) {
                                        _markAsRead(noticeId);
                                      }
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => NoticeDetailsScreen(
                                            subject: subject,
                                            description: description,
                                            publishDate: _formatDate(dateStr),
                                          ),
                                        ),
                                      );
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                // Subject Header row
                                                Row(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    if (!isRead) ...[
                                                      Container(
                                                        margin: const EdgeInsets.only(top: 6, right: 8),
                                                        width: 8,
                                                        height: 8,
                                                        decoration: const BoxDecoration(
                                                          color: Colors.blue,
                                                          shape: BoxShape.circle,
                                                        ),
                                                      ),
                                                    ],
                                                    Expanded(
                                                      child: Text(
                                                        subject,
                                                        style: TextStyle(
                                                          fontSize: 15,
                                                          fontWeight: isRead ? FontWeight.bold : FontWeight.w900,
                                                          color: isRead ? Colors.black87 : Colors.indigo.shade900,
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                const SizedBox(height: 8),
                                                // Short snippet text
                                                Text(
                                                  _stripHtml(description),
                                                  maxLines: 3,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    color: Colors.grey.shade600,
                                                    height: 1.4,
                                                  ),
                                                ),
                                                const SizedBox(height: 12),
                                                // Date Footer
                                                Text(
                                                  _formatDate(dateStr),
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    color: Colors.grey.shade500,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Icon(
                                            Icons.chevron_right_rounded,
                                            color: Colors.grey.shade400,
                                          )
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Detailed Notice Screen
// -----------------------------------------------------------------------------
class NoticeDetailsScreen extends StatelessWidget {
  final String subject;
  final String description;
  final String publishDate;

  const NoticeDetailsScreen({
    Key? key,
    required this.subject,
    required this.description,
    required this.publishDate,
  }) : super(key: key);

  List<TextSpan> _parseHtml(String html, TextStyle baseStyle) {
    final List<TextSpan> spans = [];
    int index = 0;
    bool isBold = false;
    bool isItalic = false;
    bool isUnderline = false;

    final tagRegex = RegExp(r'<[^>]+>');
    final matches = tagRegex.allMatches(html);

    for (final match in matches) {
      if (match.start > index) {
        final text = html.substring(index, match.start);
        spans.add(_createTextSpan(text, baseStyle, isBold, isItalic, isUnderline));
      }

      final tag = match.group(0)!.toLowerCase();
      if (tag == '<b>' || tag == '<strong>') {
        isBold = true;
      } else if (tag == '</b>' || tag == '</strong>') {
        isBold = false;
      } else if (tag == '<i>' || tag == '<em>') {
        isItalic = true;
      } else if (tag == '</i>' || tag == '</em>') {
        isItalic = false;
      } else if (tag == '<u>') {
        isUnderline = true;
      } else if (tag == '</u>') {
        isUnderline = false;
      } else if (tag == '<br>' || tag == '<br />' || tag == '<br/>') {
        spans.add(const TextSpan(text: '\n'));
      } else if (tag == '<p>') {
        if (spans.isNotEmpty) {
          spans.add(const TextSpan(text: '\n'));
        }
      } else if (tag == '</p>') {
        spans.add(const TextSpan(text: '\n'));
      }

      index = match.end;
    }

    if (index < html.length) {
      final text = html.substring(index);
      spans.add(_createTextSpan(text, baseStyle, isBold, isItalic, isUnderline));
    }

    return spans;
  }

  TextSpan _createTextSpan(String text, TextStyle base, bool bold, bool italic, bool underline) {
    String decoded = text
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");

    return TextSpan(
      text: decoded,
      style: base.copyWith(
        fontWeight: bold ? FontWeight.bold : base.fontWeight,
        fontStyle: italic ? FontStyle.italic : base.fontStyle,
        decoration: underline ? TextDecoration.underline : base.decoration,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Notice Details',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        backgroundColor: Colors.indigo.shade800,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Subject Title Heading
            Text(
              subject,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: Colors.black87,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 10),

            // Published date header metadata
            Row(
              children: [
                Icon(Icons.calendar_today_rounded, size: 14, color: Colors.grey.shade500),
                const SizedBox(width: 6),
                Text(
                  publishDate,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),

            // Description styled text rendering
            RichText(
              text: TextSpan(
                children: _parseHtml(
                  description,
                  const TextStyle(
                    fontSize: 15,
                    color: Colors.black87,
                    height: 1.6,
                    fontFamily: 'Roboto',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
