package com.shikshapilot.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Groups
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
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

data class PriorityAction(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val color: Color,
    val badgeText: String? = null
)

@Composable
fun PriorityActionCarousel(
    onActionClick: (PriorityAction) -> Unit,
    onOpenActionSheet: () -> Unit = {}
) {
    val actions = listOf(
        PriorityAction("broadcast_emergency", "Emergency Blast", "SMS & Push Alert", Icons.Default.Campaign, Color(0xFFEF4444), badgeText = "URGENT"),
        PriorityAction("leaves", "Approve Leaves", "Staff Applications", Icons.Default.Edit, WarningYellow, badgeText = "3 Pending"),
        PriorityAction("fee_defaulters", "Fee Defaulters", "Send Reminders", Icons.Default.AccountBalanceWallet, SunsetOrange, badgeText = "14 Overdue"),
        PriorityAction("staff", "Substitutes", "Assign Teachers", Icons.Default.Groups, Color(0xFFA855F7), badgeText = "1 Pending")
    )

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Priority Actions",
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(SunsetOrange.copy(alpha = 0.18f))
                    .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = RoundedCornerShape(10.dp))
                    .clickable { onOpenActionSheet() }
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "Action Sheet",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = SunsetOrange
                )
            }
        }

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(actions) { action ->
                Box(
                    modifier = Modifier
                        .width(160.dp)
                        .height(130.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(FrostedCard.copy(alpha = 0.85f))
                        .border(
                            width = 1.dp,
                            color = if (action.badgeText == "URGENT") Color(0xFFEF4444).copy(alpha = 0.6f) else CardBorder,
                            shape = RoundedCornerShape(20.dp)
                        )
                        .clickable { onActionClick(action) }
                        .padding(12.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(action.color.copy(alpha = 0.18f))
                                    .border(width = 1.dp, color = action.color.copy(alpha = 0.35f), shape = RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = action.icon,
                                    contentDescription = action.title,
                                    tint = action.color,
                                    modifier = Modifier.size(18.dp)
                                )
                            }

                            if (action.badgeText != null) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(
                                            if (action.badgeText == "URGENT") Color(0xFFEF4444).copy(alpha = 0.2f)
                                            else SunsetOrange.copy(alpha = 0.18f)
                                        )
                                        .padding(horizontal = 5.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = action.badgeText,
                                        fontSize = 8.5.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (action.badgeText == "URGENT") Color(0xFFEF4444) else SunsetOrange
                                    )
                                }
                            }
                        }

                        Column {
                            Text(
                                text = action.title,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                maxLines = 1
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = action.subtitle,
                                fontSize = 11.sp,
                                color = TextSecondary,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }
    }
}
