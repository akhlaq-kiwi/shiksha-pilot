# Backend / Web Issues To Resolve Later

Found while doing the native-app parity inventory (see `native-app/PARITY_GAPS.md`).
`backend/` and `frontend/` were not modified — this list is for later triage.

- **Timetable endpoint contract — RESOLVED (2026-08-15):** Verified against
  `backend/src/Domain/SchoolAdmin/Controllers` (school-admin `GET api/school/timetable`) vs.
  `backend/src/Domain/Student/Controllers/StudentController::getTimetable` +
  `StudentDataRepository::getTimetable` (student-facing `GET api/student/timetable`). These are two
  genuinely different contracts, and native-app's `ApiService.kt` already matches each correctly:
  - School-admin `GET api/school/timetable` requires `class_id` (the admin can view any class) plus
    optional `date` — native's `getTimetable(classId, date)` in `ApiService.kt` matches this.
  - Student/parent `GET api/student/timetable` takes **no `class_id`** — `StudentController::getTimetable`
    resolves the caller's own student record server-side (`$this->resolveStudent($user)`) and derives
    `class_id`/`school_id` from it before calling `StudentDataRepository::getTimetable($classId, $schoolId, $date)`.
    Only an optional `date` query param is honored. Native's existing `getStudentTimetable()` (no params,
    just the auth header) is therefore correct as-is — no native-app change was needed here.
  - One nuance for anyone building further on this: `StudentDataRepository::getTimetable()` returns a
    **flat JSON array** of period rows for a single resolved day (today, or `?date=`), filtered by
    `day_of_week` — it is NOT grouped/keyed by day server-side. `TimetableResponseDto.data` in
    `ApiService.kt` is typed as a generic `JsonElement` for both the admin and student variants, so
    native-app must parse that flat array into `List<TimetableItemDto>` itself (now done in
    `native-app/.../studentparent/screens/StudentTimetableScreen.kt`); it was previously unparsed by
    any screen.
- **Announcements DTO field-name mismatch — RESOLVED (2026-08-15):** `AnnouncementItemDto` in
  `native-app/.../data/remote/ApiService.kt` and `SchoolAdminAnnouncementsScreen.kt` have been updated
  to use the real backend field names (`subject`/`description`/`audience`/`status`/`published_at`)
  instead of the previous `title`/`content`/`target_audience`/`is_urgent`. No backend change was
  needed; this was purely a native-app DTO bug. Details of the original mismatch investigation kept
  below for reference.
- **LeaveRequestItemDto date field-name mismatch — RESOLVED (2026-08-15):** `LeaveRequestItemDto` in
  `native-app/.../data/remote/ApiService.kt` (used by `SchoolAdminLeaveRequestsScreen.kt` via
  `GET api/school/leave-requests`) declared `start_date`/`end_date`, but the real `leave_requests`
  table columns (see `backend/src/Database/Migrations/001_baseline_schema.sql` and
  `backend/src/Domain/SchoolAdmin/Repositories/LeaveRequestRepository.php::findWithDetails()`, which does
  `SELECT lr.*, ...`) are actually `from_date`/`to_date`. Fixed by renaming the DTO's fields to
  `from_date`/`to_date` and updating `SchoolAdminLeaveRequestsScreen.kt`'s demo data + date-rendering
  logic (`datesStr`) to match, so leave request dates now render/submit correctly against the real API.
  No backend change was needed; this was purely a native-app DTO bug. The existing `TeacherLeaveScreen.kt`
  already used a separate, correctly-named `TeacherLeaveItemDto` (`from_date`/`to_date`) and needed no
  change.
- **New finding — Announcements DTO field-name mismatch (native-app only, not yet touched in backend):**
  `AnnouncementItemDto` in `native-app/.../data/remote/ApiService.kt` (used by school-admin's
  `GET/POST api/school/announcements`) declares fields `title`, `content`, `target_audience`,
  `is_urgent`. The actual `announcements` table / backend contract
  (`backend/src/Domain/SchoolAdmin/Services/SchoolAdminService.php::getAnnouncements()` does
  `SELECT * FROM announcements`, and `createAnnouncement()` builds
  `INSERT INTO announcements (school_id, subject, description, audience, status, published_at, created_by)`)
  uses `subject`, `description`, `audience`, `status`, `published_at` instead — there is no `content`,
  `title`, `target_audience`, or `is_urgent` column. This means `SchoolAdminAnnouncementsScreen.kt`'s
  list rendering and its broadcast/create dialog are silently sending/reading the wrong JSON keys
  (Gson will leave the mismatched fields null since key names don't line up). Out of scope to fix here
  since `SchoolAdminAnnouncementsScreen.kt` predates this task and wasn't otherwise touched, but this is
  a real bug worth fixing: either rename the Kotlin DTO fields to match the real columns, or (if the web
  frontend also expects `title`/`content`) confirm whether `SchoolAdminService.php` itself has a stale
  or duplicate write path. For the new read-only `StudentAnnouncementsScreen.kt` added in this pass
  (`GET api/student/announcements`), a separate, correctly-named `StudentAnnouncementItemDto`
  (`subject`/`description`/`audience`/`status`/`published_at`/`is_read`) was added instead of reusing
  the mismatched `AnnouncementItemDto`.
- **New finding — no `GET /api/school/classes/sections` endpoint exists (native-app only, found while
  building `SchoolAdminClassesScreen.kt`, 2026-08-15):** `backend/src/Routes/api.php` only registers
  `DELETE /api/school/classes/sections` (`SchoolAdminController::deleteSection`) — there is no GET
  route to list sections separately. `GET /api/school/classes` (`SchoolAdminController::getClasses` ->
  `ClassRepository::findBySchool`, `SELECT c.*, ay.name AS academic_year_name FROM classes ...`)
  already returns one row per class+section combination (the `classes` table has a `section` column
  directly on each row, not a nested list), so the new native `SchoolAdminClassesScreen.kt` derives
  sections/section-counts by grouping the `getClasses()` response by class `name` client-side instead
  of calling a nonexistent sections endpoint. Also worth noting for anyone extending this further: the
  `classes` table has no `student_count` or `class_teacher` column/join, so those "extend ClassDto"
  ideas from the parity task description aren't backed by this endpoint's actual contract — a per-class
  student count would need a separate `COUNT(*) FROM students WHERE class_id = ...` call (not added
  here, out of scope for a view+publish-focused pass). Not a bug, just documenting the real contract
  so it isn't re-investigated.
- **New finding — full class create/update via `/api/school/classes` is a name+sections "master
  catalog" operation, not simple per-row CRUD (native-app only, 2026-08-15):**
  `SchoolAdminService::createClass`/`updateClass` resolve the submitted class `name` (or `class_id`)
  and each of up to 4 `sections` against master Class/Section catalogs, then insert/update one
  `classes` row per section (matching by old name/section on update). `deleteClass` requires a `name`
  and refuses if any students are enrolled in that class across any section. Native's new
  `SchoolAdminClassesScreen.kt` added the `createClass`/`updateClass`/`deleteClass`/`getNextRollNo`
  DTOs and Retrofit methods to `ApiService.kt` to match this contract, but the screen itself is
  currently view-only (list of classes grouped by name/sections) — add/edit/delete UI using these new
  methods is a follow-up if the product wants full parity with the web admin's class management UI.
