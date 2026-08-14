# Implementation Plan — Project Manager UI v1

**Version:** 1.5
**Author:** architecture-planner
**Date:** 2026-08-13
**Updated:** 2026-08-14 — Phase 8 added: TSK-021 Delete task button in UI

---

## 1. Implementation Phases

The implementation is divided into 5 phases, ordered by dependency. Each phase produces a working, testable increment.

### Phase 1: Foundation (TSK-005, TSK-008)
**Goal:** Project skeleton, database, auth middleware, security baseline.

| Step | Task | Output | Audit Ref |
|---|---|---|---|
| 1.1 | Initialize Next.js 15 project (App Router, TypeScript, Tailwind v4) | `npx create-next-app` scaffold | — |
| 1.2 | Install dependencies: `prisma`, `@prisma/client`, `zod`, `shadcn/ui` | `package.json` | — |
| 1.3 | Create Prisma schema (from ADR-003 + 4 audit-driven additive changes) | `prisma/schema.prisma` | DATA-PHASE1-001,003,004 |
| 1.4 | Run `prisma migrate dev` → create initial migration | `prisma/migrations/` | — |
| 1.5 | Create Prisma client singleton (with `connection_limit=10`) | `lib/db/client.ts` | DATA-PHASE1-006 |
| 1.6 | Create seed script with demo data | `prisma/seed.ts` | — |
| 1.7 | Implement API key auth middleware (**timing-safe**, dual-key support) | `middleware.ts`, `lib/auth.ts` | SEC-PHASE1-001,006,010 |
| 1.8 | Implement rate limiter middleware (global + auth failure limits) | `lib/rate-limiter.ts` | SEC-PHASE1-002 |
| 1.9 | Configure security headers via `next.config.ts` | `next.config.ts` | SEC-PHASE1-003 |
| 1.10 | Configure CORS (specific origin, no wildcard) | `middleware.ts` | SEC-PHASE1-007 |
| 1.11 | Configure Docker Compose (multi-stage, non-root, pinned PostgreSQL, `.dockerignore`) | `docker-compose.yml`, `Dockerfile`, `.dockerignore` | SEC-PHASE1-008 |
| 1.12 | Create `.env.example` with `DATABASE_URL`, `API_KEY`, `API_KEY_SECONDARY`, `CORS_ALLOWED_ORIGINS` | `.env.example` | — |
| 1.13 | Implement error handler (sanitized Prisma errors, no stack traces) | `lib/errors.ts` | SEC-PHASE1-009 |

**Acceptance:** `docker-compose up` starts app + DB as non-root; `prisma db seed` populates demo data; API key validated with `crypto.timingSafeEqual`; rate limiter rejects >100 req/min; security headers present in responses.

---

### Phase 2: Backend API (TSK-006, TSK-007, TSK-008)
**Goal:** Full REST API for projects, tasks, and users.

| Step | Task | Output |
|---|---|---|
| 2.1 | Implement Zod validators for all entities | `lib/validators/*.ts` |
| 2.2 | Implement `ProjectService` (CRUD) | `lib/services/project-service.ts` |
| 2.3 | Implement `TaskService` (CRUD + event emit) | `lib/services/task-service.ts` |
| 2.4 | Implement `UserService` (CRUD) | `lib/services/user-service.ts` |
| 2.5 | Create API routes: `/api/projects` (GET, POST) | `app/api/projects/route.ts` |
| 2.6 | Create API routes: `/api/projects/[id]` (GET, PUT, DELETE) | `app/api/projects/[id]/route.ts` |
| 2.7 | Create API routes: `/api/projects/[id]/tasks` (GET) | `app/api/projects/[id]/tasks/route.ts` |
| 2.8 | Create API routes: `/api/tasks` (GET, POST) | `app/api/tasks/route.ts` |
| 2.9 | Create API routes: `/api/tasks/[id]` (GET, PUT, DELETE) | `app/api/tasks/[id]/route.ts` |
| 2.10 | Create API routes: `/api/users` (GET, POST) | `app/api/users/route.ts` |
| 2.11 | Add error handling middleware (consistent error format) | `lib/errors.ts` |

**Acceptance:** All endpoints work with `curl`/Postman; API key required for writes; demo data queryable.

