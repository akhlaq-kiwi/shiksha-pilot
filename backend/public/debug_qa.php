<?php
header('Content-Type: text/plain');

try {
    require __DIR__ . '/../vendor/autoload.php';

    // Load environment from api/.env
    $envPath = __DIR__ . '/../.env';
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue;
            $eqPos = strpos($line, '=');
            if ($eqPos !== false) {
                $key = trim(substr($line, 0, $eqPos));
                $value = trim(substr($line, $eqPos + 1));
                if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
                    $value = substr($value, 1, -1);
                }
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
            }
        }
    }

    $app = App\Bootstrap\App::create();
    $container = $app->getContainer();
    $service = $container->get(App\Domain\SchoolAdmin\Services\SchoolAdminService::class);

    $pdo = $container->get(App\Database\Connection::class)->getPdo();
    $stmtUser = $pdo->query("SELECT * FROM users WHERE role = 'SCHOOL_ADMIN' LIMIT 1");
    $user = $stmtUser->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        die("No school admin user found in database!");
    }

    echo "Testing with user: {$user['username']} (School ID: {$user['school_id']})\n\n";

    $tests = [
        'getStudents' => function($service, $user) {
            return $service->getStudents($user);
        },
        'getClasses' => function($service, $user) {
            return $service->getClasses($user);
        },
        'getFeePayments' => function($service, $user) {
            return $service->getFeePayments($user);
        },
        'getClassFeeConfigurations' => function($service, $user) {
            return $service->getClassFeeConfigurations($user, null, null);
        },
        'getAdditionalFeePayments' => function($service, $user) {
            return $service->getAdditionalFeePayments($user);
        }
    ];

    foreach ($tests as $name => $fn) {
        try {
            $res = $fn($service, $user);
            echo "Test {$name}: SUCCESS (returned " . count($res) . " rows)\n";
        } catch (Exception $e) {
            echo "Test {$name}: FAILED - Error: " . $e->getMessage() . "\n";
            echo "Trace:\n" . $e->getTraceAsString() . "\n\n";
        }
    }
} catch (Throwable $e) {
    echo "Fatal Error: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}
