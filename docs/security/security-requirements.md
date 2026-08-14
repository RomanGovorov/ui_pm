# Security Requirements — Project Manager UI v1

**Version:** 1.1
**Author:** security-auditor
**Date:** 2026-08-14
**Updated:** 2026-08-14 — Added TSK-018 authentication requirements (SR-11 through SR-18)
**Phase:** 1 (Architecture Audit)

---

## SR-01: API Key Authentication [CRITICAL]

### SR-01.1: Key Generation
- API key MUST be ≥ 256 bits (32 bytes) of cryptographic randomness
- Use `crypto.randomBytes(32).toString('hex')` or equivalent
- NEVER use predictable values (UUIDs, timestamps, sequential)

### SR-01.2: Key Storage
- API key MUST be stored in environment variable (`API_KEY`)
- NEVER hardcode API key in source code
- `.env` file MUST be in `.gitignore`
- `.env.example` MUST contain only placeholder values

### SR-01.3: Key Comparison
- MUST use timing-safe comparison (`crypto.timingSafeEqual`)
- NEVER use `===` for API key comparison (vulnerable to timing attacks)

### SR-01.4: Key Transmission
- API key MUST only be sent via `X-API-Key` header (never in URL/query params)
- API key MUST NOT be logged in any form (not in request logs, not in error messages)
- API key MUST NOT appear in browser network tab (server-side only)

### SR-01.5: Key Rotation
- Architecture MUST support multiple valid API keys simultaneously (for zero-downtime rotation)
- At minimum, support `API_KEY` and `API_KEY_SECONDARY` environment variables

---

## SR-02: Middleware Security Gate [CRITICAL]

### SR-02.1: Route Protection
- Middleware MUST intercept ALL routes matching `/api/*` except `/api/events`
- GET requests MAY pass without API key (read-only, per PRD)
- POST, PUT, PATCH, DELETE requests MUST require valid API key
- Middleware matcher: `[{ source: '/api/:path*', has: [{ type: 'header', key: 'x-api-key' }] }]` or equivalent logic

### SR-02.2: Auth Failure Response
- Invalid/missing API key MUST return `401 Unauthorized`
- Response body: `{ "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing API key" } }`
- MUST NOT reveal whether the key was missing vs. invalid

### SR-02.3: Middleware Ordering
- Auth check MUST be the FIRST middleware step (before rate limiting, CORS, etc.)
- Failed auth MUST short-circuit — never reach route handlers

---

## SR-03: Input Validation [HIGH]

### SR-03.1: Zod Schema Enforcement
- ALL API endpoints MUST validate request body with Zod `.safeParse()` (not `.parse()`)
- ALL query parameters MUST be validated and sanitized
- ALL path parameters (e.g., `[id]`) MUST be validated (UUID format check)

### SR-03.2: Validation Schema Rules
- String fields: MUST have `.min()` and `.max()` length constraints
- String fields: MUST use `.trim()` to prevent whitespace-only input
- Enum fields: MUST use `z.enum()` (not open strings)
- UUID fields: MUST use `z.string().uuid()`
- Reject unknown fields: schemas MUST NOT use `.passthrough()` or `.catchall()`

### SR-03.3: Error Response Format
- Validation errors MUST return `400` with structured details
- MUST include field-level error paths (from Zod issues)
- MUST NOT include raw stack traces

---

## SR-04: Rate Limiting [HIGH]

### SR-04.1: Global Rate Limit
- ALL API routes MUST have a global rate limit (recommend: 100 requests/minute per IP)
- SSE endpoint: max 10 connections per IP

### SR-04.2: Auth Failure Rate Limit
- Failed API key attempts: max 10 per minute per IP
- After limit: return `429 Too Many Requests` with `Retry-After` header

### SR-04.3: Implementation
- Use in-memory rate limiter (e.g., `next-rate-limit` or custom sliding window)
- Store counts in server memory (acceptable for single-instance v1)

---

## SR-05: Security Headers [HIGH]

### SR-05.1: Required Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (modern browsers use CSP instead)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (when HTTPS is available)

### SR-05.2: Content Security Policy
- Implement CSP header with restrictive policy:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-eval'` (required by Next.js dev mode; tighten for prod)
  - `style-src 'self' 'unsafe-inline'` (required by Tailwind)
  - `connect-src 'self'`
  - `img-src 'self' data:`
  - `font-src 'self'`

### SR-05.3: Implementation
- Configure via `next.config.ts` `headers()` function or middleware

---

## SR-06: CORS Configuration [HIGH]

### SR-06.1: Policy
- For v1 (single-origin): `Access-Control-Allow-Origin` = specific origin only
- NEVER use `*` for `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type, X-API-Key`
- `Access-Control-Max-Age`: `86400`

### SR-06.2: Preflight
- All non-simple requests MUST pass OPTIONS preflight check
- CORS headers MUST be set in middleware (not in individual routes)

---

## SR-07: SSE Security [MEDIUM]

