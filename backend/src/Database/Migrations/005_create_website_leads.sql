-- =====================================================================
-- Migration 005: website_leads table
--
-- Stores demo requests submitted via the public marketing site's "Book a
-- Demo" form (website/contact.php), which writes directly into this same
-- database. Surfaced to super admins at /super-admin/website-leads via
-- GET/DELETE /api/platform/website-leads.
--
-- This table used to be created lazily by the website's own PHP
-- (CREATE TABLE IF NOT EXISTS in website/includes/db.php) — moved here so
-- schema creation goes through the same migration path as everything
-- else, and so the website's DB user no longer needs DDL privileges.
-- =====================================================================

CREATE TABLE IF NOT EXISTS website_leads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL,
    school VARCHAR(190) NOT NULL,
    phone VARCHAR(30) NULL,
    message TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
