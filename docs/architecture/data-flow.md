# Data Flow Diagram — Project Manager UI v1

**Version:** 1.3
**Author:** architecture-planner
**Date:** 2026-08-13
**Updated:** 2026-08-14 — Added DELETE task flow (TSK-020), SSE auth, middleware decision logic

---

## 1. System Actors

| Actor | Interface | Auth Method | Direction |
|---|---|---|---|
| **Admin (Browser)** | Web UI | JWT in httpOnly cookie | Full CRUD via UI |
| **Stakeholder (Browser)** | Web UI | JWT in httpOnly cookie | Read-only dashboard |
| **AI Agent (project-manager)** | REST API | API Key (X-API-Key header) | Full CRUD via HTTP |
| **Next.js Server** | Internal | — | Orchestrates API → DB → SSE broadcast |
| **PostgreSQL** | SQL (via Prisma) | — | Persists all entities |

---

## 2. Primary Data Flows

### 2.1 Agent Creates/Updates a Task (Write Path)

```
┌──────────┐     HTTP POST/PUT          ┌──────────────┐
│ AI Agent │ ──────────────────────────→ │ Next.js API  │
│          │  X-API-Key: ***            │ Route Handler│
│          │  Body: { title, status... } │              │
└──────────┘                            └──────┬───────┘
                                               │
                         ┌─────────────────────┼──────────────────┐
                         │                     │                  │
                         ▼                     ▼                  ▼
                  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
                  │ Zod         │    │ Prisma       │    │ Event Bus    │
                  │ Validation  │    │ DB Write     │    │ (emit)       │
                  └──────┬──────┘    └──────┬───────┘    └──────┬───────┘
                         │                  │                   │
                    (reject if         (INSERT/            (after DB
                     invalid)           UPDATE)              commit)
                         │                  │                   │
                         │                  ▼                   ▼
                         │           ┌──────────────┐    ┌──────────────┐
                         │           │ PostgreSQL   │    │ SSE Stream   │
                         │           │              │    │ → all clients│
                         │           └──────────────┘    └──────┬───────┘
                         │                                      │
                         │                                      ▼
                         │                               ┌──────────────┐
                         │                               │ Browser      │
                         │                               │ (EventSource)│
                         │                               │ → update UI  │
                         │                               └──────────────┘
                         │
                    return 200/201
                    → Agent
```

**Sequence:**
1. Agent sends `POST /api/tasks` or `PUT /api/tasks/:id` with `X-API-Key` header
2. Middleware validates API key → reject with 401 if invalid
3. Route handler validates body with Zod schema → reject with 400 if invalid
4. Service layer calls Prisma to persist the entity
5. After successful DB write, service emits event to EventBus (`task_created` or `task_updated`)
6. EventBus pushes event to all active SSE connections
7. Route handler returns 201 (created) or 200 (updated) with the entity JSON
8. Browser clients receive SSE event and update React state → UI re-renders

### 2.1a Agent/Admin Deletes a Task (DELETE Path — TSK-020)

```
┌──────────┐     DELETE /api/tasks/:id    ┌──────────────┐
│ AI Agent │ ───────────────────────────→ │ Middleware    │
│ or Admin │  X-API-Key / JWT cookie      │ (auth gate)  │
└──────────┘                              └──────┬───────┘
                                                 │
                          ┌──────────────────────┼────────────────────┐
                          │                      │                    │
                     unauth                  stakeholder        admin/agent
                     → 401                   → 403              → pass
                          │                      │                    │
                          │                      │                    ▼
                          │                      │            ┌──────────────┐
                          │                      │            │ Route Handler│
                          │                      │            │ UUID check   │
                          │                      │            │ (Zod)        │
                          │                      │            └──────┬───────┘
                          │                      │                   │
                          │                      │              invalid UUID
                          │                      │              → 400 response
                          │                      │                   │
                          │                      │              valid UUID
                          │                      │                   ▼
                          │                      │            ┌──────────────┐
                          │                      │            │ taskService  │
                          │                      │            │ .delete(id)  │
                          │                      │            └──────┬───────┘
                          │                      │                   │
                          │                      │              ┌────┴────┐
                          │                      │              │         │
                          │                      │           found    not found
                          │                      │              │     (P2025)
                          │                      │              │         │
                          │                      │              ▼         ▼
                          │                      │      ┌──────────┐ ┌──────────────┐
                          │                      │      │EventBus  │ │handleApiError│
                          │                      │      │task_     │ │→ 404         │
                          │                      │      │deleted   │ │NOT_FOUND     │
                          │                      │      └────┬─────┘ └──────┬───────┘
                          │                      │           │              │
                          │                      │           ▼              ▼
                          │                      │    SSE broadcast    404 response
                          │                      │    { id }           to client
                          │                      │           │
                          │                      │           ▼
                          │                      │    200 { id }
                          │                      │    to client
```

