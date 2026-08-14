# ADR-003: Prisma Schema Design

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner
**Task:** TSK-001

---

## Context

The application needs a relational data model to store projects, subprojects, tasks, and users. The PRD specifies PostgreSQL + Prisma. We need to design the schema, relationships, indexes, and enum types.

## Decision

### Prisma Schema

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
  name        String
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

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]

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
  assignee     String
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  project    Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  subproject Subproject? @relation(fields: [subprojectId], references: [id], onDelete: SetNull)

  @@index([projectId, status])
  @@index([status])
  @@index([assignee])
  @@map("tasks")
}

model User {
  id     String   @id @default(uuid())
  name   String
  role   UserRole @default(stakeholder)
  apiKey String?  @unique @map("api_key")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

### Design Rationale

| Decision | Rationale |
|---|---|
| UUID primary keys | Globally unique; safe in API responses |
| `assignee` as string (not FK) | PRD specifies name-based assignment; User model is optional in v1 |
| `onDelete: Cascade` for Project→Task/Subproject | Deleting a project cleans up all children |
| `onDelete: SetNull` for Subproject→Task | Task survives subproject deletion |
| Composite index `[projectId, status]` | Most common query: "tasks for project X grouped by status" |
| Index on `status` | Supports global kanban view across all projects |
| Index on `assignee` | Future: "my tasks" view |
| Separate `User` model | Placeholder for v2 auth; agent user created via seed |

### Key Indexes

```sql
-- Primary query: fetch tasks for a project grouped by status
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);

-- Global kanban or filtered views
CREATE INDEX idx_tasks_status ON tasks(status);

-- Assignee lookup
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
```

## Options Considered

### Alternative A: Integer auto-increment IDs
- Simpler, shorter URLs
- Rejected: UUIDs are safer for API exposure (no enumeration)

### Alternative B: `assignee` as FK to User
- Enforces referential integrity
- Rejected: PRD uses free-text assignee names; User model is minimal in v1

### Alternative C: JSONB for task metadata
- Flexible schema
- Rejected: No need for flexible fields in v1; strict schema is better

## Consequences

- **Positive**: Clean relational model, good index coverage, Prisma type safety
- **Negative**: `assignee` as string means no referential integrity for task ownership
- **Migration path**: In v2, `assignee` can become a FK to `User` with a data migration
