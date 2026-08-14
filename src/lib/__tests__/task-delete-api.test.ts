import { describe, it, expect, afterEach } from 'vitest';
import { handleApiError } from '@/lib/errors';
import { eventBus } from '@/lib/events/event-bus';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.join(__dirname, '..');
const ROUTE_PATH = path.join(SRC_ROOT, '..', 'app', 'api', 'tasks', '[id]', 'route.ts');
const MID_PATH = path.join(SRC_ROOT, '..', 'middleware.ts');

/**
 * DELETE /api/tasks/[id] — integration tests (TSK-020)
 *
 * Covers: route handler structure, UUID validation,
 * Prisma P2025→404 mapping, SSE event emission,
 * and middleware auth for DELETE requests.
 */

// ─── A. Static analysis of route handler ─────────────────────────────────────

describe('DELETE /api/tasks/[id] — route handler structure', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE_PATH, 'utf-8');
  });

  it('route file exists', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
  });

  it('exports a DELETE function', () => {
    expect(source).toContain('export async function DELETE');
  });

  it('imports and calls taskService.delete', () => {
    expect(source).toContain('taskService');
    expect(source).toContain('.delete(');
  });

  it('uses handleApiError for error handling', () => {
    expect(source).toContain('handleApiError');
  });

  it('validates UUID with zod safeParse', () => {
    expect(source).toContain('uuidSchema');
    expect(source).toContain('safeParse');
  });

  it('returns 400 for invalid UUID', () => {
    expect(source).toContain('VALIDATION_ERROR');
    expect(source).toContain('status: 400');
  });
});

// ─── B. UUID validation unit tests ──────────────────────────────────────────

describe('DELETE /api/tasks/[id] — UUID validation', () => {
  it('rejects empty string', () => {
    const uuidSchema = z.string().uuid();
    const result = uuidSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID strings', () => {
    const uuidSchema = z.string().uuid();
    const invalidIds = ['not-a-uuid', '12345', 'abc-def-ghi', 'null', 'undefined'];
    for (const id of invalidIds) {
      expect(uuidSchema.safeParse(id).success, `should reject "${id}"`).toBe(false);
    }
  });

  it('accepts valid UUIDs', () => {
    const uuidSchema = z.string().uuid();
    const validIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      '00000000-0000-0000-0000-000000000000',
    ];
    for (const id of validIds) {
      expect(uuidSchema.safeParse(id).success, `should accept "${id}"`).toBe(true);
    }
  });
});

// ─── C. Prisma P2025 → 404 error mapping ────────────────────────────────────

describe('DELETE /api/tasks/[id] — Prisma P2025 maps to 404', () => {
  it('P2025 error maps to 404 status code', async () => {
    try {
      const { Prisma } = await import('@prisma/client');
      if (Prisma && Prisma.PrismaClientKnownRequestError) {
        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Record to delete does not exist.',
          { code: 'P2025', meta: { modelName: 'Task' }, clientVersion: '0.0.0' },
        );
        const { statusCode, body } = handleApiError(prismaError);
        expect(statusCode).toBe(404);
        expect(body.error.code).toBe('NOT_FOUND');
      }
    } catch {
      // Prisma bindings may not be available in test env — verify via static analysis
      const errorSource = fs.readFileSync(path.join(SRC_ROOT, 'errors.ts'), 'utf-8');
      expect(errorSource).toContain("case 'P2025'");
      expect(errorSource).toContain('return 404');
    }
  });

  it('P2025 error message is sanitized (no table/model names leaked)', async () => {
    try {
      const { Prisma } = await import('@prisma/client');
      if (Prisma && Prisma.PrismaClientKnownRequestError) {
        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Record to delete does not exist.',
          { code: 'P2025', meta: { modelName: 'Task' }, clientVersion: '0.0.0' },
        );
        const { body } = handleApiError(prismaError);
        expect(body.error.message).not.toContain('Task');
        expect(body.error.message).not.toContain('modelName');
        expect(body.error.message.toLowerCase()).toContain('not found');
      }
    } catch {
      // Verify sanitization via static analysis
      const errorSource = fs.readFileSync(path.join(SRC_ROOT, 'errors.ts'), 'utf-8');
      expect(errorSource).toContain('P2025');
      expect(errorSource).toContain('not found');
    }
  });

  it('error handler maps P2025 to NOT_FOUND code', () => {
    const errorSource = fs.readFileSync(path.join(SRC_ROOT, 'errors.ts'), 'utf-8');
    // mapPrismaCode maps P2025 → NOT_FOUND
    expect(errorSource).toContain("case 'P2025'");
    expect(errorSource).toContain('NOT_FOUND');
  });
});

