# Native App Feature Parity Gap Analysis

Compares `native-app/` (Android, Kotlin/Compose) against `frontend/` (React web) and `app/` (Flutter) and
`backend/src/Routes/api.php` (195 endpoints). `backend/`, `frontend/`, `app/` must NOT be modified —
this file only tracks what native-app still needs to build.

## Roles & Features Matrix

| Feature | web (frontend/) | Flutter (app/) | native-app | Status |
|---|---|---|---|---|
| Login/auth | ✅ | ✅ | ✅ (login only) | partial — no change-password, identify, profile update |
| School Admin Dashboard/stats | ✅ | n/a | ✅ | present |
| School Admin Attendance | ✅ + leaderboard | n/a | ✅ (no leaderboard) | partial |
| School Admin Students (CRUD, enrollment) | ✅ full form | n/a | ✅ (list only, `StudentEnrollmentForm` equiv missing) | partial |
| School Admin Staff | ✅ | n/a | ✅ (list only) | partial |
| School Admin Classes/Sections | ✅ | n/a | ❌ | missing |
| School Admin Timetable (+publish/backup/paste/replace) | ✅ | n/a | ❌ | missing |
| School Admin Exams (exams-new: instructions, marks, seating plan, report cards, question paper designer) | ✅ extensive | n/a | ✅ (list/create/publish + class-status; instructions/seating plan/admit-card toggle/report cards/question paper designer deferred) | partial |
| School Admin Finance (fee structures, additional fees, transport fees, late-penalty, expenses, collection history, fee follow-up, financial reports, salary disbursement) | ✅ many pages | n/a | ✅ single `SchoolAdminFinanceScreen` stub | mostly missing |
| School Admin Leave Requests | ✅ | n/a | ✅ | present |
| School Admin Announcements | ✅ | n/a | ✅ | present |
| School Admin Reports | ✅ | n/a | ✅ (stub, 196 lines) | partial |
| School Admin Security/Audit logs, login history | ✅ | n/a | ❌ | missing |
| School Admin Profile (logo/signature) | ✅ | n/a | ❌ | missing |
| School Admin Academic years, holidays, subjects, grade config | ✅ | n/a | ❌ | missing |
| School Admin Credentials generation | ✅ | n/a | ❌ | missing |
| Teacher Dashboard | ✅ | n/a | ✅ | present |
| Teacher Attendance | ✅ | n/a | ✅ | present |
| Teacher Assignments/Homework | ✅ | ✅ (homework_list_screen) | ✅ (assignments only, no "homework" API used) | partial |
| Teacher Materials | ✅ | n/a | ✅ | present |
| Teacher Classes list | ✅ | n/a | ❌ (endpoint not called) | missing |
| Teacher Exams/Marks entry | ✅ (exams-new, marks-sheet) | n/a | ✅ (list/details/marks entry) | present |
| Teacher Salaries/receipts | ✅ | ✅ (salary_card_screen) | ❌ | missing |
| Teacher Leave (apply) | ✅ TeacherLeavePage | ✅ apply_leave_screen | ❌ | missing |
| Teacher Notifications | ✅ | ✅ notification_center_screen | ❌ | missing |
| Teacher Vocabulary report | ✅ | n/a | ❌ | missing |
| Student/Parent Dashboard | ✅ | ✅ home_screen | ✅ | present |
| Student/Parent Academics/Results | ✅ AcademicsPage | ✅ exam_list/exam_detail | ✅ StudentResultsScreen (list/details/report card) | present |
| Student/Parent Attendance | ✅ | ✅ attendance_screen | ❌ (endpoint not consumed) | missing |
| Student/Parent Assignments/Homework | ✅ | ✅ homework_list_screen | ❌ (endpoint not consumed) | missing |
| Student/Parent Fees | ✅ FeesPage | ✅ fees_card_screen | ✅ StudentFeesScreen | present |
| Student/Parent Materials/Resources | ✅ ResourcesPage | n/a | ❌ (endpoint exists in ApiService, no screen) | partial |
| Student/Parent Leave (apply) | ✅ ParentLeavePage | ✅ apply_leave_screen/leave_list_screen | ❌ | missing |
| Student/Parent Timetable | ✅ | ✅ timetable_screen | ❌ (endpoint exists, no screen) | partial |
| Student/Parent Settings/Profile | ✅ SettingsPage | ✅ user_profile_screen/settings_screen | ❌ | missing |
| Achievements | ✅ AchievementsPage | ✅ achievements_screen | ❌ | missing |
| Word Builder Game | n/a (web) | ✅ word_builder_game_screen | ❌ | missing (Flutter-only feature) |
| Notification center / push notifications | ✅ | ✅ notification_center_screen | ❌ | missing entirely (no FCM/device registration) |
| Super Admin (schools, plans, website leads, report-card templates) | ✅ full section | n/a | ❌ | missing entirely — confirm with user if in scope for native app (likely low priority, web-only backoffice) |

