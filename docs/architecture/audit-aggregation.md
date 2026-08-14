# Phase 1 Audit Aggregation — Implementation Priority Guide

**Version:** 1.0
**Author:** architecture-planner
**Date:** 2026-08-13
**Purpose:** Aggregated findings from all three Phase 1 audits, prioritized for code-implementer (T13 handoff)

---

## 1. Executive Summary

Three Phase 1 audits completed: **Security** (10 findings), **UI/UX & Accessibility** (8 findings), **Data Engineering** (8 findings). Total: **26 findings**.

| Category | Critical | High/Serious | Medium/Moderate | Low | Total |
|---|---|---|---|---|---|
| Security | 1 | 4 | 5 | 0 | 10 |
| UI/UX | 2 | 4 | 2 | 0 | 8 |
| Data | 0 | 2 | 3 | 3 | 8 |
| **Total** | **3** | **10** | **10** | **3** | **26** |

**Architecture changes made:**
1. Rate limiting promoted from v1.1 → v1 (SEC-PHASE1-002)
2. WCAG 2.1 AA compliance mandated for all UI components
3. EventBus connection limits added to architecture
4. Prisma schema: 4 additive changes integrated

---

## 2. Implementation Priority Matrix

### P0 — BLOCKING (must implement, blocks release)

| ID | Domain | Finding | Implementation Location | Phase |
|---|---|---|---|---|
| SEC-001 | Security | API key timing attack — use `crypto.timingSafeEqual` | `lib/auth.ts` | 1 |
| SEC-010 | Security | Middleware bypass risk — default-deny matcher | `middleware.ts` | 1 |
| UI-002 | UI/UX | Missing ARIA attributes and landmark roles | All components | 4 |
| UI-006 | UI/UX | Modal focus management — focus trap, ESC, scroll lock | `ModalWrapper.tsx`, `use-focus-trap.ts` | 4 |

### P1 — HIGH (must implement for v1 release)

| ID | Domain | Finding | Implementation Location | Phase |
|---|---|---|---|---|
| SEC-002 | Security | Rate limiting — promote to v1 | `lib/rate-limiter.ts`, `middleware.ts` | 1 |
| SEC-003 | Security | Security headers configuration | `next.config.ts` | 1 |
| SEC-004 | Security | SSE connection limits (50 total, 10/IP) | `lib/events/event-bus.ts` | 3 |
| SEC-007 | Security | CORS configuration (no wildcard `*`) | `middleware.ts` | 1 |
| SEC-009 | Security | Error response sanitization | `lib/errors.ts` | 1 |
| UI-001 | UI/UX | Dark theme color contrast (design tokens) | `globals.css` | 4 |
| UI-005 | UI/UX | Focus-visible rings on all interactive elements | `globals.css` `@layer base` | 4 |
| UI-007 | UI/UX | Priority not color-only (keep text label + aria-hidden dot) | `TaskCard.tsx` | 4 |
| DATA-002 | Data | Task ordering — ORDER BY priority ASC, createdAt DESC | `task-service.ts` queries | 2 |
| DATA-005 | Data | N+1 prevention — single query dashboard load | `project-service.ts` | 2 |

### P2 — MEDIUM (should implement for v1)

| ID | Domain | Finding | Implementation Location | Phase |
|---|---|---|---|---|
| SEC-006 | Security | Dual-key API key rotation support | `lib/auth.ts` | 1 |
| SEC-008 | Security | Docker security baseline (non-root, multi-stage, `.dockerignore`) | `Dockerfile`, `.dockerignore` | 1 |
| UI-003 | UI/UX | Task card visual hierarchy (line-clamp title, hover states) | `TaskCard.tsx` | 4 |
| UI-004 | UI/UX | Real-time feedback (toast notifications + card animation) | `use-toast.ts`, `ToastContainer.tsx` | 4 |
| UI-008 | UI/UX | Loading/error states (skeleton, error boundary, optimistic rollback) | `KanbanBoard.tsx`, `app-context.tsx` | 4 |
| DATA-001 | Data | Subproject index — `@@index([projectId])` | `prisma/schema.prisma` | 1 |
| DATA-003 | Data | Unique constraints — `Project.name @unique`, `Subproject @@unique` | `prisma/schema.prisma` | 1 |
| DATA-006 | Data | Connection pool config — `connection_limit=10` in DATABASE_URL | `.env`, `lib/db/client.ts` | 1 |

