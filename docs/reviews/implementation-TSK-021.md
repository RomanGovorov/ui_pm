# TSK-021 Implementation Report: Delete Task Button in UI

**Status**: Complete  
**Date**: 2026-08-14  
**Implementer**: code-implementer

## Summary

Implemented delete task functionality in the Kanban board UI following ADR-008 architecture decisions. All changes are frontend-only; the DELETE API endpoint already exists.

## Changes Made

### 1. `src/lib/context/app-context.tsx`
- Added `deleteTask(taskId: string): Promise<void>` to `AppContextValue` interface
- Implemented optimistic update pattern:
  - Snapshot task for rollback
  - Call `removeTaskOptimistic(taskId)` immediately
  - DELETE `/api/tasks/${taskId}` with API key header
  - On success: toast notification (SSE `task_deleted` is idempotent)
  - On error: rollback by re-adding task, show error toast
- Exported in context value

### 2. `src/app/components/modals/DeleteTaskModal.tsx` (NEW)
- Thin confirmation dialog wrapping `ModalWrapper`
- Props: `task`, `isOpen`, `onClose`, `onConfirm`
- Message: "Are you sure you want to delete '{task.title}'? This action cannot be undone."
- Two buttons: Cancel (primary, initial focus) and Delete (destructive styling with `bg-accent-red`)
- **WCAG AA compliant**: Cancel button receives initial focus (safe default for destructive actions)
- Uses `ModalWrapper` for focus trap, ESC close, scroll lock, aria-modal

### 3. `src/app/components/kanban/TaskCard.tsx`
- Added `onDelete?: (task: Task) => void` prop
- Added trash icon button next to edit button (admin-only guard: `isAdmin && onDelete`)
- Trash icon: Heroicons trash can SVG
- Hover state: `hover:text-accent-red` (visual feedback for destructive action)
- Aria-label: `Delete task: ${task.title}`
- Wrapped buttons in flex container with `gap-1` for proper spacing

### 4. `src/app/components/kanban/KanbanColumn.tsx`
- Added `onDelete?: (task: Task) => void` to props interface
- Threaded `onDelete` prop through to `TaskCard` (same pattern as `onEdit`)

### 5. `src/app/components/kanban/KanbanBoard.tsx`
- Added state: `const [deletingTask, setDeletingTask] = useState<Task | null>(null)`
- Added `handleDelete` callback: opens modal by setting state
- Added `handleDeleteConfirm` callback: closes modal, calls `deleteTask` from context
- Rendered `DeleteTaskModal` with state management
- Passed `onDelete={handleDelete}` to all `KanbanColumn` components

### 6. Tests: `src/lib/__tests__/task-delete-ui.test.tsx` (NEW)
- **19 tests, all passing**
- TaskCard admin-only delete button tests (5 tests):
  - Shows delete button when `isAdmin=true`
  - Hides delete button when `isAdmin=false` (stakeholder)
  - Delete button calls `onDelete` callback with task
  - Hides delete button when `onDelete` prop not provided
  - Shows both Edit and Delete buttons for admin
- DeleteTaskModal rendering tests (6 tests):
  - Renders confirmation message with task title
  - Renders Cancel and Delete buttons
  - Does not render when task is null
  - Does not render when `isOpen` is false
  - Calls `onConfirm` when Delete clicked
  - Calls `onClose` when Cancel clicked
- App-context integration tests (2 tests):
  - Source code verification: optimistic remove + rollback pattern
  - Source code verification: `deleteTask` exported in context value
- TSK-021 source code verification tests (6 tests):
  - DeleteTaskModal.tsx exists
  - Uses ModalWrapper
  - Focuses Cancel button (WCAG safe default)
  - TaskCard has conditional `isAdmin && onDelete` render
  - KanbanBoard imports DeleteTaskModal
  - KanbanColumn threads onDelete prop

## Verification

✅ **Build**: `npm run build` — passes (exit code 0)  
✅ **Tests**: `npm test` — all 19 new tests pass  
✅ **No regressions**: Pre-existing test failures (7) are unrelated to TSK-021 changes  
✅ **WCAG AA**: Cancel button initial focus, aria-labels, focus trap, keyboard navigation  
✅ **Follows patterns**: Exact same patterns as EditTaskModal and edit button  
✅ **No backend changes**: Pure frontend implementation  

## Architecture Compliance (ADR-008)

✅ `deleteTask()` function in `app-context.tsx` — optimistic remove → DELETE API → rollback on error + toast  
✅ Thin `DeleteTaskModal` wrapping `ModalWrapper` — confirmation dialog  
✅ SSE `task_deleted` is idempotent (no special handling needed)  
✅ Cancel button gets initial focus (not Delete) — WCAG safe default  
✅ Trash button in TaskCard next to edit button, admin-only guard  

## Technical Debt

None. Implementation follows existing patterns exactly. No shortcuts or compromises.

## Next Steps

Transition to `code-reviewer` (T34) for independent code review focusing on:
- Security: XSS prevention in task title rendering, CSRF protection
- Performance: No unnecessary re-renders, proper memoization
- Accessibility: WCAG AA compliance, keyboard navigation, screen reader support
- Code quality: Pattern consistency, error handling, test coverage
