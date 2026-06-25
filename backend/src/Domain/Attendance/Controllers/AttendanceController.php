<?php

namespace App\Domain\Attendance\Controllers;

use App\Shared\BaseController;
use App\Domain\Attendance\Services\AttendanceService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use PDO;

class AttendanceController extends BaseController
{
    public function __construct(
        private AttendanceService $attendanceService,
        private ?PDO $db = null
    ) {}

    private function getSchoolId(Request $request): ?int
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            if ($auth && isset($auth['school_id'])) {
                return (int)$auth['school_id'];
            }
        }
        return null;
    }

    private function getAuthUser(Request $request): ?array
    {
        if (function_exists('getAuthUser')) {
            return getAuthUser($request);
        }
        return null;
    }

    private function getAuthUserEmail(Request $request): string
    {
        $auth = $this->getAuthUser($request);
        if ($auth) {
            return $auth['email'] ?? $auth['phone'] ?? 'System';
        }
        return 'System';
    }

    private function getTeacherIdForUser(int $schoolId, string $emailOrPhone): ?int
    {
        $pdo = $this->db;
        if ($pdo === null || empty($emailOrPhone)) return null;
        $stmt = $pdo->prepare("SELECT id FROM teachers WHERE school_id = :sid AND (email = :input OR phone = :input) LIMIT 1");
        $stmt->execute(['sid' => $schoolId, 'input' => $emailOrPhone]);
        return $stmt->fetchColumn() ?: null;
    }

    private function getAuthorizedClassrooms(array $auth): ?array
    {
        $roleName = $auth['role'];
        if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
            return null; // Full admin access
        }
        
        $schoolId = (int)$auth['school_id'];
        $teacherId = $this->getTeacherIdForUser($schoolId, $auth['email'] ?? $auth['phone'] ?? '');
        
        if (!$teacherId) {
            return [];
        }
        
        $pdo = $this->db;
        if ($pdo === null) return null;

        $stmt = $pdo->prepare("SELECT id FROM classrooms WHERE school_id = :sid AND class_teacher_id = :tid");
        $stmt->execute(['sid' => $schoolId, 'tid' => $teacherId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /**
     * GET /api/attendance
     */
    public function getAttendance(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        $classId = (int)($params['class_id'] ?? 0);
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $groupName = $params['group_name'] ?? 'all';

        if (!$classId || !$ayId) {
            return $this->error($response, 'class_id and academic_year_id are required.', 400);
        }

        $date = $params['date'] ?? date('Y-m-d');

        try {
            $data = $this->attendanceService->getAttendance($schoolId, $classId, $date, $ayId, $groupName);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/attendance/bulk
     */
    public function saveBulkAttendance(Request $request, Response $response): Response
    {
        $auth = $this->getAuthUser($request);
        if (!$auth || !$auth['school_id']) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $schoolId = (int)$auth['school_id'];
        $data = $this->getJsonData($request);

        $classId = (int)($data['class_id'] ?? 0);
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $date = $data['date'] ?? date('Y-m-d');
        $studentsList = $data['students'] ?? [];

        if (!$classId || !$ayId || empty($studentsList)) {
            return $this->error($response, 'class_id, academic_year_id, and students list are required.', 400);
        }

        // Authorization check for Class Teachers
        if ($this->db !== null) {
            $allowedClasses = $this->getAuthorizedClassrooms($auth);
            if ($allowedClasses !== null && !in_array($classId, $allowedClasses)) {
                return $this->error($response, 'Access Denied: You are not authorized for this class.', 403);
            }
        }

        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->attendanceService->saveBulkAttendance($schoolId, $ayId, $classId, $date, $studentsList, $performedBy);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, 'Failed to save attendance: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/attendance/analytics/student/{student_id}
     */
    public function getStudentAttendanceAnalytics(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $studentId = (int)$args['student_id'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        if (!$ayId) {
            return $this->error($response, 'academic_year_id is required.', 400);
        }

        try {
            $data = $this->attendanceService->getStudentAttendanceAnalytics($schoolId, $studentId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/attendance/report/monthly
     */
    public function getMonthlyAttendanceReport(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        $classId = (int)($params['class_id'] ?? 0);
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $groupName = $params['group_name'] ?? 'all';
        $month = $params['month'] ?? date('Y-m');

        if (!$classId || !$ayId) {
            return $this->error($response, 'class_id and academic_year_id are required.', 400);
        }

        try {
            $data = $this->attendanceService->getMonthlyAttendanceReport($schoolId, $classId, $ayId, $groupName, $month);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }
}
