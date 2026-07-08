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

    public function pasteTimetableSchedule(array $user, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if (empty($data['class_id']) || empty($data['source_day']) || empty($data['destination_day']) || empty($data['destination_date'])) {
            throw new ValidationException(['fields' => 'Class ID, source day, destination day, and destination date are required.']);
        }

        $classId = (int)$data['class_id'];
        $sourceDay = $data['source_day'];
        $destDay = $data['destination_day'];
        $destDate = $data['destination_date'];

        $startDate = $destDate;

        // Fetch active periods from the source day
        $stmtSrc = $pdo->prepare("
            SELECT * FROM timetable 
            WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid AND end_date IS NULL
        ");
        $stmtSrc->execute([
            ':cid' => $classId,
            ':day' => $sourceDay,
            ':sid' => $schoolId
        ]);
        $srcPeriods = $stmtSrc->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        // Validate teacher availability and maximum workload constraints
        foreach ($srcPeriods as $p) {
            $teacherId = (int)$p['teacher_id'];
            $periodNum = (int)$p['period_number'];

            // 1. Conflict Check: is the teacher already assigned to ANOTHER class during this period on the destination day?
            $stmtConflict = $pdo->prepare("
                SELECT t.id, c.name AS class_name FROM timetable t
                JOIN classes c ON t.class_id = c.id
                WHERE t.teacher_id = :tid 
                  AND t.day_of_week = :day 
                  AND t.period_number = :pnum 
                  AND t.class_id != :cid 
                  AND t.end_date IS NULL
            ");
            $stmtConflict->execute([
                ':tid' => $teacherId,
                ':day' => $destDay,
                ':pnum' => $periodNum,
                ':cid' => $classId
            ]);
            $conflict = $stmtConflict->fetch(\PDO::FETCH_ASSOC);
            if ($conflict) {
                throw new ValidationException(['teacher_id' => "Schedule cannot be pasted because one or more teachers are already assigned to another class during the same period."]);
            }

            // 2. Workload Check: does assigning this period exceed the teacher's max periods workload?
            $stmtCount = $pdo->prepare("
                SELECT COUNT(*) FROM timetable 
                WHERE teacher_id = :tid 
                  AND school_id = :sid 
                  AND day_of_week = :day 
                  AND class_id != :cid 
                  AND end_date IS NULL
            ");
            $stmtCount->execute([
                ':tid' => $teacherId,
                ':sid' => $schoolId,
                ':day' => $destDay,
                ':cid' => $classId
            ]);
            $otherAssignedCount = (int)$stmtCount->fetchColumn();

            $copiedCountForTeacher = 0;
            foreach ($srcPeriods as $sp) {
                if ((int)$sp['teacher_id'] === $teacherId) {
                    $copiedCountForTeacher++;
                }
            }

            $totalWorkload = $otherAssignedCount + $copiedCountForTeacher;

            $stmtMax = $pdo->prepare("SELECT max_periods FROM staff WHERE id = :tid AND school_id = :sid");
            $stmtMax->execute([':tid' => $teacherId, ':sid' => $schoolId]);
            $maxPeriods = (int)$stmtMax->fetchColumn();

            if ($totalWorkload > $maxPeriods) {
                throw new ValidationException(['teacher_id' => "Schedule cannot be pasted because one or more teachers would exceed their maximum workload limit of {$maxPeriods} periods."]);
            }
        }

        // All checks passed! Execute paste atomically inside a transaction
        $pdo->beginTransaction();
        try {
            // Find existing active timetable entries of this class on the destination day
            $stmtFindDest = $pdo->prepare("
                SELECT id, start_date FROM timetable 
                WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid AND end_date IS NULL
            ");
            $stmtFindDest->execute([
                ':cid' => $classId,
                ':day' => $destDay,
                ':sid' => $schoolId
            ]);
            $destEntries = $stmtFindDest->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            foreach ($destEntries as $de) {
                if ($de['start_date'] < $startDate) {
                    // The entry has history. End it.
                    $dt = new \DateTime($startDate);
                    $dt->modify('-1 day');
                    $endDate = $dt->format('Y-m-d');
                    
                    $stmtEnd = $pdo->prepare("UPDATE timetable SET end_date = :end_date WHERE id = :id");
                    $stmtEnd->execute([':end_date' => $endDate, ':id' => $de['id']]);
                    
                    // Delete backups on or after start_date
                    $stmtDelBackup = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id AND date >= :date");
                    $stmtDelBackup->execute([':id' => $de['id'], ':date' => $startDate]);
                } else {
                    // The entry is newer. Delete it completely.
                    $stmtDelBackup = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id");
                    $stmtDelBackup->execute([':id' => $de['id']]);
                    
                    $stmtDel = $pdo->prepare("DELETE FROM timetable WHERE id = :id");
                    $stmtDel->execute([':id' => $de['id']]);
                }
            }

            // Insert copied periods
            $stmtInsert = $pdo->prepare("
                INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date, is_published)
                VALUES (:sid, :cid, :subid, :tid, :day, :pnum, :start_date, 0)
            ");

            foreach ($srcPeriods as $p) {
                $stmtInsert->execute([
                    ':sid' => $schoolId,
                    ':cid' => $classId,
                    ':subid' => $p['subject_id'],
                    ':tid' => $p['teacher_id'],
                    ':day' => $destDay,
                    ':pnum' => $p['period_number'],
                    ':start_date' => $startDate
                ]);
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getWorkingAcademicYear(PDO $pdo, int $schoolId): ?array
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

    public function getStudentClassForYear(PDO $pdo, int $studentId, int $schoolId, int $academicYearId): ?int
    {
        // 1. Check if the student's current academic_year_id matches the requested year
        $stmt = $pdo->prepare("SELECT class_id, academic_year_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmt->execute([':id' => $studentId, ':sid' => $schoolId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && (int)$row['academic_year_id'] === $academicYearId) {
            return (int)$row['class_id'];
        }

        // 2. If it doesn't match, check fee_payments for this academic year to find the class_id via fee_structure
        $stmt = $pdo->prepare("
            SELECT fs.class_id 
            FROM fee_payments fp
            JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.student_id = :student_id AND fp.academic_year_id = :ay_id AND fp.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $studentId, ':ay_id' => $academicYearId, ':sid' => $schoolId]);
        $classId = $stmt->fetchColumn();
        if ($classId !== false && $classId !== null) {
            return (int)$classId;
        }

        // 3. Check exam_marks for this academic year to find class_id via exams
        $stmt = $pdo->prepare("
            SELECT e.class_id 
            FROM exam_marks em
            JOIN exams e ON em.exam_id = e.id
            WHERE em.student_id = :student_id AND e.academic_year_id = :ay_id AND e.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $studentId, ':ay_id' => $academicYearId, ':sid' => $schoolId]);
        $classId = $stmt->fetchColumn();
        if ($classId !== false && $classId !== null) {
            return (int)$classId;
        }

        // 4. If still not found, try to resolve via class name matching:
        if ($row && $row['class_id']) {
            $stmt = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
            $stmt->execute([':cid' => (int)$row['class_id']]);
            $currentClass = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($currentClass) {
                $className = $currentClass['name'];
                $section = $currentClass['section'];

                // Let's try matching same name class first
                $stmt = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :sid AND academic_year_id = :ay_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) 
                    LIMIT 1
                ");
                $stmt->execute([
                    ':sid' => $schoolId,
                    ':ay_id' => $academicYearId,
                    ':name' => $className,
                    ':section' => $section,
                    ':section_null' => $section === null ? 1 : 0
                ]);
                $cid = $stmt->fetchColumn();
                if ($cid !== false) {
                    preg_match('/\d+/', $className, $matches);
                    if ($matches) {
                        $num = (int)$matches[0];
                        if ($num > 1) {
                            $prevClassName = str_replace((string)$num, (string)($num - 1), $className);
                            $stmt = $pdo->prepare("
                                SELECT id FROM classes 
                                WHERE school_id = :sid AND academic_year_id = :ay_id AND name = :name AND (section = :section OR (section IS NULL AND :section_null = 1)) 
                                LIMIT 1
                            ");
                            $stmt->execute([
                                ':sid' => $schoolId,
                                ':ay_id' => $academicYearId,
                                ':name' => $prevClassName,
                                ':section' => $section,
                                ':section_null' => $section === null ? 1 : 0
                            ]);
                            $prevCid = $stmt->fetchColumn();
                            if ($prevCid !== false) {
                                return (int)$prevCid;
                            }
                        }
                    }
                    return (int)$cid;
                }
            }
        }

        return null;
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
            $monthsDue = $this->getMonthsDueUpToCurrent($activeYear['start_date'], $activeYear['end_date'], $activeYear['status']);

            if (!empty($monthsDue)) {
                // Fetch all active students in this active year (or all students if Archived)
                if ($activeYear['status'] === 'Archived') {
                    $stmtStudents = $pdo->prepare("
                        SELECT id, class_id 
                        FROM students 
                        WHERE school_id = :sid AND academic_year_id = :ayid
                    ");
                } else {
                    $stmtStudents = $pdo->prepare("
                        SELECT id, class_id 
                        FROM students 
                        WHERE school_id = :sid AND status = 'ACTIVE' AND academic_year_id = :ayid
                    ");
                }
                $stmtStudents->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $activeYear['id']
                ]);
                $activeStudents = $stmtStudents->fetchAll(\PDO::FETCH_ASSOC);

                // Filter out promoted students if Archived
                if ($activeYear['status'] === 'Archived') {
                    $activeStudents = array_filter($activeStudents, function($student) use ($pdo, $schoolId) {
                        return !$this->isStudentPromoted($pdo, (int)$student['id'], $schoolId);
                    });
                    $activeStudents = array_values($activeStudents);
                }

                if (!empty($activeStudents)) {
                    // Fetch all class configurations for this year
                    $stmtConfigs = $pdo->prepare("
                        SELECT class_id, monthly_fees 
                        FROM class_fee_configurations 
                        WHERE school_id = :sid AND academic_year_id = :ayid
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
            if ($activeYear['status'] === 'Archived') {
                $stmtAddPending = $pdo->prepare("
                    SELECT afp.amount, afp.student_id
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    WHERE afp.school_id = :sid
                      AND afp.status = 'Pending'
                      AND aft.academic_year_id = :ayid_fee
                      AND (aft.due_date <= :today OR aft.name = 'Previous Year Dues')
                ");
                $stmtAddPending->execute([
                    ':sid' => $schoolId,
                    ':ayid_fee' => $activeYear['id'],
                    ':today' => $today
                ]);
                $addPayments = $stmtAddPending->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $pendingAddFees = 0.0;
                foreach ($addPayments as $p) {
                    if (!$this->isStudentPromoted($pdo, (int)$p['student_id'], $schoolId)) {
                        $pendingAddFees += (float)$p['amount'];
                    }
                }
            } else {
                $stmtAddPending = $pdo->prepare("
                    SELECT COALESCE(SUM(afp.amount), 0)
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    JOIN students s ON afp.student_id = s.id
                    WHERE afp.school_id = :sid
                      AND afp.status = 'Pending'
                      AND s.status = 'ACTIVE'
                      AND s.academic_year_id = :ayid_stu
                      AND aft.academic_year_id = :ayid_fee
                      AND (aft.due_date <= :today OR aft.name = 'Previous Year Dues')
                ");
                $stmtAddPending->execute([
                    ':sid' => $schoolId,
                    ':ayid_stu' => $activeYear['id'],
                    ':ayid_fee' => $activeYear['id'],
                    ':today' => $today
                ]);
                $pendingAddFees = (float)$stmtAddPending->fetchColumn();
            }
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

        $ayid = $activeYear ? (int)$activeYear['id'] : null;

        return [
            'students_count' => $this->studentRepo->countBySchool($schoolId, 'ACTIVE', $ayid),
            'staff_count'    => $this->staffRepo->countBySchool($schoolId, 'ACTIVE', $ayid),
            'classes_count'  => $this->classRepo->countBySchool($schoolId),
            'pending_fees'   => $pendingFeesTotal,
            'total_collected' => $this->feeRepo->getTotalCollectedBySchool($schoolId, $ayid),
            'fee_collection_chart' => $feeCollectionChart,
            'salary_disbursement_chart' => $salaryDisbursementChart,
        ];
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    public function getStudents(array $user, array $filters = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear) {
            $filters['academic_year_id'] = (int)$workingYear['id'];
        }
        $students = $this->studentRepo->findBySchool($schoolId, $filters);
        return $students;
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
        
        $workingYearClassId = $this->getStudentClassForYear($pdo, $id, $schoolId, $workingYearId);
        if ($workingYearClassId !== null) {
            $student['class_id'] = $workingYearClassId;
            $stmtClassName = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
            $stmtClassName->execute([':cid' => $workingYearClassId]);
            $cls = $stmtClassName->fetch(PDO::FETCH_ASSOC);
            if ($cls) {
                $sectionStr = !empty($cls['section']) ? ' - ' . $cls['section'] : '';
                $student['class_name'] = $cls['name'] . $sectionStr;
            }
        }

        $isLedgerLocked = false;
        $ledgerLockedMessage = '';
        if ($this->isStudentPromoted($pdo, $id, $schoolId)) {
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

        // Query class fee configuration
        $classFeeConfig = null;
        if ($workingYearClassId !== null) {
            $stmtCfg = $pdo->prepare("
                SELECT * FROM class_fee_configurations 
                WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id
                LIMIT 1
            ");
            $stmtCfg->execute([
                ':school_id' => $schoolId,
                ':class_id' => $workingYearClassId,
                ':academic_year_id' => $workingYearId
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
              AND aft.academic_year_id = :ayid
              AND (aft.due_date IS NULL OR aft.due_date <= :today OR afp.status = 'Paid' OR aft.name = 'Previous Year Dues')
            ORDER BY afp.id DESC
        ");
        $addStmt->execute([':student_id' => $id, ':ayid' => $workingYearId, ':today' => $today]);
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
        if (!empty($data['aadhaar_no']) && !preg_match('/^[0-9]{12}$/', $data['aadhaar_no'])) {
            $errors['aadhaar_no'] = 'Aadhaar number must contain exactly 12 numeric digits.';
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
        if (!empty($data['aadhaar_no']) && !preg_match('/^[0-9]{12}$/', $data['aadhaar_no'])) {
            $errors['aadhaar_no'] = 'Aadhaar number must contain exactly 12 numeric digits.';
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
        // QA uses '/api' as the deployment folder, Local uses '/backend'
        if (str_contains(__DIR__, DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR)) {
            $directory = dirname(__DIR__, 5) . '/uploads';
        } else {
            $directory = dirname(__DIR__, 5) . '/backend/public/uploads';
        }

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

    public function getStaff(array $user, array $params = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        
        $date = $params['date'] ?? date('Y-m-d');
        try {
            $dt = new \DateTime($date);
            $dayOfWeek = $dt->format('l');
        } catch (\Exception $e) {
            $dayOfWeek = date('l');
            $date = date('Y-m-d');
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayid = $workingYear ? (int)$workingYear['id'] : 0;

        $stmt = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid ORDER BY id DESC");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $ayid]);
        $staffList = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch active periods for this specific day (taking into account backup overrides)
        $stmtPeriods = $pdo->prepare("
            SELECT id, teacher_id, start_date 
            FROM timetable 
            WHERE school_id = :sid AND day_of_week = :day AND end_date IS NULL
        ");
        $stmtPeriods->execute([':sid' => $schoolId, ':day' => $dayOfWeek]);
        $timetablePeriods = $stmtPeriods->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $teacherCounts = [];
        foreach ($timetablePeriods as $tp) {
            // Skip if the period was not effective yet on the requested date
            if ($date < $tp['start_date']) {
                continue;
            }
            $stmtB = $pdo->prepare("
                SELECT backup_teacher_id 
                FROM timetable_backups 
                WHERE timetable_id = :tid AND date = :date
            ");
            $stmtB->execute([':tid' => $tp['id'], ':date' => $date]);
            $backupTeacherId = $stmtB->fetchColumn();

            if ($backupTeacherId) {
                $activeTid = (int)$backupTeacherId;
            } else {
                $activeTid = (int)$tp['teacher_id'];
            }

            if (!isset($teacherCounts[$activeTid])) {
                $teacherCounts[$activeTid] = 0;
            }
            $teacherCounts[$activeTid]++;
        }

        // For each staff member, fetch documents count and sync active periods
        foreach ($staffList as &$s) {
            $s['is_migrated'] = $this->isStaffMigrated($pdo, (int)$s['id'], $schoolId);
            $stmtDocs = $pdo->prepare("SELECT COUNT(*) FROM staff_documents WHERE staff_id = :sid");
            $stmtDocs->execute([':sid' => $s['id']]);
            $s['documents_count'] = (int)$stmtDocs->fetchColumn();

            if (strcasecmp($s['role'], 'Teacher') === 0) {
                $count = $teacherCounts[$s['id']] ?? 0;

                if ((int)$s['assigned_periods'] !== $count) {
                    $stmtUpdate = $pdo->prepare("UPDATE staff SET assigned_periods = :count WHERE id = :tid");
                    $stmtUpdate->execute([':count' => $count, ':tid' => $s['id']]);
                    $s['assigned_periods'] = $count;
                }

                // Query day workloads for the teacher
                $stmtDays = $pdo->prepare("
                    SELECT day_of_week, COUNT(*) as cnt 
                    FROM timetable 
                    WHERE teacher_id = :tid AND school_id = :sid AND end_date IS NULL
                    GROUP BY day_of_week
                ");
                $stmtDays->execute([':tid' => $s['id'], ':sid' => $schoolId]);
                $dayCounts = $stmtDays->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
                $s['day_workloads'] = [
                    'Monday'    => (int)($dayCounts['Monday'] ?? 0),
                    'Tuesday'   => (int)($dayCounts['Tuesday'] ?? 0),
                    'Wednesday' => (int)($dayCounts['Wednesday'] ?? 0),
                    'Thursday'  => (int)($dayCounts['Thursday'] ?? 0),
                    'Friday'    => (int)($dayCounts['Friday'] ?? 0),
                    'Saturday'  => (int)($dayCounts['Saturday'] ?? 0),
                ];
            }
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

        // Dynamic workload sync
        if (strcasecmp($member['role'], 'Teacher') === 0) {
            $stmtCount = $pdo->prepare("
                SELECT COUNT(*) FROM timetable 
                WHERE teacher_id = :tid AND school_id = :sid AND end_date IS NULL
            ");
            $stmtCount->execute([':tid' => $member['id'], ':sid' => $schoolId]);
            $count = (int)$stmtCount->fetchColumn();

            if ((int)$member['assigned_periods'] !== $count) {
                $stmtUpdate = $pdo->prepare("UPDATE staff SET assigned_periods = :count WHERE id = :tid");
                $stmtUpdate->execute([':count' => $count, ':tid' => $member['id']]);
                $member['assigned_periods'] = $count;
            }

            // Query day workloads for the teacher
            $stmtDays = $pdo->prepare("
                SELECT day_of_week, COUNT(*) as cnt 
                FROM timetable 
                WHERE teacher_id = :tid AND school_id = :sid AND end_date IS NULL
                GROUP BY day_of_week
            ");
            $stmtDays->execute([':tid' => $member['id'], ':sid' => $schoolId]);
            $dayCounts = $stmtDays->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
            $member['day_workloads'] = [
                'Monday'    => (int)($dayCounts['Monday'] ?? 0),
                'Tuesday'   => (int)($dayCounts['Tuesday'] ?? 0),
                'Wednesday' => (int)($dayCounts['Wednesday'] ?? 0),
                'Thursday'  => (int)($dayCounts['Thursday'] ?? 0),
                'Friday'    => (int)($dayCounts['Friday'] ?? 0),
                'Saturday'  => (int)($dayCounts['Saturday'] ?? 0),
            ];
        }

        // Fetch documents
        $stmtDocs = $pdo->prepare("SELECT * FROM staff_documents WHERE staff_id = :sid ORDER BY id ASC");
        $stmtDocs->execute([':sid' => $id]);
        $member['documents'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $member['is_migrated'] = $this->isStaffMigrated($pdo, $id, $schoolId);

        // Fetch salary payments for current working academic year or current active year
        $member['salary_payments'] = [];
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear) {
            $stmtPayments = $pdo->prepare("
                SELECT * FROM staff_payments 
                WHERE staff_id = :sid 
                  AND (academic_year_id = :ayid OR academic_year_id = (SELECT id FROM academic_years WHERE school_id = :school_id AND is_current = 1 LIMIT 1))
            ");
            $stmtPayments->execute([
                ':sid' => $id,
                ':ayid' => $workingYear['id'],
                ':school_id' => $schoolId
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

        // Calculate Previous Year Pending Salaries for Migrated Teachers
        $member['previous_year_pending'] = null;
        if ($workingYear) {
            $stmtPrevYear = $pdo->prepare("
                SELECT * FROM academic_years 
                WHERE school_id = :sid AND start_date < :curr_start_date 
                ORDER BY start_date DESC LIMIT 1
            ");
            $stmtPrevYear->execute([':sid' => $schoolId, ':curr_start_date' => $workingYear['start_date']]);
            $prevYear = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);
            
            if ($prevYear) {
                // Find matching staff record in previous year
                $oldStaff = null;
                if (!empty($member['employee_id'])) {
                    $stmtOld = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND employee_id = :emp_id LIMIT 1");
                    $stmtOld->execute([':sid' => $schoolId, ':ayid' => $prevYear['id'], ':emp_id' => $member['employee_id']]);
                    $oldStaff = $stmtOld->fetch(PDO::FETCH_ASSOC);
                } else if (!empty($member['email'])) {
                    $stmtOld = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND email = :email LIMIT 1");
                    $stmtOld->execute([':sid' => $schoolId, ':ayid' => $prevYear['id'], ':email' => $member['email']]);
                    $oldStaff = $stmtOld->fetch(PDO::FETCH_ASSOC);
                }
                
                if ($oldStaff) {
                    // Fetch paid months in previous year
                    $stmtOldPaid = $pdo->prepare("
                        SELECT payment_month FROM staff_payments 
                        WHERE staff_id = :sid AND academic_year_id = :ayid
                    ");
                    $stmtOldPaid->execute([':sid' => $oldStaff['id'], ':ayid' => $prevYear['id']]);
                    $oldPaidMonths = $stmtOldPaid->fetchAll(PDO::FETCH_COLUMN) ?: [];
                    
                    // Fetch paid previous-year months in current year
                    $stmtCurrOldPaid = $pdo->prepare("
                        SELECT payment_month FROM staff_payments 
                        WHERE staff_id = :sid AND academic_year_id = :ayid AND payment_month LIKE 'Previous Year - %'
                    ");
                    $stmtCurrOldPaid->execute([':sid' => $id, ':ayid' => $workingYear['id']]);
                    $currOldPaid = $stmtCurrOldPaid->fetchAll(PDO::FETCH_COLUMN) ?: [];
                    
                    // Extract month names from "Previous Year - <Month>"
                    $resolvedCurrOldPaid = [];
                    foreach ($currOldPaid as $cop) {
                        $parts = explode('Previous Year - ', $cop);
                        if (count($parts) > 1) {
                            $monthsStr = trim($parts[1]);
                            $subMonths = array_map('trim', explode(',', $monthsStr));
                            foreach ($subMonths as $sm) {
                                $rangeParts = preg_split('/[-–]/', $sm);
                                if (count($rangeParts) > 1) {
                                    $allMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                                    $startIdx = array_search(trim($rangeParts[0]), $allMonths);
                                    $endIdx = array_search(trim($rangeParts[1]), $allMonths);
                                    if ($startIdx !== false && $endIdx !== false) {
                                        for ($i = $startIdx; $i <= $endIdx; $i++) {
                                            $resolvedCurrOldPaid[] = $allMonths[$i];
                                        }
                                    }
                                } else {
                                    $resolvedCurrOldPaid[] = $sm;
                                }
                            }
                        }
                    }
                    
                    $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                    $pendingMonths = [];
                    foreach ($allAcademicMonths as $m) {
                        if (!in_array($m, $oldPaidMonths, true) && !in_array($m, $resolvedCurrOldPaid, true)) {
                            $pendingMonths[] = $m;
                        }
                    }
                    
                    if (!empty($pendingMonths)) {
                        $member['previous_year_pending'] = [
                            'academic_year_id' => $prevYear['id'],
                            'academic_year_name' => $prevYear['name'],
                            'pending_months' => $pendingMonths,
                            'salary' => (float)$oldStaff['salary'],
                            'total_pending' => count($pendingMonths) * (float)$oldStaff['salary']
                        ];
                    }
                }
            }
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

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayid = $workingYear ? (int)$workingYear['id'] : null;

        // 2. Uniqueness Checks
        $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND (academic_year_id = :ayid OR (academic_year_id IS NULL AND :ayid_null = 1)) LIMIT 1");
        $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':ayid' => $ayid, ':ayid_null' => $ayid === null ? 1 : 0]);
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        $stmtCheckEmail = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = :email AND (academic_year_id = :ayid OR (academic_year_id IS NULL AND :ayid_null = 1)) LIMIT 1");
        $stmtCheckEmail->execute([':sid' => $schoolId, ':email' => trim($data['email']), ':ayid' => $ayid, ':ayid_null' => $ayid === null ? 1 : 0]);
        if ($stmtCheckEmail->fetchColumn() !== false) {
            throw new ValidationException(['email' => 'This email address already exists.']);
        }

        // 3. Status Mapping
        $status = !empty($data['exit_date']) ? 'Inactive' : 'ACTIVE';

        // 4. Save
        $id = $this->staffRepo->create([
            'school_id'               => $schoolId,
            'academic_year_id'        => $ayid,
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

        $ayid = $member ? $member['academic_year_id'] : null;

        // 2. Uniqueness Checks
        $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND id != :id AND (academic_year_id = :ayid OR (academic_year_id IS NULL AND :ayid_null = 1)) LIMIT 1");
        $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':id' => $id, ':ayid' => $ayid, ':ayid_null' => $ayid === null ? 1 : 0]);
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        $stmtCheckEmail = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = :email AND id != :id AND (academic_year_id = :ayid OR (academic_year_id IS NULL AND :ayid_null = 1)) LIMIT 1");
        $stmtCheckEmail->execute([':sid' => $schoolId, ':email' => trim($data['email']), ':id' => $id, ':ayid' => $ayid, ':ayid_null' => $ayid === null ? 1 : 0]);
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
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        return $this->classRepo->findBySchool($schoolId, $workingYear ? (int)$workingYear['id'] : null);
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

    private function initializeNewSchool(PDO $pdo, int $schoolId, string $userEmail): array
    {
        // 1. Calculate Academic Year name and dates from current time
        $now = new \DateTime();
        $month = (int)$now->format('n');
        $year = (int)$now->format('Y');

        if ($month >= 4) {
            $startYear = $year;
            $endYear = $year + 1;
        } else {
            $startYear = $year - 1;
            $endYear = $year;
        }

        $ayName = "{$startYear}–{$endYear}";
        $startDate = "{$startYear}-04-01";
        $endDate = "{$endYear}-03-31";

        // Double check again under transaction to prevent race conditions
        $stmtCheck = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid LIMIT 1");
        $stmtCheck->execute([':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() !== false) {
            return []; // Already initialized
        }

        // 2. Create the first Academic Year (Active and Current)
        $stmtInsert = $pdo->prepare("
            INSERT INTO academic_years (school_id, name, start_date, end_date, is_current, status) 
            VALUES (:school_id, :name, :start_date, :end_date, 1, 'ACTIVE')
        ");
        $stmtInsert->execute([
            ':school_id' => $schoolId,
            ':name' => $ayName,
            ':start_date' => $startDate,
            ':end_date' => $endDate
        ]);
        $newYearId = (int)$pdo->lastInsertId();

        // 3. Set all other years (if any) to is_current = 0 just in case
        $stmtResetCurrent = $pdo->prepare("UPDATE academic_years SET is_current = 0 WHERE school_id = :sid AND id != :new_id");
        $stmtResetCurrent->execute([':sid' => $schoolId, ':new_id' => $newYearId]);

        // 4. Prefill standard national holidays
        $defaultHolidays = [
            ['name' => 'Labour Day', 'date' => "{$startYear}-05-01"],
            ['name' => 'Independence Day', 'date' => "{$startYear}-08-15"],
            ['name' => 'Mahatma Gandhi Jayanti', 'date' => "{$startYear}-10-02"],
            ['name' => 'Christmas Day', 'date' => "{$startYear}-12-25"],
            ['name' => 'New Year\'s Day', 'date' => "{$endYear}-01-01"],
            ['name' => 'Republic Day', 'date' => "{$endYear}-01-26"]
        ];

        $stmtHoliday = $pdo->prepare("
            INSERT INTO holidays (school_id, academic_year_id, name, date)
            VALUES (:school_id, :academic_year_id, :name, :date)
        ");
        foreach ($defaultHolidays as $h) {
            $stmtHoliday->execute([
                ':school_id' => $schoolId,
                ':academic_year_id' => $newYearId,
                ':name' => $h['name'],
                ':date' => $h['date']
            ]);
        }

        // 5. Create Default Timetable/Academic Settings
        $stmtSettings = $pdo->prepare("
            INSERT INTO school_timetable_settings (school_id, school_start_time, period_duration, interval_duration, interval_after_period, total_periods, start_date)
            VALUES (:school_id, '08:00:00', 40, 20, 4, 8, :start_date)
        ");
        $stmtSettings->execute([
            ':school_id' => $schoolId,
            ':start_date' => $startDate
        ]);

        // 6. Record Audit Log for School Initialization
        $stmtAudit = $pdo->prepare("
            INSERT INTO audit_logs (action, target_school, user, ip_address)
            VALUES (:action, :target_school, :user, :ip_address)
        ");
        $stmtAudit->execute([
            ':action' => "Initial Academic Year Automatically Created: " . $ayName,
            ':target_school' => (string)$schoolId,
            ':user' => $userEmail,
            ':ip_address' => '127.0.0.1'
        ]);

        return [
            'id' => $newYearId,
            'name' => $ayName,
            'status' => 'ACTIVE',
            'is_current' => 1
        ];
    }

    public function getAcademicYears(array $user): array
    {
        $pdo  = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Check if any academic years exist for this school
        $stmtCheck = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid LIMIT 1");
        $stmtCheck->execute([':sid' => $schoolId]);
        $hasYears = $stmtCheck->fetchColumn() !== false;

        if (!$hasYears) {
            // Automatically initialize the school's first academic year
            $pdo->beginTransaction();
            try {
                $this->initializeNewSchool($pdo, $schoolId, $user['email'] ?? 'admin');
                $pdo->commit();
            } catch (\Exception $e) {
                $pdo->rollBack();
                $this->log('Failed to automatically initialize school first academic year', [
                    'error' => $e->getMessage(),
                    'school_id' => $schoolId
                ]);
                throw $e;
            }
        }

        $stmt = $pdo->prepare(
            "SELECT * FROM academic_years WHERE school_id = :sid ORDER BY id DESC"
        );
        $stmt->execute([':sid' => $schoolId]);

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

        // Enforce maximum ONE Draft Academic Year
        $stmtCheckDraft = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE school_id = :sid AND status = 'Draft'");
        $stmtCheckDraft->execute([':sid' => $schoolId]);
        if ((int)$stmtCheckDraft->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'A Draft academic year already exists. Promote or delete it first.']);
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

        // Automatically prefill standard national holidays
        $defaultHolidays = [
            ['name' => 'Labour Day', 'date' => "{$startYear}-05-01"],
            ['name' => 'Independence Day', 'date' => "{$startYear}-08-15"],
            ['name' => 'Mahatma Gandhi Jayanti', 'date' => "{$startYear}-10-02"],
            ['name' => 'Christmas Day', 'date' => "{$startYear}-12-25"],
            ['name' => 'New Year\'s Day', 'date' => "{$endYear}-01-01"],
            ['name' => 'Republic Day', 'date' => "{$endYear}-01-26"]
        ];

        $stmtHoliday = $pdo->prepare("
            INSERT INTO holidays (school_id, academic_year_id, name, date)
            VALUES (:school_id, :academic_year_id, :name, :date)
        ");
        foreach ($defaultHolidays as $h) {
            $stmtHoliday->execute([
                ':school_id' => $schoolId,
                ':academic_year_id' => $newYearId,
                ':name' => $h['name'],
                ':date' => $h['date']
            ]);
        }

        $this->log('Academic year created as Draft with default national holidays', ['name' => $body['name'], 'school_id' => $schoolId]);
        return ['id' => $newYearId, 'name' => $body['name'], 'status' => 'Draft'];
    }

    public function migrateAcademicYear(array $user, int $currentYearId, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Fetch the source active academic year
        $stmtCurrent = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCurrent->execute([':id' => $currentYearId, ':sid' => $schoolId]);
        $currentYearObj = $stmtCurrent->fetch(PDO::FETCH_ASSOC);
        if (!$currentYearObj) {
            throw new NotFoundException('Active academic year not found.');
        }

        $prevYearId = (int)$currentYearId;
        $prevYear = $currentYearObj;

        // Fetch the DRAFT academic year for migration target
        $stmtDraft = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND status = 'Draft' LIMIT 1");
        $stmtDraft->execute([':sid' => $schoolId]);
        $draftYearObj = $stmtDraft->fetch(PDO::FETCH_ASSOC);
        if (!$draftYearObj) {
            throw new ValidationException(['migration' => 'No Draft Academic Year Found']);
        }
        $newYearId = (int)$draftYearObj['id'];
        $nextName = $draftYearObj['name'];
        $nextStartDate = $draftYearObj['start_date'];
        $nextEndDate = $draftYearObj['end_date'];

        $pdo->beginTransaction();
        try {
            $targetYear = $draftYearObj;

            // If there's a previous active academic year, run the promotion migration
            if ($prevYearId !== false) {
                $prevYearId = (int)$prevYearId;
                $stmtPrevYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
                $stmtPrevYear->execute([':id' => $prevYearId, ':sid' => $schoolId]);
                $prevYear = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);

                // 1. Fetch and copy active staff members to the new academic year
                $stmtStaffList = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :prev_id AND status = 'ACTIVE'");
                $stmtStaffList->execute([':sid' => $schoolId, ':prev_id' => $prevYearId]);
                $activeStaff = $stmtStaffList->fetchAll(PDO::FETCH_ASSOC);

                $stmtInsStaff = $pdo->prepare("
                    INSERT INTO staff (
                        school_id, name, employee_id, role, department, phone, email, status, 
                        salary, joining_date, photo_path, father_name, mother_name, emergency_phone,
                        exit_date, current_address_line, current_city, current_state, current_country,
                        current_pin_code, permanent_address_line, permanent_city, permanent_state,
                        permanent_country, permanent_pin_code, same_as_current, assigned_periods, max_periods,
                        academic_year_id
                    ) VALUES (
                        :school_id, :name, :employee_id, :role, :department, :phone, :email, 'ACTIVE',
                        :salary, :joining_date, :photo_path, :father_name, :mother_name, :emergency_phone,
                        :exit_date, :current_address_line, :current_city, :current_state, :current_country,
                        :current_pin_code, :permanent_address_line, :permanent_city, :permanent_state,
                        :permanent_country, :permanent_pin_code, :same_as_current, 0, :max_periods,
                        :academic_year_id
                    )
                ");

                foreach ($activeStaff as $as) {
                    $staffExists = false;
                    if (!empty($as['employee_id'])) {
                        $stmtCheckStaff = $pdo->prepare("SELECT COUNT(*) FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND employee_id = :emp_id");
                        $stmtCheckStaff->execute([':sid' => $schoolId, ':ayid' => $newYearId, ':emp_id' => $as['employee_id']]);
                        if ((int)$stmtCheckStaff->fetchColumn() > 0) {
                            $staffExists = true;
                        }
                    }
                    if (!$staffExists && !empty($as['email'])) {
                        $stmtCheckStaff = $pdo->prepare("SELECT COUNT(*) FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND email = :email");
                        $stmtCheckStaff->execute([':sid' => $schoolId, ':ayid' => $newYearId, ':email' => $as['email']]);
                        if ((int)$stmtCheckStaff->fetchColumn() > 0) {
                            $staffExists = true;
                        }
                    }
                    if ($staffExists) {
                        continue;
                    }

                    $stmtInsStaff->execute([
                        ':school_id'              => $schoolId,
                        ':name'                   => $as['name'],
                        ':employee_id'            => $as['employee_id'],
                        ':role'                   => $as['role'],
                        ':department'             => $as['department'],
                        ':phone'                  => $as['phone'],
                        ':email'                  => $as['email'],
                        ':salary'                 => $as['salary'],
                        ':joining_date'           => $as['joining_date'],
                        ':photo_path'             => $as['photo_path'],
                        ':father_name'            => $as['father_name'],
                        ':mother_name'            => $as['mother_name'],
                        ':emergency_phone'        => $as['emergency_phone'],
                        ':exit_date'              => $as['exit_date'],
                        ':current_address_line'   => $as['current_address_line'],
                        ':current_city'           => $as['current_city'],
                        ':current_state'          => $as['current_state'],
                        ':current_country'        => $as['current_country'],
                        ':current_pin_code'       => $as['current_pin_code'],
                        ':permanent_address_line' => $as['permanent_address_line'],
                        ':permanent_city'         => $as['permanent_city'],
                        ':permanent_state'        => $as['permanent_state'],
                        ':permanent_country'      => $as['permanent_country'],
                        ':permanent_pin_code'     => $as['permanent_pin_code'],
                        ':same_as_current'        => $as['same_as_current'],
                        ':max_periods'            => $as['max_periods'] ?? 8,
                        ':academic_year_id'       => $newYearId
                    ]);
                }

                // 2. Fetch all classes from previous academic year
                $stmtClasses = $pdo->prepare("SELECT * FROM classes WHERE school_id = :sid AND academic_year_id = :prev_id");
                $stmtClasses->execute([':sid' => $schoolId, ':prev_id' => $prevYearId]);
                $oldClasses = $stmtClasses->fetchAll(PDO::FETCH_ASSOC);

                // 3. Duplicate all classes into the new academic year, avoiding duplicates
                $classMap = []; // [old_class_id => new_class_id]
                $stmtFindClass = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid 
                      AND name = :name 
                      AND (section = :section OR (section IS NULL AND :section_null = 1))
                      AND (stream = :stream OR (stream IS NULL AND :stream_null = 1))
                    LIMIT 1
                ");
                $stmtInsClass = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:school_id, :name, :section, :stream, :new_ay_id)");
                foreach ($oldClasses as $oc) {
                    $stmtFindClass->execute([
                        ':sid' => $schoolId,
                        ':ayid' => $newYearId,
                        ':name' => $oc['name'],
                        ':section' => $oc['section'],
                        ':section_null' => $oc['section'] === null ? 1 : 0,
                        ':stream' => $oc['stream'],
                        ':stream_null' => $oc['stream'] === null ? 1 : 0
                    ]);
                    $existingClassId = $stmtFindClass->fetchColumn();
                    if ($existingClassId !== false) {
                        $classMap[(int)$oc['id']] = (int)$existingClassId;
                    } else {
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
                }

                // 4. Duplicate subjects to new classes (assigning teacher only if migrated)
                $subjectMap = []; // [old_subject_id => new_subject_id]
                $stmtSubjects = $pdo->prepare("SELECT * FROM subjects WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtSubjects->execute([':sid' => $schoolId]);
                $oldSubjects = $stmtSubjects->fetchAll(PDO::FETCH_ASSOC);

                $oldClassIds = array_keys($classMap);
                $teacherMigrations = $body['teacher_migrations'] ?? []; // Array of staff.id checked for migration

                $stmtFindSubject = $pdo->prepare("
                    SELECT id FROM subjects 
                    WHERE school_id = :sid 
                      AND class_id = :class_id 
                      AND name = :name
                    LIMIT 1
                ");
                $stmtInsSubj = $pdo->prepare("INSERT INTO subjects (school_id, name, code, class_id, teacher_id) VALUES (:school_id, :name, :code, :class_id, :teacher_id)");
                foreach ($oldSubjects as $os) {
                    $oldClassId = (int)$os['class_id'];
                    if (in_array($oldClassId, $oldClassIds, true)) {
                        $newClassId = $classMap[$oldClassId];

                        $teacherId = null;
                        if ($os['teacher_id'] !== null) {
                            // Find matching staff record by email and prev academic year
                            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :prev_ayid AND email = (SELECT email FROM users WHERE id = :uid LIMIT 1) LIMIT 1");
                            $stmtStaff->execute([':sid' => $schoolId, ':prev_ayid' => $prevYearId, ':uid' => $os['teacher_id']]);
                            $staffId = $stmtStaff->fetchColumn();
                            if ($staffId !== false && in_array((int)$staffId, $teacherMigrations, true)) {
                                $teacherId = $os['teacher_id'];
                            }
                        }

                        // Check if subject already exists
                        $stmtFindSubject->execute([
                            ':sid' => $schoolId,
                            ':class_id' => $newClassId,
                            ':name' => $os['name']
                        ]);
                        $existingSubjId = $stmtFindSubject->fetchColumn();
                        if ($existingSubjId !== false) {
                            $subjectMap[(int)$os['id']] = (int)$existingSubjId;
                        } else {
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
                }

                // 4. Duplicate timetable entries
                $stmtTimetable = $pdo->prepare("SELECT * FROM timetable WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtTimetable->execute([':sid' => $schoolId]);
                $oldTimetables = $stmtTimetable->fetchAll(PDO::FETCH_ASSOC);

                $stmtInsTimetable = $pdo->prepare("
                    INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date, is_published) 
                    VALUES (:school_id, :class_id, :subject_id, :teacher_id, :day_of_week, :period_number, :start_date, 0)
                ");
                foreach ($oldTimetables as $ot) {
                    $oldClassId = (int)$ot['class_id'];
                    if (in_array($oldClassId, $oldClassIds, true)) {
                        $newClassId = $classMap[$oldClassId];
                        $oldSubjId = (int)$ot['subject_id'];
                        $newSubjId = $subjectMap[$oldSubjId] ?? null;

                        $teacherId = null;
                        if ($ot['teacher_id'] !== null) {
                            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :prev_ayid AND email = (SELECT email FROM users WHERE id = :uid LIMIT 1) LIMIT 1");
                            $stmtStaff->execute([':sid' => $schoolId, ':prev_ayid' => $prevYearId, ':uid' => $ot['teacher_id']]);
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
                            ':period_number' => $ot['period_number'],
                            ':start_date' => $targetYear['start_date']
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
                $teachersMigratedCount = count($activeStaff);
                $studentsPromotedCount = 0;
                $studentsRepeatedCount = 0;
                $studentsGraduatedCount = 0;

                // 6. Promote / Repeat / Graduate students
                $studentMigrations = $body['student_migrations'] ?? [];

                $classOrder = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

                foreach ($studentMigrations as $sm) {
                    $studentId = (int)$sm['student_id'];
                    $action = $sm['action'];

                    $stmtStu = $pdo->prepare("SELECT s.class_id, s.name AS student_name, s.status, c.name, c.section FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = :id AND s.school_id = :sid LIMIT 1");
                    $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
                    $stuInfo = $stmtStu->fetch(PDO::FETCH_ASSOC);
                    if (!$stuInfo || ($stuInfo['status'] ?? 'ACTIVE') !== 'ACTIVE') continue;

                    $outstanding = 0.0;
                    $studentName = $stuInfo['student_name'] ?? 'Student';
                    
                    if ($action === 'promote' || $action === 'repeat') {
                        $outstanding = $this->getStudentOutstandingBalanceForYear($pdo, $studentId, $schoolId, $prevYearId);
                        
                        $newClassId = null;
                        if ($action === 'promote') {
                            $studentsPromotedCount++;
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
                        } elseif ($action === 'repeat') {
                            $studentsRepeatedCount++;
                            $currentClassName = $stuInfo['name'] ?? '';
                            $section = $stuInfo['section'];

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

                        // Duplicate student record (COPY)
                        $newStudentId = null;
                        $stmtSelectStu = $pdo->prepare("SELECT * FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
                        $stmtSelectStu->execute([':id' => $studentId, ':sid' => $schoolId]);
                        $oldStu = $stmtSelectStu->fetch(PDO::FETCH_ASSOC);
                        if ($oldStu) {
                            // Check if student with same admission number already exists in target academic year
                            $existingStudentId = false;
                            if (!empty($oldStu['admission_no'])) {
                                $stmtCheckExist = $pdo->prepare("
                                    SELECT id FROM students 
                                    WHERE school_id = :sid 
                                      AND academic_year_id = :ayid 
                                      AND admission_no = :admission_no
                                    LIMIT 1
                                ");
                                $stmtCheckExist->execute([
                                    ':sid' => $schoolId,
                                    ':ayid' => $newYearId,
                                    ':admission_no' => $oldStu['admission_no']
                                ]);
                                $existingStudentId = $stmtCheckExist->fetchColumn();
                            }
                            if ($existingStudentId === false) {
                                $stmtCheckExistName = $pdo->prepare("
                                    SELECT id FROM students 
                                    WHERE school_id = :sid 
                                      AND academic_year_id = :ayid 
                                      AND name = :name 
                                      AND COALESCE(father_name, '') = :father_name
                                    LIMIT 1
                                ");
                                $stmtCheckExistName->execute([
                                    ':sid' => $schoolId,
                                    ':ayid' => $newYearId,
                                    ':name' => $oldStu['name'],
                                    ':father_name' => $oldStu['father_name'] ?? ''
                                ]);
                                $existingStudentId = $stmtCheckExistName->fetchColumn();
                            }

                            if ($existingStudentId !== false) {
                                $newStudentId = (int)$existingStudentId;
                            } else {
                                unset($oldStu['id']);
                                unset($oldStu['created_at']);
                                unset($oldStu['updated_at']);

                                $oldStu['class_id'] = $newClassId;
                                $oldStu['academic_year_id'] = $newYearId;
                                $oldStu['status'] = 'ACTIVE';
                                $oldStu['roll_no'] = $newRollNo;

                                $cols = array_keys($oldStu);
                                $placeholders = array_map(fn($c) => ":{$c}", $cols);
                                $sqlInsert = "INSERT INTO students (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")";
                                
                                $stmtIns = $pdo->prepare($sqlInsert);
                                $stmtIns->execute($oldStu);
                                $newStudentId = (int)$pdo->lastInsertId();
                            }
                        }

                        if ($outstanding > 0 && $newStudentId !== null) {
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
                                    ':due_date' => date('Y-m-d')
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
                                ':student_id' => $newStudentId,
                                ':fee_type_id' => $typeId,
                                ':amount' => $outstanding
                            ]);
                            
                            // Log the audit trail
                            $logAction = "Migrated prev year dues: student ID {$newStudentId} (old ID {$studentId}), INR {$outstanding}, from AY {$prevYearId} to {$newYearId}";
                            
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
                    } elseif ($action === 'graduate_alumni') {
                        $studentsGraduatedCount++;
                        $stmtUpdateStudent = $pdo->prepare("UPDATE students SET status = :status WHERE id = :id AND school_id = :sid");
                        $stmtUpdateStudent->execute([
                            ':status' => 'Alumni',
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);
                    } elseif ($action === 'graduate_archive') {
                        $studentsGraduatedCount++;
                        $stmtUpdateStudent = $pdo->prepare("UPDATE students SET status = :status WHERE id = :id AND school_id = :sid");
                        $stmtUpdateStudent->execute([
                            ':status' => 'Archived',
                            ':id' => $studentId,
                            ':sid' => $schoolId
                        ]);
                    }
                }
            }

            if ($prevYearId !== false && $prevYearId !== null) {
                $stmtUpdatePrevStatus = $pdo->prepare("UPDATE academic_years SET status = 'Archived', migration_status = 'Completed', is_current = 0 WHERE id = :id");
                $stmtUpdatePrevStatus->execute([':id' => (int)$prevYearId]);

                // Automatically generate ONE Final Financial Report for the previous academic year
                try {
                    // Fetch previous year metadata
                    $stmtPrevYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmtPrevYear->execute([':id' => $prevYearId, ':sid' => $schoolId]);
                    $prevYearObj = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);

                    if ($prevYearObj) {
                        // Calculate suggested from_date (last report end date or start of previous year)
                        $stmtLatest = $pdo->prepare("
                            SELECT * FROM financial_reports 
                            WHERE school_id = :sid 
                              AND `from_date` >= :start_date 
                              AND `to_date` <= :end_date
                            ORDER BY id DESC LIMIT 1
                        ");
                        $stmtLatest->execute([
                            ':sid' => $schoolId,
                            ':start_date' => $prevYearObj['start_date'],
                            ':end_date' => $prevYearObj['end_date']
                        ]);
                        $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);

                        $from = $latestReport ? $latestReport['to_date'] : $prevYearObj['start_date'];
                        $to = date('Y-m-d');
                        if (strtotime($to) < strtotime($from)) {
                            $to = $from;
                        }

                        // Generate financial preview
                        $preview = $this->getFinancialPreview($user, $from, $to);

                        // Generate report ID (REP-XXX)
                        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM financial_reports WHERE school_id = :sid");
                        $stmtCount->execute([':sid' => $schoolId]);
                        $count = (int)$stmtCount->fetchColumn();
                        $reportId = 'REP-' . str_pad((string)($count + 1), 3, '0', STR_PAD_LEFT);

                        // Insert report with status 'Pending'
                        $stmtInsReport = $pdo->prepare("
                            INSERT INTO financial_reports (school_id, report_id, `from_date`, `to_date`, fees_collected, salary_paid, profit_loss, status)
                            VALUES (:sid, :report_id, :from_date, :to_date, :fees_collected, :salary_paid, :profit_loss, 'Pending')
                        ");
                        $stmtInsReport->execute([
                            ':sid' => $schoolId,
                            ':report_id' => $reportId,
                            ':from_date' => $from,
                            ':to_date' => $to,
                            ':fees_collected' => $preview['fees_collected'],
                            ':salary_paid' => $preview['salary_paid'],
                            ':profit_loss' => $preview['profit_loss']
                        ]);
                    }
                } catch (\Exception $reportEx) {
                    $this->log('Failed to automatically generate final financial report during rollover', [
                        'error' => $reportEx->getMessage(),
                        'school_id' => $schoolId,
                        'prev_year_id' => $prevYearId
                    ]);
                }
            }

            // Ensure no other academic year is current
            $stmtResetCurrent = $pdo->prepare("UPDATE academic_years SET is_current = 0 WHERE school_id = :sid");
            $stmtResetCurrent->execute([':sid' => $schoolId]);

            // Set the target academic year to ACTIVE and current active session
            $stmtUpdateNewStatus = $pdo->prepare("UPDATE academic_years SET is_current = 1, status = 'ACTIVE' WHERE id = :id AND school_id = :sid");
            $stmtUpdateNewStatus->execute([':id' => $newYearId, ':sid' => $schoolId]);

            // Record required audit entries
            $stmtAuditLog = $pdo->prepare("
                INSERT INTO audit_logs (action, target_school, user, ip_address)
                VALUES (:action, :target_school, :user, :ip_address)
            ");
            $auditUser = $user['email'] ?? 'admin';
            $auditIp = '127.0.0.1';

            // 1. Academic Year Archived
            $stmtAuditLog->execute([
                ':action' => "Academic Year Archived: " . $prevYear['name'],
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 2. New Academic Year Created
            $stmtAuditLog->execute([
                ':action' => "New Academic Year Created: " . $nextName,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 3. Teachers Migrated
            $stmtAuditLog->execute([
                ':action' => "Teachers Migrated: " . $teachersMigratedCount,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 4. Students Promoted
            $stmtAuditLog->execute([
                ':action' => "Students Promoted: " . $studentsPromotedCount,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 5. Students Repeated
            $stmtAuditLog->execute([
                ':action' => "Students Repeated: " . $studentsRepeatedCount,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 6. Graduated Students Archived
            $stmtAuditLog->execute([
                ':action' => "Graduated Students Archived: " . $studentsGraduatedCount,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // 7. User Automatically Switched to New Academic Year
            $stmtAuditLog->execute([
                ':action' => "User Automatically Switched to New Academic Year: " . $nextName,
                ':target_school' => (string)$schoolId,
                ':user' => $auditUser,
                ':ip_address' => $auditIp
            ]);

            // Set session working academic year
            $_SESSION['working_academic_year_id'] = $newYearId;

            $pdo->commit();
            $this->log('Academic year rollover migration executed', ['id' => $newYearId, 'school_id' => $schoolId]);
            return ['id' => $newYearId, 'status' => 'ACTIVE', 'migrated' => true];

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
            WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id
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

        $stmtAddPending = $pdo->prepare("
            SELECT COALESCE(SUM(afp.amount), 0)
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id
              AND afp.school_id = :school_id
              AND afp.status = 'Pending'
              AND aft.academic_year_id = :academic_year_id
        ");
        $stmtAddPending->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId
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

        // Find the currently active academic year
        $stmtPrev = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
        $stmtPrev->execute([':sid' => $schoolId]);
        $prevYear = $stmtPrev->fetch(PDO::FETCH_ASSOC);

        if ($prevYear && $targetYear['status'] === 'Draft') {
            if (($prevYear['migration_status'] ?? 'Not Started') !== 'Completed') {
                throw new ValidationException([
                    'migration' => "The current Academic Year's records have not yet been migrated to the selected Academic Year. Please complete the Academic Year Migration process before activating this Academic Year. Migration ensures that teachers, students, class promotions, and all required academic records are carried forward correctly."
                ]);
            }
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

        // Boundary date validation (between active academic year start_date and today)
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear !== null) {
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

    public function getTimetable(array $user, ?int $classId = null, ?string $date = null): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if ($classId && $date) {
            $dt = new \DateTime($date);
            $dayOfWeekNum = (int)$dt->format('N');
            $mondayDt = clone $dt;
            if ($dayOfWeekNum > 1) {
                $mondayDt->modify('-' . ($dayOfWeekNum - 1) . ' days');
            }
            
            $stmt = $pdo->prepare("
                SELECT t.*, c.name AS class_name, s.name AS subject_name, st.name AS teacher_name, st.photo_path AS teacher_photo_path
                FROM timetable t
                LEFT JOIN classes  c ON t.class_id   = c.id
                LEFT JOIN subjects s ON t.subject_id  = s.id
                LEFT JOIN staff    st ON t.teacher_id  = st.id
                WHERE t.school_id = :sid AND t.class_id = :cid
            ");
            $stmt->execute([
                ':sid' => $schoolId,
                ':cid' => $classId
            ]);
            $entries = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            
            $resolved = [];
            $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            
            foreach ($days as $idx => $dayName) {
                $dayDate = (clone $mondayDt)->modify('+' . $idx . ' days')->format('Y-m-d');
                
                $dayEntries = [];
                foreach ($entries as $t) {
                    if ($t['day_of_week'] === $dayName) {
                        // Skip if the requested weekday's date is before the timetable start date
                        if ($dayDate < $t['start_date']) {
                            continue;
                        }
                        // Skip if the requested weekday's date is after the timetable end date
                        if ($t['end_date'] !== null && $dayDate > $t['end_date']) {
                            continue;
                        }

                        $stmtBackup = $pdo->prepare("
                            SELECT b.id AS backup_id, b.backup_teacher_id, st.name AS backup_teacher_name
                            FROM timetable_backups b
                            JOIN staff st ON b.backup_teacher_id = st.id
                            WHERE b.timetable_id = :tid AND b.date = :date
                        ");
                        $stmtBackup->execute([
                            ':tid' => $t['id'],
                            ':date' => $dayDate
                        ]);
                        $backup = $stmtBackup->fetch(\PDO::FETCH_ASSOC);
                        
                        $t['day_date'] = $dayDate;
                        if ($backup) {
                            $t['backup_teacher_id'] = (int)$backup['backup_teacher_id'];
                            $t['backup_teacher_name'] = $backup['backup_teacher_name'];
                            $t['is_backup'] = true;
                        } else {
                            $t['backup_teacher_id'] = null;
                            $t['backup_teacher_name'] = null;
                            $t['is_backup'] = false;
                        }
                        
                        $dayEntries[] = $t;
                    }
                }
                
                $resolved[$dayName] = [
                    'date' => $dayDate,
                    'day' => $dayName,
                    'periods' => $dayEntries
                ];
            }
            
            return $resolved;
        }

        $stmt = $pdo->prepare("
            SELECT t.*, c.name AS class_name, s.name AS subject_name, st.name AS teacher_name
            FROM timetable t
            LEFT JOIN classes  c ON t.class_id   = c.id
            LEFT JOIN subjects s ON t.subject_id  = s.id
            LEFT JOIN staff    st ON t.teacher_id  = st.id
            WHERE t.school_id = :sid AND t.end_date IS NULL
            ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
                     t.period_number
        ");
        $stmt->execute([':sid' => $schoolId]);
        $entries = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // If date is provided, resolve backups for each weekday's date
        if ($date) {
            try {
                $dt = new \DateTime($date);
                $dayOfWeekNum = (int)$dt->format('N');
                $mondayDt = clone $dt;
                if ($dayOfWeekNum > 1) {
                    $mondayDt->modify('-' . ($dayOfWeekNum - 1) . ' days');
                }

                // Map day of week name to date
                $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                $dayDates = [];
                foreach ($days as $idx => $dayName) {
                    $dayDates[$dayName] = (clone $mondayDt)->modify('+' . $idx . ' days')->format('Y-m-d');
                }

                $filteredEntries = [];
                foreach ($entries as $t) {
                    $dayName = $t['day_of_week'];
                    $dayDate = $dayDates[$dayName] ?? null;
                    if ($dayDate) {
                        // Skip if the requested weekday's date is before the timetable start date
                        if ($dayDate < $t['start_date']) {
                            continue;
                        }
                        // Skip if the requested weekday's date is after the timetable end date
                        if ($t['end_date'] !== null && $dayDate > $t['end_date']) {
                            continue;
                        }

                        $stmtBackup = $pdo->prepare("
                            SELECT b.backup_teacher_id, st.name AS backup_teacher_name
                            FROM timetable_backups b
                            JOIN staff st ON b.backup_teacher_id = st.id
                            WHERE b.timetable_id = :tid AND b.date = :date
                        ");
                        $stmtBackup->execute([
                            ':tid' => $t['id'],
                            ':date' => $dayDate
                        ]);
                        $backup = $stmtBackup->fetch(\PDO::FETCH_ASSOC);
                        if ($backup) {
                            $t['backup_teacher_id'] = (int)$backup['backup_teacher_id'];
                            $t['backup_teacher_name'] = $backup['backup_teacher_name'];
                            $t['is_backup'] = true;
                            $t['active_teacher_id'] = (int)$backup['backup_teacher_id'];
                        } else {
                            $t['active_teacher_id'] = (int)$t['teacher_id'];
                            $t['is_backup'] = false;
                        }
                    } else {
                        $t['active_teacher_id'] = (int)$t['teacher_id'];
                        $t['is_backup'] = false;
                    }
                    $filteredEntries[] = $t;
                }
                $entries = $filteredEntries;
            } catch (\Exception $e) {
                foreach ($entries as &$t) {
                    $t['active_teacher_id'] = (int)$t['teacher_id'];
                    $t['is_backup'] = false;
                }
            }
        } else {
            foreach ($entries as &$t) {
                $t['active_teacher_id'] = (int)$t['teacher_id'];
                $t['is_backup'] = false;
            }
        }
        
        return $entries;
    }

    public function addTimetablePeriod(array $user, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        
        if (empty($data['class_id']) || empty($data['subject_id']) || empty($data['teacher_id']) || empty($data['day_of_week']) || empty($data['period_number'])) {
            throw new ValidationException(['fields' => 'All fields (class, subject, teacher, day, period number) are required.']);
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $startDate = $data['start_date'] ?? ($workingYear ? $workingYear['start_date'] : date('Y-m-d'));

        $stmtTeacherCheck = $pdo->prepare("
            SELECT t.id, c.name AS class_name FROM timetable t
            JOIN classes c ON t.class_id = c.id
            WHERE t.teacher_id = :tid 
              AND t.day_of_week = :day 
              AND t.period_number = :pnum
              AND t.start_date <= :start_date1
              AND (t.end_date IS NULL OR t.end_date >= :start_date2)
        ");
        $stmtTeacherCheck->execute([
            ':tid' => $data['teacher_id'],
            ':day' => $data['day_of_week'],
            ':pnum' => $data['period_number'],
            ':start_date1' => $startDate,
            ':start_date2' => $startDate
        ]);
        $teacherConflict = $stmtTeacherCheck->fetch(\PDO::FETCH_ASSOC);
        if ($teacherConflict) {
            throw new ValidationException(['teacher_id' => "Conflict: This teacher is already assigned to {$teacherConflict['class_name']} for Period {$data['period_number']} on {$data['day_of_week']}."]);
        }

        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM timetable 
            WHERE teacher_id = :tid AND school_id = :sid AND day_of_week = :day AND end_date IS NULL
        ");
        $stmtCount->execute([':tid' => $data['teacher_id'], ':sid' => $schoolId, ':day' => $data['day_of_week']]);
        $assigned = (int)$stmtCount->fetchColumn();
        
        $stmtMax = $pdo->prepare("SELECT max_periods, status FROM staff WHERE id = :tid AND school_id = :sid");
        $stmtMax->execute([':tid' => $data['teacher_id'], ':sid' => $schoolId]);
        $staffInfo = $stmtMax->fetch(\PDO::FETCH_ASSOC);
        if (!$staffInfo) {
            throw new ValidationException(['teacher_id' => 'Teacher profile not found']);
        }
        if ($staffInfo['status'] !== 'ACTIVE') {
            throw new ValidationException(['teacher_id' => 'Teacher profile is inactive']);
        }
        $max = (int)$staffInfo['max_periods'];
        if ($assigned >= $max) {
            throw new ValidationException(['teacher_id' => "This teacher has reached their maximum workload limit of {$max} periods."]);
        }

        // End any existing active timetable entry for this class, day, and period
        $stmtFindClassActive = $pdo->prepare("
            SELECT id, start_date FROM timetable 
            WHERE class_id = :cid AND day_of_week = :day AND period_number = :pnum AND end_date IS NULL
        ");
        $stmtFindClassActive->execute([
            ':cid' => $data['class_id'],
            ':day' => $data['day_of_week'],
            ':pnum' => $data['period_number']
        ]);
        $existingClassActive = $stmtFindClassActive->fetch(\PDO::FETCH_ASSOC);
        
        if ($existingClassActive) {
            if ($existingClassActive['start_date'] < $startDate) {
                // End the older entry
                $dt = new \DateTime($startDate);
                $dt->modify('-1 day');
                $endDate = $dt->format('Y-m-d');
                
                $stmtEndOld = $pdo->prepare("UPDATE timetable SET end_date = :end_date WHERE id = :id");
                $stmtEndOld->execute([':end_date' => $endDate, ':id' => $existingClassActive['id']]);
                
                // Clear backups for the old entry on or after start_date
                $stmtDelBackupOld = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id AND date >= :date");
                $stmtDelBackupOld->execute([':id' => $existingClassActive['id'], ':date' => $startDate]);
            } else {
                // Delete the newer duplicate completely
                $stmtDelBackupOld = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id");
                $stmtDelBackupOld->execute([':id' => $existingClassActive['id']]);
                
                $stmtDelOld = $pdo->prepare("DELETE FROM timetable WHERE id = :id");
                $stmtDelOld->execute([':id' => $existingClassActive['id']]);
            }
        }

        $stmtInsert = $pdo->prepare("
            INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date)
            VALUES (:sid, :cid, :subid, :tid, :day, :pnum, :start_date)
        ");
        $stmtInsert->execute([
            ':sid' => $schoolId,
            ':cid' => $data['class_id'],
            ':subid' => $data['subject_id'],
            ':tid' => $data['teacher_id'],
            ':day' => $data['day_of_week'],
            ':pnum' => $data['period_number'],
            ':start_date' => $startDate
        ]);
        $newId = (int)$pdo->lastInsertId();
        
        $this->syncTeacherAssignedPeriods($pdo, (int)$data['teacher_id'], $schoolId);
        
        return ['id' => $newId];
    }

    public function deleteTimetablePeriod(array $user, int $id, ?string $date = null): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        
        $stmtEntry = $pdo->prepare("SELECT * FROM timetable WHERE id = :id AND school_id = :sid");
        $stmtEntry->execute([':id' => $id, ':sid' => $schoolId]);
        $entry = $stmtEntry->fetch(\PDO::FETCH_ASSOC);
        if (!$entry) {
            throw new NotFoundException('Timetable period not found');
        }
        
        if ($date !== null && $entry['start_date'] < $date) {
            // The timetable entry was effective in the past. End it today.
            $dt = new \DateTime($date);
            $dt->modify('-1 day');
            $endDate = $dt->format('Y-m-d');
            
            $stmtUpdate = $pdo->prepare("UPDATE timetable SET end_date = :end_date WHERE id = :id");
            $stmtUpdate->execute([':end_date' => $endDate, ':id' => $id]);
            
            // Clean up backups that are on or after the deletion date
            $stmtDelBackup = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id AND date >= :date");
            $stmtDelBackup->execute([':id' => $id, ':date' => $date]);
        } else {
            // The entry was created today or in the future, or no date was provided. Deleting it completely is correct.
            $stmtDelBackup = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id");
            $stmtDelBackup->execute([':id' => $id]);
            
            $stmtDel = $pdo->prepare("DELETE FROM timetable WHERE id = :id");
            $stmtDel->execute([':id' => $id]);
        }

        // Auto-draft all other periods of this class on this weekday
        $stmtMarkDraft = $pdo->prepare("
            UPDATE timetable 
            SET is_published = 0 
            WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid
        ");
        $stmtMarkDraft->execute([
            ':cid' => $entry['class_id'],
            ':day' => $entry['day_of_week'],
            ':sid' => $schoolId
        ]);
        
        $this->syncTeacherAssignedPeriods($pdo, (int)$entry['teacher_id'], $schoolId);
    }

    public function assignBackupTeacher(array $user, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if (empty($data['timetable_id']) || empty($data['date']) || empty($data['backup_teacher_id'])) {
            throw new ValidationException(['fields' => 'All fields (timetable ID, date, backup teacher) are required.']);
        }

        if ($this->isPastWeek($data['date'])) {
            throw new ValidationException(['date' => 'Past weeks are locked and cannot be edited.']);
        }

        $stmtEntry = $pdo->prepare("SELECT * FROM timetable WHERE id = :id AND school_id = :sid");
        $stmtEntry->execute([':id' => $data['timetable_id'], ':sid' => $schoolId]);
        $entry = $stmtEntry->fetch(\PDO::FETCH_ASSOC);
        if (!$entry) {
            throw new NotFoundException('Timetable period not found');
        }

        if ((int)$entry['teacher_id'] === (int)$data['backup_teacher_id']) {
            throw new ValidationException(['backup_teacher_id' => 'The backup teacher cannot be the same as the main teacher.']);
        }

        $dayOfWeek = (new \DateTime($data['date']))->format('l');
        $stmtConflict = $pdo->prepare("
            SELECT t.id, c.name AS class_name FROM timetable t
            JOIN classes c ON t.class_id = c.id
            WHERE t.teacher_id = :tid AND t.day_of_week = :day AND t.period_number = :pnum
              AND t.id != :timetable_id
        ");
        $stmtConflict->execute([
            ':tid' => $data['backup_teacher_id'],
            ':day' => $dayOfWeek,
            ':pnum' => $entry['period_number'],
            ':timetable_id' => $entry['id']
        ]);
        $conflict = $stmtConflict->fetch(\PDO::FETCH_ASSOC);
        if ($conflict) {
            throw new ValidationException(['backup_teacher_id' => "Conflict: This teacher is already assigned to {$conflict['class_name']} for Period {$entry['period_number']} on {$dayOfWeek}."]);
        }

        $stmtBackupConflict = $pdo->prepare("
            SELECT b.id, c.name AS class_name FROM timetable_backups b
            JOIN timetable t ON b.timetable_id = t.id
            JOIN classes c ON t.class_id = c.id
            WHERE b.backup_teacher_id = :tid AND b.date = :date AND t.period_number = :pnum
              AND b.timetable_id != :timetable_id
        ");
        $stmtBackupConflict->execute([
            ':tid' => $data['backup_teacher_id'],
            ':date' => $data['date'],
            ':pnum' => $entry['period_number'],
            ':timetable_id' => $entry['id']
        ]);
        $backupConflict = $stmtBackupConflict->fetch(\PDO::FETCH_ASSOC);
        if ($backupConflict) {
            throw new ValidationException(['backup_teacher_id' => "Conflict: This teacher is already assigned as a backup to {$backupConflict['class_name']} for Period {$entry['period_number']} on this date."]);
        }

        $stmtMax = $pdo->prepare("SELECT status FROM staff WHERE id = :tid AND school_id = :sid");
        $stmtMax->execute([':tid' => $data['backup_teacher_id'], ':sid' => $schoolId]);
        $status = $stmtMax->fetchColumn();
        if ($status !== 'ACTIVE') {
            throw new ValidationException(['backup_teacher_id' => 'Backup teacher profile is inactive']);
        }

        $stmtUpsert = $pdo->prepare("
            INSERT INTO timetable_backups (school_id, timetable_id, date, backup_teacher_id)
            VALUES (:sid, :tid, :date, :backup_tid1)
            ON DUPLICATE KEY UPDATE backup_teacher_id = :backup_tid2
        ");
        $stmtUpsert->execute([
            ':sid' => $schoolId,
            ':tid' => $data['timetable_id'],
            ':date' => $data['date'],
            ':backup_tid1' => $data['backup_teacher_id'],
            ':backup_tid2' => $data['backup_teacher_id']
        ]);

        // Auto-draft all periods of this class on this weekday
        $stmtMarkDraft = $pdo->prepare("
            UPDATE timetable 
            SET is_published = 0 
            WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid
        ");
        $stmtMarkDraft->execute([
            ':cid' => $entry['class_id'],
            ':day' => $entry['day_of_week'],
            ':sid' => $schoolId
        ]);

        return ['success' => true];
    }

    public function replaceTeacher(array $user, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if (empty($data['timetable_id']) || empty($data['date']) || empty($data['new_teacher_id'])) {
            throw new ValidationException(['fields' => 'All fields (timetable ID, date, new teacher) are required.']);
        }

        $stmtEntry = $pdo->prepare("SELECT * FROM timetable WHERE id = :id AND school_id = :sid");
        $stmtEntry->execute([':id' => $data['timetable_id'], ':sid' => $schoolId]);
        $entry = $stmtEntry->fetch(\PDO::FETCH_ASSOC);
        if (!$entry) {
            throw new NotFoundException('Timetable period not found');
        }

        if ((int)$entry['teacher_id'] === (int)$data['new_teacher_id']) {
            throw new ValidationException(['new_teacher_id' => 'The new teacher cannot be the same as the current teacher.']);
        }

        $dayOfWeek = $entry['day_of_week'];
        $periodNumber = $entry['period_number'];

        $stmtConflict = $pdo->prepare("
            SELECT t.id, c.name AS class_name FROM timetable t
            JOIN classes c ON t.class_id = c.id
            WHERE t.teacher_id = :tid AND t.day_of_week = :day AND t.period_number = :pnum
              AND t.id != :timetable_id
        ");
        $stmtConflict->execute([
            ':tid' => $data['new_teacher_id'],
            ':day' => $dayOfWeek,
            ':pnum' => $periodNumber,
            ':timetable_id' => $entry['id']
        ]);
        $conflict = $stmtConflict->fetch(\PDO::FETCH_ASSOC);
        if ($conflict) {
            throw new ValidationException(['new_teacher_id' => "Conflict: The new teacher is already assigned to {$conflict['class_name']} for Period {$periodNumber} on {$dayOfWeek}."]);
        }

        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM timetable 
            WHERE teacher_id = :tid AND school_id = :sid AND day_of_week = :day AND end_date IS NULL
        ");
        $stmtCount->execute([':tid' => $data['new_teacher_id'], ':sid' => $schoolId, ':day' => $dayOfWeek]);
        $assigned = (int)$stmtCount->fetchColumn();
        
        $stmtMax = $pdo->prepare("SELECT max_periods, status FROM staff WHERE id = :tid AND school_id = :sid");
        $stmtMax->execute([':tid' => $data['new_teacher_id'], ':sid' => $schoolId]);
        $staffInfo = $stmtMax->fetch(\PDO::FETCH_ASSOC);
        if (!$staffInfo) {
            throw new ValidationException(['new_teacher_id' => 'Teacher profile not found']);
        }
        if ($staffInfo['status'] !== 'ACTIVE') {
            throw new ValidationException(['new_teacher_id' => 'Teacher profile is inactive']);
        }
        $max = (int)$staffInfo['max_periods'];
        if ($assigned >= $max) {
            throw new ValidationException(['new_teacher_id' => "This teacher has reached their maximum workload limit of {$max} periods."]);
        }

        $replaceDate = $data['date'];
        
        $pdo->beginTransaction();
        try {
            if ($entry['start_date'] < $replaceDate) {
                // End the current entry
                $dt = new \DateTime($replaceDate);
                $dt->modify('-1 day');
                $endDate = $dt->format('Y-m-d');
                
                $stmtUpdateOld = $pdo->prepare("UPDATE timetable SET end_date = :end_date WHERE id = :id");
                $stmtUpdateOld->execute([':end_date' => $endDate, ':id' => $entry['id']]);
                
                // Clear backups for the old entry that are on or after the replacement date
                $stmtDelBackupOld = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id AND date >= :date");
                $stmtDelBackupOld->execute([':id' => $entry['id'], ':date' => $replaceDate]);
                
                // Insert a new entry starting on the replacement date
                $stmtInsertNew = $pdo->prepare("
                    INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date, is_published)
                    VALUES (:sid, :cid, :subid, :tid, :day, :pnum, :start_date, :is_published)
                ");
                $stmtInsertNew->execute([
                    ':sid' => $schoolId,
                    ':cid' => $entry['class_id'],
                    ':subid' => $entry['subject_id'],
                    ':tid' => $data['new_teacher_id'],
                    ':day' => $entry['day_of_week'],
                    ':pnum' => $entry['period_number'],
                    ':start_date' => $replaceDate,
                    ':is_published' => $entry['is_published']
                ]);
            } else {
                // The entry was created on or after the replacement date (no historical dates). Update it directly.
                $stmtUpdate = $pdo->prepare("UPDATE timetable SET teacher_id = :new_tid WHERE id = :id");
                $stmtUpdate->execute([':new_tid' => $data['new_teacher_id'], ':id' => $entry['id']]);
                
                // Clear backups for this timetable period
                $stmtDelBackup = $pdo->prepare("DELETE FROM timetable_backups WHERE timetable_id = :id");
                $stmtDelBackup->execute([':id' => $entry['id']]);
            }
            
            // Auto-draft all periods of this class on this weekday
            $stmtMarkDraft = $pdo->prepare("
                UPDATE timetable 
                SET is_published = 0 
                WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid
            ");
            $stmtMarkDraft->execute([
                ':cid' => $entry['class_id'],
                ':day' => $entry['day_of_week'],
                ':sid' => $schoolId
            ]);
            
            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $this->syncTeacherAssignedPeriods($pdo, (int)$entry['teacher_id'], $schoolId);
        $this->syncTeacherAssignedPeriods($pdo, (int)$data['new_teacher_id'], $schoolId);

        return ['success' => true];
    }

    public function publishTimetable(array $user, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if (empty($data['class_id'])) {
            throw new ValidationException(['fields' => 'Class ID is required to publish.']);
        }

        $dayOfWeek = $data['day_of_week'] ?? null;
        if ($dayOfWeek) {
            $stmtPublish = $pdo->prepare("
                UPDATE timetable 
                SET is_published = 1
                WHERE school_id = :sid AND class_id = :cid AND day_of_week = :day
            ");
            $stmtPublish->execute([
                ':sid' => $schoolId,
                ':cid' => $data['class_id'],
                ':day' => $dayOfWeek
            ]);
        } else {
            $stmtPublish = $pdo->prepare("
                UPDATE timetable 
                SET is_published = 1
                WHERE school_id = :sid AND class_id = :cid
            ");
            $stmtPublish->execute([
                ':sid' => $schoolId,
                ':cid' => $data['class_id']
            ]);
        }
    }

    public function getSubjects(array $user, ?int $classId = null): array
    {
        $pdo  = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        if ($classId) {
            $stmt = $pdo->prepare("
                SELECT s.*, c.name AS class_name, st.name AS teacher_name
                FROM subjects s
                LEFT JOIN classes c ON s.class_id   = c.id
                LEFT JOIN staff   st ON s.teacher_id = st.id
                WHERE s.school_id = :sid AND s.class_id = :cid
                ORDER BY s.id DESC
            ");
            $stmt->execute([':sid' => $schoolId, ':cid' => $classId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT s.*, c.name AS class_name, st.name AS teacher_name
                FROM subjects s
                LEFT JOIN classes c ON s.class_id   = c.id
                LEFT JOIN staff   st ON s.teacher_id = st.id
                WHERE s.school_id = :sid
                ORDER BY s.id DESC
            ");
            $stmt->execute([':sid' => $schoolId]);
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function createSubject(array $user, array $data): array
    {
        $name = isset($data['name']) ? trim($data['name']) : '';
        if (empty($name)) {
            throw new ValidationException(['name' => 'Subject name is required']);
        }
        
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $classId = !empty($data['class_id']) ? (int)$data['class_id'] : null;

        // Case-insensitive duplicate check within the class
        if ($classId) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM subjects 
                WHERE school_id = :sid AND LOWER(name) = LOWER(:name) AND class_id = :cid
            ");
            $stmtCheck->execute([':sid' => $schoolId, ':name' => $name, ':cid' => $classId]);
        } else {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM subjects 
                WHERE school_id = :sid AND LOWER(name) = LOWER(:name) AND class_id IS NULL
            ");
            $stmtCheck->execute([':sid' => $schoolId, ':name' => $name]);
        }

        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'This subject already exists for this class.']);
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO subjects (school_id, name, class_id, teacher_id)
            VALUES (:sid, :name, :cid, :tid)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':name' => $name,
            ':cid' => $classId,
            ':tid' => !empty($data['teacher_id']) ? $data['teacher_id'] : null
        ]);
        return ['id' => (int)$pdo->lastInsertId()];
    }

    public function updateSubject(array $user, int $id, array $data): array
    {
        $name = isset($data['name']) ? trim($data['name']) : '';
        if (empty($name)) {
            throw new ValidationException(['name' => 'Subject name is required']);
        }
        
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $classId = !empty($data['class_id']) ? (int)$data['class_id'] : null;

        // Case-insensitive duplicate check excluding self within the class
        if ($classId) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM subjects 
                WHERE school_id = :sid AND LOWER(name) = LOWER(:name) AND class_id = :cid AND id != :id
            ");
            $stmtCheck->execute([':sid' => $schoolId, ':name' => $name, ':cid' => $classId, ':id' => $id]);
        } else {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM subjects 
                WHERE school_id = :sid AND LOWER(name) = LOWER(:name) AND class_id IS NULL AND id != :id
            ");
            $stmtCheck->execute([':sid' => $schoolId, ':name' => $name, ':id' => $id]);
        }

        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'This subject already exists for this class.']);
        }
        
        $stmt = $pdo->prepare("
            UPDATE subjects 
            SET name = :name, class_id = :cid, teacher_id = :tid
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([
            ':name' => $name,
            ':cid' => $classId,
            ':tid' => !empty($data['teacher_id']) ? $data['teacher_id'] : null,
            ':id' => $id,
            ':sid' => $schoolId
        ]);
        return ['success' => true];
    }

    public function deleteSubject(array $user, int $id): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Existing timetable safety check
        $stmtCheck = $pdo->prepare("
            SELECT COUNT(*) FROM timetable 
            WHERE subject_id = :id AND school_id = :sid
        ");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException([
                'subject' => 'This subject is currently assigned in one or more timetable periods. Please remove those assignments before deleting the subject.'
            ]);
        }

        $stmt = $pdo->prepare("DELETE FROM subjects WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
    }

    public function getPeriodConfigurations(array $user, ?string $date = null): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmt = $pdo->prepare("
            SELECT * FROM period_configurations 
            WHERE school_id = :sid AND end_date IS NULL
            ORDER BY period_number ASC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        
        // Fallback: If empty, get the latest configurations created for this school
        if (empty($rows)) {
            $stmtLatest = $pdo->prepare("
                SELECT * FROM period_configurations 
                WHERE school_id = :sid1 AND start_date = (
                    SELECT MAX(start_date) FROM period_configurations WHERE school_id = :sid2
                )
                ORDER BY period_number ASC
            ");
            $stmtLatest->execute([':sid1' => $schoolId, ':sid2' => $schoolId]);
            $rows = $stmtLatest->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        }

        return $rows;
    }

    public function getTimetableSettings(array $user): ?array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmt = $pdo->prepare("
            SELECT * FROM school_timetable_settings 
            WHERE school_id = :sid AND end_date IS NULL
            LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        
        if ($row === false) {
            $stmtLatest = $pdo->prepare("
                SELECT * FROM school_timetable_settings 
                WHERE school_id = :sid 
                ORDER BY start_date DESC, id DESC 
                LIMIT 1
            ");
            $stmtLatest->execute([':sid' => $schoolId]);
            $row = $stmtLatest->fetch(\PDO::FETCH_ASSOC);
        }
        
        return $row !== false ? $row : null;
    }

    public function saveTimetableSettings(array $user, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // 1. Validations
        if (empty($data['school_start_time'])) {
            throw new ValidationException(['school_start_time' => 'School start time is required.']);
        }
        $periodDuration = isset($data['period_duration']) ? (int)$data['period_duration'] : 0;
        if ($periodDuration <= 0) {
            throw new ValidationException(['period_duration' => 'Period duration must be greater than 0.']);
        }
        $intervalDuration = isset($data['interval_duration']) ? (int)$data['interval_duration'] : 0;
        if ($intervalDuration < 0) {
            throw new ValidationException(['interval_duration' => 'Interval duration must be 0 or greater.']);
        }
        $totalPeriods = isset($data['total_periods']) ? (int)$data['total_periods'] : 0;
        if ($totalPeriods <= 0) {
            throw new ValidationException(['total_periods' => 'Total periods must be greater than 0.']);
        }
        $intervalAfter = isset($data['interval_after_period']) ? (int)$data['interval_after_period'] : 0;
        if ($intervalAfter < 1 || $intervalAfter > $totalPeriods) {
            throw new ValidationException(['interval_after_period' => "Interval break must be placed between Period 1 and Period {$totalPeriods}."]);
        }

        $today = !empty($data['date']) ? $data['date'] : date('Y-m-d');
        $yesterday = date('Y-m-d', strtotime($today . ' -1 day'));

        $currentSettings = $this->getTimetableSettings($user);
        $totalPeriodsChanged = $currentSettings && ((int)$currentSettings['total_periods'] !== $totalPeriods);
        $clearTimetable = $totalPeriodsChanged || !empty($data['clear_timetable']);

        $pdo->beginTransaction();
        try {
            if ($clearTimetable) {
                $stmtClearBackups = $pdo->prepare("DELETE FROM timetable_backups WHERE school_id = :sid");
                $stmtClearBackups->execute([':sid' => $schoolId]);

                $stmtClearTimetable = $pdo->prepare("DELETE FROM timetable WHERE school_id = :sid");
                $stmtClearTimetable->execute([':sid' => $schoolId]);

                $stmtResetStaff = $pdo->prepare("UPDATE staff SET assigned_periods = 0 WHERE school_id = :sid");
                $stmtResetStaff->execute([':sid' => $schoolId]);
            }

            // End current settings
            $stmtEndSetting = $pdo->prepare("
                UPDATE school_timetable_settings 
                SET end_date = :yesterday 
                WHERE school_id = :sid AND end_date IS NULL
            ");
            $stmtEndSetting->execute([':yesterday' => $yesterday, ':sid' => $schoolId]);

            // End current period configs
            $stmtEndConfigs = $pdo->prepare("
                UPDATE period_configurations 
                SET end_date = :yesterday 
                WHERE school_id = :sid AND end_date IS NULL
            ");
            $stmtEndConfigs->execute([':yesterday' => $yesterday, ':sid' => $schoolId]);

            // Insert new settings record
            $stmtInsSetting = $pdo->prepare("
                INSERT INTO school_timetable_settings (school_id, school_start_time, period_duration, interval_duration, interval_after_period, total_periods, start_date)
                VALUES (:sid, :start_time, :period_dur, :interval_dur, :interval_after, :total_p, :start_date)
            ");
            $stmtInsSetting->execute([
                ':sid' => $schoolId,
                ':start_time' => $data['school_start_time'],
                ':period_dur' => $periodDuration,
                ':interval_dur' => $intervalDuration,
                ':interval_after' => $intervalAfter,
                ':total_p' => $totalPeriods,
                ':start_date' => $today
            ]);

            // Calculate and insert period timings
            $startTime = strtotime($data['school_start_time']);
            $currentTime = $startTime;

            $stmtInsPeriod = $pdo->prepare("
                INSERT INTO period_configurations (school_id, period_number, start_time, end_time, start_date)
                VALUES (:sid, :pnum, :start_time, :end_time, :start_date)
            ");

            for ($i = 1; $i <= $totalPeriods; $i++) {
                $pStart = date('H:i:s', $currentTime);
                $currentTime += $periodDuration * 60;
                $pEnd = date('H:i:s', $currentTime);

                $stmtInsPeriod->execute([
                    ':sid' => $schoolId,
                    ':pnum' => $i,
                    ':start_time' => $pStart,
                    ':end_time' => $pEnd,
                    ':start_date' => $today
                ]);

                // Apply interval break after specified period number
                if ($i === $intervalAfter && $intervalDuration > 0) {
                    $currentTime += $intervalDuration * 60;
                }
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    private function syncTeacherAssignedPeriods(\PDO $pdo, int $teacherId, int $schoolId): void
    {
        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM timetable 
            WHERE teacher_id = :tid AND school_id = :sid AND end_date IS NULL
        ");
        $stmtCount->execute([':tid' => $teacherId, ':sid' => $schoolId]);
        $count = (int)$stmtCount->fetchColumn();
        
        $stmtUpdate = $pdo->prepare("
            UPDATE staff SET assigned_periods = :count 
            WHERE id = :tid AND school_id = :sid
        ");
        $stmtUpdate->execute([':count' => $count, ':tid' => $teacherId, ':sid' => $schoolId]);
    }

    private function isPastWeek(string $date): bool
    {
        $dt = new \DateTime($date);
        $dayOfWeekNum = (int)$dt->format('N');
        $sundayDt = clone $dt;
        if ($dayOfWeekNum < 7) {
            $sundayDt->modify('+' . (7 - $dayOfWeekNum) . ' days');
        }
        $sundayStr = $sundayDt->format('Y-m-d');
        $todayStr = (new \DateTime())->format('Y-m-d');
        return $sundayStr < $todayStr;
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

        if ($this->isStudentPromoted($pdo, $studentId, $schoolId)) {
            throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
        }

        // 2. Fetch fee structure for this class (or fallback)
        $feeStructureId = null;
        $amountPaid = 0.0; // Default fallback
        if ($classId !== null) {
            $stmtFee = $pdo->prepare("SELECT id, amount FROM fee_structures WHERE school_id = :school_id AND class_id = :class_id LIMIT 1");
            $stmtFee->execute([':school_id' => $schoolId, ':class_id' => $classId]);
            $feeRow = $stmtFee->fetch(PDO::FETCH_ASSOC);
            if ($feeRow) {
                $feeStructureId = (int)$feeRow['id'];
                $amountPaid = (float)$feeRow['amount'];
            }
        }

        // Fetch class fee config
        $classFeeConfig = null;
        if ($classId !== null && $academicYearId !== null) {
            $stmtCfg = $pdo->prepare("
                SELECT monthly_fees FROM class_fee_configurations 
                WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id
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

        if (empty($school['report_card_remark'])) {
            $school['report_card_remark'] = 'Congratulations! The student has passed all examinations and demonstrated excellent understanding.';
        }

        // Fetch active subscription details
        $stmtSub = $pdo->prepare("
            SELECT plan_name, start_date, expiry_date, duration_value, duration_unit 
            FROM subscriptions 
            WHERE school_id = :school_id AND status = 'PAID'
            ORDER BY expiry_date DESC, id DESC
            LIMIT 1
        ");
        $stmtSub->execute([':school_id' => $schoolId]);
        $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);

        if ($sub) {
            $school['active_plan'] = $sub['plan_name'];
            $school['subscription_expiry'] = $sub['expiry_date'];
            $school['subscription_start'] = $sub['start_date'];
            $school['subscription_duration_value'] = $sub['duration_value'];
            $school['subscription_duration_unit'] = $sub['duration_unit'];
        } else {
            $school['active_plan'] = null;
            $school['subscription_expiry'] = null;
            $school['subscription_start'] = null;
            $school['subscription_duration_value'] = null;
            $school['subscription_duration_unit'] = null;
        }

        return $school;
    }

    public function getActivePlans(): array
    {
        $pdo = $this->classRepo->getPdo();
        $stmt = $pdo->query("SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC");
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function checkSubscriptionExpired(array $user): bool
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT expiry_date 
            FROM subscriptions 
            WHERE school_id = :school_id AND status = 'PAID'
            ORDER BY expiry_date DESC, id DESC
            LIMIT 1
        ");
        $stmt->execute([':school_id' => $schoolId]);
        $expiry = $stmt->fetchColumn();

        if (!$expiry) {
            return true;
        }

        return strtotime($expiry) < strtotime(date('Y-m-d'));
    }

    public function getSubscriptionHistory(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT plan_name, created_at, expiry_date, duration_value, duration_unit, amount, status, features
            FROM subscriptions
            WHERE school_id = :school_id
            ORDER BY id DESC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function updateSchoolProfile(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $currentProfile = $this->getSchoolProfile($user);

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
                classes_offered = :classes_offered,
                report_card_remark = :report_card_remark
            WHERE id = :id
        ");

        $stmt->execute([
            ':name'                  => $data['name'] ?? $currentProfile['name'],
            ':contact_phone'         => array_key_exists('contact_phone', $data) ? $data['contact_phone'] : $currentProfile['contact_phone'],
            ':contact_email'         => array_key_exists('contact_email', $data) ? $data['contact_email'] : $currentProfile['contact_email'],
            ':registration_no'       => array_key_exists('registration_no', $data) ? $data['registration_no'] : $currentProfile['registration_no'],
            ':affiliation_board'     => array_key_exists('affiliation_board', $data) ? $data['affiliation_board'] : $currentProfile['affiliation_board'],
            ':school_type'           => array_key_exists('school_type', $data) ? $data['school_type'] : $currentProfile['school_type'],
            ':founded_year'          => array_key_exists('founded_year', $data) ? $data['founded_year'] : $currentProfile['founded_year'],
            ':medium_of_instruction' => array_key_exists('medium_of_instruction', $data) ? $data['medium_of_instruction'] : $currentProfile['medium_of_instruction'],
            ':street_address'        => array_key_exists('street_address', $data) ? $data['street_address'] : $currentProfile['street_address'],
            ':city'                  => array_key_exists('city', $data) ? $data['city'] : $currentProfile['city'],
            ':state'                 => array_key_exists('state', $data) ? $data['state'] : $currentProfile['state'],
            ':pin_code'              => array_key_exists('pin_code', $data) ? $data['pin_code'] : $currentProfile['pin_code'],
            ':current_term'          => array_key_exists('current_term', $data) ? $data['current_term'] : $currentProfile['current_term'],
            ':term_start'            => array_key_exists('term_start', $data) ? $data['term_start'] : $currentProfile['term_start'],
            ':term_end'              => array_key_exists('term_end', $data) ? $data['term_end'] : $currentProfile['term_end'],
            ':classes_offered'       => array_key_exists('classes_offered', $data) ? $data['classes_offered'] : $currentProfile['classes_offered'],
            ':report_card_remark'    => array_key_exists('report_card_remark', $data) ? $data['report_card_remark'] : $currentProfile['report_card_remark'],
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
        $stmt = $pdo->prepare("SELECT id, receipt_no, student_id, fee_month, academic_year_id, payment_date, created_at FROM fee_payments WHERE id = :id AND school_id = :school_id LIMIT 1");
        $stmt->execute([':id' => $id, ':school_id' => $schoolId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new NotFoundException('Fee payment not found');
        }

        $studentId = (int)$row['student_id'];
        $receiptNo = $row['receipt_no'];
        $academicYearId = $row['academic_year_id'] !== null ? (int)$row['academic_year_id'] : 0;

        // 1. Target year writable check
        $stmtPayYear = $pdo->prepare("SELECT status FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtPayYear->execute([':id' => $academicYearId, ':sid' => $schoolId]);
        $payYearStatus = $stmtPayYear->fetchColumn();
        if ($payYearStatus === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }

        // 1.5. Report lock check
        if ($this->isTransactionInReport($pdo, $schoolId, $row['created_at'])) {
            throw new ValidationException(['locked' => 'This payment has already been included in a generated Financial Report and can no longer be reverted.']);
        }

        // 2. Outstanding migration lock check
        $stmtGetInfo = $pdo->prepare("
            SELECT s.academic_year_id AS student_ay_id, s.status AS student_status
            FROM students s
            WHERE s.id = :student_id AND s.school_id = :sid
            LIMIT 1
        ");
        $stmtGetInfo->execute([':student_id' => $studentId, ':sid' => $schoolId]);
        $info = $stmtGetInfo->fetch(PDO::FETCH_ASSOC);
        if ($info) {
            $studentAyId = $info['student_ay_id'] !== null ? (int)$info['student_ay_id'] : 0;
            if ($info['student_status'] === 'ACTIVE' && $studentAyId > $academicYearId) {
                throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
            }
        }

        // 3. Chronological sequence check
        if (!empty($receiptNo)) {
            $stmtTx = $pdo->prepare("SELECT fee_month FROM fee_payments WHERE receipt_no = :receipt_no AND school_id = :school_id");
            $stmtTx->execute([':receipt_no' => $receiptNo, ':school_id' => $schoolId]);
            $revertedMonths = $stmtTx->fetchAll(PDO::FETCH_COLUMN);
        } else {
            $revertedMonths = [$row['fee_month']];
        }

        // Fetch all paid months for this student in this academic year
        $stmtPaid = $pdo->prepare("SELECT fee_month FROM fee_payments WHERE student_id = :student_id AND status = 'PAID' AND academic_year_id = :academic_year_id");
        $stmtPaid->execute([':student_id' => $studentId, ':academic_year_id' => $academicYearId]);
        $alreadyPaid = $stmtPaid->fetchAll(PDO::FETCH_COLUMN);

        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        $maxRevertedIdx = -1;
        foreach ($revertedMonths as $rm) {
            $idx = array_search($rm, $academicMonths, true);
            if ($idx !== false && $idx > $maxRevertedIdx) {
                $maxRevertedIdx = $idx;
            }
        }

        foreach ($alreadyPaid as $ap) {
            if (!in_array($ap, $revertedMonths, true)) {
                $idx = array_search($ap, $academicMonths, true);
                if ($idx !== false && $idx > $maxRevertedIdx) {
                    throw new ValidationException(['months' => "Cannot revert this payment because later month's fee has already been paid."]);
                }
            }
        }

        // 4. Perform deletion
        if (!empty($receiptNo)) {
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
                throw new ValidationException(['monthly_fees' => 'Monthly fee must be greater than ₹0.']);
            }

            $val = isset($monthlyFees[$m]) ? $monthlyFees[$m] : null;
            if ($mode === 'DIFFERENT' && ($val === null || $val === '')) {
                throw new ValidationException(['monthly_fees' => 'Please enter fee for every month.']);
            }

            if ($val !== null && $val !== '') {
                $valFloat = (float)$val;
                if ($valFloat <= 0) {
                    throw new ValidationException(['monthly_fees' => 'Monthly fee must be greater than ₹0.']);
                }
            }
        }

        // Fetch existing configuration if any
        $stmtCheck = $pdo->prepare("SELECT * FROM class_fee_configurations WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :academic_year_id LIMIT 1");
        $stmtCheck->execute([
            ':school_id' => $schoolId,
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId
        ]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        // Compute currentMonthIdx relative to the active Academic Year
        $stmtYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtYear->execute([':id' => $academicYearId, ':sid' => $schoolId]);
        $ay = $stmtYear->fetch(PDO::FETCH_ASSOC);
        
        $currentMonthIdx = -1; // Default: future academic year
        if ($ay) {
            $now = new \DateTime();
            $start = new \DateTime($ay['start_date']);
            $end = new \DateTime($ay['end_date']);
            
            if ($now < $start) {
                $currentMonthIdx = -1;
            } elseif ($now > $end) {
                $currentMonthIdx = 11; // past academic year
            } else {
                $currentMonthName = $now->format('F');
                $idx = array_search($currentMonthName, $academicMonths, true);
                if ($idx !== false) {
                    $currentMonthIdx = $idx;
                } else {
                    $currentMonthIdx = 2; // fallback to June
                }
            }
        }

        if ($existing) {
            $mergedMonthlyFees = [];
            foreach ($academicMonths as $m) {
                $mergedMonthlyFees[$m] = isset($monthlyFees[$m]) ? (float)$monthlyFees[$m] : 0.0;
            }
            $jsonFees = json_encode($mergedMonthlyFees);
            $monthlyFees = $mergedMonthlyFees;

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
            $jsonFees = json_encode($monthlyFees);
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
            'is_locked' => $existing ? (int)$existing['is_locked'] : 0
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

    private function getMonthsDueUpToCurrent(string $startDateStr, string $endDateStr, string $status = 'ACTIVE'): array
    {
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        
        if ($status === 'Archived') {
            return $academicMonths;
        }

        try {
            $now = new \DateTime();
            $startDate = new \DateTime($startDateStr);
            $endDate = new \DateTime($endDateStr);
            
            if ($now > $endDate) {
                return $academicMonths;
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
        $payYearId = $academicYearId;

        if ($workingYear['status'] === 'Archived') {
            if ($this->isStaffMigrated($pdo, $staffId, $schoolId)) {
                throw new ValidationException(['month' => 'This teacher has been migrated/copied to the next academic year. Salary cannot be disbursed from the archived academic year.']);
            }

            // Non-migrated teacher: record in current active year
            $stmtCurr = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmtCurr->execute([':sid' => $schoolId]);
            $currYear = $stmtCurr->fetch(PDO::FETCH_ASSOC);
            if (!$currYear) {
                throw new ValidationException(['month' => 'No current active academic year found for recording this previous year salary expense.']);
            }
            $payYearId = (int)$currYear['id'];
        } else {
            $this->requireWritableAcademicYear($pdo, $schoolId);
        }

        // Prevent duplicate payments
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM staff_payments 
            WHERE school_id = :sid AND staff_id = :staff_id AND academic_year_id = :ayid AND payment_month = :month
        ");
        $stmtDup->execute([
            ':sid' => $schoolId,
            ':staff_id' => $staffId,
            ':ayid' => $payYearId,
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
                WHERE school_id = :sid AND staff_id = :staff_id AND (academic_year_id = :ayid OR academic_year_id = :selected_ayid)
            ");
            $stmtPaid->execute([
                ':sid' => $schoolId,
                ':staff_id' => $staffId,
                ':ayid' => $payYearId,
                ':selected_ayid' => $academicYearId
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
            ':ayid' => $payYearId,
            ':amount_paid' => $salary,
            ':month' => $month,
            ':payment_date' => $paymentDate
        ]);

        return ['success' => true, 'id' => (int)$pdo->lastInsertId()];
    }

    public function disbursePreviousYearStaffSalary(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $staffId = (int)($data['staff_id'] ?? 0);
        $months = $data['months'] ?? [];

        if ($staffId <= 0 || empty($months) || !is_array($months)) {
            throw new ValidationException(['message' => 'Staff ID and Months list are required.']);
        }

        // 1. Get current active academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['message' => 'No active or draft academic year found.']);
        }
        if ($workingYear['status'] === 'Archived') {
            throw new ValidationException(['message' => 'Cannot disburse salary under an Archived academic year. Please switch to the current year.']);
        }
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // Fetch staff member
        $staff = $this->staffRepo->findById($staffId);
        if (!$staff || (int)$staff['school_id'] !== $schoolId) {
            throw new NotFoundException('Staff member not found.');
        }

        // 2. Find immediately previous academic year
        $stmtPrevYear = $pdo->prepare("
            SELECT * FROM academic_years 
            WHERE school_id = :sid AND start_date < :curr_start_date 
            ORDER BY start_date DESC LIMIT 1
        ");
        $stmtPrevYear->execute([':sid' => $schoolId, ':curr_start_date' => $workingYear['start_date']]);
        $prevYear = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);
        if (!$prevYear) {
            throw new ValidationException(['message' => 'No previous academic year found.']);
        }

        // Find matching staff record in previous year
        $oldStaff = null;
        if (!empty($staff['employee_id'])) {
            $stmtOld = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND employee_id = :emp_id LIMIT 1");
            $stmtOld->execute([':sid' => $schoolId, ':ayid' => $prevYear['id'], ':emp_id' => $staff['employee_id']]);
            $oldStaff = $stmtOld->fetch(PDO::FETCH_ASSOC);
        } else if (!empty($staff['email'])) {
            $stmtOld = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND email = :email LIMIT 1");
            $stmtOld->execute([':sid' => $schoolId, ':ayid' => $prevYear['id'], ':email' => $staff['email']]);
            $oldStaff = $stmtOld->fetch(PDO::FETCH_ASSOC);
        }

        if (!$oldStaff) {
            throw new ValidationException(['message' => 'No matching teacher profile found in the previous academic year.']);
        }

        // Fetch already paid months in previous year
        $stmtOldPaid = $pdo->prepare("
            SELECT payment_month FROM staff_payments 
            WHERE staff_id = :sid AND academic_year_id = :ayid
        ");
        $stmtOldPaid->execute([':sid' => $oldStaff['id'], ':ayid' => $prevYear['id']]);
        $oldPaidMonths = $stmtOldPaid->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Fetch paid previous-year months in current year
        $stmtCurrOldPaid = $pdo->prepare("
            SELECT payment_month FROM staff_payments 
            WHERE staff_id = :sid AND academic_year_id = :ayid AND payment_month LIKE 'Previous Year - %'
        ");
        $stmtCurrOldPaid->execute([':sid' => $staffId, ':ayid' => $workingYear['id']]);
        $currOldPaid = $stmtCurrOldPaid->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Extract individual month names
        $resolvedCurrOldPaid = [];
        foreach ($currOldPaid as $cop) {
            $parts = explode('Previous Year - ', $cop);
            if (count($parts) > 1) {
                $monthsStr = trim($parts[1]);
                $subMonths = array_map('trim', explode(',', $monthsStr));
                foreach ($subMonths as $sm) {
                    $rangeParts = preg_split('/[-–]/', $sm);
                    if (count($rangeParts) > 1) {
                        $allMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                        $startIdx = array_search(trim($rangeParts[0]), $allMonths);
                        $endIdx = array_search(trim($rangeParts[1]), $allMonths);
                        if ($startIdx !== false && $endIdx !== false) {
                            for ($i = $startIdx; $i <= $endIdx; $i++) {
                                $resolvedCurrOldPaid[] = $allMonths[$i];
                            }
                        }
                    } else {
                        $resolvedCurrOldPaid[] = $sm;
                    }
                }
            }
        }

        // Validate that requested months are not already paid
        foreach ($months as $m) {
            if (in_array($m, $oldPaidMonths, true) || in_array($m, $resolvedCurrOldPaid, true)) {
                throw new ValidationException(['months' => "Salary for {$m} has already been paid."]);
            }
        }

        // Format month range string
        $allMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        usort($months, function($a, $b) use ($allMonths) {
            return array_search($a, $allMonths) <=> array_search($b, $allMonths);
        });

        $groups = [];
        $currentGroup = [];
        foreach ($months as $m) {
            $idx = array_search($m, $allMonths);
            if (empty($currentGroup)) {
                $currentGroup[] = ['name' => $m, 'idx' => $idx];
            } else {
                $last = end($currentGroup);
                if ($idx === $last['idx'] + 1) {
                    $currentGroup[] = ['name' => $m, 'idx' => $idx];
                } else {
                    $groups[] = $currentGroup;
                    $currentGroup = [['name' => $m, 'idx' => $idx]];
                }
            }
        }
        if (!empty($currentGroup)) {
            $groups[] = $currentGroup;
        }

        $resultParts = [];
        foreach ($groups as $g) {
            if (count($g) === 1) {
                $resultParts[] = $g[0]['name'];
            } else {
                $resultParts[] = $g[0]['name'] . '–' . end($g)['name'];
            }
        }
        $monthsString = implode(', ', $resultParts);

        $salary = (float)($oldStaff['salary'] ?? 0.0);
        $totalPaid = $salary * count($months);
        $paymentDate = date('Y-m-d');

        // Insert staff payment
        $stmt = $pdo->prepare("
            INSERT INTO staff_payments (school_id, staff_id, academic_year_id, amount_paid, payment_month, payment_date)
            VALUES (:sid, :staff_id, :ayid, :amount_paid, :month, :payment_date)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':staff_id' => $staffId,
            ':ayid' => $workingYear['id'],
            ':amount_paid' => $totalPaid,
            ':month' => 'Previous Year - ' . $monthsString,
            ':payment_date' => $paymentDate
        ]);

        return ['success' => true, 'id' => (int)$pdo->lastInsertId()];
    }

    public function revertStaffSalary(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        // Fetch payment details first
        $stmtPayment = $pdo->prepare("SELECT * FROM staff_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtPayment->execute([':id' => $id, ':sid' => $schoolId]);
        $payment = $stmtPayment->fetch(PDO::FETCH_ASSOC);

        if (!$payment) {
            throw new NotFoundException('Salary payment record not found.');
        }

        // Validate that target year is writable
        $stmtPayYear = $pdo->prepare("SELECT status FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtPayYear->execute([':id' => (int)$payment['academic_year_id'], ':sid' => $schoolId]);
        $payYearStatus = $stmtPayYear->fetchColumn();
        if ($payYearStatus === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }

        // Check if the payment date falls within any generated financial report
        if ($this->isTransactionInReport($pdo, $schoolId, $payment['created_at'])) {
            throw new ValidationException(['locked' => 'This payment has already been included in a generated Financial Report and can no longer be reverted.']);
        }

        // Verify and delete payout
        $stmtDel = $pdo->prepare("DELETE FROM staff_payments WHERE id = :id AND school_id = :sid");
        $stmtDel->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function getFinancialPreview(array $user, string $from = '', string $to = ''): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$workingYear) {
            return [
                'from_date' => date('Y-m-d'),
                'to_date' => date('Y-m-d'),
                'fees_collected' => 0.0,
                'salary_paid' => 0.0,
                'profit_loss' => 0.0
            ];
        }

        $latestReport = null;
        $stmtLatest = $pdo->prepare("
            SELECT * FROM financial_reports 
            WHERE school_id = :sid 
              AND `from_date` >= :start_date 
              AND `to_date` <= :end_date
            ORDER BY id DESC LIMIT 1
        ");
        $stmtLatest->execute([
            ':sid' => $schoolId,
            ':start_date' => $workingYear['start_date'],
            ':end_date' => $workingYear['end_date']
        ]);
        $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);

        $latestReportCreatedAt = $latestReport ? $latestReport['created_at'] : null;

        if (empty($from)) {
            $from = $latestReport ? $latestReport['to_date'] : $workingYear['start_date'];
        }
        if (empty($to)) {
            $to = date('Y-m-d');
        }

        // 1. Total Student Tuition Fees Collected
        if ($latestReportCreatedAt) {
            $stmtFees = $pdo->prepare("
                SELECT COALESCE(SUM(fp.amount_paid), 0) 
                FROM fee_payments fp
                LEFT JOIN students s ON fp.student_id = s.id
                WHERE fp.school_id = :sid AND fp.status = 'PAID'
                  AND (
                    fp.academic_year_id = :ayid
                    OR (
                      fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                      AND fp.academic_year_id != :ayid_3
                      AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                    )
                  )
                  AND fp.created_at > :latest_rep_ts
            ");
            $stmtFees->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':ayid_2' => $workingYear['id'],
                ':ayid_3' => $workingYear['id'],
                ':latest_rep_ts' => $latestReportCreatedAt
            ]);
        } else {
            $stmtFees = $pdo->prepare("
                SELECT COALESCE(SUM(fp.amount_paid), 0) 
                FROM fee_payments fp
                LEFT JOIN students s ON fp.student_id = s.id
                WHERE fp.school_id = :sid AND fp.status = 'PAID'
                  AND (
                    fp.academic_year_id = :ayid
                    OR (
                      fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                      AND fp.academic_year_id != :ayid_3
                      AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                    )
                  )
            ");
            $stmtFees->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':ayid_2' => $workingYear['id'],
                ':ayid_3' => $workingYear['id']
            ]);
        }
        $tuitionCollected = (float)$stmtFees->fetchColumn();

        // 2. Total Additional Paid Fees
        if ($latestReportCreatedAt) {
            $stmtAddFees = $pdo->prepare("
                SELECT COALESCE(SUM(afp.amount), 0) 
                FROM additional_fee_payments afp
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                LEFT JOIN students s ON afp.student_id = s.id
                WHERE afp.school_id = :sid 
                  AND afp.status = 'Paid' 
                  AND (
                    aft.academic_year_id = :ayid
                    OR (
                      afp.updated_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                      AND aft.academic_year_id != :ayid_3
                      AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                    )
                  )
                  AND afp.updated_at > :latest_rep_ts
            ");
            $stmtAddFees->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':ayid_2' => $workingYear['id'],
                ':ayid_3' => $workingYear['id'],
                ':latest_rep_ts' => $latestReportCreatedAt
            ]);
        } else {
            $stmtAddFees = $pdo->prepare("
                SELECT COALESCE(SUM(afp.amount), 0) 
                FROM additional_fee_payments afp
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                LEFT JOIN students s ON afp.student_id = s.id
                WHERE afp.school_id = :sid 
                  AND afp.status = 'Paid' 
                  AND (
                    aft.academic_year_id = :ayid
                    OR (
                      afp.updated_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                      AND aft.academic_year_id != :ayid_3
                      AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                    )
                  )
            ");
            $stmtAddFees->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':ayid_2' => $workingYear['id'],
                ':ayid_3' => $workingYear['id']
            ]);
        }
        $addFeesCollected = (float)$stmtAddFees->fetchColumn();

        $totalFees = $tuitionCollected + $addFeesCollected;

        // 3. Total Teacher Salaries Paid
        if ($latestReportCreatedAt) {
            $stmtSalaries = $pdo->prepare("
                SELECT COALESCE(SUM(amount_paid), 0) 
                FROM staff_payments 
                WHERE school_id = :sid 
                  AND academic_year_id = :ayid 
                  AND created_at > :latest_rep_ts
            ");
            $stmtSalaries->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':latest_rep_ts' => $latestReportCreatedAt
            ]);
        } else {
            $stmtSalaries = $pdo->prepare("
                SELECT COALESCE(SUM(amount_paid), 0) 
                FROM staff_payments 
                WHERE school_id = :sid 
                  AND academic_year_id = :ayid
            ");
            $stmtSalaries->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id']
            ]);
        }
        $salariesPaid = (float)$stmtSalaries->fetchColumn();

        // 4. Total School Expenses Logged
        if ($latestReportCreatedAt) {
            $stmtExpenses = $pdo->prepare("
                SELECT COALESCE(SUM(amount), 0) 
                FROM school_expenses 
                WHERE school_id = :sid 
                  AND academic_year_id = :ayid 
                  AND created_at > :latest_rep_ts
            ");
            $stmtExpenses->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id'],
                ':latest_rep_ts' => $latestReportCreatedAt
            ]);
        } else {
            $stmtExpenses = $pdo->prepare("
                SELECT COALESCE(SUM(amount), 0) 
                FROM school_expenses 
                WHERE school_id = :sid 
                  AND academic_year_id = :ayid
            ");
            $stmtExpenses->execute([
                ':sid' => $schoolId,
                ':ayid' => $workingYear['id']
            ]);
        }
        $expensesPaid = (float)$stmtExpenses->fetchColumn();

        $totalExpenses = $salariesPaid + $expensesPaid;
        $profitLoss = $totalFees - $totalExpenses;

        return [
            'from_date' => $from,
            'to_date' => $to,
            'fees_collected' => $totalFees,
            'salary_paid' => $totalExpenses,
            'profit_loss' => $profitLoss
        ];
    }

    public function getFinancialReports(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        // 1. Fetch generated reports (filtered by selected Academic Year)
        if ($workingYear) {
            $stmt = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND `from_date` >= :start_date 
                  AND `to_date` <= :end_date
                ORDER BY id DESC
            ");
            $stmt->execute([
                ':sid' => $schoolId,
                ':start_date' => $workingYear['start_date'],
                ':end_date' => $workingYear['end_date']
            ]);
        } else {
            $stmt = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                ORDER BY id DESC
            ");
            $stmt->execute([':sid' => $schoolId]);
        }
        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
        $latestReport = null;
        if ($workingYear) {
            $stmtLatest = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND `from_date` >= :start_date 
                  AND `to_date` <= :end_date
                ORDER BY id DESC LIMIT 1
            ");
            $stmtLatest->execute([
                ':sid' => $schoolId,
                ':start_date' => $workingYear['start_date'],
                ':end_date' => $workingYear['end_date']
            ]);
            $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);
        }

        if ($latestReport) {
            $suggestedStartDate = $latestReport['to_date'];
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

        if ($report['status'] === 'Settled') {
            throw new ValidationException(['fields' => 'A settled report must never be editable or re-submittable.']);
        }

        $status = $data['status'] ?? 'Pending';
        if (!in_array($status, ['Pending', 'Request Sent', 'Settled'])) {
            throw new ValidationException(['status' => 'Invalid status value.']);
        }

        $this->financialReportRepo->update($id, [
            'status' => $status
        ]);

        return $this->financialReportRepo->findById($id);
    }

    public function submitSettlementRequest(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();

        $report = $this->financialReportRepo->findById($id);
        if ($report === null || (int)$report['school_id'] !== $schoolId) {
            throw new NotFoundException('Financial report not found.');
        }

        if ($report['status'] === 'Settled') {
            throw new ValidationException(['fields' => 'A settled report must never be editable or re-submittable.']);
        }

        if ($report['status'] === 'Request Sent') {
            throw new ValidationException(['fields' => 'A settlement request has already been submitted for this report.']);
        }

        // Fetch school contact details
        $stmtSchool = $pdo->prepare("SELECT name, contact_email FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC);
        if (!$school) {
            throw new NotFoundException('School not found.');
        }

        // Retrieve academic year info
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        // Retrieve bounds of transactions contributing to this report
        list($from_ts, $operator, $to_ts) = $this->getReportBounds($pdo, $schoolId, $report);

        // Fetch Student Fee Collections
        $stmtFeeList = $pdo->prepare("
            SELECT 
                fp.created_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                'Tuition Fee' AS fee_type, 
                fp.fee_month AS months_covered, 
                fp.amount_paid AS amount,
                fp.academic_year_id
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE fp.school_id = :sid 
              AND fp.status = 'PAID'
              AND fp.created_at {$operator} :from_ts 
              AND fp.created_at <= :to_ts
        ");
        $stmtFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $feePayments = $stmtFeeList->fetchAll(PDO::FETCH_ASSOC);

        $stmtAddFeeList = $pdo->prepare("
            SELECT 
                afp.updated_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                aft.name AS fee_type, 
                'N/A' AS months_covered, 
                afp.amount,
                aft.academic_year_id
            FROM additional_fee_payments afp
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.school_id = :sid 
              AND afp.status = 'Paid'
              AND afp.updated_at {$operator} :from_ts 
              AND afp.updated_at <= :to_ts
        ");
        $stmtAddFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $addPayments = $stmtAddFeeList->fetchAll(PDO::FETCH_ASSOC);

        // Format previous year dues descriptions
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;
        $stmtAYNames = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid");
        $stmtAYNames->execute([':sid' => $schoolId]);
        $ayNames = $stmtAYNames->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        foreach ($feePayments as &$fp) {
            $payAYId = isset($fp['academic_year_id']) ? (int)$fp['academic_year_id'] : 0;
            if ($workingYearId && $payAYId && $payAYId !== $workingYearId) {
                $ayName = $ayNames[$payAYId] ?? '';
                $fp['fee_type'] = "Previous Year Dues – " . $fp['student_name'] . " – AY " . $ayName;
            }
            unset($fp['academic_year_id']);
        }
        unset($fp);

        foreach ($addPayments as &$ap) {
            $payAYId = isset($ap['academic_year_id']) ? (int)$ap['academic_year_id'] : 0;
            if ($workingYearId && $payAYId && $payAYId !== $workingYearId) {
                $ayName = $ayNames[$payAYId] ?? '';
                $ap['fee_type'] = "Previous Year Dues – " . $ap['student_name'] . " – AY " . $ayName;
            }
            unset($ap['academic_year_id']);
        }
        unset($ap);

        $feeCollections = array_merge($feePayments, $addPayments);
        
        // Sort by class creation order, then deposit time, then name
        usort($feeCollections, function($a, $b) {
            $classIdA = isset($a['class_id']) ? (int)$a['class_id'] : 999999;
            $classIdB = isset($b['class_id']) ? (int)$b['class_id'] : 999999;
            if ($classIdA !== $classIdB) {
                return $classIdA <=> $classIdB;
            }
            $timeA = strtotime($a['deposit_time'] ?? '1970-01-01 00:00:00');
            $timeB = strtotime($b['deposit_time'] ?? '1970-01-01 00:00:00');
            if ($timeA !== $timeB) {
                return $timeA <=> $timeB;
            }
            return strcmp($a['student_name'] ?? '', $b['student_name'] ?? '');
        });

        $stmtSalaryList = $pdo->prepare("
            SELECT sp.payment_month, sp.academic_year_id, st.name AS staff_name, sp.payment_date AS expense_date, sp.amount_paid AS amount, 'Salary Payment' AS category
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            WHERE sp.school_id = :sid 
              AND sp.created_at {$operator} :from_ts 
              AND sp.created_at <= :to_ts
        ");
        $stmtSalaryList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $salaryPaymentsRaw = $stmtSalaryList->fetchAll(PDO::FETCH_ASSOC);

        $salaryPayments = [];
        foreach ($salaryPaymentsRaw as $spr) {
            $salaryPayments[] = [
                'description' => $this->getSalaryPaymentDescription($pdo, $schoolId, $spr, $spr['staff_name']),
                'category' => $spr['category'],
                'expense_date' => $spr['expense_date'],
                'amount' => $spr['amount']
            ];
        }

        $stmtExpenseList = $pdo->prepare("
            SELECT description, 'School Expense' AS category, expense_date, amount
            FROM school_expenses
            WHERE school_id = :sid 
              AND created_at {$operator} :from_ts 
              AND created_at <= :to_ts
        ");
        $stmtExpenseList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $expensesItems = $stmtExpenseList->fetchAll(PDO::FETCH_ASSOC);

        $expenses = array_merge($salaryPayments, $expensesItems);
        usort($expenses, function($a, $b) {
            return strcmp($a['expense_date'] ?? '', $b['expense_date'] ?? '');
        });

        // Profit / Loss Summary
        $summary = [
            'revenue' => (float)$report['fees_collected'],
            'expenses' => (float)$report['salary_paid'],
        ];

        // Excel file generation
        $excelData = ExcelGenerator::generate($feeCollections, $expenses, $summary);
        
        $fromFormatted = date('j M Y', strtotime($report['from_date']));
        $toFormatted = date('j M Y', strtotime($report['to_date']));
        $filename = "Financial Report - {$fromFormatted} to {$toFormatted}.xlsx";

        // Email variables
        $toEmail = isset($school['contact_email']) ? trim((string)$school['contact_email']) : '';
        if (empty($toEmail) || filter_var($toEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw new ValidationException(['email' => 'The School Owner Email Address is not set or is invalid. Please contact the Super Admin to update it.']);
        }
        $subject = "Settlement Approval Request – Financial Report " . $report['report_id'];
        $sender = "shikshapilot@gmail.com";
        $academicYearName = $workingYear ? $workingYear['name'] : 'N/A';
        $reportPeriod = $report['from_date'] . ' to ' . $report['to_date'];
        $revenueVal = (float)$report['fees_collected'];
        $expensesVal = (float)$report['salary_paid'];
        $outcomeVal = (float)$report['profit_loss'];
        $generatedDate = date('Y-m-d H:i:s', strtotime($report['created_at']));

        $emailBodyText = "
Report ID: {$report['report_id']}
Academic Year: {$academicYearName}
Report Period: {$reportPeriod}
Total Revenue: ₹" . number_format($revenueVal, 2) . "
Total Salaries & Expenses: ₹" . number_format($expensesVal, 2) . "
Net Profit / Net Loss: ₹" . number_format(abs($outcomeVal), 2) . ($outcomeVal >= 0 ? " (Profit)" : " (Loss)") . "
Report Generated Date & Time: {$generatedDate}

Dear School Owner,

A financial settlement request has been submitted for your review.

Please verify the attached Excel workbook carefully before approving or rejecting this settlement request.

Only approve the settlement after reviewing all financial records.
";

        $secret = getenv('DB_PASS') ?: 'secure_fallback_salt';
        $approveSig = hash_hmac('sha256', "report-{$report['id']}-action-approve", $secret);
        $rejectSig = hash_hmac('sha256', "report-{$report['id']}-action-reject", $secret);

        $approveLink = "http://localhost:8000/api/public/financial-reports/{$report['id']}/settlement/approve?signature={$approveSig}";
        $rejectLink = "http://localhost:8000/api/public/financial-reports/{$report['id']}/settlement/reject?signature={$rejectSig}";

        $emailBodyHtml = "
<h3>Settlement Approval Request – Financial Report {$report['report_id']}</h3>
<table border='0' cellpadding='5' cellspacing='0' style='font-family: Arial, sans-serif; font-size: 14px;'>
    <tr><td><strong>Report ID:</strong></td><td>{$report['report_id']}</td></tr>
    <tr><td><strong>Academic Year:</strong></td><td>{$academicYearName}</td></tr>
    <tr><td><strong>Report Period:</strong></td><td>{$reportPeriod}</td></tr>
    <tr><td><strong>Total Revenue:</strong></td><td>₹" . number_format($revenueVal, 2) . "</td></tr>
    <tr><td><strong>Total Salaries & Expenses:</strong></td><td>₹" . number_format($expensesVal, 2) . "</td></tr>
    <tr><td><strong>Net Profit / Net Loss:</strong></td><td>₹" . number_format(abs($outcomeVal), 2) . ($outcomeVal >= 0 ? " (Profit)" : " (Loss)") . "</td></tr>
    <tr><td><strong>Report Generated Date & Time:</strong></td><td>{$generatedDate}</td></tr>
</table>

<p>Dear School Owner,</p>
<p>A financial settlement request has been submitted for your review.</p>
<p>Please verify the attached Excel workbook carefully before approving or rejecting this settlement request.</p>
<p>Only approve the settlement after reviewing all financial records.</p>

<p style='margin-top: 30px;'>
  <a href='{$approveLink}' 
     style='background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 15px; display: inline-block;'>
     Approve Settlement
  </a>
  <a href='{$rejectLink}' 
     style='background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>
     Reject Settlement
  </a>
</p>
";

        $logPath = __DIR__ . '/../../../../sent_emails.log';

        // Send using custom SmtpMailer
        try {
            SmtpMailer::send($toEmail, $subject, $emailBodyHtml, $excelData, $filename);
        } catch (\Throwable $e) {
            // Log SMTP failure for debugging
            $errorLogEntry = "========================================================================\n";
            $errorLogEntry .= "SMTP FAILURE TIMESTAMP: " . date('Y-m-d H:i:s') . "\n";
            $errorLogEntry .= "TO: " . $toEmail . "\n";
            $errorLogEntry .= "ERROR MESSAGE: " . $e->getMessage() . "\n";
            $errorLogEntry .= "TRACE: " . $e->getTraceAsString() . "\n";
            $errorLogEntry .= "========================================================================\n\n";
            file_put_contents($logPath, $errorLogEntry, FILE_APPEND);

            throw new ValidationException(
                ['email' => 'Failed to send settlement email to the School Owner. Please verify SMTP settings.'],
                'Failed to send settlement email to the School Owner. Please verify SMTP settings.'
            );
        }

        // Write log entry for developer review
        $logEntry = "========================================================================\n";
        $logEntry .= "TIMESTAMP: " . date('Y-m-d H:i:s') . "\n";
        $logEntry .= "FROM: " . $sender . "\n";
        $logEntry .= "TO: " . $toEmail . "\n";
        $logEntry .= "SUBJECT: " . $subject . "\n";
        $logEntry .= "------------------------------------------------------------------------\n";
        $logEntry .= "BODY:\n" . $emailBodyText . "\n";
        $logEntry .= "------------------------------------------------------------------------\n";
        $logEntry .= "APPROVE LINK: " . $approveLink . "\n";
        $logEntry .= "REJECT LINK: " . $rejectLink . "\n";
        $logEntry .= "------------------------------------------------------------------------\n";
        $logEntry .= "EXCEL FILENAME: " . $filename . "\n";
        $logEntry .= "EXCEL CONTENT:\n" . $excelData . "\n";
        $logEntry .= "========================================================================\n\n";

        file_put_contents($logPath, $logEntry, FILE_APPEND);

        // Update status to 'Request Sent'
        $this->financialReportRepo->update($id, [
            'status' => 'Request Sent'
        ]);

        // Centrally logged by AuditLoggingMiddleware

        return $this->financialReportRepo->findById($id);
    }

    public function ownerApproveSettlement(int $id, string $signature): string
    {
        $pdo = $this->financialReportRepo->getPdo();

        $report = $this->financialReportRepo->findById($id);
        if ($report === null) {
            return $this->renderOwnerResponseHtml("Error", "Financial report not found.", false);
        }

        // Validate HMAC signature to ensure link is secure
        $secret = getenv('DB_PASS') ?: 'secure_fallback_salt';
        $expectedSig = hash_hmac('sha256', "report-{$id}-action-approve", $secret);
        if (!hash_equals($expectedSig, $signature)) {
            return $this->renderOwnerResponseHtml("Unauthorized", "Invalid security signature for this settlement request.", false);
        }

        if ($report['status'] === 'Settled') {
            return $this->renderOwnerResponseHtml("Already Settled", "This financial report (ID: " . htmlspecialchars($report['report_id']) . ") has already been successfully settled.", true);
        }

        if ($report['status'] !== 'Request Sent') {
            return $this->renderOwnerResponseHtml("Error", "This report is not currently pending settlement.", false);
        }

        // Update status to 'Settled'
        $this->financialReportRepo->update($id, [
            'status' => 'Settled'
        ]);

        // Log audit
        $stmtAudit = $pdo->prepare("
            INSERT INTO audit_logs (action, target_school, user, user_role, ip_address)
            VALUES (:action, :target_school, :user, :user_role, :ip_address)
        ");
        $stmtAudit->execute([
            ':action' => "Owner approved settlement for report " . $report['report_id'],
            ':target_school' => (string)$report['school_id'],
            ':user' => 'School Owner',
            ':user_role' => 'SCHOOL_OWNER',
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        return $this->renderOwnerResponseHtml("Success", "Settlement approved successfully for report " . htmlspecialchars($report['report_id']) . ".", true);
    }

    public function ownerRejectSettlement(int $id, string $signature): string
    {
        $pdo = $this->financialReportRepo->getPdo();

        $report = $this->financialReportRepo->findById($id);
        if ($report === null) {
            return $this->renderOwnerResponseHtml("Error", "Financial report not found.", false);
        }

        // Validate HMAC signature to ensure link is secure
        $secret = getenv('DB_PASS') ?: 'secure_fallback_salt';
        $expectedSig = hash_hmac('sha256', "report-{$id}-action-reject", $secret);
        if (!hash_equals($expectedSig, $signature)) {
            return $this->renderOwnerResponseHtml("Unauthorized", "Invalid security signature for this settlement request.", false);
        }

        if ($report['status'] === 'Settled') {
            return $this->renderOwnerResponseHtml("Error", "This report is already settled and cannot be rejected.", false);
        }

        if ($report['status'] !== 'Request Sent') {
            return $this->renderOwnerResponseHtml("Error", "This report is not currently pending settlement.", false);
        }

        // Revert status to 'Pending'
        $this->financialReportRepo->update($id, [
            'status' => 'Pending'
        ]);

        // Log audit
        $stmtAudit = $pdo->prepare("
            INSERT INTO audit_logs (action, target_school, user, user_role, ip_address)
            VALUES (:action, :target_school, :user, :user_role, :ip_address)
        ");
        $stmtAudit->execute([
            ':action' => "Owner rejected settlement for report " . $report['report_id'],
            ':target_school' => (string)$report['school_id'],
            ':user' => 'School Owner',
            ':user_role' => 'SCHOOL_OWNER',
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        return $this->renderOwnerResponseHtml("Rejected", "Settlement request rejected for report " . htmlspecialchars($report['report_id']) . ". The School Admin can now make changes and submit a new request.", true);
    }

    public function exportFinancialReport(array $user, int $id, string &$filename): string
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();

        $report = $this->financialReportRepo->findById($id);
        if ($report === null || (int)$report['school_id'] !== $schoolId) {
            throw new NotFoundException('Financial report not found.');
        }

        // Retrieve bounds of transactions contributing to this report
        list($from_ts, $operator, $to_ts) = $this->getReportBounds($pdo, $schoolId, $report);

        // Fetch Student Fee Collections
        $stmtFeeList = $pdo->prepare("
            SELECT 
                fp.created_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                'Tuition Fee' AS fee_type, 
                fp.fee_month AS months_covered, 
                fp.amount_paid AS amount,
                fp.academic_year_id
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE fp.school_id = :sid 
              AND fp.status = 'PAID'
              AND fp.created_at {$operator} :from_ts 
              AND fp.created_at <= :to_ts
        ");
        $stmtFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $feePayments = $stmtFeeList->fetchAll(PDO::FETCH_ASSOC);

        $stmtAddFeeList = $pdo->prepare("
            SELECT 
                afp.updated_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                aft.name AS fee_type, 
                'N/A' AS months_covered, 
                afp.amount,
                aft.academic_year_id
            FROM additional_fee_payments afp
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.school_id = :sid 
              AND afp.status = 'Paid'
              AND afp.updated_at {$operator} :from_ts 
              AND afp.updated_at <= :to_ts
        ");
        $stmtAddFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $addPayments = $stmtAddFeeList->fetchAll(PDO::FETCH_ASSOC);

        // Format previous year dues descriptions
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;
        $stmtAYNames = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid");
        $stmtAYNames->execute([':sid' => $schoolId]);
        $ayNames = $stmtAYNames->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        foreach ($feePayments as &$fp) {
            $payAYId = isset($fp['academic_year_id']) ? (int)$fp['academic_year_id'] : 0;
            if ($workingYearId && $payAYId && $payAYId !== $workingYearId) {
                $ayName = $ayNames[$payAYId] ?? '';
                $fp['fee_type'] = "Previous Year Dues – " . $fp['student_name'] . " – AY " . $ayName;
            }
            unset($fp['academic_year_id']);
        }
        unset($fp);

        foreach ($addPayments as &$ap) {
            $payAYId = isset($ap['academic_year_id']) ? (int)$ap['academic_year_id'] : 0;
            if ($workingYearId && $payAYId && $payAYId !== $workingYearId) {
                $ayName = $ayNames[$payAYId] ?? '';
                $ap['fee_type'] = "Previous Year Dues – " . $ap['student_name'] . " – AY " . $ayName;
            }
            unset($ap['academic_year_id']);
        }
        unset($ap);

        $feeCollections = array_merge($feePayments, $addPayments);
        
        // Sort by class creation order, then deposit time, then name
        usort($feeCollections, function($a, $b) {
            $classIdA = isset($a['class_id']) ? (int)$a['class_id'] : 999999;
            $classIdB = isset($b['class_id']) ? (int)$b['class_id'] : 999999;
            if ($classIdA !== $classIdB) {
                return $classIdA <=> $classIdB;
            }
            $timeA = strtotime($a['deposit_time'] ?? '1970-01-01 00:00:00');
            $timeB = strtotime($b['deposit_time'] ?? '1970-01-01 00:00:00');
            if ($timeA !== $timeB) {
                return $timeA <=> $timeB;
            }
            return strcmp($a['student_name'] ?? '', $b['student_name'] ?? '');
        });

        $stmtSalaryList = $pdo->prepare("
            SELECT sp.payment_month, sp.academic_year_id, st.name AS staff_name, sp.payment_date AS expense_date, sp.amount_paid AS amount, 'Salary Payment' AS category
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            WHERE sp.school_id = :sid 
              AND sp.created_at {$operator} :from_ts 
              AND sp.created_at <= :to_ts
        ");
        $stmtSalaryList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $salaryPaymentsRaw = $stmtSalaryList->fetchAll(PDO::FETCH_ASSOC);

        $salaryPayments = [];
        foreach ($salaryPaymentsRaw as $spr) {
            $salaryPayments[] = [
                'description' => $this->getSalaryPaymentDescription($pdo, $schoolId, $spr, $spr['staff_name']),
                'category' => $spr['category'],
                'expense_date' => $spr['expense_date'],
                'amount' => $spr['amount']
            ];
        }

        $stmtExpenseList = $pdo->prepare("
            SELECT description, 'School Expense' AS category, expense_date, amount
            FROM school_expenses
            WHERE school_id = :sid 
              AND created_at {$operator} :from_ts 
              AND created_at <= :to_ts
        ");
        $stmtExpenseList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $expensesItems = $stmtExpenseList->fetchAll(PDO::FETCH_ASSOC);

        $expenses = array_merge($salaryPayments, $expensesItems);
        usort($expenses, function($a, $b) {
            return strcmp($a['expense_date'] ?? '', $b['expense_date'] ?? '');
        });

        // Profit / Loss Summary
        $summary = [
            'revenue' => (float)$report['fees_collected'],
            'expenses' => (float)$report['salary_paid'],
        ];

        // Format filename
        $fromFormatted = date('j M Y', strtotime($report['from_date']));
        $toFormatted = date('j M Y', strtotime($report['to_date']));
        $filename = "Financial Report - {$fromFormatted} to {$toFormatted}.xlsx";

        return ExcelGenerator::generate($feeCollections, $expenses, $summary);
    }

    public function isStudentPromoted(PDO $pdo, int $studentId, int $schoolId): bool
    {
        // 1. Get the academic year of the student
        $stmtStu = $pdo->prepare("
            SELECT s.admission_no, s.name, s.father_name, s.academic_year_id, ay.start_date
            FROM students s
            JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.id = :id AND s.school_id = :sid
            LIMIT 1
        ");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $stu = $stmtStu->fetch(PDO::FETCH_ASSOC);
        if (!$stu) {
            return false;
        }

        $admissionNo = $stu['admission_no'];
        $name = $stu['name'];
        $fatherName = $stu['father_name'] ?? '';
        $startDate = $stu['start_date'];

        // 2. Check if there is a student in a newer academic year matching this student
        if (!empty($admissionNo)) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*)
                FROM students s
                JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE s.school_id = :sid
                  AND ay.start_date > :start_date
                  AND s.admission_no = :admission_no
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':start_date' => $startDate,
                ':admission_no' => $admissionNo
            ]);
        } else {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*)
                FROM students s
                JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE s.school_id = :sid
                  AND ay.start_date > :start_date
                  AND s.name = :name
                  AND COALESCE(s.father_name, '') = :father_name
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':start_date' => $startDate,
                ':name' => $name,
                ':father_name' => $fatherName
            ]);
        }

        return ((int)$stmtCheck->fetchColumn()) > 0;
    }

    public function isStaffMigrated(PDO $pdo, int $staffId, int $schoolId): bool
    {
        // 1. Get the academic year and credentials of this staff member
        $stmtStaff = $pdo->prepare("
            SELECT st.employee_id, st.email, st.academic_year_id, ay.start_date
            FROM staff st
            JOIN academic_years ay ON st.academic_year_id = ay.id
            WHERE st.id = :id AND st.school_id = :sid
            LIMIT 1
        ");
        $stmtStaff->execute([':id' => $staffId, ':sid' => $schoolId]);
        $st = $stmtStaff->fetch(PDO::FETCH_ASSOC);
        if (!$st) {
            return false;
        }

        $empId = $st['employee_id'];
        $email = $st['email'];
        $startDate = $st['start_date'];

        // 2. Check if there is a staff record in a newer academic year matching this staff
        if (!empty($empId)) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*)
                FROM staff st
                JOIN academic_years ay ON st.academic_year_id = ay.id
                WHERE st.school_id = :sid
                  AND ay.start_date > :start_date
                  AND st.employee_id = :emp_id
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':start_date' => $startDate,
                ':emp_id' => $empId
            ]);
        } else {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*)
                FROM staff st
                JOIN academic_years ay ON st.academic_year_id = ay.id
                WHERE st.school_id = :sid
                  AND ay.start_date > :start_date
                  AND st.email = :email
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':start_date' => $startDate,
                ':email' => $email
            ]);
        }

        return ((int)$stmtCheck->fetchColumn()) > 0;
    }

    private function getReportBounds(PDO $pdo, int $schoolId, array $report): array
    {
        // Find previous report
        $stmtPrev = $pdo->prepare("
            SELECT * FROM financial_reports 
            WHERE school_id = :sid AND created_at < :created_at 
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmtPrev->execute([':sid' => $schoolId, ':created_at' => $report['created_at']]);
        $prevReport = $stmtPrev->fetch(PDO::FETCH_ASSOC);

        if ($prevReport) {
            $fromTimestamp = $prevReport['created_at'];
            $operator = '>';
        } else {
            $fromTimestamp = $report['from_date'] . ' 00:00:00';
            $operator = '>=';
        }

        $createdDate = date('Y-m-d', strtotime($report['created_at']));
        if ($report['to_date'] === $createdDate) {
            $toTimestamp = $report['created_at'];
        } else {
            $toTimestamp = $report['to_date'] . ' 23:59:59';
        }

        return [$fromTimestamp, $operator, $toTimestamp];
    }

    private function renderOwnerResponseHtml(string $title, string $message, bool $isSuccess): string
    {
        $color = $isSuccess ? '#0d9488' : '#dc2626';
        $bgLight = $isSuccess ? '#f0fdfa' : '#fef2f2';
        $border = $isSuccess ? '#ccfbf1' : '#fecaca';

        return "
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>ShikshaPilot - Settlement Decision</title>
    <link href='https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap' rel='stylesheet'>
    <style>
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #f4f4f5;
            color: #18181b;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
        }
        .card {
            background-color: #ffffff;
            border: 1px solid #e4e4e7;
            border-radius: 24px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            max-width: 500px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.05em;
            color: #0d9488;
            margin-bottom: 30px;
        }
        .logo span {
            color: #18181b;
        }
        .status-box {
            background-color: {$bgLight};
            border: 1px solid {$border};
            color: {$color};
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
            font-weight: 600;
            font-size: 18px;
        }
        .message {
            color: #71717a;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .footer {
            font-size: 11px;
            color: #a1a1aa;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 0.05em;
        }
    </style>
</head>
<body>
    <div class='card'>
        <div class='logo'>Shiksha<span>Pilot</span></div>
        <div class='status-box'>
            {$title}
        </div>
        <div class='message'>
            {$message}
        </div>
        <div class='footer'>
            ShikshaPilot Enterprise School Management Platform
        </div>
    </div>
</body>
</html>
";
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

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayid = $workingYear ? (int)$workingYear['id'] : null;

        $stmt = $pdo->prepare("
            INSERT INTO school_expenses (school_id, description, amount, created_by, expense_date, category, payment_method, reference_number, academic_year_id)
            VALUES (:sid, :desc, :amount, :created_by, :expense_date, :cat, :pmethod, :ref, :ayid)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':desc' => $desc,
            ':amount' => $amount,
            ':created_by' => $createdBy,
            ':expense_date' => $expenseDate,
            ':cat' => $category,
            ':pmethod' => $payMethod,
            ':ref' => $refNo,
            ':ayid' => $ayid
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

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : null;

        if ($workingYearId !== null) {
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
                WHERE aft.school_id = :sid AND aft.academic_year_id = :ayid
                GROUP BY aft.name, aft.due_date, aft.academic_year_id
                ORDER BY id DESC
            ");
            $stmt->execute([':sid' => $schoolId, ':ayid' => $workingYearId]);
        } else {
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
        }
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
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : null;

        if ($workingYearId !== null) {
            $stmt = $pdo->prepare("
                SELECT afp.*, s.name as student_name, c.name as class_name, 
                       aft.name as fee_name, aft.due_date, ay.name as academic_year_name
                FROM additional_fee_payments afp
                JOIN students s ON s.id = afp.student_id
                JOIN classes c ON c.id = s.class_id
                JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
                LEFT JOIN academic_years ay ON ay.id = aft.academic_year_id
                WHERE afp.school_id = :sid AND aft.academic_year_id = :ayid
                ORDER BY afp.id DESC
            ");
            $stmt->execute([':sid' => $schoolId, ':ayid' => $workingYearId]);
        } else {
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
        }
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
            SELECT afp.student_id, s.academic_year_id AS student_ay_id, s.status AS student_status, aft.academic_year_id AS fee_ay_id, aft.due_date, aft.name
            FROM additional_fee_payments afp
            JOIN students s ON s.id = afp.student_id
            JOIN additional_fee_types aft ON aft.id = afp.fee_type_id
            WHERE afp.id = :id AND afp.school_id = :sid
            LIMIT 1
        ");
        $stmtGetInfo->execute([':id' => $id, ':sid' => $schoolId]);
        $info = $stmtGetInfo->fetch(PDO::FETCH_ASSOC);
        if ($info) {
            if ($this->isStudentPromoted($pdo, (int)$info['student_id'], $schoolId)) {
                throw new ValidationException(['fields' => "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year."]);
            }
            if ($info['due_date'] !== null && $info['name'] !== 'Previous Year Dues') {
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

        $stmtCheck = $pdo->prepare("SELECT id, payment_date, updated_at FROM additional_fee_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $paymentDetails = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($paymentDetails === false) {
            throw new NotFoundException('Fee record not found.');
        }

        // 1. Report lock check
        if ($this->isTransactionInReport($pdo, $schoolId, $paymentDetails['updated_at'])) {
            throw new ValidationException(['locked' => 'This payment has already been included in a generated Financial Report and can no longer be reverted.']);
        }

        // 2. Writable year check & Outstanding migration lock check
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
            $feeAyId = (int)$info['fee_ay_id'];
            $stmtPayYear = $pdo->prepare("SELECT status FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmtPayYear->execute([':id' => $feeAyId, ':sid' => $schoolId]);
            $payYearStatus = $stmtPayYear->fetchColumn();
            if ($payYearStatus === 'Archived') {
                throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
            }

            $studentAyId = $info['student_ay_id'] !== null ? (int)$info['student_ay_id'] : 0;
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

    private function isTransactionInReport(\PDO $pdo, int $schoolId, string $txTime): bool
    {
        $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE school_id = :sid ORDER BY created_at ASC");
        $stmt->execute([':sid' => $schoolId]);
        $reports = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $prevCreatedAt = null;
        foreach ($reports as $r) {
            if ($prevCreatedAt !== null) {
                $lowerBound = $prevCreatedAt;
                $operator = '>';
            } else {
                $lowerBound = $r['from_date'] . ' 00:00:00';
                $operator = '>=';
            }

            $createdDate = date('Y-m-d', strtotime($r['created_at']));
            if ($r['to_date'] === $createdDate) {
                $upperBound = $r['created_at'];
            } else {
                $upperBound = $r['to_date'] . ' 23:59:59';
            }

            $txVal = strtotime($txTime);
            $lowerVal = strtotime($lowerBound);
            $upperVal = strtotime($upperBound);

            $inLower = ($operator === '>') ? ($txVal > $lowerVal) : ($txVal >= $lowerVal);
            $inUpper = ($txVal <= $upperVal);

            if ($inLower && $inUpper) {
                return true;
            }

            $prevCreatedAt = $r['created_at'];
        }

        return false;
    }

    public function getHolidays(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            return [];
        }

        $stmt = $pdo->prepare("SELECT * FROM holidays WHERE school_id = :sid AND academic_year_id = :yid ORDER BY date ASC");
        $stmt->execute([':sid' => $schoolId, ':yid' => (int)$workingYear['id']]);
        $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($holidays) === 0) {
            // Auto-prefill if empty
            if (preg_match('/^(\d{4})[-–—](\d{4})$/u', trim($workingYear['name']), $matches)) {
                $startYear = (int)$matches[1];
                $endYear = (int)$matches[2];
            } else {
                $startYear = (int)date('Y', strtotime($workingYear['start_date']));
                $endYear = (int)date('Y', strtotime($workingYear['end_date']));
            }
            $defaultHolidays = [
                ['name' => 'Labour Day', 'date' => "{$startYear}-05-01"],
                ['name' => 'Independence Day', 'date' => "{$startYear}-08-15"],
                ['name' => 'Mahatma Gandhi Jayanti', 'date' => "{$startYear}-10-02"],
                ['name' => 'Christmas Day', 'date' => "{$startYear}-12-25"],
                ['name' => 'New Year\'s Day', 'date' => "{$endYear}-01-01"],
                ['name' => 'Republic Day', 'date' => "{$endYear}-01-26"]
            ];
            $stmtHoliday = $pdo->prepare("
                INSERT IGNORE INTO holidays (school_id, academic_year_id, name, date)
                VALUES (:school_id, :academic_year_id, :name, :date)
            ");
            foreach ($defaultHolidays as $h) {
                if ($h['date'] >= $workingYear['start_date'] && $h['date'] <= $workingYear['end_date']) {
                    $stmtHoliday->execute([
                        ':school_id' => $schoolId,
                        ':academic_year_id' => (int)$workingYear['id'],
                        ':name' => $h['name'],
                        ':date' => $h['date']
                    ]);
                }
            }
            $stmt->execute([':sid' => $schoolId, ':yid' => (int)$workingYear['id']]);
            $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return $holidays;
    }

    public function createHoliday(array $user, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        if (empty($body['name'])) {
            throw new ValidationException(['name' => 'Holiday name is required.']);
        }
        if (empty($body['date'])) {
            throw new ValidationException(['date' => 'Holiday date is required.']);
        }

        $date = trim($body['date']);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new ValidationException(['date' => 'Invalid date format.']);
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['date' => 'No active Academic Year found.']);
        }

        if ($date < $workingYear['start_date'] || $date > $workingYear['end_date']) {
            throw new ValidationException(['date' => "Holiday date must be within the academic year ({$workingYear['start_date']} to {$workingYear['end_date']})."]);
        }

        // Check for duplicates
        $stmtCheck = $pdo->prepare("SELECT id FROM holidays WHERE school_id = :sid AND date = :date");
        $stmtCheck->execute([':sid' => $schoolId, ':date' => $date]);
        if ($stmtCheck->fetchColumn() !== false) {
            throw new ValidationException(['date' => 'A holiday already exists on this date.']);
        }

        $stmt = $pdo->prepare("INSERT INTO holidays (school_id, academic_year_id, name, date) VALUES (:sid, :yid, :name, :date)");
        $stmt->execute([
            ':sid' => $schoolId,
            ':yid' => (int)$workingYear['id'],
            ':name' => trim($body['name']),
            ':date' => $date
        ]);

        return ['id' => (int)$pdo->lastInsertId(), 'name' => trim($body['name']), 'date' => $date];
    }

    public function updateHoliday(array $user, int $id, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Check if exists
        $stmtEx = $pdo->prepare("SELECT * FROM holidays WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtEx->execute([':id' => $id, ':sid' => $schoolId]);
        $holiday = $stmtEx->fetch(PDO::FETCH_ASSOC);
        if (!$holiday) {
            throw new NotFoundException('Holiday not found.');
        }

        // Past holiday read-only validation
        $today = date('Y-m-d');
        if ($holiday['date'] < $today) {
            throw new ValidationException(['date' => 'Cannot edit past holidays.']);
        }

        if (empty($body['name'])) {
            throw new ValidationException(['name' => 'Holiday name is required.']);
        }
        if (empty($body['date'])) {
            throw new ValidationException(['date' => 'Holiday date is required.']);
        }

        $date = trim($body['date']);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new ValidationException(['date' => 'Invalid date format.']);
        }

        if ($date < $today) {
            throw new ValidationException(['date' => 'Cannot set holiday date in the past.']);
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['date' => 'No active Academic Year found.']);
        }

        if ($date < $workingYear['start_date'] || $date > $workingYear['end_date']) {
            throw new ValidationException(['date' => "Holiday date must be within the academic year ({$workingYear['start_date']} to {$workingYear['end_date']})."]);
        }

        // Check for duplicates (excluding this holiday)
        $stmtCheck = $pdo->prepare("SELECT id FROM holidays WHERE school_id = :sid AND date = :date AND id != :id");
        $stmtCheck->execute([':sid' => $schoolId, ':date' => $date, ':id' => $id]);
        if ($stmtCheck->fetchColumn() !== false) {
            throw new ValidationException(['date' => 'A holiday already exists on this date.']);
        }

        $stmt = $pdo->prepare("UPDATE holidays SET name = :name, date = :date WHERE id = :id AND school_id = :sid");
        $stmt->execute([
            ':name' => trim($body['name']),
            ':date' => $date,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        return ['id' => $id, 'name' => trim($body['name']), 'date' => $date];
    }

    public function deleteHoliday(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtEx = $pdo->prepare("SELECT * FROM holidays WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtEx->execute([':id' => $id, ':sid' => $schoolId]);
        $holiday = $stmtEx->fetch(PDO::FETCH_ASSOC);
        if (!$holiday) {
            throw new NotFoundException('Holiday not found.');
        }

        // Past holiday read-only validation
        $today = date('Y-m-d');
        if ($holiday['date'] < $today) {
            throw new ValidationException(['date' => 'Cannot delete past holidays.']);
        }

        $stmt = $pdo->prepare("DELETE FROM holidays WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function getExaminations(array $user): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        $stmt = $pdo->prepare("
            SELECT * FROM examinations 
            WHERE school_id = :sid AND academic_year_id = :ayid
            ORDER BY start_date DESC
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function createExamination(array $user, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        if (empty($data['name']) || empty($data['start_date']) || empty($data['end_date']) || empty($data['publish_date'])) {
            throw new ValidationException(['fields' => 'All fields (Exam Name, Start Date, End Date, Publish Date) are required.']);
        }

        $name = trim($data['name']);
        $startDate = $data['start_date'];
        $endDate = $data['end_date'];
        $publishDate = $data['publish_date'];
        $description = $data['description'] ?? null;

        if ($endDate < $startDate) {
            throw new ValidationException(['end_date' => 'End Date cannot be before Start Date.']);
        }
        if ($publishDate < $endDate) {
            throw new ValidationException(['publish_date' => 'Publish Date cannot be before End Date.']);
        }

        // Check duplicate name school-wide for this academic year
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM examinations 
            WHERE school_id = :sid AND academic_year_id = :ayid AND LOWER(name) = LOWER(:name)
        ");
        $stmtDup->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':name' => $name]);
        if ((int)$stmtDup->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'An examination with this name already exists in this academic year.']);
        }

        // Check exam date overlap school-wide
        $stmtOverlap = $pdo->prepare("
            SELECT COUNT(*) FROM examinations
            WHERE school_id = :sid AND academic_year_id = :ayid
              AND ((start_date <= :end_date AND end_date >= :start_date))
        ");
        $stmtOverlap->execute([
            ':sid' => $schoolId,
            ':ayid' => $academicYearId,
            ':start_date' => $startDate,
            ':end_date' => $endDate
        ]);
        if ((int)$stmtOverlap->fetchColumn() > 0) {
            throw new ValidationException(['start_date' => 'This examination dates overlap with an existing examination.']);
        }

        $stmtInsert = $pdo->prepare("
            INSERT INTO examinations (school_id, academic_year_id, name, start_date, end_date, publish_date, description, status)
            VALUES (:sid, :ayid, :name, :start_date, :end_date, :publish_date, :description, 'Draft')
        ");
        $stmtInsert->execute([
            ':sid' => $schoolId,
            ':ayid' => $academicYearId,
            ':name' => $name,
            ':start_date' => $startDate,
            ':end_date' => $endDate,
            ':publish_date' => $publishDate,
            ':description' => $description
        ]);

        $id = (int)$pdo->lastInsertId();
        
        $stmtGet = $pdo->prepare("SELECT * FROM examinations WHERE id = :id LIMIT 1");
        $stmtGet->execute([':id' => $id]);
        return $stmtGet->fetch(PDO::FETCH_ASSOC);
    }

    public function getExaminationDetails(array $user, int $id): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmt = $pdo->prepare("
            SELECT e.*
            FROM examinations e
            WHERE e.id = :id AND e.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        $exam = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }
        return $exam;
    }

    public function updateExamination(array $user, int $id, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Fetch existing
        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        $name = isset($data['name']) ? trim($data['name']) : $exam['name'];
        $startDate = $data['start_date'] ?? $exam['start_date'];
        $endDate = $data['end_date'] ?? $exam['end_date'];
        $publishDate = $data['publish_date'] ?? $exam['publish_date'];
        $description = array_key_exists('description', $data) ? $data['description'] : $exam['description'];
        $status = $data['status'] ?? $exam['status'];

        if (empty($name) || empty($startDate) || empty($endDate) || empty($publishDate)) {
            throw new ValidationException(['fields' => 'All fields (Exam Name, Start Date, End Date, Publish Date) are required.']);
        }

        if ($endDate < $startDate) {
            throw new ValidationException(['end_date' => 'End Date cannot be before Start Date.']);
        }
        if ($publishDate < $endDate) {
            throw new ValidationException(['publish_date' => 'Publish Date cannot be before End Date.']);
        }

        // Check duplicate name school-wide for this academic year (excluding current exam)
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM examinations 
            WHERE school_id = :sid AND academic_year_id = :ayid AND LOWER(name) = LOWER(:name) AND id != :id
        ");
        $stmtDup->execute([':sid' => $schoolId, ':ayid' => (int)$exam['academic_year_id'], ':name' => $name, ':id' => $id]);
        if ((int)$stmtDup->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'An examination with this name already exists in this academic year.']);
        }

        // Check exam date overlap school-wide (excluding current exam)
        $stmtOverlap = $pdo->prepare("
            SELECT COUNT(*) FROM examinations
            WHERE school_id = :sid AND academic_year_id = :ayid AND id != :id
              AND ((start_date <= :end_date AND end_date >= :start_date))
        ");
        $stmtOverlap->execute([
            ':sid' => $schoolId,
            ':ayid' => (int)$exam['academic_year_id'],
            ':end_date' => $endDate,
            ':start_date' => $startDate,
            ':id' => $id
        ]);
        if ((int)$stmtOverlap->fetchColumn() > 0) {
            throw new ValidationException(['start_date' => 'This examination dates overlap with an existing examination.']);
        }

        // Update
        $stmtUpdate = $pdo->prepare("
            UPDATE examinations 
            SET name = :name, start_date = :start_date, end_date = :end_date, publish_date = :publish_date, description = :description, status = :status
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUpdate->execute([
            ':name' => $name,
            ':start_date' => $startDate,
            ':end_date' => $endDate,
            ':publish_date' => $publishDate,
            ':description' => $description,
            ':status' => $status,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        if ($status === 'Draft' && $exam['status'] === 'Published') {
            $stmtClassReset = $pdo->prepare("
                UPDATE examination_class_status 
                SET status = 'Draft', publish_date = NULL 
                WHERE exam_id = :exam_id
            ");
            $stmtClassReset->execute([':exam_id' => $id]);
        } elseif ($status === 'Published' && $exam['status'] === 'Draft') {
            $stmtClasses = $pdo->prepare("
                SELECT id FROM classes 
                WHERE school_id = :sid AND academic_year_id = :ay_id
            ");
            $stmtClasses->execute([':sid' => $schoolId, ':ay_id' => $exam['academic_year_id']]);
            $classes = $stmtClasses->fetchAll(PDO::FETCH_COLUMN);

            foreach ($classes as $cId) {
                $stmt = $pdo->prepare("
                    INSERT INTO examination_class_status (exam_id, class_id, status, publish_date)
                    VALUES (:exam_id, :class_id, 'Published', CURRENT_DATE())
                    ON DUPLICATE KEY UPDATE status = 'Published', publish_date = CURRENT_DATE()
                ");
                $stmt->execute([':exam_id' => $id, ':class_id' => (int)$cId]);
            }
        }
    }

    public function deleteExamination(array $user, int $id): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtCheck = $pdo->prepare("SELECT id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if (!$stmtCheck->fetchColumn()) {
            throw new NotFoundException('Examination not found.');
        }

        $stmt = $pdo->prepare("DELETE FROM examinations WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
    }

    public function getExamTimetable(array $user, int $examId, int $classId): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Verify exam belongs to school
        $stmtCheck = $pdo->prepare("SELECT id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        if (!$stmtCheck->fetchColumn()) {
            throw new NotFoundException('Examination not found.');
        }

        $stmt = $pdo->prepare("
            SELECT 
                ep.*, 
                s.name AS subject_name,
                (SELECT COUNT(*) FROM students stud WHERE stud.class_id = ep.class_id AND stud.school_id = :sid_student AND stud.status = 'ACTIVE') AS total_students,
                (SELECT COUNT(*) FROM examination_marks em WHERE em.exam_id = ep.exam_id AND em.paper_id = ep.id AND (em.marks_obtained IS NOT NULL OR em.is_absent = 1)) AS entered_marks_count
            FROM examination_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
            ORDER BY ep.exam_date ASC, ep.start_time ASC
        ");
        $stmt->execute([
            ':exam_id' => $examId,
            ':class_id' => $classId,
            ':sid_student' => $schoolId
        ]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        
        return array_map(function($row) {
            $total = (int)$row['total_students'];
            $entered = (int)$row['entered_marks_count'];
            $row['marks_completed'] = ($total > 0 && $entered >= $total);
            return $row;
        }, $rows);
    }

    public function saveExamTimetable(array $user, int $examId, int $classId, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // Verify class publish status
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        if ($stmtStatus->fetchColumn() === 'Published') {
            throw new ValidationException(['status' => 'Cannot edit timetable of a published class examination.']);
        }

        $papers = $data['papers'] ?? [];

        // Validation for time overlaps
        for ($i = 0; $i < count($papers); $i++) {
            $p1 = $papers[$i];
            if (empty($p1['subject_id']) || empty($p1['exam_date']) || empty($p1['start_time']) || empty($p1['end_time']) || empty($p1['max_marks']) || empty($p1['passing_marks'])) {
                throw new ValidationException(['fields' => 'All fields for paper entries are required.']);
            }
            $t1_start = strtotime($p1['start_time']);
            $t1_end = strtotime($p1['end_time']);
            if ($t1_end <= $t1_start) {
                throw new ValidationException(['end_time' => 'End Time must be after Start Time.']);
            }

            for ($j = $i + 1; $j < count($papers); $j++) {
                $p2 = $papers[$j];
                if ($p1['exam_date'] === $p2['exam_date']) {
                    $t2_start = strtotime($p2['start_time']);
                    $t2_end = strtotime($p2['end_time']);
                    
                    // Range overlap condition
                    if (($t1_start < $t2_end) && ($t2_start < $t1_end)) {
                        throw new ValidationException(['overlap' => 'Papers cannot overlap in schedule on ' . $p1['exam_date']]);
                    }
                }
            }
        }

        $pdo->beginTransaction();
        try {
            // Delete old papers for this class
            $stmtDel = $pdo->prepare("DELETE FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id");
            $stmtDel->execute([':exam_id' => $examId, ':class_id' => $classId]);

            // Insert new papers
            $stmtIns = $pdo->prepare("
                INSERT INTO examination_papers (exam_id, class_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room, paper_type)
                VALUES (:exam_id, :class_id, :subid, :edate, :stime, :etime, :maxm, :passm, :room, :ptype)
            ");
            foreach ($papers as $p) {
                $stmtIns->execute([
                    ':exam_id' => $examId,
                    ':class_id' => $classId,
                    ':subid' => (int)$p['subject_id'],
                    ':edate' => $p['exam_date'],
                    ':stime' => $p['start_time'],
                    ':etime' => $p['end_time'],
                    ':maxm' => (float)$p['max_marks'],
                    ':passm' => (float)$p['passing_marks'],
                    ':room' => !empty($p['room']) ? $p['room'] : null,
                    ':ptype' => !empty($p['paper_type']) ? $p['paper_type'] : 'Written'
                ]);
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getExamMarksSheet(array $user, int $examId, int $classId, int $subjectId): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Fetch Exam
        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // Fetch Paper Details
        $stmtPaper = $pdo->prepare("SELECT * FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id AND subject_id = :subid LIMIT 1");
        $stmtPaper->execute([':exam_id' => $examId, ':class_id' => $classId, ':subid' => $subjectId]);
        $paper = $stmtPaper->fetch(PDO::FETCH_ASSOC);
        if (!$paper) {
            throw new ValidationException(['subject_id' => 'This subject is not scheduled in the exam timetable.']);
        }

        // Fetch Class Students
        $stmtStudents = $pdo->prepare("
            SELECT id, roll_no, name 
            FROM students 
            WHERE class_id = :cid AND school_id = :sid AND status = 'ACTIVE' 
            ORDER BY CAST(roll_no AS UNSIGNED) ASC, name ASC
        ");
        $stmtStudents->execute([':cid' => $classId, ':sid' => $schoolId]);
        $students = $stmtStudents->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch Marks Obtained
        $stmtMarks = $pdo->prepare("
            SELECT * FROM examination_marks 
            WHERE exam_id = :exam_id AND paper_id = :paper_id
        ");
        $stmtMarks->execute([':exam_id' => $examId, ':paper_id' => $paper['id']]);
        $marksList = $stmtMarks->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $marksMap = [];
        foreach ($marksList as $m) {
            $sid = (int)$m['student_id'];
            $pid = (int)$m['paper_id'];
            if (!isset($marksMap[$sid])) {
                $marksMap[$sid] = [];
            }
            $marksMap[$sid][$pid] = $m;
        }

        $list = [];
        foreach ($students as $s) {
            $studentId = (int)$s['id'];
            $m = $marksMap[$studentId][$paper['id']] ?? ['marks_obtained' => null, 'is_absent' => 0, 'remarks' => ''];
            $list[] = [
                'student_id' => $studentId,
                'student_name' => $s['name'],
                'roll_no' => $s['roll_no'],
                'marks_obtained' => $m['marks_obtained'] !== null ? (float)$m['marks_obtained'] : null,
                'is_absent' => (int)$m['is_absent'],
                'remarks' => $m['remarks'] ?: ''
            ];
        }

        // Fetch Class Exam status
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $classStatus = $stmtStatus->fetchColumn() ?: 'Draft';

        return [
            'exam_name' => $exam['name'],
            'status' => $classStatus,
            'max_marks' => (float)$paper['max_marks'],
            'passing_marks' => (float)$paper['passing_marks'],
            'students' => $list
        ];
    }

    public function saveExamMark(array $user, int $examId, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Fetch Exam
        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        if (empty($data['subject_id']) || empty($data['student_id'])) {
            throw new ValidationException(['fields' => 'Subject and Student IDs are required.']);
        }

        $subjectId = (int)$data['subject_id'];
        $studentId = (int)$data['student_id'];
        $isAbsent = isset($data['is_absent']) ? (int)$data['is_absent'] : 0;
        $marksObtained = isset($data['marks_obtained']) && $data['marks_obtained'] !== '' && !$isAbsent ? (float)$data['marks_obtained'] : null;
        $remarks = $data['remarks'] ?? null;

        // Fetch student's class to verify publish status
        $stmtStudClass = $pdo->prepare("SELECT class_id FROM students WHERE id = :sid LIMIT 1");
        $stmtStudClass->execute([':sid' => $studentId]);
        $classId = (int)$stmtStudClass->fetchColumn();

        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        if ($stmtStatus->fetchColumn() === 'Published') {
            throw new ValidationException(['status' => 'Cannot edit marks of a published class examination.']);
        }

        // Fetch Paper Details
        $stmtPaper = $pdo->prepare("SELECT * FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id AND subject_id = :subid LIMIT 1");
        $stmtPaper->execute([':exam_id' => $examId, ':class_id' => $classId, ':subid' => $subjectId]);
        $paper = $stmtPaper->fetch(PDO::FETCH_ASSOC);
        if (!$paper) {
            throw new ValidationException(['subject_id' => 'Subject is not scheduled in the exam timetable.']);
        }

        if ($marksObtained !== null) {
            if ($marksObtained < 0) {
                throw new ValidationException(['marks_obtained' => 'Negative marks are not allowed.']);
            }
            if ($marksObtained > (float)$paper['max_marks']) {
                throw new ValidationException(['marks_obtained' => "Marks obtained cannot exceed maximum marks ({$paper['max_marks']})."]);
            }
        }

        $stmtUpsert = $pdo->prepare("
            INSERT INTO examination_marks (exam_id, paper_id, student_id, marks_obtained, is_absent, remarks)
            VALUES (:exam_id, :paper_id, :student_id, :marks_obtained, :is_absent, :remarks)
            ON DUPLICATE KEY UPDATE
                marks_obtained = VALUES(marks_obtained),
                is_absent = VALUES(is_absent),
                remarks = VALUES(remarks)
        ");
        $stmtUpsert->execute([
            ':exam_id' => $examId,
            ':paper_id' => (int)$paper['id'],
            ':student_id' => $studentId,
            ':marks_obtained' => $marksObtained,
            ':is_absent' => $isAbsent,
            ':remarks' => $remarks
        ]);

        return ['success' => true];
    }

    public function publishExamResults(array $user, int $examId, int $classId, string $status = 'Published'): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtCheck = $pdo->prepare("SELECT id, academic_year_id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        if ($classId > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO examination_class_status (exam_id, class_id, status, publish_date)
                VALUES (:exam_id, :class_id, :status, " . ($status === 'Published' ? "CURRENT_DATE()" : "NULL") . ")
                ON DUPLICATE KEY UPDATE status = :status2, publish_date = " . ($status === 'Published' ? "CURRENT_DATE()" : "NULL") . "
            ");
            $stmt->execute([
                ':exam_id' => $examId,
                ':class_id' => $classId,
                ':status' => $status,
                ':status2' => $status
            ]);
        } else {
            // Update examinations table status
            $stmtUpdateExam = $pdo->prepare("
                UPDATE examinations 
                SET status = :status, publish_date = " . ($status === 'Published' ? "CURRENT_DATE()" : "NULL") . "
                WHERE id = :id
            ");
            $stmtUpdateExam->execute([':status' => $status, ':id' => $examId]);

            // Fetch all classes of the school for the exam's academic year
            $stmtClasses = $pdo->prepare("
                SELECT id FROM classes 
                WHERE school_id = :sid AND academic_year_id = :ay_id
            ");
            $stmtClasses->execute([':sid' => $schoolId, ':ay_id' => $exam['academic_year_id']]);
            $classes = $stmtClasses->fetchAll(PDO::FETCH_COLUMN);

            foreach ($classes as $cId) {
                $stmt = $pdo->prepare("
                    INSERT INTO examination_class_status (exam_id, class_id, status, publish_date)
                    VALUES (:exam_id, :class_id, :status, " . ($status === 'Published' ? "CURRENT_DATE()" : "NULL") . ")
                    ON DUPLICATE KEY UPDATE status = :status2, publish_date = " . ($status === 'Published' ? "CURRENT_DATE()" : "NULL") . "
                ");
                $stmt->execute([
                    ':exam_id' => $examId,
                    ':class_id' => (int)$cId,
                    ':status' => $status,
                    ':status2' => $status
                ]);
            }
        }
    }

    public function getGradeConfigurations(array $user): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmt = $pdo->prepare("
            SELECT * FROM grade_configurations 
            WHERE school_id = :sid 
            ORDER BY min_percentage DESC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $grades = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if (empty($grades)) {
            // Seed defaults for this school if empty
            $stmtIns = $pdo->prepare("
                INSERT IGNORE INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark) VALUES
                (:sid, :min, :max, :grade, :point, :remark)
            ");
            $defaults = [
                [91.00, 100.00, 'A+', 10, 'Outstanding'],
                [81.00, 90.00, 'A', 9, 'Excellent'],
                [71.00, 80.00, 'B+', 8, 'Very Good'],
                [61.00, 70.00, 'B', 7, 'Good'],
                [51.00, 60.00, 'C', 6, 'Average'],
                [41.00, 50.00, 'D', 5, 'Pass'],
                [0.00, 40.00, 'F', 0, 'Fail']
            ];
            foreach ($defaults as $row) {
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':min' => $row[0],
                    ':max' => $row[1],
                    ':grade' => $row[2],
                    ':point' => $row[3],
                    ':remark' => $row[4]
                ]);
            }

            $stmt->execute([':sid' => $schoolId]);
            $grades = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        return $grades;
    }

    public function saveGradeConfigurations(array $user, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $scales = $data['scales'] ?? [];
        if (empty($scales)) {
            throw new ValidationException(['scales' => 'Grade configurations scale list cannot be empty.']);
        }

        // Validate overlapping intervals
        for ($i = 0; $i < count($scales); $i++) {
            $s1 = $scales[$i];
            $min1 = (float)$s1['min_percentage'];
            $max1 = (float)$s1['max_percentage'];
            if ($max1 < $min1) {
                throw new ValidationException(['overlap' => 'Max percentage cannot be less than Min percentage.']);
            }
            for ($j = $i + 1; $j < count($scales); $j++) {
                $s2 = $scales[$j];
                $min2 = (float)$s2['min_percentage'];
                $max2 = (float)$s2['max_percentage'];
                if (($min1 <= $max2) && ($min2 <= $max1)) {
                    throw new ValidationException(['overlap' => "Overlapping ranges detected between grades {$s1['grade']} and {$s2['grade']}."]);
                }
            }
        }

        $pdo->beginTransaction();
        try {
            $stmtDel = $pdo->prepare("DELETE FROM grade_configurations WHERE school_id = :sid");
            $stmtDel->execute([':sid' => $schoolId]);

            $stmtIns = $pdo->prepare("
                INSERT INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark)
                VALUES (:sid, :min_p, :max_p, :grade, :gp, :rem)
            ");
            foreach ($scales as $s) {
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':min_p' => (float)$s['min_percentage'],
                    ':max_p' => (float)$s['max_percentage'],
                    ':grade' => trim($s['grade']),
                    ':gp' => (int)($s['grade_point'] ?? 0),
                    ':rem' => !empty($s['remark']) ? trim($s['remark']) : null
                ]);
            }
            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getReportCards(array $user, int $examId, int $classId, ?int $studentId = null): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Fetch Exam Details
        $stmtCheck = $pdo->prepare("
            SELECT e.*, ay.name AS academic_year_name, ay.start_date AS ay_start, ay.end_date AS ay_end
            FROM examinations e
            JOIN academic_years ay ON e.academic_year_id = ay.id
            WHERE e.id = :id AND e.school_id = :sid
            LIMIT 1
        ");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // Fetch Class Details
        $stmtClass = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid AND school_id = :sid LIMIT 1");
        $stmtClass->execute([':cid' => $classId, ':sid' => $schoolId]);
        $classInfo = $stmtClass->fetch(PDO::FETCH_ASSOC);
        $exam['class_name'] = $classInfo['name'] ?? '';
        $exam['class_section'] = $classInfo['section'] ?? '';

        // Fetch Class Exam status
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $classExamStatus = $stmtStatus->fetchColumn() ?: 'Draft';

        // Fetch Exam Timetable Papers for this class
        $stmtPapers = $pdo->prepare("
            SELECT ep.*, s.name AS subject_name 
            FROM examination_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
        ");
        $stmtPapers->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $papers = $stmtPapers->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch Grade configurations
        $gradeScales = $this->getGradeConfigurations($user);

        // Helper function to resolve grade from percentage
        $resolveGrade = function($pct) use ($gradeScales) {
            foreach ($gradeScales as $s) {
                if ($pct >= (float)$s['min_percentage'] && $pct <= (float)$s['max_percentage']) {
                    return $s['grade'];
                }
            }
            // Default fallbacks
            if ($pct >= 90) return 'A+';
            if ($pct >= 80) return 'A';
            if ($pct >= 70) return 'B+';
            if ($pct >= 60) return 'B';
            if ($pct >= 50) return 'C';
            if ($pct >= 40) return 'D';
            return 'F';
        };

        // Fetch Students list
        $studentsFilter = '';
        $params = [];
        if ($studentId !== null) {
            $studentsFilter = " AND s.id = :student_id ";
            $params[':student_id'] = $studentId;
        }
        $params[':class_id'] = $classId;
        $params[':sid'] = $schoolId;

        $stmtStudents = $pdo->prepare("
            SELECT s.*, c.name AS class_name, c.section AS class_section
            FROM students s
            JOIN classes c ON s.class_id = c.id
            WHERE s.class_id = :class_id AND s.school_id = :sid AND s.status = 'ACTIVE' {$studentsFilter}
            ORDER BY CAST(s.roll_no AS UNSIGNED) ASC, s.name ASC
        ");
        $stmtStudents->execute($params);
        $students = $stmtStudents->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch All Marks for this exam
        $stmtAllMarks = $pdo->prepare("
            SELECT * FROM examination_marks WHERE exam_id = :exam_id
        ");
        $stmtAllMarks->execute([':exam_id' => $examId]);
        $allMarks = $stmtAllMarks->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $marksMap = []; // [student_id => [paper_id => mark_row]]
        foreach ($allMarks as $m) {
            $sid = (int)$m['student_id'];
            $pid = (int)$m['paper_id'];
            if (!isset($marksMap[$sid])) {
                $marksMap[$sid] = [];
            }
            $marksMap[$sid][$pid] = $m;
        }

        // Fetch all active students in all classes of the SAME NAME (to compute Class Rank across sections)
        $stmtClassGroup = $pdo->prepare("
            SELECT s.id, s.class_id, c.name AS class_name 
            FROM students s 
            JOIN classes c ON s.class_id = c.id
            WHERE c.name = :class_name AND c.academic_year_id = :ayid AND s.school_id = :sid AND s.status = 'ACTIVE'
        ");
        $stmtClassGroup->execute([
            ':class_name' => $exam['class_name'],
            ':ayid' => $exam['academic_year_id'],
            ':sid' => $schoolId
        ]);
        $allCohort = $stmtClassGroup->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Batch fetch Attendance summaries for the entire cohort at once to optimize performance
        $cohortStudentIds = array_map(fn($c) => (int)$c['id'], $allCohort);
        $attendanceMap = [];
        if (!empty($cohortStudentIds)) {
            $inClause = implode(',', $cohortStudentIds);
            $stmtAllAtt = $pdo->prepare("
                SELECT student_id,
                       COUNT(*) AS total,
                       SUM(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS present
                FROM attendance
                WHERE student_id IN ({$inClause}) AND date BETWEEN :start_d AND :end_d
                GROUP BY student_id
            ");
            $stmtAllAtt->execute([
                ':start_d' => $exam['ay_start'],
                ':end_d' => $exam['ay_end']
            ]);
            $allAtt = $stmtAllAtt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($allAtt as $attRow) {
                $sid = (int)$attRow['student_id'];
                $attTotal = (int)$attRow['total'];
                $attPresent = (int)$attRow['present'];
                $attendanceMap[$sid] = $attTotal > 0 ? round(($attPresent / $attTotal) * 100, 2) : 100.00;
            }
        }

        // Compute Marks & Attendance details for the whole cohort
        $cohortScores = [];
        foreach ($allCohort as $cStud) {
            $cStudId = (int)$cStud['id'];
            $cClassId = (int)$cStud['class_id'];
            
            $studTotalObtained = 0.0;
            $studTotalMax = 0.0;

            foreach ($papers as $p) {
                $pid = (int)$p['id'];
                $m = $marksMap[$cStudId][$pid] ?? null;
                $studTotalMax += (float)$p['max_marks'];
                if ($m) {
                    if ((int)$m['is_absent'] !== 1) {
                        $studTotalObtained += (float)$m['marks_obtained'];
                    }
                }
            }

            $studAtt = $attendanceMap[$cStudId] ?? 100.00;
            $cohortScores[$cStudId] = [
                'student_id' => $cStudId,
                'class_id' => $cClassId,
                'score' => $studTotalObtained,
                'attendance' => $studAtt
            ];
        }

        // Reusable tie-breaker ranking generator matching sequential ranking rules (no skipped ranks after ties)
        $rankCohort = function(array $studentsList) {
            usort($studentsList, function($a, $b) {
                if (abs((float)$a['score'] - (float)$b['score']) > 0.0001) {
                    return ((float)$b['score'] > (float)$a['score']) ? 1 : -1;
                }
                if (abs((float)$a['attendance'] - (float)$b['attendance']) > 0.0001) {
                    return ((float)$b['attendance'] > (float)$a['attendance']) ? 1 : -1;
                }
                return 0;
            });

            $ranks = [];
            $currentRank = 1;
            $prevScore = null;
            $prevAtt = null;

            foreach ($studentsList as $item) {
                $sid = (int)$item['student_id'];
                if ($prevScore !== null) {
                    $isTie = (abs((float)$item['score'] - (float)$prevScore) < 0.0001) && 
                             (abs((float)$item['attendance'] - (float)$prevAtt) < 0.0001);
                    if (!$isTie) {
                        $currentRank++;
                    }
                }
                $ranks[$sid] = $currentRank;
                $prevScore = (float)$item['score'];
                $prevAtt = (float)$item['attendance'];
            }

            return $ranks;
        };

        // Compute cohort and section ranks
        $classRanks = $rankCohort(array_values($cohortScores));
        
        $sectionStudents = array_filter(array_values($cohortScores), fn($item) => (int)$item['class_id'] === $classId);
        $sectionRanks = $rankCohort(array_values($sectionStudents));

        // Fetch School Profile Details
        $stmtSchool = $pdo->prepare("SELECT name, logo_path, report_card_remark FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC);
        if ($school && empty($school['report_card_remark'])) {
            $school['report_card_remark'] = 'Congratulations! The student has passed all examinations and demonstrated excellent understanding.';
        }

        $reportCards = [];
        foreach ($students as $s) {
            $sid = (int)$s['id'];

            $subjectMarks = [];
            $totalMax = 0.0;
            $totalObtained = 0.0;
            $allPassed = true;
            $anyData = false;

            foreach ($papers as $p) {
                $pid = (int)$p['id'];
                $m = $marksMap[$sid][$pid] ?? null;
                $maxM = (float)$p['max_marks'];
                $passM = (float)$p['passing_marks'];
                
                $obtained = null;
                $absent = false;
                $remarks = '';
                $passed = false;
                $subjectGrade = 'F';

                if ($m) {
                    $anyData = true;
                    $absent = (int)$m['is_absent'] === 1;
                    if (!$absent) {
                        $obtained = (float)$m['marks_obtained'];
                        $totalObtained += $obtained;
                        $passed = $obtained >= $passM;
                        $subjectPct = ($maxM > 0) ? ($obtained / $maxM) * 100 : 0.0;
                        $subjectGrade = $resolveGrade($subjectPct);
                    } else {
                        $subjectGrade = 'F';
                        $passed = false;
                    }
                    $remarks = $m['remarks'] ?: '';
                }

                if (!$passed) {
                    $allPassed = false;
                }
                $totalMax += $maxM;

                $subjectMarks[] = [
                    'subject_name' => $p['subject_name'],
                    'paper_type' => $p['paper_type'] ?? 'Written',
                    'max_marks' => $maxM,
                    'passing_marks' => $passM,
                    'marks_obtained' => $absent ? 'ABSENT' : ($obtained !== null ? $obtained : '-'),
                    'grade' => $absent ? 'F' : ($obtained !== null ? $subjectGrade : '-'),
                    'remarks' => $remarks,
                    'result' => $absent ? 'FAIL' : ($obtained !== null ? ($passed ? 'PASS' : 'FAIL') : '-')
                ];
            }

            // Attendance rate
            $stmtAtt = $pdo->prepare("
                SELECT 
                    COUNT(*) AS total,
                    SUM(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS present
                FROM attendance
                WHERE student_id = :sid AND date BETWEEN :start_d AND :end_d
            ");
            $stmtAtt->execute([
                ':sid' => $sid,
                ':start_d' => $exam['ay_start'],
                ':end_d' => $exam['ay_end']
            ]);
            $att = $stmtAtt->fetch(PDO::FETCH_ASSOC);
            $attTotal = (int)($att['total'] ?? 0);
            $attPresent = (int)($att['present'] ?? 0);
            $attRate = $attTotal > 0 ? round(($attPresent / $attTotal) * 100, 2) : 100.00;

            // Totals
            $percentage = $totalMax > 0 ? round(($totalObtained / $totalMax) * 100, 2) : 0.0;
            $overallGrade = $resolveGrade($percentage);

            // Compute Rank in Class Group and Rank in Section
            $classRank = $classRanks[$sid] ?? 1;
            $sectionRank = $sectionRanks[$sid] ?? 1;

            $classSize = count($cohortScores);
            $sectionSize = count($sectionStudents);

            $reportCards[] = [
                'student_id' => $sid,
                'student_name' => $s['name'],
                'roll_no' => $s['roll_no'],
                'admission_no' => $s['sr_no'] ?? $s['admission_no'] ?? '',
                'father_name' => $s['father_name'] ?? '',
                'mother_name' => $s['mother_name'] ?? '',
                'class_name' => $exam['class_name'],
                'class_section' => $exam['class_section'],
                'exam_name' => $exam['name'],
                'academic_year_name' => $exam['academic_year_name'],
                'school_name' => $school['name'] ?? 'Academic Portal',
                'school_logo' => $school['logo_path'] ?? null,
                'report_card_remark' => $school['report_card_remark'] ?? null,
                'subjects' => $subjectMarks,
                'total_max' => $totalMax,
                'total_obtained' => $totalObtained,
                'percentage' => $percentage,
                'grade' => $overallGrade,
                'result' => $allPassed && $anyData ? 'PASS' : 'FAIL',
                'class_rank' => "{$classRank} of {$classSize}",
                'section_rank' => "{$sectionRank} of {$sectionSize}",
                'attendance' => [
                    'working_days' => $attTotal,
                    'present_days' => $attPresent,
                    'attendance_rate' => $attRate
                ],
                'status' => $classExamStatus
            ];
        }

        // Sort report cards by class rank (ascending), then roll_no (ascending)
        usort($reportCards, function($a, $b) {
            $rankA = (int)explode(' ', $a['class_rank'])[0];
            $rankB = (int)explode(' ', $b['class_rank'])[0];
            if ($rankA !== $rankB) {
                return $rankA <=> $rankB;
            }
            return (int)($a['roll_no'] ?? 0) <=> (int)($b['roll_no'] ?? 0);
        });

        return $studentId !== null && !empty($reportCards) ? $reportCards[0] : $reportCards;
    }

    public function getExamClassStatuses(array $user, int $examId): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Verify exam belongs to school
        $stmtCheck = $pdo->prepare("SELECT id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        if (!$stmtCheck->fetchColumn()) {
            throw new NotFoundException('Examination not found.');
        }

        // Fetch all classes of the school for the exam's academic year
        $stmtClasses = $pdo->prepare("
            SELECT c.id, c.name, c.section, COALESCE(ecs.status, 'Draft') AS status, ecs.publish_date
            FROM classes c
            LEFT JOIN examination_class_status ecs ON ecs.exam_id = :exam_id AND ecs.class_id = c.id
            WHERE c.school_id = :sid AND c.academic_year_id = (SELECT academic_year_id FROM examinations WHERE id = :exam_id2 LIMIT 1)
            ORDER BY c.id ASC
        ");
        $stmtClasses->execute([
            ':exam_id' => $examId,
            ':sid' => $schoolId,
            ':exam_id2' => $examId
        ]);
        return $stmtClasses->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getExamInstructions(array $user, int $examId, int $classId): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        if (!$stmtCheck->fetch()) {
            throw new NotFoundException('Examination not found.');
        }

        $stmt = $pdo->prepare("SELECT * FROM examination_instructions WHERE exam_id = :exam_id AND class_id = :class_id ORDER BY id ASC");
        $stmt->execute([':exam_id' => $examId, ':class_id' => $classId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function saveExamInstructions(array $user, int $examId, int $classId, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtCheck = $pdo->prepare("SELECT * FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        if (!$stmtCheck->fetch()) {
            throw new NotFoundException('Examination not found.');
        }

        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        if ($stmtStatus->fetchColumn() === 'Published') {
            throw new ValidationException(['status' => 'Cannot edit instructions of a published class examination.']);
        }

        $instructions = $data['instructions'] ?? [];
        if (count($instructions) > 5) {
            throw new ValidationException(['instructions' => 'You can add a maximum of 5 instructions.']);
        }

        $pdo->beginTransaction();
        try {
            $stmtDel = $pdo->prepare("DELETE FROM examination_instructions WHERE exam_id = :exam_id AND class_id = :class_id");
            $stmtDel->execute([':exam_id' => $examId, ':class_id' => $classId]);

            $stmtIns = $pdo->prepare("INSERT INTO examination_instructions (exam_id, class_id, instruction) VALUES (:exam_id, :class_id, :instr)");
            foreach ($instructions as $instr) {
                if (empty(trim($instr))) continue;
                $stmtIns->execute([
                    ':exam_id' => $examId,
                    ':class_id' => $classId,
                    ':instr' => trim($instr)
                ]);
            }
            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function logAudit(
        PDO $pdo,
        array $actorUser,
        string $module,
        string $action,
        string $description,
        ?string $academicYearName = null
    ): void {
        $actorEmail = $actorUser['phone'] ?? $actorUser['email'] ?? 'system@school.edu';
        $actorName = $actorUser['phone'] ?? $actorUser['name'] ?? $actorEmail;
        $actorRole = $actorUser['role'] ?? 'Unknown';
        $schoolId = $this->getSchoolId($actorUser);

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }
        $device = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Device';
        $deviceStr = $this->parseUserAgent($device);

        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (action, module, description, target_school, user, performed_by, user_role, academic_year, ip_address, device)
            VALUES (:act, :mod, :desc, :sch, :usr, :perf, :role, :ay, :ip, :dev)
        ");
        $stmt->execute([
            ':act' => $action,
            ':mod' => $module,
            ':desc' => $description,
            ':sch' => (string)$schoolId,
            ':usr' => $actorEmail,
            ':perf' => $actorName,
            ':role' => $actorRole,
            ':ay' => $academicYearName,
            ':ip' => $ip,
            ':dev' => $deviceStr
        ]);
    }

    private function parseUserAgent(string $ua): string
    {
        if (empty($ua)) return 'Unknown';
        $browser = 'Unknown Browser';
        $os = 'Unknown OS';

        if (preg_match('/windows|win32/i', $ua)) {
            $os = 'Windows';
        } elseif (preg_match('/macintosh|mac os x/i', $ua)) {
            $os = 'macOS';
        } elseif (preg_match('/linux/i', $ua)) {
            $os = 'Linux';
        } elseif (preg_match('/iphone|ipad|ipod/i', $ua)) {
            $os = 'iOS';
        } elseif (preg_match('/android/i', $ua)) {
            $os = 'Android';
        }

        if (preg_match('/chrome/i', $ua) && !preg_match('/edge|edg/i', $ua) && !preg_match('/opr/i', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/safari/i', $ua) && !preg_match('/chrome/i', $ua)) {
            $browser = 'Safari';
        } elseif (preg_match('/firefox/i', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/edge|edg/i', $ua)) {
            $browser = 'Edge';
        } elseif (preg_match('/opr/i', $ua)) {
            $browser = 'Opera';
        }

        return "$browser ($os)";
    }

    public function getSchoolAuditLogs(array $user, array $params): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $page = isset($params['page']) ? max(1, (int)$params['page']) : 1;
        $limit = isset($params['limit']) ? max(1, (int)$params['limit']) : 25;
        $offset = ($page - 1) * $limit;

        $conditions = ["target_school = :school_id"];
        $queryParams = [':school_id' => (string)$schoolId];

        if (!empty($params['date_filter'])) {
            $filter = $params['date_filter'];
            if ($filter === 'today') {
                $conditions[] = "created_at >= :date_start";
                $queryParams[':date_start'] = date('Y-m-d') . ' 00:00:00';
            } elseif ($filter === '7days') {
                $conditions[] = "created_at >= :date_start";
                $queryParams[':date_start'] = date('Y-m-d', strtotime('-7 days')) . ' 00:00:00';
            } elseif ($filter === '30days') {
                $conditions[] = "created_at >= :date_start";
                $queryParams[':date_start'] = date('Y-m-d', strtotime('-30 days')) . ' 00:00:00';
            } elseif ($filter === 'custom') {
                if (!empty($params['from_date'])) {
                    $conditions[] = "created_at >= :date_start";
                    $queryParams[':date_start'] = $params['from_date'] . ' 00:00:00';
                }
                if (!empty($params['to_date'])) {
                    $conditions[] = "created_at <= :date_end";
                    $queryParams[':date_end'] = $params['to_date'] . ' 23:59:59';
                }
            }
        }

        if (!empty($params['module'])) {
            $conditions[] = "module = :module";
            $queryParams[':module'] = $params['module'];
        }

        if (!empty($params['user'])) {
            $conditions[] = "user = :user";
            $queryParams[':user'] = $params['user'];
        }

        if (!empty($params['action'])) {
            $conditions[] = "action = :action";
            $queryParams[':action'] = $params['action'];
        }

        if (!empty($params['search'])) {
            $searchTerm = '%' . $params['search'] . '%';
            $conditions[] = "(action LIKE :search OR description LIKE :search OR performed_by LIKE :search OR module LIKE :search)";
            $queryParams[':search'] = $searchTerm;
        }

        $whereSql = implode(' AND ', $conditions);

        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE {$whereSql}");
        $stmtCount->execute($queryParams);
        $totalRecords = (int)$stmtCount->fetchColumn();

        $stmtRecords = $pdo->prepare("
            SELECT * FROM audit_logs 
            WHERE {$whereSql} 
            ORDER BY id DESC 
            LIMIT :limit OFFSET :offset
        ");
        
        foreach ($queryParams as $key => $val) {
            $stmtRecords->bindValue($key, $val);
        }
        $stmtRecords->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmtRecords->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmtRecords->execute();
        
        $logs = $stmtRecords->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $formattedLogs = array_map(function($l) {
            $l['id'] = (int)$l['id'];
            if (!empty($l['created_at'])) {
                $d = new \DateTime($l['created_at']);
                $l['formatted_date'] = $d->format('d F Y h:i A');
            } else {
                $l['formatted_date'] = '—';
            }
            return $l;
        }, $logs);

        $stmtModules = $pdo->prepare("
            SELECT DISTINCT module 
            FROM audit_logs 
            WHERE target_school = :school_id AND module IS NOT NULL AND module != ''
            ORDER BY module ASC
        ");
        $stmtModules->execute([':school_id' => (string)$schoolId]);
        $modules = $stmtModules->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $stmtUsers = $pdo->prepare("
            SELECT DISTINCT user, performed_by 
            FROM audit_logs 
            WHERE target_school = :school_id AND user IS NOT NULL AND user != ''
            ORDER BY performed_by ASC
        ");
        $stmtUsers->execute([':school_id' => (string)$schoolId]);
        $usersList = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'logs' => $formattedLogs,
            'total' => $totalRecords,
            'page' => $page,
            'limit' => $limit,
            'modules' => $modules,
            'users' => $usersList
        ];
    }

    public function logClientAudit(array $user, array $data): void
    {
        $pdo = $this->classRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, (int)$user['school_id']);
        $ayName = $workingYear ? $workingYear['name'] : null;

        $this->logAudit(
            $pdo,
            $user,
            (string)$data['module'],
            (string)$data['action'],
            (string)$data['description'],
            $ayName
        );
    }

    public function getSchoolLoginHistory(array $user, array $params): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $page = isset($params['page']) ? max(1, (int)$params['page']) : 1;
        $limit = isset($params['limit']) ? max(1, (int)$params['limit']) : 25;
        $offset = ($page - 1) * $limit;

        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM audit_logs 
            WHERE target_school = :school_id AND action IN ('User Logged In', 'Failed Login Attempt')
        ");
        $stmtCount->execute([':school_id' => (string)$schoolId]);
        $totalRecords = (int)$stmtCount->fetchColumn();

        $stmtRecords = $pdo->prepare("
            SELECT * FROM audit_logs 
            WHERE target_school = :school_id AND action IN ('User Logged In', 'Failed Login Attempt')
            ORDER BY id DESC 
            LIMIT :limit OFFSET :offset
        ");
        $stmtRecords->bindValue(':school_id', (string)$schoolId);
        $stmtRecords->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmtRecords->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmtRecords->execute();

        $logs = $stmtRecords->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $formattedLogs = array_map(function($l) {
            $l['id'] = (int)$l['id'];
            if (!empty($l['created_at'])) {
                $d = new \DateTime($l['created_at']);
                $l['formatted_date'] = $d->format('d F Y h:i A');
            } else {
                $l['formatted_date'] = '—';
            }
            $l['status'] = $l['action'] === 'User Logged In' ? 'Success' : 'Failed';
            return $l;
        }, $logs);

        return [
            'history' => $formattedLogs,
            'total' => $totalRecords,
            'page' => $page,
            'limit' => $limit
        ];
    }

    private function getCalendarYearForAcademicMonth(string $ayName, string $monthName): string
    {
        preg_match_all('/\d{4}/', $ayName, $matches);
        if (count($matches[0]) >= 2) {
            $startYear = $matches[0][0];
            $endYear = $matches[0][1];
        } else {
            $startYear = date('Y') - 1;
            $endYear = date('Y');
        }
        $winterMonths = ['January', 'February', 'March'];
        $year = in_array($monthName, $winterMonths, true) ? $endYear : $startYear;
        return $monthName . ' ' . $year;
    }

    private function getSalaryPaymentDescription(PDO $pdo, int $schoolId, array $payment, string $staffName): string
    {
        $paymentMonth = $payment['payment_month'];
        if (strpos($paymentMonth, 'Previous Year - ') === 0) {
            $monthsStr = substr($paymentMonth, 16);
            $payAYId = (int)$payment['academic_year_id'];
            
            $stmtPrev = $pdo->prepare("
                SELECT name FROM academic_years 
                WHERE school_id = :sid AND start_date < (SELECT start_date FROM academic_years WHERE id = :ayid LIMIT 1)
                ORDER BY start_date DESC LIMIT 1
            ");
            $stmtPrev->execute([':sid' => $schoolId, ':ayid' => $payAYId]);
            $prevYearName = $stmtPrev->fetchColumn();
            if (!$prevYearName) {
                $prevYearName = 'Previous Year';
            }
            
            $subMonths = array_map('trim', explode(',', $monthsStr));
            $formattedMonths = [];
            foreach ($subMonths as $sm) {
                $rangeParts = preg_split('/[-–]/', $sm);
                if (count($rangeParts) > 1) {
                    $formattedMonths[] = $this->getCalendarYearForAcademicMonth($prevYearName, trim($rangeParts[0])) . '–' . $this->getCalendarYearForAcademicMonth($prevYearName, trim($rangeParts[1]));
                } else {
                    $formattedMonths[] = $this->getCalendarYearForAcademicMonth($prevYearName, $sm);
                }
            }
            $resolvedMonthsString = implode(', ', $formattedMonths);
            return "Previous Year Salary – {$staffName} – {$resolvedMonthsString}";
        }
        
        return $staffName;
    }
}

