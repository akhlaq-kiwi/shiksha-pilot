<?php

declare(strict_types=1);

namespace App\Domain\TestSeries\Controllers;

use App\Domain\TestSeries\Services\TestSeriesService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class TestSeriesController extends BaseController
{
    private const STAFF_ROLES = ['TEACHER', 'PRINCIPAL'];
    private const STUDENT_ROLES = ['STUDENT', 'PARENT'];

    public function __construct(
        TokenService $tokenService,
        private TestSeriesService $service,
    ) {
        parent::__construct($tokenService);
    }

    private function withRequestedStudentId(Request $request, array $user, ?array $body = null): array
    {
        $queryParams = $request->getQueryParams();
        $reqStudentId = $queryParams['student_id'] ?? null;

        if ($reqStudentId === null || !is_numeric($reqStudentId)) {
            $parsedBody = $body ?? (is_array($request->getParsedBody()) ? $request->getParsedBody() : []);
            if (isset($parsedBody['student_id']) && is_numeric($parsedBody['student_id'])) {
                $reqStudentId = $parsedBody['student_id'];
            }
        }

        if ($reqStudentId === null || !is_numeric($reqStudentId)) {
            $headerVal = trim($request->getHeaderLine('X-Student-Id'));
            if ($headerVal !== '' && is_numeric($headerVal)) {
                $reqStudentId = $headerVal;
            }
        }

        if ($reqStudentId !== null && is_numeric($reqStudentId) && (int)$reqStudentId > 0) {
            $user['_requested_student_id'] = (int)$reqStudentId;
        }

        return $user;
    }

    // -------------------------------------------------------------------------
    // Teacher / Principal Endpoints
    // -------------------------------------------------------------------------

    public function getAccess(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $data = $this->service->getTeacherAccess($user);
        return $this->success($response, $data);
    }

    public function getPermissions(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $data = $this->service->getPermissions($user);
        return $this->success($response, $data);
    }

    public function setPermission(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $body = (array)$request->getParsedBody();
        $data = $this->service->setPermission($user, $body);
        return $this->success($response, $data, 'Permission updated successfully');
    }

    public function uploadImage(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No image file uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        $data = $this->service->uploadImage($user, $uploadedFile);
        return $this->success($response, $data, 'Image uploaded successfully');
    }

    public function listForTeacher(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $params = $request->getQueryParams();
        $data = $this->service->listForTeacher($user, $params);
        return $this->success($response, $data);
    }

    public function getTeacherDetail(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->getTeacherTestSeriesDetail($user, $id);
        return $this->success($response, $data);
    }

    public function create(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $body = (array)$request->getParsedBody();
        $data = $this->service->createTestSeries($user, $body);
        return $this->success($response, $data, 'Test Series created successfully', 201);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $id = (int)($args['id'] ?? 0);
        $body = (array)$request->getParsedBody();
        $data = $this->service->updateTestSeries($user, $id, $body);
        return $this->success($response, $data, 'Test Series updated successfully');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->deleteTestSeries($user, $id);
        return $this->success($response, $data, 'Test Series deleted successfully');
    }

    public function getTeacherLeaderboard(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STAFF_ROLES);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->getTeacherLeaderboard($user, $id);
        return $this->success($response, $data);
    }

    // -------------------------------------------------------------------------
    // Student / Parent Endpoints
    // -------------------------------------------------------------------------

    public function listForStudent(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STUDENT_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $params = $request->getQueryParams();
        $data = $this->service->listForStudent($user, $params);
        return $this->success($response, $data);
    }

    public function startAttempt(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STUDENT_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->startOrResumeAttempt($user, $id);
        return $this->success($response, $data);
    }

    public function pauseAttempt(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STUDENT_ROLES);
        $body = (array)$request->getParsedBody();
        $user = $this->withRequestedStudentId($request, $user, $body);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->pauseAttempt($user, $id, $body);
        return $this->success($response, $data);
    }

    public function submitAttempt(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STUDENT_ROLES);
        $body = (array)$request->getParsedBody();
        $user = $this->withRequestedStudentId($request, $user, $body);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->submitAttempt($user, $id, $body);
        return $this->success($response, $data, 'Test Series submitted successfully');
    }

    public function getStudentLeaderboard(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::STUDENT_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $id = (int)($args['id'] ?? 0);
        $data = $this->service->getStudentResultAndLeaderboard($user, $id);
        return $this->success($response, $data);
    }
}

