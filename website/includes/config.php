<?php
/**
 * Site-wide constants. Every other file reads from here — change the
 * domain, name, or social handles in exactly one place.
 */

// Detect scheme so local dev (http) and production (https) both resolve
// correctly without hardcoding a protocol. X-Forwarded-Proto is checked too:
// behind a TLS-terminating proxy $_SERVER['HTTPS'] is unset even on https.
$scheme = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
) ? 'https' : 'http';

define('SITE_NAME', 'Shiksha Pilot');
define('SITE_DOMAIN', 'www.shikshapilot.com');
define('SITE_URL', 'https://' . SITE_DOMAIN); // canonical/OG tags always use production https
define('SITE_TAGLINE', 'School-running, minus the paperwork');
define('SITE_LOCALE', 'en_IN');
define('SITE_TWITTER', '@shikshapilot');

// Local dev may not be on the production domain — ASSET_BASE/PAGE_BASE
// resolve relative to whatever host actually served the request, so
// stylesheets/scripts/links work under `php -S localhost:8000` too.
//
// Production is the exception: every internal link must be the canonical
// https://www URL. Deriving them from HTTP_HOST meant a page served on the
// apex host emitted a page full of links that each 301'd, which is what
// stalled crawling. Only a host carrying an explicit port (dev) keeps the
// request host; anything else gets pinned to SITE_URL.
$requestHost = $_SERVER['HTTP_HOST'] ?? SITE_DOMAIN;
$isLocalDev  = (bool) preg_match('/:[0-9]+$/', $requestHost);
$currentHost = $isLocalDev ? $scheme . '://' . $requestHost : SITE_URL;
define('ASSET_BASE', $currentHost . '/assets');
define('PAGE_BASE', $currentHost);

define('CONTACT_EMAIL', 'hello@shikshapilot.com');

// Play Store opt-in link for the Android app. This is currently an *internal
// testing* track: it only opens for Google accounts on the tester list, and
// everyone else sees "not available". Swap this for the public listing URL
// once the app is live, and the copy around the buttons can lose the
// early-access wording at the same time.
define('PLAY_APP_URL', 'https://play.google.com/apps/internaltest/4701142568490055991');
define('PLAY_APP_IS_TESTING', true);

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

// Google Tag Manager container ID (e.g. GTM-XXXXXXX). Empty by default —
// local/Docker dev never sends analytics traffic. Production gets a real
// value from the .env file above once one exists. GA4 itself is
// configured as a tag inside the GTM container (Tag Manager UI), not
// embedded directly here — GTM is just the delivery mechanism.
define('GTM_CONTAINER_ID', getenv('GTM_CONTAINER_ID') ?: '');

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
        ['path' => '/schools',      'label' => 'Explore Schools', 'file' => 'schools.php', 'priority' => '0.7', 'changefreq' => 'weekly'],
        ['path' => '/contact',      'label' => 'Book a Demo', 'file' => 'contact.php',    'priority' => '0.7', 'changefreq' => 'monthly'],
        ['path' => '/privacy-policy', 'label' => 'Privacy Policy', 'file' => 'privacy-policy.php', 'priority' => '0.3', 'changefreq' => 'yearly'],
        ['path' => '/terms',        'label' => 'Terms of Use', 'file' => 'terms.php',      'priority' => '0.3', 'changefreq' => 'yearly'],
        ['path' => '/delete-account', 'label' => 'Delete Account', 'file' => 'delete-account.php', 'priority' => '0.3', 'changefreq' => 'yearly'],
    ];
}
