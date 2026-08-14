# ADR-006: Rate Limiting Promoted to v1

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner (post Phase 1 security audit)
**Supersedes:** System Architecture §9 original decision ("v1.1")

---

## Context

The original system architecture (§9 Risks) deferred rate limiting to v1.1:
> "Agent rate limiting | Agent could flood API | Add rate limiter middleware (v1.1)"

The Phase 1 security audit (PHASE1-002) identified this as a HIGH risk:
- Unlimited brute-force API key guessing attempts
- Resource exhaustion via high-volume requests
- SSE connection slot exhaustion
- Database connection pool exhaustion under load
- Cascading failure from a buggy agent

Implementation cost is low (~30 lines of in-memory sliding window middleware).

## Decision

**Implement rate limiting in v1 (Phase 1 foundation), not v1.1.**

### Rate Limits

| Scope | Limit | Rationale |
|---|---|---|
| Global API | 100 req/min/IP | Generous for agent, blocks flooding |
| Auth failures | 10 fail/min/IP | Blocks brute force |
| SSE connections | 50 total, 10/IP | Prevents memory exhaustion |
| Write operations | 60 req/min/IP | Tighter limit for mutations |

### Implementation

- In-memory sliding window (acceptable for single-instance v1)
- Store in `Map<string, { count: number; resetAt: number }>`
- Return `429 Too Many Requests` with `Retry-After` header when exceeded
- Integrated into `middleware.ts` (auth failure limit) and per-route (global limit)

## Options Considered

### Option A: In-memory rate limiter — CHOSEN
- Simple, no external dependencies
- Sufficient for single-server deployment
- Data lost on restart (acceptable — counters reset naturally)

### Option B: Redis-based rate limiter
- Survives restarts, supports multi-instance
- Rejected: adds Redis dependency for v1; overkill for single server

### Option C: Keep as v1.1 (original decision)
- Rejected: security risk is HIGH, implementation cost is LOW

## Consequences

- **Positive**: DoS protection from day 1; brute-force mitigation; connection exhaustion prevention
- **Positive**: Simple implementation (~30 lines), no external dependencies
- **Negative**: Rate limits reset on server restart (acceptable trade-off)
- **Negative**: Per-IP limiting assumes single proxy or direct access; behind reverse proxy, `X-Forwarded-For` must be trusted

## Migration Path (v2)

- Replace in-memory store with Redis for multi-instance support
- Add per-API-key rate limiting (in addition to per-IP)
- Add configurable rate limits via admin API
