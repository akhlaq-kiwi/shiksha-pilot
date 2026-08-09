import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;

import '../constants/notification_categories.dart';
import 'notification_helper.dart';

/// Schedules the reminder half of the notification system.
///
/// These never involve the server. A homework due date, an exam start date and
/// a fee due date are all already on the device once the relevant screen has
/// been opened, so the reminder can be scheduled locally and fired by Android
/// even with no network — and, importantly, without every install polling the
/// API on a timer just to find out whether it's time to nag someone. On the
/// shared hosting this runs on, that difference is the whole point: a push or a
/// local alarm costs nothing per device, a poll costs a request per device per
/// interval.
///
/// Scheduled ids are namespaced per kind so re-scheduling replaces rather than
/// duplicates: Android upserts a pending notification by id.
class LocalNotificationScheduler {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  // Id ranges keep the four reminder kinds from colliding with each other or
  // with the millisecond-derived ids used by server-driven notifications.
  static const int _homeworkBase = 100000;
  static const int _examBase = 200000;
  static const int _feeBase = 300000;
  static const int _attendanceId = 400001;

  /// Homework due tomorrow, at 6pm the evening before — late enough that the
  /// school day is over, early enough to still act on it.
  static Future<void> scheduleHomeworkReminder({
    required int homeworkId,
    required String title,
    required DateTime dueDate,
  }) async {
    final when = DateTime(dueDate.year, dueDate.month, dueDate.day - 1, 18, 0);
    await _scheduleAt(
      id: _homeworkBase + (homeworkId % 90000),
      when: when,
      title: 'Homework due tomorrow',
      body: title,
      category: NotificationCategory.academic,
      eventKey: NotificationEvent.homeworkDueReminder,
      link: '/homework',
    );
  }

  /// Exam starting tomorrow, at 7pm the evening before.
  static Future<void> scheduleExamReminder({
    required int examId,
    required String examName,
    required DateTime startDate,
  }) async {
    final when = DateTime(startDate.year, startDate.month, startDate.day - 1, 19, 0);
    await _scheduleAt(
      id: _examBase + (examId % 90000),
      when: when,
      title: 'Exam starts tomorrow',
      body: '$examName begins tomorrow. Check your admit card and timetable.',
      category: NotificationCategory.exam,
      eventKey: NotificationEvent.examStartsTomorrow,
      link: '/exams',
    );
  }

  /// Fee due reminder, three days ahead at 10am.
  ///
  /// Three days rather than one: a parent usually needs a banking day or two
  /// to actually pay, so a next-day reminder arrives too late to be useful.
  static Future<void> scheduleFeeDueReminder({
    required int feeId,
    required String label,
    required DateTime dueDate,
  }) async {
    final when = DateTime(dueDate.year, dueDate.month, dueDate.day, 10, 0)
        .subtract(const Duration(days: 3));
    await _scheduleAt(
      id: _feeBase + (feeId % 90000),
      when: when,
      title: 'Fee due soon',
      body: '$label is due on ${_formatDate(dueDate)}.',
      category: NotificationCategory.fees,
      eventKey: NotificationEvent.feeDueReminder,
      link: '/student/fees',
    );
  }

  /// Daily nudge for teachers who haven't marked attendance yet, at 11am on
  /// weekdays. Rescheduled each time it fires (Android caps how far out a
  /// daily repeat can be trusted), and cancelled as soon as attendance is
  /// submitted for the day.
  static Future<void> scheduleAttendanceReminder({int hour = 11, int minute = 0}) async {
    final prefs = await SharedPreferences.getInstance();
    if (!(prefs.getBool('attendance_reminder_enabled') ?? true)) return;

    final now = DateTime.now();
    var when = DateTime(now.year, now.month, now.day, hour, minute);
    if (when.isBefore(now)) {
      when = when.add(const Duration(days: 1));
    }
    // Skip the weekend — a Saturday reminder to mark attendance is noise.
    while (when.weekday == DateTime.saturday || when.weekday == DateTime.sunday) {
      when = when.add(const Duration(days: 1));
    }

    await _scheduleAt(
      id: _attendanceId,
      when: when,
      title: "Attendance not marked yet",
      body: "Today's attendance is still pending for your class.",
      category: NotificationCategory.attendance,
      eventKey: NotificationEvent.attendanceNotMarkedReminder,
      link: '/attendance',
    );
  }

  static Future<void> cancelAttendanceReminder() => _plugin.cancel(id: _attendanceId);

  static Future<void> cancelHomeworkReminder(int homeworkId) =>
      _plugin.cancel(id: _homeworkBase + (homeworkId % 90000));

  static Future<void> cancelExamReminder(int examId) =>
      _plugin.cancel(id: _examBase + (examId % 90000));

  /// Clear every scheduled reminder — used on logout, so the next user of a
  /// shared device doesn't inherit the previous one's reminders.
  static Future<void> cancelAll() async {
    try {
      final pending = await _plugin.pendingNotificationRequests();
      for (final p in pending) {
        if (p.id >= _homeworkBase) {
          await _plugin.cancel(id: p.id);
        }
      }
    } catch (e) {
      debugPrint('cancelAll reminders failed: $e');
    }
  }

  // ------------------------------------------------------------------

  static Future<void> _scheduleAt({
    required int id,
    required DateTime when,
    required String title,
    required String body,
    required NotificationCategory category,
    required String eventKey,
    String? link,
  }) async {
    // A reminder whose moment has already passed is dropped rather than fired
    // immediately — an alert about yesterday's deadline is worse than silence.
    if (when.isBefore(DateTime.now())) return;

    try {
      await _plugin.zonedSchedule(
        id: id,
        title: title,
        body: body,
        scheduledDate: tz.TZDateTime.from(when, tz.local),
        notificationDetails: NotificationDetails(
          android: NotificationHelper.androidDetailsFor(category),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        payload: json.encode({
          'title': title,
          'message': body,
          'link': link ?? '',
          'event_key': eventKey,
          'category': category.id,
        }),
      );
    } catch (e) {
      debugPrint('Failed to schedule reminder $id: $e');
    }
  }

  static String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }
}
