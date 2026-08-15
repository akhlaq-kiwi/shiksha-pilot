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
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.MoneyOff
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PriceChange
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.ReceiptLong
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.SchoolStatsDataDto
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import java.text.NumberFormat
import java.util.Locale

private data class FinanceModuleItem(
    val screenId: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector
)

private val financeModules = listOf(
    FinanceModuleItem("fee_structure", "Fee Structures", "Configure per-class fee amounts", Icons.Default.Receipt),
    FinanceModuleItem("fee_collection", "Fee Collection", "Record payments & collection history", Icons.Default.Payments),
    FinanceModuleItem("fee_follow_up", "Fee Follow-Ups", "Track defaulters & payment commitments", Icons.Default.EventBusy),
    FinanceModuleItem("salary_disbursement", "Salary Disbursement", "Pay monthly staff salaries", Icons.Default.AccountBalanceWallet),
    FinanceModuleItem("financial_reports", "Financial Reports", "Generate & review profit/loss reports", Icons.Default.Assessment),
    FinanceModuleItem("transport_fees", "Transport Fees", "Assign & manage student transport charges", Icons.Default.DirectionsBus),
    FinanceModuleItem("school_expenses", "School Expenses", "Record & track school expenditures", Icons.Default.MoneyOff),
    FinanceModuleItem("late_payment_penalty", "Late-Payment Penalty", "Configure penalty percentage on overdue fees", Icons.Default.PriceChange),
    FinanceModuleItem("additional_fees", "Additional Fees", "Apply one-off fees to all active students", Icons.Default.ReceiptLong)
)

/**
 * Finance module hub — repurposed from the old single generic finance stub into a menu that
 * links out to the dedicated finance screens (fee structures, fee collection, follow-ups,
 * salary disbursement, financial reports, transport fees), matching how the web splits finance
 * into ~8 pages (frontend/src/features/school-admin/pages/Finance*.jsx). See
 * native-app/MODULE_TODO.md for what's still deferred (additional fee/late-payment penalty
 * config, expenses, finance settings).
 */
@Composable
fun SchoolAdminFinanceScreen(
    schoolName: String = "Jamiya Kids Planet Academy",
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onAvatarClick: () -> Unit = {}
) {
    var statsDto by remember { mutableStateOf<SchoolStatsDataDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    LaunchedEffect(refreshKey) {
        isLoading = true
        try {
            val statsRes = RetrofitClient.apiService.getSchoolStats()
            if (statsRes.isSuccessful && statsRes.body()?.data != null) {
                statsDto = statsRes.body()!!.data
            }
        } catch (_: Exception) {
            // Non-fatal: hub tiles work without stats.
        } finally {
            isLoading = false
        }
    }

    val totalCollectedStr = statsDto?.let { currencyFormatter.format(it.total_collected) } ?: "₹ 0"
    val pendingDuesStr = statsDto?.let { currencyFormatter.format(it.pending_fees) } ?: "₹ 0"

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
                                text = "Finance",
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Fee structures, collection, follow-ups, salaries, reports",
                                fontSize = 9.5.sp,
                                color = SunsetOrange
                            )
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
                                Text(text = "Collected (Academic Year)", fontSize = 9.5.sp, color = TextSecondary)
                                Text(text = totalCollectedStr, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = OnlineGreen)
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
                                Text(text = "Pending Dues", fontSize = 9.5.sp, color = TextSecondary)
                                Text(text = pendingDuesStr, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFEF4444))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    Text(
                        text = "FINANCE MODULES",
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 1.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(financeModules) { module ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(FrostedCard)
                                    .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
                                    .clickable { onNavigate(module.screenId) }
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
                                            .background(SunsetOrange.copy(alpha = 0.18f))
                                            .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = module.icon,
                                            contentDescription = module.title,
                                            tint = SunsetOrange,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }

                                    Spacer(modifier = Modifier.width(10.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = module.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text(text = module.subtitle, fontSize = 10.sp, color = TextSecondary)
                                    }

                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                                        contentDescription = "Open",
                                        tint = TextSecondary,
                                        modifier = Modifier.size(20.dp)
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
