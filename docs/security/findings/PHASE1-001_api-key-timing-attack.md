# PHASE1-001: API Key Timing Attack Vulnerability

**ID:** PHASE1-001
**Severity:** CRITICAL
**Category:** Authentication (A02:2021 — Cryptographic Failures)
**STRIDE:** Spoofing
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture specifies API key comparison but does not mandate timing-safe comparison. Standard `===` string comparison in JavaScript is vulnerable to timing side-channel attacks, where an attacker can deduce key characters by measuring response time differences.

## Location

- **File:** `lib/auth.ts` (to be implemented)
- **Component:** API Key validation middleware

## Impact

An attacker with network-level access can incrementally guess the API key one character at a time by measuring response latency differences. This could lead to full API key compromise within hours, granting unauthorized write access to all data.

## Evidence

From architecture document §6.1:
> "API Key in `X-API-Key` header" — no specification of comparison method.

From component specifications §3.1:
> "Middleware validates API key → reject with 401 if invalid" — implementation method unspecified.

Standard string comparison (`received === expected`) returns `false` as soon as the first mismatched character is found, creating measurable timing differences.

## Remediation

```typescript
// lib/auth.ts
import { timingSafeEqual } from 'crypto';

export function verifyApiKey(receivedKey: string): boolean {
  const expectedKey = process.env.API_KEY;
  if (!expectedKey || !receivedKey) return false;
  
  const receivedBuf = Buffer.from(receivedKey, 'utf-8');
  const expectedBuf = Buffer.from(expectedKey, 'utf-8');
  
  if (receivedBuf.length !== expectedBuf.length) return false;
  
  return timingSafeEqual(receivedBuf, expectedBuf);
}
```

**Key points:**
1. Use `crypto.timingSafeEqual()` — constant-time comparison
2. Check length equality BEFORE calling `timingSafeEqual` (it throws on mismatched lengths)
3. Compare as Buffers, not strings

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (requires network-level access and precise timing) |
| Impact | CRITICAL (full API access) |
| **Risk** | **CRITICAL** |

## Status

**OPEN** — Must be implemented in Phase 1 foundation (TSK-008).
