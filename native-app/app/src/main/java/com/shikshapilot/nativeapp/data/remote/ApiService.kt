package com.shikshapilot.nativeapp.data.remote

import com.google.gson.JsonElement
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
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

// Transport Fees — GET/POST/PUT/DELETE api/school/transport-fees{,/{id}}, PUT .../{id}/status
// (SchoolAdminController::getTransportFees/assignTransportFee/updateTransportFee/deleteTransportFee/
// toggleTransportFeeStatus -> student_transport_fees table joined with students/classes).
data class TransportFeeItemDto(
    val id: Int,
    val student_id: Int,
    val monthly_fee: Double,
    val start_date: String,
    val status: String? = "Active",
    val student_name: String? = null,
    val sr_no: String? = null,
    val roll_no: String? = null,
    val class_name: String? = null,
    val class_section: String? = null
)

data class TransportFeesResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: List<TransportFeeItemDto> = emptyList()
)

data class AssignTransportFeeRequestDto(
    val student_id: Int,
    val monthly_fee: Double,
    val start_date: String,
    val status: String = "Active"
)

data class UpdateTransportFeeRequestDto(
    val monthly_fee: Double? = null,
    val start_date: String? = null,
    val status: String? = null
)

data class ToggleTransportFeeStatusRequestDto(
    val status: String
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
    val photo_path: String? = null,
    val father_name: String? = null,
    val mother_name: String? = null,
    val joining_date: String? = null,
    val exit_date: String? = null
)

data class StaffResponseDto(
    val status: String? = "success",
    val data: List<StaffItemDto> = emptyList()
)

data class CreateStaffRequestDto(
    val name: String,
    val father_name: String,
    val mother_name: String,
    val phone: String,
    val joining_date: String,
    val salary: Double,
    val role: String? = "Teacher",
    val department: String? = null,
    val email: String? = null,
    val status: String? = null,
    val exit_date: String? = null
)

data class UpdateStaffRequestDto(
    val name: String,
    val father_name: String,
    val mother_name: String,
    val phone: String,
    val joining_date: String,
    val salary: Double,
    val role: String? = "Teacher",
    val department: String? = null,
    val email: String? = null,
    val status: String? = null,
    val exit_date: String? = null
)

data class StaffDetailsResponseDto(
    val status: String? = "success",
    val data: StaffItemDto? = null
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

// -----------------------------------------------------------------------------------------
// Finance breakdown DTOs (school-admin) — verified against
// backend/src/Domain/SchoolAdmin/{Controllers,Services}/SchoolAdminController.php /
// SchoolAdminService.php and backend/src/Database/Migrations/001_baseline_schema.sql
// (`fee_structures`, `fee_payments`, `class_fee_configurations`, `fee_follow_ups`,
// `fee_follow_up_notes`, `staff_payments`, `financial_reports` tables).
// -----------------------------------------------------------------------------------------

// GET/POST api/school/fee-structures (SchoolAdminService::getFeeStructures/createFeeStructure)
data class FeeStructureDto(
    val id: Int,
    val school_id: Int? = null,
    val name: String,
    val amount: Double = 0.0,
    val frequency: String? = null,
    val class_id: Int? = null,
    val class_name: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null
)

data class FeeStructuresResponseDto(
    val status: String? = "success",
    val data: List<FeeStructureDto> = emptyList()
)

data class CreateFeeStructureRequestDto(
    val name: String,
    val amount: Double,
    val frequency: String? = "Monthly",
    val class_id: Int? = null
)

data class FeeStructureResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: FeeStructureDto? = null
)

// GET api/school/class-fee-configurations (SchoolAdminService::getClassFeeConfigurations);
// `monthly_fees` is stored as JSON text server-side but decoded to a map before returning.
data class ClassFeeConfigurationDto(
    val id: Int,
    val school_id: Int? = null,
    val academic_year_id: Int,
    val class_id: Int,
    val mode: String? = "SAME",
    val monthly_fees: Map<String, Double>? = null,
    val amount: Double? = null,
    val is_locked: Int = 0,
    val created_at: String? = null,
    val updated_at: String? = null
)

data class ClassFeeConfigurationsResponseDto(
    val status: String? = "success",
    val data: List<ClassFeeConfigurationDto> = emptyList()
)

// POST api/school/class-fee-configurations (SchoolAdminService::saveClassFeeConfiguration) —
// `class_id` accepts either a school class_id or a master-catalog id/name; `monthly_fees` is a
// map of academic month name -> amount (April..March).
data class SaveClassFeeConfigurationRequestDto(
    val class_id: String,
    val academic_year_id: Int? = null,
    val monthly_fees: Map<String, Double>
)

// POST api/school/fee-payments (SchoolAdminService::createFeePayment)
data class CreateFeePaymentRequestDto(
    val student_id: Int,
    val months: List<String>? = null,
    val fee_month: String? = null,
    val amount_paid: Double? = null,
    val payment_method: String? = "Cash"
)

