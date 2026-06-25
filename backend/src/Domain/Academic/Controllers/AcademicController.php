<?php

namespace App\Domain\Academic\Controllers;

use App\Shared\BaseController;
use App\Domain\Academic\Services\AcademicService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AcademicController extends BaseController
{
    public function __construct(
        private AcademicService $academicService
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

    private function getAuthUserEmail(Request $request): string
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            return $auth['email'] ?? $auth['phone'] ?? 'System';
        }
        return 'System';
    }

    // --- Academic Years ---

    public function getAcademicYears(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $years = $this->academicService->getAcademicYears($schoolId);
        return $this->success($response, $years);
    }

    public function createAcademicYear(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->createAcademicYear($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function activateAcademicYear(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)($args['id'] ?? 0);
        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->activateAcademicYear($schoolId, $id, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function archiveAcademicYear(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)($args['id'] ?? 0);
        try {
            $result = $this->academicService->archiveAcademicYear($schoolId, $id, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    // --- Classrooms ---

    public function getClassrooms(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $classes = $this->academicService->getClassrooms($schoolId);
        return $this->success($response, $classes);
    }

    public function createClassroom(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->createClassroom($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function updateClassroom(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->updateClassroom($schoolId, $id, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 404);
        }
    }

    public function deleteClassroom(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->academicService->deleteClassroom($schoolId, $id, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function assignClassTeacher(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->assignClassTeacher($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Teachers ---

    public function getTeachers(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $teachers = $this->academicService->getTeachers($schoolId);
        return $this->success($response, $teachers);
    }

    public function createTeacher(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->createTeacher($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function updateTeacher(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->updateTeacher($schoolId, $id, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function deleteTeacher(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->academicService->deleteTeacher($schoolId, $id, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Students ---

    public function getStudents(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        $ayId = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : null;
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : null;

        try {
            $students = $this->academicService->getStudents($schoolId, $ayId, $classId);
            return $this->success($response, $students);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 403);
        }
    }

    public function createStudent(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->createStudent($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function updateStudent(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->academicService->updateStudent($schoolId, $id, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function deleteStudent(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->academicService->deleteStudent($schoolId, $id, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }
}
