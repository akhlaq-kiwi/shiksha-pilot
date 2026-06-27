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

    public function getStudentById(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $student = $this->studentRepo->findDetailById($schoolId, $id);
        if ($student === null) {
            throw new NotFoundException('Student not found');
        }

        if (!empty($student['class_name'])) {
            $sectionStr = !empty($student['section']) ? ' - ' . $student['section'] : '';
            $student['class_name'] = $student['class_name'] . $sectionStr;
        }

        // Query Fee Summary: count and sum of payments
        $pdo = $this->studentRepo->getPdo();
        $feeStmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) AS total_paid, COUNT(*) AS payment_count
            FROM fee_payments
            WHERE student_id = :student_id AND status = 'PAID'
        ");
        $feeStmt->execute([':student_id' => $id]);
        $feeSummary = $feeStmt->fetch(PDO::FETCH_ASSOC);

        $paymentsStmt = $pdo->prepare("
            SELECT * FROM fee_payments
            WHERE student_id = :student_id AND status = 'PAID'
            ORDER BY id ASC
        ");
        $paymentsStmt->execute([':student_id' => $id]);
        $payments = $paymentsStmt->fetchAll(PDO::FETCH_ASSOC);
        $feeSummary['payments'] = $payments;

        // Query Attendance Summary
        $attStmt = $pdo->prepare("
            SELECT 
                COUNT(*) AS total_marked,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_count
            FROM attendance
            WHERE student_id = :student_id
        ");
        $attStmt->execute([':student_id' => $id]);
        $attSummary = $attStmt->fetch(PDO::FETCH_ASSOC);

        // Query Examination Summary
        $examStmt = $pdo->prepare("
            SELECT em.*, e.name AS exam_name, s.name AS subject_name, e.exam_date, e.max_marks
            FROM exam_marks em
            INNER JOIN exams e ON em.exam_id = e.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE em.student_id = :student_id
            ORDER BY e.exam_date DESC
        ");
        $examStmt->execute([':student_id' => $id]);
        $examResults = $examStmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'student' => $student,
            'fee_summary' => [
                'total_paid' => (float)$feeSummary['total_paid'],
                'payment_count' => (int)$feeSummary['payment_count'],
                'payments' => $feeSummary['payments'] ?? []
            ],
            'attendance_summary' => [
                'total_marked' => (int)$attSummary['total_marked'],
                'present_count' => (int)$attSummary['present_count'],
                'percentage' => $attSummary['total_marked'] > 0 
                    ? round(($attSummary['present_count'] / $attSummary['total_marked']) * 100, 1) 
                    : 100.0
            ],
            'exam_results' => $examResults
        ];
    }

    public function isFirstAcademicYear(int $schoolId, int $academicYearId): bool
    {
        $pdo = $this->studentRepo->getPdo();
        $stmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id ORDER BY start_date ASC");
        $stmt->execute([':school_id' => $schoolId]);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (count($ids) <= 1) {
            return true;
        }
        return (int)$ids[0] === $academicYearId;
    }

    public function getHighestSrNo(int $schoolId): int
    {
        $pdo = $this->studentRepo->getPdo();
        $stmt = $pdo->prepare("SELECT sr_no FROM students WHERE school_id = :school_id");
        $stmt->execute([':school_id' => $schoolId]);
        $srNos = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        $maxVal = 0;
        foreach ($srNos as $sr) {
            if ($sr === null || $sr === '') continue;
            if (preg_match('/(\d+)/', $sr, $matches)) {
                $maxVal = max($maxVal, (int)$matches[1]);
            }
        }
        return $maxVal;
    }

    public function createStudent(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        
        // 1. Validations
        $errors = [];
        if (empty($data['first_name'])) {
            $errors['first_name'] = 'First name is required';
        }
        if (empty($data['last_name'])) {
            $errors['last_name'] = 'Last name is required';
        }
        if (empty($data['gender'])) {
            $errors['gender'] = 'Gender is required';
        }
        if (empty($data['dob'])) {
            $errors['dob'] = 'Date of birth is required';
        }
        if (empty($data['class_name'])) {
            $errors['class_name'] = 'Class is required';
        }

        // Email and phone formats
        if (!empty($data['student_email']) && !filter_var($data['student_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['student_email'] = 'Invalid student email format';
        }
        if (!empty($data['student_mobile']) && !preg_match('/^[0-9]+$/', $data['student_mobile'])) {
            $errors['student_mobile'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['roll_no']) && !preg_match('/^[0-9]+$/', $data['roll_no'])) {
            $errors['roll_no'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['sr_no']) && !preg_match('/^[0-9]+$/', $data['sr_no'])) {
            $errors['sr_no'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['aadhaar_no']) && !preg_match('/^[0-9]+$/', $data['aadhaar_no'])) {
            $errors['aadhaar_no'] = 'Only numeric digits are allowed.';
        }

        // Get currently active academic year
        $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_current = 1 LIMIT 1");
        $stmtYear->execute([':school_id' => $schoolId]);
        $yearId = $stmtYear->fetchColumn();
        if ($yearId !== false) {
            $academicYearId = (int)$yearId;
        } else {
            $stmt2 = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id ORDER BY start_date DESC LIMIT 1");
            $stmt2->execute([':school_id' => $schoolId]);
            $yearId = $stmt2->fetchColumn();
            $academicYearId = $yearId !== false ? (int)$yearId : 0;
        }

        // Parse and create class if it doesn't exist
        $classId = null;
        if (!empty($data['class_id'])) {
            $classId = (int)$data['class_id'];
        } elseif (!empty($data['class_name'])) {
            $classNameInput = trim((string)$data['class_name']);
            $section = null;
            $finalName = $classNameInput;
            
            if (preg_match('/^(.*?)\s*-\s*([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            } elseif (preg_match('/^(.*?)\s+([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            } elseif (preg_match('/^(.*?)-([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            }
            
            $stmtClass = $pdo->prepare("SELECT id FROM classes WHERE school_id = :school_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) LIMIT 1");
            $stmtClass->execute([
                ':school_id' => $schoolId,
                ':name' => $finalName,
                ':section' => $section,
                ':section_null' => $section === null ? 1 : 0
            ]);
            $existingClassId = $stmtClass->fetchColumn();
            if ($existingClassId !== false) {
                $classId = (int)$existingClassId;
            } else {
                $insStmt = $pdo->prepare("INSERT INTO classes (school_id, name, section, academic_year_id) VALUES (:school_id, :name, :section, :academic_year_id)");
                $insStmt->execute([
                    ':school_id' => $schoolId,
                    ':name' => $finalName,
                    ':section' => $section,
                    ':academic_year_id' => $academicYearId > 0 ? $academicYearId : null
                ]);
                $classId = (int)$pdo->lastInsertId();
            }
        }

        // SR number logic
        $isFirstYear = $this->isFirstAcademicYear($schoolId, $academicYearId);
        
        $srNo = '';
        if ($isFirstYear) {
            // Manual mode
            if (empty($data['sr_no'])) {
                $errors['sr_no'] = 'SR number is required for the first academic year';
            } else {
                $srNo = trim((string)$data['sr_no']);
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND sr_no = :sr_no");
                $stmt->execute([':school_id' => $schoolId, ':sr_no' => $srNo]);
                if ((int)$stmt->fetchColumn() > 0) {
                    $errors['sr_no'] = 'SR number already exists in this school';
                }
            }
        } else {
            // Auto generation mode
            $highest = $this->getHighestSrNo($schoolId);
            $srNo = (string)($highest > 0 ? $highest + 1 : 1001);
        }

        if (!empty($errors)) {
            throw new ValidationException($errors);
        }

        // Full name
        $name = trim($data['first_name'] . ' ' . ($data['middle_name'] ?? '') . ' ' . $data['last_name']);
        $name = (string)preg_replace('/\s+/', ' ', $name);

        // System defaults for status based on exit date
        $exitDate = !empty($data['exit_date']) ? $data['exit_date'] : null;
        $status = $exitDate !== null ? 'Inactive' : 'ACTIVE';
        $admissionDate = date('Y-m-d');

        $id = $this->studentRepo->create([
            'school_id'    => $schoolId,
            'name'         => $name,
            'admission_no' => null,
            'class_id'     => $classId,
            'parent_phone' => null,
            'email'        => $data['student_email'] ?? null,
            'status'       => $status,
            'dob'          => $data['dob'] ?? null,
            'address'      => $data['current_address_line'] ?? null,
            
            // Comprehensive columns
            'sr_no' => $srNo,
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name' => $data['last_name'],
            'gender' => $data['gender'],
            'blood_group' => $data['blood_group'] ?? null,
            'category' => $data['category'] ?? null,
            'religion' => $data['religion'] ?? null,
            'aadhaar_no' => $data['aadhaar_no'] ?? null,
            'student_mobile' => $data['student_mobile'] ?? null,
            'student_email' => $data['student_email'] ?? null,
            'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
            'admission_date' => $admissionDate,
            'roll_no' => $data['roll_no'] ?? null,
            'house' => null,
            
            'father_name' => $data['father_name'] ?? null,
            'father_phone' => null,
            'father_email' => null,
            'father_occupation' => $data['parent_occupation'] ?? null,
            'mother_name' => $data['mother_name'] ?? null,
            'mother_phone' => null,
            'mother_email' => null,
            'mother_occupation' => null,
            'guardian_name' => null,
            'guardian_relation' => null,
            'guardian_phone' => null,
            
            'current_address_line' => $data['current_address_line'] ?? null,
            'current_city' => $data['current_city'] ?? null,
            'current_state' => $data['current_state'] ?? null,
            'current_country' => $data['current_country'] ?? null,
            'current_pin_code' => $data['current_pin_code'] ?? null,
            'permanent_address_line' => $data['permanent_address_line'] ?? null,
            'permanent_city' => $data['permanent_city'] ?? null,
            'permanent_state' => $data['permanent_state'] ?? null,
            'permanent_country' => $data['permanent_country'] ?? null,
            'permanent_pin_code' => $data['permanent_pin_code'] ?? null,
            'same_as_current' => isset($data['same_as_current']) ? (int)$data['same_as_current'] : 0,
            
            'allergies' => null,
            'medical_conditions' => null,
            'emergency_contact' => null,
            'doctor_name' => null,
            
            'transport_required' => 0,
            'transport_route' => null,
            'transport_pickup_point' => null,
            
            'hostel_required' => 0,
            'hostel_name' => null,
            'hostel_room_number' => null,
            
            'photo_path' => $data['photo_path'] ?? null,
            'birth_cert_path' => $data['birth_cert_path'] ?? null,
            'aadhaar_path' => $data['aadhaar_path'] ?? null,
            'transfer_cert_path' => $data['transfer_cert_path'] ?? null,
            'report_card_path' => $data['report_card_path'] ?? null,
            'additional_docs_path' => $data['additional_docs_path'] ?? null,
            'exit_date' => $exitDate,
        ]);

        $student = $this->studentRepo->findDetailById($schoolId, $id);
        if ($student === null) {
            throw new NotFoundException('Student not found after creation');
        }

        $this->log('Student created', ['id' => $id, 'school_id' => $schoolId]);
        return $student;
    }

    public function updateStudent(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $student = $this->studentRepo->findById($id);
        if ($student === null || (int)$student['school_id'] !== $schoolId) {
            throw new NotFoundException('Student not found');
        }

        $pdo = $this->studentRepo->getPdo();

        // 1. Validations
        $errors = [];
        if (empty($data['first_name'])) {
            $errors['first_name'] = 'First name is required';
        }
        if (empty($data['last_name'])) {
            $errors['last_name'] = 'Last name is required';
        }
        if (empty($data['gender'])) {
            $errors['gender'] = 'Gender is required';
        }
        if (empty($data['dob'])) {
            $errors['dob'] = 'Date of birth is required';
        }
        if (empty($data['class_name'])) {
            $errors['class_name'] = 'Class is required';
        }

        // Email and phone formats
        if (!empty($data['student_email']) && !filter_var($data['student_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['student_email'] = 'Invalid student email format';
        }
        if (!empty($data['student_mobile']) && !preg_match('/^[0-9]+$/', $data['student_mobile'])) {
            $errors['student_mobile'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['roll_no']) && !preg_match('/^[0-9]+$/', $data['roll_no'])) {
            $errors['roll_no'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['sr_no']) && !preg_match('/^[0-9]+$/', $data['sr_no'])) {
            $errors['sr_no'] = 'Only numeric digits are allowed.';
        }
        if (!empty($data['aadhaar_no']) && !preg_match('/^[0-9]+$/', $data['aadhaar_no'])) {
            $errors['aadhaar_no'] = 'Only numeric digits are allowed.';
        }

        // Check/get active academic year
        $academicYearId = (int)($data['academic_year_id'] ?? $student['academic_year_id']);
        if ($academicYearId <= 0) {
            $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_current = 1 LIMIT 1");
            $stmtYear->execute([':school_id' => $schoolId]);
            $yearId = $stmtYear->fetchColumn();
            $academicYearId = $yearId !== false ? (int)$yearId : 0;
        }

        // Parse and query/create class dynamically
        $classId = null;
        if (!empty($data['class_id'])) {
            $classId = (int)$data['class_id'];
        } elseif (!empty($data['class_name'])) {
            $classNameInput = trim((string)$data['class_name']);
            $section = null;
            $finalName = $classNameInput;
            
            if (preg_match('/^(.*?)\s*-\s*([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            } elseif (preg_match('/^(.*?)\s+([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            } elseif (preg_match('/^(.*?)-([A-Za-z0-9])$/i', $classNameInput, $matches)) {
                $finalName = trim($matches[1]);
                $section = trim($matches[2]);
            }
            
            $stmtClass = $pdo->prepare("SELECT id FROM classes WHERE school_id = :school_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) LIMIT 1");
            $stmtClass->execute([
                ':school_id' => $schoolId,
                ':name' => $finalName,
                ':section' => $section,
                ':section_null' => $section === null ? 1 : 0
            ]);
            $existingClassId = $stmtClass->fetchColumn();
            if ($existingClassId !== false) {
                $classId = (int)$existingClassId;
            } else {
                $insStmt = $pdo->prepare("INSERT INTO classes (school_id, name, section, academic_year_id) VALUES (:school_id, :name, :section, :academic_year_id)");
                $insStmt->execute([
                    ':school_id' => $schoolId,
                    ':name' => $finalName,
                    ':section' => $section,
                    ':academic_year_id' => $academicYearId > 0 ? $academicYearId : null
                ]);
                $classId = (int)$pdo->lastInsertId();
            }
        }

        // SR number edit validation
        $isFirstYear = $this->isFirstAcademicYear($schoolId, $academicYearId);
        
        $srNo = $student['sr_no'];
        if ($isFirstYear) {
            // Allows edit
            if (empty($data['sr_no'])) {
                $errors['sr_no'] = 'SR number is required';
            } else {
                $newSrNo = trim((string)$data['sr_no']);
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND sr_no = :sr_no AND id != :id");
                $stmt->execute([':school_id' => $schoolId, ':sr_no' => $newSrNo, ':id' => $id]);
                if ((int)$stmt->fetchColumn() > 0) {
                    $errors['sr_no'] = 'SR number already exists in this school';
                } else {
                    $srNo = $newSrNo;
                }
            }
        } else {
            // Auto generated, should remain unchanged.
            if (empty($srNo)) {
                $highest = $this->getHighestSrNo($schoolId);
                $srNo = (string)($highest > 0 ? $highest + 1 : 1001);
            }
        }

        if (!empty($errors)) {
            throw new ValidationException($errors);
        }

        // Full name
        $name = trim($data['first_name'] . ' ' . ($data['middle_name'] ?? '') . ' ' . $data['last_name']);
        $name = (string)preg_replace('/\s+/', ' ', $name);

        // Status based on Exit Date
        $exitDate = !empty($data['exit_date']) ? $data['exit_date'] : null;
        $status = $exitDate !== null ? 'Inactive' : 'ACTIVE';

        $this->studentRepo->update($id, [
            'name'         => $name,
            'admission_no' => null,
            'class_id'     => $classId,
            'parent_phone' => null,
            'email'        => $data['student_email'] ?? null,
            'status'       => $status,
            'dob'          => $data['dob'] ?? null,
            'address'      => $data['current_address_line'] ?? null,
            
            // Comprehensive fields
            'sr_no' => $srNo,
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name' => $data['last_name'],
            'gender' => $data['gender'],
            'blood_group' => $data['blood_group'] ?? null,
            'category' => $data['category'] ?? null,
            'religion' => $data['religion'] ?? null,
            'aadhaar_no' => $data['aadhaar_no'] ?? null,
            'student_mobile' => $data['student_mobile'] ?? null,
            'student_email' => $data['student_email'] ?? null,
            'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
            'admission_date' => $data['admission_date'] ?? $student['admission_date'],
            'roll_no' => $data['roll_no'] ?? null,
            'house' => null,
            
            'father_name' => $data['father_name'] ?? null,
            'father_phone' => null,
            'father_email' => null,
            'father_occupation' => $data['parent_occupation'] ?? null,
            'mother_name' => $data['mother_name'] ?? null,
            'mother_phone' => null,
            'mother_email' => null,
            'mother_occupation' => null,
            'guardian_name' => null,
            'guardian_relation' => null,
            'guardian_phone' => null,
            
            'current_address_line' => $data['current_address_line'] ?? null,
            'current_city' => $data['current_city'] ?? null,
            'current_state' => $data['current_state'] ?? null,
            'current_country' => $data['current_country'] ?? null,
            'current_pin_code' => $data['current_pin_code'] ?? null,
            'permanent_address_line' => $data['permanent_address_line'] ?? null,
            'permanent_city' => $data['permanent_city'] ?? null,
            'permanent_state' => $data['permanent_state'] ?? null,
            'permanent_country' => $data['permanent_country'] ?? null,
            'permanent_pin_code' => $data['permanent_pin_code'] ?? null,
            'same_as_current' => isset($data['same_as_current']) ? (int)$data['same_as_current'] : 0,
            
            'allergies' => null,
            'medical_conditions' => null,
            'emergency_contact' => null,
            'doctor_name' => null,
            
            'transport_required' => 0,
            'transport_route' => null,
            'transport_pickup_point' => null,
            
            'hostel_required' => 0,
            'hostel_name' => null,
            'hostel_room_number' => null,
            
            'photo_path' => $data['photo_path'] ?? $student['photo_path'],
            'birth_cert_path' => $data['birth_cert_path'] ?? $student['birth_cert_path'],
            'aadhaar_path' => $data['aadhaar_path'] ?? $student['aadhaar_path'],
            'transfer_cert_path' => $data['transfer_cert_path'] ?? $student['transfer_cert_path'],
            'report_card_path' => $data['report_card_path'] ?? $student['report_card_path'],
            'additional_docs_path' => $data['additional_docs_path'] ?? $student['additional_docs_path'],
            'exit_date' => $exitDate,
        ]);

        return $this->studentRepo->findDetailById($schoolId, $id);
    }

    public function handleFileUpload($uploadedFile): string
    {
        $directory = dirname(__DIR__, 5) . '/backend/public/uploads';
        if (!is_dir($directory)) {
            mkdir($directory, 0777, true);
        }

        $extension = pathinfo($uploadedFile->getClientFilename(), PATHINFO_EXTENSION);
        $filename = sprintf('%s.%0.8s', bin2hex(random_bytes(8)), $extension);
        $uploadedFile->moveTo($directory . DIRECTORY_SEPARATOR . $filename);
        
        return '/uploads/' . $filename;
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
            'school_id'        => $schoolId,
            'name'             => $data['name'],
            'employee_id'      => $data['employee_id'] ?? null,
            'role'             => $data['role'],
            'department'       => $data['department'] ?? null,
            'phone'            => $data['phone'] ?? null,
            'email'            => $data['email'] ?? null,
            'status'           => $data['status'] ?? 'ACTIVE',
            'salary'           => $data['salary'] ?? null,
            'joining_date'     => $data['joining_date'] ?? null,
            'photo_path'       => $data['photo_path'] ?? null,
            'assigned_periods' => isset($data['assigned_periods']) ? (int)$data['assigned_periods'] : 0,
            'max_periods'      => isset($data['max_periods']) ? (int)$data['max_periods'] : 8,
        ]);

        $member = $this->staffRepo->findById($id);

        if ($member === null) {
            throw new NotFoundException('Staff member not found after creation');
        }

        $this->log('Staff member created', ['id' => $id, 'school_id' => $schoolId]);

        return $member;
    }

    public function updateStaff(array $user, int $id, array $data): array
    {
        if (empty($data['name']) || empty($data['role'])) {
            throw new ValidationException(['fields' => 'Staff name and role are required']);
        }

        $schoolId = $this->getSchoolId($user);
        $member   = $this->staffRepo->findById($id);

        if ($member === null || (int)$member['school_id'] !== $schoolId) {
            throw new NotFoundException('Staff member not found');
        }

        $this->staffRepo->update($id, [
            'name'             => $data['name'],
            'role'             => $data['role'],
            'department'       => $data['department'] ?? null,
            'phone'            => $data['phone'] ?? null,
            'email'            => $data['email'] ?? null,
            'status'           => $data['status'] ?? $member['status'],
            'salary'           => $data['salary'] ?? $member['salary'],
            'joining_date'     => $data['joining_date'] ?? $member['joining_date'],
            'photo_path'       => $data['photo_path'] ?? $member['photo_path'],
            'assigned_periods' => isset($data['assigned_periods']) ? (int)$data['assigned_periods'] : (int)($member['assigned_periods'] ?? 0),
            'max_periods'      => isset($data['max_periods']) ? (int)$data['max_periods'] : (int)($member['max_periods'] ?? 8),
        ]);

        return $this->staffRepo->findById($id);
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
        $pdo = $this->classRepo->getPdo();

        // Parse optional sections
        $sections = [];
        if (!empty($data['sections'])) {
            if (is_array($data['sections'])) {
                $sections = $data['sections'];
            } else {
                $sections = array_filter(array_map('trim', explode(',', (string)$data['sections'])));
            }
        }

        if (empty($sections)) {
            $sections = [null];
        }

        // Get currently active academic year
        $academicYearId = null;
        $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_current = 1 LIMIT 1");
        $stmtYear->execute([':school_id' => $schoolId]);
        $yearId = $stmtYear->fetchColumn();
        if ($yearId !== false) {
            $academicYearId = (int)$yearId;
        } else {
            $stmt2 = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id ORDER BY start_date DESC LIMIT 1");
            $stmt2->execute([':school_id' => $schoolId]);
            $yearId = $stmt2->fetchColumn();
            $academicYearId = $yearId !== false ? (int)$yearId : null;
        }

        $lastInsertedClass = null;
        foreach ($sections as $sec) {
            $secVal = $sec !== null ? trim((string)$sec) : null;
            if ($secVal === '') {
                $secVal = null;
            }

            // Check if combination already exists to prevent duplicates
            $stmtCheck = $pdo->prepare("
                SELECT id FROM classes 
                WHERE school_id = :school_id AND name = :name 
                AND (section = :section OR (section IS NULL AND :section_null = 1)) 
                LIMIT 1
            ");
            $stmtCheck->execute([
                ':school_id' => $schoolId,
                ':name' => trim((string)$data['name']),
                ':section' => $secVal,
                ':section_null' => $secVal === null ? 1 : 0
            ]);
            $existsId = $stmtCheck->fetchColumn();

            if ($existsId !== false) {
                $lastInsertedClass = $this->classRepo->findById((int)$existsId);
                continue;
            }

            $id = $this->classRepo->create([
                'school_id'        => $schoolId,
                'name'             => trim((string)$data['name']),
                'section'          => $secVal,
                'academic_year_id' => $academicYearId,
            ]);

            $lastInsertedClass = $this->classRepo->findById($id);
            $this->log('Class created', ['id' => $id, 'school_id' => $schoolId]);
        }

        if ($lastInsertedClass === null) {
            throw new NotFoundException('Class not found after creation');
        }

        return $lastInsertedClass;
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
        if (empty($data['student_id'])) {
            throw new ValidationException(['fields' => 'Student ID is required']);
        }

        $studentId = (int)$data['student_id'];
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();

        // 1. Fetch student to get class_id
        $stmtStudent = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id LIMIT 1");
        $stmtStudent->execute([':id' => $studentId, ':school_id' => $schoolId]);
        $studentRow = $stmtStudent->fetch(PDO::FETCH_ASSOC);
        if (!$studentRow) {
            throw new NotFoundException('Student not found');
        }
        $classId = $studentRow['class_id'];

        // 2. Fetch fee structure for this class (or fallback)
        $feeStructureId = null;
        $amountPaid = 2000.0; // Default fallback
        if ($classId !== null) {
            $stmtFee = $pdo->prepare("SELECT id, amount FROM fee_structures WHERE school_id = :school_id AND class_id = :class_id LIMIT 1");
            $stmtFee->execute([':school_id' => $schoolId, ':class_id' => $classId]);
            $feeRow = $stmtFee->fetch(PDO::FETCH_ASSOC);
            if ($feeRow) {
                $feeStructureId = (int)$feeRow['id'];
                $amountPaid = (float)$feeRow['amount'];
            }
        }

        // If amount_paid is explicitly sent, we can use it
        if (!empty($data['amount_paid'])) {
            $amountPaid = (float)$data['amount_paid'];
        }

        // 3. Resolve the list of months being paid
        $monthsToPay = [];
        if (!empty($data['months'])) {
            $monthsToPay = is_array($data['months']) ? $data['months'] : array_filter(array_map('trim', explode(',', (string)$data['months'])));
        } elseif (!empty($data['fee_month'])) {
            $monthsToPay = [trim((string)$data['fee_month'])];
        }

        if (empty($monthsToPay)) {
            throw new ValidationException(['months' => 'Fee month is required']);
        }

        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        // Sort months to pay by academic calendar order
        usort($monthsToPay, function($a, $b) use ($academicMonths) {
            $idxA = array_search($a, $academicMonths, true);
            $idxB = array_search($b, $academicMonths, true);
            return ($idxA === false ? 99 : $idxA) - ($idxB === false ? 99 : $idxB);
        });

        // 4. Fetch already paid months
        $stmtPaid = $pdo->prepare("SELECT fee_month FROM fee_payments WHERE student_id = :student_id AND status = 'PAID'");
        $stmtPaid->execute([':student_id' => $studentId]);
        $alreadyPaid = $stmtPaid->fetchAll(PDO::FETCH_COLUMN);

        $tempPaid = $alreadyPaid;

        // 5. Sequence validation
        foreach ($monthsToPay as $m) {
            $idx = array_search($m, $academicMonths, true);
            if ($idx === false) {
                throw new ValidationException(['months' => "Invalid month: $m"]);
            }

            // If already paid
            if (in_array($m, $tempPaid, true)) {
                throw new ValidationException(['months' => "Fee for $m has already been paid."]);
            }

            // Check if all previous months in academic sequence are paid
            for ($j = 0; $j < $idx; $j++) {
                $prevMonth = $academicMonths[$j];
                if (!in_array($prevMonth, $tempPaid, true) && !in_array($prevMonth, $monthsToPay, true)) {
                    throw new ValidationException(['months' => 'Cannot collect fees for a future month until all previous pending months have been paid.']);
                }
            }

            $tempPaid[] = $m;
        }

        // 6. Insert payments
        $lastPayment = null;
        $receiptNo = 'REC-' . time() . '-' . rand(1000, 9999);
        foreach ($monthsToPay as $m) {
            $id = $this->feeRepo->createPayment([
                'school_id'        => $schoolId,
                'student_id'       => $studentId,
                'fee_structure_id' => $feeStructureId,
                'amount_paid'      => $amountPaid,
                'payment_date'     => date('Y-m-d'),
                'receipt_no'       => $receiptNo,
                'status'           => 'PAID',
                'fee_month'        => $m
            ]);
            $lastPayment = $this->feeRepo->findPaymentById($id);
        }

        if ($lastPayment === null) {
            throw new NotFoundException('Payment not found after recording');
        }

        return $lastPayment;
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

    public function updateClass(array $user, array $data): array
    {
        if (empty($data['oldName'])) {
            throw new ValidationException(['oldName' => 'Old class name is required']);
        }
        if (empty($data['name'])) {
            throw new ValidationException(['name' => 'New class name is required']);
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $oldName = trim((string)$data['oldName']);
        $newName = trim((string)$data['name']);

        // Parse sections
        $newSections = [];
        if (!empty($data['sections'])) {
            if (is_array($data['sections'])) {
                $newSections = $data['sections'];
            } else {
                $newSections = array_filter(array_map('trim', explode(',', (string)$data['sections'])));
            }
        }
        if (empty($newSections)) {
            $newSections = [null];
        }

        // Get currently active academic year
        $academicYearId = null;
        $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_current = 1 LIMIT 1");
        $stmtYear->execute([':school_id' => $schoolId]);
        $yearId = $stmtYear->fetchColumn();
        if ($yearId !== false) {
            $academicYearId = (int)$yearId;
        } else {
            $stmt2 = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id ORDER BY start_date DESC LIMIT 1");
            $stmt2->execute([':school_id' => $schoolId]);
            $yearId = $stmt2->fetchColumn();
            $academicYearId = $yearId !== false ? (int)$yearId : null;
        }

        // Get all existing classes for oldName
        $stmtOld = $pdo->prepare("SELECT * FROM classes WHERE school_id = :school_id AND name = :name");
        $stmtOld->execute([':school_id' => $schoolId, ':name' => $oldName]);
        $oldClasses = $stmtOld->fetchAll();

        $oldSectionsMap = [];
        foreach ($oldClasses as $oc) {
            $sec = $oc['section'] !== null ? trim((string)$oc['section']) : '';
            $oldSectionsMap[$sec] = $oc;
        }

        // Process sections
        $processedIds = [];
        $lastClass = null;

        foreach ($newSections as $sec) {
            $secVal = $sec !== null ? trim((string)$sec) : '';
            $dbSecVal = $secVal === '' ? null : $secVal;

            if (isset($oldSectionsMap[$secVal])) {
                // Section exists - update the name
                $oc = $oldSectionsMap[$secVal];
                $stmtUpdate = $pdo->prepare("UPDATE classes SET name = :name, section = :section WHERE id = :id");
                $stmtUpdate->execute([
                    ':name' => $newName,
                    ':section' => $dbSecVal,
                    ':id' => $oc['id']
                ]);
                $processedIds[] = (int)$oc['id'];
                $lastClass = $this->classRepo->findById((int)$oc['id']);
            } else {
                // Check if there is an existing one under the new name already to prevent duplicates
                $stmtCheck = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :school_id AND name = :name 
                    AND (section = :section OR (section IS NULL AND :section_null = 1)) 
                    LIMIT 1
                ");
                $stmtCheck->execute([
                    ':school_id' => $schoolId,
                    ':name' => $newName,
                    ':section' => $dbSecVal,
                    ':section_null' => $dbSecVal === null ? 1 : 0
                ]);
                $existsId = $stmtCheck->fetchColumn();

                if ($existsId !== false) {
                    $processedIds[] = (int)$existsId;
                    $lastClass = $this->classRepo->findById((int)$existsId);
                } else {
                    // Create new section
                    $id = $this->classRepo->create([
                        'school_id'        => $schoolId,
                        'name'             => $newName,
                        'section'          => $dbSecVal,
                        'academic_year_id' => $academicYearId,
                    ]);
                    $processedIds[] = $id;
                    $lastClass = $this->classRepo->findById($id);
                    $this->log('Class section added on edit', ['id' => $id, 'school_id' => $schoolId]);
                }
            }
        }

        // Delete old sections that were removed
        foreach ($oldClasses as $oc) {
            if (!in_array((int)$oc['id'], $processedIds, true)) {
                $oldClassId = (int)$oc['id'];
                
                if (!empty($processedIds)) {
                    $targetClassId = (int)$processedIds[0];
                    $tablesToMigrate = ['students', 'subjects', 'attendance', 'exams', 'fee_structures'];
                    foreach ($tablesToMigrate as $tbl) {
                        $stmtMigrate = $pdo->prepare("UPDATE {$tbl} SET class_id = :target_id WHERE class_id = :old_id");
                        $stmtMigrate->execute([
                            ':target_id' => $targetClassId,
                            ':old_id' => $oldClassId
                        ]);
                    }
                }

                $this->classRepo->delete($oldClassId);
                $this->log('Class section deleted on edit', ['id' => $oldClassId, 'school_id' => $schoolId]);
            }
        }

        if ($lastClass === null) {
            throw new NotFoundException('Class not found after update');
        }

        return $lastClass;
    }

    public function deleteFeePayment(array $user, int $id): bool
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();

        // Check if the payment exists and belongs to this school
        $stmt = $pdo->prepare("SELECT id, receipt_no FROM fee_payments WHERE id = :id AND school_id = :school_id LIMIT 1");
        $stmt->execute([':id' => $id, ':school_id' => $schoolId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new NotFoundException('Fee payment not found');
        }

        $receiptNo = $row['receipt_no'];

        if (!empty($receiptNo)) {
            // Delete all payments in this transaction
            $stmtDel = $pdo->prepare("DELETE FROM fee_payments WHERE receipt_no = :receipt_no AND school_id = :school_id");
            return $stmtDel->execute([':receipt_no' => $receiptNo, ':school_id' => $schoolId]);
        }

        return $this->feeRepo->deletePayment($id);
    }
}

