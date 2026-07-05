-- Migration 034: Add report_card_remark column to schools table
ALTER TABLE schools
  ADD COLUMN report_card_remark TEXT NULL;
