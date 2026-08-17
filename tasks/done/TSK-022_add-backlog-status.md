# TSK-022: Add backlog status to kanban board

**Status**: DONE
**Priority**: MEDIUM
**Assigned**: project-manager
**Created**: 2026-08-17
**Completed**: 2026-08-17

## Description

Add `backlog` as the first status in the kanban board flow: `backlog → in_work → review → done`. This enables proper task lifecycle tracking — tasks start in backlog before being pulled into work.

## Acceptance Criteria

- [x] `backlog` status added to Prisma schema and types
- [x] Task service validates all 4 statuses
- [x] KanbanBoard renders backlog column
- [x] Header, CreateTaskModal, EditTaskModal support backlog status
- [x] Seed data includes tasks in backlog status
- [x] Database migration applied
- [x] All 4 test files updated and passing
- [x] Build passes, 63/63 related tests pass

## Artifacts

- `prisma/schema.prisma` — added `backlog` to TaskStatus enum
- `src/lib/types/task.ts` — added `backlog` to TaskStatus type
- `src/lib/validators/task.ts` — added `backlog` to Zod schema
- `src/lib/services/task-service.ts` — updated status validation
- `src/app/components/kanban/KanbanBoard.tsx` — added backlog column
- `src/app/components/layout/Header.tsx` — backlog status support
- `src/app/components/modals/CreateTaskModal.tsx` — backlog option
- `src/app/components/modals/EditTaskModal.tsx` — backlog option
- `prisma/seed.ts` — backlog status in seed data
- `prisma/migrations/` — migration for backlog status
- `src/lib/__tests__/task-api.test.ts` — updated tests
- `src/lib/__tests__/task-service.test.ts` — updated tests
- `src/lib/__tests__/task-create-api.test.ts` — updated tests
- `src/lib/__tests__/task-update-api.test.ts` — updated tests

## History

- 2026-08-17: Created (project-manager)
- 2026-08-17: Implemented (code-implementer) — 11 files modified, 4 test files updated
- 2026-08-17: Build passes, 63/63 related tests pass (7 pre-existing failures unrelated)
- 2026-08-17: Task closed (project-manager) — moved to tasks/done/
