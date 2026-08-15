package com.shikshapilot.nativeapp.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Class
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Context
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.repository.SchoolAdminRepository
import com.shikshapilot.nativeapp.data.repository.UserRepository
import com.shikshapilot.nativeapp.ui.components.ChartPointData
import com.shikshapilot.nativeapp.ui.components.MonthlyLineChartCard
import com.shikshapilot.nativeapp.ui.components.NotificationsSheet
import com.shikshapilot.nativeapp.ui.components.ProfileOptionsSheet
import com.shikshapilot.nativeapp.ui.components.PullToRefreshWrapper
import com.shikshapilot.nativeapp.ui.components.StickyBottomBar
import com.shikshapilot.nativeapp.ui.components.StickyTopBar
import com.shikshapilot.nativeapp.ui.theme.CardBorder
import com.shikshapilot.nativeapp.ui.theme.DarkCanvas
import com.shikshapilot.nativeapp.ui.theme.FrostedCard
import com.shikshapilot.nativeapp.ui.theme.InfoBlue
import com.shikshapilot.nativeapp.ui.theme.OnlineGreen
import com.shikshapilot.nativeapp.ui.theme.SunsetOrange
import com.shikshapilot.nativeapp.ui.theme.TextPrimary
import com.shikshapilot.nativeapp.ui.theme.TextSecondary
import com.shikshapilot.nativeapp.ui.theme.WarningYellow

data class OnboardingTask(
    val id: String,
    val title: String,
    val isDone: Boolean
)

