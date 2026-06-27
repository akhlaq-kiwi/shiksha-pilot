-- Migration 012: Seed development school admin data
INSERT INTO schools (id, name, subdomain, plan, status, contact_phone, contact_email)
SELECT 1, 'QA Test School', 'qa', 'Premium', 'ACTIVE', '9758632392', 'admin@shikshapilot.com'
WHERE NOT EXISTS (
    SELECT 1 FROM schools WHERE id = 1 OR subdomain = 'qa'
);

INSERT INTO users (phone, password, role, name, status, school_id, force_password_change)
SELECT '9758632392', '$2y$10$s7frITXcbrkZCFFo1uT24OIe31QY4OL2Q5xwqEamh9R7bEdMFbeMu', 'SCHOOL_ADMIN', 'School Admin', 'ACTIVE', 1, 0
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE phone = '9758632392'
);

INSERT INTO academic_years (school_id, name, start_date, end_date, is_current, status)
SELECT 1, '2025–2026', '2025-04-01', '2026-03-31', 1, 'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM academic_years WHERE school_id = 1 AND is_current = 1
);
