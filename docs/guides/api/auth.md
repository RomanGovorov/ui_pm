---
name: Auth API Reference
version: 1.1.0
date: 2026-08-14
author: tech-docs-writer
type: api-reference
---

# Auth API Reference

> **Version**: 1.1.0  
> **Last Updated**: 2026-08-14

Complete reference for authentication endpoints. For full schemas and request/response formats, see [openapi.yaml](openapi.yaml).

---

## Table of Contents

- [Authentication Overview](#authentication-overview)
- [Dual Authentication System](#dual-authentication-system)
- [Session Management](#session-management)
- [Endpoints](#endpoints)
  - [POST /api/auth/register](#post-apiauthregister)
  - [POST /api/auth/login](#post-apiauthlogin)
  - [POST /api/auth/logout](#post-apiauthlogout)
  - [GET /api/auth/me](#get-apiauthme)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Code Examples](#code-examples)

---

## Authentication Overview

The Project Manager UI supports two authentication methods simultaneously:

| Method | Use Case | Header/Cookie | Expires |
|--------|----------|---------------|---------|
| **API Key** | AI agents (programmatic access) | `X-API-Key` header | Never (until rotated) |
| **JWT Cookie** | Browser users (stakeholders, admins) | `auth_token` cookie | 7 days |

### JWT Token Details

| Property | Value |
|----------|-------|
| Algorithm | HS256 (HMAC-SHA256) |
| Library | `jose` (Edge-compatible, Web Crypto API) |
| Cookie name | `auth_token` |
| Cookie flags | `httpOnly`, `sameSite=lax`, `path=/`, `secure` (production only) |
| Expiry | 7 days (604800 seconds) |
| Payload claims | `sub` (user UUID), `email`, `role` (`admin` | `stakeholder`) |

### Password Requirements

| Requirement | Constraint |
|-------------|------------|
| Minimum length | 8 characters |
| Maximum length | 128 characters |
| Common passwords | ~100 entries from known breach lists are rejected |
| Hashing | bcrypt (12 rounds) via `bcryptjs` (pure JS, Docker-safe) |

---

## Dual Authentication System

The middleware resolves authentication in this order:

```
Request → Check API key → Check JWT cookie → Reject if neither
                    ↓                    ↓
               Agent (full access)   Browser user (role-based)
```

1. **API Key check** — If `X-API-Key` header matches `API_KEY` or `API_KEY_SECONDARY`, the request is authenticated as an agent with full access.
2. **JWT cookie check** — If a valid `auth_token` cookie exists, the request is authenticated as a browser user with role-based access.
3. **Neither** — Write operations return `401`. Read operations remain public for backward compatibility (planned enforcement in v2).

### SSE Endpoint Authentication

The `/api/events` endpoint requires authentication since v1.1.0. Unauthenticated requests receive `401 Unauthorized`.

```bash
# Works — with API key
curl http://localhost:3000/api/events \
  -H "X-API-Key: your-agent-key"

# Works — with cookie (after login)
curl http://localhost:3000/api/events \
  --cookie "auth_token=<jwt-token>"

# Fails — no auth
curl http://localhost:3000/api/events
# → 401 { error: { code: "UNAUTHORIZED", message: "Authentication required" } }
```

### Role-Based Access Control

| Action | Admin | Stakeholder | Agent (API Key) |
|--------|-------|-------------|-----------------|
| View dashboard/projects/tasks | ✅ | ✅ (read-only view) | ✅ |
| Create projects/tasks | ✅ | ❌ (403 Forbidden) | ✅ |
| Update projects/tasks | ✅ | ❌ (403 Forbidden) | ✅ |
| Delete projects/tasks | ✅ | ❌ (403 Forbidden) | ✅ |
| View/manage users | ✅ | ❌ (403 Forbidden) | ✅ |
| Connect to SSE stream | ✅ | ✅ | ✅ |

Stakeholders receive `403 Forbidden` with `FORBIDDEN` code when attempting write operations.

---

## Session Management

### JWT Flow

```
User logs in → Server signs JWT → Set-Cookie header → Browser stores cookie → Auto-sent on every request
```

### Cookie Configuration

| Attribute | Development | Production |
|-----------|-------------|------------|
| `Path` | `/` | `/` |
| `Max-Age` | `604800` (7 days) | `604800` (7 days) |
| `HttpOnly` | ✅ | ✅ |
| `SameSite` | `Lax` | `Lax` |
| `Secure` | ❌ (allows HTTP localhost) | ✅ (HTTPS only) |

### Session Expiry

- The session expires after **7 days** — the user must log in again.
- There is **no automatic refresh** in v1. This is intentional: the target audience is 5–10 internal users on an internal tool.
- Admins can force logout for all users by rotating the `JWT_SECRET` environment variable (this invalidates all existing tokens).
- Users can manually end their session by calling `POST /api/auth/logout`.

### SSE Reconnection After Login

When a user logs in (or registers), the frontend triggers SSE reconnection automatically. The `useAuth()` hook increments an `authVersion` counter that causes the SSE hook to unmount and remount — connecting with the newly available cookie.

---

## Endpoints

### POST /api/auth/register

Creates a new user account. On success, the user is immediately authenticated (JWT cookie set).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–100 characters |
| `email` | string (email format) | Yes | Max 255 chars, lowercased |
| `password` | string | Yes | 8–128 chars, not a common password |
| `confirmPassword` | string | Yes | Must match `password` |

#### Successful Response (201)

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Roman Govorov",
    "email": "roman@example.com",
    "role": "stakeholder"
  }
}
```

Set-Cookie header: `auth_token=eyJ...; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`

#### Anti-Enumeration Response (200)

If the email already exists:

```json
{
  "message": "If an account with this email exists, you can sign in at /login"
}
```

No cookie is set. No session is created. The client should navigate the user to `/login`.

#### Disabled Registration (403)

```json
{
  "error": {
    "code": "REGISTRATION_DISABLED",
    "message": "Registration is currently disabled"
  }
}
```

#### Error Responses

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Invalid email, password too short, passwords don't match, common password |
| `REGISTRATION_DISABLED` | 403 | `REGISTRATION_ENABLED` env var is `'false'` |
| `INTERNAL_ERROR` | 500 | Database failure or unexpected server error |

### POST /api/auth/login

Authenticates a user and sets the JWT cookie.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string (email format) | Yes | Max 255 chars, lowercased |
| `password` | string | Yes | Any length (must match stored hash) |

#### Successful Response (200)

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Roman Govorov",
    "email": "roman@example.com",
    "role": "stakeholder"
  }
}
```

Set-Cookie header: `auth_token=eyJ...; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax`

#### Error Responses

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Missing/invalid email |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (generic message) |
| `RATE_LIMITED` | 429 | More than 10 failed attempts in 60 seconds |
| `INTERNAL_ERROR` | 500 | Database failure or unexpected server error |

**Note**: The error message is always `"Invalid email or password"` regardless of whether the email exists. This prevents email enumeration attacks.

#### Rate Limiting

The rate limiter counts **only failed login attempts**. Successful logins do not consume quota. This prevents legitimate users from being locked out by their own successful logins.

```bash
# First attempt with wrong password → 401 (counted)
curl -X POST http://localhost:3000/api/auth/login ...
# Second attempt with wrong password → 401 (counted)
# ... up to 10 failed attempts ...
# 11th attempt → 429 (Rate Limited) + Retry-After: 60
```

### POST /api/auth/logout

Clears the JWT cookie and ends the session.

#### Response (200)

```json
{
  "message": "Logged out successfully"
}
```

Set-Cookie header: `auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`

The call is best-effort. Even if the API fails (network error), the frontend clears local session state. The cookie expires naturally on next page load.

### GET /api/auth/me

Returns the current user's profile. Verifies the JWT cookie and fetches fresh data from the database so role changes take effect immediately.

#### Response (200)

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Roman Govorov",
    "email": "roman@example.com",
    "role": "stakeholder"
  }
}
```

#### Error Response (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Not authenticated"
  }
}
```

**Fallback behavior**: If the database is unavailable, the endpoint returns stale data from the JWT payload (with potentially outdated role information).

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Input failed Zod schema validation |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT cookie |
| `REGISTRATION_DISABLED` | 403 | Registration turned off via env var |
| `FORBIDDEN` | 403 | Read-only user attempted write (stakeholder) |
| `RATE_LIMITED` | 429 | Too many failed login attempts (10/min/IP) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

| Scope | Limit | Window | Applies To |
|-------|-------|--------|------------|
| Global (per IP) | 100 requests | 60 seconds | All non-public endpoints including `/api/auth/*` |
| Auth failures (per IP) | 10 attempts | 60 seconds | `POST /api/auth/login` — failed attempts only |
| Write ops (per IP) | 60 requests | 60 seconds | `POST/PUT/DELETE` on all endpoints |

The `Retry-After` header indicates seconds remaining in the rate limit window.

---

## Code Examples

### cURL Examples

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Roman Govorov",
    "email": "roman@example.com",
    "password": "MyStr0ng!P@ss",
    "confirmPassword": "MyStr0ng!P@ss"
  }' -v

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"roman@example.com","password":"MyStr0ng!P@ss"}' \
  --cookie-jar cookies.txt -v

# Get current user
curl http://localhost:3000/api/auth/me \
  --cookie cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  --cookie cookies.txt
```

### JavaScript / Fetch Examples

```javascript
// Register
const register = async (name, email, password) => {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      name, email, password, confirmPassword: password
    }),
  });
  return res.json();
};

