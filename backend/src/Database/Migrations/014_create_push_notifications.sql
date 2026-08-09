-- Migration 014: Firebase push notification support.
--
-- Three additions:
--   1. device_tokens        — FCM registration tokens, one row per install.
--   2. dashboard_notifications.category / event_key — lets a notification be
--      grouped and filtered by kind.
--   3. push_oauth_cache     — caches short-lived Google OAuth access token.

CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `school_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_role` VARCHAR(50) NOT NULL,
  `token` VARCHAR(700) NOT NULL,
  `platform` VARCHAR(20) DEFAULT 'android',
  `app_version` VARCHAR(30) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `last_seen_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_device_tokens_token` (`token`),
  KEY `idx_device_tokens_user` (`school_id`, `user_id`, `is_active`),
  KEY `idx_device_tokens_role` (`school_id`, `user_role`, `is_active`),
  CONSTRAINT `device_tokens_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `push_oauth_cache` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `access_token` TEXT NOT NULL,
  `expires_at` INT NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @dbname = DATABASE();
SET @tablename = "dashboard_notifications";

SET @columnname = "category";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  "DO 0",
  "ALTER TABLE dashboard_notifications ADD COLUMN category VARCHAR(40) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "event_key";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  "DO 0",
  "ALTER TABLE dashboard_notifications ADD COLUMN event_key VARCHAR(60) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
