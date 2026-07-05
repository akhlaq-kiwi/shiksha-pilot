<?php

declare(strict_types=1);

namespace App\Domain\Student\Services;

use App\Domain\Student\Repositories\StudentDataRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use Psr\Log\LoggerInterface;

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
            $student = $this->repo->findByUserEmail((string) ($user['email'] ?? ''), $schoolId);
        } else {
            // PARENT: match via phone stored on users.phone -> students.parent_phone
            $student = $this->repo->findByParentPhone((string) ($user['phone'] ?? ''), $schoolId);
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
}
