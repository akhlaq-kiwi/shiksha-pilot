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

    private function getSchoolId(array $user): int
    {
        if (isset($user['school_id'])) {
            return (int) $user['school_id'];
        }

        $userId = (int) ($user['id'] ?? 0);
        if ($userId <= 0) {
            return 0;
        }

        $pdo = $this->studentRepo->getPdo();
        $stmt = $pdo->prepare("SELECT school_id FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $val = $stmt->fetchColumn();

        return $val !== false ? (int) $val : 0;
    }

    // -------------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------------

    public function getDashboardStats(array $user): array
    {
        $schoolId = $this->getSchoolId($user);

        return [
            'students_count' => $this->studentRepo->countBySchool($schoolId, 'ACTIVE'),
            'staff_count'    => $this->staffRepo->countBySchool($schoolId, 'ACTIVE'),
            'classes_count'  => $this->classRepo->countBySchool($schoolId),
            'pending_fees'   => $this->feeRepo->countPendingBySchool($schoolId),
            'total_collected' => $this->feeRepo->getTotalCollectedBySchool($schoolId),
        ];
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    public function getStudents(array $user, array $filters = []): array
    {
        return $this->studentRepo->findBySchool($this->getSchoolId($user), $filters);
    }

    public function createStudent(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Student name is required']);
        }

        $schoolId = $this->getSchoolId($user);

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
        return $this->staffRepo->findBySchool($this->getSchoolId($user));
    }

    public function createStaff(array $user, array $data): array
    {
        if (empty($data['name']) || empty($data['role'])) {
            throw new ValidationException(['fields' => 'Staff name and role are required']);
        }

        $schoolId = $this->getSchoolId($user);

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
        return $this->classRepo->findBySchool($this->getSchoolId($user));
    }

    public function createClass(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Class name is required']);
        }

        $schoolId = $this->getSchoolId($user);

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
        $stmt->execute([':sid' => $this->getSchoolId($user)]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    public function getAttendance(array $user, array $filters = []): array
    {
        return $this->attendanceRepo->findBySchool($this->getSchoolId($user), $filters);
    }

    public function markAttendance(array $user, array $data): array
    {
        if (empty($data['student_id'])) {
            throw new ValidationException(['student_id' => 'student_id is required']);
        }

        $date   = $data['date'] ?? date('Y-m-d');
        $status = $data['status'] ?? 'Present';

        $this->attendanceRepo->upsert([
            'school_id'  => $this->getSchoolId($user),
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
        return $this->examRepo->findBySchool($this->getSchoolId($user));
    }

    public function createExam(array $user, array $data): array
    {
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'Exam name is required']);
        }

        $schoolId = $this->getSchoolId($user);

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
        return $this->feeRepo->findBySchool($this->getSchoolId($user));
    }

    public function getFeePayments(array $user): array
    {
        return $this->feeRepo->findPayments($this->getSchoolId($user));
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
        $stmt->execute([':sid' => $this->getSchoolId($user)]);

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
        $stmt->execute([':sid' => $this->getSchoolId($user)]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createFeeStructure(array $user, array $data): array
    {
        if (empty($data['name']) || empty($data['amount'])) {
            throw new ValidationException(['fields' => 'Fee structure name and amount are required']);
        }

        $schoolId = $this->getSchoolId($user);

        $id = $this->feeRepo->create([
            'school_id' => $schoolId,
            'name'      => $data['name'],
            'amount'    => (float) $data['amount'],
            'frequency' => $data['frequency'] ?? 'Monthly',
            'class_id'  => !empty($data['class_id']) ? (int) $data['class_id'] : null,
        ]);

        $structure = $this->feeRepo->findById($id);

        if ($structure === null) {
            throw new NotFoundException('Fee structure not found after creation');
        }

        return $structure;
    }

    public function createFeePayment(array $user, array $data): array
    {
        if (empty($data['student_id']) || empty($data['amount_paid'])) {
            throw new ValidationException(['fields' => 'Student and Amount Paid are required']);
        }

        $schoolId = $this->getSchoolId($user);

        $id = $this->feeRepo->createPayment([
            'school_id'        => $schoolId,
            'student_id'       => (int) $data['student_id'],
            'fee_structure_id' => !empty($data['fee_structure_id']) ? (int) $data['fee_structure_id'] : null,
            'amount_paid'      => (float) $data['amount_paid'],
            'payment_date'     => $data['payment_date'] ?? date('Y-m-d'),
            'receipt_no'       => $data['receipt_no'] ?? ('REC-' . time() . '-' . rand(10, 99)),
            'status'           => $data['status'] ?? 'PAID',
        ]);

        $payment = $this->feeRepo->findPaymentById($id);

        if ($payment === null) {
            throw new NotFoundException('Payment not found after recording');
        }

        return $payment;
    }

    public function getSchoolProfile(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $schoolId]);
        $school = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($school === false) {
            throw new NotFoundException('School not found');
        }

        return $school;
    }

    public function updateSchoolProfile(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("
            UPDATE schools SET
                name = :name,
                contact_phone = :contact_phone,
                contact_email = :contact_email,
                registration_no = :registration_no,
                affiliation_board = :affiliation_board,
                school_type = :school_type,
                founded_year = :founded_year,
                medium_of_instruction = :medium_of_instruction,
                street_address = :street_address,
                city = :city,
                state = :state,
                pin_code = :pin_code,
                current_term = :current_term,
                term_start = :term_start,
                term_end = :term_end,
                classes_offered = :classes_offered
            WHERE id = :id
        ");

        $stmt->execute([
            ':name'                  => $data['name'] ?? '',
            ':contact_phone'         => $data['contact_phone'] ?? null,
            ':contact_email'         => $data['contact_email'] ?? null,
            ':registration_no'       => $data['registration_no'] ?? null,
            ':affiliation_board'     => $data['affiliation_board'] ?? null,
            ':school_type'           => $data['school_type'] ?? null,
            ':founded_year'          => $data['founded_year'] ?? null,
            ':medium_of_instruction' => $data['medium_of_instruction'] ?? null,
            ':street_address'        => $data['street_address'] ?? null,
            ':city'                  => $data['city'] ?? null,
            ':state'                 => $data['state'] ?? null,
            ':pin_code'              => $data['pin_code'] ?? null,
            ':current_term'          => $data['current_term'] ?? null,
            ':term_start'            => $data['term_start'] ?? null,
            ':term_end'              => $data['term_end'] ?? null,
            ':classes_offered'       => $data['classes_offered'] ?? null,
            ':id'                    => $schoolId,
        ]);

        return $this->getSchoolProfile($user);
    }
}
