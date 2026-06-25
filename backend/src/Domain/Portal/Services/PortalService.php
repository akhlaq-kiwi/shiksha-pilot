<?php

namespace App\Domain\Portal\Services;

use App\Shared\BaseService;
use PDO;
use Exception;

class PortalService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    /**
     * Get Teacher Dashboard Info
     */
    public function getTeacherDashboard(int $schoolId, array $auth): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return $this->getMockTeacherDashboard($schoolId, $auth);
        }

        // Find teacher profile using their phone
        $teachStmt = $pdo->prepare("SELECT * FROM teachers WHERE school_id = :sid AND phone = :phone LIMIT 1");
        $teachStmt->execute(['sid' => $schoolId, 'phone' => $auth['phone']]);
        $teacher = $teachStmt->fetch(PDO::FETCH_ASSOC);
        if (!$teacher) {
            throw new Exception('Teacher profile not found for phone: ' . $auth['phone'], 404);
        }
        
        $teacherId = (int)$teacher['id'];
        
        // Find assigned class
        $classStmt = $pdo->prepare("SELECT id, name FROM classrooms WHERE school_id = :sid AND class_teacher_id = :tid LIMIT 1");
        $classStmt->execute(['sid' => $schoolId, 'tid' => $teacherId]);
        $assignedClass = $classStmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($assignedClass) {
            $assignedClass['id'] = (int)$assignedClass['id'];
        }
        
        // School timetable config
        $schStmt = $pdo->prepare("SELECT total_periods FROM schools WHERE id = :sid LIMIT 1");
        $schStmt->execute(['sid' => $schoolId]);
        $totalPeriods = (int)($schStmt->fetchColumn() ?: 8);
        
        // Today's schedule
        $today = date('Y-m-d');
        $schedStmt = $pdo->prepare("
            SELECT cs.*, c.name AS class_name 
            FROM class_schedules cs
            JOIN classrooms c ON cs.class_id = c.id
            WHERE cs.school_id = :sid 
              AND cs.schedule_date = :today
              AND cs.status IN ('Scheduled', 'Published')
        ");
        $schedStmt->execute(['sid' => $schoolId, 'today' => $today]);
        $schedules = $schedStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $todayTimetable = [];
        for ($i = 0; $i < $totalPeriods; $i++) {
            $todayTimetable[] = ['period' => $i + 1, 'status' => 'Free', 'subject' => '', 'class_name' => ''];
        }
        
        foreach ($schedules as $s) {
            $subjects = json_decode($s['subjects'], true) ?: [];
            foreach ($subjects as $idx => $sub) {
                if ($idx >= $totalPeriods) break;
                
                $subTeacherId = isset($sub['teacher_id']) ? (int)$sub['teacher_id'] : 0;
                $backupTeacherId = isset($sub['backup_teacher_id']) ? (int)$sub['backup_teacher_id'] : 0;
                
                if ($subTeacherId === $teacherId || $backupTeacherId === $teacherId) {
                    $todayTimetable[$idx] = [
                        'period' => $idx + 1,
                        'status' => 'Busy',
                        'subject' => is_array($sub) ? ($sub['subject'] ?? '') : $sub,
                        'class_name' => $s['class_name'],
                        'class_id' => (int)$s['class_id'],
                        'backup' => ($backupTeacherId === $teacherId)
                    ];
                }
            }
        }
        
        // Upcoming schedule (next 5 days)
        $upcomingTimetable = [];
        for ($i = 1; $i <= 5; $i++) {
            $futureDate = date('Y-m-d', strtotime("+$i days"));
            $futureDay = date('l', strtotime("+$i days"));
            
            $futStmt = $pdo->prepare("
                SELECT cs.*, c.name AS class_name 
                FROM class_schedules cs
                JOIN classrooms c ON cs.class_id = c.id
                WHERE cs.school_id = :sid 
                  AND cs.schedule_date = :fdate
                  AND cs.status IN ('Scheduled', 'Published')
            ");
            $futStmt->execute(['sid' => $schoolId, 'fdate' => $futureDate]);
            $futSchedules = $futStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $dayPeriods = [];
            foreach ($futSchedules as $s) {
                $subjects = json_decode($s['subjects'], true) ?: [];
                foreach ($subjects as $idx => $sub) {
                    $subTeacherId = isset($sub['teacher_id']) ? (int)$sub['teacher_id'] : 0;
                    $backupTeacherId = isset($sub['backup_teacher_id']) ? (int)$sub['backup_teacher_id'] : 0;
                    
                    if ($subTeacherId === $teacherId || $backupTeacherId === $teacherId) {
                        $dayPeriods[] = [
                            'period' => $idx + 1,
                            'subject' => is_array($sub) ? ($sub['subject'] ?? '') : $sub,
                            'class_name' => $s['class_name'],
                            'backup' => ($backupTeacherId === $teacherId)
                        ];
                    }
                }
            }
            if (!empty($dayPeriods)) {
                $upcomingTimetable[] = [
                    'date' => $futureDate,
                    'day' => $futureDay,
                    'periods' => $dayPeriods
                ];
            }
        }
        
        // Read-only School-wide Finance Summary
        $feesCollectedStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE school_id = :sid AND status = 'Paid'");
        $feesCollectedStmt->execute(['sid' => $schoolId]);
        $feesCollected = (float)$feesCollectedStmt->fetchColumn() ?: 0.00;
        
        $feesOutstandingStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE school_id = :sid AND status = 'Pending'");
        $feesOutstandingStmt->execute(['sid' => $schoolId]);
        $feesOutstanding = (float)$feesOutstandingStmt->fetchColumn() ?: 0.00;
        
        return [
            'teacher_profile' => $teacher,
            'assigned_class' => $assignedClass,
            'today_timetable' => $todayTimetable,
            'upcoming_timetable' => $upcomingTimetable,
            'finance_summary' => [
                'total_fees_collected' => $feesCollected,
                'total_fees_outstanding' => $feesOutstanding
            ]
        ];
    }

    /**
     * Get Linked Children for Parent Dashboard
     */
    public function getParentDashboard(int $schoolId, int $parentId, string $parentPhone): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return $this->getMockParentDashboard($schoolId, $parentId);
        }

        // Retrieve linked children
        $linkStmt = $pdo->prepare("
            SELECT s.id, s.name, s.roll_number, c.name AS class_name 
            FROM parent_student_mappings psm
            JOIN students s ON psm.student_id = s.id
            JOIN classrooms c ON s.class_id = c.id
            WHERE psm.parent_user_id = :user_id AND s.school_id = :sid
        ");
        $linkStmt->execute(['user_id' => $parentId, 'sid' => $schoolId]);
        $students = $linkStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // If empty list, check if we can auto-link children sharing this phone number!
        if (empty($students) && !empty($parentPhone)) {
            $stmtStud = $pdo->prepare("SELECT id FROM students WHERE school_id = :school_id AND (phone = :phone OR emergency_contact = :phone)");
            $stmtStud->execute(['school_id' => $schoolId, 'phone' => $parentPhone]);
            $linkedStudentIds = $stmtStud->fetchAll(PDO::FETCH_COLUMN) ?: [];
            
            foreach ($linkedStudentIds as $sid) {
                $insMap = $pdo->prepare("INSERT IGNORE INTO parent_student_mappings (parent_user_id, student_id) VALUES (:uid, :sid)");
                $insMap->execute(['uid' => $parentId, 'sid' => $sid]);
            }
            
            // Query again
            $linkStmt->execute(['user_id' => $parentId, 'sid' => $schoolId]);
            $students = $linkStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        foreach ($students as &$student) {
            $student['id'] = (int)$student['id'];
        }
        unset($student);
        
        return [
            'students' => $students
        ];
    }

    /**
     * Get Parent Student Summary
     */
    public function getParentStudentSummary(int $schoolId, int $parentId, int $studentId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return $this->getMockParentStudentSummary($schoolId, $studentId);
        }

        // Verify parent links to this child
        $chk = $pdo->prepare("SELECT COUNT(*) FROM parent_student_mappings WHERE parent_user_id = :uid AND student_id = :sid");
        $chk->execute(['uid' => $parentId, 'sid' => $studentId]);
        if ($chk->fetchColumn() == 0) {
            throw new Exception('Access Denied', 403);
        }
        
        // Student info
        $studStmt = $pdo->prepare("SELECT s.*, c.name as class_name FROM students s JOIN classrooms c ON s.class_id = c.id WHERE s.id = :sid");
        $studStmt->execute(['sid' => $studentId]);
        $student = $studStmt->fetch(PDO::FETCH_ASSOC);
        if ($student) {
            $student['id'] = (int)$student['id'];
            $student['class_id'] = (int)$student['class_id'];
        }
        
        // Attendance Summary
        $attStmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM student_attendance WHERE school_id = :sid AND student_id = :stud_id GROUP BY status");
        $attStmt->execute(['sid' => $schoolId, 'stud_id' => $studentId]);
        $attRows = $attStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $present = 0;
        $absent = 0;
        $leave = 0;
        foreach ($attRows as $row) {
            if ($row['status'] === 'Present') $present = (int)$row['count'];
            if ($row['status'] === 'Absent') $absent = (int)$row['count'];
            if ($row['status'] === 'Leave') $leave = (int)$row['count'];
        }
        $totalAtt = $present + $absent + $leave;
        $attPercentage = $totalAtt > 0 ? round(($present / $totalAtt) * 100, 1) : 100.0;
        
        // Attendance history
        $histStmt = $pdo->prepare("SELECT attendance_date, status, NULL AS remarks FROM student_attendance WHERE student_id = :stud_id ORDER BY attendance_date DESC LIMIT 30");
        $histStmt->execute(['stud_id' => $studentId]);
        $history = $histStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fee Summary
        $tuitionPaidStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :stud_id AND status = 'Paid'");
        $tuitionPaidStmt->execute(['stud_id' => $studentId]);
        $tuitionPaid = (float)$tuitionPaidStmt->fetchColumn() ?: 0.00;
        
        $tuitionPendingStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :stud_id AND status = 'Pending'");
        $tuitionPendingStmt->execute(['stud_id' => $studentId]);
        $tuitionPending = (float)$tuitionPendingStmt->fetchColumn() ?: 0.00;
        
        $extraPaidStmt = $pdo->prepare("
            SELECT SUM(eft.amount) 
            FROM student_extra_fees sef
            JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
            WHERE sef.student_id = :stud_id AND sef.status = 'Paid'
        ");
        $extraPaidStmt->execute(['stud_id' => $studentId]);
        $extraPaid = (float)$extraPaidStmt->fetchColumn() ?: 0.00;
        
        $extraPendingStmt = $pdo->prepare("
            SELECT SUM(eft.amount) 
            FROM student_extra_fees sef
            JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
            WHERE sef.student_id = :stud_id AND sef.status = 'Pending'
        ");
        $extraPendingStmt->execute(['stud_id' => $studentId]);
        $extraPending = (float)$extraPendingStmt->fetchColumn() ?: 0.00;
        
        $cfdStmt = $pdo->prepare("SELECT SUM(amount), SUM(paid_amount) FROM carry_forward_dues WHERE student_id = :stud_id");
        $cfdStmt->execute(['stud_id' => $studentId]);
        $cfdRow = $cfdStmt->fetch(PDO::FETCH_NUM);
        $cfdAmount = (float)($cfdRow[0] ?? 0.00);
        $cfdPaid = (float)($cfdRow[1] ?? 0.00);
        $cfdOutstanding = $cfdAmount - $cfdPaid;
        
        $feesPaid = $tuitionPaid + $extraPaid + $cfdPaid;
        $feesPending = $tuitionPending + $extraPending;
        $outstandingBalance = $feesPending + $cfdOutstanding;
        
        // Payment History
        $payments = [];
        $tPayStmt = $pdo->prepare("SELECT month AS item_name, amount, paid_at FROM fee_records WHERE student_id = :stud_id AND status = 'Paid' ORDER BY paid_at DESC");
        $tPayStmt->execute(['stud_id' => $studentId]);
        foreach ($tPayStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $payments[] = [
                'item_name' => 'Tuition Fee - ' . $row['item_name'],
                'amount' => (float)$row['amount'],
                'paid_at' => $row['paid_at']
            ];
        }
        
        $ePayStmt = $pdo->prepare("
            SELECT eft.name AS item_name, eft.amount, sef.paid_at 
            FROM student_extra_fees sef
            JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
            WHERE sef.student_id = :stud_id AND sef.status = 'Paid'
            ORDER BY sef.paid_at DESC
        ");
        $ePayStmt->execute(['stud_id' => $studentId]);
        foreach ($ePayStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $payments[] = [
                'item_name' => $row['item_name'],
                'amount' => (float)$row['amount'],
                'paid_at' => $row['paid_at']
            ];
        }
        
        $rPayStmt = $pdo->prepare("SELECT amount_recovered AS amount, paid_at FROM previous_year_recoveries WHERE student_id = :stud_id ORDER BY paid_at DESC");
        $rPayStmt->execute(['stud_id' => $studentId]);
        foreach ($rPayStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $payments[] = [
                'item_name' => 'Previous Session Dues Recovery',
                'amount' => (float)$row['amount'],
                'paid_at' => $row['paid_at']
            ];
        }
        
        usort($payments, function ($a, $b) {
            return strcmp($b['paid_at'], $a['paid_at']);
        });
        
        return [
            'student' => $student,
            'attendance_summary' => [
                'present' => $present,
                'absent' => $absent,
                'leave' => $leave,
                'percentage' => $attPercentage,
                'history' => $history
            ],
            'fee_summary' => [
                'fees_paid' => $feesPaid,
                'fees_pending' => $feesPending,
                'outstanding_balance' => $outstandingBalance,
                'payment_history' => $payments
            ]
        ];
    }

    /**
     * Get Parent Students List
     */
    public function getParentStudents(int $parentId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $dash = $this->getMockParentDashboard(0, $parentId);
            return $dash['students'];
        }

        $stmt = $pdo->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :uid");
        $stmt->execute(['uid' => $parentId]);
        $studentIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($studentIds)) {
            return [];
        }
        
        $placeholders = implode(',', array_fill(0, count($studentIds), '?'));
        $stmt = $pdo->prepare("SELECT s.*, c.name as class_name FROM students s 
                               JOIN classrooms c ON s.class_id = c.id
                               WHERE s.id IN ($placeholders)");
        $stmt->execute($studentIds);
        $res = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($res as &$student) {
            $student['id'] = (int)$student['id'];
            $student['class_id'] = (int)$student['class_id'];
        }
        unset($student);

        return $res;
    }

    /**
     * Get Parent Student Dashboard Info
     */
    public function getParentStudentDashboard(int $schoolId, int $parentId, int $studentId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return $this->getMockParentStudentDashboard($schoolId, $studentId);
        }

        // Check permission
        $chk = $pdo->prepare("SELECT COUNT(*) FROM parent_student_mappings WHERE parent_user_id = :uid AND student_id = :sid");
        $chk->execute(['uid' => $parentId, 'sid' => $studentId]);
        if ($chk->fetchColumn() == 0) {
            throw new Exception('Access Denied', 403);
        }
        
        // Student Info
        $studStmt = $pdo->prepare("SELECT s.*, c.name as class_name FROM students s 
                                   JOIN classrooms c ON s.class_id = c.id 
                                   WHERE s.id = :sid");
        $studStmt->execute(['sid' => $studentId]);
        $student = $studStmt->fetch(PDO::FETCH_ASSOC);
        if ($student) {
            $student['id'] = (int)$student['id'];
            $student['class_id'] = (int)$student['class_id'];
        }
        
        // Attendance Stats
        $attStmt = $pdo->prepare("SELECT 
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
            SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
            SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
            COUNT(*) as total_days
            FROM student_attendance WHERE student_id = :sid");
        $attStmt->execute(['sid' => $studentId]);
        $attendanceStats = $attStmt->fetch(PDO::FETCH_ASSOC);
        
        // Recent 10 Attendance records
        $recentAttStmt = $pdo->prepare("SELECT attendance_date, status FROM student_attendance WHERE student_id = :sid ORDER BY attendance_date DESC LIMIT 10");
        $recentAttStmt->execute(['sid' => $studentId]);
        $recentAttendance = $recentAttStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fees
        $feeStmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :sid ORDER BY due_date ASC");
        $feeStmt->execute(['sid' => $studentId]);
        $fees = $feeStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fees as &$f) {
            $f['id'] = (int)$f['id'];
            $f['amount'] = (float)$f['amount'];
        }
        unset($f);
        
        // Extra Fees
        $extraStmt = $pdo->prepare("SELECT sef.*, eft.name as title, eft.amount 
                                    FROM student_extra_fees sef 
                                    JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id 
                                    WHERE sef.student_id = :sid");
        $extraStmt->execute(['sid' => $studentId]);
        $extraFees = $extraStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($extraFees as &$ef) {
            $ef['id'] = (int)$ef['id'];
            $ef['amount'] = (float)$ef['amount'];
        }
        unset($ef);
        
        // Class Fee Structure (Scheme)
        $classFeeStructure = null;
        if ($student) {
            $cfgStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND class_id = :class_id");
            $cfgStmt->execute(['school_id' => $schoolId, 'class_id' => $student['class_id']]);
            $cfgRow = $cfgStmt->fetch(PDO::FETCH_ASSOC);
            $classFeeStructure = $cfgRow ? json_decode($cfgRow['fee_structure'], true) : null;
        }
        
        // Carry forward
        $cfStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE student_id = :sid");
        $cfStmt->execute(['sid' => $studentId]);
        $carryForward = $cfStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($carryForward as &$cf) {
            $cf['id'] = (int)$cf['id'];
            $cf['amount'] = (float)$cf['amount'];
            $cf['paid_amount'] = (float)$cf['paid_amount'];
        }
        unset($cf);
        
        // Exam Marks
        $examMarks = [];
        if ($student) {
            $marksStmt = $pdo->prepare("SELECT m.*, e.name as exam_name, s.max_marks 
                FROM exam_marks m 
                JOIN exams e ON m.exam_id = e.id
                LEFT JOIN exam_subjects s ON e.id = s.exam_id AND m.subject_name = s.subject_name
                WHERE m.student_id = :sid AND e.status = 'Published'");
            $marksStmt->execute(['sid' => $studentId]);
            $examMarks = $marksStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($examMarks as &$m) {
                $m['id'] = (int)$m['id'];
                $m['marks_obtained'] = (float)$m['marks_obtained'];
                if (isset($m['max_marks'])) {
                    $m['max_marks'] = (float)$m['max_marks'];
                }
            }
            unset($m);
        }
        
        return [
            'student' => $student,
            'attendance_stats' => $attendanceStats,
            'recent_attendance' => $recentAttendance,
            'fees' => $fees,
            'extra_fees' => $extraFees,
            'class_fee_structure' => $classFeeStructure,
            'carry_forward' => $carryForward,
            'exam_marks' => $examMarks
        ];
    }

    // --- Sandbox Mocks Fallbacks ---

    private function getMockTeacherDashboard(int $schoolId, array $auth): array
    {
        $teacher = [
            'id' => 12,
            'school_id' => $schoolId,
            'name' => 'Aditi Sharma',
            'phone' => $auth['phone'] ?? '9876543211',
            'email' => 'aditi@yopmail.com',
            'salary_amount' => 45000.00,
            'gender' => 'Female',
            'status' => 'Active',
            'profile_image' => null
        ];

        $assignedClass = [
            'id' => 1,
            'name' => 'Class 10-A'
        ];

        $todayTimetable = [
            ['period' => 1, 'status' => 'Busy', 'subject' => 'Mathematics', 'class_name' => 'Class 10-A', 'class_id' => 1, 'backup' => false],
            ['period' => 2, 'status' => 'Free', 'subject' => '', 'class_name' => ''],
            ['period' => 3, 'status' => 'Busy', 'subject' => 'Physics', 'class_name' => 'Class 10-B', 'class_id' => 2, 'backup' => false],
            ['period' => 4, 'status' => 'Free', 'subject' => '', 'class_name' => ''],
            ['period' => 5, 'status' => 'Busy', 'subject' => 'Mathematics', 'class_name' => 'Class 9-A', 'class_id' => 3, 'backup' => true],
            ['period' => 6, 'status' => 'Free', 'subject' => '', 'class_name' => ''],
            ['period' => 7, 'status' => 'Free', 'subject' => '', 'class_name' => ''],
            ['period' => 8, 'status' => 'Free', 'subject' => '', 'class_name' => '']
        ];

        $upcomingTimetable = [
            [
                'date' => date('Y-m-d', strtotime('+1 day')),
                'day' => date('l', strtotime('+1 day')),
                'periods' => [
                    ['period' => 1, 'subject' => 'Mathematics', 'class_name' => 'Class 10-A', 'backup' => false],
                    ['period' => 3, 'subject' => 'Physics', 'class_name' => 'Class 10-B', 'backup' => false]
                ]
            ],
            [
                'date' => date('Y-m-d', strtotime('+2 days')),
                'day' => date('l', strtotime('+2 days')),
                'periods' => [
                    ['period' => 2, 'subject' => 'Mathematics', 'class_name' => 'Class 10-A', 'backup' => false]
                ]
            ]
        ];

        return [
            'teacher_profile' => $teacher,
            'assigned_class' => $assignedClass,
            'today_timetable' => $todayTimetable,
            'upcoming_timetable' => $upcomingTimetable,
            'finance_summary' => [
                'total_fees_collected' => 180000.00,
                'total_fees_outstanding' => 45000.00
            ]
        ];
    }

    private function getMockParentDashboard(int $schoolId, int $parentId): array
    {
        return [
            'students' => [
                [
                    'id' => 101,
                    'name' => 'Aarav Sharma',
                    'roll_number' => '101',
                    'class_name' => 'Class 10-A',
                    'class_id' => 1
                ],
                [
                    'id' => 102,
                    'name' => 'Riya Sharma',
                    'roll_number' => '102',
                    'class_name' => 'Class 7-B',
                    'class_id' => 4
                ]
            ]
        ];
    }

    private function getMockParentStudentSummary(int $schoolId, int $studentId): array
    {
        $name = ($studentId === 101) ? 'Aarav Sharma' : 'Riya Sharma';
        $class = ($studentId === 101) ? 'Class 10-A' : 'Class 7-B';
        $classId = ($studentId === 101) ? 1 : 4;

        $student = [
            'id' => $studentId,
            'name' => $name,
            'roll_number' => (string)$studentId,
            'class_name' => $class,
            'class_id' => $classId,
            'gender' => 'Male',
            'phone' => '9876543210',
            'emergency_contact' => '9876543210'
        ];

        $history = [
            ['attendance_date' => date('Y-m-d'), 'status' => 'Present', 'remarks' => null],
            ['attendance_date' => date('Y-m-d', strtotime('-1 day')), 'status' => 'Present', 'remarks' => null],
            ['attendance_date' => date('Y-m-d', strtotime('-2 days')), 'status' => 'Absent', 'remarks' => null],
            ['attendance_date' => date('Y-m-d', strtotime('-3 days')), 'status' => 'Present', 'remarks' => null],
            ['attendance_date' => date('Y-m-d', strtotime('-4 days')), 'status' => 'Present', 'remarks' => null]
        ];

        $payments = [
            ['item_name' => 'Tuition Fee - April', 'amount' => 1500.00, 'paid_at' => date('Y-04-10 10:30:00')],
            ['item_name' => 'Tuition Fee - May', 'amount' => 1500.00, 'paid_at' => date('Y-05-12 11:15:00')],
            ['item_name' => 'Tuition Fee - June', 'amount' => 1500.00, 'paid_at' => date('Y-06-08 09:20:00')],
            ['item_name' => 'Admission Fee', 'amount' => 5000.00, 'paid_at' => date('Y-04-05 14:00:00')]
        ];

        return [
            'student' => $student,
            'attendance_summary' => [
                'present' => 18,
                'absent' => 1,
                'leave' => 1,
                'percentage' => 90.0,
                'history' => $history
            ],
            'fee_summary' => [
                'fees_paid' => 9500.00,
                'fees_pending' => 3000.00,
                'outstanding_balance' => 3000.00,
                'payment_history' => $payments
            ]
        ];
    }

    private function getMockParentStudentDashboard(int $schoolId, int $studentId): array
    {
        $summary = $this->getMockParentStudentSummary($schoolId, $studentId);
        
        $attendanceStats = [
            'present_days' => 18,
            'absent_days' => 1,
            'leave_days' => 1,
            'total_days' => 20
        ];

        $fees = [
            ['id' => 1, 'month' => 'April', 'amount' => 1500.00, 'status' => 'Paid', 'due_date' => date('Y-04-15'), 'payment_date' => date('Y-04-10'), 'paid_at' => date('Y-04-10 10:30:00')],
            ['id' => 2, 'month' => 'May', 'amount' => 1500.00, 'status' => 'Paid', 'due_date' => date('Y-05-15'), 'payment_date' => date('Y-05-12'), 'paid_at' => date('Y-05-12 11:15:00')],
            ['id' => 3, 'month' => 'June', 'amount' => 1500.00, 'status' => 'Paid', 'due_date' => date('Y-06-15'), 'payment_date' => date('Y-06-08'), 'paid_at' => date('Y-06-08 09:20:00')],
            ['id' => 4, 'month' => 'July', 'amount' => 1500.00, 'status' => 'Pending', 'due_date' => date('Y-07-15'), 'payment_date' => null, 'paid_at' => null],
            ['id' => 5, 'month' => 'August', 'amount' => 1500.00, 'status' => 'Pending', 'due_date' => date('Y-08-15'), 'payment_date' => null, 'paid_at' => null]
        ];

        $extraFees = [
            ['id' => 10, 'title' => 'Admission Fee', 'amount' => 5000.00, 'status' => 'Paid', 'paid_at' => date('Y-04-05 14:00:00')],
            ['id' => 11, 'title' => 'Science Lab Fee', 'amount' => 1000.00, 'status' => 'Pending', 'paid_at' => null]
        ];

        $classFeeStructure = [
            'April' => 1500, 'May' => 1500, 'June' => 1500, 'July' => 1500, 'August' => 1500,
            'September' => 1500, 'October' => 1500, 'November' => 1500, 'December' => 1500,
            'January' => 1500, 'February' => 1500, 'March' => 1500
        ];

        $examMarks = [
            ['id' => 201, 'exam_name' => 'Midterm Exam', 'subject_name' => 'Mathematics', 'marks_obtained' => 85.00, 'max_marks' => 100.00, 'grade' => 'A'],
            ['id' => 202, 'exam_name' => 'Midterm Exam', 'subject_name' => 'Physics', 'marks_obtained' => 78.00, 'max_marks' => 100.00, 'grade' => 'B'],
            ['id' => 203, 'exam_name' => 'Midterm Exam', 'subject_name' => 'Chemistry', 'marks_obtained' => 92.00, 'max_marks' => 100.00, 'grade' => 'A+']
        ];

        return [
            'student' => $summary['student'],
            'attendance_stats' => $attendanceStats,
            'recent_attendance' => $summary['attendance_summary']['history'],
            'fees' => $fees,
            'extra_fees' => $extraFees,
            'class_fee_structure' => $classFeeStructure,
            'carry_forward' => [],
            'exam_marks' => $examMarks
        ];
    }
}
