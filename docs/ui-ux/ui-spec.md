# UI/UX Specification — Project Manager UI v1

**Version:** 1.0
**Author:** ui-ux-accessibility-specialist (Phase 1 Audit)
**Date:** 2026-08-13
**Status:** Specification for Implementation

---

## 1. Design Tokens

### 1.1 Color System

All colors defined as CSS custom properties for both themes. Values chosen to satisfy WCAG 2.1 AA minimum contrast ratios.

#### Dark Theme (default)

| Token | Value | Usage | Contrast vs BG |
|-------|-------|-------|----------------|
| `--bg-primary` | `#0A0A0F` (gray-950 equivalent) | App background | — |
| `--bg-secondary` | `#14141F` (sidebar/bg panels) | Sidebar, header, card bg | — |
| `--bg-tertiary` | `#1E1E2E` (kanban column bg) | Column backgrounds | — |
| `--border-primary` | `#2A2A3A` | Borders, dividers | — |
| `--text-primary` | `#F0F0F5` | Headings, body text | 15.4:1 on primary ✅ |
| `--text-secondary` | `#B0B0C0` | Descriptions, labels | 7.8:1 on primary ✅ |
| `--text-muted` | `#808090` | Meta text (dates, counts) | 3.9:1 ⚠️ → use only for >18px or bold |
| `--text-placeholder` | `#505060` | Input placeholders | Not accessible — no contrast required for disabled text |
| `--accent-blue` | `#3B82F6` | Primary actions, active states | — |
| `--accent-red` | `#EF4444` | High priority, errors | — |
| `--accent-amber` | `#F59E0B` | Medium priority | — |
| `--accent-green` | `#22C55E` | Low priority, success | — |
| `--focus-ring` | `#60A5FA` | Focus indicator | 8.5:1 on secondary ✅ |

#### Light Theme

| Token | Value | Usage | Contrast vs BG |
|-------|-------|-------|----------------|
| `--bg-primary` | `#FAFAFA` | App background | — |
| `--bg-secondary` | `#FFFFFF` | Sidebar, header, cards | — |
| `--bg-tertiary` | `#F5F5F5` | Kanban column bg | — |
| `--border-primary` | `#E0E0E0` | Borders, dividers | — |
| `--text-primary` | `#111118` | Headings, body text | 18.1:1 on primary ✅ |
| `--text-secondary` | `#404050` | Descriptions, labels | 10.5:1 on primary ✅ |
| `--text-muted` | `#707080` | Meta text (dates, counts) | 5.1:1 on primary ✅ |
| `--text-placeholder` | `#A0A0B0` | Input placeholders | Disabled text exception |
| `--accent-blue` | `#2563EB` | Primary actions, active states | — |
| `--accent-red` | `#DC2626` | High priority, errors | — |
| `--accent-amber` | `#D97706` | Medium priority | — |
| `--accent-green` | `#16A34A` | Low priority, success | — |
| `--focus-ring` | `#3B82F6` | Focus indicator | — |

### 1.2 Typography

| Element | Size | Weight | Line Height | Color |
|---------|------|--------|-------------|-------|
| H1 (page title) | 1.125rem (18px) | 600 | 1.4 | --text-primary |
| H2 (column headers) | 0.75rem (12px) | 600 uppercase | 1.4 | --text-secondary |
| Card title | 0.875rem (14px) | 600 | 1.4 | --text-primary |
| Body text | 0.875rem (14px) | 400 | 1.5 | --text-primary |
| Description | 0.75rem (12px) | 400 | 1.5 | --text-secondary |
| Label/Meta | 0.75rem (12px) | 500 | 1.4 | --text-muted |
| Badge text | 0.625rem (10px) | 600 | 1.2 | --text-secondary (on colored bg) |
| Button | 0.875rem (14px) | 500 | 1.4 | inherit |

