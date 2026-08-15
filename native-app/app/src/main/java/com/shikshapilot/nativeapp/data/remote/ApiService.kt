package com.shikshapilot.nativeapp.data.remote

import com.google.gson.JsonElement
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

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
    val section: String? = null,
    val stream: String? = null,
    val school_id: Int? = null,
    val academic_year_id: Int? = null,
    // Joined from academic_years table (`SELECT c.*, ay.name AS academic_year_name`); the
    // backend `classes` table itself has no student_count/class_teacher columns — a class row
    // is one class+section combination, and per-section student counts/class-teacher assignment
    // are not part of this endpoint's contract.
    val academic_year_name: String? = null,
    val created_at: String? = null
)

data class ClassesResponseDto(
    val status: String? = "success",
    val data: List<ClassDto> = emptyList()
)

// POST/PUT /api/school/classes body. Create resolves `class_id` (or `name`) + `sections` (list,
// max 4) against the master catalog. Update requires `oldName` + `name` + `sections`.
data class CreateClassRequestDto(
    val class_id: String? = null,
    val name: String,
    val sections: List<String>? = null
)

data class UpdateClassRequestDto(
    val oldName: String,
    val name: String,
    val sections: List<String>? = null
)

data class DeleteClassRequestDto(
    val name: String,
    val section: String? = null
)

data class NextRollNoResponseDto(
    val status: String? = "success",
    val data: NextRollNoDataDto? = null
)

data class NextRollNoDataDto(
    val next_roll_no: Any? = null
)

data class TimetableItemDto(
    val id: Int? = null,
    val class_id: Int? = null,
    val subject_id: Int? = null,
    val teacher_id: Int? = null,
    val day_of_week: String? = null,
    val period_number: Int? = 1,
    val subject_name: String? = null,
    val teacher_name: String? = null,
    val start_time: String? = null,
    val end_time: String? = null,
    val room: String? = null,
    val class_name: String? = null,
    val start_date: String? = null,
    val end_date: String? = null,
    val day_date: String? = null,
    val backup_teacher_id: Int? = null,
    val backup_teacher_name: String? = null,
    val active_teacher_id: Int? = null,
    val is_backup: Boolean = false,
    val is_published: Int = 1,
    val is_free: Boolean = false
)

data class TimetableResponseDto(
    val status: String? = "success",
    val data: JsonElement? = null
)

// GET /api/school/timetable with class_id + date returns an object keyed by day name
// (`{"Monday": {"date":..., "day":..., "periods":[...]}, ...}`) — see
// SchoolAdminService::getTimetable(). Without a date it returns a flat array of all periods
// (all classes, school-wide) instead, so the school-admin screen always passes a date.
data class TimetableDayScheduleDto(
    val date: String? = null,
    val day: String? = null,
    val periods: List<TimetableItemDto> = emptyList()
)

// POST /api/school/timetable body (SchoolAdminService::addTimetablePeriod) — class/subject/
// teacher/day_of_week/period_number are required; start_date defaults server-side to the
// working academic year's start date if omitted.
data class AddTimetablePeriodRequestDto(
    val class_id: Int,
    val subject_id: Int,
    val teacher_id: Int,
    val day_of_week: String,
    val period_number: Int,
    val start_time: String? = null,
    val end_time: String? = null,
    val room: String? = null,
    val start_date: String? = null
)

