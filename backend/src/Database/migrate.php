<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

// Load .env file from api root (two levels up from this file)
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

ob_implicit_flush(true);
echo "=== Shiksha Pilot — Database Migration ===\n\n";

try {
    $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "Connected to database '{$dbname}'.\n";

    // Discover and run all migration files in numeric order
    $migrationDir = __DIR__ . '/Migrations';
    $files = glob($migrationDir . '/*.sql');
    natsort($files);

    foreach ($files as $file) {
        $filename = basename($file);
        echo "Running {$filename}...\n";

        $sql = file_get_contents($file);
        if (empty(trim($sql))) {
            echo "  (empty — skipped)\n";
            continue;
        }

        // Split on semicolons to execute statement by statement
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn(string $s) => $s !== ''
        );

        foreach ($statements as $statement) {
            try {
                $pdo->exec($statement);
            } catch (PDOException $e) {
                // $e->getCode() is the SQLSTATE string; MySQL-specific error number is in errorInfo[1]
                // Ignorable: 1050 table exists, 1060 duplicate column, 1061 duplicate key name, 1062 duplicate entry
                $mysqlCode = (int) ($e->errorInfo[1] ?? 0);
                $ignorable  = [1050, 1060, 1061, 1062];
                if (in_array($mysqlCode, $ignorable, true)) {
                    echo "  (skipped — already applied: {$e->getMessage()})\n";
                    continue;
                }
                throw $e;
            }
        }

        echo "  ✓ Done\n";
    }

    echo "\nAll migrations completed successfully.\n";

} catch (Exception $e) {
    echo "\nMigration failed: " . $e->getMessage() . "\n";
    exit(1);
}
