<?php

namespace App\Domain\Grading\Services;

use App\Shared\BaseService;
use PDO;

class GradingService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    public function getExams(int $schoolId, int $ayId, int $classId = 0): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $exams = $this->getMockExams();
            $filtered = array_filter($exams, function ($e) use ($schoolId, $ayId, $classId) {
                $match = (int)$e['school_id'] === $schoolId && (int)$e['academic_year_id'] === $ayId;
                if ($classId > 0) {
                    $match = $match && (int)$e['class_id'] === $classId;
                }
                return $match;
            });
            return array_values($filtered);
        }

        $sql = "SELECT e.*, c.name as class_name FROM exams e JOIN classrooms c ON e.class_id = c.id WHERE e.school_id = :school_id AND e.academic_year_id = :ay_id ORDER BY e.id DESC";
        $execParams = ['school_id' => $schoolId, 'ay_id' => $ayId];
        
        if ($classId > 0) {
            $sql .= " AND e.class_id = :class_id";
            $execParams['class_id'] = $classId;
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        $exams = $stmt->fetchAll();
        
        foreach ($exams as &$exam) {
            $exam['id'] = (int)$exam['id'];
            $exam['academic_year_id'] = (int)$exam['academic_year_id'];
            $exam['class_id'] = (int)$exam['class_id'];
            
            // Load subjects
            $subStmt = $pdo->prepare("SELECT subject_name, max_marks, exam_date, start_time, end_time, instructions FROM exam_subjects WHERE exam_id = :exam_id");
            $subStmt->execute(['exam_id' => $exam['id']]);
            $exam['subjects'] = $subStmt->fetchAll();
        }
        unset($exam);
        
        return $exams;
    }

    public function createExam(int $schoolId, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $classId = (int)($data['class_id'] ?? 0);
        $ayId = (int)($data['academic_year_id'] ?? 0);
        $subjects = $data['subjects'] ?? [];

        if (empty($name) || !$classId || !$ayId || empty($subjects)) {
            throw new \InvalidArgumentException('Exam name, class_id, academic_year_id, and subjects list are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $exams = $this->getMockExams();
            $newId = count($exams) > 0 ? max(array_column($exams, 'id')) + 1 : 1;
            
            $newExam = [
                'id' => $newId,
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'class_id' => $classId,
                'name' => $name,
                'description' => $data['description'] ?? '',
                'status' => $data['status'] ?? 'Draft',
                'start_date' => $data['start_date'] ?? date('Y-m-d'),
                'end_date' => $data['end_date'] ?? date('Y-m-d'),
                'subjects' => $subjects
            ];
            
            $exams[] = $newExam;
            $this->saveMockExams($exams);
            return $newExam;
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO exams (school_id, academic_year_id, class_id, name, description, status, start_date, end_date) 
                                   VALUES (:school_id, :ay_id, :class_id, :name, :description, :status, :start, :end)");
            
            $start = $data['start_date'] ?? null;
            $end = $data['end_date'] ?? null;
            
            $stmt->execute([
                'school_id' => $schoolId,
                'ay_id' => $ayId,
                'class_id' => $classId,
                'name' => $name,
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'Draft',
                'start' => $start,
                'end' => $end
            ]);
            
            $examId = (int)$pdo->lastInsertId();
            
            $subStmt = $pdo->prepare("INSERT INTO exam_subjects (exam_id, subject_name, max_marks, exam_date, start_time, end_time, instructions) 
                                       VALUES (:exam_id, :subject_name, :max_marks, :exam_date, :start_time, :end_time, :instructions)");
            
            foreach ($subjects as $s) {
                $subName = trim($s['subject_name'] ?? '');
                $maxMarks = (int)($s['max_marks'] ?? 100);
                if (!empty($subName)) {
                    $subStmt->execute([
                        'exam_id' => $examId,
                        'subject_name' => $subName,
                        'max_marks' => $maxMarks,
                        'exam_date' => $s['exam_date'] ?? null,
                        'start_time' => $s['start_time'] ?? null,
                        'end_time' => $s['end_time'] ?? null,
                        'instructions' => $s['instructions'] ?? null
                    ]);
                }
            }
            
            $pdo->commit();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Create Exam', "Created examination $name for class ID $classId.");
            
            return ['id' => $examId, 'name' => $name];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function deleteExam(int $schoolId, int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $exams = $this->getMockExams();
            $filtered = array_filter($exams, function ($e) use ($id) {
                return (int)$e['id'] !== $id;
            });
            $this->saveMockExams(array_values($filtered));
            return ['success' => true];
        }

        $stmt = $pdo->prepare("DELETE FROM exams WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);
        
        $this->logAudit($pdo, $schoolId, $performedBy, 'Delete Exam', "Deleted examination ID $id.");
        return ['success' => true];
    }

    public function updateExam(int $schoolId, int $id, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $subjects = $data['subjects'] ?? [];

        if (empty($name) || empty($subjects)) {
            throw new \InvalidArgumentException('Exam name and subjects list are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $exams = $this->getMockExams();
            foreach ($exams as &$e) {
                if ((int)$e['id'] === $id && (int)$e['school_id'] === $schoolId) {
                    $e['name'] = $name;
                    $e['description'] = $data['description'] ?? '';
                    $e['status'] = $data['status'] ?? 'Draft';
                    $e['start_date'] = $data['start_date'] ?? date('Y-m-d');
                    $e['end_date'] = $data['end_date'] ?? date('Y-m-d');
                    $e['subjects'] = $subjects;
                }
            }
            $this->saveMockExams($exams);
            return ['success' => true];
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE exams SET name = :name, description = :description, status = :status, start_date = :start, end_date = :end WHERE id = :id AND school_id = :school_id");
            $stmt->execute([
                'name' => $name,
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'Draft',
                'start' => $data['start_date'] ?? null,
                'end' => $data['end_date'] ?? null,
                'id' => $id,
                'school_id' => $schoolId
            ]);

            // Sync subjects
            $del = $pdo->prepare("DELETE FROM exam_subjects WHERE exam_id = :exam_id");
            $del->execute(['exam_id' => $id]);

            $subStmt = $pdo->prepare("INSERT INTO exam_subjects (exam_id, subject_name, max_marks, exam_date, start_time, end_time, instructions) 
                                       VALUES (:exam_id, :subject_name, :max_marks, :exam_date, :start_time, :end_time, :instructions)");
            
            foreach ($subjects as $s) {
                $subName = trim($s['subject_name'] ?? '');
                $maxMarks = (int)($s['max_marks'] ?? 100);
                if (!empty($subName)) {
                    $subStmt->execute([
                        'exam_id' => $id,
                        'subject_name' => $subName,
                        'max_marks' => $maxMarks,
                        'exam_date' => $s['exam_date'] ?? null,
                        'start_time' => $s['start_time'] ?? null,
                        'end_time' => $s['end_time'] ?? null,
                        'instructions' => $s['instructions'] ?? null
                    ]);
                }
            }

            $pdo->commit();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Update Exam', "Updated examination ID $id ($name).");
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getExamMarks(int $schoolId, int $examId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            // Mock sandbox marks
            $marksList = $this->getMockMarks();
            $filtered = array_filter($marksList, function ($m) use ($examId) {
                return (int)$m['exam_id'] === $examId;
            });
            return array_values($filtered);
        }

        // Verify exam exists and belongs to school
        $chk = $pdo->prepare("SELECT COUNT(*) FROM exams WHERE id = :exam_id AND school_id = :school_id");
        $chk->execute(['exam_id' => $examId, 'school_id' => $schoolId]);
        if ($chk->fetchColumn() == 0) {
            throw new \Exception('Exam not found', 404);
        }

        $stmt = $pdo->prepare("SELECT student_id, subject_name, marks_obtained, is_absent FROM exam_marks WHERE exam_id = :exam_id");
        $stmt->execute(['exam_id' => $examId]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['student_id'] = (int)$r['student_id'];
            $r['marks_obtained'] = (float)$r['marks_obtained'];
            $r['is_absent'] = (int)$r['is_absent'];
        }
        unset($r);
        return $rows;
    }

    public function saveExamMarks(int $schoolId, int $examId, array $marksList, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $allMarks = $this->getMockMarks();
            // Delete old exam marks
            $allMarks = array_filter($allMarks, function ($m) use ($examId) {
                return (int)$m['exam_id'] !== $examId;
            });
            
            foreach ($marksList as $item) {
                $allMarks[] = [
                    'exam_id' => $examId,
                    'student_id' => (int)$item['student_id'],
                    'subject_name' => $item['subject_name'],
                    'marks_obtained' => (float)$item['marks_obtained'],
                    'is_absent' => (int)($item['is_absent'] ?? 0)
                ];
            }
            $this->saveMockMarks(array_values($allMarks));
            return ['success' => true];
        }

        // Verify exam
        $chk = $pdo->prepare("SELECT name FROM exams WHERE id = :exam_id AND school_id = :school_id");
        $chk->execute(['exam_id' => $examId, 'school_id' => $schoolId]);
        $examName = $chk->fetchColumn();
        if (!$examName) {
            throw new \Exception('Exam not found', 404);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO exam_marks (exam_id, student_id, subject_name, marks_obtained, is_absent) 
                                   VALUES (:exam_id, :student_id, :subject_name, :marks, :abs)
                                   ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), is_absent = VALUES(is_absent)");

            foreach ($marksList as $item) {
                $studentId = (int)$item['student_id'];
                $subName = $item['subject_name'];
                $marks = (float)$item['marks_obtained'];
                $isAbs = (int)($item['is_absent'] ?? 0);

                $stmt->execute([
                    'exam_id' => $examId,
                    'student_id' => $studentId,
                    'subject_name' => $subName,
                    'marks' => $marks,
                    'abs' => $isAbs
                ]);
            }
            $pdo->commit();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Enter Marks', "Saved marks for exam ID $examId ($examName).");
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getSchoolSignatures(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'teacher_signature' => null,
                'class_teacher_signature' => null,
                'principal_signature' => null
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM school_signatures WHERE school_id = :school_id");
        $stmt->execute(['school_id' => $schoolId]);
        $sigs = $stmt->fetch();
        
        return $sigs ? [
            'teacher_signature' => $sigs['teacher_signature'],
            'class_teacher_signature' => $sigs['class_teacher_signature'],
            'principal_signature' => $sigs['principal_signature']
        ] : [
            'teacher_signature' => null,
            'class_teacher_signature' => null,
            'principal_signature' => null
        ];
    }

    public function saveSchoolSignatures(int $schoolId, array $data, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['success' => true];
        }

        $stmt = $pdo->prepare("INSERT INTO school_signatures (school_id, teacher_signature, class_teacher_signature, principal_signature) 
                               VALUES (:school_id, :t, :ct, :p)
                               ON DUPLICATE KEY UPDATE teacher_signature = VALUES(teacher_signature), class_teacher_signature = VALUES(class_teacher_signature), principal_signature = VALUES(principal_signature)");
        
        $stmt->execute([
            'school_id' => $schoolId,
            't' => $data['teacher_signature'] ?? null,
            'ct' => $data['class_teacher_signature'] ?? null,
            'p' => $data['principal_signature'] ?? null
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Update Signatures', "Updated report card signatures configuration.");
        return ['success' => true];
    }

    public function getExamRemarks(int $schoolId, int $examId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            // Mock remarks
            $remarks = $this->getMockRemarks();
            $filtered = array_filter($remarks, function ($r) use ($examId) {
                return (int)$r['exam_id'] === $examId;
            });
            return array_values($filtered);
        }

        $stmt = $pdo->prepare("SELECT r.student_id, r.remarks FROM report_card_remarks r JOIN exams e ON r.exam_id = e.id WHERE e.id = :exam_id AND e.school_id = :school_id");
        $stmt->execute(['exam_id' => $examId, 'school_id' => $schoolId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['student_id'] = (int)$r['student_id'];
        }
        unset($r);
        return $rows;
    }

    public function saveExamRemarks(int $schoolId, int $examId, array $remarksList, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $remarks = $this->getMockRemarks();
            $remarks = array_filter($remarks, function ($r) use ($examId) {
                return (int)$r['exam_id'] !== $examId;
            });
            foreach ($remarksList as $item) {
                $remarks[] = [
                    'exam_id' => $examId,
                    'student_id' => (int)$item['student_id'],
                    'remarks' => $item['remarks']
                ];
            }
            $this->saveMockRemarks(array_values($remarks));
            return ['success' => true];
        }

        // Verify exam
        $chk = $pdo->prepare("SELECT COUNT(*) FROM exams WHERE id = :exam_id AND school_id = :school_id");
        $chk->execute(['exam_id' => $examId, 'school_id' => $schoolId]);
        if ($chk->fetchColumn() == 0) {
            throw new \Exception('Exam not found', 404);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO report_card_remarks (student_id, exam_id, remarks) 
                                   VALUES (:student_id, :exam_id, :remarks)
                                   ON DUPLICATE KEY UPDATE remarks = VALUES(remarks)");

            foreach ($remarksList as $item) {
                $studentId = (int)$item['student_id'];
                $rem = trim($item['remarks'] ?? '');
                
                $stmt->execute([
                    'student_id' => $studentId,
                    'exam_id' => $examId,
                    'remarks' => $rem
                ]);
            }
            $pdo->commit();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Save Remarks', "Saved report card remarks for exam ID $examId.");
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getGradingScales(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                ['grade_name' => 'A+', 'min_percentage' => 90.00, 'max_percentage' => 100.00],
                ['grade_name' => 'A',  'min_percentage' => 80.00, 'max_percentage' => 89.99],
                ['grade_name' => 'B',  'min_percentage' => 70.00, 'max_percentage' => 79.99],
                ['grade_name' => 'C',  'min_percentage' => 60.00, 'max_percentage' => 69.99],
                ['grade_name' => 'D',  'min_percentage' => 40.00, 'max_percentage' => 59.99],
                ['grade_name' => 'F',  'min_percentage' => 0.00,  'max_percentage' => 39.99]
            ];
        }

        $stmt = $pdo->prepare("SELECT grade_name, min_percentage, max_percentage FROM grading_scales WHERE school_id = :school_id ORDER BY min_percentage DESC");
        $stmt->execute(['school_id' => $schoolId]);
        $scales = $stmt->fetchAll();
        
        if (empty($scales)) {
            return [
                ['grade_name' => 'A+', 'min_percentage' => 90.00, 'max_percentage' => 100.00],
                ['grade_name' => 'A',  'min_percentage' => 80.00, 'max_percentage' => 89.99],
                ['grade_name' => 'B',  'min_percentage' => 70.00, 'max_percentage' => 79.99],
                ['grade_name' => 'C',  'min_percentage' => 60.00, 'max_percentage' => 69.99],
                ['grade_name' => 'D',  'min_percentage' => 40.00, 'max_percentage' => 59.99],
                ['grade_name' => 'F',  'min_percentage' => 0.00,  'max_percentage' => 39.99]
            ];
        }
        
        foreach ($scales as &$s) {
            $s['min_percentage'] = (float)$s['min_percentage'];
            $s['max_percentage'] = (float)$s['max_percentage'];
        }
        unset($s);
        
        return $scales;
    }

    public function saveGradingScales(int $schoolId, array $scales, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['success' => true];
        }

        $pdo->beginTransaction();
        try {
            // Delete old scales
            $del = $pdo->prepare("DELETE FROM grading_scales WHERE school_id = :school_id");
            $del->execute(['school_id' => $schoolId]);
            
            $ins = $pdo->prepare("INSERT INTO grading_scales (school_id, grade_name, min_percentage, max_percentage) 
                                  VALUES (:school_id, :grade_name, :min, :max)");
                                  
            foreach ($scales as $s) {
                $grade = trim($s['grade_name'] ?? '');
                $min = (float)($s['min_percentage'] ?? 0);
                $max = (float)($s['max_percentage'] ?? 0);
                if (!empty($grade)) {
                    $ins->execute([
                        'school_id' => $schoolId,
                        'grade_name' => $grade,
                        'min' => $min,
                        'max' => $max
                    ]);
                }
            }
            $pdo->commit();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Save Grading Scales', "Configured custom grading scales.");
            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function getStudentPerformanceSummary(int $schoolId, int $studentId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                'student_id' => $studentId,
                'name' => 'Student Name',
                'roll_number' => '10',
                'class_id' => 1,
                'group_name' => 'A',
                'attendance' => ['present' => 20, 'absent' => 0, 'leave' => 0, 'total' => 20, 'percentage' => 100.0],
                'exams' => [],
                'signatures' => ['teacher_signature' => null, 'class_teacher_signature' => null, 'principal_signature' => null],
                'grading_scales' => $this->getGradingScales($schoolId)
            ];
        }

        // Fetch student info
        $stmt = $pdo->prepare("SELECT * FROM students WHERE id = :id AND school_id = :sid");
        $stmt->execute(['id' => $studentId, 'sid' => $schoolId]);
        $student = $stmt->fetch();
        if (!$student) {
            throw new \Exception('Student not found.', 404);
        }
        
        // Fetch attendance analytics
        $attStmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM student_attendance 
                               WHERE school_id = :school_id AND student_id = :student_id AND academic_year_id = :ay_id 
                               GROUP BY status");
        $attStmt->execute([
            'school_id' => $schoolId,
            'student_id' => $studentId,
            'ay_id' => $ayId
        ]);
        $attRows = $attStmt->fetchAll();
        $counts = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
        $totalAtt = 0;
        foreach ($attRows as $row) {
            $counts[$row['status']] = (int)$row['count'];
            $totalAtt += (int)$row['count'];
        }
        $attPct = $totalAtt > 0 ? round(($counts['Present'] / $totalAtt) * 100, 1) : 0;
        
        // Fetch exams and marks for the class
        $exStmt = $pdo->prepare("SELECT e.*, c.name as class_name FROM exams e JOIN classrooms c ON e.class_id = c.id WHERE e.school_id = :school_id AND e.academic_year_id = :ay_id AND e.class_id = :class_id");
        $exStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $student['class_id']
        ]);
        $exams = $exStmt->fetchAll();
        
        $examsData = [];
        foreach ($exams as $exam) {
            $examId = (int)$exam['id'];
            
            // Load subjects
            $subStmt = $pdo->prepare("SELECT subject_name, max_marks, exam_date, start_time, end_time, instructions FROM exam_subjects WHERE exam_id = :exam_id");
            $subStmt->execute(['exam_id' => $examId]);
            $subjects = $subStmt->fetchAll();
            
            // Load marks obtained by this student
            $marksStmt = $pdo->prepare("SELECT subject_name, marks_obtained FROM exam_marks WHERE exam_id = :exam_id AND student_id = :student_id");
            $marksStmt->execute(['exam_id' => $examId, 'student_id' => $studentId]);
            $marksRows = $marksStmt->fetchAll();
            $marksMap = [];
            foreach ($marksRows as $row) {
                $marksMap[$row['subject_name']] = (float)$row['marks_obtained'];
            }
            
            // Calculate rank
            $allMarksStmt = $pdo->prepare("SELECT student_id, SUM(marks_obtained) as total_marks 
                                           FROM exam_marks 
                                           WHERE exam_id = :exam_id 
                                           GROUP BY student_id 
                                           ORDER BY total_marks DESC");
            $allMarksStmt->execute(['exam_id' => $examId]);
            $allMarks = $allMarksStmt->fetchAll();
            
            $rank = '-';
            $rankIdx = 1;
            foreach ($allMarks as $m) {
                if ((int)$m['student_id'] === $studentId) {
                    $rank = $rankIdx;
                    break;
                }
                $rankIdx++;
            }
            
            // Load remark
            $remStmt = $pdo->prepare("SELECT remarks FROM report_card_remarks WHERE student_id = :student_id AND exam_id = :exam_id");
            $remStmt->execute(['student_id' => $studentId, 'exam_id' => $examId]);
            $remark = $remStmt->fetchColumn() ?: '';
            
            $examsData[] = [
                'id' => $examId,
                'name' => $exam['name'],
                'start_date' => $exam['start_date'],
                'end_date' => $exam['end_date'],
                'subjects' => $subjects,
                'marks' => $marksMap,
                'rank' => $rank,
                'remarks' => $remark
            ];
        }
        
        // Fetch signatures
        $signaturesData = $this->getSchoolSignatures($schoolId);
        
        // Fetch grading scales
        $scales = $this->getGradingScales($schoolId);
        
        return [
            'student_id' => $studentId,
            'name' => $student['name'],
            'roll_number' => $student['roll_number'],
            'class_id' => (int)$student['class_id'],
            'group_name' => $student['group_name'],
            'attendance' => [
                'present' => $counts['Present'],
                'absent' => $counts['Absent'],
                'leave' => $counts['Leave'],
                'total' => $totalAtt,
                'percentage' => $attPct
            ],
            'exams' => $examsData,
            'signatures' => $signaturesData,
            'grading_scales' => $scales
        ];
    }

    // --- Mock Helpers ---

    private function getMockExams(): array
    {
        $file = __DIR__ . '/../../../../mock_exams.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockExams(array $exams): void
    {
        $file = __DIR__ . '/../../../../mock_exams.json';
        file_put_contents($file, json_encode($exams, JSON_PRETTY_PRINT));
    }

    private function getMockMarks(): array
    {
        $file = __DIR__ . '/../../../../mock_marks.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockMarks(array $marks): void
    {
        $file = __DIR__ . '/../../../../mock_marks.json';
        file_put_contents($file, json_encode($marks, JSON_PRETTY_PRINT));
    }

    private function getMockRemarks(): array
    {
        $file = __DIR__ . '/../../../../mock_remarks.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockRemarks(array $remarks): void
    {
        $file = __DIR__ . '/../../../../mock_remarks.json';
        file_put_contents($file, json_encode($remarks, JSON_PRETTY_PRINT));
    }
}
