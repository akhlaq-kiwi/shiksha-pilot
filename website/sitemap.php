<?php
/**
 * Generates sitemap.xml from the single site_pages() list in config.php —
 * add a page there and it appears here automatically, no separate file to
 * keep in sync. Served at /sitemap.xml via the rewrite rule in .htaccess.
 */
require_once __DIR__ . '/includes/config.php';

header('Content-Type: application/xml; charset=UTF-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach (site_pages() as $page): ?>
  <url>
    <loc><?php echo htmlspecialchars(SITE_URL . $page['path'], ENT_QUOTES); ?></loc>
    <changefreq><?php echo htmlspecialchars($page['changefreq'], ENT_QUOTES); ?></changefreq>
    <priority><?php echo htmlspecialchars($page['priority'], ENT_QUOTES); ?></priority>
  </url>
<?php endforeach; ?>
</urlset>
