<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/../vendor/autoload.php';

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

$app = AppFactory::create();

// Global Configuration
$db_host = '127.0.0.1';
$db_user = 'root';
$db_pass = 'admin123';
$db_name = 'bn_school_erp';
$jwt_secret = 'super_secret_erp_key_2026';

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
    ";
    
    $pdo->exec($schema);

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
function generateJwt($userId, $email, $role, $schoolId = null, $setupCompleted = 1) {
    global $jwt_secret;
    $payload = [
        'iss' => 'bn_school_erp',
        'iat' => time(),
        'exp' => time() + (3600 * 24), // 24 hours
        'sub' => $userId,
        'email' => $email,
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
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN School ERP Control Panel';
    
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
        $mail->Subject = "Welcome to BN College Portal – Your School ERP Account is Ready";
        
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
                            <p style='color: #94a3b8; margin: 4px 0 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;'>Enterprise School ERP</p>
                        </td>
                    </tr>
                    
                    <!-- Main Body Section -->
                    <tr>
                        <td style='padding: 40px 32px;'>
                            
                            <!-- Main Heading -->
                            <h2 style='margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;'>Welcome to BN College Portal</h2>
                            <p style='margin: 0 0 32px 0; font-size: 14px; color: #64748b; text-align: center; line-height: 1.5;'>Your school ERP account has been successfully created and is ready for setup.</p>
                            
                            <!-- Greeting -->
                            <p style='margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #0f172a;'>Dear School Administrator,</p>
                            <p style='margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;'>
                                Thank you for choosing <strong>BN College Portal</strong>.
                            </p>
                            <p style='margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;'>
                                Your institution has been successfully onboarded to our ERP platform. Please use the credentials below to access your school dashboard and complete the initial setup.
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
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN School ERP Control Panel';
    
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
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN School ERP Control Panel';
    
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
    $fromName = $_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BN School ERP Control Panel';
    
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
        strpos($path, '/api/super-admin/') === 0 ||
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

// --- AUTHENTICATION ROUTE ---
$app->post('/api/auth/login', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $input = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    
    if (trim(strtolower($input)) === 'test@yopmail.com') {
        $input = 'bilalnashi6@gmail.com';
    }
    
    if (empty($input) || empty($password)) {
        return jsonResponse($response, ['detail' => 'Email/Mobile and password are required.'], 400);
    }
    
    $isEmail = filter_var($input, FILTER_VALIDATE_EMAIL) !== false;
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Database connection failed, trigger mock login checking
        if ($input === 'Bilal@yopmail.com' && ($password === 'Bilal@123' || $password === hash('sha256', 'Bilal@123'))) {
            return jsonResponse($response, [
                'access_token' => 'mock-super-token',
                'email' => $input,
                'role' => 'Super Admin',
                'permissions' => ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
                'school_id' => null,
                'setup_completed' => 1
            ]);
        }
        if ($input === 'Admin@yopmail.com' && ($password === 'Admin@123' || $password === hash('sha256', 'Admin@123'))) {
            return jsonResponse($response, [
                'access_token' => 'mock-token',
                'email' => $input,
                'role' => 'School Admin',
                'permissions' => ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
                'school_id' => 1,
                'setup_completed' => 1,
                'school_name' => "St. Xavier's International School"
            ]);
        }
        if ($input === '9876543210' && ($password === 'Test@123' || $password === hash('sha256', 'Test@123'))) {
            return jsonResponse($response, [
                'access_token' => 'mock-parent-token',
                'email' => 'parent@yopmail.com',
                'phone' => '9876543210',
                'role' => 'Parent',
                'permissions' => ['parent_portal'],
                'linked_student_ids' => [1],
                'school_id' => 1,
                'setup_completed' => 1,
                'school_name' => "St. Xavier's International School"
            ]);
        }
        
        // Check dynamic mock users in mock_users.json
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            foreach ($mockUsers as $u) {
                if (trim(strtolower($u['email'] ?? '')) === trim(strtolower($input)) || trim($u['phone'] ?? '') === trim($input)) {
                    $verify = password_verify($password, $u['password']);
                    if ($verify) {
                        $roleName = $u['role'];
                        $perms = [];
                        if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
                            $perms = ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'];
                        } else if ($roleName === 'Parent') {
                            $perms = ['parent_portal'];
                        } else {
                            $perms = ['attendance', 'performance'];
                        }
                        return jsonResponse($response, [
                            'access_token' => 'mock-token-' . $u['school_id'] . '-' . str_replace('/', '_', base64_encode($u['email'] ?? $u['phone'])),
                            'email' => $u['email'] ?? '',
                            'phone' => $u['phone'] ?? '',
                            'role' => $roleName,
                            'permissions' => $perms,
                            'linked_student_ids' => $u['linked_student_ids'] ?? [],
                            'school_id' => $u['school_id'],
                            'setup_completed' => (int)$u['setup_completed'],
                            'school_name' => $u['school_name'] ?? 'BN School'
                        ]);
                    }
                }
            }
        }
        
        return jsonResponse($response, ['detail' => 'Invalid credentials. Please verify and try again.'], 401);
    }
    
    if ($isEmail) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :input LIMIT 1");
    } else {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = :input LIMIT 1");
    }
    $stmt->execute(['input' => $input]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password'])) {
        return jsonResponse($response, ['detail' => 'Invalid credentials. Please verify and try again.'], 401);
    }
    
    if (!$user['is_active']) {
        return jsonResponse($response, ['detail' => 'Account deactivated. Please contact administrator.'], 403);
    }
    
    $school_id = $user['school_id'];
    $setup_completed = 1;
    $school_name = 'BN School';
    
    if ($school_id) {
        $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $schStmt->execute(['id' => $school_id]);
        $school = $schStmt->fetch();
        
        if ($school) {
            if ($school['status'] === 'Inactive') {
                return jsonResponse($response, ['detail' => 'School subscription or account has been deactivated.'], 403);
            }
            
            // Check subscription expiry
            $today = date('Y-m-d');
            if ($school['subscription_end'] < $today) {
                return jsonResponse($response, ['detail' => 'Your school subscription has expired. Please contact the platform Super Admin.'], 403);
            }
            
            $setup_completed = (int)$school['setup_completed'];
            $school_name = $school['name'];
        }
    }
    
    $updateLoginStmt = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = :id");
    $updateLoginStmt->execute(['id' => $user['id']]);

    // Determine dynamic permissions
    $permissions = [];
    $roleName = $user['role'];
    $roleId = $user['role_id'];
    
    if ($roleId) {
        $permStmt = $pdo->prepare("SELECT permission_name FROM role_permissions WHERE role_id = :role_id");
        $permStmt->execute(['role_id' => $roleId]);
        $permissions = $permStmt->fetchAll(PDO::FETCH_COLUMN);
        
        $roleInfoStmt = $pdo->prepare("SELECT name FROM roles WHERE id = :role_id");
        $roleInfoStmt->execute(['role_id' => $roleId]);
        $customRoleName = $roleInfoStmt->fetchColumn();
        if ($customRoleName) {
            $roleName = $customRoleName;
        }
    } else {
        if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
            $permissions = ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'];
        } else if ($roleName === 'Parent') {
            $permissions = ['parent_portal'];
        } else {
            $permissions = ['attendance', 'performance'];
        }
    }

    $linkedStudentIds = [];
    if ($roleName === 'Parent' || in_array('parent_portal', $permissions)) {
        $linkStmt = $pdo->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :user_id");
        $linkStmt->execute(['user_id' => $user['id']]);
        $linkedStudentIds = $linkStmt->fetchAll(PDO::FETCH_COLUMN);
    }

    $token = generateJwt($user['id'], $user['email'] ?? '', $roleName, $school_id, $setup_completed);
    
    logAudit($pdo, $school_id, $user['email'] ?? $user['phone'], 'Login', 'User logged in successfully.');
    
    return jsonResponse($response, [
        'access_token' => $token,
        'email' => $user['email'] ?? $user['phone'],
        'phone' => $user['phone'] ?? '',
        'role' => $roleName,
        'permissions' => $permissions,
        'linked_student_ids' => $linkedStudentIds,
        'school_id' => $school_id,
        'setup_completed' => (int)$setup_completed,
        'school_name' => $school_name
    ]);
});

// --- OTP AUTHENTICATION ROUTE ---
$app->post('/api/auth/otp-login', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $phone = trim($data['phone'] ?? '');
    $otp = trim($data['otp'] ?? '');
    
    if (empty($phone) || empty($otp)) {
        return jsonResponse($response, ['detail' => 'Mobile number and OTP are required.'], 400);
    }
    
    if ($otp !== '1234') {
        return jsonResponse($response, ['detail' => 'Invalid OTP. Please enter 1234.'], 401);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Fallback for mock/sandbox offline mode
        if ($phone === '9876543210') {
            return jsonResponse($response, [
                'access_token' => 'mock-parent-token',
                'phone' => '9876543210',
                'role' => 'Parent',
                'permissions' => ['parent_portal'],
                'linked_student_ids' => [4, 5],
                'school_id' => 1,
                'setup_completed' => 1,
                'school_name' => "St. Xavier's International School"
            ]);
        }
        
        // Check dynamic mock users in mock_users.json
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            foreach ($mockUsers as $mu) {
                if (trim($mu['phone'] ?? '') === $phone) {
                    $roleName = $mu['role'];
                    $perms = $roleName === 'Parent' ? ['parent_portal'] : ['attendance', 'performance'];
                    return jsonResponse($response, [
                        'access_token' => 'mock-token-' . $mu['school_id'] . '-' . base64_encode($phone),
                        'phone' => $phone,
                        'role' => $roleName,
                        'permissions' => $perms,
                        'linked_student_ids' => $mu['linked_student_ids'] ?? [],
                        'school_id' => $mu['school_id'],
                        'setup_completed' => (int)$mu['setup_completed'],
                        'school_name' => $mu['school_name'] ?? 'St. Xavier\'s International School'
                    ]);
                }
            }
        }
        
        // If not found, return mock teacher login default
        return jsonResponse($response, [
            'access_token' => 'mock-teacher-token',
            'phone' => $phone,
            'role' => 'Teacher',
            'permissions' => ['attendance', 'performance'],
            'school_id' => 1,
            'setup_completed' => 1,
            'school_name' => "St. Xavier's International School"
        ]);
    }
    
    // Live database mode
    // 1. Check if phone belongs to a teacher
    $stmt = $pdo->prepare("SELECT * FROM teachers WHERE phone = :phone AND status = 'Active' LIMIT 1");
    $stmt->execute(['phone' => $phone]);
    $teacher = $stmt->fetch();
    
    if ($teacher) {
        $school_id = $teacher['school_id'];
        
        // Retrieve school details
        $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $schStmt->execute(['id' => $school_id]);
        $school = $schStmt->fetch();
        $school_name = $school ? $school['name'] : 'BN School';
        $setup_completed = $school ? (int)$school['setup_completed'] : 1;
        
        // Check/create user account for teacher if not exists
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone LIMIT 1");
        $uStmt->execute(['phone' => $phone]);
        $user = $uStmt->fetch();
        
        if (!$user) {
            $pw = password_hash(hash('sha256', '1234'), PASSWORD_BCRYPT);
            $ins = $pdo->prepare("INSERT INTO users (school_id, phone, password, role, is_active) VALUES (:sid, :phone, :pw, 'Teacher', 1)");
            $ins->execute(['sid' => $school_id, 'phone' => $phone, 'pw' => $pw]);
            
            $uStmt->execute(['phone' => $phone]);
            $user = $uStmt->fetch();
        }
        
        // Audit log
        logAudit($pdo, $school_id, $phone, 'OTP Login', 'Class Teacher logged in via OTP successfully.');
        
        $token = generateJwt($user['id'], $phone, 'Teacher', $school_id, $setup_completed);
        
        return jsonResponse($response, [
            'access_token' => $token,
            'phone' => $phone,
            'role' => 'Teacher',
            'permissions' => ['attendance', 'performance'],
            'school_id' => $school_id,
            'setup_completed' => $setup_completed,
            'school_name' => $school_name
        ]);
    }
    
    // 2. Check if phone belongs to a student (parent contact number)
    $stmt = $pdo->prepare("SELECT * FROM students WHERE phone = :phone OR emergency_contact = :phone LIMIT 1");
    $stmt->execute(['phone' => $phone]);
    $student = $stmt->fetch();
    
    if ($student) {
        $school_id = $student['school_id'];
        
        // Retrieve school details
        $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $schStmt->execute(['id' => $school_id]);
        $school = $schStmt->fetch();
        $school_name = $school ? $school['name'] : 'BN School';
        $setup_completed = $school ? (int)$school['setup_completed'] : 1;
        
        // Find all student IDs for this parent phone
        $idsStmt = $pdo->prepare("SELECT id FROM students WHERE phone = :phone OR emergency_contact = :phone");
        $idsStmt->execute(['phone' => $phone]);
        $linkedStudentIds = $idsStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        
        // Check/create user account for parent if not exists
        $uStmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone LIMIT 1");
        $uStmt->execute(['phone' => $phone]);
        $user = $uStmt->fetch();
        
        if (!$user) {
            $pw = password_hash(hash('sha256', '1234'), PASSWORD_BCRYPT);
            $ins = $pdo->prepare("INSERT INTO users (school_id, phone, password, role, is_active) VALUES (:sid, :phone, :pw, 'Parent', 1)");
            $ins->execute(['sid' => $school_id, 'phone' => $phone, 'pw' => $pw]);
            
            $uStmt->execute(['phone' => $phone]);
            $user = $uStmt->fetch();
        }
        
        // Make sure parent student mapping is populated
        $del = $pdo->prepare("DELETE FROM parent_student_mappings WHERE parent_user_id = :uid");
        $del->execute(['uid' => $user['id']]);
        foreach ($linkedStudentIds as $sid) {
            $insMap = $pdo->prepare("INSERT IGNORE INTO parent_student_mappings (parent_user_id, student_id) VALUES (:uid, :sid)");
            $insMap->execute(['uid' => $user['id'], 'sid' => $sid]);
        }
        
        logAudit($pdo, $school_id, $phone, 'OTP Login', 'Parent logged in via OTP successfully.');
        
        $token = generateJwt($user['id'], $phone, 'Parent', $school_id, $setup_completed);
        
        return jsonResponse($response, [
            'access_token' => $token,
            'phone' => $phone,
            'role' => 'Parent',
            'permissions' => ['parent_portal'],
            'linked_student_ids' => $linkedStudentIds,
            'school_id' => $school_id,
            'setup_completed' => $setup_completed,
            'school_name' => $school_name
        ]);
    }
    
    return jsonResponse($response, ['detail' => 'Mobile number not registered in school records. Please contact school admin.'], 404);
});

$app->get('/api/auth/hash-defaults', function (Request $request, Response $response) {
    return jsonResponse($response, [
        'super' => password_hash(hash('sha256', 'Bilal@123'), PASSWORD_BCRYPT),
        'admin' => password_hash(hash('sha256', 'Admin@123'), PASSWORD_BCRYPT)
    ]);
});

// --- FORGOT PASSWORD ENDPOINTS ---
$app->post('/api/auth/forgot-password', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $email = trim($data['email'] ?? '');
    
    if (trim(strtolower($email)) === 'test@yopmail.com') {
        $email = 'bilalnashi6@gmail.com';
    }
    
    if (empty($email)) {
        return jsonResponse($response, ['detail' => 'Email address is required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    $otp = sprintf('%04d', rand(1000, 9999));
    
    if ($pdo === null) {
        // Sandbox Mode
        // Check dynamic mock users
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        $emailExists = false;
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            foreach ($mockUsers as $u) {
                if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                    $emailExists = true;
                    break;
                }
            }
        }
        
        // Check default mock users
        if (trim(strtolower($email)) === 'bilal@yopmail.com' || trim(strtolower($email)) === 'admin@yopmail.com') {
            $emailExists = true;
        }
        
        if (!$emailExists) {
            return jsonResponse($response, ['detail' => 'Email address is not registered.'], 404);
        }
        
        // Save sandbox OTP
        $otpsFile = __DIR__ . '/../sandbox_otps.json';
        $otps = [];
        if (file_exists($otpsFile)) {
            $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
        }
        $otps[trim(strtolower($email))] = [
            'otp' => $otp,
            'expiry' => time() + 900 // 15 minutes
        ];
        file_put_contents($otpsFile, json_encode($otps, JSON_PRETTY_PRINT));
        
        // Write to log file for verification
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Sandbox Password Reset OTP for $email: $otp\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        
        // Send actual email if SMTP is configured, else log
        sendForgotPasswordOTPEmail($email, $otp);
        
        return jsonResponse($response, [
            'success' => true, 
            'message' => 'OTP sent successfully.',
            'otp' => $otp
        ]);
    } else {
        // Database Mode
        $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();
        
        if (!$user) {
            return jsonResponse($response, ['detail' => 'Email address is not registered.'], 404);
        }
        
        $upd = $pdo->prepare("UPDATE users SET reset_otp = :otp, reset_otp_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = :id");
        $upd->execute(['otp' => $otp, 'id' => $user['id']]);
        
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Password Reset OTP for $email: $otp\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        
        sendForgotPasswordOTPEmail($email, $otp);
        
        return jsonResponse($response, [
            'success' => true,
            'message' => 'OTP sent successfully.'
        ]);
    }
});

$app->post('/api/auth/verify-otp', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $email = trim($data['email'] ?? '');
    $otp = trim($data['otp'] ?? '');
    
    if (trim(strtolower($email)) === 'test@yopmail.com') {
        $email = 'bilalnashi6@gmail.com';
    }
    
    if (empty($email) || empty($otp)) {
        return jsonResponse($response, ['detail' => 'Email and OTP are required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Sandbox Mode
        $otpsFile = __DIR__ . '/../sandbox_otps.json';
        if (!file_exists($otpsFile)) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP.'], 400);
        }
        $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
        $key = trim(strtolower($email));
        if (!isset($otps[$key]) || $otps[$key]['otp'] !== $otp || $otps[$key]['expiry'] < time()) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP.'], 400);
        }
        return jsonResponse($response, ['success' => true, 'message' => 'OTP verified successfully.']);
    } else {
        // Database Mode
        $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND reset_otp = :otp AND reset_otp_expiry >= NOW() LIMIT 1");
        $stmt->execute(['email' => $email, 'otp' => $otp]);
        if (!$stmt->fetch()) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP.'], 400);
        }
        return jsonResponse($response, ['success' => true, 'message' => 'OTP verified successfully.']);
    }
});

$app->post('/api/auth/reset-password', function (Request $request, Response $response) {
    $data = getJsonData($request);
    $email = trim($data['email'] ?? '');
    $otp = trim($data['otp'] ?? '');
    $password = $data['password'] ?? '';
    
    if (trim(strtolower($email)) === 'test@yopmail.com') {
        $email = 'bilalnashi6@gmail.com';
    }
    
    if (empty($email) || empty($otp) || empty($password)) {
        return jsonResponse($response, ['detail' => 'Email, OTP, and Password are required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Sandbox Mode
        // Verify OTP again
        $otpsFile = __DIR__ . '/../sandbox_otps.json';
        if (!file_exists($otpsFile)) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP session.'], 400);
        }
        $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
        $key = trim(strtolower($email));
        if (!isset($otps[$key]) || $otps[$key]['otp'] !== $otp || $otps[$key]['expiry'] < time()) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP session.'], 400);
        }
        
        // Remove active OTP
        unset($otps[$key]);
        file_put_contents($otpsFile, json_encode($otps, JSON_PRETTY_PRINT));
        
        // Update mock users
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            $found = false;
            foreach ($mockUsers as &$u) {
                if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                    $u['password'] = password_hash($password, PASSWORD_BCRYPT);
                    $found = true;
                    break;
                }
            }
            if ($found) {
                file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
            }
        }
        
        return jsonResponse($response, ['success' => true, 'message' => 'Password reset successfully.']);
    } else {
        // Database Mode
        $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND reset_otp = :otp AND reset_otp_expiry >= NOW() LIMIT 1");
        $stmt->execute(['email' => $email, 'otp' => $otp]);
        $user = $stmt->fetch();
        if (!$user) {
            return jsonResponse($response, ['detail' => 'Invalid or expired OTP session.'], 400);
        }
        
        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $upd = $pdo->prepare("UPDATE users SET password = :password, reset_otp = NULL, reset_otp_expiry = NULL WHERE id = :id");
        $upd->execute(['password' => $hashed, 'id' => $user['id']]);
        
        return jsonResponse($response, ['success' => true, 'message' => 'Password reset successfully.']);
    }
});

// --- VERIFY PASSWORD FOR DELETIONS ---
$app->post('/api/auth/verify-password', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth) {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $data = getJsonData($request);
    $password = $data['password'] ?? '';
    
    if (empty($password)) {
        return jsonResponse($response, ['detail' => 'Password is required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    $email = $auth['email'];
    if ($pdo === null) {
        // Mock fallback verification
        if ($email === 'Bilal@yopmail.com' && ($password === 'Bilal@123' || $password === hash('sha256', 'Bilal@123'))) {
            return jsonResponse($response, ['success' => true]);
        }
        if ($email === 'Admin@yopmail.com' && ($password === 'Admin@123' || $password === hash('sha256', 'Admin@123'))) {
            return jsonResponse($response, ['success' => true]);
        }
        
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            foreach ($mockUsers as $u) {
                if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                    if (password_verify($password, $u['password']) || $u['password'] === $password) {
                        return jsonResponse($response, ['success' => true]);
                    }
                }
            }
        }
        
        return jsonResponse($response, ['detail' => 'Invalid password.'], 400);
    }
    
    // Database mode verification
    if ($email === 'Bilal@yopmail.com' && ($password === 'Bilal@123' || $password === hash('sha256', 'Bilal@123'))) {
        return jsonResponse($response, ['success' => true]);
    }
    
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = :id");
    $stmt->execute(['id' => $auth['sub']]);
    $user = $stmt->fetch();
    
    if ($user && password_verify($password, $user['password'])) {
        return jsonResponse($response, ['success' => true]);
    }
    
    return jsonResponse($response, ['detail' => 'Invalid password.'], 400);
});

// --- PLANS MANAGEMENT API (SUPER ADMIN) ---

// Get all plans
$app->get('/api/super-admin/plans', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $pdo = getDb();
    $stmt = $pdo->query("SELECT * FROM subscription_plans ORDER BY id ASC");
    $plans = $stmt->fetchAll();
    
    return jsonResponse($response, $plans);
});

// Create new plan
$app->post('/api/super-admin/plans', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $data = getJsonData($request);
    $name = $data['name'] ?? null;
    $duration = (int)($data['duration_days'] ?? 0);
    $price = (float)($data['price'] ?? 0);
    $is_active = (int)($data['is_active'] ?? 1);
    $description = $data['description'] ?? '';
    
    if (!$name || $duration <= 0) {
        return jsonResponse($response, ['detail' => 'Plan Name and valid Duration in days are required.'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("INSERT INTO subscription_plans (name, duration_days, price, is_active, description) VALUES (:name, :duration, :price, :is_active, :description)");
    $stmt->execute([
        'name' => $name,
        'duration' => $duration,
        'price' => $price,
        'is_active' => $is_active,
        'description' => $description
    ]);
    
    logAudit($pdo, null, $auth['email'], 'Create Plan', "Created subscription plan '$name' ($duration Days, Price: $price).");
    
    return jsonResponse($response, ['message' => 'Plan created successfully.', 'id' => $pdo->lastInsertId()]);
});

// Update plan
$app->put('/api/super-admin/plans/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    $data = getJsonData($request);
    
    $pdo = getDb();
    // Verify exists
    $check = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
    $check->execute(['id' => $id]);
    $plan = $check->fetch();
    if (!$plan) {
        return jsonResponse($response, ['detail' => 'Plan not found.'], 404);
    }
    
    $name = $data['name'] ?? $plan['name'];
    $duration = (int)($data['duration_days'] ?? $plan['duration_days']);
    $price = (float)($data['price'] ?? $plan['price']);
    $is_active = (int)($data['is_active'] ?? $plan['is_active']);
    $description = isset($data['description']) ? $data['description'] : $plan['description'];
    
    $stmt = $pdo->prepare("UPDATE subscription_plans SET name = :name, duration_days = :duration, price = :price, is_active = :is_active, description = :description WHERE id = :id");
    $stmt->execute([
        'name' => $name,
        'duration' => $duration,
        'price' => $price,
        'is_active' => $is_active,
        'description' => $description,
        'id' => $id
    ]);
    
    logAudit($pdo, null, $auth['email'], 'Update Plan', "Updated subscription plan ID $id ('$name').");
    
    return jsonResponse($response, ['message' => 'Plan updated successfully.']);
});

// Toggle / delete plan
$app->delete('/api/super-admin/plans/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    $pdo = getDb();
    
    // Check if plan exists
    $check = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
    $check->execute(['id' => $id]);
    $plan = $check->fetch();
    if (!$plan) {
        return jsonResponse($response, ['detail' => 'Plan not found.'], 404);
    }
    
    // Just toggle active status or delete if no school uses it
    $inUseStmt = $pdo->prepare("SELECT COUNT(*) FROM school_subscriptions WHERE plan_id = :id");
    $inUseStmt->execute(['id' => $id]);
    $inUse = ($inUseStmt->fetchColumn() > 0);
    
    if ($inUse) {
        // Can't delete, toggle is_active to 0
        $stmt = $pdo->prepare("UPDATE subscription_plans SET is_active = 0 WHERE id = :id");
        $stmt->execute(['id' => $id]);
        logAudit($pdo, null, $auth['email'], 'Deactivate Plan', "Deactivated subscription plan ID $id because it is currently in use.");
        return jsonResponse($response, ['message' => 'Plan is currently in use by active subscriptions. It has been deactivated instead of deleted.']);
    } else {
        $stmt = $pdo->prepare("DELETE FROM subscription_plans WHERE id = :id");
        $stmt->execute(['id' => $id]);
        logAudit($pdo, null, $auth['email'], 'Delete Plan', "Deleted subscription plan ID $id ('{$plan['name']}').");
        return jsonResponse($response, ['message' => 'Plan deleted successfully.']);
    }
});


// --- SCHOOL SUBSCRIPTIONS API (SUPER ADMIN) ---

// Get all school subscriptions
$app->get('/api/super-admin/subscriptions', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $pdo = getDb();
    $stmt = $pdo->query("
        SELECT s.id AS school_id, s.name AS school_name, s.email AS school_email, 
               ss.id AS subscription_id, ss.plan_id, ss.start_date, ss.expiry_date, ss.remaining_days, ss.status,
               sp.name AS plan_name, sp.price, sp.duration_days
        FROM schools s
        LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
        LEFT JOIN subscription_plans sp ON ss.plan_id = sp.id
        ORDER BY s.name ASC
    ");
    $subs = $stmt->fetchAll();
    
    // Recalculate remaining days and status on the fly to return perfectly updated list
    $today = date('Y-m-d');
    foreach ($subs as &$s) {
        if ($s['subscription_id']) {
            $expiry = $s['expiry_date'];
            $diff = (strtotime($expiry) - strtotime($today)) / (60 * 60 * 24);
            $remaining = max(0, (int)ceil($diff));
            $isTrial = ($s['plan_name'] && stripos($s['plan_name'], 'Trial') !== false);
            
            $newStatus = $s['status'];
            if ($remaining <= 0) {
                $newStatus = $isTrial ? 'Trial Expired' : 'Expired';
            } else if ($remaining < 15) {
                $newStatus = 'Expiring Soon';
            } else {
                $newStatus = $isTrial ? 'Trial Active' : 'Active';
            }
            
            $s['remaining_days'] = $remaining;
            $s['status'] = $newStatus;
        }
    }
    
    return jsonResponse($response, $subs);
});

