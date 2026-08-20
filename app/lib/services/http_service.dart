import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:school_hub/main.dart';

export 'package:http/http.dart' hide get, post, put, delete;

bool _isSocketResetError(Object e) {
  final str = e.toString().toLowerCase();
  return e is SocketException ||
      e is http.ClientException ||
      str.contains('connection reset') ||
      str.contains('connection abort') ||
      str.contains('socketexception') ||
      str.contains('broken pipe');
}

Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
  try {
    final response = await http.get(url, headers: headers);
    _checkUnauthorized(response);
    return response;
  } catch (e) {
    if (_isSocketResetError(e)) {
      await Future.delayed(const Duration(milliseconds: 150));
      final response = await http.get(url, headers: headers);
      _checkUnauthorized(response);
      return response;
    }
    rethrow;
  }
}

Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  try {
    final response = await http.post(url, headers: headers, body: body, encoding: encoding as Encoding?);
    _checkUnauthorized(response);
    return response;
  } catch (e) {
    if (_isSocketResetError(e)) {
      await Future.delayed(const Duration(milliseconds: 150));
      final response = await http.post(url, headers: headers, body: body, encoding: encoding as Encoding?);
      _checkUnauthorized(response);
      return response;
    }
    rethrow;
  }
}

Future<http.Response> put(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  try {
    final response = await http.put(url, headers: headers, body: body, encoding: encoding as Encoding?);
    _checkUnauthorized(response);
    return response;
  } catch (e) {
    if (_isSocketResetError(e)) {
      await Future.delayed(const Duration(milliseconds: 150));
      final response = await http.put(url, headers: headers, body: body, encoding: encoding as Encoding?);
      _checkUnauthorized(response);
      return response;
    }
    rethrow;
  }
}

Future<http.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  try {
    final response = await http.delete(url, headers: headers, body: body, encoding: encoding as Encoding?);
    _checkUnauthorized(response);
    return response;
  } catch (e) {
    if (_isSocketResetError(e)) {
      await Future.delayed(const Duration(milliseconds: 150));
      final response = await http.delete(url, headers: headers, body: body, encoding: encoding as Encoding?);
      _checkUnauthorized(response);
      return response;
    }
    rethrow;
  }
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
