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
        $reqStudentId = $_SERVER['HTTP_X_STUDENT_ID'] ?? $_GET['student_id'] ?? null;

        $student = null;
        $pdo = $this->repo->getPdo();

        $userPhone = (string) ($user['phone'] ?? '');
        if (empty($userPhone) && isset($user['id'])) {
            $stmt = $pdo->prepare("SELECT phone FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $user['id']]);
            $userPhone = $stmt->fetchColumn() ?: '';
        }

        $userEmail = (string) ($user['email'] ?? '');
        if (empty($userEmail) && isset($user['id'])) {
            $stmt = $pdo->prepare("SELECT email FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $user['id']]);
            $userEmail = $stmt->fetchColumn() ?: '';
        }

        // 1. If explicit student_id is requested (e.g. account switching in mobile app)
        if ($reqStudentId !== null && is_numeric($reqStudentId)) {
            $candidate = $this->repo->findById((int)$reqStudentId);
            if ($candidate && (int)$candidate['school_id'] === $schoolId) {
                $matchesPhone = !empty($userPhone) && (
                    (string)$candidate['student_mobile'] === $userPhone ||
                    (string)$candidate['parent_phone'] === $userPhone ||
                    (string)$candidate['father_phone'] === $userPhone ||
                    (string)$candidate['guardian_phone'] === $userPhone
                );
                $matchesEmail = !empty($userEmail) && strcasecmp((string)$candidate['email'], $userEmail) === 0;

                if ($matchesPhone || $matchesEmail) {
                    // Check if candidate belongs to active current Academic Year (ay.is_current = 1)
                    $stmtAy = $pdo->prepare("
                        SELECT is_current FROM academic_years 
                        WHERE id = :ayid AND school_id = :sid 
                        LIMIT 1
                    ");
                    $stmtAy->execute([':ayid' => (int)($candidate['academic_year_id'] ?? 0), ':sid' => $schoolId]);
                    $isCurrent = (int)($stmtAy->fetchColumn() ?: 0);

                    if ($isCurrent === 1) {
                        $student = $candidate;
                    } else {
                        // Candidate is from an old/archived Academic Year (e.g. stale cached mobile ID).
                        // Check if a new active student record exists for this same student in current active Academic Year.
                        $adm = trim((string)($candidate['admission_no'] ?? ''));
                        $cName = trim((string)($candidate['name'] ?? ''));
                        
                        $matchConds = [];
                        $paramsNewer = [':sid' => $schoolId];
                        
                        if ($adm !== '') {
                            $matchConds[] = "s.admission_no = :adm";
                            $paramsNewer[':adm'] = $adm;
                        }
                        if ($cName !== '' && $userPhone !== '') {
                            $matchConds[] = "(s.name = :cname AND (s.student_mobile = :p1 OR s.parent_phone = :p2 OR s.father_phone = :p3))";
                            $paramsNewer[':cname'] = $cName;
                            $paramsNewer[':p1'] = $userPhone;
                            $paramsNewer[':p2'] = $userPhone;
                            $paramsNewer[':p3'] = $userPhone;
                        }
                        
                        if (!empty($matchConds)) {
                            $sqlNewer = "
                                SELECT s.* 
                                FROM students s
                                JOIN academic_years ay ON s.academic_year_id = ay.id
                                WHERE s.school_id = :sid
                                  AND ay.is_current = 1
                                  AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
                                  AND s.exit_date IS NULL
                                  AND (" . implode(' OR ', $matchConds) . ")
                                ORDER BY s.id DESC
                                LIMIT 1
                            ";
                            $stmtNewer = $pdo->prepare($sqlNewer);
                            $stmtNewer->execute($paramsNewer);
                            $newerStudent = $stmtNewer->fetch(PDO::FETCH_ASSOC);
                            if ($newerStudent) {
                                $student = $newerStudent;
                            } else {
                                $student = $candidate;
                            }
                        } else {
                            $student = $candidate;
                        }
                    }
                }
            }
        }

        // 2. Default resolution by phone number (Prioritize current active Academic Year)
        if ($student === null && !empty($userPhone) && strlen($userPhone) >= 10) {
            $stmt = $pdo->prepare("
                SELECT s.* 
                FROM students s
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE s.school_id = :school_id
                  AND (
                    (s.student_mobile = :p1 AND s.student_mobile IS NOT NULL AND s.student_mobile != '') OR 
                    (s.parent_phone = :p2 AND s.parent_phone IS NOT NULL AND s.parent_phone != '') OR 
                    (s.father_phone = :p3 AND s.father_phone IS NOT NULL AND s.father_phone != '') OR 
                    (s.guardian_phone = :p4 AND s.guardian_phone IS NOT NULL AND s.guardian_phone != '')
                  )
                  AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
                  AND s.exit_date IS NULL
                ORDER BY COALESCE(ay.is_current, 0) DESC, s.id DESC
                LIMIT 1
            ");
            $stmt->execute([
                ':p1' => $userPhone,
                ':p2' => $userPhone,
                ':p3' => $userPhone,
                ':p4' => $userPhone,
                ':school_id' => $schoolId
            ]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }

        // 3. Resolution by user email (if phone didn't match)
        if ($student === null && !empty($userEmail)) {
            $stmt = $pdo->prepare("
                SELECT s.* 
                FROM students s
                LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                WHERE s.school_id = :school_id
                  AND LOWER(s.email) = LOWER(:email)
                  AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
                  AND s.exit_date IS NULL
                ORDER BY COALESCE(ay.is_current, 0) DESC, s.id DESC
                LIMIT 1
            ");
            $stmt->execute([
                ':school_id' => $schoolId,
                ':email' => $userEmail
            ]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }

        if ($student === null) {
            throw new NotFoundException('No active student profile linked to this mobile number.');
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
    public function getTimetable(array $user, ?string $date = null): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getTimetable($classId, $schoolId, $date);
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
            SELECT DISTINCT e.id, e.name AS exam_name, e.academic_year_id, c.id AS class_id, ay.name AS academic_year_name, c.name AS class_name, c.section AS class_section
            FROM examinations e
            JOIN examination_class_status ecs ON e.id = ecs.exam_id
            JOIN examination_marks em ON e.id = em.exam_id
            JOIN academic_years ay ON e.academic_year_id = ay.id
            JOIN classes c ON c.id = :cid_1
            WHERE em.student_id = :sid 
              AND ecs.class_id = :cid_2 
              AND ecs.status = 'Published' 
              AND e.school_id = :school_id
            ORDER BY e.start_date ASC, e.id ASC
        ");
        $stmt->execute([
            ':sid' => $studentId, 
            ':cid_1' => $classId, 
            ':cid_2' => $classId, 
            ':school_id' => $schoolId
        ]);
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
            if ($pct >= 75) return 'A';
            if ($pct >= 60) return 'B';
            if ($pct >= 40) return 'C';
            return 'D';
        };

        // Fetch School Profile & Active Template Details
        $stmtSchool = $pdo->prepare("
            SELECT s.name, s.street_address, s.city, s.state, s.logo_path, s.report_card_remark, rct.code AS template_code 
            FROM schools s 
            LEFT JOIN report_card_templates rct ON s.report_card_template_id = rct.id 
            WHERE s.id = :sid 
            LIMIT 1
        ");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(\PDO::FETCH_ASSOC) ?: [];
        $school['report_card_remark'] = $school['report_card_remark'] ?? '';
        $schoolAddress = (string)($school['street_address'] ?? '');

        $logoPath = (string)($school['logo_path'] ?? '');
        $host = $_SERVER['HTTP_HOST'] ?? '10.55.253.71:8000';
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        $baseUrl = "{$scheme}://{$host}";
        $schoolLogoUrl = !empty($logoPath) 
            ? (str_starts_with($logoPath, 'http') ? $logoPath : $baseUrl . '/' . ltrim($logoPath, '/')) 
            : null;

        $tplCode = $school['template_code'] ?? 'traditional';

        foreach ($publishedExams as $ex) {
            $examId = (int)$ex['id'];
            $isAnnual = str_contains(strtolower($ex['exam_name'] ?? ''), 'annual');

            if ($isAnnual) {
                $reportCards[] = $this->compileFinalAcademicReportCard($user, $student, $school, $schoolAddress, $schoolLogoUrl, $tplCode, $publishedExams, $gradeScales, $resolveGrade, $ex);
                continue;
            }

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
                'dob' => $student['dob'] ?? '',
                'class_name' => $ex['class_name'],
                'class_section' => $ex['class_section'],
                'academic_year_name' => $ex['academic_year_name'],
                'school_name' => $school['name'] ?? 'Academic Portal',
                'school_address' => $schoolAddress,
                'school_logo' => $schoolLogoUrl,
                'report_card_remark' => $school['report_card_remark'] ?? null,
                'template_code' => $tplCode,
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

    private function compileFinalAcademicReportCard(
        array $user,
        array $student,
        array $school,
        string $schoolAddress,
        ?string $schoolLogoUrl,
        string $tplCode,
        array $publishedExams,
        array $gradeScales,
        callable $resolveGrade,
        array $annualExam
    ): array {
        $studentId = (int)$student['id'];
        $classId = (int)$student['class_id'];
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        // 1. Collect published exam names & IDs for this academic year
        $sessionExams = [];
        $publishedExamIds = [];
        foreach ($publishedExams as $pe) {
            $eName = $pe['exam_name'];
            if (!in_array($eName, $sessionExams)) {
                $sessionExams[] = $eName;
            }
            $publishedExamIds[] = (int)$pe['id'];
        }

        if (empty($publishedExamIds)) {
            $publishedExamIds[] = (int)$annualExam['id'];
        }
        $inExamIds = implode(',', $publishedExamIds);

        // Fetch papers for these exams in student's class
        $stmtPapers = $pdo->prepare("
            SELECT ep.*, s.name AS subject_name, e.name AS exam_name
            FROM examination_papers ep
            JOIN subjects s ON ep.subject_id = s.id
            JOIN examinations e ON ep.exam_id = e.id
            WHERE ep.exam_id IN ({$inExamIds}) AND ep.class_id = :cid
            ORDER BY ep.exam_date ASC, s.id ASC
        ");
        $stmtPapers->execute([':cid' => $classId]);
        $allPapers = $stmtPapers->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        // Fetch marks for this student across these exams
        $stmtMarks = $pdo->prepare("
            SELECT * FROM examination_marks 
            WHERE exam_id IN ({$inExamIds}) AND student_id = :sid
        ");
        $stmtMarks->execute([':sid' => $studentId]);
        $allMarks = $stmtMarks->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        $marksByPaperId = [];
        foreach ($allMarks as $m) {
            $marksByPaperId[(int)$m['paper_id']] = $m;
        }

        // Group scores by subject_name -> exam_name
        $subjectScoresMap = [];
        foreach ($allPapers as $p) {
            $subjName = $p['subject_name'];
            $exName = $p['exam_name'];
            $pid = (int)$p['id'];
            $m = $marksByPaperId[$pid] ?? null;

            $maxM = (float)$p['max_marks'];
            $passM = (float)$p['passing_marks'];
            $obt = null;
            $isAbsent = false;

            if ($m) {
                $isAbsent = ((int)$m['is_absent'] === 1);
                if (!$isAbsent && $m['marks_obtained'] !== null) {
                    $obt = (float)$m['marks_obtained'];
                }
            }

            if (!isset($subjectScoresMap[$subjName])) {
                $subjectScoresMap[$subjName] = [];
            }
            $subjectScoresMap[$subjName][$exName] = [
                'max_marks' => $maxM,
                'passing_marks' => $passM,
                'marks_obtained' => $isAbsent ? 'ABSENT' : ($obt !== null ? $obt : '—'),
                'raw_obtained' => $isAbsent ? 0.0 : ($obt !== null ? $obt : 0.0),
                'is_absent' => $isAbsent,
                'has_score' => ($obt !== null && !$isAbsent)
            ];
        }

        $finalSubjects = [];
        $grandSessionMax = 0.0;
        $grandSessionObtained = 0.0;
        $allPassed = true;

        foreach ($subjectScoresMap as $subjName => $examScores) {
            $subGrandMax = 0.0;
            $subGrandObt = 0.0;

            foreach ($sessionExams as $exName) {
                $sc = $examScores[$exName] ?? null;
                if ($sc) {
                    $subGrandMax += (float)$sc['max_marks'];
                    if ($sc['has_score']) {
                        $subGrandObt += (float)$sc['raw_obtained'];
                    }
                }
            }

            $subPct = $subGrandMax > 0 ? ($subGrandObt / $subGrandMax) * 100 : 0.0;
            $subGrade = $resolveGrade($subPct);
            $subPassed = $subGrandMax > 0 ? ($subGrandObt >= ($subGrandMax * 0.33)) : true;
            if (!$subPassed) {
                $allPassed = false;
            }

            $grandSessionMax += $subGrandMax;
            $grandSessionObtained += $subGrandObt;

            $finalSubjects[] = [
                'subject_name' => $subjName,
                'exam_scores' => $examScores,
                'grand_total_max' => $subGrandMax,
                'grand_total_obtained' => $subGrandObt,
                'max_marks' => $subGrandMax,
                'marks_obtained' => $subGrandObt,
                'passing_marks' => round($subGrandMax * 0.33, 2),
                'grade' => $subGrade,
                'result' => $subPassed ? 'PASS' : 'FAIL'
            ];
        }

        $overallPct = $grandSessionMax > 0 ? round(($grandSessionObtained / $grandSessionMax) * 100, 2) : 0.0;
        $overallGrade = $resolveGrade($overallPct);

        $examTotalsMap = [];
        foreach ($sessionExams as $exName) {
            $exMax = 0.0;
            $exObt = 0.0;
            foreach ($subjectScoresMap as $subjScores) {
                $sc = $subjScores[$exName] ?? null;
                if ($sc) {
                    $exMax += (float)$sc['max_marks'];
                    if ($sc['has_score']) {
                        $exObt += (float)$sc['raw_obtained'];
                    }
                }
            }
            $examTotalsMap[$exName] = [
                'max_marks' => $exMax,
                'marks_obtained' => $exObt
            ];
        }

        // Fetch Attendance
        $stmtAY = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id LIMIT 1");
        $stmtAY->execute([':id' => $annualExam['academic_year_id']]);
        $ayDetail = $stmtAY->fetch(\PDO::FETCH_ASSOC);
        $startD = $ayDetail ? $ayDetail['start_date'] : '2020-01-01';
        $endD = $ayDetail ? $ayDetail['end_date'] : '2030-12-31';

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

        return [
            'is_final_session_report' => true,
            'badge_title' => 'FINAL ACADEMIC REPORT CARD',
            'exam_id' => (int)$annualExam['id'],
            'exam_name' => 'FINAL ACADEMIC REPORT CARD',
            'original_exam_name' => $annualExam['exam_name'],
            'student_id' => $studentId,
            'student_name' => $student['name'],
            'roll_no' => $student['roll_no'],
            'admission_no' => $student['sr_no'] ?? $student['admission_no'] ?? '',
            'father_name' => $student['father_name'] ?? '',
            'mother_name' => $student['mother_name'] ?? '',
            'dob' => $student['dob'] ?? '',
            'class_name' => $annualExam['class_name'],
            'class_section' => $annualExam['class_section'],
            'academic_year_name' => $annualExam['academic_year_name'],
            'school_name' => $school['name'] ?? 'Academic Portal',
            'school_address' => $schoolAddress,
            'school_logo' => $schoolLogoUrl,
            'report_card_remark' => $school['report_card_remark'] ?? null,
            'template_code' => $tplCode,
            'session_exams' => $sessionExams,
            'subjects' => $finalSubjects,
            'exam_totals' => $examTotalsMap,
            'total_max' => $grandSessionMax,
            'total_obtained' => $grandSessionObtained,
            'percentage' => $overallPct,
            'grade' => $overallGrade,
            'result' => $allPassed ? 'PASS' : 'FAIL',
            'class_rank' => "1 of 1",
            'section_rank' => "1 of 1",
            'attendance' => [
                'working_days' => $attTotal,
                'present_days' => $attPresent,
                'attendance_rate' => $attRate
            ],
            'status' => 'Published'
        ];
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
        if (!$config && $classId) {
            $stmtFallback = $pdo->prepare("
                SELECT cfg.* 
                FROM class_fee_configurations cfg
                JOIN classes c1 ON cfg.class_id = c1.id
                JOIN classes c2 ON c1.name COLLATE utf8mb4_unicode_ci = c2.name COLLATE utf8mb4_unicode_ci AND c1.school_id = c2.school_id
                WHERE cfg.school_id = :sid AND c2.id = :cid
                LIMIT 1
            ");
            $stmtFallback->execute([':sid' => $schoolId, ':cid' => $classId]);
            $config = $stmtFallback->fetch();
        }
        $monthlyFeesAmountMap = [];
        if ($config) {
            $monthlyFeesAmountMap = is_string($config['monthly_fees']) ? json_decode($config['monthly_fees'], true) : $config['monthly_fees'];
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
                    'amount' => (int)round((float)$paymentsMap[$month]['amount_paid']),
                    'payment_date' => $paymentsMap[$month]['payment_date'],
                    'status' => 'Paid',
                    'receipt_no' => $paymentsMap[$month]['receipt_no']
                ];
            } else {
                $monthlyFees[] = [
                    'id' => 0,
                    'month' => $month,
                    'amount' => (int)round($monthAmount),
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
                'amount' => (int)round($amt),
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
            'total_outstanding' => (int)round($totalOutstanding),
            'monthly_due' => (int)round($monthlyDue),
            'additional_due' => (int)round($additionalDue),
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
            
            if (empty($groupPayments)) {
                $feeMonthDisplay = !empty($payment['fee_month']) ? $payment['fee_month'] : 'April';
                $totalAmountPaid = (float)($payment['amount_paid'] ?? 0.0);
                $billingItemLabel = "Month: ";
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
                $billingItemLabel = count($monthsList) > 1 ? "Months: " : "Month: ";
            }
            $amountPaidFormatted = "Rs " . number_format((float)$totalAmountPaid, 0);
        } else {
            $feeMonthDisplay = !empty($payment['fee_name']) ? $payment['fee_name'] : (!empty($payment['fee_month']) ? $payment['fee_month'] : 'Additional Fee');
            $totalAmountPaid = (float)($payment['amount'] ?? 0.0);
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

    public function getNotifications(array $user, array $params = []): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? '');
        $limit = isset($params['limit']) ? max(1, (int)$params['limit']) : 10;
        $offset = isset($params['offset']) ? max(0, (int)$params['offset']) : 0;
        $pdo = $this->repo->getPdo();

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

    public function deleteNotification(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? '');
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            DELETE FROM dashboard_notifications
            WHERE id = :id AND school_id = :school_id AND (user_id = :user_id OR (user_role = :role AND user_id IS NULL))
        ");
        $stmt->execute([':id' => $id, ':school_id' => $schoolId, ':user_id' => $userId, ':role' => $role]);

        return ['success' => true];
    }

    public function markAllNotificationsRead(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? '');
        $pdo = $this->repo->getPdo();

        $stmt = $pdo->prepare("
            UPDATE dashboard_notifications
            SET is_read = 1
            WHERE school_id = :school_id AND (user_id = :user_id OR (user_role = :role AND user_id IS NULL)) AND is_read = 0
        ");
        $stmt->execute([':school_id' => $schoolId, ':user_id' => $userId, ':role' => $role]);

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
        $academicYearId = (int) ($student['academic_year_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        $sql = "
            SELECT DISTINCT e.id, e.name, e.start_date, e.end_date,
                   COALESCE(ecs.scheme_published, 0) AS scheme_published,
                   COALESCE(ecs.admit_card_published, 0) AS admit_card_published,
                   COALESCE(ecs.status, 'Draft') AS result_status
            FROM examinations e
            LEFT JOIN examination_class_status ecs ON e.id = ecs.exam_id AND ecs.class_id = :class_id
            WHERE e.school_id = :school_id 
              AND e.status = 'Published'
        ";
        $params = [
            ':class_id' => $classId,
            ':school_id' => $schoolId
        ];

        if ($academicYearId > 0) {
            $sql .= " AND (e.academic_year_id = :ayid OR e.academic_year_id IS NULL)";
            $params[':ayid'] = $academicYearId;
        }

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

        // 1. Fetch class base monthly fee configurations (monthly_fees JSON column)
        $stmtBase = $pdo->prepare("
            SELECT monthly_fees FROM class_fee_configurations 
            WHERE class_id = :class_id AND school_id = :school_id 
            ORDER BY id DESC LIMIT 1
        ");
        $stmtBase->execute([':class_id' => $classId, ':school_id' => $schoolId]);
        $rawMonthlyFees = $stmtBase->fetchColumn();
        $classMonthlyFees = [];
        if ($rawMonthlyFees) {
            $classMonthlyFees = json_decode((string)$rawMonthlyFees, true) ?: [];
        }

        // 2. Fetch specific student monthly fee configurations
        $stmtMonths = $pdo->prepare("
            SELECT fee_month, amount 
            FROM student_monthly_fee_configurations 
            WHERE student_id = :student_id AND school_id = :school_id
        ");
        $stmtMonths->execute([':student_id' => $studentId, ':school_id' => $schoolId]);
        $studentMonthlyFees = $stmtMonths->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        // 3. Fetch paid records from fee_payments (only count status = PAID / SUCCESS)
        $stmtPay = $pdo->prepare("
            SELECT fee_month, SUM(COALESCE(amount_paid, 0)) AS total_paid
            FROM fee_payments
            WHERE school_id = :sid AND student_id = :stid AND (LOWER(status) = 'paid' OR LOWER(status) = 'success')
            GROUP BY fee_month
        ");
        $stmtPay->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $paidMap = $stmtPay->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        // Generate months structure
        $allAcademicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
        $currentMonthName = date('F');
        $currentMonthIdx = array_search($currentMonthName, $allAcademicMonths, true);
        if ($currentMonthIdx === false) {
            $currentMonthIdx = 11;
        }

        $monthlyDue = 0.0;
        foreach ($allAcademicMonths as $month) {
            if (isset($studentMonthlyFees[$month])) {
                $monthAmount = (float)$studentMonthlyFees[$month];
            } else if (isset($classMonthlyFees[$month])) {
                $monthAmount = (float)$classMonthlyFees[$month];
            } else {
                $monthAmount = 0.0;
            }

            $monthIdx = array_search($month, $allAcademicMonths, true);
            $isFuture = $monthIdx > $currentMonthIdx;

            if (!$isFuture && $monthAmount > 0) {
                $paidForMonth = isset($paidMap[$month]) ? (float)$paidMap[$month] : 0.0;
                $dueForMonth = max(0.0, $monthAmount - $paidForMonth);
                $monthlyDue += $dueForMonth;
            }
        }

        // 4. Fetch additional fee payments (where status is NOT Paid)
        $stmtAdd = $pdo->prepare("
            SELECT COALESCE(SUM(afp.amount), 0)
            FROM additional_fee_payments afp
            WHERE afp.school_id = :sid AND afp.student_id = :stid AND LOWER(afp.status) != 'paid'
        ");
        $stmtAdd->execute([':sid' => $schoolId, ':stid' => $studentId]);
        $additionalDue = (float)$stmtAdd->fetchColumn();

        return round($monthlyDue + $additionalDue, 2);
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

        // Check if there is an active finance setting for due restriction
        $academicYearId = (int)($student['academic_year_id'] ?? 0);
        $stmtSetting = $pdo->prepare("
            SELECT enable_due_restriction, max_allowed_due, restrict_admit_card, restrict_exam_result FROM school_finance_settings 
            WHERE school_id = :sid AND (academic_year_id = :ayid OR academic_year_id IS NULL OR academic_year_id = 0)
            ORDER BY id DESC LIMIT 1
        ");
        $stmtSetting->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
        $settings = $stmtSetting->fetch(PDO::FETCH_ASSOC);

        if (!$settings) {
            $stmtSettingFallback = $pdo->prepare("
                SELECT enable_due_restriction, max_allowed_due, restrict_admit_card, restrict_exam_result 
                FROM school_finance_settings 
                WHERE school_id = :sid 
                ORDER BY id DESC LIMIT 1
            ");
            $stmtSettingFallback->execute([':sid' => $schoolId]);
            $settings = $stmtSettingFallback->fetch(PDO::FETCH_ASSOC);
        }

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

                // Attach full report_card data for mobile view & download
                $allRC = $this->getPublishedReportCards($user);
                foreach ($allRC as $rc) {
                    if ((int)$rc['exam_id'] === $examId) {
                        $response['report_card'] = $rc;
                        break;
                    }
                }
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

    public function markNotificationRead(array $user, int $id, array $body = []): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $role = strtoupper($user['role'] ?? 'STUDENT');
        $pdo = $this->studentRepo->getPdo();

        if ($id > 0) {
            $stmt = $pdo->prepare("
                UPDATE dashboard_notifications
                SET is_read = 1
                WHERE id = :id AND school_id = :school_id
            ");
            $stmt->execute([
                ':id' => $id,
                ':school_id' => $schoolId,
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
}