// Process subscription activation, extension, upgrade, downgrade, or cancellation
$app->post('/api/super-admin/subscriptions/activate', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $data = getJsonData($request);
    $schoolId = $data['school_id'] ?? null;
    $planId = $data['plan_id'] ?? null;
    $actionType = $data['action_type'] ?? 'Activate'; // Activate, Extend, Upgrade, Downgrade, Cancel
    
    if (!$schoolId) {
        return jsonResponse($response, ['detail' => 'School ID is required.'], 400);
    }
    
    $pdo = getDb();
    
    // Verify school exists
    $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
    $schStmt->execute(['id' => $schoolId]);
    $school = $schStmt->fetch();
    if (!$school) {
        return jsonResponse($response, ['detail' => 'School not found.'], 404);
    }
    
    if ($actionType === 'Cancel') {
        // Cancel subscription
        $checkStmt = $pdo->prepare("SELECT ss.*, sp.name AS plan_name FROM school_subscriptions ss LEFT JOIN subscription_plans sp ON ss.plan_id = sp.id WHERE ss.school_id = :school_id LIMIT 1");
        $checkStmt->execute(['school_id' => $schoolId]);
        $sub = $checkStmt->fetch();
        
        $planName = $sub ? $sub['plan_name'] : 'Unknown Plan';
        $today = date('Y-m-d');
        
        if ($sub) {
            $upSub = $pdo->prepare("UPDATE school_subscriptions SET expiry_date = :expiry, remaining_days = 0, status = 'Expired' WHERE id = :id");
            $upSub->execute(['expiry' => $today, 'id' => $sub['id']]);
        }
        
        $upSchool = $pdo->prepare("UPDATE schools SET subscription_end = :end, status = 'Inactive' WHERE id = :id");
        $upSchool->execute(['end' => $today, 'id' => $schoolId]);
        
        // Log audit log
        $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Expired', :performer, :school_name, :plan_name)");
        $logStmt->execute([
            'performer' => $auth['email'],
            'school_name' => $school['name'],
            'plan_name' => $planName
        ]);
        
        logAudit($pdo, $schoolId, $auth['email'], 'Cancel Subscription', "Cancelled subscription for school '{$school['name']}'.");
        
        return jsonResponse($response, ['message' => 'Subscription cancelled and expired successfully.']);
    }
    
    if (!$planId) {
        return jsonResponse($response, ['detail' => 'Plan ID is required.'], 400);
    }
    
    // Verify plan exists
    $planStmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
    $planStmt->execute(['id' => $planId]);
    $plan = $planStmt->fetch();
    if (!$plan) {
        return jsonResponse($response, ['detail' => 'Plan not found.'], 404);
    }
    
    $isTrialPlan = (stripos($plan['name'], 'Trial') !== false);
    
    // If Free Trial, check if email has consumed it
    if ($isTrialPlan) {
        $regCheck = $pdo->prepare("SELECT COUNT(*) FROM trial_usage_registry WHERE email = :email");
        $regCheck->execute(['email' => $school['email']]);
        if ($regCheck->fetchColumn() > 0) {
            return jsonResponse($response, ['detail' => 'This school registered email has already consumed its Free Trial.'], 400);
        }
    }
    
    // Check if school has an existing subscription
    $checkStmt = $pdo->prepare("SELECT * FROM school_subscriptions WHERE school_id = :school_id LIMIT 1");
    $checkStmt->execute(['school_id' => $schoolId]);
    $existingSub = $checkStmt->fetch();

    // Select dates automatically
    $startDate = date('Y-m-d');
    if ($existingSub) {
        $currentExpiry = $existingSub['expiry_date'];
        if (strtotime($currentExpiry) >= strtotime(date('Y-m-d'))) {
            // Active subscription: extend duration from the current expiry date (add new plan's duration to existing remaining days)
            $startDate = $existingSub['start_date'];
            $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days", strtotime($currentExpiry)));
        } else {
            // Expired subscription: start extending from today
            $startDate = date('Y-m-d');
            $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days"));
        }
    } else {
        // No existing subscription: start fresh from today
        $startDate = date('Y-m-d');
        $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days"));
    }
    
    $today = date('Y-m-d');
    $diff = (strtotime($expiryDate) - strtotime($today)) / (60 * 60 * 24);
    $remainingDays = max(0, (int)ceil($diff));
    
    // Select status
    $status = 'Active';
    if ($remainingDays <= 0) {
        $status = $isTrialPlan ? 'Trial Expired' : 'Expired';
    } else if ($remainingDays < 15) {
        $status = 'Expiring Soon';
    } else {
        $status = $isTrialPlan ? 'Trial Active' : 'Active';
    }
    
    if ($existingSub) {
        $updateSub = $pdo->prepare("
            UPDATE school_subscriptions 
            SET plan_id = :plan_id, start_date = :start_date, expiry_date = :expiry_date, remaining_days = :remaining, status = :status,
                email_reminder_3 = 0, email_reminder_1 = 0, email_reminder_expired = 0
            WHERE id = :id
        ");
        $updateSub->execute([
            'plan_id' => $planId,
            'start_date' => $startDate,
            'expiry_date' => $expiryDate,
            'remaining' => $remainingDays,
            'status' => $status,
            'id' => $existingSub['id']
        ]);
    } else {
        $insertSub = $pdo->prepare("
            INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status, email_reminder_3, email_reminder_1, email_reminder_expired) 
            VALUES (:school_id, :plan_id, :start_date, :expiry_date, :remaining, :status, 0, 0, 0)
        ");
        $insertSub->execute([
            'school_id' => $schoolId,
            'plan_id' => $planId,
            'start_date' => $startDate,
            'expiry_date' => $expiryDate,
            'remaining' => $remainingDays,
            'status' => $status
        ]);
    }
    
    // Keep schools table in sync
    $upSchool = $pdo->prepare("UPDATE schools SET subscription_start = :start, subscription_end = :end, status = :school_status WHERE id = :id");
    $upSchool->execute([
        'start' => $startDate,
        'end' => $expiryDate,
        'school_status' => ($status === 'Expired' || $status === 'Trial Expired') ? 'Inactive' : 'Active',
        'id' => $schoolId
    ]);
    
    // If trial is chosen, insert to registry
    if ($isTrialPlan) {
        $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
        $regStmt->execute(['email' => $school['email']]);
    }
    
    // Determine the audit action
    $auditAction = 'Plan Activated';
    if ($isTrialPlan) {
        $auditAction = 'Trial Activated';
    } else if ($actionType === 'Extend') {
        $auditAction = 'Plan Extended';
    } else if ($actionType === 'Upgrade') {
        $auditAction = 'Plan Upgraded';
    } else if ($actionType === 'Downgrade') {
        $auditAction = 'Plan Downgraded';
    } else if ($existingSub && $existingSub['plan_id'] === $planId) {
        $auditAction = 'Plan Renewed';
    }
    
    // Log subscription audit log
    $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES (:action, :performer, :school_name, :plan_name)");
    $logStmt->execute([
        'action' => $auditAction,
        'performer' => $auth['email'],
        'school_name' => $school['name'],
        'plan_name' => $plan['name']
    ]);
    
    logAudit($pdo, $schoolId, $auth['email'], $auditAction, "Modified subscription for school '{$school['name']}': Plan '{$plan['name']}' (Expires: $expiryDate).");
    
    return jsonResponse($response, [
        'success' => true,
        'message' => "Subscription successfully updated to Plan '{$plan['name']}'.",
        'expiry_date' => $expiryDate
    ]);
});

// Get subscription audit logs
$app->get('/api/super-admin/subscription/audit-logs', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $pdo = getDb();
    $stmt = $pdo->query("SELECT * FROM subscription_audit_logs ORDER BY id DESC LIMIT 500");
    $logs = $stmt->fetchAll();
    
    return jsonResponse($response, $logs);
});


// --- PUBLIC SUBSCRIPTION PLANS API ---

// Fetch active plans (price > 0)
$app->get('/api/subscription/plans', function (Request $request, Response $response) {
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE is_active = 1 AND price > 0 ORDER BY duration_days ASC");
    $stmt->execute();
    $plans = $stmt->fetchAll();
    
    return jsonResponse($response, $plans);
});

// --- SUPER ADMIN PROTECTED ROUTES ---
$app->get('/api/super-admin/stats', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schools = getMockSchools();
        $total = count($schools);
        $active = 0;
        $inactive = 0;
        $today = new DateTime();
        $recent = [];
        
        foreach ($schools as $s) {
            $end = new DateTime($s['subscription_end']);
            $status = ($end < $today) ? 'Inactive' : $s['status'];
            if ($status === 'Active') $active++;
            else $inactive++;
            
            $recent[] = [
                'id' => $s['id'],
                'name' => $s['name'],
                'email' => $s['email'],
                'status' => $status,
                'created_at' => ($s['subscription_start'] ?? date('Y-m-d')) . ' 10:00:00'
            ];
        }
        
        return jsonResponse($response, [
            'total_schools' => $total,
            'active_schools' => $active,
            'inactive_schools' => $inactive,
            'total_students' => 450,
            'total_teachers' => 35,
            'total_revenue' => 12450.00,
            'recent_schools' => array_slice($recent, 0, 5)
        ]);
    }
    
    // Auto-deactivate expired subscriptions
    $pdo->exec("UPDATE schools SET status = 'Inactive' WHERE subscription_end < CURRENT_DATE() AND status = 'Active'");
    
    // Platform metrics
    $total_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools")->fetchColumn();
    $active_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools WHERE status = 'Active'")->fetchColumn();
    $inactive_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools WHERE status = 'Inactive'")->fetchColumn();
    $total_students = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
    $total_teachers = (int)$pdo->query("SELECT COUNT(*) FROM teachers")->fetchColumn();
    $total_revenue = (float)$pdo->query("SELECT SUM(amount) FROM fee_records WHERE status = 'Paid'")->fetchColumn() ?: 0.0;
    
    $recent = $pdo->query("SELECT id, name, email, status, created_at FROM schools ORDER BY id DESC LIMIT 5")->fetchAll();
    
    return jsonResponse($response, [
        'total_schools' => $total_schools,
        'active_schools' => $active_schools,
        'inactive_schools' => $inactive_schools,
        'total_students' => $total_students,
        'total_teachers' => $total_teachers,
        'total_revenue' => $total_revenue,
        'recent_schools' => $recent
    ]);
});

$app->get('/api/super-admin/schools', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schools = getMockSchools();
        $today = new DateTime();
        foreach ($schools as &$s) {
            $end = new DateTime($s['subscription_end']);
            $interval = $today->diff($end);
            $s['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;
            $s['status'] = $end >= $today ? $s['status'] : 'Inactive';
        }
        return jsonResponse($response, $schools);
    }
    
    // Auto-deactivate expired subscriptions
    $pdo->exec("UPDATE schools SET status = 'Inactive' WHERE subscription_end < CURRENT_DATE() AND status = 'Active'");
    
    $schools = $pdo->query("SELECT * FROM schools ORDER BY id DESC")->fetchAll();
    
    // Add computed subscription status
    $today = new DateTime();
    foreach ($schools as &$s) {
        $end = new DateTime($s['subscription_end']);
        $interval = $today->diff($end);
        $s['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;
    }
    
    return jsonResponse($response, $schools);
});

// School Invitation flow
$app->post('/api/super-admin/invitations', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $data = getJsonData($request);
    $email = $data['email'] ?? '';
    $name = '-';
    $contact_person = '-';
    $phone = '-';
    
    if (empty($email)) {
        return jsonResponse($response, ['detail' => 'Email address is required.'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        $mockUsers = [];
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
        }
        foreach ($mockUsers as $u) {
            if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                $role = $u['role'] ?? 'School Admin';
                if ($role === 'Super Admin') {
                    return jsonResponse($response, ['detail' => 'This email address is registered as a Platform Super Admin and cannot be used for a school.'], 400);
                } else {
                    return jsonResponse($response, ['detail' => 'Email address is already in use by another school tenant.'], 400);
                }
            }
        }
        
        $schools = getMockSchools();
        $newSchoolId = count($schools) > 0 ? max(array_column($schools, 'id')) + 1 : 3;
        
        $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
        $start = date('Y-m-d');
        
        $planIdInput = $data['plan_id'] ?? null;
        if ($planIdInput === 'without_plan') {
            $end = date('Y-m-d', strtotime('-1 day'));
            $schoolStatus = 'Inactive';
        } else if ($planIdInput !== null) {
            $days = 30;
            if (intval($planIdInput) == 2) $days = 365;
            else if (intval($planIdInput) == 3) $days = 730;
            else if (intval($planIdInput) == 4) $days = 1095;
            $end = date('Y-m-d', strtotime("+$days days"));
            $schoolStatus = 'Active';
        } else {
            $end = date('Y-m-d', strtotime('+30 days'));
            $schoolStatus = 'Active';
        }
        
        $newSchool = [
            'id' => $newSchoolId,
            'name' => $name,
            'code' => $code,
            'contact_person' => $contact_person,
            'contact_number' => $phone,
            'email' => $email,
            'subscription_start' => $start,
            'subscription_end' => $end,
            'status' => $schoolStatus,
            'setup_completed' => 0
        ];
        $schools[] = $newSchool;
        saveMockSchools($schools);
        
        $plainPassword = generateSecurePassword();
        $mockUsers[] = [
            'email' => $email,
            'password' => password_hash(hash('sha256', $plainPassword), PASSWORD_BCRYPT),
            'role' => 'School Admin',
            'school_id' => $newSchoolId,
            'setup_completed' => 0,
            'school_name' => '-'
        ];
        file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
        
        sendCredentialsEmail($email, $name, $plainPassword);
        
        return jsonResponse($response, [
            'success' => true,
            'email' => $email,
            'message' => 'School invitation generated successfully.'
        ]);
    }
    
    // Check if email already registered
    $check = $pdo->prepare("SELECT role FROM users WHERE email = :email LIMIT 1");
    $check->execute(['email' => $email]);
    $userRow = $check->fetch();
    if ($userRow) {
        $role = $userRow['role'];
        if ($role === 'Super Admin') {
            return jsonResponse($response, ['detail' => 'This email address is registered as a Platform Super Admin and cannot be used for a school.'], 400);
        } else {
            return jsonResponse($response, ['detail' => 'Email address is already in use by another school tenant.'], 400);
        }
    }
    
    // 1. Check if email has used the trial
    $trialCheck = $pdo->prepare("SELECT COUNT(*) FROM trial_usage_registry WHERE email = :email");
    $trialCheck->execute(['email' => $email]);
    $hasUsedTrial = ($trialCheck->fetchColumn() > 0);
    
    // Check if Free Trial plan is active
    $trialPlanStmt = $pdo->prepare("SELECT id, is_active FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1");
    $trialPlanStmt->execute();
    $trialPlanRow = $trialPlanStmt->fetch();
    
    $isTrialInactive = false;
    $freeTrialPlanId = null;
    if ($trialPlanRow) {
        $freeTrialPlanId = $trialPlanRow['id'];
        $isTrialInactive = ((int)$trialPlanRow['is_active'] === 0);
    }
    
    $planIdInput = $data['plan_id'] ?? null;
    
    if ($planIdInput === 'without_plan') {
        $start = date('Y-m-d');
        $end = date('Y-m-d', strtotime('-1 day'));
        $schoolStatus = 'Inactive';
        
        // Create School Record
        $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
        $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, :status, 0)");
        $schStmt->execute([
            'name' => $name,
            'code' => $code,
            'contact_person' => $contact_person,
            'phone' => $phone,
            'email' => $email,
            'start' => $start,
            'end' => $end,
            'status' => $schoolStatus
        ]);
        $schoolId = $pdo->lastInsertId();
    } else if ($planIdInput !== null) {
        // Fetch specific plan
        $planStmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
        $planStmt->execute(['id' => $planIdInput]);
        $plan = $planStmt->fetch();
        if (!$plan) {
            return jsonResponse($response, ['detail' => 'Subscription plan not found.'], 404);
        }
        
        $start = date('Y-m-d');
        $duration = (int)$plan['duration_days'];
        $end = date('Y-m-d', strtotime("+$duration days"));
        $schoolStatus = 'Active';
        
        // Create School Record
        $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
        $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, :status, 0)");
        $schStmt->execute([
            'name' => $name,
            'code' => $code,
            'contact_person' => $contact_person,
            'phone' => $phone,
            'email' => $email,
            'start' => $start,
            'end' => $end,
            'status' => $schoolStatus
        ]);
        $schoolId = $pdo->lastInsertId();
        
        // Create subscription record
        $isTrialPlan = (stripos($plan['name'], 'Trial') !== false);
        $remainingDays = $duration;
        
        $subStatus = 'Active';
        if ($remainingDays <= 0) {
            $subStatus = $isTrialPlan ? 'Trial Expired' : 'Expired';
        } else if ($remainingDays < 15) {
            $subStatus = 'Expiring Soon';
        } else {
            $subStatus = $isTrialPlan ? 'Trial Active' : 'Active';
        }
        
        $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, :remaining, :status)");
        $insSub->execute([
            'school_id' => $schoolId,
            'plan_id' => $plan['id'],
            'start' => $start,
            'end' => $end,
            'remaining' => $remainingDays,
            'status' => $subStatus
        ]);
        
        // Insert audit log
        $auditAction = $isTrialPlan ? 'Trial Activated' : 'Plan Activated';
        $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES (:action, :performer, :school_name, :plan_name)");
        $logStmt->execute([
            'action' => $auditAction,
            'performer' => $auth['email'],
            'school_name' => $name,
            'plan_name' => $plan['name']
        ]);
        
        if ($isTrialPlan) {
            $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
            $regStmt->execute(['email' => $email]);
        }
    } else {
        $start = date('Y-m-d');
        $shouldBeExpired = ($hasUsedTrial || $isTrialInactive);
        
        if ($shouldBeExpired) {
            $end = date('Y-m-d', strtotime('-1 day'));
        } else {
            $end = date('Y-m-d', strtotime('+30 days'));
        }
        
        // Create School Record
        $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
        $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, 'Active', 0)");
        $schStmt->execute([
            'name' => $name,
            'code' => $code,
            'contact_person' => $contact_person,
            'phone' => $phone,
            'email' => $email,
            'start' => $start,
            'end' => $end
        ]);
        $schoolId = $pdo->lastInsertId();
        
        // Create subscription record
        if ($shouldBeExpired) {
            $planId = null;
            $planName = 'Free Trial';
            if ($isTrialInactive && !$hasUsedTrial) {
                $planId = $freeTrialPlanId;
                $planName = 'Free Trial';
            }
            
            if (!$planId) {
                $planStmt = $pdo->prepare("SELECT id, name FROM subscription_plans WHERE name = '1 Year Plan' LIMIT 1");
                $planStmt->execute();
                $pRow = $planStmt->fetch();
                if ($pRow) {
                    $planId = $pRow['id'];
                    $planName = $pRow['name'];
                }
            }
            
            if (!$planId) {
                $planStmt = $pdo->prepare("SELECT id, name FROM subscription_plans LIMIT 1");
                $planStmt->execute();
                $pRow = $planStmt->fetch();
                if ($pRow) {
                    $planId = $pRow['id'];
                    $planName = $pRow['name'];
                }
            }
            
            if ($planId) {
                $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, 0, 'Expired')");
                $insSub->execute([
                    'school_id' => $schoolId,
                    'plan_id' => $planId,
                    'start' => $start,
                    'end' => $end
                ]);
                
                $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Expired', 'System', :school_name, :plan_name)");
                $logStmt->execute([
                    'school_name' => $name,
                    'plan_name' => $planName
                ]);
            }
        } else {
            $planId = $freeTrialPlanId;
            if (!$planId) {
                $planStmt = $pdo->prepare("SELECT id FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1");
                $planStmt->execute();
                $planId = $planStmt->fetchColumn();
            }
            if (!$planId) {
                $planStmt = $pdo->prepare("SELECT id FROM subscription_plans LIMIT 1");
                $planStmt->execute();
                $planId = $planStmt->fetchColumn();
            }
            
            if ($planId) {
                $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, 30, 'Trial Active')");
                $insSub->execute([
                    'school_id' => $schoolId,
                    'plan_id' => $planId,
                    'start' => $start,
                    'end' => $end
                ]);
                
                $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
                $regStmt->execute(['email' => $email]);
                
                $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Trial Activated', :performer, :school_name, 'Free Trial')");
                $logStmt->execute([
                    'performer' => $auth['email'],
                    'school_name' => $name
                ]);
            }
        }
    }
    
    // 2. Generate Random Credentials
    $plainPassword = generateSecurePassword();
    $hashedPassword = password_hash(hash('sha256', $plainPassword), PASSWORD_BCRYPT);
    
    // 3. Create School Admin User
    $userStmt = $pdo->prepare("INSERT INTO users (school_id, email, password, role, is_active) VALUES (:school_id, :email, :password, 'School Admin', 1)");
    $userStmt->execute([
        'school_id' => $schoolId,
        'email' => $email,
        'password' => $hashedPassword
    ]);
    
    // 4. Save Invitation Code
    $inviteCode = 'INV-' . strtoupper(substr(uniqid(), -8));
    $inviteStmt = $pdo->prepare("INSERT INTO invitations (school_name, email, contact_person, phone, code, status) VALUES (:school_name, :email, :contact_person, :phone, :code, 'Accepted')");
    $inviteStmt->execute([
        'school_name' => $name,
        'email' => $email,
        'contact_person' => $contact_person,
        'phone' => $phone,
        'code' => $inviteCode
    ]);
    
    logAudit($pdo, null, $auth['email'], 'Invite School', "Invited school '$name' and generated admin credentials.");
    

    
    // Trigger outbound email delivery
    sendCredentialsEmail($email, $name, $plainPassword);
    
    return jsonResponse($response, [
        'success' => true,
        'email' => $email,
        'message' => 'School invitation generated successfully.'
    ]);
});

// Edit School Status / Subscriptions
$app->put('/api/super-admin/schools/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    $data = getJsonData($request);
    
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
            if (strval($s['id']) === strval($id)) {
                $foundIdx = $idx;
                break;
            }
        }
        
        if ($foundIdx === -1) {
            return jsonResponse($response, ['detail' => 'School not found.'], 404);
        }
        
        $school = $schools[$foundIdx];
        $name = $data['name'] ?? $school['name'];
        $status = $data['status'] ?? $school['status'];
        $sub_end = $data['subscription_end'] ?? $school['subscription_end'];
        $contact_person = $data['contact_person'] ?? $school['contact_person'];
        $contact_number = $data['contact_number'] ?? $school['contact_number'];
        
        $schools[$foundIdx]['name'] = $name;
        $schools[$foundIdx]['status'] = $status;
        $schools[$foundIdx]['subscription_end'] = $sub_end;
        $schools[$foundIdx]['contact_person'] = $contact_person;
        $schools[$foundIdx]['contact_number'] = $contact_number;
        
        saveMockSchools($schools);
        return jsonResponse($response, ['message' => 'School updated successfully.']);
    }
    
    // Fetch original
    $origStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
    $origStmt->execute(['id' => $id]);
    $school = $origStmt->fetch();
    if (!$school) {
        return jsonResponse($response, ['detail' => 'School not found.'], 404);
    }
    
    $name = $data['name'] ?? $school['name'];
    $status = $data['status'] ?? $school['status'];
    $sub_end = $data['subscription_end'] ?? $school['subscription_end'];
    $contact_person = $data['contact_person'] ?? $school['contact_person'];
    $contact_number = $data['contact_number'] ?? $school['contact_number'];
    
    $stmt = $pdo->prepare("UPDATE schools SET name = :name, status = :status, subscription_end = :sub_end, contact_person = :contact_person, contact_number = :contact_number WHERE id = :id");
    $stmt->execute([
        'name' => $name,
        'status' => $status,
        'sub_end' => $sub_end,
        'contact_person' => $contact_person,
        'contact_number' => $contact_number,
        'id' => $id
    ]);
    
    logAudit($pdo, null, $auth['email'], 'Update School', "Updated details for school ID $id.");
    
    return jsonResponse($response, ['message' => 'School updated successfully.']);
});

// Extend Subscription
$app->post('/api/super-admin/schools/{id}/extend', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    $data = getJsonData($request);
    $months = (int)($data['months'] ?? 12); // Default to extend by 12 months (1 year)
    
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
            if (strval($s['id']) === strval($id)) {
                $foundIdx = $idx;
                break;
            }
        }
        
        if ($foundIdx === -1) {
            return jsonResponse($response, ['detail' => 'School not found.'], 404);
        }
        
        $school = $schools[$foundIdx];
        $currentEnd = new DateTime($school['subscription_end']);
        $currentEnd->modify("+$months months");
        $newEnd = $currentEnd->format('Y-m-d');
        
        $schools[$foundIdx]['subscription_end'] = $newEnd;
        saveMockSchools($schools);
        
        return jsonResponse($response, [
            'success' => true,
            'subscription_end' => $newEnd,
            'message' => 'Subscription extended successfully.'
        ]);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $school = $stmt->fetch();
    if (!$school) {
        return jsonResponse($response, ['detail' => 'School not found.'], 404);
    }
    
    // Add months to current subscription end date
    $currentEnd = new DateTime($school['subscription_end']);
    $currentEnd->modify("+$months months");
    $newEnd = $currentEnd->format('Y-m-d');
    
    // Calculate new remaining days
    $today = date('Y-m-d');
    $diff = (strtotime($newEnd) - strtotime($today)) / (60 * 60 * 24);
    $remainingDays = max(0, (int)ceil($diff));
    
    $status = 'Active';
    if ($remainingDays <= 0) {
        $status = 'Expired';
    } else if ($remainingDays < 15) {
        $status = 'Expiring Soon';
    }
    
    $updateStmt = $pdo->prepare("UPDATE schools SET subscription_end = :new_end, status = :status WHERE id = :id");
    $updateStmt->execute([
        'new_end' => $newEnd,
        'status' => $status === 'Expired' ? 'Inactive' : 'Active',
        'id' => $id
    ]);

    $updateSub = $pdo->prepare("UPDATE school_subscriptions SET expiry_date = :new_end, remaining_days = :remaining, status = :sub_status, email_reminder_3 = 0, email_reminder_1 = 0, email_reminder_expired = 0 WHERE school_id = :school_id");
    $updateSub->execute([
        'new_end' => $newEnd,
        'remaining' => $remainingDays,
        'sub_status' => $status,
        'school_id' => $id
    ]);
    
    logAudit($pdo, null, $auth['email'], 'Extend Subscription', "Extended school ID $id by $months months (New End: $newEnd).");
    
    return jsonResponse($response, [
        'success' => true,
        'subscription_end' => $newEnd,
        'message' => 'Subscription extended successfully.'
    ]);
});

// Delete School
$app->delete('/api/super-admin/schools/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schools = getMockSchools();
        $updatedSchools = [];
        foreach ($schools as $s) {
            if (strval($s['id']) !== strval($id)) {
                $updatedSchools[] = $s;
            }
        }
        saveMockSchools($updatedSchools);
        
        $mockUsersFile = __DIR__ . '/../mock_users.json';
        if (file_exists($mockUsersFile)) {
            $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            $updatedUsers = [];
            foreach ($mockUsers as $u) {
                if (strval($u['school_id']) !== strval($id)) {
                    $updatedUsers[] = $u;
                }
            }
            file_put_contents($mockUsersFile, json_encode($updatedUsers, JSON_PRETTY_PRINT));
        }
        
        return jsonResponse($response, ['message' => 'School deleted successfully.']);
    }
    
    $stmt = $pdo->prepare("DELETE FROM schools WHERE id = :id");
    $stmt->execute(['id' => $id]);
    
    logAudit($pdo, null, $auth['email'], 'Delete School', "Removed school ID $id and all its tenant datasets.");
    
    return jsonResponse($response, ['message' => 'School deleted successfully.']);
});

// Get School Details (including subscription history, billing history, audit logs, active students, classes, and teachers)
$app->get('/api/super-admin/schools/{id}/details', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $id = $args['id'];
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        // Mock fallback
        $schools = getMockSchools();
        $school = null;
        foreach ($schools as $s) {
            if (strval($s['id']) === strval($id)) {
                $school = $s;
                break;
            }
        }
        
        if (!$school) {
            return jsonResponse($response, ['detail' => 'School not found.'], 404);
        }
        
        // Mock details
        return jsonResponse($response, [
            'school' => $school,
            'subscription_history' => [
                [
                    'id' => 1,
                    'action' => 'Trial Activated',
                    'performed_by' => 'System',
                    'school_name' => $school['name'],
                    'plan_name' => 'Free Trial',
                    'created_at' => $school['subscription_start'] . ' 10:00:00'
                ]
            ],
            'billing_history' => [
                [
                    'id' => 1,
                    'type' => 'Subscription',
                    'amount' => 0.00,
                    'status' => 'Paid',
                    'description' => 'Free Trial Onboarding',
                    'date' => $school['subscription_start']
                ]
            ],
            'audit_logs' => [
                [
                    'id' => 1,
                    'operator' => 'System',
                    'action' => 'School Provisioned',
                    'timestamp' => $school['subscription_start'] . ' 10:00:00',
                    'details' => 'School database schema created successfully.'
                ]
            ],
            'students_count' => 120,
            'classes_count' => 6,
            'teachers_count' => 12,
            'students' => [
                ['id' => 1, 'name' => 'Mock Student A', 'roll_number' => '101', 'status' => 'Active'],
                ['id' => 2, 'name' => 'Mock Student B', 'roll_number' => '102', 'status' => 'Active']
            ],
            'classes' => [
                ['id' => 1, 'name' => 'Grade 1', 'room' => '101'],
                ['id' => 2, 'name' => 'Grade 2', 'room' => '102']
            ],
            'teachers' => [
                ['id' => 1, 'name' => 'Mock Teacher A', 'subject' => 'Mathematics', 'status' => 'Active'],
                ['id' => 2, 'name' => 'Mock Teacher B', 'subject' => 'Science', 'status' => 'Active']
            ]
        ]);
    }
    
    // DB mode
    $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
    $stmt->execute(['id' => $id]);
    $school = $stmt->fetch();
    if (!$school) {
        return jsonResponse($response, ['detail' => 'School not found.'], 404);
    }
    
    // Computed subscription status
    $today = new DateTime();
    $end = new DateTime($school['subscription_end']);
    $interval = $today->diff($end);
    $school['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;
    
    // Fetch subscription audit logs (based on school name matching)
    $subLogsStmt = $pdo->prepare("SELECT * FROM subscription_audit_logs WHERE school_name = :name ORDER BY id DESC");
    $subLogsStmt->execute(['name' => $school['name']]);
    $subHistory = $subLogsStmt->fetchAll();
    
    // If empty sub history, let's create a synthesized first row representing their start date
    if (empty($subHistory)) {
        $subHistory = [
            [
                'id' => 0,
                'action' => 'Plan Activated',
                'performed_by' => 'System',
                'school_name' => $school['name'],
                'plan_name' => 'Onboarding Plan',
                'created_at' => $school['subscription_start'] . ' 10:00:00'
            ]
        ];
    }
    
    // Build billing history. We'll combine:
    // 1. Subscription charges from subscription_audit_logs (we can map plans to their prices if we join)
    // 2. School's internal revenue/fee records (to show financial stats of the school itself)
    $billingHistory = [];
    $idx = 1;
    foreach ($subHistory as $sh) {
        $planPriceStmt = $pdo->prepare("SELECT price FROM subscription_plans WHERE name = :name LIMIT 1");
        $planPriceStmt->execute(['name' => $sh['plan_name']]);
        $price = $planPriceStmt->fetchColumn();
        if ($price === false) {
            $price = ($sh['plan_name'] === 'Free Trial' ? 0.00 : 999.00);
        }
        
        $billingHistory[] = [
            'id' => $idx++,
            'type' => 'Subscription',
            'amount' => (float)$price,
            'status' => 'Paid',
            'description' => "Subscription: " . $sh['plan_name'] . " (" . $sh['action'] . ")",
            'date' => date('Y-m-d', strtotime($sh['created_at']))
        ];
    }
    
    // General school audit logs
    $auditStmt = $pdo->prepare("SELECT * FROM audit_logs WHERE school_id = :school_id ORDER BY id DESC LIMIT 50");
    $auditStmt->execute(['school_id' => $id]);
    $auditLogs = $auditStmt->fetchAll();
    
    // Total numbers
    $studCount = (int)$pdo->query("SELECT COUNT(*) FROM students WHERE school_id = $id")->fetchColumn();
    $classCount = (int)$pdo->query("SELECT COUNT(*) FROM classrooms WHERE school_id = $id")->fetchColumn();
    $teachCount = (int)$pdo->query("SELECT COUNT(*) FROM teachers WHERE school_id = $id")->fetchColumn();
    
    // List details
    $studStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id ORDER BY name ASC");
    $studStmt->execute(['school_id' => $id]);
    $students = $studStmt->fetchAll();
    
    $classStmt = $pdo->prepare("SELECT * FROM classrooms WHERE school_id = :school_id ORDER BY name ASC");
    $classStmt->execute(['school_id' => $id]);
    $classes = $classStmt->fetchAll();
    
    $teachStmt = $pdo->prepare("SELECT * FROM teachers WHERE school_id = :school_id ORDER BY name ASC");
    $teachStmt->execute(['school_id' => $id]);
    $teachers = $teachStmt->fetchAll();
    
    return jsonResponse($response, [
        'school' => $school,
        'subscription_history' => $subHistory,
        'billing_history' => $billingHistory,
        'audit_logs' => $auditLogs,
        'students_count' => $studCount,
        'classes_count' => $classCount,
        'teachers_count' => $teachCount,
        'students' => $students,
        'classes' => $classes,
        'teachers' => $teachers
    ]);
});

