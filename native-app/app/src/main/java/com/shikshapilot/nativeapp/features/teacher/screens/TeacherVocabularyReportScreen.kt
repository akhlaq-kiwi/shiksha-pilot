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
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TeacherVocabReportDataDto
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Read-only teacher vocabulary report — GET /api/teacher/vocabulary/report?class_id=
 * (VocabularyService::getTeacherReport). Requires a class_id; a simple text field lets the
 * teacher enter their class id since the native app doesn't yet have a shared class picker
 * component (see TeacherClassesScreen for the raw class list if one is needed later).
 */
@Composable
fun TeacherVocabularyReportScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var classIdInput by remember { mutableStateOf("") }
    var report by remember { mutableStateOf<TeacherVocabReportDataDto?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun load() {
        val classId = classIdInput.toIntOrNull()
        if (classId == null) {
            errorMessage = "Enter a valid class id"
            return
        }
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getTeacherVocabularyReport(classId)
                if (response.isSuccessful && response.body() != null) {
                    report = response.body()!!.data
                } else {
                    errorMessage = "Unable to load report (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading report"
            } finally {
                isLoading = false
            }
        }
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
                    unreadNotificationCount = 0,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
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
                        Column {
                            Text(text = "Vocabulary Report", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "QA Server: GET /api/teacher/vocabulary/report", fontSize = 11.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = classIdInput,
                            onValueChange = { classIdInput = it.filter { c -> c.isDigit() } },
                            label = { Text("Class ID") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Button(
                            onClick = { load() },
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                        ) {
                            Text(text = "Load", color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    when {
                        isLoading -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        report == null -> {
                            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Text(text = "Enter a class id and tap Load to view the vocabulary report.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            val r = report!!
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                item {
                                    Text(text = r.class_name ?: "Class", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                                item {
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp)).padding(12.dp)
                                    ) {
                                        Column {
                                            Text(text = "Average Accuracy: ${r.summary?.average_accuracy ?: 0.0}%", fontSize = 13.sp, color = TextPrimary)
                                            Text(text = "Average Stage: ${r.summary?.average_stage ?: 0.0}", fontSize = 13.sp, color = TextPrimary)
                                            Text(text = "Words Learned: ${r.summary?.total_words_learned ?: 0}", fontSize = 13.sp, color = TextPrimary)
                                            Text(text = "Words Mastered: ${r.summary?.total_words_mastered ?: 0}", fontSize = 13.sp, color = TextPrimary)
                                        }
                                    }
                                }
                                item { Text(text = "WEAK CATEGORIES", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary) }
                                items(r.weak_categories) { cat ->
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)).padding(10.dp)
                                    ) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(text = cat.category ?: "-", fontSize = 12.5.sp, color = TextPrimary)
                                            Text(text = "✓${cat.correct ?: 0}  ✗${cat.wrong ?: 0}", fontSize = 12.5.sp, color = TextSecondary)
                                        }
                                    }
                                }
                                item { Text(text = "DIFFICULT WORDS", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary) }
                                items(r.difficult_words) { w ->
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)).padding(10.dp)
                                    ) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(text = w.word ?: "-", fontSize = 12.5.sp, color = TextPrimary)
                                            Text(text = "${w.total_wrongs ?: 0} wrong attempts", fontSize = 12.sp, color = TextSecondary)
                                        }
                                    }
                                }
                                item { Text(text = "MOST ACTIVE STUDENTS", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary) }
                                items(r.active_students) { s ->
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)).padding(10.dp)
                                    ) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(text = "${s.first_name ?: ""} ${s.last_name ?: ""}".trim(), fontSize = 12.5.sp, color = TextPrimary)
                                            Text(text = "${s.score ?: 0} pts • ${s.total_words_learned ?: 0} words", fontSize = 12.sp, color = TextSecondary)
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
