import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:school_hub/services/http_service.dart' as http;

class SchoolExaminationService {
  final String baseUrl;
  final String token;

  SchoolExaminationService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// Fetch all examinations with terms and sub-tests
  Future<List<dynamic>> getExaminations() async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load examinations');
    }
  }

  /// Fetch classes
  Future<List<dynamic>> getClasses() async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load classes');
    }
  }

  /// Fetch subjects
  Future<List<dynamic>> getSubjects() async {
    final uri = Uri.parse('$baseUrl/api/school/subjects');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load subjects');
    }
  }

  /// Fetch official holidays
  Future<List<dynamic>> getHolidays() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/holidays');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = json.decode(response.body);
        return (decoded['data'] as List<dynamic>?) ?? [];
      }
    } catch (_) {}
    return [];
  }

  /// Fetch School Profile (theme, logo, report_card_remark, etc.)
  Future<Map<String, dynamic>?> getSchoolProfile() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/profile');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = json.decode(response.body);
        return Map<String, dynamic>.from(decoded['data'] ?? decoded);
      }
    } catch (e) {
      debugPrint('Failed to get school profile: $e');
    }
    return null;
  }

  /// Update School Profile (e.g. report card remark, report card theme)
  Future<Map<String, dynamic>> updateSchoolProfile(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/profile');
    final response = await http.post(uri, headers: _headers, body: json.encode(data));

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to update school profile');
    }
  }

  /// Fetch Grade Configurations
  Future<List<dynamic>> getGradeConfigurations() async {
    final uri = Uri.parse('$baseUrl/api/school/grade-configurations');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load grade configurations');
    }
  }

  /// Save Grade Configurations
  Future<void> saveGradeConfigurations(List<Map<String, dynamic>> scales) async {
    final uri = Uri.parse('$baseUrl/api/school/grade-configurations');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'scales': scales}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to save grade configurations');
    }
  }

  /// Fetch Class Statuses for an Exam
  Future<List<dynamic>> getExamClassStatuses(int examId) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/class-status');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load class statuses');
    }
  }

  /// Fetch Timetable Papers for an Exam & Class
  Future<Map<String, dynamic>> getExamTimetable(int examId, int classId) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/timetable?class_id=$classId');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return Map<String, dynamic>.from(data is Map ? data : {'papers': data});
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load exam timetable');
    }
  }

  /// Save Timetable Papers for an Exam & Class
  Future<void> saveExamTimetable(int examId, int classId, List<Map<String, dynamic>> papers) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/timetable?class_id=$classId');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'papers': papers}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to save timetable');
    }
  }

  /// Publish Exam Scheme
  Future<void> publishExamScheme(int examId, int classId) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/publish-scheme');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'class_id': classId}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to publish exam scheme');
    }
  }

  /// Unpublish Exam Scheme
  Future<void> unpublishExamScheme(int examId, int classId) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/unpublish-scheme');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'class_id': classId}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to unpublish exam scheme');
    }
  }

  /// Fetch Exam Marks Spreadsheet for an Exam, Class, and Subject
  Future<Map<String, dynamic>> getExamMarksSheet(int examId, int classId, int subjectId) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/marks?class_id=$classId&subject_id=$subjectId');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load marks sheet');
    }
  }

  /// Save single student mark in Spreadsheet
  Future<dynamic> saveExamMark(int examId, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/marks');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode(data),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return decoded['data'] ?? decoded;
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to save student mark');
    }
  }

  /// Publish or Unpublish Exam Results for Class
  Future<void> publishExamResults(int examId, int classId, {String status = 'Published'}) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/publish');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'class_id': classId, 'status': status}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to update result publish status');
    }
  }

  /// Fetch Report Cards for an Exam & Class
  Future<List<dynamic>> getReportCards(int examId, int classId, {int? studentId}) async {
    final query = studentId != null ? '?class_id=$classId&student_id=$studentId' : '?class_id=$classId';
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId/report-cards$query');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return (decoded['data'] as List<dynamic>?) ?? [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load report cards');
    }
  }

  /// Update Examination details (dates, max_marks, name)
  Future<void> updateExamination(int examId, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/exams-new/$examId');
    final response = await http.put(
      uri,
      headers: _headers,
      body: json.encode(data),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to update examination');
    }
  }
}

