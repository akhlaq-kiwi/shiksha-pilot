-- Migration 056: Late Payment Penalty Config Table

CREATE TABLE IF NOT EXISTS `late_payment_penalty_configs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `percentage` DECIMAL(5,2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `school_year` (`school_id`, `academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
