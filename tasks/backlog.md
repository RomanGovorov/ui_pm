# Product Backlog — Project Manager UI v1

| ID | Title | Priority | Status | Assigned Agent | Created | Completed |
|----|-------|----------|--------|----------------|---------|-----------|
| TSK-001 | Project architecture & planning | MUST HAVE | DONE | architecture-planner | 2026-08-13 | 2026-08-13 |
| TSK-002 | Security audit (Phase 1) | SHOULD HAVE | DONE | security-auditor | 2026-08-13 | 2026-08-13 |
| TSK-003 | UI/UX audit (Phase 1) | SHOULD HAVE | DONE | ui-ux-accessibility-specialist | 2026-08-13 | 2026-08-13 |
| TSK-004 | Data engineering (Phase 1) | SHOULD HAVE | DONE | data-engineering-architect | 2026-08-13 | 2026-08-13 |
| TSK-005 | Database setup & Prisma | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-006 | Backend API — Projects | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-007 | Backend API — Tasks | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-008 | Backend API — Users & Auth | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-009 | Real-time updates (SSE) | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-010 | Frontend — Kanban board | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-011 | Frontend — Sidebar & project switching | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-012 | Frontend — Theme system | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-013 | Frontend — Real-time integration | MUST HAVE | DONE | code-implementer | 2026-08-13 | 2026-08-13 |
| TSK-014 | API documentation | MUST HAVE | DONE | tech-docs-writer | 2026-08-13 | 2026-08-13 |
| TSK-015 | Testing & QA | MUST HAVE | DONE | comprehensive-test-engineer | 2026-08-13 | 2026-08-13 |
| TSK-016 | DevOps & deployment | SHOULD HAVE | DONE | devops-infrastructure-engineer | 2026-08-13 | 2026-08-13 |
| TSK-017 | User guides & runbooks | SHOULD HAVE | DONE | tech-docs-writer | 2026-08-13 | 2026-08-13 |
| TSK-018 | User authentication (email/password) | MUST HAVE | DONE | project-manager | 2026-08-14 | 2026-08-14 |
| TSK-019 | Task editing and status selection | MUST HAVE | DONE | project-manager | 2026-08-14 | 2026-08-14 |

---

## Project Status

| Stage | Progress | Notes |
|-------|----------|-------|
| Planning | 100% | Architecture + 5 ADRs complete |
| Phase 1 Audits | 100% | 27 findings (10 sec, 9 UI, 8 data) — all resolved |
| Implementation | 100% | 46 source files, 9 API endpoints, 12 UI components |
| Testing | 100% | 81 tests, >80% coverage, 3 bugs fixed |
| Deployment | 100% | Docker, CI/CD, monitoring deployed |
| Documentation | 100% | OpenAPI, user guides, runbooks, changelog |

## Definition of Done — Final Check

- [x] Стейкхолдер открывает дашборд и видит актуальные задачи на канбан-доске
- [x] Агент создаёт задачу через API — она появляется на доске без перезагрузки (SSE)
- [x] Агент меняет статус задачи через API — карточка перемещается в нужную колонку
- [x] Работает переключение между проектами
- [x] Тёмная тема применяется по умолчанию
- [x] API документирован (OpenAPI / Swagger)
- [x] Test coverage > 80%
- [x] Zero critical vulnerabilities (10 findings identified and resolved)

---

| TSK-018 | User authentication (email/password) | MUST HAVE | DONE | project-manager → architecture-planner → tech-docs-writer | 2026-08-14 | 2026-08-14 |
| TSK-019 | Task editing and status selection | MUST HAVE | DONE | project-manager → architecture-planner → tech-docs-writer | 2026-08-14 | 2026-08-14 |

---

## Project Status

| Stage | Progress | Notes |
|-------|----------|-------|
| v1 — Core MVP | 100% | 17 tasks completed, workflow finished 2026-08-14 |
| v1.1 — Authentication | 100% | TSK-018 complete: 145 tests, 17+18 findings resolved, docs written |
| v1.2 — Task Editing | 100% | TSK-019 complete: 62 tests, 7 code changes, 5 docs updated |

## Definition of Done — v1.1 Final Check

- [x] User can register with email + password + confirm password
- [x] User can login with email + password
- [x] JWT stored in httpOnly cookie (7-day expiry)
- [x] Admin role has full access (create/edit/delete)
- [x] Stakeholder role has read-only access (write → 403)
- [x] Agent with API_KEY retains full access (backward compatible)
- [x] Unauthenticated users redirected to /login
- [x] Sidebar/Header show/hide action buttons based on role
- [x] Build passes, tests pass (145 tests)
- [x] Security audit: 17 findings resolved, 0 critical
- [x] UI/UX audit: 18 findings resolved, 0 WCAG AA violations
- [x] Performance: all SLOs met
- [x] Documentation: API reference, user guides, troubleshooting, release notes

---

## Workflow Status: ✅ v1.2 COMPLETE

TSK-019 completed 2026-08-14. All acceptance criteria met.
Full workflow: architecture-planner → security-auditor → ui-ux-accessibility-specialist → code-implementer → code-reviewer → comprehensive-test-engineer → performance-analyst → devops-infrastructure-engineer → tech-docs-writer → project-manager.
