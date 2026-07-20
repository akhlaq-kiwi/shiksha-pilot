-- Migration 058: Add specific document restriction columns to school_finance_settings

ALTER TABLE `school_finance_settings` 
ADD COLUMN `restrict_admit_card` TINYINT(1) NOT NULL DEFAULT 1 AFTER `max_allowed_due`,
ADD COLUMN `restrict_exam_result` TINYINT(1) NOT NULL DEFAULT 1 AFTER `restrict_admit_card`;
