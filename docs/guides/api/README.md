# API Documentation Index

> **Project**: Project Manager UI v1  
> **API Version**: 1.0.0  
> **Base URL**: `http://localhost:3000/api` (local) or your deployment URL  

This directory contains the complete REST API documentation for the Project Manager UI application.

## OpenAPI Specification

The authoritative API specification is in [openapi.yaml](openapi.yaml). Import it into any OpenAPI-compatible tool (Swagger UI, Postman, curl + oas-tools) for interactive exploration.

```bash
# Generate Swagger UI locally
npx @apidevtools/swagger-cli swagger.yaml openapi.yaml --port 8080
```

## Available Endpoints

| Resource | Method | Endpoint | Description | Auth Required |
|----------|--------|----------|-------------|---------------|
| **Auth** | POST | `/api/auth/register` | Register a new user account | No (public) |
| **Auth** | POST | `/api/auth/login` | Authenticate and get session cookie | No (public) |
| **Auth** | POST | `/api/auth/logout` | End current session | No (public) |
| **Auth** | GET | `/api/auth/me` | Get current authenticated user | Yes (JWT cookie) |
| Projects | GET | `/api/projects` | List all projects | No |
| Projects | POST | `/api/projects` | Create a new project | Yes |
| Projects | GET | `/api/projects/{id}` | Get project by ID | No |
| Projects | PUT | `/api/projects/{id}` | Update project | Yes |
| Projects | DELETE | `/api/projects/{id}` | Delete project | Yes |
| Tasks | GET | `/api/tasks` | List tasks (filterable) | No |
| Tasks | POST | `/api/tasks` | Create a new task | Yes |
| Tasks | GET | `/api/tasks/{id}` | Get task by ID | No |
| Tasks | PUT | `/api/tasks/{id}` | Update task | Yes |
| Tasks | DELETE | `/api/tasks/{id}` | Delete task | Yes |
| Subtasks | GET | `/api/projects/{id}/tasks` | List tasks for a project | No |
| Users | GET | `/api/users` | List users (excluding API keys) | Yes (admin only) |
| Users | POST | `/api/users` | Create a user | Yes |
| Events | GET | `/api/events` | SSE stream for real-time events | Yes (v1.1.0+) |
| Health | GET | `/api/health` | Health check endpoint | No |

## Authentication (Dual System)

The application supports two authentication methods that coexist:

### 1. Agent Access — API Key

Write operations require an API key via the `X-API-Key` header. Read operations are publicly accessible for backward compatibility.

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"name": "New Project", "description": "Description here"}'
```

Read operations (GET) do not require authentication (planned enforcement in v2).

### 2. Browser User Access — JWT Cookie (v1.1.0+)

Browser users authenticate via email/password and receive a JWT in an httpOnly cookie (`auth_token`). This cookie is automatically sent with every request.

- **Register**: `POST /api/auth/register` — creates account + sets session cookie
- **Login**: `POST /api/auth/login` — authenticates + sets session cookie
- **Logout**: `POST /api/auth/logout` — clears session cookie
- **Current user**: `GET /api/auth/me` — returns authenticated user data

See the [Auth API Reference](auth.md) for complete endpoint documentation.

### SSE Endpoint Requires Auth (v1.1.0+)

The `/api/events` endpoint requires authentication since v1.1.0. Unauthenticated requests receive `401 Unauthorized`. Both API key and JWT cookie work for SSE access.

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Global (per IP) | 100 requests | 60 seconds |
| Write ops (per IP) | 60 requests | 60 seconds |
| Auth failures (per IP) | 10 attempts | 60 seconds |

Rate limit exceeded returns HTTP `429` with a `Retry-After` header.

## Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [...]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Unique constraint violation |
| `INVALID_REFERENCE` | 400 | Foreign key constraint violated |
| `RELATION_VIOLATION` | 400 | Referential integrity violation |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `TOO_MANY_CONNECTIONS` | 503 | SSE connection limit reached |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## SSE (Server-Sent Events)

The `/api/events` endpoint provides real-time updates via Server-Sent Events.

> **Authentication required**: Since v1.1.0, clients must authenticate before connecting. Use `X-API-Key` header for agents or a valid `auth_token` cookie for browser users.

**Usage:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/events');

eventSource.onmessage = (event) => {
  console.log('Event:', event.type, JSON.parse(event.data));
};

// Listen for specific event types
eventSource.addEventListener('task_created', (event) => {
  const task = JSON.parse(event.data);
  console.log('New task:', task.title);
});
```

**Available event types:**
- `task_created` — New task created
- `task_updated` — Task fields modified
- `task_deleted` — Task removed
- `project_created` — New project created
- `project_updated` — Project fields modified
- `project_deleted` — Project removed

**Connection limits:**
- Maximum 50 concurrent connections
- Maximum 10 connections per IP
- Heartbeat sent every 30 seconds to maintain connection

## Data Models

See the [OpenAPI spec](openapi.yaml) for complete schemas including all fields, types, and constraints.

---

For questions about the API, see the [Project Manager UI GitHub repository](https://github.com/gansru/ui_pm).
