import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Configured Base URL from compile-time --dart-define or local environment default.
const String kEnvBaseUrl = String.fromEnvironment('BASE_URL', defaultValue: 'https://qa.shikshapilot.com');

/// QA Server Base URL.
const String kQaBaseUrl = 'https://qa.shikshapilot.com';

/// Production Base URL.
const String kProductionBaseUrl = 'https://app.shikshapilot.com';

/// Wi-Fi LAN IP address of local dev server.
const String kWifiBaseUrl = 'http://10.145.85.71:8000';

/// USB ADB reverse port forwarding URL.
const String kUsbBaseUrl = 'http://127.0.0.1:8000';

/// Default local dev server URL.
const String kLocalBaseUrl = 'http://127.0.0.1:8000';

/// Key under which a debug-time server override is stored.
const String kBaseUrlPrefKey = 'base_url';

/// Whether the login screen may point the app at a different server.
bool get kServerOverrideAllowed => kDebugMode;

/// Base URL for API calls, given an already-loaded [SharedPreferences].
String resolveBaseUrlFrom(SharedPreferences prefs) {
  final saved = prefs.getString(kBaseUrlPrefKey);
  if (saved != null && saved.isNotEmpty && saved != 'http://127.0.0.1:8000' && saved != 'http://10.145.85.71:8000') {
    return saved;
  }
  return kEnvBaseUrl;
}

/// Base URL for API calls, loading preferences as needed.
Future<String> resolveBaseUrl() async {
  final prefs = await SharedPreferences.getInstance();
  return resolveBaseUrlFrom(prefs);
}






