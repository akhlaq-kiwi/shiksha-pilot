import 'dart:convert';
import 'package:school_hub/services/http_service.dart' as http;

/// A user's standing account-deletion request, if they have one.
class DeletionRequest {
  final int id;
  final String status; // PENDING | COMPLETED | REJECTED | CANCELLED
  final String? reason;
  final String? resolutionNote;
  final String? createdAt;

  const DeletionRequest({
    required this.id,
    required this.status,
    this.reason,
    this.resolutionNote,
    this.createdAt,
  });

  bool get isPending => status == 'PENDING';

  factory DeletionRequest.fromJson(Map<String, dynamic> json) => DeletionRequest(
        id: (json['id'] as num).toInt(),
        status: (json['status'] ?? '').toString(),
        reason: json['reason'] as String?,
        resolutionNote: json['resolution_note'] as String?,
        createdAt: json['created_at'] as String?,
      );
}

/// Account-level operations that are not tied to a single school feature.
///
/// Deletion is request-and-erase: filing a request does not remove anything by
/// itself. A school administrator actions it, and only then is the login
/// identity scrubbed. See the /delete-account page on the marketing site for
/// the version of this written for users.
class AccountService {
  final String baseUrl;
  final String token;

  AccountService({required this.baseUrl, required this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  /// The user's latest request, or null if they have never filed one.
  Future<DeletionRequest?> getDeletionRequest() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/account/deletion-request'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Could not check your deletion request. Please try again.');
    }

    final data = json.decode(response.body)['data'];
    final request = (data is Map) ? data['request'] : null;
    if (request == null) return null;

    return DeletionRequest.fromJson(Map<String, dynamic>.from(request as Map));
  }

  /// File a request. Safe to call twice — the server returns the existing
  /// pending request rather than queuing a duplicate.
  Future<void> requestDeletion({String? reason}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/account/deletion-request'),
      headers: _headers,
      body: json.encode({'reason': reason ?? ''}),
    );

    if (response.statusCode != 200) {
      final message = _messageFrom(response.body);
      throw Exception(message ?? 'Could not submit your request. Please try again.');
    }
  }

  /// Withdraw a pending request.
  Future<void> cancelDeletion(int requestId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/account/deletion-request/$requestId'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      final message = _messageFrom(response.body);
      throw Exception(message ?? 'Could not withdraw your request. Please try again.');
    }
  }

  String? _messageFrom(String body) {
    try {
      final decoded = json.decode(body);
      final message = (decoded is Map) ? decoded['message'] : null;
      return (message is String && message.isNotEmpty) ? message : null;
    } catch (_) {
      return null;
    }
  }
}
