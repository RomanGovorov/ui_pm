import { NextRequest } from 'next/server';
import { eventBus, type TaskEventType, type ProjectEventType } from '@/lib/events/event-bus';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  // SEC-004: Enforce connection limits
  if (!eventBus.canAcceptConnection(clientIp)) {
    return new Response(
      JSON.stringify({
        error: { code: 'TOO_MANY_CONNECTIONS', message: 'SSE connection limit reached' },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      eventBus.registerConnection(clientIp);

      function sendEvent(event: string, data: unknown) {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed — safe to ignore
        }
      }

      // Initial heartbeat
      controller.enqueue(encoder.encode(': heartbeat\n\n'));

      // Heartbeat interval (keep-alive every 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Task event listeners
      const taskHandlers: Record<TaskEventType, (data: unknown) => void> = {
        task_created: (data) => sendEvent('task_created', data),
        task_updated: (data) => sendEvent('task_updated', data),
        task_deleted: (data) => sendEvent('task_deleted', data),
      };

      // Project event listeners
      const projectHandlers: Record<ProjectEventType, (data: unknown) => void> = {
        project_created: (data) => sendEvent('project_created', data),
        project_updated: (data) => sendEvent('project_updated', data),
        project_deleted: (data) => sendEvent('project_deleted', data),
      };

      for (const [event, handler] of Object.entries(taskHandlers)) {
        eventBus.on(event, handler);
      }
      for (const [event, handler] of Object.entries(projectHandlers)) {
        eventBus.on(event, handler);
      }

      // Cleanup on abort
      const cleanup = () => {
        clearInterval(heartbeat);
        for (const [event, handler] of Object.entries(taskHandlers)) {
          eventBus.off(event, handler);
        }
        for (const [event, handler] of Object.entries(projectHandlers)) {
          eventBus.off(event, handler);
        }
        eventBus.unregisterConnection(clientIp);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
