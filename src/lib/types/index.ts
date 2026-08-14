export type TaskStatus = 'in_work' | 'review' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type UserRole = 'admin' | 'stakeholder' | 'agent';

export interface Task {
  id: string;
  projectId: string;
  subprojectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export interface Subproject {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: UserRole;
  createdAt: string;
}

/** Authenticated user returned from /api/auth/me */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export type SSEEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted';

export interface SSEEvent {
  type: SSEEventType;
  payload: unknown;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
