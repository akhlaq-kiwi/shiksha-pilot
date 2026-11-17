import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/widgets/verify_password_dialog.dart';
import '../config.dart';
import '../services/app_lock_helper.dart';
import '../services/auth_service.dart';
import '../services/http_service.dart' as http_svc;

class AppLockScreen extends StatefulWidget {
  final VoidCallback onUnlockSuccess;
  final String? userName;
  final String? userRole;
  final String? schoolName;
  final String? baseUrl;
  final String? token;
  final String? expectedPin;

  const AppLockScreen({
    super.key,
    required this.onUnlockSuccess,
    this.userName,
    this.userRole,
    this.schoolName,
    this.baseUrl,
    this.token,
    this.expectedPin,
  });

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> with SingleTickerProviderStateMixin {
  String _enteredPin = '';
  String _savedPin = '';
  String _resolvedRole = '';
  bool _isVerifying = false;
  bool _isSuccess = false;
  String? _errorMessage;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _loadSavedPin();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _loadSavedPin() async {
    final prefs = await SharedPreferences.getInstance();
    final role = widget.userRole ?? prefs.getString('user_role') ?? '';

    if (widget.expectedPin != null && widget.expectedPin!.isNotEmpty) {
      if (mounted) {
        setState(() {
          _savedPin = widget.expectedPin!;
          _resolvedRole = role;
        });
      }
      return;
    }
    final uid = prefs.getInt('user_id') ?? 0;
    final phone = (prefs.getString('user_phone') ?? '').trim();
    String pin = '';
    if (phone.isNotEmpty) {
      pin = prefs.getString('app_lock_pin_$phone') ?? '';
    }
    if (pin.isEmpty && uid > 0) {
      pin = prefs.getString('app_lock_pin_user_$uid') ?? '';
    }
    if (mounted) {
      setState(() {
        _savedPin = pin;
        _resolvedRole = role;
      });
    }
  }

  void _onDigitPressed(String digit) {
    if (_isVerifying || _isSuccess || _enteredPin.length >= 4) return;
    HapticFeedback.lightImpact();

    setState(() {
      _errorMessage = null;
      _enteredPin += digit;
    });

    if (_enteredPin.length == 4) {
      _validatePin();
    }
  }

  void _onBackspacePressed() {
    if (_isVerifying || _isSuccess || _enteredPin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() {
      _errorMessage = null;
      _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
    });
  }

  Future<void> _validatePin() async {
    setState(() {
      _isVerifying = true;
    });

    // Small delay to let the last dot fill visually
    await Future.delayed(const Duration(milliseconds: 180));

    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getInt('user_id') ?? 0;
    final phone = (prefs.getString('user_phone') ?? '').trim();
    final token = (widget.token != null && widget.token!.isNotEmpty)
        ? widget.token!
        : (prefs.getString('auth_token') ?? '');
    final baseUrl = (widget.baseUrl != null && widget.baseUrl!.isNotEmpty)
        ? widget.baseUrl!
        : resolveBaseUrlFrom(prefs);

    bool verified = false;
    String failMsg = 'Incorrect PIN. Please try again.';

    if (token.isNotEmpty && baseUrl.isNotEmpty) {
      try {
        verified = await AuthService(baseUrl: baseUrl)
            .verifyAppLockPin(token, _enteredPin)
            .timeout(const Duration(seconds: 10));
        if (verified) {
          await AppLockHelper.saveLocalDigestAfterVerify(
            prefs,
            userId: uid,
            phone: phone,
            pin: _enteredPin,
          );
        }
      } on InvalidAppLockPinException catch (e) {
        verified = false;
        failMsg = e.message;
      } catch (_) {
        // Offline / transient network failure: allow ONLY if this device
        // previously verified/set this PIN locally (never possible on new device or reinstall).
        if (AppLockHelper.hasLocalDigest(prefs, userId: uid, phone: phone)) {
          verified = AppLockHelper.verifyLocalDigestOffline(
            prefs,
            userId: uid,
            phone: phone,
            pin: _enteredPin,
          );
        } else if (_savedPin.isNotEmpty) {
          verified = (_enteredPin == _savedPin);
        } else {
          verified = false;
          failMsg = http_svc.kNetworkErrorMessage;
        }
      }
    } else if (AppLockHelper.hasLocalDigest(prefs, userId: uid, phone: phone)) {
      verified = AppLockHelper.verifyLocalDigestOffline(
        prefs,
        userId: uid,
        phone: phone,
        pin: _enteredPin,
      );
    } else if (_savedPin.isNotEmpty) {
      verified = (_enteredPin == _savedPin);
    } else {
      failMsg = 'Session unavailable. Please re-login.';
    }

    if (verified) {
      // Correct PIN: Trigger security loader animation
      HapticFeedback.mediumImpact();
      if (!mounted) return;

      setState(() {
        _isSuccess = true;
      });

      // Smooth security verification delay for psychological impact
      await Future.delayed(const Duration(milliseconds: 650));
      if (!mounted) return;

      widget.onUnlockSuccess();
    } else {
      // Incorrect PIN or offline on unverified device
      HapticFeedback.heavyImpact();
      if (!mounted) return;

      setState(() {
        _isVerifying = false;
        _errorMessage = failMsg;
      });

      // Brief red pause then clear dots
      await Future.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;

      setState(() {
        _enteredPin = '';
      });
    }
  }

  Future<void> _handleForgotPin() async {
    final prefs = await SharedPreferences.getInstance();
    final token = (widget.token != null && widget.token!.isNotEmpty)
        ? widget.token!
        : (prefs.getString('auth_token') ?? '');
    final baseUrl = (widget.baseUrl != null && widget.baseUrl!.isNotEmpty)
        ? widget.baseUrl!
        : resolveBaseUrlFrom(prefs);

    if (!mounted) return;
    if (token.isEmpty || baseUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session unavailable. Please re-login.')),
      );
      return;
    }

    // Show loading spinner while requesting OTP
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: Card(
          color: Color(0xFF1E293B),
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                  ),
                ),
                SizedBox(width: 16),
                Text(
                  'Sending verification OTP...',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final res = await AuthService(baseUrl: baseUrl).requestAppLockForgotPinOtp(token);
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop(); // dismiss loading dialog

      final maskedEmail = res['masked_email']?.toString() ?? 'your registered email';
      _showResetPinOtpModal(context, baseUrl: baseUrl, token: token, maskedEmail: maskedEmail);
    } on NoEmailRegisteredException {
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop(); // dismiss loading dialog
      _showNoEmailRegisteredDialog(context);
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context, rootNavigator: true).pop(); // dismiss loading dialog
      final msg = http_svc.formatErrorMessage(e, fallback: 'Failed to request OTP.');
      if (msg.toLowerCase().contains('email address is not registered') ||
          msg.toLowerCase().contains('no email registered')) {
        _showNoEmailRegisteredDialog(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  void _showNoEmailRegisteredDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF334155), width: 1.5),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF59E0B).withOpacity(0.15),
                  border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3), width: 1.5),
                ),
                child: const Icon(
                  Icons.mail_lock_rounded,
                  color: Color(0xFFFBBF24),
                  size: 30,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Email Not Registered',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Your email address is not registered. Please contact your school administrator to register your email address. You will be able to change your PIN after verifying your email.',
                style: TextStyle(
                  color: Color(0xFFCBD5E1),
                  fontSize: 13.5,
                  height: 1.45,
                  fontWeight: FontWeight.w400,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Understood!',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showResetPinOtpModal(
    BuildContext context, {
    required String baseUrl,
    required String token,
    required String maskedEmail,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ResetPinOtpBottomSheet(
        baseUrl: baseUrl,
        token: token,
        maskedEmail: maskedEmail,
        onPinResetSuccess: (newPin) => _handlePinResetSuccess(newPin),
      ),
    );
  }

  Future<void> _handlePinResetSuccess(String newPin) async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getInt('user_id') ?? 0;
    final phone = (prefs.getString('user_phone') ?? '').trim();

    await AppLockHelper.saveLocalDigestAfterVerify(
      prefs,
      userId: uid,
      phone: phone,
      pin: newPin,
    );

    if (mounted) {
      setState(() {
        _savedPin = newPin;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: const [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'PIN has been reset successfully. Unlocking...',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );

      widget.onUnlockSuccess();
    }
  }

  Future<void> _handlePasswordFallback() async {
    final prefs = await SharedPreferences.getInstance();
    final token = (widget.token != null && widget.token!.isNotEmpty)
        ? widget.token!
        : (prefs.getString('auth_token') ?? '');
    final baseUrl = (widget.baseUrl != null && widget.baseUrl!.isNotEmpty)
        ? widget.baseUrl!
        : resolveBaseUrlFrom(prefs);

    if (!mounted) return;
    if (token.isEmpty || baseUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session unavailable. Please re-login.')),
      );
      return;
    }

    String capturedPassword = '';
    final verified = await VerifyPasswordDialog.show(
      context,
      baseUrl: baseUrl,
      token: token,
      title: 'Reset Security PIN',
      actionButtonText: 'Verify & Unlock',
      onPasswordVerified: (pwd) {
        capturedPassword = pwd;
      },
    );

    if (verified == true) {
      try {
        await AuthService(baseUrl: baseUrl).disableAppLock(token, capturedPassword);
      } catch (e) {
        if (!mounted) return;
        final msg = http_svc.formatErrorMessage(e, fallback: 'Failed to reset App Lock.');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
        return;
      }

      final uid = prefs.getInt('user_id') ?? 0;
      final phone = (prefs.getString('user_phone') ?? '').trim();
      await AppLockHelper.clearAllForUser(prefs, userId: uid, phone: phone);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: const [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Identity verified. App Lock has been disabled.',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFFD97706),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
      widget.onUnlockSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    final roleUpper = (_resolvedRole.isNotEmpty ? _resolvedRole : (widget.userRole ?? '')).toUpperCase();
    final bool isSchoolAdmin = roleUpper == 'ADMIN' ||
        roleUpper == 'SCHOOL_ADMIN' ||
        (widget.userName != null && widget.userName!.toUpperCase().contains('ADMIN'));

    final String greetingText;
    if (isSchoolAdmin) {
      greetingText = 'Welcome, Admin';
    } else {
      final String displayName = widget.userName?.trim().isNotEmpty == true
          ? widget.userName!
          : 'Authorized User';
      greetingText = 'Welcome, $displayName';
    }

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1120),
      body: Stack(
        children: [
          // Ambient background glow effects
          Positioned(
            top: -60,
            left: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF0F766E).withOpacity(0.18),
              ),
            ),
          ),
          Positioned(
            bottom: 120,
            right: -60,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFD97706).withOpacity(0.12),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                const Spacer(flex: 1),

                // Animated Security Emblem (Psychological Vault Impact)
                ScaleTransition(
                  scale: _pulseAnimation,
                  child: Container(
                    width: 82,
                    height: 82,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const RadialGradient(
                        colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                      ),
                      border: Border.all(
                        color: _isSuccess
                            ? const Color(0xFF22C55E)
                            : (_errorMessage != null
                                ? const Color(0xFFEF4444)
                                : const Color(0xFFD97706)),
                        width: 2.2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_isSuccess
                                  ? const Color(0xFF22C55E)
                                  : const Color(0xFFD97706))
                              .withOpacity(0.3),
                          blurRadius: 24,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _isSuccess
                            ? Icons.lock_open_rounded
                            : Icons.shield_rounded,
                        size: 40,
                        color: _isSuccess
                            ? const Color(0xFF4ADE80)
                            : const Color(0xFFFBBF24),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),

                // Vault Title Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isSuccess ? const Color(0xFF22C55E) : const Color(0xFFF59E0B),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'SECURE VAULT ACTIVE',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2,
                          color: Color(0xFFCBD5E1),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // User Greeting
                Text(
                  greetingText,
                  style: const TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 0.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),

                const Text(
                  'Enter your 4-digit security PIN to unlock',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 28),

                // 4 PIN Dots Indicator
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (index) {
                    final isFilled = index < _enteredPin.length;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      margin: const EdgeInsets.symmetric(horizontal: 11),
                      width: isFilled ? 18 : 15,
                      height: isFilled ? 18 : 15,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isSuccess
                            ? const Color(0xFF22C55E)
                            : (_errorMessage != null
                                ? const Color(0xFFEF4444)
                                : (isFilled ? const Color(0xFFD97706) : Colors.transparent)),
                        border: Border.all(
                          color: _isSuccess
                              ? const Color(0xFF22C55E)
                              : (_errorMessage != null
                                  ? const Color(0xFFEF4444)
                                  : (isFilled ? const Color(0xFFFBBF24) : const Color(0xFF475569))),
                          width: 2,
                        ),
                        boxShadow: isFilled
                            ? [
                                BoxShadow(
                                  color: (_isSuccess
                                          ? const Color(0xFF22C55E)
                                          : const Color(0xFFD97706))
                                      .withOpacity(0.45),
                                  blurRadius: 10,
                                  spreadRadius: 2,
                                ),
                              ]
                            : null,
                      ),
                    );
                  }),
                ),

                // Status Message / Loader
                SizedBox(
                  height: 48,
                  child: Center(
                    child: _isSuccess
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF22C55E)),
                                ),
                              ),
                              SizedBox(width: 10),
                              Text(
                                'Access Granted. Decrypting session...',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF4ADE80),
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ],
                          )
                        : (_errorMessage != null
                            ? Text(
                                _errorMessage!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFF87171),
                                ),
                              )
                            : const SizedBox.shrink()),
                  ),
                ),

                const Spacer(flex: 1),

                // Numeric Keypad
                _buildKeypad(),

                const SizedBox(height: 16),

                // Forgot PIN
                TextButton(
                  onPressed: _isVerifying ? null : _handleForgotPin,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFFBBF24),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                  child: const Text(
                    'Forgot PIN?',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),

                const SizedBox(height: 12),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildKeypad() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('1'),
              _buildKeypadButton('2'),
              _buildKeypadButton('3'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('4'),
              _buildKeypadButton('5'),
              _buildKeypadButton('6'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('7'),
              _buildKeypadButton('8'),
              _buildKeypadButton('9'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const SizedBox(width: 72, height: 72),
              _buildKeypadButton('0'),
              InkWell(
                onTap: _onBackspacePressed,
                borderRadius: BorderRadius.circular(36),
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF1E293B).withOpacity(0.7),
                    border: Border.all(color: const Color(0xFF334155), width: 1.2),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.backspace_outlined,
                      size: 22,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKeypadButton(String digit) {
    return InkWell(
      onTap: () => _onDigitPressed(digit),
      borderRadius: BorderRadius.circular(36),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: const LinearGradient(
            colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: const Color(0xFF334155), width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Center(
          child: Text(
            digit,
            style: const TextStyle(
              fontSize: 25,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}

class _ResetPinOtpBottomSheet extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String maskedEmail;
  final ValueChanged<String> onPinResetSuccess;

  const _ResetPinOtpBottomSheet({
    required this.baseUrl,
    required this.token,
    required this.maskedEmail,
    required this.onPinResetSuccess,
  });

  @override
  State<_ResetPinOtpBottomSheet> createState() => _ResetPinOtpBottomSheetState();
}

class _ResetPinOtpBottomSheetState extends State<_ResetPinOtpBottomSheet> {
  final _otpController = TextEditingController();
  final _newPinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  bool _obscureNewPin = true;
  bool _obscureConfirmPin = true;
  bool _isSubmitting = false;
  bool _isResending = false;
  String? _errorMessage;
  int _resendCountdown = 60;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    setState(() => _resendCountdown = 60);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCountdown <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendCountdown = 0);
      } else {
        if (mounted) setState(() => _resendCountdown--);
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _otpController.dispose();
    _newPinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }

  Future<void> _handleResendOtp() async {
    if (_resendCountdown > 0 || _isResending || _isSubmitting) return;
    setState(() {
      _isResending = true;
      _errorMessage = null;
    });

    try {
      await AuthService(baseUrl: widget.baseUrl).requestAppLockForgotPinOtp(widget.token);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A new 4-digit verification code has been sent to your email.'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
      _startCountdown();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = http_svc.formatErrorMessage(e, fallback: 'Failed to resend OTP.');
      });
    } finally {
      if (mounted) {
        setState(() => _isResending = false);
      }
    }
  }

  Future<void> _handleSubmit() async {
    final otp = _otpController.text.trim();
    final newPin = _newPinController.text.trim();
    final confirmPin = _confirmPinController.text.trim();

    if (otp.length != 4 || int.tryParse(otp) == null) {
      setState(() => _errorMessage = 'Please enter the 4-digit OTP sent to your email.');
      return;
    }
    if (newPin.length != 4 || int.tryParse(newPin) == null) {
      setState(() => _errorMessage = 'New PIN must be exactly 4 digits.');
      return;
    }
    if (newPin != confirmPin) {
      setState(() => _errorMessage = 'New PIN and Confirm PIN do not match.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await AuthService(baseUrl: widget.baseUrl).resetAppLockPinWithOtp(
        widget.token,
        otp,
        newPin,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onPinResetSuccess(newPin);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = http_svc.formatErrorMessage(e, fallback: 'Failed to reset PIN.');
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: bottomInset > 0 ? bottomInset + 16 : 28,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: const Color(0xFF334155), width: 1.2),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF475569),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F766E).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF0F766E).withOpacity(0.4)),
                  ),
                  child: const Icon(Icons.lock_reset_rounded, color: Color(0xFF2DD4BF), size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Reset Security PIN',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Verify your email to create a new PIN',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF94A3B8),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF94A3B8)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Email Notice Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.mark_email_read_rounded, size: 18, color: Color(0xFFFBBF24)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(fontSize: 12, color: Color(0xFFCBD5E1), height: 1.3),
                        children: [
                          const TextSpan(text: '4-digit OTP sent to '),
                          TextSpan(
                            text: widget.maskedEmail,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFFBBF24)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF7F1D1D).withOpacity(0.5),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFEF4444)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Color(0xFFFCA5A5), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // OTP Input Field
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '4-DIGIT OTP CODE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                TextButton(
                  onPressed: _resendCountdown == 0 && !_isResending ? _handleResendOtp : null,
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                  child: Text(
                    _resendCountdown > 0 ? 'Resend in ${_resendCountdown}s' : 'Resend Code',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: _resendCountdown > 0 ? const Color(0xFF64748B) : const Color(0xFFFBBF24),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                letterSpacing: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF0F172A),
                hintText: '••••',
                hintStyle: const TextStyle(color: Color(0xFF475569), letterSpacing: 16),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // New PIN
            const Text(
              'NEW 4-DIGIT PIN',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _newPinController,
              keyboardType: TextInputType.number,
              obscureText: _obscureNewPin,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                letterSpacing: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF0F172A),
                hintText: '••••',
                hintStyle: const TextStyle(color: Color(0xFF475569), letterSpacing: 12),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureNewPin ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                    size: 18,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscureNewPin = !_obscureNewPin),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Confirm New PIN
            const Text(
              'CONFIRM NEW 4-DIGIT PIN',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _confirmPinController,
              keyboardType: TextInputType.number,
              obscureText: _obscureConfirmPin,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                letterSpacing: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF0F172A),
                hintText: '••••',
                hintStyle: const TextStyle(color: Color(0xFF475569), letterSpacing: 12),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirmPin ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                    size: 18,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscureConfirmPin = !_obscureConfirmPin),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF334155)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _handleSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFF78350F),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        'Verify & Reset PIN',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
