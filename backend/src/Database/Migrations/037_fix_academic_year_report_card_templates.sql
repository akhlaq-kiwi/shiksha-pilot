-- 1. Backfill examinations.template_code for legacy exams based on name patterns
UPDATE `examinations`
SET `template_code` = 'cbse_classic'
WHERE (`template_code` IS NULL OR `template_code` = '')
  AND (`parent_id` IS NULL)
  AND (LOWER(`name`) LIKE '%first term%' OR LOWER(`name`) LIKE '%second term%');

UPDATE `examinations` e
JOIN `examinations` p ON e.`parent_id` = p.`id`
SET e.`template_code` = 'cbse_classic'
WHERE p.`template_code` = 'cbse_classic'
  AND (e.`template_code` IS NULL OR e.`template_code` = '');

UPDATE `examinations`
SET `template_code` = 'modern'
WHERE (`template_code` IS NULL OR `template_code` = '')
  AND (`parent_id` IS NULL)
  AND (LOWER(`name`) LIKE '%quarterly%' OR LOWER(`name`) LIKE '%half%' OR LOWER(`name`) LIKE '%annual%');

-- 2. Update academic_years.report_card_template_id based on examinations template_code in that academic year
UPDATE `academic_years` ay
JOIN `examinations` e ON e.`academic_year_id` = ay.`id`
JOIN `report_card_templates` rct ON LOWER(e.`template_code`) = LOWER(rct.`code`)
SET ay.`report_card_template_id` = rct.`id`
WHERE e.`template_code` IS NOT NULL AND e.`template_code` != '';

-- 3. Clean up any auto-seeded default exams from wrong template code in past academic years if 0 papers exist
DELETE e FROM `examinations` e
JOIN `academic_years` ay ON e.`academic_year_id` = ay.`id`
JOIN `report_card_templates` rct ON ay.`report_card_template_id` = rct.`id`
WHERE rct.`code` = 'cbse_classic'
  AND e.`template_code` = 'modern'
  AND (SELECT COUNT(*) FROM `examination_papers` ep WHERE ep.`exam_id` = e.`id`) = 0;

DELETE e FROM `examinations` e
JOIN `academic_years` ay ON e.`academic_year_id` = ay.`id`
JOIN `report_card_templates` rct ON ay.`report_card_template_id` = rct.`id`
WHERE rct.`code` = 'modern'
  AND e.`template_code` = 'cbse_classic'
  AND (SELECT COUNT(*) FROM `examination_papers` ep WHERE ep.`exam_id` = e.`id`) = 0;
