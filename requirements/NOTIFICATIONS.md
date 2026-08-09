# Notifications — Architecture, Catalog & Firebase Setup

Two delivery mechanisms, one catalog.

| | **Local** | **Push (live)** |
|---|---|---|
| Trigger | The device, from data it already has | A server-side business event |
| Needs network | No | Yes |
| Cost per notification | Zero | One FCM HTTP request (or one per *topic*, not per device) |
| Used for | Reminders — "due tomorrow", "not marked yet" | Everything that happens on the server |
| Survives app being killed | Yes (Android alarm) | Yes (FCM wakes the app) |

The source of truth is always the `dashboard_notifications` row. A push is a
courtesy copy — if it fails, the notification still appears in the in-app
notification centre. **A Firebase outage can never fail a fee payment.**

---

## 1. Notification catalog

33 events. `event_key` is the stable identity — the app routes deep links from
it rather than substring-matching the notification copy, which is what it used
to do (and which could not tell an exam result from an admit card, since both
are titled with the exam name).

### LEAVE — 6 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `LEAVE_REQUEST_SUBMITTED` | Push | School Admin | high | Teacher/student submits a leave request |
| `LEAVE_APPROVED` | Push | Teacher, Parent | high | Admin approves a leave request |
| `LEAVE_REJECTED` | Push | Teacher, Parent | high | Admin rejects a leave request |
| `LEAVE_CANCELLED_BY_APPLICANT` | Push | School Admin | normal | Applicant cancels their own request |
| `LEAVE_CANCELLED_BY_ADMIN` | Push | Teacher, Parent | high | Admin cancels someone's request |
| `HOLIDAY_ANNOUNCED` | Push (topic) | Teacher, Student, Parent | normal | Admin adds a school holiday |

### ACADEMIC — 4 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `HOMEWORK_ASSIGNED` | Push | Student, Parent | high | Teacher assigns homework to a class |
| `HOMEWORK_DUE_REMINDER` | **Local** | Student, Parent | high | 6pm the evening before the due date |
| `TIMETABLE_UPDATED` | Push | Teacher, Student, Parent | normal | Class timetable changes |
| `SUBSTITUTE_ASSIGNED` | Push | Teacher | high | Teacher assigned as a substitute |

### EXAM — 7 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `EXAM_SCHEDULED` | Push (topic) | Teacher, Student, Parent | high | Examination created/published with dates |
| `EXAM_SCHEME_PUBLISHED` | Push | Student, Parent, Teacher | high | Exam scheme published |
| `EXAM_SCHEME_UNPUBLISHED` | Push | Student, Parent, Teacher | normal | Exam scheme reverted to draft |
| `EXAM_ADMIT_CARD_PUBLISHED` | Push (per-user) | Student, Parent | high | Admit card published |
| `EXAM_ADMIT_CARD_UNPUBLISHED` | Push (per-user) | Student, Parent | normal | Admit card reverted to draft |
| `EXAM_RESULT_PUBLISHED` | Push (per-user) | Student, Parent | high | Result published |
| `EXAM_STARTS_TOMORROW` | **Local** | Student, Parent | high | 7pm the evening before an exam starts |

### FEES — 9 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `FEE_ADMISSION_ADDED` | Push | Student, Parent | normal | Admission fee added at enrolment |
| `FEE_ANNUAL_ADDED` | Push | Student, Parent | normal | Annual fee applied |
| `FEE_TRANSPORT_GENERATED` | Push | Student, Parent | normal | Monthly transport fee auto-generated |
| `FEE_PAYMENT_RECORDED` | Push | Student, Parent | high | Payment recorded (receipt available) |
| `FEE_PAYMENT_REVERTED` | Push | Student, Parent | high | A recorded payment was reverted |
| `FEE_PENALTY_APPLIED` | Push | Student, Parent | high | Late-payment penalty applied |
| `FEE_DUE_REMINDER` | **Local** | Student, Parent | high | 10am, 3 days before the due date |
| `FEE_FOLLOWUP_DUE_TODAY` | Push | School Admin | high | Follow-up promise date is today |
| `FEE_FOLLOWUP_OVERDUE` | Push | School Admin | high | Follow-up promise date has passed |

Fee *bookkeeping* (charges added) is `normal` priority; fee *money movement*
(paid, reverted, penalised) is `high`. A parent should not get an interrupting
buzz because a routine monthly charge was generated, but should for a payment.

