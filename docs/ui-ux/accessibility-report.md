# Accessibility Requirements — WCAG 2.1 AA Audit

**Version:** 1.0
**Author:** ui-ux-accessibility-specialist (Phase 1 Audit)
**Date:** 2026-08-13
**Target Level:** WCAG 2.1 AA

---

## Summary of Findings

| # | Finding | Severity | WCAG Criteria | Status |
|---|---------|----------|---------------|--------|
| 1 | Цветовой контраст — тёмная тема | Serious | 1.4.3 (AA) | Open |
| 2 | Отсутствие ARIA-атрибутов и ролей | Critical | 1.3.1, 2.4.1, 2.4.3, 2.4.6, 2.4.7, 4.1.2 (A/AA) | Open |
| 3 | Карточки задач — визуальная иерархия | Serious | 1.4.4 (AA) | Open |
| 4 | Нет feedback при real-time обновлениях | Moderate | 3.2.1, 3.3.1 (A) | Open |
| 5 | Боковое меню — фокус-ринги клавиатуры | Serious | 2.4.7 (AA) | Open |
| 6 | Модальные окна — фокус-менеджмент | Critical | 2.1.1, 2.4.3, 4.1.2 (A) | Open |
| 7 | Приоритет только через цвет | Serious | 1.4.1 (A) | Open |
| 8 | Отсутствие состояний загрузки и ошибок | Moderate | 3.3.1, 3.3.3 (A), 3.2.5 (AAA) | Open |

**Critical issues: 2** (blocking — must be fixed before release)
**Serious issues: 4** (should be fixed before release)
**Moderate issues: 2** (recommended for v1, can defer to v1.1)

---

## Detailed WCAG Criteria Mapping

### 1. Perceivable (Воспринимаемость)

#### 1.1 Text Alternatives [1.1.1] — Level A

| Element | Requirement | Implementation |
|---------|-------------|---------------|
| SVG icons (decorative) | `aria-hidden="true"` + `focusable="false"` | On all decorative SVGs in KanbanColumn, Sidebar, Header |
| Avatar initials | Alternative text not required (initials ARE the visual representation of a name already visible next to it) | N/A |
| Priority dot | `aria-hidden="true"` if accompanied by text label | Badge contains "High"/"Medium"/"Low" text ✅; dot gets `aria-hidden` |
| Empty state icon | `aria-hidden="true"` | KanbanColumn empty state icon |
| Connection status dot | Must have text alternative or be part of combined element with text | Combined with "Online"/"Offline" text ✅ (but needs i18n fix) |

#### 1.2 Time-based Media [1.2.x] — Not applicable in v1

No video/audio content planned for v1.

#### 1.3 Adaptable [1.3.1-1.3.4]

| Criterion | Requirement | Implementation |
|-----------|-------------|---------------|
| **1.3.1 Info and Relationships** (A) | Information conveyed through structure and labels, not just visual | All form fields need `<label>` associations ✅ existing; Column headers need `aria-label` with count; ARIA roles on containers ❌ missing → add `role="main"`, `role="dialog"` for modals |
| **1.3.2 Meaningful Sequence** (A) | Content ordered logically | DOM order matches visual layout ✅; Skip-to-content link needed |
| **1.3.3 Sensory Characteristics** (A) | Instructions don't rely solely on sensory characteristics | Priority described as color position + shape — needs explicit description ✅ with text badge labels |
| **1.3.4 Layout** (AA) | Layout ≥ 390px horizontal without loss | Kanban columns min 280px each → total min ~860px + sidebar 256 = 1116px. Adequate for desktop target ✅ |

#### 1.4 Distinguishable [1.4.1-1.4.13]

##### 1.4.1 Use of Color [A]

| Element | Current State | Required Fix |
|---------|--------------|--------------|
| Priority badge | Color-coded bg + colored dot + TEXT LABEL | Keep both color AND text label; add `aria-label` for SR |
| Status column dots | Color-coded dots + TEXT LABEL (In Work/Review/Done) | OK — text labels sufficient; make dots decorative `aria-hidden` |
| Connection indicator | Green/red dot + text | OK — text labels sufficient |
| Stats dots in header | Blue/yellow/green dots + numbers | OK — numbers provide context |

