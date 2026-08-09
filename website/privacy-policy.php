<?php
require_once __DIR__ . '/includes/config.php';

$pageTitle       = 'Privacy Policy';
$pageDescription = 'How Shiksha Pilot collects, uses and protects the information you share with us through this website.';
$pagePath        = '/privacy-policy';

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap">
    <span class="tag">last updated <?php echo date('F Y'); ?></span>
    <h1>Privacy Policy</h1>
    <p class="hero-sub">What we collect on this website, why, and what we do with it.</p>
  </div>
</header>

<section>
  <div class="wrap content-block">
    <h2>What this policy covers</h2>
    <p>This policy covers <?php echo SITE_DOMAIN; ?>, the public marketing website for Shiksha Pilot. It does not cover the Shiksha Pilot school-management application itself, which schools use under their own agreement with us — that data is governed separately, since it includes information about students and staff that schools, not visitors to this website, control.</p>

    <h2>What we collect</h2>
    <p>We collect information in two ways:</p>
    <ul>
      <li><strong>What you tell us.</strong> If you submit the "Book a Demo" form, we store your name, email address, school name, phone number (if provided) and any message you write. We use this to get back to you about a demo — nothing else.</li>
      <li><strong>What your browser tells us automatically.</strong> Like most websites, we use Google Analytics (via Google Tag Manager) to understand how many people visit, which pages they read, and roughly where they're visiting from. This is aggregate, anonymized traffic data — it's not tied to your name or contact details unless you've also submitted the form above.</li>
    </ul>

    <h2>Cookies</h2>
    <p>Google Analytics sets cookies to distinguish one visitor from another across a session. You can block or delete these through your browser's settings at any time without affecting your ability to use this website — the site itself doesn't require cookies to function.</p>

    <h2>What we don't do</h2>
    <p>We don't sell your information to anyone. We don't share your demo request with third parties except the tools we use to run our own business (e.g. email delivery) — none of them are permitted to use your information for their own purposes.</p>

    <h2>How long we keep it</h2>
    <p>Demo requests are kept for as long as reasonably useful for following up with you, and deleted on request. Analytics data follows Google Analytics' own retention settings, which we've left at their default.</p>

    <h2>Your rights</h2>
    <p>You can ask us what information we hold about you, ask us to correct it, or ask us to delete it, by emailing <a href="mailto:<?php echo CONTACT_EMAIL; ?>"><?php echo CONTACT_EMAIL; ?></a>. We'll respond within a reasonable time.</p>

    <h2>Changes to this policy</h2>
    <p>If this policy changes in a way that matters, we'll update the date at the top of this page. Continuing to use the website after a change means you're OK with the update.</p>

    <h2>Questions</h2>
    <p>Email <a href="mailto:<?php echo CONTACT_EMAIL; ?>"><?php echo CONTACT_EMAIL; ?></a> — a person reads it, not a form.</p>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
