# Data Models — Project Manager UI v1

**Version:** 1.0
**Author:** data-engineering-architect
**Date:** 2026-08-13
**Status:** Draft — pending architecture-planner review

---

## 1. Prisma Schema (Final — Phase 1 Audit)

This is the audited and optimized schema. Changes from ADR-003 are noted with `⚡ AUDIT` comments.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TaskStatus {
  in_work
  review
  done
}

enum TaskPriority {
  high
  medium
  low
}

enum UserRole {
  stakeholder
  agent
}

model Project {
  id          String       @id @default(uuid())
  name        String       @unique                    // ⚡ AUDIT: Added unique constraint (PHASE1-003)
  description String?
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  subprojects Subproject[]
  tasks       Task[]

  @@map("projects")
}

model Subproject {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")    // ⚡ AUDIT: Added updatedAt (PHASE1-004)

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]

  @@index([projectId])                                  // ⚡ AUDIT: Added index (PHASE1-001)
  @@unique([projectId, name])                           // ⚡ AUDIT: Unique per project (PHASE1-003)
  @@map("subprojects")
}

model Task {
  id           String       @id @default(uuid())
  projectId    String       @map("project_id")
  subprojectId String?      @map("subproject_id")
  title        String
  description  String?
  status       TaskStatus   @default(in_work)
  priority     TaskPriority @default(medium)
  assignee     String                                    // ⚡ String, not FK — v1 design (PHASE1-007)
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  subproject Subproject? @relation(fields: [subprojectId], references: [id], onDelete: SetNull)

  @@index([projectId, status])
  @@index([status])
  @@index([assignee])
  // ⚡ AUDIT: No `order` field in v1 — ordering by priority+createdAt (PHASE1-002, Option B)
  @@map("tasks")
}

