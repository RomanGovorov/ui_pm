# PHASE1-008: Docker Security Baseline Not Specified

**ID:** PHASE1-008
**Severity:** MEDIUM
**Category:** Security Misconfiguration (A05:2021)
**STRIDE:** Elevation of Privilege, Tampering
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture specifies Docker Compose deployment but does not define Docker security baselines. Common Docker security issues include:
- Running containers as root
- Exposing database ports to host network
- Including secrets in Docker image layers
- Missing `.dockerignore` (copying `.env`, `.git` into image)

## Location

- **File:** `Dockerfile` (to be created)
- **File:** `docker-compose.yml` (to be created)
- **File:** `.dockerignore` (to be created)

## Impact

- **Container escape**: Root containers have higher impact if a vulnerability allows escape
- **Secret exposure**: `.env` in Docker image = secrets baked into layers, extractable by anyone with image access
- **Database exposure**: Exposed PostgreSQL port allows direct database attacks
- **Source code leak**: `.git` in image exposes full repository history

## Remediation

### Dockerfile (Multi-stage, non-root)

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    # NO ports mapping to host — internal network only
    environment:
      POSTGRES_DB: pm_ui
      POSTGRES_USER: pm_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pm_user"]
      interval: 10s
      timeout: 5s
      retries: 5

secrets:
  db_password:
    file: ./secrets/db_password.txt

volumes:
  pgdata:
```

### .dockerignore

```
.env
.env.*
.git
.gitignore
node_modules
.next
docker-compose.yml
Dockerfile
*.md
tasks/
docs/
```

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (common Docker misconfigurations) |
| Impact | HIGH (container escape, secret exposure) |
| **Risk** | **MEDIUM** |

## Status

**OPEN** — Must be addressed in Phase 1 (TSK-005 Docker setup).
