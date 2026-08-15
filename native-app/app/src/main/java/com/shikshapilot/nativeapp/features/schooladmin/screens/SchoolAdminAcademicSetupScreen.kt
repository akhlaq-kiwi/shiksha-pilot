package com.shikshapilot.nativeapp.features.schooladmin.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Grade
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import com.shikshapilot.nativeapp.data.remote.AcademicYearItemDto
import com.shikshapilot.nativeapp.data.remote.CreateAcademicYearRequestDto
import com.shikshapilot.nativeapp.data.remote.GradeConfigItemDto
import com.shikshapilot.nativeapp.data.remote.HolidayItemDto
import com.shikshapilot.nativeapp.data.remote.HolidayRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SubjectItemDto
import com.shikshapilot.nativeapp.data.remote.SubjectRequestDto
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

/**
 * Backend contracts (SchoolAdminService.php):
 * - academic-years: GET/POST api/school/academic-years, POST .../{id}/activate, .../{id}/migrate.
 *   `name` must match `YYYY-YYYY` (or en/em dash) spanning exactly one year; dates default to
 *   Apr 1 - Mar 31 when omitted. Activate requires prior year's migration_status == 'Completed' if
 *   promoting a Draft year (full migration flow is web-only complexity, deferred — activate here
 *   simply calls the endpoint and surfaces the validation error if migration is required first).
 * - holidays: GET/POST/PUT/DELETE api/school/holidays(/{id}) — `name` + `date` (YYYY-MM-DD), scoped
 *   to the current working academic year; backend auto-seeds 6 national holidays on first read.
 * - subjects: GET/POST/PUT/DELETE api/school/subjects(/{id}) — only `name` field; no class/teacher
 *   assignment via this endpoint (class_id/teacher_id are always NULL on create/update here).
 * - grade-configurations: GET api/school/grade-configurations — view-only in native (POST
 *   api/school/grade-configurations replaces the entire scale list; editing UI deferred, see
 *   PARITY_GAPS.md — this is back-office setup rarely touched after initial config).
 */
