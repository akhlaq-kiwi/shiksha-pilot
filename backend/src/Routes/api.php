<?php

use Slim\App;
use App\Domain\Auth\Controllers\AuthController;
use App\Domain\Platform\Controllers\PlatformController;
use App\Domain\Academic\Controllers\AcademicController;
use App\Domain\Timetable\Controllers\TimetableController;
use App\Domain\Attendance\Controllers\AttendanceController;
use App\Domain\Grading\Controllers\GradingController;
use App\Domain\Finance\Controllers\FinanceController;

return function (App $app) {
    // Phase 1: Auth routes migrated to Domain Controller
    $app->post('/api/auth/identify', [AuthController::class, 'identify']);
    $app->post('/api/auth/login', [AuthController::class, 'login']);
    $app->post('/api/auth/otp-login', [AuthController::class, 'otpLogin']);
    $app->get('/api/auth/hash-defaults', [AuthController::class, 'hashDefaults']);
    $app->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    $app->post('/api/auth/verify-otp', [AuthController::class, 'verifyOtp']);
    $app->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);
    $app->post('/api/auth/verify-password', [AuthController::class, 'verifyPassword']);

    // Phase 1: Platform & Tenant Domain routes
    $app->get('/api/platform/plans', [PlatformController::class, 'getPlans']);
    $app->post('/api/platform/plans', [PlatformController::class, 'createPlan']);
    $app->put('/api/platform/plans/{id}', [PlatformController::class, 'updatePlan']);
    $app->delete('/api/platform/plans/{id}', [PlatformController::class, 'deletePlan']);
    $app->get('/api/platform/subscriptions', [PlatformController::class, 'getSubscriptions']);
    $app->post('/api/platform/subscriptions/activate', [PlatformController::class, 'activateSubscription']);
    $app->get('/api/platform/subscription/audit-logs', [PlatformController::class, 'getAuditLogs']);
    $app->get('/api/platform/stats', [PlatformController::class, 'getStats']);
    $app->get('/api/platform/schools', [PlatformController::class, 'getSchools']);
    $app->post('/api/platform/invitations', [PlatformController::class, 'inviteSchool']);
    $app->put('/api/platform/schools/{id}', [PlatformController::class, 'updateSchool']);
    $app->post('/api/platform/schools/{id}/extend', [PlatformController::class, 'extendSubscription']);
    $app->delete('/api/platform/schools/{id}', [PlatformController::class, 'deleteSchool']);
    $app->get('/api/platform/schools/{id}/details', [PlatformController::class, 'getSchoolDetails']);
    $app->get('/api/platform/schools/{schoolId}/students/{studentId}/fees', [PlatformController::class, 'getStudentFees']);
    $app->get('/api/platform/schools/{schoolId}/teachers/{teacherId}/salary', [PlatformController::class, 'getTeacherSalary']);

    // Phase 2: Academic Domain routes
    $app->get('/api/academic-years', [AcademicController::class, 'getAcademicYears']);
    $app->post('/api/academic-years', [AcademicController::class, 'createAcademicYear']);
    $app->post('/api/academic-years/{id}/activate', [AcademicController::class, 'activateAcademicYear']);
    $app->put('/api/academic-years/{id}/archive', [AcademicController::class, 'archiveAcademicYear']);

    $app->get('/api/classes', [AcademicController::class, 'getClassrooms']);
    $app->post('/api/classes', [AcademicController::class, 'createClassroom']);
    $app->put('/api/classes/{id}', [AcademicController::class, 'updateClassroom']);
    $app->delete('/api/classes/{id}', [AcademicController::class, 'deleteClassroom']);
    $app->post('/api/class-teacher', [AcademicController::class, 'assignClassTeacher']);

    $app->get('/api/teachers', [AcademicController::class, 'getTeachers']);
    $app->post('/api/teachers', [AcademicController::class, 'createTeacher']);
    $app->put('/api/teachers/{id}', [AcademicController::class, 'updateTeacher']);
    $app->delete('/api/teachers/{id}', [AcademicController::class, 'deleteTeacher']);

    $app->get('/api/students', [AcademicController::class, 'getStudents']);
    $app->post('/api/students', [AcademicController::class, 'createStudent']);
    $app->put('/api/students/{id}', [AcademicController::class, 'updateStudent']);
    $app->delete('/api/students/{id}', [AcademicController::class, 'deleteStudent']);

    // Phase 3: Timetable Domain routes
    $app->get('/api/subjects', [TimetableController::class, 'getSubjects']);
    $app->post('/api/subjects', [TimetableController::class, 'createSubject']);
    $app->put('/api/subjects/{id}', [TimetableController::class, 'updateSubject']);
    $app->delete('/api/subjects/{id}', [TimetableController::class, 'deleteSubject']);

    $app->get('/api/schedules', [TimetableController::class, 'getSchedules']);
    $app->post('/api/schedules', [TimetableController::class, 'saveSchedule']);
    $app->put('/api/schedules/publish', [TimetableController::class, 'publishSchedule']);
    $app->get('/api/schedules/today', [TimetableController::class, 'getTodaySchedule']);
    $app->get('/api/schedules/weekly', [TimetableController::class, 'getWeeklySchedule']);
    $app->get('/api/schedules/all-weekly', [TimetableController::class, 'getAllWeeklySchedules']);
    $app->post('/api/schedules/trigger-notifications', [TimetableController::class, 'triggerNotifications']);
    $app->post('/api/schedules/whatsapp-reminders/init', [TimetableController::class, 'initWhatsAppReminders']);
    $app->post('/api/schedules/whatsapp-reminders/send-single', [TimetableController::class, 'sendSingleWhatsAppReminder']);
    $app->get('/api/schedules/whatsapp-reminders/history', [TimetableController::class, 'getWhatsAppLogs']);

    // Phase 4: Attendance Domain routes
    $app->get('/api/attendance', [AttendanceController::class, 'getAttendance']);
    $app->post('/api/attendance/bulk', [AttendanceController::class, 'saveBulkAttendance']);
    $app->get('/api/attendance/analytics/student/{student_id}', [AttendanceController::class, 'getStudentAttendanceAnalytics']);
    $app->get('/api/attendance/report/monthly', [AttendanceController::class, 'getMonthlyAttendanceReport']);

    // Phase 5: Grading Domain routes
    $app->get('/api/exams', [GradingController::class, 'getExams']);
    $app->post('/api/exams', [GradingController::class, 'createExam']);
    $app->delete('/api/exams/{id}', [GradingController::class, 'deleteExam']);
    $app->put('/api/exams/{id}', [GradingController::class, 'updateExam']);
    $app->get('/api/exams/{exam_id}/marks', [GradingController::class, 'getExamMarks']);
    $app->post('/api/exams/{exam_id}/marks', [GradingController::class, 'saveExamMarks']);
    $app->get('/api/school/signatures', [GradingController::class, 'getSchoolSignatures']);
    $app->post('/api/school/signatures', [GradingController::class, 'saveSchoolSignatures']);
    $app->get('/api/exams/{exam_id}/remarks', [GradingController::class, 'getExamRemarks']);
    $app->post('/api/exams/{exam_id}/remarks', [GradingController::class, 'saveExamRemarks']);
    $app->get('/api/school/grading-scales', [GradingController::class, 'getGradingScales']);
    $app->post('/api/school/grading-scales', [GradingController::class, 'saveGradingScales']);
    $app->get('/api/students/{id}/performance-summary', [GradingController::class, 'getStudentPerformanceSummary']);

    // Phase 6: Finance Domain routes
    $app->get('/api/class-fees', [FinanceController::class, 'getClassFees']);
    $app->post('/api/class-fees', [FinanceController::class, 'saveClassFees']);
    $app->get('/api/salaries/month/{month}', [FinanceController::class, 'getMonthlySalaries']);
    $app->get('/api/teachers/{id}/salary', [FinanceController::class, 'getTeacherSalaryLedger']);
    $app->post('/api/teachers/{id}/salary/{month}/pay', [FinanceController::class, 'payTeacherSalary']);
    $app->get('/api/students/{id}/fees', [FinanceController::class, 'getStudentFeesLedger']);
    $app->post('/api/students/{id}/fees/{month}/pay', [FinanceController::class, 'payTuitionFee']);
    $app->post('/api/students/{id}/fees/pay-multiple', [FinanceController::class, 'payMultipleFees']);
    $app->post('/api/students/{id}/fees/{month}/unpay', [FinanceController::class, 'revertTuitionFee']);
    $app->get('/api/students/{id}/carry-forward-dues', [FinanceController::class, 'getStudentCarryForwardDues']);
    $app->post('/api/students/{id}/carry-forward-dues/{due_id}/pay', [FinanceController::class, 'payCarryForwardDue']);
    $app->post('/api/students/{id}/carry-forward-dues/recoveries/{recovery_id}/unpay', [FinanceController::class, 'revertCarryForwardDueRecovery']);
    $app->get('/api/finance/previous-dues', [FinanceController::class, 'getFinancePreviousDues']);
    $app->get('/api/finance/previous-dues-recoveries', [FinanceController::class, 'getFinancePreviousDuesRecoveries']);
    $app->get('/api/financial-reports', [FinanceController::class, 'getFinancialReportsHistory']);
    $app->get('/api/financial-reports/preview', [FinanceController::class, 'previewFinancialReport']);
    $app->post('/api/financial-reports', [FinanceController::class, 'generateFinancialReport']);
    $app->post('/api/financial-reports/{id}/settle', [FinanceController::class, 'toggleReportSettlement']);
    $app->get('/api/financial-reports/{id}/export', [FinanceController::class, 'exportFinancialReport']);
    $app->get('/api/school-expenses', [FinanceController::class, 'getSchoolExpenses']);
    $app->post('/api/school-expenses', [FinanceController::class, 'addSchoolExpense']);
    $app->get('/api/extra-fee-types', [FinanceController::class, 'getExtraFeeTypes']);
    $app->post('/api/extra-fee-types', [FinanceController::class, 'addExtraFeeType']);
    $app->put('/api/extra-fee-types/{id}', [FinanceController::class, 'editExtraFeeType']);
    $app->get('/api/student-extra-fees', [FinanceController::class, 'getStudentExtraFees']);
    $app->post('/api/student-extra-fees/{id}/pay', [FinanceController::class, 'payExtraStudentFee']);
    $app->post('/api/student-extra-fees/{id}/unpay', [FinanceController::class, 'revertExtraStudentFee']);
    $app->get('/api/payment-promises', [FinanceController::class, 'getPaymentPromises']);
    $app->post('/api/payment-promises', [FinanceController::class, 'addPaymentPromise']);
    $app->put('/api/payment-promises/{id}', [FinanceController::class, 'editPaymentPromise']);
    $app->delete('/api/payment-promises/{id}', [FinanceController::class, 'deletePaymentPromise']);

    // Phase 7: Portals Domain routes
    $app->get('/api/teacher/dashboard', [\App\Domain\Portal\Controllers\PortalController::class, 'getTeacherDashboard']);
    $app->get('/api/parent/dashboard', [\App\Domain\Portal\Controllers\PortalController::class, 'getParentDashboard']);
    $app->get('/api/parent/student/{student_id}/summary', [\App\Domain\Portal\Controllers\PortalController::class, 'getParentStudentSummary']);
    $app->get('/api/parent/students', [\App\Domain\Portal\Controllers\PortalController::class, 'getParentStudents']);
    $app->get('/api/parent/student/{id}/dashboard', [\App\Domain\Portal\Controllers\PortalController::class, 'getParentStudentDashboard']);
};
