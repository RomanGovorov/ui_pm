# Code Review — TSK-019: Task Editing and Status Selection

**Date:** 2026-08-14
**Reviewer:** code-reviewer
**Iteration:** code_review_iteration: 1 / 3
**Incoming Transition:** T34 (from code-implementer)
**Source:** code-implementer (initial implementation)

---

## Summary

Code review of TSK-019 covering task editing (EditTaskModal, admin-only edit button, optimistic updates with rollback), status selection during task creation (CreateTaskModal status dropdown), validator extensions, and supporting context/service changes.

The implementation is well-structured, follows established patterns from CreateTaskModal, and correctly addresses all acceptance criteria. Security is enforced at both the UI layer (`useAuth().isAdmin`) and the middleware layer (403 for stakeholder writes). The optimistic update pattern with rollback is correctly implemented.

**Result:** Critical: 0, High: 0, Medium: 3, Low: 3

---

## Files Reviewed

| File | Action | Status |
|------|--------|--------|
| `src/lib/validators/task.ts` | Modified | ✅ Reviewed |
| `src/lib/services/task-service.ts` | Modified | ✅ Reviewed |
| `src/lib/context/app-context.tsx` | Modified | ✅ Reviewed |
| `src/app/components/modals/CreateTaskModal.tsx` | Modified | ✅ Reviewed |
| `src/app/components/modals/EditTaskModal.tsx` | Created | ✅ Reviewed |
| `src/app/components/kanban/TaskCard.tsx` | Modified | ✅ Reviewed |
| `src/app/components/kanban/KanbanColumn.tsx` | Modified | ✅ Reviewed |
| `src/app/components/kanban/KanbanBoard.tsx` | Modified | ✅ Reviewed |
| `src/lib/__tests__/edit-task-modal.test.tsx` | Created | ✅ Reviewed |
| `src/lib/__tests__/validators.test.ts` | Modified | ✅ Reviewed |
| `src/middleware.ts` | Reference | ✅ Verified |
| `src/lib/context/auth-context.tsx` | Reference | ✅ Verified |
| `src/app/api/tasks/[id]/route.ts` | Reference | ✅ Verified |
| `src/lib/services/project-service.ts` | Reference | ✅ Verified |

---

## Findings

### MEDIUM-001: Form Field Duplication Between CreateTaskModal and EditTaskModal

**Severity:** MEDIUM
**Location:** `src/app/components/modals/EditTaskModal.tsx` (entire file), `src/app/components/modals/CreateTaskModal.tsx`
**Type:** Code Quality — Duplication

**Description:**
EditTaskModal duplicates ~200 lines of nearly identical form JSX, Tailwind class strings, and client-side validation logic from CreateTaskModal. The following elements are duplicated verbatim or near-verbatim:

- Form field JSX (title, description, status, priority, assignee inputs)
- Tailwind class strings for all inputs (`w-full rounded-lg border bg-bg-tertiary px-3 py-2 text-sm ...`)
- Client-side `validate()` function with identical rules
- Error rendering pattern (conditional `<p>` with `role="alert"`)

**Impact:**
- Changes to form styling or validation rules require updating two files
- Increases risk of drift between create and edit forms
- ~200 lines of avoidable duplication

**Remediation:**
Extract shared form fields into a reusable `TaskFormFields` component:

```tsx
// src/app/components/modals/TaskFormFields.tsx
interface TaskFormFieldsProps {
  prefix: string; // 'task' | 'edit-task' for unique IDs
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  errors: Record<string, string>;
  onChange: {
    title: (v: string) => void;
    description: (v: string) => void;
    status: (v: TaskStatus) => void;
    priority: (v: TaskPriority) => void;
    assignee: (v: string) => void;
  };
}
```

Both modals would use this component and only add their unique fields (project/subproject for EditTaskModal).

---

### MEDIUM-002: No Project Existence Validation Before Task Reassignment

**Severity:** MEDIUM
**Location:** `src/lib/services/task-service.ts:78-85` (update method)
**Type:** Data Integrity — Input Validation

**Description:**
The `updateTaskSchema` accepts `projectId` as an optional UUID string. The service layer passes it directly to `prisma.task.update()` without verifying the target project exists. If the UUID doesn't match any project, Prisma throws a foreign key constraint error (`P2003`), which is caught by `handleApiError` but results in a generic 500 or an uninformative error message.

```typescript
// task-service.ts — update method
const cleanData = Object.fromEntries(
  Object.entries(data).filter(([, v]) => v !== undefined),
);
// No existence check on cleanData.projectId before passing to Prisma
const task = await prisma.task.update({ where: { id }, data: cleanData, ... });
```

The EditTaskModal populates the project dropdown from `useAppContext().projects`, so in normal UI flow the project ID is always valid. However, the API endpoint is accessible to agents via API key, where arbitrary UUIDs could be sent.

**Impact:**
- Foreign key violation returns an unhelpful error to API consumers
- Error code/message depends on Prisma's internal error mapping rather than explicit validation

