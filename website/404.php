<?php
require_once __DIR__ . '/includes/config.php';
http_response_code(404);

$pageTitle       = 'Page Not Found';
$pageDescription = 'The page you\'re looking for doesn\'t exist — head back to the Shiksha Pilot homepage.';
$pagePath        = '/404';
$pageRobots      = 'noindex, follow';

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<section class="error-page">
  <div class="wrap">
    <span class="tag">wrong turn</span>
    <h1>404</h1>
    <p class="hero-sub" style="margin: 16px auto 32px; text-align:center;">That page doesn't exist — maybe it moved, or the link's a typo.</p>
    <div class="hero-ctas" style="justify-content:center;">
      <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/">Back to homepage</a>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