### ATTENDANCE — 2 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `ATTENDANCE_MARKED_ABSENT` | Push | Parent | high | Child marked absent today |
| `ATTENDANCE_NOT_MARKED_REMINDER` | **Local** | Teacher | high | 11am on weekdays if attendance still pending |

### ANNOUNCEMENT — 1 event
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `ANNOUNCEMENT_PUBLISHED` | Push (topic) | Teacher, Student, Parent | high | Notice created or updated |

### ACHIEVEMENT — 2 events
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `ACHIEVEMENT_ATTENDANCE_AWARD` | Push | Student, Parent | normal | Attendance champion certificate issued |
| `ACHIEVEMENT_ACADEMIC_TOPPER` | Push | Student, Parent | normal | Academic excellence certificate issued |

### ADMIN — 1 event
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `SUBSCRIPTION_UPGRADED` | Push | School Admin | normal | Platform admin upgrades the school's plan |

### SYSTEM — 1 event
| Event key | Delivery | Audience | Priority | Trigger |
|---|---|---|---|---|
| `FILE_DOWNLOAD_COMPLETE` | **Local** | All | normal | A PDF finished downloading (tap to open) |

**Totals:** 28 push, 5 local. Each category is an Android notification channel,
so a user can mute *Fees & Payments* while keeping *Attendance* audible — which
a single shared channel makes impossible.

---

## 2. Why this is cheap to run

The app used to poll `/api/*/notifications` **every 15 minutes from every
installed device**. For 1,000 devices that is ~96,000 requests/day of pure idle
load, every one of them hitting PHP, opening a MySQL connection and running the
`authenticate()` double-query — on shared hosting, the single largest source of
baseline load.

Four decisions replace that:

1. **Push replaces polling.** The WorkManager poll drops from 15 minutes to
   **6 hours** and becomes a safety net (catches a revoked permission, a token
   that rotated while offline, an FCM drop). ~96% less idle API traffic.

2. **Broadcasts use FCM topics.** FCM HTTP v1 has no multicast, so notifying a
   500-parent school is either **1 topic request or 500 token requests**. Topics
   are the only viable option here. Holidays, announcements and exam schemes go
   this way.
   *Tradeoff, stated plainly:* a client can subscribe to any topic name it
   likes, so topics carry only school-wide, non-personal content. Anything
   naming a specific child, amount or result (`EXAM_RESULT_PUBLISHED`,
   `FEE_PAYMENT_RECORDED`, `ATTENDANCE_MARKED_ABSENT`) is sent **per-token** to
   that user's devices only.

3. **The OAuth token is cached in the DB for its full hour** (`push_oauth_cache`).
   Minting it costs an RS256 signature plus a TLS round trip to Google; doing
   that per notification would roughly double the latency of every write that
   notifies.

4. **No new composer dependencies.** The obvious pick, `kreait/firebase-php`,
   pulls in Guzzle and a dozen transitive packages. `FcmClient` is one file on
   cURL + `openssl_sign` — smaller `vendor/`, less autoload work per request.

Also: per-token fan-out is capped at 40 devices per notification
(`PushDispatcher::MAX_TOKEN_FANOUT`). Past that the in-app centre carries it.

---

## 2b. What this costs

### Firebase: ₹0

Cloud Messaging is listed as **"No-cost"** on Firebase's own pricing page, on
both the Spark (free) and Blaze (pay-as-you-go) plans. No per-message charge, no
message cap, no overage. You do **not** need to enable billing or move to Blaze
to use FCM — and this implementation uses no other Firebase product, so there is
nothing else on the bill.

The only way Firebase starts costing money is if someone later adds Firestore,
Cloud Functions, Storage or Hosting to the same project. Messaging alone stays
free at any volume.

### Your server: net saving, not a net cost

The real cost was never Firebase — it was the API load. Modelled on one
**500-student school (~1,030 devices:** 500 students, 500 parents, 30 teachers,
3 admins):

| | Requests / month |
|---|---|
| **Removed** — 15-min poll from every device | **−2,975,040** |
| **Added back** — 6-hour safety-net poll | +123,960 |
| **Added** — outbound FCM sends | +6,692 |
| **Net change** | **≈ −2.84 million requests/month** |

That is a **95.8% cut in inbound API traffic**. Each removed poll was a full PHP
request: bootstrap, DI container, a MySQL connection, and `authenticate()`'s
two extra verification queries. On shared hosting this was the dominant source
of baseline load and the main thing that would have forced a plan upgrade as
schools were added.

