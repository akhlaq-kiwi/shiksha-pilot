<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

// 1. Load .env file from api root (two levels up from this file)
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $val = trim($val, " \t\"'");
        putenv(trim($key) . '=' . $val);
    }
}

$host   = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'shiksha_pilot';
$user   = getenv('DB_USER') ?: 'root';
$pass   = getenv('DB_PASS') ?: 'admin123';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (\Exception $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 2. Parse CLI arguments
$options = getopt('', ['id:']);
$applicationId = isset($options['id']) ? (int)$options['id'] : 0;
if ($applicationId <= 0) {
    echo "Invalid application ID.\n";
    exit(1);
}

// 3. Fetch application
$stmtApp = $pdo->prepare("SELECT * FROM late_payment_penalty_applications WHERE id = :id");
$stmtApp->execute([':id' => $applicationId]);
$app = $stmtApp->fetch();
if (!$app) {
    echo "Application not found.\n";
    exit(1);
}

$schoolId = (int)$app['school_id'];
$academicYearId = (int)$app['academic_year_id'];
$percentage = (float)$app['percentage'];
$description = $app['description'];
$creatorId = (int)$app['created_by'];

// Get creator details
$stmtCreator = $pdo->prepare("SELECT name, email FROM users WHERE id = :id");
$stmtCreator->execute([':id' => $creatorId]);
$creator = $stmtCreator->fetch();
$creatorName = $creator ? $creator['name'] : 'School Admin';
$creatorEmail = $creator ? $creator['email'] : 'admin';

// Get academic year details
$stmtAY = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id");
$stmtAY->execute([':id' => $academicYearId]);
$ay = $stmtAY->fetch();
$academicYearName = $ay ? $ay['name'] : 'Current';

// 4. Find or Create Late Payment Penalty Additional Fee Type
$stmtType = $pdo->prepare("
    SELECT id FROM additional_fee_types 
    WHERE school_id = :sid AND academic_year_id = :ayid AND name = 'Late Payment Penalty' LIMIT 1
");
$stmtType->execute([':sid' => $schoolId, ':ayid' => $academicYearId]);
$feeTypeId = $stmtType->fetchColumn();

if ($feeTypeId === false) {
    $stmtInsType = $pdo->prepare("
        INSERT INTO additional_fee_types (school_id, name, amount, academic_year_id, category, due_date)
        VALUES (:sid, 'Late Payment Penalty', 0.0, :ayid, 'System Generated', :due_date)
    ");
    $stmtInsType->execute([
        ':sid' => $schoolId,
        ':ayid' => $academicYearId,
        ':due_date' => date('Y-m-d')
    ]);
    $feeTypeId = (int)$pdo->lastInsertId();
} else {
    $feeTypeId = (int)$feeTypeId;
}

// 5. Fetch student queue
$stmtRecs = $pdo->prepare("
    SELECT r.id AS record_id, r.student_id, s.first_name, s.middle_name, s.last_name, s.admission_no, s.email AS student_email, s.parent_phone, c.name AS class_name, c.section AS section_name 
    FROM late_payment_penalty_records r 
    JOIN students s ON r.student_id = s.id 
    LEFT JOIN classes c ON s.class_id = c.id 
    WHERE r.application_id = :appid AND r.status = 'Pending'
");
$stmtRecs->execute([':appid' => $applicationId]);
$queue = $stmtRecs->fetchAll();

$startTime = microtime(true);

foreach ($queue as $row) {
    $recordId = (int)$row['record_id'];
    $studentId = (int)$row['student_id'];
    
    // Construct student name
    $nameParts = array_filter([$row['first_name'], $row['middle_name'], $row['last_name']]);
    $studentName = implode(' ', $nameParts);
    if (empty($studentName)) {
        $studentName = 'Student';
    }
    
    $admissionNo = $row['admission_no'];
    $className = $row['class_name'];
    $sectionName = $row['section_name'];
    $studentEmail = $row['student_email'];
    $parentPhone = $row['parent_phone'];

    // Start student-specific transaction
    $pdo->beginTransaction();
    try {
        $due = getStudentCurrentOutstandingBalance($pdo, $studentId, $schoolId, $academicYearId);
        
        if ($due <= 0) {
            // Skip student
            $stmtUp = $pdo->prepare("
                UPDATE late_payment_penalty_records 
                SET status = 'Skipped', outstanding_due = :due, penalty_amount = 0.00 
                WHERE id = :rid
            ");
            $stmtUp->execute([':rid' => $recordId, ':due' => $due]);
            
            $stmtInc = $pdo->prepare("
                UPDATE late_payment_penalty_applications 
                SET processed_students = processed_students + 1, skipped_students = skipped_students + 1 
                WHERE id = :appid
            ");
            $stmtInc->execute([':appid' => $applicationId]);
        } else {
            $penalty = round($due * $percentage / 100);
            
            if ($penalty <= 0) {
                // Skip student
                $stmtUp = $pdo->prepare("
                    UPDATE late_payment_penalty_records 
                    SET status = 'Skipped', outstanding_due = :due, penalty_amount = 0.00 
                    WHERE id = :rid
                ");
                $stmtUp->execute([':rid' => $recordId, ':due' => $due]);
                
                $stmtInc = $pdo->prepare("
                    UPDATE late_payment_penalty_applications 
                    SET processed_students = processed_students + 1, skipped_students = skipped_students + 1 
                    WHERE id = :appid
                ");
                $stmtInc->execute([':appid' => $applicationId]);
            } else {
                // Create Additional Fee Payment entry (linked to Late Payment Penalty)
                $stmtInsPay = $pdo->prepare("
                    INSERT INTO additional_fee_payments 
                    (school_id, student_id, fee_type_id, amount, status, description, created_by_name, penalty_type)
                    VALUES (:sid, :stid, :ftid, :amt, 'Pending', :desc, :creator, 'Late Payment Penalty')
                ");
                $stmtInsPay->execute([
                    ':sid' => $schoolId,
                    ':stid' => $studentId,
                    ':ftid' => $feeTypeId,
                    ':amt' => $penalty,
                    ':desc' => $description,
                    ':creator' => $creatorName
                ]);
                
                // Create History Log Entry
                $stmtHist = $pdo->prepare("
                    INSERT INTO late_payment_penalty_history 
                    (school_id, academic_year_id, student_id, student_name, admission_no, class_name, section_name, outstanding_due, penalty_percentage, penalty_amount, description, applied_by, applied_by_name)
                    VALUES (:sid, :ayid, :stid, :sname, :adm, :cname, :ssect, :due, :pct, :pamt, :desc, :uid, :uname)
                ");
                $stmtHist->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $academicYearId,
                    ':stid' => $studentId,
                    ':sname' => $studentName,
                    ':adm' => $admissionNo,
                    ':cname' => $className,
                    ':ssect' => $sectionName,
                    ':due' => $due,
                    ':pct' => $percentage,
                    ':pamt' => $penalty,
                    ':desc' => $description,
                    ':uid' => $creatorId,
                    ':uname' => $creatorName
                ]);
                
                // Create Audit Log
                $auditAction = "Late payment penalty applied: student {$studentName} (adm: {$admissionNo}), penalty INR {$penalty} ({$percentage}%) for outstanding due INR {$due}";
                $stmtAudit = $pdo->prepare("
                    INSERT INTO audit_logs (action, module, description, target_school, user, performed_by, user_role, academic_year, ip_address, device)
                    VALUES (:act, 'Late Payment Penalty', :desc, :sch, :usr, :uname, 'SCHOOL_ADMIN', :ay, '127.0.0.1', 'System Background')
                ");
                $stmtAudit->execute([
                    ':act' => 'Apply Penalty',
                    ':desc' => $auditAction,
                    ':sch' => $schoolId,
                    ':usr' => $creatorEmail,
                    ':uname' => $creatorName,
                    ':ay' => $academicYearName
                ]);
                
                // Dashboard Notifications
                // 1. Student notification
                if (!empty($studentEmail)) {
                    $stmtUser = $pdo->prepare("
                        SELECT id FROM users WHERE school_id = :sid AND role = 'STUDENT' AND email = :email AND status = 'ACTIVE' LIMIT 1
                    ");
                    $stmtUser->execute([':sid' => $schoolId, ':email' => $studentEmail]);
                    $studentUserId = $stmtUser->fetchColumn();
                    
                    if ($studentUserId !== false) {
                        $stmtNotif = $pdo->prepare("
                            INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, is_read)
                            VALUES (:sid, 'STUDENT', :uid, 'Late Payment Penalty Added', :msg, 0)
                        ");
                        $stmtNotif->execute([
                            ':sid' => $schoolId,
                            ':uid' => (int)$studentUserId,
                            ':msg' => "A Late Payment Penalty of ₹" . number_format($penalty, 2) . " has been added to your account because outstanding fees were pending after Academic Year Migration."
                        ]);
                    }
                }
                
                // 2. Parent notification
                if (!empty($parentPhone)) {
                    $stmtParentUser = $pdo->prepare("
                        SELECT id FROM users WHERE school_id = :sid AND role = 'PARENT' AND phone = :phone AND status = 'ACTIVE' LIMIT 1
                    ");
                    $stmtParentUser->execute([':sid' => $schoolId, ':phone' => $parentPhone]);
                    $parentUserId = $stmtParentUser->fetchColumn();
                    
                    if ($parentUserId !== false) {
                        $stmtNotif = $pdo->prepare("
                            INSERT INTO dashboard_notifications (school_id, user_role, user_id, title, message, is_read)
                            VALUES (:sid, 'PARENT', :uid, 'Late Payment Penalty Added', :msg, 0)
                        ");
                        $stmtNotif->execute([
                            ':sid' => $schoolId,
                            ':uid' => (int)$parentUserId,
                            ':msg' => "A Late Payment Penalty of ₹" . number_format($penalty, 2) . " has been added to your account because outstanding fees were pending after Academic Year Migration."
                        ]);
                    }
                }

                // Update queue record
                $stmtUp = $pdo->prepare("
                    UPDATE late_payment_penalty_records 
                    SET status = 'Success', outstanding_due = :due, penalty_amount = :pamt 
                    WHERE id = :rid
                ");
                $stmtUp->execute([
                    ':rid' => $recordId,
                    ':due' => $due,
                    ':pamt' => $penalty
                ]);
                
                // Increment success counters on application
                $stmtInc = $pdo->prepare("
                    UPDATE late_payment_penalty_applications 
                    SET processed_students = processed_students + 1, successful_students = successful_students + 1, total_penalty_amount = total_penalty_amount + :pamt 
                    WHERE id = :appid
                ");
                $stmtInc->execute([
                    ':pamt' => $penalty,
                    ':appid' => $applicationId
                ]);
            }
        }
        $pdo->commit();
    } catch (\Exception $e) {
        $pdo->rollBack();
        
        // Mark as Failed
        $stmtUp = $pdo->prepare("
            UPDATE late_payment_penalty_records 
            SET status = 'Failed', error_message = :err 
            WHERE id = :rid
        ");
        $stmtUp->execute([
            ':rid' => $recordId,
            ':err' => $e->getMessage()
        ]);
        
        // Increment fail counters
        $stmtInc = $pdo->prepare("
            UPDATE late_payment_penalty_applications 
            SET processed_students = processed_students + 1, failed_students = failed_students + 1 
            WHERE id = :appid
        ");
        $stmtInc->execute([':appid' => $applicationId]);
    }
}

// Calculate elapsed time
$endTime = microtime(true);
$duration = (int)round(($endTime - $startTime) * 1000); // in milliseconds

// Check if any Pending records remain
$stmtCheck = $pdo->prepare("
    SELECT COUNT(*) FROM late_payment_penalty_records 
    WHERE application_id = :appid AND status = 'Pending'
");
$stmtCheck->execute([':appid' => $applicationId]);
$remaining = (int)$stmtCheck->fetchColumn();

if ($remaining === 0) {
    // Determine final status
    $stmtCheckFail = $pdo->prepare("
        SELECT COUNT(*) FROM late_payment_penalty_records 
        WHERE application_id = :appid AND status = 'Failed'
    ");
    $stmtCheckFail->execute([':appid' => $applicationId]);
    $failed = (int)$stmtCheckFail->fetchColumn();
    
    $finalStatus = $failed > 0 ? 'Failed' : 'Completed';
    
    $stmtFinal = $pdo->prepare("
        UPDATE late_payment_penalty_applications 
        SET status = :status, time_taken = time_taken + :dur 
        WHERE id = :appid
    ");
    $stmtFinal->execute([
        ':status' => $finalStatus,
        ':dur' => $duration,
        ':appid' => $applicationId
    ]);
} else {
    // Just add duration
    $stmtFinal = $pdo->prepare("
        UPDATE late_payment_penalty_applications 
        SET time_taken = time_taken + :dur 
        WHERE id = :appid
    ");
    $stmtFinal->execute([
        ':dur' => $duration,
        ':appid' => $applicationId
    ]);
}

echo "Late Payment Penalty application ID {$applicationId} processed successfully.\n";

// --- Helper Functions ---

function getStudentCurrentOutstandingBalance(PDO $pdo, int $studentId, int $schoolId, int $academicYearId): float
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

    // Fetch paid months for student in academic year
    $stmtPaid = $pdo->prepare("
        SELECT fee_month FROM fee_payments 
        WHERE student_id = :student_id AND school_id = :school_id AND status = 'PAID' AND academic_year_id = :academic_year_id
    ");
    $stmtPaid->execute([
        ':student_id' => $studentId,
        ':school_id' => $schoolId,
        ':academic_year_id' => $academicYearId
    ]);
    $paidMonths = $stmtPaid->fetchAll(PDO::FETCH_COLUMN);

    // Determine months to evaluate (up to current calendar month)
    $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    $monthsToEvaluate = $academicMonths;
    
    $stmtAY = $pdo->prepare("SELECT start_date, end_date, status FROM academic_years WHERE id = :ayid AND school_id = :sid LIMIT 1");
    $stmtAY->execute([':ayid' => $academicYearId, ':sid' => $schoolId]);
    $ayRow = $stmtAY->fetch(PDO::FETCH_ASSOC);
    if ($ayRow) {
        $monthsToEvaluate = getMonthsDueUpToCurrent($ayRow['start_date'], $ayRow['end_date'], $ayRow['status']);
    }

    $outstanding = 0.0;
    foreach ($monthsToEvaluate as $m) {
        if (!in_array($m, $paidMonths, true)) {
            $outstanding += isset($monthlyFees[$m]) ? (float)$monthlyFees[$m] : 0.0;
        }
    }

    // Fetch all pending additional fees (including transport and previous year dues)
    $stmtAddPending = $pdo->prepare("
        SELECT COALESCE(SUM(afp.amount), 0)
        FROM additional_fee_payments afp
        JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
        WHERE afp.student_id = :student_id
          AND afp.school_id = :school_id
          AND afp.status = 'Pending'
          AND (aft.academic_year_id = :academic_year_id OR aft.name = 'Previous Year Dues')
    ");
    $stmtAddPending->execute([
        ':student_id' => $studentId,
        ':school_id' => $schoolId,
        ':academic_year_id' => $academicYearId
    ]);
    $outstanding += (float)$stmtAddPending->fetchColumn();

    return $outstanding;
}

function getMonthsDueUpToCurrent(string $startDateStr, string $endDateStr, string $status = 'ACTIVE'): array
{
    $academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    
    if (strcasecmp((string)$status, 'Archived') === 0) {
        return $academicMonths;
    }

    try {
        $now = new \DateTime();
        $today = new \DateTime($now->format('Y-m-d'));
        $startDate = new \DateTime($startDateStr);
        $endDate = new \DateTime($endDateStr);
        
        if ($today > $endDate) {
            return $academicMonths;
        }
        
        if ($today < $startDate) {
            return [];
        }
        
        $dueMonths = [];
        $curr = clone $startDate;
        $curr->setDate((int)$curr->format('Y'), (int)$curr->format('m'), 1);
        
        $cutoff = min($today, $endDate);
        $cutoffMonthStr = $cutoff->format('Y-m');
        
        while ($curr->format('Y-m') <= $cutoffMonthStr) {
            $mName = $curr->format('F');
            if (in_array($mName, $academicMonths, true) && !in_array($mName, $dueMonths, true)) {
                $dueMonths[] = $mName;
            }
            $curr->modify('+1 month');
        }
        
        return !empty($dueMonths) ? $dueMonths : $academicMonths;
    } catch (\Throwable $e) {
        return $academicMonths;
    }
}
