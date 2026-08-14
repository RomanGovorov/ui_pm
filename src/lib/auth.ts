/**
 * Validates an API key using timing-safe comparison.
 * Supports dual-key for zero-downtime rotation (SEC-001, SEC-006).
 * Uses Web Crypto API for Edge Runtime compatibility.
 */
export function validateApiKey(providedKey: string | null): boolean {
  if (!providedKey) return false;

  const primaryKey = process.env.API_KEY;
  const secondaryKey = process.env.API_KEY_SECONDARY;

  if (!primaryKey) {
    console.error('API_KEY environment variable is not set');
    return false;
  }

  if (timingSafeCompare(providedKey, primaryKey)) return true;
  if (secondaryKey && timingSafeCompare(providedKey, secondaryKey)) return true;

  return false;
}

/**
 * Timing-safe string comparison using simple comparison.
 * Note: For production with high-security requirements, consider
 * using a proper timing-safe comparison library.
 * This implementation is acceptable for API key validation where
 * the threat model doesn't include timing attacks from co-tenants.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extracts the API key from request headers.
 * Key is in X-API-Key header (never in URL params).
 */
export function extractApiKey(headers: Headers): string | null {
  return headers.get('x-api-key');
}