Breakdown of the 6,692 outbound sends:

| Source | Requests / month | Why so few |
|---|---|---|
| Homework (per-token, capped 40) | 4,800 | 120 assignments × 40 |
| Fees (student + parent) | 1,000 | 500 monthly fee events × 2 |
| OAuth token mint | 720 | Cached 1 hour, so 24/day |
| Leave decisions | 100 | |
| Announcements (**topic**) | 60 | 20 notices × 3 roles — *not* × 1,030 devices |
| Exam broadcasts (**topic**) | 12 | 4 events × 3 roles |

Topics are what keep the bottom two rows at two digits. Sent per-token they
would be ~20,000 and ~4,000 instead.

**Scaling:** outbound sends grow with *events*, not devices — broadcasts are
flat, and per-user fan-out is capped at 40. Ten schools ≈ 67k sends/month, still
trivial. The poll, by contrast, grows linearly with devices, which is exactly
why cutting it mattered more than anything else here.

### One real hazard, and how it is bounded

Sends are synchronous inside the request that triggered them. Assigning homework
to a class fans out to up to 40 tokens sequentially:

| Per-send latency | Total added to the teacher's save |
|---|---|
| 150 ms (typical) | 6.0 s |
| 250 ms | 10.0 s |
| 6 s (cURL timeout — FCM hanging) | **240 s** |

240 s exceeds `max_execution_time` on most shared hosting. A PHP execution
timeout is a **fatal error, not an exception**, so the `try/catch` around
sending cannot absorb it — the teacher's homework save would return a 500
because Firebase was slow. That breaks the whole "push must never fail the
business transaction" guarantee.

`PushDispatcher::FANOUT_TIME_BUDGET` caps the entire fan-out at **8 seconds**.
Past that it stops, logs how many tokens it reached, and lets the rest arrive
through the in-app notification centre. Worst case is now 8 s, not 240 s.

**If homework volume grows**, the clean next step is a per-class topic
(`school_{id}_class_{classId}`) — a homework title is not personal, so it is
safe on a topic, and it collapses 4,800 requests/month to ~120 while removing
the fan-out latency entirely. Not done yet; it is the first thing to reach for
if teachers report slow saves.

---

## 3. Firebase setup (what you need to do)

### Step 1 — Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it `shiksha-pilot` (or anything). Google Analytics is optional — not used.

### Step 2 — Register the Android app
1. In the project, click the **Android** icon.
2. **Android package name** — must match exactly:
   ```
   com.shikshapilot.schoolhub.school_hub
   ```
3. Download **`google-services.json`**.
4. Place it at:
   ```
   app/android/app/google-services.json
   ```
   The Gradle plugin is already wired up (`settings.gradle.kts` +
   `app/build.gradle.kts`), so it is picked up automatically on the next build.
   This file is not secret — its API key is client-side and ships inside the APK.

### Step 3 — Create the service account (this is the secret)
1. Firebase Console → ⚙️ **Project settings** → **Service accounts**.
2. Click **Generate new private key** → confirm. A JSON file downloads.
3. It contains `project_id`, `client_email`, `private_key`. **Treat it like a
   password** — it can send push to all your users. Never commit it.

### Step 4 — Give the backend the credentials

The JSON file has ten fields; only three are used. Copy those three into `.env`
rather than shipping the file — the credential then lives in the same place as
every other secret (DB, SMTP, JWT), and there is no file to place outside the
web root, which on shared hosting you often cannot do anyway.

Open the downloaded JSON and copy the matching values:

