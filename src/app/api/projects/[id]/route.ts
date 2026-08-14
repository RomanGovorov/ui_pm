import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/services/project-service';
import { handleApiError } from '@/lib/errors';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' } },
        { status: 400 },
      );
    }
    const project = await projectService.getById(parsed.data);
    // PERF-OPT-003: Explicit no-cache to prevent proxy/browser caching of dynamic data
    return NextResponse.json(project, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' } },
        { status: 400 },
      );
    }
    const body = await request.json();
    const validated = projectService.updateSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validated.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }
    const project = await projectService.update(parsed.data, validated.data);
    return NextResponse.json(project);
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' } },
        { status: 400 },
      );
    }
    const project = await projectService.delete(parsed.data);
    return NextResponse.json(project);
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
