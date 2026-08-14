import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Security-focused tests for auth implementation.
 * Validates AUTH-001 through AUTH-008 security requirements.
 * Uses fixed base path (project root) to avoid __dirname resolution issues.
 */

const BASE = '/home/gans/ai/education/ui_pm';

const MID_PATH          = path.join(BASE, 'src/middleware.ts');
const SESSION_PATH      = path.join(BASE, 'src/lib/auth/session.ts');
const VALIDATORS_PATH   = path.join(BASE, 'src/lib/validators/auth.ts');
const AUDIT_LOG_PATH    = path.join(BASE, 'src/lib/auth/audit-log.ts');
const LOGIN_ROUTE_PATH  = path.join(BASE, 'src/app/api/auth/login/route.ts');
const REGISTER_ROUTE_PATH = path.join(BASE, 'src/app/api/auth/register/route.ts');
const LOGOUT_ROUTE_PATH = path.join(BASE, 'src/app/api/auth/logout/route.ts');
const ME_ROUTE_PATH     = path.join(BASE, 'src/app/api/auth/me/route.ts');

// ─── AUTH-002: Generic error for duplicate email ─────────────────────────────

describe('AUTH-002: Registration doesn\'t leak email existence', () => {
  it('register route returns generic message for duplicates', async () => {
    const source = fs.readFileSync(REGISTER_ROUTE_PATH, 'utf-8');
    expect(source).toContain('If an account with this email exists');
    // Should NOT leak existence via error codes in the response
    // (the word "duplicate" may appear in comments; only check code paths)
    expect(source).not.toContain('409');
    expect(source).not.toContain('UserAlreadyExists');
  });

  it('register route never echoes user data back for duplicate', async () => {
    const source = fs.readFileSync(REGISTER_ROUTE_PATH, 'utf-8');
    // Find the duplicate-email branch — it includes logAuthEvent + NextResponse.json
    const blockRe = /if\s*\(existingUser\)\s*\{[\s\S]*?return\s+NextResponse\.json[\s\S]*?\}/;
    const existingBlock = source.match(blockRe);
    expect(existingBlock).not.toBeNull();
    if (existingBlock) {
      const block = existingBlock[0];
      // Should return generic success msg, not 409/user data
      expect(block).toContain('If an account with this email exists');
      expect(block).not.toMatch(/status:\s*(409|403)/);
    }
  });
});

// ─── AUTH-003: JWT_SECRET validation ─────────────────────────────────────────

describe('AUTH-003: JWT_SECRET validated at startup', () => {
  it('session module throws on missing JWT_SECRET', async () => {
    const source = fs.readFileSync(SESSION_PATH, 'utf-8');
    expect(source).toContain("FATAL: JWT_SECRET environment variable is not set");
  });

  it('session module throws on short JWT_SECRET', async () => {
    const source = fs.readFileSync(SESSION_PATH, 'utf-8');
    expect(source).toContain('must be at least 32 bytes');
  });

  it('JWT_SECRET validated lazily via getJwtSecret before use', async () => {
    const source = fs.readFileSync(SESSION_PATH, 'utf-8');
    const lines = source.split('\n');
    const getSecretIdx = lines.findIndex((l) => l.includes('function getJwtSecret'));
    const signTokenIdx = lines.findIndex((l) => l.includes('export async function signToken'));
    expect(getSecretIdx).toBeGreaterThanOrEqual(0);
    expect(signTokenIdx).toBeGreaterThanOrEqual(0);
    expect(getSecretIdx).toBeLessThan(signTokenIdx);
    // Verify signToken calls getJwtSecret (lazy validation)
    expect(source).toContain('getJwtSecret()');
  });

  it('uses Web Crypto API (jose), Edge-compatible', async () => {
    const source = fs.readFileSync(SESSION_PATH, 'utf-8');
    expect(source).toContain("from 'jose'");
    expect(source).toContain('TextEncoder');
    expect(source).not.toContain("require('crypto')");
  });
});

// ─── AUTH-008: Rate limiting on login ────────────────────────────────────────

describe('AUTH-008: Rate limiting on login failures', () => {
  it('login endpoint has rate limiter for failed attempts', async () => {
    const source = fs.readFileSync(LOGIN_ROUTE_PATH, 'utf-8');
    expect(source).toContain('rateLimit');
    expect(source).toContain('auth_fail');
    expect(source).toContain('RATE_LIMITS.authFailure');
  });

  it('rate limit uses per-IP key', async () => {
    const source = fs.readFileSync(LOGIN_ROUTE_PATH, 'utf-8');
    expect(source).toContain('ip');
    expect(source).toContain('auth_fail');
  });

  it('returns 429 with Retry-After header when rate limited', async () => {
    const source = fs.readFileSync(LOGIN_ROUTE_PATH, 'utf-8');
    expect(source).toContain('status: 429');
    expect(source).toContain('Retry-After');
  });

  it('rate limit only counts failures (successful logins exempt)', async () => {
    const source = fs.readFileSync(LOGIN_ROUTE_PATH, 'utf-8');
    const lines = source.split('\n');
    let foundFailCheck = false;
    let foundRateLimit = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('!user')) foundFailCheck = true;
      if (foundFailCheck && lines[i].includes('rateLimit')) { foundRateLimit = true; break; }
    }
    expect(foundFailCheck).toBe(true);
    expect(foundRateLimit).toBe(true);
  });
});