## Missing Screens/Features by Role

### schooladmin/ (native-app)
- Classes & Sections management
- Timetable (view/edit/publish/backup)
- Exams: `SchoolAdminExamsScreen` covers list/create/publish + class-status. Deferred (skip, not attempted): instructions editor, seating plan (generate/preview), admit-card publish/unpublish toggle in admin UI, admin report cards view, question paper designer (genuinely complex web-only tooling).
- Finance breakdown: fee structures, additional fees, transport fees, late-payment penalty, expenses, collection history, fee follow-ups, financial reports, salary disbursement (currently one generic `SchoolAdminFinanceScreen`)
- Security: audit logs, login history
- Profile: school profile, logo/signature upload
- Academic years, holidays, subjects, grade configurations
- Credentials generation (student/staff login credential issuance)
- Attendance leaderboard
- Full student enrollment form (currently list/view only)

### teacher/ (native-app)
- Classes list screen (endpoint exists unused)
- ~~Exams / marks entry (exams-new, marks-sheet)~~ — done: `TeacherExamsScreen` + `TeacherMarksEntryScreen`.
- Salaries & salary receipts
- Leave application (apply/view own leave)
- Notifications center
- Vocabulary report

### studentparent/ (native-app)
- ~~Academics/Results screen~~ — done: `StudentResultsScreen` (exam list, details with scheme/admit-card/result, native report card view).
- Attendance screen (endpoint exists, unused)
- Assignments/Homework screen (endpoint exists, unused)
- Materials/Resources screen (endpoint exists, unused)
- Timetable screen (endpoint exists, unused)
- Leave application + leave list
- Settings/Profile screen
- Achievements screen
- Vocabulary games/challenges/leaderboard (student engagement feature set, exists only in web+backend)

### Cross-cutting
- Push notifications / device registration (`/api/notifications/device`, `/api/notifications/test-push`) — not implemented at all
- Change password / auth identify / profile update (`/api/auth/change-password`, `/api/auth/identify`, `/api/auth/profile`) — not implemented

## Backend API Endpoints Not Yet Consumed by Native App

native-app's `ApiService.kt` currently defines ~30 endpoints. Backend exposes ~195. Notably unconsumed:
- `/api/school/exams-new` (list/create/get/publish/class-status) now consumed by `SchoolAdminExamsScreen`. Still unconsumed: `/api/school/exams-new/{id}/instructions`, `/seating-plan(+/preview)`, `/publish-scheme`, `/unpublish-scheme`, `/publish-admit-card`, `/unpublish-admit-card`, `/report-cards`, `/timetable`, `/marks` (legacy per-mark endpoint — teacher marks entry uses `/marks-sheet` instead), and legacy `/api/school/exams`, `/api/school/exam-marks`, `/api/school/grade-configurations`
- All `/api/school/*fee*`, `/api/school/expenses`, `/api/school/financial-reports`, `/api/school/collection-history`, `/api/school/staff-payments`, `/api/school/late-payment-penalty/*`
- `/api/school/timetable/{publish,backup,paste,replace}` (only bare GET timetable is used, and with a different query pattern than backend expects — verify `class_id`/`date` params match backend controller)
- `/api/school/classes/sections`, `/api/school/classes/transfer-students`, `/api/school/classes/{id}/next-roll-no`
- `/api/school/security/*`, `/api/school/profile*`, `/api/school/academic-years/*`, `/api/school/holidays/*`, `/api/school/subjects/*`, `/api/school/grade-configurations`, `/api/school/credentials/*`, `/api/school/attendance/leaderboard`
- `/api/teacher/exams-new/*` and `/api/teacher/exams-new/{id}/marks-sheet` now consumed by `TeacherExamsScreen`/`TeacherMarksEntryScreen`. Still unconsumed: legacy `/api/teacher/exams`, `/api/teacher/marks`, `/api/teacher/homework`, `/api/teacher/homework/{id}`, `/api/teacher/salaries*`, `/api/teacher/notifications*`, `/api/teacher/schedule/today`, `/api/teacher/vocabulary/report`
- `/api/student/attendance`, `/api/student/assignments`, `/api/student/materials`, `/api/student/timetable` (all defined in native ApiService but no screen calls them)
- `/api/student/exams-new` (list/details) and `/api/student/exams-new/report-cards` now consumed by `StudentResultsScreen`. Still unconsumed: `/api/student/results`, `/api/student/homework`, `/api/student/fee-payments`, `/api/student/fees/card`, `/api/student/fees/receipt`
- `/api/student/notifications*`, `/api/student/announcements/{id}/read`
- `/api/student/game/word-builder/*`, `/api/student/vocabulary/*`
- `/api/parent/children`, `/api/parent/vocabulary/report`
- `/api/homework/upload-attachment`
- `/api/notifications/catalog`, `/api/notifications/device`, `/api/notifications/test-push`
- `/api/auth/change-password`, `/api/auth/identify`, `/api/auth/profile`

