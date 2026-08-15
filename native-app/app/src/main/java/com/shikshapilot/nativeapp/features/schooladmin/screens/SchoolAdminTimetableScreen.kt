package com.shikshapilot.nativeapp.features.schooladmin.screens

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
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.PublishTimetableRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TimetableDayScheduleDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

private val WEEK_DAYS = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

/**
 * Backend: GET /api/school/timetable?class_id=&date= (SchoolAdminService::getTimetable). When
 * both class_id and date are supplied it returns an object keyed by day name -> {date, day,
 * periods[]}, scoped to that single class. Without a date, class_id is ignored server-side and
 * the whole school's flat, ungrouped timetable is returned instead — so this screen always sends
 * today's date alongside the selected class_id to get a single-class weekly view.
 * Publish: POST /api/school/timetable/publish { class_id, date? } (SchoolAdminService::publishTimetable).
 */
private fun parseDaySchedule(data: JsonElement?): Map<String, TimetableDayScheduleDto> {
    if (data == null || data.isJsonNull || !data.isJsonObject) return emptyMap()
    val gson = Gson()
    val result = linkedMapOf<String, TimetableDayScheduleDto>()
    val obj = data.asJsonObject
    for (day in WEEK_DAYS) {
        val dayElement = obj.get(day) ?: continue
        try {
            result[day] = gson.fromJson(dayElement, TimetableDayScheduleDto::class.java)
        } catch (e: Exception) {
            // skip malformed day entry
        }
    }
    return result
}

