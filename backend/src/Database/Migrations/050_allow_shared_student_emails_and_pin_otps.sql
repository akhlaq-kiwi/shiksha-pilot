-- Migration 050: Allow shared student emails (for siblings) and create app_lock_otps table
-- 1. Drop unique constraint on users.email if exists and replace with non-unique index
ALTER TABLE `users` DROP INDEX `uq_users_email`;
ALTER TABLE `users` ADD INDEX `idx_users_email` (`email`);

-- 2. Create app_lock_otps table for 4-digit PIN reset OTPs
CREATE TABLE IF NOT EXISTS `app_lock_otps` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `school_id` INT NULL,
    `user_id` INT NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `otp_code` VARCHAR(10) NOT NULL,
    `attempts` INT DEFAULT 0,
    `is_used` TINYINT(1) DEFAULT 0,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_alo_user` (`user_id`, `otp_code`, `is_used`, `expires_at`),
    INDEX `idx_alo_email` (`email`, `otp_code`, `is_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

