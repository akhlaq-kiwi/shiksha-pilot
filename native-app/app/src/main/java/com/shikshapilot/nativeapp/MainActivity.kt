package com.shikshapilot.nativeapp

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.repository.UserRepository
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAcademicSetupScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAdditionalFeesScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAnnouncementsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAttendanceScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminClassesScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminEducationScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminCredentialsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminExamsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminExpensesScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeCollectionScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeFollowUpScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeStructureScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFinanceScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFinancialReportsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminLatePaymentPenaltyScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminLeaveRequestsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminProfileScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminSalaryDisbursementScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminSecurityScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminStaffScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminStudentsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminTimetableScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminTransportFeesScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.NotificationPreferencesScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.ParentVocabularyReportScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAchievementsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAnnouncementsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAssignmentsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAttendanceScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentDashboardScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentFeesScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentLeaveScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentMaterialsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentResultsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentTimetableScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentVocabularyScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentWordBuilderScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherAssignmentsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherAttendanceScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherClassesScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherDashboardScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherExamsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherLeaveScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherMaterialsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherNotificationsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherSalariesScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherVocabularyReportScreen
import com.shikshapilot.nativeapp.ui.screens.DashboardScreen
import com.shikshapilot.nativeapp.ui.screens.LoginScreen
import com.shikshapilot.nativeapp.ui.screens.SettingsScreen
import com.shikshapilot.nativeapp.ui.theme.ShikshaPilotTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("shikshapilot_prefs", Context.MODE_PRIVATE)
        val savedLoggedIn = prefs.getBoolean("is_logged_in", false)
        val savedToken = prefs.getString("auth_token", null)
        val savedPhone = prefs.getString("user_phone", "9319398941") ?: "9319398941"
        val savedRole = prefs.getString("user_role", "SCHOOL_ADMIN") ?: "SCHOOL_ADMIN"
        val savedSchool = prefs.getString("school_name", "Jamiya Kids Planet Academy") ?: "Jamiya Kids Planet Academy"

        if (savedLoggedIn && !savedToken.isNullOrEmpty()) {
            RetrofitClient.authToken = savedToken
            UserRepository.updateProfile(savedPhone, savedRole, savedSchool)
        }

        setContent {
            ShikshaPilotTheme {
                var isLoggedIn by remember { mutableStateOf(savedLoggedIn) }
                var userRole by remember { mutableStateOf(savedRole) }
                var schoolName by remember { mutableStateOf(savedSchool) }
                val initialScreenId = intent.getStringExtra("screen_id") ?: "dashboard"

                // Real navigation back-stack so transitions can animate push/pop like native Android navigation
                val backStack = remember { mutableStateListOf(initialScreenId) }
                var isForwardNavigation by remember { mutableStateOf(true) }
                val currentScreenId = backStack.last()

                val navigateTo: (String) -> Unit = { targetId ->
                    if (targetId != currentScreenId) {
                        isForwardNavigation = true
                        backStack.add(targetId)
                    }
                }
                val goBack: () -> Unit = {
                    if (backStack.size > 1) {
                        isForwardNavigation = false
                        backStack.removeAt(backStack.lastIndex)
                    }
                }

                var studentsClassFilter by remember { mutableStateOf<String?>(null) }
                val openStudentsForClass: (String) -> Unit = { name ->
                    studentsClassFilter = name
                    navigateTo("students")
                }

                var showExitConfirm by remember { mutableStateOf(false) }

                if (isLoggedIn) {
                    // Single back on the dashboard root asks for confirmation before backgrounding
                    // the app, instead of silently minimizing (some OEM Android skins aggressively
                    // kill backgrounded tasks, which made a silent minimize feel like the app closed).
                    BackHandler(enabled = true) {
                        if (backStack.size > 1) {
                            goBack()
                        } else {
                            showExitConfirm = true
                        }
                    }
                }

                if (showExitConfirm) {
                    androidx.compose.material3.AlertDialog(
                        onDismissRequest = { showExitConfirm = false },
                        title = { androidx.compose.material3.Text("Exit ShikshaPilot?") },
                        text = { androidx.compose.material3.Text("Are you sure you want to close the app?") },
                        confirmButton = {
                            androidx.compose.material3.TextButton(onClick = {
                                showExitConfirm = false
                                moveTaskToBack(true)
                            }) {
                                androidx.compose.material3.Text("Exit")
                            }
                        },
                        dismissButton = {
                            androidx.compose.material3.TextButton(onClick = { showExitConfirm = false }) {
                                androidx.compose.material3.Text("Cancel")
                            }
                        }
                    )
                }

                val performLogout: () -> Unit = {
                    prefs.edit().clear().apply()
                    RetrofitClient.authToken = null
                    isLoggedIn = false
                    backStack.clear()
                    backStack.add("dashboard")
                    Unit
                }

                if (!isLoggedIn) {
                    LoginScreen(
                        onLoginSuccess = { phone, role, school ->
                            val token = RetrofitClient.authToken

                            // Save session persistently
                            prefs.edit().apply {
                                putBoolean("is_logged_in", true)
                                putString("auth_token", token)
                                putString("user_phone", phone)
                                putString("user_role", role)
                                putString("school_name", school)
                                apply()
                            }

                            UserRepository.updateProfile(phone, role, school)
                            userRole = role
                            schoolName = school
                            isLoggedIn = true
                        }
                    )
                } else {
                    AnimatedContent(
                        targetState = currentScreenId,
                        transitionSpec = {
                            if (isForwardNavigation) {
                                (slideInHorizontally(animationSpec = tween(280)) { fullWidth -> fullWidth } + fadeIn(tween(280))) togetherWith
                                    (slideOutHorizontally(animationSpec = tween(280)) { fullWidth -> -fullWidth / 4 } + fadeOut(tween(280)))
                            } else {
                                (slideInHorizontally(animationSpec = tween(280)) { fullWidth -> -fullWidth / 4 } + fadeIn(tween(280))) togetherWith
                                    (slideOutHorizontally(animationSpec = tween(280)) { fullWidth -> fullWidth } + fadeOut(tween(280)))
                            }
                        },
                        label = "screen_stack_transition"
                    ) { activeScreenId ->
                    when (userRole.uppercase()) {
                        "TEACHER" -> {
                            when (activeScreenId) {
                                "teacher_attendance" -> {
                                    TeacherAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_assignments" -> {
                                    TeacherAssignmentsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_materials" -> {
                                    TeacherMaterialsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_classes" -> {
                                    TeacherClassesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_leave" -> {
                                    TeacherLeaveScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_notifications" -> {
                                    TeacherNotificationsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_salaries" -> {
                                    TeacherSalariesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_exams" -> {
                                    TeacherExamsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "teacher_vocabulary_report" -> {
                                    TeacherVocabularyReportScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "notification_preferences" -> {
                                    NotificationPreferencesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "announcements" -> {
                                    SchoolAdminAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    TeacherDashboardScreen(
                                        schoolName = schoolName,
                                        teacherPhone = savedPhone,
                                        onNavigate = navigateTo,
                                        onLogoutClick = performLogout
                                    )
                                }
                            }
                        }
                        "STUDENT", "PARENT" -> {
                            when (activeScreenId) {
                                "student_fees" -> {
                                    StudentFeesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_attendance" -> {
                                    StudentAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_assignments" -> {
                                    StudentAssignmentsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_materials" -> {
                                    StudentMaterialsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_timetable" -> {
                                    StudentTimetableScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_results" -> {
                                    StudentResultsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "achievements" -> {
                                    StudentAchievementsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "vocabulary" -> {
                                    if (userRole.uppercase() == "PARENT") {
                                        ParentVocabularyReportScreen(
                                            schoolName = schoolName,
                                            onBack = { goBack() }
                                        )
                                    } else {
                                        StudentVocabularyScreen(
                                            schoolName = schoolName,
                                            onBack = { goBack() }
                                        )
                                    }
                                }
                                "word_builder_game" -> {
                                    StudentWordBuilderScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "notification_preferences" -> {
                                    NotificationPreferencesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "announcements" -> {
                                    StudentAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "student_leave" -> {
                                    StudentLeaveScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    StudentDashboardScreen(
                                        schoolName = schoolName,
                                        studentPhone = savedPhone,
                                        onNavigate = navigateTo,
                                        onLogoutClick = performLogout
                                    )
                                }
                            }
                        }
                        else -> {
                            // SCHOOL_ADMIN
                            when (activeScreenId) {
                                "notification_preferences" -> {
                                    NotificationPreferencesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "students", "admissions" -> {
                                    SchoolAdminStudentsScreen(
                                        schoolName = schoolName,
                                        classNameFilter = studentsClassFilter,
                                        onBack = {
                                            studentsClassFilter = null
                                            goBack()
                                        }
                                    )
                                }
                                "staff", "salary" -> {
                                    SchoolAdminStaffScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "leaves", "leave_approve" -> {
                                    SchoolAdminLeaveRequestsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "finance", "expenses", "fee_defaulters" -> {
                                    SchoolAdminFinanceScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onNavigate = navigateTo
                                    )
                                }
                                "fee_structure" -> {
                                    SchoolAdminFeeStructureScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "fee_collection" -> {
                                    SchoolAdminFeeCollectionScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "fee_follow_up" -> {
                                    SchoolAdminFeeFollowUpScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "salary_disbursement" -> {
                                    SchoolAdminSalaryDisbursementScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "financial_reports" -> {
                                    SchoolAdminFinancialReportsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "transport_fees" -> {
                                    SchoolAdminTransportFeesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "school_expenses" -> {
                                    SchoolAdminExpensesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "late_payment_penalty" -> {
                                    SchoolAdminLatePaymentPenaltyScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "additional_fees" -> {
                                    SchoolAdminAdditionalFeesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "announcements", "broadcast_emergency" -> {
                                    SchoolAdminAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "attendance", "att_exceptions" -> {
                                    SchoolAdminAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "education" -> {
                                    SchoolAdminEducationScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onNavigate = navigateTo
                                    )
                                }
                                "classes", "sections" -> {
                                    SchoolAdminClassesScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onViewStudents = openStudentsForClass
                                    )
                                }
                                "timetable" -> {
                                    SchoolAdminTimetableScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "exams" -> {
                                    SchoolAdminExamsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "security" -> {
                                    SchoolAdminSecurityScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "school_profile" -> {
                                    SchoolAdminProfileScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "academic_setup" -> {
                                    SchoolAdminAcademicSetupScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "credentials" -> {
                                    SchoolAdminCredentialsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { goBack() },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    DashboardScreen(
                                        roleName = userRole,
                                        schoolName = schoolName,
                                        onLogoutClick = performLogout,
                                        onModuleClick = navigateTo
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
