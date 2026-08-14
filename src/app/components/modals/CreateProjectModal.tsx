'use client';

import { useState, type FormEvent } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useAppContext } from '@/lib/context/app-context';

interface CreateProjectModalProps {
  onClose: () => void;
}

/**
 * CreateProjectModal — form for creating a new project.
 */
export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const { addToast, setProjects, projects, setCurrentProjectId } = useAppContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Project name is required';
    if (name.trim().length > 255) newErrors.name = 'Name must be under 255 characters';
    if (description.length > 2000) newErrors.description = 'Description must be under 2000 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'ui-internal-call',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error?.message ?? 'Failed to create project');
      }

      const project = (await res.json()) as { id: string; name: string; description: string | null };
      setProjects([...projects, { ...project, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      setCurrentProjectId(project.id);
      addToast('success', `Project "${project.name}" created`);
      onClose();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalWrapper title="Create Project" isOpen onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name */}
        <div>
          <label htmlFor="project-name" className="mb-1 block text-sm font-medium text-text-secondary">
            Name <span className="text-accent-red">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'project-name-error' : undefined}
            className={`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-placeholder outline-none transition-colors ${
              errors.name ? 'border-accent-red' : 'border-border-primary focus:border-accent-blue'
            }`}
          />
          {errors.name && (
            <p id="project-name-error" className="mt-1 text-xs text-accent-red" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="project-desc" className="mb-1 block text-sm font-medium text-text-secondary">
            Description
          </label>
          <textarea
            id="project-desc"
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
