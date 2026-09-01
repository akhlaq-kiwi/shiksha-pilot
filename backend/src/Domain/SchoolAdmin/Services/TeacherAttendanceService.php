<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use PDO;
use Exception;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Exceptions\NotFoundException;

class TeacherAttendanceService
{
    public function __construct(
        private readonly PDO $pdo
    ) {
        $this->ensureTablesExist();
    }

    private function ensureTablesExist(): void
    {
        try {
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS `teacher_attendance` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `school_id` INT NOT NULL,
                  `academic_year_id` INT NOT NULL,
                  `staff_id` INT NOT NULL,
                  `user_id` INT NULL,
                  `date` DATE NOT NULL,
                  `status` ENUM('Present', 'Absent', 'Leave') NOT NULL DEFAULT 'Present',
                  `entry_time` VARCHAR(20) NULL,
                  `is_late` TINYINT(1) NOT NULL DEFAULT 0,
                  `reach_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  UNIQUE KEY `unique_teacher_daily_att` (`staff_id`, `academic_year_id`, `date`),
                  KEY `idx_ta_school_date` (`school_id`, `date`),
                  KEY `idx_ta_ay_date` (`academic_year_id`, `date`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $this->pdo->exec("
                CREATE TABLE IF NOT EXISTS `teacher_attendance_settings` (
                  `id` INT AUTO_INCREMENT PRIMARY KEY,
                  `school_id` INT NOT NULL,
                  `academic_year_id` INT NOT NULL,
                  `entry_time` VARCHAR(20) NOT NULL DEFAULT '08:30 AM',
                  `allowed_leaves` INT NULL DEFAULT NULL,
                  `qr_payload` TEXT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  UNIQUE KEY `unique_school_ay_teacher_settings` (`school_id`, `academic_year_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            $this->pdo->exec("ALTER TABLE `teacher_attendance_settings` ADD COLUMN `qr_payload` TEXT NULL");
        } catch (\Throwable $e) {
            // Ignore if column already exists or table setup complete
        }
    }

