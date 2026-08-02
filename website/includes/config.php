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
