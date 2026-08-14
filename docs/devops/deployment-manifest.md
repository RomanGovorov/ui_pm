# Deployment Manifest — Project Manager UI v1

**Version:** 1.0.0
**Author:** devops-infrastructure-engineer
**Date:** 2026-08-13
**Environment:** Single-server production
**Architecture:** Next.js 15 (App Router) + PostgreSQL 16 + Prisma

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────┐
│           Docker Compose Stack          │
│                                         │
│  ┌──────────────┐    internal:bridge   │
│  │   App        │◄───────────────────► │
│  │   :3000      │                      │
│  │              │                       │
│  │   Node 22    │                      │
│  │   Next.js 15 │                      │
│  │   Standalone │                      │
│  └──────┬───────┘                      │
│         │                              │
│         │ prisma                       │
│         ▼                              │
│  ┌──────────────┐                       │
│  │   DB         │                       │
│  │   :5432      │                      │
│  │              │                       │
│  │   PostgreSQL │                      │
│  │   16-alpine  │                      │
│  └──────────────┘                       │
│     ▾ pgdata volume                     │
└─────────────────────────────────────────┘

External → :3000 (app public port only)
```

## 2. Services Inventory

| Service | Image | Port | Health Check | Restart Policy |
|---------|-------|------|--------------|----------------|
| `app` | Build from local Dockerfile | 3000:3000 | `/api/health` every 30s, timeout 5s, retries 3 | unless-stopped |
| `db` | postgres:16.4-alpine | 5432 (internal only) | `pg_isready` every 5s, timeout 5s, retries 5 | unless-stopped |

## 3. Container Specifications

### App Container (`Dockerfile`)

| Property | Value | Rationale |
|----------|-------|-----------|
| Base image | node:22-alpine | Minimal Alpine, small footprint |
| Build strategy | Multi-stage (3 stages) | deps → builder → runner |
| Non-root user | `nextjs` (uid 1001) | Security best practice |
| Output mode | Standalone | `.next/standalone` for slim deployment |
| Prisma | Pre-generated in runner | No npm/prisma install needed |
| Entry point | `node server.js` | Official Next.js standalone start |
| Memory limit | Not set (default) | Add via compose resource limits |

**Multi-stage breakdown:**
- **Stage 1 (deps):** Installs all dependencies including devDependencies (Prisma engine), generates Prisma client
- **Stage 2 (builder):** Copies source, runs `next build`, produces `.next/standalone` output
- **Stage 3 (runner):** Minimal runtime — copies only required files, runs as non-root

### Database Container

| Property | Value | Rationale |
|----------|-------|-----------|
| Image | postgres:16.4-alpine | **Pinned version** — never `:latest` |
| Volume | `pgdata` named volume | Persistent storage across restarts |
| User | postgres superuser (container default) | Prisma manages schema |
| Max connections | 100 (PostgreSQL default) | `connection_limit=10` in DATABASE_URL |
| Shared buffers | 128MB (PostgreSQL default) | Sufficient for < 1GB dataset |
| WAL level | `replica` (default) | Required for future backups |

## 4. Environment Variables

All secrets sourced from `.env` file (never hardcoded):

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | ✅ | `.env` | PostgreSQL connection string with `connection_limit=10` |
| `API_KEY` | ✅ | `.env` | 256-bit random key for agent auth (64 hex chars) |
| `API_KEY_SECONDARY` | ❌ | `.env` | Secondary key for zero-downtime rotation |
| `JWT_SECRET` | ✅ | `.env` | JWT signing secret, ≥ 64 hex chars (32 bytes minimum). AUTH-003: validated at module load time. |
| `CORS_ALLOWED_ORIGINS` | ✅ | `.env` | Comma-separated origins, no wildcards with credentials |
| `REGISTRATION_ENABLED` | ❌ | `.env` | Set to `'false'` to disable user registration after initial setup |
| `NODE_ENV` | ✅ | docker-compose.yml | Set to `production` |
| `DB_PASSWORD` | ⚠️ | `.env` | Overrides inline default; recommended for production |

**Generation commands:**
```bash
# Generate API_KEY (256 bits of randomness)
openssl rand -hex 32

# Generate JWT_SECRET (≥ 96 hex chars = 48 bytes for strong security margin)
openssl rand -hex 48

# Generate strong DB password (≥20 chars)
openssl rand -base64 32
```

**JWT_SECRET Requirements:**
- Minimum 64 hex characters (32 bytes)
- Must be set before container start — session module throws FATAL if missing or too short
- Changing JWT_SECRET invalidates all existing sessions immediately
- Never share or commit real values — use `.gitignore` on `.env` files
- See `docs/devops/runbook-infra-001_auth-troubleshooting.md` for troubleshooting

### Auth Services

| Route | Method | Auth Required | Notes |
|-------|--------|---------------|-------|
| `/api/auth/register` | POST | No | Creates new user account. Controlled by `REGISTRATION_ENABLED`. |
| `/api/auth/login` | POST | No | Authenticates user, sets `auth_token` httpOnly cookie. |
| `/api/auth/logout` | POST | Yes | Clears auth token cookie. |
| `/api/auth/me` | GET | No* | Returns current user payload or 401 (*unauthenticated but endpoint responds) |
| `/api/events` | GET | Yes | SSE stream — requires valid JWT cookie or API key |

**Cookie Configuration:**
- Name: `auth_token`
- Path: `/`
- Max-Age: 7 days
- HttpOnly: yes (inaccessible to JavaScript)
- SameSite: `Lax`
- Secure: `true` in production, `false` in development

**CORS Credentials:**
When `origin` matches `CORS_ALLOWED_ORIGINS`, middleware adds:
- `Access-Control-Allow-Credentials: true`
This is required for cookie-based auth from frontend apps on different ports/domains.

## 5. Network Configuration

| Network | Type | Purpose |
|---------|------|---------|
| `internal` | bridge | Internal Docker network; app ↔ db communication only |
| Host→app | published port 3000 | External traffic only reaches app container |
| Host→db | blocked | Port 5432 NOT exposed to host |

## 6. Storage & Volumes

| Volume | Mount Path | Driver | Purpose |
|--------|-----------|--------|---------|
| `pgdata` | `/var/lib/postgresql/data` | local | PostgreSQL persistent data |

**Volume management:**
```bash
# Create volume (if not auto-created by compose)
docker volume create ui_pm_pgdata

