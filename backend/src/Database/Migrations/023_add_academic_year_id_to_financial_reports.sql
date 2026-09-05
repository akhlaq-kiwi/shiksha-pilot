-- Migration 023: Add academic_year_id column to financial_reports and backfill missing data

ALTER TABLE `financial_reports` ADD COLUMN `academic_year_id` INT(11) NULL DEFAULT NULL AFTER `school_id`;

UPDATE `financial_reports` fr
JOIN `academic_years` ay ON fr.school_id = ay.school_id 
  AND fr.from_date >= ay.start_date 
  AND fr.from_date <= ay.end_date
SET fr.academic_year_id = ay.id
WHERE fr.academic_year_id IS NULL;

UPDATE `additional_fee_payment_history` afph
JOIN `additional_fee_payments` afp ON afph.payment_id = afp.id
JOIN `students` s ON afp.student_id = s.id
SET afph.academic_year_id = s.academic_year_id
WHERE afph.academic_year_id IS NULL;