**Font family:** Inter (via next/font) or system font stack fallback:
```css
font-family: var(--font-sans), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

### 1.3 Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px (0.25rem) | Tight spacing within components |
| `--space-2` | 8px (0.5rem) | Component padding baseline |
| `--space-3` | 12px (0.75rem) | Small gaps between elements |
| `--space-4` | 16px (1rem) | Standard gap |
| `--space-5` | 20px | Column gap in Kanban board |
| `--space-6` | 24px (1.5rem) | Section spacing |
| `--space-8` | 32px (2rem) | Page padding |
| `--space-10` | 40px (2.5rem) | Large spacing |
| `--space-16` | 64px (4rem) | Header height |

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Buttons, small badges |
| `--radius-md` | 8px | Cards, inputs, modal content |
| `--radius-lg` | 12px | Modal outer shell |
| `--radius-xl` | 16px | Kanban columns |
| `--radius-full` | 9999px | Pills, avatars, dots |

### 1.5 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.1)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.15)` | Card hover |
| `--shadow-lg` | `0 10px 25px rgba(0,0,0,0.25)` | Modal shadow |
| `--shadow-focus` | `0 0 0 3px rgba(59,130,246,0.5)` | Focus ring glow |

### 1.6 Animations

| Property | Default Duration | Transition | Use Case |
|----------|-----------------|------------|----------|
| Hover | 150ms | ease-out | Card hover, button hover |
| Theme toggle | 200ms | ease-in-out | Background color transition |
| Task move | 300ms | ease-in-out | Real-time status change |
| Modal open/close | 200ms | ease-out | Dialog appearance |
| Toast appear/disappear | 250ms | ease-out | Notification slides |
| Skeleton shimmer | 1.5s infinite | linear | Loading placeholder |

---

## 2. Layout Specifications

### 2.1 AppShell (Overall Structure)