**Sequence:**
1. Agent/Admin sends `DELETE /api/tasks/:id` with auth (API key or JWT cookie)
2. Middleware checks auth → 401 if missing, 403 if stakeholder role, passes admin/agent
3. Route handler validates `:id` with `z.string().uuid()` → 400 if invalid format
4. `taskService.delete(id)` calls `prisma.task.delete({ where: { id } })`
5. **Not found**: Prisma throws P2025 → `handleApiError` maps to 404 NOT_FOUND
6. **Found**: Prisma deletes record → service returns `{ id }`
7. EventBus emits `task_deleted` with minimal payload `{ id }`
8. All SSE-connected clients receive the event → remove task from UI state
9. Route handler returns `200 { id }` to caller

### 2.2 Stakeholder Views Dashboard (Read Path)

```
┌──────────────┐    GET /api/projects     ┌──────────────┐
│ Browser      │ ───────────────────────→ │ Next.js API  │
│ (on load)    │                          │              │
│              │ ←─────────────────────── │ Prisma query │
│              │    JSON: projects[]       └──────────────┘
│              │
│              │    GET /api/projects/:id/tasks
│              │ ───────────────────────→ ┌──────────────┐
│              │                          │ Prisma query │
│              │ ←─────────────────────── │ WHERE project│
│              │    JSON: tasks[]         └──────────────┘
└──────────────┘
```

**Sequence:**
1. Browser loads page → Next.js Server Component fetches initial data
2. Client Component hydrates with server-provided data
3. Client establishes SSE connection (`GET /api/events`)
4. Subsequent data reads go through client-side `fetch()` to API routes

### 2.3 Real-Time Update Flow (SSE — Updated AUTH-001)

```
┌──────────────┐    GET /api/events       ┌──────────────────────────────┐
│ Browser      │ ───────────────────────→ │ SSE Endpoint                 │
│              │  Cookie: auth_token=JWT  │                              │
│              │  (auto-sent by browser)  │ 1. Check API Key header      │
│              │                          │ 2. Check JWT cookie          │
│              │                          │ 3. Neither → 401 reject      │
│              │                          │ 4. Auth OK → register        │
│              │                          │    listener on EventBus      │
│              │                          └──────┬───────────────────────┘
│              │                                 │
│              │    event: task_updated           │
│              │ ←────────────────────────────── │ (on event)
│              │    data: { id, status, ...}      │
│              │                                 │
│  React       │                                 │
│  setState()  │                                 │
│  → re-render │                                 │
└──────────────┘                                 │
                                                 │
                              (Agent API call triggers this)
```

**Sequence:**
1. Browser opens `GET /api/events` (cookie sent automatically by EventSource)
2. **Server checks authentication** (AUTH-001): API Key header OR JWT cookie → reject with 401 if neither valid
3. On successful auth → server responds with `Content-Type: text/event-stream`
4. Server registers an event listener for this connection on the EventBus
5. When any write operation completes, EventBus emits event to all listeners
6. Each listener writes SSE-formatted data to its response stream
7. Browser's `EventSource` receives the event and fires the registered callback
8. React state updates → component re-renders with new data

**Note for SSE reconnection:** After login, the `useSSE` hook must be re-initialized since the SSE connection now requires a valid JWT cookie. The hook should detect auth state changes and reconnect accordingly.

---

## 3. Data Flow Between Components

### 3.1 Frontend Component Data Flow

```
AppProvider (React Context)
├── State: projects[], tasks[], currentProjectId, theme, isOnline
│
├── Sidebar
│   ├── Reads: projects[], currentProjectId
│   └── Writes: currentProjectId (on click), theme (toggle)
│
├── Header
│   ├── Reads: currentProject, tasks (for counts), isOnline
│   └── Writes: opens modal
│
├── KanbanBoard
│   ├── Reads: tasks (filtered by currentProjectId, grouped by status)
│   └── Renders: TaskCard ×N per column
│
├── CreateTaskModal
│   ├── Reads: modal state, currentProjectId
│   └── Writes: POST /api/tasks → adds to tasks[]
│
└── CreateProjectModal
    ├── Reads: modal state
    └── Writes: POST /api/projects → adds to projects[]
```

### 3.2 State Management Strategy

