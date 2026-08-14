# TSK-020: DELETE endpoint for tasks — tests & docs

**Status**: DONE
**Priority**: MEDIUM
**Assigned**: project-manager
**Created**: 2026-08-14
**Completed**: 2026-08-14

## Description

Add comprehensive test coverage and API documentation for the existing DELETE `/api/tasks/[id]` endpoint. The endpoint already exists and functions correctly (deletes task by UUID, emits SSE `task_deleted` event, uses `handleApiError`). Authorization is enforced at the middleware level (stakeholder → 403, unauthenticated → 401, admin/agent → allowed).

**What exists:**
- `DELETE /api/tasks/[id]` route at `src/app/api/tasks/[id]/route.ts` (line 73-95)
- `taskService.delete()` in `src/lib/services/task-service.ts` (line 91-98)
- Middleware blocks unauthorized DELETE requests (stakeholder → 403)
- SSE event `task_deleted` emitted with minimal payload `{ id }`
- Frontend handles `task_deleted` SSE event in `app-context.tsx`

**What's missing:**
- No dedicated unit/integration tests for DELETE endpoint
- No API documentation (docs/api/ directory doesn't exist)
- OpenAPI spec (`docs/api/openapi.yaml`) doesn't include DELETE endpoint

## Acceptance Criteria
- [ ] Integration tests for DELETE endpoint (happy path, invalid UUID, not found, unauthorized, forbidden)
- [ ] Tests verify SSE `task_deleted` event is emitted
- [ ] Tests verify role-based access (admin/agent can delete, stakeholder → 403)
- [ ] API documentation created for DELETE `/api/tasks/[id]`
- [ ] OpenAPI spec updated with DELETE operation
- [ ] All existing tests still pass
- [ ] Test coverage remains > 80%

## Artifacts
- `src/lib/__tests__/task-delete-api.test.ts` — DELETE endpoint tests
- `docs/api/tasks.md` — API documentation for tasks endpoints
- `docs/api/openapi.yaml` — Updated with DELETE /api/tasks/{id}

## Checklist
- [x] Review existing API test patterns
- [ ] Write integration tests for DELETE endpoint
- [ ] Verify SSE event emission in tests
- [ ] Create API documentation
- [ ] Update OpenAPI spec
- [ ] Run full test suite

## History
- 2026-08-14: Created (project-manager)
- 2026-08-14: Started (project-manager)
- 2026-08-14: Architecture planning complete (architecture-planner) — implementation plan, component specs, data flow updated. No specialized audits needed.
- 2026-08-14: Code implementation complete (code-implementer) — 22 tests written, OpenAPI spec updated
- 2026-08-14: Code review PASS (code-reviewer) — 0 critical, 0 high, 3 low cosmetic
- 2026-08-14: Testing PASS (comprehensive-test-engineer) — 22/22 tests pass, 0 regressions
- 2026-08-14: Performance PASS (performance-analyst) — no bottlenecks
- 2026-08-14: DevOps PASS (devops-infrastructure-engineer) — no infrastructure changes needed
- 2026-08-14: Documentation PASS (tech-docs-writer) — complete
- 2026-08-14: Closed (project-manager) — moved to tasks/done/
