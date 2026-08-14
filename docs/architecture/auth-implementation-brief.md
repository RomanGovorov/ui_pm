# Auth Implementation Brief — TSK-018 Consolidated Handoff

**Version:** 1.0
**Author:** architecture-planner
**Date:** 2026-08-14
**Purpose:** Consolidated must-fix items from Security (17 findings) + UI/UX (18 findings) Phase 1 audits for code-implementer

---

## Overview

Two Phase 1 audits were completed for TSK-018 (User Authentication):
- **Security Audit**: 17 findings (3 HIGH, 8 MEDIUM, 6 LOW) — see `docs/security/findings/PHASE1-011_auth-security-audit.md`
- **UI/UX & Accessibility Audit**: 18 findings (3 Critical, 7 High, 5 Medium, 3 Minor) — see `docs/ui-ux/findings/PHASE1-001_auth-ui-audit.md`

This brief organizes findings by implementation priority for the code-implementer.

---

## Priority 1: MUST FIX (Architecture-Changing — Implement First)

These items change the architecture and must be implemented as specified. They cannot be deferred.

### SEC AUTH-001: SSE Endpoint Requires Authentication [HIGH]

**What changed:** SSE endpoint `/api/events` is NO LONGER open. It now requires authentication.

**Implementation:**
In `middleware.ts`, remove the unconditional pass-through for `/api/events`. Instead:
1. Check `X-API-Key` header → if valid → allow (agent access)
2. Check `auth_token` cookie → if valid JWT → allow (browser user)
3. Neither → reject with `401 { error: { code: "UNAUTHORIZED" } }`

**Why:** Unauthenticated users could monitor all real-time project activity.