// POST /api/school/timetable/publish body (SchoolAdminService::publishTimetable) — class_id
// required; optional date/day_of_week to scope publishing to a specific day.
data class PublishTimetableRequestDto(
    val class_id: Int,
    val date: String? = null,
    val day_of_week: String? = null
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
    // Real `leave_requests` table columns are from_date/to_date, NOT start_date/end_date
    // (see LeaveRequestRepository::findWithDetails() -> `SELECT lr.*, ...`).
    val from_date: String? = null,
    val to_date: String? = null,
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
    val subject: String,
    val description: String,
    val audience: String? = "Both",
    val status: String? = "Draft",
    val published_at: String? = null,
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

// StudentAnnouncementItemDto uses the same real field names (subject/description/audience/
// status/published_at) as AnnouncementItemDto above, for the read-only student/parent notices endpoint.
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

// --- TEACHER LEAVE DTOS ---
// Real `leave_requests` table columns are from_date/to_date (NOT start_date/end_date as the
// pre-existing LeaveRequestItemDto above assumes for the school-admin leave screen). This DTO
// uses the correct column names so the new teacher leave screen renders/submits real data.
data class TeacherLeaveItemDto(
    val id: Int? = null,
    val applicant_role: String? = null,
    val leave_type: String,
    val from_date: String,
    val to_date: String,
    val reason: String,
    val status: String? = "PENDING",
    val reject_reason: String? = null,
    val created_at: String? = null
)

data class TeacherLeaveListResponseDto(
    val status: String? = "success",
    val data: List<TeacherLeaveItemDto> = emptyList()
)

data class ApplyLeaveRequestDto(
    val leave_type: String,
    val from_date: String,
    val to_date: String,
    val reason: String
)

// --- TEACHER NOTIFICATIONS DTOS ---

data class TeacherNotificationItemDto(
    val id: Int? = null,
    val title: String? = null,
    val message: String? = null,
    val link: String? = null,
    val path: String? = null,
    val is_read: Int? = 0,
    val created_at: String? = null
)

data class TeacherNotificationsResponseDto(
    val status: String? = "success",
    val data: List<TeacherNotificationItemDto> = emptyList()
)

data class MarkNotificationReadRequestDto(
    val event_key: String? = null,
    val link: String? = null,
    val title: String? = null
)

// --- TEACHER SALARIES DTOS ---

data class TeacherSalaryPaymentDto(
    val id: Int? = 0,
    val month: String? = null,
    val salary: Double? = 0.0,
    val disbursed_date: String? = null,
    val status: String? = "Pending"
)

data class TeacherSalaryYearDto(
    val academic_year_name: String? = null,
    val salary: Double? = 0.0,
    val has_unpaid: Boolean? = null,
    val payments: List<TeacherSalaryPaymentDto> = emptyList()
)

data class TeacherSalariesDataDto(
    val current_year: TeacherSalaryYearDto? = null,
    val previous_year: TeacherSalaryYearDto? = null
)

data class TeacherSalariesResponseDto(
    val status: String? = "success",
    val data: TeacherSalariesDataDto? = null
)

// --- EXAMS (SCHOOL ADMIN) ---

// Raw `examinations` table row (SchoolAdminService::getExaminations/createExamination/getExaminationDetails).
data class ExamItemDto(
    val id: Int,
    val school_id: Int? = null,
    val academic_year_id: Int? = null,
    val name: String,
    val start_date: String? = null,
    val end_date: String? = null,
    val publish_date: String? = null,
    val description: String? = null,
    val status: String? = "Draft",
    val papers_count: Int? = null
)

data class ExamsListResponseDto(
    val status: String? = "success",
    val data: List<ExamItemDto> = emptyList()
)

data class ExamResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: ExamItemDto? = null
)

data class CreateExamRequestDto(
    val name: String,
    val start_date: String,
    val end_date: String,
    val publish_date: String,
    val description: String? = null
)

data class ExamClassStatusItemDto(
    val id: Int,
    val name: String,
    val section: String? = null,
    val status: String? = "Draft",
    val publish_date: String? = null,
    val scheme_published: Int? = 0,
    val admit_card_published: Int? = 0
)

data class ExamClassStatusResponseDto(
    val status: String? = "success",
    val data: List<ExamClassStatusItemDto> = emptyList()
)

data class PublishExamRequestDto(
    val class_id: Int,
    val status: String = "Published"
)

// --- EXAMS (TEACHER) ---

data class TeacherExamListItemDto(
    val id: Int,
    val name: String,
    val start_date: String? = null,
    val end_date: String? = null,
    val scheme_published: Int? = 0,
    val result_status: String? = "Draft",
    val result_published: Int? = 0,
    val status: String? = null
)

data class TeacherExamsListResponseDto(
    val status: String? = "success",
    val data: List<TeacherExamListItemDto> = emptyList()
)

data class TeacherExamPaperDto(
    val id: Int? = null,
    val subject_id: Int? = null,
    val exam_date: String? = null,
    val start_time: String? = null,
    val end_time: String? = null,
    val max_marks: Double? = 0.0,
    val passing_marks: Double? = 0.0,
    val room: String? = null,
    val evaluation_type: String? = "marks",
    val subject_name: String? = null
)

data class TeacherExamResultPaperDto(
    val subject_name: String? = null,
    val marks_obtained: Double? = null,
    val is_absent: Int? = 0,
    val max_marks: Double? = 0.0,
    val passing_marks: Double? = 0.0
)

data class TeacherExamResultStudentDto(
    val student_id: Int,
    val roll_number: String? = null,
    val student_name: String? = null,
    val papers: List<TeacherExamResultPaperDto> = emptyList(),
    val total_max_marks: Double? = 0.0,
    val total_marks_obtained: Double? = 0.0,
    val status: String? = null
)

data class TeacherExamDetailsDto(
    val exam_name: String? = null,
    val start_date: String? = null,
    val end_date: String? = null,
    val scheme_published: Int? = 0,
    val result_published: Int? = 0,
    val scheme: List<TeacherExamPaperDto> = emptyList(),
    val has_papers: Int? = 0,
    val result: List<TeacherExamResultStudentDto>? = null
)

data class TeacherExamDetailsResponseDto(
    val status: String? = "success",
    val data: TeacherExamDetailsDto? = null
)

