# ADR-008: Task Delete Confirmation with Optimistic Update

**Status:** Accepted
**Date:** 2026-08-14
**Task:** TSK-021

## Context

The DELETE `/api/tasks/[id]` endpoint already exists (TSK-020) and SSE `task_deleted` events are already handled client-side. We need to add a delete button to the TaskCard UI for admin users. The key design question is: where to place the delete orchestration logic (API call + optimistic update + rollback) and how to handle the SSE redundancy (optimistic remove + SSE event both trying to remove the same task).

## Options Considered

### Option A: Delete logic in DeleteTaskModal component

Put the fetch call, optimistic update, and rollback directly in `DeleteTaskModal` (like `EditTaskModal` does for PUT).

**Pros:** Self-contained modal, similar to EditTaskModal pattern.
**Cons:** `EditTaskModal` manages complex form state which justifies its internal orchestration. A delete confirmation modal is trivially simple — embedding fetch logic adds unnecessary coupling. Also, `deleteTask` could be reused by future features (bulk delete, keyboard shortcut).

### Option B: Delete logic in `app-context` as `deleteTask()` function (CHOSEN)

Add a `deleteTask(taskId: string)` async function to the AppContext that encapsulates: optimistic remove → API call → rollback on error + toast. `DeleteTaskModal` stays thin — just calls `deleteTask` and closes.

**Pros:** Reusable, testable in isolation, keeps modal thin, consistent with `addTaskOptimistic`/`removeTaskOptimistic`/`updateTaskOptimistic` naming. Future features (bulk operations, keyboard shortcuts) can call `deleteTask` directly.
**Cons:** Slightly larger AppContext interface (one more function).

### Option C: Inline confirmation (popover) instead of modal

Use a small popover/tooltip-style confirmation attached to the trash button instead of a full modal.

**Pros:** Less disruptive UX, faster interaction.
**Cons:** Breaks existing modal pattern consistency. Popover positioning complexity (edge cases near viewport edges). Accessibility harder (focus management for popovers is more complex than modals). ModalWrapper already handles all accessibility requirements.

## Decision

**Option B** — `deleteTask()` in app-context with a thin `DeleteTaskModal` confirmation wrapper.

### SSE Redundancy Handling

The SSE `task_deleted` event will arrive after the API call completes, but `removeTaskOptimistic` has already removed the task from state. The SSE handler (`setTasks(prev => prev.filter(t => t.id !== id))`) is idempotent — filtering an already-removed task is a no-op. **No special handling needed.**

### Delete Button Placement

The trash icon button is placed in the same flex row as the edit (pencil) button, inside the priority badge row. Both share the same `isAdmin` guard. This follows the existing pattern and keeps admin actions co-located.

## Consequences

### Positive
- Consistent with existing optimistic update pattern (EditTaskModal)
- `deleteTask` is reusable for future features
- Thin modal component — easy to test and maintain
- SSE redundancy handled naturally (idempotent filter)
- All accessibility requirements inherited from ModalWrapper (focus trap, ESC, scroll lock, aria-modal)

### Negative
- AppContext grows by one function (minimal impact)

### Neutral
- Confirmation modal adds one click to the delete flow (acceptable for destructive action per WCAG 3.3.4)
