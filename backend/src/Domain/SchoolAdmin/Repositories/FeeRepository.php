<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class FeeRepository extends BaseRepository
{
    protected string $table = 'fee_structures';

    /**
     * Fee structures joined with class name for the given school.
     */
    public function findBySchool(int $schoolId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT fs.*, c.name AS class_name
            FROM fee_structures fs
            LEFT JOIN classes c ON fs.class_id = c.id
            WHERE fs.school_id = :sid
            ORDER BY fs.id DESC
        ");
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fee payments joined with student and fee-structure names for the given school.
     */
    public function findPayments(int $schoolId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT fp.*, s.name AS student_name, fs.name AS fee_structure_name
            FROM fee_payments fp
            LEFT JOIN students      s  ON fp.student_id       = s.id
            LEFT JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.school_id = :sid
            ORDER BY fp.payment_date DESC
        ");
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countPendingBySchool(int $schoolId): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM fee_payments WHERE school_id = :sid AND status = 'Pending'"
        );
        $stmt->execute([':sid' => $schoolId]);

        return (int) $stmt->fetchColumn();
    }
}
