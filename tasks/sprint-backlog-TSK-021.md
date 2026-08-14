# Sprint Backlog — TSK-021: Delete Task Button in UI

**Sprint Goal**: Add admin-only task deletion to the Kanban board UI with confirmation modal, optimistic updates, and full test coverage.

## User Story

**As an** admin user,
**I want to** delete tasks from the Kanban board with a confirmation dialog,
**So that** I can remove obsolete or incorrect tasks without navigating to an API.

### Acceptance Criteria
1. Delete button (trash icon) visible only to admins, positioned next to edit button in TaskCard
2. Confirmation modal: "Are you sure you want to delete this task? This action cannot be undone."
3. On confirm: optimistic removal from UI, `DELETE /api/tasks/:id` called in background
4. On error: rollback optimistic removal, show error toast
5. On success: SSE `task_deleted` event confirms (server already emits this)
6. Non-admins cannot see or trigger delete
7. Accessible: aria-labels, keyboard nav (Enter to confirm, Escape to cancel), focus trap
8. Tests: unit tests for DeleteTaskModal, integration test for delete flow

## Execution Order

1. **architecture-planner** → Design the component structure, modal flow, and state management approach
2. **code-implementer** → Implement DeleteTaskModal, modify TaskCard, wire up KanbanBoard, add `deleteTask` to app-context
3. **code-reviewer** → Review implementation for quality, security, accessibility
4. **comprehensive-test-engineer** || **performance-analyst** → Test coverage + performance check (parallel)
5. **devops-infrastructure-engineer** → No infra changes expected (frontend only)
6. **tech-docs-writer** → Update release notes, changelog, user guide
7. **project-manager** → Final review and approval

## Dependencies

- ✅ `DELETE /api/tasks/:id` endpoint exists and works (TSK-020)
- ✅ SSE `task_deleted` event already emitted and handled in app-context
- ✅ `removeTaskOptimistic(taskId)` already exists in app-context
- ✅ `isAdmin` flag available via `useAuth()`
- ✅ `ModalWrapper` component exists with focus trap, ESC, scroll lock
- ✅ `EditTaskModal` pattern to follow for modal structure
- ✅ Toast system (`addToast`) available in app-context

## Constraints

- **No backend changes** — DELETE endpoint is complete
- **Frontend only** — no Docker, no database, no CI/CD changes
- **Admin-only** — button must not render for non-admin users
- **Optimistic update** — remove from UI immediately, rollback on error
- **Accessibility** — must pass WCAG AA (modal focus trap, keyboard navigation, aria-labels)

## Known Risks

- Low: Confirmation modal is straightforward; pattern exists in EditTaskModal
- Low: DELETE endpoint already tested (TSK-020 — 22 tests)
