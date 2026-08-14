# PHASE1-007: User Model Isolation — No FK Relations

**Severity:** Low
**Category:** Data Model
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The `User` model exists in the schema but has no relations to `Task` or `Project`. The `Task.assignee` field is a plain `String` (not a FK to `User`). This means:
- The User model is effectively orphaned in v1
- `Task.assignee` cannot enforce referential integrity
- No way to query "all tasks assigned to user X" with FK guarantees

## Impact

This is an **intentional design decision** per ADR-003:
> "PRD uses free-text assignee names; User model is minimal in v1"

The PRD specifies name-based assignment with no user authentication for viewers. The `User` model serves as a placeholder for v2 authentication.

## Recommendation

### For v1: Accept current design

- Keep `Task.assignee` as `String` — matches PRD requirements
- Keep `User` model isolated — seed with agent user record only
- Document the isolation so v2 migration is planned

### For v2 migration path

When v2 adds user authentication:
1. Add `assigneeId String?` FK to `User` on Task model
2. Run data migration: match existing `assignee` strings to `User.name` and populate `assigneeId`
3. After migration, deprecate `assignee` string field or keep both for backward compatibility

```prisma
// v2 migration
model Task {
  // ...
  assignee     String       // kept for backward compat
  assigneeId   String?      // new FK
  assigneeUser User?        @relation(fields: [assigneeId], references: [id])
}
```

## Acceptance Criteria

- [ ] User model isolation documented in data-models.md
- [ ] v2 migration path noted
- [ ] Seed script creates at least one User record (agent)
