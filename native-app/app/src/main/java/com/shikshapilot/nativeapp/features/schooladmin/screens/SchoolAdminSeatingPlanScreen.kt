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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.ExamItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.RoomConfigDto
import com.shikshapilot.nativeapp.data.remote.SeatingAllocationItemDto
import com.shikshapilot.nativeapp.data.remote.SeatingPlanPreviewDataDto
import com.shikshapilot.nativeapp.data.remote.SeatingPlanRequestDto
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
import kotlinx.coroutines.launch

private data class RoomInput(val name: String, val benchCount: String)

/**
 * Backend: GET api/school/exams-new/{id}/seating-plan, POST .../seating-plan/preview,
 * POST/DELETE .../seating-plan (SchoolAdminController::getSeatingPlan/previewSeatingPlan/
 * generateSeatingPlan/deleteSeatingPlan). Matches web SeatingPlanPage.jsx: pick an exam + classes,
 * configure rooms (name + bench count) and students-per-bench, preview bench availability, then
 * generate. If a plan already exists for the selected exam, its allocations are shown grouped by
 * room/bench instead of the configuration form.
 */
@Composable
fun SchoolAdminSeatingPlanScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var exams by remember { mutableStateOf<List<ExamItemDto>>(emptyList()) }
    var classes by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var isLoadingLists by remember { mutableStateOf(true) }

    var selectedExam by remember { mutableStateOf<ExamItemDto?>(null) }
    var selectedClassIds by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var studentsPerBenchInput by remember { mutableStateOf("2") }
    var rooms by remember { mutableStateOf(listOf(RoomInput("Room 1", "10"))) }

    var existingAllocations by remember { mutableStateOf<List<SeatingAllocationItemDto>>(emptyList()) }
    var isLoadingPlan by remember { mutableStateOf(false) }
    var planRefreshKey by remember { mutableStateOf(0) }

    var previewResult by remember { mutableStateOf<SeatingPlanPreviewDataDto?>(null) }
    var isPreviewing by remember { mutableStateOf(false) }
    var isGenerating by remember { mutableStateOf(false) }
    var isDeleting by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoadingLists = true
        try {
            val examsRes = RetrofitClient.apiService.getSchoolExams()
            if (examsRes.isSuccessful && examsRes.body()?.data != null) {
                exams = examsRes.body()!!.data
            }
            val classesRes = RetrofitClient.apiService.getClasses()
            if (classesRes.isSuccessful && classesRes.body()?.data != null) {
                classes = classesRes.body()!!.data
            }
        } catch (_: Exception) {
        } finally {
            isLoadingLists = false
        }
    }

    LaunchedEffect(selectedExam, planRefreshKey) {
        val examId = selectedExam?.id ?: return@LaunchedEffect
        isLoadingPlan = true
        previewResult = null
        actionError = null
        try {
            val response = RetrofitClient.apiService.getSeatingPlan(examId)
            existingAllocations = if (response.isSuccessful) response.body()?.data?.allocations ?: emptyList() else emptyList()
        } catch (_: Exception) {
            existingAllocations = emptyList()
        } finally {
            isLoadingPlan = false
        }
    }

    fun buildRequest(): SeatingPlanRequestDto? {
        val benchDefault = studentsPerBenchInput.toIntOrNull()
        if (selectedClassIds.isEmpty()) {
            actionError = "Select at least one class."
            return null
        }
        if (benchDefault == null || benchDefault <= 0) {
            actionError = "Enter a valid students-per-bench value."
            return null
        }
        val roomConfigs = rooms.mapNotNull { r ->
            val count = r.benchCount.toIntOrNull()
            if (r.name.isBlank() || count == null || count <= 0) null else RoomConfigDto(r.name.trim(), count)
        }
        if (roomConfigs.isEmpty()) {
            actionError = "Configure at least one valid room."
            return null
        }
        actionError = null
        return SeatingPlanRequestDto(
            classes = selectedClassIds.toList(),
            students_per_bench = benchDefault,
            room_configs = roomConfigs
        )
    }

    fun doPreview() {
        val examId = selectedExam?.id ?: run { actionError = "Select an exam first."; return }
        val request = buildRequest() ?: return
        isPreviewing = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.previewSeatingPlan(examId, request)
                if (response.isSuccessful && response.body()?.data != null) {
                    previewResult = response.body()!!.data
                } else {
                    actionError = "Preview failed (code ${response.code()})"
                }
            } catch (e: Exception) {
                actionError = e.message ?: "Network error during preview"
            } finally {
                isPreviewing = false
            }
        }
    }

    fun doGenerate() {
        val examId = selectedExam?.id ?: run { actionError = "Select an exam first."; return }
        val request = buildRequest() ?: return
        isGenerating = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.generateSeatingPlan(examId, request)
                if (response.isSuccessful) {
                    Toast.makeText(context, "Seating plan generated", Toast.LENGTH_SHORT).show()
                    previewResult = null
                    planRefreshKey++
                } else {
                    actionError = "Generate failed (code ${response.code()})"
                }
            } catch (e: Exception) {
                actionError = e.message ?: "Network error during generation"
            } finally {
                isGenerating = false
            }
        }
    }

    fun doDeletePlan() {
        val examId = selectedExam?.id ?: return
        isDeleting = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.deleteSeatingPlanForExam(examId)
                if (response.isSuccessful) {
                    Toast.makeText(context, "Seating plan deleted", Toast.LENGTH_SHORT).show()
                    planRefreshKey++
                } else {
                    Toast.makeText(context, "Failed to delete (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isDeleting = false
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
            PullToRefreshWrapper(isRefreshing = isLoadingLists || isLoadingPlan, onRefresh = { planRefreshKey++ }) {
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
                        Text(text = "Seating Plan", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (isLoadingLists) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                        }
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxSize()) {
                            item {
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
                            }

                            if (selectedExam != null && isLoadingPlan) {
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp), contentAlignment = Alignment.Center) {
                                        ThreeDotsLoader(dotSize = 8.dp, dotColor = SunsetOrange, spaceBetween = 6.dp, travelDistance = 6.dp)
                                    }
                                }
                            } else if (selectedExam != null && existingAllocations.isNotEmpty()) {
                                item {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text(text = "${existingAllocations.size} students seated", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                                        TextButton(onClick = { doDeletePlan() }, enabled = !isDeleting) {
                                            Text(if (isDeleting) "Deleting..." else "Delete Plan", color = Color(0xFFEF4444))
                                        }
                                    }
                                }
                                items(existingAllocations.groupBy { it.room_name ?: "Unassigned" }.entries.toList()) { (room, seats) ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column {
                                            Text(text = room, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            seats.sortedWith(compareBy({ it.bench_number ?: 0 }, { it.seat_position ?: "" })).forEach { seat ->
                                                Text(
                                                    text = "Bench ${seat.bench_number ?: "-"}${seat.seat_position?.let { " ($it)" } ?: ""}: ${seat.student_name ?: "—"} (${seat.class_name ?: ""}, Roll ${seat.roll_no ?: "-"})",
                                                    fontSize = 11.5.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                        }
                                    }
                                }
                            } else if (selectedExam != null) {
                                item {
                                    Text(text = "Select Classes", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(max = 200.dp)
                                    ) {
                                        classes.distinctBy { it.id }.forEach { cls ->
                                            val isSelected = selectedClassIds.contains(cls.id)
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clickable {
                                                        selectedClassIds = if (isSelected) selectedClassIds - cls.id else selectedClassIds + cls.id
                                                    }
                                                    .padding(vertical = 6.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "${cls.name}${cls.section?.let { " - $it" } ?: ""}",
                                                    fontSize = 12.5.sp,
                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                    color = if (isSelected) SunsetOrange else TextPrimary
                                                )
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(14.dp))

                                    Text(text = "Students Per Bench", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedTextField(
                                        value = studentsPerBenchInput,
                                        onValueChange = { studentsPerBenchInput = it },
                                        modifier = Modifier.fillMaxWidth(),
                                        singleLine = true,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedContainerColor = FrostedCard,
                                            unfocusedContainerColor = FrostedCard,
                                            focusedBorderColor = SunsetOrange,
                                            unfocusedBorderColor = CardBorder,
                                            focusedTextColor = TextPrimary,
                                            unfocusedTextColor = TextPrimary
                                        )
                                    )

                                    Spacer(modifier = Modifier.height(14.dp))

                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text(text = "Rooms", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                                        Text(
                                            text = "+ Add Room",
                                            fontSize = 11.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = SunsetOrange,
                                            modifier = Modifier.clickable { rooms = rooms + RoomInput("Room ${rooms.size + 1}", "10") }
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    rooms.forEachIndexed { index, room ->
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            OutlinedTextField(
                                                value = room.name,
                                                onValueChange = { newName ->
                                                    rooms = rooms.toMutableList().also { it[index] = it[index].copy(name = newName) }
                                                },
                                                modifier = Modifier.weight(1f),
                                                singleLine = true,
                                                placeholder = { Text("Room name") },
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedContainerColor = FrostedCard,
                                                    unfocusedContainerColor = FrostedCard,
                                                    focusedBorderColor = SunsetOrange,
                                                    unfocusedBorderColor = CardBorder,
                                                    focusedTextColor = TextPrimary,
                                                    unfocusedTextColor = TextPrimary
                                                )
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            OutlinedTextField(
                                                value = room.benchCount,
                                                onValueChange = { newCount ->
                                                    rooms = rooms.toMutableList().also { it[index] = it[index].copy(benchCount = newCount) }
                                                },
                                                modifier = Modifier.width(80.dp),
                                                singleLine = true,
                                                placeholder = { Text("Benches") },
                                                colors = OutlinedTextFieldDefaults.colors(
                                                    focusedContainerColor = FrostedCard,
                                                    unfocusedContainerColor = FrostedCard,
                                                    focusedBorderColor = SunsetOrange,
                                                    unfocusedBorderColor = CardBorder,
                                                    focusedTextColor = TextPrimary,
                                                    unfocusedTextColor = TextPrimary
                                                )
                                            )
                                            if (rooms.size > 1) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Icon(
                                                    imageVector = Icons.Default.Close,
                                                    contentDescription = "Remove",
                                                    tint = TextSecondary,
                                                    modifier = Modifier
                                                        .size(20.dp)
                                                        .clickable { rooms = rooms.toMutableList().also { it.removeAt(index) } }
                                                )
                                            }
                                        }
                                    }

                                    if (previewResult != null) {
                                        val p = previewResult!!
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(if (p.enough_benches) OnlineGreen.copy(alpha = 0.12f) else Color(0xFFEF4444).copy(alpha = 0.12f))
                                                .border(width = 1.dp, color = if (p.enough_benches) OnlineGreen else Color(0xFFEF4444), shape = RoundedCornerShape(14.dp))
                                                .padding(12.dp)
                                        ) {
                                            Column {
                                                Text(
                                                    text = if (p.enough_benches) "Enough benches available" else "Not enough benches",
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (p.enough_benches) OnlineGreen else Color(0xFFEF4444)
                                                )
                                                Text(text = "${p.total_students} students • ${p.required_benches} required • ${p.available_benches} available", fontSize = 11.5.sp, color = TextSecondary)
                                            }
                                        }
                                    }

                                    if (actionError != null) {
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Text(text = actionError ?: "", fontSize = 11.5.sp, color = Color(0xFFEF4444))
                                    }

                                    Spacer(modifier = Modifier.height(14.dp))

                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Button(
                                            onClick = { doPreview() },
                                            enabled = !isPreviewing && !isGenerating,
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = FrostedCard, contentColor = TextPrimary)
                                        ) {
                                            if (isPreviewing) {
                                                ThreeDotsLoader(dotSize = 6.dp, dotColor = TextPrimary, spaceBetween = 4.dp, travelDistance = 4.dp)
                                            } else {
                                                Text("Preview", fontWeight = FontWeight.Bold)
                                            }
                                        }
                                        Button(
                                            onClick = { doGenerate() },
                                            enabled = !isPreviewing && !isGenerating,
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                                        ) {
                                            if (isGenerating) {
                                                ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                                            } else {
                                                Text("Generate", fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            } else {
                                item {
                                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                                        Text(text = "Select an exam to configure its seating plan.", color = TextSecondary, fontSize = 13.sp)
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
