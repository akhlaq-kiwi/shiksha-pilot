import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:school_hub/services/http_service.dart' as http;

class PendingApprovalsException implements Exception {
  final String message;
  final int pendingExpenseCount;
  final int pendingDiscountCount;

  PendingApprovalsException({
    required this.message,
    required this.pendingExpenseCount,
    required this.pendingDiscountCount,
  });

  @override
  String toString() => message;
}

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
        'from_time': data['from_time']?.toString() ?? '12:00 AM',
        'academic_year_start_date': data['academic_year_start_date']?.toString() ?? '',
        'pending_expense_count': (data['pending_expense_count'] as num?)?.toInt() ?? 0,
        'pending_discount_count': (data['pending_discount_count'] as num?)?.toInt() ?? 0,
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
      final errData = err['data'];
      final errors = errData is Map ? errData['errors'] : null;
      if (errors is Map && errors['code'] == 'PENDING_APPROVAL_REQUIRED') {
        throw PendingApprovalsException(
          message: err['message']?.toString() ??
              'Your expense or discount request is still pending. You need to get it approved or rejected by the School Admin before generating a financial report.',
          pendingExpenseCount: (errors['pending_expense_count'] as num?)?.toInt() ?? 0,
          pendingDiscountCount: (errors['pending_discount_count'] as num?)?.toInt() ?? 0,
        );
      }
      throw Exception(err['message'] ?? 'Failed to generate financial report');
    }
  }

  /// Update settlement status of a financial report (e.g. 'Settled', 'Rejected')
  Future<Map<String, dynamic>> updateReportStatus(int reportId, String status) async {
    final uri = Uri.parse('$baseUrl/api/school/financial-reports/$reportId/settle');
    final response = await http.put(
      uri,
      headers: _headers,
      body: json.encode({'status': status}),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = json.decode(response.body);
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      final err = json.decode(response.body);
      throw Exception(err['message'] ?? 'Failed to update financial report status');
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

  /// Get pending financial report badge stats (total pending + DB-persisted unseen count)
  Future<Map<String, int>> getPendingFinancialReportBadgeInfo() async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/financial-reports/pending-count');
      final response = await http.get(uri, headers: _headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final data = decoded['data'] ?? decoded;
        final pending = (data['pending_count'] as num?)?.toInt() ?? 0;
        final unread = (data['unread_count'] as num?)?.toInt() ?? pending;
        final maxId = (data['max_pending_id'] as num?)?.toInt() ?? 0;
        return {
          'pending_count': pending,
          'unread_count': unread,
          'max_pending_id': maxId,
        };
      }
    } catch (_) {}
    return {
      'pending_count': 0,
      'unread_count': 0,
      'max_pending_id': 0,
    };
  }

  /// Get count of pending financial reports awaiting settlement approval (School Admin only)
  Future<int> getPendingFinancialReportCount() async {
    final info = await getPendingFinancialReportBadgeInfo();
    return info['pending_count'] ?? 0;
  }

  /// Persist seen state on server so the Financial Report badge stays cleared across logout/login
  Future<void> markFinancialReportBadgeSeen({int? maxId}) async {
    try {
      final uri = Uri.parse('$baseUrl/api/school/badges/seen');
      await http.post(
        uri,
        headers: _headers,
        body: json.encode({
          'feature_key': 'financial_report',
          if (maxId != null && maxId > 0) 'max_id': maxId,
        }),
      );
    } catch (_) {}
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

