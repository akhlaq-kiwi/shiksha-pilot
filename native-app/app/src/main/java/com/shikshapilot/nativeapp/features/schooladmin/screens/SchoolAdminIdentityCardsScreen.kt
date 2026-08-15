package com.shikshapilot.nativeapp.features.schooladmin.screens

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
import androidx.compose.material.icons.filled.Person
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SchoolProfileDto
import com.shikshapilot.nativeapp.data.remote.StudentItemDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary

/**
 * Renders one ID card per active student in a class, matching the web's
 * ClassIdentityCardPreview.jsx layout (school header bar, photo, name/father/class-sec/mobile).
 * Data comes entirely from the existing GET api/school/students + GET api/school/profile
 * endpoints — no dedicated identity-card backend route exists (the web builds these client-side
 * too). PDF export/print (html2pdf.js on web) is not implemented here — cards are for on-device
 * viewing/verification only. Student photos are not loaded (shown as initials only) to avoid
 * photo_path base-URL/auth complexities not otherwise exercised elsewhere in this app.
 */
@Composable
fun SchoolAdminIdentityCardsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    classNameFilter: String,
    onBack: () -> Unit = {}
) {
    var students by remember { mutableStateOf<List<StudentItemDto>>(emptyList()) }
    var schoolProfile by remember { mutableStateOf<SchoolProfileDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        try {
            val studentsRes = RetrofitClient.apiService.getStudents()
            if (studentsRes.isSuccessful && studentsRes.body()?.data != null) {
                students = studentsRes.body()!!.data
                    .filter { it.class_name?.trim()?.equals(classNameFilter.trim(), ignoreCase = true) == true }
                    .filter { it.status == null || it.status.equals("ACTIVE", ignoreCase = true) }
                    .sortedBy { it.roll_no?.toIntOrNull() ?: Int.MAX_VALUE }
            }
            val profileRes = RetrofitClient.apiService.getSchoolProfile()
            if (profileRes.isSuccessful && profileRes.body()?.data != null) {
                schoolProfile = profileRes.body()!!.data
            }
        } catch (_: Exception) {
            // Non-fatal: cards render with placeholders if profile fetch fails.
        } finally {
            isLoading = false
        }
    }

    val displaySchoolName = schoolProfile?.name ?: schoolName

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
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
                    onNotificationClick = {},
                    onAvatarClick = {}
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
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
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "$classNameFilter — Identity Cards",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${students.size} students",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        students.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No active students found in $classNameFilter.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(14.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(students) { student ->
                                    IdentityCard(student = student, schoolName = displaySchoolName, className = classNameFilter)
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

@Composable
private fun IdentityCard(student: StudentItemDto, schoolName: String, className: String) {
    val initials = student.name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("")
    val classSecDisplay = if (!student.section.isNullOrBlank()) "$className/${student.section}" else className
    val mobile = student.parent_phone ?: student.student_mobile ?: "—"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .border(width = 2.dp, color = Color(0xFF27272A), shape = RoundedCornerShape(18.dp))
    ) {
        Column {
            // Header bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF115E45))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(text = schoolName.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFCD34D))
                    Text(text = "STUDENT IDENTITY CARD", fontSize = 7.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFD1FAE5))
                }
            }

            // Body
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8F9FA))
                    .padding(14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(width = 72.dp, height = 84.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFE4E4E7))
                        .border(width = 1.dp, color = Color(0xFFD4D4D8), shape = RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (initials.isNotBlank()) {
                        Text(text = initials, fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color(0xFF52525B))
                    } else {
                        Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = Color(0xFF52525B))
                    }
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    IdCardField(label = "Student Name", value = student.name)
                    Spacer(modifier = Modifier.height(4.dp))
                    IdCardField(label = "Father Name", value = student.father_name ?: "—")
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        IdCardField(label = "Class/Sec", value = classSecDisplay, modifier = Modifier.weight(1f))
                        IdCardField(label = "Mobile", value = mobile)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    IdCardField(label = "SR No.", value = student.sr_no ?: "SR-${student.id}")
                }
            }
        }
    }
}

@Composable
private fun IdCardField(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(text = label.uppercase(), fontSize = 7.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFF71717A))
        Text(text = value.uppercase(), fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFF09090B))
    }
}