---

### Phase 3: Real-Time Layer (TSK-009)
**Goal:** SSE event broadcasting for live updates with connection limits.

| Step | Task | Output | Audit Ref |
|---|---|---|---|
| 3.1 | Implement EventBus with connection tracking (max 50 total, 10/IP) | `lib/events/event-bus.ts` | SEC-PHASE1-004 |
| 3.2 | Integrate EventBus into TaskService (emit after mutations, SSE-optimized select) | Updated `task-service.ts` | DATA-PHASE1-008 |
| 3.3 | Integrate EventBus into ProjectService (emit after mutations) | Updated `project-service.ts` | — |
| 3.4 | Create SSE endpoint `/api/events` with connection limit enforcement | `app/api/events/route.ts` | SEC-PHASE1-004 |
| 3.5 | Add heartbeat mechanism (30s interval) + cleanup on abort | Inside SSE endpoint | SEC-PHASE1-004 |
| 3.6 | Test: curl SSE endpoint + trigger API mutation → verify event received | Manual test | — |
| 3.7 | Test: open 51 connections → 51st rejected with 503 | Manual test | SEC-PHASE1-004 |

**Acceptance:** `curl -N http://localhost:3000/api/events` receives events; SSE payload excludes `description` field; connection limits enforced.

---

### Phase 4: Frontend (TSK-010, TSK-011, TSK-012, TSK-013)
**Goal:** Complete dashboard UI with real-time updates and WCAG 2.1 AA compliance.

| Step | Task | Output | Audit Ref |
|---|---|---|---|
| 4.1 | Setup shadcn/ui: install components (Button, Card, Dialog, Input, Select, Badge) | `app/components/ui/` | — |
| 4.2 | Configure design tokens from `ui-spec.md` (contrast-safe CSS variables, dark+light) | `globals.css`, `tailwind.config.ts` | UI-PHASE1-001 |
| 4.3 | Implement global focus-visible CSS rule (`@layer base`) | `globals.css` | UI-PHASE1-005 |
| 4.4 | Implement skip-to-content link | `app/layout.tsx` | UI-PHASE1-002 |
| 4.5 | Implement `AppProvider` context (global state + loading/error states) | `lib/context/app-context.tsx` | UI-PHASE1-008 |
| 4.6 | Implement `useSSE` hook (EventSource + reconnect + online indicator) | `lib/hooks/use-sse.ts` | — |
| 4.7 | Implement `useProjects` hook (fetch + SSE updates) | `lib/hooks/use-projects.ts` | — |
| 4.8 | Implement `useTasks` hook (fetch + SSE updates) | `lib/hooks/use-tasks.ts` | — |
| 4.9 | Implement `useTheme` hook (dark/light toggle) | `lib/hooks/use-theme.ts` | — |
| 4.10 | Implement `useFocusTrap` hook (modal focus management) | `lib/hooks/use-focus-trap.ts` | UI-PHASE1-006 |
| 4.11 | Implement `useToast` hook + `ToastContainer` component | `lib/hooks/use-toast.ts` | UI-PHASE1-004 |
| 4.12 | Build `AppShell` with ARIA landmarks (`<aside>`, `<main>`, `<header>`) | `app/components/layout/AppShell.tsx` | UI-PHASE1-002 |
| 4.13 | Build `Sidebar` with `aria-current`, focus rings, `role="switch"` toggle | `app/components/layout/Sidebar.tsx` | UI-PHASE1-005 |
| 4.14 | Build `Header` with connection indicator + subproject selector | `app/components/layout/Header.tsx` | — |
| 4.15 | Build `KanbanBoard` + `KanbanColumn` with skeleton loading states | `app/components/kanban/` | UI-PHASE1-008 |
| 4.16 | Build `TaskCard` with `line-clamp-1` title, `aria-hidden` dots, focus ring | `app/components/kanban/TaskCard.tsx` | UI-PHASE1-003,007 |
| 4.17 | Build `ModalWrapper` (focus trap, ESC, aria-modal, scroll lock) | `app/components/modals/ModalWrapper.tsx` | UI-PHASE1-006 |
| 4.18 | Build `CreateTaskModal` (wraps ModalWrapper, inline validation, optimistic + rollback) | `app/components/modals/CreateTaskModal.tsx` | — |
| 4.19 | Build `CreateProjectModal` (wraps ModalWrapper) | `app/components/modals/CreateProjectModal.tsx` | — |
| 4.20 | Add `aria-live="polite"` region for real-time update announcements | `app/layout.tsx` | UI-PHASE1-002,004 |
| 4.21 | Wire up dashboard page (`app/page.tsx`) | Server Component → Client Components | — |
| 4.22 | Integration test: create task via API → appears on board via SSE + toast | Manual + E2E | — |
| 4.23 | Accessibility smoke test: keyboard navigation + axe DevTools scan | Manual | ALL UI findings |

