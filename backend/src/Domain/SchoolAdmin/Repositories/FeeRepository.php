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

    public function getTotalCollectedBySchool(int $schoolId, ?int $academicYearId = null): float
    {
        if ($academicYearId !== null) {
            $stmtYear = $this->pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :id LIMIT 1");
            $stmtYear->execute([':id' => $academicYearId]);
            $yearDates = $stmtYear->fetch(PDO::FETCH_ASSOC);
            $startDate = $yearDates ? $yearDates['start_date'] : null;
            $endDate = $yearDates ? $yearDates['end_date'] : null;

            if ($startDate && $endDate) {
                $stmt = $this->pdo->prepare("
                    SELECT COALESCE(SUM(fp.amount_paid), 0) 
                    FROM fee_payments fp
                    LEFT JOIN students s ON fp.student_id = s.id
                    WHERE fp.school_id = :sid AND fp.status = 'PAID'
                      AND (
                        fp.academic_year_id = :ayid
                        OR (
                          fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                          AND fp.academic_year_id != :ayid_3
                          AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                        )
                      )
                ");
                $stmt->execute([
                    ':sid' => $schoolId, 
                    ':ayid' => $academicYearId,
                    ':ayid_2' => $academicYearId,
                    ':ayid_3' => $academicYearId
                ]);
            } else {
                $stmt = $this->pdo->prepare("
                    SELECT COALESCE(SUM(fp.amount_paid), 0) 
                    FROM fee_payments fp
                    LEFT JOIN students s ON fp.student_id = s.id
                    WHERE fp.school_id = :sid AND fp.status = 'PAID'
                      AND (
                        fp.academic_year_id = :ayid
                        OR (
                          fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                          AND fp.academic_year_id != :ayid_3
                          AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                        )
                      )
                ");
                $stmt->execute([
                    ':sid' => $schoolId, 
                    ':ayid' => $academicYearId,
                    ':ayid_2' => $academicYearId,
                    ':ayid_3' => $academicYearId
                ]);
            }
            $monthlyCollected = (float)$stmt->fetchColumn();

            if ($startDate && $endDate) {
                $stmtAdd = $this->pdo->prepare("
                    SELECT COALESCE(SUM(afp.amount), 0) 
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    LEFT JOIN students s ON afp.student_id = s.id
                    WHERE afp.school_id = :sid AND afp.status = 'Paid'
                      AND (
                        aft.academic_year_id = :ayid
                        OR (
                          afp.updated_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                          AND aft.academic_year_id != :ayid_3
                          AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                        )
                      )
                ");
                $stmtAdd->execute([
                    ':sid' => $schoolId, 
                    ':ayid' => $academicYearId,
                    ':ayid_2' => $academicYearId,
                    ':ayid_3' => $academicYearId
                ]);
            } else {
                $stmtAdd = $this->pdo->prepare("
                    SELECT COALESCE(SUM(afp.amount), 0) 
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    LEFT JOIN students s ON afp.student_id = s.id
                    WHERE afp.school_id = :sid AND afp.status = 'Paid'
                      AND (
                        aft.academic_year_id = :ayid
                        OR (
                          afp.updated_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                          AND aft.academic_year_id != :ayid_3
                          AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                        )
                      )
                ");
                $stmtAdd->execute([
                    ':sid' => $schoolId, 
                    ':ayid' => $academicYearId,
                    ':ayid_2' => $academicYearId,
                    ':ayid_3' => $academicYearId
                ]);
            }
            $additionalCollected = (float)$stmtAdd->fetchColumn();
        } else {
            $stmt = $this->pdo->prepare("
                SELECT COALESCE(SUM(amount_paid), 0) 
                FROM fee_payments 
                WHERE school_id = :sid AND status = 'PAID'
            ");
            $stmt->execute([':sid' => $schoolId]);
            $monthlyCollected = (float)$stmt->fetchColumn();

            $stmtAdd = $this->pdo->prepare("
                SELECT COALESCE(SUM(amount), 0) 
                FROM additional_fee_payments 
                WHERE school_id = :sid AND status = 'Paid'
            ");
            $stmtAdd->execute([':sid' => $schoolId]);
            $additionalCollected = (float)$stmtAdd->fetchColumn();
        }

        return $monthlyCollected + $additionalCollected;
    }

    public function createPayment(array $data): int
    {
        $columns      = array_keys($data);
        $placeholders = array_map(static fn($col) => ":{$col}", $columns);

        $colList  = implode(', ', $columns);
        $valList  = implode(', ', $placeholders);

        $sql  = "INSERT INTO fee_payments ({$colList}) VALUES ({$valList})";
        $stmt = $this->pdo->prepare($sql);

        $bound = [];
        foreach ($data as $col => $value) {
            $bound[":{$col}"] = $value;
        }

        $stmt->execute($bound);

        return (int) $this->pdo->lastInsertId();
    }

    public function findPaymentById(int $id): ?array
    {
        $stmt = $this->pdo->prepare("
            SELECT fp.*, s.name AS student_name, fs.name AS fee_structure_name
            FROM fee_payments fp
            LEFT JOIN students      s  ON fp.student_id       = s.id
            LEFT JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    public function deletePayment(int $id): bool
    {
        $stmt = $this->pdo->prepare("DELETE FROM fee_payments WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}

