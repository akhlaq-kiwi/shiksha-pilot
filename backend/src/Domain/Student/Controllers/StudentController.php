<?php

declare(strict_types=1);

namespace App\Domain\Student\Controllers;

use App\Domain\Student\Services\StudentService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use App\Shared\Http\RequestParser;
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
    // Endpoints
    // -------------------------------------------------------------------------

    public function getDashboard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getDashboard($user);

        return $this->success($response, $data);
    }

    public function getTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $params = $request->getQueryParams();
        $date = $params['date'] ?? null;

        $data = $this->service->getTimetable($user, $date);

        return $this->success($response, $data);
    }

    public function getAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getAttendance($user);

        return $this->success($response, $data);
    }

    public function getExamResults(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getExamResults($user);

        return $this->success($response, $data);
    }

    public function getAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getAssignments($user);

        return $this->success($response, $data);
    }

    public function getFees(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getFees($user);

        return $this->success($response, $data);
    }

    public function getFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getFeePayments($user);

        return $this->success($response, $data);
    }

    public function getMaterials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getMaterials($user);

        return $this->success($response, $data);
    }

    public function getPublishedReportCards(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getPublishedReportCards($user);

        return $this->success($response, $data);
    }

    public function getFeesCard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $data = $this->service->getFeesCard($user);

        return $this->success($response, $data);
    }

    public function getFeeReceipt(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);

        $params = $request->getQueryParams();
        $id = isset($params['id']) ? (int)$params['id'] : 0;
        $isAdditional = isset($params['additional']) && (int)$params['additional'] === 1;
        $receiptNo = !empty($params['receipt_no']) ? trim((string)$params['receipt_no']) : null;

        $receipt = $this->service->getFeeReceipt($user, $id, $isAdditional, $receiptNo);

        $response->getBody()->write($receipt['data']);
        return $response
            ->withHeader('Content-Type', 'application/pdf')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $receipt['filename'] . '"')
            ->withStatus(200);
    }

    public function getNotifications(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER']);
        $user = $this->withRequestedStudentId($request, $user);
        $queryParams = $request->getQueryParams();

        $data = $this->service->getNotifications($user, $queryParams);

        return $this->success($response, $data);
    }

    public function deleteNotification(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER']);
        $user = $this->withRequestedStudentId($request, $user);

        $id = (int)$args['id'];
        $data = $this->service->deleteNotification($user, $id);

        return $this->success($response, $data, 'Notification deleted successfully');
    }

    public function markAllNotificationsRead(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER']);
        $body = RequestParser::body($request);
        $user = $this->withRequestedStudentId($request, $user, $body);

        $data = $this->service->markAllNotificationsRead($user);

        return $this->success($response, $data);
    }

    public function markNotificationRead(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER']);

        $id = (int)($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $user = $this->withRequestedStudentId($request, $user, $body);
        $data = $this->service->markNotificationRead($user, $id, $body);

        return $this->success($response, $data);
    }

    public function getActiveNotices(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->getActiveNotices($user);
        return $this->success($response, $data);
    }

    public function getUnreadNoticesCount(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->getUnreadNoticesCount($user);
        return $this->success($response, $data);
    }

    public function markAllNoticesRead(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->markAllNoticesRead($user);
        return $this->success($response, $data, 'All notices marked as read');
    }

    public function markNoticeRead(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);
        $user = $this->withRequestedStudentId($request, $user);
        $id = (int)$args['id'];
        $data = $this->service->markNoticeRead($user, $id);
        return $this->success($response, $data, 'Notice marked as read');
    }

    public function getExamsList(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $role = strtoupper($user['role'] ?? '');
        if ($role === 'TEACHER' || $role === 'PRINCIPAL' || $role === 'SCHOOL_ADMIN' || !empty($user['is_principal'])) {
            $teacherService = $this->container->get(\App\Domain\Teacher\Services\TeacherService::class);
            $queryParams = $request->getQueryParams();
            $classId = isset($queryParams['class_id']) ? (int)$queryParams['class_id'] : null;
            $data = $teacherService->getExamsList($user, $classId);
            return $this->success($response, $data);
        }
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->getExamsList($user);
        return $this->success($response, $data);
    }

    public function getExamDetails(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $role = strtoupper($user['role'] ?? '');
        $examId = (int)$args['id'];
        if ($role === 'TEACHER' || $role === 'PRINCIPAL' || $role === 'SCHOOL_ADMIN' || !empty($user['is_principal'])) {
            $teacherService = $this->container->get(\App\Domain\Teacher\Services\TeacherService::class);
            $queryParams = $request->getQueryParams();
            $classId = isset($queryParams['class_id']) ? (int)$queryParams['class_id'] : null;
            $data = $teacherService->getExamDetails($user, $examId, $classId);
            return $this->success($response, $data);
        }
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->getExamDetails($user, $examId);
        return $this->success($response, $data);
    }

    public function getGameProgress(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->getGameProgress($user);
        return $this->success($response, $data);
    }

    public function syncGameProgress(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $body = (array) $request->getParsedBody();
        $user = $this->withRequestedStudentId($request, $user, $body);
        $data = $this->service->syncGameProgress($user, $body);
        return $this->success($response, $data);
    }

    public function claimDailyLogin(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, self::ALLOWED_ROLES);
        $user = $this->withRequestedStudentId($request, $user);
        $data = $this->service->claimDailyLogin($user);
        return $this->success($response, $data);
    }
}