@Composable
fun SchoolAdminTimetableScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()

    var classes by remember { mutableStateOf<List<ClassDto>>(emptyList()) }
    var selectedClass by remember { mutableStateOf<ClassDto?>(null) }
    var schedule by remember { mutableStateOf<Map<String, TimetableDayScheduleDto>>(emptyMap()) }

    var isLoadingClasses by remember { mutableStateOf(true) }
    var isLoadingTimetable by remember { mutableStateOf(false) }
    var isPublishing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var publishMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    val todayDate = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(java.util.Date())
    }

    LaunchedEffect(refreshKey) {
        isLoadingClasses = true
        try {
            val response = RetrofitClient.apiService.getClasses()
            if (response.isSuccessful && response.body() != null) {
                classes = response.body()!!.data
                selectedClass = classes.firstOrNull()
            } else {
                errorMessage = "Unable to load classes (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading classes"
        } finally {
            isLoadingClasses = false
        }
    }

    LaunchedEffect(selectedClass, refreshKey) {
        val cls = selectedClass ?: return@LaunchedEffect
        isLoadingTimetable = true
        errorMessage = null
        publishMessage = null
        try {
            val response = RetrofitClient.apiService.getTimetable(classId = cls.id, date = todayDate)
            if (response.isSuccessful && response.body() != null) {
                schedule = parseDaySchedule(response.body()!!.data)
            } else {
                errorMessage = "Unable to load timetable (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading timetable"
        } finally {
            isLoadingTimetable = false
        }
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoadingClasses || isLoadingTimetable, onRefresh = { refreshKey++ }) {
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
                                text = "Timetable",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "View & Publish (QA Live API)",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        val cls = selectedClass
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isPublishing || cls == null) CardBorder else OnlineGreen)
                                .clickable(enabled = !isPublishing && cls != null) {
                                    if (cls == null) return@clickable
                                    scope.launch {
                                        isPublishing = true
                                        publishMessage = null
                                        errorMessage = null
                                        try {
                                            val response = RetrofitClient.apiService.publishTimetable(
                                                PublishTimetableRequestDto(class_id = cls.id, date = todayDate)
                                            )
                                            publishMessage = if (response.isSuccessful) {
                                                "Timetable published for Class ${cls.name}${cls.section?.let { "-$it" } ?: ""}"
                                            } else {
                                                errorMessage = "Publish failed (code ${response.code()})"
                                                null
                                            }
                                        } catch (e: Exception) {
                                            errorMessage = e.message ?: "Network error while publishing"
                                        } finally {
                                            isPublishing = false
                                        }
                                    }
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (isPublishing) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(14.dp),
                                        color = Color.White,
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.CloudUpload,
                                        contentDescription = "Publish",
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Publish",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (isLoadingClasses) {
                        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            ThreeDotsLoader(dotSize = 8.dp, dotColor = SunsetOrange, spaceBetween = 6.dp, travelDistance = 6.dp)
                        }
                    } else if (classes.isEmpty()) {
                        Text(text = "No classes have been set up yet.", color = TextSecondary, fontSize = 13.sp)
                    } else {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            classes.forEach { cls ->
                                val isSelected = selectedClass?.id == cls.id
                                val label = "${cls.name}${cls.section?.let { "-$it" } ?: ""}"
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(if (isSelected) SunsetOrange else FrostedCard)
                                        .border(
                                            width = 1.dp,
                                            color = if (isSelected) SunsetOrange else CardBorder,
                                            shape = RoundedCornerShape(20.dp)
                                        )
                                        .clickable { selectedClass = cls }
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color.White else TextPrimary
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (publishMessage != null) {
                        Text(
                            text = publishMessage ?: "",
                            color = OnlineGreen,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                    }

                    when {
                        isLoadingTimetable -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                            }
                        }
                        errorMessage != null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        schedule.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No timetable periods found for this class.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(WEEK_DAYS.filter { schedule.containsKey(it) }) { day ->
                                    val daySchedule = schedule[day]
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Text(
                                            text = "${day.uppercase()}${daySchedule?.date?.let { " • $it" } ?: ""}",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = TextSecondary,
                                            letterSpacing = 1.sp
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))

                                        val periods = daySchedule?.periods.orEmpty().sortedBy { it.period_number ?: 0 }
                                        if (periods.isEmpty()) {
                                            Text(text = "No periods scheduled", color = TextSecondary, fontSize = 12.sp)
                                        } else {
                                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                                periods.forEach { item ->
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
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Box(
                                                                modifier = Modifier
                                                                    .size(36.dp)
                                                                    .clip(CircleShape)
                                                                    .background(InfoBlue.copy(alpha = 0.18f)),
                                                                contentAlignment = Alignment.Center
                                                            ) {
                                                                Text(
                                                                    text = "${item.period_number ?: '-'}",
                                                                    fontSize = 13.sp,
                                                                    fontWeight = FontWeight.ExtraBold,
                                                                    color = InfoBlue
                                                                )
                                                            }
                                                            Spacer(modifier = Modifier.width(10.dp))
                                                            Column(modifier = Modifier.weight(1f)) {
                                                                Text(
                                                                    text = item.subject_name ?: "Free Period",
                                                                    fontSize = 13.5.sp,
                                                                    fontWeight = FontWeight.Bold,
                                                                    color = TextPrimary
                                                                )
                                                                Text(
                                                                    text = if (item.is_backup && !item.backup_teacher_name.isNullOrBlank()) {
                                                                        "Backup: ${item.backup_teacher_name}"
                                                                    } else {
                                                                        item.teacher_name ?: "Faculty Member"
                                                                    },
                                                                    fontSize = 11.sp,
                                                                    color = if (item.is_backup) SunsetOrange else TextSecondary
                                                                )
                                                            }
                                                            if (!item.start_time.isNullOrBlank()) {
                                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                                    Icon(
                                                                        imageVector = Icons.Default.Schedule,
                                                                        contentDescription = "Time",
                                                                        tint = SunsetOrange,
                                                                        modifier = Modifier.size(13.dp)
                                                                    )
                                                                    Spacer(modifier = Modifier.width(4.dp))
                                                                    Text(
                                                                        text = listOfNotNull(item.start_time, item.end_time).joinToString(" - "),
                                                                        fontSize = 11.sp,
                                                                        fontWeight = FontWeight.SemiBold,
                                                                        color = TextPrimary
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
                        }
                    }
                }
            }
            }
        }
    }
}
