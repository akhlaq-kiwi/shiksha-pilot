import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as path;
import '../models/leave_request.dart';

class LeaveService {
  final String baseUrl;
  final String token;

  LeaveService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  Future<List<LeaveRequest>> getLeaveRequests({String? viewType, int? studentId}) async {
    final queryParams = <String, String>{};
    if (viewType != null) queryParams['view_type'] = viewType;
    if (studentId != null) queryParams['student_id'] = studentId.toString();

    final uri = Uri.parse('$baseUrl/api/school/leave-requests').replace(queryParameters: queryParams);
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body)['data'] ?? [];
      return data.map((json) => LeaveRequest.fromJson(json)).toList();
    } else {
      _handleErrorResponse(response, 'Failed to load leave history.');
      throw Exception('Failed to load leave history.');
    }
  }

  Future<LeaveRequest> applyLeaveRequest({
    required String leaveType,
    required String fromDate,
    required String toDate,
    required String reason,
    int? studentId,
    File? attachment,
  }) async {
    String? attachmentPath;

    if (attachment != null) {
      attachmentPath = await _uploadAttachment(attachment);
    }

    final body = {
      'leave_type': leaveType,
      'from_date': fromDate,
      'to_date': toDate,
      'reason': reason,
      if (studentId != null) 'student_id': studentId,
      if (attachmentPath != null) 'attachment_path': attachmentPath,
    };

    final uri = Uri.parse('$baseUrl/api/school/leave-requests');
    final response = await http.post(uri, headers: _headers, body: json.encode(body));

    if (response.statusCode == 200 || response.statusCode == 201) {
      return LeaveRequest.fromJson(json.decode(response.body)['data']);
    } else {
      _handleErrorResponse(response, 'Failed to submit leave request.');
      throw Exception('Failed to submit leave request.');
    }
  }

  Future<void> cancelLeaveRequest(int id) async {
    final uri = Uri.parse('$baseUrl/api/school/leave-requests/$id/cancel');
    final response = await http.put(uri, headers: _headers);

    if (response.statusCode != 200) {
      _handleErrorResponse(response, 'Failed to cancel leave request.');
    }
  }

  Future<String> _uploadAttachment(File file) async {
    final uri = Uri.parse('$baseUrl/api/school/leave-requests/upload');
    final request = http.MultipartRequest('POST', uri);
    
    request.headers.addAll({
      'Authorization': 'Bearer $token',
    });

    final stream = http.ByteStream(file.openRead());
    final length = await file.length();
    
    final multipartFile = http.MultipartFile(
      'file',
      stream,
      length,
      filename: path.basename(file.path),
    );

    request.files.add(multipartFile);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      final resData = json.decode(response.body)['data'];
      return resData['url'];
    } else {
      _handleErrorResponse(response, 'Attachment upload failed.');
      throw Exception('Attachment upload failed.');
    }
  }

  Future<List<dynamic>> getChildren() async {
    final uri = Uri.parse('$baseUrl/api/parent/children');
    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      return json.decode(response.body)['data'] ?? [];
    } else {
      _handleErrorResponse(response, 'Failed to load children.');
      throw Exception('Failed to load children.');
    }
  }

  void _handleErrorResponse(http.Response response, String defaultMsg) {
    try {
      final decoded = json.decode(response.body);
      final msg = decoded['message'] ?? defaultMsg;
      final errors = decoded['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final details = errors.values.join(', ');
        throw Exception('$msg: $details');
      }
      throw Exception(msg);
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception(defaultMsg);
    }
  }
}