// Login
const login = async (email, password) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

// Get current user
const getCurrentUser = async () => {
  const res = await fetch('/api/auth/me', {
    credentials: 'same-origin',
  });
  return res.json();
};

// Logout
const logout = async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
};
```

### Python Requests Example

```python
import requests

BASE_URL = "http://localhost:3000"

# Register (uses a requests.Session to auto-manage cookies)
session = requests.Session()

response = session.post(f"{BASE_URL}/api/auth/register", json={
    "name": "Roman Govorov",
    "email": "roman@example.com",
    "password": "MyStr0ng!P@ss",
    "confirmPassword": "MyStr0ng!P@ss",
})
print(response.json())

# Current user (cookies sent automatically)
me = session.get(f"{BASE_URL}/api/auth/me").json()
print(me)

# Logout
session.post(f"{BASE_URL}/api/auth/logout")
```

### WebSocket SSE Subscription (Authenticated)

```javascript
// After login, connect to the real-time event stream
const login = async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) throw new Error('Login failed');
  
  // Now the auth_token cookie is set — SSE will include it
  const es = new EventSource('/api/events');
  return es;
};

const eventStream = await login();
eventStream.addEventListener('task_created', (event) => {
  console.log('New task:', JSON.parse(event.data));
});
```

---

## Security Notes

- **Anti-enumeration**: Both registration and login use generic messages to prevent attackers from discovering registered emails.
- **Audit logging**: All auth events (login_success, login_failure, register, logout, auth_error) are logged with timestamp, event type, email, and IP address. Passwords and tokens are never logged.
- **Cookie security**: The `auth_token` cookie is `httpOnly` (inaccessible to JavaScript), `sameSite=lax` (CSRF mitigation), and `secure` in production (HTTPS only).
- **JWT algorithm**: HS256 is sufficient for single-server deployments. For multi-server setups, consider asymmetric algorithms (RS256).
- **Token rotation**: To invalidate all sessions, rotate `JWT_SECRET` in the environment. All existing tokens become invalid immediately.
