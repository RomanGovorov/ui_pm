'use client';

import { useState, type FormEvent } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useAppContext } from '@/lib/context/app-context';
import type { Task, TaskStatus } from '@/lib/types';

interface CreateTaskModalProps {
  projectId: string;
  onClose: () => void;
}

/**
 * CreateTaskModal — form for creating a new task.
 * Uses optimistic update + rollback on error.
 */
export function CreateTaskModal({ projectId, onClose }: CreateTaskModalProps) {
  const { addToast, addTaskOptimistic, removeTaskOptimistic } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [status, setStatus] = useState<TaskStatus>('in_work');
  const [assignee, setAssignee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (title.trim().length > 200) newErrors.title = 'Title must be under 200 characters';
    if (!assignee.trim()) newErrors.assignee = 'Assignee is required';
    if (assignee.trim().length > 100) newErrors.assignee = 'Assignee must be under 100 characters';
    if (description.length > 2000) newErrors.description = 'Description must be under 2000 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Optimistic update
    const optimisticTask: Task = {
      id: `temp-${Date.now()}`,
      projectId,
      subprojectId: null,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assignee: assignee.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addTaskOptimistic(optimisticTask);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'ui-internal-call',
        },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assignee: assignee.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to create task');
      }

      // Remove optimistic task (real one will arrive via SSE)
      removeTaskOptimistic(optimisticTask.id);
      addToast('success', 'Task created successfully');
      onClose();
    } catch (err) {
      // Rollback optimistic update
      removeTaskOptimistic(optimisticTask.id);
      addToast('error', err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalWrapper title="Create Task" isOpen onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Title */}
        <div>
          <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-text-secondary">
            Title <span className="text-accent-red">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.title ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.title && (
            <p id="task-title-error" className="mt-1 text-xs text-accent-red" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-desc" className="mb-1 block text-sm font-medium text-text-secondary">
            Description
          </label>
          <textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            aria-invalid={!!errors.description}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.description ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-accent-red" role="alert">
              {errors.description}
            </p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="task-priority" className="mb-1 block text-sm font-medium text-text-secondary">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="task-status" className="mb-1 block text-sm font-medium text-text-secondary">
            Status
          </label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
          >
            <option value="in_work">In Work</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label htmlFor="task-assignee" className="mb-1 block text-sm font-medium text-text-secondary">
            Assignee <span className="text-accent-red">*</span>
          </label>
          <input
            id="task-assignee"
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Assignee name"
            aria-invalid={!!errors.assignee}
            aria-describedby={errors.assignee ? 'task-assignee-error' : undefined}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.assignee ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.assignee && (
            <p id="task-assignee-error" className="mt-1 text-xs text-accent-red" role="alert">
              {errors.assignee}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
