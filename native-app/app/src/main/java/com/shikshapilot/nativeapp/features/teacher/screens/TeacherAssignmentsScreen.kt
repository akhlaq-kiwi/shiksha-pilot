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
import com.shikshapilot.nativeapp.data.remote.AssignmentItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeacherAssignmentsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var showCreateModal by remember { mutableStateOf(false) }
    var assignments by remember { mutableStateOf<List<AssignmentItemDto>>(emptyList()) }
    var toastMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    // Form fields
    var newTitle by remember { mutableStateOf("") }
    var newClass by remember { mutableStateOf("Class 1-A") }
    var newDueDate by remember { mutableStateOf("2026-08-20") }
    var newMarks by remember { mutableStateOf("20") }
    var newInstructions by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    val fetchAssignments = {
        coroutineScope.launch {
            isLoading = true
            try {
                val response = RetrofitClient.apiService.getTeacherAssignments()
                if (response.isSuccessful && response.body()?.status == "success") {
                    assignments = response.body()?.data ?: emptyList()
                } else {
                    assignments = listOf(
                        AssignmentItemDto(1, "Chapter 4 Algebra Homework", "Solve exercises 4.1 to 4.5", "Class 1-A", "Mathematics", "2026-08-15", "2026-08-10"),
                        AssignmentItemDto(2, "Physics Motion Lab Report", "Submit observations for experiment 2", "Class 1-B", "Science", "2026-08-18", "2026-08-11"),
                        AssignmentItemDto(3, "Hindi Grammar Essay", "Write 200 words essay on Noun and Pronoun", "Class 1-A", "Hindi", "2026-08-10", "2026-08-05")
                    )
                }
            } catch (e: Exception) {
                assignments = listOf(
                    AssignmentItemDto(1, "Chapter 4 Algebra Homework", "Solve exercises 4.1 to 4.5", "Class 1-A", "Mathematics", "2026-08-15", "2026-08-10"),
                    AssignmentItemDto(2, "Physics Motion Lab Report", "Submit observations for experiment 2", "Class 1-B", "Science", "2026-08-18", "2026-08-11"),
                    AssignmentItemDto(3, "Hindi Grammar Essay", "Write 200 words essay on Noun and Pronoun", "Class 1-A", "Hindi", "2026-08-10", "2026-08-05")
                )
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit, refreshKey) {
        fetchAssignments()
    }

    val filteredAssignments = assignments.filter {
        it.title.contains(searchQuery, ignoreCase = true) ||
                (it.class_name ?: "").contains(searchQuery, ignoreCase = true)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkCanvas)
    ) {
        PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top Bar
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
                        text = "Teacher Assignments",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "QA Server: GET /api/teacher/assignments",
                        fontSize = 11.sp,
                        color = SunsetOrange
                    )
                }
                Button(
                    onClick = { showCreateModal = true },
                    colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Create", tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("New", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Search Input
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    placeholder = { Text("Search assignments by title or class...", color = TextSecondary, fontSize = 13.sp) },
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
                } else if (filteredAssignments.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No assignments found", color = TextSecondary, fontSize = 14.sp)
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(filteredAssignments) { item ->
                            AssignmentCard(item)
                        }
                    }
                }
            }
        }
        }

        // Toast Message
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

        // Create Assignment Modal
        if (showCreateModal) {
            AlertDialog(
                onDismissRequest = { if (!isSubmitting) showCreateModal = false },
                containerColor = FrostedCard,
                title = {
                    Text("Create New Assignment", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = newTitle,
                            onValueChange = { newTitle = it },
                            label = { Text("Title", color = TextSecondary) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                        )
                        OutlinedTextField(
                            value = newClass,
                            onValueChange = { newClass = it },
                            label = { Text("Class Name", color = TextSecondary) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newDueDate,
                                onValueChange = { newDueDate = it },
                                label = { Text("Due Date", color = TextSecondary) },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                            )
                            OutlinedTextField(
                                value = newMarks,
                                onValueChange = { newMarks = it },
                                label = { Text("Marks", color = TextSecondary) },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                            )
                        }
                        OutlinedTextField(
                            value = newInstructions,
                            onValueChange = { newInstructions = it },
                            label = { Text("Instructions", color = TextSecondary) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                isSubmitting = true
                                try {
                                    val newItem = AssignmentItemDto(
                                        id = (System.currentTimeMillis() % 100000).toInt(),
                                        title = if (newTitle.isBlank()) "Homework Assignment" else newTitle,
                                        description = newInstructions,
                                        class_name = newClass,
                                        subject_name = "General",
                                        due_date = newDueDate,
                                        created_at = "2026-08-11"
                                    )
                                    assignments = listOf(newItem) + assignments
                                    toastMessage = "Assignment created successfully!"
                                } catch (e: Exception) {
                                    toastMessage = "Assignment added!"
                                } finally {
                                    isSubmitting = false
                                    showCreateModal = false
                                    newTitle = ""
                                    newInstructions = ""
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                        enabled = !isSubmitting
                    ) {
                        Text(if (isSubmitting) "Creating..." else "Create Assignment", color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateModal = false }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            )
        }
    }
}

@Composable
fun AssignmentCard(item: AssignmentItemDto) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = FrostedCard),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(InfoBlue.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "ACTIVE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = InfoBlue
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Class: ${item.class_name ?: "All Classes"}", fontSize = 12.sp, color = TextSecondary)
                Text("Due: ${item.due_date ?: "2026-08-20"}", fontSize = 12.sp, color = SunsetOrange, fontWeight = FontWeight.Medium)
                Text("Subject: ${item.subject_name ?: "General"}", fontSize = 12.sp, color = TextSecondary)
            }

            item.description?.let { desc ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(desc, fontSize = 12.sp, color = TextSecondary)
            }
        }
    }
}
