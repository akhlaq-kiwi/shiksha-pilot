-- Migration 035: Add migration_status column to academic_years table
ALTER TABLE academic_years
  ADD COLUMN migration_status VARCHAR(50) NOT NULL DEFAULT 'Not Started';
