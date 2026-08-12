<?php

declare(strict_types=1);

namespace App\Domain\Student\Repositories;

use App\Shared\BaseRepository;
use PDO;

class StudentDataRepository extends BaseRepository
{
    protected string $table = 'students';

    // -------------------------------------------------------------------------
    // Student resolution
    // -------------------------------------------------------------------------

    /**
     * Find a student joined with their class row.
     * Returns null when no matching student exists.
     */
    public function findWithClass(int $studentId): ?array
    {
        $sql = "
            SELECT s.*, c.name AS class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.id = :id
            LIMIT 1
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $studentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row !== false ? $row : null;
    }

    /**
     * Resolve the student linked to a STUDENT-role user (matched by email + school).
     */
    public function findByUserEmail(string $email, int $schoolId): ?array
    {
        return $this->findOne(['email' => $email, 'school_id' => $schoolId]);
    }

    /**
     * Resolve the student linked to a PARENT-role user (matched by parent_phone + school).
     */
    public function findByParentPhone(string $phone, int $schoolId): ?array
    {
        return $this->findOne(['parent_phone' => $phone, 'school_id' => $schoolId]);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    /**
     * All attendance records for a student, most recent first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAttendance(int $studentId): array
    {
        $sql = "
            SELECT *
            FROM attendance
            WHERE student_id = :sid
            ORDER BY date DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':sid' => $studentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Exam results
    // -------------------------------------------------------------------------

    /**
     * Exam marks joined with exam and subject detail for a student.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getResults(int $studentId): array
    {
        $sql = "
            SELECT em.*,
                   e.name       AS exam_name,
                   e.max_marks,
                   e.exam_date,
                   s.name       AS subject_name
            FROM exam_marks em
            JOIN  exams    e ON em.exam_id    = e.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE em.student_id = :sid
            ORDER BY e.exam_date DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':sid' => $studentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Fee payments
    // -------------------------------------------------------------------------

    /**
     * Fee payment records joined with fee structure name for a student.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getFeePayments(int $studentId): array
    {
        $sql = "
            SELECT fp.*,
                   fs.name AS fee_structure_name
            FROM fee_payments fp
            LEFT JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.student_id = :sid
            ORDER BY fp.payment_date DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':sid' => $studentId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Dashboard aggregation
    // -------------------------------------------------------------------------

    /**
     * Aggregate stats for the student dashboard:
     *   - attendance_pct   : float  — present / total over last 30 days (0 when no records)
     *   - pending_fees     : int    — count of Pending or Overdue fee_payments rows
     *   - upcoming_exams   : array  — up to 5 future exams for the student's class
     *
     * @return array{attendance_pct: float, pending_fees: int, upcoming_exams: array}
     */
    public function getDashboardStats(int $studentId): array
    {
        // Attendance percentage (last 30 days)
        $attSql = "
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present
            FROM attendance
            WHERE student_id = :sid
              AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ";
        $attStmt = $this->pdo->prepare($attSql);
        $attStmt->execute([':sid' => $studentId]);
        $att = $attStmt->fetch(PDO::FETCH_ASSOC);

        $attendancePct = ($att['total'] > 0)
            ? round(($att['present'] / $att['total']) * 100, 1)
            : 0.0;

        // Outstanding fee count
        $feeSql = "
            SELECT COUNT(*) AS pending_count
            FROM fee_payments
            WHERE student_id = :sid
              AND status IN ('Pending', 'Overdue')
        ";
        $feeStmt = $this->pdo->prepare($feeSql);
        $feeStmt->execute([':sid' => $studentId]);
        $fee = $feeStmt->fetch(PDO::FETCH_ASSOC);

        // Upcoming exams — requires class_id; fetch the student row first
        $student = $this->findById($studentId);
        $classId = $student['class_id'] ?? null;

        $upcomingExams = [];
        if ($classId !== null) {
            $examSql = "
                SELECT e.*, s.name AS subject_name
                FROM exams e
                LEFT JOIN subjects s ON e.subject_id = s.id
                WHERE e.class_id = :class_id
                  AND e.exam_date >= CURDATE()
                ORDER BY e.exam_date ASC
                LIMIT 5
            ";
            $examStmt = $this->pdo->prepare($examSql);
            $examStmt->execute([':class_id' => $classId]);
            $upcomingExams = $examStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return [
            'attendance_pct'  => (float) $attendancePct,
            'pending_fees'    => (int) $fee['pending_count'],
            'upcoming_exams'  => $upcomingExams,
        ];
    }

    // -------------------------------------------------------------------------
    // Class-scoped queries (timetable / assignments / fees / materials)
    // -------------------------------------------------------------------------

    /**
     * Timetable entries for the student's class, ordered by weekday then start time.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getTimetable(int $classId, int $schoolId, ?string $date = null): array
    {
        $targetDate = $date ?? date('Y-m-d');
        try {
            $dt = new \DateTime($targetDate);
            $dayOfWeek = $dt->format('l');
        } catch (\Exception $e) {
            $dayOfWeek = date('l');
            $targetDate = date('Y-m-d');
        }

        $sql = "
            SELECT t.*,
                   s.name AS subject_name,
                   st.name AS teacher_name,
                   pc.start_time,
                   pc.end_time
            FROM timetable t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN staff    st ON t.teacher_id  = st.id
            LEFT JOIN period_configurations pc ON t.period_number = pc.period_number AND t.school_id = pc.school_id AND pc.end_date IS NULL
            WHERE t.class_id  = :class_id
              AND t.school_id = :school_id
              AND t.day_of_week = :day
              AND t.is_published = 1
              AND t.start_date <= :target_date
              AND (t.end_date IS NULL OR t.end_date >= :target_date2)
            ORDER BY t.period_number
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':class_id' => $classId,
            ':school_id' => $schoolId,
            ':day' => $dayOfWeek,
            ':target_date' => $targetDate,
            ':target_date2' => $targetDate
        ]);

        $periods = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stmtBackup = $this->pdo->prepare("
            SELECT b.backup_teacher_id, st.name AS backup_teacher_name
            FROM timetable_backups b
            JOIN staff st ON b.backup_teacher_id = st.id
            WHERE b.timetable_id = :tid AND b.date = :date
        ");

        foreach ($periods as &$p) {
            $stmtBackup->execute([':tid' => $p['id'], ':date' => $targetDate]);
            $backup = $stmtBackup->fetch(PDO::FETCH_ASSOC);
            if ($backup) {
                $p['backup_teacher_id'] = (int)$backup['backup_teacher_id'];
                $p['teacher_name'] = $backup['backup_teacher_name'];
                $p['is_backup'] = true;
            } else {
                $p['is_backup'] = false;
            }
        }

        $stmtConfig = $this->pdo->prepare("
            SELECT * FROM period_configurations 
            WHERE school_id = :sid AND end_date IS NULL 
            ORDER BY period_number
        ");
        $stmtConfig->execute([':sid' => $schoolId]);
        $configs = $stmtConfig->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $periodsByNum = [];
        foreach ($periods as $p) {
            $periodsByNum[(int)$p['period_number']] = $p;
        }

        $finalSchedule = [];
        foreach ($configs as $cfg) {
            $pNum = (int)$cfg['period_number'];
            if (isset($periodsByNum[$pNum])) {
                $finalSchedule[] = $periodsByNum[$pNum];
            } else {
                $finalSchedule[] = [
                    'is_free' => true,
                    'period_number' => $pNum,
                    'start_time' => $cfg['start_time'],
                    'end_time' => $cfg['end_time'],
                    'school_id' => $schoolId,
                    'day_of_week' => $dayOfWeek
                ];
            }
        }

        return $finalSchedule;
    }

    /**
     * Assignments for the student's class, ordered by due date ascending.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAssignments(int $classId, int $schoolId): array
    {
        $sql = "
            SELECT a.*,
                   s.name AS subject_name,
                   u.name AS teacher_name
            FROM assignments a
            LEFT JOIN subjects s ON a.subject_id = s.id
            LEFT JOIN users   u ON a.teacher_id  = u.id
            WHERE a.class_id  = :class_id
              AND a.school_id = :school_id
            ORDER BY a.due_date ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':class_id' => $classId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Applicable fee structures for the student's class (class-specific + school-wide).
     *
     * @return array<int, array<string, mixed>>
     */
    public function getFeeStructures(int $classId, int $schoolId): array
    {
        $sql = "
            SELECT fs.*
            FROM fee_structures fs
            WHERE fs.school_id = :school_id
              AND (fs.class_id = :class_id OR fs.class_id IS NULL)
            ORDER BY fs.id DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':school_id' => $schoolId, ':class_id' => $classId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Learning materials for the student's class, newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getMaterials(int $classId, int $schoolId): array
    {
        $sql = "
            SELECT lm.*,
                   s.name AS subject_name,
                   u.name AS teacher_name
            FROM learning_materials lm
            LEFT JOIN subjects s ON lm.subject_id = s.id
            LEFT JOIN users   u ON lm.teacher_id  = u.id
            WHERE lm.class_id  = :class_id
              AND lm.school_id = :school_id
            ORDER BY lm.id DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':class_id' => $classId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
