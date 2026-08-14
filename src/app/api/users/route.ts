import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const users = await userService.list();
    // PERF-OPT-003: Explicit no-cache to prevent proxy/browser caching of dynamic data
    return NextResponse.json(
      { data: users, total: users.length },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } },
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = userService.createSchema.safeParse(body);
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
    const user = await userService.create(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
