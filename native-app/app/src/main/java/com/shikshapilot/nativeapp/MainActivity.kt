package com.shikshapilot.nativeapp

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.repository.UserRepository
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAnnouncementsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminAttendanceScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminClassesScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminExamsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeCollectionScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeFollowUpScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFeeStructureScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFinanceScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminFinancialReportsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminLeaveRequestsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminSalaryDisbursementScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminStaffScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminStudentsScreen
import com.shikshapilot.nativeapp.features.schooladmin.screens.SchoolAdminTimetableScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAnnouncementsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAssignmentsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentAttendanceScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentDashboardScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentFeesScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentMaterialsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentResultsScreen
import com.shikshapilot.nativeapp.features.studentparent.screens.StudentTimetableScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherAssignmentsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherAttendanceScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherClassesScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherDashboardScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherExamsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherLeaveScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherMaterialsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherNotificationsScreen
import com.shikshapilot.nativeapp.features.teacher.screens.TeacherSalariesScreen
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
                var currentScreenId by remember { mutableStateOf(initialScreenId) }

                val performLogout = {
                    prefs.edit().clear().apply()
                    RetrofitClient.authToken = null
                    isLoggedIn = false
                    currentScreenId = "dashboard"
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
                    when (userRole.uppercase()) {
                        "TEACHER" -> {
                            when (currentScreenId) {
                                "teacher_attendance" -> {
                                    TeacherAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_assignments" -> {
                                    TeacherAssignmentsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_materials" -> {
                                    TeacherMaterialsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_classes" -> {
                                    TeacherClassesScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_leave" -> {
                                    TeacherLeaveScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_notifications" -> {
                                    TeacherNotificationsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_salaries" -> {
                                    TeacherSalariesScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "teacher_exams" -> {
                                    TeacherExamsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "announcements" -> {
                                    SchoolAdminAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    TeacherDashboardScreen(
                                        schoolName = schoolName,
                                        teacherPhone = savedPhone,
                                        onNavigate = { targetId -> currentScreenId = targetId },
                                        onLogoutClick = performLogout
                                    )
                                }
                            }
                        }
                        "STUDENT", "PARENT" -> {
                            when (currentScreenId) {
                                "student_fees" -> {
                                    StudentFeesScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "student_attendance" -> {
                                    StudentAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "student_assignments" -> {
                                    StudentAssignmentsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "student_materials" -> {
                                    StudentMaterialsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "student_timetable" -> {
                                    StudentTimetableScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "student_results" -> {
                                    StudentResultsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "announcements" -> {
                                    StudentAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    StudentDashboardScreen(
                                        schoolName = schoolName,
                                        studentPhone = savedPhone,
                                        onNavigate = { targetId -> currentScreenId = targetId },
                                        onLogoutClick = performLogout
                                    )
                                }
                            }
                        }
                        else -> {
                            // SCHOOL_ADMIN
                            when (currentScreenId) {
                                "students", "admissions" -> {
                                    SchoolAdminStudentsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "staff", "salary" -> {
                                    SchoolAdminStaffScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "leaves", "leave_approve" -> {
                                    SchoolAdminLeaveRequestsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "finance", "expenses", "fee_defaulters" -> {
                                    SchoolAdminFinanceScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" },
                                        onNavigate = { targetId -> currentScreenId = targetId }
                                    )
                                }
                                "fee_structure" -> {
                                    SchoolAdminFeeStructureScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "finance" }
                                    )
                                }
                                "fee_collection" -> {
                                    SchoolAdminFeeCollectionScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "finance" }
                                    )
                                }
                                "fee_follow_up" -> {
                                    SchoolAdminFeeFollowUpScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "finance" }
                                    )
                                }
                                "salary_disbursement" -> {
                                    SchoolAdminSalaryDisbursementScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "finance" }
                                    )
                                }
                                "financial_reports" -> {
                                    SchoolAdminFinancialReportsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "finance" }
                                    )
                                }
                                "announcements", "broadcast_emergency" -> {
                                    SchoolAdminAnnouncementsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "attendance", "att_exceptions" -> {
                                    SchoolAdminAttendanceScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "classes", "sections" -> {
                                    SchoolAdminClassesScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "timetable" -> {
                                    SchoolAdminTimetableScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "exams" -> {
                                    SchoolAdminExamsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" }
                                    )
                                }
                                "settings" -> {
                                    SettingsScreen(
                                        schoolName = schoolName,
                                        onBack = { currentScreenId = "dashboard" },
                                        onLogoutClick = performLogout
                                    )
                                }
                                else -> {
                                    DashboardScreen(
                                        roleName = userRole,
                                        schoolName = schoolName,
                                        onLogoutClick = performLogout,
                                        onModuleClick = { screenId ->
                                            currentScreenId = screenId
                                        }
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
