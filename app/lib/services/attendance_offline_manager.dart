import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/attendance_service.dart';

class AttendanceOfflineManager {
  static const String _kQueueKey = 'offline_attendance_queue';
  static const String _kClassesKey = 'offline_cached_teacher_classes';
  static const String _kStudentsPrefix = 'offline_cached_students_';
  static const String _kHistoryPrefix = 'offline_cached_history_';
  static const String _kHolidaysKey = 'offline_cached_holidays';

  /// Save teacher's classes for offline use
  static Future<void> cacheClasses(List<dynamic> classes) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kClassesKey, jsonEncode(classes));
    } catch (e) {
      debugPrint('Error caching classes: $e');
    }
  }

  /// Get cached classes
  static Future<List<dynamic>> getCachedClasses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString(_kClassesKey);
      if (data != null && data.isNotEmpty) {
        return jsonDecode(data) as List<dynamic>;
      }
    } catch (e) {
      debugPrint('Error loading cached classes: $e');
    }
    return [];
  }

  /// Save students of a class for offline use
  static Future<void> cacheStudents(int classId, List<dynamic> students) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_kStudentsPrefix$classId', jsonEncode(students));
    } catch (e) {
      debugPrint('Error caching students: $e');
    }
  }

  /// Get cached students of a class
  static Future<List<dynamic>> getCachedStudents(int classId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString('$_kStudentsPrefix$classId');
      if (data != null && data.isNotEmpty) {
        return jsonDecode(data) as List<dynamic>;
      }
    } catch (e) {
      debugPrint('Error loading cached students: $e');
    }
    return [];
  }

  /// Save holidays for offline use
  static Future<void> cacheHolidays(List<dynamic> holidays) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kHolidaysKey, jsonEncode(holidays));
    } catch (e) {
      debugPrint('Error caching holidays: $e');
    }
  }

  /// Get cached holidays
  static Future<List<dynamic>> getCachedHolidays() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString(_kHolidaysKey);
      if (data != null && data.isNotEmpty) {
        return jsonDecode(data) as List<dynamic>;
      }
    } catch (e) {
      debugPrint('Error loading cached holidays: $e');
    }
    return [];
  }

  /// Save attendance history for a class and date
  static Future<void> cacheHistory(int classId, String date, List<dynamic> history) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_kHistoryPrefix${classId}_$date', jsonEncode(history));
    } catch (e) {
      debugPrint('Error caching history: $e');
    }
  }

  /// Get cached attendance history for a class and date
  static Future<List<dynamic>> getCachedHistory(int classId, String date) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString('$_kHistoryPrefix${classId}_$date');
      if (data != null && data.isNotEmpty) {
        return jsonDecode(data) as List<dynamic>;
      }
    } catch (e) {
      debugPrint('Error loading cached history: $e');
    }
    return [];
  }

  /// Save attendance submission to offline queue and cache locally
  static Future<void> enqueueSubmission({
    required int classId,
    required String className,
    required String date,
    required Map<int, String> attendance,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawQueue = prefs.getString(_kQueueKey);
      List<dynamic> queue = [];
      if (rawQueue != null && rawQueue.isNotEmpty) {
        try {
          queue = jsonDecode(rawQueue) as List<dynamic>;
        } catch (_) {
          queue = [];
        }
      }

      // Convert attendance map to records list
      final records = attendance.entries.map((e) => {
        'student_id': e.key,
        'status': e.value,
      }).toList();

      // Remove existing queued entry for the same class and date if any
      queue.removeWhere((item) =>
          item['class_id']?.toString() == classId.toString() &&
          item['date']?.toString() == date);

      queue.add({
        'id': '${classId}_${date}_${DateTime.now().millisecondsSinceEpoch}',
        'class_id': classId,
        'class_name': className,
        'date': date,
        'records': records,
        'timestamp': DateTime.now().toIso8601String(),
      });

      await prefs.setString(_kQueueKey, jsonEncode(queue));

      // Also update local cached history so UI immediately reflects marked attendance
      final historyRecords = records.map((r) => {
        'student_id': r['student_id'],
        'status': r['status'],
        'date': date,
        'is_offline_pending': true,
      }).toList();
      await cacheHistory(classId, date, historyRecords);
    } catch (e) {
      debugPrint('Error enqueuing offline attendance: $e');
    }
  }

  /// Check if a class and date has a pending offline submission
  static Future<bool> hasPendingSync(int classId, String date) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawQueue = prefs.getString(_kQueueKey);
      if (rawQueue == null || rawQueue.isEmpty) return false;
      final queue = jsonDecode(rawQueue) as List<dynamic>;
      return queue.any((item) =>
          item['class_id']?.toString() == classId.toString() &&
          item['date']?.toString() == date);
    } catch (e) {
      return false;
    }
  }

  /// Get number of pending offline sync items
  static Future<int> getPendingQueueCount() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawQueue = prefs.getString(_kQueueKey);
      if (rawQueue == null || rawQueue.isEmpty) return 0;
      final queue = jsonDecode(rawQueue) as List<dynamic>;
      return queue.length;
    } catch (_) {
      return 0;
    }
  }

  /// Process the offline queue and sync with server
  static Future<List<String>> syncPendingSubmissions(AttendanceService service) async {
    final syncedNames = <String>[];
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawQueue = prefs.getString(_kQueueKey);
      if (rawQueue == null || rawQueue.isEmpty) return syncedNames;

      List<dynamic> queue = [];
      try {
        queue = jsonDecode(rawQueue) as List<dynamic>;
      } catch (_) {
        return syncedNames;
      }

      if (queue.isEmpty) return syncedNames;

      final remainingQueue = <dynamic>[];

      for (final item in queue) {
        try {
          final classId = int.tryParse(item['class_id']?.toString() ?? '') ?? 0;
          final date = (item['date'] ?? '').toString();
          final rawRecords = (item['records'] as List<dynamic>?) ?? [];
          final records = rawRecords.map((r) => Map<String, dynamic>.from(r as Map)).toList();
          final className = (item['class_name'] ?? 'Class $classId').toString();

          if (classId <= 0 || date.isEmpty || records.isEmpty) {
            continue; // invalid, discard
          }

          // Send batch to server
          await service.markTeacherAttendanceBatch(
            classId: classId,
            dateYyyyMmDd: date,
            records: records,
          );

          // Update cached history to remove offline pending flag
          final historyRecords = records.map((r) => {
            'student_id': r['student_id'],
            'status': r['status'],
            'date': date,
          }).toList();
          await cacheHistory(classId, date, historyRecords);

          syncedNames.add(className);
        } catch (e) {
          final errStr = e.toString().toLowerCase();
          // If it's a domain validation error (e.g. Sunday or holiday), discard it so it doesn't get stuck forever
          if (errStr.contains('sunday') || errStr.contains('holiday') || errStr.contains('academic year')) {
            debugPrint('Discarding invalid offline attendance: $e');
            continue;
          }
          // If it's a network error, keep it in queue to retry later
          remainingQueue.add(item);
          break; // Stop processing further queue items if network is down
        }
      }

      await prefs.setString(_kQueueKey, jsonEncode(remainingQueue));
    } catch (e) {
      debugPrint('Error syncing pending offline attendance: $e');
    }
    return syncedNames;
  }
}
