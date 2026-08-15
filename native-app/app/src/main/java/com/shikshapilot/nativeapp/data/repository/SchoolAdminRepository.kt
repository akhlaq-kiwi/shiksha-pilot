package com.shikshapilot.nativeapp.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.shikshapilot.nativeapp.data.remote.ChartMonthPointDto
import com.shikshapilot.nativeapp.data.remote.ClassDto
import com.shikshapilot.nativeapp.data.remote.RetrofitClient
import com.shikshapilot.nativeapp.data.remote.TimetableItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class AdminDashboardStats(
    val totalStudents: Int = 3,
    val totalStaff: Int = 2,
    val todayAttendancePercent: Int = 94,
    val pendingLeavesCount: Int = 3,
    val feeDefaultersCount: Int = 14,
    val monthlyRevenueCollected: String = "₹ 2,000",
    val pendingDuesTotal: String = "₹ 29,333",
    val feeCollectionChart: List<ChartMonthPointDto> = emptyList(),
    val salaryDisbursementChart: List<ChartMonthPointDto> = emptyList()
)

data class StaffRecord(
    val id: String,
    val name: String,
    val role: String,
    val designation: String,
    val phone: String,
    val salaryAmount: String,
    val lastPaidStatus: String
)

data class LeaveRequestRecord(
    val id: String,
    val applicantName: String,
    val applicantRole: String,
    val leaveType: String,
    val duration: String,
    val reason: String,
    val status: String
)

data class FeeDefaulterRecord(
    val id: String,
    val studentName: String,
    val className: String,
    val parentPhone: String,
    val overdueDays: Int,
    val overdueAmount: String
)

data class AnnouncementRecord(
    val id: String,
    val title: String,
    val message: String,
    val audience: String,
    val timestamp: String,
    val isEmergency: Boolean
)

data class LiveTimetablePeriod(
    val id: Int,
    val periodNum: Int,
    val periodTitle: String,
    val timeStr: String,
    val subject: String,
    val teacher: String,
    val isBreak: Boolean = false,
    val isBackup: Boolean = false
)

object SchoolAdminRepository {
    private val _stats = MutableStateFlow(AdminDashboardStats())
    val stats: StateFlow<AdminDashboardStats> = _stats.asStateFlow()

    private val _classesList = MutableStateFlow<List<ClassDto>>(emptyList())
    val classesList: StateFlow<List<ClassDto>> = _classesList.asStateFlow()

    private val _currentTimetable = MutableStateFlow<List<LiveTimetablePeriod>>(emptyList())
    val currentTimetable: StateFlow<List<LiveTimetablePeriod>> = _currentTimetable.asStateFlow()

    private val _staffList = MutableStateFlow(
        listOf(
            StaffRecord("1", "Vikram Malhotra", "Teacher", "Senior Mathematics", "+91 9876543210", "₹ 45,000", "Paid for July"),
            StaffRecord("2", "Sunita Sharma", "Teacher", "English Literature", "+91 9876543211", "₹ 42,000", "Paid for July"),
            StaffRecord("3", "Rajesh Verma", "Teacher", "Physics & Electronics", "+91 9876543212", "₹ 48,000", "Pending July"),
            StaffRecord("4", "Kavita Reddy", "Admin Staff", "Accountant", "+91 9876543213", "₹ 38,000", "Paid for July")
        )
    )
    val staffList: StateFlow<List<StaffRecord>> = _staffList.asStateFlow()

    private val _leaveRequests = MutableStateFlow(
        listOf(
            LeaveRequestRecord("1", "Rajesh Verma", "Physics Teacher", "Casual Leave", "2 Days (12 Aug - 13 Aug)", "Family function out of station", "PENDING"),
            LeaveRequestRecord("2", "Sunita Sharma", "English Teacher", "Medical Leave", "1 Day (14 Aug)", "Severe fever & doctor visit", "PENDING"),
            LeaveRequestRecord("3", "Amit Kumar", "Sports Instructor", "Earned Leave", "3 Days (18 Aug - 20 Aug)", "Personal work", "PENDING")
        )
    )
    val leaveRequests: StateFlow<List<LeaveRequestRecord>> = _leaveRequests.asStateFlow()

    private val _feeDefaulters = MutableStateFlow(
        listOf(
            FeeDefaulterRecord("1", "Ananya Verma", "Class 10-A", "+91 9811223344", 14, "₹ 12,500"),
            FeeDefaulterRecord("2", "Kabir Patel", "Class 9-B", "+91 9822334455", 30, "₹ 18,000"),
            FeeDefaulterRecord("3", "Sneha Roy", "Class 11-C", "+91 9833445566", 45, "₹ 24,000")
        )
    )
    val feeDefaulters: StateFlow<List<FeeDefaulterRecord>> = _feeDefaulters.asStateFlow()

    private val _announcements = MutableStateFlow(
        listOf(
            AnnouncementRecord("1", "Independence Day Celebration Notice", "All students & staff must assemble by 8:00 AM on August 15 in uniform.", "ALL", "10 Aug 2026", false),
            AnnouncementRecord("2", "URGENT: Bus Route 4 Delay", "Route 4 bus delayed by 20 mins due to rain traffic. Parents please note.", "PARENTS", "09 Aug 2026", true)
        )
    )
    val announcements: StateFlow<List<AnnouncementRecord>> = _announcements.asStateFlow()