// Get Student Fee records for Super Admin context
$app->get('/api/super-admin/schools/{schoolId}/students/{studentId}/fees', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $schoolId = $args['schoolId'];
    $studentId = $args['studentId'];
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    if ($pdo === null) {
        return jsonResponse($response, []);
    }
    
    // Get student's class_id
    $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
    $studStmt->execute(['id' => $studentId, 'school_id' => $schoolId]);
    $student = $studStmt->fetch();
    $classId = $student ? $student['class_id'] : 0;
    
    // Get active academic year id
    $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
    $ayStmt->execute(['school_id' => $schoolId]);
    $ay_id = $ayStmt->fetchColumn() ?: 0;
    
    // Check if class fee structure is configured
    $isConfigured = false;
    if ($classId) {
        $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ay_id,
            'class_id' => $classId
        ]);
        $isConfigured = ($cfStmt->fetchColumn() > 0);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
    $stmt->execute(['student_id' => $studentId, 'ay_id' => $ay_id, 'school_id' => $schoolId]);
    $records = $stmt->fetchAll();
    
    if (!$isConfigured) {
        foreach ($records as &$rec) {
            if ($rec['status'] === 'Pending') {
                $rec['amount'] = 0.00;
            }
        }
    }
    
    return jsonResponse($response, $records);
});

// Get Teacher Salary records for Super Admin context
$app->get('/api/super-admin/schools/{schoolId}/teachers/{teacherId}/salary', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || $auth['role'] !== 'Super Admin') {
        return jsonResponse($response, ['detail' => 'Unauthorized Access.'], 403);
    }
    
    $schoolId = $args['schoolId'];
    $teacherId = $args['teacherId'];
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    if ($pdo === null) {
        return jsonResponse($response, []);
    }
    
    // Get active academic year id
    $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
    $ayStmt->execute(['school_id' => $schoolId]);
    $ay_id = $ayStmt->fetchColumn() ?: 0;
    
    // Fetch salary records
    $stmt = $pdo->prepare("SELECT * FROM salary_records WHERE teacher_id = :teacher_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
    $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ay_id, 'school_id' => $schoolId]);
    $records = $stmt->fetchAll();
    
    return jsonResponse($response, $records);
});

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
// Academic Years
$app->get('/api/academic-years', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :school_id ORDER BY id ASC");
    $stmt->execute(['school_id' => $auth['school_id']]);
    return jsonResponse($response, $stmt->fetchAll());
});

$app->post('/api/academic-years', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $range = $data['year_range'] ?? '';
    $startDate = $data['start_date'] ?? null;
    $endDate = $data['end_date'] ?? null;
    $description = $data['description'] ?? null;
    
    $pdo = getDb();
    
    // Auto-generate range if empty
    if (empty($range)) {
        $maxStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE school_id = :school_id ORDER BY id DESC LIMIT 1");
        $maxStmt->execute(['school_id' => $auth['school_id']]);
        $latest = $maxStmt->fetch();
        if ($latest) {
            $parts = explode('-', $latest['year_range']);
            $start = (int)$parts[0];
            if ($start) {
                $range = ($start + 1) . '-' . ($start + 2);
            }
        }
        if (empty($range)) {
            $range = date('Y') . '-' . (date('Y') + 1);
        }
    }
    
    // Validate duplicates
    $chk = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE school_id = :school_id AND year_range = :range");
    $chk->execute(['school_id' => $auth['school_id'], 'range' => $range]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Academic year range already exists'], 400);
    }
    
    $feeStructure = $data['fee_structure'] ?? null;
    $feeStructureJson = null;
    if ($feeStructure) {
        $feeStructureJson = is_array($feeStructure) ? json_encode($feeStructure) : $feeStructure;
    } else {
        $feeStructureJson = json_encode([
            "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0, 
            "September" => 0, "October" => 0, "November" => 0, "December" => 0, 
            "January" => 0, "February" => 0, "March" => 0
        ]);
    }
    
    $stmt = $pdo->prepare("INSERT INTO academic_years (school_id, year_range, start_date, end_date, description, status, fee_structure, is_active) VALUES (:school_id, :range, :start_date, :end_date, :description, 'Draft', :fee_structure, 0)");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'range' => $range,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'description' => $description,
        'fee_structure' => $feeStructureJson
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Year', "Created academic year session $range in Draft status.");
    
    return jsonResponse($response, ['message' => 'Year added successfully', 'year_range' => $range]);
});

$app->post('/api/academic-years/{id}/activate', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = (int)($args['id'] ?? 0);
    $data = getJsonData($request);
    
    $pdo = getDb();
    $pdo->beginTransaction();
    
    try {
        // Fetch target year
        $targetStmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :school_id");
        $targetStmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
        $targetYear = $targetStmt->fetch();
        if (!$targetYear) {
            $pdo->rollBack();
            return jsonResponse($response, ['detail' => 'Academic year not found'], 404);
        }
        
        // Find current active year
        $currStmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :school_id AND status = 'Active'");
        $currStmt->execute(['school_id' => $auth['school_id']]);
        $currYear = $currStmt->fetch();
        $old_ay_id = $currYear ? (int)$currYear['id'] : null;
        
        // Archive old active year
        if ($old_ay_id) {
            $archStmt = $pdo->prepare("UPDATE academic_years SET status = 'Archived', is_active = 0 WHERE id = :id");
            $archStmt->execute(['id' => $old_ay_id]);
        }
        
        // Activate target year
        $actStmt = $pdo->prepare("UPDATE academic_years SET status = 'Active', is_active = 1 WHERE id = :id");
        $actStmt->execute(['id' => $targetYear['id']]);
        
        // Promote students if there was a previous year
        $promotedCount = 0;
        $repeatingCount = 0;
        $graduatedCount = 0;
        
        if ($old_ay_id) {
            $studentsStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id");
            $studentsStmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $old_ay_id]);
            $oldStudents = $studentsStmt->fetchAll();
            
            $classMappings = $data['class_mappings'] ?? [];
            $studentStatus = $data['student_status'] ?? [];
            
            $insStudent = $pdo->prepare("INSERT INTO students (
                school_id, academic_year_id, class_id, group_name, gender, name, roll_number, sr_no, phone, email, 
                country, state, city, status, father_name, mother_name, address, date_of_birth, admission_date, 
                emergency_contact, blood_group, aadhaar_number, nationality, caste, profile_image
            ) VALUES (
                :school_id, :academic_year_id, :class_id, :group_name, :gender, :name, :roll_number, :sr_no, :phone, :email, 
                :country, :state, :city, :status, :father_name, :mother_name, :address, :date_of_birth, :admission_date, 
                :emergency_contact, :blood_group, :aadhaar_number, :nationality, :caste, :profile_image
            )");
            
            $updOldStudent = $pdo->prepare("UPDATE students SET status = :status WHERE id = :id");
            
            $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
            $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
            $insFees = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date) VALUES (:school_id, :student_id, :ay_id, :month, :amount, 'Pending', :due_date)");
            
            // Parse start year of target academic year to seed fee due dates properly
            $rangeParts = explode('-', $targetYear['year_range']);
            $startYear = (int)$rangeParts[0];
            if (!$startYear) $startYear = (int)date('Y');
            
            foreach ($oldStudents as $student) {
                $studId = $student['id'];
                $oldClassId = $student['class_id'];
                
                // Get promotion choice: 'promote', 'repeat', 'graduate'
                $statusChoice = $studentStatus[$studId] ?? null;
                if (!$statusChoice) {
                    $mappedClass = $classMappings[$oldClassId] ?? null;
                    if ($mappedClass === 'Alumni' || $mappedClass === 'Alumni / Passed Out') {
                        $statusChoice = 'graduate';
                    } else {
                        $statusChoice = 'promote';
                    }
                }
                
                $newClassId = $oldClassId;
                $newStatus = 'Active';
                
                if ($statusChoice === 'graduate') {
                    $newStatus = 'Alumni';
                    $graduatedCount++;
                } else if ($statusChoice === 'repeat') {
                    $newClassId = $oldClassId;
                    $newStatus = 'Active';
                    $repeatingCount++;
                } else {
                    $mappedClass = $classMappings[$oldClassId] ?? null;
                    if ($mappedClass === 'Alumni' || $mappedClass === 'Alumni / Passed Out' || !$mappedClass) {
                        $newStatus = 'Alumni';
                        $graduatedCount++;
                    } else {
                        $newClassId = (int)$mappedClass;
                        $newStatus = 'Active';
                        $promotedCount++;
                    }
                }
                
                if ($student['status'] === 'Inactive') {
                    $newStatus = 'Inactive';
                }
                
                if ($newStatus === 'Alumni' || $newStatus === 'Inactive') {
                    $updOldStudent->execute(['status' => $newStatus, 'id' => $studId]);
                    
                    // Calculate previous year unpaid dues and insert carry forward records
                    $unpaidTuitionStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND status = 'Pending'");
                    $unpaidTuitionStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                    $unpaidTuition = (float)$unpaidTuitionStmt->fetchColumn() ?: 0.00;

                    $unpaidExtraStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id WHERE sef.student_id = :student_id AND sef.academic_year_id = :ay_id AND sef.status = 'Pending'");
                    $unpaidExtraStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                    $unpaidExtra = (float)$unpaidExtraStmt->fetchColumn() ?: 0.00;

                    $totalPrevDues = $unpaidTuition + $unpaidExtra;
                    if ($totalPrevDues > 0.00) {
                        $insCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, 0.00, 'Pending')");
                        $insCF->execute([
                            'school_id' => $auth['school_id'],
                            'student_id' => $studId,
                            'original_academic_year_id' => $old_ay_id,
                            'amount' => $totalPrevDues
                        ]);
                    }
                    continue;
                }
                
                // Insert student copy
                $insStudent->execute([
                    'school_id' => $auth['school_id'],
                    'academic_year_id' => $targetYear['id'],
                    'class_id' => $newClassId,
                    'group_name' => $student['group_name'],
                    'gender' => $student['gender'],
                    'name' => $student['name'],
                    'roll_number' => $student['roll_number'],
                    'sr_no' => $student['sr_no'],
                    'phone' => $student['phone'],
                    'email' => $student['email'],
                    'country' => $student['country'],
                    'state' => $student['state'],
                    'city' => $student['city'],
                    'status' => $newStatus,
                    'father_name' => $student['father_name'],
                    'mother_name' => $student['mother_name'],
                    'address' => $student['address'],
                    'date_of_birth' => $student['date_of_birth'],
                    'admission_date' => $student['admission_date'],
                    'emergency_contact' => $student['emergency_contact'],
                    'blood_group' => $student['blood_group'],
                    'aadhaar_number' => $student['aadhaar_number'],
                    'nationality' => $student['nationality'],
                    'caste' => $student['caste'],
                    'profile_image' => $student['profile_image']
                ]);
                
                $newStudentId = $pdo->lastInsertId();
                
                // Calculate previous year unpaid dues and insert carry forward records
                $unpaidTuitionStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND status = 'Pending'");
                $unpaidTuitionStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                $unpaidTuition = (float)$unpaidTuitionStmt->fetchColumn() ?: 0.00;

                $unpaidExtraStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id WHERE sef.student_id = :student_id AND sef.academic_year_id = :ay_id AND sef.status = 'Pending'");
                $unpaidExtraStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                $unpaidExtra = (float)$unpaidExtraStmt->fetchColumn() ?: 0.00;

                $totalPrevDues = $unpaidTuition + $unpaidExtra;
                if ($totalPrevDues > 0.00) {
                    $insCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, 0.00, 'Pending')");
                    $insCF->execute([
                        'school_id' => $auth['school_id'],
                        'student_id' => $newStudentId,
                        'original_academic_year_id' => $old_ay_id,
                        'amount' => $totalPrevDues
                    ]);
                }

                // Retrieve and copy over existing older carry forward dues from the old student copy
                $oldCFStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE student_id = :student_id AND status = 'Pending'");
                $oldCFStmt->execute(['student_id' => $studId]);
                $oldCFs = $oldCFStmt->fetchAll();
                
                if (!empty($oldCFs)) {
                    $insOldCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, :paid_amount, 'Pending')");
                    foreach ($oldCFs as $cf) {
                        $insOldCF->execute([
                            'school_id' => $auth['school_id'],
                            'student_id' => $newStudentId,
                            'original_academic_year_id' => $cf['original_academic_year_id'],
                            'amount' => $cf['amount'],
                            'paid_amount' => $cf['paid_amount']
                        ]);
                    }
                }

                
                // Seeding fee records for Active students in new year
                if ($newStatus === 'Active') {
                    $cfStmt->execute([
                        'school_id' => $auth['school_id'],
                        'ay_id' => $targetYear['id'],
                        'class_id' => $newClassId
                    ]);
                    $cfRes = $cfStmt->fetch();
                    $targetFeeStructure = [];
                    if ($cfRes) {
                        $targetFeeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
                    }
                    
                    foreach ($months as $idx => $m) {
                        $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
                        $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
                        $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
                        $amount = isset($targetFeeStructure[$m]) ? (float)$targetFeeStructure[$m] : 0.00;
                        $insFees->execute([
                            'school_id' => $auth['school_id'],
                            'student_id' => $newStudentId,
                            'ay_id' => $targetYear['id'],
                            'month' => $m,
                            'amount' => $amount,
                            'due_date' => $dueDate
                        ]);
                    }
                }
            }
            $auditDetails = "Transitioned school session to {$targetYear['year_range']}. Promoted $promotedCount, repeating $repeatingCount, graduated $graduatedCount.";
        } else {
            $auditDetails = "Initialized active school session {$targetYear['year_range']}. No students to transition.";
        }
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Year Transition', $auditDetails);
        $pdo->commit();
        
        return jsonResponse($response, ['message' => 'Academic year activated successfully', 'details' => $auditDetails]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Activation transaction failed: ' . $e->getMessage()], 500);
    }
});

$app->put('/api/academic-years/{id}/archive', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = (int)($args['id'] ?? 0);
    $pdo = getDb();
    
    $stmt = $pdo->prepare("UPDATE academic_years SET status = 'Archived', is_active = 0 WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Archive Year', "Archived academic year ID $id.");
    return jsonResponse($response, ['message' => 'Academic year archived successfully']);
});

$app->get('/api/class-fees', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $class_id = (int)($params['class_id'] ?? 0);
    $ay_id = (int)($params['academic_year_id'] ?? 0);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT fee_structure, is_locked FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $class_id
    ]);
    $res = $stmt->fetch();
    
    if ($res) {
        $feeData = json_decode($res['fee_structure'], true) ?: [];
        $feeData['is_locked'] = (int)$res['is_locked'];
        $feeData['is_configured'] = true;
        return jsonResponse($response, $feeData);
    } else {
        return jsonResponse($response, [
            "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0,
            "September" => 0, "October" => 0, "November" => 0, "December" => 0,
            "January" => 0, "February" => 0, "March" => 0,
            "is_locked" => 0,
            "is_configured" => false
        ]);
    }
});

$app->post('/api/class-fees', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $class_id = (int)($data['class_id'] ?? 0);
    $ay_id = (int)($data['academic_year_id'] ?? 0);
    $fee_structure = $data['fee_structure'] ?? null;
    $is_locked = (int)($data['is_locked'] ?? 0);
    
    if (!$class_id || !$ay_id || !$fee_structure) {
        return jsonResponse($response, ['detail' => 'Missing required fields'], 400);
    }
    
    $pdo = getDb();
    
    // Lock check validation
    $checkStmt = $pdo->prepare("SELECT is_locked FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $checkStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $class_id
    ]);
    $existing = $checkStmt->fetch();
    if ($existing && $existing['is_locked']) {
        return jsonResponse($response, ['detail' => 'This fee structure is locked and cannot be modified.'], 403);
    }
    
    $feeStructureJson = is_array($fee_structure) ? json_encode($fee_structure) : $fee_structure;
    
    $stmt = $pdo->prepare("INSERT INTO class_fees (school_id, academic_year_id, class_id, fee_structure, is_locked) 
        VALUES (:school_id, :ay_id, :class_id, :fee_structure, :is_locked) 
        ON DUPLICATE KEY UPDATE fee_structure = :fee_structure, is_locked = :is_locked");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $class_id,
        'fee_structure' => $feeStructureJson,
        'is_locked' => $is_locked
    ]);
    
    // UPDATE all Pending fee_records for the students in this class for this academic year
    $feeStructureArray = is_array($fee_structure) ? $fee_structure : json_decode($fee_structure, true);
    if ($feeStructureArray) {
        $updateStmt = $pdo->prepare("UPDATE fee_records f
            JOIN students s ON f.student_id = s.id
            SET f.amount = :amount
            WHERE f.school_id = :school_id
              AND f.academic_year_id = :ay_id
              AND s.class_id = :class_id
              AND f.month = :month
              AND f.status = 'Pending'");
        
        $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        foreach ($months as $m) {
            if (isset($feeStructureArray[$m])) {
                $updateStmt->execute([
                    'amount' => (float)$feeStructureArray[$m],
                    'school_id' => $auth['school_id'],
                    'ay_id' => $ay_id,
                    'class_id' => $class_id,
                    'month' => $m
                ]);
            }
        }
    }
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Configure Fees', "Updated monthly fee structure for Class ID $class_id (Locked: $is_locked).");
    
    return jsonResponse($response, ['success' => true]);
});

$app->get('/api/reports/cross-year', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    
    // Get all years
    $yearsStmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :school_id ORDER BY id ASC");
    $yearsStmt->execute(['school_id' => $auth['school_id']]);
    $years = $yearsStmt->fetchAll();
    
    $results = [];
    foreach ($years as $y) {
        $ayId = $y['id'];
        
        // Count students
        $studStmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND status = 'Active'");
        $studStmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ayId]);
        $studentCount = (int)$studStmt->fetchColumn();
        
        // Count revenue (paid fees)
        $revStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE school_id = :school_id AND academic_year_id = :ay_id AND status = 'Paid'");
        $revStmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ayId]);
        $revenue = (float)($revStmt->fetchColumn() ?: 0.0);
        
        // Count salary expense (paid salary)
        $salStmt = $pdo->prepare("SELECT SUM(amount) FROM salary_records WHERE school_id = :school_id AND academic_year_id = :ay_id AND status = 'Paid'");
        $salStmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ayId]);
        $salaryExpense = (float)($salStmt->fetchColumn() ?: 0.0);
        
        // Calculate performance index (simulated based on ID)
        $perfIndex = 82.5 + (($ayId * 3.7) % 12);
        
        $results[] = [
            'id' => $ayId,
            'year_range' => $y['year_range'],
            'status' => $y['status'],
            'start_date' => $y['start_date'],
            'end_date' => $y['end_date'],
            'student_count' => $studentCount,
            'revenue' => $revenue,
            'salary_expense' => $salaryExpense,
            'performance_index' => round($perfIndex, 1) . '%'
        ];
    }
    
    return jsonResponse($response, $results);
});


// Classrooms
$app->get('/api/classes', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM classrooms WHERE school_id = :school_id");
    $stmt->execute(['school_id' => $auth['school_id']]);
    $classes = $stmt->fetchAll();
    
    // For backward-compatibility, attach an empty groups list
    foreach ($classes as &$c) {
        $c['groups'] = [];
    }
    
    return jsonResponse($response, $classes);
});

$app->post('/api/classes', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $room = trim($data['room'] ?? '');
    
    if (empty($name)) return jsonResponse($response, ['detail' => 'Classroom name required'], 400);
    
    $pdo = getDb();
    
    // Check duplicate classroom name within school
    $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = :school_id AND LOWER(name) = LOWER(:name)");
    $chkStmt->execute(['school_id' => $auth['school_id'], 'name' => $name]);
    if ($chkStmt->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Class name already exists'], 400);
    }
    
    $classTeacherId = $data['class_teacher_id'] ?? null;
    $stmt = $pdo->prepare("INSERT INTO classrooms (school_id, name, room, class_teacher_id) VALUES (:school_id, :name, :room, :class_teacher_id)");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'name' => $name,
        'room' => $room,
        'class_teacher_id' => $classTeacherId ? (int)$classTeacherId : null
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Class', "Created classroom $name ($room).");
    
    return jsonResponse($response, ['message' => 'Classroom created successfully']);
});

$app->delete('/api/classes/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = $args['id'] ?? null;
    if (!$id) return jsonResponse($response, ['detail' => 'Class ID required'], 400);
    
    $pdo = getDb();
    
    // Check if the class belongs to this school
    $chk = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id AND school_id = :school_id");
    $chk->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    $className = $chk->fetchColumn();
    if (!$className) {
        return jsonResponse($response, ['detail' => 'Class not found'], 404);
    }

    // Check if classroom is locked due to paid transactions in a finalized financial report
    if (isClassroomLocked($pdo, $auth['school_id'], $id)) {
        return jsonResponse($response, ['detail' => 'This classroom contains students with payments inside a finalized Financial Report and cannot be deleted.'], 400);
    }
    
    // Delete the classroom
    $stmt = $pdo->prepare("DELETE FROM classrooms WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Delete Class', "Deleted class $className (ID: $id) along with all cascade data.");
    
    return jsonResponse($response, ['message' => 'Class deleted successfully']);
});

$app->put('/api/classes/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = $args['id'] ?? null;
    if (!$id) return jsonResponse($response, ['detail' => 'Class ID required'], 400);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    
    if (empty($name)) return jsonResponse($response, ['detail' => 'Classroom name required'], 400);
    
    $pdo = getDb();
    
    // Check if the class belongs to this school
    $chk = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id AND school_id = :school_id");
    $chk->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    $oldName = $chk->fetchColumn();
    if (!$oldName) {
        return jsonResponse($response, ['detail' => 'Class not found'], 404);
    }
    
    // Check duplicate classroom name within school (except current class)
    $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = :school_id AND LOWER(name) = LOWER(:name) AND id != :id");
    $chkStmt->execute(['school_id' => $auth['school_id'], 'name' => $name, 'id' => $id]);
    if ($chkStmt->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Class name already exists'], 400);
    }
    
    $classTeacherId = $data['class_teacher_id'] ?? null;
    $stmt = $pdo->prepare("UPDATE classrooms SET name = :name, class_teacher_id = :class_teacher_id WHERE id = :id AND school_id = :school_id");
    $stmt->execute([
        'name' => $name,
        'class_teacher_id' => $classTeacherId ? (int)$classTeacherId : null,
        'id' => $id,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Update Class', "Updated classroom name from '$oldName' to '$name'.");
    
    return jsonResponse($response, ['message' => 'Classroom updated successfully']);
});

// Teachers
$app->get('/api/teachers', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM teachers WHERE school_id = :school_id");
    $stmt->execute(['school_id' => $auth['school_id']]);
    return jsonResponse($response, $stmt->fetchAll());
});

$app->post('/api/teachers', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = $data['name'] ?? '';
    $subject = $data['subject'] ?? '';
    $salary = (float)($data['salary_amount'] ?? 3000.0);
    
    if (empty($name) || empty($subject)) {
        return jsonResponse($response, ['detail' => 'Teacher Name and Subject are required.'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("INSERT INTO teachers (school_id, name, gender, subject, phone, email, qualification, experience, aadhaar_number, pan_number, address, joining_date, exit_date, salary_amount, status, profile_image, documents) 
        VALUES (:school_id, :name, :gender, :subject, :phone, :email, :qualification, :experience, :aadhaar_number, :pan_number, :address, :joining_date, :exit_date, :salary_amount, 'Active', :profile_image, :documents)");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'name' => $name,
        'gender' => $data['gender'] ?? 'Male',
        'subject' => $subject,
        'phone' => $data['phone'] ?? '',
        'email' => $data['email'] ?? '',
        'qualification' => $data['qualification'] ?? '',
        'experience' => $data['experience'] ?? '',
        'aadhaar_number' => $data['aadhaar_number'] ?? null,
        'pan_number' => $data['pan_number'] ?? null,
        'address' => $data['address'] ?? '',
        'joining_date' => $data['joining_date'] ?: date('Y-m-d'),
        'exit_date' => $data['exit_date'] ?: null,
        'salary_amount' => $salary,
        'profile_image' => $data['profile_image'] ?? null,
        'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Teacher', "Onboarded teacher $name.");
    
    return jsonResponse($response, ['message' => 'Teacher added successfully']);
});
 
$app->put('/api/teachers/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = $args['id'];
    $data = getJsonData($request);
    
    $pdo = getDb();
    
    // Check if it is a full edit or a simple status toggle
    if (isset($data['name']) || isset($data['subject'])) {
        $sql = "UPDATE teachers SET 
            name = :name, 
            gender = :gender,
            subject = :subject, 
            phone = :phone, 
            email = :email, 
            qualification = :qualification, 
            experience = :experience, 
            aadhaar_number = :aadhaar_number,
            pan_number = :pan_number,
            address = :address, 
            joining_date = :joining_date, 
            exit_date = :exit_date,
            salary_amount = :salary_amount,
            status = :status,
            profile_image = :profile_image,
            documents = :documents
            WHERE id = :id AND school_id = :school_id";
            
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'name' => $data['name'] ?? '',
            'gender' => $data['gender'] ?? 'Male',
            'subject' => $data['subject'] ?? '',
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'qualification' => $data['qualification'] ?? '',
            'experience' => $data['experience'] ?? '',
            'aadhaar_number' => $data['aadhaar_number'] ?? null,
            'pan_number' => $data['pan_number'] ?? null,
            'address' => $data['address'] ?? '',
            'joining_date' => $data['joining_date'] ?: null,
            'exit_date' => $data['exit_date'] ?: null,
            'salary_amount' => (float)($data['salary_amount'] ?? 3000.0),
            'status' => $data['status'] ?? 'Active',
            'profile_image' => $data['profile_image'] ?? null,
            'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null,
            'id' => $id,
            'school_id' => $auth['school_id']
        ]);
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Modify Teacher', "Updated details of teacher $id.");
    } else {
        $status = $data['status'] ?? 'Active';
        $stmt = $pdo->prepare("UPDATE teachers SET status = :status WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['status' => $status, 'id' => $id, 'school_id' => $auth['school_id']]);
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Modify Teacher', "Updated status of teacher ID $id to $status.");
    }
    
    return jsonResponse($response, ['message' => 'Teacher updated successfully']);
});

$app->delete('/api/teachers/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = $args['id'];
    $pdo = getDb();
    
    // Check if teacher is locked due to paid salaries in a finalized financial report
    if (isTeacherLocked($pdo, $auth['school_id'], $id)) {
        return jsonResponse($response, ['detail' => 'This teacher has salary disbursements inside a finalized Financial Report and cannot be deleted.'], 400);
    }
    
    $stmt = $pdo->prepare("DELETE FROM teachers WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Delete Teacher', "Removed teacher ID $id.");
    
    return jsonResponse($response, ['message' => 'Teacher deleted']);
});

