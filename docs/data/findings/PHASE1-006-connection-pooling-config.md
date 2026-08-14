# PHASE1-006: Connection Pooling Configuration for Next.js + Prisma

**Severity:** Medium
**Category:** Infrastructure
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The current Prisma client configuration uses default connection pool settings with no explicit pool sizing. Next.js App Router can create multiple server instances (in development with HMR, in production with multiple workers), each creating its own Prisma client instance and DB connections.

## Impact

- PostgreSQL default `max_connections` is 100
- Each Prisma client uses `connection_limit` from `DATABASE_URL` query param (default: calculated from available connections)
- In development with hot reload, multiple Prisma instances can exhaust connections
- SSE connections are long-lived but do not hold DB connections (they use EventEmitter)

## Recommendation

### DATABASE_URL with explicit connection limit

```env
# .env
DATABASE_URL="postgresql://user:pass@db:5432/pm_ui?connection_limit=10"
```

**Rule of thumb:** `connection_limit = (max_connections / number_of_app_instances) - headroom`

For a single Docker Compose deployment:
- PostgreSQL `max_connections = 100` (default)
- Next.js single instance: `connection_limit = 10`
- Reserve 90 connections for other operations, future scaling

### Prisma Client with explicit pool config

```typescript
// lib/db/client.ts
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

### No pgbouncer needed for v1

At v1 scale (single Next.js instance, ~100 tasks, 5-10 users), PgBouncer adds unnecessary complexity. Use Prisma's built-in connection pooling. Revisit if scaling to multiple Next.js instances.

### Connection lifecycle

```typescript
// On server shutdown (graceful):
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

## Acceptance Criteria

- [ ] `connection_limit=10` added to `DATABASE_URL` in `.env.example`
- [ ] Prisma client singleton pattern verified (globalThis guard)
- [ ] `$disconnect()` called on process shutdown
- [ ] PgBouncer noted as v2 consideration (documented, not implemented)
