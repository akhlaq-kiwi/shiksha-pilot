# Shiksha Pilot — UI/UX Audit & Design System Proposal

**Scope reviewed:** `frontend/` (React 18 + Vite + Tailwind 3, 97 JSX files, 4 role portals), `app/` (Flutter mobile), `frontend/src/index.css` design tokens, `frontend/tailwind.config.js`, report-card templates.
**Date:** 2026-08-02
**Status:** Recommendations only — no code changed.

---

## 1. Executive summary

The product is functionally broad (5 roles, ~50 admin screens, finance, exams, report cards, mobile app) and the token architecture is already right: CSS variables in [index.css](frontend/src/index.css) mapped into Tailwind in [tailwind.config.js](frontend/tailwind.config.js), with `.dark` overrides and a `ThemeContext` that can re-skin per school. That foundation is worth keeping.

The problems are not architectural, they are **expressive and hierarchical**:

| # | Theme | Impact |
|---|-------|--------|
| 1 | **`--color-primary` is Deep Charcoal `#111827`** — the "brand" is literally black. Every primary button, active nav item, and focus ring is grey. An EdTech product reads as institutional/bureaucratic rather than trustworthy-and-warm. | High |
| 2 | **No typographic hierarchy.** `font-black` appears **709×** and `text-[10px]` **605×**, `uppercase` **992×**. When everything is 10px, uppercase and weight-900, nothing is emphasised and body copy is unreadable. | High |
| 3 | **Font weights that aren't loaded.** [index.html](frontend/index.html) loads Inter 300–700 and Outfit 400–800, but the app uses `font-black` (900) everywhere → the browser *synthetically* smears the glyphs. Blurry text on every screen. | High |
| 4 | **Accessibility is largely absent.** 203 `<Input>` usages vs **7** `htmlFor` labels; 14 `aria-*` attributes and 6 `role=` in the whole app; 22 clickable `<div>`s with no keyboard affordance. | High (also a procurement blocker for govt/institutional buyers) |
| 5 | **Colour used decoratively, not semantically.** Subject/status colours are re-declared ad hoc per page (`subjectColors` in the student dashboard, `STATUS_COLORS` in `StatusBadge`, chart colours hardcoded `#10b981`/`#6366f1` inside `DashboardPage`). 100+ raw hex literals in JSX bypass the token layer and break dark mode & per-school theming. | High |
| 6 | **Role portals feel like different products.** School Admin and Super Admin use a sidebar; Teacher uses a horizontal wrapping nav; the shared [AppSidebar.jsx](frontend/src/common/components/AppSidebar.jsx) is dead code while each portal re-implements its own `<aside>`. | Medium |
| 7 | **Mobile web is compromised.** Sidebars collapse into a horizontally-scrolling strip of **15 nav items** with `scrollbar-none` — no visible affordance that more items exist. | Medium |
| 8 | **Loading & empty states are thin.** A `.skeleton-loader` shimmer exists in CSS but is referenced in **1** file; `EmptyState` is table-row-only text ("No records found.") with no icon, explanation, or primary action. | Medium |
| 9 | **Dark mode inverts the brand.** In `.dark`, `--color-primary` becomes `#f8fafc` (white) — so a primary CTA is a white block, and per-school theme presets silently stop applying to primary surfaces. | Medium |
| 10 | **Data-dense screens lack table ergonomics** — no sticky headers, no zebra/row-density control, no column sort/filter affordance, no bulk-action bar, no pagination pattern. 50+ admin screens live in tables. | Medium |

---

## 2. Proposed colour system — "Scholar" palette

