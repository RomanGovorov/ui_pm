import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from '@/lib/validators/task';

describe('createTaskSchema', () => {
  const validInput = {
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test task',
    assignee: 'Alice',
    priority: 'high' as const,
  };

  it('accepts valid input', () => {
    const result = createTaskSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = createTaskSchema.safeParse({ ...validInput, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing assignee', () => {
    const result = createTaskSchema.safeParse({ ...validInput, assignee: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid projectId (not UUID)', () => {
    const result = createTaskSchema.safeParse({ ...validInput, projectId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      title: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('defaults priority to medium', () => {
    const result = createTaskSchema.safeParse({
      projectId: validInput.projectId,
      title: validInput.title,
      assignee: validInput.assignee,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
    }
  });

  it('rejects unknown priority value', () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      priority: 'urgent',
    });
    expect(result.success).toBe(false);
  });

  it('defaults status to backlog', () => {
    const result = createTaskSchema.safeParse({
      projectId: validInput.projectId,
      title: validInput.title,
      assignee: validInput.assignee,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('backlog');
    }
  });

  it('accepts explicit status values', () => {
    for (const status of ['backlog', 'in_work', 'review', 'done'] as const) {
      const result = createTaskSchema.safeParse({ ...validInput, status });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(status);
      }
    }
  });

  it('rejects invalid status value', () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      status: 'cancelled',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTaskSchema', () => {
  it('accepts partial updates', () => {
    const result = updateTaskSchema.safeParse({ status: 'review' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no changes)', () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateTaskSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts valid projectId (UUID)', () => {
    const result = updateTaskSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid projectId (not UUID)', () => {
    const result = updateTaskSchema.safeParse({ projectId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
