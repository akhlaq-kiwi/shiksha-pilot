package com.shikshapilot.nativeapp.data.remote

import com.google.gson.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

data class LoginRequestDto(
    val phone: String,
    val password: String
)

data class UserDto(
    val id: Any? = null,
    val name: String? = null,
    val role: String,
    val phone: String,
    val school_name: String? = null,
    val photo: String? = null
)

data class LoginDataDto(
    val token: String,
    val user: UserDto
)

data class LoginResponseDto(
    val status: String,
    val message: String? = null,
    val data: LoginDataDto? = null
)

data class LeaveDto(
    val _id: String? = null,
    val id: Int? = null,
    val student_id: String? = null,
    val student_name: String? = null,
    val leave_type: String,
    val start_date: String,
    val end_date: String,
    val reason: String,
    val status: String
)

data class ChartMonthPointDto(
    val month: String,
    val label: String? = null,
    val amount: Double = 0.0,
    val studentsPaid: Int? = null,
    val teachersPaid: Int? = null
)

data class SchoolStatsDataDto(
    val students_count: Int = 0,
    val staff_count: Int = 0,
    val classes_count: Int = 0,
    val pending_fees: Double = 0.0,
    val total_collected: Double = 0.0,
    val fee_collection_chart: List<ChartMonthPointDto> = emptyList(),
    val salary_disbursement_chart: List<ChartMonthPointDto> = emptyList()
)

data class SchoolStatsResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: SchoolStatsDataDto? = null
)

data class ClassDto(
    val id: Int,
    val name: String,
    val section: String? = null
)

data class ClassesResponseDto(
    val status: String? = "success",
    val data: List<ClassDto> = emptyList()
)

data class TimetableItemDto(
    val id: Int? = null,
    val period_number: Int? = 1,
    val subject_name: String? = null,
    val teacher_name: String? = null,
    val start_time: String? = null,
    val end_time: String? = null,
    val room: String? = null,
    val class_name: String? = null,
    val is_backup: Boolean = false,
    val is_published: Int = 1,
    val is_free: Boolean = false
)

data class TimetableResponseDto(
    val status: String? = "success",
    val data: JsonElement? = null
)

data class StudentItemDto(
    val id: Int,
    val name: String,
    val sr_no: String? = null,
    val roll_no: String? = null,
    val class_name: String? = null,
    val section: String? = null,
    val father_name: String? = null,
    val parent_phone: String? = null,
    val student_mobile: String? = null,
    val status: String? = "ACTIVE",
    val photo_path: String? = null,
    val gender: String? = null,
    val admission_date: String? = null
)

data class StudentsResponseDto(
    val status: String? = "success",
    val data: List<StudentItemDto> = emptyList()
)

data class StaffItemDto(
    val id: Int,
    val name: String,
    val employee_id: String? = null,
    val role: String? = "Teacher",
    val department: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val status: String? = "ACTIVE",
    val salary: Double? = 0.0,
    val photo_path: String? = null
)

data class StaffResponseDto(
    val status: String? = "success",
    val data: List<StaffItemDto> = emptyList()
)

data class LeaveRequestItemDto(
    val id: Int,
    val applicant_name: String? = null,
    val applicant_role: String? = null,
    val leave_type: String? = "Casual Leave",
    val start_date: String? = null,
    val end_date: String? = null,
    val days: Int? = 1,
    val reason: String? = null,
    val status: String? = "PENDING"
)

data class LeaveRequestsResponseDto(
    val status: String? = "success",
    val data: List<LeaveRequestItemDto> = emptyList()
)

data class UpdateLeaveStatusRequestDto(
    val status: String
)

data class AnnouncementItemDto(
    val id: Int? = null,
    val title: String,
    val content: String,
    val target_audience: String? = "ALL",
    val is_urgent: Int? = 0,
    val created_at: String? = null
)

data class AnnouncementsResponseDto(
    val status: String? = "success",
    val data: List<AnnouncementItemDto> = emptyList()
)

// --- TEACHER DTOS ---

data class TeacherDashboardDataDto(
    val schedule: List<TimetableItemDto> = emptyList(),
    val classes: List<ClassDto> = emptyList()
)

