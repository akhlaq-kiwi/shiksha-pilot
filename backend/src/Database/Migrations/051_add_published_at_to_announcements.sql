-- Migration 051: Add published_at column to announcements table
ALTER TABLE announcements ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL AFTER status;
UPDATE announcements SET published_at = created_at WHERE status = 'Published';
