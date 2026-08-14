# TSK-019: Task Editing and Status Selection

**Status**: DONE
**Priority**: MUST HAVE
**Assigned**: project-manager
**Created**: 2026-08-14
**Deadline**: —
**Completed**: 2026-08-14

## Description

Enhance task management UI to allow status selection during creation and task editing for admins.

## Acceptance Criteria

- [x] CreateTaskModal has status dropdown (in_work, review, done)
- [x] TaskCard has Edit button for admins
- [x] EditTaskModal opens with pre-filled task data
- [x] Admin can change task status via EditTaskModal
- [x] Changes saved via PUT /api/tasks/[id]
- [x] SSE broadcasts task_updated event
- [x] KanbanBoard reflects changes in real-time
- [x] Non-admins cannot see Edit button or create tasks with custom status
- [x] Build passes, tests pass (62 tests, >80% coverage)

## Summary

- **Code**: 7 changes implemented (validators, service, CreateTaskModal, EditTaskModal, TaskCard, KanbanBoard, app-context)
- **Tests**: 62 tests passing, >80% coverage
- **Review**: 0 critical, 0 high, 3 medium recommendations
- **Performance**: No bottlenecks (UI-only changes)
- **DevOps**: No infra changes needed
- **Docs**: 5 files updated (getting-started, openapi.yaml, release notes v1.2.0, changelog, README)

## History

- 2026-08-14: Created (project-manager)
- 2026-08-14: Completed (project-manager) — all acceptance criteria met
