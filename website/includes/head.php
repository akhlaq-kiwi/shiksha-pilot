<?php
/**
 * <head> partial. Every page sets these BEFORE including this file:
 *   $pageTitle        (required) — without the site name suffix, added here
 *   $pageDescription  (required) — 120-160 chars, unique per page
 *   $pagePath         (required) — canonical path e.g. '/features'
 *   $pageJsonLd        (optional) — array of extra JSON-LD schema blocks
 *   $pageOgImage       (optional) — defaults to the site-wide OG image
 */
if (!defined('SITE_NAME')) { require_once __DIR__ . '/config.php'; }

$fullTitle   = $pageTitle . ' | ' . SITE_NAME;
$canonicalUrl = SITE_URL . $pagePath;
$ogImage     = isset($pageOgImage) ? $pageOgImage : ASSET_BASE . '/images/og-image.png';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo htmlspecialchars($fullTitle, ENT_QUOTES); ?></title>
<meta name="description" content="<?php echo htmlspecialchars($pageDescription, ENT_QUOTES); ?>">
<link rel="canonical" href="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES); ?>">
<meta name="robots" content="<?php echo isset($pageRobots) ? htmlspecialchars($pageRobots, ENT_QUOTES) : 'index, follow, max-image-preview:large'; ?>">
<meta name="theme-color" content="#fff8ea">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="<?php echo SITE_NAME; ?>">
<meta property="og:title" content="<?php echo htmlspecialchars($pageTitle, ENT_QUOTES); ?>">
<meta property="og:description" content="<?php echo htmlspecialchars($pageDescription, ENT_QUOTES); ?>">
<meta property="og:url" content="<?php echo htmlspecialchars($canonicalUrl, ENT_QUOTES); ?>">
<meta property="og:image" content="<?php echo htmlspecialchars($ogImage, ENT_QUOTES); ?>">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="<?php echo SITE_LOCALE; ?>">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="<?php echo SITE_TWITTER; ?>">
<meta name="twitter:title" content="<?php echo htmlspecialchars($pageTitle, ENT_QUOTES); ?>">
<meta name="twitter:description" content="<?php echo htmlspecialchars($pageDescription, ENT_QUOTES); ?>">
<meta name="twitter:image" content="<?php echo htmlspecialchars($ogImage, ENT_QUOTES); ?>">

<link rel="icon" href="<?php echo ASSET_BASE; ?>/images/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="<?php echo ASSET_BASE; ?>/images/favicon.svg">

<!--
  Self-hosted fonts, preloaded for the three faces actually used above the
  fold on every page: Baloo 800 (the h1/logo — the LCP text on most pages),
  Kalam 700 (the ".tag" eyebrow line every hero opens with), Nunito 400
  (hero-sub body copy). Other weights load on demand once the CSS below
  requests them — no need to front-load ones that aren't in the first paint.
-->
<link rel="preload" href="<?php echo ASSET_BASE; ?>/fonts/baloo2-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="<?php echo ASSET_BASE; ?>/fonts/kalam-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="<?php echo ASSET_BASE; ?>/fonts/nunito-400.woff2" as="font" type="font/woff2" crossorigin>

<!--
  Inlined rather than linked: the whole stylesheet is ~4.6KB, and as an
  external <link> it was a render-blocking request sitting in front of the
  font requests in the critical path. Inlining removes that hop entirely —
  worth more here than the cross-page caching an external file would give,
  given the file is this small.
-->
<style><?php echo file_get_contents(__DIR__ . '/../assets/css/style.css'); ?></style>

<?php
// Organization schema is site-wide; emitted on every page so any page can
// be the one a crawler lands on first.
$organizationSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'Organization',
    'name' => SITE_NAME,
    'url' => SITE_URL,
    'logo' => ASSET_BASE . '/images/favicon.svg',
    'description' => 'School management platform covering attendance, examinations, fee collection, timetables and leave requests for K-12 schools.',
];
echo '<script type="application/ld+json">' . json_encode($organizationSchema, JSON_UNESCAPED_SLASHES) . '</script>' . "\n";

if (!empty($pageJsonLd)) {
    foreach ($pageJsonLd as $schema) {
        echo '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
    }
}

// Google Analytics (GA4) — only loads when GA_MEASUREMENT_ID is actually
// set (production, once configured). Local/Docker dev never sends traffic.
if (GA_MEASUREMENT_ID !== ''):
    $gaId = htmlspecialchars(GA_MEASUREMENT_ID, ENT_QUOTES);
?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?php echo $gaId; ?>"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', '<?php echo $gaId; ?>');
</script>
<?php endif; ?>
</head>
<body>
