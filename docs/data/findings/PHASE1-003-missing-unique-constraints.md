# PHASE1-003: Missing UNIQUE Constraints on Project and Subproject Names

**Severity:** Medium
**Category:** Data Integrity
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The `Project` model has no `@unique` constraint on `name`. The `Subproject` model also has no uniqueness constraint. This allows creating multiple projects/subprojects with identical names, which causes confusion in the UI sidebar where users select by name.

## Impact

- Duplicate project names in sidebar — user cannot distinguish between them
- API responses become ambiguous when filtering by name
- Seed data could accidentally create duplicates

## Recommendation

### For Project:

```prisma
model Project {
  id          String   @id @default(uuid())
  name        String   @unique           // ← Add unique constraint
  // ...
}
```

### For Subproject (composite unique per project):

```prisma
model Subproject {
  // ...
  @@unique([projectId, name])  // ← Name must be unique within a project
}
```

This allows the same subproject name (e.g., "Backend") across different projects, but prevents duplicates within a single project.

## Acceptance Criteria

- [ ] `@unique` added to `Project.name`
- [ ] `@@unique([projectId, name])` added to `Subproject`
- [ ] API route handlers return 409 Conflict on duplicate name attempts
- [ ] Zod validation includes name uniqueness check at service layer
