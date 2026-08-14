# Security Checklist — Project Manager UI v1

**Version:** 1.1
**Author:** security-auditor
**Date:** 2026-08-14
**Updated:** 2026-08-14 — Added TSK-018 authentication checklist (sections M through S)
**Phase:** 1 (Architecture Audit)

> This checklist must be verified during Phase 2 security audit after implementation.
> Mark items as ✅ (pass), ❌ (fail), or ⏳ (pending implementation).

---

## A. API Key Authentication

- [ ] API key is ≥ 256 bits (32 bytes) of cryptographic randomness
- [ ] API key stored in environment variable, never hardcoded
- [ ] API key comparison uses `crypto.timingSafeEqual()`
- [ ] API key never appears in logs, error messages, or response bodies
- [ ] API key never sent in URL query parameters
- [ ] `.env` contains actual key; `.env.example` contains placeholder only
- [ ] No `NEXT_PUBLIC_` prefix on API key variable

## B. Middleware & Route Protection

- [ ] Middleware intercepts ALL `/api/*` routes except `/api/events`
- [ ] GET requests pass through without API key (read-only)
- [ ] POST/PUT/PATCH/DELETE require valid API key
- [ ] Missing API key returns 401 with `{ "error": { "code": "UNAUTHORIZED" } }`
- [ ] Invalid API key returns 401 (same response as missing — no enumeration)
- [ ] Middleware does not log or expose the key value
- [ ] OPTIONS preflight requests handled correctly (CORS)

## C. Input Validation

- [ ] All POST/PUT bodies validated with Zod `.safeParse()`
- [ ] All string fields have `.min()` and `.max()` constraints
- [ ] All string fields use `.trim()`
- [ ] UUID fields validated with `z.string().uuid()`
- [ ] Enum fields use `z.enum()` (not open strings)
- [ ] Unknown fields rejected (no `.passthrough()` or `.catchall()`)
- [ ] Path parameters (`[id]`) validated as UUID format
- [ ] Query parameters validated and sanitized
- [ ] File upload not supported (verify no `FormData` handlers)

## D. Rate Limiting

- [ ] Global rate limit on all API routes (≤100 req/min per IP)
- [ ] Auth failure rate limit (≤10 failures/min per IP)
- [ ] SSE connection limit (≤50 total, ≤10 per IP)
- [ ] `429 Too Many Requests` returned with `Retry-After` header
- [ ] Rate limiter does not leak client IP in logs

## E. Security Headers

- [ ] `X-Content-Type-Options: nosniff` present on all responses
- [ ] `X-Frame-Options: DENY` present on all responses
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present
- [ ] `Permissions-Policy` restricts camera, microphone, geolocation
- [ ] `Content-Security-Policy` configured with restrictive policy
- [ ] `Strict-Transport-Security` configured (when HTTPS available)
- [ ] No `X-Powered-By` header (Next.js removes by default)

## F. CORS

- [ ] `Access-Control-Allow-Origin` is specific origin (not `*`)
- [ ] `Access-Control-Allow-Methods` lists only needed methods
- [ ] `Access-Control-Allow-Headers` includes `X-API-Key` and `Content-Type`
- [ ] OPTIONS preflight handled in middleware
- [ ] CORS headers set consistently across all API routes

## G. SSE Security

- [ ] SSE connections capped at 50 total
- [ ] Per-IP SSE connection limit enforced
- [ ] Event data is JSON-serialized (no string concatenation)
- [ ] Event type names from whitelist (enum)
- [ ] EventEmitter listeners cleaned up on disconnect
- [ ] Heartbeat intervals cleared on disconnect
- [ ] No memory leak from stale connections

## H. Error Handling

- [ ] No stack traces in production error responses
- [ ] No internal paths or module names in errors
- [ ] No database error details exposed (Prisma errors sanitized)
- [ ] Consistent error format: `{ "error": { "code": "...", "message": "..." } }`
- [ ] Generic error codes only (no `DATABASE_ERROR`, `PRISMA_ERROR`)

## I. Secrets Management

- [ ] `.env` in `.gitignore`
- [ ] `.env.example` has placeholders only
- [ ] No secrets in source code (grep for common patterns)
- [ ] No `NEXT_PUBLIC_` on sensitive variables
- [ ] Docker Compose references `.env` file (not hardcoded)
- [ ] `DATABASE_URL` not exposed to browser

## J. Database Security

- [ ] All queries use Prisma (parameterized)
- [ ] No `$queryRaw` or `$executeRaw` with user input
- [ ] PostgreSQL listens on internal network only
- [ ] Strong database password (≥16 chars)
- [ ] Prisma connection string not logged
- [ ] Cascade deletes are intentional and documented

## K. Dependency Security

- [ ] No known vulnerable packages (`npm audit` clean)
- [ ] Lock file (`package-lock.json`) committed
- [ ] No `latest` version pins for critical dependencies
- [ ] Minimal dependency count (reduce attack surface)

## L. Docker Security

- [ ] Dockerfile uses non-root user
- [ ] Multi-stage build (minimal production image)
- [ ] No secrets in Dockerfile layers
- [ ] PostgreSQL container not exposed to host network
- [ ] `.dockerignore` excludes `.env`, `node_modules`, `.git`

---

## M. JWT Authentication (TSK-018)

