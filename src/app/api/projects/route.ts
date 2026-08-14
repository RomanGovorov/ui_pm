import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/services/project-service';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const projects = await projectService.list();
    // PERF-OPT-003: Explicit no-cache to prevent proxy/browser caching of dynamic data
    return NextResponse.json(
      { data: projects, total: projects.length },
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
    const parsed = projectService.createSchema.safeParse(body);
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
    const project = await projectService.create(parsed.data);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
