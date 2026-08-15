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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SaveLatePaymentPenaltyConfigRequestDto
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
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/**
 * Backend: GET api/school/late-payment-penalty/{stats,config}, POST/DELETE .../config
 * (SchoolAdminController::getLatePaymentPenaltyStats/getLatePaymentPenaltyConfig/
 * saveLatePaymentPenaltyConfig/deleteLatePaymentPenaltyConfig). Matches web
 * FinanceManagementPage.jsx's late-payment-penalty tab's config form + stats card. Bulk "apply
 * penalty now" run/history (late_payment_penalty_applications) not implemented — this screen only
 * configures the percentage/status, matching the smaller, well-scoped part of that web tab.
 */
@Composable
fun SchoolAdminLatePaymentPenaltyScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }
    var isSaving by remember { mutableStateOf(false) }

    var academicSession by remember { mutableStateOf<String?>(null) }
    var totalStudents by remember { mutableStateOf(0) }
    var studentsHavingDue by remember { mutableStateOf(0) }
    var totalOutstandingDue by remember { mutableStateOf(0.0) }
    var lastAppliedDate by remember { mutableStateOf<String?>(null) }
    var lastAppliedBy by remember { mutableStateOf<String?>(null) }

    var percentageInput by remember { mutableStateOf("") }
    var descriptionInput by remember { mutableStateOf("") }
    var isActive by remember { mutableStateOf(false) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        errorMessage = null
        try {
            val statsRes = RetrofitClient.apiService.getLatePaymentPenaltyStats()
            if (statsRes.isSuccessful && statsRes.body()?.data != null) {
                val d = statsRes.body()!!.data!!
                academicSession = d.current_academic_session
                totalStudents = d.total_students
                studentsHavingDue = d.students_having_due
                totalOutstandingDue = d.total_outstanding_due
                lastAppliedDate = d.last_applied_date
                lastAppliedBy = d.last_applied_by
            }
            val configRes = RetrofitClient.apiService.getLatePaymentPenaltyConfig()
            if (configRes.isSuccessful && configRes.body()?.data != null) {
                val c = configRes.body()!!.data!!
                percentageInput = c.percentageOrNull()?.toString() ?: ""
                descriptionInput = c.description ?: ""
                isActive = c.status == "Active"
            } else {
                errorMessage = "Unable to load penalty config (code ${configRes.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading penalty settings"
        } finally {
            isLoading = false
        }
    }

    fun saveConfig() {
        val pct = percentageInput.toDoubleOrNull()
        if (pct == null || pct <= 0 || pct > 100) {
            Toast.makeText(context, "Enter a valid percentage between 0.01 and 100.", Toast.LENGTH_SHORT).show()
            return
        }
        isSaving = true
        scope.launch {
            try {
                val response = RetrofitClient.apiService.saveLatePaymentPenaltyConfig(
                    SaveLatePaymentPenaltyConfigRequestDto(
                        percentage = pct,
                        description = descriptionInput.ifBlank { null },
                        status = if (isActive) "Active" else "Inactive"
                    )
                )
                if (response.isSuccessful) {
                    Toast.makeText(context, "Penalty configuration saved", Toast.LENGTH_SHORT).show()
                    refreshKey++
                } else {
                    Toast.makeText(context, "Failed to save (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                isSaving = false
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
                                text = "Late-Payment Penalty",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = academicSession ?: "No active academic session",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (isLoading) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            ThreeDotsLoader(dotSize = 10.dp, dotColor = SunsetOrange, spaceBetween = 8.dp, travelDistance = 8.dp)
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                    .padding(12.dp)
                            ) {
                                Column {
                                    Text(text = "Students with Dues", fontSize = 11.sp, color = TextSecondary)
                                    Text(text = "$studentsHavingDue / $totalStudents", fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = Color(0xFFEF4444).copy(alpha = 0.5f), shape = RoundedCornerShape(16.dp))
                                    .padding(12.dp)
                            ) {
                                Column {
                                    Text(text = "Total Outstanding", fontSize = 11.sp, color = TextSecondary)
                                    Text(text = currencyFormatter.format(totalOutstandingDue), fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFEF4444))
                                }
                            }
                        }

                        if (lastAppliedDate != null) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Last applied $lastAppliedDate${lastAppliedBy?.let { " by $it" } ?: ""}",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                .padding(16.dp)
                        ) {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(text = "Penalty Configuration", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Switch(
                                        checked = isActive,
                                        onCheckedChange = { isActive = it },
                                        colors = SwitchDefaults.colors(checkedThumbColor = OnlineGreen)
                                    )
                                }

                                Spacer(modifier = Modifier.height(14.dp))

                                Text(text = "Penalty Percentage (%)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = percentageInput,
                                    onValueChange = { percentageInput = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    placeholder = { Text("e.g. 2.5") },
                                    singleLine = true,
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = DarkCanvas,
                                        unfocusedContainerColor = DarkCanvas,
                                        focusedBorderColor = SunsetOrange,
                                        unfocusedBorderColor = CardBorder,
                                        focusedTextColor = TextPrimary,
                                        unfocusedTextColor = TextPrimary
                                    )
                                )

                                Spacer(modifier = Modifier.height(14.dp))

                                Text(text = "Description (Optional)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSecondary)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = descriptionInput,
                                    onValueChange = { descriptionInput = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    placeholder = { Text("e.g. Applied monthly on overdue fees") },
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = DarkCanvas,
                                        unfocusedContainerColor = DarkCanvas,
                                        focusedBorderColor = SunsetOrange,
                                        unfocusedBorderColor = CardBorder,
                                        focusedTextColor = TextPrimary,
                                        unfocusedTextColor = TextPrimary
                                    )
                                )

                                Spacer(modifier = Modifier.height(18.dp))

                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    Button(
                                        onClick = { saveConfig() },
                                        enabled = !isSaving,
                                        colors = ButtonDefaults.buttonColors(containerColor = SunsetOrange)
                                    ) {
                                        if (isSaving) {
                                            ThreeDotsLoader(dotSize = 6.dp, dotColor = Color.White, spaceBetween = 4.dp, travelDistance = 4.dp)
                                        } else {
                                            Text("Save Configuration", fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

                        if (errorMessage != null) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(text = errorMessage ?: "", fontSize = 12.sp, color = Color(0xFFEF4444))
                        }
                    }
                }
            }
            }
        }
    }
}
