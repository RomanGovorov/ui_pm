# Threat Model — Project Manager UI v1

**Version:** 1.1
**Author:** security-auditor
**Date:** 2026-08-14
**Updated:** 2026-08-14 — Added TSK-018 authentication threats (AUTH-001 through AUTH-016)
**Methodology:** STRIDE
**Phase:** 1 (Architecture Audit)

---

## 1. System Assets

| Asset | Value | Sensitivity |
|---|---|---|
| API Key (X-API-Key) | Full CRUD access to all data | HIGH |
| JWT Secret (JWT_SECRET) | Signs all browser auth tokens | CRITICAL |
| JWT Cookie (auth_token) | Browser user session (7-day) | HIGH |
| User passwords (hashed) | Credential material | CRITICAL |
| Task/Project data | Business intelligence | MEDIUM |
| PostgreSQL credentials | Full database access | CRITICAL |
| SSE stream | Real-time task updates | LOW (open) → MEDIUM (auth-gated) |
| Dashboard UI | Visual project state | LOW |
| Environment variables | All secrets (.env) | CRITICAL |
| User roles (JWT claim) | Access control decisions | HIGH |

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  TRUST ZONE 0: Untrusted (Internet / External Network)          │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ Browser      │  │ AI Agent     │                             │
│  │ (anonymous)  │  │ (API key)    │                             │
│  └──────┬───────┘  └──────┬───────┘                             │
└─────────┼─────────────────┼─────────────────────────────────────┘
══════════╪═════════════════╪═══════════════════════════════════════ TB1: Network Edge
┌─────────┼─────────────────┼─────────────────────────────────────┐
│  TRUST ZONE 1: Application (Next.js Server)                      │
│  ┌──────▼─────────────────▼──────────────────────────────────┐  │
│  │  Next.js Middleware (auth gate)                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  API Routes → Service Layer → Prisma                 │  │  │
│  │  │  SSE Endpoint (open)                                 │  │  │
│  │  └────────────────────────┬─────────────────────────────┘  │  │
│  └───────────────────────────┼────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────┘
═══════════════════════════════╪════════════════════════════════════ TB2: App → Database
┌──────────────────────────────┼────────────────────────────────────┐
│  TRUST ZONE 2: Data Store (PostgreSQL)                            │
│  ┌───────────────────────────▼────────────────────────────────┐  │
│  │  PostgreSQL (internal Docker network only)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. STRIDE Analysis

### 3.1 Spoofing (Identity Forgery)

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| API Key brute-force / guessing | AI Agent identity | LOW | HIGH | **HIGH** | Use ≥256-bit key; add rate limiting on auth failures |
| API Key replay (captured in transit) | AI Agent identity | MEDIUM | HIGH | **HIGH** | Enforce HTTPS; consider key rotation mechanism |
| No user identity for browser clients | Dashboard | N/A (by design) | LOW | LOW | Accepted risk for v1; document for v2 |

### 3.2 Tampering (Data Modification)

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| Unauthorized writes (no API key) | Tasks, Projects | LOW | HIGH | **HIGH** | Middleware MUST block all non-GET without valid key |
| Malformed input bypasses Zod | Database integrity | LOW | MEDIUM | MEDIUM | Comprehensive Zod schemas; never trust raw input |
| Prisma `$queryRaw` injection | Database | LOW | CRITICAL | **HIGH** | Avoid raw queries; use Prisma parameterized only |
| Mass assignment via API | Entity fields | LOW | MEDIUM | MEDIUM | Whitelist allowed fields in Zod (not `.passthrough()`) |

### 3.3 Repudiation (Denial of Actions)

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| No audit log for mutations | All writes | HIGH | LOW | LOW | Add basic request logging (acceptable gap for v1) |
| No request ID tracking | Debugging | HIGH | LOW | LOW | Add X-Request-ID header generation |

### 3.4 Information Disclosure (Data Exposure)

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| API key leaked in logs | API Key | MEDIUM | CRITICAL | **CRITICAL** | Never log X-API-Key; mask in error messages |
| .env file exposed via HTTP | All secrets | LOW | CRITICAL | **HIGH** | Next.js excludes .env from public; verify no static serving |
| API key in browser DevTools | API Key | LOW | HIGH | MEDIUM | Key is server-side only; UI never sends it |
| Stack traces in production errors | Internal paths | MEDIUM | MEDIUM | MEDIUM | Disable dev mode in prod; custom error handler |
| Database credentials in error messages | DB access | LOW | CRITICAL | **HIGH** | Sanitize error responses; never expose DB details |
| Open GET endpoints (no auth) | All read data | HIGH (by design) | LOW | LOW | Accepted per PRD; internal network assumption |

