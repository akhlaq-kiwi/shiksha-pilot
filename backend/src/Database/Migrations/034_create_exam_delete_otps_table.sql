-- Migration 034: Create exam_delete_otps table
CREATE TABLE IF NOT EXISTS `exam_delete_otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `exam_id` INT NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `attempts` INT DEFAULT 0,
  `is_used` TINYINT(1) DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_exam_otp_lookup` (`school_id`, `user_id`, `exam_id`, `is_used`),
  CONSTRAINT `fk_exam_delete_otps_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
