# Test Plan — Project Manager UI v1

**Test ID:** TP-001
**Date:** 2026-08-13
**Tester:** comprehensive-test-engineer
**App Version:** v1 (full-stack Next.js 15 + PostgreSQL + Prisma + SSE)
**Scope:** Integration, E2E, Accessibility, Security, Real-time testing

---

## Overview

This test plan covers comprehensive verification of the Project Manager UI v1 application, a full-stack Next.js Kanban board with real-time SSE updates, API key authentication, and WCAG 2.1 AA accessibility compliance.

### Testing Strategy

| Type | Scope | Tools | Files |
|------|-------|-------|-------|
| **Unit Tests** | Existing (code-implementer created) | pytest / Vitest | `app/src/lib/__tests__/` (29 tests) |
| **Integration Tests** | Service layer, validators, rate limiter, event bus | pytest | `app/test/integration/` |
| **Security Tests** | Auth, CORS, input validation, error sanitization | pytest | `app/test/integration/` |
| **Accessibility Tests** | WCAG 2.1 AA static analysis | pytest + manual browser checks | `app/test/integration/` |
| **SSE Tests** | Connection limits, event emission, cleanup | pytest | `app/test/integration/` |
| **E2E Tests** | User flows, Kanban board, theme toggle | Playwright (optional) | `app/test/e2e/` |
| **Coverage Analysis** | Line coverage across all modules | pytest-cov | Auto-generated |

---

## Test Environment

| Component | Configuration |
|-----------|--------------|
| Runtime | Node.js 22, Next.js 15 (App Router) |
| Database | PostgreSQL 16.4 (Docker) or SQLite for unit tests |
| ORM | Prisma with generated client |
| Browser | Chromium (headless for E2E) |
| Rate Limiter | In-memory sliding window |
| Auth | API key (timing-safe comparison) |

---

## Test Cases

### Integration Tests — Projects (`test_projects_crud.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-INTEG-P001 | Create project valid data | HIGH | 201, returns project |
| TC-INTEG-P002 | Create project without description | HIGH | Success, null description |
| TC-INTEG-P003 | Name whitespace trimming | MEDIUM | Trimmed name accepted |
| TC-INTEG-P004 | Name > 255 chars rejection | HIGH | Validation error |
| TC-INTEG-P005 | Empty name rejection | HIGH | Validation error |
| TC-INTEG-P006 | Missing name rejection | HIGH | Validation error |
| TC-INTEG-P007 | List all projects sorted | HIGH | Returns ascending by name |
| TC-INTEG-P008 | List includes task count | MEDIUM | _count.tasks present |
| TC-INTEG-P009 | Get existing project | HIGH | Full data returned |
| TC-INTEG-P010 | Get non-existent → 404 | HIGH | ApiError(404) |
| TC-INTEG-P011 | Partial field update | HIGH | Only changed fields in DB |
| TC-INTEG-P012 | Full field update | MEDIUM | All fields updated |
| TC-INTEG-P013 | Delete emits SSE event | HIGH | Event emitted |
| TC-INTEG-P014 | Description > 2000 chars reject | MEDIUM | Validation error |
| TC-INTEG-P015 | Nullable description on update | LOW | Null accepted |
| TC-INTEG-P016 | Partial update schema | LOW | Each field independently updatable |
| TC-INTEG-P017 | Selective projection | MEDIUM | apiKey not leaked |
| TC-INTEG-P018 | Subprojects fetched in query | MEDIUM | Single query, no N+1 |

### Integration Tests — Tasks (`test_tasks_crud.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-INTEG-T001 | Create task valid | HIGH | 201, task returned |
| TC-INTEG-T002 | Create with subproject | HIGH | subprojectId set |
| TC-INTEG-T003 | Default priority = medium | MEDIUM | medium assigned |
| TC-INTEG-T004 | Invalid UUID rejected | HIGH | Validation error |
| TC-INTEG-T005 | Missing title rejected | HIGH | Validation error |
| TC-INTEG-T006 | List all tasks | HIGH | Returns all |
| TC-INTEG-T007 | Filter by projectId | HIGH | Correct filter applied |
| TC-INTEG-T008 | Filter by status | HIGH | Correct status filter |
| TC-INTEG-T009 | Ordered by priority ASC, createdAt DESC | HIGH | DATA-002 compliance |
| TC-INTEG-T010 | Full select includes all fields | MEDIUM | All fields present |
| TC-INTEG-T011 | Update status | HIGH | Status changed |
| TC-INTEG-T012 | No fields update → error | MEDIUM | 400 Validations Error |
| TC-INTEG-T013 | Undefined values filtered | MEDIUM | cleanData removes undefined |
| TC-INTEG-T014 | Update assignee | LOW | Assignee changed |
| TC-INTEG-T015 | Delete task | HIGH | Returns deleted ID |
| TC-INTEG-T016-T022 | Various validation edge cases | HIGH-MED | Proper rejections |
| TC-INTEG-T023 | SSE payload excludes description | MEDIUM | bandwidth optimization |
| TC-INTEG-T024 | Get non-existent task → 404 | HIGH | ApiError(404) |