### P3 — LOW (acceptable for v1, track for v1.1)

| ID | Domain | Finding | Decision |
|---|---|---|---|
| SEC-005 | Security | Open read endpoints | **ACCEPTED** — deploy behind IP-restricted proxy |
| DATA-004 | Data | Subproject updatedAt | **FIXED** — added to schema |
| DATA-007 | Data | User model isolation | **ACCEPTED** — intentional v1 design, v2 migration path documented |
| DATA-008 | Data | SSE payload optimization | **FIXED** — exclude `description` from SSE select |

---

## 3. Architecture Changes Summary

| Change | Document Updated | Section |
|---|---|---|
| Rate limiting promoted to v1 | `system-architecture.md` | §6.3 |
| Security headers & CORS | `system-architecture.md` | §6.4 |
| API key timing-safe comparison | `system-architecture.md` | §6.6 |
| SSE connection limits | `component-specifications.md` | §3.3 |
| Rate limiter component | `component-specifications.md` | §3.3.1 |
| Error handler component | `component-specifications.md` | §3.3.2 |
| ModalWrapper (a11y) | `component-specifications.md` | §2.7 |
| Toast notifications | `component-specifications.md` | §2.8 |
| Skip-to-content link | `component-specifications.md` | §2.9 |
| New hooks: `use-focus-trap`, `use-toast` | `component-specifications.md` | §1 |
| Implementation steps expanded | `implementation-plan.md` | All phases |
| Prisma schema changes | `data-models.md` | §1 |

---

## 4. Prisma Schema Changes (from Data Audit)

These 4 changes are **additive** and safe for the initial migration:

```diff
 model Project {
-  name        String
+  name        String       @unique                    // DATA-PHASE1-003
   // ...
 }

 model Subproject {
   // ...
+  updatedAt   DateTime     @updatedAt @map("updated_at")  // DATA-PHASE1-004
   // ...
+  @@index([projectId])                                 // DATA-PHASE1-001
+  @@unique([projectId, name])                          // DATA-PHASE1-003
 }
```

Full audited schema: `docs/data/data-models.md` §1.

---

## 5. Security Checklist Reference

The security audit produced a **73-point checklist** organized into 12 categories (A–L). All items are marked ⏳ (pending implementation). The code-implementer must address these during implementation.

**Categories:**
- A. API Key Auth (7 items)
- B. Middleware & Route Protection (7 items)
- C. Input Validation (9 items)
- D. Rate Limiting (5 items)
- E. Security Headers (7 items)
- F. CORS (5 items)
- G. SSE Security (7 items)
- H. Error Handling (5 items)
- I. Secrets Management (6 items)
- J. Database Security (6 items)
- K. Dependency Security (4 items)
- L. Docker Security (5 items)

Full checklist: `docs/security/security-checklist.md`

---

## 6. Accessibility Requirements Reference

The UI/UX audit targets **WCAG 2.1 AA** compliance. Key implementation requirements:

| Requirement | Scope | Implementation |
|---|---|---|
| ARIA landmarks | AppShell | `<aside>`, `<main>`, `<header>` with proper roles |
| ARIA labels | All interactive elements | `aria-current`, `aria-label`, `aria-live` |
| Focus management | Modals | Focus trap hook, ESC close, scroll lock |
| Focus visible | All interactive | Global CSS `@layer base` rule |
| Color contrast | Dark + light themes | Design tokens with ≥4.5:1 ratios |
| Skip navigation | Layout | Hidden link visible on focus |
| Screen reader announcements | SSE updates | `aria-live="polite"` region |
| Keyboard navigation | All interactions | Tab order, Enter/Space activation |

Full spec: `docs/ui-ux/ui-spec.md` and `docs/ui-ux/accessibility-report.md`

---

## 7. Query Patterns Reference