**Decision:** Priority and status both use color + text, which satisfies 1.4.1. The main concern is that users may miss the text if they only scan colors — addressed by §PHASE1-007.

##### 1.4.3 Contrast (Minimum) [AA]

See §1.1 of `ui-spec.md` for defined contrast ratios. Key fixes needed from prototype:

| Element | Prototype Color | Fixed Color | Contrast Ratio |
|---------|----------------|-------------|----------------|
| Task description (dark) | `text-gray-400` on `bg-gray-800` | `text-secondary` (#B0B0C0) on `--bg-secondary` (#14141F) | 7.8:1 ✅ |
| Task date (dark) | `text-gray-500` on `bg-gray-800` | `text-muted` (#808090) on `--bg-secondary` | 5.7:1 ⚠️ borderline — acceptable for meta text >18px equivalent |
| Sidebar section label | `text-gray-500` on `bg-gray-900` | `text-muted` on `--bg-primary` | 5.1:1 ✅ |
| Column header title | `text-gray-300` / `text-gray-600` | `text-secondary` in both themes | 7.8:1 / 10.5:1 ✅ |
| Yellow priority text (light) | `text-yellow-700` on `bg-yellow-100` | `text-amber-700` on `bg-amber-100` | 5.7:1 ✅ |

##### 1.4.4 Resize Text [AA]

- User browser zoom up to 200% must work
- Text uses relative units (`rem`, `em`) where possible
- Container widths are flexible (flex-1, min/max-width constraints)
- No overflow on zoomed text: ensure descriptions wrap properly

##### 1.4.10 Reflow [AA]

- At 320px width, content must reflow horizontally without requiring two-dimensional scrolling
- Target resolution: ≥1024px (desktop). PRD says mobile not required, so this criterion is met by scope definition.

##### 1.4.11 Non-text Contrast [AA]

Interactive elements (buttons, inputs) and UI components (badges, avatars) need minimum 3:1 contrast against adjacent colors.

| Element | Requirement | Verification |
|---------|-------------|--------------|
| Buttons | 3:1 against background | `bg-blue-600` white text = 4.54:1 ✅ |
| Border buttons | 3:1 stroke against background | Dashed borders at gray-600 ≈ 5.7:1 on secondary ✅ |
| Input borders | 3:1 against background | `border-gray-600` on `bg-gray-700` ≈ 2.8:1 ⚠️ → increase to `border-gray-500` |
| Priority badges | 3:1 against card background | Red on red-900/30 = ~3.0:1 ⚠️ borderline |
| Avatar circles | 3:1 against card background | Hash-based colors — verify each meets 3:1 against `bg-gray-800` |
| Column dots | 3:1 against column background | Blue-500 on gray-800/50 ≈ 3.2:1 ✅; Amber-500 on same ≈ 2.7:1 ⚠️ |

---

### 2. Operable (Управляемость)

#### 2.1 Keyboard Accessible [2.1.1]

All interactive elements must be operable via keyboard:

| Interactive Element | Keyboard Operation | Status |
|---------------------|-------------------|--------|
| Project navigation buttons | Tab to focus, Enter to select | Focus ring ❌ → implement `focus-visible:ring` |
| Theme toggle | Tab to focus, Space/Enter to toggle | `role="switch"` needed + key handlers ❌ |
| Create project button | Tab to focus, Enter to open modal | Already tabbable ✅ but needs focus ring |
| Create task button | Tab to focus, Enter to open modal | Tabindex ✅, focus ring ❌ |
| Subproject selector | Tab to focus, arrow keys navigate | Native `<select>` handles this ✅ |
| Modal form inputs | Tab between fields, Enter submits | Tab order ✅, focus trap ❌ |
| Modal close button | Tab to focus, Enter to close | Already clickable ✅ but needs ARIA label |
| Escape key | Close modal on ESC | Missing ❌ |

#### 2.2 Focus Visible [2.4.7] — Level AA

Every keyboard-focusable element must show a visible focus indicator:

| Element | Requirement | Implementation |
|---------|-------------|---------------|
| All buttons | `outline: 2px solid --focus-ring; outline-offset: 2px` | Global CSS rule via `@layer base` |
| Inputs/Selects/Textareas | Same as buttons + respect border-radius | Inherit radius from element |
| Modal backdrops | NOT focusable (click-only) | `tabindex="-1"` or skip |
| Decorative SVGs | NOT focusable | `tabindex="-1"` or `focusable="false"` |
| Scrollable areas | Visual indication of scroll position | Default browser scrollbar styling + custom thin scrollbar |

```css
/* globals.css - focus styles */
@layer base {
  *:focus-visible {
    outline: 2px solid var(--color-blue-500);
    outline-offset: 2px;
    border-radius: inherit;
  }

  /* Ensure dark mode visibility */
  html.dark *:focus-visible {
    outline-color: var(--accent-blue, #60A5FA);
    outline-offset: 2px;
  }
}
```

#### 2.3 Keyboard No Trap [2.1.2]

Only dialog/modal should trap focus. All other interactions allow natural keyboard flow. ✅ by design — modals are the only focus-trapping elements.

#### 2.4 Timing Adjustable [2.3.1] — Level A

Not applicable in v1 (no timed content, no auto-refreshing data except SSE which is push-based, not time-limited).

#### 2.5 Three Flashes [2.3.3] — Level AAA

Not applicable (no animations with flashing content). Skeleton shimmer animation must not flash more than 3 times per second.

#### 2.6 Label Names [2.4.2] — Level A

Every interactive element needs a discernible name:

| Element | Name Source | Status |
|---------|------------|--------|
| Sidebar buttons | Button text («Название проекта») | ✅ |
| Create project button | Button text + SVG (descriptive enough) | ⚠️ Add `aria-label="Создать новый проект"` for clarity |
| Theme toggle | Custom switch needs descriptive label | ❌ `aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}` |
| Create task button | Button text «Создать задачу» | ✅ |
| Modal close button | Close icon (X) — needs aria-label | ❌ `aria-label="Закрыть"` |
| Avatar circle | Part of assignee row — name text serves as label | ✅ (name displayed next to it) |
| Priority dot | Decorative, part of badge with text | ✅ (text label "High" provides name) |

#### 2.7 Page Titled [2.4.2] — Level A

Document `<title>` must describe the page.
```html
<title>Project Manager — Dashboard</title>
```
Currently using generic "App" in prototype. Needs proper title.

#### 2.8 Focus Order [2.4.3] — Level A

Tab order must follow logical reading sequence:

```
Skip-to-content → Sidebar: projects → Sidebar: create project → Sidebar: theme toggle
→ Header: subproject selector → Header: create task → Main board: cards (top to bottom, left to right)
→ When modal open: Modal: first input → remaining fields → Cancel → Submit → Escape
```

DOM order matches this sequence. ✅

#### 2.9 Heading Levels [2.4.6] — Level A

Heading hierarchy must be logical and nested correctly:

| Element | Tag | Status |
|---------|-----|--------|
| App title / Project name | H1 | ✅ `<h1>` in Header |
| Column titles | H2 | ✅ `<h2>` in KanbanColumn |
| Modal titles | H2 | ✅ `<h2>` in Modals |
| Section headers (Sidebar) | No heading tag, styled div | ⚠️ Consider `<h3>` for "Проекты" label |

Fix: Change sidebar section label to H3:
```tsx
<h3 className="text-xs font-semibold uppercase tracking-wider px-2 mb-2">Проекты</h3>
```

#### 2.10 Link Purpose [2.4.4] — Level A

Not directly applicable since we use `<button>` elements for actions (correct choice over links). ✅

#### 2.11 Focus Visible (already covered above)

---

### 3. Understandable (Понимаемость)

#### 3.1 Language [3.1.1] — Level A

Page language must be declared.
```html
<html lang="ru">
```
Prototype uses `<html lang="ru">` ✅.

#### 3.2 On Focus [3.2.1] — Level A

Focusing an element should not trigger unexpected context changes.
- Sidebar project selection: triggers re-render but stays on page ✅
- Theme toggle: doesn't change focus position ✅
- Modal open: creates new context, focus moves inside modal ✅ (if implemented)

#### 3.3 On Input [3.2.2] — Level A

Changing input fields shouldn't cause automatic submission.
- Form fields use standard submit pattern (requires explicit click) ✅

#### 3.4 Identifying Input Purpose [3.2.3] — Level AA

Not applicable (no autofill sensitive fields like credit cards, SSN).

#### 3.5 Error Identification [3.3.1] — Level A

Errors must be identified and described to user in text.
- Form validation errors: inline messages below input field ❌ → add error text + wrapper with error class
- API errors: toast/banner notification ❌ → implement error banner (§PHASE1-008)
- Required fields: asterisk marker ✅, but also add `aria-required="true"` on inputs

#### 3.6 Error Suggestions [3.3.3] — Level A

If error is detected, provide suggestions for correction.
- If title too long (>200 chars): suggest max length with current count «Осталось X символов» ❌ → add character counter
- If invalid email/UUID (future): provide correct format example

#### 3.7 Error Prevention [3.3.4] — Level AA

For forms that could commit irreversible actions, confirmation or checkpoint is recommended.
- Delete action (future): require confirmation modal ✅ (plan ahead)
- "Create task" — already low-risk (creates reversible item) ✅

---

### 4. Robust (Надёжность)

#### 4.1 Compatible [4.1.1] — Level A

Valid HTML markup, no duplicate IDs, no malformed attributes.
```html
<!-- Good -->
<div id="modal-dialog" role="dialog" aria-modal="true">
  <h2 id="modal-dialog-title">...</h2>
</div>
<!-- Bad (prototype has some implicit div usage) -->
<div class="...">  <!-- Need role="dialog" -->
```

#### 4.2 Name, Role, Value [4.1.2] — Level A

All UI components must expose their name, role, and value through accessible APIs.

| Component | Name | Role | Value | Status |
|-----------|------|------|-------|--------|
| Sidebar project button | Project name | button | N/A | ❌ Missing `aria-current` for active |
| Theme toggle | "Switch theme" | switch | checked={isLight} | ❌ Missing role + aria-checked |
| Priority badge | "Приоритет: высокий" | presentation or status | high | ❌ Missing aria-label for screen readers |
| Subproject select | "Подпроект: ..." | combobox/listbox | selected value | ✅ Native select handles this |
| Kanban column container | "In Work — 5 задач" | region or group | N/A | ❌ Missing aria-label |
| Online indicator | "Статус подключения: онлайн" | status | online/offline | ⚠️ Partially — text present |
| Create task modal form | "Создать задачу" | form/dialog | N/A | ❌ Missing `role="dialog"` |

**Moderate issues: 2** (recommended for v1, can defer to v1.1)

---

## 2. Authentication-Specific Accessibility Requirements (TSK-018)

### Summary of Auth Findings

| # | Finding | Severity | WCAG Criteria | Status |
|---|---------|----------|---------------|--------|
| A1 | FOUC prevention — missing isLoading gate | Critical | 4.1.2, 2.1.1 (A) | Open |
| A2 | Skip-to-content rationale documented | Low | 2.4.1 (A) | Documented |
| A3 | Role-based UI — DOM omission vs CSS hide | Critical | 4.1.2, 1.4.3 (AA) | Open |
| A4 | Login form error messages not announced | High | 3.3.3, 4.1.3 (AA) | Open |
| A5 | No password strength guidance | High | 3.3.7 (AA), 3.3.1 (A) | Open |
| A6 | Confirm password validation UX unclear | High | 3.3.4 (AA) | Open |
| A7 | Loading states on submit buttons undefined | High | 2.2.1, 2.2.2 (A) | Open |
| A8 | No toast feedback for auth events | High | 3.3.1 (A) | Open |
| A9 | Focus management after redirect | High | 2.4.3, 3.2.2 (A) | Open |
| A10 | No autoFocus configuration for forms | High | 2.4.3 (A) | Open |
| A11 | Light theme CSS selector mismatch | Medium | 1.4.3 (AA) | Open |
| A12 | Form validation strategy mixed | Medium | 3.3.1 (A) | Open |
| A13 | Mobile responsive spec needed for auth | Medium | 1.4.10 (AA) | Open |
| A14 | Logout button accessibility not specified | Medium | 2.4.6, 4.1.2 (A/AA) | Open |
| A15 | No loading spinner for session check | Medium | 2.2.1 (A) | Open |
| A16 | Register schema fields not matching UI spec | Minor | 1.3.1 (A) | Open |
| A17 | Default role hardcoded in docs | Minor | N/A | Documentation |

**New critical issues: 2** (FOUC + role-based DOM management)
**New high issues: 6** (error announcements, loading states, focus, toasts, confirm-password, autoFocus)
**New medium issues: 4** (theme, validation, mobile, logout button)
**New minor issues: 2** (spec alignment, documentation)

---

### Detailed WCAG Criteria Mapping for Auth

#### 2.1 Perceivable — Auth Pages

##### 2.1.1 Text Alternatives [1.1.1] — Level A

| Element | Requirement | Implementation |
|---------|-------------|---------------|
| Auth page icons (if any) | `aria-hidden="true"` | No icons planned for login/register; just form fields |
| Checkmark/X for confirm password | If using SVG icon → `aria-hidden="true"` + text label | ✓ Icon: `aria-hidden`; ✗ Icon: `aria-hidden` |
| Password strength meter bars | Must have text alternative (e.g., "Password strength: strong") | Use `aria-label` or visible text label |

##### 2.1.2 Info and Relationships [1.3.1] — Level A

All auth form fields must have proper `<label>` associations:

```html
<!-- ✅ Correct -->
<label htmlFor="login-email">Email</label>
<input id="login-email" type="email" aria-invalid={hasError} />

<!-- ❌ Incorrect — no label -->
<input id="login-email" type="email" placeholder="Email" />

<!-- ❌ Incorrect — label not linked via htmlFor/id -->
<div>
  <span>Email</span>
  <input id="login-email" type="email" />
</div>
```

Required field markers: asterisk (*) after label text + `aria-required="true"` on input.

##### 2.1.3 Sensory Characteristics [1.3.3] — Level A

No instructions rely solely on sensory characteristics. All validation messages are textual. ✅

##### 2.1.4 Contrast [1.4.3] — Level AA

Auth page design uses existing design tokens (§1.1):

| Element | Background | Foreground | Ratio | Pass? |
|---------|-----------|------------|-------|-------|
| Card background | `--bg-secondary` (#14141F) | — | — | ✅ defined token |
| Card title text | `--bg-secondary` | `--text-primary` (#F0F0F5) | 15.4:1 | ✅ |
| Input background | `--bg-tertiary` (#1E1E2E) | — | — | ✅ defined token |
| Input text | `--bg-tertiary` | `--text-primary` (#F0F0F5) | 12.8:1 | ✅ |
| Input placeholder | `--bg-tertiary` | `--text-placeholder` (#505060) | ~3.4:1 | ⚠️ Not required for placeholders per WCAG, but poor UX — increase to `#606070` for light theme readability |
| Error message | `accent-red/10` overlay | `accent-red` (#EF4444) | 4.6:1 | ✅ Just barely passes |
| Submit button text | `accent-blue` (#3B82F6) | white (#FFFFFF) | 4.54:1 | ✅ Just passes |
| Register link | `--bg-secondary` | `--text-muted` (#808090) | 5.1:1 | ✅ Acceptable |

**Light theme verification:**

| Element | Background | Foreground | Ratio | Pass? |
|---------|-----------|------------|-------|-------|
| Card title | `--bg-secondary` (#FFFFFF) | `--text-primary` (#111118) | 18.1:1 | ✅ |
| Input text | `--bg-tertiary` (#F5F5F5) | `--text-primary` (#111118) | 16.7:1 | ✅ |
| Error message | Red overlay on off-white | `accent-red` (#DC2626) | 5.9:1 | ✅ |
| Submit button text | `accent-blue` (#2563EB) | white | 5.7:1 | ✅ |
| Register link | `--bg-secondary` | `--text-muted` (#707080) | 5.8:1 | ✅ |

**Action items:**
- CRIT: Verify error banner contrast carefully — `bg-accent-red/10` creates a near-white overlay where red-on-pink might fall below 4.5:1. Consider using `border-accent-red bg-accent-red/5` instead of `/10` for safer contrast.
- MINOR: Increase placeholder color opacity from current `#505060` to `#606070` for better light-theme visibility.

#### 2.2 Operable — Auth Interactions

##### 2.2.1 Keyboard Accessible [2.1.1] — Level A

All auth interactions must be keyboard-operable:

| Interaction | Keyboard Operation | Status |
|-------------|-------------------|--------|
| Fill email | Type into field | ✅ Native |
| Fill password | Type into field | ✅ Native |
| Submit form | Enter key while focused on input OR click button | ✅ Native `<form onSubmit>` |
| Navigate between fields | Tab / Shift+Tab | ✅ Natural DOM order |
| Click register link | Enter key | ✅ Native `<a>` behavior |
| Cancel / go back browser history | Back button | ✅ Browser native; `router.replace()` prevents going back to login |

##### 2.2.2 Focus Visible [2.4.7] — Level AA

Auth page elements use global focus-visible rule (§1.6 `globals.css`):

```css
*:focus-visible {
  @apply outline-none ring-2 ring-focus-ring ring-offset-2 ring-offset-bg-primary;
}
```

Verification checklist for auth inputs:

| Element | Ring applies? | Border radius respected? | Offset adequate? |
|---------|--------------|------------------------|-----------------|
| Email input | ✅ yes | ✅ rounded-lg inherited | ✅ ring-offset-2 = 8px |
| Password input | ✅ yes | ✅ same | ✅ same |
| Submit button | ✅ yes | ✅ rounded-lg | ✅ same |
| Register link | ✅ yes | ✅ native border | ✅ same |

##### 2.2.3 Focus Order [2.4.3] — Level A

Logical tab order for auth pages:

```
[Page loads]
  ↓ autofocus on #login-email (or #register-name)
  ↓ Tab
[Email / Name field]
  ↓ Tab
[Password field]
  ↓ Tab
[Confirm password field — register only]
  ↓ Tab
[Submit button]
  ↓ Tab
[Register / Login link]
  ↓ Tab wraps or reaches end
```

For admin sidebar after login:
```
[Projects list items] → [+ New Project] → [Theme toggle] → [Logout]
```

Stakeholder sidebar after login:
```
[Projects list items] → [Theme toggle] → [User email (non-focusable div)]
```

##### 2.2.4 Labels [2.4.2] — Level A

Every auth element needs a discernible name:

| Element | Name Source | Implementation |
|---------|------------|----------------|
| Login form | `aria-labelledby` pointing to card title heading | `<h2 id="login-title">Sign in</h2>` + `<form aria-labelledby="login-title">` |
| Email field | `<label htmlFor="login-email">` | ✅ |
| Password field | `<label htmlFor="login-password">` | ✅ |
| Submit button | Button text content | ✅ ("Login" / "Create account") |
| Register link | Link text | ✅ ("Don't have an account? Sign up") |
| Logout button (sidebar) | Button text "Logout" + optional icon | ✅ |

##### 2.2.5 Heading Hierarchy [2.4.6] — Level A

Auth pages should include at least one heading for screen reader navigation:

```html
<h1 className="text-xl font-semibold ...">Sign in</h1>
```

This is NOT decorative — it describes the page purpose. Screen readers will announce "Sign in, heading level 1."

##### 2.2.6 Page Title [2.4.2] — Level A

Each auth page must set a unique `<title>`:

| Route | Title |
|-------|-------|
| `/login` | "Project Manager — Sign In" |
| `/register` | "Project Manager — Create Account" |
| `/` (dashboard) | "Project Manager — Dashboard" |

Implemented via Next.js `generateMetadata`:
```tsx
export async function generateMetadata() {
  return { title: 'Project Manager — Sign In' };
}
```

#### 2.3 Understandable — Auth Forms

##### 2.3.1 Language [3.1.1] — Level A

Auth pages inherit root language (`lang="en"`). If i18n is implemented later, auth strings must be extracted to translation files. For now, English is acceptable per project convention. ✅

##### 2.3.2 On Focus [3.2.1] — Level A

Focusing an auth field does not trigger unexpected changes. Changing select value does not auto-submit. ✅ (no selects on auth forms)

##### 2.3.3 On Input [3.2.2] — Level A

Changing input values does not cause automatic submission. Submit requires explicit click or Enter key. ✅

##### 2.3.4 Identifying Input Purpose [3.2.3] — Level AA

Input autocomplete attributes help assistive technology:

| Field | autoComplete Value | Rationale |
|-------|--------------------|-----------|
| Email | `email` | Standard email autocomplete |
| Password (login) | `current-password` | Existing credential |
| Password (register) | `new-password` | Creating new credential |
| Confirm password | `new-password` | Same as above, helps SR identify it's a password field |
| Name | `name` | Full name autocomplete |

##### 2.3.5 Error Identification [3.3.1] — Level A

Errors must be identified AND described in text:

| Error Type | Location | Method |
|-----------|----------|--------|
| Invalid email format | Inline under email field | Red border + `<p role="alert">Please enter a valid email address</p>` |
| Password too short | Inline under password field | Red border + `<p role="alert">Password must be at least 8 characters</p>` |
| Passwords don't match | Under confirm password field | Red X icon + `<p role="alert">Passwords do not match</p>` |
| Wrong credentials | Top-of-form banner | `<div role="alert" class="...">Invalid email or password</div>` |
| Email already exists | Top-of-form + inline on email field | Combined: banner + red email border with specific message |

**Critical security note:** Login error MUST use generic message "Invalid email or password" (not "User not found" or "Wrong password"). This is both a security best practice AND WCAG-compliant (user still understands something is wrong with their input).

##### 2.3.6 Error Suggestions [3.3.3] — Level A

- If email format invalid: suggest correct format example
- If password too short: show minimum length requirement
- If rate limited: show retry-after countdown

##### 2.3.7 Error Prevention [3.3.4] — Level AA

For forms that could commit irreversible actions: registration creates a user account (reversible via admin delete). The confirmation step is handled implicitly by requiring both password fields to match before submit. ✅

#### 2.4 Robust — Auth Implementation

##### 2.4.1 Compatible Markup [4.1.1] — Level A

Valid HTML structure for auth forms:

```html
<form method="POST" noValidate> <!-- noValidate prevents default browser validation overlay -->
  <label for="login-email">Email *</label>
  <input id="login-email" type="email" autocomplete="email" aria-invalid="false" />
  <button type="submit">Login</button>
</form>
```

All IDs are unique. No duplicate `id` attributes across components. ✅ (each page has its own isolated IDs)

##### 2.4.2 Name, Role, Value [4.1.2] — Level A

| Component | Name | Role | Value | Compliance |
|-----------|------|------|-------|------------|
| Email input | Label text "Email" | textbox | Current email value | ✅ |
| Password input | Label text "Password" | password textbox | Masked value (security override of AA) | ✅ |
| Submit button | Button text "Login" | button | N/A | ✅ |
| Register link | Link text | link | Navigation target | ✅ |
| Theme toggle | Toggle state | switch | checked/unchecked | ✅ (existing sidebar pattern) |

---

### 2.5 Role-Based UI Specific Requirements

When admin switches to stakeholder view (different role), the UI changes dynamically:

| Change | Approach | Accessibility Impact |
|--------|----------|---------------------|
| Hide "+ New Project" | Conditional rendering (`{isAdmin && <Button />}`) | Tab order shrinks — no gap left behind |
| Hide "+ Create Task" | Conditional rendering in Header | Same — tab order adapts |
| Show user email | Static non-focusable div | Not part of tab order — doesn't disrupt |
| Show logout button | Always rendered when authenticated | Adds to tab order after theme toggle |

**Focus adaptation test:** After logout redirects to `/login`, then logging in as a different role — verify the new sidebar's tab order is complete and logical from first element to last.

---

### 2.6 Testing Strategy Extension — Auth Pages

| Test | Method | Pass criteria |
|------|--------|---------------|
| Keyboard-only login | Tab through fields, Enter to submit, Enter to navigate to register | Every field reachable, form submits, redirect works |
| Screen reader login | VoiceOver/NVDA read entire form | Label→field pairing clear, error messages announced |
| Login error flow | Submit empty form → submit wrong credentials | Errors announced via `role="alert"`, fields get focus |
| Rate limit scenario | Rapid-fire 11 login attempts | Warning banner shown, button disabled during cooldown |
| Session timeout | Wait for JWT expiry (>7 days) → refresh dashboard | Redirected to `/login`, error banner shows |
| Mobile viewport | Chrome DevTools device toolbar: iPhone SE, Pixel 5 | Inputs readable, touch targets ≥ 44×44px, no horizontal scroll |
| Dark/light theme | Toggle during auth session | All auth text maintain ≥ 4.5:1 contrast |
| Zoom 200% | Browser zoom login page | No content clipped, all text readable |
| Autofill | Browser autofills email/password | Fields accept autofilled values, form submits correctly |
| Password visibility toggle | If adding show/hide password button | Button accessible, toggles `type="password"` ↔ `type="text"` |


| Priority | WCAG Level | Issues | Action |
|----------|-----------|--------|--------|
| P0 — Must fix before Phase 2 code | A + AA Critical | PHASE1-002 (ARIA roles), PHASE1-006 (focus trap) | Block implementation until fixed |
| P1 — Should fix before Phase 2 code | AA | PHASE1-001 (contrast), PHASE1-005 (focus rings), PHASE1-007 (color independence) | Fix alongside implementation |
| P2 — Recommended for v1 | AA | PHASE1-003 (card hierarchy), PHASE1-005 (switch role), PHASE1-008 (loading states) | Plan for v1 |
| P3 — Can defer to v1.1 | AAA | PHASE1-004 (realtime toast), PHASE1-008 (error banners detailed) | Backlog for v1.1 |

---

## Testing Strategy for Accessibility

### Automated Testing

| Tool | What it checks | Limitations |
|------|---------------|-------------|
| axe DevTools (browser extension) | ARIA roles, contrast, form labels, headings | Misses keyboard logic, focus trap, live regions |
| Lighthouse Accessibility audit | Similar to axe | Less granular |
| jest-axe (unit tests) | Inline in Vitest tests | Only catches rendering-level issues |
| pa11y CI integration | Full-page automated check | Cannot test interactions |

### Manual Testing Checklist

| Test | Method | Pass criteria |
|------|--------|---------------|
| Keyboard navigation | Tab through entire app | Every element reachable, focus visible, logical order |
| Screen reader read-through | VoiceOver (macOS) or NVDA (Windows) | All information conveyed, no dead ends |
| Zoom test | Browser zoom to 200% | No content loss, no horizontal scroll needed |
| Color blind simulation | Chrome DevTools color filter | All info distinguishable (not relying only on color) |
| Contrast checking | axe or manual measurement | All text ≥ 4.5:1, all interactive elements ≥ 3:1 |
| Focus management | Open modal, tab through, escape | Focus trapped inside modal, returns on close |
| Live region update | Change task status manually | Screen reader announces update |

---

## Internationalization Notes

While v1 targets Russian exclusively (`lang="ru"`), ensure future i18n readiness:
- Avoid hardcoded English strings in code
- Use Reacti18next or similar i18n library for string extraction
- Design tokens support multiple languages (RTL-ready flex directions)
- Date formats use `toLocaleDateString('ru-RU')` — make locale configurable
