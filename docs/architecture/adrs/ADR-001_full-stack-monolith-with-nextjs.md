# ADR-001: Full-Stack Monolith with Next.js App Router

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner
**Task:** TSK-001

---

## Context

The Project Manager UI needs a web frontend (dashboard) and a backend API (for the AI agent). The PRD specifies Next.js as the framework. We need to decide on the architectural style: monolith vs. separate frontend/backend services.

**Constraints:**
- Small scale: ~100 tasks, 5-10 users
- Single deployment target (Docker Compose)
- Team has Next.js experience
- Minimal DevOps overhead for v1

## Options Considered

### Option A: Full-Stack Monolith (Next.js App Router) — CHOSEN
Single Next.js application with API Routes for backend logic.

**Pros:**
- Single codebase, single deployment
- Shared TypeScript types between frontend and API
- Server Components reduce client bundle
- No CORS issues (same origin)
- Simpler DevOps (one Docker container)

**Cons:**
- Frontend and backend scale together
- Cannot independently deploy API changes
- Tied to Next.js release cycle

### Option B: Separate Frontend (Vite/React) + Backend (Express/Fastify)
Prototype uses Vite; could keep it and add a separate API server.

**Pros:**
- Independent scaling and deployment
- Backend technology flexibility

**Cons:**
- Two codebases, two deployments
- CORS configuration needed
- Duplicate TypeScript types or shared package overhead
- More DevOps complexity

### Option C: Full-Stack Monolith (Next.js Pages Router)
Legacy Next.js routing.

**Pros:**
- More mature documentation
- Simpler data fetching patterns

**Cons:**
- Pages Router is legacy; App Router is the future
- No Server Components support
- Less optimal performance

## Decision

**Option A: Full-Stack Monolith with Next.js App Router.**

The scale of this project (~100 tasks, single server) does not justify the operational complexity of separate services. Next.js App Router provides both SSR (Server Components) for fast initial loads and API Routes for the backend, all in a single deployable unit.

## Consequences

- **Positive**: Single deployment, shared types, minimal DevOps, fast development
- **Negative**: If the project grows beyond v1 scope, migration to separate services may be needed
- **Neutral**: The prototype (Vite + React) serves as a visual reference; the production app will be rebuilt in Next.js
