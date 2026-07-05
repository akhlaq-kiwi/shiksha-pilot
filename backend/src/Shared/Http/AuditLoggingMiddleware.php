<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Psr\Http\Message\ResponseInterface as Response;
use App\Shared\Auth\TokenService;
use App\Database\Connection;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;

class AuditLoggingMiddleware
{
    public function __construct(
        private readonly TokenService $tokenService,
        private readonly Connection $connection,
        private readonly SchoolAdminService $schoolAdminService
    ) {}

    public function __invoke(Request $request, Handler $handler): Response
    {
        $response = $handler->handle($request);

        // Only log successful operations (2xx)
        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            return $response;
        }

        $method = $request->getMethod();
        $path = $request->getUri()->getPath();

        // Decode user
        $user = $this->tokenService->fromRequest($request);
        if (!$user) {
            return $response;
        }

        // Get body request params
        $body = $request->getParsedBody();
        if (!is_array($body)) {
            $body = [];
        }

        $pdo = $this->connection->getPdo();

        $module = '';
        $action = '';
        $desc = '';

        if ($method === 'POST') {
            if ($path === '/api/school/students') {
                $module = 'Classes';
                $action = 'Student Added';
                $name = trim(($body['first_name'] ?? '') . ' ' . ($body['last_name'] ?? ''));
                $desc = "Student \"{$name}\" enrolled in Class " . ($body['class_name'] ?? '');
            } elseif ($path === '/api/school/staff') {
                $module = 'Teachers';
                $action = 'Teacher Added';
                $desc = "Teacher \"" . ($body['name'] ?? '') . "\" added to the staff list";
            } elseif ($path === '/api/school/classes') {
                $module = 'Classes';
                $action = 'Class Created';
                $desc = "Class \"" . ($body['name'] ?? '') . " " . ($body['section'] ?? '') . "\" created";
            } elseif ($path === '/api/school/timetable/backup') {
                $module = 'Teachers';
                $action = 'Backup Teacher Assigned';
                $desc = "Backup teacher assigned for timetable period";
            } elseif ($path === '/api/school/timetable/replace') {
                $module = 'Teachers';
                $action = 'Teacher Assigned';
                $desc = "Timetable period main teacher reassigned";
            } elseif ($path === '/api/school/timetable/publish') {
                $module = 'Timetable';
                $action = 'Timetable Published';
                $desc = "Timetable published for Class ID " . ($body['class_id'] ?? '');
            } elseif ($path === '/api/school/timetable') {
                $module = 'Timetable';
                $action = 'Subject Assigned';
                $desc = "Subject period added to timetable";
            } elseif ($path === '/api/school/attendance') {
                $module = 'Attendance';
                $action = 'Attendance Marked';
                $desc = "Attendance marked for date " . ($body['date'] ?? date('Y-m-d'));
            } elseif ($path === '/api/school/exams-new') {
                $module = 'Examinations';
                $action = 'Exam Created';
                $desc = "Exam \"" . ($body['name'] ?? '') . "\" created";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/timetable$#', $path)) {
                $module = 'Examinations';
                $action = 'Paper Added';
                $desc = "Examination papers scheduled/updated for timetable";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/marks$#', $path)) {
                $module = 'Examinations';
                $action = 'Marks Entered';
                $desc = "Examination marks entered/updated for subject ID " . ($body['subject_id'] ?? '');
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/publish$#', $path)) {
                $module = 'Examinations';
                $statusVal = $body['status'] ?? 'Published';
                $action = $statusVal === 'Draft' ? 'Result Unpublished' : 'Result Published';
                $desc = $statusVal === 'Draft' 
                    ? "Results unpublished for Class ID " . ($body['class_id'] ?? '')
                    : "Results published for Class ID " . ($body['class_id'] ?? '');
            } elseif (preg_match('#^/api/school/exams-new/(\d+)/instructions$#', $path)) {
                $module = 'Examinations';
                $action = 'Instructions Updated';
                $desc = "Examination timetable instructions updated";
            } elseif ($path === '/api/school/fee-payments') {
                $module = 'Fees Portal';
                $action = 'Fee Collected';
                $desc = "Fee collected from student";
            } elseif ($path === '/api/school/fee-structures') {
                $module = 'Fees Portal';
                $action = 'Fee Structure Created';
                $desc = "Fee structure \"" . ($body['name'] ?? '') . "\" created";
            } elseif ($path === '/api/school/financial-reports') {
                $module = 'Financial Reports';
                $action = 'Report Generated';
                $desc = "Financial report generated for " . ($body['from_date'] ?? '') . " – " . ($body['to_date'] ?? '');
            } elseif ($path === '/api/school/profile') {
                $module = 'Audits & Settings';
                $action = 'School Profile Updated';
                $desc = "School profile details updated for " . ($body['name'] ?? '');
            } elseif ($path === '/api/school/profile/logo') {
                $module = 'Audits & Settings';
                $action = 'School Logo Changed';
                $desc = "School logo uploaded/updated";
            } elseif ($path === '/api/school/academic-years') {
                $module = 'Academic Year Rollover';
                $action = 'Academic Year Created';
                $desc = "Academic Year session \"" . ($body['name'] ?? '') . "\" created";
            } elseif (preg_match('#^/api/school/academic-years/(\d+)/activate$#', $path)) {
                $module = 'Academic Year Rollover';
                $action = 'Academic Year Rollover Completed';
                $desc = "Academic Year rollover completed and activated";
            } elseif (preg_match('#^/api/school/academic-years/(\d+)/migrate$#', $path)) {
                $module = 'Academic Year Rollover';
                $action = 'Students Promoted';
                $desc = "Students promoted/migrated to new Academic Year";
            }
        } elseif ($method === 'PUT') {
            if (preg_match('#^/api/school/students/(\d+)$#', $path, $matches)) {
                $module = 'Classes';
                $action = 'Student Updated';
                $name = trim(($body['first_name'] ?? '') . ' ' . ($body['last_name'] ?? ''));
                $desc = "Student details updated for \"{$name}\" in Class " . ($body['class_name'] ?? '');
            } elseif (preg_match('#^/api/school/staff/(\d+)$#', $path, $matches)) {
                $module = 'Teachers';
                $action = 'Teacher Updated';
                $desc = "Teacher \"" . ($body['name'] ?? '') . "\" profile updated";
            } elseif ($path === '/api/school/classes') {
                $module = 'Classes';
                $action = 'Class Updated';
                $desc = "Class updated";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)$#', $path)) {
                $module = 'Examinations';
                $action = 'Exam Updated';
                $desc = "Exam \"" . ($body['name'] ?? '') . "\" updated";
            }
        } elseif ($method === 'DELETE') {
            if (preg_match('#^/api/school/timetable/(\d+)$#', $path)) {
                $module = 'Timetable';
                $action = 'Subject Removed';
                $desc = "Subject period removed from timetable";
            } elseif (preg_match('#^/api/school/exams-new/(\d+)$#', $path)) {
                $module = 'Examinations';
                $action = 'Exam Deleted';
                $desc = "Exam deleted";
            } elseif (preg_match('#^/api/school/fee-payments/(\d+)$#', $path)) {
                $module = 'Fees Portal';
                $action = 'Fee Refunded';
                $desc = "Fee payment transaction deleted/reverted";
            } elseif ($path === '/api/school/profile/logo') {
                $module = 'Audits & Settings';
                $action = 'School Logo Changed';
                $desc = "School logo removed";
            }
        }

        if ($module !== '' && $action !== '') {
            $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, (int)$user['school_id']);
            $ayName = $workingYear ? $workingYear['name'] : null;
            $this->schoolAdminService->logAudit($pdo, $user, $module, $action, $desc, $ayName);
        }

        return $response;
    }
}
