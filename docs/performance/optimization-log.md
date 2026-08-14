# Optimization Log — Project Manager UI v1

**Version:** 1.0
**Author:** performance-analyst
**Date:** 2026-08-13
**Note:** Append-only — add new entries, never remove.

---

## Identified Optimizations (v1 Initial Analysis)

### PERF-OPT-001: Single-pass KanbanBoard grouping

**Priority:** P1 (quick win, high impact on re-render cost)
**Finding:** PERF-FE-002
**Location:** `app/src/app/components/kanban/KanbanBoard.tsx`
**Status:** ✅ Applied (2026-08-13, code-implementer, T51_3+T52_3 fix cycle)

**Before:**
```tsx
const grouped = useMemo(() => {
  const filtered = currentProjectId
    ? tasks.filter((t) => t.projectId === currentProjectId)
    : tasks;
  return {
    in_work: filtered.filter((t) => t.status === 'in_work'),
    review: filtered.filter((t) => t.status === 'review'),
    done: filtered.filter((t) => t.status === 'done'),
  };
}, [tasks, currentProjectId]);
```
**Iterations:** 4× array passes (1 filter + 3 filter) = 4n iterations

**After (proposed):**
```tsx
const grouped = useMemo(() => {
  const result: Record<TaskStatus, Task[]> = { in_work: [], review: [], done: [] };
  const filtered = currentProjectId
    ? tasks.filter((t) => t.projectId === currentProjectId)
    : tasks;
  for (const task of filtered) {
    result[task.status].push(task);
  }
  return result;
}, [tasks, currentProjectId]);
```
**Iterations:** 2× array passes (1 filter + 1 reduce) = 2n iterations

**Expected improvement:** 50% fewer array iterations. For 100 tasks: 400 → 200 iterations per render.

---

### PERF-OPT-002: Memoize TaskCard pure functions

**Priority:** P2 (medium impact, easy fix)
**Finding:** PERF-FE-003
**Location:** `app/src/app/components/kanban/TaskCard.tsx`
**Status:** ✅ Applied (2026-08-13, code-implementer, T51_3+T52_3 fix cycle)

**Before:**
```tsx
// Called on every render for every card
const avatarColor = getAvatarColor(task.assignee);
const relativeDate = formatRelativeDate(task.createdAt);
```

**After (proposed):**
```tsx
import { useMemo } from 'react';

// Inside TaskCard component:
const avatarColor = useMemo(() => getAvatarColor(task.assignee), [task.assignee]);
const relativeDate = useMemo(() => formatRelativeDate(task.createdAt), [task.createdAt]);
```

**Expected improvement:** Eliminates ~600 function calls per render (100 tasks × 2 functions × 3 re-renders from SSE events). For 100 tasks, saves ~0.5ms per render.

---

### PERF-OPT-003: Add explicit Cache-Control headers

**Priority:** P2 (correctness + predictability)
**Finding:** PERF-API-002
**Location:** All GET route handlers
**Status:** ✅ Applied (2026-08-13, code-implementer, T51_3+T52_3 fix cycle)

**Before:** No explicit caching headers on API responses.

**After (proposed):**
```typescript
// In GET route handlers:
return NextResponse.json({ data: tasks, total: tasks.length }, {
  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
});
```

**Expected improvement:** Explicit caching strategy prevents intermediate proxy caching. No performance change — correctness improvement.

---

### PERF-OPT-004: Add composite index for task ordering

**Priority:** P3 (deferred — no impact at v1 scale)
**Finding:** PERF-DB-001
**Location:** `prisma/schema.prisma`
**Status:** 📋 Identified

**Before:**
```prisma
@@index([projectId, status])
@@index([status])
@@index([assignee])
```

**After (proposed for v1.1):**
```prisma
@@index([projectId, status])
@@index([projectId, priority, createdAt])  // Covering index for ORDER BY
@@index([status])
@@index([assignee])
```

**Expected improvement:** Eliminates filesort for `ORDER BY priority ASC, created_at DESC` queries. At 100 tasks: negligible. At 1000+ tasks: ~30% query time reduction.

---

### PERF-OPT-005: Add query timeout to DATABASE_URL

**Priority:** P3 (deferred — future safety)
**Finding:** PERF-DB-002
**Location:** `.env` / `DATABASE_URL`
**Status:** 📋 Identified