data class TeacherDashboardResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: TeacherDashboardDataDto? = null
)

data class MarkAttendanceStudentDto(
    val student_id: Int,
    val status: String // PRESENT, ABSENT, LATE
)

data class MarkAttendanceRequestDto(
    val class_id: Int,
    val date: String,
    val attendance: List<MarkAttendanceStudentDto>
)

data class AssignmentItemDto(
    val id: Int? = null,
    val title: String,
    val description: String? = null,
    val class_name: String? = null,
    val subject_name: String? = null,
    val due_date: String? = null,
    val created_at: String? = null
)

data class AssignmentsResponseDto(
    val status: String? = "success",
    val data: List<AssignmentItemDto> = emptyList()
)

data class MaterialItemDto(
    val id: Int? = null,
    val title: String,
    val description: String? = null,
    val class_name: String? = null,
    val subject_name: String? = null,
    val file_url: String? = null,
    val created_at: String? = null
)

data class MaterialsResponseDto(
    val status: String? = "success",
    val data: List<MaterialItemDto> = emptyList()
)

// --- STUDENT DTOS ---

data class StudentDashboardDataDto(
    val student_name: String? = null,
    val class_name: String? = null,
    val attendance_percentage: Double? = 95.0,
    val total_dues: Double? = 0.0,
    val timetable: List<TimetableItemDto> = emptyList(),
    val notices: List<AnnouncementItemDto> = emptyList()
)

data class StudentDashboardResponseDto(
    val status: String? = "success",
    val data: StudentDashboardDataDto? = null
)

data class StudentAttendanceRecordDto(
    val date: String,
    val status: String,
    val remarks: String? = null
)

data class StudentAttendanceResponseDto(
    val status: String? = "success",
    val data: List<StudentAttendanceRecordDto> = emptyList()
)

// Note: the `announcements` table's real columns are subject/description/audience/status/
// published_at (see backend/src/Domain/SchoolAdmin/Services/SchoolAdminService.php
// getAnnouncements()/createAnnouncement()), NOT title/content/target_audience/is_urgent as
// AnnouncementItemDto above assumes. StudentAnnouncementItemDto below uses the real field
// names for the read-only student/parent notices endpoint.
data class StudentAnnouncementItemDto(
    val id: Int? = null,
    val subject: String? = null,
    val description: String? = null,
    val audience: String? = null,
    val status: String? = null,
    val published_at: String? = null,
    val created_at: String? = null,
    val is_read: Int? = 0
)

data class StudentAnnouncementsResponseDto(
    val status: String? = "success",
    val data: List<StudentAnnouncementItemDto> = emptyList()
)

data class StudentFeeReceiptDto(
    val receipt_no: String,
    val amount: Double,
    val payment_date: String,
    val payment_method: String,
    val status: String = "PAID"
)

data class StudentFeesResponseDto(
    val status: String? = "success",
    val total_fee: Double = 0.0,
    val fee_paid: Double = 0.0,
    val pending_fee: Double = 0.0,
    val receipts: List<StudentFeeReceiptDto> = emptyList()
)

data class IdentifyRequestDto(
    val phone: String
)

data class IdentifyResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: JsonElement? = null
)

data class ChangePasswordRequestDto(
    val current_password: String? = null,
    val new_password: String
)

data class ChangePasswordResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: JsonElement? = null
)

data class ProfileDataDto(
    val id: Any? = null,
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val role: String? = null,
    val school_id: Any? = null,
    val school_name: String? = null,
    val status: String? = null,
    val photo_path: String? = null,
    val department: String? = null,
    val employee_id: String? = null
)

data class ProfileResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: ProfileDataDto? = null
)

interface ApiService {

    // Auth
    @POST("api/auth/login")
    suspend fun login(
        @Body request: LoginRequestDto
    ): Response<LoginResponseDto>

    @POST("api/auth/identify")
    suspend fun identify(
        @Body request: IdentifyRequestDto
    ): Response<IdentifyResponseDto>

