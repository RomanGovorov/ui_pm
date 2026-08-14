# Optimized Queries — Project Manager UI v1

**Version:** 1.0
**Author:** data-engineering-architect
**Date:** 2026-08-13
**Status:** Draft — pending architecture-planner review

---

## 1. Query Patterns by API Endpoint

### 1.1 GET /api/projects — List All Projects

**Purpose:** Sidebar project list, project selector.

```typescript
// lib/services/project-service.ts
async list(): Promise<Project[]> {
  return prisma.project.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}
```

**Why `select` not `include`:** We don't need full task data for the sidebar — just the count. `_count` avoids loading child rows.

**SQL generated:**
```sql
SELECT p.id, p.name, p.description, p.updated_at,
       (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
FROM projects p
ORDER BY p.name ASC;
```

**Query count:** 1

---

### 1.2 GET /api/projects/:id — Single Project Detail

**Purpose:** Load project with subprojects for header selector.

```typescript
async getById(id: string): Promise<ProjectWithSubprojects | null> {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      subprojects: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
  });
}
```

**Query count:** 1 (uses PK index)

---

### 1.3 GET /api/projects/:id/tasks — Kanban Board Load

**Purpose:** Load all tasks for a project, grouped by status (kanban columns).

```typescript
// ⚡ CRITICAL: This is the most frequent read query.
// Strategy: Single query with nested include, explicit select + orderBy.

async listByProject(projectId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      description: true,       // Needed for card tooltip/modal
      status: true,
      priority: true,
      assignee: true,
      subprojectId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { priority: 'asc' },      // high=0, medium=1, low=2 (enum definition order)
      { createdAt: 'desc' },    // newest first within same priority
    ],
  });
}
```

**Why `findMany` not `include` on Project:** Loading via `project.tasks` adds an extra FK lookup. Direct `task.findMany({ where: { projectId } })` uses the composite index `[projectId, status]` and is more explicit.

**SQL generated:**
```sql
SELECT id, title, description, status, priority, assignee,
       subproject_id, created_at, updated_at
FROM tasks
WHERE project_id = ?
ORDER BY priority ASC, created_at DESC;
```

**Query count:** 1 (uses composite index on projectId)

---

### 1.4 GET /api/tasks — Global Task List (with filters)

**Purpose:** Dashboard showing all tasks across all projects (rare — usually filtered by project).

```typescript
async list(filters: { status?: TaskStatus; assignee?: string } = {}): Promise<Task[]> {
  return prisma.task.findMany({
    where: {
      ...(filters.status && { status: filters.status }),
      ...(filters.assignee && { assignee: filters.assignee }),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignee: true,
      projectId: true,
      updatedAt: true,
    },
    orderBy: [
      { priority: 'asc' },
      { updatedAt: 'desc' },
    ],
  });
}
```

**Query count:** 1

---

### 1.5 POST /api/tasks — Create Task

**Purpose:** Agent or UI creates a new task.

```typescript
async create(data: CreateTaskInput): Promise<Task> {
  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      subprojectId: data.subprojectId,
      title: data.title,
      description: data.description,
      status: data.status ?? 'in_work',
      priority: data.priority ?? 'medium',
      assignee: data.assignee,
    },
  });

  // Emit SSE event
  eventBus.emit('task_created', task);

  return task;
}
```

**Transaction:** Not needed — single INSERT.

**Query count:** 1

---

### 1.6 PUT /api/tasks/:id — Update Task

**Purpose:** Agent updates task status, priority, assignee.

```typescript
async update(id: string, data: UpdateTaskInput): Promise<Task | null> {
  // Filter out undefined values (Prisma ignores them, but clean input is safer)
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  const task = await prisma.task.update({
    where: { id },
    data: cleanData as Prisma.TaskUpdateInput,
  });

  // Emit SSE event
  eventBus.emit('task_updated', task);

  return task;
}
```

**Transaction:** Not needed — single UPDATE.

