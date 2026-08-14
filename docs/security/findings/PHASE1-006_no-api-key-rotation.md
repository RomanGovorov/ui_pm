# PHASE1-006: No API Key Rotation Mechanism

**ID:** PHASE1-006
**Severity:** MEDIUM
**Category:** Cryptographic Failures (A02:2021)
**STRIDE:** Spoofing
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture uses a single static API key with no rotation mechanism. If the key is compromised, there is no way to:
1. Rotate the key without downtime (changing `API_KEY` requires restart)
2. Support multiple valid keys during rotation transition
3. Revoke a compromised key independently

## Location

- **File:** `lib/auth.ts` (to be implemented)
- **File:** `.env`
- **Component:** Authentication layer

## Impact

- **Compromised key**: If the key leaks, all API access is compromised until manual intervention
- **Downtime during rotation**: Changing the key requires updating both the agent config and the server, with a restart
- **No revocation**: Cannot invalidate a specific key while keeping others valid

## Remediation

Support dual-key configuration for zero-downtime rotation:

```typescript
// lib/auth.ts
export function verifyApiKey(receivedKey: string): boolean {
  const primary = process.env.API_KEY;
  const secondary = process.env.API_KEY_SECONDARY; // Optional
  
  if (!receivedKey) return false;
  
  const receivedBuf = Buffer.from(receivedKey, 'utf-8');
  
  if (primary) {
    const primaryBuf = Buffer.from(primary, 'utf-8');
    if (receivedBuf.length === primaryBuf.length && timingSafeEqual(receivedBuf, primaryBuf)) {
      return true;
    }
  }
  
  if (secondary) {
    const secondaryBuf = Buffer.from(secondary, 'utf-8');
    if (receivedBuf.length === secondaryBuf.length && timingSafeEqual(receivedBuf, secondaryBuf)) {
      return true;
    }
  }
  
  return false;
}
```

**Rotation procedure:**
1. Generate new key
2. Set `API_KEY_SECONDARY=<new_key>`, restart server
3. Update agent configuration to use new key
4. Promote: `API_KEY=<new_key>`, clear `API_KEY_SECONDARY`, restart
5. Old key is now invalid

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | LOW (key compromise is unlikely in internal network) |
| Impact | HIGH (no recovery path without downtime) |
| **Risk** | **MEDIUM** |

## Status

**OPEN** — Recommend dual-key support in Phase 1 (TSK-008). Low effort, high operational value.
