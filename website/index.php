<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/directory.php';

$directoryTopStates = array_slice(get_directory_states(), 0, 6);

$pageTitle       = 'School Management Software for K-12 Schools';
$pageDescription = 'Shiksha Pilot is one connected platform for attendance, exams, fee collection, timetables and leave requests — built for schools from kindergarten to class 12.';
$pagePath        = '/';
$pageJsonLd = [[
    '@context' => 'https://schema.org',
    '@type' => 'SoftwareApplication',
    'name' => SITE_NAME,
    'applicationCategory' => 'EducationalApplication',
    'operatingSystem' => 'Web, Android',
    'description' => $pageDescription,
    'offers' => ['@type' => 'Offer', 'availability' => 'https://schema.org/InStock'],
]];

require_once __DIR__ . '/includes/head.php';
require_once __DIR__ . '/includes/header.php';
?>

<header class="hero" id="top">
  <div class="wrap hero-grid">
    <div>
      <span class="tag">from kindergarten to class 12</span>
      <h1>School-running,<br/><span class="pop">minus the paperwork<svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M2 14 Q75 2 150 12 T298 10" stroke="#ffc531" stroke-width="14" fill="none" stroke-linecap="round"/></svg></span></h1>
      <p class="hero-sub">Attendance, exams, fees, timetables and leave — one connected app for teachers, admins, students and parents, instead of five things that don't talk to each other.</p>
      <div class="hero-ctas">
        <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/contact">Book a live demo</a>
        <a class="btn btn-white" href="<?php echo PAGE_BASE; ?>/features">See what's inside</a>
      </div>
      <div class="stat-row">
        <div class="stat"><b>4</b><span>apps in one</span></div>
        <div class="stat"><b>1</b><span>login for everyone</span></div>
        <div class="stat"><b>0</b><span>spreadsheets needed</span></div>
      </div>
    </div>

    <div class="scene" aria-hidden="true">
      <svg class="cloud" style="left:2%; top:8%; width:86px;" viewBox="0 0 100 60"><ellipse cx="30" cy="34" rx="26" ry="18" fill="#fff" stroke="#26333f" stroke-width="2.5"/><ellipse cx="58" cy="26" rx="22" ry="16" fill="#fff" stroke="#26333f" stroke-width="2.5"/><ellipse cx="70" cy="38" rx="20" ry="14" fill="#fff" stroke="#26333f" stroke-width="2.5"/></svg>
      <svg class="cloud" style="right:0%; top:2%; width:70px; animation-delay:1.2s;" viewBox="0 0 100 60"><ellipse cx="30" cy="34" rx="26" ry="18" fill="#fff" stroke="#26333f" stroke-width="2.5"/><ellipse cx="58" cy="26" rx="22" ry="16" fill="#fff" stroke="#26333f" stroke-width="2.5"/></svg>

      <svg class="doodle" style="left:6%; top:52%; --r:-12deg;" width="34" viewBox="0 0 24 24"><path d="M12 2l2.6 6.6L22 9l-5.4 4.6L18 21l-6-3.8L6 21l1.4-7.4L2 9l7.4-.4z" fill="#ffc531" stroke="#26333f" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <svg class="doodle" style="right:4%; top:58%; --r:6deg; animation-delay:0.8s;" width="38" viewBox="0 0 24 24"><path d="M12 4L2 9l10 5 8-4.2V15" stroke="#26333f" stroke-width="1.6" stroke-linejoin="round" fill="#9a6fe0"/><path d="M6 12v4c0 1.2 2.7 3 6 3s6-1.8 6-3v-4" stroke="#26333f" stroke-width="1.6" fill="none"/></svg>
      <svg class="doodle" style="left:12%; top:78%; --r:-6deg; animation-delay:1.6s;" width="40" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="#fff" stroke="#26333f" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#34b3e8" stroke-width="1.6" stroke-linecap="round"/></svg>
      <svg class="doodle" style="right:10%; top:10%; --r:8deg; animation-delay:0.4s;" width="34" viewBox="0 0 24 24"><path d="M4 20L18 6M18 6l-2-4 6 2z" fill="#ff6b4a" stroke="#26333f" stroke-width="1.6" stroke-linejoin="round"/></svg>

      <picture>
        <source srcset="<?php echo ASSET_BASE; ?>/images/hero-screen.webp" type="image/webp">
        <img class="mascot hero-photo" src="<?php echo ASSET_BASE; ?>/images/hero-screen.png" width="920" height="1372" alt="A teacher reading aloud to a group of smiling students outside their school" fetchpriority="high">
      </picture>
    </div>
  </div>
