<?php

declare(strict_types=1);

namespace App\Routes;

use Slim\App;
use App\Domain\Auth\Controllers\AuthController;
use App\Domain\Platform\Controllers\PlatformController;
use App\Domain\SchoolAdmin\Controllers\SchoolAdminController;
use App\Domain\Teacher\Controllers\TeacherController;
use App\Domain\Student\Controllers\StudentController;

return function (App $app) {
    // Auth Domain
    $app->post('/api/auth/identify', [AuthController::class, 'identify']);
    $app->post('/api/auth/login', [AuthController::class, 'login']);
    
    // Platform / Super Admin Domain
    $app->get('/api/platform/schools', [PlatformController::class, 'getSchools']);
    $app->post('/api/platform/schools', [PlatformController::class, 'createSchool']);
    $app->post('/api/platform/invitations', [PlatformController::class, 'inviteSchool']);
    $app->put('/api/platform/schools/{id}', [PlatformController::class, 'updateSchool']);
    $app->delete('/api/platform/schools/{id}', [PlatformController::class, 'deleteSchool']);
    $app->get('/api/platform/plans', [PlatformController::class, 'getPlans']);
    $app->get('/api/platform/subscriptions', [PlatformController::class, 'getSubscriptions']);
    $app->get('/api/platform/subscription/audit-logs', [PlatformController::class, 'getAuditLogs']);
    $app->get('/api/platform/stats', [PlatformController::class, 'getStats']);

    // School Admin Domain
    $app->get('/api/school/stats', [SchoolAdminController::class, 'getDashboardStats']);
    $app->get('/api/school/students', [SchoolAdminController::class, 'getStudents']);
    $app->post('/api/school/students', [SchoolAdminController::class, 'createStudent']);
    $app->get('/api/school/staff', [SchoolAdminController::class, 'getStaff']);
    $app->post('/api/school/staff', [SchoolAdminController::class, 'createStaff']);
    $app->get('/api/school/classes', [SchoolAdminController::class, 'getClasses']);
    $app->post('/api/school/classes', [SchoolAdminController::class, 'createClass']);
    $app->get('/api/school/academic-years', [SchoolAdminController::class, 'getAcademicYears']);
    $app->get('/api/school/attendance', [SchoolAdminController::class, 'getAttendance']);
    $app->post('/api/school/attendance', [SchoolAdminController::class, 'markAttendance']);
    $app->get('/api/school/exams', [SchoolAdminController::class, 'getExams']);
    $app->post('/api/school/exams', [SchoolAdminController::class, 'createExam']);
    $app->get('/api/school/exam-marks', [SchoolAdminController::class, 'getExamMarks']);
    $app->post('/api/school/exam-marks', [SchoolAdminController::class, 'enterMarks']);
    $app->get('/api/school/fee-structures', [SchoolAdminController::class, 'getFeeStructures']);
    $app->get('/api/school/fee-payments', [SchoolAdminController::class, 'getFeePayments']);
    $app->get('/api/school/timetable', [SchoolAdminController::class, 'getTimetable']);
    $app->get('/api/school/subjects', [SchoolAdminController::class, 'getSubjects']);

    // Teacher Domain
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
    $app->get('/api/teacher/schedule/today', [TeacherController::class, 'getTodaySchedule']);

    // Student / Parent Domain
    $app->get('/api/student/dashboard', [StudentController::class, 'getDashboard']);
    $app->get('/api/student/timetable', [StudentController::class, 'getTimetable']);
    $app->get('/api/student/attendance', [StudentController::class, 'getAttendance']);
    $app->get('/api/student/results', [StudentController::class, 'getExamResults']);
    $app->get('/api/student/assignments', [StudentController::class, 'getAssignments']);
    $app->get('/api/student/fees', [StudentController::class, 'getFees']);
    $app->get('/api/student/fee-payments', [StudentController::class, 'getFeePayments']);
    $app->get('/api/student/materials', [StudentController::class, 'getMaterials']);
};
