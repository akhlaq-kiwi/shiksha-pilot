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
| School Admin Finance (fee structures, additional fees, transport fees, late-penalty, expenses, collection history, fee follow-up, financial reports, salary disbursement) | ✅ many pages | n/a | ✅ fee structures, fee collection + collection history, fee follow-ups, salary disbursement, financial reports (list/generate) split into dedicated screens; hub links out. Deferred: additional fees, transport fees, late-payment penalty, expenses, finance-settings, report export/settlement workflow | partial |
| School Admin Leave Requests | ✅ | n/a | ✅ | present |
| School Admin Announcements | ✅ | n/a | ✅ | present |
| School Admin Reports | ✅ | n/a | ✅ (stub, 196 lines) | partial |
| School Admin Security/Audit logs, login history | ✅ | n/a | ✅ | present |
| School Admin Profile (logo/signature) | ✅ | n/a | ✅ | present |
| School Admin Academic years, holidays, subjects, grade config | ✅ | n/a | ✅ (grade config view-only; migration deferred) | partial |
| School Admin Credentials generation | ✅ | n/a | ✅ | present |
| Teacher Dashboard | ✅ | n/a | ✅ | present |
| Teacher Attendance | ✅ | n/a | ✅ | present |
| Teacher Assignments/Homework | ✅ | ✅ (homework_list_screen) | ✅ (assignments only, no "homework" API used) | partial |
| Teacher Materials | ✅ | n/a | ✅ | present |
| Teacher Classes list | ✅ | n/a | ❌ (endpoint not called) | missing |
| Teacher Exams/Marks entry | ✅ (exams-new, marks-sheet) | n/a | ✅ (list/details/marks entry) | present |
| Teacher Salaries/receipts | ✅ | ✅ (salary_card_screen) | ❌ | missing |
| Teacher Leave (apply) | ✅ TeacherLeavePage | ✅ apply_leave_screen | ❌ | missing |
| Teacher Notifications | ✅ | ✅ notification_center_screen | ❌ | missing |
| Teacher Vocabulary report | ✅ | n/a | ✅ `TeacherVocabularyReportScreen` (read-only, class_id input) | present |
| Student/Parent Dashboard | ✅ | ✅ home_screen | ✅ | present |
| Student/Parent Academics/Results | ✅ AcademicsPage | ✅ exam_list/exam_detail | ✅ StudentResultsScreen (list/details/report card) | present |
| Student/Parent Attendance | ✅ | ✅ attendance_screen | ❌ (endpoint not consumed) | missing |
| Student/Parent Assignments/Homework | ✅ | ✅ homework_list_screen | ❌ (endpoint not consumed) | missing |
| Student/Parent Fees | ✅ FeesPage | ✅ fees_card_screen | ✅ StudentFeesScreen | present |
| Student/Parent Materials/Resources | ✅ ResourcesPage | n/a | ❌ (endpoint exists in ApiService, no screen) | partial |
| Student/Parent Leave (apply) | ✅ ParentLeavePage | ✅ apply_leave_screen/leave_list_screen | ❌ | missing |
| Student/Parent Timetable | ✅ | ✅ timetable_screen | ❌ (endpoint exists, no screen) | partial |
| Student/Parent Settings/Profile | ✅ SettingsPage | ✅ user_profile_screen/settings_screen | ❌ | missing |
| Achievements | ✅ AchievementsPage | ✅ achievements_screen | ✅ `StudentAchievementsScreen` (badge grid + report-card drill-down) | present |
| Word Builder Game | n/a (web) | ✅ word_builder_game_screen | ✅ `StudentWordBuilderScreen` (unscramble mechanic, real progress sync) | present |
| Notification center / push notifications | ✅ | ✅ notification_center_screen | ⚠️ `NotificationPreferencesScreen` (catalog + placeholder device registration only) | partial — real FCM push delivery NOT implemented, see note below |
| Super Admin (schools, plans, website leads, report-card templates) | ✅ full section | n/a | ❌ | missing entirely — confirm with user if in scope for native app (likely low priority, web-only backoffice) |

## Missing Screens/Features by Role

