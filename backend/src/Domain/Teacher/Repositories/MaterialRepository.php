<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Repositories;

use App\Shared\BaseRepository;
use PDO;

class MaterialRepository extends BaseRepository
{
    protected string $table = 'learning_materials';

    /**
     * Return all learning materials uploaded by a teacher, enriched with class and subject names.
     */
    public function findByTeacher(int $teacherId, int $schoolId): array
    {
        $sql = "
            SELECT lm.*, c.name AS class_name, s.name AS subject_name
            FROM learning_materials lm
            LEFT JOIN classes c ON lm.class_id = c.id
            LEFT JOIN subjects s ON lm.subject_id = s.id
            WHERE lm.teacher_id = :teacher_id AND lm.school_id = :school_id
            ORDER BY lm.id DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':teacher_id' => $teacherId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
