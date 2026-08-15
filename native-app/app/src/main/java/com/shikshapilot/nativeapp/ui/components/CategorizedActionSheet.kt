package com.shikshapilot.nativeapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FactCheck
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.InsertChart
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
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
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

data class CategorizedAction(
    val id: String,
    val title: String,
    val subtitle: String,
    val category: String,
    val icon: ImageVector,
    val iconColor: Color,
    val allowedRoles: List<String> = listOf("SCHOOL_ADMIN", "TEACHER", "PARENT", "STUDENT"),
    val badgeText: String? = null,
    val isUrgent: Boolean = false,
    val apiEndpoint: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategorizedActionSheet(
    roleName: String,
    onDismiss: () -> Unit,
    onActionClick: (String) -> Unit
) {
    val sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var searchQuery by remember { mutableStateOf("") }

    val allActions = remember {
        listOf(
            // 1. Daily Operations & Broadcasts
            CategorizedAction(
                id = "broadcast_announcement",
                title = "Send Broadcast Announcement",
                subtitle = "POST /api/school/announcements (SMS/Push to parents & staff)",
                category = "Operations & Communications",
                icon = Icons.Default.Campaign,
                iconColor = Color(0xFFEF4444),
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "URGENT",
                isUrgent = true,
                apiEndpoint = "/api/school/announcements"
            ),
            CategorizedAction(
                id = "att_overview",
                title = "Daily Attendance Overview",
                subtitle = "GET /api/school/stats (Track missing class attendance)",
                category = "Operations & Communications",
                icon = Icons.Default.DateRange,
                iconColor = SunsetOrange,
                allowedRoles = listOf("SCHOOL_ADMIN", "TEACHER"),
                badgeText = "94% Today",
                apiEndpoint = "/api/school/stats"
            ),
            CategorizedAction(
                id = "transport_management",
                title = "Transport & Route Fees",
                subtitle = "GET /api/school/transport-fees (Manage routes & bus fees)",
                category = "Operations & Communications",
                icon = Icons.Default.DirectionsBus,
                iconColor = InfoBlue,
                allowedRoles = listOf("SCHOOL_ADMIN", "PARENT"),
                apiEndpoint = "/api/school/transport-fees"
            ),

            // 2. Staff Governance & Salary Disbursement
            CategorizedAction(
                id = "staff_directory",
                title = "Staff Directory & Roles",
                subtitle = "GET /api/school/staff (Manage teachers & staff profiles)",
                category = "Staff Governance & Payroll",
                icon = Icons.Default.Groups,
                iconColor = SunsetOrange,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "24 Active",
                apiEndpoint = "/api/school/staff"
            ),
            CategorizedAction(
                id = "leave_requests",
                title = "Approve Teacher Leaves",
                subtitle = "GET /api/school/leave-requests (Approve pending leave requests)",
                category = "Staff Governance & Payroll",
                icon = Icons.Default.Edit,
                iconColor = WarningYellow,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "3 Pending",
                apiEndpoint = "/api/school/leave-requests"
            ),
            CategorizedAction(
                id = "salary_disbursement",
                title = "Salary Disbursement & Payroll",
                subtitle = "POST /api/school/staff-payments (Disburse monthly staff salary)",
                category = "Staff Governance & Payroll",
                icon = Icons.Default.ReceiptLong,
                iconColor = OnlineGreen,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "Due 1st",
                apiEndpoint = "/api/school/staff-payments"
            ),

            // 3. Student Lifecycle & Admissions
            CategorizedAction(
                id = "student_enrollment",
                title = "New Student Enrollment",
                subtitle = "POST /api/school/students (Register student with SR & Roll check)",
                category = "Student Lifecycle & Admissions",
                icon = Icons.Default.PersonAdd,
                iconColor = OnlineGreen,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "Enrolling",
                apiEndpoint = "/api/school/students"
            ),
            CategorizedAction(
                id = "student_promotion",
                title = "Session Rollover & Promotion",
                subtitle = "POST /api/school/students/{id}/advance (Advance student to next class)",
                category = "Student Lifecycle & Admissions",
                icon = Icons.Default.School,
                iconColor = InfoBlue,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                apiEndpoint = "/api/school/students/{id}/advance"
            ),

            // 4. Finance, Fee Follow-up & Expense Audit
            CategorizedAction(
                id = "fee_followup",
                title = "Late Payment Penalty & Follow-up",
                subtitle = "GET /api/school/late-payment-penalty/stats (Fee defaulters track)",
                category = "Finance, Fees & Expenses",
                icon = Icons.Default.AccountBalanceWallet,
                iconColor = SunsetOrange,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                badgeText = "14 Defaulters",
                apiEndpoint = "/api/school/late-payment-penalty/stats"
            ),
            CategorizedAction(
                id = "additional_fees",
                title = "Additional & Annual Fee Types",
                subtitle = "POST /api/school/annual-fees (Manage lab, annual & extra fee types)",
                category = "Finance, Fees & Expenses",
                icon = Icons.Default.AssignmentTurnedIn,
                iconColor = WarningYellow,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                apiEndpoint = "/api/school/additional-fees/types"
            ),
            CategorizedAction(
                id = "school_expenses",
                title = "School Expense Ledger",
                subtitle = "GET /api/school/expenses (Log & audit operational expenses)",
                category = "Finance, Fees & Expenses",
                icon = Icons.Default.FactCheck,
                iconColor = InfoBlue,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                apiEndpoint = "/api/school/expenses"
            ),

            // 5. Reports & System Security
            CategorizedAction(
                id = "financial_reports",
                title = "Financial Audit Reports",
                subtitle = "GET /api/school/financial-reports (Export audit summaries)",
                category = "Reports & System Audits",
                icon = Icons.Default.InsertChart,
                iconColor = Color(0xFFA855F7),
                allowedRoles = listOf("SCHOOL_ADMIN"),
                apiEndpoint = "/api/school/financial-reports"
            ),
            CategorizedAction(
                id = "security_audits",
                title = "Security & System Settings",
                subtitle = "GET /api/school/finance-settings (System security & role permissions)",
                category = "Reports & System Audits",
                icon = Icons.Default.Shield,
                iconColor = OnlineGreen,
                allowedRoles = listOf("SCHOOL_ADMIN"),
                apiEndpoint = "/api/school/finance-settings"
            )
        )
    }

    val currentRoleUpper = roleName.uppercase()
    val filteredActions = remember(searchQuery, currentRoleUpper) {
        allActions.filter { action ->
            (action.allowedRoles.contains(currentRoleUpper) || currentRoleUpper == "SCHOOL_ADMIN") &&
                    (searchQuery.isEmpty() ||
                            action.title.contains(searchQuery, ignoreCase = true) ||
                            action.subtitle.contains(searchQuery, ignoreCase = true) ||
                            action.category.contains(searchQuery, ignoreCase = true))
        }
    }

    val groupedActions = remember(filteredActions) {
        filteredActions.groupBy { it.category }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DarkCanvas,
        scrimColor = Color.Black.copy(alpha = 0.65f),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(TextSecondary.copy(alpha = 0.4f))
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "School Admin Actions",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Integrated Backend Modules (${filteredActions.size} Actions)",
                        fontSize = 12.sp,
                        color = SunsetOrange
                    )
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(FrostedCard)
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Search Bar Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search actions by category or API...", color = TextSecondary, fontSize = 13.5.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = SunsetOrange) },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = FrostedCard,
                    unfocusedContainerColor = FrostedCard,
                    focusedBorderColor = SunsetOrange,
                    unfocusedBorderColor = CardBorder,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Action Items Grouped List
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                groupedActions.forEach { (category, actions) ->
                    item {
                        Text(
                            text = category.uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextSecondary,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }

                    items(actions) { action ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(FrostedCard)
                                .border(
                                    width = 1.dp,
                                    color = if (action.isUrgent) Color(0xFFEF4444).copy(alpha = 0.6f) else CardBorder,
                                    shape = RoundedCornerShape(18.dp)
                                )
                                .clickable {
                                    onDismiss()
                                    onActionClick(action.id)
                                }
                                .padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(action.iconColor.copy(alpha = 0.18f))
                                        .border(width = 1.dp, color = action.iconColor.copy(alpha = 0.35f), shape = RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = action.icon,
                                        contentDescription = action.title,
                                        tint = action.iconColor,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(14.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = action.title,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary,
                                            modifier = Modifier.weight(1f, fill = false),
                                            maxLines = 1
                                        )
                                        
                                        if (action.badgeText != null) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(
                                                        if (action.isUrgent) Color(0xFFEF4444).copy(alpha = 0.2f)
                                                        else SunsetOrange.copy(alpha = 0.18f)
                                                    )
                                                    .border(
                                                        width = 1.dp,
                                                        color = if (action.isUrgent) Color(0xFFEF4444) else SunsetOrange.copy(alpha = 0.5f),
                                                        shape = RoundedCornerShape(6.dp)
                                                    )
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = action.badgeText,
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = if (action.isUrgent) Color(0xFFEF4444) else SunsetOrange,
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = action.subtitle,
                                        fontSize = 11.5.sp,
                                        color = TextSecondary,
                                        maxLines = 2
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Icon(
                                    imageVector = Icons.Default.ArrowForwardIos,
                                    contentDescription = "Open",
                                    tint = TextSecondary,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
