<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../vendor/autoload.php';

date_default_timezone_set('Asia/Kolkata');

// Helper to load local environment configuration
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        putenv(sprintf('%s=%s', $name, $value));
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}
loadEnv(__DIR__ . '/../.env');

$container = App\Bootstrap\Container::build();
AppFactory::setContainer($container);
$app = AppFactory::create();

// Register modular routes
App\Bootstrap\Routes::register($app);

// Global Configuration
$db_host = getenv('DB_HOST') ?: '127.0.0.1';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') ?: 'admin123';
$db_name = getenv('DB_NAME') ?: 'bn_school_sp';
$jwt_secret = getenv('JWT_SECRET') ?: 'super_secret_erp_key_2026';

// Database Connection Helper
function getDb() {
    global $db_host, $db_user, $db_pass, $db_name;
    static $pdo = null;
    static $connectionFailed = false;
    
    if ($pdo !== null) {
        return $pdo;
    }
    if ($connectionFailed) {
        throw new \Exception("Database connection previously failed.");
    }
    
    try {
        $pdo = new PDO("mysql:host=$db_host;charset=utf8mb4", $db_user, $db_pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Auto create database if not exists
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db_name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$db_name`");
        
        // Auto migrate tables
        migrateDb($pdo);
        seedDb($pdo);
        
        return $pdo;
    } catch (\PDOException $e) {
        $connectionFailed = true;
        throw new \Exception("Database connection failed: " . $e->getMessage());
    }
}

// Check if a transaction's datetime is locked by a generated financial report
function isTransactionLocked($pdo, $schoolId, $timestamp) {
    if (empty($timestamp)) {
        return false;
    }
    try {
        $txDate = substr($timestamp, 0, 10);
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM financial_reports 
                               WHERE school_id = :school_id 
                                 AND (
                                   (from_timestamp IS NOT NULL AND to_timestamp IS NOT NULL AND :timestamp >= from_timestamp AND :timestamp <= to_timestamp)
                                   OR
                                   ((from_timestamp IS NULL OR to_timestamp IS NULL) AND :tx_date >= from_date AND :tx_date <= to_date)
                                 )");
        $stmt->execute([
            'school_id' => $schoolId,
            'timestamp' => $timestamp,
            'tx_date' => $txDate
        ]);
        return ((int)$stmt->fetchColumn() > 0);
    } catch (\Exception $e) {
        return false;
    }
}

// Check if an extra fee type is locked by any paid student fee inside a finalized report
function isExtraFeeTypeLocked($pdo, $schoolId, $typeId) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM student_extra_fees sef
                                JOIN financial_reports rep ON sef.school_id = rep.school_id
                                WHERE sef.extra_fee_type_id = :type_id
                                  AND sef.school_id = :school_id
                                  AND sef.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND sef.paid_at >= rep.from_timestamp AND sef.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(sef.paid_at AS DATE) >= rep.from_date AND CAST(sef.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute([
            'type_id' => $typeId,
            'school_id' => $schoolId
        ]);
        return ((int)$stmt->fetchColumn() > 0);
    } catch (\Exception $e) {
        return false;
    }
}

// Check if a student is locked because of paid fees/extra fees inside a finalized report
function isStudentLocked($pdo, $schoolId, $studentId) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records fr
                                JOIN financial_reports rep ON fr.school_id = rep.school_id
                                WHERE fr.student_id = :student_id
                                  AND fr.school_id = :school_id
                                  AND fr.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND fr.paid_at >= rep.from_timestamp AND fr.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(fr.paid_at AS DATE) >= rep.from_date AND CAST(fr.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        if ((int)$stmt->fetchColumn() > 0) return true;

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM student_extra_fees sef
                                JOIN financial_reports rep ON sef.school_id = rep.school_id
                                WHERE sef.student_id = :student_id
                                  AND sef.school_id = :school_id
                                  AND sef.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND sef.paid_at >= rep.from_timestamp AND sef.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(sef.paid_at AS DATE) >= rep.from_date AND CAST(sef.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        if ((int)$stmt->fetchColumn() > 0) return true;

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM previous_year_recoveries pyr
                                JOIN financial_reports rep ON pyr.school_id = rep.school_id
                                WHERE pyr.student_id = :student_id
                                  AND pyr.school_id = :school_id
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND pyr.paid_at >= rep.from_timestamp AND pyr.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(pyr.paid_at AS DATE) >= rep.from_date AND CAST(pyr.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['student_id' => $studentId, 'school_id' => $schoolId]);
        if ((int)$stmt->fetchColumn() > 0) return true;

        return false;

    } catch (\Exception $e) {
        return false;
    }
}

// Check if a teacher is locked because of paid salary inside a finalized report
function isTeacherLocked($pdo, $schoolId, $teacherId) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM salary_records sr
                                JOIN financial_reports rep ON sr.school_id = rep.school_id
                                WHERE sr.teacher_id = :teacher_id
                                  AND sr.school_id = :school_id
                                  AND sr.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND sr.paid_at >= rep.from_timestamp AND sr.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(sr.paid_at AS DATE) >= rep.from_date AND CAST(sr.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['teacher_id' => $teacherId, 'school_id' => $schoolId]);
        return ((int)$stmt->fetchColumn() > 0);
    } catch (\Exception $e) {
        return false;
    }
}

// Check if a classroom is locked because of any student's paid fees inside a finalized report
function isClassroomLocked($pdo, $schoolId, $classId) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records fr
                                JOIN students s ON fr.student_id = s.id
                                JOIN financial_reports rep ON fr.school_id = rep.school_id
                                WHERE s.class_id = :class_id
                                  AND fr.school_id = :school_id
                                  AND fr.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND fr.paid_at >= rep.from_timestamp AND fr.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(fr.paid_at AS DATE) >= rep.from_date AND CAST(fr.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['class_id' => $classId, 'school_id' => $schoolId]);
        if ((int)$stmt->fetchColumn() > 0) return true;

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM student_extra_fees sef
                                JOIN students s ON sef.student_id = s.id
                                JOIN financial_reports rep ON sef.school_id = rep.school_id
                                WHERE s.class_id = :class_id
                                  AND sef.school_id = :school_id
                                  AND sef.status = 'Paid'
                                  AND (
                                    (rep.from_timestamp IS NOT NULL AND rep.to_timestamp IS NOT NULL AND sef.paid_at >= rep.from_timestamp AND sef.paid_at <= rep.to_timestamp)
                                    OR
                                    ((rep.from_timestamp IS NULL OR rep.to_timestamp IS NULL) AND CAST(sef.paid_at AS DATE) >= rep.from_date AND CAST(sef.paid_at AS DATE) <= rep.to_date)
                                  )");
        $stmt->execute(['class_id' => $classId, 'school_id' => $schoolId]);
        return ((int)$stmt->fetchColumn() > 0);
    } catch (\Exception $e) {
        return false;
    }
}

function encryptPassword($password) {
    global $jwt_secret;
    $method = 'aes-256-cbc';
    $iv_length = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($iv_length);
    $ciphertext = openssl_encrypt($password, $method, $jwt_secret, 0, $iv);
    return base64_encode($iv . $ciphertext);
}

function decryptPassword($encrypted) {
    global $jwt_secret;
    if (empty($encrypted)) return '';
    $method = 'aes-256-cbc';
    $data = base64_decode($encrypted);
    $iv_length = openssl_cipher_iv_length($method);
    if (strlen($data) < $iv_length) return '';
    $iv = substr($data, 0, $iv_length);
    $ciphertext = substr($data, $iv_length);
    return openssl_decrypt($ciphertext, $method, $jwt_secret, 0, $iv) ?: '';
}

class OtpService {
    public static function generateAndSend($phone, $pdo) {
        $otp = '1234'; // Mock OTP - future providers can be integrated here
        if ($pdo === null) {
            return true;
        }
        $expiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        $stmt = $pdo->prepare("INSERT INTO phone_otps (phone, otp, expiry) VALUES (:phone, :otp, :expiry)
                               ON DUPLICATE KEY UPDATE otp = :otp, expiry = :expiry");
        $stmt->execute(['phone' => $phone, 'otp' => $otp, 'expiry' => $expiry]);
        return true;
    }
    
    public static function verify($phone, $otp, $pdo) {
        if ($pdo === null) {
            return $otp === '1234';
        }
        $now = date('Y-m-d H:i:s');
        try {
            $delExpired = $pdo->prepare("DELETE FROM phone_otps WHERE expiry < :now");
            $delExpired->execute(['now' => $now]);
        } catch (\Exception $e) {}

        $stmt = $pdo->prepare("SELECT * FROM phone_otps WHERE phone = :phone AND otp = :otp AND expiry >= :now LIMIT 1");
        $stmt->execute(['phone' => $phone, 'otp' => $otp, 'now' => $now]);
        $record = $stmt->fetch();
        if ($record) {
            $del = $pdo->prepare("DELETE FROM phone_otps WHERE phone = :phone");
            $del->execute(['phone' => $phone]);
            return true;
        }
        return false;
    }
}

// Database Schema Migrations
function migrateDb($pdo) {
    try {
        $pdo->query("SELECT schedule_date FROM class_schedules LIMIT 1");
    } catch (\Exception $e) {
        $pdo->exec("DROP TABLE IF EXISTS class_schedules");
    }

    $schema = "
    CREATE TABLE IF NOT EXISTS schools (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        address TEXT NULL,
        status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending',
        logo_path TEXT DEFAULT NULL,
        subscription_start DATE NOT NULL,
        subscription_end DATE NOT NULL,
        setup_completed TINYINT(1) DEFAULT 0,
        school_start_time VARCHAR(10) DEFAULT '08:00 AM',
        period_duration INT DEFAULT 40,
        interval_duration INT DEFAULT 20,
        interval_after_period INT DEFAULT 4,
        total_periods INT DEFAULT 8,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT DEFAULT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('Super Admin', 'School Admin') NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS invitations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        code VARCHAR(100) UNIQUE NOT NULL,
        status ENUM('Pending', 'Accepted') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS academic_years (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        year_range VARCHAR(50) NOT NULL,
        is_active TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS classrooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        room VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
        subject VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        qualification VARCHAR(255) DEFAULT NULL,
        experience VARCHAR(50) DEFAULT NULL,
        aadhaar_number VARCHAR(50) DEFAULT NULL,
        pan_number VARCHAR(50) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        joining_date DATE DEFAULT NULL,
        exit_date DATE DEFAULT NULL,
        salary_amount DECIMAL(10,2) NOT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        profile_image LONGTEXT DEFAULT NULL,
        documents LONGTEXT DEFAULT NULL,
        attendance_summary VARCHAR(255) DEFAULT '100% Avg',
        assigned_classes VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        class_id INT NOT NULL,
        group_name VARCHAR(255) DEFAULT NULL,
        gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
        name VARCHAR(255) NOT NULL,
        roll_number VARCHAR(50) NOT NULL,
        sr_no VARCHAR(100) DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        country VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        father_name VARCHAR(255) DEFAULT NULL,
        mother_name VARCHAR(255) DEFAULT NULL,
        address TEXT DEFAULT NULL,
        date_of_birth DATE DEFAULT NULL,
        admission_date DATE DEFAULT NULL,
        exit_date DATE DEFAULT NULL,
        emergency_contact VARCHAR(50) DEFAULT NULL,
        blood_group VARCHAR(10) DEFAULT 'O+',
        aadhaar_number VARCHAR(50) DEFAULT NULL,
        nationality VARCHAR(100) DEFAULT 'Indian',
        caste VARCHAR(100) DEFAULT NULL,
        profile_image LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS fee_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        student_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        month VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('Paid', 'Pending') DEFAULT 'Pending',
        due_date DATE NOT NULL,
        payment_date DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS salary_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        teacher_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        month VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('Paid', 'Pending') DEFAULT 'Pending',
        payment_date DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        timestamp VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT DEFAULT NULL,
        operator VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        timestamp VARCHAR(50) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY school_subject_name (school_id, name),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS class_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        class_id INT NOT NULL,
        day_of_week VARCHAR(50) NOT NULL,
        schedule_date DATE NOT NULL,
        week_start_date DATE NOT NULL,
        subjects TEXT NOT NULL,
        status ENUM('Draft', 'Scheduled', 'Published', 'Archived') DEFAULT 'Draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY school_class_date (school_id, academic_year_id, class_id, schedule_date),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS class_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        class_id INT NOT NULL,
        fee_structure TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE KEY uq_class_year (school_id, academic_year_id, class_id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS financial_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        `from_date` DATE NOT NULL,
        `to_date` DATE NOT NULL,
        fees_collected DECIMAL(10,2) NOT NULL,
        extra_fees_collected DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        salaries_paid DECIMAL(10,2) NOT NULL,
        school_expenses DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        net_profit DECIMAL(10,2) NOT NULL,
        settlement_status ENUM('Pending', 'Settled') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS school_expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        expense_date DATE NOT NULL,
        expense_time TIME NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS extra_fee_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS student_extra_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        student_id INT NOT NULL,
        extra_fee_type_id INT NOT NULL,
        status ENUM('Pending', 'Paid') DEFAULT 'Pending',
        payment_date DATE DEFAULT NULL,
        collected_by VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (extra_fee_type_id) REFERENCES extra_fee_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS payment_promises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        student_id INT NOT NULL,
        promise_date DATE NOT NULL,
        description TEXT NOT NULL,
        status ENUM('Pending', 'Fulfilled') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS carry_forward_dues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        student_id INT NOT NULL,
        original_academic_year_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('Pending', 'Paid') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (original_academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS previous_year_recoveries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        student_id INT NOT NULL,
        academic_year_id INT DEFAULT NULL,
        carry_forward_due_id INT NOT NULL,
        amount_recovered DECIMAL(10,2) NOT NULL,
        recovery_date DATE NOT NULL,
        paid_at DATETIME NOT NULL,
        collected_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
        FOREIGN KEY (carry_forward_due_id) REFERENCES carry_forward_dues(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS student_attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        class_id INT NOT NULL,
        student_id INT NOT NULL,
        attendance_date DATE NOT NULL,
        status ENUM('Present', 'Absent', 'Leave') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY uq_attendance (student_id, attendance_date)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS school_leaves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        leave_date DATE NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        UNIQUE KEY uq_school_leave (school_id, academic_year_id, leave_date)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        class_id INT NOT NULL,
        group_name VARCHAR(255) DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classrooms(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exam_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        subject_name VARCHAR(255) NOT NULL,
        max_marks INT NOT NULL DEFAULT 100,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exam_marks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        student_id INT NOT NULL,
        subject_name VARCHAR(255) NOT NULL,
        marks_obtained DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY uq_student_exam_subject (student_id, exam_id, subject_name)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS school_signatures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        teacher_signature LONGTEXT DEFAULT NULL,
        class_teacher_signature LONGTEXT DEFAULT NULL,
        principal_signature LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        UNIQUE KEY uq_school_sig (school_id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS report_card_remarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        academic_year_id INT NOT NULL,
        exam_id INT DEFAULT NULL,
        student_id INT NOT NULL,
        remarks TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY uq_student_exam_remark (student_id, exam_id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS grading_scales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        school_id INT NOT NULL,
        grade_name VARCHAR(10) NOT NULL,
        min_percentage DECIMAL(5,2) NOT NULL,
        max_percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        UNIQUE KEY uq_school_grade (school_id, grade_name)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS phone_otps (
        phone VARCHAR(50) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expiry DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
    ";
    
    $pdo->exec($schema);

    // Check and add columns to school_leaves
    $q = $pdo->query("SHOW COLUMNS FROM school_leaves LIKE 'title'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE school_leaves ADD COLUMN title VARCHAR(255) NOT NULL AFTER academic_year_id");
    }
    $q = $pdo->query("SHOW COLUMNS FROM school_leaves LIKE 'category'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE school_leaves ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'School Holiday' AFTER title");
    }
    $pdo->exec("ALTER TABLE school_leaves MODIFY COLUMN description VARCHAR(255) DEFAULT NULL");

    // Check and add columns to financial_reports table if they don't exist
    $q = $pdo->query("SHOW COLUMNS FROM financial_reports LIKE 'extra_fees_collected'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN extra_fees_collected DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER fees_collected");
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN school_expenses DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER salaries_paid");
    }
    
    $q = $pdo->query("SHOW COLUMNS FROM financial_reports LIKE 'from_timestamp'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN from_timestamp DATETIME DEFAULT NULL AFTER `to_date`");
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN to_timestamp DATETIME DEFAULT NULL AFTER from_timestamp");
    }

    $q = $pdo->query("SHOW COLUMNS FROM financial_reports LIKE 'previous_year_recovery'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN previous_year_recovery DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER extra_fees_collected");
    }
    $q = $pdo->query("SHOW COLUMNS FROM financial_reports LIKE 'previous_year_recovery_details'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE financial_reports ADD COLUMN previous_year_recovery_details TEXT DEFAULT NULL AFTER previous_year_recovery");
    }

    $q = $pdo->query("SHOW COLUMNS FROM fee_records LIKE 'paid_at'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE fee_records ADD COLUMN paid_at DATETIME DEFAULT NULL AFTER payment_date");
        $pdo->exec("UPDATE fee_records SET paid_at = CONCAT(payment_date, ' 12:00:00') WHERE status = 'Paid' AND paid_at IS NULL");
    }

    $q = $pdo->query("SHOW COLUMNS FROM salary_records LIKE 'paid_at'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE salary_records ADD COLUMN paid_at DATETIME DEFAULT NULL AFTER payment_date");
        $pdo->exec("UPDATE salary_records SET paid_at = CONCAT(payment_date, ' 12:00:00') WHERE status = 'Paid' AND paid_at IS NULL");
    }

    $q = $pdo->query("SHOW COLUMNS FROM student_extra_fees LIKE 'paid_at'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE student_extra_fees ADD COLUMN paid_at DATETIME DEFAULT NULL AFTER payment_date");
        $pdo->exec("UPDATE student_extra_fees SET paid_at = CONCAT(payment_date, ' 12:00:00') WHERE status = 'Paid' AND paid_at IS NULL");
    }

    // Check and add columns to previous_year_recoveries
    $q = $pdo->query("SHOW COLUMNS FROM previous_year_recoveries LIKE 'academic_year_id'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE previous_year_recoveries ADD COLUMN academic_year_id INT DEFAULT NULL AFTER student_id");
        $pdo->exec("ALTER TABLE previous_year_recoveries ADD CONSTRAINT fk_pyr_ay FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL");
        
        // Backfill existing records:
        $pdo->exec("UPDATE previous_year_recoveries pyr
                    JOIN students s ON pyr.student_id = s.id
                    SET pyr.academic_year_id = s.academic_year_id
                    WHERE pyr.academic_year_id IS NULL");
    }
    
    // Check and add columns to academic_years table
    $q = $pdo->query("SHOW COLUMNS FROM academic_years LIKE 'start_date'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE academic_years ADD COLUMN start_date DATE DEFAULT NULL AFTER year_range");
        $pdo->exec("ALTER TABLE academic_years ADD COLUMN end_date DATE DEFAULT NULL AFTER start_date");
        $pdo->exec("ALTER TABLE academic_years ADD COLUMN description TEXT DEFAULT NULL AFTER end_date");
        $pdo->exec("ALTER TABLE academic_years ADD COLUMN status ENUM('Draft', 'Active', 'Archived') DEFAULT 'Draft' AFTER description");
        // Seed initial metadata for existing rows
        $pdo->exec("UPDATE academic_years SET status = 'Active' WHERE is_active = 1");
        $pdo->exec("UPDATE academic_years SET status = 'Archived' WHERE is_active = 0");
        $pdo->exec("UPDATE academic_years SET start_date = '2025-04-01', end_date = '2026-03-31' WHERE year_range = '2025-2026'");
        $pdo->exec("UPDATE academic_years SET start_date = '2024-04-01', end_date = '2025-03-31' WHERE year_range = '2024-2025'");
    }

    $q = $pdo->query("SHOW COLUMNS FROM academic_years LIKE 'fee_structure'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE academic_years ADD COLUMN fee_structure TEXT DEFAULT NULL AFTER status");
        $defaultJson = json_encode([
            "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0, 
            "September" => 0, "October" => 0, "November" => 0, "December" => 0, 
            "January" => 0, "February" => 0, "March" => 0
        ]);
        $stmt = $pdo->prepare("UPDATE academic_years SET fee_structure = :df");
        $stmt->execute(['df' => $defaultJson]);
    }

    // Check if is_locked column exists in class_fees table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM class_fees LIKE 'is_locked'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE class_fees ADD COLUMN is_locked TINYINT(1) DEFAULT 0 AFTER fee_structure");
    }

    // Modify status column in students table to support Alumni status
    try {
        $pdo->exec("ALTER TABLE students MODIFY COLUMN status ENUM('Active', 'Inactive', 'Alumni') DEFAULT 'Active'");
    } catch (\Exception $e) {}
    
    // Check if group_name column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'group_name'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN group_name VARCHAR(255) DEFAULT NULL AFTER class_id");
    }

    // Check if gender column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'gender'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male' AFTER name");
    }

    // Check if country column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'country'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN country VARCHAR(100) DEFAULT NULL AFTER email");
    }

    // Check if state column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'state'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN state VARCHAR(100) DEFAULT NULL AFTER country");
    }

    // Check if city column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'city'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER state");
    }

    // Check if sr_no column exists in students table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'sr_no'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN sr_no VARCHAR(100) DEFAULT NULL AFTER roll_number");
    }

    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'nationality'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN nationality VARCHAR(100) DEFAULT 'Indian' AFTER aadhaar_number");
    }

    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'caste'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN caste VARCHAR(100) DEFAULT NULL AFTER nationality");
    }

    // Modify profile_image to LONGTEXT
    $pdo->exec("ALTER TABLE students MODIFY COLUMN profile_image LONGTEXT DEFAULT NULL");

    // Clean up old foreign key constraint and group_id if they exist
    try {
        $pdo->exec("ALTER TABLE students DROP FOREIGN KEY fk_students_group");
    } catch (\Exception $e) {}

    $qId = $pdo->query("SHOW COLUMNS FROM students LIKE 'group_id'");
    if ($qId->rowCount() > 0) {
        try {
            $pdo->exec("ALTER TABLE students DROP COLUMN group_id");
        } catch (\Exception $e) {}
    }

    // Clean up student_groups table if exists
    $pdo->exec("DROP TABLE IF EXISTS student_groups");

    // Check if reset_otp column exists in users table, if not, add it
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'reset_otp'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN reset_otp VARCHAR(10) DEFAULT NULL AFTER is_active, ADD COLUMN reset_otp_expiry DATETIME DEFAULT NULL AFTER reset_otp");
    }

    // Modify status column in schools to support 'Pending' status
    try {
        $pdo->exec("ALTER TABLE schools MODIFY COLUMN status ENUM('Pending', 'Active', 'Inactive') DEFAULT 'Pending'");
    } catch (\Exception $e) {}

    // Modify logo_path column in schools to support long inline SVG data URIs
    try {
        $pdo->exec("ALTER TABLE schools MODIFY COLUMN logo_path TEXT DEFAULT NULL");
    } catch (\Exception $e) {}

    // Check and add missing columns to teachers table
    $q = $pdo->query("SHOW COLUMNS FROM teachers LIKE 'gender'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE teachers ADD COLUMN gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male' AFTER name");
    }
    $q = $pdo->query("SHOW COLUMNS FROM teachers LIKE 'aadhaar_number'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE teachers ADD COLUMN aadhaar_number VARCHAR(50) DEFAULT NULL AFTER experience");
    }
    $q = $pdo->query("SHOW COLUMNS FROM teachers LIKE 'pan_number'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE teachers ADD COLUMN pan_number VARCHAR(50) DEFAULT NULL AFTER aadhaar_number");
    }
    $q = $pdo->query("SHOW COLUMNS FROM teachers LIKE 'exit_date'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE teachers ADD COLUMN exit_date DATE DEFAULT NULL AFTER joining_date");
    }
    $q = $pdo->query("SHOW COLUMNS FROM teachers LIKE 'documents'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE teachers ADD COLUMN documents LONGTEXT DEFAULT NULL AFTER profile_image");
    }
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'documents'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN documents LONGTEXT DEFAULT NULL AFTER profile_image");
    }
    $q = $pdo->query("SHOW COLUMNS FROM students LIKE 'exit_date'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE students ADD COLUMN exit_date DATE DEFAULT NULL AFTER admission_date");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'currency'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN currency VARCHAR(10) DEFAULT 'INR'");
    } else {
        $pdo->exec("UPDATE schools SET currency = 'INR' WHERE currency = 'USD'");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'school_start_time'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN school_start_time VARCHAR(10) DEFAULT '08:00 AM'");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'period_duration'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN period_duration INT DEFAULT 40");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'interval_duration'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN interval_duration INT DEFAULT 20");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'interval_after_period'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN interval_after_period INT DEFAULT 4");
    }
    $q = $pdo->query("SHOW COLUMNS FROM schools LIKE 'total_periods'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE schools ADD COLUMN total_periods INT DEFAULT 8");
    }
    
    // Check and add missing columns to users table
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'name'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN name VARCHAR(255) DEFAULT 'Administrator'");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'phone'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'plain_encrypted'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN plain_encrypted VARCHAR(500) DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'address'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN address TEXT DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'city'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN city VARCHAR(100) DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'state'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN state VARCHAR(100) DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'country'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN country VARCHAR(100) DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'timezone'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN timezone VARCHAR(100) DEFAULT 'Asia/Kolkata'");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'profile_image'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN profile_image LONGTEXT DEFAULT NULL");
    }
    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'last_login_at'");
    if ($q->rowCount() == 0) {
        $pdo->exec("ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL");
    }

    // Check and create whatsapp_delivery_logs table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS whatsapp_delivery_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT NOT NULL,
            student_id INT NOT NULL,
            student_name VARCHAR(255) NOT NULL,
            class_id INT NOT NULL,
            recipient_number VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            message_content TEXT NOT NULL,
            date_sent VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    // Check and create subscription tables
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            duration_days INT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            is_active TINYINT(1) DEFAULT 1,
            description TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS school_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT NOT NULL,
            plan_id INT NOT NULL,
            start_date DATE NOT NULL,
            expiry_date DATE NOT NULL,
            remaining_days INT NOT NULL,
            status ENUM('Active', 'Expiring Soon', 'Expired', 'Trial Active', 'Trial Expired') NOT NULL,
            email_reminder_3 TINYINT(1) DEFAULT 0,
            email_reminder_1 TINYINT(1) DEFAULT 0,
            email_reminder_expired TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
            FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS trial_usage_registry (
            email VARCHAR(255) PRIMARY KEY,
            trial_used TINYINT(1) DEFAULT 1,
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS subscription_audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action VARCHAR(50) NOT NULL,
            performed_by VARCHAR(255) NOT NULL,
            school_name VARCHAR(255) NOT NULL,
            plan_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    // Ensure columns exist on existing databases
    try {
        $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN IF NOT EXISTS email_reminder_3 TINYINT(1) DEFAULT 0");
        $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN IF NOT EXISTS email_reminder_1 TINYINT(1) DEFAULT 0");
        $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN IF NOT EXISTS email_reminder_expired TINYINT(1) DEFAULT 0");
    } catch (\Exception $e) {
        // Fallback for drivers/DBs that do not support IF NOT EXISTS in ALTER TABLE
        try { $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN email_reminder_3 TINYINT(1) DEFAULT 0"); } catch (\Exception $ex) {}
        try { $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN email_reminder_1 TINYINT(1) DEFAULT 0"); } catch (\Exception $ex) {}
        try { $pdo->exec("ALTER TABLE school_subscriptions ADD COLUMN email_reminder_expired TINYINT(1) DEFAULT 0"); } catch (\Exception $ex) {}
    }

    // Role, Permission, and Parent Portal Migrations
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT DEFAULT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_school_role (school_id, name)
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INT NOT NULL,
            permission_name VARCHAR(100) NOT NULL,
            PRIMARY KEY (role_id, permission_name),
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS parent_student_mappings (
            parent_user_id INT NOT NULL,
            student_id INT NOT NULL,
            PRIMARY KEY (parent_user_id, student_id),
            FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        ) ENGINE=InnoDB;
    ");

    // Modify users table
    try {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL");
    } catch (\Exception $e) {}

    try {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(100) NOT NULL");
    } catch (\Exception $e) {}

    $q = $pdo->query("SHOW COLUMNS FROM users LIKE 'role_id'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN role_id INT DEFAULT NULL AFTER role");
        } catch (\Exception $e) {}
    }

    // Add class_teacher_id to classrooms
    $q = $pdo->query("SHOW COLUMNS FROM classrooms LIKE 'class_teacher_id'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE classrooms ADD COLUMN class_teacher_id INT DEFAULT NULL AFTER room");
            $pdo->exec("ALTER TABLE classrooms ADD CONSTRAINT fk_classrooms_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL");
        } catch (\Exception $e) {}
    }
    $q = $pdo->query("SHOW COLUMNS FROM classrooms LIKE 'class_teacher_assigned_at'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE classrooms ADD COLUMN class_teacher_assigned_at DATE DEFAULT NULL AFTER class_teacher_id");
        } catch (\Exception $e) {}
    }

    // Modify notifications table
    $q = $pdo->query("SHOW COLUMNS FROM notifications LIKE 'target_class_id'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE notifications ADD COLUMN target_class_id INT DEFAULT NULL AFTER is_read");
        } catch (\Exception $e) {}
    }
    $q = $pdo->query("SHOW COLUMNS FROM notifications LIKE 'target_user_id'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE notifications ADD COLUMN target_user_id INT DEFAULT NULL AFTER target_class_id");
        } catch (\Exception $e) {}
    }

    // Seed default roles and permissions
    $defaultRoles = [
        'School Admin' => ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
        'Class Teacher' => ['attendance', 'performance'],
        'Parent' => ['parent_portal']
    ];
    
    foreach ($defaultRoles as $rName => $perms) {
        $stmt = $pdo->prepare("SELECT id FROM roles WHERE school_id IS NULL AND name = :name LIMIT 1");
        $stmt->execute(['name' => $rName]);
        $rId = $stmt->fetchColumn();
        
        if (!$rId) {
            $ins = $pdo->prepare("INSERT INTO roles (school_id, name) VALUES (NULL, :name)");
            $ins->execute(['name' => $rName]);
            $rId = $pdo->lastInsertId();
        }
        
        foreach ($perms as $p) {
            $stmt = $pdo->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_name) VALUES (:rid, :pname)");
            $stmt->execute(['rid' => $rId, 'pname' => $p]);
        }
    }

    // Examination module redesign migrations
    $q = $pdo->query("SHOW COLUMNS FROM exams LIKE 'status'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE exams ADD COLUMN description TEXT DEFAULT NULL AFTER name");
            $pdo->exec("ALTER TABLE exams ADD COLUMN status ENUM('Draft', 'Published') DEFAULT 'Draft' AFTER description");
        } catch (\Exception $e) {}
    }

    // Add published_at column to exams table if it doesn't exist
    $q = $pdo->query("SHOW COLUMNS FROM exams LIKE 'published_at'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE exams ADD COLUMN published_at DATETIME DEFAULT NULL AFTER status");
        } catch (\Exception $e) {}
    }

    $q = $pdo->query("SHOW COLUMNS FROM exam_subjects LIKE 'exam_date'");
    if ($q->rowCount() == 0) {
        try {
            $pdo->exec("ALTER TABLE exam_subjects ADD COLUMN exam_date DATE DEFAULT NULL");
            $pdo->exec("ALTER TABLE exam_subjects ADD COLUMN start_time VARCHAR(50) DEFAULT NULL");
            $pdo->exec("ALTER TABLE exam_subjects ADD COLUMN end_time VARCHAR(50) DEFAULT NULL");
            $pdo->exec("ALTER TABLE exam_subjects ADD COLUMN instructions TEXT DEFAULT NULL");
        } catch (\Exception $e) {}
    }
}

function seedDb($pdo) {
    // Legacy password migrations (only run once to avoid performance issues from expensive BCRYPT verify calls)
    $migrationLockFile = __DIR__ . '/../passwords_migrated.lock';
    if (!file_exists($migrationLockFile)) {
        $knownPasswords = ['Bilal@123', 'Admin@123', 'School@123', 'Test@123', 'School@12345', 'Admin@12345', 'Test@12345'];
        
        // 1. Migrate mock_users.json passwords to bcrypt(sha256(plain))
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            $updated = false;
            foreach ($mockUsers as &$u) {
                foreach ($knownPasswords as $kp) {
                    if (password_verify($kp, $u['password'])) {
                        $u['password'] = password_hash(hash('sha256', $kp), PASSWORD_BCRYPT);
                        $updated = true;
                        break;
                    }
                }
            }
            if ($updated) {
                file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
            }
        }

        // 2. Migrate existing DB users' legacy passwords to bcrypt(sha256(plain))
        try {
            $usersStmt = $pdo->query("SELECT id, password FROM users");
            $dbUsers = $usersStmt->fetchAll(PDO::FETCH_ASSOC);
            $migrateStmt = $pdo->prepare("UPDATE users SET password = :password WHERE id = :id");
            foreach ($dbUsers as $u) {
                foreach ($knownPasswords as $kp) {
                    if (password_verify($kp, $u['password'])) {
                        $secureHash = password_hash(hash('sha256', $kp), PASSWORD_BCRYPT);
                        $migrateStmt->execute(['password' => $secureHash, 'id' => $u['id']]);
                        break;
                    }
                }
            }
            // Create lock file to avoid running this expensive migration on every request
            file_put_contents($migrationLockFile, 'migrated');
        } catch (\Exception $e) {
            // Avoid breaking database initialization/migrations
        }
    }

    // Seed default Super Admin
    $hashedSuper = password_hash(hash('sha256', 'Bilal@123'), PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("SELECT password FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => 'Bilal@yopmail.com']);
    $existingSuperPassword = $stmt->fetchColumn();
    if ($existingSuperPassword === false) {
        $stmt = $pdo->prepare("INSERT INTO users (email, password, role, is_active, name) VALUES (:email, :password, 'Super Admin', 1, 'Bilal Ahmed')");
        $stmt->execute([
            'email' => 'Bilal@yopmail.com',
            'password' => $hashedSuper
        ]);
        
        // Log Super Admin account generation
        $logStmt = $pdo->prepare("INSERT INTO audit_logs (operator, action, timestamp, details) VALUES ('System', 'Platform Init', NOW(), 'Seeded Super Admin Account Bilal@yopmail.com')");
        $logStmt->execute();
    } else {
        if (!file_exists($migrationLockFile) && password_verify('Bilal@123', $existingSuperPassword)) {
            $stmt = $pdo->prepare("UPDATE users SET password = :password, name = 'Bilal Ahmed' WHERE email = 'Bilal@yopmail.com'");
            $stmt->execute(['password' => $hashedSuper]);
        }
    }

    // Seed default School
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM schools WHERE id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $stmt = $pdo->prepare("INSERT INTO schools (id, name, code, contact_person, contact_number, email, status, subscription_start, subscription_end, setup_completed) VALUES (1, 'St. Xavier''s International School', 'SCH-981763', 'Fr. Thomas Matthews', '+1 (555) 019-8833', 'xavier.admin@xavier.edu', 'Active', '2026-04-01', '2027-03-31', 1)");
        $stmt->execute();
    }

    // Seed default School Admin User
    $hashedAdmin = password_hash(hash('sha256', 'Admin@123'), PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("SELECT password FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => 'Admin@yopmail.com']);
    $existingAdminPassword = $stmt->fetchColumn();
    if ($existingAdminPassword === false) {
        $stmt = $pdo->prepare("INSERT INTO users (school_id, email, password, role, is_active, name) VALUES (1, :email, :password, 'School Admin', 1, 'School Admin')");
        $stmt->execute([
            'email' => 'Admin@yopmail.com',
            'password' => $hashedAdmin
        ]);
    } else {
        if (!file_exists($migrationLockFile) && password_verify('Admin@123', $existingAdminPassword)) {
            $stmt = $pdo->prepare("UPDATE users SET password = :password, name = 'School Admin' WHERE email = 'Admin@yopmail.com'");
            $stmt->execute(['password' => $hashedAdmin]);
        }
    }

    // Seed test verification account dd@yopmail.com (Test@123)
    $hashedDD = password_hash(hash('sha256', 'Test@123'), PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("SELECT password FROM users WHERE email = :email LIMIT 1");
    $stmt->execute(['email' => 'dd@yopmail.com']);
    $existingDDPassword = $stmt->fetchColumn();
    if ($existingDDPassword === false) {
        $stmt = $pdo->prepare("INSERT INTO users (school_id, email, password, role, is_active, name) VALUES (1, :email, :password, 'School Admin', 1, 'Test Admin')");
        $stmt->execute([
            'email' => 'dd@yopmail.com',
            'password' => $hashedDD
        ]);
        
        $notifs = [
            [
                'title' => 'Subscription Expiry Reminder',
                'content' => 'Your subscription will expire in 30 days.',
                'timestamp' => date('Y-m-d H:i:s', strtotime('-5 days')),
                'created_at' => date('Y-m-d H:i:s', strtotime('-5 days'))
            ],
            [
                'title' => 'Subscription Expiry Reminder',
                'content' => 'Your subscription will expire in 7 days.',
                'timestamp' => date('Y-m-d H:i:s', strtotime('-2 days')),
                'created_at' => date('Y-m-d H:i:s', strtotime('-2 days'))
            ],
            [
                'title' => 'Subscription Expiry Reminder',
                'content' => 'Your subscription will expire in 3 days.',
                'timestamp' => date('Y-m-d H:i:s', strtotime('-1 day')),
                'created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))
            ],
            [
                'title' => 'Subscription Expiry Reminder',
                'content' => 'Your subscription will expire tomorrow.',
                'timestamp' => date('Y-m-d H:i:s', strtotime('-12 hours')),
                'created_at' => date('Y-m-d H:i:s', strtotime('-12 hours'))
            ],
            [
                'title' => 'Subscription Renewed',
                'content' => 'Subscription renewed successfully.',
                'timestamp' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s')
            ]
        ];
        
        foreach ($notifs as $n) {
            $insStmt = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, created_at) VALUES (1, :title, :content, 'Subscription', :timestamp, 0, :created_at)");
            $insStmt->execute([
                'title' => $n['title'],
                'content' => $n['content'],
                'timestamp' => $n['timestamp'],
                'created_at' => $n['created_at']
            ]);
        }
    } else {
        if (!file_exists($migrationLockFile) && password_verify('Test@123', $existingDDPassword)) {
            $stmt = $pdo->prepare("UPDATE users SET password = :password WHERE email = 'dd@yopmail.com'");
            $stmt->execute(['password' => $hashedDD]);
        }
    }

    // Seed default Academic Years
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $defaultJson = json_encode([
            "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0, 
            "September" => 0, "October" => 0, "November" => 0, "December" => 0, 
            "January" => 0, "February" => 0, "March" => 0
        ]);
        $stmt = $pdo->prepare("INSERT INTO academic_years (school_id, year_range, start_date, end_date, description, status, is_active, fee_structure) VALUES 
        (1, '2025-2026', '2025-04-01', '2026-03-31', 'Previous Session', 'Archived', 0, :fs),
        (1, '2026-2027', '2026-04-01', '2027-03-31', 'Current Session', 'Active', 1, :fs)");
        $stmt->execute(['fs' => $defaultJson]);
    }

    // Seed default Classrooms
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $classes = [
            ['Class 1', 'Room 101'],
            ['Class 2', 'Room 102'],
            ['Class 3', 'Room 103'],
            ['Class 4', 'Room 104'],
            ['Class 5', 'Room 105'],
            ['Class 6', 'Room 201'],
            ['Class 7', 'Room 202'],
            ['Class 8', 'Room 203'],
            ['Class 9', 'Room 204'],
            ['Class 10', 'Room 205'],
            ['Class 11', 'Room 301'],
            ['Class 12', 'Room 302']
        ];
        $stmt = $pdo->prepare("INSERT INTO classrooms (school_id, name, room) VALUES (1, :name, :room)");
        foreach ($classes as $c) {
            $stmt->execute(['name' => $c[0], 'room' => $c[1]]);
        }
    }

    // Seed default Subjects
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM subjects WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $subjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Computer', 'EVS', 'Drawing', 'GK', 'Sports'];
        $stmt = $pdo->prepare("INSERT INTO subjects (school_id, name) VALUES (1, :name)");
        foreach ($subjects as $s) {
            $stmt->execute(['name' => $s]);
        }
    }

    // Seed default Teachers
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM teachers WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $teachers = [
            ['Bilal Ahmed', 'Male', 'Mathematics', 'M.Sc. B.Ed.', '5 Years', '982736451092', '1200.00', 'Active', 'Class 11, Class 12'],
            ['Neha Noor', 'Female', 'English', 'M.A. B.Ed.', '3 Years', '876523091276', '1000.00', 'Active', 'Class 9, Class 10'],
            ['Sam Brown', 'Male', 'Science', 'M.Sc. Ph.D.', '8 Years', '654312098765', '1500.00', 'Active', 'Class 8, Class 7']
        ];
        $stmt = $pdo->prepare("INSERT INTO teachers (school_id, name, gender, subject, qualification, experience, aadhaar_number, pan_number, joining_date, salary_amount, status, assigned_classes) VALUES (1, :name, :gender, :subject, :qualification, :experience, :aadhaar, 'ABCDE1234F', '2024-04-01', :salary, :status, :assigned)");
        foreach ($teachers as $t) {
            $stmt->execute([
                'name' => $t[0],
                'gender' => $t[1],
                'subject' => $t[2],
                'qualification' => $t[3],
                'experience' => $t[4],
                'aadhaar' => $t[5],
                'salary' => $t[6],
                'status' => $t[7],
                'assigned' => $t[8]
            ]);
        }
    }

    // Seed default Students
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        // Find academic year id for 2026-2027
        $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = 1 AND year_range = '2026-2027' LIMIT 1");
        $ayStmt->execute();
        $ayId = $ayStmt->fetchColumn() ?: 2;

        // Find classroom ids for Class 11 and Class 12
        $c11Stmt = $pdo->prepare("SELECT id FROM classrooms WHERE school_id = 1 AND name = 'Class 11' LIMIT 1");
        $c11Stmt->execute();
        $c11Id = $c11Stmt->fetchColumn() ?: 11;

        $c12Stmt = $pdo->prepare("SELECT id FROM classrooms WHERE school_id = 1 AND name = 'Class 12' LIMIT 1");
        $c12Stmt->execute();
        $c12Id = $c12Stmt->fetchColumn() ?: 12;

        $students = [
            ['Jane Doe', '101', '1', $c11Id, 'Robert Doe', 'Mary Doe', '9828765432', '398006172685', 'abc', '2010-05-15', '2026-04-01'],
            ['John Smith', '102', '2', $c11Id, 'David Smith', 'Sarah Smith', '9876543210', '123456789012', 'xyz', '2010-08-20', '2026-04-01'],
            ['Alice Johnson', '101', '3', $c12Id, 'Mark Johnson', 'Emily Johnson', '9888888888', '987654321098', 'pqr', '2009-02-10', '2026-04-01']
        ];

        $stmt = $pdo->prepare("INSERT INTO students (school_id, academic_year_id, class_id, name, roll_number, sr_no, status, father_name, mother_name, phone, aadhaar_number, address, date_of_birth, admission_date, nationality, blood_group, documents) VALUES (1, :ay_id, :class_id, :name, :roll, :sr_no, 'Active', :father, :mother, '8650302499', :aadhaar, :address, :dob, :adm_date, 'Indian', 'B+', '[]')");
        foreach ($students as $s) {
            $stmt->execute([
                'ay_id' => $ayId,
                'class_id' => $s[3],
                'name' => $s[0],
                'roll' => $s[1],
                'sr_no' => $s[2],
                'father' => $s[4],
                'mother' => $s[5],
                'aadhaar' => $s[7],
                'address' => $s[8],
                'dob' => $s[9],
                'adm_date' => $s[10]
            ]);
        }
    }

    // Seed default Fee Records
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records WHERE school_id = 1");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $studStmt = $pdo->prepare("SELECT id, academic_year_id FROM students WHERE school_id = 1");
        $studStmt->execute();
        $allStuds = $studStmt->fetchAll();

        $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        
        $feeStmt = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date, payment_date) VALUES (1, :student_id, :ay_id, :month, 150.00, :status, :due_date, :payment_date)");
        
        foreach ($allStuds as $s) {
            foreach ($months as $idx => $m) {
                $isPaid = $idx < 3;
                $status = $isPaid ? 'Paid' : 'Pending';
                $yearStr = ($idx >= 9) ? '2027' : '2026';
                
                $mNum = ($idx + 4);
                if ($mNum > 12) $mNum -= 12;
                $mNumStr = str_pad($mNum, 2, '0', STR_PAD_LEFT);
                
                $dueDate = "$yearStr-$mNumStr-10";
                $paymentDate = $isPaid ? "$yearStr-$mNumStr-05" : null;
                
                $feeStmt->execute([
                    'student_id' => $s['id'],
                    'ay_id' => $s['academic_year_id'],
                    'month' => $m,
                    'status' => $status,
                    'due_date' => $dueDate,
                    'payment_date' => $paymentDate
                ]);
            }
        }
    }

    // Seed default subscription plans if not exists
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM subscription_plans");
    $stmt->execute();
    if ($stmt->fetchColumn() == 0) {
        $defaultPlans = [
            ['name' => 'Free Trial', 'duration_days' => 30, 'price' => 0.00, 'is_active' => 1, 'description' => '30 Days Free Trial access to all features.'],
            ['name' => '1 Year Plan', 'duration_days' => 365, 'price' => 12000.00, 'is_active' => 1, 'description' => '1 Year full platform access.'],
            ['name' => '2 Year Plan', 'duration_days' => 730, 'price' => 22000.00, 'is_active' => 1, 'description' => '2 Years full platform access.'],
            ['name' => '3 Year Plan', 'duration_days' => 1095, 'price' => 30000.00, 'is_active' => 1, 'description' => '3 Years full platform access. Best value.']
        ];
        $ins = $pdo->prepare("INSERT INTO subscription_plans (name, duration_days, price, is_active, description) VALUES (:name, :duration_days, :price, :is_active, :description)");
        foreach ($defaultPlans as $p) {
            $ins->execute($p);
        }
    }

    // Populate school_subscriptions for any school that does not have one
    $schoolsQuery = $pdo->query("SELECT id, name, email, subscription_start, subscription_end FROM schools");
    while ($sch = $schoolsQuery->fetch()) {
        $checkSub = $pdo->prepare("SELECT COUNT(*) FROM school_subscriptions WHERE school_id = :school_id");
        $checkSub->execute(['school_id' => $sch['id']]);
        if ($checkSub->fetchColumn() == 0) {
            $diffDays = (strtotime($sch['subscription_end']) - strtotime($sch['subscription_start'])) / (60 * 60 * 24);
            $planName = ($diffDays <= 30) ? 'Free Trial' : '1 Year Plan';
            
            $planStmt = $pdo->prepare("SELECT id FROM subscription_plans WHERE name = :name LIMIT 1");
            $planStmt->execute(['name' => $planName]);
            $planId = $planStmt->fetchColumn();
            if (!$planId) {
                $planStmt = $pdo->prepare("SELECT id FROM subscription_plans LIMIT 1");
                $planStmt->execute();
                $planId = $planStmt->fetchColumn();
            }
            
            if ($planId) {
                $today = date('Y-m-d');
                $rem = (int)((strtotime($sch['subscription_end']) - strtotime($today)) / (60 * 60 * 24));
                $isTrial = (stripos($planName, 'Trial') !== false);
                
                $status = 'Active';
                if ($rem <= 0) {
                    $status = $isTrial ? 'Trial Expired' : 'Expired';
                } else if ($rem < 15) {
                    $status = 'Expiring Soon';
                } else {
                    $status = $isTrial ? 'Trial Active' : 'Active';
                }
                
                $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, :rem, :status)");
                $insSub->execute([
                    'school_id' => $sch['id'],
                    'plan_id' => $planId,
                    'start' => $sch['subscription_start'],
                    'end' => $sch['subscription_end'],
                    'rem' => $rem,
                    'status' => $status
                ]);
                
                // Log trial usage if it's trial
                if ($isTrial) {
                    $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
                    $regStmt->execute(['email' => $sch['email']]);
                    
                    $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Trial Activated', 'System', :school_name, :plan_name)");
                    $logStmt->execute(['school_name' => $sch['name'], 'plan_name' => $planName]);
                } else {
                    $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Activated', 'System', :school_name, :plan_name)");
                    $logStmt->execute(['school_name' => $sch['name'], 'plan_name' => $planName]);
                }
            }
        }
    }
}

// Helpers
function generateJwt($userId, $email, $role, $schoolId = null, $setupCompleted = 1, $phone = null) {
    global $jwt_secret;
    if ($phone === null && is_numeric($email)) {
        $phone = $email;
    }
    $payload = [
        'iss' => 'bn_school_sp',
        'iat' => time(),
        'exp' => time() + (3600 * 24), // 24 hours
        'sub' => $userId,
        'email' => $email,
        'phone' => $phone,
        'role' => $role,
        'school_id' => $schoolId,
        'setup_completed' => $setupCompleted
    ];
    return JWT::encode($payload, $jwt_secret, 'HS256');
}

function getAuthUser(Request $request) {
    global $jwt_secret;
    $authHeader = $request->getHeaderLine('Authorization');
    if (!$authHeader) {
        return null;
    }
    
    $token = str_replace('Bearer ', '', $authHeader);
    $user = null;
    
    if ($token === 'mock-super-token') {
        $user = [
            'sub' => 0,
            'email' => 'Bilal@yopmail.com',
            'role' => 'Super Admin',
            'school_id' => null,
            'setup_completed' => 1
        ];
    } else if ($token === 'mock-token') {
        $user = [
            'sub' => 1,
            'email' => 'Admin@yopmail.com',
            'role' => 'School Admin',
            'school_id' => 1,
            'setup_completed' => 1
        ];
    } else if (strpos($token, 'mock-token-') === 0) {
        $parts = explode('-', $token);
        $schoolId = isset($parts[2]) ? $parts[2] : 1;
        $email = 'mock.admin@school.edu';
        if (isset($parts[3])) {
            $decoded = base64_decode(str_replace('_', '/', $parts[3]));
            if ($decoded !== false) {
                $email = $decoded;
            }
        }
        $user = [
            'sub' => 999,
            'email' => $email,
            'role' => 'School Admin',
            'school_id' => (int)$schoolId,
            'setup_completed' => 0
        ];
    } else {
        try {
            $decoded = JWT::decode($token, new Key($jwt_secret, 'HS256'));
            $user = (array)$decoded;
            if (!isset($user['phone']) && isset($user['email']) && is_numeric($user['email'])) {
                $user['phone'] = $user['email'];
            }
        } catch (\Exception $e) {
            $user = null;
        }
    }
    
    if ($user !== null) {
        if (isset($user['sub']) && !isset($user['id'])) {
            $user['id'] = $user['sub'];
        }
    }
    return $user;
}

function logAudit($pdo, $schoolId, $operator, $action, $details) {
    $stmt = $pdo->prepare("INSERT INTO audit_logs (school_id, operator, action, timestamp, details) VALUES (:school_id, :operator, :action, NOW(), :details)");
    $stmt->execute([
        'school_id' => $schoolId,
        'operator' => $operator,
        'action' => $action,
        'details' => $details
    ]);
}

function generateSecurePassword() {
    $uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    $lowercase = "abcdefghijklmnopqrstuvwxyz";
    $numbers = "0123456789";
    $special = "!@#$%^&*()_+";
    
    $password = "";
    $password .= $uppercase[rand(0, strlen($uppercase) - 1)];
    $password .= $lowercase[rand(0, strlen($lowercase) - 1)];
    $password .= $numbers[rand(0, strlen($numbers) - 1)];
    $password .= $special[rand(0, strlen($special) - 1)];
    
    $all = $uppercase . $lowercase . $numbers . $special;
    for ($i = 0; $i < 6; $i++) {
        $password .= $all[rand(0, strlen($all) - 1)];
    }
    
    return str_shuffle($password);
}

function getMockSchools() {
    $file = __DIR__ . '/../mock_schools.json';
    if (!file_exists($file)) {
        $default = [
            [
                'id' => 1,
                'name' => "St. Xavier's International School",
                'code' => "SCH-981763",
                'contact_person' => "Fr. Thomas Matthews",
                'contact_number' => "+1 (555) 019-8833",
                'email' => "xavier.admin@xavier.edu",
                'status' => "Active",
                'subscription_start' => "2026-04-01",
                'subscription_end' => "2027-03-31",
                'setup_completed' => 1
            ],
            [
                'id' => 2,
                'name' => "Lincoln Technical College",
                'code' => "SCH-098716",
                'contact_person' => "Dr. Elizabeth Vance",
                'contact_number' => "+1 (555) 021-3311",
                'email' => "lincoln.tech@lincoln.edu",
                'status' => "Active",
                'subscription_start' => "2026-05-01",
                'subscription_end' => "2026-06-30",
                'setup_completed' => 1
            ]
        ];
        file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT));
        return $default;
    }
    return json_decode(file_get_contents($file), true) ?: [];
}

function saveMockSchools($schools) {
    $file = __DIR__ . '/../mock_schools.json';
    file_put_contents($file, json_encode($schools, JSON_PRETTY_PRINT));
}

function getMockSubjects() {
    $file = __DIR__ . '/../mock_subjects.json';
    if (!file_exists($file)) {
        $default = [
            ['id' => 1, 'school_id' => 1, 'name' => 'English'],
            ['id' => 2, 'school_id' => 1, 'name' => 'Hindi'],
            ['id' => 3, 'school_id' => 1, 'name' => 'Mathematics'],
            ['id' => 4, 'school_id' => 1, 'name' => 'Science'],
            ['id' => 5, 'school_id' => 1, 'name' => 'Computer'],
            ['id' => 6, 'school_id' => 1, 'name' => 'EVS'],
            ['id' => 7, 'school_id' => 1, 'name' => 'Drawing'],
            ['id' => 8, 'school_id' => 1, 'name' => 'GK'],
            ['id' => 9, 'school_id' => 1, 'name' => 'Sports']
        ];
        file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT));
        return $default;
    }
    return json_decode(file_get_contents($file), true) ?: [];
}

function saveMockSubjects($subjects) {
    $file = __DIR__ . '/../mock_subjects.json';
    file_put_contents($file, json_encode($subjects, JSON_PRETTY_PRINT));
}

function getMockSchedules() {
    $file = __DIR__ . '/../mock_schedules.json';
    if (!file_exists($file)) {
        file_put_contents($file, json_encode([], JSON_PRETTY_PRINT));
        return [];
    }
    return json_decode(file_get_contents($file), true) ?: [];
}

function saveMockSchedules($schedules) {
    $file = __DIR__ . '/../mock_schedules.json';
    file_put_contents($file, json_encode($schedules, JSON_PRETTY_PRINT));
}

function sendCredentialsEmail($toEmail, $schoolName, $plainPassword) {
    $smtpHost = $_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $smtpPort = (int)($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 587);
    $smtpUser = $_ENV['SMTP_USER'] ?? getenv('SMTP_USER') ?: '';
    $smtpPass = $_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?: '';
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN Shiksha Pilot (SP) Control Panel';
    
    // If SMTP_USER or SMTP_PASS is empty or has placeholders, log to sent_emails.log file
    if (empty($smtpUser) || empty($smtpPass) || $smtpUser === 'your_email@gmail.com') {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Outgoing invitation credentials: To: $toEmail | School: $schoolName | Password: $plainPassword\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        
        $mail->setFrom($smtpUser, $fromName);
        $mail->addAddress($toEmail);
        
        $mail->isHTML(true);
        $mail->Subject = "Welcome to BN College Portal – Your Shiksha Pilot (SP) Account is Ready";
        
        $portalUrl = "https://portal.bncollegeportal.com/login";
        
        $mail->Body = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Welcome to BN College Portal</title>
</head>
<body style='margin: 0; padding: 0; background-color: #f8fafc; font-family: \"Helvetica Neue\", Helvetica, Arial, sans-serif; color: #1e293b;'>
    <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f8fafc; padding: 40px 0;'>
        <tr>
            <td align='center'>
                <table border='0' cellpadding='0' cellspacing='0' width='600' style='background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025); border: 1px solid #e2e8f0;'>
                    
                    <!-- Header Section -->
                    <tr>
                        <td align='center' style='background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; border-bottom: 4px solid #3b82f6;'>
                            <div style='background-color: #3b82f6; width: 50px; height: 50px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;'>
                                <span style='font-size: 24px; color: #ffffff;'>🎓</span>
                            </div>
                            <h1 style='color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;'>BN College Portal</h1>
                            <p style='color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;'>Enterprise Shiksha Pilot (SP)</p>
                        </td>
                    </tr>
                    
                    <!-- Main Body Section -->
                    <tr>
                        <td style='padding: 40px 32px;'>
                            
                            <!-- Main Heading -->
                            <h2 style='margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;'>Welcome to BN College Portal</h2>
                            <p style='margin: 0 0 32px 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.5;'>Your Shiksha Pilot (SP) account has been successfully created and is ready for setup.</p>
                            
                            <!-- Greeting -->
                            <p style='margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #0f172a;'>Dear School Administrator,</p>
                            <p style='margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;'>
                                Thank you for choosing <strong>BN College Portal</strong>.
                            </p>
                            <p style='margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;'>
                                Your institution has been successfully onboarded to our SP platform. Please use the credentials below to access your school dashboard and complete the initial setup.
                            </p>
                            
                            <!-- Account Information Card -->
                            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f1f5f9; border-radius: 8px; margin-bottom: 32px; border: 1px solid #e2e8f0;'>
                                <tr>
                                    <td style='padding: 24px;'>
                                        <h4 style='margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;'>Account Information</h4>
                                        
                                        <table border='0' cellpadding='0' cellspacing='0' width='100%'>
                                            <tr>
                                                <td style='padding: 6px 0; font-size: 14px; color: #64748b;' width='140'><strong>School Name:</strong></td>
                                                <td style='padding: 6px 0; font-size: 14px; color: #0f172a;'><strong>" . htmlspecialchars($schoolName) . "</strong></td>
                                            </tr>
                                            <tr>
                                                <td style='padding: 6px 0; font-size: 14px; color: #64748b;'><strong>Login Email:</strong></td>
                                                <td style='padding: 6px 0; font-size: 14px; color: #0f172a; font-family: monospace;'>" . htmlspecialchars($toEmail) . "</td>
                                            </tr>
                                            <tr>
                                                <td style='padding: 6px 0; font-size: 14px; color: #64748b;'><strong>Temporary Password:</strong></td>
                                                <td style='padding: 6px 0; font-size: 14px; color: #0f172a;'><code style='font-family: monospace; background-color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-weight: bold;'>" . htmlspecialchars($plainPassword) . "</code></td>
                                            </tr>
                                            <tr>
                                                <td style='padding: 6px 0; font-size: 14px; color: #64748b;'><strong>Portal Access:</strong></td>
                                                <td style='padding: 6px 0; font-size: 14px; color: #2563eb;'><a href='" . $portalUrl . "' style='color: #2563eb; text-decoration: none;'>" . $portalUrl . "</a></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Primary Action Button -->
                            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='margin-bottom: 32px;'>
                                <tr>
                                    <td align='center'>
                                        <a href='" . $portalUrl . "' style='background-color: #2563eb; color: #ffffff; display: inline-block; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);'>Access School Portal</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <hr style='border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 28px;'>
                            
                            <!-- First Login Information -->
                            <h3 style='margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;'>First Login Information</h3>
                            <p style='margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;'>After signing in for the first time, you will be guided through a quick setup process where you can:</p>
                            
                            <ul style='margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #475569;'>
                                <li>Configure your school profile</li>
                                <li>Upload your school logo</li>
                                <li>Update contact information</li>
                                <li>Configure academic settings</li>
                            </ul>
                            
                            <p style='margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;'>The setup takes only a few minutes.</p>
                            
                            <!-- Security Notice -->
                            <div style='background-color: #fffbeb; border-left: 4px solid #d97706; padding: 14px; border-radius: 4px; margin-bottom: 32px;'>
                                <p style='margin: 0; font-size: 13.5px; color: #b45309; line-height: 1.5;'>
                                    <strong>Security Notice:</strong> For security reasons, we recommend changing your password immediately after your first login.
                                </p>
                            </div>
                            
                            <!-- Support Section -->
                            <h3 style='margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;'>Need Help?</h3>
                            <p style='margin: 0; font-size: 14px; line-height: 1.6; color: #475569;'>
                                If you need assistance with setup or account access, please contact our support team at <a href='mailto:support@bncollegeportal.com' style='color: #2563eb; text-decoration: none;'>support@bncollegeportal.com</a>.
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td style='background-color: #f1f5f9; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;'>
                            <h4 style='margin: 0 0 8px 0; font-size: 15px; color: #334155;'>BN College Portal</h4>
                            <p style='margin: 0 0 16px 0; font-size: 12px; color: #64748b; font-weight: 500;'>
                                School Management &bull; Student Records &bull; Fees &bull; Faculty Management &bull; Reports
                            </p>
                            <p style='margin: 0; font-size: 11.5px; color: #94a3b8;'>
                                &copy; 2026 BN College Portal. All Rights Reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        ";
        
        $mail->send();
        return true;
    } catch (\Exception $e) {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] SMTP send failed to $toEmail: " . $mail->ErrorInfo . " (Exception: " . $e->getMessage() . ")\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
    }
}

function formatReportCurrency($amount, $currencyCode) {
    $amount = round($amount);
    $neg = $amount < 0;
    $absAmount = abs($amount);
    if ($currencyCode === 'INR') {
        $amountStr = (string)$absAmount;
        $len = strlen($amountStr);
        if ($len <= 3) {
            $result = $amountStr;
        } else {
            $lastThree = substr($amountStr, -3);
            $remaining = substr($amountStr, 0, -3);
            $remaining = preg_replace("/\B(?=(\d{2})+(?!\d))/", ",", $remaining);
            $result = $remaining . ',' . $lastThree;
        }
        $formatted = $result;
    } else {
        $formatted = number_format($absAmount);
    }
    
    $currencySymbols = [
        'INR' => '₹',
        'USD' => '$',
        'GBP' => '£',
        'EUR' => '€'
    ];
    $symbol = $currencySymbols[$currencyCode] ?? '$';
    
    return ($neg ? '-' : '') . $symbol . $formatted;
}

function sendSubscriptionReminderEmail($toEmail, $subject, $message, $isHTML = false) {
    $smtpHost = $_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $smtpPort = (int)($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 587);
    $smtpUser = $_ENV['SMTP_USER'] ?? getenv('SMTP_USER') ?: '';
    $smtpPass = $_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?: '';
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN Shiksha Pilot (SP) Control Panel';
    
    // Always write to log file for verification/mock purposes
    $logMessage = "[" . date('Y-m-d H:i:s') . "] Outgoing subscription email: To: $toEmail | Subject: $subject | Message: $message\n";
    file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
    
    if (empty($smtpUser) || empty($smtpPass) || $smtpUser === 'your_email@gmail.com') {
        return false;
    }
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        $mail->Timeout = 3;
        
        $mail->setFrom($smtpUser, $fromName);
        $mail->addAddress($toEmail);
        
        $mail->isHTML($isHTML);
        $mail->Subject = $subject;
        $mail->Body = $message;
        
        $mail->send();
        return true;
    } catch (\Exception $e) {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] SMTP subscription email send failed to $toEmail: " . $mail->ErrorInfo . " (Exception: " . $e->getMessage() . ")\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
}

function sendForgotPasswordOTPEmail($toEmail, $otp) {
    $smtpHost = $_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $smtpPort = (int)($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 587);
    $smtpUser = $_ENV['SMTP_USER'] ?? getenv('SMTP_USER') ?: '';
    $smtpPass = $_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?: '';
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN Shiksha Pilot (SP) Control Panel';
    
    // If SMTP_USER or SMTP_PASS is empty or has placeholders, log to sent_emails.log file
    if (empty($smtpUser) || empty($smtpPass) || $smtpUser === 'your_email@gmail.com') {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Outgoing password recovery OTP: To: $toEmail | OTP: $otp\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        
        $mail->setFrom($smtpUser, $fromName);
        $mail->addAddress($toEmail);
        
        $mail->isHTML(true);
        $mail->Subject = "Password Reset Verification Code - BN College Portal";
        
        $mail->Body = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Reset Your Password</title>
</head>
<body style='margin: 0; padding: 0; background-color: #f8fafc; font-family: \"Helvetica Neue\", Helvetica, Arial, sans-serif; color: #1e293b;'>
    <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f8fafc; padding: 40px 0;'>
        <tr>
            <td align='center'>
                <table border='0' cellpadding='0' cellspacing='0' width='600' style='background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025); border: 1px solid #e2e8f0;'>
                    
                    <!-- Header Section -->
                    <tr>
                        <td align='center' style='background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; border-bottom: 4px solid #3b82f6;'>
                            <div style='background-color: #3b82f6; width: 50px; height: 50px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;'>
                                <span style='font-size: 24px; color: #ffffff;'>🔒</span>
                            </div>
                            <h1 style='color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;'>BN College Portal</h1>
                            <p style='color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;'>Security Verification</p>
                        </td>
                    </tr>
                    
                    <!-- Main Body Section -->
                    <tr>
                        <td style='padding: 40px 32px;'>
                            
                            <!-- Main Heading -->
                            <h2 style='margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;'>Reset Your Password</h2>
                            <p style='margin: 0 0 32px 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.5;'>Use the verification code below to reset your portal password.</p>
                            
                            <!-- Greeting -->
                            <p style='margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #0f172a;'>Hello,</p>
                            <p style='margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;'>
                                We received a request to reset your password for your <strong>BN College Portal</strong> account. Please use the following 4-digit verification code to complete the request:
                            </p>
                            
                            <!-- Verification Code Card -->
                            <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f1f5f9; border-radius: 8px; margin-bottom: 32px; border: 1px solid #e2e8f0;'>
                                <tr>
                                    <td align='center' style='padding: 28px;'>
                                        <span style='font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; font-weight: bold; display: block; margin-bottom: 12px;'>Verification Code</span>
                                        <div style='font-size: 36px; font-family: monospace; color: #2563eb; letter-spacing: 8px; font-weight: bold; background-color: #ffffff; padding: 12px 24px; border-radius: 6px; border: 1px dashed #cbd5e1; display: inline-block;'>
                                            " . htmlspecialchars($otp) . "
                                        </div>
                                        <span style='font-size: 12px; color: #94a3b8; display: block; margin-top: 12px;'>This code is valid for 15 minutes.</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <hr style='border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 28px;'>
                            
                            <!-- Security Notice -->
                            <div style='background-color: #fffbeb; border-left: 4px solid #d97706; padding: 14px; border-radius: 4px; margin-bottom: 32px;'>
                                <p style='margin: 0; font-size: 13.5px; color: #b45309; line-height: 1.5;'>
                                    <strong>Important Security Notice:</strong> If you did not request this password reset, please ignore this email or change your password immediately to protect your account. Do not share this verification code with anyone.
                                </p>
                            </div>
                            
                            <!-- Support Section -->
                            <p style='margin: 0; font-size: 14px; line-height: 1.6; color: #475569;'>
                                If you need assistance, please contact our support team at <a href='mailto:support@bncollegeportal.com' style='color: #2563eb; text-decoration: none;'>support@bncollegeportal.com</a>.
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer Section -->
                    <tr>
                        <td style='background-color: #f1f5f9; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;'>
                            <h4 style='margin: 0 0 8px 0; font-size: 15px; color: #334155;'>BN College Portal</h4>
                            <p style='margin: 0; font-size: 11.5px; color: #94a3b8;'>
                                &copy; 2026 BN College Portal. All Rights Reserved.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        ";
        
        $mail->send();
        return true;
    } catch (\Exception $e) {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] SMTP send failed to $toEmail: " . $mail->ErrorInfo . " (Exception: " . $e->getMessage() . ")\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
}

function sendReportEmail($toEmail, $reportId, $fromDate, $toDate, $xlsxPath) {
    $smtpHost = $_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $smtpPort = (int)($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 587);
    $smtpUser = $_ENV['SMTP_USER'] ?? getenv('SMTP_USER') ?: '';
    $smtpPass = $_ENV['SMTP_PASS'] ?? getenv('SMTP_PASS') ?: '';
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN Shiksha Pilot (SP) Control Panel';
    
    // If SMTP_USER or SMTP_PASS is empty or has placeholders, log to sent_emails.log file
    if (empty($smtpUser) || empty($smtpPass) || $smtpUser === 'your_email@gmail.com') {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Outgoing report email (offline mock): To: $toEmail | Report: REP-$reportId | Period: $fromDate to $toDate | XLSX path: $xlsxPath\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
    
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $smtpHost;
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $smtpPort;
        
        $mail->setFrom($smtpUser, $fromName);
        $mail->addAddress($toEmail);
        
        $mail->addAttachment($xlsxPath, "Financial_Report_REP-" . sprintf('%03d', $reportId) . ".xlsx");
        
        $mail->isHTML(true);
        $mail->Subject = "Your Financial Report is Ready";
        
        $mail->Body = "
<p>Hello,</p>
<p>Your report has been successfully generated.</p>
<p><strong>Report ID:</strong> REP-" . sprintf('%03d', $reportId) . "<br>
<strong>Report Period:</strong> $fromDate &rarr; $toDate</p>
<p>The generated report is attached to this email.</p>
<p>Regards,<br>
School Management System</p>";
        
        return $mail->send();
    } catch (\Exception $e) {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Failed sending report email to $toEmail: " . $e->getMessage() . "\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        return false;
    }
}

// Excel helpers for formatting and generating standard XLSX spreadsheets
function getCellRef($colIndex, $rowIndex) {
    $letters = "";
    $temp = $colIndex;
    while ($temp >= 0) {
        $letters = chr(($temp % 26) + 65) . $letters;
        $temp = intval($temp / 26) - 1;
    }
    return $letters . $rowIndex;
}

function buildSheetXml($headers, $rows, $grandTotalText = null) {
    $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
    $xml .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . "\n";
    $xml .= '  <sheetData>' . "\n";
    
    $r = 1;
    
    // Write Headers
    $xml .= '    <row r="' . $r . '">' . "\n";
    foreach ($headers as $c => $header) {
        $ref = getCellRef($c, $r);
        $xml .= '      <c r="' . $ref . '" s="1" t="inlineStr"><is><t>' . htmlspecialchars($header) . '</t></is></c>' . "\n";
    }
    $xml .= '    </row>' . "\n";
    
    // Write Rows
    foreach ($rows as $rowData) {
        $r++;
        $xml .= '    <row r="' . $r . '">' . "\n";
        foreach ($rowData as $c => $val) {
            $ref = getCellRef($c, $r);
            if (is_numeric($val) && !is_string($val)) {
                $xml .= '      <c r="' . $ref . '"><v>' . $val . '</v></c>' . "\n";
            } else {
                $xml .= '      <c r="' . $ref . '" t="inlineStr"><is><t>' . htmlspecialchars($val) . '</t></is></c>' . "\n";
            }
        }
        $xml .= '    </row>' . "\n";
    }
    
    // Write Grand Total row if provided
    if ($grandTotalText !== null) {
        $r++;
        $xml .= '    <row r="' . $r . '">' . "\n";
        $refText = getCellRef(0, $r);
        $xml .= '      <c r="' . $refText . '" s="1" t="inlineStr"><is><t>' . htmlspecialchars($grandTotalText) . '</t></is></c>' . "\n";
        $xml .= '    </row>' . "\n";
    }
    
    $xml .= '  </sheetData>' . "\n";
    $xml .= '</worksheet>';
    return $xml;
}

function createXlsxFile($collectedFeesHeaders, $collectedFeesRows, $collectedFeesTotalText, $expensesHeaders, $expensesRows, $expensesTotalText, $outputPath) {
    $zip = new \ZipArchive();
    if ($zip->open($outputPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
        throw new \Exception("Cannot open zip archive: " . $outputPath);
    }
    
    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n" .
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' . "\n" .
        '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' . "\n" .
        '  <Default Extension="xml" ContentType="application/xml"/>' . "\n" .
        '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' . "\n" .
        '  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' . "\n" .
        '  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' . "\n" .
        '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' . "\n" .
        '</Types>';
    $zip->addFromString('[Content_Types].xml', $contentTypes);
    
    $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n" .
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . "\n" .
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' . "\n" .
        '</Relationships>';
    $zip->addFromString('_rels/.rels', $rels);
    
    $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n" .
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' . "\n" .
        '  <sheets>' . "\n" .
        '    <sheet name="Collected Fees" sheetId="1" r:id="rId1"/>' . "\n" .
        '    <sheet name="Expenses" sheetId="2" r:id="rId2"/>' . "\n" .
        '  </sheets>' . "\n" .
        '</workbook>';
    $zip->addFromString('xl/workbook.xml', $workbook);
    
    $workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n" .
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . "\n" .
        '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' . "\n" .
        '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' . "\n" .
        '  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' . "\n" .
        '</Relationships>';
    $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
    
    $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n" .
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' . "\n" .
        '  <fonts count="2">' . "\n" .
        '    <font><name val="Calibri"/><sz val="11"/><color theme="1"/></font>' . "\n" .
        '    <font><bold/><name val="Calibri"/><sz val="11"/><color theme="1"/></font>' . "\n" .
        '  </fonts>' . "\n" .
        '  <fills count="2">' . "\n" .
        '    <fill><patternFill patternType="none"/></fill>' . "\n" .
        '    <fill><patternFill patternType="gray125"/></fill>' . "\n" .
        '  </fills>' . "\n" .
        '  <borders count="1">' . "\n" .
        '    <border><left/><right/><top/><bottom/></border>' . "\n" .
        '  </borders>' . "\n" .
        '  <cellStyleXfs count="1">' . "\n" .
        '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' . "\n" .
        '  </cellStyleXfs>' . "\n" .
        '  <cellXfs count="2">' . "\n" .
        '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' . "\n" .
        '    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>' . "\n" .
        '  </cellXfs>' . "\n" .
        '</styleSheet>';
    $zip->addFromString('xl/styles.xml', $styles);
    
    $sheet1Xml = buildSheetXml($collectedFeesHeaders, $collectedFeesRows, $collectedFeesTotalText);
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheet1Xml);
    
    $sheet2Xml = buildSheetXml($expensesHeaders, $expensesRows, $expensesTotalText);
    $zip->addFromString('xl/worksheets/sheet2.xml', $sheet2Xml);
    
    $zip->close();
}

function formatMonthsCovered($months) {
    $monthsOrder = ["April" => 1, "May" => 2, "June" => 3, "July" => 4, "August" => 5, "September" => 6, "October" => 7, "November" => 8, "December" => 9, "January" => 10, "February" => 11, "March" => 12];
    usort($months, function($a, $b) use ($monthsOrder) {
        return ($monthsOrder[$a] ?? 99) - ($monthsOrder[$b] ?? 99);
    });
    $count = count($months);
    if ($count === 0) return "";
    if ($count === 1) return $months[0] . " (1)";
    
    $isConsecutive = true;
    for ($i = 1; $i < $count; $i++) {
        $prevVal = $monthsOrder[$months[$i-1]] ?? 0;
        $currVal = $monthsOrder[$months[$i]] ?? 0;
        if ($currVal !== $prevVal + 1) {
            $isConsecutive = false;
            break;
        }
    }
    
    if ($isConsecutive) {
        return $months[0] . "-" . $months[$count - 1] . " (" . $count . ")";
    } else {
        return implode(", ", $months) . " (" . $count . ")";
    }
}

function generateReportExcelFile($pdo, $schoolId, $reportId, $outputPath) {
    $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $reportId, 'school_id' => $schoolId]);
    $report = $stmt->fetch();
    if (!$report) {
        throw new \Exception("Report not found");
    }
    
    $start_ts = $report['from_timestamp'] ?: ($report['from_date'] . ' 00:00:00');
    $end_ts = $report['to_timestamp'] ?: ($report['to_date'] . ' 23:59:59');
    
    $prevStmt = $pdo->prepare("SELECT MAX(to_timestamp) FROM financial_reports WHERE school_id = :school_id AND id < :id");
    $prevStmt->execute(['school_id' => $schoolId, 'id' => $reportId]);
    $prev_to = $prevStmt->fetchColumn();
    $use_strict_greater = ($prev_to && $prev_to === $start_ts);
    
    $feeSql = "SELECT s.name AS student_name, s.roll_number, c.name AS class_name, fr.student_id, fr.month, fr.amount
               FROM fee_records fr
               JOIN students s ON fr.student_id = s.id
               JOIN classrooms c ON s.class_id = c.id
               WHERE fr.school_id = :school_id
                 AND fr.academic_year_id = :ay_id
                 AND fr.status = 'Paid'";
    $feeSql .= $use_strict_greater ? " AND fr.paid_at > :start_ts" : " AND fr.paid_at >= :start_ts";
    $feeSql .= " AND fr.paid_at <= :end_ts";
    
    $feeStmt = $pdo->prepare($feeSql);
    $feeStmt->execute([
        'school_id' => $schoolId,
        'ay_id' => $report['academic_year_id'],
        'start_ts' => $start_ts,
        'end_ts' => $end_ts
    ]);
    $fees = $feeStmt->fetchAll();
    
    $studentTuitions = [];
    foreach ($fees as $f) {
        $sid = $f['student_id'];
        if (!isset($studentTuitions[$sid])) {
            $studentTuitions[$sid] = [
                'student_name' => $f['student_name'],
                'roll_number' => $f['roll_number'],
                'class_name' => $f['class_name'],
                'months' => [],
                'total_fee' => 0.00
            ];
        }
        $studentTuitions[$sid]['months'][] = $f['month'];
        $studentTuitions[$sid]['total_fee'] += (float)$f['amount'];
    }
    
    $collectedFeesRows = [];
    $totalFeesSum = 0.00;
    
    foreach ($studentTuitions as $sid => $info) {
        $monthsText = formatMonthsCovered($info['months']);
        $collectedFeesRows[] = [
            $info['student_name'],
            $info['roll_number'],
            $info['class_name'],
            'Tuition Fee',
            $monthsText,
            '₹' . number_format($info['total_fee'])
        ];
        $totalFeesSum += $info['total_fee'];
    }
    
    $extraSql = "SELECT s.name AS student_name, s.roll_number, c.name AS class_name, eft.name AS fee_type, eft.amount
                 FROM student_extra_fees sef
                 JOIN students s ON sef.student_id = s.id
                 JOIN classrooms c ON s.class_id = c.id
                 JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                 WHERE sef.school_id = :school_id
                   AND sef.academic_year_id = :ay_id
                   AND sef.status = 'Paid'";
    $extraSql .= $use_strict_greater ? " AND sef.paid_at > :start_ts" : " AND sef.paid_at >= :start_ts";
    $extraSql .= " AND sef.paid_at <= :end_ts";
    
    $extraStmt = $pdo->prepare($extraSql);
    $extraStmt->execute([
        'school_id' => $schoolId,
        'ay_id' => $report['academic_year_id'],
        'start_ts' => $start_ts,
        'end_ts' => $end_ts
    ]);
    $extras = $extraStmt->fetchAll();
    
    foreach ($extras as $ex) {
        $collectedFeesRows[] = [
            $ex['student_name'],
            $ex['roll_number'],
            $ex['class_name'],
            $ex['fee_type'],
            'N/A',
            '₹' . number_format((float)$ex['amount'])
        ];
        $totalFeesSum += (float)$ex['amount'];
    }

    // Query recoveries in the timestamp range
    $recoverySql = "SELECT s.name AS student_name, s.roll_number, c_orig.name AS class_name, pyr.amount_recovered, pyr.recovery_date, ay.year_range AS original_year
                    FROM previous_year_recoveries pyr
                    JOIN students s ON pyr.student_id = s.id
                    JOIN carry_forward_dues cfd ON pyr.carry_forward_due_id = cfd.id
                    JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                    LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                             AND s_orig.academic_year_id = cfd.original_academic_year_id
                                             AND s_orig.name = s.name 
                                             AND s_orig.roll_number = s.roll_number
                    LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                    WHERE pyr.school_id = :school_id
                      AND pyr.academic_year_id = :ay_id";
    $recoverySql .= $use_strict_greater ? " AND pyr.paid_at > :start_ts" : " AND pyr.paid_at >= :start_ts";
    $recoverySql .= " AND pyr.paid_at <= :end_ts";
    
    $recoveryStmt = $pdo->prepare($recoverySql);
    $recoveryStmt->execute([
        'school_id' => $schoolId,
        'ay_id' => $report['academic_year_id'],
        'start_ts' => $start_ts,
        'end_ts' => $end_ts
    ]);
    $recoveries = $recoveryStmt->fetchAll();
    
    foreach ($recoveries as $rec) {
        $collectedFeesRows[] = [
            $rec['student_name'],
            $rec['roll_number'],
            $rec['class_name'],
            'Previous Year Due Recovery',
            $rec['original_year'],
            '₹' . number_format((float)$rec['amount_recovered'])
        ];
        $totalFeesSum += (float)$rec['amount_recovered'];
    }
    
    usort($collectedFeesRows, function($a, $b) {
        return strcasecmp($a[0], $b[0]);
    });
    
    $expSql = "SELECT description, amount, expense_date, expense_time
               FROM school_expenses
               WHERE school_id = :school_id
                 AND academic_year_id = :ay_id";
    $expSql .= $use_strict_greater ? " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) > :start_ts" : " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) >= :start_ts";
    $expSql .= " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) <= :end_ts";
    
    $expStmt = $pdo->prepare($expSql);
    $expStmt->execute([
        'school_id' => $schoolId,
        'ay_id' => $report['academic_year_id'],
        'start_ts' => $start_ts,
        'end_ts' => $end_ts
    ]);
    $expensesData = $expStmt->fetchAll();
    
    $expensesRows = [];
    $totalExpensesSum = 0.00;
    
    foreach ($expensesData as $e) {
        $dateStr = $e['expense_date'];
        $timestamp = strtotime($dateStr . ' ' . $e['expense_time']);
        $expensesRows[] = [
            'timestamp' => $timestamp,
            'date' => date('d-M-Y', strtotime($dateStr)),
            'description' => $e['description'],
            'amount' => (float)$e['amount']
        ];
        $totalExpensesSum += (float)$e['amount'];
    }
    
    $salSql = "SELECT t.name AS teacher_name, sr.month, sr.amount, sr.payment_date, sr.paid_at
               FROM salary_records sr
               JOIN teachers t ON sr.teacher_id = t.id
               WHERE sr.school_id = :school_id
                 AND sr.academic_year_id = :ay_id
                 AND sr.status = 'Paid'";
    $salSql .= $use_strict_greater ? " AND sr.paid_at > :start_ts" : " AND sr.paid_at >= :start_ts";
    $salSql .= " AND sr.paid_at <= :end_ts";
    
    $salStmt = $pdo->prepare($salSql);
    $salStmt->execute([
        'school_id' => $schoolId,
        'ay_id' => $report['academic_year_id'],
        'start_ts' => $start_ts,
        'end_ts' => $end_ts
    ]);
    $salariesData = $salStmt->fetchAll();
    
    foreach ($salariesData as $s) {
        $dateStr = $s['payment_date'] ?: date('Y-m-d', strtotime($s['paid_at']));
        $timestamp = strtotime($s['paid_at']);
        $expensesRows[] = [
            'timestamp' => $timestamp,
            'date' => date('d-M-Y', strtotime($dateStr)),
            'description' => "Salary - " . $s['teacher_name'] . " (" . $s['month'] . ")",
            'amount' => (float)$s['amount']
        ];
        $totalExpensesSum += (float)$s['amount'];
    }
    
    usort($expensesRows, function($a, $b) {
        return $a['timestamp'] - $b['timestamp'];
    });
    
    $finalExpensesRows = [];
    foreach ($expensesRows as $row) {
        $finalExpensesRows[] = [
            $row['date'],
            $row['description'],
            '₹' . number_format($row['amount'])
        ];
    }
    
    $collectedFeesHeaders = ['Student Name', 'Roll Number', 'Class', 'Fee Type', 'Months Covered', 'Total Fee'];
    $collectedFeesTotalText = 'Grand Total Fees Collected: ₹' . number_format($totalFeesSum);
    
    $expensesHeaders = ['Date', 'Description', 'Amount'];
    $expensesTotalText = 'Total Expenses: ₹' . number_format($totalExpensesSum);
    
    createXlsxFile(
        $collectedFeesHeaders, $collectedFeesRows, $collectedFeesTotalText,
        $expensesHeaders, $finalExpensesRows, $expensesTotalText,
        $outputPath
    );
}

// JSON Response Utility
function jsonResponse(Response $response, $data, $status = 200) {
    $payload = json_encode($data);
    $response->getBody()->write($payload);
    return $response
        ->withHeader('Content-Type', 'application/json')
        ->withStatus($status);
}

// Request Data Parser
function getJsonData(Request $request) {
    $parsed = $request->getParsedBody();
    if (is_array($parsed)) {
        return $parsed;
    }
    try {
        $body = $request->getBody();
        $body->rewind();
        $contents = $body->getContents();
        return json_decode($contents, true) ?: [];
    } catch (\Exception $e) {
        return [];
    }
}

// CORS Middleware
$app->add(function (Request $request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
});

// Subscription Check Middleware
$app->add(function (Request $request, $handler) {
    $path = $request->getUri()->getPath();
    
    // Check if path is exempt
    if (
        strpos($path, '/api/auth/') === 0 || 
        strpos($path, '/api/sandbox/') === 0 || 
        strpos($path, '/api/platform/') === 0 ||
        $path === '/api/profile' ||
        $path === '/api/subscription/plans' ||
        $request->getMethod() === 'OPTIONS'
    ) {
        return $handler->handle($request);
    }
    
    // Check auth
    $auth = getAuthUser($request);
    if ($auth && $auth['role'] !== 'Super Admin' && !empty($auth['school_id'])) {
        $schoolId = $auth['school_id'];
        
        try {
            $pdo = getDb();
            
            // Fetch subscription
            $stmt = $pdo->prepare("SELECT * FROM school_subscriptions WHERE school_id = :school_id LIMIT 1");
            $stmt->execute(['school_id' => $schoolId]);
            $sub = $stmt->fetch();
            
            $today = date('Y-m-d');
            if ($sub) {
                $expiry = $sub['expiry_date'];
                $diff = (strtotime($expiry) - strtotime($today)) / (60 * 60 * 24);
                $remaining = max(0, (int)ceil($diff));
                
                // Fetch plan name
                $planStmt = $pdo->prepare("SELECT name FROM subscription_plans WHERE id = :plan_id LIMIT 1");
                $planStmt->execute(['plan_id' => $sub['plan_id']]);
                $planName = $planStmt->fetchColumn();
                $isTrial = ($planName && stripos($planName, 'Trial') !== false);
                
                $newStatus = $sub['status'];
                if ($remaining <= 0) {
                    $newStatus = $isTrial ? 'Trial Expired' : 'Expired';
                } else if ($remaining < 15) {
                    $newStatus = 'Expiring Soon';
                } else {
                    $newStatus = $isTrial ? 'Trial Active' : 'Active';
                }
                
                // --- EMAIL REMINDERS LOGIC ---
                $schoolStmt = $pdo->prepare("SELECT email, name FROM schools WHERE id = :id LIMIT 1");
                $schoolStmt->execute(['id' => $schoolId]);
                $schoolRow = $schoolStmt->fetch();
                $schoolEmail = $schoolRow ? $schoolRow['email'] : '';
                
                if (!empty($schoolEmail)) {
                    if ($remaining === 3 && empty($sub['email_reminder_3'])) {
                        $subj = "Subscription Expiry Reminder - 3 Days Remaining";
                        $msg = "Your subscription will expire in 3 days. Please renew your plan to avoid service interruption.";
                        sendSubscriptionReminderEmail($schoolEmail, $subj, $msg);
                        
                        $upReminder = $pdo->prepare("UPDATE school_subscriptions SET email_reminder_3 = 1 WHERE id = :id");
                        $upReminder->execute(['id' => $sub['id']]);
                        $sub['email_reminder_3'] = 1;
                    }
                    
                    if ($remaining === 1 && empty($sub['email_reminder_1'])) {
                        $subj = "Subscription Expiry Reminder - 1 Day Remaining";
                        $msg = "Your subscription will expire tomorrow. Please renew your plan to continue using the platform without interruption.";
                        sendSubscriptionReminderEmail($schoolEmail, $subj, $msg);
                        
                        $upReminder = $pdo->prepare("UPDATE school_subscriptions SET email_reminder_1 = 1 WHERE id = :id");
                        $upReminder->execute(['id' => $sub['id']]);
                        $sub['email_reminder_1'] = 1;
                    }
                    
                    if ($remaining <= 0 && empty($sub['email_reminder_expired'])) {
                        $subj = "Subscription Expired";
                        $msg = "Your subscription has expired. Please renew your plan to regain access to the platform.";
                        sendSubscriptionReminderEmail($schoolEmail, $subj, $msg);
                        
                        $upReminder = $pdo->prepare("UPDATE school_subscriptions SET email_reminder_expired = 1 WHERE id = :id");
                        $upReminder->execute(['id' => $sub['id']]);
                        $sub['email_reminder_expired'] = 1;
                    }
                }
                
                // Update database if changed
                if ($sub['remaining_days'] !== $remaining || $sub['status'] !== $newStatus) {
                    $upStmt = $pdo->prepare("UPDATE school_subscriptions SET remaining_days = :rem, status = :status WHERE id = :id");
                    $upStmt->execute(['rem' => $remaining, 'status' => $newStatus, 'id' => $sub['id']]);
                    
                    // Keep schools table in sync
                    $upSchool = $pdo->prepare("UPDATE schools SET subscription_end = :end, status = :school_status WHERE id = :school_id");
                    $upSchool->execute([
                        'end' => $expiry,
                        'school_status' => ($newStatus === 'Expired' || $newStatus === 'Trial Expired') ? 'Inactive' : 'Active',
                        'school_id' => $schoolId
                    ]);
                    
                    // Audit log on transition to expired
                    if (($newStatus === 'Expired' || $newStatus === 'Trial Expired') && ($sub['status'] !== 'Expired' && $sub['status'] !== 'Trial Expired')) {
                        $schStmt = $pdo->prepare("SELECT name FROM schools WHERE id = :id");
                        $schStmt->execute(['id' => $schoolId]);
                        $schName = $schStmt->fetchColumn() ?: 'Unknown School';
                        
                        $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Expired', 'System', :school_name, :plan_name)");
                        $logStmt->execute([
                            'school_name' => $schName,
                            'plan_name' => $planName ?: 'Unknown Plan'
                        ]);
                    }
                }
                
                if ($newStatus === 'Expired' || $newStatus === 'Trial Expired') {
                    $response = new \Slim\Psr7\Response();
                    $response->getBody()->write(json_encode([
                        'detail' => 'Subscription Expired. Please contact the platform administrator to renew your plan.',
                        'subscription_expired' => true,
                        'status' => $newStatus
                    ]));
                    return $response
                        ->withStatus(402)
                        ->withHeader('Content-Type', 'application/json')
                        ->withHeader('Access-Control-Allow-Origin', '*')
                        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
                        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                }
            } else {
                // No subscription found
                $response = new \Slim\Psr7\Response();
                $response->getBody()->write(json_encode([
                    'detail' => 'No active subscription found. Please contact the platform administrator.',
                    'subscription_expired' => true,
                    'status' => 'Expired'
                ]));
                return $response
                    ->withStatus(402)
                    ->withHeader('Content-Type', 'application/json')
                    ->withHeader('Access-Control-Allow-Origin', '*')
                    ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
                    ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            }
        } catch (\Exception $e) {
            // Bypass if database check fails or is not ready
        }
    }
    
    return $handler->handle($request);
});

$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// Error Middleware
$errorMiddleware = $app->addErrorMiddleware(true, true, true);
$errorMiddleware->setDefaultErrorHandler(function (
    Request $request,
    \Throwable $exception,
    bool $displayErrorDetails,
    bool $logErrors,
    bool $logErrorDetails
) use ($app) {
    $response = $app->getResponseFactory()->createResponse();
    return jsonResponse($response, [
        'detail' => $exception->getMessage()
    ], 500);
});

// Handle OPTIONS Preflight
$app->options('/{routes:.+}', function (Request $request, Response $response) {
    return $response;
});

// Sandbox Outgoing Email Trigger Route (Works even when MySQL is offline)
$app->post('/api/sandbox/send-email', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $email = $data['email'] ?? '';
    $name = $data['name'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($email) || empty($name) || empty($password)) {
        return jsonResponse($response, ['detail' => 'Email, Name, and Password are required.'], 400);
    }
    
    // Save the user in mock_users.json dynamically (persistent across browser origins!)
    $mockUsersFile = __DIR__ . '/../mock_users.json';
    $mockUsers = [];
    if (file_exists($mockUsersFile)) {
        $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
    }
    
    $hashedPassword = password_hash(hash('sha256', $password), PASSWORD_BCRYPT);
    $found = false;
    foreach ($mockUsers as &$u) {
        if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
            $u['password'] = $hashedPassword;
            $u['setup_completed'] = 0;
            $u['school_name'] = $name;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $mockUsers[] = [
            'email' => $email,
            'password' => $hashedPassword,
            'role' => 'School Admin',
            'school_id' => count($mockUsers) + 3, // school ids start after mock defaults
            'setup_completed' => 0,
            'school_name' => $name
        ];
    }
    file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
    
    $sent = sendCredentialsEmail($email, $name, $password);
    
    return jsonResponse($response, [
        'success' => $sent,
        'message' => $sent ? 'Invitation email sent successfully.' : 'SMTP email delivery failed. Credentials logged locally.'
    ]);
});

// Update Sandbox setup wizard progress (Works when MySQL is offline)
$app->put('/api/sandbox/setup-completed', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $email = $data['email'] ?? '';
    
    if (empty($email)) {
        return jsonResponse($response, ['detail' => 'Email is required.'], 400);
    }
    
    $mockUsersFile = __DIR__ . '/../mock_users.json';
    if (file_exists($mockUsersFile)) {
        $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
        foreach ($mockUsers as &$u) {
            if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                $u['setup_completed'] = 1;
                break;
            }
        }
        file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
    }
    return jsonResponse($response, ['success' => true]);
});

// Auth identify route migrated to AuthController

// Auth login route migrated to AuthController

// Auth otp-login and hash-defaults routes migrated to AuthController

// Auth forgot-password, verify-otp, reset-password and verify-password routes migrated to AuthController

// --- LEGACY SUPER ADMIN ROUTES MIGRATED TO PLATFORM CONTROLLER ---

// --- ADMIN PROFILE ENDPOINTS ---

$app->get('/api/profile', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $userId = $auth['sub'];
    
    if ($userId === 0 || strpos($request->getHeaderLine('Authorization'), 'mock-') !== false) {
        $role = $auth['role'];
        $email = $auth['email'];
        
        $schoolName = 'BN School';
        $schoolEmail = 'school.admin@domain.com';
        $schoolPhone = '9876543210';
        $schoolAddress = '123 School Lane';
        $schoolCity = 'Lucknow';
        $schoolState = 'Uttar Pradesh';
        $schoolCountry = 'India';
        
        if ($role === 'Super Admin') {
            $schoolName = 'Platform Administration';
            $schoolEmail = 'support@bncollegeportal.com';
        }
        
        $mockProfile = [
            'id' => $userId,
            'email' => $email,
            'name' => $role === 'Super Admin' ? 'Bilal Ahmed' : 'School Admin',
            'phone' => '8650302499',
            'address' => '123 Main Street',
            'city' => 'Lucknow',
            'state' => 'Uttar Pradesh',
            'country' => 'India',
            'timezone' => 'Asia/Kolkata',
            'profile_image' => null,
            'role' => $role,
            'created_at' => date('Y-m-d H:i:s', strtotime('-30 days')),
            'last_login_at' => date('Y-m-d H:i:s'),
            'school_name' => $schoolName,
            'school_email' => $schoolEmail,
            'school_phone' => $schoolPhone,
            'school_address' => $schoolAddress,
            'school_city' => $schoolCity,
            'school_state' => $schoolState,
            'school_country' => $schoolCountry,
            'school_contact_person' => 'Principal John Doe',
            'school_logo_path' => 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234f46e5"/><path d="M50 25 L80 40 L50 55 L20 40 Z" fill="%23ffffff"/><path d="M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5" fill="%23ffffff" opacity="0.9"/><path d="M72 43 L72 65 L75 65 L75 43 Z" fill="%23f59e0b"/><circle cx="73.5" cy="67" r="3" fill="%23f59e0b"/></svg>',
            'subscription' => $role === 'School Admin' ? [
                'plan_name' => 'Free Trial',
                'status' => 'Trial Active',
                'start_date' => date('Y-m-d', strtotime('-5 days')),
                'expiry_date' => date('Y-m-d', strtotime('+25 days')),
                'remaining_days' => 25,
                'description' => '30 Days Free Trial access to all features.'
            ] : null
        ];
        return jsonResponse($response, $mockProfile);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("
        SELECT u.id, u.email, u.name, u.phone, u.address, u.city, u.state, u.country, u.timezone, u.profile_image, u.role, u.created_at, u.last_login_at,
               s.name AS school_name, s.email AS school_email, s.contact_number AS school_phone, s.address AS school_address, s.contact_person AS school_contact_person, s.logo_path AS school_logo_path, u.school_id
        FROM users u
        LEFT JOIN schools s ON u.school_id = s.id
        WHERE u.id = :id
    ");
    $stmt->execute(['id' => $userId]);
    $profile = $stmt->fetch();
    
    if (!$profile) {
        return jsonResponse($response, ['detail' => 'User profile not found.'], 404);
    }

    if ($profile['role'] === 'School Admin' && $profile['school_id']) {
        $subStmt = $pdo->prepare("
            SELECT ss.start_date, ss.expiry_date, ss.remaining_days, ss.status, sp.name AS plan_name, sp.description
            FROM school_subscriptions ss
            JOIN subscription_plans sp ON ss.plan_id = sp.id
            WHERE ss.school_id = :school_id
            LIMIT 1
        ");
        $subStmt->execute(['school_id' => $profile['school_id']]);
        $sub = $subStmt->fetch();
        
        if ($sub) {
            $today = date('Y-m-d');
            $diff = (strtotime($sub['expiry_date']) - strtotime($today)) / (60 * 60 * 24);
            $remaining = max(0, (int)ceil($diff));
            $sub['remaining_days'] = $remaining;
            
            $isTrial = (stripos($sub['plan_name'], 'Trial') !== false);
            if ($remaining <= 0) {
                $sub['status'] = $isTrial ? 'Trial Expired' : 'Expired';
            } else if ($remaining < 15) {
                $sub['status'] = 'Expiring Soon';
            } else {
                $sub['status'] = $isTrial ? 'Trial Active' : 'Active';
            }
            
            $profile['subscription'] = $sub;
        } else {
            $profile['subscription'] = null;
        }
    } else {
        $profile['subscription'] = null;
    }
    
    return jsonResponse($response, $profile);
});

$app->put('/api/profile', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $userId = $auth['sub'];
    $data = getJsonData($request);
    
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $address = trim($data['address'] ?? '');
    $city = trim($data['city'] ?? '');
    $state = trim($data['state'] ?? '');
    $country = trim($data['country'] ?? '');
    $timezone = trim($data['timezone'] ?? 'Asia/Kolkata');
    $profile_image = $data['profile_image'] ?? null;
    
    if (empty($name) || empty($email)) {
        return jsonResponse($response, ['detail' => 'Name and Email are mandatory fields.'], 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return jsonResponse($response, ['detail' => 'Please enter a valid email address.'], 400);
    }
    
    if (!empty($phone) && !preg_match('/^\d{10}$/', $phone)) {
        return jsonResponse($response, ['detail' => 'Phone number must contain exactly 10 digits.'], 400);
    }
    
    if ($userId === 0 || strpos($request->getHeaderLine('Authorization'), 'mock-') !== false) {
        return jsonResponse($response, [
            'success' => true, 
            'profile' => [
                'name' => $name, 'email' => $email, 'phone' => $phone, 'address' => $address,
                'city' => $city, 'state' => $state, 'country' => $country, 'timezone' => $timezone, 'profile_image' => $profile_image
            ]
        ]);
    }
    
    $pdo = getDb();
    
    $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = :email AND id != :id");
    $chk->execute(['email' => $email, 'id' => $userId]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'This email address is already in use by another user.'], 400);
    }
    
    $stmt = $pdo->prepare("
        UPDATE users 
        SET name = :name, email = :email, phone = :phone, address = :address, 
            city = :city, state = :state, country = :country, timezone = :timezone, profile_image = :profile_image
        WHERE id = :id
    ");
    $stmt->execute([
        'name' => $name,
        'email' => $email,
        'phone' => empty($phone) ? null : $phone,
        'address' => empty($address) ? null : $address,
        'city' => empty($city) ? null : $city,
        'state' => empty($state) ? null : $state,
        'country' => empty($country) ? null : $country,
        'timezone' => $timezone,
        'profile_image' => $profile_image,
        'id' => $userId
    ]);
    
    logAudit($pdo, $auth['school_id'], $email, 'Update Profile', "Updated profile details for admin user.");
    
    return jsonResponse($response, ['success' => true, 'message' => 'Profile updated successfully.']);
});

$app->put('/api/profile/password', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $userId = $auth['sub'];
    $data = getJsonData($request);
    
    $currentPassword = $data['current_password'] ?? '';
    $newPassword = $data['new_password'] ?? '';
    $confirmPassword = $data['confirm_password'] ?? '';
    
    if (empty($currentPassword) || empty($newPassword) || empty($confirmPassword)) {
        return jsonResponse($response, ['detail' => 'All password fields are required.'], 400);
    }
    
    if ($newPassword !== $confirmPassword) {
        return jsonResponse($response, ['detail' => 'New password and confirmation password do not match.'], 400);
    }
    $isSha256 = (strlen($newPassword) === 64 && preg_match('/^[0-9a-f]{64}$/i', $newPassword));
    if (!$isSha256) {
        if (strlen($newPassword) < 8) {
            return jsonResponse($response, ['detail' => 'New password must be at least 8 characters long.'], 400);
        }
        if (!preg_match('/[A-Z]/', $newPassword)) {
            return jsonResponse($response, ['detail' => 'New password must contain at least one uppercase letter.'], 400);
        }
        if (!preg_match('/[a-z]/', $newPassword)) {
            return jsonResponse($response, ['detail' => 'New password must contain at least one lowercase letter.'], 400);
        }
        if (!preg_match('/[0-9]/', $newPassword)) {
            return jsonResponse($response, ['detail' => 'New password must contain at least one number.'], 400);
        }
        if (!preg_match('/[!@#$%^&*()_+={}\[\]|\\\\:;\"\'<>,.?\/~`\-]/', $newPassword)) {
            return jsonResponse($response, ['detail' => 'New password must contain at least one special character.'], 400);
        }
    }
    
    if ($userId === 0 || strpos($request->getHeaderLine('Authorization'), 'mock-') !== false) {
        return jsonResponse($response, ['success' => true, 'message' => 'Password updated successfully.']);
    }
    
    $pdo = getDb();
    
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $userId]);
    $userPassword = $stmt->fetchColumn();
    
    if (!$userPassword || !password_verify($currentPassword, $userPassword)) {
        return jsonResponse($response, ['detail' => 'Current password entered is incorrect.'], 400);
    }
    
    $hashed = password_hash($newPassword, PASSWORD_BCRYPT);
    $upd = $pdo->prepare("UPDATE users SET password = :password WHERE id = :id");
    $upd->execute(['password' => $hashed, 'id' => $userId]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Change Password', "Admin updated account password securely.");
    
    return jsonResponse($response, ['success' => true, 'message' => 'Password updated successfully.']);
});

