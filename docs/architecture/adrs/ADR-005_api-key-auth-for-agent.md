# ADR-005: Static API Key Authentication for Agent

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner
**Task:** TSK-001

---

## Context

The AI agent `project-manager` needs to authenticate when calling the REST API. The PRD states:
- No user-facing authentication (open dashboard access)
- API authentication for the agent (API key or token)
- Single agent, single server deployment

## Decision

**Static API Key in `X-API-Key` header.**

### Authentication Flow

```
Agent → PUT /api/tasks/123
        Header: X-API-Key: <static-key>
              ↓
Next.js Middleware / Route Handler
        ↓ Check X-API-Key against env var API_KEY
        ↓ Valid → proceed
        ↓ Invalid → 401 Unauthorized
```

### Implementation

```typescript
// lib/auth.ts
import { NextRequest } from 'next/server';

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const expectedKey = process.env.API_KEY;
  
  if (!apiKey || !expectedKey) return false;
  
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(apiKey, expectedKey);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

```typescript
// middleware.ts (or per-route guard)
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';

const WRITE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
const PROTECTED_PREFIXES = ['/api/projects', '/api/tasks', '/api/users'];

export function middleware(request: NextRequest) {
  const { method, nextUrl } = request;
  const path = nextUrl.pathname;
  
  // Only protect write operations
  if (!WRITE_METHODS.includes(method)) {
    return NextResponse.next();
  }
  
  // Check if path is a protected API route
  if (!PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return NextResponse.next();
  }
  
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
      { status: 401 }
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### Key Management

| Aspect | Decision |
|---|---|
| Key generation | Random 64-char hex string, generated once at setup |
| Storage | Environment variable `API_KEY` |
| Rotation | Manual: update env var and restart; agent config updated |
| Multiple keys | Not in v1 (single agent, single key) |
| Key scoping | Full access (all write operations) |

### Security Properties

| Property | Value |
|---|---|
| Transport | HTTPS only (production) |
| Header name | `X-API-Key` (custom, non-standard) |
| Key format | 64-char hex (256-bit entropy) |
| Timing attack protection | Constant-time comparison |
| Read operations | Unauthenticated (dashboard access) |

## Options Considered

### Option A: Static API Key — CHOSEN
- Simplest implementation; single key in env var
- Sufficient for single-agent, single-server deployment

### Option B: JWT / OAuth2 Token
- Token expiration, refresh, scopes
- Rejected: Overkill for single agent; adds auth server complexity

### Option C: mTLS (Mutual TLS)
- Certificate-based authentication
- Rejected: Excessive complexity for v1; requires certificate management

### Option D: No Authentication
- PRD mentions this as an option
- Rejected: Even minimal protection prevents accidental writes from random HTTP requests

## Consequences

- **Positive**: Simple to implement, easy for agent to use, prevents unauthorized writes
- **Negative**: Key rotation requires restart; no key scoping or revocation
- **Migration path**: In v2, migrate to per-agent API keys stored in DB with scopes
