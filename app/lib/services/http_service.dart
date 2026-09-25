import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:school_hub/main.dart';

export 'package:http/http.dart' hide get, post, put, delete;

const String _kWifiBaseUrl = 'http://10.184.196.71:8000';
const String _kUsbBaseUrl = 'http://127.0.0.1:8000';

Future<void> _saveWorkingBaseUrl(String base) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', base);
  } catch (e) {
    debugPrint('Failed to save base_url to prefs: $e');
  }
}

Future<http.Response> _executeWithFallback(
  Uri originalUrl,
  Future<http.Response> Function(Uri targetUri) requestFn,
) async {
  final origin = originalUrl.origin;
  final bool isProductionOrQa = origin.contains('shikshapilot.com');
  final List<String> candidateBaseUrls = isProductionOrQa
      ? [origin]
      : [
          origin,
          _kUsbBaseUrl,
          _kWifiBaseUrl,
        ];

  // Remove duplicates while preserving order
  final List<String> uniqueBases = [];
  for (final b in candidateBaseUrls) {
    if (!uniqueBases.contains(b) && b.startsWith('http')) {
      uniqueBases.add(b);
    }
  }

  Object? lastError;

  for (final base in uniqueBases) {
    try {
      final pathAndQuery = originalUrl.hasQuery ? '${originalUrl.path}?${originalUrl.query}' : originalUrl.path;
      final targetUri = Uri.parse('$base$pathAndQuery');

      final timeoutDuration = (base.contains('127.0.0.1') || base.contains('10.') || base.contains('localhost'))
          ? const Duration(seconds: 4)
          : const Duration(seconds: 15);

      final response = await requestFn(targetUri).timeout(timeoutDuration);
      _checkUnauthorized(response);

      // Save working base URL for subsequent calls
      _saveWorkingBaseUrl(base);
      return response;
    } catch (e) {
      lastError = e;
      debugPrint('HTTP request to $base failed: $e. Trying next candidate...');
    }
  }

  if (lastError is TimeoutException) {
    throw TimeoutException('Connection timeout. Please check server connection.');
  }

  throw lastError ?? const SocketException('Connection failed on all available network interfaces.');
}

Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
  return _executeWithFallback(url, (targetUri) => http.get(targetUri, headers: headers));
}

Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  return _executeWithFallback(url, (targetUri) => http.post(targetUri, headers: headers, body: body, encoding: encoding as Encoding?));
}

Future<http.Response> put(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  return _executeWithFallback(url, (targetUri) => http.put(targetUri, headers: headers, body: body, encoding: encoding as Encoding?));
}

Future<http.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  return _executeWithFallback(url, (targetUri) => http.delete(targetUri, headers: headers, body: body, encoding: encoding as Encoding?));
}

void checkUnauthorized(http.Response response) {
  _checkUnauthorized(response);
}

void _checkUnauthorized(http.Response response) async {
  if (response.statusCode == 401) {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_role');
    await prefs.remove('user_name');
    await prefs.remove('selected_student_id');
    
    String errorMsg = 'This account is Inactive';
    try {
      final bodyData = json.decode(response.body);
      if (bodyData is Map && bodyData['message'] != null && bodyData['message'].toString().isNotEmpty) {
        errorMsg = bodyData['message'].toString();
      }
    } catch (_) {}

    // Globally redirect to LoginScreen using MaterialApp navigatorKey
    MyApp.navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => LoginScreen(initialErrorMessage: errorMsg)),
      (route) => false,
    );
  }
}
