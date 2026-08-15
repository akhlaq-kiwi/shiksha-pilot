# Native App Module TODO

Source of truth: web sidebar items (`frontend/src/features/{school-admin,teacher,student-parent}/index.jsx`)
cross-checked against `native-app/.../MainActivity.kt` routing and screens. Ordered smallest/highest-priority first.
Each item: implement -> build verify -> commit -> push -> next.

## Bugs (misrouted / unreachable, fix first)
- [x] **Student/Parent had no Leave screen at all.** (Corrected: not actually misrouted — the admin
      `"leaves"` case only ever existed in the SCHOOL_ADMIN branch; Student/Parent simply had no entry
      point.) Fixed: new `StudentLeaveScreen` reusing the same shared `/api/school/leave-requests`
      endpoint/DTOs as `TeacherLeaveScreen`, wired `"student_leave"` route + dashboard tile
      (commit 20981f7).
- [x] **Teacher "Achievements" has no entry point.** Fixed: added a dashboard tile wired to the existing
      `"achievements"` route (commit 1d556ee).

## Small
- [x] **Transport Fee Management** — done (commit d089cfb): `SchoolAdminTransportFeesScreen`, wired
      into the Finance hub.
- [x] **School Expenses Tracking** — done (commit 78af1e8): `SchoolAdminExpensesScreen`, wired into
      the Finance hub. Bill attachment upload deferred (not implemented).
- [x] **Parent "My Children" switcher — DESCOPED (2026-08-16).** Investigated: web's entire
      `ParentPage`/child-switcher UI (`frontend/src/features/student-parent/index.jsx`) runs on
      hardcoded `MOCK_CHILDREN`/`MOCK_DATA` — there is no real backend endpoint that lists a parent's
      linked children (`resolveStudentsForUser` in `LeaveRequestService.php` is a private helper, not
      an exposed route). Building this in native-app would mean either faking data to match a mock, or
      adding a new backend endpoint (out of scope — backend/ not to be modified). Not implemented.

## Small-medium
- [x] **Late-Payment Penalty config** — done (commit 08a51ba): `SchoolAdminLatePaymentPenaltyScreen`
      (stats + percentage/description/active config). Bulk "apply penalty now" run/history
      (`late_payment_penalty_applications`) not implemented — config-only.
- [x] **Additional Fee Types** — done (commit f5e551d): `SchoolAdminAdditionalFeesScreen`, school-wide
      apply_type only (flat amount to all active students). Per-class custom-amount mode not
      implemented.
- [x] **Student Transfer Between Sections** — done (commit 0ef114b): multi-select + Transfer action
      in `SchoolAdminStudentsScreen` when viewing a class-filtered roster.

## Medium
- [x] **Class Identity Cards** — done (commit c412601): `SchoolAdminIdentityCardsScreen`, styled
      card view per student (no PDF export/print, view-only). Wired via Classes screen menu.

## Medium-large
- [ ] **Question Paper Designer — investigated, deferred (2026-08-16).**
      `school-admin/pages/QuestionPaperDesignerPage.jsx` is 3,837 lines and persists entirely to
      browser `localStorage` (`qpd_current_draft`, `qpd_saved_papers`, revision history) — there is
      **no backend route** for question papers at all (`grep -i "question\|paper" backend/src/Routes/api.php`
      returns nothing); it only calls existing `getClasses`/`getExaminations`/`getSubjects` for
      context. True parity means building a full rich document editor (sections, question types,
      marks allocation, revision history, print/export) with local-only persistence — a large,
      standalone effort on its own, not a quick module. Deferred; revisit as its own scoped task if
      wanted.
- [x] **Seating Plan Generator** — done (commit dacd921): `SchoolAdminSeatingPlanScreen`. Wired into
      the Education hub.

## Large
- [x] **Report Card Generation/Download — partially done (2026-08-16, commit 1349168).**
      `SchoolAdminReportCardsScreen`: admin picks exam + class, views every student's report card
      in that class (bulk view), reusing the existing `ReportCardDetailScreen`. PDF export /
      bulk-print / download and the 4 report-card-template rendering styles are NOT implemented —
      viewing only, single hardcoded layout (matches the student-side view's layout, not the
      web's template system).

## Confirmed out of scope / not gaps
- Super Admin back-office (explicit user decision, web-only).
- Report Card Template Management (super-admin only, not school-admin/teacher/student).
- No bulk CSV/enrollment import exists on web either — not a real gap.
- No chat/messaging or calendar/events module exists on web — not a gap.
- No distinct Parent-only feature set vs Student — unified `student-parent` feature; native's shared
  screens already match, aside from the "My Children" switcher above.
