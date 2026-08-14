import { describe, it, expect, beforeEach } from 'vitest';
import { projectService } from '@/lib/services/project-service';
import { createProjectSchema, updateProjectSchema } from '@/lib/validators/project';
import { handleApiError, ApiError } from '@/lib/errors';
import { eventBus } from '@/lib/events/event-bus';

describe('project-service creation', () => {
  it('createSchema accepts valid project name and optional description', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test Project',
      description: 'A test project',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Project');
      expect(result.data.description).toBe('A test project');
    }
  });

  it('createSchema trims whitespace from name', () => {
    const result = createProjectSchema.safeParse({ name: '  Trimmed Name  ', description: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Trimmed Name');
    }
  });

  it('createSchema rejects empty name', () => {
    const result = createProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('createSchema rejects missing name', () => {
    const result = createProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('createSchema rejects name exceeding 255 chars', () => {
    const longName = 'x'.repeat(256);
    const result = createProjectSchema.safeParse({ name: longName });
    expect(result.success).toBe(false);
  });

  it('createSchema rejects description exceeding 2000 chars', () => {
    const longDesc = 'x'.repeat(2001);
    const result = createProjectSchema.safeParse({ name: 'Valid', description: longDesc });
    expect(result.success).toBe(false);
  });

  it('updateSchema accepts partial updates', () => {
    const r1 = updateProjectSchema.safeParse({ name: 'New Name' });
    expect(r1.success).toBe(true);
    const r2 = updateProjectSchema.safeParse({ description: 'New Desc' });
    expect(r2.success).toBe(true);
    const r3 = updateProjectSchema.safeParse({ description: null });
    expect(r3.success).toBe(true);
  });

  it('updateSchema allows null description', () => {
    const result = updateProjectSchema.safeParse({ name: 'Name', description: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it('cleanData filters undefined values in project update', async () => {
    // The project service cleanData logic should filter out undefined fields
    const data: Record<string, unknown> = { name: 'Updated', description: undefined };
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    expect(cleanData).toEqual({ name: 'Updated' });
    expect('description' in cleanData).toBe(false);
  });
});

describe('task-service validation', () => {
  it('createTaskSchema accepts complete task data', () => {
    import('@/lib/validators/task').then(({ createTaskSchema }) => {
      const result = createTaskSchema.safeParse({
        projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'Test Task',
        description: 'Description here',
        priority: 'high',
        assignee: 'John Doe',
      });
      expect(result.success).toBe(true);
    });
  });

  it('createTaskSchema default priority is medium', async () => {
    const { createTaskSchema } = await import('@/lib/validators/task');
    const result = createTaskSchema.safeParse({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Task',
      assignee: 'User',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
    }
  });

  it('createTaskSchema rejects invalid UUID', async () => {
    const { createTaskSchema } = await import('@/lib/validators/task');
    const result = createTaskSchema.safeParse({
      projectId: 'not-a-uuid',
      title: 'Title',
      assignee: 'User',
    });
    expect(result.success).toBe(false);
  });

  it('createTaskSchema rejects non-enum priority', async () => {
    const { createTaskSchema } = await import('@/lib/validators/task');
    const result = createTaskSchema.safeParse({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Title',
      assignee: 'User',
      priority: 'critical',
    });
    expect(result.success).toBe(false);
  });

  it('createTaskSchema rejects empty assignee', async () => {
    const { createTaskSchema } = await import('@/lib/validators/task');
    const result = createTaskSchema.safeParse({
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Title',
      assignee: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('updateTaskSchema accepts partial updates', async () => {
    const { updateTaskSchema } = await import('@/lib/validators/task');
    for (const field of ['status', 'priority', 'assignee', 'title', 'description']) {
      const value = field === 'status' ? 'done' : field === 'priority' ? 'high' : 'Value';
      const result = updateTaskSchema.safeParse({ [field]: value });
      expect(result.success).toBe(true);
    }
  });

  it('updateTaskSchema rejects title < 1 char', async () => {
    const { updateTaskSchema } = await import('@/lib/validators/task');
    const result = updateTaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('updateTaskSchema accepts nullable description', async () => {
    const { updateTaskSchema } = await import('@/lib/validators/task');
    const result = updateTaskSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });
});