**Remediation:**
Add a project existence check in the update method when `projectId` is present:

```typescript
if (cleanData.projectId) {
  const projectExists = await prisma.project.findUnique({
    where: { id: cleanData.projectId },
    select: { id: true },
  });
  if (!projectExists) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Target project not found');
  }
}
```

---

### MEDIUM-003: `isAdmin` in auth-context.tsx Recomputed on Every Render

**Severity:** MEDIUM
**Location:** `src/lib/context/auth-context.tsx:135`
**Type:** Performance — Unnecessary Recomputation

**Description:**
The `isAdmin` boolean is computed as a plain expression on every render of `AuthProvider`, not memoized:

```typescript
const isAdmin = user?.role === ('admin' as UserRole);
```

This value is included in the context value object, which causes all context consumers (including `TaskCard` via `useAuth()`) to re-render whenever the context value changes, even if `isAdmin` itself didn't change. While the computation is trivial (a single comparison), the pattern encourages unnecessary re-renders in consuming components.

**Impact:**
- Every `AuthProvider` re-render triggers re-render of all `useAuth()` consumers
- In a board with many task cards, this can cause visible jank during frequent state updates (e.g., SSE events)

**Remediation:**
Wrap the `isAdmin` computation and the context value in `useMemo`:

```typescript
const isAdmin = useMemo(() => user?.role === 'admin', [user]);
const value: AuthContextValue = useMemo(() => ({
  user, isLoading, isAuthenticated, isAdmin,
  login, register, logout, authVersion,
}), [user, isLoading, isAuthenticated, isAdmin, login, register, logout, authVersion]);
```

---

### LOW-001: Dead `X-API-Key` Header in Frontend Fetch Calls

**Severity:** LOW
**Location:** `EditTaskModal.tsx:112`, `CreateTaskModal.tsx:65`
**Type:** Code Quality — Dead Code

**Description:**
Both modals send `'X-API-Key': 'ui-internal-call'` in fetch headers. This value is not a valid API key — `validateApiKey()` in the middleware will return `false`, and authentication falls through to the JWT cookie path. The header has no effect and is misleading to future developers who might think it's functional.

**Impact:**
- Misleading code that suggests an API key is being used when it isn't
- Minor confusion for new developers

**Remediation:**
Remove the `X-API-Key` header from frontend fetch calls, or add a comment explaining it's a placeholder for v1. Alternatively, use a proper session-based auth mechanism.

**Note:** This was already documented as a known v1 limitation in `review-TSK-005-013.md`. No action required for this iteration.

---

### LOW-002: Optimistic Rollback May Lose Concurrent SSE Updates

**Severity:** LOW
**Location:** `EditTaskModal.tsx:100,135`
**Type:** Correctness — Race Condition (unlikely in practice)

**Description:**
In `handleSubmit`, `originalTask` is captured as `{ ...task }` at submit time. If SSE delivers a `task_updated` event for the same task while the edit is in flight, the optimistic rollback will overwrite the SSE update with the stale `originalTask`.

**Sequence:**
1. User opens modal (task.status = `in_work`)
2. SSE delivers update (task.status → `review` via another user/agent)
3. React re-renders EditTaskModal with new task prop, but `originalTask` is already captured
4. User submits, API call fails
5. Rollback: `updateTaskOptimistic(task.id, originalTask)` — restores status to `in_work`, losing the SSE update

**Impact:**
- Extremely unlikely in practice (requires concurrent edits of the same task)
- Only affects rollback path; successful edits work correctly (SSE replaces optimistic data)

**Remediation:**
For a future iteration: consider using a version/timestamp field to detect concurrent modifications and warn the user.

---

### LOW-003: EditTaskModal Tests Cover Only Rendering, Not Behavior

**Severity:** LOW
**Location:** `src/lib/__tests__/edit-task-modal.test.tsx`
**Type:** Test Quality — Missing Behavioral Tests

**Description:**
The 9 tests in `edit-task-modal.test.tsx` cover rendering and pre-filled state verification (fields, dropdowns, buttons, markers, status variants, null description). However, they don't test:

- Form submission (clicking "Save Changes")
- Partial update detection (only changed fields sent)
- Optimistic update call (`updateTaskOptimistic` invocation)
- Error rollback behavior
- "No changes" early-close behavior

**Impact:**
- Core edit behavior (submit → API call → optimistic update → SSE sync) is not tested
- Regression risk if submit logic is modified

**Remediation:**
Add behavioral tests using `userEvent` and mocked `fetch`:

```typescript
it('calls updateTaskOptimistic on successful submit', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ...mockTask, title: 'Updated' }),
  });
  // ... change title, submit, verify mockUpdateTaskOptimistic called
});

it('rolls back optimistic update on API error', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: { message: 'Server error' } }),
  });
  // ... submit, verify rollback call with original task
});
```

---

## Security Verification

