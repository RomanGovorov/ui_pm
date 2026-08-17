'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useAppContext } from '@/lib/context/app-context';
import type { Task, TaskStatus, TaskPriority, Subproject } from '@/lib/types';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
}

/**
 * EditTaskModal — form for editing an existing task.
 * Pre-fills all fields from the task, submits via PUT /api/tasks/[id].
 * Uses optimistic update + rollback on error.
 */
export function EditTaskModal({ task, onClose }: EditTaskModalProps) {
  const { projects, addToast, updateTaskOptimistic } = useAppContext();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee);
  const [projectId, setProjectId] = useState(task.projectId);
  const [subprojectId, setSubprojectId] = useState<string | null>(task.subprojectId);
  const [subprojects, setSubprojects] = useState<Subproject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch subprojects when project changes
  useEffect(() => {
    if (!projectId) {
      setSubprojects([]);
      return;
    }

    let cancelled = false;
    async function fetchSubprojects() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setSubprojects(data.subprojects ?? []);
        }
      } catch {
        // Network error — subprojects remain empty
      }
    }
    fetchSubprojects();
    return () => { cancelled = true; };
  }, [projectId]);

  // Reset subproject when project changes and current subproject is invalid
  useEffect(() => {
    if (subprojectId && subprojects.length > 0) {
      const stillValid = subprojects.some((sp) => sp.id === subprojectId);
      if (!stillValid) setSubprojectId(null);
    }
  }, [subprojects, subprojectId]);

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

    // Build partial update: only changed fields
    const updates: Record<string, unknown> = {};
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim() || null;
    const trimmedAssignee = assignee.trim();

    if (trimmedTitle !== task.title) updates.title = trimmedTitle;
    if (trimmedDesc !== task.description) updates.description = trimmedDesc;
    if (status !== task.status) updates.status = status;
    if (priority !== task.priority) updates.priority = priority;
    if (trimmedAssignee !== task.assignee) updates.assignee = trimmedAssignee;
    if (projectId !== task.projectId) updates.projectId = projectId;
    if (subprojectId !== task.subprojectId) updates.subprojectId = subprojectId;

    // If nothing changed, just close
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    // Optimistic update
    const originalTask = { ...task };
    updateTaskOptimistic(task.id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'ui-internal-call',
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to update task');
      }

      // SSE task_updated will replace optimistic task with real data
      addToast('success', 'Task updated successfully');
      onClose();
    } catch (err) {
      // Rollback optimistic update
      updateTaskOptimistic(task.id, originalTask);
      addToast('error', err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalWrapper title="Edit Task" isOpen onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Title */}
        <div>
          <label htmlFor="edit-task-title" className="mb-1 block text-sm font-medium text-text-secondary">
            Title <span className="text-accent-red">*</span>
          </label>
          <input
            id="edit-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'edit-task-title-error' : undefined}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.title ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.title && (
            <p id="edit-task-title-error" className="mt-1 text-xs text-accent-red" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="edit-task-desc" className="mb-1 block text-sm font-medium text-text-secondary">
            Description
          </label>
          <textarea
            id="edit-task-desc"
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

        {/* Status */}
        <div>
          <label htmlFor="edit-task-status" className="mb-1 block text-sm font-medium text-text-secondary">
            Status
          </label>
          <select
            id="edit-task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
          >
            <option value="backlog">Backlog</option>
            <option value="in_work">In Work</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="edit-task-priority" className="mb-1 block text-sm font-medium text-text-secondary">
            Priority
          </label>
          <select
            id="edit-task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label htmlFor="edit-task-assignee" className="mb-1 block text-sm font-medium text-text-secondary">
            Assignee <span className="text-accent-red">*</span>
          </label>
          <input
            id="edit-task-assignee"
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Assignee name"
            aria-invalid={!!errors.assignee}
            aria-describedby={errors.assignee ? 'edit-task-assignee-error' : undefined}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.assignee ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.assignee && (
            <p id="edit-task-assignee-error" className="mt-1 text-xs text-accent-red" role="alert">
              {errors.assignee}
            </p>
          )}
        </div>

        {/* Project */}
        <div>
          <label htmlFor="edit-task-project" className="mb-1 block text-sm font-medium text-text-secondary">
            Project
          </label>
          <select
            id="edit-task-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSubprojectId(null);
            }}
            className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Subproject */}
        {subprojects.length > 0 && (
          <div>
            <label htmlFor="edit-task-subproject" className="mb-1 block text-sm font-medium text-text-secondary">
              Subproject
            </label>
            <select
              id="edit-task-subproject"
              value={subprojectId ?? ''}
              onChange={(e) => setSubprojectId(e.target.value || null)}
              className="w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-blue"
            >
              <option value="">None</option>
              {subprojects.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>
        )}

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
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
