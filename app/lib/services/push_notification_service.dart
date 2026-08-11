import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/notification_categories.dart';
import 'http_service.dart' as http;
import 'notification_helper.dart';

/// Handles a push that arrives while the app is terminated or backgrounded.
///
/// Must be a top-level function annotated with `@pragma('vm:entry-point')`:
/// Android spins up a separate isolate for it, so it cannot close over
/// anything from the main isolate and has to initialise Firebase itself.
///
/// When the app is in the background and the message carries a `notification`
/// block, Android's system tray draws it for us — there is nothing to do here
/// but let it through. We only re-show it manually for data-only messages.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  if (message.notification != null) return;

  await Firebase.initializeApp();
  await NotificationHelper.init();
  await NotificationHelper.showFromRemote(message);
}

class PushNotificationService {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static bool _initialised = false;

  /// Wire up Firebase and the message listeners. Safe to call more than once.
  ///
  /// Deliberately never throws: a device with no Play Services, a missing
  /// google-services.json, or a revoked notification permission must all
  /// degrade to "no push, in-app notification centre still works" rather than
  /// preventing the app from starting.
  static Future<void> init() async {
    if (_initialised) return;

    try {
      await Firebase.initializeApp();
      await NotificationHelper.init();

      await _messaging.requestPermission(alert: true, badge: true, sound: true);

      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

      // Foreground: Android does NOT draw a system notification while the app
      // is in the foreground, so we render it ourselves through the local
      // notifications plugin to get the same look and the same tap handling.
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        NotificationHelper.showFromRemote(message);
      });

      // Tapped while the app was backgrounded but alive.
      FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);

      // Tapped while the app was fully terminated — this is the message that
      // cold-started the process, and it is only available once.
      final initial = await _messaging.getInitialMessage();
      if (initial != null) {
        _handleTap(initial);
      }

      // A token can rotate at any time (app restore, cache clear, Play
      // Services update). If we miss a rotation the device silently stops
      // receiving push, so re-register on every refresh.
      _messaging.onTokenRefresh.listen(registerDevice);

      _initialised = true;
    } catch (e) {
      debugPrint('Push init skipped: $e');
    }
  }

  /// Send the current FCM token to the backend and subscribe to the topics it
  /// returns. Call after login and whenever the token rotates.
  static Future<void> registerDevice([String? knownToken]) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('auth_token') ?? '';
      final baseUrl = prefs.getString('base_url') ?? '';
      if (authToken.isEmpty || baseUrl.isEmpty) return;

      final fcmToken = knownToken ?? await _messaging.getToken();
      if (fcmToken == null || fcmToken.isEmpty) return;

      final response = await http.post(
        Uri.parse('$baseUrl/api/notifications/device'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: json.encode({'token': fcmToken, 'platform': 'android'}),
      );

      if (response.statusCode != 200) {
        debugPrint('Device registration failed: ${response.statusCode}');
        return;
      }

      await prefs.setString('fcm_token', fcmToken);

      // The server decides the topic names so they can't drift between the
      // two codebases. Subscribing is a client-side Firebase call, which is
      // why broadcasts cost the API nothing at all.
      final decoded = json.decode(response.body);
      final topics = (decoded['data']?['topics'] as List?) ?? const [];
      for (final topic in topics) {
        await _messaging.subscribeToTopic(topic.toString());
        await prefs.setStringList(
          'fcm_topics',
          topics.map((t) => t.toString()).toList(),
        );
      }
    } catch (e) {
      debugPrint('registerDevice error: $e');
    }
  }

  /// Detach this device on logout.
  ///
  /// Both halves matter on a shared family phone: unsubscribing stops topic
  /// broadcasts, and deactivating the token server-side stops personal ones.
  /// Skipping either means the next person to log in keeps receiving the
  /// previous user's notifications.
  static Future<void> unregisterDevice() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('auth_token') ?? '';
      final baseUrl = prefs.getString('base_url') ?? '';
      final fcmToken = prefs.getString('fcm_token') ?? '';

      for (final topic in prefs.getStringList('fcm_topics') ?? const []) {
        await _messaging.unsubscribeFromTopic(topic);
      }
      await prefs.remove('fcm_topics');

      if (authToken.isNotEmpty && baseUrl.isNotEmpty && fcmToken.isNotEmpty) {
        await http.delete(
          Uri.parse('$baseUrl/api/notifications/device'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $authToken',
          },
          body: json.encode({'token': fcmToken}),
        );
      }
      await prefs.remove('fcm_token');
    } catch (e) {
      debugPrint('unregisterDevice error: $e');
    }
  }

  /// Dispatch a test push notification via backend API to verify delivery.
  static Future<bool> sendTestPush() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('auth_token') ?? '';
      final baseUrl = prefs.getString('base_url') ?? '';
      if (authToken.isEmpty || baseUrl.isEmpty) return false;

      final response = await http.post(
        Uri.parse('$baseUrl/api/notifications/test-push'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      debugPrint('sendTestPush error: $e');
      return false;
    }
  }

  /// Get stored FCM token for diagnostic display in settings.
  static Future<String?> getStoredToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('fcm_token');
  }

  static Future<void> _handleTap(RemoteMessage message) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token') ?? '';
    final userRole = prefs.getString('user_role') ?? '';
    final baseUrl = prefs.getString('base_url') ?? 'https://app.shikshapilot.com';
    final studentId = prefs.getInt('selected_student_id');

    final payload = {
      'title': message.notification?.title ?? message.data['title'] ?? '',
      'message': message.notification?.body ?? message.data['body'] ?? '',
      'link': message.data['link'] ?? '',
      'event_key': message.data['event_key'] ?? '',
      'category': message.data['category'] ?? NotificationCategory.system.id,
    };

    if (token.isEmpty || userRole.isEmpty) {
      // Not signed in yet — stash it so the deep link still resolves once
      // login completes, matching how local notification taps already behave.
      await prefs.setString('pending_notification_payload', json.encode(payload));
      return;
    }

    NotificationHelper.navigateToTarget(payload, baseUrl, token, userRole, studentId);
  }
}

