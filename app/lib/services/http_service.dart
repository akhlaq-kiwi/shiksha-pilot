import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:school_hub/main.dart';

export 'package:http/http.dart' hide get, post, put, delete;

const String kNetworkErrorMessage = 'Please check your internet connection and try again.';

class AppNetworkException implements SocketException {
  @override
  final String message;
  @override
  final OSError? osError;
  @override
  final InternetAddress? address;
  @override
  final int? port;
  final bool isTimeout;
  final Object? cause;

  const AppNetworkException(
    this.message, {
    this.osError,
    this.address,
    this.port,
    this.isTimeout = false,
    this.cause,
  });

  @override
  String toString() => message;
}

bool isNetworkError(Object? error) {
  if (error == null) return false;
  if (error is AppNetworkException ||
      error is SocketException ||
      error is http.ClientException ||
      error is HandshakeException ||
      error is HttpException ||
      error is TlsException ||
      error is TimeoutException) {
    return true;
  }

  final lower = error.toString().toLowerCase();
  return lower.contains('socketexception') ||
      lower.contains('clientexception') ||
      lower.contains('handshakeexception') ||
      lower.contains('httpexception') ||
      lower.contains('connection reset') ||
      lower.contains('connection closed') ||
      lower.contains('connection refused') ||
      lower.contains('connection aborted') ||
      lower.contains('broken pipe') ||
      lower.contains('failed host lookup') ||
      lower.contains('network is unreachable') ||
      lower.contains('software caused connection abort') ||
      lower.contains('timed out') ||
      lower.contains('connection timeout') ||
      lower.contains('future not completed') ||
      lower.contains('please check your internet connection and try again') ||
      lower.contains('connection failed on all available network interfaces');
}

String formatErrorMessage(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (isNetworkError(error)) {
    return kNetworkErrorMessage;
  }
  final cleaned = error
      .toString()
      .replaceFirst(RegExp(r'^[A-Za-z0-9_]*Exception:\s*'), '')
      .trim();
  return cleaned.isNotEmpty ? cleaned : fallback;
}

http.Client _sharedClient = http.Client();

bool _isTransientSocketError(Object error) {
  return error is http.ClientException ||
      error is SocketException ||
      error is HandshakeException ||
      error is HttpException ||
      error is TlsException;
}

const String _kUsbBaseUrl = 'http://127.0.0.1:8000';
const String _kWifiBaseUrl = 'http://10.144.32.71:8000';
const String _kWifiBaseUrlPrev = 'http://10.56.244.71:8000';
const String _kWifiBaseUrlOld = 'http://10.22.6.71:8000';

String? _inMemoryWorkingBase;

Future<void> _saveWorkingBaseUrl(String base) async {
  _inMemoryWorkingBase = base;
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', base);
  } catch (e) {
    debugPrint('Failed to save base_url to prefs: $e');
  }
}

