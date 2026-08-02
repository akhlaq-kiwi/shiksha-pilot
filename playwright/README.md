# Playwright E2E tests

CSV-driven end-to-end tests for the Shiksha Pilot frontend. Everything test-related
lives in this folder, isolated from `frontend/` and `app/`.

## Folder structure

```
playwright/
  playwright.config.js     # projects (one per role) + CSV-agnostic Playwright settings
  package.json
  .env.example              # copy to .env — base URL + E2E account passwords
  data/                      # *** all test data as CSV — edit these, not the specs ***
    login-credentials.csv
    login-invalid-attempts.csv
    login-required-fields.csv
    attendance-scenarios.csv
    marks-scenarios.csv
    student-enrollment.csv
    leave-request-scenarios.csv
    announcement-scenarios.csv
    fee-payment-scenarios.csv
    school-creation.csv
    plan-scenarios.csv
  pages/                     # Page Object Models, one per portal/screen
    LoginPage.js
    AppShellPage.js          # shared sidebar/logout/search chrome
    TeacherPortal.js         # attendance, marks, leave requests
    SchoolAdminPortal.js     # student enrollment, announcements
    StudentParentPortal.js   # fee payments
    SuperAdminPortal.js      # school creation, plan management
  utils/
    csv-reader.js            # readCsv / readActiveCsv / readCsvByRole
  tests/
    auth.setup.js            # logs in once per role, saves storageState to .auth/
    support/require-auth.js  # lets a role spec skip itself if no creds configured
    auth/                    # login validation — needs NO seeded accounts
    teacher/                 # attendance.spec.js, marks.spec.js, leave-request.spec.js
    school-admin/            # student-enrollment.spec.js, announcements.spec.js
    student-parent/          # fees.spec.js
    super-admin/             # school-creation.spec.js, plan-management.spec.js
  .auth/                     # generated storageState JSON per role (gitignored)
```

## Why CSV?

Every test spec is a thin loop over `readCsv('some-file.csv')` — adding a new
test case means adding a CSV row, not touching JS. Page Object Models keep
selectors in one place per screen so CSV-driven specs stay declarative.

## First-time setup

```bash
cd playwright
npm install
npm run install:browsers   # downloads the Chromium binary Playwright needs
cp .env.example .env
```

Then edit `.env`:
- `BASE_URL` — where the frontend is running (`http://localhost:3000` for
  `npm run dev` in `frontend/`, `http://localhost:2003` for the docker-compose stack).
- `E2E_SUPER_ADMIN_PASSWORD` / `E2E_SCHOOL_ADMIN_PASSWORD` / etc. — plaintext
  passwords for the seeded accounts. **Only bcrypt hashes are committed to the
  repo** (`backend/src/Database/Migrations/003_seed_super_admin.sql`,
  `004_seed_development_data.sql`), so you must know or reset these passwords
  locally; there is nothing to leak by filling them into your local `.env`
  (it's gitignored).

`data/login-credentials.csv` maps each role to a phone number and to the name
of the env var holding its password — never to a literal password. Rows for
roles without a known phone number (`TEACHER`/`STUDENT`/`PARENT` — no seed
data exists for these in the migrations) ship with `skip=1`; fill in the phone
number and env var, flip `skip` to `0`, once you have a real test account for
that role.

## Running tests

```bash
npm test                 # everything
npm run test:auth        # just login validation (no seeded accounts required)
npm run test:teacher     # teacher-only specs (requires E2E_TEACHER_PASSWORD)
npm run test:ui          # Playwright's interactive UI mode
npm run test:headed      # see the browser
npm run report           # open the last HTML report
```

If a role's credentials aren't configured, that role's specs report as
**skipped** (not failed) — see `tests/support/require-auth.js`. This keeps
`npm test` runnable out of the box even before every seed account is wired up.

## Adding a new test case

1. Find (or add) the right CSV file in `data/`.
2. Add a row. No code change needed if an existing spec already loops over that file.
3. If it's a genuinely new flow/screen, add a Page Object in `pages/` (or extend
   an existing one) and a spec file under `tests/<portal>/` that loops over a new CSV.

## Coverage

CSV rows are written directly against the validation rules found in the
backend services, so most "invalid" cases assert an actual server-enforced
rule rather than a guess:

