# UI Design System Standards

## Design System Stack

### Primary UI Framework

Use:

* ShadCN/UI as the component foundation
* Tailwind CSS for styling
* TweakCN for theme generation and management
* Lucide React for icons

Technology Stack:

```text
React
TypeScript
Tailwind CSS
ShadCN/UI
TweakCN
Lucide React
```

---

## Design System Principles

### 1. Single Source of Truth

All UI should originate from the design system.

Never create ad-hoc buttons, forms, modals, dialogs, cards, or tables.

Use:

```tsx
<Button />
<Input />
<Select />
<Card />
<Dialog />
<Table />
```

from the design system.

---

### 2. Consistent User Experience

The application should maintain:

* Consistent spacing
* Consistent typography
* Consistent color tokens
* Consistent interaction patterns
* Consistent accessibility standards

Every feature should look like it belongs to the same application.

---

### 3. Theme-Driven Development

Components should never hardcode colors.

Bad:

```tsx
className="bg-blue-500"
```

Good:

```tsx
className="bg-primary text-primary-foreground"
```

Always use semantic design tokens.

---

## Directory Structure

```text
src/
│
├── common/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── utils/
│
├── theme/
│   ├── provider.tsx
│   ├── themes.ts
│   ├── tokens.ts
│   └── tweakcn/
│
└── features/
```

---

## Common UI Layer

All ShadCN components should live inside:

```text
common/ui/
```

Examples:

```text
common/ui/
├── button.tsx
├── input.tsx
├── select.tsx
├── dialog.tsx
├── card.tsx
├── table.tsx
├── form.tsx
├── tabs.tsx
├── drawer.tsx
├── sheet.tsx
├── dropdown-menu.tsx
└── ...
```

### Rules

Never modify generated ShadCN components directly.

Instead:

```text
common/ui/
```

contains base components.

```text
common/components/
```

contains business-aware wrappers.

Example:

```text
common/ui/button.tsx
common/components/SubmitButton.tsx
common/components/DeleteButton.tsx
```

This prevents vendor lock-in and simplifies upgrades.

---

## Theme Architecture

### TweakCN as Theme Engine

Use TweakCN-generated themes as the source of color systems.

Store themes:

```text
theme/
└── tweakcn/
    ├── default.json
    ├── enterprise.json
    ├── fintech.json
    ├── healthcare.json
    └── dark-pro.json
```

---

### Theme Provider

Centralized provider:

```tsx
<ThemeProvider>
  <App />
</ThemeProvider>
```

Responsibilities:

* Theme switching
* Dark mode
* Custom themes
* Persistence
* Runtime theme updates

---

## Supported Themes

Minimum:

```text
Light
Dark
System
Enterprise
Modern
Fintech
Healthcare
```

Future themes should require zero component changes.

---

## Design Tokens

Use semantic tokens only.

### Colors

```css
--primary
--secondary
--accent
--muted
--destructive
--background
--foreground
```

### Border Radius

```css
--radius
```

### Shadows

```css
--shadow-sm
--shadow-md
--shadow-lg
```

### Typography

```css
--font-sans
--font-heading
--font-mono
```

---

## Component Hierarchy

### Layer 1 — Design System Components

```text
common/ui/
```

Pure ShadCN components.

Examples:

```tsx
<Button />
<Input />
<Card />
<Dialog />
```

---

### Layer 2 — Shared Business Components

```text
common/components/
```

Examples:

```tsx
<AppHeader />
<AppSidebar />
<SearchBar />
<PageTitle />
<DataTable />
```

Reusable across multiple features.

---

### Layer 3 — Feature Components

```text
features/projects/components/
features/users/components/
```

Feature-specific UI.

Examples:

```tsx
<ProjectCard />
<ProjectStatusBadge />
<UserPermissionModal />
```

---

## Accessibility Standards

All components must support:

* Keyboard navigation
* Screen readers
* Focus states
* ARIA attributes
* High contrast themes

ShadCN defaults should not be removed.

---

## Styling Rules

### Preferred Order

1. ShadCN Component
2. Tailwind Utility Classes
3. CVA (Class Variance Authority)
4. Custom CSS only if unavoidable

---

### Component Variants

Use CVA for variants.

Example:

```tsx
<Button
  variant="default"
  size="lg"
/>
```

Avoid custom conditional class chains.

---

## Enterprise UI Guidelines

### Tables

Use:

* TanStack Table
* ShadCN Table
* Server-side pagination
* Virtualization for large datasets

---

### Forms

Use:

* React Hook Form
* Zod
* ShadCN Form Components

Pattern:

```text
Form
 ├── Validation
 ├── Schema
 ├── Submit Action
 └── API Service
```

