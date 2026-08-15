package com.shikshapilot.nativeapp.features.teacher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SaveMarkItemDto
import com.shikshapilot.nativeapp.data.remote.SaveMarksSheetRequestDto
import com.shikshapilot.nativeapp.data.remote.TeacherMarksSheetDto
import com.shikshapilot.nativeapp.data.remote.TeacherMarksSheetStudentDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Marks entry for a single subject/paper of a published exam, for the class teacher's own class.
 * Backed by GET/POST /api/teacher/exams-new/{id}/marks-sheet?subject_id=... (see TeacherService::getMarksSheet
 * / saveMarksSheet). Body shape on save: { subject_id, marks: [{ student_id, marks_obtained, is_absent, remarks }] }.
 */
@Composable
fun TeacherMarksEntryScreen(
    examId: Int,
    subjectId: Int,
    subjectName: String,
    onBack: () -> Unit,
    onSaved: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var sheet by remember { mutableStateOf<TeacherMarksSheetDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    var toastMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    // Per-student editable state, keyed by student_id
    val marksState = remember { mutableStateMapOf<Int, String>() }
    val absentState = remember { mutableStateMapOf<Int, Boolean>() }
    val remarksState = remember { mutableStateMapOf<Int, String>() }

    fun loadSheet() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getTeacherMarksSheet(examId, subjectId)
                if (response.isSuccessful && response.body()?.data != null) {
                    val data = response.body()!!.data!!
                    sheet = data
                    data.students.forEach { s ->
                        marksState[s.student_id] = when (val m = s.marks_obtained) {
                            null -> ""
                            is Double -> if (m == m.toLong().toDouble()) m.toLong().toString() else m.toString()
                            else -> m.toString()
                        }
                        absentState[s.student_id] = (s.is_absent ?: 0) == 1
                        remarksState[s.student_id] = s.remarks ?: ""
                    }
                } else {
                    errorMessage = "Unable to load marks sheet (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading marks sheet"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(examId, subjectId, refreshKey) { loadSheet() }

    if (toastMessage != null) {
        LaunchedEffect(toastMessage) {
            kotlinx.coroutines.delay(2200)
            toastMessage = null
        }
    }

    fun saveMarks() {
        val current = sheet ?: return
        scope.launch {
            isSaving = true
            try {
                val items = current.students.map { s ->
                    SaveMarkItemDto(
                        student_id = s.student_id,
                        marks_obtained = marksState[s.student_id]?.trim()?.ifBlank { null },
                        is_absent = if (absentState[s.student_id] == true) 1 else 0,
                        remarks = remarksState[s.student_id]?.ifBlank { null }
                    )
                }
                val response = RetrofitClient.apiService.saveTeacherMarksSheet(
                    examId,
                    SaveMarksSheetRequestDto(subject_id = subjectId, marks = items)
                )
                if (response.isSuccessful) {
                    toastMessage = "Marks saved successfully!"
                    onSaved()
                } else {
                    toastMessage = "Unable to save marks (code ${response.code()})"
                }
            } catch (e: Exception) {
                toastMessage = e.message ?: "Network error while saving marks"
            } finally {
                isSaving = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
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
                    Text(text = "Marks Entry: $subjectName", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(
                        text = "QA Server: GET/POST /api/teacher/exams-new/{id}/marks-sheet",
                        fontSize = 10.sp,
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
                sheet == null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "No data available", color = TextSecondary, fontSize = 13.sp)
                    }
                }
                else -> {
                    val currentSheet = sheet!!
                    val isGrade = currentSheet.evaluation_type == "grade"
                    val isLocked = currentSheet.is_result_published == true

                    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(text = "${currentSheet.exam_name ?: "Exam"} • ${currentSheet.class_name ?: ""}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text(
                                    text = if (isGrade) "Evaluation: Grade" else "Max Marks: ${currentSheet.max_marks?.toInt() ?: 0}  •  Passing: ${currentSheet.passing_marks?.toInt() ?: 0}",
                                    fontSize = 11.5.sp,
                                    color = TextSecondary
                                )
                                if (isLocked) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(text = "Report card published — marks are locked.", fontSize = 11.sp, color = WarningYellow, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        if (currentSheet.students.isEmpty()) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No students found in this class.", color = TextSecondary, fontSize = 13.sp)
                            }
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                items(currentSheet.students, key = { it.student_id }) { student ->
                                    StudentMarkRow(
                                        student = student,
                                        isGrade = isGrade,
                                        availableGrades = currentSheet.available_grades,
                                        isLocked = isLocked,
                                        marksValue = marksState[student.student_id] ?: "",
                                        onMarksChange = { marksState[student.student_id] = it },
                                        isAbsent = absentState[student.student_id] ?: false,
                                        onAbsentChange = { absentState[student.student_id] = it },
                                        remarksValue = remarksState[student.student_id] ?: "",
                                        onRemarksChange = { remarksState[student.student_id] = it }
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            Button(
                                onClick = { saveMarks() },
                                enabled = !isSaving && !isLocked,
                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(if (isSaving) "Saving..." else "Save Marks", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        }

        toastMessage?.let { msg ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(OnlineGreen)
                    .padding(14.dp)
            ) {
                Text(msg, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun StudentMarkRow(
    student: TeacherMarksSheetStudentDto,
    isGrade: Boolean,
    availableGrades: List<String>,
    isLocked: Boolean,
    marksValue: String,
    onMarksChange: (String) -> Unit,
    isAbsent: Boolean,
    onAbsentChange: (Boolean) -> Unit,
    remarksValue: String,
    onRemarksChange: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
            .padding(12.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = student.student_name ?: "Student", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(text = "Roll ${student.roll_no ?: "-"}", fontSize = 11.sp, color = TextSecondary)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "Absent", fontSize = 11.sp, color = TextSecondary)
                    Checkbox(
                        checked = isAbsent,
                        onCheckedChange = onAbsentChange,
                        enabled = !isLocked,
                        colors = CheckboxDefaults.colors(checkedColor = SunsetOrange)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            if (!isAbsent) {
                if (isGrade) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        availableGrades.forEach { grade ->
                            val selected = marksValue == grade
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (selected) SunsetOrange else DarkCanvas)
                                    .border(width = 1.dp, color = if (selected) SunsetOrange else CardBorder, shape = RoundedCornerShape(8.dp))
                                    .then(
                                        if (!isLocked) Modifier.clickable { onMarksChange(grade) } else Modifier
                                    )
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(text = grade, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (selected) Color.White else TextPrimary)
                            }
                        }
                    }
                } else {
                    OutlinedTextField(
                        value = marksValue,
                        onValueChange = { v -> if (v.all { it.isDigit() || it == '.' }) onMarksChange(v) },
                        label = { Text("Marks Obtained", color = TextSecondary, fontSize = 11.sp) },
                        singleLine = true,
                        enabled = !isLocked,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))
            }

            OutlinedTextField(
                value = remarksValue,
                onValueChange = onRemarksChange,
                label = { Text("Remarks (optional)", color = TextSecondary, fontSize = 11.sp) },
                singleLine = true,
                enabled = !isLocked,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
            )
        }
    }
}
