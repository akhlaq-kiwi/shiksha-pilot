<?php

declare(strict_types=1);

namespace App\Domain\Platform\Repositories;

use App\Shared\BaseRepository;
use PDO;

class SchoolRepository extends BaseRepository
{
    protected string $table = 'schools';

    public function findBySubdomain(string $subdomain): ?array
    {
        return $this->findOne(['subdomain' => $subdomain]);
    }

    public function countByStatus(string $status): int
    {
        return $this->count(['status' => $status]);
    }

    /**
     * Returns rows of ['plan' => string, 'count' => int] for ACTIVE schools.
     */
    public function countByPlan(): array
    {
        $sql  = "SELECT plan, COUNT(*) AS count FROM {$this->table} WHERE status = 'ACTIVE' GROUP BY plan";
        $stmt = $this->pdo->query($sql);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
