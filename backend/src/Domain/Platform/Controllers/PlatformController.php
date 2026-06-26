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

    public function getSchoolStats(Request $request, Response $response, array $args): Response
    {
        $actor = $this->authenticate($request);
        $this->requireRole($actor, ['SUPER_ADMIN']);

        $id = (int) ($args['id'] ?? 0);
        return $this->success($response, $this->service->getSchoolStats($id));
    }
}
