# PHASE1-002: No Rate Limiting on API Endpoints

**ID:** PHASE1-002
**Severity:** HIGH
**Category:** Availability / DoS (A05:2021 — Security Misconfiguration)
**STRIDE:** Denial of Service
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture explicitly defers rate limiting to v1.1:
> "Agent rate limiting: Agent could flood API — Add rate limiter middleware (v1.1)"

This leaves ALL API endpoints unprotected against:
1. Brute-force API key guessing
2. Resource exhaustion via high-volume requests
3. SSE connection slot exhaustion
4. Denial of service from both intentional and accidental (buggy agent) sources

## Location

- **All API routes:** `/api/projects/*`, `/api/tasks/*`, `/api/users/*`, `/api/events`
- **Component:** Missing middleware layer

## Impact

- **Brute force**: Unlimited API key guessing attempts (256-bit key is safe, but defense-in-depth requires limiting)
- **DoS**: A buggy or malicious agent can send thousands of requests, overwhelming the single-server deployment
- **SSE exhaustion**: Multiple EventSource connections consume server memory and file descriptors
- **Cascading failure**: Database connection pool exhaustion under high request volume

## Evidence

From system architecture §9:
> "Agent rate limiting | Agent could flood API | Add rate limiter middleware (v1.1)"

No rate limiting mechanism is described anywhere in the architecture.

## Remediation

Implement a sliding-window rate limiter in middleware:

```typescript
// lib/rate-limiter.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, config: RateLimitConfig): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(ip);
  
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }
  
  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

// In middleware.ts:
// Global: 100 requests/minute
// Auth failures: 10 failures/minute
// SSE: 10 connections/IP, 50 total
```

**Recommended limits:**
| Scope | Limit | Rationale |
|---|---|---|
| Global API | 100 req/min/IP | Generous for agent, blocks flooding |
| Auth failures | 10 fail/min/IP | Blocks brute force |
| SSE connections | 10/IP, 50 total | Prevents memory exhaustion |
| POST/PUT/DELETE | 60 req/min/IP | Write operations need tighter limit |

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | HIGH (no protection exists) |
| Impact | MEDIUM-HIGH (single server can be overwhelmed) |
| **Risk** | **HIGH** |

## Recommendation to Architecture Planner

**Move rate limiting from v1.1 to v1.** Implementation is straightforward (in-memory store, ~30 lines of middleware) and the risk of deploying without it is significant even for an internal tool.

## Status

**OPEN** — Recommend implementation in Phase 1 foundation.
