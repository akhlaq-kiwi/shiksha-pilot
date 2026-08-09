<?php
require_once __DIR__ . '/includes/config.php';

$pageTitle       = 'Terms of Use';
$pageDescription = 'The terms that apply to using the Shiksha Pilot website — the school-management application itself has its own service agreement.';
$pagePath        = '/terms';

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap">
    <span class="tag">last updated <?php echo date('F Y'); ?></span>
    <h1>Terms of Use</h1>
    <p class="hero-sub">The ground rules for using this website.</p>
  </div>
</header>

<section>
  <div class="wrap content-block">
    <h2>What these terms cover</h2>
    <p>These terms apply to <?php echo SITE_DOMAIN; ?> — this marketing website, including the school directory and the "Book a Demo" form. If your school actually uses the Shiksha Pilot application, that's governed by a separate agreement between your school and us, not by this page.</p>

    <h2>Using this website</h2>
    <p>You're welcome to browse this site, use the school directory, and submit a demo request. Please don't try to scrape the site at a rate that disrupts it for other visitors, attempt to access parts of it you're not authorized to reach, or submit the demo form with false information as a way of testing or attacking it.</p>

    <h2>The school directory</h2>
    <p>The school listings on this site are sourced from CBSE's own affiliation records via a third-party dataset, not verified or updated by us in real time. Details like address, phone number or affiliation status may be out of date. If you notice something wrong about a listing, or you run a school that should be corrected or removed, email us and we'll look into it.</p>

    <h2>No guarantee of accuracy</h2>
    <p>We try to keep this site accurate, but it's provided "as is." We don't guarantee that every feature described here is available at every moment, that the site will be error-free, or that information on it (including directory listings) is complete or current.</p>

    <h2>Intellectual property</h2>
    <p>The Shiksha Pilot name, logo and the content we've written on this site are ours. The school directory data is used under its original Creative Commons Attribution-ShareAlike license — we don't claim ownership of that dataset itself.</p>

    <h2>Limitation of liability</h2>
    <p>To the extent permitted by law, we're not liable for damages arising from your use of this website, including reliance on directory information that turns out to be outdated or inaccurate.</p>

    <h2>Changes</h2>
    <p>We may update these terms as the site changes. We'll update the date at the top of this page when we do.</p>

    <h2>Contact</h2>
    <p>Questions about these terms: <a href="mailto:<?php echo CONTACT_EMAIL; ?>"><?php echo CONTACT_EMAIL; ?></a>.</p>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