data class FeePaymentDto(
    val id: Int,
    val school_id: Int? = null,
    val student_id: Int? = null,
    val fee_structure_id: Int? = null,
    val amount_paid: Double = 0.0,
    val payment_date: String? = null,
    val receipt_no: String? = null,
    val status: String? = null,
    val fee_month: String? = null,
    val academic_year_id: Int? = null,
    val payment_method: String? = null,
    val collected_by: String? = null
)

data class FeePaymentResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: FeePaymentDto? = null
)

// GET api/school/collection-history (SchoolAdminService::getCollectionHistory) — transactions
// are grouped monthly-fee payments merged with additional-fee payments by receipt_no.
data class CollectionHistoryItemDto(
    val id: Int,
    val type: String? = null,
    val receipt_no: String? = null,
    val student_name: String? = null,
    val student_roll_no: String? = null,
    val class_name: String? = null,
    val fee_name: String? = null,
    val collected_by: String? = null,
    val payment_method: String? = null,
    val amount: Double = 0.0,
    val amount_paid: Double = 0.0,
    val fee_month: String? = null,
    val payment_date: String? = null,
    val created_at: String? = null,
    val status: String? = null,
    val previous_total: Double? = null,
    val updated_total: Double? = null
)

data class CollectionHistoryStatsDto(
    val total_collected: Double = 0.0,
    val today_collection: Double = 0.0,
    val this_month_collection: Double = 0.0,
    val total_transactions: Int = 0
)

data class CollectionHistoryDataDto(
    val transactions: List<CollectionHistoryItemDto> = emptyList(),
    val stats: CollectionHistoryStatsDto? = null,
    val available_months: List<String> = emptyList(),
    val selected_month: String? = null
)

data class CollectionHistoryResponseDto(
    val status: String? = "success",
    val data: CollectionHistoryDataDto? = null
)

// GET api/school/fee-follow-ups (SchoolAdminService::getFeeFollowUps)
data class FeeFollowUpItemDto(
    val id: Int,
    val school_id: Int? = null,
    val student_id: Int,
    val academic_year_id: Int? = null,
    val pending_amount: Double = 0.0,
    val promised_date: String? = null,
    val reason: String? = null,
    val reminder_notes: String? = null,
    val status: String? = null,
    val created_by: Int? = null,
    val completed_at: String? = null,
    val extended_count: Int = 0,
    val student_name: String? = null,
    val roll_no: String? = null,
    val class_name: String? = null,
    val mobile_number: String? = null
)

data class FeeFollowUpStatsDto(
    val pending: Int = 0,
    val due_today: Int = 0,
    val upcoming: Int = 0,
    val overdue: Int = 0,
    val completed: Int = 0
)

data class FeeFollowUpsDataDto(
    val stats: FeeFollowUpStatsDto? = null,
    val items: List<FeeFollowUpItemDto> = emptyList()
)

data class FeeFollowUpsResponseDto(
    val status: String? = "success",
    val data: FeeFollowUpsDataDto? = null
)

data class FeeFollowUpNoteDto(
    val id: Int,
    val follow_up_id: Int? = null,
    val comment: String,
    val created_by: Int? = null,
    val user_name: String? = null,
    val created_at: String? = null
)

// GET api/school/fee-follow-ups/{id} (SchoolAdminService::getFeeFollowUpDetails)
data class FeeFollowUpDetailsDto(
    val id: Int,
    val student_id: Int? = null,
    val student_name: String? = null,
    val admission_no: String? = null,
    val class_name: String? = null,
    val parent_name: String? = null,
    val mobile_number: String? = null,
    val creator_name: String? = null,
    val pending_amount: Double = 0.0,
    val promised_date: String? = null,
    val reason: String? = null,
    val status: String? = null,
    val extended_count: Int = 0,
    val notes: List<FeeFollowUpNoteDto> = emptyList()
)

data class FeeFollowUpDetailsResponseDto(
    val status: String? = "success",
    val data: FeeFollowUpDetailsDto? = null
)

// PUT api/school/fee-follow-ups/{id}/extend
data class ExtendFollowUpRequestDto(
    val promised_date: String,
    val reason: String? = null
)

// PUT api/school/fee-follow-ups/{id}/status
data class UpdateFollowUpStatusRequestDto(
    val status: String
)

// POST api/school/fee-follow-ups/{id}/notes
data class AddFollowUpNoteRequestDto(
    val comment: String
)

// POST api/school/fee-follow-ups/{id}/contacted
data class MarkFollowUpContactedRequestDto(
    val comment: String? = null
)

// GET api/school/staff-payments?month=... (SchoolAdminService::getStaffPayments)
data class StaffPaymentItemDto(
    val id: Int,
    val name: String? = null,
    val designation: String? = null,
    val salary: Double = 0.0,
    val payable_salary: Double = 0.0,
    val status: String? = null,
    val date: String? = null,
    val payment_id: Int? = null,
    val photo_path: String? = null
)