// School Configuration
$app->get('/api/school', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schools = getMockSchools();
        $school = null;
        foreach ($schools as $s) {
            if (strval($s['id']) === strval($auth['school_id'])) {
                $school = $s;
                break;
            }
        }
        if (!$school) {
            return jsonResponse($response, ['detail' => 'School not found in mock data'], 404);
        }
    } else {
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $stmt->execute(['id' => $auth['school_id']]);
        $school = $stmt->fetch();
        
        if (!$school) {
            return jsonResponse($response, ['detail' => 'School not found'], 404);
        }
    }
    
    if (empty($school['currency'])) {
        $school['currency'] = 'INR';
    }
    if (empty($school['school_start_time'])) {
        $school['school_start_time'] = '08:00 AM';
    }
    if (!isset($school['period_duration']) || $school['period_duration'] === null) {
        $school['period_duration'] = 40;
    }
    if (!isset($school['interval_duration']) || $school['interval_duration'] === null) {
        $school['interval_duration'] = 20;
    }
    if (!isset($school['interval_after_period']) || $school['interval_after_period'] === null) {
        $school['interval_after_period'] = 4;
    }
    if (!isset($school['total_periods']) || $school['total_periods'] === null) {
        $school['total_periods'] = 8;
    }
    
    return jsonResponse($response, $school);
});