### schooladmin/ (native-app)
- Classes & Sections management
- Timetable (view/edit/publish/backup)
- Exams: `SchoolAdminExamsScreen` covers list/create/publish + class-status. Deferred (skip, not attempted): instructions editor, seating plan (generate/preview), admit-card publish/unpublish toggle in admin UI, admin report cards view, question paper designer (genuinely complex web-only tooling).
- Finance breakdown — done: `SchoolAdminFeeStructureScreen` (view/create fee structures), `SchoolAdminFeeCollectionScreen` (record fee payment + collection history), `SchoolAdminFeeFollowUpScreen` (list/contacted/extend/status), `SchoolAdminSalaryDisbursementScreen` (staff-payments list + disburse), `SchoolAdminFinancialReportsScreen` (list + generate). `SchoolAdminFinanceScreen` repurposed into a hub linking to these. Deferred (not attempted, still missing): additional fee types/payments, transport fees, late-payment-penalty config/history/stats, expenses, finance-settings, class-fee-configurations editor (monthly per-class amounts), financial report export (binary XLSX)/settle/settlement-request workflow, staff-payments disburse-previous-year bulk catch-up, class-course-fee-configurations.
- ~~Security: audit logs, login history~~ — done: `SchoolAdminSecurityScreen` (tabbed audit-logs + login-history, read-only, first 50 rows).
- ~~Profile: school profile, logo/signature upload~~ — done: `SchoolAdminProfileScreen` (view/edit school details + multipart logo/signature upload/remove). Distinct from `SettingsScreen.kt` (own-password change).
- ~~Academic years, holidays, subjects, grade configurations~~ — done: `SchoolAdminAcademicSetupScreen` (tabbed: academic years list+create+activate, holidays list+add+delete, subjects list+add+delete, grade configurations view-only). Deferred: academic year migration flow (`/{id}/migrate` — complex staff/student promotion, not called from native), grade-configuration edit/save (`POST grade-configurations` replaces the whole scale list; view-only here).
- ~~Credentials generation (student/staff login credential issuance)~~ — done: `SchoolAdminCredentialsScreen` (tabbed student/staff picker, per-row dialog to view existing or generate new credentials via `GET/POST api/school/credentials/*`).
- Attendance leaderboard
- Full student enrollment form (currently list/view only)

### teacher/ (native-app)
- Classes list screen (endpoint exists unused)
- ~~Exams / marks entry (exams-new, marks-sheet)~~ — done: `TeacherExamsScreen` + `TeacherMarksEntryScreen`.
- Salaries & salary receipts
- Leave application (apply/view own leave)
- Notifications center
- ~~Vocabulary report~~ — done: `TeacherVocabularyReportScreen`.

### studentparent/ (native-app)
- ~~Academics/Results screen~~ — done: `StudentResultsScreen` (exam list, details with scheme/admit-card/result, native report card view).
- Attendance screen (endpoint exists, unused)
- Assignments/Homework screen (endpoint exists, unused)
- Materials/Resources screen (endpoint exists, unused)
- Timetable screen (endpoint exists, unused)
- Leave application + leave list
- Settings/Profile screen
- ~~Achievements screen~~ — done: `StudentAchievementsScreen`.
- ~~Vocabulary games/challenges/leaderboard~~ — done: `StudentVocabularyScreen` (daily/weekly challenge review + leaderboard), `StudentWordBuilderScreen` (unscramble game with real progress/claim-daily sync), `ParentVocabularyReportScreen` (parent-role read-only report).

### Cross-cutting
- ~~Push notifications / device registration~~ — `NotificationPreferencesScreen` now consumes `/api/notifications/catalog`, `/api/notifications/device` (register/unregister), `/api/notifications/test-push`, but only with a placeholder (non-FCM) token — see item 8 below for the real-push gap.
- Change password / auth identify / profile update (`/api/auth/change-password`, `/api/auth/identify`, `/api/auth/profile`) — not implemented

## Backend API Endpoints Not Yet Consumed by Native App

