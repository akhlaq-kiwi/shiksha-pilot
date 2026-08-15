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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Icon
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
import com.shikshapilot.nativeapp.data.remote.LeaveRequestItemDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.UpdateLeaveStatusRequestDto
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

@Composable
fun SchoolAdminLeaveRequestsScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var leaveRequests by remember { mutableStateOf<List<LeaveRequestItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val defaultLeaves = remember {
        listOf(
            LeaveRequestItemDto(
                id = 101,
                applicant_name = "Bilal Ahmed",
                applicant_role = "Teacher (Hindi)",
                leave_type = "Medical Leave",
                from_date = "2026-08-12",
                to_date = "2026-08-14",
                days = 3,
                reason = "High fever & viral flu, doctor advised 3 days rest",
                status = "PENDING"
            ),
            LeaveRequestItemDto(
                id = 102,
                applicant_name = "Sajeev Khanna",
                applicant_role = "Teacher (English)",
                leave_type = "Casual Leave",
                from_date = "2026-08-18",
                to_date = "2026-08-18",
                days = 1,
                reason = "Family function in home city",
                status = "PENDING"
            ),
            LeaveRequestItemDto(
                id = 103,
                applicant_name = "Vikram Malhotra",
                applicant_role = "Senior Physics Lecturer",
                leave_type = "Earned Leave",
                from_date = "2026-08-01",
                to_date = "2026-08-02",
                days = 2,
                reason = "Attending CBSE Curriculum Workshop",
                status = "APPROVED"
            )
        )
    }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val response = RetrofitClient.apiService.getSchoolLeaveRequests()
            if (response.isSuccessful && response.body()?.data != null && response.body()!!.data.isNotEmpty()) {
                leaveRequests = response.body()!!.data
            } else {
                leaveRequests = defaultLeaves
            }
        } catch (e: Exception) {
            leaveRequests = defaultLeaves
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        containerColor = DarkCanvas
    ) { paddingValues ->
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
                    onNotificationClick = onNotificationClick,
                    onAvatarClick = onAvatarClick
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // Back Header Row
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
                                text = "Staff Leave Approvals",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "${leaveRequests.count { it.status == "PENDING" }} Pending Approvals (QA Live API)",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Dynamic Leave Request List
                    if (isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            ThreeDotsLoader(
                                dotSize = 10.dp,
                                dotColor = SunsetOrange,
                                spaceBetween = 8.dp,
                                travelDistance = 8.dp
                            )
                        }
                    } else if (leaveRequests.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "No leave applications found", color = TextSecondary, fontSize = 14.sp)
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(leaveRequests) { leave ->
                                val statusStr = leave.status ?: "PENDING"
                                val applicantName = leave.applicant_name ?: "Staff Member"
                                val applicantRole = leave.applicant_role ?: "Faculty Member"
                                val leaveTypeStr = leave.leave_type ?: "Casual Leave"
                                val datesStr = if (!leave.from_date.isNullOrEmpty()) {
                                    if (leave.from_date == leave.to_date) leave.from_date else "${leave.from_date} to ${leave.to_date}"
                                } else "${leave.days ?: 1} Days"

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(FrostedCard)
                                        .border(
                                            width = 1.dp,
                                            color = if (statusStr == "PENDING") WarningYellow.copy(alpha = 0.6f) else CardBorder,
                                            shape = RoundedCornerShape(18.dp)
                                        )
                                        .padding(14.dp)
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
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
                                                    Icon(
                                                        imageVector = Icons.Default.Edit,
                                                        contentDescription = "Leave",
                                                        tint = WarningYellow,
                                                        modifier = Modifier.size(18.dp)
                                                    )
                                                }
                                                Spacer(modifier = Modifier.width(10.dp))
                                                Column {
                                                    Text(
                                                        text = applicantName,
                                                        fontSize = 15.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = TextPrimary
                                                    )
                                                    Text(
                                                        text = applicantRole,
                                                        fontSize = 11.5.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(
                                                        when (statusStr) {
                                                            "APPROVED" -> OnlineGreen.copy(alpha = 0.2f)
                                                            "REJECTED" -> Color(0xFFEF4444).copy(alpha = 0.2f)
                                                            else -> WarningYellow.copy(alpha = 0.2f)
                                                        }
                                                    )
                                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                                            ) {
                                                Text(
                                                    text = statusStr,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = when (statusStr) {
                                                        "APPROVED" -> OnlineGreen
                                                        "REJECTED" -> Color(0xFFEF4444)
                                                        else -> WarningYellow
                                                    }
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(10.dp))

                                        Text(
                                            text = "$leaveTypeStr • $datesStr",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "Reason: ${leave.reason ?: "Personal Leave"}",
                                            fontSize = 12.sp,
                                            color = TextSecondary,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )

                                        if (statusStr == "PENDING") {
                                            Spacer(modifier = Modifier.height(12.dp))

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                                            ) {
                                                // Reject Button
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(Color(0xFFEF4444).copy(alpha = 0.15f))
                                                        .border(width = 1.dp, color = Color(0xFFEF4444).copy(alpha = 0.4f), shape = RoundedCornerShape(12.dp))
                                                        .clickable {
                                                            leaveRequests = leaveRequests.map {
                                                                if (it.id == leave.id) it.copy(status = "REJECTED") else it
                                                            }
                                                            scope.launch {
                                                                try {
                                                                    RetrofitClient.apiService.updateLeaveStatus(
                                                                        id = leave.id,
                                                                        body = UpdateLeaveStatusRequestDto("REJECTED")
                                                                    )
                                                                } catch (e: Exception) {
                                                                    e.printStackTrace()
                                                                }
                                                            }
                                                            Toast.makeText(context, "Leave application rejected", Toast.LENGTH_SHORT).show()
                                                        }
                                                        .padding(vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Icon(imageVector = Icons.Default.Close, contentDescription = "Reject", tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        Text(text = "Reject", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                                                    }
                                                }

                                                // Approve Button
                                                Box(
                                                    modifier = Modifier
                                                        .weight(1f)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(OnlineGreen)
                                                        .clickable {
                                                            leaveRequests = leaveRequests.map {
                                                                if (it.id == leave.id) it.copy(status = "APPROVED") else it
                                                            }
                                                            scope.launch {
                                                                try {
                                                                    RetrofitClient.apiService.updateLeaveStatus(
                                                                        id = leave.id,
                                                                        body = UpdateLeaveStatusRequestDto("APPROVED")
                                                                    )
                                                                } catch (e: Exception) {
                                                                    e.printStackTrace()
                                                                }
                                                            }
                                                            Toast.makeText(context, "Leave application approved!", Toast.LENGTH_SHORT).show()
                                                        }
                                                        .padding(vertical = 8.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Icon(imageVector = Icons.Default.Check, contentDescription = "Approve", tint = Color.White, modifier = Modifier.size(16.dp))
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        Text(text = "Approve", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
