import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../screens/leave_list_screen.dart';
import '../screens/timetable_screen.dart';
import '../screens/notification_center_screen.dart';
import '../screens/fees_card_screen.dart';
import '../services/leave_service.dart';
import '../main.dart';

class NotificationHelper {
  static final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initializationSettings =
        InitializationSettings(android: initializationSettingsAndroid);

    await _flutterLocalNotificationsPlugin.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload != null) {
          try {
            final notif = json.decode(payload);
            final title = (notif['title'] ?? '').toString().toLowerCase();
            final message = (notif['message'] ?? '').toString().toLowerCase();
            final link = (notif['link'] ?? '').toString().toLowerCase();
            
            SharedPreferences.getInstance().then((prefs) {
              final token = prefs.getString('auth_token') ?? '';
              final userRole = prefs.getString('user_role') ?? '';
              final studentId = prefs.getInt('selected_student_id');
              final baseUrl = prefs.getString('base_url') ?? 'http://10.55.253.71:8000';
              if (token.isEmpty || userRole.isEmpty) return;

              final leaveService = LeaveService(baseUrl: baseUrl, token: token);
              
              // Parse studentId from link if present for deep linking
              int? notifStudentId;
              try {
                final cleanLink = link.startsWith('http') ? link : 'http://localhost$link';
                final uri = Uri.parse(cleanLink);
                final idStr = uri.queryParameters['student_id'] ?? uri.queryParameters['studentId'];
                if (idStr != null) {
                  notifStudentId = int.tryParse(idStr);
                }
              } catch (e) {
                debugPrint('Failed to parse student_id from notification link: $e');
              }

              Widget targetScreen;
              if (link.contains('fees') || title.contains('fee') || message.contains('fee')) {
                targetScreen = FeesCardScreen(
                  baseUrl: baseUrl,
                  token: token,
                  studentId: notifStudentId ?? studentId,
                );
              } else if (link.contains('leaves') || title.contains('leave') || message.contains('leave')) {
                targetScreen = LeaveListScreen(
                  leaveService: leaveService,
                  userRole: userRole,
                  selectedStudentId: notifStudentId ?? studentId,
                );
              } else if (link.contains('timetable') || title.contains('timetable') || message.contains('timetable')) {
                targetScreen = TimetableScreen(
                  baseUrl: leaveService.baseUrl,
                  token: leaveService.token,
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
            });
          } catch (e) {
            debugPrint('Error deep linking from notification: $e');
          }
        }
      },
    );

    // Request permissions for Android 13+
    await _flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  static Future<void> showNotification(dynamic notif) async {
    final prefs = await SharedPreferences.getInstance();
    final schoolName = prefs.getString('school_name') ?? 'Shiksha Pilot School Hub';

    final title = schoolName;
    final message = notif['message'] ?? '';

    final int id = notif['id'] is int 
        ? notif['id'] 
        : int.tryParse(notif['id'].toString()) ?? DateTime.now().millisecondsSinceEpoch ~/ 1000;

    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'school_hub_channel',
      'School Hub Alerts',
      channelDescription: 'School Hub notifications channel',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      icon: 'ic_notification',
      largeIcon: DrawableResourceAndroidBitmap('ic_launcher'),
      color: Color(0xFF3F51B5), // Indigo brand color
      styleInformation: BigTextStyleInformation(''),
    );

    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);

    await _flutterLocalNotificationsPlugin.show(
      id: id,
      title: title,
      body: message,
      notificationDetails: platformChannelSpecifics,
      payload: json.encode(notif),
    );
  }
}