### SR-07.1: Connection Limits
- Maximum concurrent SSE connections: 50 (server-wide)
- Per-IP limit: 10 connections
- Reject excess connections with `503 Service Unavailable`

### SR-07.2: Event Data Safety
- SSE event data MUST be JSON-serialized (never raw string concatenation)
- MUST escape `data:` field values to prevent SSE injection
- Event type names MUST be from a whitelist (enum), not user-supplied

### SR-07.3: Resource Cleanup
- MUST remove EventEmitter listeners on client disconnect (`abort` signal)
- MUST clear heartbeat intervals on disconnect
- MUST NOT leak references to disconnected controllers

---

## SR-08: Error Handling [MEDIUM]

### SR-08.1: Production Error Sanitization
- MUST NOT expose stack traces in production
- MUST NOT expose internal file paths, module names, or database schema
- Error responses MUST follow standard format: `{ "error": { "code": "...", "message": "..." } }`

### SR-08.2: Error Codes
- Use generic error codes: `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`
- NEVER use codes like `DATABASE_ERROR`, `PRISMA_ERROR` (leaks implementation details)

---

## SR-09: Secrets Management [CRITICAL]

### SR-09.1: Environment Variables
- All secrets MUST come from environment variables
- `.env` MUST be in `.gitignore`
- `.env.example` MUST contain placeholders only (`DATABASE_URL=postgresql://...`, `API_KEY=change-me`)

### SR-09.2: Docker Secrets
- Docker Compose MUST NOT hardcode secrets in `docker-compose.yml`
- Use `.env` file reference or Docker secrets for production

### SR-09.3: Client-Side Secrets
- API key MUST NOT be exposed to browser (no `NEXT_PUBLIC_` prefix)
- Database URL MUST NOT be exposed to browser
- Only `NEXT_PUBLIC_*` variables may contain non-sensitive data

---

## SR-10: Database Security [HIGH]

### SR-10.1: Prisma Safety
- MUST use Prisma's parameterized queries exclusively
- MUST NOT use `$queryRaw` or `$executeRaw` with user input
- If raw queries are needed, MUST use tagged template literals (`Prisma.sql`)

### SR-10.2: Connection Security
- PostgreSQL MUST listen on internal Docker network only (not `0.0.0.0`)
- Database credentials MUST use strong password (≥16 chars)
- Prisma connection string MUST NOT be logged

### SR-10.3: Cascade Deletes
- Cascade deletes MUST be intentional and documented
- Consider soft-delete for audit trail (v2 consideration)

---

## SR-11: JWT Authentication [CRITICAL] (TSK-018)

### SR-11.1: JWT Secret Management
- `JWT_SECRET` MUST be ≥32 bytes (64 hex characters) of cryptographic randomness
- `JWT_SECRET` MUST be validated at application startup — app MUST fail fast if missing or too short
- `JWT_SECRET` MUST NOT be the same as `API_KEY` (separation of concerns)
- `JWT_SECRET` MUST NOT have `NEXT_PUBLIC_` prefix (never exposed to browser)
- Generate with: `openssl rand -hex 32`

### SR-11.2: JWT Signing
- Algorithm MUST be HS256 (HMAC-SHA256) via `jose` library
- `jose` is Edge Runtime compatible (Web Crypto API)
- Payload MUST contain: `sub` (user UUID), `email`, `role`
- Payload SHOULD contain: `iss` ("pm-ui"), `aud` ("pm-ui") for defense in depth
- Token expiry MUST be 7 days (`exp` claim = `iat` + 604800 seconds)
- `verifyToken()` MUST specify `algorithms: ['HS256']` to prevent algorithm confusion
- `verifyToken()` MUST return `null` on any error — never throw

### SR-11.3: JWT Verification
- Verification MUST check signature, expiry, and algorithm
- Verification MUST reject tokens with `alg: "none"` (jose handles this by default)
- Expired tokens MUST be treated as unauthenticated (not an error — just 401)

---

## SR-12: Cookie Security [HIGH] (TSK-018)

### SR-12.1: Cookie Attributes
- Cookie name: `auth_token`
- `httpOnly`: MUST be `true` in all environments (prevents JavaScript access)
- `secure`: MUST be `true` in production, `false` in development only
- `sameSite`: MUST be `lax` (blocks cross-origin POST, allows top-level navigation)
- `path`: MUST be `/` (available on all routes)
- `maxAge`: MUST be `604800` (7 days in seconds, matches JWT expiry)

### SR-12.2: Cookie Lifecycle
- Cookie MUST be set on successful login AND registration
- Cookie MUST be cleared on logout (Set-Cookie with `maxAge=0`)
- Cookie MUST NOT be set on failed login attempts
- Cookie clear MUST use the same `path` as the set operation (`/`)

---

## SR-13: Password Security [HIGH] (TSK-018)

### SR-13.1: Password Hashing
- Library: `bcryptjs` (pure JavaScript, no native compilation)
- Salt rounds: MUST be 12
- NEVER store plaintext passwords
- NEVER log passwords (not in request bodies, not in error messages)

