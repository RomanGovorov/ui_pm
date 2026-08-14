# Component Specifications — Project Manager UI v1

**Version:** 1.3
**Author:** architecture-planner
**Date:** 2026-08-13
**Updated:** 2026-08-14 — Integrated TSK-018 Phase 1 audits: SSE auth, registration anti-enumeration, JWT startup validation, admin routes, audit logging, password blocklist, FOUC prevention, role-based ARIA

---

## 1. Application Structure

```
project-manager-ui/
├── app/
│   ├── layout.tsx                    # Root layout (providers, fonts, AuthProvider)
│   ├── page.tsx                      # Dashboard page (auth-gated, redirects to /login)
│   ├── login/
│   │   └── page.tsx                  # Login page (email + password form)
│   ├── register/
│   │   └── page.tsx                  # Registration page (email + password + confirm)
│   ├── globals.css                   # Tailwind + custom theme vars
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/
│   │   │   │   └── route.ts          # POST (register new user)
│   │   │   ├── login/
│   │   │   │   └── route.ts          # POST (login, set JWT cookie)
│   │   │   ├── logout/
│   │   │   │   └── route.ts          # POST (clear cookie)
│   │   │   └── me/
│   │   │       └── route.ts          # GET (current user from JWT)
│   │   ├── projects/
│   │   │   ├── route.ts              # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET, PUT, DELETE
│   │   │       └── tasks/
│   │   │           └── route.ts      # GET (list project tasks)
│   │   ├── tasks/
│   │   │   ├── route.ts              # GET (list all, filter), POST (create)
│   │   │   └── [id]/
│   │   │       └── route.ts          # GET, PUT, DELETE
│   │   ├── users/
│   │   │   └── route.ts              # GET (list), POST (create)
│   │   └── events/
│   │       └── route.ts              # GET (SSE stream)
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx           # Project navigation + theme toggle
│       │   ├── Header.tsx            # Project info + stats + online status
│       │   └── AppShell.tsx          # Overall layout wrapper
│       ├── auth/
│       │   └── AuthLoadingState.tsx  # Auth loading spinner (FOUC prevention — CRIT-001, MED-005)
│       ├── kanban/
│       │   ├── KanbanBoard.tsx       # 3-column board container
│       │   ├── KanbanColumn.tsx      # Single column (In Work / Review / Done)
│       │   └── TaskCard.tsx          # Task card component
│       ├── modals/
│       │   ├── CreateTaskModal.tsx   # Task creation form
│       │   ├── CreateProjectModal.tsx# Project creation form
│       │   └── ModalWrapper.tsx      # Shared modal shell
│       └── ui/                       # shadcn/ui components
│           ├── button.tsx
│           ├── card.tsx
│           ├── dialog.tsx
│           ├── input.tsx
│           ├── select.tsx
│           ├── badge.tsx
│           └── ...
├── lib/
│   ├── db/
│   │   ├── client.ts                 # Prisma client singleton
│   │   └── seed.ts                   # Seed script for demo data
│   ├── services/
│   │   ├── project-service.ts        # Project CRUD + validation
│   │   ├── task-service.ts           # Task CRUD + validation + event emit
│   │   └── user-service.ts           # User CRUD + findByEmail
│   ├── events/
│   │   └── event-bus.ts              # EventEmitter-based pub/sub (with connection limits)
│   ├── auth.ts                       # API key validation (timing-safe, dual-key support)
│   ├── auth/
│   │   ├── session.ts               # JWT sign/verify (jose), cookie helpers, getCurrentUser(), JWT_SECRET validation (AUTH-003)
│   │   └── audit-log.ts            # Auth event structured logging (AUTH-007)
│   ├── rate-limiter.ts              # Sliding window rate limiter (SEC-PHASE1-002)
│   ├── errors.ts                    # Error sanitization (SEC-PHASE1-009)
│   ├── validators/
│   │   ├── project.ts                # Zod schemas for project
│   │   ├── task.ts                   # Zod schemas for task
│   │   ├── user.ts                   # Zod schemas for user (updated: admin role)
│   │   └── auth.ts                  # Zod schemas for login/register (TSK-018)
│   ├── hooks/
│   │   ├── use-sse.ts                # SSE connection hook
│   │   ├── use-projects.ts           # Projects data hook
│   │   ├── use-tasks.ts              # Tasks data hook
│   │   ├── use-theme.ts              # Theme management hook
│   │   ├── use-focus-trap.ts        # Modal focus trap (UI-PHASE1-006)
│   │   └── use-toast.ts             # Toast notification hook (UI-PHASE1-004)
│   ├── context/
│   │   ├── app-context.tsx           # Global state provider
│   │   └── auth-context.tsx          # Auth state provider (user, role, login/logout/register)
│   └── types/
│       └── index.ts                  # Shared TypeScript types (updated: AuthUser, admin role)
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── migrations/                   # Migration files
│   └── seed.ts                       # Seed data
├── middleware.ts                      # Next.js middleware (auth)
├── next.config.ts                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind configuration
├── tsconfig.json                      # TypeScript configuration
├── package.json
├── Dockerfile                         # Multi-stage build
├── docker-compose.yml                 # App + PostgreSQL
└── .env.example                       # Environment variables template
```

