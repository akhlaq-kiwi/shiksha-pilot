-- Migration 054: Add scheme and admit card publish status columns
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE examination_class_status 
ADD COLUMN scheme_published TINYINT(1) DEFAULT 0 AFTER status,
ADD COLUMN admit_card_published TINYINT(1) DEFAULT 0 AFTER scheme_published;

SET FOREIGN_KEY_CHECKS = 1;
