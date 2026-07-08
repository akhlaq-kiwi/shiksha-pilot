-- Migration 041: Add features column to subscriptions table
ALTER TABLE `subscriptions` ADD COLUMN IF NOT EXISTS `features` TEXT NULL DEFAULT NULL;

-- Populate existing subscriptions with the description of their plan (if matched)
UPDATE subscriptions s
JOIN plans p ON s.plan_name = p.name COLLATE utf8mb4_unicode_ci
SET s.features = p.description
WHERE s.features IS NULL;
