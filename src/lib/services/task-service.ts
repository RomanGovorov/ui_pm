import { prisma } from '@/lib/db/client';
import { createTaskSchema, updateTaskSchema } from '@/lib/validators/task';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validators/task';
import { ApiError } from '@/lib/errors';
import { eventBus, toSSEPayload } from '@/lib/events/event-bus';

/** Select for full task data (includes description for card/modal) */
const fullSelect = {
  id: true,
  projectId: true,
  subprojectId: true,
  title: true,
  description: true,
  status: true as const,
  priority: true as const,
  assignee: true,
  createdAt: true,
  updatedAt: true,
};

/** Ordering per DATA-002: priority ASC, createdAt DESC */
const defaultOrderBy = [
  { priority: 'asc' as const },
  { createdAt: 'desc' as const },
];

export const taskService = {
  createSchema: createTaskSchema,
  updateSchema: updateTaskSchema,

  /** List tasks, optionally filtered by project and/or status */
  async list(filters: { projectId?: string; status?: string } = {}) {
    return prisma.task.findMany({
      where: {
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status as never }),
      },
      select: fullSelect,
      orderBy: defaultOrderBy,
    });
  },

  /** Get a single task by ID */
  async getById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      select: fullSelect,
    });
    if (!task) throw new ApiError(404, 'NOT_FOUND', 'Task not found');
    return task;
  },

  /** Create a new task, emit SSE event */
  async create(data: CreateTaskInput) {
    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        subprojectId: data.subprojectId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'backlog',
        priority: data.priority,
        assignee: data.assignee,
      },
      select: fullSelect,
    });
    eventBus.emitTaskEvent('task_created', toSSEPayload(task));
    return task;
  },

  /** Update an existing task, emit SSE event */
  async update(id: string, data: UpdateTaskInput) {
    // Filter out undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(cleanData).length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No fields to update');
    }

    const task = await prisma.task.update({
      where: { id },
      data: cleanData,
      select: fullSelect,
    });
    eventBus.emitTaskEvent('task_updated', toSSEPayload(task));
    return task;
  },

  /** Delete a task, emit SSE event with minimal payload */
  async delete(id: string) {
    const task = await prisma.task.delete({
      where: { id },
      select: { id: true },
    });
    eventBus.emitTaskEvent('task_deleted', { id: task.id });
    return task;
  },
};
