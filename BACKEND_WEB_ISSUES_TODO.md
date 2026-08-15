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
- **New finding — LeaveRequestItemDto date field-name mismatch (native-app only, found while building
  TeacherLeaveScreen.kt, 2026-08-15):** `LeaveRequestItemDto` in `native-app/.../data/remote/ApiService.kt`
  (used by `SchoolAdminLeaveRequestsScreen.kt` via `GET api/school/leave-requests`) declares
  `start_date`/`end_date`, but the real `leave_requests` table columns (see
  `backend/src/Database/Migrations/001_baseline_schema.sql` and
  `backend/src/Domain/SchoolAdmin/Repositories/LeaveRequestRepository.php::findWithDetails()`, which does
  `SELECT lr.*, ...`) are actually `from_date`/`to_date`. This means
  `SchoolAdminLeaveRequestsScreen.kt`'s date rendering silently gets nulls from the real API (it currently
  only "works" against its own hardcoded default/demo data). Not fixed here because
  `SchoolAdminLeaveRequestsScreen.kt` predates this task and wasn't otherwise touched — fixing
  `LeaveRequestItemDto`'s field names would require also updating that screen's rendering code. The new
  `TeacherLeaveScreen.kt` added in this pass avoids the bug entirely by using a separate, correctly-named
  `TeacherLeaveItemDto` (`from_date`/`to_date`) for `GET/POST api/school/leave-requests` instead of reusing
  the mismatched `LeaveRequestItemDto`.
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
