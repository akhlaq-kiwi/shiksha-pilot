-- Migration 060: Student Category for First Academic Year Classification
-- Adds student_category column to students table

ALTER TABLE students ADD COLUMN IF NOT EXISTS student_category VARCHAR(50) NULL DEFAULT NULL AFTER admission_fee;