@Composable
fun SchoolAdminAcademicSetupScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableStateOf(0) } // 0=Years 1=Holidays 2=Subjects 3=Grades
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    var academicYears by remember { mutableStateOf<List<AcademicYearItemDto>>(emptyList()) }
    var holidays by remember { mutableStateOf<List<HolidayItemDto>>(emptyList()) }
    var subjects by remember { mutableStateOf<List<SubjectItemDto>>(emptyList()) }
    var gradeConfigs by remember { mutableStateOf<List<GradeConfigItemDto>>(emptyList()) }

    var showAddYearDialog by remember { mutableStateOf(false) }
    var showAddHolidayDialog by remember { mutableStateOf(false) }
    var showAddSubjectDialog by remember { mutableStateOf(false) }

    LaunchedEffect(activeTab, reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            when (activeTab) {
                0 -> {
                    val r = RetrofitClient.apiService.getAcademicYears()
                    if (r.isSuccessful) academicYears = r.body()?.data ?: emptyList()
                    else errorMessage = "Unable to load academic years (code ${r.code()})"
                }
                1 -> {
                    val r = RetrofitClient.apiService.getHolidays()
                    if (r.isSuccessful) holidays = r.body()?.data ?: emptyList()
                    else errorMessage = "Unable to load holidays (code ${r.code()})"
                }
                2 -> {
                    val r = RetrofitClient.apiService.getSubjects()
                    if (r.isSuccessful) subjects = r.body()?.data ?: emptyList()
                    else errorMessage = "Unable to load subjects (code ${r.code()})"
                }
                else -> {
                    val r = RetrofitClient.apiService.getGradeConfigurations()
                    if (r.isSuccessful) gradeConfigs = r.body()?.data ?: emptyList()
                    else errorMessage = "Unable to load grade configurations (code ${r.code()})"
                }
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error"
        } finally {
            isLoading = false
        }
    }

    fun toast(msg: String) = Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { reloadKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

                Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
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
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = "Academic Setup", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "Years, holidays, subjects & grading", fontSize = 11.5.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("Academic Years" to 0, "Holidays" to 1, "Subjects" to 2, "Grades" to 3).forEach { (label, idx) ->
                            val selected = activeTab == idx
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) SunsetOrange else FrostedCard)
                                    .border(width = 1.dp, color = if (selected) SunsetOrange else CardBorder, shape = RoundedCornerShape(10.dp))
                                    .clickable { activeTab = idx }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Text(text = label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (selected) Color.White else TextSecondary)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        val addLabel = when (activeTab) { 0 -> "+ Add Year"; 1 -> "+ Add Holiday"; 2 -> "+ Add Subject"; else -> null }
                        if (addLabel != null) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(OnlineGreen.copy(alpha = 0.18f))
                                    .clickable {
                                        when (activeTab) {
                                            0 -> showAddYearDialog = true
                                            1 -> showAddHolidayDialog = true
                                            2 -> showAddSubjectDialog = true
                                        }
                                    }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                            ) {
                                Text(text = addLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

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
                        activeTab == 0 -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(academicYears) { year ->
                                    AcademicYearCard(year, onActivate = {
                                        scope.launch {
                                            try {
                                                val r = RetrofitClient.apiService.activateAcademicYear(year.id)
                                                if (r.isSuccessful) { toast("Academic year activated"); reloadKey++ }
                                                else toast("Failed to activate (code ${r.code()})")
                                            } catch (e: Exception) { toast(e.message ?: "Network error") }
                                        }
                                    })
                                }
                            }
                        }
                        activeTab == 1 -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(holidays) { holiday ->
                                    HolidayCard(holiday, onDelete = {
                                        scope.launch {
                                            try {
                                                val r = RetrofitClient.apiService.deleteHoliday(holiday.id)
                                                if (r.isSuccessful) { toast("Holiday deleted"); reloadKey++ }
                                                else toast("Failed to delete (code ${r.code()})")
                                            } catch (e: Exception) { toast(e.message ?: "Network error") }
                                        }
                                    })
                                }
                            }
                        }
                        activeTab == 2 -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(subjects) { subject ->
                                    SubjectCard(subject, onDelete = {
                                        scope.launch {
                                            try {
                                                val r = RetrofitClient.apiService.deleteSubject(subject.id)
                                                if (r.isSuccessful) { toast("Subject deleted"); reloadKey++ }
                                                else toast("Failed to delete (code ${r.code()})")
                                            } catch (e: Exception) { toast(e.message ?: "Network error") }
                                        }
                                    })
                                }
                            }
                        }
                        else -> {
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                items(gradeConfigs) { grade -> GradeConfigCard(grade) }
                            }
                        }
                    }
                }
            }
            }
        }
    }

    if (showAddYearDialog) {
        var nameInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddYearDialog = false },
            title = { Text("Add Academic Year") },
            text = {
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    label = { Text("Name (e.g. 2027-2028)") },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Text(
                    text = "Add",
                    color = SunsetOrange,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .padding(12.dp)
                        .clickable {
                            showAddYearDialog = false
                            scope.launch {
                                try {
                                    val r = RetrofitClient.apiService.createAcademicYear(CreateAcademicYearRequestDto(name = nameInput))
                                    if (r.isSuccessful) { toast("Academic year created as Draft"); reloadKey++ }
                                    else toast("Failed (code ${r.code()})")
                                } catch (e: Exception) { toast(e.message ?: "Network error") }
                            }
                        }
                )
            },
            dismissButton = {
                Text(text = "Cancel", color = TextSecondary, modifier = Modifier.padding(12.dp).clickable { showAddYearDialog = false })
            }
        )
    }

    if (showAddHolidayDialog) {
        var nameInput by remember { mutableStateOf("") }
        var dateInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddHolidayDialog = false },
            title = { Text("Add Holiday") },
            text = {
                Column {
                    OutlinedTextField(value = nameInput, onValueChange = { nameInput = it }, label = { Text("Holiday name") }, modifier = Modifier.fillMaxWidth())
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(value = dateInput, onValueChange = { dateInput = it }, label = { Text("Date (YYYY-MM-DD)") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Text(
                    text = "Add",
                    color = SunsetOrange,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .padding(12.dp)
                        .clickable {
                            showAddHolidayDialog = false
                            scope.launch {
                                try {
                                    val r = RetrofitClient.apiService.createHoliday(HolidayRequestDto(name = nameInput, date = dateInput))
                                    if (r.isSuccessful) { toast("Holiday added"); reloadKey++ }
                                    else toast("Failed (code ${r.code()})")
                                } catch (e: Exception) { toast(e.message ?: "Network error") }
                            }
                        }
                )
            },
            dismissButton = {
                Text(text = "Cancel", color = TextSecondary, modifier = Modifier.padding(12.dp).clickable { showAddHolidayDialog = false })
            }
        )
    }

    if (showAddSubjectDialog) {
        var nameInput by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddSubjectDialog = false },
            title = { Text("Add Subject") },
            text = {
                OutlinedTextField(value = nameInput, onValueChange = { nameInput = it }, label = { Text("Subject name") }, modifier = Modifier.fillMaxWidth())
            },
            confirmButton = {
                Text(
                    text = "Add",
                    color = SunsetOrange,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .padding(12.dp)
                        .clickable {
                            showAddSubjectDialog = false
                            scope.launch {
                                try {
                                    val r = RetrofitClient.apiService.createSubject(SubjectRequestDto(name = nameInput))
                                    if (r.isSuccessful) { toast("Subject added"); reloadKey++ }
                                    else toast("Failed (code ${r.code()})")
                                } catch (e: Exception) { toast(e.message ?: "Network error") }
                            }
                        }
                )
            },
            dismissButton = {
                Text(text = "Cancel", color = TextSecondary, modifier = Modifier.padding(12.dp).clickable { showAddSubjectDialog = false })
            }
        )
    }
}