**Acceptance:** Dashboard shows kanban board; task created via API appears on board without refresh + toast; theme toggle works; keyboard navigation complete; modals trap focus; axe reports 0 critical violations.

---

### Phase 5: Polish & Documentation (TSK-014)
**Goal:** Production-ready code with documentation.

| Step | Task | Output |
|---|---|---|
| 5.1 | Generate OpenAPI spec from API routes | `docs/guides/api/openapi.yaml` |
| 5.2 | Add JSDoc comments to all service methods | Inline documentation |
| 5.3 | Create README with setup instructions | `README.md` |
| 5.4 | Add error boundary component | `app/components/ErrorBoundary.tsx` |
| 5.5 | Add loading skeletons for kanban board | `app/components/kanban/KanbanSkeleton.tsx` |
| 5.6 | Final integration test (all acceptance criteria from PRD) | Test report |

**Acceptance:** All PRD criteria met; README explains how to run; OpenAPI spec is valid.

---

### Phase 6: User Authentication (TSK-018)
**Goal:** Email/password authentication with JWT cookies, role-based access control (admin/stakeholder/agent), and auth UI pages. Backward compatible with existing API_KEY auth.

**Prerequisites:** Phases 1–4 complete (app running, API functional, UI working).

| Step | Task | Output | Key Design Ref |
|---|---|---|---|
| 6.1 | Install dependencies: `jose` (JWT, Edge-compatible), `bcryptjs` (password hashing) | `package.json` updated | ADR-007 §Implementation Notes |
| 6.2 | Update Prisma schema: add `email` (unique, nullable), `passwordHash` (nullable) to User; add `admin` to `UserRole` enum | `prisma/schema.prisma` | ADR-007 §Migration Path |
| 6.3 | Create and apply migration: `prisma migrate dev --name add-user-auth` | `prisma/migrations/` | — |
| 6.4 | Create `lib/auth/session.ts`: JWT sign/verify using `jose`, cookie set/clear helpers, `getCurrentUser()` for route handlers. **JWT_SECRET startup validation: fail fast if missing or <64 chars** (AUTH-003) | `lib/auth/session.ts` | ADR-007 §3, §4, AUTH-003 |
| 6.4a | Create `lib/auth/audit-log.ts`: structured auth event logging (login_success, login_failure, register, auth_error) — server-side only, never log passwords/tokens (AUTH-007) | `lib/auth/audit-log.ts` | AUTH-007 |
| 6.5 | Create auth validators: `registerSchema` (email, password ≥8 + **common password blocklist** (AUTH-005), confirmPassword match), `loginSchema` (email, password) | `lib/validators/auth.ts` | AUTH-005 |
| 6.6 | Create `POST /api/auth/register` route: validate input, check email uniqueness, bcrypt hash (12 rounds), create user, set JWT cookie, return user. **If email exists: return 200 with generic message, do NOT create session** (AUTH-002). **Log register event** (AUTH-007) | `app/api/auth/register/route.ts` | ADR-007 §3, §4, AUTH-002, AUTH-007 |
| 6.7 | Create `POST /api/auth/login` route: find user by email, bcrypt compare, sign JWT, set cookie, return user. **Rate limit: only count FAILED attempts** (AUTH-008). **Log login_success/login_failure events** (AUTH-007) | `app/api/auth/login/route.ts` | ADR-007 §3, §4, AUTH-008, AUTH-007 |
| 6.8 | Create `POST /api/auth/logout` route: clear cookie, return success | `app/api/auth/logout/route.ts` | — |
| 6.9 | Create `GET /api/auth/me` route: verify JWT from cookie, return current user (or 401) | `app/api/auth/me/route.ts` | — |
| 6.10 | Create auth context: `AuthProvider`, `useAuth()` hook with `user`, `isAdmin`, `isStakeholder`, `isLoading`, `login()`, `logout()`, `register()` methods | `lib/context/auth-context.tsx` | — |
| 6.11 | Create `/login` page: email + password form, client-side validation, `role="alert"` error banner (HIGH-001), loading/disabled submit button (HIGH-004), `autoFocus` on email field (HIGH-007), toast notifications on success/error (HIGH-005), `router.replace('/')` for post-login redirect (HIGH-006), link to `/register` | `app/login/page.tsx` | HIGH-001, 004, 005, 006, 007 |
| 6.12 | Create `/register` page: name + email + password + confirm password form, validation (match, min 8 chars, common password check), real-time confirmPassword match indicator (HIGH-003), error display, loading/disabled submit (HIGH-004), `autoFocus` on name field (HIGH-007), redirect to `/` on success, link to `/login` | `app/register/page.tsx` | HIGH-003, 004, 007 |
| 6.12a | **FOUC prevention (CRIT-001):** `page.tsx` MUST check `isLoading` before rendering dashboard. During `isLoading`, render minimal spinner or `null`. After `isLoading`, if `!isAuthenticated` → redirect to `/login` | `app/page.tsx` | CRIT-001 |
| 6.12b | **Skip-link exception documentation (CRIT-002):** Auth pages (`/login`, `/register`) are full-page centered forms with no navigation — skip-to-content is NOT required per WCAG 2.4.1 when the form is the only content. Document this rationale inline | `app/login/page.tsx`, `app/register/page.tsx` | CRIT-002 |
| 6.12c | **Auth page mobile responsiveness (MED-003):** Even though dashboard is desktop-first, auth pages MUST be responsive — full-width centered card on mobile, touch-friendly tap targets (min 44×44px) | `app/login/page.tsx`, `app/register/page.tsx` | MED-003 |
| 6.12d | **Auth loading state component (MED-005):** Create minimal `AuthLoadingState` component — centered spinner with `sr-only` text for screen readers | `app/components/auth/AuthLoadingState.tsx` | MED-005 |
| 6.13 | Update `middleware.ts`: add JWT cookie verification alongside API key; auth flow: **(1) SSE endpoint `/api/events` requires auth** (AUTH-001), **(2) public auth routes use exact `Set` match, NOT prefix** (AUTH-010), **(3) `/api/users` requires `admin` role** (AUTH-006), (4) check API_KEY first for agent, (5) check JWT cookie for browser users, (6) role-based write protection (stakeholder → 403 on POST/PUT/PATCH/DELETE) | `middleware.ts` | ADR-007 §6, AUTH-001, AUTH-010, AUTH-006 |
| 6.14 | Update `middleware.ts` matcher: include page routes (`/((?!_next/static|_next/image|favicon.ico).*)`) for page-level redirect to `/login` | `middleware.ts` | — |
| 6.15 | Update `app/layout.tsx`: wrap children in `AuthProvider` | `app/layout.tsx` | — |
| 6.16 | Update `app/page.tsx`: redirect to `/login` if unauthenticated (check auth state before rendering dashboard) | `app/page.tsx` | — |
| 6.17 | Update `Sidebar.tsx`: hide "+ New Project" button for stakeholder role; show logged-in user email + logout button. **CRIT-003:** Maintain correct tab order for new elements (email display → logout → theme toggle). **MED-004:** Logout button: icon with `aria-hidden="true"` + text label "Logout" | `app/components/layout/Sidebar.tsx` | CRIT-003, MED-004 |
| 6.18 | Update `Header.tsx`: hide "+ Create Task" button for stakeholder role | `app/components/layout/Header.tsx` | — |
| 6.19 | Update `src/lib/types/index.ts`: add `admin` to `UserRole`, add `AuthUser` interface | `src/lib/types/index.ts` | — |
| 6.20 | Update `src/lib/validators/user.ts`: add `admin` to role enum | `src/lib/validators/user.ts` | — |
| 6.21 | Update `src/lib/services/user-service.ts`: add `findByEmail()`, support `admin` role in create | `src/lib/services/user-service.ts` | — |
| 6.22 | Update `seed.ts`: create admin user (email + password), keep existing agent + stakeholder users | `prisma/seed.ts` | — |
| 6.23 | Update `.env` and `.env.example`: add `JWT_SECRET` and `REGISTRATION_ENABLED` variables (AUTH-015). `.env.example` must include all required env vars with placeholder values | `.env`, `.env.example` | ADR-007 §2, AUTH-015, AUTH-009 |
| 6.24 | Write tests: auth endpoints (register with anti-enumeration, login with failure-only rate limit, logout, me), JWT sign/verify with startup validation, middleware role enforcement (admin-only routes, SSE auth, exact path matching) | `src/lib/__tests__/auth*.test.ts` | — |
| 6.25 | Integration test: register → login → create task (admin) → verify stakeholder 403 → verify API key still works → verify SSE requires auth → logout → redirect | Manual + E2E | — |
| 6.26 | Accessibility test: keyboard navigation through auth pages, screen reader flow, focus management after login redirect, ARIA landmarks on sidebar with new elements | Manual + axe DevTools | CRIT-001/002/003, HIGH-001/004/006/007 |

