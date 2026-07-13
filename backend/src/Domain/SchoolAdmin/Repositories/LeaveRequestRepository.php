<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class LeaveRequestRepository extends BaseRepository
{
    protected string $table = 'leave_requests';

    public function findWithDetails(int $schoolId, array $filters = []): array
    {
        $where = 'lr.school_id = :school_id';
        $bindings = [':school_id' => $schoolId];

        if (!empty($filters['academic_year_id'])) {
            $where .= ' AND lr.academic_year_id = :academic_year_id';
            $bindings[':academic_year_id'] = (int)$filters['academic_year_id'];
        }

        if (!empty($filters['status']) && $filters['status'] !== 'ALL') {
            $where .= ' AND lr.status = :status';
            $bindings[':status'] = $filters['status'];
        }

        if (!empty($filters['applicant_role']) && $filters['applicant_role'] !== 'ALL') {
            $where .= ' AND lr.applicant_role = :applicant_role';
            $bindings[':applicant_role'] = $filters['applicant_role'];
        }

        if (!empty($filters['class_id']) && $filters['class_id'] !== 'ALL') {
            $where .= ' AND s.class_id = :class_id';
            $bindings[':class_id'] = (int)$filters['class_id'];
        }

        if (!empty($filters['student_id'])) {
            $where .= ' AND lr.student_id = :student_id';
            $bindings[':student_id'] = (int)$filters['student_id'];
        }

        if (!empty($filters['teacher_id'])) {
            $where .= ' AND lr.teacher_id = :teacher_id';
            $bindings[':teacher_id'] = (int)$filters['teacher_id'];
        }

        $sql = "
            SELECT lr.*,
                   s.name AS student_name,
                   c.name AS class_name,
                   c.section AS class_section,
                   st.name AS teacher_name,
                   st.department AS teacher_department,
                   u_creator.name AS creator_name,
                   u_approver.name AS approver_name,
                   u_rejecter.name AS rejecter_name
            FROM leave_requests lr
            LEFT JOIN students s ON lr.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN staff st ON lr.teacher_id = st.id
            LEFT JOIN users u_creator ON lr.created_by = u_creator.id
            LEFT JOIN users u_approver ON lr.approved_by = u_approver.id
            LEFT JOIN users u_rejecter ON lr.rejected_by = u_rejecter.id
            WHERE {$where}
            ORDER BY lr.id DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findByIdWithDetails(int $schoolId, int $id): ?array
    {
        $sql = "
            SELECT lr.*,
                   s.name AS student_name,
                   c.name AS class_name,
                   c.section AS class_section,
                   st.name AS teacher_name,
                   st.department AS teacher_department,
                   u_creator.name AS creator_name,
                   u_approver.name AS approver_name,
                   u_rejecter.name AS rejecter_name
            FROM leave_requests lr
            LEFT JOIN students s ON lr.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN staff st ON lr.teacher_id = st.id
            LEFT JOIN users u_creator ON lr.created_by = u_creator.id
            LEFT JOIN users u_approver ON lr.approved_by = u_approver.id
            LEFT JOIN users u_rejecter ON lr.rejected_by = u_rejecter.id
            WHERE lr.school_id = :school_id AND lr.id = :id
            LIMIT 1
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':school_id' => $schoolId, ':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row !== false ? $row : null;
    }
}