**Before:**
```
DATABASE_URL="postgresql://pm_user:pm_password@db:5432/pm_ui?connection_limit=10"
```

**After (proposed for v1.1):**
```
DATABASE_URL="postgresql://pm_user:pm_password@db:5432/pm_ui?connection_limit=10&connect_timeout=5&socket_timeout=10"
```

**Expected improvement:** Prevents connection starvation from slow or hung queries. No performance change — reliability improvement.

---

### PERF-OPT-006: Shared heartbeat timer for SSE

**Priority:** P3 (deferred — v2 scale only)
**Finding:** PERF-SSE-001
**Location:** `app/src/app/api/events/route.ts`
**Status:** 📋 Identified

**Before:** Each SSE connection has its own `setInterval` (50 timers at max capacity).

**After (proposed for v2):** Single shared timer in `event-bus.ts` that broadcasts `: heartbeat` to all active connections.

**Expected improvement:** Reduces timer count from N to 1. At 50 connections: ~2ms CPU saving per 30s interval.

---

### PERF-OPT-007: Server Components for non-interactive UI

**Priority:** P3 (deferred — v1.1 refactor)
**Finding:** PERF-FE-001
**Location:** All `'use client'` components
**Status:** 📋 Identified

**Before:** All components use `'use client'` — full bundle sent to browser.

**After (proposed for v1.1):** Convert non-interactive components to Server Components:
- `KanbanColumn` → Server Component (static rendering)
- `TaskCard` → Server Component (static rendering per task)
- Only `KanbanBoard`, `useSSE`, modals remain Client Components

**Expected improvement:** ~25% bundle size reduction (~75KB → ~55KB gzipped). Faster initial page load.

---

## Summary

| ID | Priority | Effort | Impact | Status |
|----|----------|--------|--------|--------|
| PERF-OPT-001 | P1 | Low | Medium (50% fewer iterations) | ✅ Applied |
| PERF-OPT-002 | P2 | Low | Low (eliminates redundant calls) | ✅ Applied |
| PERF-OPT-003 | P2 | Low | Correctness (explicit caching) | ✅ Applied |
| PERF-OPT-004 | P3 | Low | High at scale (v1.1+) | 📋 Identified |
| PERF-OPT-005 | P3 | Low | Reliability (v1.1+) | 📋 Identified |
| PERF-OPT-006 | P3 | Medium | Low at v1 scale (v2) | 📋 Identified |
| PERF-OPT-007 | P3 | High | Medium (bundle size, v1.1+) | 📋 Identified |

**Recommended for v1 implementation:** PERF-OPT-001, PERF-OPT-002, PERF-OPT-003
**Recommended for v1.1:** PERF-OPT-004, PERF-OPT-005, PERF-OPT-007
**Recommended for v2:** PERF-OPT-006

---

## Auth Feature Optimizations (TSK-018, 2026-08-14)

### PERF-OPT-008: Reduce bcrypt rounds from 12 to 10

**Priority:** P1 (quick win, highest impact on concurrency)
**Finding:** PERF-AUTH-001
**Location:** `src/lib/auth/password.ts`
**Status:** 📋 Identified

**Before:**
```ts
const SALT_ROUNDS = 12;
// ~270ms per operation, blocks event loop
```

**After (proposed for v1.1):**
```ts
const SALT_ROUNDS = 10;
// ~70ms per operation, 4× less blocking time
```

**Measured impact:** 12 rounds = 270ms, 10 rounds = ~70ms (bcrypt doubles per round).
**Security assessment:** 10 rounds = ~2^10 = 1024 iterations. OWASP recommends 10-12 rounds for web apps. For an internal project management tool, 10 rounds provides adequate security against offline brute-force attacks.

**Expected improvement:**
- Login p95: 316ms → ~115ms (63% reduction)
- Register p95: 298ms → ~105ms (65% reduction)
- 5 concurrent logins: 1327ms → ~350ms (74% reduction)
- Event loop blocking: still present, but 4× shorter duration

---

### PERF-OPT-009: Cache JWT payload in request context

**Priority:** P2 (medium impact, easy fix)
**Finding:** PERF-AUTH-003
**Location:** `src/middleware.ts` → route handlers
**Status:** 📋 Identified

**Before:** Middleware verifies JWT → route handler verifies JWT again (redundant for /api/auth/me).

