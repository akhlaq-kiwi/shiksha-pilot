import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class TimetableService {
  final String baseUrl;
  final String token;

  TimetableService({required this.baseUrl, required this.token});

  Map<String, String> getHeaders(int? studentId) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (studentId != null) 'X-Student-Id': studentId.toString(),
      };

  /// Fetch student timetable for a specific date.
  /// If [date] is null, fetches the full weekly timetable.
  Future<Map<String, dynamic>> getStudentTimetable({
    required int? studentId,
    required String? date,
  }) async {
    final cacheKey = 'cached_student_timetable_${studentId}_$date';
    final queryParams = <String, String>{};
    if (date != null) queryParams['date'] = date;

    final uri = Uri.parse('$baseUrl/api/student/timetable')
        .replace(queryParameters: queryParams);

    try {
      final response = await http
          .get(uri, headers: getHeaders(studentId))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final List<dynamic> data = decoded['data'] ?? decoded;
        
        // Cache successful response
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(cacheKey, json.encode(data));

        return {'data': data, 'isOffline': false};
      } else {
        throw Exception('Failed to load student timetable.');
      }
    } catch (e) {
      // Fallback to cache on network failure
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(cacheKey);
      if (cachedStr != null) {
        final List<dynamic> data = json.decode(cachedStr);
        return {'data': data, 'isOffline': true};
      }
      rethrow;
    }
  }

  /// Fetch teacher schedule for a specific date.
  Future<Map<String, dynamic>> getTeacherSchedule({
    required int teacherId,
    required String date,
  }) async {
    final cacheKey = 'cached_teacher_timetable_${teacherId}_$date';
    final queryParams = {'date': date};

    final uri = Uri.parse('$baseUrl/api/teacher/schedule/today')
        .replace(queryParameters: queryParams);

    try {
      final response = await http
          .get(uri, headers: getHeaders(null))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final List<dynamic> data = decoded['data'] ?? decoded;

        // Cache successful response
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(cacheKey, json.encode(data));

        return {'data': data, 'isOffline': false};
      } else {
        throw Exception('Failed to load teacher schedule.');
      }
    } catch (e) {
      // Fallback to cache on network failure
      final prefs = await SharedPreferences.getInstance();
      final cachedStr = prefs.getString(cacheKey);
      if (cachedStr != null) {
        final List<dynamic> data = json.decode(cachedStr);
        return {'data': data, 'isOffline': true};
      }
      rethrow;
    }
  }

  /// Fetch school holidays
  Future<List<dynamic>> getHolidays() async {
    final uri = Uri.parse('$baseUrl/api/school/holidays');
    try {
      final response = await http
          .get(uri, headers: getHeaders(null))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return decoded['data'] ?? decoded;
      } else {
        throw Exception('Failed to load holidays.');
      }
    } catch (e) {
      return [];
    }
  }
}