### 3.5 Denial of Service

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| SSE connection exhaustion | Server memory | MEDIUM | MEDIUM | MEDIUM | Limit max SSE connections (e.g., 50) |
| EventEmitter listener leak | Server stability | LOW | HIGH | **HIGH** | `setMaxListeners` + proper cleanup on disconnect |
| No rate limiting on API | All endpoints | HIGH | MEDIUM | **HIGH** | Add rate limiter middleware (architecture lists as v1.1 — recommend for v1) |
| Large request body DoS | API routes | LOW | MEDIUM | MEDIUM | Set body size limit (1MB default in Next.js) |
| Slowloris on SSE connections | Connection slots | LOW | MEDIUM | MEDIUM | Connection timeout + heartbeat enforcement |

### 3.6 Elevation of Privilege

| Threat | Target | Likelihood | Impact | Risk | Mitigation |
|---|---|---|---|---|---|
| Bypass middleware for write ops | All mutations | LOW | CRITICAL | **HIGH** | Middleware matcher must cover ALL non-GET routes |
| IDOR via predictable UUIDs | Tasks, Projects | LOW | MEDIUM | LOW | UUIDs are not predictable; acceptable |
| Prisma client exposure via RCE | Database | LOW | CRITICAL | **HIGH** | No eval/exec of user input; standard mitigations |

---

## 4. Data Flow Threats

| Data Flow | Threat | OWASP | Mitigation |
|---|---|---|---|
| Agent → API (X-API-Key header) | Key interception on non-HTTPS | A02:2021 | Enforce HTTPS everywhere |
| Browser → API (GET, no auth) | Data scraping | A01:2021 | Accepted risk; network-level control |
| Browser → SSE (EventSource) | Connection hijacking | A01:2021 | HTTPS + same-origin |
| API → PostgreSQL | SQL injection via Prisma | A03:2021 | Prisma parameterized queries (safe by default) |
| API → Error response | Information disclosure | A05:2021 | Sanitized error format |
| .env → Application | Secret exposure | A02:2021 | Docker secrets or runtime injection; never commit |

---

## 5. Risk Summary

| Severity | Count | Action Required |
|---|---|---|
| CRITICAL | 1 | Must fix before deployment |
| HIGH | 7 | Must fix before v1 release |
| MEDIUM | 6 | Should fix; document as accepted if deferred |
| LOW | 4 | Accept or fix in v2 |

---

## 6. TSK-018 Authentication Threats (Added 2026-08-14)

### 6.1 Authentication-Specific STRIDE

#### Spoofing (Identity Forgery via Auth)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| JWT forgery (weak/missing JWT_SECRET) | Browser user identity | LOW | CRITICAL | **HIGH** | Startup validation: JWT_SECRET ≥32 bytes, fail-fast | AUTH-003 |
| Stolen JWT cookie replay | Admin/stakeholder identity | LOW | HIGH | **HIGH** | httpOnly + Secure + SameSite; HTTPS enforcement | Mitigated by design |
| Weak password brute-force | User account | MEDIUM | HIGH | **HIGH** | bcrypt(12) + common password blocklist + rate limiting | AUTH-005 |
| API key brute-force (existing) | Agent identity | LOW | HIGH | **HIGH** | 256-bit key + rate limiting | Existing SEC-001 |

#### Tampering (Auth Token/Data Modification)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| JWT payload tampering (role escalation) | Access control | LOW | CRITICAL | **HIGH** | jose HMAC verification rejects tampered tokens | Mitigated by library |
| Cookie manipulation (overwrite, inject) | Session | LOW | HIGH | MEDIUM | httpOnly prevents JS access; `__Host-` prefix (v2) | AUTH-012 |
| Password hash theft (DB breach) | User credentials | LOW | CRITICAL | **HIGH** | bcrypt(12) salted hashes; DB on internal network only | Mitigated by design |

