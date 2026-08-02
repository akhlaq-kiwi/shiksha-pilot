-- =====================================================================
-- Migration 004: Seed development data (QA school)
--
-- Carried over unchanged from the previous migrations 012 and 030: the QA
-- test school, its admin login, its first academic year, and the default
-- grade scale for that school. Every statement is guarded, so re-running is
-- a no-op and this is safe to leave in place on an existing database.
-- =====================================================================

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

INSERT IGNORE INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark) VALUES
(1, 91.00, 100.00, 'A+', 10, 'Outstanding'),
(1, 81.00, 90.00, 'A', 9, 'Excellent'),
(1, 71.00, 80.00, 'B+', 8, 'Very Good'),
(1, 61.00, 70.00, 'B', 7, 'Good'),
(1, 51.00, 60.00, 'C', 6, 'Average'),
(1, 41.00, 50.00, 'D', 5, 'Pass'),
(1, 0.00, 40.00, 'F', 0, 'Fail');
