# Project Manager UI

Real-time project management dashboard for stakeholders and AI agents. Provides a Jira-like kanban interface where an AI project-manager agent updates tasks via REST API, and stakeholders see changes instantly via SSE.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript (strict) | 5.x |
| UI | React + Tailwind CSS | 19 / 3.x |
| Database | PostgreSQL | 16.4 |
| ORM | Prisma | 7.x |
| Real-time | Server-Sent Events (SSE) | native |
| Validation | Zod | 3.x |
| Testing | Vitest + Testing Library | 3.x |
| Deployment | Docker Compose (multi-stage) | — |
| Node.js | Alpine | 22.x |

## Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed demo data
npm run db:studio        # Open Prisma Studio

# Testing
npm test                 # Run tests once
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Docker
docker-compose up -d     # Build and start all services
docker-compose down      # Stop all services
docker-compose logs -f   # Follow logs
```

## Project Structure

```
ui_pm/
├── src/
│   ├── app/
│   │   ├── api/              # REST API routes
│   │   │   ├── auth/         # Auth endpoints (register, login, logout, me)
│   │   │   ├── events/       # SSE endpoint
│   │   │   ├── health/       # Health check
│   │   │   ├── projects/     # Projects CRUD
│   │   │   ├── tasks/        # Tasks CRUD
│   │   │   └── users/        # Users CRUD
│   │   ├── components/       # React components (KanbanBoard, TaskCard, etc.)
│   │   ├── login/            # Login page
│   │   ├── register/         # Registration page
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Dashboard page
│   │   └── globals.css       # Tailwind + design tokens
│   ├── lib/
│   │   ├── auth/             # Auth module (session, password, audit-log)
│   │   ├── auth.ts           # API key validation (Edge-compatible)
│   │   ├── errors.ts         # Error sanitization (no Prisma internals leaked)
│   │   ├── rate-limiter.ts   # In-memory rate limiter
│   │   ├── db/client.ts      # Prisma client with PgAdapter
│   │   ├── events/event-bus.ts  # SSE event bus
│   │   ├── services/         # Business logic layer
│   │   ├── validators/       # Zod schemas (auth, task, project, user)
│   │   ├── hooks/            # React hooks (SSE, focus trap, etc.)
│   │   ├── context/          # App context providers (app-context, auth-context)
│   │   └── types/            # TypeScript types
│   ├── test/                 # Test setup
│   └── middleware.ts         # API middleware (CORS, rate limit, dual auth)
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Migration files
│   └── seed.ts               # Demo data seeder
├── docs/                     # Documentation (architecture, security, UI/UX, etc.)
├── tasks/                    # Task tracking (backlog, active, done)
├── scripts/                  # Operational scripts (health-check.sh)
├── Dockerfile                # Multi-stage build (deps → builder → runner)
├── docker-compose.yml        # App + PostgreSQL services
├── docker-entrypoint.sh      # Auto-migration on container start
├── prisma.config.ts          # Prisma 7 configuration
└── .env                      # Environment variables (not in git)
```

## Architecture Decisions

- **Prisma 7** with `prisma-client` generator (custom output path `prisma/generated/prisma`)
- **Driver adapter** (`@prisma/adapter-pg`) for PostgreSQL connection
- **Standalone output** (`output: 'standalone'` in next.config.ts) for Docker
- **Dual authentication** — JWT cookie (browser users) + API key (AI agents)
- **JWT via `jose`** — Edge-compatible, HS256, 7-day expiry, httpOnly cookie
- **Password hashing** — `bcryptjs` (pure JS, 12 salt rounds, Alpine-compatible)
- **Lazy JWT_SECRET validation** — fail-fast at runtime, not build time
- **Secure cookie detection** — `isSecureRequest()` checks localhost/HTTPS/proxy headers
- **Auto-migrations** via `docker-entrypoint.sh` running `prisma migrate deploy` on container start
- **SSE over WebSocket** — simpler, one-directional updates from server to client
- **In-memory rate limiter** — single-server deployment, no Redis needed for v1

## Data Model

```
Project (1) ──< Subproject (N)
Project (1) ──< Task (N)
Subproject (1) ──< Task (N)
User (standalone) — email/password for browser users, apiKey for agents
```

**Task statuses:** `in_work` → `review` → `done`
**Task priorities:** `high`, `medium`, `low`
**User roles:** `admin` (full access), `stakeholder` (read-only), `agent` (API key, full access)

## API Authentication

Dual authentication system:

| Method | User | Header/Cookie | Access |
|--------|------|---------------|--------|
| **JWT Cookie** | Browser users (admin, stakeholder) | `auth_token` httpOnly cookie | Role-based |
| **API Key** | AI agents | `X-API-Key` header | Full access |

### Browser Auth Flow
1. Register at `/register` (email + password) → role: `stakeholder`
2. Login at `/login` → JWT cookie set (7-day expiry)
3. Session restored via `/api/auth/me` on page load
4. Logout via `/api/auth/logout` → cookie cleared

### Role-Based Access
- **GET requests**: All authenticated users (SSE requires auth)
- **Write requests** (POST/PUT/DELETE): `admin` + `agent` only; `stakeholder` → 403
- **Admin-only routes**: `/api/users` POST, task/project mutations

### Security
- JWT: HS256, httpOnly, sameSite=lax, Secure on HTTPS
- Password: bcryptjs, 12 salt rounds
- Rate limiting: 100 req/min global, 10 auth failures/min
- Registration: generic response for duplicate emails (anti-enumeration)
- Cookie Secure flag auto-detected via `isSecureRequest()` (localhost = no Secure)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection (e.g., `postgresql://user:pass@db:5432/pm_db`) |
| `API_KEY` | Yes | Primary API key for AI agents (≥32 bytes hex) |
| `API_KEY_SECONDARY` | No | Secondary key for zero-downtime rotation |
| `JWT_SECRET` | Yes | JWT signing secret (≥64 hex chars, fail-fast if missing) |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Yes | PostgreSQL credentials (used by docker-compose) |
| `REGISTRATION_ENABLED` | No | Set to `false` to disable new user registration |

## Docker Notes

- PostgreSQL port 5432 is **not exposed** to host (internal network only)
- Data persisted via bind mount: `./data/postgres/` (excluded from git)
- Non-root user (`nextjs:1001`) in production container
- Prisma CLI installed in runner stage for auto-migrations
- `NODE_ENV=production` enforced via docker-compose `environment` (overrides `.env`)

## Testing

- Tests located in `src/lib/__tests__/` and `src/test/`
- Vitest with jsdom environment
- Path alias `@/` maps to `src/`
- Setup file: `src/test/setup.ts`
- **DELETE endpoint coverage**: 22 tests in `task-delete-api.test.ts` (static analysis + runtime)

## Language

All code, comments, and documentation must be in **English**.
