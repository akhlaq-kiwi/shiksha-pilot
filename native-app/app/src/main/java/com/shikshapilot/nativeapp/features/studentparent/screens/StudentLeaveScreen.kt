package com.shikshapilot.nativeapp.features.studentparent.screens

import android.widget.Toast
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.shikshapilot.nativeapp.data.remote.ApplyLeaveRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TeacherLeaveItemDto
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
import com.shikshapilot.nativeapp.ui.theme.WarningYellow
import kotlinx.coroutines.launch

/**
 * Student/Parent self-service leave screen. Reuses the exact same shared
 * `GET/POST api/school/leave-requests` endpoint and DTOs as TeacherLeaveScreen — the backend
 * (LeaveRequestService::getLeaveRequests/applyLeaveRequest) already resolves the caller's own
 * student record server-side for STUDENT/PARENT roles, same as it resolves the teacher for
 * TEACHER role, so no new backend/DTO work is needed.
 */
@Composable
fun StudentLeaveScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var leavesList by remember { mutableStateOf<List<TeacherLeaveItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    var showApplyDialog by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var leaveType by remember { mutableStateOf("") }
    var fromDate by remember { mutableStateOf("") }
    var toDate by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var refreshKey by remember { mutableStateOf(0) }

    fun loadLeaves() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val response = RetrofitClient.apiService.getTeacherLeaveRequests()
                if (response.isSuccessful && response.body() != null) {
                    leavesList = response.body()!!.data
                } else {
                    errorMessage = "Unable to load leave history (code ${response.code()})"
                }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Network error while loading leave history"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(refreshKey) { loadLeaves() }

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
                    unreadNotificationCount = 2,
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

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Leave Requests",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "GET/POST /api/school/leave-requests",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(SunsetOrange)
                                .clickable {
                                    leaveType = ""
                                    fromDate = ""
                                    toDate = ""
                                    reason = ""
                                    showApplyDialog = true
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(text = "Apply", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

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
                        leavesList.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No leave requests yet. Tap Apply to submit one.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(leavesList) { item ->
                                    val statusColor = when (item.status?.uppercase()) {
                                        "APPROVED" -> OnlineGreen
                                        "REJECTED", "CANCELLED" -> Color(0xFFEF4444)
                                        else -> WarningYellow
                                    }
                                    val datesStr = if (item.from_date == item.to_date) item.from_date else "${item.from_date} to ${item.to_date}"

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column(modifier = Modifier.fillMaxWidth()) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Icon(imageVector = Icons.Default.EventNote, contentDescription = "Leave", tint = SunsetOrange, modifier = Modifier.size(18.dp))
                                                    Spacer(modifier = Modifier.width(8.dp))
                                                    Text(text = item.leave_type, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                }
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(6.dp))
                                                        .background(statusColor.copy(alpha = 0.2f))
                                                        .border(width = 1.dp, color = statusColor, shape = RoundedCornerShape(6.dp))
                                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                                ) {
                                                    Text(text = item.status ?: "PENDING", fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = statusColor)
                                                }
                                            }

                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text(text = datesStr, fontSize = 12.sp, color = TextSecondary)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(text = item.reason, fontSize = 12.sp, color = TextSecondary)

                                            if (!item.reject_reason.isNullOrBlank()) {
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(text = "Reason: ${item.reject_reason}", fontSize = 11.sp, color = Color(0xFFEF4444))
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

            if (showApplyDialog) {
                AlertDialog(
                    onDismissRequest = { if (!isSubmitting) showApplyDialog = false },
                    containerColor = DarkCanvas,
                    title = {
                        Text(text = "Apply for Leave", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    },
                    text = {
                        Column {
                            OutlinedTextField(
                                value = leaveType,
                                onValueChange = { leaveType = it },
                                placeholder = { Text("Leave Type (e.g. Sick Leave)", color = TextSecondary) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = fromDate,
                                onValueChange = { fromDate = it },
                                placeholder = { Text("From Date (YYYY-MM-DD)", color = TextSecondary) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = toDate,
                                onValueChange = { toDate = it },
                                placeholder = { Text("To Date (YYYY-MM-DD)", color = TextSecondary) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = reason,
                                onValueChange = { reason = it },
                                placeholder = { Text("Reason for leave", color = TextSecondary) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = FrostedCard,
                                    unfocusedContainerColor = FrostedCard,
                                    focusedTextColor = TextPrimary,
                                    unfocusedTextColor = TextPrimary
                                )
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                if (leaveType.isNotBlank() && fromDate.isNotBlank() && toDate.isNotBlank() && reason.isNotBlank()) {
                                    isSubmitting = true
                                    scope.launch {
                                        try {
                                            val req = ApplyLeaveRequestDto(
                                                leave_type = leaveType,
                                                from_date = fromDate,
                                                to_date = toDate,
                                                reason = reason
                                            )
                                            val res = RetrofitClient.apiService.applyTeacherLeaveRequest(req)
                                            if (res.isSuccessful) {
                                                Toast.makeText(context, "Leave request submitted!", Toast.LENGTH_SHORT).show()
                                                showApplyDialog = false
                                                loadLeaves()
                                            } else {
                                                Toast.makeText(context, "Failed to submit (code ${res.code()})", Toast.LENGTH_SHORT).show()
                                            }
                                        } catch (e: Exception) {
                                            Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
                                        } finally {
                                            isSubmitting = false
                                        }
                                    }
                                } else {
                                    Toast.makeText(context, "Please fill in all fields.", Toast.LENGTH_SHORT).show()
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange),
                            enabled = !isSubmitting
                        ) {
                            Text(text = if (isSubmitting) "Submitting..." else "Submit", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { if (!isSubmitting) showApplyDialog = false }) {
                            Text(text = "Cancel", color = TextSecondary)
                        }
                    }
                )
            }
        }
    }
}
