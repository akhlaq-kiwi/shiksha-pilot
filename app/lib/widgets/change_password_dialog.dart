import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:school_hub/services/auth_service.dart';

class ChangePasswordDialog extends StatefulWidget {
  final String baseUrl;
  final String? token;

  const ChangePasswordDialog({
    Key? key,
    required this.baseUrl,
    this.token,
  }) : super(key: key);

  static Future<void> show(BuildContext context, {required String baseUrl, String? token}) async {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return ChangePasswordDialog(baseUrl: baseUrl, token: token);
      },
    );
  }

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  bool _isUpdating = false;

  String? _currentPasswordError;
  String? _newPasswordError;
  String? _confirmPasswordError;
  String? _generalError;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _clearInlineErrors() {
    setState(() {
      _currentPasswordError = null;
      _newPasswordError = null;
      _confirmPasswordError = null;
      _generalError = null;
    });
  }

  Future<void> _submitPasswordChange() async {
    _clearInlineErrors();

    final currentPass = _currentPasswordController.text;
    final newPass = _newPasswordController.text;
    final confirmPass = _confirmPasswordController.text;

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1 – Empty Field Validation
    // ─────────────────────────────────────────────────────────────────────────
    bool hasEmpty = false;
    if (currentPass.isEmpty) {
      _currentPasswordError = 'Current password is required.';
      hasEmpty = true;
    }
    if (newPass.isEmpty) {
      _newPasswordError = 'New password is required.';
      hasEmpty = true;
    }
    if (confirmPass.isEmpty) {
      _confirmPasswordError = 'Confirm password is required.';
      hasEmpty = true;
    }

    if (hasEmpty) {
      setState(() {});
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Steps 2 - 6 Sequential Validation & Backend Sync
    // ─────────────────────────────────────────────────────────────────────────
    setState(() {
      _isUpdating = true;
    });

    try {
      String activeToken = widget.token ?? '';
      if (activeToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        activeToken = prefs.getString('auth_token') ?? '';
      }

      final authService = AuthService(baseUrl: widget.baseUrl);

      // Call API: Backend verifies Current Password against database FIRST (Step 2)
      await authService.changePassword(
        activeToken,
        currentPass,
        newPass,
      );

      // Step 3 – New Password Must Differ
      if (currentPass == newPass) {
        setState(() {
          _isUpdating = false;
          _newPasswordError = 'New password must be different from your current password.';
        });
        return;
      }

      // Step 4 – Password Policy
      if (newPass.length < 6) {
        setState(() {
          _isUpdating = false;
          _newPasswordError = 'At least 6 characters required.';
        });
        return;
      }
      bool hasUppercase = newPass.contains(RegExp(r'[A-Z]'));
      bool hasDigits = newPass.contains(RegExp(r'[0-9]'));
      bool hasAlpha = newPass.contains(RegExp(r'[a-zA-Z]'));
      if (!hasUppercase || !hasDigits || !hasAlpha) {
        setState(() {
          _isUpdating = false;
          _newPasswordError = 'Must contain 1 uppercase, 1 digit & 1 letter.';
        });
        return;
      }

      // Step 5 – Confirm Password Match
      if (confirmPass != newPass) {
        setState(() {
          _isUpdating = false;
          _confirmPasswordError = 'Passwords do not match.';
        });
        return;
      }

      // Step 6 – Password Updated Successfully
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Password updated successfully!'),
              ],
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Color(0xFF059669),
          ),
        );
      }
    } on AuthValidationException catch (e) {
      if (mounted) {
        setState(() {
          _isUpdating = false;
          // Step 2 Stop Check: If current password is incorrect, ONLY show current password error
          if (e.fieldErrors.containsKey('current_password')) {
            _currentPasswordError = e.fieldErrors['current_password'];
            _newPasswordError = null;
            _confirmPasswordError = null;
          } else {
            // Client checks for step 3, 4, 5 after current password verification
            if (currentPass == newPass) {
              _newPasswordError = 'New password must be different from your current password.';
            } else if (e.fieldErrors.containsKey('new_password')) {
              _newPasswordError = e.fieldErrors['new_password'];
            }
            if (confirmPass != newPass) {
              _confirmPasswordError = 'Passwords do not match.';
            } else if (e.fieldErrors.containsKey('confirm_password')) {
              _confirmPasswordError = e.fieldErrors['confirm_password'];
            }
          }
          if (!e.fieldErrors.containsKey('current_password') &&
              !e.fieldErrors.containsKey('new_password') &&
              !e.fieldErrors.containsKey('confirm_password')) {
            _generalError = e.message;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        final rawMsg = e.toString().replaceAll('Exception:', '').trim();
        setState(() {
          _isUpdating = false;
          if (rawMsg.toLowerCase().contains('current password')) {
            _currentPasswordError = 'Current password is incorrect.';
            _newPasswordError = null;
            _confirmPasswordError = null;
          } else if (rawMsg.toLowerCase().contains('different')) {
            _newPasswordError = 'New password must be different from your current password.';
          } else {
            _generalError = rawMsg.isNotEmpty ? rawMsg : 'Failed to update password. Please try again.';
          }
        });
      }
    }
  }

  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: Color(0xFF475569),
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hint,
    required bool obscure,
    required VoidCallback onToggle,
    String? errorText,
    required ValueChanged<String> onChanged,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      onChanged: onChanged,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: Color(0xFF0F172A),
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD97706), width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
        ),
        errorText: errorText,
        errorMaxLines: 3,
        errorStyle: const TextStyle(fontSize: 11.5, color: Color(0xFFEF4444), height: 1.2),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
            color: const Color(0xFF94A3B8),
            size: 20,
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottomInset),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Header: Icon, Title, Subtitle, Close Button
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.lock_reset_rounded,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Change Password',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            letterSpacing: 0.2,
                          ),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'Update your account password securely',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B), size: 22),
                    onPressed: () => Navigator.pop(context),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),

              const SizedBox(height: 18),

              // Policy / Tip Card
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.shield_outlined, size: 18, color: Color(0xFF0D9488)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Password must be at least 6 characters with 1 uppercase letter and 1 number.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF475569), height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 1. Current Password Label & Field
              _buildFieldLabel('CURRENT PASSWORD *'),
              const SizedBox(height: 6),
              _buildPasswordField(
                controller: _currentPasswordController,
                hint: 'Enter your current password',
                obscure: _obscureCurrent,
                onToggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
                errorText: _currentPasswordError,
                onChanged: (_) {
                  if (_currentPasswordError != null) setState(() => _currentPasswordError = null);
                },
              ),

              const SizedBox(height: 14),

              // 2. New Password Label & Field
              _buildFieldLabel('NEW PASSWORD *'),
              const SizedBox(height: 6),
              _buildPasswordField(
                controller: _newPasswordController,
                hint: 'Enter new secure password',
                obscure: _obscureNew,
                onToggle: () => setState(() => _obscureNew = !_obscureNew),
                errorText: _newPasswordError,
                onChanged: (_) {
                  if (_newPasswordError != null) setState(() => _newPasswordError = null);
                },
              ),

              const SizedBox(height: 14),

              // 3. Confirm Password Label & Field
              _buildFieldLabel('CONFIRM PASSWORD *'),
              const SizedBox(height: 6),
              _buildPasswordField(
                controller: _confirmPasswordController,
                hint: 'Re-enter new password to confirm',
                obscure: _obscureConfirm,
                onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
                errorText: _confirmPasswordError,
                onChanged: (_) {
                  if (_confirmPasswordError != null) setState(() => _confirmPasswordError = null);
                },
              ),

              if (_generalError != null && _generalError!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _generalError!,
                          style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 22),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    flex: 1,
                    child: SizedBox(
                      height: 48,
                      child: OutlinedButton(
                        onPressed: _isUpdating ? null : () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isUpdating ? null : _submitPasswordChange,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFD97706).withOpacity(0.6),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isUpdating
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.2),
                              )
                            : const Text(
                                'UPDATE PASSWORD',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
