# Changelog

All notable changes to Project Manager UI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-08-13

### Initial Release

Welcome to the first release of Project Manager UI — a full-stack Kanban-based project management dashboard for stakeholders and AI agents, built with Next.js 15, PostgreSQL 16, Prisma, and Server-Sent Events.

### Features

#### Core Application

- **Kanban Board Dashboard**
  - Three-column layout: In Progress, In Review, Done
  - Drag-and-drop task cards between columns
  - Priority-based sorting (high → medium → low)
  - Subproject assignment support
  - Dark/Light theme toggle with localStorage persistence
  - Responsive sidebar navigation

- **Project Management**
  - Create, read, update, delete (CRUD) projects
  - Project descriptions up to 2000 characters
  - Associated subprojects display
  - Task count per project
  - Alphabetical ordering

- **Task Management**
  - Create tasks with title, description, priority, assignee
  - Three status states: `in_work`, `review`, `done`
  - Four priority levels: `high`, `medium`, `low`
  - Assign tasks to named users/agents
  - Filter by project and/or status
  - Priority-first, date-descending sort order

- **Real-Time Updates (SSE)**
  - Live event stream for all data changes
  - Six event types: task created/updated/deleted, project created/updated/deleted
  - Heartbeat keep-alive every 30 seconds
  - Connection limits: 50 total, 10 per IP
  - Optimized payloads (description stripped from SSE events)
  - Automatic cleanup on disconnect

- **User Management**
  - Two roles: `stakeholder`, `agent`
  - User listing without sensitive API key exposure
  - Optional API key provisioning for agent accounts

#### API Layer

- **8 REST API Endpoints** covering Projects, Tasks, Users, SSE Events, Health
- **Consistent error response format** with machine-readable codes
- **Zod schema validation** for all write operations
- **Pagination wrapper**: `{ data: [...], total: N }`
- **Cache-control headers**: `no-cache, no-store, must-revalidate` on all endpoints

#### Security

- **API Key Authentication**: Timing-safe comparison via SHA-256 + `timingSafeEqual`
- **Dual-key support**: Zero-downtime key rotation with primary + secondary keys
- **Rate Limiting**: Sliding window algorithm — global (100/min), write ops (60/min), auth failures (10/min)
- **CORS Protection**: Configurable allowed origins with `Vary: Origin` header (RFC 7231 compliant)
- **Prisma Error Sanitization**: Never exposes table/column names or query structure to clients
- **Non-root Docker container**: `nextjs` user with uid 1001
- **Database port isolation**: Port 5432 not exposed to host network

#### Infrastructure & DevOps

- **Multi-stage Docker build**: Dependencies → Build → Production runtime
- **GitHub Actions CI/CD pipeline**: Validate → Test → Build → Scan → Deploy
- **Automated deployment**: SSH deploy with health check loop (up to 60s)
- **Automatic rollback**: Reverts to cached image if health check fails after 60s
- **Container security**: Trivy scan for CRITICAL/HIGH vulnerabilities blocks pipeline
- **Resource limits**: CPU and memory caps for both app and database containers
- **Docker logging**: JSON-file driver with size/rotation limits
- **Image provenance**: OCI labels for source, revision, vendor, licenses
- **Health checks**: Both Docker-level and `/api/health` endpoint

#### Testing

- **Integration tests**: Full API flow (create → validate → verify → delete)
- **Service layer tests**: CRUD operations with mocked Prisma client
- **Validator tests**: Schema edge cases (empty strings, boundary values)
- **Auth tests**: API key validation paths, missing key, invalid key
- **Error handling tests**: Validation errors, empty updates, concurrent conflicts
- **Rate limiter tests**: Expiration, counting, threshold enforcement
- **Test coverage**: Unit + integration tests under `/app/src/lib/__tests__/`

#### Architecture

