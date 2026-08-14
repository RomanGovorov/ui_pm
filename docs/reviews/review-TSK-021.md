# Code Review: TSK-021 — Delete Task Button in UI

**Task:** TSK-021
**Date:** 2026-08-14
**Reviewer:** code-reviewer
**Iteration:** code_review_iteration [1 / 3]
**Context:** application_code_review (from T34)

---

## Verdict: PASS

| Severity | Count | Gate |
|----------|-------|------|
| CRITICAL | 0 | ✅ Target: 0 |
| HIGH | 0 | ✅ Target: ≤ 3 |
| MEDIUM | 2 | — |
| LOW | 4 | — |

---

## Files Reviewed

| File | Status | Findings |
|------|--------|----------|
| `src/lib/context/app-context.tsx` | Modified | 2 (MEDIUM + LOW) |
| `src/app/components/modals/DeleteTaskModal.tsx` | New | 3 (MEDIUM + 2 LOW) |
| `src/app/components/kanban/TaskCard.tsx` | Modified | 0 |
| `src/app/components/kanban/KanbanColumn.tsx` | Modified | 0 |
| `src/app/components/kanban/KanbanBoard.tsx` | Modified | 0 |
| `src/lib/__tests__/task-delete-ui.test.tsx` | New | 1 (LOW) |

---

## Findings

### MEDIUM-001: Double Toast on Successful Delete

**Location:** `src/lib/context/app-context.tsx:117` (deleteTask success) + `src/lib/context/app-context.tsx:65` (SSE `task_deleted` handler)

**Description:** When a task is successfully deleted, two toast notifications appear:
1. `deleteTask()` emits `addToast('success', 'Task deleted')` (line 117)
2. The SSE `task_deleted` handler emits `addToast('info', 'Task deleted')` (line 65)

The SSE event arrives shortly after the API call succeeds. The user sees two toasts — one green (success) and one blue (info) — both saying "Task deleted." This is confusing and looks like a bug.

**Note:** This is a systemic pattern — `EditTaskModal` has the same double toast with `task_updated` SSE events. However, `deleteTask` is new code and should avoid replicating this.

**Impact:** UX degradation — users see duplicate notifications for a single action. Visible to all users on every delete.

**Remediation (choose one):**
- **Option A (simplest):** Remove `addToast('success', 'Task deleted')` from `deleteTask`. The SSE handler will provide the toast. Risk: if SSE is delayed or disconnected, the user won't see immediate feedback.
- **Option B (best):** Add a local-tracking Set in app-context to suppress SSE toasts for locally-initiated operations:
  ```typescript
  const localDeletes = useRef(new Set<string>());
  // In deleteTask: localDeletes.current.add(taskId);
  // In SSE handler: if (localDeletes.current.has(id)) { localDeletes.current.delete(id); return; }
  ```
- **Option C:** Remove `addToast` from the SSE `task_deleted` handler entirely. The visual removal of the card + the success toast from `deleteTask` is sufficient feedback.

---

### MEDIUM-002: Missing `aria-describedby` on Confirmation Dialog

**Location:** `src/app/components/modals/DeleteTaskModal.tsx:39-42`

**Description:** Component specification §2.7.3 requires `aria-describedby` pointing to the warning text element. This is not implemented. The `<p>` containing the warning message has no `id`, and the dialog element (in `ModalWrapper`) does not receive `aria-describedby`.

**Impact:** Screen readers may not associate the warning message with the dialog's purpose. While `aria-labelledby="Delete Task"` provides the dialog title, the descriptive content (the actual warning) is not programmatically linked. This is a WCAG 1.3.1 (Info and Relationships) enhancement.

**Remediation:**
1. Add an `id` to the warning paragraph: `<p id="delete-warning" className="...">`
2. Extend `ModalWrapper` to accept an optional `ariaDescribedBy` prop
3. Pass it through: `<ModalWrapper title="Delete Task" ... ariaDescribedBy="delete-warning">`
4. In ModalWrapper: `<div ... aria-describedby={ariaDescribedBy}>`

---

### LOW-001: Missing Warning Icon in DeleteTaskModal

**Location:** `src/app/components/modals/DeleteTaskModal.tsx:39`

**Description:** Component spec §2.7.3 visual spec calls for a "Warning icon (exclamation triangle, `text-accent-red`)" before the confirmation message. The implementation renders only text without the icon.

**Impact:** Minor visual deviation from spec. The confirmation message is still clear and readable.

**Remediation:** Add an exclamation triangle SVG icon before the `<p>` element, styled with `text-accent-red`.

---

### LOW-002: Missing `aria-label` on Delete Confirmation Button

**Location:** `src/app/components/modals/DeleteTaskModal.tsx:53`

**Description:** Spec §2.7.3 specifies `aria-label="Confirm delete task: {task.title}"` for the Delete button. The button has only visible text "Delete" without an explicit `aria-label`.

**Impact:** Low — the button text "Delete" is already descriptive, and the dialog has `aria-labelledby` providing context. Screen readers will announce "Delete, button" within the "Delete Task" dialog, which is sufficient.

**Remediation:** Add `aria-label={`Confirm delete task: ${task.title}`}` to the Delete button for enhanced screen reader context.

---

### LOW-003: `deleteTask` Captures Entire `tasks` Array in Closure

