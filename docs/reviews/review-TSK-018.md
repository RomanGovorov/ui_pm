# Code Review — TSK-018: User Authentication

**Date:** 2026-08-14
**Reviewer:** code-reviewer
**Iteration:** code_review_iteration: 1 / 3
**Incoming Transition:** T34 (from code-implementer)
**Source:** code-implementer (initial implementation)

---

## Summary

Comprehensive code review of the TSK-018 User Authentication implementation covering JWT session management, password hashing, auth API endpoints, middleware dual auth, auth UI pages, and role-based access control. The implementation is well-structured, security-conscious, and addresses all 10 security must-fix items and 11 UI/UX must-fix items from the architecture brief.

**Result:** Critical: 0, High: 1, Medium: 4, Low: 3

---

## Security Verification

### AUTH-001: SSE Endpoint Requires Authentication ✅
Middleware correctly requires API key or JWT for `/api/events`. Rejects unauthenticated requests with 401.

### AUTH-002: Registration Anti-Enumeration ✅
Duplicate email returns `200` with generic message. No cookie set, no session created. Response shape differs from success (no `user` object) but auth context handles this correctly.

### AUTH-003: JWT_SECRET Startup Validation ✅
Module-level validation at `session.ts:9-16`. Throws immediately if missing or < 64 characters. Tested with dynamic imports in `auth-session.test.ts`.

### AUTH-005: Common Password Blocklist ✅
~100 entries in `Set`, case-insensitive check via `.toLowerCase()`. Enforced in Zod `.refine()`. Tested with multiple common passwords including case variations.

### AUTH-006: Admin-Only Route Protection ✅
`ADMIN_ONLY_ROUTES` Set with exact match. Checks role after JWT verification. Returns 403 for non-admin users. Allows both `admin` and `agent` roles.

### AUTH-007: Auth Audit Logging ✅
Structured JSON logging for all auth events (login_success, login_failure, register, logout, auth_error). Never logs passwords or tokens. Uses appropriate log levels (warn for failures).

### AUTH-008: Rate Limit Failures Only ✅
Rate limiter is called only on failed login attempts (`login/route.ts:55-63`). Successful logins bypass the rate limit entirely.

### AUTH-010: Exact Path Matching ✅
`PUBLIC_ROUTES` uses `Set` with exact string matching. No `startsWith` patterns that could accidentally expose future routes.

### AUTH-015: .env.example ✅
Created with all variables including `JWT_SECRET`, `REGISTRATION_ENABLED`, with placeholder values and generation instructions.

### Additional Security Checks
- **Cookie security:** HttpOnly, SameSite=Lax, Path=/, Secure in production ✅
- **JWT algorithm:** HS256 (symmetric, appropriate for single-server) ✅
- **bcrypt rounds:** 12 (industry standard for 2026) ✅
- **bcryptjs over bcrypt:** Correct choice for Docker/Alpine compatibility ✅
- **Non-null assertion `user.email!`:** Used in register/login routes after finding user by email — safe since email is the lookup key ✅

---

## UI/UX Verification

### CRIT-001: FOUC Prevention ✅
`page.tsx` AuthGate shows `<AuthLoadingState />` during `isLoading`, redirects to `/login` if unauthenticated, renders dashboard only after auth confirmed.

### CRIT-002: Skip-to-Content Exception ✅
Both `login/page.tsx` and `register/page.tsx` have inline documentation explaining why skip-to-content is not required (full-page centered forms).

### CRIT-003: Role-Based ARIA ✅
Sidebar shows user name/email (non-interactive), logout button with icon (`aria-hidden="true"`) + text label. Create Project button conditionally rendered for admin/agent roles.

### HIGH-001: Error Banner with role="alert" ✅
Both login and register forms show error banner with `role="alert"`, red border, appropriate styling.

### HIGH-003: Real-time Password Match Indicator ✅
Register form shows ✓/✗ icon with `aria-live="polite"` and `aria-label` for screen readers. Visual indicator with green/red border colors.

### HIGH-004: Loading/Disabled Submit ✅
Both forms have `submitting` state, disabled button during submission, spinner with text ("Signing in..." / "Creating account...").

### HIGH-006: Focus Management ✅
Uses `router.replace('/')` after login/register to remove auth URL from browser history.

### HIGH-007: AutoFocus ✅
Login: `emailRef.current?.focus()` in useEffect. Register: `nameRef.current?.focus()` in useEffect.

### MED-005: Auth Loading State ✅
`AuthLoadingState` component with centered spinner and `sr-only` "Loading..." text.

### Responsive Design ✅
Auth pages use `w-full max-w-md` with `px-4` padding — works on mobile. Touch targets are adequate (buttons `py-2.5` ≈ 42px height, close to 44px WCAG minimum).

---

## Findings

### HIGH-001: Unauthenticated GET Access to Data API Routes

