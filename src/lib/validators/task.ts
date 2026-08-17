import { z } from 'zod';

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  subprojectId: z.string().uuid('Invalid subproject ID').nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['backlog', 'in_work', 'review', 'done']).default('backlog'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assignee: z.string().trim().min(1, 'Assignee is required').max(100),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['backlog', 'in_work', 'review', 'done']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assignee: z.string().trim().min(1).max(100).optional(),
  projectId: z.string().uuid('Invalid project ID').optional(),
  subprojectId: z.string().uuid().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