- [ ] `JWT_SECRET` environment variable is set (≥64 hex characters)
- [ ] `JWT_SECRET` validated at startup — app fails fast if missing or too short
- [ ] `JWT_SECRET` is NOT the same as `API_KEY`
- [ ] `JWT_SECRET` has no `NEXT_PUBLIC_` prefix
- [ ] JWT signed with HS256 via `jose` library
- [ ] JWT payload contains: `sub`, `email`, `role`
- [ ] JWT verification specifies `algorithms: ['HS256']`
- [ ] `verifyToken()` returns `null` on error (never throws)
- [ ] Token expiry is 7 days (604800 seconds)
- [ ] `.env` contains JWT_SECRET; `.env.example` has placeholder

## N. Cookie Security (TSK-018)

- [ ] Cookie name: `auth_token`
- [ ] `httpOnly: true` in all environments
- [ ] `secure: true` in production, `false` in development
- [ ] `sameSite: lax` in all environments
- [ ] `path: /` in all environments
- [ ] `maxAge: 604800` (7 days)
- [ ] Cookie set on successful login
- [ ] Cookie set on successful registration
- [ ] Cookie cleared on logout (`maxAge=0`)
- [ ] Cookie NOT set on failed login

## O. Password Security (TSK-018)

- [ ] `bcryptjs` used for hashing (not native `bcrypt`)
- [ ] Salt rounds: 12
- [ ] No plaintext passwords stored anywhere
- [ ] Passwords never logged (not in request bodies, not in errors)
- [ ] Minimum password length: 8 characters
- [ ] Maximum password length: 128 characters
- [ ] Common password blocklist applied (top 1000+)
- [ ] `confirmPassword` matches `password` during registration
- [ ] `bcryptjs.compare()` used for password verification

## P. Auth Endpoints (TSK-018)

- [ ] `POST /api/auth/login`: generic error "Invalid email or password" for wrong email AND wrong password
- [ ] Login: rate limit counts only FAILED attempts
- [ ] Login: JWT cookie set on success
- [ ] Login: response includes user object (id, name, email, role) — NOT passwordHash
- [ ] `POST /api/auth/register`: generic response for duplicate email (no `409 EMAIL_EXISTS`)
- [ ] Registration: default role is `stakeholder` (never `admin`)
- [ ] Registration: email uniqueness enforced at DB level (unique constraint)
- [ ] Registration: rate limit counts ALL requests
- [ ] `POST /api/auth/logout`: clears cookie, returns `{ success: true }`
- [ ] Logout: works even with expired/invalid token
- [ ] `GET /api/auth/me`: returns user from JWT or 401
- [ ] Me endpoint: does NOT return passwordHash

## Q. Role-Based Access Control (TSK-018)

- [ ] Admin: full CRUD access via JWT cookie
- [ ] Stakeholder: read-only — write operations return 403
- [ ] Agent: full access via API key (JWT NOT used)
- [ ] Middleware checks role for ALL write operations (POST/PUT/PATCH/DELETE)
- [ ] Admin-only routes (e.g., `/api/users`) reject non-admin with 403
- [ ] API key auth bypasses JWT role checks
- [ ] `agent` role users cannot receive JWT tokens
- [ ] Registration cannot create `agent` role users
- [ ] UI hides write buttons for stakeholder role (defense in depth)
- [ ] Role limitation documented: JWT role valid for 7 days

## R. SSE Authentication (TSK-018)

- [ ] `/api/events` requires authentication (JWT cookie or API key)
- [ ] Unauthenticated SSE connections rejected with 401
- [ ] Browser SSE: JWT cookie sent automatically
- [ ] API SSE: `X-API-Key` header accepted
- [ ] SSE connection limits still enforced (50 total, 10/IP)

## S. Auth Audit Logging (TSK-018)

- [ ] Login success logged (email, IP, timestamp)
- [ ] Login failure logged (email, IP, timestamp, reason)
- [ ] Registration logged (email, IP, timestamp)
- [ ] Logout logged (email, IP, timestamp)
- [ ] Passwords NEVER in logs
- [ ] JWT tokens NEVER in logs
- [ ] API keys NEVER in logs
- [ ] Logs are server-side only (not sent to browser)

---

## Verification Summary

| Category | Total | Pass | Fail | Pending |
|---|---|---|---|---|
| A. API Key Auth | 7 | — | — | ⏳ |
| B. Middleware | 7 | — | — | ⏳ |
| C. Input Validation | 9 | — | — | ⏳ |
| D. Rate Limiting | 5 | — | — | ⏳ |
| E. Security Headers | 7 | — | — | ⏳ |
| F. CORS | 5 | — | — | ⏳ |
| G. SSE Security | 7 | — | — | ⏳ |
| H. Error Handling | 5 | — | — | ⏳ |
| I. Secrets | 6 | — | — | ⏳ |
| J. Database | 6 | — | — | ⏳ |
| K. Dependencies | 4 | — | — | ⏳ |
| L. Docker | 5 | — | — | ⏳ |
| M. JWT Auth | 10 | — | — | ⏳ |
| N. Cookie Security | 10 | — | — | ⏳ |
| O. Password Security | 9 | — | — | ⏳ |
| P. Auth Endpoints | 12 | — | — | ⏳ |
| Q. RBAC | 10 | — | — | ⏳ |
| R. SSE Auth | 5 | — | — | ⏳ |
| S. Auth Logging | 8 | — | — | ⏳ |
| **Total** | **141** | — | — | — |
