-- =====================================================================
-- Migration 018: early_access_requests table
--
-- Sign-ups from the "get early access" form on the public marketing site
-- (website/mobile-app.php), which writes directly into this same database
-- exactly as website_leads does. Surfaced to super admins at
-- /super-admin/early-access via GET/PATCH/DELETE /api/platform/early-access.
--
-- Google Play internal testing has no self-serve join: a person can only
-- install the app once their Google account is on the tester list in the
-- Play Console, which is a manual step. This table is the queue for that
-- step — `status` tracks whether someone has actually been added yet, since
-- there is nothing in Play to read that back from.
--
-- The email is UNIQUE so re-submitting the form is idempotent rather than
-- filling the queue with duplicates of the same keen person.
-- =====================================================================

CREATE TABLE IF NOT EXISTS early_access_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    name VARCHAR(150) NULL,
    school VARCHAR(190) NULL,
    -- PENDING  — signed up, not yet added to the Play tester list
    -- INVITED  — added in the Play Console, can install
    -- DECLINED — not being invited (spam, competitor, out of scope)
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes TEXT NULL,
    invited_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_early_access_email (email),
    KEY idx_early_access_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
