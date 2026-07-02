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