    suspend fun fetchSchoolStats() {
        try {
            val response = RetrofitClient.apiService.getSchoolStats()
            if (response.isSuccessful && response.body() != null) {
                val res = response.body()!!
                val body = res.data
                if (body != null) {
                    _stats.value = _stats.value.copy(
                        totalStudents = body.students_count,
                        totalStaff = body.staff_count,
                        monthlyRevenueCollected = formatCurrency(body.total_collected),
                        pendingDuesTotal = formatCurrency(body.pending_fees),
                        feeCollectionChart = body.fee_collection_chart,
                        salaryDisbursementChart = body.salary_disbursement_chart
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun fetchClassesFromApi(): List<ClassDto> {
        try {
            val response = RetrofitClient.apiService.getClasses()
            if (response.isSuccessful && response.body()?.data != null) {
                val list = response.body()!!.data
                _classesList.value = list
                return list
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return _classesList.value
    }

    suspend fun fetchTimetableForClassFromApi(classId: Int) {
        try {
            val todayDateStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val todayDayName = SimpleDateFormat("EEEE", Locale.US).format(Date()) // e.g. "Tuesday"

            val response = RetrofitClient.apiService.getTimetable(classId, todayDateStr)
            if (response.isSuccessful && response.body()?.data != null) {
                val jsonElement = response.body()!!.data!!
                val gson = Gson()

                val rawItems = mutableListOf<TimetableItemDto>()

                if (jsonElement.isJsonArray) {
                    val listType = object : TypeToken<List<TimetableItemDto>>() {}.type
                    val list: List<TimetableItemDto> = gson.fromJson(jsonElement, listType)
                    rawItems.addAll(list)
                } else if (jsonElement.isJsonObject) {
                    val obj = jsonElement.asJsonObject
                    if (obj.has(todayDayName) && obj.get(todayDayName).isJsonObject) {
                        val dayObj = obj.getAsJsonObject(todayDayName)
                        if (dayObj.has("periods") && dayObj.get("periods").isJsonArray) {
                            val listType = object : TypeToken<List<TimetableItemDto>>() {}.type
                            val list: List<TimetableItemDto> = gson.fromJson(dayObj.get("periods"), listType)
                            rawItems.addAll(list)
                        }
                    }
                }

                val publishedItems = rawItems.filter { it.is_published == 1 }

                if (publishedItems.isEmpty()) {
                    _currentTimetable.value = emptyList()
                    return
                }

                val resultList = mutableListOf<LiveTimetablePeriod>()
                val sortedItems = publishedItems.sortedBy { it.period_number ?: 1 }

                sortedItems.forEach { item ->
                    val pNum = item.period_number ?: 1
                    val startMins = 8 * 60 + (pNum - 1) * 40 + (if (pNum > 4) 20 else 0)
                    val endMins = startMins + 40

                    val startStr = formatMinsTo12Hr(startMins)
                    val endStr = formatMinsTo12Hr(endMins)

                    val subjStr = (item.subject_name ?: "Subject").replaceFirstChar { char -> char.uppercase() }
                    val teacherStr = item.teacher_name ?: "Faculty Member"

                    resultList.add(
                        LiveTimetablePeriod(
                            id = item.id ?: 0,
                            periodNum = pNum,
                            periodTitle = "Period $pNum",
                            timeStr = "$startStr – $endStr",
                            subject = subjStr,
                            teacher = teacherStr,
                            isBackup = item.is_backup
                        )
                    )

                    if (pNum == 4) {
                        val breakStartMins = startMins + 40
                        val breakEndMins = breakStartMins + 20
                        resultList.add(
                            LiveTimetablePeriod(
                                id = -1,
                                periodNum = 0,
                                periodTitle = "Break",
                                timeStr = "${formatMinsTo12Hr(breakStartMins)} – ${formatMinsTo12Hr(breakEndMins)}",
                                subject = "Interval Break",
                                teacher = "Campus Grounds",
                                isBreak = true
                            )
                        )
                    }
                }

                _currentTimetable.value = resultList
            } else {
                _currentTimetable.value = emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            _currentTimetable.value = emptyList()
        }
    }

    private fun formatMinsTo12Hr(totalMinutes: Int): String {
        val hours24 = totalMinutes / 60
        val mins = totalMinutes % 60
        val ampm = if (hours24 >= 12) "PM" else "AM"
        val hours12 = if (hours24 % 12 == 0) 12 else hours24 % 12
        return String.format("%02d:%02d %s", hours12, mins, ampm)
    }

    private fun formatCurrency(amount: Double): String {
        return try {
            val intPart = amount.toLong()
            "₹ " + java.text.NumberFormat.getNumberInstance(java.util.Locale("en", "IN")).format(intPart)
        } catch (e: Exception) {
            "₹ $amount"
        }
    }

    fun updateLeaveStatus(leaveId: String, newStatus: String) {
        _leaveRequests.value = _leaveRequests.value.map { leave ->
            if (leave.id == leaveId) leave.copy(status = newStatus) else leave
        }
        val remainingPending = _leaveRequests.value.count { it.status == "PENDING" }
        _stats.value = _stats.value.copy(pendingLeavesCount = remainingPending)
    }

    fun disburseSalary(staffId: String) {
        _staffList.value = _staffList.value.map { staff ->
            if (staff.id == staffId) staff.copy(lastPaidStatus = "Paid for August") else staff
        }
    }

    fun sendAnnouncement(title: String, message: String, isEmergency: Boolean) {
        val newRecord = AnnouncementRecord(
            id = System.currentTimeMillis().toString(),
            title = title,
            message = message,
            audience = if (isEmergency) "ALL (SMS & Push)" else "ALL",
            timestamp = "Just Now",
            isEmergency = isEmergency
        )
        _announcements.value = listOf(newRecord) + _announcements.value
    }
}
