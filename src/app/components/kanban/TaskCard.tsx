'use client';

import { useMemo } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

/**
 * BUG-001 fix: Static class map — all Tailwind classes appear as complete literal
 * strings so the JIT scanner detects them. No dynamic `dark:` prefix construction.
 */
const PRIORITY_CLASSES: Record<string, string> = {
  high: 'dark:bg-red-900/30 dark:text-red-400 bg-red-100 text-red-700',
  medium: 'dark:bg-amber-900/30 dark:text-amber-400 bg-amber-100 text-amber-700',
  low: 'dark:bg-green-900/30 dark:text-green-400 bg-green-100 text-green-700',
};

const PRIORITY_DOTS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-green-500',
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-green-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-blue-600';
}

/**
 * TaskCard — individual task with priority badge, title, description, assignee.
 * UI-003: Visual hierarchy, UI-007: Priority text label + aria-hidden dot.
 * BUG-001: Static PRIORITY_CLASSES map (no dynamic dark: prefix).
 * PERF-OPT-002: useMemo for getAvatarColor and formatRelativeDate.
 */
export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const { isAdmin } = useAuth();
  const priorityClasses = PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES['medium']!;
  const dotColor = PRIORITY_DOTS[task.priority] ?? PRIORITY_DOTS['medium']!;

  // PERF-OPT-002: Memoize pure function results to avoid recalculation on every render
  const avatarColor = useMemo(() => getAvatarColor(task.assignee), [task.assignee]);
  const relativeDate = useMemo(() => formatRelativeDate(task.createdAt), [task.createdAt]);

  return (
    <article
      className="rounded-lg border border-border-primary bg-bg-secondary p-3.5 transition-all duration-150 hover:border-gray-600 hover:shadow-md"
      role="listitem"
      tabIndex={0}
      aria-label={`Task: ${task.title}, priority ${task.priority}, assigned to ${task.assignee}`}
    >
      {/* Priority Badge — static classes, JIT-safe */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${priorityClasses}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        {isAdmin && (onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {isAdmin && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                aria-label={`Edit task: ${task.title}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task)}
                className="rounded p-1 text-text-muted transition-colors hover:bg-bg-tertiary hover:text-accent-red"
                aria-label={`Delete task: ${task.title}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 text-sm font-semibold leading-snug text-text-primary line-clamp-1">
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="mb-3 text-xs text-text-secondary line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer: Assignee + Date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor}`}
            aria-hidden="true"
          >
            {getInitials(task.assignee)}
          </div>
          <span className="text-xs text-text-secondary">{task.assignee}</span>
        </div>
        <time
          className="text-[11px] text-text-muted"
          dateTime={task.createdAt}
          aria-label={`Created ${relativeDate}`}
        >
          {relativeDate}
        </time>
      </div>
    </article>
  );
}
