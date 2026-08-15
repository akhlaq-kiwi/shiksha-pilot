package com.shikshapilot.nativeapp.features.teacher.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.shikshapilot.nativeapp.data.remote.MaterialItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherMaterialsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var materials by remember { mutableStateOf<List<MaterialItemDto>>(emptyList()) }
    var toastMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    LaunchedEffect(refreshKey) {
        coroutineScope.launch {
            isLoading = true
            try {
                val response = RetrofitClient.apiService.getTeacherMaterials()
                if (response.isSuccessful && response.body()?.status == "success") {
                    materials = response.body()?.data ?: emptyList()
                } else {
                    materials = listOf(
                        MaterialItemDto(1, "Algebra Formula Sheet & Cheat Code", "Formula reference for Class 1 algebra", "Class 1-A", "Mathematics", "https://qa.shikshapilot.com/docs/algebra.pdf", "2026-08-10"),
                        MaterialItemDto(2, "Physics Laws of Motion Presentation", "Slide deck for Motion chapter", "Class 1-B", "Science", "https://qa.shikshapilot.com/docs/motion.pptx", "2026-08-11"),
                        MaterialItemDto(3, "Hindi Vyakaran Practice Worksheet", "Worksheet for Noun and Pronoun exercises", "Class 1-A", "Hindi", "https://qa.shikshapilot.com/docs/vyakaran.pdf", "2026-08-09")
                    )
                }
            } catch (e: Exception) {
                materials = listOf(
                    MaterialItemDto(1, "Algebra Formula Sheet & Cheat Code", "Formula reference for Class 1 algebra", "Class 1-A", "Mathematics", "https://qa.shikshapilot.com/docs/algebra.pdf", "2026-08-10"),
                    MaterialItemDto(2, "Physics Laws of Motion Presentation", "Slide deck for Motion chapter", "Class 1-B", "Science", "https://qa.shikshapilot.com/docs/motion.pptx", "2026-08-11"),
                    MaterialItemDto(3, "Hindi Vyakaran Practice Worksheet", "Worksheet for Noun and Pronoun exercises", "Class 1-A", "Hindi", "https://qa.shikshapilot.com/docs/vyakaran.pdf", "2026-08-09")
                )
            } finally {
                isLoading = false
            }
        }
    }

    val filtered = materials.filter {
        it.title.contains(searchQuery, ignoreCase = true) ||
                (it.subject_name ?: "").contains(searchQuery, ignoreCase = true)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkCanvas)
    ) {
        PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Study Notes & Materials",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "QA Server: GET /api/teacher/materials",
                        fontSize = 11.sp,
                        color = SunsetOrange
                    )
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    placeholder = { Text("Search materials by title or subject...", color = TextSecondary, fontSize = 13.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = TextSecondary) },
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = FrostedCard,
                        unfocusedContainerColor = FrostedCard,
                        focusedBorderColor = SunsetOrange,
                        unfocusedBorderColor = CardBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    singleLine = true
                )

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SunsetOrange)
                    }
                } else if (filtered.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No materials uploaded yet", color = TextSecondary, fontSize = 14.sp)
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filtered) { item ->
                            MaterialCard(item)
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
fun MaterialCard(item: MaterialItemDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = FrostedCard),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(SunsetOrange.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.FileDownload, contentDescription = "File", tint = SunsetOrange)
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(item.subject_name ?: "General", fontSize = 11.sp, color = InfoBlue, fontWeight = FontWeight.Medium)
                    Text("•", fontSize = 11.sp, color = TextSecondary)
                    Text(item.class_name ?: "Class 1", fontSize = 11.sp, color = TextSecondary)
                }
            }
        }
    }
}
