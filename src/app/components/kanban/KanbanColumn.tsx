'use client';

import type { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

/**
 * KanbanColumn — single status column with header and task cards.
 */
export function KanbanColumn({ status, title, color, tasks, onEdit, onDelete }: KanbanColumnProps) {
  const columnId = `column-${status}`;

  return (
    <section
      className="flex min-w-[280px] max-w-[380px] flex-1 flex-col"
      aria-labelledby={columnId}
    >
      {/* Column Header */}
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
        <h2
          id={columnId}
          className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          {title}
        </h2>
        <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-xs font-medium text-text-muted">
          {tasks.length}
        </span>
      </div>

      {/* Column Body */}
      <div
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border-primary bg-bg-tertiary p-3"
        role="list"
        aria-label={`${title} tasks`}
      >
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <svg
              className="mb-2 h-8 w-8 opacity-30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-xs">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />)
        )}
      </div>
    </section>
  );
}
