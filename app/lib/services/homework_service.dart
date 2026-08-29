import 'dart:convert';
import 'dart:io';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class HomeworkService {
  final String baseUrl;
  final String token;

  HomeworkService({required this.baseUrl, required this.token});

  static Future<HomeworkService> create() async {
    final prefs = await SharedPreferences.getInstance();
    final baseUrl = resolveBaseUrlFrom(prefs);
    final token = prefs.getString('auth_token') ?? '';
    return HomeworkService(baseUrl: baseUrl, token: token);
  }

  Map<String, String> _getHeaders({int? selectedStudentId}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
      if (selectedStudentId != null) 'X-Student-Id': selectedStudentId.toString(),
    };
  }

  Future<List<dynamic>> fetchHomeworkList({
    required String userRole,
    int? selectedStudentId,
  }) async {
    final roleUpper = userRole.toUpperCase();
    final isTeacher = roleUpper == 'TEACHER' || roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'PRINCIPAL';

    final endpoint = isTeacher ? '/api/teacher/homework' : '/api/student/homework';
    final uri = Uri.parse('$baseUrl$endpoint');

    final response = await http.get(uri, headers: _getHeaders(selectedStudentId: selectedStudentId));

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      if (decoded['status'] == 'success' && decoded['data'] is List) {
        return decoded['data'];
      }
      return [];
    } else {
      throw Exception('Failed to fetch homework list');
    }
  }

  Future<Map<String, dynamic>> uploadAttachment(File file) async {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';
    final allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    if (!allowedExts.contains(ext)) {
      throw Exception('Unsupported file format.');
    }

    final fileSize = await file.length();
    if (fileSize > 10 * 1024 * 1024) {
      throw Exception('File size exceeds the allowed limit.');
    }

    final uri = Uri.parse('$baseUrl/api/homework/upload-attachment');
    final request = http.MultipartRequest('POST', uri);
    request.headers['Authorization'] = 'Bearer $token';

    final multipartFile = await http.MultipartFile.fromPath(
      'file',
      file.path,
      filename: fileName,
    );
    request.files.add(multipartFile);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      if (decoded['status'] == 'success' && decoded['data'] != null) {
        return decoded['data'];
      }
      throw Exception(decoded['message'] ?? 'Unable to upload attachment. Please try again.');
    } else {
      try {
        final decoded = json.decode(response.body);
        throw Exception(decoded['message'] ?? 'Unable to upload attachment. Please try again.');
      } catch (_) {
        throw Exception('Unable to upload attachment. Please try again.');
      }
    }
  }

  Future<Map<String, dynamic>> createHomework({
    String? title,
    String? description,
    int? classId,
    required List<Map<String, dynamic>> attachments,
  }) async {
    final uri = Uri.parse('$baseUrl/api/teacher/homework');

    final body = json.encode({
      'title': title,
      'description': description,
      'class_id': classId,
      'attachments': attachments,
    });

    final response = await http.post(uri, headers: _getHeaders(), body: body);
    final decoded = json.decode(response.body);

    if (response.statusCode == 200 || response.statusCode == 201) {
      if (decoded['status'] == 'success') {
        return decoded['data'] ?? {};
      }
      throw Exception(decoded['message'] ?? 'Unable to create homework');
    } else {
      final msg = decoded['message'] ?? 'Failed to create homework';
      if (decoded['data'] is Map && decoded['data']['description'] != null) {
        throw Exception(decoded['data']['description']);
      }
      throw Exception(msg);
    }
  }

  Future<Map<String, dynamic>> updateHomework(
    int id, {
    String? title,
    String? description,
    int? classId,
    required List<Map<String, dynamic>> attachments,
  }) async {
    final uri = Uri.parse('$baseUrl/api/teacher/homework/$id');

    final body = json.encode({
      'title': title,
      'description': description,
      'class_id': classId,
      'attachments': attachments,
    });

    final response = await http.put(uri, headers: _getHeaders(), body: body);
    final decoded = json.decode(response.body);

    if (response.statusCode == 200) {
      if (decoded['status'] == 'success') {
        return decoded['data'] ?? {};
      }
      throw Exception(decoded['message'] ?? 'Unable to update homework');
    } else {
      final msg = decoded['message'] ?? 'Failed to update homework';
      if (decoded['data'] is Map && decoded['data']['description'] != null) {
        throw Exception(decoded['data']['description']);
      }
      throw Exception(msg);
    }
  }

  Future<void> deleteHomework(int id) async {
    final uri = Uri.parse('$baseUrl/api/teacher/homework/$id');
    final response = await http.delete(uri, headers: _getHeaders());

    if (response.statusCode != 200) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Unable to delete homework');
    }
  }
}
