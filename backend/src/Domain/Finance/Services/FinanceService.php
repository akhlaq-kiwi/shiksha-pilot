<?php

namespace App\Domain\Finance\Services;

use App\Shared\BaseService;
use PDO;
use Exception;

class FinanceService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    // --- Class Fees Configuration ---

    public function getClassFees(int $schoolId, int $classId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                "April" => 1500, "May" => 1500, "June" => 1500, "July" => 1500, "August" => 1500,
                "September" => 1500, "October" => 1500, "November" => 1500, "December" => 1500,
                "January" => 1500, "February" => 1500, "March" => 1500,
                "is_locked" => 0,
                "is_configured" => true
            ];
        }

        $stmt = $pdo->prepare("SELECT fee_structure, is_locked FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $stmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ]);
        $res = $stmt->fetch();

        if ($res) {
            $feeData = json_decode($res['fee_structure'], true) ?: [];
            $feeData['is_locked'] = (int)$res['is_locked'];
            $feeData['is_configured'] = true;
            return $feeData;
        } else {
            return [
                "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0,
                "September" => 0, "October" => 0, "November" => 0, "December" => 0,
                "January" => 0, "February" => 0, "March" => 0,
                "is_locked" => 0,
                "is_configured" => false
            ];
        }
    }

    public function saveClassFees(int $schoolId, array $data, string $performedBy): bool
    {
        $classId = (int)($data['class_id'] ?? 0);
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $feeStructure = $data['fee_structure'] ?? null;
        $isLocked = (int)($data['is_locked'] ?? 0);

        if (!$classId || !$ayId || !$feeStructure) {
            throw new Exception('Missing required fields');
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        // Lock check validation
        $checkStmt = $pdo->prepare("SELECT is_locked FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $checkStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ]);
        $existing = $checkStmt->fetch();
        if ($existing && $existing['is_locked']) {
            throw new Exception('This fee structure is locked and cannot be modified.', 403);
        }

        $feeStructureJson = is_array($feeStructure) ? json_encode($feeStructure) : $feeStructure;

        $stmt = $pdo->prepare("INSERT INTO class_fees (school_id, academic_year_id, class_id, fee_structure, is_locked) 
            VALUES (:school_id, :ay_id, :class_id, :fee_structure, :is_locked) 
            ON DUPLICATE KEY UPDATE fee_structure = :fee_structure, is_locked = :is_locked");
        $stmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId,
            'fee_structure' => $feeStructureJson,
            'is_locked' => $isLocked
        ]);

        // UPDATE all Pending fee_records for the students in this class for this academic year
        $feeStructureArray = is_array($feeStructure) ? $feeStructure : json_decode($feeStructure, true);
        if ($feeStructureArray) {
            $updateStmt = $pdo->prepare("UPDATE fee_records f
                JOIN students s ON f.student_id = s.id
                SET f.amount = :amount
                WHERE f.school_id = :school_id
                  AND f.academic_year_id = :ay_id
                  AND s.class_id = :class_id
                  AND f.month = :month
                  AND f.status = 'Pending'");

            $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
            foreach ($months as $m) {
                if (isset($feeStructureArray[$m])) {
                    $updateStmt->execute([
                        'amount' => (float)$feeStructureArray[$m],
                        'school_id' => $schoolId,
                        'ay_id' => $ayId,
                        'class_id' => $classId,
                        'month' => $m
                    ]);
                }
            }
        }

        $this->logAudit($pdo, $schoolId, $performedBy, 'Configure Fees', "Updated monthly fee structure for Class ID $classId (Locked: $isLocked).");
        return true;
    }

    // --- Salaries ---

    public function getMonthlySalaries(int $schoolId, string $month, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                [
                    'teacher_id' => 1,
                    'name' => 'Demo Teacher',
                    'gender' => 'Female',
                    'phone' => '9876543211',
                    'profile_image' => null,
                    'amount' => 50000.0,
                    'status' => 'Pending'
                ]
            ];
        }

        // Get all active teachers
        $tStmt = $pdo->prepare("SELECT id, name, gender, phone, salary_amount, profile_image FROM teachers WHERE school_id = :sid AND status = 'Active'");
        $tStmt->execute(['sid' => $schoolId]);
        $teachers = $tStmt->fetchAll();

        // For each teacher, ensure a salary record exists for this month/year
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM salary_records WHERE school_id = :sid AND teacher_id = :tid AND academic_year_id = :ayid AND month = :month");
        $insStmt = $pdo->prepare("INSERT INTO salary_records (school_id, teacher_id, academic_year_id, month, amount, status) VALUES (:sid, :tid, :ayid, :month, :amount, 'Pending')");

        foreach ($teachers as $t) {
            $checkStmt->execute([
                'sid' => $schoolId,
                'tid' => $t['id'],
                'ayid' => $ayId,
                'month' => $month
            ]);
            if ($checkStmt->fetchColumn() == 0) {
                $insStmt->execute([
                    'sid' => $schoolId,
                    'tid' => $t['id'],
                    'ayid' => $ayId,
                    'month' => $month,
                    'amount' => $t['salary_amount']
                ]);
            }
        }

        $stmt = $pdo->prepare("
            SELECT 
                t.id as teacher_id,
                t.name,
                t.gender,
                t.phone,
                t.profile_image,
                sr.amount,
                sr.status
            FROM salary_records sr
            JOIN teachers t ON sr.teacher_id = t.id
            WHERE sr.school_id = :sid
              AND sr.academic_year_id = :ayid
              AND sr.month = :month
              AND t.status = 'Active'
        ");
        $stmt->execute([
            'sid' => $schoolId,
            'ayid' => $ayId,
            'month' => $month
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getTeacherSalaryLedger(int $schoolId, int $teacherId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT * FROM salary_records WHERE teacher_id = :teacher_id AND academic_year_id = :ay_id AND school_id = :school_id");
        $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ayId, 'school_id' => $schoolId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($records)) {
            // Populate records automatically
            $tStmt = $pdo->prepare("SELECT salary_amount FROM teachers WHERE id = :id AND school_id = :school_id");
            $tStmt->execute(['id' => $teacherId, 'school_id' => $schoolId]);
            $salary = (float)$tStmt->fetchColumn() ?: 3000.0;

            $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
            $ins = $pdo->prepare("INSERT INTO salary_records (school_id, teacher_id, academic_year_id, month, amount, status) VALUES (:school_id, :teacher_id, :ay_id, :month, :amount, 'Pending')");
            foreach ($months as $m) {
                $ins->execute([
                    'school_id' => $schoolId,
                    'teacher_id' => $teacherId,
                    'ay_id' => $ayId,
                    'month' => $m,
                    'amount' => $salary
                ]);
            }

            $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ayId, 'school_id' => $schoolId]);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return $records;
    }

    public function payTeacherSalary(int $schoolId, int $teacherId, string $month, int $ayId, string $performedBy): bool
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $checkStmt = $pdo->prepare("SELECT status, paid_at FROM salary_records WHERE teacher_id = :teacher_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $checkStmt->execute([
            'teacher_id' => $teacherId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);
        $existing = $checkStmt->fetch();
        if ($existing && $existing['status'] === 'Paid' && \isTransactionLocked($pdo, $schoolId, $existing['paid_at'])) {
            throw new Exception('This salary payment is part of a finalized Financial Report and cannot be modified.', 400);
        }

        $stmt = $pdo->prepare("UPDATE salary_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE teacher_id = :teacher_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $stmt->execute([
            'pay_date' => date('Y-m-d'),
            'paid_at' => date('Y-m-d H:i:s'),
            'teacher_id' => $teacherId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Pay Salary', "Disbursed $month salary for teacher ID $teacherId.");
        return true;
    }

    // --- Student Fees ---

    public function getStudentFeesLedger(int $schoolId, int $studentId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
        $studStmt->execute(['id' => $studentId, 'school_id' => $schoolId]);
        $student = $studStmt->fetch();
        $classId = $student ? $student['class_id'] : 0;

        $isConfigured = false;
        if ($classId) {
            $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
            $cfStmt->execute([
                'school_id' => $schoolId,
                'ay_id' => $ayId,
                'class_id' => $classId
            ]);
            $isConfigured = ($cfStmt->fetchColumn() > 0);
        }

        $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
        $stmt->execute(['student_id' => $studentId, 'ay_id' => $ayId, 'school_id' => $schoolId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($records)) {
            $ayStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE id = :id");
            $ayStmt->execute(['id' => $ayId]);
            $ayInfo = $ayStmt->fetch();
            $startYear = (int)date('Y');
            if ($ayInfo) {
                $rangeParts = explode('-', $ayInfo['year_range']);
                $startYear = (int)$rangeParts[0] ?: $startYear;
            }

            $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
            $cfStmt->execute([
                'school_id' => $schoolId,
                'ay_id' => $ayId,
                'class_id' => $classId
            ]);
            $cfRes = $cfStmt->fetch();
            $feeStructure = [];
            if ($cfRes) {
                $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
            }

            $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
            $records = [];
            foreach ($months as $idx => $m) {
                $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
                $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
                $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
                $amount = isset($feeStructure[$m]) ? (float)$feeStructure[$m] : 0.00;
                $records[] = [
                    'id' => null,
                    'school_id' => $schoolId,
                    'student_id' => $studentId,
                    'academic_year_id' => $ayId,
                    'month' => $m,
                    'amount' => $amount,
                    'status' => 'Pending',
                    'due_date' => $dueDate,
                    'payment_date' => null,
                    'paid_at' => null
                ];
            }
        }

        if (!$isConfigured) {
            foreach ($records as &$rec) {
                if ($rec['status'] === 'Pending') {
                    $rec['amount'] = 0.00;
                }
            }
        }

        return $records;
    }

    public function payTuitionFee(int $schoolId, int $studentId, string $month, int $ayId, string $performedBy): bool
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
        $studStmt->execute(['id' => $studentId, 'school_id' => $schoolId]);
        $student = $studStmt->fetch();
        if (!$student) {
            throw new Exception('Student not found.', 404);
        }
        $classId = $student['class_id'];

        $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ]);
        if ((int)$cfStmt->fetchColumn() === 0) {
            throw new Exception('Class fee structure not configured.', 400);
        }

        $checkStmt = $pdo->prepare("SELECT status, paid_at FROM fee_records WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $checkStmt->execute([
            'student_id' => $studentId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);
        $existing = $checkStmt->fetch();
        if ($existing && $existing['status'] === 'Paid' && \isTransactionLocked($pdo, $schoolId, $existing['paid_at'])) {
            throw new Exception('This fee payment is part of a finalized Financial Report and cannot be modified.', 400);
        }

        // Validate chronological order of payments
        $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $targetIdx = array_search($month, $monthsOrder);
        if ($targetIdx !== false && $targetIdx > 0) {
            $priorMonths = array_slice($monthsOrder, 0, $targetIdx);
            $placeholders = implode(',', array_fill(0, count($priorMonths), '?'));

            $checkPriorStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records 
                                        WHERE student_id = ? 
                                          AND academic_year_id = ? 
                                          AND school_id = ? 
                                          AND month IN ($placeholders) 
                                          AND status != 'Paid'");

            $queryParams = array_merge([$studentId, $ayId, $schoolId], $priorMonths);
            $checkPriorStmt->execute($queryParams);

            if ((int)$checkPriorStmt->fetchColumn() > 0) {
                throw new Exception('Please clear previous pending dues first.', 400);
            }
        }

        $stmt = $pdo->prepare("UPDATE fee_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $stmt->execute([
            'pay_date' => date('Y-m-d'),
            'paid_at' => date('Y-m-d H:i:s'),
            'student_id' => $studentId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Collect Fee', "Received tuition fee for $month from student ID $studentId.");
        return true;
    }

    public function payMultipleFees(int $schoolId, int $studentId, array $months, int $ayId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
        $studStmt->execute(['id' => $studentId, 'school_id' => $schoolId]);
        $student = $studStmt->fetch();
        if (!$student) {
            throw new Exception('Student not found.', 404);
        }
        $classId = $student['class_id'];

        $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ]);
        if ((int)$cfStmt->fetchColumn() === 0) {
            throw new Exception('Class fee structure not configured.', 400);
        }

        // Seeding if needed
        $checkDbStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id");
        $checkDbStmt->execute([
            'student_id' => $studentId,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);
        if ((int)$checkDbStmt->fetchColumn() === 0) {
            $this->getStudentFeesLedger($schoolId, $studentId, $ayId);
        }

        $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
        $stmt->execute(['student_id' => $studentId, 'ay_id' => $ayId, 'school_id' => $schoolId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        usort($months, function($a, $b) use ($monthsOrder) {
            return array_search($a, $monthsOrder) - array_search($b, $monthsOrder);
        });

        foreach ($months as $m) {
            if (!in_array($m, $monthsOrder)) {
                throw new Exception("Invalid month: $m", 400);
            }
        }

        $selectedIndices = [];
        foreach ($months as $m) {
            $selectedIndices[] = array_search($m, $monthsOrder);
        }
        for ($i = 1; $i < count($selectedIndices); $i++) {
            if ($selectedIndices[$i] !== $selectedIndices[$i - 1] + 1) {
                throw new Exception('Fee payments must be for consecutive months.', 400);
            }
        }

        $firstUnpaidMonth = null;
        foreach ($monthsOrder as $m) {
            $rec = null;
            foreach ($records as $r) {
                if ($r['month'] === $m) {
                    $rec = $r;
                    break;
                }
            }
            if ($rec && $rec['status'] !== 'Paid') {
                $firstUnpaidMonth = $m;
                break;
            }
        }

        if ($firstUnpaidMonth === null) {
            throw new Exception('All months are already paid.', 400);
        }

        if ($months[0] !== $firstUnpaidMonth) {
            throw new Exception("Fee payment must remain sequential. You must start from the earliest unpaid month ($firstUnpaidMonth).", 400);
        }

        foreach ($months as $m) {
            foreach ($records as $r) {
                if ($r['month'] === $m) {
                    if ($r['status'] === 'Paid') {
                        throw new Exception("Month $m is already paid.", 400);
                    }
                    if (\isTransactionLocked($pdo, $schoolId, $r['paid_at'])) {
                        throw new Exception("Month $m is locked in a finalized report.", 400);
                    }
                }
            }
        }

        $pdo->beginTransaction();
        try {
            $payDate = date('Y-m-d');
            $paidAt = date('Y-m-d H:i:s');

            $updateStmt = $pdo->prepare("UPDATE fee_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");

            foreach ($months as $m) {
                $updateStmt->execute([
                    'pay_date' => $payDate,
                    'paid_at' => $paidAt,
                    'student_id' => $studentId,
                    'month' => $m,
                    'ay_id' => $ayId,
                    'school_id' => $schoolId
                ]);
            }

            $pdo->commit();

            $monthsStr = implode(', ', $months);
            $this->logAudit($pdo, $schoolId, $performedBy, 'Collect Fee', "Received tuition fee for $monthsStr from student ID $studentId in a single transaction.");

            $placeholders = implode(',', array_fill(0, count($months), '?'));
            $queryParams = array_merge([$studentId, $ayId, $schoolId], $months);
            $fetchStmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = ? AND academic_year_id = ? AND school_id = ? AND month IN ($placeholders)");
            $fetchStmt->execute($queryParams);
            return $fetchStmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function revertTuitionFee(int $schoolId, int $studentId, string $month, int $ayId, string $performedBy): bool
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $checkStmt = $pdo->prepare("SELECT paid_at FROM fee_records WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $checkStmt->execute([
            'student_id' => $studentId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);
        $paidAt = $checkStmt->fetchColumn();
        if ($paidAt && \isTransactionLocked($pdo, $schoolId, $paidAt)) {
            throw new Exception('This fee payment is part of a finalized Financial Report and cannot be reverted.', 400);
        }

        // Validate chronological order of reversion
        $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $targetIdx = array_search($month, $monthsOrder);
        if ($targetIdx !== false && $targetIdx < count($monthsOrder) - 1) {
            $subsequentMonths = array_slice($monthsOrder, $targetIdx + 1);
            $placeholders = implode(',', array_fill(0, count($subsequentMonths), '?'));

            $checkSubsequentStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records 
                                        WHERE student_id = ? 
                                          AND academic_year_id = ? 
                                          AND school_id = ? 
                                          AND month IN ($placeholders) 
                                          AND status = 'Paid'");

            $queryParams = array_merge([$studentId, $ayId, $schoolId], $subsequentMonths);
            $checkSubsequentStmt->execute($queryParams);

            if ((int)$checkSubsequentStmt->fetchColumn() > 0) {
                throw new Exception('Cannot mark this month as unpaid because subsequent months have already been paid.', 400);
            }
        }

        $stmt = $pdo->prepare("UPDATE fee_records SET status = 'Pending', payment_date = NULL, paid_at = NULL WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        $stmt->execute([
            'student_id' => $studentId,
            'month' => $month,
            'ay_id' => $ayId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Revert Fee', "Reverted tuition fee status for $month to Unpaid for student ID $studentId.");
        return true;
    }

    // --- Carry Forward Dues ---

    public function getStudentCarryForwardDues(int $schoolId, int $studentId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT cfd.*, ay.year_range 
                               FROM carry_forward_dues cfd
                               JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                               WHERE cfd.student_id = :student_id AND cfd.school_id = :school_id
                               ORDER BY ay.year_range ASC");
        $stmt->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($records as &$r) {
            $r['id'] = (int)$r['id'];
            $r['student_id'] = (int)$r['student_id'];
            $r['amount'] = (float)$r['amount'];
            $r['paid_amount'] = (float)$r['paid_amount'];

            $r['is_locked'] = false;
            $recStmt = $pdo->prepare("SELECT paid_at FROM previous_year_recoveries WHERE carry_forward_due_id = :cfd_id");
            $recStmt->execute(['cfd_id' => $r['id']]);
            $recoveries = $recStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($recoveries as $rec) {
                if (\isTransactionLocked($pdo, $schoolId, $rec['paid_at'])) {
                    $r['is_locked'] = true;
                    break;
                }
            }
        }
        unset($r);

        return $records;
    }

    public function payCarryForwardDue(int $schoolId, int $studentId, int $dueId, float $amount, string $date, string $performedBy): bool
    {
        if ($amount <= 0.00) {
            throw new Exception('Payment amount must be greater than zero.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $stmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE id = :id AND student_id = :student_id AND school_id = :school_id");
        $stmt->execute(['id' => $dueId, 'student_id' => $studentId, 'school_id' => $schoolId]);
        $cfd = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$cfd) {
            throw new Exception('Carry forward due record not found.', 404);
        }

        $pending = (float)$cfd['amount'] - (float)$cfd['paid_amount'];
        if ($amount > $pending + 0.01) {
            throw new Exception('Payment amount exceeds the outstanding due amount.', 400);
        }

        $pdo->beginTransaction();
        try {
            $newPaidAmount = (float)$cfd['paid_amount'] + $amount;
            $status = ($newPaidAmount >= (float)$cfd['amount']) ? 'Paid' : 'Pending';

            $up = $pdo->prepare("UPDATE carry_forward_dues SET paid_amount = :paid_amount, status = :status WHERE id = :id");
            $up->execute([
                'paid_amount' => $newPaidAmount,
                'status' => $status,
                'id' => $dueId
            ]);

            // Fetch active academic year
            $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
            $ayStmt->execute(['school_id' => $schoolId]);
            $active_ay_id = $ayStmt->fetchColumn() ?: null;

            $ins = $pdo->prepare("INSERT INTO previous_year_recoveries (school_id, student_id, academic_year_id, carry_forward_due_id, amount_recovered, recovery_date, paid_at, collected_by) VALUES (:school_id, :student_id, :academic_year_id, :carry_forward_due_id, :amount_recovered, :recovery_date, :paid_at, :collected_by)");
            $ins->execute([
                'school_id' => $schoolId,
                'student_id' => $studentId,
                'academic_year_id' => $active_ay_id,
                'carry_forward_due_id' => $dueId,
                'amount_recovered' => $amount,
                'recovery_date' => $date,
                'paid_at' => date('Y-m-d H:i:s'),
                'collected_by' => $performedBy
            ]);

            $pdo->commit();

            $this->logAudit($pdo, $schoolId, $performedBy, 'Recover Past Due', "Recovered past year due payment of ₹" . number_format($amount) . " for student ID $studentId.");
            return true;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function revertCarryForwardDueRecovery(int $schoolId, int $studentId, int $recoveryId, string $performedBy): bool
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $stmt = $pdo->prepare("SELECT * FROM previous_year_recoveries WHERE id = :id AND student_id = :student_id AND school_id = :school_id");
        $stmt->execute(['id' => $recoveryId, 'student_id' => $studentId, 'school_id' => $schoolId]);
        $recovery = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$recovery) {
            throw new Exception('Recovery record not found.', 404);
        }

        if (\isTransactionLocked($pdo, $schoolId, $recovery['paid_at'])) {
            throw new Exception('This recovery is part of a finalized Financial Report and cannot be reverted.', 400);
        }

        $pdo->beginTransaction();
        try {
            $cfdStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE id = :id");
            $cfdStmt->execute(['id' => $recovery['carry_forward_due_id']]);
            $cfd = $cfdStmt->fetch(PDO::FETCH_ASSOC);

            if ($cfd) {
                $newPaidAmount = max(0.00, (float)$cfd['paid_amount'] - (float)$recovery['amount_recovered']);
                $status = ($newPaidAmount >= (float)$cfd['amount']) ? 'Paid' : 'Pending';

                $up = $pdo->prepare("UPDATE carry_forward_dues SET paid_amount = :paid_amount, status = :status WHERE id = :id");
                $up->execute([
                    'paid_amount' => $newPaidAmount,
                    'status' => $status,
                    'id' => $recovery['carry_forward_due_id']
                ]);
            }

            $del = $pdo->prepare("DELETE FROM previous_year_recoveries WHERE id = :id");
            $del->execute(['id' => $recoveryId]);

            $pdo->commit();

            $this->logAudit($pdo, $schoolId, $performedBy, 'Revert Recovery', "Reverted past year due recovery (₹" . number_format($recovery['amount_recovered']) . ") for student ID $studentId.");
            return true;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function getFinancePreviousDues(int $schoolId, int $activeYearId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        if ($activeYearId > 0) {
            $stmt = $pdo->prepare("SELECT cfd.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status, c_curr.name AS current_class_name
                                   FROM carry_forward_dues cfd
                                   JOIN students s ON cfd.student_id = s.id
                                   JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                                   LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                             AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                             AND s_orig.name = s.name 
                                                             AND s_orig.roll_number = s.roll_number
                                   LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                                   LEFT JOIN classrooms c_curr ON c_curr.id = s.class_id
                                   WHERE cfd.school_id = :school_id 
                                     AND cfd.original_academic_year_id < :active_year_id
                                     AND NOT EXISTS (
                                         SELECT 1 FROM students s2 
                                         WHERE s2.school_id = s.school_id 
                                           AND s2.name = s.name 
                                           AND s2.roll_number = s.roll_number 
                                           AND s2.academic_year_id > s.academic_year_id
                                           AND s2.academic_year_id <= :active_year_id
                                     )
                                   ORDER BY cfd.id DESC");
            $stmt->execute(['school_id' => $schoolId, 'active_year_id' => $activeYearId]);
        } else {
            $stmt = $pdo->prepare("SELECT cfd.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status, c_curr.name AS current_class_name
                                   FROM carry_forward_dues cfd
                                   JOIN students s ON cfd.student_id = s.id
                                   JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                                   LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                             AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                             AND s_orig.name = s.name 
                                                             AND s_orig.roll_number = s.roll_number
                                   LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                                   LEFT JOIN classrooms c_curr ON c_curr.id = s.class_id
                                   WHERE cfd.school_id = :school_id
                                     AND NOT EXISTS (
                                         SELECT 1 FROM students s2 
                                         WHERE s2.school_id = s.school_id 
                                           AND s2.name = s.name 
                                           AND s2.roll_number = s.roll_number 
                                           AND s2.academic_year_id > s.academic_year_id
                                     )
                                   ORDER BY cfd.id DESC");
            $stmt->execute(['school_id' => $schoolId]);
        }
        $dues = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($dues as &$d) {
            $d['id'] = (int)$d['id'];
            $d['student_id'] = (int)$d['student_id'];
            $d['amount'] = (float)$d['amount'];
            $d['paid_amount'] = (float)$d['paid_amount'];

            $status = $d['student_status'] ?? 'Active';
            if ($status === 'Alumni') {
                $d['class_name'] = ($d['class_name'] ?? 'Class') . ' (Passout)';
            } elseif ($status === 'Inactive') {
                $d['class_name'] = ($d['class_name'] ?? 'Class') . ' (Inactive)';
            } else {
                $d['class_name'] = $d['current_class_name'] ?? $d['class_name'];
            }
        }
        unset($d);

        return $dues;
    }

    public function getFinancePreviousDuesRecoveries(int $schoolId, int $activeYearId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        if ($activeYearId > 0) {
            $stmt = $pdo->prepare("SELECT pyr.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
                                   FROM previous_year_recoveries pyr
                                   JOIN students s ON pyr.student_id = s.id
                                   JOIN carry_forward_dues cfd ON pyr.carry_forward_due_id = cfd.id
                                   JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                                   LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                            AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                            AND s_orig.name = s.name 
                                                            AND s_orig.roll_number = s.roll_number
                                   LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                                   WHERE pyr.school_id = :school_id AND pyr.academic_year_id = :active_year_id
                                   ORDER BY pyr.id DESC");
            $stmt->execute([
                'school_id' => $schoolId,
                'active_year_id' => $activeYearId
            ]);
        } else {
            $stmt = $pdo->prepare("SELECT pyr.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
                                   FROM previous_year_recoveries pyr
                                   JOIN students s ON pyr.student_id = s.id
                                   JOIN carry_forward_dues cfd ON pyr.carry_forward_due_id = cfd.id
                                   JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                                   LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                            AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                            AND s_orig.name = s.name 
                                                            AND s_orig.roll_number = s.roll_number
                                   LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                                   WHERE pyr.school_id = :school_id
                                   ORDER BY pyr.id DESC");
            $stmt->execute(['school_id' => $schoolId]);
        }

        $recoveries = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($recoveries as &$rec) {
            $rec['id'] = (int)$rec['id'];
            $rec['student_id'] = (int)$rec['student_id'];
            $rec['carry_forward_due_id'] = (int)$rec['carry_forward_due_id'];
            $rec['amount_recovered'] = (float)$rec['amount_recovered'];
            $rec['is_locked'] = \isTransactionLocked($pdo, $schoolId, $rec['paid_at']);
        }
        unset($rec);

        return $recoveries;
    }

    // --- Financial Reports ---

    public function getFinancialReportsHistory(int $schoolId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY id DESC");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId]);
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($reports as &$r) {
            $r['id'] = (int)$r['id'];
            $r['fees_collected'] = (float)$r['fees_collected'];
            $r['extra_fees_collected'] = (float)$r['extra_fees_collected'];
            $r['previous_year_recovery'] = (float)($r['previous_year_recovery'] ?? 0.00);
            $r['previous_year_recoveries'] = $r['previous_year_recovery'];
            $r['previous_year_recovery_details'] = json_decode($r['previous_year_recovery_details'] ?? '[]', true) ?: [];
            $r['salaries_paid'] = (float)$r['salaries_paid'];
            $r['school_expenses'] = (float)$r['school_expenses'];
            $r['net_profit'] = (float)$r['net_profit'];
            $r['report_id'] = sprintf('REP-%03d', $r['id']);
        }
        unset($r);

        return $reports;
    }

    public function previewFinancialReport(int $schoolId, string $fromDate, string $toDate, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'fees_collected' => 0.00,
                'extra_fees_collected' => 0.00,
                'previous_year_recovery' => 0.00,
                'previous_year_recovery_details' => [],
                'total_income' => 0.00,
                'salaries_paid' => 0.00,
                'school_expenses' => 0.00,
                'total_expenses' => 0.00,
                'net_profit' => 0.00
            ];
        }

        // Find last report end timestamp for this school
        $lastStmt = $pdo->prepare("SELECT MAX(to_timestamp) FROM financial_reports WHERE school_id = :school_id");
        $lastStmt->execute(['school_id' => $schoolId]);
        $lastReportEnd = $lastStmt->fetchColumn();

        $selectedFromTimestamp = $fromDate . ' 00:00:00';
        $selectedToTimestamp = $toDate . ' 23:59:59';
        $now = date('Y-m-d H:i:s');
        $endTimestamp = min($selectedToTimestamp, $now);

        $useStrictGreater = false;
        if ($lastReportEnd && $lastReportEnd > $selectedFromTimestamp) {
            $startTimestamp = $lastReportEnd;
            $useStrictGreater = true;
        } else {
            $startTimestamp = $selectedFromTimestamp;
            $useStrictGreater = false;
        }

        // Sum of paid tuition fees
        $feeSql = "SELECT SUM(amount) FROM fee_records 
                   WHERE school_id = :school_id 
                     AND academic_year_id = :ay_id 
                     AND status = 'Paid'";
        $feeSql .= $useStrictGreater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
        $feeSql .= " AND paid_at <= :end_timestamp";
        $feeStmt = $pdo->prepare($feeSql);
        $feeStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $feesCollected = (float)$feeStmt->fetchColumn() ?: 0.00;

        // Sum of paid extra fees
        $extraSql = "SELECT SUM(eft.amount) FROM student_extra_fees sef
                     JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                     WHERE sef.school_id = :school_id 
                       AND sef.academic_year_id = :ay_id 
                       AND sef.status = 'Paid'";
        $extraSql .= $useStrictGreater ? " AND sef.paid_at > :start_timestamp" : " AND sef.paid_at >= :start_timestamp";
        $extraSql .= " AND sef.paid_at <= :end_timestamp";
        $extraStmt = $pdo->prepare($extraSql);
        $extraStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $extraFeesCollected = (float)$extraStmt->fetchColumn() ?: 0.00;

        // Sum of paid salaries
        $salSql = "SELECT SUM(amount) FROM salary_records 
                   WHERE school_id = :school_id 
                     AND academic_year_id = :ay_id 
                     AND status = 'Paid'";
        $salSql .= $useStrictGreater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
        $salSql .= " AND paid_at <= :end_timestamp";
        $salStmt = $pdo->prepare($salSql);
        $salStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $salariesPaid = (float)$salStmt->fetchColumn() ?: 0.00;

        // Sum of school expenses
        $expSql = "SELECT SUM(amount) FROM school_expenses 
                   WHERE school_id = :school_id 
                     AND academic_year_id = :ay_id";
        $expSql .= $useStrictGreater ? " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) > :start_timestamp" : " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) >= :start_timestamp";
        $expSql .= " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) <= :end_timestamp";
        $expStmt = $pdo->prepare($expSql);
        $expStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $schoolExpenses = (float)$expStmt->fetchColumn() ?: 0.00;

        // Sum of previous academic year recoveries
        $recoverySql = "SELECT SUM(pyr.amount_recovered) FROM previous_year_recoveries pyr
                        WHERE pyr.school_id = :school_id
                          AND pyr.academic_year_id = :ay_id";
        $recoverySql .= $useStrictGreater ? " AND pyr.paid_at > :start_timestamp" : " AND pyr.paid_at >= :start_timestamp";
        $recoverySql .= " AND pyr.paid_at <= :end_timestamp";
        $recoveryStmt = $pdo->prepare($recoverySql);
        $recoveryStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $previousYearRecovery = (float)$recoveryStmt->fetchColumn() ?: 0.00;

        // Breakdown of recoveries
        $breakdownSql = "SELECT SUM(pyr.amount_recovered) AS amount, ay.year_range 
                         FROM previous_year_recoveries pyr
                         JOIN carry_forward_dues cfd ON pyr.carry_forward_due_id = cfd.id
                         JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                         WHERE pyr.school_id = :school_id
                           AND pyr.academic_year_id = :ay_id";
        $breakdownSql .= $useStrictGreater ? " AND pyr.paid_at > :start_timestamp" : " AND pyr.paid_at >= :start_timestamp";
        $breakdownSql .= " AND pyr.paid_at <= :end_timestamp";
        $breakdownSql .= " GROUP BY cfd.original_academic_year_id ORDER BY ay.start_date ASC";

        $breakdownStmt = $pdo->prepare($breakdownSql);
        $breakdownStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'start_timestamp' => $startTimestamp,
            'end_timestamp' => $endTimestamp
        ]);
        $breakdown = $breakdownStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($breakdown as &$b) {
            $b['amount'] = (float)$b['amount'];
        }
        unset($b);

        $totalIncome = $feesCollected + $extraFeesCollected + $previousYearRecovery;
        $totalExpenses = $salariesPaid + $schoolExpenses;
        $netProfit = $totalIncome - $totalExpenses;

        return [
            'fees_collected' => $feesCollected,
            'extra_fees_collected' => $extraFeesCollected,
            'previous_year_recovery' => $previousYearRecovery,
            'previous_year_recovery_details' => $breakdown,
            'total_income' => $totalIncome,
            'salaries_paid' => $salariesPaid,
            'school_expenses' => $schoolExpenses,
            'total_expenses' => $totalExpenses,
            'net_profit' => $netProfit
        ];
    }

    public function generateFinancialReport(int $schoolId, string $fromDate, string $toDate, int $ayId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => 999,
                'report_id' => 'REP-999',
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'from_date' => $fromDate,
                'to_date' => $toDate,
                'fees_collected' => 0.00,
                'extra_fees_collected' => 0.00,
                'previous_year_recovery' => 0.00,
                'total_income' => 0.00,
                'salaries_paid' => 0.00,
                'school_expenses' => 0.00,
                'total_expenses' => 0.00,
                'net_profit' => 0.00,
                'settlement_status' => 'Pending',
                'created_at' => date('c'),
                'email_sent' => false
            ];
        }

        $preview = $this->previewFinancialReport($schoolId, $fromDate, $toDate, $ayId);

        // Find last report end timestamp
        $lastStmt = $pdo->prepare("SELECT MAX(to_timestamp) FROM financial_reports WHERE school_id = :school_id");
        $lastStmt->execute(['school_id' => $schoolId]);
        $lastReportEnd = $lastStmt->fetchColumn();

        $selectedFromTimestamp = $fromDate . ' 00:00:00';
        $selectedToTimestamp = $toDate . ' 23:59:59';
        $now = date('Y-m-d H:i:s');
        $endTimestamp = min($selectedToTimestamp, $now);

        if ($lastReportEnd && $lastReportEnd > $selectedFromTimestamp) {
            $startTimestamp = $lastReportEnd;
        } else {
            $startTimestamp = $selectedFromTimestamp;
        }

        $breakdownJson = json_encode($preview['previous_year_recovery_details']);

        $ins = $pdo->prepare("INSERT INTO financial_reports (school_id, academic_year_id, `from_date`, `to_date`, from_timestamp, to_timestamp, fees_collected, extra_fees_collected, previous_year_recovery, previous_year_recovery_details, salaries_paid, school_expenses, net_profit, settlement_status) 
                              VALUES (:school_id, :ay_id, :from_date, :to_date, :from_ts, :to_ts, :fees_collected, :extra_fees, :previous_year_recovery, :previous_year_recovery_details, :salaries, :expenses, :net_profit, 'Pending')");
        $ins->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'from_ts' => $startTimestamp,
            'to_ts' => $endTimestamp,
            'fees_collected' => $preview['fees_collected'],
            'extra_fees' => $preview['extra_fees_collected'],
            'previous_year_recovery' => $preview['previous_year_recovery'],
            'previous_year_recovery_details' => $breakdownJson,
            'salaries' => $preview['salaries_paid'],
            'expenses' => $preview['school_expenses'],
            'net_profit' => $preview['net_profit']
        ]);

        $newId = (int)$pdo->lastInsertId();

        // Generate XLSX and send email
        $tempDir = __DIR__ . '/../../../../scratch';
        if (!file_exists($tempDir)) {
            mkdir($tempDir, 0777, true);
        }
        $tempFile = $tempDir . '/Financial_Report_REP-' . sprintf('%03d', $newId) . '.xlsx';

        $emailSent = false;
        try {
            if (function_exists('generateReportExcelFile')) {
                generateReportExcelFile($pdo, $schoolId, $newId, $tempFile);
                if (function_exists('sendReportEmail')) {
                    $emailSent = sendReportEmail($performedBy, $newId, $fromDate, $toDate, $tempFile);
                }
                @unlink($tempFile);
            }
        } catch (Exception $e) {
            if (file_exists($tempFile)) {
                @unlink($tempFile);
            }
            $logMessage = "[" . date('Y-m-d H:i:s') . "] Failed generating/sending report email for report ID $newId: " . $e->getMessage() . "\n";
            file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);
        }

        $this->logAudit($pdo, $schoolId, $performedBy, 'Generate Report', "Generated financial report REP-" . sprintf('%03d', $newId) . " for period $fromDate to $toDate.");

        return [
            'id' => $newId,
            'report_id' => sprintf('REP-%03d', $newId),
            'school_id' => $schoolId,
            'academic_year_id' => $ayId,
            'from_date' => $fromDate,
            'to_date' => $toDate,
            'fees_collected' => $preview['fees_collected'],
            'extra_fees_collected' => $preview['extra_fees_collected'],
            'previous_year_recovery' => $preview['previous_year_recovery'],
            'total_income' => $preview['total_income'],
            'salaries_paid' => $preview['salaries_paid'],
            'school_expenses' => $preview['school_expenses'],
            'total_expenses' => $preview['total_expenses'],
            'net_profit' => $preview['net_profit'],
            'settlement_status' => 'Pending',
            'from_timestamp' => $startTimestamp,
            'to_timestamp' => $endTimestamp,
            'created_at' => date('c'),
            'email_sent' => $emailSent
        ];
    }

    public function toggleReportSettlement(int $schoolId, int $reportId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['settlement_status' => 'Settled'];
        }

        $chk = $pdo->prepare("SELECT settlement_status FROM financial_reports WHERE id = :id AND school_id = :school_id");
        $chk->execute(['id' => $reportId, 'school_id' => $schoolId]);
        $current = $chk->fetchColumn();
        if (!$current) {
            throw new Exception('Report not found.', 404);
        }

        $nextStatus = ($current === 'Settled') ? 'Pending' : 'Settled';

        $up = $pdo->prepare("UPDATE financial_reports SET settlement_status = :status WHERE id = :id AND school_id = :school_id");
        $up->execute([
            'status' => $nextStatus,
            'id' => $reportId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Settle Report', "Updated financial report REP-" . sprintf('%03d', $reportId) . " settlement status to $nextStatus.");

        if ($current === 'Pending' && $nextStatus === 'Settled') {
            try {
                $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :school_id");
                $stmt->execute(['id' => $reportId, 'school_id' => $schoolId]);
                $report = $stmt->fetch(PDO::FETCH_ASSOC);

                $schStmt = $pdo->prepare("SELECT name, currency FROM schools WHERE id = :id");
                $schStmt->execute(['id' => $schoolId]);
                $school = $schStmt->fetch(PDO::FETCH_ASSOC);
                $schoolName = $school['name'] ?: 'School';
                $currencyCode = $school['currency'] ?? 'INR';

                $revenue = (float)$report['fees_collected'] + (float)$report['extra_fees_collected'] + (float)($report['previous_year_recovery'] ?? 0.00);
                $expenses = (float)$report['salaries_paid'] + (float)$report['school_expenses'];

                $reportPeriod = date('d-M-Y', strtotime($report['from_date'])) . ' to ' . date('d-M-Y', strtotime($report['to_date']));
                $settlementDate = date('d-M-Y h:i A');

                $revenueFormatted = function_exists('formatReportCurrency') ? formatReportCurrency($revenue, $currencyCode) : $revenue;
                $expensesFormatted = function_exists('formatReportCurrency') ? formatReportCurrency($expenses, $currencyCode) : $expenses;

                $subject = "Financial Statement Settled - $schoolName";

                if ($revenue >= $expenses) {
                    $netProfit = $revenue - $expenses;
                    $netProfitFormatted = function_exists('formatReportCurrency') ? formatReportCurrency($netProfit, $currencyCode) : $netProfit;

                    $body = "Hello,<br><br>\n\n"
                          . "This is to confirm that the financial statement for $schoolName has been settled successfully.<br><br>\n\n"
                          . "Financial Report Summary<br><br>\n\n"
                          . "Report Period:<br>\n"
                          . "$reportPeriod<br><br>\n\n"
                          . "<strong>Total Revenue: $revenueFormatted</strong><br>\n"
                          . "<strong>Total Expenses: $expensesFormatted</strong><br>\n"
                          . "<strong>Net Profit: $netProfitFormatted</strong><br><br>\n\n"
                          . "Settlement Date:<br>\n"
                          . "$settlementDate<br><br>\n\n"
                          . "<strong>The profit amount for the above reporting period has been handed over to the School Owner.</strong><br><br>\n\n"
                          . "This is an automated confirmation generated by CM Portal.<br><br>\n\n"
                          . "Thank you.";
                } else {
                    $netLoss = $expenses - $revenue;
                    $netLossFormatted = function_exists('formatReportCurrency') ? formatReportCurrency($netLoss, $currencyCode) : $netLoss;

                    $body = "Hello,<br><br>\n\n"
                          . "This is to confirm that the financial statement for $schoolName has been settled successfully.<br><br>\n\n"
                          . "Financial Report Summary<br><br>\n\n"
                          . "Report Period:<br>\n"
                          . "$reportPeriod<br><br>\n\n"
                          . "<strong>Total Revenue: $revenueFormatted</strong><br>\n"
                          . "<strong>Total Expenses: $expensesFormatted</strong><br>\n"
                          . "<strong>Net Loss: $netLossFormatted</strong><br><br>\n\n"
                          . "Settlement Date:<br>\n"
                          . "$settlementDate<br><br>\n\n"
                          . "<strong>The above reporting period resulted in an overall loss of $netLossFormatted.</strong><br><br>\n\n"
                          . "This settlement has been recorded successfully in the financial records.<br><br>\n\n"
                          . "This is an automated confirmation generated by CM Portal.<br><br>\n\n"
                          . "Thank you.";
                }

                if (function_exists('sendSubscriptionReminderEmail')) {
                    sendSubscriptionReminderEmail($performedBy, $subject, $body, true);
                }
            } catch (Exception $e) {
                $logMessage = "[" . date('Y-m-d H:i:s') . "] Failed sending settlement email for report ID $reportId: " . $e->getMessage() . "\n";
                file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);
            }
        }

        return ['settlement_status' => $nextStatus];
    }

    public function exportFinancialReport(int $schoolId, int $reportId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            throw new Exception('Database offline', 500);
        }

        $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $reportId, 'school_id' => $schoolId]);
        $report = $stmt->fetch();
        if (!$report) {
            throw new Exception('Report not found.', 404);
        }

        $tempDir = __DIR__ . '/../../../../scratch';
        if (!file_exists($tempDir)) {
            mkdir($tempDir, 0777, true);
        }
        $tempFile = $tempDir . '/Financial_Report_REP-' . sprintf('%03d', $reportId) . '.xlsx';

        generateReportExcelFile($pdo, $schoolId, $reportId, $tempFile);

        $emailSent = false;
        if (function_exists('sendReportEmail')) {
            $emailSent = sendReportEmail($performedBy, $reportId, $report['from_date'], $report['to_date'], $tempFile);
        }

        return [
            'file_path' => $tempFile,
            'file_name' => 'Financial_Report_REP-' . sprintf('%03d', $reportId) . '.xlsx',
            'email_sent' => $emailSent
        ];
    }

    // --- School Expenses ---

    public function getSchoolExpenses(int $schoolId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT * FROM school_expenses WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY expense_date DESC, id DESC");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId]);
        $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($expenses as &$e) {
            $e['id'] = (int)$e['id'];
            $e['amount'] = (float)$e['amount'];
        }
        unset($e);

        return $expenses;
    }

    public function addSchoolExpense(int $schoolId, int $ayId, string $description, float $amount, string $performedBy): array
    {
        if (empty($description) || $amount <= 0 || !$ayId) {
            throw new Exception('Description, a positive Amount, and academic_year_id are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => 999,
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'description' => $description,
                'amount' => $amount,
                'expense_date' => date('Y-m-d'),
                'expense_time' => date('H:i:s'),
                'created_by' => $performedBy
            ];
        }

        $expenseDate = date('Y-m-d');
        $expenseTime = date('H:i:s');

        $ins = $pdo->prepare("INSERT INTO school_expenses (school_id, academic_year_id, description, amount, expense_date, expense_time, created_by) 
                              VALUES (:school_id, :ay_id, :description, :amount, :expense_date, :expense_time, :created_by)");
        $ins->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'description' => $description,
            'amount' => $amount,
            'expense_date' => $expenseDate,
            'expense_time' => $expenseTime,
            'created_by' => $performedBy
        ]);

        $newId = (int)$pdo->lastInsertId();

        $this->logAudit($pdo, $schoolId, $performedBy, 'Add Expense', "Added school expense: $description (₹$amount)");

        return [
            'id' => $newId,
            'school_id' => $schoolId,
            'academic_year_id' => $ayId,
            'description' => $description,
            'amount' => $amount,
            'expense_date' => $expenseDate,
            'expense_time' => $expenseTime,
            'created_by' => $performedBy
        ];
    }

    // --- Extra Fee Types & Student Ledger ---

    public function getExtraFeeTypes(int $schoolId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT * FROM extra_fee_types WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY id DESC");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId]);
        $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($types as &$t) {
            $t['id'] = (int)$t['id'];
            $t['amount'] = (float)$t['amount'];
        }
        unset($t);

        return $types;
    }

    public function addExtraFeeType(int $schoolId, int $ayId, string $name, float $amount, string $performedBy): array
    {
        if (empty($name) || $amount <= 0 || !$ayId) {
            throw new Exception('Name, a positive Amount, and academic_year_id are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => 999,
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'name' => $name,
                'amount' => $amount
            ];
        }

        $pdo->beginTransaction();
        try {
            $ins = $pdo->prepare("INSERT INTO extra_fee_types (school_id, academic_year_id, name, amount) 
                                  VALUES (:school_id, :ay_id, :name, :amount)");
            $ins->execute([
                'school_id' => $schoolId,
                'ay_id' => $ayId,
                'name' => $name,
                'amount' => $amount
            ]);

            $typeId = (int)$pdo->lastInsertId();

            $assignStmt = $pdo->prepare("INSERT INTO student_extra_fees (school_id, academic_year_id, student_id, extra_fee_type_id, status)
                                          SELECT school_id, academic_year_id, id, :type_id, 'Pending'
                                          FROM students
                                          WHERE school_id = :school_id
                                            AND academic_year_id = :ay_id
                                            AND status = 'Active'");
            $assignStmt->execute([
                'type_id' => $typeId,
                'school_id' => $schoolId,
                'ay_id' => $ayId
            ]);

            $pdo->commit();

            $this->logAudit($pdo, $schoolId, $performedBy, 'Add Extra Fee Type', "Created extra fee type: $name (₹$amount) and assigned to active students.");

            return [
                'id' => $typeId,
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'name' => $name,
                'amount' => $amount
            ];
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public function editExtraFeeType(int $schoolId, int $typeId, string $name, float $amount, string $performedBy): array
    {
        if (empty($name) || $amount <= 0) {
            throw new Exception('Name and positive Amount are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => $typeId,
                'school_id' => $schoolId,
                'name' => $name,
                'amount' => $amount
            ];
        }

        $chk = $pdo->prepare("SELECT * FROM extra_fee_types WHERE id = :id AND school_id = :school_id");
        $chk->execute(['id' => $typeId, 'school_id' => $schoolId]);
        $record = $chk->fetch();

        if (!$record) {
            throw new Exception('Fee type not found.', 404);
        }

        if (\isExtraFeeTypeLocked($pdo, $schoolId, $typeId)) {
            throw new Exception('This fee type is used in a finalized Financial Report and cannot be modified.', 400);
        }

        $up = $pdo->prepare("UPDATE extra_fee_types SET name = :name, amount = :amount WHERE id = :id");
        $up->execute([
            'name' => $name,
            'amount' => $amount,
            'id' => $typeId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Edit Extra Fee Type', "Updated extra fee type ID $typeId: $name (₹$amount).");

        return [
            'id' => $typeId,
            'school_id' => $schoolId,
            'academic_year_id' => (int)$record['academic_year_id'],
            'name' => $name,
            'amount' => $amount
        ];
    }

    public function getStudentExtraFees(int $schoolId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT sef.*, s.name as student_name, s.roll_number, s.class_id, s.sr_no, c.name as class_name, eft.name as fee_name, eft.amount 
                               FROM student_extra_fees sef
                               JOIN students s ON sef.student_id = s.id
                               JOIN classrooms c ON s.class_id = c.id
                               JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                               WHERE sef.school_id = :school_id AND sef.academic_year_id = :ay_id 
                               ORDER BY sef.id DESC");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId]);
        $fees = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($fees as &$f) {
            $f['id'] = (int)$f['id'];
            $f['student_id'] = (int)$f['student_id'];
            $f['extra_fee_type_id'] = (int)$f['extra_fee_type_id'];
            $f['amount'] = (float)$f['amount'];
            $f['locked'] = ($f['status'] === 'Paid' && \isTransactionLocked($pdo, $schoolId, $f['paid_at']));
        }
        unset($f);

        return $fees;
    }

    public function payExtraStudentFee(int $schoolId, int $feeId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'status' => 'Paid',
                'payment_date' => date('Y-m-d'),
                'collected_by' => $performedBy
            ];
        }

        $chk = $pdo->prepare("SELECT sef.*, eft.name as fee_name, eft.amount, s.name as student_name 
                              FROM student_extra_fees sef
                              JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                              JOIN students s ON sef.student_id = s.id
                              WHERE sef.id = :id AND sef.school_id = :school_id");
        $chk->execute(['id' => $feeId, 'school_id' => $schoolId]);
        $record = $chk->fetch();

        if (!$record) {
            throw new Exception('Extra fee record not found.', 404);
        }

        if ($record['status'] === 'Paid') {
            if (\isTransactionLocked($pdo, $schoolId, $record['paid_at'])) {
                throw new Exception('This extra fee payment is part of a finalized Financial Report and cannot be modified.', 400);
            }
            throw new Exception('Extra fee is already paid.', 400);
        }

        $payDate = date('Y-m-d');

        $up = $pdo->prepare("UPDATE student_extra_fees SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at, collected_by = :collector 
                             WHERE id = :id AND school_id = :school_id");
        $up->execute([
            'pay_date' => $payDate,
            'paid_at' => date('Y-m-d H:i:s'),
            'collector' => $performedBy,
            'id' => $feeId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Pay Extra Fee', "Collected extra fee '{$record['fee_name']}' (₹{$record['amount']}) from student '{$record['student_name']}'");

        return [
            'status' => 'Paid',
            'payment_date' => $payDate,
            'collected_by' => $performedBy
        ];
    }

    public function revertExtraStudentFee(int $schoolId, int $feeId, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'status' => 'Pending',
                'payment_date' => null,
                'collected_by' => null
            ];
        }

        $chk = $pdo->prepare("SELECT sef.*, eft.name as fee_name, eft.amount, s.name as student_name 
                              FROM student_extra_fees sef
                              JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                              JOIN students s ON sef.student_id = s.id
                              WHERE sef.id = :id AND sef.school_id = :school_id");
        $chk->execute(['id' => $feeId, 'school_id' => $schoolId]);
        $record = $chk->fetch();

        if (!$record) {
            throw new Exception('Extra fee record not found.', 404);
        }

        if ($record['status'] === 'Paid' && \isTransactionLocked($pdo, $schoolId, $record['paid_at'])) {
            throw new Exception('This extra fee payment is part of a finalized Financial Report and cannot be reverted.', 400);
        }

        if ($record['status'] === 'Pending') {
            throw new Exception('Extra fee is already pending.', 400);
        }

        $up = $pdo->prepare("UPDATE student_extra_fees SET status = 'Pending', payment_date = NULL, paid_at = NULL, collected_by = NULL 
                             WHERE id = :id AND school_id = :school_id");
        $up->execute([
            'id' => $feeId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Revert Extra Fee', "Reverted extra fee payment '{$record['fee_name']}' (₹{$record['amount']}) for student '{$record['student_name']}'");

        return [
            'status' => 'Pending',
            'payment_date' => null,
            'collected_by' => null
        ];
    }

    // --- Payment Promises ---

    public function getPaymentPromises(int $schoolId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT p.*, s.name AS student_name, s.roll_number, c.name AS class_name, s.class_id
                               FROM payment_promises p
                               JOIN students s ON p.student_id = s.id
                               LEFT JOIN classrooms c ON s.class_id = c.id
                               WHERE p.school_id = :school_id AND p.academic_year_id = :ay_id
                               ORDER BY p.promise_date ASC, p.id ASC");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId]);
        $promises = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($promises as &$p) {
            $p['id'] = (int)$p['id'];
            $p['school_id'] = (int)$p['school_id'];
            $p['academic_year_id'] = (int)$p['academic_year_id'];
            $p['student_id'] = (int)$p['student_id'];
            if (isset($p['class_id'])) {
                $p['class_id'] = (int)$p['class_id'];
            }
        }
        unset($p);

        return $promises;
    }

    public function addPaymentPromise(int $schoolId, int $ayId, int $studentId, string $date, string $description, string $status, string $performedBy): array
    {
        if (!$studentId || empty($date) || !$ayId) {
            throw new Exception('Student, Date, and academic_year_id are required.', 400);
        }

        if ($status !== 'Pending' && $status !== 'Fulfilled') {
            $status = 'Pending';
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => 999,
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'student_id' => $studentId,
                'promise_date' => $date,
                'description' => $description,
                'status' => $status,
                'student_name' => 'Demo Student',
                'class_name' => 'Demo Class',
                'class_id' => 1
            ];
        }

        $chkStudent = $pdo->prepare("SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classrooms c ON s.class_id = c.id WHERE s.id = :student_id AND s.school_id = :school_id");
        $chkStudent->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        $student = $chkStudent->fetch();

        if (!$student) {
            throw new Exception('Selected student not found.', 404);
        }

        $ins = $pdo->prepare("INSERT INTO payment_promises (school_id, academic_year_id, student_id, promise_date, description, status) 
                              VALUES (:school_id, :ay_id, :student_id, :promise_date, :description, :status)");
        $ins->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'student_id' => $studentId,
            'promise_date' => $date,
            'description' => $description,
            'status' => $status
        ]);

        $newId = (int)$pdo->lastInsertId();

        $this->logAudit($pdo, $schoolId, $performedBy, 'Add Payment Promise', "Added payment promise for student {$student['name']} on $date");

        return [
            'id' => $newId,
            'school_id' => $schoolId,
            'academic_year_id' => $ayId,
            'student_id' => $studentId,
            'promise_date' => $date,
            'description' => $description,
            'status' => $status,
            'student_name' => $student['name'],
            'class_name' => $student['class_name'] ?? 'Unassigned',
            'class_id' => $student['class_id'] ? (int)$student['class_id'] : null
        ];
    }

    public function editPaymentPromise(int $schoolId, int $promiseId, int $studentId, string $date, string $description, string $status, string $performedBy): array
    {
        if (!$studentId || empty($date)) {
            throw new Exception('Student and Date are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'id' => $promiseId,
                'school_id' => $schoolId,
                'student_id' => $studentId,
                'promise_date' => $date,
                'description' => $description,
                'status' => $status,
                'student_name' => 'Demo Student',
                'class_name' => 'Demo Class',
                'class_id' => 1
            ];
        }

        $chkPromise = $pdo->prepare("SELECT * FROM payment_promises WHERE id = :id AND school_id = :school_id");
        $chkPromise->execute(['id' => $promiseId, 'school_id' => $schoolId]);
        $promise = $chkPromise->fetch();

        if (!$promise) {
            throw new Exception('Payment promise not found.', 404);
        }

        if (empty($status) || ($status !== 'Pending' && $status !== 'Fulfilled')) {
            $status = $promise['status'];
        }

        $chkStudent = $pdo->prepare("SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classrooms c ON s.class_id = c.id WHERE s.id = :student_id AND s.school_id = :school_id");
        $chkStudent->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        $student = $chkStudent->fetch();

        if (!$student) {
            throw new Exception('Selected student not found.', 404);
        }

        $up = $pdo->prepare("UPDATE payment_promises 
                             SET student_id = :student_id, promise_date = :promise_date, description = :description, status = :status 
                             WHERE id = :id AND school_id = :school_id");
        $up->execute([
            'student_id' => $studentId,
            'promise_date' => $date,
            'description' => $description,
            'status' => $status,
            'id' => $promiseId,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Edit Payment Promise', "Updated payment promise ID $promiseId for student {$student['name']}");

        return [
            'id' => $promiseId,
            'school_id' => $schoolId,
            'academic_year_id' => (int)$promise['academic_year_id'],
            'student_id' => $studentId,
            'promise_date' => $date,
            'description' => $description,
            'status' => $status,
            'student_name' => $student['name'],
            'class_name' => $student['class_name'] ?? 'Unassigned',
            'class_id' => $student['class_id'] ? (int)$student['class_id'] : null
        ];
    }

    public function deletePaymentPromise(int $schoolId, int $promiseId, string $performedBy): bool
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return true;
        }

        $chkPromise = $pdo->prepare("SELECT * FROM payment_promises WHERE id = :id AND school_id = :school_id");
        $chkPromise->execute(['id' => $promiseId, 'school_id' => $schoolId]);
        $promise = $chkPromise->fetch();

        if (!$promise) {
            throw new Exception('Payment promise not found.', 404);
        }

        $del = $pdo->prepare("DELETE FROM payment_promises WHERE id = :id AND school_id = :school_id");
        $del->execute(['id' => $promiseId, 'school_id' => $schoolId]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Delete Payment Promise', "Deleted payment promise ID $promiseId");
        return true;
    }

    // --- Helper ---

    private function logAudit(PDO $pdo, ?int $schoolId, string $username, string $action, string $details): void
    {
        try {
            $stmt = $pdo->prepare("INSERT INTO audit_logs (school_id, username, action, details, ip_address, created_at) VALUES (:school_id, :username, :action, :details, :ip, NOW())");
            $stmt->execute([
                'school_id' => $schoolId,
                'username' => $username,
                'action' => $action,
                'details' => $details,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);
        } catch (\Exception $e) {
            error_log("Failed to log audit: " . $e->getMessage());
        }
    }
}
