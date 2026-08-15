package com.shikshapilot.nativeapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = SunsetOrange,
    onPrimary = Color.White,
    secondary = OnlineGreen,
    onSecondary = Color.White,
    background = DarkCanvas,
    onBackground = TextPrimary,
    surface = FrostedCard,
    onSurface = TextPrimary,
    surfaceVariant = FrostedCard,
    onSurfaceVariant = TextSecondary,
    outline = CardBorder,
    error = DangerRed,
    onError = Color.White
)

@Composable
fun ShikshaPilotTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = CompactTypography,
        content = content
    )
}
