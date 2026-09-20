-- Migration 035: Add template_code to examinations table to isolate exams per report card template
ALTER TABLE `examinations` ADD COLUMN `template_code` VARCHAR(50) NULL AFTER `academic_year_id`;
CREATE INDEX `idx_exam_template` ON `examinations` (`school_id`, `academic_year_id`, `template_code`);
