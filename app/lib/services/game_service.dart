import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class GameService {
  final String baseUrl;
  final String token;

  GameService({required this.baseUrl, required this.token});

  Map<String, String> _headers([int? studentId]) => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        if (studentId != null) 'X-Student-Id': studentId.toString(),
      };

  Future<Map<String, dynamic>> getGameProgress(int? studentId) async {
    final uri = Uri.parse('$baseUrl/api/student/game/word-builder/progress');
    final response = await http.get(uri, headers: _headers(studentId));

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? {};
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to load game progress.');
    }
  }

  Future<Map<String, dynamic>> syncGameProgress(Map<String, dynamic> data, int? studentId) async {
    final uri = Uri.parse('$baseUrl/api/student/game/word-builder/progress');
    final response = await http.post(
      uri,
      headers: _headers(studentId),
      body: json.encode(data),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? {};
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to sync game progress.');
    }
  }

  Future<Map<String, dynamic>> claimDailyLogin(int? studentId) async {
    final uri = Uri.parse('$baseUrl/api/student/game/word-builder/claim-daily');
    final response = await http.post(
      uri,
      headers: _headers(studentId),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? {};
    } else {
      throw Exception(json.decode(response.body)['message'] ?? 'Failed to claim daily reward.');
    }
  }
}
