import 'package:flutter/material.dart';

/// Shows an attractive popup dialog informing the user that operational expenses
/// can only be recorded and managed during the active academic year.
/// Styled according to the app's current color theme with an 'Understood!' button.
void showInactiveExpenseDialog(
  BuildContext context, {
  String? sessionName,
  String? sessionStatus,
}) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final statusText = (sessionStatus != null && sessionStatus.trim().isNotEmpty)
      ? sessionStatus.trim()
      : 'Inactive';
  final hasSessionName = sessionName != null && sessionName.trim().isNotEmpty;

  showDialog(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFFAF9F6),
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF78350F).withOpacity(0.35)
                    : const Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(
                  Icons.receipt_long_rounded,
                  size: 30,
                  color: Color(0xFFD97706),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Active Academic Year Required',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.2,
                color: isDark ? Colors.white : const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              hasSessionName
                  ? 'Expenses can only be recorded and managed in the active academic year.\n\nThe selected session "$sessionName" is currently in $statusText mode. Please switch to the active academic year to access operational expenses.'
                  : 'Expenses can only be recorded and managed in the active academic year.\n\nPlease switch to the active academic year to access operational expenses.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF4B5563),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text(
                  'Understood!',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
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