#### Repudiation (Auth Event Denial)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| Unlogged failed login (brute-force invisible) | Security monitoring | HIGH | MEDIUM | MEDIUM | Add auth audit logging | AUTH-007 |
| Unlogged role change / privilege escalation | Access control | HIGH | MEDIUM | MEDIUM | Add auth audit logging | AUTH-007 |

#### Information Disclosure (Auth-Related)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| Email enumeration via registration 409 | User directory | MEDIUM | MEDIUM | **HIGH** | Generic response for duplicate emails | AUTH-002 |
| Unauthenticated SSE access (post-auth) | Project data | HIGH | MEDIUM | **HIGH** | Require auth on SSE endpoint | AUTH-001 |
| JWT payload PII (email in token) | User privacy | LOW | LOW | LOW | httpOnly cookie prevents JS access; token only in transit | Accepted risk |
| Login error message differentiation | User enumeration | LOW | MEDIUM | LOW | Generic "Invalid email or password" for both cases | Mitigated by design |

#### Denial of Service (Auth-Related)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| Login rate limiting (counting successes) | Legitimate users | MEDIUM | LOW | MEDIUM | Count only failures toward rate limit bucket | AUTH-008 |
| Registration spam (automated) | DB storage, UX | LOW | LOW | LOW | IP rate limiting (10/min); CAPTCHA (v2) | AUTH-016 |
| bcrypt DoS (slow hash, high concurrency) | CPU resources | LOW | MEDIUM | LOW | Rate limiting (10 req/min); acceptable for v1 scale | Mitigated |

#### Elevation of Privilege (Auth-Related)

| Threat | Target | Likelihood | Impact | Risk | Mitigation | Status |
|---|---|---|---|---|---|---|
| Stale role in JWT (demotion delay) | Access control | MEDIUM | HIGH | **HIGH** | Document 7-day window; v2: tokenVersion field | AUTH-004 |
| Stakeholder accesses admin-only endpoints | User management | MEDIUM | MEDIUM | **HIGH** | Admin-only route list in middleware | AUTH-006 |
| Open registration (no network control) | Dashboard access | MEDIUM | MEDIUM | **HIGH** | Document assumption; REGISTRATION_ENABLED env var | AUTH-009 |
| Auth route prefix bypass | Auth endpoints | LOW | HIGH | MEDIUM | Exact path matching for public routes | AUTH-010 |

### 6.2 Authentication Data Flow Threats

| Data Flow | Threat | OWASP | Mitigation | Finding |
|---|---|---|---|---|
| Browser → POST /api/auth/register | Email enumeration | A07:2021 | Generic response for duplicate emails | AUTH-002 |
| Browser → POST /api/auth/login | Credential stuffing | A07:2021 | Rate limiting (failures only) + bcrypt + blocklist | AUTH-005, AUTH-008 |
| Browser → Cookie: auth_token | Token theft (XSS) | A02:2021 | httpOnly cookie prevents JS access | Mitigated |
| Browser → Cookie: auth_token | CSRF | A01:2021 | SameSite=lax blocks cross-origin POST | Mitigated |
| Browser → GET /api/events (SSE) | Unauthenticated monitoring | A01:2021 | Require JWT or API key for SSE | AUTH-001 |
| Middleware → x-user-role header | Role spoofing (proxy) | A01:2021 | Internal headers, single-server, no proxy chain | Mitigated |
| JWT → role claim (7-day validity) | Stale privileges | A01:2021 | Document limitation; v2: tokenVersion | AUTH-004 |
| Registration → no email verification | Spam accounts | A07:2021 | Rate limiting + REGISTRATION_ENABLED toggle | AUTH-009 |

---

## 7. Recommendations Priority (Updated)

1. **AUTH-001** (HIGH): Require authentication on SSE endpoint — update middleware
2. **AUTH-002** (HIGH): Eliminate email enumeration via generic registration response
3. **AUTH-003** (HIGH): JWT_SECRET startup validation (fail-fast)
4. **AUTH-006** (MEDIUM): Define admin-only routes in middleware
5. **AUTH-007** (MEDIUM): Add auth audit logging
6. **AUTH-005** (MEDIUM): Add common password blocklist
7. **AUTH-010** (MEDIUM): Exact path matching for public auth routes
8. **Rate limiting** — Move from v1.1 to v1 (easy to add, high impact) — already done
9. **HTTPS enforcement** — Even in Docker, configure TLS termination
10. **API key rotation** — Design mechanism now, even if manual in v1 — already done
