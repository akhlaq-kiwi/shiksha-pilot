-- Migration 008: Add school profile fields
ALTER TABLE schools
ADD COLUMN registration_no VARCHAR(255) NULL,
ADD COLUMN affiliation_board VARCHAR(255) NULL,
ADD COLUMN school_type VARCHAR(255) NULL,
ADD COLUMN founded_year VARCHAR(50) NULL,
ADD COLUMN medium_of_instruction VARCHAR(255) NULL,
ADD COLUMN street_address VARCHAR(255) NULL,
ADD COLUMN city VARCHAR(255) NULL,
ADD COLUMN state VARCHAR(255) NULL,
ADD COLUMN pin_code VARCHAR(50) NULL;
