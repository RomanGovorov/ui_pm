# PHASE1-003: Missing Security Headers Configuration

**ID:** PHASE1-003
**Severity:** HIGH
**Category:** Security Misconfiguration (A05:2021)
**STRIDE:** Information Disclosure, Tampering
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture does not specify any security headers configuration. Without explicit headers, the application is vulnerable to:
- Clickjacking (missing `X-Frame-Options`)
- MIME-type sniffing attacks (missing `X-Content-Type-Options`)
- Referrer leakage (missing `Referrer-Policy`)
- Cross-site scripting via injected content (missing CSP)
- Protocol downgrade attacks (missing HSTS)

## Location

- **File:** `next.config.ts` or `middleware.ts` (to be created)
- **Component:** HTTP response headers

## Impact

- **Clickjacking**: Attacker can embed the dashboard in an iframe and trick users into clicking
- **MIME sniffing**: Browsers may interpret uploaded content as executable scripts
- **Referrer leakage**: API key in URL (if accidentally sent) could leak to third-party sites
- **XSS**: Without CSP, any XSS vulnerability becomes fully exploitable

## Remediation

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",  // Required by Next.js
      "style-src 'self' 'unsafe-inline'", // Required by Tailwind
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  poweredByHeader: false, // Remove X-Powered-By
};

export default nextConfig;
```

**Note for production:** Remove `'unsafe-eval'` from `script-src` in production builds. Next.js production builds don't require it.

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (requires attacker to target the app) |
| Impact | HIGH (multiple attack vectors enabled) |
| **Risk** | **HIGH** |

## Status

**OPEN** — Must be configured in Phase 1 foundation (TSK-005 or TSK-008).
