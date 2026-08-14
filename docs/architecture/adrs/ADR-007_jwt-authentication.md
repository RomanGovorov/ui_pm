# ADR-007: JWT Authentication for Browser Users

**Date:** 2026-08-14
**Status:** Accepted
**Task:** TSK-018 (User Authentication)
**Supersedes:** — (extends ADR-005 which covers API key auth for agent)

---

## Context

The Project Manager UI currently uses API key authentication (`X-API-Key` header) exclusively for the AI agent. Browser users (stakeholders) access the dashboard without any authentication. TSK-018 introduces email/password authentication with role-based access control for browser users while preserving backward compatibility with the existing API key mechanism.

### Requirements Driving This Decision

1. **Login**: email + password → JWT in httpOnly cookie (7-day expiry)
2. **Registration**: email + password + confirm password (no email confirmation)
3. **Roles**: `admin` (full access), `stakeholder` (read-only), `agent` (API key, full access)
4. **Backward compatibility**: existing API_KEY auth must not break
5. **Security**: password hashing with bcrypt, JWT in httpOnly cookie

---

## Decision

**Use JWT stored in an httpOnly cookie for browser user authentication, coexisting with the existing API key mechanism for the AI agent.**

### 1. Token Storage: httpOnly Cookie (not localStorage)

| Criterion | httpOnly Cookie | localStorage |
|---|---|---|
| XSS protection | ✅ Cookie inaccessible to JavaScript | ❌ Readable by any script |
| CSRF risk | ⚠️ Requires sameSite + CSRF mitigation | ✅ No automatic sending |
| Simplicity | ✅ Automatic on every request | ❌ Manual header injection |
| SSR compatibility | ✅ Available in middleware (Edge) | ❌ Client-side only |

**Decision**: httpOnly cookie. The XSS protection advantage outweighs the CSRF risk, which is mitigated by `sameSite=lax` and the fact that all state-changing API routes already require explicit authentication checks.

### 2. JWT Secret Management

- **New environment variable**: `JWT_SECRET` (minimum 32 bytes, hex-encoded)
- **NOT derived from `API_KEY`**: separate secrets for separate concerns (separation of privileges)
- **Rotation**: not automated in v1; manual rotation by changing the env var (invalidates all tokens — acceptable for v1 scale)

```env
JWT_SECRET="<64-char-hex-string>"  # generate with: openssl rand -hex 32
```

### 3. Token Structure

```json
{
  "sub": "<user-uuid>",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1723600000,
  "exp": 1724204800
}
```

| Claim | Value | Rationale |
|---|---|---|
| `sub` | User UUID | Standard JWT subject claim |
| `email` | User email | Avoids DB lookup for display purposes |
| `role` | `admin` \| `stakeholder` | Determines access level (agent uses API key, not JWT) |
| `iat` | Issued-at timestamp | Standard |
| `exp` | 7 days from issuance | Balance between UX (infrequent re-login) and security |

**Algorithm**: HS256 (HMAC-SHA256) — symmetric, simple, sufficient for single-server deployment.
**Library**: `jsonwebtoken` (well-maintained, widely used, compatible with Node.js runtime).

### 4. Cookie Configuration

| Attribute | Value | Rationale |
|---|---|---|
| `name` | `auth_token` | Clear, non-guessable name |
| `httpOnly` | `true` | Prevents JavaScript access (XSS mitigation) |
| `secure` | `true` in production, `false` in development | HTTPS-only in production |
| `sameSite` | `lax` | CSRF mitigation; allows top-level navigation |
| `path` | `/` | Available on all routes |
| `maxAge` | `604800` (7 days in seconds) | Matches JWT expiry |

### 5. Refresh Strategy: None for v1

- Token expires after 7 days → user must re-login
- **Rationale**: v1 scale (5-10 users), low-security dashboard, simplicity over UX perfection
- **Future (v2)**: Add refresh token rotation with short-lived access tokens (15 min) + long-lived refresh tokens (30 days)

### 6. Dual Auth Coexistence

The middleware checks authentication in this order:

1. **API Key** (`X-API-Key` header) → if valid, request is from agent → full access
2. **JWT Cookie** (`auth_token`) → if valid, request is from browser user → role-based access
3. **Neither** → for write operations: 401 Unauthorized; for read operations: depends on route config

This preserves full backward compatibility: the AI agent continues using API key without any changes.

---

## Options Considered

### Option A: JWT in httpOnly Cookie (SELECTED)

- **Pros**: XSS-safe, automatic sending, SSR/middleware compatible, simple
- **Cons**: CSRF risk (mitigated by sameSite=lax), no cross-origin support (not needed for v1)

### Option B: JWT in localStorage

- **Pros**: No CSRF, easy to manage client-side
- **Cons**: XSS-vulnerable (any injected script can steal the token), not available in Next.js middleware

### Option C: Session-based (server-side sessions in DB/Redis)

- **Pros**: Instant revocation, no token size concerns
- **Cons**: Requires session store (Redis or DB table), more infrastructure, overkill for v1 scale

### Option D: NextAuth.js / Auth.js

- **Pros**: Full-featured, many providers, battle-tested
- **Cons**: Heavy dependency, over-engineered for email+password only, adds complexity for 2 pages

---

## Consequences

### Positive

1. **Backward compatible**: API key auth unchanged, AI agent unaffected
2. **XSS-safe**: httpOnly cookie prevents token theft via XSS
3. **Simple**: No session store, no Redis, no additional infrastructure
4. **Edge-compatible**: JWT verification in Next.js middleware (Edge Runtime) using `jose` library (Web Crypto API, no Node.js `crypto`)
5. **Role-based**: Clear separation of admin vs stakeholder at middleware level

### Negative

1. **No instant revocation**: Cannot invalidate a single token before expiry (acceptable for v1; re-login after 7 days)
2. **CSRF surface**: Mitigated by sameSite=lax, but state-changing requests should verify intent (sameSite=lax blocks cross-origin POST)
3. **Token size**: JWT (~200 bytes) sent on every request via cookie (negligible overhead)
4. **Library dependency**: Need `jsonwebtoken` (or `jose` for Edge) for JWT operations and `bcryptjs` for password hashing

### Neutral

1. **No refresh tokens**: Users re-login every 7 days — acceptable for v1 internal tool
2. **No email verification**: Registration is immediate — acceptable for internal tool where admin creates accounts

---

## Implementation Notes

### Edge Runtime Consideration

Next.js middleware runs in the Edge Runtime, which does NOT support Node.js `crypto` module. Two options:

1. **Use `jose` library** — pure Web Crypto API, works in Edge Runtime. Use `jose` for JWT sign/verify in middleware.
2. **Use `jsonwebtoken`** — requires Node.js `crypto`, works in API routes (Node.js runtime) but NOT in middleware.

**Recommended approach**: Use `jose` for both middleware verification and API route signing. Single library, Edge-compatible, modern API. Falls back to Web Crypto which is available in both Edge and Node.js 22.

### Password Hashing

- **Library**: `bcryptjs` (pure JavaScript bcrypt, no native compilation issues in Docker)
- **Salt rounds**: 12 (balance between security and performance; ~250ms per hash on modern hardware)
- **Not `bcrypt` (native)**: Avoids native module compilation issues in Docker/Alpine

### Migration Path

1. Add `email` (unique, nullable) and `passwordHash` (nullable) to User model
2. Add `admin` to `UserRole` enum
3. Existing users (AI Agent, Stakeholder) get `NULL` email/passwordHash — they continue working via API key
4. New browser users register with email/password → get JWT cookie
