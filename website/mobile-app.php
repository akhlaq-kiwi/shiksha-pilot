<?php
session_start();
require_once __DIR__ . '/includes/config.php';

// --- Early-access sign-up -------------------------------------------------
// Play internal testing has no self-serve join: a person can only install
// once their Google account is on the tester list, which is a manual step in
// the Play Console. This form is the queue for that step.
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$eaErrors  = [];
$eaSuccess = false;
$eaValues  = ['email' => '', 'name' => '', 'school' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form'] ?? '') === 'early_access') {
    $eaValues['email']  = trim($_POST['email'] ?? '');
    $eaValues['name']   = trim($_POST['name'] ?? '');
    $eaValues['school'] = trim($_POST['school'] ?? '');
    $honeypot           = trim($_POST['website'] ?? ''); // hidden — real users never fill this in
    $submittedToken     = $_POST['csrf_token'] ?? '';

    if (!hash_equals($_SESSION['csrf_token'], $submittedToken)) {
        $eaErrors['form'] = 'Your session expired — please try again.';
    } elseif ($honeypot !== '') {
        // Silently succeed without storing anything — don't tip off bots.
        $eaSuccess = true;
    } elseif ($eaValues['email'] === '' || !filter_var($eaValues['email'], FILTER_VALIDATE_EMAIL)) {
        $eaErrors['email'] = 'Please enter a valid email address.';
    } else {
        try {
            save_early_access_request($eaValues);
            $eaSuccess = true;
            unset($_SESSION['csrf_token']);
        } catch (PDOException $e) {
            error_log('early_access_requests insert failed: ' . $e->getMessage());
            $eaErrors['form'] = 'Something went wrong saving your request — please try again, or email us at ' . CONTACT_EMAIL . '.';
        }
    }
}

$pageTitle       = 'Android App — Attendance, Fees & Report Cards on the Go';
$pageDescription = 'The Shiksha Pilot Android app lets teachers mark attendance from the classroom and parents track fees, leave requests and report cards from their phone.';
$pagePath        = '/mobile-app';

$faqs = [
    ['q' => 'Is the app free to download?', 'a' => 'Yes — the Android app is a free download. Your school\'s existing Shiksha Pilot login works on both the app and the web portal.'],
    ['q' => 'Is there an iOS version?', 'a' => 'Not yet. The app is currently Android-only; get in touch if iOS availability would change your decision.'],
    ['q' => 'What can I do in the app that I can\'t do on the web?', 'a' => 'The app is built for on-the-go moments — marking attendance between periods, getting a push-style alert the moment a fee reminder or leave request needs attention, and downloading a report card or salary slip as a PDF straight to your phone.'],
    ['q' => 'Does it work without an internet connection?', 'a' => 'You need a connection to sync attendance, marks and fee data with the school\'s records — the app is not designed for fully offline use.'],
];

