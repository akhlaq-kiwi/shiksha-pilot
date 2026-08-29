<?php
require_once __DIR__ . '/includes/config.php';

$pageTitle       = 'Delete Your Account';
$pageDescription = 'How to request deletion of your Shiksha Pilot account and what happens to your data afterwards.';
$pagePath        = '/delete-account';

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap">
    <span class="tag">account &amp; data</span>
    <h1>Delete Your Account</h1>
    <p class="hero-sub">You can ask us to delete your Shiksha Pilot account at any time. Here's how, and what happens afterwards.</p>
  </div>
</header>

<section>
  <div class="wrap content-block">
    <h2>From the app</h2>
    <p>This is the quickest route if you still have the app installed:</p>
    <ol>
      <li>Open the Shiksha Pilot app and go to <strong>Settings</strong>.</li>
      <li>Tap <strong>Delete my account</strong>.</li>
      <li>Confirm, and optionally tell us why &mdash; it helps, but you don't have to.</li>
    </ol>
    <p>Your request goes straight to your school's administrator, who processes it. You'll be able to see that the request is pending in the app, and you can withdraw it any time before it's actioned.</p>

    <h2>Without the app</h2>
    <p>If you've already uninstalled the app, or you can't sign in, email <a href="mailto:<?php echo CONTACT_EMAIL; ?>?subject=Account%20deletion%20request"><?php echo CONTACT_EMAIL; ?></a> from any address and include:</p>
    <ul>
      <li>the mobile number your account uses,</li>
      <li>your name as the school records it, and</li>
      <li>the name of your school.</li>
    </ul>
    <p>We'll verify the request with your school before acting on it. That verification step exists on purpose &mdash; without it, anyone who knew your phone number could close your account.</p>

    <h2>What gets deleted</h2>
    <p>When the request is actioned, we permanently remove the details that identify you as a user of the app:</p>
    <ul>
      <li>your name and mobile number,</li>
      <li>your email address, if the school recorded one,</li>
      <li>your password, and</li>
      <li>the device registration that lets us send you notifications.</li>
    </ul>
    <p>Your login stops working immediately and cannot be restored. This is not reversible &mdash; if you want to use Shiksha Pilot again afterwards, your school has to create a new account for you.</p>

    <h2>What the school keeps</h2>
    <p>Some records stay with the school rather than with you, and deleting your account does not erase them. Attendance registers, fee and payment history, exam results and report cards belong to the school's own records, which it is generally required to keep &mdash; in the same way that leaving a school does not erase the register you appeared in.</p>
    <p>These records are no longer linked to a working account or to your contact details. If you want them removed as well, that's a decision for your school, and you should raise it with them directly. We act on the school's instruction for data the school controls.</p>

    <h2>How long it takes</h2>
    <p>Requests are actioned by your school's administrator, so the timing depends on them. If a request sits unactioned for more than <strong>30 days</strong>, email us at <a href="mailto:<?php echo CONTACT_EMAIL; ?>"><?php echo CONTACT_EMAIL; ?></a> and we'll follow it up.</p>

    <h2>Questions</h2>
    <p>Anything unclear, or you'd rather talk it through first &mdash; write to <a href="mailto:<?php echo CONTACT_EMAIL; ?>"><?php echo CONTACT_EMAIL; ?></a>. Our <a href="<?php echo PAGE_BASE; ?>/privacy-policy">Privacy Policy</a> covers what we collect and why.</p>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
