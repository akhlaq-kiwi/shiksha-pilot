-- Migration 057: School Finance Settings Table

CREATE TABLE IF NOT EXISTS `school_finance_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `enable_due_restriction` TINYINT(1) NOT NULL DEFAULT 0,
    `max_allowed_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
    FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `school_year_settings` (`school_id`, `academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
