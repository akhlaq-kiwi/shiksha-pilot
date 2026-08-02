import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:school_hub/main.dart';

export 'package:http/http.dart' hide get, post;

Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
  final response = await http.get(url, headers: headers);
  _checkUnauthorized(response);
  return response;
}

Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  final response = await http.post(url, headers: headers, body: body);
  _checkUnauthorized(response);
  return response;
}

void _checkUnauthorized(http.Response response) async {
  if (response.statusCode == 401) {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_role');
    await prefs.remove('user_name');
    await prefs.remove('selected_student_id');
    
    // Globally redirect to LoginScreen using MaterialApp navigatorKey
    MyApp.navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }
}
