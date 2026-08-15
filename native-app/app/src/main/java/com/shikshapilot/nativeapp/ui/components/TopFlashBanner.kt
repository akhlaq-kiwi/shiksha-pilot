package com.shikshapilot.nativeapp.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow
import kotlinx.coroutines.delay

enum class FlashMessageType {
    ERROR,
    SUCCESS,
    WARNING
}

data class FlashMessage(
    val message: String,
    val type: FlashMessageType = FlashMessageType.ERROR,
    val durationMs: Long = 3000L
)

@Composable
fun TopFlashBanner(
    flashMessage: FlashMessage?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Auto-dismiss after durationMs
    LaunchedEffect(flashMessage) {
        if (flashMessage != null && flashMessage.durationMs > 0) {
            delay(flashMessage.durationMs)
            onDismiss()
        }
    }

    AnimatedVisibility(
        visible = flashMessage != null,
        enter = slideInVertically(
            initialOffsetY = { -it },
            animationSpec = spring(stiffness = 400f)
        ) + fadeIn(),
        exit = slideOutVertically(
            targetOffsetY = { -it },
            animationSpec = spring(stiffness = 400f)
        ) + fadeOut(),
        modifier = modifier
            .statusBarsPadding()
            .padding(top = 10.dp, start = 16.dp, end = 16.dp)
    ) {
        flashMessage?.let { item ->
            val accentColor: Color
            val containerBg: Color
            val iconVector: ImageVector

            when (item.type) {
                FlashMessageType.ERROR -> {
                    accentColor = Color(0xFFEF4444) // Crisp Crimson Red
                    containerBg = Color(0xFF1E1418)
                    iconVector = Icons.Default.ErrorOutline
                }
                FlashMessageType.SUCCESS -> {
                    accentColor = OnlineGreen
                    containerBg = Color(0xFF102018)
                    iconVector = Icons.Default.CheckCircle
                }
                FlashMessageType.WARNING -> {
                    accentColor = WarningYellow
                    containerBg = Color(0xFF221E14)
                    iconVector = Icons.Default.Warning
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(elevation = 16.dp, shape = RoundedCornerShape(20.dp), spotColor = accentColor.copy(alpha = 0.3f))
                    .clip(RoundedCornerShape(20.dp))
                    .background(containerBg)
                    .border(width = 1.dp, color = accentColor.copy(alpha = 0.45f), shape = RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Left Badge Icon Container
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(accentColor.copy(alpha = 0.18f))
                            .border(width = 1.dp, color = accentColor.copy(alpha = 0.35f), shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = iconVector,
                            contentDescription = item.type.name,
                            tint = accentColor,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Message Text
                    Text(
                        text = item.message,
                        color = TextPrimary,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 18.sp,
                        modifier = Modifier.weight(1f)
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    // Close Button
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(FrostedCard.copy(alpha = 0.5f))
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}
