<?php

declare(strict_types=1);

namespace App\Shared\Notifications;

use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class DeviceTokenController extends BaseController
{
    public function __construct(
        TokenService $tokenService,
        private DeviceTokenService $service,
        private PushDispatcher $dispatcher,
    ) {
        parent::__construct($tokenService);
    }

    public function register(Request $request, Response $response): Response
    {
        // Every authenticated role can own a device — no requireRole gate.
        $user = $this->authenticate($request);
        $data = $this->service->register($user, (array) $request->getParsedBody());

        return $this->success($response, $data, 'Device registered for notifications');
    }

    public function unregister(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $data = $this->service->unregister($user, (array) $request->getParsedBody());

        return $this->success($response, $data, 'Device unregistered');
    }

    /**
     * Dispatch a test push notification to the authenticated user's registered devices.
     */
    public function testPush(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $schoolId = (int) ($user['school_id'] ?? 0);
        $userId   = (int) ($user['id'] ?? 0);
        $role     = (string) ($user['role'] ?? '');

        if ($schoolId <= 0 || $userId <= 0) {
            return $this->error($response, 'User is not associated with a school', 400);
        }

        $this->dispatcher->toUser(
            $schoolId,
            $userId,
            $role,
            'ANNOUNCEMENT_PUBLISHED',
            '🔔 Test Push Notification',
            'Push notification service is active and working perfectly!',
            '/notifications'
        );

        return $this->success($response, [
            'sent' => true,
            'timestamp' => date('c'),
        ], 'Test push notification dispatched');
    }

    /**
     * The notification catalog, so the app can render category filters and
     * preference toggles from the server's definition instead of keeping a
     * second hardcoded copy in Dart that silently drifts.
     */
    public function catalog(Request $request, Response $response): Response
    {
        $this->authenticate($request);

        return $this->success($response, ['events' => NotificationCatalog::all()]);
    }
}

