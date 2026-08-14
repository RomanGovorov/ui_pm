# Runbook: Authentication Troubleshooting — Project Manager UI v1

**Version:** 1.0.0
**Author:** devops-infrastructure-engineer
**Date:** 2026-08-14
**Owner:** Infrastructure team
**Review cadence:** After any auth incident or quarterly

---

## Overview

This runbook covers common authentication-related incidents for the Project Manager UI, which uses JWT-based cookie authentication alongside API key authentication for AI agents.

### Auth Architecture Summary

```
┌──────────────┐     ┌──────────────────┐
│ Browser      │     │ Next.js Middleware│
│ User         │◄────│ (middleware.ts)   │
│              │     │                  │
│ Sets:        │     │ Checks in order: │
│ auth_token   │     │  1. API key      │
│ (httpOnly)   │     │  2. JWT cookie   │
└──────────────┘     └────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ session.ts (jose)  │
                    │ • signToken()      │
                    │ • verifyToken()    │
                    │ • Requires:        │
                    │   JWT_SECRET env   │
                    └───────────────────┘
```

### Key Secrets

| Secret | Required | Validation | Generation |
|--------|----------|------------|------------|
| `JWT_SECRET` | ✅ | ≥ 64 hex chars (32 bytes minimum) | `openssl rand -hex 48` |
| `API_KEY` | ✅ | 64 hex chars (256 bits) | `openssl rand -hex 32` |

---

## Incident: Users Cannot Login

### Symptoms

- `/api/auth/login` returns 500 or empty response
- Login page hangs indefinitely
- Console shows "Failed to fetch" error

### Root Cause Checklist

1. **Missing JWT_SECRET** (most common)

```bash
# Check if JWT_SECRET is set in container
docker compose exec app node -e \
  "console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length || 'undefined')"

# Expected output: JWT_SECRET length: 96 (or similar ≥ 64)

# Fix: Add to .env on production host
echo 'JWT_SECRET=$(openssl rand -hex 48)' >> ~/ui_pm/app/.env
docker compose restart app
```

2. **Migration not applied**

```bash
# Check if migration ran successfully
docker compose logs app | grep -i "migrat"

# If missing, run manually:
docker compose exec app npx prisma migrate deploy
```

3. **Session module crashed at startup**

```bash
# Check container status
docker compose ps app

# Check logs for FATAL errors:
docker compose logs --tail=50 app | grep -i "FATAL\|error\|uncaught"

# Common: JWT_SECRET too short (< 64 chars) or not set
# Fix: Verify JWT_SECRET has ≥ 64 hex characters
docker compose exec app node -e \
  "if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) { console.log('JWT_SECRET invalid'); process.exit(1) } else { console.log('OK') }"
```

### Resolution Steps

1. SSH to production: `ssh deploy@DEPLOY_HOST`
2. Navigate to project: `cd ~/ui_pm/app`
3. Check `.env`: `grep JWT_SECRET .env`
4. If missing or short: regenerate and restart:

```bash
NEW_SECRET=$(openssl rand -hex 48)
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
docker compose restart app
```

⚠️ **WARNING:** Regenerating JWT_SECRET invalidates all existing sessions. All logged-in users will be logged out immediately. Notify stakeholders before changing JWT_SECRET in production.

---

## Incident: JWT Tokens Not Persisting (Users Get Logged Out)

### Symptoms

- Users can log in but are immediately logged out after navigating pages
- Cookie doesn't appear in browser DevTools → Cookies tab
- `/api/auth/me` returns 401 even after successful login

### Root Cause

1. **CORS blocking credentials** — middleware must include `Access-Control-Allow-Credentials: true` when origin matches

```bash
# Test CORS preflight from a browser console:
fetch('/api/events', { method: 'OPTIONS', credentials: 'include' })
  .then(r => r.headers.get('access-control-allow-credentials'))
```

Expected: `"true"` (when origin matches `CORS_ALLOWED_ORIGINS`)

Fix: Ensure middleware sets `Access-Control-Allow-Credentials: true` for matching origins (see AUTH-008).

2. **Production mode not enforcing Secure flag** — In development (`NODE_ENV=development`), cookies are NOT marked `Secure`, so they won't work over HTTPS.

```bash
# Check container NODE_ENV:
docker compose exec app node -e "console.log(process.env.NODE_ENV)"

# Must be: production
# Fix docker-compose.yml:
# environment:
#   NODE_ENV: production
```

3. **Cookie size exceeded** — JWT tokens > 4KB may be rejected by some browsers/proxies.

Check token payload size:
```bash
# Decode a token from browser DevTools:
# Split JWT into 3 parts (header.payload.signature)
# Decode middle part with base64url to check payload size
```

### Resolution Steps

