package com.shikshapilot.nativeapp.features.studentparent.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.ReportCardDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StudentExamDetailsDto
import com.shikshapilot.nativeapp.data.remote.StudentExamListItemDto
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Student/Parent exam results — GET /api/student/exams-new lists exams, GET
 * /api/student/exams-new/{id}/details returns per-subject marks once published (StudentService::
 * getExamDetails). Report cards (full academic summary with rank/attendance/grade) come back as plain
 * JSON — not a PDF/URL — from GET /api/student/exams-new/report-cards (StudentService::
 * getPublishedReportCards), so we render them natively instead of using the Intent/FileProvider
 * download pattern used elsewhere (e.g. StudentMaterialsScreen, TeacherSalariesScreen).
 */
@Composable
fun StudentResultsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var exams by remember { mutableStateOf<List<StudentExamListItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedExam by remember { mutableStateOf<StudentExamListItemDto?>(null) }
    var showReportCards by remember { mutableStateOf(false) }

    fun loadExams() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getStudentExams()
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

    LaunchedEffect(Unit) { loadExams() }

    if (showReportCards) {
        StudentReportCardsScreen(onBack = { showReportCards = false })
        return
    }

    if (selectedExam != null) {
        StudentExamDetailScreen(
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
                            Text(text = "Exams & Results", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(
                                text = "QA Server: GET /api/student/exams-new",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(SunsetOrange)
                                .clickable { showReportCards = true }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(imageVector = Icons.Default.Description, contentDescription = "Report Cards", tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Report Cards", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        exams.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No examinations found yet.", color = TextSecondary, fontSize = 13.sp)
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
                                                    .size(40.dp)
                                                    .clip(CircleShape)
                                                    .background(SunsetOrange.copy(alpha = 0.18f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Exam", tint = SunsetOrange, modifier = Modifier.size(18.dp))
                                            }
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = exam.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${exam.start_date ?: "-"} to ${exam.end_date ?: "-"}",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                                if (exam.result_published == 1) {
                                                    Text(text = "Results Published", fontSize = 11.sp, color = OnlineGreen, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(statusColor.copy(alpha = 0.2f))
                                                    .border(width = 1.dp, color = statusColor, shape = RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                                            ) {
                                                Text(text = exam.status ?: "-", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = statusColor)
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
private fun StudentExamDetailScreen(
    exam: StudentExamListItemDto,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var details by remember { mutableStateOf<StudentExamDetailsDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(exam.id) {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getStudentExamDetails(exam.id)
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

    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = exam.name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(
                        text = "QA Server: GET /api/student/exams-new/{id}/details",
                        fontSize = 10.5.sp,
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
                        Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                details == null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "No details available", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                else -> {
                    val d = details!!
                    if (d.is_restricted == true) {
                        Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                            Text(
                                text = "Results/admit card restricted due to pending fee dues. Please clear outstanding dues to view.",
                                color = WarningYellow,
                                fontSize = 13.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize().padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            item {
                                Text(text = "Schedule", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = TextSecondary, letterSpacing = 1.sp)
                            }

                            if (d.scheme.isNullOrEmpty()) {
                                item {
                                    Text(text = "Timetable not published yet.", color = TextSecondary, fontSize = 13.sp)
                                }
                            } else {
                                items(d.scheme!!) { paper ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                            .padding(12.dp)
                                    ) {
                                        Column {
                                            Text(text = paper.subject_name ?: "Subject", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Text(
                                                text = "${paper.exam_date ?: "-"} • ${paper.start_time ?: ""}-${paper.end_time ?: ""} • Room ${paper.room ?: "-"}",
                                                fontSize = 11.5.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }
                                }
                            }

                            if (d.admit_card != null) {
                                item { Spacer(modifier = Modifier.height(4.dp)) }
                                item {
                                    Text(text = "Admit Card", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = TextSecondary, letterSpacing = 1.sp)
                                }
                                item {
                                    val admit = d.admit_card!!
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.5f), shape = RoundedCornerShape(14.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column {
                                            Text(text = "Seat ${admit.seat_number ?: "-"}", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = SunsetOrange)
                                            Text(text = "Room: ${admit.room_name ?: "-"}  •  Bench: ${admit.bench_number ?: "-"}  •  ${admit.seat_position ?: ""}", fontSize = 12.sp, color = TextSecondary)
                                            Text(text = "${admit.student_name ?: ""} • ${admit.class_name ?: ""} • Roll ${admit.roll_no ?: "-"}", fontSize = 12.sp, color = TextSecondary)
                                        }
                                    }
                                }
                            }

                            if (d.result_published == 1 && d.result != null) {
                                item { Spacer(modifier = Modifier.height(4.dp)) }
                                item {
                                    Text(text = "Result — ${d.result?.status ?: "-"}", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = TextSecondary, letterSpacing = 1.sp)
                                }
                                items(d.result!!.papers) { p ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                            .padding(12.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(text = p.subject_name ?: "Subject", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Text(
                                                text = if (p.is_absent == 1) "ABSENT" else "${p.marks_obtained?.toInt() ?: 0} / ${p.max_marks?.toInt() ?: 0}",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = if (p.is_absent == 1) Color(0xFFEF4444) else OnlineGreen
                                            )
                                        }
                                    }
                                }
                                item {
                                    Text(
                                        text = "Total: ${d.result?.total_marks_obtained?.toInt() ?: 0} / ${d.result?.total_max_marks?.toInt() ?: 0}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }
                            } else if (d.scheme_published == 1) {
                                item {
                                    Text(text = "Results not published yet for this exam.", color = TextSecondary, fontSize = 13.sp)
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
private fun StudentReportCardsScreen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var reportCards by remember { mutableStateOf<List<ReportCardDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedCard by remember { mutableStateOf<ReportCardDto?>(null) }

    LaunchedEffect(Unit) {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getStudentReportCards()
                if (response.isSuccessful && response.body() != null) {
                    reportCards = response.body()!!.data
                } else {
                    errorMessage = "Unable to load report cards (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading report cards"
            } finally {
                isLoading = false
            }
        }
    }

    if (selectedCard != null) {
        ReportCardDetailScreen(card = selectedCard!!, onBack = { selectedCard = null })
        return
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "Report Cards", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(
                        text = "QA Server: GET /api/student/exams-new/report-cards",
                        fontSize = 10.5.sp,
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
                        Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                reportCards.isEmpty() -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "No published report cards yet.", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(reportCards) { card ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                    .clickable { selectedCard = card }
                                    .padding(14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(text = card.exam_name ?: "Exam", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text(text = "${card.class_name ?: ""}-${card.class_section ?: ""} • ${card.academic_year_name ?: ""}", fontSize = 12.sp, color = TextSecondary)
                                        Text(text = "Percentage: ${card.percentage ?: 0.0}%  •  Grade: ${card.grade ?: "-"}", fontSize = 12.sp, color = SunsetOrange)
                                    }
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background((if (card.result == "PASS") OnlineGreen else Color(0xFFEF4444)).copy(alpha = 0.2f))
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text(
                                            text = card.result ?: "-",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (card.result == "PASS") OnlineGreen else Color(0xFFEF4444)
                                        )
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
private fun ReportCardDetailScreen(card: ReportCardDto, onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = card.exam_name ?: "Report Card", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(text = card.school_name ?: "", fontSize = 11.sp, color = SunsetOrange)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                            .padding(14.dp)
                    ) {
                        Column {
                            Text(text = card.student_name ?: "", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(text = "Roll ${card.roll_no ?: "-"} • ${card.class_name ?: ""}-${card.class_section ?: ""}", fontSize = 12.sp, color = TextSecondary)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(text = "Class Rank: ${card.class_rank ?: "-"}", fontSize = 12.sp, color = TextSecondary)
                                Text(text = "Section Rank: ${card.section_rank ?: "-"}", fontSize = 12.sp, color = TextSecondary)
                            }
                        }
                    }
                }

                item {
                    Text(text = "SUBJECT-WISE MARKS", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = TextSecondary, letterSpacing = 1.sp)
                }

                items(card.subjects) { subject ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(text = subject.subject_name ?: "Subject", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text(text = "Grade: ${subject.grade ?: "-"}  •  ${subject.result ?: "-"}", fontSize = 11.sp, color = TextSecondary)
                            }
                            Text(
                                text = "${subject.marks_obtained} / ${subject.max_marks}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                    }
                }

                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(SunsetOrange.copy(alpha = 0.15f))
                            .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.5f), shape = RoundedCornerShape(16.dp))
                            .padding(14.dp)
                    ) {
                        Column {
                            Text(text = "Overall: ${card.total_obtained?.toInt() ?: 0} / ${card.total_max?.toInt() ?: 0}  (${card.percentage ?: 0.0}%)", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(text = "Grade: ${card.grade ?: "-"}  •  Result: ${card.result ?: "-"}", fontSize = 13.sp, color = SunsetOrange, fontWeight = FontWeight.Bold)
                            card.attendance?.let { att ->
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = "Attendance: ${att.present_days ?: 0}/${att.working_days ?: 0} days (${att.attendance_rate ?: 0.0}%)", fontSize = 12.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }
        }
    }
}
