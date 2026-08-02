<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class ExamRepository extends BaseRepository
{
    protected string $table = 'exams';

    public function findBySchool(int $schoolId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT e.*, c.name AS class_name, s.name AS subject_name
            FROM exams e
            LEFT JOIN classes  c ON e.class_id   = c.id
            LEFT JOIN subjects s ON e.subject_id  = s.id
            WHERE e.school_id = :sid
            ORDER BY e.exam_date DESC
        ");
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countBySchool(int $schoolId): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM exams WHERE school_id = :sid"
        );
        $stmt->execute([':sid' => $schoolId]);

        return (int) $stmt->fetchColumn();
    }

    public function findMarks(array $filters = []): array
    {
        $where    = '1=1';
        $bindings = [];

        if (!empty($filters['exam_id'])) {
            $where .= ' AND em.exam_id = :exam_id';
            $bindings[':exam_id'] = $filters['exam_id'];
        }

        $stmt = $this->pdo->prepare("
            SELECT em.*, s.name AS student_name, e.name AS exam_name
            FROM exam_marks em
            LEFT JOIN students s ON em.student_id = s.id
            LEFT JOIN exams    e ON em.exam_id    = e.id
            WHERE {$where}
            ORDER BY em.id DESC
        ");
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Return exams for subjects taught by a specific teacher.
     */
    public function findByTeacher(int $teacherId, int $schoolId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT e.*, c.name AS class_name, s.name AS subject_name
            FROM exams e
            LEFT JOIN classes  c ON e.class_id  = c.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.subject_id IN (
                SELECT id FROM subjects WHERE teacher_id = :teacher_id AND school_id = :school_id
            )
            ORDER BY e.exam_date DESC
        ");
        $stmt->execute([':teacher_id' => $teacherId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upsertMarks(array $data): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO exam_marks (exam_id, student_id, marks_obtained, grade, remarks)
            VALUES (:exam_id, :student_id, :marks_obtained, :grade, :remarks)
            ON DUPLICATE KEY UPDATE
                marks_obtained = VALUES(marks_obtained),
                grade          = VALUES(grade),
                remarks        = VALUES(remarks)
        ");
        $stmt->execute($data);
    }
}
