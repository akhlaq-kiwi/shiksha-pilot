-- Add portal_theme column to schools table
ALTER TABLE schools
    ADD COLUMN portal_theme VARCHAR(50) NOT NULL DEFAULT 'default';
