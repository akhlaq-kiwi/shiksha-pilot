-- Migration 044: Account-level App Lock columns on users table
ALTER TABLE users ADD COLUMN app_lock_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN app_lock_pin_hash VARCHAR(255) NULL DEFAULT NULL;

