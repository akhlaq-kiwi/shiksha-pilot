<?php
/**
 * PDO connection + website_leads storage. The table itself is created by
 * backend/src/Database/Migrations/005_create_website_leads.sql, run via
 * the backend's own migration runner (php api/src/Database/migrate.php,
 * invoked automatically by deploy-production.yml/deploy-qa.yml) — NOT by
 * this file. Keeping schema creation there means the website's DB user
 * only ever needs INSERT/SELECT/DELETE, never CREATE TABLE, and schema
 * changes go through one migration path instead of two.
 */

function get_db_connection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

/**
 * @param array{name:string,email:string,school:string,phone:string,message:string} $data
 * @throws PDOException on connection/insert failure — caller decides what
 *         the visitor sees; this never shows DB internals itself.
 */
function save_website_lead(array $data) {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'INSERT INTO website_leads (name, email, school, phone, message, ip_address, user_agent)
         VALUES (:name, :email, :school, :phone, :message, :ip_address, :user_agent)'
    );
    $stmt->execute([
        ':name'       => $data['name'],
        ':email'      => $data['email'],
        ':school'     => $data['school'],
        ':phone'      => $data['phone'] !== '' ? $data['phone'] : null,
        ':message'    => $data['message'] !== '' ? $data['message'] : null,
        ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
    ]);
}

/**
 * Record an early-access sign-up for the Android app.
 *
 * Idempotent on email: someone submitting twice updates their details rather
 * than adding a second row for an admin to wade through. A row already marked
 * INVITED keeps that status — re-submitting must not quietly send someone back
 * to the bottom of the queue.
 *
 * @param array{email:string,name:string,school:string} $data
 * @throws PDOException on connection/insert failure — the caller decides what
 *         the visitor sees.
 */
function save_early_access_request(array $data) {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'INSERT INTO early_access_requests (email, name, school, ip_address, user_agent)
         VALUES (:email, :name, :school, :ip_address, :user_agent)
         ON DUPLICATE KEY UPDATE
            name       = COALESCE(NULLIF(VALUES(name), \'\'), name),
            school     = COALESCE(NULLIF(VALUES(school), \'\'), school),
            updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        ':email'      => strtolower($data['email']),
        ':name'       => $data['name'] !== '' ? $data['name'] : null,
        ':school'     => $data['school'] !== '' ? $data['school'] : null,
        ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ':user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
    ]);
}

// ---------------------------------------------------------------------------
// School directory (public SEO pages: schools.php, schools-in.php).
// "district" in the table is shown to visitors as "city" — see
// backend/src/Database/Migrations/006_create_school_directory.sql for why.
// ---------------------------------------------------------------------------

/** All states with a school count, ordered by count desc (most schools first). */
function get_directory_states(): array {
    $pdo = get_db_connection();
    return $pdo->query(
        'SELECT state, state_slug, COUNT(*) AS school_count
         FROM school_directory
         GROUP BY state, state_slug
         ORDER BY school_count DESC'
    )->fetchAll();
}

/** Districts within one state, with a school count each. */
function get_directory_districts_for_state(string $stateSlug): array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT district, district_slug, COUNT(*) AS school_count
         FROM school_directory
         WHERE state_slug = :state_slug AND district_slug IS NOT NULL
         GROUP BY district, district_slug
         ORDER BY school_count DESC'
    );
    $stmt->execute([':state_slug' => $stateSlug]);
    return $stmt->fetchAll();
}

function find_directory_state(string $slug): ?array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT state, state_slug, COUNT(*) AS school_count
         FROM school_directory WHERE state_slug = :slug
         GROUP BY state, state_slug'
    );
    $stmt->execute([':slug' => $slug]);
    $row = $stmt->fetch();
    return $row !== false ? $row : null;
}

/**
 * A district slug can belong to more than one state in the source data
 * (e.g. "Hyderabad" logged under both Andhra Pradesh and Telangana —
 * pre-2014 records never updated after the state split). Aggregated
 * across all matching states rather than picking one arbitrarily.
 */
function find_directory_district(string $slug): ?array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT district, district_slug, COUNT(*) AS school_count,
                GROUP_CONCAT(DISTINCT state ORDER BY state SEPARATOR ", ") AS states
         FROM school_directory WHERE district_slug = :slug
         GROUP BY district, district_slug'
    );
    $stmt->execute([':slug' => $slug]);
    $row = $stmt->fetch();
    return $row !== false ? $row : null;
}

function get_directory_schools_by_state(string $stateSlug, int $limit = 200, int $offset = 0): array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT name, district, address, pincode, website FROM school_directory
         WHERE state_slug = :slug ORDER BY name LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':slug', $stateSlug);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function get_directory_schools_by_district(string $districtSlug, int $limit = 200, int $offset = 0): array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT name, state, district, address, pincode, website FROM school_directory
         WHERE district_slug = :slug ORDER BY name LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':slug', $districtSlug);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function get_directory_total_count(): int {
    $pdo = get_db_connection();
    return (int) $pdo->query('SELECT COUNT(*) FROM school_directory')->fetchColumn();
}

function get_directory_schools_paginated(int $limit, int $offset): array {
    $pdo = get_db_connection();
    $stmt = $pdo->prepare(
        'SELECT name, state, district FROM school_directory
         ORDER BY name LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}