Future<http.Response> _executeWithFallback(
  Uri originalUrl,
  Future<http.Response> Function(Uri targetUri) requestFn, {
  bool retryOnTransientFailure = false,
}) async {
  final origin = originalUrl.origin;
  final bool isProductionOrQa = origin.contains('shikshapilot.com');
  
  String? savedBase;
  try {
    final prefs = await SharedPreferences.getInstance();
    savedBase = prefs.getString('base_url');
  } catch (_) {}

  final List<String> candidateBaseUrls = isProductionOrQa
      ? [origin]
      : [
          _kUsbBaseUrl,
          if (_inMemoryWorkingBase != null && _inMemoryWorkingBase!.isNotEmpty && !_inMemoryWorkingBase!.contains('10.22.6.71')) _inMemoryWorkingBase!,
          _kWifiBaseUrl,
          if (savedBase != null && savedBase.isNotEmpty && !savedBase.contains('10.57.197.71') && !savedBase.contains('10.184.196.71') && !savedBase.contains('10.155.82.71') && !savedBase.contains('10.22.6.71')) savedBase,
          origin,
          _kWifiBaseUrlPrev,
          _kWifiBaseUrlOld,
        ];

  // Remove duplicates while preserving order
  final List<String> uniqueBases = [];
  for (final b in candidateBaseUrls) {
    if (!uniqueBases.contains(b) && b.startsWith('http')) {
      uniqueBases.add(b);
    }
  }

  Object? lastError;

  for (int baseIndex = 0; baseIndex < uniqueBases.length; baseIndex++) {
    final base = uniqueBases[baseIndex];
    final hasMoreCandidates = baseIndex < uniqueBases.length - 1;

    final pathAndQuery = originalUrl.hasQuery ? '${originalUrl.path}?${originalUrl.query}' : originalUrl.path;
    final targetUri = Uri.parse('$base$pathAndQuery');

    final isLoopback = (base.contains('127.0.0.1') || base.contains('localhost'));
    final isLocalLan = base.contains('10.') || base.contains('192.168.') || base.contains('172.');
    final isKnownWorking = (base == _inMemoryWorkingBase);

    final timeoutDuration = isLoopback
        ? const Duration(milliseconds: 1500)
        : isKnownWorking
            ? const Duration(seconds: 15)
            : isLocalLan
                ? const Duration(seconds: 4)
                : const Duration(seconds: 25);

    final bool allowRetryForBase = retryOnTransientFailure &&
        !isLoopback &&
        (isProductionOrQa || isKnownWorking || uniqueBases.length == 1);

    final int maxAttempts = allowRetryForBase ? 3 : 1;
    bool didRetryTimeout = false;
    bool didRetryGateway = false;

    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final response = await requestFn(targetUri).timeout(timeoutDuration);
        if (allowRetryForBase &&
            !didRetryGateway &&
            (response.statusCode == 502 || response.statusCode == 503 || response.statusCode == 504)) {
          didRetryGateway = true;
          debugPrint('HTTP ${response.statusCode} on $targetUri (attempt $attempt). Retrying...');
          await Future.delayed(const Duration(milliseconds: 350));
          continue;
        }

        _checkUnauthorized(response);

        // Save working base URL for subsequent calls
        _saveWorkingBaseUrl(base);
        return response;
      } catch (e) {
        lastError = e;
        debugPrint('HTTP request to $base failed (attempt $attempt/$maxAttempts): $e');

        if (!allowRetryForBase || attempt >= maxAttempts) {
          break;
        }

        final lower = e.toString().toLowerCase();
        if (lower.contains('connection refused') && hasMoreCandidates) {
          break;
        }

        if (e is TimeoutException) {
          if (didRetryTimeout || isLocalLan) {
            break;
          }
          didRetryTimeout = true;
          await Future.delayed(const Duration(milliseconds: 300));
          continue;
        }

        if (_isTransientSocketError(e) || isNetworkError(e)) {
          final delayMs = attempt == 1 ? 250 : 600;
          await Future.delayed(Duration(milliseconds: delayMs));
          continue;
        }

        break;
      }
    }
  }

  if (lastError != null && isNetworkError(lastError)) {
    throw AppNetworkException(
      kNetworkErrorMessage,
      isTimeout: lastError is TimeoutException,
      cause: lastError,
    );
  }

  if (lastError != null) {
    throw lastError;
  }

  throw const AppNetworkException(kNetworkErrorMessage);
}

Future<Map<String, String>> _prepareHeaders(Map<String, String>? headers) async {
  final merged = Map<String, String>.from(headers ?? {});
  try {
    final prefs = await SharedPreferences.getInstance();
    final dynamic ayId = prefs.get('selected_academic_year_id');
    if (ayId != null) {
      final strId = ayId.toString().trim();
      if (strId.isNotEmpty && !merged.containsKey('X-Academic-Year-Id')) {
        merged['X-Academic-Year-Id'] = strId;
      }
    }
  } catch (_) {}
  return merged;
}

Future<http.Response> get(Uri url, {Map<String, String>? headers}) async {
  final effectiveHeaders = await _prepareHeaders(headers);
  return _executeWithFallback(
    url,
    (targetUri) => _sharedClient.get(targetUri, headers: effectiveHeaders),
    retryOnTransientFailure: true,
  );
}

