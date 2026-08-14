'use client';

import { useEffect, useCallback, useId, type ReactNode } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';

interface ModalWrapperProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * ModalWrapper — accessible modal shell.
 * UI-006: Focus trap, ESC close, scroll lock, aria-modal, aria-labelledby.
 */
export function ModalWrapper({
  title,
  isOpen,
  onClose,
  children,
}: ModalWrapperProps) {
  const titleId = useId();
  const containerRef = useFocusTrap(isOpen);

  // ESC key closes modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    // Body scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Set aria-hidden on root app
    const rootApp = document.getElementById('main-content');
    const prevAriaHidden = rootApp?.getAttribute('aria-hidden');
    rootApp?.setAttribute('aria-hidden', 'true');

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      if (rootApp) {
        if (typeof prevAriaHidden === 'string') {
          rootApp.setAttribute('aria-hidden', prevAriaHidden);
        } else {
          rootApp.removeAttribute('aria-hidden');
        }
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg rounded-lg border border-border-primary bg-bg-secondary p-6 shadow-lg"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
