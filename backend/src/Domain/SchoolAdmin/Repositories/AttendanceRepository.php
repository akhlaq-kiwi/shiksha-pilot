<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Repositories;

use App\Shared\BaseRepository;
use PDO;

class AttendanceRepository extends BaseRepository
{
    protected string $table = 'attendance';

    /**
     * Fetch attendance records for a school, optionally filtered by date and class.
     */
    public function findByDate(int $schoolId, string $date, ?int $classId = null): array
    {
        $where    = 'a.school_id = :school_id AND a.date = :date';
        $bindings = [':school_id' => $schoolId, ':date' => $date];

        if ($classId !== null) {
            $where .= ' AND a.class_id = :class_id';
            $bindings[':class_id'] = $classId;
        }

        $stmt = $this->pdo->prepare("
            SELECT a.*, s.name AS student_name, c.name AS class_name
            FROM attendance a
            LEFT JOIN students s ON a.student_id = s.id
            LEFT JOIN classes  c ON a.class_id   = c.id
            WHERE {$where}
            ORDER BY a.date DESC, a.id DESC
        ");
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch all attendance records for a school with optional query-param filters.
     */
    public function findBySchool(int $schoolId, array $filters = []): array
    {
        $where    = 'a.school_id = :school_id';
        $bindings = [':school_id' => $schoolId];

        if (!empty($filters['date'])) {
            $where .= ' AND a.date = :date';
            $bindings[':date'] = $filters['date'];
        }

        if (!empty($filters['class_id'])) {
            $where .= ' AND a.class_id = :class_id';
            $bindings[':class_id'] = $filters['class_id'];
        }

        $stmt = $this->pdo->prepare("
            SELECT a.*, s.name AS student_name, c.name AS class_name
            FROM attendance a
            LEFT JOIN students s ON a.student_id = s.id
            LEFT JOIN classes  c ON a.class_id   = c.id
            WHERE {$where}
            ORDER BY a.date DESC, a.id DESC
        ");
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Fetch attendance records marked by a specific teacher, with optional filters.
     *
     * @param array{class_id?: int|string, date?: string} $filters
     */
    public function findByMarker(int $teacherId, array $filters = []): array
    {
        $bindings = [];
        
        if (!empty($filters['class_id'])) {
            $where = 'a.class_id = :class_id';
            $bindings[':class_id'] = $filters['class_id'];
        } else {
            $where = 'a.marked_by = :teacher_id';
            $bindings[':teacher_id'] = $teacherId;
        }

        if (!empty($filters['date'])) {
            $where .= ' AND a.date = :date';
            $bindings[':date'] = $filters['date'];
        }

        $stmt = $this->pdo->prepare("
            SELECT a.*, s.name AS student_name, c.name AS class_name
            FROM attendance a
            LEFT JOIN students s ON a.student_id = s.id
            LEFT JOIN classes  c ON a.class_id   = c.id
            WHERE {$where}
            ORDER BY a.date DESC, a.id DESC
        ");
        $stmt->execute($bindings);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Upsert a single attendance record.
     */
    public function upsert(array $data): void
    {
        $normalized = [];
        foreach ($data as $k => $v) {
            $key = str_starts_with((string)$k, ':') ? substr((string)$k, 1) : (string)$k;
            $normalized[$key] = $v;
        }

        $schoolId  = (int)($normalized['school_id'] ?? 0);
        $studentId = (int)($normalized['student_id'] ?? 0);
        $classId   = isset($normalized['class_id']) && $normalized['class_id'] !== '' ? (int)$normalized['class_id'] : null;
        $date      = (string)($normalized['date'] ?? date('Y-m-d'));
        $status    = (string)($normalized['status'] ?? 'Present');
        $markedBy  = isset($normalized['marked_by']) && $normalized['marked_by'] !== '' ? (int)$normalized['marked_by'] : null;

        if (!$schoolId || !$studentId) {
            return;
        }

        // Check if an attendance record already exists for this student on this date
        $stmtCheck = $this->pdo->prepare("
            SELECT id FROM attendance 
            WHERE school_id = :school_id AND student_id = :student_id AND date = :date 
            ORDER BY id DESC LIMIT 1
        ");
        $stmtCheck->execute([
            ':school_id'  => $schoolId,
            ':student_id' => $studentId,
            ':date'       => $date,
        ]);
        $existingId = $stmtCheck->fetchColumn();

        if ($existingId !== false) {
            // Update the existing record
            $stmtUpdate = $this->pdo->prepare("
                UPDATE attendance 
                SET status = :status, marked_by = :marked_by, class_id = COALESCE(:class_id, class_id)
                WHERE id = :id
            ");
            $stmtUpdate->execute([
                ':status'    => $status,
                ':marked_by' => $markedBy,
                ':class_id'  => $classId,
                ':id'        => (int)$existingId,
            ]);

            // Clean up any duplicate records for the same student on the same date
            $stmtClean = $this->pdo->prepare("
                DELETE FROM attendance 
                WHERE school_id = :school_id AND student_id = :student_id AND date = :date AND id != :id
            ");
            $stmtClean->execute([
                ':school_id'  => $schoolId,
                ':student_id' => $studentId,
                ':date'       => $date,
                ':id'         => (int)$existingId,
            ]);
        } else {
            // Insert a new attendance record
            $stmtInsert = $this->pdo->prepare("
                INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
                VALUES (:school_id, :student_id, :class_id, :date, :status, :marked_by)
                ON DUPLICATE KEY UPDATE
                    status    = VALUES(status),
                    marked_by = VALUES(marked_by),
                    class_id  = COALESCE(VALUES(class_id), class_id)
            ");
            $stmtInsert->execute([
                ':school_id'  => $schoolId,
                ':student_id' => $studentId,
                ':class_id'   => $classId,
                ':date'       => $date,
                ':status'     => $status,
                ':marked_by'  => $markedBy,
            ]);
        }
    }
}
