# Data Dictionary — Project Manager UI v1

**Version:** 1.0
**Author:** data-engineering-architect
**Date:** 2026-08-13

---

## 1. Overview

This document defines all data elements used in the Project Manager UI v1 application.

---

## 2. Tables

### 2.1 `projects`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | uuid() | Primary key |
| `name` | VARCHAR(255) | No | — | Project name (unique) |
| `description` | VARCHAR(2000) | Yes | — | Optional description |
| `created_at` | TIMESTAMP | No | now() | Creation time |
| `updated_at` | TIMESTAMP | No | now() | Last update time (auto) |

### 2.2 `subprojects`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | uuid() | Primary key |
| `project_id` | UUID | No | — | FK → projects.id (cascade delete) |
| `name` | VARCHAR(255) | No | — | Subproject name (unique per project) |
| `description` | VARCHAR(2000) | Yes | — | Optional description |
| `created_at` | TIMESTAMP | No | now() | Creation time |
| `updated_at` | TIMESTAMP | No | now() | Last update time (auto) |

### 2.3 `tasks`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | uuid() | Primary key |
| `project_id` | UUID | No | — | FK → projects.id (cascade delete) |
| `subproject_id` | UUID | Yes | — | FK → subprojects.id (set null on delete) |
| `title` | VARCHAR(200) | No | — | Task title |
| `description` | VARCHAR(2000) | Yes | — | Task details |
| `status` | task_status | No | in_work | Current status (enum) |
| `priority` | task_priority | No | medium | Priority level (enum) |
| `assignee` | VARCHAR(100) | No | — | Assignee name (free text) |
| `created_at` | TIMESTAMP | No | now() | Creation time |
| `updated_at` | TIMESTAMP | No | now() | Last update time (auto) |

### 2.4 `users`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | uuid() | Primary key |
| `name` | VARCHAR(100) | No | — | Display name |
| `role` | user_role | No | stakeholder | User role (enum) |
| `api_key` | VARCHAR(255) | Yes | — | API key for agent auth (unique) |
| `created_at` | TIMESTAMP | No | now() | Creation time |

---

## 3. Enum Types

### `task_status`

| Value | Description | Kanban Column |
|---|---|---|
| `in_work` | Task is actively being worked on | Column 1 |
| `review` | Task is under review | Column 2 |
| `done` | Task is completed | Column 3 |

### `task_priority`

| Value | Description | Sort Priority |
|---|---|---|
| `high` | Urgent — top priority | 1 (first) |
| `medium` | Normal priority | 2 |
| `low` | Low priority — backlog | 3 (last) |

### `user_role`

| Value | Description |
|---|---|
| `stakeholder` | Viewer role (no API write access) |
| `agent` | AI agent role (full CRUD via API key) |

---

## 4. Business Rules

| Rule | Description | Enforcement |
|---|---|---|
| BR-001 | Project name must be unique | DB UNIQUE constraint |
| BR-002 | Subproject name must be unique within its project | DB UNIQUE(project_id, name) |
| BR-003 | Task must belong to a project | FK NOT NULL constraint |
| BR-004 | Deleting a project deletes all its tasks and subprojects | DB CASCADE |
| BR-005 | Deleting a subproject sets task.subproject_id to NULL | DB SET NULL |
| BR-006 | Task title must be 1-200 characters | Zod validation |
| BR-007 | Task assignee must be 1-100 characters | Zod validation |
| BR-008 | API key must be unique (if provided) | DB UNIQUE constraint |