```
┌───────────────────────────────────────────────────────────────┐
│                        HTML <body>                             │
│  ┌──────────┬────────────────────────────────────────────────┐ │
│  │          │                                                │ │
│  │ Sidebar  │           Main Content Area                     │ │
│  │ 256px    │                                                │ │
│  │ fixed    │  ┌───────────────────────────────────────────┐  │ │
│  │ w-64     │  │ Header (~64px): project info, stats, btn │  │  │
│  │          │  ├───────────────────────────────────────────┤  │ │
│  │ [Logo]   │  │ Kanban Board (flexible height)             │  │ │
│  │ [Proj]   │  │ ┌───────┬───────┬───────┐                 │  │ │
│  │ [Proj]   │  │ │ In Work│Review│ Done │                 │  │ │
│  │ [Proj]   │  │ │ ~~~~~~│ ~~~~ │ ~~~~  │                 │  │ │
│  │ [Proj]   │  │ └───────┴───────┴───────┘                 │  │ │
│  │ ...      │  └───────────────────────────────────────────┘  │ │
│  │          │                                                │ │
│  │ [+Project]│                                                │ │
│  │ [Theme]   │                                                │ │
│  │          │                                                │ │
│  └──────────┴────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

| Dimension | Value | Notes |
|-----------|-------|-------|
| Sidebar width | 256px (w-64) | Fixed |
| Sidebar min-content | 256px | Cannot shrink below sidebar width |
| Main area flex | `flex-1` | Fills remaining space |
| Header height | 64px | Fixed |
| Kanban board min-height | `calc(100vh - 12rem)` | Ensures full viewport usage |
| Grid gap (columns) | 20px (gap-5) | Space between kanban columns |
| Page padding | 24px (p-6) | Inner padding of board area |

### 2.2 Responsive Breakpoints

Per PRD — desktop-only target. However, implement basic responsiveness for large/small laptops:

| Breakpoint | Width | Changes |
|------------|-------|---------|
| `desktop-large` | ≥1440px | Full layout |
| `desktop-medium` | ≥1024px | Full layout |
| `desktop-small` | 768–1023px | Reduce padding, smaller fonts |
| `<768px` | N/A | **Not supported** — show "Desktop only" message |

For production — consider adding a minimal responsive layout even if not required by PRD:
- Hide subproject selector on small screens
- Reduce avatar size
- Increase touch targets to 44×44px minimum

### 2.3 Kanban Board Columns

| Property | Value |
|----------|-------|
| Min-width per column | 280px |
| Max-width per column | 380px |
| Flex grow | 1 (equal width) |
| Gap between columns | 20px |
| Column header height | Auto (single line + count badge) |
| Card container overflow | `overflow-y-auto` (scrollable vertically) |
| Empty state centering | Flex-center with icon + label |

---

## 3. Component Specifications

### 3.1 Sidebar

| Element | Style | States |
|---------|-------|--------|
| Container | `w-64 flex flex-col border-r` | `bg-secondary` / `border-primary` |
| Logo section | `px-5 py-5 border-b` | — |
| Brand icon | `w-7 h-7 rounded-md bg-accent-blue text-white` | — |
| Brand text | `font-semibold text-base` | — |
| Section label | `text-xs font-semibold uppercase tracking-wider text-muted` | px-2 mb-2 |
| Project button | `w-full text-left px-3 py-2 rounded-lg text-sm font-medium` | See below |
| Active project | `bg-blue-600/20 text-blue-400 border border-blue-600/30` (dark) | `bg-blue-50 text-blue-700 border border-blue-200` (light) |
| Inactive project | Gray text, transparent border | Hover: `bg-tertiary` |
| Create project btn | Dashed border, gray text | Hover: `bg-tertiary` |
| Theme toggle | Flex justify-between, pill switch | Custom toggle switch (see §3.1.1) |
| Scroll behavior | `flex-1 overflow-y-auto` for project list | Bottom actions sticky at bottom |

#### 3.1.1 Theme Toggle Switch

Implement as accessible `<button role="switch">`:

| Property | Value |
|----------|-------|
| Width | 36px |
| Height | 20px |
| Track color (off/dark) | Blue-600 (#3B82F6) |
| Track color (on/light) | Gray-300 (#D1D5DB) |
| Thumb size | 16px × 16px |
| Thumb position (dark/on) | right-aligned (`left-[28px]`) |
| Thumb position (light/off) | left-aligned (`left-0.5`) |
| Transition | 200ms ease-in-out |
| ARIA | `role="switch"`, `aria-checked={theme === 'light'}` |
| Label | Icon (sun/moon) + text «Светлая тема» / «Тёмная тема» |

### 3.2 Header

| Element | Style | States |
|---------|-------|--------|
| Container | `flex items-center justify-between px-6 py-3 border-b` | `h-16`, `bg-secondary`, `border-primary` |
| Project name | `text-lg font-semibold` | `text-primary` |
| Project description | `text-xs mt-0.5` | `text-secondary` |
| Subproject selector | `text-xs select` | Styled input with arrow |
| Stats dots | `w-2 h-2 rounded-full` | Color-coded per status |
| Connection indicator | `flex items-center gap-1.5 text-xs` | Green/red dot + text |
| Online dot | `w-2.5 h-2.5 rounded-full` | Animated pulse when online |
| Offline state | Red dot, red text «Оффлайн» | — |
| Create task button | `px-3 py-1.5 bg-accent-blue text-white text-sm font-medium rounded-lg` | Hover: `bg-blue-700` |

### 3.3 KanbanBoard

| Element | Style | States |
|---------|-------|--------|
| Container | `flex-1 overflow-x-auto p-6` | — |
| Board row | `flex gap-5 min-h-[...]` | H-full |
| Column wrapper | `flex-1 min-w-[280px] max-w-[380px] flex flex-col` | — |
| Column header | `flex items-center gap-2 mb-4 px-1` | Dot + Title + Count badge |
| Column body | `rounded-xl p-3 space-y-3 overflow-y-auto` | `bg-tertiary border border-primary` |
| Count badge | `text-xs font-medium px-2 py-0.5 rounded-full` | `bg-tertiary text-muted` |
| Empty state | Centered SVG + text | `opacity-30` SVG icon |
| Skeleton loading | Placeholder shapes | Shimmer animation 1.5s loop |

#### 3.3.1 Column Colors

| Status | Dot Color | Tailwind Class |
|--------|-----------|---------------|
| In Work | Blue (#3B82F6) | `bg-blue-500` |
| Review | Amber (#F59E0B) | `bg-amber-500` |
| Done | Green (#22C55E) | `bg-green-500` |

### 3.4 TaskCard

| Element | Style | States |
|---------|-------|--------|
| Container | `rounded-lg border p-3.5` | `bg-secondary border-primary` |
| Priority badge | `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium` | Color-specific (see §3.4.1) |
| Card title | `text-sm font-semibold leading-snug` | `text-primary`, truncated (max 2 lines) |
| Description | `text-xs` | `text-secondary`, truncated (line-clamp-2) |
| Avatar | `w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold` | Hash-based color |
| Assignee name | `text-xs` | `text-secondary` |
| Date | `text-[11px]` | `text-muted` |

#### 3.4.1 Priority Badge Colors

| Priority | Dark bg | Light bg | Dark text | Light text |
|----------|---------|----------|-----------|------------|
| High | `bg-red-900/30` | `bg-red-100` | `text-red-400` | `text-red-700` |
| Medium | `bg-amber-900/30` | `bg-amber-100` | `text-amber-400` | `text-amber-700` |
| Low | `bg-green-900/30` | `bg-green-100` | `text-green-400` | `text-green-700` |

#### 3.4.2 Component States

| State | Visual Change |
|-------|--------------|
| Default | `bg-secondary border-primary` |
| Hover | `border-gray-600 hover:shadow-md transition-all duration-150 ease-out` |
| Focus-visible | `ring-2 ring-accent-blue ring-offset-2 ring-offset-secondary` |
| New (optimistic add) | `flash-highlight` — blue glow 2s then normal |
| Updated (real-time) | `slide-from-old-column` animation 300ms |
| Error | `border-red-500` with inline error banner inside card |

### 3.5 Modals

| Element | Style | States |
|---------|-------|--------|
| Backdrop | `fixed inset-0 z-50 flex items-center justify-center` | `bg-black/50 backdrop-blur-sm` |
| Modal shell | `relative w-full max-w-lg rounded-lg shadow-lg border p-6` | `bg-secondary border-primary` |
| Header | `flex items-center justify-between mb-5` | Title + close button |
| Form fields | `space-y-4` | Label + Input pair |
| Submit btn | `px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg` | Hover: `bg-blue-700` |
| Cancel btn | `px-4 py-2 text-secondary hover:bg-tertiary text-sm font-medium rounded-lg` | — |

#### 3.5.1 Modal Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Role | `role="dialog"` |
| Modal attribute | `aria-modal="true"` |
| Title reference | `aria-labelledby="modal-title-id"` |
| Focus management | Focus trap within dialog, first field autofocus |
| Escape key | Closes modal |
| Backdrop click | Closes modal (with unsaved warning if form partially filled) |
| Body scroll lock | `document.body.style.overflow = 'hidden'` while open |
| Screen reader hidden | `aria-hidden="true"` on root app container |

### 3.6 Forms (within modals)

| Element | Style | States |
|---------|-------|--------|
| Label | `block text-sm font-medium mb-1` | `text-secondary` |
| Required marker | `<span className="text-red-500">*</span>` after label text | — |
| Input/Select/Textarea | `w-full px-3 py-2 rounded-lg border text-sm` | `bg-tertiary border-primary` |
| Placeholder | `text-muted` | — |
| Focus state | `border-accent-blue outline-none focus:border-accent-blue` | Plus global `focus-visible:ring` |
| Validation error | `border-red-500` + inline error message below field | Red text `text-red-500 text-xs` |

### 3.7 Toast Notifications

| Property | Value |
|----------|-------|
| Position | Bottom-right corner |
| Max visible | 3 (stacked with offset) |
| Auto-dismiss | 5 seconds |
| Animation | Slide in from right (enter), slide out to right (exit) |
| Types | `info` (blue), `success` (green), `warning` (amber), `error` (red) |
| Content | Brief description of event (task updated, created, failed) |

### 3.8 Banner Notifications

| Property | Value |
|----------|-------|
| Position | Top of page (above header) |
| Dismissible | Yes (× button top-right) |
| Types | `error` (network failure, API error), `warning` (partial sync), `info` (update available) |
| Close action | Removes banner, no data impact |

---

## 4. Interaction Patterns

### 4.1 Project Switching

```
User clicks project in Sidebar
  ↓
