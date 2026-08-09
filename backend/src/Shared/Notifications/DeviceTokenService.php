<?php

declare(strict_types=1);

namespace App\Shared\Notifications;

use App\Shared\BaseService;
use App\Shared\Exceptions\ValidationException;
use PDO;
use Psr\Log\LoggerInterface;

class DeviceTokenService extends BaseService
{
    public function __construct(private PDO $pdo, ?LoggerInterface $logger = null)
    {
        parent::__construct($logger);
    }

    /**
     * Register (or re-register) the calling device's FCM token.
     *
     * Upserts on the token itself rather than on (user, device): the same
     * physical install produces the same token, so when a different user logs
     * in on a shared family phone the row must move to the new user, not
     * duplicate. Otherwise the previous user keeps receiving that phone's
     * personal notifications after logging out.
     *
     * @return array{topics:array<int,string>}
     */
    public function register(array $user, array $body): array
    {
        $token = trim((string) ($body['token'] ?? ''));
        if ($token === '') {
            throw new ValidationException(['token' => 'A device token is required.'], 'A device token is required.');
        }
        if (strlen($token) > 1024) {
            throw new ValidationException(['token' => 'Device token is malformed.'], 'Device token is malformed.');
        }

        $userId   = (int) ($user['id'] ?? 0);
        $schoolId = (int) ($user['school_id'] ?? 0);
        if ($schoolId <= 0) {
            $schoolId = 1; // Default to school 1 for global/super admin roles
        }
        $role     = (string) ($user['role'] ?? 'USER');

        if ($userId <= 0) {
            throw new ValidationException(['user' => 'Invalid user account.'], 'Invalid user account.');
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO device_tokens
                (school_id, user_id, user_role, token, platform, app_version, is_active, last_seen_at)
            VALUES (:sid, :uid, :role, :tok, :plat, :ver, 1, NOW())
            ON DUPLICATE KEY UPDATE
                school_id    = VALUES(school_id),
                user_id      = VALUES(user_id),
                user_role    = VALUES(user_role),
                platform     = VALUES(platform),
                app_version  = VALUES(app_version),
                is_active    = 1,
                last_seen_at = NOW()
        ");
        $stmt->execute([
            ':sid'  => $schoolId,
            ':uid'  => $userId,
            ':role' => $role,
            ':tok'  => $token,
            ':plat' => substr((string) ($body['platform'] ?? 'android'), 0, 20),
            ':ver'  => substr((string) ($body['app_version'] ?? ''), 0, 30) ?: null,
        ]);

        // The app subscribes to these itself via the Firebase SDK (a client
        // call, so it costs the API nothing). Returned here so the topic
        // naming lives in one place on the server rather than being
        // reconstructed — and drifting — in Dart.
        return ['topics' => [PushDispatcher::topicFor($schoolId, $role)]];
    }

    /**
     * Deactivate a token — called on logout so a shared device stops
     * receiving the previous user's notifications.
     */
    public function unregister(array $user, array $body): array
    {
        $token = trim((string) ($body['token'] ?? ''));
        if ($token === '') {
            throw new ValidationException(['token' => 'A device token is required.'], 'A device token is required.');
        }

        $stmt = $this->pdo->prepare("
            UPDATE device_tokens SET is_active = 0
            WHERE token = :tok AND user_id = :uid
        ");
        $stmt->execute([':tok' => $token, ':uid' => (int) ($user['id'] ?? 0)]);

        return ['deactivated' => $stmt->rowCount() > 0];
    }
}
