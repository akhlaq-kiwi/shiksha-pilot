<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Bootstrap\App;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;

$app = App::create();
$container = $app->getContainer();
$service = $container->get(SchoolAdminService::class);

// Parse CLI options
$options = getopt('', ['force', 'school_id:', 'test_count:']);
$force = isset($options['force']);
$schoolId = isset($options['school_id']) ? (int)$options['school_id'] : null;
$testCount = isset($options['test_count']) ? (int)$options['test_count'] : null;

echo "[" . date('Y-m-d H:i:s') . "] Starting Fee Reminder Due Today check...\n";

if ($force && $schoolId !== null && $testCount !== null) {
    $res = $service->triggerTestFeeReminderNotification($schoolId, $testCount);
} else {
    $res = $service->checkAndSendFeeReminderDueTodayNotifications($schoolId, $force);
}

echo "[" . date('Y-m-d H:i:s') . "] Result: " . json_encode($res, JSON_PRETTY_PRINT) . "\n";
echo "[" . date('Y-m-d H:i:s') . "] Execution finished.\n";