// Students
$app->get('/api/students', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? null;
    $class_id = $params['class_id'] ?? null;
    
    $pdo = getDb();
    
    $sql = "SELECT s.* FROM students s WHERE s.school_id = :school_id";
    $binds = ['school_id' => $auth['school_id']];
    
    if ($ay_id) {
        $sql .= " AND s.academic_year_id = :ay_id";
        $binds['ay_id'] = $ay_id;
    }
    
    if ($class_id) {
        // Validate class ownership
        $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
        $classChk->execute(['class_id' => $class_id, 'school_id' => $auth['school_id']]);
        if ($classChk->fetchColumn() == 0) {
            return jsonResponse($response, ['detail' => 'The specified Class ID does not belong to your school.'], 403);
        }
        $sql .= " AND s.class_id = :class_id";
        $binds['class_id'] = $class_id;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($binds);
    $students = $stmt->fetchAll();
    
    $now = new DateTime();
    $currentYear = (int)$now->format('Y');
    $currentMonth = (int)$now->format('n');
    
    $feeStmt = $pdo->prepare("SELECT due_date, status, amount FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id");
    $classFeeStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $extraFeeStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef
                                   JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                                   WHERE sef.student_id = :student_id 
                                     AND sef.academic_year_id = :ay_id 
                                     AND sef.status = 'Pending'");
    
    foreach ($students as &$s) {
        $feeStmt->execute(['student_id' => $s['id'], 'ay_id' => $s['academic_year_id']]);
        $fees = $feeStmt->fetchAll();
        
        $pastUnpaidCount = 0;
        $isCurrentUnpaid = false;
        $totalUnpaid = 0; // count of unpaid records up to current month
        $totalDuesVal = 0.00;
        
        foreach ($fees as $f) {
            if ($f['status'] !== 'Paid') {
                $parts = explode('-', $f['due_date']);
                $dueY = isset($parts[0]) ? (int)$parts[0] : 0;
                $dueM = isset($parts[1]) ? (int)$parts[1] : 0;
                
                // Only consider unpaid records up to the current month/year
                if ($dueY < $currentYear || ($dueY === $currentYear && $dueM <= $currentMonth)) {
                    $totalUnpaid++;
                    $totalDuesVal += (float)$f['amount'];
                    
                    if ($dueY < $currentYear || ($dueY === $currentYear && $dueM < $currentMonth)) {
                        $pastUnpaidCount++;
                    } else if ($dueY === $currentYear && $dueM === $currentMonth) {
                        $isCurrentUnpaid = true;
                    }
                }
            }
        }
        
        $extraFeeStmt->execute(['student_id' => $s['id'], 'ay_id' => $s['academic_year_id']]);
        $pendingExtraSum = (float)$extraFeeStmt->fetchColumn() ?: 0.00;
        $totalDuesVal += $pendingExtraSum;
        // Additional Fee should not affect Student Fee Status, so do not increment $totalUnpaid
        
        $s['total_dues'] = $totalDuesVal;

        $classFeeStmt->execute([
            'school_id' => $auth['school_id'],
            'ay_id' => $s['academic_year_id'],
            'class_id' => $s['class_id']
        ]);
        $cfRes = $classFeeStmt->fetch();
        $monthlyFee = 0.00;
        $isConfigured = false;
        if ($cfRes) {
            $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
            $monthlyFee = isset($feeStructure['April']) ? (float)$feeStructure['April'] : 0.00;
            $isConfigured = true;
        }
        $s['monthly_fee'] = $monthlyFee;
        
        if (!$isConfigured) {
            $s['fee_status'] = 'FEE NOT SET';
        } else if ($totalUnpaid === 0) {
            $s['fee_status'] = 'PAID';
        } else if ($totalUnpaid === 1) {
            $s['fee_status'] = $isCurrentUnpaid ? 'DUES PENDING' : 'PAYMENT OVERDUE';
        } else if ($totalUnpaid === 2) {
            $s['fee_status'] = 'CRITICAL DUES';
        } else {
            $s['fee_status'] = 'DEFAULT ALERT';
        }
    }
    
    return jsonResponse($response, $students);
});

$app->post('/api/students', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $roll = trim($data['roll_number'] ?? '');
    $class_id = (int)($data['class_id'] ?? 0);
    $ay_id = (int)($data['academic_year_id'] ?? 0);
    
    if (empty($name) || empty($roll) || !$class_id || !$ay_id) {
        return jsonResponse($response, ['detail' => 'Name, Roll, Class and Academic Year are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Validate class ownership
    $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
    $classChk->execute(['class_id' => $class_id, 'school_id' => $auth['school_id']]);
    if ($classChk->fetchColumn() == 0) {
        return jsonResponse($response, ['detail' => 'The specified Class ID does not belong to your school.'], 403);
    }
    
    // Validate academic year ownership
    $ayChk = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE id = :ay_id AND school_id = :school_id");
    $ayChk->execute(['ay_id' => $ay_id, 'school_id' => $auth['school_id']]);
    if ($ayChk->fetchColumn() == 0) {
        return jsonResponse($response, ['detail' => 'The specified Academic Year ID does not belong to your school.'], 403);
    }
    
    // Check duplicate roll number
    $chk = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND roll_number = :roll AND academic_year_id = :ay_id");
    $chk->execute(['school_id' => $auth['school_id'], 'roll' => $roll, 'ay_id' => $ay_id]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Duplicate Roll Number detected in this session!'], 400);
    }
    
    $exit_date = isset($data['exit_date']) && trim($data['exit_date']) !== '' ? trim($data['exit_date']) : null;
    $status = ($exit_date !== null) ? 'Inactive' : 'Active';

    $stmt = $pdo->prepare("INSERT INTO students (school_id, academic_year_id, class_id, group_name, gender, name, roll_number, sr_no, phone, email, country, state, city, father_name, mother_name, address, date_of_birth, admission_date, exit_date, status, emergency_contact, blood_group, aadhaar_number, nationality, caste, profile_image, documents) VALUES (:school_id, :ay_id, :class_id, :group_name, :gender, :name, :roll, :sr_no, :phone, :email, :country, :state, :city, :father, :mother, :address, :dob, :adm_date, :exit_date, :status, :emergency, :blood, :aadhaar, :nationality, :caste, :profile_image, :documents)");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $class_id,
        'group_name' => isset($data['group_name']) ? (trim($data['group_name']) ?: null) : null,
        'gender' => $data['gender'] ?? 'Male',
        'name' => $name,
        'roll' => $roll,
        'sr_no' => $data['sr_no'] ?? null,
        'phone' => $data['phone'] ?? '',
        'email' => $data['email'] ?? '',
        'country' => $data['country'] ?? null,
        'state' => $data['state'] ?? null,
        'city' => $data['city'] ?? null,
        'father' => $data['father_name'] ?? '',
        'mother' => $data['mother_name'] ?? '',
        'address' => $data['address'] ?? '',
        'dob' => $data['date_of_birth'] ?? null,
        'adm_date' => $data['admission_date'] ?? date('Y-m-d'),
        'exit_date' => $exit_date,
        'status' => $status,
        'emergency' => $data['emergency_contact'] ?? '',
        'blood' => $data['blood_group'] ?? 'O+',
        'aadhaar' => $data['aadhaar_number'] ?? '',
        'nationality' => $data['nationality'] ?? 'Indian',
        'caste' => $data['caste'] ?? null,
        'profile_image' => $data['profile_image'] ?? null,
        'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null
    ]);
    
    $studentId = $pdo->lastInsertId();
    
    // Retrieve year range to calculate fee due dates dynamically
    $ayStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE id = :id");
    $ayStmt->execute(['id' => $ay_id]);
    $ayInfo = $ayStmt->fetch();
    $startYear = (int)date('Y');
    if ($ayInfo) {
        $rangeParts = explode('-', $ayInfo['year_range']);
        $startYear = (int)$rangeParts[0] ?: $startYear;
    }
    
    // Retrieve class-wise tuition fee structure
    $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $cfStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $class_id
    ]);
    $cfRes = $cfStmt->fetch();
    $feeStructure = [];
    if ($cfRes) {
        $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
    }
    
    // Seed initial fee registry for this student for the academic year (April to March)
    $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    $feeStmt = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date) VALUES (:school_id, :student_id, :ay_id, :month, :amount, 'Pending', :due_date)");
    foreach ($months as $idx => $m) {
        $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
        $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
        $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
        $amount = isset($feeStructure[$m]) ? (float)$feeStructure[$m] : 0.00;
        $feeStmt->execute([
            'school_id' => $auth['school_id'],
            'student_id' => $studentId,
            'ay_id' => $ay_id,
            'month' => $m,
            'amount' => $amount,
            'due_date' => $dueDate
        ]);
    }
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Admit Student', "Admitted student $name and pre-filled invoice ledger.");
    
    return jsonResponse($response, ['message' => 'Student admitted successfully']);
});

$app->put('/api/students/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $data = getJsonData($request);
    
    $name = trim($data['name'] ?? '');
    $roll = trim($data['roll_number'] ?? '');
    $class_id = (int)($data['class_id'] ?? 0);
    
    if (empty($name) || empty($roll) || !$class_id) {
        return jsonResponse($response, ['detail' => 'Name, Roll, and Class are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Check if student belongs to this school
    $chkStudent = $pdo->prepare("SELECT * FROM students WHERE id = :id AND school_id = :school_id");
    $chkStudent->execute(['id' => $studentId, 'school_id' => $auth['school_id']]);
    $student = $chkStudent->fetch();
    if (!$student) {
        return jsonResponse($response, ['detail' => 'Student not found'], 404);
    }
    
    // Validate class ownership
    $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
    $classChk->execute(['class_id' => $class_id, 'school_id' => $auth['school_id']]);
    if ($classChk->fetchColumn() == 0) {
        return jsonResponse($response, ['detail' => 'The specified Class ID does not belong to your school.'], 403);
    }
    
    // Check duplicate roll number
    $chk = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND roll_number = :roll AND academic_year_id = :ay_id AND id != :id");
    $chk->execute(['school_id' => $auth['school_id'], 'roll' => $roll, 'ay_id' => $student['academic_year_id'], 'id' => $studentId]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Duplicate Roll Number detected in this session!'], 400);
    }
    
    $exit_date = isset($data['exit_date']) && trim($data['exit_date']) !== '' ? trim($data['exit_date']) : null;
    $status = ($exit_date !== null) ? 'Inactive' : 'Active';

    $stmt = $pdo->prepare("
        UPDATE students 
        SET class_id = :class_id, group_name = :group_name, gender = :gender, name = :name, roll_number = :roll, sr_no = :sr_no, 
            phone = :phone, email = :email, country = :country, state = :state, city = :city,
            father_name = :father, mother_name = :mother, address = :address, 
            date_of_birth = :dob, admission_date = :adm_date, exit_date = :exit_date, status = :status, emergency_contact = :emergency, 
            blood_group = :blood, aadhaar_number = :aadhaar, nationality = :nationality, caste = :caste, profile_image = :profile_image,
            documents = :documents
        WHERE id = :id AND school_id = :school_id
    ");
    
    $stmt->execute([
        'class_id' => $class_id,
        'group_name' => isset($data['group_name']) ? (trim($data['group_name']) ?: null) : null,
        'gender' => $data['gender'] ?? 'Male',
        'name' => $name,
        'roll' => $roll,
        'sr_no' => $data['sr_no'] ?? null,
        'phone' => $data['phone'] ?? '',
        'email' => $data['email'] ?? '',
        'country' => $data['country'] ?? null,
        'state' => $data['state'] ?? null,
        'city' => $data['city'] ?? null,
        'father' => $data['father_name'] ?? '',
        'mother' => $data['mother_name'] ?? '',
        'address' => $data['address'] ?? '',
        'dob' => $data['date_of_birth'] ?? null,
        'adm_date' => $data['admission_date'] ?? date('Y-m-d'),
        'exit_date' => $exit_date,
        'status' => $status,
        'emergency' => $data['emergency_contact'] ?? '',
        'blood' => $data['blood_group'] ?? 'O+',
        'aadhaar' => $data['aadhaar_number'] ?? '',
        'nationality' => $data['nationality'] ?? 'Indian',
        'caste' => $data['caste'] ?? null,
        'profile_image' => $data['profile_image'] ?? null,
        'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null,
        'id' => $studentId,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Update Student', "Updated student profile $name (ID $studentId).");
    
    return jsonResponse($response, ['message' => 'Student profile updated successfully']);
});

$app->delete('/api/students/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = $args['id'];
    $pdo = getDb();
    
    // Check if student is locked due to paid fees inside a finalized financial report
    if (isStudentLocked($pdo, $auth['school_id'], $id)) {
        return jsonResponse($response, ['detail' => 'This student has payments inside a finalized Financial Report and cannot be deleted.'], 400);
    }
    
    $stmt = $pdo->prepare("DELETE FROM students WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Remove Student', "Deleted student profile ID $id.");
    
    return jsonResponse($response, ['message' => 'Student removed']);
});

// Salaries Breakdown by Month
$app->get('/api/salaries/month/{month}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $month = $args['month'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Get all active teachers
    $tStmt = $pdo->prepare("SELECT id, name, gender, phone, salary_amount, profile_image FROM teachers WHERE school_id = :sid AND status = 'Active'");
    $tStmt->execute(['sid' => $auth['school_id']]);
    $teachers = $tStmt->fetchAll();
    
    // For each teacher, ensure a salary record exists for this month/year
    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM salary_records WHERE school_id = :sid AND teacher_id = :tid AND academic_year_id = :ayid AND month = :month");
    $insStmt = $pdo->prepare("INSERT INTO salary_records (school_id, teacher_id, academic_year_id, month, amount, status) VALUES (:sid, :tid, :ayid, :month, :amount, 'Pending')");
    
    foreach ($teachers as $t) {
        $checkStmt->execute([
            'sid' => $auth['school_id'],
            'tid' => $t['id'],
            'ayid' => $ay_id,
            'month' => $month
        ]);
        if ($checkStmt->fetchColumn() == 0) {
            $insStmt->execute([
                'sid' => $auth['school_id'],
                'tid' => $t['id'],
                'ayid' => $ay_id,
                'month' => $month,
                'amount' => $t['salary_amount']
            ]);
        }
    }
    
    // Fetch final joined list
    $stmt = $pdo->prepare("
        SELECT 
            t.id as teacher_id,
            t.name,
            t.gender,
            t.phone,
            t.profile_image,
            sr.amount,
            sr.status
        FROM salary_records sr
        JOIN teachers t ON sr.teacher_id = t.id
        WHERE sr.school_id = :sid
          AND sr.academic_year_id = :ayid
          AND sr.month = :month
          AND t.status = 'Active'
    ");
    $stmt->execute([
        'sid' => $auth['school_id'],
        'ayid' => $ay_id,
        'month' => $month
    ]);
    
    return jsonResponse($response, $stmt->fetchAll());
});

// Teacher Salaries Ledger
$app->get('/api/teachers/{id}/salary', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $teacherId = $args['id'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Check if salaries populated for this year
    $stmt = $pdo->prepare("SELECT * FROM salary_records WHERE teacher_id = :teacher_id AND academic_year_id = :ay_id AND school_id = :school_id");
    $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ay_id, 'school_id' => $auth['school_id']]);
    $records = $stmt->fetchAll();
    
    if (empty($records)) {
        // Populate records automatically
        $tStmt = $pdo->prepare("SELECT salary_amount FROM teachers WHERE id = :id AND school_id = :school_id");
        $tStmt->execute(['id' => $teacherId, 'school_id' => $auth['school_id']]);
        $salary = (float)$tStmt->fetchColumn() ?: 3000.0;
        
        $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $ins = $pdo->prepare("INSERT INTO salary_records (school_id, teacher_id, academic_year_id, month, amount, status) VALUES (:school_id, :teacher_id, :ay_id, :month, :amount, 'Pending')");
        foreach ($months as $m) {
            $ins->execute([
                'school_id' => $auth['school_id'],
                'teacher_id' => $teacherId,
                'ay_id' => $ay_id,
                'month' => $m,
                'amount' => $salary
            ]);
        }
        
        $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ay_id, 'school_id' => $auth['school_id']]);
        $records = $stmt->fetchAll();
    }
    
    return jsonResponse($response, $records);
});

// Pay Salary
$app->post('/api/teachers/{id}/salary/{month}/pay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $teacherId = $args['id'];
    $month = $args['month'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Check if the salary payment is locked due to finalized financial report
    $checkStmt = $pdo->prepare("SELECT status, paid_at FROM salary_records WHERE teacher_id = :teacher_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $checkStmt->execute([
        'teacher_id' => $teacherId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    $existing = $checkStmt->fetch();
    if ($existing && $existing['status'] === 'Paid' && isTransactionLocked($pdo, $auth['school_id'], $existing['paid_at'])) {
        return jsonResponse($response, ['detail' => 'This salary payment is part of a finalized Financial Report and cannot be modified.'], 400);
    }
    
    $stmt = $pdo->prepare("UPDATE salary_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE teacher_id = :teacher_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $stmt->execute([
        'pay_date' => date('Y-m-d'),
        'paid_at' => date('Y-m-d H:i:s'),
        'teacher_id' => $teacherId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Pay Salary', "Disbursed $month salary for teacher ID $teacherId.");
    
    return jsonResponse($response, ['success' => true]);
});

// Student Fees Ledger
$app->get('/api/students/{id}/fees', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = $args['id'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Get student's class_id
    $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
    $studStmt->execute(['id' => $studentId, 'school_id' => $auth['school_id']]);
    $student = $studStmt->fetch();
    $classId = $student ? $student['class_id'] : 0;
    
    // Check if class fee structure is configured
    $isConfigured = false;
    if ($classId) {
        $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $auth['school_id'],
            'ay_id' => $ay_id,
            'class_id' => $classId
        ]);
        $isConfigured = ($cfStmt->fetchColumn() > 0);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
    $stmt->execute(['student_id' => $studentId, 'ay_id' => $ay_id, 'school_id' => $auth['school_id']]);
    $records = $stmt->fetchAll();
    
    if (empty($records)) {
        $ayStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE id = :id");
        $ayStmt->execute(['id' => $ay_id]);
        $ayInfo = $ayStmt->fetch();
        $startYear = (int)date('Y');
        if ($ayInfo) {
            $rangeParts = explode('-', $ayInfo['year_range']);
            $startYear = (int)$rangeParts[0] ?: $startYear;
        }
        
        $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $auth['school_id'],
            'ay_id' => $ay_id,
            'class_id' => $classId
        ]);
        $cfRes = $cfStmt->fetch();
        $feeStructure = [];
        if ($cfRes) {
            $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
        }
        
        $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $records = [];
        foreach ($months as $idx => $m) {
            $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
            $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
            $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
            $amount = isset($feeStructure[$m]) ? (float)$feeStructure[$m] : 0.00;
            $records[] = [
                'id' => null,
                'school_id' => (int)$auth['school_id'],
                'student_id' => (int)$studentId,
                'academic_year_id' => (int)$ay_id,
                'month' => $m,
                'amount' => $amount,
                'status' => 'Pending',
                'due_date' => $dueDate,
                'payment_date' => null,
                'paid_at' => null
            ];
        }
    }
    
    if (!$isConfigured) {
        foreach ($records as &$rec) {
            if ($rec['status'] === 'Pending') {
                $rec['amount'] = 0.00;
            }
        }
    }
    
    return jsonResponse($response, $records);
});

// Pay Tuition Fee
$app->post('/api/students/{id}/fees/{month}/pay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = $args['id'];
    $month = $args['month'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Get student's class_id and verify existence
    $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
    $studStmt->execute(['id' => $studentId, 'school_id' => $auth['school_id']]);
    $student = $studStmt->fetch();
    if (!$student) {
        return jsonResponse($response, ['detail' => 'Student not found.'], 404);
    }
    $classId = $student['class_id'];

    // Verify if class fee is configured
    $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $cfStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $classId
    ]);
    if ((int)$cfStmt->fetchColumn() === 0) {
        return jsonResponse($response, ['detail' => 'Class fee structure not configured.'], 400);
    }
    
    // Check if the fee payment is already Paid and locked in a finalized report
    $checkStmt = $pdo->prepare("SELECT status, paid_at FROM fee_records WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $checkStmt->execute([
        'student_id' => $studentId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    $existing = $checkStmt->fetch();
    if ($existing && $existing['status'] === 'Paid' && isTransactionLocked($pdo, $auth['school_id'], $existing['paid_at'])) {
        return jsonResponse($response, ['detail' => 'This fee payment is part of a finalized Financial Report and cannot be modified.'], 400);
    }
    
    // Validate chronological order of payments (April to March)
    $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    $targetIdx = array_search($month, $monthsOrder);
    if ($targetIdx !== false && $targetIdx > 0) {
        $priorMonths = array_slice($monthsOrder, 0, $targetIdx);
        $placeholders = implode(',', array_fill(0, count($priorMonths), '?'));
        
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records 
                                    WHERE student_id = ? 
                                      AND academic_year_id = ? 
                                      AND school_id = ? 
                                      AND month IN ($placeholders) 
                                      AND status != 'Paid'");
        
        $queryParams = array_merge([$studentId, $ay_id, $auth['school_id']], $priorMonths);
        $checkStmt->execute($queryParams);
        
        if ((int)$checkStmt->fetchColumn() > 0) {
            return jsonResponse($response, ['detail' => 'Please clear previous pending dues first.'], 400);
        }
    }
    
    $stmt = $pdo->prepare("UPDATE fee_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $stmt->execute([
        'pay_date' => date('Y-m-d'),
        'paid_at' => date('Y-m-d H:i:s'),
        'student_id' => $studentId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Collect Fee', "Received tuition fee for $month from student ID $studentId.");
    
    return jsonResponse($response, ['success' => true]);
});

// Pay Multiple Tuition Fees
$app->post('/api/students/{id}/fees/pay-multiple', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = $args['id'];
    $data = getJsonData($request);
    $months = $data['months'] ?? [];
    $ay_id = $data['academic_year_id'] ?? 0;
    
    if (empty($months)) {
        return jsonResponse($response, ['detail' => 'No months selected.'], 400);
    }
    
    $pdo = getDb();
    
    // Get student's class_id and verify existence
    $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
    $studStmt->execute(['id' => $studentId, 'school_id' => $auth['school_id']]);
    $student = $studStmt->fetch();
    if (!$student) {
        return jsonResponse($response, ['detail' => 'Student not found.'], 404);
    }
    $classId = $student['class_id'];

    // Verify if class fee is configured
    $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
    $cfStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'class_id' => $classId
    ]);
    if ((int)$cfStmt->fetchColumn() === 0) {
        return jsonResponse($response, ['detail' => 'Class fee structure not configured.'], 400);
    }
    
    // Ensure all fee records for the year exist for this student. If not, seed them first.
    $checkDbStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id");
    $checkDbStmt->execute([
        'student_id' => $studentId,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    $existsCount = (int)$checkDbStmt->fetchColumn();
    if ($existsCount === 0) {
        $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
        $studStmt->execute(['id' => $studentId, 'school_id' => $auth['school_id']]);
        $student = $studStmt->fetch();
        $classId = $student ? $student['class_id'] : 0;
        
        $ayStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE id = :id");
        $ayStmt->execute(['id' => $ay_id]);
        $ayInfo = $ayStmt->fetch();
        $startYear = (int)date('Y');
        if ($ayInfo) {
            $rangeParts = explode('-', $ayInfo['year_range']);
            $startYear = (int)$rangeParts[0] ?: $startYear;
        }
        
        $feeStructure = [];
        if ($classId) {
            $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
            $cfStmt->execute([
                'school_id' => $auth['school_id'],
                'ay_id' => $ay_id,
                'class_id' => $classId
            ]);
            $cfRes = $cfStmt->fetch();
            if ($cfRes) {
                $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
            }
        }
        
        $monthsList = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $insStmt = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date) VALUES (:school_id, :student_id, :ay_id, :month, :amount, 'Pending', :due_date)");
        foreach ($monthsList as $idx => $m) {
            $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
            $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
            $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
            $amount = isset($feeStructure[$m]) ? (float)$feeStructure[$m] : 0.00;
            $insStmt->execute([
                'school_id' => $auth['school_id'],
                'student_id' => $studentId,
                'ay_id' => $ay_id,
                'month' => $m,
                'amount' => $amount,
                'due_date' => $dueDate
            ]);
        }
    }
    
    // Fetch all fee records
    $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
    $stmt->execute(['student_id' => $studentId, 'ay_id' => $ay_id, 'school_id' => $auth['school_id']]);
    $records = $stmt->fetchAll();
    
    $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    usort($months, function($a, $b) use ($monthsOrder) {
        return array_search($a, $monthsOrder) - array_search($b, $monthsOrder);
    });
    
    foreach ($months as $m) {
        if (!in_array($m, $monthsOrder)) {
            return jsonResponse($response, ['detail' => "Invalid month: $m"], 400);
        }
    }
    
    $selectedIndices = [];
    foreach ($months as $m) {
        $selectedIndices[] = array_search($m, $monthsOrder);
    }
    for ($i = 1; $i < count($selectedIndices); $i++) {
        if ($selectedIndices[$i] !== $selectedIndices[$i - 1] + 1) {
            return jsonResponse($response, ['detail' => 'Fee payments must be for consecutive months.'], 400);
        }
    }
    
    $firstUnpaidMonth = null;
    foreach ($monthsOrder as $m) {
        $rec = null;
        foreach ($records as $r) {
            if ($r['month'] === $m) {
                $rec = $r;
                break;
            }
        }
        if ($rec && $rec['status'] !== 'Paid') {
            $firstUnpaidMonth = $m;
            break;
        }
    }
    
    if ($firstUnpaidMonth === null) {
        return jsonResponse($response, ['detail' => 'All months are already paid.'], 400);
    }
    
    if ($months[0] !== $firstUnpaidMonth) {
        return jsonResponse($response, ['detail' => "Fee payment must remain sequential. You must start from the earliest unpaid month ($firstUnpaidMonth)."], 400);
    }
    
    foreach ($months as $m) {
        foreach ($records as $r) {
            if ($r['month'] === $m) {
                if ($r['status'] === 'Paid') {
                    return jsonResponse($response, ['detail' => "Month $m is already paid."], 400);
                }
                if (isTransactionLocked($pdo, $auth['school_id'], $r['paid_at'])) {
                    return jsonResponse($response, ['detail' => "Month $m is locked in a finalized report."], 400);
                }
            }
        }
    }
    
    try {
        $pdo->beginTransaction();
        
        $payDate = date('Y-m-d');
        $paidAt = date('Y-m-d H:i:s');
        
        $updateStmt = $pdo->prepare("UPDATE fee_records SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
        
        foreach ($months as $m) {
            $updateStmt->execute([
                'pay_date' => $payDate,
                'paid_at' => $paidAt,
                'student_id' => $studentId,
                'month' => $m,
                'ay_id' => $ay_id,
                'school_id' => $auth['school_id']
            ]);
        }
        
        $pdo->commit();
        
        $monthsStr = implode(', ', $months);
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Collect Fee', "Received tuition fee for $monthsStr from student ID $studentId in a single transaction.");
        
        // Fetch the updated records to return
        $placeholders = implode(',', array_fill(0, count($months), '?'));
        $queryParams = array_merge([$studentId, $ay_id, $auth['school_id']], $months);
        $fetchStmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = ? AND academic_year_id = ? AND school_id = ? AND month IN ($placeholders)");
        $fetchStmt->execute($queryParams);
        $updatedRecords = $fetchStmt->fetchAll();
        
        return jsonResponse($response, [
            'success' => true,
            'records' => $updatedRecords
        ]);
        
    } catch (\Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return jsonResponse($response, ['detail' => 'Database error: ' . $e->getMessage()], 500);
    }
});