---

## 2. Frontend Components

### 2.1 AppShell (Layout)

**Type:** Client Component
**Responsibility:** Overall page layout with sidebar and main content area.

**Props:**
```typescript
interface AppShellProps {
  children: React.ReactNode;
}
```

**Behavior:**
- Renders flex layout: fixed-width sidebar (256px) + fluid main area
- Applies theme class to root element
- Wraps children in `AppProvider` context

### 2.2 Sidebar

**Type:** Client Component
**Responsibility:** Project navigation, create project button, theme toggle.

**State Dependencies:**
- `projects[]` — list of all projects
- `currentProjectId` — active project
- `theme` — current theme (dark/light)

**Interactions:**
| Action | Handler |
|---|---|
| Click project | `setCurrentProjectId(id)` |
| Click "Create project" | Open `CreateProjectModal` |
| Click theme toggle | `toggleTheme()` |

**Visual Spec:**
- Width: 256px (w-64)
- Sections: Logo/brand (top), Projects list (scrollable), Actions (bottom, fixed)
- Active project: blue highlight with border
- Inactive projects: gray text, hover highlight

### 2.3 Header

**Type:** Client Component
**Responsibility:** Current project info, task statistics, online indicator, create task button.

**State Dependencies:**
- `currentProject` — selected project details
- `tasks[]` — for computing column counts
- `isOnline` — SSE connection status
- `subprojects[]` — optional subproject selector

**Visual Spec:**
- Height: ~64px
- Left: Project name + description + subproject selector
- Right: Task counts (blue/yellow/green dots), online status, "Create task" button

### 2.4 KanbanBoard

**Type:** Client Component
**Responsibility:** Container for 3 kanban columns, groups tasks by status.

**State Dependencies:**
- `tasks[]` — filtered by `currentProjectId`

**Data Processing:**
```typescript
const grouped = useMemo(() => ({
  in_work: tasks.filter(t => t.status === 'in_work'),
  review: tasks.filter(t => t.status === 'review'),
  done: tasks.filter(t => t.status === 'done'),
}), [tasks]);
```

**Visual Spec:**
- 3 columns, flex layout, equal width (min 280px, max 380px each)
- Horizontal scroll on overflow
- Gap: 20px between columns

### 2.5 KanbanColumn

**Type:** Client Component
**Responsibility:** Single status column with header and task cards.

**Props:**
```typescript
interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  color: string; // Header dot color
}
```

**Visual Spec:**
- Header: colored dot + title + count badge
- Body: scrollable card list with spacing
- Empty state: icon + "No tasks" text