- **Next.js App Router** with server components and route handlers
- **Monorepo-style layout**: `app/` directory contains source code, configs, and infrastructure files
- **Prisma ORM** with type-safe queries
- **TypeScript strict mode** with ES modules
- **Tailwind CSS v3** + custom font (Inter) for typography
- **Component architecture**: Modals, Kanban board, layout shell, toast notifications

### Technical Details

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 15.x |
| Runtime | Node.js | 22.x |
| Database | PostgreSQL | 16.4 |
| ORM | Prisma | 6.x |
| Validation | Zod | 3.x |
| Styling | Tailwind CSS | 3.x |
| Testing | Vitest + Testing Library | 3.x / 16.x |
| Container | Docker (multi-stage) | Node 22 Alpine |
| CI/CD | GitHub Actions | v4 actions |
| Language | TypeScript | 5.x |
| Package Manager | npm | bundled with Node 22 |

### Configuration

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_NAME` | Database name | `pm_db` |
| `DB_USER` | Database user | `pm_user` |
| `DB_PASSWORD` | Database password | *(strong password)* |
| `API_KEY` | Master API key | *(32+ chars)* |
| `API_KEY_SECONDARY` | Secondary key (rotation) | *(optional)* |
| `CORS_ALLOWED_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:3000` |
| `APP_VERSION` | App version label | `1.0.0` |

### Deployment

**Local development:**
```bash
cd app && npm install && npm run dev
```

**Production (Docker):**
```bash
docker compose up -d
```

**CI/CD (auto-deploy on push to main):**
```
github.com/gansru/ui_pm
└── .github/workflows/deploy.yml
    ├── validate   (lint + typecheck)
    ├── test       (vitest suite)
    ├── build      (Next.js + trivy scan)
    ├── docker-push (build → push GHCR)
    └── deploy     (SSH → pull → health-check → verify)