@Composable
private fun AcademicYearCard(year: AcademicYearItemDto, onActivate: () -> Unit) {
    val isCurrent = year.is_current == 1
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(38.dp).clip(CircleShape).background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.CalendarMonth, contentDescription = "Year", tint = SunsetOrange, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = year.name ?: "Academic Year", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(text = "${year.start_date ?: ""} to ${year.end_date ?: ""}", fontSize = 11.sp, color = TextSecondary)
                Text(text = year.status ?: "", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (isCurrent) OnlineGreen else SunsetOrange)
            }
            if (isCurrent) {
                Box(modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(OnlineGreen.copy(alpha = 0.18f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text(text = "Active", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                }
            } else {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(SunsetOrange)
                        .clickable { onActivate() }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text(text = "Activate", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun HolidayCard(holiday: HolidayItemDto, onDelete: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = holiday.name ?: "Holiday", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(text = holiday.date ?: "", fontSize = 12.sp, color = TextSecondary)
            }
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Delete",
                tint = Color(0xFFEF4444),
                modifier = Modifier.size(20.dp).clickable { onDelete() }
            )
        }
    }
}

@Composable
private fun SubjectCard(subject: SubjectItemDto, onDelete: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(34.dp).clip(CircleShape).background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.MenuBook, contentDescription = "Subject", tint = SunsetOrange, modifier = Modifier.size(16.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = subject.name ?: "Subject", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                if (!subject.teacher_name.isNullOrBlank()) {
                    Text(text = "Teacher: ${subject.teacher_name}", fontSize = 11.sp, color = TextSecondary)
                }
            }
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Delete",
                tint = Color(0xFFEF4444),
                modifier = Modifier.size(20.dp).clickable { onDelete() }
            )
        }
    }
}

@Composable
private fun GradeConfigCard(grade: GradeConfigItemDto) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(34.dp).clip(CircleShape).background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.Grade, contentDescription = "Grade", tint = SunsetOrange, modifier = Modifier.size(16.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Grade ${grade.grade ?: ""} • ${grade.remark ?: ""}", fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(text = "${grade.min_percentage}% - ${grade.max_percentage}%  (GP ${grade.grade_point ?: 0.0})", fontSize = 11.5.sp, color = TextSecondary)
            }
        }
    }
}
