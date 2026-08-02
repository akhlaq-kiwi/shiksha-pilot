import 'package:flutter/material.dart';

/// Shared colour tokens for the Shiksha Pilot mobile app.
///
/// These values are the single Dart-side source of truth for the same
/// "Scholar" palette defined in `frontend/src/index.css`. The values must stay
/// numerically identical to their web counterparts — this file exists because
/// the mobile app previously had no shared theme constants at all, so each of
/// the ~11 screens with hardcoded colours drifted independently from the web
/// app and from each other (e.g. `Color(0xFF059669)` repeated ad hoc rather
/// than referenced from one place).
///
/// When the web palette in index.css changes, mirror the change here.
class AppColors {
  AppColors._();

  // ---- Brand: Scholar Indigo (web: --brand-*) ------------------------------
  static const brand50 = Color(0xFFEEF2FF);
  static const brand100 = Color(0xFFE0E7FF);
  static const brand200 = Color(0xFFC7D2FE);
  static const brand300 = Color(0xFFA5B4FC);
  static const brand400 = Color(0xFF818CF8);
  static const brand500 = Color(0xFF6366F1);
  static const brand600 = Color(0xFF4F46E5); // primary — matches --color-primary
  static const brand700 = Color(0xFF4338CA);
  static const brand800 = Color(0xFF3730A3);
  static const brand900 = Color(0xFF312E81);

  static const primary = brand600;
  static const primaryHover = brand700;

  // ---- Semantic ramps (web: --success-*, --danger-*, --warning-*, --info-*)
  static const success50 = Color(0xFFECFDF5);
  static const success500 = Color(0xFF10B981);
  static const success600 = Color(0xFF059669);
  static const success700 = Color(0xFF047857);

  static const danger50 = Color(0xFFFFF1F2);
  static const danger500 = Color(0xFFF43F5E);
  static const danger600 = Color(0xFFE11D48);
  static const danger700 = Color(0xFFBE123C);

  static const warning50 = Color(0xFFFFFBEB);
  static const warning500 = Color(0xFFF59E0B);
  static const warning600 = Color(0xFFD97706);
  static const warning700 = Color(0xFFB45309);

  static const info50 = Color(0xFFF0F9FF);
  static const info500 = Color(0xFF0EA5E9);
  static const info600 = Color(0xFF0284C7);
  static const info700 = Color(0xFF0369A1);

  // ---- Domain accents (web: --academics-*, --finance-*) --------------------
  static const academics500 = Color(0xFF14B8A6);
  static const academics600 = Color(0xFF0D9488);
  static const academics700 = Color(0xFF0F766E);

  static const finance500 = Color(0xFF8B5CF6);
  static const finance600 = Color(0xFF7C3AED);
  static const finance700 = Color(0xFF6D28D9);

  // ---- Surfaces & text (web: --surface-*, --text-*) -------------------------
  static const surfaceCanvas = Color(0xFFFAF9F6); // Soft Stone app background
  static const surfaceSunken = Color(0xFFF4F3F1);
  static const surfaceRaised = Color(0xFFFFFFFF);

  static const borderSubtle = Color(0xFFEBEAE8);
  static const borderStrong = Color(0xFFD6D4D0);

  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF4B5563);
  static const textMuted = Color(0xFF6B7280);

  // ---- Dark mode -------------------------------------------------------------
  static const darkSurfaceCanvas = Color(0xFF0F172A);
  static const darkSurfaceSunken = Color(0xFF0B1120);
  static const darkSurfaceRaised = Color(0xFF1E293B);
  static const darkTextPrimary = Color(0xFFF8FAFC);
  static const darkTextSecondary = Color(0xFFCBD5E1);
  static const darkTextMuted = Color(0xFF94A3B8);
  static const darkPrimary = brand500; // web keeps primary as indigo in dark mode too

  /// Material [ColorScheme] built from the exact brand colour, rather than
  /// Flutter's generic `Colors.indigo` swatch (which is a different, if
  /// visually similar, set of values).
  static ColorScheme lightColorScheme = ColorScheme.fromSeed(
    seedColor: brand600,
    brightness: Brightness.light,
    primary: brand600,
    secondary: finance600,
    error: danger600,
    surface: surfaceRaised,
    onSurface: textPrimary,
  );

  static ColorScheme darkColorScheme = ColorScheme.fromSeed(
    seedColor: brand500,
    brightness: Brightness.dark,
    primary: brand500,
    secondary: finance500,
    error: danger500,
    surface: darkSurfaceRaised,
    onSurface: darkTextPrimary,
  );
}
