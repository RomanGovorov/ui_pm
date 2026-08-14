/**
 * GET /api/auth/me — Return the currently authenticated user.
 * Reads JWT from cookie, verifies, returns user data.
 */
import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db/client';

export async function GET(request: Request) {
  const payload = await getUserFromRequest(request);

  if (!payload) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  // Fetch fresh user data from DB (in case role was changed)
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        { status: 401 },
      );
    }

    return NextResponse.json({ user });
  } catch {
    // If DB is unavailable, fall back to JWT payload
    return NextResponse.json({
      user: {
        id: payload.sub,
        name: payload.sub,
        email: payload.email,
        role: payload.role,
      },
    });
  }
}
