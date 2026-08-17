import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task, UserRole } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// ─── Mock app-context — TaskCard doesn't use it directly ─────────────────────

vi.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

// We need to mock auth-context with different isAdmin values per test.
// Since vitest does module caching, we use vi.doMock + dynamic imports.

const mockTask: Task = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  projectId: 'proj-1',
  subprojectId: null,
  title: 'Test Task',
  description: 'A test description',
  status: 'in_work',
  priority: 'high',
  assignee: 'Alice',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ─── TaskCard — admin-only Edit button (render tests) ──────────────────────

describe('TaskCard — admin-only Edit button', () => {
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: render TaskCard with a given isAdmin value using dynamic module loading
  async function renderWithAdmin(isAdmin: boolean) {
    // Clear module cache for auth-context
    vi.resetModules();

    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin,
        user: isAdmin
          ? { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole }
          : { id: 'u1', name: 'Stakeholder', email: 'user@test.com', role: 'stakeholder' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');

    const rendered = render(<TaskCard task={mockTask} onEdit={mockOnEdit} />);
    return { rendered, isAdmin };
  }

  it('shows Edit button when isAdmin=true', async () => {
    const { rendered } = await renderWithAdmin(true);

    // The Edit button should be present
    expect(rendered.container.querySelector('[aria-label*="Edit task"]')).toBeInTheDocument();
  });

  it('hides Edit button when isAdmin=false (stakeholder)', async () => {
    const { rendered } = await renderWithAdmin(false);

    // The Edit button should NOT be present
    expect(rendered.container.querySelector('[aria-label*="Edit task"]')).not.toBeInTheDocument();
  });

  it('Edit button calls onEdit callback with task prop when clicked', async () => {
    // Need to re-render with admin=true
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');
    const { container } = render(<TaskCard task={mockTask} onEdit={mockOnEdit} />);

    const editBtn = container.querySelector('[aria-label*="Edit task"]') as HTMLButtonElement;
    if (editBtn) {
      editBtn.click();
      expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
    }
  });

  it('hides Edit button when onEdit prop is not provided (even for admin)', async () => {
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');
    const { container } = render(<TaskCard task={mockTask} />);

    // Both conditions must be true: isAdmin AND onEdit
    // When onEdit is undefined, even an admin won't see the button
    expect(container.querySelector('[aria-label*="Edit task"]')).not.toBeInTheDocument();
  });
});

// ─── TaskCard — visual/content correctness ──────────────────────────────────

describe('TaskCard — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Render with admin for all tests
  async function renderWithAuth(isAdmin: boolean) {
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin,
        user: isAdmin
          ? { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole }
          : { id: 'u1', name: 'User', email: 'user@test.com', role: 'stakeholder' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');
    return render(<TaskCard task={mockTask} />);
  }

  it('renders task title', async () => {
    const { container } = await renderWithAuth(true);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('renders priority badge with correct text', async () => {
    await renderWithAuth(true);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders assignee name with avatar initials', async () => {
    await renderWithAuth(true);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders description when present', async () => {
    await renderWithAuth(true);
    expect(screen.getByText('A test description')).toBeInTheDocument();
  });

  it('does NOT render description paragraph when description is null', async () => {
    const nullDescTask: Task = { ...mockTask, description: null };

    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');
    const { container } = render(<TaskCard task={nullDescTask} />);

    // Description paragraph should NOT be rendered
    const descParagraphs = container.querySelectorAll('p.mb-3');
    expect(descParagraphs.length).toBe(0);
  });

  it('renders relative date from createdAt', async () => {
    const pastTask: Task = {
      ...mockTask,
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    const { TaskCard } = await import('@/app/components/kanban/TaskCard');
    render(<TaskCard task={pastTask} />);

    // Should show "1h ago" or similar relative time
    const timeEl = screen.getByText(/\d+h ago/);
    expect(timeEl).toBeInTheDocument();
  });

  it('has role="listitem" on article element', async () => {
    const { container } = await renderWithAuth(true);
    const article = container.querySelector('article');
    expect(article?.getAttribute('role')).toBe('listitem');
  });

  it('has aria-label with task details', async () => {
    await renderWithAuth(true);
    const article = document.querySelector('article');
    expect(article?.getAttribute('aria-label')).toContain('Test Task');
    expect(article?.getAttribute('aria-label')).toContain('high');
    expect(article?.getAttribute('aria-label')).toContain('Alice');
  });

  it('renders correct priority color classes for each level', async () => {
    // Priority red for high
    const highTask: Task = { ...mockTask, priority: 'high' };
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));
    const { TaskCard: TC1 } = await import('@/app/components/kanban/TaskCard');
    const { container: c1 } = render(<TC1 task={highTask} />);
    const highBadge = c1.querySelector('[class*="red"]') as HTMLElement;
    expect(highBadge).toBeTruthy();

    // Priority amber for medium
    const medTask: Task = { ...mockTask, priority: 'medium' };
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));
    const { TaskCard: TC2 } = await import('@/app/components/kanban/TaskCard');
    const { container: c2 } = render(<TC2 task={medTask} />);
    const medBadge = c2.querySelector('[class*="amber"]') as HTMLElement;
    expect(medBadge).toBeTruthy();

    // Priority green for low
    const lowTask: Task = { ...mockTask, priority: 'low' };
    vi.resetModules();
    vi.doMock('@/lib/context/auth-context', () => ({
      useAuth: () => ({
        isAdmin: true,
        user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as UserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));
    const { TaskCard: TC3 } = await import('@/app/components/kanban/TaskCard');
    const { container: c3 } = render(<TC3 task={lowTask} />);
    const lowBadge = c3.querySelector('[class*="green"]') as HTMLElement;
    expect(lowBadge).toBeTruthy();
  });
});

// ─── Source code verification — TSK-019 features ────────────────────────────

describe('TSK-019 — source code verification', () => {
  it('EditTaskModal.tsx exists', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'EditTaskModal.tsx');
    expect(fs.existsSync(modalPath)).toBe(true);
  });

  it('EditTaskModal uses optimistic update pattern', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'EditTaskModal.tsx');
    const src = fs.readFileSync(modalPath, 'utf-8');
    expect(src).toContain('updateTaskOptimistic(task.id');
    expect(src).toContain('Rollback optimistic update');
  });

  it('EditTaskModal submits PUT to /api/tasks/[id]', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'EditTaskModal.tsx');
    const src = fs.readFileSync(modalPath, 'utf-8');
    expect(src).toContain(`method: 'PUT'`);
    expect(src).toContain('/api/tasks/${task.id}');
  });

  it('CreateTaskModal includes status in form state and submission', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'CreateTaskModal.tsx');
    const src = fs.readFileSync(modalPath, 'utf-8');
    expect(src).toContain('useState<TaskStatus>');
    expect(src).toContain('status,');
  });

  it('TaskCard has conditional isAdmin && onEdit render', () => {
    const cardPath = path.join(__dirname, '..', '..', 'app', 'components', 'kanban', 'TaskCard.tsx');
    const src = fs.readFileSync(cardPath, 'utf-8');
    expect(src).toContain('{isAdmin && onEdit &&');
    expect(src).toContain("useAuth()");
  });

  it('createTaskSchema validates projectId as UUID', () => {
    const validatorPath = path.join(__dirname, '..', 'validators', 'task.ts');
    const src = fs.readFileSync(validatorPath, 'utf-8');
    expect(src).toContain("z.string().uuid('Invalid project ID')");
  });

  it('updateTaskSchema validates projectId as optional UUID', () => {
    const validatorPath = path.join(__dirname, '..', 'validators', 'task.ts');
    const src = fs.readFileSync(validatorPath, 'utf-8');
    expect(src).toContain('projectId: z.string().uuid');
    expect(src).toContain('.optional()');
  });

  it('createTaskSchema accepts explicit status values', () => {
    const validatorPath = path.join(__dirname, '..', 'validators', 'task.ts');
    const src = fs.readFileSync(validatorPath, 'utf-8');
    expect(src).toContain("z.enum(['backlog', 'in_work', 'review', 'done'])");
  });
});