**Acceptance:**
- User can register with email + password (common passwords rejected)
- Duplicate email returns generic 200 message (no enumeration — AUTH-002)
- User can login → JWT in httpOnly cookie → redirect to dashboard
- App fails fast at startup if JWT_SECRET is missing or weak (AUTH-003)
- SSE endpoint requires authentication (AUTH-001)
- `/api/users` requires admin role (AUTH-006)
- Login rate limit counts only failures (AUTH-008)
- Auth events logged server-side (AUTH-007)
- Admin can create projects, tasks, change statuses
- Stakeholder sees dashboard but cannot write (403 on write ops, buttons hidden)
- Agent with API_KEY retains full access (backward compatible)
- Unauthenticated users redirected to `/login` (no FOUC — CRIT-001)
- Auth pages responsive on mobile (MED-003)
- Loading states on all auth submit buttons (HIGH-004)
- Error messages announced via `role="alert"` (HIGH-001)
- Logout clears cookie and redirects to `/login`
- Build passes (`npm run build`)
- Tests pass (`npm test`)

---

### Phase 7: DELETE Endpoint Tests & Docs (TSK-020)
**Goal:** Comprehensive test coverage for DELETE `/api/tasks/[id]` and complete API documentation. No new endpoint implementation — the DELETE handler already exists and works.

