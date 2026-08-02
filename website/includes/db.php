<?php
/**
 * PDO connection + website_leads storage. The table is created lazily
 * (CREATE TABLE IF NOT EXISTS) on first connection rather than via a
 * separate migration step — this site has no migration runner of its own,
 * and the cost of one idempotent DDL check per request is negligible for
 * a low-traffic contact form.
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

    $pdo->exec("CREATE TABLE IF NOT EXISTS website_leads (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(190) NOT NULL,
        school VARCHAR(190) NOT NULL,
        phone VARCHAR(30) NULL,
        message TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

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
