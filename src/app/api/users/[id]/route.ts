import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { handleApiError } from '@/lib/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !['admin', 'stakeholder', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid role. Must be admin, stakeholder, or agent' } },
        { status: 400 },
      );
    }

    const user = await userService.updateRole(id, role);
    return NextResponse.json(user);
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