**Prerequisites:** Phases 1–6 complete (endpoint functional, auth working, SSE active).

| Step | Task | Output | Test Pattern |
|---|---|---|---|
| 7.1 | Write static analysis test: verify DELETE handler exports in route file | `task-delete-api.test.ts` | `fs.readFileSync` + `toContain('export async function DELETE')` |
| 7.2 | Write static analysis test: verify UUID validation via `uuidSchema.safeParse` in DELETE handler | `task-delete-api.test.ts` | Source code pattern check |
| 7.3 | Write static analysis test: verify `handleApiError` import and usage in DELETE handler | `task-delete-api.test.ts` | Source code pattern check |
| 7.4 | Write unit test: `handleApiError` maps Prisma P2025 to 404 NOT_FOUND (covers delete-not-found case) | `task-delete-api.test.ts` | Direct function call with mock Prisma error |
| 7.5 | Write unit test: UUID validation rejects non-UUID strings (empty, `not-a-uuid`, SQL injection attempt) | `task-delete-api.test.ts` | `uuidSchema.safeParse()` direct call |
| 7.6 | Write unit test: event bus emits `task_deleted` with `{ id }` payload | `task-delete-api.test.ts` | `eventBus.emitTaskEvent` + listener verification |
| 7.7 | Write static analysis test: middleware includes `DELETE` in `isWrite` methods array | `task-delete-api.test.ts` | Middleware source check |
| 7.8 | Write static analysis test: middleware returns 403 for stakeholder role on write operations | `task-delete-api.test.ts` | Middleware source check for `stakeholder` + `FORBIDDEN` |
| 7.9 | Verify OpenAPI spec already includes DELETE `/tasks/{id}` operation — add `CookieAuth` security scheme alongside `ApiKeyAuth` if missing | `openapi.yaml` | Manual review + edit |
| 7.10 | Run full test suite to ensure no regressions | `npm test` passes | — |

