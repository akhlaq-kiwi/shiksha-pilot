package com.shikshapilot.nativeapp.features.teacher.screens

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
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Class
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
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
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
fun TeacherDashboardScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    teacherPhone: String = "8650302490",
    onNavigate: (String) -> Unit = {},
    onLogoutClick: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    var scheduleList by remember { mutableStateOf<List<TimetableItemDto>>(emptyList()) }
    var classesList by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val defaultSchedule = remember {
        listOf(
            TimetableItemDto(id = 1, period_number = 1, subject_name = "Social Studies (SST)", class_name = "Class 1", start_time = "08:00 AM", end_time = "08:40 AM", room = "Room 146"),
            TimetableItemDto(id = 2, period_number = 2, subject_name = "English Grammar", class_name = "Class 1", start_time = "08:40 AM", end_time = "09:20 AM", room = "Room 146"),
            TimetableItemDto(id = 3, period_number = 3, subject_name = "General Science", class_name = "Class 1", start_time = "09:20 AM", end_time = "10:00 AM", room = "Room 146"),
            TimetableItemDto(id = 4, period_number = 4, subject_name = "Mathematics", class_name = "Class 1-A", start_time = "10:00 AM", end_time = "10:40 AM", room = "Room 148"),
            TimetableItemDto(id = 5, period_number = 5, subject_name = "Sanskrit / Hindi", class_name = "Class 1-B", start_time = "11:00 AM", end_time = "11:40 AM", room = "Room 150")
        )
    }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getTeacherDashboard()
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!!
                if (data.schedule.isNotEmpty()) {
                    scheduleList = data.schedule
                } else {
                    scheduleList = defaultSchedule
                }
                classesList = data.classes
            } else {
                scheduleList = defaultSchedule
            }
        } catch (e: Exception) {
            scheduleList = defaultSchedule
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
                                text = "Teacher Dashboard",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: GET /api/teacher/dashboard",
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

                    // Stat Row
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
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(text = "Assigned Classes", fontSize = 11.sp, color = TextSecondary)
                                Text(text = "${if (classesList.isNotEmpty()) classesList.size else 4}", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange)
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
                                Text(text = "Today's Periods", fontSize = 11.sp, color = TextSecondary)
                                Text(text = "${scheduleList.size}", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = OnlineGreen)
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
                                .clickable { onNavigate("teacher_attendance") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.CheckCircle, contentDescription = "Attendance", tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Attendance", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("teacher_assignments") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Assignments", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Assignments", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("teacher_materials") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Book, contentDescription = "Materials", tint = TextPrimary, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Study Notes", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Second Quick Actions Row: Classes / Leave / Notifications / Salaries
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
                                .clickable { onNavigate("teacher_classes") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "Classes", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("teacher_leave") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "Leave", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("teacher_notifications") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "Notifications", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(12.dp))
                                .clickable { onNavigate("teacher_salaries") }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "Salary", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "TODAY'S TEACHING SCHEDULE (QA LIVE API)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 1.sp
                    )

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
                            items(scheduleList) { item ->
                                val subjectStr = item.subject_name ?: "Break / Free Period"
                                val classStr = item.class_name ?: "Class 1"
                                val timeStr = if (item.start_time != null) "${item.start_time} - ${item.end_time}" else "Period ${item.period_number}"
                                val roomStr = item.room ?: "Room 146"
                                val isFree = item.is_free

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(FrostedCard)
                                        .border(
                                            width = 1.dp,
                                            color = if (isFree) CardBorder else SunsetOrange.copy(alpha = 0.5f),
                                            shape = RoundedCornerShape(16.dp)
                                        )
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
                                                .background(if (isFree) CardBorder else SunsetOrange.copy(alpha = 0.18f)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Schedule,
                                                contentDescription = "Period",
                                                tint = if (isFree) TextSecondary else SunsetOrange,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }

                                        Spacer(modifier = Modifier.width(12.dp))

                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = "Period ${item.period_number}: $subjectStr",
                                                fontSize = 14.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextPrimary
                                            )
                                            Text(
                                                text = "$classStr • $roomStr",
                                                fontSize = 12.sp,
                                                color = TextSecondary
                                            )
                                            Text(
                                                text = timeStr,
                                                fontSize = 11.sp,
                                                color = SunsetOrange,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }

                                        if (!isFree) {
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(OnlineGreen.copy(alpha = 0.2f))
                                                    .border(width = 1.dp, color = OnlineGreen, shape = RoundedCornerShape(8.dp))
                                                    .clickable {
                                                        onNavigate("teacher_attendance")
                                                    }
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            ) {
                                                Text(text = "Mark Att.", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
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
}
