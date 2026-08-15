package com.shikshapilot.nativeapp.features.schooladmin.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.AnnouncementItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SchoolAdminAnnouncementsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var announcementsList by remember { mutableStateOf<List<AnnouncementItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }

    var showBroadcastDialog by remember { mutableStateOf(false) }
    var broadcastTitle by remember { mutableStateOf("") }
    var broadcastMsg by remember { mutableStateOf("") }

    val defaultAnnouncements = remember {
        listOf(
            AnnouncementItemDto(
                id = 1,
                subject = "Independence Day Celebration Notice",
                description = "All students & staff members must assemble by 8:00 AM on August 15 in full school uniform.",
                audience = "Both",
                status = "Published",
                created_at = "10 Aug 2026"
            ),
            AnnouncementItemDto(
                id = 2,
                subject = "URGENT: Bus Route 4 Delay Notice",
                description = "Route 4 bus delayed by 20 mins due to rain traffic on MG Road. Parents please note.",
                audience = "Students",
                status = "Published",
                created_at = "09 Aug 2026"
            ),
            AnnouncementItemDto(
                id = 3,
                subject = "Staff Monthly Meeting",
                description = "All faculty members are requested to attend the monthly academic review at 3:30 PM in Conference Room B.",
                audience = "Teachers",
                status = "Published",
                created_at = "08 Aug 2026"
            )
        )
    }

    LaunchedEffect(refreshKey) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getAnnouncements()
            if (response.isSuccessful && response.body()?.data != null && response.body()!!.data.isNotEmpty()) {
                announcementsList = response.body()!!.data
            } else {
                announcementsList = defaultAnnouncements
            }
        } catch (e: Exception) {
            announcementsList = defaultAnnouncements
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        containerColor = DarkCanvas
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 13.dp, vertical = 10.dp)
                ) {
                    // Back Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ArrowBackIos,
                                contentDescription = "Back",
                                tint = TextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Announcements & Broadcasts",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: POST /api/school/announcements",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }

                        // Broadcast Button
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFEF4444))
                                .clickable { showBroadcastDialog = true }
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Campaign, contentDescription = "Broadcast", tint = Color.White, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(3.dp))
                                Text(text = "Broadcast", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    if (isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            ThreeDotsLoader(
                                dotSize = 10.dp,
                                dotColor = SunsetOrange,
                                spaceBetween = 8.dp,
                                travelDistance = 8.dp
                            )
                        }
                    } else {
                        // Announcements Feed List
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(announcementsList) { item ->
                                val isEmergency = item.subject.contains("URGENT", ignoreCase = true)
                                val audienceStr = item.audience ?: "Both"
                                val dateStr = item.published_at ?: item.created_at ?: "Today"

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(FrostedCard)
                                        .border(
                                            width = 1.dp,
                                            color = if (isEmergency) Color(0xFFEF4444).copy(alpha = 0.6f) else CardBorder,
                                            shape = RoundedCornerShape(18.dp)
                                        )
                                        .padding(14.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = item.subject,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextPrimary,
                                                modifier = Modifier.weight(1f, fill = false)
                                            )

                                            if (isEmergency) {
                                                Spacer(modifier = Modifier.width(5.dp))
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(6.dp))
                                                        .background(Color(0xFFEF4444).copy(alpha = 0.2f))
                                                        .border(width = 1.dp, color = Color(0xFFEF4444), shape = RoundedCornerShape(6.dp))
                                                        .padding(horizontal = 5.dp, vertical = 2.dp)
                                                ) {
                                                    Text(text = "EMERGENCY", fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFEF4444))
                                                }
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(3.dp))

                                        Text(
                                            text = item.description,
                                            fontSize = 10.5.sp,
                                            color = TextSecondary
                                        )

                                        Spacer(modifier = Modifier.height(6.dp))

                                        Text(
                                            text = "$audienceStr • $dateStr",
                                            fontSize = 9.sp,
                                            color = SunsetOrange,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            }

            // Emergency Broadcast Dialog Modal
            if (showBroadcastDialog) {
                AlertDialog(
                    onDismissRequest = { showBroadcastDialog = false },
                    containerColor = DarkCanvas,
                    title = {
                        Text(
                            text = "Send Emergency Broadcast",
                            fontSize = 15.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    },
                    text = {
                        Column {
                            Text(
                                text = "Instant SMS / WhatsApp / Push alert blast to all staff and parents.",
                                fontSize = 10.sp,
                                color = TextSecondary
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = broadcastTitle,
                                onValueChange = { broadcastTitle = it },
                                placeholder = { Text("Title (e.g. Weather Alert)", color = TextSecondary) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            OutlinedTextField(
                                value = broadcastMsg,
                                onValueChange = { broadcastMsg = it },
                                placeholder = { Text("Message description...", color = TextSecondary) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                if (broadcastTitle.isNotBlank()) {
                                    val newDto = AnnouncementItemDto(
                                        subject = broadcastTitle,
                                        description = broadcastMsg,
                                        audience = "Both",
                                        status = "Published",
                                        created_at = "Just Now"
                                    )
                                    announcementsList = listOf(newDto) + announcementsList

                                    scope.launch {
                                        try {
                                            RetrofitClient.apiService.createAnnouncement(newDto)
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }

                                    Toast.makeText(context, "Emergency broadcast sent to QA Server!", Toast.LENGTH_SHORT).show()
                                    showBroadcastDialog = false
                                    broadcastTitle = ""
                                    broadcastMsg = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                        ) {
                            Text(text = "Send Blast", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showBroadcastDialog = false }) {
                            Text(text = "Cancel", color = TextSecondary)
                        }
                    }
                )
            }
        }
    }
}
