-- Migration 045: Ensure audio_url and audio_duration columns exist on announcements table
SET @dbname = DATABASE();
SET @tablename = 'announcements';

SET @columnname = 'audio_url';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'DO 0',
  'ALTER TABLE announcements ADD COLUMN audio_url VARCHAR(500) NULL DEFAULT NULL AFTER description'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'audio_duration';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  'DO 0',
  'ALTER TABLE announcements ADD COLUMN audio_duration INT NULL DEFAULT NULL AFTER audio_url'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