### 2.6 TaskCard

**Type:** Client Component
**Responsibility:** Individual task card with priority, title, description, assignee, date.

**Props:**
```typescript
interface TaskCardProps {
  task: Task;
}
```

**Visual Spec:**
- Rounded card with border
- Priority badge (colored: red/yellow/green)
- Title (bold, 14px)
- Description (gray, truncated to 2 lines via `line-clamp-2`)
- Footer: assignee avatar (initials) + name + relative date

**Priority Colors:**
| Priority | Background | Text | Dot |
|---|---|---|---|
| High | red-900/30 (dark) / red-100 (light) | red-400 / red-700 | red-500 |
| Medium | yellow-900/30 / yellow-100 | yellow-400 / yellow-700 | yellow-500 |
| Low | green-900/30 / green-100 | green-400 / green-700 | green-500 |

### 2.7 ModalWrapper (NEW — UI-PHASE1-006, accessibility-critical)

**Type:** Client Component
**Responsibility:** Accessible modal shell with focus trap, ESC close, and screen reader support.

**Accessibility Requirements (CRITICAL — must implement):**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Focus trap (Tab/Shift+Tab cycles within modal only)
- ESC key closes modal
- Body scroll lock (`document.body.style.overflow = 'hidden'`)
- Root app `aria-hidden="true"` while modal open
- Focus returns to trigger element on close
- Backdrop click closes (with unsaved warning if form dirty)

**Hook:** `useFocusTrap(containerRef)` — manages focus cycling within modal

### 2.7.1 CreateTaskModal

**Type:** Client Component
**Responsibility:** Form for creating a new task. Wraps in `ModalWrapper`.

**Form Fields:**
| Field | Type | Required | Default |
|---|---|---|---|
| title | text | Yes | — |
| description | textarea | No | — |
| priority | select (high/medium/low) | No | medium |
| assignee | text | Yes | — |

**Behavior:**
1. On submit → `POST /api/tasks` with form data + `currentProjectId`
2. On success → optimistic add to local state, close modal, show toast
3. On error → rollback optimistic update, show error toast with retry

### 2.7.2 CreateProjectModal

**Type:** Client Component
**Responsibility:** Form for creating a new project. Wraps in `ModalWrapper`.

**Form Fields:**
| Field | Type | Required | Default |
|---|---|---|---|
| name | text | Yes | — |
| description | textarea | No | — |

**Behavior:**
1. On submit → `POST /api/projects` with form data
2. On success → add to projects list, switch to new project, close modal

### 2.8 Toast Notifications (NEW — UI-PHASE1-004, UI-PHASE1-008)

**Type:** Client Component
**Responsibility:** Non-blocking notifications for real-time events and action results.

**Properties:**
| Property | Value |
|---|---|
| Position | Bottom-right corner |
| Max visible | 3 (stacked) |
| Auto-dismiss | 5 seconds |
| Types | `info` (blue), `success` (green), `warning` (amber), `error` (red) |

**Triggers:**
- Task created via API → success toast
- Task updated via SSE → info toast
- API error → error toast with retry button
- SSE disconnect → warning banner (separate component)

**Accessibility:** Toasts rendered in `aria-live="polite"` region for screen reader announcements.

### 2.9 Skip-to-Content Link (NEW — UI-PHASE1-002)

**Type:** Client Component
**Responsibility:** Hidden link that becomes visible on focus, allowing keyboard users to skip navigation.

**Implementation:**
```html
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[9999]">
  Перейти к содержимому
</a>
```

---

## 3. Backend Components

### 3.1 API Route Handlers

Each route handler follows this pattern:

```typescript
// app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const tasks = await taskService.list({ status });
  return NextResponse.json({ data: tasks, total: tasks.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = taskService.createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: result.error.issues } },
      { status: 400 }
    );
  }
  const task = await taskService.create(result.data);
  return NextResponse.json(task, { status: 201 });
}
```

