<?php

namespace App\Domain\Grading\Controllers;

use App\Shared\BaseController;
use App\Domain\Grading\Services\GradingService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use PDO;

class GradingController extends BaseController
{
    public function __construct(
        private GradingService $gradingService,
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

    /**
     * GET /api/exams
     */
    public function getExams(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $classId = (int)($params['class_id'] ?? 0);

        if (!$ayId) {
            return $this->error($response, 'academic_year_id is required.', 400);
        }

        try {
            $data = $this->gradingService->getExams($schoolId, $ayId, $classId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/exams
     */
    public function createExam(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->gradingService->createExam($schoolId, $data, $performedBy);
            return $this->success($response, $result, 201);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * DELETE /api/exams/{id}
     */
    public function deleteExam(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->gradingService->deleteExam($schoolId, $id, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/exams/{id}
     */
    public function updateExam(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->gradingService->updateExam($schoolId, $id, $data, $performedBy);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/exams/{exam_id}/marks
     */
    public function getExamMarks(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $examId = (int)$args['exam_id'];

        try {
            $data = $this->gradingService->getExamMarks($schoolId, $examId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/exams/{exam_id}/marks
     */
    public function saveExamMarks(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $examId = (int)$args['exam_id'];
        $data = $this->getJsonData($request);
        $marksList = $data['marks'] ?? [];
        $performedBy = $this->getAuthUserEmail($request);

        if (empty($marksList)) {
            return $this->error($response, 'Marks data is required.', 400);
        }

        try {
            $result = $this->gradingService->saveExamMarks($schoolId, $examId, $marksList, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/school/signatures
     */
    public function getSchoolSignatures(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $data = $this->gradingService->getSchoolSignatures($schoolId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/school/signatures
     */
    public function saveSchoolSignatures(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->gradingService->saveSchoolSignatures($schoolId, $data, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/exams/{exam_id}/remarks
     */
    public function getExamRemarks(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $examId = (int)$args['exam_id'];

        try {
            $data = $this->gradingService->getExamRemarks($schoolId, $examId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/exams/{exam_id}/remarks
     */
    public function saveExamRemarks(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $examId = (int)$args['exam_id'];
        $data = $this->getJsonData($request);
        $remarksList = $data['remarks'] ?? [];
        $performedBy = $this->getAuthUserEmail($request);

        try {
            $result = $this->gradingService->saveExamRemarks($schoolId, $examId, $remarksList, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/school/grading-scales
     */
    public function getGradingScales(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $data = $this->gradingService->getGradingScales($schoolId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/school/grading-scales
     */
    public function saveGradingScales(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        $scales = $data['scales'] ?? [];
        $performedBy = $this->getAuthUserEmail($request);

        if (empty($scales)) {
            return $this->error($response, 'Scales data is required.', 400);
        }

        try {
            $result = $this->gradingService->saveGradingScales($schoolId, $scales, $performedBy);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/students/{id}/performance-summary
     */
    public function getStudentPerformanceSummary(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $studentId = (int)$args['id'];
        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);

        if (!$ayId) {
            return $this->error($response, 'academic_year_id is required.', 400);
        }

        try {
            $data = $this->gradingService->getStudentPerformanceSummary($schoolId, $studentId, $ayId);
            return $this->success($response, $data);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }
}
