<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Controllers;

use App\Domain\SchoolAdmin\Services\SchoolAdminService;
use App\Shared\BaseController;
use App\Shared\Auth\TokenService;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

use App\Domain\SchoolAdmin\Services\TeacherAttendanceService;

class SchoolAdminController extends BaseController
{
    public function __construct(
        TokenService $tokenService,
        private readonly SchoolAdminService $service,
        private readonly TeacherAttendanceService $teacherAttendanceService,
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
        $this->requireStaffAccess($user);

        $filters = $request->getQueryParams();
        $data    = $this->service->getStudents($user, $filters);

        return $this->success($response, $data);
    }

    public function createStudent(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body    = RequestParser::body($request);
        $student = $this->service->createStudent($user, $body);

        return $this->success($response, $student, 'Student created', 201);
    }

    public function getStudentById(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int) ($args['id'] ?? 0);
        $student = $this->service->getStudentById($user, $id);

        return $this->success($response, $student);
    }

    public function getFeeReceipt(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $studentId = (int)($args['student_id'] ?? 0);
        $params = $request->getQueryParams();
        $id = isset($params['id']) ? (int)$params['id'] : 0;
        $isAdditional = isset($params['additional']) && (int)$params['additional'] === 1;
        $receiptNo = !empty($params['receipt_no']) ? trim((string)$params['receipt_no']) : null;

        $receipt = $this->service->getFeeReceipt($user, $studentId, $id, $isAdditional, $receiptNo);

        $response->getBody()->write($receipt['data']);
        return $response
            ->withHeader('Content-Type', 'application/pdf')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $receipt['filename'] . '"')
            ->withStatus(200);
    }

    public function updateStudent(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int) ($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $student = $this->service->updateStudent($user, $id, $body);

        return $this->success($response, $student, 'Student updated successfully');
    }

    public function advanceStudent(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int) ($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $targetClassId = (int) ($body['class_id'] ?? 0);

        $result = $this->service->advanceStudent($user, $id, $targetClassId);

        return $this->success($response, $result, 'Student advanced successfully');
    }


    public function checkSrNo(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $params = $request->getQueryParams();
        $srNo = $params['sr_no'] ?? '';
        $excludeId = isset($params['exclude_id']) && $params['exclude_id'] !== '' ? (int)$params['exclude_id'] : null;

        $exists = $this->service->checkSrNoExists($user, $srNo, $excludeId);

        return $this->success($response, ['exists' => $exists]);
    }

    public function getNextSrNo(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getNextSrNo($user);

        return $this->success($response, $data);
    }

    public function uploadDocument(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No file was uploaded.', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        $errorCode = $uploadedFile->getError();
        if ($errorCode !== UPLOAD_ERR_OK) {
            $errMsgs = [
                UPLOAD_ERR_INI_SIZE   => 'File size exceeds 20MB maximum allowed limit.',
                UPLOAD_ERR_FORM_SIZE  => 'File size exceeds 20MB maximum allowed limit.',
                UPLOAD_ERR_PARTIAL    => 'The uploaded file was only partially uploaded.',
                UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
                UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder on the server.',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
                UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.'
            ];
            $msg = $errMsgs[$errorCode] ?? 'Failed to upload file (Error code: ' . $errorCode . ')';
            return $this->error($response, $msg, 400);
        }

        if ($uploadedFile->getSize() > 20 * 1024 * 1024) {
            return $this->error($response, 'File size exceeds 20MB maximum allowed limit.', 400);
        }

        // Clients may declare what the file is, so it lands in the right
        // bucket folder. Unknown values fall back to "documents".
        $body     = (array)$request->getParsedBody();
        $category = (string)($body['category'] ?? $request->getQueryParams()['category'] ?? '');

        try {
            $url = $this->service->handleFileUpload($uploadedFile, $category);
            return $this->success($response, ['url' => $url], 'File uploaded successfully');
        } catch (\Throwable $e) {
            return $this->error($response, 'File save error: ' . $e->getMessage(), 500);
        }
    }

    // -------------------------------------------------------------------------
    // Staff
    // -------------------------------------------------------------------------

    private function requireStaffAccess(array $user): void
    {
        $role = (string) ($user['role'] ?? '');
        if ($role === 'SCHOOL_ADMIN' || $role === 'SUPER_ADMIN' || $role === 'PRINCIPAL' || $this->service->isPrincipal($user) || $this->service->isFeeCollector($user)) {
            return;
        }
        $this->requireRole($user, ['SCHOOL_ADMIN']);
    }

    private function requireFeeCollectorAccess(array $user): void
    {
        $role = (string) ($user['role'] ?? '');
        if ($role === 'SCHOOL_ADMIN' || $role === 'SUPER_ADMIN' || $this->service->isFeeCollector($user)) {
            return;
        }
        throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. Only Fee Collector can access this feature.');
    }

    public function getStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $params = $request->getQueryParams();
        $data = $this->service->getStaff($user, $params);

        return $this->success($response, $data);
    }

    public function createStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body   = RequestParser::body($request);
        $member = $this->service->createStaff($user, $body);

        return $this->success($response, $member, 'Staff member created', 201);
    }

    public function updateStaff(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id     = (int)$args['id'];
        $body   = RequestParser::body($request);
        $member = $this->service->updateStaff($user, $id, $body);

        return $this->success($response, $member, 'Staff member updated');
    }

    public function getStaffDetails(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int)$args['id'];
        $params = $request->getQueryParams();
        $member = $this->service->getStaffDetails($user, $id, $params);

        return $this->success($response, $member);
    }

    public function requestPrincipalOtp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $action = $body['action'] ?? $request->getQueryParams()['action'] ?? 'assign';
        $result = $this->service->requestPrincipalOtp($user, $id, $action);

        return $this->success($response, $result, 'OTP sent to school admin email address.');
    }

    public function assignPrincipalRole(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $otpCode = $body['otp_code'] ?? null;
        $action = $body['action'] ?? 'assign';

        $result = $this->service->assignPrincipalRole($user, $id, $otpCode, $action);

        return $this->success($response, $result, $result['message'] ?? 'Principal role updated successfully.');
    }

    public function requestFeeCollectorOtp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $action = $body['action'] ?? $request->getQueryParams()['action'] ?? 'assign';
        $result = $this->service->requestFeeCollectorOtp($user, $id, $action);

        return $this->success($response, $result, 'OTP sent to school admin email address.');
    }

    public function assignFeeCollectorRole(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $otpCode = $body['otp_code'] ?? null;
        $action = $body['action'] ?? 'assign';

        $result = $this->service->assignFeeCollectorRole($user, $id, $otpCode, $action);

        return $this->success($response, $result, $result['message'] ?? 'Fee Collector role updated successfully.');
    }

    // -------------------------------------------------------------------------
    // Classes
    // -------------------------------------------------------------------------

    public function getClasses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $params = $request->getQueryParams();
        $data = $this->service->getClasses($user, $params);

        return $this->success($response, $data);
    }

    public function getMasterCatalog(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'SUPER_ADMIN']);

        $data = $this->service->getMasterCatalog();

        return $this->success($response, $data);
    }

    public function createClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

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
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PARENT', 'STUDENT', 'TEACHER', 'PRINCIPAL']);

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

    public function getAttendanceLeaderboard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $data = $this->service->getAttendanceLeaderboard($user, $params);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Holidays / Leave Days
    // -------------------------------------------------------------------------

    public function getHolidays(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'STUDENT']);

        $data = $this->service->getHolidays($user);
        return $this->success($response, $data);
    }

    public function createHoliday(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $result = $this->service->createHoliday($user, $body);

        return $this->success($response, $result, 'Holiday created successfully');
    }

    public function updateHoliday(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $result = $this->service->updateHoliday($user, $id, $body);

        return $this->success($response, $result, 'Holiday updated successfully');
    }

    public function deleteHoliday(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $result = $this->service->deleteHoliday($user, $id);

        return $this->success($response, $result, 'Holiday deleted successfully');
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

    public function getExaminations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $data = $this->service->getExaminations($user);
        return $this->success($response, $data);
    }

    public function createExamination(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $body = RequestParser::body($request);
        $data = $this->service->createExamination($user, $body);
        return $this->success($response, $data, 'Examination created successfully', 201);
    }

    public function getExaminationDetails(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $id = (int)$args['id'];
        $data = $this->service->getExaminationDetails($user, $id);
        return $this->success($response, $data);
    }

    public function requestExamDeleteOtp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $id = (int)$args['id'];
        $res = $this->service->requestExamDeleteOtp($user, $id);
        return $this->success($response, $res);
    }

    public function deleteExamination(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $otpCode = $body['otp_code'] ?? $request->getQueryParams()['otp'] ?? null;
        $this->service->deleteExamination($user, $id, $otpCode);
        return $this->success($response, null, 'Examination deleted successfully');
    }

    public function updateExamination(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $this->service->updateExamination($user, $id, $body);
        return $this->success($response, null, 'Examination updated successfully');
    }

    public function getAllExamSchemes(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $data = $this->service->getAllExamSchemes($user, $examId);
        return $this->success($response, $data);
    }

    public function getExamTimetable(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $data = $this->service->getExamTimetable($user, $examId, $classId);
        return $this->success($response, $data);
    }

    public function saveExamTimetable(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $body = RequestParser::body($request);
        $this->service->saveExamTimetable($user, $examId, $classId, $body);
        return $this->success($response, null, 'Exam timetable saved successfully');
    }

    public function getExamMarksSheet(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $subjectId = isset($params['subject_id']) ? (int)$params['subject_id'] : 0;
        $data = $this->service->getExamMarksSheet($user, $examId, $classId, $subjectId);
        return $this->success($response, $data);
    }

    public function saveExamMark(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->saveExamMark($user, $examId, $body);
        return $this->success($response, $data, 'Mark saved successfully');
    }

    public function publishExamResults(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $classId = (int)($body['class_id'] ?? 0);
        $status = $body['status'] ?? 'Published';
        $this->service->publishExamResults($user, $examId, $classId, $status);
        return $this->success($response, null, 'Exam results status updated successfully');
    }

    public function publishExamScheme(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $classId = (int)($body['class_id'] ?? 0);
        $this->service->publishExamScheme($user, $examId, $classId);
        return $this->success($response, null, 'Examination scheme published successfully');
    }

    public function publishExamAdmitCards(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $classId = (int)($body['class_id'] ?? 0);
        $this->service->publishExamAdmitCards($user, $examId, $classId);
        return $this->success($response, null, 'Admit cards published successfully');
    }

    public function unpublishExamScheme(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $classId = (int)($body['class_id'] ?? 0);
        $this->service->unpublishExamScheme($user, $examId, $classId);
        return $this->success($response, null, 'Examination scheme reverted to Draft successfully');
    }

    public function unpublishExamAdmitCards(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $classId = (int)($body['class_id'] ?? 0);
        $this->service->unpublishExamAdmitCards($user, $examId, $classId);
        return $this->success($response, null, 'Admit cards reverted to Draft successfully');
    }

    public function getReportCards(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'STUDENT', 'PARENT']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $studentId = isset($params['student_id']) && $params['student_id'] !== '' ? (int)$params['student_id'] : null;
        $data = $this->service->getReportCards($user, $examId, $classId, $studentId);
        return $this->success($response, $data);
    }

    public function getExamReportCardsPrintHtml(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'STUDENT', 'PARENT', 'SUPER_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $studentId = isset($params['student_id']) && $params['student_id'] !== '' ? (int)$params['student_id'] : null;
        $autoprint = !empty($params['autoprint']);

        $data = $this->service->getReportCards($user, $examId, $classId, $studentId);
        $cards = [];
        if (!empty($data)) {
            if (isset($data['student_id'])) {
                $cards = [$data];
            } elseif (is_array($data)) {
                $cards = $data;
            }
        }

        if (empty($cards)) {
            $response->getBody()->write('<!DOCTYPE html><html><body><h3 style="font-family:sans-serif;text-align:center;margin-top:40px;">No report cards available for this selection.</h3></body></html>');
            return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
        }

        $allCardsHtml = '';
        foreach ($cards as $card) {
            $schoolName = strtoupper(htmlspecialchars($card['school_name'] ?? 'SPLENDID PUBLIC SCHOOL'));
            $schoolAddress = strtoupper(htmlspecialchars($card['school_address'] ?? 'CIVIL LINES, CENTRAL EDUCATION HUB'));
            $schoolLogo = !empty($card['school_logo']) ? $card['school_logo'] : null;

            $examName = strtoupper(htmlspecialchars($card['exam_name'] ?? 'UNIT TEST 1'));
            $academicYear = htmlspecialchars($card['academic_year_name'] ?? '2026-2027');

            $studentName = strtoupper(htmlspecialchars($card['student_name'] ?? 'STUDENT'));
            $className = htmlspecialchars($card['class_name'] ?? '');
            if (!empty($card['class_section'])) {
                $className .= ' (' . htmlspecialchars($card['class_section']) . ')';
            }
            $fatherName = htmlspecialchars(!empty($card['father_name']) ? $card['father_name'] : '—');
            $motherName = htmlspecialchars(!empty($card['mother_name']) ? $card['mother_name'] : '—');

            $dob = $card['dob'] ?? $card['date_of_birth'] ?? '—';
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dob, $m)) {
                $dob = $m[3] . '/' . $m[2] . '/' . $m[1];
            } else {
                $dob = htmlspecialchars($dob);
            }

            $rollNo = htmlspecialchars((string)($card['roll_no'] ?? '—'));
            $admissionNo = htmlspecialchars((string)($card['admission_no'] ?? '—'));

            // Sort subjects: numeric first, grade-only at bottom
            $subjects = $card['subjects'] ?? [];
            $numSubs = [];
            $gradeSubs = [];
            foreach ($subjects as $sub) {
                $maxM = (string)($sub['max_marks'] ?? '');
                $subName = strtolower($sub['subject_name'] ?? '');
                $isGrade = ($maxM === '—' || $maxM === '0' || $maxM === '' || $subName === 'ptm' || $subName === 'hindi');
                if ($isGrade) {
                    $gradeSubs[] = $sub;
                } else {
                    $numSubs[] = $sub;
                }
            }
            $sortedSubjects = array_merge($numSubs, $gradeSubs);

            $subCount = count($sortedSubjects);
            $cellPadding = $subCount <= 4 ? '12px 10px' : ($subCount <= 6 ? '9px 8px' : '6px 6px');
            $cellFontSize = $subCount <= 4 ? '11px' : ($subCount <= 6 ? '10.5px' : '9.5px');

            $rowsHtml = '';
            foreach ($sortedSubjects as $s) {
                $sName = htmlspecialchars($s['subject_name'] ?? '');
                $sMax = htmlspecialchars((string)($s['max_marks'] ?? '—'));
                $sPass = htmlspecialchars((string)($s['passing_marks'] ?? '—'));
                $sObt = htmlspecialchars((string)($s['marks_obtained'] ?? '—'));
                $sGrade = htmlspecialchars((string)($s['grade'] ?? '—'));
                $sResult = htmlspecialchars(strtoupper((string)($s['result'] ?? 'PASS')));

                $subNameLower = strtolower($s['subject_name'] ?? '');
                if ($sMax === '—' || $sMax === '0' || $sMax === '' || $subNameLower === 'ptm' || $subNameLower === 'hindi') {
                    $sMax = 'GRADE';
                    $sPass = 'C';
                }

                $rowsHtml .= '<tr style="border-bottom: 1px solid #000000;">';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; font-weight: 700; border-right: 1px solid #000000; text-align: left;">' . $sName . '</td>';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-family: monospace, sans-serif;">' . $sMax . '</td>';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-family: monospace, sans-serif; color: #475569;">' . $sPass . '</td>';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-family: monospace, sans-serif; font-weight: 800;">' . $sObt . '</td>';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-weight: 800;">' . $sGrade . '</td>';
                $rowsHtml .= '<td style="padding: ' . $cellPadding . '; text-align: center; font-weight: 800; font-size: 10px;">' . $sResult . '</td>';
                $rowsHtml .= '</tr>';
            }

            $totalMax = htmlspecialchars((string)($card['total_max'] ?? '—'));
            $totalObtained = htmlspecialchars((string)($card['total_obtained'] ?? '—'));
            $percentage = isset($card['percentage']) ? number_format((float)$card['percentage'], 2) : '—';
            $overallGrade = htmlspecialchars((string)($card['grade'] ?? '—'));
            $overallResult = htmlspecialchars(strtoupper((string)($card['result'] ?? 'PASS')));

            $classRank = (string)($card['class_rank'] ?? '1');
            if (preg_match('/^(\d+)/', $classRank, $rm)) {
                $classRank = $rm[1];
            }
            $classRank = htmlspecialchars($classRank);

            $attRate = '0%';
            if (isset($card['attendance']['attendance_rate']) && is_numeric($card['attendance']['attendance_rate'])) {
                $attRate = round((float)$card['attendance']['attendance_rate']) . '%';
            }

            $teacherRemark = trim((string)($card['teacher_remark'] ?? $card['report_card_remark'] ?? ''));

            $logoHtml = '';
            if (!empty($schoolLogo)) {
                $logoHtml = '<img src="' . htmlspecialchars($schoolLogo) . '" style="height: 54px; max-width: 140px; object-fit: contain; margin: 0 auto 4px auto; display: block;" alt="School Logo" />';
            } else {
                $logoHtml = '<div style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #000000; margin: 0 auto 4px auto; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #000000;">' . substr($schoolName, 0, 1) . '</div>';
            }

            $remarkSection = '';
            if ($teacherRemark !== '') {
                $remarkSection = '<div style="margin-top: 8px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; line-height: 1.4;">'
                    . '<strong style="font-weight: 800; color: #000000;">Teacher Remarks:</strong> '
                    . '<span style="font-weight: 700; font-style: italic; color: #000000;">' . htmlspecialchars($teacherRemark) . '</span>'
                    . '</div>';
            }

            $allCardsHtml .= '
