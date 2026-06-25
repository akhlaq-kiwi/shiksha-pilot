<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

$host   = getenv('DB_HOST') ?: 'db';
$dbname = getenv('DB_NAME') ?: 'shiksha_pilot';
$user   = getenv('DB_USER') ?: 'root';
$pass   = getenv('DB_PASS') ?: 'admin123';

echo "=== Shiksha Pilot — Database Migration ===\n\n";

try {
    // Connect without DB name so we can create it if missing
    $pdo = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    echo "Creating database '{$dbname}' if it does not exist...\n";
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    $pdo->exec("USE `{$dbname}`;");

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
