<?php

declare(strict_types=1);

require __DIR__ . '/../../vendor/autoload.php';

use App\Database\Connection;

$host = getenv('DB_HOST') ?: 'db';
$dbname = getenv('DB_NAME') ?: 'bn_school_sp';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: 'admin123';

echo "Starting database migration...\n";

try {
    // 1. Connect without db name to create it if missing
    $dsn = "mysql:host={$host};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    echo "Creating database {$dbname} if it does not exist...\n";
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    $pdo->exec("USE `{$dbname}`;");

    // 2. Load and run Migration SQL
    $sqlFile = __DIR__ . '/Migrations/001_initial_schema.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("Migration file not found at {$sqlFile}");
    }

    $queries = file_get_contents($sqlFile);
    echo "Running migration queries...\n";
    $pdo->exec($queries);

    // 3. Seed Default Super Admin User
    $phone = '9876543210';
    $checkUser = $pdo->prepare("SELECT id FROM users WHERE phone = :phone");
    $checkUser->execute(['phone' => $phone]);
    
    if (!$checkUser->fetch()) {
        echo "Seeding default Super Admin user...\n";
        $passwordHash = password_hash('admin', PASSWORD_BCRYPT);
        $insert = $pdo->prepare("
            INSERT INTO users (phone, password, role, name, status) 
            VALUES (:phone, :password, 'SUPER_ADMIN', 'Sarah Connor', 'ACTIVE')
        ");
        $insert->execute([
            'phone' => $phone,
            'password' => $passwordHash
        ]);
        echo "Super Admin seeded successfully. Phone: {$phone}, Password: admin\n";
    } else {
        echo "Super Admin already exists.\n";
    }

    echo "Migration completed successfully!\n";

} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
