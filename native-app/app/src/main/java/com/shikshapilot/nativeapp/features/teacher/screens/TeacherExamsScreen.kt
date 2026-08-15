package com.shikshapilot.nativeapp.features.teacher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TeacherExamDetailsDto
import com.shikshapilot.nativeapp.data.remote.TeacherExamListItemDto
import com.shikshapilot.nativeapp.data.remote.TeacherExamPaperDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Teacher exams list (class teacher's own class) — GET /api/teacher/exams-new.
 * Drills down into exam details (GET /api/teacher/exams-new/{id}/details) which shows the exam's
 * scheme papers; tapping a scheduled subject opens TeacherMarksEntryScreen for marks entry.
 */
@Composable
fun TeacherExamsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var exams by remember { mutableStateOf<List<TeacherExamListItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedExam by remember { mutableStateOf<TeacherExamListItemDto?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    fun loadExams() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getTeacherExams()
                if (response.isSuccessful && response.body() != null) {
                    exams = response.body()!!.data
                } else {
                    errorMessage = "Unable to load exams (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading exams"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(refreshKey) { loadExams() }

    if (selectedExam != null) {
        TeacherExamDetailScreen(
            exam = selectedExam!!,
            onBack = { selectedExam = null }
        )
        return
    }

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
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 13.dp, vertical = 10.dp)
                ) {
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
                            Text(text = "My Class Exams", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(
                                text = "QA Server: GET /api/teacher/exams-new",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        exams.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No exams found for your class yet.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(exams) { exam ->
                                    val statusColor = when (exam.status?.uppercase()) {
                                        "CURRENT" -> OnlineGreen
                                        "UPCOMING" -> InfoBlue
                                        else -> TextSecondary
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                            .clickable { selectedExam = exam }
                                            .padding(14.dp)
                                    ) {
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
                                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Exam", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = exam.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${exam.start_date ?: "-"} to ${exam.end_date ?: "-"}",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                                if (exam.result_published == 1) {
                                                    Text(text = "Results Published", fontSize = 9.5.sp, color = OnlineGreen, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(statusColor.copy(alpha = 0.2f))
                                                    .border(width = 1.dp, color = statusColor, shape = RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                                            ) {
                                                Text(text = exam.status ?: "-", fontSize = 8.5.sp, fontWeight = FontWeight.ExtraBold, color = statusColor)
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
}

@Composable
private fun TeacherExamDetailScreen(
    exam: TeacherExamListItemDto,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var details by remember { mutableStateOf<TeacherExamDetailsDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedPaper by remember { mutableStateOf<TeacherExamPaperDto?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    fun loadDetails() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getTeacherExamDetails(exam.id)
                if (response.isSuccessful && response.body()?.data != null) {
                    details = response.body()!!.data
                } else {
                    errorMessage = "Unable to load exam details (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading exam details"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(exam.id, refreshKey) { loadDetails() }

    if (selectedPaper != null) {
        val paper = selectedPaper!!
        TeacherMarksEntryScreen(
            examId = exam.id,
            subjectId = paper.subject_id ?: 0,
            subjectName = paper.subject_name ?: "Subject",
            onBack = { selectedPaper = null }
        )
        return
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .padding(horizontal = 13.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = exam.name, fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(
                        text = "QA Server: GET /api/teacher/exams-new/{id}/details",
                        fontSize = 9.sp,
                        color = SunsetOrange
                    )
                }
            }

            when {
                isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                    }
                }
                errorMessage != null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 11.sp)
                    }
                }
                details == null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "No details available", color = TextSecondary, fontSize = 11.sp)
                    }
                }
                else -> {
                    val d = details!!
                    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                        Text(
                            text = "EXAM TIMETABLE — TAP A SUBJECT TO ENTER MARKS",
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextSecondary,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        if (d.scheme.isEmpty()) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No papers scheduled for your class yet.", color = TextSecondary, fontSize = 11.sp)
                            }
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(d.scheme) { paper ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                            .clickable { selectedPaper = paper }
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(text = paper.subject_name ?: "Subject", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Text(
                                                    text = "${paper.exam_date ?: "-"}  •  ${paper.evaluation_type?.replaceFirstChar { it.uppercase() } ?: "Marks"}",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                            Icon(Icons.Default.ChevronRight, contentDescription = "Enter Marks", tint = SunsetOrange)
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
