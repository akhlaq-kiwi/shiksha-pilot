-- Migration: 008_update_financial_reports_status_enum.sql
ALTER TABLE `financial_reports` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Hand Over';
