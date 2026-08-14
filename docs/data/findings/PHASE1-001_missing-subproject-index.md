# PHASE1-001: Missing Index on Subproject.projectId

**Severity:** Medium
**Category:** Indexing Strategy
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The `Subproject` model defines a FK `projectId` referencing `Project.id`, but has no `@@index([projectId])` annotation. Prisma automatically creates an index for FK fields in most cases, but this should be made explicit in the schema for clarity and to guarantee the index exists after migration.

## Impact

Without an index on `Subproject.projectId`, the query `SELECT * FROM subprojects WHERE project_id = ?` (used when loading a project's subprojects for the sidebar/selector) requires a full table scan. At ~100 tasks / 5-10 projects this is negligible, but becomes problematic at scale.

## Recommendation

Add explicit index annotation:

```prisma
model Subproject {
  // ...
  @@index([projectId])
  @@map("subprojects")
}
```

## Acceptance Criteria

- [ ] `@@index([projectId])` added to Subproject model
- [ ] Migration generated and tested
- [ ] EXPLAIN ANALYZE confirms index usage on `WHERE project_id = ?`