// `marks_obtained` is numeric for "marks" papers and a letter grade string for "grade" papers
// (see TeacherService::getMarksSheet) — Gson maps either JSON shape into `Any?` (Double/String).
data class TeacherMarksSheetStudentDto(
    val student_id: Int,
    val student_name: String? = null,
    val roll_no: String? = null,
    val marks_obtained: Any? = null,
    val is_absent: Int? = 0,
    val remarks: String? = null
)

data class TeacherMarksSheetDto(
    val exam_name: String? = null,
    val class_name: String? = null,
    val subject_name: String? = null,
    val evaluation_type: String? = "marks",
    val max_marks: Double? = 0.0,
    val passing_marks: Double? = 0.0,
    val available_grades: List<String> = emptyList(),
    val is_result_published: Boolean? = false,
    val students: List<TeacherMarksSheetStudentDto> = emptyList()
)

data class TeacherMarksSheetResponseDto(
    val status: String? = "success",
    val data: TeacherMarksSheetDto? = null
)

data class SaveMarkItemDto(
    val student_id: Int,
    val marks_obtained: String? = null,
    val is_absent: Int = 0,
    val remarks: String? = null
)

data class SaveMarksSheetRequestDto(
    val subject_id: Int,
    val marks: List<SaveMarkItemDto>
)

// --- EXAMS (STUDENT) ---

data class StudentExamListItemDto(
    val id: Int,
    val name: String,
    val start_date: String? = null,
    val end_date: String? = null,
    val scheme_published: Int? = 0,
    val admit_card_published: Int? = 0,
    val result_status: String? = "Draft",
    val result_published: Int? = 0,
    val status: String? = null
)

data class StudentExamsListResponseDto(
    val status: String? = "success",
    val data: List<StudentExamListItemDto> = emptyList()
)

data class StudentExamSchemeItemDto(
    val id: Int? = null,
    val exam_date: String? = null,
    val start_time: String? = null,
    val end_time: String? = null,
    val max_marks: Double? = 0.0,
    val passing_marks: Double? = 0.0,
    val room: String? = null,
    val subject_name: String? = null
)

data class StudentAdmitCardDto(
    val school_name: String? = null,
    val academic_year: String? = null,
    val student_name: String? = null,
    val class_name: String? = null,
    val roll_no: String? = null,
    val room_name: String? = null,
    val bench_number: String? = null,
    val seat_position: String? = null,
    val seat_number: String? = null
)

data class StudentResultPaperDto(
    val subject_name: String? = null,
    val marks_obtained: Double? = null,
    val is_absent: Int? = 0,
    val remarks: String? = null,
    val max_marks: Double? = 0.0,
    val passing_marks: Double? = 0.0
)

data class StudentResultDto(
    val papers: List<StudentResultPaperDto> = emptyList(),
    val total_max_marks: Double? = 0.0,
    val total_marks_obtained: Double? = 0.0,
    val status: String? = null
)

// Shared report-card shape (SchoolAdminService::getReportCards / StudentService::getPublishedReportCards
// both build this exact structure). `max_marks`/`passing_marks`/`marks_obtained` are `Any?` because the
// backend emits either a number or the literal string "—"/"ABSENT" for grade-only or missing papers.
data class ReportCardSubjectDto(
    val subject_name: String? = null,
    val max_marks: Any? = null,
    val passing_marks: Any? = null,
    val marks_obtained: Any? = null,
    val grade: String? = null,
    val remarks: String? = null,
    val result: String? = null
)

data class ReportCardAttendanceDto(
    val working_days: Int? = 0,
    val present_days: Int? = 0,
    val attendance_rate: Double? = 0.0
)

data class ReportCardDto(
    val exam_id: Int? = null,
    val student_id: Int? = null,
    val student_name: String? = null,
    val roll_no: String? = null,
    val admission_no: String? = null,
    val father_name: String? = null,
    val mother_name: String? = null,
    val dob: String? = null,
    val class_name: String? = null,
    val class_section: String? = null,
    val exam_name: String? = null,
    val academic_year_name: String? = null,
    val school_name: String? = null,
    val school_logo: String? = null,
    val report_card_remark: String? = null,
    val subjects: List<ReportCardSubjectDto> = emptyList(),
    val total_max: Double? = 0.0,
    val total_obtained: Double? = 0.0,
    val percentage: Double? = 0.0,
    val grade: String? = null,
    val result: String? = null,
    val class_rank: String? = null,
    val section_rank: String? = null,
    val attendance: ReportCardAttendanceDto? = null,
    val status: String? = null
)

