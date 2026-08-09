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
try {
    try {
        $pdoOptions = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
        ];
        $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, $pdoOptions);
        echo "Connected to database '{$dbname}'.\n";
    } catch (PDOException $e) {
        // If DB doesn't exist (SQLSTATE[HY000] [1049] Unknown database)
        $errCode = (int) ($e->errorInfo[1] ?? 0);
        if ($errCode === 1049 || $e->getCode() === 1049 || str_contains($e->getMessage(), 'Unknown database')) {
            echo "Database '{$dbname}' does not exist. Attempting to create it...\n";
            $tempPdo = new PDO("mysql:host={$host};charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
            ]);
            $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            echo "Created database '{$dbname}'.\n";
            
            $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, $pass, $pdoOptions);
        } else {
            throw $e;
        }
    }

    // Check if migrations table exists
    $stmtTable = $pdo->query("SHOW TABLES LIKE 'migrations'");
    $migrationsTableExists = (bool) $stmtTable->fetch();
    $stmtTable->closeCursor();

    if (!$migrationsTableExists) {
        // Create migrations table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        echo "Created 'migrations' tracking table.\n";

        // Check if this is an existing database by checking if 'users' table exists
        $stmtUsers = $pdo->query("SHOW TABLES LIKE 'users'");
        $isExistingDatabase = (bool) $stmtUsers->fetch();
        $stmtUsers->closeCursor();

        if ($isExistingDatabase) {
            echo "Existing database detected. Pre-populating current migrations as applied...\n";
            // Pre-populate with all current files
            $migrationDir = __DIR__ . '/Migrations';
            $files = glob($migrationDir . '/*.sql');
            $stmtInsertMig = $pdo->prepare("INSERT IGNORE INTO migrations (migration_name) VALUES (:name)");
            foreach ($files as $file) {
                $filename = basename($file);
                $stmtInsertMig->execute([':name' => $filename]);
                $stmtInsertMig->closeCursor();
            }
        }
    }

    // Ensure critical tables exist even if migration tracking table was pre-populated on an existing DB
    $stmtDeviceTokens = $pdo->query("SHOW TABLES LIKE 'device_tokens'");
    if (!$stmtDeviceTokens->fetch()) {
        $stmtDeviceTokens->closeCursor();
        $file014 = __DIR__ . '/Migrations/014_create_push_notifications.sql';
        if (file_exists($file014)) {
            $sql014 = file_get_contents($file014);
            $statements014 = array_filter(array_map('trim', explode(';', $sql014)), fn(string $s) => $s !== '');
            foreach ($statements014 as $st) {
                try {
                    $pdo->exec($st);
                } catch (\Exception $e) {
                    // Ignore table/column exists errors
                }
            }
            echo "Created missing 'device_tokens' table.\n";
        }
    } else {
        $stmtDeviceTokens->closeCursor();
    }

    // Fetch all executed migrations
    $stmtMig = $pdo->query("SELECT migration_name FROM migrations");
    $executedMigrations = $stmtMig->fetchAll(PDO::FETCH_COLUMN);
    $stmtMig->closeCursor();

    // Discover and run all migration files in numeric order
    $migrationDir = __DIR__ . '/Migrations';
    $files = glob($migrationDir . '/*.sql');
    natsort($files);

    foreach ($files as $file) {
        $filename = basename($file);
        echo "Running {$filename}...\n";
        
        if (in_array($filename, $executedMigrations, true)) {
            echo "  (skipped — already applied)\n";
            continue;
        }

        $sql = file_get_contents($file);
        if (empty(trim($sql))) {
            echo "  (empty — skipped)\n";
            // Record empty migration as executed
            $stmtInsert = $pdo->prepare("INSERT INTO migrations (migration_name) VALUES (:name)");
            $stmtInsert->execute([':name' => $filename]);
            $stmtInsert->closeCursor();
            continue;
        }

        // Split on semicolons to execute statement by statement
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn(string $s) => $s !== ''
        );

        foreach ($statements as $statement) {
            try {
                $stmt = $pdo->prepare($statement);
                $stmt->execute();
                $stmt->closeCursor();
            } catch (PDOException $e) {
            } catch (PDOException $e) {
                // $e->getCode() is the SQLSTATE string; MySQL-specific error number is in errorInfo[1]
                // Ignorable: 1050 table exists, 1060 duplicate column, 1061 duplicate key name, 1062 duplicate entry
                $mysqlCode = (int) ($e->errorInfo[1] ?? 0);
                $ignorable  = [1050, 1060, 1061, 1062, 1265, 1826, 1091, 1005];
                if (in_array($mysqlCode, $ignorable, true)) {
                    echo "  (skipped — already applied: {$e->getMessage()})\n";
                    continue;
                }
                throw $e;
            }
        }

        // Record execution of the migration
        $stmtInsert = $pdo->prepare("INSERT INTO migrations (migration_name) VALUES (:name)");
        $stmtInsert->execute([':name' => $filename]);

        echo "  ✓ Done\n";
    }

    echo "\nAll migrations completed successfully.\n";

    // Run Vocabulary Seeder
    require_once __DIR__ . '/vocabulary_seeder.php';
    seedVocabulary($pdo);

} catch (Exception $e) {
    echo "\nMigration failed: " . $e->getMessage() . "\n";
    exit(1);
}