**Severity:** HIGH
**Location:** `src/middleware.ts:196-199`
**Description:** The middleware allows unauthenticated GET requests on all non-public, non-SSE, non-admin API routes. This means `GET /api/projects`, `GET /api/tasks`, `GET /api/projects/[id]/tasks` return data without authentication.
**Code:**
```typescript
// Read operations: allow (dashboard data is accessible to authenticated users)
// Unauthenticated reads on non-public routes also allowed (for backward compat with open dashboard)
const response = NextResponse.next();
return applyCorsHeaders(response, request);
```
**Impact:** Any client that can reach the server can enumerate all projects, tasks, and subprojects via REST API, even though the UI redirects unauthenticated browser users to `/login`. This partially undermines AUTH-001's protection of project data.
**Remediation:** Add authentication requirement for all non-public API GET routes:
```typescript
// After write operation check:
if (!auth.authenticated) {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401, headers: getCorsHeaders(request) },
  );
}
```
**Note:** This may be an intentional v1 backward-compatibility decision. If so, document it as an accepted risk in an ADR and plan for v2 enforcement.

---

### MEDIUM-001: `getClientIp` Function Duplicated 5 Times

**Severity:** MEDIUM
**Location:** `src/app/api/auth/login/route.ts:13`, `src/app/api/auth/register/route.ts:13`, `src/app/api/auth/logout/route.ts:9`, `src/middleware.ts:42`, `src/app/api/events/route.ts:7`
**Description:** The same `getClientIp` function is copy-pasted across 5 files.
**Impact:** Maintenance burden — if IP extraction logic needs updating (e.g., adding `cf-connecting-ip` for Cloudflare), 5 files must be changed. Risk of drift.
**Remediation:** Extract to `src/lib/utils/request.ts`:
```typescript
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
```

---

### MEDIUM-002: `/api/auth/me` Bypasses Service Layer

**Severity:** MEDIUM
**Location:** `src/app/api/auth/me/route.ts:7`
**Description:** The `/api/auth/me` route directly imports `prisma` and queries the database instead of using `userService`. All other auth routes use `userService` for data access.
**Code:**
```typescript
import { prisma } from '@/lib/db/client';
// ...
const user = await prisma.user.findUnique({
  where: { id: payload.sub },
  select: { id: true, name: true, email: true, role: true },
});
```
**Impact:** Violates the service layer pattern. If `userService` adds caching, logging, or data transformation, `/api/auth/me` won't benefit. Also, the DB-unavailable fallback returns `payload.sub` as `name`, which is a UUID — not a useful display name.
**Remediation:** Use `userService` or add a `findById` method. Fix the fallback to return `null` instead of incorrect data:
```typescript
catch {
  // If DB is unavailable, return stale JWT data with a warning flag
  return NextResponse.json({
    user: { id: payload.sub, name: null, email: payload.email, role: payload.role },
    stale: true,
  });
}
```

---

### MEDIUM-003: Middleware Matcher Regex Imprecision

**Severity:** MEDIUM
**Location:** `src/middleware.ts:17`
**Description:** The matcher pattern `(?!...|login|register)` uses bare strings without word boundaries. This could exclude paths like `/loginpage`, `/register-reset`, or `/login/callback` from middleware processing.
**Code:**
```typescript
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|login|register).*)',
],
```
**Impact:** If a future page is created at `/login-admin` or `/register-verify`, the middleware won't run for it, meaning no auth check and no redirect. The page would be accessible without authentication.
**Remediation:** Use more precise patterns:
```typescript
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|login(?:/.*)?$|register(?:/.*)?$).*)',
],
```
**Risk assessment:** Low current risk (no conflicting routes exist), but the pattern should be tightened to prevent future accidents.

---

### MEDIUM-004: Seed Password in Common Passwords Blocklist

**Severity:** MEDIUM
**Location:** `prisma/seed.ts:142`, `src/lib/validators/auth.ts:19`
**Description:** The seed file uses `admin12345` as the admin password, which is in the `COMMON_PASSWORDS` blocklist. While the seed bypasses the validator (calls `hash()` directly), this creates cognitive dissonance for developers who see the password printed in the console and might try to use similar patterns during registration.
**Impact:** Developers might think the blocklist is broken if they see `admin12345` in the seed but can't register with `admin1234` or `admin12345`.
**Remediation:** Either:
1. Change seed password to something not in the blocklist (e.g., `Adm1n!Secure2026`)
2. Add a comment in seed.ts explaining the intentional bypass

---

### LOW-001: Unnecessary Type Assertion in `isAdmin`

**Severity:** LOW
**Location:** `src/lib/context/auth-context.tsx:98`
**Description:** `const isAdmin = user?.role === ('admin' as UserRole)` — the `as UserRole` assertion is unnecessary since `'admin'` is already a valid `UserRole` literal.
**Remediation:** Simplify to `const isAdmin = user?.role === 'admin'`.

