-- Migration 044: Add extended_count to fee_follow_ups table
ALTER TABLE `fee_follow_ups` ADD COLUMN `extended_count` INT NOT NULL DEFAULT 0;