$pageJsonLd = [[
    '@context' => 'https://schema.org',
    '@type' => 'FAQPage',
    'mainEntity' => array_map(function ($f) {
        return [
            '@type' => 'Question',
            'name' => $f['q'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']],
        ];
    }, $faqs),
]];

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap hero-grid">
    <div>
      <span class="tag">also on your phone</span>
      <h1>School, in your pocket.</h1>
      <p class="hero-sub">Mark attendance from the classroom, not the staffroom. Check fee dues and report cards from home, not from a phone call to the office.</p>
      <div class="store-row">
        <a class="store-btn" href="<?php echo PLAY_APP_URL; ?>" rel="nofollow noopener" target="_blank">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 3.5v17l12-8.5-12-8.5z" fill="#fff"/><path d="M4 3.5l12 8.5-4 2.9L4 3.5z" fill="#4fc3ff"/><path d="M4 20.5l8-5.6 4 2.9-12 2.7z" fill="#ff6b4a"/><path d="M12 12l4-2.9 3.4 2.9-3.4 2.9z" fill="#ffc531"/></svg>
          <span class="s-txt"><span class="s-small"><?php echo PLAY_APP_IS_TESTING ? 'Early access on' : 'Get it on'; ?></span><span class="s-big">Google Play</span></span>
        </a>
        <?php if (PLAY_APP_IS_TESTING): ?>
          <a class="store-link" href="#early-access">Request early access &darr;</a>
        <?php else: ?>
          <span class="store-note">free download &middot; Android 8 and up</span>
        <?php endif; ?>
      </div>
    </div>
    <div class="phone-wrap reveal">
      <div class="phone">
        <div class="phone-screen">
          <div class="phone-notch"></div>
          <div class="phone-card">
            <div class="pc-label">Today's attendance</div>
            <div class="pc-value">96.4%</div>
            <div class="pc-bar"><div class="pc-fill" style="width:96%; background:var(--leaf)"></div></div>
          </div>
          <div class="phone-card">
            <div class="pc-label">Fee reminders sent</div>
            <div class="pc-value">12</div>
            <div class="pc-bar"><div class="pc-fill" style="width:60%; background:var(--sky)"></div></div>
          </div>
          <div class="phone-card">
            <div class="pc-label">Pending leave approvals</div>
            <div class="pc-value">3</div>
            <div class="pc-bar"><div class="pc-fill" style="width:30%; background:var(--sun)"></div></div>
          </div>
        </div>
      </div>
      <div class="phone-bubble" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 5-9 5-9-5 9-5z" stroke="#fff" stroke-width="1.8"/></svg></div>
    </div>
  </div>
</header>

<section id="modules">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="tag">built for on-the-go moments</span>
      <h2>What the app is actually for.</h2>
    </div>
    <div class="modules">
      <div class="module reveal" style="--m-accent:#bdeeda; --m-accent-deep:#1f8f66">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12l2 2 4-4" stroke="#1f8f66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="5" width="16" height="15" rx="2.5" stroke="#1f8f66" stroke-width="2.4"/></svg></div>
        <h3>Mark attendance anywhere</h3>
        <p>Take the register from the classroom itself — no walking back to a desktop between periods.</p>
        <div class="m-who">for teachers</div>
      </div>
      <div class="module reveal" style="--m-accent:#dcd2fb; --m-accent-deep:#6a45c4">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v6l4 2" stroke="#6a45c4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8" stroke="#6a45c4" stroke-width="2.4"/></svg></div>
        <h3>Instant fee &amp; leave alerts</h3>
        <p>Know the moment a fee reminder goes out or a leave request needs a decision — without checking the web portal.</p>
        <div class="m-who">for admins &amp; parents</div>
      </div>
      <div class="module reveal" style="--m-accent:#ffe3b0; --m-accent-deep:#c97b12">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4h9l3 3v13H6V4z" stroke="#c97b12" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 12h6M9 16h6" stroke="#c97b12" stroke-width="2.4" stroke-linecap="round"/></svg></div>
        <h3>PDFs, downloaded to your phone</h3>
        <p>Report cards and salary slips generate as a PDF you can save, print, or share directly from your device.</p>
        <div class="m-who">for teachers &amp; admins</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap content-block">
    <h2>Frequently asked questions</h2>
    <?php foreach ($faqs as $f): ?>
      <h3 style="font-size:18px; margin-top:22px; margin-bottom:6px;"><?php echo htmlspecialchars($f['q'], ENT_QUOTES); ?></h3>
      <p><?php echo htmlspecialchars($f['a'], ENT_QUOTES); ?></p>
    <?php endforeach; ?>
  </div>
</section>

<section id="early-access">
  <div class="wrap content-block">
    <span class="tag">early access</span>
    <h2>Want to try the app now?</h2>
    <p>The Android app is in <strong>invite-only testing</strong> while we finish it off. Leave your email and we'll add you to the tester list &mdash; you'll get a Play Store link once you're in.</p>

    <?php if ($eaSuccess): ?>
      <div class="form-card" role="status">
        <h3 style="margin-top:0">You're on the list.</h3>
        <p style="margin-bottom:0">We'll add you to the tester list and email you the Play Store link. It usually takes a day or two &mdash; there's a manual step on our side.</p>
      </div>
    <?php else: ?>
      <form class="form-card" method="post" action="<?php echo PAGE_BASE; ?>/mobile-app#early-access" novalidate>
        <input type="hidden" name="form" value="early_access">
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES); ?>">

        <?php if (!empty($eaErrors['form'])): ?>
          <p class="form-error" role="alert"><?php echo htmlspecialchars($eaErrors['form'], ENT_QUOTES); ?></p>
        <?php endif; ?>

        <div style="position:absolute; left:-9999px;" aria-hidden="true">
          <label for="ea-website">Leave this field blank</label>
          <input type="text" id="ea-website" name="website" tabindex="-1" autocomplete="off">
        </div>

        <div class="form-row">
          <label for="ea-email">Google account email</label>
          <input type="email" id="ea-email" name="email" value="<?php echo htmlspecialchars($eaValues['email'], ENT_QUOTES); ?>" required autocomplete="email" placeholder="you@gmail.com" aria-describedby="ea-email-hint ea-email-err">
          <p id="ea-email-hint" style="font-size:.85rem; opacity:.75; margin:.4rem 0 0;">Play testing only works with a Google account &mdash; give us the one you use on your Android phone, or we won't be able to add you.</p>
          <?php if (!empty($eaErrors['email'])): ?><p class="form-error" id="ea-email-err"><?php echo htmlspecialchars($eaErrors['email'], ENT_QUOTES); ?></p><?php endif; ?>
        </div>

        <div class="form-row">
          <label for="ea-name">Your name <span style="font-weight:400;">(optional)</span></label>
          <input type="text" id="ea-name" name="name" value="<?php echo htmlspecialchars($eaValues['name'], ENT_QUOTES); ?>" autocomplete="name">
        </div>

        <div class="form-row">
          <label for="ea-school">Your school <span style="font-weight:400;">(optional)</span></label>
          <input type="text" id="ea-school" name="school" value="<?php echo htmlspecialchars($eaValues['school'], ENT_QUOTES); ?>" autocomplete="organization">
        </div>

        <button class="btn btn-coral" type="submit">Request early access</button>
      </form>
    <?php endif; ?>
  </div>
</section>

<section id="banner">
  <div class="wrap">
    <div class="banner reveal">
      <span class="tag">ready when you are</span>
      <h2>Get the app once your school is set up.</h2>
      <p>Book a demo first — we'll get your school's data into Shiksha Pilot, then the app just works with the same login.</p>
      <div class="hero-ctas">
        <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/contact">Book a live demo</a>
      </div>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
