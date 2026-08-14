# PHASE1-004: Missing updatedAt Timestamp on Subproject Model

**Severity:** Low
**Category:** Data Model Consistency
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

Both `Project` and `Task` models have `@updatedAt` timestamp fields, but `Subproject` only has `createdAt`. This inconsistency makes it impossible to track when a subproject was last modified.

## Impact

- Cannot determine subproject modification time for audit purposes
- Inconsistent data model — all entities should have created/updated timestamps
- SSE events for subproject updates cannot include `updatedAt` in payload

## Recommendation

```prisma
model Subproject {
  // ...
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")  // ← Add this
}
```

## Acceptance Criteria

- [ ] `updatedAt` field added to Subproject
- [ ] Migration generated
