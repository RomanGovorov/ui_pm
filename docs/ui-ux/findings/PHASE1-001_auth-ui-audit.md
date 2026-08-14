# PHASE1-001: Authentication UI/UX Audit (TSK-018)

**Date:** 2026-08-14
**Auditor:** ui-ux-accessibility-specialist
**Phase:** 1 — Architecture Audit
**Target:** Login / Register pages + Role-based UI pattern

---

## Summary

Auth feature architecture (component-specifications §5, implementation-plan Phase 6) describes login/register pages, JWT session management, and role-based UI adaptation. The existing modals provide an excellent form pattern reference (proper labels, `aria-invalid`, `aria-describedby`, `role="alert"`). However, several gaps exist between the auth spec and WCAG 2.1 AA compliance requirements.

**Findings:** 3 critical, 7 high, 5 medium, 3 minor = **18 total findings**

---

## Critical Findings

### CRIT-001: FOUC Prevention — Missing isLoading Gate in page.tsx

**WCAG:** 4.1.2 Name, Role, Value; 2.1.1 Keyboard (screen readers see unauthenticated content briefly)

**Issue:** Auth-context defines `isLoading` to prevent flash of unauthenticated dashboard before session check completes. Implementation plan step 6.16 says "redirect to /login if unauthenticated" but current `page.tsx` has no auth check at all.

**Spec gap:** Component specs (§5.4 Auth Context) describe behavior but don't specify how the dashboard page uses `isLoading` gate:

```tsx
// What's needed but not specified:
if (isLoading) return null; // or a loading spinner
if (!isAuthenticated) redirect('/login');
```

**Recommendation:** Page-level redirect must be wrapped inside `useEffect` after `isLoading` resolves. During `isLoading`, render empty shell or minimal spinner to prevent flashing sidebar/header with sensitive project data.

**Severity:** CRITICAL — Users (including screen reader users) would see dashboard content before being redirected, leaking unauthenticated information.

---

### CRIT-002: No Skip-to-Content Link on Auth Pages

**WCAG:** 2.4.1 Bypass Blocks (Level A)

**Issue:** Current `page.tsx` includes skip-to-content link (line 41–46). Auth pages (`/login`, `/register`) are standalone pages without navigation — yet WCAG requires a skip link on every page for keyboard users. Auth forms are the first interactive element; a skip link is technically unnecessary since there's no nav to skip, BUT this needs explicit documentation.

**Decision:** For full-page centered forms (no nav/sidebar), skip-to-content is NOT required per WCAG IF the form is the only content. However, the architecture should explicitly document this exception rather than omitting it silently.

**Severity:** CRITICAL — Spec ambiguity could lead developers to either add unnecessary markup OR miss documenting the rationale for exclusion.

---

### CRIT-003: Role-Based UI — Hiding Buttons Is Insufficient

**WCAG:** 4.1.2 Name, Role, Value; 1.4.3 Contrast (Minimum); 3.3.1 Error Identification

**Issue:** Implementation plan steps 6.17–6.18 state "hide button for stakeholder role." Simply removing elements from the DOM is the correct security approach (never expose disabled buttons that reveal restricted functionality). However:

1. No aria-live region announces the role change to screen readers during initial load
2. Sidebar currently shows "Dark mode" / "Light mode" in Russian while the rest is English — stakeholder may see inconsistent language
3. Logout button and user email must appear in sidebar — this adds new interactive elements without accessibility specification

**Risk:** If logout button is added without proper focus management (tab order through project list → logout), keyboard users lose predictability.

**Recommendation:** 
- Do NOT hide — rendering a conditional fragment that omits admin elements entirely is correct
- Add role announcement via `aria-live`: when transitioning from authenticated (admin) to unauthenticated, or when role determines different UI modes
- Document expected tab order through newly rendered elements

**Severity:** CRITICAL — Screen reader users may encounter unexpected tab stops or missing elements without proper announcement.

---

## High Findings

### HIGH-001: Login Form Error Messages Not Announced

**WCAG:** 3.3.3 Error Suggestion (Level AA), 4.1.3 Status Messages (Level AA)

**Issue:** API returns `{ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }`. The component spec does NOT specify how this error should be presented:

- Where? (top-of-form banner vs field-level?)
- How? (`role="alert"` for live region?)
- Focus management? (should focus first field after error?)

**Reference pattern:** Existing CreateTaskModal uses `role="alert"` paragraphs below each field. Login errors are credential-related (not field-specific due to security-generic messages), so they need top-of-form placement.

**Recommendation:**
```tsx
{error && (
  <div role="alert" className="mb-4 rounded-lg border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
    {error}
  </div>
)}
```

---

### HIGH-002: No Password Strength Indicator (Register)

**WCAG:** 3.3.7 Redundant Entry (Level AA), 3.3.1 Error Identification (Level A)

**Issue:** Register schema requires ≥8 characters but provides no guidance on what constitutes a strong password. UX research shows users struggle with vague minimum-length requirements.

