import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

/**
 * Health check endpoint for container orchestration and monitoring.
 * Used by Docker healthcheck, Kubernetes probes, and external pagers.
 *
 * Returns 200 when all subsystems (DB, API key) are operational.
 * Returns 503 with diagnostic details when any subsystem is down.
 */
export async function GET() {
  try {
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '1.0.0',
      // MEDIUM FIX (INFRA-006): Removed sensitive fields — api_key_configured and node_env
      // leak deployment configuration details to unauthenticated callers.
      checks: {
        database: 'connected',
      },
    });
  } catch (_error) {
    const error = _error as Error;
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
          error: process.env.NODE_ENV === 'production' ? 'internal_error' : error.message,
        },
      },
      { status: 503 },
    );
  }
}
