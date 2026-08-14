/**
 * POST /api/auth/logout — Clear the JWT cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildClearCookie, isSecureRequest } from '@/lib/auth/session';
import { logAuthEvent } from '@/lib/auth/audit-log';
import { getTokenFromCookie, verifyToken } from '@/lib/auth/session';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Log logout event if user was authenticated
  const token = getTokenFromCookie(request.headers.get('cookie'));
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      logAuthEvent({
        timestamp: new Date().toISOString(),
        event: 'logout',
        email: payload.email,
        ip,
      });
    }
  }

  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.headers.set('Set-Cookie', buildClearCookie(isSecureRequest(request)));
  return response;
}
