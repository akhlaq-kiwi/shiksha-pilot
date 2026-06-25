-- Migration 003: Seed default Super Admin
-- Inserts the platform Super Admin only if the phone does not already exist.

INSERT INTO users (phone, password, role, name, status)
SELECT
    '1000000001',
    '$2y$10$je4GEs7Q9zW47XvxQBaxw.fp0wsG8gc/SFYeRjjucXA.F3AOxxrYa',
    'SUPER_ADMIN',
    'Super Admin',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE phone = '1000000001'
);