<div class="report-card-root">
  <!-- School Header -->
  <div style="text-align: center; margin-bottom: 2px;">
    ' . $logoHtml . '
    <h1 style="font-family: Georgia, \'Times New Roman\', serif; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin: 0; line-height: 1.2; color: #000000;">' . $schoolName . '</h1>
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin: 2px 0 6px 0; color: #475569;">' . $schoolAddress . '</div>
    
    <div style="margin: 6px 0 8px 0; border-top: 2px solid #000000; border-bottom: 2px solid #000000; padding: 4px 0; text-align: center;">
      <span style="display: inline-block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border: 1.5px solid #000000; border-radius: 4px; padding: 4px 20px; background-color: #ffffff; color: #000000;">
        ' . $examName . ' REPORT CARD (' . $academicYear . ')
      </span>
    </div>
  </div>

  <!-- Student Details Grid (3x4) -->
  <table style="width: 100%; border-collapse: collapse; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; border: 2px solid #000000; margin-bottom: 8px;">
    <tbody>
      <tr style="border-bottom: 1px solid #000000;">
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Student Name</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; border-right: 1px solid #000000; text-transform: uppercase; color: #000000;">' . $studentName . '</td>
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Class &amp; Sec</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; color: #000000;">' . $className . '</td>
      </tr>
      <tr style="border-bottom: 1px solid #000000;">
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Father\'s Name</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; border-right: 1px solid #000000; color: #000000;">' . $fatherName . '</td>
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Mother\'s Name</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; color: #000000;">' . $motherName . '</td>
      </tr>
      <tr>
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Date of Birth</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; border-right: 1px solid #000000; font-family: ui-sans-serif, system-ui, sans-serif; color: #000000;">' . $dob . '</td>
        <td style="width: 18%; background-color: #f4f4f5; font-weight: 700; padding: 5px 8px; border-right: 1px solid #000000; color: #1e293b; white-space: nowrap;">Roll / SR No</td>
        <td style="width: 32%; font-weight: 800; padding: 5px 8px; font-family: ui-sans-serif, system-ui, sans-serif; color: #000000;">' . $rollNo . ' | ' . $admissionNo . '</td>
      </tr>
    </tbody>
  </table>

  <!-- Scholastic Marks Table -->
  <div class="marks-table-container">
    <table style="width: 100%; border-collapse: collapse; font-family: ui-sans-serif, system-ui, sans-serif; font-size: ' . $cellFontSize . '; border: 2px solid #000000;">
      <thead>
        <tr style="background-color: #e4e4e7; font-weight: 800; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #000000; color: #000000;">
          <th style="padding: 7px 8px; text-align: left; border-right: 1px solid #000000;">Subject</th>
          <th style="padding: 7px 6px; text-align: center; border-right: 1px solid #000000; width: 15%;">Max Marks</th>
          <th style="padding: 7px 6px; text-align: center; border-right: 1px solid #000000; width: 15%;">Pass Marks</th>
          <th style="padding: 7px 6px; text-align: center; border-right: 1px solid #000000; width: 18%;">Marks Obtained</th>
          <th style="padding: 7px 6px; text-align: center; border-right: 1px solid #000000; width: 12%;">Grade</th>
          <th style="padding: 7px 6px; text-align: center; width: 14%;">Result</th>
        </tr>
      </thead>
      <tbody>
        ' . $rowsHtml . '
        <!-- Grand Total Row -->
        <tr style="background-color: #e4e4e7; font-weight: 800; border-top: 2px solid #000000; border-bottom: 2px solid #000000; color: #000000;">
          <td style="padding: ' . $cellPadding . '; font-weight: 800; border-right: 1px solid #000000; text-align: left;">Grand Total</td>
          <td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-family: monospace, sans-serif;">' . $totalMax . '</td>
          <td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000;">—</td>
          <td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-family: monospace, sans-serif; font-size: 12px;">' . $totalObtained . '</td>
          <td style="padding: ' . $cellPadding . '; text-align: center; border-right: 1px solid #000000; font-size: 12px;">' . $overallGrade . '</td>
          <td style="padding: ' . $cellPadding . '; text-align: center; font-size: 11px;">' . $overallResult . '</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 5 Performance Summary Cards -->
  <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 6px 0; font-family: ui-sans-serif, system-ui, sans-serif;">
    <div style="background-color: #f4f4f5; border: 2px solid #000000; border-radius: 4px; padding: 6px 3px; text-align: center;">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; opacity: 0.9;">Total Marks</div>
      <div style="font-size: 11px; font-weight: 800; font-family: monospace, sans-serif; margin-top: 2px; color: #000000;">' . $totalObtained . ' / ' . $totalMax . '</div>
    </div>
    <div style="background-color: #f4f4f5; border: 2px solid #000000; border-radius: 4px; padding: 6px 3px; text-align: center;">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; opacity: 0.9;">Percentage</div>
      <div style="font-size: 11px; font-weight: 800; font-family: monospace, sans-serif; margin-top: 2px; color: #000000;">' . $percentage . '%</div>
    </div>
    <div style="background-color: #f4f4f5; border: 2px solid #000000; border-radius: 4px; padding: 6px 3px; text-align: center;">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; opacity: 0.9;">Overall Grade</div>
      <div style="font-size: 11px; font-weight: 800; font-family: monospace, sans-serif; margin-top: 2px; color: #000000;">Grade ' . $overallGrade . '</div>
    </div>
    <div style="background-color: #f4f4f5; border: 2px solid #000000; border-radius: 4px; padding: 6px 3px; text-align: center;">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; opacity: 0.9;">Attendance</div>
      <div style="font-size: 11px; font-weight: 800; font-family: monospace, sans-serif; margin-top: 2px; color: #000000;">' . $attRate . '</div>
    </div>
    <div style="background-color: #f4f4f5; border: 2px solid #000000; border-radius: 4px; padding: 6px 3px; text-align: center;">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; opacity: 0.9;">Class Rank</div>
      <div style="font-size: 11px; font-weight: 800; font-family: monospace, sans-serif; margin-top: 2px; color: #000000;">' . $classRank . '</div>
    </div>
  </div>

  ' . $remarkSection . '

  <!-- Dual Signatures -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 24px 2px 24px; margin-top: 22px; font-family: ui-sans-serif, system-ui, sans-serif;">
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div style="width: 160px; border-bottom: 2px solid #000000; margin-bottom: 6px;"></div>
      <span style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #000000;">CLASS TEACHER SIGNATURE</span>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div style="width: 160px; border-bottom: 2px solid #000000; margin-bottom: 6px;"></div>
      <span style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #000000;">PRINCIPAL SIGNATURE &amp; STAMP</span>
    </div>
  </div>
