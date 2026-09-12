import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The only server a release build will ever talk to.
const String kProductionBaseUrl = 'https://qa.shikshapilot.com';

/// Local dev server URL via ADB port forwarding (http://127.0.0.1:8000).
const String kLocalBaseUrl = 'http://127.0.0.1:8000';

/// Key under which a debug-time server override is stored.
const String kBaseUrlPrefKey = 'base_url';

/// Whether the login screen may point the app at a different server.
/// Debug builds only.
bool get kServerOverrideAllowed => kDebugMode;

/// Base URL for API calls, given an already-loaded [SharedPreferences].
/// Debug builds use local ADB reverse server URL (http://127.0.0.1:8000).
String resolveBaseUrlFrom(SharedPreferences prefs) {
  if (!kServerOverrideAllowed) {
    return kProductionBaseUrl;
  }
  final saved = prefs.getString(kBaseUrlPrefKey);
  if (saved != null && saved.isNotEmpty) {
    return saved;
  }
  return kLocalBaseUrl;
}

/// Base URL for API calls, loading preferences as needed.
Future<String> resolveBaseUrl() async {
  if (!kServerOverrideAllowed) {
    return kProductionBaseUrl;
  }
  final prefs = await SharedPreferences.getInstance();
  return resolveBaseUrlFrom(prefs);
}





