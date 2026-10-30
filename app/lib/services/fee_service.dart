import 'dart:convert';
import 'dart:typed_data';
import 'package:school_hub/services/http_service.dart' as http;

class FeeService {
  final String baseUrl;
  final String token;

  FeeService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  /// Loads all data required to calculate student outstanding balances
  Future<Map<String, dynamic>> fetchPortalData() async {
    final results = await Future.wait([
      http.get(Uri.parse('$baseUrl/api/school/students'), headers: _headers),
      http.get(Uri.parse('$baseUrl/api/school/classes'), headers: _headers),
      http.get(Uri.parse('$baseUrl/api/school/fee-payments'), headers: _headers),
      http.get(Uri.parse('$baseUrl/api/school/class-fee-configurations'), headers: _headers),
      http.get(Uri.parse('$baseUrl/api/school/additional-fees/payments'), headers: _headers),
      http.get(Uri.parse('$baseUrl/api/school/stats'), headers: _headers),
    ]);

    final studentsRes = results[0];
    final classesRes = results[1];
    final feePaymentsRes = results[2];
    final feeConfigsRes = results[3];
    final additionalPaymentsRes = results[4];
    final statsRes = results[5];

    if (studentsRes.statusCode != 200) {
      final err = json.decode(studentsRes.body);
      throw Exception(err['message'] ?? 'Failed to load students');
    }

    final studentsData = json.decode(studentsRes.body)['data'] ?? [];
    final classesData = classesRes.statusCode == 200 ? (json.decode(classesRes.body)['data'] ?? []) : [];
    final feePaymentsData = feePaymentsRes.statusCode == 200 ? (json.decode(feePaymentsRes.body)['data'] ?? []) : [];
    final feeConfigsData = feeConfigsRes.statusCode == 200 ? (json.decode(feeConfigsRes.body)['data'] ?? []) : [];
    final additionalPaymentsData = additionalPaymentsRes.statusCode == 200 ? (json.decode(additionalPaymentsRes.body)['data'] ?? []) : [];
    final statsData = statsRes.statusCode == 200 ? (json.decode(statsRes.body)['data'] ?? {}) : <String, dynamic>{};

    return {
      'students': studentsData,
      'classes': classesData,
      'fee_payments': feePaymentsData,
      'class_fee_configs': feeConfigsData,
      'additional_payments': additionalPaymentsData,
      'stats': statsData,
    };
  }

