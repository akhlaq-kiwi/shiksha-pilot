<?php
session_start();
require_once __DIR__ . '/includes/config.php';

$pageTitle       = 'Book a Demo';
$pageDescription = 'Book a live walkthrough of Shiksha Pilot with your own school\'s classes and fee structure — see attendance, exams, fees and timetables running on real data.';
$pagePath        = '/contact';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$errors = [];
$success = false;
$values = ['name' => '', 'email' => '', 'school' => '', 'phone' => '', 'message' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $values['name']    = trim($_POST['name'] ?? '');
    $values['email']   = trim($_POST['email'] ?? '');
    $values['school']  = trim($_POST['school'] ?? '');
    $values['phone']   = trim($_POST['phone'] ?? '');
    $values['message'] = trim($_POST['message'] ?? '');
    $honeypot          = trim($_POST['website'] ?? ''); // hidden field — real users never fill this in
    $submittedToken    = $_POST['csrf_token'] ?? '';

    if (!hash_equals($_SESSION['csrf_token'], $submittedToken)) {
        $errors['form'] = 'Your session expired — please try submitting again.';
    } elseif ($honeypot !== '') {
        // Silently treat as success without sending anything — don't tip off bots.
        $success = true;
    } else {
        if ($values['name'] === '') { $errors['name'] = 'Please tell us your name.'; }
        if ($values['email'] === '' || !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Please enter a valid email address.';
        }
        if ($values['school'] === '') { $errors['school'] = 'Please tell us your school\'s name.'; }

        if (empty($errors)) {
            $to = CONTACT_EMAIL;
            $subject = 'Demo request from ' . $values['school'];
            $body = "New demo request from the website:\n\n"
                  . "Name: {$values['name']}\n"
                  . "Email: {$values['email']}\n"
                  . "School: {$values['school']}\n"
                  . "Phone: {$values['phone']}\n\n"
                  . "Message:\n{$values['message']}\n";
            $headers = 'From: no-reply@' . SITE_DOMAIN . "\r\n"
                     . 'Reply-To: ' . $values['email'] . "\r\n";

            // Best-effort: mail() requires a configured MTA to actually deliver.
            // In production, swap this for a transactional email API/SMTP library.
            $sent = @mail($to, $subject, $body, $headers);
            $success = true; // Show success regardless — don't leak delivery internals to the visitor.
            unset($_SESSION['csrf_token']);
        }
    }
}

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap">
    <span class="tag">ready when you are</span>
    <h1>Book a live demo.</h1>
    <p class="hero-sub">Tell us a bit about your school and we'll walk you through Shiksha Pilot with your own class list and fee structure — not a generic demo account.</p>
  </div>
</header>

<section>
  <div class="wrap">
    <?php if ($success): ?>
      <div class="form-success" role="status">
        Thanks — we've got your request and will reach out shortly to schedule your demo.
      </div>
    <?php else: ?>
      <?php if (!empty($errors['form'])): ?>
        <p class="form-error" role="alert"><?php echo htmlspecialchars($errors['form'], ENT_QUOTES); ?></p>
      <?php endif; ?>
      <form class="form-card" method="post" action="<?php echo PAGE_BASE; ?>/contact" novalidate>
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES); ?>">
        <div style="position:absolute; left:-9999px;" aria-hidden="true">
          <label for="website">Leave this field blank</label>
          <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
        </div>

        <div class="form-row">
          <label for="name">Your name</label>
          <input type="text" id="name" name="name" value="<?php echo htmlspecialchars($values['name'], ENT_QUOTES); ?>" required aria-describedby="name-err">
          <?php if (!empty($errors['name'])): ?><p class="form-error" id="name-err"><?php echo htmlspecialchars($errors['name'], ENT_QUOTES); ?></p><?php endif; ?>
        </div>

        <div class="form-row">
          <label for="email">Email address</label>
          <input type="email" id="email" name="email" value="<?php echo htmlspecialchars($values['email'], ENT_QUOTES); ?>" required aria-describedby="email-err">
          <?php if (!empty($errors['email'])): ?><p class="form-error" id="email-err"><?php echo htmlspecialchars($errors['email'], ENT_QUOTES); ?></p><?php endif; ?>
        </div>

        <div class="form-row">
          <label for="school">School name</label>
          <input type="text" id="school" name="school" value="<?php echo htmlspecialchars($values['school'], ENT_QUOTES); ?>" required aria-describedby="school-err">
          <?php if (!empty($errors['school'])): ?><p class="form-error" id="school-err"><?php echo htmlspecialchars($errors['school'], ENT_QUOTES); ?></p><?php endif; ?>
        </div>

        <div class="form-row">
          <label for="phone">Phone number <span style="font-weight:400;">(optional)</span></label>
          <input type="tel" id="phone" name="phone" value="<?php echo htmlspecialchars($values['phone'], ENT_QUOTES); ?>">
        </div>

        <div class="form-row">
          <label for="message">Anything you'd like us to know? <span style="font-weight:400;">(optional)</span></label>
          <textarea id="message" name="message" rows="4"><?php echo htmlspecialchars($values['message'], ENT_QUOTES); ?></textarea>
        </div>

        <button type="submit" class="btn btn-coral">Send request</button>
      </form>
    <?php endif; ?>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
