<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class StudentRepository extends BaseRepository
{
    protected string $table = 'students';

    public function findBySchool(int $schoolId, array $filters = []): array
    {
        $where    = 's.school_id = :school_id';
        $bindings = [':school_id' => $schoolId];

        if (!empty($filters['class_id'])) {
            $where .= ' AND s.class_id = :class_id';
            $bindings[':class_id'] = $filters['class_id'];
        }

        if (!empty($filters['status'])) {
            $where .= ' AND s.status = :status';
            $bindings[':status'] = $filters['status'];
        }

        $sql  = "
            SELECT s.*, c.name AS class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE {$where}
            ORDER BY s.id DESC
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countBySchool(int $schoolId, string $status = 'ACTIVE'): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM students WHERE school_id = :sid AND status = :status"
        );
        $stmt->execute([':sid' => $schoolId, ':status' => $status]);

        return (int) $stmt->fetchColumn();
    }
}
