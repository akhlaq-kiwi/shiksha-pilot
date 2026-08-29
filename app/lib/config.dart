import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The only server a release build will ever talk to.
const String kProductionBaseUrl = 'https://app.shikshapilot.com';

/// Key under which a debug-time server override is stored.
const String kBaseUrlPrefKey = 'base_url';

/// Whether the login screen may point the app at a different server.
///
/// Debug builds only. Shipping this control would let a user — or anyone who
/// hands a user a URL — redirect real credentials to a host they control, since
/// the value is used for `/api/auth/login` itself.
bool get kServerOverrideAllowed => kDebugMode;

/// Base URL for API calls, given an already-loaded [SharedPreferences].
///
/// Release builds ignore any stored override and always return production, so a
/// value written by an older build cannot outlive the debug session it came
/// from.
String resolveBaseUrlFrom(SharedPreferences prefs) {
  if (!kServerOverrideAllowed) {
    return kProductionBaseUrl;
  }
  final saved = prefs.getString(kBaseUrlPrefKey);

  return (saved != null && saved.isNotEmpty) ? saved : kProductionBaseUrl;
}

/// Base URL for API calls, loading preferences as needed.
Future<String> resolveBaseUrl() async {
  if (!kServerOverrideAllowed) {
    return kProductionBaseUrl;
  }

  return resolveBaseUrlFrom(await SharedPreferences.getInstance());
}
