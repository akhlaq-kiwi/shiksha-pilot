package com.shikshapilot.nativeapp.features.schooladmin.screens

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
import com.shikshapilot.nativeapp.data.remote.CreateExamRequestDto
import com.shikshapilot.nativeapp.data.remote.ExamClassStatusItemDto
import com.shikshapilot.nativeapp.data.remote.ExamItemDto
import com.shikshapilot.nativeapp.data.remote.PublishExamRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchoolAdminExamsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()

    var exams by remember { mutableStateOf<List<ExamItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedExam by remember { mutableStateOf<ExamItemDto?>(null) }
    var toastMessage by remember { mutableStateOf<String?>(null) }

    fun loadExams() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getSchoolExams()
                if (response.isSuccessful && response.body() != null) {
                    exams = response.body()!!.data
                } else {
                    errorMessage = "Unable to load examinations (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading examinations"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadExams() }

    if (toastMessage != null) {
        LaunchedEffect(toastMessage) {
            kotlinx.coroutines.delay(2200)
            toastMessage = null
        }
    }

    if (selectedExam != null) {
        SchoolAdminExamDetailScreen(
            exam = selectedExam!!,
            onBack = { selectedExam = null; loadExams() },
            onToast = { toastMessage = it }
        )
        return
    }

    Scaffold(containerColor = DarkCanvas) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkCanvas)
        ) {
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { loadExams() }) {
            Column(modifier = Modifier.fillMaxSize()) {
                StickyTopBar(
                    schoolName = schoolName,
                    unreadNotificationCount = 2,
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 13.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
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
                            Icon(
                                imageVector = Icons.Default.ArrowBackIos,
                                contentDescription = "Back",
                                tint = TextPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Examinations",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: GET /api/school/exams-new",
                                fontSize = 10.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(SunsetOrange)
                                .clickable { showCreateDialog = true }
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Add, contentDescription = "Add", tint = Color.White, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(3.dp))
                                Text(text = "New", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(13.dp))

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
                        exams.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No examinations found. Tap New to create one.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(exams) { exam ->
                                    val statusColor = when (exam.status?.uppercase()) {
                                        "PUBLISHED" -> OnlineGreen
                                        else -> WarningYellow
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                            .clickable { selectedExam = exam }
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(35.dp)
                                                    .clip(CircleShape)
                                                    .background(SunsetOrange.copy(alpha = 0.18f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(imageVector = Icons.Default.Assignment, contentDescription = "Exam", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = exam.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Spacer(modifier = Modifier.height(2.dp))
                                                Text(
                                                    text = "${exam.start_date ?: "-"} to ${exam.end_date ?: "-"}",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                                if ((exam.papers_count ?: 0) > 0) {
                                                    Text(
                                                        text = "${exam.papers_count} paper(s) scheduled",
                                                        fontSize = 9.5.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(statusColor.copy(alpha = 0.2f))
                                                    .border(width = 1.dp, color = statusColor, shape = RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                                            ) {
                                                Text(text = exam.status ?: "Draft", fontSize = 8.5.sp, fontWeight = FontWeight.ExtraBold, color = statusColor)
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
                    Text(msg, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
        }

        if (showCreateDialog) {
            CreateExamDialog(
                onDismiss = { showCreateDialog = false },
                onCreated = {
                    showCreateDialog = false
                    toastMessage = "Examination created successfully!"
                    loadExams()
                },
                onError = { toastMessage = it }
            )
        }
    }
}

@Composable
private fun CreateExamDialog(
    onDismiss: () -> Unit,
    onCreated: () -> Unit,
    onError: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var startDate by remember { mutableStateOf("") }
    var endDate by remember { mutableStateOf("") }
    var publishDate by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!isSubmitting) onDismiss() },
        containerColor = FrostedCard,
        title = { Text("Create Examination", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.5.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Exam Name", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                )
                OutlinedTextField(
                    value = startDate,
                    onValueChange = { startDate = it },
                    label = { Text("Start Date (YYYY-MM-DD)", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                )
                OutlinedTextField(
                    value = endDate,
                    onValueChange = { endDate = it },
                    label = { Text("End Date (YYYY-MM-DD)", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                )
                OutlinedTextField(
                    value = publishDate,
                    onValueChange = { publishDate = it },
                    label = { Text("Publish Date (YYYY-MM-DD)", color = TextSecondary) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description (optional)", color = TextSecondary) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isBlank() || startDate.isBlank() || endDate.isBlank() || publishDate.isBlank()) {
                        onError("Exam Name, Start Date, End Date and Publish Date are required.")
                        return@Button
                    }
                    scope.launch {
                        isSubmitting = true
                        try {
                            val response = RetrofitClient.apiService.createSchoolExam(
                                CreateExamRequestDto(
                                    name = name.trim(),
                                    start_date = startDate.trim(),
                                    end_date = endDate.trim(),
                                    publish_date = publishDate.trim(),
                                    description = description.ifBlank { null }
                                )
                            )
                            if (response.isSuccessful) {
                                onCreated()
                            } else {
                                onError("Unable to create examination (code ${response.code()})")
                            }
                        } catch (e: Exception) {
                            onError(e.message ?: "Network error while creating examination")
                        } finally {
                            isSubmitting = false
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                enabled = !isSubmitting
            ) {
                Text(if (isSubmitting) "Creating..." else "Create", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isSubmitting) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}

@Composable
private fun SchoolAdminExamDetailScreen(
    exam: ExamItemDto,
    onBack: () -> Unit,
    onToast: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var classStatuses by remember { mutableStateOf<List<ExamClassStatusItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var publishingClassId by remember { mutableStateOf<Int?>(null) }

    fun loadStatuses() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getSchoolExamClassStatus(exam.id)
                if (response.isSuccessful && response.body() != null) {
                    classStatuses = response.body()!!.data
                } else {
                    errorMessage = "Unable to load class status (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading class status"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(exam.id) { loadStatuses() }

    fun publishClass(classId: Int) {
        scope.launch {
            publishingClassId = classId
            try {
                val response = RetrofitClient.apiService.publishSchoolExam(
                    exam.id,
                    PublishExamRequestDto(class_id = classId, status = "Published")
                )
                if (response.isSuccessful) {
                    onToast("Results published for this class.")
                    loadStatuses()
                } else {
                    onToast("Unable to publish (code ${response.code()})")
                }
            } catch (e: Exception) {
                onToast(e.message ?: "Network error while publishing")
            } finally {
                publishingClassId = null
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkCanvas)) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(FrostedCard)
                    .padding(horizontal = 13.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = exam.name, fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text(
                        text = "QA Server: GET /api/school/exams-new/{id}/class-status",
                        fontSize = 9.sp,
                        color = SunsetOrange
                    )
                }
            }

            Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(FrostedCard)
                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                        .padding(14.dp)
                ) {
                    Column {
                        Text(text = "Schedule", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(text = "${exam.start_date ?: "-"}  →  ${exam.end_date ?: "-"}", fontSize = 12.sp, color = TextPrimary)
                        Text(text = "Publish Date: ${exam.publish_date ?: "-"}", fontSize = 10.sp, color = TextSecondary)
                        if (!exam.description.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(5.dp))
                            Text(text = exam.description, fontSize = 10.sp, color = TextSecondary)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(13.dp))

                Text(
                    text = "CLASS-WISE RESULT STATUS",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

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
                    classStatuses.isEmpty() -> {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(text = "No classes found for this academic year.", color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                    else -> {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(classStatuses) { cls ->
                                val isPublished = cls.status?.equals("Published", ignoreCase = true) == true
                                val statusColor = if (isPublished) OnlineGreen else WarningYellow
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(FrostedCard)
                                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                                        .padding(14.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            val className = if (!cls.section.isNullOrBlank()) "${cls.name}-${cls.section}" else cls.name
                                            Text(text = className, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(statusColor.copy(alpha = 0.2f))
                                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                                            ) {
                                                Text(text = cls.status ?: "Draft", fontSize = 8.5.sp, fontWeight = FontWeight.Bold, color = statusColor)
                                            }
                                        }
                                        if (!isPublished) {
                                            Button(
                                                onClick = { publishClass(cls.id) },
                                                colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                                                enabled = publishingClassId != cls.id,
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) {
                                                Text(
                                                    if (publishingClassId == cls.id) "Publishing..." else "Publish",
                                                    color = Color.White,
                                                    fontSize = 10.sp
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