### 3.2 Service Layer

Each service encapsulates business logic:

```typescript
// lib/services/task-service.ts
export const taskService = {
  async list(filters: { projectId?: string; status?: string }) { ... },
  async getById(id: string) { ... },
  async create(data: CreateTaskInput) { ... },
  async update(id: string, data: UpdateTaskInput) { ... },
  async delete(id: string) { ... },
  
  // Zod schemas
  createSchema: z.object({ ... }),
  updateSchema: z.object({ ... }).partial(),
};
```

**Responsibilities:**
- Input validation (Zod)
- Database operations (Prisma)
- Event emission (after successful mutations)
- Error handling (not-found, constraint violations)

### 3.3 Event Bus (with Connection Limits — SEC-PHASE1-004)

```typescript
// lib/events/event-bus.ts
import { EventEmitter } from 'events';

type TaskEvent = {
  type: 'task_created' | 'task_updated' | 'task_deleted';
  payload: Task | { id: string };
};

class EventBus extends EventEmitter {
  private activeConnections = 0;
  private readonly MAX_CONNECTIONS = 50;
  private readonly MAX_PER_IP = 10;
  private ipConnections = new Map<string, number>();

  canAcceptConnection(clientIp: string): boolean {
    if (this.activeConnections >= this.MAX_CONNECTIONS) return false;
    const ipCount = this.ipConnections.get(clientIp) || 0;
    return ipCount < this.MAX_PER_IP;
  }

  registerConnection(clientIp: string): void {
    this.activeConnections++;
    this.ipConnections.set(clientIp, (this.ipConnections.get(clientIp) || 0) + 1);
  }

  unregisterConnection(clientIp: string): void {
    this.activeConnections--;
    const count = (this.ipConnections.get(clientIp) || 1) - 1;
    if (count <= 0) this.ipConnections.delete(clientIp);
    else this.ipConnections.set(clientIp, count);
  }

  emitTaskEvent(event: TaskEvent) {
    this.emit(event.type, event.payload);
  }

  emitProjectEvent(event: ProjectEvent) {
    this.emit(event.type, event.payload);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(100);
```

### 3.3.1 Rate Limiter (NEW — SEC-PHASE1-002)

```typescript
// lib/rate-limiter.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

// Rate limit constants
export const RATE_LIMITS = {
  global: { windowMs: 60_000, maxRequests: 100 },
  authFailure: { windowMs: 60_000, maxRequests: 10 },
  writeOps: { windowMs: 60_000, maxRequests: 60 },
} as const;
```

### 3.3.2 Error Handler (NEW — SEC-PHASE1-009)

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

export function handleApiError(error: unknown): { statusCode: number; body: object } {
  if (error instanceof ApiError) {
    return { statusCode: error.statusCode, body: { error: { code: error.code, message: error.message } } };
  }
  if (error instanceof z.ZodError) {
    return { statusCode: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.issues } } };
  }
  // Prisma errors — sanitize (never expose table names, query structure)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { statusCode: mapPrismaStatus(error.code), body: { error: { code: mapPrismaCode(error.code), message: sanitizePrismaMessage(error) } } };
  }
  console.error('Unhandled error:', error); // Log full details server-side only
  return { statusCode: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } } };
}
```

### 3.4 SSE Endpoint

```typescript
// app/api/events/route.ts
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial heartbeat
      controller.enqueue(encoder.encode(': heartbeat\n\n'));
      
      // Heartbeat interval (keep-alive)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30_000);
      
      const taskCreated = (data: Task) => sendEvent(controller, encoder, 'task_created', data);
      const taskUpdated = (data: Task) => sendEvent(controller, encoder, 'task_updated', data);
      const taskDeleted = (data: { id: string }) => sendEvent(controller, encoder, 'task_deleted', data);
      
      eventBus.on('task_created', taskCreated);
      eventBus.on('task_updated', taskUpdated);
      eventBus.on('task_deleted', taskDeleted);
      
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        eventBus.off('task_created', taskCreated);
        eventBus.off('task_updated', taskUpdated);
        eventBus.off('task_deleted', taskDeleted);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    }
  });
}
```

---

## 4. Shared Libraries

### 4.1 Prisma Client

```typescript
// lib/db/client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 4.2 Zod Validators

