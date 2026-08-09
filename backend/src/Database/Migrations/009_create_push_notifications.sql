-- Migration 009: Firebase push notification support.
--
-- Three additions:
--   1. device_tokens        — FCM registration tokens, one row per install.
--   2. dashboard_notifications.category / event_key — lets a notification be
--      grouped and filtered by kind rather than by matching substrings in the
--      title, which is what the app currently does.
--   3. push_oauth_cache     — caches the short-lived Google OAuth access token
--      used to call FCM, so we mint it once an hour instead of once per send
--      (an RS256 sign + an HTTPS round trip we'd otherwise repeat constantly).

CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `school_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `user_role` VARCHAR(50) NOT NULL,
  -- FCM registration tokens are ~163 chars today but the length is not
  -- contractual, so this is sized generously rather than exactly.
  `token` VARCHAR(700) NOT NULL,
  `platform` VARCHAR(20) DEFAULT 'android',
  `app_version` VARCHAR(30) DEFAULT NULL,
  -- Set when FCM tells us the token is dead (UNREGISTERED/INVALID_ARGUMENT).
  -- Kept rather than deleted so a device that reinstalls can be recognised.
  `is_active` TINYINT(1) DEFAULT 1,
  `last_seen_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- One row per token globally: the same physical device re-registering after
  -- a different user logs in must move, not duplicate.
  UNIQUE KEY `uniq_device_tokens_token` (`token`),
  KEY `idx_device_tokens_user` (`school_id`, `user_id`, `is_active`),
  KEY `idx_device_tokens_role` (`school_id`, `user_role`, `is_active`),
  CONSTRAINT `device_tokens_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `push_oauth_cache` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `access_token` TEXT NOT NULL,
  `expires_at` INT NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- category: stable group key (ACADEMIC / ATTENDANCE / FEES / LEAVE / ...).
-- event_key: stable per-event key (LEAVE_APPROVED, FEE_PAYMENT_RECORDED, ...).
-- Both nullable so the 19 existing insert sites keep working untouched while
-- they're migrated over one at a time.
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
