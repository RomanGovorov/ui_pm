import { describe, it, expect } from 'vitest';
import { handleApiError, ApiError } from '@/lib/errors';
import { ZodError } from 'zod';

describe('handleApiError', () => {
  it('handles ApiError correctly', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Resource not found');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(404);
    expect(result.body.error.code).toBe('NOT_FOUND');
    expect(result.body.error.message).toBe('Resource not found');
  });

  it('handles ZodError correctly', () => {
    const error = new ZodError([
      {
        code: 'too_small',
        minimum: 1,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'Required',
        path: ['title'],
      },
    ]);
    const result = handleApiError(error);
    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.details).toHaveLength(1);
  });

  it('handles unknown errors with generic message', () => {
    const result = handleApiError(new Error('Something went wrong'));
    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe('INTERNAL_ERROR');
    expect(result.body.error.message).toBe('An unexpected error occurred');
  });

  it('never exposes internal error details', () => {
    const result = handleApiError(new Error('DATABASE_CONNECTION_FAILED: ECONNREFUSED 127.0.0.1:5432'));
    expect(result.body.error.message).toBe('An unexpected error occurred');
    expect(result.body.error.message).not.toContain('ECONNREFUSED');
    expect(result.body.error.message).not.toContain('DATABASE');
  });
});
