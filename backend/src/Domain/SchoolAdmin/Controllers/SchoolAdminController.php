<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Controllers;

use App\Domain\SchoolAdmin\Services\SchoolAdminService;
use App\Shared\BaseController;
use App\Shared\Auth\TokenService;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class SchoolAdminController extends BaseController
{
    public function __construct(
        TokenService $tokenService,
        private readonly SchoolAdminService $service,
    ) {
        parent::__construct($tokenService);
    }

    // -------------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------------

    public function getDashboardStats(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getDashboardStats($user);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    public function getStudents(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $filters = $request->getQueryParams();
        $data    = $this->service->getStudents($user, $filters);

        return $this->success($response, $data);
    }

    public function createStudent(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body    = RequestParser::body($request);
        $student = $this->service->createStudent($user, $body);

        return $this->success($response, $student, 'Student created', 201);
    }

    public function getStudentById(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $student = $this->service->getStudentById($user, $id);

        return $this->success($response, $student);
    }

    public function updateStudent(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $student = $this->service->updateStudent($user, $id, $body);

        return $this->success($response, $student, 'Student updated successfully');
    }

    public function uploadDocument(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No files uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->error($response, 'Failed to upload file', 400);
        }

        $url = $this->service->handleFileUpload($uploadedFile);

        return $this->success($response, ['url' => $url], 'File uploaded successfully');
    }

    // -------------------------------------------------------------------------
    // Staff
    // -------------------------------------------------------------------------

    public function getStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getStaff($user);

        return $this->success($response, $data);
    }

    public function createStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body   = RequestParser::body($request);
        $member = $this->service->createStaff($user, $body);

        return $this->success($response, $member, 'Staff member created', 201);
    }

    public function updateStaff(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id     = (int)$args['id'];
        $body   = RequestParser::body($request);
        $member = $this->service->updateStaff($user, $id, $body);

        return $this->success($response, $member, 'Staff member updated');
    }

    public function getStaffDetails(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $member = $this->service->getStaffDetails($user, $id);

        return $this->success($response, $member);
    }

    // -------------------------------------------------------------------------
    // Classes
    // -------------------------------------------------------------------------

    public function getClasses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getClasses($user);

        return $this->success($response, $data);
    }

    public function createClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body  = RequestParser::body($request);
        $class = $this->service->createClass($user, $body);

        return $this->success($response, $class, 'Class created', 201);
    }

    // -------------------------------------------------------------------------
    // Academic Years
    // -------------------------------------------------------------------------

    public function getAcademicYears(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getAcademicYears($user);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    public function getAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $filters = $request->getQueryParams();
        $data    = $this->service->getAttendance($user, $filters);

        return $this->success($response, $data);
    }

    public function markAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body   = RequestParser::body($request);
        $result = $this->service->markAttendance($user, $body);

        return $this->success($response, $result);
    }

    // -------------------------------------------------------------------------
    // Exams
    // -------------------------------------------------------------------------

    public function getExams(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getExams($user);

        return $this->success($response, $data);
    }

    public function createExam(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $exam = $this->service->createExam($user, $body);

        return $this->success($response, $exam, 'Exam created', 201);
    }

    public function getExamMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $filters = $request->getQueryParams();
        $data    = $this->service->getExamMarks($filters);

        return $this->success($response, $data);
    }

    public function enterMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body   = RequestParser::body($request);
        $result = $this->service->enterMarks($body);

        return $this->success($response, $result);
    }

    // -------------------------------------------------------------------------
    // Fees
    // -------------------------------------------------------------------------

    public function getFeeStructures(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getFeeStructures($user);

        return $this->success($response, $data);
    }

    public function getFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getFeePayments($user);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Timetable & Subjects
    // -------------------------------------------------------------------------

    public function getTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getTimetable($user);

        return $this->success($response, $data);
    }

    public function getSubjects(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getSubjects($user);

        return $this->success($response, $data);
    }

    public function createFeeStructure(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body      = RequestParser::body($request);
        $structure = $this->service->createFeeStructure($user, $body);

        return $this->success($response, $structure, 'Fee structure created', 201);
    }

    public function createFeePayment(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body    = RequestParser::body($request);
        $payment = $this->service->createFeePayment($user, $body);

        return $this->success($response, $payment, 'Fee payment recorded', 201);
    }

    public function getSchoolProfile(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getSchoolProfile($user);

        return $this->success($response, $data);
    }

    public function updateSchoolProfile(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body    = RequestParser::body($request);
        $profile = $this->service->updateSchoolProfile($user, $body);

        return $this->success($response, $profile, 'School profile updated');
    }

    public function uploadSchoolLogo(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No files uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->error($response, 'Failed to upload file', 400);
        }

        // Validate file size (max 5MB)
        if ($uploadedFile->getSize() > 5 * 1024 * 1024) {
            return $this->error($response, 'File size must be less than 5MB', 400);
        }

        // Validate file extension
        $filename = $uploadedFile->getClientFilename();
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg'])) {
            return $this->error($response, 'Only PNG, JPG, and JPEG files are accepted', 400);
        }

        $profile = $this->service->uploadSchoolLogo($user, $uploadedFile);

        return $this->success($response, $profile, 'School logo uploaded successfully');
    }

    public function removeSchoolLogo(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $profile = $this->service->removeSchoolLogo($user);

        return $this->success($response, $profile, 'School logo removed successfully');
    }

    public function updateClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body  = RequestParser::body($request);
        $class = $this->service->updateClass($user, $body);

        return $this->success($response, $class, 'Class updated');
    }

    public function deleteFeePayment(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $this->service->deleteFeePayment($user, $id);

        return $this->success($response, null, 'Payment reverted successfully');
    }

    public function createAcademicYear(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createAcademicYear($user, $body);

        return $this->success($response, $data, 'Academic year created', 201);
    }

    public function activateAcademicYear(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->activateAcademicYear($user, $id, $body);

        return $this->success($response, $data, 'Academic year activated');
    }

    public function migrateAcademicYear(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->migrateAcademicYear($user, $id, $body);

        return $this->success($response, $data, 'Academic year rollover migration executed');
    }

    public function getClassFeeConfigurations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) && $params['class_id'] !== '' ? (int)$params['class_id'] : null;
        $academicYearId = isset($params['academic_year_id']) && $params['academic_year_id'] !== '' ? (int)$params['academic_year_id'] : null;

        $data = $this->service->getClassFeeConfigurations($user, $classId, $academicYearId);

        return $this->success($response, $data);
    }

    public function saveClassFeeConfiguration(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->saveClassFeeConfiguration($user, $body);

        return $this->success($response, $data, 'Class fee configuration saved');
    }

    public function lockClassFeeConfiguration(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->lockClassFeeConfiguration($user, $body);

        return $this->success($response, $data, 'Class fee configuration locked successfully');
    }

    public function getNextRollNo(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $classId = (int)($args['class_id'] ?? 0);
        $data = $this->service->getNextRollNo($user, $classId);

        return $this->success($response, $data);
    }

    public function getStaffPayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $month = $params['month'] ?? '';
        $data = $this->service->getStaffPayments($user, $month);

        return $this->success($response, $data);
    }

    public function payStaffSalary(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->payStaffSalary($user, $body);

        return $this->success($response, $data, 'Staff salary paid successfully', 201);
    }

    public function revertStaffSalary(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->revertStaffSalary($user, $id);

        return $this->success($response, $data, 'Staff salary payment reverted');
    }

    public function getFinancialPreview(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $from = $params['from_date'] ?? '';
        $to = $params['to_date'] ?? '';

        $data = $this->service->getFinancialPreview($user, $from, $to);

        return $this->success($response, $data);
    }

    public function getFinancialReports(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getFinancialReports($user);

        return $this->success($response, $data);
    }

    public function createFinancialReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createFinancialReport($user, $body);

        return $this->success($response, $data, 'Financial report generated successfully', 201);
    }

    public function updateFinancialReportStatus(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateFinancialReportStatus($user, $id, $body);

        return $this->success($response, $data, 'Financial report status updated');
    }

    public function submitSettlementRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->submitSettlementRequest($user, $id);

        return $this->success($response, $data, 'Settlement request submitted successfully');
    }

    public function ownerApproveSettlement(Request $request, Response $response, array $args): Response
    {
        $id = (int)$args['id'];
        $html = $this->service->ownerApproveSettlement($id);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html');
    }

    public function ownerRejectSettlement(Request $request, Response $response, array $args): Response
    {
        $id = (int)$args['id'];
        $html = $this->service->ownerRejectSettlement($id);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html');
    }

    public function getSchoolExpenses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $data = $this->service->getSchoolExpenses($user, $params);

        return $this->success($response, $data);
    }

    public function updateSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateSchoolExpense($user, $id, $body);

        return $this->success($response, $data, 'School expense updated successfully');
    }

    public function deleteSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->deleteSchoolExpense($user, $id);

        return $this->success($response, $data, 'School expense deleted successfully');
    }

    public function createSchoolExpense(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createSchoolExpense($user, $body);

        return $this->success($response, $data, 'School expense recorded successfully', 201);
    }

    public function getAdditionalFeeTypes(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getAdditionalFeeTypes($user);

        return $this->success($response, $data);
    }

    public function createAdditionalFeeType(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createAdditionalFeeType($user, $body);

        return $this->success($response, $data, 'Additional fee type created and assigned', 201);
    }

    public function updateAdditionalFeeType(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $data = $this->service->updateAdditionalFeeType($user, $id, $body);

        return $this->success($response, $data, 'Additional fee updated successfully');
    }

    public function deleteAdditionalFeeType(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->deleteAdditionalFeeType($user, $id);

        return $this->success($response, $data, 'Additional fee deleted successfully');
    }

    public function getAdditionalFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getAdditionalFeePayments($user);

        return $this->success($response, $data);
    }

    public function collectAdditionalFeePayment(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->collectAdditionalFeePayment($user, $id);

        return $this->success($response, $data, 'Additional fee payment collected successfully');
    }

    public function revertAdditionalFeePayment(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->revertAdditionalFeePayment($user, $id);

        return $this->success($response, $data, 'Additional fee payment reverted successfully');
    }
}

