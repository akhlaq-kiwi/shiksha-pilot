<?php

namespace App\Domain\Portal\Controllers;

use App\Shared\BaseController;
use App\Domain\Portal\Services\PortalService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use PDO;

class PortalController extends BaseController
{
    public function __construct(
        private PortalService $portalService,
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

    /**
     * GET /api/teacher/dashboard
     */
    public function getTeacherDashboard(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        $auth = $this->getAuthUser($request);
        
        if (!$schoolId || !$auth) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $data = $this->portalService->getTeacherDashboard($schoolId, $auth);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            $code = $e->getCode();
            $status = ($code >= 400 && $code < 600) ? $code : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    /**
     * GET /api/parent/dashboard
     */
    public function getParentDashboard(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        $auth = $this->getAuthUser($request);
        
        if (!$schoolId || !$auth) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $parentId = (int)($auth['id'] ?? 0);
            $parentPhone = $auth['phone'] ?? '';
            $data = $this->portalService->getParentDashboard($schoolId, $parentId, $parentPhone);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            $code = $e->getCode();
            $status = ($code >= 400 && $code < 600) ? $code : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    /**
     * GET /api/parent/student/{student_id}/summary
     */
    public function getParentStudentSummary(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        $auth = $this->getAuthUser($request);
        
        if (!$schoolId || !$auth) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $studentId = (int)($args['student_id'] ?? 0);
        $parentId = (int)($auth['id'] ?? 0);

        try {
            $data = $this->portalService->getParentStudentSummary($schoolId, $parentId, $studentId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            $code = $e->getCode();
            $status = ($code >= 400 && $code < 600) ? $code : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    /**
     * GET /api/parent/students
     */
    public function getParentStudents(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        $auth = $this->getAuthUser($request);
        
        if (!$schoolId || !$auth) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $parentId = (int)($auth['id'] ?? 0);
            $data = $this->portalService->getParentStudents($parentId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            $code = $e->getCode();
            $status = ($code >= 400 && $code < 600) ? $code : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    /**
     * GET /api/parent/student/{id}/dashboard
     */
    public function getParentStudentDashboard(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        $auth = $this->getAuthUser($request);
        
        if (!$schoolId || !$auth) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $studentId = (int)($args['id'] ?? 0);
        $parentId = (int)($auth['id'] ?? 0);

        try {
            $data = $this->portalService->getParentStudentDashboard($schoolId, $parentId, $studentId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            $code = $e->getCode();
            $status = ($code >= 400 && $code < 600) ? $code : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }
}
