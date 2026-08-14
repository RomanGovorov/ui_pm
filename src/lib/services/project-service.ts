import { prisma } from '@/lib/db/client';
import { createProjectSchema, updateProjectSchema } from '@/lib/validators/project';
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/validators/project';
import { ApiError } from '@/lib/errors';
import { eventBus } from '@/lib/events/event-bus';

export const projectService = {
  createSchema: createProjectSchema,
  updateSchema: updateProjectSchema,

  async list() {
    return prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        subprojects: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    return project;
  },

  async create(data: CreateProjectInput) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
    });
    eventBus.emitProjectEvent('project_created', {
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt,
    });
    return project;
  },

  async update(id: string, data: UpdateProjectInput) {
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
    const project = await prisma.project.update({
      where: { id },
      data: cleanData,
    });
    eventBus.emitProjectEvent('project_updated', {
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt,
    });
    return project;
  },

  async delete(id: string) {
    const project = await prisma.project.delete({
      where: { id },
      select: { id: true },
    });
    eventBus.emitProjectEvent('project_deleted', { id: project.id });
    return project;
  },
};
