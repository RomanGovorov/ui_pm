import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Task, Project } from '@/lib/types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUpdateTaskOptimistic = vi.fn();
const mockAddToast = vi.fn();
const mockAddTaskOptimistic = vi.fn();
const mockRemoveTaskOptimistic = vi.fn();

vi.mock('@/lib/context/app-context', () => ({
  useAppContext: () => ({
    projects: [
      { id: 'proj-1', name: 'Project Alpha', description: null, createdAt: '', updatedAt: '' },
      { id: 'proj-2', name: 'Project Beta', description: null, createdAt: '', updatedAt: '' },
    ] as Project[],
    addToast: mockAddToast,
    updateTaskOptimistic: mockUpdateTaskOptimistic,
    addTaskOptimistic: mockAddTaskOptimistic,
    removeTaskOptimistic: mockRemoveTaskOptimistic,
  }),
}));

vi.mock('@/lib/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

// ─── Test data ──────────────────────────────────────────────────────────────

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

// ─── CreateTaskModal — comprehensive tests ─────────────────────────────────

describe('CreateTaskModal — status dropdown', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders status dropdown with default "in_work"', async () => {
    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe('in_work');
  });

  it('shows all 3 status options: in_work, review, done', async () => {
    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    const options = Array.from(statusSelect.options).map((o) => o.value);
    expect(options).toContain('in_work');
    expect(options).toContain('review');
    expect(options).toContain('done');
  });

  it('status dropdown changes value on selection', async () => {
    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'review' } });
    expect(statusSelect.value).toBe('review');

    fireEvent.change(statusSelect, { target: { value: 'done' } });
    expect(statusSelect.value).toBe('done');
  });

  it('create submission includes status in POST body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-task-id' }),
    } as Response);

    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'New task');
    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Bob');

    // Select status = review
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'review' } });

    // Submit
    await userEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"status":"review"'),
      }));
    });
  });

  it('create submission defaults status to in_work when not changed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-task-id' }),
    } as Response);

    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'Default status task');
    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Charlie');

    await userEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"status":"in_work"'),
      }));
    });
  });

  it('creates optimistic task before API call', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-task-id' }),
    } as Response);

    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'Optimistic task');
    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Diana');

    // Trigger submit
    fireEvent.click(screen.getByText('Create'));

    // Optimistic add should be called BEFORE API returns
    expect(mockAddTaskOptimistic).toHaveBeenCalled();
    const addedTask = mockAddTaskOptimistic.mock.calls[0][0] as Task;
    expect(addedTask.projectId).toBe('proj-1');
    expect(addedTask.status).toBe('in_work');
    expect(addedTask.title).toBe('Optimistic task');
  });

  it('removes optimistic task on successful create', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-task-id' }),
    } as Response);

    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'Finish task');
    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Eve');
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockRemoveTaskOptimistic).toHaveBeenCalled();
    });
  });

  it('rolls back optimistic task on failed create', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Duplicate title' } }),
    } as Response);

    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'Error task');
    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Frank');
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockRemoveTaskOptimistic).toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith('error', expect.stringContaining('Duplicate'));
    });
  });

  it('validation prevents submit with empty title', async () => {
    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Assignee/i), 'Grace');
    await userEvent.click(screen.getByText('Create'));

    // Should NOT call fetch (validation blocks it)
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('validation prevents submit with empty assignee', async () => {
    const { CreateTaskModal: CTM } = await import('@/app/components/modals/CreateTaskModal');
    render(<CTM projectId="proj-1" onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Title/i), 'Validation task');
    await userEvent.click(screen.getByText('Create'));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Assignee is required')).toBeInTheDocument();
  });
});

// ─── EditTaskModal Integration Tests ────────────────────────────────────────

describe('EditTaskModal — edit flow integration', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('changes status and submits updated values', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockTask, status: 'review' }),
    } as Response);

    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    // Change status from in_work → review
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'review' } });

    // Save
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateTaskOptimistic).toHaveBeenCalledWith(
        mockTask.id,
        expect.objectContaining({ status: 'review' }),
      );
      // Also verify PUT was called
      const putCalls = global.fetch.mock.calls.filter(
        (call) => call[1]?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });

  it('PUT body includes only changed fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockTask, status: 'done' }),
    } as Response);

    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    // Only change status, leave title/desc/assignee untouched
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'done' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      // Find the PUT call (ignoring the GET for subprojects fetched by useEffect)
      const putCalls = global.fetch.mock.calls.filter(
        (call) => call[1]?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(putCalls[0][1].body as string);
      expect(body).toHaveProperty('status', 'done');
      // Title, assignee should NOT be included since they were not changed
      expect(body).not.toHaveProperty('title', expect.anything());
      expect(body).not.toHaveProperty('assignee', expect.anything());
    });
  });

  it('skips API call when nothing changed', async () => {
    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    // No edits — click Save directly
    fireEvent.click(screen.getByText('Save Changes'));

    // No PUT call should be made (but subproject GET may fire from useEffect)
    const putCalls = global.fetch.mock.calls.filter(
      (call) => call[1]?.method === 'PUT',
    );
    expect(putCalls.length).toBe(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('rolls back optimistic update on PUT failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'done' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      // Rollback: restore original task
      expect(mockUpdateTaskOptimistic).toHaveBeenNthCalledWith(
        2,
        mockTask.id,
        expect.objectContaining({ status: 'in_work' }),
      );
    });
  });

  it('handles 409 conflict with rollback and toast', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Concurrent update conflict' } }),
    } as Response);

    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'done' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('error', 'Concurrent update conflict');
      // Original state restored (2nd call — first was optimistic update)
      expect(mockUpdateTaskOptimistic).toHaveBeenNthCalledWith(
        2,
        mockTask.id,
        expect.objectContaining({ status: 'in_work' }),
      );
    });
  });

  it('submits PUT with X-API-Key header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockTask }),
    } as Response);

    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={mockTask} onClose={onClose} />);

    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'review' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      // Find the PUT call (ignoring subproject GET)
      const putCalls = global.fetch.mock.calls.filter(
        (call) => call[1]?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
      expect(putCalls[0][0]).toBe(`/api/tasks/${mockTask.id}`);
      expect(putCalls[0][1]).toEqual(expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'ui-internal-call' }),
      }));
    });
  });

  it('pre-fills all fields correctly from task prop', async () => {
    const complexTask: Task = {
      ...mockTask,
      status: 'review',
      priority: 'low',
      assignee: 'Test Assignee',
      description: 'Complex description here',
    };
    const { EditTaskModal } = await import('@/app/components/modals/EditTaskModal');
    render(<EditTaskModal task={complexTask} onClose={onClose} />);

    expect(screen.getByDisplayValue('Complex description here')).toBeInTheDocument();
    const statusSelect = screen.getByLabelText(/Status/i) as HTMLSelectElement;
    expect(statusSelect.value).toBe('review');
    const prioritySelect = screen.getByLabelText(/Priority/i) as HTMLSelectElement;
    expect(prioritySelect.value).toBe('low');
    expect(screen.getByDisplayValue('Test Assignee')).toBeInTheDocument();
  });
});
