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
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Notifications\PushDispatcher;
use App\Shared\Storage\StorageService;
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
        ?StorageService $storage = null,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
        $this->storage = $storage ?? new StorageService();
    }

    private readonly StorageService $storage;

    private function isDateHoliday(int $schoolId, string $date): bool
    {
        $pdo = $this->classRepo->getPdo();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM holidays WHERE school_id = :sid AND date = :date");
        $stmt->execute([':sid' => $schoolId, ':date' => $date]);
        return ((int)$stmt->fetchColumn()) > 0;
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

        if ($this->isDateHoliday($schoolId, $destDate)) {
            throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
        }

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
            WHERE em.student_id = :student_id AND e.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $studentId, ':sid' => $schoolId]);
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

                // Let's try matching same name class first (prefer exact section match, fallback to unsectioned class)
                $stmt = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :sid AND academic_year_id = :ay_id AND name = :name 
                    ORDER BY CASE WHEN section = :section THEN 0 WHEN section IS NULL OR TRIM(section) = '' THEN 1 ELSE 2 END 
                    LIMIT 1
                ");
                $stmt->execute([
                    ':sid' => $schoolId,
                    ':ay_id' => $academicYearId,
                    ':name' => $className,
                    ':section' => $section
                ]);
                $cid = $stmt->fetchColumn();
                if ($cid !== false) {
                    return (int)$cid;
                }

                // If exact name didn't match, check next/prev class name
                preg_match('/\d+/', $className, $matches);
                if ($matches) {
                    $num = (int)$matches[0];
                    $nextClassName = str_replace((string)$num, (string)($num + 1), $className);
                    $stmt = $pdo->prepare("
                        SELECT id FROM classes 
                        WHERE school_id = :sid AND academic_year_id = :ay_id AND name = :name 
                        ORDER BY CASE WHEN section = :section THEN 0 WHEN section IS NULL OR TRIM(section) = '' THEN 1 ELSE 2 END 
                        LIMIT 1
                    ");
                    $stmt->execute([
                        ':sid' => $schoolId,
                        ':ay_id' => $academicYearId,
                        ':name' => $nextClassName,
                        ':section' => $section
                    ]);
                    $nextCid = $stmt->fetchColumn();
                    if ($nextCid !== false) {
                        return (int)$nextCid;
                    }
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
        $schoolId = 0;
        if (isset($user['school_id']) && (int)$user['school_id'] > 0) {
            $schoolId = (int) $user['school_id'];
        }

        $userId = (int) ($user['id'] ?? 0);
        $phone = trim((string)($user['phone'] ?? ''));

        $pdo = $this->studentRepo->getPdo();

        if ($schoolId <= 0 && $userId > 0) {
            $stmt = $pdo->prepare("SELECT school_id FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $userId]);
            $val = $stmt->fetchColumn();
            if ($val !== false && (int)$val > 0) {
                $schoolId = (int)$val;
            }
        }

        if ($schoolId <= 0 && !empty($phone)) {
            $stmtStaff = $pdo->prepare("SELECT school_id FROM staff WHERE phone = :phone AND school_id > 0 ORDER BY id DESC LIMIT 1");
            $stmtStaff->execute([':phone' => $phone]);
            $val = $stmtStaff->fetchColumn();
            if ($val !== false && (int)$val > 0) {
                $schoolId = (int)$val;
            }
        }

        if ($schoolId <= 0 && !empty($phone)) {
            $stmtStu = $pdo->prepare("SELECT school_id FROM students WHERE (parent_phone = :p1 OR father_phone = :p2 OR student_mobile = :p3) AND school_id > 0 ORDER BY id DESC LIMIT 1");
            $stmtStu->execute([':p1' => $phone, ':p2' => $phone, ':p3' => $phone]);
            $val = $stmtStu->fetchColumn();
            if ($val !== false && (int)$val > 0) {
                $schoolId = (int)$val;
            }
        }

        return $schoolId;
    }

    private function generateUniqueRefNo(PDO $pdo): string
    {
        $micro = microtime(true);
        $sec = (int)$micro;
        $milli = sprintf('%03d', (int)(($micro - $sec) * 1000));
        $rnd = sprintf('%02d', rand(10, 99));
        return $sec . $milli . $rnd;
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
        $this->ensureDiscountAndPartialSchema($pdo);

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
                    foreach ($activeStudents as $student) {
                        $pendingFeesTotal += $this->getStudentCurrentOutstandingBalance($pdo, (int)$student['id'], $schoolId, (int)$activeYear['id']);
                    }
                }
            }
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
            
            // Query 1: Regular monthly fee payments for this academic year (grouped by deposit payment_date)
            $stmtFeeChart = $pdo->prepare("
                SELECT fp.payment_date, fp.created_at, fp.amount_paid
                FROM fee_payments fp
                WHERE fp.school_id = :school_id 
                  AND fp.academic_year_id = :academic_year_id 
                  AND fp.status IN ('PAID', 'Partial')
            ");
            $stmtFeeChart->execute([':school_id' => $schoolId, ':academic_year_id' => $activeYear['id']]);
            while ($row = $stmtFeeChart->fetch(\PDO::FETCH_ASSOC)) {
                $amt = (float)($row['amount_paid'] ?? 0);
                if ($amt <= 0) continue;

                $dateStr = !empty($row['payment_date']) ? $row['payment_date'] : ($row['created_at'] ?? '');
                if (!empty($dateStr)) {
                    $mName = date('F', strtotime($dateStr));
                    if (isset($feeMap[$mName])) {
                        $feeMap[$mName]['amount'] += $amt;
                        $feeMap[$mName]['transactions'] += 1;
                    }
                }
            }

            // Query 2: Additional fee payments for this academic year (grouped by deposit payment_date)
            $stmtAddFeeChart = $pdo->prepare("
                SELECT afp.payment_date, afp.created_at, COALESCE(afp.amount_paid, afp.amount) AS amount
                FROM additional_fee_payments afp
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                WHERE afp.school_id = :school_id 
                  AND aft.academic_year_id = :academic_year_id 
                  AND LOWER(afp.status) IN ('paid', 'partial')
            ");
            $stmtAddFeeChart->execute([':school_id' => $schoolId, ':academic_year_id' => $activeYear['id']]);
            while ($row = $stmtAddFeeChart->fetch(\PDO::FETCH_ASSOC)) {
                $amt = (float)($row['amount'] ?? 0);
                if ($amt <= 0) continue;

                $dateStr = !empty($row['payment_date']) ? $row['payment_date'] : ($row['created_at'] ?? '');
                if (!empty($dateStr)) {
                    $mName = date('F', strtotime($dateStr));
                    if (isset($feeMap[$mName])) {
                        $feeMap[$mName]['amount'] += $amt;
                        $feeMap[$mName]['transactions'] += 1;
                    }
                }
            }

            foreach ($academicMonths as $m) {
                $short = substr($m, 0, 3);
                $feeCollectionChart[] = [
                    'month' => $short,
                    'label' => $m,
                    'amount' => round($feeMap[$m]['amount'], 2),
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

        $schoolRow = $pdo->query("SELECT plan FROM schools WHERE id = " . (int)$schoolId)->fetch(PDO::FETCH_ASSOC);
        $planName = $schoolRow['plan'] ?? 'Premium';

        $stmtPlan = $pdo->prepare("SELECT student_limit FROM plans WHERE name = :name LIMIT 1");
        $stmtPlan->execute([':name' => $planName]);
        $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);
        $studentLimit = $plan ? ($plan['student_limit'] !== null ? (int)$plan['student_limit'] : null) : null;

        $ayid = $activeYear ? (int)$activeYear['id'] : null;

        return [
            'students_count' => $this->studentRepo->countBySchool($schoolId, 'ACTIVE', $ayid),
            'staff_count'    => $this->staffRepo->countBySchool($schoolId, 'ACTIVE', $ayid),
            'classes_count'  => $this->classRepo->countBySchool($schoolId),
            'pending_fees'   => $pendingFeesTotal,
            'total_collected' => $this->feeRepo->getTotalCollectedBySchool($schoolId, $ayid),
            'fee_collection_chart' => $feeCollectionChart,
            'salary_disbursement_chart' => $salaryDisbursementChart,
            'subscription_plan' => $planName,
            'subscription_student_limit' => $studentLimit,
        ];
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

    private function getNextClassNameForPromotion(string $rawClassName): ?string
    {
        $name = trim($rawClassName);
        if (empty($name)) return null;

        $clean = trim((string)preg_replace('/\s*[-–(].*$/', '', $name));

        $classOrder = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
        foreach ($classOrder as $index => $cName) {
            if (strcasecmp($clean, $cName) === 0) {
                if ($index + 1 < count($classOrder)) {
                    return $classOrder[$index + 1];
                }
                return null;
            }
        }
        $ordinals = [
            'nursery' => 'LKG', 'pre-nursery' => 'Nursery', 'playgroup' => 'Nursery',
            'lkg' => 'UKG', 'lower kindergarten' => 'UKG', 'lower kindergarten (lkg)' => 'UKG', 'kg 1' => 'UKG',
            'ukg' => 'Class 1', 'upper kindergarten' => 'Class 1', 'upper kindergarten (ukg)' => 'Class 1', 'kg' => 'Class 1', 'kg 2' => 'Class 1',
            '1st' => 'Class 2', 'class 1st' => 'Class 2', 'class 1' => 'Class 2', '1' => 'Class 2',
            '2nd' => 'Class 3', 'class 2nd' => 'Class 3', 'class 2' => 'Class 3', '2' => 'Class 3',
            '3rd' => 'Class 4', 'class 3rd' => 'Class 4', 'class 3' => 'Class 4', '3' => 'Class 4',
            '4th' => 'Class 5', 'class 4th' => 'Class 5', 'class 4' => 'Class 5', '4' => 'Class 5',
            '5th' => 'Class 6', 'class 5th' => 'Class 6', 'class 5' => 'Class 6', '5' => 'Class 6',
            '6th' => 'Class 7', 'class 6th' => 'Class 7', 'class 6' => 'Class 7', '6' => 'Class 7',
            '7th' => 'Class 8', 'class 8th' => 'Class 8', 'class 7' => 'Class 8', '7' => 'Class 8',
            '8th' => 'Class 9', 'class 8th' => 'Class 9', 'class 8' => 'Class 9', '8' => 'Class 9',
            '9th' => 'Class 10', 'class 9th' => 'Class 10', 'class 9' => 'Class 10', '9' => 'Class 10',
            '10th' => 'Class 11', 'class 10th' => 'Class 11', 'class 10' => 'Class 11', '10' => 'Class 11',
            '11th' => 'Class 12', 'class 11th' => 'Class 12', 'class 11' => 'Class 12', '11' => 'Class 12',
        ];

        $lower = strtolower($clean);
        if (isset($ordinals[$lower])) {
            return $ordinals[$lower];
        }

        if (preg_match('/(\d+)/', $clean, $matches)) {
            $num = (int)$matches[1];
            if ($num >= 1 && $num < 12) {
                return 'Class ' . ($num + 1);
            }
        }

        return null;
    }

    private function repairUnassignedClassesForActiveStudents(PDO $pdo, int $schoolId, ?int $academicYearId = null): void
    {
        if ($academicYearId === null || $academicYearId <= 0) {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : null;
        }
        if ($academicYearId === null || $academicYearId <= 0) {
            return;
        }

        try {
            $stmtNull = $pdo->prepare("
                SELECT s.id, s.name, s.sr_no, s.admission_no, s.father_name 
                FROM students s 
                WHERE s.school_id = :sid AND s.academic_year_id = :ayid AND (s.class_id IS NULL OR s.class_id = 0) AND s.status = 'ACTIVE'
            ");
            $stmtNull->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
            $nullStudents = $stmtNull->fetchAll(PDO::FETCH_ASSOC);

            if (empty($nullStudents)) {
                return;
            }

            foreach ($nullStudents as $ns) {
                $studentId = (int)$ns['id'];
                $srNo = $ns['sr_no'] ?? '';
                $admNo = $ns['admission_no'] ?? '';
                $name = $ns['name'];
                
                $stmtPrev = $pdo->prepare("
                    SELECT s.class_id, c.name AS prev_class_name, c.stream
                    FROM students s
                    JOIN classes c ON s.class_id = c.id
                    WHERE s.school_id = :sid 
                      AND s.academic_year_id != :ayid 
                      AND (
                        (s.sr_no = :sr_no1 AND :sr_no2 != '' AND :sr_no3 IS NOT NULL) OR 
                        (s.admission_no = :adm_no1 AND :adm_no2 != '' AND :adm_no3 IS NOT NULL) OR 
                        (s.name = :name)
                      )
                    ORDER BY s.id DESC LIMIT 1
                ");
                $stmtPrev->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $academicYearId,
                    ':sr_no1' => $srNo,
                    ':sr_no2' => $srNo,
                    ':sr_no3' => $srNo,
                    ':adm_no1' => $admNo,
                    ':adm_no2' => $admNo,
                    ':adm_no3' => $admNo,
                    ':name' => $name
                ]);
                $prevRec = $stmtPrev->fetch(PDO::FETCH_ASSOC);

                if ($prevRec && !empty($prevRec['prev_class_name'])) {
                    $prevClassName = $prevRec['prev_class_name'];
                    $nextClassName = $this->getNextClassNameForPromotion($prevClassName) ?: $prevClassName;
                    
                    $targetClassId = $this->findClassByNameAndSection($pdo, $schoolId, $academicYearId, $nextClassName, null, $prevRec['stream'] ?? null);
                    if ($targetClassId === null) {
                        $stmtInsC = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:sid, :name, NULL, :stream, :ayid)");
                        $stmtInsC->execute([
                            ':sid' => $schoolId,
                            ':name' => trim($nextClassName),
                            ':stream' => $prevRec['stream'] ?? null,
                            ':ayid' => $academicYearId
                        ]);
                        $targetClassId = (int)$pdo->lastInsertId();
                    }

                    if ($targetClassId) {
                        $stmtFix = $pdo->prepare("UPDATE students SET class_id = :cid WHERE id = :id AND school_id = :sid");
                        $stmtFix->execute([':cid' => $targetClassId, ':id' => $studentId, ':sid' => $schoolId]);
                    }
                }
            }
        } catch (\Throwable $e) {}
    }

    public function getStudents(array $user, array $filters = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        // Auto-reassign any unsectioned students whose class now has sections to Section A
        try {
            $stmtAutoReassign = $pdo->prepare("
                UPDATE students s
                JOIN classes c_old ON s.class_id = c_old.id
                JOIN classes c_new ON c_old.school_id = c_new.school_id 
                                  AND c_old.name COLLATE utf8mb4_unicode_ci = c_new.name COLLATE utf8mb4_unicode_ci
                SET s.class_id = c_new.id
                WHERE s.school_id = :sid 
                  AND (c_old.section IS NULL OR TRIM(c_old.section) = '')
                  AND c_new.section IS NOT NULL 
                  AND TRIM(c_new.section) != ''
            ");
            $stmtAutoReassign->execute([':sid' => $schoolId]);
        } catch (\Throwable $e) {}

        if (empty($filters['academic_year_id'])) {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            if ($workingYear) {
                $filters['academic_year_id'] = (int)$workingYear['id'];
            }
        }
        $targetAyId = !empty($filters['academic_year_id']) ? (int)$filters['academic_year_id'] : null;
        $this->repairUnassignedClassesForActiveStudents($pdo, $schoolId, $targetAyId);

        $students = $this->studentRepo->findBySchool($schoolId, $filters);
        return $students;
    }

    public function getStudentById(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;

        $this->repairUnassignedClassesForActiveStudents($pdo, $schoolId, $workingYearId);

        $student = $this->studentRepo->findDetailById($schoolId, $id);
        if ($student === null) {
            throw new NotFoundException('Student not found');
        }

        $pdo = $this->studentRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : ($student['academic_year_id'] !== null ? (int)$student['academic_year_id'] : 0);
        
        $workingYearClassId = $this->getStudentClassForYear($pdo, $id, $schoolId, $workingYearId);
        $targetClassId = $workingYearClassId !== null ? $workingYearClassId : $student['class_id'];

        if ($targetClassId !== null) {
            $student['class_id'] = (int)$targetClassId;
            $stmtClassName = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
            $stmtClassName->execute([':cid' => $targetClassId]);
            $cls = $stmtClassName->fetch(PDO::FETCH_ASSOC);
            if ($cls) {
                $sec = (!empty($cls['section']) && trim((string)$cls['section']) !== '') ? trim((string)$cls['section']) : null;
                $student['section'] = $sec;
                $sectionStr = ($sec !== null && $sec !== '') ? ' - ' . $sec : '';
                $student['class_name'] = $cls['name'] . $sectionStr;
            }
        } else if (!empty($student['class_name'])) {
            $sec = (!empty($student['section']) && trim((string)$student['section']) !== '') ? trim((string)$student['section']) : null;
            $student['section'] = $sec;
            $sectionStr = ($sec !== null && $sec !== '') ? ' - ' . $sec : '';
            $student['class_name'] = $student['class_name'] . $sectionStr;
        }

        $this->ensureDiscountAndPartialSchema($pdo);

        $isLedgerLocked = false;
        $ledgerLockedMessage = '';
        if ($this->isStudentPromoted($pdo, $id, $schoolId)) {
            $isLedgerLocked = true;
            $ledgerLockedMessage = "This student's outstanding balance has already been migrated to the current Academic Year as 'Previous Year Dues'. Payment can only be collected from the current Academic Year.";
        }

        $feeStmt = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) AS total_paid, COUNT(*) AS payment_count
            FROM fee_payments
            WHERE student_id = :student_id AND status IN ('PAID', 'Partial')
        ");
        $feeStmt->execute([':student_id' => $id]);
        $feeSummary = $feeStmt->fetch(PDO::FETCH_ASSOC);

        $paymentsStmt = $pdo->prepare("
            SELECT * FROM fee_payments
            WHERE student_id = :student_id AND status IN ('PAID', 'Partial')
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

            if (!$cfgRow) {
                // Fallback: Check if any other section/class record with the same class name has a fee configuration
                $stmtFallbackCfg = $pdo->prepare("
                    SELECT cfg.* 
                    FROM class_fee_configurations cfg
                    JOIN classes c1 ON cfg.class_id = c1.id
                    JOIN classes c2 ON c1.name COLLATE utf8mb4_unicode_ci = c2.name COLLATE utf8mb4_unicode_ci AND c1.school_id = c2.school_id
                    WHERE cfg.school_id = :school_id AND c2.id = :class_id AND cfg.academic_year_id = :academic_year_id
                    LIMIT 1
                ");
                $stmtFallbackCfg->execute([
                    ':school_id' => $schoolId,
                    ':class_id' => $workingYearClassId,
                    ':academic_year_id' => $workingYearId
                ]);
                $cfgRow = $stmtFallbackCfg->fetch(PDO::FETCH_ASSOC);
                if ($cfgRow) {
                    // Auto-sync for this class section ID
                    $stmtInsSync = $pdo->prepare("
                        INSERT INTO class_fee_configurations (school_id, class_id, academic_year_id, mode, monthly_fees, is_locked)
                        VALUES (:sid, :cid, :ayid, :mode, :fees, :locked)
                        ON DUPLICATE KEY UPDATE mode = VALUES(mode), monthly_fees = VALUES(monthly_fees)
                    ");
                    $stmtInsSync->execute([
                        ':sid' => $schoolId,
                        ':cid' => $workingYearClassId,
                        ':ayid' => $workingYearId,
                        ':mode' => $cfgRow['mode'],
                        ':fees' => is_array($cfgRow['monthly_fees']) ? json_encode($cfgRow['monthly_fees']) : $cfgRow['monthly_fees'],
                        ':locked' => (int)$cfgRow['is_locked']
                    ]);
                }
            }

            if ($cfgRow) {
                $classFeeConfig = $cfgRow;
                $classFeeConfig['monthly_fees'] = is_string($cfgRow['monthly_fees']) ? json_decode($cfgRow['monthly_fees'], true) : $cfgRow['monthly_fees'];
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
            $ap['amount_paid'] = isset($ap['amount_paid']) && $ap['amount_paid'] !== null ? (float)$ap['amount_paid'] : ($ap['status'] === 'Paid' ? (float)$ap['amount'] : 0.0);
            $ap['discount_amount'] = (float)($ap['discount_amount'] ?? 0.0);
            return $ap;
        }, $additionalPayments);

        // Fetch student documents
        $documents = [];
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `student_documents` (
                  `id` int NOT NULL AUTO_INCREMENT,
                  `school_id` int NOT NULL,
                  `student_id` int NOT NULL,
                  `category` varchar(100) NOT NULL,
                  `file_name` varchar(255) NOT NULL,
                  `file_path` varchar(255) NOT NULL,
                  `file_size` int NOT NULL,
                  `upload_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  KEY `school_id` (`school_id`),
                  KEY `student_id` (`student_id`),
                  CONSTRAINT `student_documents_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
                  CONSTRAINT `student_documents_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $stmtDocs = $pdo->prepare("SELECT * FROM student_documents WHERE student_id = :sid ORDER BY id ASC");
            $stmtDocs->execute([':sid' => $id]);
            $documents = $stmtDocs->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {}

        $student['documents'] = $documents;

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

    public function getFeeReceipt(array $user, int $studentId, int $paymentId, bool $isAdditional): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        if ($isAdditional) {
            $stmt = $pdo->prepare("
                SELECT 
                    afph.id AS history_id,
                    afp.id,
                    COALESCE(afph.receipt_no, afp.receipt_no) AS receipt_no,
                    COALESCE(afph.amount_paid, afp.amount_paid, afp.amount) AS amount_paid,
                    COALESCE(afph.discount_amount, afp.discount_amount, 0) AS discount_amount,
                    COALESCE(afph.payment_method, afp.payment_method) AS payment_method,
                    COALESCE(afph.collected_by, afp.collected_by) AS collected_by,
                    COALESCE(afph.payment_date, afp.payment_date) AS payment_date,
                    s.first_name, s.last_name, s.roll_no, s.sr_no, c.name AS class_name, c.section, sch.name AS school_name, sch.logo_path, aft.name AS fee_name, ay.name AS academic_year_name
                FROM additional_fee_payments afp
                LEFT JOIN additional_fee_payment_history afph ON afph.payment_id = afp.id
                JOIN students s ON afp.student_id = s.id
                LEFT JOIN classes c ON s.class_id = c.id
                JOIN schools sch ON afp.school_id = sch.id
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE (afph.id = :id_1 OR afp.id = :id_2 OR afph.receipt_no = :rno_1 OR afp.receipt_no = :rno_2) 
                  AND afp.student_id = :student_id 
                  AND afp.school_id = :sid
                ORDER BY afph.id DESC
                LIMIT 1
            ");
            $stmt->execute([
                ':id_1' => $paymentId,
                ':id_2' => $paymentId,
                ':rno_1' => (string)$paymentId,
                ':rno_2' => (string)$paymentId,
                ':student_id' => $studentId,
                ':sid' => $schoolId
            ]);
            $payment = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$payment) {
                throw new NotFoundException('Additional fee payment record not found');
            }
            $title = "Exam Fees";
            if (!empty($payment['fee_name'])) {
                $title = $payment['fee_name'];
            }
            $rupee = mb_chr(0x20B9, 'UTF-8');
            $billingItemLabel = "Description: ";
            $feeMonthDisplay = $title;
            $receiptNo = !empty($payment['receipt_no']) ? $payment['receipt_no'] : ("AFP-" . str_pad((string)$payment['id'], 5, '0', STR_PAD_LEFT));
            $monthTitle = $title;
            $totalAmountPaid = (float)($payment['amount_paid'] ?? 0.0);
            $totalDiscountAmount = (float)($payment['discount_amount'] ?? 0.0);
            $totalPayableAmount = $totalAmountPaid + $totalDiscountAmount;
            $amountPaidFormatted = "Rs " . number_format((float)$totalAmountPaid, 0);
        } else {
            $stmt = $pdo->prepare("
                SELECT fp.*, s.first_name, s.last_name, s.roll_no, s.sr_no, c.name AS class_name, c.section, sch.name AS school_name, sch.logo_path, ay.name AS academic_year_name
                FROM fee_payments fp
                JOIN students s ON fp.student_id = s.id
                LEFT JOIN classes c ON s.class_id = c.id
                JOIN schools sch ON fp.school_id = sch.id
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE fp.id = :id AND fp.student_id = :student_id AND fp.school_id = :sid
                LIMIT 1
            ");
            $stmt->execute([':id' => $paymentId, ':student_id' => $studentId, ':sid' => $schoolId]);
            $payment = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$payment) {
                throw new NotFoundException('Fee payment record not found');
            }
            $receiptNo = $payment['receipt_no'];
            $monthTitle = $payment['fee_month'];

            $stmtGrp = $pdo->prepare("SELECT fee_month, amount_paid, COALESCE(discount_amount, 0) AS discount_amount FROM fee_payments WHERE receipt_no = :receipt_no AND school_id = :sid");
            $stmtGrp->execute([':receipt_no' => $receiptNo, ':sid' => $schoolId]);
            $groupPayments = $stmtGrp->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            if (empty($groupPayments)) {
                $feeMonthDisplay = !empty($payment['fee_month']) ? $payment['fee_month'] : 'April';
                $totalAmountPaid = (float)($payment['amount_paid'] ?? 0.0);
                $totalDiscountAmount = (float)($payment['discount_amount'] ?? 0.0);
                $billingItemLabel = "Billing Month: ";
            } else {
                $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                usort($groupPayments, function($a, $b) use ($academicMonths) {
                    $idxA = array_search(trim($a['fee_month']), $academicMonths);
                    $idxB = array_search(trim($b['fee_month']), $academicMonths);
                    if ($idxA === false) $idxA = 99;
                    if ($idxB === false) $idxB = 99;
                    return $idxA - $idxB;
                });
                
                $monthsList = array_values(array_filter(array_column($groupPayments, 'fee_month')));
                if (empty($monthsList)) {
                    $monthsList = [!empty($payment['fee_month']) ? $payment['fee_month'] : 'April'];
                }

                $indices = [];
                foreach ($monthsList as $m) {
                    $idx = array_search(trim($m), $academicMonths);
                    if ($idx !== false) {
                        $indices[] = $idx;
                    }
                }
                $isConsecutive = false;
                if (count($indices) > 1 && count($indices) === count($monthsList)) {
                    $isConsecutive = true;
                    for ($i = 1; $i < count($indices); $i++) {
                        if ($indices[$i] !== $indices[$i - 1] + 1) {
                            $isConsecutive = false;
                            break;
                        }
                    }
                }
                if ($isConsecutive && count($monthsList) > 1) {
                    $feeMonthDisplay = reset($monthsList) . " To " . end($monthsList);
                } else {
                    $feeMonthDisplay = implode(', ', $monthsList);
                }
                $totalAmountPaid = array_sum(array_column($groupPayments, 'amount_paid'));
                $totalDiscountAmount = array_sum(array_column($groupPayments, 'discount_amount'));
                $billingItemLabel = count($monthsList) > 1 ? "Billing Months: " : "Billing Month: ";
            }
            $amountPaidFormatted = "Rs " . number_format((float)$totalAmountPaid, 0);
        }

        $totalPayableAmount = $totalAmountPaid + ($totalDiscountAmount ?? 0.0);

        // Format payment date
        $months = [
            '01' => 'Jan', '02' => 'Feb', '03' => 'Mar', '04' => 'Apr',
            '05' => 'May', '06' => 'Jun', '07' => 'Jul', '08' => 'Aug',
            '09' => 'Sep', '10' => 'Oct', '11' => 'Nov', '12' => 'Dec'
        ];
        $paymentDateFormatted = '—';
        if (!empty($payment['payment_date'])) {
            $parts = explode('-', $payment['payment_date']);
            if (count($parts) === 3) {
                $mWord = $months[$parts[1]] ?? '';
                $paymentDateFormatted = "{$parts[2]} {$mWord} {$parts[0]}";
            }
        }

        $studentName = trim($payment['first_name'] . ' ' . ($payment['last_name'] !== '.' ? $payment['last_name'] : ''));
        $classDisplay = $payment['class_name'] . (!empty($payment['section']) ? ' - ' . $payment['section'] : '');

        $paymentMethod = !empty($payment['payment_method']) ? $payment['payment_method'] : 'Cash';
        $m = strtolower($paymentMethod);
        if ($m === 'cash') {
            $paymentMode = 'Cash';
        } elseif ($m === 'cheque') {
            $paymentMode = 'Cheque';
        } else {
            $paymentMode = 'Online';
        }

        $rollNo = $payment['roll_no'] ?? '—';
        $srNo = $payment['sr_no'] ?? '—';
        $rollSrDisplay = "{$rollNo} / {$srNo}";

        $rawAcademicYear = !empty($payment['academic_year_name']) ? $payment['academic_year_name'] : '2026-2027';
        $academicYear = str_replace(['–', '—'], '-', $rawAcademicYear);

        $lines = [
            "FEE PAYMENT RECEIPT",
            "Logo Path: " . ($payment['logo_path'] ?? ''),
            "---",
            "Mode of Payment: " . $paymentMode,
            "Student Name: " . strtoupper($studentName),
            "Class & Section: " . $classDisplay,
            "Roll Number / SR No: " . $rollSrDisplay,
            "Ref No: " . $receiptNo,
            "Academic Year: " . $academicYear,
            "Payment Date: " . $paymentDateFormatted,
            "---",
            $billingItemLabel . $feeMonthDisplay,
        ];

        if (!empty($totalDiscountAmount) && $totalDiscountAmount > 0) {
            $lines[] = "Payable Amount: Rs " . number_format($totalPayableAmount, 0);
            $lines[] = "Discount: Rs " . number_format($totalDiscountAmount, 0);
        }

        $lines[] = "Total Amount: " . $amountPaidFormatted;
        $lines[] = "---";
        $lines[] = "Status: PAID";
        $lines[] = "---";
        $lines[] = "This is an automated system generated receipt. Thank you for your payment.";

        $pdf = new \App\Shared\Pdf\SimplePdf();
        $pdfData = $pdf->render(strtoupper($payment['school_name']), $lines);
        $filename = str_replace(' ', '_', $monthTitle) . "_Fee_Receipt.pdf";

        return [
            'data' => $pdfData,
            'filename' => $filename
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

        // Verify subscription student limit
        $school = $pdo->query("SELECT plan FROM schools WHERE id = " . (int)$schoolId)->fetch(PDO::FETCH_ASSOC);
        $planName = $school['plan'] ?? 'Premium';

        $stmtPlan = $pdo->prepare("SELECT student_limit FROM plans WHERE name = :name LIMIT 1");
        $stmtPlan->execute([':name' => $planName]);
        $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);

        if ($plan && $plan['student_limit'] !== null && (int)$plan['student_limit'] > 0) {
            $limit = (int)$plan['student_limit'];
            
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND status = 'ACTIVE'");
            $stmtCount->execute([':school_id' => $schoolId]);
            $currentCount = (int)$stmtCount->fetchColumn();

            if ($currentCount >= $limit) {
                throw new ValidationException([
                    'subscription_limit_reached' => true,
                    'limit' => $limit,
                    'message' => "Your current subscription plan allows a maximum of {$limit} students. You have already reached this limit."
                ], 'Student limit reached.');
            }
        }
        
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
        } else {
            $dobTime = strtotime($data['dob']);
            if ($dobTime !== false && $dobTime > time()) {
                $errors['dob'] = 'Date of birth cannot be a future date';
            }
        }
        if (empty($data['class_id']) && empty($data['class_name'])) {
            $errors['class_id'] = 'Class ID is required.';
        }

        // Email and phone formats
        if (!empty($data['student_email']) && !filter_var($data['student_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['student_email'] = 'Invalid student email format';
        }
        if (!empty($data['student_mobile']) && !preg_match('/^[0-9]{10}$/', trim($data['student_mobile']))) {
            $errors['student_mobile'] = 'Mobile No should be exactly 10 digits';
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
        if (!empty($data['current_address_line']) && mb_strlen(trim((string)$data['current_address_line'])) > 50) {
            $errors['current_address_line'] = 'Address cannot exceed 50 characters.';
        }
        if (!empty($data['permanent_address_line']) && mb_strlen(trim((string)$data['permanent_address_line'])) > 50) {
            $errors['permanent_address_line'] = 'Address cannot exceed 50 characters.';
        }

        if (!empty($errors)) {
            throw new ValidationException($errors, 'Validation failed.');
        }

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // Resolve class_id and verify it exists in master catalog and school's added classes
        $classId = null;
        $reqClassInput = $data['class_id'] ?? $data['class_name'] ?? null;

        if (empty($reqClassInput)) {
            throw new ValidationException(['class_id' => 'Class ID is required.'], 'Class ID is required.');
        }

        if (is_numeric($reqClassInput)) {
            $reqId = (int)$reqClassInput;
            // 1. Direct school class ID check
            $stmtDirect = $pdo->prepare("SELECT id FROM classes WHERE id = :cid AND school_id = :sid LIMIT 1");
            $stmtDirect->execute([':cid' => $reqId, ':sid' => $schoolId]);
            $directClassId = $stmtDirect->fetchColumn();

            if ($directClassId) {
                $classId = (int)$directClassId;
            } else {
                // 2. Check if reqId matches a Master Class ID (e.g. 15 -> Class 11, 14 -> Class 10, 5 -> Class 1)
                $masterClass = $this->resolveMasterClass($reqId);
                if ($masterClass) {
                    $stmtCheckMaster = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name) LIMIT 1");
                    $stmtCheckMaster->execute([':sid' => $schoolId, ':name' => $masterClass['name']]);
                    $foundId = $stmtCheckMaster->fetchColumn();

                    if ($foundId) {
                        $classId = (int)$foundId;
                    } else {
                        throw new ValidationException([
                            'class_id' => 'This class is not added in your Academy yet. Please add the class first.'
                        ], 'This class is not added in your Academy yet. Please add the class first.');
                    }
                } else {
                    throw new ValidationException([
                        'class_id' => 'The selected class does not exist in master catalog.'
                    ], 'The selected class does not exist in master catalog.');
                }
            }
        } else {
            // String input (e.g. "Class 11" or "B.Tech")
            $classNameInput = trim((string)$reqClassInput);
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

            $masterClass = $this->resolveMasterClass($finalName);
            if ($masterClass) {
                $existingClassId = $this->findClassByNameAndSection($pdo, $schoolId, $academicYearId > 0 ? $academicYearId : null, $finalName, $section);
                if ($existingClassId !== null) {
                    $classId = $existingClassId;
                } else {
                    throw new ValidationException([
                        'class_id' => 'This class is not added in your Academy yet. Please add the class first.'
                    ], 'This class is not added in your Academy yet. Please add the class first.');
                }
            } else {
                throw new ValidationException([
                    'class_id' => 'The selected class does not exist in master catalog.'
                ], 'The selected class does not exist in master catalog.');
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

        // Uniqueness check for Roll Number in the same class
        if ($classId !== null && !empty($data['roll_no'])) {
            $rollNoVal = trim((string)$data['roll_no']);
            if ($this->checkRollNoExistsInternal($pdo, $schoolId, (int)$classId, $rollNoVal)) {
                $errors['roll_no'] = 'The roll no is already assigned';
            }
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
        $lastNameVal = ($data['last_name'] ?? '') === '.' ? '' : ($data['last_name'] ?? '');
        $name = trim($data['first_name'] . ' ' . ($data['middle_name'] ?? '') . ' ' . $lastNameVal);
        $name = (string)preg_replace('/\s+/', ' ', $name);

        // System defaults for status based on exit date
        $exitDate = !empty($data['exit_date']) ? $data['exit_date'] : null;
        $status = $exitDate !== null ? 'Inactive' : 'ACTIVE';
        $admissionDate = !empty($data['admission_date']) ? $data['admission_date'] : date('Y-m-d');

        $admissionFee = isset($data['admission_fee']) && $data['admission_fee'] !== '' ? (float)$data['admission_fee'] : null;
        if ($admissionFee !== null && $admissionFee < 0) {
            throw new ValidationException(['admission_fee' => 'Admission Fee cannot be negative.']);
        }

        $isFirstAY = $this->isFirstAcademicYear($schoolId, $academicYearId);
        $studentCategory = !empty($data['student_category']) ? trim($data['student_category']) : null;
        if ($isFirstAY) {
            if (empty($studentCategory) || !in_array($studentCategory, ['Existing Student', 'New Admission'], true)) {
                throw new ValidationException(['student_category' => 'Student Category (Existing Student or New Admission) is required.']);
            }
        } else {
            // In all subsequent academic years (after migration), any newly enrolled student is 100% a 'New Admission'!
            if (empty($studentCategory)) {
                $studentCategory = 'New Admission';
            }
        }

        if ($studentCategory === 'Existing Student' && $admissionFee !== null && $admissionFee > 0) {
            throw new ValidationException(['admission_fee' => 'Not allowed for existing student']);
        }

        $parentPhone = !empty($data['parent_phone']) ? trim((string)$data['parent_phone']) : (!empty($data['father_phone']) ? trim((string)$data['father_phone']) : (!empty($data['student_mobile']) ? trim((string)$data['student_mobile']) : null));
        $fatherPhone = !empty($data['father_phone']) ? trim((string)$data['father_phone']) : $parentPhone;

        // Unconditionally check if any entered phone is a Super Admin or School Admin number
        $this->checkAdminOrSuperAdminPhoneConflict($pdo, [
            $parentPhone,
            $fatherPhone,
            $data['student_mobile'] ?? null,
            $data['father_phone'] ?? null,
            $data['mother_phone'] ?? null,
            $data['parent_phone'] ?? null
        ]);

        $this->checkTeacherStudentPhoneConflict($pdo, $schoolId, [$parentPhone, $fatherPhone, $data['student_mobile'] ?? null], null, 0);

        if (strcasecmp($status, 'ACTIVE') === 0 || strcasecmp($status, 'Active') === 0) {
            $this->checkActiveStudentPhoneConflictInOtherSchools($pdo, $schoolId, [$parentPhone, $fatherPhone, $data['student_mobile'] ?? null]);
        }

        $id = $this->studentRepo->create([
            'school_id'    => $schoolId,
            'name'         => $name,
            'admission_no' => null,
            'class_id'     => $classId,
            'parent_phone' => $parentPhone,
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
            'admission_fee' => $admissionFee,
            'student_category' => $studentCategory,
            'roll_no' => $rollNo,
            'house' => null,
            
            'father_name' => $data['father_name'] ?? null,
            'father_phone' => $fatherPhone,
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
            
            'photo_path' => $data['photo_path'] ?? $data['profile_image'] ?? null,
            'birth_cert_path' => $data['birth_cert_path'] ?? null,
            'aadhaar_path' => $data['aadhaar_path'] ?? null,
            'transfer_cert_path' => $data['transfer_cert_path'] ?? null,
            'report_card_path' => $data['report_card_path'] ?? null,
            'additional_docs_path' => $data['additional_docs_path'] ?? null,
            'exit_date' => $exitDate,
        ]);

        if (!empty($data['documents']) && is_array($data['documents'])) {
            $stmtDoc = $pdo->prepare("
                INSERT INTO student_documents (school_id, student_id, category, file_name, file_path, file_size)
                VALUES (:sid, :student_id, :category, :file_name, :file_path, :file_size)
            ");
            foreach ($data['documents'] as $doc) {
                $stmtDoc->execute([
                    ':sid' => $schoolId,
                    ':student_id' => $id,
                    ':category' => $doc['category'] ?? $doc['document_type'] ?? 'General',
                    ':file_name' => $doc['file_name'] ?? $doc['document_name'] ?? 'Document.pdf',
                    ':file_path' => $doc['file_path'] ?? $doc['document_url'] ?? '',
                    ':file_size' => (int)($doc['file_size'] ?? 1024)
                ]);
            }
        }

        // Auto-sync active user account for student/parent mobile login
        $this->syncUserAccountForStudent($pdo, $schoolId, $name, $parentPhone, $data['student_email'] ?? null);

        $student = $this->studentRepo->findDetailById($schoolId, $id);
        if ($student === null) {
            throw new NotFoundException('Student not found after creation');
        }

        if ($admissionFee !== null && $admissionFee > 0) {
            $this->syncAdmissionFeePayment($pdo, $schoolId, $id, $academicYearId, $admissionFee);
        }

        $this->syncExistingAnnualFeePayment($pdo, $schoolId, $id, (int)$classId, $academicYearId, $studentCategory);

        $this->log('Student created', ['id' => $id, 'school_id' => $schoolId]);
        return $student;

        $this->syncExistingAnnualFeePayment($pdo, $schoolId, $id, (int)$classId, $academicYearId, $studentCategory);

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
        } else {
            $dobTime = strtotime($data['dob']);
            if ($dobTime !== false && $dobTime > time()) {
                $errors['dob'] = 'Date of birth cannot be a future date';
            }
        }
        if (empty($data['class_name'])) {
            $errors['class_name'] = 'Class is required';
        }

        // Email and phone formats
        if (!empty($data['student_email']) && !filter_var($data['student_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['student_email'] = 'Invalid student email format';
        }
        if (!empty($data['student_mobile']) && !preg_match('/^[0-9]{10}$/', trim($data['student_mobile']))) {
            $errors['student_mobile'] = 'Mobile No should be exactly 10 digits';
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
        if (!empty($data['current_address_line']) && mb_strlen(trim((string)$data['current_address_line'])) > 50) {
            $errors['current_address_line'] = 'Address cannot exceed 50 characters.';
        }
        if (!empty($data['permanent_address_line']) && mb_strlen(trim((string)$data['permanent_address_line'])) > 50) {
            $errors['permanent_address_line'] = 'Address cannot exceed 50 characters.';
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
            
            $existingClassId = $this->findClassByNameAndSection($pdo, $schoolId, $academicYearId > 0 ? $academicYearId : null, $finalName, $section);
            if ($existingClassId !== null) {
                $classId = $existingClassId;
            } else {
                $insStmt = $pdo->prepare("INSERT INTO classes (school_id, name, section, academic_year_id) VALUES (:school_id, :name, :section, :academic_year_id)");
                $insStmt->execute([
                    ':school_id' => $schoolId,
                    ':name' => trim($finalName),
                    ':section' => $section !== null ? trim((string)$section) : null,
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

        // Uniqueness check for Roll Number in the same class
        if ($classId !== null && !empty($data['roll_no'])) {
            $rollNoVal = trim((string)$data['roll_no']);
            if ($this->checkRollNoExistsInternal($pdo, $schoolId, (int)$classId, $rollNoVal, $id)) {
                $errors['roll_no'] = 'The roll no is already assigned';
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
        $lastNameVal = ($data['last_name'] ?? '') === '.' ? '' : ($data['last_name'] ?? '');
        $name = trim($data['first_name'] . ' ' . ($data['middle_name'] ?? '') . ' ' . $lastNameVal);
        $name = (string)preg_replace('/\s+/', ' ', $name);

        // Status based on Exit Date
        $exitDate = !empty($data['exit_date']) ? $data['exit_date'] : null;
        $status = $exitDate !== null ? 'Inactive' : ($data['status'] ?? ($student['status'] ?? 'Active'));
        $parentPhone = !empty($data['parent_phone']) ? trim((string)$data['parent_phone']) : (!empty($data['father_phone']) ? trim((string)$data['father_phone']) : (!empty($data['student_mobile']) ? trim((string)$data['student_mobile']) : ($student['parent_phone'] ?? null)));
        $fatherPhone = !empty($data['father_phone']) ? trim((string)$data['father_phone']) : $parentPhone;

        $existingStatus = strtoupper($student['status'] ?? 'ACTIVE');
        $newStatus = strtoupper($status);
        $isReactivating = ($existingStatus === 'INACTIVE' && $newStatus === 'ACTIVE');

        $this->checkAdminOrSuperAdminPhoneConflict($pdo, [
            $parentPhone,
            $fatherPhone,
            $data['student_mobile'] ?? null,
            $data['father_phone'] ?? null,
            $data['mother_phone'] ?? null,
            $data['parent_phone'] ?? null
        ], $isReactivating);

        $this->checkTeacherStudentPhoneConflict($pdo, $schoolId, [$parentPhone, $fatherPhone, $data['student_mobile'] ?? null], null, $id, $isReactivating);

        $oldParentPhone = trim((string)($student['parent_phone'] ?? ''));
        $oldFatherPhone = trim((string)($student['father_phone'] ?? ''));
        $oldStudentMobile = trim((string)($student['student_mobile'] ?? ''));

        $newParentPhone = $parentPhone;
        $newFatherPhone = $fatherPhone;
        $newStudentMobile = !empty($data['student_mobile']) ? trim((string)$data['student_mobile']) : null;

        $oldPhones = array_filter(array_unique([$oldParentPhone, $oldFatherPhone, $oldStudentMobile]));
        $newPhones = array_filter(array_unique([$newParentPhone, $newFatherPhone, $newStudentMobile]));

        foreach ($oldPhones as $oldP) {
            if (empty($oldP) || strlen($oldP) < 10 || in_array($oldP, $newPhones, true)) continue;

            $stmtCheckRem = $pdo->prepare("
                SELECT COUNT(*) FROM students 
                WHERE school_id = :sid AND id != :id
                  AND (parent_phone = :p1 OR father_phone = :p2 OR student_mobile = :p3)
                  AND (status IS NULL OR UPPER(status) = 'ACTIVE')
                  AND exit_date IS NULL
            ");
            $stmtCheckRem->execute([':sid' => $schoolId, ':id' => $id, ':p1' => $oldP, ':p2' => $oldP, ':p3' => $oldP]);
            $remCount = (int)$stmtCheckRem->fetchColumn();

            if ($remCount === 0) {
                $stmtUsersOff = $pdo->prepare("UPDATE users SET status = 'INACTIVE' WHERE school_id = :sid AND phone = :oldP AND role IN ('STUDENT', 'PARENT')");
                $stmtUsersOff->execute([':sid' => $schoolId, ':oldP' => $oldP]);
            }
        }

        if ($newStatus === 'ACTIVE') {
            $this->checkActiveStudentPhoneConflictInOtherSchools($pdo, $schoolId, [$parentPhone, $fatherPhone, $data['student_mobile'] ?? null], $isReactivating, $id);
        } else {
            foreach ($newPhones as $np) {
                if (!empty($np)) {
                    $stmtUsersOff = $pdo->prepare("UPDATE users SET status = 'INACTIVE' WHERE school_id = :sid AND phone = :phone AND role IN ('STUDENT', 'PARENT')");
                    $stmtUsersOff->execute([':sid' => $schoolId, ':phone' => $np]);
                }
            }
        }

        $this->studentRepo->update($id, [
            'name'         => $name,
            'admission_no' => null,
            'class_id'     => $classId,
            'parent_phone' => $parentPhone,
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
            'student_category' => array_key_exists('student_category', $data) ? (!empty($data['student_category']) ? trim((string)$data['student_category']) : null) : ($student['student_category'] ?? null),
            'religion' => $data['religion'] ?? null,
            'aadhaar_no' => $data['aadhaar_no'] ?? null,
            'student_mobile' => $data['student_mobile'] ?? null,
            'student_email' => $data['student_email'] ?? null,
            'academic_year_id' => $academicYearId > 0 ? $academicYearId : null,
            'admission_date' => $data['admission_date'] ?? $student['admission_date'],
            'roll_no' => $rollNo,
            'house' => null,
            
            'father_name' => $data['father_name'] ?? null,
            'father_phone' => $fatherPhone,
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
            'admission_fee' => array_key_exists('admission_fee', $data) ? ($data['admission_fee'] !== null && $data['admission_fee'] !== '' ? (float)$data['admission_fee'] : null) : ($student['admission_fee'] ?? null),
        ]);

        if (array_key_exists('admission_fee', $data)) {
            $admFee = $data['admission_fee'] !== null && $data['admission_fee'] !== '' ? (float)$data['admission_fee'] : null;
            if ($admFee !== null && $admFee < 0) {
                throw new ValidationException(['admission_fee' => 'Admission Fee cannot be negative.']);
            }
            $updatedCategoryCheck = array_key_exists('student_category', $data) ? $data['student_category'] : ($student['student_category'] ?? null);
            if ($updatedCategoryCheck === 'Existing Student' && $admFee !== null && $admFee > 0) {
                throw new ValidationException(['admission_fee' => 'Not allowed for existing student']);
            }
            $this->syncAdmissionFeePayment($pdo, $schoolId, $id, $academicYearId, $admFee);
        }

        $updatedClassId = !empty($data['class_name']) ? (int)$data['class_name'] : (int)$student['class_id'];
        $updatedCategory = array_key_exists('student_category', $data) ? $data['student_category'] : ($student['student_category'] ?? null);
        // Auto-sync user account status for student/parent login
        $this->syncUserAccountForStudent($pdo, $schoolId, $name, $parentPhone, $data['student_email'] ?? null, $status);

        return $this->studentRepo->findDetailById($schoolId, $id);
    }

    private function syncAdmissionFeePayment(PDO $pdo, int $schoolId, int $studentId, ?int $academicYearId, ?float $admissionFee): void
    {
        if ($academicYearId === null || $academicYearId <= 0) {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : null;
        }
        if ($academicYearId === null) {
            return;
        }

        // Find or create 'Admission Fee' type in additional_fee_types
        $stmtType = $pdo->prepare("
            SELECT id FROM additional_fee_types 
            WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Admission Fee' LIMIT 1
        ");
        $stmtType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $typeId = $stmtType->fetchColumn();

        if ($typeId === false) {
            if ($admissionFee === null || $admissionFee <= 0) {
                return;
            }
            $stmtInsType = $pdo->prepare("
                INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, category)
                VALUES (:sid, 'Admission Fee', 0.0, :ayid, 'Admission Fee')
            ");
            $stmtInsType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
            $typeId = (int)$pdo->lastInsertId();
        } else {
            $typeId = (int)$typeId;
        }

        // Check for existing payment record for this student and fee type
        $stmtPay = $pdo->prepare("
            SELECT id, amount, status FROM additional_fee_payments
            WHERE school_id = :sid AND student_id = :stid AND fee_type_id = :tid LIMIT 1
        ");
        $stmtPay->execute([':sid' => $schoolId, ':stid' => $studentId, ':tid' => $typeId]);
        $existingPay = $stmtPay->fetch(PDO::FETCH_ASSOC);

        if ($admissionFee !== null && $admissionFee > 0) {
            if ($existingPay) {
                if ($existingPay['status'] === 'Pending') {
                    $stmtUpd = $pdo->prepare("
                        UPDATE additional_fee_payments SET amount = :amt WHERE id = :pid
                    ");
                    $stmtUpd->execute([':amt' => $admissionFee, ':pid' => $existingPay['id']]);
                }
            } else {
                $stmtInsPay = $pdo->prepare("
                    INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status)
                    VALUES (:sid, :stid, :tid, :amt, 'Pending')
                ");
                $stmtInsPay->execute([
                    ':sid' => $schoolId,
                    ':stid' => $studentId,
                    ':tid' => $typeId,
                    ':amt' => $admissionFee
                ]);
            }
        } else {
            // Remove pending payment entry if admission fee is set to blank/null/0
            if ($existingPay && $existingPay['status'] === 'Pending') {
                $stmtDel = $pdo->prepare("DELETE FROM additional_fee_payments WHERE id = :pid");
                $stmtDel->execute([':pid' => $existingPay['id']]);
            }
        }
    }

    private function syncExistingAnnualFeePayment(PDO $pdo, int $schoolId, int $studentId, int $classId, ?int $academicYearId, ?string $studentCategory): void
    {
        if (empty($studentCategory) || $studentCategory === 'New Admission') {
            return;
        }

        if ($academicYearId === null || $academicYearId <= 0) {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : null;
        }
        if ($academicYearId === null || $academicYearId <= 0) {
            return;
        }

        // Fetch all Annual Fee types for this school & academic year
        $stmtTypes = $pdo->prepare("
            SELECT id, amount 
            FROM additional_fee_types 
            WHERE school_id = :sid AND academic_year_id = :ayid AND (name = 'Annual Fee' OR category = 'Annual Fee')
        ");
        $stmtTypes->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $types = $stmtTypes->fetchAll(PDO::FETCH_ASSOC);

        if (empty($types)) {
            return;
        }

        $targetTypeId = null;
        $targetAmount = 0.0;

        if (count($types) === 1) {
            $targetTypeId = (int)$types[0]['id'];
            $targetAmount = (float)$types[0]['amount'];
        } else {
            $typeIds = array_column($types, 'id');
            $inParams = implode(',', array_map('intval', $typeIds));
            $stmtClassType = $pdo->prepare("
                SELECT afp.fee_type_id, afp.amount 
                FROM additional_fee_payments afp
                JOIN students s ON afp.student_id = s.id
                WHERE afp.school_id = :sid 
                  AND s.class_id = :cid 
                  AND afp.fee_type_id IN ($inParams)
                LIMIT 1
            ");
            $stmtClassType->execute([':sid' => $schoolId, ':cid' => $classId]);
            $classMatch = $stmtClassType->fetch(PDO::FETCH_ASSOC);

            if ($classMatch) {
                $targetTypeId = (int)$classMatch['fee_type_id'];
                $targetAmount = (float)$classMatch['amount'];
            } else {
                $targetTypeId = (int)$types[0]['id'];
                $targetAmount = (float)$types[0]['amount'];
            }
        }

        if ($targetTypeId === null || $targetAmount <= 0) {
            return;
        }

        $stmtCheck = $pdo->prepare("
            SELECT id FROM additional_fee_payments 
            WHERE school_id = :sid AND student_id = :stid AND fee_type_id = :ftid LIMIT 1
        ");
        $stmtCheck->execute([':sid' => $schoolId, ':stid' => $studentId, ':ftid' => $targetTypeId]);
        $existing = $stmtCheck->fetchColumn();

        if ($existing === false) {
            $stmtIns = $pdo->prepare("
                INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status)
                VALUES (:sid, :stid, :ftid, :amt, 'Pending')
            ");
            $stmtIns->execute([
                ':sid' => $schoolId,
                ':stid' => $studentId,
                ':ftid' => $targetTypeId,
                ':amt' => $targetAmount
            ]);
        }
    }

    public function advanceStudent(array $user, int $id, int $targetClassId): array
    {
        $schoolId = $this->getSchoolId($user);
        $student = $this->studentRepo->findById($id);
        if ($student === null || (int)$student['school_id'] !== $schoolId) {
            throw new NotFoundException('Student not found');
        }

        $pdo = $this->studentRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        // 1. Validate that student is active
        if (($student['status'] ?? 'ACTIVE') !== 'ACTIVE') {
            throw new ValidationException(['status' => 'Only active students can be advanced.']);
        }

        // 2. Fetch target class details
        $stmtC = $pdo->prepare("SELECT * FROM classes WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtC->execute([':id' => $targetClassId, ':sid' => $schoolId]);
        $targetClass = $stmtC->fetch(PDO::FETCH_ASSOC);
        if (!$targetClass) {
            throw new NotFoundException('Target class not found');
        }

        // 3. Fetch current class details
        $currentClassId = (int)$student['class_id'];
        $stmtCurr = $pdo->prepare("SELECT * FROM classes WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCurr->execute([':id' => $currentClassId, ':sid' => $schoolId]);
        $currentClass = $stmtCurr->fetch(PDO::FETCH_ASSOC);
        if (!$currentClass) {
            throw new NotFoundException('Current class not found');
        }

        // 4. Validate that target class is higher than current class
        $currentClassName = $currentClass['name'];
        $targetClassName = $targetClass['name'];

        $classOrder = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

        $currentClassIndex = -1;
        foreach ($classOrder as $idx => $cName) {
            if (strcasecmp(trim($currentClassName), $cName) === 0) {
                $currentClassIndex = $idx;
                break;
            }
        }

        $targetClassIndex = -1;
        foreach ($classOrder as $idx => $cName) {
            if (strcasecmp(trim($targetClassName), $cName) === 0) {
                $targetClassIndex = $idx;
                break;
            }
        }

        // Fallbacks for numeric class parsing
        if ($currentClassIndex === -1 && preg_match('/Class\s+(\d+)/i', $currentClassName, $matches)) {
            $currentClassIndex = 2 + (int)$matches[1];
        }
        if ($targetClassIndex === -1 && preg_match('/Class\s+(\d+)/i', $targetClassName, $matches)) {
            $targetClassIndex = 2 + (int)$matches[1];
        }

        if ($targetClassIndex <= $currentClassIndex) {
            throw new ValidationException(['class_id' => 'Only higher classes are allowed.']);
        }

        // 5. Auto-calculate new Roll Number in the target class
        $rollNo = $student['roll_no'];
        $academicYearId = (int)$student['academic_year_id'];
        if ($academicYearId <= 0) {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;
        }

        if ($targetClassId !== $currentClassId && $academicYearId > 0) {
            $stmtRoll = $pdo->prepare("
                SELECT MAX(CAST(roll_no AS UNSIGNED)) 
                FROM students 
                WHERE class_id = :class_id AND academic_year_id = :academic_year_id AND school_id = :school_id
            ");
            $stmtRoll->execute([
                ':class_id' => $targetClassId,
                ':academic_year_id' => $academicYearId,
                ':school_id' => $schoolId
            ]);
            $maxRoll = (int)$stmtRoll->fetchColumn();
            $rollNo = (string)($maxRoll + 1);
        }

        // 6. Update student record
        $this->studentRepo->update($id, [
            'class_id' => $targetClassId,
            'roll_no' => $rollNo
        ]);

        // Clear previous class monthly tuition fee payments so new class fee card is 100% fresh
        $stmtDelMonthly = $pdo->prepare("DELETE FROM fee_payments WHERE student_id = :student_id AND school_id = :school_id");
        $stmtDelMonthly->execute([
            ':student_id' => $id,
            ':school_id' => $schoolId
        ]);

        // 7. Write Audit Log
        $module = 'Classes';
        $action = 'Student Advanced';
        $actorName = $user['name'] ?? $user['email'] ?? $user['phone'] ?? 'School Admin';
        $studentName = $student['name'];
        
        $desc = "Student Advanced\nStudent: " . $studentName . "\nPrevious Class: " . $currentClassName . "\nAdvanced To: " . $targetClassName . "\nAdvanced By: " . $actorName . "\nDate: " . date('d F Y');

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayName = $workingYear ? $workingYear['name'] : null;
        $this->logAudit($pdo, $user, $module, $action, $desc, $ayName);

        return $this->studentRepo->findDetailById($schoolId, $id);
    }


    /**
     * Store an uploaded file and return its URL (absolute when the S3 driver is
     * active, "/uploads/<category>/<file>" when running on local disk).
     */
    public function handleFileUpload($uploadedFile, string $category = StorageService::CATEGORY_DOCUMENTS): string
    {
        $extension = strtolower(pathinfo($uploadedFile->getClientFilename(), PATHINFO_EXTENSION));
        $videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', '3gp', 'm4v', 'ts', 'ogv'];
        if (in_array($extension, $videoExts, true)) {
            throw new ValidationException(['file' => 'Video files are not allowed. Please upload an image or document file.']);
        }
        $mimeType = strtolower($uploadedFile->getClientMediaType() ?? '');
        if (str_starts_with($mimeType, 'video/')) {
            throw new ValidationException(['file' => 'Video files are not allowed. Please upload an image or document file.']);
        }

        return $this->storage->storeUploadedFile($uploadedFile, $category)['url'];
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

                // Attach dynamic proration details for already paid months
                $prorDetails = $this->getSalaryProrationDetails((float)$member['salary'], $member['joining_date'] ?? null, $p['payment_month'], $workingYear);
                $isPror = ((float)$p['amount_paid'] < (float)$member['salary']) || $prorDetails['is_prorated'];
                $p['is_prorated'] = $isPror;
                $p['proration_details'] = $isPror ? $prorDetails : null;
            }
            $member['salary_payments'] = $payments;

            // Calculate Monthly Net Payable Salaries (considering joining proration AND excess leave/absent deductions)
            $stmtSett = $pdo->prepare("SELECT allowed_leaves FROM teacher_attendance_settings WHERE school_id = :sid LIMIT 1");
            $stmtSett->execute([':sid' => $schoolId]);
            $allowedLeavesRaw = $stmtSett->fetchColumn();
            $allowedLeaves = ($allowedLeavesRaw !== false && $allowedLeavesRaw !== null && $allowedLeavesRaw !== '') ? (int)$allowedLeavesRaw : 0;

            $allAcademicMonths = [
                'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'
            ];
            $monthlySalaries = [];
            foreach ($allAcademicMonths as $mName) {
                $monthlySalaries[$mName] = $this->calculateStaffMonthlySalary(
                    $pdo,
                    $schoolId,
                    (int)$member['id'],
                    (float)$member['salary'],
                    $mName,
                    $workingYear ?: []
                );
            }
            $member['monthly_salaries'] = $monthlySalaries;
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
                    // Fetch paid months for this teacher in previous academic year (check both old staff_id and current staff_id)
                    $stmtOldPaid = $pdo->prepare("
                        SELECT payment_month FROM staff_payments 
                        WHERE school_id = :sid 
                          AND (staff_id = :old_sid OR staff_id = :curr_sid)
                          AND (academic_year_id = :ayid OR payment_month LIKE 'Previous Year - %')
                    ");
                    $stmtOldPaid->execute([
                        ':sid' => $schoolId,
                        ':old_sid' => $oldStaff['id'],
                        ':curr_sid' => $id,
                        ':ayid' => $prevYear['id']
                    ]);
                    $oldPaidRaw = $stmtOldPaid->fetchAll(PDO::FETCH_COLUMN) ?: [];
                    $oldPaidMonths = [];
                    foreach ($oldPaidRaw as $op) {
                        $cleanP = trim(str_replace('Previous Year - ', '', $op));
                        $subMs = array_map('trim', explode(',', $cleanP));
                        foreach ($subMs as $sm) {
                            $rangeParts = preg_split('/[-–]/', $sm);
                            if (count($rangeParts) > 1) {
                                $allMonthsTemp = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                                $startIdx = array_search(trim($rangeParts[0]), $allMonthsTemp);
                                $endIdx = array_search(trim($rangeParts[1]), $allMonthsTemp);
                                if ($startIdx !== false && $endIdx !== false) {
                                    for ($i = $startIdx; $i <= $endIdx; $i++) {
                                        $oldPaidMonths[] = $allMonthsTemp[$i];
                                    }
                                }
                            } else {
                                $oldPaidMonths[] = $sm;
                            }
                        }
                    }
                    
                    $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                    $startMonthIndex = 0;
                    $joiningDateStr = !empty($oldStaff['joining_date']) ? $oldStaff['joining_date'] : (!empty($member['joining_date']) ? $member['joining_date'] : null);
                    
                    if (!empty($joiningDateStr)) {
                        try {
                            $joiningDate = new \DateTime($joiningDateStr);
                            $joiningYM = $joiningDate->format('Y-m');
                            $ayStartYear = (int)date('Y', strtotime($prevYear['start_date'] ?? date('Y-04-01')));

                            $monthMap = [
                                'January' => '01', 'February' => '02', 'March' => '03',
                                'April' => '04', 'May' => '05', 'June' => '06',
                                'July' => '07', 'August' => '08', 'September' => '09',
                                'October' => '10', 'November' => '11', 'December' => '12'
                            ];

                            foreach ($allAcademicMonths as $idx => $mName) {
                                $mNum = $monthMap[$mName] ?? '01';
                                $mYear = ($idx >= 9) ? ($ayStartYear + 1) : $ayStartYear;
                                $targetYM = "{$mYear}-{$mNum}";
                                if ($targetYM >= $joiningYM) {
                                    $startMonthIndex = $idx;
                                    break;
                                }
                            }
                        } catch (\Exception $e) {
                            $startMonthIndex = 0;
                        }
                    }
                    $validPrevMonths = array_slice($allAcademicMonths, $startMonthIndex);

                    $pendingMonths = [];
                    foreach ($validPrevMonths as $m) {
                        if (!in_array($m, $oldPaidMonths, true)) {
                            $pendingMonths[] = $m;
                        }
                    }
                    
                    $prevJoiningProration = null;
                    if (!empty($joiningDateStr)) {
                        try {
                            $joiningMonthName = date('F', strtotime($joiningDateStr));
                            $pror = $this->getSalaryProrationDetails((float)$oldStaff['salary'], $joiningDateStr, $joiningMonthName, $prevYear);
                            if ($pror['is_prorated']) {
                                $prevJoiningProration = [
                                    'month' => $joiningMonthName,
                                    'prorated_days' => $pror['prorated_days'],
                                    'total_days' => $pror['total_days'],
                                    'payable_salary' => $pror['payable_salary'],
                                    'monthly_salary' => (float)$oldStaff['salary']
                                ];
                            }
                        } catch (\Exception $e) {}
                    }

                    if (!empty($validPrevMonths)) {
                        $member['previous_year_pending'] = [
                            'academic_year_id' => $prevYear['id'],
                            'academic_year_name' => $prevYear['name'],
                            'valid_months' => $validPrevMonths,
                            'pending_months' => $pendingMonths,
                            'joining_month_proration' => $prevJoiningProration,
                            'salary' => (float)$oldStaff['salary'],
                            'total_pending' => count($pendingMonths) * (float)$oldStaff['salary']
                        ];
                    }
                }
            }
        }

        return $member;
    }

    private function calculateStaffMonthlySalary(PDO $pdo, int $schoolId, int $staffId, float $baseSalary, string $monthName, array $workingYear): float
    {
        $monthMapNums = [
            'January' => '01', 'February' => '02', 'March' => '03',
            'April' => '04', 'May' => '05', 'June' => '06',
            'July' => '07', 'August' => '08', 'September' => '09',
            'October' => '10', 'November' => '11', 'December' => '12'
        ];
        $allAcademicMonths = [
            'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'
        ];
        $ayStartYear = !empty($workingYear['start_date']) ? (int)date('Y', strtotime($workingYear['start_date'])) : (int)date('Y');

        $mNum = $monthMapNums[$monthName] ?? '01';
        $mYearIndex = array_search($monthName, $allAcademicMonths);
        $mYear = ($mYearIndex !== false && $mYearIndex >= 9) ? ($ayStartYear + 1) : $ayStartYear;
        $ymPrefix = sprintf("%04d-%02d", $mYear, (int)$mNum);

        $startDate = "{$ymPrefix}-01";
        $totalDaysInMonth = (int)date('t', strtotime($startDate));
        $endDate = sprintf("%04d-%02d-%02d", $mYear, (int)$mNum, $totalDaysInMonth);

        $currentDate = date('Y-m-d');
        if ($currentDate <= $endDate) {
            // Month is currently in progress or in the future -> Return base salary (or joining month prorated salary)
            $stmtStaff = $pdo->prepare("SELECT joining_date FROM staff WHERE id = :st_id LIMIT 1");
            $stmtStaff->execute([':st_id' => $staffId]);
            $joiningDateStr = $stmtStaff->fetchColumn();

            if (!empty($joiningDateStr)) {
                try {
                    $joiningMonthName = date('F', strtotime((string)$joiningDateStr));
                    if ($monthName === $joiningMonthName) {
                        $joiningDateObj = new \DateTime((string)$joiningDateStr);
                        $daysInMonth = (int)$joiningDateObj->format('t');
                        $dayNum = (int)$joiningDateObj->format('d');
                        $workedDays = ($daysInMonth - $dayNum) + 1;
                        if ($workedDays < $daysInMonth && $workedDays > 0) {
                            return round(($workedDays / $daysInMonth) * $baseSalary);
                        }
                    }
                } catch (\Exception $e) {}
            }
            return $baseSalary;
        }

        // 1. Fetch Allowed Leaves
        $stmtSett = $pdo->prepare("SELECT allowed_leaves FROM teacher_attendance_settings WHERE school_id = :sid LIMIT 1");
        $stmtSett->execute([':sid' => $schoolId]);
        $allowedLeavesRaw = $stmtSett->fetchColumn();
        $allowedLeaves = ($allowedLeavesRaw !== false && $allowedLeavesRaw !== null && $allowedLeavesRaw !== '') ? (int)$allowedLeavesRaw : 0;

        // 2. Count Present days in month
        $stmtPres = $pdo->prepare("
            SELECT COUNT(*) FROM teacher_attendance 
            WHERE school_id = :sid AND staff_id = :st_id AND date >= :sdate AND date <= :edate AND status = 'Present'
        ");
        $stmtPres->execute([':sid' => $schoolId, ':st_id' => $staffId, ':sdate' => $startDate, ':edate' => $endDate]);
        $presentCount = (int)$stmtPres->fetchColumn();

        // 3. Count Leave days in month
        $stmtLeave = $pdo->prepare("
            SELECT COUNT(*) FROM teacher_attendance 
            WHERE school_id = :sid AND staff_id = :st_id AND date >= :sdate AND date <= :edate AND status = 'Leave'
        ");
        $stmtLeave->execute([':sid' => $schoolId, ':st_id' => $staffId, ':sdate' => $startDate, ':edate' => $endDate]);
        $leaveCount = (int)$stmtLeave->fetchColumn();

        // 4. Count Sundays in month
        $sundayCount = 0;
        for ($d = 1; $d <= $totalDaysInMonth; $d++) {
            $dtStr = sprintf("%04d-%02d-%02d", $mYear, (int)$mNum, $d);
            if (date('N', strtotime($dtStr)) == 7) {
                $sundayCount++;
            }
        }

        // 5. Count Holidays in month (excluding Sundays)
        $stmtHol = $pdo->prepare("
            SELECT date FROM holidays 
            WHERE school_id = :sid AND date >= :sdate AND date <= :edate
        ");
        $stmtHol->execute([':sid' => $schoolId, ':sdate' => $startDate, ':edate' => $endDate]);
        $holidays = $stmtHol->fetchAll(PDO::FETCH_COLUMN);
        $holidayCount = 0;
        foreach ($holidays as $hDate) {
            if (date('N', strtotime($hDate)) != 7) {
                $holidayCount++;
            }
        }

        $paidLeaveDays = min($leaveCount, $allowedLeaves);
        $paidDays = $presentCount + $paidLeaveDays + $sundayCount + $holidayCount;

        if ($paidDays >= $totalDaysInMonth) {
            return $baseSalary;
        }

        return round(($paidDays / $totalDaysInMonth) * $baseSalary);
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
        if (!empty($data['emergency_phone'])) {
            if (!preg_match('/^[0-9]{10}$/', trim($data['emergency_phone']))) {
                throw new ValidationException(['emergency_phone' => 'Emergency contact number must be exactly 10 digits.']);
            }
            if (trim($data['emergency_phone']) === trim($data['phone'])) {
                throw new ValidationException(['emergency_phone' => 'Emergency contact number must be different from contact number.']);
            }
        }
        if (!empty($data['email'])) {
            if (!filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) {
                throw new ValidationException(['email' => 'Invalid email address format.']);
            }
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
        if (!empty($data['current_address_line']) && mb_strlen(trim((string)$data['current_address_line'])) > 50) {
            throw new ValidationException(['current_address_line' => 'Address cannot exceed 50 characters.']);
        }
        if (!empty($data['permanent_address_line']) && mb_strlen(trim((string)$data['permanent_address_line'])) > 50) {
            throw new ValidationException(['permanent_address_line' => 'Address cannot exceed 50 characters.']);
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayid = $workingYear ? (int)$workingYear['id'] : null;

        // 2. Uniqueness Checks
        if ($ayid !== null) {
            $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND (academic_year_id = :ayid OR academic_year_id IS NULL) LIMIT 1");
            $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':ayid' => $ayid]);
        } else {
            $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone LIMIT 1");
            $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone'])]);
        }
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        // 3. Status Mapping
        $status = !empty($data['exit_date']) ? 'Inactive' : ($data['status'] ?? 'ACTIVE');

        $this->checkTeacherStudentPhoneConflict($pdo, $schoolId, $data['phone'], 0, null);

        if (strcasecmp($status, 'ACTIVE') === 0) {
            $this->checkActiveStaffPhoneConflictInOtherSchools($pdo, $schoolId, $data['phone']);
        }

        // 4. Save
        $id = $this->staffRepo->create([
            'school_id'               => $schoolId,
            'academic_year_id'        => $ayid,
            'name'                    => $data['name'],
            'employee_id'             => $data['employee_id'] ?? null,
            'role'                    => $data['role'] ?? 'Teacher',
            'department'              => $data['department'] ?? null,
            'phone'                   => $data['phone'],
            'email'                   => !empty($data['email']) ? $data['email'] : null,
            'status'                  => $status,
            'salary'                  => $data['salary'] ?? null,
            'joining_date'            => $data['joining_date'],
            'photo_path'              => $data['photo_path'] ?? null,
            'father_name'             => $data['father_name'],
            'mother_name'             => $data['mother_name'],
            'emergency_phone'         => !empty($data['emergency_phone']) ? $data['emergency_phone'] : null,
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

        // Auto-sync active user account for mobile app login
        $this->syncUserAccountForStaff($pdo, $schoolId, $data['name'], $data['phone'], $data['role'] ?? 'Teacher');

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
        if (!empty($data['emergency_phone'])) {
            if (!preg_match('/^[0-9]{10}$/', trim($data['emergency_phone']))) {
                throw new ValidationException(['emergency_phone' => 'Emergency contact number must be exactly 10 digits.']);
            }
            if (trim($data['emergency_phone']) === trim($data['phone'])) {
                throw new ValidationException(['emergency_phone' => 'Emergency contact number must be different from contact number.']);
            }
        }
        if (!empty($data['email'])) {
            if (!filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) {
                throw new ValidationException(['email' => 'Invalid email address format.']);
            }
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
        if (!empty($data['current_address_line']) && mb_strlen(trim((string)$data['current_address_line'])) > 50) {
            throw new ValidationException(['current_address_line' => 'Address cannot exceed 50 characters.']);
        }
        if (!empty($data['permanent_address_line']) && mb_strlen(trim((string)$data['permanent_address_line'])) > 50) {
            throw new ValidationException(['permanent_address_line' => 'Address cannot exceed 50 characters.']);
        }

        $ayid = $member ? $member['academic_year_id'] : null;

        // 2. Uniqueness Checks
        if ($ayid !== null) {
            $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND id != :id AND (academic_year_id = :ayid OR academic_year_id IS NULL) LIMIT 1");
            $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':id' => $id, ':ayid' => $ayid]);
        } else {
            $stmtCheckContact = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone AND id != :id LIMIT 1");
            $stmtCheckContact->execute([':sid' => $schoolId, ':phone' => trim($data['phone']), ':id' => $id]);
        }
        if ($stmtCheckContact->fetchColumn() !== false) {
            throw new ValidationException(['phone' => 'This contact number is already registered.']);
        }

        // 3. Status Mapping
        $exitDate = !empty($data['exit_date']) ? trim((string)$data['exit_date']) : null;
        $status = $exitDate !== null ? 'Inactive' : (!empty($data['status']) ? $data['status'] : 'ACTIVE');
        $existingStatus = strtoupper($member['status'] ?? 'ACTIVE');
        $newStatus = strtoupper($status);
        $isReactivating = ($existingStatus === 'INACTIVE' && $newStatus === 'ACTIVE');

        $oldPhone = trim((string)($member['phone'] ?? ''));
        $newPhone = trim((string)($data['phone'] ?? ''));

        if (!empty($oldPhone) && $oldPhone !== $newPhone) {
            $stmtDeactivateOld = $pdo->prepare("UPDATE users SET status = 'INACTIVE' WHERE school_id = :sid AND phone = :oldPhone AND role IN ('TEACHER', 'STAFF')");
            $stmtDeactivateOld->execute([':sid' => $schoolId, ':oldPhone' => $oldPhone]);
        }

        $this->checkTeacherStudentPhoneConflict($pdo, $schoolId, $data['phone'], $id, null, $isReactivating);

        if ($newStatus === 'ACTIVE') {
            $this->checkActiveStaffPhoneConflictInOtherSchools($pdo, $schoolId, $data['phone'], $id, $isReactivating);
        } else {
            $stmtUsersOff = $pdo->prepare("UPDATE users SET status = 'INACTIVE' WHERE school_id = :sid AND (phone = :phone OR phone = :oldPhone) AND role IN ('TEACHER', 'STAFF')");
            $stmtUsersOff->execute([':sid' => $schoolId, ':phone' => $newPhone, ':oldPhone' => $oldPhone]);
        }

        // 4. Update
        $this->staffRepo->update($id, [
            'name'                    => $data['name'],
            'role'                    => $data['role'] ?? 'Teacher',
            'department'              => $data['department'] ?? null,
            'phone'                   => $data['phone'],
            'email'                   => !empty($data['email']) ? $data['email'] : null,
            'status'                  => $status,
            'salary'                  => $data['salary'] ?? null,
            'joining_date'            => $data['joining_date'],
            'photo_path'              => $data['photo_path'] ?? null,
            'father_name'             => $data['father_name'],
            'mother_name'             => $data['mother_name'],
            'emergency_phone'         => !empty($data['emergency_phone']) ? $data['emergency_phone'] : null,
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

        // Auto-sync user account status for login
        $this->syncUserAccountForStaff($pdo, $schoolId, $data['name'], $data['phone'], $data['role'] ?? 'Teacher', $status);

        return $this->getStaffDetails($user, $id);
    }

    private function syncUserAccountForStudent(PDO $pdo, int $schoolId, string $name, ?string $phone, ?string $email = null, string $status = 'ACTIVE'): void
    {
        $phone = trim((string)$phone);
        if (empty($phone) || strlen($phone) < 10) return;

        // Check if there are any active student records for this phone
        $stmtActive = $pdo->prepare("
            SELECT COUNT(*) FROM students 
            WHERE school_id = :sid 
              AND (parent_phone = :p1 OR father_phone = :p2 OR student_mobile = :p3)
              AND (status IS NULL OR UPPER(status) = 'ACTIVE')
              AND exit_date IS NULL
        ");
        $stmtActive->execute([':sid' => $schoolId, ':p1' => $phone, ':p2' => $phone, ':p3' => $phone]);
        $activeCount = (int)$stmtActive->fetchColumn();

        $targetStatus = ($activeCount > 0 && strcasecmp($status, 'ACTIVE') === 0) ? 'ACTIVE' : 'INACTIVE';

        $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE phone = :phone LIMIT 1");
        $stmtCheck->execute([':phone' => $phone]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        $cleanEmail = !empty($email) ? trim((string)$email) : null;
        if (!empty($cleanEmail)) {
            $stmtEmailCheck = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND id != :ex_id LIMIT 1");
            $stmtEmailCheck->execute([':email' => $cleanEmail, ':ex_id' => $existing ? (int)$existing['id'] : 0]);
            if ($stmtEmailCheck->fetchColumn() !== false) {
                $cleanEmail = null;
            }
        }

        if (!$existing) {
            $defaultPassword = 'Test@123';
            $hashedPassword = password_hash($defaultPassword, PASSWORD_BCRYPT);
            $stmtInsert = $pdo->prepare("
                INSERT INTO users (phone, email, password, plain_password, role, name, status, school_id, force_password_change)
                VALUES (:phone, :email, :pwd, :plain, 'STUDENT', :name, :status, :sid, 0)
            ");
            $stmtInsert->execute([
                ':phone'  => $phone,
                ':email'  => $cleanEmail,
                ':pwd'    => $hashedPassword,
                ':plain'  => $defaultPassword,
                ':name'   => trim($name),
                ':status' => $targetStatus,
                ':sid'    => $schoolId
            ]);
        } else {
            $stmtUpdate = $pdo->prepare("
                UPDATE users 
                SET status = :status, school_id = COALESCE(school_id, :sid), name = :name, email = COALESCE(:email, email)
                WHERE id = :id
            ");
            $stmtUpdate->execute([':status' => $targetStatus, ':sid' => $schoolId, ':name' => trim($name), ':email' => $cleanEmail, ':id' => (int)$existing['id']]);
        }
    }

    private function syncUserAccountForStaff(PDO $pdo, int $schoolId, string $name, string $phone, string $role = 'TEACHER', string $status = 'ACTIVE'): void
    {
        $phone = trim($phone);
        if (empty($phone) || strlen($phone) < 10) return;

        $targetStatus = (strcasecmp($status, 'ACTIVE') === 0) ? 'ACTIVE' : 'INACTIVE';

        $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE phone = :phone LIMIT 1");
        $stmtCheck->execute([':phone' => $phone]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            $defaultPassword = 'Test@123';
            $hashedPassword = password_hash($defaultPassword, PASSWORD_BCRYPT);
            $stmtInsert = $pdo->prepare("
                INSERT INTO users (phone, password, plain_password, role, name, status, school_id, force_password_change)
                VALUES (:phone, :pwd, :plain, 'TEACHER', :name, :status, :sid, 0)
            ");
            $stmtInsert->execute([
                ':phone'  => $phone,
                ':pwd'    => $hashedPassword,
                ':plain'  => $defaultPassword,
                ':name'   => trim($name),
                ':status' => $targetStatus,
                ':sid'    => $schoolId
            ]);
        } else {
            $stmtUpdate = $pdo->prepare("
                UPDATE users 
                SET status = :status, school_id = :sid, name = :name
                WHERE id = :id
            ");
            $stmtUpdate->execute([':status' => $targetStatus, ':sid' => $schoolId, ':name' => trim($name), ':id' => $existing['id']]);
        }
    }

    private function checkAdminOrSuperAdminPhoneConflict(PDO $pdo, array|string $phones, bool $isReactivating = false): void
    {
        $phoneList = is_array($phones) ? $phones : [$phones];
        $validPhones = [];
        foreach ($phoneList as $p) {
            $cleaned = preg_replace('/[^0-9]/', '', (string)$p);
            if (!empty($cleaned) && strlen($cleaned) >= 10) {
                $validPhones[] = substr($cleaned, -10);
            }
        }
        $validPhones = array_unique($validPhones);
        if (empty($validPhones)) {
            return;
        }

        foreach ($validPhones as $phone) {
            // 1. Check users table for SUPER_ADMIN, SCHOOL_ADMIN, ADMIN roles
            $stmtUser = $pdo->prepare("
                SELECT phone, role 
                FROM users 
                WHERE (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = :phone OR phone LIKE :phone_like)
                  AND (UPPER(role) IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TENANT_ADMIN'))
                  AND UPPER(status) = 'ACTIVE'
                LIMIT 1
            ");
            $stmtUser->execute([':phone' => $phone, ':phone_like' => "%{$phone}%"]);
            $userConflict = $stmtUser->fetch(PDO::FETCH_ASSOC);

            if (!$userConflict) {
                // 2. Check schools table for contact_phone
                $stmtSchool = $pdo->prepare("
                    SELECT id, name FROM schools 
                    WHERE (RIGHT(REGEXP_REPLACE(contact_phone, '[^0-9]', ''), 10) = :phone OR contact_phone LIKE :phone_like)
                      AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
                    LIMIT 1
                ");
                $stmtSchool->execute([':phone' => $phone, ':phone_like' => "%{$phone}%"]);
                $schoolConflict = $stmtSchool->fetch(PDO::FETCH_ASSOC);
                if ($schoolConflict) {
                    $userConflict = ['role' => 'SCHOOL_ADMIN'];
                }
            }

            if ($userConflict) {
                $errMsg = $isReactivating 
                    ? "This number is already registered please update number."
                    : "Entered number already registered to an admin account";
                throw new ValidationException([
                    'student_mobile' => $errMsg,
                    'phone' => $errMsg
                ], $errMsg);
            }
        }
    }

    private function checkActiveStudentPhoneConflictInOtherSchools(
        PDO $pdo,
        int $currentSchoolId,
        array|string $phones,
        bool $isReactivating = false,
        ?int $excludeStudentId = null
    ): void {
        $this->checkAdminOrSuperAdminPhoneConflict($pdo, $phones, $isReactivating);

        $phoneList = is_array($phones) ? $phones : [$phones];
        $validPhones = [];
        foreach ($phoneList as $p) {
            $cleaned = preg_replace('/[^0-9]/', '', (string)$p);
            if (!empty($cleaned) && strlen($cleaned) >= 10) {
                $validPhones[] = substr($cleaned, -10);
            }
        }
        $validPhones = array_unique($validPhones);
        if (empty($validPhones)) return;

        static $studentPhoneCols = null;
        if ($studentPhoneCols === null) {
            try {
                $stmtCols = $pdo->query("SHOW COLUMNS FROM students");
                $allCols = $stmtCols ? $stmtCols->fetchAll(PDO::FETCH_COLUMN) : [];
                $candidateCols = ['parent_phone', 'father_phone', 'mother_phone', 'student_mobile', 'guardian_phone', 'phone'];
                $studentPhoneCols = array_values(array_intersect($candidateCols, $allCols));
            } catch (\Throwable $e) {
                $studentPhoneCols = ['parent_phone', 'father_phone', 'student_mobile'];
            }
        }

        if (empty($studentPhoneCols)) return;

        foreach ($validPhones as $phone) {
            $colConditionsArr = [];
            $queryParams = [':current_sid' => $currentSchoolId];
            foreach ($studentPhoneCols as $idx => $col) {
                $paramKey = ":phone_{$idx}";
                $colConditionsArr[] = "RIGHT(REGEXP_REPLACE(s.`{$col}`, '[^0-9]', ''), 10) = {$paramKey}";
                $queryParams[$paramKey] = $phone;
            }
            $colConditions = implode(' OR ', $colConditionsArr);

            // Check active student in another school
            $stmt = $pdo->prepare("
                SELECT s.school_id, sch.name AS school_name
                FROM students s
                JOIN schools sch ON s.school_id = sch.id
                WHERE s.school_id != :current_sid 
                  AND UPPER(s.status) = 'ACTIVE'
                  AND ({$colConditions})
                  " . ($excludeStudentId !== null ? "AND s.id != {$excludeStudentId}" : "") . "
                LIMIT 1
            ");
            $stmt->execute($queryParams);
            $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conflict) {
                // Also check active non-student user in another school
                $stmtUser = $pdo->prepare("
                    SELECT u.school_id, sch.name AS school_name
                    FROM users u
                    JOIN schools sch ON u.school_id = sch.id
                    WHERE u.school_id != :current_sid
                      AND UPPER(u.status) = 'ACTIVE'
                      AND UPPER(u.role) NOT IN ('STUDENT', 'PARENT')
                      AND RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', ''), 10) = :phone
                    LIMIT 1
                ");
                $stmtUser->execute([':current_sid' => $currentSchoolId, ':phone' => $phone]);
                $conflict = $stmtUser->fetch(PDO::FETCH_ASSOC);
            }

            if ($conflict) {
                $schoolName = $conflict['school_name'] ?? 'another school';
                $errMsg = $isReactivating 
                    ? "This number is already registered please update number."
                    : "The number is already registered in {$schoolName}. Please set it as Inactive first.";
                throw new ValidationException([
                    'parent_phone' => $errMsg,
                    'student_mobile' => $errMsg,
                    'father_phone' => $errMsg,
                    'phone' => $errMsg
                ], $errMsg);
            }
        }
    }

    private function checkActiveStudentEmailConflictInOtherSchools(
        PDO $pdo,
        int $currentSchoolId,
        array|string $emails,
        ?int $excludeStudentId = null,
        bool $isReactivating = false
    ): void {
        $emailList = is_array($emails) ? $emails : [$emails];
        $validEmails = [];
        foreach ($emailList as $e) {
            $trimmed = strtolower(trim((string)$e));
            if (!empty($trimmed) && filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
                $validEmails[] = $trimmed;
            }
        }
        $validEmails = array_unique($validEmails);
        if (empty($validEmails)) return;

        foreach ($validEmails as $email) {
            // Check active student in another school
            $stmt = $pdo->prepare("
                SELECT s.school_id, sch.name AS school_name
                FROM students s
                JOIN schools sch ON s.school_id = sch.id
                WHERE s.school_id != :current_sid 
                  AND UPPER(s.status) = 'ACTIVE'
                  AND (LOWER(COALESCE(s.email, '')) = :email1 OR LOWER(COALESCE(s.student_email, '')) = :email2)
                  " . ($excludeStudentId !== null ? "AND s.id != {$excludeStudentId}" : "") . "
                LIMIT 1
            ");
            $stmt->execute([':current_sid' => $currentSchoolId, ':email1' => $email, ':email2' => $email]);
            $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conflict) {
                // Check active staff in any school
                $stmtStaff = $pdo->prepare("
                    SELECT st.school_id, sch.name AS school_name
                    FROM staff st
                    JOIN schools sch ON st.school_id = sch.id
                    WHERE UPPER(st.status) = 'ACTIVE'
                      AND LOWER(st.email) = :email
                    LIMIT 1
                ");
                $stmtStaff->execute([':email' => $email]);
                $conflict = $stmtStaff->fetch(PDO::FETCH_ASSOC);
            }

            if (!$conflict) {
                // Check active user in another school with non-student/parent role
                $stmtUser = $pdo->prepare("
                    SELECT u.school_id, sch.name AS school_name
                    FROM users u
                    JOIN schools sch ON u.school_id = sch.id
                    WHERE u.school_id != :current_sid
                      AND UPPER(u.status) = 'ACTIVE'
                      AND UPPER(u.role) NOT IN ('STUDENT', 'PARENT')
                      AND LOWER(u.email) = :email
                    LIMIT 1
                ");
                $stmtUser->execute([':current_sid' => $currentSchoolId, ':email' => $email]);
                $conflict = $stmtUser->fetch(PDO::FETCH_ASSOC);
            }

            if ($conflict) {
                $schoolName = $conflict['school_name'] ?? 'another school';
                $errMsg = $isReactivating 
                    ? "This Email address is already registered please update Email address."
                    : "This Email address is already registered in {$schoolName}.";
                throw new ValidationException([
                    'email' => $errMsg,
                    'student_email' => $errMsg
                ], $errMsg);
            }
        }
    }

    private function checkActiveStaffPhoneConflictInOtherSchools(
        PDO $pdo,
        int $currentSchoolId,
        ?string $phone,
        ?int $excludeStaffId = null,
        bool $isReactivating = false
    ): void {
        if (!empty($phone)) {
            $this->checkAdminOrSuperAdminPhoneConflict($pdo, [$phone], $isReactivating);
        }

        $phone = trim((string)$phone);
        $cleaned = preg_replace('/[^0-9]/', '', $phone);
        if (empty($cleaned) || strlen($cleaned) < 10) return;
        $normPhone = substr($cleaned, -10);

        // Check active staff in any school (including same school if different staff ID)
        $stmt = $pdo->prepare("
            SELECT st.school_id, sch.name AS school_name
            FROM staff st
            JOIN schools sch ON st.school_id = sch.id
            WHERE UPPER(st.status) = 'ACTIVE'
              AND RIGHT(REGEXP_REPLACE(st.phone, '[^0-9]', ''), 10) = :phone
              " . ($excludeStaffId !== null ? "AND st.id != {$excludeStaffId}" : "") . "
            LIMIT 1
        ");
        $stmt->execute([':phone' => $normPhone]);
        $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conflict) {
            // Also check active user in any school (excluding staff's own user record in current school)
            $stmtUser = $pdo->prepare("
                SELECT u.school_id, sch.name AS school_name
                FROM users u
                JOIN schools sch ON u.school_id = sch.id
                WHERE UPPER(u.status) = 'ACTIVE'
                  AND RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', ''), 10) = :phone
                  AND NOT (u.school_id = :current_sid AND UPPER(u.role) IN ('TEACHER', 'STAFF'))
                LIMIT 1
            ");
            $stmtUser->execute([':phone' => $normPhone, ':current_sid' => $currentSchoolId]);
            $conflict = $stmtUser->fetch(PDO::FETCH_ASSOC);
        }

        if ($conflict) {
            $schoolName = $conflict['school_name'] ?? 'another school';
            $errMsg = $isReactivating 
                ? "This number is already registered please update number."
                : "The number is already registered in {$schoolName}. Inactive first";
            throw new ValidationException([
                'phone' => $errMsg
            ], $errMsg);
        }
    }

    private function checkActiveStaffEmailConflictInOtherSchools(
        PDO $pdo,
        int $currentSchoolId,
        ?string $email,
        ?int $excludeStaffId = null,
        bool $isReactivating = false
    ): void {
        $email = strtolower(trim((string)$email));
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;

        // Check active staff in any school (excluding current staff ID)
        $stmt = $pdo->prepare("
            SELECT st.school_id, sch.name AS school_name
            FROM staff st
            JOIN schools sch ON st.school_id = sch.id
            WHERE UPPER(st.status) = 'ACTIVE'
              AND LOWER(st.email) = :email
              " . ($excludeStaffId !== null ? "AND st.id != {$excludeStaffId}" : "") . "
            LIMIT 1
        ");
        $stmt->execute([':email' => $email]);
        $conflict = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conflict) {
            // Check active student in any school
            $stmtStu = $pdo->prepare("
                SELECT s.school_id, sch.name AS school_name
                FROM students s
                JOIN schools sch ON s.school_id = sch.id
                WHERE UPPER(s.status) = 'ACTIVE'
                  AND (LOWER(COALESCE(s.email, '')) = :email1 OR LOWER(COALESCE(s.student_email, '')) = :email2)
                LIMIT 1
            ");
            $stmtStu->execute([':email1' => $email, ':email2' => $email]);
            $conflict = $stmtStu->fetch(PDO::FETCH_ASSOC);
        }

        if (!$conflict) {
            // Check active user (excluding staff's own user record in current school)
            $stmtUser = $pdo->prepare("
                SELECT u.school_id, sch.name AS school_name
                FROM users u
                JOIN schools sch ON u.school_id = sch.id
                WHERE UPPER(u.status) = 'ACTIVE'
                  AND LOWER(u.email) = :email
                  AND NOT (u.school_id = :current_sid AND UPPER(u.role) IN ('TEACHER', 'STAFF'))
                LIMIT 1
            ");
            $stmtUser->execute([':email' => $email, ':current_sid' => $currentSchoolId]);
            $conflict = $stmtUser->fetch(PDO::FETCH_ASSOC);
        }

        if ($conflict) {
            $schoolName = $conflict['school_name'] ?? 'another school';
            $errMsg = $isReactivating 
                ? "This Email address is already registered please update Email address."
                : "This email address is already registered in {$schoolName}.";
            throw new ValidationException([
                'email' => $errMsg
            ], $errMsg);
        }
    }

    private function checkTeacherStudentPhoneConflict(
        PDO $pdo,
        int $schoolId,
        array|string $phones,
        ?int $excludeStaffId = null,
        ?int $excludeStudentId = null,
        bool $isReactivating = false
    ): void {
        $phoneList = is_array($phones) ? $phones : [$phones];
        $validPhones = [];
        foreach ($phoneList as $p) {
            $cleaned = preg_replace('/[^0-9]/', '', (string)$p);
            if (!empty($cleaned) && strlen($cleaned) >= 10) {
                $validPhones[] = substr($cleaned, -10);
            }
        }
        $validPhones = array_unique($validPhones);
        if (empty($validPhones)) {
            return;
        }

        foreach ($validPhones as $phone) {
            // Check if phone matches any ACTIVE Student in the same school (when checking staff addition/update)
            if ($excludeStaffId !== null) {
                $stmtStudent = $pdo->prepare("
                    SELECT id, TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) AS student_name 
                    FROM students 
                    WHERE school_id = :sid 
                      AND UPPER(status) = 'ACTIVE'
                      AND (
                        RIGHT(REGEXP_REPLACE(parent_phone, '[^0-9]', ''), 10) = :p1
                        OR RIGHT(REGEXP_REPLACE(father_phone, '[^0-9]', ''), 10) = :p2
                        OR RIGHT(REGEXP_REPLACE(student_mobile, '[^0-9]', ''), 10) = :p3
                        OR RIGHT(REGEXP_REPLACE(guardian_phone, '[^0-9]', ''), 10) = :p4
                      )
                      " . ($excludeStudentId !== null ? "AND id != {$excludeStudentId}" : "") . "
                    LIMIT 1
                ");
                $stmtStudent->execute([':sid' => $schoolId, ':p1' => $phone, ':p2' => $phone, ':p3' => $phone, ':p4' => $phone]);
                $studentMatch = $stmtStudent->fetch(PDO::FETCH_ASSOC);
                if ($studentMatch) {
                    $sName = $studentMatch['student_name'] ?? 'a student';
                    $errMsg = $isReactivating 
                        ? "This number is already registered please update number."
                        : "This mobile number is already registered to a student ({$sName}). Teacher and student mobile numbers cannot be the same.";
                    throw new ValidationException(['phone' => $errMsg], $errMsg);
                }

                $stmtUserStudent = $pdo->prepare("
                    SELECT name, role 
                    FROM users 
                    WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = :phone 
                      AND UPPER(role) IN ('STUDENT', 'PARENT')
                      AND UPPER(status) = 'ACTIVE'
                    LIMIT 1
                ");
                $stmtUserStudent->execute([':phone' => $phone]);
                $uMatch = $stmtUserStudent->fetch(PDO::FETCH_ASSOC);
                if ($uMatch) {
                    $errMsg = $isReactivating 
                        ? "This number is already registered please update number."
                        : "This mobile number is already registered to a student/parent account ({$uMatch['name']}). Teacher and student mobile numbers cannot be the same.";
                    throw new ValidationException(['phone' => $errMsg], $errMsg);
                }
            }

            // Check if phone matches any ACTIVE Teacher/Staff in the same school (when checking student addition/update)
            if ($excludeStudentId !== null) {
                $stmtStaff = $pdo->prepare("
                    SELECT id, name, role 
                    FROM staff 
                    WHERE school_id = :sid 
                      AND UPPER(status) = 'ACTIVE'
                      AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = :phone
                      " . ($excludeStaffId !== null ? "AND id != {$excludeStaffId}" : "") . "
                    LIMIT 1
                ");
                $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone]);
                $staffMatch = $stmtStaff->fetch(PDO::FETCH_ASSOC);
                if ($staffMatch) {
                    $stName = $staffMatch['name'] ?? 'a staff member';
                    $errMsg = $isReactivating 
                        ? "This number is already registered please update number."
                        : "This mobile number is already registered to teacher/staff ({$stName}). Student and teacher mobile numbers cannot be the same.";
                    throw new ValidationException([
                        'student_mobile' => $errMsg,
                        'parent_phone' => $errMsg,
                        'father_phone' => $errMsg,
                        'phone' => $errMsg
                    ], $errMsg);
                }

                $stmtUserStaff = $pdo->prepare("
                    SELECT name, role 
                    FROM users 
                    WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = :phone 
                      AND UPPER(role) IN ('TEACHER', 'STAFF')
                      AND UPPER(status) = 'ACTIVE'
                    LIMIT 1
                ");
                $stmtUserStaff->execute([':phone' => $phone]);
                $uMatch = $stmtUserStaff->fetch(PDO::FETCH_ASSOC);
                if ($uMatch) {
                    $errMsg = $isReactivating 
                        ? "This number is already registered please update number."
                        : "This mobile number is already registered to a teacher/staff account ({$uMatch['name']}). Student and teacher mobile numbers cannot be the same.";
                    throw new ValidationException([
                        'student_mobile' => $errMsg,
                        'parent_phone' => $errMsg,
                        'father_phone' => $errMsg,
                        'phone' => $errMsg
                    ], $errMsg);
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Classes & Master Catalog
    // -------------------------------------------------------------------------

    public const MASTER_CLASSES = [
        ['id' => 1, 'name' => 'Pre Nursery', 'category' => 'Pre-Primary'],
        ['id' => 2, 'name' => 'Nursery', 'category' => 'Pre-Primary'],
        ['id' => 3, 'name' => 'Lower Kindergarten (LKG)', 'category' => 'Pre-Primary'],
        ['id' => 4, 'name' => 'Upper Kindergarten (UKG)', 'category' => 'Pre-Primary'],
        ['id' => 5, 'name' => 'KG', 'category' => 'Pre-Primary'],
        ['id' => 6, 'name' => 'Class 1', 'category' => 'Primary'],
        ['id' => 7, 'name' => 'Class 2', 'category' => 'Primary'],
        ['id' => 8, 'name' => 'Class 3', 'category' => 'Primary'],
        ['id' => 9, 'name' => 'Class 4', 'category' => 'Primary'],
        ['id' => 10, 'name' => 'Class 5', 'category' => 'Primary'],
        ['id' => 11, 'name' => 'Class 6', 'category' => 'Middle'],
        ['id' => 12, 'name' => 'Class 7', 'category' => 'Middle'],
        ['id' => 13, 'name' => 'Class 8', 'category' => 'Middle'],
        ['id' => 14, 'name' => 'Class 9', 'category' => 'Secondary'],
        ['id' => 15, 'name' => 'Class 10', 'category' => 'Secondary'],
        ['id' => 16, 'name' => 'Class 11', 'category' => 'Senior Secondary'],
        ['id' => 17, 'name' => 'Class 12', 'category' => 'Senior Secondary'],
    ];

    public const MASTER_SECTIONS = [
        ['id' => 1, 'name' => 'A', 'type' => 'Alphabet'],
        ['id' => 2, 'name' => 'B', 'type' => 'Alphabet'],
        ['id' => 3, 'name' => 'C', 'type' => 'Alphabet'],
        ['id' => 4, 'name' => 'D', 'type' => 'Alphabet'],
        ['id' => 5, 'name' => 'Red', 'type' => 'Color'],
        ['id' => 6, 'name' => 'Blue', 'type' => 'Color'],
        ['id' => 7, 'name' => 'Green', 'type' => 'Color'],
        ['id' => 8, 'name' => 'Yellow', 'type' => 'Color'],
    ];

    public function getMasterCatalog(): array
    {
        return [
            'classes' => self::MASTER_CLASSES,
            'sections' => self::MASTER_SECTIONS,
        ];
    }

    public function resolveMasterClass($classInput): ?array
    {
        if ($classInput === null || $classInput === '') {
            return null;
        }

        $inputStr = trim((string)$classInput);

        foreach (self::MASTER_CLASSES as $mc) {
            if (is_numeric($inputStr) && (int)$inputStr === $mc['id']) {
                return $mc;
            }
            if (strcasecmp($inputStr, $mc['name']) === 0) {
                return $mc;
            }
            if (strcasecmp($mc['name'], 'Lower Kindergarten (LKG)') === 0 && (strcasecmp($inputStr, 'lkg') === 0 || strcasecmp($inputStr, 'lower kindergarten') === 0)) {
                return $mc;
            }
            if (strcasecmp($mc['name'], 'Upper Kindergarten (UKG)') === 0 && (strcasecmp($inputStr, 'ukg') === 0 || strcasecmp($inputStr, 'upper kindergarten') === 0)) {
                return $mc;
            }
            if (strcasecmp($mc['name'], 'Pre Nursery') === 0 && (strcasecmp($inputStr, 'pg') === 0 || strcasecmp($inputStr, 'play group') === 0 || strcasecmp($inputStr, 'playgroup') === 0 || strcasecmp($inputStr, 'pre nursery') === 0 || strcasecmp($inputStr, 'prenursery') === 0)) {
                return $mc;
            }
            if (strcasecmp($mc['name'], 'KG') === 0 && (strcasecmp($inputStr, 'kg') === 0 || strcasecmp($inputStr, 'kindergarten') === 0)) {
                return $mc;
            }
        }

        return null;
    }

    public function resolveMasterSection($secInput): ?array
    {
        if ($secInput === null || $secInput === '') {
            return null;
        }

        $inputStr = trim((string)$secInput);

        foreach (self::MASTER_SECTIONS as $ms) {
            if (is_numeric($inputStr) && (int)$inputStr === $ms['id']) {
                return $ms;
            }
            if (strcasecmp($inputStr, $ms['name']) === 0) {
                return $ms;
            }
        }

        return null;
    }

    public function getClasses(array $user, array $params = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        
        $academicYearId = null;
        if (!empty($params['academic_year_id'])) {
            $academicYearId = (int)$params['academic_year_id'];
        } else {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : null;
        }
        
        return $this->classRepo->findBySchool($schoolId, $academicYearId);
    }

    public function createClass(array $user, array $data): array
    {
        $classInput = $data['class_id'] ?? $data['name'] ?? null;
        if ($classInput === null || $classInput === '') {
            throw new ValidationException(['class_id' => 'Please select a class.', 'name' => 'Please select a class.'], 'Please select a class.');
        }

        // Validate against Master Classes catalog
        $masterClass = $this->resolveMasterClass($classInput);
        if (!$masterClass) {
            throw new ValidationException([
                'class_id' => 'The selected class does not exist in master catalog.',
                'name' => 'The selected class does not exist in master catalog.'
            ], 'The selected class does not exist in master catalog.');
        }
        $className = $masterClass['name'];

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Get target academic year (explicit or active working year)
        if (!empty($data['academic_year_id'])) {
            $academicYearId = (int)$data['academic_year_id'];
        } else {
            $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
            $academicYearId = $workingYear ? (int)$workingYear['id'] : null;
        }

        // Parse and validate sections against Master Sections catalog
        $rawSections = [];
        if (!empty($data['sections'])) {
            if (is_array($data['sections'])) {
                $rawSections = $data['sections'];
            } else {
                $rawSections = array_filter(array_map('trim', explode(',', (string)$data['sections'])));
            }
        }

        $resolvedSections = [];
        if (!empty($rawSections)) {
            if (count($rawSections) > 4) {
                throw new ValidationException(['sections' => 'Maximum 4 sections allowed.']);
            }

            foreach ($rawSections as $secItem) {
                $masterSec = $this->resolveMasterSection($secItem);
                if (!$masterSec) {
                    throw new ValidationException([
                        'sections' => 'The selected section does not exist in master catalog.'
                    ], 'The selected section does not exist in master catalog.');
                }
                $resolvedSections[] = $masterSec['name'];
            }
            $resolvedSections = array_values(array_unique($resolvedSections));
        }

        // Duplicate checks against existing school classes
        $existingClasses = $this->classRepo->findBySchool($schoolId, $academicYearId);
        $existingForThisClass = array_values(array_filter($existingClasses, fn($c) => strcasecmp($c['name'], $className) === 0));
        $existingSecNames = array_map(fn($c) => $c['section'] ?? null, $existingForThisClass);

        if (!empty($existingForThisClass)) {
            if (empty($resolvedSections)) {
                // Class without sections already exists
                throw new ValidationException([
                    'class_id' => 'The class is already added in your Academy',
                    'name' => 'The class is already added in your Academy'
                ], 'The class is already added in your Academy');
            }

            // Check if all requested sections or any individual requested section already exists
            foreach ($resolvedSections as $secName) {
                foreach ($existingSecNames as $extSec) {
                    if ($extSec !== null && strcasecmp($extSec, $secName) === 0) {
                        throw new ValidationException([
                            'sections' => 'The section is already added in your Academy'
                        ], 'The section is already added in your Academy');
                    }
                }
            }
        }

        $sectionsToInsert = !empty($resolvedSections) ? $resolvedSections : [null];

        $lastInsertedClass = null;
        foreach ($sectionsToInsert as $secVal) {
            $existsId = $this->findClassByNameAndSection($pdo, $schoolId, $academicYearId, $className, $secVal, $data['stream'] ?? null);
            if ($existsId !== null) {
                $lastInsertedClass = $this->classRepo->findById($existsId);
                continue;
            }

            $id = $this->classRepo->create([
                'school_id'        => $schoolId,
                'name'             => $className,
                'section'          => $secVal,
                'academic_year_id' => $academicYearId,
            ]);

            // Inherit existing fee configuration if another section of this class was configured
            $stmtExistingCfg = $pdo->prepare("
                SELECT cfg.* 
                FROM class_fee_configurations cfg
                JOIN classes c ON cfg.class_id = c.id
                WHERE cfg.school_id = :sid AND c.name = :cname
                LIMIT 1
            ");
            $stmtExistingCfg->execute([':sid' => $schoolId, ':cname' => $className]);
            $existingFeeCfg = $stmtExistingCfg->fetch(PDO::FETCH_ASSOC);

            if ($existingFeeCfg) {
                $stmtInsFeeCfg = $pdo->prepare("
                    INSERT INTO class_fee_configurations (school_id, class_id, academic_year_id, mode, monthly_fees, is_locked)
                    VALUES (:sid, :cid, :ayid, :mode, :monthly_fees, :is_locked)
                    ON DUPLICATE KEY UPDATE mode = VALUES(mode), monthly_fees = VALUES(monthly_fees)
                ");
                $stmtInsFeeCfg->execute([
                    ':sid' => $schoolId,
                    ':cid' => $id,
                    ':ayid' => $existingFeeCfg['academic_year_id'],
                    ':mode' => $existingFeeCfg['mode'],
                    ':monthly_fees' => is_array($existingFeeCfg['monthly_fees']) ? json_encode($existingFeeCfg['monthly_fees']) : $existingFeeCfg['monthly_fees'],
                    ':is_locked' => $existingFeeCfg['is_locked']
                ]);
            }

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

                // 3. Duplicate base classes (WITHOUT sections) into the new academic year
                $classMap = []; // [old_class_id => new_unsectioned_class_id]
                $stmtFindBaseClass = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid 
                      AND name = :name 
                      AND section IS NULL
                      AND (stream = :stream OR (stream IS NULL AND :stream_null = 1))
                    LIMIT 1
                ");
                $stmtInsBaseClass = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:school_id, :name, NULL, :stream, :new_ay_id)");
                foreach ($oldClasses as $oc) {
                    $stmtFindBaseClass->execute([
                        ':sid' => $schoolId,
                        ':ayid' => $newYearId,
                        ':name' => trim((string)$oc['name']),
                        ':stream' => $oc['stream'],
                        ':stream_null' => $oc['stream'] === null ? 1 : 0
                    ]);
                    $existingClassId = $stmtFindBaseClass->fetchColumn();
                    if ($existingClassId !== false) {
                        $classMap[(int)$oc['id']] = (int)$existingClassId;
                    } else {
                        $stmtInsBaseClass->execute([
                            ':school_id' => $schoolId,
                            ':name' => trim((string)$oc['name']),
                            ':stream' => $oc['stream'],
                            ':new_ay_id' => $newYearId
                        ]);
                        $newClassId = (int)$pdo->lastInsertId();
                        $classMap[(int)$oc['id']] = $newClassId;
                    }
                }

                $oldClassIds = array_keys($classMap);

                // 4. Duplicate subjects - no longer needed since they are school-level master subjects.
                // We just map the subject IDs to themselves to maintain compatibility.
                $subjectMap = []; 
                $stmtSubjects = $pdo->prepare("SELECT id FROM subjects WHERE school_id = :sid");
                $stmtSubjects->execute([':sid' => $schoolId]);
                $allSubjects = $stmtSubjects->fetchAll(PDO::FETCH_ASSOC);
                foreach ($allSubjects as $subj) {
                    $subjectMap[(int)$subj['id']] = (int)$subj['id'];
                }

                // 4. Duplicate timetable entries
                $stmtTimetable = $pdo->prepare("SELECT * FROM timetable WHERE school_id = :sid AND class_id IS NOT NULL");
                $stmtTimetable->execute([':sid' => $schoolId]);
                $oldTimetables = $stmtTimetable->fetchAll(PDO::FETCH_ASSOC);

                $stmtInsTimetable = $pdo->prepare("
                    INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date, is_published) 
                    VALUES (:school_id, :class_id, :subject_id, :teacher_id, :day_of_week, :period_number, :start_date, 0)
                    ON DUPLICATE KEY UPDATE 
                      subject_id = VALUES(subject_id), 
                      teacher_id = VALUES(teacher_id)
                ");
                foreach ($oldTimetables as $ot) {
                    $oldClassId = (int)$ot['class_id'];
                    if (isset($classMap[$oldClassId])) {
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

                        if ($teacherId === null) {
                            $teacherId = $ot['teacher_id'] !== null ? $ot['teacher_id'] : (int)($user['id'] ?? 0);
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

                $stmtInsFee = $pdo->prepare("
                    INSERT INTO fee_structures (school_id, name, amount, frequency, class_id) 
                    VALUES (:school_id, :name, :amount, :frequency, :class_id)
                    ON DUPLICATE KEY UPDATE 
                      amount = VALUES(amount), 
                      frequency = VALUES(frequency)
                ");
                foreach ($oldFeeStructures as $ofs) {
                    $oldClassId = (int)$ofs['class_id'];
                    if (isset($classMap[$oldClassId])) {
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

                // Fetch Late Payment Penalty config for source year if any
                $stmtLppCfg = $pdo->prepare("
                    SELECT * FROM late_payment_penalty_configs 
                    WHERE school_id = :sid AND academic_year_id = :ayid AND status = 'Active' LIMIT 1
                ");
                $lppConfig = null;
                if ($prevYearId !== false) {
                    $stmtLppCfg->execute([':sid' => $schoolId, ':ayid' => $prevYearId]);
                    $lppConfig = $stmtLppCfg->fetch(PDO::FETCH_ASSOC);
                }

                // 6. Promote / Repeat / Graduate students
                $studentMigrations = $body['student_migrations'] ?? [];

                $classOrder = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

                foreach ($studentMigrations as $sm) {
                    $studentId = (int)$sm['student_id'];
                    $action = $sm['action'];

                    $stmtStu = $pdo->prepare("SELECT s.class_id, s.name AS student_name, s.status, c.name, c.section, c.stream FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = :id AND s.school_id = :sid LIMIT 1");
                    $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
                    $stuInfo = $stmtStu->fetch(PDO::FETCH_ASSOC);
                    if (!$stuInfo || ($stuInfo['status'] ?? 'ACTIVE') !== 'ACTIVE') continue;

                    $outstanding = 0.0;
                    $studentName = $stuInfo['student_name'] ?? 'Student';
                    
                    if ($action === 'promote' || $action === 'repeat') {
                        $outstanding = $this->getStudentOutstandingBalanceForYear($pdo, $studentId, $schoolId, $prevYearId);
                        
                        $newClassId = null;
                        $currentClassName = $stuInfo['name'] ?? '';

                        if ($action === 'promote') {
                            $studentsPromotedCount++;
                            $nextClassName = $this->getNextClassNameForPromotion($currentClassName);

                            if ($nextClassName !== null) {
                                $fId = $this->findClassByNameAndSection($pdo, $schoolId, $newYearId, $nextClassName, null, $stuInfo['stream'] ?? null);
                                if ($fId !== null) {
                                    $newClassId = $fId;
                                } else {
                                    $stmtCreateC = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:sid, :name, NULL, :stream, :new_ay_id)");
                                    $stmtCreateC->execute([
                                        ':sid' => $schoolId,
                                        ':name' => trim($nextClassName),
                                        ':stream' => $stuInfo['stream'] ?? null,
                                        ':new_ay_id' => $newYearId
                                    ]);
                                    $newClassId = (int)$pdo->lastInsertId();
                                }
                            }
                        } elseif ($action === 'graduate_alumni' || $action === 'graduate') {
                            $studentsGraduatedCount++;
                            $stmtUpdateStudent = $pdo->prepare("UPDATE students SET status = 'Alumni' WHERE id = :id AND school_id = :sid");
                            $stmtUpdateStudent->execute([
                                ':id' => $studentId,
                                ':sid' => $schoolId
                            ]);
                            continue;
                        } elseif ($action === 'repeat') {
                            $studentsRepeatedCount++;

                            if (!empty($currentClassName)) {
                                $fId = $this->findClassByNameAndSection($pdo, $schoolId, $newYearId, $currentClassName, null, $stuInfo['stream'] ?? null);
                                if ($fId !== null) {
                                    $newClassId = $fId;
                                } else {
                                    $stmtCreateC = $pdo->prepare("INSERT INTO classes (school_id, name, section, stream, academic_year_id) VALUES (:sid, :name, NULL, :stream, :new_ay_id)");
                                    $stmtCreateC->execute([
                                        ':sid' => $schoolId,
                                        ':name' => trim($currentClassName),
                                        ':stream' => $stuInfo['stream'] ?? null,
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
                                $stmtUpdateCat = $pdo->prepare("UPDATE students SET student_category = 'Existing Student' WHERE id = :id AND school_id = :sid");
                                $stmtUpdateCat->execute([':id' => $newStudentId, ':sid' => $schoolId]);
                            } else {
                                unset($oldStu['id']);
                                unset($oldStu['created_at']);
                                unset($oldStu['updated_at']);

                                $oldStu['class_id'] = $newClassId;
                                $oldStu['academic_year_id'] = $newYearId;
                                $oldStu['status'] = 'ACTIVE';
                                $oldStu['roll_no'] = $newRollNo;
                                $oldStu['student_category'] = 'Existing Student';
                                unset($oldStu['section']);

                                $cols = array_keys($oldStu);
                                $placeholders = array_map(fn($c) => ":{$c}", $cols);
                                $sqlInsert = "INSERT INTO students (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")";
                                
                                $stmtIns = $pdo->prepare($sqlInsert);
                                $stmtIns->execute($oldStu);
                                $newStudentId = (int)$pdo->lastInsertId();
                                $stuPhone = !empty($oldStu['parent_phone']) ? trim((string)$oldStu['parent_phone']) : (!empty($oldStu['father_phone']) ? trim((string)$oldStu['father_phone']) : (!empty($oldStu['student_mobile']) ? trim((string)$oldStu['student_mobile']) : null));
                                $this->syncUserAccountForStudent($pdo, $schoolId, $oldStu['name'] ?? ($oldStu['first_name'] ?? 'Student'), $stuPhone, $oldStu['student_email'] ?? null);
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
                            
                            // Apply Late Payment Penalty if configured
                            if ($lppConfig && isset($lppConfig['percentage']) && (float)$lppConfig['percentage'] > 0) {
                                $percentage = (float)$lppConfig['percentage'];
                                $penaltyAmount = round($outstanding * $percentage / 100);
                                if ($penaltyAmount > 0) {
                                    // Duplicate protection
                                    $stmtCheckLppPay = $pdo->prepare("
                                        SELECT COUNT(*) FROM additional_fee_payments afp
                                        JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                                        WHERE afp.student_id = :stid 
                                          AND afp.school_id = :sid 
                                          AND aft.academic_year_id = :target_ayid 
                                          AND aft.name = 'Late Payment Penalty'
                                    ");
                                    $stmtCheckLppPay->execute([
                                        ':stid' => $newStudentId,
                                        ':sid' => $schoolId,
                                        ':target_ayid' => $newYearId
                                    ]);
                                    $existsLpp = (int)$stmtCheckLppPay->fetchColumn();

                                    if ($existsLpp === 0) {
                                        // Find or create 'Late Payment Penalty' fee type in target academic year
                                        $stmtLppType = $pdo->prepare("
                                            SELECT id FROM additional_fee_types 
                                            WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Late Payment Penalty' LIMIT 1
                                        ");
                                        $stmtLppType->execute([':sid' => $schoolId, ':ayid' => $newYearId]);
                                        $lppTypeId = $stmtLppType->fetchColumn();
                                        
                                        if ($lppTypeId === false) {
                                            $stmtInsLppType = $pdo->prepare("
                                                INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, due_date, category)
                                                VALUES (:sid, 'Late Payment Penalty', 0.0, :ayid, :due_date, 'System Generated')
                                            ");
                                            $stmtInsLppType->execute([
                                                ':sid' => $schoolId,
                                                ':ayid' => $newYearId,
                                                ':due_date' => date('Y-m-d')
                                            ]);
                                            $lppTypeId = (int)$pdo->lastInsertId();
                                        } else {
                                            $lppTypeId = (int)$lppTypeId;
                                        }

                                        $lppDescription = "Late Payment Penalty For AY (" . $prevYear['name'] . ")";

                                        // Create penalty fee payment record
                                        $stmtInsLppPay = $pdo->prepare("
                                            INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status, description, created_by_name, penalty_type)
                                            VALUES (:sid, :student_id, :fee_type_id, :amount, 'Pending', :desc, 'System Migration', 'AUTO_MIGRATION')
                                        ");
                                        $stmtInsLppPay->execute([
                                            ':sid' => $schoolId,
                                            ':student_id' => $newStudentId,
                                            ':fee_type_id' => $lppTypeId,
                                            ':amount' => $penaltyAmount,
                                            ':desc' => $lppDescription
                                        ]);

                                        // Log late payment penalty history
                                        $stmtInsLppHist = $pdo->prepare("
                                            INSERT INTO late_payment_penalty_history (
                                                school_id, academic_year_id, student_id, student_name, admission_no,
                                                class_name, section_name, outstanding_due, penalty_percentage, penalty_amount,
                                                description, applied_by, applied_by_name
                                            ) VALUES (
                                                :sid, :ayid, :stid, :sname, :adm,
                                                :class, :section, :due, :pct, :amount,
                                                :desc, :uid, 'System Migration'
                                            )
                                        ");
                                        $stmtInsLppHist->execute([
                                            ':sid' => $schoolId,
                                            ':ayid' => $prevYearId,
                                            ':stid' => $newStudentId,
                                            ':sname' => $studentName,
                                            ':adm' => $oldStu['admission_no'] ?? '',
                                            ':class' => $stuInfo['name'] ?? '',
                                            ':section' => $stuInfo['section'] ?? '',
                                            ':due' => $outstanding,
                                            ':pct' => $percentage,
                                            ':amount' => $penaltyAmount,
                                            ':desc' => $lppDescription,
                                            ':uid' => $user['id'] ?? 1
                                        ]);

                                        // Create dashboard notifications
                                        $stmtNotif = $pdo->prepare("
                                            INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, is_read)
                                            VALUES (:sid, :role, 'Late Payment Penalty', :msg, '/student/fees', 0)
                                        ");
                                        $notifMsg = "A late payment penalty of INR " . $penaltyAmount . " has been applied for previous year dues.";
                                        $stmtNotif->execute([
                                            ':sid' => $schoolId,
                                            ':role' => 'STUDENT',
                                            ':msg' => $notifMsg
                                        ]);
                                        $stmtNotif->execute([
                                            ':sid' => $schoolId,
                                            ':role' => 'PARENT',
                                            ':msg' => $notifMsg
                                        ]);
                                    }
                                }
                            }

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
                            // Migrate Transport Fee if student had one
                            $stmtTrans = $pdo->prepare("SELECT * FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :prev_ayid AND student_id = :prev_stu_id LIMIT 1");
                            $stmtTrans->execute([':sid' => $schoolId, ':prev_ayid' => $prevYearId, ':prev_stu_id' => $studentId]);
                            $oldTrans = $stmtTrans->fetch(PDO::FETCH_ASSOC);
                            if ($oldTrans) {
                                // Check if already exists in new academic year
                                $stmtCheckTrans = $pdo->prepare("SELECT COUNT(*) FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :new_ayid AND student_id = :new_stu_id");
                                $stmtCheckTrans->execute([':sid' => $schoolId, ':new_ayid' => $newYearId, ':new_stu_id' => $newStudentId]);
                                if ((int)$stmtCheckTrans->fetchColumn() === 0) {
                                    $stmtInsTrans = $pdo->prepare("
                                        INSERT INTO student_transport_fees (school_id, academic_year_id, student_id, monthly_fee, start_date, status)
                                        VALUES (:sid, :new_ayid, :new_stu_id, :monthly_fee, :start_date, :status)
                                    ");
                                    $stmtInsTrans->execute([
                                        ':sid' => $schoolId,
                                        ':new_ayid' => $newYearId,
                                        ':new_stu_id' => $newStudentId,
                                        ':monthly_fee' => $oldTrans['monthly_fee'],
                                        ':start_date' => $oldTrans['start_date'],
                                        ':status' => $oldTrans['status']
                                    ]);
                                }
                            }
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

                // Instantly calculate and generate Achievement Certificates for the completed academic year
                try {
                    $stmtCleanOld = $pdo->prepare("DELETE FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id = :ayid");
                    $stmtCleanOld->execute([':sid' => $schoolId, ':ayid' => (int)$prevYearId]);

                    $this->autoGenerateAchievementsSnapshots($pdo, $schoolId, (int)$prevYearId);
                } catch (\Throwable $achEx) {
                    $this->log('Failed to auto-generate achievement snapshots on migration', [
                        'error' => $achEx->getMessage(),
                        'school_id' => $schoolId,
                        'prev_year_id' => $prevYearId
                    ]);
                }

                // Automatically generate monthly financial reports for the previous academic year
                try {
                    $stmtPrevYear = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
                    $stmtPrevYear->execute([':id' => $prevYearId, ':sid' => $schoolId]);
                    $prevYearObj = $stmtPrevYear->fetch(PDO::FETCH_ASSOC);

                    if ($prevYearObj) {
                        $this->autoGenerateCompletedMonthlyReports($pdo, $schoolId, $prevYearObj);
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
        $this->syncTransportFees($schoolId, $academicYearId, $pdo);

        $stmtStu = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $classId = $stmtStu->fetchColumn();
        if ($classId === false || $classId === null) {
            return 0.0;
        }

        $stmtCfg = $pdo->prepare("
            SELECT monthly_fees FROM class_fee_configurations 
            WHERE school_id = :school_id AND class_id = :class_id AND (academic_year_id = :academic_year_id OR academic_year_id IS NULL)
            LIMIT 1
        ");
        $stmtCfg->execute([
            ':school_id' => $schoolId,
            ':class_id' => $classId,
            ':academic_year_id' => $academicYearId
        ]);
        $cfgRow = $stmtCfg->fetch(PDO::FETCH_ASSOC);
        if (!$cfgRow) {
            $stmtFallback = $pdo->prepare("
                SELECT cfg.monthly_fees 
                FROM class_fee_configurations cfg
                JOIN classes c1 ON cfg.class_id = c1.id
                JOIN classes c2 ON c1.name COLLATE utf8mb4_unicode_ci = c2.name COLLATE utf8mb4_unicode_ci AND c1.school_id = c2.school_id
                WHERE cfg.school_id = :school_id AND c2.id = :class_id AND (cfg.academic_year_id = :academic_year_id OR cfg.academic_year_id IS NULL)
                LIMIT 1
            ");
            $stmtFallback->execute([
                ':school_id' => $schoolId,
                ':class_id' => $classId,
                ':academic_year_id' => $academicYearId
            ]);
            $cfgRow = $stmtFallback->fetch(PDO::FETCH_ASSOC);
        }

        $monthlyFees = [];
        if ($cfgRow && !empty($cfgRow['monthly_fees'])) {
            $monthlyFees = is_string($cfgRow['monthly_fees']) ? json_decode($cfgRow['monthly_fees'], true) : $cfgRow['monthly_fees'];
        }

        $stmtPaid = $pdo->prepare("
            SELECT fee_month FROM fee_payments 
            WHERE student_id = :student_id AND school_id = :school_id AND status = 'PAID' AND (academic_year_id = :academic_year_id OR academic_year_id IS NULL)
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
            SELECT COALESCE(SUM(afp.amount - (COALESCE(afp.amount_paid, 0) + COALESCE(afp.discount_amount, 0))), 0)
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id
              AND afp.school_id = :school_id
              AND LOWER(afp.status) IN ('pending', 'partial')
              AND (aft.academic_year_id = :academic_year_id OR aft.academic_year_id IS NULL OR aft.name = 'Previous Year Dues')
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

    public function getAttendanceLeaderboard(array $user, array $params): array
    {
        if (empty($params['academic_year_id'])) {
            throw new ValidationException(['academic_year_id' => 'Academic Year ID is required.']);
        }
        $academicYearId = (int)$params['academic_year_id'];
        $classIdFilter = isset($params['class_id']) && $params['class_id'] !== 'ALL' && $params['class_id'] !== '' ? (int)$params['class_id'] : null;

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->attendanceRepo->getPdo();

        // 1. Verify academic year exists and is Archived
        $stmtAY = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtAY->execute([':id' => $academicYearId, ':sid' => $schoolId]);
        $academicYear = $stmtAY->fetch(PDO::FETCH_ASSOC);

        if (!$academicYear) {
            throw new NotFoundException('Academic year not found.');
        }

        if ($academicYear['status'] !== 'Archived') {
            throw new ValidationException(['academic_year_id' => 'Leaderboard is only available for completed (Archived) academic years.']);
        }

        // 2. Check if snapshot already exists
        $stmtSnapshotCheck = $pdo->prepare("
            SELECT COUNT(*) 
            FROM academic_achievement_snapshots 
            WHERE academic_year_id = :ay_id AND school_id = :sid AND feature_type = 'attendance_leaderboard'
        ");
        $stmtSnapshotCheck->execute([':ay_id' => $academicYearId, ':sid' => $schoolId]);
        $snapshotCount = (int)$stmtSnapshotCheck->fetchColumn();

        // 3. Generate snapshots if they do not exist
        if ($snapshotCount === 0) {
            $stmtCalc = $pdo->prepare("
                SELECT 
                    s.id AS student_id,
                    s.name AS student_name,
                    s.photo_path AS student_photo,
                    s.roll_no AS roll_number,
                    c.name AS class_name,
                    c.section AS class_section,
                    c.id AS class_id,
                    COUNT(a.id) AS total_working_days,
                    SUM(CASE WHEN UPPER(a.status) IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS present_days
                FROM students s
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN attendance a ON s.id = a.student_id
                WHERE c.academic_year_id = :ay_id AND c.school_id = :sid
                GROUP BY s.id, c.id
                HAVING total_working_days > 0
            ");
            $stmtCalc->execute([':ay_id' => $academicYearId, ':sid' => $schoolId]);
            $studentsList = $stmtCalc->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($studentsList)) {
                $overallList = [];
                foreach ($studentsList as $stu) {
                    $total = (int)$stu['total_working_days'];
                    $present = (int)$stu['present_days'];
                    $pct = $total > 0 ? round(($present / $total) * 100, 2) : 0.00;
                    $overallList[] = array_merge($stu, ['percentage' => $pct]);
                }

                // Sort overall list: percentage DESC, present_days DESC, student_name ASC
                usort($overallList, function ($a, $b) {
                    if ($b['percentage'] != $a['percentage']) {
                        return $b['percentage'] <=> $a['percentage'];
                    }
                    if ($b['present_days'] != $a['present_days']) {
                        return $b['present_days'] <=> $a['present_days'];
                    }
                    return strcasecmp($a['student_name'], $b['student_name']);
                });

                $overallTop3 = array_slice($overallList, 0, 3);

                // Group by Class
                $classGroups = [];
                foreach ($overallList as $stu) {
                    $classGroups[$stu['class_id']][] = $stu;
                }

                $classWiseTop3 = [];
                foreach ($classGroups as $classId => $roster) {
                    usort($roster, function ($a, $b) {
                        if ($b['percentage'] != $a['percentage']) {
                            return $b['percentage'] <=> $a['percentage'];
                        }
                        if ($b['present_days'] != $a['present_days']) {
                            return $b['present_days'] <=> $a['present_days'];
                        }
                        return strcasecmp($a['student_name'], $b['student_name']);
                    });
                    $classWiseTop3[$classId] = array_slice($roster, 0, 3);
                }

                // Batch Insert Snapshots in Transaction
                $pdo->beginTransaction();
                try {
                    $stmtInsert = $pdo->prepare("
                        INSERT INTO academic_achievement_snapshots (
                            school_id, academic_year_id, feature_type, class_id, 
                            student_id, student_name, student_photo, class_name, roll_number, 
                            achievement_score, `rank`, metadata
                        ) VALUES (
                            :sid, :ay_id, 'attendance_leaderboard', :class_id,
                            :stu_id, :stu_name, :stu_photo, :cls_name, :roll,
                            :score, :rank, :meta
                        )
                    ");

                    // 3a. Save school-wide overall
                    foreach ($overallTop3 as $idx => $row) {
                        $stmtInsert->execute([
                            ':sid' => $schoolId,
                            ':ay_id' => $academicYearId,
                            ':class_id' => null,
                            ':stu_id' => $row['student_id'],
                            ':stu_name' => $row['student_name'],
                            ':stu_photo' => $row['student_photo'],
                            ':cls_name' => $row['class_name'] . (!empty($row['class_section']) && strpos($row['class_name'], $row['class_section']) === false ? ' - ' . $row['class_section'] : ''),
                            ':roll' => $row['roll_number'],
                            ':score' => $row['percentage'],
                            ':rank' => $idx + 1,
                            ':meta' => json_encode([
                                'present_days' => $row['present_days'],
                                'total_working_days' => $row['total_working_days']
                            ])
                        ]);
                    }

                    // 3b. Save class-wise
                    foreach ($classWiseTop3 as $classId => $roster) {
                        foreach ($roster as $idx => $row) {
                            $stmtInsert->execute([
                                ':sid' => $schoolId,
                                ':ay_id' => $academicYearId,
                                ':class_id' => $classId,
                                ':stu_id' => $row['student_id'],
                                ':stu_name' => $row['student_name'],
                                ':stu_photo' => $row['student_photo'],
                                ':cls_name' => $row['class_name'] . (!empty($row['class_section']) && strpos($row['class_name'], $row['class_section']) === false ? ' - ' . $row['class_section'] : ''),
                                ':roll' => $row['roll_number'],
                                ':score' => $row['percentage'],
                                ':rank' => $idx + 1,
                                ':meta' => json_encode([
                                    'present_days' => $row['present_days'],
                                    'total_working_days' => $row['total_working_days']
                                ])
                            ]);
                        }
                    }

                    $pdo->commit();
                } catch (\Exception $e) {
                    $pdo->rollBack();
                    throw $e;
                }
            }
        }

        // 4. Query and return matching snapshots
        if ($classIdFilter === null) {
            $stmtSelect = $pdo->prepare("
                SELECT * 
                FROM academic_achievement_snapshots 
                WHERE academic_year_id = :ay_id AND school_id = :sid AND feature_type = 'attendance_leaderboard' AND class_id IS NULL
                ORDER BY `rank` ASC
            ");
            $stmtSelect->execute([':ay_id' => $academicYearId, ':sid' => $schoolId]);
        } else {
            $stmtSelect = $pdo->prepare("
                SELECT * 
                FROM academic_achievement_snapshots 
                WHERE academic_year_id = :ay_id AND school_id = :sid AND feature_type = 'attendance_leaderboard' AND class_id = :class_id
                ORDER BY `rank` ASC
            ");
            $stmtSelect->execute([':ay_id' => $academicYearId, ':sid' => $schoolId, ':class_id' => $classIdFilter]);
        }

        $results = $stmtSelect->fetchAll(PDO::FETCH_ASSOC);

        $formatted = [];
        foreach ($results as $r) {
            $formatted[] = [
                'rank' => (int)$r['rank'],
                'student_name' => $r['student_name'],
                'student_photo' => $r['student_photo'],
                'class_name' => $r['class_name'],
                'roll_number' => $r['roll_number'],
                'achievement_score' => (float)$r['achievement_score'],
                'metadata' => json_decode($r['metadata'], true)
            ];
        }

        return $formatted;
    }

    public function getAchievements(array $user, array $params = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->attendanceRepo->getPdo();

        // 1. Resolve Available Achievement Academic Years (ONLY years with completed migration or archived status)
        $stmtAvailAYs = $pdo->prepare("
            SELECT id, name, status, migration_status, is_current 
            FROM academic_years 
            WHERE school_id = :sid 
              AND (migration_status = 'Completed' OR status = 'Archived')
            ORDER BY id DESC
        ");
        $stmtAvailAYs->execute([':sid' => $schoolId]);
        $availableYears = $stmtAvailAYs->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if (empty($availableYears)) {
            return [
                'available_achievement_years' => [],
                'academic_year_id' => null,
                'categories_summary' => [
                    'attendance_champions' => ['count' => 0, 'label' => 'Attendance Champions', 'description' => 'Students with outstanding school attendance.'],
                    'academic_excellence' => ['count' => 0, 'label' => 'Academic Excellence', 'description' => 'Top performers in the final examinations.']
                ],
                'achievements' => [],
                'classes' => [],
                'academic_years' => []
            ];
        }

        // 2. Resolve Selected Academic Year (MUST be one of the available completed/archived achievement years)
        $academicYearId = !empty($params['academic_year_id']) ? (int)$params['academic_year_id'] : null;
        $availAyIds = array_map('intval', array_column($availableYears, 'id'));

        if (!$academicYearId || !in_array($academicYearId, $availAyIds, true)) {
            $academicYearId = (int)$availableYears[0]['id'];
        }

        // Auto-generate snapshots if not present for this completed/migrated academic year
        $this->autoGenerateAchievementsSnapshots($pdo, $schoolId, $academicYearId);

        // 4. Build Filters
        $category = !empty($params['category']) ? trim($params['category']) : null;
        $classId = isset($params['class_id']) && $params['class_id'] !== '' && $params['class_id'] !== 'ALL' ? (int)$params['class_id'] : null;
        $level = !empty($params['level']) ? trim($params['level']) : null; // 'school', 'class', 'all'
        $search = !empty($params['search']) ? trim($params['search']) : null;
        $sort = !empty($params['sort']) ? trim($params['sort']) : 'newest';

        $whereClause = " WHERE a.school_id = :sid AND a.academic_year_id = :ayid ";
        $queryParams = [':sid' => $schoolId, ':ayid' => $academicYearId];

        // 5. Enforce Student Visibility Rule (STUDENT / PARENT role only sees their own class)
        $role = strtoupper($user['role'] ?? '');
        if ($role === 'STUDENT' || $role === 'PARENT') {
            $userPhone = (string)($user['phone'] ?? '');
            $userEmail = (string)($user['email'] ?? '');
            if (empty($userPhone) && isset($user['id'])) {
                $stmtU = $pdo->prepare("SELECT phone, email FROM users WHERE id = :id LIMIT 1");
                $stmtU->execute([':id' => $user['id']]);
                $uRow = $stmtU->fetch(PDO::FETCH_ASSOC);
                if ($uRow) {
                    $userPhone = $uRow['phone'] ?? '';
                    $userEmail = $uRow['email'] ?? '';
                }
            }

            $studentClassId = null;
            if ($role === 'STUDENT') {
                $stmtSt = $pdo->prepare("
                    SELECT class_id FROM students 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid
                      AND (LOWER(email) = LOWER(:em1) OR LOWER(student_email) = LOWER(:em2) OR student_mobile = :ph1 OR parent_phone = :ph2)
                    ORDER BY (
                        SELECT COUNT(*) 
                        FROM academic_achievement_snapshots 
                        WHERE school_id = :sub_sid 
                          AND academic_year_id = :sub_ayid 
                          AND class_id = students.class_id
                    ) DESC, id DESC LIMIT 1
                ");
                $stmtSt->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':em1' => $userEmail, ':em2' => $userEmail, ':ph1' => $userPhone, ':ph2' => $userPhone, ':sub_sid' => $schoolId, ':sub_ayid' => $academicYearId]);
                $studentClassId = $stmtSt->fetchColumn();
            } else if ($role === 'PARENT') {
                $stmtSt = $pdo->prepare("
                    SELECT class_id FROM students 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid
                      AND (parent_phone = :ph1 OR father_phone = :ph2 OR guardian_phone = :ph3)
                    ORDER BY (
                        SELECT COUNT(*) 
                        FROM academic_achievement_snapshots 
                        WHERE school_id = :sub_sid 
                          AND academic_year_id = :sub_ayid 
                          AND class_id = students.class_id
                    ) DESC, id DESC LIMIT 1
                ");
                $stmtSt->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':ph1' => $userPhone, ':ph2' => $userPhone, ':ph3' => $userPhone, ':sub_sid' => $schoolId, ':sub_ayid' => $academicYearId]);
                $studentClassId = $stmtSt->fetchColumn();
            }

            if ($studentClassId) {
                $whereClause .= " AND a.class_id = :stu_class_id ";
                $queryParams[':stu_class_id'] = (int)$studentClassId;
            }
        }

        if ($category) {
            if ($category === 'attendance_champions') {
                $whereClause .= " AND a.feature_type = 'attendance_leaderboard' ";
            } else if ($category === 'academic_excellence') {
                $whereClause .= " AND a.feature_type = 'academic_excellence' ";
            } else {
                $whereClause .= " AND a.feature_type = :cat ";
                $queryParams[':cat'] = $category;
            }
        }

        if ($classId !== null) {
            $whereClause .= " AND a.class_id = :cid ";
            $queryParams[':cid'] = $classId;
        }

        if ($level === 'school') {
            $whereClause .= " AND a.class_id IS NULL ";
        } else if ($level === 'class') {
            $whereClause .= " AND a.class_id IS NOT NULL ";
        }

        if ($search) {
            $whereClause .= " AND (a.student_name LIKE :srch OR a.roll_number LIKE :srch OR a.class_name LIKE :srch) ";
            $queryParams[':srch'] = '%' . $search . '%';
        }

        // Order clause
        $orderBy = " ORDER BY a.created_at DESC, a.id DESC ";
        if ($sort === 'rank') {
            $orderBy = " ORDER BY a.`rank` ASC, a.achievement_score DESC ";
        } else if ($sort === 'class') {
            $orderBy = " ORDER BY a.class_name ASC, a.`rank` ASC ";
        } else if ($sort === 'academic_year') {
            $orderBy = " ORDER BY a.academic_year_id DESC, a.`rank` ASC ";
        }

        // Execute achievements query
        $stmtSelect = $pdo->prepare("
            SELECT a.*, COALESCE(NULLIF(s.photo_path, ''), a.student_photo) AS student_photo 
            FROM academic_achievement_snapshots a 
            LEFT JOIN students s ON a.student_id = s.id 
            {$whereClause} {$orderBy}
        ");
        $stmtSelect->execute($queryParams);
        $rawAchievements = $stmtSelect->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $achievements = [];
        foreach ($rawAchievements as $row) {
            $meta = !empty($row['metadata']) ? json_decode($row['metadata'], true) : [];
            $achievements[] = [
                'id' => (int)$row['id'],
                'school_id' => (int)$row['school_id'],
                'academic_year_id' => (int)$row['academic_year_id'],
                'feature_type' => $row['feature_type'],
                'category' => $row['feature_type'] === 'attendance_leaderboard' ? 'attendance_champions' : $row['feature_type'],
                'category_label' => $row['feature_type'] === 'attendance_leaderboard' ? 'Attendance Champions' : ($row['feature_type'] === 'academic_excellence' ? 'Academic Excellence' : ucwords(str_replace('_', ' ', $row['feature_type']))),
                'class_id' => $row['class_id'] !== null ? (int)$row['class_id'] : null,
                'student_id' => (int)$row['student_id'],
                'student_name' => $row['student_name'],
                'student_photo' => $row['student_photo'],
                'class_name' => $row['class_name'],
                'roll_number' => $row['roll_number'],
                'achievement_score' => (float)$row['achievement_score'],
                'rank' => (int)$row['rank'],
                'level' => $row['class_id'] === null ? 'school' : 'class',
                'metadata' => $meta,
                'created_at' => $row['created_at']
            ];
        }

        // Summary counts for this academic year
        $stmtAttCnt = $pdo->prepare("SELECT COUNT(*) FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id = :ayid AND feature_type = 'attendance_leaderboard'");
        $stmtAttCnt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $attCount = (int)$stmtAttCnt->fetchColumn();

        $stmtAcadCnt = $pdo->prepare("SELECT COUNT(*) FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id = :ayid AND feature_type = 'academic_excellence'");
        $stmtAcadCnt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $acadCount = (int)$stmtAcadCnt->fetchColumn();

        // Fetch classes list for this academic year
        $stmtClasses = $pdo->prepare("SELECT id, name, section FROM classes WHERE school_id = :sid AND academic_year_id = :ayid ORDER BY name ASC, section ASC");
        $stmtClasses->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $classList = $stmtClasses->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch academic years list
        $stmtAYs = $pdo->prepare("SELECT id, name, status, is_current FROM academic_years WHERE school_id = :sid ORDER BY id DESC");
        $stmtAYs->execute([':sid' => $schoolId]);
        $ayList = $stmtAYs->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch selected academic year name
        $stmtSelAYName = $pdo->prepare("SELECT name FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
        $stmtSelAYName->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
        $selAYName = $stmtSelAYName->fetchColumn() ?: '';

        return [
            'available_achievement_years' => $availableYears,
            'academic_year_id' => $academicYearId,
            'academic_year_name' => $selAYName,
            'categories_summary' => [
                'attendance_champions' => [
                    'count' => $attCount,
                    'label' => 'Attendance Champions',
                    'description' => 'Students with outstanding school attendance.'
                ],
                'academic_excellence' => [
                    'count' => $acadCount,
                    'label' => 'Academic Excellence',
                    'description' => 'Top performers in the final examinations.'
                ]
            ],
            'achievements' => $achievements,
            'classes' => $classList,
            'academic_years' => $ayList
        ];
    }

    private function autoGenerateAchievementsSnapshots(PDO $pdo, int $schoolId, int $academicYearId): void
    {
        // 0. Verify Academic Year Migration Status
        $stmtAYCheck = $pdo->prepare("SELECT migration_status, status FROM academic_years WHERE id = :ayid AND school_id = :sid");
        $stmtAYCheck->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
        $ayData = $stmtAYCheck->fetch(PDO::FETCH_ASSOC);

        // Achievements & certificates MUST ONLY be generated when Migration is completed!
        if (!$ayData || ($ayData['migration_status'] !== 'Completed' && $ayData['status'] !== 'Archived')) {
            return;
        }

        // Purge old achievement snapshots from prior academic years so only the latest migrated session's achievements are retained
        $stmtPurgeOld = $pdo->prepare("DELETE FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id != :ayid");
        $stmtPurgeOld->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);

        $anyGenerated = false;

        // Pre-calculate Final Exam Marks Percentage for all students in this Academic Year (used as Tie-Breaker)
        $stmtExamMarks = $pdo->prepare("
            SELECT 
                em.student_id,
                SUM(CASE WHEN em.is_absent = 0 AND em.marks_obtained IS NOT NULL THEN em.marks_obtained ELSE 0 END) AS total_obtained,
                SUM(CASE WHEN em.marks_obtained IS NOT NULL OR em.is_absent = 1 THEN ep.max_marks ELSE 0 END) AS total_max
            FROM examination_marks em
            JOIN examination_papers ep ON em.paper_id = ep.id
            JOIN examinations e ON em.exam_id = e.id
            WHERE e.school_id = :sid AND e.academic_year_id = :ayid
            GROUP BY em.student_id
        ");
        $stmtExamMarks->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $examRows = $stmtExamMarks->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $studentExamPctMap = [];
        foreach ($examRows as $erow) {
            $stuId = (int)$erow['student_id'];
            $totMax = (float)$erow['total_max'];
            $totObt = (float)$erow['total_obtained'];
            $studentExamPctMap[$stuId] = $totMax > 0 ? round(($totObt / $totMax) * 100, 2) : 0.00;
        }

        // Reusable Attendance Roster Sorting Callback (Tie-Breaker: Exam Marks %)
        $sortAttendanceRoster = function (&$roster) {
            usort($roster, function ($a, $b) {
                // 1. Primary: Attendance Percentage
                if (abs($b['percentage'] - $a['percentage']) > 0.001) {
                    return $b['percentage'] <=> $a['percentage'];
                }
                // 2. Tie-Breaker: Final Exam Marks Percentage
                if (abs($b['exam_percentage'] - $a['exam_percentage']) > 0.001) {
                    return $b['exam_percentage'] <=> $a['exam_percentage'];
                }
                // 3. Fallback: Present Days
                if ($b['present_days'] != $a['present_days']) {
                    return $b['present_days'] <=> $a['present_days'];
                }
                return strcasecmp($a['student_name'], $b['student_name']);
            });
        };

        // 1. Attendance Leaderboard Auto-Generation (if attendance exists)
        $stmtAttCheck = $pdo->prepare("SELECT COUNT(*) FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id = :ayid AND feature_type = 'attendance_leaderboard'");
        $stmtAttCheck->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        if ((int)$stmtAttCheck->fetchColumn() === 0) {
            $stmtCalc = $pdo->prepare("
                SELECT 
                    s.id AS student_id,
                    s.name AS student_name,
                    s.photo_path AS student_photo,
                    s.roll_no AS roll_number,
                    c.name AS class_name,
                    c.id AS class_id,
                    COUNT(a.id) AS total_working_days,
                    SUM(CASE WHEN UPPER(a.status) IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS present_days
                FROM students s
                INNER JOIN classes c ON s.class_id = c.id
                INNER JOIN attendance a ON s.id = a.student_id
                WHERE c.academic_year_id = :ay_id AND c.school_id = :sid
                GROUP BY s.id, c.id
                HAVING total_working_days > 0
            ");
            $stmtCalc->execute([':ay_id' => $academicYearId, ':sid' => $schoolId]);
            $studentsList = $stmtCalc->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if (!empty($studentsList)) {
                $overallList = [];
                foreach ($studentsList as $stu) {
                    $stuId = (int)$stu['student_id'];
                    $total = (int)$stu['total_working_days'];
                    $present = (int)$stu['present_days'];
                    $pct = $total > 0 ? round(($present / $total) * 100, 2) : 0.00;
                    $examPct = isset($studentExamPctMap[$stuId]) ? (float)$studentExamPctMap[$stuId] : 0.00;

                    $overallList[] = array_merge($stu, [
                        'percentage' => $pct,
                        'exam_percentage' => $examPct
                    ]);
                }

                $sortAttendanceRoster($overallList);

                $classGroups = [];
                foreach ($overallList as $stu) {
                    $classGroups[$stu['class_id']][] = $stu;
                }

                $classWiseTop3 = [];
                foreach ($classGroups as $classId => $roster) {
                    $sortAttendanceRoster($roster);
                    $classWiseTop3[$classId] = array_slice($roster, 0, 3);
                }

                $stmtInsert = $pdo->prepare("
                    INSERT INTO academic_achievement_snapshots (
                        school_id, academic_year_id, feature_type, class_id, 
                        student_id, student_name, student_photo, class_name, roll_number, 
                        achievement_score, `rank`, metadata
                    ) VALUES (
                        :sid, :ay_id, 'attendance_leaderboard', :class_id,
                        :stu_id, :stu_name, :stu_photo, :cls_name, :roll,
                        :score, :rank, :meta
                    )
                ");

                foreach ($classWiseTop3 as $classId => $roster) {
                    foreach ($roster as $idx => $row) {
                        $rank = $idx + 1;
                        $stmtInsert->execute([
                            ':sid' => $schoolId,
                            ':ay_id' => $academicYearId,
                            ':class_id' => $classId,
                            ':stu_id' => $row['student_id'],
                            ':stu_name' => $row['student_name'],
                            ':stu_photo' => $row['student_photo'],
                            ':cls_name' => $row['class_name'],
                            ':roll' => $row['roll_number'],
                            ':score' => $row['percentage'],
                            ':rank' => $rank,
                            ':meta' => json_encode(['present_days' => $row['present_days'], 'total_working_days' => $row['total_working_days'], 'exam_percentage' => $row['exam_percentage']])
                        ]);
                        $anyGenerated = true;
                    }
                }
            }
        }

        // 2. Academic Excellence Auto-Generation (if exam marks exist)
        $stmtAcadCheck = $pdo->prepare("SELECT COUNT(*) FROM academic_achievement_snapshots WHERE school_id = :sid AND academic_year_id = :ayid AND feature_type = 'academic_excellence'");
        $stmtAcadCheck->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        if ((int)$stmtAcadCheck->fetchColumn() === 0) {
            // Find all classes in this academic year
            $stmtClasses = $pdo->prepare("SELECT id, name, section FROM classes WHERE school_id = :sid AND academic_year_id = :ayid");
            $stmtClasses->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
            $classes = $stmtClasses->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $stmtInsAcad = $pdo->prepare("
                INSERT INTO academic_achievement_snapshots (
                    school_id, academic_year_id, feature_type, class_id, 
                    student_id, student_name, student_photo, class_name, roll_number, 
                    achievement_score, `rank`, metadata
                ) VALUES (
                    :sid, :ay_id, 'academic_excellence', :class_id,
                    :stu_id, :stu_name, :stu_photo, :cls_name, :roll,
                    :score, :rank, :meta
                )
            ");

            foreach ($classes as $cls) {
                $classId = (int)$cls['id'];
                $className = $cls['name'];

                // Calculate cumulative grand total marks obtained and max marks across ALL examinations in this Academic Year
                $stmtCumCalc = $pdo->prepare("
                    SELECT 
                        s.id AS student_id,
                        s.name AS student_name,
                        s.photo_path AS student_photo,
                        s.roll_no AS roll_number,
                        SUM(CASE WHEN em.is_absent = 0 AND em.marks_obtained IS NOT NULL THEN em.marks_obtained ELSE 0 END) AS cumulative_obtained,
                        SUM(CASE WHEN em.marks_obtained IS NOT NULL OR em.is_absent = 1 THEN ep.max_marks ELSE 0 END) AS cumulative_max
                    FROM students s
                    INNER JOIN examination_marks em ON s.id = em.student_id
                    INNER JOIN examination_papers ep ON em.paper_id = ep.id
                    INNER JOIN examinations e ON em.exam_id = e.id
                    WHERE e.school_id = :sid 
                      AND e.academic_year_id = :ayid 
                      AND s.class_id = :cid
                    GROUP BY s.id
                    HAVING cumulative_max > 0
                ");
                $stmtCumCalc->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':cid' => $classId]);
                $cumRows = $stmtCumCalc->fetchAll(PDO::FETCH_ASSOC) ?: [];

                if (!empty($cumRows)) {
                    $roster = [];
                    foreach ($cumRows as $r) {
                        $totMax = (float)$r['cumulative_max'];
                        $totObt = (float)$r['cumulative_obtained'];
                        $pct = $totMax > 0 ? round(($totObt / $totMax) * 100, 2) : 0.00;
                        $roster[] = array_merge($r, [
                            'percentage' => $pct,
                            'total_obtained' => $totObt,
                            'total_max' => $totMax
                        ]);
                    }

                    usort($roster, function($a, $b) {
                        return (float)($b['percentage'] ?? 0) <=> (float)($a['percentage'] ?? 0);
                    });

                    $top3 = array_slice($roster, 0, 3);
                    foreach ($top3 as $idx => $rc) {
                        $rank = $idx + 1;
                        $stuId = (int)$rc['student_id'];
                        $pct = (float)$rc['percentage'];

                        $stmtInsAcad->execute([
                            ':sid' => $schoolId,
                            ':ay_id' => $academicYearId,
                            ':class_id' => $classId,
                            ':stu_id' => $stuId,
                            ':stu_name' => $rc['student_name'],
                            ':stu_photo' => $rc['student_photo'] ?: null,
                            ':cls_name' => $className . (!empty($cls['section']) && strpos($className, $cls['section']) === false ? ' - ' . $cls['section'] : ''),
                            ':roll' => $rc['roll_number'] ?? '',
                            ':score' => $pct,
                            ':rank' => $rank,
                            ':meta' => json_encode([
                                'exam_name' => 'Overall Academic Performance',
                                'total_obtained' => $rc['total_obtained'],
                                'total_max' => $rc['total_max'],
                                'percentage' => $pct,
                                'result' => 'PASS'
                            ])
                        ]);
                        $anyGenerated = true;
                    }
                }
            }
        }

        if ($anyGenerated) {
            $this->notifySingleAchievementsUnlocked($pdo, $schoolId);
        }
    }

    private function notifySingleAchievementsUnlocked(PDO $pdo, int $schoolId): void
    {
        try {
            $title = "Achievements Unlocked";
            $message = "The achievement leaderboard is now available. See the top performers in attendance and academics.";

            $stmtInsNotif = $pdo->prepare("
                INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, is_read)
                VALUES (:sid, :role, :title, :msg, '/achievements', 0)
            ");

            // Notify STUDENT role
            $stmtInsNotif->execute([
                ':sid' => $schoolId,
                ':role' => 'STUDENT',
                ':title' => $title,
                ':msg' => $message
            ]);

            // Notify TEACHER role
            $stmtInsNotif->execute([
                ':sid' => $schoolId,
                ':role' => 'TEACHER',
                ':title' => $title,
                ':msg' => $message
            ]);
        } catch (\Throwable $e) {
            error_log("Failed to send single achievement notification: " . $e->getMessage());
        }
    }

    private function notifyAchievementGenerated(PDO $pdo, int $schoolId, int $studentId, string $studentName, string $title, string $message): void
    {
        try {
            $stmtS = $pdo->prepare("SELECT parent_phone, student_mobile, phone FROM students WHERE id = :sid LIMIT 1");
            $stmtS->execute([':sid' => $studentId]);
            $stu = $stmtS->fetch(PDO::FETCH_ASSOC);

            if ($stu) {
                $stmtInsNotif = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, is_read)
                    VALUES (:sid, :role, :title, :msg, '/achievements', 0)
                ");

                // Notify student role
                $stmtInsNotif->execute([
                    ':sid' => $schoolId,
                    ':role' => 'STUDENT',
                    ':title' => $title,
                    ':msg' => $message
                ]);

                // Notify parent role
                $stmtInsNotif->execute([
                    ':sid' => $schoolId,
                    ':role' => 'PARENT',
                    ':title' => $title,
                    ':msg' => "Child: {$studentName} - " . $message
                ]);
            }
        } catch (\Exception $e) {
            // Ignore notification failures
        }
    }

    public function getAchievementReportCard(array $user, int $achievementId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->attendanceRepo->getPdo();

        $stmt = $pdo->prepare("SELECT * FROM academic_achievement_snapshots WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmt->execute([':id' => $achievementId, ':sid' => $schoolId]);
        $achievement = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$achievement) {
            throw new NotFoundException('Achievement record not found.');
        }

        $targetStudentId = (int)$achievement['student_id'];
        $role = strtoupper($user['role'] ?? '');

        // Security / Authorization check
        if (!in_array($role, ['SUPER_ADMIN', 'SUPERADMIN', 'SCHOOL_ADMIN', 'SCHOOLADMIN', 'TEACHER'])) {
            $isAuthorized = false;
            $userPhone = (string)($user['phone'] ?? '');
            $userEmail = (string)($user['email'] ?? '');

            // Fetch student info
            $stmtStu = $pdo->prepare("SELECT id, student_mobile, parent_phone FROM students WHERE id = :sid LIMIT 1");
            $stmtStu->execute([':sid' => $targetStudentId]);
            $stu = $stmtStu->fetch(PDO::FETCH_ASSOC);

            if ($stu) {
                if ($role === 'STUDENT' || $role === 'PARENT') {
                    if ($userPhone !== '' && ($userPhone === (string)$stu['student_mobile'] || $userPhone === (string)$stu['parent_phone'])) {
                        $isAuthorized = true;
                    }
                }
            }

            if (!$isAuthorized && isset($achievement['class_id'])) {
                // Check if user belongs to the same class as the achievement
                $stmtClassCheck = $pdo->prepare("
                    SELECT COUNT(*) FROM students 
                    WHERE school_id = :sid 
                      AND class_id = :cid 
                      AND (LOWER(email) = LOWER(:em1) OR LOWER(student_email) = LOWER(:em2) OR student_mobile = :ph1 OR parent_phone = :ph2 OR father_phone = :ph3 OR guardian_phone = :ph4)
                ");
                $stmtClassCheck->execute([
                    ':sid' => $schoolId,
                    ':cid' => (int)$achievement['class_id'],
                    ':em1' => $userEmail,
                    ':em2' => $userEmail,
                    ':ph1' => $userPhone,
                    ':ph2' => $userPhone,
                    ':ph3' => $userPhone,
                    ':ph4' => $userPhone
                ]);
                if ((int)$stmtClassCheck->fetchColumn() > 0) {
                    $isAuthorized = true;
                }
            }

            if (!$isAuthorized) {
                throw new ForbiddenException('Report card viewing is restricted to the student, parent, teachers, and school admin.');
            }
        }

        $meta = !empty($achievement['metadata']) ? json_decode($achievement['metadata'], true) : [];
        $examId = isset($meta['exam_id']) ? (int)$meta['exam_id'] : null;
        $classId = (int)$achievement['class_id'];

        if (!$examId) {
            $stmtEx = $pdo->prepare("
                SELECT e.id FROM examinations e 
                JOIN examination_papers ep ON ep.exam_id = e.id 
                WHERE ep.class_id = :cid AND e.school_id = :sid 
                ORDER BY e.id DESC LIMIT 1
            ");
            $stmtEx->execute([':cid' => $classId, ':sid' => $schoolId]);
            $examId = (int)$stmtEx->fetchColumn();
        }

        if (!$examId || !$classId) {
            throw new ValidationException(['report_card' => 'Report card is not available for this achievement.']);
        }

        return $this->getReportCards($user, $examId, $classId, $targetStudentId);
    }

    public function markAttendance(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->attendanceRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $records = $data['students'] ?? $data['records'] ?? null;
        if (is_array($records) && !empty($records)) {
            $date = $data['date'] ?? date('Y-m-d');
            $classId = isset($data['class_id']) ? (int)$data['class_id'] : null;

            // Boundary date validation
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

            $pdo->beginTransaction();
            $absentStudentIds = [];
            try {
                foreach ($records as $item) {
                    $stId = (int)($item['student_id'] ?? $item['id'] ?? 0);
                    if (!$stId) continue;
                    $stStatus = $item['status'] ?? 'Present';
                    $stClassId = isset($item['class_id']) ? (int)$item['class_id'] : $classId;

                    if (strtolower((string)$stStatus) === 'absent') {
                        $absentStudentIds[] = $stId;
                    }

                    $this->attendanceRepo->upsert([
                        'school_id'  => $schoolId,
                        'student_id' => $stId,
                        'class_id'   => $stClassId,
                        'date'       => $date,
                        'status'     => $stStatus,
                        'marked_by'  => (int) $user['id'],
                    ]);
                }
                $pdo->commit();

                $this->dispatchAbsentNotifications($pdo, $schoolId, $absentStudentIds);

                return ['success' => true, 'date' => $date, 'count' => count($records)];
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

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

        $this->attendanceRepo->upsert([
            'school_id'  => $this->getSchoolId($user),
            'student_id' => (int) $data['student_id'],
            'class_id'   => isset($data['class_id']) ? (int) $data['class_id'] : null,
            'date'       => $date,
            'status'     => $status,
            'marked_by'  => (int) $user['id'],
        ]);

        if (strtolower((string)$status) === 'absent') {
            $this->dispatchAbsentNotifications($pdo, $schoolId, [(int)$data['student_id']]);
        }

        return ['success' => true, 'date' => $date, 'status' => $status];
    }

    private function dispatchAbsentNotifications(PDO $pdo, int $schoolId, array $absentStudentIds): void
    {
        if (empty($absentStudentIds)) return;
        try {
            $inPlaceholders = implode(',', array_fill(0, count($absentStudentIds), '?'));
            $stmtUsers = $pdo->prepare("
                SELECT DISTINCT u.id AS user_id, u.role
                FROM students s
                JOIN users u ON u.school_id = s.school_id AND (
                    u.phone = s.student_mobile OR 
                    u.phone = s.parent_phone OR 
                    u.phone = s.father_phone OR 
                    u.phone = s.mother_phone OR 
                    u.phone = s.guardian_phone OR 
                    (u.email IS NOT NULL AND u.email = s.email AND u.email != '')
                )
                WHERE s.id IN ($inPlaceholders) 
                  AND s.school_id = ? 
                  AND u.role IN ('STUDENT', 'PARENT')
            ");
            $params = array_merge($absentStudentIds, [$schoolId]);
            $stmtUsers->execute($params);
            $recipients = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($recipients)) {
                $dispatcher = new \App\Shared\Notifications\PushDispatcher(
                    $pdo,
                    new \App\Shared\Notifications\FcmClient($pdo)
                );
                $dispatcher->toUsers(
                    $schoolId,
                    $recipients,
                    'ATTENDANCE_MARKED_ABSENT',
                    'You are absent today.',
                    'Attendance has been marked for today, You can check the attendance.',
                    '/attendance'
                );
            }
        } catch (\Throwable $ne) {
            // Suppress notification errors so attendance commit is preserved
        }
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

        if ($this->isDateHoliday($schoolId, $startDate)) {
            throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
        }

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

        // Check if day is already published for this class
        $stmtIsPub = $pdo->prepare("SELECT 1 FROM timetable WHERE class_id = :cid AND day_of_week = :day AND school_id = :sid AND is_published = 1 LIMIT 1");
        $stmtIsPub->execute([':cid' => $data['class_id'], ':day' => $data['day_of_week'], ':sid' => $schoolId]);
        $isPub = (bool)$stmtIsPub->fetchColumn();
        $isPublishedVal = $isPub ? 1 : 0;

        $stmtInsert = $pdo->prepare("
            INSERT INTO timetable (school_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_date, is_published)
            VALUES (:sid, :cid, :subid, :tid, :day, :pnum, :start_date, :is_published)
        ");
        $stmtInsert->execute([
            ':sid' => $schoolId,
            ':cid' => $data['class_id'],
            ':subid' => $data['subject_id'],
            ':tid' => $data['teacher_id'],
            ':day' => $data['day_of_week'],
            ':pnum' => $data['period_number'],
            ':start_date' => $startDate,
            ':is_published' => $isPublishedVal
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

        if ($this->isDateHoliday($schoolId, $data['date'])) {
            throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
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

        if ($this->isDateHoliday($schoolId, $data['date'])) {
            throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
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

        if (!empty($data['date'])) {
            if ($dayOfWeek) {
                if ($this->isDateHoliday($schoolId, $data['date'])) {
                    throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
                }
            } else {
                $baseDate = new \DateTime($data['date']);
                $dayOfWeekNum = (int)$baseDate->format('N'); // 1 = Monday, 7 = Sunday
                if ($dayOfWeekNum !== 1) {
                    $baseDate->modify('last monday');
                }
                
                for ($i = 0; $i < 6; $i++) {
                    $currentDay = clone $baseDate;
                    $currentDay->modify("+$i days");
                    $currentDayStr = $currentDay->format('Y-m-d');
                    
                    if ($this->isDateHoliday($schoolId, $currentDayStr)) {
                        throw new ValidationException(['date' => 'Cannot create or publish timetable on a school holiday.']);
                    }
                }
            }
        }
        $classId = (int)$data['class_id'];

        // Check if already published & get previous teacher IDs before update
        $isAlreadyPublished = false;
        $prevTeacherIds = [];
        if ($dayOfWeek) {
            $stmtCheckAlready = $pdo->prepare("
                SELECT COUNT(*) FROM timetable 
                WHERE school_id = :sid AND class_id = :cid AND day_of_week = :day AND is_published = 1
            ");
            $stmtCheckAlready->execute([':sid' => $schoolId, ':cid' => $classId, ':day' => $dayOfWeek]);
            $isAlreadyPublished = (int)$stmtCheckAlready->fetchColumn() > 0;

            $stmtPrevTeachers = $pdo->prepare("
                SELECT DISTINCT teacher_id FROM timetable 
                WHERE school_id = :sid AND class_id = :cid AND day_of_week = :day AND teacher_id IS NOT NULL AND is_published = 1
            ");
            $stmtPrevTeachers->execute([':sid' => $schoolId, ':cid' => $classId, ':day' => $dayOfWeek]);
            $prevTeacherIds = array_map('intval', $stmtPrevTeachers->fetchAll(PDO::FETCH_COLUMN) ?: []);
        }

        if ($dayOfWeek) {
            $stmtPublish = $pdo->prepare("
                UPDATE timetable 
                SET is_published = 1
                WHERE school_id = :sid AND class_id = :cid AND day_of_week = :day
            ");
            $stmtPublish->execute([
                ':sid' => $schoolId,
                ':cid' => $classId,
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
                ':cid' => $classId
            ]);
        }

        // Send Notifications for students and teachers
        if ($dayOfWeek) {
            $stmtNewTeachers = $pdo->prepare("
                SELECT DISTINCT teacher_id FROM timetable 
                WHERE school_id = :sid AND class_id = :cid AND day_of_week = :day AND teacher_id IS NOT NULL AND is_published = 1
            ");
            $stmtNewTeachers->execute([':sid' => $schoolId, ':cid' => $classId, ':day' => $dayOfWeek]);
            $newTeacherIds = array_map('intval', $stmtNewTeachers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            $stmtClass = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
            $stmtClass->execute([':cid' => $classId]);
            $classRow = $stmtClass->fetch(PDO::FETCH_ASSOC);
            $className = $classRow ? trim(($classRow['name'] ?? '') . ' ' . ($classRow['section'] ?? '')) : "Class";

            if (!$isAlreadyPublished) {
                // First Time Publish
                $studentMsg = "Timetable for {$className} ({$dayOfWeek}) has been published.";
                $this->notifyClassStudents($pdo, $schoolId, $classId, "Timetable Published", $studentMsg);

                foreach ($newTeacherIds as $tId) {
                    $teacherMsg = "You have been assigned period(s) in {$className} for {$dayOfWeek}.";
                    $this->notifyTeacherUser($pdo, $schoolId, $tId, "Timetable Assigned", $teacherMsg);
                }
            } else {
                // Update / Re-publish
                $studentMsg = "Timetable for {$className} ({$dayOfWeek}) has been updated.";
                $this->notifyClassStudents($pdo, $schoolId, $classId, "Timetable Updated", $studentMsg);

                foreach ($newTeacherIds as $tId) {
                    $teacherMsg = "Your timetable schedule for {$className} ({$dayOfWeek}) has been updated.";
                    $this->notifyTeacherUser($pdo, $schoolId, $tId, "Timetable Schedule Updated", $teacherMsg);
                }

                // Removed Teachers
                $removedTeacherIds = array_diff($prevTeacherIds, $newTeacherIds);
                foreach ($removedTeacherIds as $rId) {
                    $removedMsg = "You have been replaced/removed from {$className} timetable for {$dayOfWeek}.";
                    $this->notifyTeacherUser($pdo, $schoolId, $rId, "Timetable Schedule Changed", $removedMsg);
                }
            }
        }
    }

    public function getSubjects(array $user, ?int $classId = null): array
    {
        $pdo  = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Retrieve working academic year
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        if ($academicYearId > 0) {
            $stmt = $pdo->prepare("
                SELECT s.*, st.name AS teacher_name
                FROM subjects s
                LEFT JOIN staff st ON s.teacher_id = st.id
                WHERE s.school_id = :sid
                  AND s.id NOT IN (
                      SELECT subject_id FROM academic_year_disabled_subjects WHERE academic_year_id = :ayid
                  )
                ORDER BY s.id DESC
            ");
            $stmt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT s.*, st.name AS teacher_name
                FROM subjects s
                LEFT JOIN staff st ON s.teacher_id = st.id
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

        // Retrieve working academic year
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // Check if existing subject with this name exists for school
        $stmtExisting = $pdo->prepare("
            SELECT id FROM subjects 
            WHERE school_id = :sid AND LOWER(name) = LOWER(:name)
            LIMIT 1
        ");
        $stmtExisting->execute([':sid' => $schoolId, ':name' => $name]);
        $existingId = $stmtExisting->fetchColumn();

        if ($existingId !== false) {
            // Check if disabled in current academic year
            if ($academicYearId > 0) {
                $stmtDisabledCheck = $pdo->prepare("
                    SELECT COUNT(*) FROM academic_year_disabled_subjects 
                    WHERE academic_year_id = :ayid AND subject_id = :subid
                ");
                $stmtDisabledCheck->execute([':ayid' => $academicYearId, ':subid' => $existingId]);
                if ((int)$stmtDisabledCheck->fetchColumn() > 0) {
                    // Re-enable subject for this academic year
                    $pdo->prepare("
                        DELETE FROM academic_year_disabled_subjects 
                        WHERE academic_year_id = :ayid AND subject_id = :subid
                    ")->execute([':ayid' => $academicYearId, ':subid' => $existingId]);
                    return ['id' => (int)$existingId];
                }
            }
            throw new ValidationException(['name' => 'This subject already exists.']);
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO subjects (school_id, name, class_id, teacher_id)
            VALUES (:sid, :name, NULL, NULL)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':name' => $name
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

        // Case-insensitive duplicate check excluding self within the school
        $stmtCheck = $pdo->prepare("
            SELECT COUNT(*) FROM subjects 
            WHERE school_id = :sid AND LOWER(name) = LOWER(:name) AND id != :id
        ");
        $stmtCheck->execute([':sid' => $schoolId, ':name' => $name, ':id' => $id]);

        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['name' => 'This subject already exists.']);
        }
        
        $stmt = $pdo->prepare("
            UPDATE subjects 
            SET name = :name, class_id = NULL, teacher_id = NULL
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([
            ':name' => $name,
            ':id' => $id,
            ':sid' => $schoolId
        ]);
        return ['success' => true];
    }

    public function deleteSubject(array $user, int $id): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Retrieve working academic year
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // 1. Report card marks safety check: Only block if actual marks have been entered for this subject in the working academic year
        if ($academicYearId > 0) {
            $stmtMarks = $pdo->prepare("
                SELECT COUNT(*) FROM examination_marks em
                JOIN examination_papers ep ON em.paper_id = ep.id
                JOIN classes c ON ep.class_id = c.id
                WHERE ep.subject_id = :id AND c.academic_year_id = :ayid AND (em.marks_obtained IS NOT NULL OR em.is_absent = 1)
            ");
            $stmtMarks->execute([':id' => $id, ':ayid' => $academicYearId]);
        } else {
            $stmtMarks = $pdo->prepare("
                SELECT COUNT(*) FROM examination_marks em
                JOIN examination_papers ep ON em.paper_id = ep.id
                WHERE ep.subject_id = :id AND (em.marks_obtained IS NOT NULL OR em.is_absent = 1)
            ");
            $stmtMarks->execute([':id' => $id]);
        }

        if ((int)$stmtMarks->fetchColumn() > 0) {
            throw new ValidationException([
                'subject' => 'This subject has recorded examination marks in report cards for the current academic year. It cannot be deleted as it would alter report card records.'
            ]);
        }

        // Clean up un-entered examination_papers and timetable entries linked to this subject in the working academic year
        if ($academicYearId > 0) {
            $pdo->prepare("
                DELETE ep FROM examination_papers ep
                JOIN classes c ON ep.class_id = c.id
                WHERE ep.subject_id = :id AND c.academic_year_id = :ayid
            ")->execute([':id' => $id, ':ayid' => $academicYearId]);

            $pdo->prepare("
                DELETE t FROM timetable t
                JOIN classes c ON t.class_id = c.id
                WHERE t.subject_id = :id AND t.school_id = :sid AND c.academic_year_id = :ayid
            ")->execute([':id' => $id, ':sid' => $schoolId, ':ayid' => $academicYearId]);

            // Disable subject for working academic year so previous academic year retains its subjects intact
            $stmtDisable = $pdo->prepare("
                INSERT IGNORE INTO academic_year_disabled_subjects (school_id, academic_year_id, subject_id)
                VALUES (:sid, :ayid, :subid)
            ");
            $stmtDisable->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':subid' => $id]);
        }

        // Check if subject is used in ANY other academic year (timetable, papers, or marks)
        $stmtOtherUsed = $pdo->prepare("
            SELECT (
                (SELECT COUNT(*) FROM timetable WHERE subject_id = :id1 AND school_id = :sid1) +
                (SELECT COUNT(*) FROM examination_papers WHERE subject_id = :id2) +
                (SELECT COUNT(*) FROM examination_marks em JOIN examination_papers ep ON em.paper_id = ep.id WHERE ep.subject_id = :id3)
            ) AS total_count
        ");
        $stmtOtherUsed->execute([':id1' => $id, ':sid1' => $schoolId, ':id2' => $id, ':id3' => $id]);
        $totalCount = (int)$stmtOtherUsed->fetchColumn();

        // If not used anywhere else in the school, clean up and delete master record
        if ($totalCount === 0) {
            $pdo->prepare("DELETE FROM academic_year_disabled_subjects WHERE subject_id = :id")->execute([':id' => $id]);
            $pdo->prepare("DELETE FROM subjects WHERE id = :id AND school_id = :sid")->execute([':id' => $id, ':sid' => $schoolId]);
        }
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
        
        // Fallback 1: If empty, get the latest configurations created for this school
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

        // Fallback 2: If STILL empty, generate default period_configurations from school_timetable_settings
        if (empty($rows)) {
            $settings = $this->getTimetableSettings($user);
            if ($settings && !empty($settings['total_periods'])) {
                $defaultStartTime = !empty($settings['school_start_time']) ? $settings['school_start_time'] : '08:00:00';
                $defaultPeriodDuration = !empty($settings['period_duration']) ? (int)$settings['period_duration'] : 40;
                $defaultIntervalDuration = isset($settings['interval_duration']) ? (int)$settings['interval_duration'] : 20;
                $defaultIntervalAfter = !empty($settings['interval_after_period']) ? (int)$settings['interval_after_period'] : 4;
                $defaultTotalPeriods = (int)$settings['total_periods'];
                $today = !empty($settings['start_date']) ? $settings['start_date'] : date('Y-m-d');

                $startTime = strtotime($defaultStartTime);
                $currentTime = $startTime;

                $stmtInsPeriod = $pdo->prepare("
                    INSERT INTO period_configurations (school_id, period_number, start_time, end_time, start_date)
                    VALUES (:sid, :pnum, :start_time, :end_time, :start_date)
                ");

                for ($i = 1; $i <= $defaultTotalPeriods; $i++) {
                    $pStart = date('H:i:s', $currentTime);
                    $currentTime += $defaultPeriodDuration * 60;
                    $pEnd = date('H:i:s', $currentTime);

                    $stmtInsPeriod->execute([
                        ':sid' => $schoolId,
                        ':pnum' => $i,
                        ':start_time' => $pStart,
                        ':end_time' => $pEnd,
                        ':start_date' => $today
                    ]);

                    if ($i === $defaultIntervalAfter && $defaultIntervalDuration > 0) {
                        $currentTime += $defaultIntervalDuration * 60;
                    }
                }

                $stmt->execute([':sid' => $schoolId]);
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            }
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
        
        if ($row === false) {
            $today = date('Y-m-d');
            $defaultStartTime = '08:00';
            $defaultPeriodDuration = 40;
            $defaultIntervalDuration = 20;
            $defaultIntervalAfter = 4;
            $defaultTotalPeriods = 8;

            $pdo->beginTransaction();
            try {
                // Insert default settings record
                $stmtInsSetting = $pdo->prepare("
                    INSERT INTO school_timetable_settings (school_id, school_start_time, period_duration, interval_duration, interval_after_period, total_periods, start_date)
                    VALUES (:sid, :start_time, :period_dur, :interval_dur, :interval_after, :total_p, :start_date)
                ");
                $stmtInsSetting->execute([
                    ':sid' => $schoolId,
                    ':start_time' => $defaultStartTime,
                    ':period_dur' => $defaultPeriodDuration,
                    ':interval_dur' => $defaultIntervalDuration,
                    ':interval_after' => $defaultIntervalAfter,
                    ':total_p' => $defaultTotalPeriods,
                    ':start_date' => $today
                ]);

                // Calculate and insert period timings
                $startTime = strtotime($defaultStartTime);
                $currentTime = $startTime;

                $stmtInsPeriod = $pdo->prepare("
                    INSERT INTO period_configurations (school_id, period_number, start_time, end_time, start_date)
                    VALUES (:sid, :pnum, :start_time, :end_time, :start_date)
                ");

                for ($i = 1; $i <= $defaultTotalPeriods; $i++) {
                    $pStart = date('H:i:s', $currentTime);
                    $currentTime += $defaultPeriodDuration * 60;
                    $pEnd = date('H:i:s', $currentTime);

                    $stmtInsPeriod->execute([
                        ':sid' => $schoolId,
                        ':pnum' => $i,
                        ':start_time' => $pStart,
                        ':end_time' => $pEnd,
                        ':start_date' => $today
                    ]);

                    // Apply interval break after specified period number
                    if ($i === $defaultIntervalAfter && $defaultIntervalDuration > 0) {
                        $currentTime += $defaultIntervalDuration * 60;
                    }
                }

                $pdo->commit();
            } catch (\Exception $e) {
                $pdo->rollBack();
                throw $e;
            }

            // Re-fetch the setting we just saved
            $stmt->execute([':sid' => $schoolId]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
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

        $stmtActiveAy = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (is_current = 1 OR UPPER(status) = 'ACTIVE') ORDER BY is_current DESC, id DESC LIMIT 1");
        $stmtActiveAy->execute([':sid' => $schoolId]);
        $activeAyId = (int)($stmtActiveAy->fetchColumn() ?: 0);

        $paymentAcademicYearId = $activeAyId > 0 ? $activeAyId : (int)$academicYearId;

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

        // Requirement 3: Ensure class fee structure is configured before allowing fee deposit
        if ($classFeeConfig === null && $feeStructureId === null) {
            throw new ValidationException([
                'fee_structure' => 'Fee structure is not configured for this class. Please configure class fees first before collecting fees.',
                'class_id' => 'Fee structure is not configured for this class. Please configure class fees first before collecting fees.'
            ], 'Fee structure is not configured for this class. Please configure class fees first before collecting fees.');
        }

        // If amount_paid is explicitly sent, we can use it
        if (!empty($data['amount_paid'])) {
            $amountPaid = (float)$data['amount_paid'];
        }

        // 3. Resolve the list of months being paid and their custom amounts if provided
        $monthsToPay = [];
        if (!empty($data['months'])) {
            $monthsToPay = is_array($data['months']) ? $data['months'] : array_filter(array_map('trim', explode(',', (string)$data['months'])));
        } elseif (!empty($data['fee_month'])) {
            $monthsToPay = [trim((string)$data['fee_month'])];
        }

        if (empty($monthsToPay)) {
            throw new ValidationException(['months' => 'Fee month is required']);
        }

        $monthAmountsInput = [];
        if (!empty($data['month_amounts']) && is_array($data['month_amounts'])) {
            $monthAmountsInput = $data['month_amounts'];
        } elseif (!empty($data['amounts']) && is_array($data['amounts'])) {
            // Map index-based amounts to sorted monthsToPay if provided as array
            foreach ($data['amounts'] as $idx => $amt) {
                if (isset($monthsToPay[$idx])) {
                    $monthAmountsInput[$monthsToPay[$idx]] = $amt;
                }
            }
        }

        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        // Sort months to pay by academic calendar order
        usort($monthsToPay, function($a, $b) use ($academicMonths) {
            $idxA = array_search($a, $academicMonths, true);
            $idxB = array_search($b, $academicMonths, true);
            return ($idxA === false ? 99 : $idxA) - ($idxB === false ? 99 : $idxB);
        });

        // 4. Pre-fetch existing paid amounts per month for this student and academic year
        $stmtExistingPaid = $pdo->prepare("
            SELECT fee_month, COALESCE(SUM(amount_paid + COALESCE(discount_amount, 0)), 0) AS total_paid 
            FROM fee_payments 
            WHERE student_id = :student_id 
              AND (academic_year_id = :ayid OR academic_year_id IS NULL)
            GROUP BY fee_month
        ");
        $stmtExistingPaid->execute([':student_id' => $studentId, ':ayid' => $paymentAcademicYearId]);
        $existingPaidRows = $stmtExistingPaid->fetchAll(PDO::FETCH_ASSOC);

        $existingPaidByMonth = [];
        foreach ($existingPaidRows as $rRow) {
            $existingPaidByMonth[$rRow['fee_month']] = (float)$rRow['total_paid'];
        }

        // Helper to get total configured fee for a month
        $getConfiguredFeeForMonth = function($mName) use ($classFeeConfig, $amountPaid) {
            if ($classFeeConfig !== null && isset($classFeeConfig[$mName])) {
                return (float)$classFeeConfig[$mName];
            }
            return (float)$amountPaid;
        };

        // 5. Validation and deposit calculation for each month
        $calculatedDeposits = [];
        $batchPaidTracker = $existingPaidByMonth;

        // Determine discount amount if provided (sequential whole integer allocation - no division decimals)
        $totalDiscountInput = (int)round(max(0.0, (float)($data['discount_amount'] ?? 0)));
        $remainingDiscountToApply = $totalDiscountInput;

        foreach ($monthsToPay as $m) {
            $idx = array_search($m, $academicMonths, true);
            if ($idx === false) {
                throw new ValidationException(['months' => "Invalid month: $m"]);
            }

            $totalConfiguredFee = (int)round($getConfiguredFeeForMonth($m));
            $alreadyPaidForMonth = (int)round($existingPaidByMonth[$m] ?? 0.0);
            $remainingForMonth = max(0, $totalConfiguredFee - $alreadyPaidForMonth);

            if ($remainingForMonth <= 0) {
                throw new ValidationException(['months' => "Fee for $m has already been paid."]);
            }

            // Sequence check: All prior months in academic calendar must be fully paid (including batch deposits)
            for ($j = 0; $j < $idx; $j++) {
                $prevMonth = $academicMonths[$j];
                $prevConfigured = (int)round($getConfiguredFeeForMonth($prevMonth));
                $prevPaidSoFar = (int)round($batchPaidTracker[$prevMonth] ?? 0.0);

                if ($prevPaidSoFar < $prevConfigured) {
                    throw new ValidationException(['months' => 'Cannot collect fees for a future month until all previous pending months have been paid.']);
                }
            }

            // Determine discount and deposit amount for this month (sequential integer allocation)
            if (count($monthsToPay) === 1) {
                $monthDiscount = min($remainingDiscountToApply, $remainingForMonth);
                $depositAmount = $remainingForMonth;
                if (isset($monthAmountsInput[$m]) && is_numeric($monthAmountsInput[$m])) {
                    $depositAmount = (int)round((float)$monthAmountsInput[$m]);
                }
            } else {
                if ($remainingDiscountToApply > 0) {
                    $monthDiscount = min($remainingDiscountToApply, $remainingForMonth);
                    $remainingDiscountToApply -= $monthDiscount;
                } else {
                    $monthDiscount = 0;
                }
                $depositAmount = max(0, $remainingForMonth - $monthDiscount);
            }

            if (count($monthsToPay) > 1 && abs(($depositAmount + $monthDiscount) - $remainingForMonth) > 0.01) {
                throw new ValidationException(['months' => 'Partial fee payment is only allowed when depositing fee for a single month. For multiple months, full fee must be deposited.']);
            }

            if ($depositAmount < 0) {
                throw new ValidationException(['months' => "Amount to deposit for $m cannot be negative."]);
            }

            $totalSettled = $depositAmount + $monthDiscount;
            if ($totalSettled > $remainingForMonth + 0.01) {
                $formattedRem = number_format($remainingForMonth, 0);
                throw new ValidationException(['months' => "Amount + Discount cannot exceed the remaining fee of ₹{$formattedRem}."]);
            }

            $calculatedDeposits[$m] = [
                'deposit_amount' => $depositAmount,
                'discount_amount' => $monthDiscount,
                'total_configured' => $totalConfiguredFee,
                'already_paid' => $alreadyPaidForMonth,
                'remaining_before' => $remainingForMonth,
                'remaining_after' => max(0.0, round($remainingForMonth - $totalSettled, 2)),
                'status' => (($alreadyPaidForMonth + $totalSettled) >= ($totalConfiguredFee - 0.01)) ? 'PAID' : 'Partial'
            ];

            // Update tracker for subsequent month sequence checks in this batch
            $batchPaidTracker[$m] = ($batchPaidTracker[$m] ?? 0.0) + $totalSettled;
        }

        // 6. Insert payments
        $paymentMethod = !empty($data['payment_method']) ? trim($data['payment_method']) : (!empty($data['payment_mode']) ? trim($data['payment_mode']) : 'Cash');
        $userId = (int) ($user['id'] ?? 0);
        $collectedBy = 'School Admin';
        if ($userId > 0) {
            $stmtUser = $pdo->prepare("SELECT name FROM users WHERE id = :id LIMIT 1");
            $stmtUser->execute([':id' => $userId]);
            $uName = $stmtUser->fetchColumn();
            if ($uName !== false) {
                $collectedBy = $uName;
            }
        }

        $lastPayment = null;
        $receiptNo = $this->generateUniqueRefNo($pdo);
        foreach ($monthsToPay as $m) {
            $depInfo = $calculatedDeposits[$m];
            $monthAmount = $depInfo['deposit_amount'];
            $monthDiscount = $depInfo['discount_amount'];
            $status = $depInfo['status'];

            $id = $this->feeRepo->createPayment([
                'school_id'        => $schoolId,
                'student_id'       => $studentId,
                'fee_structure_id' => $feeStructureId,
                'amount_paid'      => $monthAmount,
                'discount_amount'   => $monthDiscount,
                'payment_date'     => date('Y-m-d'),
                'receipt_no'       => $receiptNo,
                'status'           => $status,
                'fee_month'        => $m,
                'academic_year_id' => $paymentAcademicYearId,
                'payment_method'   => $paymentMethod,
                'collected_by'     => $collectedBy
            ]);
            $lastPayment = $this->feeRepo->findPaymentById($id);
        }

        foreach ($monthsToPay as $m) {
            $depInfo = $calculatedDeposits[$m];
            $amtStr = "₹" . number_format($depInfo['deposit_amount'], 0);
            if ($depInfo['status'] === 'PAID') {
                $this->sendStudentNotification($pdo, $schoolId, $studentId, "Monthly Fee Deposited", "Your {$m} fee payment of {$amtStr} has been successfully recorded.");
            } else {
                $remStr = "₹" . number_format($depInfo['remaining_after'], 0);
                $this->sendStudentNotification($pdo, $schoolId, $studentId, "Partial Fee Deposited", "Your partial fee payment of {$amtStr} for {$m} has been recorded. Remaining: {$remStr}.");
            }
        }

        $this->syncFollowUpStatus($pdo, $studentId, $schoolId);

        if ($lastPayment === null) {
            throw new NotFoundException('Payment not found after recording');
        }

        return $lastPayment;
    }

    private function ensureDiscountAndPartialSchema(PDO $pdo): void
    {
        // Schema and historical data self-healing is performed in database migrations (020 & 021)
        return;
    }

    public function getCollectionHistory(array $user, array $params = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();
        $this->ensureDiscountAndPartialSchema($pdo);

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // 1. Fetch current academic year dates
        $ay = $workingYear;

        $isCurrentAy = !empty($workingYear['is_current']) || (isset($workingYear['status']) && strtoupper($workingYear['status']) === 'ACTIVE');
        $startDate = $workingYear['start_date'] ?? '1970-01-01';

        // Fetch School Admin User details for fallback phone matching
        $stmtAdminUser = $pdo->prepare("SELECT name, phone FROM users WHERE school_id = :sid AND (UPPER(role) IN ('SCHOOL_ADMIN', 'ADMIN') OR LOWER(role) LIKE '%admin%') LIMIT 1");
        $stmtAdminUser->execute([':sid' => $schoolId]);
        $adminUserData = $stmtAdminUser->fetch(\PDO::FETCH_ASSOC) ?: [];
        $adminUserPhone = $adminUserData['phone'] ?? '';
        $adminUserName = $adminUserData['name'] ?? '';

        // 2. Fetch monthly fee payments
        $stmtMonthly = $pdo->prepare("
            SELECT 
                fp.id,
                'monthly' AS type,
                fp.receipt_no,
                CASE 
                  WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                    TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                  ELSE 
                    TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                END AS student_name,
                s.roll_no AS student_roll_no,
                s.academic_year_id AS student_ay_id,
                say.name AS student_ay_name,
                COALESCE(c.name, 'N/A') AS class_name,
                CONCAT('Monthly Fee (', fp.fee_month, ')') AS fee_name,
                fp.collected_by,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(u.role, '') AS collector_role,
                fp.payment_method,
                fp.amount_paid AS amount,
                fp.amount_paid AS amount_paid,
                COALESCE(fp.discount_amount, 0) AS discount_amount,
                fp.fee_month AS fee_month,
                fp.payment_date,
                fp.created_at,
                'Completed' AS status,
                pay_ay.name AS academic_year_name,
                pay_ay.status AS academic_year_status
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years say ON s.academic_year_id = say.id
            LEFT JOIN academic_years pay_ay ON fp.academic_year_id = pay_ay.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = fp.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = fp.school_id)
            WHERE fp.school_id = :school_id AND fp.status IN ('PAID', 'Partial')
              AND (
                s.academic_year_id = :ayid_stu 
                OR fp.academic_year_id = :ayid_fee
                OR (
                  :is_curr1 = 1 
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                  AND fp.created_at >= (SELECT created_at FROM academic_years WHERE school_id = :sid_sub AND (is_current = 1 OR UPPER(status) = 'ACTIVE') LIMIT 1)
                )
              )
        ");
        $stmtMonthly->execute([
            ':school_id' => $schoolId,
            ':ayid_stu' => $workingYearId,
            ':ayid_fee' => $workingYearId,
            ':is_curr1' => $isCurrentAy ? 1 : 0,
            ':sid_sub' => $schoolId
        ]);
        $monthly = $stmtMonthly->fetchAll(PDO::FETCH_ASSOC);

        // 3. Fetch additional fee payments (from transaction history)
        $stmtAdditional = $pdo->prepare("
            SELECT 
                afph.id AS id,
                afph.id AS history_id,
                afp.id AS payment_id,
                'additional' AS type,
                COALESCE(afph.receipt_no, afp.receipt_no) AS receipt_no,
                CASE 
                  WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                    TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                  ELSE 
                    TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                END AS student_name,
                s.roll_no AS student_roll_no,
                s.academic_year_id AS student_ay_id,
                say.name AS student_ay_name,
                COALESCE(c.name, 'N/A') AS class_name,
                aft.name AS fee_name,
                COALESCE(afph.collected_by, afp.collected_by) AS collected_by,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(u.role, '') AS collector_role,
                COALESCE(afph.payment_method, afp.payment_method) AS payment_method,
                afph.amount_paid AS amount,
                afph.amount_paid AS amount_paid,
                afph.discount_amount AS discount_amount,
                aft.name AS fee_month,
                COALESCE(afph.payment_date, afp.payment_date) AS payment_date,
                COALESCE(afph.created_at, afp.created_at) AS created_at,
                COALESCE(afph.created_at, afp.updated_at) AS updated_at,
                'Completed' AS status,
                pay_ay.name AS academic_year_name,
                pay_ay.status AS academic_year_status
            FROM additional_fee_payment_history afph
            JOIN additional_fee_payments afp ON afph.payment_id = afp.id
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON c.id = s.class_id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            LEFT JOIN academic_years say ON s.academic_year_id = say.id
            LEFT JOIN academic_years pay_ay ON aft.academic_year_id = pay_ay.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = afph.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = afp.school_id)
            WHERE afp.school_id = :school_id
              AND (
                s.academic_year_id = :ayid_stu 
                OR aft.academic_year_id = :ayid_fee 
                OR aft.academic_year_id IS NULL
                OR (
                  :is_curr1 = 1 
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                  AND afph.created_at >= (SELECT created_at FROM academic_years WHERE school_id = :sid_sub AND (is_current = 1 OR UPPER(status) = 'ACTIVE') LIMIT 1)
                )
              )
        ");
        $stmtAdditional->execute([
            ':school_id' => $schoolId,
            ':ayid_stu' => $workingYearId,
            ':ayid_fee' => $workingYearId,
            ':is_curr1' => $isCurrentAy ? 1 : 0,
            ':sid_sub' => $schoolId
        ]);
        $additional = $stmtAdditional->fetchAll(PDO::FETCH_ASSOC);

        // Merge
        $merged = array_merge($monthly, $additional);

        // Standardize types and fallback fields
        $merged = array_map(function($t) use ($workingYearId, $adminUserName, $adminUserPhone) {
            $t['amount'] = (float)$t['amount'];
            if (empty($t['payment_method'])) {
                $t['payment_method'] = 'Cash';
            }
            if (empty($t['collected_by'])) {
                $t['collected_by'] = 'School Admin';
            }

            // Determine if collector is a School Admin vs Teacher
            $cName = trim($t['collected_by']);
            $cRole = strtoupper($t['collector_role'] ?? '');

            $isAdminCollector = (
                $cRole === 'SCHOOL_ADMIN' ||
                $cRole === 'ADMIN' ||
                strcasecmp($cName, 'School Admin') === 0 ||
                strcasecmp($cName, 'ADMIN') === 0 ||
                ($adminUserName && strcasecmp($cName, $adminUserName) === 0) ||
                str_contains(strtolower($cName), 'admin') ||
                str_contains(strtolower($cName), 'accounts office')
            );

            if ($isAdminCollector) {
                $t['is_admin_collector'] = true;
                $t['display_collector_name'] = 'ADMIN';
                if (empty($t['collector_phone']) && $adminUserPhone) {
                    $t['collector_phone'] = $adminUserPhone;
                }
            } else {
                $t['is_admin_collector'] = false;
                $t['display_collector_name'] = $cName;
            }

            if (!empty($t['student_ay_id']) && (int)$t['student_ay_id'] !== $workingYearId && !empty($t['student_ay_name'])) {
                if ($t['type'] === 'additional') {
                    $t['fee_name'] = $t['fee_name'] . " (Dues for " . $t['student_ay_name'] . ")";
                } else {
                    $t['fee_name'] = $t['fee_name'] . " [Dues for " . $t['student_ay_name'] . "]";
                }
            }
            if (empty($t['receipt_no'])) {
                if ($t['type'] === 'additional') {
                    $t['receipt_no'] = 'AFP-' . str_pad((string)$t['id'], 5, '0', STR_PAD_LEFT);
                } else {
                    $t['receipt_no'] = 'REC-' . str_pad((string)$t['id'], 5, '0', STR_PAD_LEFT);
                }
            }

            // Clean up receipt_no to be exactly 12 numeric digits
            $cleanRef = preg_replace('/\D/', '', $t['receipt_no']);
            if ($cleanRef === '') {
                $cleanRef = (string)$t['id'];
            }
            
            if (strlen($cleanRef) < 12) {
                $paddingNeeded = 12 - strlen($cleanRef);
                $padPattern = '123456789012';
                $prefix = substr($padPattern, 0, $paddingNeeded);
                $cleanRef = $prefix . $cleanRef;
            } else {
                $cleanRef = substr($cleanRef, 0, 12);
            }

            // Correct any 3 consecutive repeating digits dynamically
            $chars = str_split($cleanRef);
            for ($i = 2; $i < count($chars); $i++) {
                if ($chars[$i] === $chars[$i-1] && $chars[$i] === $chars[$i-2]) {
                    $prevVal = (int)$chars[$i-1];
                    $newVal = ($prevVal + 1) % 10;
                    $chars[$i] = (string)$newVal;
                }
            }
            $t['receipt_no'] = implode('', $chars);

            return $t;
        }, $merged);

        // Group by receipt_no (combining multi-month tuition payments into one transaction row)
        $groups = [];
        foreach ($merged as $t) {
            $rNo = $t['receipt_no'];
            if (!isset($groups[$rNo])) {
                $groups[$rNo] = $t;
                $groups[$rNo]['months_list'] = [];
                if ($t['type'] === 'monthly' && !empty($t['fee_month'])) {
                    $groups[$rNo]['months_list'][] = $t['fee_month'];
                }
            } else {
                // Add to amount and amount_paid
                $groups[$rNo]['amount'] += (float)$t['amount'];
                $groups[$rNo]['amount_paid'] += (float)$t['amount_paid'];
                $groups[$rNo]['discount_amount'] = (float)($groups[$rNo]['discount_amount'] ?? 0.0) + (float)($t['discount_amount'] ?? 0.0);
                if ($t['type'] === 'monthly' && !empty($t['fee_month'])) {
                    $groups[$rNo]['months_list'][] = $t['fee_month'];
                }
            }
        }

        // Now re-process grouped transactions to build fee_name and clean up months_list
        $mergedGrouped = [];
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        
        foreach ($groups as $rNo => $t) {
            if ($t['type'] === 'monthly' && !empty($t['months_list'])) {
                // Sort months according to academic cycle
                usort($t['months_list'], function($a, $b) use ($academicMonths) {
                    $idxA = array_search($a, $academicMonths, true);
                    $idxB = array_search($b, $academicMonths, true);
                    return ($idxA === false ? 99 : $idxA) - ($idxB === false ? 99 : $idxB);
                });
                
                // Remove duplicates in months_list
                $t['months_list'] = array_values(array_unique($t['months_list']));
                
                // Generate formatted fee name
                if (count($t['months_list']) > 1) {
                    $firstMonth = $t['months_list'][0];
                    $lastMonth = $t['months_list'][count($t['months_list']) - 1];
                    $t['fee_name'] = "Monthly Fee ($firstMonth to $lastMonth)";
                    $t['fee_month'] = implode(', ', $t['months_list']);
                } else {
                    $t['fee_name'] = "Monthly Fee (" . $t['months_list'][0] . ")";
                    $t['fee_month'] = $t['months_list'][0];
                }
            }

            // Append Dues for Academic Year name if student enrolled year differs from working year
            if (!empty($t['student_ay_id']) && (int)$t['student_ay_id'] !== $workingYearId && !empty($t['student_ay_name'])) {
                if ($t['type'] === 'additional') {
                    $t['fee_name'] = $t['fee_name'] . " (Dues for " . $t['student_ay_name'] . ")";
                } else {
                    $t['fee_name'] = $t['fee_name'] . " [Dues for " . $t['student_ay_name'] . "]";
                }
            }
            // Re-apply the Draft suffix if applicable
            if (isset($t['academic_year_status']) && strcasecmp($t['academic_year_status'], 'Draft') === 0) {
                $t['fee_name'] = $t['fee_name'] . ' [Draft Year: ' . ($t['academic_year_name'] ?? '') . ']';
            }
            unset($t['months_list']);
            $mergedGrouped[] = $t;
        }

        // Sort chronologically ascending to calculate running balances
        usort($mergedGrouped, function($a, $b) {
            $dateCompare = strcmp($a['payment_date'], $b['payment_date']);
            if ($dateCompare !== 0) {
                return $dateCompare;
            }
            $txTimeA = !empty($a['updated_at']) ? $a['updated_at'] : $a['created_at'];
            $txTimeB = !empty($b['updated_at']) ? $b['updated_at'] : $b['created_at'];
            $timeCompare = strcmp($txTimeA, $txTimeB);
            if ($timeCompare !== 0) {
                return $timeCompare;
            }
            return $a['id'] - $b['id'];
        });

        // Compute running balance
        $runningBalance = 0.0;
        $withBalance = [];
        foreach ($mergedGrouped as $t) {
            $prev = $runningBalance;
            $updated = $runningBalance + $t['amount'];
            $runningBalance = $updated;

            $t['previous_total'] = $prev;
            $t['updated_total'] = $updated;
            $withBalance[] = $t;
        }

        // Collect available distinct collectors from all transactions in this school
        $collectorsMap = [];
        foreach ($withBalance as $t) {
            $isAdmin = !empty($t['is_admin_collector']);
            $displayName = $isAdmin ? 'ADMIN' : $t['display_collector_name'];
            $filterKey = $isAdmin ? 'ADMIN' : strtolower($t['collected_by']);
            $cPhone = !empty($t['collector_phone']) ? trim($t['collector_phone']) : '';

            if (!isset($collectorsMap[$filterKey])) {
                $collectorsMap[$filterKey] = [
                    'name' => $isAdmin ? 'ADMIN' : $t['collected_by'],
                    'display_name' => $displayName,
                    'phone' => $cPhone,
                    'label' => $cPhone !== '' ? $cPhone : $displayName
                ];
            } elseif (empty($collectorsMap[$filterKey]['phone']) && $cPhone) {
                $collectorsMap[$filterKey]['phone'] = $cPhone;
                $collectorsMap[$filterKey]['label'] = $cPhone;
            }
        }
        $availableCollectors = array_values($collectorsMap);
        array_unshift($availableCollectors, ['name' => 'All Users', 'display_name' => 'All Users', 'phone' => '', 'label' => 'All Users']);

        // Generate list of available months in academic year + any months with transactions
        $months = [];
        if ($ay) {
            $start = new \DateTime($ay['start_date']);
            $end = new \DateTime($ay['end_date']);
            $interval = new \DateInterval('P1M');
            $period = new \DatePeriod($start, $interval, $end->modify('+1 day'));
            foreach ($period as $dt) {
                $months[] = $dt->format('F Y');
            }
        }
        foreach ($withBalance as $t) {
            $timestamp = strtotime($t['payment_date']);
            if ($timestamp !== false) {
                $mName = date('F Y', $timestamp);
                if (!in_array($mName, $months, true)) {
                    $months[] = $mName;
                }
            }
        }
        $months = array_values(array_unique($months));
        array_unshift($months, 'All Months');

        // Default month & collector filters if not provided
        $selectedMonth = !empty($params['month']) ? trim($params['month']) : 'All Months';
        $selectedCollector = !empty($params['deposit_by']) ? trim($params['deposit_by']) : (!empty($params['collected_by']) ? trim($params['collected_by']) : 'All Users');
        $search = !empty($params['search']) ? trim($params['search']) : '';
        
        // Strict AND Filtering: Only transactions matching ALL selected filter criteria are included
        $filtered = array_filter($withBalance, function($t) use ($selectedMonth, $selectedCollector, $search) {
            // 1. Filter Month check (AND condition)
            if ($selectedMonth && strcasecmp($selectedMonth, 'All Months') !== 0) {
                $timestamp = strtotime($t['payment_date']);
                if ($timestamp === false) return false;
                
                $tMonthNameYear = date('F Y', $timestamp); // 'April 2027'
                $tMonthNumYear = date('Y-m', $timestamp);  // '2027-04'
                
                if (strcasecmp($tMonthNameYear, $selectedMonth) !== 0 && strcasecmp($tMonthNumYear, $selectedMonth) !== 0) {
                    return false;
                }
            }

            // 2. Deposit By Collector check (AND condition)
            if ($selectedCollector && strcasecmp($selectedCollector, 'All Users') !== 0) {
                if (strcasecmp($selectedCollector, 'ADMIN') === 0 || strcasecmp($selectedCollector, 'School Admin') === 0) {
                    if (empty($t['is_admin_collector'])) {
                        return false;
                    }
                } else {
                    $cName = !empty($t['collected_by']) ? trim($t['collected_by']) : 'School Admin';
                    if (strcasecmp($cName, $selectedCollector) !== 0) {
                        return false;
                    }
                }
            }

            // 3. Search Query check (AND condition)
            if ($search !== '') {
                $matchSearch = (
                    stripos($t['student_name'], $search) !== false ||
                    stripos((string)$t['student_roll_no'], $search) !== false ||
                    stripos($t['receipt_no'], $search) !== false ||
                    stripos($t['class_name'], $search) !== false ||
                    stripos($t['collected_by'], $search) !== false
                );
                if (!$matchSearch) {
                    return false;
                }
            }

            return true;
        });

        // Calculate dynamic summary stats strictly on the AND-filtered set
        $totalCollected = 0.0;
        $todayCollection = 0.0;
        $thisMonthCollection = 0.0;

        $todayStr = date('Y-m-d');
        foreach ($filtered as $t) {
            $totalCollected += $t['amount'];
            if ($t['payment_date'] === $todayStr) {
                $todayCollection += $t['amount'];
            }
            $thisMonthCollection += $t['amount'];
        }

        // Sort chronologically descending (newest first, latest time first)
        usort($filtered, function($a, $b) {
            $dateCompare = strcmp($b['payment_date'], $a['payment_date']);
            if ($dateCompare !== 0) {
                return $dateCompare;
            }
            $txTimeA = !empty($a['updated_at']) ? $a['updated_at'] : $a['created_at'];
            $txTimeB = !empty($b['updated_at']) ? $b['updated_at'] : $b['created_at'];
            $timeCompare = strcmp($txTimeB, $txTimeA);
            if ($timeCompare !== 0) {
                return $timeCompare;
            }
            return $b['id'] - $a['id'];
        });

        // Pagination
        $page = !empty($params['page']) ? (int)$params['page'] : 1;
        $limit = !empty($params['limit']) ? (int)$params['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $totalFiltered = count($filtered);
        $paginated = array_slice(array_values($filtered), $offset, $limit);

        return [
            'transactions' => $paginated,
            'stats' => [
                'total_collected' => $totalCollected,
                'today_collection' => $todayCollection,
                'this_month_collection' => $thisMonthCollection,
                'total_transactions' => $totalFiltered
            ],
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => (int)ceil($totalFiltered / $limit)
            ],
            'available_months' => $months,
            'selected_month' => $selectedMonth,
            'available_collectors' => $availableCollectors,
            'selected_collector' => $selectedCollector
        ];
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

        $school['report_card_remark'] = $school['report_card_remark'] ?? '';

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

        if (!empty($school['report_card_template_id'])) {
            $stmtTpl = $pdo->prepare("SELECT id, name, code, description, layout_config FROM report_card_templates WHERE id = :tid LIMIT 1");
            $stmtTpl->execute([':tid' => (int)$school['report_card_template_id']]);
            $tpl = $stmtTpl->fetch(\PDO::FETCH_ASSOC);
            if ($tpl) {
                $tpl['layout_config'] = json_decode($tpl['layout_config'] ?? '{}', true) ?? [];
                $school['report_card_template'] = $tpl;
            }
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

        $logoPath = $this->handleFileUpload($uploadedFile, StorageService::CATEGORY_LOGOS);

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

    public function uploadPrincipalSignature(array $user, $uploadedFile): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $sigPath = $this->handleFileUpload($uploadedFile, StorageService::CATEGORY_SIGNATURES);
        $this->processTransparentSignature($sigPath);

        $stmt = $pdo->prepare("UPDATE schools SET principal_signature_path = :path WHERE id = :id");
        $stmt->execute([
            ':path' => $sigPath,
            ':id'   => $schoolId
        ]);

        return $this->getSchoolProfile($user);
    }

    public function removePrincipalSignature(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("UPDATE schools SET principal_signature_path = NULL WHERE id = :id");
        $stmt->execute([
            ':id' => $schoolId
        ]);

        return $this->getSchoolProfile($user);
    }

    private function processTransparentSignature(string $storedPath): void
    {
        if (!function_exists('imagecreatefromstring')) {
            return;
        }

        // Works for both drivers: reads back from S3 or from local disk.
        $content = $this->storage->readContents($storedPath);
        if (!$content) return;

        $img = @imagecreatefromstring($content);
        if (!$img) return;

        $w = imagesx($img);
        $h = imagesy($img);

        $totalLum = 0;
        $maxLum = 0;
        $pixelLum = [];

        for ($x = 0; $x < $w; $x++) {
            for ($y = 0; $y < $h; $y++) {
                $rgba = imagecolorat($img, $x, $y);
                $r = ($rgba >> 16) & 0xFF;
                $g = ($rgba >> 8) & 0xFF;
                $b = $rgba & 0xFF;
                $lum = $r * 0.299 + $g * 0.587 + $b * 0.114;
                $pixelLum[$x][$y] = ['r' => $r, 'g' => $g, 'b' => $b, 'lum' => $lum];
                $totalLum += $lum;
                if ($lum > $maxLum) $maxLum = $lum;
            }
        }

        $avgLum = $totalLum / max(1, $w * $h);
        $paperThreshold = min(240, max($avgLum * 0.88, $maxLum * 0.72));

        $minX = $w; $minY = $h; $maxX = 0; $maxY = 0;
        $hasInk = false;

        $transparent = imagecreatetruecolor($w, $h);
        imagealphablending($transparent, false);
        imagesavealpha($transparent, true);

        for ($x = 0; $x < $w; $x++) {
            for ($y = 0; $y < $h; $y++) {
                $p = $pixelLum[$x][$y];
                $r = $p['r']; $g = $p['g']; $b = $p['b']; $lum = $p['lum'];

                $isPaper = $lum >= $paperThreshold || ($r > 120 && $g > 120 && $b > 120 && abs($r - $g) < 25 && abs($g - $b) < 25 && $lum > 140);

                if ($isPaper) {
                    $color = imagecolorallocatealpha($transparent, 255, 255, 255, 127);
                } else {
                    $hasInk = true;
                    if ($x < $minX) $minX = $x;
                    if ($x > $maxX) $maxX = $x;
                    if ($y < $minY) $minY = $y;
                    if ($y > $maxY) $maxY = $y;

                    $color = imagecolorallocatealpha($transparent, $r, $g, $b, 0);
                }
                imagesetpixel($transparent, $x, $y, $color);
            }
        }

        if ($hasInk && $maxX > $minX && $maxY > $minY) {
            $cropW = $maxX - $minX + 1;
            $cropH = $maxY - $minY + 1;
            $cropped = imagecreatetruecolor($cropW, $cropH);
            imagealphablending($cropped, false);
            imagesavealpha($cropped, true);

            imagecopyresampled($cropped, $transparent, 0, 0, $minX, $minY, $cropW, $cropH, $cropW, $cropH);
            $png = $this->capturePng($cropped);
            imagedestroy($cropped);
        } else {
            $png = $this->capturePng($transparent);
        }

        imagedestroy($img);
        imagedestroy($transparent);

        if ($png !== '') {
            $this->storage->replaceContents($storedPath, $png, 'image/png');
        }
    }

    /** Render a GD image to PNG bytes without touching the filesystem. */
    private function capturePng($image): string
    {
        ob_start();
        imagepng($image);

        return (string)ob_get_clean();
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
        $alphabetAllowed = ['A', 'B', 'C', 'D'];
        $colorAllowed    = ['Red', 'Blue', 'Green', 'Yellow'];

        $newSections = [];
        if (!empty($data['sections'])) {
            if (is_array($data['sections'])) {
                $newSections = array_map('trim', $data['sections']);
            } else {
                $newSections = array_filter(array_map('trim', explode(',', (string)$data['sections'])));
            }
            $newSections = array_values(array_unique($newSections));
        }

        if (!empty($newSections)) {
            if (count($newSections) > 4) {
                throw new ValidationException(['sections' => 'Maximum 4 sections allowed.']);
            }

            $isAlphabet = true;
            $isColor    = true;
            foreach ($newSections as $sec) {
                $secUpper = strtoupper($sec);
                $secTitle = ucfirst(strtolower($sec));
                if (!in_array($secUpper, $alphabetAllowed, true)) {
                    $isAlphabet = false;
                }
                if (!in_array($secTitle, $colorAllowed, true)) {
                    $isColor = false;
                }
            }

            if (!$isAlphabet && !$isColor) {
                throw new ValidationException(['sections' => 'Section names must belong to either Alphabet (A, B, C, D) or Color (Red, Blue, Green, Yellow) sections.']);
            }

            if ($isAlphabet) {
                $newSections = array_map('strtoupper', $newSections);
            } else {
                $newSections = array_map(fn($s) => ucfirst(strtolower($s)), $newSections);
            }
        } else {
            $newSections = [null];
        }

        // Get currently active or draft academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : null;

        // Get all existing classes for oldName scoped strictly to current working academic year
        if ($academicYearId !== null) {
            $stmtOld = $pdo->prepare("SELECT * FROM classes WHERE school_id = :school_id AND name = :name AND academic_year_id = :ayid");
            $stmtOld->execute([':school_id' => $schoolId, ':name' => $oldName, ':ayid' => $academicYearId]);
        } else {
            $stmtOld = $pdo->prepare("SELECT * FROM classes WHERE school_id = :school_id AND name = :name AND academic_year_id IS NULL");
            $stmtOld->execute([':school_id' => $schoolId, ':name' => $oldName]);
        }
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
                $existsId = $this->findClassByNameAndSection($pdo, $schoolId, $academicYearId, $newName, $dbSecVal, $oc['stream'] ?? null);

                if ($existsId !== null) {
                    $processedIds[] = $existsId;
                    $lastClass = $this->classRepo->findById($existsId);
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
                
                // Find the target class ID for this deleted class row (alphabetically previous section)
                $targetClassId = null;
                if (!empty($newSections) && $newSections[0] !== null) {
                    $deletedSec = $oc['section'] !== null ? trim((string)$oc['section']) : '';
                    
                    // Collect and sort all old sections alphabetically
                    $oldSecList = [];
                    foreach ($oldClasses as $oldC) {
                        $oldSecList[] = $oldC['section'] !== null ? trim((string)$oldC['section']) : '';
                    }
                    $oldSecList = array_unique($oldSecList);
                    sort($oldSecList);
                    
                    $deletedIdx = array_search($deletedSec, $oldSecList);
                    $targetSec = null;
                    if ($deletedIdx !== false && $deletedIdx > 0) {
                        $targetSec = $oldSecList[$deletedIdx - 1];
                    } else {
                        // Fall back to first available section in $newSections
                        $targetSec = $newSections[0];
                    }
                    
                    // Find the class ID matching $targetSec in the updated classes list
                    if ($academicYearId !== null) {
                        $stmtFindTarget = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND name = :name AND academic_year_id = :ayid AND (section = :sec1 OR (section IS NULL AND :sec2 = '')) LIMIT 1");
                        $stmtFindTarget->execute([
                            ':sid' => $schoolId,
                            ':name' => $newName,
                            ':ayid' => $academicYearId,
                            ':sec1' => $targetSec === '' ? null : $targetSec,
                            ':sec2' => $targetSec === '' ? null : $targetSec
                        ]);
                    } else {
                        $stmtFindTarget = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND name = :name AND academic_year_id IS NULL AND (section = :sec1 OR (section IS NULL AND :sec2 = '')) LIMIT 1");
                        $stmtFindTarget->execute([
                            ':sid' => $schoolId,
                            ':name' => $newName,
                            ':sec1' => $targetSec === '' ? null : $targetSec,
                            ':sec2' => $targetSec === '' ? null : $targetSec
                        ]);
                    }
                    $targetClassId = (int)$stmtFindTarget->fetchColumn();
                }

                if (empty($targetClassId) && !empty($processedIds)) {
                    $targetClassId = (int)$processedIds[0];
                }

                if (!empty($targetClassId)) {
                    $tablesToMigrate = ['students', 'subjects', 'attendance', 'academic_achievement_snapshots', 'class_fee_configurations'];
                    foreach ($tablesToMigrate as $tbl) {
                        try {
                            $stmtMigrate = $pdo->prepare("UPDATE {$tbl} SET class_id = :target_id WHERE class_id = :old_id");
                            $stmtMigrate->execute([
                                ':target_id' => $targetClassId,
                                ':old_id' => $oldClassId
                            ]);
                        } catch (\Throwable $e) {}
                    }
                }

                $this->classRepo->delete($oldClassId);
                $this->log('Class section deleted on edit', ['id' => $oldClassId, 'school_id' => $schoolId]);
            }
        }

        // Auto-sync fee configurations for all new and updated sections of this class
        try {
            $stmtSyncAll = $pdo->prepare("
                INSERT INTO class_fee_configurations (school_id, class_id, academic_year_id, mode, monthly_fees, is_locked)
                SELECT c.school_id, c.id, cfg.academic_year_id, cfg.mode, cfg.monthly_fees, cfg.is_locked
                FROM classes c
                JOIN classes c_src ON c.school_id = c_src.school_id AND c.name = c_src.name
                JOIN class_fee_configurations cfg ON c_src.id = cfg.class_id
                WHERE c.school_id = :sid AND c.name = :cname AND c.id != c_src.id
                ON DUPLICATE KEY UPDATE mode = VALUES(mode), monthly_fees = VALUES(monthly_fees)
            ");
            $stmtSyncAll->execute([':sid' => $schoolId, ':cname' => $newName]);
        } catch (\Throwable $e) {}

        // Roll Number Reassignment for all affected class IDs in $processedIds
        if (!empty($processedIds)) {
            foreach ($processedIds as $cid) {
                $this->resequenceSectionRollNumbers($pdo, $schoolId, (int)$cid);
            }
        }

        if ($lastClass === null) {
            throw new NotFoundException('Class not found after update');
        }

        return $lastClass;
    }

    public function deleteClass(array $user, array $data): array
    {
        $className = trim((string)($data['name'] ?? $data['class_name'] ?? $data['className'] ?? ''));
        if (empty($className)) {
            throw new ValidationException(
                ['name' => 'Class name is required for deletion.'],
                'This action can not be done'
            );
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        // Find all class IDs for this class name in this school
        $stmtFind = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND LOWER(TRIM(name)) = LOWER(TRIM(:name))");
        $stmtFind->execute([':sid' => $schoolId, ':name' => $className]);
        $classIds = $stmtFind->fetchAll(PDO::FETCH_COLUMN);

        if (empty($classIds)) {
            throw new NotFoundException("Class '{$className}' not found.");
        }

        $inClause = implode(',', array_map('intval', $classIds));

        // Check if students are enrolled in this class across any section
        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) FROM students 
            WHERE school_id = :sid AND class_id IN ({$inClause})
        ");
        $stmtCount->execute([':sid' => $schoolId]);
        $studentCount = (int)$stmtCount->fetchColumn();

        if ($studentCount > 0) {
            throw new ValidationException(
                [
                    'students' => 'This action can not be done because students are currently enrolled in this class. Please transfer or remove all students before deleting this class.'
                ],
                'This action can not be done'
            );
        }

        // Safe deletion inside transaction to handle foreign key dependencies
        $pdo->beginTransaction();
        try {
            $stmtDelSubjects = $pdo->prepare("DELETE FROM subjects WHERE class_id IN ({$inClause})");
            $stmtDelSubjects->execute();

            $stmtDelAttendance = $pdo->prepare("DELETE FROM attendance WHERE class_id IN ({$inClause})");
            $stmtDelAttendance->execute();

            $stmtDelSnapshots = $pdo->prepare("DELETE FROM academic_achievement_snapshots WHERE class_id IN ({$inClause})");
            $stmtDelSnapshots->execute();

            $stmtDelete = $pdo->prepare("DELETE FROM classes WHERE school_id = :sid AND name = :name");
            $stmtDelete->execute([':sid' => $schoolId, ':name' => $className]);

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        $this->log('Class deleted', ['name' => $className, 'school_id' => $schoolId]);

        return ['success' => true, 'message' => "Class {$className} deleted successfully."];
    }

    public function transferStudents(array $user, array $data): array
    {
        if (empty($data['class_name'])) {
            throw new ValidationException(['class_name' => 'Class name is required.']);
        }
        if (empty($data['destination_section'])) {
            throw new ValidationException(['destination_section' => 'Destination section is required.']);
        }
        if (empty($data['student_ids']) || !is_array($data['student_ids'])) {
            throw new ValidationException(['student_ids' => 'At least one student must be selected.']);
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $className = trim((string)$data['class_name']);
        $destSection = preg_replace('/^Section\s+/i', '', trim((string)$data['destination_section']));
        $studentIds = array_map('intval', $data['student_ids']);

        // Get currently active academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : null;

        // Find destination class_id
        $stmtDest = $pdo->prepare("
            SELECT id FROM classes 
            WHERE school_id = :sid 
              AND (academic_year_id = :ayid1 OR :ayid2 IS NULL) 
              AND name COLLATE utf8mb4_unicode_ci = :name COLLATE utf8mb4_unicode_ci 
              AND (section COLLATE utf8mb4_unicode_ci = :sec1 OR (section IS NULL AND :sec2 = ''))
            LIMIT 1
        ");
        $stmtDest->execute([
            ':sid' => $schoolId,
            ':ayid1' => $academicYearId,
            ':ayid2' => $academicYearId,
            ':name' => $className,
            ':sec1' => $destSection === '' ? null : $destSection,
            ':sec2' => $destSection === '' ? null : $destSection
        ]);
        $destClassId = $stmtDest->fetchColumn();

        if ($destClassId === false) {
            throw new ValidationException(['destination_section' => 'Destination section class not found.']);
        }
        $destClassId = (int)$destClassId;

        // Find source class IDs before transfer so we can resequence them afterwards
        $inIds = implode(',', array_map('intval', $studentIds));
        $stmtSrc = $pdo->prepare("SELECT DISTINCT class_id FROM students WHERE id IN ({$inIds}) AND school_id = :sid");
        $stmtSrc->execute([':sid' => $schoolId]);
        $sourceClassIds = $stmtSrc->fetchAll(\PDO::FETCH_COLUMN);

        // Transfer each student
        $pdo->beginTransaction();
        try {
            // Update students class_id
            $stmtUpdateStudent = $pdo->prepare("
                UPDATE students 
                SET class_id = :dest_id
                WHERE id = :student_id AND school_id = :sid
            ");

            // Update attendance
            $stmtUpdateAttendance = $pdo->prepare("
                UPDATE attendance 
                SET class_id = :dest_id 
                WHERE student_id = :student_id AND school_id = :sid
            ");

            // Update snapshots if any
            $stmtUpdateSnapshot = $pdo->prepare("
                UPDATE academic_achievement_snapshots 
                SET class_id = :dest_id 
                WHERE student_id = :student_id AND school_id = :sid
            ");

            foreach ($studentIds as $stuId) {
                $stmtUpdateStudent->execute([
                    ':dest_id' => $destClassId,
                    ':student_id' => $stuId,
                    ':sid' => $schoolId
                ]);
                $stmtUpdateAttendance->execute([
                    ':dest_id' => $destClassId,
                    ':student_id' => $stuId,
                    ':sid' => $schoolId
                ]);
                $stmtUpdateSnapshot->execute([
                    ':dest_id' => $destClassId,
                    ':student_id' => $stuId,
                    ':sid' => $schoolId
                ]);
            }

            // Resequence destination section roll numbers (1..N)
            $this->resequenceSectionRollNumbers($pdo, $schoolId, $destClassId);

            // Resequence all affected source sections roll numbers (1..N)
            foreach ($sourceClassIds as $srcCid) {
                $this->resequenceSectionRollNumbers($pdo, $schoolId, (int)$srcCid);
            }

            $pdo->commit();
            $this->log("Transferred students to section {$destSection}", ['student_ids' => $studentIds, 'destination_class_id' => $destClassId]);
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    public function deleteSection(array $user, array $data): array
    {
        $classId = isset($data['class_id']) ? (int)$data['class_id'] : 0;
        if ($classId <= 0) {
            throw new ValidationException(['class_id' => 'Valid class ID is required for section deletion.']);
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $classRow = $this->classRepo->findById($classId);
        if (!$classRow || (int)$classRow['school_id'] !== $schoolId) {
            throw new NotFoundException('Class section not found.');
        }

        // Check student count for this specific class section
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :sid AND class_id = :cid");
        $stmtCount->execute([':sid' => $schoolId, ':cid' => $classId]);
        $studentCount = (int)$stmtCount->fetchColumn();

        if ($studentCount > 0) {
            throw new ValidationException(
                [
                    'students' => 'This action can not be done because students belong to this section. Please reassign or remove all students before deleting this section.'
                ],
                'This action can not be done'
            );
        }

        // Safe deletion of section
        $stmtDelete = $pdo->prepare("DELETE FROM classes WHERE id = :id AND school_id = :sid");
        $stmtDelete->execute([':id' => $classId, ':sid' => $schoolId]);

        $this->log('Class section deleted', ['id' => $classId, 'school_id' => $schoolId]);

        return ['success' => true, 'message' => 'Section deleted successfully.'];
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

        // 1. Report lock check
        if ($this->isTransactionInReport($pdo, $schoolId, $row['created_at']) || $this->isTransactionInReport($pdo, $schoolId, $row['payment_date'])) {
            throw new ValidationException(
                ['locked' => 'This action can not be done, This is already included in financial report'],
                'This action can not be done, This is already included in financial report'
            );
        }

        // 1.5. Target year writable check
        $stmtPayYear = $pdo->prepare("SELECT status FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtPayYear->execute([':id' => $academicYearId, ':sid' => $schoolId]);
        $payYearStatus = $stmtPayYear->fetchColumn();
        if ($payYearStatus === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
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

        // 5. Send Reverted Push Notification immediately
        $this->sendStudentNotification(
            $pdo, 
            $schoolId, 
            $studentId, 
            "Fee Payment Reverted", 
            "A previously recorded fee payment has been reverted by your school. Please review your updated fee status."
        );

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

        // Run class-name auto-sync query so all sections of a class automatically share the fee configuration
        try {
            $stmtSync = $pdo->prepare("
                INSERT INTO class_fee_configurations (school_id, class_id, academic_year_id, mode, monthly_fees, is_locked)
                SELECT c.school_id, c.id, cfg.academic_year_id, cfg.mode, cfg.monthly_fees, cfg.is_locked
                FROM classes c
                JOIN classes c_src ON c.school_id = c_src.school_id AND c.name COLLATE utf8mb4_unicode_ci = c_src.name COLLATE utf8mb4_unicode_ci
                JOIN class_fee_configurations cfg ON c_src.id = cfg.class_id
                WHERE c.school_id = :sid AND c.id != c_src.id
                ON DUPLICATE KEY UPDATE mode = VALUES(mode), monthly_fees = VALUES(monthly_fees)
            ");
            $stmtSync->execute([':sid' => $schoolId]);
        } catch (\Throwable $e) {}

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
            $row['monthly_fees'] = is_string($row['monthly_fees']) ? json_decode($row['monthly_fees'], true) : $row['monthly_fees'];
            $row['is_locked'] = (int)$row['is_locked'];
        }

        return $rows;
    }

    public function getClassCourseFeeConfigurations(array $user, ?int $classId, ?int $academicYearId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();

        // Run class-name auto-sync query so all sections of a class automatically share the course fee configuration
        try {
            $stmtSync = $pdo->prepare("
                INSERT INTO class_course_fee_configurations (school_id, class_id, academic_year_id, amount)
                SELECT c.school_id, c.id, cfg.academic_year_id, cfg.amount
                FROM classes c
                JOIN classes c_src ON c.school_id = c_src.school_id AND c.name COLLATE utf8mb4_unicode_ci = c_src.name COLLATE utf8mb4_unicode_ci
                JOIN class_course_fee_configurations cfg ON c_src.id = cfg.class_id
                WHERE c.school_id = :sid AND c.id != c_src.id
                ON DUPLICATE KEY UPDATE amount = VALUES(amount)
            ");
            $stmtSync->execute([':sid' => $schoolId]);
        } catch (\Throwable $e) {}

        $query = "SELECT * FROM class_course_fee_configurations WHERE school_id = :school_id";
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
            $row['id'] = (int)$row['id'];
            $row['class_id'] = (int)$row['class_id'];
            $row['academic_year_id'] = (int)$row['academic_year_id'];
            $row['amount'] = (float)$row['amount'];
        }

        return $rows;
    }

    public function saveClassCourseFeeConfiguration(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $reqClassInput = $data['class_id'] ?? null;
        if (empty($reqClassInput)) {
            throw new ValidationException(['class_id' => 'Please select a class.']);
        }

        if (!isset($data['amount']) || $data['amount'] === '' || !is_numeric($data['amount']) || (float)$data['amount'] < 0) {
            throw new ValidationException(['amount' => 'Please enter a valid non-negative course fee amount.']);
        }

        $amount = (float)$data['amount'];

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : null;

        $academicYearId = !empty($data['academic_year_id']) ? (int)$data['academic_year_id'] : $workingYearId;

        if ($academicYearId !== null) {
            $stmtVerifyAY = $pdo->prepare("SELECT id FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
            $stmtVerifyAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
            $validAyId = $stmtVerifyAY->fetchColumn();
            if (!$validAyId) {
                if ($workingYearId !== null) {
                    $academicYearId = $workingYearId;
                } else {
                    throw new ValidationException(['academic_year_id' => 'Invalid Academic Year for your school.']);
                }
            }
        }

        // Validate Class ID and verify that the class is added in the school
        $classId = null;
        $className = '';
        if (is_numeric($reqClassInput)) {
            $reqId = (int)$reqClassInput;
            $stmtDirect = $pdo->prepare("SELECT id, name FROM classes WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmtDirect->execute([':id' => $reqId, ':sid' => $schoolId]);
            $directClass = $stmtDirect->fetch(PDO::FETCH_ASSOC);

            if ($directClass) {
                $classId = (int)$directClass['id'];
                $className = $directClass['name'];
            } else {
                $masterClass = $this->resolveMasterClass($reqId);
                if ($masterClass) {
                    $stmtMaster = $pdo->prepare("SELECT id, name FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name) LIMIT 1");
                    $stmtMaster->execute([':sid' => $schoolId, ':name' => $masterClass['name']]);
                    $foundClass = $stmtMaster->fetch(PDO::FETCH_ASSOC);
                    if ($foundClass) {
                        $classId = (int)$foundClass['id'];
                        $className = $foundClass['name'];
                    } else {
                        throw new ValidationException(['class_id' => 'This class is not added in your Academy yet. Please add the class first.']);
                    }
                } else {
                    throw new ValidationException(['class_id' => 'The selected class does not exist in master catalog.']);
                }
            }
        } else {
            $inputStr = trim((string)$reqClassInput);
            $masterClass = $this->resolveMasterClass($inputStr);
            if ($masterClass) {
                $stmtMaster = $pdo->prepare("SELECT id, name FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name) LIMIT 1");
                $stmtMaster->execute([':sid' => $schoolId, ':name' => $masterClass['name']]);
                $foundClass = $stmtMaster->fetch(PDO::FETCH_ASSOC);
                if ($foundClass) {
                    $classId = (int)$foundClass['id'];
                    $className = $foundClass['name'];
                } else {
                    throw new ValidationException(['class_id' => 'This class is not added in your Academy yet. Please add the class first.']);
                }
            } else {
                throw new ValidationException(['class_id' => 'The selected class does not exist in master catalog.']);
            }
        }

        // Get all class IDs sharing the same class name in this school so all sections sync
        $stmtSameClasses = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name)");
        $stmtSameClasses->execute([':sid' => $schoolId, ':name' => $className]);
        $allClassIds = $stmtSameClasses->fetchAll(PDO::FETCH_COLUMN);
        if (empty($allClassIds)) {
            $allClassIds = [$classId];
        }

        $stmtSave = $pdo->prepare("
            INSERT INTO class_course_fee_configurations (school_id, class_id, academic_year_id, amount)
            VALUES (:sid, :cid, :ayid, :amount)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        ");

        foreach ($allClassIds as $cId) {
            $stmtSave->execute([
                ':sid' => $schoolId,
                ':cid' => (int)$cId,
                ':ayid' => $academicYearId,
                ':amount' => $amount
            ]);
        }

        return [
            'class_id' => $classId,
            'academic_year_id' => $academicYearId,
            'amount' => $amount,
            'message' => 'Course fee configuration saved successfully.'
        ];
    }

    public function saveClassFeeConfiguration(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->feeRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $reqClassInput = $data['class_id'] ?? null;
        if (empty($reqClassInput)) {
            throw new ValidationException(['class_id' => 'Please select a class.']);
        }
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : null;

        $academicYearId = !empty($data['academic_year_id']) ? (int)$data['academic_year_id'] : $workingYearId;

        if ($academicYearId !== null) {
            $stmtVerifyAY = $pdo->prepare("SELECT id FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
            $stmtVerifyAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
            $validAyId = $stmtVerifyAY->fetchColumn();
            if (!$validAyId) {
                if ($workingYearId !== null) {
                    $academicYearId = $workingYearId;
                } else {
                    throw new ValidationException(['academic_year_id' => 'Invalid Academic Year for your school.']);
                }
            }
        }

        // Validate Class ID and verify that the class is added in the school
        $classId = null;
        if (is_numeric($reqClassInput)) {
            $reqId = (int)$reqClassInput;
            // 1. Direct school class ID check
            $stmtDirect = $pdo->prepare("SELECT id FROM classes WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmtDirect->execute([':id' => $reqId, ':sid' => $schoolId]);
            $directId = $stmtDirect->fetchColumn();

            if ($directId) {
                $classId = (int)$directId;
            } else {
                // 2. Check if reqId matches a Master Class ID (e.g. 14 -> Class 10, 5 -> Class 1)
                $masterClass = $this->resolveMasterClass($reqId);
                if ($masterClass) {
                    $stmtMaster = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name) LIMIT 1");
                    $stmtMaster->execute([':sid' => $schoolId, ':name' => $masterClass['name']]);
                    $foundSchoolClassId = $stmtMaster->fetchColumn();

                    if ($foundSchoolClassId) {
                        $classId = (int)$foundSchoolClassId;
                    } else {
                        // Master class exists, but not added in this school yet
                        throw new ValidationException([
                            'class_id' => 'This class is not added in your Academy yet. Please add the class first.'
                        ], 'This class is not added in your Academy yet. Please add the class first.');
                    }
                } else {
                    // Invalid class ID completely
                    throw new ValidationException([
                        'class_id' => 'The selected class does not exist in master catalog.'
                    ], 'The selected class does not exist in master catalog.');
                }
            }
        } else {
            // String class input (e.g. "Class 10" or "B.Tech")
            $inputStr = trim((string)$reqClassInput);
            $masterClass = $this->resolveMasterClass($inputStr);
            if ($masterClass) {
                $stmtMaster = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid AND LOWER(name) = LOWER(:name) LIMIT 1");
                $stmtMaster->execute([':sid' => $schoolId, ':name' => $masterClass['name']]);
                $foundSchoolClassId = $stmtMaster->fetchColumn();

                if ($foundSchoolClassId) {
                    $classId = (int)$foundSchoolClassId;
                } else {
                    throw new ValidationException([
                        'class_id' => 'This class is not added in your Academy yet. Please add the class first.'
                    ], 'This class is not added in your Academy yet. Please add the class first.');
                }
            } else {
                throw new ValidationException([
                    'class_id' => 'The selected class does not exist in master catalog.'
                ], 'The selected class does not exist in master catalog.');
            }
        }

        $mode = 'SAME';
        $monthlyFees = $data['monthly_fees'] ?? [];

        // Validate monthly fee amounts
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        if (empty($monthlyFees)) {
            throw new ValidationException(['monthly_fees' => 'Monthly fee must be greater than ₹0.']);
        }

        foreach ($academicMonths as $m) {
            $val = isset($monthlyFees[$m]) ? $monthlyFees[$m] : null;
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
            throw new ValidationException([
                'class_id' => 'Fee configuration for this class is already saved and locked for this academic year.'
            ], 'Fee configuration for this class is already saved and locked for this academic year.');
        }

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

        if ($classId <= 0) {
            return ['next_roll_no' => 1];
        }

        $stmtRoll = $pdo->prepare("
            SELECT COALESCE(MAX(CAST(roll_no AS UNSIGNED)), 0)
            FROM students
            WHERE school_id = :sid 
              AND class_id = :cid
              AND status = 'ACTIVE'
              AND roll_no IS NOT NULL 
              AND roll_no REGEXP '^[0-9]+$'
        ");
        $stmtRoll->execute([
            ':sid' => $schoolId,
            ':cid' => $classId
        ]);
        $maxRoll = (int)$stmtRoll->fetchColumn();
        $nextRollNo = $maxRoll > 0 ? $maxRoll + 1 : 1;

        return ['next_roll_no' => $nextRollNo];
    }

    public function checkRollNoExists(array $user, int $classId, string $rollNo, ?int $excludeId = null): bool
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        return $this->checkRollNoExistsInternal($pdo, $schoolId, $classId, $rollNo, $excludeId);
    }

    public function resequenceSectionRollNumbers(\PDO $pdo, int $schoolId, int $classId): void
    {
        if ($classId <= 0) return;

        $stmtSt = $pdo->prepare("
            SELECT id 
            FROM students 
            WHERE school_id = :sid AND class_id = :cid AND status = 'ACTIVE' 
            ORDER BY name ASC, id ASC
        ");
        $stmtSt->execute([':sid' => $schoolId, ':cid' => $classId]);
        $stIds = $stmtSt->fetchAll(\PDO::FETCH_COLUMN);

        if (!empty($stIds)) {
            $roll = 1;
            $stmtUp = $pdo->prepare("UPDATE students SET roll_no = :roll WHERE id = :id AND school_id = :sid");
            foreach ($stIds as $stId) {
                $stmtUp->execute([
                    ':roll' => (string)$roll,
                    ':id'   => $stId,
                    ':sid'  => $schoolId
                ]);
                $roll++;
            }
        }
    }

    private function checkRollNoExistsInternal(\PDO $pdo, int $schoolId, int $classId, string $rollNo, ?int $excludeId = null): bool
    {
        $rollNo = trim($rollNo);
        if ($classId <= 0 || $rollNo === '') {
            return false;
        }

        $sql = "
            SELECT id 
            FROM students
            WHERE school_id = :sid 
              AND class_id = :cid 
              AND roll_no = :roll_no 
              AND status = 'ACTIVE'
        ";
        $params = [
            ':sid' => $schoolId,
            ':cid' => $classId,
            ':roll_no' => $rollNo
        ];

        if ($excludeId !== null && $excludeId > 0) {
            $sql .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeId;
        }
        $sql .= " LIMIT 1";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn() !== false;
    }

    public function getStaffPayments(array $user, string $month): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        // Get working academic year
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        $ayClause = ($academicYearId > 0) ? " AND (s.academic_year_id = :ayid_staff OR s.academic_year_id IS NULL)" : "";
        $params = [
            ':month' => $month,
            ':ayid_sp' => $academicYearId,
            ':sid' => $schoolId
        ];
        if ($academicYearId > 0) {
            $params[':ayid_staff'] = $academicYearId;
        }

        // Query active staff members and their payout status for the given month
        $stmt = $pdo->prepare("
            SELECT s.id AS staff_id, s.name, s.role, s.department, COALESCE(s.salary, 0.0) AS salary, 
                   s.joining_date, s.photo_path, s.updated_at,
                   sp.id AS payment_id, sp.payment_date, sp.amount_paid,
                   CASE WHEN sp.id IS NOT NULL THEN 'Paid' ELSE 'Pending' END AS payment_status
            FROM staff s
            LEFT JOIN staff_payments sp ON s.id = sp.staff_id AND sp.payment_month = :month AND sp.academic_year_id = :ayid_sp
            WHERE s.school_id = :sid AND s.status = 'ACTIVE'{$ayClause}
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $results = [];
        foreach ($rows as $row) {
            $joiningDateStr = $row['joining_date'] ?? null;
            
            // Filter: Skip teacher if the target month is before their joining month
            if ($joiningDateStr && $workingYear) {
                try {
                    $joiningDate = new \DateTime($joiningDateStr);
                    $targetMonthStr = $this->getTargetMonthDateStr($workingYear, $month);
                    $targetMonthDate = new \DateTime($targetMonthStr);

                    $joiningYearMonth = $joiningDate->format('Y-m');
                    $targetYearMonth = $targetMonthDate->format('Y-m');

                    if ($targetYearMonth < $joiningYearMonth) {
                        // Skip teacher for this month as they haven't joined yet
                        continue;
                    }
                } catch (\Exception $e) {
                    // ignore
                }
            }

            $prorDetails = $this->getSalaryProrationDetails((float)$row['salary'], $joiningDateStr, $month, $workingYear);
            $payableSalary = ($row['payment_id'] !== null)
                ? (float)$row['amount_paid']
                : $this->calculateStaffMonthlySalary(
                    $pdo,
                    $schoolId,
                    (int)$row['staff_id'],
                    (float)$row['salary'],
                    $month,
                    $workingYear ?: []
                );

            $results[] = [
                'id' => (int)$row['staff_id'],
                'name' => $row['name'],
                'designation' => trim(($row['role'] ?? '') . ' ' . ($row['department'] ?? '')),
                'salary' => (float)$row['salary'],
                'payable_salary' => $payableSalary,
                'proration_details' => $prorDetails['is_prorated'] ? $prorDetails : null,
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

        try {
            $pdo->exec("ALTER TABLE staff_payments MODIFY COLUMN payment_month VARCHAR(100) NOT NULL");
        } catch (\Throwable $e) {}

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

        if ($workingYear['status'] === 'Draft') {
            throw new ValidationException(['month' => 'Salary cannot be disbursed under a Draft academic year. Academic year must be ACTIVE.']);
        }

        if ($workingYear['status'] === 'Archived') {
            if ($this->isStaffMigrated($pdo, $staffId, $schoolId)) {
                throw new ValidationException(['month' => 'This teacher has been migrated/copied to the next academic year. Salary cannot be disbursed from the archived academic year.']);
            }
            $payYearId = $academicYearId;
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

        // Calculate starting month index based on teacher's joining date
        $startCheckIndex = 0;
        if (!empty($staff['joining_date'])) {
            try {
                $joiningDate = new \DateTime($staff['joining_date']);
                $joiningYM = $joiningDate->format('Y-m');

                for ($k = 0; $k < count($monthsOrder); $k++) {
                    $mStr = $this->getTargetMonthDateStr($workingYear, $monthsOrder[$k]);
                    $mDate = new \DateTime($mStr);
                    if ($mDate->format('Y-m') >= $joiningYM) {
                        $startCheckIndex = $k;
                        break;
                    }
                }
            } catch (\Exception $e) {
                $startCheckIndex = 0;
            }
        }

        if ($targetIndex > $startCheckIndex) {
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

            for ($i = $startCheckIndex; $i < $targetIndex; $i++) {
                $prevMonth = $monthsOrder[$i];
                if (!in_array($prevMonth, $paidMonths, true)) {
                    throw new ValidationException(['month' => "Previous month's salary is still pending. Please complete earlier salary payments first."]);
                }
            }
        }

        // Enforce: Prevent disbursement for months before the joining date
        if ($staff['joining_date']) {
            try {
                $joiningDate = new \DateTime($staff['joining_date']);
                $targetMonthStr = $this->getTargetMonthDateStr($workingYear, $month);
                $targetMonthDate = new \DateTime($targetMonthStr);

                $joiningYearMonth = $joiningDate->format('Y-m');
                $targetYearMonth = $targetMonthDate->format('Y-m');

                if ($targetYearMonth < $joiningYearMonth) {
                    throw new ValidationException(['month' => 'Salary disbursement is not allowed for months before the joining date.']);
                }
            } catch (\Exception $e) {
                if ($e instanceof ValidationException) {
                    throw $e;
                }
            }
        }

        $salary = $this->calculateStaffMonthlySalary(
            $pdo,
            $schoolId,
            $staffId,
            (float)($staff['salary'] ?? 0.0),
            $month,
            $workingYear
        );
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

        // Create in-app notification for the teacher
        if (!empty($staff['phone'])) {
            $stmtUserPhone = $pdo->prepare("SELECT id FROM users WHERE phone = :phone LIMIT 1");
            $stmtUserPhone->execute([':phone' => $staff['phone']]);
            $teacherUserId = $stmtUserPhone->fetchColumn();

            $stmtNotif = $pdo->prepare("
                INSERT INTO dashboard_notifications 
                    (school_id, user_id, user_role, title, message, event_key, category, is_read, created_at)
                VALUES 
                    (:sid, :uid, 'TEACHER', 'Salary Disbursed', :msg, 'SALARY_DISBURSED', 'Finance', 0, NOW())
            ");
            $stmtNotif->execute([
                ':sid' => $schoolId,
                ':uid' => $teacherUserId ?: null,
                ':msg' => "Your salary for the month of {$month} has been disbursed."
            ]);
        }

        return ['success' => true, 'id' => (int)$pdo->lastInsertId()];
    }

    public function disbursePreviousYearStaffSalary(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        try {
            $pdo->exec("ALTER TABLE staff_payments MODIFY COLUMN payment_month VARCHAR(100) NOT NULL");
        } catch (\Throwable $e) {}

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
        if ($workingYear['status'] === 'Draft') {
            throw new ValidationException(['message' => 'Salary cannot be disbursed under a Draft academic year. Academic year must be ACTIVE.']);
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
        $joiningDateStr = !empty($oldStaff['joining_date']) ? $oldStaff['joining_date'] : (!empty($staff['joining_date']) ? $staff['joining_date'] : null);
        $totalPaid = 0.0;
        foreach ($months as $m) {
            $pror = $this->getSalaryProrationDetails($salary, $joiningDateStr, $m, $prevYear);
            $totalPaid += (float)$pror['payable_salary'];
        }
        $paymentDate = date('Y-m-d');

        // Insert staff payment
        $stmt = $pdo->prepare("
            INSERT INTO staff_payments (school_id, staff_id, academic_year_id, amount_paid, payment_month, payment_date)
            VALUES (:sid, :staff_id, :ayid, :amount_paid, :month, :payment_date)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':staff_id' => $staffId,
            ':ayid' => $prevYear['id'],
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
        if ($this->isTransactionInReport($pdo, $schoolId, $payment['created_at']) || $this->isTransactionInReport($pdo, $schoolId, $payment['payment_date'])) {
            throw new ValidationException(
                ['locked' => 'This action can not be done, This is already included in financial report'],
                'This action can not be done, This is already included in financial report'
            );
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
            ORDER BY id DESC LIMIT 1
        ");
        $stmtLatest->execute([':sid' => $schoolId]);
        $latestReport = $stmtLatest->fetch(PDO::FETCH_ASSOC);

        if (empty($from)) {
            if ($latestReport && !empty($latestReport['to_date'])) {
                $nextStart = date('Y-m-d', strtotime($latestReport['to_date'] . ' +1 day'));
                $from = $nextStart;
            } else {
                $from = $workingYear['start_date'] ?? date('Y-m-01');
            }
        }
        if (empty($to)) {
            $to = date('Y-m-d');
        }

        if (strtotime($from) > strtotime($to)) {
            $from = date('Y-m-01');
        }

        $fromTs = $from . ' 00:00:00';
        $toTs = $to . ' 23:59:59';

        // 1. Total Student Tuition Fees Collected within report period
        $stmtFees = $pdo->prepare("
            SELECT COALESCE(SUM(fp.amount_paid), 0) 
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            WHERE fp.school_id = :sid 
              AND fp.status IN ('PAID', 'Partial')
              AND (
                s.academic_year_id = :ayid
                OR (
                  fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                )
              )
              AND (
                (fp.payment_date IS NOT NULL AND fp.payment_date >= :from_date AND fp.payment_date <= :to_date)
                OR (fp.payment_date IS NULL AND fp.created_at >= :from_ts AND fp.created_at <= :to_ts)
              )
        ");
        $stmtFees->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $tuitionCollected = (float)$stmtFees->fetchColumn();

        // 2. Total Additional Paid Fees within report period (from payment history)
        $stmtAddFees = $pdo->prepare("
            SELECT COALESCE(SUM(afph.amount_paid), 0) 
            FROM additional_fee_payment_history afph
            JOIN additional_fee_payments afp ON afph.payment_id = afp.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            JOIN students s ON afp.student_id = s.id
            WHERE afp.school_id = :sid 
              AND (
                s.academic_year_id = :ayid_stu
                OR aft.academic_year_id = :ayid_fee
                OR aft.academic_year_id IS NULL
                OR (
                  afph.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                )
              )
              AND (
                (afph.payment_date IS NOT NULL AND afph.payment_date >= :from_date AND afph.payment_date <= :to_date)
                OR (afph.payment_date IS NULL AND afph.created_at >= :from_ts AND afph.created_at <= :to_ts)
              )
        ");
        $stmtAddFees->execute([
            ':sid' => $schoolId,
            ':ayid_stu' => $workingYear['id'],
            ':ayid_fee' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $addFeesCollected = (float)$stmtAddFees->fetchColumn();

        $totalFees = $tuitionCollected + $addFeesCollected;

        // 3. Total Teacher Salaries Paid within report period
        $stmtSalaries = $pdo->prepare("
            SELECT COALESCE(SUM(amount_paid), 0) 
            FROM staff_payments 
            WHERE school_id = :sid 
              AND (
                academic_year_id = :ayid
                OR created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
              )
              AND (
                (payment_date IS NOT NULL AND payment_date >= :from_date AND payment_date <= :to_date)
                OR (payment_date IS NULL AND created_at >= :from_ts AND created_at <= :to_ts)
              )
        ");
        $stmtSalaries->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $salariesPaid = (float)$stmtSalaries->fetchColumn();

        // 4. Total School Expenses Logged within report period
        $stmtExpenses = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) 
            FROM school_expenses 
            WHERE school_id = :sid 
              AND academic_year_id = :ayid
              AND (
                (expense_date IS NOT NULL AND expense_date >= :from_date AND expense_date <= :to_date)
                OR (expense_date IS NULL AND created_at >= :from_ts AND created_at <= :to_ts)
              )
        ");
        $stmtExpenses->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $expensesPaid = (float)$stmtExpenses->fetchColumn();

        $totalFees = round($tuitionCollected + $addFeesCollected, 2);
        $salariesPaid = round($salariesPaid, 2);
        $expensesPaid = round($expensesPaid, 2);
        $totalExpenses = round($salariesPaid + $expensesPaid, 2);
        $profitLoss = round($totalFees - $totalExpenses, 2);

        return [
            'from_date' => $from,
            'to_date' => $to,
            'fees_collected' => $totalFees,
            'salary_paid' => $totalExpenses,
            'profit_loss' => $profitLoss
        ];
    }

    private function autoGenerateCompletedMonthlyReports(\PDO $pdo, int $schoolId, ?array $workingYear): void
    {
        if (!$workingYear) return;

        // Clean up invalid multi-month reports spanning across different calendar months
        $stmtBad = $pdo->prepare("
            SELECT id FROM financial_reports 
            WHERE school_id = :sid 
              AND DATE_FORMAT(from_date, '%Y-%m') != DATE_FORMAT(to_date, '%Y-%m')
        ");
        $stmtBad->execute([':sid' => $schoolId]);
        $badIds = $stmtBad->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($badIds)) {
            $inClause = implode(',', array_map('intval', $badIds));
            $pdo->exec("DELETE FROM financial_reports WHERE id IN ($inClause) AND school_id = $schoolId");
        }

        $ayStart = $workingYear['start_date'];
        $ayEnd = $workingYear['end_date'];
        $today = date('Y-m-d');

        $currentMonthStart = date('Y-m-01', strtotime($ayStart));
        
        while ($currentMonthStart <= $ayEnd && $currentMonthStart <= $today) {
            $monthEnd = date('Y-m-t', strtotime($currentMonthStart));
            $targetToDate = ($today < $monthEnd) ? $today : $monthEnd;

            $stmtCheck = $pdo->prepare("
                SELECT id FROM financial_reports 
                WHERE school_id = :sid AND (
                    (`from_date` = :fdate1 AND `to_date` = :tdate1)
                    OR (`from_date` <= :fdate2 AND `to_date` >= :tdate2)
                )
                LIMIT 1
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':fdate1' => $currentMonthStart,
                ':tdate1' => $targetToDate,
                ':fdate2' => $currentMonthStart,
                ':tdate2' => $targetToDate
            ]);
            $exists = $stmtCheck->fetchColumn() !== false;

            if (!$exists) {
                $stmtFees = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM fee_payments 
                    WHERE school_id = :sid AND status IN ('PAID', 'Partial')
                      AND academic_year_id = :ayid
                      AND payment_date >= :fdate AND payment_date <= :tdate
                ");
                $stmtFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $workingYear['id'],
                    ':fdate' => $currentMonthStart,
                    ':tdate' => $targetToDate
                ]);
                $tuition = (float)$stmtFees->fetchColumn();

                $stmtAddFees = $pdo->prepare("
                    SELECT COALESCE(SUM(afph.amount_paid), 0) 
                    FROM additional_fee_payment_history afph
                    JOIN additional_fee_payments afp ON afph.payment_id = afp.id
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    WHERE afp.school_id = :sid 
                      AND aft.academic_year_id = :ayid
                      AND (
                        (afph.payment_date IS NOT NULL AND afph.payment_date >= :fdate1 AND afph.payment_date <= :tdate1)
                        OR (afph.payment_date IS NULL AND DATE(afph.created_at) >= :fdate2 AND DATE(afph.created_at) <= :tdate2)
                      )
                ");
                $stmtAddFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $workingYear['id'],
                    ':fdate1' => $currentMonthStart,
                    ':tdate1' => $targetToDate,
                    ':fdate2' => $currentMonthStart,
                    ':tdate2' => $targetToDate
                ]);
                $addFees = (float)$stmtAddFees->fetchColumn();
                $totalRevenue = round($tuition + $addFees, 2);

                $stmtSal = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM staff_payments 
                    WHERE school_id = :sid AND academic_year_id = :ayid
                      AND payment_date >= :fdate AND payment_date <= :tdate
                ");
                $stmtSal->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $workingYear['id'],
                    ':fdate' => $currentMonthStart,
                    ':tdate' => $targetToDate
                ]);
                $salaries = (float)$stmtSal->fetchColumn();

                $stmtExp = $pdo->prepare("
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM school_expenses 
                    WHERE school_id = :sid AND academic_year_id = :ayid
                      AND expense_date >= :fdate AND expense_date <= :tdate
                ");
                $stmtExp->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $workingYear['id'],
                    ':fdate' => $currentMonthStart,
                    ':tdate' => $targetToDate
                ]);
                $expenses = (float)$stmtExp->fetchColumn();
                $totalExpenses = round($salaries + $expenses, 2);

                $profitLoss = round($totalRevenue - $totalExpenses, 2);

                $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM financial_reports WHERE school_id = :sid");
                $stmtCount->execute([':sid' => $schoolId]);
                $count = (int)$stmtCount->fetchColumn();
                $reportId = 'REP-' . str_pad((string)($count + 1), 3, '0', STR_PAD_LEFT);

                $nextMonthFirst = date('Y-m-d 00:00:00', strtotime($targetToDate . ' +1 day'));
                $stmtIns = $pdo->prepare("
                    INSERT INTO financial_reports (school_id, report_id, `from_date`, `to_date`, fees_collected, salary_paid, profit_loss, status, created_at)
                    VALUES (:sid, :rid, :fdate, :tdate, :fees, :sal, :pl, 'Pending', :created_at)
                ");
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':rid' => $reportId,
                    ':fdate' => $currentMonthStart,
                    ':tdate' => $targetToDate,
                    ':fees' => $totalRevenue,
                    ':sal' => $totalExpenses,
                    ':pl' => $profitLoss,
                    ':created_at' => $nextMonthFirst
                ]);
            }

            $currentMonthStart = date('Y-m-d', strtotime($currentMonthStart . ' +1 month'));
        }
    }

    public function getFinancialReports(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        $this->autoGenerateCompletedMonthlyReports($pdo, $schoolId, $workingYear);

        // 1. Fetch generated reports (filtered by selected Academic Year)
        if ($workingYear) {
            $stmt = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND `from_date` >= :start_date 
                  AND `from_date` <= :end_date
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
                  AND `from_date` <= :end_date
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
        // Determine report's target Academic Year ID
        $stmtRepAY = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND start_date <= :fdate AND end_date >= :tdate LIMIT 1");
        $stmtRepAY->execute([':sid' => $schoolId, ':fdate' => $report['from_date'], ':tdate' => $report['to_date']]);
        $targetAYId = (int)$stmtRepAY->fetchColumn();

        $ayClause = "";
        $paramsFee = [':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts];
        if ($targetAYId > 0) {
            $ayClause = " AND (fp.academic_year_id = :target_ayid OR s.academic_year_id = :target_ayid OR (s.status IN ('Inactive', 'Alumni', 'Archived')))";
            $paramsFee[':target_ayid'] = $targetAYId;
        }

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
                fp.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(fp.collected_by, 'School Admin') AS collected_by
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = fp.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = fp.school_id)
            WHERE fp.school_id = :sid 
              AND fp.status IN ('PAID', 'Partial')
              AND fp.created_at {$operator} :from_ts 
              AND fp.created_at <= :to_ts
              {$ayClause}
        ");
        $stmtFeeList->execute($paramsFee);
        $feePayments = $stmtFeeList->fetchAll(PDO::FETCH_ASSOC);

        $ayClauseAdd = "";
        $paramsAdd = [':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts];
        if ($targetAYId > 0) {
            $ayClauseAdd = " AND (aft.academic_year_id = :target_ayid OR s.academic_year_id = :target_ayid OR aft.academic_year_id IS NULL OR (s.status IN ('Inactive', 'Alumni', 'Archived')))";
            $paramsAdd[':target_ayid'] = $targetAYId;
        }

        $stmtAddFeeList = $pdo->prepare("
            SELECT 
                afph.created_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                aft.name AS fee_type, 
                'N/A' AS months_covered, 
                afph.amount_paid AS amount,
                aft.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(afph.collected_by, afp.collected_by, 'School Admin') AS collected_by
            FROM additional_fee_payment_history afph
            JOIN additional_fee_payments afp ON afph.payment_id = afp.id
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = afph.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = afp.school_id)
            WHERE afp.school_id = :sid 
              AND afph.created_at {$operator} :from_ts 
              AND afph.created_at <= :to_ts
              {$ayClauseAdd}
        ");
        $stmtAddFeeList->execute($paramsAdd);
        $addPayments = $stmtAddFeeList->fetchAll(PDO::FETCH_ASSOC);

        // Format previous year dues descriptions
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;
        $stmtAYNames = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid");
        $stmtAYNames->execute([':sid' => $schoolId]);
        $ayNames = $stmtAYNames->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        foreach ($feePayments as &$fp) {
            $stuAYId = (int)($fp['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $fp['fee_type'] = "Dues for " . $ayName;
            }
            unset($fp['academic_year_id'], $fp['student_academic_year_id']);
        }
        unset($fp);

        foreach ($addPayments as &$ap) {
            $stuAYId = (int)($ap['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $ap['fee_type'] = "Dues for " . $ayName;
            }
            unset($ap['academic_year_id'], $ap['student_academic_year_id']);
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
            SELECT sp.payment_month, sp.academic_year_id, st.name AS staff_name, sp.payment_date AS expense_date, sp.amount_paid AS amount, ay.name AS ay_name
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            LEFT JOIN academic_years ay ON sp.academic_year_id = ay.id
            WHERE sp.school_id = :sid 
              AND sp.created_at {$operator} :from_ts 
              AND sp.created_at <= :to_ts
        ");
        $stmtSalaryList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $salaryPaymentsRaw = $stmtSalaryList->fetchAll(PDO::FETCH_ASSOC);

        $salaryPayments = [];
        foreach ($salaryPaymentsRaw as $spr) {
            $rawMonth = $spr['payment_month'] ?? '';
            $cleanMonth = trim(str_replace('Previous Year - ', '', $rawMonth));
            $monthStr = !empty($cleanMonth) ? " ({$cleanMonth})" : "";
            $ayName = $spr['ay_name'] ?? ($ayNames[$spr['academic_year_id']] ?? '');
            $ayStr = !empty($ayName) ? " [{$ayName}]" : "";
            $categoryStr = "Salary Payment{$monthStr}{$ayStr}";
            $salaryPayments[] = [
                'description' => $spr['staff_name'],
                'category' => $categoryStr,
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

        // Profit / Loss Summary - calculate exact sum from itemized collections and expenses
        $calculatedRevenue = 0.0;
        foreach ($feeCollections as $fc) {
            $calculatedRevenue += round((float)($fc['amount'] ?? 0), 2);
        }
        $calculatedRevenue = round($calculatedRevenue, 2);

        $calculatedExpenses = 0.0;
        foreach ($expenses as $ex) {
            $calculatedExpenses += round((float)($ex['amount'] ?? 0), 2);
        }
        $calculatedExpenses = round($calculatedExpenses, 2);

        $summary = [
            'revenue' => $calculatedRevenue,
            'expenses' => $calculatedExpenses,
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
        // Determine report's target Academic Year ID
        $stmtRepAY2 = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND start_date <= :fdate AND end_date >= :tdate LIMIT 1");
        $stmtRepAY2->execute([':sid' => $schoolId, ':fdate' => $report['from_date'], ':tdate' => $report['to_date']]);
        $targetAYId2 = (int)$stmtRepAY2->fetchColumn();

        $ayClause2 = "";
        $paramsFee2 = [':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts];
        if ($targetAYId2 > 0) {
            $ayClause2 = " AND (fp.academic_year_id = :target_ayid OR s.academic_year_id = :target_ayid OR (s.status IN ('Inactive', 'Alumni', 'Archived')))";
            $paramsFee2[':target_ayid'] = $targetAYId2;
        }

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
                fp.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(fp.collected_by, 'School Admin') AS collected_by
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = fp.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = fp.school_id)
            WHERE fp.school_id = :sid 
              AND fp.status IN ('PAID', 'Partial')
              AND fp.created_at {$operator} :from_ts 
              AND fp.created_at <= :to_ts
              {$ayClause2}
        ");
        $stmtFeeList->execute($paramsFee2);
        $feePayments = $stmtFeeList->fetchAll(PDO::FETCH_ASSOC);

        $ayClauseAdd2 = "";
        $paramsAdd2 = [':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts];
        if ($targetAYId2 > 0) {
            $ayClauseAdd2 = " AND (aft.academic_year_id = :target_ayid OR s.academic_year_id = :target_ayid OR aft.academic_year_id IS NULL OR (s.status IN ('Inactive', 'Alumni', 'Archived')))";
            $paramsAdd2[':target_ayid'] = $targetAYId2;
        }

        $stmtAddFeeList = $pdo->prepare("
            SELECT 
                afph.created_at AS deposit_time, 
                s.name AS student_name, 
                c.name AS class_name, 
                c.section AS class_section,
                c.id AS class_id, 
                s.roll_no, 
                aft.name AS fee_type, 
                'N/A' AS months_covered, 
                afph.amount_paid AS amount,
                aft.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(afph.collected_by, afp.collected_by, 'School Admin') AS collected_by
            FROM additional_fee_payment_history afph
            JOIN additional_fee_payments afp ON afph.payment_id = afp.id
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = afph.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = afp.school_id)
            WHERE afp.school_id = :sid 
              AND afph.created_at {$operator} :from_ts 
              AND afph.created_at <= :to_ts
              {$ayClauseAdd2}
        ");
        $stmtAddFeeList->execute($paramsAdd2);
        $addPayments = $stmtAddFeeList->fetchAll(PDO::FETCH_ASSOC);

        // Format previous year dues descriptions
        $stmtActiveAY = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
        $stmtActiveAY->execute([':sid' => $schoolId]);
        $workingYear = $stmtActiveAY->fetch(PDO::FETCH_ASSOC);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : 0;
        $stmtAYNames = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid");
        $stmtAYNames->execute([':sid' => $schoolId]);
        $ayNames = $stmtAYNames->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        foreach ($feePayments as &$fp) {
            $stuAYId = (int)($fp['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $fp['fee_type'] = "Dues for " . $ayName;
            }
            unset($fp['academic_year_id'], $fp['student_academic_year_id']);
        }
        unset($fp);

        foreach ($addPayments as &$ap) {
            $stuAYId = (int)($ap['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $ap['fee_type'] = "Dues for " . $ayName;
            }
            unset($ap['academic_year_id'], $ap['student_academic_year_id']);
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
            SELECT sp.payment_month, sp.academic_year_id, st.name AS staff_name, sp.payment_date AS expense_date, sp.amount_paid AS amount, ay.name AS ay_name
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            LEFT JOIN academic_years ay ON sp.academic_year_id = ay.id
            WHERE sp.school_id = :sid 
              AND sp.created_at {$operator} :from_ts 
              AND sp.created_at <= :to_ts
        ");
        $stmtSalaryList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
        $salaryPaymentsRaw = $stmtSalaryList->fetchAll(PDO::FETCH_ASSOC);

        $salaryPayments = [];
        foreach ($salaryPaymentsRaw as $spr) {
            $rawMonth = $spr['payment_month'] ?? '';
            $cleanMonth = trim(str_replace('Previous Year - ', '', $rawMonth));
            $monthStr = !empty($cleanMonth) ? " ({$cleanMonth})" : "";
            $ayName = $spr['ay_name'] ?? ($ayNames[$spr['academic_year_id']] ?? '');
            $ayStr = !empty($ayName) ? " [{$ayName}]" : "";
            $categoryStr = "Salary Payment{$monthStr}{$ayStr}";
            $salaryPayments[] = [
                'description' => $spr['staff_name'],
                'category' => $categoryStr,
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

        // Profit / Loss Summary - calculate exact sum from itemized collections and expenses
        $calculatedRevenue = 0.0;
        foreach ($feeCollections as $fc) {
            $calculatedRevenue += round((float)($fc['amount'] ?? 0), 2);
        }
        $calculatedRevenue = round($calculatedRevenue, 2);

        $calculatedExpenses = 0.0;
        foreach ($expenses as $ex) {
            $calculatedExpenses += round((float)($ex['amount'] ?? 0), 2);
        }
        $calculatedExpenses = round($calculatedExpenses, 2);

        $summary = [
            'revenue' => $calculatedRevenue,
            'expenses' => $calculatedExpenses,
        ];

        // Format filename
        $fromFormatted = date('j M Y', strtotime($report['from_date']));
        $toFormatted = date('j M Y', strtotime($report['to_date']));
        $filename = "Financial Report - {$fromFormatted} to {$toFormatted}.xlsx";

        return ExcelGenerator::generate($feeCollections, $expenses, $summary);
    }

    public function exportFinancialPreviewReport(array $user, string $from = '', string $to = '', string &$filename = ''): string
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->financialReportRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$workingYear) {
            throw new ValidationException(['message' => 'No working academic year found.']);
        }

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
            $from = $workingYear['start_date'] ?? date('Y-m-01');
        }
        if (empty($to)) {
            $to = date('Y-m-d');
        }

        $fromTs = $from . ' 00:00:00';
        $toTs = $to . ' 23:59:59';

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
                fp.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(fp.collected_by, 'School Admin') AS collected_by
            FROM fee_payments fp
            JOIN students s ON fp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = fp.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = fp.school_id)
            WHERE fp.school_id = :sid 
              AND LOWER(fp.status) IN ('paid', 'partial')
              AND (
                s.academic_year_id = :ayid
                OR (
                  fp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                )
              )
              AND (
                (fp.payment_date IS NOT NULL AND fp.payment_date >= :from_date AND fp.payment_date <= :to_date)
                OR (fp.payment_date IS NULL AND fp.created_at >= :from_ts AND fp.created_at <= :to_ts)
              )
        ");
        $stmtFeeList->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
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
                afp.amount AS amount,
                aft.academic_year_id,
                s.academic_year_id AS student_academic_year_id,
                COALESCE(u.phone, '') AS collector_phone,
                COALESCE(afp.collected_by, 'School Admin') AS collected_by
            FROM additional_fee_payments afp
            JOIN students s ON afp.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            LEFT JOIN users u ON (u.name COLLATE utf8mb4_unicode_ci = afp.collected_by COLLATE utf8mb4_unicode_ci AND u.school_id = afp.school_id)
            WHERE afp.school_id = :sid 
              AND LOWER(afp.status) IN ('paid', 'partial')
              AND (
                s.academic_year_id = :ayid_stu
                OR aft.academic_year_id = :ayid_fee
                OR aft.academic_year_id IS NULL
                OR (
                  afp.updated_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
                  AND (s.status = 'Inactive' OR s.status = 'Alumni' OR s.status = 'Archived')
                )
              )
              AND (
                (afp.payment_date IS NOT NULL AND afp.payment_date >= :from_date AND afp.payment_date <= :to_date)
                OR (afp.payment_date IS NULL AND afp.created_at >= :from_ts AND afp.created_at <= :to_ts)
              )
        ");
        $stmtAddFeeList->execute([
            ':sid' => $schoolId,
            ':ayid_stu' => $workingYear['id'],
            ':ayid_fee' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $addPayments = $stmtAddFeeList->fetchAll(PDO::FETCH_ASSOC);

        $workingYearId = (int)$workingYear['id'];
        $stmtAYNames = $pdo->prepare("SELECT id, name FROM academic_years WHERE school_id = :sid");
        $stmtAYNames->execute([':sid' => $schoolId]);
        $ayNames = $stmtAYNames->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        foreach ($feePayments as &$fp) {
            $stuAYId = (int)($fp['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $fp['fee_type'] = "Dues for " . $ayName;
            }
            unset($fp['academic_year_id'], $fp['student_academic_year_id']);
        }
        unset($fp);

        foreach ($addPayments as &$ap) {
            $stuAYId = (int)($ap['student_academic_year_id'] ?? 0);
            if ($workingYearId && $stuAYId && $stuAYId !== $workingYearId) {
                $ayName = $ayNames[$stuAYId] ?? '';
                $ap['fee_type'] = "Dues for " . $ayName;
            }
            unset($ap['academic_year_id'], $ap['student_academic_year_id']);
        }
        unset($ap);

        $feeCollections = array_merge($feePayments, $addPayments);

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
            SELECT sp.payment_month, sp.academic_year_id, st.name AS staff_name, sp.payment_date AS expense_date, sp.amount_paid AS amount, ay.name AS ay_name
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            LEFT JOIN academic_years ay ON sp.academic_year_id = ay.id
            WHERE sp.school_id = :sid 
              AND (
                sp.academic_year_id = :ayid
                OR sp.created_at >= (SELECT created_at FROM academic_years WHERE id = :ayid_2 LIMIT 1)
              )
              AND (
                (sp.payment_date IS NOT NULL AND sp.payment_date >= :from_date AND sp.payment_date <= :to_date)
                OR (sp.payment_date IS NULL AND sp.created_at >= :from_ts AND sp.created_at <= :to_ts)
              )
        ");
        $stmtSalaryList->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':ayid_2' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $salaryPaymentsRaw = $stmtSalaryList->fetchAll(PDO::FETCH_ASSOC);

        $salaryPayments = [];
        foreach ($salaryPaymentsRaw as $spr) {
            $rawMonth = $spr['payment_month'] ?? '';
            $cleanMonth = trim(str_replace('Previous Year - ', '', $rawMonth));
            $monthStr = !empty($cleanMonth) ? " ({$cleanMonth})" : "";
            $ayName = $spr['ay_name'] ?? ($ayNames[$spr['academic_year_id']] ?? '');
            $ayStr = !empty($ayName) ? " [{$ayName}]" : "";
            $categoryStr = "Salary Payment{$monthStr}{$ayStr}";
            $salaryPayments[] = [
                'description' => $spr['staff_name'],
                'category' => $categoryStr,
                'expense_date' => $spr['expense_date'],
                'amount' => $spr['amount']
            ];
        }

        $stmtExpenseList = $pdo->prepare("
            SELECT description, 'School Expense' AS category, expense_date, amount
            FROM school_expenses
            WHERE school_id = :sid 
              AND academic_year_id = :ayid
              AND (
                (expense_date IS NOT NULL AND expense_date >= :from_date AND expense_date <= :to_date)
                OR (expense_date IS NULL AND created_at >= :from_ts AND created_at <= :to_ts)
              )
        ");
        $stmtExpenseList->execute([
            ':sid' => $schoolId,
            ':ayid' => $workingYear['id'],
            ':from_date' => $from,
            ':to_date' => $to,
            ':from_ts' => $fromTs,
            ':to_ts' => $toTs
        ]);
        $expensesItems = $stmtExpenseList->fetchAll(PDO::FETCH_ASSOC);

        $expenses = array_merge($salaryPayments, $expensesItems);
        usort($expenses, function($a, $b) {
            return strcmp($a['expense_date'] ?? '', $b['expense_date'] ?? '');
        });

        $totalRev = array_reduce($feeCollections, fn($sum, $item) => $sum + (float)$item['amount'], 0.0);
        $totalExp = array_reduce($expenses, fn($sum, $item) => $sum + (float)$item['amount'], 0.0);

        $summary = [
            'revenue' => $totalRev,
            'expenses' => $totalExp,
        ];

        $fromFormatted = date('j M Y', strtotime($from));
        $toFormatted = date('j M Y', strtotime($to));
        $filename = "Financial Statement Preview - {$fromFormatted} to {$toFormatted}.xlsx";

        return ExcelGenerator::generate($feeCollections, $expenses, $summary);
    }

    public function isStudentPromoted(PDO $pdo, int $studentId, int $schoolId): bool
    {
        // 1. Get the academic year of the student
        $stmtStu = $pdo->prepare("
            SELECT s.admission_no, s.name, s.father_name, s.parent_phone, s.father_phone, s.student_mobile, s.academic_year_id, ay.start_date
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

        $admissionNo = trim((string)($stu['admission_no'] ?? ''));
        $name = trim((string)($stu['name'] ?? ''));
        $fatherName = trim((string)($stu['father_name'] ?? ''));
        $phone = !empty($stu['parent_phone']) ? trim((string)$stu['parent_phone']) : (!empty($stu['father_phone']) ? trim((string)$stu['father_phone']) : (!empty($stu['student_mobile']) ? trim((string)$stu['student_mobile']) : ''));
        $startDate = $stu['start_date'];
        $currentAyId = (int)$stu['academic_year_id'];

        // Get the system active academic year (is_current = 1 or status = 'ACTIVE')
        $stmtActive = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (is_current = 1 OR UPPER(status) = 'ACTIVE') ORDER BY is_current DESC, id DESC LIMIT 1");
        $stmtActive->execute([':sid' => $schoolId]);
        $activeAyId = (int)($stmtActive->fetchColumn() ?: 0);

        // If the student record belongs to the current active academic year, they are NOT a promoted past record
        if ($activeAyId > 0 && $currentAyId === $activeAyId) {
            return false;
        }

        // 2. Check if there is a matching student record in a newer or current active academic year
        $conds = [];
        $params = [
            ':sid' => $schoolId,
            ':curr_ay' => $currentAyId,
            ':start_date' => $startDate
        ];

        if ($admissionNo !== '') {
            $conds[] = "s.admission_no = :adm";
            $params[':adm'] = $admissionNo;
        }

        if ($name !== '') {
            $nameCond = "LOWER(TRIM(s.name)) = LOWER(:cname)";
            $params[':cname'] = $name;

            if ($phone !== '') {
                $conds[] = "({$nameCond} AND (s.parent_phone = :p1 OR s.father_phone = :p2 OR s.student_mobile = :p3))";
                $params[':p1'] = $phone;
                $params[':p2'] = $phone;
                $params[':p3'] = $phone;
            } else {
                $conds[] = "({$nameCond} AND COALESCE(TRIM(s.father_name), '') = :fname)";
                $params[':fname'] = $fatherName;
            }
        }

        if (empty($conds)) {
            return false;
        }

        $sqlCheck = "
            SELECT COUNT(*)
            FROM students s
            JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.school_id = :sid
              AND s.academic_year_id != :curr_ay
              AND (ay.is_current = 1 OR UPPER(ay.status) = 'ACTIVE' OR ay.start_date > :start_date)
              AND (" . implode(' OR ', $conds) . ")
        ";

        $stmtCheck = $pdo->prepare($sqlCheck);
        $stmtCheck->execute($params);
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
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        $where = "se.school_id = :sid";
        $params = [':sid' => $schoolId];

        if ($workingYear) {
            $where .= " AND (se.academic_year_id = :ayid OR (se.academic_year_id IS NULL AND se.expense_date >= :start_date AND se.expense_date <= :end_date))";
            $params[':ayid'] = $workingYear['id'];
            $params[':start_date'] = $workingYear['start_date'];
            $params[':end_date'] = $workingYear['end_date'];
        }

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

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear && $workingYear['status'] === 'Draft') {
            throw new ValidationException(['fields' => 'Expenses cannot be added under a Draft academic year. Academic year must be ACTIVE.']);
        }

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
        $billPath = !empty($data['bill_attachment_path']) ? trim($data['bill_attachment_path']) : null;

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $ayid = $workingYear ? (int)$workingYear['id'] : null;

        $stmt = $pdo->prepare("
            INSERT INTO school_expenses (school_id, description, amount, created_by, expense_date, category, payment_method, reference_number, academic_year_id, bill_attachment_path)
            VALUES (:sid, :desc, :amount, :created_by, :expense_date, :cat, :pmethod, :ref, :ayid, :bill)
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
            ':ayid' => $ayid,
            ':bill' => $billPath
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
        $billPath = array_key_exists('bill_attachment_path', $data)
            ? (!empty($data['bill_attachment_path']) ? trim($data['bill_attachment_path']) : null)
            : ($expense['bill_attachment_path'] ?? null);

        $stmt = $pdo->prepare("
            UPDATE school_expenses 
            SET description = :desc, amount = :amount, expense_date = :expense_date, category = :cat, payment_method = :pmethod, reference_number = :ref, bill_attachment_path = :bill
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
            ':ref' => $refNo,
            ':bill' => $billPath
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

        if ($this->isTransactionInReport($pdo, $schoolId, $expense['created_at'] ?? $expense['expense_date']) || $this->isTransactionInReport($pdo, $schoolId, $expense['expense_date'])) {
            throw new ValidationException(
                ['locked' => 'This action can not be done, This is already included in financial report'],
                'This action can not be done, This is already included in financial report'
            );
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

        $stmtActiveClasses = $pdo->prepare("
            SELECT COUNT(DISTINCT class_id) 
            FROM students 
            WHERE school_id = :sid AND status = 'ACTIVE'
              " . ($workingYearId !== null ? "AND academic_year_id = :ayid" : "") . "
        ");
        $stmtActiveClassesParams = [':sid' => $schoolId];
        if ($workingYearId !== null) {
            $stmtActiveClassesParams[':ayid'] = $workingYearId;
        }
        $stmtActiveClasses->execute($stmtActiveClassesParams);
        $activeClassesCount = (int)$stmtActiveClasses->fetchColumn();
        if ($activeClassesCount <= 0) {
            $activeClassesCount = $totalClassesCount;
        }

        if ($workingYearId !== null) {
            $stmt = $pdo->prepare("
                SELECT MIN(aft.id) as id, aft.name, MAX(aft.amount) as amount, aft.due_date, aft.academic_year_id,
                       MAX(aft.category) as category,
                       COUNT(DISTINCT aft.id) as type_count,
                       COUNT(afp.id) as total_students,
                       SUM(CASE WHEN afp.status = 'Paid' THEN 1 ELSE 0 END) as collected_students,
                       SUM(CASE WHEN afp.status = 'Pending' THEN 1 ELSE 0 END) as pending_students,
                       SUM(CASE WHEN afp.status = 'Paid' THEN afp.amount ELSE 0 END) as collected_amount,
                       SUM(CASE WHEN afp.status = 'Pending' THEN afp.amount ELSE 0 END) as pending_amount
                FROM additional_fee_types aft
                LEFT JOIN additional_fee_payments afp ON afp.fee_type_id = aft.id
                WHERE aft.school_id = :sid AND aft.academic_year_id = :ayid
                  AND aft.name NOT IN ('Transport Fees', 'Admission Fee')
                  AND (aft.category IS NULL OR aft.category != 'System Generated')
                GROUP BY aft.name, aft.due_date, aft.academic_year_id
                ORDER BY id DESC
            ");
            $stmt->execute([':sid' => $schoolId, ':ayid' => $workingYearId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT MIN(aft.id) as id, aft.name, MAX(aft.amount) as amount, aft.due_date, aft.academic_year_id,
                       MAX(aft.category) as category,
                       COUNT(DISTINCT aft.id) as type_count,
                       COUNT(afp.id) as total_students,
                       SUM(CASE WHEN afp.status = 'Paid' THEN 1 ELSE 0 END) as collected_students,
                       SUM(CASE WHEN afp.status = 'Pending' THEN 1 ELSE 0 END) as pending_students,
                       SUM(CASE WHEN afp.status = 'Paid' THEN afp.amount ELSE 0 END) as collected_amount,
                       SUM(CASE WHEN afp.status = 'Pending' THEN afp.amount ELSE 0 END) as pending_amount
                FROM additional_fee_types aft
                LEFT JOIN additional_fee_payments afp ON afp.fee_type_id = aft.id
                WHERE aft.school_id = :sid
                  AND aft.name NOT IN ('Transport Fees', 'Admission Fee')
                  AND (aft.category IS NULL OR aft.category != 'System Generated')
                GROUP BY aft.name, aft.due_date, aft.academic_year_id
                ORDER BY id DESC
            ");
            $stmt->execute([':sid' => $schoolId]);
        }
        $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch unique classes and custom amounts for each fee type definition
        $stmtClassAmounts = $pdo->prepare("
            SELECT DISTINCT c.name as class_name, aft.amount 
            FROM additional_fee_types aft
            JOIN additional_fee_payments afp ON afp.fee_type_id = aft.id
            JOIN students s ON s.id = afp.student_id
            JOIN classes c ON c.id = s.class_id
            WHERE aft.name = :name 
              AND ((aft.due_date = :due_date) OR (aft.due_date IS NULL AND :due_date_null IS NULL))
              AND aft.academic_year_id = :ayid 
              AND aft.school_id = :school_id
        ");

        return array_map(function($t) use ($stmtClassAmounts, $activeClassesCount, $schoolId) {
            $t['id'] = (int)$t['id'];
            $t['amount'] = (float)$t['amount'];
            $t['academic_year_id'] = (int)$t['academic_year_id'];
            $t['total_students'] = (int)$t['total_students'];
            $t['collected_students'] = (int)$t['collected_students'];
            $t['pending_students'] = (int)$t['pending_students'];
            
            $t['collected_amount'] = (float)($t['collected_amount'] ?? 0);
            $t['pending_amount'] = (float)($t['pending_amount'] ?? 0);
            $t['total_amount'] = $t['collected_amount'] + $t['pending_amount'];

            // Fetch class names and amounts
            $stmtClassAmounts->execute([
                ':name' => $t['name'],
                ':due_date' => $t['due_date'],
                ':due_date_null' => $t['due_date'],
                ':ayid' => $t['academic_year_id'],
                ':school_id' => $schoolId
            ]);
            $classAmounts = $stmtClassAmounts->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            foreach ($classAmounts as &$ca) {
                $ca['amount'] = (float)$ca['amount'];
            }
            $t['class_amounts'] = $classAmounts;

            $classNames = array_column($classAmounts, 'class_name');
            $typeCount = (int)($t['type_count'] ?? 1);
            $classCount = count($classNames);

            // Determine if assigned to Entire School or Selected Classes
            if ($typeCount > 1) {
                $t['assigned_to'] = 'For Selected Classes';
            } elseif ($activeClassesCount > 0 && $classCount >= $activeClassesCount) {
                $t['assigned_to'] = 'For All Classes';
            } elseif ($classCount === 0) {
                $t['assigned_to'] = 'For All Classes';
            } else {
                $t['assigned_to'] = 'For Selected Classes';
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

    public function createAnnualFee(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['academic_year' => 'No academic year found. Please create an Academic Year first.']);
        }
        $academicYearId = (int)$workingYear['id'];
        $sessionStartDate = $workingYear['start_date'];

        $applyType = $data['apply_type'] ?? 'school'; // 'school' or 'classes'
        $studentsToApply = []; // Array of ['student_id' => int, 'class_id' => int, 'amount' => float]

        if ($applyType === 'school') {
            $amount = isset($data['amount']) ? (float)$data['amount'] : 0.0;
            if ($amount <= 0) {
                throw new ValidationException(['amount' => 'Annual Fee amount must be greater than 0.']);
            }
            if ($amount > 10000000) {
                throw new ValidationException(['amount' => 'Annual Fee amount exceeds system maximum.']);
            }

            // Query active students in current academic year
            // ELIGIBILITY RULE: Annual Fee applies to active students in session (excluding explicit New Admissions).
            $stmtStudents = $pdo->prepare("
                SELECT id, class_id FROM students 
                WHERE school_id = :sid 
                  AND status = 'ACTIVE' 
                  AND academic_year_id = :ayid
                  AND (student_category IS NULL OR student_category = '' OR UPPER(student_category) != 'NEW ADMISSION')
            ");
            $stmtStudents->execute([
                ':sid' => $schoolId,
                ':ayid' => $academicYearId
            ]);
            $studentRows = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

            foreach ($studentRows as $s) {
                $studentsToApply[] = [
                    'student_id' => (int)$s['id'],
                    'class_id'   => (int)$s['class_id'],
                    'amount'     => $amount
                ];
            }
        } else {
            // Selected classes with custom amounts
            if (empty($data['class_amounts']) || !is_array($data['class_amounts'])) {
                throw new ValidationException(['classes' => 'At least one class configuration is required when Class Wise is selected.']);
            }

            foreach ($data['class_amounts'] as $classId => $amt) {
                $classAmt = (float)$amt;
                if ($classAmt <= 0) {
                    continue; // Only configured classes receive fee
                }
                if ($classAmt > 10000000) {
                    throw new ValidationException(['amount' => 'Class fee amount exceeds system maximum.']);
                }

                // Query active eligible students in this class
                $stmtStudents = $pdo->prepare("
                    SELECT id, class_id FROM students 
                    WHERE school_id = :sid 
                      AND class_id = :cid 
                      AND status = 'ACTIVE' 
                      AND academic_year_id = :ayid
                      AND (student_category IS NULL OR student_category = '' OR UPPER(student_category) != 'NEW ADMISSION')
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
                        'class_id'   => (int)$s['class_id'],
                        'amount'     => $classAmt
                    ];
                }
            }
        }

        if (empty($studentsToApply)) {
            throw new ValidationException(['students' => 'No active students found to apply Annual Fee.']);
        }

        // Duplicate Check Rule: check if Annual Fee is already applied in current academic year for any target student
        $stmtDup = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id 
              AND aft.name = 'Annual Fee' 
              AND aft.academic_year_id = :ayid
        ");

        foreach ($studentsToApply as $s) {
            $stmtDup->execute([
                ':student_id' => $s['student_id'],
                ':ayid' => $academicYearId
            ]);
            if ((int)$stmtDup->fetchColumn() > 0) {
                throw new ValidationException(['duplicate' => 'Annual Fees is already added it can not be add again']);
            }
        }

        $pdo->beginTransaction();
        try {
            $classFeeTypeIds = []; // class_id => fee_type_id
            
            if ($applyType === 'school') {
                $stmtType = $pdo->prepare("
                    INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, category)
                    VALUES (:sid, 'Annual Fee', :amount, :ayid, 'Annual Fee')
                ");
                $stmtType->execute([
                    ':sid' => $schoolId,
                    ':amount' => $amount,
                    ':ayid' => $academicYearId
                ]);
                $masterTypeId = (int)$pdo->lastInsertId();
                
                foreach ($studentsToApply as $s) {
                    $classFeeTypeIds[$s['class_id']] = $masterTypeId;
                }
            } else {
                $stmtType = $pdo->prepare("
                    INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, category)
                    VALUES (:sid, 'Annual Fee', :amount, :ayid, 'Annual Fee')
                ");
                
                foreach ($data['class_amounts'] as $classId => $amt) {
                    $classAmt = (float)$amt;
                    if ($classAmt <= 0) continue;

                    $stmtType->execute([
                        ':sid' => $schoolId,
                        ':amount' => $classAmt,
                        ':ayid' => $academicYearId
                    ]);
                    $classFeeTypeIds[$classId] = (int)$pdo->lastInsertId();
                }
            }

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

            $this->log('Annual Fee Created', [
                'school_id' => $schoolId,
                'academic_year_id' => $academicYearId,
                'eligible_students_count' => count($studentsToApply)
            ]);

            return [
                'name' => 'Annual Fee',
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
            $this->syncTransportFees($schoolId, $workingYearId, $pdo);
        }

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

    public function collectAdditionalFeePayment(array $user, int $id, array $data = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id, amount, amount_paid, discount_amount, status FROM additional_fee_payments WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $currentRec = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($currentRec === false) {
            throw new NotFoundException('Fee record not found.');
        }

        $totalAmount = (float)$currentRec['amount'];
        $alreadyPaid = (float)($currentRec['amount_paid'] ?? 0.0);
        $alreadyDiscount = (float)($currentRec['discount_amount'] ?? 0.0);
        $alreadyCleared = $alreadyPaid + $alreadyDiscount;
        $remainingAmount = max(0.0, round($totalAmount - $alreadyCleared, 2));

        if ($remainingAmount <= 0.01 || $currentRec['status'] === 'Paid') {
            throw new ValidationException(['fields' => 'This fee has already been fully paid.']);
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

        $newDiscount = 0.0;
        if (isset($data['discount_amount']) && is_numeric($data['discount_amount'])) {
            $newDiscount = max(0.0, (float)$data['discount_amount']);
        }

        $newDeposit = max(0.0, round($remainingAmount - $newDiscount, 2));
        if (isset($data['amount_paid']) && is_numeric($data['amount_paid'])) {
            $newDeposit = (float)$data['amount_paid'];
        } elseif (isset($data['deposit_amount']) && is_numeric($data['deposit_amount'])) {
            $newDeposit = (float)$data['deposit_amount'];
        }

        $updatedAmountPaid = $alreadyPaid + $newDeposit;
        $updatedDiscountAmount = $alreadyDiscount + $newDiscount;
        $totalPaidSoFar = $updatedAmountPaid + $updatedDiscountAmount;

        if ($totalPaidSoFar >= $totalAmount - 0.01) {
            $newStatus = 'Paid';
        } elseif ($totalPaidSoFar > 0.01) {
            $newStatus = 'Partial';
        } else {
            $newStatus = 'Pending';
        }

        $paymentDate = date('Y-m-d');
        $paymentMethod = !empty($data['payment_method']) ? trim($data['payment_method']) : (!empty($data['payment_mode']) ? trim($data['payment_mode']) : 'Cash');
        $userId = (int) ($user['id'] ?? 0);
        $collectedBy = 'School Admin';
        if ($userId > 0) {
            $stmtUser = $pdo->prepare("SELECT name FROM users WHERE id = :id LIMIT 1");
            $stmtUser->execute([':id' => $userId]);
            $uName = $stmtUser->fetchColumn();
            if ($uName !== false) {
                $collectedBy = $uName;
            }
        }
        $receiptNo = $this->generateUniqueRefNo($pdo);

        $stmtUpdate = $pdo->prepare("
            UPDATE additional_fee_payments 
            SET status = :status, payment_date = :pdate, payment_method = :pmethod, collected_by = :collected_by, receipt_no = :receipt_no, discount_amount = :discount_amount, amount_paid = :amount_paid
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUpdate->execute([
            ':id' => $id,
            ':sid' => $schoolId,
            ':status' => $newStatus,
            ':pdate' => $paymentDate,
            ':pmethod' => $paymentMethod,
            ':collected_by' => $collectedBy,
            ':receipt_no' => $receiptNo,
            ':discount_amount' => $updatedDiscountAmount,
            ':amount_paid' => $updatedAmountPaid
        ]);

        try {
            $stmtInsHistory = $pdo->prepare("
                INSERT INTO additional_fee_payment_history 
                (payment_id, school_id, student_id, amount_paid, discount_amount, payment_method, collected_by, receipt_no, payment_date, created_at)
                VALUES 
                (:pid, :sid, :stid, :amt, :disc, :pmethod, :cby, :rno, :pdate, NOW())
            ");
            $stmtInsHistory->execute([
                ':pid' => $id,
                ':sid' => $schoolId,
                ':stid' => (int)($info['student_id'] ?? $currentRec['student_id']),
                ':amt' => $newDeposit,
                ':disc' => $newDiscount,
                ':pmethod' => $paymentMethod,
                ':cby' => $collectedBy,
                ':rno' => $receiptNo,
                ':pdate' => $paymentDate
            ]);
        } catch (\Throwable $e) {}

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
            $pay['amount'] = (float)($newDeposit + $newDiscount);
            $pay['amount_paid'] = (float)$newDeposit;
            $pay['discount_amount'] = (float)$newDiscount;
            $pay['receipt_no'] = $receiptNo;
            $pay['payment_date'] = $paymentDate;
            $pay['payment_method'] = $paymentMethod;
            $pay['collected_by'] = $collectedBy;
            $pay['is_additional'] = true;

            $feeName = $pay['fee_name'] ?? 'Fee';
            $amtStr = "₹" . number_format((float)$newDeposit, 0);
            $this->sendStudentNotification($pdo, $schoolId, $pay['student_id'], "Fee Deposited", "Your {$feeName} payment of {$amtStr} has been successfully recorded.");
            $this->syncFollowUpStatus($pdo, $pay['student_id'], $schoolId);
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
        if ($this->isTransactionInReport($pdo, $schoolId, $paymentDetails['updated_at']) || $this->isTransactionInReport($pdo, $schoolId, $paymentDetails['payment_date'])) {
            throw new ValidationException(
                ['locked' => 'This action can not be done, This is already included in financial report'],
                'This action can not be done, This is already included in financial report'
            );
        }

        // 2. Writable year check & Outstanding migration lock check
        $stmtGetInfo = $pdo->prepare("
            SELECT s.id AS student_id, s.academic_year_id AS student_ay_id, s.status AS student_status, aft.academic_year_id AS fee_ay_id, aft.name AS fee_name
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
            SET status = 'Pending', payment_date = NULL, receipt_no = NULL, discount_amount = 0.00, amount_paid = 0.00 
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUpdate->execute([
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        try {
            $stmtDelHistory = $pdo->prepare("DELETE FROM additional_fee_payment_history WHERE payment_id = :id AND school_id = :sid");
            $stmtDelHistory->execute([':id' => $id, ':sid' => $schoolId]);
        } catch (\Throwable $e) {}

        if ($info) {
            $studentId = (int)$info['student_id'];
            $feeName = $info['fee_name'] ?? 'Additional Fee';
            $this->sendStudentNotification(
                $pdo, 
                $schoolId, 
                $studentId, 
                "Fee Payment Reverted", 
                "Your {$feeName} payment has been reverted by the school."
            );
        }

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
            WHERE school_id = :sid AND name = :name 
              AND ((due_date = :due_date) OR (due_date IS NULL AND :due_date_null IS NULL)) 
              AND academic_year_id = :ayid
        ");
        $stmtMatches->execute([
            ':sid' => $schoolId,
            ':name' => $ref['name'],
            ':due_date' => $ref['due_date'],
            ':due_date_null' => $ref['due_date'],
            ':ayid' => $ref['academic_year_id']
        ]);
        $typeIds = $stmtMatches->fetchAll(PDO::FETCH_COLUMN);

        if (empty($typeIds)) {
            $typeIds = [(int)$id];
        }

        // Check if any payment is already collected
        $inParams = implode(',', array_fill(0, count($typeIds), '?'));
        $stmtCheck = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments 
            WHERE fee_type_id IN ($inParams) AND status = 'Paid'
        ");
        $stmtCheck->execute($typeIds);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['payments' => 'Cannot delete this fee because some students have already paid.']);
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

    public function getTransportFees(array $user, string $status = 'All'): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $workingYearId = $workingYear ? (int)$workingYear['id'] : null;

        if ($workingYearId === null) {
            return [];
        }

        $this->syncTransportFees($schoolId, $workingYearId, $pdo);

        $sql = "
            SELECT tf.*, s.name AS student_name, s.sr_no, s.roll_no, c.name AS class_name, c.section AS class_section
            FROM student_transport_fees tf
            JOIN students s ON tf.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE tf.school_id = :sid AND tf.academic_year_id = :ayid
        ";

        if (strcasecmp($status, 'All') !== 0) {
            $sql .= " AND tf.status = :status";
        }

        $sql .= " ORDER BY tf.id DESC";

        $stmt = $pdo->prepare($sql);
        $params = [':sid' => $schoolId, ':ayid' => $workingYearId];
        if (strcasecmp($status, 'All') !== 0) {
            $params[':status'] = $status;
        }
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($rows as &$row) {
            $row['monthly_fee'] = (float)$row['monthly_fee'];
            if ($row['status'] === 'Inactive') {
                $row['next_charge'] = 0.0;
            } else {
                $row['next_charge'] = $this->getNextChargeAmount($schoolId, $workingYearId, (int)$row['student_id'], $row['monthly_fee'], $row['start_date'], $pdo);
            }
        }

        return $rows;
    }

    private function getNextChargeAmount(int $schoolId, int $academicYearId, int $studentId, float $monthlyFee, string $startDateStr, PDO $pdo): float
    {
        $stmtType = $pdo->prepare("SELECT id FROM additional_fee_types WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Transport Fees' LIMIT 1");
        $stmtType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $typeId = $stmtType->fetchColumn();

        $currentMonthStr = date('F Y');
        $currentMonthDateStr = date('Y-m-01');

        if ($typeId !== false) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM additional_fee_payments 
                WHERE school_id = :sid AND student_id = :student_id AND fee_type_id = :fee_type_id AND fee_month = :fee_month
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':student_id' => $studentId,
                ':fee_type_id' => (int)$typeId,
                ':fee_month' => $currentMonthStr
            ]);
            $exists = (int)$stmtCheck->fetchColumn() > 0;
            if ($exists) {
                return $monthlyFee;
            }
        }

        return $this->calculateTransportCharge($startDateStr, $monthlyFee, $currentMonthDateStr);
    }

    public function assignTransportFee(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['academic_year' => 'No active academic year found.']);
        }
        $academicYearId = (int)$workingYear['id'];

        $studentId = isset($data['student_id']) ? (int)$data['student_id'] : 0;
        $monthlyFee = isset($data['monthly_fee']) ? (float)$data['monthly_fee'] : 0.0;
        $startDateStr = $data['start_date'] ?? '';
        $status = $data['status'] ?? 'Active';

        if ($studentId <= 0) {
            throw new ValidationException(['student_id' => 'Student is required.']);
        }
        if ($monthlyFee < 0) {
            throw new ValidationException(['monthly_fee' => 'Monthly transport fee cannot be negative.']);
        }
        if (empty($startDateStr)) {
            throw new ValidationException(['start_date' => 'Transport start date is required.']);
        }

        $ayStart = $workingYear['start_date'];
        $ayEnd = $workingYear['end_date'];
        if ($startDateStr < $ayStart || $startDateStr > $ayEnd) {
            throw new ValidationException(['start_date' => 'Start date must be within the active academic year (' . $ayStart . ' to ' . $ayEnd . ').']);
        }

        if ($status === 'Active') {
            $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :ayid AND student_id = :student_id AND status = 'Active'");
            $stmtCheck->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':student_id' => $studentId]);
            if ((int)$stmtCheck->fetchColumn() > 0) {
                throw new ValidationException(['student_id' => 'Student already has an active transport fee assignment.']);
            }
        }

        $stmtIns = $pdo->prepare("
            INSERT INTO student_transport_fees (school_id, academic_year_id, student_id, monthly_fee, start_date, status)
            VALUES (:sid, :ayid, :student_id, :monthly_fee, :start_date, :status)
        ");
        $stmtIns->execute([
            ':sid' => $schoolId,
            ':ayid' => $academicYearId,
            ':student_id' => $studentId,
            ':monthly_fee' => $monthlyFee,
            ':start_date' => $startDateStr,
            ':status' => $status
        ]);
        $id = (int)$pdo->lastInsertId();

        $this->syncTransportFees($schoolId, $academicYearId, $pdo);

        $stmtStuName = $pdo->prepare("SELECT name FROM students WHERE id = :id LIMIT 1");
        $stmtStuName->execute([':id' => $studentId]);
        $studentName = $stmtStuName->fetchColumn();

        $this->log("Assigned transport fee of ₹{$monthlyFee} to student {$studentName}", ['student_id' => $studentId]);

        return ['id' => $id, 'success' => true];
    }

    public function updateTransportFee(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $stmtExist = $pdo->prepare("SELECT * FROM student_transport_fees WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtExist->execute([':id' => $id, ':sid' => $schoolId]);
        $config = $stmtExist->fetch(PDO::FETCH_ASSOC);
        if (!$config) {
            throw new ValidationException(['id' => 'Transport fee config not found.']);
        }

        // Block update if student has already deposited transport fees
        $stmtCheckPaid = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id AND aft.name = 'Transport Fees' AND afp.school_id = :sid AND afp.status != 'Pending'
        ");
        $stmtCheckPaid->execute([':student_id' => (int)$config['student_id'], ':sid' => $schoolId]);
        if ((int)$stmtCheckPaid->fetchColumn() > 0) {
            throw new ValidationException(['monthly_fee' => 'Transport fee cannot be edited because fees have already been deposited.']);
        }

        $monthlyFee = isset($data['monthly_fee']) ? (float)$data['monthly_fee'] : (float)$config['monthly_fee'];
        $startDateStr = $data['start_date'] ?? $config['start_date'];
        $status = $data['status'] ?? $config['status'];
        $academicYearId = (int)$config['academic_year_id'];

        if ($monthlyFee < 0) {
            throw new ValidationException(['monthly_fee' => 'Monthly transport fee cannot be negative.']);
        }

        $stmtAY = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :ayid LIMIT 1");
        $stmtAY->execute([':ayid' => $academicYearId]);
        $ay = $stmtAY->fetch(PDO::FETCH_ASSOC);
        if ($ay) {
            if ($startDateStr < $ay['start_date'] || $startDateStr > $ay['end_date']) {
                throw new ValidationException(['start_date' => 'Start date must be within the academic year (' . $ay['start_date'] . ' to ' . $ay['end_date'] . ').']);
            }
        }

        if ($status === 'Active' && $config['status'] !== 'Active') {
            $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :ayid AND student_id = :student_id AND status = 'Active' AND id != :id");
            $stmtCheck->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':student_id' => $config['student_id'], ':id' => $id]);
            if ((int)$stmtCheck->fetchColumn() > 0) {
                throw new ValidationException(['student_id' => 'Student already has an active transport fee assignment.']);
            }
        }

        $stmtUp = $pdo->prepare("
            UPDATE student_transport_fees 
            SET monthly_fee = :monthly_fee, start_date = :start_date, status = :status
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUp->execute([
            ':id' => $id,
            ':sid' => $schoolId,
            ':monthly_fee' => $monthlyFee,
            ':start_date' => $startDateStr,
            ':status' => $status
        ]);

        $this->syncTransportFees($schoolId, $academicYearId, $pdo);

        return ['success' => true];
    }

    public function deleteTransportFee(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $stmtExist = $pdo->prepare("SELECT * FROM student_transport_fees WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtExist->execute([':id' => $id, ':sid' => $schoolId]);
        $config = $stmtExist->fetch(PDO::FETCH_ASSOC);
        if (!$config) {
            throw new ValidationException(['id' => 'Transport fee config not found.']);
        }

        $stmtCheck = $pdo->prepare("
            SELECT COUNT(*) FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id AND aft.name = 'Transport Fees' AND afp.school_id = :sid
        ");
        $stmtCheck->execute([':student_id' => (int)$config['student_id'], ':sid' => $schoolId]);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            throw new ValidationException(['payments' => 'Transport fee cannot be deleted because billing history already exists.']);
        }

        $stmtDel = $pdo->prepare("DELETE FROM student_transport_fees WHERE id = :id AND school_id = :sid");
        $stmtDel->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function toggleTransportFeeStatus(array $user, int $id, string $status): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->staffRepo->getPdo();
        $this->requireWritableAcademicYear($pdo, $schoolId);

        $stmtExist = $pdo->prepare("SELECT * FROM student_transport_fees WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtExist->execute([':id' => $id, ':sid' => $schoolId]);
        $config = $stmtExist->fetch(PDO::FETCH_ASSOC);
        if (!$config) {
            throw new ValidationException(['id' => 'Transport fee config not found.']);
        }

        $academicYearId = (int)$config['academic_year_id'];

        if ($status === 'Active') {
            $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :ayid AND student_id = :student_id AND status = 'Active' AND id != :id");
            $stmtCheck->execute([':sid' => $schoolId, ':ayid' => $academicYearId, ':student_id' => $config['student_id'], ':id' => $id]);
            if ((int)$stmtCheck->fetchColumn() > 0) {
                throw new ValidationException(['student_id' => 'Student already has an active transport fee assignment.']);
            }
        }

        $stmtUp = $pdo->prepare("UPDATE student_transport_fees SET status = :status WHERE id = :id AND school_id = :sid");
        $stmtUp->execute([':status' => $status, ':id' => $id, ':sid' => $schoolId]);

        $this->syncTransportFees($schoolId, $academicYearId, $pdo);

        return ['success' => true];
    }

    public function calculateProratedAmount(string $startDateStr, float $monthlyAmount, string $targetMonthStr, bool $useActualDays): float
    {
        $startDate = new \DateTime($startDateStr);
        $targetMonthDate = new \DateTime($targetMonthStr);

        $startYearMonth = $startDate->format('Y-m');
        $targetYearMonth = $targetMonthDate->format('Y-m');

        if ($targetYearMonth < $startYearMonth) {
            return 0.0;
        }

        if ($targetYearMonth === $startYearMonth) {
            $startDay = (int)$startDate->format('d');
            if ($startDay === 1) {
                return $monthlyAmount;
            }
            $totalDays = (int)$startDate->format('t');
            $remainingDays = $totalDays - $startDay + 1;
            if ($remainingDays < 0) {
                $remainingDays = 0;
            }
            $divisor = $useActualDays ? (float)$totalDays : 30.0;
            $dailyRate = $monthlyAmount / $divisor;
            return $dailyRate * $remainingDays;
        }

        return $monthlyAmount;
    }

    private function getTargetMonthDateStr(array $workingYear, string $monthName): string
    {
        $ayStart = new \DateTime($workingYear['start_date']);
        $ayStartYear = (int)$ayStart->format('Y');

        $monthsOrder = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $monthIndex = array_search($monthName, $monthsOrder, true);
        if ($monthIndex === false) {
            $monthIndex = 0;
        }

        // January, February, March are in the next calendar year of the academic year
        if ($monthIndex >= 9) {
            $year = $ayStartYear + 1;
        } else {
            $year = $ayStartYear;
        }

        $monthMap = [
            'January' => '01', 'February' => '02', 'March' => '03',
            'April' => '04', 'May' => '05', 'June' => '06',
            'July' => '07', 'August' => '08', 'September' => '09',
            'October' => '10', 'November' => '11', 'December' => '12'
        ];
        $monthNum = $monthMap[$monthName] ?? '01';

        return "{$year}-{$monthNum}-01";
    }

    public function getSalaryProrationDetails(float $monthlySalary, ?string $joiningDateStr, string $paymentMonthName, array $workingYear): array
    {
        $res = [
            'is_prorated' => false,
            'payable_salary' => $monthlySalary,
            'joining_date' => $joiningDateStr,
            'prorated_days' => 0,
            'total_days' => 0,
            'monthly_salary' => $monthlySalary,
            'label' => ''
        ];

        if (!$joiningDateStr) {
            return $res;
        }

        try {
            $joiningDate = new \DateTime($joiningDateStr);
            $targetMonthStr = $this->getTargetMonthDateStr($workingYear, $paymentMonthName);
            $targetMonthDate = new \DateTime($targetMonthStr);

            $joiningYearMonth = $joiningDate->format('Y-m');
            $targetYearMonth = $targetMonthDate->format('Y-m');

            if ($targetYearMonth === $joiningYearMonth) {
                $startDay = (int)$joiningDate->format('d');
                if ($startDay > 1) {
                    $totalDays = (int)$joiningDate->format('t');
                    $remainingDays = $totalDays - $startDay + 1;
                    if ($remainingDays < 0) {
                        $remainingDays = 0;
                    }
                    
                    $proratedAmt = $this->calculateProratedAmount($joiningDateStr, $monthlySalary, $targetMonthStr, true);

                    $res['is_prorated'] = true;
                    $res['payable_salary'] = round($proratedAmt);
                    $res['prorated_days'] = $remainingDays;
                    $res['total_days'] = $totalDays;
                    $res['label'] = 'Prorated Salary';
                }
            } elseif ($targetYearMonth < $joiningYearMonth) {
                $res['payable_salary'] = 0.0;
            }
        } catch (\Exception $e) {
            // ignore
        }

        return $res;
    }

    private function calculateTransportCharge(string $startDateStr, float $monthlyFee, string $targetMonthStr): float
    {
        return round($this->calculateProratedAmount($startDateStr, $monthlyFee, $targetMonthStr, false));
    }

    public function syncTransportFees(int $schoolId, int $academicYearId, ?PDO $externalPdo = null): void
    {
        $pdo = $externalPdo ?: $this->staffRepo->getPdo();

        $stmtAY = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
        $stmtAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
        $ay = $stmtAY->fetch(PDO::FETCH_ASSOC);
        if (!$ay) {
            return;
        }

        $ayStartDate = new \DateTime($ay['start_date']);
        $ayEndDate = new \DateTime($ay['end_date']);
        $currentDate = new \DateTime();

        $targetDate = $currentDate < $ayEndDate ? $currentDate : $ayEndDate;

        $stmtType = $pdo->prepare("SELECT id FROM additional_fee_types WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Transport Fees' LIMIT 1");
        $stmtType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $typeId = $stmtType->fetchColumn();

        if ($typeId === false) {
            $stmtInsType = $pdo->prepare("
                INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, category)
                VALUES (:sid, 'Transport Fees', 0.0, :ayid, 'System Generated')
            ");
            $stmtInsType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
            $typeId = (int)$pdo->lastInsertId();
        } else {
            $typeId = (int)$typeId;
        }

        $stmtConfigs = $pdo->prepare("SELECT * FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :ayid");
        $stmtConfigs->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $configs = $stmtConfigs->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stmtCheck = $pdo->prepare("
            SELECT id FROM additional_fee_payments 
            WHERE school_id = :sid AND student_id = :student_id AND fee_type_id = :fee_type_id AND fee_month = :fee_month 
            LIMIT 1
        ");

        $stmtInsPay = $pdo->prepare("
            INSERT INTO additional_fee_payments (school_id, student_id, fee_type_id, amount, status, fee_month)
            VALUES (:sid, :student_id, :fee_type_id, :amount, 'Pending', :fee_month)
        ");

        $currentMonthStart = new \DateTime(date('Y-m-01'));

        foreach ($configs as $cfg) {
            $studentId = (int)$cfg['student_id'];
            $monthlyFee = (float)$cfg['monthly_fee'];
            $startDateStr = $cfg['start_date'];
            $startDate = new \DateTime($startDateStr);
            $status = $cfg['status'];

            $temp = new \DateTime($startDate->format('Y-m-01'));
            $endTemp = new \DateTime($targetDate->format('Y-m-01'));

            // If config is Inactive, limit generation to current month or month it became inactive (never generate future months)
            if ($status === 'Inactive') {
                $inactiveCap = $currentMonthStart;
                if (!empty($cfg['updated_at'])) {
                    $upDate = new \DateTime($cfg['updated_at']);
                    $upMonth = new \DateTime($upDate->format('Y-m-01'));
                    if ($upMonth < $inactiveCap) {
                        $inactiveCap = $upMonth;
                    }
                }
                if ($endTemp > $inactiveCap) {
                    $endTemp = $inactiveCap;
                }
            }

            while ($temp <= $endTemp) {
                $tempStart = new \DateTime($temp->format('Y-m-01'));
                $tempEnd = new \DateTime($temp->format('Y-m-t'));

                if ($tempEnd >= $ayStartDate && $tempStart <= $ayEndDate) {
                    $monthStr = $temp->format('F Y');
                    $monthDateStr = $temp->format('Y-m-d');

                    $stmtCheck->execute([
                        ':sid' => $schoolId,
                        ':student_id' => $studentId,
                        ':fee_type_id' => $typeId,
                        ':fee_month' => $monthStr
                    ]);
                    $existingPaymentId = $stmtCheck->fetchColumn();

                    if ($existingPaymentId === false) {
                        $amount = $this->calculateTransportCharge($startDateStr, $monthlyFee, $monthDateStr);
                        if ($amount > 0) {
                            $stmtInsPay->execute([
                                ':sid' => $schoolId,
                                ':student_id' => $studentId,
                                ':fee_type_id' => $typeId,
                                ':amount' => $amount,
                                ':fee_month' => $monthStr
                            ]);
                        }
                    } else {
                        // Payment exists - check if it is Pending and needs update
                        $stmtGetPay = $pdo->prepare("SELECT id, status, amount FROM additional_fee_payments WHERE id = :id LIMIT 1");
                        $stmtGetPay->execute([':id' => $existingPaymentId]);
                        $payRow = $stmtGetPay->fetch(PDO::FETCH_ASSOC);
                        
                        if ($payRow && $payRow['status'] === 'Pending') {
                            $newAmount = $this->calculateTransportCharge($startDateStr, $monthlyFee, $monthDateStr);
                            if ($newAmount <= 0) {
                                // Delete if no longer applicable
                                $stmtDel = $pdo->prepare("DELETE FROM additional_fee_payments WHERE id = :id");
                                $stmtDel->execute([':id' => $existingPaymentId]);
                            } elseif (round((float)$payRow['amount']) !== round((float)$newAmount)) {
                                // Update if amount changed
                                $stmtUpPay = $pdo->prepare("UPDATE additional_fee_payments SET amount = :amount WHERE id = :id");
                                $stmtUpPay->execute([':amount' => $newAmount, ':id' => $existingPaymentId]);
                            }
                        }
                    }
                }
                $temp->modify('+1 month');
            }
        }
    }

    private function isTransactionInReport(\PDO $pdo, int $schoolId, ?string $txTime): bool
    {
        if (empty($txTime) || $txTime === '-') return false;
        $txVal = strtotime($txTime);
        if ($txVal === false || $txVal <= 0) return false;

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
        if ($schoolId <= 0) {
            return [];
        }

        $pdo = $this->classRepo->getPdo();
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        $stmt = $pdo->prepare("SELECT * FROM holidays WHERE school_id = :sid ORDER BY date ASC");
        $stmt->execute([':sid' => $schoolId]);
        $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($holidays) === 0 && $workingYear) {
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
            $stmt->execute([':sid' => $schoolId]);
            $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return $holidays;
    }

    public function createHoliday(array $user, array $body): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        if (empty($body['name'])) {
            throw new ValidationException(['name' => 'Holiday title is required.']);
        }

        $startDate = trim((string)($body['start_date'] ?? $body['date'] ?? ''));
        $endDate = trim((string)($body['end_date'] ?? $startDate));

        if (empty($startDate)) {
            throw new ValidationException(['date' => 'Holiday start date is required.']);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            throw new ValidationException(['date' => 'Invalid start date format.']);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            throw new ValidationException(['end_date' => 'Invalid end date format.']);
        }
        if ($endDate < $startDate) {
            throw new ValidationException(['end_date' => 'End date cannot be before start date.']);
        }

        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        if (!$workingYear) {
            throw new ValidationException(['date' => 'No active Academic Year found.']);
        }

        if ($startDate < $workingYear['start_date'] || $endDate > $workingYear['end_date']) {
            throw new ValidationException(['date' => "Holiday dates must be within the academic year ({$workingYear['start_date']} to {$workingYear['end_date']})."]);
        }

        // Generate consecutive dates from $startDate to $endDate
        $datesToCreate = [];
        $curr = strtotime($startDate);
        $last = strtotime($endDate);
        while ($curr <= $last) {
            $datesToCreate[] = date('Y-m-d', $curr);
            $curr = strtotime('+1 day', $curr);
        }

        $holidayName = trim($body['name']);
        $stmtInsert = $pdo->prepare("INSERT INTO holidays (school_id, academic_year_id, name, date) VALUES (:sid, :yid, :name, :date)");
        $stmtCheck = $pdo->prepare("SELECT id FROM holidays WHERE school_id = :sid AND date = :date LIMIT 1");

        $firstHolidayId = 0;
        $createdDates = [];

        foreach ($datesToCreate as $d) {
            $stmtCheck->execute([':sid' => $schoolId, ':date' => $d]);
            if ($stmtCheck->fetchColumn() === false) {
                $stmtInsert->execute([
                    ':sid' => $schoolId,
                    ':yid' => (int)$workingYear['id'],
                    ':name' => $holidayName,
                    ':date' => $d
                ]);
                $lastId = (int)$pdo->lastInsertId();
                if ($firstHolidayId === 0) {
                    $firstHolidayId = $lastId;
                }
                $createdDates[] = $d;
            }
        }

        if (empty($createdDates)) {
            throw new ValidationException(['date' => 'Holidays already exist for the selected date(s).']);
        }

        // Send push/dashboard notifications to TEACHER, STUDENT, and PARENT roles
        $stmtUsers = $pdo->prepare("
            SELECT id, role FROM users 
            WHERE school_id = :sid AND role IN ('TEACHER', 'STUDENT', 'PARENT') AND status = 'ACTIVE'
        ");
        $stmtUsers->execute([':sid' => $schoolId]);
        $usersToNotify = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($usersToNotify)) {
            $formattedStart = date('d F Y', strtotime($startDate));
            $formattedEnd = date('d F Y', strtotime($endDate));
            $title = "New School Holiday";
            $message = ($startDate === $endDate)
                ? "{$holidayName} has been added.\n{$formattedStart}"
                : "{$holidayName} has been added (" . count($createdDates) . " days).\n{$formattedStart} to {$formattedEnd}";

            $stmtNotif = $pdo->prepare("
                INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, is_read)
                VALUES (:sid, :role, :uid, :title, :msg, :link, 0)
            ");

            foreach ($usersToNotify as $utn) {
                $link = '';
                if ($utn['role'] === 'TEACHER') {
                    $link = '/teacher/leaves';
                } elseif ($utn['role'] === 'PARENT') {
                    $link = '/parent/leaves';
                } elseif ($utn['role'] === 'STUDENT') {
                    $link = '/student/leaves';
                }

                $stmtNotif->execute([
                    ':sid' => $schoolId,
                    ':role' => $utn['role'],
                    ':uid' => $utn['id'],
                    ':title' => $title,
                    ':msg' => $message,
                    ':link' => $link
                ]);
            }
        }

        return [
            'id' => $firstHolidayId,
            'name' => $holidayName,
            'date' => $startDate,
            'count' => count($createdDates)
        ];
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

        if ($academicYearId > 0) {
            $this->autoSeedDefaultSessionExams($pdo, $schoolId, $academicYearId);
        }

        $stmt = $pdo->prepare("
            SELECT e.*,
                   (SELECT COUNT(*) FROM examination_papers ep WHERE ep.exam_id = e.id) as papers_count
            FROM examinations e 
            WHERE e.school_id = :sid AND e.academic_year_id = :ayid
            ORDER BY 
              CASE 
                WHEN LOWER(e.name) LIKE '%quarterly%' THEN 1 
                WHEN LOWER(e.name) LIKE '%half%' THEN 2 
                WHEN LOWER(e.name) LIKE '%annual%' THEN 3 
                ELSE 4 
              END ASC, e.id ASC
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
    }

    public function autoSeedDefaultSessionExams(\PDO $pdo, int $schoolId, int $academicYearId): void
    {
        try {
            $pdo->exec("ALTER TABLE examinations MODIFY start_date DATE NULL, MODIFY end_date DATE NULL, MODIFY publish_date DATE NULL");
        } catch (\Throwable $t) {
            // Ignore if already nullable or structure modified
        }
        $stmtYear = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :ayid LIMIT 1");
        $stmtYear->execute([':ayid' => $academicYearId]);
        $year = $stmtYear->fetch(\PDO::FETCH_ASSOC);

        $startYear = $year && !empty($year['start_date']) ? (int)date('Y', strtotime($year['start_date'])) : (int)date('Y');
        $endYear = $year && !empty($year['end_date']) ? (int)date('Y', strtotime($year['end_date'])) : ($startYear + 1);

        $defaultExams = [
            [
                'name' => 'Quarterly Examination',
                'start_date' => null,
                'end_date' => null,
                'publish_date' => null,
                'description' => 'First quarter evaluation of academic performance.'
            ],
            [
                'name' => 'Half Yearly Examination',
                'start_date' => null,
                'end_date' => null,
                'publish_date' => null,
                'description' => 'Mid-term evaluation of academic performance.'
            ],
            [
                'name' => 'Annual Examination',
                'start_date' => null,
                'end_date' => null,
                'publish_date' => null,
                'description' => 'Final cumulative examination of the academic session.'
            ]
        ];

        $stmtInsert = $pdo->prepare("
            INSERT INTO examinations (school_id, academic_year_id, name, start_date, end_date, publish_date, description, status)
            VALUES (:sid, :ayid, :name, :start_date, :end_date, :publish_date, :description, 'Draft')
        ");

        foreach ($defaultExams as $ex) {
            $keyword = explode(' ', $ex['name'])[0];
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM examinations 
                WHERE school_id = :sid AND academic_year_id = :ayid AND LOWER(name) LIKE LOWER(:name)
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':ayid' => $academicYearId,
                ':name' => '%' . $keyword . '%'
            ]);
            if ((int)$stmtCheck->fetchColumn() === 0) {
                $stmtInsert->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $academicYearId,
                    ':name' => $ex['name'],
                    ':start_date' => null,
                    ':end_date' => null,
                    ':publish_date' => null,
                    ':description' => $ex['description']
                ]);
            }
        }

        // Reset old hardcoded default dates to NULL if unedited
        $stmtReset = $pdo->prepare("
            UPDATE examinations 
            SET start_date = NULL, end_date = NULL, publish_date = NULL
            WHERE school_id = :sid AND academic_year_id = :ayid 
              AND (
                (name = 'Quarterly Examination' AND start_date LIKE '%-08-01') OR
                (name = 'Half Yearly Examination' AND start_date LIKE '%-11-01') OR
                (name = 'Annual Examination' AND start_date LIKE '%-03-01')
              )
        ");
        $stmtReset->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
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

        if (strcasecmp((string)($data['status'] ?? ''), 'Published') === 0) {
            $this->notifyExamScheduled($pdo, $schoolId, $name, $startDate, $endDate);
        }
        
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
        $startDate = !empty($data['start_date']) ? $data['start_date'] : (array_key_exists('start_date', $data) ? null : $exam['start_date']);
        $endDate = !empty($data['end_date']) ? $data['end_date'] : (array_key_exists('end_date', $data) ? null : $exam['end_date']);
        $publishDate = !empty($data['publish_date']) ? $data['publish_date'] : (array_key_exists('publish_date', $data) ? null : $exam['publish_date']);
        $description = array_key_exists('description', $data) ? $data['description'] : $exam['description'];
        $status = $data['status'] ?? $exam['status'];

        if (empty($name)) {
            throw new ValidationException(['name' => 'Examination Name is required.']);
        }

        if (strcasecmp((string)$status, 'Published') === 0) {
            $s = trim((string)($startDate ?? ''));
            $e = trim((string)($endDate ?? ''));
            if ($s === '' || $s === '-' || $e === '' || $e === '-') {
                throw new ValidationException(['start_date' => 'Start Date and End Date are required to publish an examination.'], 'Start Date and End Date are required to publish an examination.');
            }
        }

        if (!empty($startDate) && !empty($endDate) && $endDate < $startDate) {
            throw new ValidationException(['end_date' => 'End Date cannot be before Start Date.']);
        }
        if (!empty($endDate) && !empty($publishDate) && $publishDate < $endDate) {
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
        if (!empty($startDate) && !empty($endDate)) {
            $stmtOverlap = $pdo->prepare("
                SELECT COUNT(*) FROM examinations
                WHERE school_id = :sid AND academic_year_id = :ayid AND id != :id
                  AND start_date IS NOT NULL AND end_date IS NOT NULL
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

        $datesChanged = ($startDate !== $exam['start_date']) || ($endDate !== $exam['end_date']);
        if ($datesChanged && !empty($data['reset_papers'])) {
            $stmtDelMarks = $pdo->prepare("DELETE FROM examination_marks WHERE exam_id = :id");
            $stmtDelMarks->execute([':id' => $id]);

            $stmtDelStatus = $pdo->prepare("DELETE FROM examination_class_status WHERE exam_id = :id");
            $stmtDelStatus->execute([':id' => $id]);

            $stmtDelPapers = $pdo->prepare("DELETE FROM examination_papers WHERE exam_id = :id");
            $stmtDelPapers->execute([':id' => $id]);
        }

        if ($status === 'Draft' && $exam['status'] === 'Published') {
            $stmtClassReset = $pdo->prepare("
                UPDATE examination_class_status 
                SET status = 'Draft', publish_date = NULL 
                WHERE exam_id = :exam_id
            ");
            $stmtClassReset->execute([':exam_id' => $id]);
        }

        $wasPublished = (strcasecmp((string)$exam['status'], 'Published') === 0);
        $isNowPublished = (strcasecmp((string)$status, 'Published') === 0);

        if (!$wasPublished && $isNowPublished && !empty($startDate) && !empty($endDate)) {
            $this->notifyExamScheduled($pdo, $schoolId, $name, $startDate, $endDate);
        }
    }

    private function notifyExamScheduled(\PDO $pdo, int $schoolId, string $examName, ?string $startDate, ?string $endDate): void
    {
        if (empty($startDate) || empty($endDate) || $startDate === '-' || $endDate === '-') {
            return;
        }

        $formatDate = function($dateStr) {
            try {
                $dt = new \DateTime($dateStr);
                return $dt->format('j M Y');
            } catch (\Throwable $e) {
                return $dateStr;
            }
        };

        $formattedStart = $formatDate($startDate);
        $formattedEnd = $formatDate($endDate);

        $title = "Examination Scheduled: {$examName}";
        $message = "{$examName} has been scheduled from {$formattedStart} to {$formattedEnd}. Tap to view examination schedule.";
        $link = "/exams";

        $roles = ['TEACHER', 'STUDENT', 'PARENT'];
        foreach ($roles as $role) {
            $stmtCheck = $pdo->prepare("
                SELECT COUNT(*) FROM dashboard_notifications
                WHERE school_id = :sid AND user_role = :role AND title = :title AND message = :msg
                  AND created_at >= NOW() - INTERVAL 10 SECOND
            ");
            $stmtCheck->execute([
                ':sid' => $schoolId,
                ':role' => $role,
                ':title' => $title,
                ':msg' => $message
            ]);
            if ((int)$stmtCheck->fetchColumn() === 0) {
                $stmtIns = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, category, event_key, is_read)
                    VALUES (:sid, :role, :title, :msg, :link, 'EXAM', 'EXAM_SCHEDULED', 0)
                ");
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':role' => $role,
                    ':title' => $title,
                    ':msg' => $message,
                    ':link' => $link
                ]);
            }

            // Dispatch Push Notification to all users of this role in the school
            PushDispatcher::pushOnly($pdo, $schoolId, $role, null, 'EXAM_SCHEDULED', $title, $message, $link);
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
                (SELECT COUNT(*) FROM students stud WHERE stud.class_id = ep.class_id AND stud.school_id = :sid_student) AS total_students,
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
            $isGrade = (isset($p1['evaluation_type']) && $p1['evaluation_type'] === 'grade') || 
                       (isset($p1['max_marks']) && ((float)$p1['max_marks'] === 0.0 || $p1['max_marks'] === '0' || $p1['max_marks'] === 0));

            if (
                empty($p1['subject_id']) || 
                empty($p1['exam_date']) || 
                empty($p1['start_time']) || 
                empty($p1['end_time']) || 
                (!$isGrade && (!isset($p1['max_marks']) || $p1['max_marks'] === '' || $p1['max_marks'] === null)) ||
                (!$isGrade && (!isset($p1['passing_marks']) || $p1['passing_marks'] === '' || $p1['passing_marks'] === null))
            ) {
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
                INSERT INTO examination_papers (exam_id, class_id, subject_id, exam_date, start_time, end_time, max_marks, passing_marks, room)
                VALUES (:exam_id, :class_id, :subid, :edate, :stime, :etime, :maxm, :passm, :room)
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
                    ':room' => !empty($p['room']) ? $p['room'] : null
                ]);
            }

            // Ensure examination_class_status record exists without force-setting scheme_published
            $stmtStatus = $pdo->prepare("
                INSERT INTO examination_class_status (exam_id, class_id, status, updated_at)
                VALUES (:exam_id, :class_id, 'Draft', NOW())
                ON DUPLICATE KEY UPDATE updated_at = NOW()
            ");
            $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);

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
            WHERE class_id = :cid AND school_id = :sid 
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
            $valObtained = $m['marks_obtained'];
            if ($valObtained !== null && $valObtained !== '') {
                $valObtained = is_numeric($valObtained) ? (float)$valObtained : (string)$valObtained;
            } else {
                $valObtained = null;
            }

            $list[] = [
                'student_id' => $studentId,
                'student_name' => $s['name'],
                'roll_no' => $s['roll_no'],
                'marks_obtained' => $valObtained,
                'is_absent' => (int)$m['is_absent'],
                'remarks' => $m['remarks'] ?: ''
            ];
        }

        // Fetch Class Exam status
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $classStatus = $stmtStatus->fetchColumn() ?: 'Draft';

        $isGradePaper = ((float)$paper['max_marks'] === 0.0);

        return [
            'exam_name' => $exam['name'],
            'status' => $classStatus,
            'evaluation_type' => $isGradePaper ? 'grade' : 'marks',
            'max_marks' => (float)$paper['max_marks'],
            'passing_marks' => (float)$paper['passing_marks'],
            'students' => $list
        ];
    }

    public function saveExamMark(array $user, int $examId, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Ensure database column supports string grades (e.g. 'A+', 'A')
        try {
            $pdo->exec("ALTER TABLE examination_marks MODIFY COLUMN marks_obtained VARCHAR(50) DEFAULT NULL");
        } catch (\Throwable $t) {}

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
        
        $rawMarks = isset($data['marks_obtained']) && $data['marks_obtained'] !== '' && !$isAbsent ? $data['marks_obtained'] : null;
        if ($rawMarks !== null) {
            $marksObtained = is_numeric($rawMarks) ? (float)$rawMarks : (string)$rawMarks;
        } else {
            $marksObtained = null;
        }
        $remarks = $data['remarks'] ?? null;

        // Fetch student's class to verify publish status
        $stmtStudClass = $pdo->prepare("SELECT class_id FROM students WHERE id = :sid LIMIT 1");
        $stmtStudClass->execute([':sid' => $studentId]);
        $classId = (int)$stmtStudClass->fetchColumn();

        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        if ($stmtStatus->fetchColumn() === 'Published') {
            throw new ValidationException(['status' => 'Cannot edit marks of a published class examination.'], 'Cannot edit marks of a published class examination.');
        }

        // Fetch Paper Details
        $stmtPaper = $pdo->prepare("SELECT * FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id AND subject_id = :subid LIMIT 1");
        $stmtPaper->execute([':exam_id' => $examId, ':class_id' => $classId, ':subid' => $subjectId]);
        $paper = $stmtPaper->fetch(PDO::FETCH_ASSOC);
        if (!$paper) {
            throw new ValidationException(['subject_id' => 'Subject is not scheduled in the exam timetable.']);
        }

        $isGradePaper = (isset($paper['evaluation_type']) && $paper['evaluation_type'] === 'grade') || ((float)$paper['max_marks'] === 0.0);

        if ($marksObtained !== null && !$isGradePaper && is_numeric($marksObtained)) {
            $numVal = (float)$marksObtained;
            if ($numVal < 0) {
                throw new ValidationException(['marks_obtained' => 'Negative marks are not allowed.']);
            }
            if ($numVal > (float)$paper['max_marks']) {
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

        $stmtCheck = $pdo->prepare("SELECT id, name, academic_year_id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // Complete result validation check
        if ($status === 'Published') {
            $classesToValidate = $classId > 0 ? [$classId] : [];
            if ($classId === 0) {
                $stmtClasses = $pdo->prepare("
                    SELECT id FROM classes 
                    WHERE school_id = :sid AND academic_year_id = :ay_id
                ");
                $stmtClasses->execute([':sid' => $schoolId, ':ay_id' => $exam['academic_year_id']]);
                $classesToValidate = $stmtClasses->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }

            foreach ($classesToValidate as $cId) {
                // Get students count
                $stmtSt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE class_id = :class_id AND school_id = :sid");
                $stmtSt->execute([':class_id' => $cId, ':sid' => $schoolId]);
                $studentCount = (int)$stmtSt->fetchColumn();

                // Get papers count
                $stmtPp = $pdo->prepare("SELECT COUNT(*) FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id");
                $stmtPp->execute([':exam_id' => $examId, ':class_id' => $cId]);
                $paperCount = (int)$stmtPp->fetchColumn();

                if ($studentCount === 0 || $paperCount === 0) {
                    throw new ValidationException(['message' => 'Complete result generation before publishing.']);
                }

                // Get marks count
                $stmtMk = $pdo->prepare("
                    SELECT COUNT(*) FROM examination_marks em
                    JOIN examination_papers ep ON em.paper_id = ep.id
                    WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
                ");
                $stmtMk->execute([':exam_id' => $examId, ':class_id' => $cId]);
                $marksCount = (int)$stmtMk->fetchColumn();

                if ($marksCount < ($studentCount * $paperCount)) {
                    throw new ValidationException(['message' => 'Complete result generation before publishing.']);
                }
            }
        }

        $classes = [];
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

            if ($status === 'Published') {
                $stmtUpd = $pdo->prepare("UPDATE examinations SET status = 'Published', publish_date = IF(publish_date IS NULL, CURRENT_DATE(), publish_date) WHERE id = :id");
                $stmtUpd->execute([':id' => $examId]);
            } else {
                $stmtCheckPublished = $pdo->prepare("SELECT COUNT(*) FROM examination_class_status WHERE exam_id = :exam_id AND status = 'Published'");
                $stmtCheckPublished->execute([':exam_id' => $examId]);
                if ((int)$stmtCheckPublished->fetchColumn() === 0) {
                    $stmtUpd = $pdo->prepare("UPDATE examinations SET status = 'Draft' WHERE id = :id");
                    $stmtUpd->execute([':id' => $examId]);
                }
            }
            
            // Audit Log & Notification for single class
            $stmtInfo = $pdo->prepare("SELECT name AS class_name, (SELECT name FROM academic_years WHERE id = :ay_id) AS academic_year_name FROM classes WHERE id = :class_id LIMIT 1");
            $stmtInfo->execute([':ay_id' => $exam['academic_year_id'], ':class_id' => $classId]);
            $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);
            $className = $info ? $info['class_name'] : '';
            $ayName = $info ? $info['academic_year_name'] : '';

            $actionText = $status === 'Published' ? 'Publish Results' : 'Unpublish Results';
            $descText = $status === 'Published' ? "Published Results for exam '{$exam['name']}' (Class: {$className})" : "Unpublished Results for exam '{$exam['name']}' (Class: {$className})";
            $this->logAudit($pdo, $user, 'Examinations', $actionText, $descText, $ayName);

            if ($status === 'Published') {
                $this->sendExamNotification($pdo, $schoolId, $examId, $classId, 'RESULT', $exam['name']);
            }
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
            $classes = $stmtClasses->fetchAll(PDO::FETCH_COLUMN) ?: [];

            $stmtInfo = $pdo->prepare("SELECT name FROM academic_years WHERE id = :ay_id LIMIT 1");
            $stmtInfo->execute([':ay_id' => $exam['academic_year_id']]);
            $ayName = $stmtInfo->fetchColumn() ?: '';

            $actionText = $status === 'Published' ? 'Publish Results' : 'Unpublish Results';
            $descText = $status === 'Published' ? "Published Results for exam '{$exam['name']}' (All Classes)" : "Unpublished Results for exam '{$exam['name']}' (All Classes)";
            $this->logAudit($pdo, $user, 'Examinations', $actionText, $descText, $ayName);

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

                if ($status === 'Published') {
                    $this->sendExamNotification($pdo, $schoolId, $examId, (int)$cId, 'RESULT', $exam['name']);
                }
            }
        }
    }

    public function publishExamScheme(array $user, int $examId, int $classId): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // 1. Check exam exists
        $stmtCheck = $pdo->prepare("SELECT id, name, academic_year_id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // 2. Check at least 1 paper is scheduled
        $stmtCountPapers = $pdo->prepare("SELECT COUNT(*) FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id");
        $stmtCountPapers->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $scheduledPapers = (int)$stmtCountPapers->fetchColumn();

        if ($scheduledPapers === 0) {
            throw new ValidationException(['message' => 'Please add at least one exam paper before publishing.']);
        }

        // 3. Update/Insert in examination_class_status
        $stmt = $pdo->prepare("
            INSERT INTO examination_class_status (exam_id, class_id, scheme_published)
            VALUES (:exam_id, :class_id, 1)
            ON DUPLICATE KEY UPDATE scheme_published = 1
        ");
        $stmt->execute([
            ':exam_id' => $examId,
            ':class_id' => $classId
        ]);

        // 4. Fetch additional info for audit logging
        $stmtInfo = $pdo->prepare("
            SELECT c.name AS class_name, ay.name AS academic_year_name
            FROM classes c
            JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.id = :class_id
            LIMIT 1
        ");
        $stmtInfo->execute([':class_id' => $classId]);
        $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);
        $className = $info ? $info['class_name'] : '';
        $ayName = $info ? $info['academic_year_name'] : '';

        // 5. Log audit
        $this->logAudit($pdo, $user, 'Examinations', 'Publish Scheme', "Published Scheme for exam '{$exam['name']}' (Class: {$className})", $ayName);

        // 6. Send notifications
        $this->sendExamNotification($pdo, $schoolId, $examId, $classId, 'SCHEME', $exam['name']);
    }

    public function publishExamAdmitCards(array $user, int $examId, int $classId): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // 1. Check exam exists
        $stmtCheck = $pdo->prepare("SELECT id, name, academic_year_id FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // 2. Verify seating plan has been generated for this class
        $stmtCountAllocations = $pdo->prepare("
            SELECT COUNT(*) 
            FROM examination_seating_allocations esa
            JOIN students s ON esa.student_id = s.id
            JOIN examination_seating_plans esp ON esa.seating_plan_id = esp.id
            WHERE esp.exam_id = :exam_id AND s.class_id = :class_id AND s.school_id = :sid
        ");
        $stmtCountAllocations->execute([':exam_id' => $examId, ':class_id' => $classId, ':sid' => $schoolId]);
        $allocationsCount = (int)$stmtCountAllocations->fetchColumn();

        if ($allocationsCount === 0) {
            throw new ValidationException(['message' => 'Generate the seating plan before publishing admit cards.']);
        }

        // 3. Update/Insert in examination_class_status
        $stmt = $pdo->prepare("
            INSERT INTO examination_class_status (exam_id, class_id, admit_card_published)
            VALUES (:exam_id, :class_id, 1)
            ON DUPLICATE KEY UPDATE admit_card_published = 1
        ");
        $stmt->execute([
            ':exam_id' => $examId,
            ':class_id' => $classId
        ]);

        // 4. Fetch additional info for audit logging
        $stmtInfo = $pdo->prepare("
            SELECT c.name AS class_name, ay.name AS academic_year_name
            FROM classes c
            JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.id = :class_id
            LIMIT 1
        ");
        $stmtInfo->execute([':class_id' => $classId]);
        $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);
        $className = $info ? $info['class_name'] : '';
        $ayName = $info ? $info['academic_year_name'] : '';

        // 5. Log audit
        $this->logAudit($pdo, $user, 'Examinations', 'Publish Admit Cards', "Published Admit Cards for exam '{$exam['name']}' (Class: {$className})", $ayName);

        // 6. Send notifications
        $this->sendExamNotification($pdo, $schoolId, $examId, $classId, 'ADMIT_CARD', $exam['name']);
    }

    public function unpublishExamScheme(array $user, int $examId, int $classId): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // 1. Check exam exists
        $stmtCheck = $pdo->prepare("SELECT id, name FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // 2. Update status in examination_class_status
        if ($classId > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO examination_class_status (exam_id, class_id, scheme_published)
                VALUES (:exam_id, :class_id, 0)
                ON DUPLICATE KEY UPDATE scheme_published = 0
            ");
            $stmt->execute([
                ':exam_id' => $examId,
                ':class_id' => $classId
            ]);
        } else {
            $stmt = $pdo->prepare("UPDATE examination_class_status SET scheme_published = 0 WHERE exam_id = :exam_id");
            $stmt->execute([':exam_id' => $examId]);
        }

        // 3. Log audit
        $stmtInfo = $pdo->prepare("
            SELECT c.name AS class_name, ay.name AS academic_year_name
            FROM classes c
            JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.id = :class_id
            LIMIT 1
        ");
        $stmtInfo->execute([':class_id' => $classId]);
        $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);
        $className = $info ? $info['class_name'] : ($classId > 0 ? '' : 'All Classes');
        $ayName = $info ? $info['academic_year_name'] : '';

        $this->logAudit($pdo, $user, 'Examinations', 'Unpublish Scheme', "Reverted Scheme to Draft for exam '{$exam['name']}' (Class: {$className})", $ayName);

        // 4. Send unpublish notification
        $this->sendExamNotification($pdo, $schoolId, $examId, $classId, 'UNPUBLISH_SCHEME', $exam['name']);
    }

    public function unpublishExamAdmitCards(array $user, int $examId, int $classId): void
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // 1. Check exam exists
        $stmtCheck = $pdo->prepare("SELECT id, name FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // 2. Update status in examination_class_status
        if ($classId > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO examination_class_status (exam_id, class_id, admit_card_published)
                VALUES (:exam_id, :class_id, 0)
                ON DUPLICATE KEY UPDATE admit_card_published = 0
            ");
            $stmt->execute([
                ':exam_id' => $examId,
                ':class_id' => $classId
            ]);
        } else {
            $stmt = $pdo->prepare("UPDATE examination_class_status SET admit_card_published = 0 WHERE exam_id = :exam_id");
            $stmt->execute([':exam_id' => $examId]);
        }

        // 3. Log audit
        $stmtInfo = $pdo->prepare("
            SELECT c.name AS class_name, ay.name AS academic_year_name
            FROM classes c
            JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.id = :class_id
            LIMIT 1
        ");
        $stmtInfo->execute([':class_id' => $classId]);
        $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);
        $className = $info ? $info['class_name'] : '';
        $ayName = $info ? $info['academic_year_name'] : '';

        $this->logAudit($pdo, $user, 'Examinations', 'Unpublish Admit Cards', "Reverted Admit Cards to Draft for exam '{$exam['name']}' (Class: {$className})", $ayName);

        // 4. Send unpublish notification
        $this->sendExamNotification($pdo, $schoolId, $examId, $classId, 'UNPUBLISH_ADMIT_CARD', $exam['name']);
    }

    private function sendExamNotification(PDO $pdo, int $schoolId, int $examId, int $classId, string $type, string $examName): void
    {
        $className = '';
        if ($classId > 0) {
            $stmtClass = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
            $stmtClass->execute([':cid' => $classId]);
            $cRow = $stmtClass->fetch(PDO::FETCH_ASSOC);
            if ($cRow) {
                $className = trim(($cRow['name'] ?? '') . ' ' . ($cRow['section'] ?? ''));
            }
        }

        $title = $examName;
        $message = '';
        $link = '/exams';
        $eventKey = 'EXAM_SCHEDULED';

        if ($type === 'SCHEME') {
            $eventKey = 'EXAM_SCHEME_PUBLISHED';
            $title = $examName . " - Exam Scheme";
            $message = $className !== '' 
                ? "The examination scheme for {$className} has been published. Tap to view schedule."
                : "The examination scheme has been published. Tap to view schedule.";
        } elseif ($type === 'ADMIT_CARD') {
            $eventKey = 'EXAM_ADMIT_CARD_PUBLISHED';
            $title = $examName . " - Admit Card";
            $message = $className !== '' 
                ? "Your admit card for {$className} has been published. Tap here to view or download."
                : "Your admit card has been published. Tap here to view or download.";
        } elseif ($type === 'RESULT') {
            $eventKey = 'EXAM_RESULT_PUBLISHED';
            $title = $examName . " - Report Card";
            $message = $className !== '' 
                ? "The report card / examination result for {$className} has been published. Tap here to view."
                : "The report card / examination result has been published. Tap here to view.";
        } elseif ($type === 'UNPUBLISH_SCHEME') {
            $eventKey = 'EXAM_SCHEME_UNPUBLISHED';
            $title = $examName . " - Exam Scheme Update";
            $message = "The examination scheme has been reverted to draft. Please stay tuned for updates.";
        } elseif ($type === 'UNPUBLISH_ADMIT_CARD') {
            $eventKey = 'EXAM_ADMIT_CARD_UNPUBLISHED';
            $title = $examName . " - Admit Card Update";
            $message = "Your admit card has been reverted to draft. Please stay tuned for updates.";
        }

        // Get student and parent user IDs in the class (Deduplicated)
        $stmtUsers = $pdo->prepare("
            SELECT DISTINCT u.id AS user_id, u.role
            FROM users u
            JOIN students s ON s.class_id = :class_id AND s.school_id = u.school_id
            WHERE u.school_id = :school_id
              AND (
                (u.role = 'STUDENT' AND (
                    (s.student_mobile IS NOT NULL AND s.student_mobile != '' AND u.phone = s.student_mobile) OR
                    (s.parent_phone IS NOT NULL AND s.parent_phone != '' AND u.phone = s.parent_phone) OR
                    (s.father_phone IS NOT NULL AND s.father_phone != '' AND u.phone = s.father_phone) OR
                    (s.email IS NOT NULL AND s.email != '' AND u.email = s.email)
                ))
                OR 
                (u.role = 'PARENT' AND (
                    (s.parent_phone IS NOT NULL AND s.parent_phone != '' AND u.phone = s.parent_phone) OR
                    (s.father_phone IS NOT NULL AND s.father_phone != '' AND u.phone = s.father_phone) OR
                    (s.guardian_phone IS NOT NULL AND s.guardian_phone != '' AND u.phone = s.guardian_phone) OR
                    (s.student_mobile IS NOT NULL AND s.student_mobile != '' AND u.phone = s.student_mobile)
                ))
              )
        ");
        $stmtUsers->execute([':class_id' => $classId, ':school_id' => $schoolId]);
        $studentParentUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Insert notifications for students/parents with duplicate protection
        $stmtCheckDup = $pdo->prepare("
            SELECT COUNT(*) FROM dashboard_notifications 
            WHERE school_id = :school_id AND user_id = :user_id AND title = :title AND message = :message 
              AND created_at >= NOW() - INTERVAL 1 MINUTE
        ");

        $stmtInsert = $pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
            VALUES (:school_id, :role, :user_id, :title, :message, :link, 'EXAM', :event_key, 0)
        ");

        foreach ($studentParentUsers as $u) {
            $userId = (int)$u['user_id'];
            $userRole = (string)$u['role'];

            $stmtCheckDup->execute([
                ':school_id' => $schoolId,
                ':user_id'   => $userId,
                ':title'     => $title,
                ':message'   => $message
            ]);
            if ((int)$stmtCheckDup->fetchColumn() === 0) {
                $stmtInsert->execute([
                    ':school_id' => $schoolId,
                    ':role'      => $userRole,
                    ':user_id'   => $userId,
                    ':title'     => $title,
                    ':message'   => $message,
                    ':link'      => $link,
                    ':event_key' => $eventKey
                ]);
            }

            // Dispatch Push Notification to each student and parent user
            PushDispatcher::pushOnly($pdo, $schoolId, $userRole, $userId, $eventKey, $title, $message, $link);
        }

        // Also insert role-wide broadcast notifications & FCM topic push if classId is 0 (all classes) or for scheme publication to teachers
        if ($classId <= 0 || $type === 'SCHEME' || $type === 'UNPUBLISH_SCHEME') {
            PushDispatcher::pushOnly($pdo, $schoolId, 'TEACHER', null, $eventKey, $title, $message, $link);
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
                [75.00, 100.00, 'A', 10, 'Excellent'],
                [60.00, 74.99, 'B', 8, 'Good'],
                [40.00, 59.99, 'C', 6, 'Average'],
                [0.00, 39.99, 'D', 0, 'Fail']
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
            ORDER BY s.id ASC, ep.id ASC
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
            if ($pct >= 75) return 'A';
            if ($pct >= 60) return 'B';
            if ($pct >= 40) return 'C';
            return 'D';
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
            WHERE s.class_id = :class_id AND s.school_id = :sid {$studentsFilter}
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

        // Fetch all students in all classes of the SAME NAME (to compute Class Rank across sections)
        $stmtClassGroup = $pdo->prepare("
            SELECT s.id, s.class_id, c.name AS class_name 
            FROM students s 
            JOIN classes c ON s.class_id = c.id
            WHERE c.name = :class_name AND c.academic_year_id = :ayid AND s.school_id = :sid
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
                       SUM(CASE WHEN LOWER(status) IN ('present', 'late') THEN 1 ELSE 0 END) AS present
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
        if ($school) {
            $school['report_card_remark'] = $school['report_card_remark'] ?? '';
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
                        $rawObtained = $m['marks_obtained'];
                        $isGradePaper = ((float)$p['max_marks'] === 0.0) || (!is_null($rawObtained) && !is_numeric($rawObtained));
                        if ($isGradePaper) {
                            $obtained = (!is_null($rawObtained) && $rawObtained !== '') ? (string)$rawObtained : '—';
                            $subjectGrade = $obtained !== '—' ? $obtained : 'A';
                            $passed = true;
                        } else {
                            $obtained = (float)$rawObtained;
                            $totalObtained += $obtained;
                            $passed = $obtained >= $passM;
                            $subjectPct = ($maxM > 0) ? ($obtained / $maxM) * 100 : 0.0;
                            $subjectGrade = $resolveGrade($subjectPct);
                        }
                    } else {
                        $subjectGrade = 'F';
                        $passed = false;
                    }
                    $remarks = $m['remarks'] ?: '';
                }

                if (!$passed) {
                    $allPassed = false;
                }
                if ((float)$p['max_marks'] > 0) {
                    $totalMax += $maxM;
                }

                $subjectMarks[] = [
                    'subject_name' => $p['subject_name'],
                    'max_marks' => (float)$p['max_marks'] === 0.0 ? '—' : $maxM,
                    'passing_marks' => (float)$p['max_marks'] === 0.0 ? '—' : $passM,
                    'marks_obtained' => $absent ? 'ABSENT' : ($obtained !== null ? $obtained : '—'),
                    'grade' => $absent ? 'F' : ($obtained !== null ? $subjectGrade : '—'),
                    'remarks' => $remarks,
                    'result' => $absent ? 'FAIL' : ($obtained !== null ? ($passed ? 'PASS' : 'FAIL') : '—')
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
                'dob' => $s['dob'] ?? $s['date_of_birth'] ?? '',
                'date_of_birth' => $s['dob'] ?? $s['date_of_birth'] ?? '',
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
            SELECT c.id, c.name, c.section, 
                   COALESCE(ecs.status, 'Draft') AS status, 
                   ecs.publish_date,
                   COALESCE(ecs.scheme_published, 0) AS scheme_published,
                   COALESCE(ecs.admit_card_published, 0) AS admit_card_published
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
            $conditions[] = "(action LIKE :search_action OR description LIKE :search_desc OR performed_by LIKE :search_perf OR module LIKE :search_mod)";
            $queryParams[':search_action'] = $searchTerm;
            $queryParams[':search_desc'] = $searchTerm;
            $queryParams[':search_perf'] = $searchTerm;
            $queryParams[':search_mod'] = $searchTerm;
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

    public function previewSeatingPlan(array $user, int $examId, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $classIds = $data['classes'] ?? [];
        $studentsPerBench = (int)($data['students_per_bench'] ?? 2);
        $roomConfigs = $data['room_configs'] ?? [];

        if (empty($classIds)) {
            throw new ValidationException(['classes' => 'Please select at least one class.']);
        }
        if (empty($roomConfigs)) {
            throw new ValidationException(['room_configs' => 'Please configure at least one room.']);
        }

        // Count active students per class
        $classCounts = [];
        $totalStudents = 0;
        $maxClassStudents = 0;

        $placeholders = implode(',', array_map('intval', $classIds));
        $stmtCount = $pdo->prepare("
            SELECT class_id, COUNT(*) as count 
            FROM students 
            WHERE school_id = :sid AND class_id IN ({$placeholders}) AND status = 'ACTIVE'
            GROUP BY class_id
        ");
        $stmtCount->execute([':sid' => $schoolId]);
        $counts = $stmtCount->fetchAll(PDO::FETCH_ASSOC);

        foreach ($counts as $c) {
            $classCounts[(int)$c['class_id']] = (int)$c['count'];
            $totalStudents += (int)$c['count'];
            if ((int)$c['count'] > $maxClassStudents) {
                $maxClassStudents = (int)$c['count'];
            }
        }

        // Calculate available benches
        $availableBenches = 0;
        foreach ($roomConfigs as $rc) {
            $availableBenches += (int)($rc['bench_count'] ?? 0);
        }

        // Benches required: ceiling of total_students / students_per_bench
        $requiredBenches = (int)ceil($totalStudents / $studentsPerBench);
        $remaining = $availableBenches - $requiredBenches;
        $enough = $availableBenches >= $requiredBenches;

        // Perform mock calculation to get room utilization details
        $calculated = $this->generateSeatingPlanData($schoolId, $examId, $classIds, $studentsPerBench, $roomConfigs);

        return [
            'total_students' => $totalStudents,
            'students_per_bench' => $studentsPerBench,
            'required_benches' => $requiredBenches,
            'available_benches' => $availableBenches,
            'remaining' => $remaining,
            'enough_benches' => $enough,
            'room_details' => $calculated['room_details']
        ];
    }

    public function generateSeatingPlan(array $user, int $examId, array $data): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        if ($academicYearId === 0) {
            throw new ValidationException(['academic_year' => 'No active academic year found.']);
        }

        $classIds = $data['classes'] ?? [];
        $studentsPerBench = (int)($data['students_per_bench'] ?? 2);
        $roomConfigs = $data['room_configs'] ?? [];

        if (empty($classIds)) {
            throw new ValidationException(['classes' => 'Please select at least one class.']);
        }
        if (empty($roomConfigs)) {
            throw new ValidationException(['room_configs' => 'Please configure at least one room.']);
        }

        // Perform seating plan generation data calculations
        $calculated = $this->generateSeatingPlanData($schoolId, $examId, $classIds, $studentsPerBench, $roomConfigs);
        $totalStudents = $calculated['total_students'];
        
        $maxClassStudents = 0;
        $classCounts = [];
        $placeholders = implode(',', array_map('intval', $classIds));
        $stmtCount = $pdo->prepare("
            SELECT class_id, COUNT(*) as count 
            FROM students 
            WHERE school_id = :sid AND class_id IN ({$placeholders}) AND status = 'ACTIVE'
            GROUP BY class_id
        ");
        $stmtCount->execute([':sid' => $schoolId]);
        $counts = $stmtCount->fetchAll(PDO::FETCH_ASSOC);
        foreach ($counts as $c) {
            if ((int)$c['count'] > $maxClassStudents) {
                $maxClassStudents = (int)$c['count'];
            }
        }

        $availableBenches = 0;
        foreach ($roomConfigs as $rc) {
            $availableBenches += (int)($rc['bench_count'] ?? 0);
        }

        $requiredBenches = (int)ceil($totalStudents / $studentsPerBench);

        if ($availableBenches < $requiredBenches) {
            throw new ValidationException(['benches' => 'Insufficient benches available to generate the seating plan.']);
        }

        $pdo->beginTransaction();
        try {
            // Delete existing seating plan (cascades to allocations)
            $stmtDel = $pdo->prepare("DELETE FROM examination_seating_plans WHERE exam_id = :exam_id");
            $stmtDel->execute([':exam_id' => $examId]);

            // Save new seating plan
            $stmtInsPlan = $pdo->prepare("
                INSERT INTO examination_seating_plans (school_id, exam_id, academic_year_id, students_per_bench, room_configs)
                VALUES (:school_id, :exam_id, :academic_year_id, :students_per_bench, :room_configs)
            ");
            $stmtInsPlan->execute([
                ':school_id' => $schoolId,
                ':exam_id' => $examId,
                ':academic_year_id' => $academicYearId,
                ':students_per_bench' => $studentsPerBench,
                ':room_configs' => json_encode($roomConfigs)
            ]);

            $seatingPlanId = (int)$pdo->lastInsertId();

            // Save allocations
            if (!empty($calculated['allocations'])) {
                $stmtInsAlloc = $pdo->prepare("
                    INSERT INTO examination_seating_allocations (seating_plan_id, student_id, room_name, bench_number, seat_position, seat_number)
                    VALUES (:seating_plan_id, :student_id, :room_name, :bench_number, :seat_position, :seat_number)
                ");
                foreach ($calculated['allocations'] as $alloc) {
                    $stmtInsAlloc->execute([
                        ':seating_plan_id' => $seatingPlanId,
                        ':student_id' => $alloc['student_id'],
                        ':room_name' => $alloc['room_name'],
                        ':bench_number' => $alloc['bench_number'],
                        ':seat_position' => $alloc['seat_position'],
                        ':seat_number' => $alloc['seat_number']
                    ]);
                }
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    public function getSeatingPlan(array $user, int $examId): ?array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $stmtPlan = $pdo->prepare("
            SELECT * FROM examination_seating_plans 
            WHERE exam_id = :exam_id AND school_id = :sid 
            LIMIT 1
        ");
        $stmtPlan->execute([':exam_id' => $examId, ':sid' => $schoolId]);
        $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);

        if (!$plan) {
            return null;
        }

        $plan['room_configs'] = json_decode($plan['room_configs'], true);

        $stmtAlloc = $pdo->prepare("
            SELECT sa.*, s.name AS student_name, s.roll_no, s.class_id, s.photo_path AS student_photo, 
                   c.name AS class_name, c.section AS class_section
            FROM examination_seating_allocations sa
            LEFT JOIN students s ON sa.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE sa.seating_plan_id = :spid
            ORDER BY sa.room_name ASC, sa.bench_number ASC, sa.seat_position ASC
        ");
        $stmtAlloc->execute([':spid' => $plan['id']]);
        $allocations = $stmtAlloc->fetchAll(PDO::FETCH_ASSOC);

        foreach ($allocations as &$alloc) {
            $baseShort = $this->formatShortClassName($alloc['class_name']);
            if (!empty($alloc['class_section']) && strpos($baseShort, $alloc['class_section']) === false) {
                $alloc['class_name'] = $baseShort . ' - ' . $alloc['class_section'];
            } else {
                $alloc['class_name'] = $baseShort;
            }
        }
        unset($alloc);

        $stmtSchool = $pdo->prepare("SELECT name, logo_path FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC);

        $stmtExam = $pdo->prepare("SELECT name FROM examinations WHERE id = :exam_id LIMIT 1");
        $stmtExam->execute([':exam_id' => $examId]);
        $examName = $stmtExam->fetchColumn();

        return [
            'plan' => $plan,
            'allocations' => $allocations,
            'school_name' => $school['name'] ?? '',
            'school_logo' => $school['logo_path'] ?? null,
            'exam_name' => $examName ?: ''
        ];
    }

    public function deleteSeatingPlan(array $user, int $examId): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $pdo->beginTransaction();
        try {
            $stmtDel = $pdo->prepare("DELETE FROM examination_seating_plans WHERE exam_id = :exam_id AND school_id = :sid");
            $stmtDel->execute([':exam_id' => $examId, ':sid' => $schoolId]);
            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    private function findClassByNameAndSection(PDO $pdo, int $schoolId, ?int $academicYearId, string $name, ?string $section, ?string $stream = null): ?int
    {
        $name = trim($name);
        $section = $section !== null ? trim((string)$section) : '';
        $stream = $stream !== null ? trim((string)$stream) : '';
        
        $sql = "SELECT id FROM classes 
                WHERE school_id = :sid 
                  AND TRIM(name) = :name 
                  AND TRIM(COALESCE(section, '')) = :section
                  AND TRIM(COALESCE(stream, '')) = :stream";
                  
        $params = [
            ':sid' => $schoolId,
            ':name' => $name,
            ':section' => $section,
            ':stream' => $stream
        ];
        
        if ($academicYearId !== null) {
            $sql .= " AND academic_year_id = :ayid";
            $params[':ayid'] = $academicYearId;
        } else {
            $sql .= " AND academic_year_id IS NULL";
        }
        
        $sql .= " LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $id = $stmt->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    private function formatShortClassName(string $className): string
    {
        $trimmed = trim($className);

        if (preg_match('/\(([^)]+)\)/', $trimmed, $matches)) {
            return trim($matches[1]);
        }

        $lower = strtolower($trimmed);
        if (strpos($lower, 'lower kindergarten') !== false) {
            return 'LKG';
        }
        if (strpos($lower, 'upper kindergarten') !== false) {
            return 'UKG';
        }
        if (strpos($lower, 'playgroup') !== false || strpos($lower, 'play group') !== false) {
            return 'PG';
        }
        if (strpos($lower, 'pre nursery') !== false || strpos($lower, 'pre-nursery') !== false) {
            return 'Pre-Nur';
        }

        return $trimmed;
    }

    private function generateSeatingPlanData(int $schoolId, int $examId, array $classIds, int $studentsPerBench, array $roomConfigs): array
    {
        $pdo = $this->classRepo->getPdo();

        $studentsByClass = [];
        foreach ($classIds as $classId) {
            $studentsByClass[$classId] = [];
        }

        $placeholders = implode(',', array_map('intval', $classIds));
        if (empty($placeholders)) {
            return [
                'allocations' => [],
                'room_details' => [],
                'total_allocated' => 0,
                'total_students' => 0
            ];
        }

        $stmt = $pdo->prepare("
            SELECT s.id, s.name, s.roll_no, s.class_id, s.photo_path AS student_photo, 
                   c.name AS class_name, c.section AS class_section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = :sid 
              AND s.class_id IN ({$placeholders}) 
              AND s.status = 'ACTIVE'
            ORDER BY s.class_id ASC, COALESCE(CAST(s.roll_no AS UNSIGNED), 999999) ASC, s.roll_no ASC, s.name ASC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $allStudents = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($allStudents as $stu) {
            $studentsByClass[$stu['class_id']][] = $stu;
        }

        $activeClassQueues = [];
        foreach ($studentsByClass as $classId => $queue) {
            if (!empty($queue)) {
                $activeClassQueues[$classId] = $queue;
            }
        }

        $seats = [];
        $roomDetails = [];

        foreach ($roomConfigs as $rc) {
            $roomName = $rc['room_name'];
            $benchCount = (int)$rc['bench_count'];
            $capacity = $benchCount * $studentsPerBench;

            $roomDetails[$roomName] = [
                'room_name' => $roomName,
                'bench_count' => $benchCount,
                'capacity' => $capacity,
                'allocated' => 0,
                'remaining' => $capacity
            ];

            for ($b = 1; $b <= $benchCount; $b++) {
                if ($studentsPerBench === 1) {
                    $positions = ['L'];
                } elseif ($studentsPerBench === 2) {
                    $positions = ['L', 'R'];
                } else {
                    $positions = ['L', 'M', 'R'];
                }

                foreach ($positions as $pos) {
                    $seats[] = [
                        'room_name' => $roomName,
                        'bench_number' => $b,
                        'seat_position' => $pos,
                        'seat_number' => "B-{$b}-{$pos}"
                    ];
                }
            }
        }

        $benches = [];
        foreach ($seats as $seat) {
            $key = $seat['room_name'] . '|||' . $seat['bench_number'];
            if (!isset($benches[$key])) {
                $benches[$key] = [
                    'room_name' => $seat['room_name'],
                    'bench_number' => $seat['bench_number'],
                    'seats' => []
                ];
            }
            $benches[$key]['seats'][] = $seat;
        }

        $allocations = [];
        $totalAllocated = 0;

        foreach ($benches as $benchKey => $benchData) {
            $roomName = $benchData['room_name'];
            $benchNo = $benchData['bench_number'];
            $benchSeats = $benchData['seats'];
            $seatCount = count($benchSeats);

            $lastClassIdOnBench = null;
            $baseClassesOnBench = [];

            for ($sIdx = 0; $sIdx < $seatCount; $sIdx++) {
                if (empty($activeClassQueues)) {
                    break;
                }

                uasort($activeClassQueues, function($a, $b) {
                    return count($b) <=> count($a);
                });

                $targetClassId = null;

                // Priority 1: Pick a class queue whose base class (c.name) is NOT on this bench yet
                foreach ($activeClassQueues as $cId => $q) {
                    if (!empty($q)) {
                        $baseName = trim(strtolower($q[0]['class_name']));
                        if (!in_array($baseName, $baseClassesOnBench, true)) {
                            $targetClassId = $cId;
                            break;
                        }
                    }
                }

                // Fallback 1: Pick a class queue with a different class_id from the last allocated seat on this bench
                if ($targetClassId === null) {
                    foreach ($activeClassQueues as $cId => $q) {
                        if (!empty($q)) {
                            if ($cId !== $lastClassIdOnBench || count($activeClassQueues) === 1) {
                                $targetClassId = $cId;
                                break;
                            }
                        }
                    }
                }

                // Fallback 2: Pick any remaining active class queue
                if ($targetClassId === null) {
                    foreach ($activeClassQueues as $cId => $q) {
                        if (!empty($q)) {
                            $targetClassId = $cId;
                            break;
                        }
                    }
                }

                if ($targetClassId === null) {
                    break;
                }

                $student = array_shift($activeClassQueues[$targetClassId]);
                if (empty($activeClassQueues[$targetClassId])) {
                    unset($activeClassQueues[$targetClassId]);
                }

                $baseName = trim(strtolower($student['class_name']));
                $baseClassesOnBench[] = $baseName;
                $lastClassIdOnBench = $targetClassId;
                $seat = $benchSeats[$sIdx];

                $baseShort = $this->formatShortClassName($student['class_name']);
                $formattedClassName = $baseShort;
                if (!empty($student['class_section']) && strpos($formattedClassName, $student['class_section']) === false) {
                    $formattedClassName .= ' - ' . $student['class_section'];
                }

                $allocations[] = [
                    'student_id' => $student['id'],
                    'student_name' => $student['name'],
                    'student_photo' => $student['student_photo'] ?? null,
                    'roll_no' => $student['roll_no'],
                    'class_id' => $student['class_id'],
                    'class_name' => $formattedClassName,
                    'class_section' => $student['class_section'] ?? '',
                    'room_name' => $seat['room_name'],
                    'bench_number' => $seat['bench_number'],
                    'seat_position' => $seat['seat_position'],
                    'seat_number' => $seat['seat_number']
                ];

                $roomDetails[$seat['room_name']]['allocated']++;
                $roomDetails[$seat['room_name']]['remaining']--;
                $totalAllocated++;
            }
        }

        return [
            'allocations' => $allocations,
            'room_details' => array_values($roomDetails),
            'total_allocated' => $totalAllocated,
            'total_students' => count($allStudents)
        ];
    }

    public function getFeeFollowUps(array $user, array $filters): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();
        $today = date('Y-m-d');

        // 1. Auto-transition PENDING promised dates that are due today
        $stmtDue = $pdo->prepare("
            UPDATE fee_follow_ups 
            SET status = 'DUE_TODAY' 
            WHERE school_id = :sid 
              AND status = 'PENDING' 
              AND promised_date = :today
        ");
        $stmtDue->execute([':sid' => $schoolId, ':today' => $today]);

        // 2. Auto-transition PENDING/DUE_TODAY promised dates that are overdue
        $stmtOverdue = $pdo->prepare("
            UPDATE fee_follow_ups 
            SET status = 'OVERDUE' 
            WHERE school_id = :sid 
              AND status IN ('PENDING', 'DUE_TODAY') 
              AND promised_date < :today
        ");
        $stmtOverdue->execute([':sid' => $schoolId, ':today' => $today]);

        // 3. Generate dashboard notifications for DUE_TODAY followups
        $stmtGetDue = $pdo->prepare("
            SELECT f.*, s.name AS student_name, c.name AS class_name
            FROM fee_follow_ups f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE f.school_id = :sid AND f.status = 'DUE_TODAY'
        ");
        $stmtGetDue->execute([':sid' => $schoolId]);
        $duesToday = $stmtGetDue->fetchAll(PDO::FETCH_ASSOC);
        foreach ($duesToday as $d) {
            $stmtNotifCheck = $pdo->prepare("
                SELECT COUNT(*) FROM dashboard_notifications 
                WHERE school_id = :sid 
                  AND title = 'Fee Follow-up Due Today' 
                  AND message LIKE :msg
            ");
            $likeMsg = '%' . $d['student_name'] . '%';
            $stmtNotifCheck->execute([':sid' => $schoolId, ':msg' => $likeMsg]);
            if ((int)$stmtNotifCheck->fetchColumn() === 0) {
                $stmtInsNotif = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, title, message, link)
                    VALUES (:sid, 'SCHOOL_ADMIN', 'Fee Follow-up Due Today', :msg, :link)
                ");
                $msg = "{$d['student_name']} (Class {$d['class_name']}) - ₹" . number_format((float)$d['pending_amount'], 2) . " Pending\nPromise Date: " . date('d M Y', strtotime($d['promised_date']));
                $link = "/school-admin/fee-follow-ups?id=" . $d['id'];
                $stmtInsNotif->execute([':sid' => $schoolId, ':msg' => $msg, ':link' => $link]);
            }
        }

        // 4. Generate dashboard notifications for OVERDUE followups
        $stmtGetOverdue = $pdo->prepare("
            SELECT f.*, s.name AS student_name, c.name AS class_name
            FROM fee_follow_ups f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE f.school_id = :sid AND f.status = 'OVERDUE'
        ");
        $stmtGetOverdue->execute([':sid' => $schoolId]);
        $overdues = $stmtGetOverdue->fetchAll(PDO::FETCH_ASSOC);
        foreach ($overdues as $o) {
            $daysOverdue = (int)floor((time() - strtotime($o['promised_date'])) / (60 * 60 * 24));
            if ($daysOverdue < 0) $daysOverdue = 0;
            
            $stmtNotifCheck = $pdo->prepare("
                SELECT COUNT(*) FROM dashboard_notifications 
                WHERE school_id = :sid 
                  AND title = 'Overdue Fee Follow-up' 
                  AND message LIKE :msg
            ");
            $likeMsg = '%' . $o['student_name'] . '%';
            $stmtNotifCheck->execute([':sid' => $schoolId, ':msg' => $likeMsg]);
            if ((int)$stmtNotifCheck->fetchColumn() === 0) {
                $stmtInsNotif = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, title, message, link)
                    VALUES (:sid, 'SCHOOL_ADMIN', 'Overdue Fee Follow-up', :msg, :link)
                ");
                $msg = "Student Name: {$o['student_name']}\nPending Amount: ₹" . number_format((float)$o['pending_amount'], 2) . "\nDays Overdue: {$daysOverdue} days";
                $link = "/school-admin/fee-follow-ups?id=" . $o['id'];
                $stmtInsNotif->execute([':sid' => $schoolId, ':msg' => $msg, ':link' => $link]);
            }
        }

        // Count cards
        $stmtPending = $pdo->prepare("SELECT COUNT(*) FROM fee_follow_ups WHERE school_id = :sid AND status = 'PENDING'");
        $stmtPending->execute([':sid' => $schoolId]);
        $countPending = (int)$stmtPending->fetchColumn();

        $stmtDueToday = $pdo->prepare("SELECT COUNT(*) FROM fee_follow_ups WHERE school_id = :sid AND status = 'DUE_TODAY'");
        $stmtDueToday->execute([':sid' => $schoolId]);
        $countDueToday = (int)$stmtDueToday->fetchColumn();

        $stmtOverdueCard = $pdo->prepare("SELECT COUNT(*) FROM fee_follow_ups WHERE school_id = :sid AND status = 'OVERDUE'");
        $stmtOverdueCard->execute([':sid' => $schoolId]);
        $countOverdue = (int)$stmtOverdueCard->fetchColumn();

        $stmtUpcoming = $pdo->prepare("SELECT COUNT(*) FROM fee_follow_ups WHERE school_id = :sid AND status = 'PENDING' AND promised_date > :today");
        $stmtUpcoming->execute([':sid' => $schoolId, ':today' => $today]);
        $countUpcoming = (int)$stmtUpcoming->fetchColumn();

        $stmtCompleted = $pdo->prepare("SELECT COUNT(*) FROM fee_follow_ups WHERE school_id = :sid AND status = 'COMPLETED'");
        $stmtCompleted->execute([':sid' => $schoolId]);
        $countCompleted = (int)$stmtCompleted->fetchColumn();

        $stats = [
            'pending' => $countPending,
            'due_today' => $countDueToday,
            'upcoming' => $countUpcoming,
            'overdue' => $countOverdue,
            'completed' => $countCompleted,
        ];

        // Search & filters
        $whereSql = "";
        $whereParams = [':sid' => $schoolId];

        if (!empty($filters['status'])) {
            if ($filters['status'] === 'UPCOMING') {
                $whereSql .= " AND f.status = 'PENDING' AND f.promised_date > :today";
                $whereParams[':today'] = $today;
            } elseif ($filters['status'] !== 'ALL') {
                $whereSql .= " AND f.status = :status";
                $whereParams[':status'] = $filters['status'];
            }
        }

        if (!empty($filters['class_id'])) {
            $whereSql .= " AND s.class_id = :class_id";
            $whereParams[':class_id'] = (int)$filters['class_id'];
        }

        if (!empty($filters['academic_year_id'])) {
            $whereSql .= " AND f.academic_year_id = :academic_year_id";
            $whereParams[':academic_year_id'] = (int)$filters['academic_year_id'];
        }

        if (!empty($filters['start_date']) && !empty($filters['end_date'])) {
            $whereSql .= " AND f.promised_date BETWEEN :start_date AND :end_date";
            $whereParams[':start_date'] = $filters['start_date'];
            $whereParams[':end_date'] = $filters['end_date'];
        }

        if (!empty($filters['student_search'])) {
            $whereSql .= " AND (s.name LIKE :search_name OR s.admission_no LIKE :search_adm OR s.roll_no LIKE :search_roll)";
            $whereParams[':search_name'] = '%' . $filters['student_search'] . '%';
            $whereParams[':search_adm'] = '%' . $filters['student_search'] . '%';
            $whereParams[':search_roll'] = '%' . $filters['student_search'] . '%';
        }

        if (!empty($filters['parent_mobile'])) {
            $whereSql .= " AND s.parent_phone LIKE :mobile";
            $whereParams[':mobile'] = '%' . $filters['parent_mobile'] . '%';
        }

        // Count total matching
        $countSql = "SELECT COUNT(*) FROM fee_follow_ups f 
                     JOIN students s ON f.student_id = s.id 
                     WHERE f.school_id = :sid" . $whereSql;
        $stmtCountTotal = $pdo->prepare($countSql);
        $stmtCountTotal->execute($whereParams);
        $totalItems = (int)$stmtCountTotal->fetchColumn();

        // Get matching data
        $page = !empty($filters['page']) ? (int)$filters['page'] : 1;
        $limit = !empty($filters['limit']) ? (int)$filters['limit'] : 10;
        $offset = ($page - 1) * $limit;

        $dataSql = "SELECT f.*, s.name AS student_name, s.roll_no, c.name AS class_name, 
                           COALESCE(NULLIF(s.parent_phone, ''), NULLIF(s.father_phone, ''), NULLIF(s.mother_phone, ''), NULLIF(s.student_mobile, ''), '—') AS mobile_number
                    FROM fee_follow_ups f
                    JOIN students s ON f.student_id = s.id
                    LEFT JOIN classes c ON s.class_id = c.id
                    LEFT JOIN users u ON f.created_by = u.id
                    WHERE f.school_id = :sid" . $whereSql . "
                    ORDER BY (CASE WHEN f.status = 'COMPLETED' THEN 1 ELSE 0 END) ASC, f.promised_date ASC, f.id DESC 
                    LIMIT {$limit} OFFSET {$offset}";

        $stmtData = $pdo->prepare($dataSql);
        $stmtData->execute($whereParams);
        $items = $stmtData->fetchAll(PDO::FETCH_ASSOC);

        return [
            'stats' => $stats,
            'items' => $items,
            'pagination' => [
                'total_items' => $totalItems,
                'page' => $page,
                'limit' => $limit,
                'total_pages' => (int)ceil($totalItems / $limit)
            ]
        ];
    }

    public function createFeeFollowUp(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        if (empty($data['student_id'])) {
            throw new ValidationException(['student_id' => 'Student is required']);
        }
        if (empty($data['promised_date'])) {
            throw new ValidationException(['promised_date' => 'Promised Payment Date is required']);
        }
        if (empty($data['reason'])) {
            throw new ValidationException(['reason' => 'Reason / Commitment is required']);
        }

        $studentId = (int)$data['student_id'];
        $promisedDate = $data['promised_date'];
        $reason = trim($data['reason']);

        if (strlen($reason) > 500) {
            throw new ValidationException(['reason' => 'Reason cannot exceed 500 characters.']);
        }

        $wordCount = count(preg_split('/\s+/', $reason));
        if ($wordCount > 25) {
            throw new ValidationException(['reason' => 'Maximum 25 words allowed.']);
        }

        $today = date('Y-m-d');
        if ($promisedDate <= $today) {
            throw new ValidationException(['promised_date' => 'Promised Date must be in the future.']);
        }

        // Get student's academic year
        $stmtStu = $pdo->prepare("SELECT academic_year_id, class_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $student = $stmtStu->fetch(PDO::FETCH_ASSOC);
        if (!$student) {
            throw new NotFoundException('Student not found');
        }
        $academicYearId = (int)$student['academic_year_id'];

        // Get pending amount
        $dues = $this->getStudentCurrentOutstandingBalance($pdo, $studentId, $schoolId, $academicYearId);
        $pendingAmount = isset($data['pending_amount']) && $data['pending_amount'] !== '' ? (float)$data['pending_amount'] : $dues;

        if ($pendingAmount < 0.0) {
            throw new ValidationException(['pending_amount' => 'Pending Amount cannot be negative.']);
        }

        // Insert follow-up record
        $stmtIns = $pdo->prepare("
            INSERT INTO fee_follow_ups (school_id, student_id, academic_year_id, pending_amount, promised_date, reason, reminder_notes, status, created_by)
            VALUES (:sid, :student_id, :ayid, :amount, :promised_date, :reason, NULL, 'PENDING', :created_by)
        ");
        $stmtIns->execute([
            ':sid' => $schoolId,
            ':student_id' => $studentId,
            ':ayid' => $academicYearId,
            ':amount' => $pendingAmount,
            ':promised_date' => $promisedDate,
            ':reason' => $reason,
            ':created_by' => $user['id']
        ]);
        $followUpId = (int)$pdo->lastInsertId();

        $this->log('Fee follow-up created', ['id' => $followUpId, 'student_id' => $studentId]);

        return ['id' => $followUpId];
    }

    public function getFeeFollowUpDetails(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("
            SELECT f.*, s.name AS student_name, s.admission_no, c.name AS class_name, 
                   s.father_name AS parent_name, s.parent_phone AS mobile_number, u.name AS creator_name
            FROM fee_follow_ups f
            JOIN students s ON f.student_id = s.id
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.id = :id AND f.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        $followUp = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$followUp) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        // Fetch notes
        $stmtNotes = $pdo->prepare("
            SELECT n.*, u.name AS user_name
            FROM fee_follow_up_notes n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.follow_up_id = :fid
            ORDER BY n.id DESC
        ");
        $stmtNotes->execute([':fid' => $id]);
        $followUp['notes'] = $stmtNotes->fetchAll(PDO::FETCH_ASSOC);

        return $followUp;
    }

    public function updateFeeFollowUp(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id, status FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $followUp = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$followUp) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        if (empty($data['promised_date'])) {
            throw new ValidationException(['promised_date' => 'Promised Payment Date is required']);
        }
        if (empty($data['reason'])) {
            throw new ValidationException(['reason' => 'Reason / Commitment is required']);
        }

        $promisedDate = $data['promised_date'];
        $reason = trim($data['reason']);
        $pendingAmount = (float)$data['pending_amount'];

        if (strlen($reason) > 500) {
            throw new ValidationException(['reason' => 'Reason cannot exceed 500 characters.']);
        }

        $wordCount = count(preg_split('/\s+/', $reason));
        if ($wordCount > 25) {
            throw new ValidationException(['reason' => 'Maximum 25 words allowed.']);
        }

        if ($pendingAmount < 0.0) {
            throw new ValidationException(['pending_amount' => 'Pending Amount cannot be negative.']);
        }

        $today = date('Y-m-d');
        $status = $followUp['status'];
        if ($status !== 'COMPLETED') {
            if ($promisedDate > $today) {
                $status = 'PENDING';
            } elseif ($promisedDate === $today) {
                $status = 'DUE_TODAY';
            } else {
                $status = 'OVERDUE';
            }
        }

        $stmtUp = $pdo->prepare("
            UPDATE fee_follow_ups 
            SET promised_date = :promised_date, reason = :reason, pending_amount = :amount, 
                reminder_notes = NULL, status = :status
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUp->execute([
            ':promised_date' => $promisedDate,
            ':reason' => $reason,
            ':amount' => $pendingAmount,
            ':status' => $status,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        $this->log('Fee follow-up updated', ['id' => $id]);

        return ['success' => true];
    }

    public function extendFeeFollowUp(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id, status, promised_date, reason FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $followUp = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$followUp) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        if (empty($data['promised_date'])) {
            throw new ValidationException(['promised_date' => 'New Promised Payment Date is required']);
        }

        $promisedDate = $data['promised_date'];
        $reason = !empty($data['reason']) ? trim($data['reason']) : '';

        if (strlen($reason) > 500) {
            throw new ValidationException(['reason' => 'Reason cannot exceed 500 characters.']);
        }

        $today = date('Y-m-d');
        if ($promisedDate <= $today) {
            throw new ValidationException(['promised_date' => 'New promised date must be in the future.']);
        }
        if ($promisedDate <= $followUp['promised_date']) {
            throw new ValidationException(['promised_date' => 'New promised date must be later than the current promised date.']);
        }

        if (!empty($reason)) {
            $wordCount = count(preg_split('/\s+/', trim($reason)));
            if ($wordCount > 25) {
                throw new ValidationException(['reason' => 'Maximum 25 words allowed.']);
            }
        }

        $status = $followUp['status'];
        if ($status !== 'COMPLETED') {
            $status = 'PENDING';
        }

        $updateReason = ($reason !== '') ? $reason : $followUp['reason'];

        $stmtUp = $pdo->prepare("
            UPDATE fee_follow_ups 
            SET promised_date = :promised_date, reason = :reason, 
                status = :status, extended_count = extended_count + 1
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUp->execute([
            ':promised_date' => $promisedDate,
            ':reason' => $updateReason,
            ':status' => $status,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        $creatorId = (int)$user['id'];
        $logComment = "Commitment extended to " . date('d M Y', strtotime($promisedDate));
        if (!empty($reason)) {
            $logComment .= ". Reason: " . $reason;
        }

        $stmtNote = $pdo->prepare("
            INSERT INTO fee_follow_up_notes (follow_up_id, comment, created_by)
            VALUES (:fid, :comment, :creator)
        ");
        $stmtNote->execute([
            ':fid' => $id,
            ':comment' => $logComment,
            ':creator' => $creatorId
        ]);

        $this->log('Fee follow-up extended', ['id' => $id, 'new_date' => $promisedDate]);

        return ['success' => true];
    }

    public function deleteFeeFollowUp(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() === false) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        $stmtDel = $pdo->prepare("DELETE FROM fee_follow_ups WHERE id = :id AND school_id = :sid");
        $stmtDel->execute([':id' => $id, ':sid' => $schoolId]);

        $this->log('Fee follow-up deleted', ['id' => $id]);

        return ['success' => true];
    }

    public function addFollowUpNote(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() === false) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        if (empty($data['comment'])) {
            throw new ValidationException(['comment' => 'Comment note is required']);
        }

        $comment = trim($data['comment']);

        $stmtIns = $pdo->prepare("
            INSERT INTO fee_follow_up_notes (follow_up_id, comment, created_by)
            VALUES (:fid, :comment, :created_by)
        ");
        $stmtIns->execute([
            ':fid' => $id,
            ':comment' => $comment,
            ':created_by' => $user['id']
        ]);

        $this->log('Fee follow-up note added', ['id' => $id]);

        return ['id' => (int)$pdo->lastInsertId()];
    }

    public function markFollowUpContacted(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        if ($stmtCheck->fetchColumn() === false) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        $note = !empty($data['comment']) ? trim($data['comment']) : 'Contacted parent.';
        $comment = "Contacted parent: " . $note;

        $stmtIns = $pdo->prepare("
            INSERT INTO fee_follow_up_notes (follow_up_id, comment, created_by)
            VALUES (:fid, :comment, :created_by)
        ");
        $stmtIns->execute([
            ':fid' => $id,
            ':comment' => $comment,
            ':created_by' => $user['id']
        ]);

        return ['success' => true];
    }

    public function getStudentCurrentOutstandingBalance(PDO $pdo, int $studentId, int $schoolId, int $academicYearId): float
    {
        $stmtStu = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $classId = $stmtStu->fetchColumn();
        if ($classId === false || $classId === null) {
            return 0.0;
        }

        // Fetch monthly fees config
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
        $monthlyFees = [];
        if ($cfgRow) {
            $monthlyFees = json_decode($cfgRow['monthly_fees'], true);
        }

        // Fetch paid amounts per month for this student in this academic year (including partial payments)
        $stmtPaid = $pdo->prepare("
            SELECT fee_month, COALESCE(SUM(amount_paid + COALESCE(discount_amount, 0)), 0) AS total_paid 
            FROM fee_payments 
            WHERE student_id = :student_id 
              AND school_id = :school_id 
              AND (academic_year_id = :academic_year_id OR academic_year_id IS NULL)
              AND UPPER(status) IN ('PAID', 'PARTIAL', 'COMPLETED')
            GROUP BY fee_month
        ");
        $stmtPaid->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId
        ]);
        $paidRows = $stmtPaid->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $paidByMonth = [];
        foreach ($paidRows as $pRow) {
            $mKey = strtoupper(trim((string)$pRow['fee_month']));
            $paidByMonth[$mKey] = (float)$pRow['total_paid'];
        }

        // Determine months to evaluate (up to current calendar month)
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $monthsToEvaluate = $academicMonths;
        
        $stmtAY = $pdo->prepare("SELECT start_date, end_date, status FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
        $stmtAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
        $ayRow = $stmtAY->fetch(PDO::FETCH_ASSOC);
        if ($ayRow) {
            $monthsToEvaluate = $this->getMonthsDueUpToCurrent($ayRow['start_date'], $ayRow['end_date'], $ayRow['status']);
        }

        $outstanding = 0.0;
        foreach ($monthsToEvaluate as $m) {
            $mUpper = strtoupper(trim($m));
            $totalConfiguredFee = isset($monthlyFees[$m]) ? (float)$monthlyFees[$m] : 0.0;
            $alreadyPaidForMonth = $paidByMonth[$mUpper] ?? 0.0;
            $remForMonth = max(0.0, round($totalConfiguredFee - $alreadyPaidForMonth, 2));
            $outstanding += $remForMonth;
        }

        // Fetch all pending and partial additional fees
        $stmtAddPending = $pdo->prepare("
            SELECT COALESCE(SUM(afp.amount - (COALESCE(afp.amount_paid, 0) + COALESCE(afp.discount_amount, 0))), 0)
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.student_id = :student_id
              AND afp.school_id = :school_id
              AND LOWER(afp.status) IN ('pending', 'partial')
              AND (aft.academic_year_id = :academic_year_id OR aft.academic_year_id IS NULL OR aft.name = 'Previous Year Dues')
        ");
        $stmtAddPending->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId
        ]);
        $outstanding += (float)$stmtAddPending->fetchColumn();

        return $outstanding;
    }

    public function getStudentOutstandingFee(array $user, int $studentId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtStu = $pdo->prepare("SELECT academic_year_id FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStu->execute([':id' => $studentId, ':sid' => $schoolId]);
        $student = $stmtStu->fetch(PDO::FETCH_ASSOC);
        if (!$student) {
            throw new NotFoundException('Student not found');
        }
        
        $workingYear = $this->getWorkingAcademicYear($pdo, $schoolId);
        $academicYearId = $workingYear ? (int)$workingYear['id'] : (int)($student['academic_year_id'] ?? 0);
        $dues = $this->getStudentCurrentOutstandingBalance($pdo, $studentId, $schoolId, $academicYearId);

        return ['outstanding_balance' => $dues];
    }

    public function getStudentFollowUps(array $user, int $studentId): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("
            SELECT f.*, u.name AS creator_name 
            FROM fee_follow_ups f
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.student_id = :student_id AND f.school_id = :school_id
            ORDER BY f.id DESC
        ");
        $stmt->execute([':student_id' => $studentId, ':school_id' => $schoolId]);
        $followUps = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $timeline = [];
        foreach ($followUps as $f) {
            $timeline[] = [
                'date' => date('d M Y', strtotime($f['created_at'])),
                'timestamp' => strtotime($f['created_at']),
                'type' => 'created',
                'title' => "Parent promised payment on " . date('d M Y', strtotime($f['promised_date'])),
                'description' => "Amount: ₹" . number_format((float)$f['pending_amount'], 2) . " | Reason: " . $f['reason'],
                'user' => $f['creator_name']
            ];
            
            if ($f['status'] === 'COMPLETED' && $f['completed_at'] !== null) {
                $timeline[] = [
                    'date' => date('d M Y', strtotime($f['completed_at'])),
                    'timestamp' => strtotime($f['completed_at']),
                    'type' => 'completed',
                    'title' => "Follow-up completed",
                    'description' => "Pending dues became zero. Status changed to Completed.",
                    'user' => 'System'
                ];
            }
            
            $stmtNotes = $pdo->prepare("
                SELECT n.*, u.name AS user_name 
                FROM fee_follow_up_notes n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.follow_up_id = :fid
                ORDER BY n.id ASC
            ");
            $stmtNotes->execute([':fid' => $f['id']]);
            $notes = $stmtNotes->fetchAll(PDO::FETCH_ASSOC);
            foreach ($notes as $n) {
                $timeline[] = [
                    'date' => date('d M Y', strtotime($n['created_at'])),
                    'timestamp' => strtotime($n['created_at']),
                    'type' => 'note',
                    'title' => "Note added",
                    'description' => $n['comment'],
                    'user' => $n['user_name']
                ];
            }
        }
        
        usort($timeline, function($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });
        
        return $timeline;
    }

    public function getNotifications(array $user, array $params = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $role = $user['role'] ?? '';
        $userId = (int)($user['id'] ?? 0);
        $limit = isset($params['limit']) ? max(1, (int)$params['limit']) : 10;
        $offset = isset($params['offset']) ? max(0, (int)$params['offset']) : 0;
        $pdo = $this->classRepo->getPdo();

        if ($role === 'SCHOOL_ADMIN') {
            $stmt = $pdo->prepare("
                SELECT * FROM dashboard_notifications
                WHERE school_id = :sid AND user_role = 'SCHOOL_ADMIN'
                ORDER BY id DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindValue(':sid', $schoolId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $stmtUnread = $pdo->prepare("
                SELECT COUNT(*) FROM dashboard_notifications
                WHERE school_id = :sid AND user_role = 'SCHOOL_ADMIN' AND is_read = 0
            ");
            $stmtUnread->execute([':sid' => $schoolId]);
            $unreadCount = (int)$stmtUnread->fetchColumn();
        } else {
            // TEACHER or any other staff role
            $stmt = $pdo->prepare("
                SELECT * FROM dashboard_notifications
                WHERE school_id = :sid AND user_role = :role AND (user_id = :uid OR user_id IS NULL)
                ORDER BY id DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindValue(':sid', $schoolId, PDO::PARAM_INT);
            $stmt->bindValue(':role', $role, PDO::PARAM_STR);
            $stmt->bindValue(':uid', $userId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $stmtUnread = $pdo->prepare("
                SELECT COUNT(*) FROM dashboard_notifications
                WHERE school_id = :sid AND user_role = :role AND (user_id = :uid OR user_id IS NULL) AND is_read = 0
            ");
            $stmtUnread->execute([':sid' => $schoolId, ':role' => $role, ':uid' => $userId]);
            $unreadCount = (int)$stmtUnread->fetchColumn();
        }

        return [
            'notifications' => $notifications,
            'unread_count' => $unreadCount
        ];
    }

    public function markNotificationRead(array $user, int $id, array $body = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $role = strtoupper($user['role'] ?? 'SCHOOL_ADMIN');
        $userId = (int)($user['id'] ?? 0);
        $pdo = $this->classRepo->getPdo();

        if ($id > 0) {
            $stmt = $pdo->prepare("
                UPDATE dashboard_notifications 
                SET is_read = 1 
                WHERE id = :id AND school_id = :sid
            ");
            $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        } else {
            $eventKey = $body['event_key'] ?? '';
            $link = $body['link'] ?? '';
            $title = $body['title'] ?? '';

            if (!empty($eventKey) || !empty($link) || !empty($title)) {
                $query = "UPDATE dashboard_notifications SET is_read = 1 WHERE school_id = :sid AND is_read = 0";
                $params = [':sid' => $schoolId];

                if ($role !== 'SCHOOL_ADMIN' && $role !== 'SUPER_ADMIN') {
                    $query .= " AND user_role = :role AND (user_id = :uid OR user_id IS NULL)";
                    $params[':role'] = $role;
                    $params[':uid'] = $userId;
                }

                if (!empty($eventKey)) {
                    $query .= " AND event_key = :ekey";
                    $params[':ekey'] = $eventKey;
                } elseif (!empty($link)) {
                    $query .= " AND link = :link";
                    $params[':link'] = $link;
                } elseif (!empty($title)) {
                    $query .= " AND title = :title";
                    $params[':title'] = $title;
                }

                $stmt = $pdo->prepare($query);
                $stmt->execute($params);
            }
        }

        return ['success' => true];
    }

    public function deleteNotification(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmt = $pdo->prepare("
            DELETE FROM dashboard_notifications 
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);

        return ['success' => true];
    }

    public function syncFollowUpStatus(PDO $pdo, int $studentId, int $schoolId): void
    {
        // Automatic status change is disabled: managed manually by teachers.
    }

    public function updateFeeFollowUpStatus(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->classRepo->getPdo();

        $stmtCheck = $pdo->prepare("SELECT id, status, promised_date FROM fee_follow_ups WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $followUp = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$followUp) {
            throw new NotFoundException('Fee follow-up not found.');
        }

        if (empty($data['status'])) {
            throw new ValidationException(['status' => 'Status is required']);
        }

        $newStatus = strtoupper(trim($data['status']));
        if (!in_array($newStatus, ['PENDING', 'COMPLETED', 'DUE_TODAY', 'OVERDUE'], true)) {
            throw new ValidationException(['status' => 'Invalid status']);
        }

        if ($newStatus === 'PENDING') {
            $today = date('Y-m-d');
            $promisedDate = $followUp['promised_date'];
            if ($promisedDate > $today) {
                $newStatus = 'PENDING';
            } elseif ($promisedDate === $today) {
                $newStatus = 'DUE_TODAY';
            } else {
                $newStatus = 'OVERDUE';
            }
        }

        $completedAt = ($newStatus === 'COMPLETED') ? date('Y-m-d H:i:s') : null;

        $stmtUp = $pdo->prepare("
            UPDATE fee_follow_ups 
            SET status = :status, completed_at = :completed_at
            WHERE id = :id AND school_id = :sid
        ");
        $stmtUp->execute([
            ':status' => $newStatus,
            ':completed_at' => $completedAt,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        $creatorId = (int)$user['id'];
        $logComment = "Status updated manually to " . $newStatus;
        $stmtNote = $pdo->prepare("
            INSERT INTO fee_follow_up_notes (follow_up_id, comment, created_by)
            VALUES (:fid, :comment, :creator)
        ");
        $stmtNote->execute([
            ':fid' => $id,
            ':comment' => $logComment,
            ':creator' => $creatorId
        ]);

        $this->log('Fee follow-up status updated manually', ['id' => $id, 'status' => $newStatus]);

        return ['success' => true];
    }

    public function getCredentials(array $user, string $role, int $id): ?array
    {
        $pdo = $this->studentRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        $role = strtoupper($role);

        if ($role === 'TEACHER') {
            $stmt = $pdo->prepare("SELECT phone, name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute(['id' => $id, 'sid' => $schoolId]);
            $staff = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$staff) {
                throw new NotFoundException('Teacher not found in this school.');
            }
            $phone = $staff['phone'] ?? '';
            $userRole = 'TEACHER';
        } else if ($role === 'PARENT' || $role === 'STUDENT') {
            $stmt = $pdo->prepare("SELECT student_mobile, parent_phone, father_phone, guardian_phone, name FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute(['id' => $id, 'sid' => $schoolId]);
            $student = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$student) {
                throw new NotFoundException('Student not found in this school.');
            }
            $candidatePhones = array_values(array_unique(array_filter([
                trim((string)($student['student_mobile'] ?? '')),
                trim((string)($student['parent_phone'] ?? '')),
                trim((string)($student['father_phone'] ?? '')),
                trim((string)($student['guardian_phone'] ?? ''))
            ])));
            $phone = $candidatePhones[0] ?? '';
            $userRole = 'STUDENT';
        } else {
            throw new ValidationException(['role' => 'Invalid role specified.']);
        }

        if (empty($phone)) {
            return null;
        }

        $targetPhones = ($role === 'TEACHER') ? [$phone] : $candidatePhones;
        $inPlaceholders = implode(',', array_fill(0, count($targetPhones), '?'));

        $stmtUser = $pdo->prepare("SELECT phone, plain_password FROM users WHERE phone IN ($inPlaceholders) ORDER BY id DESC LIMIT 1");
        $stmtUser->execute($targetPhones);
        $row = $stmtUser->fetch(\PDO::FETCH_ASSOC);

        return $row !== false ? $row : null;
    }

    public function generateCredentials(array $user, array $data): array
    {
        $pdo = $this->studentRepo->getPdo();
        $schoolId = $this->getSchoolId($user);
        
        if (empty($data['role']) || empty($data['id'])) {
            throw new ValidationException(['fields' => 'Role and ID are required.']);
        }

        $role = strtoupper($data['role']);
        $id = (int)$data['id'];

        if ($role === 'TEACHER') {
            $stmt = $pdo->prepare("SELECT phone, name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute(['id' => $id, 'sid' => $schoolId]);
            $staff = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$staff) {
                throw new NotFoundException('Teacher not found in this school.');
            }
            $phone = trim((string)($staff['phone'] ?? ''));
            $name = $staff['name'] ?? '';
            $userRole = 'TEACHER';
        } else if ($role === 'PARENT' || $role === 'STUDENT') {
            $stmt = $pdo->prepare("SELECT student_mobile, parent_phone, father_phone, guardian_phone, first_name, last_name, name FROM students WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute(['id' => $id, 'sid' => $schoolId]);
            $student = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$student) {
                throw new NotFoundException('Student not found in this school.');
            }
            $candidatePhones = array_values(array_unique(array_filter([
                trim((string)($student['student_mobile'] ?? '')),
                trim((string)($student['parent_phone'] ?? '')),
                trim((string)($student['father_phone'] ?? '')),
                trim((string)($student['guardian_phone'] ?? ''))
            ])));
            $phone = $candidatePhones[0] ?? '';
            $name = $student['name'] ?? trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? ''));
            $userRole = 'STUDENT';
        } else {
            throw new ValidationException(['role' => 'Invalid role specified.']);
        }

        if (empty($phone)) {
            throw new ValidationException(['phone' => 'Mobile number is not registered for this profile. Please update the profile first.']);
        }

        // Generate or use manual password
        if (!empty($data['password'])) {
            $password = trim($data['password']);
            if (strlen($password) < 6) {
                throw new ValidationException(['password' => 'Password must be at least 6 characters long.']);
            }
        } else {
            $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            $password = '';
            for ($i = 0; $i < 8; $i++) {
                $password .= $chars[random_int(0, strlen($chars) - 1)];
            }
        }
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        // Update/create user accounts for all candidate phone numbers of this profile
        $targetPhones = ($role === 'TEACHER') ? [$phone] : $candidatePhones;
        foreach ($targetPhones as $p) {
            $stmtUpdate = $pdo->prepare("
                UPDATE users 
                SET password = :password, plain_password = :plain, role = :role, school_id = COALESCE(school_id, :sid), status = 'ACTIVE'
                WHERE phone = :phone
            ");
            $stmtUpdate->execute([
                ':password' => $hashedPassword,
                ':plain' => $password,
                ':role' => $userRole,
                ':sid' => $schoolId,
                ':phone' => $p
            ]);

            if ($stmtUpdate->rowCount() === 0) {
                $stmtInsert = $pdo->prepare("
                    INSERT INTO users (phone, password, plain_password, role, name, school_id, status)
                    VALUES (:phone, :password, :plain, :role, :name, :sid, 'ACTIVE')
                ");
                $stmtInsert->execute([
                    ':phone' => $p,
                    ':password' => $hashedPassword,
                    ':plain' => $password,
                    ':role' => $userRole,
                    ':name' => $name,
                    ':sid' => $schoolId
                ]);
            }
        }

        $this->log('Credentials generated/updated', ['phone' => $phone, 'role' => $userRole]);

        return [
            'phone' => $phone,
            'plain_password' => $password
        ];
    }

    private function sendStudentNotification(PDO $pdo, int $schoolId, int $studentId, string $title, string $message): void
    {
        // 1. Get student and parent information
        $stmtInfo = $pdo->prepare("SELECT email, parent_phone, father_phone, guardian_phone, student_mobile FROM students WHERE id = :stid LIMIT 1");
        $stmtInfo->execute([':stid' => $studentId]);
        $studentInfo = $stmtInfo->fetch(PDO::FETCH_ASSOC);

        if (!$studentInfo) {
            return;
        }

        $studentEmail = !empty($studentInfo['email']) ? trim((string)$studentInfo['email']) : null;
        $rawPhones = [
            $studentInfo['parent_phone'] ?? null,
            $studentInfo['father_phone'] ?? null,
            $studentInfo['guardian_phone'] ?? null,
            $studentInfo['student_mobile'] ?? null
        ];
        $phones = [];
        foreach ($rawPhones as $p) {
            if ($p !== null && trim((string)$p) !== '') {
                $cleaned = trim((string)$p);
                $phones[] = $cleaned;
            }
        }
        $phones = array_unique(array_filter($phones));

        // 2. Notify Student User accounts (match by email or mobile phone)
        $studentUserIds = [];
        if ($studentEmail !== null || !empty($phones)) {
            $conditions = [];
            $params = [':sid' => $schoolId];
            if ($studentEmail !== null) {
                $conditions[] = "email = :semail";
                $params[':semail'] = $studentEmail;
            }
            if (!empty($phones)) {
                $placeholders = [];
                foreach (array_values($phones) as $idx => $ph) {
                    $k = ":sph_" . $idx;
                    $placeholders[] = $k;
                    $params[$k] = $ph;
                }
                $conditions[] = "phone IN (" . implode(',', $placeholders) . ")";
            }

            $sqlStudent = "SELECT DISTINCT id FROM users WHERE school_id = :sid AND role = 'STUDENT' AND (" . implode(' OR ', $conditions) . ")";
            $stmtStudentUsers = $pdo->prepare($sqlStudent);
            $stmtStudentUsers->execute($params);
            $studentUserIds = array_map('intval', $stmtStudentUsers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($studentUserIds)) {
                $stmtInsert = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
                    VALUES (:school_id, 'STUDENT', :user_id, :title, :message, :link, 'FEES', 'FEE_PAYMENT_RECORDED', 0)
                ");
                foreach ($studentUserIds as $suId) {
                    $stmtInsert->execute([
                        ':school_id' => $schoolId,
                        ':user_id' => $suId,
                        ':title' => $title,
                        ':message' => $message,
                        ':link' => "/student/fees"
                    ]);
                    \App\Shared\Notifications\PushDispatcher::pushOnly(
                        $pdo, $schoolId, 'STUDENT', (int)$suId, 'FEE_PAYMENT_RECORDED', $title, $message, '/student/fees'
                    );
                }
            }
        }

        // 3. Notify Parent User accounts (match by phone)
        if (!empty($phones)) {
            $placeholders = [];
            $params = [':sid' => $schoolId];
            foreach (array_values($phones) as $idx => $ph) {
                $k = ":pph_" . $idx;
                $placeholders[] = $k;
                $params[$k] = $ph;
            }
            $sqlParent = "SELECT DISTINCT id FROM users WHERE school_id = :sid AND role = 'PARENT' AND phone IN (" . implode(',', $placeholders) . ")";
            $stmtParentUsers = $pdo->prepare($sqlParent);
            $stmtParentUsers->execute($params);
            $parentUserIds = array_map('intval', $stmtParentUsers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($parentUserIds)) {
                $stmtInsert = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
                    VALUES (:school_id, 'PARENT', :user_id, :title, :message, :link, 'FEES', 'FEE_PAYMENT_RECORDED', 0)
                ");
                foreach ($parentUserIds as $puId) {
                    $stmtInsert->execute([
                        ':school_id' => $schoolId,
                        ':user_id' => $puId,
                        ':title' => $title,
                        ':message' => $message,
                        ':link' => "/student/fees"
                    ]);
                    \App\Shared\Notifications\PushDispatcher::pushOnly(
                        $pdo, $schoolId, 'PARENT', (int)$puId, 'FEE_PAYMENT_RECORDED', $title, $message, '/student/fees'
                    );
                }
            }
        }
    }

    private function notifyClassStudents(PDO $pdo, int $schoolId, int $classId, string $title, string $message): void
    {
        $stmtStudents = $pdo->prepare("
            SELECT s.email, s.parent_phone, s.father_phone, s.guardian_phone, s.student_mobile 
            FROM students s 
            WHERE s.school_id = :sid AND s.class_id = :cid AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE') AND s.exit_date IS NULL
        ");
        $stmtStudents->execute([':sid' => $schoolId, ':cid' => $classId]);
        $rows = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return;
        }

        $emails = array_unique(array_filter(array_column($rows, 'email')));
        $phones = [];
        foreach ($rows as $r) {
            if (!empty($r['parent_phone'])) $phones[] = trim((string)$r['parent_phone']);
            if (!empty($r['father_phone'])) $phones[] = trim((string)$r['father_phone']);
            if (!empty($r['guardian_phone'])) $phones[] = trim((string)$r['guardian_phone']);
            if (!empty($r['student_mobile'])) $phones[] = trim((string)$r['student_mobile']);
        }
        $phones = array_unique(array_filter($phones));

        // Find Student users by email or phone
        $studentUserIds = [];
        if (!empty($emails) || !empty($phones)) {
            $conditions = [];
            $params = [':sid' => $schoolId];
            if (!empty($emails)) {
                $placeholders = [];
                foreach (array_values($emails) as $idx => $e) {
                    $k = ":e_" . $idx;
                    $placeholders[] = $k;
                    $params[$k] = $e;
                }
                $conditions[] = "email IN (" . implode(',', $placeholders) . ")";
            }
            if (!empty($phones)) {
                $placeholders = [];
                foreach (array_values($phones) as $idx => $p) {
                    $k = ":p_" . $idx;
                    $placeholders[] = $k;
                    $params[$k] = $p;
                }
                $conditions[] = "phone IN (" . implode(',', $placeholders) . ")";
            }

            $sql = "SELECT DISTINCT id FROM users WHERE school_id = :sid AND role = 'STUDENT' AND (" . implode(' OR ', $conditions) . ")";
            $stmtStudentUsers = $pdo->prepare($sql);
            $stmtStudentUsers->execute($params);
            $studentUserIds = array_map('intval', $stmtStudentUsers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($studentUserIds)) {
                $stmtIns = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
                    VALUES (?, 'STUDENT', ?, ?, ?, '/timetable', 'TIMETABLE', 'TIMETABLE_UPDATED', 0)
                ");
                foreach ($studentUserIds as $uid) {
                    $stmtIns->execute([$schoolId, $uid, $title, $message]);
                    \App\Shared\Notifications\PushDispatcher::pushOnly(
                        $pdo, $schoolId, 'STUDENT', (int)$uid, 'TIMETABLE_UPDATED', $title, $message, '/timetable'
                    );
                }
            }
        }

        // Find Parent users by phone
        if (!empty($phones)) {
            $placeholders = [];
            $params = [':sid' => $schoolId];
            foreach (array_values($phones) as $idx => $p) {
                $k = ":par_p_" . $idx;
                $placeholders[] = $k;
                $params[$k] = $p;
            }
            $sqlParent = "SELECT DISTINCT id FROM users WHERE school_id = :sid AND role = 'PARENT' AND phone IN (" . implode(',', $placeholders) . ")";
            $stmtParentUsers = $pdo->prepare($sqlParent);
            $stmtParentUsers->execute($params);
            $parentUserIds = array_map('intval', $stmtParentUsers->fetchAll(PDO::FETCH_COLUMN) ?: []);

            if (!empty($parentUserIds)) {
                $stmtIns = $pdo->prepare("
                    INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
                    VALUES (?, 'PARENT', ?, ?, ?, '/timetable', 'TIMETABLE', 'TIMETABLE_UPDATED', 0)
                ");
                foreach ($parentUserIds as $uid) {
                    $stmtIns->execute([$schoolId, $uid, $title, $message]);
                    \App\Shared\Notifications\PushDispatcher::pushOnly(
                        $pdo, $schoolId, 'PARENT', (int)$uid, 'TIMETABLE_UPDATED', $title, $message, '/timetable'
                    );
                }
            }
        }
    }

    private function notifyTeacherUser(PDO $pdo, int $schoolId, int $teacherId, string $title, string $message): void
    {
        $stmtStaff = $pdo->prepare("SELECT phone, email FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtStaff->execute([':id' => $teacherId, ':sid' => $schoolId]);
        $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
        if (!$staff) return;

        $phone = $staff['phone'] ?? null;
        $email = $staff['email'] ?? null;

        $stmtUser = $pdo->prepare("
            SELECT DISTINCT id FROM users 
            WHERE school_id = :sid AND role = 'TEACHER' AND (
                (phone IS NOT NULL AND phone != '' AND phone = :phone) OR 
                (email IS NOT NULL AND email != '' AND email = :email)
            )
        ");
        $stmtUser->execute([':sid' => $schoolId, ':phone' => $phone, ':email' => $email]);
        $userIds = array_map('intval', $stmtUser->fetchAll(PDO::FETCH_COLUMN) ?: []);

        if (!empty($userIds)) {
            $stmtIns = $pdo->prepare("
                INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
                VALUES (:sid, 'TEACHER', :uid, :title, :msg, '/timetable', 'TIMETABLE', 'TIMETABLE_UPDATED', 0)
            ");
            foreach ($userIds as $userId) {
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':uid' => $userId,
                    ':title' => $title,
                    ':msg' => $message
                ]);
                \App\Shared\Notifications\PushDispatcher::pushOnly(
                    $pdo, $schoolId, 'TEACHER', (int)$userId, 'TIMETABLE_UPDATED', $title, $message, '/timetable'
                );
            }
        }
    }

    public function getMenuPermissions(array $user): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Get working academic year
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // Get all active/available teachers for the school
        $stmt = $pdo->prepare("
            SELECT id, name, employee_id, phone, role, department, status
            FROM staff 
            WHERE school_id = :sid 
              AND (academic_year_id = :ayid OR academic_year_id IS NULL OR academic_year_id = 0)
              AND (UPPER(status) = 'ACTIVE' OR UPPER(status) = 'AVAILABLE' OR status IS NULL OR status = '')
            ORDER BY name ASC
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $teachers = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // Fallback: If no teacher matches strict academic_year_id, get all non-inactive teachers in the school
        if (empty($teachers)) {
            $stmtFallback = $pdo->prepare("
                SELECT id, name, employee_id, phone, role, department, status
                FROM staff 
                WHERE school_id = :sid 
                  AND (UPPER(status) != 'INACTIVE' AND UPPER(status) != 'DELETED' OR status IS NULL OR status = '')
                ORDER BY name ASC
            ");
            $stmtFallback->execute([':sid' => $schoolId]);
            $teachers = $stmtFallback->fetchAll(\PDO::FETCH_ASSOC);
        }

        // Fetch permissions for each teacher
        foreach ($teachers as &$t) {
            $stmtPerms = $pdo->prepare("
                SELECT menu_label 
                FROM teacher_menu_permissions 
                WHERE school_id = :sid AND teacher_id = :tid
            ");
            $stmtPerms->execute([':sid' => $schoolId, ':tid' => $t['id']]);
            $t['menus'] = $stmtPerms->fetchAll(\PDO::FETCH_COLUMN) ?: [];
        }

        return [
            'teachers' => $teachers
        ];
    }

    public function saveMenuPermissions(array $user, array $data): array
    {
        $userRole = strtolower($user['role'] ?? '');
        if ($userRole !== 'school_admin' && $userRole !== 'admin') {
            throw new \App\Shared\Exceptions\ValidationException(['permission' => 'Only School Admin has permission to assign user roles and menu permissions.']);
        }

        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        $teacherId = isset($data['teacher_id']) ? (int)$data['teacher_id'] : null;
        $menus = isset($data['menus']) && is_array($data['menus']) ? $data['menus'] : [];

        if (!$teacherId) {
            throw new \App\Shared\Exceptions\ValidationException('Teacher ID is required');
        }

        // Get teacher name for logging
        $stmtTeacher = $pdo->prepare("SELECT name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtTeacher->execute([':id' => $teacherId, ':sid' => $schoolId]);
        $teacherName = $stmtTeacher->fetchColumn() ?: 'Teacher';

        $pdo->beginTransaction();
        try {
            // Delete current permissions
            $stmtDel = $pdo->prepare("DELETE FROM teacher_menu_permissions WHERE school_id = :sid AND teacher_id = :tid");
            $stmtDel->execute([':sid' => $schoolId, ':tid' => $teacherId]);

            // Insert new permissions
            if (!empty($menus)) {
                $stmtInsert = $pdo->prepare("
                    INSERT INTO teacher_menu_permissions (school_id, teacher_id, menu_label)
                    VALUES (:sid, :tid, :label)
                ");
                foreach ($menus as $m) {
                    $stmtInsert->execute([
                        ':sid' => $schoolId,
                        ':tid' => $teacherId,
                        ':label' => trim($m)
                    ]);
                }
                $desc = "Updated menu permissions for teacher {$teacherName}: " . implode(', ', $menus);
            } else {
                $desc = "Removed all menu permissions for teacher {$teacherName}";
            }

            // Log Audit
            $this->logAudit($pdo, $user, 'Audits & Settings', 'Assign User Role', $desc);

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    public function getClassTeacherAssignments(array $user): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // Get working academic year
        $requestYearId = $_SERVER['HTTP_X_ACADEMIC_YEAR_ID'] ?? $_SERVER['X_ACADEMIC_YEAR_ID'] ?? null;
        $workingYear = null;
        if ($requestYearId !== null && is_numeric($requestYearId)) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => (int)$requestYearId, ':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        if (!$workingYear) {
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND is_current = 1 LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(\PDO::FETCH_ASSOC);
        }
        $academicYearId = $workingYear ? (int)$workingYear['id'] : 0;

        // Get all classes of this active academic year
        $stmtClasses = $pdo->prepare("
            SELECT id, name, section, stream
            FROM classes 
            WHERE school_id = :sid AND academic_year_id = :ayid
            ORDER BY name ASC, section ASC
        ");
        $stmtClasses->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $classes = $stmtClasses->fetchAll(\PDO::FETCH_ASSOC);

        // Get all active teachers of this academic year for dropdown list
        $stmtTeachers = $pdo->prepare("
            SELECT id, name, phone, employee_id, department
            FROM staff 
            WHERE school_id = :sid AND academic_year_id = :ayid AND (role = 'TEACHER' OR role = 'Teacher') AND status = 'ACTIVE'
            ORDER BY name ASC
        ");
        $stmtTeachers->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $teachers = $stmtTeachers->fetchAll(\PDO::FETCH_ASSOC);

        // Fetch assignments
        foreach ($classes as &$c) {
            $stmtAssign = $pdo->prepare("
                SELECT cta.teacher_id, s.name AS teacher_name
                FROM class_teacher_assignments cta
                JOIN staff s ON cta.teacher_id = s.id
                WHERE cta.school_id = :sid AND cta.class_id = :cid
            ");
            $stmtAssign->execute([':sid' => $schoolId, ':cid' => $c['id']]);
            $assignment = $stmtAssign->fetch(\PDO::FETCH_ASSOC);
            if ($assignment) {
                $c['assigned_teacher_id'] = (int)$assignment['teacher_id'];
                $c['assigned_teacher_name'] = $assignment['teacher_name'];
            } else {
                $c['assigned_teacher_id'] = null;
                $c['assigned_teacher_name'] = null;
            }
        }
        unset($c);

        $this->sortClassesNaturally($classes);

        return [
            'classes' => $classes,
            'teachers' => $teachers
        ];
    }

    private function sortClassesNaturally(array &$classes): void
    {
        usort($classes, function ($a, $b) {
            $nameA = trim((string)($a['name'] ?? ''));
            $nameB = trim((string)($b['name'] ?? ''));
            $secA  = trim((string)($a['section'] ?? ''));
            $secB  = trim((string)($b['section'] ?? ''));

            preg_match('/\d+/', $nameA, $matchA);
            preg_match('/\d+/', $nameB, $matchB);

            $numA = isset($matchA[0]) ? (int)$matchA[0] : null;
            $numB = isset($matchB[0]) ? (int)$matchB[0] : null;

            $getPrePrimaryRank = function ($name) {
                $lower = strtolower($name);
                if (str_contains($lower, 'play')) return 1;
                if (str_contains($lower, 'nurs')) return 2;
                if (str_contains($lower, 'lkg'))  return 3;
                if (str_contains($lower, 'ukg'))  return 4;
                if (str_contains($lower, 'kg'))   return 5;
                if (str_contains($lower, 'prep')) return 6;
                return 999;
            };

            $rankA = $getPrePrimaryRank($nameA);
            $rankB = $getPrePrimaryRank($nameB);

            if ($rankA !== 999 || $rankB !== 999) {
                if ($rankA !== $rankB) {
                    return $rankA <=> $rankB;
                }
            }

            if ($numA !== null && $numB !== null) {
                if ($numA !== $numB) {
                    return $numA <=> $numB;
                }
            } elseif ($numA !== null && $numB === null) {
                return 1;
            } elseif ($numA === null && $numB !== null) {
                return -1;
            }

            $cmpName = strnatcasecmp($nameA, $nameB);
            if ($cmpName !== 0) {
                return $cmpName;
            }

            return strnatcasecmp($secA, $secB);
        });
    }

    public function saveClassTeacherAssignments(array $user, array $data): array
    {
        $userRole = strtolower($user['role'] ?? '');
        if ($userRole !== 'school_admin' && $userRole !== 'admin') {
            throw new \App\Shared\Exceptions\ValidationException(['permission' => 'Only School Admin has permission to assign user roles and menu permissions.']);
        }

        $pdo = $this->classRepo->getPdo();
        $schoolId = $this->getSchoolId($user);

        // We expect an array of assignments, e.g. [{class_id: 1, teacher_id: 2}, ...]
        $assignments = isset($data['assignments']) && is_array($data['assignments']) ? $data['assignments'] : [];

        $pdo->beginTransaction();
        try {
            // First check if there is any teacher duplicate assignment *within* this payload itself
            $payloadTeachers = [];
            foreach ($assignments as $a) {
                $classId = isset($a['class_id']) ? (int)$a['class_id'] : null;
                $teacherId = isset($a['teacher_id']) ? (int)$a['teacher_id'] : null;
                if ($classId && $teacherId) {
                    if (isset($payloadTeachers[$teacherId])) {
                        // Duplicate teacher in payload
                        $stmtTeacher = $pdo->prepare("SELECT name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
                        $stmtTeacher->execute([':id' => $teacherId, ':sid' => $schoolId]);
                        $tName = $stmtTeacher->fetchColumn() ?: 'This teacher';
                        
                        $pdo->rollBack();
                        throw new \App\Shared\Exceptions\ValidationException([
                            'assignments' => "{$tName} is assigned to multiple classes in the request. One teacher can only be assigned to one class."
                        ]);
                    }
                    $payloadTeachers[$teacherId] = $classId;
                }
            }

            // Verify teacher uniqueness check from the DB (excluding unassigned)
            foreach ($assignments as $a) {
                $classId = isset($a['class_id']) ? (int)$a['class_id'] : null;
                $teacherId = isset($a['teacher_id']) ? (int)$a['teacher_id'] : null;

                if ($classId && $teacherId) {
                    // Check if teacher is already assigned to another class
                    $stmtCheck = $pdo->prepare("
                        SELECT cta.class_id, c.name, c.section 
                        FROM class_teacher_assignments cta
                        JOIN classes c ON cta.class_id = c.id
                        WHERE cta.school_id = :sid AND cta.teacher_id = :tid AND cta.class_id != :cid
                    ");
                    $stmtCheck->execute([':sid' => $schoolId, ':tid' => $teacherId, ':cid' => $classId]);
                    $exists = $stmtCheck->fetch(\PDO::FETCH_ASSOC);

                    if ($exists) {
                        $clsName = $exists['name'] . ($exists['section'] ? '-' . $exists['section'] : '');
                        $stmtTeacher = $pdo->prepare("SELECT name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
                        $stmtTeacher->execute([':id' => $teacherId, ':sid' => $schoolId]);
                        $tName = $stmtTeacher->fetchColumn() ?: 'This teacher';

                        $pdo->rollBack();
                        throw new \App\Shared\Exceptions\ValidationException([
                            'assignments' => "{$tName} is already assigned to {$clsName}. One teacher can only be assigned to one class."
                        ]);
                    }
                }
            }

            // Save / delete assignments
            foreach ($assignments as $a) {
                $classId = isset($a['class_id']) ? (int)$a['class_id'] : null;
                $teacherId = isset($a['teacher_id']) ? (int)$a['teacher_id'] : null;

                if ($classId) {
                    // Get class name
                    $stmtClass = $pdo->prepare("SELECT name, section FROM classes WHERE id = :id LIMIT 1");
                    $stmtClass->execute([':id' => $classId]);
                    $cls = $stmtClass->fetch(\PDO::FETCH_ASSOC);
                    $clsName = $cls ? ($cls['name'] . ($cls['section'] ? '-' . $cls['section'] : '')) : "Class";

                    // Check previous assignment
                    $stmtPrev = $pdo->prepare("
                        SELECT cta.teacher_id, s.name 
                        FROM class_teacher_assignments cta
                        JOIN staff s ON cta.teacher_id = s.id
                        WHERE cta.school_id = :sid AND cta.class_id = :cid
                    ");
                    $stmtPrev->execute([':sid' => $schoolId, ':cid' => $classId]);
                    $prev = $stmtPrev->fetch(\PDO::FETCH_ASSOC);

                    if ($teacherId === null || $teacherId === 0 || $teacherId === '') {
                        // Delete assignment
                        $stmtDel = $pdo->prepare("DELETE FROM class_teacher_assignments WHERE school_id = :sid AND class_id = :cid");
                        $stmtDel->execute([':sid' => $schoolId, ':cid' => $classId]);

                        if ($prev) {
                            $this->logAudit($pdo, $user, 'Audits & Settings', 'Assign User Role', "Removed class teacher assignment for {$clsName} (Previous: {$prev['name']})");
                        }
                    } else {
                        // Insert or Update assignment
                        $stmtTeacher = $pdo->prepare("SELECT name FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
                        $stmtTeacher->execute([':id' => $teacherId, ':sid' => $schoolId]);
                        $tName = $stmtTeacher->fetchColumn() ?: 'Teacher';

                        $stmtUpsert = $pdo->prepare("
                            INSERT INTO class_teacher_assignments (school_id, class_id, teacher_id)
                            VALUES (:sid, :cid, :tid)
                            ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)
                        ");
                        $stmtUpsert->execute([
                            ':sid' => $schoolId,
                            ':cid' => $classId,
                            ':tid' => $teacherId
                        ]);

                        if ($prev) {
                            if ((int)$prev['teacher_id'] !== $teacherId) {
                                $this->logAudit($pdo, $user, 'Audits & Settings', 'Assign User Role', "Replaced class teacher for {$clsName}: {$tName} replaces {$prev['name']}");
                            }
                        } else {
                            $this->logAudit($pdo, $user, 'Audits & Settings', 'Assign User Role', "Assigned {$tName} as class teacher of {$clsName}");
                        }
                    }
                }
            }

            $pdo->commit();
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['success' => true];
    }

    public function getMyPermissions(array $user): array
    {
        $pdo = $this->classRepo->getPdo();
        $schoolId = (int)$user['school_id'];
        $role = $user['role'] ?? '';

        if ($role === 'SCHOOL_ADMIN') {
            // SCHOOL_ADMIN has full permissions
            return [
                'role' => $role,
                'permissions' => [
                    'Dashboard', 'Classes', 'Teachers', 'Attendance', 'Achievements', 'Leave Requests', 
                    'Examinations', 'Fees Portal', 'Financial Reports', 'Finance Management', 
                    'Fee Follow-up', 'Timetable', 'Audits & Settings', 'Security'
                ]
            ];
        }

        if ($role === 'TEACHER') {
            // Find staff record
            $stmtUser = $pdo->prepare("SELECT phone FROM users WHERE id = :id LIMIT 1");
            $stmtUser->execute([':id' => $user['id']]);
            $phone = $stmtUser->fetchColumn();

            if (!$phone) {
                return ['role' => $role, 'permissions' => []];
            }

            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone ORDER BY id DESC LIMIT 1");
            $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone]);
            $staff = $stmtStaff->fetch();

            if (!$staff) {
                return ['role' => $role, 'permissions' => []];
            }

            $staffId = (int)$staff['id'];

            // Fetch permissions
            $stmtPerms = $pdo->prepare("
                SELECT menu_label 
                FROM teacher_menu_permissions 
                WHERE school_id = :sid AND teacher_id = :tid
            ");
            $stmtPerms->execute([':sid' => $schoolId, ':tid' => $staffId]);
            $perms = $stmtPerms->fetchAll(\PDO::FETCH_COLUMN) ?: [];

            return [
                'role' => $role,
                'permissions' => array_values(array_unique($perms))
            ];
        }

        return ['role' => $role, 'permissions' => []];
    }

    public function getAnnouncements(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $stmt = $pdo->prepare("
            SELECT * FROM announcements 
            WHERE school_id = :sid 
            ORDER BY created_at DESC
        ");
        $stmt->execute([':sid' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function createAnnouncement(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        $subject = isset($data['subject']) ? trim((string)$data['subject']) : '';
        $description = isset($data['description']) ? trim((string)$data['description']) : '';
        $audience = isset($data['audience']) ? trim((string)$data['audience']) : '';
        $status = isset($data['status']) ? trim((string)$data['status']) : 'Draft';

        // Validation
        if ($subject === '') {
            throw new ValidationException(['subject' => 'Subject is mandatory.']);
        }
        if (mb_strlen($subject) > 100) {
            throw new ValidationException(['subject' => 'Subject cannot exceed 100 characters.']);
        }
        
        // Strip tags to check if description has actual text content
        $textCheck = trim(strip_tags($description));
        if ($textCheck === '') {
            throw new ValidationException(['description' => 'Description is mandatory.']);
        }

        $validAudiences = ['Teachers', 'Students', 'Both'];
        if (!in_array($audience, $validAudiences, true)) {
            throw new ValidationException(['audience' => 'Audience selection is mandatory.']);
        }

        if ($status !== 'Draft' && $status !== 'Published') {
            $status = 'Draft';
        }

        $publishedAt = ($status === 'Published') ? date('Y-m-d H:i:s') : null;
        $actorName = $user['name'] ?? $user['phone'] ?? $user['email'] ?? 'School Admin';

        // Insert
        $stmt = $pdo->prepare("
            INSERT INTO announcements (school_id, subject, description, audience, status, published_at, created_by)
            VALUES (:sch, :sub, :desc, :aud, :status, :pub, :by)
        ");
        $stmt->execute([
            ':sch' => $schoolId,
            ':sub' => $subject,
            ':desc' => $description,
            ':aud' => $audience,
            ':status' => $status,
            ':pub' => $publishedAt,
            ':by' => $actorName
        ]);
        $announcementId = (int)$pdo->lastInsertId();

        // Broadcast notifications if published
        if ($status === 'Published') {
            $this->broadcastAnnouncementNotification($pdo, $schoolId, $subject, $description, $audience);
            $this->logAudit($pdo, $user, 'Announcements', 'Announcement Published', "Published announcement: '{$subject}'");
        } else {
            $this->logAudit($pdo, $user, 'Announcements', 'Announcement Draft Created', "Created announcement draft: '{$subject}'");
        }

        return ['id' => $announcementId, 'subject' => $subject, 'status' => $status];
    }

    public function updateAnnouncement(array $user, int $id, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        // Check if exists
        $stmtCheck = $pdo->prepare("SELECT * FROM announcements WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $ann = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$ann) {
            throw new NotFoundException('Announcement not found.');
        }

        $subject = isset($data['subject']) ? trim((string)$data['subject']) : '';
        $description = isset($data['description']) ? trim((string)$data['description']) : '';
        $audience = isset($data['audience']) ? trim((string)$data['audience']) : '';
        $status = isset($data['status']) ? trim((string)$data['status']) : $ann['status'];

        // Validation
        if ($subject === '') {
            throw new ValidationException(['subject' => 'Subject is mandatory.']);
        }
        if (mb_strlen($subject) > 100) {
            throw new ValidationException(['subject' => 'Subject cannot exceed 100 characters.']);
        }
        
        $textCheck = trim(strip_tags($description));
        if ($textCheck === '') {
            throw new ValidationException(['description' => 'Description is mandatory.']);
        }

        $validAudiences = ['Teachers', 'Students', 'Both'];
        if (!in_array($audience, $validAudiences, true)) {
            throw new ValidationException(['audience' => 'Audience selection is mandatory.']);
        }

        if ($status !== 'Draft' && $status !== 'Published') {
            $status = $ann['status'];
        }

        $publishedAt = $ann['published_at'];
        if ($status === 'Published' && $ann['status'] !== 'Published') {
            $publishedAt = date('Y-m-d H:i:s');
        } elseif ($status === 'Draft') {
            $publishedAt = null;
        }

        // Update
        $stmt = $pdo->prepare("
            UPDATE announcements 
            SET subject = :sub, description = :desc, audience = :aud, status = :status, published_at = :pub
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([
            ':sub' => $subject,
            ':desc' => $description,
            ':aud' => $audience,
            ':status' => $status,
            ':pub' => $publishedAt,
            ':id' => $id,
            ':sid' => $schoolId
        ]);

        // If newly published or updating an already published announcement, broadcast notification
        if ($status === 'Published') {
            $this->broadcastAnnouncementNotification($pdo, $schoolId, $subject, $description, $audience);
            $this->logAudit($pdo, $user, 'Announcements', 'Announcement Published', "Published announcement ID {$id}: '{$subject}'");
        } else {
            $this->logAudit($pdo, $user, 'Announcements', 'Announcement Edited', "Edited announcement ID {$id}: '{$subject}'");
        }

        return ['id' => $id, 'subject' => $subject, 'status' => $status];
    }

    public function deleteAnnouncement(array $user, int $id): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        // Check if exists
        $stmtCheck = $pdo->prepare("SELECT * FROM announcements WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $id, ':sid' => $schoolId]);
        $ann = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if (!$ann) {
            throw new NotFoundException('Announcement not found.');
        }

        // Delete
        $stmt = $pdo->prepare("DELETE FROM announcements WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);

        // Audit Logging
        $this->logAudit($pdo, $user, 'Announcements', 'Announcement Deleted', "Deleted announcement ID {$id}: '{$ann['subject']}'");

        return ['id' => $id];
    }

    private function broadcastAnnouncementNotification($pdo, $schoolId, $subject, $description, $audience): void
    {
        $rolesToNotify = [];
        if ($audience === 'Teachers') {
            $rolesToNotify = ['TEACHER'];
        } elseif ($audience === 'Students') {
            $rolesToNotify = ['PARENT', 'STUDENT'];
        } else {
            $rolesToNotify = ['TEACHER', 'PARENT', 'STUDENT'];
        }

        $plainText = trim(preg_replace('/\s+/', ' ', strip_tags($description)));
        if (mb_strlen($plainText) > 120) {
            $plainText = mb_substr($plainText, 0, 117) . '...';
        }

        $stmtNotif = $pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, is_read)
            VALUES (:sch, :role, :title, :msg, '/notice', 0)
        ");
        foreach ($rolesToNotify as $role) {
            $stmtNotif->execute([
                ':sch' => $schoolId,
                ':role' => $role,
                ':title' => $subject,
                ':msg' => $plainText
            ]);
        }
    }

    public function getLatePaymentPenaltyStats(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            return [
                'current_academic_session' => 'N/A',
                'total_students' => 0,
                'students_having_due' => 0,
                'total_outstanding_due' => 0.00,
                'last_applied_date' => null,
                'last_applied_by' => null,
            ];
        }

        // Get total students in current active session (ACTIVE or Inactive)
        $stmtTotal = $pdo->prepare("
            SELECT COUNT(*) FROM students 
            WHERE school_id = :sid AND academic_year_id = :ayid AND status IN ('ACTIVE', 'Inactive')
        ");
        $stmtTotal->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $totalStudents = (int)$stmtTotal->fetchColumn();

        // Get all students to calculate dues
        $stmtStudents = $pdo->prepare("
            SELECT id FROM students 
            WHERE school_id = :sid AND academic_year_id = :ayid AND status IN ('ACTIVE', 'Inactive')
        ");
        $stmtStudents->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $students = $stmtStudents->fetchAll(PDO::FETCH_COLUMN);

        $studentsHavingDue = 0;
        $totalOutstandingDue = 0.0;

        foreach ($students as $studentId) {
            $due = $this->getStudentCurrentOutstandingBalance($pdo, (int)$studentId, $schoolId, (int)$activeYear['id']);
            if ($due > 0) {
                $studentsHavingDue++;
                $totalOutstandingDue += $due;
            }
        }

        // Get last completed application
        $stmtLast = $pdo->prepare("
            SELECT a.created_at, u.name AS applied_by_name 
            FROM late_payment_penalty_applications a 
            JOIN users u ON a.created_by = u.id 
            WHERE a.school_id = :sid AND a.academic_year_id = :ayid AND a.status = 'Completed' 
            ORDER BY a.id DESC LIMIT 1
        ");
        $stmtLast->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $lastRun = $stmtLast->fetch(PDO::FETCH_ASSOC);

        // Get active processing application if any
        $stmtProcId = $pdo->prepare("
            SELECT id FROM late_payment_penalty_applications 
            WHERE school_id = :sid AND academic_year_id = :ayid AND status = 'Processing' 
            LIMIT 1
        ");
        $stmtProcId->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $activeProcessingId = $stmtProcId->fetchColumn();

        return [
            'current_academic_session' => $activeYear['name'],
            'total_students' => $totalStudents,
            'students_having_due' => $studentsHavingDue,
            'total_outstanding_due' => round($totalOutstandingDue, 2),
            'last_applied_date' => $lastRun ? $lastRun['created_at'] : null,
            'last_applied_by' => $lastRun ? $lastRun['applied_by_name'] : null,
            'active_processing_id' => $activeProcessingId !== false ? (int)$activeProcessingId : null,
        ];
    }

    public function getLatePaymentPenaltyConfig(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            return [
                'percentage' => '',
                'description' => '',
                'status' => 'Inactive'
            ];
        }

        $stmt = $pdo->prepare("
            SELECT * FROM late_payment_penalty_configs 
            WHERE school_id = :sid AND academic_year_id = :ayid LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$config) {
            return [
                'percentage' => '',
                'description' => '',
                'status' => 'Inactive'
            ];
        }

        return [
            'percentage' => (float)$config['percentage'],
            'description' => $config['description'] ?? '',
            'status' => $config['status']
        ];
    }

    public function saveLatePaymentPenaltyConfig(array $user, array $body): array
    {
        $percentage = isset($body['percentage']) ? (float)$body['percentage'] : 0.0;
        $description = isset($body['description']) ? trim((string)$body['description']) : '';
        $status = isset($body['status']) ? trim((string)$body['status']) : 'Active';

        if ($percentage <= 0 || $percentage > 100) {
            throw new ValidationException(['percentage' => 'Percentage must be between 0.01 and 100.']);
        }

        if ($status !== 'Active' && $status !== 'Inactive') {
            $status = 'Active';
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            throw new ValidationException(['academic_year' => 'Active academic session not found.']);
        }

        $stmt = $pdo->prepare("
            INSERT INTO late_payment_penalty_configs (school_id, academic_year_id, percentage, description, status)
            VALUES (:sid, :ayid, :pct, :desc, :status)
            ON DUPLICATE KEY UPDATE percentage = VALUES(percentage), description = VALUES(description), status = VALUES(status)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':ayid' => $activeYear['id'],
            ':pct' => $percentage,
            ':desc' => $description,
            ':status' => $status
        ]);

        return [
            'percentage' => $percentage,
            'description' => $description,
            'status' => $status
        ];
    }

    public function checkLatePaymentPenaltyConfig(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            return ['configured' => false];
        }

        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM late_payment_penalty_configs 
            WHERE school_id = :sid AND academic_year_id = :ayid AND status = 'Active'
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $count = (int)$stmt->fetchColumn();

        return ['configured' => $count > 0];
    }

    public function getLatePaymentPenaltyHistory(array $user, array $filters = []): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();

        $where = 'h.school_id = :sid';
        $bindings = [':sid' => $schoolId];

        if (!empty($filters['academic_year_id'])) {
            $where .= ' AND h.academic_year_id = :academic_year_id';
            $bindings[':academic_year_id'] = $filters['academic_year_id'];
        }
        if (!empty($filters['class_name'])) {
            $where .= ' AND h.class_name = :class_name';
            $bindings[':class_name'] = $filters['class_name'];
        }
        if (!empty($filters['section_name'])) {
            $where .= ' AND h.section_name = :section_name';
            $bindings[':section_name'] = $filters['section_name'];
        }
        if (!empty($filters['student_name'])) {
            $where .= ' AND h.student_name LIKE :student_name';
            $bindings[':student_name'] = '%' . $filters['student_name'] . '%';
        }
        if (!empty($filters['admission_no'])) {
            $where .= ' AND h.admission_no LIKE :admission_no';
            $bindings[':admission_no'] = '%' . $filters['admission_no'] . '%';
        }
        if (!empty($filters['date'])) {
            $where .= ' AND DATE(h.created_at) = :date';
            $bindings[':date'] = $filters['date'];
        }
        if (!empty($filters['applied_by_name'])) {
            $where .= ' AND h.applied_by_name LIKE :applied_by_name';
            $bindings[':applied_by_name'] = '%' . $filters['applied_by_name'] . '%';
        }

        $sql = "
            SELECT h.*, ay.name AS academic_year_name 
            FROM late_payment_penalty_history h
            LEFT JOIN academic_years ay ON h.academic_year_id = ay.id
            WHERE {$where}
            ORDER BY h.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($bindings);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($h) {
            $h['id'] = (int)$h['id'];
            $h['student_id'] = (int)$h['student_id'];
            $h['outstanding_due'] = (float)$h['outstanding_due'];
            $h['penalty_percentage'] = (float)$h['penalty_percentage'];
            $h['penalty_amount'] = (float)$h['penalty_amount'];
            return $h;
        }, $history);
    }

    public function deleteLatePaymentPenaltyConfig(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            throw new ValidationException(['academic_year' => 'Active academic session not found.']);
        }

        $stmt = $pdo->prepare("
            DELETE FROM late_payment_penalty_configs 
            WHERE school_id = :sid AND academic_year_id = :ayid
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);

        return ['deleted' => true];
    }

    public function getFinanceSettings(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            return [
                'enable_due_restriction' => 0,
                'max_allowed_due' => 0.00,
                'restrict_admit_card' => 1,
                'restrict_exam_result' => 1
            ];
        }

        $stmt = $pdo->prepare("
            SELECT * FROM school_finance_settings 
            WHERE school_id = :sid AND academic_year_id = :ayid LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $activeYear['id']]);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$settings) {
            return [
                'enable_due_restriction' => 0,
                'max_allowed_due' => 0.00,
                'restrict_admit_card' => 1,
                'restrict_exam_result' => 1
            ];
        }

        return [
            'enable_due_restriction' => (int)$settings['enable_due_restriction'],
            'max_allowed_due' => (float)$settings['max_allowed_due'],
            'restrict_admit_card' => (int)$settings['restrict_admit_card'],
            'restrict_exam_result' => (int)$settings['restrict_exam_result']
        ];
    }

    public function saveFinanceSettings(array $user, array $body): array
    {
        $enableRestriction = isset($body['enable_due_restriction']) ? (int)$body['enable_due_restriction'] : 0;
        $maxAllowedDue = isset($body['max_allowed_due']) ? (float)$body['max_allowed_due'] : 0.00;
        $restrictAdmitCard = isset($body['restrict_admit_card']) ? (int)$body['restrict_admit_card'] : 0;
        $restrictExamResult = isset($body['restrict_exam_result']) ? (int)$body['restrict_exam_result'] : 0;

        if ($maxAllowedDue < 0) {
            throw new ValidationException(['max_allowed_due' => 'Maximum allowed due amount cannot be negative.']);
        }

        $schoolId = $this->getSchoolId($user);
        $pdo = $this->studentRepo->getPdo();
        $activeYear = $this->getWorkingAcademicYear($pdo, $schoolId);

        if (!$activeYear) {
            throw new ValidationException(['academic_year' => 'Active academic session not found.']);
        }

        $stmt = $pdo->prepare("
            INSERT INTO school_finance_settings (school_id, academic_year_id, enable_due_restriction, max_allowed_due, restrict_admit_card, restrict_exam_result)
            VALUES (:sid, :ayid, :enable, :max_due, :restrict_ac, :restrict_er)
            ON DUPLICATE KEY UPDATE 
                enable_due_restriction = VALUES(enable_due_restriction), 
                max_allowed_due = VALUES(max_allowed_due),
                restrict_admit_card = VALUES(restrict_admit_card),
                restrict_exam_result = VALUES(restrict_exam_result)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':ayid' => $activeYear['id'],
            ':enable' => $enableRestriction,
            ':max_due' => $maxAllowedDue,
            ':restrict_ac' => $restrictAdmitCard,
            ':restrict_er' => $restrictExamResult
        ]);

        return [
            'enable_due_restriction' => $enableRestriction,
            'max_allowed_due' => $maxAllowedDue,
            'restrict_admit_card' => $restrictAdmitCard,
            'restrict_exam_result' => $restrictExamResult
        ];
    }

    /** Bytes of a stored file, for the ID-card media proxy. */
    public function getMediaContents(string $rawUrl): ?string
    {
        if ($rawUrl === '') {
            return null;
        }

        return $this->storage->readContents($rawUrl);
    }

    /** Guard for the media proxy — see StorageService::isOwnMedia(). */
    public function isOwnMedia(string $rawUrl): bool
    {
        return $this->storage->isOwnMedia($rawUrl);
    }

    public function mediaContentType(string $rawUrl): string
    {
        return $this->storage->contentTypeForPath($rawUrl);
    }

    // ---------------------------------------------------------------------
    // Account deletion requests (PF-04)
    // ---------------------------------------------------------------------

    /** Pending-first queue of deletion requests for the admin's own school. */
    public function getAccountDeletionRequests(array $user, array $filters = []): array
    {
        $pdo      = $this->studentRepo->getPdo();
        $schoolId = (int)$user['school_id'];

        $sql = "SELECT r.id, r.user_id, r.contact_name, r.contact_phone, r.reason,
                       r.status, r.resolution_note, r.resolved_at, r.created_at,
                       u.role AS user_role,
                       resolver.name AS resolved_by_name
                  FROM account_deletion_requests r
                  LEFT JOIN users u ON u.id = r.user_id
                  LEFT JOIN users resolver ON resolver.id = r.resolved_by
                 WHERE r.school_id = :sid";

        $params = ['sid' => $schoolId];

        $status = strtoupper(trim((string)($filters['status'] ?? '')));
        if (in_array($status, ['PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED'], true)) {
            $sql .= " AND r.status = :status";
            $params['status'] = $status;
        }

        // Pending first — this is a worklist, not an archive.
        $sql .= " ORDER BY (r.status = 'PENDING') DESC, r.id DESC LIMIT 500";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Resolve a request. COMPLETED performs the erasure; REJECTED just records
     * the decision.
     *
     * The erasure scrubs the login identity on the users row — name, phone,
     * email, password — and marks it DELETED so the account can no longer be
     * used. Attendance, fee and exam rows are left alone: they belong to the
     * school's records, and the decision behind this feature was that a user
     * cannot unilaterally destroy them. The phone is replaced rather than
     * nulled because the column is UNIQUE NOT NULL and other rows key off it.
     *
     * @throws ValidationException when the action is unknown or the request is
     *                             not pending.
     * @throws NotFoundException   when the request does not belong to this school.
     */
    public function resolveAccountDeletionRequest(array $user, int $requestId, string $action, ?string $note): array
    {
        $action = strtoupper(trim($action));
        if (!in_array($action, ['COMPLETED', 'REJECTED'], true)) {
            throw new ValidationException(['action' => 'Action must be COMPLETED or REJECTED.']);
        }

        $pdo      = $this->studentRepo->getPdo();
        $schoolId = (int)$user['school_id'];

        $stmt = $pdo->prepare(
            "SELECT id, user_id, status FROM account_deletion_requests
              WHERE id = :id AND school_id = :sid LIMIT 1"
        );
        $stmt->execute(['id' => $requestId, 'sid' => $schoolId]);
        $row = $stmt->fetch();

        if ($row === false) {
            throw new NotFoundException('Deletion request not found.');
        }
        if ($row['status'] !== 'PENDING') {
            throw new ValidationException(['status' => 'This request has already been resolved.']);
        }

        $targetUserId = (int)$row['user_id'];

        $pdo->beginTransaction();
        try {
            if ($action === 'COMPLETED') {
                $this->anonymiseUserAccount($pdo, $targetUserId);
            }

            $update = $pdo->prepare(
                "UPDATE account_deletion_requests
                    SET status = :status,
                        resolution_note = :note,
                        resolved_by = :by,
                        resolved_at = NOW()
                  WHERE id = :id"
            );
            $update->execute([
                'status' => $action,
                'note'   => ($note === null || $note === '') ? null : $note,
                'by'     => (int)$user['id'],
                'id'     => $requestId,
            ]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['id' => $requestId, 'status' => $action];
    }

    /**
     * Irreversibly strip the login identity from a users row.
     *
     * Keeps the row itself so every foreign key pointing at it stays valid —
     * deleting it would cascade through attendance and fee history.
     */
    private function anonymiseUserAccount(PDO $pdo, int $userId): void
    {
        // The phone column is UNIQUE, so the placeholder has to be unique too.
        $placeholder = 'deleted_' . $userId . '_' . bin2hex(random_bytes(4));

        $stmt = $pdo->prepare(
            "UPDATE users
                SET name = 'Deleted account',
                    phone = :phone,
                    email = NULL,
                    password = :password,
                    plain_password = NULL,
                    status = 'DELETED'
              WHERE id = :id"
        );
        $stmt->execute([
            'phone'    => substr($placeholder, 0, 20),
            // Not a usable credential: no plaintext hashes to this.
            'password' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
            'id'       => $userId,
        ]);

        // Any device still holding a token would otherwise keep receiving pushes.
        $pdo->prepare('DELETE FROM device_tokens WHERE user_id = :id')
            ->execute(['id' => $userId]);
    }
}