/// Direct GET without app-host rewriting (for S3/CDN/external attachment/logo URLs).
Future<http.Response> getRaw(
  Uri url, {
  Map<String, String>? headers,
  Duration timeout = const Duration(seconds: 25),
}) async {
  Object? lastError;
  bool didRetryTimeout = false;

  for (int attempt = 1; attempt <= 3; attempt++) {
    try {
      final response = await _sharedClient.get(url, headers: headers).timeout(timeout);
      if (attempt < 3 && (response.statusCode == 502 || response.statusCode == 503 || response.statusCode == 504)) {
        await Future.delayed(const Duration(milliseconds: 350));
        continue;
      }
      return response;
    } catch (e) {
      lastError = e;
      if (attempt >= 3) break;
      if (e is TimeoutException) {
        if (didRetryTimeout) break;
        didRetryTimeout = true;
        await Future.delayed(const Duration(milliseconds: 300));
        continue;
      }
      if (_isTransientSocketError(e) || isNetworkError(e)) {
        await Future.delayed(Duration(milliseconds: attempt == 1 ? 250 : 600));
        continue;
      }
      break;
    }
  }

  if (lastError != null && isNetworkError(lastError)) {
    throw AppNetworkException(
      kNetworkErrorMessage,
      isTimeout: lastError is TimeoutException,
      cause: lastError,
    );
  }

  throw lastError ?? const AppNetworkException(kNetworkErrorMessage);
}

Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  final effectiveHeaders = await _prepareHeaders(headers);
  return _executeWithFallback(
    url,
    (targetUri) => _sharedClient.post(targetUri, headers: effectiveHeaders, body: body, encoding: encoding as Encoding?),
  );
}

Future<http.Response> put(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  final effectiveHeaders = await _prepareHeaders(headers);
  return _executeWithFallback(
    url,
    (targetUri) => _sharedClient.put(targetUri, headers: effectiveHeaders, body: body, encoding: encoding as Encoding?),
  );
}

Future<http.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Object? encoding}) async {
  final effectiveHeaders = await _prepareHeaders(headers);
  return _executeWithFallback(
    url,
    (targetUri) => _sharedClient.delete(targetUri, headers: effectiveHeaders, body: body, encoding: encoding as Encoding?),
  );
}

Future<http.Response> sendMultipart(
  http.MultipartRequest request, {
  Duration timeout = const Duration(seconds: 60),
}) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final dynamic ayId = prefs.get('selected_academic_year_id');
    if (ayId != null) {
      final strId = ayId.toString().trim();
      if (strId.isNotEmpty && !request.headers.containsKey('X-Academic-Year-Id')) {
        request.headers['X-Academic-Year-Id'] = strId;
      }
    }
  } catch (_) {}

  try {
    final streamedResponse = await _sharedClient.send(request).timeout(timeout);
    final response = await http.Response.fromStream(streamedResponse).timeout(timeout);
    _checkUnauthorized(response);
    return response;
  } catch (e) {
    if (isNetworkError(e)) {
      throw AppNetworkException(
        kNetworkErrorMessage,
        isTimeout: e is TimeoutException,
        cause: e,
      );
    }
    rethrow;
  }
}

void checkUnauthorized(http.Response response) {
  _checkUnauthorized(response);
}

void _checkUnauthorized(http.Response response) async {
  if (response.statusCode == 401) {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_role');
    await prefs.remove('user_name');
    await prefs.remove('user_photo');
    await prefs.remove('selected_student_id');
    await prefs.remove('selected_student_name');
    await prefs.remove('selected_student_admission_no');
    
    String errorMsg = 'This account is Inactive';
    try {
      final bodyData = json.decode(response.body);
      if (bodyData is Map && bodyData['message'] != null && bodyData['message'].toString().isNotEmpty) {
        errorMsg = bodyData['message'].toString();
      }
    } catch (_) {}

    // Globally redirect to LoginScreen using MaterialApp navigatorKey
    MyApp.navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => LoginScreen(initialErrorMessage: errorMsg)),
      (route) => false,
    );
  }
}