data class StaffPaymentsResponseDto(
    val status: String? = "success",
    val data: List<StaffPaymentItemDto> = emptyList()
)

// POST api/school/staff-payments (SchoolAdminService::payStaffSalary)
data class PayStaffSalaryRequestDto(
    val staff_id: Int,
    val month: String
)

data class PayStaffSalaryResultDto(
    val success: Boolean = false,
    val id: Int? = null
)

data class PayStaffSalaryResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: PayStaffSalaryResultDto? = null
)

// GET/POST api/school/financial-reports (SchoolAdminService::getFinancialReports/createFinancialReport)
data class FinancialReportItemDto(
    val id: Int,
    val school_id: Int? = null,
    val report_id: String? = null,
    val from_date: String? = null,
    val to_date: String? = null,
    val fees_collected: Double = 0.0,
    val salary_paid: Double = 0.0,
    val profit_loss: Double = 0.0,
    val status: String? = null,
    val created_at: String? = null,
    val updated_at: String? = null
)

data class FinancialReportsDataDto(
    val reports: List<FinancialReportItemDto> = emptyList(),
    val next_suggested_start_date: String? = null,
    val has_previous_report: Boolean = false
)

data class FinancialReportsResponseDto(
    val status: String? = "success",
    val data: FinancialReportsDataDto? = null
)

data class CreateFinancialReportRequestDto(
    val from_date: String,
    val to_date: String
)

data class FinancialReportResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: FinancialReportItemDto? = null
)

data class UpdateFinancialReportStatusRequestDto(
    val status: String
)

// ---------------------------------------------------------------------------
// Security: GET api/school/security/audit-logs, GET api/school/security/login-history
// (SchoolAdminService::getSchoolAuditLogs / getSchoolLoginHistory — both query `audit_logs` table)
// ---------------------------------------------------------------------------
data class AuditLogItemDto(
    val id: Int,
    val module: String? = null,
    val action: String? = null,
    val description: String? = null,
    val user: String? = null,
    val performed_by: String? = null,
    val created_at: String? = null,
    val formatted_date: String? = null
)

data class AuditLogUserDto(
    val user: String? = null,
    val performed_by: String? = null
)

data class AuditLogsDataDto(
    val logs: List<AuditLogItemDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 25,
    val modules: List<String> = emptyList(),
    val users: List<AuditLogUserDto> = emptyList()
)

data class AuditLogsResponseDto(
    val status: String? = "success",
    val data: AuditLogsDataDto? = null
)

data class LoginHistoryItemDto(
    val id: Int,
    val action: String? = null,
    val status: String? = null,
    val user: String? = null,
    val performed_by: String? = null,
    val created_at: String? = null,
    val formatted_date: String? = null
)

data class LoginHistoryDataDto(
    val history: List<LoginHistoryItemDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 25
)

data class LoginHistoryResponseDto(
    val status: String? = "success",
    val data: LoginHistoryDataDto? = null
)

// ---------------------------------------------------------------------------
// School Profile: GET/POST api/school/profile, POST/DELETE .../logo, .../signature
// (SchoolAdminService::getSchoolProfile / updateSchoolProfile — `schools` table row)
// ---------------------------------------------------------------------------
data class SchoolProfileDto(
    val id: Int,
    val name: String? = null,
    val contact_phone: String? = null,
    val contact_email: String? = null,
    val registration_no: String? = null,
    val affiliation_board: String? = null,
    val school_type: String? = null,
    val founded_year: String? = null,
    val medium_of_instruction: String? = null,
    val street_address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val pin_code: String? = null,
    val current_term: String? = null,
    val term_start: String? = null,
    val term_end: String? = null,
    val classes_offered: String? = null,
    val report_card_remark: String? = null,
    val logo_path: String? = null,
    val principal_signature_path: String? = null,
    val active_plan: String? = null,
    val subscription_expiry: String? = null,
    val subscription_start: String? = null
)

data class SchoolProfileResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: SchoolProfileDto? = null
)

// Only the editable fields from SchoolAdminService::updateSchoolProfile's UPDATE statement.
data class UpdateSchoolProfileRequestDto(
    val name: String? = null,
    val contact_phone: String? = null,
    val contact_email: String? = null,
    val registration_no: String? = null,
    val affiliation_board: String? = null,
    val school_type: String? = null,
    val founded_year: String? = null,
    val medium_of_instruction: String? = null,
    val street_address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val pin_code: String? = null,
    val current_term: String? = null,
    val term_start: String? = null,
    val term_end: String? = null,
    val classes_offered: String? = null,
    val report_card_remark: String? = null
)

// ---------------------------------------------------------------------------
// Academic Setup: academic-years, holidays, subjects, grade-configurations
// ---------------------------------------------------------------------------
data class AcademicYearItemDto(
    val id: Int,
    val school_id: Int? = null,
    val name: String? = null,
    val start_date: String? = null,
    val end_date: String? = null,
    val is_current: Int? = 0,
    val status: String? = null,
    val migration_status: String? = null
)

