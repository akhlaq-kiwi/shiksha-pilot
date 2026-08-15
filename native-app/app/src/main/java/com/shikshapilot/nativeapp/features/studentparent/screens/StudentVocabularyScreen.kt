package com.shikshapilot.nativeapp.features.studentparent.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import com.shikshapilot.nativeapp.data.remote.LeaderboardEntryDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.VocabChallengeDto
import com.shikshapilot.nativeapp.data.remote.VocabLeaderboardDataDto
import com.shikshapilot.nativeapp.data.remote.VocabularyWordDto
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Student vocabulary hub — daily/weekly challenges (VocabularyService::getDailyChallenge /
 * getWeeklyChallenge / submitDailyChallenge / submitWeeklyChallenge) + leaderboard
 * (VocabularyService::getLeaderboard). The submit endpoints don't actually read any fields from
 * the request body server-side (rewards are unconditional on completion of the 10/20-word
 * review), so the "submit" flow here is: student reviews every word in the set (flips each card),
 * then taps Complete to call the submit endpoint once all words have been seen.
 */
@Composable
fun StudentVocabularyScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    var selectedTab by remember { mutableStateOf(0) } // 0 = Daily, 1 = Weekly, 2 = Leaderboard

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

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
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
                        Icon(imageVector = Icons.Default.ArrowBackIos, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(16.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(text = "Vocabulary", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                }

                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = DarkCanvas,
                    contentColor = SunsetOrange
                ) {
                    listOf("Daily", "Weekly", "Leaderboard").forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = { Text(text = title, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                        )
                    }
                }

                when (selectedTab) {
                    0 -> ChallengeTab(kind = "daily")
                    1 -> ChallengeTab(kind = "weekly")
                    else -> LeaderboardTab()
                }
            }
        }
    }
}

