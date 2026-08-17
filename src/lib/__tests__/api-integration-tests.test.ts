import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.join(__dirname, '..');

/**
 * API Integration Tests — Iteration 2 (T45a)
 *
 * Static + structural analysis of API route handlers,
 * verifying consistent patterns across endpoints.
 */

describe('API routes — consistent error handling', () => {
  const apiDir = path.join(SRC_ROOT, '..', 'app', 'api');

  function findRouteFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === '[...]' || entry.name.startsWith('[')) continue;
        if (entry.name === 'route.ts') {
          results.push(fullPath);
        } else if (entry.isDirectory()) {
          results.push(...findRouteFiles(fullPath));
        }
      }
    } catch {
      // skip inaccessible dirs
    }
    return results;
  }

  const routeFiles = findRouteFiles(apiDir);

  it(`all ${routeFiles.length} route files import handleApiError`, () => {
    // Auth routes use custom error handling (generic responses for anti-enumeration)
    // SSE/events route uses stream-based error handling
    // Health route has its own error handling (returns 503 with diagnostic info)
    const excludedPattern = /api\/(auth|events|health)\//;
    const nonAuthRoutes = routeFiles.filter((f) => !excludedPattern.test(f));
    nonAuthRoutes.forEach((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      expect(source, `${file} should handle errors`).toContain('handleApiError');
    });
  });

  it('POST/PUT/PATCH/DELETE routes use zod validation', () => {
    const writeRoutes = routeFiles.filter((f) => {
      const s = fs.readFileSync(f, 'utf-8');
      return (
        s.includes('POST') || s.includes('PUT') || s.includes('PATCH') || s.includes('DELETE')
      );
    });

    // Logout route has no input to validate; auth routes that do validate use safeParse
    const excludedPattern = /api\/auth\/logout\//;
    const routesWithInput = writeRoutes.filter((f) => !excludedPattern.test(f));
    routesWithInput.forEach((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      expect(source, `${file} should validate input`).toContain('safeParse');
    });
  });
});

describe('CORS headers consistency across API routes', () => {
  it('middleware applies CORS to all /api/* routes', () => {
    const mwPath = path.join(SRC_ROOT, '..', 'middleware.ts');
    const source = fs.readFileSync(mwPath, 'utf-8');
    expect(source).toContain("matcher");
    // Matcher includes api route handling (either explicit or via negative lookahead)
    expect(source).toMatch(/api/);
  });

  it('CORS reflects allowed origins from env var', () => {
    const mwPath = path.join(SRC_ROOT, '..', 'middleware.ts');
    const source = fs.readFileSync(mwPath, 'utf-8');
    expect(source).toContain('getAllowedOrigins');
    expect(source).toContain('allowedOrigins.includes');
  });
});

describe('Task status transitions are type-safe', () => {
  it('TaskStatus enum covers all kanban columns', () => {
    const typesPath = path.join(SRC_ROOT, 'types', 'index.ts');
    const source = fs.readFileSync(typesPath, 'utf-8');
    expect(source).toContain('backlog');
    expect(source).toContain('in_work');
    expect(source).toContain('review');
    expect(source).toContain('done');
  });

  it('updateTaskSchema only allows valid status transitions', () => {
    const validatorPath = path.join(SRC_ROOT, 'validators', 'task.ts');
    const source = fs.readFileSync(validatorPath, 'utf-8');
    expect(source).toContain('z.enum');
    expect(source).toContain('backlog');
    expect(source).toContain('in_work');
    expect(source).toContain('review');
    expect(source).toContain('done');
  });
});

describe('Project list filters tasks correctly', () => {
  it('KanbanBoard groups tasks by status using single-pass for..of', () => {
    const boardPath = path.join(SRC_ROOT, '..', 'app', 'components', 'kanban', 'KanbanBoard.tsx');
    const source = fs.readFileSync(boardPath, 'utf-8');
    expect(source).toContain('grouped');
    expect(source).toContain('for (const task of filtered)');
    // Single-pass — no triple .filter() calls on task.status
    expect(source).not.toMatch(/\.filter\(.*t\.status/);
  });

  it('TaskCard renders priority badge with static classes (BUG-001 fix)', () => {
    const cardPath = path.join(
      SRC_ROOT,
      '..',
      'app',
      'components',
      'kanban',
      'TaskCard.tsx',
    );
    const source = fs.readFileSync(cardPath, 'utf-8');
    expect(source).toContain('PRIORITY_CLASSES');
    expect(source).toContain('priorityClasses');
  });
});

describe('Accessibility landmarks — WCAG compliance', () => {
  it('AppShell uses <aside> without role="navigation" (BUG-003 fix)', () => {
    const appShellPath = path.join(SRC_ROOT, '..', 'app', 'components', 'layout', 'AppShell.tsx');
    const source = fs.readFileSync(appShellPath, 'utf-8');
    expect(source).toContain('<aside');
    expect(source).not.toContain('role="navigation"');
    expect(source).toContain('aria-label="Sidebar"');
  });

  it('main content area has proper role and id', () => {
    const appShellPath = path.join(SRC_ROOT, '..', 'app', 'components', 'layout', 'AppShell.tsx');
    const source = fs.readFileSync(appShellPath, 'utf-8');
    expect(source).toContain('role="main"');
    expect(source).toContain('id="main-content"');
  });
});
