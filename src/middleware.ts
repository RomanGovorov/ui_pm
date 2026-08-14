import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, extractApiKey } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { verifyToken, getTokenFromCookie } from '@/lib/auth/session';

/**
 * Middleware matcher — intercepts API routes and page routes.
 * Excludes static assets, Next.js internals, and auth pages.
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - login, register pages (public auth pages)
     */
    '/((?!_next/static|_next/image|favicon.ico|login|register).*)',
  ],
};

// ─── AUTH-010: Exact Set matching for public auth routes ────────────────────
const PUBLIC_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
]);

// AUTH-006: Admin-only routes
const ADMIN_ONLY_ROUTES = new Set([
  '/api/users',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function getAllowedOrigins(): string[] {
  const origins = process.env.CORS_ALLOWED_ORIGINS;
  if (!origins) return [];
  return origins.split(',').map((o) => o.trim()).filter(Boolean);
}

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    // AUTH-008: Allow credentials (cookies) when origin matches
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Apply CORS headers to an existing response.
 */
function applyCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Resolve authentication: API key first (agent), then JWT cookie (browser user).
 * Returns { authenticated, role, source }.
 */
async function resolveAuth(request: NextRequest): Promise<{
  authenticated: boolean;
  role: string | null;
  source: 'api_key' | 'jwt' | null;
}> {
  // 1. Check API key (agent access)
  const apiKey = extractApiKey(request.headers);
  if (apiKey && validateApiKey(apiKey)) {
    return { authenticated: true, role: 'agent', source: 'api_key' };
  }

  // 2. Check JWT cookie (browser user)
  const cookieHeader = request.headers.get('cookie');
  const token = getTokenFromCookie(cookieHeader);
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      return { authenticated: true, role: payload.role, source: 'jwt' };
    }
  }

  return { authenticated: false, role: null, source: null };
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // ─── Page Routes ───────────────────────────────────────────────────────
  // Page routes that are not /login or /register need auth check
  if (!pathname.startsWith('/api/')) {
    // Only the root dashboard page needs auth check here
    // (login/register pages are excluded in matcher)
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ─── API Routes ────────────────────────────────────────────────────────

  // AUTH-010: Public routes — exact Set match
  if (PUBLIC_ROUTES.has(pathname)) {
    const response = NextResponse.next();
    return applyCorsHeaders(response, request);
  }

  // Global rate limiting
  const clientIp = getClientIp(request);
  const globalLimit = rateLimit(`global:${clientIp}`, RATE_LIMITS.global);
  if (!globalLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(globalLimit.retryAfter ?? 60),
          ...getCorsHeaders(request),
        },
      },
    );
  }

  // Resolve authentication (API key or JWT)
  const auth = await resolveAuth(request);

  // AUTH-001: SSE endpoint requires authentication
  if (pathname === '/api/events') {
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401, headers: getCorsHeaders(request) },
      );
    }
    const response = NextResponse.next();
    return applyCorsHeaders(response, request);
  }

  // AUTH-006: Admin-only routes
  if (ADMIN_ONLY_ROUTES.has(pathname)) {
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401, headers: getCorsHeaders(request) },
      );
    }
    if (auth.role !== 'admin' && auth.role !== 'agent') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403, headers: getCorsHeaders(request) },
      );
    }
    const response = NextResponse.next();
    return applyCorsHeaders(response, request);
  }

  // Write operations require authentication
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (isWrite) {
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401, headers: getCorsHeaders(request) },
      );
    }

    // Stakeholders cannot write (only admin and agent can)
    if (auth.role === 'stakeholder') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Read-only access' } },
        { status: 403, headers: getCorsHeaders(request) },
      );
    }
  }

  // Read operations: allow (dashboard data is accessible to authenticated users)
  // Unauthenticated reads on non-public routes also allowed (for backward compat with open dashboard)
  const response = NextResponse.next();
  return applyCorsHeaders(response, request);
}
