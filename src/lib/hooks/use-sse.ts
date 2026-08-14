'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SSEEventType } from '@/lib/types';

interface UseSSEReturn {
  isOnline: boolean;
  lastEvent: { type: SSEEventType; payload: unknown } | null;
}

export function useSSE(
  onEvent: (type: SSEEventType, payload: unknown) => void,
): UseSSEReturn {
  const [isOnline, setIsOnline] = useState(false);
  const [lastEvent, setLastEvent] = useState<UseSSEReturn['lastEvent']>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => setIsOnline(true);
      es.onerror = () => {
        setIsOnline(false);
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      const eventTypes: SSEEventType[] = [
        'task_created',
        'task_updated',
        'task_deleted',
        'project_created',
        'project_updated',
        'project_deleted',
      ];

      for (const eventType of eventTypes) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data) as unknown;
            setLastEvent({ type: eventType, payload });
            onEventRef.current(eventType, payload);
          } catch {
            console.warn(`Failed to parse SSE event: ${eventType}`);
          }
        });
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      es?.close();
      eventSourceRef.current = null;
    };
  }, []);

  return { isOnline, lastEvent };
}
