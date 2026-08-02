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

        if (!empty($filters['status']) && $filters['status'] !== 'All') {
            $where .= ' AND s.status = :status';
            $bindings[':status'] = $filters['status'];
        }

        if (!empty($filters['academic_year_id'])) {
            $where .= ' AND s.academic_year_id = :academic_year_id';
            $bindings[':academic_year_id'] = $filters['academic_year_id'];
        }

        if (!empty($filters['search'])) {
            $where .= ' AND (s.name LIKE :search_name OR s.admission_no LIKE :search_adm OR s.sr_no LIKE :search_sr OR s.first_name LIKE :search_first OR s.last_name LIKE :search_last)';
            $bindings[':search_name'] = '%' . $filters['search'] . '%';
            $bindings[':search_adm'] = '%' . $filters['search'] . '%';
            $bindings[':search_sr'] = '%' . $filters['search'] . '%';
            $bindings[':search_first'] = '%' . $filters['search'] . '%';
            $bindings[':search_last'] = '%' . $filters['search'] . '%';
        }

        // Handle sorting
        $allowedSort = ['s.id', 's.name', 's.sr_no', 's.roll_no'];
        $sortBy = 's.id';
        if (!empty($filters['sort_by']) && in_array('s.' . $filters['sort_by'], $allowedSort, true)) {
            $sortBy = 's.' . $filters['sort_by'];
        } elseif (!empty($filters['sort_by']) && in_array($filters['sort_by'], $allowedSort, true)) {
            $sortBy = $filters['sort_by'];
        }
        
        $sortOrder = 'DESC';
        if (!empty($filters['sort_order']) && in_array(strtoupper($filters['sort_order']), ['ASC', 'DESC'], true)) {
            $sortOrder = strtoupper($filters['sort_order']);
        }

        $sql  = "
            SELECT s.*,
                   CASE 
                     WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                     ELSE 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                   END AS name,
                   c.name AS class_name, c.section, ay.name AS academic_year_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE {$where}
            ORDER BY {$sortBy} {$sortOrder}
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findDetailById(int $schoolId, int $id): ?array
    {
        $sql = "
            SELECT s.*,
                   CASE 
                     WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                     ELSE 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                   END AS name,
                   c.name AS class_name, c.section, ay.name AS academic_year_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.school_id = :school_id AND s.id = :id
            LIMIT 1
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':school_id' => $schoolId, ':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    public function countBySchool(int $schoolId, string $status = 'ACTIVE', ?int $academicYearId = null): int
    {
        if ($academicYearId !== null) {
            $stmt = $this->pdo->prepare(
                "SELECT COUNT(*) FROM students WHERE school_id = :sid AND status = :status AND academic_year_id = :ayid"
            );
            $stmt->execute([':sid' => $schoolId, ':status' => $status, ':ayid' => $academicYearId]);
        } else {
            $stmt = $this->pdo->prepare(
                "SELECT COUNT(*) FROM students WHERE school_id = :sid AND status = :status"
            );
            $stmt->execute([':sid' => $schoolId, ':status' => $status]);
        }

        return (int) $stmt->fetchColumn();
    }
}