</div>';
        }

        $scriptAutoprint = $autoprint ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>' : '';
        $docTitle = 'Report_Cards_' . date('Ymd_His');

        $html = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>' . $docTitle . '</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #ffffff;
      color: #000000;
    }
    .report-card-root {
      width: 194mm;
      min-height: 275mm;
      max-height: 284mm;
      margin: 0 auto;
      padding: 7mm;
      border: 6px double #000000;
      border-radius: 4px;
      background-color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .report-card-root:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .marks-table-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      margin: 4px 0;
    }
  </style>
  ' . $scriptAutoprint . '
</head>
<body>
  ' . $allCardsHtml . '
</body>
</html>';

        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html; charset=utf-8');
    }

    public function getAchievements(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $params = $request->getQueryParams();
        $data = $this->service->getAchievements($user, $params);
        return $this->success($response, $data);
    }

    public function getAchievementReportCard(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $achievementId = (int)$args['id'];
        $data = $this->service->getAchievementReportCard($user, $achievementId);
        return $this->success($response, $data);
    }

    public function getExamClassStatuses(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $data = $this->service->getExamClassStatuses($user, $examId);
        return $this->success($response, $data);
    }

    public function getGradeConfigurations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $data = $this->service->getGradeConfigurations($user);
        return $this->success($response, $data);
    }

    public function saveGradeConfigurations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $body = RequestParser::body($request);
        $this->service->saveGradeConfigurations($user, $body);
        return $this->success($response, null, 'Grade configurations saved successfully');
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

        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : null;
        $date = $params['date'] ?? null;

        $data = $this->service->getTimetable($user, $classId, $date);

        return $this->success($response, $data);
    }

    public function addTimetablePeriod(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->addTimetablePeriod($user, $body);

        return $this->success($response, $data, 'Timetable period added successfully', 201);
    }

    public function deleteTimetablePeriod(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $date = $body['date'] ?? null;
        $this->service->deleteTimetablePeriod($user, $id, $date);

        return $this->success($response, null, 'Timetable period deleted successfully');
    }

    public function deleteDayTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->deleteDayTimetable($user, $body);

        return $this->success($response, $data, 'Timetable for the day deleted successfully');
    }

    public function assignBackupTeacher(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->assignBackupTeacher($user, $body);

        return $this->success($response, $data, 'Backup teacher assigned successfully');
    }

    public function replaceTeacher(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->replaceTeacher($user, $body);

        return $this->success($response, $data, 'Teacher replaced successfully');
    }

    public function publishTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $this->service->publishTimetable($user, $body);

        return $this->success($response, null, 'Timetable published successfully');
    }

    public function pasteTimetableSchedule(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $this->service->pasteTimetableSchedule($user, $body);

        return $this->success($response, null, 'Schedule pasted successfully');
    }

    public function getSubjects(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL', 'SUPER_ADMIN']);

        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) && $params['class_id'] !== '' ? (int)$params['class_id'] : null;

        $data = $this->service->getSubjects($user, $classId);

        return $this->success($response, $data);
    }

    public function createSubject(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createSubject($user, $body);

        return $this->success($response, $data, 'Subject created successfully', 201);
    }

    public function updateSubject(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateSubject($user, $id, $body);

        return $this->success($response, $data, 'Subject updated successfully');
    }

    public function deleteSubject(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $this->service->deleteSubject($user, $id);

        return $this->success($response, null, 'Subject deleted successfully');
    }

    public function getPeriodConfigurations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $date = $params['date'] ?? null;

        $data = $this->service->getPeriodConfigurations($user, $date);

        return $this->success($response, $data);
    }

    public function getTimetableSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getTimetableSettings($user);

        return $this->success($response, $data);
    }

    public function saveTimetableSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->saveTimetableSettings($user, $body);

        return $this->success($response, $data, 'Timetable settings saved and periods generated successfully');
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

    public function getCollectionHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $data = $this->service->getCollectionHistory($user, $params);

        return $this->success($response, $data);
    }

    public function getSchoolProfile(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getSchoolProfile($user);

        return $this->success($response, $data);
    }

    public function getActivePlans(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getActivePlans();

        return $this->success($response, $data);
    }

    public function getSubscriptionHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getSubscriptionHistory($user);

        return $this->success($response, $data);
    }

    public function getMenuPermissions(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getMenuPermissions($user);

        return $this->success($response, $data);
    }

    public function saveMenuPermissions(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = $request->getParsedBody() ?? [];
        $data = $this->service->saveMenuPermissions($user, $body);

        return $this->success($response, $data, 'Menu permissions updated successfully');
    }

    public function getClassTeacherAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getClassTeacherAssignments($user);

        return $this->success($response, $data);
    }

    public function saveClassTeacherAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = $request->getParsedBody() ?? [];
        $data = $this->service->saveClassTeacherAssignments($user, $body);

        return $this->success($response, $data, 'Class teacher assignments saved successfully');
    }

    public function getMyPermissions(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $data = $this->service->getMyPermissions($user);

        return $this->success($response, $data);
    }

    protected function requireRole(array $user, string|array $roles): void
    {
        $userRole = strtoupper((string)($user['role'] ?? ''));
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        // Strict School Admin authorization for Principal & Fee Collector role management
        if (str_contains($uri, 'request-principal-otp') || 
            str_contains($uri, 'assign-principal') || 
            str_contains($uri, 'request-fee-collector-otp') || 
            str_contains($uri, 'assign-fee-collector')) {
            if ($userRole !== 'SCHOOL_ADMIN' && $userRole !== 'SUPER_ADMIN') {
                throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. Only School Admin can assign or unassign Principal and Fee Collector roles.');
            }
            if ($this->service->checkSubscriptionExpired($user)) {
                throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
            }
            return;
        }

        // Strict School Admin authorization for discount approval settings & approve/reject actions
        if ((str_contains($uri, '/api/school/discount/settings') && $method !== 'GET') ||
            (str_contains($uri, '/api/school/discount-requests') && (str_contains($uri, '/approve') || str_contains($uri, '/reject')))) {
            if ($userRole !== 'SCHOOL_ADMIN' && $userRole !== 'SUPER_ADMIN') {
                throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. Only School Admin can manage discount settings or approve/reject discount requests.');
            }
            if ($this->service->checkSubscriptionExpired($user)) {
                throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
            }
            return;
        }

        // Fee Collector route authorization (Fees Portal + TSD: Teacher Salary Disbursement + Expenses)
        if (str_contains($uri, '/api/school/fee-payments') || 
            str_contains($uri, '/api/school/class-fee-configurations') || 
            str_contains($uri, '/api/school/additional-fees') || 
            str_contains($uri, '/api/school/annual-fees') || 
            str_contains($uri, '/api/school/transport-fees') || 
            str_contains($uri, '/api/school/collection-history') ||
            str_contains($uri, '/api/school/fee-structures') ||
            str_contains($uri, '/api/school/staff-payments') ||
            str_contains($uri, '/api/school/stats') ||
            str_contains($uri, '/api/school/expenses') ||
            str_contains($uri, '/api/school/academic-years') ||
            str_contains($uri, '/api/school/financial-reports') ||
            str_contains($uri, '/api/school/discount') ||
            str_contains($uri, '/api/school/discount-requests') ||
            (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && (str_contains($uri, '/api/school/students') || str_contains($uri, '/api/school/classes') || str_contains($uri, '/api/school/staff')))) {
            if ($userRole === 'SCHOOL_ADMIN' || $this->service->isFeeCollector($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Classes & Teachers modules, Credentials, Timetable Settings & Upload authorization for Principal & Fee Collector
        if (str_contains($uri, '/api/school/classes') || 
            str_contains($uri, '/api/school/students') || 
            str_contains($uri, '/api/school/staff') || 
            str_contains($uri, '/api/school/credentials') ||
            str_contains($uri, '/api/school/timetable-settings') ||
            str_contains($uri, '/api/school/upload')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'SUPER_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user) || $this->service->isFeeCollector($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal Examinations route authorization
        if (str_contains($uri, '/api/school/exams-new') || 
            str_contains($uri, '/api/school/exams') || 
            str_contains($uri, '/api/school/exam-marks') || 
            str_contains($uri, '/api/school/grade-configurations')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'SUPER_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal teacher attendance route authorization
        if (str_contains($uri, '/api/school/teacher-attendance')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal timetable & subjects route authorization
        if (str_contains($uri, '/api/school/timetable') || str_contains($uri, '/api/school/period-configurations') || str_contains($uri, '/api/school/subjects')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal class teacher assignments route authorization
        if (str_contains($uri, '/api/school/class-teacher-assignments')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal official holidays management route authorization
        if (str_contains($uri, '/api/school/holidays')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        // Principal announcements management route authorization
        if (str_contains($uri, '/api/school/announcements')) {
            if ($userRole === 'SCHOOL_ADMIN' || $userRole === 'PRINCIPAL' || $this->service->isPrincipal($user)) {
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }
        }

        if ($userRole === 'TEACHER' || $userRole === 'PRINCIPAL') {
            // 1. Shared/Bootstrap endpoints (always allowed for teachers)
            $isShared = false;
            $sharedPaths = [
                '/api/school/my-permissions',
                '/api/school/profile',
                '/api/school/academic-years',
                '/api/school/notifications',
                '/api/school/badges',
                '/api/school/plans',
                '/api/school/subscriptions',
            ];
            foreach ($sharedPaths as $path) {
                if (str_contains($uri, $path)) {
                    $isShared = true;
                    break;
                }
            }

            // Also allow GET requests to common entity resources for dropdowns/filters
            if ($method === 'GET') {
                $sharedGetPaths = [
                    '/api/school/classes',
                    '/api/school/subjects',
                    '/api/school/students',
                    '/api/school/staff',
                    '/api/school/holidays',
                    '/api/school/grade-configurations',
                    '/api/school/period-configurations',
                    '/api/school/timetable-settings',
                    '/api/school/academic-years',
                ];
                foreach ($sharedGetPaths as $path) {
                    if (str_contains($uri, $path)) {
                        $isShared = true;
                        break;
                    }
                }
            }

            if ($isShared) {
                return;
            }

            // Retrieve teacher permissions
            $permsData = $this->service->getMyPermissions($user);
            $permissions = $permsData['permissions'] ?? [];

            // If teacher has zero web permissions, they are not authorized for admin management routes
            if (empty($permissions)) {
                throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. No role assigned.');
            }

            if ($isShared) {
                // Check subscription expiry
                if (!str_contains($uri, '/api/school/profile') && 
                    !str_contains($uri, '/api/school/plans') && 
                    !str_contains($uri, '/api/school/subscriptions') &&
                    $this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }

            // Document Upload endpoint permission mapping
            if (str_contains($uri, '/api/school/upload')) {
                if (in_array('Classes', $permissions, true) || in_array('Leave Requests', $permissions, true) || in_array('Teachers', $permissions, true) || $this->service->isFeeCollector($user)) {
                    return;
                }
                throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. Upload permission required.');
            }

            // Discount approval settings (read) & discount request submission/listing for Fees Portal staff
            if (str_contains($uri, '/api/school/discount/settings') || str_contains($uri, '/api/school/discount-requests')) {
                $hasDiscountPerm = in_array('Fees Portal', $permissions, true) || $this->service->isFeeCollector($user);
                if ($method === 'GET' && in_array('Classes', $permissions, true)) {
                    $hasDiscountPerm = true;
                }
                if (!$hasDiscountPerm) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. You do not have permission to perform this action.');
                }
                if ($this->service->checkSubscriptionExpired($user)) {
                    throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
                }
                return;
            }

            // 2. Specific module authorization check
            $authorized = false;
            
            // Map URI pattern to menu label
            $mappings = [
                '/api/school/stats' => 'Dashboard',
                '/api/school/students' => 'Classes',
                '/api/school/classes' => 'Classes',
                '/api/school/staff' => 'Teachers',
                '/api/school/staff-payments' => 'Teachers',
                '/api/school/timetable' => 'Timetable',
                '/api/school/timetable-settings' => 'Timetable',
                '/api/school/period-configurations' => 'Timetable',
                '/api/school/attendance' => 'Attendance',
                '/api/school/leave-requests' => 'Leave Requests',
                '/api/school/exams' => 'Examinations',
                '/api/school/exams-new' => 'Examinations',
                '/api/school/exam-marks' => 'Examinations',
                '/api/school/grade-configurations' => 'Examinations',
                '/api/school/fee-structures' => 'Fees Portal',
                '/api/school/fee-payments' => 'Fees Portal',
                '/api/school/collection-history' => 'Fees Portal',
                '/api/school/class-fee-configurations' => 'Fees Portal',
                '/api/school/additional-fees' => 'Fees Portal',
                '/api/school/annual-fees' => 'Fees Portal',
                '/api/school/financial-reports' => 'Financial Reports',
                '/api/school/finance-management' => 'Finance Management',
                '/api/school/expenses' => 'Finance Management',
                '/api/school/transport-fees' => 'Finance Management',
                '/api/school/fee-follow-ups' => 'Fee Follow-up',
                '/api/school/announcements' => 'Announcements',
                '/api/school/audits-settings' => 'Audits & Settings',
                '/api/school/academic-years' => 'Audits & Settings',
                '/api/school/menu-permissions' => 'Audits & Settings',
                '/api/school/credentials' => 'Security',
                '/api/school/holidays' => 'Security',
            ];

            foreach ($mappings as $pattern => $menuLabel) {
                if (str_contains($uri, $pattern)) {
                    if (in_array($menuLabel, $permissions, true)) {
                        $authorized = true;
                    }
                    break;
                }
            }

            if (!$authorized) {
                throw new \App\Shared\Exceptions\ForbiddenException('Access Denied. You do not have permission to perform this action.');
            }

            // Check subscription expiry
            if ($this->service->checkSubscriptionExpired($user)) {
                throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
            }
            return;
        }

        // Default role validation for non-teachers (e.g. SCHOOL_ADMIN)
        parent::requireRole($user, $roles);

        $uri = $_SERVER['REQUEST_URI'] ?? '';
        if (str_contains($uri, '/api/school/profile') || str_contains($uri, '/api/school/plans') || str_contains($uri, '/api/school/subscriptions')) {
            return;
        }

        if ($this->service->checkSubscriptionExpired($user)) {
            throw new \App\Shared\Exceptions\ForbiddenException('Subscription Expired. Access Denied.');
        }
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

    public function uploadPrincipalSignature(Request $request, Response $response): Response
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

        if ($uploadedFile->getSize() > 5 * 1024 * 1024) {
            return $this->error($response, 'File size must be less than 5MB', 400);
        }

        $filename = $uploadedFile->getClientFilename();
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg'])) {
            return $this->error($response, 'Only PNG, JPG, and JPEG files are accepted', 400);
        }

        $profile = $this->service->uploadPrincipalSignature($user, $uploadedFile);

        return $this->success($response, $profile, 'Principal signature uploaded successfully');
    }

    public function removePrincipalSignature(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $profile = $this->service->removePrincipalSignature($user);

        return $this->success($response, $profile, 'Principal signature removed successfully');
    }

    public function updateClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body  = RequestParser::body($request);
        $class = $this->service->updateClass($user, $body);

        return $this->success($response, $class, 'Class updated');
    }

    public function deleteClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body   = RequestParser::body($request);
        $query  = RequestParser::query($request);
        $data   = array_merge($query, $body);

        $result = $this->service->deleteClass($user, $data);

        return $this->success($response, $result, 'Class deleted');
    }

    public function transferStudents(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body   = RequestParser::body($request);
        $result = $this->service->transferStudents($user, $body);

        return $this->success($response, $result, 'Students transferred successfully');
    }

    public function deleteSection(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body   = RequestParser::body($request);
        $result = $this->service->deleteSection($user, $body);

        return $this->success($response, $result, 'Section deleted');
    }

    public function getNextRollNo(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $classId = (int)($args['class_id'] ?? 0);
        $nextRollNo = $this->service->getNextRollNo($user, $classId);

        return $this->success($response, ['next_roll_no' => $nextRollNo]);
    }

    public function checkRollNo(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = RequestParser::query($request);
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $rollNo = (string)($params['roll_no'] ?? '');
        $excludeId = isset($params['exclude_id']) && $params['exclude_id'] !== '' ? (int)$params['exclude_id'] : null;

        $exists = $this->service->checkRollNoExists($user, $classId, $rollNo, $excludeId);

        return $this->success($response, ['exists' => $exists]);
    }

    public function deleteFeePayment(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $otpCode = !empty($body['otp_code']) ? trim((string)$body['otp_code']) : (string)($request->getQueryParams()['otp_code'] ?? '');
        $this->service->deleteFeePayment($user, $id, $otpCode);

        return $this->success($response, null, 'Payment reverted successfully');
    }

    public function requestFeeRevertOtp(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->requestFeeRevertOtp($user, $body);

        return $this->success($response, $data, 'OTP sent to registered email address');
    }

    public function createAcademicYear(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL', 'SUPER_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createAcademicYear($user, $body);

        return $this->success($response, $data, 'Academic year created', 201);
    }

    public function activateAcademicYear(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL', 'SUPER_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->activateAcademicYear($user, $id, $body);

        return $this->success($response, $data, 'Academic year activated');
    }

    public function migrateAcademicYear(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL', 'SUPER_ADMIN']);

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

    public function getClassCourseFeeConfigurations(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'STAFF']);

        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) && $params['class_id'] !== '' ? (int)$params['class_id'] : null;
        $academicYearId = isset($params['academic_year_id']) && $params['academic_year_id'] !== '' ? (int)$params['academic_year_id'] : null;

        $data = $this->service->getClassCourseFeeConfigurations($user, $classId, $academicYearId);

        return $this->success($response, $data);
    }

    public function saveClassCourseFeeConfiguration(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->saveClassCourseFeeConfiguration($user, $body);

        return $this->success($response, $data, 'Course fee configuration saved');
    }

    public function lockClassFeeConfiguration(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->lockClassFeeConfiguration($user, $body);

        return $this->success($response, $data, 'Class fee configuration locked successfully');
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

    public function disbursePreviousYearStaffSalary(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->disbursePreviousYearStaffSalary($user, $body);

        return $this->success($response, $data, 'Previous year staff salary paid successfully', 201);
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
        $this->requireStaffAccess($user);

        $params = $request->getQueryParams();
        $from = $params['from_date'] ?? '';
        $to = $params['to_date'] ?? '';

        $data = $this->service->getFinancialPreview($user, $from, $to);

        return $this->success($response, $data);
    }

    public function getFinancialReports(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $data = $this->service->getFinancialReports($user);

        return $this->success($response, $data);
    }

    public function createFinancialReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body = RequestParser::body($request);
        $data = $this->service->createFinancialReport($user, $body);

        return $this->success($response, $data, 'Financial report generated successfully', 201);
    }

    public function updateFinancialReportStatus(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateFinancialReportStatus($user, $id, $body);

        return $this->success($response, $data, 'Financial report status updated');
    }

    public function submitSettlementRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int)$args['id'];
        $data = $this->service->submitSettlementRequest($user, $id);

        return $this->success($response, $data, 'Settlement request submitted successfully');
    }

    public function deleteFinancialReport(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int)$args['id'];
        $this->service->deleteFinancialReport($user, $id);

        return $this->success($response, null, 'Financial report deleted successfully');
    }

    public function exportFinancialReport(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $id = (int)$args['id'];
        $filename = "";
        $excelData = $this->service->exportFinancialReport($user, $id, $filename);

        $response->getBody()->write($excelData);
        return $response
            ->withHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('Expires', '0');
    }

    public function exportFinancialPreviewReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $params = $request->getQueryParams();
        $from = $params['from_date'] ?? '';
        $to = $params['to_date'] ?? '';

        $filename = "";
        $excelData = $this->service->exportFinancialPreviewReport($user, $from, $to, $filename);

        $response->getBody()->write($excelData);
        return $response
            ->withHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('Expires', '0');
    }

    public function ownerApproveSettlement(Request $request, Response $response, array $args): Response
    {
        $id = (int)$args['id'];
        $params = $request->getQueryParams();
        $signature = $params['signature'] ?? '';
        $html = $this->service->ownerApproveSettlement($id, $signature);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html');
    }

    public function ownerRejectSettlement(Request $request, Response $response, array $args): Response
    {
        $id = (int)$args['id'];
        $params = $request->getQueryParams();
        $signature = $params['signature'] ?? '';
        $html = $this->service->ownerRejectSettlement($id, $signature);
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html');
    }

    public function getSchoolExpenses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $params = $request->getQueryParams();
        $data = $this->service->getSchoolExpenses($user, $params);

        return $this->success($response, $data);
    }

    public function updateSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateSchoolExpense($user, $id, $body);

        return $this->success($response, $data, 'School expense updated successfully');
    }

    public function deleteSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $id = (int)$args['id'];
        $data = $this->service->deleteSchoolExpense($user, $id);

        return $this->success($response, $data, 'School expense deleted successfully');
    }

    public function createSchoolExpense(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $body = RequestParser::body($request);
        $data = $this->service->createSchoolExpense($user, $body);

        return $this->success($response, $data, 'School expense recorded successfully', 201);
    }

    public function getExpenseSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER']);

        $data = $this->service->getExpenseSettings($user);
        return $this->success($response, $data);
    }

    public function updateExpenseSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->updateExpenseSettings($user, $body);
        return $this->success($response, $data, 'Expense settings updated successfully');
    }

    public function approveSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->approveSchoolExpense($user, $id);
        return $this->success($response, $data, 'School expense approved successfully');
    }

    public function rejectSchoolExpense(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->rejectSchoolExpense($user, $id);
        return $this->success($response, $data, 'School expense rejected successfully');
    }

    public function getDiscountSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'STAFF']);

        $data = $this->service->getDiscountSettings($user);
        return $this->success($response, $data);
    }

    public function updateDiscountSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->updateDiscountSettings($user, $body);
        return $this->success($response, $data, 'Discount settings updated successfully');
    }

    public function getDiscountRequests(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'STAFF']);

        $params = $request->getQueryParams();
        $data = $this->service->getDiscountRequests($user, $params);
        return $this->success($response, $data);
    }

    public function createDiscountRequest(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'STAFF']);

        $body = RequestParser::body($request);
        $data = $this->service->createDiscountRequest($user, $body);
        return $this->success($response, $data, 'Discount request submitted successfully', 201);
    }

    public function approveDiscountRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $data = $this->service->approveDiscountRequest($user, $id);
        return $this->success($response, $data, 'Discount request approved successfully');
    }

    public function rejectDiscountRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->rejectDiscountRequest($user, $id, $body);
        return $this->success($response, $data, 'Discount request rejected successfully');
    }

    public function cancelDiscountRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'TEACHER', 'PRINCIPAL', 'STAFF']);

        $id = (int)$args['id'];
        $data = $this->service->cancelDiscountRequest($user, $id);
        return $this->success($response, $data, 'Discount request cancelled successfully');
    }

    public function getPendingFinancialReportCount(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);

        $stats = $this->service->getPendingFinancialReportBadgeStats($user);
        return $this->success($response, $stats);
    }

    public function getPendingExpenseCount(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $stats = $this->service->getPendingExpenseBadgeStats($user);
        return $this->success($response, $stats);
    }

    public function markFeatureBadgeSeen(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER', 'PRINCIPAL', 'STAFF']);

        $body = RequestParser::body($request);
        $featureKey = (string)($body['feature_key'] ?? $body['feature'] ?? '');
        $maxId = isset($body['max_id']) ? (int)$body['max_id'] : null;

        $data = $this->service->markFeatureBadgeSeen($user, $featureKey, $maxId);
        return $this->success($response, $data, 'Feature badge marked as seen');
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

    public function createAnnualFee(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->createAnnualFee($user, $body);

        return $this->success($response, $data, 'Annual Fee created successfully.', 201);
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
        $body = $request->getParsedBody() ?? [];
        $data = $this->service->collectAdditionalFeePayment($user, $id, $body);

        return $this->success($response, $data, 'Additional fee payment collected successfully');
    }

    public function revertAdditionalFeePayment(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $otpCode = !empty($body['otp_code']) ? trim((string)$body['otp_code']) : (string)($request->getQueryParams()['otp_code'] ?? '');
        $data = $this->service->revertAdditionalFeePayment($user, $id, $otpCode);

        return $this->success($response, $data, 'Additional fee payment reverted successfully');
    }

    public function getTransportFees(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $params = $request->getQueryParams();
        $status = $params['status'] ?? 'All';

        $data = $this->service->getTransportFees($user, $status);

        return $this->success($response, $data);
    }

    public function assignTransportFee(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body = RequestParser::body($request);
        $data = $this->service->assignTransportFee($user, $body);

        return $this->success($response, $data, 'Transport fee assigned successfully', 201);
    }

    public function updateTransportFee(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $data = $this->service->updateTransportFee($user, $id, $body);

        return $this->success($response, $data, 'Transport fee updated successfully');
    }

    public function deleteTransportFee(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->deleteTransportFee($user, $id);

        return $this->success($response, $data, 'Transport fee deleted successfully');
    }

    public function toggleTransportFeeStatus(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $status = $body['status'] ?? 'Active';
        $data = $this->service->toggleTransportFeeStatus($user, $id, $status);

        return $this->success($response, $data, 'Transport fee status updated successfully');
    }

    public function getExamInstructions(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $data = $this->service->getExamInstructions($user, $examId, $classId);
        return $this->success($response, $data);
    }

    public function saveExamInstructions(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $params = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $body = RequestParser::body($request);
        $this->service->saveExamInstructions($user, $examId, $classId, $body);
        return $this->success($response, null, 'Examination instructions saved successfully');
    }

    public function previewSeatingPlan(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->previewSeatingPlan($user, $examId, $body);
        return $this->success($response, $data);
    }

    public function generateSeatingPlan(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->generateSeatingPlan($user, $examId, $body);
        return $this->success($response, $data, 'Seating plan generated successfully');
    }

    public function getSeatingPlan(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $data = $this->service->getSeatingPlan($user, $examId);
        return $this->success($response, $data);
    }

    public function deleteSeatingPlan(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $examId = (int)$args['id'];
        $data = $this->service->deleteSeatingPlan($user, $examId);
        return $this->success($response, $data, 'Seating plan deleted successfully');
    }

    public function getSchoolAuditLogs(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $params = $request->getQueryParams();
        $data = $this->service->getSchoolAuditLogs($user, $params);
        return $this->success($response, $data);
    }

    public function logClientAuditAction(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $body = RequestParser::body($request);
        RequestParser::required($body, ['module', 'action', 'description']);
        $this->service->logClientAudit($user, $body);
        return $this->success($response, null, 'Client action logged successfully');
    }

    public function getSchoolLoginHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $params = $request->getQueryParams();
        $data = $this->service->getSchoolLoginHistory($user, $params);
        return $this->success($response, $data);
    }

    public function getFeeFollowUps(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $params = $request->getQueryParams();
        $data = $this->service->getFeeFollowUps($user, $params);
        return $this->success($response, $data);
    }

    public function createFeeFollowUp(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $body = RequestParser::body($request);
        $data = $this->service->createFeeFollowUp($user, $body);
        return $this->success($response, $data, 'Fee follow-up saved successfully', 201);
    }

    public function getFeeFollowUpDetails(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $data = $this->service->getFeeFollowUpDetails($user, $id);
        return $this->success($response, $data);
    }

    public function updateFeeFollowUp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateFeeFollowUp($user, $id, $body);
        return $this->success($response, $data, 'Fee follow-up updated successfully');
    }

    public function extendFeeFollowUp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->extendFeeFollowUp($user, $id, $body);
        return $this->success($response, $data, 'Fee commitment extended successfully');
    }

    public function updateFeeFollowUpStatus(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateFeeFollowUpStatus($user, $id, $body);
        return $this->success($response, $data, 'Fee follow-up status updated successfully');
    }

    public function deleteFeeFollowUp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $data = $this->service->deleteFeeFollowUp($user, $id);
        return $this->success($response, $data, 'Fee follow-up deleted successfully');
    }

    public function addFollowUpNote(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->addFollowUpNote($user, $id, $body);
        return $this->success($response, $data, 'Note added successfully');
    }

    public function markFollowUpContacted(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->markFollowUpContacted($user, $id, $body);
        return $this->success($response, $data, 'Marked as contacted');
    }

    public function getStudentOutstandingFee(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $studentId = (int)$args['id'];
        $data = $this->service->getStudentOutstandingFee($user, $studentId);
        return $this->success($response, $data);
    }

    public function getStudentFollowUps(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $studentId = (int)$args['id'];
        $data = $this->service->getStudentFollowUps($user, $studentId);
        return $this->success($response, $data);
    }

    public function getStudentActiveFollowUp(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $studentId = (int)$args['id'];
        $data = $this->service->getStudentActiveFollowUp($user, $studentId);
        return $this->success($response, $data);
    }

    public function getNotifications(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $queryParams = $request->getQueryParams();
        $data = $this->service->getNotifications($user, $queryParams);
        return $this->success($response, $data);
    }

    public function markNotificationRead(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $data = $this->service->markNotificationRead($user, $id, $body);
        return $this->success($response, $data, 'Notification marked as read');
    }

    public function deleteNotification(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $id = (int)$args['id'];
        $data = $this->service->deleteNotification($user, $id);
        return $this->success($response, $data, 'Notification deleted successfully');
    }

    public function getCredentials(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $role = $args['role'] ?? '';
        $id = (int)($args['id'] ?? 0);

        $data = $this->service->getCredentials($user, $role, $id);

        return $this->success($response, $data);
    }

    public function generateCredentials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireStaffAccess($user);

        $body = RequestParser::body($request);
        $result = $this->service->generateCredentials($user, $body);

        return $this->success($response, $result, 'Credentials updated successfully.');
    }

    public function getAnnouncements(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);
        $data = $this->service->getAnnouncements($user);
        return $this->success($response, $data);
    }

    public function createAnnouncement(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);
        $body = RequestParser::body($request);
        $data = $this->service->createAnnouncement($user, $body);
        return $this->success($response, $data, 'Announcement published successfully');
    }

    public function uploadAnnouncementAudio(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No audio file uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->error($response, 'Audio upload failed with error code: ' . $uploadedFile->getError(), 400);
        }

        if ($uploadedFile->getSize() > 25 * 1024 * 1024) {
            return $this->error($response, 'Audio file exceeds the maximum 25MB limit', 400);
        }

        $res = $this->service->handleFileUpload($uploadedFile, \App\Shared\Storage\StorageService::CATEGORY_DOCUMENTS);
        return $this->success($response, ['audio_url' => $res], 'Audio uploaded successfully');
    }

    public function updateAnnouncement(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);
        $id = (int)$args['id'];
        $body = RequestParser::body($request);
        $data = $this->service->updateAnnouncement($user, $id, $body);
        return $this->success($response, $data, 'Announcement updated successfully');
    }

    public function deleteAnnouncement(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);
        $id = (int)$args['id'];
        $data = $this->service->deleteAnnouncement($user, $id);
        return $this->success($response, $data, 'Announcement deleted successfully');
    }

    public function getLatePaymentPenaltyStats(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $data = $this->service->getLatePaymentPenaltyStats($user);
        return $this->success($response, $data);
    }

    public function getLatePaymentPenaltyConfig(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $data = $this->service->getLatePaymentPenaltyConfig($user);
        return $this->success($response, $data);
    }

    public function saveLatePaymentPenaltyConfig(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $body = RequestParser::body($request);
        $data = $this->service->saveLatePaymentPenaltyConfig($user, $body);
        return $this->success($response, $data, 'Late payment penalty configuration saved successfully.');
    }

    public function deleteLatePaymentPenaltyConfig(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $data = $this->service->deleteLatePaymentPenaltyConfig($user);
        return $this->success($response, $data, 'Late payment penalty configuration removed successfully.');
    }

    public function checkLatePaymentPenaltyConfig(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $data = $this->service->checkLatePaymentPenaltyConfig($user);
        return $this->success($response, $data);
    }

    public function getFinanceSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $data = $this->service->getFinanceSettings($user);
        return $this->success($response, $data);
    }

    public function saveFinanceSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $body = RequestParser::body($request);
        $data = $this->service->saveFinanceSettings($user, $body);
        return $this->success($response, $data, 'School finance settings saved successfully.');
    }

    public function getLatePaymentPenaltyHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireFeeCollectorAccess($user);
        $filters = $request->getQueryParams();
        $data = $this->service->getLatePaymentPenaltyHistory($user, $filters);
        return $this->success($response, $data);
    }

    /**
     * Same-origin media proxy, used by the ID-card PDF export.
     *
     * html2canvas can only rasterise images the page is allowed to read. On S3
     * the photos come from a different origin with no CORS headers, so the
     * canvas is tainted and the profile photo drops out of the PDF — which is
     * why the browser preview looked fine but the download did not. Reading the
     * bytes here and handing them back from our own origin sidesteps CORS
     * entirely, and works for private buckets too since the S3 GET is signed.
     */
    public function streamMedia(Request $request, Response $response): Response
    {
        $this->authenticate($request);

        $rawUrl = trim($request->getQueryParams()['url'] ?? '');
        if ($rawUrl === '') {
            return $this->error($response, 'URL parameter is required', 400);
        }

        // Only ever read back media this application itself stored, otherwise
        // the endpoint is an open proxy into the private network (SSRF).
        if (!$this->service->isOwnMedia($rawUrl)) {
            return $this->error($response, 'Unsupported media URL', 400);
        }

        $contents = $this->service->getMediaContents($rawUrl);
        if ($contents === null || $contents === '') {
            return $this->error($response, 'Media file could not be retrieved', 404);
        }

        $response->getBody()->write($contents);

        return $response
            ->withHeader('Content-Type', $this->service->mediaContentType($rawUrl))
            ->withHeader('Content-Length', (string)strlen($contents))
            // Per-user media behind an auth check: cacheable by the browser
            // that asked for it, never by a shared proxy.
            ->withHeader('Cache-Control', 'private, max-age=3600')
            ->withHeader('X-Content-Type-Options', 'nosniff');
    }

    /**
     * Base64 variant of streamMedia(), kept for callers that need a data: URL
     * inline rather than a fetchable URL.
     */
    public function getMediaBase64(Request $request, Response $response): Response
    {
        $this->authenticate($request);

        $rawUrl = trim($request->getQueryParams()['url'] ?? '');
        if ($rawUrl === '') {
            return $this->error($response, 'URL parameter is required', 400);
        }

        if (!$this->service->isOwnMedia($rawUrl)) {
            return $this->error($response, 'Unsupported media URL', 400);
        }

        $contents = $this->service->getMediaContents($rawUrl);
        if ($contents === null || $contents === '') {
            return $this->error($response, 'Media file could not be retrieved', 404);
        }

        $mimeType = $this->service->mediaContentType($rawUrl);
        $dataUrl  = 'data:' . $mimeType . ';base64,' . base64_encode($contents);

        return $this->success($response, ['data_url' => $dataUrl]);
    }

    // ---------------------------------------------------------------------
    // Account deletion requests (PF-04)
    // ---------------------------------------------------------------------

    public function getAccountDeletionRequests(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $data = $this->service->getAccountDeletionRequests($user, $request->getQueryParams());

        return $this->success($response, $data);
    }

    public function resolveAccountDeletionRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);

        $body   = (array)($request->getParsedBody() ?? []);
        $action = (string)($body['action'] ?? '');
        $note   = trim((string)($body['note'] ?? ''));

        $data = $this->service->resolveAccountDeletionRequest(
            $user,
            (int)$args['id'],
            $action,
            $note !== '' ? $note : null
        );

        $message = $data['status'] === 'COMPLETED'
            ? 'Account erased and the request closed.'
            : 'Request rejected.';

        return $this->success($response, $data, $message);
    }

    // ---------------------------------------------------------------------
    // Teacher Attendance
    // ---------------------------------------------------------------------

    public function getTeacherAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $params = $request->getQueryParams();
        $date = $params['date'] ?? date('Y-m-d');

        $data = $this->teacherAttendanceService->getDailyAttendance($user, $date);

        return $this->success($response, $data);
    }

    public function markTeacherAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $body = RequestParser::body($request);
        $data = $this->teacherAttendanceService->markTeacherAttendanceByAdmin($user, $body);

        return $this->success($response, $data, 'Teacher attendance updated successfully');
    }

    public function getTeacherAttendanceReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $params = $request->getQueryParams();
        $month = isset($params['month']) ? (int)$params['month'] : (int)date('n');
        $year = isset($params['year']) ? (int)$params['year'] : (int)date('Y');

        $data = $this->teacherAttendanceService->getMonthlyReport($user, $month, $year);

        return $this->success($response, $data);
    }

    public function getTeacherAttendanceSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $data = $this->teacherAttendanceService->getSettings($user);

        return $this->success($response, $data);
    }

    public function saveTeacherAttendanceSettings(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $body = RequestParser::body($request);
        $data = $this->teacherAttendanceService->saveSettings($user, $body);

        return $this->success($response, $data, 'Teacher attendance settings saved successfully');
    }

    public function getTeacherAttendanceQrToken(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $data = $this->teacherAttendanceService->getQrToken($user);

        return $this->success($response, $data);
    }

    public function refreshTeacherAttendanceQrToken(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $data = $this->teacherAttendanceService->refreshQrToken($user);

        return $this->success($response, $data, 'QR code regenerated successfully');
    }

    public function checkLateTeacherAlerts(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $body = RequestParser::body($request);
        $schoolId = (int)($user['school_id'] ?? 0);
        $force = !empty($body['force']);

        $data = $this->teacherAttendanceService->checkAndSendLateTeachersAlert($schoolId, $force);

        return $this->success($response, $data, 'Late teacher alert check processed');
    }

    // -------------------------------------------------------------------------
    // Report Card Templates & Preview APIs
    // -------------------------------------------------------------------------

    public function getReportCardTemplates(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $schoolProfile = $this->service->getSchoolProfile($user);
        $currentThemeKey = $schoolProfile['report_card_color_theme'] ?? 'ocean_teal';

        $templates = [
            [
                'key' => 'classic',
                'name' => 'Classic Slate (Default)',
                'displayName' => 'Classic CBSE Slate',
                'templateCode' => 'cbse_classic',
                'templateId' => 2,
                'hexCode' => '#18181b',
                'subtitle' => 'Original formal CBSE format with classic monochrome slate styling and dual accent summary cards.',
                'tag' => 'Formal Monochrome',
                'badgeClass' => 'bg-zinc-100 text-zinc-800 border-zinc-300',
                'swatches' => ['#18181b', '#3f3f46', '#059669', '#f4f4f5'],
                'isActive' => ($currentThemeKey === 'classic'),
            ],
            [
                'key' => 'royal_blue',
                'name' => 'Soft Sky Sapphire',
                'displayName' => 'Soft Sky Sapphire',
                'templateCode' => 'cbse_royal_blue',
                'templateId' => 5,
                'hexCode' => '#38bdf8',
                'subtitle' => 'Light pastel sky blue double border with gentle ice-blue tables and crystal accents.',
                'tag' => 'Sky & Azure Pastel',
                'badgeClass' => 'bg-sky-50 text-sky-800 border-sky-200',
                'swatches' => ['#38bdf8', '#7dd3fc', '#bae6fd', '#f0f9ff'],
                'isActive' => ($currentThemeKey === 'royal_blue'),
            ],
            [
                'key' => 'emerald_green',
                'name' => 'Soft Sage Mint',
                'displayName' => 'Soft Sage Mint',
                'templateCode' => 'cbse_emerald_green',
                'templateId' => 6,
                'hexCode' => '#34d399',
                'subtitle' => 'Light botanical pastel mint double border with delicate sage headers and fresh highlights.',
                'tag' => 'Sage & Mint Pastel',
                'badgeClass' => 'bg-emerald-50 text-emerald-800 border-emerald-200',
                'swatches' => ['#34d399', '#6ee7b7', '#a7f3d0', '#ecfdf5'],
                'isActive' => ($currentThemeKey === 'emerald_green'),
            ],
            [
                'key' => 'warm_amber',
                'name' => 'Soft Peach Amber',
                'displayName' => 'Soft Peach Amber',
                'templateCode' => 'cbse_warm_amber',
                'templateId' => 7,
                'hexCode' => '#fb923c',
                'subtitle' => 'Light peach and apricot double border with warm biscuit tinting and honey accents.',
                'tag' => 'Peach & Honey Pastel',
                'badgeClass' => 'bg-amber-50 text-amber-800 border-amber-200',
                'swatches' => ['#fb923c', '#fdba74', '#fed7aa', '#fff7ed'],
                'isActive' => ($currentThemeKey === 'warm_amber'),
            ],
            [
                'key' => 'burgundy_plum',
                'name' => 'Soft Rose Plum',
                'displayName' => 'Soft Rose Plum',
                'templateCode' => 'cbse_burgundy_plum',
                'templateId' => 8,
                'hexCode' => '#f472b6',
                'subtitle' => 'Light blush rose double border with delicate mauve styling and soft lavender highlights.',
                'tag' => 'Blush & Rose Pastel',
                'badgeClass' => 'bg-pink-50 text-pink-800 border-pink-200',
                'swatches' => ['#f472b6', '#f9a8d4', '#fbcfe8', '#fdf2f8'],
                'isActive' => ($currentThemeKey === 'burgundy_plum'),
            ],
            [
                'key' => 'ocean_teal',
                'name' => 'Dark Black',
                'displayName' => 'Dark Black',
                'templateCode' => 'cbse_ocean_teal',
                'templateId' => 9,
                'hexCode' => '#000000',
                'subtitle' => 'Report card in exact Manage Finance container color (#FAFAFA) with crisp dark black borders on all tables.',
                'tag' => 'Dark Black',
                'badgeClass' => 'bg-[#fafafa] text-black border-black/40',
                'swatches' => ['#000000', '#fafafa', '#27272a', '#fafafa'],
                'isActive' => ($currentThemeKey === 'ocean_teal'),
            ],
        ];

        return $this->success($response, [
            'templates' => $templates,
            'currentTheme' => $currentThemeKey,
        ]);
    }

    public function selectReportCardTemplate(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN', 'PRINCIPAL']);

        $body = RequestParser::body($request);
        $themeKey = trim((string)($body['theme'] ?? $body['report_card_color_theme'] ?? 'classic'));
        $templateId = (int)($body['template_id'] ?? 2);

        $templateMap = [
            'classic' => 2,
            'royal_blue' => 5,
            'emerald_green' => 6,
            'warm_amber' => 7,
            'burgundy_plum' => 8,
            'ocean_teal' => 9,
        ];
        if (isset($templateMap[$themeKey])) {
            $templateId = $templateMap[$themeKey];
        }

        $profile = $this->service->updateSchoolProfile($user, [
            'report_card_color_theme' => $themeKey,
            'report_card_template_id' => $templateId,
        ]);

        return $this->success($response, $profile, "Report card template updated successfully.");
    }

    public function getReportCardTemplatePreviewHtml(Request $request, Response $response, array $args): Response
    {
        $themeKey = strtolower(trim((string)($args['theme'] ?? 'ocean_teal')));
        $queryParams = $request->getQueryParams();
        $schoolName = !empty($queryParams['school_name']) ? htmlspecialchars($queryParams['school_name']) : 'SPLENDID PUBLIC SCHOOL';
        $schoolAddress = !empty($queryParams['school_address']) ? htmlspecialchars($queryParams['school_address']) : 'MAIN CAMPUS, CIVIL LINES';

        $themesConfig = [
            'classic' => [
                'outerBorder' => '6px double #18181b',
                'cardBg' => '#ffffff',
                'headerBorder' => '2px solid #18181b',
                'schoolLogoBorder' => '2px solid #18181b',
                'schoolLogoText' => '#18181b',
                'schoolNameText' => '#18181b',
                'schoolAddressText' => '#52525b',
                'examBannerBorder' => '1px solid #27272a',
                'examBannerBg' => '#f4f4f5',
                'examBannerText' => '#18181b',
                'studentTableBorder' => '1px solid #a1a1aa',
                'studentLabelBg' => '#f4f4f5',
                'studentCellBorder' => '1px solid #d4d4d8',
                'studentValueText' => '#18181b',
                'marksTableBorder' => '1.5px solid #27272a',
                'marksHeaderBg1' => '#27272a',
                'marksHeaderBg2' => '#3f3f46',
                'marksHeaderTextColor1' => '#ffffff',
                'marksHeaderTextColor2' => '#ffffff',
                'marksDivider' => '1px solid #3f3f46',
                'marksSubDivider' => '1px solid #52525b',
                'marksCellBorder' => '1px solid #d4d4d8',
                'marksCellText' => '#18181b',
                'marksTotalRowBg' => '#f4f4f5',
                'marksTotalRowBorder' => '2px solid #27272a',
                'statTotalBg' => '#ecfdf5', 'statTotalBorder' => '#a7f3d0', 'statTotalText' => '#064e3b',
                'statPercentageBg' => '#fffbeb', 'statPercentageBorder' => '#fde68a', 'statPercentageText' => '#78350f',
                'statGradeBg' => '#ecfdf5', 'statGradeBorder' => '#a7f3d0', 'statGradeText' => '#064e3b',
                'statAttendanceBg' => '#fffbeb', 'statAttendanceBorder' => '#fde68a', 'statAttendanceText' => '#78350f',
                'statRankBg' => '#ecfdf5', 'statRankBorder' => '#a7f3d0', 'statRankText' => '#064e3b',
                'remarksLabel' => '#18181b', 'remarksText' => '#047857',
                'signatureBorder' => '1.5px solid #27272a', 'signatureText' => '#27272a',
            ],
            'royal_blue' => [
                'outerBorder' => '6px double #38bdf8',
                'cardBg' => '#ffffff',
                'headerBorder' => '2px solid #7dd3fc',
                'schoolLogoBorder' => '2px solid #38bdf8',
                'schoolLogoText' => '#075985',
                'schoolNameText' => '#082f49',
                'schoolAddressText' => '#64748b',
                'examBannerBorder' => '1px solid #bae6fd',
                'examBannerBg' => '#f0f9ff',
                'examBannerText' => '#0c4a6e',
                'studentTableBorder' => '1px solid #bae6fd',
                'studentLabelBg' => '#f0f9ff',
                'studentCellBorder' => '1px solid #e0f2fe',
                'studentValueText' => '#1e293b',
                'marksTableBorder' => '1.5px solid #7dd3fc',
                'marksHeaderBg1' => '#e0f2fe',
                'marksHeaderBg2' => '#f0f9ff',
                'marksHeaderTextColor1' => '#082f49',
                'marksHeaderTextColor2' => '#0c4a6e',
                'marksDivider' => '1px solid #bae6fd',
                'marksSubDivider' => '1px solid #bae6fd',
                'marksCellBorder' => '1px solid #e0f2fe',
                'marksCellText' => '#1e293b',
                'marksTotalRowBg' => '#f0f9ff',
                'marksTotalRowBorder' => '2px solid #7dd3fc',
                'statTotalBg' => '#f0f9ff', 'statTotalBorder' => '#bae6fd', 'statTotalText' => '#082f49',
                'statPercentageBg' => '#eff6ff', 'statPercentageBorder' => '#bfdbfe', 'statPercentageText' => '#172554',
                'statGradeBg' => '#f0f9ff', 'statGradeBorder' => '#bae6fd', 'statGradeText' => '#082f49',
                'statAttendanceBg' => '#eff6ff', 'statAttendanceBorder' => '#bfdbfe', 'statAttendanceText' => '#172554',
                'statRankBg' => '#f0f9ff', 'statRankBorder' => '#bae6fd', 'statRankText' => '#082f49',
                'remarksLabel' => '#082f49', 'remarksText' => '#0369a1',
                'signatureBorder' => '1.5px solid #7dd3fc', 'signatureText' => '#0c4a6e',
            ],
            'emerald_green' => [
                'outerBorder' => '6px double #34d399',
                'cardBg' => '#ffffff',
                'headerBorder' => '2px solid #6ee7b7',
                'schoolLogoBorder' => '2px solid #34d399',
                'schoolLogoText' => '#065f46',
                'schoolNameText' => '#022c22',
                'schoolAddressText' => '#64748b',
                'examBannerBorder' => '1px solid #a7f3d0',
                'examBannerBg' => '#ecfdf5',
                'examBannerText' => '#064e3b',
                'studentTableBorder' => '1px solid #a7f3d0',
                'studentLabelBg' => '#ecfdf5',
                'studentCellBorder' => '1px solid #d1fae5',
                'studentValueText' => '#1e293b',
                'marksTableBorder' => '1.5px solid #6ee7b7',
                'marksHeaderBg1' => '#d1fae5',
                'marksHeaderBg2' => '#ecfdf5',
                'marksHeaderTextColor1' => '#064e3b',
                'marksHeaderTextColor2' => '#065f46',
                'marksDivider' => '1px solid #a7f3d0',
                'marksSubDivider' => '1px solid #a7f3d0',
                'marksCellBorder' => '1px solid #d1fae5',
                'marksCellText' => '#1e293b',
                'marksTotalRowBg' => '#ecfdf5',
                'marksTotalRowBorder' => '2px solid #6ee7b7',
                'statTotalBg' => '#ecfdf5', 'statTotalBorder' => '#a7f3d0', 'statTotalText' => '#064e3b',
                'statPercentageBg' => '#f0fdfa', 'statPercentageBorder' => '#99f6e4', 'statPercentageText' => '#134e4a',
                'statGradeBg' => '#ecfdf5', 'statGradeBorder' => '#a7f3d0', 'statGradeText' => '#064e3b',
                'statAttendanceBg' => '#f0fdfa', 'statAttendanceBorder' => '#99f6e4', 'statAttendanceText' => '#134e4a',
                'statRankBg' => '#ecfdf5', 'statRankBorder' => '#a7f3d0', 'statRankText' => '#064e3b',
                'remarksLabel' => '#022c22', 'remarksText' => '#047857',
                'signatureBorder' => '1.5px solid #6ee7b7', 'signatureText' => '#064e3b',
            ],
            'warm_amber' => [
                'outerBorder' => '6px double #fb923c',
                'cardBg' => '#ffffff',
                'headerBorder' => '2px solid #fcd34d',
                'schoolLogoBorder' => '2px solid #fbbf24',
                'schoolLogoText' => '#92400e',
                'schoolNameText' => '#451a03',
                'schoolAddressText' => '#64748b',
                'examBannerBorder' => '1px solid #fde68a',
                'examBannerBg' => '#fef3c7',
                'examBannerText' => '#78350f',
                'studentTableBorder' => '1px solid #fde68a',
                'studentLabelBg' => '#fef3c7',
                'studentCellBorder' => '1px solid #fef3c7',
                'studentValueText' => '#1e293b',
                'marksTableBorder' => '1.5px solid #fcd34d',
                'marksHeaderBg1' => '#fef3c7',
                'marksHeaderBg2' => '#fffbeb',
                'marksHeaderTextColor1' => '#78350f',
                'marksHeaderTextColor2' => '#92400e',
                'marksDivider' => '1px solid #fde68a',
                'marksSubDivider' => '1px solid #fde68a',
                'marksCellBorder' => '1px solid #fef3c7',
                'marksCellText' => '#1e293b',
                'marksTotalRowBg' => '#fef3c7',
                'marksTotalRowBorder' => '2px solid #fcd34d',
                'statTotalBg' => '#fef3c7', 'statTotalBorder' => '#fde68a', 'statTotalText' => '#78350f',
                'statPercentageBg' => '#fff7ed', 'statPercentageBorder' => '#fed7aa', 'statPercentageText' => '#7c2d12',
                'statGradeBg' => '#fef3c7', 'statGradeBorder' => '#fde68a', 'statGradeText' => '#78350f',
                'statAttendanceBg' => '#fff7ed', 'statAttendanceBorder' => '#fed7aa', 'statAttendanceText' => '#7c2d12',
                'statRankBg' => '#fef3c7', 'statRankBorder' => '#fde68a', 'statRankText' => '#78350f',
                'remarksLabel' => '#451a03', 'remarksText' => '#b45309',
                'signatureBorder' => '1.5px solid #fcd34d', 'signatureText' => '#78350f',
            ],
            'burgundy_plum' => [
                'outerBorder' => '6px double #f472b6',
                'cardBg' => '#ffffff',
                'headerBorder' => '2px solid #f9a8d4',
                'schoolLogoBorder' => '2px solid #f472b6',
                'schoolLogoText' => '#9d174d',
                'schoolNameText' => '#500724',
                'schoolAddressText' => '#64748b',
                'examBannerBorder' => '1px solid #fbcfe8',
                'examBannerBg' => '#fdf2f8',
                'examBannerText' => '#831843',
                'studentTableBorder' => '1px solid #fbcfe8',
                'studentLabelBg' => '#fdf2f8',
                'studentCellBorder' => '1px solid #fce7f3',
                'studentValueText' => '#1e293b',
                'marksTableBorder' => '1.5px solid #f9a8d4',
                'marksHeaderBg1' => '#fce7f3',
                'marksHeaderBg2' => '#fdf2f8',
                'marksHeaderTextColor1' => '#831843',
                'marksHeaderTextColor2' => '#9d174d',
                'marksDivider' => '1px solid #fbcfe8',
                'marksSubDivider' => '1px solid #fbcfe8',
                'marksCellBorder' => '1px solid #fce7f3',
                'marksCellText' => '#1e293b',
                'marksTotalRowBg' => '#fdf2f8',
                'marksTotalRowBorder' => '2px solid #f9a8d4',
                'statTotalBg' => '#fdf2f8', 'statTotalBorder' => '#fbcfe8', 'statTotalText' => '#831843',
                'statPercentageBg' => '#faf5ff', 'statPercentageBorder' => '#e9d5ff', 'statPercentageText' => '#581c87',
                'statGradeBg' => '#fdf2f8', 'statGradeBorder' => '#fbcfe8', 'statGradeText' => '#831843',
                'statAttendanceBg' => '#faf5ff', 'statAttendanceBorder' => '#e9d5ff', 'statAttendanceText' => '#581c87',
                'statRankBg' => '#fdf2f8', 'statRankBorder' => '#fbcfe8', 'statRankText' => '#831843',
                'remarksLabel' => '#500724', 'remarksText' => '#be185d',
                'signatureBorder' => '1.5px solid #f9a8d4', 'signatureText' => '#831843',
            ],
            'ocean_teal' => [
                'outerBorder' => '6px double #000000',
                'cardBg' => '#fafafa',
                'headerBorder' => '2px solid #000000',
                'schoolLogoBorder' => '2px solid #000000',
                'schoolLogoText' => '#000000',
                'schoolNameText' => '#000000',
                'schoolAddressText' => '#27272a',
                'examBannerBorder' => '2px solid #000000',
                'examBannerBg' => '#f4f4f5',
                'examBannerText' => '#000000',
                'studentTableBorder' => '2px solid #000000',
                'studentLabelBg' => '#f4f4f5',
                'studentCellBorder' => '1px solid #000000',
                'studentValueText' => '#000000',
                'marksTableBorder' => '2px solid #000000',
                'marksHeaderBg1' => '#e4e4e7',
                'marksHeaderBg2' => '#f4f4f5',
                'marksHeaderTextColor1' => '#000000',
                'marksHeaderTextColor2' => '#000000',
                'marksDivider' => '1px solid #000000',
                'marksSubDivider' => '1px solid #000000',
                'marksCellBorder' => '1px solid #000000',
                'marksCellText' => '#000000',
                'marksTotalRowBg' => '#e4e4e7',
                'marksTotalRowBorder' => '2px solid #000000',
                'statTotalBg' => '#f4f4f5', 'statTotalBorder' => '2px solid #000000', 'statTotalText' => '#000000',
                'statPercentageBg' => '#f4f4f5', 'statPercentageBorder' => '2px solid #000000', 'statPercentageText' => '#000000',
                'statGradeBg' => '#f4f4f5', 'statGradeBorder' => '2px solid #000000', 'statGradeText' => '#000000',
                'statAttendanceBg' => '#f4f4f5', 'statAttendanceBorder' => '2px solid #000000', 'statAttendanceText' => '#000000',
                'statRankBg' => '#f4f4f5', 'statRankBorder' => '2px solid #000000', 'statRankText' => '#000000',
                'remarksLabel' => '#000000', 'remarksText' => '#000000',
                'signatureBorder' => '2px solid #000000', 'signatureText' => '#000000',
            ],
        ];

        $c = $themesConfig[$themeKey] ?? $themesConfig['ocean_teal'];

        $subjects = [
            ['English Language', 26, 27, 35, 27, 28, 37, 'A'],
            ['Hindi Literature', 25, 26, 34, 26, 27, 36, 'A'],
            ['Mathematics', 28, 29, 38, 29, 30, 39, 'A+'],
            ['Science & Technology', 27, 26, 36, 28, 28, 37, 'A'],
            ['Social Studies', 24, 25, 33, 25, 26, 35, 'B+'],
            ['Sanskrit', 26, 27, 36, 27, 27, 36, 'A'],
            ['Computer Applications', 29, 28, 39, 30, 29, 39, 'A+'],
            ['Environmental Studies', 25, 26, 35, 26, 27, 36, 'A'],
            ['General Knowledge', 27, 28, 37, 28, 29, 38, 'A'],
            ['Moral Science & Ethics', 28, 29, 38, 29, 29, 38, 'A+'],
        ];

        $rowsHtml = '';
        foreach ($subjects as $s) {
            $rowsHtml .= '<tr>';
            $rowsHtml .= '<td class="marks-td-sub">' . $s[0] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[1] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[2] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[3] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[4] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[5] . '</td>';
            $rowsHtml .= '<td class="marks-td-score">' . $s[6] . '</td>';
            $rowsHtml .= '<td class="marks-td-grade">' . $s[7] . '</td>';
            $rowsHtml .= '</tr>';
        }

        $html = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Report Card Template - ' . htmlspecialchars($themeKey) . '</title>
<style>
  @page {
    size: A4 portrait;
    margin: 4mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #ffffff;
  }
  .report-card-root {
    width: 202mm;
    min-height: 289mm;
    height: 289mm;
    margin: 0 auto;
    padding: 6mm 7mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: ' . $c['outerBorder'] . ';
    border-radius: 4px;
    background-color: ' . $c['cardBg'] . ';
    box-sizing: border-box;
  }
  .header-box {
    text-align: center;
    border-bottom: ' . $c['headerBorder'] . ';
    padding-bottom: 7px;
    margin-bottom: 4px;
  }
  .logo-box {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    margin: 0 auto 5px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 800;
    border: ' . $c['schoolLogoBorder'] . ';
    color: ' . $c['schoolLogoText'] . ';
  }
  .school-title {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 20px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.2;
    margin: 0;
    color: ' . $c['schoolNameText'] . ';
  }
  .school-address {
    font-size: 9.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 2px 0 6px 0;
    color: ' . $c['schoolAddressText'] . ';
  }
  .exam-banner {
    display: inline-block;
    padding: 4px 18px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-top: ' . $c['examBannerBorder'] . ';
    border-bottom: ' . $c['examBannerBorder'] . ';
    background-color: ' . $c['examBannerBg'] . ';
    color: ' . $c['examBannerText'] . ';
  }
  .student-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    border: ' . $c['studentTableBorder'] . ';
    margin-bottom: 6px;
  }
  .student-table td {
    padding: 5px 8px;
    border-bottom: ' . $c['studentCellBorder'] . ';
    vertical-align: middle;
  }
  .student-label {
    width: 18%;
    font-weight: 700;
    background-color: ' . $c['studentLabelBg'] . ';
    border-right: ' . $c['studentCellBorder'] . ';
    color: #1e293b;
    white-space: nowrap;
  }
  .student-val {
    width: 32%;
    font-weight: 700;
    color: ' . $c['studentValueText'] . ';
  }
  .student-val.right-border {
    border-right: ' . $c['studentCellBorder'] . ';
  }
  .marks-table-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
  }
  .marks-table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    border: ' . $c['marksTableBorder'] . ';
  }
  .marks-table th, .marks-table td {
    vertical-align: middle;
    box-sizing: border-box;
  }
  .marks-th-top {
    background-color: ' . $c['marksHeaderBg1'] . ';
    color: ' . $c['marksHeaderTextColor1'] . ';
    font-weight: 800;
    font-size: 10px;
    text-transform: uppercase;
    padding: 5px 6px;
    border-right: ' . $c['marksDivider'] . ';
  }
  .marks-th-sub {
    background-color: ' . $c['marksHeaderBg2'] . ';
    color: ' . $c['marksHeaderTextColor2'] . ';
    font-weight: 700;
    font-size: 7.5px;
    text-transform: uppercase;
    padding: 3px 2px;
    text-align: center;
    border-right: ' . $c['marksSubDivider'] . ';
  }
  .marks-td-sub {
    padding: 4.5px 7px;
    font-size: 9.5px;
    font-weight: 700;
    border-right: ' . $c['marksCellBorder'] . ';
    border-bottom: ' . $c['marksCellBorder'] . ';
    color: ' . $c['marksCellText'] . ';
  }
  .marks-td-score {
    padding: 4.5px 3px;
    font-size: 9.5px;
    font-family: monospace, sans-serif;
    font-weight: 700;
    text-align: center;
    border-right: ' . $c['marksCellBorder'] . ';
    border-bottom: ' . $c['marksCellBorder'] . ';
    color: ' . $c['marksCellText'] . ';
  }
  .marks-td-grade {
    padding: 4.5px 3px;
    font-size: 10.5px;
    font-weight: 800;
    text-align: center;
    border-bottom: ' . $c['marksCellBorder'] . ';
    color: ' . $c['marksCellText'] . ';
  }
  .marks-total-row {
    background-color: ' . $c['marksTotalRowBg'] . ';
    border-top: ' . $c['marksTotalRowBorder'] . ';
    font-weight: 800;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }
  .stat-card {
    padding: 5px 3px;
    border-radius: 4px;
    text-align: center;
  }
  .stat-title {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.9;
  }
  .stat-value {
    font-size: 11px;
    font-weight: 800;
    font-family: monospace, sans-serif;
    margin-top: 2px;
  }
  .remarks-box {
    font-size: 10.5px;
    line-height: 1.35;
    padding: 2px 4px;
    margin-bottom: 10px;
  }
  .remarks-label {
    font-weight: 800;
    color: ' . $c['remarksLabel'] . ';
  }
  .remarks-text {
    font-weight: 700;
    font-style: italic;
    color: ' . $c['remarksText'] . ';
  }
  .signatures-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 0 28px 4px 28px;
    margin-top: 16px;
  }
  .sig-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .sig-line {
    width: 155px;
    border-bottom: ' . $c['signatureBorder'] . ';
    margin-bottom: 5px;
  }
  .sig-text {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: ' . $c['signatureText'] . ';
  }
