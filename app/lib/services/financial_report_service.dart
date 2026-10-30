import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:school_hub/services/http_service.dart' as http;

class FinancialReportService {
  final String baseUrl;
  final String token;

  FinancialReportService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// Fetch financial reports history and suggestion data
  Future<Map<String, dynamic>> getFinancialReports() async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return {
        'reports': (data['reports'] as List<dynamic>?) ?? [],
        'next_suggested_start_date': data['next_suggested_start_date']?.toString() ?? '',
        'has_previous_report': data['has_previous_report'] == true || data['has_previous_report'] == 1,
      };
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to load financial reports');
    }
  }

  /// Fetch live ongoing calculation preview
  Future<Map<String, dynamic>> getFinancialPreview({
    required String fromDate,
    required String toDate,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/preview?from_date=$fromDate&to_date=$toDate');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      final data = decoded['data'] ?? decoded;
      return Map<String, dynamic>.from(data);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to fetch financial preview');
    }
  }

  /// Generate a financial report, freezing the specified date range
  Future<Map<String, dynamic>> createFinancialReport({
    required String fromDate,
    required String toDate,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports');
    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode({
        'from_date': fromDate,
        'to_date': toDate,
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to generate financial report');
    }
  }

  /// Submit Hand Over / Settlement Request to School Admin / Owner
  Future<Map<String, dynamic>> submitSettlementRequest(int reportId) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/$reportId/settlement-request');
    final response = await http.post(uri, headers: _headers, body: json.encode({}));

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to submit hand over request');
    }
  }

  /// Delete an unsettled report
  Future<void> deleteFinancialReport(int reportId) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/$reportId');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to delete financial report');
    }
  }

  /// Download Excel bytes of a generated report
  Future<Uint8List> exportFinancialReportBytes(int reportId) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/$reportId/export');
    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    } else {
      throw Exception('Failed to export financial report');
    }
  }

  /// Download Excel bytes of a preview report
  Future<Uint8List> exportPreviewReportBytes(String fromDate, String toDate) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/preview/export?from_date=$fromDate&to_date=$toDate');
    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    } else {
      throw Exception('Failed to export preview report');
    }
  }
}

