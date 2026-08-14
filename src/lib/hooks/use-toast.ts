'use client';

import { useState, useCallback, useRef } from 'react';
import type { Toast } from '@/lib/types';

interface UseToastReturn {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: Toast['type'], message: string) => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      const toast: Toast = { id, type, message };

      setToasts((prev) => {
        // Max 3 visible toasts
        const next = [...prev, toast];
        return next.length > 3 ? next.slice(-3) : next;
      });

      // Auto-dismiss after 5 seconds
      setTimeout(() => removeToast(id), 5000);
    },
    [removeToast],
  );

  return { toasts, addToast, removeToast };
}
