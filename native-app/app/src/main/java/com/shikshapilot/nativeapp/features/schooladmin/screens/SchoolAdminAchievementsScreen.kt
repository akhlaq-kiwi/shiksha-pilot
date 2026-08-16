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
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.AchievementItemDto
import com.shikshapilot.nativeapp.data.remote.AchievementClassDto
import com.shikshapilot.nativeapp.data.remote.AchievementsDataDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

/**
 * Hall of Fame & Achievements — matches the real web AchievementsPage exactly (verified live
 * against the running web app): a landing page with two category cards (Attendance Champions,
 * Academic Excellence) each showing a live count, drilling into a gallery with search + class
 * filter. Data only exists once an academic year has completed migration — until then the
 * backend always returns zero counts and the gallery must show the same "pending migration"
 * notice the web shows, not an error or a misleading "no results" state.
 */
@Composable
fun SchoolAdminAchievementsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var data by remember { mutableStateOf(AchievementsDataDto()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            val response = RetrofitClient.apiService.getAchievements()
            if (response.isSuccessful) {
                data = response.body()?.data ?: AchievementsDataDto()
            }
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            if (selectedCategory == null) {
                AchievementsLanding(
                    schoolName = schoolName,
                    data = data,
                    isLoading = isLoading,
                    onBack = onBack,
                    onSelectCategory = { selectedCategory = it }
                )
            } else {
                AchievementsGallery(
                    schoolName = schoolName,
                    category = selectedCategory!!,
                    categoryLabel = if (selectedCategory == "attendance_champions") "Attendance Champions" else "Academic Excellence",
                    classes = data.classes,
                    isMigrated = ((if (selectedCategory == "attendance_champions") data.categories_summary?.attendance_champions?.count else data.categories_summary?.academic_excellence?.count) ?: 0) > 0,
                    onBack = { selectedCategory = null }
                )
            }
        }
    }
}

@Composable
private fun AchievementsLanding(
    schoolName: String,
    data: AchievementsDataDto,
    isLoading: Boolean,
    onBack: () -> Unit,
    onSelectCategory: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
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
                Text(text = "Hall of Fame & Achievements", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text(text = "Celebrating excellence in attendance and academic performance.", fontSize = 9.5.sp, color = TextSecondary)
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                ThreeDotsLoader(dotSize = 8.dp, dotColor = SunsetOrange, spaceBetween = 6.dp, travelDistance = 6.dp)
            }
        }

        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AchievementCategoryCard(
                title = "Attendance Champions",
                subtitle = "Students with outstanding school attendance, discipline, and daily commitment to learning throughout the academic session.",
                exploreLine = "Explore School & Class Champions",
                count = data.categories_summary?.attendance_champions?.count ?: 0,
                icon = Icons.Default.MilitaryTech,
                iconColor = WarningYellow,
                onClick = { onSelectCategory("attendance_champions") }
            )
            AchievementCategoryCard(
                title = "Academic Excellence",
                subtitle = "Top academic performers in final examination results. Celebrates scholars with highest percentages and subject mastery.",
                exploreLine = "Explore Class Examination Toppers",
                count = data.categories_summary?.academic_excellence?.count ?: 0,
                icon = Icons.Default.School,
                iconColor = SunsetOrange,
                onClick = { onSelectCategory("academic_excellence") }
            )
        }
    }
}

@Composable
private fun AchievementCategoryCard(
    title: String,
    subtitle: String,
    exploreLine: String,
    count: Int,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconColor: Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(16.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(37.dp)
                        .clip(CircleShape)
                        .background(iconColor.copy(alpha = 0.18f))
                        .border(width = 1.dp, color = iconColor.copy(alpha = 0.4f), shape = CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "$count Achievements", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = iconColor)
                    Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = subtitle, fontSize = 10.5.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = exploreLine, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WarningYellow)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "View Gallery", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WarningYellow)
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(imageVector = Icons.Default.ArrowForwardIos, contentDescription = null, tint = WarningYellow, modifier = Modifier.size(12.dp))
                }
            }
        }
    }
}

@Composable
private fun AchievementsGallery(
    schoolName: String,
    category: String,
    categoryLabel: String,
    classes: List<AchievementClassDto>,
    isMigrated: Boolean,
    onBack: () -> Unit
) {
    var search by remember { mutableStateOf("") }
    var selectedClass by remember { mutableStateOf<AchievementClassDto?>(null) }
    var items by remember { mutableStateOf<List<AchievementItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(category, search, selectedClass) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getAchievements(
                category = category,
                classId = selectedClass?.id,
                search = search.ifBlank { null }
            )
            if (response.isSuccessful) {
                items = response.body()?.data?.achievements ?: emptyList()
            }
        } catch (_: Exception) {
        } finally {
            isLoading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        StickyTopBar(schoolName = schoolName, unreadNotificationCount = 2, onNotificationClick = {}, onAvatarClick = {})

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
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
            Text(text = categoryLabel, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
        }

        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search by name, roll...", fontSize = 11.sp, color = TextSecondary) },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard, unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange, unfocusedBorderColor = CardBorder,
                    focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary
                )
            )
            Spacer(modifier = Modifier.height(8.dp))
            ClassFilterDropdown(classes, selectedClass) { selectedClass = it }
            Spacer(modifier = Modifier.height(12.dp))
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                ThreeDotsLoader(dotSize = 8.dp, dotColor = SunsetOrange, spaceBetween = 6.dp, travelDistance = 6.dp)
            }
        } else if (items.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(FrostedCard)
                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text(
                        text = if (isMigrated) "No achievements found" else "Achievements & Certificates Pending Migration",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (isMigrated)
                            "Try a different search term or class filter."
                        else
                            "Official Achievement Certificates and Attendance Champions will be calculated and generated automatically upon Academic Year Migration at the end of the session.",
                        fontSize = 10.5.sp,
                        color = TextSecondary
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(items) { item -> AchievementRow(item) }
            }
        }
    }
}

@Composable
private fun AchievementRow(item: AchievementItemDto) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
            .padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(WarningYellow.copy(alpha = 0.18f))
                    .border(width = 1.dp, color = WarningYellow.copy(alpha = 0.4f), shape = CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.EmojiEvents, contentDescription = null, tint = WarningYellow, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = item.student_name ?: "-", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(
                    text = "${item.class_name ?: "-"}${item.roll_number?.let { " · Roll $it" } ?: ""}",
                    fontSize = 10.sp,
                    color = TextSecondary
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(text = "Rank #${item.rank ?: "-"}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SunsetOrange)
                item.achievement_score?.let {
                    Text(text = "Score: $it", fontSize = 9.5.sp, color = TextSecondary)
                }
            }
        }
    }
}

@Composable
private fun ClassFilterDropdown(classes: List<AchievementClassDto>, selected: AchievementClassDto?, onSelect: (AchievementClassDto?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FrostedCard)
                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                .clickable { expanded = true }
                .padding(horizontal = 11.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = selected?.let { "${it.name}${it.section?.let { s -> " - $s" } ?: ""}" } ?: "All Classes",
                fontSize = 12.sp,
                color = if (selected != null) TextPrimary else TextSecondary
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 300.dp)) {
            DropdownMenuItem(text = { Text("All Classes") }, onClick = { onSelect(null); expanded = false })
            classes.forEach { cls ->
                DropdownMenuItem(
                    text = { Text("${cls.name}${cls.section?.let { s -> " - $s" } ?: ""}") },
                    onClick = { onSelect(cls); expanded = false }
                )
            }
        }
    }
}