native-app's `ApiService.kt` currently defines ~30 endpoints. Backend exposes ~195. Notably unconsumed:
- `/api/school/exams-new` (list/create/get/publish/class-status) now consumed by `SchoolAdminExamsScreen`. Still unconsumed: `/api/school/exams-new/{id}/instructions`, `/seating-plan(+/preview)`, `/publish-scheme`, `/unpublish-scheme`, `/publish-admit-card`, `/unpublish-admit-card`, `/report-cards`, `/timetable`, `/marks` (legacy per-mark endpoint — teacher marks entry uses `/marks-sheet` instead), and legacy `/api/school/exams`, `/api/school/exam-marks`, `/api/school/grade-configurations`
- Now consumed by the new finance screens: `/api/school/fee-structures`, `/api/school/class-fee-configurations` (GET only), `/api/school/fee-payments` (POST), `/api/school/collection-history`, `/api/school/fee-follow-ups` (+`/{id}/extend`,`/{id}/status`,`/{id}/contacted`), `/api/school/staff-payments` (GET+POST), `/api/school/financial-reports` (GET+POST). Still unconsumed: `/api/school/class-fee-configurations` POST/lock, `/api/school/class-course-fee-configurations`, `/api/school/annual-fees`, `/api/school/additional-fees/*`, `/api/school/transport-fees`, `/api/school/expenses`, `/api/school/late-payment-penalty/*`, `/api/school/finance-settings`, `/api/school/fee-follow-ups/{id}` GET details + `/notes`, `/api/school/financial-reports/{id}/export`, `/settle`, `/settlement-request`, `/preview`, `/api/school/staff-payments/disburse-previous-year`, `/api/school/fee-payments/{id}` DELETE.
- `/api/school/timetable/{publish,backup,paste,replace}` (only bare GET timetable is used, and with a different query pattern than backend expects — verify `class_id`/`date` params match backend controller)
- `/api/school/classes/sections`, `/api/school/classes/transfer-students`, `/api/school/classes/{id}/next-roll-no`
- Now consumed by the new back-office screens: `/api/school/security/audit-logs`, `/api/school/security/login-history`, `/api/school/profile` (GET/POST), `/api/school/profile/logo`(+DELETE), `/api/school/profile/signature`(+DELETE), `/api/school/academic-years` (GET/POST/activate), `/api/school/holidays` (GET/POST/DELETE), `/api/school/subjects` (GET/POST/DELETE), `/api/school/grade-configurations` (GET only), `/api/school/credentials/{role}/{id}` (GET), `/api/school/credentials/generate` (POST). Still unconsumed: `/api/school/security/audit-logs/log` (client-side action logging, write-only, not needed for a read-only viewer), `/api/school/academic-years/{id}/migrate`, `/api/school/holidays/{id}` PUT (edit, only add/delete built), `/api/school/subjects/{id}` PUT (edit, only add/delete built), `POST /api/school/grade-configurations` (save/replace scale list), `/api/school/attendance/leaderboard`
- `/api/teacher/exams-new/*` and `/api/teacher/exams-new/{id}/marks-sheet` now consumed by `TeacherExamsScreen`/`TeacherMarksEntryScreen`. `/api/teacher/vocabulary/report` now consumed by `TeacherVocabularyReportScreen`. Still unconsumed: legacy `/api/teacher/exams`, `/api/teacher/marks`, `/api/teacher/homework`, `/api/teacher/homework/{id}`, `/api/teacher/salaries*`, `/api/teacher/notifications*`, `/api/teacher/schedule/today`
- `/api/student/attendance`, `/api/student/assignments`, `/api/student/materials`, `/api/student/timetable` (all defined in native ApiService but no screen calls them)
- `/api/student/exams-new` (list/details) and `/api/student/exams-new/report-cards` now consumed by `StudentResultsScreen`. Still unconsumed: `/api/student/results`, `/api/student/homework`, `/api/student/fee-payments`, `/api/student/fees/card`, `/api/student/fees/receipt`
- `/api/student/notifications*`, `/api/student/announcements/{id}/read`
- ~~`/api/student/game/word-builder/*`, `/api/student/vocabulary/*`~~ — now consumed by `StudentWordBuilderScreen` and `StudentVocabularyScreen`/`StudentAchievementsScreen` (vocab achievements badges).
- `/api/parent/children` still unconsumed. ~~`/api/parent/vocabulary/report`~~ — now consumed by `ParentVocabularyReportScreen`.
- `/api/homework/upload-attachment`
- ~~`/api/notifications/catalog`, `/api/notifications/device`, `/api/notifications/test-push`~~ — now consumed by `NotificationPreferencesScreen` (device registration uses a placeholder non-FCM token; see item 8 below).
- `/api/auth/change-password`, `/api/auth/identify`, `/api/auth/profile`

