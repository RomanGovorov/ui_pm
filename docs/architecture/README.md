# Architecture — Project Manager UI v1

This directory contains all architecture artifacts for the Project Manager UI v1 project.

## Documents

| Document | Description |
|----------|-------------|
| [System Architecture](system-architecture.md) | Overall system design, architecture pattern, tech stack, deployment |
| [Component Specifications](component-specifications.md) | Detailed specs for all frontend and backend components |
| [Data Flow](data-flow.md) | Data flow diagrams: Agent → API → DB → SSE → Browser |
| [Implementation Plan](implementation-plan.md) | 5-phase implementation plan with task-to-backlog mapping |
| [ADRs](adrs/) | Architecture Decision Records (5 decisions documented) |

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture pattern | Full-stack monolith (Next.js App Router) | Single deployment, shared types, minimal DevOps |
| Real-time | Server-Sent Events (SSE) | Unidirectional updates, native browser support, no extra libs |
| Database schema | Prisma with UUID keys, composite indexes | Type safety, good query performance |
| API design | REST with Next.js API Routes | Standard, agent-compatible, file-based routing |
| Agent auth | Static API key in X-API-Key header | Minimal complexity for single-agent scenario |

## Phase 1 Audits Required

All three specialized audits are needed before implementation:

1. **Security Audit** → `security-auditor`
   - API key auth implementation review
   - Input validation completeness
   - SSE endpoint security
   - CORS configuration
   - Rate limiting considerations

2. **UI/UX & Accessibility Audit** → `ui-ux-accessibility-specialist`
   - Kanban board layout and responsiveness
   - Dark/light theme implementation
   - WCAG 2.1 AA compliance
   - User flow optimization
   - Component interaction patterns

3. **Data Engineering Audit** → `data-engineering-architect`
   - Prisma schema optimization
   - Query performance and indexing
   - Connection pool configuration
   - Migration strategy
