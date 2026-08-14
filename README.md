# Project Manager UI v1.2

Real-time project management dashboard for stakeholders and AI agents with email/password authentication and role-based access control.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **UI**: React 19, Tailwind CSS 3.x
- **Database**: PostgreSQL 16, Prisma ORM 7.x
- **Real-time**: Server-Sent Events (SSE)
- **Auth**: JWT cookies (browser) + API key (agents), bcryptjs
- **Validation**: Zod 3.x
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Open [http://localhost:3000](http://localhost:3000).

**Default admin account** (after seed): `admin@example.com` / `admin12345`

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env: set DATABASE_URL, API_KEY, and JWT_SECRET (≥64 hex chars)

# 3. Generate Prisma client
npm run db:generate

# 4. Start PostgreSQL (via Docker)
docker-compose up -d db

# 5. Run migrations
npm run db:migrate

# 6. Seed demo data (creates admin user + sample projects)
npm run db:seed

# 7. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First Login

1. Go to `/register` to create an account (role: stakeholder, read-only)
2. Or use the seeded admin: `admin@example.com` / `admin12345`
3. Admins can create/edit projects and tasks; stakeholders view only

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register (email + password) |
| POST | `/api/auth/login` | No | Login → JWT cookie |
| POST | `/api/auth/logout` | No | Logout → clear cookie |
| GET | `/api/auth/me` | Cookie | Current user session |
| GET | `/api/projects` | Cookie | List all projects |
| POST | `/api/projects` | Admin | Create project |
| GET | `/api/projects/:id` | Cookie | Get project details |
| PUT | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |
| GET | `/api/projects/:id/tasks` | Cookie | List project tasks |
| GET | `/api/tasks` | Cookie | List all tasks |
| POST | `/api/tasks` | Admin | Create task (with status) |
| GET | `/api/tasks/:id` | Cookie | Get task details |
| PUT | `/api/tasks/:id` | Admin | Update task (partial) |
| DELETE | `/api/tasks/:id` | Admin | Delete task |
| GET | `/api/users` | Cookie | List users |
| POST | `/api/users` | Admin | Create user |
| GET | `/api/events` | Cookie | SSE event stream |

### Authentication

The app uses **dual authentication**:

**Browser users** (admin/stakeholder) — JWT in httpOnly cookie:
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"MyPass99","confirmPassword":"MyPass99"}'

# Login (returns Set-Cookie header)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"MyPass99"}'

# Authenticated request (cookie sent automatically by browser)
curl http://localhost:3000/api/tasks -b "auth_token=<jwt>"
```

**AI agents** — API key in header:
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"projectId":"<uuid>","title":"New task","assignee":"Alice","priority":"high","status":"in_work"}'
```

### Roles & Permissions

| Role | View | Create/Edit | Delete |
|------|------|-------------|--------|
| `admin` | ✅ | ✅ | ✅ |
| `stakeholder` | ✅ | ❌ | ❌ |
| `agent` (API key) | ✅ | ✅ | ✅ |

**Password requirements**: min 8 chars, at least 1 letter, at least 1 digit.

### Real-time Events (SSE)

```bash
curl -N http://localhost:3000/api/events
```

Events: `task_created`, `task_updated`, `task_deleted`, `project_created`, `project_updated`, `project_deleted`

## Project Structure

```
ui_pm/
├── src/
│   ├── app/
│   │   ├── api/          # REST API routes (auth, projects, tasks, users, events)
│   │   ├── components/   # React components (KanbanBoard, TaskCard, EditTaskModal, etc.)
│   │   ├── login/        # Login page
│   │   ├── register/     # Registration page
│   │   ├── layout.tsx    # Root layout (AuthProvider)
│   │   ├── page.tsx      # Dashboard page (auth gate)
│   │   └── globals.css   # Tailwind + design tokens
│   ├── lib/
│   │   ├── auth/         # Auth module (session.ts, password.ts, audit-log.ts)
│   │   ├── auth.ts       # API key validation (timing-safe, Edge-compatible)
│   │   ├── errors.ts     # Error sanitization
│   │   ├── rate-limiter.ts # Rate limiting
│   │   ├── db/           # Prisma client
│   │   ├── services/     # Business logic
│   │   ├── events/       # SSE event bus
│   │   ├── validators/   # Zod schemas (auth, task, project, user)
│   │   ├── hooks/        # React hooks
│   │   ├── context/      # App + Auth context providers
│   │   └── types/        # TypeScript types
│   └── middleware.ts     # API middleware (CORS, rate limit, dual auth)
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Migration files
│   └── seed.ts           # Demo data (admin user + projects)
├── docs/                 # Documentation
├── tasks/                # Task tracking
├── scripts/              # Operational scripts
├── Dockerfile            # Multi-stage build
├── docker-compose.yml    # App + PostgreSQL
├── docker-entrypoint.sh  # Auto-migration on startup
└── .env                  # Environment variables (not in git)
```

## Security

- **Dual auth**: JWT httpOnly cookie (browser) + API key (agents)
- **Password hashing**: bcryptjs, 12 salt rounds
- **JWT**: HS256, 7-day expiry, httpOnly + sameSite=lax
- **Secure cookie**: Auto-detected (localhost = no Secure flag, HTTPS = Secure)
- **Anti-enumeration**: Generic response for duplicate emails on registration
- **Rate limiting**: 100 req/min global, 10 auth failures/min
- **Role enforcement**: Middleware-level (stakeholder → 403 on writes)
- API key comparison uses timing-safe comparison (Edge-compatible)
- Security headers via `next.config.ts`
- SSE requires authentication
- CORS: specific origins only
- Error responses sanitized (no Prisma internals leaked)
- Docker: non-root user, multi-stage build
- PostgreSQL port not exposed to host (internal network only)

## Testing

- **Test framework**: Vitest with jsdom environment
- **Test location**: `src/lib/__tests__/` and `src/test/`
- **Coverage**: DELETE `/api/tasks/:id` endpoint fully covered (22 tests)
  - Static analysis of route handler structure
  - UUID validation (Zod schemas)
  - Prisma error mapping (P2025 → 404)
  - SSE event emission (`task_deleted`)
  - Middleware authentication (dual auth: JWT + API key)
- **Run tests**: `npm test` or `npm run test:watch`
- **Path alias**: `@/` maps to `src/`

## Accessibility

- WCAG 2.1 AA compliant
- ARIA landmarks and labels on all components
- Focus trap in modals
- Global focus-visible rings
- Skip-to-content link
- Color contrast ≥ 4.5:1 (dark and light themes)
- Screen reader announcements for real-time updates

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEY` | Yes | Primary API key for AI agents (≥32 bytes hex) |
| `API_KEY_SECONDARY` | No | Secondary key for rotation |
| `JWT_SECRET` | Yes | JWT signing secret (≥64 hex chars) |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins |
| `DB_NAME` | Yes | Database name (for docker-compose) |
| `DB_USER` | Yes | Database user (for docker-compose) |
| `DB_PASSWORD` | Yes | Database password (for docker-compose) |
| `REGISTRATION_ENABLED` | No | Set `false` to disable registration |
| `NODE_ENV` | No | `development` or `production` |

## Docker Notes

- **Auto-migrations**: Database migrations run automatically on container startup via `docker-entrypoint.sh`
- **Data persistence**: PostgreSQL data stored in `./data/postgres/` (bind mount, excluded from git)
- **Security**: PostgreSQL port 5432 not exposed to host, accessible only via internal Docker network
- **Non-root**: Production container runs as non-root user (`nextjs:1001`)

## License

Internal project — not for distribution.
