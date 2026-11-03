<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Bootstrap\App;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;

if ($argc < 3) {
    exit("Usage: php send_settlement_email.php <reportId> <schoolId> [baseUrl]\n");
}

$reportId = (int)$argv[1];
$schoolId = (int)$argv[2];
$baseUrl = $argv[3] ?? '';

// Load .env file from api root
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $val = trim($val, " \t\"'");
        putenv(trim($key) . '=' . $val);
    }
}

try {
    $app = App::create();
    $container = $app->getContainer();
    $service = $container->get(SchoolAdminService::class);

    $dummyUser = [
        'id' => 1,
        'school_id' => $schoolId,
        'role' => 'School Admin'
    ];

    $service->dispatchSettlementEmail($dummyUser, $reportId, $baseUrl);
    echo "Settlement email dispatched successfully for report ID: {$reportId}\n";
} catch (\Throwable $e) {
    $logPath = __DIR__ . '/../../sent_emails.log';
    file_put_contents($logPath, "[" . date('Y-m-d H:i:s') . "] [BACKGROUND_SETTLEMENT_EMAIL_ERROR] " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n", FILE_APPEND);
    echo "Error dispatching email: " . $e->getMessage() . "\n";
}

