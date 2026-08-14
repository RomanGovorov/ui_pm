# PHASE1-010: Middleware Auth Bypass Risk

**ID:** PHASE1-010
**Severity:** HIGH
**Category:** Broken Access Control (A01:2021)
**STRIDE:** Elevation of Privilege, Tampering
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture uses Next.js middleware for API key validation but does not precisely define the middleware matcher pattern. Risks include:

1. **Incomplete route coverage**: If the matcher doesn't cover all API routes, some write endpoints may be unprotected
2. **Method-based bypass**: The architecture allows GET without auth — a misconfigured route that accepts GET for mutations would bypass auth
3. **Path traversal**: Routes like `/api/tasks/../admin` could bypass matcher patterns
4. **SSE endpoint exception**: The SSE endpoint `/api/events` is explicitly open — any additional open endpoints must be explicitly listed

## Location

- **File:** `middleware.ts`
- **Component:** Authentication middleware

## Impact

- **Unauthorized writes**: If any POST/PUT/DELETE route is not covered by the middleware matcher, it accepts writes without authentication
- **Privilege escalation**: An attacker could discover and exploit unprotected endpoints
- **Data modification**: Unauthorized task creation, modification, or deletion

## Evidence

From system architecture §6.2:
> "API routes validate API key for write operations"
> "Read operations (GET) are open for v1"

The middleware approach is sound but the matcher pattern is unspecified.

## Remediation

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limiter';

// Explicit matcher: ALL /api routes
export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow SSE endpoint without auth (read-only stream)
  if (pathname === '/api/events') {
    return NextResponse.next();
  }
  
  // Allow GET requests without auth (read-only)
  if (request.method === 'GET') {
    return NextResponse.next();
  }
  
  // Allow OPTIONS preflight (CORS)
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }
  
  // ALL other methods require API key
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'API key required' } },
      { status: 401 }
    );
  }
  
  if (!verifyApiKey(apiKey)) {
    // Rate limit auth failures
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const result = rateLimit(`auth_fail:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
    
    if (!result.allowed) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many failed attempts' } },
        { status: 429, headers: { 'Retry-After': String(result.retryAfter || 60) } }
      );
    }
    
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } },
      { status: 401 }
    );
  }
  
  return NextResponse.next();
}
```

**Key design decisions:**
1. **Matcher covers ALL `/api/*`** — no exceptions in the matcher pattern
2. **Whitelist approach** — explicitly allow only GET, OPTIONS, and SSE
3. **Default deny** — any method not explicitly allowed requires auth
4. **No path-based exceptions** — route-specific exceptions are in route handlers, not middleware

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | LOW (if implemented correctly) |
| Impact | CRITICAL (unauthorized data modification) |
| **Risk** | **HIGH** |

## Status

**OPEN** — Middleware must be implemented with precise matcher in Phase 1 (TSK-008).