### SR-13.2: Password Validation
- Minimum length: 8 characters
- Maximum length: 128 characters (bcrypt limit is 72 bytes — see note)
- MUST reject passwords from a blocklist of the top 1000 common passwords
- `confirmPassword` MUST match `password` during registration
- Note: bcrypt truncates at 72 bytes. For v1, this is acceptable (max 128 chars is rare). For v2, consider pre-hashing with SHA-256.

### SR-13.3: Password Comparison
- MUST use `bcryptjs.compare()` (timing-safe by design)
- MUST NOT use `===` for password comparison

---

## SR-14: Authentication Endpoints [HIGH] (TSK-018)

### SR-14.1: Login Endpoint (`POST /api/auth/login`)
- MUST use generic error message for both wrong email and wrong password: "Invalid email or password"
- MUST NOT reveal whether the email exists or the password is wrong
- MUST count only FAILED attempts toward rate limit (successful logins excluded)
- MUST set JWT cookie on success
- MUST return user object (id, name, email, role) — NEVER return passwordHash

### SR-14.2: Registration Endpoint (`POST /api/auth/register`)
- MUST NOT return `409 EMAIL_EXISTS` — use generic response instead
- For duplicate email: return `200` with `{ "message": "If an account with this email exists, you can sign in at /login" }` — do NOT set cookie
- Default role for new registrations: `stakeholder` (NEVER `admin`)
- MUST validate email uniqueness at DB level (unique constraint)
- MUST hash password before storing (12 salt rounds)
- Rate limit: count ALL requests (not just failures) to prevent spam

### SR-14.3: Logout Endpoint (`POST /api/auth/logout`)
- MUST clear the `auth_token` cookie
- MUST succeed even if the cookie/token is already expired or invalid
- MUST return `{ success: true }` regardless of prior state

### SR-14.4: Me Endpoint (`GET /api/auth/me`)
- MUST require valid JWT cookie
- MUST return user object (id, name, email, role)
- MUST return 401 for expired/invalid/missing token
- MUST NOT return passwordHash or other sensitive fields

---

## SR-15: Role-Based Access Control [HIGH] (TSK-018)

### SR-15.1: Role Definitions
- `admin`: Full CRUD access via browser (JWT cookie)
- `stakeholder`: Read-only access via browser (JWT cookie) — write operations return 403
- `agent`: Full CRUD access via API (X-API-Key header) — does NOT use JWT

### SR-15.2: Middleware Role Enforcement
- MUST check role for ALL write operations (POST, PUT, PATCH, DELETE) on API routes
- Stakeholder write attempts MUST return `403 Forbidden`
- Admin-only routes (e.g., `/api/users` management) MUST reject non-admin roles with 403
- API key authentication MUST bypass JWT role checks (agent has full access)

### SR-15.3: Role in JWT (Known Limitation)
- Role is stored in JWT and trusted for 7 days
- Role changes in DB take up to 7 days to propagate
- MUST document this limitation
- For v2: add `tokenVersion` field for instant revocation

### SR-15.4: Agent Role Isolation
- Users with `agent` role MUST NOT receive JWT tokens (they use API key)
- `agent` role MUST NOT appear in JWT payload
- Registration MUST NOT create users with `agent` role

---

## SR-16: SSE Authentication [HIGH] (TSK-018)

### SR-16.1: SSE Endpoint Auth Requirement
- `/api/events` MUST require authentication (JWT cookie or API key)
- Unauthenticated SSE connections MUST be rejected with 401
- Browser clients: JWT cookie sent automatically by browser
- API clients: `X-API-Key` header

### SR-16.2: SSE Data Sensitivity
- SSE event data includes task details visible to authenticated users only
- Stakeholder SSE connections: receive all events (read-only access)
- No additional role-based filtering needed for SSE (dashboard data is shared)

---

## SR-17: Auth Audit Logging [MEDIUM] (TSK-018)

### SR-17.1: Required Log Events
- `login_success`: email, IP, timestamp (NEVER log password)
- `login_failure`: email, IP, timestamp, reason (invalid_email/not_found/wrong_password — internal only)
- `register`: email, IP, timestamp
- `logout`: email, IP, timestamp
- `auth_error`: description, IP, timestamp

### SR-17.2: Log Security
- MUST NOT log passwords in any form
- MUST NOT log JWT tokens or API keys
- Logs MUST be server-side only (not sent to browser)
- Use structured JSON logging for machine parsing

---

## SR-18: Registration Access Control [MEDIUM] (TSK-018)

### SR-18.1: Registration Availability
- SHOULD support `REGISTRATION_ENABLED` environment variable
- When disabled: return `403 { "error": { "code": "REGISTRATION_DISABLED" } }`
- Default: enabled

### SR-18.2: Network-Level Assumption
- Open registration relies on network-level access control (VPN/firewall)
- MUST document: "Application MUST NOT be publicly accessible without additional auth measures"
- If publicly deployed: MUST add CAPTCHA or email verification
