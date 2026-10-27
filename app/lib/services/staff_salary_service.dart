import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:school_hub/services/http_service.dart' as http;

class StaffSalaryService {
  final String baseUrl;
  final String token;

  StaffSalaryService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  /// Get staff salary payments for a given month
  Future<List<Map<String, dynamic>>> getStaffPayments(String month) async {
    final uri = Uri.parse('$baseUrl/api/school/staff-payments?month=${Uri.encodeComponent(month)}');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final rawList = decoded['data'] ?? [];
      if (rawList is List) {
        return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load staff payments for $month');
    }
  }

  /// Get academic years
  Future<List<Map<String, dynamic>>> getAcademicYears() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/academic-years');
      final response = await http.get(uri, headers: _headers);

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final rawList = decoded['data'] ?? [];
        if (rawList is List) {
          return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
    } catch (e) {
      debugPrint('Error fetching academic years: $e');
    }
    return [];
  }

  /// Get teacher profile details including salary cards and payments
  Future<Map<String, dynamic>> getStaffDetails(int staffId) async {
    final uri = Uri.parse('$baseUrl/api/school/staff/$staffId');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? {});
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load teacher profile');
    }
  }

  /// Disburse current academic year staff salary for a month
  Future<Map<String, dynamic>> payStaffSalary({
    required int staffId,
    required String month,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/staff-payments');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'staff_id': staffId,
        'month': month,
      }),
    );

    Map<String, dynamic> decoded = {};
    try {
      decoded = json.decode(response.body);
    } catch (_) {}

    if (response.statusCode == 200 || response.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to disburse salary.';
      if (decoded['data'] is Map && (decoded['data'] as Map)['errors'] is Map) {
        final errs = (decoded['data'] as Map)['errors'] as Map;
        if (errs.isNotEmpty) {
          msg = errs.values.first.toString();
        }
      } else if (decoded['message'] != null && decoded['message'].toString().trim().isNotEmpty) {
        msg = decoded['message'].toString().trim();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        if (errs is Map && errs.isNotEmpty) {
          msg = errs.values.first.toString();
        } else {
          msg = errs.toString();
        }
      }
      throw Exception(msg);
    }
  }

  /// Disburse previous year staff salary for given months
  Future<Map<String, dynamic>> disbursePreviousYearStaffSalary({
    required int staffId,
    required List<String> months,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/staff-payments/disburse-previous-year');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'staff_id': staffId,
        'months': months,
      }),
    );

    Map<String, dynamic> decoded = {};
    try {
      decoded = json.decode(response.body);
    } catch (_) {}

    if (response.statusCode == 200 || response.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to disburse previous year salary.';
      if (decoded['data'] is Map && (decoded['data'] as Map)['errors'] is Map) {
        final errs = (decoded['data'] as Map)['errors'] as Map;
        if (errs.isNotEmpty) {
          msg = errs.values.first.toString();
        }
      } else if (decoded['message'] != null && decoded['message'].toString().trim().isNotEmpty) {
        msg = decoded['message'].toString().trim();
      }
      throw Exception(msg);
    }
  }

  /// Revert staff salary payment
  Future<Map<String, dynamic>> revertStaffSalary(int paymentId) async {
    final uri = Uri.parse('$baseUrl/api/school/staff-payments/$paymentId');
    final response = await http.delete(uri, headers: _headers);

    Map<String, dynamic> decoded = {};
    try {
      decoded = json.decode(response.body);
    } catch (_) {}

    if (response.statusCode == 200) {
      return decoded;
    } else {
      String msg = 'Failed to revert salary payment.';
      if (decoded['data'] is Map && (decoded['data'] as Map)['errors'] is Map) {
        final errs = (decoded['data'] as Map)['errors'] as Map;
        if (errs.isNotEmpty) {
          msg = errs.values.first.toString();
        }
      } else if (decoded['message'] != null && decoded['message'].toString().trim().isNotEmpty) {
        msg = decoded['message'].toString().trim();
      }
      throw Exception(msg);
    }
  }
}
