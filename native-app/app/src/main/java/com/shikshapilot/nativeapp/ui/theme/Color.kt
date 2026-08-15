package com.shikshapilot.nativeapp.ui.theme

import androidx.compose.ui.graphics.Color

// Matches frontend/src/index.css's light "Scholar" design tokens (--surface-canvas,
// --surface-raised, --color-primary/brand-600, --text-primary/secondary, semantic ramps).
// Names are kept as-is for compatibility even though the theme is now light, not dark —
// e.g. DarkCanvas is the app's light background, not a dark one.
val DarkCanvas = Color(0xFFFAF9F6)      // --surface-canvas
val FrostedCard = Color(0xFFFFFFFF)     // --surface-raised (cards)
val CardBorder = Color(0xFFEBEAE8)      // --border-subtle
val SunsetOrange = Color(0xFF059669)    // --color-primary (brand-600, Scholar Emerald)
val OnlineGreen = Color(0xFF10B981)     // --success-500 / brand-500
val TextPrimary = Color(0xFF0F172A)     // --text-primary (Onyx Navy)
val TextSecondary = Color(0xFF4B5563)   // --text-secondary
val WarningYellow = Color(0xFFD97706)   // --warning-600 (text-safe on light bg)
val InfoBlue = Color(0xFF0284C7)        // --info-600 (text-safe on light bg)
val DangerRed = Color(0xFFE11D48)       // --danger-600 (text-safe on light bg)
