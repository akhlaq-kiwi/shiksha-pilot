<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/directory.php';

$slug = preg_replace('/[^a-z0-9-]/', '', strtolower($_GET['slug'] ?? ''));
$state = $slug !== '' ? find_directory_state($slug) : null;
$district = ($state === null && $slug !== '') ? find_directory_district($slug) : null;

if ($state === null && $district === null) {
    http_response_code(404);
    $pageTitle       = 'Page Not Found';
    $pageDescription = 'That state or city isn\'t in our school directory yet.';
    $pagePath        = '/schools-in-' . $slug;
    $pageRobots      = 'noindex, follow';
    require_once __DIR__ . '/includes/head.php';
    require_once __DIR__ . '/includes/header.php';
    ?>
    <section class="error-page">
      <div class="wrap">
        <span class="tag">not found</span>
        <h1 style="font-size: clamp(32px,6vw,56px);">No listings here yet.</h1>
        <p class="hero-sub" style="margin: 16px auto 32px; text-align:center;">We couldn't find that state or city in our school directory.</p>
        <div class="hero-ctas" style="justify-content:center;">
          <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/schools">Browse all states</a>
        </div>
      </div>
    </section>
    <?php
    require_once __DIR__ . '/includes/footer.php';
    exit;
}

$perPage = 50;
$page = max(1, (int) ($_GET['page'] ?? 1));
$offset = ($page - 1) * $perPage;
$allStates = get_directory_states();

if ($state !== null) {
    // ---------------- State page: sidebar lists cities in this state ----------------
    $stateName = directory_display_name($state['state']);
    $count = (int) $state['school_count'];
    $totalPages = (int) ceil($count / $perPage);
    $districts = get_directory_districts_for_state($state['state_slug']);
    $schools = get_directory_schools_by_state($state['state_slug'], $perPage, $offset);

    $pageTitle       = "CBSE Schools in {$stateName}";
    $pageDescription = directory_state_meta_description($stateName);
    $pagePath        = '/schools-in-' . $state['state_slug'];
    $pageJsonLd = [[
        '@context' => 'https://schema.org',
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => SITE_URL . '/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Explore Schools', 'item' => SITE_URL . '/schools'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $stateName, 'item' => SITE_URL . $pagePath],
        ],
    ]];

    require_once __DIR__ . '/includes/head.php';
    require_once __DIR__ . '/includes/header.php';
    ?>

    <header class="hero page-hero">
      <div class="wrap hero-grid">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="<?php echo PAGE_BASE; ?>/">Home</a>
            <span class="bc-sep">/</span>
            <a href="<?php echo PAGE_BASE; ?>/schools">Explore Schools</a>
            <span class="bc-sep">/</span>
            <span class="bc-current"><?php echo htmlspecialchars($stateName, ENT_QUOTES); ?></span>
          </nav>
          <span class="tag">browsing <?php echo htmlspecialchars($stateName, ENT_QUOTES); ?></span>
          <h1>Schools in <?php echo htmlspecialchars($stateName, ENT_QUOTES); ?></h1>
          <p class="hero-sub"><?php echo directory_state_description($stateName); ?></p>
        </div>
        <?php require __DIR__ . '/includes/directory-graphic.php'; ?>
      </div>
    </header>

    <section id="directory">
      <div class="wrap">
        <div class="directory-layout">
          <nav class="directory-sidebar" aria-label="Cities in <?php echo htmlspecialchars($stateName, ENT_QUOTES); ?>">
            <h3>Cities in <?php echo htmlspecialchars($stateName, ENT_QUOTES); ?></h3>
            <ul>
              <?php foreach ($districts as $d): ?>
                <li><a href="<?php echo PAGE_BASE; ?>/schools-in-<?php echo htmlspecialchars($d['district_slug'], ENT_QUOTES); ?>"><?php echo htmlspecialchars(directory_display_name($d['district']), ENT_QUOTES); ?></a></li>
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
                    <th style="padding:10px 8px;">Address</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($schools as $sc): ?>
                    <tr style="border-bottom: 1px solid #eee0c6;">
                      <td style="padding:10px 8px; font-weight:700; color:var(--ink);"><?php echo htmlspecialchars($sc['name'], ENT_QUOTES); ?></td>
                      <td style="padding:10px 8px;"><?php echo htmlspecialchars($sc['district'] ? directory_display_name($sc['district']) : '—', ENT_QUOTES); ?></td>
                      <td style="padding:10px 8px;"><?php echo htmlspecialchars($sc['address'] ?: '—', ENT_QUOTES); ?></td>
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

    <?php
} else {
    // ---------------- City page: sidebar lists all states (city is a leaf node) ----------------
    $cityName = directory_display_name($district['district']);
    $states = implode(', ', array_map('directory_display_name', explode(', ', $district['states'])));
    $count = (int) $district['school_count'];
    $totalPages = (int) ceil($count / $perPage);
    $schools = get_directory_schools_by_district($district['district_slug'], $perPage, $offset);

    $pageTitle       = "CBSE Schools in {$cityName}";
    $pageDescription = directory_district_meta_description($cityName);
    $pagePath        = '/schools-in-' . $district['district_slug'];
    $pageJsonLd = [[
        '@context' => 'https://schema.org',
        '@type' => 'BreadcrumbList',
        'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => SITE_URL . '/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Explore Schools', 'item' => SITE_URL . '/schools'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $cityName, 'item' => SITE_URL . $pagePath],
        ],
    ]];

    require_once __DIR__ . '/includes/head.php';
    require_once __DIR__ . '/includes/header.php';
    ?>

    <header class="hero page-hero">
      <div class="wrap hero-grid">
        <div>
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="<?php echo PAGE_BASE; ?>/">Home</a>
            <span class="bc-sep">/</span>
            <a href="<?php echo PAGE_BASE; ?>/schools">Explore Schools</a>
            <span class="bc-sep">/</span>
            <span class="bc-current"><?php echo htmlspecialchars($cityName, ENT_QUOTES); ?></span>
          </nav>
          <span class="tag">browsing <?php echo htmlspecialchars($cityName, ENT_QUOTES); ?></span>
          <h1>Schools in <?php echo htmlspecialchars($cityName, ENT_QUOTES); ?></h1>
          <p class="hero-sub"><?php echo directory_district_description($cityName, $states); ?></p>
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
              <?php foreach ($allStates as $s): ?>
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
                    <th style="padding:10px 8px;">State</th>
                    <th style="padding:10px 8px;">Address</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($schools as $sc): ?>
                    <tr style="border-bottom: 1px solid #eee0c6;">
                      <td style="padding:10px 8px; font-weight:700; color:var(--ink);"><?php echo htmlspecialchars($sc['name'], ENT_QUOTES); ?></td>
                      <td style="padding:10px 8px;"><?php echo htmlspecialchars(directory_display_name($sc['state']), ENT_QUOTES); ?></td>
                      <td style="padding:10px 8px;"><?php echo htmlspecialchars($sc['address'] ?: '—', ENT_QUOTES); ?></td>
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

    <?php
}

require_once __DIR__ . '/includes/footer.php';
