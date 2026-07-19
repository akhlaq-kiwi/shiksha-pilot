-- Migration 053: Transport Fees Module

CREATE TABLE IF NOT EXISTS `student_transport_fees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `monthly_fee` DECIMAL(12,2) NOT NULL,
    `start_date` DATE NOT NULL,
    `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `school_student_ay` (`school_id`, `student_id`, `academic_year_id`)
);

ALTER TABLE `additional_fee_payments` ADD COLUMN `fee_month` VARCHAR(50) NULL DEFAULT NULL;
