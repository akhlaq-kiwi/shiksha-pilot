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
import com.shikshapilot.nativeapp.data.remote.GameProgressDataDto
import com.shikshapilot.nativeapp.data.remote.PlayedWordDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SyncGameProgressRequestDto
import com.shikshapilot.nativeapp.data.remote.VocabularyWordDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Word Builder game — unscramble the letters of the current word. Mirrors the Flutter reference
 * (app/lib/screens/word_builder_game_screen.dart) game loop: shuffle letters, tap tiles to build
 * a spelling, auto-verify once the assembled length matches the target word, 3 lives per word,
 * hint costs 2 coins (reveals meaning), skip costs 2 coins. Progress synced to the backend via
 * POST /api/student/game/word-builder/progress (VocabularyService::syncGameProgress) after every
 * word attempt; GET of the same endpoint loads the active word batch + running stats
 * (VocabularyService::getGameProgress). Daily login bonus via
 * POST /api/student/game/word-builder/claim-daily (StudentService::claimDailyLogin).
 */
@Composable
fun StudentWordBuilderScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()

    var progressData by remember { mutableStateOf<GameProgressDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var claimMessage by remember { mutableStateOf<String?>(null) }

    var coins by remember { mutableStateOf(0) }
    var score by remember { mutableStateOf(0) }
    var currentLevel by remember { mutableStateOf(1) }
    var currentStreak by remember { mutableStateOf(0) }
    var highestStreak by remember { mutableStateOf(0) }
    var correctAnswers by remember { mutableStateOf(0) }
    var wrongAnswers by remember { mutableStateOf(0) }
    var totalWordsLearned by remember { mutableStateOf(0) }

    var wordIndex by remember { mutableStateOf(0) }
    var lives by remember { mutableStateOf(3) }
    var scrambled by remember { mutableStateOf(listOf<Char>()) }
    var selected by remember { mutableStateOf(listOf<Int>()) }
    var usedIndices by remember { mutableStateOf(setOf<Int>()) }
    var showHint by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var feedbackIsError by remember { mutableStateOf(false) }
    var wordDone by remember { mutableStateOf(false) }

    fun scrambleFor(word: String): List<Char> {
        val upper = word.uppercase().toList()
        var attempt = upper
        var tries = 0
        while (tries < 8 && (attempt == upper || attempt.joinToString("") == word.uppercase())) {
            attempt = upper.shuffled()
            tries++
        }
        return attempt
    }

    fun resetWordState(word: String) {
        scrambled = scrambleFor(word)
        selected = emptyList()
        usedIndices = emptySet()
        lives = 3
        showHint = false
        feedback = null
        wordDone = false
    }

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getWordBuilderProgress()
                if (response.isSuccessful && response.body()?.data != null) {
                    val data = response.body()!!.data!!
                    progressData = data
                    val p = data.progress
                    coins = p?.coins ?: 0
                    score = p?.score ?: 0
                    currentLevel = p?.current_level ?: 1
                    currentStreak = p?.current_streak ?: 0
                    highestStreak = p?.highest_streak ?: 0
                    correctAnswers = p?.correct_answers ?: 0
                    wrongAnswers = p?.wrong_answers ?: 0
                    totalWordsLearned = p?.total_words_learned ?: 0
                    wordIndex = 0
                    data.active_words.firstOrNull()?.word?.let { resetWordState(it) }
                } else {
                    errorMessage = "Unable to load Word Builder progress (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading Word Builder progress"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    fun activeWords(): List<VocabularyWordDto> = progressData?.active_words ?: emptyList()
    fun currentWord(): VocabularyWordDto? = activeWords().getOrNull(wordIndex)

    fun sync(lastWordId: Int?, isCorrect: Boolean?) {
        scope.launch {
            try {
                val played = if (lastWordId != null && isCorrect != null) {
                    listOf(PlayedWordDto(word_id = lastWordId, is_correct = isCorrect))
                } else null
                RetrofitClient.apiService.syncWordBuilderProgress(
                    SyncGameProgressRequestDto(
                        coins = coins,
                        score = score,
                        current_level = currentLevel,
                        current_streak = currentStreak,
                        highest_streak = highestStreak,
                        correct_answers = correctAnswers,
                        wrong_answers = wrongAnswers,
                        total_play_time = 0,
                        played_words = played
                    )
                )
            } catch (_: Exception) {
                // best-effort sync; local state already updated optimistically
            }
        }
    }

    fun goToNextWord() {
        val words = activeWords()
        if (wordIndex + 1 < words.size) {
            wordIndex += 1
            words[wordIndex].word?.let { resetWordState(it) }
        } else {
            currentLevel += 1
            load()
        }
    }

    fun verify() {
        val word = currentWord() ?: return
        val assembled = selected.map { scrambled[it] }.joinToString("")
        val target = (word.word ?: "").uppercase()
        val correct = assembled == target || assembled == target + "S" || assembled + "S" == target
        if (correct) {
            val bonus = if ((currentStreak + 1) % 10 == 0) 50 else 0
            coins += 10 + bonus
            score += 20
            currentStreak += 1
            highestStreak = maxOf(highestStreak, currentStreak)
            correctAnswers += 1
            totalWordsLearned += 1
            feedback = if (bonus > 0) "Correct! +10 coins +$bonus streak bonus" else "Correct! +10 coins"
            feedbackIsError = false
            wordDone = true
            sync(word.id, true)
        } else if (selected.size >= target.length) {
            lives -= 1
            if (lives <= 0) {
                wrongAnswers += 1
                currentStreak = 0
                coins += 2
                feedback = "Out of attempts. The word was: $target (+2 coins)"
                feedbackIsError = true
                wordDone = true
                sync(word.id, false)
            } else {
                feedback = "Wrong! $lives attempt(s) left"
                feedbackIsError = true
                selected = emptyList()
                usedIndices = emptySet()
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { load() }) {
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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Word Builder", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(text = "QA Server: GET/POST /api/student/game/word-builder/progress", fontSize = 10.sp, color = SunsetOrange)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(SunsetOrange)
                            .clickable {
                                scope.launch {
                                    try {
                                        val response = RetrofitClient.apiService.claimDailyLogin()
                                        val inner = response.body()?.data
                                        claimMessage = inner?.message ?: "Daily reward claimed"
                                        if (inner?.success == true) {
                                            coins += 20
                                        }
                                    } catch (e: Exception) {
                                        claimMessage = e.message ?: "Unable to claim daily reward"
                                    }
                                }
                            }
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(text = "Claim Daily", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }

                claimMessage?.let {
                    Text(text = it, fontSize = 11.5.sp, color = OnlineGreen, modifier = Modifier.padding(horizontal = 16.dp))
                    Spacer(modifier = Modifier.height(4.dp))
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
                    activeWords().isEmpty() -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(text = "No words available for your class right now.", color = TextSecondary, fontSize = 13.sp)
                        }
                    }
                    else -> {
                        val word = currentWord()
                        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                            // Stats row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                StatChip(label = "Coins", value = "$coins", icon = Icons.Default.MonetizationOn)
                                StatChip(label = "Score", value = "$score", icon = Icons.Default.Star)
                                StatChip(label = "Level", value = "$currentLevel", icon = Icons.Default.TrendingUp)
                                StatChip(label = "Streak", value = "$currentStreak", icon = Icons.Default.LocalFireDepartment)
                            }

                            Spacer(modifier = Modifier.height(10.dp))
                            Text(text = "Word ${wordIndex + 1} of ${activeWords().size}", fontSize = 12.sp, color = TextSecondary)
                            Spacer(modifier = Modifier.height(4.dp))

                            Row {
                                repeat(3) { i ->
                                    Icon(
                                        imageVector = if (i < lives) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = "life",
                                        tint = if (i < lives) Color(0xFFEF4444) else TextSecondary,
                                        modifier = Modifier.size(18.dp).padding(end = 2.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            if (word != null) {
                                // Assembled slots, wrapped in rows of up to 6
                                scrambled.indices.chunked(6).forEach { rowSlots ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        rowSlots.forEach { slot ->
                                            val letterIndex = selected.getOrNull(slot)
                                            Box(
                                                modifier = Modifier
                                                    .padding(2.dp)
                                                    .size(34.dp)
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(if (letterIndex != null) SunsetOrange.copy(alpha = 0.25f) else FrostedCard)
                                                    .border(1.dp, if (letterIndex != null) SunsetOrange else CardBorder, RoundedCornerShape(8.dp)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = letterIndex?.let { scrambled[it].toString() } ?: "",
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(24.dp))

                                // Scrambled letter tiles, wrapped in rows of up to 6
                                scrambled.indices.chunked(6).forEach { rowIndices ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        rowIndices.forEach { i ->
                                            val used = usedIndices.contains(i)
                                            Box(
                                                modifier = Modifier
                                                    .padding(4.dp)
                                                    .size(40.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(if (used) FrostedCard.copy(alpha = 0.4f) else SunsetOrange)
                                                    .clickable(enabled = !used && !wordDone) {
                                                        selected = selected + i
                                                        usedIndices = usedIndices + i
                                                        verify()
                                                    },
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = scrambled[i].toString(),
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (used) TextSecondary else Color.White
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(16.dp))

                                feedback?.let {
                                    Text(text = it, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (feedbackIsError) Color(0xFFEF4444) else OnlineGreen)
                                    Spacer(modifier = Modifier.height(8.dp))
                                }

                                if (showHint) {
                                    Text(text = "Hint: ${word.english_meaning ?: "-"}", fontSize = 12.sp, color = TextSecondary)
                                    Spacer(modifier = Modifier.height(8.dp))
                                }

                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    OutlinedButton(
                                        onClick = {
                                            if (coins >= 2 && !showHint) coins -= 2
                                            showHint = true
                                        },
                                        enabled = !wordDone
                                    ) {
                                        Text(text = "Hint (-2 coins)", fontSize = 11.5.sp, color = TextPrimary)
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            if (coins >= 2) coins -= 2
                                            sync(word.id, false)
                                            goToNextWord()
                                        },
                                        enabled = !wordDone
                                    ) {
                                        Text(text = "Skip (-2 coins)", fontSize = 11.5.sp, color = TextPrimary)
                                    }
                                    if (wordDone) {
                                        Button(
                                            onClick = { goToNextWord() },
                                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                                        ) {
                                            Text(text = "Next Word", color = Color.White, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(16.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Text(text = "Correct: $correctAnswers", fontSize = 11.5.sp, color = OnlineGreen)
                                    Text(text = "Wrong: $wrongAnswers", fontSize = 11.5.sp, color = Color(0xFFEF4444))
                                    Text(text = "Words learned: $totalWordsLearned", fontSize = 11.5.sp, color = TextSecondary)
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
private fun StatChip(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(FrostedCard)
            .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(imageVector = icon, contentDescription = label, tint = SunsetOrange, modifier = Modifier.size(14.dp))
            Text(text = value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Text(text = label, fontSize = 9.sp, color = TextSecondary)
        }
    }
}
