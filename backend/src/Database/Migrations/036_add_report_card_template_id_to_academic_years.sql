-- Add report_card_template_id to academic_years table for academic year template isolation
ALTER TABLE `academic_years` ADD COLUMN `report_card_template_id` INT(11) NULL DEFAULT NULL AFTER `school_id`;

-- Pre-populate academic_years.report_card_template_id from examinations template_code if existing
UPDATE `academic_years` ay
JOIN `examinations` e ON e.academic_year_id = ay.id
JOIN `report_card_templates` rct ON LOWER(e.template_code) = LOWER(rct.code)
SET ay.`report_card_template_id` = rct.`id`
WHERE ay.`report_card_template_id` IS NULL AND e.`template_code` IS NOT NULL AND e.`template_code` != '';

-- Pre-populate remaining academic_years.report_card_template_id from schools.report_card_template_id
UPDATE `academic_years` ay
JOIN `schools` s ON ay.school_id = s.id
SET ay.`report_card_template_id` = s.`report_card_template_id`
WHERE ay.`report_card_template_id` IS NULL AND s.`report_card_template_id` IS NOT NULL;