The data audit documented optimized query patterns for all API endpoints:

| Endpoint | Strategy | Query Count |
|---|---|---|
| GET /api/projects | `select` + `_count` (no include) | 1 |
| GET /api/projects/:id | `findUnique` with subprojects | 1 |
| GET /api/projects/:id/tasks | `findMany` with explicit orderBy | 1 |
| Dashboard load | `Promise.all` (project + tasks in parallel) | 2 |
| SSE event payload | Exclude `description` field | — |

Full patterns: `docs/data/optimized-queries.md`

---

## 8. Artifacts for code-implementer (T13)

### Must-read (start here)

| Artifact | Path | Purpose |
|---|---|---|
| System Architecture | `docs/architecture/system-architecture.md` | Overall system design, security architecture, audit results |
| Implementation Plan | `docs/architecture/implementation-plan.md` | 5 phases with audit-driven steps |
| Component Specifications | `docs/architecture/component-specifications.md` | All components including new security/a11y components |
| Data Flow | `docs/architecture/data-flow.md` | Write/read/SSE data paths |
| ADRs | `docs/architecture/adrs/` | 5 architectural decision records |
| **This document** | `docs/architecture/audit-aggregation.md` | Priority matrix for all 26 findings |

### Security (reference during implementation)

| Artifact | Path | Purpose |
|---|---|---|
| Threat Model | `docs/security/threat-model.md` | STRIDE analysis, risk summary |
| Security Requirements | `docs/security/security-requirements.md` | 10 security requirement groups (SR-01 to SR-10) |
| Security Checklist | `docs/security/security-checklist.md` | 73-point verification checklist |
| Security Findings | `docs/security/findings/` | 10 detailed findings with remediation code |

### UI/UX (reference during frontend implementation)

| Artifact | Path | Purpose |
|---|---|---|
| UI Specification | `docs/ui-ux/ui-spec.md` | Design tokens, layout specs, component styles, interaction patterns |
| Accessibility Report | `docs/ui-ux/accessibility-report.md` | WCAG 2.1 AA criteria mapping |
| User Flow Diagrams | `docs/ui-ux/user-flow-diagrams.md` | 10 user flow diagrams |
| UI Findings | `docs/ui-ux/findings/` | 8 detailed findings with code examples |

### Data (reference during backend implementation)

| Artifact | Path | Purpose |
|---|---|---|
| Data Models | `docs/data/data-models.md` | Final Prisma schema with audit annotations |
| Optimized Queries | `docs/data/optimized-queries.md` | Query patterns for all endpoints |
| Infrastructure Requirements | `docs/data/infrastructure-requirements.md` | PostgreSQL config, Docker setup, monitoring |
| Data Dictionary | `docs/data/data-dictionary.md` | Column-level data dictionary |
| Data Findings | `docs/data/findings/` | 8 detailed findings |

---

## 9. Non-Obvious Design Constraints

These constraints are not immediately obvious from individual documents but emerge from the audit aggregation:

1. **Middleware ordering:** Auth check MUST be first (before rate limiting, CORS). Failed auth short-circuits before rate limiting is counted.
2. **SSE description exclusion:** The `description` field (up to 2000 chars) MUST be excluded from SSE payloads to reduce bandwidth. Include it only in full task fetch.
3. **Optimistic update + rollback pattern:** All client-side mutations MUST use optimistic update → API call → rollback on error. Never add without rollback path.
4. **Theme toggle is `role="switch"`:** Not a checkbox, not a button. Must have `aria-checked` and respond to Space/Enter.
5. **Priority dots are `aria-hidden="true"`:** Text label conveys the information. Dot is decorative only.
6. **Error responses use generic codes:** Never return `PRISMA_P2002` or `DATABASE_ERROR`. Map to `CONFLICT`, `NOT_FOUND`, `INTERNAL_ERROR`.
7. **PostgreSQL Docker image pinned:** Use `postgres:16.4-alpine`, not `:latest` or `:16`.
8. **Dual-key support is additive:** `API_KEY_SECONDARY` is optional. If not set, only `API_KEY` is checked.
