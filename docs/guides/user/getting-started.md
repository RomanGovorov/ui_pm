# Getting Started with Project Manager UI

> **Version**: 1.2.0
> **Last Updated**: 2026-08-14

Welcome to the Project Manager UI! This guide walks you through installation, configuration, and first-time use — whether you're a stakeholder reviewing project status or an AI agent managing tasks programmatically.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development Setup](#local-development-setup)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [First Use](#first-use)
- [Using the UI](#using-the-ui)
- [Agent API Integration](#agent-api-integration)
- [Real-Time Events (SSE)](#real-time-events-sse)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Docker + Docker Compose | v24+ / v2.25+ | For production deployment |
| Node.js | v22.x | For local development only |
| npm | v10+ | For local development only |
| PostgreSQL | v16 | Deployed automatically via Docker Compose |

**For stakeholders**: Only a web browser is needed. Deploy the app using Docker.

**For agents/developers**: You'll need Docker (for the database) and the API documentation for programmatic access.

---

## Quick Start (Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/gansru/ui_pm.git
cd ui_pm/app
```

### 2. Configure Environment Variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
# Database
DB_NAME=pm_db
DB_USER=pm_user
DB_PASSWORD=<your-strong-password-here>

# Application API Key (for agent authentication)
API_KEY=<your-secret-api-key-at-least-32-chars>

# Optional: CORS allowed origins
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Optional: App version label
APP_VERSION=1.2.0
```

### 3. Start the Services

```bash
docker compose up -d
```

This starts two containers:
- **PostgreSQL 16** on internal network (port 5432, not exposed to host)
- **Project Manager UI** on port 3000

### 4. Verify Deployment

Open your browser to `http://localhost:3000` and check the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-08-13T12:00:00.000Z",
  "version": "unknown",
  "checks": {
    "database": "connected"
  }
}
```

---

## Local Development Setup

For developers who need to modify the application code:

### 1. Install Dependencies

```bash
cd app
npm install
```

### 2. Generate Prisma Client

```bash
npm run db:generate
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

### 4. Seed Sample Data (Optional)

```bash
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

The app runs at `http://localhost:3000` with hot reload enabled.

### 6. Run Tests

```bash
# All tests
npm test

# With coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

### 7. Open Prisma Studio (Database GUI)

```bash
npm run db:studio
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_NAME` | Yes | `pm_db` | PostgreSQL database name |
| `DB_USER` | Yes | `pm_user` | PostgreSQL username |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `API_KEY` | Yes | — | Master API key for write operations (AI agents) |
| `API_KEY_SECONDARY` | No | — | Secondary key during rotation (zero-downtime) |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 64 hex characters). Required for v1.1.0+. |
| `REGISTRATION_ENABLED` | No | `"true"` | Set to `'false'` to disable open registration after initial setup |
| `CORS_ALLOWED_ORIGINS` | No | — | Comma-separated list of allowed origins |
| `APP_VERSION` | No | `"1.0.0"` | App version label shown in health checks |
| `IMAGE_NAME` | No | `localhost:3000/pm-ui` | Docker image name |
| `IMAGE_TAG` | No | `latest` | Docker image tag |

### Docker Resource Limits

| Service | CPU Limit | Memory Limit | CPU Reservation | Memory Reservation |
|---------|-----------|--------------|-----------------|--------------------|
| PostgreSQL | 1.0 | 256 MB | 0.25 | 128 MB |
| App | 2.0 | 512 MB | 0.5 | 256 MB |

### Rate Limiting

| Scope | Limit | Window | Purpose |
|-------|-------|--------|---------|
| Global (per IP) | 100 requests | 60 seconds | Prevent API abuse |
| Write ops (per IP) | 60 requests | 60 seconds | Protect against bulk modifications |
| Auth failures (per IP) | 10 attempts | 60 seconds | Prevent brute-force attacks |

---

## First Use

### As a Stakeholder (UI User)

1. **Open the dashboard**: Navigate to `http://localhost:3000` in your browser.
2. **Register or log in**: If you don't have an account yet, click **"Register"** on the login page to create one. If you already have an account, enter your email and password on the `/login` page.
3. **After logging in**: You will be redirected to the dashboard. Your session persists for 7 days.
4. **If registration is disabled**: Contact your project administrator to create an account for you.
5. **Create a project**: Click "Create Project" in the sidebar or header (admin/agent only).
6. **Add tasks**: Within a project, click "Create Task" to add new items.
7. **Drag and drop**: Move tasks between Kanban columns (`in_work`, `review`, `done`) by dragging task cards.
8. **Filter tasks**: Use the filters bar to see tasks by status.
9. **Dark/Light mode**: Toggle theme in the header.
10. **Logout**: Click "Logout" in the sidebar when done.

> **Role-based access**: As a stakeholder, you can view all projects and tasks but cannot create or modify them. Admin users can manage everything including user accounts. See the [Authentication Guide](authentication.md#roles-and-permissions) for full details.

### As an Agent (API User)

1. **Get your API key**: Contact your project admin to receive an API key (minimum 32 characters).
2. **Test authentication**:

   ```bash
   curl -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key-here" \
     -d '{
       "projectId": "550e8400-e29b-41d4-a716-446655440000",
       "title": "Review PR #42",
       "priority": "high",
       "assignee": "Agent-T67"
     }'
   ```

3. **List projects** (no auth needed):

   ```bash
   curl http://localhost:3000/api/projects
   ```

4. **Subscribe to real-time events**:

   ```javascript
   // Authentication is required for SSE since v1.1.0
   // First, log in to set the auth_token cookie:
   await fetch('/api/auth/login', {
     method: 'POST',
     body: JSON.stringify({ email: 'roman@example.com', password: 'your-password' }),
     credentials: 'same-origin',
   });

   // Now connect — the cookie will be sent automatically
   const es = new EventSource('http://localhost:3000/api/events');
   es.addEventListener('task_created', (event) => {
     console.log('New task:', JSON.parse(event.data));
   });
   ```

---

## Authentication

v1.1.0 introduced email/password authentication for browser users. See the [Authentication Guide](authentication.md) for full details.

### Quick Overview

| What | Details |
|------|---------|
| Login page | `/login` — enter email + password |
| Register page | `/register` — create a new account |
| Session duration | 7 days (no automatic refresh) |
| Logout | Sidebar button or `POST /api/auth/logout` |
| Password requirements | Min 8 chars, not a common password |
| Roles | `admin` (full access), `stakeholder` (read-only) |

### First-Time Setup

1. Navigate to `http://localhost:3000`. You will be redirected to `/login`.
2. Click **"Register"** on the login page (or go directly to `/register`).
3. Fill in your name, email, and choose a strong password.
4. Click **"Create Account"** — you will be automatically logged in.
5. If registration is disabled, contact your admin for an account.

---

## Using the UI

### Main Dashboard

The dashboard displays a **Kanban board** with three columns:

| Column | Meaning |
|--------|---------|
| **In Progress** | Tasks currently being worked on |
| **In Review** | Tasks completed but awaiting review |
| **Done** | Completed and approved tasks |

### Task Cards

Each card shows:
- **Title** — Task name
- **Priority indicator** — Color-coded badge (red = high, yellow = medium, green = low)
- **Assignee** — Person or agent responsible
- **Subproject** — Associated subproject (if any)

### Creating Tasks

**Admin and Agent users only.** Stakeholder accounts have read-only access.

1. Click **"Create Task"** button
2. Fill in required fields:
   - **Project** (dropdown)
   - **Title** (text)
   - **Assignee** (text)
3. Optional fields:
   - **Description**
   - **Subproject**
   - **Priority** (defaults to Medium)
   - **Status** (defaults to **In Progress** / `in_work`; choose from: In Progress, In Review, Done)
4. Click **"Create"**

> **Note**: Since v1.2.0, the status dropdown lets you set the initial status directly during creation instead of creating in `in_work` and then moving manually.

If you are a stakeholder and do not see the "Create Task" button, this is expected — your role provides view-only access. Contact an admin if you need to create a task.

### Editing Tasks

**Admin and Agent users only.** The edit icon (✏️) appears on every task card for users with write access. Stakeholders will not see the pencil icon.

1. Click the **pencil icon** (✏️) on any task card. The **Edit Task** modal opens with all current values pre-filled.
2. Modify any field:
   - **Title**, **Description**, **Status**, **Priority**, **Assignee**, **Project**, **Subproject**
   - All changes are optional — only modified fields are sent to the server (partial update)
3. Click **"Save"** to apply changes, or **"Cancel"** to discard them.

**How it works behind the scenes:**

- Changes are applied **optimistically** — the UI updates immediately, before the server confirms.
- A `task_updated` SSE event broadcasts the change to all connected clients in real time.
- If the server returns an error (validation failure, network issue), the optimistic update reverts to the previous state.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close modals |
| `Tab` | Navigate form fields |

---

## Agent API Integration

### Authentication Flow

Agents authenticate using the `X-API-Key` header:

```
POST /api/tasks
X-API-Key: my-secret-agent-key-that-is-long-enough
Content-Type: application/json

{ "projectId": "...", "title": "...", "assignee": "Agent-T67" }
```

**Zero-Downtime Key Rotation**: The system supports dual keys. During rotation, both `API_KEY` (primary) and `API_KEY_SECONDARY` (new key) are accepted simultaneously. After verifying all agents have switched, remove the old key.

### Key Constraints

| Property | Constraint |
|----------|------------|
| Minimum length | 32 characters |
| Maximum length | 255 characters |
| Character set | Any printable ASCII |
| Comparison method | Timing-safe (prevents timing attacks) |

### Example: Full Agent Workflow

```python
import requests
import json

BASE_URL = "http://localhost:3000"
API_KEY = "your-secret-agent-key"
HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

# 1. List all projects
projects = requests.get(f"{BASE_URL}/api/projects").json()
print(f"Found {projects['total']} projects")

# 2. Create a task in the first project
task = requests.post(
    f"{BASE_URL}/api/tasks",
    headers=HEADERS,
    json={
        "projectId": projects["data"][0]["id"],
        "title": "Process incoming data",
        "priority": "high",
        "assignee": "Agent-T67",
        "status": "in_work",  # Optional: defaults to "in_work"
    },
).json()
print(f"Created task: {task['id']}")

# 3. Update task status (partial update — only changed field sent)
requests.put(
    f"{BASE_URL}/api/tasks/{task['id']}",
    headers=HEADERS,
    json={"status": "review"},
)

# 4. Update multiple fields at once
requests.put(
    f"{BASE_URL}/api/tasks/{task['id']}",
    headers=HEADERS,
    json={
        "title": "Revised task title",
        "priority": "medium",
        "assignee": "Agent-T70",
    },
)

# 5. Connect to SSE stream
import asyncio
from aiohttp import ClientSession

async def listen_events():
    async with ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/events") as resp:
            async for line in resp.content:
                text = line.decode().strip()
                if text.startswith("event:"):
                    print(text)

asyncio.run(listen_events())
```

### Updating Tasks via API

The `PUT /api/tasks/{id}` endpoint accepts a partial payload — only the fields you include will be updated:

```bash
# Change status only
curl -X PUT http://localhost:3000/api/tasks/<task-id> \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"status": "review"}'

# Change priority and assignee simultaneously
curl -X PUT http://localhost:3000/api/tasks/<task-id> \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"priority": "high", "assignee": "New-Agent"}'

# Clear description
curl -X PUT http://localhost:3000/api/tasks/<task-id> \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"description": null}'
```

**Supported fields** (all optional in `PUT`):

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | 1–200 characters |
| `description` | string \| null | Max 2000 characters, or `null` to clear |
| `status` | enum | `in_work`, `review`, `done` |
| `priority` | enum | `high`, `medium`, `low` |
| `assignee` | string | 1–100 characters |
| `projectId` | string (UUID) | Valid project UUID |
| `subprojectId` | string (UUID) \| null | Valid subproject UUID, or `null` |

**Error responses:**
- `400 VALIDATION_ERROR` — Invalid field value or empty payload
- `401 UNAUTHORIZED` — Missing or invalid API key
- `404 NOT_FOUND` — Task does not exist

---

## Real-Time Events (SSE)

The `/api/events` endpoint provides a live stream of changes across all projects and tasks.

> **Note**: SSE requires authentication since v1.1.0. Unauthenticated requests receive `401 Unauthorized`. Use either API key (agents) or login first (browser users).

### Event Types

| Event | When Fired | Payload |
|-------|-----------|---------|
| `task_created` | New task created | Full task object (excluding description, bandwidth optimization) |
| `task_updated` | Task modified | Full task object (excluding description) |
| `task_deleted` | Task removed | `{ id: string }` (minimal payload) |
| `project_created` | New project created | `{ id, name, description, updatedAt }` |
| `project_updated` | Project modified | `{ id, name, description, updatedAt }` |
| `project_deleted` | Project removed | `{ id: string }` |

### Connection Limits

- **Max concurrent connections**: 50 total
- **Max per IP**: 10
- **Heartbeat interval**: 30 seconds (`: heartbeat\n\n`)
- **Connection exceeded**: HTTP 503 with `TOO_MANY_CONNECTIONS` error

### Browser Usage

```javascript
// Connect to the event stream
const eventSource = new EventSource('http://localhost:3000/api/events');

// Handle specific event types
eventSource.addEventListener('task_created', (event) => {
  const task = JSON.parse(event.data);
  console.log(`New task "${task.title}" created in project ${task.projectId}`);
});

eventSource.addEventListener('task_updated', (event) => {
  const task = JSON.parse(event.data);
  console.log(`Task updated: ${task.id} → status: ${task.status}`);
});

// Handle errors
eventSource.onerror = () => {
  console.error('SSE connection error — reconnecting...');
};
```

---

## Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Edit button not visible on task cards | Current user has `stakeholder` role (read-only) | Contact an admin to upgrade your role to `admin` |
| Optimistic update reverts after saving | Validation error from server (e.g., invalid assignee length) | Check the error message displayed below the field; correct the value and retry |
| SSE connection drops immediately | Not authenticated (v1.1.0+) | Log in first (browser users) or verify API key (agents) |
| Task not updating across tabs | SSE connection lost or slow network | Reconnect SSE stream; the `task_updated` event may be delayed up to a few seconds |
| "No fields to update" error (400) | PUT request sent with empty body | Include at least one field in the JSON payload |

---

## Next Steps

- Read the **[Authentication Guide](authentication.md)** for details on login, registration, roles, and sessions
- Read the **[Troubleshooting Guide](troubleshooting.md)** for common issues
- Review the **[API Documentation](../api/)** for complete endpoint references
- Check the **[Deployment Runbook](../runbooks/)** for operational procedures
- See **[Release Notes](../release-notes/)** for version history
