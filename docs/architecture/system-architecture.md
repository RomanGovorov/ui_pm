# System Architecture — Project Manager UI v1

**Version:** 1.3
**Author:** architecture-planner
**Date:** 2026-08-13
**Updated:** 2026-08-14 — Integrated TSK-018 Phase 1 audits: Security auth (17 findings), UI/UX auth (18 findings)
**Status:** All Phase 1 audits aggregated, ready for code-implementer
**Audit aggregation:** Initial: Security (10), UI/UX (8), Data (8) | TSK-018: Security auth (17), UI/UX auth (18)

---

## 1. Overview

Project Manager UI is a web application that provides a visual dashboard for stakeholders to monitor project state in real-time, and a REST API for the AI agent `project-manager` to manage tasks programmatically.

### 1.1 System Purpose

- **For stakeholders**: Kanban board dashboard showing tasks across projects with real-time updates
- **For AI agent**: REST API for CRUD operations on projects, tasks, and users
- **Real-time bridge**: Agent changes propagate to all connected browser clients instantly

### 1.2 Key Constraints

| Constraint | Value |
|---|---|
| Max tasks (v1) | ~100 tasks total |
| Max concurrent users | 5-10 stakeholders |
| Max projects | 5-10 |
| Auth model | JWT cookie for browser users (admin/stakeholder); API key for agent |
| Deployment | Single server (Docker Compose) |
| Mobile support | Not required (desktop only) |

---

## 2. Architecture Pattern

**Pattern: Full-Stack Monolith (Next.js App Router)**

A single Next.js application serving both the frontend (React Server Components + Client Components) and the backend (API Routes). PostgreSQL as the single data store.

### 2.1 Rationale

