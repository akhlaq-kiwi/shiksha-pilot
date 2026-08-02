# Shiksha Pilot — Usability Report (End-User Task Flows)

**Companion to** [UI_UX_AUDIT.md](UI_UX_AUDIT.md), which covered visual design and theming. This report is about **making the product easier to actually use**: task completion, error recovery, cognitive load, and time-on-task for each real user.

**Method:** read the highest-frequency workflow screens directly — teacher attendance & marks entry, admin fee collection, student enrolment, dashboards, navigation shell — plus an app-wide audit of safety nets (dirty-state guards, confirmations, debouncing, error handling).
**Status:** recommendations only, no code changed.

---

## 0. Two corrections to the earlier report

Reading the workflow code properly changed two of my earlier conclusions:

1. **Loading states are inconsistent, not absent.** [FinancePage.jsx](frontend/src/features/school-admin/pages/FinancePage.jsx) is genuinely well-built — purpose-shaped `SkeletonRow`, error state, filters, `Intl.NumberFormat` currency, and infinite scroll with pagination reset on filter change. It should be the reference implementation the other 49 screens copy.
2. **Teacher attendance already defaults to all-present with row-tap toggling** — the good pattern. My "tapping 40 times" concern was wrong for this screen; the real problems there are different and worse (see §2.1).

---

## 1. The three findings that matter most

### 1.1 🔴 Marks entry pre-fills **random** scores

