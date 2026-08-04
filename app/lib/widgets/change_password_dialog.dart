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
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return ChangePasswordDialog(baseUrl: baseUrl, token: token);
      },
    );
  }

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
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

  bool _validateClientSide() {
    _clearInlineErrors();
    bool isValid = true;

    final currentPass = _currentPasswordController.text;
    final newPass = _newPasswordController.text;
    final confirmPass = _confirmPasswordController.text;

    // 1. Current Password Validation
    if (currentPass.isEmpty) {
      _currentPasswordError = 'Current password is required.';
      isValid = false;
    }

    // 2. New Password Validation
    if (newPass.isEmpty) {
      _newPasswordError = 'New password is required.';
      isValid = false;
    } else if (newPass.length < 6) {
      _newPasswordError = 'At least 6 characters required.';
      isValid = false;
    } else {
      bool hasUppercase = newPass.contains(RegExp(r'[A-Z]'));
      bool hasDigits = newPass.contains(RegExp(r'[0-9]'));
      bool hasAlpha = newPass.contains(RegExp(r'[a-zA-Z]'));
      if (!hasUppercase || !hasDigits || !hasAlpha) {
        _newPasswordError = 'Must contain 1 uppercase, 1 digit & 1 letter.';
        isValid = false;
      } else if (currentPass.isNotEmpty && newPass == currentPass) {
        _newPasswordError = 'New password must be different from current password.';
        isValid = false;
      }
    }

    // 3. Confirm Password Validation
    if (confirmPass.isEmpty) {
      _confirmPasswordError = 'Confirm password is required.';
      isValid = false;
    } else if (confirmPass != newPass) {
      _confirmPasswordError = 'Passwords do not match.';
      isValid = false;
    }

    setState(() {});
    return isValid;
  }

  Future<void> _submitPasswordChange() async {
    if (!_validateClientSide()) return;

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
      await authService.changePassword(
        activeToken,
        _currentPasswordController.text,
        _newPasswordController.text,
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Password updated successfully!'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
          ),
        );
      }
    } on AuthValidationException catch (e) {
      if (mounted) {
        setState(() {
          _isUpdating = false;
          if (e.fieldErrors.containsKey('current_password')) {
            _currentPasswordError = e.fieldErrors['current_password'];
          }
          if (e.fieldErrors.containsKey('new_password')) {
            _newPasswordError = e.fieldErrors['new_password'];
          }
          if (e.fieldErrors.containsKey('confirm_password')) {
            _confirmPasswordError = e.fieldErrors['confirm_password'];
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
            _currentPasswordError = 'The current password you entered is incorrect.';
          } else if (rawMsg.toLowerCase().contains('different')) {
            _newPasswordError = 'New password must be different from current password.';
          } else {
            _generalError = rawMsg.isNotEmpty ? rawMsg : 'Failed to update password. Please try again.';
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text(
        'Change Password',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Current Password Field
            TextField(
              controller: _currentPasswordController,
              obscureText: _obscureCurrent,
              onChanged: (_) {
                if (_currentPasswordError != null) {
                  setState(() => _currentPasswordError = null);
                }
              },
              decoration: InputDecoration(
                labelText: 'Current Password',
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                errorText: _currentPasswordError,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureCurrent ? Icons.visibility_off : Icons.visibility,
                    color: Colors.grey.shade600,
                  ),
                  onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 2. New Password Field
            TextField(
              controller: _newPasswordController,
              obscureText: _obscureNew,
              onChanged: (_) {
                if (_newPasswordError != null) {
                  setState(() => _newPasswordError = null);
                }
              },
              decoration: InputDecoration(
                labelText: 'New Password',
                hintText: 'Min 6 chars, 1 uppercase, 1 digit',
                hintStyle: const TextStyle(fontSize: 11),
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                errorText: _newPasswordError,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureNew ? Icons.visibility_off : Icons.visibility,
                    color: Colors.grey.shade600,
                  ),
                  onPressed: () => setState(() => _obscureNew = !_obscureNew),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 3. Confirm Password Field
            TextField(
              controller: _confirmPasswordController,
              obscureText: _obscureConfirm,
              onChanged: (_) {
                if (_confirmPasswordError != null) {
                  setState(() => _confirmPasswordError = null);
                }
              },
              decoration: InputDecoration(
                labelText: 'Confirm Password',
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                errorText: _confirmPasswordError,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                    color: Colors.grey.shade600,
                  ),
                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
            ),

            if (_generalError != null && _generalError!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                _generalError!,
                style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isUpdating ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isUpdating ? null : _submitPasswordChange,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.indigo,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          ),
          child: _isUpdating
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Update'),
        ),
      ],
    );
  }
}
