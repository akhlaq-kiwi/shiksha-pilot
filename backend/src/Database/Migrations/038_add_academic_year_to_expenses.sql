-- Migration 038: Add academic_year_id to school_expenses
ALTER TABLE `school_expenses` ADD COLUMN `academic_year_id` INT NULL DEFAULT NULL;
ALTER TABLE `school_expenses` ADD CONSTRAINT `fk_expenses_academic_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE SET NULL;

-- Initialize academic_year_id for existing expenses using the school's active academic year
UPDATE school_expenses se
JOIN academic_years ay ON se.school_id = ay.school_id AND ay.status = 'ACTIVE'
SET se.academic_year_id = ay.id
WHERE se.academic_year_id IS NULL;
