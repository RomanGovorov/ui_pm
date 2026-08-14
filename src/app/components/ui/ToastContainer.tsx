'use client';

import { useAppContext } from '@/lib/context/app-context';

const TYPE_STYLES: Record<string, string> = {
  info: 'border-l-blue-500 bg-blue-950/30 text-blue-300',
  success: 'border-l-green-500 bg-green-950/30 text-green-300',
  warning: 'border-l-amber-500 bg-amber-950/30 text-amber-300',
  error: 'border-l-red-500 bg-red-950/30 text-red-300',
};

/**
 * ToastContainer — renders toast notifications in aria-live region.
 * UI-004: Bottom-right, max 3, auto-dismiss 5s.
 */
export function ToastContainer() {
  const { toasts, removeToast } = useAppContext();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-slide-in-right flex items-center gap-2 rounded-lg border-l-4 px-4 py-3 shadow-lg ${TYPE_STYLES[toast.type] ?? TYPE_STYLES.info}`}
        >
          <span className="text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