    @POST("api/auth/change-password")
    suspend fun changePassword(
        @Body request: ChangePasswordRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<ChangePasswordResponseDto>

    @GET("api/auth/profile")
    suspend fun getProfile(
        @Header("Authorization") authHeader: String? = null
    ): Response<ProfileResponseDto>

    // School Admin Endpoints
    @GET("api/leaves")
    suspend fun getLeaves(
        @Header("Authorization") authHeader: String? = null
    ): Response<List<LeaveDto>>

    @GET("api/school/stats")
    suspend fun getSchoolStats(
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolStatsResponseDto>

    @GET("api/school/classes")
    suspend fun getClasses(
        @Header("Authorization") authHeader: String? = null
    ): Response<ClassesResponseDto>

    @GET("api/school/timetable")
    suspend fun getTimetable(
        @Query("class_id") classId: Int,
        @Query("date") date: String? = null
    ): Response<TimetableResponseDto>

    @GET("api/school/students")
    suspend fun getStudents(
        @Header("Authorization") authHeader: String? = null,
        @Query("search") search: String? = null,
        @Query("class_id") classId: Int? = null
    ): Response<StudentsResponseDto>

    @GET("api/school/staff")
    suspend fun getStaff(
        @Header("Authorization") authHeader: String? = null,
        @Query("search") search: String? = null
    ): Response<StaffResponseDto>

    @GET("api/school/leave-requests")
    suspend fun getSchoolLeaveRequests(
        @Header("Authorization") authHeader: String? = null,
        @Query("status") status: String? = null
    ): Response<LeaveRequestsResponseDto>

    @PUT("api/school/leave-requests/{id}/status")
    suspend fun updateLeaveStatus(
        @Path("id") id: Int,
        @Body body: UpdateLeaveStatusRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/school/announcements")
    suspend fun getAnnouncements(
        @Header("Authorization") authHeader: String? = null
    ): Response<AnnouncementsResponseDto>

    @POST("api/school/announcements")
    suspend fun createAnnouncement(
        @Body announcement: AnnouncementItemDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // Teacher Endpoints
    @GET("api/teacher/dashboard")
    suspend fun getTeacherDashboard(
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherDashboardResponseDto>

    @GET("api/teacher/classes")
    suspend fun getTeacherClasses(
        @Header("Authorization") authHeader: String? = null
    ): Response<ClassesResponseDto>

    @GET("api/teacher/students")
    suspend fun getTeacherStudents(
        @Header("Authorization") authHeader: String? = null,
        @Query("class_id") classId: Int? = null
    ): Response<StudentsResponseDto>

    @POST("api/teacher/attendance")
    suspend fun markTeacherAttendance(
        @Body request: MarkAttendanceRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/teacher/assignments")
    suspend fun getTeacherAssignments(
        @Header("Authorization") authHeader: String? = null
    ): Response<AssignmentsResponseDto>

    @POST("api/teacher/assignments")
    suspend fun createTeacherAssignment(
        @Body assignment: AssignmentItemDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/teacher/materials")
    suspend fun getTeacherMaterials(
        @Header("Authorization") authHeader: String? = null
    ): Response<MaterialsResponseDto>

    @POST("api/teacher/materials")
    suspend fun createTeacherMaterial(
        @Body material: MaterialItemDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // Student & Parent Endpoints
    @GET("api/student/dashboard")
    suspend fun getStudentDashboard(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentDashboardResponseDto>

    @GET("api/student/timetable")
    suspend fun getStudentTimetable(
        @Header("Authorization") authHeader: String? = null
    ): Response<TimetableResponseDto>

    @GET("api/student/attendance")
    suspend fun getStudentAttendance(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentAttendanceResponseDto>

    @GET("api/student/assignments")
    suspend fun getStudentAssignments(
        @Header("Authorization") authHeader: String? = null
    ): Response<AssignmentsResponseDto>

    @GET("api/student/fees")
    suspend fun getStudentFees(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentFeesResponseDto>

    @GET("api/student/materials")
    suspend fun getStudentMaterials(
        @Header("Authorization") authHeader: String? = null
    ): Response<MaterialsResponseDto>

    @GET("api/student/announcements")
    suspend fun getStudentAnnouncements(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentAnnouncementsResponseDto>
}
