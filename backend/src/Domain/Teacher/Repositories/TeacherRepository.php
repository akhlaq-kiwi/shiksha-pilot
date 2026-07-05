<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Repositories;

use App\Shared\BaseRepository;
use PDO;

class TeacherRepository extends BaseRepository
{
    protected string $table = 'timetable';

    /**
     * Return timetable rows for a teacher, optionally filtered by day of week.
     */
    public function getSchedule(int $teacherId, ?string $dayOfWeek = null): array
    {
        $sql = "
            SELECT t.*, c.name AS class_name, s.name AS subject_name,
                   pc.start_time, pc.end_time
            FROM timetable t
            LEFT JOIN classes c ON t.class_id = c.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN period_configurations pc ON t.period_number = pc.period_number AND t.school_id = pc.school_id AND pc.end_date IS NULL
            WHERE t.teacher_id = :teacher_id
              AND t.end_date IS NULL
        ";

        $params = [':teacher_id' => $teacherId];

        if ($dayOfWeek !== null) {
            $sql .= ' AND t.day_of_week = :day_of_week';
            $params[':day_of_week'] = $dayOfWeek;
        }

        $sql .= ' ORDER BY t.day_of_week, t.period_number';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Return distinct classes where the teacher has subjects assigned.
     */
    public function getClasses(int $teacherId, int $schoolId): array
    {
        $sql = "
            SELECT DISTINCT c.*, ay.name AS academic_year_name
            FROM subjects s
            JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE s.teacher_id = :teacher_id AND c.school_id = :school_id
            ORDER BY c.name
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':teacher_id' => $teacherId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