| State | Source | Update Trigger |
|---|---|---|
| `projects[]` | Server (initial load) | SSE `project_*` events, local POST |
| `tasks[]` | Server (initial load) | SSE `task_*` events, local POST/PUT |
| `currentProjectId` | Client (localStorage) | User clicks project in sidebar |
| `theme` | Client (localStorage) | User clicks theme toggle |
| `isOnline` | Client (SSE connection) | SSE open/error events |

### 3.3 Server-Side Data Flow

```
HTTP Request
    │
    ▼
Next.js Middleware
    │ (API key validation for write ops)
    ▼
Route Handler (app/api/*/route.ts)
    │ (parse request, extract params)
    ▼
Service Layer (lib/services/*.ts)
    │ (business logic, Zod validation)
    ▼
Prisma Client (lib/db/client.ts)
    │ (ORM query → SQL)
    ▼
PostgreSQL
    │ (execute query)
    ▼
Result → EventBus emit → SSE broadcast → API response
```

---

## 4. Error Flow

```
API Call → Validation Error → 400 { error: { code, message, details } }
API Call → Auth Error       → 401 { error: { code: "UNAUTHORIZED" } }
API Call → Not Found        → 404 { error: { code: "NOT_FOUND" } }
API Call → Server Error     → 500 { error: { code: "INTERNAL_ERROR" } }

SSE Disconnect → EventSource auto-reconnect (browser)
                 → Client re-fetches current state on reconnect
```

---

## 5. Authentication Data Flows (TSK-018)

### 5.1 User Registration Flow

```
┌──────────────┐   POST /api/auth/register       ┌──────────────┐
│ Browser      │ ──────────────────────────────→  │ Next.js API  │
│ (new user)   │  { name, email, password,        │ /auth/register│
│              │    confirmPassword }              │              │
└──────────────┘                                  └──────┬───────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────┐
                        │                                │                    │
                        ▼                                ▼                    ▼
                 ┌─────────────┐              ┌──────────────┐      ┌──────────────┐
                 │ Zod         │              │ Email        │      │ bcrypt       │
                 │ Validation  │              │ uniqueness   │      │ hash(12)     │
                 └──────┬──────┘              │ check        │      └──────┬───────┘
                        │                     └──────┬───────┘             │
                   (reject if                  (409 if                  (hash
                    invalid)                    exists)                  password)
                        │                           │                     │
                        │                           ▼                     ▼
                        │                    ┌──────────────┐      ┌──────────────┐
                        │                    │ Prisma       │      │ JWT sign     │
                        │                    │ INSERT user  │─────→│ (jose, HS256)│
                        │                    │ (email,      │      │ payload:     │
                        │                    │  passwordHash,│      │ {sub, email, │
                        │                    │  role=        │      │  role}       │
                        │                    │  stakeholder) │      └──────┬───────┘
                        │                    └──────────────┘             │
                        │                                                ▼
                        │                                         ┌──────────────┐
                        │                                         │ Set-Cookie:  │
                        │                                         │ auth_token=  │
                        │                                         │ <JWT>;       │
                        │                                         │ HttpOnly;    │
                        │                                         │ SameSite=Lax│
                        │                                         └──────┬───────┘
                        │                                                │
                        ▼                                                ▼
                 ┌──────────────────────────────────────────────────────────┐
                 │ Response: 201 { user: { id, name, email, role } }       │
                 │ Browser: store user in AuthContext → redirect to "/"    │
                 └──────────────────────────────────────────────────────────┘
```

**Sequence:**
1. Browser sends `POST /api/auth/register` with `{ name, email, password, confirmPassword }`
2. Middleware: exact path match for `/api/auth/register` (AUTH-010) → skip auth, apply rate limiting
3. Route handler validates input with `registerSchema` (incl. common password blocklist — AUTH-005) → 400 if invalid
4. Service checks email uniqueness via Prisma:
   - **If email exists** → return `200 { "message": "If an account with this email exists, you can sign in at /login" }` — do NOT create session, do NOT reveal existence (AUTH-002)
   - **If email is new** → continue to step 5