---

### Layouts

Standard layouts:

```text
AppLayout
AuthLayout
DashboardLayout
AdminLayout
```

Located in:

```text
app/layouts/
```

---

## Golden Rule

Every UI element must belong to one of three layers:

1. Design System (`common/ui`)
2. Shared Components (`common/components`)
3. Feature Components (`features/*/components`)

Never bypass the design system.
Never hardcode colors.
Never duplicate UI patterns.

The design system should make new features look consistent by default.

---

## Application Initialization & Authentication Flow

### 1. Unified Bootstrap Sequence
To prevent stale contextual state and race conditions (e.g., empty Academic Year context leading to false onboarding redirections), the application must adhere to a standardized asynchronous bootstrap sequence after authentication states change:
1. **Token Persistence**: Store the access token, role, and profile details in persistent storage (`localStorage`).
2. **Dispatch Auth Change Event**: Broadcast an `auth-change` event to notify all context providers and state layers.
3. **Synchronous State Hydration**: Context providers must listen to `auth-change` and refresh their parameters synchronously before components render the protected routes.
4. **Loading States**: Layout guards must render a clean verification splash spinner while context states are resolving (`loading: true`), preventing flash displays of onboarding or missing data screens.

### 2. Event-Driven Synchronization
Providers wrapping the routing hierarchy (e.g., `AcademicYearProvider`) must never rely solely on mount-based initialization (`useEffect` with empty dependencies `[]`). They must subscribe to `'auth-change'` events to dynamically refresh their states:

```javascript
useEffect(() => {
  const syncState = () => {
    if (isAuthenticated()) {
      loadSessionData();
    } else {
      clearSessionData();
    }
  };
  syncState();
  window.addEventListener('auth-change', syncState);
  return () => window.removeEventListener('auth-change', syncState);
}, []);
```

---

## Examination Timetable & Scheduler Specifications

### 1. Subject Progress & Pending Counts
- Displays a real-time progress indicator in the **Add Paper** section header (to the left of the action button) showing completed scheduled subjects versus the total class subjects (e.g. `Subjects Completed: 5 / 8 | Pending: 3`).
- Updates automatically on paper addition, modification, or deletion.

### 2. Auto-Disable Add Paper
- Once scheduled papers have been created for all available subjects of the selected class, the **Add Paper** button automatically changes to a disabled state to prevent further paper creation.
- If a paper is deleted, the button is re-enabled and the subject is restored to the select dropdown list.
- During paper editing, the button remains active as **Save Changes**.

### 3. Input Validations & Default Values
- Form inputs like `max_marks` and `passing_marks` are initialized as string states. This allows teachers to delete values completely (preventing issues with immediate default value restorations) and type arbitrary values.
- Float parsing and logical range validations (e.g., passing marks cannot exceed maximum marks) are applied in the submission handler (`handleAddPaperLocal`).
- Any empty values (like room number fields) display `—` (Em Dash) instead of `N/A` or empty cells.

### 4. Back Navigation
- All Back navigation actions (`ArrowLeft` icon buttons) must explicitly define `type="button"`. This prevents browsers from treating navigation actions as submit triggers, eliminating false validation errors and page flickering/jerking.
- When transitioning back from a scoped workspace (e.g. Timetable, Marks, Report Cards) back to the class workspace dashboard, transition `activeView` directly to `'classes'` instead of resetting `selectedClassId` or reloading class list state unnecessarily. This preserves the selected context and prevents flash-rendering warning messages or flickering during unmount.

### 5. Date Picker & Calendar Icon
- The custom `CalendarDatePicker` input contains a styled `Calendar` icon button absolute-positioned on the right to toggle the calendar grid.
- Displays values formatted standardly (e.g. `10 July 2026`) when blurred/inactive, and switches to ISO `YYYY-MM-DD` when focused or typed to facilitate quick keyboard entries.

### 6. Timezone-Safe Local Calculations
- Date calculations and offsets inside the calendar grid generate strings using local date elements (`getFullYear()`, `getMonth()`, `getDate()`) instead of `.toISOString().split('T')[0]` to prevent UTC timezone shift bugs.
- Selective date ranges are inclusive: `min <= selectedDate <= max`.

### 7. Standardized Date Formats
- Displays dates using a single unified format: `Numeric-Day Full-Month Four-digit-Year` (e.g. `10 July 2026`, `05 August 2026`).
- Date ranges use `to` separator (e.g. `10 July 2026 to 20 July 2026`).
- This applies consistently to listings, headers, workspaces, templates, scheme previews, and PDFs.

