-- Migration 025: Add academic_year_id to fee_payments and category to additional_fee_types
ALTER TABLE fee_payments ADD COLUMN academic_year_id INT NULL DEFAULT NULL;
ALTER TABLE fee_payments ADD CONSTRAINT fk_fee_payments_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

-- Initialize academic_year_id for existing payments using the student's current academic year
UPDATE fee_payments fp JOIN students s ON fp.student_id = s.id SET fp.academic_year_id = s.academic_year_id WHERE fp.academic_year_id IS NULL;

-- Add category to additional_fee_types
ALTER TABLE additional_fee_types ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'User Defined';
