<?php

declare(strict_types=1);

namespace App\Domain\Platform\Controllers;

use App\Domain\Platform\Services\PlatformService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class PlatformController extends BaseController
{
    public function __construct(
        private PlatformService $service,
        TokenService            $tokenService,
    ) {
        parent::__construct($tokenService);
    }

    // -------------------------------------------------------------------------
    // Schools
    // -------------------------------------------------------------------------

    public function getSchools(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getSchools());
    }

    public function createSchool(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $data   = RequestParser::body($request);
        $school = $this->service->createSchool($data, $actor);

        return $this->success($response, $school, 'School created successfully.', 201);
    }

    public function inviteSchool(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $data   = RequestParser::body($request);
        $school = $this->service->inviteSchool($data, $actor);

        return $this->success($response, $school, 'School invited and provisioned successfully.', 201);
    }

    public function updateSchool(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id     = (int) ($args['id'] ?? 0);
        $data   = RequestParser::body($request);
        $school = $this->service->updateSchool($id, $data, $actor);

        return $this->success($response, $school, 'School updated successfully.');
    }

    public function deleteSchool(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $this->service->deleteSchool($id, $actor);

        return $this->success($response, null, 'School tenant deleted successfully.');
    }

    // -------------------------------------------------------------------------
    // Platform Admins
    // -------------------------------------------------------------------------

    public function getAdmins(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getAdmins());
    }

    public function createAdmin(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $data  = RequestParser::body($request);
        $admin = $this->service->createAdmin($data, $actor);

        return $this->success($response, $admin, 'Administrator created successfully.', 201);
    }

    // -------------------------------------------------------------------------
    // Plans
    // -------------------------------------------------------------------------

    public function getPlans(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getPlans());
    }

    public function createPlan(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $data = RequestParser::body($request);
        $plan = $this->service->createPlan($data);

        return $this->success($response, $plan, 'Plan created successfully.', 201);
    }

    public function updatePlan(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id   = (int) ($args['id'] ?? 0);
        $data = RequestParser::body($request);
        $plan = $this->service->updatePlan($id, $data);

        return $this->success($response, $plan, 'Plan updated successfully.');
    }

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------

    public function getSubscriptions(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getSubscriptions());
    }

    // -------------------------------------------------------------------------
    // Audit logs
    // -------------------------------------------------------------------------

    public function getAuditLogs(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getAuditLogs());
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    public function getStats(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getStats());
    }

    public function getGrowthChart(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getGrowthChart());
    }

    public function getSchoolStats(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolStats($id));
    }

    public function deletePlan(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $this->service->deletePlan($id);
        return $this->success($response, null, 'Plan deleted successfully.');
    }

    public function getSchoolTeachers(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolTeachers($id));
    }

    public function getSchoolStudents(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolStudents($id));
    }

    public function getSchoolSubscriptions(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolSubscriptions($id));
    }

    public function getSchoolAcademicYears(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolAcademicYears($id));
    }

    public function getSchoolClasses(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolClasses($id));
    }

    public function getSchoolCredentials(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $credentials = $this->service->getSchoolCredentials($id, $actor);

        return $this->success($response, $credentials);
    }

    public function updateSchoolCredentials(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $credentials = $this->service->updateSchoolCredentials($id, $body, $actor);

        return $this->success($response, $credentials, 'Credentials updated successfully.');
    }

    public function previewUpgrade(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $queryParams = $request->getQueryParams();
        $planId = isset($queryParams['plan_id']) ? (int)$queryParams['plan_id'] : 0;

        $preview = $this->service->previewUpgrade($id, $planId, $actor);
        return $this->success($response, $preview);
    }

    public function upgradePlan(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $body = RequestParser::body($request);
        $planId = isset($body['plan_id']) ? (int)$body['plan_id'] : 0;

        $school = $this->service->upgradePlan($id, $planId, $actor);
        return $this->success($response, $school, 'Subscription upgraded successfully.');
    }

    // -------------------------------------------------------------------------
    // Website leads (demo requests from the public marketing site)
    // -------------------------------------------------------------------------

    public function getWebsiteLeads(Request $request, Response $response): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        return $this->success($response, $this->service->getWebsiteLeads());
    }

    public function deleteWebsiteLead(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        $this->service->deleteWebsiteLead($id);

        return $this->success($response, null, 'Lead deleted successfully.');
    }
}
