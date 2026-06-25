<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class StaffRepository extends BaseRepository
{
    protected string $table = 'staff';

    public function findBySchool(int $schoolId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM staff WHERE school_id = :sid ORDER BY id DESC"
        );
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countBySchool(int $schoolId, string $status = 'ACTIVE'): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM staff WHERE school_id = :sid AND status = :status"
        );
        $stmt->execute([':sid' => $schoolId, ':status' => $status]);

        return (int) $stmt->fetchColumn();
    }
}
