# Backend / Web Issues To Resolve Later

Found while doing the native-app parity inventory (see `native-app/PARITY_GAPS.md`).
`backend/` and `frontend/` were not modified — this list is for later triage.

- **Timetable endpoint contract mismatch (needs verification):** `native-app`'s `ApiService.kt` calls
  `GET api/school/timetable` with `class_id` (required) and `date` (optional) query params, but the
  backend also exposes `api/school/timetable/publish`, `/backup`, `/paste`, `/replace`, and
  `api/school/timetable-settings` as separate routes. Need to confirm the base `GET` route's actual
  required/optional params against `backend/src/Routes/api.php` controller code (not just the route
  list) before building out the native timetable screen, since the current native DTO may be based on
  an assumption rather than the real contract.
- **No other backend/web bugs identified in this pass** — this inventory only mapped routes/pages, it
  did not read implementation logic. A deeper backend code review may surface actual bugs; add them
  here when found.
