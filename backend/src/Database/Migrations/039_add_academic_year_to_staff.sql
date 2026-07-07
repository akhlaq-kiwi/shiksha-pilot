-- Migration 039: Add academic_year_id to staff table
ALTER TABLE `staff` ADD COLUMN `academic_year_id` INT NULL DEFAULT NULL;
ALTER TABLE `staff` ADD CONSTRAINT `fk_staff_academic_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE SET NULL;

-- Initialize academic_year_id for existing staff members using the school's active academic year
UPDATE staff s
JOIN academic_years ay ON s.school_id = ay.school_id AND ay.status = 'ACTIVE'
SET s.academic_year_id = ay.id
WHERE s.academic_year_id IS NULL;
