/**
 * JWT session management — Edge-compatible (jose + Web Crypto).
 * AUTH-003: JWT_SECRET validated lazily on first use (fail-fast at runtime,
 * not at build time — next build imports modules without env vars).
 * ADR-007: HS256, 7-day expiry, httpOnly cookie.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// ─── AUTH-003: Lazy Startup Validation ───────────────────────────────────────
let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set');
  }
  if (raw.length < 64) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)');
  }
  _jwtSecret = new TextEncoder().encode(raw);
  return _jwtSecret;
}
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AuthTokenPayload extends JWTPayload {
  sub: string;    // user UUID
  email: string;
  role: string;   // 'admin' | 'stakeholder'
}

/**
 * Sign a JWT token with the given user payload.
 * Uses HS256, 7-day expiry.
 */
export async function signToken(payload: {
  sub: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * Verify a JWT token. Returns the payload if valid, null if invalid.
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract JWT from cookie header string.
 * Parses `Cookie: auth_token=xxx; other=yyy` format.
 */
export function getTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    if (name === COOKIE_NAME) {
      return valueParts.join('=') || null;
    }
  }
  return null;
}

/**
 * Build Set-Cookie header value for auth token.
 * httpOnly, sameSite=lax, path=/, 7-day maxAge.
 * secure=true in production over HTTPS, false for localhost/HTTP.
 */
export function buildAuthCookie(token: string, isSecure = true): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${TOKEN_EXPIRY_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Build Set-Cookie header value to clear auth token.
 */
export function buildClearCookie(isSecure = true): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Determine if cookie should have Secure flag.
 * Secure cookies are not sent over HTTP, so we disable for localhost.
 */
export function isSecureRequest(request: { url?: string; headers?: { get(name: string): string | null } }): boolean {
  // Check x-forwarded-proto (set by reverse proxy)
  const forwardedProto = request.headers?.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto === 'https';

  // Check request URL
  if (request.url) {
    try {
      const url = new URL(request.url);
      // Localhost development — no Secure flag
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return false;
      }
      return url.protocol === 'https:';
    } catch {
      // Invalid URL — fall back to NODE_ENV
    }
  }

  // Fallback: production = secure
  return process.env.NODE_ENV === 'production';
}

/**
 * Extract and verify JWT from a request's cookie header.
 * Returns user payload or null.
 */
export async function getUserFromRequest(request: {
  headers: { get(name: string): string | null };
}): Promise<AuthTokenPayload | null> {
  const cookieHeader = request.headers.get('cookie');
  const token = getTokenFromCookie(cookieHeader);
  if (!token) return null;
  return verifyToken(token);
}
