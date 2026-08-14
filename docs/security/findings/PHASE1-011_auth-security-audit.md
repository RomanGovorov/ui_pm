# PHASE1-011: Authentication Security Audit (TSK-018)

**Severity:** Mixed (3 HIGH, 8 MEDIUM, 6 LOW)
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-14
**Author:** security-auditor
**Scope:** ADR-007 JWT Authentication, Implementation Plan Phase 6, Component Specs §5
**Methodology:** STRIDE + OWASP Top 10 (A01–A10)

---

## Executive Summary

The TSK-018 authentication architecture is fundamentally sound. The choice of JWT in httpOnly cookies with `jose` (Edge-compatible), bcryptjs password hashing, and dual auth coexistence with API key is well-designed. The ADR-007 document demonstrates careful analysis of trade-offs (httpOnly vs localStorage, session vs JWT, sameSite values).

However, the audit identified **3 HIGH**, **8 MEDIUM**, and **6 LOW** findings that must be addressed during implementation. The most critical issues are: unauthenticated SSE access in the post-auth world, email enumeration via registration error codes, and JWT_SECRET startup validation.

---

## HIGH Findings

### AUTH-001: SSE Endpoint Requires No Authentication [HIGH]

**OWASP:** A01:2021 — Broken Access Control
**STRIDE:** Information Disclosure
**Location:** `middleware.ts`, component-specifications.md §5.7 step 2

**Description:**
The current middleware passes `/api/events` through without any authentication check. This was acceptable when the entire application was open, but after adding JWT auth, unauthenticated users can still connect to the SSE stream and receive real-time task updates — including titles, descriptions, assignees, and statuses. This undermines the purpose of adding authentication.

**Impact:**
An unauthenticated attacker with network access can monitor all real-time project activity, including task details and status changes.

**Evidence:**
Current middleware (line 63-68):
```typescript
if (pathname === '/api/events') {
    const response = NextResponse.next();
    // ... adds CORS headers
    return response;
}
```
Component spec §5.7 step 2: "SSE endpoint (`/api/events`) → pass through with CORS headers (unchanged, read-only)"

**Remediation:**
SSE endpoint MUST require authentication (JWT cookie or API key). Update middleware to:
1. Check API key header → if valid → allow SSE
2. Check JWT cookie → if valid → allow SSE
3. Neither → reject with 401

The `EventSource` browser API does not support custom headers, but cookies are sent automatically. So browser users will authenticate via JWT cookie. For API consumers, the `fetch()` API with `credentials: 'include'` or manual `X-API-Key` header works.

**Implementation note:** Update the middleware matcher to still include `/api/events` but require auth. Remove the unconditional pass-through.

---

### AUTH-002: Registration Email Enumeration via 409 Error [HIGH]

**OWASP:** A07:2021 — Identification and Authentication Failures
**STRIDE:** Information Disclosure
**Location:** Component spec §5.3 — POST `/api/auth/register`

**Description:**
The registration endpoint returns `409 EMAIL_EXISTS` when an email is already registered. This allows an attacker to enumerate valid email addresses in the system by sending registration requests with candidate emails and observing the response code.

**Impact:**
Attacker can determine which email addresses are registered, enabling targeted phishing or credential stuffing attacks.

**Evidence:**
Component spec §5.3 error table:
```
| 409 | EMAIL_EXISTS | Email already registered |
```

**Remediation:**
Return a generic success-like response for duplicate emails. Two options:

**Option A (recommended for internal tool):** Return `200` with a generic message:
```json
{ "message": "If an account with this email exists, you can sign in at /login" }
```
Do NOT set a cookie or create a session. The attacker cannot distinguish between "email exists" and "email doesn't exist."

**Option B (simpler but less secure):** Use a generic error message for the 409:
```json
{ "error": { "code": "REGISTRATION_FAILED", "message": "Unable to complete registration. Please try a different email." } }
```
This still returns a different status code (409 vs 201), so timing-based enumeration is still possible, but it's less explicit.