</header>

<section id="modules">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="tag">what's inside</span>
      <h2>Everything a school does in a day, in one place.</h2>
      <p>No more attendance in a register, fee receipts in a diary, and marks on a spreadsheet someone forgot to save.</p>
    </div>
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

<section id="portals">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="tag">one login, four cubbies</span>
      <h2>Everyone gets their own little corner of the app.</h2>
      <p>Same school, same data — just the bits that matter to whoever's signed in.</p>
    </div>
    <div class="portals">
      <div class="portal reveal" style="--p-accent:#ffd7c9; --p-accent-deep:#e8502f">
        <div class="portal-head">
          <div class="p-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z" stroke="#26333f" stroke-width="2"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" stroke="#26333f" stroke-width="2"/></svg></div>
          <h3>Teacher</h3>
        </div>
        <div class="portal-body"><ul><li>Attendance</li><li>Marks &amp; exams</li><li>Assignments</li><li>My leave</li></ul></div>
      </div>
      <div class="portal reveal" style="--p-accent:#c7f0dd; --p-accent-deep:#1f8f66">
        <div class="portal-head">
          <div class="p-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#26333f" stroke-width="2"/><path d="M4 9h16" stroke="#26333f" stroke-width="2"/></svg></div>
          <h3>School Admin</h3>
        </div>
        <div class="portal-body"><ul><li>Classes &amp; timetable</li><li>Fee collection</li><li>Staff &amp; payroll</li><li>Audit &amp; security</li></ul></div>
      </div>
      <div class="portal reveal" style="--p-accent:#dcd2fb; --p-accent-deep:#6a45c4">
        <div class="portal-head">
          <div class="p-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="7" width="14" height="13" rx="2" stroke="#26333f" stroke-width="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="#26333f" stroke-width="2"/></svg></div>
          <h3>Student &amp; Parent</h3>
        </div>
        <div class="portal-body"><ul><li>Results &amp; report cards</li><li>Fees &amp; receipts</li><li>Assignments</li><li>Leave requests</li></ul></div>
      </div>
      <div class="portal reveal" style="--p-accent:#ffe9a8; --p-accent-deep:#a67a04">
        <div class="portal-head">
          <div class="p-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="#26333f" stroke-width="2"/><path d="M12 4v16M4 12h16" stroke="#26333f" stroke-width="2"/></svg></div>
          <h3>Super Admin</h3>
        </div>
        <div class="portal-body"><ul><li>Manage schools</li><li>Manage plans</li><li>Report card designs</li><li>Platform oversight</li></ul></div>
      </div>
    </div>
  </div>
</section>

<section id="checklist">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="tag">the fine print, made friendly</span>
      <h2>The boring details, done properly.</h2>
      <p>The bits you don't see in a screenshot, but you'd miss the day something goes wrong.</p>
    </div>
    <div class="check-grid">
      <div class="check-item reveal">
        <div class="c-mark">&#10003;</div>
        <div><h3>Everyone sees only their own bit</h3><p>A teacher sees their class. An admin sees the whole school. Nobody sees the payroll by accident.</p></div>
      </div>
      <div class="check-item reveal">
        <div class="c-mark">&#10003;</div>
        <div><h3>Every change is remembered</h3><p>Who approved a leave, who edited a mark, who logged in and when — all there if you ever need to check.</p></div>
      </div>
      <div class="check-item reveal">
        <div class="c-mark">&#10003;</div>
        <div><h3>Fees in your own currency</h3><p>Dates, numbers and fees show up the way your school actually writes them — not a foreign default.</p></div>
      </div>
      <div class="check-item reveal">
        <div class="c-mark">&#10003;</div>
        <div><h3>Fast for the people who live in it</h3><p>A quick search box for admins who use this all day, every day — jump to a class or a student instantly.</p></div>
      </div>
    </div>
  </div>
</section>

