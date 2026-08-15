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
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.ParentVocabReportDataDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Parent-facing read-only vocabulary report — GET /api/parent/vocabulary/report
 * (VocabularyService::getParentReport). Backend requires the PARENT role and resolves the child
 * from the caller's phone (with an optional student_id when a parent has multiple children).
 * NOTE (see native-app/PARITY_GAPS.md): native-app doesn't yet distinguish STUDENT vs PARENT
 * beyond the login role string — this screen is only meaningful when the logged-in user's role is
 * actually PARENT; a STUDENT-role token will get a 403 from this endpoint.
 */
@Composable
fun ParentVocabularyReportScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var report by remember { mutableStateOf<ParentVocabReportDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    LaunchedEffect(refreshKey) {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getParentVocabularyReport()
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 0,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(modifier = Modifier.fillMaxSize().padding(horizontal = 13.dp, vertical = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = CircleShape)
                                .clickable { onBack() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(text = "Child's Vocabulary Report", fontSize = 14.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "QA Server: GET /api/parent/vocabulary/report", fontSize = 9.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

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
                        report == null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No vocabulary data available.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            val r = report!!
                            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
                                item {
                                    Text(text = "${r.student_name ?: "-"} • ${r.student_class ?: "-"}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                                item {
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp)).padding(12.dp)
                                    ) {
                                        Column {
                                            Text(text = "Score: ${r.stats?.score ?: 0}  •  Coins: ${r.stats?.coins ?: 0}", fontSize = 11.sp, color = TextPrimary)
                                            Text(text = "Level: ${r.stats?.current_level ?: 1}", fontSize = 11.sp, color = TextPrimary)
                                            Text(text = "Words Learned: ${r.stats?.total_words_learned ?: 0}  •  Mastered: ${r.stats?.total_words_mastered ?: 0}", fontSize = 11.sp, color = TextPrimary)
                                            Text(text = "Accuracy: ${r.stats?.accuracy_percent ?: 0.0}%", fontSize = 11.sp, color = TextPrimary)
                                            Text(text = "Current Streak: ${r.stats?.current_streak ?: 0}  •  Longest: ${r.stats?.longest_streak ?: 0}", fontSize = 11.sp, color = TextPrimary)
                                            Text(text = "Daily Practice Days: ${r.stats?.daily_practice_days ?: 0}", fontSize = 11.sp, color = TextPrimary)
                                        }
                                    }
                                }
                                item { Text(text = "CATEGORY PERFORMANCE", fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp, color = TextSecondary) }
                                items(r.category_performance) { cat ->
                                    Box(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(FrostedCard)
                                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)).padding(10.dp)
                                    ) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(text = cat.category ?: "-", fontSize = 10.5.sp, color = TextPrimary)
                                            Text(text = "✓${cat.correct ?: 0}  ✗${cat.wrong ?: 0}", fontSize = 10.5.sp, color = TextSecondary)
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