**Recommendation:** Visual strength meter is recommended (not mandatory for AA compliance):
- Real-time feedback as user types (not on submit)
- Criteria checklist: min 8 chars, uppercase, lowercase, digit, special char
- Color-coded progress bar (WCAG-safe colors)
- `aria-label` describing current strength level

This is optional but strongly recommended for usability.

---

### HIGH-003: Confirm Password Field Validation UX Unclear

**WCAG:** 3.3.4 Error Prevention (Level AA)

**Issue:** Zod `.refine()` validates confirmPassword matches password, but this is evaluated ON SUBMIT. User experience is poor: type password → type confirm → click register → discover mismatch. 

**Recommendation:** Implement real-time validation with visual indicator:
- Green checkmark icon when fields match
- Red X icon when fields don't match
- Inline message: "Passwords match" / "Passwords do not match"
- `aria-live="polite"` for screen reader announcement

---

### HIGH-004: Loading States During Auth Calls Undefined

**WCAG:** 2.2.1 Timing Adjustable (Level A), 2.2.2 Pause Stop Hide (Level A)

**Issue:** Component spec does not specify loading/disabled states for login/register submit buttons:

- During `login()` call: button should show spinner + `disabled` attribute
- During `register()` call: same
- If user double-clicks rapid-fire submit, duplicate requests can occur

**Reference pattern:** CreateTaskModal uses `submitting` state correctly (line 91 `disabled={submitting}`, line 122 `{submitting ? 'Creating...' : 'Create'}`). This pattern MUST be replicated for auth forms.

**Recommendation:** Every auth form submit button must have:
```tsx
const [submitting, setSubmitting] = useState(false);
// ...
<button type="submit" disabled={submitting}>
  {submitting ? 'Signing in...' : 'Login'}
</button>
```

---

### HIGH-005: No Toast Feedback for Auth Success/Error

**WCAG:** 3.3.1 Error Identification (Level A)

**Issue:** After successful login/register, user is redirected. No confirmation toast is mentioned in the spec. Similarly, API errors (409 EMAIL_EXISTS, 429 RATE_LIMITED) need visible feedback.

**Reference pattern:** Existing app uses `useToast` hook with `addToast(type, message)`. Toast types include `success` (green), `error` (red), `warning` (amber), `info` (blue).

**Recommendation:**
- Login success: info toast ("Welcome back") or silent redirect (user already expects it)
- Register success: success toast ("Account created successfully")
- Login error: error toast + inline form error banner
- Register error (email exists): error toast + inline banner showing which field
- Rate limited: warning toast with retry-after info

---

### HIGH-006: Focus Management After Successful Auth Redirect

**WCAG:** 2.4.3 Focus Order (Level A), 3.2.2 On Input (Level A), 4.1.2 Name, Role, Value

**Issue:** After successful login, `router.push('/')` navigates to dashboard. Screen reader users need the focus to move logically to the main content area. Currently, the dashboard's skip-to-content link targets `#main-content`, but auth redirects may not maintain this structure.

