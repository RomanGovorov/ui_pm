# PHASE1-008: SSE Event Payload Optimization

**Severity:** Low
**Category:** Performance
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

When the SSE broadcaster pushes task events (`task_created`, `task_updated`, `task_deleted`) to browser clients, it sends the full Task entity JSON. This includes the `description` field which can be up to 2000 characters, increasing SSE payload size unnecessarily.

## Impact

- SSE payload per event: ~2-3KB with description vs ~500B without
- With multiple concurrent SSE clients (5-10 stakeholders), each event is serialized N times
- `TaskCard` component only displays: title, priority, assignee, status, date — not description

## Recommendation

### Use Prisma `select` for SSE payloads

```typescript
// lib/services/task-service.ts
const taskSelectForSSE = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assignee: true,
  subprojectId: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  // description: false (excluded)
} as const;

// On task update:
const task = await prisma.task.update({
  where: { id },
  data: updateData,
  select: taskSelectForSSE,
});
eventBus.emit('task_updated', task);
```

### For `task_deleted` events

Send minimal payload: `{ id: string }` — client removes card by ID without needing other fields.

## Acceptance Criteria

- [ ] SSE payloads use `select` to exclude `description` field
- [ ] `task_deleted` events send only `{ id }`
- [ ] SSE payload size measured and documented