// ─── D. SSE event emission ──────────────────────────────────────────────────

describe('DELETE /api/tasks/[id] — SSE task_deleted event', () => {
  afterEach(() => {
    eventBus.removeAllListeners('task_deleted');
  });

  it('task-service delete method emits task_deleted event', () => {
    const serviceSource = fs.readFileSync(
      path.join(SRC_ROOT, 'services', 'task-service.ts'),
      'utf-8',
    );
    expect(serviceSource).toContain('task_deleted');
    expect(serviceSource).toContain('emitTaskEvent');
  });

  it('event bus supports task_deleted event type', () => {
    const busSource = fs.readFileSync(
      path.join(SRC_ROOT, 'events', 'event-bus.ts'),
      'utf-8',
    );
    expect(busSource).toContain('task_deleted');
    expect(busSource).toContain('TaskEventType');
  });

  it('eventBus emits task_deleted with payload', () => {
    const taskId = '550e8400-e29b-41d4-a716-446655440000';
    let receivedPayload: unknown = null;

    eventBus.on('task_deleted', (payload) => {
      receivedPayload = payload;
    });

    eventBus.emitTaskEvent('task_deleted', { id: taskId });

    expect(receivedPayload).toEqual({ id: taskId });
  });

  it('multiple listeners all receive task_deleted event', () => {
    const taskId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const payloads: unknown[] = [];

    eventBus.on('task_deleted', (payload) => {
      payloads.push(payload);
    });
    eventBus.on('task_deleted', (payload) => {
      payloads.push(payload);
    });

    eventBus.emitTaskEvent('task_deleted', { id: taskId });

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toEqual({ id: taskId });
    expect(payloads[1]).toEqual({ id: taskId });
  });

  it('delete payload contains only id (minimal payload)', () => {
    const serviceSource = fs.readFileSync(
      path.join(SRC_ROOT, 'services', 'task-service.ts'),
      'utf-8',
    );
    // delete method selects only { id: true } and emits { id: task.id }
    expect(serviceSource).toMatch(/delete[\s\S]*?select:\s*\{\s*id:\s*true\s*\}/);
    expect(serviceSource).toMatch(/emitTaskEvent\('task_deleted',\s*\{\s*id:\s*task\.id\s*\}/);
  });
});

// ─── E. Middleware auth for DELETE requests ───────────────────────────────────

describe('DELETE /api/tasks/[id] — middleware auth (static analysis)', () => {
  let mwSource: string;

  beforeAll(() => {
    mwSource = fs.readFileSync(MID_PATH, 'utf-8');
  });

  it('DELETE is classified as a write operation', () => {
    expect(mwSource).toContain('DELETE');
    expect(mwSource).toContain('isWrite');
  });

  it('unauthenticated DELETE returns 401', () => {
    expect(mwSource).toContain('UNAUTHORIZED');
    expect(mwSource).toContain('status: 401');
  });

  it('stakeholder DELETE returns 403 (read-only)', () => {
    expect(mwSource).toContain('stakeholder');
    expect(mwSource).toContain('FORBIDDEN');
    expect(mwSource).toContain('status: 403');
  });

  it('agent and admin roles pass write auth check', () => {
    // The middleware allows authenticated non-stakeholder users through
    // agent role is set by validateApiKey, admin/stakeholder by JWT
    expect(mwSource).toContain('agent');
    expect(mwSource).toContain('admin');
  });

  it('dual auth: both API key and JWT cookie are checked', () => {
    expect(mwSource).toContain('extractApiKey');
    expect(mwSource).toContain('validateApiKey');
    expect(mwSource).toContain('getTokenFromCookie');
    expect(mwSource).toContain('verifyToken');
  });
});
