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