// Revert Tuition Fee status to Unpaid
$app->post('/api/students/{id}/fees/{month}/unpay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = $args['id'];
    $month = $args['month'];
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    
    // Check if the fee payment is locked in a finalized report
    $checkStmt = $pdo->prepare("SELECT paid_at FROM fee_records WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $checkStmt->execute([
        'student_id' => $studentId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    $paidAt = $checkStmt->fetchColumn();
    if ($paidAt && isTransactionLocked($pdo, $auth['school_id'], $paidAt)) {
        return jsonResponse($response, ['detail' => 'This fee payment is part of a finalized Financial Report and cannot be reverted.'], 400);
    }
    
    // Validate chronological order of reversion (subsequent months must not be Paid)
    $monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    $targetIdx = array_search($month, $monthsOrder);
    if ($targetIdx !== false && $targetIdx < count($monthsOrder) - 1) {
        $subsequentMonths = array_slice($monthsOrder, $targetIdx + 1);
        $placeholders = implode(',', array_fill(0, count($subsequentMonths), '?'));
        
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM fee_records 
                                    WHERE student_id = ? 
                                      AND academic_year_id = ? 
                                      AND school_id = ? 
                                      AND month IN ($placeholders) 
                                      AND status = 'Paid'");
        
        $queryParams = array_merge([$studentId, $ay_id, $auth['school_id']], $subsequentMonths);
        $checkStmt->execute($queryParams);
        
        if ((int)$checkStmt->fetchColumn() > 0) {
            return jsonResponse($response, ['detail' => 'Cannot mark this month as unpaid because subsequent months have already been paid.'], 400);
        }
    }
    
    $stmt = $pdo->prepare("UPDATE fee_records SET status = 'Pending', payment_date = NULL, paid_at = NULL WHERE student_id = :student_id AND month = :month AND academic_year_id = :ay_id AND school_id = :school_id");
    $stmt->execute([
        'student_id' => $studentId,
        'month' => $month,
        'ay_id' => $ay_id,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Revert Fee', "Reverted tuition fee status for $month to Unpaid for student ID $studentId.");
    
    return jsonResponse($response, ['success' => true]);
});

// Carry Forward Dues - Get for student
$app->get('/api/students/{id}/carry-forward-dues', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $pdo = getDb();
    
    $stmt = $pdo->prepare("SELECT cfd.*, ay.year_range 
                           FROM carry_forward_dues cfd
                           JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                           WHERE cfd.student_id = :student_id AND cfd.school_id = :school_id
                           ORDER BY ay.year_range ASC");
    $stmt->execute(['student_id' => $studentId, 'school_id' => $auth['school_id']]);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($records as &$r) {
        $r['id'] = (int)$r['id'];
        $r['student_id'] = (int)$r['student_id'];
        $r['amount'] = (float)$r['amount'];
        $r['paid_amount'] = (float)$r['paid_amount'];
        
        $r['is_locked'] = false;
        $recStmt = $pdo->prepare("SELECT paid_at FROM previous_year_recoveries WHERE carry_forward_due_id = :cfd_id");
        $recStmt->execute(['cfd_id' => $r['id']]);
        $recoveries = $recStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($recoveries as $rec) {
            if (isTransactionLocked($pdo, $auth['school_id'], $rec['paid_at'])) {
                $r['is_locked'] = true;
                break;
            }
        }
    }
    unset($r);
    
    return jsonResponse($response, $records);
});

// Carry Forward Dues - Pay/Recover
$app->post('/api/students/{id}/carry-forward-dues/{due_id}/pay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $dueId = (int)$args['due_id'];
    $data = getJsonData($request);
    $amount = isset($data['amount']) ? (float)$data['amount'] : 0.00;
    $payDate = $data['date'] ?? date('Y-m-d');
    
    if ($amount <= 0.00) {
        return jsonResponse($response, ['detail' => 'Payment amount must be greater than zero.'], 400);
    }
    
    $pdo = getDb();
    
    $stmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE id = :id AND student_id = :student_id AND school_id = :school_id");
    $stmt->execute(['id' => $dueId, 'student_id' => $studentId, 'school_id' => $auth['school_id']]);
    $cfd = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$cfd) {
        return jsonResponse($response, ['detail' => 'Carry forward due record not found.'], 404);
    }
    
    $pending = (float)$cfd['amount'] - (float)$cfd['paid_amount'];
    if ($amount > $pending + 0.01) {
        return jsonResponse($response, ['detail' => 'Payment amount exceeds the outstanding due amount.'], 400);
    }
    
    $pdo->beginTransaction();
    try {
        $newPaidAmount = (float)$cfd['paid_amount'] + $amount;
        $status = ($newPaidAmount >= (float)$cfd['amount']) ? 'Paid' : 'Pending';
        
        $up = $pdo->prepare("UPDATE carry_forward_dues SET paid_amount = :paid_amount, status = :status WHERE id = :id");
        $up->execute([
            'paid_amount' => $newPaidAmount,
            'status' => $status,
            'id' => $dueId
        ]);
        
        // Fetch active academic year
        $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
        $ayStmt->execute(['school_id' => $auth['school_id']]);
        $active_ay_id = $ayStmt->fetchColumn() ?: null;
        
        $ins = $pdo->prepare("INSERT INTO previous_year_recoveries (school_id, student_id, academic_year_id, carry_forward_due_id, amount_recovered, recovery_date, paid_at, collected_by) VALUES (:school_id, :student_id, :academic_year_id, :carry_forward_due_id, :amount_recovered, :recovery_date, :paid_at, :collected_by)");
        $ins->execute([
            'school_id' => $auth['school_id'],
            'student_id' => $studentId,
            'academic_year_id' => $active_ay_id,
            'carry_forward_due_id' => $dueId,
            'amount_recovered' => $amount,
            'recovery_date' => $payDate,
            'paid_at' => date('Y-m-d H:i:s'),
            'collected_by' => $auth['email']
        ]);
        
        $pdo->commit();
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Recover Past Due', "Recovered past year due payment of ₹" . number_format($amount) . " for student ID $studentId.");
        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Database operation failed: ' . $e->getMessage()], 500);
    }
});

// Carry Forward Dues - Revert Recovery
$app->post('/api/students/{id}/carry-forward-dues/recoveries/{recovery_id}/unpay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $recoveryId = (int)$args['recovery_id'];
    
    $pdo = getDb();
    
    $stmt = $pdo->prepare("SELECT * FROM previous_year_recoveries WHERE id = :id AND student_id = :student_id AND school_id = :school_id");
    $stmt->execute(['id' => $recoveryId, 'student_id' => $studentId, 'school_id' => $auth['school_id']]);
    $recovery = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$recovery) {
        return jsonResponse($response, ['detail' => 'Recovery record not found.'], 404);
    }
    
    if (isTransactionLocked($pdo, $auth['school_id'], $recovery['paid_at'])) {
        return jsonResponse($response, ['detail' => 'This recovery is part of a finalized Financial Report and cannot be reverted.'], 400);
    }
    
    $pdo->beginTransaction();
    try {
        $cfdStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE id = :id");
        $cfdStmt->execute(['id' => $recovery['carry_forward_due_id']]);
        $cfd = $cfdStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($cfd) {
            $newPaidAmount = max(0.00, (float)$cfd['paid_amount'] - (float)$recovery['amount_recovered']);
            $status = ($newPaidAmount >= (float)$cfd['amount']) ? 'Paid' : 'Pending';
            
            $up = $pdo->prepare("UPDATE carry_forward_dues SET paid_amount = :paid_amount, status = :status WHERE id = :id");
            $up->execute([
                'paid_amount' => $newPaidAmount,
                'status' => $status,
                'id' => $recovery['carry_forward_due_id']
            ]);
        }
        
        $del = $pdo->prepare("DELETE FROM previous_year_recoveries WHERE id = :id");
        $del->execute(['id' => $recoveryId]);
        
        $pdo->commit();
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Revert Recovery', "Reverted past year due recovery (₹" . number_format($recovery['amount_recovered']) . ") for student ID $studentId.");
        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Database operation failed: ' . $e->getMessage()], 500);
    }
});

// Previous year outstanding dues for finance
$app->get('/api/finance/previous-dues', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $active_year_id = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : 0;
    
    $pdo = getDb();
    
    if ($active_year_id > 0) {
        $stmt = $pdo->prepare("SELECT cfd.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
                               FROM carry_forward_dues cfd
                               JOIN students s ON cfd.student_id = s.id
                               JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                               LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                        AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                        AND s_orig.name = s.name 
                                                        AND s_orig.roll_number = s.roll_number
                               LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                               WHERE cfd.school_id = :school_id AND cfd.original_academic_year_id < :active_year_id
                               ORDER BY cfd.id DESC");
        $stmt->execute(['school_id' => $auth['school_id'], 'active_year_id' => $active_year_id]);
    } else {
        $stmt = $pdo->prepare("SELECT cfd.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
                               FROM carry_forward_dues cfd
                               JOIN students s ON cfd.student_id = s.id
                               JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                               LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                        AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                        AND s_orig.name = s.name 
                                                        AND s_orig.roll_number = s.roll_number
                               LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                               WHERE cfd.school_id = :school_id
                               ORDER BY cfd.id DESC");
        $stmt->execute(['school_id' => $auth['school_id']]);
    }
    $dues = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($dues as &$d) {
        $d['id'] = (int)$d['id'];
        $d['student_id'] = (int)$d['student_id'];
        $d['amount'] = (float)$d['amount'];
        $d['paid_amount'] = (float)$d['paid_amount'];
    }
    unset($d);
    
    return jsonResponse($response, $dues);
});

// Previous year recoveries log history for finance
$app->get('/api/finance/previous-dues-recoveries', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $active_year_id = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : 0;
    
    $pdo = getDb();
    
    if ($active_year_id > 0) {
        $stmt = $pdo->prepare("SELECT pyr.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
                               FROM previous_year_recoveries pyr
                               JOIN students s ON pyr.student_id = s.id
                               JOIN carry_forward_dues cfd ON pyr.carry_forward_due_id = cfd.id
                               JOIN academic_years ay ON cfd.original_academic_year_id = ay.id
                               LEFT JOIN students s_orig ON s_orig.school_id = s.school_id 
                                                        AND s_orig.academic_year_id = cfd.original_academic_year_id
                                                        AND s_orig.name = s.name 
                                                        AND s_orig.roll_number = s.roll_number
                               LEFT JOIN classrooms c_orig ON c_orig.id = COALESCE(s_orig.class_id, s.class_id)
                               WHERE pyr.school_id = :school_id AND pyr.academic_year_id = :active_year_id
                               ORDER BY pyr.id DESC");
        $stmt->execute([
            'school_id' => $auth['school_id'],
            'active_year_id' => $active_year_id
        ]);
    } else {
        $stmt = $pdo->prepare("SELECT pyr.*, s.name AS student_name, c_orig.name AS class_name, ay.year_range AS original_academic_year, s.status AS student_status
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
                               ORDER BY pyr.id DESC");
        $stmt->execute(['school_id' => $auth['school_id']]);
    }
    
    $recoveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($recoveries as &$rec) {
        $rec['id'] = (int)$rec['id'];
        $rec['student_id'] = (int)$rec['student_id'];
        $rec['carry_forward_due_id'] = (int)$rec['carry_forward_due_id'];
        $rec['amount_recovered'] = (float)$rec['amount_recovered'];
        $rec['is_locked'] = isTransactionLocked($pdo, $auth['school_id'], $rec['paid_at']);
    }
    unset($rec);
    
    return jsonResponse($response, $recoveries);
});

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
        $ins = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read) VALUES (:sid, 'Welcome to ERP Portal', 'Complete school setup configuration to access rosters and ledgers.', 'System', NOW(), 0)");
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

// --- Parent Portal Endpoints ---
$app->get('/api/parent/students', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :uid");
    $stmt->execute(['uid' => $auth['id']]);
    $studentIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($studentIds)) {
        return jsonResponse($response, []);
    }
    
    $placeholders = implode(',', array_fill(0, count($studentIds), '?'));
    $stmt = $pdo->prepare("SELECT s.*, c.name as class_name FROM students s 
                           JOIN classrooms c ON s.class_id = c.id
                           WHERE s.id IN ($placeholders)");
    $stmt->execute($studentIds);
    return jsonResponse($response, $stmt->fetchAll());
});