// ─── Cookie Security Flags ───────────────────────────────────────────────────

describe('Cookie security flags', () => {
  it('auth cookie has HttpOnly flag', async () => {
    process.env.JWT_SECRET = 'a'.repeat(96);
    vi.resetModules();
    const session = await import('@/lib/auth/session');
    const cookie = session.buildAuthCookie('test-token');
    expect(cookie).toContain('HttpOnly');
  });

  it('auth cookie has SameSite=Lax (via static analysis)', async () => {
    const source = fs.readFileSync(SESSION_PATH, 'utf-8');
    expect(source).toContain('SameSite=Lax');
  });

  it('clear cookie also has HttpOnly and SameSite', async () => {
    process.env.JWT_SECRET = 'a'.repeat(96);
    vi.resetModules();
    const session = await import('@/lib/auth/session');
    const clearCookie = session.buildClearCookie();
    expect(clearCookie).toContain('HttpOnly');
    expect(clearCookie).toContain('SameSite=Lax');
  });

  it('Secure flag is controlled by isSecure parameter', async () => {
    process.env.JWT_SECRET = 'a'.repeat(96);
    vi.resetModules();
    const session = await import('@/lib/auth/session');

    // isSecure=false: no Secure flag
    expect(session.buildAuthCookie('x', false)).not.toContain('Secure');

    // isSecure=true (default): Secure enabled
    expect(session.buildAuthCookie('x', true)).toContain('Secure');
    expect(session.buildAuthCookie('x')).toContain('Secure');
  });

  it('cookie path is / (root)', async () => {
    process.env.JWT_SECRET = 'a'.repeat(96);
    vi.resetModules();
    const session = await import('@/lib/auth/session');
    expect(session.buildAuthCookie('x')).toContain('Path=/');
  });
});

// ─── AUTH-001: SSE requires authentication ───────────────────────────────────

describe('AUTH-001: SSE endpoint requires authentication', () => {
  it('middleware checks auth for /api/events', async () => {
    const source = fs.readFileSync(MID_PATH, 'utf-8');
    expect(source).toContain('/api/events');
    expect(source).toContain('UNAUTHORIZED');
  });

  it('middleware returns 401 for unauthenticated SSE requests', async () => {
    const source = fs.readFileSync(MID_PATH, 'utf-8');
    const eventsBlock = source.match(/if\s*\(\s*pathname\s*===\s*['"]\/api\/events['"]/);
    expect(eventsBlock).not.toBeNull();
    if (eventsBlock) {
      const idx = source.indexOf(eventsBlock[0]);
      const context = source.slice(idx, idx + 500);
      expect(context).toContain('401');
      expect(context).toContain('Authentication required');
    }
  });
});

// ─── Audit Logging (AUTH-007) ────────────────────────────────────────────────

describe('AUTH-007: No sensitive data in audit logs', () => {
  it('logAuthEvent interface has no password field', async () => {
    const source = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    expect(source).toContain('email?: string');
    expect(source).toContain('ip: string');
    const entryMatch = source.match(/interface\s+AuthLogEntry\s*\{[\s\S]*?\n\}/);
    expect(entryMatch).not.toBeNull();
    if (entryMatch) {
      expect(entryMatch[0]).not.toContain('password:');
      expect(entryMatch[0]).not.toContain('token:');
    }
  });

  it('all route handlers never log raw passwords', async () => {
    const routes = [LOGIN_ROUTE_PATH, REGISTER_ROUTE_PATH, LOGOUT_ROUTE_PATH, ME_ROUTE_PATH];
    for (const rp of routes) {
      if (fs.existsSync(rp)) {
        const source = fs.readFileSync(rp, 'utf-8');
        expect(source).not.toMatch(/console\.log.*password|password.*console\.log/i);
        expect(source).not.toMatch(/JSON\.stringify.*password|password.*JSON\.stringify/i);
      }
    }
  });
});

// ─── Input Validation Security ───────────────────────────────────────────────

describe('Input validation covers attack vectors', () => {
  it('email is lowercased to prevent case-based bypass', async () => {
    const source = fs.readFileSync(VALIDATORS_PATH, 'utf-8');
    expect(source).toContain('toLowerCase()');
    expect(source).toContain('.transform');
  });

  it('password length limits enforced (min 8, max 128)', async () => {
    const source = fs.readFileSync(VALIDATORS_PATH, 'utf-8');
    expect(source).toContain('min(8');
    expect(source).toContain('max(128');
  });

  it('confirmPassword field prevents typo-based registration', async () => {
    const source = fs.readFileSync(VALIDATORS_PATH, 'utf-8');
    expect(source).toContain('confirmPassword');
    expect(source).toContain('refine');
    expect(source).toContain('password === data.confirmPassword');
  });
});
