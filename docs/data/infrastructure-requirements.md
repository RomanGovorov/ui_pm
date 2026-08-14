# Infrastructure Requirements — Project Manager UI v1

**Version:** 1.0
**Author:** data-engineering-architect
**Date:** 2026-08-13
**Status:** Draft — pending architecture-planner review

---

## 1. Database Infrastructure

### 1.1 PostgreSQL Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Version | 16 | Current stable; well-supported by Prisma 6.x |
| `max_connections` | 100 (default) | Sufficient for v1 single-server deployment |
| `shared_buffers` | 128MB (default) | Fine for datasets < 1GB |
| `work_mem` | 4MB (default) | No complex joins requiring larger sort areas |
| WAL level | `replica` (default) | Required for pg_basebackup (future backups) |

### 1.2 Connection Pooling

| Component | Configuration | Notes |
|---|---|---|
| **Method** | Prisma built-in pool (no PgBouncer) | Single Next.js instance — PgBouncer adds unnecessary complexity |
| `connection_limit` | 10 | Set via `DATABASE_URL` query parameter |
| Pool lifecycle | Singleton via `globalThis` guard | Prevents multiple pool instances in development HMR |
| Graceful shutdown | `prisma.$disconnect()` on `beforeExit` | Releases connections on container restart |

```env
# .env.example
DATABASE_URL="postgresql://pm_user:pm_password@db:5432/pm_ui?connection_limit=10"
```

### 1.3 Database Volume

| Parameter | Value | Notes |
|---|---|---|
| Initial size | ~10MB | Empty schema + seed data |
| Growth rate (v1) | ~50KB/month | ~100 tasks × ~300B each |
| Max size (v1) | < 100MB | Well within any storage allocation |
| Backup strategy | Daily pg_dump → volume backup | Docker volume persistence |

---

## 2. Application Infrastructure

### 2.1 Docker Compose Services

```yaml
# docker-compose.yml (data-related configuration)
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://pm_user:pm_password@db:5432/pm_ui?connection_limit=10
      - API_KEY=${API_KEY}
    restart: unless-stopped

  db:
    image: postgres:16.4-alpine     # ⚡ AUDIT: Pin to specific patch version
    environment:
      - POSTGRES_USER=pm_user
      - POSTGRES_PASSWORD=pm_password
      - POSTGRES_DB=pm_ui
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pm_user -d pm_ui"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
    driver: local
```

### 2.2 Dockerfile (Prisma-related steps)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate              # Generate Prisma Client

COPY . .
RUN npm run build                    # Next.js build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./

# ⚡ Pre-generate client in production image
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

**Key points:**
- `prisma generate` in build stage (type generation)
- `prisma migrate deploy` at startup (schema sync)
- No `prisma migrate dev` in production

---

## 3. Monitoring & Observability

### 3.1 Prisma Query Logging

```typescript
// lib/db/client.ts
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']     // Full logging in dev
    : ['error'],                      // Errors only in prod
});
```

**In development:** All SQL queries logged to console — useful for N+1 detection.

### 3.2 Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'healthy', database: 'connected' });
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', database: 'disconnected' },
      { status: 503 }
    );
  }
}
```

### 3.3 Metrics to Track

| Metric | Source | Alert Threshold |
|---|---|---|---|
| DB connection count | PostgreSQL `pg_stat_activity` | > 80% of `connection_limit` |
| Query duration (p95) | Prisma query log (dev) | > 200ms |
| SSE active connections | EventEmitter listener count | > 50 |
| Task count | `SELECT COUNT(*) FROM tasks` | > 500 (v1 capacity warning) |

---

## 4. Security (Data Layer)

| Control | Implementation | Notes |
|---|---|---|
| SQL Injection | Prisma parameterized queries (automatic) | No raw SQL used |
| API Key storage | `User.apiKey` — hashed in v2, plain in v1 | v1: static key in env |
| DB network isolation | Docker internal network only | Port 5432 not exposed to host |
| Backup encryption | Docker volume (unencrypted in v1) | Plan for encrypted backups in v2 |

---

## 5. Scaling Limits (v1)

| Resource | v1 Limit | When to Scale | Scaling Action |
|---|---|---|---|
| Tasks | ~100 | > 500 | Add pagination, consider read replicas |
| Projects | ~10 | > 50 | Add project-level caching |
| Concurrent SSE clients | ~10 | > 50 | Move to Redis pub/sub (replaces in-memory EventEmitter) |
| DB connections | 10 (pool) | > 80% utilized | Add PgBouncer |
| API requests | ~100/min | > 1000/min | Add rate limiting middleware |

---

## 6. v2 Infrastructure Considerations

| Component | v2 Addition | Trigger |
|---|---|---|
| PgBouncer | Connection pooling for multi-instance | > 1 Next.js instance |
| Redis | SSE pub/sub (replaces in-memory EventEmitter) | > 10 concurrent SSE clients or multi-instance |
| Read replica | Read/write split for reporting | Heavy read load from analytics |
| pg_cron | Scheduled backups | Production deployment |
| Vault/Secrets mgmt | API key rotation | Security compliance requirement |
