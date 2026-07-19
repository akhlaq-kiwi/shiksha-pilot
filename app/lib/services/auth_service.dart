import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

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
      throw Exception(resData['message'] ?? 'Login failed. Please check credentials.');
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
