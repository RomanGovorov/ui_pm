# PHASE1-009: Error Response Information Disclosure

**ID:** PHASE1-009
**Severity:** MEDIUM
**Category:** Security Misconfiguration (A05:2021)
**STRIDE:** Information Disclosure
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

The architecture defines an error format `{ error: { code, message, details } }` but does not specify error sanitization rules. Without explicit sanitization:
- Prisma errors may expose table names, column names, and query structure
- Node.js stack traces may expose file paths and module names
- Zod validation details are safe but internal error codes may leak implementation details

## Location

- **File:** `lib/errors.ts` (to be created)
- **All API route handlers**
- **Component:** Error handling middleware

## Impact

- **Database schema disclosure**: Prisma `P2002` errors reveal unique constraint names (table + column names)
- **Internal path disclosure**: Stack traces reveal server file structure
- **Implementation fingerprinting**: Error codes like `PRISMA_P2025` reveal the ORM in use
- **Debug information**: Development mode may expose full query details

## Evidence

From component specifications §3.1:
```typescript
// Error response includes Zod details — safe for validation errors
{ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.issues } }
```

However, no handling is specified for:
- Prisma errors (constraint violations, connection failures)
- Unexpected exceptions
- Middleware errors

## Remediation

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown): { statusCode: number; body: object } {
  // Known API errors — safe to return message
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  // Zod validation errors — safe to return details
  if (error instanceof z.ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        },
      },
    };
  }

  // Prisma errors — sanitize before returning
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = sanitizePrismaError(error);
    return {
      statusCode: mapPrismaToHttpStatus(error.code),
      body: { error: { code: mapPrismaToErrorCode(error.code), message } },
    };
  }

  // Unknown errors — generic response, log full details server-side
  console.error('Unhandled error:', error);
  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
  };
}

function sanitizePrismaError(error: Prisma.PrismaClientKnownRequestError): string {
  switch (error.code) {
    case 'P2002': return 'A record with this value already exists';
    case 'P2025': return 'Record not found';
    case 'P2003': return 'Referenced record does not exist';
    case 'P2014': return 'Cannot delete: record is still referenced';
    default: return 'Database operation failed';
  }
}
```

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | MEDIUM (errors are common in normal operation) |
| Impact | MEDIUM (aids reconnaissance for further attacks) |
| **Risk** | **MEDIUM** |

## Status

**OPEN** — Must be implemented in Phase 2 (TSK-006/007/008 error handling).
