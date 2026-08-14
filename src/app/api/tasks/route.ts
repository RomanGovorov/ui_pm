import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task-service';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') ?? undefined;
    const status = searchParams.get('status') ?? undefined;

    const tasks = await taskService.list({ projectId, status });
    // PERF-OPT-003: Explicit no-cache to prevent proxy/browser caching of dynamic data
    return NextResponse.json(
      { data: tasks, total: tasks.length },
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
    const parsed = taskService.createSchema.safeParse(body);
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
    const task = await taskService.create(parsed.data);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