### Admin-Only Edit Access ✅
- **UI layer:** `TaskCard` renders edit button only when `useAuth().isAdmin === true` (line 89)
- **Middleware layer:** All write operations (POST/PUT/DELETE) require authentication. Stakeholder role gets 403 Forbidden (middleware.ts:165-170). Only `admin` and `agent` roles can write.
- **Defense in depth:** UI hides the button, middleware enforces the restriction regardless of UI state.

### Input Validation ✅
- Server-side Zod validation via `updateTaskSchema` in `PUT /api/tasks/[id]`
- All string fields have `.trim()`, `.min()`, `.max()` constraints
- `status` and `priority` use strict `.enum()` validation
- `projectId` validated as UUID format

### SSE Event Integrity ✅
- SSE events are emitted server-side after successful Prisma operations
- Event payload uses `toSSEPayload(task)` with `fullSelect` (no sensitive data leaked)

---

## Architecture Verification

### Alignment with Existing Patterns ✅
- EditTaskModal follows the exact same pattern as CreateTaskModal (optimistic update → fetch → rollback)
- Uses ModalWrapper for accessibility (focus trap, ESC key, scroll lock, aria-modal)
- Consistent Tailwind styling across all form fields
- Proper prop drilling: KanbanBoard → KanbanColumn → TaskCard → onEdit callback

### Separation of Concerns ✅
- Validation logic in `validators/task.ts`
- Business logic in `services/task-service.ts`
- UI state in component-level `useState`
- Global state in `app-context.tsx` (optimistic updates)
- Auth state in `auth-context.tsx` (role-based visibility)

---

## Tailwind JIT Safety ✅

All Tailwind class strings are complete literals. No dynamic class construction:
- `PRIORITY_CLASSES` uses a static `Record<string, string>` map (TaskCard.tsx:18-22)
- `PRIORITY_DOTS` uses a static map (TaskCard.tsx:24-28)
- Form input classes use template literals only for conditional `border-accent-red` vs `border-border-primary`, both of which are complete class strings
- No string concatenation or interpolation of partial class names

---

## Accessibility Verification ✅

| Feature | Status | Details |
|---------|--------|---------|
| Focus trap | ✅ | Via ModalWrapper → `useFocusTrap` hook |
| ESC close | ✅ | ModalWrapper `handleKeyDown` listener |
| Scroll lock | ✅ | ModalWrapper sets `body.overflow = 'hidden'` |
| aria-modal | ✅ | `role="dialog"` + `aria-modal="true"` on container |
| aria-labelledby | ✅ | `useId()` generates unique title ID |
| Form labels | ✅ | All inputs have `<label htmlFor>` associations |
| Error announcements | ✅ | `role="alert"` on error messages |
| aria-invalid | ✅ | Set on inputs with validation errors |
| aria-describedby | ✅ | Links inputs to error message elements |
| Edit button label | ✅ | `aria-label="Edit task: {title}"` |
| Required field markers | ✅ | Visual `*` with `<span>` (screen readers read label text) |

---

## Positive Aspects

1. **Clean partial update logic:** EditTaskModal correctly compares trimmed values against the original task and sends only changed fields, reducing API payload and avoiding unnecessary database writes.

2. **No-changes detection:** The modal closes immediately without an API call when no fields have changed — good UX and resource efficiency.

3. **Subproject cleanup effect:** The `useEffect` that resets `subprojectId` when the project changes and the current subproject becomes invalid is well-designed with proper `cancelled` flag to prevent stale state updates.

4. **Consistent validator extensions:** Both `createTaskSchema` (status field) and `updateTaskSchema` (projectId field) follow the existing Zod patterns with proper defaults and constraints.

5. **Proper SSE integration:** The optimistic update pattern correctly anticipates that SSE will deliver the canonical updated task, so the modal only needs to handle the optimistic preview and rollback.

6. **Well-structured tests:** The validator tests (15 total, 10 new) provide good coverage of the new schema fields. The component tests (9) verify rendering with various task states.

7. **Memoized callbacks in KanbanBoard:** `handleEdit` and `handleCloseEdit` are wrapped in `useCallback` to prevent unnecessary re-renders of KanbanColumn children.

8. **Clean context API:** The new `updateTaskOptimistic` method in AppContext follows the same pattern as `addTaskOptimistic`/`removeTaskOptimistic`, maintaining API consistency.

---

## Quality Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Critical issues | 0 | 0 | ✅ |
| High priority issues | ≤ 3 | 0 | ✅ |
| Medium priority issues | — | 3 | ℹ️ |
| Low priority issues | — | 3 | ℹ️ |
| Build success | true | true | ✅ |
| Unit tests pass | 100% | 100% | ✅ |
| TypeScript strict | No errors | No errors | ✅ |
| Tailwind JIT safety | All literal | All literal | ✅ |

---

## Decision

**PASS** — No critical or high priority issues found. The implementation meets all acceptance criteria, follows established patterns, and is secure. Three MEDIUM findings are improvement recommendations for future iterations (form deduplication, project validation, auth-context memoization). Code proceeds to testing and performance analysis.