### Integration Tests — Users (`test_users.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-INTEG-U001 | Create user valid | HIGH | Returns user |
| TC-INTEG-U002 | Default role = stakeholder | LOW | stakeholder assigned |
| TC-INTEG-U003 | Without API key | LOW | Optional key accepted |
| TC-INTEG-U004 | List excludes apiKey | HIGH | apiKey never exposed |
| TC-INTEG-U005-U008 | Validation edge cases | MEDIUM | Proper rejections |
| TC-INTEG-U009 | null API key → false | HIGH | validateApiKey returns False |
| TC-INTEG-U010 | Empty string → false | HIGH | validateApiKey returns False |
| TC-INTEG-U011 | Missing env → false | HIGH | validateApiKey returns False |
| TC-INTEG-U012 | extractApiKey reads header | HIGH | Returns header value |
| TC-INTEG-U013 | Missing header → None | MEDIUM | Returns None |
| TC-INTEG-U014 | Case-sensitive comparison | MEDIUM | Hash-based comparison |

### Security Tests (`test_security.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-SEC-R001 | Under limit: allowed | HIGH | Rate limiter passes |
| TC-SEC-R002 | Over limit: blocked | HIGH | Rate limiter rejects |
| TC-SEC-R003 | Retry-After included | MEDIUM | retryAfter value present |
| TC-SEC-R004 | Sliding window expiry | LOW | Counter resets after window |
| TC-SEC-R005 | Cleanup removes expired | MEDIUM | store entry removed |
| TC-SEC-S001 | No Prisma leak in errors | HIGH | Generic messages only |
| TC-SEC-S002 | Custom codes preserved | MEDIUM | ApiError codes passthrough |
| TC-SEC-S003 | Zod errors structured | MEDIUM | details array present |
| TC-SEC-S004 | Unknown errors generic | HIGH | No stack trace leaked |
| TC-SEC-C001 | CORS allowed origin reflected | HIGH | Access-Control-Allow-Origin |
| TC-SEC-C002 | Random origin NOT reflected | HIGH | No CORS header for unknown |
| TC-SEC-C003 | MEDIUM-002: Vary: Origin missing | MEDIUM | Confirmed gap |
| TC-SEC-C004 | OPTIONS returns 204 | LOW | Preflight handled |
| TC-SEC-T001 | Hash-based equal length | MEDIUM | Timing-safe comparison |
| TC-SEC-D001-D003 | Dual-key rotation | HIGH | Both keys work simultaneously |
| TC-INTEG-V001-V003 | Input validation | HIGH | Whitespace trimmed, blanks OK |

### SSE Tests (`test_sse.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-SEC-E001 | Under limit: accept | HIGH | canAcceptConnection True |
| TC-SEC-E002 | Multiple IPs simultaneous | MEDIUM | Each IP has own counter |
| TC-SEC-E003 | Max 50 total connections | HIGH | 51st rejected |
| TC-SEC-E004 | Max 10 per IP | HIGH | 11th from same IP rejected |
| TC-SEC-E005 | Unregister decrements | MEDIUM | Count goes back to 0 |
| TC-SEC-E006 | Task created event emits | HIGH | Handler receives payload |
| TC-SEC-E007 | Task updated event emits | MEDIUM | Payload delivered |
| TC-SEC-E008 | Task deleted minimal | MEDIUM | Only id sent |
| TC-SEC-E009 | Project events work | LOW | All 3 project events emit |
| TC-SEC-E010 | Handler registered on connect | MEDIUM | EventBus listeners added |
| TC-SEC-E011 | No duplicate handlers | LOW | Each connection gets one |
| TC-SEC-E012 | Description excluded | HIGH | Bandwidth optimization works |
| TC-SEC-E013 | All non-desc fields included | MEDIUM | 9 fields in payload |
| TC-SEC-E014 | Max listeners = 100 | LOW | Configured properly |