$app->get('/api/parent/student/{id}/dashboard', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $pdo = getDb();
    
    // Check permission
    $chk = $pdo->prepare("SELECT COUNT(*) FROM parent_student_mappings WHERE parent_user_id = :uid AND student_id = :sid");
    $chk->execute(['uid' => $auth['id'], 'sid' => $studentId]);
    if ($chk->fetchColumn() == 0) {
        return jsonResponse($response, ['detail' => 'Access Denied'], 403);
    }
    
    // Student Info
    $studStmt = $pdo->prepare("SELECT s.*, c.name as class_name FROM students s 
                               JOIN classrooms c ON s.class_id = c.id 
                               WHERE s.id = :sid");
    $studStmt->execute(['sid' => $studentId]);
    $student = $studStmt->fetch();
    
    // Attendance Stats
    $attStmt = $pdo->prepare("SELECT 
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
        COUNT(*) as total_days
        FROM student_attendance WHERE student_id = :sid");
    $attStmt->execute(['sid' => $studentId]);
    $attendanceStats = $attStmt->fetch();
    
    // Recent 10 Attendance records
    $recentAttStmt = $pdo->prepare("SELECT attendance_date, status FROM student_attendance WHERE student_id = :sid ORDER BY attendance_date DESC LIMIT 10");
    $recentAttStmt->execute(['sid' => $studentId]);
    $recentAttendance = $recentAttStmt->fetchAll();
    
    // Fees
    $feeStmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :sid ORDER BY due_date ASC");
    $feeStmt->execute(['sid' => $studentId]);
    $fees = $feeStmt->fetchAll();
    
    // Extra Fees
    $extraStmt = $pdo->prepare("SELECT sef.*, eft.name as title, eft.amount 
                                FROM student_extra_fees sef 
                                JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id 
                                WHERE sef.student_id = :sid");
    $extraStmt->execute(['sid' => $studentId]);
    $extraFees = $extraStmt->fetchAll();
    
    // Class Fee Structure (Scheme)
    $cfgStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND class_id = :class_id");
    $cfgStmt->execute(['school_id' => $auth['school_id'], 'class_id' => $student['class_id']]);
    $cfgRow = $cfgStmt->fetch();
    $classFeeStructure = $cfgRow ? json_decode($cfgRow['fee_structure'], true) : null;
    
    // Carry forward
    $cfStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE student_id = :sid");
    $cfStmt->execute(['sid' => $studentId]);
    $carryForward = $cfStmt->fetchAll();
    
    // Exam Marks
    $marksStmt = $pdo->prepare("SELECT m.*, e.name as exam_name, s.max_marks 
        FROM exam_marks m 
        JOIN exams e ON m.id = m.exam_id OR (m.exam_id = e.id)
        LEFT JOIN exam_subjects s ON e.id = s.exam_id AND m.subject_name = s.subject_name
        WHERE m.student_id = :sid");
    $marksStmt->execute(['sid' => $studentId]);
    $examMarks = $marksStmt->fetchAll();
    
    return jsonResponse($response, [
        'student' => $student,
        'attendance_stats' => $attendanceStats,
        'recent_attendance' => $recentAttendance,
        'fees' => $fees,
        'extra_fees' => $extraFees,
        'class_fee_structure' => $classFeeStructure,
        'carry_forward' => $carryForward,
        'exam_marks' => $examMarks
    ]);
});

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
$app->get('/api/financial-reports', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY id DESC");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ay_id]);
    $reports = $stmt->fetchAll();
    
    // Format numeric values and displayed Report ID
    foreach ($reports as &$r) {
        $r['id'] = (int)$r['id'];
        $r['fees_collected'] = (float)$r['fees_collected'];
        $r['extra_fees_collected'] = (float)$r['extra_fees_collected'];
        $r['previous_year_recovery'] = (float)($r['previous_year_recovery'] ?? 0.00);
        $r['previous_year_recoveries'] = $r['previous_year_recovery'];
        $r['salaries_paid'] = (float)$r['salaries_paid'];
        $r['school_expenses'] = (float)$r['school_expenses'];
        $r['net_profit'] = (float)$r['net_profit'];
        $r['report_id'] = sprintf('REP-%03d', $r['id']);
    }
    unset($r);

    
    return jsonResponse($response, $reports);
});

// Ephemeral Preview Report (no database persistence)
$app->get('/api/financial-reports/preview', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $from_date = $params['from_date'] ?? '';
    $to_date = $params['to_date'] ?? '';
    $ay_id = $params['academic_year_id'] ?? 0;
    
    if (empty($from_date) || empty($to_date) || !$ay_id) {
        return jsonResponse($response, ['detail' => 'from_date, to_date, and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Find last report end timestamp for this school
    $lastStmt = $pdo->prepare("SELECT MAX(to_timestamp) FROM financial_reports WHERE school_id = :school_id");
    $lastStmt->execute(['school_id' => $auth['school_id']]);
    $last_report_end = $lastStmt->fetchColumn();
    
    $selected_from_timestamp = $from_date . ' 00:00:00';
    $selected_to_timestamp = $to_date . ' 23:59:59';
    $now = date('Y-m-d H:i:s');
    $end_timestamp = min($selected_to_timestamp, $now);
    
    $use_strict_greater = false;
    if ($last_report_end && $last_report_end > $selected_from_timestamp) {
        $start_timestamp = $last_report_end;
        $use_strict_greater = true;
    } else {
        $start_timestamp = $selected_from_timestamp;
        $use_strict_greater = false;
    }
    
    // Sum of paid tuition fees in timestamp range
    $feeSql = "SELECT SUM(amount) FROM fee_records 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id 
                 AND status = 'Paid'";
    $feeSql .= $use_strict_greater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
    $feeSql .= " AND paid_at <= :end_timestamp";
    $feeStmt = $pdo->prepare($feeSql);
    $feeStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $fees_collected = (float)$feeStmt->fetchColumn() ?: 0.00;
    
    // Sum of paid extra fees in timestamp range
    $extraSql = "SELECT SUM(eft.amount) FROM student_extra_fees sef
                 JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                 WHERE sef.school_id = :school_id 
                   AND sef.academic_year_id = :ay_id 
                   AND sef.status = 'Paid'";
    $extraSql .= $use_strict_greater ? " AND sef.paid_at > :start_timestamp" : " AND sef.paid_at >= :start_timestamp";
    $extraSql .= " AND sef.paid_at <= :end_timestamp";
    $extraStmt = $pdo->prepare($extraSql);
    $extraStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $extra_fees_collected = (float)$extraStmt->fetchColumn() ?: 0.00;
    
    // Sum of paid salaries in timestamp range
    $salSql = "SELECT SUM(amount) FROM salary_records 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id 
                 AND status = 'Paid'";
    $salSql .= $use_strict_greater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
    $salSql .= " AND paid_at <= :end_timestamp";
    $salStmt = $pdo->prepare($salSql);
    $salStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $salaries_paid = (float)$salStmt->fetchColumn() ?: 0.00;
    
    // Sum of school expenses in timestamp range
    $expSql = "SELECT SUM(amount) FROM school_expenses 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id";
    $expSql .= $use_strict_greater ? " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) > :start_timestamp" : " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) >= :start_timestamp";
    $expSql .= " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) <= :end_timestamp";
    $expStmt = $pdo->prepare($expSql);
    $expStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $school_expenses = (float)$expStmt->fetchColumn() ?: 0.00;
    
    // Sum of previous academic year recoveries in timestamp range
    $recoverySql = "SELECT SUM(pyr.amount_recovered) FROM previous_year_recoveries pyr
                    WHERE pyr.school_id = :school_id
                      AND pyr.academic_year_id = :ay_id";
    $recoverySql .= $use_strict_greater ? " AND pyr.paid_at > :start_timestamp" : " AND pyr.paid_at >= :start_timestamp";
    $recoverySql .= " AND pyr.paid_at <= :end_timestamp";
    $recoveryStmt = $pdo->prepare($recoverySql);
    $recoveryStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $previous_year_recovery = (float)$recoveryStmt->fetchColumn() ?: 0.00;
    
    $total_income = $fees_collected + $extra_fees_collected + $previous_year_recovery;
    $total_expenses = $salaries_paid + $school_expenses;
    $net_profit = $total_income - $total_expenses;
    
    return jsonResponse($response, [
        'fees_collected' => $fees_collected,
        'extra_fees_collected' => $extra_fees_collected,
        'previous_year_recovery' => $previous_year_recovery,
        'total_income' => $total_income,
        'salaries_paid' => $salaries_paid,
        'school_expenses' => $school_expenses,
        'total_expenses' => $total_expenses,
        'net_profit' => $net_profit
    ]);
});

// Generate and save report permanently
$app->post('/api/financial-reports', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $from_date = $data['from_date'] ?? '';
    $to_date = $data['to_date'] ?? '';
    $ay_id = $data['academic_year_id'] ?? 0;
    
    if (empty($from_date) || empty($to_date) || !$ay_id) {
        return jsonResponse($response, ['detail' => 'from_date, to_date, and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Find last report end timestamp for this school
    $lastStmt = $pdo->prepare("SELECT MAX(to_timestamp) FROM financial_reports WHERE school_id = :school_id");
    $lastStmt->execute(['school_id' => $auth['school_id']]);
    $last_report_end = $lastStmt->fetchColumn();
    
    $selected_from_timestamp = $from_date . ' 00:00:00';
    $selected_to_timestamp = $to_date . ' 23:59:59';
    $now = date('Y-m-d H:i:s');
    $end_timestamp = min($selected_to_timestamp, $now);
    
    $use_strict_greater = false;
    if ($last_report_end && $last_report_end > $selected_from_timestamp) {
        $start_timestamp = $last_report_end;
        $use_strict_greater = true;
    } else {
        $start_timestamp = $selected_from_timestamp;
        $use_strict_greater = false;
    }
    
    // Sum of paid tuition fees in timestamp range
    $feeSql = "SELECT SUM(amount) FROM fee_records 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id 
                 AND status = 'Paid'";
    $feeSql .= $use_strict_greater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
    $feeSql .= " AND paid_at <= :end_timestamp";
    $feeStmt = $pdo->prepare($feeSql);
    $feeStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $fees_collected = (float)$feeStmt->fetchColumn() ?: 0.00;
    
    // Sum of paid extra fees in timestamp range
    $extraSql = "SELECT SUM(eft.amount) FROM student_extra_fees sef
                 JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                 WHERE sef.school_id = :school_id 
                   AND sef.academic_year_id = :ay_id 
                   AND sef.status = 'Paid'";
    $extraSql .= $use_strict_greater ? " AND sef.paid_at > :start_timestamp" : " AND sef.paid_at >= :start_timestamp";
    $extraSql .= " AND sef.paid_at <= :end_timestamp";
    $extraStmt = $pdo->prepare($extraSql);
    $extraStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $extra_fees_collected = (float)$extraStmt->fetchColumn() ?: 0.00;
    
    // Sum of paid salaries in timestamp range
    $salSql = "SELECT SUM(amount) FROM salary_records 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id 
                 AND status = 'Paid'";
    $salSql .= $use_strict_greater ? " AND paid_at > :start_timestamp" : " AND paid_at >= :start_timestamp";
    $salSql .= " AND paid_at <= :end_timestamp";
    $salStmt = $pdo->prepare($salSql);
    $salStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $salaries_paid = (float)$salStmt->fetchColumn() ?: 0.00;
    
    // Sum of school expenses in timestamp range
    $expSql = "SELECT SUM(amount) FROM school_expenses 
               WHERE school_id = :school_id 
                 AND academic_year_id = :ay_id";
    $expSql .= $use_strict_greater ? " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) > :start_timestamp" : " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) >= :start_timestamp";
    $expSql .= " AND CAST(CONCAT(expense_date, ' ', expense_time) AS DATETIME) <= :end_timestamp";
    $expStmt = $pdo->prepare($expSql);
    $expStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $school_expenses = (float)$expStmt->fetchColumn() ?: 0.00;
    
    // Sum of previous academic year recoveries in timestamp range
    $recoverySql = "SELECT SUM(pyr.amount_recovered) FROM previous_year_recoveries pyr
                    WHERE pyr.school_id = :school_id
                      AND pyr.academic_year_id = :ay_id";
    $recoverySql .= $use_strict_greater ? " AND pyr.paid_at > :start_timestamp" : " AND pyr.paid_at >= :start_timestamp";
    $recoverySql .= " AND pyr.paid_at <= :end_timestamp";
    $recoveryStmt = $pdo->prepare($recoverySql);
    $recoveryStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'start_timestamp' => $start_timestamp,
        'end_timestamp' => $end_timestamp
    ]);
    $previous_year_recovery = (float)$recoveryStmt->fetchColumn() ?: 0.00;
    
    $total_income = $fees_collected + $extra_fees_collected + $previous_year_recovery;
    $total_expenses = $salaries_paid + $school_expenses;
    $net_profit = $total_income - $total_expenses;
    
    $ins = $pdo->prepare("INSERT INTO financial_reports (school_id, academic_year_id, `from_date`, `to_date`, from_timestamp, to_timestamp, fees_collected, extra_fees_collected, previous_year_recovery, salaries_paid, school_expenses, net_profit, settlement_status) 
                          VALUES (:school_id, :ay_id, :from_date, :to_date, :from_ts, :to_ts, :fees_collected, :extra_fees, :previous_year_recovery, :salaries, :expenses, :net_profit, 'Pending')");
    $ins->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'from_date' => $from_date,
        'to_date' => $to_date,
        'from_ts' => $start_timestamp,
        'to_ts' => $end_timestamp,
        'fees_collected' => $fees_collected,
        'extra_fees' => $extra_fees_collected,
        'previous_year_recovery' => $previous_year_recovery,
        'salaries' => $salaries_paid,
        'expenses' => $school_expenses,
        'net_profit' => $net_profit
    ]);
    
    $newId = (int)$pdo->lastInsertId();
    
    // Generate XLSX on-the-fly and send email
    $tempDir = __DIR__ . '/../scratch';
    if (!file_exists($tempDir)) {
        mkdir($tempDir, 0777, true);
    }
    $tempFile = $tempDir . '/Financial_Report_REP-' . sprintf('%03d', $newId) . '.xlsx';
    
    $emailSent = false;
    try {
        generateReportExcelFile($pdo, $auth['school_id'], $newId, $tempFile);
        $emailSent = sendReportEmail($auth['email'], $newId, $from_date, $to_date, $tempFile);
        @unlink($tempFile);
    } catch (\Exception $e) {
        if (file_exists($tempFile)) {
            @unlink($tempFile);
        }
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Failed generating/sending report generation email for report ID $newId: " . $e->getMessage() . "\n";
        file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
    }
    
    $report = [
        'id' => $newId,
        'report_id' => sprintf('REP-%03d', $newId),
        'school_id' => (int)$auth['school_id'],
        'academic_year_id' => $ay_id,
        'from_date' => $from_date,
        'to_date' => $to_date,
        'fees_collected' => $fees_collected,
        'extra_fees_collected' => $extra_fees_collected,
        'previous_year_recovery' => $previous_year_recovery,
        'total_income' => $total_income,
        'salaries_paid' => $salaries_paid,
        'school_expenses' => $school_expenses,
        'total_expenses' => $total_expenses,
        'net_profit' => $net_profit,
        'settlement_status' => 'Pending',
        'from_timestamp' => $start_timestamp,
        'to_timestamp' => $end_timestamp,
        'created_at' => date('c'),
        'email_sent' => $emailSent
    ];
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Generate Report', "Generated financial report REP-" . sprintf('%03d', $newId) . " for period $from_date to $to_date.");
    
    return jsonResponse($response, $report);
});

// Toggle settlement status
$app->post('/api/financial-reports/{id}/settle', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $reportId = (int)$args['id'];
    $pdo = getDb();
    
    $chk = $pdo->prepare("SELECT settlement_status FROM financial_reports WHERE id = :id AND school_id = :school_id");
    $chk->execute(['id' => $reportId, 'school_id' => $auth['school_id']]);
    $current = $chk->fetchColumn();
    if (!$current) {
        return jsonResponse($response, ['detail' => 'Report not found.'], 404);
    }
    
    $nextStatus = ($current === 'Settled') ? 'Pending' : 'Settled';
    
    $up = $pdo->prepare("UPDATE financial_reports SET settlement_status = :status WHERE id = :id AND school_id = :school_id");
    $up->execute([
        'status' => $nextStatus,
        'id' => $reportId,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Settle Report', "Updated financial report REP-" . sprintf('%03d', $reportId) . " settlement status to $nextStatus.");
    
    if ($current === 'Pending' && $nextStatus === 'Settled') {
        try {
            $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :school_id");
            $stmt->execute(['id' => $reportId, 'school_id' => $auth['school_id']]);
            $report = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $schStmt = $pdo->prepare("SELECT name, currency FROM schools WHERE id = :id");
            $schStmt->execute(['id' => $auth['school_id']]);
            $school = $schStmt->fetch(PDO::FETCH_ASSOC);
            $schoolName = $school['name'] ?: 'School';
            $currencyCode = $school['currency'] ?? 'INR';
            
            $revenue = (float)$report['fees_collected'] + (float)$report['extra_fees_collected'] + (float)($report['previous_year_recovery'] ?? 0.00);
            $expenses = (float)$report['salaries_paid'] + (float)$report['school_expenses'];
            
            $reportPeriod = date('d-M-Y', strtotime($report['from_date'])) . ' to ' . date('d-M-Y', strtotime($report['to_date']));
            $settlementDate = date('d-M-Y h:i A');
            
            $revenueFormatted = formatReportCurrency($revenue, $currencyCode);
            $expensesFormatted = formatReportCurrency($expenses, $currencyCode);
            
            $subject = "Financial Statement Settled - $schoolName";
            
            if ($revenue >= $expenses) {
                // Profit scenario (Net Profit > 0)
                $netProfit = $revenue - $expenses;
                $netProfitFormatted = formatReportCurrency($netProfit, $currencyCode);
                
                $body = "Hello,<br><br>\n\n"
                      . "This is to confirm that the financial statement for $schoolName has been settled successfully.<br><br>\n\n"
                      . "Financial Report Summary<br><br>\n\n"
                      . "Report Period:<br>\n"
                      . "$reportPeriod<br><br>\n\n"
                      . "<strong>Total Revenue: $revenueFormatted</strong><br>\n"
                      . "<strong>Total Expenses: $expensesFormatted</strong><br>\n"
                      . "<strong>Net Profit: $netProfitFormatted</strong><br><br>\n\n"
                      . "Settlement Date:<br>\n"
                      . "$settlementDate<br><br>\n\n"
                      . "<strong>The profit amount for the above reporting period has been handed over to the School Owner.</strong><br><br>\n\n"
                      . "This is an automated confirmation generated by CM Portal.<br><br>\n\n"
                      . "Thank you.";
            } else {
                // Loss scenario (Expenses > Revenue)
                $netLoss = $expenses - $revenue;
                $netLossFormatted = formatReportCurrency($netLoss, $currencyCode);
                
                $body = "Hello,<br><br>\n\n"
                      . "This is to confirm that the financial statement for $schoolName has been settled successfully.<br><br>\n\n"
                      . "Financial Report Summary<br><br>\n\n"
                      . "Report Period:<br>\n"
                      . "$reportPeriod<br><br>\n\n"
                      . "<strong>Total Revenue: $revenueFormatted</strong><br>\n"
                      . "<strong>Total Expenses: $expensesFormatted</strong><br>\n"
                      . "<strong>Net Loss: $netLossFormatted</strong><br><br>\n\n"
                      . "Settlement Date:<br>\n"
                      . "$settlementDate<br><br>\n\n"
                      . "<strong>The above reporting period resulted in an overall loss of $netLossFormatted.</strong><br><br>\n\n"
                      . "This settlement has been recorded successfully in the financial records.<br><br>\n\n"
                      . "This is an automated confirmation generated by CM Portal.<br><br>\n\n"
                      . "Thank you.";
            }
            
            sendSubscriptionReminderEmail($auth['email'], $subject, $body, true);
        } catch (\Exception $e) {
            $logMessage = "[" . date('Y-m-d H:i:s') . "] Failed sending settlement email for report ID $reportId: " . $e->getMessage() . "\n";
            file_put_contents(__DIR__ . '/../sent_emails.log', $logMessage, FILE_APPEND);
        }
    }
    
    return jsonResponse($response, ['settlement_status' => $nextStatus]);
});

// Export Financial Report to Excel and automatically email it
$app->get('/api/financial-reports/{id}/export', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $reportId = (int)$args['id'];
    $pdo = getDb();
    
    // Fetch report to verify ownership
    $stmt = $pdo->prepare("SELECT * FROM financial_reports WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $reportId, 'school_id' => $auth['school_id']]);
    $report = $stmt->fetch();
    if (!$report) {
        return jsonResponse($response, ['detail' => 'Report not found.'], 404);
    }
    
    $tempDir = __DIR__ . '/../scratch';
    if (!file_exists($tempDir)) {
        mkdir($tempDir, 0777, true);
    }
    $tempFile = $tempDir . '/Financial_Report_REP-' . sprintf('%03d', $reportId) . '.xlsx';
    
    try {
        generateReportExcelFile($pdo, $auth['school_id'], $reportId, $tempFile);
        
        $emailSent = sendReportEmail($auth['email'], $reportId, $report['from_date'], $report['to_date'], $tempFile);
        
        $fileContents = file_get_contents($tempFile);
        @unlink($tempFile);
        
        $fileName = 'Financial_Report_REP-' . sprintf('%03d', $reportId) . '.xlsx';
        $emailStatus = $emailSent ? 'Success' : 'Failed';
        
        $response->getBody()->write($fileContents);
        return $response
            ->withHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $fileName . '"')
            ->withHeader('X-Email-Status', $emailStatus)
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Email-Status');
    } catch (\Exception $e) {
        if (file_exists($tempFile)) {
            @unlink($tempFile);
        }
        return jsonResponse($response, ['detail' => 'Export failed: ' . $e->getMessage()], 500);
    }
});

// Get School Expenses
$app->get('/api/school-expenses', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM school_expenses WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY expense_date DESC, id DESC");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ay_id]);
    $expenses = $stmt->fetchAll();
    
    foreach ($expenses as &$e) {
        $e['id'] = (int)$e['id'];
        $e['amount'] = (float)$e['amount'];
    }
    unset($e);
    
    return jsonResponse($response, $expenses);
});

// Add School Expense
$app->post('/api/school-expenses', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $description = trim($data['description'] ?? '');
    $amount = (float)($data['amount'] ?? 0);
    $ay_id = $data['academic_year_id'] ?? 0;
    
    if (empty($description) || $amount <= 0 || !$ay_id) {
        return jsonResponse($response, ['detail' => 'Description, a positive Amount, and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    
    $expense_date = date('Y-m-d');
    $expense_time = date('H:i:s');
    $created_by = $auth['email'];
    
    $ins = $pdo->prepare("INSERT INTO school_expenses (school_id, academic_year_id, description, amount, expense_date, expense_time, created_by) 
                          VALUES (:school_id, :ay_id, :description, :amount, :expense_date, :expense_time, :created_by)");
    $ins->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'description' => $description,
        'amount' => $amount,
        'expense_date' => $expense_date,
        'expense_time' => $expense_time,
        'created_by' => $created_by
    ]);
    
    $newId = (int)$pdo->lastInsertId();
    
    $expense = [
        'id' => $newId,
        'school_id' => (int)$auth['school_id'],
        'academic_year_id' => (int)$ay_id,
        'description' => $description,
        'amount' => $amount,
        'expense_date' => $expense_date,
        'expense_time' => $expense_time,
        'created_by' => $created_by
    ];
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Expense', "Added school expense: $description (₹$amount)");
    
    return jsonResponse($response, $expense);
});

// Get Extra Fee Types
$app->get('/api/extra-fee-types', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM extra_fee_types WHERE school_id = :school_id AND academic_year_id = :ay_id ORDER BY id DESC");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ay_id]);
    $types = $stmt->fetchAll();
    
    foreach ($types as &$t) {
        $t['id'] = (int)$t['id'];
        $t['amount'] = (float)$t['amount'];
    }
    unset($t);
    
    return jsonResponse($response, $types);
});

// Add Extra Fee Type (seeds student list)
$app->post('/api/extra-fee-types', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $amount = (float)($data['amount'] ?? 0);
    $ay_id = $data['academic_year_id'] ?? 0;
    
    if (empty($name) || $amount <= 0 || !$ay_id) {
        return jsonResponse($response, ['detail' => 'Name, a positive Amount, and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    $pdo->beginTransaction();
    
    try {
        $ins = $pdo->prepare("INSERT INTO extra_fee_types (school_id, academic_year_id, name, amount) 
                              VALUES (:school_id, :ay_id, :name, :amount)");
        $ins->execute([
            'school_id' => $auth['school_id'],
            'ay_id' => $ay_id,
            'name' => $name,
            'amount' => $amount
        ]);
        
        $typeId = (int)$pdo->lastInsertId();
        
        // Automatically assign to all active students in the active academic session
        $assignStmt = $pdo->prepare("INSERT INTO student_extra_fees (school_id, academic_year_id, student_id, extra_fee_type_id, status)
                                      SELECT school_id, academic_year_id, id, :type_id, 'Pending'
                                      FROM students
                                      WHERE school_id = :school_id
                                        AND academic_year_id = :ay_id
                                        AND status = 'Active'");
        $assignStmt->execute([
            'type_id' => $typeId,
            'school_id' => $auth['school_id'],
            'ay_id' => $ay_id
        ]);
        
        $pdo->commit();
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Extra Fee Type', "Created extra fee type: $name (₹$amount) and assigned to active students.");
        
        return jsonResponse($response, [
            'id' => $typeId,
            'school_id' => (int)$auth['school_id'],
            'academic_year_id' => (int)$ay_id,
            'name' => $name,
            'amount' => $amount
        ]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Database transaction failed: ' . $e->getMessage()], 500);
    }
});

// Edit Extra Fee Type
$app->put('/api/extra-fee-types/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $typeId = (int)$args['id'];
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $amount = (float)($data['amount'] ?? 0);
    
    if (empty($name) || $amount <= 0) {
        return jsonResponse($response, ['detail' => 'Name and positive Amount are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Check ownership
    $chk = $pdo->prepare("SELECT * FROM extra_fee_types WHERE id = :id AND school_id = :school_id");
    $chk->execute(['id' => $typeId, 'school_id' => $auth['school_id']]);
    $record = $chk->fetch();
    
    if (!$record) {
        return jsonResponse($response, ['detail' => 'Fee type not found.'], 404);
    }
    
    // Check if the extra fee type is locked because it is used in a finalized report
    if (isExtraFeeTypeLocked($pdo, $auth['school_id'], $typeId)) {
        return jsonResponse($response, ['detail' => 'This fee type is used in a finalized Financial Report and cannot be modified.'], 400);
    }
    
    try {
        $up = $pdo->prepare("UPDATE extra_fee_types SET name = :name, amount = :amount WHERE id = :id");
        $up->execute([
            'name' => $name,
            'amount' => $amount,
            'id' => $typeId
        ]);
        
        logAudit($pdo, $auth['school_id'], $auth['email'], 'Edit Extra Fee Type', "Updated extra fee type ID $typeId: $name (₹$amount).");
        
        return jsonResponse($response, [
            'id' => $typeId,
            'school_id' => (int)$auth['school_id'],
            'academic_year_id' => (int)$record['academic_year_id'],
            'name' => $name,
            'amount' => $amount
        ]);
    } catch (\Exception $e) {
        return jsonResponse($response, ['detail' => 'Database operation failed: ' . $e->getMessage()], 500);
    }
});

// Get Student Extra Fee Ledger
$app->get('/api/student-extra-fees', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT sef.*, s.name as student_name, s.roll_number, s.class_id, s.sr_no, c.name as class_name, eft.name as fee_name, eft.amount 
                           FROM student_extra_fees sef
                           JOIN students s ON sef.student_id = s.id
                           JOIN classrooms c ON s.class_id = c.id
                           JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                           WHERE sef.school_id = :school_id AND sef.academic_year_id = :ay_id 
                           ORDER BY sef.id DESC");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ay_id]);
    $fees = $stmt->fetchAll();
    
    foreach ($fees as &$f) {
        $f['id'] = (int)$f['id'];
        $f['student_id'] = (int)$f['student_id'];
        $f['extra_fee_type_id'] = (int)$f['extra_fee_type_id'];
        $f['amount'] = (float)$f['amount'];
        $f['locked'] = ($f['status'] === 'Paid' && isTransactionLocked($pdo, $auth['school_id'], $f['paid_at']));
    }
    unset($f);
    
    return jsonResponse($response, $fees);
});

// Deposit Extra Student Fee
$app->post('/api/student-extra-fees/{id}/pay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $feeId = (int)$args['id'];
    $pdo = getDb();
    
    // Verify ownership
    $chk = $pdo->prepare("SELECT sef.*, eft.name as fee_name, eft.amount, s.name as student_name 
                          FROM student_extra_fees sef
                          JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                          JOIN students s ON sef.student_id = s.id
                          WHERE sef.id = :id AND sef.school_id = :school_id");
    $chk->execute(['id' => $feeId, 'school_id' => $auth['school_id']]);
    $record = $chk->fetch();
    
    if (!$record) {
        return jsonResponse($response, ['detail' => 'Extra fee record not found.'], 404);
    }
    
    if ($record['status'] === 'Paid') {
        if (isTransactionLocked($pdo, $auth['school_id'], $record['paid_at'])) {
            return jsonResponse($response, ['detail' => 'This extra fee payment is part of a finalized Financial Report and cannot be modified.'], 400);
        }
        return jsonResponse($response, ['detail' => 'Extra fee is already paid.'], 400);
    }
    
    $payDate = date('Y-m-d');
    $collector = $auth['email'];
    
    $up = $pdo->prepare("UPDATE student_extra_fees SET status = 'Paid', payment_date = :pay_date, paid_at = :paid_at, collected_by = :collector 
                         WHERE id = :id AND school_id = :school_id");
    $up->execute([
        'pay_date' => $payDate,
        'paid_at' => date('Y-m-d H:i:s'),
        'collector' => $collector,
        'id' => $feeId,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Pay Extra Fee', "Collected extra fee '{$record['fee_name']}' (₹{$record['amount']}) from student '{$record['student_name']}'");
    
    return jsonResponse($response, [
        'status' => 'Paid',
        'payment_date' => $payDate,
        'collected_by' => $collector
    ]);
});

// Revert Extra Student Fee Payment
$app->post('/api/student-extra-fees/{id}/unpay', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $feeId = (int)$args['id'];
    $pdo = getDb();
    
    // Verify ownership
    $chk = $pdo->prepare("SELECT sef.*, eft.name as fee_name, eft.amount, s.name as student_name 
                          FROM student_extra_fees sef
                          JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                          JOIN students s ON sef.student_id = s.id
                          WHERE sef.id = :id AND sef.school_id = :school_id");
    $chk->execute(['id' => $feeId, 'school_id' => $auth['school_id']]);
    $record = $chk->fetch();
    
    if (!$record) {
        return jsonResponse($response, ['detail' => 'Extra fee record not found.'], 404);
    }
    
    // Check if the extra fee payment is locked in a finalized report
    if ($record['status'] === 'Paid' && isTransactionLocked($pdo, $auth['school_id'], $record['paid_at'])) {
        return jsonResponse($response, ['detail' => 'This extra fee payment is part of a finalized Financial Report and cannot be reverted.'], 400);
    }
    
    if ($record['status'] === 'Pending') {
        return jsonResponse($response, ['detail' => 'Extra fee is already pending.'], 400);
    }
    
    $up = $pdo->prepare("UPDATE student_extra_fees SET status = 'Pending', payment_date = NULL, paid_at = NULL, collected_by = NULL 
                         WHERE id = :id AND school_id = :school_id");
    $up->execute([
        'id' => $feeId,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Revert Extra Fee', "Reverted extra fee payment '{$record['fee_name']}' (₹{$record['amount']}) for student '{$record['student_name']}'");
    
    return jsonResponse($response, [
        'status' => 'Pending',
        'payment_date' => null,
        'collected_by' => null
    ]);
});

// --- PAYMENT PROMISE TRACKER ---

// Get Payment Promises
$app->get('/api/payment-promises', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ay_id = $params['academic_year_id'] ?? 0;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT p.*, s.name AS student_name, s.roll_number, c.name AS class_name, s.class_id
                           FROM payment_promises p
                           JOIN students s ON p.student_id = s.id
                           LEFT JOIN classrooms c ON s.class_id = c.id
                           WHERE p.school_id = :school_id AND p.academic_year_id = :ay_id
                           ORDER BY p.promise_date ASC, p.id ASC");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ay_id]);
    $promises = $stmt->fetchAll();
    
    foreach ($promises as &$p) {
        $p['id'] = (int)$p['id'];
        $p['school_id'] = (int)$p['school_id'];
        $p['academic_year_id'] = (int)$p['academic_year_id'];
        $p['student_id'] = (int)$p['student_id'];
        if (isset($p['class_id'])) {
            $p['class_id'] = (int)$p['class_id'];
        }
    }
    unset($p);
    
    return jsonResponse($response, $promises);
});

// Add Payment Promise
$app->post('/api/payment-promises', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $student_id = (int)($data['student_id'] ?? 0);
    $promise_date = trim($data['promise_date'] ?? '');
    $description = trim($data['description'] ?? '');
    $status = trim($data['status'] ?? 'Pending');
    $ay_id = (int)($data['academic_year_id'] ?? 0);
    
    if (!$student_id || empty($promise_date) || !$ay_id) {
        return jsonResponse($response, ['detail' => 'Student, Date, and academic_year_id are required.'], 400);
    }
    
    if ($status !== 'Pending' && $status !== 'Fulfilled') {
        $status = 'Pending';
    }
    
    $pdo = getDb();
    
    // Verify student exists and belongs to school
    $chkStudent = $pdo->prepare("SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classrooms c ON s.class_id = c.id WHERE s.id = :student_id AND s.school_id = :school_id");
    $chkStudent->execute(['student_id' => $student_id, 'school_id' => $auth['school_id']]);
    $student = $chkStudent->fetch();
    
    if (!$student) {
        return jsonResponse($response, ['detail' => 'Selected student not found.'], 404);
    }
    
    $ins = $pdo->prepare("INSERT INTO payment_promises (school_id, academic_year_id, student_id, promise_date, description, status) 
                          VALUES (:school_id, :ay_id, :student_id, :promise_date, :description, :status)");
    $ins->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ay_id,
        'student_id' => $student_id,
        'promise_date' => $promise_date,
        'description' => $description,
        'status' => $status
    ]);
    
    $newId = (int)$pdo->lastInsertId();
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Add Payment Promise', "Added payment promise for student {$student['name']} on $promise_date");
    
    return jsonResponse($response, [
        'id' => $newId,
        'school_id' => (int)$auth['school_id'],
        'academic_year_id' => $ay_id,
        'student_id' => $student_id,
        'promise_date' => $promise_date,
        'description' => $description,
        'status' => $status,
        'student_name' => $student['name'],
        'class_name' => $student['class_name'] ?? 'Unassigned',
        'class_id' => $student['class_id'] ? (int)$student['class_id'] : null
    ]);
});

// Edit Payment Promise
$app->put('/api/payment-promises/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $promiseId = (int)$args['id'];
    $data = getJsonData($request);
    $student_id = (int)($data['student_id'] ?? 0);
    $promise_date = trim($data['promise_date'] ?? '');
    $description = trim($data['description'] ?? '');
    $status = trim($data['status'] ?? '');
    
    if (!$student_id || empty($promise_date)) {
        return jsonResponse($response, ['detail' => 'Student and Date are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Verify promise ownership
    $chkPromise = $pdo->prepare("SELECT * FROM payment_promises WHERE id = :id AND school_id = :school_id");
    $chkPromise->execute(['id' => $promiseId, 'school_id' => $auth['school_id']]);
    $promise = $chkPromise->fetch();
    
    if (!$promise) {
        return jsonResponse($response, ['detail' => 'Payment promise not found.'], 404);
    }
    
    if (empty($status) || ($status !== 'Pending' && $status !== 'Fulfilled')) {
        $status = $promise['status'];
    }
    
    // Verify student exists and belongs to school
    $chkStudent = $pdo->prepare("SELECT s.*, c.name AS class_name FROM students s LEFT JOIN classrooms c ON s.class_id = c.id WHERE s.id = :student_id AND s.school_id = :school_id");
    $chkStudent->execute(['student_id' => $student_id, 'school_id' => $auth['school_id']]);
    $student = $chkStudent->fetch();
    
    if (!$student) {
        return jsonResponse($response, ['detail' => 'Selected student not found.'], 404);
    }
    
    $up = $pdo->prepare("UPDATE payment_promises 
                         SET student_id = :student_id, promise_date = :promise_date, description = :description, status = :status 
                         WHERE id = :id AND school_id = :school_id");
    $up->execute([
        'student_id' => $student_id,
        'promise_date' => $promise_date,
        'description' => $description,
        'status' => $status,
        'id' => $promiseId,
        'school_id' => $auth['school_id']
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Edit Payment Promise', "Updated payment promise ID $promiseId for student {$student['name']}");
    
    return jsonResponse($response, [
        'id' => $promiseId,
        'school_id' => (int)$auth['school_id'],
        'academic_year_id' => (int)$promise['academic_year_id'],
        'student_id' => $student_id,
        'promise_date' => $promise_date,
        'description' => $description,
        'status' => $status,
        'student_name' => $student['name'],
        'class_name' => $student['class_name'] ?? 'Unassigned',
        'class_id' => $student['class_id'] ? (int)$student['class_id'] : null
    ]);
});

// Delete Payment Promise
$app->delete('/api/payment-promises/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $promiseId = (int)$args['id'];
    $pdo = getDb();
    
    // Verify promise ownership
    $chkPromise = $pdo->prepare("SELECT * FROM payment_promises WHERE id = :id AND school_id = :school_id");
    $chkPromise->execute(['id' => $promiseId, 'school_id' => $auth['school_id']]);
    $promise = $chkPromise->fetch();
    
    if (!$promise) {
        return jsonResponse($response, ['detail' => 'Payment promise not found.'], 404);
    }
    
    $del = $pdo->prepare("DELETE FROM payment_promises WHERE id = :id AND school_id = :school_id");
    $del->execute(['id' => $promiseId, 'school_id' => $auth['school_id']]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Delete Payment Promise', "Deleted payment promise ID $promiseId");
    
    return jsonResponse($response, ['status' => 'success']);
});

// --- ACADEMIC PLANNER / SCHEDULE MANAGEMENT ---

// Subjects Management
$app->get('/api/subjects', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $subjects = getMockSubjects();
        $filtered = array_filter($subjects, function ($sub) use ($auth) {
            return (int)$sub['school_id'] === (int)$auth['school_id'];
        });
        return jsonResponse($response, array_values($filtered));
    }
    
    $stmt = $pdo->prepare("SELECT * FROM subjects WHERE school_id = :school_id ORDER BY name ASC");
    $stmt->execute(['school_id' => $auth['school_id']]);
    return jsonResponse($response, $stmt->fetchAll());
});

$app->post('/api/subjects', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    if (empty($name)) return jsonResponse($response, ['detail' => 'Subject name is required'], 400);
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $subjects = getMockSubjects();
        foreach ($subjects as $s) {
            if ((int)$s['school_id'] === (int)$auth['school_id'] && strcasecmp($s['name'], $name) === 0) {
                return jsonResponse($response, ['detail' => 'Subject already exists'], 400);
            }
        }
        $newId = count($subjects) > 0 ? max(array_column($subjects, 'id')) + 1 : 1;
        $newSubject = [
            'id' => $newId,
            'school_id' => (int)$auth['school_id'],
            'name' => $name
        ];
        $subjects[] = $newSubject;
        saveMockSubjects($subjects);
        return jsonResponse($response, $newSubject);
    }
    
    $chk = $pdo->prepare("SELECT COUNT(*) FROM subjects WHERE school_id = :school_id AND LOWER(name) = LOWER(:name)");
    $chk->execute(['school_id' => $auth['school_id'], 'name' => $name]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Subject already exists'], 400);
    }
    
    $stmt = $pdo->prepare("INSERT INTO subjects (school_id, name) VALUES (:school_id, :name)");
    $stmt->execute(['school_id' => $auth['school_id'], 'name' => $name]);
    $newId = $pdo->lastInsertId();
    
    return jsonResponse($response, [
        'id' => $newId,
        'school_id' => $auth['school_id'],
        'name' => $name
    ]);
});

$app->put('/api/subjects/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = (int)$args['id'];
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    if (empty($name)) return jsonResponse($response, ['detail' => 'Subject name is required'], 400);
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $subjects = getMockSubjects();
        $foundIdx = -1;
        foreach ($subjects as $idx => $s) {
            if ((int)$s['id'] === $id && (int)$s['school_id'] === (int)$auth['school_id']) {
                $foundIdx = $idx;
            }
            if ((int)$s['school_id'] === (int)$auth['school_id'] && (int)$s['id'] !== $id && strcasecmp($s['name'], $name) === 0) {
                return jsonResponse($response, ['detail' => 'Another subject with this name already exists'], 400);
            }
        }
        if ($foundIdx === -1) return jsonResponse($response, ['detail' => 'Subject not found'], 404);
        $subjects[$foundIdx]['name'] = $name;
        saveMockSubjects($subjects);
        return jsonResponse($response, $subjects[$foundIdx]);
    }
    
    $chk = $pdo->prepare("SELECT COUNT(*) FROM subjects WHERE school_id = :school_id AND LOWER(name) = LOWER(:name) AND id != :id");
    $chk->execute(['school_id' => $auth['school_id'], 'name' => $name, 'id' => $id]);
    if ($chk->fetchColumn() > 0) {
        return jsonResponse($response, ['detail' => 'Another subject with this name already exists'], 400);
    }
    
    $stmt = $pdo->prepare("UPDATE subjects SET name = :name WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['name' => $name, 'id' => $id, 'school_id' => $auth['school_id']]);
    
    return jsonResponse($response, [
        'id' => $id,
        'school_id' => $auth['school_id'],
        'name' => $name
    ]);
});

$app->delete('/api/subjects/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $id = (int)$args['id'];
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $subjects = getMockSubjects();
        $filtered = array_filter($subjects, function ($s) use ($id, $auth) {
            return !((int)$s['id'] === $id && (int)$s['school_id'] === (int)$auth['school_id']);
        });
        saveMockSubjects(array_values($filtered));
        return jsonResponse($response, ['message' => 'Subject deleted successfully']);
    }
    
    $stmt = $pdo->prepare("DELETE FROM subjects WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $id, 'school_id' => $auth['school_id']]);
    return jsonResponse($response, ['message' => 'Subject deleted successfully']);
});

// Schedules Timetable Management
$app->get('/api/schedules', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
    $ayId = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : 0;
    
    if (!$classId || !$ayId) {
        return jsonResponse($response, ['detail' => 'class_id and academic_year_id are required'], 400);
    }
    
    $weekStart = isset($params['week_start_date']) ? trim($params['week_start_date']) : '';
    $status = isset($params['status']) ? trim($params['status']) : '';
    $startDate = isset($params['start_date']) ? trim($params['start_date']) : '';
    $endDate = isset($params['end_date']) ? trim($params['end_date']) : '';
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        $filtered = array_filter($schedules, function ($s) use ($auth, $classId, $ayId, $weekStart, $status, $startDate, $endDate) {
            if ((int)$s['school_id'] !== (int)$auth['school_id']) return false;
            if ((int)$s['class_id'] !== $classId) return false;
            if ((int)$s['academic_year_id'] !== $ayId) return false;
            
            if (!empty($weekStart) && $s['week_start_date'] !== $weekStart) return false;
            if (!empty($status) && strcasecmp($s['status'], $status) !== 0) return false;
            
            if (!empty($startDate) && strcmp($s['schedule_date'], $startDate) < 0) return false;
            if (!empty($endDate) && strcmp($s['schedule_date'], $endDate) > 0) return false;
            
            return true;
        });
        
        $results = array_values($filtered);
        foreach ($results as &$r) {
            $r['subjects'] = is_array($r['subjects']) ? $r['subjects'] : (json_decode($r['subjects'], true) ?: []);
        }
        unset($r);

        if ($weekStart) {
            $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            $existingDays = array_map(function($r) {
                return $r['day_of_week'];
            }, $results);
            
            foreach ($days as $dayIndex => $dayName) {
                if (!in_array($dayName, $existingDays)) {
                    $targetDate = date('Y-m-d', strtotime($weekStart . " +$dayIndex days"));
                    
                    $priorRecord = null;
                    foreach ($schedules as $s) {
                        if ((int)$s['school_id'] === (int)$auth['school_id'] &&
                            (int)$s['class_id'] === $classId &&
                            (int)$s['academic_year_id'] === $ayId &&
                            $s['day_of_week'] === $dayName &&
                            strcmp($s['schedule_date'], $targetDate) < 0) {
                            if ($priorRecord === null || strcmp($s['schedule_date'], $priorRecord['schedule_date']) > 0) {
                                $priorRecord = $s;
                            }
                        }
                    }
                    
                    if ($priorRecord) {
                        $subjects = is_array($priorRecord['subjects']) ? $priorRecord['subjects'] : (json_decode($priorRecord['subjects'], true) ?: []);
                        foreach ($subjects as &$sub) {
                            if (is_array($sub)) {
                                $sub['backup_teacher_id'] = null;
                                $sub['backup_teacher_name'] = null;
                            }
                        }
                        unset($sub);
                        
                        $results[] = [
                            'school_id' => (int)$auth['school_id'],
                            'academic_year_id' => $ayId,
                            'class_id' => $classId,
                            'day_of_week' => $dayName,
                            'schedule_date' => $targetDate,
                            'week_start_date' => $weekStart,
                            'subjects' => $subjects,
                            'status' => $priorRecord['status']
                        ];
                    }
                }
            }
        }

        usort($results, function ($a, $b) {
            return strcmp($a['schedule_date'], $b['schedule_date']);
        });
        return jsonResponse($response, $results);
    }
    
    $sql = "SELECT * FROM class_schedules WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :ay_id";
    $binds = ['school_id' => $auth['school_id'], 'class_id' => $classId, 'ay_id' => $ayId];
    
    if ($weekStart) {
        $sql .= " AND week_start_date = :week_start";
        $binds['week_start'] = $weekStart;
    }
    if ($status) {
        $sql .= " AND status = :status";
        $binds['status'] = $status;
    }
    if ($startDate) {
        $sql .= " AND schedule_date >= :start_date";
        $binds['start_date'] = $startDate;
    }
    if ($endDate) {
        $sql .= " AND schedule_date <= :end_date";
        $binds['end_date'] = $endDate;
    }
    
    $sql .= " ORDER BY schedule_date ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($binds);
    $results = $stmt->fetchAll();
    
    foreach ($results as &$r) {
        $r['subjects'] = json_decode($r['subjects'], true) ?: [];
    }
    unset($r);

    if ($weekStart) {
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $existingDays = array_map(function($r) {
            return $r['day_of_week'];
        }, $results);
        
        foreach ($days as $dayIndex => $dayName) {
            if (!in_array($dayName, $existingDays)) {
                $targetDate = date('Y-m-d', strtotime($weekStart . " +$dayIndex days"));
                
                $subStmt = $pdo->prepare("SELECT * FROM class_schedules 
                    WHERE school_id = :school_id 
                      AND class_id = :class_id 
                      AND academic_year_id = :ay_id 
                      AND day_of_week = :day_of_week 
                      AND schedule_date < :target_date 
                    ORDER BY schedule_date DESC LIMIT 1");
                $subStmt->execute([
                    'school_id' => $auth['school_id'],
                    'class_id' => $classId,
                    'ay_id' => $ayId,
                    'day_of_week' => $dayName,
                    'target_date' => $targetDate
                ]);
                $priorRecord = $subStmt->fetch();
                
                if ($priorRecord) {
                    $subjects = json_decode($priorRecord['subjects'], true) ?: [];
                    foreach ($subjects as &$sub) {
                        if (is_array($sub)) {
                            $sub['backup_teacher_id'] = null;
                            $sub['backup_teacher_name'] = null;
                        }
                    }
                    unset($sub);
                    
                    $results[] = [
                        'school_id' => (int)$auth['school_id'],
                        'academic_year_id' => $ayId,
                        'class_id' => $classId,
                        'day_of_week' => $dayName,
                        'schedule_date' => $targetDate,
                        'week_start_date' => $weekStart,
                        'subjects' => $subjects,
                        'status' => $priorRecord['status']
                    ];
                }
            }
        }
        
        usort($results, function ($a, $b) {
            return strcmp($a['schedule_date'], $b['schedule_date']);
        });
    }
    
    return jsonResponse($response, $results);
});

$app->post('/api/schedules', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $classId = isset($data['class_id']) ? (int)$data['class_id'] : 0;
    $ayId = isset($data['academic_year_id']) ? (int)$data['academic_year_id'] : 0;
    $dayOfWeek = trim($data['day_of_week'] ?? '');
    $scheduleDate = trim($data['schedule_date'] ?? '');
    $weekStartDate = trim($data['week_start_date'] ?? '');
    $subjects = $data['subjects'] ?? [];
    $status = trim($data['status'] ?? 'Draft');
    
    if (!$classId || !$ayId || empty($dayOfWeek) || empty($scheduleDate) || empty($weekStartDate)) {
        return jsonResponse($response, ['detail' => 'class_id, academic_year_id, day_of_week, schedule_date, and week_start_date are required'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        $foundIdx = -1;
        foreach ($schedules as $idx => $s) {
            if ((int)$s['school_id'] === (int)$auth['school_id'] &&
                (int)$s['class_id'] === $classId &&
                (int)$s['academic_year_id'] === $ayId &&
                $s['schedule_date'] === $scheduleDate) {
                $foundIdx = $idx;
                break;
            }
        }
        
        $schedule = [
            'school_id' => (int)$auth['school_id'],
            'academic_year_id' => $ayId,
            'class_id' => $classId,
            'day_of_week' => $dayOfWeek,
            'schedule_date' => $scheduleDate,
            'week_start_date' => $weekStartDate,
            'subjects' => $subjects,
            'status' => $status
        ];
        
        if ($foundIdx !== -1) {
            $schedules[$foundIdx] = array_merge($schedules[$foundIdx], $schedule);
            $schedule = $schedules[$foundIdx];
        } else {
            $newId = count($schedules) > 0 ? max(array_column($schedules, 'id')) + 1 : 1;
            $schedule['id'] = $newId;
            $schedules[] = $schedule;
        }
        
        // Mock Propagation
        $propagate = (bool)($data['propagate'] ?? false);
        $propagateType = trim($data['propagate_type'] ?? '');
        $targetIndex = isset($data['target_index']) ? (int)$data['target_index'] : -1;
        
        if ($propagate && !empty($propagateType)) {
            foreach ($schedules as &$s) {
                if ((int)$s['school_id'] === (int)$auth['school_id'] &&
                    (int)$s['class_id'] === $classId &&
                    (int)$s['academic_year_id'] === $ayId &&
                    $s['day_of_week'] === $dayOfWeek &&
                    strcmp($s['schedule_date'], $scheduleDate) > 0) {
                    
                    $futSubjects = is_array($s['subjects']) ? $s['subjects'] : (json_decode($s['subjects'], true) ?: []);
                    $modified = false;
                    
                    if ($propagateType === 'add') {
                        if (count($subjects) > 0) {
                            $newPeriod = end($subjects);
                            if (is_array($newPeriod)) {
                                $newPeriod['backup_teacher_id'] = null;
                                $newPeriod['backup_teacher_name'] = null;
                            }
                            $futSubjects[] = $newPeriod;
                            $modified = true;
                        }
                    } elseif ($propagateType === 'remove') {
                        if ($targetIndex >= 0 && $targetIndex < count($futSubjects)) {
                            array_splice($futSubjects, $targetIndex, 1);
                            $modified = true;
                        }
                    } elseif ($propagateType === 'replace') {
                        if ($targetIndex >= 0 && $targetIndex < count($subjects) && $targetIndex < count($futSubjects)) {
                            $currentPeriod = $subjects[$targetIndex];
                            if (is_array($currentPeriod)) {
                                $futSubjects[$targetIndex]['teacher_id'] = $currentPeriod['teacher_id'];
                                $futSubjects[$targetIndex]['teacher_name'] = $currentPeriod['teacher_name'];
                                $futSubjects[$targetIndex]['backup_teacher_id'] = null;
                                $futSubjects[$targetIndex]['backup_teacher_name'] = null;
                                $modified = true;
                            }
                        }
                    }
                    
                    if ($modified) {
                        $s['subjects'] = $futSubjects;
                    }
                }
            }
            unset($s);
        }
        
        saveMockSchedules($schedules);
        return jsonResponse($response, $schedule);
    }
    
    $chkCls = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :id AND school_id = :sid");
    $chkCls->execute(['id' => $classId, 'sid' => $auth['school_id']]);
    if ($chkCls->fetchColumn() == 0) {
        return jsonResponse($response, ['detail' => 'Classroom not found'], 404);
    }
    
    $subjectsJson = json_encode($subjects);
    
    $stmt = $pdo->prepare("INSERT INTO class_schedules (school_id, academic_year_id, class_id, day_of_week, schedule_date, week_start_date, subjects, status) 
        VALUES (:school_id, :academic_year_id, :class_id, :day_of_week, :schedule_date, :week_start_date, :subjects, :status)
        ON DUPLICATE KEY UPDATE day_of_week = :day_of_week_update, week_start_date = :week_start_date_update, subjects = :subjects_update, status = :status_update");
        
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'academic_year_id' => $ayId,
        'class_id' => $classId,
        'day_of_week' => $dayOfWeek,
        'schedule_date' => $scheduleDate,
        'week_start_date' => $weekStartDate,
        'subjects' => $subjectsJson,
        'status' => $status,
        
        'day_of_week_update' => $dayOfWeek,
        'week_start_date_update' => $weekStartDate,
        'subjects_update' => $subjectsJson,
        'status_update' => $status
    ]);
    
    // Live DB Propagation
    $propagate = (bool)($data['propagate'] ?? false);
    $propagateType = trim($data['propagate_type'] ?? '');
    $targetIndex = isset($data['target_index']) ? (int)$data['target_index'] : -1;
    
    if ($propagate && !empty($propagateType)) {
        $futStmt = $pdo->prepare("SELECT id, subjects FROM class_schedules 
            WHERE school_id = :school_id 
              AND class_id = :class_id 
              AND academic_year_id = :ay_id 
              AND day_of_week = :day_of_week 
              AND schedule_date > :current_date");
        $futStmt->execute([
            'school_id' => $auth['school_id'],
            'class_id' => $classId,
            'ay_id' => $ayId,
            'day_of_week' => $dayOfWeek,
            'current_date' => $scheduleDate
        ]);
        $futureSchedules = $futStmt->fetchAll();
        
        foreach ($futureSchedules as $fut) {
            $futSubjects = json_decode($fut['subjects'], true) ?: [];
            $modified = false;
            
            if ($propagateType === 'add') {
                if (count($subjects) > 0) {
                    $newPeriod = end($subjects);
                    if (is_array($newPeriod)) {
                        $newPeriod['backup_teacher_id'] = null;
                        $newPeriod['backup_teacher_name'] = null;
                    }
                    $futSubjects[] = $newPeriod;
                    $modified = true;
                }
            } elseif ($propagateType === 'remove') {
                if ($targetIndex >= 0 && $targetIndex < count($futSubjects)) {
                    array_splice($futSubjects, $targetIndex, 1);
                    $modified = true;
                }
            } elseif ($propagateType === 'replace') {
                if ($targetIndex >= 0 && $targetIndex < count($subjects) && $targetIndex < count($futSubjects)) {
                    $currentPeriod = $subjects[$targetIndex];
                    if (is_array($currentPeriod)) {
                        $futSubjects[$targetIndex]['teacher_id'] = $currentPeriod['teacher_id'];
                        $futSubjects[$targetIndex]['teacher_name'] = $currentPeriod['teacher_name'];
                        $futSubjects[$targetIndex]['backup_teacher_id'] = null;
                        $futSubjects[$targetIndex]['backup_teacher_name'] = null;
                        $modified = true;
                    }
                }
            }
            
            if ($modified) {
                $updStmt = $pdo->prepare("UPDATE class_schedules SET subjects = :subj WHERE id = :id");
                $updStmt->execute([
                    'subj' => json_encode($futSubjects),
                    'id' => $fut['id']
                ]);
            }
        }
    }
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Schedule Updated', "Updated schedule for class ID $classId on $scheduleDate ($dayOfWeek).");
    
    return jsonResponse($response, [
        'school_id' => $auth['school_id'],
        'academic_year_id' => $ayId,
        'class_id' => $classId,
        'day_of_week' => $dayOfWeek,
        'schedule_date' => $scheduleDate,
        'week_start_date' => $weekStartDate,
        'subjects' => $subjects,
        'status' => $status
    ]);
});

$app->put('/api/schedules/publish', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $classId = isset($data['class_id']) ? (int)$data['class_id'] : 0;
    $ayId = isset($data['academic_year_id']) ? (int)$data['academic_year_id'] : 0;
    $weekStartDate = trim($data['week_start_date'] ?? '');
    $status = trim($data['status'] ?? 'Published');
    
    if (!$classId || !$ayId || empty($weekStartDate)) {
        return jsonResponse($response, ['detail' => 'class_id, academic_year_id, and week_start_date are required'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        foreach ($schedules as &$s) {
            if ((int)$s['school_id'] === (int)$auth['school_id'] &&
                (int)$s['class_id'] === $classId &&
                (int)$s['academic_year_id'] === $ayId &&
                $s['week_start_date'] === $weekStartDate) {
                $s['status'] = $status;
            }
        }
        saveMockSchedules($schedules);
        return jsonResponse($response, ['success' => true, 'message' => "Schedule status updated to $status successfully"]);
    }
    
    $stmt = $pdo->prepare("UPDATE class_schedules SET status = :status WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :ay_id AND week_start_date = :week_start_date");
    $stmt->execute([
        'status' => $status,
        'school_id' => $auth['school_id'],
        'class_id' => $classId,
        'ay_id' => $ayId,
        'week_start_date' => $weekStartDate
    ]);
    
    logAudit($pdo, $auth['school_id'], $auth['email'], "Schedule Status Changed", "Set weekly schedule status to $status for class ID $classId on week starting $weekStartDate.");
    
    return jsonResponse($response, ['success' => true, 'message' => "Schedule status updated to $status successfully"]);
});

// App / Student Integration API Readiness
$app->get('/api/schedules/today', function (Request $request, Response $response) {
    $params = $request->getQueryParams();
    $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
    
    if (!$classId) {
        return jsonResponse($response, ['detail' => 'class_id is required'], 400);
    }
    
    $today = isset($params['date']) ? trim($params['date']) : '';
    if (empty($today) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $today)) {
        date_default_timezone_set('Asia/Kolkata');
        $today = date('Y-m-d');
    }
    $dayOfWeek = date('l', strtotime($today));
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        foreach ($schedules as $s) {
            if ((int)$s['class_id'] === $classId &&
                $s['schedule_date'] === $today &&
                $s['status'] === 'Published') {
                return jsonResponse($response, [
                    'day_of_week' => $dayOfWeek,
                    'schedule_date' => $today,
                    'subjects' => $s['subjects'],
                    'status' => 'Published'
                ]);
            }
        }
        return jsonResponse($response, [
            'day_of_week' => $dayOfWeek,
            'schedule_date' => $today,
            'subjects' => [],
            'status' => 'Published'
        ]);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE class_id = :class_id AND schedule_date = :today AND status = 'Published' LIMIT 1");
    $stmt->execute([
        'class_id' => $classId,
        'today' => $today
    ]);
    $schedule = $stmt->fetch();
    if ($schedule) {
        return jsonResponse($response, [
            'day_of_week' => $schedule['day_of_week'],
            'schedule_date' => $schedule['schedule_date'],
            'subjects' => json_decode($schedule['subjects'], true) ?: [],
            'status' => 'Published'
        ]);
    }
    return jsonResponse($response, [
        'day_of_week' => $dayOfWeek,
        'schedule_date' => $today,
        'subjects' => [],
        'status' => 'Published'
    ]);
});

$app->get('/api/schedules/weekly', function (Request $request, Response $response) {
    $params = $request->getQueryParams();
    $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
    
    if (!$classId) {
        return jsonResponse($response, ['detail' => 'class_id is required'], 400);
    }
    
    $weekStart = isset($params['week_start_date']) ? trim($params['week_start_date']) : '';
    if (empty($weekStart)) {
        $time = time();
        if (date('N', $time) != 1) {
            $weekStart = date('Y-m-d', strtotime('last Monday', $time));
        } else {
            $weekStart = date('Y-m-d', $time);
        }
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        $filtered = array_filter($schedules, function ($s) use ($classId, $weekStart) {
            return (int)$s['class_id'] === $classId && 
                   $s['week_start_date'] === $weekStart && 
                   $s['status'] === 'Published';
        });
        
        $results = array_values($filtered);
        usort($results, function ($a, $b) {
            return strcmp($a['schedule_date'], $b['schedule_date']);
        });
        return jsonResponse($response, $results);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE class_id = :class_id AND week_start_date = :week_start AND status = 'Published' ORDER BY schedule_date ASC");
    $stmt->execute(['class_id' => $classId, 'week_start' => $weekStart]);
    $results = $stmt->fetchAll();
    foreach ($results as &$r) {
        $r['subjects'] = json_decode($r['subjects'], true) ?: [];
    }
    return jsonResponse($response, $results);
});

// Get all weekly schedules across classrooms
$app->get('/api/schedules/all-weekly', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ayId = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : 0;
    $weekStart = isset($params['week_start_date']) ? trim($params['week_start_date']) : '';
    
    if (!$ayId || empty($weekStart)) {
        return jsonResponse($response, ['detail' => 'academic_year_id and week_start_date are required'], 400);
    }
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        $filtered = array_filter($schedules, function ($s) use ($auth, $ayId, $weekStart) {
            return (int)$s['school_id'] === (int)$auth['school_id'] &&
                   (int)$s['academic_year_id'] === $ayId &&
                   $s['week_start_date'] === $weekStart &&
                   ($s['status'] === 'Published' || $s['status'] === 'Draft');
        });
        $results = array_values($filtered);
        return jsonResponse($response, $results);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE school_id = :school_id AND academic_year_id = :ay_id AND week_start_date = :week_start AND status IN ('Published', 'Draft')");
    $stmt->execute(['school_id' => $auth['school_id'], 'ay_id' => $ayId, 'week_start' => $weekStart]);
    $results = $stmt->fetchAll();
    foreach ($results as &$r) {
        $r['subjects'] = json_decode($r['subjects'], true) ?: [];
    }
    return jsonResponse($response, $results);
});

// Trigger Parent Reminder Notifications
$app->post('/api/schedules/trigger-notifications', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $tomorrowDay = date('l', strtotime('+1 day'));
    
    $pdo = null;
    try {
        $pdo = getDb();
    } catch (\Exception $e) {
        $pdo = null;
    }
    
    $notificationsCreated = 0;
    
    if ($pdo === null) {
        $schedules = getMockSchedules();
        $classesFile = __DIR__ . '/../mock_classes.json';
        $classes = file_exists($classesFile) ? json_decode(file_get_contents($classesFile), true) : [];
        
        $notificationsFile = __DIR__ . '/../mock_notifications.json';
        $notifications = file_exists($notificationsFile) ? json_decode(file_get_contents($notificationsFile), true) : [];
        
        foreach ($schedules as $s) {
            if ((int)$s['school_id'] === (int)$auth['school_id'] &&
                $s['schedule_date'] === $tomorrow &&
                $s['status'] === 'Published') {
                
                $className = "Class " . $s['class_id'];
                foreach ($classes as $c) {
                    if ((int)$c['id'] === (int)$s['class_id']) {
                        $className = $c['name'];
                        break;
                    }
                }
                
                $subjectNames = [];
                foreach ($s['subjects'] as $subObj) {
                    $subjectNames[] = is_array($subObj) ? $subObj['subject'] : $subObj;
                }
                
                $subjectsListStr = implode(', ', $subjectNames);
                if (empty($subjectsListStr)) $subjectsListStr = "No subjects scheduled";
                
                $title = "Tomorrow's Schedule Details for $className";
                $content = "Tomorrow's subjects: $subjectsListStr. Please ensure your child carries the required books and notebooks.";
                
                $newNotif = [
                    'id' => count($notifications) > 0 ? max(array_column($notifications, 'id')) + 1 : 1,
                    'school_id' => (int)$auth['school_id'],
                    'title' => $title,
                    'content' => $content,
                    'type' => 'Academic',
                    'is_read' => 0,
                    'timestamp' => date('Y-m-d H:i:s')
                ];
                $notifications[] = $newNotif;
                $notificationsCreated++;
            }
        }
        
        file_put_contents($notificationsFile, json_encode($notifications, JSON_PRETTY_PRINT));
        
        return jsonResponse($response, [
            'success' => true, 
            'notifications_created' => $notificationsCreated,
            'message' => "Successfully triggered $notificationsCreated reminder notifications for tomorrow ($tomorrowDay, $tomorrow)."
        ]);
    }
    
    $stmt = $pdo->prepare("SELECT cs.*, c.name as class_name 
                           FROM class_schedules cs 
                           JOIN classrooms c ON cs.class_id = c.id
                           WHERE cs.school_id = :school_id AND cs.schedule_date = :tomorrow AND cs.status = 'Published'");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'tomorrow' => $tomorrow
    ]);
    
    $tomorrowSchedules = $stmt->fetchAll();
    
    foreach ($tomorrowSchedules as $s) {
        $subjectsArray = json_decode($s['subjects'], true) ?: [];
        $subjectNames = [];
        foreach ($subjectsArray as $subObj) {
            $subjectNames[] = is_array($subObj) ? $subObj['subject'] : $subObj;
        }
        
        $subjectsListStr = implode(', ', $subjectNames);
        if (empty($subjectsListStr)) $subjectsListStr = "No subjects scheduled";
        
        $className = $s['class_name'];
        $title = "Tomorrow's Schedule Details for $className";
        $content = "Tomorrow's subjects: $subjectsListStr. Please ensure your child carries the required books and notebooks.";
        
        $ins = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, is_read, timestamp) 
                              VALUES (:school_id, :title, :content, :type, 0, :timestamp)");
        $ins->execute([
            'school_id' => $auth['school_id'],
            'title' => $title,
            'content' => $content,
            'type' => 'Academic',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        $notificationsCreated++;
    }
    
    logAudit($pdo, $auth['school_id'], $auth['email'], 'Notifications Triggered', "Triggered $notificationsCreated schedule notifications for tomorrow.");
    
    return jsonResponse($response, [
        'success' => true,
        'notifications_created' => $notificationsCreated,
        'message' => "Successfully triggered $notificationsCreated reminder notifications for tomorrow ($tomorrowDay, $tomorrow)."
    ]);
});

// WhatsApp Reminders - Init batch queue
$app->post('/api/schedules/whatsapp-reminders/init', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $classId = (int)($data['class_id'] ?? 0);
    if (!$classId) return jsonResponse($response, ['detail' => 'Class ID is required.'], 400);
    
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $formattedTomorrow = date('d/m/Y', strtotime('+1 day'));
    
    $pdo = null;
    try { $pdo = getDb(); } catch (\Exception $e) {}
    
    $schedule = null;
    $students = [];
    $className = "Class " . $classId;
    
    if ($pdo === null) {
        // Mock database mode
        $schedules = getMockSchedules();
        foreach ($schedules as $s) {
            if ((int)$s['school_id'] === (int)$auth['school_id'] && 
                (int)$s['class_id'] === $classId && 
                $s['schedule_date'] === $tomorrow && 
                $s['status'] === 'Published') {
                $schedule = $s;
                break;
            }
        }
        if (!$schedule) return jsonResponse($response, ['detail' => "Tomorrow's schedule is not published for this class."], 400);
        
        $classesFile = __DIR__ . '/../mock_classes.json';
        $classes = file_exists($classesFile) ? json_decode(file_get_contents($classesFile), true) : [];
        foreach ($classes as $c) {
            if ((int)$c['id'] === $classId) {
                $className = $c['name'];
                break;
            }
        }
        
        // Fetch mock active students with phone numbers
        $studentsFile = __DIR__ . '/../mock_students.json';
        $allStudents = file_exists($studentsFile) ? json_decode(file_get_contents($studentsFile), true) : [];
        if (empty($allStudents)) {
            $allStudents = [
                ['id' => 1, 'name' => 'Amit Sharma', 'class_id' => $classId, 'phone' => '9876543210', 'status' => 'Active'],
                ['id' => 2, 'name' => 'Priya Patel', 'class_id' => $classId, 'phone' => '8765432109', 'status' => 'Active'],
                ['id' => 3, 'name' => 'Rahul Verma', 'class_id' => $classId, 'phone' => '7654321098', 'status' => 'Active'],
                ['id' => 4, 'name' => 'Suresh Kumar', 'class_id' => $classId, 'phone' => '', 'status' => 'Active'],
                ['id' => 5, 'name' => 'Sunita Singh', 'class_id' => $classId, 'phone' => '6543210987', 'status' => 'Inactive']
            ];
        }
        foreach ($allStudents as $st) {
            if ((int)$st['class_id'] === $classId && ($st['status'] ?? 'Active') === 'Active' && !empty($st['phone'])) {
                $students[] = $st;
            }
        }
    } else {
        // Live database mode
        $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE school_id = :school_id AND class_id = :class_id AND schedule_date = :tomorrow AND status = 'Published'");
        $stmt->execute(['school_id' => $auth['school_id'], 'class_id' => $classId, 'tomorrow' => $tomorrow]);
        $schedule = $stmt->fetch();
        if (!$schedule) return jsonResponse($response, ['detail' => "Tomorrow's schedule is not published for this class."], 400);
        $schedule['subjects'] = json_decode($schedule['subjects'], true) ?: [];
        
        $classStmt = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id");
        $classStmt->execute(['id' => $classId]);
        $className = $classStmt->fetchColumn() ?: "Class " . $classId;
        
        $studStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id AND class_id = :class_id AND status = 'Active' AND phone IS NOT NULL AND phone != ''");
        $studStmt->execute(['school_id' => $auth['school_id'], 'class_id' => $classId]);
        $students = $studStmt->fetchAll();
    }
    
    if (empty($students)) {
        return jsonResponse($response, ['detail' => 'No active students with WhatsApp numbers found in this class.'], 400);
    }
    
    // Construct template subjects list
    $subjectsList = "";
    $numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    foreach ($schedule['subjects'] as $idx => $subObj) {
        $subName = is_array($subObj) ? $subObj['subject'] : $subObj;
        $teacherName = is_array($subObj) && isset($subObj['teacher_name']) ? $subObj['teacher_name'] : 'Unassigned';
        $emoji = isset($numberEmojis[$idx]) ? $numberEmojis[$idx] : ($idx + 1) . '️⃣';
        $subjectsList .= "$emoji $subName\n👨🏫 Teacher: $teacherName\n\n";
    }
    $subjectsList = rtrim($subjectsList);
    
    // Create logs
    $createdLogs = [];
    $dateSent = date('Y-m-d');
    
    if ($pdo === null) {
        // Save to mock_whatsapp_logs.json
        $logsFile = __DIR__ . '/../mock_whatsapp_logs.json';
        $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
        $nextId = count($logs) > 0 ? max(array_column($logs, 'id')) + 1 : 1;
        
        foreach ($students as $st) {
            $msg = "🏫 BN School\n\n📚 Tomorrow's Class Schedule\n\n👨🎓 Student: {$st['name']}\n🏫 Class: $className\n📅 Date: $formattedTomorrow\n\n📖 Subjects for Tomorrow:\n\n$subjectsList\n\n🎒 Please ensure your child carries the required books, notebooks and study materials for the above subjects.\n\nThank you,\nBN School Administration";
            
            $newLog = [
                'id' => $nextId++,
                'school_id' => $auth['school_id'],
                'student_id' => $st['id'],
                'student_name' => $st['name'],
                'class_id' => $classId,
                'recipient_number' => $st['phone'],
                'type' => 'Schedule',
                'message_content' => $msg,
                'date_sent' => $dateSent,
                'status' => 'Pending',
                'error_message' => null,
                'created_at' => date('Y-m-d H:i:s')
            ];
            $logs[] = $newLog;
            $createdLogs[] = $newLog;
        }
        file_put_contents($logsFile, json_encode($logs, JSON_PRETTY_PRINT));
    } else {
        // Save to live DB
        $ins = $pdo->prepare("
            INSERT INTO whatsapp_delivery_logs (school_id, student_id, student_name, class_id, recipient_number, type, message_content, date_sent, status)
            VALUES (:school_id, :student_id, :student_name, :class_id, :recipient_number, 'Schedule', :message_content, :date_sent, 'Pending')
        ");
        
        foreach ($students as $st) {
            $msg = "🏫 BN School\n\n📚 Tomorrow's Class Schedule\n\n👨🎓 Student: {$st['name']}\n🏫 Class: $className\n📅 Date: $formattedTomorrow\n\n📖 Subjects for Tomorrow:\n\n$subjectsList\n\n🎒 Please ensure your child carries the required books, notebooks and study materials for the above subjects.\n\nThank you,\nBN School Administration";
            
            $ins->execute([
                'school_id' => $auth['school_id'],
                'student_id' => $st['id'],
                'student_name' => $st['name'],
                'class_id' => $classId,
                'recipient_number' => $st['phone'],
                'message_content' => $msg,
                'date_sent' => $dateSent
            ]);
            
            $logId = $pdo->lastInsertId();
            $createdLogs[] = [
                'id' => $logId,
                'school_id' => $auth['school_id'],
                'student_id' => $st['id'],
                'student_name' => $st['name'],
                'class_id' => $classId,
                'recipient_number' => $st['phone'],
                'type' => 'Schedule',
                'message_content' => $msg,
                'date_sent' => $dateSent,
                'status' => 'Pending',
                'error_message' => null
            ];
        }
    }
    
    return jsonResponse($response, [
        'success' => true,
        'queue' => $createdLogs,
        'total' => count($createdLogs)
    ]);
});

// WhatsApp Reminders - Send single message from queue
$app->post('/api/schedules/whatsapp-reminders/send-single', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $logId = (int)($data['log_id'] ?? 0);
    if (!$logId) return jsonResponse($response, ['detail' => 'Log ID is required.'], 400);
    
    $pdo = null;
    try { $pdo = getDb(); } catch (\Exception $e) {}
    
    $logRecord = null;
    
    if ($pdo === null) {
        $logsFile = __DIR__ . '/../mock_whatsapp_logs.json';
        $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
        $foundIdx = -1;
        foreach ($logs as $idx => $lg) {
            if ((int)$lg['id'] === $logId && (int)$lg['school_id'] === (int)$auth['school_id']) {
                $foundIdx = $idx;
                $logRecord = $lg;
                break;
            }
        }
        
        if ($foundIdx === -1) return jsonResponse($response, ['detail' => 'Log record not found.'], 404);
        
        // Simulate WhatsApp Send
        $phone = $logRecord['recipient_number'];
        $status = 'Sent';
        $error = null;
        if (strlen($phone) < 10 || strpos($phone, '999') !== false) {
            $status = 'Failed';
            $error = 'Invalid destination phone number / WhatsApp template validation failed';
        }
        
        $logs[$foundIdx]['status'] = $status;
        $logs[$foundIdx]['error_message'] = $error;
        file_put_contents($logsFile, json_encode($logs, JSON_PRETTY_PRINT));
        $logRecord = $logs[$foundIdx];
    } else {
        $stmt = $pdo->prepare("SELECT * FROM whatsapp_delivery_logs WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $logId, 'school_id' => $auth['school_id']]);
        $logRecord = $stmt->fetch();
        
        if (!$logRecord) return jsonResponse($response, ['detail' => 'Log record not found.'], 404);
        
        // Live mode WhatsApp simulation
        $phone = $logRecord['recipient_number'];
        $status = 'Sent';
        $error = null;
        if (strlen($phone) < 10 || strpos($phone, '999') !== false) {
            $status = 'Failed';
            $error = 'Invalid destination phone number / WhatsApp template validation failed';
        }
        
        $up = $pdo->prepare("UPDATE whatsapp_delivery_logs SET status = :status, error_message = :error WHERE id = :id");
        $up->execute(['status' => $status, 'error' => $error, 'id' => $logId]);
        
        $logRecord['status'] = $status;
        $logRecord['error_message'] = $error;
    }
    
    return jsonResponse($response, [
        'success' => true,
        'log' => $logRecord
    ]);
});

// WhatsApp Reminders - Fetch logs history
$app->get('/api/schedules/whatsapp-reminders/history', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = null;
    try { $pdo = getDb(); } catch (\Exception $e) {}
    
    $results = [];
    if ($pdo === null) {
        $logsFile = __DIR__ . '/../mock_whatsapp_logs.json';
        $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
        $filtered = array_filter($logs, function ($lg) use ($auth) {
            return (int)$lg['school_id'] === (int)$auth['school_id'];
        });
        $results = array_values($filtered);
        usort($results, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });
    } else {
        $stmt = $pdo->prepare("SELECT * FROM whatsapp_delivery_logs WHERE school_id = :school_id ORDER BY created_at DESC");
        $stmt->execute(['school_id' => $auth['school_id']]);
        $results = $stmt->fetchAll();
    }
    
    return jsonResponse($response, $results);
});

// ==========================================
// 🎓 STUDENT PERFORMANCE MODULE ENDPOINTS
// ==========================================

// --- 1. Attendance Routes ---
$app->get('/api/attendance', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $classId = (int)($params['class_id'] ?? 0);
    $date = $params['date'] ?? date('Y-m-d');
    $ayId = (int)($params['academic_year_id'] ?? 0);
    $groupName = $params['group_name'] ?? 'all';
    
    if (!$classId || !$ayId) {
        return jsonResponse($response, ['detail' => 'class_id and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Fetch all active students in the class/section
    $sql = "SELECT id, name, roll_number, group_name FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id AND status = 'Active'";
    $execParams = [
        'school_id' => $auth['school_id'],
        'ay_id' => $ayId,
        'class_id' => $classId
    ];
    
    if ($groupName !== 'all' && $groupName !== '') {
        $sql .= " AND group_name = :group_name";
        $execParams['group_name'] = $groupName;
    }
    
    $sql .= " ORDER BY CAST(roll_number AS UNSIGNED) ASC, name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($execParams);
    $students = $stmt->fetchAll();
    
    // Fetch marked attendance for these students on that date
    $attStmt = $pdo->prepare("SELECT student_id, status FROM student_attendance WHERE school_id = :school_id AND class_id = :class_id AND attendance_date = :attendance_date");
    $attStmt->execute([
        'school_id' => $auth['school_id'],
        'class_id' => $classId,
        'attendance_date' => $date
    ]);
    $attendanceRows = $attStmt->fetchAll();
    $attendanceMap = [];
    foreach ($attendanceRows as $row) {
        $attendanceMap[(int)$row['student_id']] = $row['status'];
    }
    
    // Merge
    $result = [];
    foreach ($students as $student) {
        $result[] = [
            'id' => (int)$student['id'],
            'name' => $student['name'],
            'roll_number' => $student['roll_number'],
            'group_name' => $student['group_name'],
            'status' => $attendanceMap[(int)$student['id']] ?? null
        ];
    }
    
    return jsonResponse($response, $result);
});

$app->post('/api/attendance/bulk', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $classId = (int)($data['class_id'] ?? 0);
    $ayId = (int)($data['academic_year_id'] ?? 0);
    $date = $data['date'] ?? date('Y-m-d');
    $studentsList = $data['students'] ?? [];
    
    if (!$classId || !$ayId || empty($studentsList)) {
        return jsonResponse($response, ['detail' => 'class_id, academic_year_id, and students list are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Class Teacher Authorization Check
    $allowedClasses = getAuthorizedClassrooms($pdo, $auth);
    if ($allowedClasses !== null && !in_array($classId, $allowedClasses)) {
        return jsonResponse($response, ['detail' => 'Access Denied: You are not authorized for this class.'], 403);
    }
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO student_attendance (school_id, academic_year_id, class_id, student_id, attendance_date, status) 
                               VALUES (:school_id, :ay_id, :class_id, :student_id, :attendance_date, :status)
                               ON DUPLICATE KEY UPDATE status = VALUES(status)");
                               
        foreach ($studentsList as $item) {
            $studentId = (int)$item['student_id'];
            $status = $item['status']; // Present, Absent, Leave
            if (in_array($status, ['Present', 'Absent', 'Leave'])) {
                $stmt->execute([
                    'school_id' => $auth['school_id'],
                    'ay_id' => $ayId,
                    'class_id' => $classId,
                    'student_id' => $studentId,
                    'attendance_date' => $date,
                    'status' => $status
                ]);
            }
        }
        $pdo->commit();

        // Process Consecutive Absence Alerts
        try {
            foreach ($studentsList as $item) {
                $studentId = (int)$item['student_id'];
                $status = $item['status'];
                
                if ($status === 'Absent' || $status === 'Leave') {
                    // Fetch marked history DESC
                    $streakStmt = $pdo->prepare("SELECT status FROM student_attendance 
                                                 WHERE student_id = :sid AND academic_year_id = :ayid 
                                                 ORDER BY attendance_date DESC");
                    $streakStmt->execute(['sid' => $studentId, 'ayid' => $ayId]);
                    $history = $streakStmt->fetchAll();
                    
                    $streak = 0;
                    $hasLeave = false;
                    foreach ($history as $h) {
                        if ($h['status'] === 'Absent' || $h['status'] === 'Leave') {
                            $streak++;
                            if ($h['status'] === 'Leave') {
                                $hasLeave = true;
                            }
                        } else {
                            break;
                        }
                    }
                    
                    if ($streak >= 2) {
                        $sStmt = $pdo->prepare("SELECT s.name as sname, c.name as cname FROM students s 
                                                JOIN classrooms c ON s.class_id = c.id 
                                                WHERE s.id = :sid LIMIT 1");
                        $sStmt->execute(['sid' => $studentId]);
                        $sInfo = $sStmt->fetch();
                        
                        $studentName = $sInfo['sname'] ?? 'Student';
                        $className = $sInfo['cname'] ?? 'Class';
                        
                        if ($hasLeave) {
                            $adminMsg = "Student $studentName ($className) has not attended school for $streak consecutive days.";
                            $parentMsg = "$studentName has not attended school for $streak consecutive days.";
                        } else {
                            $adminMsg = "Student $studentName ($className) has been absent for $streak consecutive days.";
                            $parentMsg = "$studentName has been absent for $streak consecutive days.";
                        }
                        
                        $title = "Consecutive Absence Alert";
                        
                        // Prevent duplicate alert logging for same student/streak count/date
                        $chkAlert = $pdo->prepare("SELECT COUNT(*) FROM notifications 
                                                   WHERE school_id = :sid 
                                                     AND target_class_id = :cid 
                                                     AND title = :title 
                                                     AND content = :content 
                                                     AND DATE(created_at) = CURRENT_DATE()");
                        $chkAlert->execute([
                            'sid' => $auth['school_id'],
                            'cid' => $classId,
                            'title' => $title,
                            'content' => $adminMsg
                        ]);
                        
                        if ($chkAlert->fetchColumn() == 0) {
                            // Class notification
                            $insAdmin = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, target_class_id) 
                                                       VALUES (:sid, :title, :content, 'Absence Alert', NOW(), 0, :cid)");
                            $insAdmin->execute([
                                'sid' => $auth['school_id'],
                                'title' => $title,
                                'content' => $adminMsg,
                                'cid' => $classId
                            ]);
                            
                            // Parent notifications
                            $pStmt = $pdo->prepare("SELECT parent_user_id FROM parent_student_mappings WHERE student_id = :sid");
                            $pStmt->execute(['sid' => $studentId]);
                            $pids = $pStmt->fetchAll(PDO::FETCH_COLUMN);
                            
                            foreach ($pids as $puid) {
                                $insParent = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, timestamp, is_read, target_user_id) 
                                                           VALUES (:sid, :title, :content, 'Absence Alert', NOW(), 0, :puid)");
                                $insParent->execute([
                                    'sid' => $auth['school_id'],
                                    'title' => $title,
                                    'content' => $parentMsg,
                                    'puid' => $puid
                                ]);
                            }
                        }
                    }
                }
            }
        } catch (\Exception $streakEx) {
            error_log("Failed consecutive absence monitoring: " . $streakEx->getMessage());
        }

        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Failed to save attendance: ' . $e->getMessage()], 500);
    }
});

$app->get('/api/attendance/analytics/student/{student_id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['student_id'];
    $params = $request->getQueryParams();
    $ayId = (int)($params['academic_year_id'] ?? 0);
    
    if (!$ayId) {
        return jsonResponse($response, ['detail' => 'academic_year_id is required.'], 400);
    }
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM student_attendance 
                           WHERE school_id = :school_id AND student_id = :student_id AND academic_year_id = :ay_id 
                           GROUP BY status");
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'student_id' => $studentId,
        'ay_id' => $ayId
    ]);
    $rows = $stmt->fetchAll();
    
    $counts = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
    $total = 0;
    foreach ($rows as $row) {
        $counts[$row['status']] = (int)$row['count'];
        $total += (int)$row['count'];
    }
    
    $percentage = 0;
    if ($total > 0) {
        $percentage = round(($counts['Present'] / $total) * 100, 1);
    }
    
    return jsonResponse($response, [
        'present' => $counts['Present'],
        'absent' => $counts['Absent'],
        'leave' => $counts['Leave'],
        'total' => $total,
        'percentage' => $percentage
    ]);
});

$app->get('/api/attendance/report/monthly', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $classId = (int)($params['class_id'] ?? 0);
    $ayId = (int)($params['academic_year_id'] ?? 0);
    $groupName = $params['group_name'] ?? 'all';
    $month = $params['month'] ?? date('Y-m'); // format YYYY-MM
    
    if (!$classId || !$ayId) {
        return jsonResponse($response, ['detail' => 'class_id and academic_year_id are required.'], 400);
    }
    
    $pdo = getDb();
    
    // Fetch all active students
    $sql = "SELECT id, name, roll_number, group_name FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id AND status = 'Active'";
    $execParams = [
        'school_id' => $auth['school_id'],
        'ay_id' => $ayId,
        'class_id' => $classId
    ];
    if ($groupName !== 'all' && $groupName !== '') {
        $sql .= " AND group_name = :group_name";
        $execParams['group_name'] = $groupName;
    }
    $sql .= " ORDER BY CAST(roll_number AS UNSIGNED) ASC, name ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($execParams);
    $students = $stmt->fetchAll();
    
    // Aggregate attendance counts for the month
    $monthStart = $month . '-01';
    $monthEnd = date('Y-m-t', strtotime($monthStart));
    
    $attStmt = $pdo->prepare("SELECT student_id, status, COUNT(*) as count 
                              FROM student_attendance 
                              WHERE school_id = :school_id AND class_id = :class_id AND attendance_date BETWEEN :start AND :end
                              GROUP BY student_id, status");
    $attStmt->execute([
        'school_id' => $auth['school_id'],
        'class_id' => $classId,
        'start' => $monthStart,
        'end' => $monthEnd
    ]);
    $attData = $attStmt->fetchAll();
    
    $studentMap = [];
    foreach ($attData as $row) {
        $sid = (int)$row['student_id'];
        if (!isset($studentMap[$sid])) {
            $studentMap[$sid] = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
        }
        $studentMap[$sid][$row['status']] = (int)$row['count'];
    }
    
    $result = [];
    foreach ($students as $student) {
        $sid = (int)$student['id'];
        $counts = $studentMap[$sid] ?? ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
        $total = $counts['Present'] + $counts['Absent'] + $counts['Leave'];
        $pct = $total > 0 ? round(($counts['Present'] / $total) * 100, 1) : 0;
        
        $result[] = [
            'id' => $sid,
            'name' => $student['name'],
            'roll_number' => $student['roll_number'],
            'group_name' => $student['group_name'],
            'present' => $counts['Present'],
            'absent' => $counts['Absent'],
            'leave' => $counts['Leave'],
            'percentage' => $pct
        ];
    }
    
    return jsonResponse($response, $result);
});


// --- 2. Examinations Routes ---
$app->get('/api/exams', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $params = $request->getQueryParams();
    $ayId = (int)($params['academic_year_id'] ?? 0);
    $classId = (int)($params['class_id'] ?? 0);
    
    if (!$ayId) {
        return jsonResponse($response, ['detail' => 'academic_year_id is required.'], 400);
    }
    
    $pdo = getDb();
    
    $sql = "SELECT e.*, c.name as class_name FROM exams e JOIN classrooms c ON e.class_id = c.id WHERE e.school_id = :school_id AND e.academic_year_id = :ay_id";
    $execParams = ['school_id' => $auth['school_id'], 'ay_id' => $ayId];
    
    if ($classId > 0) {
        $sql .= " AND e.class_id = :class_id";
        $execParams['class_id'] = $classId;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($execParams);
    $exams = $stmt->fetchAll();
    
    foreach ($exams as &$exam) {
        $exam['id'] = (int)$exam['id'];
        $exam['academic_year_id'] = (int)$exam['academic_year_id'];
        $exam['class_id'] = (int)$exam['class_id'];
        
        // Load subjects
        $subStmt = $pdo->prepare("SELECT subject_name, max_marks FROM exam_subjects WHERE exam_id = :exam_id");
        $subStmt->execute(['exam_id' => $exam['id']]);
        $exam['subjects'] = $subStmt->fetchAll();
    }
    unset($exam);
    
    return jsonResponse($response, $exams);
});

$app->post('/api/exams', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $name = trim($data['name'] ?? '');
    $ayId = (int)($data['academic_year_id'] ?? 0);
    $classId = (int)($data['class_id'] ?? 0);
    $groupName = trim($data['group_name'] ?? '');
    $startDate = $data['start_date'] ?? null;
    $endDate = $data['end_date'] ?? null;
    $subjects = $data['subjects'] ?? [];
    
    if (empty($name) || !$ayId || !$classId || empty($subjects)) {
        return jsonResponse($response, ['detail' => 'Exam Name, Class, Academic Year, and Subjects are required.'], 400);
    }
    
    $pdo = getDb();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO exams (school_id, academic_year_id, class_id, group_name, name, start_date, end_date) 
                               VALUES (:school_id, :ay_id, :class_id, :group_name, :name, :start_date, :end_date)");
        $stmt->execute([
            'school_id' => $auth['school_id'],
            'ay_id' => $ayId,
            'class_id' => $classId,
            'group_name' => $groupName ?: null,
            'name' => $name,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);
        $examId = (int)$pdo->lastInsertId();
        
        $subStmt = $pdo->prepare("INSERT INTO exam_subjects (exam_id, subject_name, max_marks) VALUES (:exam_id, :sub_name, :max_m)");
        foreach ($subjects as $sub) {
            $subName = trim($sub['subject_name'] ?? '');
            $maxMarks = (int)($sub['max_marks'] ?? 100);
            if (!empty($subName)) {
                $subStmt->execute([
                    'exam_id' => $examId,
                    'sub_name' => $subName,
                    'max_m' => $maxMarks
                ]);
            }
        }
        
        $pdo->commit();
        return jsonResponse($response, ['success' => true, 'exam_id' => $examId]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Failed to create exam: ' . $e->getMessage()], 500);
    }
});

$app->delete('/api/exams/{id}', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $examId = (int)$args['id'];
    $pdo = getDb();
    
    $stmt = $pdo->prepare("DELETE FROM exams WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $examId, 'school_id' => $auth['school_id']]);
    
    return jsonResponse($response, ['success' => true]);
});

$app->get('/api/exams/{exam_id}/marks', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $examId = (int)$args['exam_id'];
    $pdo = getDb();
    
    // Fetch exam info
    $stmt = $pdo->prepare("SELECT * FROM exams WHERE id = :id AND school_id = :school_id");
    $stmt->execute(['id' => $examId, 'school_id' => $auth['school_id']]);
    $exam = $stmt->fetch();
    if (!$exam) return jsonResponse($response, ['detail' => 'Exam not found.'], 404);
    
    // Fetch students
    $sql = "SELECT id, name, roll_number, group_name FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id AND status = 'Active'";
    $execParams = [
        'school_id' => $auth['school_id'],
        'ay_id' => $exam['academic_year_id'],
        'class_id' => $exam['class_id']
    ];
    if ($exam['group_name']) {
        $sql .= " AND group_name = :group_name";
        $execParams['group_name'] = $exam['group_name'];
    }
    $sql .= " ORDER BY CAST(roll_number AS UNSIGNED) ASC, name ASC";
    
    $sStmt = $pdo->prepare($sql);
    $sStmt->execute($execParams);
    $students = $sStmt->fetchAll();
    
    // Fetch marks
    $mStmt = $pdo->prepare("SELECT student_id, subject_name, marks_obtained FROM exam_marks WHERE exam_id = :exam_id");
    $mStmt->execute(['exam_id' => $examId]);
    $marksRows = $mStmt->fetchAll();
    
    $marksMap = [];
    foreach ($marksRows as $row) {
        $sid = (int)$row['student_id'];
        $marksMap[$sid][$row['subject_name']] = (float)$row['marks_obtained'];
    }
    
    // Merge
    $result = [];
    foreach ($students as $student) {
        $sid = (int)$student['id'];
        $result[] = [
            'student_id' => $sid,
            'name' => $student['name'],
            'roll_number' => $student['roll_number'],
            'group_name' => $student['group_name'],
            'marks' => $marksMap[$sid] ?? new \stdClass()
        ];
    }
    
    return jsonResponse($response, $result);
});

$app->post('/api/exams/{exam_id}/marks', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $examId = (int)$args['exam_id'];
    $data = getJsonData($request);
    $marksList = $data['marks'] ?? [];
    
    if (empty($marksList)) {
        return jsonResponse($response, ['detail' => 'Marks data is required.'], 400);
    }
    
    $pdo = getDb();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO exam_marks (exam_id, student_id, subject_name, marks_obtained) 
                               VALUES (:exam_id, :student_id, :sub_name, :marks)
                               ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained)");
                               
        foreach ($marksList as $item) {
            $studentId = (int)$item['student_id'];
            $subName = trim($item['subject_name']);
            $marksObtained = (float)$item['marks_obtained'];
            if ($studentId && !empty($subName)) {
                $stmt->execute([
                    'exam_id' => $examId,
                    'student_id' => $studentId,
                    'sub_name' => $subName,
                    'marks' => $marksObtained
                ]);
            }
        }
        $pdo->commit();
        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Failed to save marks: ' . $e->getMessage()], 500);
    }
});


// --- 3. Signatures & Remarks Endpoints ---
$app->get('/api/school/signatures', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT * FROM school_signatures WHERE school_id = :school_id");
    $stmt->execute(['school_id' => $auth['school_id']]);
    $res = $stmt->fetch();
    if (!$res) {
        return jsonResponse($response, [
            'teacher_signature' => null,
            'class_teacher_signature' => null,
            'principal_signature' => null
        ]);
    }
    return jsonResponse($response, [
        'teacher_signature' => $res['teacher_signature'],
        'class_teacher_signature' => $res['class_teacher_signature'],
        'principal_signature' => $res['principal_signature']
    ]);
});

$app->post('/api/school/signatures', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $teacher = $data['teacher_signature'] ?? null;
    $classTeacher = $data['class_teacher_signature'] ?? null;
    $principal = $data['principal_signature'] ?? null;
    
    $pdo = getDb();
    $stmt = $pdo->prepare("INSERT INTO school_signatures (school_id, teacher_signature, class_teacher_signature, principal_signature) 
                           VALUES (:school_id, :teacher, :class_teacher, :principal)
                           ON DUPLICATE KEY UPDATE 
                            teacher_signature = COALESCE(:teacher_up, teacher_signature), 
                            class_teacher_signature = COALESCE(:class_teacher_up, class_teacher_signature), 
                            principal_signature = COALESCE(:principal_up, principal_signature)");
                            
    $stmt->execute([
        'school_id' => $auth['school_id'],
        'teacher' => $teacher,
        'class_teacher' => $classTeacher,
        'principal' => $principal,
        'teacher_up' => $teacher,
        'class_teacher_up' => $classTeacher,
        'principal_up' => $principal
    ]);
    
    return jsonResponse($response, ['success' => true]);
});

$app->get('/api/exams/{exam_id}/remarks', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $examId = (int)$args['exam_id'];
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT student_id, remarks FROM report_card_remarks WHERE school_id = :sid AND exam_id = :exam_id");
    $stmt->execute(['sid' => $auth['school_id'], 'exam_id' => $examId]);
    return jsonResponse($response, $stmt->fetchAll());
});

$app->post('/api/exams/{exam_id}/remarks', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $examId = (int)$args['exam_id'];
    $data = getJsonData($request);
    $remarksList = $data['remarks'] ?? [];
    
    if (empty($remarksList)) {
        return jsonResponse($response, ['detail' => 'Remarks data is required.'], 400);
    }
    
    $pdo = getDb();
    
    // We also need the academic year ID of the exam
    $exStmt = $pdo->prepare("SELECT academic_year_id FROM exams WHERE id = :id");
    $exStmt->execute(['id' => $examId]);
    $ayId = (int)$exStmt->fetchColumn();
    if (!$ayId) return jsonResponse($response, ['detail' => 'Exam not found.'], 404);
    
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO report_card_remarks (school_id, academic_year_id, exam_id, student_id, remarks) 
                               VALUES (:school_id, :ay_id, :exam_id, :student_id, :remarks)
                               ON DUPLICATE KEY UPDATE remarks = VALUES(remarks)");
                               
        foreach ($remarksList as $item) {
            $studentId = (int)$item['student_id'];
            $remarksText = trim($item['remarks'] ?? '');
            if ($studentId) {
                $stmt->execute([
                    'school_id' => $auth['school_id'],
                    'ay_id' => $ayId,
                    'exam_id' => $examId,
                    'student_id' => $studentId,
                    'remarks' => $remarksText
                ]);
            }
        }
        $pdo->commit();
        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Failed to save remarks: ' . $e->getMessage()], 500);
    }
});


