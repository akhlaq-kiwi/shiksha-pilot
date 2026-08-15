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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.AuditLogItemDto
import com.shikshapilot.nativeapp.data.remote.LoginHistoryItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.components.ThreeDotsLoader
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary

/**
 * Backend: GET api/school/security/audit-logs (SchoolAdminService::getSchoolAuditLogs, reads
 * `audit_logs` table filtered by target_school; supports page/limit/date_filter/module/search) and
 * GET api/school/security/login-history (same table, action IN ('User Logged In', 'Failed Login
 * Attempt')). Both read-only, paginated 25/page. `POST .../audit-logs/log` (client-side action
 * logging) is not called from native — it's a write-only fire-and-forget endpoint the web app uses
 * to log its own UI actions, not relevant to a read-only native audit viewer.
 */
@Composable
fun SchoolAdminSecurityScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    var activeTab by remember { mutableStateOf(0) } // 0 = Audit Logs, 1 = Login History

    var auditLogs by remember { mutableStateOf<List<AuditLogItemDto>>(emptyList()) }
    var loginHistory by remember { mutableStateOf<List<LoginHistoryItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(activeTab) {
        isLoading = true
        errorMessage = null
        try {
            if (activeTab == 0) {
                val response = RetrofitClient.apiService.getSchoolAuditLogs(page = 1, limit = 50)
                if (response.isSuccessful && response.body() != null) {
                    auditLogs = response.body()!!.data?.logs ?: emptyList()
                } else {
                    errorMessage = "Unable to load audit logs (code ${response.code()})"
                }
            } else {
                val response = RetrofitClient.apiService.getSchoolLoginHistory(page = 1, limit = 50)
                if (response.isSuccessful && response.body() != null) {
                    loginHistory = response.body()!!.data?.history ?: emptyList()
                } else {
                    errorMessage = "Unable to load login history (code ${response.code()})"
                }
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error"
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
                            Text(text = "Security", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "Audit logs & login history", fontSize = 11.5.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(FrostedCard)
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(14.dp))
                            .padding(4.dp)
                    ) {
                        listOf("Audit Logs" to 0, "Login History" to 1).forEach { (label, idx) ->
                            val selected = activeTab == idx
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) SunsetOrange else androidx.compose.ui.graphics.Color.Transparent)
                                    .clickable { activeTab = idx }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) androidx.compose.ui.graphics.Color.White else TextSecondary
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

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
                        activeTab == 0 -> {
                            if (auditLogs.isEmpty()) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text(text = "No audit log entries found.", color = TextSecondary, fontSize = 13.sp)
                                }
                            } else {
                                LazyColumn(
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    items(auditLogs) { log ->
                                        AuditLogCard(log)
                                    }
                                }
                            }
                        }
                        else -> {
                            if (loginHistory.isEmpty()) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text(text = "No login history found.", color = TextSecondary, fontSize = 13.sp)
                                }
                            } else {
                                LazyColumn(
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    items(loginHistory) { entry ->
                                        LoginHistoryCard(entry)
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
private fun AuditLogCard(log: AuditLogItemDto) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(SunsetOrange.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.Security, contentDescription = "Audit", tint = SunsetOrange, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = log.action ?: "Action", fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                if (!log.description.isNullOrBlank()) {
                    Text(text = log.description, fontSize = 12.sp, color = TextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row {
                    if (!log.module.isNullOrBlank()) {
                        Text(text = log.module, fontSize = 11.sp, color = SunsetOrange, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(text = log.performed_by ?: log.user ?: "System", fontSize = 11.sp, color = TextSecondary)
                }
                Text(text = log.formatted_date ?: log.created_at ?: "", fontSize = 10.5.sp, color = TextSecondary)
            }
        }
    }
}

@Composable
private fun LoginHistoryCard(entry: LoginHistoryItemDto) {
    val isSuccess = entry.status == "Success"
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(FrostedCard)
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background((if (isSuccess) OnlineGreen else androidx.compose.ui.graphics.Color(0xFFEF4444)).copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = Icons.Default.History, contentDescription = "Login", tint = if (isSuccess) OnlineGreen else androidx.compose.ui.graphics.Color(0xFFEF4444), modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = entry.performed_by ?: entry.user ?: "Unknown user", fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(text = entry.formatted_date ?: entry.created_at ?: "", fontSize = 11.sp, color = TextSecondary)
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background((if (isSuccess) OnlineGreen else androidx.compose.ui.graphics.Color(0xFFEF4444)).copy(alpha = 0.18f))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(
                    text = entry.status ?: "—",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isSuccess) OnlineGreen else androidx.compose.ui.graphics.Color(0xFFEF4444)
                )
            }
        }
    }
}