data class AcademicYearsResponseDto(
    val status: String? = "success",
    val data: List<AcademicYearItemDto> = emptyList()
)

// POST api/school/academic-years (SchoolAdminService::createAcademicYear) — name must be "YYYY-YYYY".
data class CreateAcademicYearRequestDto(
    val name: String,
    val start_date: String? = null,
    val end_date: String? = null
)

data class CreateAcademicYearResultDto(
    val id: Int? = null,
    val name: String? = null,
    val status: String? = null
)

data class CreateAcademicYearResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: CreateAcademicYearResultDto? = null
)

data class HolidayItemDto(
    val id: Int,
    val school_id: Int? = null,
    val academic_year_id: Int? = null,
    val name: String? = null,
    val date: String? = null
)

data class HolidaysResponseDto(
    val status: String? = "success",
    val data: List<HolidayItemDto> = emptyList()
)

// POST/PUT api/school/holidays(/{id}) (SchoolAdminService::createHoliday/updateHoliday) — `name` + `date` (YYYY-MM-DD).
data class HolidayRequestDto(
    val name: String,
    val date: String
)

data class HolidayResultDto(
    val id: Int? = null,
    val name: String? = null,
    val date: String? = null
)

data class HolidayResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: HolidayResultDto? = null
)

data class SubjectItemDto(
    val id: Int,
    val school_id: Int? = null,
    val name: String? = null,
    val class_id: Int? = null,
    val teacher_id: Int? = null,
    val teacher_name: String? = null
)

data class SubjectsResponseDto(
    val status: String? = "success",
    val data: List<SubjectItemDto> = emptyList()
)

// POST/PUT api/school/subjects(/{id}) (SchoolAdminService::createSubject/updateSubject) — only `name`.
data class SubjectRequestDto(
    val name: String
)

data class GradeConfigItemDto(
    val id: Int,
    val school_id: Int? = null,
    val min_percentage: Double = 0.0,
    val max_percentage: Double = 0.0,
    val grade: String? = null,
    val grade_point: Double? = null,
    val remark: String? = null
)

data class GradeConfigsResponseDto(
    val status: String? = "success",
    val data: List<GradeConfigItemDto> = emptyList()
)

// ---------------------------------------------------------------------------
// Credentials: GET api/school/credentials/{role}/{id}, POST api/school/credentials/generate
// (SchoolAdminService::getCredentials / generateCredentials)
// ---------------------------------------------------------------------------
data class CredentialsDto(
    val phone: String? = null,
    val plain_password: String? = null
)

data class CredentialsResponseDto(
    val status: String? = "success",
    val data: CredentialsDto? = null
)

data class GenerateCredentialsRequestDto(
    val role: String,
    val id: Int,
    val password: String? = null
)

data class GenerateCredentialsResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: CredentialsDto? = null
)

// -----------------------------------------------------------------------------------------
// Achievements + Vocabulary/Word-Builder game + Notification preferences DTOs — verified
// against backend/src/Domain/SchoolAdmin/SchoolAdminService.php (getAchievements /
// getAchievementReportCard), backend/src/Domain/Vocabulary/VocabularyService.php, and
// backend/src/Shared/Notifications/{DeviceTokenController,DeviceTokenService,NotificationCatalog}.php.
// -----------------------------------------------------------------------------------------

data class AchievementCategorySummaryDto(
    val count: Int? = 0,
    val label: String? = null,
    val description: String? = null
)

data class AchievementCategoriesSummaryDto(
    val attendance_champions: AchievementCategorySummaryDto? = null,
    val academic_excellence: AchievementCategorySummaryDto? = null
)

data class AchievementItemDto(
    val id: Int? = null,
    val school_id: Int? = null,
    val academic_year_id: Int? = null,
    val feature_type: String? = null,
    val category: String? = null,
    val category_label: String? = null,
    val class_id: Int? = null,
    val student_id: Int? = null,
    val student_name: String? = null,
    val student_photo: String? = null,
    val class_name: String? = null,
    val roll_number: String? = null,
    val achievement_score: Double? = null,
    val rank: Int? = null,
    val level: String? = null,
    val metadata: JsonElement? = null,
    val created_at: String? = null
)

data class AchievementClassDto(
    val id: Int? = null,
    val name: String? = null,
    val section: String? = null
)

data class AchievementAcademicYearDto(
    val id: Int? = null,
    val name: String? = null,
    val status: String? = null,
    val is_current: Boolean? = null
)

data class AchievementsDataDto(
    val academic_year_id: Int? = null,
    val categories_summary: AchievementCategoriesSummaryDto? = null,
    val achievements: List<AchievementItemDto> = emptyList(),
    val classes: List<AchievementClassDto> = emptyList(),
    val academic_years: List<AchievementAcademicYearDto> = emptyList()
)

