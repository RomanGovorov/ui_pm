# ADR-002: Server-Sent Events (SSE) Over WebSocket for Real-Time Updates

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner
**Task:** TSK-001

---

## Context

The dashboard needs real-time updates: when the AI agent changes a task status via REST API, all connected browser clients should see the change without page reload. We need to choose between WebSocket and Server-Sent Events (SSE).

**Communication pattern:** Server → Client (unidirectional). Clients only receive updates; they send mutations via REST API.

## Options Considered

### Option A: Server-Sent Events (SSE) — CHOSEN

**Pros:**
- Native browser support via `EventSource` API
- Automatic reconnection with `Last-Event-ID`
- Works over standard HTTP (no protocol upgrade)
- Simpler server implementation (just write to response stream)
- Compatible with HTTP/2 multiplexing
- No third-party library needed
- Simpler debugging (standard HTTP requests)

**Cons:**
- Unidirectional only (server → client)
- 6 connections per domain per browser (HTTP/1.1 limit)
- Text-only data (no binary)
- No built-in message acknowledgment

### Option B: WebSocket (Socket.io)

**Pros:**
- Bidirectional communication
- No connection limit per domain
- Binary data support
- Room/namespace abstractions (Socket.io)

**Cons:**
- Requires protocol upgrade (ws:// or wss://)
- More complex server setup (WebSocket server alongside HTTP)
- Socket.io adds ~40KB client library
- No automatic reconnection without Socket.io
- Harder to debug (binary protocol)
- Overkill for unidirectional updates

### Option C: Long Polling

**Pros:**
- Works everywhere (plain HTTP)
- Simple concept

**Cons:**
- Higher latency (request-response cycle)
- More server load (repeated connections)
- Inferior to SSE in every metric

## Decision

**Option A: Server-Sent Events (SSE).**

The real-time requirement is strictly **server → client**: the agent writes to the API, the server emits an event, and all connected browsers receive it. SSE is purpose-built for this pattern. It requires no additional libraries, works with standard HTTP, and the browser's `EventSource` API handles reconnection automatically.

The 6-connection limit per domain is not a concern for v1 (5-10 users, typically 1 tab each).

## Implementation

### Server Side

```typescript
// lib/events/event-bus.ts
import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(100); // Max concurrent SSE connections
```

```typescript
// app/api/events/route.ts
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const handler = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      eventBus.on('task_updated', (data) => handler('task_updated', data));
      eventBus.on('task_created', (data) => handler('task_created', data));
      eventBus.on('project_updated', (data) => handler('project_updated', data));
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        eventBus.off('task_updated', handler);
        // ...
        controller.close();
      });
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```

### Client Side

```typescript
// lib/hooks/use-sse.ts
function useSSE() {
  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('task_updated', (e) => {
      const data = JSON.parse(e.data);
      updateTaskInStore(data);
    });
    source.addEventListener('task_created', (e) => {
      const data = JSON.parse(e.data);
      addTaskToStore(data);
    });
    return () => source.close();
  }, []);
}
```

## Consequences

- **Positive**: Zero dependencies for real-time, simple implementation, automatic reconnection
- **Negative**: If bidirectional communication is needed in v2 (e.g., drag-and-drop), WebSocket migration will be required
- **Risk**: In-memory EventEmitter means events are lost on server restart — clients should re-fetch data on SSE reconnect
