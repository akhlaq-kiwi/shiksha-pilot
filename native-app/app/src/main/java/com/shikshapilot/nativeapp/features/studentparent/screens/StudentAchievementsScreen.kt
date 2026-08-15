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
import com.shikshapilot.nativeapp.data.remote.AchievementItemDto
import com.shikshapilot.nativeapp.data.remote.AchievementsDataDto
import com.shikshapilot.nativeapp.data.remote.ReportCardDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Student/Parent achievement badges — GET /api/school/achievements (SchoolAdminService::
 * getAchievements; same endpoint is shared by school-admin, student and parent contexts — the
 * backend filters visibility by role/phone match at the report-card endpoint level, not here).
 * Report card drill-down: GET /api/school/achievements/{id}/report-card.
 */
@Composable
fun StudentAchievementsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var achievementsData by remember { mutableStateOf<AchievementsDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedTab by remember { mutableStateOf("attendance_champions") }
    var selectedAchievement by remember { mutableStateOf<AchievementItemDto?>(null) }
    var reportCard by remember { mutableStateOf<ReportCardDto?>(null) }
    var reportCardLoading by remember { mutableStateOf(false) }

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getAchievements()
                if (response.isSuccessful && response.body() != null) {
                    achievementsData = response.body()!!.data
                } else {
                    errorMessage = "Unable to load achievements (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading achievements"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    fun openReportCard(item: AchievementItemDto) {
        selectedAchievement = item
        reportCard = null
        scope.launch {
            reportCardLoading = true
            try {
                val id = item.id ?: return@launch
                val response = RetrofitClient.apiService.getAchievementReportCard(id)
                if (response.isSuccessful && response.body()?.data != null) {
                    reportCard = response.body()!!.data
                }
            } catch (_: Exception) {
                // non-fatal — dialog just shows "not available"
            } finally {
                reportCardLoading = false
            }
        }
    }

    if (selectedAchievement != null) {
        AchievementDetailDialog(
            item = selectedAchievement!!,
            reportCard = reportCard,
            isLoading = reportCardLoading,
            showReportCard = selectedAchievement!!.category == "academic_excellence",
            onDismiss = { selectedAchievement = null; reportCard = null }
        )
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
                        Column {
                            Text(text = "Achievements", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "QA Server: GET /api/school/achievements", fontSize = 11.5.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    val summary = achievementsData?.categories_summary
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        AchievementTabChip(
                            label = summary?.attendance_champions?.label ?: "Attendance Champions",
                            count = summary?.attendance_champions?.count ?: 0,
                            selected = selectedTab == "attendance_champions",
                            modifier = Modifier.weight(1f),
                            onClick = { selectedTab = "attendance_champions" }
                        )
                        AchievementTabChip(
                            label = summary?.academic_excellence?.label ?: "Academic Excellence",
                            count = summary?.academic_excellence?.count ?: 0,
                            selected = selectedTab == "academic_excellence",
                            modifier = Modifier.weight(1f),
                            onClick = { selectedTab = "academic_excellence" }
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    val filtered = achievementsData?.achievements.orEmpty()
                        .filter { it.category == selectedTab || it.feature_type == selectedTab }
                        .sortedBy { it.rank ?: Int.MAX_VALUE }

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
                        filtered.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No achievements in this category yet.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(filtered) { item ->
                                    AchievementCard(item = item, onClick = { openReportCard(item) })
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
private fun AchievementTabChip(
    label: String,
    count: Int,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) SunsetOrange else FrostedCard)
            .border(width = 1.dp, color = if (selected) SunsetOrange else CardBorder, shape = RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(vertical = 10.dp, horizontal = 8.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(text = "$count", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = if (selected) Color.White else TextPrimary)
            Text(text = label, fontSize = 10.5.sp, color = if (selected) Color.White else TextSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

private fun medalEmoji(rank: Int?): String = when (rank) {
    1 -> "🥇"
    2 -> "🥈"
    3 -> "🥉"
    else -> "🏅"
}

@Composable
private fun AchievementCard(item: AchievementItemDto, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Text(text = medalEmoji(item.rank), fontSize = 20.sp)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.student_name ?: "Student", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(
                    text = "${item.class_name ?: "-"} • Roll ${item.roll_number ?: "-"}",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
                Text(
                    text = "Rank #${item.rank ?: "-"} • ${item.level ?: "-"} level",
                    fontSize = 11.5.sp,
                    color = SunsetOrange
                )
            }
            Text(
                text = "${item.achievement_score?.let { "%.1f".format(it) } ?: "-"}${if (item.category == "attendance_champions") "%" else ""}",
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
                color = OnlineGreen
            )
        }
    }
}

@Composable
private fun AchievementDetailDialog(
    item: AchievementItemDto,
    reportCard: ReportCardDto?,
    isLoading: Boolean,
    showReportCard: Boolean,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = FrostedCard,
        titleContentColor = TextPrimary,
        textContentColor = TextSecondary,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = medalEmoji(item.rank), fontSize = 22.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = item.student_name ?: "Achievement", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                Text(text = "${item.category_label ?: item.category ?: "-"}", fontSize = 12.sp, color = SunsetOrange, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = "${item.class_name ?: "-"} • Roll ${item.roll_number ?: "-"}", fontSize = 12.sp)
                Text(text = "Rank #${item.rank ?: "-"} of the ${item.level ?: "-"} level", fontSize = 12.sp)
                Text(text = "Score: ${item.achievement_score ?: "-"}", fontSize = 12.sp)

                if (showReportCard) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(text = "REPORT CARD", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    when {
                        isLoading -> Text(text = "Loading report card…", fontSize = 12.sp)
                        reportCard == null -> Text(text = "Report card not available for this achievement.", fontSize = 12.sp)
                        else -> {
                            Text(text = reportCard.exam_name ?: "Exam", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(text = "Total: ${reportCard.total_obtained?.toInt() ?: 0} / ${reportCard.total_max?.toInt() ?: 0}  (${reportCard.percentage ?: 0.0}%)", fontSize = 12.sp)
                            Text(text = "Grade: ${reportCard.grade ?: "-"} • ${reportCard.result ?: "-"}", fontSize = 12.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "Close", color = SunsetOrange)
            }
        }
    )
}
