CREATE TABLE IF NOT EXISTS `academic_year_disabled_subjects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `academic_year_id` INT NOT NULL,
  `subject_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_ay_subject` (`academic_year_id`, `subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