Sidebar sets currentProjectId
  ↓
KanbanBoard re-renders with filtered tasks
  ↓
Header updates with new project name
  ↓
Animation: subtle fade (150ms) on board content
```

### 4.2 Task Creation

```
User clicks "Создать задачу" (Header button)
  ↓
CreateTaskModal opens (animation: 200ms scale + opacity)
  ↓
Focus moves to title input (autofocus)
  ↓
User fills form (title*, assignee*, priority, description)
  ↓
User clicks "Создать"
  ↓
Optimistic: card added to In Work column immediately
  ↓
API call POST /api/tasks
  ↓
Success: toast notification "Задача создана"
Error: rollback card addition + toast "Не удалось создать задачу" + retry button
```

### 4.3 Real-time Task Update (SSE)

```
Agent updates task via REST API
  ↓
Server emits SSE event (task_updated)
  ↓
Browser receives event via EventSource
  ↓
AppContext processes payload:
  1. Find matching task in local state
  2. Update task status/description/priority
  3. Trigger re-render
  4. If status changed: animate card movement between columns
  5. Announce change to screen readers (aria-live region)
  6. Show toast notification: "Задача X перемещена в Y"
```

### 4.4 Theme Toggle

```
User clicks theme toggle
  ↓
State changes (dark ↔ light)
  ↓
