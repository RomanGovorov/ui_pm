# TSK-021: Delete task button in UI

**Status**: DONE
**Priority**: HIGH
**Assigned**: architecture-planner
**Created**: 2026-08-14
**Completed**: 2026-08-14

## Description

Add a delete button (trash icon) to TaskCard visible only to admins. On click, show a confirmation dialog ("Are you sure? This cannot be undone."). On confirm, call DELETE /api/tasks/:id with optimistic update and error rollback. SSE `task_deleted` event already handled by server.

## Acceptance Criteria

- [x] Delete button (trash icon) appears next to edit button in TaskCard — admin-only
- [x] Confirmation modal before delete: "Are you sure you want to delete this task? This action cannot be undone."
- [x] On confirm: optimistic remove from UI, call DELETE /api/tasks/:id
- [x] On error: rollback optimistic removal, show error toast
- [x] On success: SSE `task_deleted` event confirms removal (already handled by server)
- [x] Accessibility: proper aria-labels, keyboard navigation, focus trap in confirmation modal
- [x] Follow existing patterns: EditTaskModal for modal structure, ModalWrapper for accessibility
- [x] Tests: unit tests for DeleteTaskModal, integration test for delete flow in KanbanBoard
- [x] Non-admins cannot see or trigger delete

## Artifacts

- `src/app/components/modals/DeleteTaskModal.tsx` — confirmation modal with focus trap, ESC, scroll lock
- `src/app/components/kanban/TaskCard.tsx` — delete button (admin-only, with aria-label)
- `src/lib/context/app-context.tsx` — deleteTask() helper (optimistic + API call + rollback)
- `src/lib/__tests__/task-delete-ui.test.tsx` — integration tests (41 tests)
- `src/lib/__tests__/task-delete-api.test.ts` — API endpoint tests (22 tests)
- `docs/reviews/review-TSK-021.md` — code review (PASS, 0 critical, 0 high)
- `docs/testing/test-report.md` — test report (41 tests PASS, 0 regressions)
- `docs/performance/profiling-report.md` — performance analysis (PASS, no bottlenecks)

## History

- 2026-08-14: Created (project-manager)
- 2026-08-14: Architecture planned (architecture-planner) — component specs, implementation plan Phase 8, ADR-008
- 2026-08-14: Code implemented (code-implementer) — DeleteTaskModal, TaskCard delete button, 19 tests
- 2026-08-14: Code reviewed (code-reviewer) — PASS, 0 critical, 0 high, 2 medium, 4 low
- 2026-08-14: Testing complete (comprehensive-test-engineer) — 41 tests PASS, 0 regressions
- 2026-08-14: Performance analysis (performance-analyst) — PASS, no bottlenecks
- 2026-08-14: DevOps assessment (devops-infrastructure-engineer) — PASS, no infra changes
- 2026-08-14: Documentation (tech-docs-writer) — PASS, complete
- 2026-08-14: Task closed (project-manager) — moved to tasks/done/
