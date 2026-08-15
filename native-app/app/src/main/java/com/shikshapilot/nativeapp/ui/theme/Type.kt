package com.shikshapilot.nativeapp.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp

/**
 * Compact typography scale (~85% of Material3 defaults) so screens that don't set an explicit
 * fontSize — default Text(), OutlinedTextField input/placeholder text, Button labels — render
 * smaller and tighter instead of the stock Material3 sizes, which read as oversized against this
 * app's dense, information-heavy screens.
 */
val CompactTypography = Typography(
    displayLarge = TextStyle(fontSize = 48.sp, lineHeight = 54.sp),
    displayMedium = TextStyle(fontSize = 38.sp, lineHeight = 44.sp),
    displaySmall = TextStyle(fontSize = 30.sp, lineHeight = 36.sp),
    headlineLarge = TextStyle(fontSize = 27.sp, lineHeight = 34.sp),
    headlineMedium = TextStyle(fontSize = 24.sp, lineHeight = 30.sp),
    headlineSmall = TextStyle(fontSize = 20.sp, lineHeight = 26.sp),
    titleLarge = TextStyle(fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    titleSmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    bodyLarge = TextStyle(fontSize = 13.sp, lineHeight = 18.sp),
    bodyMedium = TextStyle(fontSize = 12.sp, lineHeight = 17.sp),
    bodySmall = TextStyle(fontSize = 11.sp, lineHeight = 15.sp),
    labelLarge = TextStyle(fontSize = 12.sp, lineHeight = 16.sp),
    labelMedium = TextStyle(fontSize = 11.sp, lineHeight = 14.sp),
    labelSmall = TextStyle(fontSize = 10.sp, lineHeight = 13.sp)
)