```env
FIREBASE_PROJECT_ID=shiksha-pilot
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@shiksha-pilot.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

**About the private key** — it must be on **one line, in double quotes, with
`\n` where the line breaks go**. That is exactly how it is already written
inside the JSON file, so copying the value across verbatim gives you the right
thing. `.env` is parsed line by line and cannot hold a real multi-line value;
the backend converts the `\n` escapes back into newlines before handing the key
to OpenSSL.

Then add the same three as GitHub repository secrets:

| Environment | Secrets |
|---|---|
| Production | `PROD_FIREBASE_PROJECT_ID`, `PROD_FIREBASE_CLIENT_EMAIL`, `PROD_FIREBASE_PRIVATE_KEY` |
| QA | `QA_FIREBASE_PROJECT_ID`, `QA_FIREBASE_CLIENT_EMAIL`, `QA_FIREBASE_PRIVATE_KEY` |

Both deploy workflows already write these into `.env` — nothing else to change.
Paste the private key into the GitHub secret in the same one-line `\n` form.

> If the key is malformed the backend logs
> `[push] FIREBASE_PRIVATE_KEY does not look like a PEM private key` at startup
> and treats push as disabled, rather than failing on every notification.

### Step 5 — Enable the API
Firebase Console → **Project settings** → **Cloud Messaging** → confirm
**Firebase Cloud Messaging API (V1)** is *Enabled*. (The legacy server key is
not used; this implementation is HTTP v1 only.)

### Step 6 — Build and verify
```bash
cd app && flutter pub get && flutter run
```
On login the app calls `POST /api/notifications/device`, which returns the topics
to subscribe to. Verify:
```sql
SELECT user_id, user_role, platform, is_active FROM device_tokens;
```
Then trigger something real — assign homework, approve a leave request — and the
push should arrive. To test the plumbing alone, send from Firebase Console →
**Messaging** → *Send test message* using a token from that table.

### If push doesn't arrive
| Symptom | Cause |
|---|---|
| No row in `device_tokens` | Notification permission denied, or `google-services.json` missing/wrong package name |
| Row exists, nothing arrives | Check `error_log` for `[push]` lines; usually bad/expired service-account JSON |
| Grey square icon | `ic_notification` must be a white-on-transparent silhouette |
| Arrives but no sound | Channel importance — check Android app notification settings per category |
| Works foreground only | `firebaseBackgroundHandler` must stay top-level with `@pragma('vm:entry-point')` |

**Everything degrades safely.** With no credentials set, `FcmClient::isConfigured()`
returns false, every send short-circuits, and notifications still land in the
in-app centre. Verified: an unconfigured install inserts notification rows
normally and throws nothing.

---

## 4. Code map

**Backend**
| File | Role |
|---|---|
| `src/Shared/Notifications/NotificationCatalog.php` | The 33-event registry — categories, delivery, audience, priority |
| `src/Shared/Notifications/FcmClient.php` | FCM HTTP v1 on cURL + openssl (JWT → OAuth → send) |
| `src/Shared/Notifications/PushDispatcher.php` | Writes the DB row, then sends push. `pushOnly()` is the retrofit entry point |
| `src/Shared/Notifications/DeviceTokenService.php` | Token upsert / deactivate |
| `src/Shared/Notifications/DeviceTokenController.php` | `POST`/`DELETE /api/notifications/device`, `GET /api/notifications/catalog` |
| `src/Database/Migrations/009_create_push_notifications.sql` | `device_tokens`, `push_oauth_cache`, `+category`, `+event_key` |

**App**
| File | Role |
|---|---|
| `lib/constants/notification_categories.dart` | Categories (= Android channels) + event keys, mirroring the backend |
| `lib/services/push_notification_service.dart` | FCM init, token registration, topic subscribe, tap handling |
| `lib/services/local_notification_scheduler.dart` | The 5 local reminders |
| `lib/services/notification_helper.dart` | Channel creation, rendering, event-key deep-link routing |

### Adding a new notification
1. Add the event to `NotificationCatalog::EVENTS`.
2. Call `PushDispatcher::pushOnly(...)` (or `broadcast`/`toUser`) at the trigger.
3. Add the key to `NotificationEvent` in Dart and a case in
   `NotificationHelper._screenForEvent` if it needs a destination screen.

No new channel is needed unless you add a new *category*.

---

## 5. Known gaps

- **`ATTENDANCE_MARKED_ABSENT`, `TIMETABLE_UPDATED` and `SUBSTITUTE_ASSIGNED`
  are catalogued but not yet emitted.** No backend code currently creates a
  notification at those moments; the catalog entries are ready for when it does.
- **Local reminders are defined but not yet scheduled from the screens.**
  `LocalNotificationScheduler` is complete and analyzer-clean, but
  `scheduleHomeworkReminder` / `scheduleExamReminder` / `scheduleFeeDueReminder`
  need to be called from the homework, exam and fees screens once their lists
  load. `cancelAttendanceReminder()` should be called when a teacher submits
  attendance. That wiring is per-screen and deliberately left as a separate step.
- **Notification preferences are not exposed in-app.** Android's own per-channel
  settings work today; an in-app toggle screen would be a nice addition
  (`GET /api/notifications/catalog` exists to drive exactly that).
- **iOS is not configured.** Android only, matching the current app's scope.
  iOS would additionally need an APNs key uploaded to Firebase.
