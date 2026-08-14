/**
 * POST /api/auth/register — Create a new user account.
 * AUTH-002: Generic 200 for duplicate emails (prevent enumeration).
 * AUTH-007: Log register events.
 * AUTH-009: Check REGISTRATION_ENABLED env var.
 */
import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validators/auth';
import { userService } from '@/lib/services/user-service';
import { signToken, buildAuthCookie, isSecureRequest } from '@/lib/auth/session';
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
    // AUTH-009: Check if registration is enabled
    if (process.env.REGISTRATION_ENABLED === 'false') {
      return NextResponse.json(
        { error: { code: 'REGISTRATION_DISABLED', message: 'Registration is currently disabled' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

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

    const { name, email, password } = parsed.data;

    // Check if email already exists
    const existingUser = await userService.findByEmail(email);

    // AUTH-002: Return generic 200 for duplicate emails (prevent enumeration)
    if (existingUser) {
      logAuthEvent({
        timestamp: new Date().toISOString(),
        event: 'register',
        email,
        ip,
        reason: 'email_exists',
      });
      return NextResponse.json({
        message: 'If an account with this email exists, you can sign in at /login',
      });
    }

    // Create new user
    const user = await userService.register({ name, email, password });

    logAuthEvent({
      timestamp: new Date().toISOString(),
      event: 'register',
      email,
      ip,
    });

    // Sign JWT and set cookie
    const token = await signToken({
      sub: user.id,
      email: user.email!,
      role: user.role,
    });

    const response = NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
    response.headers.set('Set-Cookie', buildAuthCookie(token, isSecureRequest(request)));

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    logAuthEvent({
      timestamp: new Date().toISOString(),
      event: 'auth_error',
      ip,
      reason: 'register_error',
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