model User {
  id        String   @id @default(uuid())
  name      String
  role      UserRole @default(stakeholder)
  apiKey    String?  @unique @map("api_key")
  createdAt DateTime @default(now()) @map("created_at")

  // ⚡ AUDIT: No relations to Task/Project — v1 placeholder (PHASE1-007)
  // v2 migration: add Task.assigneeId FK → User.id
  @@map("users")
}
```

---

## 2. Entity Reference

### 2.1 Project

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid() | Globally unique identifier |
| `name` | String(255) | UNIQUE, NOT NULL | Project name (unique across all projects) |
| `description` | String(2000)? | Nullable | Optional project description |
| `createdAt` | DateTime | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Last modification timestamp |

**Relationships:**
- 1:N → Subproject (cascade delete)
- 1:N → Task (cascade delete)

**Grain:** One row per project.

### 2.2 Subproject

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid() | Globally unique identifier |
| `projectId` | UUID | FK → Project.id, NOT NULL | Parent project |
| `name` | String(255) | NOT NULL | Subproject name (unique within project) |
| `description` | String(2000)? | Nullable | Optional description |
| `createdAt` | DateTime | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Last modification timestamp |

**Relationships:**
- N:1 → Project (cascade delete on parent)
- 1:N → Task (set null on subproject delete)

**Grain:** One row per subproject. Unique name within a project.

### 2.3 Task

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid() | Globally unique identifier |
| `projectId` | UUID | FK → Project.id, NOT NULL | Parent project |
| `subprojectId` | UUID? | FK → Subproject.id, nullable | Optional subproject grouping |
| `title` | String(200) | NOT NULL | Task title (required) |
| `description` | String(2000)? | Nullable | Task details |
| `status` | TaskStatus | NOT NULL, default `in_work` | Current status |
| `priority` | TaskPriority | NOT NULL, default `medium` | Priority level |
| `assignee` | String(100) | NOT NULL | Assignee name (free text, not FK) |
| `createdAt` | DateTime | NOT NULL, default now() | Creation timestamp |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Last modification timestamp |

**Relationships:**
- N:1 → Project (cascade delete on parent)
- N:1 → Subproject (set null on subproject delete)

**Grain:** One row per task. Belongs to exactly one project, optionally to one subproject.

### 2.4 User

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid() | Globally unique identifier |
| `name` | String(100) | NOT NULL | Display name |
| `role` | UserRole | NOT NULL, default `stakeholder` | User role |
| `apiKey` | String(255)? | UNIQUE | API key for agent auth |
| `createdAt` | DateTime | NOT NULL, default now() | Creation timestamp |

**Relationships:** None in v1. Placeholder for v2 authentication.

**Grain:** One row per system user (agent or stakeholder placeholder).

---

## 3. Enum Values

### TaskStatus

| Value | Display | Order |
|---|---|---|
| `in_work` | In Work | Column 1 (Kanban) |
| `review` | Review | Column 2 (Kanban) |
| `done` | Done | Column 3 (Kanban) |

### TaskPriority

| Value | Display | Sort Order | Color |
|---|---|---|---|
| `high` | High | 1 (first) | Red |
| `medium` | Medium | 2 | Yellow |
| `low` | Low | 3 (last) | Green |

### UserRole

| Value | Description |
|---|---|
| `stakeholder` | Viewer (no API access) |
| `agent` | AI agent (full CRUD via API key) |

---

## 4. Index Strategy

| Index | Table | Columns | Purpose | Query Pattern |
|---|---|---|---|---|
| PK (auto) | projects | id | Primary lookup | `WHERE id = ?` |
| UNIQUE (auto) | projects | name | Prevent duplicates | `WHERE name = ?` |
| PK (auto) | subprojects | id | Primary lookup | `WHERE id = ?` |
| FK (auto) | subprojects | projectId | Join to Project | `WHERE project_id = ?` |
| explicit | subprojects | projectId | Filter subprojects by project | `WHERE project_id = ? ORDER BY name` |
| UNIQUE | subprojects | projectId, name | Prevent dup names per project | Constraint enforcement |
| PK (auto) | tasks | id | Primary lookup | `WHERE id = ?` |
| explicit | tasks | projectId, status | Kanban board load | `WHERE project_id = ? AND status = ?` |
| explicit | tasks | status | Global status filter | `WHERE status = ?` |
| explicit | tasks | assignee | Assignee lookup | `WHERE assignee = ?` |
| UNIQUE (auto) | users | id | Primary lookup | `WHERE id = ?` |
| UNIQUE (auto) | users | apiKey | API key auth | `WHERE api_key = ?` |

---

## 5. Cascade Behavior

| Parent Delete | Child | Action | Rationale |
|---|---|---|---|
| Project deleted | Subproject | CASCADE | Subprojects cannot exist without project |
| Project deleted | Task | CASCADE | Tasks cannot exist without project |
| Subproject deleted | Task | SET NULL | Task survives, loses subproject grouping |

---

## 6. v1 Design Decisions

| Decision | Value | Rationale | Finding |
|---|---|---|---|
| `Task.assignee` type | String (not FK) | PRD uses free-text names; no user auth in v1 | PHASE1-007 |
| Task ordering | `ORDER BY priority ASC, createdAt DESC` | No drag-and-drop in v1; deterministic ordering without schema change | PHASE1-002 |
| Task `order` field | Not in v1 | Planned for v2 drag-and-drop | PHASE1-002 |
| User model relations | None in v1 | Placeholder for v2 auth | PHASE1-007 |
| PgBouncer | Not in v1 | Single server, single instance — Prisma pool sufficient | PHASE1-006 |

---

## 7. v2 Migration Path

| Change | Description | Trigger |
|---|---|---|
| `Task.assigneeId` FK | Add FK to User, migrate existing assignee strings | v2 user authentication |
| `Task.order` field | Integer for drag-and-drop positioning | v2 manual task reordering |
| PgBouncer | Add connection pooling middleware | Multi-instance Next.js deployment |
| Audit log table | Track all task mutations with actor/timestamp | Compliance requirement |
| Soft deletes | Add `deletedAt` to Project/Task | Data retention policy |
