import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as path;
import 'package:http/http.dart' as raw_http;
import 'package:school_hub/services/http_service.dart' as http;

class ExpenseService {
  final String baseUrl;
  final String token;

  ExpenseService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  /// Fetch expenses with optional month and search filtering
  Future<List<Map<String, dynamic>>> getExpenses({String? month, String? search}) async {
    final queryParams = <String, String>{};
    if (month != null && month.isNotEmpty && month != 'ALL') {
      queryParams['month'] = month;
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }

    final uri = Uri.parse('$baseUrl/api/school/expenses').replace(
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      final rawList = decoded['data'] ?? [];
      if (rawList is List) {
        return rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } else {
      try {
        final err = json.decode(response.body);
        throw Exception(err['message'] ?? 'Failed to load expenses');
      } catch (e) {
        if (e is Exception && !e.toString().contains('FormatException')) {
          rethrow;
        }
        throw Exception('Failed to load expenses (${response.statusCode})');
      }
    }
  }

  /// Create a new school operational expense
  Future<Map<String, dynamic>> createExpense({
    required String description,
    required double amount,
    required String expenseDate,
    String? category,
    String? paymentMethod,
    String? referenceNumber,
    String? billAttachmentPath,
  }) async {
    final uri = Uri.parse('$baseUrl/api/school/expenses');
    final payload = {
      'description': description.trim(),
      'amount': amount,
      'expense_date': expenseDate.trim(),
      'category': (category != null && category.trim().isNotEmpty) ? category.trim() : 'Other',
      'payment_method': (paymentMethod != null && paymentMethod.trim().isNotEmpty) ? paymentMethod.trim() : 'Cash',
      if (referenceNumber != null && referenceNumber.trim().isNotEmpty)
        'reference_number': referenceNumber.trim(),
      if (billAttachmentPath != null && billAttachmentPath.trim().isNotEmpty)
        'bill_attachment_path': billAttachmentPath.trim(),
    };

    final response = await http.post(
      uri,
      headers: _headers,
      body: json.encode(payload),
    );

    final decoded = json.decode(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return Map<String, dynamic>.from(decoded['data'] ?? decoded);
    } else {
      String msg = 'Failed to record expense.';
      if (decoded['message'] != null && decoded['message'].toString().isNotEmpty) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        if (errs is Map) {
          msg = errs.values.first.toString();
        } else {
          msg = errs.toString();
        }
      }
      throw Exception(msg);
    }
  }

  /// Delete an expense by ID
  Future<bool> deleteExpense(int expenseId) async {
    final uri = Uri.parse('$baseUrl/api/school/expenses/$expenseId');
    final response = await http.delete(uri, headers: _headers);

    if (response.statusCode == 200) {
      return true;
    } else {
      try {
        final decoded = json.decode(response.body);
        throw Exception(decoded['message'] ?? 'Failed to delete expense.');
      } catch (e) {
        if (e is Exception && !e.toString().contains('FormatException')) {
          rethrow;
        }
        throw Exception('Failed to delete expense.');
      }
    }
  }

  /// Upload bill attachment file
  Future<String> uploadBillAttachment(File file) async {
    final uri = Uri.parse('$baseUrl/api/school/upload');
    final request = raw_http.MultipartRequest('POST', uri);

    request.headers.addAll({
      'Authorization': 'Bearer $token',
    });
    request.fields['category'] = 'finance';

    final stream = raw_http.ByteStream(file.openRead());
    final length = await file.length();

    final multipartFile = raw_http.MultipartFile(
      'document',
      stream,
      length,
      filename: path.basename(file.path),
    );

    request.files.add(multipartFile);

    final streamedResponse = await request.send();
    final response = await raw_http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = json.decode(response.body);
      final resData = decoded['data'];
      if (resData is Map && resData['url'] != null) {
        return resData['url'].toString();
      } else if (decoded['url'] != null) {
        return decoded['url'].toString();
      }
      return '';
    } else {
      try {
        final decoded = json.decode(response.body);
        throw Exception(decoded['message'] ?? 'Failed to upload bill receipt.');
      } catch (e) {
        if (e is Exception && !e.toString().contains('FormatException')) {
          rethrow;
        }
        throw Exception('Failed to upload bill receipt.');
      }
    }
  }

  /// Get academic years to display current academic year if needed
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
}