**After (proposed for v1.1):** Middleware attaches verified payload to `request.headers` via a custom header (e.g., `x-auth-user`) or Next.js `NextRequest` extension. Route handlers read from this instead of re-verifying.

```ts
// In middleware.ts, after verifyToken():
const response = NextResponse.next();
response.headers.set('x-auth-user', JSON.stringify(payload));
return response;

// In route handler:
const authUser = JSON.parse(request.headers.get('x-auth-user') || 'null');
```

**Expected improvement:** Eliminates ~0.15ms per redundant JWT verify. For 5 requests per page load: ~0.75ms saved. More importantly: reduces cryptographic operations, improving overall system throughput.

---

### PERF-OPT-010: Switch to native bcrypt (libuv thread pool)

**Priority:** P2 (high impact, requires Docker changes)
**Finding:** PERF-AUTH-001
**Location:** `src/lib/auth/password.ts`, `Dockerfile`
**Status:** 📋 Identified (v2 candidate)

**Before:** `bcryptjs` — pure JS, blocks event loop, parallelism factor 1.02×.

**After:** `@node-rs/bcrypt` (Rust-based, pre-built binaries for Alpine) or `bcrypt` (native addon, requires build deps).

**Dockerfile change:**
```dockerfile
# With @node-rs/bcrypt (no build deps needed):
RUN npm install @node-rs/bcrypt
```

**Expected improvement:**
- Parallelism factor: 1.02× → N× (libuv thread pool default: 4 threads)
- 5 concurrent logins: 1327ms → ~270ms (true parallel execution)
- Event loop: no longer blocked during bcrypt operations

**Trade-off:** `@node-rs/bcrypt` adds ~5MB to Docker image. `bcrypt` (native addon) requires `python3`, `make`, `g++` build deps (~150MB transient).

---

## TSK-019 UI Enhancements — Quick Check (2026-08-14)

**Transition:** T45b (code-reviewer → performance-analyst)
**Method:** Static code analysis
**Result:** No bottlenecks identified. All patterns appropriate for expected scale.

### Findings

| Component | Pattern | Assessment |
|-----------|---------|------------|
| EditTaskModal | 7× individual useState | ✅ Correct for modal form size |
| EditTaskModal | validate() on submit only | ✅ No onChange overhead |
| EditTaskModal | Partial update (only changed fields) | ✅ Reduces payload |
| EditTaskModal | Subproject fetch with cleanup | ✅ Prevents stale state |
| TaskCard | isAdmin O(1) comparison | ✅ Cheaper than useMemo |
| TaskCard | useMemo for avatarColor + relativeDate | ✅ Already optimized (PERF-OPT-002) |
| AppContext | updateTaskOptimistic stable callback | ✅ useCallback([], []) |
| AppContext | Functional setTasks updater | ✅ No stale closure risk |

**No new optimizations identified.** All patterns are correct for the expected scale (<100 tasks per project, <200 total visible cards).

### Scale Watch List

| Metric | Current Threshold | Watch For |
|--------|------------------|-----------|
| Tasks per project | <100 | If >1000: consider Map<string, Task> for O(1) updates |
| Total visible TaskCards | <200 | If >500: consider virtualization (react-window) |
| Projects in dropdown | <10 | If >50: consider lazy-load or search |

---

## Summary (Updated)

| ID | Priority | Effort | Impact | Status |
|----|----------|--------|--------|--------|
| PERF-OPT-001 | P1 | Low | Medium (50% fewer iterations) | ✅ Applied |
| PERF-OPT-002 | P2 | Low | Low (eliminates redundant calls) | ✅ Applied |
| PERF-OPT-003 | P2 | Low | Correctness (explicit caching) | ✅ Applied |
| PERF-OPT-008 | P1 | Low | High (4× faster auth, 74% less blocking) | 📋 Identified |
| PERF-OPT-009 | P2 | Low | Low (eliminates redundant verifies) | 📋 Identified |
| PERF-OPT-010 | P2 | Medium | High (true parallel bcrypt) | 📋 Identified |
| PERF-OPT-004 | P3 | Low | High at scale (v1.1+) | 📋 Identified |
| PERF-OPT-005 | P3 | Low | Reliability (v1.1+) | 📋 Identified |
| PERF-OPT-006 | P3 | Medium | Low at v1 scale (v2) | 📋 Identified |
| PERF-OPT-007 | P3 | High | Medium (bundle size, v1.1+) | 📋 Identified |
