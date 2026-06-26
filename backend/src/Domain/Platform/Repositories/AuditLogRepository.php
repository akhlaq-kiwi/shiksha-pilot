<?php

declare(strict_types=1);

namespace App\Domain\Platform\Repositories;

use App\Shared\BaseRepository;

class AuditLogRepository extends BaseRepository
{
    protected string $table = 'audit_logs';

    /**
     * Insert an audit log entry and return the new row ID.
     */
    public function log(string $action, ?string $targetSchool, string $actor, string $ip, ?string $actorRole = null): int
    {
        return $this->create([
            'action'        => $action,
            'target_school' => $targetSchool,
            'user'          => $actor,
            'user_role'     => $actorRole,
            'ip_address'    => $ip,
        ]);
    }

    /**
     * Return the most recent audit log entries, newest first.
     */
    public function recent(int $limit = 50): array
    {
        return $this->findAll([], 'id DESC', $limit);
    }
}
