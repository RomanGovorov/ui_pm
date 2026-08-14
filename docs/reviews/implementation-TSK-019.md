# TSK-019 Implementation Report: Task Editing and Status Selection

## Summary

Implemented task editing capability with admin-only access, status selection on task creation, and full edit modal with optimistic updates.

## Changes Implemented

### 1. Validator Updates (`src/lib/validators/task.ts`)
- Added `status` field to `createTaskSchema` (optional, defaults to `'in_work'`, enum: `in_work | review | done`)
- Added `projectId` field to `updateTaskSchema` (optional, UUID string)

### 2. Service Layer (`src/lib/services/task-service.ts`)
- `create()` now passes `status` to Prisma: `status: data.status ?? 'in_work'`

### 3. App Context (`src/lib/context/app-context.tsx`)
- Added `updateTaskOptimistic(taskId, updates)` method for optimistic task updates
- Used by EditTaskModal for instant UI feedback with rollback on error

### 4. CreateTaskModal (`src/app/components/modals/CreateTaskModal.tsx`)
- Added status dropdown (`<select>`) with options: In Work, Review, Done
- Default value: `in_work`
- Status included in form submission body and optimistic task

### 5. TaskCard (`src/app/components/kanban/TaskCard.tsx`)
- Imported `useAuth` from auth-context
- Added `onEdit?: (task: Task) => void` callback prop
- Edit button (pencil icon) visible only when `isAdmin === true`
- Positioned in top-right corner of card, same row as priority badge
- Proper aria-label: `Edit task: {title}`

### 6. KanbanColumn (`src/app/components/kanban/KanbanColumn.tsx`)
- Added `onEdit?: (task: Task) => void` prop, passed through to TaskCard

### 7. KanbanBoard (`src/app/components/kanban/KanbanBoard.tsx`)
- Added `editingTask` state (Task | null)
- Added `handleEdit` and `handleCloseEdit` callbacks (memoized)
- Passes `onEdit={handleEdit}` to each KanbanColumn
- Renders `EditTaskModal` when `editingTask` is set

### 8. EditTaskModal — NEW (`src/app/components/modals/EditTaskModal.tsx`)
- Follows CreateTaskModal pattern exactly
- Pre-fills all fields from existing task data
- Fields: title, description, status, priority, assignee, project (dropdown), subproject (conditional dropdown)
- Fetches subprojects via `GET /api/projects/{id}` when project changes
- Submits partial update via `PUT /api/tasks/{id}` (only changed fields)
- Optimistic update with rollback on error
- Uses ModalWrapper for accessibility (focus trap, ESC, aria)
- "No changes" detection: closes immediately if nothing changed

### 9. Tests
- **`validators.test.ts`**: Added 5 new tests (status default, explicit status values, invalid status, valid projectId, invalid projectId)
- **`edit-task-modal.test.tsx`**: New file with 9 tests (pre-filled fields, status/priority/project dropdowns, buttons, required markers, status variants, null description)

## Test Results

| Test Suite | Status |
|---|---|
| validators.test.ts | ✅ 15/15 passed (5 new) |
| edit-task-modal.test.tsx | ✅ 9/9 passed (all new) |
| integration-validation.test.ts | ✅ All passed |
| **Build** | ✅ `npm run build` success |

## Build Status

`npm run build` — **PASS** (no new warnings or errors)

## Key Decisions

1. **Admin-only edit button**: Uses `useAuth().isAdmin` — server-enforced (middleware blocks stakeholder writes with 403)
2. **Partial updates**: EditTaskModal sends only changed fields, matching the existing PUT API contract
3. **Optimistic updates**: Same pattern as CreateTaskModal — instant UI update, SSE replaces with real data, rollback on error
4. **Subproject fetching**: Fetches project details on project change to populate subproject dropdown dynamically
5. **Same form styling**: EditTaskModal reuses identical Tailwind classes from CreateTaskModal for visual consistency

## Files Modified (8) + Created (2)

| File | Action |
|---|---|
| `src/lib/validators/task.ts` | Modified |
| `src/lib/services/task-service.ts` | Modified |
| `src/lib/context/app-context.tsx` | Modified |
| `src/app/components/modals/CreateTaskModal.tsx` | Modified |
| `src/app/components/kanban/TaskCard.tsx` | Modified |
| `src/app/components/kanban/KanbanColumn.tsx` | Modified |
| `src/app/components/kanban/KanbanBoard.tsx` | Modified |
| `src/lib/__tests__/validators.test.ts` | Modified |
| `src/app/components/modals/EditTaskModal.tsx` | **Created** |
| `src/lib/__tests__/edit-task-modal.test.tsx` | **Created** |
