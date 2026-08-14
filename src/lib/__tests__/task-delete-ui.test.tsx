import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Task, UserRole } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

const mockTask: Task = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  projectId: 'proj-1',
  subprojectId: null,
  title: 'Delete Me Task',
  description: 'To be deleted',
  status: 'in_work',
  priority: 'medium',
  assignee: 'Bob',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ─── TaskCard — admin-only Delete button ──────────────────────────────────

describe('TaskCard — admin-only Delete button', () => {
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderWithAdmin(isAdmin: boolean) {
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
    return render(<TaskCard task={mockTask} onDelete={mockOnDelete} />);
  }

  it('shows Delete button when isAdmin=true', async () => {
    const { container } = await renderWithAdmin(true);
    expect(container.querySelector('[aria-label*="Delete task"]')).toBeInTheDocument();
  });

  it('hides Delete button when isAdmin=false (stakeholder)', async () => {
    const { container } = await renderWithAdmin(false);
    expect(container.querySelector('[aria-label*="Delete task"]')).not.toBeInTheDocument();
  });

  it('Delete button calls onDelete callback with task when clicked', async () => {
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
    const { container } = render(<TaskCard task={mockTask} onDelete={mockOnDelete} />);

    const deleteBtn = container.querySelector('[aria-label*="Delete task"]') as HTMLButtonElement;
    expect(deleteBtn).toBeInTheDocument();
    deleteBtn.click();
    expect(mockOnDelete).toHaveBeenCalledWith(mockTask);
  });

  it('hides Delete button when onDelete prop is not provided (even for admin)', async () => {
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

    expect(container.querySelector('[aria-label*="Delete task"]')).not.toBeInTheDocument();
  });

  it('shows both Edit and Delete buttons for admin when both props provided', async () => {
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
    const mockOnEdit = vi.fn();
    const { container } = render(
      <TaskCard task={mockTask} onEdit={mockOnEdit} onDelete={mockOnDelete} />,
    );

    expect(container.querySelector('[aria-label*="Edit task"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-label*="Delete task"]')).toBeInTheDocument();
  });
});

// ─── DeleteTaskModal — rendering ──────────────────────────────────────────

describe('DeleteTaskModal — rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders confirmation message with task title', async () => {
    vi.resetModules();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    render(
      <DeleteTaskModal
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/Delete Me Task/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it('renders Cancel and Delete buttons', async () => {
    vi.resetModules();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    render(
      <DeleteTaskModal
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not render when task is null', async () => {
    vi.resetModules();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    const { container } = render(
      <DeleteTaskModal
        task={null}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('does not render when isOpen is false', async () => {
    vi.resetModules();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    const { container } = render(
      <DeleteTaskModal
        task={mockTask}
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // ModalWrapper returns null when !isOpen
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('calls onConfirm when Delete button is clicked', async () => {
    vi.resetModules();
    const onConfirm = vi.fn();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    render(
      <DeleteTaskModal
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    screen.getByText('Delete').click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    vi.resetModules();
    const onClose = vi.fn();
    const { DeleteTaskModal } = await import('@/app/components/modals/DeleteTaskModal');

    render(
      <DeleteTaskModal
        task={mockTask}
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    screen.getByText('Cancel').click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ─── deleteTask — app-context integration ─────────────────────────────────

describe('deleteTask — app-context optimistic pattern', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('source code: deleteTask uses optimistic remove + rollback on error', () => {
    const ctxPath = path.join(__dirname, '..', 'context', 'app-context.tsx');
    const src = fs.readFileSync(ctxPath, 'utf-8');

    // Optimistic remove
    expect(src).toContain('removeTaskOptimistic(taskId)');
    // DELETE API call
    expect(src).toContain("method: 'DELETE'");
    expect(src).toContain('/api/tasks/${taskId}');
    // Rollback on error
    expect(src).toContain('Rollback');
    // Exports deleteTask in interface
    expect(src).toContain('deleteTask: (taskId: string) => Promise<void>');
  });

  it('source code: deleteTask is exported in context value', () => {
    const ctxPath = path.join(__dirname, '..', 'context', 'app-context.tsx');
    const src = fs.readFileSync(ctxPath, 'utf-8');

    // Must appear in the value object
    expect(src).toMatch(/value.*deleteTask/s);
  });
});

// ─── Source code verification — TSK-021 features ──────────────────────────

describe('TSK-021 — source code verification', () => {
  it('DeleteTaskModal.tsx exists', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'DeleteTaskModal.tsx');
    expect(fs.existsSync(modalPath)).toBe(true);
  });

  it('DeleteTaskModal uses ModalWrapper', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'DeleteTaskModal.tsx');
    const src = fs.readFileSync(modalPath, 'utf-8');
    expect(src).toContain('ModalWrapper');
    expect(src).toContain("title=\"Delete Task\"");
  });

  it('DeleteTaskModal focuses Cancel button (WCAG safe default)', () => {
    const modalPath = path.join(__dirname, '..', '..', 'app', 'components', 'modals', 'DeleteTaskModal.tsx');
    const src = fs.readFileSync(modalPath, 'utf-8');
    expect(src).toContain('cancelRef');
    expect(src).toContain('cancelRef.current?.focus()');
  });

  it('TaskCard has conditional isAdmin && onDelete render', () => {
    const cardPath = path.join(__dirname, '..', '..', 'app', 'components', 'kanban', 'TaskCard.tsx');
    const src = fs.readFileSync(cardPath, 'utf-8');
    expect(src).toContain('onDelete?: (task: Task) => void');
    expect(src).toContain('{isAdmin && onDelete &&');
  });

  it('KanbanBoard imports DeleteTaskModal', () => {
    const boardPath = path.join(__dirname, '..', '..', 'app', 'components', 'kanban', 'KanbanBoard.tsx');
    const src = fs.readFileSync(boardPath, 'utf-8');
    expect(src).toContain('DeleteTaskModal');
    expect(src).toContain('deletingTask');
    expect(src).toContain('deleteTask');
  });

  it('KanbanColumn threads onDelete prop', () => {
    const colPath = path.join(__dirname, '..', '..', 'app', 'components', 'kanban', 'KanbanColumn.tsx');
    const src = fs.readFileSync(colPath, 'utf-8');
    expect(src).toContain('onDelete?: (task: Task) => void');
    expect(src).toContain('onDelete={onDelete}');
  });
});