// --- 4. Grading Scales Routes ---
$app->get('/api/school/grading-scales', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $pdo = getDb();
    $stmt = $pdo->prepare("SELECT grade_name, min_percentage, max_percentage FROM grading_scales WHERE school_id = :school_id ORDER BY min_percentage DESC");
    $stmt->execute(['school_id' => $auth['school_id']]);
    $scales = $stmt->fetchAll();
    
    if (empty($scales)) {
        // Return default scales
        return jsonResponse($response, [
            ['grade_name' => 'A+', 'min_percentage' => 90.00, 'max_percentage' => 100.00],
            ['grade_name' => 'A',  'min_percentage' => 80.00, 'max_percentage' => 89.99],
            ['grade_name' => 'B',  'min_percentage' => 70.00, 'max_percentage' => 79.99],
            ['grade_name' => 'C',  'min_percentage' => 60.00, 'max_percentage' => 69.99],
            ['grade_name' => 'D',  'min_percentage' => 40.00, 'max_percentage' => 59.99],
            ['grade_name' => 'F',  'min_percentage' => 0.00,  'max_percentage' => 39.99]
        ]);
    }
    
    foreach ($scales as &$s) {
        $s['min_percentage'] = (float)$s['min_percentage'];
        $s['max_percentage'] = (float)$s['max_percentage'];
    }
    unset($s);
    
    return jsonResponse($response, $scales);
});