Document class toggled (html.dark)
  ↓
Tailwind dark mode applies
  ↓
All themed elements transition (200ms)
  ↓
localStorage saved (persist across sessions)
```

---

## 5. Screen Sizes & Compatibility

| Browser | Version Support | Notes |
|---------|----------------|-------|
| Chrome | Latest - 2 | Primary target |
| Firefox | Latest - 2 | Full support |
| Safari | Latest - 2 | macOS/iOS — desktop only |
| Edge | Latest - 2 | Chromium-based |
| Opera | Latest - 2 | Chromium-based |

**Mobile/Tablet:** Not supported in v1. Show a centered message:
```
«Приложение оптимизировано для настольных браузеров. 
Для работы требуется экран шириной не менее 768px.»
```

---

## 6. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2s | First paint of kanban board |
| FID (First Input Delay) | < 100ms | Click on project/element |
| CLS (Cumulative Layout Shift) | < 0.1 | No layout jumps during load |
| Time to Interactive | < 1.5s | After initial render |
| Animation frame rate | 60fps | During transitions and real-time updates |

---

## 7. Accessibility Goals

**Target level: WCAG 2.1 AA**

Key requirements implemented during Phase 2:

| Requirement | Target | Implementation approach |
|-------------|--------|------------------------|
| Text contrast | ≥ 4.5:1 (normal), ≥ 3:1 (large) | Design tokens (§1.1) |
| Keyboard navigation | 100% operable | Tab order, focus-visible, focus trap in modals |
| Screen reader compatibility | All info conveyed | ARIA roles, labels, live regions, semantic HTML |
| Color independence | Information not conveyed by color alone | Text labels + icons/icons pattern for priority |
| Focus indicators | Visible on all interactive elements | Global focus-visible rule |
| Skip navigation | Available | Skip-to-content link |
| Form labels | All fields labeled | aria-label/label associations |
| Error handling | Clear identification | Inline validation + banners |

---

## 8. Authentication Pages (TSK-018)

### 8.1 Login Page (`/login`)

**Route:** `/login`  
**Layout:** Standalone full-page form, no sidebar/header  
**Theme:** Dark theme default (no toggle — login is utility page)

#### Visual Spec

| Element | Style | States |
|---------|-------|--------|
| Page container | `min-h-screen flex items-center justify-center bg-bg-primary` | Centered vertically + horizontally |
| Card wrapper | `w-full max-w-md rounded-lg border p-8` | `bg-secondary border-border-primary shadow-lg` |
| Card title | `text-xl font-semibold text-text-primary mb-6 text-center` | "Sign in" or localized |
| Email input | `w-full px-3 py-2 rounded-lg border text-sm` | Same as modal inputs (§3.6) |
| Password input | `w-full px-3 py-2 rounded-lg border text-sm type="password"` | Same as email; `type="password"` |
| Submit button | `w-full py-2 rounded-lg bg-accent-blue text-white text-sm font-medium` | Hover: `bg-blue-700`; Disabled: `opacity-50 cursor-not-allowed` |
| Error banner | `mb-4 rounded-lg border bg-accent-red/10 p-3 text-sm text-accent-red` | Only visible on error |
| Register link | `mt-6 text-center text-sm text-text-muted` | Hover: `text-text-secondary`; `<a href="/register">Don't have an account? Sign up</a>` |

#### Form Structure