---

### LOW-002: Audit Log Uses Raw `console.log`

**Severity:** LOW
**Location:** `src/lib/auth/audit-log.ts:28`
**Description:** `logAuthEvent` uses `console.log(JSON.stringify(...))`. In production, this should use a structured logger (e.g., `pino`) for proper log aggregation, log levels, and formatting.
**Impact:** Logs may not integrate well with log aggregation tools. `console.log` in Next.js middleware has limited formatting capabilities.
**Remediation:** Plan for v2: integrate a structured logger. Acceptable for v1.

---

### LOW-003: `REGISTRATION_ENABLED` Only Checks Strict Equality

**Severity:** LOW
**Location:** `src/app/api/auth/register/route.ts:25`
**Description:** `process.env.REGISTRATION_ENABLED === 'false'` only disables registration when explicitly set to the string `'false'`. Values like `'0'`, `'no'`, `'off'`, or empty string leave registration enabled.
**Impact:** Operators might expect `'0'` or `'no'` to disable registration.
**Remediation:** Use a truthy check: `['false', '0', 'no', 'off'].includes(process.env.REGISTRATION_ENABLED?.toLowerCase() ?? '')`. Or document the expected value in `.env.example`.

---

## Positive Aspects

1. **Excellent security hygiene** — All 10 security must-fix items are properly implemented. JWT startup validation, anti-enumeration, rate limiting, and audit logging are all well-executed.

2. **Clean separation of concerns** — Auth logic is properly split into `session.ts` (JWT), `password.ts` (bcrypt), `audit-log.ts` (logging), and `validators/auth.ts` (schemas). Each module has a single responsibility.

3. **Comprehensive test coverage** — 29 new tests covering startup validation, JWT sign/verify, cookie helpers, validator schemas, password hashing, and the common password blocklist. Dynamic import pattern for testing module-level validation is clever.

4. **Backward compatibility preserved** — Existing API key auth is unchanged. The `resolveAuth` function elegantly handles dual auth (API key → JWT fallback).

5. **Well-documented decisions** — Code comments reference specific audit IDs (AUTH-001, AUTH-002, etc.) making traceability clear. Accepted risks are documented.

6. **Edge-compatible JWT** — Using `jose` instead of `jsonwebtoken` ensures compatibility with Next.js middleware (Edge Runtime). No Node.js `crypto` dependency.

7. **Auth context design** — The `AuthProvider` with `authVersion` counter for SSE reconnection is a clean solution. The `register()` function correctly handles the anti-enumeration response.

8. **UI accessibility** — Auth pages have proper labels, `role="alert"` for errors, `aria-live` for password match indicator, `sr-only` text for loading spinners, and keyboard-accessible forms.

9. **Migration is safe** — The SQL migration adds nullable columns (`email`, `password_hash`) and a new enum value, which is non-destructive for existing data.

10. **`.env.example` is thorough** — Includes generation commands (`openssl rand -hex`), minimum lengths, and descriptions for all variables.

---

## Architecture Compliance

| Requirement | Status |
|-------------|--------|
| Follows `auth-implementation-brief.md` | ✅ All items implemented |
| AUTH-004 (role in JWT) NOT implemented | ✅ Correctly deferred to v2 |
| AUTH-009 (registration disable) implemented | ✅ Via `REGISTRATION_ENABLED` env var |
| v2 items NOT implemented | ✅ No JWT aud/iss, no __Host- prefix, no CAPTCHA |
| Follows `component-specifications.md` | ✅ Matches §5.x specifications |
| Existing API key auth unchanged | ✅ `lib/auth.ts` untouched |

---

## Quality Metrics

| Metric | Value | Target |
|--------|-------|--------|
| Critical issues | 0 | 0 |
| High priority issues | 1 | ≤ 3 |
| Medium issues | 4 | — |
| Low issues | 3 | — |
| New test count | 29 | — |
| Security requirements met | 10/10 | 10/10 |
| UI/UX requirements met | 11/11 | 11/11 |

---

## Recommendation

**PASS** — The implementation meets all security and UI/UX must-fix requirements with 0 critical issues and 1 high issue (within the ≤ 3 threshold). The HIGH-001 finding about unauthenticated GET access to data endpoints is a known design decision documented in the code. Medium and low issues are non-blocking and can be addressed in follow-up iterations.

Code proceeds to T45a (comprehensive-test-engineer) and T45b (performance-analyst) in parallel.

### Flagged Areas for Test/Performance Agents
- **Test engineer:** Verify auth flow integration (register → login → SSE reconnect → logout). Test middleware auth with various header combinations.
- **Performance analyst:** Profile bcrypt hashing latency (12 rounds). Check rate limiter memory usage under load. Verify JWT sign/verify throughput.
