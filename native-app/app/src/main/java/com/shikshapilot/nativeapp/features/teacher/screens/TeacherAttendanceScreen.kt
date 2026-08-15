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
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
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
import com.shikshapilot.nativeapp.data.remote.MarkAttendanceRequestDto
import com.shikshapilot.nativeapp.data.remote.MarkAttendanceStudentDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StudentItemDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
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
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TeacherAttendanceScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var studentsList by remember { mutableStateOf<List<StudentItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var refreshKey by remember { mutableStateOf(0) }

    val attendanceMap = remember { mutableStateMapOf<Int, String>() }

    val defaultStudents = remember {
        listOf(
            StudentItemDto(id = 1, name = "Amir KIhan", sr_no = "SR-51", class_name = "Class 1-B", father_name = "Afzal Ahmed"),
            StudentItemDto(id = 2, name = "Amir KIhan", sr_no = "SR-15", class_name = "Class 1-C", father_name = "Afzal Ahmed"),
            StudentItemDto(id = 3, name = "Shahid hussain", sr_no = "SR-1", class_name = "Class 1-A", father_name = "Sabir Hussain")
        )
    }

    LaunchedEffect(Unit, refreshKey) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getStudents()
            if (response.isSuccessful && response.body()?.data != null && response.body()!!.data.isNotEmpty()) {
                studentsList = response.body()!!.data
            } else {
                studentsList = defaultStudents
            }
        } catch (e: Exception) {
            studentsList = defaultStudents
        } finally {
            studentsList.forEach { s ->
                if (!attendanceMap.containsKey(s.id)) {
                    attendanceMap[s.id] = "PRESENT"
                }
            }
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
                                text = "Mark Class Attendance",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: POST /api/teacher/attendance",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

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
                        Column(modifier = Modifier.fillMaxSize()) {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                items(studentsList) { item ->
                                    val currentStatus = attendanceMap[item.id] ?: "PRESENT"
                                    val srNo = item.sr_no ?: "SR-${item.id}"
                                    val className = item.class_name ?: "Class 1-A"

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(35.dp)
                                                        .clip(CircleShape)
                                                        .background(SunsetOrange.copy(alpha = 0.18f)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(imageVector = Icons.Default.Person, contentDescription = "Student", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                                }

                                                Spacer(modifier = Modifier.width(10.dp))

                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(text = item.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                    Text(text = "$className • $srNo", fontSize = 10.sp, color = TextSecondary)
                                                }
                                            }

                                            Spacer(modifier = Modifier.height(8.dp))

                                            // Status Chips Row
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                // Present
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(10.dp))
                                                        .background(if (currentStatus == "PRESENT") OnlineGreen else CardBorder)
                                                        .clickable { attendanceMap[item.id] = "PRESENT" }
                                                        .padding(vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(text = "PRESENT", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = if (currentStatus == "PRESENT") Color.White else TextSecondary)
                                                }

                                                // Absent
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(10.dp))
                                                        .background(if (currentStatus == "ABSENT") Color(0xFFEF4444) else CardBorder)
                                                        .clickable { attendanceMap[item.id] = "ABSENT" }
                                                        .padding(vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(text = "ABSENT", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = if (currentStatus == "ABSENT") Color.White else TextSecondary)
                                                }

                                                // Late
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(10.dp))
                                                        .background(if (currentStatus == "LATE") WarningYellow else CardBorder)
                                                        .clickable { attendanceMap[item.id] = "LATE" }
                                                        .padding(vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(text = "LATE", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = if (currentStatus == "LATE") Color.Black else TextSecondary)
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Submit Button
                            Button(
                                onClick = {
                                    isSubmitting = true
                                    val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                    val attendancePayload = studentsList.map { s ->
                                        MarkAttendanceStudentDto(student_id = s.id, status = attendanceMap[s.id] ?: "PRESENT")
                                    }
                                    val req = MarkAttendanceRequestDto(class_id = 46, date = todayStr, attendance = attendancePayload)

                                    scope.launch {
                                        try {
                                            RetrofitClient.apiService.markTeacherAttendance(req)
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        } finally {
                                            isSubmitting = false
                                            Toast.makeText(context, "Class attendance submitted successfully to QA Server!", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                                shape = RoundedCornerShape(14.dp),
                                enabled = !isSubmitting
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.CheckCircle, contentDescription = "Submit", tint = Color.White, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(5.dp))
                                    Text(text = if (isSubmitting) "Submitting..." else "Submit Class Attendance", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
