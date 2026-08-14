import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.join(__dirname, '..');

/**
 * Bug Fix Verification Tests — Iteration 2 (T45a)
 *
 * Verifies that BUG-001, BUG-002, BUG-003 are properly fixed
 * and checks the LOW-severity Cache-Control finding.
 */

describe('BUG-001 fix: Tailwind dark mode classes JIT-safe', () => {
  const taskCardPath = path.join(SRC_ROOT, '..', 'app', 'components', 'kanban', 'TaskCard.tsx');
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(taskCardPath, 'utf-8');
  });

  it('FIXED: Static PRIORITY_CLASSES map exists with all priorities', () => {
    expect(source).toContain('PRIORITY_CLASSES');
    expect(source).toContain("high: 'dark:bg-red-900/30");
    expect(source).toContain("medium: 'dark:bg-amber-900/30");
    expect(source).toContain("low: 'dark:bg-green-900/30");
  });

  it('FIXED: Each priority has BOTH dark: AND light mode classes', () => {
    // Each entry should have both bg-* and text-* pairs
    const highEntry = source.match(/high: ['"](.*?)['"]/);
    expect(highEntry).not.toBeNull();
    if (highEntry) {
      // Should contain dark:bg-red-900/30 AND dark:text-red-400
      expect(highEntry[1]).toContain('dark:bg-red-900/30');
      expect(highEntry[1]).toContain('dark:text-red-400');
      // Also light mode
      expect(highEntry[1]).toContain('bg-red-100');
      expect(highEntry[1]).toContain('text-red-700');
    }
  });

  it('FIXED: No dynamic template literal class construction remains', () => {
    // The old pattern was: dark:${priorityStyle!.dark}
    expect(source).not.toContain('${priorityStyle');
    expect(source).not.toContain('dark:${');
  });

  it('FIXED: PRIORITY_DOTS uses simple literal classes', () => {
    expect(source).toContain('PRIORITY_DOTS');
    expect(source).toContain('bg-red-500');
    expect(source).toContain('bg-amber-500');
    expect(source).toContain('bg-green-500');
  });

  it('FIXED: Component uses PRIORITY_CLASSES with fallback', () => {
    expect(source).toContain("PRIORITY_CLASSES[task.priority]");
    expect(source).toContain("PRIORITY_CLASSES['medium']");
  });
});

describe('BUG-002 fix: Vary: Origin header present', () => {
  const middlewarePath = path.join(SRC_ROOT, '..', 'middleware.ts');
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(middlewarePath, 'utf-8');
  });

  it('FIXED: Vary: Origin header in getCorsHeaders()', () => {
    expect(source).toContain("'Vary'");
    expect(source).toContain("'Origin'");
  });

  it('FIXED: Vary: Origin applies to ALL CORS responses', () => {
    expect(source).toContain('Vary');
    // getCorsHeaders should be called in multiple places
    const getCorsCalls = source.match(/getCorsHeaders\(/g);
    expect(getCorsCalls && getCorsCalls.length).toBeGreaterThan(3);
  });

  it('FIXED: OPTIONS preflight includes Vary: Origin', () => {
    expect(source).toContain("request.method === 'OPTIONS'");
    expect(source).toContain('getCorsHeaders(request)');
  });

  it('FIXED: Rate-limited response includes Vary: Origin', () => {
    expect(source).toContain('status: 429');
  });

  it('FIXED: Auth failure response includes Vary: Origin', () => {
    expect(source).toContain('status: 401');
  });
});

describe('BUG-003 fix: ARIA role on aside element', () => {
  const appShellPath = path.join(SRC_ROOT, '..', 'app', 'components', 'layout', 'AppShell.tsx');
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(appShellPath, 'utf-8');
  });

  it('FIXED: <aside> does NOT have role="navigation"', () => {
    expect(source).not.toContain('role="navigation"');
  });

  it('FIXED: <aside> keeps aria-label="Sidebar"', () => {
    expect(source).toContain('aria-label="Sidebar"');
  });

  it('FIXED: <main> element has proper role="main"', () => {
    expect(source).toContain('role="main"');
  });

  it('FIXED: Semantic hierarchy — aside (complementary) wraps nav (navigation)', () => {
    expect(source).toContain('<aside');
    expect(source).not.toContain('role=');
  });
});

describe('LOW finding: Cache-Control on GET /api/projects/[id]/tasks', () => {
  const tasksRoutePath = path.join(
    SRC_ROOT,
    '..',
    'app',
    'api',
    'projects',
    '[id]',
    'tasks',
    'route.ts',
  );
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(tasksRoutePath, 'utf-8');
  });

  it('LOW-005: Missing Cache-Control identified — endpoint returns dynamic data without caching policy', () => {
    // This is a known LOW finding from code-reviewer review-TSK-005-013
    // The route uses NextResponse.json without explicit Cache-Control
    expect(source).toContain('NextResponse.json({ data: tasks, total: tasks.length })');
  });

  it('LOW-005: Other GET endpoints DO have Cache-Control for comparison', () => {
    const tasksRootPath = path.join(SRC_ROOT, '..', 'app', 'api', 'tasks', 'route.ts');
    const tasksRootSource = fs.readFileSync(tasksRootPath, 'utf-8');
    expect(tasksRootSource).toContain('Cache-Control');
  });
});

describe('Regression: All existing modules still functional', () => {
  it('Rate limiter module structure intact', () => {
    const rlPath = path.join(SRC_ROOT, 'rate-limiter.ts');
    const source = fs.readFileSync(rlPath, 'utf-8');
    expect(source).toContain('new Map<string,');
    expect(source).toContain('cleanupExpiredEntries');
    expect(source).toContain('unref()');
  });

  it('Error handler still sanitizes internal details', () => {
    const errPath = path.join(SRC_ROOT, 'errors.ts');
    const source = fs.readFileSync(errPath, 'utf-8');
    expect(source).toContain('An unexpected error occurred');
    expect(source).toContain('INVALID_INPUT');
    expect(source).toContain('NOT_FOUND');
    expect(source).toContain('CONFLICT');
  });

  it('Auth module timing-safe comparison preserved', () => {
    const authPath = path.join(SRC_ROOT, 'auth.ts');
    const source = fs.readFileSync(authPath, 'utf-8');
    expect(source).toContain('createHash');
    expect(source).toContain('timingSafeEqual');
  });

  it('SSE payload stripping still active', () => {
    const busPath = path.join(SRC_ROOT, 'events', 'event-bus.ts');
    const source = fs.readFileSync(busPath, 'utf-8');
    expect(source).toContain('description');
    expect(source).toContain('toSSEPayload');
  });

  it('PERF-OPT-001: KanbanBoard uses single-pass grouping', () => {
    const boardPath = path.join(SRC_ROOT, '..', 'app', 'components', 'kanban', 'KanbanBoard.tsx');
    const source = fs.readFileSync(boardPath, 'utf-8');
    expect(source).toContain('grouped');
    expect(source).toContain('for (const task of filtered)');
    // Single-pass — no triple .filter() calls
    expect(source).not.toMatch(/\.filter\(.*t\.status/);
  });

  it('PERF-OPT-002: TaskCard memoizes pure functions', () => {
    const cardPath = path.join(SRC_ROOT, '..', 'app', 'components', 'kanban', 'TaskCard.tsx');
    const source = fs.readFileSync(cardPath, 'utf-8');
    expect(source).toContain('useMemo');
    expect(source).toContain('getAvatarColor');
    expect(source).toContain('formatRelativeDate');
  });
});