    private function getSchoolId(array $user): int
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        if ($schoolId <= 0) {
            throw new ValidationException(['school_id' => 'Invalid school ID.']);
        }
        return $schoolId;
    }

    private function getWorkingAcademicYear(int $schoolId): array
    {
        $today = date('Y-m-d');
        // 1. Try finding academic year containing current date
        $stmt = $this->pdo->prepare("
            SELECT id, name, start_date, end_date, is_current 
            FROM academic_years 
            WHERE school_id = :sid AND start_date <= :t1 AND end_date >= :t2
            LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId, ':t1' => $today, ':t2' => $today]);
        $ay = $stmt->fetch(PDO::FETCH_ASSOC);

        // 2. Fallback to active/current academic year if today is outside configured date bounds
        if (!$ay) {
            $stmt = $this->pdo->prepare("
                SELECT id, name, start_date, end_date, is_current 
                FROM academic_years 
                WHERE school_id = :sid AND (status = 'ACTIVE' OR is_current = 1) 
                ORDER BY is_current DESC, id DESC 
                LIMIT 1
            ");
            $stmt->execute([':sid' => $schoolId]);
            $ay = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$ay) {
            throw new ValidationException(['academic_year' => 'No active academic year found for this school.']);
        }
        return $ay;
    }

    public function getSettings(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $stmt = $this->pdo->prepare("
            SELECT entry_time, allowed_leaves, qr_payload 
            FROM teacher_attendance_settings 
            WHERE school_id = :sid AND academic_year_id = :ayid 
            LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId, ':ayid' => $ay['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            'school_id' => $schoolId,
            'academic_year_id' => (int)$ay['id'],
            'academic_year_name' => $ay['name'],
            'entry_time' => $row['entry_time'] ?? '08:30 AM',
            'allowed_leaves' => (isset($row['allowed_leaves']) && $row['allowed_leaves'] !== null) ? (int)$row['allowed_leaves'] : 0,
            'qr_payload' => $row['qr_payload'] ?? null,
        ];
    }

    public function saveSettings(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $entryTime = !empty($data['entry_time']) ? trim((string)$data['entry_time']) : '08:30 AM';
        $allowedLeaves = (isset($data['allowed_leaves']) && $data['allowed_leaves'] !== '' && $data['allowed_leaves'] !== null) 
            ? (int)$data['allowed_leaves'] 
            : null;

        $stmt = $this->pdo->prepare("
            INSERT INTO teacher_attendance_settings (school_id, academic_year_id, entry_time, allowed_leaves)
            VALUES (:sid, :ayid, :etime, :aleaves)
            ON DUPLICATE KEY UPDATE entry_time = VALUES(entry_time), allowed_leaves = VALUES(allowed_leaves)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':ayid' => $ay['id'],
            ':etime' => $entryTime,
            ':aleaves' => $allowedLeaves
        ]);

        return $this->getSettings($user);
    }

    public function getDailyAttendance(array $user, string $date): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);
        $settings = $this->getSettings($user);

        if (empty($date)) {
            $date = date('Y-m-d');
        }

        // Sunday & Holiday check for Admin Web Portal
        $dayOfWeek = date('N', strtotime($date));
        $isSunday = ($dayOfWeek == 7);

        $stmtHol = $this->pdo->prepare("SELECT name FROM holidays WHERE school_id = :sid AND date = :date LIMIT 1");
        $stmtHol->execute([':sid' => $schoolId, ':date' => $date]);
        $holidayRow = $stmtHol->fetch(PDO::FETCH_ASSOC);
        $isHoliday = !empty($holidayRow);

        $isDisabled = false;
        $disabledReason = null;
        if ($isSunday) {
            $isDisabled = true;
            $disabledReason = "Attendance cannot be marked on Sundays (School Closed).";
        } elseif ($isHoliday) {
            $isDisabled = true;
            $disabledReason = "Attendance cannot be marked on declared School Holiday ({$holidayRow['name']}).";
        }

        // Fetch all active staff / teachers whose joining_date is on or before the selected date
        $stmtStaff = $this->pdo->prepare("
            SELECT id, name, phone, email, role, department, photo_path, joining_date
            FROM staff
            WHERE school_id = :sid AND status = 'ACTIVE' AND (joining_date IS NULL OR joining_date <= :date)
            ORDER BY name ASC
        ");
        $stmtStaff->execute([':sid' => $schoolId, ':date' => $date]);
        $staffList = $stmtStaff->fetchAll(PDO::FETCH_ASSOC);

        // Fetch saved attendance for this date & academic year
        $stmtAtt = $this->pdo->prepare("
            SELECT staff_id, status, entry_time, is_late, reach_time
            FROM teacher_attendance
            WHERE school_id = :sid AND academic_year_id = :ayid AND date = :date
        ");
        $stmtAtt->execute([':sid' => $schoolId, ':ayid' => $ay['id'], ':date' => $date]);
        $attRows = $stmtAtt->fetchAll(PDO::FETCH_ASSOC);

        $attMap = [];
        foreach ($attRows as $r) {
            $attMap[(int)$r['staff_id']] = $r;
        }

        $configuredTime = $settings['entry_time'] ?? '08:30 AM';
        $configuredMinutes = $this->parseTimeToMinutes($configuredTime);

        $records = [];
        foreach ($staffList as $st) {
            $stId = (int)$st['id'];
            $empId = "EMP-" . str_pad((string)$stId, 3, '0', STR_PAD_LEFT);
            $att = $attMap[$stId] ?? null;

            $status = $att ? $att['status'] : ($isDisabled ? ($isSunday ? 'Sunday' : 'Holiday') : 'Absent');
            // If marked Present by Admin (reach_time is NULL), use current configured entry time
            $isSelfCheckin = $att && !empty($att['reach_time']);
            $entryTime = ($status === 'Present') 
                ? ($isSelfCheckin ? ($att['entry_time'] ?? $configuredTime) : $configuredTime)
                : ($att ? ($att['entry_time'] ?? '—') : '—');

            $recLate = false;
            $recLateText = null;
            $recEarly = false;
            $recEarlyText = null;
            $frequencyText = '—';

            if ($status === 'Present' && $entryTime !== '—') {
                if (!$isSelfCheckin) {
                    $frequencyText = 'On Time';
                } else {
                    $entryMinutes = $this->parseTimeToMinutes($entryTime);
                    if ($entryMinutes > $configuredMinutes) {
                        $recLate = true;
                        $diff = $entryMinutes - $configuredMinutes;
                        $recLateText = $this->formatMinutesText($diff) . ' Late';
                        $frequencyText = $recLateText;
                    } elseif ($entryMinutes < $configuredMinutes) {
                        $recEarly = true;
                        $diff = $configuredMinutes - $entryMinutes;
                        $recEarlyText = $this->formatMinutesText($diff) . ' Early';
                        $frequencyText = $recEarlyText;
                    } else {
                        $frequencyText = 'On Time';
                    }
                }
            }

            $records[] = [
                'staff_id' => $stId,
                'emp_id' => $empId,
                'name' => $st['name'],
                'role' => $st['role'],
                'department' => $st['department'] ?? '',
                'designation' => $st['role'] ?? ($st['department'] ?? 'Teacher'),
                'phone' => $st['phone'] ?? '',
                'photo_path' => $st['photo_path'] ?? '',
                'status' => $status,
                'entry_time' => $entryTime,
                'is_late' => $recLate,
                'late_text' => $recLateText,
                'is_early' => $recEarly,
                'early_text' => $recEarlyText,
                'frequency_text' => $frequencyText,
                'reach_time' => $att ? $att['reach_time'] : null
            ];
        }

        return [
            'date' => $date,
            'school_id' => $schoolId,
            'academic_year_id' => (int)$ay['id'],
            'configured_entry_time' => $settings['entry_time'],
            'allowed_leaves' => $settings['allowed_leaves'],
            'is_disabled' => $isDisabled,
            'disabled_reason' => $disabledReason,
            'is_sunday' => $isSunday,
            'is_holiday' => $isHoliday,
            'holiday_name' => $holidayRow['name'] ?? null,
            'total_teachers' => count($records),
            'present_count' => count(array_filter($records, fn($r) => $r['status'] === 'Present')),
            'absent_count' => count(array_filter($records, fn($r) => $r['status'] === 'Absent')),
            'leave_count' => count(array_filter($records, fn($r) => $r['status'] === 'Leave')),
            'late_count' => count(array_filter($records, fn($r) => $r['is_late'])),
            'records' => $records
        ];
    }

    public function markTeacherAttendanceByAdmin(array $user, array $data): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $date = !empty($data['date']) ? trim($data['date']) : date('Y-m-d');
        $records = $data['records'] ?? [];

        // Sunday & Holiday validation check
        $dayOfWeek = date('N', strtotime($date));
        $isSunday = ($dayOfWeek == 7);

        $stmtHol = $this->pdo->prepare("SELECT name FROM holidays WHERE school_id = :sid AND date = :date LIMIT 1");
        $stmtHol->execute([':sid' => $schoolId, ':date' => $date]);
        $holidayRow = $stmtHol->fetch(PDO::FETCH_ASSOC);

        if ($isSunday) {
            throw new ValidationException(['date' => 'Attendance cannot be marked on Sundays (School Closed).']);
        }
        if (!empty($holidayRow)) {
            throw new ValidationException(['date' => "Attendance cannot be marked on declared School Holiday ({$holidayRow['name']})."]);
        }

        if (empty($records) || !is_array($records)) {
            throw new ValidationException(['records' => 'No attendance records provided.']);
        }

        $settings = $this->getSettings($user);
        $configuredMinutes = $this->parseTimeToMinutes($settings['entry_time']);

        $this->pdo->beginTransaction();
        try {
            $stmtUpsert = $this->pdo->prepare("
                INSERT INTO teacher_attendance (school_id, academic_year_id, staff_id, date, status, entry_time, is_late, reach_time)
                VALUES (:sid, :ayid, :staff_id, :date, :status, :etime, :is_late, NOW())
                ON DUPLICATE KEY UPDATE 
                    status = VALUES(status), 
                    entry_time = VALUES(entry_time), 
                    is_late = VALUES(is_late),
                    updated_at = NOW()
            ");

            $stmtCheckStaff = $this->pdo->prepare("SELECT joining_date FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");

            foreach ($records as $r) {
                $staffId = (int)($r['staff_id'] ?? 0);
                if ($staffId <= 0) continue;

                // Validate joining_date
                $stmtCheckStaff->execute([':id' => $staffId, ':sid' => $schoolId]);
                $staffRow = $stmtCheckStaff->fetch(PDO::FETCH_ASSOC);
                if ($staffRow && !empty($staffRow['joining_date']) && $date < $staffRow['joining_date']) {
                    continue; // Skip marking attendance for dates before staff joined
                }

                $status = in_array($r['status'] ?? '', ['Present', 'Absent', 'Leave']) ? $r['status'] : 'Present';
                if ($status === 'Present') {
                    // Admin marked attendance default: always use current configured official entry time so it is On Time
                    $entryTime = $settings['entry_time'];
                    $isLate = 0;
                } else {
                    $entryTime = null;
                    $isLate = 0;
                }

                $stmtUpsert->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $ay['id'],
                    ':staff_id' => $staffId,
                    ':date' => $date,
                    ':status' => $status,
                    ':etime' => $entryTime,
                    ':is_late' => $isLate
                ]);
            }

            $this->pdo->commit();
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->getDailyAttendance($user, $date);
    }

    public function getMonthlyReport(array $user, int $month, int $year = 0): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $ayStartYear = !empty($ay['start_date']) ? (int)date('Y', strtotime($ay['start_date'])) : (int)date('Y');
        if ($year <= 0) {
            $year = ($month >= 4) ? $ayStartYear : ($ayStartYear + 1);
        }
        if ($month < 1 || $month > 12) {
            $month = (int)date('n');
        }

        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $daysInMonth = (int)date('t', strtotime($startDate));
        $endDate = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

        // Fetch all active staff (including joining_date)
        $stmtStaff = $this->pdo->prepare("
            SELECT id, name, phone, role, department, joining_date
            FROM staff
            WHERE school_id = :sid AND status = 'ACTIVE' AND (joining_date IS NULL OR joining_date <= :edate)
            ORDER BY name ASC
        ");
        $stmtStaff->execute([':sid' => $schoolId, ':edate' => $endDate]);
        $staffList = $stmtStaff->fetchAll(PDO::FETCH_ASSOC);

        // Fetch all attendance for this month
        $stmtAtt = $this->pdo->prepare("
            SELECT staff_id, status, is_late, date
            FROM teacher_attendance
            WHERE school_id = :sid AND academic_year_id = :ayid AND date >= :sdate AND date <= :edate
        ");
        $stmtAtt->execute([
            ':sid' => $schoolId,
            ':ayid' => $ay['id'],
            ':sdate' => $startDate,
            ':edate' => $endDate
        ]);
        $allAtt = $stmtAtt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch all holidays for this month
        $stmtHol = $this->pdo->prepare("
            SELECT date FROM holidays 
            WHERE school_id = :sid AND date >= :sdate AND date <= :edate
        ");
        $stmtHol->execute([':sid' => $schoolId, ':sdate' => $startDate, ':edate' => $endDate]);
        $holidayDates = array_flip($stmtHol->fetchAll(PDO::FETCH_COLUMN));

        $todayStr = date('Y-m-d');

        $staffAttMap = [];
        foreach ($allAtt as $att) {
            $stId = (int)$att['staff_id'];
            $staffAttMap[$stId][$att['date']] = $att;
        }

        $report = [];
        foreach ($staffList as $st) {
            $stId = (int)$st['id'];
            $empId = "EMP-" . str_pad((string)$stId, 3, '0', STR_PAD_LEFT);

            $present = 0;
            $absent = 0;
            $leave = 0;
            $late = 0;
            $workingDaysCount = 0;

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dtStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
                
                // Skip dates before staff joining date
                if (!empty($st['joining_date']) && $dtStr < $st['joining_date']) {
                    continue;
                }

                $dayOfWeek = date('N', strtotime($dtStr));
                $isSunday = ($dayOfWeek == 7);
                $isHoliday = isset($holidayDates[$dtStr]);

                if ($isSunday || $isHoliday) {
                    continue;
                }

                $workingDaysCount++;

                $attRow = $staffAttMap[$stId][$dtStr] ?? null;
                if ($attRow) {
                    if ($attRow['status'] === 'Present') {
                        $present++;
                        if ($attRow['is_late']) {
                            $late++;
                        }
                    } elseif ($attRow['status'] === 'Leave') {
                        $leave++;
                    } else {
                        $absent++;
                    }
                } else {
                    // Past unmarked working day -> count as Absent
                    if ($dtStr <= $todayStr) {
                        $absent++;
                    }
                }
            }

            $totalWorkingDays = $workingDaysCount;
            $attPercentage = $totalWorkingDays > 0 ? round(($present / $totalWorkingDays) * 100, 1) : 0.0;

            $report[] = [
                'staff_id' => $stId,
                'emp_id' => $empId,
                'name' => $st['name'],
                'role' => $st['role'],
                'department' => $st['department'] ?? '',
                'total_working_days' => $totalWorkingDays,
                'present_days' => $present,
                'absent_days' => $absent,
                'leave_days' => $leave,
                'late_days' => $late,
                'attendance_percentage' => $attPercentage
            ];
        }

        return [
            'month' => $month,
            'year' => $year,
            'academic_year_id' => (int)$ay['id'],
            'records' => $report,
            'teachers' => $report
        ];
    }

    public function getQrToken(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $stmtSchool = $this->pdo->prepare("SELECT name FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC);
        $schoolName = $school['name'] ?? 'School Hub';

        $settings = $this->getSettings($user);
        $qrPayload = $settings['qr_payload'] ?? null;

        if (empty($qrPayload)) {
            return $this->refreshQrToken($user);
        }

        return [
            'school_id' => $schoolId,
            'school_name' => $schoolName,
            'qr_payload' => $qrPayload
        ];
    }

    public function refreshQrToken(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $ay = $this->getWorkingAcademicYear($schoolId);

        $stmtSchool = $this->pdo->prepare("SELECT name FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC);
        $schoolName = $school['name'] ?? 'School Hub';

        $timestamp = time();
        $secretKey = "TEACHER_ATTENDANCE_SECRET_" . $schoolId . "_" . bin2hex(random_bytes(4));
        $hash = hash_hmac('sha256', "{$schoolId}:{$ay['id']}:{$timestamp}", $secretKey);

        $qrData = json_encode([
            'type' => 'TEACHER_ATTENDANCE_QR',
            'school_id' => $schoolId,
            'academic_year_id' => (int)$ay['id'],
            'timestamp' => $timestamp,
            'token_id' => bin2hex(random_bytes(8)),
            'hash' => $hash
        ]);

        $stmtUpsert = $this->pdo->prepare("
            INSERT INTO teacher_attendance_settings (school_id, academic_year_id, entry_time, allowed_leaves, qr_payload, updated_at)
            VALUES (:sid, :ayid, '08:30 AM', 0, :qr_payload, NOW())
            ON DUPLICATE KEY UPDATE 
                qr_payload = VALUES(qr_payload),
                updated_at = NOW()
        ");
        $stmtUpsert->execute([':sid' => $schoolId, ':ayid' => (int)$ay['id'], ':qr_payload' => $qrData]);

        return [
            'school_id' => $schoolId,
            'school_name' => $schoolName,
            'qr_payload' => $qrData
        ];
    }

    public function scanTeacherQr(array $user, string $qrPayload): array
    {
        $schoolId = $this->getSchoolId($user);
        $userPhone = $user['phone'] ?? '';
        $userId = (int)($user['id'] ?? 0);

        if (empty($qrPayload)) {
            throw new ValidationException(['qr' => 'Invalid QR code payload.']);
        }

        $payload = json_decode($qrPayload, true);
        if (!$payload || ($payload['type'] ?? '') !== 'TEACHER_ATTENDANCE_QR') {
            throw new ValidationException(['qr' => 'Invalid or unrecognized Teacher Attendance QR Code.']);
        }

        $payloadSchoolId = (int)($payload['school_id'] ?? 0);
        if ($payloadSchoolId !== $schoolId) {
            throw new ValidationException(['qr' => 'This QR Code belongs to a different school.']);
        }

        // QR Code Expiry Validation: Compare scanned QR token_id with current active QR token_id saved in settings
        $settings = $this->getSettings($user);
        $activeQrPayloadRaw = $settings['qr_payload'] ?? null;

        if (!empty($activeQrPayloadRaw)) {
            $activePayload = json_decode($activeQrPayloadRaw, true);
            $scannedTokenId = $payload['token_id'] ?? ($payload['hash'] ?? null);
            $activeTokenId = $activePayload['token_id'] ?? ($activePayload['hash'] ?? null);

            if ($scannedTokenId && $activeTokenId && $scannedTokenId !== $activeTokenId) {
                throw new ValidationException(['qr_payload' => 'This QR code has expired']);
            }
        }

        // Server-side Teacher Identity Validation: Find matching staff record for logged-in user
        $stmtStaff = $this->pdo->prepare("
            SELECT id, school_id, name, phone, role, status 
            FROM staff 
            WHERE school_id = :sid 
              AND (phone = :phone OR phone = :clean_phone)
              AND status = 'ACTIVE'
            LIMIT 1
        ");
        $cleanPhone = preg_replace('/[^0-9]/', '', $userPhone);
        $stmtStaff->execute([
            ':sid' => $schoolId,
            ':phone' => $userPhone,
            ':clean_phone' => $cleanPhone
        ]);
        $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);

        if (!$staff) {
            // Fallback: search staff by user name or first active staff matching user
            $stmtStaff2 = $this->pdo->prepare("
                SELECT id, school_id, name, phone, role, status 
                FROM staff 
                WHERE school_id = :sid AND status = 'ACTIVE' AND name = :name
                LIMIT 1
            ");
            $stmtStaff2->execute([':sid' => $schoolId, ':name' => $user['name'] ?? '']);
            $staff = $stmtStaff2->fetch(PDO::FETCH_ASSOC);
        }

        if (!$staff) {
            throw new NotFoundException('Active teacher staff record not found for your login account.');
        }

        $staffId = (int)$staff['id'];
        $empId = "EMP-" . str_pad((string)$staffId, 3, '0', STR_PAD_LEFT);
        $ay = $this->getWorkingAcademicYear($schoolId);

        // Authoritative Server Time
        $now = new \DateTime('now', new \DateTimeZone('Asia/Kolkata'));
        $today = $now->format('Y-m-d');
        $reachTimeStr = $now->format('h:i A');
        $nowSql = $now->format('Y-m-d H:i:s');

        // Reject QR scanning on Sunday or declared Holiday
        $dayOfWeek = (int)$now->format('N');
        if ($dayOfWeek === 7) {
            throw new ValidationException(['qr_payload' => 'Attendance cannot be marked on Sundays (School Closed).']);
        }
        $stmtHol = $this->pdo->prepare("SELECT name FROM holidays WHERE school_id = :sid AND date = :date LIMIT 1");
        $stmtHol->execute([':sid' => $schoolId, ':date' => $today]);
        $holidayRow = $stmtHol->fetch(PDO::FETCH_ASSOC);
        if (!empty($holidayRow)) {
            throw new ValidationException(['qr_payload' => "Attendance cannot be marked on declared School Holiday ({$holidayRow['name']})."]);
        }

        // Calculate Late / Early Arrival status
        $settings = $this->getSettings($user);
        $configuredMinutes = $this->parseTimeToMinutes($settings['entry_time']);
        $currentMinutes = $this->parseTimeToMinutes($reachTimeStr);

        $isLate = 0;
        $isEarly = 0;
        $lateText = null;
        $earlyText = null;

        if ($currentMinutes > $configuredMinutes) {
            $isLate = 1;
            $diff = $currentMinutes - $configuredMinutes;
            $lateText = $this->formatMinutesText($diff);
        } elseif ($currentMinutes < $configuredMinutes) {
            $isEarly = 1;
            $diff = $configuredMinutes - $currentMinutes;
            $earlyText = $this->formatMinutesText($diff);
        }

        // Check Duplicate Scanning for today
        $stmtCheck = $this->pdo->prepare("
            SELECT id, entry_time, reach_time, status, is_late 
            FROM teacher_attendance 
            WHERE staff_id = :st_id AND academic_year_id = :ayid AND date = :today 
            LIMIT 1
        ");
        $stmtCheck->execute([':st_id' => $staffId, ':ayid' => $ay['id'], ':today' => $today]);
        $existing = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $prevEntryTime = $existing['entry_time'] ?: date('h:i A', strtotime($existing['reach_time']));
            $prevMinutes = $this->parseTimeToMinutes($prevEntryTime);
            $exLate = 0;
            $exEarly = 0;
            $exLateText = null;
            $exEarlyText = null;

            if ($prevMinutes > $configuredMinutes) {
                $exLate = 1;
                $exLateText = $this->formatMinutesText($prevMinutes - $configuredMinutes);
            } elseif ($prevMinutes < $configuredMinutes) {
                $exEarly = 1;
                $exEarlyText = $this->formatMinutesText($configuredMinutes - $prevMinutes);
            }

            return [
                'already_marked' => true,
                'message' => "Attendance already marked for today at {$prevEntryTime}.",
                'teacher_name' => $staff['name'],
                'emp_id' => $empId,
                'reach_time' => $prevEntryTime,
                'status' => $existing['status'],
                'is_late' => (bool)$exLate,
                'late_text' => $exLateText,
                'is_early' => (bool)$exEarly,
                'early_text' => $exEarlyText,
            ];
        }

        // Save Attendance Record
        $stmtInsert = $this->pdo->prepare("
            INSERT INTO teacher_attendance (school_id, academic_year_id, staff_id, user_id, date, status, entry_time, is_late, reach_time)
            VALUES (:sid, :ayid, :staff_id, :uid, :date, 'Present', :etime, :is_late, :rtime)
        ");
        $stmtInsert->execute([
            ':sid' => $schoolId,
            ':ayid' => $ay['id'],
            ':staff_id' => $staffId,
            ':uid' => $userId > 0 ? $userId : null,
            ':date' => $today,
            ':etime' => $reachTimeStr,
            ':is_late' => $isLate,
            ':rtime' => $nowSql
        ]);

        return [
            'already_marked' => false,
            'message' => 'Attendance marked successfully.',
            'teacher_name' => $staff['name'],
            'emp_id' => $empId,
            'reach_time' => $reachTimeStr,
            'status' => 'Present',
            'is_late' => (bool)$isLate,
            'late_text' => $lateText,
            'is_early' => (bool)$isEarly,
            'early_text' => $earlyText,
        ];
    }

    public function getTeacherHistory(array $user): array
    {
        $schoolId = $this->getSchoolId($user);
        $userPhone = $user['phone'] ?? '';
        $cleanPhone = preg_replace('/[^0-9]/', '', $userPhone);

        // Server-side Teacher Identity Lookup
        $stmtStaff = $this->pdo->prepare("
            SELECT id, name, phone, role, joining_date, created_at 
            FROM staff 
            WHERE school_id = :sid 
              AND (phone = :phone OR phone = :clean_phone)
              AND status = 'ACTIVE'
            LIMIT 1
        ");
        $stmtStaff->execute([
            ':sid' => $schoolId,
            ':phone' => $userPhone,
            ':clean_phone' => $cleanPhone
        ]);
        $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);

        if (!$staff) {
            $stmtStaff2 = $this->pdo->prepare("
                SELECT id, name, phone, role, joining_date, created_at 
                FROM staff 
                WHERE school_id = :sid AND status = 'ACTIVE' AND name = :name
                LIMIT 1
            ");
            $stmtStaff2->execute([':sid' => $schoolId, ':name' => $user['name'] ?? '']);
            $staff = $stmtStaff2->fetch(PDO::FETCH_ASSOC);
        }

        if (!$staff) {
            // Fallback: Pick the first active teacher in the school
            $stmtStaff3 = $this->pdo->prepare("
                SELECT id, name, phone, role, joining_date, created_at 
                FROM staff 
                WHERE school_id = :sid AND status = 'ACTIVE'
                ORDER BY id ASC
                LIMIT 1
            ");
            $stmtStaff3->execute([':sid' => $schoolId]);
            $staff = $stmtStaff3->fetch(PDO::FETCH_ASSOC);
        }

        if (!$staff) {
            return [
                'teacher_name' => $user['name'] ?? '',
                'emp_id' => 'EMP-000',
                'months' => [],
                'records' => []
            ];
        }

        $staffId = (int)$staff['id'];
        $empId = "EMP-" . str_pad((string)$staffId, 3, '0', STR_PAD_LEFT);
        $ay = $this->getWorkingAcademicYear($schoolId);
        $settings = $this->getSettings($user);
        $configuredMinutes = $this->parseTimeToMinutes($settings['entry_time']);

        // Month pagination logic based on Teacher Joining Date & Academic Year
        $ayStart = new \DateTime(!empty($ay['start_date']) ? $ay['start_date'] : date('Y-04-01'));
        $ayEnd = new \DateTime(!empty($ay['end_date']) ? $ay['end_date'] : date('Y-03-31', strtotime('+1 year')));

        $joiningStr = !empty($staff['joining_date']) ? $staff['joining_date'] : ($staff['created_at'] ?? $ayStart->format('Y-m-d'));
        try {
            $joinDate = new \DateTime($joiningStr);
        } catch (\Exception $e) {
            $joinDate = clone $ayStart;
        }

        $effectiveStart = ($joinDate > $ayStart && $joinDate <= $ayEnd) ? $joinDate : $ayStart;

        $currentMonth = new \DateTime($effectiveStart->format('Y-m-01'));
        $endMonth = new \DateTime($ayEnd->format('Y-m-01'));

        $monthsList = [];
        while ($currentMonth <= $endMonth) {
            $monthsList[] = [
                'year' => (int)$currentMonth->format('Y'),
                'month' => (int)$currentMonth->format('n'),
                'month_name' => $currentMonth->format('F Y'),
                'key' => $currentMonth->format('Y-m'),
            ];
            $currentMonth->modify('+1 month');
        }

        // Fetch all holidays for this school
        $stmtHols = $this->pdo->prepare("SELECT date, name FROM holidays WHERE school_id = :sid");
        $stmtHols->execute([':sid' => $schoolId]);
        $holidayMap = [];
        while ($h = $stmtHols->fetch(PDO::FETCH_ASSOC)) {
            $holidayMap[$h['date']] = $h['name'];
        }

        // Fetch saved attendance for this staff in this academic year
        $stmtAtt = $this->pdo->prepare("
            SELECT date, status, entry_time, is_late, reach_time
            FROM teacher_attendance
            WHERE staff_id = :st_id AND academic_year_id = :ayid
            ORDER BY date DESC
        ");
        $stmtAtt->execute([':st_id' => $staffId, ':ayid' => $ay['id']]);
        $attRows = $stmtAtt->fetchAll(PDO::FETCH_ASSOC);
        $attMap = [];
        foreach ($attRows as $r) {
            $attMap[$r['date']] = $r;
        }

        $todayStr = date('Y-m-d');
        $joiningOnlyDate = substr($joiningStr, 0, 10);

        $monthsList = [];
        $allRecords = [];

        $currentMonth = new \DateTime($effectiveStart->format('Y-m-01'));
        $endMonth = new \DateTime($ayEnd->format('Y-m-01'));

        while ($currentMonth <= $endMonth) {
            $year = (int)$currentMonth->format('Y');
            $month = (int)$currentMonth->format('n');
            $monthKey = $currentMonth->format('Y-m');
            $monthName = $currentMonth->format('F Y');

            $daysInMonth = (int)$currentMonth->format('t');
            $monthRecords = [];

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);

                // If teacher joined mid-year, skip calendar days before joining date
                if ($dateStr < $joiningOnlyDate) {
                    continue;
                }

                $timeObj = strtotime($dateStr);
                $dayOfWeek = (int)date('N', $timeObj); // 7 = Sunday
                $isSunday = ($dayOfWeek === 7);
                $holidayName = $holidayMap[$dateStr] ?? null;
                $isHoliday = !empty($holidayName);

                $att = $attMap[$dateStr] ?? null;

                $status = 'Pending';
                $statusType = 'normal'; // 'normal', 'sunday', 'holiday', 'pending'
                $genericMessage = null;
                $entryTime = '—';
                $recLate = false;
                $recLateText = null;
                $recEarly = false;
                $recEarlyText = null;

                if ($isSunday) {
                    $status = 'Sunday';
                    $statusType = 'sunday';
                    $genericMessage = null;
                } elseif ($isHoliday) {
                    $status = 'Holiday';
                    $statusType = 'holiday';
                    $genericMessage = null;
                } elseif ($att) {
                    $status = $att['status'];
                    $entryTime = $att['entry_time'] ?? '—';
                    $entryMinutes = $this->parseTimeToMinutes($entryTime);

                    if ($entryMinutes > $configuredMinutes) {
                        $recLate = true;
                        $recLateText = $this->formatMinutesText($entryMinutes - $configuredMinutes);
                    } elseif ($entryMinutes < $configuredMinutes) {
                        $recEarly = true;
                        $recEarlyText = $this->formatMinutesText($configuredMinutes - $entryMinutes);
                    }
                } else {
                    if ($dateStr < $todayStr) {
                        // Past working day without QR scan -> Automatically Absent
                        $status = 'Absent';
                        $statusType = 'normal';
                    } else {
                        // Today (unscanned) or Future working day -> Pending
                        $status = 'Pending';
                        $statusType = 'pending';
                    }
                }

                $recObj = [
                    'date' => $dateStr,
                    'date_formatted' => date('d M Y', $timeObj),
                    'day_name' => date('l', $timeObj),
                    'status' => $status,
                    'status_type' => $statusType,
                    'generic_message' => $genericMessage,
                    'holiday_name' => $holidayName,
                    'entry_time' => $entryTime,
                    'is_late' => $recLate,
                    'late_text' => $recLateText,
                    'is_early' => $recEarly,
                    'early_text' => $recEarlyText,
                    'month_key' => $monthKey,
                ];

                $monthRecords[] = $recObj;
                $allRecords[] = $recObj;
            }

            // Sort month records ascending so 1st date of month is at top and last date at bottom
            usort($monthRecords, fn($a, $b) => strcmp($a['date'], $b['date']));

            $monthsList[] = [
                'year' => $year,
                'month' => $month,
                'month_name' => $monthName,
                'key' => $monthKey,
                'records' => $monthRecords,
            ];

            $currentMonth->modify('+1 month');
        }

        // Sort all records descending by date
        usort($allRecords, fn($a, $b) => strcmp($b['date'], $a['date']));

        return [
            'teacher_name' => $staff['name'],
            'emp_id' => $empId,
            'academic_year_name' => $ay['name'],
            'joining_date' => $staff['joining_date'] ?? null,
            'months' => $monthsList,
            'records' => $allRecords
        ];
    }

    private function formatMinutesText(int $minutes): string
    {
        if ($minutes <= 0) return '0 min';
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;
        if ($h > 0 && $m > 0) {
            return "{$h} hr {$m} mins";
        } elseif ($h > 0) {
            return "{$h} hr" . ($h > 1 ? 's' : '');
        } else {
            return "{$m} mins";
        }
    }

    private function parseTimeToMinutes(string $timeStr): int
    {
        $timeStr = trim($timeStr);
        $timestamp = strtotime($timeStr);
        if ($timestamp === false) {
            $timestamp = strtotime('08:30 AM');
        }
        $hours = (int)date('G', $timestamp);
        $minutes = (int)date('i', $timestamp);
        return ($hours * 60) + $minutes;
    }
}
