interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

/**
 * Sliding window rate limiter (in-memory, single-instance).
 * SEC-PHASE1-002: Promoted to v1 from v1.1.
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}

/** Predefined rate limit configurations */
export const RATE_LIMITS = {
  /** Global: 100 requests per minute per IP */
  global: { windowMs: 60_000, maxRequests: 100 },
  /** Auth failures: 10 per minute per IP */
  authFailure: { windowMs: 60_000, maxRequests: 10 },
  /** Write operations: 60 per minute per IP */
  writeOps: { windowMs: 60_000, maxRequests: 60 },
} as const;

/** Periodic cleanup of expired entries (call from a setInterval if needed) */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

// Auto-cleanup every 5 minutes
if (typeof globalThis !== 'undefined') {
  const g = globalThis as unknown as { _rateLimitCleanup?: ReturnType<typeof setInterval> };
  if (!g._rateLimitCleanup) {
    g._rateLimitCleanup = setInterval(cleanupExpiredEntries, 5 * 60_000);
    // Allow Node.js to exit even if interval is running
    if (g._rateLimitCleanup && typeof g._rateLimitCleanup === 'object' && 'unref' in g._rateLimitCleanup) {
      (g._rateLimitCleanup as NodeJS.Timeout).unref();
    }
  }
}
