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
import androidx.compose.material.icons.filled.Person
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
import com.shikshapilot.nativeapp.data.remote.PayStaffSalaryRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.StaffPaymentItemDto
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
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Backend: GET api/school/staff-payments?month=... (SchoolAdminService::getStaffPayments) lists
 * every active staff member with payable/prorated salary + Paid/Pending status for the given
 * month; POST api/school/staff-payments (SchoolAdminService::payStaffSalary) disburses a single
 * staff member's salary for that month. `disburse-previous-year` bulk-catch-up flow is deferred
 * (see PARITY_GAPS.md) — this screen covers the primary month-by-month disbursement flow.
 */
@Composable
fun SchoolAdminSalaryDisbursementScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val currentMonthName = remember { SimpleDateFormat("MMMM", Locale.ENGLISH).format(java.util.Date()) }
    var monthInput by remember { mutableStateOf(currentMonthName) }
    var staffList by remember { mutableStateOf<List<StaffPaymentItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }
    var disbursingId by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(reloadKey, monthInput) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getStaffPayments(monthInput)
            if (response.isSuccessful && response.body() != null) {
                staffList = response.body()!!.data
            } else {
                errorMessage = "Unable to load staff payments (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading staff payments"
        } finally {
            isLoading = false
        }
    }

    fun disburse(staffId: Int) {
        disbursingId = staffId
        scope.launch {
            try {
                val res = RetrofitClient.apiService.payStaffSalary(PayStaffSalaryRequestDto(staff_id = staffId, month = monthInput))
                if (res.isSuccessful) {
                    Toast.makeText(context, "Salary disbursed", Toast.LENGTH_SHORT).show()
                    reloadKey++
                } else {
                    Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
            } finally {
                disbursingId = null
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
                            Text(text = "Salary Disbursement", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "${staffList.size} staff • QA Live API", fontSize = 11.5.sp, color = SunsetOrange)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = monthInput,
                        onValueChange = { monthInput = it },
                        label = { Text("Month (e.g. April)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                    )

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
                        staffList.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No active staff found.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(staffList) { s ->
                                    val isPaid = s.status == "Paid"
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(18.dp))
                                            .background(FrostedCard)
                                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(42.dp)
                                                    .clip(CircleShape)
                                                    .background(SunsetOrange.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(imageVector = Icons.Default.Person, contentDescription = "Staff", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = s.name ?: "Staff", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Text(text = s.designation ?: "", fontSize = 12.sp, color = TextSecondary)
                                                Text(text = "Payable: ₹ ${"%,.0f".format(s.payable_salary)}", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                                            }

                                            if (isPaid) {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(OnlineGreen.copy(alpha = 0.18f))
                                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                                ) {
                                                    Text(text = "Paid", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OnlineGreen)
                                                }
                                            } else {
                                                Box(
                                                    modifier = Modifier
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .background(if (disbursingId == s.id) SunsetOrange.copy(alpha = 0.5f) else SunsetOrange)
                                                        .clickable(enabled = disbursingId != s.id) { disburse(s.id) }
                                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                                ) {
                                                    Text(text = if (disbursingId == s.id) "..." else "Disburse", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
