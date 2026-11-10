import 'dart:convert';
import 'dart:typed_data';
import 'package:shared_preferences/shared_preferences.dart';

/// Manages account-level App Lock synchronization state and local offline
/// salted SHA-256 verifiers without storing plaintext PINs on the device.
class AppLockHelper {
  AppLockHelper._();

  static const _k = <int>[
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  static int _rotr(int x, int n) => ((x & 0xffffffff) >>> n) | ((x << (32 - n)) & 0xffffffff);

  static String sha256Hex(String input) {
    final bytes = utf8.encode(input);
    final bitLen = bytes.length * 8;
    final padLen = ((bytes.length + 9 + 63) ~/ 64) * 64;
    final padded = Uint8List(padLen);
    padded.setRange(0, bytes.length, bytes);
    padded[bytes.length] = 0x80;
    final bd = ByteData.sublistView(padded);
    bd.setUint32(padLen - 8, (bitLen ~/ 0x100000000) & 0xffffffff, Endian.big);
    bd.setUint32(padLen - 4, bitLen & 0xffffffff, Endian.big);

    var h0 = 0x6a09e667;
    var h1 = 0xbb67ae85;
    var h2 = 0x3c6ef372;
    var h3 = 0xa54ff53a;
    var h4 = 0x510e527f;
    var h5 = 0x9b05688c;
    var h6 = 0x1f83d9ab;
    var h7 = 0x5be0cd19;

    final w = Uint32List(64);
    for (var offset = 0; offset < padLen; offset += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = bd.getUint32(offset + i * 4, Endian.big);
      }
      for (var i = 16; i < 64; i++) {
        final s0 = _rotr(w[i - 15], 7) ^ _rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        final s1 = _rotr(w[i - 2], 17) ^ _rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & 0xffffffff;
      }

      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var i = 0; i < 64; i++) {
        final s1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25);
        final ch = (e & f) ^ ((~e & 0xffffffff) & g);
        final temp1 = (h + s1 + ch + _k[i] + w[i]) & 0xffffffff;
        final s0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22);
        final maj = (a & b) ^ (a & c) ^ (b & c);
        final temp2 = (s0 + maj) & 0xffffffff;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) & 0xffffffff;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) & 0xffffffff;
      }

      h0 = (h0 + a) & 0xffffffff;
      h1 = (h1 + b) & 0xffffffff;
      h2 = (h2 + c) & 0xffffffff;
      h3 = (h3 + d) & 0xffffffff;
      h4 = (h4 + e) & 0xffffffff;
      h5 = (h5 + f) & 0xffffffff;
      h6 = (h6 + g) & 0xffffffff;
      h7 = (h7 + h) & 0xffffffff;
    }

    String hex32(int v) => (v & 0xffffffff).toRadixString(16).padLeft(8, '0');
    return '${hex32(h0)}${hex32(h1)}${hex32(h2)}${hex32(h3)}'
        '${hex32(h4)}${hex32(h5)}${hex32(h6)}${hex32(h7)}';
  }

  static String _userDigest(int userId, String pin) =>
      sha256Hex('shiksha_pin_v1:uid:$userId:$pin');

  static String _phoneDigest(String phone, String pin) =>
      sha256Hex('shiksha_pin_v1:ph:${phone.trim()}:$pin');

  static Future<void> removeLegacyPlaintextKeys(
    SharedPreferences prefs, {
    int userId = 0,
    String phone = '',
  }) async {
    await prefs.remove('is_app_lock_enabled');
    await prefs.remove('app_lock_pin');
    final cleanPhone = phone.trim();
    if (cleanPhone.isNotEmpty) {
      await prefs.remove('app_lock_pin_$cleanPhone');
    }
    if (userId > 0) {
      await prefs.remove('app_lock_pin_user_$userId');
    }
  }

  /// Synchronize local App Lock flag with authoritative backend state.
  /// Never fabricates a local digest when enabling on a new device/reinstall.
  static Future<void> syncFromServerState(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
    required bool enabled,
  }) async {
    final cleanPhone = phone.trim();
    await removeLegacyPlaintextKeys(prefs, userId: userId, phone: cleanPhone);

    if (userId > 0) {
      await prefs.setBool('app_lock_enabled_user_$userId', enabled);
      if (!enabled) {
        await prefs.remove('app_lock_digest_user_$userId');
      }
    }
    if (cleanPhone.isNotEmpty) {
      await prefs.setBool('app_lock_enabled_$cleanPhone', enabled);
      if (!enabled) {
        await prefs.remove('app_lock_digest_$cleanPhone');
      }
    }
  }

  /// Store salted local SHA-256 verifier strictly AFTER user proves knowledge
  /// of the PIN via setup or online verification. Allows safe offline cold start
  /// on already-verified devices without ever weakening new devices/reinstalls.
  static Future<void> saveLocalDigestAfterVerify(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
    required String pin,
  }) async {
    final cleanPhone = phone.trim();
    await removeLegacyPlaintextKeys(prefs, userId: userId, phone: cleanPhone);

    if (userId > 0) {
      await prefs.setBool('app_lock_enabled_user_$userId', true);
      await prefs.setString('app_lock_digest_user_$userId', _userDigest(userId, pin));
    }
    if (cleanPhone.isNotEmpty) {
      await prefs.setBool('app_lock_enabled_$cleanPhone', true);
      await prefs.setString('app_lock_digest_$cleanPhone', _phoneDigest(cleanPhone, pin));
    }
  }

  static bool isEnabledLocally(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
  }) {
    if (userId > 0 && prefs.containsKey('app_lock_enabled_user_$userId')) {
      return prefs.getBool('app_lock_enabled_user_$userId') == true;
    }
    final cleanPhone = phone.trim();
    if (cleanPhone.isNotEmpty) {
      return prefs.getBool('app_lock_enabled_$cleanPhone') == true;
    }
    return false;
  }

  static bool hasLocalDigest(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
  }) {
    if (userId > 0 && (prefs.getString('app_lock_digest_user_$userId') ?? '').isNotEmpty) {
      return true;
    }
    final cleanPhone = phone.trim();
    if (cleanPhone.isNotEmpty && (prefs.getString('app_lock_digest_$cleanPhone') ?? '').isNotEmpty) {
      return true;
    }
    return false;
  }

  static bool verifyLocalDigestOffline(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
    required String pin,
  }) {
    final cleanPhone = phone.trim();
    if (userId > 0) {
      final stored = prefs.getString('app_lock_digest_user_$userId') ?? '';
      if (stored.isNotEmpty) {
        return stored == _userDigest(userId, pin);
      }
    }
    if (cleanPhone.isNotEmpty) {
      final stored = prefs.getString('app_lock_digest_$cleanPhone') ?? '';
      if (stored.isNotEmpty) {
        return stored == _phoneDigest(cleanPhone, pin);
      }
    }
    return false;
  }

  static Future<void> clearAllForUser(
    SharedPreferences prefs, {
    required int userId,
    required String phone,
  }) async {
    await syncFromServerState(prefs, userId: userId, phone: phone, enabled: false);
  }
}

