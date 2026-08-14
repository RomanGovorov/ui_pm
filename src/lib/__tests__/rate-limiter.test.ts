import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

describe('rate-limiter', () => {
  beforeEach(() => {
    // Each test gets a fresh store since we use unique keys
  });

  it('allows requests under the limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = rateLimit(key, RATE_LIMITS.global);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('blocks requests over the limit', () => {
    const key = `test-block-${Date.now()}`;
    const config = { windowMs: 60_000, maxRequests: 2 };

    rateLimit(key, config); // 1
    rateLimit(key, config); // 2
    const result = rateLimit(key, config); // 3 — blocked

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('returns retry-after header value in seconds', () => {
    const key = `test-retry-${Date.now()}`;
    const config = { windowMs: 60_000, maxRequests: 1 };

    rateLimit(key, config); // 1
    const result = rateLimit(key, config); // 2 — blocked

    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe('number');
    expect(result.retryAfter!).toBeLessThanOrEqual(60);
  });

  it('resets after window expires', async () => {
    const key = `test-reset-${Date.now()}`;
    const config = { windowMs: 50, maxRequests: 1 }; // 50ms window

    rateLimit(key, config);
    const blocked = rateLimit(key, config);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const afterReset = rateLimit(key, config);
    expect(afterReset.allowed).toBe(true);
  });
});
