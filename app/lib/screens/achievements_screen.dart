import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class AchievementsScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? studentId;

  const AchievementsScreen({
    Key? key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.studentId,
  }) : super(key: key);

  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isLoading = true;
  String _errorText = '';

  Map<String, dynamic> _data = {};
  List<dynamic> _achievements = [];
  List<dynamic> _classes = [];
  List<dynamic> _academicYears = [];

  String? _selectedYearId;
  String _selectedClassId = 'ALL';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchAchievements();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchAchievements() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/school/achievements').replace(
        queryParameters: {
          if (_selectedYearId != null) 'academic_year_id': _selectedYearId,
          if (_selectedClassId != 'ALL') 'class_id': _selectedClassId,
        },
      );

      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final resData = body['data'] ?? body;
        setState(() {
          _data = resData;
          _achievements = resData['achievements'] ?? [];
          _classes = resData['classes'] ?? [];
          _academicYears = resData['academic_years'] ?? [];
          if (_selectedYearId == null && resData['academic_year_id'] != null) {
            _selectedYearId = resData['academic_year_id'].toString();
          }
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorText = 'Failed to load achievements (${response.statusCode})';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorText = 'Network error: $e';
        _isLoading = false;
      });
    }
  }

  List<dynamic> _filterCategory(String category) {
    return _achievements.filter((item) {
      final cat = item['category'] ?? item['feature_type'];
      if (category == 'attendance' && cat != 'attendance_champions' && cat != 'attendance_leaderboard') {
        return false;
      }
      if (category == 'academic' && cat != 'academic_excellence') {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final name = (item['student_name'] ?? '').toString().toLowerCase();
        final roll = (item['roll_number'] ?? '').toString().toLowerCase();
        final cname = (item['class_name'] ?? '').toString().toLowerCase();
        if (!name.contains(_searchQuery) && !roll.contains(_searchQuery) && !cname.contains(_searchQuery)) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  void _showCertificateDialog(Map<String, dynamic> item) {
    final rank = item['rank'] ?? 1;
    final medal = rank == 1 ? '🥇' : rank == 2 ? '🥈' : '🥉';
    final isAcademic = (item['category'] ?? item['feature_type']) == 'academic_excellence';

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.amber.shade600, width: 6),
            color: Colors.white,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'SHIKSHA PILOT ACADEMY',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: Colors.grey.shade700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                isAcademic ? 'CERTIFICATE OF ACADEMIC EXCELLENCE' : 'CERTIFICATE OF ATTENDANCE ACHIEVEMENT',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const Divider(height: 24, thickness: 1.5),
              const Text(
                'This certificate is honorably presented to',
                style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              Text(
                item['student_name'] ?? 'Student',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.amber.shade900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Class ${item['class_name'] ?? ''} · Roll No. ${item['roll_number'] ?? '—'}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(medal, style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 8),
                    Text(
                      'Rank #$rank',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Colors.amber.shade900,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      '${item['achievement_score']}%',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF059669),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'For demonstrating outstanding commitment and excellence.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text('Teacher Sign', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  Text('Principal Sign', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber.shade700,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Close', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _fetchAndShowReportCard(Map<String, dynamic> item) async {
    final achievementId = item['id'];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/school/achievements/$achievementId/report-card');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
      );

      if (!mounted) return;
      Navigator.pop(context); // Close loader

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final rc = body['data'] ?? body;
        _showReportCardDialog(rc);
      } else {
        final body = json.decode(response.body);
        final msg = body['message'] ?? 'Report card access is restricted to authorized users.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading report card: $e'), backgroundColor: Colors.red.shade700),
      );
    }
  }

  void _showReportCardDialog(Map<String, dynamic> rc) {
    final subjects = (rc['subjects'] as List?) ?? [];

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Container(
          padding: const EdgeInsets.all(16),
          constraints: const BoxConstraints(maxHeight: 500),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    rc['student_name'] ?? 'Report Card',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF6EE7B7)),
                    ),
                    child: Text(
                      rc['result'] ?? 'PASS',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Class ${rc['class_name'] ?? ''} · Total: ${rc['total_obtained']}/${rc['total_max']} (${rc['percentage']}%)',
                style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
              ),
              const Divider(height: 20),
              Expanded(
                child: SingleChildScrollView(
                  child: Table(
                    border: TableBorder.all(color: Colors.grey.shade300, width: 1),
                    columnWidths: const {
                      0: FlexColumnWidth(2),
                      1: FlexColumnWidth(1),
                      2: FlexColumnWidth(1),
                    },
                    children: [
                      TableRow(
                        decoration: BoxDecoration(color: Colors.grey.shade100),
                        children: const [
                          Padding(padding: EdgeInsets.all(6), child: Text('Subject', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                          Padding(padding: EdgeInsets.all(6), child: Text('Marks', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                          Padding(padding: EdgeInsets.all(6), child: Text('Grade', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                        ],
                      ),
                      ...subjects.map((s) => TableRow(
                            children: [
                              Padding(padding: const EdgeInsets.all(6), child: Text(s['subject_name'] ?? '', style: const TextStyle(fontSize: 11))),
                              Padding(padding: const EdgeInsets.all(6), child: Text('${s['marks_obtained']}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
                              Padding(padding: const EdgeInsets.all(6), child: Text('${s['grade']}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
                            ],
                          )),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attItems = _filterCategory('attendance');
    final acadItems = _filterCategory('academic');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hall of Fame & Achievements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.amber.shade800,
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: 'Attendance (${attItems.length})'),
            Tab(text: 'Academic (${acadItems.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.amber.shade50,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by student name or class...',
                      hintStyle: const TextStyle(fontSize: 12),
                      prefixIcon: const Icon(Icons.search, size: 18),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      fillColor: Colors.white,
                      filled: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Colors.amber),
                  onPressed: _fetchAchievements,
                ),
              ],
            ),
          ),

          // Content Tabs
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorText.isNotEmpty
                    ? Center(child: Text(_errorText, style: const TextStyle(color: Colors.red)))
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildGrid(attItems, false),
                          _buildGrid(acadItems, true),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildGrid(List<dynamic> items, bool isAcademic) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.emoji_events_outlined, size: 48, color: Colors.grey),
            SizedBox(height: 8),
            Text('No achievements found', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final rank = item['rank'] ?? 1;
        final medal = rank == 1 ? '🥇' : rank == 2 ? '🥈' : '🥉';
        final borderCol = rank == 1 ? Colors.amber : rank == 2 ? Colors.grey.shade400 : Colors.amber.shade700;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: borderCol, width: 2),
          ),
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(medal, style: const TextStyle(fontSize: 26)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item['student_name'] ?? 'Student',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Class ${item['class_name'] ?? ''} · Roll No. ${item['roll_number'] ?? '—'}',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF6EE7B7)),
                      ),
                      child: Text(
                        '${item['achievement_score']}%',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _showCertificateDialog(item),
                        icon: const Icon(Icons.remove_red_eye_rounded, size: 16),
                        label: const Text('Certificate', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.amber.shade900,
                          side: BorderSide(color: Colors.amber.shade700),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    if (isAcademic) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _fetchAndShowReportCard(item),
                          icon: const Icon(Icons.assessment_rounded, size: 16),
                          label: const Text('Report Card', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber.shade800,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

extension ListFilter<T> on List<T> {
  List<T> filter(bool Function(T element) test) {
    return where(test).toList();
  }
}
