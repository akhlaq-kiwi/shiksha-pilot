<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Domain\SchoolAdmin\Repositories\ClassRepository;
use App\Domain\SchoolAdmin\Repositories\ExamRepository;
use App\Domain\SchoolAdmin\Repositories\FeeRepository;
use App\Domain\SchoolAdmin\Repositories\StaffRepository;
use App\Domain\SchoolAdmin\Repositories\StudentRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use PDO;
use Psr\Log\LoggerInterface;

class SchoolAdminService extends BaseService
{
    public function __construct(
        private readonly StudentRepository    $studentRepo,
        private readonly StaffRepository      $staffRepo,
        private readonly ClassRepository      $classRepo,
        private readonly AttendanceRepository $attendanceRepo,
        private readonly ExamRepository       $examRepo,
        private readonly FeeRepository        $feeRepo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    // -------------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------------

    public function getDashboardStats(array $user): array
    {
        $schoolId = (int) $user['school_id'];

        return [
            'students_count' => $this->studentRepo->countBySchool($schoolId, 'ACTIVE'),
            'staff_count'    => $this->staffRepo->countBySchool($schoolId, 'ACTIVE'),
            'classes_count'  => $this->classRepo->countBySchool($schoolId),
            'pending_fees'   => $this->feeRepo->countPendingBySchool($schoolId),
        ];
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    public function getStudents(array $user, array $filters = []): array
    {
        return $this->studentRepo->findBySchool((int) $user['school_id'], $filters);
    }

    public function createStudent(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Student name is required']);
        }

        $schoolId = (int) $user['school_id'];

        $id = $this->studentRepo->create([
            'school_id'    => $schoolId,
            'name'         => $data['name'],
            'admission_no' => $data['admission_no'] ?? null,
            'class_id'     => $data['class_id'] ?? null,
            'parent_phone' => $data['parent_phone'] ?? null,
            'email'        => $data['email'] ?? null,
            'status'       => $data['status'] ?? 'ACTIVE',
            'dob'          => $data['dob'] ?? null,
            'address'      => $data['address'] ?? null,
        ]);

        $student = $this->studentRepo->findById($id);

        if ($student === null) {
            throw new NotFoundException('Student not found after creation');
        }

        $this->log('Student created', ['id' => $id, 'school_id' => $schoolId]);

        return $student;
    }

    // -------------------------------------------------------------------------
    // Staff
    // -------------------------------------------------------------------------

    public function getStaff(array $user): array
    {
        return $this->staffRepo->findBySchool((int) $user['school_id']);
    }

    public function createStaff(array $user, array $data): array
    {
        if (empty($data['name']) || empty($data['role'])) {
            throw new ValidationException(['fields' => 'Staff name and role are required']);
        }

        $schoolId = (int) $user['school_id'];

        $id = $this->staffRepo->create([
            'school_id'    => $schoolId,
            'name'         => $data['name'],
            'employee_id'  => $data['employee_id'] ?? null,
            'role'         => $data['role'],
            'department'   => $data['department'] ?? null,
            'phone'        => $data['phone'] ?? null,
            'email'        => $data['email'] ?? null,
            'status'       => $data['status'] ?? 'ACTIVE',
            'salary'       => $data['salary'] ?? null,
            'joining_date' => $data['joining_date'] ?? null,
        ]);

        $member = $this->staffRepo->findById($id);

        if ($member === null) {
            throw new NotFoundException('Staff member not found after creation');
        }

        $this->log('Staff member created', ['id' => $id, 'school_id' => $schoolId]);

        return $member;
    }

    // -------------------------------------------------------------------------
    // Classes
    // -------------------------------------------------------------------------

    public function getClasses(array $user): array
    {
        return $this->classRepo->findBySchool((int) $user['school_id']);
    }

    public function createClass(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Class name is required']);
        }

        $schoolId = (int) $user['school_id'];

        $id = $this->classRepo->create([
            'school_id'        => $schoolId,
            'name'             => $data['name'],
            'section'          => $data['section'] ?? null,
            'stream'           => $data['stream'] ?? null,
            'academic_year_id' => $data['academic_year_id'] ?? null,
        ]);

        $class = $this->classRepo->findById($id);

        if ($class === null) {
            throw new NotFoundException('Class not found after creation');
        }

        $this->log('Class created', ['id' => $id, 'school_id' => $schoolId]);

        return $class;
    }