@Composable
private fun ChallengeTab(kind: String) {
    val scope = rememberCoroutineScope()
    var challenge by remember(kind) { mutableStateOf<VocabChallengeDto?>(null) }
    var isLoading by remember(kind) { mutableStateOf(true) }
    var errorMessage by remember(kind) { mutableStateOf<String?>(null) }
    var seenWordIds by remember(kind) { mutableStateOf(setOf<Int>()) }
    var submitting by remember(kind) { mutableStateOf(false) }
    var submitMessage by remember(kind) { mutableStateOf<String?>(null) }

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = if (kind == "daily") {
                    RetrofitClient.apiService.getDailyChallenge()
                } else {
                    RetrofitClient.apiService.getWeeklyChallenge()
                }
                if (response.isSuccessful && response.body() != null) {
                    challenge = response.body()!!.data
                } else {
                    errorMessage = "Unable to load $kind challenge (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading $kind challenge"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(kind) { load() }

    fun submit() {
        scope.launch {
            submitting = true
            try {
                val response = if (kind == "daily") {
                    RetrofitClient.apiService.submitDailyChallenge()
                } else {
                    RetrofitClient.apiService.submitWeeklyChallenge()
                }
                if (response.isSuccessful) {
                    submitMessage = response.body()?.data?.message ?: "Challenge submitted!"
                    load()
                } else {
                    submitMessage = "Unable to submit (code ${response.code()})"
                }
            } catch (e: Exception) {
                submitMessage = e.message ?: "Network error while submitting"
            } finally {
                submitting = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(
            text = "QA Server: ${if (kind == "daily") "GET/POST /api/student/vocabulary/challenge/daily" else "GET/POST /api/student/vocabulary/challenge/weekly"}",
            fontSize = 10.5.sp,
            color = SunsetOrange
        )
        Spacer(modifier = Modifier.height(10.dp))

        when {
            isLoading -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                }
            }
            errorMessage != null -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                }
            }
            challenge == null || challenge!!.words.isEmpty() -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = "No challenge words available right now.", color = TextSecondary, fontSize = 13.sp)
                }
            }
            else -> {
                val c = challenge!!
                if (c.completed == true) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(OnlineGreen.copy(alpha = 0.15f))
                            .border(1.dp, OnlineGreen, RoundedCornerShape(14.dp))
                            .padding(12.dp)
                    ) {
                        Text(text = "You've already completed today's ${kind} challenge. Come back tomorrow!", color = OnlineGreen, fontSize = 13.sp)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                Text(
                    text = "Reviewed ${seenWordIds.size} / ${c.words.size} words",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(c.words) { word ->
                        WordFlipCard(
                            word = word,
                            seen = word.id != null && seenWordIds.contains(word.id),
                            onFlip = { if (word.id != null) seenWordIds = seenWordIds + word.id }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                submitMessage?.let {
                    Text(text = it, fontSize = 12.sp, color = SunsetOrange, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                }

                val allSeen = c.words.isNotEmpty() && c.words.all { it.id == null || seenWordIds.contains(it.id) }
                Button(
                    onClick = { submit() },
                    enabled = c.completed != true && allSeen && !submitting,
                    colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange, disabledContainerColor = FrostedCard),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(text = if (submitting) "Submitting…" else "Complete Challenge", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun WordFlipCard(word: VocabularyWordDto, seen: Boolean, onFlip: () -> Unit) {
    var flipped by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = if (seen) OnlineGreen.copy(alpha = 0.5f) else CardBorder, shape = RoundedCornerShape(14.dp))
            .clickable { flipped = !flipped; onFlip() }
            .padding(12.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(text = (word.word ?: "-").replaceFirstChar { it.uppercase() }, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.weight(1f))
                if (seen) Icon(Icons.Default.CheckCircle, contentDescription = "Seen", tint = OnlineGreen, modifier = Modifier.size(16.dp))
            }
            Text(text = word.part_of_speech ?: "", fontSize = 10.5.sp, color = SunsetOrange)
            if (flipped) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = word.english_meaning ?: "-", fontSize = 12.sp, color = TextSecondary)
                word.english_sentence?.let {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(text = "\"$it\"", fontSize = 11.5.sp, color = TextSecondary)
                }
            } else {
                Text(text = "Tap to reveal meaning", fontSize = 11.sp, color = TextSecondary)
            }
        }
    }
}

@Composable
private fun LeaderboardTab() {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<VocabLeaderboardDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedScope by remember { mutableStateOf(0) } // 0 = school, 1 = class, 2 = section

    LaunchedEffect(Unit) {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getVocabLeaderboard()
                if (response.isSuccessful && response.body() != null) {
                    data = response.body()!!.data
                } else {
                    errorMessage = "Unable to load leaderboard (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading leaderboard"
            } finally {
                isLoading = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(text = "QA Server: GET /api/student/vocabulary/leaderboard", fontSize = 10.5.sp, color = SunsetOrange)
        Spacer(modifier = Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("School", "Class", "Section").forEachIndexed { index, label ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedScope == index) SunsetOrange else FrostedCard)
                        .clickable { selectedScope = index }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = label, fontSize = 11.5.sp, color = if (selectedScope == index) Color.White else TextSecondary, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        val entries: List<LeaderboardEntryDto> = when (selectedScope) {
            0 -> data?.school_rankings.orEmpty()
            1 -> data?.class_rankings.orEmpty()
            else -> data?.section_rankings.orEmpty()
        }

        when {
            isLoading -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                }
            }
            errorMessage != null -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = errorMessage ?: "Something went wrong", color = TextSecondary, fontSize = 13.sp)
                }
            }
            entries.isEmpty() -> {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(text = "No leaderboard entries yet.", color = TextSecondary, fontSize = 13.sp)
                }
            }
            else -> {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(entries) { index, entry ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(FrostedCard)
                                .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                                .padding(12.dp)
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(text = "#${index + 1}", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange, modifier = Modifier.width(36.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(text = entry.name ?: "-", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Text(text = "${entry.total_words_mastered ?: 0} words mastered", fontSize = 11.sp, color = TextSecondary)
                                }
                                Text(text = "${entry.score ?: 0} pts", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                            }
                        }
                    }
                }
            }
        }
    }
}
