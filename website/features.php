<?php
require_once __DIR__ . '/includes/config.php';

$pageTitle       = 'Features — Attendance, Exams, Fees, Timetable & Leave';
$pageDescription = 'Explore every Shiksha Pilot module: attendance with built-in guard rails, exam mark entry and report cards, fee collection and follow-ups, timetable substitutions, leave requests and announcements.';
$pagePath        = '/features';

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero page-hero">
  <div class="wrap">
    <span class="tag">what's inside</span>
    <h1>One console, every school workflow.</h1>
    <p class="hero-sub">A closer look at the modules that make up Shiksha Pilot — each one built around the actual paperwork it replaces.</p>
  </div>
</header>

<section id="modules">
  <div class="wrap">
    <div class="modules">
      <div class="module reveal" style="--m-accent:#bdeeda; --m-accent-deep:#1f8f66">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12l2 2 4-4" stroke="#1f8f66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="5" width="16" height="15" rx="2.5" stroke="#1f8f66" stroke-width="2.4"/></svg></div>
        <h3>Attendance</h3>
        <p>Mark a whole class in a tap — it won't let anyone mark the future, a Sunday, or a holiday by mistake.</p>
        <div class="m-who">for teachers &amp; admins</div>
      </div>
      <div class="module reveal" style="--m-accent:#ffe3b0; --m-accent-deep:#c97b12">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4h9l3 3v13H6V4z" stroke="#c97b12" stroke-width="2.4" stroke-linejoin="round"/><path d="M9 12h6M9 16h6" stroke="#c97b12" stroke-width="2.4" stroke-linecap="round"/></svg></div>
        <h3>Exams &amp; report cards</h3>
        <p>Enter marks once, and the report card fills itself in — grades, ranks and remarks included.</p>
        <div class="m-who">for teachers &amp; admins</div>
      </div>
      <div class="module reveal" style="--m-accent:#dcd2fb; --m-accent-deep:#6a45c4">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" stroke="#6a45c4" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="17" r="2.6" stroke="#6a45c4" stroke-width="2.4"/></svg></div>
        <h3>Fee collection</h3>
        <p>Track who's paid and who's due, send friendly reminders, and let parents pay from their own phone.</p>
        <div class="m-who">for admins &amp; parents</div>
      </div>
      <div class="module reveal" style="--m-accent:#c4ecf8; --m-accent-deep:#1687ad">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5" stroke="#1687ad" stroke-width="2.4"/><path d="M4 10h16M9 4v6" stroke="#1687ad" stroke-width="2.4"/></svg></div>
        <h3>Timetable &amp; substitutes</h3>
        <p>Build the weekly timetable once — swap in a substitute teacher in two taps when someone's away.</p>
        <div class="m-who">for admins</div>
      </div>
      <div class="module reveal" style="--m-accent:#ffd4d0; --m-accent-deep:#d1442c">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v6l4 2" stroke="#d1442c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8" stroke="#d1442c" stroke-width="2.4"/></svg></div>
        <h3>Leave requests</h3>
        <p>Teachers, students and parents ask for leave with a date and a reason — admins approve with one tap.</p>
        <div class="m-who">for everyone</div>
      </div>
      <div class="module reveal" style="--m-accent:#ffe9a8; --m-accent-deep:#a67a04">
        <div class="m-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h9" stroke="#a67a04" stroke-width="2.4" stroke-linecap="round"/></svg></div>
        <h3>Announcements</h3>
        <p>Send a notice to teachers, students, or both — a holiday, an exam date, or a reminder, sorted.</p>
        <div class="m-who">for admins</div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap content-block">
    <h2 id="attendance">Attendance, without the accidental mistakes</h2>
    <p>Every attendance record is checked before it's saved: you can't mark a date in the future, you can't mark a Sunday, and you can't mark a day that's already listed as a school holiday. Teachers mark a whole class in one screen; school admins get a school-wide view with attendance rates by class.</p>

    <h2 id="exams">Exams and report cards that stay in sync</h2>
    <p>Marks are entered once against the actual paper's grading scale — the report card, grade, and rank are all computed from that single entry, not retyped. Once a class's results are published, marks lock so a printed report card and the system never disagree.</p>

    <h2 id="fees">Fee collection and follow-up</h2>
    <p>See outstanding dues by class and by month, and track a fee follow-up from first reminder to payment. Parents see exactly what's owed, in the school's own currency and date format, and can pay from the student &amp; parent portal.</p>

    <h2 id="timetable">Timetable and substitutions</h2>
    <p>Build the weekly timetable once per academic year. When a teacher is on leave, reassign their period to a substitute in a couple of taps — the change is visible to the whole school immediately, not just in one teacher's diary.</p>

    <h2 id="leave">Leave requests</h2>
    <p>Teachers, students and parents can submit a leave request with a date range and a reason. Admins see pending requests in one place and approve or reject with a note — no paper slips changing hands.</p>

    <h2 id="announcements">Announcements</h2>
    <p>Draft a notice, choose the audience — teachers, students, or both — and publish. A holiday notice and an exam-date reminder go out the same way, to the people who actually need to see them.</p>
  </div>
</section>

<section id="banner">
  <div class="wrap">
    <div class="banner reveal">
      <span class="tag">see it running</span>
      <h2>Want to see these on your own class list?</h2>
      <p>Book a walkthrough and we'll set it up with your school's actual classes and fee structure.</p>
      <div class="hero-ctas">
        <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/contact">Book a live demo</a>
      </div>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
