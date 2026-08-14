# PHASE1-005: Open Read Endpoints — Data Exposure Risk

**ID:** PHASE1-005
**Severity:** MEDIUM
**Category:** Broken Access Control (A01:2021)
**STRIDE:** Information Disclosure
**Phase:** 1 (Architecture Audit)
**Date:** 2026-08-13

---

## Vulnerability

All GET endpoints are open (no authentication required):
- `GET /api/projects` — lists all projects
- `GET /api/projects/:id` — project details
- `GET /api/projects/:id/tasks` — all tasks in a project
- `GET /api/tasks` — all tasks across all projects
- `GET /api/users` — all users and their names
- `GET /api/events` — real-time SSE stream of all changes

This is an intentional design decision per PRD ("no user auth in v1"), but it creates significant data exposure if the application is accessible beyond the intended internal network.

## Location

- **All API route handlers:** `app/api/*/route.ts`
- **Middleware:** `middleware.ts`
- **SSE endpoint:** `app/api/events/route.ts`

## Impact

- **Data scraping**: Any network-accessible client can enumerate all projects, tasks, and users
- **Business intelligence exposure**: Task titles, descriptions, priorities, and assignees reveal internal project plans
- **User enumeration**: `/api/users` exposes all user names and roles
- **Real-time surveillance**: SSE stream provides live monitoring of all project activity

## Evidence

From system architecture §6.1:
> "Stakeholder (browser) | None (open access) | Read-only dashboard"

From system architecture §6.2:
> "Read operations (GET) are open for v1"
> "SSE endpoint is open (same as dashboard)"

From system architecture §9:
> "No auth for viewers | Anyone with URL can view | Acceptable per PRD; internal network"

## Remediation Options

### Option A: Accept with Network Controls (Recommended for v1)
- Deploy behind a reverse proxy (nginx/Caddy) with IP allowlist
- Add basic network-level access control
- Document the risk acceptance in ADR

### Option B: Read-Only API Key
- Require the same API key (or a separate read-only key) for GET requests
- Browser clients receive a read-only key at page load (server-side rendered)
- This adds auth complexity but prevents unauthorized data access

### Option C: Origin-Based Restriction
- Only allow GET requests from same-origin (browser)
- Block API access from non-browser clients for read endpoints
- Less secure (easily spoofed) but adds a layer

## Risk Rating

| Factor | Value |
|---|---|
| Likelihood | HIGH (no protection exists) |
| Impact | MEDIUM (data exposure, but accepted by design) |
| **Risk** | **MEDIUM** |

## Recommendation

Accept this risk for v1 with the following conditions:
1. **Must**: Deploy behind reverse proxy with IP restrictions
2. **Must**: Document risk acceptance in ADR
3. **Should**: Add read-only API key in v2
4. **Should**: Add access logging to detect unusual read patterns

## Status

**ACCEPTED** — By design decision. Recommend network-level mitigation.