```tsx
<form onSubmit={handleSubmit} className="space-y-4" noValidate>
  {/* Error Banner */}
  {error && (
    <div role="alert" className="mb-4 rounded-lg border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
      {error}
    </div>
  )}

  {/* Email */}
  <div>
    <label htmlFor="login-email" className="block text-sm font-medium text-text-secondary mb-1">
      Email <span className="text-accent-red">*</span>
    </label>
    <input
      id="login-email"
      type="email"
      autoComplete="email"
      autoFocus
      aria-invalid={!!errors.email}
      aria-describedby={errors.email ? 'login-email-error' : undefined}
      placeholder="name@company.com"
      disabled={submitting}
      className="..."
    />
    {errors.email && <p id="login-email-error" className="mt-1 text-xs text-accent-red" role="alert">{errors.email}</p>}
  </div>

  {/* Password */}
  <div>
    <label htmlFor="login-password" className="block text-sm font-medium text-text-secondary mb-1">
      Password <span className="text-accent-red">*</span>
    </label>
    <input
      id="login-password"
      type="password"
      autoComplete="current-password"
      autoFocus={false}
      aria-invalid={!!errors.password}
      aria-describedby={errors.password ? 'login-password-error' : undefined}
      disabled={submitting}
      className="..."
    />
    {errors.password && <p id="login-password-error" className="mt-1 text-xs text-accent-red" role="alert">{errors.password}</p>}
  </div>

  {/* Submit */}
  <button
    type="submit"
    disabled={submitting}
    className="w-full rounded-lg bg-accent-blue py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {submitting ? 'Signing in...' : 'Login'}
  </button>
</form>
```

#### Component States

| State | Visual Change |
|-------|--------------|
| Default / idle | Standard form fields, blue submit button |
| Focus on field | Blue border + global focus-visible ring (§1.6 globals.css) |
| Loading | Button shows `{submitting ? 'Signing in...' : 'Login'}`, `disabled`, reduced opacity; spinner optional |
| Validation error | Red border on invalid field + inline error message below |
| Server error | Top-of-form red banner with generic message "Invalid email or password" (security-safe) |
| Rate limited | Warning banner: "Too many attempts. Try again in X seconds" |

#### UX Requirements

1. **autoFocus**: First field (`#login-email`) gets `autoFocus` on mount
2. **Enter to submit**: Native `<form onSubmit>` handles this
3. **Tab order**: Email → Password → Submit button → Register link
4. **Error focus restoration**: On validation error, focus first invalid field
5. **Redirect after success**: `router.replace('/')` removes login from history
6. **aria-live assertionive**: Screen reader announcement after redirect: `"You have been logged in successfully."`

---

### 8.2 Register Page (`/register`)

**Route:** `/register`  
**Layout:** Standalone full-page form, matching login card styling  
**Fields:** Name, Email, Password, Confirm Password

#### Visual Spec

| Element | Style | States |
|---------|-------|--------|
| Card wrapper | Same as login | `max-w-md` |
| Name input | `w-full px-3 py-2 rounded-lg border text-sm` | Same pattern |
| Password input | `w-full px-3 py-2 rounded-lg border text-sm type="password"` | Same + strength indicator below |
| Confirm password | `w-full px-3 py-2 rounded-lg border text-sm type="password"` | Real-time match/mismatch indicator |
| Submit button | Same as login | Full-width, primary blue |
| Strength meter | Optional progress bar below password field | Green/amber/red segments |

#### Additional Fields vs Login

| Field | Type | Validation | Indicator |
|-------|------|------------|-----------|
| Name | text, required | `z.string().trim().min(1).max(100)` | Inline error on blur or submit |
| Email | email, required | Same as login | Same as login |
| Password | password, required (≥8) | Min length shown in placeholder or hint | Password strength meter (recommended) |
| Confirm Password | password, required | Must equal password value | Real-time checkmark (✓) or cross (✗) icon; `aria-live="polite"` |

#### Confirm Password UX

```tsx
const passwordMatch = password === confirmPassword && confirmPassword.length > 0;

// ...in JSX:
<div>
  <div className="flex items-center gap-2">
    <label htmlFor="register-confirm" className="...">Confirm Password</label>
    {confirmPassword.length > 0 && (
      <span aria-live="polite" aria-label={passwordMatch ? 'Passwords match' : 'Passwords do not match'}>
        {passwordMatch ? (
          <CheckIcon className="h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <XIcon className="h-4 w-4 text-accent-red" aria-hidden="true" />
        )}
      </span>
    )}
  </div>
  <input
    id="register-confirm"
    type="password"
    autoComplete="new-password"
    value={confirmPassword}
    onChange={e => setConfirmPassword(e.target.value)}
    aria-invalid={!passwordMatch || !!errors.confirmPassword}
    aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
    // ...
  />
  {errors.confirmPassword && (
    <p id="register-confirm-error" className="mt-1 text-xs text-accent-red" role="alert">
      {errors.confirmPassword}
    </p>
  )}
</div>
```