```

### Known Limitations

- **Single-instance rate limiter**: In-memory store; multi-instance deployments need Redis-backed rate limiting
- **No pagination on lists**: All results returned in one page (`data[]` + `total`). Consider pagination for large datasets.
- **No SSE message queue**: Direct EventEmitter-based broadcasting; consider Redis Pub/Sub for horizontal scaling
- **No webhook support**: Changes only broadcast via SSE; no outbound notification webhooks
- **No task reordering within columns**: Sort is automatic (priority ASC, createdAt DESC); manual reorder not supported

---

## [1.1.0] — 2026-08-14

### Added — Authentication (TSK-018)

#### Features

- **Email/password authentication for browser users**
  - Registration page (`/register`) with name, email, password fields
  - Login page (`/login`) with email + password form
  - JWT stored in httpOnly cookie (`auth_token`) with 7-day expiry
  - Automatic session detection on dashboard load
  - Logout functionality via sidebar button or API
- **Role-based access control** (3 roles)
  - `admin` — full read/write access, user management
  - `stakeholder` — read-only dashboard access (no write operations)
  - `agent` — unchanged API key auth, full access (API only)
- **Anti-enumeration registration** — duplicate emails return generic success message instead of error
- **SSE endpoint authentication** — `/api/events` now requires `X-API-Key` or valid `auth_token` cookie
- **Common password blocklist** (~100 entries from known breaches) — rejected during registration
- **Auth audit logging** — structured JSON logs for all auth events (login_success, login_failure, register, logout, errors)
- **Admin-only route protection** — `/api/users` restricted to admin/agent roles
- **`.env.example` template** — documents all variables including `JWT_SECRET` and `REGISTRATION_ENABLED`

#### Security

- JWT tokens signed with HS256 using `jose` library (Edge-compatible)
- Passwords hashed with bcryptjs (12 rounds, pure JS — Docker-safe)
- Cookie security: httpOnly, sameSite=lax, path=/, secure (production only)
- JWT_SECRET validated at module startup — fail-fast if missing or too short
- Login rate limiting counts only failed attempts (10/min/IP)
- CORS credentials enabled when origin matches allowed list
- Database queries fetch fresh user data on `/api/auth/me` so role changes are immediate

#### Infrastructure

- New Prisma migration adds `email` (nullable), `passwordHash` (nullable) to User model
- New UserRole enum value: `admin`
- Seed file creates admin + stakeholder demo accounts
- Added `jose`, `bcryptjs`, `@types/bcryptjs` npm dependencies
- Added 29 new tests across auth-session, auth-validators, and auth-password test files
- FOUC prevention gate in `page.tsx` — loading spinner before redirect decision
- Updated `middleware.ts` with dual auth resolution (API key → JWT fallback)

### Changed

- **SSE requires authentication** (breaking change) — unauthenticated GET requests to `/api/events` now receive `401 Unauthorized`
- **Read operations remain public** for backward compatibility — planned enforcement in v2
- Frontend UI adapts to user role: admin/agent see action buttons, stakeholders see read-only view

### Required Environment Variables (new)

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (min 64 hex chars / 32 bytes) | *(generated)* |
| `REGISTRATION_ENABLED` | Toggle open registration (`true`/`false`) | `"true"` |

## [1.2.0] — 2026-08-14

### Added — Task Editing & Status Selection (TSK-019)

#### Features

- **Status selection during task creation** (TSK-019)
  - CreateTaskModal includes a status dropdown: `in_work`, `review`, `done`
  - Default remains `in_work` for backward compatibility
  - Agents can create tasks directly in any status without a separate update request
- **Edit Task Modal** (TSK-019)
  - Pencil icon (✏️) on every task card, visible only to admin/agent roles
  - Pre-filled form with all fields: title, description, status, priority, assignee, project, subproject
  - Partial updates supported — only modified fields are sent to the server
  - Optimistic UI updates: changes apply immediately, SSE syncs across all clients
  - Rollback on validation failure or server error
- **PUT /api/tasks/{id} documentation enhancement**
  - All seven editable fields documented in OpenAPI spec and getting-started guide
  - Example requests added: single-field change, multi-field change, clearing description

#### Infrastructure Changes

- New component: `src/app/components/modals/EditTaskModal.tsx`
- Updated: `CreateTaskModal.tsx` (status dropdown), `TaskCard.tsx` (edit button), `KanbanBoard.tsx` (edit state)
- Service layer: `task-service.update()` filters `undefined` values for true partial updates

### Changed

- Getting Started guide expanded with Editing Tasks section, API examples, Troubleshooting entries
- Release notes index updated to include v1.2.0

### Breaking Changes

- None — fully additive release

---

## Upcoming (Planned)

These items are identified during initial review and planning:

| ID | Type | Description | Priority |
|----|------|-------------|----------|
| TSK-PAGINATION | Feature | Paginated list endpoints with cursor/token pagination | Medium |
| TSK-WEBHOOKS | Feature | Outbound webhooks for external integrations | Low |
| TSK-USERS-API | Feature | Full user CRUD including password management | Low |
| TSK-TOKEN-AUTH | Feature | JWT-based authentication alongside API keys | Medium |
| TSK-MEMBERSHIP | Feature | Project membership/permissions (team access control) | High |
| TSK-COMMENTS | Feature | Task comments and discussions | Medium |
| TSK-FILE-ATTACH | Feature | File attachments on tasks | Low |
| TSK-REDIS-RATELIMIT | Improvement | Redis-backed rate limiter for multi-instance deployments | Medium |
| TSK-HISTORY | Feature | Audit log of all changes | Medium |
| TSK-EXPORT | Feature | Export projects/tasks to CSV/JSON | Low |

---

[Unreleased]: Unreleased
[v1.2.0]: https://github.com/gansru/ui_pm/releases/tag/v1.2.0
[v1.1.0]: https://github.com/gansru/ui_pm/releases/tag/v1.1.0
[v1.0.0]: https://github.com/gansru/ui_pm/releases/tag/v1.0.0
