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
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Pdf\SimplePdf;
use Psr\Log\LoggerInterface;
use PDO;

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

    public function getDashboard(int $userId, int $schoolId): array
    {
        $schedule = $this->getTodaySchedule($userId, $schoolId);
        $classes = $this->getMyClasses($userId, $schoolId, false);
        return [
            'schedule' => $schedule,
            'tasks' => [],
            'upcomingExams' => [],
            'classes' => $classes,
        ];
    }

    // -------------------------------------------------------------------------
    // Schedule / Classes
    // -------------------------------------------------------------------------

    /**
     * Return today's timetable entries for the authenticated teacher.
     */
    public function getTodaySchedule(int $teacherId, int $schoolId, ?string $date = null): array
    {
        $pdo = $this->teacherRepo->getPdo();
        $targetDate = $date ?? date('Y-m-d');
        $weekday = (new \DateTime($targetDate))->format('l');

        // Resolve teacher's staff ID using their user phone
        $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id LIMIT 1");
        $stmtUser->execute([':id' => $teacherId]);
        $userObj = $stmtUser->fetch();
        if (!$userObj || $userObj['role'] !== 'TEACHER') {
            return [];
        }
        $phone = $userObj['phone'];

        $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
        $stmtYear->execute([':sid' => $schoolId]);
        $workingYearId = $stmtYear->fetchColumn();
        if (!$workingYearId) {
            return [];
        }

        $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone");
        $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone]);
        $staffIds = array_map('intval', $stmtStaff->fetchAll(PDO::FETCH_COLUMN) ?: []);
        if (empty($staffIds) && isset($userObj['id'])) {
            $staffIds = [(int)$userObj['id']];
        }
        if (empty($staffIds)) {
            return [];
        }

        $inStaffIds = implode(',', $staffIds);

        // 1. Get the teacher's own scheduled periods for this weekday
        $stmtOwn = $pdo->prepare("
            SELECT t.*, c.name AS class_name, c.section AS class_section, s.name AS subject_name,
                   pc.start_time, pc.end_time
            FROM timetable t
            LEFT JOIN classes c ON t.class_id = c.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN period_configurations pc ON t.period_number = pc.period_number AND t.school_id = pc.school_id AND pc.end_date IS NULL
            WHERE t.teacher_id IN ({$inStaffIds})
              AND t.day_of_week = :day
              AND (t.start_date IS NULL OR t.start_date <= :tdate1)
              AND (t.end_date IS NULL OR t.end_date >= :tdate2)
              AND (
                t.is_published = 1 OR 
                EXISTS (SELECT 1 FROM timetable t2 WHERE t2.class_id = t.class_id AND t2.day_of_week = t.day_of_week AND t2.is_published = 1)
              )
        ");
        $stmtOwn->execute([':day' => $weekday, ':tdate1' => $targetDate, ':tdate2' => $targetDate]);
        $ownPeriods = $stmtOwn->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 2. Fetch backups where this teacher is assigned as a backup on this date
        $stmtBackup = $pdo->prepare("
            SELECT tb.id AS backup_record_id, t.*, c.name AS class_name, c.section AS class_section, s.name AS subject_name,
                   pc.start_time, pc.end_time
            FROM timetable_backups tb
            JOIN timetable t ON tb.timetable_id = t.id
            LEFT JOIN classes c ON t.class_id = c.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN period_configurations pc ON t.period_number = pc.period_number AND t.school_id = pc.school_id AND pc.end_date IS NULL
            WHERE tb.backup_teacher_id IN ({$inStaffIds})
              AND tb.date = :date
              AND (t.start_date IS NULL OR t.start_date <= :tdate1)
              AND (t.end_date IS NULL OR t.end_date >= :tdate2)
        ");
        $stmtBackup->execute([':date' => $targetDate, ':tdate1' => $targetDate, ':tdate2' => $targetDate]);
        $backupPeriods = $stmtBackup->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 3. Find if any of their own periods are replaced on this date
        $stmtReplaced = $pdo->prepare("
            SELECT timetable_id 
            FROM timetable_backups 
            WHERE date = :date AND school_id = :school_id
        ");
        $stmtReplaced->execute([':date' => $targetDate, ':school_id' => $schoolId]);
        $replacedTimetableIds = $stmtReplaced->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $replacedTimetableIds = array_map('intval', $replacedTimetableIds);

        // Filter out own periods that have been replaced
        $activeOwnPeriods = [];
        foreach ($ownPeriods as $op) {
            if (!in_array((int)$op['id'], $replacedTimetableIds, true)) {
                $op['is_backup'] = false;
                $op['room'] = 'Room ' . (100 + (int)$op['class_id']);
                $activeOwnPeriods[] = $op;
            }
        }

        // Format backup periods
        $formattedBackupPeriods = [];
        foreach ($backupPeriods as $bp) {
            $bp['is_backup'] = true;
            $bp['room'] = 'Room ' . (100 + (int)$bp['class_id']);
            $formattedBackupPeriods[] = $bp;
        }

        // 4. Combine both lists
        $combined = array_merge($activeOwnPeriods, $formattedBackupPeriods);

        // Sort by period_number
        usort($combined, function ($a, $b) {
            return (int)$a['period_number'] <=> (int)$b['period_number'];
        });

        // 5. Generate Free Periods from configurations
        $stmtPeriods = $pdo->prepare("
            SELECT * FROM period_configurations 
            WHERE school_id = :sid AND end_date IS NULL 
            ORDER BY period_number
        ");
        $stmtPeriods->execute([':sid' => $schoolId]);
        $periodConfigs = $stmtPeriods->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $periodsMap = [];
        foreach ($combined as $item) {
            $periodsMap[(int)$item['period_number']][] = $item;
        }

        $finalSchedule = [];
        foreach ($periodConfigs as $config) {
            $pNum = (int)$config['period_number'];
            if (isset($periodsMap[$pNum])) {
                foreach ($periodsMap[$pNum] as $item) {
                    $item['has_conflict'] = count($periodsMap[$pNum]) > 1;
                    $finalSchedule[] = $item;
                }
            } else {
                $finalSchedule[] = [
                    'is_free' => true,
                    'period_number' => $pNum,
                    'start_time' => $config['start_time'],
                    'end_time' => $config['end_time'],
                    'school_id' => $schoolId
                ];
            }
        }

        return $finalSchedule;
    }

    public function getMyClasses(int $teacherId, int $schoolId, bool $onlyAssigned = false): array
    {
        if ($onlyAssigned) {
            $pdo = $this->teacherRepo->getPdo();
            
            // Find staff record
            $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id LIMIT 1");
            $stmtUser->execute([':id' => $teacherId]);
            $userObj = $stmtUser->fetch();
            if (!$userObj || $userObj['role'] !== 'TEACHER') {
                return [];
            }
            $phone = $userObj['phone'];

            // Get working academic year
            $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
            $stmtYear->execute([':sid' => $schoolId]);
            $workingYearId = $stmtYear->fetchColumn();
            if (!$workingYearId) {
                return [];
            }

            $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
            $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $workingYearId, ':phone' => $phone]);
            $staff = $stmtStaff->fetch();
            if (!$staff) {
                return [];
            }
            $staffId = (int)$staff['id'];

            // Get the class assigned to this teacher
            $stmt = $pdo->prepare("
                SELECT c.*, ay.name AS academic_year_name
                FROM class_teacher_assignments cta
                JOIN classes c ON cta.class_id = c.id
                LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
                WHERE cta.teacher_id = :teacher_id AND cta.school_id = :school_id
            ");
            $stmt->execute([':teacher_id' => $staffId, ':school_id' => $schoolId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        $res = $this->teacherRepo->getClasses($teacherId, $schoolId);
        if (empty($res)) {
            $pdo = $this->teacherRepo->getPdo();
            $stmt = $pdo->prepare("
                SELECT c.*, ay.name AS academic_year_name 
                FROM classes c 
                LEFT JOIN academic_years ay ON c.academic_year_id = ay.id 
                WHERE c.school_id = :school_id 
                  AND (ay.is_current = 1 OR ay.status = 'ACTIVE' OR ay.id IS NULL)
                ORDER BY c.name ASC, c.id ASC
            ");
            $stmt->execute([':school_id' => $schoolId]);
            $res = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }
        return $res;
    }

    private function validateClassTeacherAssignment(\PDO $pdo, array $user, int $classId): void
    {
        $schoolId = (int)$user['school_id'];
        
        $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtUser->execute([':id' => $user['id'], ':sid' => $schoolId]);
        $userObj = $stmtUser->fetch();
        if (!$userObj || ($userObj['role'] !== 'TEACHER' && $userObj['role'] !== 'SCHOOL_ADMIN' && $userObj['role'] !== 'ADMIN')) {
            throw new \App\Shared\Exceptions\ForbiddenException("Access denied.");
        }
    }

    public function getOutstandingStudents(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->attendanceRepo->getPdo();

        // 1. Resolve staff ID for this teacher
        $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE phone = :phone AND school_id = :sid ORDER BY id DESC LIMIT 1");
        $stmtStaff->execute([':phone' => $user['phone'] ?? '', ':sid' => $schoolId]);
        $staffId = (int)$stmtStaff->fetchColumn();

        if ($staffId <= 0) {
            return [
                'has_class' => false,
                'class_id' => null,
                'class_name' => null,
                'section' => null,
                'full_class_name' => null,
                'students' => []
            ];
        }

        // 2. Resolve class assigned to this class teacher
        $stmtClass = $pdo->prepare("
            SELECT c.id, c.name, c.section, c.academic_year_id
            FROM class_teacher_assignments cta
            JOIN classes c ON cta.class_id = c.id
            WHERE cta.teacher_id = :tid AND cta.school_id = :sid
            LIMIT 1
        ");
        $stmtClass->execute([':tid' => $staffId, ':sid' => $schoolId]);
        $classRow = $stmtClass->fetch(\PDO::FETCH_ASSOC);

        if (!$classRow) {
            return [
                'has_class' => false,
                'class_id' => null,
                'class_name' => null,
                'section' => null,
                'full_class_name' => null,
                'students' => []
            ];
        }

        $classId = (int)$classRow['id'];
        $className = $classRow['name'] ?? '';
        $section = $classRow['section'] ?? '';
        $fullClassName = (!empty($section)) ? "{$className}-{$section}" : $className;

        $workingYearId = (int)($classRow['academic_year_id'] ?? 0);
        if ($workingYearId <= 0) {
            $stmtAY = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (is_current = 1 OR status = 'ACTIVE') LIMIT 1");
            $stmtAY->execute([':sid' => $schoolId]);
            $workingYearId = (int)$stmtAY->fetchColumn();
        }

        // 3. Fetch active students in class sorted by Roll No numeric ASC, then name ASC
        $stmtStu = $pdo->prepare("
            SELECT s.id, s.roll_no, s.first_name, s.middle_name, s.last_name, s.photo_path,
                   CASE 
                     WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                     ELSE 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                   END AS name
            FROM students s
            WHERE s.class_id = :cid AND s.school_id = :sid AND s.status = 'ACTIVE'
            ORDER BY CASE WHEN s.roll_no IS NULL OR s.roll_no = '' THEN 1 ELSE 0 END, CAST(s.roll_no AS UNSIGNED) ASC, name ASC
        ");
        $stmtStu->execute([':cid' => $classId, ':sid' => $schoolId]);
        $students = $stmtStu->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $resultList = [];
        foreach ($students as $stu) {
            $sId = (int)$stu['id'];
            $dues = $this->calculateStudentOutstandingBalance($pdo, $sId, $schoolId, $workingYearId);
            $resultList[] = [
                'id' => $sId,
                'name' => $stu['name'],
                'roll_no' => $stu['roll_no'] ?? '',
                'outstanding_amount' => (int)round($dues),
                'photo_path' => $stu['photo_path'] ?? ''
            ];
        }

        return [
            'has_class' => true,
            'class_id' => $classId,
            'class_name' => $className,
            'section' => $section,
            'full_class_name' => $fullClassName,
            'students' => $resultList
        ];
    }

    private function calculateStudentOutstandingBalance(\PDO $pdo, int $studentId, int $schoolId, int $academicYearId): float
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
        $cfgRow = $stmtCfg->fetch(\PDO::FETCH_ASSOC);
        $monthlyFees = [];
        if ($cfgRow) {
            $monthlyFees = json_decode($cfgRow['monthly_fees'], true) ?: [];
        }

        $stmtPaid = $pdo->prepare("
            SELECT fee_month FROM fee_payments 
            WHERE student_id = :student_id AND school_id = :school_id AND UPPER(status) = 'PAID' AND academic_year_id = :academic_year_id
        ");
        $stmtPaid->execute([
            ':student_id' => $studentId,
            ':school_id' => $schoolId,
            ':academic_year_id' => $academicYearId
        ]);
        $paidMonths = $stmtPaid->fetchAll(\PDO::FETCH_COLUMN) ?: [];
        $paidMonthsUpper = array_map('strtoupper', array_map('trim', $paidMonths));

        $monthsToEvaluate = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $stmtAY = $pdo->prepare("SELECT start_date, end_date, status FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
        $stmtAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
        $ayRow = $stmtAY->fetch(\PDO::FETCH_ASSOC);
        if ($ayRow && !empty($ayRow['start_date']) && !empty($ayRow['end_date'])) {
            $monthsToEvaluate = $this->getMonthsDueUpToCurrentHelper($ayRow['start_date'], $ayRow['end_date'], $ayRow['status']);
        }

        $outstanding = 0.0;
        foreach ($monthsToEvaluate as $m) {
            if (!in_array(strtoupper(trim($m)), $paidMonthsUpper, true)) {
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

    private function getMonthsDueUpToCurrentHelper(string $startDateStr, string $endDateStr, ?string $status = 'ACTIVE'): array
    {
        $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        
        if ($status === 'Archived') {
            return $academicMonths;
        }

        try {
            $now = new \DateTime();
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
        } catch (\Throwable $e) {
            return $academicMonths;
        }
    }

    /**
     * Return active students belonging to a class within the teacher's school.
     *
     * @throws ValidationException when class_id is missing.
     */
    public function getStudentList(int $schoolId, ?int $classId, array $user = []): array
    {
        if ($classId === null) {
            throw new ValidationException('class_id query parameter is required');
        }

        $pdo  = $this->attendanceRepo->getPdo();

        if (!empty($user)) {
            $this->validateClassTeacherAssignment($pdo, $user, $classId);
        }

        $stmt = $pdo->prepare("
            SELECT s.*,
                   CASE 
                     WHEN s.last_name = '.' OR s.last_name IS NULL OR TRIM(s.last_name) = '' THEN 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, '')))
                     ELSE 
                       TRIM(CONCAT(s.first_name, ' ', COALESCE(s.middle_name, ''), ' ', s.last_name))
                   END AS name,
                   c.name AS class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.class_id = :class_id AND s.school_id = :school_id AND s.status = 'ACTIVE'
            ORDER BY CASE WHEN s.roll_no IS NULL OR s.roll_no = '' THEN 1 ELSE 0 END, CAST(s.roll_no AS UNSIGNED) ASC, name
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
        $schoolId = (int)$user['school_id'];
        $pdo = $this->attendanceRepo->getPdo();

        $records = $data['students'] ?? $data['records'] ?? null;
        if (is_array($records) && !empty($records)) {
            $date = $data['date'] ?? date('Y-m-d');
            $classId = isset($data['class_id']) ? (int)$data['class_id'] : (isset($data['classId']) ? (int)$data['classId'] : null);

            if ($classId !== null) {
                $this->validateClassTeacherAssignment($pdo, $user, $classId);
            }

            // Boundary date validation (Strictly enforce active Academic Year)
            $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) ORDER BY is_current DESC, id DESC LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $workingYear = $stmt->fetch(PDO::FETCH_ASSOC);

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
                        ':school_id'  => $schoolId,
                        ':student_id' => $stId,
                        ':class_id'   => $stClassId,
                        ':date'       => $date,
                        ':status'     => $stStatus,
                        ':marked_by'  => (int) $user['id'],
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

        $studentId = isset($data['student_id']) ? (int) $data['student_id'] : null;

        if ($studentId === null) {
            throw new ValidationException('student_id is required');
        }

        $date    = $data['date']     ?? date('Y-m-d');
        $status  = $data['status']   ?? 'Present';
        $classId = isset($data['class_id']) ? (int) $data['class_id'] : null;

        if ($classId !== null) {
            $this->validateClassTeacherAssignment($pdo, $user, $classId);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) ORDER BY is_current DESC, id DESC LIMIT 1");
        $stmt->execute([':sid' => $schoolId]);
        $workingYear = $stmt->fetch(PDO::FETCH_ASSOC);

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

        if (strtolower((string)$status) === 'absent') {
            $this->dispatchAbsentNotifications($pdo, $schoolId, [$studentId]);
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

    public function getAttendanceHistory(int $teacherId, array $filters = [], array $user = []): array
    {
        $classId = isset($filters['class_id']) ? (int)$filters['class_id'] : null;
        if ($classId !== null && !empty($user)) {
            $pdo = $this->attendanceRepo->getPdo();
            $this->validateClassTeacherAssignment($pdo, $user, $classId);
        }
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

    public function getSalaries(int $userId, int $schoolId): array
    {
        $pdo = $this->teacherRepo->getPdo();

        $defaultSalaryResponse = [
            'current_year' => [
                'academic_year_name' => '2026–2027',
                'salary' => 0.0,
                'payments' => []
            ],
            'previous_year' => [
                'academic_year_name' => '',
                'salary' => 0.0,
                'has_unpaid' => false,
                'payments' => []
            ]
        ];

        // 1. Get user details (role and phone)
        $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id LIMIT 1");
        $stmtUser->execute([':id' => $userId]);
        $userObj = $stmtUser->fetch();
        if (!$userObj || $userObj['role'] !== 'TEACHER') {
            return $defaultSalaryResponse;
        }
        $phone = $userObj['phone'];

        // 2. Get working academic year
        $stmtYear = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) ORDER BY is_current DESC, id DESC LIMIT 1");
        $stmtYear->execute([':sid' => $schoolId]);
        $workingYear = $stmtYear->fetch();
        if (!$workingYear) {
            return $defaultSalaryResponse;
        }
        $currYearId = (int)$workingYear['id'];
        $currYearName = $workingYear['name'];
        $defaultSalaryResponse['current_year']['academic_year_name'] = $currYearName;

        // 3. Find active year staff record (fallback to any staff record by phone if academic_year_id differs)
        $stmtStaff = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND phone = :phone AND academic_year_id = :ayid LIMIT 1");
        $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone, ':ayid' => $currYearId]);
        $currStaff = $stmtStaff->fetch();
        if (!$currStaff) {
            $stmtStaff = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND phone = :phone ORDER BY id DESC LIMIT 1");
            $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone]);
            $currStaff = $stmtStaff->fetch();
        }
        if (!$currStaff) {
            return $defaultSalaryResponse;
        }
        $currStaffId = (int)$currStaff['id'];
        $currSalary = (float)($currStaff['salary'] ?? 0.0);

        // Find previous academic year & previous staff record
        $stmtPrevYear = $pdo->prepare("
            SELECT * FROM academic_years 
            WHERE school_id = :sid AND id < :ayid 
            ORDER BY id DESC LIMIT 1
        ");
        $stmtPrevYear->execute([':sid' => $schoolId, ':ayid' => $currYearId]);
        $prevYear = $stmtPrevYear->fetch();
        $prevStaff = null;
        if ($prevYear) {
            $stmtPrevStaff = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
            $stmtPrevStaff->execute([':sid' => $schoolId, ':ayid' => (int)$prevYear['id'], ':phone' => $phone]);
            $prevStaff = $stmtPrevStaff->fetch();
        }
        $prevStaffId = $prevStaff ? (int)$prevStaff['id'] : $currStaffId;
        $staffIds = array_filter(array_unique([$currStaffId, $prevStaffId]));
        if (!empty($currStaff['employee_id'])) {
            $stmtAllStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND employee_id = :emp_id");
            $stmtAllStaff->execute([':sid' => $schoolId, ':emp_id' => $currStaff['employee_id']]);
            $staffIds = array_filter(array_unique(array_merge($staffIds, $stmtAllStaff->fetchAll(PDO::FETCH_COLUMN))));
        } else if (!empty($currStaff['name'])) {
            $stmtAllStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND name = :name");
            $stmtAllStaff->execute([':sid' => $schoolId, ':name' => $currStaff['name']]);
            $staffIds = array_filter(array_unique(array_merge($staffIds, $stmtAllStaff->fetchAll(PDO::FETCH_COLUMN))));
        }
        $inStaffIds = implode(',', array_map('intval', $staffIds));

        // 4. Fetch paid months for current year
        $stmtPayments = $pdo->query("
            SELECT * FROM staff_payments 
            WHERE school_id = {$schoolId} 
              AND staff_id IN ({$inStaffIds}) 
              AND academic_year_id = {$currYearId}
              AND payment_month NOT LIKE 'Previous Year - %'
        ");
        $payments = $stmtPayments->fetchAll();
        $paymentsMap = [];
        foreach ($payments as $p) {
            $paymentsMap[$p['payment_month']] = $p;
        }

        // Generate months structure starting from teacher joining month
        $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $startMonthIndex = 0;
        if (!empty($currStaff['joining_date'])) {
            try {
                $joiningDate = new \DateTime($currStaff['joining_date']);
                $joiningYM = $joiningDate->format('Y-m');
                $ayStartYear = (int)date('Y', strtotime($workingYear['start_date'] ?? date('Y-04-01')));

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
        $currAcademicMonths = array_slice($allAcademicMonths, $startMonthIndex);

        // Fetch allowed leaves configuration for this school
        $stmtSett = $pdo->prepare("SELECT allowed_leaves FROM teacher_attendance_settings WHERE school_id = :sid LIMIT 1");
        $stmtSett->execute([':sid' => $schoolId]);
        $allowedLeavesRaw = $stmtSett->fetchColumn();
        $allowedLeaves = ($allowedLeavesRaw !== false && $allowedLeavesRaw !== null && $allowedLeavesRaw !== '') ? (int)$allowedLeavesRaw : 0;

        $monthMapNums = [
            'January' => '01', 'February' => '02', 'March' => '03',
            'April' => '04', 'May' => '05', 'June' => '06',
            'July' => '07', 'August' => '08', 'September' => '09',
            'October' => '10', 'November' => '11', 'December' => '12'
        ];

        $currentPayments = [];
        foreach ($currAcademicMonths as $month) {
            if (isset($paymentsMap[$month])) {
                $currentPayments[] = [
                    'id' => (int)$paymentsMap[$month]['id'],
                    'month' => $month,
                    'salary' => (float)$paymentsMap[$month]['amount_paid'],
                    'disbursed_date' => $paymentsMap[$month]['payment_date'],
                    'status' => 'Paid'
                ];
            } else {
                $staffIdForCalc = !empty($currStaff['id']) ? (int)$currStaff['id'] : 0;
                $monthSalary = $this->calculateStaffMonthlySalary($pdo, $schoolId, $staffIdForCalc, $currSalary, $month, $workingYear ?: []);

                $currentPayments[] = [
                    'id' => 0,
                    'month' => $month,
                    'salary' => $monthSalary,
                    'disbursed_date' => null,
                    'status' => 'Pending'
                ];
            }
        }

        // 5. Handle previous academic year
        $prevPayments = [];
        $hasUnpaidPrev = false;
        $prevYearName = '';

        if ($prevYear) {
            $prevYearId = (int)$prevYear['id'];
            $prevYearName = $prevYear['name'];
            $prevSalary = (float)($prevStaff['salary'] ?? $currSalary);

            // Fetch all staff_payments matching previous year
            $stmtOldPaid = $pdo->query("
                SELECT * FROM staff_payments 
                WHERE school_id = {$schoolId} 
                  AND staff_id IN ({$inStaffIds}) 
                  AND (academic_year_id = {$prevYearId} OR payment_month LIKE 'Previous Year - %')
            ");
            $oldPaidRecords = $stmtOldPaid->fetchAll() ?: [];

            $oldPaidMonthsMap = [];
            foreach ($oldPaidRecords as $opr) {
                $mStr = trim(str_replace('Previous Year - ', '', $opr['payment_month']));
                $subMs = array_map('trim', explode(',', $mStr));
                foreach ($subMs as $sm) {
                    $rangeParts = preg_split('/[-–]/', $sm);
                    if (count($rangeParts) > 1) {
                        $allM = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                        $sIdx = array_search(trim($rangeParts[0]), $allM);
                        $eIdx = array_search(trim($rangeParts[1]), $allM);
                        if ($sIdx !== false && $eIdx !== false) {
                            for ($i = $sIdx; $i <= $eIdx; $i++) {
                                $oldPaidMonthsMap[$allM[$i]] = $opr;
                            }
                        }
                    } else {
                        $oldPaidMonthsMap[$sm] = $opr;
                    }
                }
            }

            // Generate previous year months structure starting from joining month
            $prevAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
            $prevStartMonthIndex = 0;
            $prevJoiningDateStr = !empty($prevStaff['joining_date']) ? $prevStaff['joining_date'] : (!empty($currStaff['joining_date']) ? $currStaff['joining_date'] : null);
            if (!empty($prevJoiningDateStr)) {
                try {
                    $joiningDate = new \DateTime($prevJoiningDateStr);
                    $joiningYM = $joiningDate->format('Y-m');
                    $ayStartYear = (int)date('Y', strtotime($prevYear['start_date'] ?? date('Y-04-01')));

                    $monthMap = [
                        'January' => '01', 'February' => '02', 'March' => '03',
                        'April' => '04', 'May' => '05', 'June' => '06',
                        'July' => '07', 'August' => '08', 'September' => '09',
                        'October' => '10', 'November' => '11', 'December' => '12'
                    ];

                    foreach ($prevAcademicMonths as $idx => $mName) {
                        $mNum = $monthMap[$mName] ?? '01';
                        $mYear = ($idx >= 9) ? ($ayStartYear + 1) : $ayStartYear;
                        $targetYM = "{$mYear}-{$mNum}";
                        if ($targetYM >= $joiningYM) {
                            $prevStartMonthIndex = $idx;
                            break;
                        }
                    }
                } catch (\Exception $e) {
                    $prevStartMonthIndex = 0;
                }
            }
            $prevAcademicMonths = array_slice($prevAcademicMonths, $prevStartMonthIndex);

            foreach ($prevAcademicMonths as $month) {
                if (isset($oldPaidMonthsMap[$month])) {
                    $rec = $oldPaidMonthsMap[$month];
                    $prevPayments[] = [
                        'id' => (int)$rec['id'],
                        'month' => $month,
                        'salary' => (float)$rec['amount_paid'],
                        'disbursed_date' => $rec['payment_date'],
                        'status' => 'Paid'
                    ];
                } else {
                    $monthSalary = $prevSalary;
                    if (!empty($prevJoiningDateStr)) {
                        try {
                            $joiningMonthName = date('F', strtotime($prevJoiningDateStr));
                            if ($month === $joiningMonthName) {
                                $joiningDateObj = new \DateTime($prevJoiningDateStr);
                                $daysInMonth = (int)$joiningDateObj->format('t');
                                $dayNum = (int)$joiningDateObj->format('d');
                                $workedDays = ($daysInMonth - $dayNum) + 1;
                                if ($workedDays < $daysInMonth && $workedDays > 0) {
                                    $monthSalary = round(($workedDays / $daysInMonth) * $prevSalary);
                                }
                            }
                        } catch (\Exception $e) {}
                    }

                    $prevPayments[] = [
                        'id' => 0,
                        'month' => $month,
                        'salary' => $monthSalary,
                        'disbursed_date' => null,
                        'status' => 'Pending'
                    ];
                    $hasUnpaidPrev = true;
                }
            }
        }

        $prevSalary = $prevStaff ? (float)($prevStaff['salary'] ?? 0.0) : $currSalary;

        return [
            'academic_year' => $workingYear ? $workingYear['name'] : '—',
            'base_salary' => $currSalary,
            'allowed_leaves' => $allowedLeaves,
            'payments' => $currentPayments,
            'current_year' => [
                'academic_year_name' => $workingYear ? $workingYear['name'] : '—',
                'salary' => $currSalary,
                'payments' => $currentPayments
            ],
            'previous_year' => [
                'academic_year_name' => $prevYearName,
                'salary' => $prevSalary,
                'has_unpaid' => $hasUnpaidPrev,
                'payments' => $prevPayments
            ],
            'previous_year_pending' => $hasUnpaidPrev ? [
                'academic_year_id' => $prevYear ? (int)$prevYear['id'] : 0,
                'academic_year_name' => $prevYearName,
                'salary' => $prevSalary,
                'pending_months' => array_values(array_filter($prevAcademicMonths ?? [], fn($m) => !isset($oldPaidMonthsMap[$m]))),
                'valid_months' => $prevAcademicMonths ?? [],
                'joining_month_proration' => $joiningProrationData ?? null
            ] : null
        ];
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

    public function getSalarySlip(int $userId, int $schoolId, int $paymentId): array
    {
        $pdo = $this->teacherRepo->getPdo();

        // 1. Get user phone
        $stmtUser = $pdo->prepare("SELECT phone FROM users WHERE id = :id LIMIT 1");
        $stmtUser->execute([':id' => $userId]);
        $phone = $stmtUser->fetchColumn();
        if (!$phone) {
            throw new NotFoundException('User not found');
        }

        // 2. Fetch staff payment details
        $stmt = $pdo->prepare("
            SELECT sp.*, st.name AS staff_name, st.employee_id, sch.name AS school_name, sch.logo_path
            FROM staff_payments sp
            JOIN staff st ON sp.staff_id = st.id
            JOIN schools sch ON sp.school_id = sch.id
            WHERE sp.id = :id AND sp.school_id = :sid AND st.phone = :phone
            LIMIT 1
        ");
        $stmt->execute([':id' => $paymentId, ':sid' => $schoolId, ':phone' => $phone]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$payment) {
            throw new NotFoundException('Salary payment record not found');
        }

        // 3. Generate PDF content
        $pdf = new SimplePdf();
        
        $months = [
            '01' => 'January', '02' => 'February', '03' => 'March', '04' => 'April',
            '05' => 'May', '06' => 'June', '07' => 'July', '08' => 'August',
            '09' => 'September', '10' => 'October', '11' => 'November', '12' => 'December'
        ];
        
        // Format payment date
        $paymentDateFormatted = '—';
        if (!empty($payment['payment_date'])) {
            $parts = explode('-', $payment['payment_date']);
            if (count($parts) === 3) {
                $mWord = $months[$parts[1]] ?? '';
                $paymentDateFormatted = "{$parts[2]} {$mWord} {$parts[0]}";
            }
        }

        $lines = [
            "School: " . strtoupper($payment['school_name']),
            "Logo Path: " . ($payment['logo_path'] ?? ''),
            "---",
            "Employee Name: " . $payment['staff_name'],
            "Employee ID: " . ($payment['employee_id'] ?? '—'),
            "Month: " . $payment['payment_month'],
            "Amount Disbursed: INR " . number_format((float)$payment['amount_paid'], 2),
            "Disbursed Date: " . $paymentDateFormatted,
            "---",
            "Status: PAID",
            "---",
            "This is a computer-generated salary slip. No signature is required."
        ];

        $pdfData = $pdf->render("SALARY SLIP", $lines);
        $filename = "Salary_Slip_" . str_replace(' ', '_', $payment['payment_month']) . ".pdf";

        return [
            'data' => $pdfData,
            'filename' => $filename
        ];
    }

    private function getTeacherClassId(PDO $pdo, array $user, ?int $requestAyId = null): ?int
    {
        $schoolId = (int)$user['school_id'];
        $phone = trim((string)($user['phone'] ?? ''));
        $email = trim((string)($user['email'] ?? ''));

        $workingYearId = $requestAyId;
        if (!$workingYearId) {
            $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
            $stmtYear->execute([':sid' => $schoolId]);
            $workingYearId = $stmtYear->fetchColumn();
        }

        $staffId = null;
        if ($workingYearId) {
            if ($phone !== '' && $email !== '') {
                $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND (phone = :phone OR email = :email) LIMIT 1");
                $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $workingYearId, ':phone' => $phone, ':email' => $email]);
            } elseif ($phone !== '') {
                $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
                $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $workingYearId, ':phone' => $phone]);
            } elseif ($email !== '') {
                $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND email = :email LIMIT 1");
                $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $workingYearId, ':email' => $email]);
            } else {
                $stmtStaff = null;
            }
            if ($stmtStaff) {
                $staffId = $stmtStaff->fetchColumn();
            }
        }

        if (!$staffId) {
            if ($phone !== '' && $email !== '') {
                $stmtStaffFallback = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND (phone = :phone OR email = :email) ORDER BY id DESC LIMIT 1");
                $stmtStaffFallback->execute([':sid' => $schoolId, ':phone' => $phone, ':email' => $email]);
            } elseif ($phone !== '') {
                $stmtStaffFallback = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND phone = :phone ORDER BY id DESC LIMIT 1");
                $stmtStaffFallback->execute([':sid' => $schoolId, ':phone' => $phone]);
            } elseif ($email !== '') {
                $stmtStaffFallback = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND email = :email ORDER BY id DESC LIMIT 1");
                $stmtStaffFallback->execute([':sid' => $schoolId, ':email' => $email]);
            } else {
                $stmtStaffFallback = null;
            }
            if ($stmtStaffFallback) {
                $staffId = $stmtStaffFallback->fetchColumn();
            }
        }

        if (!$staffId) return null;

        // Check class_teacher_assignments
        $stmtAssign = $pdo->prepare("SELECT class_id FROM class_teacher_assignments WHERE school_id = :sid AND teacher_id = :tid LIMIT 1");
        $stmtAssign->execute([':sid' => $schoolId, ':tid' => (int)$staffId]);
        $classId = $stmtAssign->fetchColumn();

        return $classId ? (int)$classId : null;
    }

    public function getExamsList(array $user): array
    {
        $pdo = $this->teacherRepo->getPdo();
        $schoolId = (int)$user['school_id'];
        $classId = $this->getTeacherClassId($pdo, $user);

        // Fetch active working academic year
        $stmtAy = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) ORDER BY start_date DESC LIMIT 1");
        $stmtAy->execute([':sid' => $schoolId]);
        $academicYearId = (int)($stmtAy->fetchColumn() ?: 0);

        // Fetch all Published examinations for this school
        $sql = "
            SELECT DISTINCT e.id, e.name, e.start_date, e.end_date,
                   COALESCE(MAX(ecs.scheme_published), 0) AS scheme_published,
                   COALESCE(MAX(CASE WHEN ecs.status = 'Published' THEN 1 ELSE 0 END), 0) AS result_status_val
            FROM examinations e
            LEFT JOIN examination_class_status ecs ON e.id = ecs.exam_id " . ($classId ? "AND ecs.class_id = :class_id" : "") . "
            WHERE e.school_id = :school_id
              AND e.status = 'Published'
        ";
        $params = [':school_id' => $schoolId];
        if ($classId) {
            $params[':class_id'] = $classId;
        }

        if ($academicYearId > 0) {
            $sql .= " AND (e.academic_year_id = :ayid OR e.academic_year_id IS NULL)";
            $params[':ayid'] = $academicYearId;
        }

        $sql .= " GROUP BY e.id, e.name, e.start_date, e.end_date";
        $sql .= " ORDER BY 
            CASE 
              WHEN LOWER(e.name) LIKE '%quarterly%' THEN 1 
              WHEN LOWER(e.name) LIKE '%half%' THEN 2 
              WHEN LOWER(e.name) LIKE '%annual%' THEN 3 
              ELSE 4 
            END ASC, e.start_date ASC, e.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $exams = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $today = date('Y-m-d');
        foreach ($exams as &$e) {
            $e['id'] = (int)$e['id'];
            $e['scheme_published'] = (int)$e['scheme_published'];
            $e['result_published'] = (int)($e['result_status_val'] ?? 0);
            unset($e['result_status_val']);
            
            if ($e['start_date'] > $today) {
                $e['status'] = 'Upcoming';
            } elseif ($e['start_date'] <= $today && $e['end_date'] >= $today) {
                $e['status'] = 'Current';
            } else {
                $e['status'] = 'Completed';
            }
        }

        return $exams;
    }

    public function getExamDetails(array $user, int $examId): array
    {
        $pdo = $this->teacherRepo->getPdo();
        $schoolId = (int)$user['school_id'];
        $classId = $this->getTeacherClassId($pdo, $user);

        // Fallback: if teacher is not assigned to a class, pick the first class in this exam's timetable or school
        if (!$classId) {
            $stmtFirstClass = $pdo->prepare("SELECT class_id FROM examination_papers WHERE exam_id = :exam_id LIMIT 1");
            $stmtFirstClass->execute([':exam_id' => $examId]);
            $classId = (int)($stmtFirstClass->fetchColumn() ?: 0);
        }
        if (!$classId) {
            $stmtSchoolClass = $pdo->prepare("SELECT id FROM classes WHERE school_id = :sid LIMIT 1");
            $stmtSchoolClass->execute([':sid' => $schoolId]);
            $classId = (int)($stmtSchoolClass->fetchColumn() ?: 0);
        }

        // 1. Fetch exam publish status for this class
        $stmtStatus = $pdo->prepare("
            SELECT COALESCE(scheme_published, 0) AS scheme_published,
                   COALESCE(status, 'Draft') AS result_status
            FROM examination_class_status
            WHERE exam_id = :exam_id AND class_id = :class_id
            LIMIT 1
        ");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $statusInfo = $stmtStatus->fetch(PDO::FETCH_ASSOC);

        $schemePublished = $statusInfo ? (int)$statusInfo['scheme_published'] : 0;
        $resultPublished = ($statusInfo && $statusInfo['result_status'] === 'Published') ? 1 : 0;

        // Fetch Exam basic info (Requires Master Exam status = Published)
        $stmtExam = $pdo->prepare("
            SELECT e.name, e.start_date, e.end_date 
            FROM examinations e
            WHERE e.id = :id AND e.school_id = :sid AND e.status = 'Published'
            LIMIT 1
        ");
        $stmtExam->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtExam->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        $response = [
            'exam_name' => $exam['name'],
            'start_date' => $exam['start_date'],
            'end_date' => $exam['end_date'],
            'scheme_published' => $schemePublished,
            'result_published' => $resultPublished,
            'scheme' => null,
            'result' => null
        ];

        // Fetch current live scheme papers for teacher class
        $stmtScheme = $pdo->prepare("
            SELECT ep.id, ep.subject_id, ep.exam_date, ep.start_time, ep.end_time, ep.max_marks, ep.passing_marks, ep.room,
                   CASE WHEN ep.max_marks = 0 THEN 'grade' ELSE 'marks' END AS evaluation_type,
                   s.name AS subject_name
            FROM examination_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
            ORDER BY ep.exam_date ASC, ep.start_time ASC
        ");
        $stmtScheme->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $schemePapers = $stmtScheme->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $response['scheme'] = $schemePapers;
        $response['has_papers'] = !empty($schemePapers) ? 1 : 0;

        // Fetch all published class examination schemes for the school (sorted in logical class order)
        $stmtClasses = $pdo->prepare("
            SELECT DISTINCT c.id AS class_id, c.name, c.section, COALESCE(ecs.scheme_published, 0) AS scheme_published
            FROM examination_class_status ecs
            JOIN classes c ON ecs.class_id = c.id
            WHERE ecs.exam_id = :exam_id AND ecs.scheme_published = 1 AND c.school_id = :sid
        ");
        $stmtClasses->execute([':exam_id' => $examId, ':sid' => $schoolId]);
        $publishedClasses = $stmtClasses->fetchAll(PDO::FETCH_ASSOC) ?: [];

        usort($publishedClasses, function ($a, $b) {
            $nameA = trim(($a['name'] ?? '') . ' ' . ($a['section'] ?? ''));
            $nameB = trim(($b['name'] ?? '') . ' ' . ($b['section'] ?? ''));
            return strnatcasecmp($nameA, $nameB);
        });

        $publishedClassSchemes = [];
        foreach ($publishedClasses as $c) {
            $cid = (int)$c['class_id'];
            $cName = trim(($c['name'] ?? '') . ' ' . ($c['section'] ?? ''));
            $stmtScheme->execute([':exam_id' => $examId, ':class_id' => $cid]);
            $papers = $stmtScheme->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            $publishedClassSchemes[] = [
                'class_id' => $cid,
                'class_name' => $cName,
                'scheme' => $papers
            ];
        }
        $response['published_class_schemes'] = $publishedClassSchemes;

        // 3. Fetch result if published
        if ($resultPublished) {
            // Get all students in the class
            $stmtStudents = $pdo->prepare("
                SELECT id, roll_no, name FROM students 
                WHERE class_id = :class_id AND school_id = :sid
                ORDER BY CAST(roll_no AS UNSIGNED) ASC, name ASC
            ");
            $stmtStudents->execute([':class_id' => $classId, ':sid' => $schoolId]);
            $studentsList = $stmtStudents->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Get all marks for this class's exam papers
            $stmtMarks = $pdo->prepare("
                SELECT em.student_id, em.marks_obtained, em.is_absent, ep.max_marks, ep.passing_marks, s.name AS subject_name
                FROM examination_marks em
                JOIN examination_papers ep ON em.paper_id = ep.id
                JOIN subjects s ON ep.subject_id = s.id
                WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
            ");
            $stmtMarks->execute([':exam_id' => $examId, ':class_id' => $classId]);
            $marksList = $stmtMarks->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Group marks by student
            $marksByStudent = [];
            foreach ($marksList as $m) {
                $stId = (int)$m['student_id'];
                $marksByStudent[$stId][] = [
                    'subject_name' => $m['subject_name'],
                    'marks_obtained' => $m['marks_obtained'] !== null ? (float)$m['marks_obtained'] : null,
                    'is_absent' => (int)$m['is_absent'],
                    'max_marks' => (float)$m['max_marks'],
                    'passing_marks' => (float)$m['passing_marks']
                ];
            }

            // Assemble student results
            $resultsData = [];
            foreach ($studentsList as $st) {
                $stId = (int)$st['id'];
                $stMarks = $marksByStudent[$stId] ?? [];
                
                $totalMax = 0;
                $totalObtained = 0;
                $allPassed = true;
                
                foreach ($stMarks as $sm) {
                    $totalMax += $sm['max_marks'];
                    if (!$sm['is_absent'] && $sm['marks_obtained'] !== null) {
                        $totalObtained += $sm['marks_obtained'];
                        if ($sm['marks_obtained'] < $sm['passing_marks']) {
                            $allPassed = false;
                        }
                    } else {
                        $allPassed = false;
                    }
                }
                
                $resultsData[] = [
                    'student_id' => $stId,
                    'roll_number' => $st['roll_no'] ?? '',
                    'student_name' => $st['name'],
                    'papers' => $stMarks,
                    'total_max_marks' => $totalMax,
                    'total_marks_obtained' => $totalObtained,
                    'status' => (empty($stMarks)) ? 'No Marks' : ($allPassed ? 'Pass' : 'Fail')
                ];
            }

            $response['result'] = $resultsData;
        }

        return $response;
    }

    public function getMarksSheet(array $user, int $examId, int $subjectId): array
    {
        $pdo = $this->teacherRepo->getPdo();
        $classId = $this->getTeacherClassId($pdo, $user);
        if (!$classId) {
            throw new \App\Shared\Exceptions\ForbiddenException("No class Assigned to you yet.");
        }
        $schoolId = (int)$user['school_id'];

        // Fetch Exam
        $stmtCheck = $pdo->prepare("SELECT name FROM examinations WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmtCheck->execute([':id' => $examId, ':sid' => $schoolId]);
        $examName = $stmtCheck->fetchColumn();
        if (!$examName) {
            throw new NotFoundException('Examination not found.');
        }

        // Fetch Paper Details
        $stmtPaper = $pdo->prepare("SELECT ep.*, s.name AS subject_name FROM examination_papers ep JOIN subjects s ON ep.subject_id = s.id WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id AND ep.subject_id = :subid LIMIT 1");
        $stmtPaper->execute([':exam_id' => $examId, ':class_id' => $classId, ':subid' => $subjectId]);
        $paper = $stmtPaper->fetch(PDO::FETCH_ASSOC);
        if (!$paper) {
            throw new ValidationException(['subject_id' => 'This subject is not scheduled in the exam timetable for your class.']);
        }

        // Fetch Class Details
        $stmtClass = $pdo->prepare("SELECT name, section FROM classes WHERE id = :cid LIMIT 1");
        $stmtClass->execute([':cid' => $classId]);
        $classRow = $stmtClass->fetch(PDO::FETCH_ASSOC);
        $className = $classRow ? trim(($classRow['name'] ?? '') . ' ' . ($classRow['section'] ?? '')) : 'Class';

        // Check if report card / result status is published for this class
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $resultStatus = $stmtStatus->fetchColumn();
        $isResultPublished = ($resultStatus === 'Published');

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
            $marksMap[$sid] = $m;
        }

        $list = [];
        foreach ($students as $s) {
            $studentId = (int)$s['id'];
            $m = $marksMap[$studentId] ?? ['marks_obtained' => null, 'is_absent' => 0, 'remarks' => ''];
            $isGradePaper = ($paper['evaluation_type'] ?? '') === 'grade' || (float)$paper['max_marks'] == 0;
            $rawMarks = $m['marks_obtained'] ?? null;

            $list[] = [
                'student_id' => $studentId,
                'student_name' => $s['name'],
                'roll_no' => $s['roll_no'] ?? '',
                'marks_obtained' => ($rawMarks !== null && $rawMarks !== '') ? ($isGradePaper ? (string)$rawMarks : (float)$rawMarks) : null,
                'is_absent' => (int)$m['is_absent'],
                'remarks' => $m['remarks'] ?: ''
            ];
        }

        $stmtGrades = $pdo->prepare("SELECT grade FROM grade_configurations WHERE school_id = :sid ORDER BY min_percentage DESC");
        $stmtGrades->execute([':sid' => $schoolId]);
        $configuredGrades = $stmtGrades->fetchAll(PDO::FETCH_COLUMN) ?: [];
        if (empty($configuredGrades)) {
            $configuredGrades = ['A', 'B', 'C', 'D'];
        }

        return [
            'exam_name' => $examName,
            'class_name' => $className,
            'subject_name' => $paper['subject_name'],
            'evaluation_type' => $paper['evaluation_type'] ?? ((float)$paper['max_marks'] == 0 ? 'grade' : 'marks'),
            'max_marks' => (float)$paper['max_marks'],
            'passing_marks' => (float)$paper['passing_marks'],
            'available_grades' => array_values(array_unique($configuredGrades)),
            'is_result_published' => $isResultPublished,
            'students' => $list
        ];
    }

    public function saveMarksSheet(array $user, int $examId, array $data): array
    {
        $pdo = $this->teacherRepo->getPdo();
        $classId = $this->getTeacherClassId($pdo, $user);
        if (!$classId) {
            throw new \App\Shared\Exceptions\ForbiddenException("No class Assigned to you yet.");
        }
        $schoolId = (int)$user['school_id'];

        // Block updating marks if Report Card / Result is Published
        $stmtStatus = $pdo->prepare("SELECT status FROM examination_class_status WHERE exam_id = :exam_id AND class_id = :class_id LIMIT 1");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $resultStatus = $stmtStatus->fetchColumn();
        if ($resultStatus === 'Published') {
            throw new ValidationException(['result_status' => 'Cannot edit marks of a published class examination.'], 'Cannot edit marks of a published class examination.');
        }

        if (empty($data['subject_id'])) {
            throw new ValidationException(['subject_id' => 'Subject ID is required.']);
        }
        $subjectId = (int)$data['subject_id'];

        // Fetch Paper Details
        $stmtPaper = $pdo->prepare("SELECT * FROM examination_papers WHERE exam_id = :exam_id AND class_id = :class_id AND subject_id = :subid LIMIT 1");
        $stmtPaper->execute([':exam_id' => $examId, ':class_id' => $classId, ':subid' => $subjectId]);
        $paper = $stmtPaper->fetch(PDO::FETCH_ASSOC);
        if (!$paper) {
            throw new ValidationException(['subject_id' => 'Subject is not scheduled in the exam timetable.']);
        }

        $marksItems = $data['marks'] ?? [];
        if (!is_array($marksItems) || empty($marksItems)) {
            if (!empty($data['student_id'])) {
                $marksItems = [$data];
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

        $maxMarks = (float)$paper['max_marks'];
        $savedCount = 0;

        foreach ($marksItems as $item) {
            if (empty($item['student_id'])) continue;
            $studentId = (int)$item['student_id'];
            $isAbsent = !empty($item['is_absent']) ? 1 : 0;
            
            $isGradePaper = ($paper['evaluation_type'] ?? '') === 'grade' || (float)$paper['max_marks'] == 0;
            $rawMarks = $item['marks_obtained'] ?? null;
            if ($rawMarks !== null && $rawMarks !== '' && !$isAbsent) {
                if ($isGradePaper) {
                    $marksObtained = trim((string)$rawMarks);
                } else {
                    $marksObtained = (float)$rawMarks;
                    if ($marksObtained < 0) $marksObtained = 0;
                    if ($maxMarks > 0 && $marksObtained > $maxMarks) $marksObtained = $maxMarks;
                }
            } else {
                $marksObtained = null;
            }
            $remarks = $item['remarks'] ?? null;

            $stmtUpsert->execute([
                ':exam_id' => $examId,
                ':paper_id' => (int)$paper['id'],
                ':student_id' => $studentId,
                ':marks_obtained' => $marksObtained,
                ':is_absent' => $isAbsent,
                ':remarks' => $remarks
            ]);
            $savedCount++;
        }

        return ['saved_count' => $savedCount];
    }

    public function getNotifications(array $user, int $limit = 50, int $offset = 0): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? 'TEACHER');
        $pdo = $this->teacherRepo->getPdo();

        $stmt = $pdo->prepare("
            SELECT * FROM dashboard_notifications
            WHERE school_id = :school_id AND (user_id = :user_id OR (user_role = :role AND user_id IS NULL))
            ORDER BY id DESC
            LIMIT :limit OFFSET :offset
        ");
        $stmt->bindValue(':school_id', $schoolId, PDO::PARAM_INT);
        $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':role', $role, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function markNotificationRead(array $user, int $id, array $body = []): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? 'TEACHER');
        $pdo = $this->teacherRepo->getPdo();

        if ($id > 0) {
            $stmt = $pdo->prepare("
                UPDATE dashboard_notifications
                SET is_read = 1
                WHERE id = :id AND school_id = :school_id AND (user_id = :user_id OR (user_role = :role AND user_id IS NULL))
            ");
            $stmt->execute([
                ':id' => $id,
                ':school_id' => $schoolId,
                ':user_id' => $userId,
                ':role' => $role
            ]);
        } else {
            $eventKey = $body['event_key'] ?? '';
            $link = $body['link'] ?? '';
            $title = $body['title'] ?? '';

            if (!empty($eventKey) || !empty($link) || !empty($title)) {
                $query = "UPDATE dashboard_notifications SET is_read = 1 WHERE school_id = :sid AND is_read = 0 AND (user_id = :uid OR (user_role = :role AND user_id IS NULL))";
                $params = [':sid' => $schoolId, ':uid' => $userId, ':role' => $role];

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

        return ['status' => 'success', 'success' => true];
    }

    public function deleteNotification(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? 'TEACHER');
        $pdo = $this->teacherRepo->getPdo();

        $stmt = $pdo->prepare("
            DELETE FROM dashboard_notifications
            WHERE id = :id AND school_id = :school_id AND (user_id = :user_id OR (user_role = :role AND user_id IS NULL))
        ");
        $stmt->execute([
            ':id' => $id,
            ':school_id' => $schoolId,
            ':user_id' => $userId,
            ':role' => $role
        ]);
        return ['status' => 'success'];
    }
}