**Query count:** 1

---

### 1.7 DELETE /api/tasks/:id — Delete Task

**Purpose:** Agent or UI deletes a task.

```typescript
async delete(id: string): Promise<Task | null> {
  const task = await prisma.task.delete({
    where: { id },
    select: { id: true },
  });

  // Emit SSE event with minimal payload
  eventBus.emit('task_deleted', { id: task.id });

  return task;
}
```

**SSE payload optimization:** Only send `{ id }` — client removes card by ID without needing other fields (PHASE1-008).

**Query count:** 1

---

### 1.8 GET /api/events — SSE Stream

**Purpose:** Long-lived connection for real-time updates.

```typescript
// No DB queries in SSE endpoint.
// Events are emitted from service layer after DB writes.
// SSE uses in-memory EventEmitter — no DB connection held.
```

**DB connections:** 0 (pure in-memory pub/sub)

---

## 2. Dashboard Load Strategy

### 2.1 Full Dashboard (All Projects + All Tasks)

Use when loading the initial dashboard for a user who has no selected project.

```typescript
async loadFullDashboard(): Promise<DashboardData> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      subprojects: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // At ~100 tasks total, loading all is fine.
  // Switch to per-project lazy loading at >1000 tasks.
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      assignee: true,
      projectId: true,
      subprojectId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return { projects, tasks };
}
```

**Query count:** 2 (projects + tasks)
**Data volume at v1 scale:** ~100 tasks × ~300B = ~30KB (negligible)

### 2.2 Project-Focused Dashboard (Selected Project)

Use when user has a selected project (majority of sessions).

```typescript
async loadProjectDashboard(projectId: string): Promise<ProjectDashboardData> {
  const [project, tasks] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        subprojects: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        assignee: true,
        subprojectId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
  ]);

  return { project, tasks };
}
```

**Query count:** 2 (run in parallel via Promise.all)
**N+1 eliminated:** No per-task or per-subproject queries

---

## 3. Anti-Patterns to Avoid

### ❌ N+1: Loop with individual queries

```typescript
// BAD: N+1 query — one per project
const projects = await prisma.project.findMany();
for (const project of projects) {
  project.tasks = await prisma.task.findMany({ where: { projectId: project.id } });
}
```

### ❌ Loading all fields when subset needed

```typescript
// BAD: Loads description (up to 2000 chars) for sidebar count
const projects = await prisma.project.findMany({
  include: { tasks: true },  // loads ALL task fields
});
```

### ❌ Relying on default DB ordering

```typescript
// BAD: No explicit ORDER BY — task order is undefined
const tasks = await prisma.task.findMany({ where: { projectId } });
```

---

## 4. Query Performance Targets

| Query | Target (p95) | Index Used | Notes |
|---|---|---|---|
| List projects | < 10ms | PK on id | ~5-10 rows |
| Get project by ID | < 5ms | PK on id | 1 row |
| List tasks by project | < 50ms | Composite [projectId, status] | ~10-20 rows per project |
| Create task | < 20ms | N/A | Single INSERT |
| Update task | < 20ms | PK on id | Single UPDATE |
| Delete task | < 10ms | PK on id | Single DELETE |
| Full dashboard load | < 100ms | Multiple | 2 queries, parallel |

At v1 scale (~100 tasks), all queries should complete in single-digit milliseconds.

---

## 5. SSE Payload Selection

Events emitted after DB writes should use `select` to minimize payload:

```typescript
// lib/services/task-service.ts — SSE-optimized select
const taskSSESelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assignee: true,
  subprojectId: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
  // description excluded (PHASE1-008)
};

// Usage in create/update:
const task = await prisma.task.create({
  data: { ... },
  select: taskSSESelect,
});
eventBus.emit('task_created', task);
```

**Payload size comparison:**
- Full Task JSON: ~1.5-3KB (with description)
- SSE-optimized: ~400-600B
- Reduction: ~80%
