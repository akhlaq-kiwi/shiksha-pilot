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

        return $this->teacherRepo->getClasses($teacherId, $schoolId);
    }

    private function validateClassTeacherAssignment(\PDO $pdo, array $user, int $classId): void
    {
        $schoolId = (int)$user['school_id'];
        
        // Find staff record
        $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id LIMIT 1");
        $stmtUser->execute([':id' => $user['id']]);
        $userObj = $stmtUser->fetch();
        if (!$userObj || $userObj['role'] !== 'TEACHER') {
            throw new \App\Shared\Exceptions\ForbiddenException("Access denied.");
        }
        $phone = $userObj['phone'];

        // Get working academic year
        $stmtYear = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
        $stmtYear->execute([':sid' => $schoolId]);
        $workingYearId = $stmtYear->fetchColumn();
        if (!$workingYearId) {
            throw new \App\Shared\Exceptions\ForbiddenException("No active academic year found.");
        }

        $stmtStaff = $pdo->prepare("SELECT id FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
        $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $workingYearId, ':phone' => $phone]);
        $staff = $stmtStaff->fetch();
        if (!$staff) {
            throw new \App\Shared\Exceptions\ForbiddenException("Staff record not found.");
        }
        $staffId = (int)$staff['id'];

        // Check assignment
        $stmtAssign = $pdo->prepare("SELECT class_id FROM class_teacher_assignments WHERE school_id = :sid AND teacher_id = :tid LIMIT 1");
        $stmtAssign->execute([':sid' => $schoolId, ':tid' => $staffId]);
        $assignedClassId = $stmtAssign->fetchColumn();

        if (!$assignedClassId || (int)$assignedClassId !== $classId) {
            throw new \App\Shared\Exceptions\ForbiddenException("You are not authorized to mark attendance for this class.");
        }
    }

    // -------------------------------------------------------------------------
    // Students
    // -------------------------------------------------------------------------

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
            ORDER BY name
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

        if ($classId !== null) {
            $this->validateClassTeacherAssignment($pdo, $user, $classId);
        }

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

        // 1. Get user details (role and phone)
        $stmtUser = $pdo->prepare("SELECT phone, role FROM users WHERE id = :id LIMIT 1");
        $stmtUser->execute([':id' => $userId]);
        $userObj = $stmtUser->fetch();
        if (!$userObj || $userObj['role'] !== 'TEACHER') {
            return [];
        }
        $phone = $userObj['phone'];

        // 2. Get working academic year
        $stmtYear = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) LIMIT 1");
        $stmtYear->execute([':sid' => $schoolId]);
        $workingYear = $stmtYear->fetch();
        if (!$workingYear) {
            return [];
        }
        $currYearId = (int)$workingYear['id'];
        $currYearName = $workingYear['name'];

        // 3. Find active year staff record
        $stmtStaff = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
        $stmtStaff->execute([':sid' => $schoolId, ':ayid' => $currYearId, ':phone' => $phone]);
        $currStaff = $stmtStaff->fetch();
        if (!$currStaff) {
            return [];
        }
        $currStaffId = (int)$currStaff['id'];
        $currSalary = (float)($currStaff['salary'] ?? 0.0);

        // 4. Fetch paid months for current year
        $stmtPayments = $pdo->prepare("
            SELECT * FROM staff_payments 
            WHERE school_id = :sid AND staff_id = :staff_id AND academic_year_id = :ayid
        ");
        $stmtPayments->execute([':sid' => $schoolId, ':staff_id' => $currStaffId, ':ayid' => $currYearId]);
        $payments = $stmtPayments->fetchAll();
        $paymentsMap = [];
        foreach ($payments as $p) {
            $paymentsMap[$p['payment_month']] = $p;
        }

        // Generate months structure
        $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $currentPayments = [];
        foreach ($allAcademicMonths as $month) {
            if (isset($paymentsMap[$month])) {
                $currentPayments[] = [
                    'id' => (int)$paymentsMap[$month]['id'],
                    'month' => $month,
                    'salary' => (float)$paymentsMap[$month]['amount_paid'],
                    'disbursed_date' => $paymentsMap[$month]['payment_date'],
                    'status' => 'Paid'
                ];
            } else {
                $currentPayments[] = [
                    'id' => 0,
                    'month' => $month,
                    'salary' => $currSalary,
                    'disbursed_date' => null,
                    'status' => 'Pending'
                ];
            }
        }

        // 5. Handle previous academic year
        $prevPayments = [];
        $hasUnpaidPrev = false;
        $prevYearName = '';

        // Find previous academic year
        $stmtPrevYear = $pdo->prepare("
            SELECT * FROM academic_years 
            WHERE school_id = :sid AND id < :ayid 
            ORDER BY id DESC LIMIT 1
        ");
        $stmtPrevYear->execute([':sid' => $schoolId, ':ayid' => $currYearId]);
        $prevYear = $stmtPrevYear->fetch();
        if ($prevYear) {
            $prevYearId = (int)$prevYear['id'];
            $prevYearName = $prevYear['name'];

            // Find staff record in previous year
            $stmtPrevStaff = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid AND academic_year_id = :ayid AND phone = :phone LIMIT 1");
            $stmtPrevStaff->execute([':sid' => $schoolId, ':ayid' => $prevYearId, ':phone' => $phone]);
            $prevStaff = $stmtPrevStaff->fetch();
            if ($prevStaff) {
                $prevStaffId = (int)$prevStaff['id'];
                $prevSalary = (float)($prevStaff['salary'] ?? 0.0);

                // Fetch paid previous-year months paid in previous year
                $stmtOldPaid = $pdo->prepare("
                    SELECT * FROM staff_payments 
                    WHERE staff_id = :sid AND academic_year_id = :ayid
                ");
                $stmtOldPaid->execute([':sid' => $prevStaffId, ':ayid' => $prevYearId]);
                $oldPaidMonthsRecords = $stmtOldPaid->fetchAll() ?: [];
                $oldPaidMonthsMap = [];
                foreach ($oldPaidMonthsRecords as $opmr) {
                    $oldPaidMonthsMap[$opmr['payment_month']] = $opmr;
                }

                // Fetch paid previous-year months paid in current year
                $stmtCurrOldPaid = $pdo->prepare("
                    SELECT * FROM staff_payments 
                    WHERE staff_id = :sid AND academic_year_id = :ayid AND payment_month LIKE 'Previous Year - %'
                ");
                $stmtCurrOldPaid->execute([':sid' => $currStaffId, ':ayid' => $currYearId]);
                $currOldPaidRecords = $stmtCurrOldPaid->fetchAll() ?: [];

                $resolvedCurrOldPaid = [];
                $resolvedCurrOldPaidIds = [];
                foreach ($currOldPaidRecords as $copr) {
                    $cop = $copr['payment_month'];
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
                                        $resolvedCurrOldPaidIds[$allMonths[$i]] = (int)$copr['id'];
                                    }
                                }
                            } else {
                                $resolvedCurrOldPaid[] = $sm;
                                $resolvedCurrOldPaidIds[$sm] = (int)$copr['id'];
                            }
                        }
                    }
                }

                // Generate previous year months structure
                foreach ($allAcademicMonths as $month) {
                    $isPaidInPrev = isset($oldPaidMonthsMap[$month]);
                    $isPaidInCurr = in_array($month, $resolvedCurrOldPaid, true);

                    if ($isPaidInPrev || $isPaidInCurr) {
                        $payDate = null;
                        $payId = 0;
                        if ($isPaidInPrev) {
                            $payDate = $oldPaidMonthsMap[$month]['payment_date'];
                            $payId = (int)$oldPaidMonthsMap[$month]['id'];
                        } else {
                            // Find matching current year previous payment date
                            $payId = $resolvedCurrOldPaidIds[$month] ?? 0;
                            if ($payId > 0) {
                                $stmtDate = $pdo->prepare("SELECT payment_date FROM staff_payments WHERE id = :id LIMIT 1");
                                $stmtDate->execute([':id' => $payId]);
                                $payDate = $stmtDate->fetchColumn();
                            }
                        }

                        $prevPayments[] = [
                            'id' => $payId,
                            'month' => $month,
                            'salary' => $prevSalary,
                            'disbursed_date' => $payDate ?: null,
                            'status' => 'Paid'
                        ];
                    } else {
                        $prevPayments[] = [
                            'id' => 0,
                            'month' => $month,
                            'salary' => $prevSalary,
                            'disbursed_date' => null,
                            'status' => 'Pending'
                        ];
                        $hasUnpaidPrev = true;
                    }
                }
            }
        }

        return [
            'current_year' => [
                'academic_year_name' => $currYearName,
                'salary' => $currSalary,
                'payments' => $currentPayments
            ],
            'previous_year' => [
                'academic_year_name' => $prevYearName,
                'salary' => isset($prevSalary) ? $prevSalary : 0.0,
                'has_unpaid' => $hasUnpaidPrev,
                'payments' => $prevPayments
            ]
        ];
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
            SELECT sp.*, st.name AS staff_name, st.employee_id, sch.name AS school_name
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
            "School: " . $payment['school_name'],
            "---",
            "Employee Name: " . $payment['staff_name'],
            "Employee ID: " . ($payment['employee_id'] ?? '—'),
            "Month: " . $payment['payment_month'],
            "Amount Disbursed: INR " . number_format((float)$payment['amount_paid'], 2),
            "Disbursed Date: " . $paymentDateFormatted,
            "---",
            "Status: PAID",
            "---",
            "This is an automated system generated salary slip."
        ];

        $pdfData = $pdf->render("SALARY SLIP", $lines);
        $filename = "Salary_Slip_" . str_replace(' ', '_', $payment['payment_month']) . ".pdf";

        return [
            'data' => $pdfData,
            'filename' => $filename
        ];
    }
}
