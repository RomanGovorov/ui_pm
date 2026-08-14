# BUG-002: Missing `Vary: Origin` Header in CORS Responses

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Status** | FIXED (2026-08-13, code-implementer) |
| **Priority** | P2 |
| **Component** | `app/src/middleware.ts` (getCorsHeaders) |
| **Reported By** | comprehensive-test-engineer (T45a) |
| **Date** | 2026-08-13 |
| **Original Finding** | Code review MEDIUM-002 |
| **Verification** | Static analysis of middleware source confirms missing header |

---

## Description

When `getCorsHeaders()` sets a specific `Access-Control-Allow-Origin` value based on the request origin, it does NOT include the `Vary: Origin` header. Per RFC 7231 and the Fetch specification, when `Access-Control-Allow-Origin` varies by request origin, the response MUST include `Vary: Origin`.

Without this header, caching proxies (CDN, corporate proxy, browser cache) may serve a cached response with the wrong `Access-Control-Allow-Origin` to a different origin.

## Impact

- Potential **cache poisoning** via HTTP caching layers
- Cross-origin requests from allowed origins may receive responses intended for other origins
- Compliance risk against security best practices

## Reproduction

```bash
curl -H "Origin: http://example.com" \
     -D - http://localhost:3000/api/projects
# Check headers: Vary: Origin is absent
```

## Recommended Fix

Add `'Vary': 'Origin'` to all responses that include CORS headers:

```ts
function getCorsHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',  // ← ADD THIS LINE
  };
  // ... rest of function
}
```

## Test Evidence

Static analysis test `MEDIUM-002: Vary header NOT present` confirms:
- Source file checked at `src/middleware.ts`
- No occurrence of `'Vary'` or `"Vary"` found
- All other CORS patterns verified correct
