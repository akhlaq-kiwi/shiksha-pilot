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
import androidx.compose.material.icons.filled.Payments
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
import com.shikshapilot.nativeapp.data.remote.CollectionHistoryItemDto
import com.shikshapilot.nativeapp.data.remote.CreateFeePaymentRequestDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
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

/**
 * Backend: POST api/school/fee-payments (SchoolAdminController::createFeePayment ->
 * SchoolAdminService::createFeePayment) to record a monthly fee payment, and
 * GET api/school/collection-history (SchoolAdminService::getCollectionHistory) to list the
 * merged monthly+additional fee transaction ledger with running balance/stats. Replaces the
 * generic `SchoolAdminFinanceScreen`'s core "record + view collections" purpose.
 */
@Composable
fun SchoolAdminFeeCollectionScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var transactions by remember { mutableStateOf<List<CollectionHistoryItemDto>>(emptyList()) }
    var totalCollected by remember { mutableStateOf(0.0) }
    var todayCollection by remember { mutableStateOf(0.0) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    var showRecordForm by remember { mutableStateOf(false) }
    var studentIdInput by remember { mutableStateOf("") }
    var feeMonthInput by remember { mutableStateOf("") }
    var amountInput by remember { mutableStateOf("") }
    var paymentMethodInput by remember { mutableStateOf("Cash") }
    var isSaving by remember { mutableStateOf(false) }

    LaunchedEffect(reloadKey) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getCollectionHistory()
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!!
                transactions = data.transactions
                totalCollected = data.stats?.total_collected ?: 0.0
                todayCollection = data.stats?.today_collection ?: 0.0
            } else {
                errorMessage = "Unable to load collection history (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading collection history"
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
                            Text(text = "Fee Collection", fontSize = 15.5.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(text = "QA Server: api/school/fee-payments, collection-history", fontSize = 9.5.sp, color = SunsetOrange)
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(SunsetOrange)
                                .clickable { showRecordForm = !showRecordForm }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(text = "Record Payment", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

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
                                Text(text = "Total Collected", fontSize = 9.5.sp, color = TextSecondary)
                                Text(text = "₹ ${"%,.0f".format(totalCollected)}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = OnlineGreen)
                            }
                        }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                .padding(12.dp)
                        ) {
                            Column {
                                Text(text = "Today's Collection", fontSize = 9.5.sp, color = TextSecondary)
                                Text(text = "₹ ${"%,.0f".format(todayCollection)}", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(11.dp))

                    if (showRecordForm) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(FrostedCard)
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                .padding(14.dp)
                        ) {
                            Column {
                                Text(text = "Record Fee Payment", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = studentIdInput,
                                    onValueChange = { studentIdInput = it },
                                    label = { Text("Student ID") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = feeMonthInput,
                                    onValueChange = { feeMonthInput = it },
                                    label = { Text("Fee Month (e.g. April)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = amountInput,
                                    onValueChange = { amountInput = it },
                                    label = { Text("Amount Paid (optional override)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                OutlinedTextField(
                                    value = paymentMethodInput,
                                    onValueChange = { paymentMethodInput = it },
                                    label = { Text("Payment Method (Cash/Online/etc.)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary)
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isSaving) SunsetOrange.copy(alpha = 0.5f) else SunsetOrange)
                                        .clickable(enabled = !isSaving) {
                                            val studentId = studentIdInput.toIntOrNull()
                                            if (studentId == null || feeMonthInput.isBlank()) {
                                                Toast.makeText(context, "Student ID and Fee Month are required", Toast.LENGTH_SHORT).show()
                                                return@clickable
                                            }
                                            isSaving = true
                                            scope.launch {
                                                try {
                                                    val res = RetrofitClient.apiService.createFeePayment(
                                                        CreateFeePaymentRequestDto(
                                                            student_id = studentId,
                                                            fee_month = feeMonthInput,
                                                            amount_paid = amountInput.toDoubleOrNull(),
                                                            payment_method = paymentMethodInput.ifBlank { "Cash" }
                                                        )
                                                    )
                                                    if (res.isSuccessful) {
                                                        Toast.makeText(context, "Payment recorded", Toast.LENGTH_SHORT).show()
                                                        studentIdInput = ""; feeMonthInput = ""; amountInput = ""
                                                        showRecordForm = false
                                                        reloadKey++
                                                    } else {
                                                        Toast.makeText(context, "Failed (code ${res.code()})", Toast.LENGTH_SHORT).show()
                                                    }
                                                } catch (e: Exception) {
                                                    Toast.makeText(context, e.message ?: "Network error", Toast.LENGTH_SHORT).show()
                                                } finally {
                                                    isSaving = false
                                                }
                                            }
                                        }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(text = if (isSaving) "Saving..." else "Record Payment", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(11.dp))
                    }

                    Text(
                        text = "COLLECTION HISTORY (QA LIVE API)",
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
                        transactions.isEmpty() -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No fee collections recorded yet.", color = TextSecondary, fontSize = 11.sp)
                            }
                        }
                        else -> {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(transactions) { txn ->
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
                                                    .size(37.dp)
                                                    .clip(CircleShape)
                                                    .background(OnlineGreen.copy(alpha = 0.18f))
                                                    .border(width = 1.dp, color = OnlineGreen.copy(alpha = 0.4f), shape = CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Payments,
                                                    contentDescription = "Payment",
                                                    tint = OnlineGreen,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }

                                            Spacer(modifier = Modifier.width(10.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(text = txn.student_name ?: "Student", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Text(
                                                    text = "${txn.fee_name ?: ""} • ${txn.class_name ?: ""}",
                                                    fontSize = 10.sp,
                                                    color = TextSecondary
                                                )
                                                Text(
                                                    text = "Receipt: ${txn.receipt_no ?: "—"} • ${txn.payment_date ?: ""}",
                                                    fontSize = 9.5.sp,
                                                    color = TextSecondary
                                                )
                                            }

                                            Text(
                                                text = "₹ ${"%,.0f".format(txn.amount)}",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = OnlineGreen
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
