<?php

declare(strict_types=1);

namespace App\Routes;

use Slim\App;
use App\Domain\Auth\Controllers\AuthController;
use App\Domain\Platform\Controllers\PlatformController;
use App\Domain\SchoolAdmin\Controllers\SchoolAdminController;
use App\Domain\Teacher\Controllers\TeacherController;
use App\Domain\Student\Controllers\StudentController;
use App\Domain\SchoolAdmin\Controllers\LeaveRequestController;

return function (App $app) {
    // Auth Domain
    $app->post('/api/auth/identify', [AuthController::class, 'identify']);
    $app->post('/api/auth/login', [AuthController::class, 'login']);
    $app->post('/api/auth/change-password', [AuthController::class, 'changePassword']);
    $app->get('/api/auth/profile', [AuthController::class, 'getProfile']);
    
    // Platform / Super Admin Domain
    $app->get('/api/platform/schools', [PlatformController::class, 'getSchools']);
    $app->post('/api/platform/schools', [PlatformController::class, 'createSchool']);
    $app->post('/api/platform/invitations', [PlatformController::class, 'inviteSchool']);
    $app->put('/api/platform/schools/{id}', [PlatformController::class, 'updateSchool']);
    $app->get('/api/platform/schools/{id}/credentials', [PlatformController::class, 'getSchoolCredentials']);
    $app->put('/api/platform/schools/{id}/credentials', [PlatformController::class, 'updateSchoolCredentials']);
    $app->delete('/api/platform/schools/{id}', [PlatformController::class, 'deleteSchool']);
    $app->get('/api/platform/plans', [PlatformController::class, 'getPlans']);
    $app->post('/api/platform/plans', [PlatformController::class, 'createPlan']);
    $app->put('/api/platform/plans/{id}', [PlatformController::class, 'updatePlan']);
    $app->get('/api/platform/subscriptions', [PlatformController::class, 'getSubscriptions']);
    $app->get('/api/platform/subscription/audit-logs', [PlatformController::class, 'getAuditLogs']);
    $app->get('/api/platform/stats', [PlatformController::class, 'getStats']);
    $app->get('/api/platform/growth-chart', [PlatformController::class, 'getGrowthChart']);
    $app->get('/api/platform/schools/{id}/stats', [PlatformController::class, 'getSchoolStats']);
    $app->delete('/api/platform/plans/{id}', [PlatformController::class, 'deletePlan']);
    $app->get('/api/platform/schools/{id}/teachers', [PlatformController::class, 'getSchoolTeachers']);
    $app->get('/api/platform/schools/{id}/students', [PlatformController::class, 'getSchoolStudents']);
    $app->get('/api/platform/schools/{id}/subscriptions', [PlatformController::class, 'getSchoolSubscriptions']);
    $app->get('/api/platform/schools/{id}/academic-years', [PlatformController::class, 'getSchoolAcademicYears']);
    $app->get('/api/platform/schools/{id}/classes', [PlatformController::class, 'getSchoolClasses']);
    $app->get('/api/platform/admins', [PlatformController::class, 'getAdmins']);
    $app->post('/api/platform/admins', [PlatformController::class, 'createAdmin']);

    // School Admin Domain
    $app->get('/api/school/stats', [SchoolAdminController::class, 'getDashboardStats']);
    $app->get('/api/school/students', [SchoolAdminController::class, 'getStudents']);
    $app->get('/api/school/students/check-sr-no', [SchoolAdminController::class, 'checkSrNo']);
    $app->get('/api/school/students/{id}', [SchoolAdminController::class, 'getStudentById']);
    $app->post('/api/school/students', [SchoolAdminController::class, 'createStudent']);
    $app->put('/api/school/students/{id}', [SchoolAdminController::class, 'updateStudent']);
    $app->post('/api/school/students/{id}/advance', [SchoolAdminController::class, 'advanceStudent']);
    $app->post('/api/school/upload', [SchoolAdminController::class, 'uploadDocument']);
    $app->get('/api/school/staff', [SchoolAdminController::class, 'getStaff']);
    $app->post('/api/school/staff', [SchoolAdminController::class, 'createStaff']);
    $app->put('/api/school/staff/{id}', [SchoolAdminController::class, 'updateStaff']);
    $app->get('/api/school/staff/{id}', [SchoolAdminController::class, 'getStaffDetails']);
    $app->get('/api/school/staff-payments', [SchoolAdminController::class, 'getStaffPayments']);
    $app->post('/api/school/staff-payments', [SchoolAdminController::class, 'payStaffSalary']);
    $app->post('/api/school/staff-payments/disburse-previous-year', [SchoolAdminController::class, 'disbursePreviousYearStaffSalary']);
    $app->delete('/api/school/staff-payments/{id}', [SchoolAdminController::class, 'revertStaffSalary']);
    $app->get('/api/school/financial-reports/preview', [SchoolAdminController::class, 'getFinancialPreview']);
    $app->get('/api/school/financial-reports', [SchoolAdminController::class, 'getFinancialReports']);
    $app->post('/api/school/financial-reports', [SchoolAdminController::class, 'createFinancialReport']);
    $app->put('/api/school/financial-reports/{id}/settle', [SchoolAdminController::class, 'updateFinancialReportStatus']);
    $app->post('/api/school/financial-reports/{id}/settlement-request', [SchoolAdminController::class, 'submitSettlementRequest']);
    $app->get('/api/school/financial-reports/{id}/export', [SchoolAdminController::class, 'exportFinancialReport']);
    $app->get('/api/public/financial-reports/{id}/settlement/approve', [SchoolAdminController::class, 'ownerApproveSettlement']);
    $app->get('/api/public/financial-reports/{id}/settlement/reject', [SchoolAdminController::class, 'ownerRejectSettlement']);
    $app->get('/api/school/expenses', [SchoolAdminController::class, 'getSchoolExpenses']);
    $app->post('/api/school/expenses', [SchoolAdminController::class, 'createSchoolExpense']);
    $app->put('/api/school/expenses/{id}', [SchoolAdminController::class, 'updateSchoolExpense']);
    $app->delete('/api/school/expenses/{id}', [SchoolAdminController::class, 'deleteSchoolExpense']);
    $app->get('/api/school/additional-fees/types', [SchoolAdminController::class, 'getAdditionalFeeTypes']);
    $app->post('/api/school/additional-fees/types', [SchoolAdminController::class, 'createAdditionalFeeType']);
    $app->put('/api/school/additional-fees/types/{id}', [SchoolAdminController::class, 'updateAdditionalFeeType']);
    $app->delete('/api/school/additional-fees/types/{id}', [SchoolAdminController::class, 'deleteAdditionalFeeType']);
    $app->get('/api/school/additional-fees/payments', [SchoolAdminController::class, 'getAdditionalFeePayments']);
    $app->post('/api/school/additional-fees/payments/{id}/pay', [SchoolAdminController::class, 'collectAdditionalFeePayment']);
    $app->post('/api/school/additional-fees/payments/{id}/revert', [SchoolAdminController::class, 'revertAdditionalFeePayment']);

    // Late Payment Penalty Management
    $app->get('/api/school/late-payment-penalty/stats', [SchoolAdminController::class, 'getLatePaymentPenaltyStats']);
    $app->get('/api/school/late-payment-penalty/config', [SchoolAdminController::class, 'getLatePaymentPenaltyConfig']);
    $app->post('/api/school/late-payment-penalty/config', [SchoolAdminController::class, 'saveLatePaymentPenaltyConfig']);
    $app->delete('/api/school/late-payment-penalty/config', [SchoolAdminController::class, 'deleteLatePaymentPenaltyConfig']);
    $app->get('/api/school/late-payment-penalty/config/check', [SchoolAdminController::class, 'checkLatePaymentPenaltyConfig']);
    $app->get('/api/school/late-payment-penalty/history', [SchoolAdminController::class, 'getLatePaymentPenaltyHistory']);

    // School Finance Settings Management
    $app->get('/api/school/finance-settings', [SchoolAdminController::class, 'getFinanceSettings']);
    $app->post('/api/school/finance-settings', [SchoolAdminController::class, 'saveFinanceSettings']);

    // Transport Fees Management
    $app->get('/api/school/transport-fees', [SchoolAdminController::class, 'getTransportFees']);
    $app->post('/api/school/transport-fees', [SchoolAdminController::class, 'assignTransportFee']);
    $app->put('/api/school/transport-fees/{id}', [SchoolAdminController::class, 'updateTransportFee']);
    $app->delete('/api/school/transport-fees/{id}', [SchoolAdminController::class, 'deleteTransportFee']);
    $app->post('/api/school/transport-fees/{id}/toggle-status', [SchoolAdminController::class, 'toggleTransportFeeStatus']);
    $app->get('/api/school/classes', [SchoolAdminController::class, 'getClasses']);
    $app->post('/api/school/classes', [SchoolAdminController::class, 'createClass']);
    $app->put('/api/school/classes', [SchoolAdminController::class, 'updateClass']);
    $app->get('/api/school/classes/{class_id}/next-roll-no', [SchoolAdminController::class, 'getNextRollNo']);
    $app->get('/api/school/academic-years', [SchoolAdminController::class, 'getAcademicYears']);
    $app->post('/api/school/academic-years', [SchoolAdminController::class, 'createAcademicYear']);
    $app->post('/api/school/academic-years/{id}/activate', [SchoolAdminController::class, 'activateAcademicYear']);
    $app->post('/api/school/academic-years/{id}/migrate', [SchoolAdminController::class, 'migrateAcademicYear']);
    $app->get('/api/school/attendance', [SchoolAdminController::class, 'getAttendance']);
    $app->post('/api/school/attendance', [SchoolAdminController::class, 'markAttendance']);
    $app->get('/api/school/attendance/leaderboard', [SchoolAdminController::class, 'getAttendanceLeaderboard']);
    $app->get('/api/school/holidays', [SchoolAdminController::class, 'getHolidays']);
    $app->post('/api/school/holidays', [SchoolAdminController::class, 'createHoliday']);
    $app->put('/api/school/holidays/{id}', [SchoolAdminController::class, 'updateHoliday']);
    $app->delete('/api/school/holidays/{id}', [SchoolAdminController::class, 'deleteHoliday']);
    $app->get('/api/school/exams', [SchoolAdminController::class, 'getExams']);
    $app->post('/api/school/exams', [SchoolAdminController::class, 'createExam']);
    $app->get('/api/school/exam-marks', [SchoolAdminController::class, 'getExamMarks']);
    $app->post('/api/school/exam-marks', [SchoolAdminController::class, 'enterMarks']);

    // New Exams System
    $app->get('/api/school/exams-new', [SchoolAdminController::class, 'getExaminations']);
    $app->post('/api/school/exams-new', [SchoolAdminController::class, 'createExamination']);
    $app->get('/api/school/exams-new/{id}', [SchoolAdminController::class, 'getExaminationDetails']);
    $app->put('/api/school/exams-new/{id}', [SchoolAdminController::class, 'updateExamination']);
    $app->delete('/api/school/exams-new/{id}', [SchoolAdminController::class, 'deleteExamination']);
    $app->get('/api/school/exams-new/{id}/timetable', [SchoolAdminController::class, 'getExamTimetable']);
    $app->post('/api/school/exams-new/{id}/timetable', [SchoolAdminController::class, 'saveExamTimetable']);
    $app->get('/api/school/exams-new/{id}/marks', [SchoolAdminController::class, 'getExamMarksSheet']);
    $app->post('/api/school/exams-new/{id}/marks', [SchoolAdminController::class, 'saveExamMark']);
    $app->post('/api/school/exams-new/{id}/publish', [SchoolAdminController::class, 'publishExamResults']);
    $app->post('/api/school/exams-new/{id}/publish-scheme', [SchoolAdminController::class, 'publishExamScheme']);
    $app->post('/api/school/exams-new/{id}/unpublish-scheme', [SchoolAdminController::class, 'unpublishExamScheme']);
    $app->post('/api/school/exams-new/{id}/publish-admit-card', [SchoolAdminController::class, 'publishExamAdmitCards']);
    $app->post('/api/school/exams-new/{id}/unpublish-admit-card', [SchoolAdminController::class, 'unpublishExamAdmitCards']);
    $app->get('/api/school/exams-new/{id}/report-cards', [SchoolAdminController::class, 'getReportCards']);
    $app->get('/api/school/exams-new/{id}/class-status', [SchoolAdminController::class, 'getExamClassStatuses']);
    $app->get('/api/school/exams-new/{id}/instructions', [SchoolAdminController::class, 'getExamInstructions']);
    $app->post('/api/school/exams-new/{id}/instructions', [SchoolAdminController::class, 'saveExamInstructions']);
    $app->get('/api/school/exams-new/{id}/seating-plan', [SchoolAdminController::class, 'getSeatingPlan']);
    $app->post('/api/school/exams-new/{id}/seating-plan/preview', [SchoolAdminController::class, 'previewSeatingPlan']);
    $app->post('/api/school/exams-new/{id}/seating-plan', [SchoolAdminController::class, 'generateSeatingPlan']);
    $app->delete('/api/school/exams-new/{id}/seating-plan', [SchoolAdminController::class, 'deleteSeatingPlan']);
    
    // Grade configurations
    $app->get('/api/school/grade-configurations', [SchoolAdminController::class, 'getGradeConfigurations']);
    $app->post('/api/school/grade-configurations', [SchoolAdminController::class, 'saveGradeConfigurations']);
    $app->get('/api/school/fee-structures', [SchoolAdminController::class, 'getFeeStructures']);
    $app->post('/api/school/fee-structures', [SchoolAdminController::class, 'createFeeStructure']);
    $app->get('/api/school/fee-payments', [SchoolAdminController::class, 'getFeePayments']);
    $app->get('/api/school/collection-history', [SchoolAdminController::class, 'getCollectionHistory']);
    $app->post('/api/school/fee-payments', [SchoolAdminController::class, 'createFeePayment']);
    $app->delete('/api/school/fee-payments/{id}', [SchoolAdminController::class, 'deleteFeePayment']);

    $app->get('/api/school/class-fee-configurations', [SchoolAdminController::class, 'getClassFeeConfigurations']);
    $app->post('/api/school/class-fee-configurations', [SchoolAdminController::class, 'saveClassFeeConfiguration']);
    $app->post('/api/school/class-fee-configurations/lock', [SchoolAdminController::class, 'lockClassFeeConfiguration']);

    // Fee Follow-up System
    $app->get('/api/school/fee-follow-ups', [SchoolAdminController::class, 'getFeeFollowUps']);
    $app->post('/api/school/fee-follow-ups', [SchoolAdminController::class, 'createFeeFollowUp']);
    $app->get('/api/school/fee-follow-ups/{id}', [SchoolAdminController::class, 'getFeeFollowUpDetails']);
    $app->put('/api/school/fee-follow-ups/{id}', [SchoolAdminController::class, 'updateFeeFollowUp']);
    $app->delete('/api/school/fee-follow-ups/{id}', [SchoolAdminController::class, 'deleteFeeFollowUp']);
    $app->put('/api/school/fee-follow-ups/{id}/extend', [SchoolAdminController::class, 'extendFeeFollowUp']);
    $app->put('/api/school/fee-follow-ups/{id}/status', [SchoolAdminController::class, 'updateFeeFollowUpStatus']);
    $app->post('/api/school/fee-follow-ups/{id}/notes', [SchoolAdminController::class, 'addFollowUpNote']);
    $app->post('/api/school/fee-follow-ups/{id}/contacted', [SchoolAdminController::class, 'markFollowUpContacted']);
    $app->get('/api/school/students/{id}/outstanding-fee', [SchoolAdminController::class, 'getStudentOutstandingFee']);
    $app->get('/api/school/students/{id}/follow-ups', [SchoolAdminController::class, 'getStudentFollowUps']);
    
    // Persisted Dashboard Notifications
    $app->get('/api/school/notifications', [SchoolAdminController::class, 'getNotifications']);
    $app->post('/api/school/notifications/{id}/read', [SchoolAdminController::class, 'markNotificationRead']);

    // Announcements Domain
    $app->get('/api/school/announcements', [SchoolAdminController::class, 'getAnnouncements']);
    $app->post('/api/school/announcements', [SchoolAdminController::class, 'createAnnouncement']);
    $app->put('/api/school/announcements/{id}', [SchoolAdminController::class, 'updateAnnouncement']);
    $app->delete('/api/school/announcements/{id}', [SchoolAdminController::class, 'deleteAnnouncement']);

    // Leave Requests System
    $app->get('/api/school/leave-requests', [LeaveRequestController::class, 'getLeaveRequests']);
    $app->post('/api/school/leave-requests', [LeaveRequestController::class, 'applyLeaveRequest']);
    $app->put('/api/school/leave-requests/{id}/status', [LeaveRequestController::class, 'updateLeaveStatus']);
    $app->put('/api/school/leave-requests/{id}/cancel', [LeaveRequestController::class, 'cancelLeaveRequest']);
    $app->post('/api/school/leave-requests/upload', [LeaveRequestController::class, 'uploadAttachment']);
    $app->get('/api/parent/children', [LeaveRequestController::class, 'getChildren']);

    // Credentials management
    $app->get('/api/school/credentials/{role}/{id}', [SchoolAdminController::class, 'getCredentials']);
    $app->post('/api/school/credentials/generate', [SchoolAdminController::class, 'generateCredentials']);

    $app->get('/api/school/timetable', [SchoolAdminController::class, 'getTimetable']);
    $app->post('/api/school/timetable', [SchoolAdminController::class, 'addTimetablePeriod']);
    $app->delete('/api/school/timetable/{id}', [SchoolAdminController::class, 'deleteTimetablePeriod']);
    $app->post('/api/school/timetable/backup', [SchoolAdminController::class, 'assignBackupTeacher']);
    $app->post('/api/school/timetable/replace', [SchoolAdminController::class, 'replaceTeacher']);
    $app->post('/api/school/timetable/publish', [SchoolAdminController::class, 'publishTimetable']);
    $app->post('/api/school/timetable/paste', [SchoolAdminController::class, 'pasteTimetableSchedule']);

    $app->get('/api/school/subjects', [SchoolAdminController::class, 'getSubjects']);
    $app->post('/api/school/subjects', [SchoolAdminController::class, 'createSubject']);
    $app->put('/api/school/subjects/{id}', [SchoolAdminController::class, 'updateSubject']);
    $app->delete('/api/school/subjects/{id}', [SchoolAdminController::class, 'deleteSubject']);

    $app->get('/api/school/period-configurations', [SchoolAdminController::class, 'getPeriodConfigurations']);
    $app->get('/api/school/timetable-settings', [SchoolAdminController::class, 'getTimetableSettings']);
    $app->post('/api/school/timetable-settings', [SchoolAdminController::class, 'saveTimetableSettings']);

    $app->get('/api/school/profile', [SchoolAdminController::class, 'getSchoolProfile']);
    $app->post('/api/school/profile', [SchoolAdminController::class, 'updateSchoolProfile']);
    $app->post('/api/school/profile/logo', [SchoolAdminController::class, 'uploadSchoolLogo']);
    $app->delete('/api/school/profile/logo', [SchoolAdminController::class, 'removeSchoolLogo']);
    $app->get('/api/school/plans', [SchoolAdminController::class, 'getActivePlans']);
    $app->get('/api/school/subscriptions', [SchoolAdminController::class, 'getSubscriptionHistory']);

    // Menu Permissions & Class Assignments
    $app->get('/api/school/menu-permissions', [SchoolAdminController::class, 'getMenuPermissions']);
    $app->post('/api/school/menu-permissions', [SchoolAdminController::class, 'saveMenuPermissions']);
    $app->get('/api/school/class-teacher-assignments', [SchoolAdminController::class, 'getClassTeacherAssignments']);
    $app->post('/api/school/class-teacher-assignments', [SchoolAdminController::class, 'saveClassTeacherAssignments']);
    $app->get('/api/school/my-permissions', [SchoolAdminController::class, 'getMyPermissions']);

    // Security Domain
    $app->get('/api/school/security/audit-logs', [SchoolAdminController::class, 'getSchoolAuditLogs']);
    $app->post('/api/school/security/audit-logs/log', [SchoolAdminController::class, 'logClientAuditAction']);
    $app->get('/api/school/security/login-history', [SchoolAdminController::class, 'getSchoolLoginHistory']);

    // Teacher Domain
    $app->get('/api/teacher/dashboard', [TeacherController::class, 'getDashboard']);
    $app->get('/api/teacher/classes', [TeacherController::class, 'getMyClasses']);
    $app->get('/api/teacher/students', [TeacherController::class, 'getStudentList']);
    $app->post('/api/teacher/attendance', [TeacherController::class, 'markAttendance']);
    $app->get('/api/teacher/attendance', [TeacherController::class, 'getAttendanceHistory']);
    $app->get('/api/teacher/assignments', [TeacherController::class, 'getAssignments']);
    $app->post('/api/teacher/assignments', [TeacherController::class, 'createAssignment']);
    $app->get('/api/teacher/materials', [TeacherController::class, 'getMaterials']);
    $app->post('/api/teacher/materials', [TeacherController::class, 'createMaterial']);
    $app->get('/api/teacher/exams', [TeacherController::class, 'getExams']);
    $app->post('/api/teacher/marks', [TeacherController::class, 'enterMarks']);
    $app->get('/api/teacher/exams-new', [TeacherController::class, 'getExamsList']);
    $app->get('/api/teacher/exams-new/{id}/details', [TeacherController::class, 'getExamDetails']);
    $app->get('/api/teacher/schedule/today', [TeacherController::class, 'getTodaySchedule']);
    $app->get('/api/teacher/salaries', [TeacherController::class, 'getSalaries']);
    $app->get('/api/teacher/salaries/receipt', [TeacherController::class, 'getSalarySlip']);

    // Student / Parent Domain
    $app->get('/api/student/dashboard', [StudentController::class, 'getDashboard']);
    $app->get('/api/student/timetable', [StudentController::class, 'getTimetable']);
    $app->get('/api/student/attendance', [StudentController::class, 'getAttendance']);
    $app->get('/api/student/results', [StudentController::class, 'getExamResults']);
    $app->get('/api/student/exams-new', [StudentController::class, 'getExamsList']);
    $app->get('/api/student/exams-new/{id}/details', [StudentController::class, 'getExamDetails']);
    $app->get('/api/student/exams-new/report-cards', [StudentController::class, 'getPublishedReportCards']);
    $app->get('/api/student/assignments', [StudentController::class, 'getAssignments']);
    $app->get('/api/student/fees', [StudentController::class, 'getFees']);
    $app->get('/api/student/fee-payments', [StudentController::class, 'getFeePayments']);
    $app->get('/api/student/fees/card', [StudentController::class, 'getFeesCard']);
    $app->get('/api/student/fees/receipt', [StudentController::class, 'getFeeReceipt']);
    $app->get('/api/student/materials', [StudentController::class, 'getMaterials']);
    $app->get('/api/student/notifications', [StudentController::class, 'getNotifications']);
    $app->post('/api/student/notifications/read-all', [StudentController::class, 'markAllNotificationsRead']);
    $app->post('/api/student/notifications/{id}/read', [StudentController::class, 'markNotificationRead']);

    // Mobile Notices Domain
    $app->get('/api/student/announcements', [StudentController::class, 'getActiveNotices']);
    $app->post('/api/student/announcements/{id}/read', [StudentController::class, 'markNoticeRead']);
};
