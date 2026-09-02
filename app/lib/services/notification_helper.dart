import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:printing/printing.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import '../constants/notification_categories.dart';
import '../screens/leave_list_screen.dart';
import '../screens/timetable_screen.dart';
import '../screens/notification_center_screen.dart';
import '../screens/fees_card_screen.dart';
import '../screens/salary_card_screen.dart';
import '../screens/exam_list_screen.dart';
import '../screens/homework_list_screen.dart';
import '../screens/achievements_screen.dart';
import '../screens/attendance_screen.dart';
import '../services/attendance_service.dart';
import '../services/leave_service.dart';
import '../services/exam_service.dart';
import '../main.dart';
import '../config.dart';

class NotificationHelper {
  static final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static Uint8List? _lastDownloadedBytes;
  static String? _lastDownloadedFileName;
  static bool _channelsCreated = false;

  static Future<void> init() async {
    // zonedSchedule needs the timezone database loaded, and Asia/Kolkata set
    // explicitly — tz.local otherwise defaults to UTC, which would fire every
    // scheduled reminder 5.5 hours off.
    try {
      tzdata.initializeTimeZones();
      tz.setLocalLocation(tz.getLocation('Asia/Kolkata'));
    } catch (_) {
      // Already initialised on a previous call, or the location is missing.
    }

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initializationSettings =
        InitializationSettings(android: initializationSettingsAndroid);

    await _flutterLocalNotificationsPlugin.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) async {
        final payload = response.payload;
        if (payload != null) {
          try {
            final notif = json.decode(payload);

            // Handle file download notification click
            if (notif['type'] == 'download_complete') {
              if (_lastDownloadedBytes != null && _lastDownloadedFileName != null) {
                await Printing.layoutPdf(
                  onLayout: (format) async => _lastDownloadedBytes!,
                  name: _lastDownloadedFileName!,
                );
              }
              return;
            }

            final prefs = await SharedPreferences.getInstance();
            final token = prefs.getString('auth_token') ?? '';
            final userRole = prefs.getString('user_role') ?? '';
            final studentId = prefs.getInt('selected_student_id');
            final baseUrl = resolveBaseUrlFrom(prefs);

            // Unauthenticated deep linking redirect to login
            if (token.isEmpty || userRole.isEmpty) {
              await prefs.setString('pending_notification_payload', payload);
              MyApp.navigatorKey.currentState?.pushAndRemoveUntil(
                MaterialPageRoute(builder: (context) => const LoginScreen()),
                (route) => false,
              );
              return;
            }

            navigateToTarget(notif, baseUrl, token, userRole, studentId);
          } catch (e) {
            debugPrint('Error deep linking from notification: $e');
          }
        }
      },
    );

    // Request permissions for Android 13+
    try {
      await _flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    } catch (_) {
      // Ignored in background isolates where no Activity context exists
    }

    await _createChannels();
  }

  /// Create one Android channel per category, up front.
  ///
  /// Channels have to exist before a notification references them: an incoming
  /// FCM message naming an unknown channel_id gets posted with default
  /// importance and no sound instead of the settings we intended. Creating
  /// them at startup also makes every category visible in Android's own
  /// notification settings immediately, so a user can mute fee bookkeeping
  /// without having to receive one first.
  static Future<void> _createChannels() async {
    if (_channelsCreated) return;

    final android = _flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (android == null) return;

    for (final category in NotificationCategory.all) {
      await android.createNotificationChannel(
        AndroidNotificationChannel(
          category.id,
          category.name,
          description: category.description,
          importance: category.highImportance ? Importance.max : Importance.defaultImportance,
          playSound: true,
        ),
      );
    }
    _channelsCreated = true;
  }

  /// The Android presentation for a category — shared by locally scheduled
  /// reminders and by pushes we render ourselves in the foreground, so both
  /// look identical to the ones Android's tray draws from an FCM payload.
  static AndroidNotificationDetails androidDetailsFor(NotificationCategory category, {int? badgeCount}) {
    return AndroidNotificationDetails(
      category.id,
      category.name,
      channelDescription: category.description,
      importance: category.highImportance ? Importance.max : Importance.defaultImportance,
      priority: category.highImportance ? Priority.high : Priority.defaultPriority,
      playSound: true,
      enableVibration: true,
      channelShowBadge: true,
      number: badgeCount,
      icon: '@mipmap/ic_launcher',
      color: category.color,
      styleInformation: const BigTextStyleInformation(''),
    );
  }

  /// Render an FCM message as a local notification.
  ///
  /// Needed in two cases: a foreground message (Android never draws those
  /// itself) and a data-only message. Reuses the same payload shape as the
  /// polling path so tap handling has exactly one code path.
  static Future<void> showFromRemote(RemoteMessage message) async {
    final data = message.data;
    final title = message.notification?.title ?? data['title'] ?? '';
    final body = message.notification?.body ?? data['body'] ?? '';
    if (title.isEmpty && body.isEmpty) return;

    final category = NotificationCategory.byId(data['category']);

    await _flutterLocalNotificationsPlugin.show(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(android: androidDetailsFor(category)),
      payload: json.encode({
        'title': title,
        'message': body,
        'link': data['link'] ?? '',
        'event_key': data['event_key'] ?? '',
        'category': category.id,
        'id': data['notification_id'] ?? data['id'] ?? '',
      }),
    );
  }

  static void _markNotificationAsRead(
    dynamic notif,
    String baseUrl,
    String token,
    String userRole,
    int? studentId,
  ) async {
    try {
      if (token.isEmpty || baseUrl.isEmpty) return;

      int? notifId;
      if (notif['id'] != null) {
        notifId = int.tryParse(notif['id'].toString());
      } else if (notif['notification_id'] != null) {
        notifId = int.tryParse(notif['notification_id'].toString());
      } else if (notif['notif_id'] != null) {
        notifId = int.tryParse(notif['notif_id'].toString());
      }

      final String eventKey = (notif['event_key'] ?? '').toString();
      final String link = (notif['link'] ?? '').toString();
      final String title = (notif['title'] ?? notif['message'] ?? '').toString();

      final isSchoolStaff = userRole.toUpperCase() == 'SCHOOL_ADMIN' || userRole.toUpperCase() == 'SUPER_ADMIN';
      final path = isSchoolStaff 
          ? '/api/school/notifications/${notifId ?? 0}/read'
          : '/api/student/notifications/${notifId ?? 0}/read';

      final uri = Uri.parse('$baseUrl$path');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (studentId != null) 'X-Student-Id': studentId.toString(),
      };

      final bodyPayload = json.encode({
        'id': notifId,
        'event_key': eventKey,
        'link': link,
        'title': title,
      });

      await http.post(uri, headers: headers, body: bodyPayload).catchError((_) => http.Response('', 500));
    } catch (e) {
      debugPrint('Failed to mark notification as read: $e');
    }
  }

  static void navigateToTarget(
    dynamic notif,
    String baseUrl,
    String token,
    String userRole,
    int? studentId,
  ) {
    // Automatically mark the notification as read in the backend DB
    _markNotificationAsRead(notif, baseUrl, token, userRole, studentId);

    final title = (notif['title'] ?? '').toString().toLowerCase();
    final message = (notif['message'] ?? '').toString().toLowerCase();
    final link = (notif['link'] ?? '').toString().toLowerCase();

    final leaveService = LeaveService(baseUrl: baseUrl, token: token);

    int? notifStudentId;
    DateTime? notifDate;
    try {
      final cleanLink = link.startsWith('http') ? link : 'http://localhost$link';
      final uri = Uri.parse(cleanLink);
      final idStr = uri.queryParameters['student_id'] ?? uri.queryParameters['studentId'];
      if (idStr != null) {
        notifStudentId = int.tryParse(idStr);
      }
      final dateStr = uri.queryParameters['date'] ?? notif['date'];
      if (dateStr != null) {
        notifDate = DateTime.tryParse(dateStr.toString());
      }
    } catch (e) {
      debugPrint('Failed to parse query params from notification link: $e');
    }

    final eventKey = (notif['event_key'] ?? '').toString();
    if (eventKey.isNotEmpty) {
      final routed = _screenForEvent(
        eventKey, baseUrl, token, userRole, notifStudentId ?? studentId, leaveService, targetDate: notifDate,
      );
      if (routed != null) {
        MyApp.navigatorKey.currentState?.push(
          MaterialPageRoute(builder: (context) => routed),
        );
        return;
      }
    }

    Widget targetScreen;
    if (userRole.toUpperCase() == 'TEACHER' && (link.contains('salary') || title.contains('salary') || message.contains('salary') || eventKey == 'SALARY_DISBURSED')) {
      targetScreen = SalaryCardScreen(
        baseUrl: baseUrl,
        token: token,
      );
    } else if (link.contains('exam') || title.contains('exam') || message.contains('exam') || link.contains('examination') || title.contains('examination') || message.contains('examination')) {
      final examService = ExamService(baseUrl: baseUrl, token: token);
      targetScreen = ExamListScreen(
        examService: examService,
        userRole: userRole,
        selectedStudentId: notifStudentId ?? studentId,
      );
    } else if (link.contains('fees') || title.contains('fee') || message.contains('fee')) {
      targetScreen = FeesCardScreen(
        baseUrl: baseUrl,
        token: token,
        studentId: notifStudentId ?? studentId,
      );
    } else if (link.contains('leaves') || title.contains('leave') || message.contains('leave') || title.contains('holiday') || message.contains('holiday')) {
      final isLeaveReqNotif = title.contains('approve') || title.contains('reject') || message.contains('approve') || message.contains('reject') || title.contains('request') || message.contains('request');
      targetScreen = LeaveListScreen(
        leaveService: leaveService,
        userRole: userRole,
        selectedStudentId: notifStudentId ?? studentId,
        initialTabIndex: isLeaveReqNotif ? 1 : 0,
      );
    } else if (link.contains('timetable') || title.contains('timetable') || message.contains('timetable')) {
      targetScreen = TimetableScreen(
        baseUrl: leaveService.baseUrl,
        token: leaveService.token,
        userRole: userRole,
        selectedStudentId: notifStudentId ?? studentId,
        targetDate: notifDate,
      );
    } else if (link.contains('homework') || title.contains('homework') || message.contains('homework') || link.contains('assignment') || title.contains('assignment') || message.contains('assignment')) {
      targetScreen = HomeworkListScreen(
        baseUrl: baseUrl,
        userRole: userRole,
        selectedStudentId: notifStudentId ?? studentId,
      );
    } else if (link.contains('achievements') || title.toLowerCase().contains('achievement') || message.toLowerCase().contains('achievement')) {
      targetScreen = AchievementsScreen(
        baseUrl: baseUrl,
        token: token,
        userRole: userRole,
        studentId: notifStudentId ?? studentId,
      );
    } else if (link.contains('attendance') || title.contains('absent') || message.contains('absent') || eventKey.toLowerCase().contains('absent') || eventKey.toLowerCase().contains('attendance')) {
      targetScreen = AttendanceScreen(
        attendanceService: AttendanceService(baseUrl: baseUrl, token: token),
        userRole: userRole,
        selectedStudentId: notifStudentId ?? studentId,
      );
    } else {
      targetScreen = NotificationCenterScreen(
        baseUrl: leaveService.baseUrl,
        token: leaveService.token,
        studentId: notifStudentId ?? studentId,
      );
    }

    MyApp.navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (context) => targetScreen),
    );
  }

  /// Map a catalog event key to its destination screen.
  ///
  /// Returns null for events with no meaningful destination (a completed
  /// download, a subscription change that only concerns the web console), which
  /// lets the caller fall through to the legacy matching rather than pushing
  /// an arbitrary screen.
  static Widget? _screenForEvent(
    String eventKey,
    String baseUrl,
    String token,
    String userRole,
    int? studentId,
    LeaveService leaveService, {
    DateTime? targetDate,
  }) {
    switch (eventKey) {
      case NotificationEvent.leaveRequestSubmitted:
      case NotificationEvent.leaveCancelledByApplicant:
        return LeaveListScreen(
          leaveService: leaveService,
          userRole: userRole,
          selectedStudentId: studentId,
          initialTabIndex: 1,
        );

      case NotificationEvent.leaveApproved:
      case NotificationEvent.leaveRejected:
      case NotificationEvent.leaveCancelledByAdmin:
        return LeaveListScreen(
          leaveService: leaveService,
          userRole: userRole,
          selectedStudentId: studentId,
          initialTabIndex: 1,
        );

      case NotificationEvent.holidayAnnounced:
        return LeaveListScreen(
          leaveService: leaveService,
          userRole: userRole,
          selectedStudentId: studentId,
          initialTabIndex: 0,
        );

      case NotificationEvent.homeworkAssigned:
      case NotificationEvent.homeworkDueReminder:
        return HomeworkListScreen(
          baseUrl: baseUrl,
          userRole: userRole,
          selectedStudentId: studentId,
        );

      case NotificationEvent.timetableUpdated:
      case NotificationEvent.substituteAssigned:
        return TimetableScreen(
          baseUrl: baseUrl,
          token: token,
          userRole: userRole,
          selectedStudentId: studentId,
          targetDate: targetDate,
        );

      case NotificationEvent.examScheduled:
      case NotificationEvent.examSchemePublished:
      case NotificationEvent.examSchemeUnpublished:
      case NotificationEvent.examAdmitCardPublished:
      case NotificationEvent.examAdmitCardUnpublished:
      case NotificationEvent.examResultPublished:
      case NotificationEvent.examStartsTomorrow:
        return ExamListScreen(
          examService: ExamService(baseUrl: baseUrl, token: token),
          userRole: userRole,
          selectedStudentId: studentId,
        );

      case NotificationEvent.feeAdmissionAdded:
      case NotificationEvent.feeAnnualAdded:
      case NotificationEvent.feeTransportGenerated:
      case NotificationEvent.feePaymentRecorded:
      case NotificationEvent.feePaymentReverted:
      case NotificationEvent.feePenaltyApplied:
      case NotificationEvent.feeDueReminder:
        return FeesCardScreen(
          baseUrl: baseUrl,
          token: token,
          studentId: studentId,
        );

      case 'SALARY_DISBURSED':
        return SalaryCardScreen(
          baseUrl: baseUrl,
          token: token,
        );

      case NotificationEvent.achievementAttendanceAward:
      case NotificationEvent.achievementAcademicTopper:
      case 'ACHIEVEMENT_UNLOCKED':
      case 'ACHIEVEMENT_GENERATED':
        return AchievementsScreen(
          baseUrl: baseUrl,
          token: token,
          userRole: userRole,
          studentId: studentId,
        );

      case NotificationEvent.attendanceMarkedAbsent:
      case 'ATTENDANCE_ABSENT':
        return AttendanceScreen(
          attendanceService: AttendanceService(baseUrl: baseUrl, token: token),
          userRole: userRole,
          selectedStudentId: studentId,
        );

      case NotificationEvent.announcementPublished:
      case NotificationEvent.attendanceNotMarkedReminder:
      case NotificationEvent.feeFollowupDueToday:
      case NotificationEvent.feeFollowupOverdue:
        // These have no dedicated mobile screen yet; the notification centre
        // shows the full message, which is the useful destination.
        return NotificationCenterScreen(
          baseUrl: baseUrl,
          token: token,
          studentId: studentId,
          userRole: userRole,
        );

      default:
        return null;
    }
  }

  static Future<void> showDownloadNotification({
    required String title,
    required String fileName,
    required List<int> bytes,
  }) async {
    _lastDownloadedBytes = Uint8List.fromList(bytes);
    _lastDownloadedFileName = fileName;

    final NotificationDetails platformDetails = NotificationDetails(
      android: androidDetailsFor(NotificationCategory.system),
    );

    final payload = json.encode({
      'type': 'download_complete',
      'event_key': NotificationEvent.fileDownloadComplete,
      'category': NotificationCategory.system.id,
      'fileName': fileName,
    });

    final int id = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    await _flutterLocalNotificationsPlugin.show(
      id: id,
      title: '📥 $title',
      body: 'Tap to open $fileName',
      notificationDetails: platformDetails,
      payload: payload,
    );
  }

  static Future<void> showNotification(dynamic notif, {int? badgeCount}) async {
    final prefs = await SharedPreferences.getInstance();
    final schoolName = prefs.getString('school_name') ?? 'Shiksha Pilot';

    final rawTitle = (notif['title'] ?? '').toString().trim();
    final title = rawTitle.isNotEmpty ? rawTitle : schoolName;
    final message = notif['message'] ?? '';

    final int id = notif['id'] is int 
        ? notif['id'] 
        : int.tryParse(notif['id'].toString()) ?? DateTime.now().millisecondsSinceEpoch ~/ 1000;

    final category = NotificationCategory.byId(notif['category']?.toString());
    final NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidDetailsFor(category, badgeCount: badgeCount));

    await _flutterLocalNotificationsPlugin.show(
      id: id,
      title: title,
      body: message,
      notificationDetails: platformChannelSpecifics,
      payload: json.encode(notif),
    );
  }
}
