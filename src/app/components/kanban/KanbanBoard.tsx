'use client';

import { useMemo, useState, useCallback } from 'react';
import { useAppContext } from '@/lib/context/app-context';
import { KanbanColumn } from './KanbanColumn';
import { EditTaskModal } from '@/app/components/modals/EditTaskModal';
import { DeleteTaskModal } from '@/app/components/modals/DeleteTaskModal';
import type { Task, TaskStatus } from '@/lib/types';

const COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'backlog', title: 'Backlog', color: 'bg-purple-500' },
  { status: 'in_work', title: 'In Work', color: 'bg-blue-500' },
  { status: 'review', title: 'Review', color: 'bg-amber-500' },
  { status: 'done', title: 'Done', color: 'bg-green-500' },
];

/**
 * KanbanBoard — 4-column board grouping tasks by status.
 * UI-008: Shows skeleton loading state.
 */
export function KanbanBoard() {
  const { tasks, currentProjectId, loading, deleteTask } = useAppContext();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingTask(null);
  }, []);

  const handleDelete = useCallback((task: Task) => {
    setDeletingTask(task);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingTask(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTask) return;
    const taskId = deletingTask.id;
    setDeletingTask(null);
    await deleteTask(taskId);
  }, [deletingTask, deleteTask]);

  // PERF-OPT-001: Single-pass grouping via for..of instead of 3× .filter().
  // Reduces array iterations from 4n to 2n (1 filter + 1 loop).
  const grouped = useMemo(() => {
    const filtered = currentProjectId
      ? tasks.filter((t) => t.projectId === currentProjectId)
      : tasks;

    const result: Record<TaskStatus, Task[]> = {
      backlog: [],
      in_work: [],
      review: [],
      done: [],
    };
    for (const task of filtered) {
      result[task.status].push(task);
    }
    return result;
  }, [tasks, currentProjectId]);

  if (loading) {
    return (
      <div className="flex flex-1 gap-5 overflow-x-auto p-6" role="status" aria-label="Loading tasks">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-w-[280px] max-w-[380px] flex-1 flex-col">
            <div className="mb-4 h-6 w-24 skeleton rounded" />
            <div className="flex-1 space-y-3 rounded-xl border border-border-primary bg-bg-tertiary p-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="skeleton h-28 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!currentProjectId) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        <p className="text-sm">Select a project to view tasks</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 gap-5 overflow-x-auto p-6"
      role="region"
      aria-label="Kanban board"
    >
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          title={col.title}
          color={col.color}
          tasks={grouped[col.status]}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
      {editingTask && (
        <EditTaskModal task={editingTask} onClose={handleCloseEdit} />
      )}
      {deletingTask && (
        <DeleteTaskModal
          task={deletingTask}
          isOpen={!!deletingTask}
          onClose={handleCloseDelete}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