### 8. Intelligent Exam Date Suggestion & Leave Days
- The system automatically suggests the next available working day using `suggestNextExamDate`.
- Suggested dates start from the examination start date and increment by one day per paper, skipping Sundays, leave days/holidays (fetched from `/api/school/holidays`), and dates already assigned to other papers for the current class.
- Holidays and Sundays are completely disabled inside the calendar grid rendering, ignore click events, and trigger manual validation warnings if entered manually (`"Examinations cannot be scheduled on holidays."` and `"Examinations cannot be scheduled on Sundays."`).

### 9. Form State & Input UX Preservation
- Once all available subjects for a class have been scheduled, the Subject `<Select>` dropdown is disabled automatically (`disabled={filteredClassSubjects.length === 0}`) to prevent clicking or interaction, while keeping the default placeholder options.
- The `start_time` and `end_time` states inside the add paper form are preserved after successfully scheduling/submitting a paper. This prevents repetitive entries and allows sequential scheduling workflows using consistent time-block periods.

### 10. Examination Instructions & Sizing
- **Instructions Limits**: Teachers can add up to 3 instructions per class-wise exam timetable. Each instruction is validated to contain a maximum of 25 words. These are managed inside the `Examination Instructions` dialog popup (Edit/Delete options via standard 3-dot dropdowns) and saved to `/api/school/exams-new/{id}/instructions`.
- **Optional Instructions**: Instructions are fully optional. Previews, PDF downloads, and prints can be initiated even if zero instructions are added. If instructions count is 0, the instructions section is omitted from the layout.
- **Landscape Print Styles**: The examination scheme print preview uses landscape orientation to prevent table columns (Subject, Paper Type, Date, Time, Max Marks) and date/time content from wrapping. This is forced by dynamically loading a CSS print override block (`@media print { @page { size: landscape !important; margin: 8mm !important; } }`) when the dialog is open.
- **Separate Download & Print Workflows**: Inside the Preview Dialog action bar, separate actions are provided:
  - **Download PDF**: Calls `html2pdf.js` to render the `#printable-scheme` DOM element into a PDF using local orientation parameters (`landscape`) and immediately triggers a direct download file stream. It does not trigger print prompts or reload the preview.
  - **Print Scheme**: Uses the isolated iframe printing pattern to isolate layout render contexts. It creates a temporary hidden iframe on the document body, copies stylesheets, overrides print margins/page parameters to landscape (`@page { size: landscape !important; margin: 8mm !important; }`), and triggers `iframe.contentWindow.print()` directly to avoid dialog overlays clipping or browser layout distortion.
- **Clipping Prevention, Borders & Scroll Previews**: 
  - To prevent clipping or truncation of columns (e.g. Max Marks) on the right of the table during printing, global print overrides reset all Radix Dialog overlay and wrapper viewport heights/inset positioning to relative flows.
  - The printable document width is constrained to exactly `268mm` (inline style `width: 268mm`, max-width `max-w-[268mm]`, and print stylesheet overrides `width: 268mm !important; margin: 0 auto !important;`). Centering the document on the landscape A4 page (`297mm`) leaves ample safety margins (`14.5mm` on left and right) which guarantees the outer double borders are fully visible on all 4 sides in both screen previews, PDF downloads, and browser prints.
  - On the screen view, the landscape scheme document is wrapped inside a scrollable flex container (`no-print-scroll` with `overflow-x-auto`) to offer a WYSIWYG preview without screen cutoff.
- **Table Column Width Distribution**: To eliminate unnecessary whitespace inside the Subject column, proportional percentage widths are declared on table headers: Subject (`w-[20%]`), Paper Type (`w-[15%]`), Date (`w-[20%]`), Time (`w-[30%]`), and Max Marks (`w-[15%]`).
- **Dynamic PDF Scaling & Single Page Constraint**:
  - The timetable layout uses content-based vertical stacking (`space-y-6`).
  - Sizing parameters are computed dynamically based on the subject count:
    - **<= 5 Subjects**: Uses larger rows (`p-4`), font size (`text-sm`), table margins (`py-6`), and guidelines spacing to keep the layout balanced.
    - **6-9 Subjects**: Uses default row dimensions (`p-2.5`) and font size (`text-xs`).
    - **10-13 Subjects**: Automatically shrinks font size (`text-[10px]`), margins, and row padding (`p-1.5`) so everything fits on a single page.
    - **>= 14 Subjects**: Hides the Instructions block completely, shrinks row padding to `p-1`, and font size to `text-[9px]`.
- **School Profile Name**: Dynamic school name is retrieved using `schoolProfile.name` (matching the SQL `schools` table schema) and printed at the header of the scheme document.