$app->put('/api/school/timetable-config', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $schoolStartTime = trim($data['school_start_time'] ?? '08:00 AM');
    $periodDuration = intval($data['period_duration'] ?? 40);
    $intervalDuration = intval($data['interval_duration'] ?? 20);
    $intervalAfterPeriod = intval($data['interval_after_period'] ?? 4);
    $totalPeriods = intval($data['total_periods'] ?? 8);
    
    // Validations
    if ($periodDuration <= 0) {
        return jsonResponse($response, ['detail' => 'Period Duration must be greater than 0.'], 400);
    }
    if ($totalPeriods <= 0) {
        return jsonResponse($response, ['detail' => 'Total Periods must be greater than 0.'], 400);
    }
    if ($intervalDuration < 0) {
        return jsonResponse($response, ['detail' => 'Interval Duration cannot be negative.'], 400);
    }
    if ($intervalAfterPeriod < 0 || $intervalAfterPeriod > $totalPeriods) {
        return jsonResponse($response, ['detail' => 'Interval After Period must be between 0 and Total Periods.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schools = getMockSchools();
        $foundIdx = -1;
        foreach ($schools as $idx => $s) {
            if (strval($s['id']) === strval($auth['school_id'])) {
                $foundIdx = $idx;
                break;
            }
        }
        if ($foundIdx !== -1) {
            $schools[$foundIdx]['school_start_time'] = $schoolStartTime;
            $schools[$foundIdx]['period_duration'] = $periodDuration;
            $schools[$foundIdx]['interval_duration'] = $intervalDuration;
            $schools[$foundIdx]['interval_after_period'] = $intervalAfterPeriod;
            $schools[$foundIdx]['total_periods'] = $totalPeriods;
            saveMockSchools($schools);
        }
    } else {
        $stmt = $pdo->prepare("
            UPDATE schools 
            SET school_start_time = :school_start_time,
                period_duration = :period_duration,
                interval_duration = :interval_duration,
                interval_after_period = :interval_after_period,
                total_periods = :total_periods
            WHERE id = :id
        ");
        $stmt->execute([
            'school_start_time' => $schoolStartTime,
            'period_duration' => $periodDuration,
            'interval_duration' => $intervalDuration,
            'interval_after_period' => $intervalAfterPeriod,
            'total_periods' => $totalPeriods,
            'id' => $auth['school_id']
        ]);
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Update Timetable Config', "Updated timetable configuration: Start $schoolStartTime, Period $periodDuration mins, Recess $intervalDuration mins after Period $intervalAfterPeriod, Total $totalPeriods periods.");
    }
    
    return jsonResponse($response, [
        'success' => true,
        'school_start_time' => $schoolStartTime,
        'period_duration' => $periodDuration,
        'interval_duration' => $intervalDuration,
        'interval_after_period' => $intervalAfterPeriod,
        'total_periods' => $totalPeriods
    ]);
});

$app->put('/api/school/currency', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $currency = trim($data['currency'] ?? '');
    
    if (empty($currency)) {
        return jsonResponse($response, ['detail' => 'Currency is required'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("UPDATE schools SET currency = :currency WHERE id = :id");
    $stmt->execute(['currency' => $currency, 'id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Update Currency', "Updated default currency to $currency.");
    
    return jsonResponse($response, ['success' => true, 'currency' => $currency]);
});


$app->put('/api/school/setup', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'School Admin' || !$auth['school_id']) {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $schoolId = $auth['school_id'];
    $data = getJsonData($request);
    
    $name = $data['name'] ?? '';
    $address = $data['address'] ?? '';
    $contact_person = $data['contact_person'] ?? '';
    $contact_number = $data['contact_number'] ?? '';
    $logo_path = $data['logo_path'] ?? '';
    
    if (empty($name) || empty($address) || empty($contact_person) || empty($contact_number)) {
        return jsonResponse($response, ['detail' => 'School Name, Address, Contact Person, and Contact Number are required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Update mock_schools.json
        $schools = getMockSchools();
        $foundIdx = -1;
        foreach ($schools as $idx => $s) {
            if (strval($s['id']) === strval($schoolId)) {
                $foundIdx = $idx;
                break;
            }
        }
        
        if ($foundIdx !== -1) {
            $schools[$foundIdx]['name'] = $name;
            $schools[$foundIdx]['address'] = $address;
            $schools[$foundIdx]['contact_person'] = $contact_person;
            $schools[$foundIdx]['contact_number'] = $contact_number;
            $schools[$foundIdx]['logo_path'] = $logo_path;
            $schools[$foundIdx]['status'] = 'Active';
            $schools[$foundIdx]['setup_completed'] = 1;
        } else {
            // Append new mock school record dynamically
            $schools[] = [
                'id' => (int)$schoolId,
                'name' => $name,
                'code' => 'SCH-' . strtoupper(substr(uniqid(), -6)),
                'contact_person' => $contact_person,
                'contact_number' => $contact_number,
                'email' => $auth['email'],
                'address' => $address,
                'logo_path' => $logo_path,
                'subscription_start' => date('Y-m-d'),
                'subscription_end' => date('Y-m-d', strtotime('+30 days')),
                'status' => 'Active',
                'setup_completed' => 1
            ];
        }
        saveMockSchools($schools);
        
        
        // Update mock_users.json
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            foreach ($mockUsers as &$u) {
                if (trim(strtolower($u['email'])) === trim(strtolower($auth['email']))) {
                    $u['setup_completed'] = 1;
                    $u['school_name'] = $name;
                    break;
                }
            }
            file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
        }
        
        // Regenerate Token with setup_completed = 1
        $newToken = generateJwt($auth['sub'], $auth['email'], $auth['role'], $schoolId, 1);
        
        return jsonResponse($response, [
            'success' => true,
            'access_token' => $newToken,
            'message' => 'School configuration initialized successfully.'
        ]);
    }
    
    $stmt = $pdo->prepare("UPDATE schools SET name = :name, address = :address, contact_person = :contact_person, contact_number = :contact_number, logo_path = :logo_path, status = 'Active', setup_completed = 1 WHERE id = :id");
    $stmt->execute([
        'name' => $name,
        'address' => $address,
        'contact_person' => $contact_person,
        'contact_number' => $contact_number,
        'logo_path' => $logo_path,
        'id' => $schoolId
    ]);
    
    logAudit($pdo, $schoolId, $auth['email'], 'Setup Wizard', 'Completed Setup Wizard. School initialized.');
    
    // Regenerate Token with setup_completed = 1
    $newToken = generateJwt($auth['sub'], $auth['email'], $auth['role'], $schoolId, 1);
    
    return jsonResponse($response, [
        'success' => true,
        'access_token' => $newToken,
        'message' => 'School configuration initialized successfully.'
    ]);
});


// --- TENANT PROTECTED ROUTES GROUP ---
// --- LEGACY ACADEMIC YEARS ROUTES MIGRATED TO ACADEMIC CONTROLLER ---


// Legacy route $app->get('/api/class-fees' migrated to FinanceController

// Legacy route $app->post('/api/class-fees' migrated to FinanceController

// Legacy route $app->get('/api/reports/cross-year' migrated to FinanceController


// Classrooms
// --- LEGACY CLASSROOMS AND CLASS TEACHERS ROUTES MIGRATED TO ACADEMIC CONTROLLER ---


// --- LEGACY PORTAL, SALARY AND STUDENT FEES ROUTES CLEANED UP & MIGRATED ---

// Dashboard Stats
$app->get('/api/dashboard/stats', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $schoolId = $auth['school_id'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Core school counts
    $studStmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :sid AND academic_year_id = :ay");
    $studStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $total_students = (int)$studStmt->fetchColumn();
    
    $teachStmt = $pdo->prepare("SELECT COUNT(*) FROM teachers WHERE school_id = :sid");
    $teachStmt->execute(['sid' => $schoolId]);
    $total_teachers = (int)$teachStmt->fetchColumn();
    
    $classStmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = :sid");
    $classStmt->execute(['sid' => $schoolId]);
    $active_classes = (int)$classStmt->fetchColumn();
    
    // Pending fees & salaries
    $feePendingStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records WHERE school_id = :sid AND status = 'Pending' AND academic_year_id = :ay");
    $feePendingStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $pending_fees_tuition = (int)$feePendingStmt->fetchColumn();

    $extraPendingStmt = $pdo->prepare("SELECT COUNT(*) FROM student_extra_fees WHERE school_id = :sid AND status = 'Pending' AND academic_year_id = :ay");
    $extraPendingStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $pending_fees_extra = (int)$extraPendingStmt->fetchColumn();

    $pending_fees = $pending_fees_tuition + $pending_fees_extra;
    
    $salPendingStmt = $pdo->prepare("SELECT COUNT(*) FROM salary_records WHERE school_id = :sid AND status = 'Pending' AND academic_year_id = :ay");
    $salPendingStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $pending_salaries = (int)$salPendingStmt->fetchColumn();
    
    // Revenue sum (this year paid fees + extra fees)
    $revStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE school_id = :sid AND status = 'Paid' AND academic_year_id = :ay");
    $revStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $tuition_revenue = (float)$revStmt->fetchColumn() ?: 0.0;

    $extraRevStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef
                                   JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                                   WHERE sef.school_id = :sid AND sef.status = 'Paid' AND sef.academic_year_id = :ay");
    $extraRevStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $extra_revenue = (float)$extraRevStmt->fetchColumn() ?: 0.0;

    // Previous year recoveries in current academic year
    $recoveryStmt = $pdo->prepare("SELECT SUM(pyr.amount_recovered) AS total_recovered
                                   FROM previous_year_recoveries pyr
                                   WHERE pyr.school_id = :sid AND pyr.academic_year_id = :ay");
    $recoveryStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $recovery_revenue = (float)($recoveryStmt->fetchColumn() ?: 0.00);

    // Carry forward pending dues
    $cfdPendingStmt = $pdo->prepare("SELECT SUM(cfd.amount - cfd.paid_amount) AS total_pending, COUNT(DISTINCT cfd.student_id) AS student_count
                                     FROM carry_forward_dues cfd
                                     JOIN students s ON cfd.student_id = s.id
                                     WHERE s.school_id = :sid AND s.academic_year_id = :ay AND cfd.status = 'Pending'");
    $cfdPendingStmt->execute(['sid' => $schoolId, 'ay' => $ay_id]);
    $cfdPendingRow = $cfdPendingStmt->fetch(PDO::FETCH_ASSOC);
    $cfd_pending_amount = (float)($cfdPendingRow['total_pending'] ?? 0.00);
    $cfd_pending_students = (int)($cfdPendingRow['student_count'] ?? 0);

    $monthly_revenue = $tuition_revenue + $extra_revenue + $recovery_revenue;
    
    // Monthly chart details
    $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    $chartFees = [];
    $chartSalaries = [];
    
    $feesChartStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE school_id = :sid AND month = :m AND status = 'Paid' AND academic_year_id = :ay");
    $extraChartStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef
                                     JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                                     WHERE sef.school_id = :sid 
                                       AND sef.status = 'Paid' 
                                       AND sef.academic_year_id = :ay 
                                       AND (
                                         (sef.payment_date IS NOT NULL AND MONTHNAME(sef.payment_date) = :m)
                                         OR
                                         (sef.payment_date IS NULL AND sef.paid_at IS NOT NULL AND MONTHNAME(sef.paid_at) = :m)
                                       )");
    $recChartStmt = $pdo->prepare("SELECT SUM(pyr.amount_recovered) FROM previous_year_recoveries pyr
                                   WHERE pyr.school_id = :sid 
                                     AND pyr.academic_year_id = :ay 
                                     AND MONTHNAME(pyr.recovery_date) = :m");
    $salChartStmt = $pdo->prepare("SELECT SUM(amount) FROM salary_records WHERE school_id = :sid AND month = :m AND status = 'Paid' AND academic_year_id = :ay");
    
    foreach ($months as $m) {
        $feesChartStmt->execute(['sid' => $schoolId, 'm' => $m, 'ay' => $ay_id]);
        $tuition_amount = (float)$feesChartStmt->fetchColumn() ?: 0.0;

        $extraChartStmt->execute(['sid' => $schoolId, 'm' => $m, 'ay' => $ay_id]);
        $extra_amount = (float)$extraChartStmt->fetchColumn() ?: 0.0;

        $recChartStmt->execute(['sid' => $schoolId, 'm' => $m, 'ay' => $ay_id]);
        $rec_amount = (float)$recChartStmt->fetchColumn() ?: 0.0;
        
        $chartFees[] = [
            'month' => $m,
            'amount' => $tuition_amount + $extra_amount + $rec_amount
        ];
        
        $salChartStmt->execute(['sid' => $schoolId, 'm' => $m, 'ay' => $ay_id]);
        $chartSalaries[] = [
            'month' => $m,
            'amount' => (float)$salChartStmt->fetchColumn() ?: 0.0
        ];
    }
    
    return jsonResponse($response, [
        'total_students' => $total_students,
        'total_teachers' => $total_teachers,
        'pending_fees_count' => $pending_fees,
        'pending_salaries_count' => $pending_salaries,
        'monthly_revenue' => $monthly_revenue,
        'active_classes' => $active_classes,
        'attendance_overview' => '96.4% Avg',
        'carry_forward_pending_amount' => $cfd_pending_amount,
        'carry_forward_pending_students' => $cfd_pending_students,
        'previous_year_recovery_amount' => $recovery_revenue,
        'charts' => [
            'fee_collection' => $chartFees,
            'salary_expense' => $chartSalaries
        ]
    ]);
});

// Notifications
$app->get('/api/notifications', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    
    // Auto populate if empty
    $chk = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE school_id = :sid");
    $chk->execute(['sid' => $auth['school_id']]);
    if ($chk->fetchColumn() == 0) {
        $ins = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read) VALUES (:sid, 'Welcome to SP Portal', 'Complete school setup configuration to access rosters and ledgers.', 'System', NOW(), 0)");
        $ins->execute(['sid' => $auth['school_id']]);
    }

    // Dynamically insert test notifications for dd@yopmail.com if not already there
    if ($auth['email'] === 'dd@yopmail.com') {
        $chkTest = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE school_id = :sid AND title = 'Subscription Renewed'");
        $chkTest->execute(['sid' => $auth['school_id']]);
        if ($chkTest->fetchColumn() == 0) {
            $notifs = [
                [
                    'title' => 'Subscription Expiry Reminder',
                    'content' => 'Your subscription will expire in 30 days.',
                    'timestamp' => date('Y-m-d H:i:s', strtotime('-5 days')),
                    'created_at' => date('Y-m-d H:i:s', strtotime('-5 days'))
                ],
                [
                    'title' => 'Subscription Expiry Reminder',
                    'content' => 'Your subscription will expire in 7 days.',
                    'timestamp' => date('Y-m-d H:i:s', strtotime('-2 days')),
                    'created_at' => date('Y-m-d H:i:s', strtotime('-2 days'))
                ],
                [
                    'title' => 'Subscription Expiry Reminder',
                    'content' => 'Your subscription will expire in 3 days.',
                    'timestamp' => date('Y-m-d H:i:s', strtotime('-1 day')),
                    'created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))
                ],
                [
                    'title' => 'Subscription Expiry Reminder',
                    'content' => 'Your subscription will expire tomorrow.',
                    'timestamp' => date('Y-m-d H:i:s', strtotime('-12 hours')),
                    'created_at' => date('Y-m-d H:i:s', strtotime('-12 hours'))
                ],
                [
                    'title' => 'Subscription Renewed',
                    'content' => 'Subscription renewed successfully.',
                    'timestamp' => date('Y-m-d H:i:s'),
                    'created_at' => date('Y-m-d H:i:s')
                ]
            ];
            foreach ($notifs as $n) {
                $insStmt = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, created_at) VALUES (:sid, :title, :content, 'Subscription', :timestamp, 0, :created_at)");
                $insStmt->execute([
                    'sid' => $auth['school_id'],
                    'title' => $n['title'],
                    'content' => $n['content'],
                    'timestamp' => $n['timestamp'],
                    'created_at' => $n['created_at']
                ]);
            }
        }
    }
    
    // Check and generate dynamic subscription expiry notifications
    $subStmt = $pdo->prepare("SELECT * FROM school_subscriptions WHERE school_id = :sid LIMIT 1");
    $subStmt->execute(['sid' => $auth['school_id']]);
    $sub = $subStmt->fetch();
    if ($sub) {
        $today = date('Y-m-d');
        $expiry = $sub['expiry_date'];
        $diff = (strtotime($expiry) - strtotime($today)) / (60 * 60 * 24);
        $remaining = (int)ceil($diff);
        
        $daysToAlert = [30, 7, 3, 1];
        if (in_array($remaining, $daysToAlert)) {
            if ($remaining === 30) {
                $content = "Your subscription will expire in 30 days.";
            } else if ($remaining === 7) {
                $content = "Your subscription will expire in 7 days.";
            } else if ($remaining === 3) {
                $content = "Your subscription will expire in 3 days.";
            } else if ($remaining === 1) {
                $content = "Your subscription will expire tomorrow.";
            }
            
            $title = "Subscription Expiry Reminder";
            $chkExist = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE school_id = :sid AND title = :title AND content = :content");
            $chkExist->execute(['sid' => $auth['school_id'], 'title' => $title, 'content' => $content]);
            if ($chkExist->fetchColumn() == 0) {
                $ins = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read) VALUES (:sid, :title, :content, 'Subscription', NOW(), 0)");
                $ins->execute([
                    'sid' => $auth['school_id'],
                    'title' => $title,
                    'content' => $content
                ]);
            }
        }
    }

    $roleName = $auth['role'];
    if ($roleName === 'Parent') {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE school_id = :sid AND target_user_id = :uid ORDER BY id DESC");
        $stmt->execute(['sid' => $auth['school_id'], 'uid' => $auth['id']]);
    } else {
        $allowedClasses = getAuthorizedClassrooms($pdo, $auth);
        if ($allowedClasses !== null) {
            if (empty($allowedClasses)) {
                // Not a class teacher, only show system alerts
                $stmt = $pdo->prepare("SELECT * FROM notifications WHERE school_id = :sid AND target_class_id IS NULL AND target_user_id IS NULL ORDER BY id DESC");
                $stmt->execute(['sid' => $auth['school_id']]);
            } else {
                $placeholders = implode(',', array_fill(0, count($allowedClasses), '?'));
                $stmt = $pdo->prepare("SELECT * FROM notifications WHERE school_id = ? 
                                       AND (
                                            (target_class_id IS NULL AND target_user_id IS NULL)
                                            OR target_class_id IN ($placeholders)
                                       ) ORDER BY id DESC");
                $queryParams = array_merge([$auth['school_id']], $allowedClasses);
                $stmt->execute($queryParams);
            }
        } else {
            // School Admin: see all alerts except parent specific ones
            $stmt = $pdo->prepare("SELECT * FROM notifications WHERE school_id = :sid AND target_user_id IS NULL ORDER BY id DESC");
            $stmt->execute(['sid' => $auth['school_id']]);
        }
    }
    return jsonResponse($response, $stmt->fetchAll());
});

// Mark all notifications as read
$app->post('/api/notifications/read', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE school_id = :sid");
    $stmt->execute(['sid' => $auth['school_id']]);
    
    return jsonResponse($response, ['success' => true]);
});

// --- Dynamic Role and Classroom Authorization Helpers ---
function getTeacherIdForUser($pdo, $schoolId, $emailOrPhone) {
    if (empty($emailOrPhone)) return null;
    $stmt = $pdo->prepare("SELECT id FROM teachers WHERE school_id = :sid AND (email = :input OR phone = :input) LIMIT 1");
    $stmt->execute(['sid' => $schoolId, 'input' => $emailOrPhone]);
    return $stmt->fetchColumn() ?: null;
}

function getAuthorizedClassrooms($pdo, $auth) {
    $roleName = $auth['role'];
    if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
        return null; // Full admin access
    }
    
    $schoolId = $auth['school_id'];
    $teacherId = getTeacherIdForUser($pdo, $schoolId, $auth['email'] ?? $auth['phone'] ?? '');
    
    if (!$teacherId) {
        return [];
    }
    
    $stmt = $pdo->prepare("SELECT id FROM classrooms WHERE school_id = :sid AND class_teacher_id = :tid");
    $stmt->execute(['sid' => $schoolId, 'tid' => $teacherId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
}

// --- Dynamic Roles & Permissions Routes ---
$app->get('/api/roles', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM roles WHERE school_id = :sid OR school_id IS NULL");
    $stmt->execute(['sid' => $auth['school_id']]);
    $roles = $stmt->fetchAll();
    
    foreach ($roles as &$r) {
        $pStmt = $pdo->prepare("SELECT permission_name FROM role_permissions WHERE role_id = :rid");
        $pStmt->execute(['rid' => $r['id']]);
        $r['permissions'] = $pStmt->fetchAll(PDO::FETCH_COLUMN);
    }
    
    return jsonResponse($response, $roles);
});

$app->post('/api/roles', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $permissions = $data['permissions'] ?? [];
    
    if (empty($name)) {
        return jsonResponse($response, ['detail' => 'Role name is required.'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("INSERT INTO roles (school_id, name) VALUES (:sid, :name)");
    $stmt->execute(['sid' => $auth['school_id'], 'name' => $name]);
    $roleId = $pdo->lastInsertId();
    
    foreach ($permissions as $p) {
        $ins = $pdo->prepare("INSERT INTO role_permissions (role_id, permission_name) VALUES (:rid, :p)");
        $ins->execute(['rid' => $roleId, 'p' => $p]);
    }
    
    return jsonResponse($response, ['success' => true, 'id' => $roleId]);
});

$app->post('/api/roles/{id}/permissions', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $roleId = $args['id'];
    $data = getJsonData($request);
    $permissions = $data['permissions'] ?? [];
    
    $pdo = getDb();
    
    // Check if role belongs to this school
    $chk = $pdo->prepare("SELECT school_id FROM roles WHERE id = :rid");
    $chk->execute(['rid' => $roleId]);
    $schId = $chk->fetchColumn();
    if ($schId !== null && (int)$schId !== (int)$auth['school_id']) {
        return jsonResponse($response, ['detail' => 'Access Denied'], 403);
    }
    
    $stmt = $pdo->prepare("DELETE FROM role_permissions WHERE role_id = :rid");
    $stmt->execute(['rid' => $roleId]);
    
    foreach ($permissions as $p) {
        $ins = $pdo->prepare("INSERT INTO role_permissions (role_id, permission_name) VALUES (:rid, :p)");
        $ins->execute(['rid' => $roleId, 'p' => $p]);
    }
    
    return jsonResponse($response, ['success' => true]);
});

$app->delete('/api/roles/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("DELETE FROM roles WHERE id = :id AND school_id = :sid");
    $stmt->execute(['id' => $args['id'], 'sid' => $auth['school_id']]);
    
    return jsonResponse($response, ['success' => true]);
});

// --- Credentials Management Endpoints ---
$app->get('/api/creds', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $type = trim($params['type'] ?? '');
    $phone = trim($params['phone'] ?? '');
    
    if (empty($type) || empty($phone)) {
        return jsonResponse($response, ['detail' => 'Type and Phone are required.'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone AND role = :role LIMIT 1");
    $stmt->execute(['phone' => $phone, 'role' => $type]);
    $user = $stmt->fetch();
    
    if ($user) {
        $password = decryptPassword($user['plain_encrypted'] ?? '');
        return jsonResponse($response, [
            'exists' => true,
            'phone' => $phone,
            'password' => $password
        ]);
    }
    
    return jsonResponse($response, [
        'exists' => false,
        'phone' => $phone
    ]);
});

$app->post('/api/creds', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $type = trim($data['type'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = trim($data['password'] ?? '');
    
    if (empty($type) || empty($phone) || empty($password)) {
        return jsonResponse($response, ['detail' => 'Type, Phone, and Password are required.'], 400);
    }
    
    $school_id = $auth['school_id'];
    $pdo = getDb();
    
    $sha256_pass = hash('sha256', $password);
    $pw_hash = password_hash($sha256_pass, PASSWORD_BCRYPT);
    $plain_encrypted = encryptPassword($password);
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone AND role = :role LIMIT 1");
    $stmt->execute(['phone' => $phone, 'role' => $type]);
    $user = $stmt->fetch();
    
    if ($user) {
        $upd = $pdo->prepare("UPDATE users SET password = :password, plain_encrypted = :encrypted WHERE id = :id");
        $upd->execute([
            'password' => $pw_hash,
            'encrypted' => $plain_encrypted,
            'id' => $user['id']
        ]);
        $userId = $user['id'];
    } else {
        $ins = $pdo->prepare("INSERT INTO users (school_id, phone, password, plain_encrypted, role, is_active) VALUES (:school_id, :phone, :password, :encrypted, :role, 1)");
        $ins->execute([
            'school_id' => $school_id,
            'phone' => $phone,
            'password' => $pw_hash,
            'encrypted' => $plain_encrypted,
            'role' => $type
        ]);
        $userId = $pdo->lastInsertId();
    }
    
    if ($type === 'Parent') {
        $stmtStud = $pdo->prepare("SELECT id FROM students WHERE school_id = :school_id AND (phone = :phone OR emergency_contact = :phone)");
        $stmtStud->execute(['school_id' => $school_id, 'phone' => $phone]);
        $linkedStudentIds = $stmtStud->fetchAll(PDO::FETCH_COLUMN) ?: [];
        
        $del = $pdo->prepare("DELETE FROM parent_student_mappings WHERE parent_user_id = :uid");
        $del->execute(['uid' => $userId]);
        foreach ($linkedStudentIds as $sid) {
            $insMap = $pdo->prepare("INSERT IGNORE INTO parent_student_mappings (parent_user_id, student_id) VALUES (:uid, :sid)");
            $insMap->execute(['uid' => $userId, 'sid' => $sid]);
        }
    }
    
    return jsonResponse($response, [
        'success' => true,
        'phone' => $phone,
        'password' => $password
    ]);
});

// --- User Account Management Endpoints ---
$app->get('/api/users', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT id, email, phone, role, role_id, is_active, created_at, last_login_at FROM users WHERE school_id = :sid");
    $stmt->execute(['sid' => $auth['school_id']]);
    $users = $stmt->fetchAll();
    
    foreach ($users as &$u) {
        $u['linked_student_ids'] = [];
        if ($u['role'] === 'Parent') {
            $psStmt = $pdo->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :uid");
            $psStmt->execute(['uid' => $u['id']]);
            $u['linked_student_ids'] = $psStmt->fetchAll(PDO::FETCH_COLUMN);
        }
    }
    
    return jsonResponse($response, $users);
});

$app->post('/api/users', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $userId = $data['id'] ?? null;
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';
    $roleName = $data['role'] ?? 'Teacher';
    $roleId = $data['role_id'] ?? null;
    $linkedStudentIds = $data['linked_student_ids'] ?? [];
    
    if (empty($phone) && empty($email)) {
        return jsonResponse($response, ['detail' => 'Email or Mobile Number is required.'], 400);
    }
    
    $pdo = getDb();
    
    if ($userId) {
        // Edit User
        $sql = "UPDATE users SET email = :email, phone = :phone, role = :role, role_id = :role_id";
        $params = [
            'email' => !empty($email) ? $email : null,
            'phone' => !empty($phone) ? $phone : null,
            'role' => $roleName,
            'role_id' => !empty($roleId) ? $roleId : null,
            'id' => $userId,
            'sid' => $auth['school_id']
        ];
        if (!empty($password)) {
            $sql .= ", password = :pw";
            $params['pw'] = password_hash(hash('sha256', $password), PASSWORD_BCRYPT);
        }
        $sql .= " WHERE id = :id AND school_id = :sid";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        // Create User
        if (!empty($phone)) {
            $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE phone = :phone");
            $chk->execute(['phone' => $phone]);
            if ($chk->fetchColumn() > 0) {
                return jsonResponse($response, ['detail' => 'Mobile number is already registered.'], 400);
            }
        }
        if (!empty($email)) {
            $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = :email");
            $chk->execute(['email' => $email]);
            if ($chk->fetchColumn() > 0) {
                return jsonResponse($response, ['detail' => 'Email is already registered.'], 400);
            }
        }
        
        $pw = password_hash(hash('sha256', !empty($password) ? $password : 'Test@123'), PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (school_id, email, phone, password, role, role_id, is_active) 
                               VALUES (:sid, :email, :phone, :pw, :role, :role_id, 1)");
        $stmt->execute([
            'sid' => $auth['school_id'],
            'email' => !empty($email) ? $email : null,
            'phone' => !empty($phone) ? $phone : null,
            'pw' => $pw,
            'role' => $roleName,
            'role_id' => !empty($roleId) ? $roleId : null
        ]);
        $userId = $pdo->lastInsertId();
    }
    
    if ($roleName === 'Parent') {
        $del = $pdo->prepare("DELETE FROM parent_student_mappings WHERE parent_user_id = :uid");
        $del->execute(['uid' => $userId]);
        
        foreach ($linkedStudentIds as $sid) {
            $ins = $pdo->prepare("INSERT INTO parent_student_mappings (parent_user_id, student_id) VALUES (:uid, :sid)");
            $ins->execute(['uid' => $userId, 'sid' => $sid]);
        }
    }
    
    return jsonResponse($response, ['success' => true, 'id' => $userId]);
});

$app->delete('/api/users/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id AND school_id = :sid");
    $stmt->execute(['id' => $args['id'], 'sid' => $auth['school_id']]);
    
    return jsonResponse($response, ['success' => true]);
});

// --- LEGACY PARENT PORTAL ENDPOINTS MIGRATED TO PORTALCONTROLLER ---

// Audit Logs
$app->get('/api/audit-logs', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE school_id = :sid ORDER BY id DESC LIMIT 50");
    $stmt->execute(['sid' => $auth['school_id']]);
    return jsonResponse($response, $stmt->fetchAll());
});

// --- FINANCIAL REPORTS MANAGEMENT ---

// Get Financial Report History
// Legacy route $app->get('/api/financial-reports' migrated to FinanceController

// Ephemeral Preview Report (no database persistence)
// Legacy route $app->get('/api/financial-reports/preview' migrated to FinanceController

// Generate and save report permanently
// Legacy route $app->post('/api/financial-reports' migrated to FinanceController

// --- STRAY LEGACY FINANCE ROUTE BODIES CLEANED UP & MIGRATED ---

// --- LEGACY SUBJECTS AND SCHEDULES ROUTES MIGRATED TO TIMETABLE CONTROLLER ---

// Helper to generate system-prefilled Indian holidays dynamically for a given year range
function getSystemHolidays($start_date, $end_date, $ay_id) {
    if (!$start_date || !$end_date) return [];
    
    $start_dt = new DateTime($start_date);
    $end_dt = new DateTime($end_date);
    $start_year = (int)$start_dt->format('Y');
    $end_year = (int)$end_dt->format('Y');
    
    $candidates = [
        ['title' => "New Year's Day", 'month' => 1, 'day' => 1],
        ['title' => 'Republic Day', 'month' => 1, 'day' => 26],
        ['title' => 'Labour Day', 'month' => 5, 'day' => 1],
        ['title' => 'Independence Day', 'month' => 8, 'day' => 15],
        ['title' => 'Gandhi Jayanti', 'month' => 10, 'day' => 2],
        ['title' => 'Christmas Day', 'month' => 12, 'day' => 25],
    ];
    
    $systemHolidays = [];
    foreach ($candidates as $c) {
        for ($yr = $start_year; $yr <= $end_year; $yr++) {
            $dateStr = sprintf('%04d-%02d-%02d', $yr, $c['month'], $c['day']);
            $dt = new DateTime($dateStr);
            if ($dt >= $start_dt && $dt <= $end_dt) {
                $systemHolidays[] = [
                    'id' => 'system-' . $c['month'] . '-' . $c['day'] . '-' . $yr,
                    'school_id' => 1,
                    'academic_year_id' => $ay_id,
                    'title' => $c['title'],
                    'leave_date' => $dateStr,
                    'description' => 'System generated national/public holiday',
                    'category' => 'System Holiday'
                ];
            }
        }
    }
    return $systemHolidays;
}

// --- Leaves Routes ---
$app->get('/api/leaves', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ayId = (int)($params['academic_year_id'] ?? 0);
    if (!$ayId) {
        return jsonResponse($response, ['detail' => 'academic_year_id is required.'], 400);
    }
    
    $pdo = getDb();
    
    // Fetch manual leaves
    $stmt = $pdo->prepare("SELECT * FROM school_leaves WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY leave_date ASC");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ayId
    ]);
    $leaves = $stmt->fetchAll();
    foreach ($leaves as &$l) {
        $l['id'] = (int)$l['id'];
        $l['school_id'] = (int)$l['school_id'];
        $l['academic_year_id'] = (int)$l['academic_year_id'];
        if (empty($l['category'])) {
            $l['category'] = 'School Holiday';
        }
    }
    
    // Generate system holidays
    $yearStmt = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :id AND school_id = :sid");
    $yearStmt->execute(['id' => $ayId, 'sid' => $auth['school_id']]);
    $activeYear = $yearStmt->fetch();
    
    $systemHolidays = [];
    if ($activeYear) {
        $systemHolidays = getSystemHolidays($activeYear['start_date'], $activeYear['end_date'], $ayId);
    }
    
    // Merge lists
    $allLeaves = array_merge($leaves, $systemHolidays);
    
    // Sort by date ascending
    usort($allLeaves, function ($a, $b) {
        return strcmp($a['leave_date'], $b['leave_date']);
    });
    
    return jsonResponse($response, $allLeaves);
});

$app->post('/api/leaves', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $ayId = (int)($data['academic_year_id'] ?? 0);
    $leaveDate = trim($data['leave_date'] ?? '');
    $title = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    
    if (!$ayId || empty($leaveDate) || empty($title)) {
        return jsonResponse($response, ['detail' => 'academic_year_id, leave_date, and title are required.'], 400);
    }
    
    $pdo = getDb();
    
    // 1. Validate Academic Year Boundary
    $yearStmt = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :id AND school_id = :sid");
    $yearStmt->execute(['id' => $ayId, 'sid' => $auth['school_id']]);
    $activeYear = $yearStmt->fetch();
    if (!$activeYear) {
        return jsonResponse($response, ['detail' => 'Invalid academic year.'], 400);
    }
    if ($leaveDate < $activeYear['start_date'] || $leaveDate > $activeYear['end_date']) {
        return jsonResponse($response, ['detail' => 'Leave date must belong to the active academic session.'], 400);
    }
    
    // 2. Validate Uniqueness (including System Holidays)
    $systemHols = getSystemHolidays($activeYear['start_date'], $activeYear['end_date'], $ayId);
    foreach ($systemHols as $sh) {
        if ($sh['leave_date'] === $leaveDate) {
            return jsonResponse($response, ['detail' => 'A leave has already been declared for this date.'], 400);
        }
    }
    
    $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM school_leaves WHERE school_id = :sid AND academic_year_id = :ay_id AND leave_date = :ld");
    $chkStmt->execute(['sid' => $auth['school_id'], 'ay_id' => $ayId, 'ld' => $leaveDate]);
    if ($chkStmt->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'A leave has already been declared for this date.'], 400);
    }
    
    // 3. Insert Leave
    $stmt = $pdo->prepare("INSERT INTO school_leaves (school_id, academic_year_id, title, category, leave_date, description) VALUES (:sid, :ay_id, :title, 'School Holiday', :ld, :desc)");
    $stmt->execute([
        'sid' => $auth['school_id'],
        'ay_id' => $ayId,
        'title' => $title,
        'ld' => $leaveDate,
        'desc' => !empty($description) ? $description : null
    ]);
    $leaveId = (int)$pdo->lastInsertId();
    
    // 4. Trigger Notifications
    $formattedDate = date('j F Y', strtotime($leaveDate));
    
    // A. Teacher Notification
    $tTitle = "New Holiday Declared";
    $tContent = "School holiday added for {$formattedDate} – {$title}." . ($description ? " Description: {$description}" : "");
    $insTeacher = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read) VALUES (:sid, :title, :content, 'Holiday', NOW(), 0)");
    $insTeacher->execute([
        'sid' => $auth['school_id'],
        'title' => $tTitle,
        'content' => $tContent
    ]);
    
    // B. Parent Notification
    $pTitle = "School Holiday Notice";
    $pContent = "School Holiday Notice: {$title} has been declared for {$formattedDate}." . ($description ? " Description: {$description}" : "");
    
    $parentStmt = $pdo->prepare("
        SELECT DISTINCT psm.parent_user_id 
        FROM parent_student_mappings psm
        JOIN students s ON psm.student_id = s.id
        WHERE s.school_id = :sid AND s.status = 'Active'
    ");
    $parentStmt->execute(['sid' => $auth['school_id']]);
    $parentIds = $parentStmt->fetchAll(PDO::FETCH_COLUMN);
    
    $insParent = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, target_user_id) VALUES (:sid, :title, :content, 'Holiday', NOW(), 0, :puid)");
    foreach ($parentIds as $puid) {
        $insParent->execute([
            'sid' => $auth['school_id'],
            'title' => $pTitle,
            'content' => $pContent,
            'puid' => $puid
        ]);
    }
    
    return jsonResponse($response, [
        'success' => true,
        'id' => $leaveId,
        'notifications_sent' => count($parentIds) + 1
    ]);
});

