'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context/app-context';
import { useAuth } from '@/lib/context/auth-context';
import { CreateTaskModal } from '@/app/components/modals/CreateTaskModal';

/**
 * Header — current project info, stats, connection indicator, create task button.
 * Create Task button visible only for admin/agent (not stakeholder).
 */
export function Header() {
  const { projects, tasks, currentProjectId, isOnline } = useAppContext();
  const { user, isAdmin } = useAuth();
  const [showCreateTask, setShowCreateTask] = useState(false);

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
  const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);

  const inWorkCount = projectTasks.filter((t) => t.status === 'in_work').length;
  const reviewCount = projectTasks.filter((t) => t.status === 'review').length;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;

  const canCreateTask = isAdmin || user?.role === 'agent';

  return (
    <>
      <header
        role="banner"
        className="flex h-16 items-center justify-between border-b border-border-primary bg-bg-secondary px-6"
      >
        {/* Left: Project Info */}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {currentProject?.name ?? 'Select a project'}
          </h1>
          {currentProject?.description && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {currentProject.description}
            </p>
          )}
        </div>

        {/* Right: Stats + Connection + Create */}
        <div className="flex items-center gap-4">
          {/* Status counts */}
          <div className="flex items-center gap-3" aria-label="Task statistics">
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
              {inWorkCount}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              {reviewCount}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              {doneCount}
            </span>
          </div>

          {/* Connection indicator */}
          <div
            className="flex items-center gap-1.5 text-xs"
            aria-live="polite"
            aria-label={isOnline ? 'Connected' : 'Disconnected'}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? 'animate-pulse-dot bg-green-500' : 'bg-red-500'
              }`}
              aria-hidden="true"
            />
            <span className={isOnline ? 'text-text-muted' : 'text-accent-red'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Create Task Button — admin/agent only */}
          {currentProjectId && canCreateTask && (
            <button
              onClick={() => setShowCreateTask(true)}
              className="rounded-lg bg-accent-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              aria-label="Create new task"
            >
              + Create Task
            </button>
          )}
        </div>
      </header>

      {showCreateTask && currentProjectId && (
        <CreateTaskModal
          projectId={currentProjectId}
          onClose={() => setShowCreateTask(false)}
        />
      )}
    </>
  );
}
