import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../services/app_lock_helper.dart';
import '../services/auth_service.dart';
import '../services/http_service.dart' as http_svc;

class SetAppLockPinScreen extends StatefulWidget {
  final String? baseUrl;
  final String? token;
  final String verifiedPassword;

  const SetAppLockPinScreen({
    super.key,
    this.baseUrl,
    this.token,
    this.verifiedPassword = '',
  });

  @override
  State<SetAppLockPinScreen> createState() => _SetAppLockPinScreenState();
}

class _SetAppLockPinScreenState extends State<SetAppLockPinScreen> {
  int _step = 1; // 1 = Enter PIN, 2 = Confirm PIN
  String _firstPin = '';
  String _currentInput = '';
  String? _errorMessage;
  bool _isSaving = false;

  void _onDigitPressed(String digit) {
    if (_isSaving || _currentInput.length >= 4) return;
    HapticFeedback.lightImpact();

    setState(() {
      _errorMessage = null;
      _currentInput += digit;
    });

    if (_currentInput.length == 4) {
      _processPin();
    }
  }

  void _onBackspacePressed() {
    if (_isSaving || _currentInput.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() {
      _errorMessage = null;
      _currentInput = _currentInput.substring(0, _currentInput.length - 1);
    });
  }

  Future<void> _processPin() async {
    if (_step == 1) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      setState(() {
        _firstPin = _currentInput;
        _currentInput = '';
        _step = 2;
        _errorMessage = null;
      });
    } else {
      if (_currentInput == _firstPin) {
        setState(() {
          _isSaving = true;
          _errorMessage = null;
        });

        try {
          final prefs = await SharedPreferences.getInstance();
          final userId = prefs.getInt('user_id') ?? 0;
          final phone = (prefs.getString('user_phone') ?? '').trim();
          final token = (widget.token != null && widget.token!.isNotEmpty)
              ? widget.token!
              : (prefs.getString('auth_token') ?? '');
          final baseUrl = (widget.baseUrl != null && widget.baseUrl!.isNotEmpty)
              ? widget.baseUrl!
              : resolveBaseUrlFrom(prefs);

          if (token.isEmpty || baseUrl.isEmpty || widget.verifiedPassword.isEmpty) {
            throw Exception('Session verification expired. Please try again.');
          }

          await AuthService(baseUrl: baseUrl).enableAppLock(
            token,
            _currentInput,
            widget.verifiedPassword,
          );

          await AppLockHelper.saveLocalDigestAfterVerify(
            prefs,
            userId: userId,
            phone: phone,
            pin: _currentInput,
          );

          HapticFeedback.mediumImpact();
          if (!mounted) return;
          Navigator.pop(context, true);
        } catch (e) {
          HapticFeedback.heavyImpact();
          if (!mounted) return;
          setState(() {
            _isSaving = false;
            _errorMessage = http_svc.formatErrorMessage(
              e,
              fallback: 'Failed to save App Lock PIN.',
            );
            _currentInput = '';
            _step = 1;
            _firstPin = '';
          });
        }
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _errorMessage = 'PINs do not match. Please try again.';
          _currentInput = '';
          _step = 1;
          _firstPin = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFAF8F5),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? Colors.white : const Color(0xFF0F172A),
            size: 18,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'SET APP LOCK PIN',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
            color: isDark ? Colors.white : const Color(0xFF0F172A),
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(flex: 1),

            // Security Icon Badge
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFFEF3C7),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD97706).withOpacity(0.15),
                    blurRadius: 18,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.lock_rounded,
                size: 34,
                color: Color(0xFFD97706),
              ),
            ),
            const SizedBox(height: 20),

            // Step Title
            Text(
              _step == 1 ? 'Create 4-Digit Security PIN' : 'Confirm Security PIN',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),

            // Step Subtitle
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _step == 1
                    ? 'Enter 4 positive digits to lock and secure your application.'
                    : 'Re-enter the 4-digit PIN to confirm your lock setup.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.grey.shade400 : const Color(0xFF64748B),
                ),
              ),
            ),
            const SizedBox(height: 32),

            // 4 PIN Dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                final isFilled = index < _currentInput.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  width: isFilled ? 18 : 16,
                  height: isFilled ? 18 : 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isFilled
                        ? const Color(0xFFD97706)
                        : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                    border: Border.all(
                      color: isFilled
                          ? const Color(0xFFD97706)
                          : (isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1)),
                      width: 1.5,
                    ),
                    boxShadow: isFilled
                        ? [
                            BoxShadow(
                              color: const Color(0xFFD97706).withOpacity(0.35),
                              blurRadius: 8,
                            ),
                          ]
                        : null,
                  ),
                );
              }),
            ),

            // Error / Saving indicator
            SizedBox(
              height: 40,
              child: _isSaving
                  ? Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFD97706)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Enabling account security...',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: isDark ? Colors.grey.shade300 : const Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    )
                  : (_errorMessage != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ),
                        )
                      : const SizedBox.shrink()),
            ),

            const Spacer(flex: 1),

            // Numeric Dial Pad (Digits 0-9 only, positive numbers)
            _buildKeypad(isDark),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildKeypad(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 36),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('1', isDark),
              _buildKeypadButton('2', isDark),
              _buildKeypadButton('3', isDark),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('4', isDark),
              _buildKeypadButton('5', isDark),
              _buildKeypadButton('6', isDark),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildKeypadButton('7', isDark),
              _buildKeypadButton('8', isDark),
              _buildKeypadButton('9', isDark),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Empty placeholder for balance
              const SizedBox(width: 70, height: 70),
              _buildKeypadButton('0', isDark),
              // Backspace
              InkWell(
                onTap: _onBackspacePressed,
                borderRadius: BorderRadius.circular(35),
                child: SizedBox(
                  width: 70,
                  height: 70,
                  child: Center(
                    child: Icon(
                      Icons.backspace_outlined,
                      size: 24,
                      color: isDark ? Colors.white70 : const Color(0xFF475569),
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

  Widget _buildKeypadButton(String digit, bool isDark) {
    return InkWell(
      onTap: () => _onDigitPressed(digit),
      borderRadius: BorderRadius.circular(35),
      child: Container(
        width: 70,
        height: 70,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          border: Border.all(
            color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Center(
          child: Text(
            digit,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
        ),
      ),
    );
  }
}

