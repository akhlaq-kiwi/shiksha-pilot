-- Migration 023: Add logo_path column to schools table
ALTER TABLE schools ADD COLUMN logo_path VARCHAR(255) NULL DEFAULT NULL;
