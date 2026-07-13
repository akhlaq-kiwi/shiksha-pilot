<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Controllers;

use App\Domain\Teacher\Services\TeacherService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class TeacherController extends BaseController
{
    public function __construct(
        TokenService    $tokenService,
        private TeacherService $service,
    ) {
        parent::__construct($tokenService);
    }

    // -------------------------------------------------------------------------
    // Schedule / Classes
    // -------------------------------------------------------------------------

    public function getTodaySchedule(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $data = $this->service->getTodaySchedule((int) $user['id'], (int) $user['school_id']);

        return $this->success($response, $data);
    }

    public function getMyClasses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $params = $request->getQueryParams();
        $onlyAssigned = isset($params['only_assigned']) && $params['only_assigned'] === '1';

        $data = $this->service->getMyClasses((int) $user['id'], (int) $user['school_id'], $onlyAssigned);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    public function getStudentList(Request $request, Response $response): Response
    {
        $user    = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $params  = $request->getQueryParams();
        $classId = isset($params['class_id']) ? (int) $params['class_id'] : null;

        $data = $this->service->getStudentList((int) $user['school_id'], $classId);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    public function markAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $body   = (array) $request->getParsedBody();
        $result = $this->service->markAttendance($user, $body);

        return $this->success($response, $result);
    }

    public function getAttendanceHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $filters = $request->getQueryParams();
        $data    = $this->service->getAttendanceHistory((int) $user['id'], $filters);

        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Assignments
    // -------------------------------------------------------------------------

    public function getAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $data = $this->service->getAssignments((int) $user['id'], (int) $user['school_id']);

        return $this->success($response, $data);
    }

    public function createAssignment(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $body   = (array) $request->getParsedBody();
        $result = $this->service->createAssignment($user, $body);

        return $this->success($response, $result, 'Created', 201);
    }

    // -------------------------------------------------------------------------
    // Learning Materials
    // -------------------------------------------------------------------------

    public function getMaterials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $data = $this->service->getMaterials((int) $user['id'], (int) $user['school_id']);

        return $this->success($response, $data);
    }

    public function createMaterial(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $body   = (array) $request->getParsedBody();
        $result = $this->service->createMaterial($user, $body);

        return $this->success($response, $result, 'Created', 201);
    }

    // -------------------------------------------------------------------------
    // Exams / Marks
    // -------------------------------------------------------------------------

    public function getExams(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $data = $this->service->getExams((int) $user['id'], (int) $user['school_id']);

        return $this->success($response, $data);
    }

    public function enterMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $body   = (array) $request->getParsedBody();
        $result = $this->service->enterMarks($body);

        return $this->success($response, $result);
    }

    public function getSalaries(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $data = $this->service->getSalaries((int) $user['id'], (int) $user['school_id']);

        return $this->success($response, $data);
    }

    public function getSalarySlip(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, 'TEACHER');

        $params = $request->getQueryParams();
        $id = isset($params['id']) ? (int)$params['id'] : 0;

        $slip = $this->service->getSalarySlip((int) $user['id'], (int) $user['school_id'], $id);

        $response->getBody()->write($slip['data']);
        return $response
            ->withHeader('Content-Type', 'application/pdf')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $slip['filename'] . '"')
            ->withStatus(200);
    }
}
