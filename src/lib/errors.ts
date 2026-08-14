import { Prisma } from '../../prisma/generated/prisma/client';
import { ZodError } from 'zod';

/** Custom API error with status code and machine-readable code */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Standard error response body shape */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Map Prisma error codes to HTTP status codes */
function mapPrismaStatus(code: string): number {
  switch (code) {
    case 'P2002':
      return 409; // Unique constraint
    case 'P2025':
      return 404; // Record not found
    case 'P2003':
      return 400; // Foreign key constraint
    case 'P2014':
      return 400; // Relation violation
    default:
      return 500;
  }
}

/** Map Prisma error codes to generic API error codes */
function mapPrismaCode(code: string): string {
  switch (code) {
    case 'P2002':
      return 'CONFLICT';
    case 'P2025':
      return 'NOT_FOUND';
    case 'P2003':
      return 'INVALID_REFERENCE';
    case 'P2014':
      return 'RELATION_VIOLATION';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Sanitize Prisma error messages — never expose table names,
 * column names, or query structure to the client.
 */
function sanitizePrismaMessage(error: Prisma.PrismaClientKnownRequestError): string {
  if (error.code === 'P2002') {
    const target = (error.meta?.target as string[] | undefined)?.join(', ');
    return target
      ? `A record with this ${target} already exists`
      : 'A record with these values already exists';
  }
  if (error.code === 'P2025') return 'The requested resource was not found';
  if (error.code === 'P2003') return 'Referenced resource does not exist';
  return 'A database error occurred';
}

/**
 * Convert any error into a standardized, safe API error response.
 * SEC-PHASE1-009: Never exposes internal details.
 */
export function handleApiError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      statusCode: mapPrismaStatus(error.code),
      body: {
        error: {
          code: mapPrismaCode(error.code),
          message: sanitizePrismaMessage(error),
        },
      },
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      },
    };
  }

  // Unknown errors — log server-side, return generic message
  console.error('Unhandled error:', error);
  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}