</style>
</head>
<body>
<div class="report-card-root">
  <div class="header-box">
    <div class="logo-box">' . substr($schoolName, 0, 1) . '</div>
    <h1 class="school-title">' . $schoolName . '</h1>
    <div class="school-address">' . $schoolAddress . '</div>
    <div class="exam-banner">FINAL ACADEMIC REPORT CARD (2026-2027)</div>
  </div>

  <table class="student-table">
    <tr>
      <td class="student-label">Student Name</td>
      <td class="student-val right-border">AARAV SHARMA</td>
      <td class="student-label">Class &amp; Sec</td>
      <td class="student-val">Class 5 (A)</td>
    </tr>
    <tr>
      <td class="student-label">Father\'s Name</td>
      <td class="student-val right-border">Vikram Sharma</td>
      <td class="student-label">Mother\'s Name</td>
      <td class="student-val">Meenakshi Sharma</td>
    </tr>
    <tr>
      <td class="student-label">Date of Birth</td>
      <td class="student-val right-border">12/04/2016</td>
      <td class="student-label">Roll / SR No</td>
      <td class="student-val">01 | SR-2026-104</td>
    </tr>
  </table>

  <div class="marks-table-container">
    <table class="marks-table">
      <thead>
        <tr>
          <th rowspan="2" class="marks-th-top" style="text-align: left; width: 28%;">Subject</th>
          <th colspan="3" class="marks-th-top" style="text-align: center;">First Term Examinations (100)</th>
          <th colspan="3" class="marks-th-top" style="text-align: center;">Second Term Examinations (100)</th>
          <th rowspan="2" class="marks-th-top" style="text-align: center; width: 10%;">Grade</th>
        </tr>
        <tr>
          <th class="marks-th-sub"><div>Unit Test 1</div><div style="font-size: 7px; opacity: 0.85;">(30)</div></th>
          <th class="marks-th-sub"><div>Unit Test 2</div><div style="font-size: 7px; opacity: 0.85;">(30)</div></th>
          <th class="marks-th-sub"><div>Unit Test 3</div><div style="font-size: 7px; opacity: 0.85;">(40)</div></th>
          <th class="marks-th-sub"><div>Unit Test 1</div><div style="font-size: 7px; opacity: 0.85;">(30)</div></th>
          <th class="marks-th-sub"><div>Unit Test 2</div><div style="font-size: 7px; opacity: 0.85;">(30)</div></th>
          <th class="marks-th-sub"><div>Unit Test 3</div><div style="font-size: 7px; opacity: 0.85;">(40)</div></th>
        </tr>
      </thead>
      <tbody>
        ' . $rowsHtml . '
        <tr class="marks-total-row">
          <td class="marks-td-sub" style="font-weight: 800;">Grand Total</td>
          <td class="marks-td-score" style="font-weight: 800;">265</td>
          <td class="marks-td-score" style="font-weight: 800;">270</td>
          <td class="marks-td-score" style="font-weight: 800;">364</td>
          <td class="marks-td-score" style="font-weight: 800;">275</td>
          <td class="marks-td-score" style="font-weight: 800;">280</td>
          <td class="marks-td-score" style="font-weight: 800;">368</td>
          <td class="marks-td-grade" style="font-weight: 800; font-size: 11.5px;">A+</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="stat-grid">
    <div class="stat-card" style="background: ' . $c['statTotalBg'] . '; border: 1px solid ' . $c['statTotalBorder'] . '; color: ' . $c['statTotalText'] . ';">
      <div class="stat-title">Total Marks</div>
      <div class="stat-value">1822 / 2000</div>
    </div>
    <div class="stat-card" style="background: ' . $c['statPercentageBg'] . '; border: 1px solid ' . $c['statPercentageBorder'] . '; color: ' . $c['statPercentageText'] . ';">
      <div class="stat-title">Percentage</div>
      <div class="stat-value">91.1%</div>
    </div>
    <div class="stat-card" style="background: ' . $c['statGradeBg'] . '; border: 1px solid ' . $c['statGradeBorder'] . '; color: ' . $c['statGradeText'] . ';">
      <div class="stat-title">Overall Grade</div>
      <div class="stat-value">Grade A+</div>
    </div>
    <div class="stat-card" style="background: ' . $c['statAttendanceBg'] . '; border: 1px solid ' . $c['statAttendanceBorder'] . '; color: ' . $c['statAttendanceText'] . ';">
      <div class="stat-title">Attendance</div>
      <div class="stat-value">96%</div>
    </div>
    <div class="stat-card" style="background: ' . $c['statRankBg'] . '; border: 1px solid ' . $c['statRankBorder'] . '; color: ' . $c['statRankText'] . ';">
      <div class="stat-title">Class Rank</div>
      <div class="stat-value">1</div>
    </div>
  </div>

  <div class="remarks-box">
    <strong class="remarks-label">Teacher Remarks:</strong>
    <span class="remarks-text">Outstanding academic performance throughout the session! Demonstrates exemplary dedication, discipline, and leadership.</span>
  </div>

  <div class="signatures-row">
    <div class="sig-col">
      <div class="sig-line"></div>
      <span class="sig-text">Class Teacher Signature</span>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <span class="sig-text">Principal Signature &amp; Stamp</span>
    </div>
  </div>
</div>
</body>
</html>';

        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html; charset=UTF-8');
    }
}
