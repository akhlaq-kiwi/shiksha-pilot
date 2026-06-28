-- Migration 014: Expand status enums for academic years and students
ALTER TABLE academic_years MODIFY COLUMN status ENUM('ACTIVE', 'Inactive', 'Archived') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE students MODIFY COLUMN status ENUM('ACTIVE', 'Inactive', 'Transferred', 'Alumni', 'Archived') NOT NULL DEFAULT 'ACTIVE';
