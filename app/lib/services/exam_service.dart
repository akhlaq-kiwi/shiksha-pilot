import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class ExamService {
  final String baseUrl;
  final String token;

  ExamService({required this.baseUrl, required this.token});

  Map<String, String> _headers([int? studentId]) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (studentId != null) 'X-Student-Id': studentId.toString(),
      };

  Future<List<dynamic>> getExamsList(String userRole, int? studentId) async {
    final path = userRole == 'TEACHER' ? '/api/teacher/exams-new' : '/api/student/exams-new';
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _headers(studentId));

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load examinations.');
    }
  }

  Future<Map<String, dynamic>> getExamDetails(int examId, String userRole, int? studentId) async {
    final path = userRole == 'TEACHER' 
        ? '/api/teacher/exams-new/$examId/details' 
        : '/api/student/exams-new/$examId/details';
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _headers(studentId));

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? {};
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load examination details.');
    }
  }

  Future<Map<String, dynamic>> getMarksSheet(int examId, int subjectId) async {
    final uri = Uri.parse('$baseUrl/api/teacher/exams-new/$examId/marks-sheet?subject_id=$subjectId');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? {};
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load marks sheet.');
    }
  }

  Future<void> saveMarksSheet(int examId, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/teacher/exams-new/$examId/marks-sheet');
    final response = await http.post(uri, headers: _headers(), body: json.encode(data));

    if (response.statusCode != 200) {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to save marks.');
    }
  }
}
