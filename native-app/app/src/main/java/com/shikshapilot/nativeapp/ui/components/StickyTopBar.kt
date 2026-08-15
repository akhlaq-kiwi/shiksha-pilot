package com.shikshapilot.nativeapp.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.R
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary

@Composable
fun StickyTopBar(
    schoolName: String,
    unreadNotificationCount: Int,
    onNotificationClick: () -> Unit,
    onAvatarClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FrostedCard.copy(alpha = 0.95f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left Side: Brand Logo + Vertically Centered School Name & Powered By text
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // ShikshaPilot Exact Logo Icon
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SunsetOrange.copy(alpha = 0.15f))
                        .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.35f), shape = RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_launcher),
                        contentDescription = "Logo",
                        modifier = Modifier.size(28.dp)
                    )
                }

                Spacer(modifier = Modifier.width(10.dp))

                // Vertically Centered Column
                Column(
                    verticalArrangement = Arrangement.Center
                ) {
                    // School Name on Top
                    Text(
                        text = schoolName.uppercase(),
                        fontSize = 15.5.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary,
                        lineHeight = 16.sp,
                        maxLines = 1
                    )
                    
                    // Under School Name: "Powered by ShikshaPilot" in italic
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Powered by ",
                            fontSize = 10.5.sp,
                            fontStyle = FontStyle.Italic,
                            color = TextSecondary,
                            lineHeight = 12.sp
                        )
                        Text(
                            text = "ShikshaPilot",
                            fontSize = 10.5.sp,
                            fontStyle = FontStyle.Italic,
                            fontWeight = FontWeight.Bold,
                            color = SunsetOrange,
                            lineHeight = 12.sp
                        )
                    }
                }
            }

            // Right Side: Separate Bell Button + Right-Aligned Profile Avatar
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Notification Bell Icon Button with Badge Counter
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White.copy(alpha = 0.08f))
                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                        .clickable { onNotificationClick() }
                        .padding(9.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = "Notifications",
                        tint = TextPrimary,
                        modifier = Modifier.size(22.dp)
                    )
                    if (unreadNotificationCount > 0) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 4.dp, y = (-4).dp)
                                .size(16.dp)
                                .background(Color(0xFFEF4444), shape = CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = unreadNotificationCount.toString(),
                                color = Color.White,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Right-Aligned Profile Avatar with Online Status Dot
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable { onAvatarClick() }
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(SunsetOrange.copy(alpha = 0.2f), shape = CircleShape)
                            .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.5f), shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Profile",
                            tint = TextPrimary,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // Online Status Dot
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(11.dp)
                            .background(OnlineGreen, shape = CircleShape)
                            .border(width = 2.dp, color = DarkCanvas, shape = CircleShape)
                    )
                }
            }
        }

        // Bottom border line only (Top border completely removed)
        HorizontalDivider(color = CardBorder, thickness = 1.dp)
    }
}
