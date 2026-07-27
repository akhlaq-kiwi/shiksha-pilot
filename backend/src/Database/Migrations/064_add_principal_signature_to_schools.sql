-- Migration 064: Add principal_signature_path to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS principal_signature_path VARCHAR(255) NULL AFTER logo_path;