<section id="app" class="app-section">
  <div class="wrap">
    <div class="app-copy reveal">
      <span class="tag">also on your phone</span>
      <h2>Mark attendance from the classroom, not the staffroom.</h2>
      <p class="hero-sub">The Android app puts the essentials in your pocket — for teachers on the move and parents checking in from home. <a href="<?php echo PAGE_BASE; ?>/mobile-app">Read more about the app &rarr;</a></p>
      <ul class="app-features">
        <li><span class="a-dot">&#10003;</span> Mark attendance from your phone, even between periods</li>
        <li><span class="a-dot">&#10003;</span> Instant alerts for fee due dates and leave approvals</li>
        <li><span class="a-dot">&#10003;</span> Download report cards and salary slips as PDFs</li>
      </ul>
      <div class="store-row">
        <a class="store-btn" href="<?php echo PLAY_APP_URL; ?>" rel="nofollow noopener" target="_blank">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 3.5v17l12-8.5-12-8.5z" fill="#fff"/><path d="M4 3.5l12 8.5-4 2.9L4 3.5z" fill="#4fc3ff"/><path d="M4 20.5l8-5.6 4 2.9-12 2.7z" fill="#ff6b4a"/><path d="M12 12l4-2.9 3.4 2.9-3.4 2.9z" fill="#ffc531"/></svg>
          <span class="s-txt"><span class="s-small"><?php echo PLAY_APP_IS_TESTING ? 'Early access on' : 'Get it on'; ?></span><span class="s-big">Google Play</span></span>
        </a>
        <?php if (!PLAY_APP_IS_TESTING): ?><span class="store-note">free download &middot; works on Android 8 and up</span><?php endif; ?>
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
</section>

<section id="explore-schools">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="tag">not a customer yet?</span>
      <h2>Browse CBSE schools across India, state by state.</h2>
      <p>A free directory of CBSE-affiliated schools by state and city — handy if you're a parent looking for a school, or a school looking to see how Shiksha Pilot could help run yours.</p>
    </div>
    <div class="district-list">
      <?php foreach ($directoryTopStates as $s): ?>
        <a class="district-chip" href="<?php echo PAGE_BASE; ?>/schools-in-<?php echo htmlspecialchars($s['state_slug'], ENT_QUOTES); ?>">
          <?php echo htmlspecialchars(directory_display_name($s['state']), ENT_QUOTES); ?>
        </a>
      <?php endforeach; ?>
    </div>
    <div class="hero-ctas" style="margin-top:28px;">
      <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/schools">Explore all schools &rarr;</a>
    </div>
  </div>
</section>

<section id="banner">
  <div class="wrap">
    <div class="banner reveal">
      <div class="banner-scene" aria-hidden="true">
        <svg class="banner-trail" viewBox="0 0 1300 300" preserveAspectRatio="none">
          <path d="M -40,150 C 220,20 460,260 760,90 S 1180,180 1300,40" fill="none" stroke="#26333f" stroke-width="2.5" stroke-linecap="round" opacity="0.28"/>
        </svg>
        <svg class="banner-plane" viewBox="0 0 24 24"><path d="M2 12l19-9-6 9 6 9z" fill="#ff6b4a" stroke="#26333f" stroke-width="1.6" stroke-linejoin="round" transform="rotate(90 12 12)"/></svg>
        <svg class="banner-star" style="left:14%; top:22%; animation-delay:0.3s;" width="18" viewBox="0 0 24 24"><path d="M12 2l2.6 6.6L22 9l-5.4 4.6L18 21l-6-3.8L6 21l1.4-7.4L2 9l7.4-.4z" fill="#26333f" opacity="0.5"/></svg>
        <svg class="banner-star" style="right:16%; top:30%; animation-delay:1.4s;" width="13" viewBox="0 0 24 24"><path d="M12 2l2.6 6.6L22 9l-5.4 4.6L18 21l-6-3.8L6 21l1.4-7.4L2 9l7.4-.4z" fill="#26333f" opacity="0.5"/></svg>
        <svg class="banner-star" style="right:28%; bottom:16%; animation-delay:0.8s;" width="15" viewBox="0 0 24 24"><path d="M12 2l2.6 6.6L22 9l-5.4 4.6L18 21l-6-3.8L6 21l1.4-7.4L2 9l7.4-.4z" fill="#26333f" opacity="0.5"/></svg>
      </div>
      <span class="tag">ready when you are</span>
      <h2>Give your school one connected app instead of five logins.</h2>
      <p>Book a walkthrough with your own class list and fee structure — see it running on your school's real data.</p>
      <div class="hero-ctas">
        <a class="btn btn-coral" href="<?php echo PAGE_BASE; ?>/contact">Book a live demo</a>
        <a class="btn btn-white" href="<?php echo PAGE_BASE; ?>/features">Explore features</a>
      </div>
    </div>
  </div>
</section>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
