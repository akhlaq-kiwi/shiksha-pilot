<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class FinancialReportRepository extends BaseRepository
{
    protected string $table = 'financial_reports';

    public function findBySchool(int $schoolId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM financial_reports WHERE school_id = :sid ORDER BY to_date DESC"
        );
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
