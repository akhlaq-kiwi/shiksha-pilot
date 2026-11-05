import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

class FeeReminderService {
  final String baseUrl;
  final String token;

  FeeReminderService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// Fetch fee follow-ups listing with stats & pagination
  Future<Map<String, dynamic>> getFeeFollowUps({
    String status = 'ALL',
    String? studentSearch,
    int? classId,
    int? academicYearId,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (status.isNotEmpty && status != 'ALL') 'status': status,
      if (studentSearch != null && studentSearch.trim().isNotEmpty)
        'student_search': studentSearch.trim(),
      if (classId != null) 'class_id': classId.toString(),
      if (academicYearId != null) 'academic_year_id': academicYearId.toString(),
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
    };

    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups')
        .replace(queryParameters: queryParams);

    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      final data = decoded['data'] ?? {};
      return {
        'items': List<dynamic>.from(data['items'] ?? []),
        'stats': Map<String, dynamic>.from(data['stats'] ?? {
          'pending': 0,
          'due_today': 0,
          'upcoming': 0,
          'overdue': 0,
          'completed': 0,
        }),
        'pagination': Map<String, dynamic>.from(data['pagination'] ?? {
          'total_items': 0,
          'page': page,
          'limit': limit,
          'total_pages': 1,
        }),
      };
    } else {
      final err = json.decode(res.body);
      throw Exception(err['message'] ?? 'Failed to load fee follow-ups');
    }
  }

  /// Get details of single follow-up including timeline notes
  Future<Map<String, dynamic>> getFeeFollowUpDetails(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = json.decode(res.body);
      throw Exception(err['message'] ?? 'Failed to load follow-up details');
    }
  }

  /// Create new fee follow-up commitment
  Future<Map<String, dynamic>> createFeeFollowUp(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups');
    final res = await http.post(
      uri,
      headers: _headers,
      body: json.encode(payload),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final errors = decoded['errors'] ?? decoded['fields'];
      if (errors is Map && errors.isNotEmpty) {
        throw Exception(errors.values.first.toString());
      }
      throw Exception(decoded['message'] ?? 'Failed to create fee follow-up');
    }
  }

  /// Update existing follow-up commitment
  Future<Map<String, dynamic>> updateFeeFollowUp(int id, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id');
    final res = await http.put(
      uri,
      headers: _headers,
      body: json.encode(payload),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final errors = decoded['errors'] ?? decoded['fields'];
      if (errors is Map && errors.isNotEmpty) {
        throw Exception(errors.values.first.toString());
      }
      throw Exception(decoded['message'] ?? 'Failed to update follow-up');
    }
  }

  /// Extend follow-up commitment date & reason
  Future<Map<String, dynamic>> extendFeeFollowUp(int id, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id/extend');
    final res = await http.put(
      uri,
      headers: _headers,
      body: json.encode(payload),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final errors = decoded['errors'] ?? decoded['fields'];
      if (errors is Map && errors.isNotEmpty) {
        throw Exception(errors.values.first.toString());
      }
      throw Exception(decoded['message'] ?? 'Failed to extend follow-up');
    }
  }

  /// Update follow-up status (e.g. COMPLETED or PENDING)
  Future<Map<String, dynamic>> updateFeeFollowUpStatus(int id, String status) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id/status');
    final res = await http.put(
      uri,
      headers: _headers,
      body: json.encode({'status': status}),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      throw Exception(decoded['message'] ?? 'Failed to update status');
    }
  }

  /// Delete follow-up
  Future<void> deleteFeeFollowUp(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id');
    final res = await http.delete(uri, headers: _headers);
    if (res.statusCode != 200) {
      final decoded = json.decode(res.body);
      throw Exception(decoded['message'] ?? 'Failed to delete follow-up');
    }
  }

  /// Add note to follow-up history
  Future<Map<String, dynamic>> addFollowUpNote(int id, String comment) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id/notes');
    final res = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'comment': comment}),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      throw Exception(decoded['message'] ?? 'Failed to add note');
    }
  }

  /// Mark parent as contacted
  Future<Map<String, dynamic>> markFollowUpContacted(int id, {String comment = 'Contacted parent.'}) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-follow-ups/$id/contacted');
    final res = await http.post(
      uri,
      headers: _headers,
      body: json.encode({'comment': comment}),
    );
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      throw Exception(decoded['message'] ?? 'Failed to mark contacted');
    }
  }

  /// Get student outstanding balance automatically
  Future<double> getStudentOutstandingFee(int studentId) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$studentId/outstanding-fee');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      final data = decoded['data'] ?? {};
      final bal = data['outstanding_balance'];
      if (bal is num) return bal.toDouble();
      return double.tryParse(bal?.toString() ?? '0') ?? 0.0;
    } else {
      return 0.0;
    }
  }

  /// Check if a student already has an active follow-up (PENDING, DUE_TODAY, or OVERDUE)
  Future<Map<String, dynamic>?> getStudentActiveFollowUp(int studentId) async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/students/$studentId/active-follow-up');
      final res = await http.get(uri, headers: _headers);
      if (res.statusCode == 200) {
        final decoded = json.decode(res.body);
        if (decoded['data'] != null && decoded['data'] is Map) {
          return Map<String, dynamic>.from(decoded['data']);
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Fetch active students list for selection
  Future<List<dynamic>> getStudents({int limit = 1000}) async {
    final uri = Uri.parse('$baseUrl/api/school/students?limit=$limit');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return List<dynamic>.from(decoded['data'] ?? []);
    } else {
      return [];
    }
  }
}
