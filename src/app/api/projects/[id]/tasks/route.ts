import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task-service';
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
    const tasks = await taskService.list({ projectId: parsed.data });
    return NextResponse.json({ data: tasks, total: tasks.length });
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