### Accessibility Tests (`test_accessibility.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-A11Y-TC001 | Article with listitem role | MEDIUM | Semantic HTML |
| TC-A11Y-TC002 | aria-label present | MEDIUM | Descriptive label |
| TC-A11Y-TC003 | tabIndex={0} for keyboard | MEDIUM | Keyboard navigable |
| TC-A11Y-TC004 | Dot aria-hidden (UI-007) | HIGH | Color not sole info carrier |
| TC-A11Y-TC005 | Text label for priority | HIGH | Screen readers can announce |
| TC-A11Y-TC006 | time element with datetime | LOW | Machine-readable dates |
| TC-A11Y-TC007 | Avatar aria-hidden | LOW | Decorative element hidden |
| TC-A11Y-TC008 | HIGH-001 documented | HIGH | Dynamic dark: purge confirmed |
| TC-A11Y-AS001 | Main landmark | MEDIUM | <main> role="main" |
| TC-A11Y-AS002 | Aside with nav label | MEDIUM | Semantic sidebar |
| TC-A11Y-AS003 | MEDIUM-003 documented | MEDIUM | Role mismatch noted |
| TC-A11Y-ST001 | Skip-to-content link | HIGH | Keyboard shortcut available |
| TC-A11Y-FV001 | focus-visible global rule | HIGH | Focus indicator defined |
| TC-A11Y-FV002 | Outline/ring on focus | MEDIUM | Visible focus state |
| TC-A11Y-CC001-002 | CSS variables defined | MEDIUM | Theme colors configurable |
| TC-A11Y-SUM001 | ~85% WCAG AA estimate | INFO | See detailed analysis |

### E2E Tests (`test_user_flows.py`)

| TC-ID | Description | Priority | Expected |
|-------|-------------|----------|----------|
| TC-E2E-K001 | Dashboard loads | HIGH | 200, renders content |
| TC-E2E-K002 | Kanban columns visible | HIGH | in_work/review/done |
| TC-E2E-K003 | Task cards render | MEDIUM | With titles, badges |
| TC-E2E-PS001 | Project list in sidebar | MEDIUM | Nav landmark present |
| TC-E2E-PS002 | Filter by project | MEDIUM | URL/state change |
| TC-E2E-TC001 | Create button exists | LOW | Button/icon present |
| TC-E2E-TC002 | Modal form fields | MEDIUM | Title/assignee/priority |
| TC-E2E-TC003 | MEDIUM-001: 401 expected | MEDIUM | Known limitation |
| TC-E2E-R001 | SSE accessible without auth | HIGH | Not 401 |
| TC-E2E-R002 | SSE Content-Type correct | HIGH | text/event-stream |
| TC-E2E-R003 | SSE no-cache headers | MEDIUM | Cache-Control: no-cache |
| TC-E2E-R004 | Dashboard fetches initial data | LOW | API returns data |
| TC-E2E-TS001 | Theme toggle present | LOW | Toggle switch visible |
| TC-E2E-RL001 | Viewport meta tag | LOW | Responsive design ready |

---

## Coverage Targets

| Module | Target | Notes |
|--------|--------|-------|
| `lib/auth.ts` | ≥ 90% | Critical security module |
| `lib/errors.ts` | ≥ 85% | Error handling paths |
| `lib/rate-limiter.ts` | ≥ 80% | State machine patterns |
| `lib/events/event-bus.ts` | ≥ 85% | EventEmitter management |
| `lib/services/*.ts` | ≥ 80% | CRUD operations |
| `lib/validators/*.ts` | ≥ 95% | Schema definitions |
| `middleware.ts` | ≥ 75% | Request/response flow |
| Total line coverage | ≥ 80% | Overall target |

---

## Entry/Exit Criteria

### Entry Criteria
- [x] Source code compiled successfully (46 files in src/)
- [x] Unit tests exist (5 suites, 29 tests)
- [x] Code review completed (PASS with 1 HIGH, 4 MEDIUM findings)
- [x] Prisma schema generated
- [x] Docker compose configuration available

### Exit Criteria
- [x] All critical tests pass (no CRITICAL bugs)
- [x] High priority bugs ≤ 5 → was 1, now 0 (BUG-001 fixed in iter 2)
- [ ] Line coverage ≥ 80% → ~80% (estimated, static analysis based)
- [x] All integration tests executed
- [x] Accessibility static analysis complete
- [x] SSE connection tests complete

### Iteration 2 Bug Verification Status
- [x] BUG-001 verified FIXED — static PRIORITY_CLASSES map, JIT-safe
- [x] BUG-002 verified FIXED — Vary: Origin header present in getCorsHeaders()
- [x] BUG-003 verified FIXED — aside element uses implicit complementary role
- [x] No regressions detected — all 81 existing tests compatible with fixes
- [ ] LOW-005 deferred — missing Cache-Control on projects/[id]/tasks (documented by code-reviewer)

---

## Known Limitations

1. **MEDIUM-001**: UI write operations always return 401 — intentional for v1 (read-only dashboard)
2. **Docker environment**: Integration tests run against unit-level mocks when app server is not running
3. **E2E tests**: Require Playwright and live app server; marked as skip-if-not-available

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limiter in-memory storage loses state on restart | Medium | Documented for single-instance deployment |
| x-forwarded-for spoofing | Medium | Requires trusted reverse proxy (documented) |
| Tailwind dark mode classes purged | **HIGH** | Block before production (HIGH-001) |
| API key hardcoded in seed file | Low | Dev-only, should be caught in pre-commit |
