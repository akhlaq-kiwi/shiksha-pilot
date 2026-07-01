-- Migration to add due_date column to additional_fee_types table if it doesn't exist
ALTER TABLE `additional_fee_types` ADD COLUMN `due_date` DATE NULL;
