# PHASE1-004: SSE Connection Resource Leak and DoS

**ID:** PHASE1-004
**Severity:** HIGH
**Category:** Availability (A05:2021 — Security Misconfiguration)
**STRIDE:** Denial of Service
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The SSE endpoint design has two security concerns:

1. **No connection limit**: The architecture sets `eventBus.setMaxListeners(100)` but does not limit the total number of SSE connections. An attacker can open unlimited connections, each consuming server memory and a file descriptor.

2. **EventEmitter listener accumulation**: While the architecture shows cleanup on `abort` signal, edge cases (proxy timeouts, dropped connections without FIN) may leave orphaned listeners. The `setMaxListeners(100)` is a warning threshold, not a hard limit.

## Location

- **File:** `app/api/events/route.ts` (to be implemented)
- **File:** `lib/events/event-bus.ts`
- **Component:** SSE Broadcaster

## Impact

- **Memory exhaustion**: Each SSE connection holds a ReadableStream controller, encoder, interval timer, and event listeners (~10-50KB each)
- **File descriptor exhaustion**: Each connection uses a TCP socket; Linux default limit is 1024
- **Cascading failure**: As connections grow, event broadcasting slows down (iterating 1000+ listeners)
- **Complete DoS**: Server becomes unresponsive when resources are exhausted

## Evidence

From component specifications §3.3:
```typescript
export const eventBus = new EventBus();
eventBus.setMaxListeners(100); // Warning only, not a hard limit
```

From component specifications §3.4:
```typescript
// No connection counting or limit enforcement
const stream = new ReadableStream({ ... });
```

## Remediation

```typescript
// lib/events/event-bus.ts
class EventBus extends EventEmitter {
  private activeConnections = 0;
  private readonly MAX_CONNECTIONS = 50;
  private readonly MAX_PER_IP = 10;
  private ipConnections = new Map<string, number>();

  canAcceptConnection(clientIp: string): boolean {
    if (this.activeConnections >= this.MAX_CONNECTIONS) return false;
    const ipCount = this.ipConnections.get(clientIp) || 0;
    if (ipCount >= this.MAX_PER_IP) return false;
    return true;
  }

  registerConnection(clientIp: string): void {
    this.activeConnections++;
    this.ipConnections.set(clientIp, (this.ipConnections.get(clientIp) || 0) + 1);
  }

  unregisterConnection(clientIp: string): void {
    this.activeConnections--;
    const count = (this.ipConnections.get(clientIp) || 1) - 1;
    if (count <= 0) this.ipConnections.delete(clientIp);
    else this.ipConnections.set(clientIp, count);
  }
}

// In SSE route handler:
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
  
  if (!eventBus.canAcceptConnection(clientIp)) {
    return NextResponse.json(
      { error: { code: 'TOO_MANY_CONNECTIONS', message: 'SSE connection limit reached' } },
      { status: 503 }
    );
  }
  
  eventBus.registerConnection(clientIp);
  
  const stream = new ReadableStream({
    start(controller) {
      // ... existing setup ...
      request.signal.addEventListener('abort', () => {
        eventBus.unregisterConnection(clientIp);
        // ... existing cleanup ...
      });
    }
  });
  // ...
}
```

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (requires deliberate attack or misconfigured client) |
| Impact | HIGH (server crash, affects all users) |
| **Risk** | **HIGH** |

## Status

**OPEN** — Must be implemented in Phase 3 (SSE layer, TSK-009).