#### Password Strength Meter (Recommended — Not Mandatory for AA)

Visual bar with 4 segments:
- 0–1 segment (empty): gray — too short
- 2 segments (amber): partial — has some characters but missing variety
- 3 segments (green-light): good — meets most criteria
- 4 segments (green-dark): strong — all criteria met

Criteria checklist (shown below or in tooltip):
- [x] At least 8 characters
- [ ] Contains uppercase letter
- [ ] Contains lowercase letter
- [ ] Contains number
- [ ] Contains special character

---

### 8.3 Role-Based UI Pattern

#### Sidebar Changes (§3.1)

When authenticated admin:
- Existing projects list unchanged
- New element at bottom (after theme toggle):

```tsx
{/* Auth section — admin only */}
{isAdmin && (
  <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-tertiary">
    <svg aria-hidden="true">/* sign-out icon */</svg>
    Logout
  </button>
)}
```

When authenticated stakeholder:
- No admin buttons rendered (not even hidden/disabled — omitted from DOM entirely)
- User email displayed in sidebar footer area:

```tsx
{/* Auth section — always shown when authenticated */}
{user && (
  <div className="px-3 py-2 text-xs text-text-muted truncate" title={user.email}>
    {user.email}
  </div>
)}
```

**Accessibility note:** The conditional rendering changes tab order dynamically. Ensure no duplicate focusable elements are created. When admin logs out and becomes stakeholder, focus should not be lost.

#### Header Changes (§3.2)

Stakeholder: "+ Create Task" button omitted from DOM (not hidden via CSS `display:none`). This preserves tab order simplicity.

Admin: "+ Create Task" button rendered normally.

#### Implementation Principle

> Never render restricted elements with `style={{ display: 'none' }}` or `visibility: 'hidden'`. Use React conditional rendering (`{isAdmin && <Button />}`). This ensures screen readers never encounter forbidden actions.

---

### 8.4 Auth Flow States

| Phase | Component State | Visual |
|-------|----------------|--------|
| Session check (page load) | `isLoading: true` | Minimal spinner or blank; DO NOT show dashboard skeleton |
| Unauthenticated | Redirect to `/login` | Browser navigates away from current URL |
| Authenticating (login) | `submitting: true` on button | Button shows spinner text, disabled |
| Authenticate success | Redirect to `/` via `router.replace()` | Smooth transition, focus moves to main content |
| Authenticate failure | Show error banner on form | Red banner + inline field errors |
| Rate limited | Show warning banner | Amber banner with retry-after countdown |

---

### 8.5 Toast Notifications for Auth

All auth events use the existing `useToast` hook pattern (§3.7):

| Event | Type | Message Example | Duration |
|-------|------|-----------------|----------|
| Login success | `info` | "Welcome back" | 3s (shorter — user already sees dashboard) |
| Register success | `success` | "Account created successfully" | 5s |
| Login failed | `error` | "Invalid email or password" | 7s (longer — user may need to retry) |
| Email already registered | `error` | "An account with this email already exists" | 7s |
| Rate limited (login) | `warning` | "Too many attempts. Please wait before trying again" | 10s |
| Rate limited (register) | `warning` | "Too many registration attempts. Please wait" | 10s |
| Network error during auth | `error` | "Connection failed. Check your network and try again" | 7s with retry button |

---

## 9. Mobile Responsiveness (Supersedes §5)

> NOTE: PRD lists mobile as "Won't Have v2", but auth pages MUST work on mobile since users will register/login from phones.

### 8.6 Auth Pages — Mobile Responsive

| Property | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| Card width | `max-w-md` (~280px) | `max-w-md` | `w-full mx-4` (full width with margin) |
| Card padding | `p-8` | `p-6` | `p-4` |
| Font size | 14px inputs | 14px inputs | 16px inputs (prevent iOS zoom) |
| Touch target | 44×44px min | 44×44px min | 44×44px min |
| Layout | Single column centered | Single column centered | Single column centered |

The responsive viewport meta tag is already present in Next.js head. Add explicit minimum touch targets:

```css
@media (max-width: 768px) {
  .auth-input { font-size: 16px; } /* Prevent iOS auto-zoom */
  .auth-btn { min-height: 44px; }
}
```

