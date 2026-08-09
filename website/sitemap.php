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
<?php
// School directory: one URL per state, one per city/district — generated
// from the DB rather than a static list, since it changes if the dataset
// is ever refreshed.
foreach (get_directory_states() as $state):
?>
  <url>
    <loc><?php echo htmlspecialchars(SITE_URL . '/schools-in-' . $state['state_slug'], ENT_QUOTES); ?></loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
<?php endforeach; ?>
<?php
$seenDistricts = [];
foreach (get_directory_states() as $state):
    foreach (get_directory_districts_for_state($state['state_slug']) as $district):
        if (isset($seenDistricts[$district['district_slug']])) continue;
        $seenDistricts[$district['district_slug']] = true;
?>
  <url>
    <loc><?php echo htmlspecialchars(SITE_URL . '/schools-in-' . $district['district_slug'], ENT_QUOTES); ?></loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
<?php
    endforeach;
endforeach;
?>
</urlset>