# Backup volume
docker run --rm -v ui_pm_pgdata:/data -v $(pwd):/backup alpine tar czf /backup/pgdata-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v ui_pm_pgdata:/data -v $(pwd):/backup alpine tar xzf /backup/pgdata-backup.tar.gz -C /data
```

## 7. Deployment Commands

### Initial Deploy
```bash
# 1. Copy .env to production host
cp app/.env.example app/.env
# Edit .env with real secrets

# 2. Build and start
cd app && docker compose up -d --build

# 3. Run database migrations
docker compose exec app npx prisma migrate deploy

# 4. Seed initial data (optional)
docker compose exec app npx tsx prisma/seed.ts

# 5. Verify health
curl -s http://localhost:3000/api/health | jq
```

### Rolling Update
```bash
# 1. Build new image
cd app && docker compose build app

# 2. Graceful restart (Next.js finishes in-flight requests)
docker compose up -d --no-deps app
```

### Rollback
```bash
# 1. Stop current app
docker compose stop app

# 2. Start previous image
docker compose up -d app  # uses cached layers from last successful build

# 3. Verify
curl -s http://localhost:3000/api/health | jq
```

### Full Shutdown
```bash
cd app && docker compose down
# Preserve data volumes:
# docker compose down -v  ← destroys data (use with caution!)
```

## 8. Resource Limits (Recommended)

Add to `docker-compose.yml` under `app` service:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

Add to `db` service:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 256M
    reservations:
      cpus: '0.25'
      memory: 128M
```

## 9. Production Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | `POSTGRES_PASSWORD` is ≥ 16 chars, randomly generated | _manual_ |
| 2 | `API_KEY` is 64 hex chars (256 bits), randomly generated | _checked_ |
| 3 | `API_KEY_SECONDARY` configured for rotation (if applicable) | _optional_ |
| 4 | `JWT_SECRET` is ≥ 96 hex chars, randomly generated | **NEW** — required by session module at startup |
| 5 | `CORS_ALLOWED_ORIGINS` restricted to specific origin(s) | _checked_ |
| 6 | `.env` file is in `.gitignore` | _checked_ |
| 7 | PostgreSQL image pinned to `16.4-alpine` (not `:latest`) | _checked_ |
| 8 | App container runs as non-root user (`nextjs`) | _checked_ |
| 9 | Multi-stage build minimizes image size | _checked_ |
| 10 | Database port 5432 not exposed to host | _checked_ |
| 11 | Health checks configured for all services | _partially_ |
| 12 | `prisma migrate deploy` runs before app starts | **DONE** — docker-entrypoint.sh handles this |
| 13 | Auth endpoint health check added to monitoring | **NEW** — `/api/auth/me` returns 401 when unauthenticated |
| 14 | CORS credentials enabled for cookie-based auth | **NEW** — middleware sets Allow-Credentials header |
| 15 | Resource limits configured | _recommended_ |
| 16 | Backup strategy documented | _documented below_ |
| 17 | Rollback procedure tested | _manual_ |
| 18 | Auth troubleshooting runbook available | **NEW** — `runbook-infra-001_auth-troubleshooting.md` |

## 10. Known Limitations (v1)

| Item | Impact | Future Action |
|------|--------|---------------|
| No PgBouncer | Single pool per Next.js instance | Add if multiple app replicas needed |
| In-memory rate limiter | Does not survive restarts; no separate auth failure limit yet | Acceptable for single-instance v1; TODO: separate `authFailure` rate limit on login/register endpoints |
| In-memory SSE store | Lost on restart | Acceptable for low-concurrency v1 |
| Unencrypted volume | Data at rest not encrypted | Evaluate encryption for compliance |
| No CDN | Direct to-origin delivery | Add Cloudflare/nginx reverse proxy for v2 |
| No HTTPS termination | Plaintext on localhost | Use reverse proxy (nginx/Caddy) for production |

---

## 11. Change Log

### TSK-019 — UI Enhancement (2026-08-14)

**Summary:** Inline task editing for admin users + status dropdown in task creation.

**Files Changed:**
- `src/app/components/modals/EditTaskModal.tsx` — NEW: inline edit modal component
- `src/app/components/CreateTaskModal.tsx` — MODIFIED: added status dropdown selector
- `src/app/components/TaskCard.tsx` — MODIFIED: added admin-only edit button
- `src/lib/validators/tasks.ts` — MODIFIED: updated Zod schema for task update validation
- `src/lib/services/tasks-service.ts` — MODIFIED: added `updateTask()` method with error handling

**Infrastructure Impact Assessment:** None. All changes are frontend-only (React components, Zod validators, TypeScript service layer). No new environment variables, no database migrations, no Docker configuration changes, no CI/CD modifications required. The existing deployment pipeline (`docs/devops/ci-cd-pipeline.md`) and monitoring setup (`docs/devops/monitoring-dashboard.md`) remain fully adequate.

**Rollback:** Standard rolling update — rebuild image and restart app container. No migration rollback needed since no schema changes were made.
