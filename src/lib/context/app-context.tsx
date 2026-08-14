'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useSSE } from '@/lib/hooks/use-sse';
import { useTheme } from '@/lib/hooks/use-theme';
import { useToast } from '@/lib/hooks/use-toast';
import type { Task, Project, SSEEventType, Toast } from '@/lib/types';

interface AppState {
  projects: Project[];
  tasks: Task[];
  currentProjectId: string | null;
  isOnline: boolean;
  theme: 'dark' | 'light';
  toasts: Toast[];
  loading: boolean;
}

interface AppContextValue extends AppState {
  setProjects: (projects: Project[]) => void;
  setTasks: (tasks: Task[]) => void;
  setCurrentProjectId: (id: string | null) => void;
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
  toggleTheme: () => void;
  addTaskOptimistic: (task: Task) => void;
  removeTaskOptimistic: (taskId: string) => void;
  updateTaskOptimistic: (taskId: string, updates: Partial<Task>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  const handleSSEEvent = useCallback(
    (type: SSEEventType, payload: unknown) => {
      switch (type) {
        case 'task_created': {
          const task = payload as Task;
          setTasks((prev) => {
            if (prev.some((t) => t.id === task.id)) return prev;
            return [...prev, task];
          });
          addToast('info', `Task "${(task as Task).title}" created`);
          break;
        }
        case 'task_updated': {
          const updated = payload as Task;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
          );
          addToast('info', `Task "${(updated as Task).title}" updated`);
          break;
        }
        case 'task_deleted': {
          const { id } = payload as { id: string };
          setTasks((prev) => prev.filter((t) => t.id !== id));
          addToast('info', 'Task deleted');
          break;
        }
        case 'project_created': {
          const project = payload as Project;
          setProjects((prev) => {
            if (prev.some((p) => p.id === project.id)) return prev;
            return [...prev, project];
          });
          addToast('success', `Project "${(project as Project).name}" created`);
          break;
        }
        case 'project_updated': {
          const updated = payload as Project;
          setProjects((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
          );
          break;
        }
        case 'project_deleted': {
          const { id } = payload as { id: string };
          setProjects((prev) => prev.filter((p) => p.id !== id));
          addToast('info', 'Project deleted');
          break;
        }
      }
    },
    [addToast],
  );

  const { isOnline } = useSSE(handleSSEEvent);

  const addTaskOptimistic = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const removeTaskOptimistic = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const updateTaskOptimistic = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    );
  }, []);

  const value: AppContextValue = {
    projects,
    tasks,
    currentProjectId,
    isOnline,
    theme,
    toasts,
    loading,
    setProjects: (p) => {
      setProjects(p);
      setLoading(false);
    },
    setTasks: (t) => {
      setTasks(t);
      setLoading(false);
    },
    setCurrentProjectId,
    addToast,
    removeToast,
    toggleTheme,
    addTaskOptimistic,
    removeTaskOptimistic,
    updateTaskOptimistic,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
