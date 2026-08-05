<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/directory.php';

$states = get_directory_states();
$totalCount = get_directory_total_count();

$pageTitle       = 'CBSE Schools Directory — Browse by State';
$pageDescription = 'Browse CBSE-affiliated schools across India by state and city, with addresses and contact details for each.';
$pagePath        = '/schools';
$pageJsonLd = [[
    '@context' => 'https://schema.org',
    '@type' => 'BreadcrumbList',
    'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => SITE_URL . '/'],
        ['@type' => 'ListItem', 'position' => 2, 'name' => 'Explore Schools', 'item' => SITE_URL . '/schools'],
    ],
]];

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';

$perPage = 50;
$page = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;
$totalPages = (int) ceil($totalCount / $perPage);
$schools = get_directory_schools_paginated($perPage, $offset);
?>

<header class="hero page-hero">
  <div class="wrap hero-grid">
    <div>
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="<?php echo PAGE_BASE; ?>/">Home</a>
        <span class="bc-sep">/</span>
        <span class="bc-current">Explore Schools</span>
      </nav>
      <span class="tag">explore schools</span>
      <h1>Find a CBSE school, anywhere in India.</h1>
      <p class="hero-sub">A free directory of CBSE-affiliated schools by state and city — handy if you're a parent looking for a school, or a school looking to see how Shiksha Pilot could help run yours. <a href="<?php echo PAGE_BASE; ?>/contact">Get in touch</a> if that's you.</p>
    </div>
    <?php require __DIR__ . '/includes/directory-graphic.php'; ?>
  </div>
</header>

<section id="directory">
  <div class="wrap">
    <div class="directory-layout">
      <nav class="directory-sidebar" aria-label="Browse by state">
        <h3>Browse by State</h3>
        <ul>
          <?php foreach ($states as $s): ?>
            <li><a href="<?php echo PAGE_BASE; ?>/schools-in-<?php echo htmlspecialchars($s['state_slug'], ENT_QUOTES); ?>"><?php echo htmlspecialchars(directory_display_name($s['state']), ENT_QUOTES); ?></a></li>
          <?php endforeach; ?>
        </ul>
      </nav>

      <div class="directory-main">
        <div class="directory-table-wrap">
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align:left; border-bottom: var(--outline) solid var(--ink);">
                <th style="padding:10px 8px;">School</th>
                <th style="padding:10px 8px;">City</th>
                <th style="padding:10px 8px;">State</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($schools as $sc): ?>
                <tr style="border-bottom: 1px solid #eee0c6;">
                  <td style="padding:10px 8px; font-weight:700; color:var(--ink);"><?php echo htmlspecialchars($sc['name'], ENT_QUOTES); ?></td>
                  <td style="padding:10px 8px;"><?php echo htmlspecialchars($sc['district'] ? directory_display_name($sc['district']) : '—', ENT_QUOTES); ?></td>
                  <td style="padding:10px 8px;"><?php echo htmlspecialchars(directory_display_name($sc['state']), ENT_QUOTES); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <div class="hero-ctas" style="justify-content:center; margin-top:24px;">
          <?php if ($page > 1): ?><a class="btn btn-white" href="?page=<?php echo $page - 1; ?>">&larr; Previous</a><?php endif; ?>
          <?php if ($page < $totalPages): ?><a class="btn btn-white" href="?page=<?php echo $page + 1; ?>">Next &rarr;</a><?php endif; ?>
        </div>
      </div>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