Note: native-app also calls some endpoints (e.g. `api/school/leave-requests`, `api/school/announcements`, `api/teacher/*`, `api/student/*`) that broadly match backend paths — good baseline naming consistency was maintained, so extending `ApiService.kt` should mostly be additive (add DTOs/methods matching existing backend routes) rather than restructuring.

## Native App Files That Are Stubs/Incomplete

- `native-app/app/src/main/java/com/shikshapilot/nativeapp/features/schooladmin/screens/SchoolAdminFinanceScreen.kt` (311 lines) — covers only one generic finance view; backend/web split finance into ~8 dedicated pages/endpoints.
- `native-app/app/src/main/java/com/shikshapilot/nativeapp/features/schooladmin/screens/SchoolAdminReportsScreen.kt` (196 lines, shortest schooladmin screen) — likely a minimal placeholder vs. web's `ReportsPage.jsx` + `FinancialReportsPage.jsx`.
- `native-app/app/src/main/java/com/shikshapilot/nativeapp/features/teacher/screens/TeacherMaterialsScreen.kt` (189 lines, shortest overall) — check against web `MaterialsPage.jsx` for missing upload/edit flows.
- No native-app files exist yet for: timetable, classes, salaries, notifications, settings/profile, achievements, vocabulary/games, security/audit — these are gaps, not stubs (nothing to inspect). Exams is now implemented (`SchoolAdminExamsScreen`, `TeacherExamsScreen`, `TeacherMarksEntryScreen`, `StudentResultsScreen`) with instructions/seating-plan/admit-card-toggle/question-paper-designer deferred (see Suggested Implementation Order item 5).

## Suggested Implementation Order

1. **Auth completeness**: change-password, profile view/edit (`/api/auth/*`) — small, unblocks settings screens for all roles.
2. **Student/Parent core screens using already-defined-but-unused endpoints**: Attendance, Assignments, Materials, Timetable — fastest wins since DTOs/API calls already exist in `ApiService.kt`.
3. **Teacher gaps using existing endpoints**: Classes list, then new: Leave application, Notifications, Salaries.
4. **School Admin Classes & Sections, Timetable** (view + publish) — needed by both admin and consumed by teacher/student timetable screens for consistency.
5. ~~**Exams suite** (school admin + teacher + student)~~ — done: core flow (admin list/create/publish/class-status, teacher list/details/marks entry, student list/details/report card) implemented in `SchoolAdminExamsScreen`, `TeacherExamsScreen`/`TeacherMarksEntryScreen`, `StudentResultsScreen`. Deferred as web-only/lower-priority: exam instructions editor, seating plan generation, admit-card publish/unpublish toggle in admin UI, admin-side report card viewer, and the question paper designer (explicitly out of scope — complex web-only tooling).
6. **Finance breakdown** (fee structures, additional/transport fees, late-penalty, expenses, collection history, follow-ups, financial reports, salary disbursement) — second-largest area, split into incremental screens matching web pages one-for-one.
7. **Security/Profile/Academic setup** (audit logs, login history, school profile, academic years, holidays, subjects, grade config, credentials generation) — lower daily-use priority, admin setup/back-office features.
8. **Achievements + Vocabulary/games + push notifications** — student engagement layer, do last unless product explicitly prioritizes it.
9. **Super Admin section** — confirm with product/user whether this belongs in the native mobile app at all (web-only back-office pattern in most school-management products); do not build until confirmed in scope.
