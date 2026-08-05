-- =====================================================================
-- Migration 006: school_directory table
--
-- Public, SEO-facing directory of CBSE-affiliated schools across India,
-- shown on the marketing website (website/schools.php,
-- website/schools-in.php) — NOT the same as the `schools` table, which is
-- actual Shiksha Pilot customers. Data source: CBSE's own affiliation
-- portal (cbseaff.nic.in), via a 2018 scrape published as
-- github.com/deedy/cbse_schools_data (CC BY-SA 4.0). CBSE-only, so this
-- is not a full national directory — labeled as such on the site.
--
-- "district" is used as the city-equivalent grouping (real city/town-level
-- data isn't present in the source dataset) — website copy calls this
-- "city" for readability, since "district" reads as bureaucratic to a
-- parent searching for a school.
--
-- Row data itself is seeded separately by school_directory_seeder.php
-- (invoked from migrate.php), not by this migration since 20k+ rows as
-- raw SQL INSERTs would make this file unreviewable. A CSV + PHP importer
-- matches the same pattern already used for vocabulary_words.
-- =====================================================================

CREATE TABLE IF NOT EXISTS school_directory (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    affiliation_no VARCHAR(20) NULL,
    state VARCHAR(100) NOT NULL,
    state_slug VARCHAR(120) NOT NULL,
    district VARCHAR(150) NULL,
    district_slug VARCHAR(150) NULL,
    address TEXT NULL,
    pincode VARCHAR(10) NULL,
    phone VARCHAR(100) NULL,
    email VARCHAR(255) NULL,
    website VARCHAR(255) NULL,
    level VARCHAR(50) NULL,
    board VARCHAR(20) NOT NULL DEFAULT 'CBSE',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_state_slug (state_slug),
    INDEX idx_district_slug (district_slug),
    INDEX idx_state_district (state_slug, district_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
