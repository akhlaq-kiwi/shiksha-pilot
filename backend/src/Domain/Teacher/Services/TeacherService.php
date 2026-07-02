<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Services;

use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Domain\SchoolAdmin\Repositories\ExamRepository;
use App\Domain\Teacher\Repositories\AssignmentRepository;
use App\Domain\Teacher\Repositories\MaterialRepository;
use App\Domain\Teacher\Repositories\TeacherRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\ValidationException;
use Psr\Log\LoggerInterface;

class TeacherService extends BaseService
{
    public function __construct(
        private TeacherRepository    $teacherRepo,
        private AssignmentRepository $assignmentRepo,
        private MaterialRepository   $materialRepo,
        private AttendanceRepository $attendanceRepo,
        private ExamRepository       $examRepo,
        ?LoggerInterface             $logger = null,
    ) {
        parent::__construct($logger);
    }

    // -------------------------------------------------------------------------
    // Schedule / Classes
    // -------------------------------------------------------------------------

    /**
     * Return today's timetable entries for the authenticated teacher.
     */
    public function getTodaySchedule(int $teacherId, int $schoolId): array
    {
        $today = date('l'); // e.g. "Monday"
        return $this->teacherRepo->getSchedule($teacherId, $today);
    }

    /**
     * Return all classes in which the teacher has at least one assigned subject.
     */
    public function getMyClasses(int $teacherId, int $schoolId): array
    {
        return $this->teacherRepo->getClasses($teacherId, $schoolId);
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    /**
     * Return active students belonging to a class within the teacher's school.
     *
     * @throws ValidationException when class_id is missing.
     */
    public function getStudentList(int $schoolId, ?int $classId): array
    {
        if ($classId === null) {
            throw new ValidationException('class_id query parameter is required');
        }

        $pdo  = $this->attendanceRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT s.*, c.name AS class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.class_id = :class_id AND s.school_id = :school_id AND s.status = 'ACTIVE'
            ORDER BY s.name
        ");
        $stmt->execute([':class_id' => $classId, ':school_id' => $schoolId]);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    /**
     * Upsert a single attendance record.
     *
     * @throws ValidationException when student_id is missing.
     */
    public function markAttendance(array $user, array $data): array
    {
        $studentId = isset($data['student_id']) ? (int) $data['student_id'] : null;

        if ($studentId === null) {
            throw new ValidationException('student_id is required');
        }

        $date    = $data['date']     ?? date('Y-m-d');
        $status  = $data['status']   ?? 'Present';
        $classId = isset($data['class_id']) ? (int) $data['class_id'] : null;

        $pdo = $this->attendanceRepo->getPdo();
        $schoolId = (int)$user['school_id'];
        
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if ($workingYear) {
            $startDate = $workingYear['start_date'];
            $today = date('Y-m-d');
            if ($date < $startDate) {
                throw new ValidationException(['date' => "Cannot mark attendance before the academic year started ($startDate)."]);
            }
            if ($date > $today) {
                throw new ValidationException(['date' => "Cannot mark attendance for a future date."]);
            }
        }

        // Sunday validation
        if (date('N', strtotime($date)) == 7) {
            throw new ValidationException(['date' => 'Cannot mark attendance on a Sunday.']);
        }

        // Holiday validation
        $stmtHCheck = $pdo->prepare("SELECT id FROM holidays WHERE school_id = :sid AND date = :date LIMIT 1");
        $stmtHCheck->execute([':sid' => $schoolId, ':date' => $date]);
        if ($stmtHCheck->fetchColumn() !== false) {
            throw new ValidationException(['date' => 'Cannot mark attendance on a holiday.']);
        }

        $this->attendanceRepo->upsert([
            ':school_id'  => (int) $user['school_id'],
            ':student_id' => $studentId,
            ':class_id'   => $classId,
            ':date'       => $date,
            ':status'     => $status,
            ':marked_by'  => (int) $user['id'],
        ]);

        return ['success' => true, 'date' => $date, 'status' => $status];
    }

    /**
     * Return attendance records marked by the teacher, with optional class_id / date filters.
     */
    public function getAttendanceHistory(int $teacherId, array $filters = []): array
    {
        return $this->attendanceRepo->findByMarker($teacherId, $filters);
    }

    // -------------------------------------------------------------------------
    // Assignments
    // -------------------------------------------------------------------------

    public function getAssignments(int $teacherId, int $schoolId): array
    {
        return $this->assignmentRepo->findByTeacher($teacherId, $schoolId);
    }

    /**
     * @throws ValidationException when title is missing.
     */
    public function createAssignment(array $user, array $data): array
    {
        $title = trim($data['title'] ?? '');

        if ($title === '') {
            throw new ValidationException('Assignment title is required');
        }

        $id = $this->assignmentRepo->create([
            'school_id'   => (int) $user['school_id'],
            'class_id'    => isset($data['class_id'])   ? (int) $data['class_id']   : null,
            'subject_id'  => isset($data['subject_id']) ? (int) $data['subject_id'] : null,
            'teacher_id'  => (int) $user['id'],
            'title'       => $title,
            'description' => $data['description'] ?? null,
            'due_date'    => $data['due_date']    ?? null,
        ]);

        return $this->assignmentRepo->findById($id) ?? [];
    }

    // -------------------------------------------------------------------------
    // Learning Materials
    // -------------------------------------------------------------------------

    public function getMaterials(int $teacherId, int $schoolId): array
    {
        return $this->materialRepo->findByTeacher($teacherId, $schoolId);
    }

    /**
     * @throws ValidationException when title is missing.
     */
    public function createMaterial(array $user, array $data): array
    {
        $title = trim($data['title'] ?? '');

        if ($title === '') {
            throw new ValidationException('Material title is required');
        }

        $id = $this->materialRepo->create([
            'school_id'  => (int) $user['school_id'],
            'class_id'   => isset($data['class_id'])   ? (int) $data['class_id']   : null,
            'subject_id' => isset($data['subject_id']) ? (int) $data['subject_id'] : null,
            'teacher_id' => (int) $user['id'],
            'title'      => $title,
            'type'       => $data['type'] ?? 'Other',
            'url'        => $data['url']  ?? null,
        ]);

        return $this->materialRepo->findById($id) ?? [];
    }

    // -------------------------------------------------------------------------
    // Exams / Marks
    // -------------------------------------------------------------------------

    public function getExams(int $teacherId, int $schoolId): array
    {
        return $this->examRepo->findByTeacher($teacherId, $schoolId);
    }

    /**
     * Upsert exam marks for a student.
     *
     * @throws ValidationException when exam_id or student_id are missing.
     */
    public function enterMarks(array $data): array
    {
        $examId    = isset($data['exam_id'])    ? (int) $data['exam_id']    : null;
        $studentId = isset($data['student_id']) ? (int) $data['student_id'] : null;

        if ($examId === null || $studentId === null) {
            throw new ValidationException('exam_id and student_id are required');
        }

        $this->examRepo->upsertMarks([
            ':exam_id'        => $examId,
            ':student_id'     => $studentId,
            ':marks_obtained' => $data['marks_obtained'] ?? null,
            ':grade'          => $data['grade']          ?? null,
            ':remarks'        => $data['remarks']        ?? null,
        ]);

        return ['success' => true];
    }
}
