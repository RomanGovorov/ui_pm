# PHASE1-007: Missing CORS Configuration

**ID:** PHASE1-007
**Severity:** MEDIUM
**Category:** Security Misconfiguration (A05:2021)
**STRIDE:** Tampering, Information Disclosure
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture does not specify CORS configuration. Without explicit CORS policy:
- Next.js defaults to same-origin (acceptable for same-origin deployment)
- If the app is accessed cross-origin (e.g., agent from different host), requests will fail
- If a developer adds `Access-Control-Allow-Origin: *` as a quick fix, it creates a security vulnerability (especially with `X-API-Key` custom header)

## Location

- **File:** `middleware.ts` or `next.config.ts`
- **Component:** HTTP headers / CORS layer

## Impact

- **Overly permissive CORS**: `*` origin with credentials allows any website to make API requests with the agent's API key
- **Missing CORS**: Legitimate cross-origin access (e.g., agent from different host) will fail
- **Preflight bypass**: Without proper OPTIONS handling, complex requests (with custom headers) will fail

## Remediation

```typescript
// middleware.ts
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : []; // Empty = same-origin only

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.next();
  
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  
  // Add CORS headers to response
  const corsHeaders = getCorsHeaders(origin);
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  
  return response;
}

function getCorsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  // If origin not in allowlist, don't set CORS header (same-origin only)
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  
  return headers;
}
```

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (common misconfiguration) |
| Impact | MEDIUM (cross-origin attacks or broken functionality) |
| **Risk** | **MEDIUM** |

## Status

**OPEN** — Must be configured in Phase 1 foundation.