data class AchievementsResponseDto(
    val status: String? = "success",
    val data: AchievementsDataDto? = null
)

// Achievement report card reuses the shared ReportCardDto shape (SchoolAdminService::getReportCards).
data class AchievementReportCardResponseDto(
    val status: String? = "success",
    val data: ReportCardDto? = null
)

data class VocabularyWordDto(
    val id: Int? = null,
    val mapping_id: Int? = null,
    val word: String? = null,
    val part_of_speech: String? = null,
    val english_meaning: String? = null,
    val hindi_meaning: String? = null,
    val english_sentence: String? = null,
    val hindi_sentence: String? = null,
    val category: String? = null,
    val phonics: String? = null,
    val synonyms: List<String>? = null,
    val opposites: List<String>? = null,
    val image_path: String? = null,
    val audio_path: String? = null,
    val cefr_level: String? = null,
    val tags: String? = null
)

data class GameProgressDto(
    val coins: Int? = 0,
    val score: Int? = 0,
    val current_level: Int? = 1,
    val current_stage: Int? = 1,
    val current_streak: Int? = 0,
    val highest_streak: Int? = 0,
    val correct_answers: Int? = 0,
    val wrong_answers: Int? = 0,
    val total_play_time: Int? = 0,
    val total_words_learned: Int? = 0,
    val total_words_mastered: Int? = 0,
    val accuracy_percent: Double? = 0.0,
    val last_login_reward_date: String? = null
)

data class GameProgressDataDto(
    val progress: GameProgressDto? = null,
    val active_words: List<VocabularyWordDto> = emptyList(),
    val learned_words: List<String> = emptyList(),
    val student_class: String? = null
)

data class GameProgressResponseDto(
    val status: String? = "success",
    val data: GameProgressDataDto? = null
)

data class PlayedWordDto(
    val word_id: Int,
    val is_correct: Boolean
)

data class SyncGameProgressRequestDto(
    val coins: Int? = null,
    val score: Int? = null,
    val current_level: Int? = null,
    val current_streak: Int? = null,
    val highest_streak: Int? = null,
    val correct_answers: Int? = null,
    val wrong_answers: Int? = null,
    val total_play_time: Int? = null,
    val played_words: List<PlayedWordDto>? = null
)

data class ClaimDailyProgressDto(
    val coins: Int? = null,
    val last_login_reward_date: String? = null
)

// VocabularyService::claimDailyLogin (StudentService.php) returns either
// {success:false, message, progress:{coins,last_login_reward_date}} when already claimed today,
// or {success:true, message, data:<getGameProgress result>} on a fresh claim.
data class ClaimDailyInnerDto(
    val success: Boolean? = null,
    val message: String? = null,
    val progress: ClaimDailyProgressDto? = null,
    val data: GameProgressDataDto? = null
)

data class ClaimDailyResponseDto(
    val status: String? = "success",
    val data: ClaimDailyInnerDto? = null
)

data class VocabChallengeDto(
    val completed: Boolean? = false,
    val words: List<VocabularyWordDto> = emptyList()
)

data class VocabChallengeResponseDto(
    val status: String? = "success",
    val data: VocabChallengeDto? = null
)

data class ChallengeSubmitResultDto(
    val success: Boolean? = null,
    val message: String? = null
)

data class ChallengeSubmitResponseDto(
    val status: String? = "success",
    val data: ChallengeSubmitResultDto? = null
)

data class LeaderboardEntryDto(
    val id: Int? = null,
    val name: String? = null,
    val score: Int? = 0,
    val total_words_mastered: Int? = 0
)

data class VocabLeaderboardDataDto(
    val school_rankings: List<LeaderboardEntryDto> = emptyList(),
    val class_rankings: List<LeaderboardEntryDto> = emptyList(),
    val section_rankings: List<LeaderboardEntryDto> = emptyList()
)

data class VocabLeaderboardResponseDto(
    val status: String? = "success",
    val data: VocabLeaderboardDataDto? = null
)

data class VocabAchievementBadgeDto(
    val key: String? = null,
    val title: String? = null,
    val desc: String? = null,
    val points: Int? = 0,
    val unlocked: Boolean? = false,
    val unlocked_at: String? = null
)

// VocabularyService::getAchievements returns a plain array (not wrapped in an object key).
data class VocabAchievementsResponseDto(
    val status: String? = "success",
    val data: List<VocabAchievementBadgeDto> = emptyList()
)

data class VocabCategoryPerformanceDto(
    val category: String? = null,
    val correct: Int? = 0,
    val wrong: Int? = 0
)

data class ParentVocabStatsDto(
    val score: Int? = 0,
    val coins: Int? = 0,
    val current_level: Int? = 1,
    val total_words_learned: Int? = 0,
    val total_words_mastered: Int? = 0,
    val accuracy_percent: Double? = 0.0,
    val current_streak: Int? = 0,
    val longest_streak: Int? = 0,
    val daily_practice_days: Int? = 0
)

