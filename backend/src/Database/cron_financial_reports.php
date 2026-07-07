<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

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
    $stmtSchools = $pdo->prepare("SELECT id, name FROM schools");
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

            cron_log("Successfully generated Financial Report {$reportId} for school ID {$schoolId} ({$schoolName}) year {$yearName} for period {$from} to {$to}.");
        }
    }
    cron_log("Automatic monthly financial report scheduler execution finished successfully.");
} catch (Exception $e) {
    cron_log("Error during automatic financial report generation: " . $e->getMessage());
    exit(1);
}
