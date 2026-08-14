/**
 * POST /api/auth/login — Authenticate user and set JWT cookie.
 * AUTH-008: Rate limit counts FAILED attempts only.
 * AUTH-007: Log login success/failure events.
 * Generic "Invalid email or password" error (no enumeration).
 */
import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validators/auth';
import { userService } from '@/lib/services/user-service';
import { signToken, buildAuthCookie, isSecureRequest } from '@/lib/auth/session';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logAuthEvent } from '@/lib/auth/audit-log';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // Attempt authentication
    const user = await userService.findByCredentials(email, password);

    if (!user) {
      // AUTH-008: Rate limit counts ONLY failed attempts
      const authLimit = rateLimit(`auth_fail:${ip}`, RATE_LIMITS.authFailure);
      if (!authLimit.allowed) {
        logAuthEvent({
          timestamp: new Date().toISOString(),
          event: 'login_failure',
          email,
          ip,
          reason: 'rate_limited',
        });
        return NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many failed login attempts. Please try again later.' } },
          {
            status: 429,
            headers: { 'Retry-After': String(authLimit.retryAfter ?? 60) },
          },
        );
      }

      logAuthEvent({
        timestamp: new Date().toISOString(),
        event: 'login_failure',
        email,
        ip,
        reason: 'invalid_credentials',
      });

      // Generic error message (prevent enumeration)
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 },
      );
    }

    // Login successful — no rate limit consumed (AUTH-008)
    logAuthEvent({
      timestamp: new Date().toISOString(),
      event: 'login_success',
      email,
      ip,
    });

    // Sign JWT and set cookie
    const token = await signToken({
      sub: user.id,
      email: user.email!,
      role: user.role,
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.headers.set('Set-Cookie', buildAuthCookie(token, isSecureRequest(request)));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    logAuthEvent({
      timestamp: new Date().toISOString(),
      event: 'auth_error',
      ip,
      reason: 'login_error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
