-- Migration 016: Add Draft status to academic_years table
ALTER TABLE academic_years MODIFY COLUMN status ENUM('ACTIVE', 'Inactive', 'Archived', 'Draft') NOT NULL DEFAULT 'Draft';