Design intent: **professional and colourful.** Confidence comes from a saturated indigo brand plus a disciplined semantic set; warmth comes from keeping the existing paper-on-stone neutrals (they're genuinely good — do **not** revert to pure white).

### 2.1 Brand ramp — Scholar Indigo

Indigo is the EdTech convention for trust + intellect (and it survives per-school re-skinning better than a warm hue).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-50` | `#EEF2FF` | `#1E1B4B` | Tinted backgrounds, selected rows |
| `--brand-100` | `#E0E7FF` | `#312E81` | Badge fills |
| `--brand-500` | `#6366F1` | `#818CF8` | Charts, icons, illustration |
| `--brand-600` | `#4F46E5` | `#6366F1` | **Primary** — buttons, active nav, focus ring |
| `--brand-700` | `#4338CA` | `#4F46E5` | Primary hover / pressed |
| `--brand-900` | `#312E81` | `#C7D2FE` | Display headings on tinted panels |

Verified: `#4F46E5` vs `#FFFFFF` = **6.29:1** → passes WCAG AA for normal text, AAA for large. White label text on a `#4F46E5` button is the same 6.29:1. This is the single highest-leverage change in the report.

### 2.2 Supporting hues

| Role | Hex (light) | Text-safe variant | Applied to |
|---|---|---|---|
| **Teal — Academics** | `#0D9488` | `#0F766E` for text | Classes, subjects, timetable, curriculum |
| **Violet — Finance** | `#7C3AED` | `#6D28D9` | Fees, salary, collections, financial reports |
| **Amber — Attention** | `#F59E0B` | `#B45309` | Fee due, pending approvals, achievements |
| **Emerald — Positive** | `#059669` | `#047857` | Present, paid, passed, active |
| **Rose — Negative** | `#E11D48` | `#BE123C` | Absent, overdue, failed, suspended |
| **Sky — Informational** | `#0284C7` | `#0369A1` | Announcements, notices, help |

⚠️ Contrast caveats I verified: `#0D9488` on white is **3.74:1** — fine for large text, icons, borders and chart marks, but **fails AA for body/small text**; use `#0F766E`. Amber `#F59E0B` on white is ~2.1:1 — never use it for text, only fills, bars and left-border accents.

### 2.3 Keep the neutrals, formalise the elevation

The existing warm neutrals are the palette's best asset. Retain and name them:

```
--surface-canvas : #FAF9F6   (app background — Soft Stone)
--surface-sunken : #F4F3F1   (sidebar, table headers)
--surface-raised : #FFFFFF   (cards — "paper on stone")
--surface-overlay: #FFFFFF   (dialogs, dropdowns, + shadow-lg)
--border-subtle  : #EBEAE8
--border-strong  : #D6D4D0   (missing today — needed for input borders at AA)
```

**Dark mode:** the current `#0F172A` navy base is good; the fix is to stop inverting the brand. In `.dark`, `--color-primary` should be `#6366F1` (indigo-400/500 lifts against navy at ~4.8:1), **not** `#f8fafc`. Add a `--surface-sunken: #111827` step so sidebar/card/canvas remain three distinguishable layers.

### 2.4 Per-role portal accent

Give each audience an identity while the chrome stays shared — this is how mature multi-tenant EdTech reduces "wrong portal" confusion:

| Portal | Accent | Rationale |
|---|---|---|
| Super Admin | Slate `#334155` + indigo | Platform/infrastructure register |
| School Admin | **Scholar Indigo** `#4F46E5` | Default brand |
| Teacher | Teal `#0D9488` | Distinct from admin at a glance |
| Student | Sky `#0284C7` | Lighter, friendlier |
| Parent | Violet `#7C3AED` | Separates the parent view from the child's |

Implement as one `data-portal="teacher"` attribute on the layout root that remaps `--color-primary` — no component changes.

### 2.5 Fix the school-theme presets

[ThemeContext.jsx](frontend/src/theme/ThemeContext.jsx) presets are named `enterprise` / `fintech` / `healthcare` — irrelevant vocabulary for a school buyer, and each sets only 4 variables so tinted backgrounds and charts don't follow. Replace with school-appropriate named themes (`indigo`, `teal`, `maroon`, `navy`, `forest` — maroon and navy in particular match real South-Asian school crests) and have each preset emit the **full 6-stop ramp**, so `bg-primary/10` tints, focus rings and chart strokes all re-skin coherently.

### 2.6 Chart palette

Charts currently hardcode `#10b981` / `#6366f1` inside [DashboardPage.jsx](frontend/src/features/school-admin/pages/DashboardPage.jsx). Define one categorical sequence as tokens, ordered for colour-blind separability:

`#4F46E5` → `#0D9488` → `#F59E0B` → `#E11D48` → `#0284C7` → `#7C3AED` → `#65A30D` → `#DB2777`

Rule: never encode meaning by hue alone — pair with label, icon, or pattern (matters for the ~8% of male parents with CVD reading a fee chart).

---

## 3. Typography — the second-biggest win

**Current state:** `font-display` (Outfit) + `font-sans` (Inter) is a good pairing. The execution undermines it: 709 `font-black`, 605 `text-[10px]`, 992 `uppercase`, headings at weight 700–900 competing with table cells at weight 600.

**Recommended scale** (Outfit for display, Inter for everything else):

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display-lg` | 30/36 | 700 Outfit | Page title (one per screen) |
| `display-sm` | 20/28 | 600 Outfit | Section / card title |
| `body-md` | 14/22 | 400 Inter | **Default body & table cells** |
| `body-sm` | 13/20 | 400 Inter | Secondary/meta text |
| `label` | 12/16 | 600 Inter, +0.04em | Form labels, table headers |
| `overline` | 11/14 | 600 Inter, uppercase | Stat-card labels **only** |
| `numeric` | 14–28 | 600, `tabular-nums` | Money, marks, percentages |

Concrete actions:
1. Load the weights you use, or stop using them. Either add `Inter:wght@...800;900` + `Outfit:...900` to [index.html](frontend/index.html), or — better — **drop weight 900 entirely** and cap at 700. Fewer loaded weights, sharper glyphs, faster LCP.
2. **Retire uppercase from table cells, nav items and buttons.** Uppercase costs ~15% reading speed and destroys word-shape recognition — a real problem for parent/student users and for Hindi/Urdu-transliterated names. Keep it for `overline` labels only. (Buttons in [button.jsx](frontend/src/common/ui/button.jsx) are `text-xs uppercase tracking-wider` — move to sentence case at 14px/600.)
3. **Raise the floor to 13px.** 10px body text fails legibility guidance and is hostile on the parent-facing screens where the audience skews 35–55.
4. Table cells at [table.jsx](frontend/src/common/ui/table.jsx) are `text-xs font-semibold text-text-secondary` — data should be `body-md`, weight 400, `--text-primary`. Weight is currently doing the job that colour and alignment should do.

---

## 4. Component-level findings

### 4.1 Buttons — [button.jsx](frontend/src/common/ui/button.jsx)
- `accent` and `default` variants are **identical** — dead API surface that invites inconsistency.
- No `loading` state despite the app being save-heavy → double-submits on slow connections (a genuine risk for fee collection).
- No icon-plus-label size, so `gap-2` is re-specified per call site.
- `h-9` (36px) default is below the 44px touch-target minimum; fine for desktop admin, too small for parent/student mobile web.
- `focus-visible:ring-primary/20` at 20% opacity on a grey primary is nearly invisible. With indigo, use `ring-2 ring-brand-600/40 ring-offset-2`.

**Add:** `loading`, `destructive-outline`, `link` variants; `size="touch"` at h-11; and a `<ButtonGroup>` for the repeated action clusters.

### 4.2 Inputs — [input.jsx](frontend/src/common/ui/input.jsx)
No label, no error, no helper-text, no required-indicator support — so 203 call sites each invent their own. This is the root cause of the 7-labels-for-203-inputs a11y gap.

**Add a `<Field>` wrapper** owning: label + `htmlFor`, required asterisk, description, error message wired via `aria-describedby` / `aria-invalid`, and character counters. Then error styling becomes automatic instead of per-page. Also missing: `Textarea`, `Checkbox`, `Radio`, `Switch`, `DatePicker` (dates are core to attendance/exams/fees), and a currency input with `₹` prefix + `tabular-nums`.

### 4.3 Tables — [table.jsx](frontend/src/common/ui/table.jsx)
Hardcoded `bg-[#EFEEEB]` and `hover:bg-[#F4F3F1]/80` break per-school theming and dark mode. Beyond tokenising:
- **Sticky header** (`position: sticky` on `<thead>`) — non-negotiable for 200-student class lists.
- **Sortable header** affordance + `aria-sort`.
- **Density toggle** (comfortable/compact) — admins scanning fee ledgers want compact; parents want comfortable.
- **Row selection + bulk action bar** — bulk fee reminders, bulk attendance marking, bulk report-card generation are all high-frequency admin jobs currently done one row at a time.
- **Right-align + `tabular-nums` on all numeric columns**; money columns should never be left-aligned.
- **Mobile:** tables need a card-stack fallback below `sm`, not horizontal scroll.
- Pagination/virtualisation: no pattern exists. A 1,200-student school will render 1,200 DOM rows.

### 4.4 Empty & loading states — [EmptyState.jsx](frontend/src/common/components/EmptyState.jsx)
"No records found." is a dead end. Every empty state should carry: a relevant icon, one sentence of cause, and the action that resolves it — *"No students in Class 10-A yet. Enrol your first student."* + button. Distinguish three cases that currently look identical: **empty by design** (nothing created yet), **empty by filter** (offer "Clear filters"), and **error** (offer "Retry").

Loading: `.skeleton-loader` exists in CSS and is used in ~1 file. Every table, stat-card row and chart should render a skeleton of its own shape. Spinners on data-dense pages feel slower than skeletons even at identical latency.

### 4.5 Toasts — [Toast.jsx](frontend/src/common/components/Toast.jsx)
Well built (good semantic colour, good icons), with three gaps:
- **`if (!navigator.onLine) return null;` silently swallows every toast when offline** — the exact moment the user most needs feedback. Show a persistent offline banner instead and let toasts through.
- No `role="status"` / `aria-live="polite"` → screen readers never announce success or failure.
- No action slot ("Undo", "View receipt") and no dedupe, so repeated failures stack.

### 4.6 Navigation
- Unify on one nav model. Teacher's horizontal wrapping nav ([teacher/index.jsx:118](frontend/src/features/teacher/index.jsx#L118)) should become a sidebar like the others, or all four become a top nav — but not both.
- **15 flat items** in the School Admin sidebar ([school-admin/index.jsx:47-63](frontend/src/features/school-admin/index.jsx#L47-L63)) exceeds comfortable scanning. Group them: **Academics** (Classes, Timetable, Attendance, Examinations) · **People** (Teachers, Manage Leaves) · **Finance** (Fees Portal, Financial Reports, Finance Management, Fee Follow-up) · **School** (Announcements, Achievements, Audits & Settings, Security). Four labelled groups of 2–4 beats one list of 15.
- Naming inconsistency inside that list: "Fees Portal" vs "Financial Reports" vs "Finance Management" — three finance destinations a new admin cannot disambiguate. Rename to *Fee Collection*, *Reports*, *Accounts & Payroll*.
- **No breadcrumbs** on nested routes (`/school-admin/profile/subscription`, student detail pages) — users lose their place.
- **Delete the unused shared [AppSidebar.jsx](frontend/src/common/components/AppSidebar.jsx)** or adopt it in all four portals. Right now it's a maintenance trap.
- Mobile: replace the `overflow-x-auto scrollbar-none` nav strip with a bottom tab bar (4–5 primary destinations + "More") for student/parent, and a hamburger drawer for admin/teacher.

### 4.7 Header — [AppLayout.jsx](frontend/src/layouts/AppLayout.jsx)
- The Super Admin **log-out button uses a `GraduationCap` icon** ([AppLayout.jsx:349](frontend/src/layouts/AppLayout.jsx#L349)) — should be `LogOut`. Genuinely confusing.
- The academic-year `<select>` is a raw native select with an inlined SVG data-URI background. It's also a **high-consequence control** — switching year changes every downstream figure — sitting unlabelled next to the school name. Give it a visible "Academic Year" label, a distinct bordered treatment, and a confirmation when switching away from the active year.
- Dark-mode toggle is shown only to `SCHOOL_ADMIN` and `SUPER_ADMIN`. Teachers and students look at these screens for hours; give everyone the toggle plus a `system` option.
- Notifications poll every 30s unconditionally and only for `SCHOOL_ADMIN`. Teachers get exam/leave notifications with no bell. Also: no "mark all read", no grouping, no empty-state illustration.
- Missing entirely: **global search** (⌘K) across students / teachers / classes / invoices. On a 50-screen admin product this is the single biggest navigation accelerator.
- No user avatar/name for non-super-admin roles — the header shows the *school* logo where the *user* identity belongs, so shared-device users can't tell who is signed in.

### 4.8 Dashboards
- School Admin dashboard is **642 lines with an inline hand-rolled SVG chart component and `MOCK_AUDIT_LOGS` hardcoded at the top** ([DashboardPage.jsx:15-21](frontend/src/features/school-admin/pages/DashboardPage.jsx#L15-L21)). Mock data shipping in a production dashboard is a credibility risk in demos. Extract `<LineChart>`, `<BarChart>`, `<DonutChart>` into `common/ui/charts/` and wire real audit data.
- Stat cards don't show **trend or comparison**. "1,240 students" is trivia; "1,240 students · +38 this term" is information. Add delta + sparkline + period label to [StatCard.jsx](frontend/src/common/components/StatCard.jsx), and make every stat card clickable through to its filtered list view.
- No date-range control on the dashboard, so "collections" has no stated period.
- Student/parent dashboard duplicates the stat-card markup inline instead of using `StatCard` — four near-identical 20-line blocks.
- The chart tooltip hardcodes `fill="#ffffff"` on data points, which disappears against dark-mode surfaces.

### 4.9 Role-specific UX gaps

**Teacher** — the highest-frequency, most time-pressured user:
- Attendance marking needs **bulk "mark all present" + exceptions** (the real-world pattern: 3 absent out of 40). Tapping 40 times is the wrong interaction.
- Marks entry needs keyboard-first grid navigation (Enter/Tab advances, arrow keys move), per-cell validation against max marks, and **autosave with visible state** — losing 40 entered marks to a session timeout is catastrophic.
- Add "today at a glance": next period, which classes still need attendance, ungraded submissions.

**Student / Parent** — mobile-first, low-frequency, low-tolerance:
- Fee payment needs an unambiguous single path: amount due → breakdown → pay → receipt. Currently fees, receipts and follow-ups are spread across screens.
- Report cards, timetable and attendance should be shareable/downloadable as PDF from one place.
- Parents with multiple children need a persistent, obvious child switcher — currently buried in the sidebar ([student-parent/index.jsx:154](frontend/src/features/student-parent/index.jsx#L154)).
- Locale is mixed: `toLocaleDateString('en-PK', …)` on the student dashboard while currency is `₹` and `en-IN` elsewhere. Pick per-tenant locale/currency from the school profile — this is a correctness bug as well as a polish one.

**Super Admin** — needs platform health, not school detail: MRR/active-schools trend, per-school usage & last-login, subscription expiry pipeline, failed-payment queue.

### 4.10 Report-card templates
Four templates in [report-card-templates/templates/](frontend/src/features/report-card-templates/templates/) generating PDFs via html2pdf. These are the **most-seen artefact of the whole product** — a parent keeps them for years.
- Print-specific tokens are needed: colours must survive greyscale printing (differentiate by weight/border, not hue), and screen shadows/rounded corners should be stripped at print.
- Add explicit `@page` size/margins and page-break control rather than relying on scale hacks.
- Grade bands should map to the semantic ramp with an accompanying letter/label, never colour alone.
- Add a live side-by-side preview with real student data before bulk generation — a formatting error found after 400 PDFs is expensive.

---

## 5. Accessibility — prioritised remediation

Measured across `frontend/src`: **14** `aria-*` attributes, **6** `role=`, **7** `htmlFor` (vs 203 inputs), **22** clickable `<div>`s.

| Priority | Fix | Where |
|---|---|---|
| P0 | Label every input (`<Field>` wrapper does this once) | 203 sites, one component |
| P0 | Convert clickable `<div>`s to `<button>`, or add `role`+`tabIndex`+key handlers | 22 sites incl. notification items in `AppLayout` |
| P0 | Visible focus ring on all interactives — current `ring-primary/20` is effectively invisible | `button`, `input`, `tabs`, sidebar |
| P0 | Raise text contrast: `--text-muted #9ca3af` on `#FAF9F6` ≈ **2.5:1**, well below the 4.5:1 minimum — and it's used for stat labels and helper text everywhere | `index.css`; use `#6B7280`+ |
| P1 | `aria-live` on toasts; `aria-busy` on loading regions | `Toast.jsx` |
| P1 | Dialog focus trap, focus restore, Escape-to-close, `aria-modal` | `dialog.jsx` |
| P1 | Tabs: `role="tablist"`/`tab`/`tabpanel` + arrow-key navigation | `tabs.jsx` |
| P1 | `aria-sort` + `<caption>`/`scope` on data tables | `table.jsx` |
| P2 | Skip-to-content link; landmark regions | `AppLayout.jsx` |
| P2 | `prefers-reduced-motion` guard — `animate-ping`, `animate-pulse`, `page-fade-in`, `glass-card` hover-lift all currently ignore it | `index.css` |
| P2 | Don't gate meaning on colour alone (status badges, charts, grade bands) | `StatusBadge`, charts, report cards |

Target **WCAG 2.1 AA**. For any government or institutional tender this moves from "nice" to "required".

---

## 6. Suggested roadmap

**Phase 1 — Foundation (~1 week, invisible risk, visible payoff)**
1. Rewrite the token layer in [index.css](frontend/src/index.css): Scholar Indigo ramp, semantic hues, elevation scale, `--border-strong`, fixed dark-mode primary, raised `--text-muted`.
2. Fix font loading vs. usage; introduce the type scale.
3. Codemod the ~100 raw hex literals in JSX to tokens.
4. Extend `tailwind.config.js` with the new ramps so `bg-brand-600` / `text-danger-700` exist.

*Result: the entire app re-skins from grey to a professional colourful identity with near-zero per-page work.*

**Phase 2 — Primitives (~1–2 weeks)**
`Field` wrapper + form controls · `Button` loading/touch variants · `Table` sticky/sortable/selectable/density · real `EmptyState` and `Skeleton` · `Toast` a11y + offline fix · dialog focus management.

**Phase 3 — Navigation & IA (~1 week)**
One nav model across portals · grouped sidebar · renamed finance destinations · breadcrumbs · ⌘K global search · mobile bottom-tab / drawer · fix the log-out icon and academic-year switcher.

**Phase 4 — Role workflows (~2–3 weeks)**
Extracted chart components + trend-bearing stat cards · teacher bulk attendance & keyboard marks grid with autosave · unified parent fee-payment flow · super-admin platform-health dashboard · print tokens for report cards.

**Phase 5 — Parity & polish**
Align the Flutter app (`app/lib/`) to the same tokens — it currently has no shared theme constants file, so mobile and web will drift. Define the palette once in a JSON source and generate both `index.css` variables and a Dart `AppColors` class.

---

## 7. Quick wins (each under an hour)

1. `--color-primary: #4F46E5` — one line, transforms the entire product's character.
2. `--text-muted: #6B7280` — fixes the most widespread contrast failure.
3. Swap the Super Admin log-out `GraduationCap` → `LogOut`.
4. Remove `if (!navigator.onLine) return null` from `Toast.jsx`.
5. Add `role="status" aria-live="polite"` to the toast container.
6. Add `aria-sort`-ready `position: sticky` to `TableHeader`.
7. Delete `MOCK_AUDIT_LOGS` from the admin dashboard (or label it clearly as sample data).
8. Give the academic-year select a visible label.
9. Enable the dark-mode toggle for teachers, students and parents.
10. Add a `prefers-reduced-motion: reduce` block disabling the decorative animations.