**Side effect:** `useSSE` hook must reconnect after login (cookie wasn't available before login).

---

### SEC AUTH-002: Registration Returns Generic Response for Duplicate Email [HIGH]

**What changed:** Registration endpoint NO LONGER returns `409 EMAIL_EXISTS`.

**Implementation:**
In `POST /api/auth/register` route handler:
- If email already exists → return `200 { "message": "If an account with this email exists, you can sign in at /login" }`
- Do NOT set a cookie or create a session
- Do NOT reveal whether the email was registered

**Why:** Prevents email enumeration attacks.

**UX note:** The auth context `register()` function must handle this response — it receives 200 but no user data. If the response has `message` but no `user` object, show the message to the user but do NOT redirect to dashboard.

---

### SEC AUTH-003: JWT_SECRET Startup Validation [HIGH]

**What changed:** `lib/auth/session.ts` MUST validate JWT_SECRET at module load time.

**Implementation:**
```typescript
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}
if (JWT_SECRET_RAW.length < 64) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
```

**Why:** App must fail fast at startup, not crash on first auth request or sign tokens with a weak secret.

---

### UI CRIT-001: FOUC Prevention — isLoading Gate in page.tsx [CRITICAL]

**What changed:** `app/page.tsx` MUST check `isLoading` before rendering dashboard content.

**Implementation:**
```tsx
const { user, isLoading, isAuthenticated } = useAuth();

if (isLoading) {
  return <AuthLoadingState />; // centered spinner, nothing else
}

if (!isAuthenticated) {
  redirect('/login'); // Next.js redirect
}

// Render dashboard only after auth check completes
return <DashboardContent />;
```

**Why:** Without this gate, unauthenticated users briefly see dashboard content (with sensitive project data) before being redirected.

---

### UI CRIT-002: Skip-to-Content Exception Documentation [CRITICAL]

**What changed:** Auth pages need explicit documentation that skip-to-content is NOT required.

**Implementation:**
Add a comment at the top of both `app/login/page.tsx` and `app/register/page.tsx`:
```tsx
// WCAG 2.4.1 Bypass Blocks: Skip-to-content link is NOT required here.
// Rationale: Auth pages are full-page centered forms with no navigation
// sidebar or header. The form IS the only content on the page.
```

**Why:** Prevents future developers from either adding unnecessary markup or missing the rationale.

---

### UI CRIT-003: Role-Based UI — Tab Order & ARIA for Sidebar [CRITICAL]

**What changed:** Sidebar updates (email display + logout) must maintain correct focus order.

**Implementation:**
- Tab order: project list → logout button → theme toggle
- Logout button: `<button>` with icon (`aria-hidden="true"`) + text label "Logout"
- User email: plain text (not interactive)
- Use `role` attribute to indicate admin vs stakeholder context where appropriate

**Why:** Screen reader users need predictable tab stops after new elements are added.

---

## Priority 2: MUST FIX (Code-Level — Implement During Phase 6)

These items don't change architecture but must be implemented as part of TSK-018.

### SEC AUTH-005: Common Password Blocklist [MEDIUM]

**Implementation:** Add `COMMON_PASSWORDS` Set to `lib/validators/auth.ts`. Use `.refine()` in `registerSchema` to reject common passwords. Include ~100 entries from well-known breach lists.

### SEC AUTH-006: Admin-Only Route Protection [MEDIUM]

**Implementation:** In `middleware.ts`, add `ADMIN_ONLY_ROUTES = new Set(['/api/users'])`. Check role after JWT verification → 403 if non-admin.

### SEC AUTH-007: Auth Audit Logging [MEDIUM]

**Implementation:** Create `lib/auth/audit-log.ts`. Call `logAuthEvent()` from login, register, and logout route handlers. Log: event type, email, IP. NEVER log passwords or tokens.

### SEC AUTH-008: Login Rate Limit — Failures Only [MEDIUM]

**Implementation:** In `POST /api/auth/login` route handler, only call `rateLimit()` on FAILED authentication attempts. Successful logins do not consume rate limit quota.

### SEC AUTH-010: Exact Path Matching for Public Routes [MEDIUM]

**Implementation:** Replace `pathname.startsWith('/api/auth/')` with `PUBLIC_AUTH_ROUTES.has(pathname)` using a `Set`. Prevents future routes from being unintentionally public.

### SEC AUTH-015: .env.example File [LOW]

**Implementation:** Create `.env.example` with all required variables including `JWT_SECRET`, `REGISTRATION_ENABLED`, with placeholder values.

---

### UI HIGH-001: Login Error Banner with role="alert" [HIGH]

**Implementation:** Top-of-form error banner with `role="alert"`, red border/background, using API error message. Pattern:
```tsx
{error && (
  <div role="alert" className="mb-4 rounded-lg border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
    {error}
  </div>
)}
```

### UI HIGH-003: Real-time ConfirmPassword Match Indicator [HIGH]

**Implementation:** In register form, show green checkmark / red X icon as user types in confirmPassword field. Use `aria-live="polite"` for screen reader announcement.

### UI HIGH-004: Loading/Disabled State on Submit Buttons [HIGH]

**Implementation:** Both login and register forms must have `submitting` state:
```tsx
<button type="submit" disabled={submitting}>
  {submitting ? 'Signing in...' : 'Login'}
</button>
```
Pattern reference: existing `CreateTaskModal.tsx` (lines 91, 122).

### UI HIGH-005: Toast Notifications for Auth Events [HIGH]

**Implementation:** Use existing `useToast` hook:
- Register success: success toast "Account created successfully"
- Login error: error toast + inline form banner
- Rate limited: warning toast with retry info

### UI HIGH-006: Focus Management After Login Redirect [HIGH]

**Implementation:** Use `router.replace('/')` (not `push`) to remove login URL from history. Optionally add `aria-live="assertive"` sr-only announcement.

### UI HIGH-007: AutoFocus on First Field [HIGH]

**Implementation:** Login page: `autoFocus` on email input. Register page: `autoFocus` on name input. After validation error: focus reverts to first invalid field.

### UI MED-003: Auth Pages Mobile Responsiveness [MEDIUM]

**Implementation:** Auth pages must be responsive even though dashboard is desktop-first:
- Full-width centered card on mobile
- Touch-friendly tap targets (min 44×44px)
- Stack form fields vertically

### UI MED-005: Auth Loading State Component [MEDIUM]

**Implementation:** Create `AuthLoadingState` component — centered spinner with `<span className="sr-only">Loading...</span>`. Used by `page.tsx` during `isLoading` and auth pages during session check.

---

## Priority 3: Accepted Risks (Document, Don't Fix)

These are known limitations accepted for v1. Document them in code comments or ADR.

### SEC AUTH-004: Role in JWT Without Server-Side Check [MEDIUM]

**Status:** Accepted v1 risk. Demoted users retain role for up to 7 days.
**Mitigation:** Admin can rotate `JWT_SECRET` to invalidate all tokens.
**v2:** Add `tokenVersion` field to User model.

### SEC AUTH-009: Open Registration Relies on Network Access Control [MEDIUM]

**Status:** Accepted v1 risk. App MUST NOT be deployed on publicly accessible endpoints.
**Mitigation:** Add `REGISTRATION_ENABLED` env var to disable registration after setup.
**Implementation:** Check `process.env.REGISTRATION_ENABLED !== 'false'` in register route.

---

## Priority 4: Nice-to-Have (v2 — Do NOT Implement Now)

| Finding | Description | v2 Plan |
|---|---|---|
| AUTH-011 | JWT `aud`/`iss` claims | Add static claims + verification |
| AUTH-012 | `__Host-` cookie prefix | Rename cookie in production |
| AUTH-013 | bcrypt 72-byte limit | Pre-hash with SHA-256 or reduce max to 72 |
| AUTH-014 | Per-account lockout | Add `failedLoginAttempts` + `lockedUntil` fields |
| AUTH-016 | CAPTCHA on registration | Add hCaptcha or Turnstile |
| HIGH-002 | Password strength indicator | Visual strength meter with criteria checklist |
| MED-001 | Light theme CSS selector alignment | Fix `color-scheme` for light theme |
| MED-002 | Form validation strategy | Debounced real-time for email format |
| MED-004 | Logout button accessibility | Confirmation dialog consideration |

---

## Implementation Order (Recommended)

```
1. lib/auth/session.ts         → AUTH-003 (JWT_SECRET validation)
2. lib/auth/audit-log.ts       → AUTH-007 (audit logging)
3. lib/validators/auth.ts      → AUTH-005 (password blocklist)
4. .env.example                → AUTH-015 (env template)
5. middleware.ts               → AUTH-001 (SSE auth), AUTH-006 (admin routes), AUTH-010 (exact match)
6. POST /api/auth/register     → AUTH-002 (generic response), AUTH-007 (log)
7. POST /api/auth/login        → AUTH-008 (failures only), AUTH-007 (log)
8. POST /api/auth/logout       → (unchanged)
9. GET /api/auth/me            → (unchanged)
10. lib/context/auth-context.tsx → handle generic register response
11. app/components/auth/AuthLoadingState.tsx → MED-005
12. app/page.tsx               → CRIT-001 (FOUC prevention)
13. app/login/page.tsx         → HIGH-001, HIGH-004, HIGH-005, HIGH-006, HIGH-007, CRIT-002
14. app/register/page.tsx      → HIGH-003, HIGH-004, HIGH-007, CRIT-002
15. Sidebar.tsx                → CRIT-003, MED-004
16. Header.tsx                 → (role-based button hiding)
17. Tests                      → cover all AUTH-xxx items
18. Accessibility test         → CRIT-001/003, HIGH-001/004/006/007
```

---

## Files Modified by Audit Integration

| File | Changes |
|---|---|
| `docs/architecture/component-specifications.md` | §5.1 JWT startup validation, §5.2 password blocklist, §5.3 generic registration response, §5.7 middleware SSE auth + exact match + admin routes, §5.10 rate limit fix, §5.11 audit logging |
| `docs/architecture/implementation-plan.md` | Phase 6 steps 6.4–6.26 updated with audit references, expanded acceptance criteria |
| `docs/architecture/data-flow.md` | §2.3 SSE auth flow, §5.1 registration sequence, §5.3 middleware decision logic |
| `docs/architecture/system-architecture.md` | §6.2 security boundaries updated with 4 new items |
| `docs/architecture/auth-implementation-brief.md` | This file (new) |

---

## Architectural Decisions Made

| Decision | Rationale |
|---|---|
| SSE requires auth | Prevents unauthenticated monitoring of project activity |
| Registration returns 200 for duplicate emails | Prevents email enumeration; acceptable UX for internal tool |
| JWT_SECRET validated at module load | Fail-fast prevents silent security failures |
| Login rate limit counts failures only | Prevents legitimate users from being locked out by their own successful logins |
| Admin-only routes use middleware-level check | Defense-in-depth; route handlers also check role |
| Exact path matching for public routes | Prevents future routes from being unintentionally public |
| Auth pages are responsive (despite desktop-first dashboard) | Users register/login on phones |
| `router.replace` after login | Removes login URL from history (back button doesn't go to login) |
| AUTH-004 (role in JWT) accepted as v1 risk | 5-10 users, admin can rotate secret if needed |
| AUTH-009 (open registration) accepted as v1 risk | Network-level access control assumed; env var available to disable |