$app->put('/api/leaves/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $leaveId = (int)$args['id'];
    $data = getJsonData($request);
    $ayId = (int)($data['academic_year_id'] ?? 0);
    $leaveDate = trim($data['leave_date'] ?? '');
    $title = trim($data['title'] ?? '');
    $description = trim($data['description'] ?? '');
    
    if (!$ayId || empty($leaveDate) || empty($title)) {
        return jsonResponse($response, ['detail' => 'academic_year_id, leave_date, and title are required.'], 400);
    }
    
    $pdo = getDb();
    
    // 1. Validate Academic Year Boundary
    $yearStmt = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = :id AND school_id = :sid");
    $yearStmt->execute(['id' => $ayId, 'sid' => $auth['school_id']]);
    $activeYear = $yearStmt->fetch();
    if (!$activeYear) {
        return jsonResponse($response, ['detail' => 'Invalid academic year.'], 400);
    }
    if ($leaveDate < $activeYear['start_date'] || $leaveDate > $activeYear['end_date']) {
        return jsonResponse($response, ['detail' => 'Leave date must belong to the active academic session.'], 400);
    }
    
    // 2. Validate Uniqueness (including System Holidays, excluding current leave ID)
    $systemHols = getSystemHolidays($activeYear['start_date'], $activeYear['end_date'], $ayId);
    foreach ($systemHols as $sh) {
        if ($sh['leave_date'] === $leaveDate) {
            return jsonResponse($response, ['detail' => 'A leave has already been declared for this date.'], 400);
        }
    }
    
    $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM school_leaves WHERE school_id = :sid AND academic_year_id = :ay_id AND leave_date = :ld AND id != :id");
    $chkStmt->execute(['sid' => $auth['school_id'], 'ay_id' => $ayId, 'ld' => $leaveDate, 'id' => $leaveId]);
    if ($chkStmt->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'A leave has already been declared for this date.'], 400);
    }
    
    // 3. Update Leave
    $stmt = $pdo->prepare("UPDATE school_leaves SET title = :title, leave_date = :ld, description = :desc WHERE id = :id AND school_id = :sid");
    $stmt->execute([
        'title' => $title,
        'ld' => $leaveDate,
        'desc' => !empty($description) ? $description : null,
        'id' => $leaveId,
        'sid' => $auth['school_id']
    ]);
    
    return jsonResponse($response, ['success' => true]);
});

$app->delete('/api/leaves/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $leaveId = (int)$args['id'];
    $pdo = getDb();
    $stmt = $pdo->prepare("DELETE FROM school_leaves WHERE id = :id AND school_id = :school_id");
    $stmt->execute([
        'id' => $leaveId,
        'school_id' => $auth['school_id']
    ]);
    return jsonResponse($response, ['success' => true]);
});

// ==========================================
// 🎓 STUDENT PERFORMANCE MODULE ENDPOINTS
// ==========================================

// Run App
$app->run();