```typescript
// lib/validators/task.ts
import { z } from 'zod';

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  subprojectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assignee: z.string().min(1).max(100),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['in_work', 'review', 'done']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  assignee: z.string().min(1).max(100).optional(),
  subprojectId: z.string().uuid().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
```

---

## 5. Authentication Components (TSK-018)

### 5.1 Auth Session Module (`lib/auth/session.ts`)

**Responsibility:** JWT operations (sign/verify) using `jose` library, cookie management helpers, and user extraction for API route handlers.

**Exports:**

```typescript
// JWT operations (Edge Runtime compatible via jose)
interface TokenPayload {
  sub: string;       // User UUID
  email: string;
  role: 'admin' | 'stakeholder';
}

async function signToken(payload: TokenPayload): Promise<string>;
async function verifyToken(token: string): Promise<TokenPayload | null>;

// Cookie helpers
const AUTH_COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 604800; // 7 days in seconds

function setAuthCookie(response: NextResponse, token: string): void;
function clearAuthCookie(response: NextResponse): void;
function getAuthCookie(request: NextRequest): string | undefined;

// User extraction for route handlers
async function getCurrentUser(request: NextRequest): Promise<AuthUser | null>;
```

**JWT_SECRET Startup Validation (AUTH-003 — HIGH, must fix):**

The module MUST validate `JWT_SECRET` at module load time (fail-fast):

```typescript
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}
if (JWT_SECRET_RAW.length < 64) { // 32 bytes = 64 hex chars
  throw new Error('FATAL: JWT_SECRET must be at least 32 bytes (64 hex characters)');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);
```

This ensures the app fails fast at startup rather than crashing on the first auth request or (worst case) signing tokens with an empty/weak secret.

**Cookie Configuration:**

| Attribute | Production | Development |
|---|---|---|
| `httpOnly` | `true` | `true` |
| `secure` | `true` | `false` |
| `sameSite` | `lax` | `lax` |
| `path` | `/` | `/` |
| `maxAge` | `604800` | `604800` |

**Security Notes:**
- `jose` uses Web Crypto API (available in both Edge Runtime and Node.js 22)
- JWT_SECRET loaded from env, **validated at module load** (must be ≥32 bytes / 64 hex chars) — AUTH-003
- `verifyToken` returns `null` on any error (expired, invalid, tampered) — never throws

### 5.2 Auth Validators (`lib/validators/auth.ts`)

**Responsibility:** Zod schemas for authentication inputs, including common password blocklist.

```typescript
// AUTH-005 (MEDIUM): Block top common passwords to prevent trivially guessable passwords
const COMMON_PASSWORDS = new Set([
  'password', '12345678', 'password1', 'qwerty123', 'letmein12',
  'iloveyou', 'sunshine1', 'princess1', 'football1', 'welcome1',
  'shadow12', 'superman', 'michael1', 'charlie1', 'trustno1',
  // ... expand to ~100 entries from well-known breach lists
]);

const registerSchema = z.object({
  email: z.string().trim().email('Invalid email').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()), {
      message: 'This password is too common',
    }),
  confirmPassword: z.string(),
  name: z.string().trim().min(1, 'Name is required').max(100),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email').max(255),
  password: z.string().min(1, 'Password is required'),
});

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
```

### 5.3 Auth API Endpoints

#### POST `/api/auth/register`

