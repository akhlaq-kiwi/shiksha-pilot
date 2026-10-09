<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Bootstrap\App;
use App\Domain\SchoolAdmin\Services\SmtpMailer;

if ($argc < 3) {
    exit(1);
}

App::create();

$toEmail = $argv[1];
$subject = $argv[2];

if (isset($argv[3]) && file_exists($argv[3])) {
    $bodyHtml = file_get_contents($argv[3]);
    @unlink($argv[3]);
} else {
    $bodyHtml = $argv[3] ?? '';
}

try {
    SmtpMailer::send($toEmail, $subject, $bodyHtml, '', '');
} catch (\Throwable $e) {
    error_log("Async email error: " . $e->getMessage());
}
