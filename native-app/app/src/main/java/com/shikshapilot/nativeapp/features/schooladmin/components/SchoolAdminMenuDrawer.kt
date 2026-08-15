package com.shikshapilot.nativeapp.features.schooladmin.components

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
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FactCheck
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.InsertChart
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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

data class SchoolAdminMenuItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val category: String,
    val icon: ImageVector,
    val iconColor: Color,
    val badgeText: String? = null,
    val isUrgent: Boolean = false,
    val isSelected: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchoolAdminMenuDrawer(
    activeScreenId: String = "dashboard",
    schoolName: String = "CAMM SCHOOL",
    adminName: String = "Camm School Admin",
    onDismiss: () -> Unit,
    onNavigate: (String) -> Unit
) {
    val sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val menuCategories = listOf(
        // Core Hub
        SchoolAdminMenuItem(
            id = "dashboard",
            title = "Admin Dashboard",
            subtitle = "Overview, daily stats & KPI charts",
            category = "Main Portal",
            icon = Icons.Default.Home,
            iconColor = SunsetOrange,
            isSelected = activeScreenId == "dashboard"
        ),

        // Academics & Timetable
        SchoolAdminMenuItem(
            id = "classes",
            title = "Classes & Sections",
            subtitle = "Manage classes, sections & subject mapping",
            category = "Academics & Timetable",
            icon = Icons.Default.Class,
            iconColor = InfoBlue,
            isSelected = activeScreenId == "classes"
        ),
        SchoolAdminMenuItem(
            id = "timetable",
            title = "Timetable",
            subtitle = "Build, view & publish the class timetable",
            category = "Academics & Timetable",
            icon = Icons.Default.CalendarMonth,
            iconColor = SunsetOrange,
            isSelected = activeScreenId == "timetable"
        ),
        SchoolAdminMenuItem(
            id = "exams",
            title = "Examinations",
            subtitle = "Create, manage & publish examinations",
            category = "Academics & Timetable",
            icon = Icons.Default.Assignment,
            iconColor = InfoBlue,
            isSelected = activeScreenId == "exams"
        ),
        SchoolAdminMenuItem(
            id = "attendance",
            title = "Attendance & Leaderboard",
            subtitle = "Daily marking, missing class exceptions & leaderboard",
            category = "Academics & Timetable",
            icon = Icons.Default.DateRange,
            iconColor = WarningYellow,
            badgeText = "94% Today",
            isSelected = activeScreenId == "attendance"
        ),
        SchoolAdminMenuItem(
            id = "academic_setup",
            title = "Academic Setup",
            subtitle = "Academic years, subjects & grading configuration",
            category = "Academics & Timetable",
            icon = Icons.Default.School,
            iconColor = WarningYellow,
            isSelected = activeScreenId == "academic_setup"
        ),

        // Operations & Communication
        SchoolAdminMenuItem(
            id = "announcements",
            title = "Announcements & Broadcasts",
            subtitle = "Circulars, SMS & emergency push blasts",
            category = "Operations & Communications",
            icon = Icons.Default.Campaign,
            iconColor = Color(0xFFEF4444),
            badgeText = "URGENT",
            isUrgent = true,
            isSelected = activeScreenId == "announcements"
        ),

        // Staff & Payroll
        SchoolAdminMenuItem(
            id = "staff",
            title = "Staff Management",
            subtitle = "Staff profiles, role assignments & substitute allocation",
            category = "Staff Governance & Payroll",
            icon = Icons.Default.Groups,
            iconColor = SunsetOrange,
            badgeText = "24 Active",
            isSelected = activeScreenId == "staff"
        ),
        SchoolAdminMenuItem(
            id = "leaves",
            title = "Staff Leave Approvals",
            subtitle = "Review & approve pending teacher leave applications",
            category = "Staff Governance & Payroll",
            icon = Icons.Default.Edit,
            iconColor = WarningYellow,
            badgeText = "3 Pending",
            isSelected = activeScreenId == "leaves"
        ),
        SchoolAdminMenuItem(
            id = "salary",
            title = "Salary Disbursement",
            subtitle = "Monthly payroll disbursement & payment receipts",
            category = "Staff Governance & Payroll",
            icon = Icons.Default.ReceiptLong,
            iconColor = OnlineGreen,
            isSelected = activeScreenId == "salary"
        ),

        // Student Lifecycle
        SchoolAdminMenuItem(
            id = "students",
            title = "Student Directory & Enrollment",
            subtitle = "Student profiles, SR check & new admissions form",
            category = "Student Lifecycle & Admissions",
            icon = Icons.Default.PersonAdd,
            iconColor = OnlineGreen,
            badgeText = "Enrolling",
            isSelected = activeScreenId == "students"
        ),
        SchoolAdminMenuItem(
            id = "promotion",
            title = "Session Rollover & Promotion",
            subtitle = "Annual class advancement & section shuffling",
            category = "Student Lifecycle & Admissions",
            icon = Icons.Default.School,
            iconColor = InfoBlue,
            isSelected = activeScreenId == "promotion"
        ),

        // Finance & Fees
        SchoolAdminMenuItem(
            id = "finance",
            title = "Fee Management & Defaulters",
            subtitle = "Fee cards, 30+ day defaulter reminders & fee waivers",
            category = "Finance, Fees & Expenses",
            icon = Icons.Default.AccountBalanceWallet,
            iconColor = SunsetOrange,
            badgeText = "14 Defaulters",
            isSelected = activeScreenId == "finance"
        ),
        SchoolAdminMenuItem(
            id = "expenses",
            title = "School Expenses & Cash Audit",
            subtitle = "Log operational expenses & counter cash reconciliation",
            category = "Finance, Fees & Expenses",
            icon = Icons.Default.FactCheck,
            iconColor = InfoBlue,
            isSelected = activeScreenId == "expenses"
        ),

        // Reports & Security
        SchoolAdminMenuItem(
            id = "reports",
            title = "Financial & Academic Audit Reports",
            subtitle = "U-DISE+, CBSE OASIS & financial audit reports",
            category = "Reports & System Security",
            icon = Icons.Default.InsertChart,
            iconColor = Color(0xFFA855F7),
            isSelected = activeScreenId == "reports"
        ),
        SchoolAdminMenuItem(
            id = "security",
            title = "Security Logs & System Settings",
            subtitle = "Role permissions, audit trail & school settings",
            category = "Reports & System Security",
            icon = Icons.Default.Shield,
            iconColor = OnlineGreen,
            isSelected = activeScreenId == "security"
        ),
        SchoolAdminMenuItem(
            id = "school_profile",
            title = "School Profile",
            subtitle = "School details, logo & signature",
            category = "Reports & System Security",
            icon = Icons.Default.School,
            iconColor = InfoBlue,
            isSelected = activeScreenId == "school_profile"
        ),
        SchoolAdminMenuItem(
            id = "credentials",
            title = "Credentials",
            subtitle = "Generate student & staff login credentials",
            category = "Reports & System Security",
            icon = Icons.Default.PersonAdd,
            iconColor = OnlineGreen,
            isSelected = activeScreenId == "credentials"
        )
    )

    val groupedItems = remember { menuCategories.groupBy { it.category } }

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
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            // Header: School Admin Role Badge & Title
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "School Admin Navigation",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "$adminName • $schoolName",
                        fontSize = 10.sp,
                        color = SunsetOrange,
                        fontWeight = FontWeight.Medium
                    )
                }

                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(FrostedCard)
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(13.dp))

            // Navigation Menu List grouped by features
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                groupedItems.forEach { (catName, catList) ->
                    item {
                        Text(
                            text = catName.uppercase(),
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextSecondary,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                    }

                    items(catList) { menuItem ->
                        val cardBg = if (menuItem.isSelected) SunsetOrange.copy(alpha = 0.15f) else FrostedCard
                        val borderClr = if (menuItem.isSelected) SunsetOrange else if (menuItem.isUrgent) Color(0xFFEF4444).copy(alpha = 0.6f) else CardBorder

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(cardBg)
                                .border(width = 1.dp, color = borderClr, shape = RoundedCornerShape(18.dp))
                                .clickable {
                                    onDismiss()
                                    onNavigate(menuItem.id)
                                }
                                .padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(37.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(menuItem.iconColor.copy(alpha = 0.18f))
                                        .border(width = 1.dp, color = menuItem.iconColor.copy(alpha = 0.35f), shape = RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = menuItem.icon,
                                        contentDescription = menuItem.title,
                                        tint = menuItem.iconColor,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(11.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = menuItem.title,
                                            fontSize = 12.5.sp,
                                            fontWeight = if (menuItem.isSelected) FontWeight.ExtraBold else FontWeight.Bold,
                                            color = if (menuItem.isSelected) SunsetOrange else TextPrimary,
                                            modifier = Modifier.weight(1f, fill = false),
                                            maxLines = 1
                                        )

                                        if (menuItem.badgeText != null) {
                                            Spacer(modifier = Modifier.width(5.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(
                                                        if (menuItem.isUrgent) Color(0xFFEF4444).copy(alpha = 0.2f)
                                                        else SunsetOrange.copy(alpha = 0.18f)
                                                    )
                                                    .border(
                                                        width = 1.dp,
                                                        color = if (menuItem.isUrgent) Color(0xFFEF4444) else SunsetOrange.copy(alpha = 0.5f),
                                                        shape = RoundedCornerShape(6.dp)
                                                    )
                                                    .padding(horizontal = 5.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = menuItem.badgeText,
                                                    fontSize = 8.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = if (menuItem.isUrgent) Color(0xFFEF4444) else SunsetOrange,
                                                    maxLines = 1
                                                )
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = menuItem.subtitle,
                                        fontSize = 10.sp,
                                        color = TextSecondary,
                                        maxLines = 2
                                    )
                                }

                                Spacer(modifier = Modifier.width(6.dp))

                                Icon(
                                    imageVector = Icons.Default.ArrowForwardIos,
                                    contentDescription = "Navigate",
                                    tint = if (menuItem.isSelected) SunsetOrange else TextSecondary,
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