5. Password hashed with `bcryptjs` (12 salt rounds, ~250ms)
6. User created in DB with `role = 'stakeholder'` (default)
7. JWT signed with `jose` (HS256, `JWT_SECRET`), payload: `{ sub: userId, email, role }`
8. `Set-Cookie: auth_token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
9. Response: `201 { user: { id, name, email, role } }`
10. Auth audit log: `register` event with email and IP (AUTH-007)
11. Browser AuthContext updates `user` state → redirect to `/`

### 5.2 User Login Flow

```
┌──────────────┐   POST /api/auth/login           ┌──────────────┐
│ Browser      │ ──────────────────────────────→  │ Next.js API  │
│ (returning)  │  { email, password }              │ /auth/login  │
└──────────────┘                                  └──────┬───────┘
                                                         │
                        ┌────────────────────────────────┼──────────────────┐
                        │                                │                  │
                        ▼                                ▼                  ▼
                 ┌─────────────┐              ┌──────────────┐     ┌──────────────┐
                 │ Zod         │              │ Prisma       │     │ bcrypt       │
                 │ Validation  │              │ findUnique   │     │ compare()    │
                 └──────┬──────┘              │ ({email})    │     └──────┬───────┘
                        │                     └──────┬───────┘            │
                   (reject if                  (null → 401            (mismatch →
                    invalid)                   "Invalid               401 "Invalid
                        │                      email or                email or
                        │                      password")              password")
                        │                           │                     │
                        │                           ▼                     ▼
                        │                    ┌──────────────────────────────┐
                        │                    │ JWT sign (jose, HS256)       │
                        │                    │ payload: {sub, email, role}  │
                        │                    └──────────────┬───────────────┘
                        │                                   ▼
                        │                            ┌──────────────┐
                        │                            │ Set-Cookie:  │
                        │                            │ auth_token   │
                        │                            └──────┬───────┘
                        │                                   ▼
                        ▼
                 ┌──────────────────────────────────────────────────────────┐
                 │ Response: 200 { user: { id, name, email, role } }       │
                 │ Browser: store user in AuthContext → redirect to "/"    │
                 └──────────────────────────────────────────────────────────┘
```

**Sequence:**
1. Browser sends `POST /api/auth/login` with `{ email, password }`
2. Middleware skips auth check for `/api/auth/*` routes
3. Route handler validates input with `loginSchema` → 400 if invalid
4. Prisma `findUnique({ where: { email } })` → if null, return 401 "Invalid email or password"
5. `bcryptjs.compare(password, user.passwordHash)` → if false, return 401 "Invalid email or password"
6. JWT signed with payload `{ sub: user.id, email: user.email, role: user.role }`
7. Cookie set (same config as registration)
8. Response: `200 { user: { id, name, email, role } }`
9. Browser AuthContext updates → redirect to `/`

### 5.3 Authenticated Request Flow (Middleware)

```
┌──────────────┐   Any request                    ┌──────────────────────────────────────┐
│ Browser or   │ ──────────────────────────────→  │ Next.js Middleware                    │
│ AI Agent     │  Headers: X-API-Key (optional)   │                                      │
│              │  Cookie: auth_token (optional)    │                                      │
└──────────────┘                                  └──────────────┬───────────────────────┘
                                                                 │
                                    ┌────────────────────────────┼───────────────────────────┐
                                    │                            │                           │
                                    ▼                            ▼                           ▼
                             ┌─────────────┐            ┌──────────────┐           ┌──────────────┐
                             │ API Key     │            │ JWT Cookie   │           │ Neither      │
                             │ present?    │            │ present?     │           │              │
                             └──────┬──────┘            └──────┬───────┘           └──────┬───────┘
                                    │                          │                          │
                              valid →                   valid →                    API route →
                              Agent identity            Extract role               401 Unauthorized
                              (full access)             from JWT                   Page route →
                                    │                          │                   redirect /login
                                    │                    Write op?
                                    │                     │         │
                                    │                    Yes        No
                                    │                     │         │
                                    │                role=admin?  Allow
                                    │                 │       │
                                    │                Yes      No (stakeholder)
                                    │                 │       │
                                    │               Allow   403 Forbidden
                                    │                 │       │
                                    ▼                 ▼       ▼
                             ┌─────────────────────────────────────────┐
                             │ Route Handler (with x-user-* headers)   │
                             │ OR Page Component (with auth context)   │
                             └─────────────────────────────────────────┘
```

**Middleware Decision Logic (Updated for Phase 1 audit findings):**

1. **CORS preflight** (`OPTIONS`) → 204 (pass through)
2. **SSE endpoint** (`/api/events`) → **requires auth** (AUTH-001): check API Key OR JWT cookie → 401 if neither valid
3. **Public auth routes** (AUTH-010: exact `Set` match, NOT prefix):
   - `PUBLIC_AUTH_ROUTES = new Set(['/api/auth/login', '/api/auth/register'])`
   - Skip auth check, apply rate limiting
4. **Admin-only routes** (AUTH-006): `ADMIN_ONLY_ROUTES = new Set(['/api/users'])` → reject with 403 if role !== 'admin'
5. **Page routes** (`/login`, `/register`) → if JWT valid, redirect to `/`; else pass through
6. **All other routes**:
   a. Check `X-API-Key` header: if valid → agent identity → full access → proceed
   b. Check `auth_token` cookie: if valid JWT → extract `{ sub, email, role }`:
      - For API routes: check role permissions (stakeholder → 403 on write ops)
      - For page routes: proceed (render page, auth context handles UI-level restrictions)
   c. Neither valid:
      - API route → 401 `{ error: { code: "UNAUTHORIZED" } }`
      - Page route → redirect to `/login`

### 5.4 Logout Flow

```
┌──────────────┐   POST /api/auth/logout          ┌──────────────┐
│ Browser      │ ──────────────────────────────→  │ Next.js API  │
│              │  Cookie: auth_token=<JWT>         │ /auth/logout │
└──────────────┘                                  └──────┬───────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │ Set-Cookie:  │
                                                  │ auth_token=; │
                                                  │ Max-Age=0;   │
                                                  │ Path=/       │
                                                  └──────┬───────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │ Response:    │
                                                  │ 200 {success}│
                                                  └──────┬───────┘
                                                         │
                                                         ▼
                                                  ┌──────────────┐
                                                  │ Browser:     │
                                                  │ AuthContext  │
                                                  │ user=null    │
                                                  │ → redirect   │
                                                  │   to /login  │
                                                  └──────────────┘
```

**Sequence:**
1. Browser sends `POST /api/auth/logout` (cookie automatically sent by browser)
2. Route handler clears cookie: `Set-Cookie: auth_token=; Max-Age=0; Path=/`
3. Response: `200 { success: true }`
4. Browser AuthContext clears `user` state
5. `useEffect` detects `user === null` → `router.push('/login')`

### 5.5 Session Restoration Flow (Page Load)

```
┌──────────────┐   GET /                          ┌────────────────────┐
│ Browser      │ ──────────────────────────────→  │ Next.js Middleware │
│ (page load)  │  Cookie: auth_token (if exists)  │                    │
└──────────────┘                                  └──────────┬─────────┘
                                                             │
                                                     JWT valid?
                                                      │         │
                                                     Yes        No
                                                      │         │
                                                 Pass through   redirect /login
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │ Page renders │
                                              │ AuthProvider │
                                              │ mounts       │
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ GET /api/    │
                                              │ auth/me      │
                                              │ (cookie auto)│
                                              └──────┬───────┘
                                                     │
                                              JWT valid?
                                               │         │
                                              Yes        No
                                               │         │
                                          {user}     401 → user=null
                                               │         │
                                               ▼         ▼
                                        ┌────────────────────────┐
                                        │ AuthContext:           │
                                        │ user = { id, name,     │
                                        │   email, role }        │
                                        │ isLoading = false      │
                                        │ isAuthenticated = true │
                                        └────────────────────────┘
```

**Sequence:**
1. Browser navigates to `/` (or any page)
2. Middleware checks JWT cookie → if invalid/missing → redirect to `/login`
3. If valid → middleware passes request through
4. Page renders with `AuthProvider`
5. `AuthProvider` calls `GET /api/auth/me` on mount (cookie sent automatically)
6. `/api/auth/me` verifies JWT → returns `{ user }` or 401
7. AuthContext sets `user` state, `isLoading = false`
8. Page components use `useAuth()` to conditionally render UI

---

## 6. Data Lifecycle

| Phase | Action |
|---|---|
| **Register** | Browser → POST /api/auth/register → bcrypt hash → Prisma INSERT → JWT sign → cookie set → redirect |
| **Login** | Browser → POST /api/auth/login → bcrypt verify → JWT sign → cookie set → redirect |
| **Session restore** | Browser → page load → middleware JWT check → /api/auth/me → AuthContext populate |
| **Logout** | Browser → POST /api/auth/logout → cookie clear → AuthContext clear → redirect to /login |
| **Create** | Agent/Admin → POST /api/tasks → Prisma INSERT → EventBus emit → SSE broadcast |
| **Read** | Browser → GET /api/projects/:id/tasks → Prisma SELECT → JSON response |
| **Update** | Agent/Admin → PUT /api/tasks/:id → Prisma UPDATE → EventBus emit → SSE broadcast |
| **Delete** | Agent/Admin → DELETE /api/tasks/:id → Prisma DELETE → EventBus emit → SSE broadcast |
| **Cascade** | DELETE project → Prisma CASCADE → all tasks/subprojects deleted |
