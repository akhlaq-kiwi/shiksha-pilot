<?php

namespace App\Domain\Platform\Controllers;

use App\Shared\BaseController;
use App\Domain\Platform\Services\PlatformService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class PlatformController extends BaseController
{
    public function __construct(
        private PlatformService $platformService
    ) {}

    private function checkAuth(Request $request): ?array
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            if ($auth && $auth['role'] === 'Super Admin') {
                return $auth;
            }
        }
        return null;
    }

    public function getPlans(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $plans = $this->platformService->getPlans();
        return $this->success($response, $plans);
    }

    public function createPlan(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->platformService->createPlan($data, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 500);
        }
    }

    public function updatePlan(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->platformService->updatePlan($id, $data, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function deletePlan(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->platformService->deletePlan($id, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function getSubscriptions(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $subs = $this->platformService->getSubscriptions();
        return $this->success($response, $subs);
    }

    public function activateSubscription(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->platformService->activateSubscription($data, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function getAuditLogs(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $logs = $this->platformService->getAuditLogs();
        return $this->success($response, $logs);
    }

    public function getActivePlans(Request $request, Response $response): Response
    {
        $plans = $this->platformService->getActivePlans();
        return $this->success($response, $plans);
    }

    public function getStats(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $stats = $this->platformService->getStats();
        return $this->success($response, $stats);
    }

    public function getSchools(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $schools = $this->platformService->getSchools();
        return $this->success($response, $schools);
    }

    public function inviteSchool(Request $request, Response $response): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->platformService->inviteSchool($data, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function updateSchool(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->platformService->updateSchool($id, $data, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function extendSubscription(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        $months = (int)($data['months'] ?? 12);
        try {
            $result = $this->platformService->extendSubscription($id, $months, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function deleteSchool(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->platformService->deleteSchool($id, $auth['email'] ?? 'System');
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function getSchoolDetails(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->platformService->getSchoolDetails($id);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
            return $this->error($response, $e->getMessage(), $status);
        }
    }

    public function getStudentFees(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $schoolId = (int)$args['schoolId'];
        $studentId = (int)$args['studentId'];
        $result = $this->platformService->getStudentFees($schoolId, $studentId);
        return $this->success($response, $result);
    }

    public function getTeacherSalary(Request $request, Response $response, array $args): Response
    {
        $auth = $this->checkAuth($request);
        if (!$auth) {
            return $this->error($response, 'Unauthorized Access.', 403);
        }

        $schoolId = (int)$args['schoolId'];
        $teacherId = (int)$args['teacherId'];
        $result = $this->platformService->getTeacherSalary($schoolId, $teacherId);
        return $this->success($response, $result);
    }
}
