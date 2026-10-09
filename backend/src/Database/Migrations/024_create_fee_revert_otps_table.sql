-- Migration 024: Create fee_revert_otps table
CREATE TABLE IF NOT EXISTS `fee_revert_otps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `payment_type` ENUM('monthly', 'additional') NOT NULL,
  `payment_id` INT NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `attempts` INT DEFAULT 0,
  `is_used` TINYINT(1) DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lookup` (`school_id`, `user_id`, `payment_type`, `payment_id`, `is_used`),
  CONSTRAINT `fk_fee_revert_otps_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
