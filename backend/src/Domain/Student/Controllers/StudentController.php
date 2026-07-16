<?php

declare(strict_types=1);

namespace App\Domain\Student\Controllers;

use App\Domain\Student\Services\StudentService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class StudentController extends BaseController
{
    /** Roles allowed to access all endpoints in this controller. */
    private const ALLOWED_ROLES = ['STUDENT', 'PARENT'];

    public function __construct(
        TokenService $tokenService,
        private StudentService $service,
    ) {
        parent::__construct($tokenService);
    }

    // -------------------------------------------------------------------------
    // Endpoints
    // -------------------------------------------------------------------------

    public function getDashboard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getDashboard($user);

        return $this->success($response, $data);
    }

    public function getTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getTimetable($user);

        return $this->success($response, $data);
    }

    public function getAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getAttendance($user);

        return $this->success($response, $data);
    }

    public function getExamResults(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getExamResults($user);

        return $this->success($response, $data);
    }

    public function getAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getAssignments($user);

        return $this->success($response, $data);
    }

    public function getFees(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getFees($user);

        return $this->success($response, $data);
    }

    public function getFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getFeePayments($user);

        return $this->success($response, $data);
    }

    public function getMaterials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getMaterials($user);

        return $this->success($response, $data);
    }

    public function getPublishedReportCards(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getPublishedReportCards($user);

        return $this->success($response, $data);
    }

    public function getFeesCard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getFeesCard($user);

        return $this->success($response, $data);
    }

    public function getFeeReceipt(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $params = $request->getQueryParams();
        $id = isset($params['id']) ? (int)$params['id'] : 0;
        $isAdditional = isset($params['additional']) && (int)$params['additional'] === 1;

        $receipt = $this->service->getFeeReceipt($user, $id, $isAdditional);

        $response->getBody()->write($receipt['data']);
        return $response
            ->withHeader('Content-Type', 'application/pdf')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $receipt['filename'] . '"')
            ->withStatus(200);
    }

    public function getNotifications(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->getNotifications($user);

        return $this->success($response, $data);
    }

    public function markAllNotificationsRead(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);

        $data = $this->service->markAllNotificationsRead($user);

        return $this->success($response, $data);
    }

    public function getActiveNotices(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $data = $this->service->getActiveNotices($user);
        return $this->success($response, $data);
    }

    public function markNoticeRead(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $id = (int)$args['id'];
        $data = $this->service->markNoticeRead($user, $id);
        return $this->success($response, $data, 'Notice marked as read');
    }
}
