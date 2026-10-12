<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Domain\SchoolAdmin\Services\TeacherAttendanceService;

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

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    echo "[" . date('Y-m-d H:i:s') . "] Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 2. Parse CLI options
$options = getopt('', ['force', 'school_id:']);
$force = isset($options['force']);
$schoolId = isset($options['school_id']) ? (int)$options['school_id'] : null;

echo "[" . date('Y-m-d H:i:s') . "] Starting Late Teachers Entry Alert cron check...\n";

$service = new TeacherAttendanceService($pdo);
$res = $service->checkAndSendLateTeachersAlert($schoolId, $force);

echo "[" . date('Y-m-d H:i:s') . "] Result: " . json_encode($res, JSON_PRETTY_PRINT) . "\n";
echo "[" . date('Y-m-d H:i:s') . "] Execution finished.\n";