data class StudentExamDetailsDto(
    val exam_name: String? = null,
    val start_date: String? = null,
    val end_date: String? = null,
    val scheme_published: Int? = 0,
    val admit_card_published: Int? = 0,
    val result_published: Int? = 0,
    val scheme: List<StudentExamSchemeItemDto>? = null,
    val admit_card: StudentAdmitCardDto? = null,
    val result: StudentResultDto? = null,
    val report_card: ReportCardDto? = null,
    val is_restricted: Boolean? = false,
    val admit_card_restricted: Boolean? = false,
    val result_restricted: Boolean? = false
)

data class StudentExamDetailsResponseDto(
    val status: String? = "success",
    val data: StudentExamDetailsDto? = null
)

data class StudentReportCardsResponseDto(
    val status: String? = "success",
    val data: List<ReportCardDto> = emptyList()
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

    @POST("api/school/classes")
    suspend fun createClass(
        @Body request: CreateClassRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @PUT("api/school/classes")
    suspend fun updateClass(
        @Body request: UpdateClassRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @HTTP(method = "DELETE", path = "api/school/classes", hasBody = true)
    suspend fun deleteClass(
        @Body request: DeleteClassRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/school/classes/{class_id}/next-roll-no")
    suspend fun getNextRollNo(
        @Path("class_id") classId: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<NextRollNoResponseDto>

    @GET("api/school/timetable")
    suspend fun getTimetable(
        @Query("class_id") classId: Int,
        @Query("date") date: String? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<TimetableResponseDto>

    @POST("api/school/timetable")
    suspend fun addTimetablePeriod(
        @Body request: AddTimetablePeriodRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @DELETE("api/school/timetable/{id}")
    suspend fun deleteTimetablePeriod(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @POST("api/school/timetable/publish")
    suspend fun publishTimetable(
        @Body request: PublishTimetableRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

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

    @GET("api/school/exams-new")
    suspend fun getSchoolExams(
        @Header("Authorization") authHeader: String? = null
    ): Response<ExamsListResponseDto>

    @POST("api/school/exams-new")
    suspend fun createSchoolExam(
        @Body request: CreateExamRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<ExamResponseDto>

    @GET("api/school/exams-new/{id}")
    suspend fun getSchoolExamDetails(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<ExamResponseDto>

    @GET("api/school/exams-new/{id}/class-status")
    suspend fun getSchoolExamClassStatus(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<ExamClassStatusResponseDto>

    @POST("api/school/exams-new/{id}/publish")
    suspend fun publishSchoolExam(
        @Path("id") id: Int,
        @Body request: PublishExamRequestDto,
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

    // Teacher own leave requests (reuses api/school/leave-requests; for TEACHER-role callers the
    // backend defaults view_type to OWN and applicant_role to TEACHER server-side).
    @GET("api/school/leave-requests")
    suspend fun getTeacherLeaveRequests(
        @Header("Authorization") authHeader: String? = null,
        @Query("status") status: String? = null
    ): Response<TeacherLeaveListResponseDto>

    @POST("api/school/leave-requests")
    suspend fun applyTeacherLeaveRequest(
        @Body request: ApplyLeaveRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/teacher/notifications")
    suspend fun getTeacherNotifications(
        @Header("Authorization") authHeader: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null
    ): Response<TeacherNotificationsResponseDto>

    @POST("api/teacher/notifications/{id}/read")
    suspend fun markTeacherNotificationRead(
        @Path("id") id: Int,
        @Body body: MarkNotificationReadRequestDto = MarkNotificationReadRequestDto(),
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @DELETE("api/teacher/notifications/{id}")
    suspend fun deleteTeacherNotification(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/teacher/salaries")
    suspend fun getTeacherSalaries(
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherSalariesResponseDto>

    @Streaming
    @GET("api/teacher/salaries/receipt")
    suspend fun getTeacherSalaryReceipt(
        @Query("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<ResponseBody>

    @GET("api/teacher/exams-new")
    suspend fun getTeacherExams(
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherExamsListResponseDto>

    @GET("api/teacher/exams-new/{id}/details")
    suspend fun getTeacherExamDetails(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherExamDetailsResponseDto>

    @GET("api/teacher/exams-new/{id}/marks-sheet")
    suspend fun getTeacherMarksSheet(
        @Path("id") id: Int,
        @Query("subject_id") subjectId: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherMarksSheetResponseDto>

    @POST("api/teacher/exams-new/{id}/marks-sheet")
    suspend fun saveTeacherMarksSheet(
        @Path("id") id: Int,
        @Body request: SaveMarksSheetRequestDto,
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

    @GET("api/student/exams-new")
    suspend fun getStudentExams(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentExamsListResponseDto>

    @GET("api/student/exams-new/{id}/details")
    suspend fun getStudentExamDetails(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentExamDetailsResponseDto>

    @GET("api/student/exams-new/report-cards")
    suspend fun getStudentReportCards(
        @Header("Authorization") authHeader: String? = null
    ): Response<StudentReportCardsResponseDto>
}
