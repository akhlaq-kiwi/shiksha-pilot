import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as raw_http;
import 'package:path/path.dart' as path;
import 'package:school_hub/services/http_service.dart' as http;

class TeacherManagementService {
  final String baseUrl;
  final String token;

  TeacherManagementService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// Get list of all staff/teachers
  Future<List<Map<String, dynamic>>> getStaff({String? date}) async {
    final queryDate = date ?? DateTime.now().toIso8601String().split('T')[0];
    final uri = Uri.parse('$baseUrl/api/school/staff?date=$queryDate');
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
      throw Exception(err.isNotEmpty ? err : 'Failed to load teachers list.');
    }
  }

  /// Get full profile details of a single teacher
  Future<Map<String, dynamic>> getStaffDetails(int id, {String? date}) async {
    final queryDate = date ?? DateTime.now().toIso8601String().split('T')[0];
    final uri = Uri.parse('$baseUrl/api/school/staff/$id?date=$queryDate');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to load teacher profile details.');
    }
  }

  /// Create a new teacher profile
  Future<Map<String, dynamic>> createStaff(Map<String, dynamic> staffData) async {
    final uri = Uri.parse('$baseUrl/api/school/staff');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode(staffData),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to create teacher profile.');
    }
  }

  /// Update existing teacher profile
  Future<Map<String, dynamic>> updateStaff(int id, Map<String, dynamic> staffData) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$id');
    final response = await http.put(
      uri,
      headers: _headers,
      body: json.encode(staffData),
    );

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to update teacher profile.');
    }
  }

  /// Upload document or photo (Multipart)
  Future<String> uploadFile(File file, {String category = 'staff-documents'}) async {
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

  /// Get teacher login credentials
  Future<Map<String, dynamic>> getCredentials(int staffId) async {
    final uri = Uri.parse('$baseUrl/api/school/credentials/TEACHER/$staffId');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to fetch credentials.');
    }
  }

  /// Generate or update teacher password
  Future<Map<String, dynamic>> updateCredentials({
    required int staffId,
    required String newPassword,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/credentials/generate');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'role': 'TEACHER',
        'id': staffId,
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

  /// Get timetable settings (for max periods)
  Future<Map<String, dynamic>> getTimetableSettings() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/timetable-settings');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return Map<String, dynamic>.from(decoded['data'] ?? {});
      }
    } catch (e) {
      debugPrint('Error getting timetable settings: $e');
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

  /// Request OTP for Principal role assignment
  Future<Map<String, dynamic>> requestPrincipalOtp(int teacherId, String action) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$teacherId/request-principal-otp');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'action': action}),
    );
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to request OTP for Principal role.');
    }
  }

  /// Verify OTP and assign Principal role
  Future<Map<String, dynamic>> assignPrincipalRole(int teacherId, String otpCode, String action) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$teacherId/assign-principal');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'otp_code': otpCode, 'action': action}),
    );
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to assign Principal role.');
    }
  }

  /// Request OTP for Fee Collector role assignment
  Future<Map<String, dynamic>> requestFeeCollectorOtp(int teacherId, String action) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$teacherId/request-fee-collector-otp');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'action': action}),
    );
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to request OTP for Fee Collector role.');
    }
  }

  /// Verify OTP and assign Fee Collector role
  Future<Map<String, dynamic>> assignFeeCollectorRole(int teacherId, String otpCode, String action) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$teacherId/assign-fee-collector');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'otp_code': otpCode, 'action': action}),
    );
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = _parseError(response.body);
      throw Exception(err.isNotEmpty ? err : 'Failed to assign Fee Collector role.');
    }
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

