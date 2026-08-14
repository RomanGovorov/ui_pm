# Release Notes — v1.2.0

> **Release Date**: 2026-08-14
> **Previous Version**: v1.1.0 (2026-08-14)

v1.2.0 introduces task editing capabilities and status selection during creation. Admin and agent users can now modify existing tasks via a dedicated modal or API, set initial status when creating tasks, and benefit from optimistic UI updates synced in real time via SSE.

---

## Table of Contents

- [New Features](#new-features)
- [Changes](#changes)
- [Breaking Changes](#breaking-changes)
- [Migration Guide](#migration-guide)
- [Documentation](#documentation)

---

## New Features

### Status Selection During Task Creation

The CreateTaskModal now includes a **Status** dropdown that lets admins and agents choose the initial status (`in_work`, `review`, or `done`) when creating a new task. Previously, all tasks were created with `status: "in_work"` and had to be moved manually after creation.

| Prior behavior | New behavior |
|---------------|-------------|
| Tasks always start at `in_work` | Status selectable during creation (default: `in_work`) |
| Agent must POST → PUT to reach `review`/`done` | Single POST to target status |

```bash
# Create a task already in review status
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "projectId": "<uuid>",
    "title": "Review PR #42",
    "status": "review",
    "priority": "high",
    "assignee": "Agent-T67"
  }'
```

### Edit Task Modal (UI)

Admin and agent users now see a pencil icon (✏️) on every task card. Clicking it opens the **Edit Task** modal with pre-filled values for all fields:

- Title
- Description
- Status (`in_work`, `review`, `done`)
- Priority (`high`, `medium`, `low`)
- Assignee
- Project (dropdown)
- Subproject (conditional dropdown, shown when project changes)

**Partial updates**: Only modified fields are sent to the server. The API accepts any subset of the editable fields.

**Optimistic updates**: The UI applies changes immediately upon user confirmation, before the server response arrives. If the server returns an error, the UI reverts to the previous state. All clients receive the change via SSE (`task_updated` event).

> **Visibility**: The edit icon is visible only to users with write access (admin role, agent role via API key). Stakeholders do not see the pencil icon — their view remains read-only.

### Edit Task via API (PUT /api/tasks/{id})

All editable task fields are available through the PUT endpoint:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | No | 1–200 characters |
| `description` | string \| null | No | Max 2000 chars, or `null` to clear |
| `status` | enum | No | `in_work`, `review`, `done` |
| `priority` | enum | No | `high`, `medium`, `low` |
| `assignee` | string | No | 1–100 characters |
| `projectId` | string (UUID) | No | Valid project UUID |
| `subprojectId` | string (UUID) \| null | No | Valid subproject UUID, or `null` |

Only included fields are updated — omitting a field leaves it unchanged. An empty payload (all fields omitted) returns `400 VALIDATION_ERROR: No fields to update`.

Example:

```bash
# Change multiple fields at once
curl -X PUT http://localhost:3000/api/tasks/<task-id> \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "status": "review",
    "priority": "high",
    "assignee": "New-Agent"
  }'
```

### Real-Time Sync

Task edits (both UI and API) broadcast a `task_updated` SSE event to all connected clients. This ensures that Kanban boards across all active sessions reflect changes within milliseconds without requiring page refresh.

### Delete Task Modal (UI)

Admin and agent users can now permanently remove tasks directly from the Kanban board. A **trash icon** (🗑️) appears on every task card for users with write access; stakeholders do not see this icon.

**How it works:**

1. Click the **trash icon** (🗑️) on any task card. A confirmation dialog opens with Cancel/Delete buttons and a warning that deletion is irreversible.
2. Click **"Delete"** to permanently remove the task, or **"Cancel"** to keep it.

**Optimistic behavior:**

- The task card disappears immediately upon confirmation (optimistic update).
- If the server returns an error (permission denied, network failure), the task card reappears (rollback).
- A `task_deleted` SSE event broadcasts the removal to all connected clients in real time.

**Safety notes:**

- There is no trash bin or soft-delete — deleted tasks are permanently removed from the database.
- The confirmation dialog prevents accidental deletions by requiring explicit user action.

---

## Changes

### Frontend Components Added

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `EditTaskModal.tsx` | `src/app/components/modals/EditTaskModal.tsx` | Edit task form with optimistic updates and validation |
| `DeleteTaskModal.tsx` | `src/app/components/modals/DeleteTaskModal.tsx` | Delete confirmation dialog with warning and Cancel/Delete buttons |

### Frontend Components Updated

| Component | Changes |
|-----------|---------|
| `CreateTaskModal.tsx` | Added Status dropdown (`in_work` / `review` / `done`) to creation form |
| `TaskCard.tsx` | Added pencil icon (✏️) button and trash icon (🗑️), visible only for admin/agent roles; wired `onEdit` and `onDelete` callbacks |
| `KanbanBoard.tsx` | Added `editingTask` state + renders `EditTaskModal`; added `deletingTaskId` state + renders `DeleteTaskModal` when deletion initiated |

### API Schema Updates

Updated `UpdateTaskRequest` schema in OpenAPI spec to include:

- `title` (optional, 1–200 chars)
- `description` (nullable, max 2000 chars)
- `status` (enum: `in_work` / `review` / `done`)
- `priority` (enum: `high` / `medium` / `low`)
- `assignee` (optional, 1–100 chars)
- `projectId` (optional, valid UUID)
- `subprojectId` (nullable, valid UUID)

Updated `CreateTaskRequest` schema:

- `status` field made explicit (previously implicit default), optional, defaults to `in_work`

### Service Layer

| Module | Changes |
|--------|---------|
| `task-service.ts` | `update()` method filters out `undefined` values before sending to Prisma (partial update support); emits `task_updated` SSE event |
| `validators/task.ts` | `updateTaskSchema` supports all seven fields as optional; rejects empty payloads implicitly via service-layer check |

---

## Breaking Changes

None. This release adds functionality without modifying existing behaviors:

- Existing `status: "in_work"` default for task creation is preserved as the dropdown's default option.
- API endpoints (`POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id`) retain their existing authentication requirements and response formats.
- No migration or configuration changes required.

---

## Migration Guide

No migration steps needed. Deploy normally:

```bash
docker compose down --remove-orphans
docker compose up --build -d
```

Existing API clients continue working — they simply don't send `status` during creation (defaults to `in_work`) or use `PUT` for updates (not previously supported by UI but still accepted by API).

---

## Documentation

### New / Updated Documentation Files

| Document | Path | Changes |
|----------|------|---------|
| Getting Started | [`docs/guides/user/getting-started.md`](../user/getting-started.md) | Added Status dropdown note, Editing Tasks section, Deleting Tasks section, API partial-update examples, Troubleshooting entries |
| OpenAPI Spec | [`docs/guides/api/openapi.yaml`](../api/openapi.yaml) | Explicit `status` field documented in `CreateTaskRequest`; `UpdateTaskRequest` fully covers all editable fields; DELETE endpoint has CookieAuth + 403 |
| Auth Reference | [`docs/guides/api/auth.md`](../api/auth.md) | Role table now references delete capability |
| API README | [`docs/guides/api/README.md`](../api/README.md) | Added DELETE endpoint usage examples (curl + fetch), error response table, Prisma P2025→404 mapping notes, SSE event emission for task deletion |
| CHANGELOG | [`docs/guides/release-notes/CHANGELOG.md`](CHANGELOG.md) | TSK-020 entry under Testing, TSK-021 UI feature entry with frontend components and test details |
| Troubleshooting | [`docs/guides/user/troubleshooting.md`](../user/troubleshooting.md) | Added "Delete Task Issues" section (delete button visibility, optimistic rollback, accidental deletion recovery) |

### Task ID Mapping

| TSK | Feature | Status |
|-----|---------|--------|
| TSK-019 | Task editing & status selection | ✅ Complete |
| TSK-020 | DELETE /api/tasks/{id} test coverage + OpenAPI spec update | ✅ Complete |
| TSK-021 | Delete task button UI (trash icon + confirmation dialog) | ✅ Complete |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| New components | 2 (`EditTaskModal`, `DeleteTaskModal`) |
| Modified components | 3 (`CreateTaskModal`, `TaskCard`, `KanbanBoard`) |
| New API examples | 3 (partial update, multi-field update, clear description) |
| Integration tests (DELETE endpoint) | 22 |
| UI tests (delete modal) | 19 |
| Breaking changes | 0 |
| Database migrations | 0 |
| Environment variables | 0 |

---

## Known Limitations

| Issue | Impact | Future Work |
|-------|--------|-------------|
| Project assignment change requires full reload | Moving a task between projects works but child subproject list isn't auto-refreshed | Auto-refresh subproject options on project change |
| No history/audit trail for task edits | Cannot see what changed and who changed it | Implement audit log (see deferred TSK-HISTORY) |
| Optimistic update revert shows no detailed error | When server validation fails, UI reverts silently (except inline error message) | Consider toast notification for failed updates |
