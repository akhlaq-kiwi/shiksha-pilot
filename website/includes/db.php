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