[ExaminationPage.jsx:24-27](frontend/src/features/teacher/pages/ExaminationPage.jsx#L24-L27):

```js
students.forEach((s) => {
  init[s.id] = Math.floor(Math.random() * 31) + 60; // 60–90
});
```

Every student's score box opens pre-populated with a random number between 60 and 90, and `Save Marks` is one click away. A teacher who enters 35 of 40 students and saves has just committed **five fabricated grades** — and nothing in the UI signals that those values weren't theirs. `totalMarks` is also hardcoded to `100` regardless of the exam's actual maximum, so grade letters are wrong for any 25- or 50-mark test.

**Fix:** initialise to empty. Show `—` and a distinct "not entered" row state. Block save while any student is blank, or require an explicit "Save partial (5 students not entered)" confirmation. Read max marks from the exam record and validate each cell against it.

This is the single highest-severity usability issue in the product — it silently produces wrong data in the one workflow parents scrutinise most.

### 1.2 🔴 Changing the date on attendance does not reload attendance

[AttendancePage.jsx:24-29](frontend/src/features/teacher/pages/AttendancePage.jsx#L24-L29) resets state on `[selectedClass]` only. So:

- Switch the date → the previous day's toggles stay on screen, presented as if they belong to the new date.
- The screen **never fetches existing attendance for the selected date**, so re-opening a day you already marked shows everything as present again. Submitting overwrites real records with defaults.
- There's no indication of whether a date is already marked, and no guard against double submission.

**Fix:** key the fetch on `[selectedClass, date]`; load existing records; show "Already marked at 9:14 AM by you — editing" vs "Not yet marked"; disable future dates; mark holidays/weekends.

### 1.3 🔴 Nothing protects work in progress

App-wide audit across `frontend/src`:

| Safety net | Count | Expected |
|---|---|---|
| `beforeunload` / dirty-state guards | **1** | every form & data-entry grid |
| `onKeyDown` handlers | 7 files | data grids, dialogs, search |
| Search debouncing | **3** | every search input |
| `window.confirm` (native, inconsistent with the app's own `ConfirmDialog`) | 5 | 0 |

A teacher entering 40 sets of marks, or an admin 20 fields into the 1,468-line enrolment form, can lose everything to a stray back-navigation, a sidebar click, or a session expiry — with no warning. On the intermittent connectivity typical of school networks, this happens routinely.

**Fix, in order:** (a) a `useUnsavedChanges` hook that guards both React Router navigation and `beforeunload`; (b) autosave-to-`localStorage` drafts for the enrolment form and marks grid, with "Draft restored" on return; (c) a visible save-state indicator ("Saving… / All changes saved / Save failed — retry") instead of a fire-and-forget button.

Note also that `handleSubmit` in teacher attendance has **no `try/catch`** — a failed submission still renders the green "Attendance Submitted ✓" screen. The teacher walks away believing it saved. (Marks entry does this correctly with toasts; attendance doesn't.)

---

## 2. Per-role: what would actually make it easier

### 2.1 Teacher — optimise for "between periods, on a phone, in 90 seconds"

This is your highest-frequency user and the one whose time is most constrained.

| Problem | Recommendation |
|---|---|
| No student search/filter on the attendance roll | Add a filter box + "show absent only" toggle; essential above ~30 students |
| No bulk actions beyond the all-present default | Add "mark all absent" (exam days, strikes) and half-day / late / excused states — present/absent binary doesn't match how schools actually record attendance |
| Marks grid requires mouse for every cell | Keyboard-first grid: `Enter`/`↓` next student, `Tab` next column, `↑↓` navigation, paste-a-column from Excel. This alone can cut marks entry from ~6 min to ~90 s per class |
| No per-cell validation feedback | Validate against max marks on blur; flag outliers ("92 in a class averaging 41 — confirm?") |
| Save is manual and all-or-nothing | Autosave per row with a per-row saved tick; never lose a partially entered class |
| No "what do I owe today?" view | Teacher dashboard should lead with: next period, classes still needing attendance today, ungraded submissions, pending leave approvals |
| Attendance history is a flat cross-class list | Filter by class and date range; add a monthly grid view (students × days) which is how teachers actually think about it |
| Dark-mode toggle is hidden from teachers | They stare at this longest — give everyone the toggle ([AppLayout.jsx](frontend/src/layouts/AppLayout.jsx) currently gates it to admin roles) |

### 2.2 School Admin — reduce the cost of the 50-screen surface

| Problem | Recommendation |
|---|---|
| **15 flat sidebar items**, three of them finance destinations with indistinguishable names ("Fees Portal" / "Financial Reports" / "Finance Management") | Group into 4 labelled sections; rename to *Fee Collection*, *Reports*, *Accounts & Payroll*. New admins currently have to click all three to learn the difference |
| No global search | ⌘K over students, teachers, classes, invoices, receipts. On a product this wide it's the largest single time saver — "find Aryan Mehta" currently means: guess portal → guess screen → filter |
| The **1,468-line, 4-tab enrolment form** is the main onboarding bottleneck | The 4-tab wizard with per-tab validation is the right shape. Missing: a visible progress indicator with completion state per tab, draft autosave, "Save & add another" (schools enrol in batches of 40), CSV bulk import, and error summary at top with jump-to-field. Also: many inputs use `placeholder="Student Name"` **as** the label — placeholders vanish on focus, so users lose track of which field they're in mid-entry |
| No bulk operations anywhere | Bulk fee reminders, bulk report-card generation, bulk promote-to-next-class, bulk attendance correction. These are all currently one-at-a-time on lists of hundreds |
| Dashboard shows `MOCK_AUDIT_LOGS` hardcoded and stats with no trend or period | Real recent-activity feed; stat cards with delta + click-through to the filtered list; a date-range control so "collections" has a stated period |
| Academic-year switcher is an unlabelled native `<select>` next to the school name | It silently changes every figure on every screen. Label it, style it as a distinct scope control, and confirm when switching away from the active year |
| No undo on destructive actions; 5 native `window.confirm` calls | Route everything through `ConfirmDialog`; require typing the name for genuinely destructive deletes; prefer soft-delete + "Undo" toast for reversible ones |
| Long lists lack sticky headers, sort affordances, saved filters | See §4.3 of the design audit — sticky `<thead>` and sortable columns are the two highest-value table fixes |

### 2.3 Parent & Student — optimise for infrequent, mobile, low-tolerance

These users open the app a few times a month, usually on a mid-range Android phone. Every extra step costs completion.

| Problem | Recommendation |
|---|---|
| Fee payment is spread across fees, receipts and follow-up screens | One unmistakable path: **Amount due → breakdown → pay → receipt (downloadable)**. Put "Pay ₹X now" as a persistent element until settled. The dashboard banner is good — make it the entry to a single flow |
| Sidebar collapses to a horizontally-scrolling strip with `scrollbar-none` | No affordance that more items exist off-screen. Replace with a bottom tab bar: Home · Attendance · Fees · Results · More |
| Multi-child parents' child switcher is buried in the sidebar ([student-parent/index.jsx:154](frontend/src/features/student-parent/index.jsx#L154)) | Promote to the header as a persistent avatar switcher. Wrong-child data is a trust-destroying error |
| Report cards, timetable, attendance summary all need to be shown to someone else | One "Documents" area with download/share-as-PDF, plus WhatsApp share (dominant channel for Indian/Pakistani parents) |
| Locale is mixed — `toLocaleDateString('en-PK')` on the student dashboard while currency is `₹`/`en-IN` | Derive locale, currency and date format from the school profile. This is a correctness bug, not just polish |
| No explanation of *why* numbers are what they are | "Attendance 82%" should link to which days were missed. "Outstanding ₹25,000" should itemise. Unexplained numbers generate phone calls to the school office |
| Everything assumes English literacy | Hindi/Urdu/regional language toggle. The mobile app already carries Hindi content for the word game, so the appetite is proven — extend it to the parent-facing surface |
| No notifications for teachers/students/parents in web | Only `SCHOOL_ADMIN` gets the bell. Fee due, results published, leave approved, announcement posted are all parent-relevant events |

### 2.4 Super Admin

Needs platform health, not school internals: MRR and active-school trend, per-school last-login/usage (to spot churn before renewal), subscription-expiry pipeline, failed-payment queue, and impersonate-to-debug ("view as this school's admin") with an audit trail.

---

## 3. Cross-cutting usability principles to adopt

1. **Every destructive or irreversible action gets a confirmation; every reversible one gets an Undo toast instead.** Confirmations on reversible actions train users to click through them.
2. **Never report success you haven't verified.** Attendance submit is the current counter-example. Success UI must be gated on the resolved promise.
3. **Show system state at all times.** Saving/saved/failed, syncing, offline, last-updated timestamps on dashboards. Users on flaky school wifi need to know whether their work landed.
4. **Empty states must teach.** "No records found." → *"No students in Class 10-A yet"* + `Enrol student`. Distinguish empty-by-design, empty-by-filter (offer "Clear filters"), and error (offer "Retry") — currently identical.
5. **Errors must be actionable and located.** Field-level messages plus a top-of-form summary with jump links; never a bare "An error occurred."
6. **Defaults should encode the common case.** Attendance defaults to all-present (good). Extend: date defaults to today, class defaults to the teacher's next period, academic year defaults to active, fee month defaults to current.
7. **Progressive disclosure.** [ExamsPage.jsx](frontend/src/features/school-admin/pages/ExamsPage.jsx) is 3,863 lines in one screen; `TimetablePage` 1,594; `ClassesPage` 1,513. Split into focused task views with clear entry points rather than one page doing everything.
8. **Debounce every search** (only 3 exist) and preserve filter/scroll state when returning from a detail view.
9. **Keyboard support for repetitive work.** Data grids, dialogs (Esc/Enter), and ⌘K search. Admin staff doing hundreds of records daily are keyboard users whether or not the UI supports it.
10. **Offline tolerance.** Queue attendance/marks submissions locally and sync when connectivity returns — and remove the `if (!navigator.onLine) return null` line in [Toast.jsx](frontend/src/common/components/Toast.jsx) that suppresses all feedback precisely when things are failing.

---

## 4. Onboarding & first-run

The current [OnboardingScreen](frontend/src/features/school-admin/index.jsx#L67) correctly blocks on "create an academic year first," which is good sequencing. Extend it into a **setup checklist** that persists on the dashboard until complete:

☐ Academic year ☐ Classes & sections ☐ Fee structure ☐ Teachers ☐ Students ☐ Timetable ☐ Report-card template ☐ School logo & details

Show progress ("3 of 8"), let admins skip and return, and offer CSV import at the student/teacher steps. A new school admin currently has to infer this order by hitting errors. Add first-run coach marks on the academic-year switcher and the fee-collection flow — the two places where mistakes are most expensive.

---

## 5. Prioritised backlog

**P0 — correctness & data integrity (days, not weeks)**
1. Remove random marks pre-fill; empty state + validate against real max marks.
2. Fix attendance date dependency; load existing records; prevent silent overwrite.
3. Add `try/catch` + real error state to attendance submit (and audit the other fire-and-forget submits).
4. Unsaved-changes guard (router + `beforeunload`) app-wide.
5. Remove `!navigator.onLine` toast suppression.

**P1 — daily friction (1–2 weeks)**
6. Keyboard-navigable marks grid with autosave and per-row save state.
7. Search/filter + extra attendance states on the roll.
8. ⌘K global search; grouped and renamed sidebar.
9. Draft autosave + progress indicator + "Save & add another" on enrolment; replace placeholder-as-label.
10. Real empty states and consistent skeletons, modelled on `FinancePage`.

**P2 — throughput & reach (2–4 weeks)**
11. Bulk actions: fee reminders, report cards, promotions, CSV import.
12. Unified parent fee-payment flow + downloadable/shareable documents.
13. Mobile bottom-tab navigation; header child-switcher for parents.
14. Notifications for teacher/student/parent roles.
15. Setup checklist onboarding.
16. Per-tenant locale/currency; then language toggle.

**P3 — structural**
17. Split the 1,500–3,900-line screens into task-focused views.
18. Offline queue for attendance and marks.
19. Sticky/sortable/selectable tables with saved filters and virtualisation.

---

## 6. How to know it worked

Instrument these rather than guessing:

- **Time to mark attendance for one class** — target under 30 s (baseline: measure now)
- **Time to enter marks for 40 students** — target under 2 min
- **Enrolment form completion rate** and drop-off tab
- **Fee-payment funnel completion** on mobile
- **Rate of saves that error** (currently invisible — teachers may be losing work silently today)
- **Support tickets per school per month**, tagged by screen