**Location:** `src/lib/context/app-context.tsx:105-124`

**Description:** The `deleteTask` callback depends on `[tasks, removeTaskOptimistic, addToast]`, causing it to get a new function reference on every `tasks` state change. The `tasks` dependency exists solely to extract the snapshot for rollback: `const snapshot = tasks.find(t => t.id === taskId)`.

**Impact:** Theoretical — in practice, `deleteTask` is only consumed by `KanbanBoard` which already re-renders when `tasks` changes. No measurable performance impact in the current architecture.

**Remediation:** Use the functional form of `setTasks` to extract the snapshot without depending on the outer `tasks`:
```typescript
const deleteTask = useCallback(
  async (taskId: string) => {
    let snapshot: Task | undefined;
    setTasks((prev) => {
      snapshot = prev.find((t) => t.id === taskId);
      return prev.filter((t) => t.id !== taskId);
    });
    // ... rest of the function uses `snapshot` for rollback
  },
  [addToast], // no longer depends on `tasks`
);
```
This combines the snapshot extraction with the optimistic remove in a single state update.

---

### LOW-004: No `deleting` Loading State in Modal

**Location:** `src/app/components/modals/DeleteTaskModal.tsx` + `src/app/components/kanban/KanbanBoard.tsx:40-43`

**Description:** Spec §2.7.3 says: "Set `deleting` state to true (disable button, show spinner)" during the API call. The implementation closes the modal immediately via `setDeletingTask(null)` in `handleDeleteConfirm`, then the API call happens in the background.

**Impact:** Low — the immediate-close UX is actually acceptable: the task card disappears (optimistic), the modal closes, and if the API fails, the task reappears with an error toast. Users are not blocked waiting for the API response. However, rapid double-click on the delete button in TaskCard could theoretically open the modal again before the first delete completes (unlikely due to optimistic remove).

**Remediation:** If desired, add an `isDeleting` prop to `DeleteTaskModal` that disables both buttons during the API call. Alternatively, the current immediate-close behavior can be accepted as a deliberate UX choice (document in ADR-008).

---

## Positive Aspects

1. **Excellent architecture decision (ADR-008):** Placing `deleteTask()` in app-context rather than the modal component is the right call — reusable, testable, and consistent with the `addTaskOptimistic`/`removeTaskOptimistic`/`updateTaskOptimistic` naming convention.

2. **Correct optimistic update pattern:** Snapshot → optimistic remove → API call → rollback on error. Well-implemented and consistent with EditTaskModal.

3. **SSE idempotency correctly handled:** The ADR correctly identifies that `filter()` is idempotent — no special handling needed for the redundant SSE `task_deleted` event on state.

4. **Accessibility fundamentals solid:** Focus trap (via ModalWrapper), ESC close, scroll lock, aria-modal, aria-labelledby — all inherited correctly. Cancel button receiving initial focus is the correct WCAG safe default for destructive actions.

5. **Proper admin-only guard:** `isAdmin && onDelete` conditional rendering in TaskCard correctly hides the button for non-admin users. The nested guard pattern is defensive and consistent with the edit button.

6. **Clean prop threading:** KanbanColumn cleanly threads `onDelete` through to TaskCard, following the exact same pattern as `onEdit`. No prop drilling complexity.

7. **Proper memoization:** All callbacks in KanbanBoard use `useCallback`, task grouping uses `useMemo`. No unnecessary re-renders introduced.

8. **Comprehensive test coverage:** 19 tests covering admin-only visibility, modal rendering, callback invocation, null/isOpen guards, and structural source code validation.

9. **Security:** Task title rendered as React text content (`{task.title}`) — auto-escaped, no XSS risk. No `dangerouslySetInnerHTML` usage. CSRF not applicable (same-origin JWT cookie + middleware auth).

10. **Clean component:** DeleteTaskModal is 55 lines — focused, readable, easy to maintain.

---

## Quality Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Critical issues | 0 | 0 | ✅ |
| High priority issues | ≤ 3 | 0 | ✅ |
| Build success | true | true | ✅ |
| Unit tests pass | 100% | 100% (19/19) | ✅ |
| Pattern consistency | Follows existing | Yes | ✅ |
| WCAG AA (core) | Pass | Pass | ✅ |
| Architecture compliance (ADR-008) | Follows | Follows | ✅ |

---

## Recommendations Summary

| ID | Severity | Finding | Effort |
|----|----------|---------|--------|
| MEDIUM-001 | MEDIUM | Double toast on delete success | 5 min (remove line) or 15 min (tracking set) |
| MEDIUM-002 | MEDIUM | Missing `aria-describedby` on dialog | 15 min (extend ModalWrapper) |
| LOW-001 | LOW | Missing warning icon | 5 min |
| LOW-002 | LOW | Missing `aria-label` on Delete button | 1 min |
| LOW-003 | LOW | `deleteTask` captures `tasks` in closure | 10 min |
| LOW-004 | LOW | No `deleting` loading state | 15 min or accept current UX |

**Total estimated fix time:** ~50 minutes for all findings.

---

## Decision

**PASS** — Critical: 0, High: 0. Code proceeds to testing/performance (T45a + T45b).

All medium and low findings are documented as improvement recommendations. None block the workflow.
