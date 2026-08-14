// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to test the session module carefully because it validates JWT_SECRET at import time.
// We'll use dynamic imports to control the environment.

const TEST_JWT_SECRET = 'a'.repeat(96); // 96 hex chars, well above 64 minimum

describe('auth/session — JWT_SECRET runtime validation (AUTH-003)', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('throws on signToken if JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();

    const session = await import('@/lib/auth/session');
    await expect(
      session.signToken({ sub: 'u', email: 'a@b.c', role: 'admin' }),
    ).rejects.toThrow('FATAL: JWT_SECRET environment variable is not set');
  });

  it('throws on signToken if JWT_SECRET is too short', async () => {
    process.env.JWT_SECRET = 'short';
    vi.resetModules();

    const session = await import('@/lib/auth/session');
    await expect(
      session.signToken({ sub: 'u', email: 'a@b.c', role: 'admin' }),
    ).rejects.toThrow('FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)');
  });

  it('imports successfully without JWT_SECRET (lazy validation)', async () => {
    delete process.env.JWT_SECRET;
    vi.resetModules();

    const session = await import('@/lib/auth/session');
    expect(session.signToken).toBeDefined();
    expect(session.verifyToken).toBeDefined();
    expect(session.getTokenFromCookie).toBeDefined();
    expect(session.buildAuthCookie).toBeDefined();
    expect(session.buildClearCookie).toBeDefined();
  });
});

describe('auth/session — JWT sign/verify', () => {
  it('signs and verifies a token', async () => {
    // Set JWT_SECRET before importing
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    vi.resetModules();
    const session = await import('@/lib/auth/session');

    const token = await session.signToken({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await session.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user-123');
    expect(payload?.email).toBe('test@example.com');
    expect(payload?.role).toBe('admin');
  });

  it('returns null for invalid token', async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    vi.resetModules();
    const session = await import('@/lib/auth/session');

    const payload = await session.verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('returns null for empty token', async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    vi.resetModules();
    const session = await import('@/lib/auth/session');

    const payload = await session.verifyToken('');
    expect(payload).toBeNull();
  });
});

describe('auth/session — cookie helpers', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.NODE_ENV = 'development';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('extracts token from cookie header', async () => {
    const session = await import('@/lib/auth/session');

    const token = session.getTokenFromCookie('auth_token=abc123; other=value');
    expect(token).toBe('abc123');
  });

  it('returns null when cookie is not present', async () => {
    const session = await import('@/lib/auth/session');

    expect(session.getTokenFromCookie(null)).toBeNull();
    expect(session.getTokenFromCookie('other=value')).toBeNull();
    expect(session.getTokenFromCookie('')).toBeNull();
  });

  it('builds auth cookie without Secure flag when isSecure=false', async () => {
    const session = await import('@/lib/auth/session');

    const cookie = session.buildAuthCookie('test-token', false);
    expect(cookie).toContain('auth_token=test-token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Secure');
  });

  it('builds auth cookie with Secure flag when isSecure=true', async () => {
    const session = await import('@/lib/auth/session');

    const cookie = session.buildAuthCookie('test-token', true);
    expect(cookie).toContain('Secure');
  });

  it('builds clear cookie', async () => {
    const session = await import('@/lib/auth/session');

    const cookie = session.buildClearCookie(false);
    expect(cookie).toContain('auth_token=');
    expect(cookie).toContain('Max-Age=0');
  });

  it('isSecureRequest returns false for localhost', async () => {
    const session = await import('@/lib/auth/session');

    expect(session.isSecureRequest({ url: 'http://localhost:3000/api/auth/login' })).toBe(false);
    expect(session.isSecureRequest({ url: 'http://127.0.0.1:3000/api/auth/login' })).toBe(false);
  });

  it('isSecureRequest returns true for https', async () => {
    const session = await import('@/lib/auth/session');

    expect(session.isSecureRequest({ url: 'https://example.com/api/auth/login' })).toBe(true);
  });

  it('isSecureRequest checks x-forwarded-proto header', async () => {
    const session = await import('@/lib/auth/session');

    expect(session.isSecureRequest({ url: 'http://localhost:3000', headers: { get: (n: string) => n === 'x-forwarded-proto' ? 'https' : null } })).toBe(true);
    expect(session.isSecureRequest({ url: 'https://example.com', headers: { get: (n: string) => n === 'x-forwarded-proto' ? 'http' : null } })).toBe(false);
  });
});