**Recommendation:** Use Option A. The slight UX degradation (user may not realize their email is taken) is acceptable for an internal tool where admin creates accounts.

---

### AUTH-003: JWT_SECRET Not Validated at Startup [HIGH]

**OWASP:** A02:2021 — Cryptographic Failures
**STRIDE:** Spoofing (if secret is missing/weak, tokens are forgeable or unverifiable)
**Location:** Component spec §5.1 — `lib/auth/session.ts`

**Description:**
ADR-007 states "JWT_SECRET loaded from env, validated at startup (must be ≥32 bytes)" but the component spec doesn't specify HOW this validation is enforced. If `JWT_SECRET` is missing or too short:
- The app starts successfully
- First login/register attempt crashes with a cryptic `jose` error
- OR worse: if jose falls back to a default/empty secret, all tokens are forgeable

**Impact:**
Application crash on first auth attempt, or (worst case) all tokens signed with a weak/empty secret → complete authentication bypass.

**Remediation:**
Add explicit startup validation in `lib/auth/session.ts`:

```typescript
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}
if (JWT_SECRET_RAW.length < 64) { // 32 bytes = 64 hex chars
  throw new Error('FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)');
}

// Import at module level — jose will use this for all sign/verify operations
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
```

This ensures the app fails fast at startup rather than failing on the first auth request.

---

## MEDIUM Findings

### AUTH-004: Role Stored in JWT Without Server-Side Verification [MEDIUM]

**OWASP:** A01:2021 — Broken Access Control
**STRIDE:** Elevation of Privilege
**Location:** ADR-007 §3 Token Structure, component spec §5.1

**Description:**
The user's role (`admin` | `stakeholder`) is stored in the JWT payload and trusted for 7 days. If an admin demotes a user from `admin` to `stakeholder` (or disables the account), the existing JWT retains `admin` privileges until it expires.

**Impact:**
A demoted or disabled user retains their previous role's access for up to 7 days. In a worst-case scenario, a fired admin retains full access for a week.

**Mitigation (v1 accepted risk):**
Document this limitation clearly. For v1 scale (5-10 users), the admin can:
1. Change `JWT_SECRET` to invalidate all tokens (nuclear option — affects all users)
2. Wait for the 7-day expiry

**Recommendation for v2:**
Add a `tokenVersion` or `lastPasswordChange` field to the User model. Include it in the JWT and verify on each request via a lightweight DB query. Incrementing `tokenVersion` instantly invalidates all existing tokens for that user.

---

### AUTH-005: No Password Complexity Requirements [MEDIUM]

**OWASP:** A07:2021 — Identification and Authentication Failures
**STRIDE:** Spoofing (weak passwords easier to brute-force)
**Location:** Component spec §5.2 — `registerSchema`

**Description:**
The `registerSchema` only requires `min(8)` for password length. No checks against common/breached passwords (e.g., "password123", "qwerty123").

**Impact:**
Users can set trivially guessable passwords, undermining bcrypt's protection (bcrypt slows down brute-force but doesn't prevent dictionary attacks against weak passwords).

**Remediation:**
Add a blocklist of the top 1000 most common passwords. Implementation:

```typescript
// lib/validators/auth.ts
const COMMON_PASSWORDS = new Set([
  'password', '12345678', 'password1', 'qwerty123', 'letmein12',
  // ... import from a file or use a small hardcoded set
]);

const registerSchema = z.object({
  email: z.string().trim().email('Invalid email').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()), {
      message: 'This password is too common',
    }),
  confirmPassword: z.string(),
  name: z.string().trim().min(1, 'Name is required').max(100),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
```

For a more robust solution, consider the `zxcvbn` library (password strength estimation) as a v2 enhancement.

---

### AUTH-006: No Admin-Only Route Protection [MEDIUM]

**OWASP:** A01:2021 — Broken Access Control
**STRIDE:** Elevation of Privilege
**Location:** Component spec §5.7, middleware.ts update plan

