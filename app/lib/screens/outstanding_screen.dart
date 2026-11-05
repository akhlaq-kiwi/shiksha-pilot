import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/http_service.dart' as http;
import '../utils/class_formatter.dart';
import 'full_screen_image_screen.dart';

class OutstandingScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const OutstandingScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  });

  @override
  State<OutstandingScreen> createState() => _OutstandingScreenState();
}

class _OutstandingScreenState extends State<OutstandingScreen> {
  bool _isLoading = true;
  String _errorMessage = '';

  bool _hasClass = false;
  String _fullClassName = '';
  int? _selectedClassId;
  List<dynamic> _assignedClasses = [];
  List<dynamic> _allStudents = [];
  List<dynamic> _filteredStudents = [];
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchOutstandingData();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredStudents = List.from(_allStudents);
      } else {
        _filteredStudents = _allStudents.where((stu) {
          final name = (stu['name'] ?? '').toString().toLowerCase();
          final rollNo = (stu['roll_no'] ?? '').toString().toLowerCase();
          return name.contains(query) || rollNo.contains(query);
        }).toList();
      }
    });
  }

  Future<void> _fetchOutstandingData([int? targetClassId]) async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final cid = targetClassId ?? _selectedClassId;
      final String url = cid != null
          ? '${widget.baseUrl}/api/teacher/outstanding?class_id=$cid'
          : '${widget.baseUrl}/api/teacher/outstanding';

      final uri = Uri.parse(url);
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      };

      final response = await http.get(uri, headers: headers);

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? {};

        final bool hasClass = data['has_class'] == true;
        final String fullClassName = formatShortClassName((data['full_class_name'] ?? data['class_name'] ?? '').toString());
        final List<dynamic> studentsList = data['students'] ?? [];
        final List<dynamic> assignedCls = data['assigned_classes'] ?? [];
        final int? returnedClassId = data['class_id'] is int ? data['class_id'] : int.tryParse(data['class_id']?.toString() ?? '');

        setState(() {
          _hasClass = hasClass;
          _fullClassName = fullClassName;
          _assignedClasses = assignedCls;
          _selectedClassId = returnedClassId ?? cid;
          _allStudents = studentsList;
          _filteredStudents = List.from(studentsList);
        });
      } else {
        final decoded = json.decode(response.body);
        setState(() {
          _errorMessage = decoded['message'] ?? 'Failed to load outstanding data.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  String _formatAmount(dynamic amount) {
    try {
      final int val = (amount is int) ? amount : (double.tryParse(amount?.toString() ?? '0')?.round() ?? 0);
      final String str = val.abs().toString();
      final RegExp reg = RegExp(r'(\d+?)(?=(\d{3})+(?!\d))');
      final String formatted = str.replaceAllMapped(reg, (Match m) => '${m[1]},');
      return '${val < 0 ? '-' : ''}₹$formatted';
    } catch (_) {
      return '₹$amount';
    }
  }

  String _resolvePhotoUrl(String photoPath) {
    final trimmed = photoPath.trim();
    if (trimmed.isEmpty || trimmed == 'null' || trimmed == '—') {
      return '';
    }
    if (trimmed.startsWith('http')) {
      return trimmed;
    }
    final cleanBase = widget.baseUrl.replaceAll(RegExp(r'/+$'), '');
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$cleanBase$cleanPath';
  }

  Widget _buildStudentAvatar(Map<String, dynamic> student, bool hasDues) {
    final String name = (student['name'] ?? 'Student').toString();
    final String photoPath = (student['photo_path'] ?? '').toString();
    final dynamic studentId = student['id'];
    final String fullUrl = _resolvePhotoUrl(photoPath);
    final String heroTag = 'outstanding_avatar_${studentId ?? name}';

    final initials = name.trim().split(' ').where((w) => w.isNotEmpty).map((w) => w[0]).take(2).join('').toUpperCase();
    final String displayInitials = initials.isNotEmpty ? initials : 'S';

    final Color bgColor = hasDues ? const Color(0xFFFEF3C7) : const Color(0xFFE0F2FE);
    final Color borderColor = hasDues ? const Color(0xFFFDE68A) : const Color(0xFFBAE6FD);
    final Color textColor = hasDues ? const Color(0xFFB45309) : const Color(0xFF0369A1);

    final Widget placeholderWidget = Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: bgColor,
        border: Border.all(color: borderColor, width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        displayInitials,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: textColor,
          fontSize: displayInitials.length > 1 ? 17 : 20,
        ),
      ),
    );

    return GestureDetector(
      onTap: () {
        if (fullUrl.isNotEmpty) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => FullScreenImageScreen(
                imageUrl: fullUrl,
                title: name,
                heroTag: heroTag,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No profile photo uploaded for this student.'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );
        }
      },
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: bgColor,
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: ClipOval(
          child: fullUrl.isNotEmpty
              ? Hero(
                  tag: heroTag,
                  child: CachedNetworkImage(
                    imageUrl: fullUrl,
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => placeholderWidget,
                    errorWidget: (context, url, error) => placeholderWidget,
                  ),
                )
              : placeholderWidget,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final String rawTitle = _hasClass && _fullClassName.isNotEmpty
        ? 'Outstanding for $_fullClassName'
        : 'Outstanding';
    final String titleText = rawTitle.toUpperCase();

    return Scaffold(
      backgroundColor: const Color(0xFFFAF9F6),
      appBar: AppBar(
        elevation: 0.5,
        backgroundColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          titleText,
          style: const TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w800,
            fontSize: 16.5,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFD97706)),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFDC2626)),
              const SizedBox(height: 12),
              Text(
                _errorMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _fetchOutstandingData,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w800)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (!_hasClass) {
      return RefreshIndicator(
        onRefresh: _fetchOutstandingData,
        color: const Color(0xFFD97706),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Container(
            height: MediaQuery.of(context).size.height * 0.75,
            alignment: Alignment.center,
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEF3C7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.class_outlined, size: 56, color: Color(0xFFD97706)),
                ),
                const SizedBox(height: 20),
                const Text(
                  'No Class Assigned',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'You are currently not assigned as a class teacher to any class.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        // Class Selection Dropdown if teacher has multiple classes assigned
        if (_assignedClasses.length > 1)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
              ),
              child: Row(
                children: [
                  const Icon(Icons.school_outlined, color: Color(0xFFD97706), size: 20),
                  const SizedBox(width: 10),
                  const Text(
                    'Class:',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFFB45309)),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    fit: FlexFit.loose,
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: _selectedClassId,
                        isExpanded: false,
                        icon: const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFFD97706)),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF0F172A), fontSize: 13.5),
                        items: sortClassesAscending(_assignedClasses).map((cls) {
                          final int id = cls['id'] is int ? cls['id'] : int.parse(cls['id'].toString());
                          final String rawName = (cls['full_class_name'] ?? cls['name'] ?? 'Class').toString();
                          final String sec = (cls['section'] ?? cls['class_section'] ?? '').toString();
                          final String name = formatShortClassName(rawName, section: sec);
                          return DropdownMenuItem<int>(
                            value: id,
                            child: Text(name),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null && val != _selectedClassId) {
                            _fetchOutstandingData(val);
                          }
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

        // Search Box Container
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'Search by student name or roll no...',
                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500),
                prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: Color(0xFF64748B), size: 18),
                        onPressed: () => _searchController.clear(),
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),

        // Students List
        Expanded(
          child: RefreshIndicator(
            onRefresh: _fetchOutstandingData,
            color: const Color(0xFFD97706),
            child: _filteredStudents.isEmpty
                ? SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Container(
                      height: MediaQuery.of(context).size.height * 0.5,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.search_off_rounded, size: 48, color: Color(0xFF94A3B8)),
                          const SizedBox(height: 12),
                          Text(
                            _searchController.text.isNotEmpty
                                ? 'No student found matching "${_searchController.text}"'
                                : 'No active students in this class.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 13.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                    itemCount: _filteredStudents.length,
                    itemBuilder: (context, index) {
                      final student = _filteredStudents[index] is Map ? Map<String, dynamic>.from(_filteredStudents[index]) : <String, dynamic>{};
                      final String name = (student['name'] ?? 'Student').toString();
                      final String rollNo = (student['roll_no'] ?? '').toString();
                      final int outstandingAmount = (student['outstanding_amount'] is int)
                          ? student['outstanding_amount']
                          : int.tryParse(student['outstanding_amount']?.toString() ?? '0') ?? 0;

                      final bool hasDues = outstandingAmount > 0;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: hasDues ? const Color(0xFFFED7AA) : const Color(0xFFE2E8F0),
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          child: Row(
                            children: [
                              // Avatar / Photo (size: 56, tap to view full image)
                              _buildStudentAvatar(student, hasDues),
                              const SizedBox(width: 14),

                              // Student Name & Roll No (Left Aligned)
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                    const SizedBox(height: 5),
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            rollNo.isNotEmpty ? 'Roll No: $rollNo' : 'Roll No: —',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF64748B),
                                              letterSpacing: 0.2,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(width: 12),

                              // Outstanding Amount Badge (Right Aligned)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: hasDues ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: hasDues ? const Color(0xFFFECACA) : const Color(0xFFA7F3D0),
                                  ),
                                ),
                                child: Text(
                                  _formatAmount(outstandingAmount),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 15,
                                    color: hasDues ? const Color(0xFFDC2626) : const Color(0xFF059669),
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