data class ParentVocabReportDataDto(
    val stats: ParentVocabStatsDto? = null,
    val category_performance: List<VocabCategoryPerformanceDto> = emptyList(),
    val student_name: String? = null,
    val student_class: String? = null
)

data class ParentVocabReportResponseDto(
    val status: String? = "success",
    val data: ParentVocabReportDataDto? = null
)

data class TeacherVocabSummaryDto(
    val average_accuracy: Double? = 0.0,
    val average_stage: Double? = 0.0,
    val total_words_learned: Int? = 0,
    val total_words_mastered: Int? = 0
)

data class TeacherVocabDifficultWordDto(
    val word: String? = null,
    val total_wrongs: Int? = 0
)

data class TeacherVocabActiveStudentDto(
    val first_name: String? = null,
    val last_name: String? = null,
    val score: Int? = 0,
    val total_words_learned: Int? = 0
)

data class TeacherVocabReportDataDto(
    val class_name: String? = null,
    val summary: TeacherVocabSummaryDto? = null,
    val weak_categories: List<VocabCategoryPerformanceDto> = emptyList(),
    val difficult_words: List<TeacherVocabDifficultWordDto> = emptyList(),
    val active_students: List<TeacherVocabActiveStudentDto> = emptyList()
)

data class TeacherVocabReportResponseDto(
    val status: String? = "success",
    val data: TeacherVocabReportDataDto? = null
)

// --- Notifications catalog + device registration + preferences (Shared/Notifications/*) ---

data class NotificationEventDto(
    val category: String? = null,
    val delivery: String? = null,
    val audience: List<String>? = null,
    val priority: String? = null,
    val link: String? = null,
    val label: String? = null
)

data class NotificationCatalogDataDto(
    val events: Map<String, NotificationEventDto> = emptyMap()
)

data class NotificationCatalogResponseDto(
    val status: String? = "success",
    val data: NotificationCatalogDataDto? = null
)

data class DeviceRegisterRequestDto(
    val token: String,
    val platform: String? = "android",
    val app_version: String? = null
)

data class DeviceRegisterResultDto(
    val topics: List<String>? = null
)

data class DeviceRegisterResponseDto(
    val status: String? = "success",
    val message: String? = null,
    val data: DeviceRegisterResultDto? = null
)

data class DeviceUnregisterRequestDto(
    val token: String
)

data class DeviceUnregisterResultDto(
    val deactivated: Boolean? = null
)

data class DeviceUnregisterResponseDto(
    val status: String? = "success",
    val data: DeviceUnregisterResultDto? = null
)

data class TestPushResultDto(
    val sent: Boolean? = null,
    val timestamp: String? = null
)

