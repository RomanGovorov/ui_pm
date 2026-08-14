'use client';

import { useRef, useEffect } from 'react';
import { ModalWrapper } from './ModalWrapper';
import type { Task } from '@/lib/types';

interface DeleteTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * DeleteTaskModal — confirmation dialog for task deletion.
 * Cancel button receives initial focus (WCAG safe default — destructive action).
 * Uses ModalWrapper for focus trap, ESC close, and scroll lock.
 */
export function DeleteTaskModal({
  task,
  isOpen,
  onClose,
  onConfirm,
}: DeleteTaskModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel button on open (safe default for destructive actions)
  useEffect(() => {
    if (isOpen) {
      // Delay to allow ModalWrapper's focus trap to settle
      requestAnimationFrame(() => {
        cancelRef.current?.focus();
      });
    }
  }, [isOpen]);

  if (!task) return null;

  return (
    <ModalWrapper title="Delete Task" isOpen={isOpen} onClose={onClose}>
      <p className="mb-6 text-sm text-text-secondary">
        Are you sure you want to delete &ldquo;{task.title}&rdquo;? This action
        cannot be undone.
      </p>

      <div className="flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-accent-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </ModalWrapper>
  );
}
