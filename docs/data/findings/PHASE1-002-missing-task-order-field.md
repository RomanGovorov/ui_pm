# PHASE1-002: Missing Position/Order Field for Kanban Card Ordering

**Severity:** High
**Category:** Data Model
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The `Task` model has no `position` or `order` field. The KanbanBoard component renders tasks grouped by status, but within each column, the card order is undefined (defaults to `createdAt` if no ORDER BY is specified). The PRD does not explicitly require manual reordering (drag-and-drop is v2), but even automatic ordering (by priority, then date) requires an explicit ORDER BY clause.

## Impact

Without an `order` field:
- Tasks appear in arbitrary order within columns (DB-dependent, usually by PK/insertion order)
- If drag-and-drop is added in v2, there is no field to persist position
- Stakeholders expect consistent ordering (e.g., High priority first, then by date)

## Recommendation

### Option A (Recommended for v1): Add `order` field

```prisma
model Task {
  // ... existing fields ...
  order        Int          @default(0) @map("task_order")

  @@index([projectId, status, order])
}
```

- Default `order: 0` for existing tasks
- New tasks get `order` based on current count in their status column
- ORDER BY `order ASC, createdAt DESC` in queries

### Option B: Order by composite of priority + date (no schema change)

```typescript
// In taskService.list()
prisma.task.findMany({
  where: { projectId },
  orderBy: [
    { priority: 'asc' },    // high > medium > low (enum order)
    { createdAt: 'desc' },
  ],
});
```

**Trade-off:** Enum ordering in Prisma follows definition order (`high=0, medium=1, low=2`), which is correct. But this prevents future manual reordering.

## Decision

**Recommended: Option B for v1** (no schema change needed), with `order` field planned for v2 drag-and-drop. This avoids schema migration for v1 while providing deterministic ordering.

## Acceptance Criteria

- [ ] Task queries include explicit `orderBy` (not relying on default DB order)
- [ ] ORDER BY clause documented in `optimized-queries.md`
- [ ] `order` field tracked as v2 enhancement
