<?php

declare(strict_types=1);

namespace App\Domain\Student\Services;

use App\Domain\Student\Repositories\StudentDataRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Pdf\SimplePdf;
use Psr\Log\LoggerInterface;
use PDO;

class StudentService extends BaseService
{
    public function __construct(
        private StudentDataRepository $repo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    // -------------------------------------------------------------------------
    // Student resolution
    // -------------------------------------------------------------------------

    /**
     * Resolve the student record for the authenticated user.
     *
     * - STUDENT role  → matched by email + school_id
     * - PARENT  role  → matched by parent_phone (taken from user.phone) + school_id
     *
     * @param array<string, mixed> $user  Decoded token payload / user row.
     * @throws NotFoundException when no matching student is found.
     * @return array<string, mixed>
     */
    public function resolveStudent(array $user): array
    {
        $schoolId = (int) ($user['school_id'] ?? 0);

        if ($user['role'] === 'STUDENT') {
            $email = $user['email'] ?? null;
            if (empty($email) && isset($user['id'])) {
                $stmt = $this->repo->getPdo()->prepare("SELECT email FROM users WHERE id = :id LIMIT 1");
                $stmt->execute([':id' => $user['id']]);
                $email = $stmt->fetchColumn() ?: '';
            }
            $student = $this->repo->findByUserEmail((string)$email, $schoolId);
        } else {
            // PARENT: match via phone stored on users.phone -> students.parent_phone
            // Allow selecting a specific child via X-Student-Id header or query parameter
            $reqStudentId = $_SERVER['HTTP_X_STUDENT_ID'] ?? $_GET['student_id'] ?? null;
            if ($reqStudentId !== null && is_numeric($reqStudentId)) {
                $student = $this->repo->findById((int)$reqStudentId);
                // Ensure this student actually belongs to the parent
                if ($student && (int)$student['school_id'] === $schoolId) {
                    $parentPhone = (string) ($user['phone'] ?? '');
                    if ($student['parent_phone'] !== $parentPhone && 
                        $student['father_phone'] !== $parentPhone && 
                        $student['guardian_phone'] !== $parentPhone && 
                        $student['student_mobile'] !== $parentPhone) {
                        $student = null; // Unauthorized access to another student
                    }
                } else {
                    $student = null;
                }
            } else {
                $parentPhone = (string) ($user['phone'] ?? '');
                $stmt = $this->repo->getPdo()->prepare("
                    SELECT * FROM students 
                    WHERE (parent_phone = :phone1 OR father_phone = :phone2 OR guardian_phone = :phone3 OR student_mobile = :phone4)
                      AND school_id = :school_id
                    LIMIT 1
                ");
                $stmt->execute([
                    ':phone1' => $parentPhone,
                    ':phone2' => $parentPhone,
                    ':phone3' => $parentPhone,
                    ':phone4' => $parentPhone,
                    ':school_id' => $schoolId
                ]);
                $student = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
            }
        }

        if ($student === null) {
            throw new NotFoundException('Student record not found.');
        }

        return $student;
    }

    // -------------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------------

    /**
     * Build the dashboard payload: student profile + aggregated stats.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getDashboard(array $user): array
    {
        $student   = $this->resolveStudent($user);
        $studentId = (int) $student['id'];

        $withClass = $this->repo->findWithClass($studentId) ?? $student;
        $stats     = $this->repo->getDashboardStats($studentId);

        $this->log('student.dashboard', ['student_id' => $studentId]);

        return [
            'student'        => $withClass,
            'attendance_pct' => $stats['attendance_pct'],
            'upcoming_exams' => $stats['upcoming_exams'],
            'pending_fees'   => $stats['pending_fees'],
        ];
    }

    // -------------------------------------------------------------------------
    // Timetable
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getTimetable(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getTimetable($classId, $schoolId);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getAttendance(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getAttendance((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Exam results
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getExamResults(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getResults((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Assignments
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getAssignments(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getAssignments($classId, $schoolId);
    }

    // -------------------------------------------------------------------------
    // Fees
    // -------------------------------------------------------------------------

    /**
     * Applicable fee structures for the student's class.
     *
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getFees(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getFeeStructures($classId, $schoolId);
    }

    /**
     * Fee payment history for the student.
     *
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getFeePayments(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getFeePayments((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Learning materials
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getMaterials(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getMaterials($classId, $schoolId);
    }

    public function getPublishedReportCards(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int) $student['id'];
        $classId = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        // Fetch all exams the student has marks in and that are published for their class
        $stmt = $pdo->prepare("
            SELECT DISTINCT e.id, e.name AS exam_name, e.academic_year_id, :cid AS class_id, ay.name AS academic_year_name, c.name AS class_name, c.section AS class_section
            FROM examinations e
            JOIN examination_class_status ecs ON e.id = ecs.exam_id
            JOIN examination_marks em ON e.id = em.exam_id
            JOIN academic_years ay ON e.academic_year_id = ay.id
            JOIN classes c ON c.id = :cid
            WHERE em.student_id = :sid 
              AND ecs.class_id = :cid 
              AND ecs.status = 'Published' 
              AND e.school_id = :school_id
            ORDER BY e.start_date DESC
        ");
        $stmt->execute([':sid' => $studentId, ':cid' => $classId, ':school_id' => $schoolId]);
        $publishedExams = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $reportCards = [];
        
        // Fetch Grade configurations for the school
        $stmtGrades = $pdo->prepare("
            SELECT * FROM grade_configurations 
            WHERE school_id = :sid 
            ORDER BY min_percentage DESC
        ");
        $stmtGrades->execute([':sid' => $schoolId]);
        $gradeScales = $stmtGrades->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        // Helper to resolve grade
        $resolveGrade = function($pct) use ($gradeScales) {
            foreach ($gradeScales as $s) {
                if ($pct >= (float)$s['min_percentage'] && $pct <= (float)$s['max_percentage']) {
                    return $s['grade'];
                }
            }
            if ($pct >= 90) return 'A+';
            if ($pct >= 80) return 'A';
            if ($pct >= 70) return 'B+';
            if ($pct >= 60) return 'B';
            if ($pct >= 50) return 'C';
            if ($pct >= 40) return 'D';
            return 'F';
        };

        // Fetch School Profile Details
        $stmtSchool = $pdo->prepare("SELECT name, logo_path, report_card_remark FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(\PDO::FETCH_ASSOC);
        if ($school && empty($school['report_card_remark'])) {
            $school['report_card_remark'] = 'Congratulations! The student has passed all examinations and demonstrated excellent understanding.';
        }

        foreach ($publishedExams as $ex) {
            $examId = (int)$ex['id'];

            // Fetch Exam Details for dates
            $stmtExDetails = $pdo->prepare("SELECT * FROM examinations WHERE id = :id LIMIT 1");
            $stmtExDetails->execute([':id' => $examId]);
            $examDetail = $stmtExDetails->fetch(\PDO::FETCH_ASSOC);

            // Fetch Academic Year details for attendance range
            $stmtAY = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id LIMIT 1");
            $stmtAY->execute([':id' => $ex['academic_year_id']]);
            $ayDetail = $stmtAY->fetch(\PDO::FETCH_ASSOC);
            $startD = $ayDetail ? $ayDetail['start_date'] : '2020-01-01';
            $endD = $ayDetail ? $ayDetail['end_date'] : '2030-12-31';

            // Fetch Exam Timetable Papers
            $stmtPapers = $pdo->prepare("
                SELECT ep.*, s.name AS subject_name 
                FROM examination_papers ep
                JOIN subjects s ON ep.subject_id = s.id
                WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
            ");
            $stmtPapers->execute([':exam_id' => $examId, ':class_id' => $ex['class_id']]);
            $papers = $stmtPapers->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            // Fetch Student Marks for this exam
            $stmtMarks = $pdo->prepare("
                SELECT * FROM examination_marks WHERE exam_id = :exam_id AND student_id = :sid
            ");
            $stmtMarks->execute([':exam_id' => $examId, ':sid' => $studentId]);
            $marksList = $stmtMarks->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            $marksMap = [];
            foreach ($marksList as $m) {
                $marksMap[(int)$m['paper_id']] = $m;
            }

            // Fetch Cohort to calculate Ranks
            $stmtCohort = $pdo->prepare("
                SELECT s.id, s.class_id, c.name AS class_name 
                FROM students s 
                JOIN classes c ON s.class_id = c.id
                WHERE c.name = :class_name AND c.academic_year_id = :ayid AND s.school_id = :sid AND s.status = 'ACTIVE'
            ");
            $stmtCohort->execute([
                ':class_name' => $ex['class_name'],
                ':ayid' => $ex['academic_year_id'],
                ':sid' => $schoolId
            ]);
            $allCohort = $stmtCohort->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            // Fetch All Cohort Marks for this exam
            $stmtAllCohortMarks = $pdo->prepare("
                SELECT * FROM examination_marks WHERE exam_id = :exam_id
            ");
            $stmtAllCohortMarks->execute([':exam_id' => $examId]);
            $allCohortMarks = $stmtAllCohortMarks->fetchAll(\PDO::FETCH_ASSOC) ?: [];

            $cohortMarksMap = [];
            foreach ($allCohortMarks as $cm) {
                $cohortMarksMap[(int)$cm['student_id']][(int)$cm['paper_id']] = $cm;
            }

            $cohortScores = [];
            $sectionScores = [];
            foreach ($allCohort as $cStud) {
                $cStudId = (int)$cStud['id'];
                $cClassId = (int)$cStud['class_id'];
                
                $studTotalObtained = 0.0;
                foreach ($papers as $p) {
                    $pid = (int)$p['id'];
                    $cm = $cohortMarksMap[$cStudId][$pid] ?? null;
                    if ($cm && (int)$cm['is_absent'] !== 1) {
                        $studTotalObtained += (float)$cm['marks_obtained'];
                    }
                }
                $cohortScores[$cStudId] = $studTotalObtained;
                $sectionScores[$cClassId][$cStudId] = $studTotalObtained;
            }

            // Helper to compute Rank with ties
            $computeRank = function($scoresArr, $targetStudentId) {
                arsort($scoresArr);
                $rank = 1;
                $prevScore = null;
                $counter = 0;
                foreach ($scoresArr as $id => $score) {
                    $counter++;
                    if ($prevScore !== null && $score < $prevScore) {
                        $rank = $counter;
                    }
                    if ($id === $targetStudentId) {
                        return $rank;
                    }
                    $prevScore = $score;
                }
                return 1;
            };

            $subjectMarks = [];
            $totalMax = 0.0;
            $totalObtained = 0.0;
            $allPassed = true;
            $anyData = false;

            foreach ($papers as $p) {
                $pid = (int)$p['id'];
                $m = $marksMap[$pid] ?? null;
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
                ':sid' => $studentId,
                ':start_d' => $startD,
                ':end_d' => $endD
            ]);
            $att = $stmtAtt->fetch(\PDO::FETCH_ASSOC);
            $attTotal = (int)($att['total'] ?? 0);
            $attPresent = (int)($att['present'] ?? 0);
            $attRate = $attTotal > 0 ? round(($attPresent / $attTotal) * 100, 2) : 100.00;

            $percentage = $totalMax > 0 ? round(($totalObtained / $totalMax) * 100, 2) : 0.0;
            $overallGrade = $resolveGrade($percentage);

            $classRank = $computeRank($cohortScores, $studentId);
            $sectionRank = $computeRank($sectionScores[$ex['class_id']] ?? [], $studentId);

            $classSize = count($cohortScores);
            $sectionSize = count($sectionScores[$ex['class_id']] ?? []);

            $reportCards[] = [
                'exam_id' => $examId,
                'exam_name' => $ex['exam_name'],
                'student_id' => $studentId,
                'student_name' => $student['name'],
                'roll_no' => $student['roll_no'],
                'admission_no' => $student['sr_no'] ?? $student['admission_no'] ?? '',
                'father_name' => $student['father_name'] ?? '',
                'mother_name' => $student['mother_name'] ?? '',
                'class_name' => $ex['class_name'],
                'class_section' => $ex['class_section'],
                'academic_year_name' => $ex['academic_year_name'],
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
                'status' => 'Published'
            ];
        }

        return $reportCards;
    }

    public function getFeesCard(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $classId = (int)$student['class_id'];
        $schoolId = (int)($user['school_id'] ?? 0);
        $academicYearId = (int)($student['academic_year_id'] ?? 0);
        
        $pdo = $this->repo->getPdo();

        if ($academicYearId > 0) {
            $this->syncTransportFees($schoolId, $academicYearId, $pdo);
        }

        // 1. Fetch class fee config
        $stmtCfg = $pdo->prepare("SELECT * FROM class_fee_configurations WHERE school_id = :sid AND class_id = :cid LIMIT 1");
        $stmtCfg->execute([':sid' => $schoolId, ':cid' => $classId]);
        $config = $stmtCfg->fetch();
        $monthlyFeesAmountMap = [];
        if ($config) {
            $monthlyFeesAmountMap = json_decode($config['monthly_fees'], true);
        }

        // 2. Fetch fee structures to find any fallback monthly fee
        $fallbackAmount = 0.0;
        $stmtFeeStruct = $pdo->prepare("SELECT amount FROM fee_structures WHERE school_id = :sid AND (class_id = :cid OR class_id IS NULL) AND frequency = 'Monthly' LIMIT 1");
        $stmtFeeStruct->execute([':sid' => $schoolId, ':cid' => $classId]);
        $fallbackAmount = (float)($stmtFeeStruct->fetchColumn() ?: 0.0);

        // 3. Fetch paid records from fee_payments
        $stmtPay = $pdo->prepare("SELECT * FROM fee_payments WHERE school_id = :sid AND student_id = :stid");
        $stmtPay->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $payments = $stmtPay->fetchAll();
        $paymentsMap = [];
        foreach ($payments as $p) {
            $paymentsMap[$p['fee_month']] = $p;
        }

        // Generate months structure
        $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $currentMonthName = date('F');
        $currentMonthIdx = array_search($currentMonthName, $allAcademicMonths, true);
        if ($currentMonthIdx === false) {
            $currentMonthIdx = 11;
        }

        $monthlyFees = [];
        $monthlyDue = 0.0;
        foreach ($allAcademicMonths as $month) {
            $monthAmount = isset($monthlyFeesAmountMap[$month]) ? (float)$monthlyFeesAmountMap[$month] : $fallbackAmount;
            $monthIdx = array_search($month, $allAcademicMonths, true);
            $isFuture = $monthIdx > $currentMonthIdx;

            if (isset($paymentsMap[$month])) {
                $monthlyFees[] = [
                    'id' => (int)$paymentsMap[$month]['id'],
                    'month' => $month,
                    'amount' => (float)$paymentsMap[$month]['amount_paid'],
                    'payment_date' => $paymentsMap[$month]['payment_date'],
                    'status' => 'Paid',
                    'receipt_no' => $paymentsMap[$month]['receipt_no']
                ];
            } else {
                $monthlyFees[] = [
                    'id' => 0,
                    'month' => $month,
                    'amount' => $monthAmount,
                    'payment_date' => null,
                    'status' => 'Unpaid',
                    'receipt_no' => null
                ];
                if (!$isFuture) {
                    $monthlyDue += $monthAmount;
                }
            }
        }

        // 4. Fetch additional fee payments
        $stmtAdd = $pdo->prepare("
            SELECT afp.*, aft.name AS fee_name, aft.due_date AS type_due_date
            FROM additional_fee_payments afp
            JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
            WHERE afp.school_id = :sid AND afp.student_id = :stid
        ");
        $stmtAdd->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $additionalPayments = $stmtAdd->fetchAll();

        $additionalFees = [];
        $additionalDue = 0.0;
        foreach ($additionalPayments as $row) {
            $amt = (float)$row['amount'];
            $isPaid = strtolower($row['status']) === 'paid';
            
            $dueDate = $row['type_due_date'];
            if ($row['fee_name'] === 'Transport Fees' && !empty($row['fee_month'])) {
                try {
                    $dt = new \DateTime("last day of " . $row['fee_month']);
                    $dueDate = $dt->format('Y-m-d');
                } catch (\Exception $e) {
                    $dueDate = null;
                }
            }

            $additionalFees[] = [
                'id' => (int)$row['id'],
                'description' => $row['fee_name'] === 'Transport Fees' ? 'Transport Fee' : $row['fee_name'],
                'custom_description' => $row['description'] ?? '',
                'amount' => $amt,
                'payment_date' => $row['payment_date'],
                'due_date' => $dueDate,
                'status' => $isPaid ? 'Paid' : 'Pending'
            ];
            if (!$isPaid) {
                $additionalDue += $amt;
            }
        }

        $totalOutstanding = $monthlyDue + $additionalDue;

        return [
            'total_outstanding' => $totalOutstanding,
            'monthly_due' => $monthlyDue,
            'additional_due' => $additionalDue,
            'monthly_fees' => $monthlyFees,
            'additional_fees' => $additionalFees
        ];
    }

    public function getFeeReceipt(array $user, int $paymentId, bool $isAdditional): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        if ($isAdditional) {
            $stmt = $pdo->prepare("
                SELECT afp.*, s.first_name, s.last_name, s.roll_no, s.sr_no, c.name AS class_name, c.section, sch.name AS school_name, sch.logo_path, aft.name AS fee_name, ay.name AS academic_year_name
                FROM additional_fee_payments afp
                JOIN students s ON afp.student_id = s.id
                LEFT JOIN classes c ON s.class_id = c.id
                JOIN schools sch ON afp.school_id = sch.id
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE afp.id = :id AND afp.student_id = :student_id AND afp.school_id = :sid
                LIMIT 1
            ");
            $stmt->execute([':id' => $paymentId, ':student_id' => $studentId, ':sid' => $schoolId]);
            $payment = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$payment) {
                throw new NotFoundException('Additional fee payment record not found');
            }
            $title = "Exam Fees"; // Default fallback
            if (!empty($payment['fee_name'])) {
                $title = $payment['fee_name'];
            }
            $billingItem = "Item: " . $title;
            $receiptNo = "AFP-" . str_pad((string)$payment['id'], 5, '0', STR_PAD_LEFT);
            $monthTitle = $title;
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
            $billingItem = "Billing Month: " . $payment['fee_month'];
            $receiptNo = $payment['receipt_no'];
            $monthTitle = $payment['fee_month'];
        }

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

        $feeMonthDisplay = '';
        if (!$isAdditional) {
            $stmtGrp = $pdo->prepare("SELECT fee_month, amount_paid FROM fee_payments WHERE receipt_no = :receipt_no AND school_id = :sid");
            $stmtGrp->execute([':receipt_no' => $receiptNo, ':sid' => $schoolId]);
            $groupPayments = $stmtGrp->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
            usort($groupPayments, function($a, $b) use ($academicMonths) {
                $idxA = array_search($a['fee_month'], $academicMonths, true);
                $idxB = array_search($b['fee_month'], $academicMonths, true);
                return $idxA - $idxB;
            });
            
            $rupee = "Rs";
            $monthsList = array_column($groupPayments, 'fee_month');
            $indices = [];
            foreach ($monthsList as $m) {
                $idx = array_search($m, $academicMonths, true);
                if ($idx !== false) {
                    $indices[] = $idx;
                }
            }
            $isConsecutive = false;
            if (count($indices) > 1) {
                $isConsecutive = true;
                for ($i = 1; $i < count($indices); $i++) {
                    if ($indices[$i] !== $indices[$i - 1] + 1) {
                        $isConsecutive = false;
                        break;
                    }
                }
            }
            if ($isConsecutive) {
                $feeMonthDisplay = reset($monthsList) . " To " . end($monthsList);
            } else {
                $feeMonthDisplay = implode(', ', $monthsList);
            }
            $totalAmountPaid = array_sum(array_column($groupPayments, 'amount_paid'));
            $amountPaidFormatted = "Rs " . number_format((float)$totalAmountPaid, 0);
            $billingItemLabel = count($groupPayments) > 1 ? "Months: " : "Month: ";
        } else {
            $feeMonthDisplay = $payment['fee_name'];
            $totalAmountPaid = (float)$payment['amount'];
            $amountPaidFormatted = "Rs " . number_format((float)$totalAmountPaid, 0);
            $billingItemLabel = "Description: ";
        }

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
            "Total Amount: " . $amountPaidFormatted,
            "---",
            "Status: PAID",
            "---",
            "This is an automated system generated receipt. Thank you for your payment."
        ];

        $pdf = new \App\Shared\Pdf\SimplePdf();
        $pdfData = $pdf->render(strtoupper($payment['school_name']), $lines);
        $filename = str_replace(' ', '_', $monthTitle) . "_Fee_Receipt.pdf";

        return [
            'data' => $pdfData,
            'filename' => $filename
        ];
    }

    public function getNotifications(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            SELECT * FROM dashboard_notifications
            WHERE school_id = :school_id AND user_id = :user_id
            ORDER BY id DESC
        ");
        $stmt->execute([':school_id' => $schoolId, ':user_id' => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function markAllNotificationsRead(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            UPDATE dashboard_notifications
            SET is_read = 1
            WHERE school_id = :school_id AND user_id = :user_id AND is_read = 0
        ");
        $stmt->execute([':school_id' => $schoolId, ':user_id' => $userId]);

        return ['success' => true];
    }

    public function getActiveNotices(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? '');
        $pdo = $this->repo->getPdo();

        $allowedAud = [];
        if ($role === 'TEACHER') {
            $allowedAud = ['Teachers', 'Both'];
        } elseif ($role === 'PARENT' || $role === 'STUDENT') {
            $allowedAud = ['Students', 'Both'];
        } elseif ($role === 'SCHOOL_ADMIN' || $role === 'PRINCIPAL') {
            $allowedAud = ['Teachers', 'Students', 'Both'];
        } else {
            return []; // Unauthorized roles see nothing
        }

        // Build in clause query
        $inQuery = implode(',', array_fill(0, count($allowedAud), '?'));
        $stmt = $pdo->prepare("
            SELECT a.*, 
                   (CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END) AS is_read
            FROM announcements a
            LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = ?
            WHERE a.school_id = ? AND a.audience IN ({$inQuery}) AND a.status = 'Published'
            ORDER BY a.created_at DESC
        ");

        $params = array_merge([$userId, $schoolId], $allowedAud);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function markNoticeRead(array $user, int $announcementId): array
    {
        $userId = (int)$user['id'];
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            INSERT IGNORE INTO announcement_reads (announcement_id, user_id)
            VALUES (:ann, :uid)
        ");
        $stmt->execute([
            ':ann' => $announcementId,
            ':uid' => $userId
        ]);

        return ['success' => true];
    }

    public function getExamsList(array $user): array
    {
        $student = $this->resolveStudent($user);
        $classId = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            SELECT DISTINCT e.id, e.name, e.start_date, e.end_date,
                   COALESCE(ecs.scheme_published, 0) AS scheme_published,
                   COALESCE(ecs.admit_card_published, 0) AS admit_card_published,
                   COALESCE(ecs.status, 'Draft') AS result_status
            FROM examinations e
            JOIN examination_papers ep ON e.id = ep.exam_id
            LEFT JOIN examination_class_status ecs ON e.id = ecs.exam_id AND ecs.class_id = :class_id_1
            WHERE ep.class_id = :class_id_2 AND e.school_id = :school_id AND e.status = 'Published'
            ORDER BY e.start_date DESC
        ");
        $stmt->execute([
            ':class_id_1' => $classId,
            ':class_id_2' => $classId,
            ':school_id' => $schoolId
        ]);
        $exams = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $today = date('Y-m-d');
        foreach ($exams as &$e) {
            $e['id'] = (int)$e['id'];
            $e['scheme_published'] = (int)$e['scheme_published'];
            $e['admit_card_published'] = (int)$e['admit_card_published'];
            $e['result_published'] = $e['result_status'] === 'Published' ? 1 : 0;
            
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

    public function getStudentOutstandingDue(array $student, int $schoolId): float
    {
        $studentId = (int)$student['id'];
        $classId = (int)$student['class_id'];
        $pdo = $this->repo->getPdo();

        // 1. Fetch class base monthly fee configurations
        $stmtBase = $pdo->prepare("SELECT amount FROM class_fee_configurations WHERE class_id = :class_id AND school_id = :school_id LIMIT 1");
        $stmtBase->execute([':class_id' => $classId, ':school_id' => $schoolId]);
        $fallbackAmount = (float)$stmtBase->fetchColumn();

        // 2. Fetch specific student monthly fee configurations
        $stmtMonths = $pdo->prepare("SELECT fee_month, amount FROM student_monthly_fee_configurations WHERE student_id = :student_id AND school_id = :school_id");
        $stmtMonths->execute([':student_id' => $studentId, ':school_id' => $schoolId]);
        $monthlyFeesAmountMap = $stmtMonths->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        // 3. Fetch paid records from fee_payments
        $stmtPay = $pdo->prepare("SELECT * FROM fee_payments WHERE school_id = :sid AND student_id = :stid");
        $stmtPay->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $payments = $stmtPay->fetchAll();
        $paymentsMap = [];
        foreach ($payments as $p) {
            $paymentsMap[$p['fee_month']] = $p;
        }

        // Generate months structure
        $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $currentMonthName = date('F');
        $currentMonthIdx = array_search($currentMonthName, $allAcademicMonths, true);
        if ($currentMonthIdx === false) {
            $currentMonthIdx = 11;
        }

        $monthlyDue = 0.0;
        foreach ($allAcademicMonths as $month) {
            $monthAmount = isset($monthlyFeesAmountMap[$month]) ? (float)$monthlyFeesAmountMap[$month] : $fallbackAmount;
            $monthIdx = array_search($month, $allAcademicMonths, true);
            $isFuture = $monthIdx > $currentMonthIdx;

            if (!isset($paymentsMap[$month])) {
                if (!$isFuture) {
                    $monthlyDue += $monthAmount;
                }
            }
        }

        // 4. Fetch additional fee payments
        $stmtAdd = $pdo->prepare("
            SELECT afp.amount, afp.status
            FROM additional_fee_payments afp
            WHERE afp.school_id = :sid AND afp.student_id = :stid
        ");
        $stmtAdd->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $additionalPayments = $stmtAdd->fetchAll(PDO::FETCH_ASSOC);

        $additionalDue = 0.0;
        foreach ($additionalPayments as $row) {
            $isPaid = strtolower($row['status']) === 'paid';
            if (!$isPaid) {
                $additionalDue += (float)$row['amount'];
            }
        }

        return $monthlyDue + $additionalDue;
    }

    public function getExamDetails(array $user, int $examId): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int) $student['id'];
        $classId = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        // 1. Fetch exam publish status for this class
        $stmtStatus = $pdo->prepare("
            SELECT COALESCE(scheme_published, 0) AS scheme_published,
                   COALESCE(admit_card_published, 0) AS admit_card_published,
                   COALESCE(status, 'Draft') AS result_status
            FROM examination_class_status
            WHERE exam_id = :exam_id AND class_id = :class_id
            LIMIT 1
        ");
        $stmtStatus->execute([':exam_id' => $examId, ':class_id' => $classId]);
        $statusInfo = $stmtStatus->fetch(PDO::FETCH_ASSOC);

        $schemePublished = $statusInfo ? (int)$statusInfo['scheme_published'] : 0;
        $admitCardPublished = $statusInfo ? (int)$statusInfo['admit_card_published'] : 0;
        $resultPublished = ($statusInfo && $statusInfo['result_status'] === 'Published') ? 1 : 0;

        // Fetch Exam basic info
        $stmtExam = $pdo->prepare("SELECT name, start_date, end_date FROM examinations WHERE id = :id AND school_id = :sid AND status = 'Published' LIMIT 1");
        $stmtExam->execute([':id' => $examId, ':sid' => $schoolId]);
        $exam = $stmtExam->fetch(PDO::FETCH_ASSOC);
        if (!$exam) {
            throw new NotFoundException('Examination not found.');
        }

        // Check if there is an active finance setting for due restriction
        $academicYearId = (int)$student['academic_year_id'];
        $stmtSetting = $pdo->prepare("
            SELECT enable_due_restriction, max_allowed_due, restrict_admit_card, restrict_exam_result FROM school_finance_settings 
            WHERE school_id = :sid AND academic_year_id = :ayid LIMIT 1
        ");
        $stmtSetting->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $settings = $stmtSetting->fetch(PDO::FETCH_ASSOC);

        $admitCardRestricted = false;
        $resultRestricted = false;
        $outstandingDue = 0.0;
        $maxAllowedDue = 0.0;

        if ($settings && (int)$settings['enable_due_restriction'] === 1) {
            $outstandingDue = $this->getStudentOutstandingDue($student, $schoolId);
            $maxAllowedDue = (float)$settings['max_allowed_due'];
            if ($outstandingDue > $maxAllowedDue) {
                if ((int)$settings['restrict_admit_card'] === 1) {
                    $admitCardRestricted = true;
                }
                if ((int)$settings['restrict_exam_result'] === 1) {
                    $resultRestricted = true;
                }
            }
        }

        $response = [
            'exam_name' => $exam['name'],
            'start_date' => $exam['start_date'],
            'end_date' => $exam['end_date'],
            'scheme_published' => $schemePublished,
            'admit_card_published' => $admitCardPublished,
            'result_published' => $resultPublished,
            'scheme' => null,
            'admit_card' => null,
            'result' => null,
            'is_restricted' => ($admitCardRestricted || $resultRestricted),
            'admit_card_restricted' => $admitCardRestricted,
            'result_restricted' => $resultRestricted,
            'max_allowed_due' => $maxAllowedDue,
            'outstanding_due' => $outstandingDue
        ];

        // 2. Fetch scheme if published (always visible)
        if ($schemePublished) {
            $stmtScheme = $pdo->prepare("
                SELECT ep.id, ep.exam_date, ep.start_time, ep.end_time, ep.max_marks, ep.passing_marks, ep.room, s.name AS subject_name
                FROM examination_papers ep
                JOIN subjects s ON ep.subject_id = s.id
                WHERE ep.exam_id = :exam_id AND ep.class_id = :class_id
                ORDER BY ep.exam_date ASC, ep.start_time ASC
            ");
            $stmtScheme->execute([':exam_id' => $examId, ':class_id' => $classId]);
            $response['scheme'] = $stmtScheme->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        // 3. Fetch admit card if published and NOT restricted
        if ($admitCardPublished && !$admitCardRestricted) {
            $stmtAdmit = $pdo->prepare("
                SELECT esa.seat_number, esa.room_name, esa.bench_number, esa.seat_position,
                       s.name AS school_name, ay.name AS academic_year, c.name AS class_name,
                       std.name AS student_name, std.roll_no
                FROM examination_seating_allocations esa
                JOIN examination_seating_plans esp ON esa.seating_plan_id = esp.id
                JOIN academic_years ay ON esp.academic_year_id = ay.id
                JOIN schools s ON esp.school_id = s.id
                JOIN students std ON esa.student_id = std.id
                LEFT JOIN classes c ON std.class_id = c.id
                WHERE esp.exam_id = :exam_id AND esa.student_id = :student_id
                LIMIT 1
            ");
            $stmtAdmit->execute([':exam_id' => $examId, ':student_id' => $studentId]);
            $admit = $stmtAdmit->fetch(PDO::FETCH_ASSOC);
            if ($admit) {
                $response['admit_card'] = [
                    'school_name' => $admit['school_name'],
                    'academic_year' => $admit['academic_year'],
                    'student_name' => $admit['student_name'],
                    'class_name' => $admit['class_name'] ?: '—',
                    'roll_no' => $admit['roll_no'] ?: '—',
                    'room_name' => $admit['room_name'],
                    'bench_number' => $admit['bench_number'],
                    'seat_position' => $admit['seat_position'],
                    'seat_number' => $admit['seat_number'],
                ];
            }
        }

        // 4. Fetch result if published and NOT restricted
        if ($resultPublished && !$resultRestricted) {
            $stmtResult = $pdo->prepare("
                SELECT em.marks_obtained, em.is_absent, em.remarks, ep.max_marks, ep.passing_marks, s.name AS subject_name
                FROM examination_marks em
                JOIN examination_papers ep ON em.paper_id = ep.id
                JOIN subjects s ON ep.subject_id = s.id
                WHERE ep.exam_id = :exam_id AND em.student_id = :student_id
            ");
            $stmtResult->execute([':exam_id' => $examId, ':student_id' => $studentId]);
            $marks = $stmtResult->fetchAll(PDO::FETCH_ASSOC) ?: [];
            
            if (!empty($marks)) {
                $totalMax = 0;
                $totalObtained = 0;
                $allPassed = true;
                
                foreach ($marks as &$m) {
                    $m['max_marks'] = (float)$m['max_marks'];
                    $m['passing_marks'] = (float)$m['passing_marks'];
                    $m['marks_obtained'] = $m['marks_obtained'] !== null ? (float)$m['marks_obtained'] : null;
                    
                    if (!$m['is_absent'] && $m['marks_obtained'] !== null) {
                        $totalObtained += $m['marks_obtained'];
                        if ($m['marks_obtained'] < $m['passing_marks']) {
                            $allPassed = false;
                        }
                    } else {
                        $allPassed = false;
                    }
                    $totalMax += $m['max_marks'];
                }
                
                $response['result'] = [
                    'papers' => $marks,
                    'total_max_marks' => $totalMax,
                    'total_marks_obtained' => $totalObtained,
                    'status' => $allPassed ? 'Pass' : 'Fail'
                ];
            }
        }

        return $response;
    }

    private function calculateTransportCharge(string $startDateStr, float $monthlyFee, string $targetMonthStr): float
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
                return $monthlyFee;
            }
            $totalDays = (int)$startDate->format('t');
            $remainingDays = $totalDays - $startDay + 1;
            if ($remainingDays < 0) {
                $remainingDays = 0;
            }
            $dailyFee = round($monthlyFee / $totalDays, 2);
            return round($dailyFee * $remainingDays, 2);
        }

        return $monthlyFee;
    }

    public function syncTransportFees(int $schoolId, int $academicYearId, PDO $pdo): void
    {
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

        $stmtConfigs = $pdo->prepare("SELECT * FROM student_transport_fees WHERE school_id = :sid AND academic_year_id = :ayid AND status = 'Active'");
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

        $stmtInsNotif = $pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_role, title, message)
            VALUES (:sid, 'STUDENT', 'Transport Fee Generated', :msg)
        ");

        foreach ($configs as $cfg) {
            $studentId = (int)$cfg['student_id'];
            $monthlyFee = (float)$cfg['monthly_fee'];
            $startDateStr = $cfg['start_date'];
            $startDate = new \DateTime($startDateStr);

            $temp = new \DateTime($startDate->format('Y-m-01'));
            $endTemp = new \DateTime($targetDate->format('Y-m-01'));

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

                            $msg = "Transport Fee for {$monthStr} has been added to your fee ledger.";
                            $stmtInsNotif->execute([
                                ':sid' => $schoolId,
                                ':msg' => $msg
                            ]);
                        }
                    }
                }
                $temp->modify('+1 month');
            }
        }
    }

    public function getGameProgress(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $studentWithClass = $this->repo->findWithClass($studentId) ?? $student;
        $className = $studentWithClass['class_name'] ?? '';

        $pdo = $this->repo->getPdo();

        // 1. Get or create game progress
        $stmt = $pdo->prepare("SELECT * FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
        $stmt->execute([':student_id' => $studentId]);
        $progress = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$progress) {
            $stmtInsert = $pdo->prepare("
                INSERT INTO student_game_progress 
                (student_id, school_id, game_key, coins, score, current_level, current_streak, highest_streak, correct_answers, wrong_answers, total_play_time)
                VALUES 
                (:student_id, :school_id, 'word-builder', 0, 0, 1, 0, 0, 0, 0, 0)
            ");
            $stmtInsert->execute([
                ':student_id' => $studentId,
                ':school_id' => $schoolId
            ]);
            $stmt->execute([':student_id' => $studentId]);
            $progress = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // 2. Get learned words
        $stmtWords = $pdo->prepare("SELECT word FROM student_learned_words WHERE student_id = :student_id AND game_key = 'word-builder'");
        $stmtWords->execute([':student_id' => $studentId]);
        $words = $stmtWords->fetchAll(PDO::FETCH_COLUMN) ?: [];

        return [
            'progress' => [
                'coins' => (int)$progress['coins'],
                'score' => (int)$progress['score'],
                'current_level' => (int)$progress['current_level'],
                'current_streak' => (int)$progress['current_streak'],
                'highest_streak' => (int)$progress['highest_streak'],
                'correct_answers' => (int)$progress['correct_answers'],
                'wrong_answers' => (int)$progress['wrong_answers'],
                'total_play_time' => (int)$progress['total_play_time'],
                'last_login_reward_date' => $progress['last_login_reward_date']
            ],
            'learned_words' => $words,
            'student_class' => $className
        ];
    }

    public function syncGameProgress(array $user, array $data): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $pdo = $this->repo->getPdo();

        // Check if progress already exists
        $stmt = $pdo->prepare("SELECT id FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
        $stmt->execute([':student_id' => $studentId]);
        $exists = $stmt->fetchColumn();

        if ($exists) {
            $stmtUpdate = $pdo->prepare("
                UPDATE student_game_progress 
                SET coins = :coins,
                    score = :score,
                    current_level = :current_level,
                    current_streak = :current_streak,
                    highest_streak = :highest_streak,
                    correct_answers = :correct_answers,
                    wrong_answers = :wrong_answers,
                    total_play_time = :total_play_time
                WHERE student_id = :student_id AND game_key = 'word-builder'
            ");
            $stmtUpdate->execute([
                ':coins' => (int)($data['coins'] ?? 0),
                ':score' => (int)($data['score'] ?? 0),
                ':current_level' => (int)($data['current_level'] ?? 1),
                ':current_streak' => (int)($data['current_streak'] ?? 0),
                ':highest_streak' => (int)($data['highest_streak'] ?? 0),
                ':correct_answers' => (int)($data['correct_answers'] ?? 0),
                ':wrong_answers' => (int)($data['wrong_answers'] ?? 0),
                ':total_play_time' => (int)($data['total_play_time'] ?? 0),
                ':student_id' => $studentId
            ]);
        } else {
            $stmtInsert = $pdo->prepare("
                INSERT INTO student_game_progress 
                (student_id, school_id, game_key, coins, score, current_level, current_streak, highest_streak, correct_answers, wrong_answers, total_play_time)
                VALUES 
                (:student_id, :school_id, 'word-builder', :coins, :score, :current_level, :current_streak, :highest_streak, :correct_answers, :wrong_answers, :total_play_time)
            ");
            $stmtInsert->execute([
                ':student_id' => $studentId,
                ':school_id' => $schoolId,
                ':coins' => (int)($data['coins'] ?? 0),
                ':score' => (int)($data['score'] ?? 0),
                ':current_level' => (int)($data['current_level'] ?? 1),
                ':current_streak' => (int)($data['current_streak'] ?? 0),
                ':highest_streak' => (int)($data['highest_streak'] ?? 0),
                ':correct_answers' => (int)($data['correct_answers'] ?? 0),
                ':wrong_answers' => (int)($data['wrong_answers'] ?? 0),
                ':total_play_time' => (int)($data['total_play_time'] ?? 0)
            ]);
        }

        // Save new learned words
        if (isset($data['new_words']) && is_array($data['new_words'])) {
            $stmtWord = $pdo->prepare("
                INSERT IGNORE INTO student_learned_words 
                (student_id, school_id, game_key, word) 
                VALUES 
                (:student_id, :school_id, 'word-builder', :word)
            ");
            foreach ($data['new_words'] as $w) {
                if (is_string($w) && !empty(trim($w))) {
                    $stmtWord->execute([
                        ':student_id' => $studentId,
                        ':school_id' => $schoolId,
                        ':word' => trim($w)
                    ]);
                }
            }
        }

        return $this->getGameProgress($user);
    }

    public function claimDailyLogin(array $user): array
    {
        $student = $this->resolveStudent($user);
        $studentId = (int)$student['id'];
        $schoolId = (int)$student['school_id'];
        $pdo = $this->repo->getPdo();

        $today = date('Y-m-d');

        // Check if progress already exists
        $stmt = $pdo->prepare("SELECT * FROM student_game_progress WHERE student_id = :student_id AND game_key = 'word-builder' LIMIT 1");
        $stmt->execute([':student_id' => $studentId]);
        $progress = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($progress) {
            if ($progress['last_login_reward_date'] === $today) {
                return [
                    'success' => false,
                    'message' => 'Daily login reward already claimed today.',
                    'progress' => [
                        'coins' => (int)$progress['coins'],
                        'last_login_reward_date' => $progress['last_login_reward_date']
                    ]
                ];
            }

            $newCoins = (int)$progress['coins'] + 20;
            $stmtUpdate = $pdo->prepare("
                UPDATE student_game_progress 
                SET coins = :coins, last_login_reward_date = :today
                WHERE student_id = :student_id AND game_key = 'word-builder'
            ");
            $stmtUpdate->execute([
                ':coins' => $newCoins,
                ':today' => $today,
                ':student_id' => $studentId
            ]);
        } else {
            $stmtInsert = $pdo->prepare("
                INSERT INTO student_game_progress 
                (student_id, school_id, game_key, coins, score, current_level, current_streak, highest_streak, correct_answers, wrong_answers, total_play_time, last_login_reward_date)
                VALUES 
                (:student_id, :school_id, 'word-builder', 20, 0, 1, 0, 0, 0, 0, 0, :today)
            ");
            $stmtInsert->execute([
                ':student_id' => $studentId,
                ':school_id' => $schoolId,
                ':today' => $today
            ]);
        }

        return [
            'success' => true,
            'message' => 'Daily login reward claimed successfully! +20 Coins.',
            'data' => $this->getGameProgress($user)
        ];
    }
}