**Description:**
The middleware only distinguishes between "write" (admin) and "read" (all authenticated) operations. It does not define admin-only routes that are inaccessible to stakeholders even for reads. For example, `GET /api/users` might expose all user data (emails, roles) to stakeholders.

**Impact:**
Stakeholders can access user management data and potentially sensitive user information.

**Remediation:**
Define a list of admin-only routes in the middleware:

```typescript
const ADMIN_ONLY_ROUTES = ['/api/users'];

// In middleware, after JWT verification:
if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
  if (role !== 'admin') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403, headers: corsHeaders }
    );
  }
}
```

Alternatively, handle this in route handlers via `getCurrentUser()` and role checks — but middleware-level enforcement is more defense-in-depth.

---

### AUTH-007: No Audit Logging for Authentication Events [MEDIUM]

**OWASP:** A09:2021 — Security Logging and Monitoring Failures
**STRIDE:** Repudiation
**Location:** Not addressed in any architecture document

**Description:**
No audit logging is specified for authentication events: successful logins, failed login attempts, registrations, logouts, or role changes. Without logging, security incidents cannot be detected or investigated.

**Impact:**
Cannot detect brute-force attacks, account compromise, or suspicious registration patterns. No forensic capability.

**Remediation:**
Add structured logging for auth events (server-side only, never log passwords or tokens):

```typescript
// lib/auth/audit-log.ts
export function logAuthEvent(event: {
  type: 'login_success' | 'login_failure' | 'register' | 'logout' | 'auth_error';
  email?: string;
  ip: string;
  userAgent?: string;
  reason?: string;
}): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    category: 'auth',
    ...event,
    // NEVER log: password, token, API key
  }));
}
```

Log at minimum:
- `login_failure` with email and IP (detect brute-force patterns)
- `login_success` with email and IP (detect suspicious logins)
- `register` with email and IP (detect spam registration)

---

### AUTH-008: Rate Limiter Counts All Login Requests [MEDIUM]

**OWASP:** A07:2021 — Identification and Authentication Failures
**STRIDE:** Denial of Service (self-inflicted)
**Location:** Component spec §5.10

**Description:**
The rate limiting specification uses the `auth_fail:{ip}` bucket for login, but the existing rate limiter implementation counts ALL requests to that bucket (not just failures). This means 10 successful logins in a minute would trigger rate limiting.

**Impact:**
Legitimate users could be rate-limited by their own successful logins (e.g., multiple browser tabs, page refreshes).

**Remediation:**
For login: only count FAILED attempts toward the rate limit bucket. Successful logins should not consume quota.

```typescript
// In POST /api/auth/login route handler:
const result = await authenticateUser(email, password);
if (!result.success) {
  // Only count failures
  const authLimit = rateLimit(`auth_fail:${clientIp}`, RATE_LIMITS.authFailure);
  if (!authLimit.allowed) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }
  return NextResponse.json(
    { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
    { status: 401 }
  );
}
// Success — don't count toward rate limit
```

For registration: counting all requests is correct (prevent spam).

---

### AUTH-009: Open Registration — Access Control Assumption Undocumented [MEDIUM]

**OWASP:** A01:2021 — Broken Access Control
**STRIDE:** Elevation of Privilege
**Location:** ADR-007 §Consequences (Neutral)

**Description:**
Registration is open — anyone who can reach the server can create an account with `stakeholder` role and access the dashboard (all project data, tasks, real-time updates). The architecture notes this as "acceptable for internal tool where admin creates accounts" but doesn't document the network-level assumption.

**Impact:**
If the application is deployed on a publicly accessible server (e.g., exposed Docker port on a cloud VPS), anyone can register and view all project data.

**Remediation:**
1. **Document the assumption**: "Registration is open; security relies on network-level access control (VPN/firewall). The application MUST NOT be deployed on a publicly accessible endpoint without additional auth measures."
2. **Add `REGISTRATION_ENABLED` env var** (optional): Allow the admin to disable registration after initial setup:
   ```typescript
   if (process.env.REGISTRATION_ENABLED === 'false') {
     return NextResponse.json(
       { error: { code: 'REGISTRATION_DISABLED', message: 'Registration is closed' } },
       { status: 403 }
     );
   }
   ```

