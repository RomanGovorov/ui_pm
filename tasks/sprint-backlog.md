# Sprint Backlog — v1.3 Task DELETE Endpoint

## Sprint Goal
Add comprehensive test coverage and API documentation for the existing DELETE `/api/tasks/[id]` endpoint.

## Scope
- **In scope**: Tests for DELETE endpoint (happy path, error cases, auth, SSE), API documentation, OpenAPI spec update
- **Out of scope**: Changing the DELETE endpoint implementation (it already works correctly)

## Tasks
1. Write integration tests for DELETE `/api/tasks/[id]` — `src/lib/__tests__/task-delete-api.test.ts`
2. Create API documentation — `docs/api/tasks.md`
3. Update OpenAPI spec — `docs/api/openapi.yaml`
4. Verify all tests pass, coverage > 80%

## Dependencies
- No blocking dependencies — endpoint exists, middleware handles auth
- Reference: existing `api-integration-tests.test.ts` for test patterns
- Reference: `middleware.ts` for auth flow (stakeholder → 403 on DELETE)

## Risk Assessment
- **Low risk**: Endpoint already functional, only adding tests and docs
- **Medium risk**: SSE event testing may require mocking the event bus
- **Mitigation**: Follow existing test patterns from `api-integration-tests.test.ts`
