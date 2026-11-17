-- Migration 051: Create admission_fee_configurations table for academic-year-level Admission Fee configuration
CREATE TABLE IF NOT EXISTS `admission_fee_configurations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NOT NULL,
    `academic_year_id` INT NOT NULL,
    `apply_type` ENUM('school', 'classes') NOT NULL DEFAULT 'school',
    `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `class_amounts` JSON NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_afc_school_ay` (`school_id`, `academic_year_id`),
    INDEX `idx_afc_school` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

