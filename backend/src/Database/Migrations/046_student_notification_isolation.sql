-- Migration 046: Student notification & announcement read state isolation
SET @dbname = DATABASE();

SET @stmt_idx = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'dashboard_notifications' AND INDEX_NAME = 'idx_dn_school_student_read') > 0,
  'DO 0',
  'ALTER TABLE dashboard_notifications ADD INDEX idx_dn_school_student_read (school_id, student_id, is_read)'
));
PREPARE s1 FROM @stmt_idx;
EXECUTE s1;
DEALLOCATE PREPARE s1;

CREATE TABLE IF NOT EXISTS notification_student_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NOT NULL,
  student_id INT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_notif_student (notification_id, student_id),
  KEY idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @stmt_ar_col = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'announcement_reads' AND COLUMN_NAME = 'student_id') > 0,
  'DO 0',
  'ALTER TABLE announcement_reads ADD COLUMN student_id INT NOT NULL DEFAULT 0 AFTER user_id'
));
PREPARE s2 FROM @stmt_ar_col;
EXECUTE s2;
DEALLOCATE PREPARE s2;

SET @stmt_ar_add_idx = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'announcement_reads' AND INDEX_NAME = 'unique_announcement_user_student') > 0,
  'DO 0',
  'ALTER TABLE announcement_reads ADD UNIQUE INDEX unique_announcement_user_student (announcement_id, user_id, student_id)'
));
PREPARE s3 FROM @stmt_ar_add_idx;
EXECUTE s3;
DEALLOCATE PREPARE s3;

SET @stmt_ar_drop_idx = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'announcement_reads' AND INDEX_NAME = 'unique_announcement_user') > 0,
  'ALTER TABLE announcement_reads DROP INDEX unique_announcement_user',
  'DO 0'
));
PREPARE s4 FROM @stmt_ar_drop_idx;
EXECUTE s4;
DEALLOCATE PREPARE s4;