---

### AUTH-010: Auth Routes Skipped by Prefix Match [MEDIUM]

**OWASP:** A05:2021 — Security Misconfiguration
**STRIDE:** Elevation of Privilege
**Location:** Component spec §5.7 step 3

**Description:**
The middleware spec says "Auth API routes (`/api/auth/login`, `/api/auth/register`) → skip auth check." If this is implemented as a prefix match (`pathname.startsWith('/api/auth/')`), it could inadvertently skip auth for any future routes under `/api/auth/` that should require authentication (e.g., `/api/auth/change-password`, `/api/auth/admin/users`).

**Impact:**
Future auth-related endpoints could be unintentionally unauthenticated.

**Remediation:**
Use explicit path matching instead of prefix matching:

```typescript
const PUBLIC_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/register',
]);

if (PUBLIC_AUTH_ROUTES.has(pathname)) {
  // Skip auth, apply rate limiting
  // ...
}
```

---

## LOW Findings

### AUTH-011: No JWT `aud` or `iss` Claims [LOW]

**OWASP:** A02:2021 — Cryptographic Failures (defense in depth)
**Location:** ADR-007 §3 Token Structure

**Description:**
The JWT payload lacks `aud` (audience) and `iss` (issuer) claims. While not required for a single-server deployment, these claims provide defense-in-depth against token misuse if the JWT secret is shared or the app evolves.

**Remediation:**
Add static claims:
```json
{ "iss": "pm-ui", "aud": "pm-ui" }
```
And verify them in `verifyToken()`:
```typescript
const { payload } = await jwtVerify(token, JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'pm-ui',
  audience: 'pm-ui',
});
```

---

### AUTH-012: No `__Host-` Cookie Prefix [LOW]

**OWASP:** A05:2021 — Security Misconfiguration
**Location:** ADR-007 §4 Cookie Configuration

**Description:**
The cookie name `auth_token` doesn't use the `__Host-` prefix. The `__Host-` prefix provides additional guarantees: the cookie can only be set from a secure origin, must have `path=/`, and cannot have a `domain` attribute. This prevents cookie injection from subdomains.

**Remediation:**
Rename the cookie to `__Host-auth_token` in production. Note: `__Host-` requires `Secure` flag (which is already set for production). In development (where `Secure` is false), keep the name as `auth_token`.

---

### AUTH-013: bcrypt 72-Byte Input Limit [LOW]

**OWASP:** A02:2021 — Cryptographic Failures
**Location:** ADR-007 §Implementation Notes

**Description:**
bcrypt has a maximum input size of 72 bytes. If a password exceeds 72 bytes, bcryptjs silently truncates it. Two passwords that share the same first 72 bytes will produce the same hash. The schema allows passwords up to 128 characters.

**Impact:**
Theoretical only — passwords exceeding 72 characters are extremely rare. But if a user sets a 128-character password, the last 56 characters are effectively ignored.

**Remediation:**
Either:
- Reduce max password length to 72 in the schema, OR
- Pre-hash passwords with SHA-256 before bcrypt (ensures full entropy within 72-byte limit):
  ```typescript
  import { createHash } from 'crypto';
  const preHashed = createHash('sha256').update(password).digest('hex');
  const hash = await bcrypt.hash(preHashed, 12);
  ```

---

### AUTH-014: No Per-Account Lockout [LOW]

**OWASP:** A07:2021 — Identification and Authentication Failures
**Location:** Not addressed in architecture

**Description:**
Only per-IP rate limiting is implemented. No per-account lockout after N failed attempts. An attacker with multiple IPs (or a botnet) could brute-force a specific account.

**Impact:**
Low for v1 (internal tool, 5-10 users). If deployed publicly, this becomes HIGH.

