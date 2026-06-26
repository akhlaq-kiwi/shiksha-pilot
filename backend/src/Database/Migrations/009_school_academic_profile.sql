-- Migration 009: Add school academic profile fields
ALTER TABLE schools
ADD COLUMN current_term VARCHAR(100) NULL,
ADD COLUMN term_start DATE NULL,
ADD COLUMN term_end DATE NULL,
ADD COLUMN classes_offered VARCHAR(100) NULL;