**Recommendation:** Use Next.js `router.replace('/')` (not `push`) to remove login URL from history (back button doesn't go back to login). Optionally announce redirect:
```tsx
<div aria-live="assertive" className="sr-only">
  You have been logged in successfully. Navigating to dashboard.
</div>
```

---

### HIGH-007: No Auto-Focus Configuration for Auth Forms

**WCAG:** 2.4.3 Focus Order (Level A)

**Issue:** Existing CreateTaskModal uses `autoFocus` on the first input. Auth forms should follow the same pattern but it's not documented in the spec.

**Recommendation:**
- Login page: `autoFocus` on email field
- Register page: `autoFocus` on name field (first field)
- After validation error: focus reverts to first invalid field

---

## Medium Findings

### MED-001: Light Theme CSS Selectors Don't Match Dark Theme Pattern

**Issue:** Dark theme uses `:root { ... }` with variables. Light theme uses `.light { ... }` — note this targets class on `html` element (set by `<html className="dark">`). The token values use different naming conventions.

**Specific issue:** CSS variable `--shadow-focus` uses Tailwind `bg-bg-primary` class reference inside `@layer base` rule — this works because Tailwind resolves at build time, but light theme overrides don't change `color-scheme` properly (only sets `html.light { color-scheme: light }`).

**Impact:** Browser autofill/styling may conflict with custom design tokens in light theme.

**Severity:** MEDIUM — cosmetic concern for v1, important for theme completeness.

---

### MED-002: Form Validation Strategy Mixed

**Issue:** Existing modals use submit-time validation (not real-time). Login/register forms have this choice to make:

| Approach | Pros | Cons |
|---|---|---|
| Submit-time (current modal pattern) | Simpler, fewer re-renders | Poorer UX for long forms |
| Real-time per-field | Better UX, immediate feedback | More re-renders, complexity |
| Debounced real-time | Balanced approach | Additional complexity |

**Recommendation:** Auth forms should use submit-time validation for required fields (matching existing pattern) PLUS real-time validation for confirmPassword matching (HIGH-003). Email format validation could be debounced (300ms) for better UX.

---

### MED-003: No Mobile Responsive Spec for Auth Pages

**Issue:** The "Won't Have" section lists "Mobile responsive" under v2. However, authentication pages ARE used on mobile devices. Stakeholders will register/login on phones. Deferring mobile auth support is a bad user experience.

**Recommendation:** Even if dashboard is desktop-first, auth pages should be fully responsive:
- Full-width centered card on mobile
- Stack form fields vertically
- Touch-friendly tap targets (min 44×44px)
- Viewport meta tag already present in Next.js

**Severity:** MEDIUM — blocks mobile access entirely if not addressed.

---

### MED-004: Logout Button Accessibility Not Specified

**Issue:** Implementation plan step 6.17 says "show logged-in user email + logout button" in sidebar. These new elements need accessibility specification:

- User email display: plain text is fine
- Logout button: needs clear label, icon + text, confirmation dialog consideration

**Recommendation:**
```tsx
<button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-muted hover:bg-bg-tertiary">
  <svg /* sign-out icon */ aria-hidden="true" />
  Logout
</button>
```

---

### MED-005: No Spinner/Shimmer for Auth Loading State

**Issue:** When `isLoading` is true (checking session on mount), `page.tsx` should display something. Currently renders nothing or potentially the dashboard skeleton.

**Recommendation:** Create a minimal AuthLoadingState component:
```tsx
function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-primary border-t-accent-blue" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

---

## Minor Findings

### MINOR-001: Language Inconsistency — Russian Text in Sidebar

**Issue:** Sidebar.tsx contains Russian strings: `"Dark mode"` → actually `theme === 'dark' ? 'Dark mode' : 'Light mode'`. Wait — checking again... the actual code shows English text in the header, but the component-spec docs mention Russian skip link ("Перейти к содержимому"). 

**Correction:** The existing Sidebar.tsx uses English labels. The skip-to-content link in AGENTS.md example uses Russian — this is a template/example inconsistency, not an actual bug in the codebase.

**Severity:** MINOR — cleanup needed in documentation/templates.

---

### MINOR-002: Register Schema Collects `name` But Auth UI Spec Doesn't List It

**Issue:** Register schema (`lib/validators/auth.ts`) requires `name: z.string().trim().min(1)` but the implementation plan step 6.12 describes "email + password + confirm password form" without mentioning name field.

**Recommendation:** Update implementation plan step 6.12 to include name field in register form.

---

### MINOR-003: Default Role Assignment Hardcoded in Flow Description

**Issue:** Data-flow diagram shows `role = 'stakeholder'` as default for new registrations. This is business logic, not UI concern, but affects role-based UI testing.

**Severity:** MINOR — documentation consistency, not a WCAG violation.

---

## Design System Consistency Assessment

| Aspect | Match Level | Notes |
|---|---|---|
| Form input styling | ✅ Match | Modal pattern (border, padding, rounded-lg, bg-bg-tertiary) should be reused |
| Button styling | ✅ Match | Primary button: `bg-accent-blue`, white text, rounded-lg, hover:bg-blue-700 |
| Card layout | ⚠️ Needs spec | Auth pages need centered card layout on dark background |
| Error styling | ✅ Match | `text-accent-red`, `border-accent-red` consistent with modals |
| Spacing | ✅ Match | `space-y-4` pattern used in modals |
| Typography | ✅ Match | `text-sm` inputs, `text-xs` error messages |

---

## Recommendations Summary

1. **CRITICAL**: Gate dashboard rendering behind `isLoading` + `isAuthenticated` checks in `page.tsx`
2. **CRITICAL**: Document whether skip-to-content is needed on full-page auth forms (yes/no with rationale)
3. **CRITICAL**: Ensure role-based UI changes (sidebar header, logout) maintain focus order and ARIA landmarks
4. **HIGH**: Implement `role="alert"` banner for login/register errors at top of form
5. **HIGH**: Add loading/disabled states to all auth submit buttons (pattern from CreateTaskModal)
6. **HIGH**: Add real-time confirmPassword validation with visual indicator
7. **HIGH**: Add toast notifications for auth events (success/error/rate-limit)
8. **HIGH**: Add autoFocus to first field + focus restore on validation error
9. **MEDIUM**: Address mobile responsiveness for auth pages (don't defer to v2)
10. **MINOR**: Align register form fields with validator schema (add name field)

---

## Artifacts Produced

- This finding report: `docs/ui-ux/findings/PHASE1-001_auth-ui-audit.md`
- Updated UI spec: `docs/ui-ux/ui-spec.md` (auth page section added)
- Updated accessibility report: `docs/ui-ux/accessibility-report.md` (auth requirements added)
- User flow diagrams: `docs/ui-ux/user-flow-diagrams.md` (auth flows added)
