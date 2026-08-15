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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Description
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.ExamItemDto
import com.shikshapilot.nativeapp.data.remote.ReportCardDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.features.studentparent.screens.ReportCardDetailScreen
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
 * Backend: GET api/school/exams-new/{id}/report-cards?class_id=... (SchoolAdminController::
 * getReportCards, requires both exam and class). Matches web's admin report-card generation flow
 * (triggered from ExamsPage.jsx/StudentDetailsPage.jsx) minus PDF export/bulk-print — reuses the
 * same ReportCardDetailScreen composable built for the student-side view. Admin picks an exam and
 * a class, sees every student's report card in that class, and can open any one for the full
 * subject-by-subject breakdown.
 */
@Composable
fun SchoolAdminReportCardsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    var exams by remember { mutableStateOf<List<ExamItemDto>>(emptyList()) }
    var classes by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var isLoadingLists by remember { mutableStateOf(true) }

    var selectedExam by remember { mutableStateOf<ExamItemDto?>(null) }
    var selectedClass by remember { mutableStateOf<ClassDto?>(null) }

    var reportCards by remember { mutableStateOf<List<ReportCardDto>>(emptyList()) }
    var isLoadingCards by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }
    var selectedCard by remember { mutableStateOf<ReportCardDto?>(null) }

    LaunchedEffect(Unit) {
        isLoadingLists = true
        try {
            val examsRes = RetrofitClient.apiService.getSchoolExams()
            if (examsRes.isSuccessful && examsRes.body()?.data != null) exams = examsRes.body()!!.data
            val classesRes = RetrofitClient.apiService.getClasses()
            if (classesRes.isSuccessful && classesRes.body()?.data != null) classes = classesRes.body()!!.data
        } catch (_: Exception) {
        } finally {
            isLoadingLists = false
        }
    }

    LaunchedEffect(selectedExam, selectedClass, refreshKey) {
        val exam = selectedExam
        val cls = selectedClass
        if (exam == null || cls == null) {
            reportCards = emptyList()
            return@LaunchedEffect
        }
        isLoadingCards = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getSchoolReportCards(exam.id, cls.id)
            if (response.isSuccessful && response.body() != null) {
                reportCards = response.body()!!.data
            } else {
                errorMessage = "Unable to load report cards (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading report cards"
        } finally {
            isLoadingCards = false
        }
    }

    if (selectedCard != null) {
        ReportCardDetailScreen(card = selectedCard!!, onBack = { selectedCard = null })
        return
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoadingCards, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(text = "Report Cards", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (isLoadingLists) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                        }
                    } else {
                        Text(text = "Exam", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(6.dp))
                        var examExpanded by remember { mutableStateOf(false) }
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                    .clickable { examExpanded = true }
                                    .padding(horizontal = 14.dp, vertical = 14.dp)
                            ) {
                                Text(text = selectedExam?.name ?: "Select an exam", fontSize = 14.sp, color = if (selectedExam != null) TextPrimary else TextSecondary)
                            }
                            DropdownMenu(expanded = examExpanded, onDismissRequest = { examExpanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
                                exams.forEach { exam ->
                                    DropdownMenuItem(text = { Text(exam.name) }, onClick = { selectedExam = exam; examExpanded = false })
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(text = "Class", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(6.dp))
                        var classExpanded by remember { mutableStateOf(false) }
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                    .clickable { classExpanded = true }
                                    .padding(horizontal = 14.dp, vertical = 14.dp)
                            ) {
                                Text(
                                    text = selectedClass?.let { "${it.name}${it.section?.let { s -> " - $s" } ?: ""}" } ?: "Select a class",
                                    fontSize = 14.sp,
                                    color = if (selectedClass != null) TextPrimary else TextSecondary
                                )
                            }
                            DropdownMenu(expanded = classExpanded, onDismissRequest = { classExpanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
                                classes.distinctBy { it.id }.forEach { cls ->
                                    DropdownMenuItem(
                                        text = { Text("${cls.name}${cls.section?.let { s -> " - $s" } ?: ""}") },
                                        onClick = { selectedClass = cls; classExpanded = false }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        when {
                            selectedExam == null || selectedClass == null -> {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) {
                                    Text(text = "Select an exam and a class to view report cards.", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                            isLoadingCards -> {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) {
                                    ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                                }
                            }
                            errorMessage != null -> {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) {
                                    Text(text = errorMessage ?: "", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                            reportCards.isEmpty() -> {
                                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) {
                                    Text(text = "No report cards available for this exam/class yet.", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                            else -> {
                                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
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
                                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(38.dp)
                                                        .clip(CircleShape)
                                                        .background(SunsetOrange.copy(alpha = 0.18f)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(imageVector = Icons.Default.Description, contentDescription = null, tint = SunsetOrange, modifier = Modifier.size(18.dp))
                                                }
                                                Spacer(modifier = Modifier.width(12.dp))
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(text = card.student_name ?: "Student", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                    Text(text = "Roll ${card.roll_no ?: "-"}", fontSize = 11.5.sp, color = TextSecondary)
                                                }
                                                Icon(imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos, contentDescription = "Open", tint = TextSecondary, modifier = Modifier.size(14.dp))
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
