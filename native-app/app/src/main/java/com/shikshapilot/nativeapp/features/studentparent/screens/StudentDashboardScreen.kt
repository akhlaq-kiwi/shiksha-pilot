package com.shikshapilot.nativeapp.features.studentparent.screens

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
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StudentDashboardDataDto
import com.shikshapilot.nativeapp.data.remote.TimetableItemDto
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

@Composable
fun StudentDashboardScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    studentPhone: String = "9319398941",
    onNavigate: (String) -> Unit = {},
    onLogoutClick: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    var dashboardDto by remember { mutableStateOf<StudentDashboardDataDto?>(null) }
    var timetableList by remember { mutableStateOf<List<TimetableItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val defaultTimetable = remember {
        listOf(
            TimetableItemDto(id = 1, period_number = 1, subject_name = "Mathematics", teacher_name = "Bilal Ahmed", start_time = "08:00 AM", end_time = "08:40 AM", room = "Room 101"),
            TimetableItemDto(id = 2, period_number = 2, subject_name = "English Literature", teacher_name = "Sajeev Khanna", start_time = "08:40 AM", end_time = "09:20 AM", room = "Room 101"),
            TimetableItemDto(id = 3, period_number = 3, subject_name = "Science & Tech", teacher_name = "Vikram Malhotra", start_time = "09:20 AM", end_time = "10:00 AM", room = "Science Lab 1"),
            TimetableItemDto(id = 4, period_number = 4, subject_name = "Hindi / Grammar", teacher_name = "Bilal Ahmed", start_time = "10:00 AM", end_time = "10:40 AM", room = "Room 101")
        )
    }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getStudentDashboard()
            if (response.isSuccessful && response.body()?.data != null) {
                dashboardDto = response.body()!!.data
                if (dashboardDto?.timetable != null && dashboardDto!!.timetable.isNotEmpty()) {
                    timetableList = dashboardDto!!.timetable
                } else {
                    timetableList = defaultTimetable
                }
            } else {
                timetableList = defaultTimetable
            }
        } catch (e: Exception) {
            timetableList = defaultTimetable
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
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // Portal Title Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Student & Parent Portal",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: GET /api/student/dashboard",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(SunsetOrange.copy(alpha = 0.2f))
                                .border(width = 1.dp, color = SunsetOrange, shape = RoundedCornerShape(10.dp))
                                .clickable { onLogoutClick() }
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Text(text = "Logout", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Outstanding Fee Warning Banner
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(WarningYellow.copy(alpha = 0.12f))
                            .border(width = 1.dp, color = WarningYellow.copy(alpha = 0.5f), shape = RoundedCornerShape(16.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.AccountBalanceWallet, contentDescription = "Fee", tint = WarningYellow, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(text = "Fee Payment Due", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Text(text = "Pending Dues: ₹ 9,777", fontSize = 11.5.sp, color = WarningYellow, fontWeight = FontWeight.SemiBold)
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SunsetOrange)
                                    .clickable { onNavigate("student_fees") }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(text = "Pay Fees", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Stat Cards Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                .clickable { onNavigate("student_attendance") }
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(text = "Attendance", fontSize = 11.sp, color = TextSecondary)
                                Text(text = "95% Present", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = OnlineGreen)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(text = "Assignments", fontSize = 11.sp, color = TextSecondary)
                                Text(text = "3 Pending", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Quick Actions Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(SunsetOrange)
                                .clickable { onNavigate("student_fees") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.AccountBalanceWallet, contentDescription = "Fees", tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Fee Cards", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("student_assignments") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Homework", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Homework", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("student_materials") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Book, contentDescription = "Resources", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Materials", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("student_results") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Results", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Results", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("achievements") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.EmojiEvents, contentDescription = "Achievements", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Achievements", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("vocabulary") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.MenuBook, contentDescription = "Vocabulary", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Vocabulary", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("word_builder_game") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Extension, contentDescription = "Word Builder", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Word Builder", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("notification_preferences") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Notifications, contentDescription = "Notifications", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Notifications", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigate("student_timetable") },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "TODAY'S CLASS TIMETABLE (QA LIVE API)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextSecondary,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "View Full →",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = SunsetOrange
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

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
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(timetableList) { item ->
                                val subjectStr = item.subject_name ?: "Subject"
                                val teacherStr = item.teacher_name ?: "Faculty Member"
                                val timeStr = if (item.start_time != null) "${item.start_time} - ${item.end_time}" else "Period ${item.period_number}"
                                val roomStr = item.room ?: "Class 1-A"

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(FrostedCard)
                                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                        .padding(14.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(40.dp)
                                                .clip(CircleShape)
                                                .background(SunsetOrange.copy(alpha = 0.18f)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(imageVector = Icons.Default.Schedule, contentDescription = "Period", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                        }

                                        Spacer(modifier = Modifier.width(12.dp))

                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(text = "Period ${item.period_number}: $subjectStr", fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Text(text = "Teacher: $teacherStr • $roomStr", fontSize = 12.sp, color = TextSecondary)
                                            Text(text = timeStr, fontSize = 11.sp, color = SunsetOrange, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
