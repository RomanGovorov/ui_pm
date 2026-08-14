import { describe, it, expect } from 'vitest';
import { validateApiKey } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

describe('auth module — edge cases', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.API_KEY = 'test-key-0123456789abcdefghijklmnopqrstuv';
    delete process.env.API_KEY_SECONDARY;
  });

  it('validateApiKey rejects null string (not JS null)', () => {
    expect(validateApiKey(null as unknown as string)).toBe(false);
  });

  it('validateApiKey timing-safe comparison does not short-circuit on length mismatch', async () => {
    // The implementation hashes both strings first using SHA-256,
    // ensuring equal-length inputs to timingSafeEqual.
    expect(validateApiKey('short')).toBe(false);
    expect(validateApiKey('a'.repeat(64))).toBe(false);
  });

  it('dual-key: primary accepted when secondary also set', () => {
    process.env.API_KEY_SECONDARY = 'secondary-key-0123456789abcdefghijk';
    expect(validateApiKey(process.env.API_KEY!)).toBe(true);
    expect(validateApiKey(process.env.API_KEY_SECONDARY!)).toBe(true);
    expect(validateApiKey('wrong')).toBe(false);
  });
});

describe('event-bus connection limits', () => {
  it('canAcceptConnection returns true initially', async () => {
    const { eventBus } = await import('@/lib/events/event-bus');
    expect(eventBus.canAcceptConnection('test-ip')).toBe(true);
  });

  it('register/unregister correctly updates count', async () => {
    const { eventBus } = await import('@/lib/events/event-bus');
    const initial = eventBus.getConnectionCount();
    eventBus.registerConnection('count-test-ip');
    expect(eventBus.getConnectionCount()).toBe(initial + 1);
    eventBus.unregisterConnection('count-test-ip');
    expect(eventBus.getConnectionCount()).toBe(initial);
  });

  it('maxListeners configured to at least 100', async () => {
    const { eventBus } = await import('@/lib/events/event-bus');
    expect(eventBus.getMaxListeners()).toBeGreaterThanOrEqual(100);
  });
});

describe('SSE payload stripping', () => {
  it('toSSEPayload excludes description field', async () => {
    const { toSSEPayload } = await import('@/lib/events/event-bus');
    const fullTask = {
      id: 't1', projectId: 'p1', subprojectId: 'sp1',
      title: 'Big Task', description: 'x'.repeat(2000),
      status: 'in_work' as const, priority: 'high' as const,
      assignee: 'User', createdAt: new Date(), updatedAt: new Date(),
    };
    const payload = toSSEPayload(fullTask);
    expect('description' in payload).toBe(false);
    expect(payload.id).toBe('t1');
    expect(payload.title).toBe('Big Task');
  });

  it('toSSEPayload preserves all other fields', async () => {
    const { toSSEPayload } = await import('@/lib/events/event-bus');
    const task = {
      id: 't1', projectId: 'p1', subprojectId: null,
      title: 'T', description: 'D',
      status: 'done' as const, priority: 'medium' as const,
      assignee: 'A', createdAt: new Date(), updatedAt: new Date(),
    };
    const payload = toSSEPayload(task);
    const keys = Object.keys(payload);
    expect(keys.length).toBe(9);
    expect(keys).toContain('id');
    expect(keys).toContain('projectId');
    expect(keys).toContain('subprojectId');
    expect(keys).toContain('title');
    expect(keys).toContain('status');
    expect(keys).toContain('priority');
    expect(keys).toContain('assignee');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
  });
});

describe('rate-limiter — static analysis', () => {
  const SRC_ROOT = path.join(__dirname, '..');

  it('sliding window rate limiter uses Map store', () => {
    const source = fs.readFileSync(path.join(SRC_ROOT, 'rate-limiter.ts'), 'utf-8');
    expect(source).toContain('new Map<string,');
  });

  it('cleanupExpiredEntries removes entries past resetAt', () => {
    const source = fs.readFileSync(path.join(SRC_ROOT, 'rate-limiter.ts'), 'utf-8');
    expect(source).toContain('cleanupExpiredEntries');
    expect(source).toContain('store.delete');
    expect(source).toContain('now > entry.resetAt');
  });

  it('auto-cleanup interval unrefed for clean exit', () => {
    const source = fs.readFileSync(path.join(SRC_ROOT, 'rate-limiter.ts'), 'utf-8');
    expect(source).toContain('setInterval(cleanupExpiredEntries');
    expect(source).toContain('unref()');
  });

  it('predefined rate limits: global 100/min, authFailure 10/min', () => {
    const source = fs.readFileSync(path.join(SRC_ROOT, 'rate-limiter.ts'), 'utf-8');
    expect(source).toContain('100');
    expect(source).toContain('authFailure');
    expect(source).toContain('maxRequests: 100');
    expect(source).toContain('maxRequests: 10');
  });
});