Note: native-app also calls some endpoints (e.g. `api/school/leave-requests`, `api/school/announcements`, `api/teacher/*`, `api/student/*`) that broadly match backend paths — good baseline naming consistency was maintained, so extending `ApiService.kt` should mostly be additive (add DTOs/methods matching existing backend routes) rather than restructuring.

## Native App Files That Are Stubs/Incomplete

- ~~`SchoolAdminFinanceScreen.kt` generic stub~~ — repurposed into a finance module hub (linking to `SchoolAdminFeeStructureScreen`, `SchoolAdminFeeCollectionScreen`, `SchoolAdminFeeFollowUpScreen`, `SchoolAdminSalaryDisbursementScreen`, `SchoolAdminFinancialReportsScreen`). Deferred finance areas (additional/transport fees, late-payment penalty, expenses, finance-settings, report export/settlement) remain unbuilt — see Finance breakdown note above.
- `native-app/app/src/main/java/com/shikshapilot/nativeapp/features/schooladmin/screens/SchoolAdminReportsScreen.kt` (196 lines, shortest schooladmin screen) — likely a minimal placeholder vs. web's `ReportsPage.jsx` + `FinancialReportsPage.jsx`.
- `native-app/app/src/main/java/com/shikshapilot/nativeapp/features/teacher/screens/TeacherMaterialsScreen.kt` (189 lines, shortest overall) — check against web `MaterialsPage.jsx` for missing upload/edit flows.
- No native-app files exist yet for: timetable, classes, salaries, settings/profile, security/audit — these are gaps, not stubs (nothing to inspect). Exams is now implemented (`SchoolAdminExamsScreen`, `TeacherExamsScreen`, `TeacherMarksEntryScreen`, `StudentResultsScreen`) with instructions/seating-plan/admit-card-toggle/question-paper-designer deferred (see Suggested Implementation Order item 5). Notifications/achievements/vocabulary-games are now implemented (see Suggested Implementation Order item 8).

## Suggested Implementation Order

