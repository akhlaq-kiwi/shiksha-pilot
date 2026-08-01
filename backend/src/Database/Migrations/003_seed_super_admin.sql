-- =====================================================================
-- Migration 003: Seed the platform Super Admin
--
-- Carried over unchanged from the previous migration 003. Guarded so it is a
-- no-op when the account already exists.
-- =====================================================================

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