- PRD specifies Next.js + PostgreSQL + Prisma stack
- Single deployment unit — minimal DevOps overhead for v1
- Next.js API Routes eliminate the need for a separate backend service
- App Router enables Server Components for initial page load, Client Components for interactive UI
- Low complexity suits the ~100 task scale

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Browser (Admin / Stakeholder)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Next.js Client Components (React 19)           │    │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│  │  │ Sidebar  │ │ Header   │ │ KanbanBoard      │  │    │
│  │  │          │ │          │ │ ┌──────────────┐  │  │    │
│  │  │ Projects │ │ Stats    │ │ │ TaskCard ×N  │  │  │    │
│  │  │ Logout   │ │ Online/  │ │ │              │  │  │    │
│  │  │ Role     │ │ Offline  │ │ └──────────────┘  │  │    │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │    │
│  │         ↕ fetch()          ↕ EventSource (SSE)   │    │
│  │  ┌─────────────────────────────────────────────┐ │    │
│  │  │ AuthContext (JWT cookie, user, role)         │ │    │
│  │  │ /login  /register  pages                     │ │    │
│  │  └─────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS (Cookie: auth_token=JWT)
┌───────────────────▼─────────────────────────────────────┐
│               Next.js Server (Node.js)                   │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  Middleware (auth gate)                       │        │
│  │  - API Key check (agent)                     │        │
│  │  - JWT cookie check (browser user)           │        │
│  │  - Role enforcement (stakeholder → 403)      │        │
│  └──────────────────────┬───────────────────────┘        │
│                          │                                │
│  ┌──────────────────────▼───────────────────────┐        │
│  │  API Routes (/api/*)                         │        │
│  │  ┌────────┐ ┌──────────┐ ┌───────┐ ┌──────┐ │        │
│  │  │ /auth  │ │ /projects│ │ /tasks│ │/users│ │        │
│  │  │ login  │ │          │ │       │ │      │ │        │
│  │  │ reg    │ │          │ │       │ │      │ │        │
│  │  │ logout │ │          │ │       │ │      │ │        │
│  │  │ me     │ │          │ │       │ │      │ │        │
│  │  └───┬────┘ └────┬─────┘ └───┬───┘ └──┬───┘ │        │
│  └──────┼───────────┼───────────┼─────────┼────┘        │
│         │           │           │         │              │
│  ┌──────▼───────────▼───────────▼─────────▼─────┐        │
│  │  Service Layer (business logic)               │        │
│  │  - Auth: JWT sign/verify (jose), bcryptjs    │        │
│  │  - Validation (Zod)                          │        │
│  │  - Event emission on mutations               │        │
│  └────────────────────┬─────────────────────────┘        │
│                       │                                   │
│  ┌────────────────────▼─────────────────────────┐        │
│  │  SSE Event Broadcaster                       │        │
│  │  - In-memory PubSub (EventEmitter)           │        │
│  │  - /api/events endpoint (SSE stream)         │        │
│  └──────────────────────────────────────────────┘        │
│                       │                                   │
│  ┌────────────────────▼─────────────────────────┐        │
│  │  Prisma ORM                                  │        │
│  │  - Connection pool (pgbouncer or built-in)   │        │
│  └────────────────────┬─────────────────────────┘        │
└───────────────────────┼──────────────────────────────────┘
                        │ TCP 5432
┌───────────────────────▼──────────────────────────────────┐
│               PostgreSQL 16                               │
│  ┌──────────┐ ┌──────────────┐ ┌────────┐ ┌──────────┐  │
│  │ projects │ │ subprojects  │ │ tasks  │ │ users    │  │
│  │          │ │              │ │        │ │ + email  │  │
│  │          │ │              │ │        │ │ + pwHash │  │
│  └──────────┘ └──────────────┘ └────────┘ └──────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                AI Agent (project-manager)                 │
│  - HTTP client (fetch/axios)                             │
│  - X-API-Key header for auth                             │
│  - POST/PUT /api/tasks, /api/projects                    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 15+ | SSR + API Routes in one app; Server Components for perf |
| **UI Library** | React | 19.x | Required by Next.js; concurrent features |
| **Language** | TypeScript | 5.x | Type safety across stack |
| **Styling** | Tailwind CSS | 4.x | Utility-first; matches prototype; dark/light theming |
| **UI Components** | shadcn/ui | latest | Accessible, customizable components built on Radix |
| **ORM** | Prisma | 6.x | Type-safe DB access; migration management |
| **Database** | PostgreSQL | 16 | Relational; well-supported by Prisma |
| **Validation** | Zod | 3.x | Runtime validation for API inputs; integrates with TS |
| **Real-time** | Server-Sent Events (SSE) | native | Simpler than WebSocket for server→client push |
| **Browser Auth** | JWT (jose) + bcryptjs | jose 5.x, bcryptjs 2.x | JWT in httpOnly cookie, bcrypt password hashing (ADR-007) |
| **API Auth** | Static API Key (header) | — | Backward-compatible auth for agent (ADR-005) |
| **Deployment** | Docker Compose | — | Next.js + PostgreSQL in containers |

### 3.1 Why SSE over WebSocket (see ADR-002)

- Communication is **unidirectional**: server pushes updates to clients
- Agent writes via REST API; clients only receive updates
- SSE is natively supported by browsers (EventSource API)
- No need for bidirectional communication or custom protocol
- Simpler infrastructure (no WebSocket server, no upgrade handling)
- Automatic reconnection built into EventSource API

---

## 4. Component Overview

| Component | Responsibility | Location |
|---|---|---|
| **Next.js App** | Full-stack application (UI + API) | `app/` directory |
| **Auth Pages** | Login + Registration forms | `app/login/`, `app/register/` |
| **Auth API** | Register, login, logout, me endpoints | `app/api/auth/` |
| **Auth Context** | React context for auth state (user, role, login/logout) | `lib/context/auth-context.tsx` |
| **Auth Session** | JWT sign/verify (jose), cookie helpers | `lib/auth/session.ts` |
| **KanbanBoard** | 3-column board with task cards | `app/components/` |
| **Sidebar** | Project navigation + user info + logout + theme toggle | `app/components/` |
| **Header** | Project info + stats + connection status + role-gated actions | `app/components/` |
| **API Routes** | REST endpoints for CRUD | `app/api/` |
| **Service Layer** | Business logic + validation | `lib/services/` |
| **SSE Broadcaster** | Event emitter + SSE endpoint | `lib/events/` |
| **Middleware** | Auth gate (API key + JWT cookie + role enforcement) | `middleware.ts` |
| **Prisma Client** | Database access layer | `lib/db/` |

---

## 5. Data Model (High-Level)

```
Project (1) ────── (N) Subproject
   │                     │
   │                     │
   └────── (N) Task ─────┘
                │
                │ assignee → name string (not FK in v1)
                │
            User (optional, v1)
```

**Entities:**
- **Project**: id, name, description, timestamps
- **Subproject**: id, projectId (FK), name, description
- **Task**: id, projectId (FK), subprojectId (FK, nullable), title, description, status (enum), priority (enum), assignee, timestamps
- **User**: id, name, email (unique, nullable), passwordHash (nullable), role (enum), apiKey (nullable), createdAt

**Enums:**
- `TaskStatus`: `in_work`, `review`, `done`
- `TaskPriority`: `high`, `medium`, `low`
- `UserRole`: `admin`, `stakeholder`, `agent`

**User Model Notes (TSK-018):**
- `email`: nullable — agent users authenticate via API key, no email needed
- `passwordHash`: nullable — agent users have no password
- `admin` role: new, full CRUD access via browser
- Existing users (agent, stakeholder seed data) get NULL email/passwordHash — backward compatible

See `data-flow.md` and ADR-003 for detailed schema.

---

## 6. Security Architecture

### 6.1 Authentication (Updated for TSK-018)

| Actor | Auth Method | Scope |
|---|---|---|
| Admin (browser) | JWT in httpOnly cookie (7-day expiry) | Full CRUD via UI |
| Stakeholder (browser) | JWT in httpOnly cookie (7-day expiry) | Read-only dashboard (write → 403) |
| AI Agent | API Key in `X-API-Key` header | Full CRUD via REST API |

**Dual auth flow** (see ADR-007):
1. Middleware checks `X-API-Key` header first → if valid → agent identity → full access
2. Then checks `auth_token` cookie → if valid JWT → browser user → role-based access
3. Neither → 401 for API routes, redirect to `/login` for page routes

**JWT details:**
- Algorithm: HS256 via `jose` library (Edge Runtime compatible)
- Payload: `{ sub: userId, email, role }`
- Expiry: 7 days, no refresh tokens in v1
- Cookie: httpOnly, secure (prod), sameSite=lax, path=/

**Password security:**
- Hashing: bcryptjs (pure JS, no native deps), salt rounds = 12
- Storage: `passwordHash` column (nullable — agent users have no password)
- No plaintext ever stored or logged

### 6.2 Security Boundaries

- Middleware validates authentication on ALL routes (pages + API)
- API key auth for agent writes (backward compatible, unchanged)
- JWT cookie auth for browser users (admin/stakeholder)
- Role enforcement at middleware level: stakeholder write ops → 403
- **SSE endpoint requires authentication** (AUTH-001 — changed from open): API Key OR JWT cookie required; prevents unauthenticated users from monitoring real-time project activity
- **Admin-only routes**: `/api/users` requires `admin` role for ALL methods (AUTH-006)
- **Exact path matching** for public auth routes (AUTH-010): `Set` lookup prevents future routes from being unintentionally public
- **JWT_SECRET validated at startup** (AUTH-003): app fails fast if secret is missing or <64 hex chars
- PostgreSQL only accessible from Next.js container (internal Docker network)
- Auth pages (`/login`, `/register`) are public (no auth required)

### 6.3 Rate Limiting (v1 — promoted from v1.1 per SEC-PHASE1-002)

- Global: 100 req/min/IP on all API routes
- Auth failures: 10 failures/min/IP (then 429 with Retry-After)
- SSE connections: max 50 total, 10 per IP
- Implementation: in-memory sliding window (single-instance v1)

### 6.4 Security Headers & CORS

- Security headers configured via `next.config.ts` (X-Frame-Options, CSP, HSTS, etc.)
- CORS: specific origin only (never `*`), configurable via `CORS_ALLOWED_ORIGINS` env var
- See `docs/security/security-requirements.md` SR-05/SR-06 for full specification

### 6.5 Input Validation

- All API inputs validated with Zod schemas (`.safeParse()`, not `.parse()`)
- SQL injection prevented by Prisma (parameterized queries only, no `$queryRaw`)
- XSS mitigated by React's output encoding
- Error responses sanitized (no stack traces, no Prisma internals, generic error codes)

### 6.6 API Key Security (per SEC-PHASE1-001, CRITICAL)

- Key comparison MUST use `crypto.timingSafeEqual()` — never `===`
- Dual-key support (`API_KEY` + `API_KEY_SECONDARY`) for zero-downtime rotation
- Key never logged, never exposed in error messages or browser

See ADR-005 for API key auth design, ADR-007 for JWT browser auth design. Full requirements: `docs/security/security-requirements.md` (73-point checklist).

---

## 7. Deployment Architecture

```
docker-compose.yml
├── app (Next.js)
│   ├── Port 3000 (HTTP)
│   ├── Depends on: db
│   └── Environment: DATABASE_URL, API_KEY
└── db (PostgreSQL 16)
    ├── Port 5432 (internal only)
    └── Volume: pgdata
```

**Single-server deployment** via Docker Compose. Suitable for v1 scale (5-10 users, ~100 tasks).

---

## 8. Non-Functional Requirements

| Requirement | Target | Approach |
|---|---|---|
| Page load (LCP) | < 2s | Server Components + streaming SSR |
| API response time | < 200ms (p95) | Prisma connection pool, indexed queries |
| Real-time latency | < 500ms | SSE push after DB write |
| Availability | 99% (single server) | Docker restart policy |
| Data durability | No data loss | PostgreSQL WAL + daily backup |

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SSE connection limit per browser (6) | Cannot open many tabs | Acceptable for v1 (1-2 tabs per user) |
| Single server SPOF | Downtime | Docker restart; acceptable for v1 |
| In-memory EventEmitter | Events lost on restart | Acceptable — clients re-fetch on reconnect |
| JWT token not revocable (AUTH-004) | Demoted user retains role for 7 days | **v1 accepted risk**: Admin can rotate `JWT_SECRET` to invalidate all tokens. v2: `tokenVersion` field |
| No email verification | Anyone can register | Acceptable for internal tool; admin creates accounts |
| Open registration (AUTH-009) | Anyone on network can register + view data | **v1 accepted risk**: Network-level access control assumed. `REGISTRATION_ENABLED` env var available to disable |
| SSE resource leak (SEC-PHASE1-004) | Server crash via connection exhaustion | Mitigated: max 50 connections, 10/IP |
| Middleware bypass (SEC-PHASE1-010) | Unprotected write endpoints | Mitigated: default-deny matcher on all `/api/*` |
| SSE after login reconnect | SSE hook must reconnect after auth | `useSSE` must detect auth state change and re-establish connection |

---

## 10. Phase 1 Audit Results & Integration

All three Phase 1 audits completed. Findings integrated into architecture and implementation plan.

### 10.1 Security Audit Summary (10 findings)

| Severity | Count | Resolution |
|---|---|---|
| CRITICAL | 1 (timing attack) | Code-level: `crypto.timingSafeEqual` in `lib/auth.ts` |
| HIGH | 4 (rate limiting, headers, SSE leak, middleware bypass) | v1 implementation (rate limiting promoted from v1.1) |
| MEDIUM | 5 (open reads, key rotation, CORS, Docker, error disclosure) | 3 fixed in v1, 2 accepted as risks |

**Architecture change:** Rate limiting moved from v1.1 → v1 (§6.3). See `docs/security/findings/` for details.

### 10.2 UI/UX & Accessibility Audit Summary (8 findings)

| Severity | Count | Resolution |
|---|---|---|
| Critical | 2 (ARIA roles, modal focus trap) | Must-fix: block release until resolved |
| Serious | 4 (contrast, focus rings, color independence, card hierarchy) | Fix alongside implementation |
| Moderate | 2 (realtime feedback, loading states) | Plan for v1 |

**Architecture change:** Accessibility requirements (WCAG 2.1 AA) are mandatory for all UI components. See `docs/ui-ux/ui-spec.md` §7 and `docs/ui-ux/accessibility-report.md`.

### 10.3 Data Engineering Audit Summary (8 findings)

| Severity | Count | Resolution |
|---|---|---|
| High | 2 (task ordering, N+1 risk) | Resolved: ORDER BY priority+createdAt, single-query strategy |
| Medium | 3 (indexes, unique constraints, connection pool) | Schema changes applied in `data-models.md` |
| Low | 3 (updatedAt, user isolation, SSE payload) | 2 fixed, 1 accepted (v1 design) |

**Schema changes:** 4 additive changes to Prisma schema (see `docs/data/data-models.md`). No breaking changes.

### 10.4 TSK-018 Auth Security Audit (17 findings)

| Severity | Count | Resolution |
|---|---|---|
| HIGH | 3 (SSE auth, registration enumeration, JWT startup validation) | Architecture changes — MUST fix before implementation |
| MEDIUM | 8 (JWT role delay, password blocklist, admin routes, audit logging, rate limit fix, open registration, prefix match, .env.example) | 6 fixed during implementation, 2 accepted as v1 risks |
| LOW | 6 (JWT claims, cookie prefix, bcrypt limit, account lockout, CAPTCHA, .env.example) | Deferred to v2 |

**Architecture changes:** SSE requires auth (AUTH-001), registration anti-enumeration (AUTH-002), JWT_SECRET startup validation (AUTH-003). See `docs/security/findings/PHASE1-011_auth-security-audit.md`.

### 10.5 TSK-018 UI/UX Auth Audit (18 findings)

| Severity | Count | Resolution |
|---|---|---|
| Critical | 3 (FOUC prevention, skip-link documentation, role-based ARIA) | MUST fix — block release until resolved |
| High | 7 (error banner, password strength, confirm match, loading states, toasts, focus management, autofocus) | Fix during implementation |
| Medium | 5 (light theme, validation strategy, mobile responsive, logout button, loading state component) | Fix during implementation |
| Minor | 3 (language inconsistency, name field alignment, default role documentation) | Documentation cleanup |

**Architecture changes:** FOUC prevention gate in page.tsx (CRIT-001), auth pages responsive (MED-003), auth loading state component (MED-005). See `docs/ui-ux/findings/PHASE1-001_auth-ui-audit.md`.

**Consolidated brief:** `docs/architecture/auth-implementation-brief.md` — organized by priority for code-implementer.
