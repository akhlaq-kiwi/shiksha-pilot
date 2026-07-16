-- Migration 050: Add status column to announcements table
ALTER TABLE announcements
ADD COLUMN status ENUM('Draft', 'Published') NOT NULL DEFAULT 'Published';

ALTER TABLE announcements
MODIFY COLUMN status ENUM('Draft', 'Published') NOT NULL DEFAULT 'Draft';