**Input:** `{ email, password, confirmPassword, name }`
**Auth Required:** No (public endpoint)
**Rate Limit:** 10 requests/min/IP (auth failure limiter)

**Flow:**
1. Validate input with `registerSchema`
2. Check if email already exists → 409 Conflict
3. Hash password with bcryptjs (12 salt rounds)
4. Create user in DB (role defaults to `stakeholder`)
5. Sign JWT with user payload
6. Set httpOnly cookie on response
7. Return `{ user: { id, name, email, role } }` with status 201

**Errors:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input (Zod) |
| 429 | `RATE_LIMITED` | Too many registration attempts |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

**Anti-Enumeration Response (AUTH-002 — HIGH, must fix):**

When email already exists, return a **generic success-like response** instead of `409 EMAIL_EXISTS`:

```
If email exists:
  → Return 200 { "message": "If an account with this email exists, you can sign in at /login" }
  → Do NOT set a cookie or create a session
  → Do NOT reveal whether the email was already registered
```

This prevents email enumeration attacks. The slight UX degradation is acceptable for an internal tool where admin creates accounts.

#### POST `/api/auth/login`

**Input:** `{ email, password }`
**Auth Required:** No (public endpoint)
**Rate Limit:** 10 failed attempts/min/IP

**Flow:**
1. Validate input with `loginSchema`
2. Find user by email → 401 if not found (generic message: "Invalid email or password")
3. Verify password with bcryptjs compare → 401 if mismatch (same generic message)
4. Sign JWT with `{ sub: user.id, email: user.email, role: user.role }`
5. Set httpOnly cookie on response
6. Return `{ user: { id, name, email, role } }` with status 200

**Errors:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input (Zod) |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (generic) |
| 429 | `RATE_LIMITED` | Too many failed attempts |

#### POST `/api/auth/logout`

**Input:** None (uses cookie from request)
**Auth Required:** Optional (works even with expired/invalid token)

**Flow:**
1. Clear `auth_token` cookie (set maxAge=0)
2. Return `{ success: true }` with status 200

#### GET `/api/auth/me`

**Input:** None (reads JWT from cookie)
**Auth Required:** Yes (JWT cookie)

**Flow:**
1. Extract and verify JWT from cookie
2. If valid → return `{ user: { id, name, email, role } }` with status 200
3. If invalid/expired → return 401

**Errors:**

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No cookie, expired token, or invalid token |

### 5.4 Auth Context (`lib/context/auth-context.tsx`)

**Type:** Client Component (React Context Provider)
**Responsibility:** Manage authentication state across the application.

**Interface:**