| Flow | CSV | Backend rule under test |
|---|---|---|
| Login | `login-invalid-attempts.csv`, `login-required-fields.csv` | unknown phone → server "account not found"; empty fields → native HTML5 `required` |
| Student enrollment | `student-enrollment.csv` | required fields, email format, digits-only mobile, exact 12-digit Aadhaar, future DOB |
| Fee payment | `fee-payment-scenarios.csv` | amount > 0, decimal amounts, "fat-finger" (>1.5x outstanding) confirmation, non-numeric input rejected by the field itself |
| Attendance | `attendance-scenarios.csv` | date <= today (future date blocked) |
| Marks entry | `marks-scenarios.csv` | 0 <= marks <= max_marks, non-numeric rejected |
| Leave requests | `leave-request-scenarios.csv` | required fields, end date >= start date, 100-word cap on reason |
| Announcements | `announcement-scenarios.csv` | required title, 100-char cap |
| School/plan creation | `school-creation.csv`, `plan-scenarios.csv` | required fields (native HTML5), owner email format, native `min="0"` on plan amount |

### Real findings from getting this suite green

Running these against the live QA environment surfaced a few things worth
knowing, beyond simple selector fixes:

- **School-admin/teacher specs need a subscription plan assigned to the school
  first.** The seeded "QA Test School" (school-admin login) currently has none,
  so every school-admin/teacher page is walled off behind a "Subscription
  Required" screen instead of the real portal. `require-auth.js` detects this
  and skips affected specs with a clear message rather than failing — assign
  a plan via super-admin → **Manage Schools** to unlock them.
- **Validation gap in "Create Plan"**: Student Limit has no `min="0"` (or any
  other) constraint — a plan with `student_limit=0` is silently accepted.
  `plan-scenarios.csv` documents this as `expectValid=true` with a comment
  explaining it's asserting current (buggy) behavior, not a desired one —
  flip it back to `false` once that's fixed. Negative Amount *is* correctly
  blocked (native `min="0"`).
- **Several forms use hand-rolled `<div>` modals instead of the shared
  `Dialog` primitive** (`PlanDialog` in `PlansPage.jsx`, `ConfirmDialog.jsx`)
  — no `role="dialog"`, so specs target a field/heading inside them instead
  of `getByRole('dialog')`.
- **Sidebar nav items are `<button>`s, not links** (`AppSidebar.jsx`) —
  `AppShellPage.goToNavItem()` scopes to the labelled `<nav>` region and
  looks for a button, not a link.
- The `CreateSchoolDialog` has no "subdomain" field at all (real fields:
  School Name, Contact Phone, School Owner Email Address, Admin Phone,
  Password) — `school-creation.csv`/spec were rewritten to match.
- `StudentEnrollmentForm` is a 4-step wizard with no "Class" field on it (the
  class comes from whichever class card you enrolled from) and a single
  combined "Student Name" field, not separate first/last name — `dob` targets
  `#dob` by id since its `<label>` isn't wired via `htmlFor`.
- These specs create real records against a shared, non-disposable dev DB —
  re-running `plan-management.spec.js` cleans up same-named plans first so
  duplicate-name collisions don't cause false failures; `school-creation.spec.js`
  does not (over many reruns you'll see duplicate "Greenwood High" schools).

### Known gaps (disclosed, not silently skipped)

- **Sunday / school-holiday attendance blocks**: the backend also rejects
  attendance marked on a Sunday or on any date in the `holidays` table, but
  both depend on the current date and on seeded holiday data we don't have —
  add rows to `attendance-scenarios.csv` once you know a holiday date for
  your seeded academic year.
- **Fee payment for a promoted/migrated student**: `createFeePayment` blocks
  payment entirely if the student was already promoted to a new academic
  year (must pay "Previous Year Dues" first) — needs a specific seeded
  student state, not exercised here.
- **Exam "Published" lock**: `saveExamMark` rejects edits once a class exam
  is marked Published — needs a seeded exam in that state.
- **Cross-portal subscription limit**: super-admin sets a plan's
  `student_limit`; school-admin's `StudentEnrollmentForm` then hits
  `subscription_limit_reached` once the school is at capacity. This is a
  real, deliberately-designed interaction between two portals but isn't
  wired up as a test — it would need a dedicated low-limit seeded plan
  assigned to a seeded school.
- Selectors in the newer specs (leave requests, announcements, plans) are
  based on reading the component source, not on a live authenticated run —
  once you configure credentials, run them once and adjust any selector that
  doesn't match (see "First-time setup" above).

## Notes

- Auth is handled once per role via `tests/auth.setup.js`, which runs before
  the role-specific projects (`chromium-teacher`, `chromium-school-admin`,
  etc. in `playwright.config.js`) and persists `storageState` to `.auth/*.json`
  so every spec in that project starts already logged in.
- `tests/auth/login.spec.js` intentionally runs unauthenticated (its own
  `chromium-auth` project has no `storageState`) since it's testing the login
  form itself.
- `frontend/src/features/auth/components/LoginForm.jsx` had no `data-testid`
  attributes before this suite was added; four were added
  (`login-phone-input`, `login-password-input`, `login-submit-button`,
  `login-phone-error`, `login-password-error`) purely to give these tests a
  stable selector — no behavior changed.
