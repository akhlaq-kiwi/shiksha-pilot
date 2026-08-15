package com.shikshapilot.nativeapp.features.teacher.screens

import android.content.Intent
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
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Payments
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
import androidx.core.content.FileProvider
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TeacherSalaryPaymentDto
import com.shikshapilot.nativeapp.data.remote.TeacherSalariesDataDto
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun TeacherSalariesScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var salaryData by remember { mutableStateOf<TeacherSalariesDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var downloadingId by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        errorMessage = null
        try {
            val response = RetrofitClient.apiService.getTeacherSalaries()
            if (response.isSuccessful && response.body() != null) {
                salaryData = response.body()!!.data
            } else {
                errorMessage = "Unable to load salary history (code ${response.code()})"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Network error while loading salary history"
        } finally {
            isLoading = false
        }
    }

    fun openReceipt(paymentId: Int) {
        scope.launch {
            downloadingId = paymentId
            try {
                val response = RetrofitClient.apiService.getTeacherSalaryReceipt(paymentId)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val file = withContext(Dispatchers.IO) {
                        val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
                        val f = File(dir, "salary_receipt_$paymentId.pdf")
                        body.byteStream().use { input ->
                            f.outputStream().use { output -> input.copyTo(output) }
                        }
                        f
                    }
                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                } else {
                    Toast.makeText(context, "Unable to fetch receipt (code ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Unable to open receipt: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                downloadingId = null
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
                                text = "My Salary",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "QA Server: GET /api/teacher/salaries",
                                fontSize = 11.5.sp,
                                color = SunsetOrange
                            )
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
                        salaryData == null -> {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text(text = "No salary records found.", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                        else -> {
                            val currentYear = salaryData?.current_year
                            val previousYear = salaryData?.previous_year
                            val allPayments = mutableListOf<Pair<String, TeacherSalaryPaymentDto>>()
                            currentYear?.payments?.forEach { allPayments.add((currentYear.academic_year_name ?: "Current Year") to it) }
                            if (previousYear != null && previousYear.payments.isNotEmpty()) {
                                previousYear.payments.forEach { allPayments.add((previousYear.academic_year_name ?: "Previous Year") to it) }
                            }

                            if (allPayments.isEmpty()) {
                                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text(text = "No salary records found.", color = TextSecondary, fontSize = 13.sp)
                                }
                            } else {
                                LazyColumn(
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    items(allPayments) { (yearName, payment) ->
                                        val isPaid = payment.status?.equals("Paid", ignoreCase = true) == true
                                        val statusColor = if (isPaid) OnlineGreen else WarningYellow
                                        val canDownload = isPaid && (payment.id ?: 0) > 0

                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(FrostedCard)
                                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                                .padding(14.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(40.dp)
                                                            .clip(CircleShape)
                                                            .background(SunsetOrange.copy(alpha = 0.18f)),
                                                        contentAlignment = Alignment.Center
                                                    ) {
                                                        Icon(imageVector = Icons.Default.Payments, contentDescription = "Salary", tint = SunsetOrange, modifier = Modifier.size(18.dp))
                                                    }
                                                    Spacer(modifier = Modifier.width(12.dp))
                                                    Column {
                                                        Text(text = "${payment.month ?: "-"} • $yearName", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                        Text(text = "₹${payment.salary ?: 0.0}", fontSize = 12.5.sp, color = TextSecondary)
                                                        if (!payment.disbursed_date.isNullOrBlank()) {
                                                            Text(text = "Paid on ${payment.disbursed_date}", fontSize = 10.5.sp, color = TextSecondary)
                                                        }
                                                    }
                                                }

                                                Column(horizontalAlignment = Alignment.End) {
                                                    Box(
                                                        modifier = Modifier
                                                            .clip(RoundedCornerShape(6.dp))
                                                            .background(statusColor.copy(alpha = 0.2f))
                                                            .border(width = 1.dp, color = statusColor, shape = RoundedCornerShape(6.dp))
                                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                                    ) {
                                                        Text(text = payment.status ?: "Pending", fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = statusColor)
                                                    }

                                                    if (canDownload) {
                                                        Spacer(modifier = Modifier.height(6.dp))
                                                        Box(
                                                            modifier = Modifier
                                                                .clip(CircleShape)
                                                                .clickable(enabled = downloadingId != payment.id) {
                                                                    openReceipt(payment.id ?: 0)
                                                                }
                                                                .padding(4.dp)
                                                        ) {
                                                            Icon(
                                                                imageVector = Icons.Default.Download,
                                                                contentDescription = "Download Receipt",
                                                                tint = if (downloadingId == payment.id) TextSecondary else SunsetOrange,
                                                                modifier = Modifier.size(18.dp)
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
        }
    }
}
