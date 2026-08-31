-- Migration: 019_create_teacher_attendance_tables.sql

CREATE TABLE IF NOT EXISTS `teacher_attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `academic_year_id` INT NOT NULL,
  `staff_id` INT NOT NULL,
  `user_id` INT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('Present', 'Absent', 'Leave') NOT NULL DEFAULT 'Present',
  `entry_time` VARCHAR(20) NULL,
  `is_late` TINYINT(1) NOT NULL DEFAULT 0,
  `reach_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_teacher_daily_att` (`staff_id`, `academic_year_id`, `date`),
  KEY `idx_ta_school_date` (`school_id`, `date`),
  KEY `idx_ta_ay_date` (`academic_year_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_attendance_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `academic_year_id` INT NOT NULL,
  `entry_time` VARCHAR(20) NOT NULL DEFAULT '08:30 AM',
  `allowed_leaves` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_school_ay_teacher_settings` (`school_id`, `academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
