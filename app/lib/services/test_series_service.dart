import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/http_service.dart' as http;
import '../config.dart';

class TestSeriesApiException implements Exception {
  final String message;
  final int? statusCode;

  TestSeriesApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class TestSeriesService {
  final String baseUrl;
  final String token;
  String? _latestBaseUrl;

  TestSeriesService({required this.baseUrl, required this.token});

  static Future<TestSeriesService> create() async {
    final prefs = await SharedPreferences.getInstance();
    return TestSeriesService(
      baseUrl: resolveBaseUrlFrom(prefs),
      token: prefs.getString('auth_token') ?? '',
    );
  }

  Future<String> _effectiveBaseUrl() async {
    final fallbackClean = baseUrl.replaceAll(RegExp(r'/+$'), '');
    if (fallbackClean.contains('shikshapilot.com')) {
      _latestBaseUrl = fallbackClean;
      return fallbackClean;
    }
    final active = (http.activeLocalBaseUrl ?? '').trim();
    if (active.isNotEmpty && active.startsWith('http')) {
      _latestBaseUrl = active.replaceAll(RegExp(r'/+$'), '');
      return _latestBaseUrl!;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final resolved = resolveBaseUrlFrom(prefs);
      if (resolved.isNotEmpty && resolved.startsWith('http')) {
        _latestBaseUrl = resolved.replaceAll(RegExp(r'/+$'), '');
        return _latestBaseUrl!;
      }
    } catch (_) {}
    _latestBaseUrl = fallbackClean;
    return fallbackClean;
  }

  Map<String, String> _headers({int? studentId}) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      if (studentId != null) 'X-Student-Id': studentId.toString(),
    };
  }

  dynamic _decodeAndCheck(http.Response response, String fallbackError) {
    Map<String, dynamic>? decoded;
    try {
      final raw = json.decode(response.body);
      if (raw is Map<String, dynamic>) {
        decoded = raw;
      }
    } catch (_) {}

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded != null && decoded.containsKey('data')) {
        return decoded['data'];
      }
      return decoded ?? {};
    }

    String msg = fallbackError;
    if (decoded != null) {
      if (decoded['message'] != null && decoded['message'].toString().trim().isNotEmpty) {
        msg = decoded['message'].toString().trim();
      } else if (decoded['error'] != null && decoded['error'].toString().trim().isNotEmpty) {
        msg = decoded['error'].toString().trim();
      }
    }
    throw TestSeriesApiException(msg, statusCode: response.statusCode);
  }

  String resolveMediaUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final val = rawUrl.trim();
    if (val.startsWith('http://') || val.startsWith('https://')) {
      return val;
    }
    final cleanBase = (_latestBaseUrl ?? baseUrl).replaceAll(RegExp(r'/+$'), '');
    final cleanPath = val.startsWith('/') ? val : '/$val';
    return '$cleanBase$cleanPath';
  }

  // ---------------------------------------------------------------------------
  // Teacher / Principal APIs
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> getTeacherAccess() async {
    final base = await _effectiveBaseUrl();
    final response = await http.get(
      Uri.parse('$base/api/teacher/test-series/access'),
      headers: _headers(),
    );
    final data = _decodeAndCheck(response, 'Failed to load Test Series access');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<Map<String, dynamic>>> getPermissions() async {
    final base = await _effectiveBaseUrl();
    final response = await http.get(
      Uri.parse('$base/api/teacher/test-series/permissions'),
      headers: _headers(),
    );
    final data = _decodeAndCheck(response, 'Failed to load teacher permissions');
    final list = (data is Map ? data['teachers'] : null) as List? ?? [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>> setPermission({
    required int staffId,
    required bool canCreate,
  }) async {
    final base = await _effectiveBaseUrl();
    final response = await http.post(
      Uri.parse('$base/api/teacher/test-series/permissions'),
      headers: _headers(),
      body: json.encode({'staff_id': staffId, 'can_create': canCreate}),
    );
    final data = _decodeAndCheck(response, 'Failed to update teacher permission');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> uploadImage(File file) async {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!allowed.contains(ext)) {
      throw TestSeriesApiException('Only JPG, PNG, WEBP, or GIF images are supported.');
    }
    final size = await file.length();
    if (size > 2 * 1024 * 1024) {
      throw TestSeriesApiException('File size cannot exceed 2 MB.');
    }

    final base = await _effectiveBaseUrl();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$base/api/teacher/test-series/upload-image'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.headers['Accept'] = 'application/json';
    request.files.add(
      await http.MultipartFile.fromPath('file', file.path, filename: fileName),
    );

    final response = await http.sendMultipart(request);
    final data = _decodeAndCheck(response, 'Failed to upload image');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> fetchTeacherTestSeries({
    int? classId,
    String status = 'ALL',
  }) async {
    final base = await _effectiveBaseUrl();
    final query = <String, String>{};
    if (classId != null && classId > 0) {
      query['class_id'] = classId.toString();
    }
    if (status.isNotEmpty && status != 'ALL') {
      query['status'] = status;
    }

    final uri = Uri.parse('$base/api/teacher/test-series')
        .replace(queryParameters: query.isEmpty ? null : query);
    final response = await http.get(uri, headers: _headers());
    final data = _decodeAndCheck(response, 'Failed to load Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> fetchTeacherDetail(int id) async {
    final base = await _effectiveBaseUrl();
    final response = await http.get(
      Uri.parse('$base/api/teacher/test-series/$id'),
      headers: _headers(),
    );
    final data = _decodeAndCheck(response, 'Failed to load Test Series details');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> createTestSeries(Map<String, dynamic> payload) async {
    final base = await _effectiveBaseUrl();
    final response = await http.post(
      Uri.parse('$base/api/teacher/test-series'),
      headers: _headers(),
      body: json.encode(payload),
    );
    final data = _decodeAndCheck(response, 'Failed to create Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> updateTestSeries(int id, Map<String, dynamic> payload) async {
    final base = await _effectiveBaseUrl();
    final response = await http.put(
      Uri.parse('$base/api/teacher/test-series/$id'),
      headers: _headers(),
      body: json.encode(payload),
    );
    final data = _decodeAndCheck(response, 'Failed to update Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> deleteTestSeries(int id) async {
    final base = await _effectiveBaseUrl();
    final response = await http.delete(
      Uri.parse('$base/api/teacher/test-series/$id'),
      headers: _headers(),
    );
    _decodeAndCheck(response, 'Failed to delete Test Series');
  }

  Future<Map<String, dynamic>> fetchTeacherLeaderboard(int id) async {
    final base = await _effectiveBaseUrl();
    final response = await http.get(
      Uri.parse('$base/api/teacher/test-series/$id/leaderboard'),
      headers: _headers(),
    );
    final data = _decodeAndCheck(response, 'Failed to load leaderboard');
    return Map<String, dynamic>.from(data as Map);
  }

  // ---------------------------------------------------------------------------
  // Student / Parent APIs
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>> fetchStudentTestSeries({
    int? studentId,
    String status = 'ALL',
  }) async {
    final base = await _effectiveBaseUrl();
    final query = <String, String>{};
    if (studentId != null && studentId > 0) {
      query['student_id'] = studentId.toString();
    }
    if (status.isNotEmpty && status != 'ALL') {
      query['status'] = status;
    }

    final uri = Uri.parse('$base/api/student/test-series')
        .replace(queryParameters: query.isEmpty ? null : query);
    final response = await http.get(uri, headers: _headers(studentId: studentId));
    final data = _decodeAndCheck(response, 'Failed to load Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> startStudentAttempt(
    int id, {
    int? studentId,
  }) async {
    final base = await _effectiveBaseUrl();
    final uri = Uri.parse('$base/api/student/test-series/$id/attempt').replace(
      queryParameters: studentId != null ? {'student_id': studentId.toString()} : null,
    );
    final response = await http.get(uri, headers: _headers(studentId: studentId));
    final data = _decodeAndCheck(response, 'Unable to start Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> pauseStudentAttempt(
    int id,
    int elapsedSeconds, {
    int? studentId,
  }) async {
    final base = await _effectiveBaseUrl();
    final uri = Uri.parse('$base/api/student/test-series/$id/pause').replace(
      queryParameters: studentId != null ? {'student_id': studentId.toString()} : null,
    );
    final response = await http.post(
      uri,
      headers: _headers(studentId: studentId),
      body: json.encode({
        if (studentId != null) 'student_id': studentId,
        'elapsed_seconds': elapsedSeconds,
      }),
    );
    _decodeAndCheck(response, 'Failed to save timer state');
  }

  Future<Map<String, dynamic>> submitStudentAttempt(
    int id,
    List<Map<String, dynamic>> answers, {
    int? studentId,
    int? elapsedSeconds,
  }) async {
    final base = await _effectiveBaseUrl();
    final uri = Uri.parse('$base/api/student/test-series/$id/submit').replace(
      queryParameters: studentId != null ? {'student_id': studentId.toString()} : null,
    );
    final response = await http.post(
      uri,
      headers: _headers(studentId: studentId),
      body: json.encode({
        if (studentId != null) 'student_id': studentId,
        'answers': answers,
        if (elapsedSeconds != null) 'elapsed_seconds': elapsedSeconds,
      }),
    );
    final data = _decodeAndCheck(response, 'Failed to submit Test Series');
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> fetchStudentLeaderboard(
    int id, {
    int? studentId,
  }) async {
    final base = await _effectiveBaseUrl();
    final uri = Uri.parse('$base/api/student/test-series/$id/leaderboard').replace(
      queryParameters: studentId != null ? {'student_id': studentId.toString()} : null,
    );
    final response = await http.get(uri, headers: _headers(studentId: studentId));
    final data = _decodeAndCheck(response, 'Failed to load results & leaderboard');
    return Map<String, dynamic>.from(data as Map);
  }
}
