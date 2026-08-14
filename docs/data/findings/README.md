# Phase 1 Data Engineering Findings

Audit findings from the Phase 1 data engineering review of the Project Manager UI v1 architecture.

| ID | Title | Severity | Status |
|---|---|---|---|
| [PHASE1-001](PHASE1-001_missing-subproject-index.md) | Missing index on Subproject.projectId | Medium | Open |
| [PHASE1-002](PHASE1-002-missing-task-order-field.md) | Missing position/order field for kanban card ordering | High | Open |
| [PHASE1-003](PHASE1-003-missing-unique-constraints.md) | Missing UNIQUE constraints on Project.name and Subproject name+project | Medium | Open |
| [PHASE1-004](PHASE1-004-missing-subproject-updatedAt.md) | Missing updatedAt timestamp on Subproject model | Low | Open |
| [PHASE1-005](PHASE1-005-n-plus-one-query-risk.md) | N+1 query risk in dashboard load without proper include/select strategy | High | Open |
| [PHASE1-006](PHASE1-006-connection-pooling-config.md) | Connection pooling configuration for Next.js + Prisma in Docker | Medium | Open |
| [PHASE1-007](PHASE1-007-user-model-isolation.md) | User model is isolated — no FK relations to Task/Project | Low | Open |
| [PHASE1-008](PHASE1-008-sse-payload-optimization.md) | SSE event payload should use select to minimize data transfer | Low | Open |
