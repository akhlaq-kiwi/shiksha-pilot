import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as raw_http;
import 'package:path/path.dart' as path;
import 'package:school_hub/services/http_service.dart' as http;

class ClassManagementService {
  final String baseUrl;
  final String token;

  ClassManagementService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// Get all registered classes
  Future<List<Map<String, dynamic>>> getClasses() async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final rawList = decoded['data'] ?? [];
      if (rawList is List) {
        return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to load classes.');
    }
  }

  /// Get all students
  Future<List<Map<String, dynamic>>> getStudents() async {
    final uri = Uri.parse('$baseUrl/api/school/students');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final rawList = decoded['data'] ?? [];
      if (rawList is List) {
        return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to load students.');
    }
  }

  /// Get student details by ID
  Future<Map<String, dynamic>> getStudentById(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$id');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to load student details.');
    }
  }

  /// Create a new class
  Future<Map<String, dynamic>> createClass({
    required String name,
    List<String> sections = const [],
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'name': name.trim(),
        'sections': sections,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to create class.');
    }
  }

  /// Update existing class / manage sections
  Future<Map<String, dynamic>> updateClass({
    required String oldName,
    required String name,
    List<String> sections = const [],
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.put(
      uri,
      headers: _headers,
      body: json.encode({
        'oldName': oldName.trim(),
        'name': name.trim(),
        'sections': sections,
      }),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to update class.');
    }
  }

  /// Delete a class
  Future<Map<String, dynamic>> deleteClass(String name) async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.delete(
      uri,
      headers: _headers,
      body: json.encode({'name': name.trim()}),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to delete class.');
    }
  }

  /// Transfer students between sections
  Future<Map<String, dynamic>> transferStudents({
    required String className,
    required String fromSection,
    required String toSection,
    required List<int> studentIds,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/classes/transfer-students');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'class_name': className,
        'from_section': fromSection,
        'to_section': toSection,
        'destination_section': toSection,
        'student_ids': studentIds,
      }),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to transfer students.');
    }
  }

  /// Enroll a new student
  Future<Map<String, dynamic>> createStudent(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/students');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode(data),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to enroll student.');
    }
  }

  /// Update existing student
  Future<Map<String, dynamic>> updateStudent(int id, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$id');
    final response = await http.put(
      uri,
      headers: _headers,
      body: json.encode(data),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to update student.');
    }
  }

  /// Advance a student to target class
  Future<Map<String, dynamic>> advanceStudent(int studentId, int targetClassId) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$studentId/advance');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'class_id': targetClassId}),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to advance student.');
    }
  }

  /// Get next available SR No
  Future<String> getNextSrNo() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/students/next-sr-no');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return decoded['data']?['next_sr_no']?.toString() ?? '';
      }
    } catch (e) {
      debugPrint('Error getting next SR No: $e');
    }
    return '';
  }

  /// Check if SR No already exists
  Future<bool> checkSrNoExists(String srNo, {int? excludeId}) async {
    try {
      final queryParams = <String, String>{'sr_no': srNo};
      if (excludeId != null) queryParams['exclude_id'] = excludeId.toString();
      final uri = Uri.parse('$baseUrl/api/school/students/check-sr-no').replace(queryParameters: queryParams);
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return decoded['exists'] == true || decoded['data']?['exists'] == true;
      }
    } catch (e) {
      debugPrint('Error checking SR No: $e');
    }
    return false;
  }

  /// Get next available roll number for a class
  Future<int> getNextRollNo(int classId) async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/classes/$classId/next-roll-no');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return _extractRollNo(decoded['data']?['next_roll_no'] ?? decoded['data']);
      }
    } catch (e) {
      debugPrint('Error getting next roll no: $e');
    }
    return 1;
  }

  int _extractRollNo(dynamic data) {
    if (data == null) return 1;
    if (data is num) return data.toInt();
    if (data is String) return int.tryParse(data) ?? 1;
    if (data is Map) {
      if (data.containsKey('next_roll_no')) {
        return _extractRollNo(data['next_roll_no']);
      }
      if (data.containsKey('data')) {
        return _extractRollNo(data['data']);
      }
    }
    return 1;
  }

  /// Upload file (photo or documents)
  Future<String> uploadFile(File file, {String category = 'student-documents'}) async {
    final uri = Uri.parse('$baseUrl/api/school/upload');
    final request = raw_http.MultipartRequest('POST', uri);

    request.headers.addAll({
      'Authorization': 'Bearer $token',
    });
    request.fields['category'] = category;

    final stream = raw_http.ByteStream(file.openRead());
    final length = await file.length();

    final multipartFile = raw_http.MultipartFile(
      'file',
      stream,
      length,
      filename: path.basename(file.path),
    );

    request.files.add(multipartFile);

    final streamedResponse = await request.send();
    final response = await raw_http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      final resData = decoded['data'];
      if (resData is Map && resData['url'] != null) {
        return resData['url'].toString();
      } else if (decoded['url'] != null) {
        return decoded['url'].toString();
      }
      return '';
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to upload file.');
    }
  }

  /// Get student credentials
  Future<Map<String, dynamic>> getCredentials(int studentId) async {
    final uri = Uri.parse('$baseUrl/api/school/credentials/STUDENT/$studentId');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to fetch student credentials.');
    }
  }

  /// Update student password
  Future<Map<String, dynamic>> updateCredentials({
    required int studentId,
    required String newPassword,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/credentials/generate');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'role': 'STUDENT',
        'id': studentId,
        'password': newPassword,
        'new_password': newPassword,
      }),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to update credentials.');
    }
  }

  /// Get school profile
  Future<Map<String, dynamic>> getSchoolProfile() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/profile');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return Map<String, dynamic>.from(decoded['data'] ?? {});
      }
    } catch (e) {
      debugPrint('Error getting school profile: $e');
    }
    return {};
  }

  /// Get academic years
  Future<List<Map<String, dynamic>>> getAcademicYears() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/academic-years');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final rawList = decoded['data'] ?? [];
        if (rawList is List) {
          return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
    } catch (e) {
      debugPrint('Error getting academic years: $e');
    }
    return [];
  }

  /// Get school stats (student limits)
  Future<Map<String, dynamic>> getStats() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/stats');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return Map<String, dynamic>.from(decoded['data'] ?? {});
      }
    } catch (e) {
      debugPrint('Error getting school stats: $e');
    }
    return {};
  }

  String _parseError(String responseBody) {
    try {
      final decoded = json.decode(responseBody);
      if (decoded['errors'] != null && decoded['errors'] is Map) {
        final errMap = decoded['errors'] as Map;
        final msgs = errMap.values.map((v) => v.toString()).join('\n');
        if (msgs.isNotEmpty) return msgs;
      }
      return decoded['message']?.toString() ?? '';
    } catch (_) {
      return '';
    }
  }
}

