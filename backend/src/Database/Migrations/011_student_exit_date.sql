-- Migration 011: Student Exit Date
-- Adds exit_date column to students table

ALTER TABLE students ADD COLUMN exit_date DATE NULL;
