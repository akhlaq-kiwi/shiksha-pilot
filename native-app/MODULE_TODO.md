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
- [ ] **School Expenses Tracking** — `FinanceManagementPage.jsx` tab `expenses` (incl. bill upload).
      API: `GET/POST/PUT/DELETE /api/school/expenses{,/{id}}`.
- [ ] **Parent "My Children" switcher** — student-parent sidebar `id: 'parent'`, parent-only. Multi-child
      list/switch view.

## Small-medium
- [ ] **Additional Fee / Late-Payment Penalty config** — `FinanceManagementPage.jsx` tabs `additional-fee`,
      `late-payment-penalty`.
- [ ] **Student Transfer Between Sections** — `ClassesPage.jsx` transfer dialog.
      API: `POST /api/school/classes/transfer-students`.

## Medium
- [ ] **Class Identity Cards generation/print** — `ClassesPage.jsx` (`view === 'identity-cards'`) +
      `components/ClassIdentityCardPreview.jsx`. Client-rendered from student/class data, no dedicated
      backend route found. Mobile equivalent likely a styled card view + share/print rather than PDF.

## Medium-large
- [ ] **Question Paper Designer** — `school-admin/pages/QuestionPaperDesignerPage.jsx`. Needs exact route
      confirmation in `ExamsController`/question-bank endpoints.
- [ ] **Seating Plan Generator** — `school-admin/pages/SeatingPlanPage.jsx`.
      API: `GET/POST /api/school/exams-new/{id}/seating-plan`, `.../preview`, `DELETE .../seating-plan`.

## Large
- [ ] **Report Card Generation/Download (admin bulk + PDF)** — `report-card-templates/*` (4 templates) +
      admin trigger via `ExamsPage.jsx`. API: `GET /api/school/exams-new/{id}/report-cards`,
      `GET /api/school/achievements/{id}/report-card`. Native `StudentResultsScreen.kt` only has
      read-only student-side viewing, no PDF/download/bulk-generate flow.

## Confirmed out of scope / not gaps
- Super Admin back-office (explicit user decision, web-only).
- Report Card Template Management (super-admin only, not school-admin/teacher/student).
- No bulk CSV/enrollment import exists on web either — not a real gap.
- No chat/messaging or calendar/events module exists on web — not a gap.
- No distinct Parent-only feature set vs Student — unified `student-parent` feature; native's shared
  screens already match, aside from the "My Children" switcher above.
