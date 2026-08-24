import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/http_service.dart' as http;

class OutstandingScreen extends StatefulWidget {
  final String baseUrl;
  final String token;

  const OutstandingScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
  }) : super(key: key);

  @override
  State<OutstandingScreen> createState() => _OutstandingScreenState();
}

class _OutstandingScreenState extends State<OutstandingScreen> {
  bool _isLoading = true;
  String _errorMessage = '';
  
  bool _hasClass = false;
  String _fullClassName = '';
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

  Future<void> _fetchOutstandingData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/teacher/outstanding');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      };

      final response = await http.get(uri, headers: headers);

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? {};

        final bool hasClass = data['has_class'] == true;
        final String fullClassName = (data['full_class_name'] ?? data['class_name'] ?? '').toString();
        final List<dynamic> studentsList = data['students'] ?? [];

        setState(() {
          _hasClass = hasClass;
          _fullClassName = fullClassName;
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

  Widget _buildStudentAvatar(String photoPath, String name, bool hasDues) {
    final String initialText = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'S';
    final Color bgColor = hasDues ? Colors.amber.shade50 : Colors.indigo.shade50;
    final Color textColor = hasDues ? Colors.amber.shade900 : Colors.indigo;

    final Widget fallbackWidget = CircleAvatar(
      radius: 22,
      backgroundColor: bgColor,
      child: Text(
        initialText,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: textColor,
          fontSize: 16,
        ),
      ),
    );

    final String trimmedPath = photoPath.trim();
    if (trimmedPath.isEmpty) {
      return fallbackWidget;
    }

    String fullUrl = trimmedPath;
    if (!trimmedPath.startsWith('http')) {
      final String cleanPath = trimmedPath.startsWith('/') ? trimmedPath : '/$trimmedPath';
      fullUrl = '${widget.baseUrl}$cleanPath';
    }

    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: fullUrl,
        width: 44,
        height: 44,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: 44,
          height: 44,
          color: bgColor,
          alignment: Alignment.center,
          child: Text(
            initialText,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: textColor,
              fontSize: 16,
            ),
          ),
        ),
        errorWidget: (context, url, error) => fallbackWidget,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Top center title logic
    final String titleText = _hasClass && _fullClassName.isNotEmpty
        ? 'Outstanding for $_fullClassName'
        : 'Outstanding';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.indigo),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          titleText,
          style: const TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.indigo),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _errorMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _fetchOutstandingData,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
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
                  decoration: BoxDecoration(
                    color: Colors.indigo.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.class_outlined, size: 56, color: Colors.indigo.shade400),
                ),
                const SizedBox(height: 20),
                const Text(
                  'No Class Assigned',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
                const SizedBox(height: 8),
                Text(
                  'You are currently not assigned as a class teacher to any class.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        // Search Box Container
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search student by name or roll no...',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
              prefixIcon: const Icon(Icons.search_rounded, color: Colors.indigo),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, color: Colors.grey),
                      onPressed: () => _searchController.clear(),
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFFF1F5F9),
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),

        // Students List
        Expanded(
          child: RefreshIndicator(
            onRefresh: _fetchOutstandingData,
            color: Colors.indigo,
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
                          Icon(Icons.search_off_rounded, size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          Text(
                            _searchController.text.isNotEmpty
                                ? 'No student found matching "${_searchController.text}"'
                                : 'No active students in this class.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                    itemCount: _filteredStudents.length,
                    itemBuilder: (context, index) {
                      final student = _filteredStudents[index];
                      final String name = student['name'] ?? 'Student';
                      final String rollNo = (student['roll_no'] ?? '').toString();
                      final int outstandingAmount = (student['outstanding_amount'] is int)
                          ? student['outstanding_amount']
                          : int.tryParse(student['outstanding_amount']?.toString() ?? '0') ?? 0;
                      final String photoPath = student['photo_path'] ?? '';

                      final bool hasDues = outstandingAmount > 0;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: hasDues ? Colors.amber.shade200 : Colors.grey.shade200,
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.03),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          child: Row(
                            children: [
                              // Avatar / Photo
                              _buildStudentAvatar(photoPath, name, hasDues),
                              const SizedBox(width: 14),

                              // Student Name & Roll No (Left Aligned)
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                        color: Colors.black87,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      rollNo.isNotEmpty ? 'Roll No: $rollNo' : 'Roll No: N/A',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.grey.shade600,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(width: 12),

                              // Outstanding Amount (Right Aligned, Integer format, No Decimals)
                              Text(
                                _formatAmount(outstandingAmount),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: hasDues ? Colors.red.shade700 : Colors.green.shade700,
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
