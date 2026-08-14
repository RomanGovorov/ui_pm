---
name: Release v1.1.0 — User Authentication
version: 1.1.0
date: 2026-08-14
author: tech-docs-writer
type: release-notes
tasks: [TSK-018]
---

# Release Notes — v1.1.0

> **Release Date**: 2026-08-14  
> **Previous Version**: v1.0.0 (2026-08-13)

v1.1.0 introduces user authentication for browser-based users (stakeholders and admins). The existing API key authentication for AI agents remains unchanged and fully backward compatible.

---

## Table of Contents

- [New Features](#new-features)
- [Changes](#changes)
- [Breaking Changes](#breaking-changes)
- [Migration Guide](#migration-guide)
- [Security Improvements](#security-improvements)
- [Known Limitations](#known-limitations)
- [Deferred to v2](#deferred-to-v2)
- [Documentation](#documentation)

---

## New Features

### Email/Password Authentication

Browser users can now register accounts and log in using email + password:

- **Registration page** (`/register`) — Create a new account with name, email, and password
- **Login page** (`/login`) — Authenticate with email and password
- **Session cookies** — JWT stored in an httpOnly cookie with 7-day expiry
- **Automatic session detection** — Returning users see the dashboard without re-login
- **Logout** — Manual session end via sidebar button or API call

### Role-Based Access Control

Three roles determine access levels:

| Role | Description | Dashboard Access | Write Access |
|------|-------------|-----------------|--------------|
| `admin` | Full administrator access | ✅ Yes | ✅ Yes |
| `stakeholder` | Read-only project reviewer | ✅ Yes (read-only) | ❌ No |
| `agent` | AI agent (unchanged) | N/A (API only) | ✅ Yes |

The UI adapts to your role: admin/agent users see "Create Project" and "Create Task" buttons; stakeholder users see a read-only view.

### Anti-Enumeration Registration

When a user tries to register with an email that already exists, the system returns a generic success message instead of an error:

> *"If an account with this email exists, you can sign in at /login"*

This prevents attackers from discovering which emails are registered. No session is created, no cookie is set.

### SSE Endpoint Authentication

The `/api/events` endpoint now requires authentication. Unauthenticated requests receive `401 Unauthorized`. This prevents external parties from monitoring real-time project activity.

### Common Password Blocklist

Registration rejects ~100 common passwords sourced from known breach lists. Users must choose stronger credentials.

### Auth Audit Logging

All authentication events are logged in structured JSON format:
- Login success/failure
- Account registration
- Logout
- Errors

Logs include timestamp, event type, email, and IP address. Passwords and tokens are never logged.

### .env.example Template

A complete `.env.example` file documents all required environment variables including new auth-related settings:

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | Secret for signing JWT tokens (min 64 hex chars) | *(generated)* |
| `REGISTRATION_ENABLED` | Toggle open registration (`true`/`false`) | `"true"` |

---

## Changes

### Infrastructure Requirements

**New environment variable required:**

```env
# Generate with: openssl rand -hex 48
JWT_SECRET="CHANGE_ME_96_hex_characters_for_jwt_signing_minimum_64"
```

The application will **fail to start** if `JWT_SECRET` is missing or shorter than 64 characters. This ensures fail-fast behavior on deployment.

### Database Migration

A new Prisma migration adds columns to the User model:

```sql
-- prisma/migrations/20260814120000_add_user_auth/migration.sql
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TYPE "UserRole" ADD VALUE 'admin';
```

- Existing users retain their current values — `email` and `passwordHash` are nullable
- A seed record creates an admin user (`admin@example.com`) and a stakeholder user for demo purposes

### Dependencies Added

| Package | Purpose |
|---------|---------|
| `jose` (^6.0.11) | JWT signing/verification (Edge-compatible) |
| `bcryptjs` (^3.0.2) | Password hashing (pure JS, Docker-safe) |
| `@types/bcryptjs` (^2.4.6) | TypeScript type definitions |

### Test Coverage

29 new tests added across 3 test files:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `auth-session.test.ts` | 11 | JWT sign/verify, startup validation, cookie helpers |
| `auth-validators.test.ts` | 14 | Register/login validation, password blocklist, edge cases |
| `auth-password.test.ts` | 4 | bcrypt hash/verify cycles, uniqueness of salts |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `AuthLoadingState.tsx` | Loading spinner during session check (FOUC prevention) |
| `app/login/page.tsx` | Login form with validation, error banners, autoFocus |
| `app/register/page.tsx` | Registration form with confirm-password indicator, validation |
| `auth-context.tsx` | React context provider with login/register/logout methods |

Updated components:
- `page.tsx` — FOUC prevention gate (loading → redirect → render)
- `Sidebar.tsx` — Shows user email, logout button, conditional action buttons by role
- `Header.tsx` — Conditionally hides "Create Project" button for stakeholders

---

## Breaking Changes

### SSE Requires Authentication ⚠️

**Before v1.1.0**: The `/api/events` SSE endpoint was publicly accessible. Any client could connect without credentials.

**After v1.1.0**: The SSE endpoint requires authentication. Clients must include either:
- `X-API-Key` header (for agents), OR
- `auth_token` cookie (for browser users who have logged in)

**Impact on existing integrations**: If you were subscribing to SSE events without authentication, this will break after upgrading. You must authenticate before connecting to the SSE stream.

**Fix**: For browser users, ensure the user is logged in before connecting:
```javascript
// 1. Log in first
await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
  credentials: 'same-origin',
});

// 2. Now connect to SSE (cookie is set)
const es = new EventSource('/api/events');
```

For agents, the existing `X-API-Key` header approach continues to work unchanged.

### New Required Environment Variable ⚠️

The `JWT_SECRET` environment variable is now **required**. Without it, the application refuses to start:

```
FATAL: JWT_SECRET environment variable is not set
```

Or if too short:
```
FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)
```

**Before v1.1.0**: Only `API_KEY`, database credentials, and CORS settings were required.

**After v1.1.0**: Add `JWT_SECRET` to your `.env` file. Use `openssl rand -hex 48` to generate a secure value.

---

## Migration Guide

### Upgrading from v1.0.0 to v1.1.0

1. **Generate a JWT secret**:
   ```bash
   openssl rand -hex 48 > jwt_secret.txt
   ```

2. **Add to your `.env` file**:
   ```env
   JWT_SECRET=$(cat jwt_secret.txt)
   REGISTRATION_ENABLED="true"
   ```

3. **Pull the updated code and rebuild**:
   ```bash
   docker compose down --remove-orphans
   docker compose up --build -d
   ```

4. **Verify the migration ran**:
   ```bash
   docker compose logs app | grep "Prisma migrate deployed"
   ```

5. **Test authentication**:
   ```bash
   # Health check should still pass
   curl http://localhost:3000/api/health
   
   # Try registering a new account
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com","password":"SecureP@ss1","confirmPassword":"SecureP@ss1"}'
   ```

6. **Update SSE clients**: If you have external services consuming the SSE stream without authentication, add credentials before reconnecting.

### Zero-Downtime Considerations

Since v1.0.0 already supports dual-key rotation (`API_KEY` + `API_KEY_SECONDARY`), AI agent connections remain uninterrupted during the upgrade. Browser users are unaffected since they had no auth before v1.1.0.

---

## Security Improvements

| Improvement | Details |
|-------------|---------|
| JWT in httpOnly cookie | Token inaccessible to JavaScript (XSS protection) |
| sameSite=Lax cookie | CSRF mitigation for state-changing requests |
| Secure flag in production | Cookie only sent over HTTPS |
| JWT_SECRET validated at startup | Fail-fast prevents silent security failures |
| Generic registration response | Prevents email enumeration attacks |
| Rate limiting on failed logins | 10 failures/min/IP protects against brute-force |
| Common password blocklist | ~100 known-breach passwords rejected |
| Audit logging | All auth events logged with IP and timestamp |
| Admin-only routes | `/api/users` restricted to admin/agent roles |

---

## Known Limitations

### Accepted Risks (v1)

| Issue | Risk Level | Mitigation |
|-------|-----------|------------|
| **Role updates delayed up to 7 days** | Medium | Admin can rotate `JWT_SECRET` to invalidate all tokens instantly |
| **Open registration** | Medium | App must not be publicly exposed; `REGISTRATION_ENABLED` env var to disable |
| **Unauthenticated GET on data endpoints** | Medium | Planned enforcement in v2; currently intentional for backward compatibility |

### Deferred to v2

| Feature | Status | Plan |
|---------|--------|------|
| JWT refresh tokens | Not implemented | Short-lived access token (15 min) + long-lived refresh token (30 days) |
| JWT `aud`/`iss` claims | Not implemented | Add static audience/issuer verification |
| `__Host-` cookie prefix | Not implemented | Stronger cookie attributes for production deployments |
| Per-account login lockout | Not implemented | Track `failedLoginAttempts` + `lockedUntil` per user |
| CAPTCHA on registration | Not implemented | hCaptcha or Cloudflare Turnstile integration |
| Password strength meter | Not implemented | Visual strength indicator on registration form |
| Self-service password reset | Not implemented | Email-based password reset flow |

---

## Documentation

### New Documentation Files

| Document | Path | Audience |
|----------|------|----------|
| Auth API Reference | [`docs/guides/api/auth.md`](../api/auth.md) | Developers integrating with the auth API |
| Authentication Guide | [`docs/guides/user/authentication.md`](../user/authentication.md) | End users (stakeholders, admins) |
| Security Requirements | [`docs/security/security-requirements.md`](../../security/security-requirements.md) | Security reviewers |
| Threat Model | [`docs/security/threat-model.md`](../../security/threat-model.md) | Security auditors |
| Architecture Decision ADR-007 | [`docs/architecture/adrs/ADR-007_jwt-authentication.md`](../../architecture/adrs/ADR-007_jwt-authentication.md) | Architects |
| Implementation Brief | [`docs/architecture/auth-implementation-brief.md`](../../architecture/auth-implementation-brief.md) | Developers |
| Code Review Report | [`docs/reviews/review-TSK-018.md`](../../reviews/review-TSK-018.md) | Quality assurance |

### Updated Documentation

| Document | Changes |
|----------|---------|
| [`openapi.yaml`](../api/openapi.yaml) | Added auth endpoints (register, login, logout, me), schemas, security schemes |
| [Getting Started](../user/getting-started.md) | Updated configuration section with `JWT_SECRET` and `REGISTRATION_ENABLED` |
| [Troubleshooting](../user/troubleshooting.md) | Added auth-related troubleshooting entries |
| [Changelog](./CHANGELOG.md) | Added v1.1.0 section |