data class TestPushResponseDto(
    val status: String? = "success",
    val data: TestPushResultDto? = null
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

    @POST("api/school/staff")
    suspend fun createStaff(
        @Body request: CreateStaffRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<StaffDetailsResponseDto>

    @PUT("api/school/staff/{id}")
    suspend fun updateStaff(
        @Path("id") id: Int,
        @Body request: UpdateStaffRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<StaffDetailsResponseDto>

    @GET("api/school/staff/{id}")
    suspend fun getStaffDetails(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<StaffDetailsResponseDto>

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

    // -------------------------------------------------------------------------------------
    // School Admin — Finance breakdown
    // -------------------------------------------------------------------------------------

    @GET("api/school/fee-structures")
    suspend fun getFeeStructures(
        @Header("Authorization") authHeader: String? = null
    ): Response<FeeStructuresResponseDto>

    @POST("api/school/fee-structures")
    suspend fun createFeeStructure(
        @Body request: CreateFeeStructureRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<FeeStructureResponseDto>

    @GET("api/school/class-fee-configurations")
    suspend fun getClassFeeConfigurations(
        @Query("class_id") classId: Int? = null,
        @Query("academic_year_id") academicYearId: Int? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<ClassFeeConfigurationsResponseDto>

    @POST("api/school/class-fee-configurations")
    suspend fun saveClassFeeConfiguration(
        @Body request: SaveClassFeeConfigurationRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @POST("api/school/fee-payments")
    suspend fun createFeePayment(
        @Body request: CreateFeePaymentRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<FeePaymentResponseDto>

    @GET("api/school/collection-history")
    suspend fun getCollectionHistory(
        @Query("month") month: String? = null,
        @Query("search") search: String? = null,
        @Query("page") page: Int? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<CollectionHistoryResponseDto>

    @GET("api/school/fee-follow-ups")
    suspend fun getFeeFollowUps(
        @Query("status") status: String? = null,
        @Query("page") page: Int? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<FeeFollowUpsResponseDto>

    @GET("api/school/fee-follow-ups/{id}")
    suspend fun getFeeFollowUpDetails(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<FeeFollowUpDetailsResponseDto>

    @PUT("api/school/fee-follow-ups/{id}/extend")
    suspend fun extendFeeFollowUp(
        @Path("id") id: Int,
        @Body request: ExtendFollowUpRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @PUT("api/school/fee-follow-ups/{id}/status")
    suspend fun updateFeeFollowUpStatus(
        @Path("id") id: Int,
        @Body request: UpdateFollowUpStatusRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @POST("api/school/fee-follow-ups/{id}/notes")
    suspend fun addFollowUpNote(
        @Path("id") id: Int,
        @Body request: AddFollowUpNoteRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @POST("api/school/fee-follow-ups/{id}/contacted")
    suspend fun markFollowUpContacted(
        @Path("id") id: Int,
        @Body request: MarkFollowUpContactedRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @GET("api/school/staff-payments")
    suspend fun getStaffPayments(
        @Query("month") month: String,
        @Header("Authorization") authHeader: String? = null
    ): Response<StaffPaymentsResponseDto>

    @POST("api/school/staff-payments")
    suspend fun payStaffSalary(
        @Body request: PayStaffSalaryRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<PayStaffSalaryResponseDto>

    @GET("api/school/financial-reports")
    suspend fun getFinancialReports(
        @Header("Authorization") authHeader: String? = null
    ): Response<FinancialReportsResponseDto>

    @POST("api/school/financial-reports")
    suspend fun createFinancialReport(
        @Body request: CreateFinancialReportRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<FinancialReportResponseDto>

    @PUT("api/school/financial-reports/{id}/settle")
    suspend fun updateFinancialReportStatus(
        @Path("id") id: Int,
        @Body request: UpdateFinancialReportStatusRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // --- Security ---
    @GET("api/school/security/audit-logs")
    suspend fun getSchoolAuditLogs(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Query("date_filter") dateFilter: String? = null,
        @Query("from_date") fromDate: String? = null,
        @Query("to_date") toDate: String? = null,
        @Query("module") module: String? = null,
        @Query("search") search: String? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<AuditLogsResponseDto>

    @GET("api/school/security/login-history")
    suspend fun getSchoolLoginHistory(
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<LoginHistoryResponseDto>

    // --- School Profile ---
    @GET("api/school/profile")
    suspend fun getSchoolProfile(
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    @POST("api/school/profile")
    suspend fun updateSchoolProfile(
        @Body request: UpdateSchoolProfileRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    @Multipart
    @POST("api/school/profile/logo")
    suspend fun uploadSchoolLogo(
        @Part file: MultipartBody.Part,
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    @DELETE("api/school/profile/logo")
    suspend fun removeSchoolLogo(
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    @Multipart
    @POST("api/school/profile/signature")
    suspend fun uploadPrincipalSignature(
        @Part file: MultipartBody.Part,
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    @DELETE("api/school/profile/signature")
    suspend fun removePrincipalSignature(
        @Header("Authorization") authHeader: String? = null
    ): Response<SchoolProfileResponseDto>

    // --- Academic Setup: Academic Years ---
    @GET("api/school/academic-years")
    suspend fun getAcademicYears(
        @Header("Authorization") authHeader: String? = null
    ): Response<AcademicYearsResponseDto>

    @POST("api/school/academic-years")
    suspend fun createAcademicYear(
        @Body request: CreateAcademicYearRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<CreateAcademicYearResponseDto>

    @POST("api/school/academic-years/{id}/activate")
    suspend fun activateAcademicYear(
        @Path("id") id: Int,
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @POST("api/school/academic-years/{id}/migrate")
    suspend fun migrateAcademicYear(
        @Path("id") id: Int,
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // --- Academic Setup: Holidays ---
    @GET("api/school/holidays")
    suspend fun getHolidays(
        @Header("Authorization") authHeader: String? = null
    ): Response<HolidaysResponseDto>

    @POST("api/school/holidays")
    suspend fun createHoliday(
        @Body request: HolidayRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<HolidayResponseDto>

    @PUT("api/school/holidays/{id}")
    suspend fun updateHoliday(
        @Path("id") id: Int,
        @Body request: HolidayRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<HolidayResponseDto>

    @DELETE("api/school/holidays/{id}")
    suspend fun deleteHoliday(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // --- Academic Setup: Subjects ---
    @GET("api/school/subjects")
    suspend fun getSubjects(
        @Header("Authorization") authHeader: String? = null
    ): Response<SubjectsResponseDto>

    @POST("api/school/subjects")
    suspend fun createSubject(
        @Body request: SubjectRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @PUT("api/school/subjects/{id}")
    suspend fun updateSubject(
        @Path("id") id: Int,
        @Body request: SubjectRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @DELETE("api/school/subjects/{id}")
    suspend fun deleteSubject(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    // --- Academic Setup: Grade Configurations (view-only in native for now) ---
    @GET("api/school/grade-configurations")
    suspend fun getGradeConfigurations(
        @Header("Authorization") authHeader: String? = null
    ): Response<GradeConfigsResponseDto>

    // --- Credentials ---
    @GET("api/school/credentials/{role}/{id}")
    suspend fun getCredentials(
        @Path("role") role: String,
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<CredentialsResponseDto>

    @POST("api/school/credentials/generate")
    suspend fun generateCredentials(
        @Body request: GenerateCredentialsRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<GenerateCredentialsResponseDto>

    // --- Achievements (SchoolAdminService::getAchievements/getAchievementReportCard) ---
    @GET("api/school/achievements")
    suspend fun getAchievements(
        @Query("academic_year_id") academicYearId: Int? = null,
        @Query("category") category: String? = null,
        @Query("class_id") classId: Int? = null,
        @Query("level") level: String? = null,
        @Query("search") search: String? = null,
        @Query("sort") sort: String? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<AchievementsResponseDto>

    @GET("api/school/achievements/{id}/report-card")
    suspend fun getAchievementReportCard(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<AchievementReportCardResponseDto>

    // --- Vocabulary / Word Builder game (VocabularyService.php / StudentService::claimDailyLogin) ---
    @GET("api/student/vocabulary/achievements")
    suspend fun getVocabAchievements(
        @Header("Authorization") authHeader: String? = null
    ): Response<VocabAchievementsResponseDto>

    @GET("api/student/vocabulary/challenge/daily")
    suspend fun getDailyChallenge(
        @Header("Authorization") authHeader: String? = null
    ): Response<VocabChallengeResponseDto>

    @POST("api/student/vocabulary/challenge/daily")
    suspend fun submitDailyChallenge(
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<ChallengeSubmitResponseDto>

    @GET("api/student/vocabulary/challenge/weekly")
    suspend fun getWeeklyChallenge(
        @Header("Authorization") authHeader: String? = null
    ): Response<VocabChallengeResponseDto>

    @POST("api/student/vocabulary/challenge/weekly")
    suspend fun submitWeeklyChallenge(
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<ChallengeSubmitResponseDto>

    @GET("api/student/vocabulary/leaderboard")
    suspend fun getVocabLeaderboard(
        @Header("Authorization") authHeader: String? = null
    ): Response<VocabLeaderboardResponseDto>

    @GET("api/student/game/word-builder/progress")
    suspend fun getWordBuilderProgress(
        @Header("Authorization") authHeader: String? = null
    ): Response<GameProgressResponseDto>

    @POST("api/student/game/word-builder/progress")
    suspend fun syncWordBuilderProgress(
        @Body request: SyncGameProgressRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<GameProgressResponseDto>

    @POST("api/student/game/word-builder/claim-daily")
    suspend fun claimDailyLogin(
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<ClaimDailyResponseDto>

    // --- Teacher / Parent read-only vocabulary reports ---
    @GET("api/teacher/vocabulary/report")
    suspend fun getTeacherVocabularyReport(
        @Query("class_id") classId: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<TeacherVocabReportResponseDto>

    @GET("api/parent/vocabulary/report")
    suspend fun getParentVocabularyReport(
        @Query("student_id") studentId: Int? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<ParentVocabReportResponseDto>

    // --- Notification catalog + device registration (Shared/Notifications/*) ---
    @GET("api/notifications/catalog")
    suspend fun getNotificationCatalog(
        @Header("Authorization") authHeader: String? = null
    ): Response<NotificationCatalogResponseDto>

    @POST("api/notifications/device")
    suspend fun registerDevice(
        @Body request: DeviceRegisterRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<DeviceRegisterResponseDto>

    @HTTP(method = "DELETE", path = "api/notifications/device", hasBody = true)
    suspend fun unregisterDevice(
        @Body request: DeviceUnregisterRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<DeviceUnregisterResponseDto>

    @POST("api/notifications/test-push")
    suspend fun testPush(
        @Body request: Map<String, String> = emptyMap(),
        @Header("Authorization") authHeader: String? = null
    ): Response<TestPushResponseDto>

    // --- Transport Fees ---
    @GET("api/school/transport-fees")
    suspend fun getTransportFees(
        @Query("status") status: String? = null,
        @Header("Authorization") authHeader: String? = null
    ): Response<TransportFeesResponseDto>

    @POST("api/school/transport-fees")
    suspend fun assignTransportFee(
        @Body request: AssignTransportFeeRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @PUT("api/school/transport-fees/{id}")
    suspend fun updateTransportFee(
        @Path("id") id: Int,
        @Body request: UpdateTransportFeeRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @DELETE("api/school/transport-fees/{id}")
    suspend fun deleteTransportFee(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>

    @PUT("api/school/transport-fees/{id}/status")
    suspend fun toggleTransportFeeStatus(
        @Path("id") id: Int,
        @Body request: ToggleTransportFeeStatusRequestDto,
        @Header("Authorization") authHeader: String? = null
    ): Response<JsonElement>
}
