-- Migration 059: Annual Fee Module & Admission Fee Enhancement Schema
-- Adds admission_fee to students table

ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_fee DECIMAL(12,2) NULL DEFAULT NULL;
