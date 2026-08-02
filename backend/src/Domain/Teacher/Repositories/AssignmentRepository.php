<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Repositories;

use App\Shared\BaseRepository;
use PDO;

class AssignmentRepository extends BaseRepository
{
    protected string $table = 'assignments';

    /**
     * Return all assignments created by a teacher, enriched with class and subject names.
     */
    public function findByTeacher(int $teacherId, int $schoolId): array
    {
        $sql = "
            SELECT a.*, c.name AS class_name, s.name AS subject_name
            FROM assignments a
            LEFT JOIN classes c ON a.class_id = c.id
            LEFT JOIN subjects s ON a.subject_id = s.id
            WHERE a.teacher_id = :teacher_id AND a.school_id = :school_id
            ORDER BY a.due_date DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':teacher_id' => $teacherId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