1. **Auth completeness**: change-password, profile view/edit (`/api/auth/*`) — small, unblocks settings screens for all roles.
2. **Student/Parent core screens using already-defined-but-unused endpoints**: Attendance, Assignments, Materials, Timetable — fastest wins since DTOs/API calls already exist in `ApiService.kt`.
3. **Teacher gaps using existing endpoints**: Classes list, then new: Leave application, Notifications, Salaries.
4. **School Admin Classes & Sections, Timetable** (view + publish) — needed by both admin and consumed by teacher/student timetable screens for consistency.
5. ~~**Exams suite** (school admin + teacher + student)~~ — done: core flow (admin list/create/publish/class-status, teacher list/details/marks entry, student list/details/report card) implemented in `SchoolAdminExamsScreen`, `TeacherExamsScreen`/`TeacherMarksEntryScreen`, `StudentResultsScreen`. Deferred as web-only/lower-priority: exam instructions editor, seating plan generation, admit-card publish/unpublish toggle in admin UI, admin-side report card viewer, and the question paper designer (explicitly out of scope — complex web-only tooling).
6. ~~**Finance breakdown**~~ — done: `SchoolAdminFeeStructureScreen`, `SchoolAdminFeeCollectionScreen` (record payment + collection history), `SchoolAdminFeeFollowUpScreen` (contacted/extend/status), `SchoolAdminSalaryDisbursementScreen`, `SchoolAdminFinancialReportsScreen` (list + generate), with `SchoolAdminFinanceScreen` repurposed into a hub. Deferred as nice-to-have (out of time budget, not attempted): additional fee types/payments, transport fees, late-payment-penalty config/history/stats, expenses, finance-settings, class-fee-configurations editor, financial report export/settle/settlement-request, staff-payments disburse-previous-year bulk catch-up.
7. ~~**Security/Profile/Academic setup**~~ — done: `SchoolAdminSecurityScreen`, `SchoolAdminProfileScreen`, `SchoolAdminAcademicSetupScreen`, `SchoolAdminCredentialsScreen`.
8. **Achievements + Vocabulary/games + push notifications** — DONE (partial on push):
   - `StudentAchievementsScreen` (`features/studentparent/screens/`) — GET `/api/school/achievements` badge/rank grid split into Attendance Champions / Academic Excellence tabs, drill-down dialog calling GET `/api/school/achievements/{id}/report-card` (reuses the shared `ReportCardDto`).
   - `StudentVocabularyScreen` — daily/weekly challenge tabs (GET+POST `/api/student/vocabulary/challenge/{daily,weekly}`; the submit endpoints don't read request body fields server-side, so the native flow requires the student to flip/review every word card before "Complete Challenge" unlocks) + a Leaderboard tab (GET `/api/student/vocabulary/leaderboard`, school/class/section scopes).
   - `StudentWordBuilderScreen` — word-builder game faithful to the Flutter reference's mechanic: letters shuffled, tap-to-assemble, auto-verify on full length, 3 lives/word, hint (-2 coins, reveals meaning), skip (-2 coins), streak bonus (+50 coins every 10-streak). Progress synced via GET/POST `/api/student/game/word-builder/progress` (`played_words:[{word_id,is_correct}]`); daily login bonus via POST `/api/student/game/word-builder/claim-daily`.
   - `TeacherVocabularyReportScreen` (`features/teacher/screens/`) — read-only GET `/api/teacher/vocabulary/report?class_id=` (manual class-id input field; native app has no shared class picker component yet).
   - `ParentVocabularyReportScreen` (`features/studentparent/screens/`) — read-only GET `/api/parent/vocabulary/report`. **Known limitation**: native-app's `MainActivity` still groups STUDENT and PARENT under one navigation branch with no deeper role-aware data split anywhere else in the codebase; this screen is wired to route only when `userRole == "PARENT"` (the `"vocabulary"` screen id branches on role), which is the minimal special-case needed since the backend genuinely requires the PARENT role for this endpoint (403 otherwise). A full STUDENT/PARENT UX split (e.g. distinct dashboards, parent multi-child switching via `student_id` query param) is out of scope here and should be tracked separately if product wants it.
   - `NotificationPreferencesScreen` (`features/studentparent/screens/`, also reachable from teacher and school-admin dashboards via a shared `"notification_preferences"` route since the catalog/device endpoints aren't role-specific) — GET `/api/notifications/catalog` rendered as toggleable category cards, POST `/api/notifications/device` device registration, POST `/api/notifications/test-push` trigger.
     **Push notifications are NOT actually delivered.** Confirmed by searching the entire `native-app/` tree: no `google-services.json`, no `com.google.gms.google-services` Gradle plugin, no `FirebaseMessagingService` subclass exist anywhere. The backend's push pipeline (`PushDispatcher`, `DeviceTokenController`, `NotificationCatalog`) is ready and functional server-side, but with no Firebase project wired into the Android app there is no way to obtain a real FCM token, so `NotificationPreferencesScreen` registers a locally-generated placeholder token string (`local-placeholder-<device>-<uuid>`) purely so the register/unregister/test-push API calls can be exercised against the live backend — the UI explicitly warns the user that push delivery is not live. To complete this: (1) create/attach a Firebase project and add `google-services.json` to `native-app/app/`, (2) add the `com.google.gms.google-services` Gradle plugin + `firebase-messaging` dependency, (3) implement a `FirebaseMessagingService` subclass that forwards the real token to POST `/api/notifications/device` on `onNewToken` and shows a local notification / deep-links via the `event_key`/`link` fields from the catalog on `onMessageReceived`, (4) register the service in `AndroidManifest.xml`.
9. **Super Admin section** — confirm with product/user whether this belongs in the native mobile app at all (web-only back-office pattern in most school-management products); do not build until confirmed in scope.