**Test strategy:**
- Tests follow existing patterns in `api-integration-tests.test.ts` (static analysis) and `errors.test.ts` (unit tests)
- No HTTP server required — Vitest + jsdom environment
- Prisma errors simulated via `Prisma.PrismaClientKnownRequestError` constructor or `handleApiError` directly
- SSE event emission tested via `eventBus` listener pattern
- Middleware auth behavior verified via source code static analysis (consistent with existing tests)

**Acceptance:**
- All 6 test scenarios pass (happy path, invalid UUID, not found, 401, 403, SSE event)
- Static analysis confirms consistent patterns (handleApiError, safeParse, isWrite)
- OpenAPI spec accurately documents DELETE with both auth methods
- All existing tests still pass
- Coverage remains > 80%

### Phase 8: Delete Task Button in UI (TSK-021)
**Goal:** Admin-only delete button on TaskCard with confirmation modal, optimistic update, and error rollback. No backend changes — the DELETE endpoint already exists (TSK-020).

**Prerequisites:** Phases 1–7 complete (endpoint working, auth working, SSE active, edit modal pattern established).

| Step | Task | Output | Pattern Reference |
|---|---|---|---|
| 8.1 | Add `deleteTask(taskId: string)` async function to `app-context.tsx`: optimistic remove via `removeTaskOptimistic`, call `DELETE /api/tasks/${taskId}`, rollback on error + error toast, success toast on completion | `src/lib/context/app-context.tsx` | EditTaskModal optimistic pattern |
| 8.2 | Create `DeleteTaskModal` component: wraps `ModalWrapper`, confirmation message with task title, Cancel (focus default) + Delete (red destructive) buttons, loading state on confirm button | `src/app/components/modals/DeleteTaskModal.tsx` | EditTaskModal + ModalWrapper |
| 8.3 | Add `onDelete` prop to `TaskCard`: trash icon button next to edit button, `isAdmin && onDelete` guard, `aria-label="Delete task: {title}"` | Updated `TaskCard.tsx` | Existing edit button pattern |
| 8.4 | Add `onDelete` prop to `KanbanColumn`: pass through to TaskCard | Updated `KanbanColumn.tsx` | Existing `onEdit` pass-through |
| 8.5 | Wire up delete flow in `KanbanBoard`: add `deletingTask` state + `handleDelete`/`handleCloseDelete` callbacks, pass `onDelete` to columns, render `DeleteTaskModal` when `deletingTask` set | Updated `KanbanBoard.tsx` | Existing `editingTask` pattern |
| 8.6 | Write unit tests: DeleteTaskModal renders correctly, Cancel closes, Delete calls `deleteTask`, loading state disables button | `src/lib/__tests__/delete-task-modal.test.tsx` | EditTaskModal test patterns |
| 8.7 | Write integration test: click trash icon → modal opens → confirm → task removed from board | `src/lib/__tests__/task-delete-ui.test.tsx` | Existing integration patterns |
| 8.8 | Run `npm run build` and `npm test` to verify no regressions | Build + test pass | — |

**Implementation Notes:**
- **`deleteTask` in app-context** encapsulates the full flow (optimistic → API → rollback/toast) so `DeleteTaskModal` stays thin — it just calls `deleteTask(id)` and closes
- **No new hooks needed** — uses existing `removeTaskOptimistic`, `addToast`, and the `fetch` pattern from EditTaskModal
- **No new API routes** — uses existing `DELETE /api/tasks/[id]`
- **SSE redundancy** — `task_deleted` SSE event will also arrive, but `removeTaskOptimistic` already removed the task, so the SSE handler's `filter(t => t.id !== id)` is idempotent (no-op if already removed)
- **Double-delete protection** — `deleteTask` should check if task still exists in state before calling API (defensive guard against race conditions)

