import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class ClassTeacherService {
  final String baseUrl;
  final String token;

  ClassTeacherService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  /// Get classes and active teachers for class teacher assignments
  Future<Map<String, dynamic>> getClassTeacherAssignments() async {
    final uri = Uri.parse('$baseUrl/api/school/class-teacher-assignments');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? {};
      return Map<String, dynamic>.from(data);
    } else {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to load class teacher assignments');
    }
  }

  /// Save class teacher assignments
  Future<Map<String, dynamic>> saveClassTeacherAssignments({
    required List<Map<String, dynamic>> assignments,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/class-teacher-assignments');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'assignments': assignments,
      }),
    );

    final decoded = json.decode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to save class teacher assignments.';
      if (decoded['message'] != null && decoded['message'].toString().isNotEmpty) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        if (errs is Map) {
          msg = errs.values.first.toString();
        } else {
          msg = errs.toString();
        }
      }
      throw Exception(msg);
    }
  }
}
