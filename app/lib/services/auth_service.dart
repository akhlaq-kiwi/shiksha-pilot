import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class AuthValidationException implements Exception {
  final Map<String, String> fieldErrors;
  final String message;

  AuthValidationException(this.fieldErrors, [this.message = 'Validation failed']);

  @override
  String toString() => message;
}

class AuthService {
  final String baseUrl;

  AuthService({required this.baseUrl});

  Future<Map<String, dynamic>> login(String phone, String password) async {
    final uri = Uri.parse('$baseUrl/api/auth/login');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'phone': phone,
        'password': password,
      }),
    );

    final resData = json.decode(response.body);
    if (response.statusCode == 200) {
      return resData['data']; // Contains 'token' and 'user' map
    } else {
      if (resData['data'] != null && resData['data'] is Map) {
        Map<String, dynamic> errorsMap = Map<String, dynamic>.from(resData['data'] as Map);
        if (errorsMap['errors'] != null && errorsMap['errors'] is Map) {
          errorsMap = Map<String, dynamic>.from(errorsMap['errors'] as Map);
        }
        if (errorsMap.containsKey('phone') && errorsMap['phone'] != null) {
          throw Exception(errorsMap['phone'].toString());
        } else if (errorsMap.containsKey('password') && errorsMap['password'] != null) {
          throw Exception(errorsMap['password'].toString());
        }
      }
      final msg = resData['message'] as String?;
      if (msg != null && msg.isNotEmpty && msg != 'Validation failed.') {
        throw Exception(msg);
      }
      throw Exception('Login failed. Please check your mobile number and password.');
    }
  }

  Future<void> changePassword(String token, String currentPassword, String newPassword) async {
    final uri = Uri.parse('$baseUrl/api/auth/change-password');
    final response = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'current_password': currentPassword,
        'new_password': newPassword,
      }),
    );

    final resData = json.decode(response.body);
    if (response.statusCode != 200) {
      final Map<String, String> errorsMap = {};
      if (resData['data'] != null && resData['data'] is Map) {
        final Map<String, dynamic> rawData = resData['data'];
        Map<String, dynamic> sourceMap = rawData;
        if (rawData['errors'] != null && rawData['errors'] is Map) {
          sourceMap = rawData['errors'] as Map<String, dynamic>;
        }
        sourceMap.forEach((key, value) {
          if (value != null && value is! Map) {
            errorsMap[key] = value.toString();
          }
        });
      }
      if (errorsMap.isNotEmpty) {
        final msg = errorsMap['current_password'] ?? resData['message'] ?? 'Validation failed';
        throw AuthValidationException(errorsMap, msg);
      }
      throw Exception(resData['message'] ?? 'Failed to change password.');
    }
  }

  Future<Map<String, dynamic>> fetchProfile(String token) async {
    final uri = Uri.parse('$baseUrl/api/auth/profile');
    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final resData = json.decode(response.body);
    if (response.statusCode == 200) {
      return resData['data']; // User profile map
    } else {
      throw Exception(resData['message'] ?? 'Failed to fetch profile.');
    }
  }
}