@Composable
fun DashboardScreen(
    userName: String = "Jamiya Kids Planet Academy Admin",
    roleName: String = "SCHOOL_ADMIN",
    schoolName: String = "Jamiya Kids Planet Academy",
    onModuleClick: (String) -> Unit = {},
    onLogoutClick: () -> Unit = {}
) {
    val cachedUser by UserRepository.currentUser.collectAsState()
    val adminStats by SchoolAdminRepository.stats.collectAsState()
    val classesList by SchoolAdminRepository.classesList.collectAsState()
    val currentTimetable by SchoolAdminRepository.currentTimetable.collectAsState()
    val setupProgress by SchoolAdminRepository.setupProgress.collectAsState()

    var selectedClassDto by remember { mutableStateOf<ClassDto?>(null) }
    var isClassPickerExpanded by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("shikshapilot_prefs", Context.MODE_PRIVATE) }
    var isSetupProgressDismissed by remember {
        mutableStateOf(prefs.getBoolean("setup_progress_dismissed", false))
    }

    var isLoading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }

    // Live QA Server API Stats & Classes Refresh
    LaunchedEffect(refreshKey) {
        isLoading = true
        SchoolAdminRepository.fetchSchoolStats()
        val classes = SchoolAdminRepository.fetchClassesFromApi()
        if (classes.isNotEmpty()) {
            selectedClassDto = classes.first()
            SchoolAdminRepository.fetchTimetableForClassFromApi(classes.first().id)
        }
        SchoolAdminRepository.fetchSetupProgress()
        isLoading = false
    }

    // Dynamic Class Timetable Change Effect
    LaunchedEffect(selectedClassDto?.id) {
        selectedClassDto?.let { cls ->
            SchoolAdminRepository.fetchTimetableForClassFromApi(cls.id)
        }
    }

    var activeSheet by remember { mutableStateOf<String?>(null) }

    val activeRole = if (roleName.isNotEmpty()) roleName else cachedUser.role
    val activeSchool = if (schoolName.isNotEmpty()) schoolName else cachedUser.schoolName
    val activeName = if (userName.isNotEmpty()) userName else cachedUser.name

    val onboardingTasks = listOf(
        OnboardingTask("classes", "Add classes & sections", setupProgress.classesDone),
        OnboardingTask("finance", "Set up a fee structure", setupProgress.financeDone),
        OnboardingTask("staff", "Add teachers", setupProgress.staffDone),
        OnboardingTask("students", "Enrol students", setupProgress.studentsDone),
        OnboardingTask("timetable", "Build the timetable", setupProgress.timetableDone),
        OnboardingTask("exams", "Create an examination", setupProgress.examsDone)
    )
    val setupCompletedCount = onboardingTasks.count { it.isDone }
    val setupTotalCount = onboardingTasks.size
    val setupPercent = if (setupTotalCount > 0) (setupCompletedCount * 100) / setupTotalCount else 0

    // Dynamic Financial Charts Data Matching QA Server Response
    val feeCollectionChartData = if (adminStats.feeCollectionChart.isNotEmpty()) {
        adminStats.feeCollectionChart.map {
            ChartPointData(
                label = it.month,
                value = it.amount.toFloat(),
                formattedValue = "₹ ${it.amount}"
            )
        }
    } else {
        listOf(
            ChartPointData("Apr", 0.0f, "₹ 0"),
            ChartPointData("May", 0.0f, "₹ 0"),
            ChartPointData("Jun", 0.0f, "₹ 0"),
            ChartPointData("Jul", 0.0f, "₹ 0"),
            ChartPointData("Aug", 2000.0f, "₹ 2,000"),
            ChartPointData("Sep", 0.0f, "₹ 0")
        )
    }

    val salaryDisbursementChartData = if (adminStats.salaryDisbursementChart.isNotEmpty()) {
        adminStats.salaryDisbursementChart.map {
            ChartPointData(
                label = it.month,
                value = it.amount.toFloat(),
                formattedValue = "₹ ${it.amount}"
            )
        }
    } else {
        listOf(
            ChartPointData("Apr", 0.0f, "₹ 0"),
            ChartPointData("May", 0.0f, "₹ 0"),
            ChartPointData("Jun", 0.0f, "₹ 0"),
            ChartPointData("Jul", 0.0f, "₹ 0"),
            ChartPointData("Aug", 0.0f, "₹ 0"),
            ChartPointData("Sep", 0.0f, "₹ 0")
        )
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
            PullToRefreshWrapper(isRefreshing = isLoading, onRefresh = { refreshKey++ }) {
            Column(modifier = Modifier.fillMaxSize()) {
                // 1. STICKY TOP BAR
                StickyTopBar(
                    schoolName = activeSchool,
                    unreadNotificationCount = 2,
                    onNotificationClick = { activeSheet = "notifications" },
                    onAvatarClick = { activeSheet = "profile" }
                )

                // 2. SCROLLABLE DASHBOARD CONTENT (Matching Web Layout 1-to-1)
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = 24.dp)
                ) {
                    Spacer(modifier = Modifier.height(11.dp))

                    // WEB PARITY: Onboarding Checklist Widget (dismissible, driven by real setup state)
                    if (!isSetupProgressDismissed && setupCompletedCount < setupTotalCount) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(FrostedCard.copy(alpha = 0.9f))
                                .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(20.dp))
                                .padding(16.dp)
                        ) {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            text = "School Setup Progress",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "$setupCompletedCount of $setupTotalCount setup steps completed",
                                            fontSize = 10.sp,
                                            color = SunsetOrange
                                        )
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(SunsetOrange.copy(alpha = 0.18f))
                                                .padding(horizontal = 7.dp, vertical = 3.dp)
                                        ) {
                                            Text(text = "$setupPercent% Done", fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = SunsetOrange)
                                        }
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Dismiss setup progress",
                                            tint = TextSecondary,
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clickable {
                                                    isSetupProgressDismissed = true
                                                    prefs.edit().putBoolean("setup_progress_dismissed", true).apply()
                                                }
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    onboardingTasks.forEach { task ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable { onModuleClick(task.id) },
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                imageVector = if (task.isDone) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                                contentDescription = "Done",
                                                tint = if (task.isDone) OnlineGreen else TextSecondary,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = task.title,
                                                fontSize = 10.5.sp,
                                                color = if (task.isDone) TextPrimary else TextSecondary,
                                                fontWeight = if (task.isDone) FontWeight.Medium else FontWeight.Normal
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(13.dp))
                    }

                    // WEB PARITY: 4 Primary Stat Cards Grid (API Dynamic QA Stats)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            WebStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Total Students",
                                value = adminStats.totalStudents.toString(),
                                icon = Icons.Default.School,
                                color = SunsetOrange,
                                onClick = { onModuleClick("students") }
                            )
                            WebStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Total Teachers",
                                value = adminStats.totalStaff.toString(),
                                icon = Icons.Default.Person,
                                color = WarningYellow,
                                onClick = { onModuleClick("staff") }
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            WebStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Fee Collected",
                                value = adminStats.monthlyRevenueCollected,
                                icon = Icons.Default.AccountBalanceWallet,
                                color = OnlineGreen,
                                onClick = { onModuleClick("finance") }
                            )
                            WebStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Dues Pending",
                                value = adminStats.pendingDuesTotal,
                                icon = Icons.Default.CreditCard,
                                color = Color(0xFFEF4444),
                                onClick = { onModuleClick("fee_defaulters") }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    // WEB PARITY: Monthly Fee Collection Line Chart
                    Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                        MonthlyLineChartCard(
                            title = "Monthly Fee Collection",
                            subtitle = "Collection per month for academic year 2026",
                            icon = Icons.Default.AccountBalanceWallet,
                            lineColor = OnlineGreen,
                            chartData = feeCollectionChartData
                        )
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    // WEB PARITY: Salary Disbursement Line Chart
                    Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                        MonthlyLineChartCard(
                            title = "Salary Disbursement",
                            subtitle = "Monthly staff salary disbursements",
                            icon = Icons.Default.CreditCard,
                            lineColor = SunsetOrange,
                            chartData = salaryDisbursementChartData
                        )
                    }

                    Spacer(modifier = Modifier.height(13.dp))

                    // WEB PARITY: Dynamic Today's Timetable Widget with QA Server Classes Selector
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(FrostedCard.copy(alpha = 0.9f))
                            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(20.dp))
                            .padding(16.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.Schedule, contentDescription = "Timetable", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(5.dp))
                                    Text(
                                        text = "Today's Timetable",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }

                                // Interactive QA Server Classes Picker Selector
                                Box {
                                    val currentClassName = selectedClassDto?.let {
                                        if (it.section != null) "${it.name}-${it.section}" else it.name
                                    } ?: "Class 1"

                                    Row(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(SunsetOrange.copy(alpha = 0.18f))
                                            .border(width = 1.dp, color = SunsetOrange.copy(alpha = 0.4f), shape = RoundedCornerShape(10.dp))
                                            .clickable { isClassPickerExpanded = true }
                                            .padding(horizontal = 8.dp, vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(text = currentClassName, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = SunsetOrange)
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Icon(imageVector = Icons.Default.ArrowDropDown, contentDescription = "Select Class", tint = SunsetOrange, modifier = Modifier.size(20.dp))
                                    }

                                    DropdownMenu(
                                        expanded = isClassPickerExpanded,
                                        onDismissRequest = { isClassPickerExpanded = false },
                                        modifier = Modifier.background(FrostedCard)
                                    ) {
                                        classesList.forEach { cls ->
                                            val displayName = if (cls.section != null) "${cls.name}-${cls.section}" else cls.name
                                            DropdownMenuItem(
                                                text = { Text(text = displayName, color = TextPrimary, fontSize = 11.sp) },
                                                onClick = {
                                                    selectedClassDto = cls
                                                    isClassPickerExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            if (currentTimetable.isEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(DarkCanvas.copy(alpha = 0.4f))
                                        .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp))
                                        .padding(24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Icon(
                                            imageVector = Icons.Default.Schedule,
                                            contentDescription = "No Timetable",
                                            tint = TextSecondary,
                                            modifier = Modifier.size(21.dp)
                                        )
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = "No timetable has been published for today.",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "Please publish today's timetable to view scheduled periods.",
                                            fontSize = 10.sp,
                                            color = TextSecondary,
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
                                    }
                                }
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    currentTimetable.forEach { period ->
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(
                                                    if (period.isBreak) WarningYellow.copy(alpha = 0.12f)
                                                    else DarkCanvas.copy(alpha = 0.5f)
                                                )
                                                .border(
                                                    width = 1.dp,
                                                    color = if (period.isBreak) WarningYellow.copy(alpha = 0.4f) else CardBorder,
                                                    shape = RoundedCornerShape(14.dp)
                                                )
                                                .padding(12.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column {
                                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                                        Text(
                                                            text = period.periodTitle,
                                                            fontSize = 8.5.sp,
                                                            fontWeight = FontWeight.ExtraBold,
                                                            color = if (period.isBreak) WarningYellow else SunsetOrange
                                                        )
                                                        if (period.isBackup) {
                                                            Spacer(modifier = Modifier.width(5.dp))
                                                            Box(
                                                                modifier = Modifier
                                                                    .clip(RoundedCornerShape(4.dp))
                                                                    .background(WarningYellow.copy(alpha = 0.2f))
                                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                                            ) {
                                                                Text(text = "BACKUP", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WarningYellow)
                                                            }
                                                        }
                                                    }
                                                    Text(
                                                        text = period.subject,
                                                        fontSize = 11.5.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = TextPrimary
                                                    )
                                                    Text(
                                                        text = period.teacher,
                                                        fontSize = 10.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                                Text(
                                                    text = period.timeStr,
                                                    fontSize = 9.5.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
            }

            // Notifications Bottom Sheet Modal
            if (activeSheet == "notifications") {
                NotificationsSheet(
                    onDismiss = { activeSheet = null }
                )
            }

            // Profile Options Bottom Sheet Modal
            if (activeSheet == "profile") {
                ProfileOptionsSheet(
                    userName = activeName,
                    roleName = activeRole,
                    schoolName = activeSchool,
                    onDismiss = { activeSheet = null },
                    onViewProfile = {
                        activeSheet = null
                        onModuleClick("profile")
                    },
                    onSettings = {
                        activeSheet = null
                        onModuleClick("settings")
                    },
                    onChangePassword = {
                        activeSheet = null
                        onModuleClick("change_password")
                    },
                    onLogout = {
                        activeSheet = null
                        onLogoutClick()
                    }
                )
            }
        }
    }
}

@Composable
private fun WebStatCard(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    icon: ImageVector,
    color: Color,
    onClick: (() -> Unit)? = null
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .background(FrostedCard.copy(alpha = 0.85f))
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(18.dp))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(33.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.18f))
                    .border(width = 1.dp, color = color.copy(alpha = 0.35f), shape = RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(imageVector = icon, contentDescription = label, tint = color, modifier = Modifier.size(20.dp))
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column {
                Text(text = label, fontSize = 9.5.sp, color = TextSecondary)
                Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
            }
        }
    }
}
