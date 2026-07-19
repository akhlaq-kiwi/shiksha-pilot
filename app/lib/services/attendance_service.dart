import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class AttendanceService {
  final String baseUrl;
  final String token;

  AttendanceService({required this.baseUrl, required this.token});

  Map<String, String> _headers([int? studentId]) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (studentId != null) 'X-Student-Id': studentId.toString(),
      };

  // Student/Parent: Fetch student attendance history
  Future<List<dynamic>> getStudentAttendance(int? studentId) async {
    final uri = Uri.parse('$baseUrl/api/student/attendance');
    final response = await http.get(uri, headers: _headers(studentId));

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load attendance.');
    }
  }

  // Teacher: Fetch assigned classes
  Future<List<dynamic>> getTeacherClasses() async {
    final uri = Uri.parse('$baseUrl/api/teacher/classes?only_assigned=1');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load classes.');
    }
  }

  // Teacher: Fetch students list for a class
  Future<List<dynamic>> getTeacherStudents(int classId) async {
    final uri = Uri.parse('$baseUrl/api/teacher/students?class_id=$classId');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load students.');
    }
  }

  // Teacher: Fetch attendance marked for a class on a date
  Future<List<dynamic>> getTeacherAttendanceHistory(int classId, String dateYyyyMmDd) async {
    final uri = Uri.parse('$baseUrl/api/teacher/attendance?class_id=$classId&date=$dateYyyyMmDd');
    final response = await http.get(uri, headers: _headers());

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load attendance history.');
    }
  }

  // Teacher: Mark attendance for a student on a date
  Future<void> markTeacherAttendance({
    required int studentId,
    required int classId,
    required String dateYyyyMmDd,
    required String status, // 'Present', 'Absent', 'Leave'
  }) async {
    final uri = Uri.parse('$baseUrl/api/teacher/attendance');
    final body = {
      'student_id': studentId,
      'class_id': classId,
      'date': dateYyyyMmDd,
      'status': status,
    };
    final response = await http.post(
      uri,
      headers: _headers(),
      body: json.encode(body),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      final decoded = json.decode(response.body);
      final msg = decoded['message'] ?? 'Failed to mark attendance.';
      final errors = decoded['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final details = errors.values.join(', ');
        throw Exception('$msg: $details');
      }
      throw Exception(msg);
    }
  }

  // Fetch school holidays
  Future<List<dynamic>> getHolidays() async {
    final uri = Uri.parse('$baseUrl/api/school/holidays');
    final response = await http.get(uri, headers: _headers());
    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load holidays.');
    }
  }
}
