-- Migration 038: Ensure student_id column exists on dashboard_notifications table
SET @dbname = DATABASE();
SET @tablename = "dashboard_notifications";

SET @columnname = "student_id";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
  "DO 0",
  "ALTER TABLE dashboard_notifications ADD COLUMN student_id INT DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