1. Verify CORS configuration in middleware
2. Confirm `NODE_ENV=production` in docker-compose
3. Check browser DevTools → Application → Cookies for `auth_token` presence
4. Verify `SameSite=Lax` attribute (not `None` — requires `Secure` which only works over HTTPS)

---

## Incident: Registration Endpoint Returns 500

### Symptoms

- `/api/auth/register` fails with 500 internal server error
- Database user table exists but registration fails silently

### Root Cause Checklist

1. **Database migration missing required columns**

```bash
# Verify email and password_hash columns exist:
docker compose exec db psql -U pm_user -d pm_db -c "\d users"

# Look for: email varchar(255), password_hash varchar(255)
# If missing, apply migration:
docker compose exec app npx prisma migrate deploy
```

2. **REGISTRATION_ENABLED set to false**

```bash
# Check environment:
docker compose exec app node -e "console.log(process.env.REGISTRATION_ENABLED)"

# Should be: true
# Fix: Set in .env
echo 'REGISTRATION_ENABLED=true' >> .env
docker compose restart app
```

3. **Duplicate email or missing fields**

The endpoint should return 409 Conflict for duplicate emails, not 500. Check logs:

```bash
docker compose logs --tail=100 app | grep -i "error\|duplicate\|unique"
```

---

## Incident: SSE Connections Fail for Authenticated Users

### Symptoms

- Users see "Authentication required" (401) when connecting to `/api/events`
- Works with API key but not JWT cookie

### Root Cause

1. **Cookie not sent with request** — Fetch calls must include `credentials: 'include'`

```javascript
// Frontend code must specify:
fetch('/api/events', {
  credentials: 'include'  // ← REQUIRED for cookie auth
});
```

2. **CORS not allowing credentials** — See "JWT Tokens Not Persisting" above

3. **Rate limiting blocking connections** — Global limit is 100 req/min per IP. Multiple SSE clients from same IP may trigger this.

```bash
# Check rate limiter state (in-memory, reset on restart):
docker compose restart app
```

---

## Incident: High JWT Verification Errors

### Monitoring Indicators

- `/api/auth/me` returning 200 drops significantly
- `/api/events` connections decrease (users disconnected)
- Application logs show no explicit errors (jwtVerify returns null, not an exception)

### Diagnosis

1. **Clock drift** — Token expiry is 7 days. Large clock skew between server and client could cause issues (unlikely on Docker-hosted single server)

2. **JWT_SECRET mismatch** — If multiple app containers use different JWT_SECRET values, previously issued tokens fail verification.

```bash
# Check all running containers use same secret:
docker ps --filter name=pm_app --format '{{.ID}}' | while read cid; do
  echo -n "$cid: "
  docker exec $cid node -e "console.log(process.env.JWT_SECRET?.substring(0,8) + '...')"
done
```

3. **Secret rotation needed** — For zero-downtime JWT_SECRET rotation:

```bash
# Step 1: Add secondary secret support (code change needed)
# Step 2: Rotate using documented procedure below
```

### Resolution

Regenerate JWT_SECRET (see Incident 1, step 4 above). This will force re-login for all users.

---

## Security Notes

### JWT Configuration (AUTH-007)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Algorithm | HS256 | Symmetric, Edge-compatible |
| Expiry | 7 days | Balance convenience vs security |
| Cookie flags | HttpOnly, SameSite=Lax | CSRF protection |
| Secure flag | Production only | Development allows localhost HTTP |

### Rate Limiting for Auth Endpoints

| Endpoint | Rate Limit | Window | Purpose |
|----------|-----------|--------|---------|
| All endpoints | 100 req/min | 60s | Global DDoS protection |
| Auth failures | 10 req/min | 60s | Brute-force mitigation |
| Write operations | 60 req/min | 60s | Prevent spam |

⚠️ Current implementation: global rate limiter applies equally to all endpoints. The `authFailure` config exists but is NOT yet enforced separately on auth failure responses. Track as TODO.

### HTTPS Requirement

In production, always terminate TLS at a reverse proxy (nginx/Caddy/cloud load balancer). The `Secure` cookie flag ensures tokens are only sent over HTTPS. Do NOT serve this application directly over plain HTTP in production.

---

## Prevention Checklist (After Each Deploy)

- [ ] `JWT_SECRET` is ≥ 64 hex characters and randomly generated
- [ ] `REGISTRATION_ENABLED` set to desired value
- [ ] `CORS_ALLOWED_ORIGINS` does NOT contain `*` wildcard with credentials
- [ ] Migration files are reviewed and committed before deploy
- [ ] Health check includes auth endpoint verification (`/api/auth/me`)
- [ ] Docker Compose sets `NODE_ENV=production` for app container
