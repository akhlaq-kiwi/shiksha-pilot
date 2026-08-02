<?php
/**
 * Site-wide constants. Every other file reads from here — change the
 * domain, name, or social handles in exactly one place.
 */

// Detect scheme so local dev (http) and production (https) both resolve
// correctly without hardcoding a protocol.
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';

define('SITE_NAME', 'Shiksha Pilot');
define('SITE_DOMAIN', 'shikshapilot.com');
define('SITE_URL', 'https://' . SITE_DOMAIN); // canonical/OG tags always use production https
define('SITE_TAGLINE', 'School-running, minus the paperwork');
define('SITE_LOCALE', 'en_IN');
define('SITE_TWITTER', '@shikshapilot');

// Local dev may not be on the production domain — ASSET_BASE/PAGE_BASE
// resolve relative to whatever host actually served the request, so
// stylesheets/scripts/links work under `php -S localhost:8000` too.
$currentHost = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? SITE_DOMAIN);
define('ASSET_BASE', $currentHost . '/assets');
define('PAGE_BASE', $currentHost);

define('CONTACT_EMAIL', 'hello@shikshapilot.com');

/**
 * Database credentials. Local/Docker gets DB_HOST etc. directly from
 * docker-compose environment variables. Production has no equivalent
 * mechanism on shared hosting, so deploy-website.yml writes a real .env
 * file (gitignored, never committed) from GitHub Secrets at deploy time —
 * loaded here if present, same shiksha_pilot DB the backend app uses.
 */
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        if ($key !== '' && getenv($key) === false) {
            putenv("$key=$value");
        }
    }
}

define('DB_HOST', getenv('DB_HOST') ?: 'db');
define('DB_NAME', getenv('DB_NAME') ?: 'shiksha_pilot');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: 'admin123');

require_once __DIR__ . '/db.php';

/**
 * Central nav/sitemap model — one array both header.php and sitemap.php
 * read from, so adding a page never means updating two files.
 */
function site_pages() {
    return [
        ['path' => '/',             'label' => 'Home',       'file' => 'index.php',      'priority' => '1.0', 'changefreq' => 'weekly'],
        ['path' => '/features',     'label' => 'Features',   'file' => 'features.php',   'priority' => '0.9', 'changefreq' => 'monthly'],
        ['path' => '/mobile-app',   'label' => 'Mobile App',  'file' => 'mobile-app.php', 'priority' => '0.8', 'changefreq' => 'monthly'],
        ['path' => '/contact',      'label' => 'Book a Demo', 'file' => 'contact.php',    'priority' => '0.7', 'changefreq' => 'monthly'],
    ];
}
