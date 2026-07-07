-- Migration 040: Add email and plain_password to users table
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `users` ADD COLUMN `email` VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `plain_password` VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE `users` ADD UNIQUE KEY `uq_users_email` (`email`);

-- Initialize existing School Admin credentials using their school's contact email and default password
UPDATE users u
JOIN schools s ON u.school_id = s.id
SET u.email = s.contact_email, u.plain_password = 'changeme123'
WHERE u.role = 'SCHOOL_ADMIN';

SET FOREIGN_KEY_CHECKS = 1;