**Acceptance:**
- Delete button (trash icon) visible only to admin users
- Clicking delete opens confirmation modal with task title
- Cancel / ESC closes modal without action
- Confirm triggers optimistic remove + API call
- API success: task removed, success toast shown
- API failure: task restored to board, error toast shown with message
- SSE `task_deleted` event handled gracefully (idempotent)
- Keyboard: Tab to trash icon, Enter/Space opens modal, Tab within modal (Cancel focused by default), ESC closes
- Screen reader: `aria-label` on delete button, `aria-describedby` on modal warning text
- Build passes (`npm run build`)
- All tests pass (`npm test`)

---

## 2. Task-to-Backlog Mapping

| Phase | Backlog Tasks | Dependencies |
|---|---|---|
| Phase 1 | TSK-005 (Database setup & Prisma), TSK-008 (Users & Auth) | None |
| Phase 2 | TSK-006 (API Projects), TSK-007 (API Tasks), TSK-008 (API Users) | Phase 1 |
| Phase 3 | TSK-009 (Real-time updates) | Phase 2 |
| Phase 4 | TSK-010 (Kanban), TSK-011 (Sidebar), TSK-012 (Theme), TSK-013 (Real-time client) | Phase 3 |
| Phase 5 | TSK-014 (API docs) | Phase 4 |
| Phase 6 | TSK-018 (User Authentication) | Phase 4 |
| Phase 7 | TSK-020 (DELETE endpoint tests & docs) | Phase 6 |
| Phase 8 | TSK-021 (Delete task button in UI) | Phase 7 |

---

## 3. Implementation Priorities

### Must Have (v1)
1. ✅ Database schema + Prisma
2. ✅ REST API (Projects, Tasks, Users)
3. ✅ API key authentication for writes
4. ✅ SSE real-time broadcasting
5. ✅ Kanban board (3 columns)
6. ✅ Sidebar with project switching
7. ✅ Dark theme (default) + light theme toggle
8. ✅ Task creation modal
9. ✅ Online/offline connection indicator
10. ✅ User authentication (email/password + JWT cookie) — TSK-018
11. ✅ Role-based access control (admin/stakeholder/agent) — TSK-018
12. Task delete button with confirmation (admin-only) — TSK-021

### Should Have (v1 if time permits)
10. Subproject selector in header
11. Error boundary with fallback UI
12. Loading skeletons

### Won't Have (v2)
- Drag-and-drop
- Filters/search
- Notifications
- Analytics
- Mobile responsive
- Token refresh / instant revocation
- OAuth / social login providers

---

## 4. Development Environment Setup

```bash
# 1. Clone and install
git clone <repo>
cd project-manager-ui
npm install

# 2. Environment
cp .env.example .env
# Edit .env: set DATABASE_URL and API_KEY

# 3. Database
docker-compose up -d db    # Start PostgreSQL
npx prisma migrate dev     # Run migrations
npx prisma db seed         # Seed demo data

# 4. Development server
npm run dev                # http://localhost:3000

# 5. Test API
curl http://localhost:3000/api/projects
curl -H "X-API-Key: <key>" -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<uuid>","title":"Test task","assignee":"Dev"}'

# 6. Test SSE
curl -N http://localhost:3000/api/events
```

---

## 5. Risks During Implementation

| Risk | Mitigation |
|---|---|
| Next.js App Router streaming breaks SSE | Use `dynamic = 'force-dynamic'` export; test early |
| Prisma connection pool exhaustion | Set `pool_size` in DATABASE_URL; use singleton pattern |
| Tailwind v4 breaking changes from prototype | Use Tailwind v4 config; prototype is reference only |
| shadcn/ui components don't match prototype style | Customize shadcn theme tokens to match prototype colors |
| Docker networking issues (app → db) | Use Docker Compose service names; test `docker-compose up` early |
| `jose` library Edge Runtime compatibility issues | Test JWT sign/verify in middleware early; fallback to `jsonwebtoken` in Node.js API routes only |
| Middleware matcher too broad — blocks static assets or `_next` internals | Use explicit negative patterns in matcher; test all page routes |
| Cookie not sent in development (localhost vs 127.0.0.1 mismatch) | Set `secure: false` in dev; test with consistent hostname |
| `bcryptjs` performance on high-concurrency login | Acceptable for v1 scale (5-10 users); benchmark if needed |
