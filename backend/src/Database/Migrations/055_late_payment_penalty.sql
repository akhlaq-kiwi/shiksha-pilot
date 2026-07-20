-- Migration 055: Late Payment Penalty Schema

CREATE TABLE IF NOT EXISTS `late_payment_penalty_applications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `percentage` DECIMAL(5,2) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `status` ENUM('Pending', 'Processing', 'Completed', 'Failed') NOT NULL DEFAULT 'Pending',
    `total_students` INT NOT NULL DEFAULT 0,
    `processed_students` INT NOT NULL DEFAULT 0,
    `successful_students` INT NOT NULL DEFAULT 0,
    `skipped_students` INT NOT NULL DEFAULT 0,
    `failed_students` INT NOT NULL DEFAULT 0,
    `total_penalty_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `time_taken` INT NOT NULL DEFAULT 0,
    `created_by` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `late_payment_penalty_records` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `application_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `status` ENUM('Pending', 'Skipped', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    `outstanding_due` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `penalty_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`application_id`) REFERENCES `late_payment_penalty_applications` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `app_student` (`application_id`, `student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `late_payment_penalty_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `student_name` VARCHAR(255) NOT NULL,
    `admission_no` VARCHAR(100) NULL,
    `class_name` VARCHAR(100) NULL,
    `section_name` VARCHAR(50) NULL,
    `outstanding_due` DECIMAL(12,2) NOT NULL,
    `penalty_percentage` DECIMAL(5,2) NOT NULL,
    `penalty_amount` DECIMAL(12,2) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `applied_by` INT NOT NULL,
    `applied_by_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE additional_fee_payments ADD COLUMN description VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE additional_fee_payments ADD COLUMN created_by_name VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE additional_fee_payments ADD COLUMN penalty_type VARCHAR(50) NULL DEFAULT NULL;
