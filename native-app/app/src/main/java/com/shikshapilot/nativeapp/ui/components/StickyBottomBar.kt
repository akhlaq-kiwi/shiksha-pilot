package com.shikshapilot.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary

@Composable
fun StickyBottomBar(
    activeTab: String = "home", // "home", "education", "exams", "finance", "settings"
    onTabSelected: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FrostedCard.copy(alpha = 0.95f))
    ) {
        // Top divider line for clean separation from content
        HorizontalDivider(color = CardBorder, thickness = 1.dp)

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 1. HOME TAB
            BottomNavItem(
                icon = Icons.Default.Home,
                label = "Home",
                isSelected = activeTab == "home",
                badgeCount = 0,
                onClick = { onTabSelected("home") }
            )

            // 2. EDUCATION TAB (Classes, Timetable, Exams, Attendance, Academic Setup)
            BottomNavItem(
                icon = Icons.Default.MenuBook,
                label = "Education",
                isSelected = activeTab == "education",
                badgeCount = 0,
                onClick = { onTabSelected("education") }
            )

            // 3. EXAMS TAB
            BottomNavItem(
                icon = Icons.Default.Assignment,
                label = "Exams",
                isSelected = activeTab == "exams",
                badgeCount = 0,
                onClick = { onTabSelected("exams") }
            )

            // 4. FINANCE TAB
            BottomNavItem(
                icon = Icons.Default.AccountBalanceWallet,
                label = "Finance",
                isSelected = activeTab == "finance",
                badgeCount = 0,
                onClick = { onTabSelected("finance") }
            )

            // 5. SETTINGS TAB
            BottomNavItem(
                icon = Icons.Default.Settings,
                label = "Settings",
                isSelected = activeTab == "settings",
                badgeCount = 0,
                onClick = { onTabSelected("settings") }
            )
        }
    }
}

@Composable
private fun BottomNavItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    badgeCount: Int,
    onClick: () -> Unit
) {
    val activeColor = SunsetOrange
    val inactiveColor = TextSecondary

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = if (isSelected) activeColor else inactiveColor,
                    modifier = Modifier.size(20.dp)
                )

                // Notification Badge
                if (badgeCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 6.dp, y = (-4).dp)
                            .size(13.dp)
                            .background(Color(0xFFEF4444), shape = CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = badgeCount.toString(),
                            color = Color.White,
                            fontSize = 7.5.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }

            Text(
                text = label,
                fontSize = 9.5.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) TextPrimary else inactiveColor,
                modifier = Modifier.padding(top = 1.dp)
            )
        }
    }
}
