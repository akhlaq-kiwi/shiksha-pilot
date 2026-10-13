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

  /// Fetch classes for timetable scheduling
  Future<List<dynamic>> getClasses() async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final response = await http.get(uri, headers: getHeaders(null));
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return data is List ? data : [];
    }
    throw Exception('Failed to load classes.');
  }

  /// Fetch subjects
  Future<List<dynamic>> getSubjects({int? classId}) async {
    final queryParams = <String, String>{};
    if (classId != null) queryParams['class_id'] = classId.toString();
    final uri = Uri.parse('$baseUrl/api/school/subjects').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: getHeaders(null));
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return data is List ? data : [];
    }
    throw Exception('Failed to load subjects.');
  }

  /// Create a subject
  Future<Map<String, dynamic>> createSubject(String name) async {
    final uri = Uri.parse('$baseUrl/api/school/subjects');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({'name': name}),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return decoded is Map<String, dynamic> ? decoded : {};
    }
    final decoded = json.decode(response.body);
    throw Exception(decoded['message'] ?? 'Failed to create subject.');
  }

  /// Delete a subject
  Future<void> deleteSubject(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/subjects/$id');
    final response = await http.delete(uri, headers: getHeaders(null));
    if (response.statusCode != 200 && response.statusCode != 204) {
      String errorMsg = 'Failed to delete subject.';
      try {
        final decoded = json.decode(response.body);
        if (decoded is Map) {
          if (decoded['errors'] is Map && decoded['errors']['subject'] != null) {
            errorMsg = decoded['errors']['subject'].toString();
          } else if (decoded['message'] != null) {
            errorMsg = decoded['message'].toString();
          } else if (decoded['error'] != null) {
            errorMsg = decoded['error'].toString();
          }
        }
      } catch (_) {}
      throw Exception(errorMsg);
    }
  }

  /// Fetch staff (teachers) with workloads for a date
  Future<List<dynamic>> getStaff({String? date}) async {
    final queryParams = <String, String>{};
    if (date != null) queryParams['date'] = date;
    final uri = Uri.parse('$baseUrl/api/school/staff').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: getHeaders(null));
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return data is List ? data : [];
    }
    throw Exception('Failed to load staff.');
  }

  /// Fetch period configurations
  Future<List<dynamic>> getPeriodConfigurations({String? date}) async {
    final queryParams = <String, String>{};
    if (date != null) queryParams['date'] = date;
    final uri = Uri.parse('$baseUrl/api/school/period-configurations').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: getHeaders(null));
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return data is List ? data : [];
    }
    throw Exception('Failed to load period configurations.');
  }

  /// Fetch timetable settings
  Future<Map<String, dynamic>?> getTimetableSettings() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/timetable-settings');
      final response = await http.get(uri, headers: getHeaders(null));
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        return decoded['data'] ?? decoded;
      }
    } catch (_) {}
    return null;
  }

  /// Save timetable settings and generate period configurations
  Future<Map<String, dynamic>> saveTimetableSettings(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable-settings');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode(data),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return decoded['data'] ?? decoded;
    }
    final decoded = json.decode(response.body);
    throw Exception(decoded['message'] ?? 'Failed to save timetable settings.');
  }

  /// Fetch admin timetable for class and date
  Future<Map<String, dynamic>> getAdminTimetable({
    required int classId,
    required String date,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable').replace(queryParameters: {
      'class_id': classId.toString(),
      'date': date,
    });
    final response = await http.get(uri, headers: getHeaders(null));
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return data is Map<String, dynamic> ? data : {};
    }
    throw Exception('Failed to load timetable.');
  }

  /// Query school-wide timetable entries to check teacher occupancy
  Future<List<dynamic>> getAllTimetableEntries({required String date}) async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/timetable').replace(queryParameters: {
        'date': date,
      });
      final response = await http.get(uri, headers: getHeaders(null));
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? decoded;
        return data is List ? data : [];
      }
    } catch (_) {}
    return [];
  }

  /// Add a period entry
  Future<dynamic> addTimetablePeriod({
    required int classId,
    required int subjectId,
    required int teacherId,
    required String dayOfWeek,
    required int periodNumber,
    required String startDate,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'class_id': classId,
        'subject_id': subjectId,
        'teacher_id': teacherId,
        'day_of_week': dayOfWeek,
        'period_number': periodNumber,
        'start_date': startDate,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      return decoded['data'] ?? decoded;
    }
    final decoded = json.decode(response.body);
    throw Exception(decoded['message'] ?? 'Failed to add timetable period.');
  }

  /// Delete a single period
  Future<void> deleteTimetablePeriod({required int id, required String date}) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/$id');
    final response = await http.delete(
      uri,
      headers: getHeaders(null),
      body: json.encode({'date': date}),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to delete period.');
    }
  }

  /// Delete full day timetable
  Future<void> deleteDayTimetable({
    required int classId,
    required String dayOfWeek,
    required String date,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/delete-day');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'class_id': classId,
        'day_of_week': dayOfWeek,
        'date': date,
      }),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to delete day timetable.');
    }
  }

  /// Publish a day's schedule
  Future<void> publishTimetableDay({
    required int classId,
    required String dayOfWeek,
    required String date,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/publish');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'class_id': classId,
        'day_of_week': dayOfWeek,
        'date': date,
      }),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to publish timetable.');
    }
  }

  /// Paste timetable schedule from source day to destination day
  Future<void> pasteTimetableSchedule({
    required int classId,
    required String sourceDay,
    required String destinationDay,
    required String destinationDate,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/paste');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'class_id': classId,
        'source_day': sourceDay,
        'destination_day': destinationDay,
        'destination_date': destinationDate,
      }),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to paste timetable schedule.');
    }
  }

  /// Assign a backup teacher for a day
  Future<void> assignBackupTeacher({
    required int timetableId,
    required String date,
    required int backupTeacherId,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/backup');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'timetable_id': timetableId,
        'date': date,
        'backup_teacher_id': backupTeacherId,
      }),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to assign backup teacher.');
    }
  }

  /// Permanently replace teacher for a timetable entry
  Future<void> replaceTeacher({
    required int timetableId,
    required String date,
    required int newTeacherId,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/timetable/replace');
    final response = await http.post(
      uri,
      headers: getHeaders(null),
      body: json.encode({
        'timetable_id': timetableId,
        'date': date,
        'new_teacher_id': newTeacherId,
      }),
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      final decoded = json.decode(response.body);
      throw Exception(decoded['message'] ?? 'Failed to replace teacher.');
    }
  }
}