    // -------------------------------------------------------------------------
    // Academic years (read-only, via raw PDO through ClassRepository escape hatch)
    // -------------------------------------------------------------------------

    public function getAcademicYears(array $user): array
    {
        $pdo  = $this->classRepo->getPdo();
        $stmt = $pdo->prepare(
            "SELECT * FROM academic_years WHERE school_id = :sid ORDER BY id DESC"
        );
        $stmt->execute([':sid' => (int) $user['school_id']]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    public function getAttendance(array $user, array $filters = []): array
    {
        return $this->attendanceRepo->findBySchool((int) $user['school_id'], $filters);
    }

    public function markAttendance(array $user, array $data): array
    {
        if (empty($data['student_id'])) {
            throw new ValidationException(['student_id' => 'student_id is required']);
        }

        $date   = $data['date'] ?? date('Y-m-d');
        $status = $data['status'] ?? 'Present';

        $this->attendanceRepo->upsert([
            'school_id'  => (int) $user['school_id'],
            'student_id' => (int) $data['student_id'],
            'class_id'   => isset($data['class_id']) ? (int) $data['class_id'] : null,
            'date'       => $date,
            'status'     => $status,
            'marked_by'  => (int) $user['id'],
        ]);

        return ['success' => true, 'date' => $date, 'status' => $status];
    }

    // -------------------------------------------------------------------------
    // Exams
    // -------------------------------------------------------------------------

    public function getExams(array $user): array
    {
        return $this->examRepo->findBySchool((int) $user['school_id']);
    }

    public function createExam(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Exam name is required']);
        }

        $schoolId = (int) $user['school_id'];

        $id = $this->examRepo->create([
            'school_id'  => $schoolId,
            'name'       => $data['name'],
            'class_id'   => $data['class_id'] ?? null,
            'subject_id' => $data['subject_id'] ?? null,
            'exam_date'  => $data['exam_date'] ?? null,
            'max_marks'  => $data['max_marks'] ?? null,
        ]);

        $exam = $this->examRepo->findById($id);

        if ($exam === null) {
            throw new NotFoundException('Exam not found after creation');
        }

        $this->log('Exam created', ['id' => $id, 'school_id' => $schoolId]);

        return $exam;
    }

    public function getExamMarks(array $filters = []): array
    {
        return $this->examRepo->findMarks($filters);
    }

    public function enterMarks(array $data): array
    {
        if (empty($data['exam_id']) || empty($data['student_id'])) {
            throw new ValidationException(['fields' => 'exam_id and student_id are required']);
        }

        $this->examRepo->upsertMarks([
            'exam_id'        => (int) $data['exam_id'],
            'student_id'     => (int) $data['student_id'],
            'marks_obtained' => $data['marks_obtained'] ?? null,
            'grade'          => $data['grade'] ?? null,
            'remarks'        => $data['remarks'] ?? null,
        ]);

        return ['success' => true];
    }

    // -------------------------------------------------------------------------
    // Fees
    // -------------------------------------------------------------------------

    public function getFeeStructures(array $user): array
    {
        return $this->feeRepo->findBySchool((int) $user['school_id']);
    }

    public function getFeePayments(array $user): array
    {
        return $this->feeRepo->findPayments((int) $user['school_id']);
    }

    // -------------------------------------------------------------------------
    // Timetable & Subjects (read-only, via raw PDO through classRepo escape hatch)
    // -------------------------------------------------------------------------

    public function getTimetable(array $user): array
    {
        $pdo  = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT t.*, c.name AS class_name, s.name AS subject_name, u.name AS teacher_name
            FROM timetable t
            LEFT JOIN classes  c ON t.class_id   = c.id
            LEFT JOIN subjects s ON t.subject_id  = s.id
            LEFT JOIN users    u ON t.teacher_id  = u.id
            WHERE t.school_id = :sid
            ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
                     t.start_time
        ");
        $stmt->execute([':sid' => (int) $user['school_id']]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSubjects(array $user): array
    {
        $pdo  = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT s.*, c.name AS class_name, u.name AS teacher_name
            FROM subjects s
            LEFT JOIN classes c ON s.class_id   = c.id
            LEFT JOIN users   u ON s.teacher_id = u.id
            WHERE s.school_id = :sid
            ORDER BY s.id DESC
        ");
        $stmt->execute([':sid' => (int) $user['school_id']]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
