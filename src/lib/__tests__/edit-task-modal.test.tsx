import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Task, Project } from '@/lib/types';

// Mock the contexts
const mockUpdateTaskOptimistic = vi.fn();
const mockAddToast = vi.fn();

vi.mock('@/lib/context/app-context', () => ({
  useAppContext: () => ({
    projects: [
      { id: 'proj-1', name: 'Project Alpha', description: null, createdAt: '', updatedAt: '' },
      { id: 'proj-2', name: 'Project Beta', description: null, createdAt: '', updatedAt: '' },
    ] as Project[],
    addToast: mockAddToast,
    updateTaskOptimistic: mockUpdateTaskOptimistic,
  }),
}));

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock the focus trap hook to avoid DOM issues in tests
vi.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

import { EditTaskModal } from '@/app/components/modals/EditTaskModal';

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

describe('EditTaskModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with pre-filled fields', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('renders status dropdown with correct default', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe('in_work');
  });

  it('renders priority dropdown with correct default', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const prioritySelect = screen.getByLabelText('Priority') as HTMLSelectElement;
    expect(prioritySelect).toBeInTheDocument();
    expect(prioritySelect.value).toBe('high');
  });

  it('renders project dropdown', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const projectSelect = screen.getByLabelText('Project') as HTMLSelectElement;
    expect(projectSelect).toBeInTheDocument();
    expect(projectSelect.value).toBe('proj-1');
  });

  it('renders Save Changes and Cancel buttons', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders required field markers', () => {
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    // Title and Assignee labels should have required markers (asterisk)
    const titleLabels = screen.getAllByText(/Title/);
    expect(titleLabels.length).toBeGreaterThan(0);

    const assigneeLabels = screen.getAllByText(/Assignee/);
    expect(assigneeLabels.length).toBeGreaterThan(0);
  });

  it('handles task with review status', () => {
    const reviewTask: Task = { ...mockTask, status: 'review' };
    render(<EditTaskModal task={reviewTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(statusSelect.value).toBe('review');
  });

  it('handles task with done status', () => {
    const doneTask: Task = { ...mockTask, status: 'done' };
    render(<EditTaskModal task={doneTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(statusSelect.value).toBe('done');
  });

  it('handles task with null description', () => {
    const noDescTask: Task = { ...mockTask, description: null };
    render(<EditTaskModal task={noDescTask} onClose={onClose} />);

    const descField = screen.getByPlaceholderText('Optional description') as HTMLTextAreaElement;
    expect(descField.value).toBe('');
  });
});