  /// Fetch full student details with payments and class_fee_config
  Future<Map<String, dynamic>> fetchStudentDetail(int studentId) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$studentId');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return decoded['data'] ?? {};
    } else {
      final err = json.decode(res.body);
      throw Exception(err['message'] ?? 'Failed to load student details');
    }
  }

  /// Deposit tuition fee payment
  Future<Map<String, dynamic>> depositFeePayment(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl/api/school/fee-payments');
    final res = await http.post(uri, headers: _headers, body: json.encode(payload));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to deposit fee.';
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

  /// Collect additional fee payment (e.g. Previous Year Dues)
  Future<Map<String, dynamic>> collectAdditionalFeePayment(int paymentId, Map<String, dynamic> payload) async {
    final uri = Uri.parse('$baseUrl/api/school/additional-fees/payments/$paymentId/pay');
    final res = await http.post(uri, headers: _headers, body: json.encode(payload));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return decoded;
    } else {
      final msg = decoded['message'] ?? 'Failed to deposit additional fee.';
      throw Exception(msg.toString());
    }
  }

  /// Fetch collection history transactions with filters & pagination
  Future<Map<String, dynamic>> getCollectionHistory({
    String? period,
    String? depositBy,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (period != null && period.isNotEmpty && period != 'ALL TIME') {
      queryParams['period'] = period;
      queryParams['month'] = period;
    }
    if (depositBy != null && depositBy.isNotEmpty && depositBy != 'All Users') {
      queryParams['deposit_by'] = depositBy;
    }
    if (search != null && search.trim().isNotEmpty) {
      queryParams['search'] = search.trim();
    }

    final baseUri = Uri.parse('$baseUrl/api/school/collection-history');
    final uri = baseUri.replace(queryParameters: queryParams);
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return decoded['data'] ?? decoded;
    } else {
      final decoded = json.decode(res.body);
      throw Exception(decoded['message'] ?? 'Failed to load collection history');
    }
  }

  /// Download fee receipt PDF bytes
  Future<Uint8List> downloadFeeReceipt(int studentId, int paymentId, {bool isAdditional = false}) async {
    final uri = Uri.parse('$baseUrl/api/school/students/$studentId/fees/receipt?id=$paymentId&additional=${isAdditional ? 1 : 0}');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      return res.bodyBytes;
    } else {
      String msg = 'Failed to load receipt (${res.statusCode})';
      try {
        final decoded = json.decode(res.body);
        if (decoded['message'] != null) msg = decoded['message'].toString();
      } catch (_) {}
      throw Exception(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Additional Fees, Annual Fees & Transport Fees Management APIs
  // ---------------------------------------------------------------------------

  /// Fetch list of additional fee type definitions
  Future<List<dynamic>> getAdditionalFeeTypes() async {
    final uri = Uri.parse('$baseUrl/api/school/additional-fees/types');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return (decoded['data'] ?? decoded) as List<dynamic>;
    } else {
      final err = json.decode(res.body);
      throw Exception(err['message'] ?? 'Failed to load additional fee types');
    }
  }

  /// Create a new additional fee type
  Future<Map<String, dynamic>> createAdditionalFeeType(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/additional-fees/types');
    final res = await http.post(uri, headers: _headers, body: json.encode(data));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to create additional fee';
      if (decoded['message'] != null) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        msg = errs is Map ? errs.values.first.toString() : errs.toString();
      }
      throw Exception(msg);
    }
  }

  /// Update an existing additional fee type
  Future<Map<String, dynamic>> updateAdditionalFeeType(int id, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/additional-fees/types/$id');
    final res = await http.put(uri, headers: _headers, body: json.encode(data));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return decoded;
    } else {
      String msg = 'Failed to update additional fee';
      if (decoded['message'] != null) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        msg = errs is Map ? errs.values.first.toString() : errs.toString();
      }
      throw Exception(msg);
    }
  }

  /// Delete an additional fee type
  Future<void> deleteAdditionalFeeType(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/additional-fees/types/$id');
    final res = await http.delete(uri, headers: _headers);
    if (res.statusCode != 200) {
      final decoded = json.decode(res.body);
      throw Exception(decoded['message'] ?? 'Failed to delete additional fee');
    }
  }

  /// Create Annual Fee
  Future<Map<String, dynamic>> createAnnualFee(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/annual-fees');
    final res = await http.post(uri, headers: _headers, body: json.encode(data));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to create annual fee';
      if (decoded['message'] != null) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        msg = errs is Map ? errs.values.first.toString() : errs.toString();
      }
      throw Exception(msg);
    }
  }

  /// Fetch list of transport fees
  Future<List<dynamic>> getTransportFees({String? status}) async {
    var url = '$baseUrl/api/school/transport-fees';
    if (status != null && status.isNotEmpty && status != 'All') {
      url += '?status=$status';
    }
    final uri = Uri.parse(url);
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return (decoded['data'] ?? decoded) as List<dynamic>;
    } else {
      final err = json.decode(res.body);
      throw Exception(err['message'] ?? 'Failed to load transport fees');
    }
  }

  /// Assign a new transport fee
  Future<Map<String, dynamic>> assignTransportFee(Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/transport-fees');
    final res = await http.post(uri, headers: _headers, body: json.encode(data));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200 || res.statusCode == 201) {
      return decoded;
    } else {
      String msg = 'Failed to assign transport fee';
      if (decoded['message'] != null) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        msg = errs is Map ? errs.values.first.toString() : errs.toString();
      }
      throw Exception(msg);
    }
  }

  /// Update an existing transport fee assignment
  Future<Map<String, dynamic>> updateTransportFee(int id, Map<String, dynamic> data) async {
    final uri = Uri.parse('$baseUrl/api/school/transport-fees/$id');
    final res = await http.put(uri, headers: _headers, body: json.encode(data));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return decoded;
    } else {
      String msg = 'Failed to update transport fee';
      if (decoded['message'] != null) {
        msg = decoded['message'].toString();
      } else if (decoded['errors'] != null) {
        final errs = decoded['errors'];
        msg = errs is Map ? errs.values.first.toString() : errs.toString();
      }
      throw Exception(msg);
    }
  }

  /// Delete transport fee assignment
  Future<void> deleteTransportFee(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/transport-fees/$id');
    final res = await http.delete(uri, headers: _headers);
    if (res.statusCode != 200) {
      final decoded = json.decode(res.body);
      throw Exception(decoded['message'] ?? 'Failed to delete transport fee');
    }
  }

  /// Toggle transport fee status (Active <-> Inactive)
  Future<Map<String, dynamic>> toggleTransportFeeStatus(int id, {required String status}) async {
    final uri = Uri.parse('$baseUrl/api/school/transport-fees/$id/status');
    final res = await http.put(uri, headers: _headers, body: json.encode({'status': status}));
    final decoded = json.decode(res.body);
    if (res.statusCode == 200) {
      return decoded;
    } else {
      final decoded = json.decode(res.body);
      throw Exception(decoded['message'] ?? 'Failed to update transport status');
    }
  }

  /// Fetch classes
  Future<List<dynamic>> getClasses() async {
    final uri = Uri.parse('$baseUrl/api/school/classes');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return (decoded['data'] ?? []) as List<dynamic>;
    }
    return [];
  }

  /// Fetch students with optional limit
  Future<List<dynamic>> getStudents({int limit = 1000}) async {
    final uri = Uri.parse('$baseUrl/api/school/students?limit=$limit');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return (decoded['data'] ?? []) as List<dynamic>;
    }
    return [];
  }

  /// Fetch academic years
  Future<List<dynamic>> getAcademicYears() async {
    final uri = Uri.parse('$baseUrl/api/school/academic-years');
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode == 200) {
      final decoded = json.decode(res.body);
      return (decoded['data'] ?? []) as List<dynamic>;
    }
    return [];
  }
}