$app->post('/api/school/grading-scales', function (Request $request, Response $response) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $data = getJsonData($request);
    $scales = $data['scales'] ?? [];
    
    if (empty($scales)) {
        return jsonResponse($response, ['detail' => 'Scales data is required.'], 400);
    }
    
    $pdo = getDb();
    $pdo->beginTransaction();
    try {
        // Delete old scales
        $del = $pdo->prepare("DELETE FROM grading_scales WHERE school_id = :school_id");
        $del->execute(['school_id' => $auth['school_id']]);
        
        $ins = $pdo->prepare("INSERT INTO grading_scales (school_id, grade_name, min_percentage, max_percentage) 
                              VALUES (:school_id, :grade_name, :min, :max)");
                              
        foreach ($scales as $s) {
            $grade = trim($s['grade_name'] ?? '');
            $min = (float)($s['min_percentage'] ?? 0);
            $max = (float)($s['max_percentage'] ?? 0);
            if (!empty($grade)) {
                $ins->execute([
                    'school_id' => $auth['school_id'],
                    'grade_name' => $grade,
                    'min' => $min,
                    'max' => $max
                ]);
            }
        }
        $pdo->commit();
        return jsonResponse($response, ['success' => true]);
    } catch (\Exception $e) {
        $pdo->rollBack();
        return jsonResponse($response, ['detail' => 'Failed to save grading scales: ' . $e->getMessage()], 500);
    }
});

$app->get('/api/students/{id}/performance-summary', function (Request $request, Response $response, array $args) {
    $auth = getAuthUser($request);
    if (!$auth || !$auth['school_id']) return jsonResponse($response, ['detail' => 'Unauthorized'], 401);
    
    $studentId = (int)$args['id'];
    $params = $request->getQueryParams();
    $ayId = (int)($params['academic_year_id'] ?? 0);
    
    if (!$ayId) {
        return jsonResponse($response, ['detail' => 'academic_year_id is required.'], 400);
    }
    
    $pdo = getDb();
    
    // 1. Fetch student info
    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = :id AND school_id = :sid");
    $stmt->execute(['id' => $studentId, 'sid' => $auth['school_id']]);
    $student = $stmt->fetch();
    if (!$student) return jsonResponse($response, ['detail' => 'Student not found.'], 404);
    
    // 2. Fetch attendance analytics
    $attStmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM student_attendance 
                           WHERE school_id = :school_id AND student_id = :student_id AND academic_year_id = :ay_id 
                           GROUP BY status");
    $attStmt->execute([
        'school_id' => $auth['school_id'],
        'student_id' => $studentId,
        'ay_id' => $ayId
    ]);
    $attRows = $attStmt->fetchAll();
    $counts = ['Present' => 0, 'Absent' => 0, 'Leave' => 0];
    $totalAtt = 0;
    foreach ($attRows as $row) {
        $counts[$row['status']] = (int)$row['count'];
        $totalAtt += (int)$row['count'];
    }
    $attPct = $totalAtt > 0 ? round(($counts['Present'] / $totalAtt) * 100, 1) : 0;
    
    // 3. Fetch exams and marks for the class
    $exStmt = $pdo->prepare("SELECT e.*, c.name as class_name FROM exams e JOIN classrooms c ON e.class_id = c.id WHERE e.school_id = :school_id AND e.academic_year_id = :ay_id AND e.class_id = :class_id");
    $exStmt->execute([
        'school_id' => $auth['school_id'],
        'ay_id' => $ayId,
        'class_id' => $student['class_id']
    ]);
    $exams = $exStmt->fetchAll();
    
    $examsData = [];
    foreach ($exams as $exam) {
        $examId = (int)$exam['id'];
        
        // Load subjects
        $subStmt = $pdo->prepare("SELECT subject_name, max_marks FROM exam_subjects WHERE exam_id = :exam_id");
        $subStmt->execute(['exam_id' => $examId]);
        $subjects = $subStmt->fetchAll();
        
        // Load marks obtained by this student
        $marksStmt = $pdo->prepare("SELECT subject_name, marks_obtained FROM exam_marks WHERE exam_id = :exam_id AND student_id = :student_id");
        $marksStmt->execute(['exam_id' => $examId, 'student_id' => $studentId]);
        $marksRows = $marksStmt->fetchAll();
        $marksMap = [];
        foreach ($marksRows as $row) {
            $marksMap[$row['subject_name']] = (float)$row['marks_obtained'];
        }
        
        // Calculate dynamic rank for this exam
        // Find all student marks in this exam to calculate rank
        $allMarksStmt = $pdo->prepare("SELECT student_id, SUM(marks_obtained) as total_marks 
                                       FROM exam_marks 
                                       WHERE exam_id = :exam_id 
                                       GROUP BY student_id 
                                       ORDER BY total_marks DESC");
        $allMarksStmt->execute(['exam_id' => $examId]);
        $allMarks = $allMarksStmt->fetchAll();
        
        $rank = '-';
        $rankIdx = 1;
        foreach ($allMarks as $m) {
            if ((int)$m['student_id'] === $studentId) {
                $rank = $rankIdx;
                break;
            }
            $rankIdx++;
        }
        
        // Load remark for this exam
        $remStmt = $pdo->prepare("SELECT remarks FROM report_card_remarks WHERE student_id = :student_id AND exam_id = :exam_id");
        $remStmt->execute(['student_id' => $studentId, 'exam_id' => $examId]);
        $remark = $remStmt->fetchColumn() ?: '';
        
        $examsData[] = [
            'id' => $examId,
            'name' => $exam['name'],
            'start_date' => $exam['start_date'],
            'end_date' => $exam['end_date'],
            'subjects' => $subjects,
            'marks' => $marksMap,
            'rank' => $rank,
            'remarks' => $remark
        ];
    }
    
    // 4. Fetch signatures
    $sigStmt = $pdo->prepare("SELECT * FROM school_signatures WHERE school_id = :school_id");
    $sigStmt->execute(['school_id' => $auth['school_id']]);
    $sigs = $sigStmt->fetch();
    $signaturesData = $sigs ? [
        'teacher_signature' => $sigs['teacher_signature'],
        'class_teacher_signature' => $sigs['class_teacher_signature'],
        'principal_signature' => $sigs['principal_signature']
    ] : [
        'teacher_signature' => null,
        'class_teacher_signature' => null,
        'principal_signature' => null
    ];
    
    // 5. Fetch grading scales
    $gsStmt = $pdo->prepare("SELECT grade_name, min_percentage, max_percentage FROM grading_scales WHERE school_id = :school_id ORDER BY min_percentage DESC");
    $gsStmt->execute(['school_id' => $auth['school_id']]);
    $scales = $gsStmt->fetchAll();
    if (empty($scales)) {
        $scales = [
            ['grade_name' => 'A+', 'min_percentage' => 90.00, 'max_percentage' => 100.00],
            ['grade_name' => 'A',  'min_percentage' => 80.00, 'max_percentage' => 89.99],
            ['grade_name' => 'B',  'min_percentage' => 70.00, 'max_percentage' => 79.99],
            ['grade_name' => 'C',  'min_percentage' => 60.00, 'max_percentage' => 69.99],
            ['grade_name' => 'D',  'min_percentage' => 40.00, 'max_percentage' => 59.99],
            ['grade_name' => 'F',  'min_percentage' => 0.00,  'max_percentage' => 39.99]
        ];
    } else {
        foreach ($scales as &$s) {
            $s['min_percentage'] = (float)$s['min_percentage'];
            $s['max_percentage'] = (float)$s['max_percentage'];
        }
        unset($s);
    }
    
    return jsonResponse($response, [
        'student_id' => $studentId,
        'name' => $student['name'],
        'roll_number' => $student['roll_number'],
        'class_id' => (int)$student['class_id'],
        'group_name' => $student['group_name'],
        'attendance' => [
            'present' => $counts['Present'],
            'absent' => $counts['Absent'],
            'leave' => $counts['Leave'],
            'total' => $totalAtt,
            'percentage' => $attPct
        ],
        'exams' => $examsData,
        'signatures' => $signaturesData,
        'grading_scales' => $scales
    ]);
});

// Run App
$app->run();