```typescript
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'stakeholder';
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStakeholder: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

**Behavior:**
1. **On mount**: Call `GET /api/auth/me` to check for existing session → populate `user` state
2. **login()**: Call `POST /api/auth/login` → on success, update `user` state; on failure, throw error with message
3. **register()**: Call `POST /api/auth/register` → on success, update `user` state; on failure, throw error
4. **logout()**: Call `POST /api/auth/logout` → clear `user` state → redirect to `/login`
5. **isLoading**: `true` during initial `/api/auth/me` check (prevents flash of login page)

**Integration:**
- `AuthProvider` wraps all children in `app/layout.tsx` (outermost provider)
- Dashboard page checks `isAuthenticated` → redirect to `/login` if false
- Login/register pages check `isAuthenticated` → redirect to `/` if true

### 5.5 Login Page (`app/login/page.tsx`)

**Type:** Client Component
**Route:** `/login`

**Form Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| email | `email` input | Yes | Valid email format |
| password | `password` input | Yes | Non-empty |

**Visual Spec:**
- Centered card layout (max-width: 400px)
- Logo + "Sign in to your account" heading
- Form fields with labels
- "Sign in" button (full-width, blue)
- Error message display (red banner above form)
- Footer: "Don't have an account? Register" link to `/register`

**Behavior:**
1. On mount: if `isAuthenticated` → redirect to `/`
2. On submit: call `login(email, password)` from auth context
3. On success: redirect to `/` (or `searchParams.callbackUrl` if present)
4. On failure: display error message (from API response)
5. Loading state: disable form during submission

**Accessibility:**
- `aria-label` on form: "Login form"
- `aria-describedby` on error messages
- Focus management: auto-focus email field
- Keyboard: Enter key submits form

### 5.6 Register Page (`app/register/page.tsx`)

**Type:** Client Component
**Route:** `/register`

**Form Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| name | `text` input | Yes | 1-100 characters |
| email | `email` input | Yes | Valid email format |
| password | `password` input | Yes | ≥ 8 characters |
| confirmPassword | `password` input | Yes | Must match password |

**Visual Spec:**
- Same centered card layout as login page
- Logo + "Create your account" heading
- Form fields with labels
- Password strength hint (min 8 characters)
- "Create account" button (full-width, blue)
- Error message display (red banner above form, field-level errors)
- Footer: "Already have an account? Sign in" link to `/login`

**Behavior:**
1. On mount: if `isAuthenticated` → redirect to `/`
2. Client-side validation: password match, min length before submission
3. On submit: call `register(name, email, password, confirmPassword)` from auth context
4. On success: redirect to `/`
5. On failure: display error (409 = "Email already registered", etc.)
6. Loading state: disable form during submission

**Accessibility:**
- Same patterns as login page
- `aria-invalid` on fields with errors
- `aria-describedby` linking to field-level error text

### 5.7 Middleware Authentication Flow (Updated `middleware.ts`)

**Responsibility:** Gate all routes with authentication checks. Dual auth support (API key + JWT cookie).

**Matcher Update:**

```typescript
export const config = {
  matcher: [
    // Match all routes except static assets, Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Authentication Flow (text description):**

1. **CORS preflight** (`OPTIONS`) → respond 204 with CORS headers (unchanged)
2. **SSE endpoint** (`/api/events`) → **requires authentication** (AUTH-001 — HIGH, must fix):
   a. Check `X-API-Key` header → if valid → allow SSE (agent access)
   b. Check `auth_token` cookie → if valid JWT → allow SSE (browser user)
   c. Neither → reject with 401
   Note: `EventSource` browser API sends cookies automatically, so browser users authenticate via JWT cookie. API consumers use `fetch()` with `credentials: 'include'` or `X-API-Key` header.
3. **Public auth routes** (exact match only — AUTH-010 — MEDIUM): Use `Set` for explicit path matching, NOT prefix match:
   ```typescript
   const PUBLIC_AUTH_ROUTES = new Set(['/api/auth/login', '/api/auth/register']);
   if (PUBLIC_AUTH_ROUTES.has(pathname)) { /* skip auth, apply rate limit */ }
   ```
   This prevents future routes like `/api/auth/change-password` from being unintentionally public.
4. **Admin-only routes** (AUTH-006 — MEDIUM): `/api/users` requires `admin` role for ALL methods:
   ```typescript
   const ADMIN_ONLY_ROUTES = new Set(['/api/users']);
   if (ADMIN_ONLY_ROUTES.has(pathname) && role !== 'admin') {
     return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
   }
   ```
5. **Static assets and Next.js internals** → pass through (matched out by matcher pattern)
6. **All other routes** → authentication required:
   a. Check `X-API-Key` header → if valid → agent identity (full access) → proceed
   b. Check `auth_token` cookie → if valid JWT → extract user role → proceed with role check
   c. Neither valid → if API route: return 401; if page route: redirect to `/login`
7. **Role enforcement** (for JWT-authenticated users on API routes):
   a. Write operations (`POST`, `PUT`, `PATCH`, `DELETE`) → if role is `stakeholder` → return 403 Forbidden
   b. Read operations (`GET`) → all authenticated roles allowed
8. **Auth context propagation**: Set `x-user-id`, `x-user-role` request headers for downstream route handlers (internal only, not exposed to client)

**Page Route Handling:**
- `/login`, `/register` → if JWT valid → redirect to `/` (already authenticated)
- All other pages → if no valid auth → redirect to `/login`
- `/` (dashboard) → if authenticated → render; else → redirect to `/login`

### 5.8 Sidebar Auth Integration (Updated `Sidebar.tsx`)

**Changes from current implementation:**

| Element | Admin | Stakeholder |
|---|---|---|
| "+ New Project" button | Visible | Hidden |
| Project list | Visible | Visible |
| Theme toggle | Visible | Visible |
| User email display | Visible (bottom) | Visible (bottom) |
| Logout button | Visible | Visible |

**New Elements:**
- **User info section** (above theme toggle): displays logged-in user's email (truncated) and role badge
- **Logout button**: calls `logout()` from auth context → clears cookie → redirects to `/login`

### 5.9 Header Auth Integration (Updated `Header.tsx`)

**Changes from current implementation:**

| Element | Admin | Stakeholder |
|---|---|---|
| Project info | Visible | Visible |
| Task statistics | Visible | Visible |
| Connection indicator | Visible | Visible |
| "+ Create Task" button | Visible | Hidden |

### 5.10 Auth Rate Limiting (Updated — AUTH-008)

Auth-specific endpoints use the existing rate limiter. **Login only counts FAILED attempts** toward the rate limit bucket (AUTH-008 — MEDIUM fix):

| Endpoint | Rate Limit | Bucket Key | Counts |
|---|---|---|---|
| `POST /api/auth/login` | 10 failures/min/IP | `auth_fail:{ip}` | **Failures only** (success does not consume quota) |
| `POST /api/auth/register` | 10 req/min/IP | `auth_fail:{ip}` | All requests (prevent spam) |
| `GET /api/auth/me` | 100 req/min/IP | `global:{ip}` (general) | All requests |
| `POST /api/auth/logout` | 100 req/min/IP | `global:{ip}` (general) | All requests |

**Login rate limit implementation:**
```typescript
// In POST /api/auth/login route handler:
const result = await authenticateUser(email, password);
if (!result.success) {
  // Only count failures toward rate limit
  const authLimit = rateLimit(`auth_fail:${clientIp}`, RATE_LIMITS.authFailure);
  if (!authLimit.allowed) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }
  return NextResponse.json(
    { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
    { status: 401 }
  );
}
// Success — do NOT count toward rate limit
```

### 5.11 Auth Audit Logging (AUTH-007 — MEDIUM, new)

**Responsibility:** Structured logging for authentication events (server-side only).

```typescript
// lib/auth/audit-log.ts
export function logAuthEvent(event: {
  type: 'login_success' | 'login_failure' | 'register' | 'logout' | 'auth_error';
  email?: string;
  ip: string;
  userAgent?: string;
  reason?: string;
}): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    category: 'auth',
    ...event,
    // NEVER log: password, token, API key
  }));
}
```

**Minimum events to log:**
- `login_failure` with email and IP (detect brute-force patterns)
- `login_success` with email and IP (detect suspicious logins from new IPs)
- `register` with email and IP (detect spam registration)
- `auth_error` with reason (detect implementation bugs or attacks)

---

## 6. Non-Functional Specifications

| Aspect | Specification |
|---|---|
| TypeScript strict mode | Enabled (`"strict": true`) |
| ESLint | `@typescript-eslint` + Next.js config |
| Prettier | Standard config |
| Component testing | Vitest + React Testing Library |
| API testing | Vitest + supertest |
| CSS approach | Tailwind CSS v4 with dark/light classes |
| Theme default | Dark (`class="dark"` on `<html>`) |
| Font | System font stack or Inter via `next/font` |
| Accessibility | WCAG 2.1 AA (focus rings, ARIA labels, contrast) |
