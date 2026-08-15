package com.shikshapilot.nativeapp.features.schooladmin.screens

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
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.EventBusy
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
import com.shikshapilot.nativeapp.data.remote.ExtendFollowUpRequestDto
import com.shikshapilot.nativeapp.data.remote.FeeFollowUpItemDto
import com.shikshapilot.nativeapp.data.remote.MarkFollowUpContactedRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.UpdateFollowUpStatusRequestDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import kotlinx.coroutines.launch

/**
 * Backend: GET api/school/fee-follow-ups (SchoolAdminService::getFeeFollowUps, with stats +
 * paginated items) plus per-item actions: POST .../{id}/contacted, PUT .../{id}/extend, POST
 * .../{id}/notes, PUT .../{id}/status (all verified against SchoolAdminController /
 * SchoolAdminService and the `fee_follow_ups`/`fee_follow_up_notes` tables).
 */
@Composable
fun SchoolAdminFeeFollowUpScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var items by remember { mutableStateOf<List<FeeFollowUpItemDto>>(emptyList()) }
    var pendingCount by remember { mutableStateOf(0) }
    var overdueCount by remember { mutableStateOf(0) }
    var dueTodayCount by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }
    var actioningId by remember { mutableStateOf<Int?>(null) }
    var expandedId by remember { mutableStateOf<Int?>(null) }
    var extendDateInput by remember { mutableStateOf("") }

    LaunchedEffect(reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getFeeFollowUps()
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!!
                items = data.items
                pendingCount = data.stats?.pending ?: 0
                overdueCount = data.stats?.overdue ?: 0
                dueTodayCount = data.stats?.due_today ?: 0
            } else {
                errorMessage = "Unable to load fee follow-ups (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading fee follow-ups"
        } finally {
            isLoading = false
        }
    }

    fun markContacted(id: Int) {
        actioningId = id
        scope.launch {
            try {
                val res = RetrofitClient.apiService.markFollowUpContacted(id, MarkFollowUpContactedRequestDto())
                if (res.isSuccessful) {
                    Toast.makeText(context, "Marked as contacted", Toast.LENGTH_SHORT).show()
                    reloadKey++
                } else {
                    Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                actioningId = null
            }
        }
    }

    fun markCompleted(id: Int) {
        actioningId = id
        scope.launch {
            try {
                val res = RetrofitClient.apiService.updateFeeFollowUpStatus(id, UpdateFollowUpStatusRequestDto(status = "COMPLETED"))
                if (res.isSuccessful) {
                    Toast.makeText(context, "Marked as completed", Toast.LENGTH_SHORT).show()
                    reloadKey++
                } else {
                    Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                actioningId = null
            }
        }
    }

    fun extendFollowUp(id: Int, newDate: String) {
        if (newDate.isBlank()) {
            Toast.makeText(context, "Enter a new promised date (YYYY-MM-DD)", Toast.LENGTH_SHORT).show()
            return
        }
        actioningId = id
        scope.launch {
            try {
                val res = RetrofitClient.apiService.extendFeeFollowUp(id, ExtendFollowUpRequestDto(promised_date = newDate))
                if (res.isSuccessful) {
                    Toast.makeText(context, "Commitment extended", Toast.LENGTH_SHORT).show()
                    expandedId = null
                    extendDateInput = ""
                    reloadKey++
                } else {
                    Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                actioningId = null
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { reloadKey++ }) {
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
                            Text(text = "Fee Follow-Ups", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "Pending $pendingCount • Due Today $dueTodayCount • Overdue $overdueCount", fontSize = 9.5.sp, color = SunsetOrange)
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
                        items.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No fee follow-ups pending.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(items) { f ->
                                    val statusColor = when (f.status) {
                                        "OVERDUE" -> Color(0xFFEF4444)
                                        "DUE_TODAY" -> SunsetOrange
                                        "COMPLETED" -> Color(0xFF22C55E)
                                        else -> InfoBlue
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                            .padding(14.dp)
                                    ) {
                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(37.dp)
                                                        .clip(CircleShape)
                                                        .background(statusColor.copy(alpha = 0.18f))
                                                        .border(width = 1.dp, color = statusColor.copy(alpha = 0.4f), shape = CircleShape),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(imageVector = Icons.Default.EventBusy, contentDescription = "Follow up", tint = statusColor, modifier = Modifier.size(20.dp))
                                                }
                                                Spacer(modifier = Modifier.width(10.dp))
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(text = f.student_name ?: "Student", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                    Text(text = "${f.class_name ?: ""} • Promise: ${f.promised_date ?: "—"}", fontSize = 10.sp, color = TextSecondary)
                                                    Text(text = "Pending: ₹ ${"%,.0f".format(f.pending_amount)}", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                                                }
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(statusColor.copy(alpha = 0.18f))
                                                        .padding(horizontal = 7.dp, vertical = 3.dp)
                                                ) {
                                                    Text(text = f.status ?: "PENDING", fontSize = 8.5.sp, fontWeight = FontWeight.Bold, color = statusColor)
                                                }
                                            }

                                            if (f.status != "COMPLETED") {
                                                Spacer(modifier = Modifier.height(8.dp))
                                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(RoundedCornerShape(8.dp))
                                                            .background(InfoBlue)
                                                            .clickable(enabled = actioningId != f.id) { markContacted(f.id) }
                                                            .padding(horizontal = 8.dp, vertical = 5.dp)
                                                    ) {
                                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                                            Icon(imageVector = Icons.Default.Call, contentDescription = "Contacted", tint = Color.White, modifier = Modifier.size(20.dp))
                                                            Spacer(modifier = Modifier.width(3.dp))
                                                            Text(text = "Contacted", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                                        }
                                                    }
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(RoundedCornerShape(8.dp))
                                                            .background(SunsetOrange)
                                                            .clickable(enabled = actioningId != f.id) {
                                                                expandedId = if (expandedId == f.id) null else f.id
                                                            }
                                                            .padding(horizontal = 8.dp, vertical = 5.dp)
                                                    ) {
                                                        Text(text = "Extend", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                                    }
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(RoundedCornerShape(8.dp))
                                                            .background(Color(0xFF22C55E))
                                                            .clickable(enabled = actioningId != f.id) { markCompleted(f.id) }
                                                            .padding(horizontal = 8.dp, vertical = 5.dp)
                                                    ) {
                                                        Text(text = "Completed", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                                    }
                                                }

                                                if (expandedId == f.id) {
                                                    Spacer(modifier = Modifier.height(6.dp))
                                                    OutlinedTextField(
                                                        value = extendDateInput,
                                                        onValueChange = { extendDateInput = it },
                                                        label = { Text("New promised date (YYYY-MM-DD)") },
                                                        modifier = Modifier.fillMaxWidth(),
                                                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                                    )
                                                    Spacer(modifier = Modifier.height(5.dp))
                                                    Box(
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .clip(RoundedCornerShape(8.dp))
                                                            .background(SunsetOrange)
                                                            .clickable { extendFollowUp(f.id, extendDateInput) }
                                                            .padding(vertical = 8.dp),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Text(text = "Confirm Extension", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