**Remediation (v2):**
Add per-account lockout: after 5 consecutive failed attempts, lock the account for 15 minutes. Requires a `failedLoginAttempts` and `lockedUntil` field on the User model.

---

### AUTH-015: No `.env.example` File [LOW]

**OWASP:** A05:2021 — Security Misconfiguration
**Location:** Project root

**Description:**
No `.env.example` file exists. New developers may not know which environment variables are required. The `.env` file contains real development credentials.

**Remediation:**
Create `.env.example` with all required variables and placeholder values:
```env
DB_NAME="pm_db"
DB_USER="pm_user"
DB_PASSWORD="change-me-strong-password"
DATABASE_URL="postgresql://pm_user:change-me@db:5432/pm_db?schema=public&connection_limit=10"
API_KEY="generate-with-openssl-rand-hex-32"
API_KEY_SECONDARY=""
CORS_ALLOWED_ORIGINS="http://localhost:3000"
JWT_SECRET="generate-with-openssl-rand-hex-32"
REGISTRATION_ENABLED="true"
NODE_ENV="development"
```

---

### AUTH-016: No CAPTCHA on Registration [LOW]

**OWASP:** A07:2021 — Identification and Authentication Failures
**Location:** Component spec §5.3, §5.6

**Description:**
Registration has no CAPTCHA or bot mitigation beyond IP rate limiting (10 req/min/IP). An attacker could automate account creation.

**Impact:**
Low for v1 (internal tool behind network perimeter). If publicly accessible, could lead to spam accounts.

**Remediation (v2):**
Add hCaptcha or Turnstile (Cloudflare) as a lightweight bot mitigation. Alternatively, use `REGISTRATION_ENABLED` env var to disable registration after setup.

---

## OWASP Top 10 Coverage Matrix

| Category | Status | Findings |
|---|---|---|
| A01: Broken Access Control | ⚠️ Gaps | AUTH-001, AUTH-004, AUTH-006, AUTH-009 |
| A02: Cryptographic Failures | ⚠️ Gaps | AUTH-003, AUTH-011, AUTH-013 |
| A03: Injection | ✅ Covered | Prisma parameterized + Zod validation |
| A04: Insecure Design | ✅ Sound | Architecture well-designed for v1 |
| A05: Security Misconfiguration | ⚠️ Gaps | AUTH-010, AUTH-012, AUTH-015 |
| A06: Vulnerable Components | ✅ Covered | jose + bcryptjs well-maintained |
| A07: Auth Failures | ⚠️ Gaps | AUTH-002, AUTH-005, AUTH-008, AUTH-014, AUTH-016 |
| A08: Software Integrity | ✅ Covered | npm lock file |
| A09: Logging & Monitoring | ⚠️ Gap | AUTH-007 |
| A10: SSRF | ✅ N/A | No server-side URL fetching |

---

## Summary for Architecture-Planner

### Must-Fix Before Implementation (architectural changes):
1. **AUTH-001** (HIGH): SSE endpoint must require authentication — update middleware design
2. **AUTH-002** (HIGH): Change registration 409 to generic response — update component spec
3. **AUTH-003** (HIGH): Add JWT_SECRET startup validation — update session module spec
4. **AUTH-006** (MEDIUM): Define admin-only routes — update middleware design
5. **AUTH-010** (MEDIUM): Use exact path matching for public auth routes — update middleware spec

### Must-Fix During Implementation (code-level):
6. **AUTH-005** (MEDIUM): Add common password blocklist to registerSchema
7. **AUTH-007** (MEDIUM): Add auth audit logging
8. **AUTH-008** (MEDIUM): Only count login failures toward rate limit

### Document as Accepted Risk:
9. **AUTH-004** (MEDIUM): Role in JWT without server-side check (v1 limitation, v2: tokenVersion)
10. **AUTH-009** (MEDIUM): Open registration relies on network-level access control

### Nice-to-Have (v2):
11. AUTH-011 through AUTH-016 (LOW): JWT claims, cookie prefix, bcrypt limit, account lockout, .env.example, CAPTCHA
