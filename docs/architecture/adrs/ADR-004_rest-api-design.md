# ADR-004: REST API Design

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** architecture-planner
**Task:** TSK-001

---

## Context

The AI agent `project-manager` needs a programmatic interface to manage projects, tasks, and users. The API must follow REST conventions and return JSON. The prototype README already specifies endpoint shapes that the agent expects.

## Decision

### API Endpoints

#### Projects

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects` | None | List all projects |
| `POST` | `/api/projects` | API Key | Create project |
| `GET` | `/api/projects/:id` | None | Get project by ID |
| `PUT` | `/api/projects/:id` | API Key | Update project |
| `DELETE` | `/api/projects/:id` | API Key | Delete project |

#### Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/tasks` | None | List tasks for a project |
| `GET` | `/api/tasks` | None | List all tasks (optional filter: `?status=in_work`) |
| `POST` | `/api/tasks` | API Key | Create task |
| `GET` | `/api/tasks/:id` | None | Get task by ID |
| `PUT` | `/api/tasks/:id` | API Key | Update task (partial update supported) |
| `DELETE` | `/api/tasks/:id` | API Key | Delete task |

#### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | None | List users |
| `POST` | `/api/users` | API Key | Create user |

#### Events (SSE)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/events` | None | SSE stream for real-time updates |

### Response Format

**Success (200/201):**
```json
{
  "id": "uuid",
  "name": "Project Name",
  "createdAt": "2026-08-13T10:00:00Z",
  "updatedAt": "2026-08-13T10:00:00Z"
}
```

**Error (400/404/401):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [...]
  }
}
```

**List (200):**
```json
{
  "data": [...],
  "total": 42
}
```

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Successful GET, PUT |
| `201` | Successful POST (created) |
| `204` | Successful DELETE |
| `400` | Validation error |
| `401` | Missing or invalid API key |
| `404` | Resource not found |
| `409` | Conflict (duplicate) |
| `500` | Internal server error |

### SSE Events

| Event Name | Trigger | Payload |
|---|---|---|
| `task_created` | POST /api/tasks (201) | Full task object |
| `task_updated` | PUT /api/tasks/:id (200) | Full task object |
| `task_deleted` | DELETE /api/tasks/:id (204) | `{ "id": "uuid" }` |
| `project_created` | POST /api/projects (201) | Full project object |
| `project_updated` | PUT /api/projects/:id (200) | Full project object |
| `project_deleted` | DELETE /api/projects/:id (204) | `{ "id": "uuid" }` |

### Next.js App Router Implementation

```
app/api/
├── projects/
│   ├── route.ts              # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts          # GET, PUT, DELETE
│       └── tasks/
│           └── route.ts      # GET (list project tasks)
├── tasks/
│   ├── route.ts              # GET (list all), POST (create)
│   └── [id]/
│       └── route.ts          # GET, PUT, DELETE
├── users/
│   └── route.ts              # GET (list), POST (create)
└── events/
    └── route.ts              # GET (SSE stream)
```

## Options Considered

### Alternative A: GraphQL
- Flexible queries, single endpoint
- Rejected: Agent expects REST; overkill for v1 scale; adds complexity (Apollo/tRPC)

### Alternative B: tRPC
- Type-safe end-to-end
- Rejected: Agent is not TypeScript; needs standard REST/JSON interface

## Consequences

- **Positive**: Standard REST, easy for agent integration, clear API contract
- **Negative**: Multiple endpoints to maintain (mitigated by Next.js file-based routing)
- **Future**: Add pagination (`?page=1&limit=20`) when task count grows beyond v1
