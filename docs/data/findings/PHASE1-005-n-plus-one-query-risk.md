# PHASE1-005: N+1 Query Risk in Dashboard Load

**Severity:** High
**Category:** Query Optimization
**Date:** 2026-08-13
**Author:** data-engineering-architect

## Finding

The dashboard requires loading projects, their subprojects, and all tasks. Without proper `include` or `select` strategy, this creates N+1 queries:
1. Query 1: `SELECT * FROM projects` (N projects)
2. Query 2..N+1: `SELECT * FROM tasks WHERE project_id = ?` (per project)
3. Query 2..N+1: `SELECT * FROM subprojects WHERE project_id = ?` (per project)

At 5-10 projects, this is 21 queries for the dashboard load.

## Impact

- Dashboard initial load latency multiplied by number of projects
- Connection pool exhaustion risk under concurrent dashboard loads
- Wasted DB CPU on redundant round trips

## Recommendation

### Single Query with Nested Include (Recommended for v1)

```typescript
// Load entire dashboard in 1 query
const projects = await prisma.project.findMany({
  include: {
    subprojects: {
      select: { id: true, name: true, projectId: true },
    },
    tasks: {
      select: {
        id: true, title: true, status: true, priority: true,
        assignee: true, subprojectId: true, createdAt: true, updatedAt: true,
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    },
  },
});
```

**Trade-off:** This loads ALL tasks for ALL projects. At ~100 tasks total, this is fine. At 10,000+ tasks, switch to per-project lazy loading.

### Per-Project Query (Alternative for larger datasets)

```typescript
// 1 + 1 queries: projects list + tasks for selected project only
const projects = await prisma.project.findMany({
  select: { id: true, name: true },
});
const tasks = await prisma.task.findMany({
  where: { projectId: currentProjectId },
  select: { /* fields */ },
  orderBy: [
    { priority: 'asc' },
    { createdAt: 'desc' },
  ],
});
```

## Acceptance Criteria

- [ ] Dashboard load uses single query with `include` OR 2-query approach (projects + selected project tasks)
- [ ] All Task queries include `select` to avoid loading `description` (large text) when not needed
- [ ] Query count logged in development mode (Prisma `log: ['query']`)
