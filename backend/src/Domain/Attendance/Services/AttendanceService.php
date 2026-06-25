<?php

namespace App\Domain\Attendance\Services;

use App\Shared\BaseService;
use PDO;

class AttendanceService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    /**
     * Get attendance for a class on a date.
     */
    public function getAttendance(int $schoolId, int $classId, string $date, int $ayId, ?string $groupName = null): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            // Offline/Sandbox Mock Mode
            $students = $this->getMockStudents($schoolId, $classId, $ayId, $groupName);
            $attendance = $this->getMockAttendanceRecords($schoolId, $classId, $date);
            
            $result = [];
            foreach ($students as $student) {
                $result[] = [
                    'id' => (int)$student['id'],
                    'name' => $student['name'],
                    'roll_number' => $student['roll_number'],
                    'group_name' => $student['group_name'] ?? 'all',
                    'status' => $attendance[(int)$student['id']] ?? null
                ];
            }
            return $result;
        }

        // Live Database Mode
        // Fetch all active students in the class/section
        $sql = "SELECT id, name, roll_number, group_name FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id AND status = 'Active'";
        $execParams = [
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ];
        
        if ($groupName !== null && $groupName !== 'all' && $groupName !== '') {
            $sql .= " AND group_name = :group_name";
            $execParams['group_name'] = $groupName;
        }
        
        $sql .= " ORDER BY CAST(roll_number AS UNSIGNED) ASC, name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        $students = $stmt->fetchAll();
        
        // Fetch marked attendance for these students on that date
        $attStmt = $pdo->prepare("SELECT student_id, status FROM student_attendance WHERE school_id = :school_id AND class_id = :class_id AND attendance_date = :attendance_date");
        $attStmt->execute([
            'school_id' => $schoolId,
            'class_id' => $classId,
            'attendance_date' => $date
        ]);
        $attendanceRows = $attStmt->fetchAll();
        $attendanceMap = [];
        foreach ($attendanceRows as $row) {
            $attendanceMap[(int)$row['student_id']] = $row['status'];
        }
        
        // Merge
        $result = [];
        foreach ($students as $student) {
            $result[] = [
                'id' => (int)$student['id'],
                'name' => $student['name'],
                'roll_number' => $student['roll_number'],
                'group_name' => $student['group_name'],
                'status' => $attendanceMap[(int)$student['id']] ?? null
            ];
        }
        
        return $result;
    }

    /**
     * Save bulk attendance for a class.
     */
    public function saveBulkAttendance(int $schoolId, int $ayId, int $classId, string $date, array $studentsList, string $performedBy): array
    {
        $todayStr = date('Y-m-d');
        if ($date > $todayStr) {
            throw new \InvalidArgumentException('Future attendance is not allowed.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            // Sandbox/Offline mode
            $attendance = $this->getMockAttendanceRecordsAll();
            foreach ($studentsList as $item) {
                $studentId = (int)$item['student_id'];
                $status = $item['status'];
                if (in_array($status, ['Present', 'Absent', 'Leave'])) {
                    $key = "{$schoolId}_{$classId}_{$studentId}_{$date}";
                    $attendance[$key] = $status;
                }
            }
            $this->saveMockAttendanceRecords($attendance);
            return ['success' => true];
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO student_attendance (school_id, academic_year_id, class_id, student_id, attendance_date, status) 
                                   VALUES (:school_id, :ay_id, :class_id, :student_id, :attendance_date, :status)
                                   ON DUPLICATE KEY UPDATE status = VALUES(status)");
                                   
            foreach ($studentsList as $item) {
                $studentId = (int)$item['student_id'];
                $status = $item['status']; // Present, Absent, Leave
                if (in_array($status, ['Present', 'Absent', 'Leave'])) {
                    $stmt->execute([
                        'school_id' => $schoolId,
                        'ay_id' => $ayId,
                        'class_id' => $classId,
                        'student_id' => $studentId,
                        'attendance_date' => $date,
                        'status' => $status
                    ]);
                }
            }
            $pdo->commit();

            // Process Consecutive Absence Alerts
            try {
                foreach ($studentsList as $item) {
                    $studentId = (int)$item['student_id'];
                    $status = $item['status'];
                    
                    if ($status === 'Absent' || $status === 'Leave') {
                        // Fetch marked history DESC
                        $streakStmt = $pdo->prepare("SELECT status FROM student_attendance 
                                                     WHERE student_id = :sid AND academic_year_id = :ayid 
                                                     ORDER BY attendance_date DESC");
                        $streakStmt->execute(['sid' => $studentId, 'ayid' => $ayId]);
                        $history = $streakStmt->fetchAll();
                        
                        $streak = 0;
                        $hasLeave = false;
                        foreach ($history as $h) {
                            if ($h['status'] === 'Absent' || $h['status'] === 'Leave') {
                                $streak++;
                                if ($h['status'] === 'Leave') {
                                    $hasLeave = true;
                                }
                            } else {
                                break;
                            }
                        }
                        
                        if ($streak >= 2) {
                            $sStmt = $pdo->prepare("SELECT s.name as sname, c.name as cname FROM students s 
                                                    JOIN classrooms c ON s.class_id = c.id 
                                                    WHERE s.id = :sid LIMIT 1");
                            $sStmt->execute(['sid' => $studentId]);
                            $sInfo = $sStmt->fetch();
                            
                            $studentName = $sInfo['sname'] ?? 'Student';
                            $className = $sInfo['cname'] ?? 'Class';
                            
                            if ($hasLeave) {
                                $adminMsg = "Student $studentName ($className) has not attended school for $streak consecutive days.";
                                $parentMsg = "$studentName has not attended school for $streak consecutive days.";
                            } else {
                                $adminMsg = "Student $studentName ($className) has been absent for $streak consecutive days.";
                                $parentMsg = "$studentName has been absent for $streak consecutive days.";
                            }
                            
                            $title = "Consecutive Absence Alert";
                            
                            // Prevent duplicate alert logging for same student/streak count/date
                            $chkAlert = $pdo->prepare("SELECT COUNT(*) FROM notifications 
                                                       WHERE school_id = :sid 
                                                         AND target_class_id = :cid 
                                                         AND title = :title 
                                                         AND content = :content 
                                                         AND DATE(created_at) = CURRENT_DATE()");
                            $chkAlert->execute([
                                'sid' => $schoolId,
                                'cid' => $classId,
                                'title' => $title,
                                'content' => $adminMsg
                            ]);
                            
                            if ($chkAlert->fetchColumn() == 0) {
                                // Class notification
                                $insAdmin = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, target_class_id) 
                                                           VALUES (:sid, :title, :content, 'Absence Alert', NOW(), 0, :cid)");
                                $insAdmin->execute([
                                    'sid' => $schoolId,
                                    'title' => $title,
                                    'content' => $adminMsg,
                                    'cid' => $classId
                                ]);
                                
                                // Parent notifications
                                $pStmt = $pdo->prepare("SELECT parent_user_id FROM parent_student_mappings WHERE student_id = :sid");
                                $pStmt->execute(['sid' => $studentId]);
                                $pids = $pStmt->fetchAll(PDO::FETCH_COLUMN);
                                
                                foreach ($pids as $puid) {
                                    $insParent = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, target_user_id) 
                                                               VALUES (:sid, :title, :content, 'Absence Alert', NOW(), 0, :puid)");
                                    $insParent->execute([
                                        'sid' => $schoolId,
                                        'title' => $title,
                                        'content' => $parentMsg,
                                        'puid' => $puid
                                    ]);
                                }
                            }
                        }
                    }
                }
            } catch (\Exception $streakEx) {
                error_log("Failed consecutive absence monitoring: " . $streakEx->getMessage());
            }

            $this->logAudit($pdo, $schoolId, $performedBy, 'Mark Attendance', "Saved attendance for class ID $classId on date $date.");

            return ['success' => true];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Get attendance analytics for a single student.
     */
    public function getStudentAttendanceAnalytics(int $schoolId, int $studentId, int $ayId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            // Mock sandbox response
            return [
                'present' => 18,
                'absent' => 1,
                'leave' => 1,
                'total' => 20,
                'percentage' => 90.0
            ];
        }

        $stmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM student_attendance 
                               WHERE school_id = :school_id AND student_id = :student_id AND academic_year_id = :ay_id 
                               GROUP BY status");
        $stmt->execute([
            'school_id' => $schoolId,
            'student_id' => $studentId,
            'ay_id' => $ayId
        ]);
        $rows = $stmt->fetchAll();
        
        $counts = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
        $total = 0;
        foreach ($rows as $row) {
            $counts[$row['status']] = (int)$row['count'];
            $total += (int)$row['count'];
        }
        
        $percentage = 0;
        if ($total > 0) {
            $percentage = round(($counts['Present'] / $total) * 100, 1);
        }
        
        return [
            'present' => $counts['Present'],
            'absent' => $counts['Absent'],
            'leave' => $counts['Leave'],
            'total' => $total,
            'percentage' => $percentage
        ];
    }

    /**
     * Get monthly attendance report for all students in a class.
     */
    public function getMonthlyAttendanceReport(int $schoolId, int $classId, int $ayId, ?string $groupName, string $month): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            // Mock report
            return [
                'study_days' => 22,
                'sundays_count' => 4,
                'holidays_count' => 2,
                'report' => []
            ];
        }

        // Fetch all active students
        $sql = "SELECT id, name, roll_number, group_name FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id AND status = 'Active'";
        $execParams = [
            'school_id' => $schoolId,
            'ay_id' => $ayId,
            'class_id' => $classId
        ];
        if ($groupName !== null && $groupName !== 'all' && $groupName !== '') {
            $sql .= " AND group_name = :group_name";
            $execParams['group_name'] = $groupName;
        }
        $sql .= " ORDER BY CAST(roll_number AS UNSIGNED) ASC, name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execParams);
        $students = $stmt->fetchAll();
        
        $monthStart = $month . '-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        
        // Fetch leaves for the month
        $leaveStmt = $pdo->prepare("SELECT leave_date FROM school_leaves WHERE school_id = :sid AND academic_year_id = :ay_id AND leave_date BETWEEN :start AND :end");
        $leaveStmt->execute([
            'sid' => $schoolId,
            'ay_id' => $ayId,
            'start' => $monthStart,
            'end' => $monthEnd
        ]);
        $dbLeaveDates = $leaveStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        
        // Fetch active academic year details to generate system holidays
        $yearStmt = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :id AND school_id = :sid");
        $yearStmt->execute(['id' => $ayId, 'sid' => $schoolId]);
        $activeYear = $yearStmt->fetch();
        
        $systemHolidays = [];
        if ($activeYear) {
            $systemHolidays = $this->getSystemHolidays($activeYear['start_date'], $activeYear['end_date'], $ayId);
        }
        
        // Merge system holiday dates
        $leaveDates = $dbLeaveDates;
        foreach ($systemHolidays as $sh) {
            if ($sh['leave_date'] >= $monthStart && $sh['leave_date'] <= $monthEnd) {
                if (!in_array($sh['leave_date'], $leaveDates)) {
                    $leaveDates[] = $sh['leave_date'];
                }
            }
        }
        
        // Calculate Study Days (working days)
        $studyDays = 0;
        $sundaysCount = 0;
        $holidaysCount = 0;
        $workingDatesMap = [];
        $startDateTs = strtotime($monthStart);
        $endDateTs = strtotime($monthEnd);
        for ($ts = $startDateTs; $ts <= $endDateTs; $ts = strtotime('+1 day', $ts)) {
            $curDate = date('Y-m-d', $ts);
            $w = date('w', $ts); // 0 = Sunday
            if ($w === '0') {
                $sundaysCount++;
                continue; // Exclude Sundays
            }
            if (in_array($curDate, $leaveDates)) {
                $holidaysCount++;
                continue; // Exclude Leaves
            }
            $studyDays++;
            $workingDatesMap[$curDate] = true;
        }
        
        // Fetch marked attendance for these students on working days in the month
        $attStmt = $pdo->prepare("SELECT student_id, attendance_date, status 
                                  FROM student_attendance 
                                  WHERE school_id = :school_id AND class_id = :class_id AND attendance_date BETWEEN :start AND :end");
        $attStmt->execute([
            'school_id' => $schoolId,
            'class_id' => $classId,
            'start' => $monthStart,
            'end' => $monthEnd
        ]);
        $attRows = $attStmt->fetchAll();
        
        $studentMap = [];
        foreach ($attRows as $row) {
            $dateStr = $row['attendance_date'];
            if (!isset($workingDatesMap[$dateStr])) {
                continue; // Exclude weekend or holiday markings from report aggregation
            }
            $sid = (int)$row['student_id'];
            if (!isset($studentMap[$sid])) {
                $studentMap[$sid] = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
            }
            $studentMap[$sid][$row['status']] = ($studentMap[$sid][$row['status']] ?? 0) + 1;
        }
        
        $result = [];
        foreach ($students as $student) {
            $sid = (int)$student['id'];
            $counts = $studentMap[$sid] ?? ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
            $pct = $studyDays > 0 ? round(($counts['Present'] / $studyDays) * 100, 2) : 0;
            
            $result[] = [
                'id' => $sid,
                'name' => $student['name'],
                'roll_number' => $student['roll_number'],
                'group_name' => $student['group_name'],
                'present' => $counts['Present'],
                'absent' => $counts['Absent'],
                'leave' => $counts['Leave'],
                'percentage' => $pct
            ];
        }
        
        return [
            'study_days' => $studyDays,
            'sundays_count' => $sundaysCount,
            'holidays_count' => $holidaysCount,
            'report' => $result
        ];
    }

    // --- Mock Fallback Helpers ---

    private function getMockStudents(int $schoolId, int $classId, int $ayId, ?string $groupName): array
    {
        $file = __DIR__ . '/../../../../mock_users.json';
        if (!file_exists($file)) return [];
        $users = json_decode(file_get_contents($file), true) ?: [];
        // Filter student roles
        $students = [];
        foreach ($users as $u) {
            if ($u['role'] === 'Student' && (int)$u['school_id'] === $schoolId && (int)($u['class_id'] ?? 0) === $classId) {
                if ($groupName === null || $groupName === 'all' || $groupName === '' || ($u['group_name'] ?? '') === $groupName) {
                    $students[] = [
                        'id' => $u['id'],
                        'name' => $u['name'],
                        'roll_number' => $u['roll_number'] ?? '0',
                        'group_name' => $u['group_name'] ?? 'all'
                    ];
                }
            }
        }
        return $students;
    }

    private function getMockAttendanceRecords(int $schoolId, int $classId, string $date): array
    {
        $records = $this->getMockAttendanceRecordsAll();
        $res = [];
        foreach ($records as $key => $status) {
            // key format: schoolId_classId_studentId_date
            $parts = explode('_', $key);
            if (count($parts) === 4) {
                if ((int)$parts[0] === $schoolId && (int)$parts[1] === $classId && $parts[3] === $date) {
                    $res[(int)$parts[2]] = $status;
                }
            }
        }
        return $res;
    }

    private function getMockAttendanceRecordsAll(): array
    {
        $file = __DIR__ . '/../../../../mock_attendance.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockAttendanceRecords(array $records): void
    {
        $file = __DIR__ . '/../../../../mock_attendance.json';
        file_put_contents($file, json_encode($records, JSON_PRETTY_PRINT));
    }

    private function getSystemHolidays(string $start, string $end, int $ayId): array
    {
        // Simple mock system holidays generator
        $holidays = [];
        $startDateTs = strtotime($start);
        $endDateTs = strtotime($end);
        
        // Let's add some national holidays
        $years = [date('Y', $startDateTs), date('Y', $endDateTs)];
        $years = array_unique($years);
        
        foreach ($years as $yr) {
            $holidays[] = ['leave_date' => "$yr-01-26", 'description' => 'Republic Day'];
            $holidays[] = ['leave_date' => "$yr-08-15", 'description' => 'Independence Day'];
            $holidays[] = ['leave_date' => "$yr-10-02", 'description' => 'Gandhi Jayanti'];
            $holidays[] = ['leave_date' => "$yr-12-25", 'description' => 'Christmas'];
        }
        return $holidays;
    }

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
