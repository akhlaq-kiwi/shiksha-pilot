<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Domain\SchoolAdmin\Repositories\ClassRepository;
use App\Domain\SchoolAdmin\Repositories\ExamRepository;
use App\Domain\SchoolAdmin\Repositories\FeeRepository;
use App\Domain\SchoolAdmin\Repositories\FinancialReportRepository;
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
        private readonly FinancialReportRepository $financialReportRepo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    private function getWorkingAcademicYear(PDO $pdo, int $schoolId): ?array
    {
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $year = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($year) {
                return $year;
            }
        }

        // 1. Try to find the active year
        $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
        $stmt->execute([':sid' => $schoolId]);
        $active = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($active) {
            return $active;
        }
        
        // 2. Try to find a draft year
        $stmtDraft = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND status = 'Draft' LIMIT 1");
        $stmtDraft->execute([':sid' => $schoolId]);
        $draft = $stmtDraft->fetch(PDO::FETCH_ASSOC);
        return $draft ?: null;
    }

    private function requireWritableAcademicYear(PDO $pdo, int $schoolId): void
    {
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear && $workingYear['status'] === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }
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

        $pdo = $this->feeRepo->getPdo();
        
        // 1. Fetch current active or draft academic year
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        $pendingFeesTotal = 0.0;
        if ($activeYear) {
            $monthsDue = $this->getMonthsDueUpToCurrent($activeYear['start_date'], $activeYear['end_date']);

            if (!empty($monthsDue)) {
                // Fetch all active students in this active year
                $stmtStudents = $pdo->prepare("
                    SELECT id, class_id 
                    FROM students 
                    WHERE school_id = :sid AND status = 'ACTIVE' AND academic_year_id = :ayid
                ");
                $stmtStudents->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $activeYear['id']
                ]);
                $activeStudents = $stmtStudents->fetchAll(\PDO::FETCH_ASSOC);

                if (!empty($activeStudents)) {
                    // Fetch all locked class configurations for this year
                    $stmtConfigs = $pdo->prepare("
                        SELECT class_id, monthly_fees 
                        FROM class_fee_configurations 
                        WHERE school_id = :sid AND academic_year_id = :ayid AND is_locked = 1
                    ");
                    $stmtConfigs->execute([
                        ':sid' => $schoolId,
                        ':ayid' => $activeYear['id']
                    ]);
                    $configs = $stmtConfigs->fetchAll(\PDO::FETCH_ASSOC);

                    $classConfigs = [];
                    foreach ($configs as $cfg) {
                        $classConfigs[$cfg['class_id']] = json_decode($cfg['monthly_fees'], true);
                    }

                    // Fetch all payments for current active year students
                    $studentIds = array_column($activeStudents, 'id');
                    $studentIdsStr = implode(',', array_map('intval', $studentIds));
                    
                    $stmtPayments = $pdo->prepare("
                        SELECT student_id, fee_month 
                        FROM fee_payments 
                        WHERE school_id = :sid AND status = 'PAID' AND academic_year_id = :ayid AND student_id IN ($studentIdsStr)
                    ");
                    $stmtPayments->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
                    $payments = $stmtPayments->fetchAll(\PDO::FETCH_ASSOC);

                    $studentPaidMonths = [];
                    foreach ($payments as $pay) {
                        $studentPaidMonths[$pay['student_id']][] = $pay['fee_month'];
                    }

                    foreach ($activeStudents as $student) {
                        $classId = $student['class_id'];
                        if (empty($classId) || !isset($classConfigs[$classId])) {
                            continue;
                        }

                        $monthlyFees = $classConfigs[$classId];
                        $paid = $studentPaidMonths[$student['id']] ?? [];

                        foreach ($monthsDue as $m) {
                            if (!in_array($m, $paid, true)) {
                                $pendingFeesTotal += isset($monthlyFees[$m]) ? (float)$monthlyFees[$m] : 0.0;
                            }
                        }
                    }
                }
            }

            // Calculate pending additional fees that are due
            $today = date('Y-m-d');
            $stmtAddPending = $pdo->prepare("
                SELECT COALESCE(SUM(afp.amount), 0)
                FROM additional_fee_payments afp
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                JOIN students s ON afp.student_id = s.id
                WHERE afp.school_id = :sid
                  AND afp.status = 'Pending'
                  AND s.status = 'ACTIVE'
                  AND s.academic_year_id = :ayid
                  AND aft.due_date <= :today
            ");
            $stmtAddPending->execute([
                ':sid' => $schoolId,
                ':ayid' => $activeYear['id'],
                ':today' => $today
            ]);
            $pendingAddFees = (float)$stmtAddPending->fetchColumn();
            $pendingFeesTotal += $pendingAddFees;
        }

        $feeCollectionChart = [];
        $salaryDisbursementChart = [];
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        if ($activeYear) {
            // 1. Fee collection chart
            $feeMap = [];
            foreach ($academicMonths as $m) {
                $feeMap[$m] = ['amount' => 0.0, 'transactions' => 0];
            }
            
            $stmtFeeChart = $pdo->prepare("
                SELECT fp.fee_month, SUM(fp.amount_paid) AS total_collected, COUNT(fp.id) AS transaction_count
                FROM fee_payments fp
                JOIN students s ON fp.student_id = s.id
                WHERE fp.school_id = :school_id AND s.academic_year_id = :academic_year_id AND fp.status = 'PAID'
                GROUP BY fp.fee_month
            ");
            $stmtFeeChart->execute([':school_id' => $schoolId, ':academic_year_id' => $activeYear['id']]);
            while ($row = $stmtFeeChart->fetch(\PDO::FETCH_ASSOC)) {
                $m = $row['fee_month'];
                if (isset($feeMap[$m])) {
                    $feeMap[$m]['amount'] = (float)$row['total_collected'];
                    $feeMap[$m]['transactions'] = (int)$row['transaction_count'];
                }
            }
            
            foreach ($academicMonths as $m) {
                $short = substr($m, 0, 3);
                $feeCollectionChart[] = [
                    'month' => $short,
                    'label' => $m,
                    'amount' => $feeMap[$m]['amount'],
                    'studentsPaid' => $feeMap[$m]['transactions']
                ];
            }

            // 2. Salary disbursement chart
            $salaryMap = [];
            foreach ($academicMonths as $m) {
                $salaryMap[$m] = ['amount' => 0.0, 'teachers_paid' => 0];
            }
            
            $stmtSalaryChart = $pdo->prepare("
                SELECT payment_month, SUM(amount_paid) AS total_disbursed, COUNT(DISTINCT staff_id) AS staff_count
                FROM staff_payments
                WHERE school_id = :school_id AND academic_year_id = :academic_year_id
                GROUP BY payment_month
            ");
            $stmtSalaryChart->execute([':school_id' => $schoolId, ':academic_year_id' => $activeYear['id']]);
            while ($row = $stmtSalaryChart->fetch(\PDO::FETCH_ASSOC)) {
                $m = $row['payment_month'];
                if (isset($salaryMap[$m])) {
                    $salaryMap[$m]['amount'] = (float)$row['total_disbursed'];
                    $salaryMap[$m]['teachers_paid'] = (int)$row['staff_count'];
                }
            }
            
            foreach ($academicMonths as $m) {
                $short = substr($m, 0, 3);
                $salaryDisbursementChart[] = [
                    'month' => $short,
                    'label' => $m,
                    'amount' => $salaryMap[$m]['amount'],
                    'teachersPaid' => $salaryMap[$m]['teachers_paid']
                ];
            }
        } else {
            foreach ($academicMonths as $m) {
                $short = substr($m, 0, 3);
                $feeCollectionChart[] = [
                    'month' => $short, 'label' => $m, 'amount' => 0.0, 'studentsPaid' => 0
                ];
                $salaryDisbursementChart[] = [
                    'month' => $short, 'label' => $m, 'amount' => 0.0, 'teachersPaid' => 0
                ];
            }
        }

        return [
            'students_count' => $this->studentRepo->countBySchool($schoolId, 'ACTIVE'),
            'staff_count'    => $this->staffRepo->countBySchool($schoolId, 'ACTIVE'),
            'classes_count'  => $this->classRepo->countBySchool($schoolId),
            'pending_fees'   => $pendingFeesTotal,
            'total_collected' => $this->feeRepo->getTotalCollectedBySchool($schoolId, $activeYear ? (int)$activeYear['id'] : null),
            'fee_collection_chart' => $feeCollectionChart,
            'salary_disbursement_chart' => $salaryDisbursementChart,
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
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : ($student['academic_year_id'] !== null ? (int)$student['academic_year_id'] : 0);
        
        $isLedgerLocked = false;
        $ledgerLockedMessage = '';
        if ($student['status'] === 'ACTIVE' && $student['academic_year_id'] !== null && (int)$student['academic_year_id'] > $workingYearId) {
            $isLedgerLocked = true;
            $ledgerLockedMessage = "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year.";
        }

        $feeStmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) AS total_paid, COUNT(*) AS payment_count
            FROM fee_payments
            WHERE student_id = :student_id AND status = 'PAID' AND academic_year_id = :academic_year_id
        ");
        $feeStmt->execute([':student_id' => $id, ':academic_year_id' => $workingYearId]);
        $feeSummary = $feeStmt->fetch(PDO::FETCH_ASSOC);

        $paymentsStmt = $pdo->prepare("
            SELECT * FROM fee_payments
            WHERE student_id = :student_id AND status = 'PAID' AND academic_year_id = :academic_year_id
            ORDER BY id ASC
        ");
        $paymentsStmt->execute([':student_id' => $id, ':academic_year_id' => $workingYearId]);
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

        // Query locked class fee configuration
        $classFeeConfig = null;
        if (!empty($student['class_id']) && !empty($student['academic_year_id'])) {
            $stmtCfg = $pdo->prepare("
                SELECT * FROM class_fee_configurations 
                WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id AND is_locked = 1
                LIMIT 1
            ");
            $stmtCfg->execute([
                ':school_id' => $schoolId,
                ':class_id' => $student['class_id'],
                ':academic_year_id' => $student['academic_year_id']
            ]);
            $cfgRow = $stmtCfg->fetch(PDO::FETCH_ASSOC);
            if ($cfgRow) {
                $classFeeConfig = $cfgRow;
                $classFeeConfig['monthly_fees'] = json_decode($cfgRow['monthly_fees'], true);
                $classFeeConfig['is_locked'] = (int)$cfgRow['is_locked'];
            }
        }

        // Query Additional Fee Payments
        $today = date('Y-m-d');
        $addStmt = $pdo->prepare("
            SELECT afp.*, aft.name as fee_name, aft.due_date
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id
              AND (aft.due_date IS NULL OR aft.due_date <= :today OR afp.status = 'Paid')
            ORDER BY afp.id DESC
        ");
        $addStmt->execute([':student_id' => $id, ':today' => $today]);
        $additionalPayments = $addStmt->fetchAll(PDO::FETCH_ASSOC);
        $additionalPayments = array_map(function($ap) {
            $ap['id'] = (int)$ap['id'];
            $ap['student_id'] = (int)$ap['student_id'];
            $ap['fee_type_id'] = (int)$ap['fee_type_id'];
            $ap['amount'] = (float)$ap['amount'];
            return $ap;
        }, $additionalPayments);

        return [
            'student' => $student,
            'fee_summary' => [
                'total_paid' => (float)$feeSummary['total_paid'],
                'payment_count' => (int)$feeSummary['payment_count'],
                'payments' => $feeSummary['payments'] ?? []
            ],
            'additional_fee_payments' => $additionalPayments,
            'class_fee_config' => $classFeeConfig,
            'attendance_summary' => [
                'total_marked' => (int)$attSummary['total_marked'],
                'present_count' => (int)$attSummary['present_count'],
                'percentage' => $attSummary['total_marked'] > 0 
                    ? round(($attSummary['present_count'] / $attSummary['total_marked']) * 100, 1) 
                    : 100.0
            ],
            'exam_results' => $examResults,
            'is_ledger_locked' => $isLedgerLocked,
            'ledger_locked_message' => $ledgerLockedMessage
        ];
    }

    public function checkSrNoExists(array $user, string $srNo, ?int $excludeId = null): bool
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        if ($excludeId !== null) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND sr_no = :sr_no AND id != :exclude_id");
            $stmt->execute([':school_id' => $schoolId, ':sr_no' => trim($srNo), ':exclude_id' => $excludeId]);
        } else {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND sr_no = :sr_no");
            $stmt->execute([':school_id' => $schoolId, ':sr_no' => trim($srNo)]);
        }

        return (int)$stmt->fetchColumn() > 0;
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
        $this->requireWritableAcademicYear($pdo, $schoolId);
        
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

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

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

        // Auto-calculate Roll Number for the class and academic year if not provided by the frontend
        $rollNo = !empty($data['roll_no']) ? trim((string)$data['roll_no']) : null;
        if ($rollNo === null && $classId !== null && $academicYearId > 0) {
            $stmtRoll = $pdo->prepare("
                SELECT MAX(CAST(roll_no AS UNSIGNED)) 
                FROM students 
                WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
            ");
            $stmtRoll->execute([
                ':class_id' => $classId,
                ':academic_year_id' => $academicYearId,
                ':school_id' => $schoolId
            ]);
            $maxRoll = (int)$stmtRoll->fetchColumn();
            $rollNo = (string)($maxRoll + 1);
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
            'roll_no' => $rollNo,
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
        $this->requireWritableAcademicYear($pdo, $schoolId);

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
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;
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

        // Auto-calculate Roll Number if class changes
        $rollNo = $student['roll_no'];
        if ((int)$student['class_id'] !== (int)$classId) {
            if ($classId !== null && $academicYearId > 0) {
                $stmtRoll = $pdo->prepare("
                    SELECT MAX(CAST(roll_no AS UNSIGNED)) 
                    FROM students 
                    WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
                ");
                $stmtRoll->execute([
                    ':class_id' => $classId,
                    ':academic_year_id' => $academicYearId,
                    ':school_id' => $schoolId
                ]);
                $maxRoll = (int)$stmtRoll->fetchColumn();
                $rollNo = (string)($maxRoll + 1);
            }
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
            'roll_no' => $rollNo,
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
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        
        $stmt = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid ORDER BY id DESC");
        $stmt->execute([':sid' => $schoolId]);
        $staffList = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // For each staff member, fetch documents count
        foreach ($staffList as &$s) {
            $stmtDocs = $pdo->prepare("SELECT COUNT(*) FROM staff_documents WHERE staff_id = :sid");
            $stmtDocs->execute([':sid' => $s['id']]);
            $s['documents_count'] = (int)$stmtDocs->fetchColumn();
        }

        return $staffList;
    }

    public function getStaffDetails(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $stmt = $pdo->prepare("SELECT * FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        $member = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$member) {
            throw new NotFoundException('Teacher profile not found');
        }

        // Fetch documents
        $stmtDocs = $pdo->prepare("SELECT * FROM staff_documents WHERE staff_id = :sid ORDER BY id ASC");
        $stmtDocs->execute([':sid' => $id]);
        $member['documents'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch salary payments for current working academic year
        $member['salary_payments'] = [];
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear) {
            $stmtPayments = $pdo->prepare("SELECT * FROM staff_payments WHERE staff_id = :sid AND academic_year_id = :ayid");
            $stmtPayments->execute([
                ':sid' => $id,
                ':ayid' => $workingYear['id']
            ]);
            $payments = $stmtPayments->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Check if each payment is locked by a financial report
            $stmtCheckReport = $pdo->prepare("
                SELECT COUNT(*) FROM financial_reports 
                WHERE school_id = :sid AND :payment_date BETWEEN `from_date` AND `to_date`
            ");
            
            foreach ($payments as &$p) {
                $stmtCheckReport->execute([
                    ':sid' => $schoolId,
                    ':payment_date' => $p['payment_date']
                ]);
                $p['is_locked'] = ((int)$stmtCheckReport->fetchColumn() > 0) ? 1 : 0;
            }
            $member['salary_payments'] = $payments;
        }

        return $member;
    }

    public function createStaff(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // 1. Validations
        if (empty($data['name']) || strlen(trim($data['name'])) < 3 || strlen(trim($data['name'])) > 100) {
            throw new ValidationException(['name' => 'Name must be between 3 and 100 characters.']);
        }
        if (empty($data['father_name']) || strlen(trim($data['father_name'])) < 3) {
            throw new ValidationException(['father_name' => 'Father name must be at least 3 characters.']);
        }
        if (empty($data['mother_name']) || strlen(trim($data['mother_name'])) < 3 || strlen(trim($data['mother_name'])) > 100) {
            throw new ValidationException(['mother_name' => 'Mother name must be between 3 and 100 characters.']);
        }
        if (empty($data['phone']) || !preg_match('/^[0-9]{10}$/', trim($data['phone']))) {
            throw new ValidationException(['phone' => 'Contact number must be exactly 10 digits.']);
        }
        if (empty($data['emergency_phone']) || !preg_match('/^[0-9]{10}$/', trim($data['emergency_phone']))) {
            throw new ValidationException(['emergency_phone' => 'Emergency contact number must be exactly 10 digits.']);
        }
        if (trim($data['emergency_phone']) === trim($data['phone'])) {
            throw new ValidationException(['emergency_phone' => 'Emergency contact number must be different from contact number.']);
        }
        if (empty($data['email']) || !filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException(['email' => 'Invalid email address format.']);
        }
        if (empty($data['joining_date']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($data['joining_date']))) {
            throw new ValidationException(['joining_date' => 'Joining date is required.']);
        }
        if (!isset($data['salary']) || $data['salary'] === '') {
            throw new ValidationException(['salary' => 'Salary is required.']);
        }
        if (!is_numeric($data['salary']) || (float)$data['salary'] <= 0) {
            throw new ValidationException(['salary' => 'Salary must be a positive number.']);
        }
        if (!empty($data['exit_date'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($data['exit_date']))) {
                throw new ValidationException(['exit_date' => 'Invalid exit date format.']);
            }
            if (strtotime($data['exit_date']) < strtotime($data['joining_date'])) {
                throw new ValidationException(['exit_date' => 'Exit date cannot be earlier than joining date.']);
            }
        }

        // 2. Uniqueness Checks
        $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone LIMIT 1");
        $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone'])]);
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        $stmtCheckEmail = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = :email LIMIT 1");
        $stmtCheckEmail->execute([':sid' => $schoolId, ':email' => trim($data['email'])]);
        if ($stmtCheckEmail->fetchColumn() !== false) {
            throw new ValidationException(['email' => 'This email address already exists.']);
        }

        // 3. Status Mapping
        $status = !empty($data['exit_date']) ? 'Inactive' : 'ACTIVE';

        // 4. Save
        $id = $this->staffRepo->create([
            'school_id'               => $schoolId,
            'name'                    => $data['name'],
            'employee_id'             => $data['employee_id'] ?? null,
            'role'                    => $data['role'] ?? 'Teacher',
            'department'              => $data['department'] ?? null,
            'phone'                   => $data['phone'],
            'email'                   => $data['email'],
            'status'                  => $status,
            'salary'                  => $data['salary'] ?? null,
            'joining_date'            => $data['joining_date'],
            'photo_path'              => $data['photo_path'] ?? null,
            'father_name'             => $data['father_name'],
            'mother_name'             => $data['mother_name'],
            'parent_occupation'       => $data['parent_occupation'] ?? null,
            'emergency_phone'         => $data['emergency_phone'],
            'exit_date'               => !empty($data['exit_date']) ? $data['exit_date'] : null,
            'current_address_line'    => $data['current_address_line'] ?? null,
            'current_city'            => $data['current_city'] ?? null,
            'current_state'           => $data['current_state'] ?? null,
            'current_country'         => $data['current_country'] ?? null,
            'current_pin_code'        => $data['current_pin_code'] ?? null,
            'permanent_address_line'  => $data['permanent_address_line'] ?? null,
            'permanent_city'          => $data['permanent_city'] ?? null,
            'permanent_state'         => $data['permanent_state'] ?? null,
            'permanent_country'       => $data['permanent_country'] ?? null,
            'permanent_pin_code'      => $data['permanent_pin_code'] ?? null,
            'same_as_current'         => isset($data['same_as_current']) ? (int)$data['same_as_current'] : 0,
            'assigned_periods'        => 0,
            'max_periods'             => 8,
        ]);

        // Save documents
        if (!empty($data['documents']) && is_array($data['documents'])) {
            $stmtDoc = $pdo->prepare("
                INSERT INTO staff_documents (school_id, staff_id, category, file_name, file_path, file_size)
                VALUES (:sid, :staff_id, :category, :file_name, :file_path, :file_size)
            ");
            foreach ($data['documents'] as $doc) {
                $stmtDoc->execute([
                    ':sid' => $schoolId,
                    ':staff_id' => $id,
                    ':category' => $doc['category'],
                    ':file_name' => $doc['file_name'],
                    ':file_path' => $doc['file_path'],
                    ':file_size' => (int)$doc['file_size']
                ]);
            }
        }

        $this->log('Staff member created', ['id' => $id, 'school_id' => $schoolId]);
        return $this->getStaffDetails($user, $id);
    }

    public function updateStaff(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $member = $this->staffRepo->findById($id);
        if ($member === null || (int)$member['school_id'] !== $schoolId) {
            throw new NotFoundException('Teacher profile not found');
        }

        // 1. Validations
        if (empty($data['name']) || strlen(trim($data['name'])) < 3 || strlen(trim($data['name'])) > 100) {
            throw new ValidationException(['name' => 'Name must be between 3 and 100 characters.']);
        }
        if (empty($data['father_name']) || strlen(trim($data['father_name'])) < 3) {
            throw new ValidationException(['father_name' => 'Father name must be at least 3 characters.']);
        }
        if (empty($data['mother_name']) || strlen(trim($data['mother_name'])) < 3 || strlen(trim($data['mother_name'])) > 100) {
            throw new ValidationException(['mother_name' => 'Mother name must be between 3 and 100 characters.']);
        }
        if (empty($data['phone']) || !preg_match('/^[0-9]{10}$/', trim($data['phone']))) {
            throw new ValidationException(['phone' => 'Contact number must be exactly 10 digits.']);
        }
        if (empty($data['emergency_phone']) || !preg_match('/^[0-9]{10}$/', trim($data['emergency_phone']))) {
            throw new ValidationException(['emergency_phone' => 'Emergency contact number must be exactly 10 digits.']);
        }
        if (trim($data['emergency_phone']) === trim($data['phone'])) {
            throw new ValidationException(['emergency_phone' => 'Emergency contact number must be different from contact number.']);
        }
        if (empty($data['email']) || !filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException(['email' => 'Invalid email address format.']);
        }
        if (empty($data['joining_date']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($data['joining_date']))) {
            throw new ValidationException(['joining_date' => 'Joining date is required.']);
        }
        if (!isset($data['salary']) || $data['salary'] === '') {
            throw new ValidationException(['salary' => 'Salary is required.']);
        }
        if (!is_numeric($data['salary']) || (float)$data['salary'] <= 0) {
            throw new ValidationException(['salary' => 'Salary must be a positive number.']);
        }
        if (!empty($data['exit_date'])) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($data['exit_date']))) {
                throw new ValidationException(['exit_date' => 'Invalid exit date format.']);
            }
            if (strtotime($data['exit_date']) < strtotime($data['joining_date'])) {
                throw new ValidationException(['exit_date' => 'Exit date cannot be earlier than joining date.']);
            }
        }

        // 2. Uniqueness Checks
        $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND id != :id LIMIT 1");
        $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':id' => $id]);
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        $stmtCheckEmail = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = :email AND id != :id LIMIT 1");
        $stmtCheckEmail->execute([':sid' => $schoolId, ':email' => trim($data['email']), ':id' => $id]);
        if ($stmtCheckEmail->fetchColumn() !== false) {
            throw new ValidationException(['email' => 'This email address already exists.']);
        }

        // 3. Status Mapping
        $status = !empty($data['exit_date']) ? 'Inactive' : 'ACTIVE';

        // 4. Update
        $this->staffRepo->update($id, [
            'name'                    => $data['name'],
            'role'                    => $data['role'] ?? 'Teacher',
            'department'              => $data['department'] ?? null,
            'phone'                   => $data['phone'],
            'email'                   => $data['email'],
            'status'                  => $status,
            'salary'                  => $data['salary'] ?? null,
            'joining_date'            => $data['joining_date'],
            'photo_path'              => $data['photo_path'] ?? null,
            'father_name'             => $data['father_name'],
            'mother_name'             => $data['mother_name'],
            'parent_occupation'       => $data['parent_occupation'] ?? null,
            'emergency_phone'         => $data['emergency_phone'],
            'exit_date'               => !empty($data['exit_date']) ? $data['exit_date'] : null,
            'current_address_line'    => $data['current_address_line'] ?? null,
            'current_city'            => $data['current_city'] ?? null,
            'current_state'           => $data['current_state'] ?? null,
            'current_country'         => $data['current_country'] ?? null,
            'current_pin_code'        => $data['current_pin_code'] ?? null,
            'permanent_address_line'  => $data['permanent_address_line'] ?? null,
            'permanent_city'          => $data['permanent_city'] ?? null,
            'permanent_state'         => $data['permanent_state'] ?? null,
            'permanent_country'       => $data['permanent_country'] ?? null,
            'permanent_pin_code'      => $data['permanent_pin_code'] ?? null,
            'same_as_current'         => isset($data['same_as_current']) ? (int)$data['same_as_current'] : 0,
        ]);

        // Save documents
        $pdo->prepare("DELETE FROM staff_documents WHERE staff_id = :sid")->execute([':sid' => $id]);
        if (!empty($data['documents']) && is_array($data['documents'])) {
            $stmtDoc = $pdo->prepare("
                INSERT INTO staff_documents (school_id, staff_id, category, file_name, file_path, file_size)
                VALUES (:sid, :staff_id, :category, :file_name, :file_path, :file_size)
            ");
            foreach ($data['documents'] as $doc) {
                $stmtDoc->execute([
                    ':sid' => $schoolId,
                    ':staff_id' => $id,
                    ':category' => $doc['category'],
                    ':file_name' => $doc['file_name'],
                    ':file_path' => $doc['file_path'],
                    ':file_size' => (int)$doc['file_size']
                ]);
            }
        }

        return $this->getStaffDetails($user, $id);
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

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : null;

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

    public function getAcademicYears(array $user): array
    {
        $pdo  = $this->classRepo->getPdo();
        $stmt = $pdo->prepare(
            "SELECT * FROM academic_years WHERE school_id = :sid ORDER BY id DESC"
        );
        $stmt->execute([':sid' => $this->getSchoolId($user)]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createAcademicYear(array $user, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        if (empty($body['name'])) {
            throw new ValidationException(['name' => 'Academic Year name is required.']);
        }

        // Parse and validate the name
        if (!preg_match('/^(\d{4})[-–—](\d{4})$/u', trim($body['name']), $matches)) {
            throw new ValidationException(['name' => 'Academic Year name must be in YYYY–YYYY format (e.g., 2027–2028).']);
        }

        $startYear = (int)$matches[1];
        $endYear = (int)$matches[2];

        if ($endYear !== $startYear + 1) {
            throw new ValidationException(['name' => 'The academic year must span exactly one year, starting on 1 April and ending on 31 March (e.g. 2027–2028).']);
        }

        $startDate = isset($body['start_date']) ? trim($body['start_date']) : "{$startYear}-04-01";
        $endDate = isset($body['end_date']) ? trim($body['end_date']) : "{$endYear}-03-31";

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            throw new ValidationException(['start_date' => 'Invalid start date format.']);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            throw new ValidationException(['end_date' => 'Invalid end date format.']);
        }

        // Check if academic year already exists
        $stmtCheck = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND name = :name");
        $stmtCheck->execute([':sid' => $schoolId, ':name' => trim($body['name'])]);
        if ($stmtCheck->fetchColumn() !== false) {
            throw new ValidationException(['name' => 'This academic year already exists.']);
        }

        // Check if a Draft academic year already exists for this school
        $stmtDraftCheck = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND status = 'Draft' LIMIT 1");
        $stmtDraftCheck->execute([':sid' => $schoolId]);
        if ($stmtDraftCheck->fetchColumn() !== false) {
            throw new ValidationException(['name' => 'Only one Draft Academic Year is allowed at a time. Please activate the existing Draft Academic Year before creating another.']);
        }

        // Create new academic year with status = 'Draft'
        $stmtInsert = $pdo->prepare("INSERT INTO academic_years (school_id, name, start_date, end_date, is_current, status) VALUES (:school_id, :name, :start_date, :end_date, 0, 'Draft')");
        $stmtInsert->execute([
            ':school_id' => $schoolId,
            ':name' => trim($body['name']),
            ':start_date' => $startDate,
            ':end_date' => $endDate
        ]);
        $newYearId = (int)$pdo->lastInsertId();

        $this->log('Academic year created as Draft', ['name' => $body['name'], 'school_id' => $schoolId]);
        return ['id' => $newYearId, 'name' => $body['name'], 'status' => 'Draft'];
    }

    public function migrateAcademicYear(array $user, int $newYearId, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Fetch the target academic year
        $stmtYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtYear->execute([':id' => $newYearId, ':sid' => $schoolId]);
        $targetYear = $stmtYear->fetch(PDO::FETCH_ASSOC);
        if (!$targetYear) {
            throw new NotFoundException('Academic year not found.');
        }

        // Find the previous active academic year
        $stmtPrev = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
        $stmtPrev->execute([':sid' => $schoolId]);
        $prevYearId = $stmtPrev->fetchColumn();

        $pdo->beginTransaction();
        try {
            // If there's a previous active academic year, run the promotion migration
            if ($prevYearId !== false) {
                $prevYearId = (int)$prevYearId;
                $stmtPrevYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
                $stmtPrevYear->execute([':id' => $prevYearId, ':sid' => $schoolId]);
                $prevYear = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);

                // 1. Fetch all classes from previous academic year
                $stmtClasses = $pdo->prepare("SELECT * FROM classes WHERE school_id = :sid AND academic_year_id = :prev_id");
                $stmtClasses->execute([':sid' => $schoolId, ':prev_id' => $prevYearId]);
                $oldClasses = $stmtClasses->fetchAll(PDO::FETCH_ASSOC);

                // 2. Duplicate all classes into the new academic year
                $classMap = []; // [old_class_id => new_class_id]
                $stmtInsClass = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:school_id, :name, :section, :stream, :new_ay_id)");
                foreach ($oldClasses as $oc) {
                    $stmtInsClass->execute([
                        ':school_id' => $schoolId,
                        ':name' => $oc['name'],
                        ':section' => $oc['section'],
                        ':stream' => $oc['stream'],
                        ':new_ay_id' => $newYearId
                    ]);
                    $newClassId = (int)$pdo->lastInsertId();
                    $classMap[(int)$oc['id']] = $newClassId;
                }

                // 3. Duplicate subjects to new classes (assigning teacher only if migrated)
                $subjectMap = []; // [old_subject_id => new_subject_id]
                $stmtSubjects = $pdo->prepare("SELECT * FROM subjects WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtSubjects->execute([':sid' => $schoolId]);
                $oldSubjects = $stmtSubjects->fetchAll(PDO::FETCH_ASSOC);

                $oldClassIds = array_keys($classMap);
                $teacherMigrations = $body['teacher_migrations'] ?? []; // Array of staff.id checked for migration

                $stmtInsSubj = $pdo->prepare("INSERT INTO subjects (school_id, name, code, class_id, teacher_id) VALUES (:school_id, :name, :code, :class_id, :teacher_id)");
                foreach ($oldSubjects as $os) {
                    $oldClassId = (int)$os['class_id'];
                    if (in_array($oldClassId, $oldClassIds, true)) {
                        $newClassId = $classMap[$oldClassId];

                        $teacherId = null;
                        if ($os['teacher_id'] !== null) {
                            // Find matching staff record by email
                            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = (SELECT email FROM users WHERE id = :uid LIMIT 1) LIMIT 1");
                            $stmtStaff->execute([':sid' => $schoolId, ':uid' => $os['teacher_id']]);
                            $staffId = $stmtStaff->fetchColumn();
                            if ($staffId !== false && in_array((int)$staffId, $teacherMigrations, true)) {
                                $teacherId = $os['teacher_id'];
                            }
                        }

                        $stmtInsSubj->execute([
                            ':school_id' => $schoolId,
                            ':name' => $os['name'],
                            ':code' => $os['code'],
                            ':class_id' => $newClassId,
                            ':teacher_id' => $teacherId
                        ]);
                        $newSubjectId = (int)$pdo->lastInsertId();
                        $subjectMap[(int)$os['id']] = $newSubjectId;
                    }
                }

                // 4. Duplicate timetable entries
                $stmtTimetable = $pdo->prepare("SELECT * FROM timetable WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtTimetable->execute([':sid' => $schoolId]);
                $oldTimetables = $stmtTimetable->fetchAll(PDO::FETCH_ASSOC);

                $stmtInsTimetable = $pdo->prepare("INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES (:school_id, :class_id, :subject_id, :teacher_id, :day_of_week, :start_time, :end_time, :room)");
                foreach ($oldTimetables as $ot) {
                    $oldClassId = (int)$ot['class_id'];
                    if (in_array($oldClassId, $oldClassIds, true)) {
                        $newClassId = $classMap[$oldClassId];
                        $oldSubjId = (int)$ot['subject_id'];
                        $newSubjId = $subjectMap[$oldSubjId] ?? null;

                        $teacherId = null;
                        if ($ot['teacher_id'] !== null) {
                            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = (SELECT email FROM users WHERE id = :uid LIMIT 1) LIMIT 1");
                            $stmtStaff->execute([':sid' => $schoolId, ':uid' => $ot['teacher_id']]);
                            $staffId = $stmtStaff->fetchColumn();
                            if ($staffId !== false && in_array((int)$staffId, $teacherMigrations, true)) {
                                $teacherId = $ot['teacher_id'];
                            }
                        }

                        $stmtInsTimetable->execute([
                            ':school_id' => $schoolId,
                            ':class_id' => $newClassId,
                            ':subject_id' => $newSubjId,
                            ':teacher_id' => $teacherId,
                            ':day_of_week' => $ot['day_of_week'],
                            ':start_time' => $ot['start_time'],
                            ':end_time' => $ot['end_time'],
                            ':room' => $ot['room']
                        ]);
                    }
                }

                // 5. Duplicate fee structures
                $stmtFeeStructures = $pdo->prepare("SELECT * FROM fee_structures WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtFeeStructures->execute([':sid' => $schoolId]);
                $oldFeeStructures = $stmtFeeStructures->fetchAll(PDO::FETCH_ASSOC);

                $stmtInsFee = $pdo->prepare("INSERT INTO fee_structures (school_id, name, amount, frequency, class_id) VALUES (:school_id, :name, :amount, :frequency, :class_id)");
                foreach ($oldFeeStructures as $ofs) {
                    $oldClassId = (int)$ofs['class_id'];
                    if (in_array($oldClassId, $oldClassIds, true)) {
                        $newClassId = $classMap[$oldClassId];
                        $stmtInsFee->execute([
                            ':school_id' => $schoolId,
                            ':name' => $ofs['name'],
                            ':amount' => $ofs['amount'],
                            ':frequency' => $ofs['frequency'],
                            ':class_id' => $newClassId
                        ]);
                    }
                }

                // 6. Promote / Repeat / Graduate students
                $studentMigrations = $body['student_migrations'] ?? [];
                $stmtUpdateStudent = $pdo->prepare("UPDATE students SET class_id = :class_id, academic_year_id = :ay_id, status = :status, roll_no = :roll_no WHERE id = :id AND school_id = :sid");

                $classOrder = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

                foreach ($studentMigrations as $sm) {
                    $studentId = (int)$sm['student_id'];
                    $action = $sm['action'];

                    $stmtStu = $pdo->prepare("SELECT s.class_id, s.name AS student_name, c.name, c.section FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = :id AND s.school_id = :sid LIMIT 1");
                    $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
                    $stuInfo = $stmtStu->fetch(PDO::FETCH_ASSOC);
                    if (!$stuInfo) continue;

                    $outstanding = 0.0;
                    $studentName = $stuInfo['student_name'] ?? 'Student';
                    
                    if ($action === 'promote' || $action === 'repeat') {
                        $outstanding = $this->getStudentOutstandingBalanceForYear($pdo, $studentId, $schoolId, $prevYearId);
                        if ($outstanding > 0) {
                            // Check if 'Previous Year Dues' additional fee type already exists
                            $stmtType = $pdo->prepare("
                                SELECT id FROM additional_fee_types 
                                WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Previous Year Dues' LIMIT 1
                            ");
                            $stmtType->execute([':sid' => $schoolId, ':ayid' => $newYearId]);
                            $typeId = $stmtType->fetchColumn();
                            
                            if ($typeId === false) {
                                $stmtInsType = $pdo->prepare("
                                    INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, due_date, category)
                                    VALUES (:sid, 'Previous Year Dues', 0.0, :ayid, :due_date, 'System Generated')
                                ");
                                $stmtInsType->execute([
                                    ':sid' => $schoolId,
                                    ':ayid' => $newYearId,
                                    ':due_date' => $targetYear['start_date']
                                ]);
                                $typeId = (int)$pdo->lastInsertId();
                            } else {
                                $typeId = (int)$typeId;
                            }
                            
                            // Create the payment record
                            $stmtInsPay = $pdo->prepare("
                                INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status)
                                VALUES (:sid, :student_id, :fee_type_id, :amount, 'Pending')
                            ");
                            $stmtInsPay->execute([
                                ':sid' => $schoolId,
                                ':student_id' => $studentId,
                                ':fee_type_id' => $typeId,
                                ':amount' => $outstanding
                            ]);
                            
                            // Log the audit trail
                            $logAction = "Migrated prev year dues: student ID {$studentId}, INR {$outstanding}, from AY {$prevYearId} to {$newYearId}";
                            
                            $stmtAudit = $pdo->prepare("
                                INSERT INTO audit_logs (action, target_school, user, ip_address)
                                VALUES (:action, :target_school, :user, :ip_address)
                            ");
                            $stmtAudit->execute([
                                ':action' => $logAction,
                                ':target_school' => (string)$schoolId,
                                ':user' => $user['email'] ?? 'admin',
                                ':ip_address' => '127.0.0.1'
                            ]);
                        }
                    }

                    if ($action === 'promote') {
                        $currentClassName = $stuInfo['name'] ?? '';
                        $section = $stuInfo['section'];
                        $nextClassName = null;

                        foreach ($classOrder as $index => $name) {
                            if (strcasecmp(trim($currentClassName), $name) === 0) {
                                if ($index + 1 < count($classOrder)) {
                                    $nextClassName = $classOrder[$index + 1];
                                }
                                break;
                            }
                        }

                        if ($nextClassName === null && preg_match('/Class\s+(\d+)/i', $currentClassName, $matches)) {
                            $num = (int)$matches[1];
                            if ($num >= 1 && $num < 12) {
                                $nextClassName = 'Class ' . ($num + 1);
                            }
                        }

                        $newClassId = null;
                        if ($nextClassName !== null) {
                            $stmtFindClass = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND academic_year_id = :new_ay_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) LIMIT 1");
                            $stmtFindClass->execute([
                                ':sid' => $schoolId,
                                ':new_ay_id' => $newYearId,
                                ':name' => $nextClassName,
                                ':section' => $section,
                                ':section_null' => $section === null ? 1 : 0
                            ]);
                            $fId = $stmtFindClass->fetchColumn();
                            if ($fId !== false) {
                                $newClassId = (int)$fId;
                            } else {
                                $stmtCreateC = $pdo->prepare("INSERT INTO classes (school_id, name, section, academic_year_id) VALUES (:sid, :name, :section, :new_ay_id)");
                                $stmtCreateC->execute([
                                    ':sid' => $schoolId,
                                    ':name' => $nextClassName,
                                    ':section' => $section,
                                    ':new_ay_id' => $newYearId
                                ]);
                                $newClassId = (int)$pdo->lastInsertId();
                            }
                        }

                        $newRollNo = null;
                        if ($newClassId !== null) {
                            $stmtRollVal = $pdo->prepare("
                                SELECT MAX(CAST(roll_no AS UNSIGNED)) 
                                FROM students 
                                WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
                            ");
                            $stmtRollVal->execute([
                                ':class_id' => $newClassId,
                                ':academic_year_id' => $newYearId,
                                ':school_id' => $schoolId
                            ]);
                            $maxRollVal = (int)$stmtRollVal->fetchColumn();
                            $newRollNo = (string)($maxRollVal + 1);
                        }

                        $stmtUpdateStudent->execute([
                            ':class_id' => $newClassId,
                            ':ay_id' => $newYearId,
                            ':status' => 'ACTIVE',
                            ':roll_no' => $newRollNo,
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);

                    } elseif ($action === 'repeat') {
                        $currentClassName = $stuInfo['name'] ?? '';
                        $section = $stuInfo['section'];

                        $newClassId = null;
                        if (!empty($currentClassName)) {
                            $stmtFindClass = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND academic_year_id = :new_ay_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) LIMIT 1");
                            $stmtFindClass->execute([
                                ':sid' => $schoolId,
                                ':new_ay_id' => $newYearId,
                                ':name' => $currentClassName,
                                ':section' => $section,
                                ':section_null' => $section === null ? 1 : 0
                            ]);
                            $fId = $stmtFindClass->fetchColumn();
                            if ($fId !== false) {
                                $newClassId = (int)$fId;
                            } else {
                                $stmtCreateC = $pdo->prepare("INSERT INTO classes (school_id, name, section, academic_year_id) VALUES (:sid, :name, :section, :new_ay_id)");
                                $stmtCreateC->execute([
                                    ':sid' => $schoolId,
                                    ':name' => $currentClassName,
                                    ':section' => $section,
                                    ':new_ay_id' => $newYearId
                                ]);
                                $newClassId = (int)$pdo->lastInsertId();
                            }
                        }

                        $newRollNo = null;
                        if ($newClassId !== null) {
                            $stmtRollVal = $pdo->prepare("
                                SELECT MAX(CAST(roll_no AS UNSIGNED)) 
                                FROM students 
                                WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
                            ");
                            $stmtRollVal->execute([
                                ':class_id' => $newClassId,
                                ':academic_year_id' => $newYearId,
                                ':school_id' => $schoolId
                            ]);
                            $maxRollVal = (int)$stmtRollVal->fetchColumn();
                            $newRollNo = (string)($maxRollVal + 1);
                        }

                        $stmtUpdateStudent->execute([
                            ':class_id' => $newClassId,
                            ':ay_id' => $newYearId,
                            ':status' => 'ACTIVE',
                            ':roll_no' => $newRollNo,
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);

                    } elseif ($action === 'graduate_alumni') {
                        $stmtUpdateStudent->execute([
                            ':class_id' => $stuInfo['class_id'],
                            ':ay_id' => $prevYearId,
                            ':status' => 'Alumni',
                            ':roll_no' => null,
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);

                    } elseif ($action === 'graduate_archive') {
                        $stmtUpdateStudent->execute([
                            ':class_id' => $stuInfo['class_id'],
                            ':ay_id' => $prevYearId,
                            ':status' => 'Archived',
                            ':roll_no' => null,
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);
                    }
                }
            }

            $pdo->commit();
            $this->log('Academic year rollover migration executed', ['id' => $newYearId, 'school_id' => $schoolId]);
            return ['id' => $newYearId, 'status' => 'Draft', 'migrated' => true];

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getStudentOutstandingBalanceForYear(PDO $pdo, int $studentId, int $schoolId, int $academicYearId): float
    {
        $stmtStu = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $classId = $stmtStu->fetchColumn();
        if ($classId === false || $classId === null) {
            return 0.0;
        }

        $stmtCfg = $pdo->prepare("
            SELECT monthly_fees FROM class_fee_configurations 
            WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id AND is_locked = 1
            LIMIT 1
        ");
        $stmtCfg->execute([
            ':school_id' => $schoolId,
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId
        ]);
        $cfgRow = $stmtCfg->fetch(PDO::FETCH_ASSOC);
        if (!$cfgRow) {
            return 0.0;
        }
        $monthlyFees = json_decode($cfgRow['monthly_fees'], true);

        $stmtPaid = $pdo->prepare("
            SELECT fee_month FROM fee_payments 
            WHERE student_id = :student_id AND school_id = :school_id AND status = 'PAID' AND academic_year_id = :academic_year_id
        ");
        $stmtPaid->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId
        ]);
        $paidMonths = $stmtPaid->fetchAll(PDO::FETCH_COLUMN);

        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $outstanding = 0.0;
        foreach ($academicMonths as $m) {
            if (!in_array($m, $paidMonths, true)) {
                $outstanding += isset($monthlyFees[$m]) ? (float)$monthlyFees[$m] : 0.0;
            }
        }

        $today = date('Y-m-d');
        $stmtAddPending = $pdo->prepare("
            SELECT COALESCE(SUM(afp.amount), 0)
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id
              AND afp.school_id = :school_id
              AND afp.status = 'Pending'
              AND aft.academic_year_id = :academic_year_id
              AND (aft.due_date IS NULL OR aft.due_date <= :today)
        ");
        $stmtAddPending->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId,
            ':today' => $today
        ]);
        $outstanding += (float)$stmtAddPending->fetchColumn();

        return $outstanding;
    }

    public function activateAcademicYear(array $user, int $newYearId, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Fetch the target academic year
        $stmtYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtYear->execute([':id' => $newYearId, ':sid' => $schoolId]);
        $targetYear = $stmtYear->fetch(PDO::FETCH_ASSOC);
        if (!$targetYear) {
            throw new NotFoundException('Academic year not found.');
        }

        $pdo->beginTransaction();
        try {
            // Set the target academic year to ACTIVE and current active session
            $stmtUpdate = $pdo->prepare("UPDATE academic_years SET is_current = 1, status = 'ACTIVE' WHERE id = :id AND school_id = :sid");
            $stmtUpdate->execute([':id' => $newYearId, ':sid' => $schoolId]);

            // Archive all other academic years for the school
            $stmtArchive = $pdo->prepare("UPDATE academic_years SET is_current = 0, status = 'Archived' WHERE school_id = :sid AND id != :new_id");
            $stmtArchive->execute([':sid' => $schoolId, ':new_id' => $newYearId]);

            $pdo->commit();
            $this->log('Academic year activated', ['id' => $newYearId, 'school_id' => $schoolId]);
            return ['id' => $newYearId, 'status' => 'ACTIVE'];

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
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
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->attendanceRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

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
        $pdo = $this->examRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

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

        $examId = (int)$data['exam_id'];
        $pdo = $this->examRepo->getPdo();
        $stmt = $pdo->prepare("SELECT school_id FROM exams WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $examId]);
        $schoolId = $stmt->fetchColumn();
        if ($schoolId !== false) {
            $this->requireWritableAcademicYear($pdo, (int)$schoolId);
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

        // 1. Fetch student to get class_id and academic_year_id
        $stmtStudent = $pdo->prepare("SELECT class_id, academic_year_id, status FROM students WHERE id = :id AND school_id = :school_id LIMIT 1");
        $stmtStudent->execute([':id' => $studentId, ':school_id' => $schoolId]);
        $studentRow = $stmtStudent->fetch(PDO::FETCH_ASSOC);
        if (!$studentRow) {
            throw new NotFoundException('Student not found');
        }
        $classId = $studentRow['class_id'];
        $academicYearId = $studentRow['academic_year_id'];

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;
        if ($studentRow['status'] === 'ACTIVE' && $academicYearId !== null && (int)$academicYearId > $workingYearId) {
            throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
        }

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

        // Fetch locked class fee config
        $classFeeConfig = null;
        if ($classId !== null && $academicYearId !== null) {
            $stmtCfg = $pdo->prepare("
                SELECT monthly_fees FROM class_fee_configurations 
                WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id AND is_locked = 1
                LIMIT 1
            ");
            $stmtCfg->execute([
                ':school_id' => $schoolId,
                ':class_id' => $classId,
                ':academic_year_id' => $academicYearId
            ]);
            $cfgRow = $stmtCfg->fetch(PDO::FETCH_ASSOC);
            if ($cfgRow) {
                $classFeeConfig = json_decode($cfgRow['monthly_fees'], true);
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
            $monthAmount = $amountPaid;
            if ($classFeeConfig !== null && isset($classFeeConfig[$m])) {
                $monthAmount = (float)$classFeeConfig[$m];
            }

            $id = $this->feeRepo->createPayment([
                'school_id'        => $schoolId,
                'student_id'       => $studentId,
                'fee_structure_id' => $feeStructureId,
                'amount_paid'      => $monthAmount,
                'payment_date'     => date('Y-m-d'),
                'receipt_no'       => $receiptNo,
                'status'           => 'PAID',
                'fee_month'        => $m,
                'academic_year_id' => $academicYearId
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

    public function uploadSchoolLogo(array $user, $uploadedFile): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $logoPath = $this->handleFileUpload($uploadedFile);

        $stmt = $pdo->prepare("UPDATE schools SET logo_path = :logo_path WHERE id = :id");
        $stmt->execute([
            ':logo_path' => $logoPath,
            ':id'        => $schoolId
        ]);

        return $this->getSchoolProfile($user);
    }

    public function removeSchoolLogo(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("UPDATE schools SET logo_path = NULL WHERE id = :id");
        $stmt->execute([
            ':id' => $schoolId
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

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : null;

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

        $stmtGetInfo = $pdo->prepare("
            SELECT s.academic_year_id AS student_ay_id, s.status AS student_status, fp.academic_year_id AS payment_ay_id
            FROM fee_payments fp
            JOIN students s ON s.id = fp.student_id
            WHERE fp.id = :id AND fp.school_id = :sid
            LIMIT 1
        ");
        $stmtGetInfo->execute([':id' => $id, ':sid' => $schoolId]);
        $info = $stmtGetInfo->fetch(PDO::FETCH_ASSOC);
        if ($info) {
            $studentAyId = $info['student_ay_id'] !== null ? (int)$info['student_ay_id'] : 0;
            $paymentAyId = $info['payment_ay_id'] !== null ? (int)$info['payment_ay_id'] : 0;
            if ($info['student_status'] === 'ACTIVE' && $studentAyId > $paymentAyId) {
                throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
            }
        }

        $receiptNo = $row['receipt_no'];

        if (!empty($receiptNo)) {
            // Delete all payments in this transaction
            $stmtDel = $pdo->prepare("DELETE FROM fee_payments WHERE receipt_no = :receipt_no AND school_id = :school_id");
            return $stmtDel->execute([':receipt_no' => $receiptNo, ':school_id' => $schoolId]);
        }

        return $this->feeRepo->deletePayment($id);
    }

    public function getClassFeeConfigurations(array $user, ?int $classId, ?int $academicYearId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();

        $query = "SELECT * FROM class_fee_configurations WHERE school_id = :school_id";
        $params = [':school_id' => $schoolId];

        if ($classId !== null) {
            $query .= " AND class_id = :class_id";
            $params[':class_id'] = $classId;
        }

        if ($academicYearId !== null) {
            $query .= " AND academic_year_id = :academic_year_id";
            $params[':academic_year_id'] = $academicYearId;
        }

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as &$row) {
            $row['monthly_fees'] = json_decode($row['monthly_fees'], true);
            $row['is_locked'] = (int)$row['is_locked'];
        }

        return $rows;
    }

    public function saveClassFeeConfiguration(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        if (empty($data['class_id'])) {
            throw new ValidationException(['class_id' => 'Please select a class.']);
        }
        if (empty($data['academic_year_id'])) {
            throw new ValidationException(['academic_year_id' => 'Academic Year is required.']);
        }

        $classId = (int)$data['class_id'];
        $academicYearId = (int)$data['academic_year_id'];
        $mode = $data['mode'] ?? 'SAME';
        $monthlyFees = $data['monthly_fees'] ?? [];

        if (!in_array($mode, ['SAME', 'DIFFERENT'], true)) {
            throw new ValidationException(['mode' => 'Invalid fee configuration mode.']);
        }

        // Validate monthly fee amounts
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        foreach ($academicMonths as $m) {
            if ($mode === 'SAME' && count($monthlyFees) === 0) {
                throw new ValidationException(['monthly_fees' => 'Fee amount must be greater than zero.']);
            }

            $val = isset($monthlyFees[$m]) ? $monthlyFees[$m] : null;
            if ($mode === 'DIFFERENT' && ($val === null || $val === '')) {
                throw new ValidationException(['monthly_fees' => 'Please enter fee for every month.']);
            }

            if ($val !== null && $val !== '') {
                $valFloat = (float)$val;
                if ($valFloat <= 0) {
                    throw new ValidationException(['monthly_fees' => 'Fee amount must be greater than zero.']);
                }
            }
        }

        // Check if configuration already exists and is locked
        $stmtCheck = $pdo->prepare("SELECT is_locked FROM class_fee_configurations WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id LIMIT 1");
        $stmtCheck->execute([
            ':school_id' => $schoolId,
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId
        ]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($existing && (int)$existing['is_locked'] === 1) {
            throw new ValidationException(['lock' => 'Class fee configuration is locked and cannot be changed.']);
        }

        $jsonFees = json_encode($monthlyFees);

        if ($existing) {
            $stmtUpdate = $pdo->prepare("
                UPDATE class_fee_configurations 
                SET mode = :mode, monthly_fees = :monthly_fees 
                WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id
            ");
            $stmtUpdate->execute([
                ':mode' => $mode,
                ':monthly_fees' => $jsonFees,
                ':school_id' => $schoolId,
                ':class_id' => $classId,
                ':academic_year_id' => $academicYearId
            ]);
        } else {
            $stmtInsert = $pdo->prepare("
                INSERT INTO class_fee_configurations (school_id, class_id, academic_year_id, mode, monthly_fees, is_locked)
                VALUES (:school_id, :class_id, :academic_year_id, :mode, :monthly_fees, 0)
            ");
            $stmtInsert->execute([
                ':school_id' => $schoolId,
                ':class_id' => $classId,
                ':academic_year_id' => $academicYearId,
                ':mode' => $mode,
                ':monthly_fees' => $jsonFees
            ]);
        }

        return [
            'school_id' => $schoolId,
            'class_id' => $classId,
            'academic_year_id' => $academicYearId,
            'mode' => $mode,
            'monthly_fees' => $monthlyFees,
            'is_locked' => 0
        ];
    }

    public function lockClassFeeConfiguration(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        if (empty($data['class_id'])) {
            throw new ValidationException(['class_id' => 'Please select a class.']);
        }
        if (empty($data['academic_year_id'])) {
            throw new ValidationException(['academic_year_id' => 'Academic Year is required.']);
        }

        $classId = (int)$data['class_id'];
        $academicYearId = (int)$data['academic_year_id'];

        $stmt = $pdo->prepare("
            UPDATE class_fee_configurations 
            SET is_locked = 1 
            WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id
        ");
        $stmt->execute([
            ':school_id' => $schoolId,
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId
        ]);

        return [
            'class_id' => $classId,
            'academic_year_id' => $academicYearId,
            'is_locked' => 1
        ];
    }

    private function getMonthsDueUpToCurrent(string $startDateStr, string $endDateStr): array
    {
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        
        try {
            $now = new \DateTime();
            $startDate = new \DateTime($startDateStr);
            $endDate = new \DateTime($endDateStr);
            
            if ($now < $startDate) {
                return [];
            }
            
            $currentMonthName = $now->format('F');
            $idx = array_search($currentMonthName, $academicMonths);
            if ($idx === false) {
                return $academicMonths;
            }
            
            return array_slice($academicMonths, 0, $idx + 1);
        } catch (\Exception $e) {
            return $academicMonths;
        }
    }

    public function getNextRollNo(array $user, int $classId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtClass = $pdo->prepare("SELECT id, academic_year_id FROM classes WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtClass->execute([':id' => $classId, ':sid' => $schoolId]);
        $class = $stmtClass->fetch(\PDO::FETCH_ASSOC);
        if (!$class) {
            throw new NotFoundException('Class not found.');
        }

        $academicYearId = (int)$class['academic_year_id'];

        $stmtRoll = $pdo->prepare("
            SELECT MAX(CAST(roll_no AS UNSIGNED)) 
            FROM students 
            WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
        ");
        $stmtRoll->execute([
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId,
            ':school_id' => $schoolId
        ]);
        $maxRoll = (int)$stmtRoll->fetchColumn();
        $nextRollNo = $maxRoll + 1;

        return ['next_roll_no' => $nextRollNo];
    }

    public function getStaffPayments(array $user, string $month): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        // Get working academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // Query active staff members and their payout status for the given month
        $stmt = $pdo->prepare("
            SELECT s.id AS staff_id, s.name, s.role, s.department, COALESCE(s.salary, 0.0) AS salary, 
                   s.photo_path, s.updated_at,
                   sp.id AS payment_id, sp.payment_date,
                   CASE WHEN sp.id IS NOT NULL THEN 'Paid' ELSE 'Pending' END AS payment_status
            FROM staff s
            LEFT JOIN staff_payments sp ON s.id = sp.staff_id AND sp.payment_month = :month AND sp.academic_year_id = :ayid
            WHERE s.school_id = :sid AND s.status = 'ACTIVE'
        ");
        $stmt->execute([
            ':month' => $month,
            ':ayid' => $academicYearId,
            ':sid' => $schoolId
        ]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $results = [];
        foreach ($rows as $row) {
            $results[] = [
                'id' => (int)$row['staff_id'],
                'name' => $row['name'],
                'designation' => trim(($row['role'] ?? '') . ' ' . ($row['department'] ?? '')),
                'salary' => (float)$row['salary'],
                'status' => $row['payment_status'],
                'date' => $row['payment_date'] ? $row['payment_date'] : '—',
                'payment_id' => $row['payment_id'] ? (int)$row['payment_id'] : null,
                'photo_path' => $row['photo_path'],
                'updated_at' => $row['updated_at']
            ];
        }

        return $results;
    }

    public function payStaffSalary(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $staffId = (int)($data['staff_id'] ?? 0);
        $month = trim($data['month'] ?? '');

        if ($staffId <= 0 || empty($month)) {
            throw new ValidationException(['message' => 'Staff ID and Month are required.']);
        }

        // Fetch staff member
        $staff = $this->staffRepo->findById($staffId);
        if (!$staff || (int)$staff['school_id'] !== $schoolId) {
            throw new NotFoundException('Staff member not found.');
        }

        // Get current active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['message' => 'No active or draft academic year found.']);
        }
        $academicYearId = (int)$workingYear['id'];

        // Prevent duplicate payments
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM staff_payments 
            WHERE school_id = :sid AND staff_id = :staff_id AND academic_year_id = :ayid AND payment_month = :month
        ");
        $stmtDup->execute([
            ':sid' => $schoolId,
            ':staff_id' => $staffId,
            ':ayid' => $academicYearId,
            ':month' => $month
        ]);
        if ((int)$stmtDup->fetchColumn() > 0) {
            throw new ValidationException(['month' => 'Salary for this month has already been disbursed.']);
        }

        // Enforce chronological month sequence validation
        $monthsOrder = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $targetIndex = array_search($month, $monthsOrder, true);
        if ($targetIndex === false) {
            throw new ValidationException(['month' => 'Invalid payment month specified.']);
        }

        if ($targetIndex > 0) {
            // Fetch paid months for this teacher in the academic year
            $stmtPaid = $pdo->prepare("
                SELECT payment_month FROM staff_payments 
                WHERE school_id = :sid AND staff_id = :staff_id AND academic_year_id = :ayid
            ");
            $stmtPaid->execute([
                ':sid' => $schoolId,
                ':staff_id' => $staffId,
                ':ayid' => $academicYearId
            ]);
            $paidMonths = $stmtPaid->fetchAll(\PDO::FETCH_COLUMN);

            for ($i = 0; $i < $targetIndex; $i++) {
                $prevMonth = $monthsOrder[$i];
                if (!in_array($prevMonth, $paidMonths, true)) {
                    throw new ValidationException(['month' => "Previous month's salary is still pending. Please complete earlier salary payments first."]);
                }
            }
        }

        $salary = (float)($staff['salary'] ?? 0.0);
        $paymentDate = date('Y-m-d');

        // Insert staff payment
        $stmt = $pdo->prepare("
            INSERT INTO staff_payments (school_id, staff_id, academic_year_id, amount_paid, payment_month, payment_date)
            VALUES (:sid, :staff_id, :ayid, :amount_paid, :month, :payment_date)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':staff_id' => $staffId,
            ':ayid' => $academicYearId,
            ':amount_paid' => $salary,
            ':month' => $month,
            ':payment_date' => $paymentDate
        ]);

        return ['success' => true, 'id' => (int)$pdo->lastInsertId()];
    }

    public function revertStaffSalary(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // Fetch payment details first
        $stmtPayment = $pdo->prepare("SELECT * FROM staff_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtPayment->execute([':id' => $id, ':sid' => $schoolId]);
        $payment = $stmtPayment->fetch(PDO::FETCH_ASSOC);

        if (!$payment) {
            throw new NotFoundException('Salary payment record not found.');
        }

        // Check if the payment date falls within any generated financial report
        $stmtCheckReport = $pdo->prepare("
            SELECT COUNT(*) FROM financial_reports 
            WHERE school_id = :sid AND :payment_date BETWEEN `from_date` AND `to_date`
        ");
        $stmtCheckReport->execute([
            ':sid' => $schoolId,
            ':payment_date' => $payment['payment_date']
        ]);
        if ((int)$stmtCheckReport->fetchColumn() > 0) {
            throw new ValidationException(['locked' => 'This salary payment can no longer be reverted because it has already been included in a generated Financial Report.']);
        }

        // Verify and delete payout
        $stmtDel = $pdo->prepare("DELETE FROM staff_payments WHERE id = :id AND school_id = :sid");
        $stmtDel->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function getFinancialPreview(array $user, string $from, string $to): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $latestReport = null;
        if ($workingYear) {
            $stmtLatest = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND created_at >= :start_dt 
                  AND created_at <= :end_dt 
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmtLatest->execute([
                ':sid' => $schoolId,
                ':start_dt' => $workingYear['start_date'] . ' 00:00:00',
                ':end_dt' => $workingYear['end_date'] . ' 23:59:59'
            ]);
            $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);
        }

        // Determine from_timestamp and operator
        if ($latestReport) {
            $fromTimestamp = $latestReport['created_at'];
            $operator = '>';
        } else {
            $fromTimestamp = $workingYear ? ($workingYear['start_date'] . ' 00:00:00') : ($from !== '' ? ($from . ' 00:00:00') : date('Y-m-d H:i:s', strtotime('-30 days')));
            $operator = '>=';
        }

        // Determine to_timestamp
        $todayStr = date('Y-m-d');
        if ($to === $todayStr || $to === '') {
            $toTimestamp = date('Y-m-d H:i:s');
        } else {
            $toTimestamp = $to . ' 23:59:59';
        }

        // 1. Total Student Tuition Fees Collected
        $stmtFees = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) 
            FROM fee_payments 
            WHERE school_id = :sid AND created_at {$operator} :from_ts AND created_at <= :to_ts
        ");
        $stmtFees->execute([':sid' => $schoolId, ':from_ts' => $fromTimestamp, ':to_ts' => $toTimestamp]);
        $tuitionCollected = (float)$stmtFees->fetchColumn();

        // 2. Total Additional Paid Fees (Additional Fee Ledger - Paid records only)
        $stmtAddFees = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) 
            FROM additional_fee_payments 
            WHERE school_id = :sid AND status = 'Paid' AND created_at {$operator} :from_ts AND created_at <= :to_ts
        ");
        $stmtAddFees->execute([':sid' => $schoolId, ':from_ts' => $fromTimestamp, ':to_ts' => $toTimestamp]);
        $addFeesCollected = (float)$stmtAddFees->fetchColumn();

        $totalFees = $tuitionCollected + $addFeesCollected;

        // 3. Total Teacher Salaries Paid
        $stmtSalaries = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) 
            FROM staff_payments 
            WHERE school_id = :sid AND created_at {$operator} :from_ts AND created_at <= :to_ts
        ");
        $stmtSalaries->execute([':sid' => $schoolId, ':from_ts' => $fromTimestamp, ':to_ts' => $toTimestamp]);
        $salariesPaid = (float)$stmtSalaries->fetchColumn();

        // 4. Total School Expenses Logged
        $stmtExpenses = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) 
            FROM school_expenses 
            WHERE school_id = :sid AND created_at {$operator} :from_ts AND created_at <= :to_ts
        ");
        $stmtExpenses->execute([':sid' => $schoolId, ':from_ts' => $fromTimestamp, ':to_ts' => $toTimestamp]);
        $expensesPaid = (float)$stmtExpenses->fetchColumn();

        $totalExpenses = $salariesPaid + $expensesPaid;
        $profitLoss = $totalFees - $totalExpenses;

        return [
            'from_date' => date('Y-m-d', strtotime($fromTimestamp)),
            'to_date' => date('Y-m-d', strtotime($toTimestamp)),
            'fees_collected' => $totalFees,
            'salary_paid' => $totalExpenses,
            'profit_loss' => $profitLoss
        ];
    }

    public function getFinancialReports(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();

        // 1. Fetch generated reports
        $reports = $this->financialReportRepo->findBySchool($schoolId);

        // 2. Format float values and dates
        $reports = array_map(function($r) {
            $r['id'] = (int)$r['id'];
            $r['fees_collected'] = (float)$r['fees_collected'];
            $r['salary_paid'] = (float)$r['salary_paid'];
            $r['profit_loss'] = (float)$r['profit_loss'];
            return $r;
        }, $reports);

        // 3. Determine next suggested start date
        $suggestedStartDate = '';
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        $latestReport = null;
        if ($workingYear) {
            $stmtLatest = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND created_at >= :start_dt 
                  AND created_at <= :end_dt 
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmtLatest->execute([
                ':sid' => $schoolId,
                ':start_dt' => $workingYear['start_date'] . ' 00:00:00',
                ':end_dt' => $workingYear['end_date'] . ' 23:59:59'
            ]);
            $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);
        }

        if ($latestReport) {
            $suggestedStartDate = date('Y-m-d');
        } else {
            if ($workingYear) {
                $suggestedStartDate = $workingYear['start_date'];
            } else {
                $suggestedStartDate = date('Y-m-d');
            }
        }

        return [
            'reports' => $reports,
            'next_suggested_start_date' => $suggestedStartDate,
            'has_previous_report' => $latestReport ? true : false
        ];
    }

    public function createFinancialReport(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();

        if (empty($data['from_date']) || empty($data['to_date'])) {
            throw new ValidationException(['from_date' => 'From date and To date are required.']);
        }

        $from = trim($data['from_date']);
        $to = trim($data['to_date']);

        if (strtotime($to) < strtotime($from)) {
            throw new ValidationException(['to_date' => 'To date cannot be earlier than From date.']);
        }

        // Recalculate profit loss for security
        $preview = $this->getFinancialPreview($user, $from, $to);

        // Generate report ID (REP-XXX)
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM financial_reports WHERE school_id = :sid");
        $stmtCount->execute([':sid' => $schoolId]);
        $count = (int)$stmtCount->fetchColumn();
        $reportId = 'REP-' . str_pad((string)($count + 1), 3, '0', STR_PAD_LEFT);

        $id = $this->financialReportRepo->create([
            'school_id' => $schoolId,
            'report_id' => $reportId,
            'from_date' => $from,
            'to_date' => $to,
            'fees_collected' => $preview['fees_collected'],
            'salary_paid' => $preview['salary_paid'],
            'profit_loss' => $preview['profit_loss'],
            'status' => 'Pending'
        ]);

        return $this->financialReportRepo->findById($id);
    }

    public function updateFinancialReportStatus(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        
        $report = $this->financialReportRepo->findById($id);
        if ($report === null || (int)$report['school_id'] !== $schoolId) {
            throw new NotFoundException('Financial report not found.');
        }

        $status = $data['status'] ?? 'Pending';
        if (!in_array($status, ['Pending', 'Settled'])) {
            throw new ValidationException(['status' => 'Invalid status value.']);
        }

        $this->financialReportRepo->update($id, [
            'status' => $status
        ]);

        return $this->financialReportRepo->findById($id);
    }

    public function getSchoolExpenses(array $user, array $filters = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $where = "se.school_id = :sid";
        $params = [':sid' => $schoolId];

        // Filter by Month
        if (!empty($filters['month']) && $filters['month'] !== 'ALL') {
            $monthsMap = [
                'January' => '01', 'February' => '02', 'March' => '03', 'April' => '04',
                'May' => '05', 'June' => '06', 'July' => '07', 'August' => '08',
                'September' => '09', 'October' => '10', 'November' => '11', 'December' => '12'
            ];
            if (isset($monthsMap[$filters['month']])) {
                $where .= " AND DATE_FORMAT(se.expense_date, '%m') = :month_val";
                $params[':month_val'] = $monthsMap[$filters['month']];
            }
        }

        // Handle search (by matching any word or partial text in description, case-insensitive)
        if (!empty($filters['search'])) {
            $words = array_filter(explode(' ', trim($filters['search'])));
            $wordClauses = [];
            foreach ($words as $idx => $word) {
                $paramName = ":search_word_{$idx}";
                $wordClauses[] = "se.description LIKE {$paramName}";
                $params[$paramName] = '%' . $word . '%';
            }
            if (!empty($wordClauses)) {
                $where .= " AND (" . implode(" AND ", $wordClauses) . ")";
            }
        }

        // Default sorting is always newest first
        $sortBy = "se.expense_date DESC, se.id DESC";

        $stmt = $pdo->prepare("
            SELECT se.*, u.name as creator_name 
            FROM school_expenses se
            JOIN users u ON u.id = se.created_by
            WHERE {$where}
            ORDER BY {$sortBy}
        ");
        $stmt->execute($params);
        $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Pre-prepare locking validation query
        $stmtReports = $pdo->prepare("
            SELECT COUNT(*) FROM financial_reports 
            WHERE school_id = :sid AND :expense_date BETWEEN `from_date` AND `to_date`
        ");

        return array_map(function($e) use ($stmtReports, $schoolId) {
            $e['id'] = (int)$e['id'];
            $e['amount'] = (float)$e['amount'];
            $e['created_by'] = (int)$e['created_by'];
            
            // Check if expense is locked by an existing financial report
            $stmtReports->execute([':sid' => $schoolId, ':expense_date' => $e['expense_date']]);
            $e['is_locked'] = ((int)$stmtReports->fetchColumn() > 0);
            
            return $e;
        }, $expenses);
    }

    public function createSchoolExpense(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        if (empty($data['description']) || strlen(trim($data['description'])) < 3) {
            throw new ValidationException(['description' => 'Description must be at least 3 characters.']);
        }
        if (empty($data['amount']) || (float)$data['amount'] <= 0) {
            throw new ValidationException(['amount' => 'Amount must be greater than 0.']);
        }
        if (empty($data['expense_date'])) {
            throw new ValidationException(['expense_date' => 'Expense Date is required.']);
        }

        $category = !empty($data['category']) ? trim($data['category']) : 'Other';
        $desc = trim($data['description']);
        $amount = (float)$data['amount'];
        $expenseDate = trim($data['expense_date']);
        $createdBy = (int)$user['id'];
        $payMethod = !empty($data['payment_method']) ? trim($data['payment_method']) : 'Cash';
        $refNo = !empty($data['reference_number']) ? trim($data['reference_number']) : null;

        $stmt = $pdo->prepare("
            INSERT INTO school_expenses (school_id, description, amount, created_by, expense_date, category, payment_method, reference_number)
            VALUES (:sid, :desc, :amount, :created_by, :expense_date, :cat, :pmethod, :ref)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':desc' => $desc,
            ':amount' => $amount,
            ':created_by' => $createdBy,
            ':expense_date' => $expenseDate,
            ':cat' => $category,
            ':pmethod' => $payMethod,
            ':ref' => $refNo
        ]);

        $id = (int)$pdo->lastInsertId();

        return $this->getExpenseById($schoolId, $id);
    }

    private function getExpenseById(int $schoolId, int $id): array
    {
        $pdo = $this->staffRepo->getPdo();
        $stmtGet = $pdo->prepare("
            SELECT se.*, u.name as creator_name 
            FROM school_expenses se
            JOIN users u ON u.id = se.created_by
            WHERE se.id = :id AND se.school_id = :sid
            LIMIT 1
        ");
        $stmtGet->execute([':id' => $id, ':sid' => $schoolId]);
        $expense = $stmtGet->fetch(PDO::FETCH_ASSOC);

        if ($expense) {
            $expense['id'] = (int)$expense['id'];
            $expense['amount'] = (float)$expense['amount'];
            $expense['created_by'] = (int)$expense['created_by'];
        }

        return $expense ?: [];
    }

    public function updateSchoolExpense(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $expense = $this->getExpenseById($schoolId, $id);
        if (empty($expense)) {
            throw new NotFoundException('Expense not found.');
        }

        // Enforce lock verification
        $stmtCheckReport = $pdo->prepare("
            SELECT COUNT(*) FROM financial_reports 
            WHERE school_id = :sid AND :expense_date BETWEEN `from_date` AND `to_date`
        ");
        $stmtCheckReport->execute([':sid' => $schoolId, ':expense_date' => $expense['expense_date']]);
        if ((int)$stmtCheckReport->fetchColumn() > 0) {
            throw new ValidationException(['locked' => 'This expense has already been included in a generated financial report and can no longer be modified.']);
        }

        // Verify if expense belongs to currently active or draft academic year
        $year = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($year === null) {
            throw new ValidationException(['academic_year' => 'No active or draft academic year found.']);
        }

        $expTimestamp = strtotime($expense['expense_date']);
        $startY = strtotime($year['start_date']);
        $endY = strtotime($year['end_date']);

        if ($expTimestamp < $startY || $expTimestamp > $endY) {
            throw new ValidationException(['academic_year' => 'Cannot edit expenses from historical or inactive academic years.']);
        }

        // Perform validation
        if (empty($data['description']) || strlen(trim($data['description'])) < 3) {
            throw new ValidationException(['description' => 'Description must be at least 3 characters.']);
        }
        if (empty($data['amount']) || (float)$data['amount'] <= 0) {
            throw new ValidationException(['amount' => 'Amount must be greater than 0.']);
        }
        if (empty($data['expense_date'])) {
            throw new ValidationException(['expense_date' => 'Expense Date is required.']);
        }

        $category = !empty($data['category']) ? trim($data['category']) : 'Other';
        $desc = trim($data['description']);
        $amount = (float)$data['amount'];
        $expenseDate = trim($data['expense_date']);
        $payMethod = !empty($data['payment_method']) ? trim($data['payment_method']) : 'Cash';
        $refNo = !empty($data['reference_number']) ? trim($data['reference_number']) : null;

        $stmt = $pdo->prepare("
            UPDATE school_expenses 
            SET description = :desc, amount = :amount, expense_date = :expense_date, category = :cat, payment_method = :pmethod, reference_number = :ref
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([
            ':id' => $id,
            ':sid' => $schoolId,
            ':desc' => $desc,
            ':amount' => $amount,
            ':expense_date' => $expenseDate,
            ':cat' => $category,
            ':pmethod' => $payMethod,
            ':ref' => $refNo
        ]);

        return $this->getExpenseById($schoolId, $id);
    }

    public function deleteSchoolExpense(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $expense = $this->getExpenseById($schoolId, $id);
        if (empty($expense)) {
            throw new NotFoundException('Expense not found.');
        }

        // Enforce lock verification
        $stmtCheckReport = $pdo->prepare("
            SELECT COUNT(*) FROM financial_reports 
            WHERE school_id = :sid AND :expense_date BETWEEN `from_date` AND `to_date`
        ");
        $stmtCheckReport->execute([':sid' => $schoolId, ':expense_date' => $expense['expense_date']]);
        if ((int)$stmtCheckReport->fetchColumn() > 0) {
            throw new ValidationException(['locked' => 'This expense has already been included in a generated financial report and can no longer be modified.']);
        }

        // Check active year constraints
        $year = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($year === null) {
            throw new ValidationException(['academic_year' => 'No active or draft academic year found.']);
        }

        $expTimestamp = strtotime($expense['expense_date']);
        $startY = strtotime($year['start_date']);
        $endY = strtotime($year['end_date']);

        if ($expTimestamp < $startY || $expTimestamp > $endY) {
            throw new ValidationException(['academic_year' => 'Cannot delete expenses from historical or inactive academic years.']);
        }
        $stmt = $pdo->prepare("DELETE FROM school_expenses WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function getAdditionalFeeTypes(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        // Fetch all classes count to determine "Entire School" / "For All"
        $stmtClasses = $pdo->prepare("SELECT COUNT(*) FROM classes WHERE school_id = :sid");
        $stmtClasses->execute([':sid' => $schoolId]);
        $totalClassesCount = (int)$stmtClasses->fetchColumn();

        $stmt = $pdo->prepare("
            SELECT MIN(aft.id) as id, aft.name, MAX(aft.amount) as amount, aft.due_date, aft.academic_year_id,
                   MAX(aft.category) as category,
                   COUNT(afp.id) as total_students,
                   SUM(CASE WHEN afp.status = 'Paid' THEN 1 ELSE 0 END) as collected_students,
                   SUM(CASE WHEN afp.status = 'Pending' THEN 1 ELSE 0 END) as pending_students,
                   SUM(CASE WHEN afp.status = 'Paid' THEN afp.amount ELSE 0 END) as collected_amount,
                   SUM(CASE WHEN afp.status = 'Pending' THEN afp.amount ELSE 0 END) as pending_amount
            FROM additional_fee_types aft
            LEFT JOIN additional_fee_payments afp ON afp.fee_type_id = aft.id
            WHERE aft.school_id = :sid
            GROUP BY aft.name, aft.due_date, aft.academic_year_id
            ORDER BY id DESC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch unique classes for each fee type definition (by name, due_date)
        $stmtClassNames = $pdo->prepare("
            SELECT DISTINCT c.name 
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN classes c ON c.id = s.class_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            WHERE aft.name = :name AND aft.due_date = :due_date AND aft.academic_year_id = :ayid
        ");

        return array_map(function($t) use ($stmtClassNames, $totalClassesCount) {
            $t['id'] = (int)$t['id'];
            $t['amount'] = (float)$t['amount'];
            $t['academic_year_id'] = (int)$t['academic_year_id'];
            $t['total_students'] = (int)$t['total_students'];
            $t['collected_students'] = (int)$t['collected_students'];
            $t['pending_students'] = (int)$t['pending_students'];
            
            $t['collected_amount'] = (float)($t['collected_amount'] ?? 0);
            $t['pending_amount'] = (float)($t['pending_amount'] ?? 0);
            $t['total_amount'] = $t['collected_amount'] + $t['pending_amount'];

            // Fetch classes this type was assigned to
            $stmtClassNames->execute([
                ':name' => $t['name'],
                ':due_date' => $t['due_date'],
                ':ayid' => $t['academic_year_id']
            ]);
            $classNames = $stmtClassNames->fetchAll(PDO::FETCH_COLUMN);

            // Determine if assigned to Entire School or class names
            if (empty($classNames)) {
                $t['assigned_to'] = '—';
            } elseif (count($classNames) >= $totalClassesCount || count($classNames) > 5) {
                $t['assigned_to'] = 'For All';
            } else {
                $t['assigned_to'] = implode(', ', $classNames);
            }

            return $t;
        }, $types);
    }

    public function createAdditionalFeeType(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        if (empty($data['name']) || strlen(trim($data['name'])) < 3) {
            throw new ValidationException(['name' => 'Fee description must be at least 3 characters.']);
        }
        $name = trim($data['name']);

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['academic_year' => 'No academic year found. Please create an Academic Year first.']);
        }
        $academicYearId = (int)$workingYear['id'];

        // Validate dates
        if (empty($data['due_date'])) {
            throw new ValidationException(['due_date' => 'Due Date is required.']);
        }
        $dueDate = trim($data['due_date']);

        $applyType = $data['apply_type'] ?? 'school'; // 'school' or 'classes'
        $studentsToApply = []; // Array of ['student_id' => int, 'class_id' => int, 'amount' => float]

        if ($applyType === 'school') {
            if (empty($data['amount']) || (float)$data['amount'] <= 0) {
                throw new ValidationException(['amount' => 'Amount must be greater than 0.']);
            }
            $amount = (float)$data['amount'];

            // Query active students in current academic year
            $stmtStudents = $pdo->prepare("
                SELECT id, class_id FROM students 
                WHERE school_id = :sid AND status = 'ACTIVE' AND academic_year_id = :ayid
            ");
            $stmtStudents->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
            $studentRows = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

            foreach ($studentRows as $s) {
                $studentsToApply[] = [
                    'student_id' => (int)$s['id'],
                    'class_id' => (int)$s['class_id'],
                    'amount' => $amount
                ];
            }
        } else {
            // Selected classes with custom amounts
            if (empty($data['class_amounts']) || !is_array($data['class_amounts'])) {
                throw new ValidationException(['classes' => 'At least one class is required when "Selected Classes" is chosen.']);
            }

            foreach ($data['class_amounts'] as $classId => $amt) {
                if ((float)$amt <= 0) {
                    throw new ValidationException(['amount' => 'Amount for selected classes must be greater than 0.']);
                }

                // Fetch active students in this class
                $stmtStudents = $pdo->prepare("
                    SELECT id, class_id FROM students 
                    WHERE school_id = :sid AND class_id = :cid AND status = 'ACTIVE' AND academic_year_id = :ayid
                ");
                $stmtStudents->execute([
                    ':sid' => $schoolId,
                    ':cid' => (int)$classId,
                    ':ayid' => $academicYearId
                ]);
                $studentRows = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

                foreach ($studentRows as $s) {
                    $studentsToApply[] = [
                        'student_id' => (int)$s['id'],
                        'class_id' => (int)$s['class_id'],
                        'amount' => (float)$amt
                    ];
                }
            }
        }

        if (empty($studentsToApply)) {
            throw new ValidationException(['students' => 'No active students found in the target group.']);
        }

        // Duplicate Check Rule: if a fee has already been applied previously, do NOT create duplicate entries
        // Check if there are already records in additional_fee_payments with same fee name for the same student in current academic year
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id 
              AND aft.name = :name 
              AND aft.academic_year_id = :ayid
        ");

        foreach ($studentsToApply as $s) {
            $stmtDup->execute([
                ':student_id' => $s['student_id'],
                ':name' => $name,
                ':ayid' => $academicYearId
            ]);
            if ((int)$stmtDup->fetchColumn() > 0) {
                throw new ValidationException(['duplicate' => 'This additional fee has already been applied to the selected students.']);
            }
        }

        // Commit transaction
        $pdo->beginTransaction();
        try {
            $classFeeTypeIds = []; // class_id => fee_type_id
            
            if ($applyType === 'school') {
                // Scenario 1: Entire School. Create ONE master Additional Fee Record
                $stmtType = $pdo->prepare("
                    INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, due_date)
                    VALUES (:sid, :name, :amount, :ayid, :due_date)
                ");
                $stmtType->execute([
                    ':sid' => $schoolId,
                    ':name' => $name,
                    ':amount' => $amount,
                    ':ayid' => $academicYearId,
                    ':due_date' => $dueDate
                ]);
                $masterTypeId = (int)$pdo->lastInsertId();
                
                // Map all student classes to this single master fee type ID
                foreach ($studentsToApply as $s) {
                    $classFeeTypeIds[$s['class_id']] = $masterTypeId;
                }
            } else {
                // Scenario 2: Selected Classes. Create one fee record per class (class-wise amount split)
                $stmtType = $pdo->prepare("
                    INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, due_date)
                    VALUES (:sid, :name, :amount, :ayid, :due_date)
                ");
                
                foreach ($data['class_amounts'] as $classId => $amt) {
                    $stmtType->execute([
                        ':sid' => $schoolId,
                        ':name' => $name,
                        ':amount' => (float)$amt,
                        ':ayid' => $academicYearId,
                        ':due_date' => $dueDate
                    ]);
                    $classFeeTypeIds[$classId] = (int)$pdo->lastInsertId();
                }
            }

            // Insert Payments
            $stmtInsertPay = $pdo->prepare("
                INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status)
                VALUES (:sid, :student_id, :type_id, :amount, 'Pending')
            ");

            foreach ($studentsToApply as $s) {
                $stmtInsertPay->execute([
                    ':sid' => $schoolId,
                    ':student_id' => $s['student_id'],
                    ':type_id' => $classFeeTypeIds[$s['class_id']],
                    ':amount' => $s['amount']
                ]);
            }

            $pdo->commit();

            return [
                'name' => $name,
                'academic_year_id' => $academicYearId,
                'assigned_count' => count($studentsToApply)
            ];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getAdditionalFeePayments(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $stmt = $pdo->prepare("
            SELECT afp.*, s.name as student_name, c.name as class_name, 
                   aft.name as fee_name, aft.due_date, ay.name as academic_year_name
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN classes c ON c.id = s.class_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            LEFT JOIN academic_years ay ON ay.id = aft.academic_year_id
            WHERE afp.school_id = :sid
            ORDER BY afp.id DESC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($p) {
            $p['id'] = (int)$p['id'];
            $p['student_id'] = (int)$p['student_id'];
            $p['fee_type_id'] = (int)$p['fee_type_id'];
            $p['amount'] = (float)$p['amount'];
            return $p;
        }, $payments);
    }

    public function collectAdditionalFeePayment(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id FROM additional_fee_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() === false) {
            throw new NotFoundException('Fee record not found.');
        }

        $stmtGetInfo = $pdo->prepare("
            SELECT s.academic_year_id AS student_ay_id, s.status AS student_status, aft.academic_year_id AS fee_ay_id, aft.due_date
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            WHERE afp.id = :id AND afp.school_id = :sid
            LIMIT 1
        ");
        $stmtGetInfo->execute([':id' => $id, ':sid' => $schoolId]);
        $info = $stmtGetInfo->fetch(PDO::FETCH_ASSOC);
        if ($info) {
            $studentAyId = $info['student_ay_id'] !== null ? (int)$info['student_ay_id'] : 0;
            $feeAyId = $info['fee_ay_id'] !== null ? (int)$info['fee_ay_id'] : 0;
            if ($info['student_status'] === 'ACTIVE' && $studentAyId > $feeAyId) {
                throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
            }
            if ($info['due_date'] !== null) {
                $today = date('Y-m-d');
                if ($info['due_date'] > $today) {
                    throw new ValidationException(['fields' => "This additional fee is not yet active (Due date: " . $info['due_date'] . ")."]);
                }
            }
        }

        $paymentDate = date('Y-m-d');
        $stmtUpdate = $pdo->prepare("
            UPDATE additional_fee_payments 
            SET status = 'Paid', payment_date = :pdate 
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUpdate->execute([
            ':id' => $id,
            ':sid' => $schoolId,
            ':pdate' => $paymentDate
        ]);

        // Fetch updated payment detail
        $stmtGet = $pdo->prepare("
            SELECT afp.*, s.name as student_name, c.name as class_name, aft.name as fee_name
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN classes c ON c.id = s.class_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            WHERE afp.id = :id AND afp.school_id = :sid
            LIMIT 1
        ");
        $stmtGet->execute([':id' => $id, ':sid' => $schoolId]);
        $pay = $stmtGet->fetch(PDO::FETCH_ASSOC);

        if ($pay) {
            $pay['id'] = (int)$pay['id'];
            $pay['student_id'] = (int)$pay['student_id'];
            $pay['fee_type_id'] = (int)$pay['fee_type_id'];
            $pay['amount'] = (float)$pay['amount'];
        }

        return $pay ?: [];
    }

    public function revertAdditionalFeePayment(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id FROM additional_fee_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() === false) {
            throw new NotFoundException('Fee record not found.');
        }

        $stmtGetInfo = $pdo->prepare("
            SELECT s.academic_year_id AS student_ay_id, s.status AS student_status, aft.academic_year_id AS fee_ay_id
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            WHERE afp.id = :id AND afp.school_id = :sid
            LIMIT 1
        ");
        $stmtGetInfo->execute([':id' => $id, ':sid' => $schoolId]);
        $info = $stmtGetInfo->fetch(PDO::FETCH_ASSOC);
        if ($info) {
            $studentAyId = $info['student_ay_id'] !== null ? (int)$info['student_ay_id'] : 0;
            $feeAyId = $info['fee_ay_id'] !== null ? (int)$info['fee_ay_id'] : 0;
            if ($info['student_status'] === 'ACTIVE' && $studentAyId > $feeAyId) {
                throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
            }
        }

        $stmtUpdate = $pdo->prepare("
            UPDATE additional_fee_payments 
            SET status = 'Pending', payment_date = NULL 
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUpdate->execute([
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        return ['success' => true];
    }

    public function updateAdditionalFeeType(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // Fetch the reference fee type
        $stmtRef = $pdo->prepare("SELECT * FROM additional_fee_types WHERE id = :id AND school_id = :sid");
        $stmtRef->execute([':id' => $id, ':sid' => $schoolId]);
        $ref = $stmtRef->fetch(PDO::FETCH_ASSOC);
        if (!$ref) {
            throw new ValidationException(['id' => 'Additional fee type not found.']);
        }

        if (isset($ref['category']) && $ref['category'] === 'System Generated') {
            throw new ValidationException(['fields' => 'System generated additional fees cannot be edited or deleted.']);
        }

        // Find all matching fee types with same name, due_date, and academic_year_id
        $stmtMatches = $pdo->prepare("
            SELECT id FROM additional_fee_types 
            WHERE school_id = :sid AND name = :name AND due_date = :due_date AND academic_year_id = :ayid
        ");
        $stmtMatches->execute([
            ':sid' => $schoolId,
            ':name' => $ref['name'],
            ':due_date' => $ref['due_date'],
            ':ayid' => $ref['academic_year_id']
        ]);
        $typeIds = $stmtMatches->fetchAll(PDO::FETCH_COLUMN);

        if (empty($typeIds)) {
            throw new ValidationException(['id' => 'Additional fee type not found.']);
        }

        if (empty($data['name']) || strlen(trim($data['name'])) < 3) {
            throw new ValidationException(['name' => 'Fee description must be at least 3 characters.']);
        }
        $name = trim($data['name']);

        if (empty($data['due_date'])) {
            throw new ValidationException(['due_date' => 'Due Date is required.']);
        }
        $dueDate = trim($data['due_date']);

        $pdo->beginTransaction();
        try {
            $inParams = implode(',', array_fill(0, count($typeIds), '?'));

            // If a new amount is specified
            if (isset($data['amount'])) {
                $amount = (float)$data['amount'];
                if ($amount <= 0) {
                    throw new ValidationException(['amount' => 'Amount must be greater than 0.']);
                }

                // Check if any payment is already collected for amount modification
                $stmtCheck = $pdo->prepare("
                    SELECT COUNT(*) FROM additional_fee_payments 
                    WHERE fee_type_id IN ($inParams) AND status = 'Paid'
                ");
                $stmtCheck->execute($typeIds);
                if ((int)$stmtCheck->fetchColumn() > 0) {
                    throw new ValidationException(['amount' => 'Cannot modify the fee amount because some payments have already been collected.']);
                }

                // Update type amounts using positional parameters
                $stmtUpTypeAmt = $pdo->prepare("
                    UPDATE additional_fee_types SET amount = ? 
                    WHERE id IN ($inParams)
                ");
                $stmtUpTypeAmt->execute(array_merge([$amount], $typeIds));

                // Update pending payment amounts using positional parameters
                $stmtUpPayAmt = $pdo->prepare("
                    UPDATE additional_fee_payments SET amount = ? 
                    WHERE fee_type_id IN ($inParams) AND status = 'Pending'
                ");
                $stmtUpPayAmt->execute(array_merge([$amount], $typeIds));
            }

            // Update names and due dates for types using positional parameters
            $stmtUpTypes = $pdo->prepare("
                UPDATE additional_fee_types SET name = ?, due_date = ? 
                WHERE id IN ($inParams)
            ");
            $stmtUpTypes->execute(array_merge([
                $name,
                $dueDate
            ], $typeIds));

            $pdo->commit();
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function deleteAdditionalFeeType(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // Fetch the reference fee type
        $stmtRef = $pdo->prepare("SELECT * FROM additional_fee_types WHERE id = :id AND school_id = :sid");
        $stmtRef->execute([':id' => $id, ':sid' => $schoolId]);
        $ref = $stmtRef->fetch(PDO::FETCH_ASSOC);
        if (!$ref) {
            throw new ValidationException(['id' => 'Additional fee type not found.']);
        }

        if (isset($ref['category']) && $ref['category'] === 'System Generated') {
            throw new ValidationException(['fields' => 'System generated additional fees cannot be edited or deleted.']);
        }

        // Find all matching fee types with same name, due_date, and academic_year_id
        $stmtMatches = $pdo->prepare("
            SELECT id FROM additional_fee_types 
            WHERE school_id = :sid AND name = :name AND due_date = :due_date AND academic_year_id = :ayid
        ");
        $stmtMatches->execute([
            ':sid' => $schoolId,
            ':name' => $ref['name'],
            ':due_date' => $ref['due_date'],
            ':ayid' => $ref['academic_year_id']
        ]);
        $typeIds = $stmtMatches->fetchAll(PDO::FETCH_COLUMN);

        if (empty($typeIds)) {
            return ['success' => true];
        }

        // Check if any payment is already collected
        $inParams = implode(',', array_fill(0, count($typeIds), '?'));
        $stmtCheck = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments 
            WHERE fee_type_id IN ($inParams) AND status = 'Paid'
        ");
        $stmtCheck->execute($typeIds);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['payments' => 'Cannot delete this additional fee because some students have already paid.']);
        }

        // Delete payments and types
        $pdo->beginTransaction();
        try {
            $stmtDelPayments = $pdo->prepare("DELETE FROM additional_fee_payments WHERE fee_type_id IN ($inParams)");
            $stmtDelPayments->execute($typeIds);

            $stmtDelTypes = $pdo->prepare("DELETE FROM additional_fee_types WHERE id IN ($inParams)");
            $stmtDelTypes->execute($typeIds);

            $pdo->commit();
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}

