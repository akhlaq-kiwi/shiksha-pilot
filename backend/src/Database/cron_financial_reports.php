<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Domain\SchoolAdmin\Services\ExcelGenerator;
use App\Domain\SchoolAdmin\Services\SmtpMailer;

// 1. Load .env file from api root
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $val = trim($val, " \t\"'");
        putenv(trim($key) . '=' . $val);
    }
}

$host   = getenv('DB_HOST') ?: 'db';
$dbname = getenv('DB_NAME') ?: 'shiksha_pilot';
$user   = getenv('DB_USER') ?: 'root';
$pass   = getenv('DB_PASS') ?: 'admin123';

$logFile = __DIR__ . '/../../sent_emails.log';

function cron_log(string $msg) {
    global $logFile;
    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] [CRON_FINANCIAL_REPORTS] " . $msg . "\n", FILE_APPEND);
    echo $msg . "\n";
}

cron_log("Starting automatic monthly financial report scheduler...");

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    cron_log("Database connection failed: " . $e->getMessage());
    exit(1);
}

try {
    // 1. Get all schools in the system
    $stmtSchools = $pdo->prepare("SELECT id, name, contact_email FROM schools");
    $stmtSchools->execute();
    $schools = $stmtSchools->fetchAll();

    foreach ($schools as $school) {
        $schoolId = (int)$school['id'];
        $schoolName = $school['name'];

        // 2. Get eligible academic years for this school (status ACTIVE only)
        $stmtYears = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid AND status = 'ACTIVE'");
        $stmtYears->execute([':sid' => $schoolId]);
        $years = $stmtYears->fetchAll();

        foreach ($years as $year) {
            $yearId = (int)$year['id'];
            $yearName = $year['name'];

            // 3. Find the latest generated report in this academic year
            $stmtLatest = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid 
                  AND `from_date` >= :start_date 
                  AND `to_date` <= :end_date
                ORDER BY id DESC LIMIT 1
            ");
            $stmtLatest->execute([
                ':sid' => $schoolId,
                ':start_date' => $year['start_date'],
                ':end_date' => $year['end_date']
            ]);
            $latestReport = $stmtLatest->fetch();

            $latestReportCreatedAt = $latestReport ? $latestReport['created_at'] : null;

            $from = $latestReport ? $latestReport['to_date'] : $year['start_date'];
            $to = date('Y-m-d', strtotime('yesterday'));
            $toTimestamp = $to . ' 23:59:59';

            if (strtotime($to) < strtotime($from)) {
                // If today is earlier than the academic year start or last report, skip
                continue;
            }

            // 5. Prevent duplicate report generation if the scheduler runs more than once
            $stmtCheckDup = $pdo->prepare("
                SELECT COUNT(*) FROM financial_reports 
                WHERE school_id = :sid AND `to_date` = :to
            ");
            $stmtCheckDup->execute([':sid' => $schoolId, ':to' => $to]);
            if ((int)$stmtCheckDup->fetchColumn() > 0) {
                cron_log("Skipping school ID {$schoolId} ({$schoolName}) year {$yearName}: Report ending on {$to} already exists.");
                continue;
            }

            // 6. Compute financial metrics for the period using Academic Year ownership
            // Fees collected
            if ($latestReportCreatedAt) {
                $stmtFees = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM fee_payments 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid 
                      AND created_at > :latest_rep_ts
                      AND created_at <= :to_ts
                ");
                $stmtFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':latest_rep_ts' => $latestReportCreatedAt,
                    ':to_ts' => $toTimestamp
                ]);
            } else {
                $stmtFees = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM fee_payments 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid
                      AND created_at <= :to_ts
                ");
                $stmtFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':to_ts' => $toTimestamp
                ]);
            }
            $tuitionCollected = (float)$stmtFees->fetchColumn();

            // Additional fees
            if ($latestReportCreatedAt) {
                $stmtAddFees = $pdo->prepare("
                    SELECT COALESCE(SUM(afp.amount), 0) 
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    WHERE afp.school_id = :sid 
                      AND afp.status = 'Paid' 
                      AND aft.academic_year_id = :ayid 
                      AND afp.updated_at > :latest_rep_ts
                      AND afp.updated_at <= :to_ts
                ");
                $stmtAddFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':latest_rep_ts' => $latestReportCreatedAt,
                    ':to_ts' => $toTimestamp
                ]);
            } else {
                $stmtAddFees = $pdo->prepare("
                    SELECT COALESCE(SUM(afp.amount), 0) 
                    FROM additional_fee_payments afp
                    JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                    WHERE afp.school_id = :sid 
                      AND afp.status = 'Paid' 
                      AND aft.academic_year_id = :ayid
                      AND afp.updated_at <= :to_ts
                ");
                $stmtAddFees->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':to_ts' => $toTimestamp
                ]);
            }
            $addFeesCollected = (float)$stmtAddFees->fetchColumn();

            $totalFees = $tuitionCollected + $addFeesCollected;

            // Salaries paid
            if ($latestReportCreatedAt) {
                $stmtSalaries = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM staff_payments 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid 
                      AND created_at > :latest_rep_ts
                      AND created_at <= :to_ts
                ");
                $stmtSalaries->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':latest_rep_ts' => $latestReportCreatedAt,
                    ':to_ts' => $toTimestamp
                ]);
            } else {
                $stmtSalaries = $pdo->prepare("
                    SELECT COALESCE(SUM(amount_paid), 0) 
                    FROM staff_payments 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid
                      AND created_at <= :to_ts
                ");
                $stmtSalaries->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':to_ts' => $toTimestamp
                ]);
            }
            $salariesPaid = (float)$stmtSalaries->fetchColumn();

            // Expenses paid
            if ($latestReportCreatedAt) {
                $stmtExpenses = $pdo->prepare("
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM school_expenses 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid 
                      AND created_at > :latest_rep_ts
                      AND created_at <= :to_ts
                ");
                $stmtExpenses->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':latest_rep_ts' => $latestReportCreatedAt,
                    ':to_ts' => $toTimestamp
                ]);
            } else {
                $stmtExpenses = $pdo->prepare("
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM school_expenses 
                    WHERE school_id = :sid 
                      AND academic_year_id = :ayid
                      AND created_at <= :to_ts
                ");
                $stmtExpenses->execute([
                    ':sid' => $schoolId,
                    ':ayid' => $yearId,
                    ':to_ts' => $toTimestamp
                ]);
            }
            $expensesPaid = (float)$stmtExpenses->fetchColumn();

            $totalExpenses = $salariesPaid + $expensesPaid;
            $profitLoss = $totalFees - $totalExpenses;

            // 7. Auto-generate Financial Report REP-XXX with status 'Pending'
            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM financial_reports WHERE school_id = :sid");
            $stmtCount->execute([':sid' => $schoolId]);
            $count = (int)$stmtCount->fetchColumn();
            $reportId = 'REP-' . str_pad((string)($count + 1), 3, '0', STR_PAD_LEFT);

            $stmtIns = $pdo->prepare("
                INSERT INTO financial_reports (school_id, report_id, `from_date`, `to_date`, fees_collected, salary_paid, profit_loss, status)
                VALUES (:sid, :report_id, :from_date, :to_date, :fees_collected, :salary_paid, :profit_loss, 'Pending')
            ");
            $stmtIns->execute([
                ':sid' => $schoolId,
                ':report_id' => $reportId,
                ':from_date' => $from,
                ':to_date' => $to,
                ':fees_collected' => $totalFees,
                ':salary_paid' => $totalExpenses,
                ':profit_loss' => $profitLoss
            ]);

            $newReportId = (int)$pdo->lastInsertId();
            $stmtNewReport = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id LIMIT 1");
            $stmtNewReport->execute([':id' => $newReportId]);
            $newReport = $stmtNewReport->fetch();

            // Find bounds of transactions contributing to this report
            $stmtPrev = $pdo->prepare("
                SELECT * FROM financial_reports 
                WHERE school_id = :sid AND created_at < :created_at 
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmtPrev->execute([':sid' => $schoolId, ':created_at' => $newReport['created_at']]);
            $prevReport = $stmtPrev->fetch();

            if ($prevReport) {
                $from_ts = $prevReport['created_at'];
                $operator = '>';
            } else {
                $from_ts = $newReport['from_date'] . ' 00:00:00';
                $operator = '>=';
            }

            $createdDate = date('Y-m-d', strtotime($newReport['created_at']));
            if ($newReport['to_date'] === $createdDate) {
                $to_ts = $newReport['created_at'];
            } else {
                $to_ts = $newReport['to_date'] . ' 23:59:59';
            }

            // Fetch Student Fee Collections
            $stmtFeeList = $pdo->prepare("
                SELECT 
                    fp.created_at AS deposit_time, 
                    s.name AS student_name, 
                    c.name AS class_name, 
                    c.section AS class_section,
                    c.id AS class_id, 
                    s.roll_no, 
                    'Tuition Fee' AS fee_type, 
                    fp.fee_month AS months_covered, 
                    fp.amount_paid AS amount
                FROM fee_payments fp
                JOIN students s ON fp.student_id = s.id
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE fp.school_id = :sid 
                  AND fp.status = 'PAID'
                  AND fp.created_at {$operator} :from_ts 
                  AND fp.created_at <= :to_ts
            ");
            $stmtFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
            $feePayments = $stmtFeeList->fetchAll();

            $stmtAddFeeList = $pdo->prepare("
                SELECT 
                    afp.updated_at AS deposit_time, 
                    s.name AS student_name, 
                    c.name AS class_name, 
                    c.section AS class_section,
                    c.id AS class_id, 
                    s.roll_no, 
                    aft.name AS fee_type, 
                    'N/A' AS months_covered, 
                    afp.amount
                FROM additional_fee_payments afp
                JOIN students s ON afp.student_id = s.id
                LEFT JOIN classes c ON s.class_id = c.id
                JOIN additional_fee_types aft ON afp.fee_type_id = aft.id
                WHERE afp.school_id = :sid 
                  AND afp.status = 'Paid'
                  AND afp.updated_at {$operator} :from_ts 
                  AND afp.updated_at <= :to_ts
            ");
            $stmtAddFeeList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
            $addPayments = $stmtAddFeeList->fetchAll();

            $feeCollections = array_merge($feePayments, $addPayments);
            
            // Sort by class creation order, then deposit time, then name
            usort($feeCollections, function($a, $b) {
                $classIdA = isset($a['class_id']) ? (int)$a['class_id'] : 999999;
                $classIdB = isset($b['class_id']) ? (int)$b['class_id'] : 999999;
                if ($classIdA !== $classIdB) {
                    return $classIdA <=> $classIdB;
                }
                $timeA = strtotime($a['deposit_time'] ?? '1970-01-01 00:00:00');
                $timeB = strtotime($b['deposit_time'] ?? '1970-01-01 00:00:00');
                if ($timeA !== $timeB) {
                    return $timeA <=> $timeB;
                }
                return strcmp($a['student_name'] ?? '', $b['student_name'] ?? '');
            });

            $stmtSalaryList = $pdo->prepare("
                SELECT 
                    CASE 
                        WHEN sp.payment_month LIKE 'Previous Year - %' THEN CONCAT('Previous Year Salary - ', st.name, ' (', SUBSTRING(sp.payment_month, 17), ')')
                        WHEN sp.academic_year_id != st.academic_year_id THEN CONCAT('Previous Year Salary - ', st.name)
                        ELSE st.name 
                    END AS description, 
                    'Salary Payment' AS category, sp.payment_date AS expense_date, sp.amount_paid AS amount
                FROM staff_payments sp
                JOIN staff st ON sp.staff_id = st.id
                WHERE sp.school_id = :sid 
                  AND sp.created_at {$operator} :from_ts 
                  AND sp.created_at <= :to_ts
            ");
            $stmtSalaryList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
            $salaryPayments = $stmtSalaryList->fetchAll();

            $stmtExpenseList = $pdo->prepare("
                SELECT description, 'School Expense' AS category, expense_date, amount
                FROM school_expenses
                WHERE school_id = :sid 
                  AND created_at {$operator} :from_ts 
                  AND created_at <= :to_ts
            ");
            $stmtExpenseList->execute([':sid' => $schoolId, ':from_ts' => $from_ts, ':to_ts' => $to_ts]);
            $expensesItems = $stmtExpenseList->fetchAll();

            $expenses = array_merge($salaryPayments, $expensesItems);
            usort($expenses, function($a, $b) {
                return strcmp($a['expense_date'] ?? '', $b['expense_date'] ?? '');
            });

            $summary = [
                'revenue' => (float)$newReport['fees_collected'],
                'expenses' => (float)$newReport['salary_paid'],
            ];

            // Excel file generation
            $excelData = ExcelGenerator::generate($feeCollections, $expenses, $summary);

            $fromFormatted = date('j F Y', strtotime($newReport['from_date']));
            $toFormatted = date('j F Y', strtotime($newReport['to_date']));
            
            $subject = "Financial Report - {$fromFormatted} to {$toFormatted}";
            
            $emailBodyHtml = "
            <p>Dear School Owner,</p>
            <p>Your financial report has been successfully generated.</p>
            <p><strong>Reporting Period:</strong><br />
            {$fromFormatted} - {$toFormatted}</p>
            <p>The attached Excel report contains:</p>
            <ul>
                <li>Collected Fees</li>
                <li>Expenses</li>
                <li>Profit/Loss Summary</li>
            </ul>
            <p>Please keep this report for your financial records.</p>
            <p>Regards,<br />
            ShikshaPilot</p>
            ";

            $toEmail = isset($school['contact_email']) ? trim((string)$school['contact_email']) : '';
            if (!empty($toEmail) && filter_var($toEmail, FILTER_VALIDATE_EMAIL) !== false) {
                $fromFile = date('j M Y', strtotime($newReport['from_date']));
                $toFile = date('j M Y', strtotime($newReport['to_date']));
                $filename = "Financial Report - {$fromFile} to {$toFile}.xlsx";
                
                try {
                    SmtpMailer::send($toEmail, $subject, $emailBodyHtml, $excelData, $filename);
                    cron_log("Successfully sent automatic financial report email to {$toEmail} for report {$reportId}.");
                } catch (Exception $e) {
                    cron_log("Failed to send automatic financial report email to {$toEmail}: " . $e->getMessage());
                }
            } else {
                cron_log("No valid email registered for School ID {$schoolId}. Skipping email send.");
            }

            cron_log("Successfully generated Financial Report {$reportId} for school ID {$schoolId} ({$schoolName}) year {$yearName} for period {$from} to {$to}.");
        }
    }
    cron_log("Automatic monthly financial report scheduler execution finished successfully.");
} catch (Exception $e) {
    cron_log("Error during automatic financial report generation: " . $e->getMessage());
    exit(1);
}
