# Troubleshooting Guide

> **Version**: 1.0.0  
> **Last Updated**: 2026-08-13  

Common problems and solutions for the Project Manager UI. If you don't find your issue here, check the [API documentation](../api/) or contact your project admin.

---

## Table of Contents

- [Service Won't Start](#service-wont-start)
- [Database Connection Errors](#database-connection-errors)
- [Authentication Issues](#authentication-issues)
- [Rate Limiting](#rate-limiting)
- [Real-Time Events (SSE) Problems](#real-time-events-sse-problems)
- [UI Display Issues](#ui-display-issues)
- [Build / Deployment Failures](#build--deployment-failures)
- [Performance Problems](#performance-problems)
- [Error Code Reference](#error-code-reference)
- [Debugging Tips](#debugging-tips)

---

## Service Won't Start

### Problem: `docker compose up` fails with "port 3000 already in use"

**Cause**: Another service is using port 3000.

**Solution**: Stop the conflicting service or change the port mapping:

```bash
# Find what's using port 3000
lsof -i :3000

# Or edit docker-compose.yml to use a different port
# ports:
#   - "3001:3000"
```

### Problem: Container exits immediately after starting

**Cause**: Missing required environment variables.

**Solution**: Check that `.env` contains all required values:

```bash
# Verify .env file exists and has content
cat .env

# Must include at minimum:
grep -E "^DB_(NAME|USER|PASSWORD)=" .env
grep "^API_KEY=" .env
```

### Problem: Health check returns 503

**Cause**: Database not ready or API key not configured.

**Solution**:

```bash
# Check container logs
docker compose logs app
docker compose logs db

# Verify database connectivity
docker exec -it <app-container> curl http://localhost:3000/api/health

# Ensure DB_PASSWORD is set correctly in .env
grep DB_PASSWORD .env
```

---

## Authentication Issues

### Problem: "Can't login" — Invalid email or password

**Possible causes and solutions:**

1. **Wrong email address**: You may have registered with a different email. Try other addresses.

2. **Caps lock / keyboard language**: Passwords are case-sensitive. Check your Caps Lock key and confirm you're using the correct keyboard layout.

3. **Account not yet created**: If you attempted registration but saw the generic message, try logging in instead — your account may already exist.
   ```
   Registration response: { "message": "If an account with this email exists, you can sign in at /login" }
   → Go to /login and try authenticating with these credentials
   ```

4. **JWT_SECRET misconfigured (admin)**: If no accounts exist yet, the admin must set `JWT_SECRET` correctly. Without it, the app cannot start.

5. **Registration disabled**: The admin may have set `REGISTRATION_ENABLED=false`. Contact your admin for an account.

### Problem: "Too many failed login attempts"

**Cause**: Rate limit exceeded (10 failed attempts in 60 seconds per IP).

**Solution**: Wait at least 60 seconds before trying again. If this keeps happening after waiting:
- Verify you're using the correct email/password combination
- Check browser extensions that might be interfering (ad-blockers, privacy tools)
- Contact your admin if you suspect your account is locked out due to repeated failures from other IPs

### Problem: "Can't create tasks" — Read-only access

**Cause**: Your role is `stakeholder`, which grants read-only dashboard access.

**Solution**: 
- As a stakeholder, you can view all projects and tasks but cannot modify them. This is expected behavior.
- To create or edit tasks, contact your admin to request an `admin` role.
- Admin users see "Create Project" and "Create Task" buttons; stakeholders do not.

### Problem: SSE events not connecting

**Cause**: The `/api/events` endpoint requires authentication since v1.1.0.

**Solutions**:
1. **Check if you're logged in**: Visit `http://localhost:3000/api/auth/me` in your browser. If you get `{"error":{"code":"UNAUTHORIZED"}}`, you need to log in first.
   
2. **Reconnect after login**: When you log in via the UI, the SSE stream should reconnect automatically. If not, refresh the page.

3. **API client without cookies**: External scripts that consume SSE must send the cookie or API key:
   ```javascript
   // For agents — use API key header
   const es = new EventSource('http://localhost:3000/api/events', {
     headers: { 'X-API-Key': 'your-agent-key' },
   });
   ```

4. **Browser cookie blocked**: Some browser privacy settings block third-party cookies. Ensure cookies are enabled for your deployment URL.

### Problem: Session expires too quickly

Sessions expire after 7 days automatically. If your session seems to expire sooner:

1. **Clear site data**: Check if your browser is configured to clear cookies on exit.
2. **Shared machine**: Other users may be clearing your cookies.
3. **Multiple tabs**: Opening multiple tabs in private/incognito mode creates separate sessions — closing one tab doesn't log you out of others.

---

## Database Connection Errors

### Problem: "Connection refused" on startup

**Cause**: PostgreSQL container not yet ready when the app starts.

**Solution**: Docker Compose waits for the DB healthcheck (`pg_isready`). Increase the start period if needed:

```yaml
# In docker-compose.yml, adjust the db healthcheck:
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 10s
```

### Problem: Prisma migration errors

**Cause**: Migration state mismatch or concurrent migrations.

**Solution**:

```bash
# Reset migration state (development only — DO NOT run in production)
cd app
npx prisma migrate reset --force

# Re-run migrations
npm run db:migrate

# Regenerate client
npm run db:generate
```

### Problem: "relation does not exist" error

**Cause**: Migration hasn't been applied to this database instance.

**Solution**:

```bash
cd app
npm run db:migrate
npm run db:generate
```

---

## Authentication Issues

### Problem: "401 Unauthorized — Invalid or missing API key"

**Causes and solutions:**

1. **Missing API key header**: Ensure you're sending `X-API-Key` (not `Authorization`):

   ```bash
   # Correct
   curl -H "X-API-Key: my-key-here" http://localhost:3000/api/tasks

   # Incorrect — this will NOT work
   curl -H "Authorization: Bearer my-key-here" http://localhost:3000/api/tasks
   ```

2. **Incorrect API key**: The key must match exactly. Check `.env`:

   ```bash
   # Show the API key (in production, never log this!)
   grep "^API_KEY=" .env
   ```

3. **Key too short**: API keys must be at least 32 characters. Generate a new one:

   ```bash
   # Generate a secure key
   openssl rand -base64 48
   ```

4. **Dual-key rotation confusion**: During key rotation, both old and new keys work. After removing the secondary key from `.env`, the old key will stop working immediately.

### Problem: "429 Too many requests"

**Cause**: Rate limit exceeded.

**Solution**:

| Scenario | Limit | Fix |
|----------|-------|-----|
| General abuse | 100 req/min/IP | Wait for the window to expire; use `Retry-After` header value |
| Auth failures | 10 attempts/min/IP | Fix the key; wait 60 seconds |
| Write ops | 60 req/min/IP | Batch operations; add delay between calls |

Check the `Retry-After` header in the response:

```bash
curl -si http://localhost:3000/api/projects
# Look for: Retry-After: 45
```

---

## Real-Time Events (SSE) Problems

### Problem: SSE connection drops frequently

**Possible causes:**

1. **Proxy/load balancer timeout**: HTTP proxies may close long-lived connections. Configure accordingly:

   ```nginx
   proxy_read_timeout 300s;
   proxy_buffering off;
   ```

2. **Connection limit reached**: Max 50 connections, 10 per IP. Reduce concurrent clients or check for leaking connections:

   ```javascript
   // Always clean up
   const es = new EventSource('http://localhost:3000/api/events');
   // ... handle events ...
   es.close(); // Important!
   ```

3. **Network instability**: The SSE library should auto-reconnect. Add retry logic:

   ```javascript
   eventSource.onreconnect = () => {
     console.log('Reconnecting...');
   };
   ```

### Problem: No events received despite making changes

**Cause**: SSE endpoint is read-only and open by design — it broadcasts to all connected clients.

**Solution**: 
- Verify connection is established: `curl http://localhost:3000/api/events` should hang with output.
- Check browser DevTools Network tab → SSE tab for active connections.
- Verify other endpoints work independently (create/update tasks via REST).

### Problem: Heartbeat messages interfering with data parsing

The server sends `: heartbeat\n\n` as a comment. Some SSE parsers may emit this as an event. Filter comments in your handler:

```javascript
eventSource.addEventListener('heartbeat', () => {
  // Ignore — this is just keep-alive
});
```

---

## UI Display Issues

### Problem: Page shows blank screen or loading forever

**Cause**: JavaScript bundle failed to load, or API backend unreachable.

**Solution**:

1. Open browser DevTools → Console. Look for errors:
   - Network errors → Backend down (check `http://localhost:3000/api/health`)
   - CORS errors → Origin not in `CORS_ALLOWED_ORIGINS`

2. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

3. Clear browser cache and cookies for the site

### Problem: Dark/Light theme toggle doesn't work

**Cause**: Theme stored in `localStorage` but cookie storage policy changed (same-site attributes).

**Solution**: This is a known edge case in some browser configurations. The app defaults to dark mode (`<html className="dark">`). Refreshing the page usually restores the preference.

### Problem: Kanban cards not draggable

**Cause**: Touch device interaction conflict or CSS pointer-events issue.

**Solution**: Try a mouse instead of touchpad. On mobile, use the edit modal to change task status instead of drag-and-drop.

---

## Build / Deployment Failures

### Problem: `npm run build` fails with TypeScript errors

```bash
cd app
npm run build
```

**Fix**: Run the type checker first to identify issues:

```bash
npx tsc --noEmit
```

### Problem: Trivy scan blocks pipeline (GitHub Actions)

```
CRITICAL,HIGH vulnerability found — BLOCKING
```

**Fix**: Update the base image version in `Dockerfile`:

```dockerfile
# Pin to specific patch version
ARG BASE_NODE_VERSION=22-alpine
```

Then update in `.github/workflows/deploy.yml` as well. See the CI workflow for the trivy action configuration.

### Problem: SSH deploy step fails with "Permission denied"

```
Host key verification failed
```

**Solution**: 

1. Verify `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY` secrets are correct in GitHub repository settings.
2. Test SSH manually from the runner:

   ```bash
   ssh -i <key-file> user@host
   ```

3. Ensure the deploy target has `docker compose` available and the `.env` file present.

### Problem: Health check fails during deployment → rollback

The deployment script runs up to 12 health checks at 5-second intervals (60 seconds total).

**If rollback happens:**

1. Check the deployed container logs:

   ```bash
   ssh user@deploy-host "docker compose logs --tail=50 app"
   ```

2. Common causes:
   - Database migration taking longer than expected
   - Environment variable mismatch between build and deploy
   - Resource exhaustion (memory limits hit)

3. Check resource usage:

   ```bash
   ssh user@deploy-host "docker stats --no-stream app"
   ```

---

## Performance Problems

### Problem: API responses are slow (>2 seconds)

**Checklist:**

1. **Database size**: Large tables without proper indexes:

   ```bash
   # Check table sizes (via Prisma Studio: npm run db:studio)
   # Or query directly:
   psql -c "\dt+"
   ```

2. **Memory limits**: Containers hitting memory caps cause swapthrashing:

   ```bash
   docker stats --no-stream
   ```

3. **Full table scans**: Tasks without filters fetch everything. Use query params:

   ```bash
   # Bad: fetches all tasks
   GET /api/tasks
   
   # Good: filter by project
   GET /api/tasks?projectId=<uuid>
   
   # Good: filter by status
   GET /api/tasks?status=done
   ```

### Problem: SSE stream high CPU usage

With many connected clients, SSE event broadcasting can become CPU-intensive.

**Mitigation:**

- Monitor active connections and drop stale ones
- Consider message queue (Redis Pub/Sub) for large-scale deployments
- Set `eventBus.setMaxListeners(100)` (already configured)

---

## Error Code Reference

| Status | Code | Cause | Solution |
|--------|------|-------|----------|
| 400 | `VALIDATION_ERROR` | Request body failed schema validation | Check field types, lengths, and required fields |
| 400 | — | Invalid UUID format | Ensure `{id}` parameter is a valid v4 UUID |
| 401 | `UNAUTHORIZED` | Missing or wrong authentication (API key or JWT cookie) | Check header name and key value, or log in via the browser |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password | Verify your login credentials; check Caps Lock |
| 401 | `NOT_AUTHENTICATED` | Missing JWT cookie on `/api/auth/me` | Log in at `/login` to get a session cookie |
| 403 | `REGISTRATION_DISABLED` | Registration turned off by admin | Contact admin for an account |
| 403 | `FORBIDDEN` | Read-only user attempted write operation | Your role is `stakeholder`; contact admin for write access |
| 403 | — | Admin access required | Non-admin/non-agent tried to access admin routes |
| 404 | `NOT_FOUND` | Project or task ID doesn't exist | Verify the ID matches an existing record |
| 409 | `CONFLICT` | Duplicate unique value | e.g., two users with same name |
| 409 | `INVALID_REFERENCE` | Foreign key violation | e.g., referencing non-existent project |
| 429 | `RATE_LIMITED` | Too many requests / too many failed logins | Respect `Retry-After` header; wait for the window to expire |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Check application logs; report to admin |
| 503 | `TOO_MANY_CONNECTIONS` | SSE connection limit reached | Close unused connections; max 50 total |

---

## Debugging Tips

### Enable Verbose Logging

```bash
# Development mode (shows warnings + errors)
NODE_ENV=development npm run dev

# Production mode (errors only)
NODE_ENV=production npm start
```

### Check Application Logs

```bash
# All containers
docker compose logs

# Specific container
docker compose logs app
docker compose logs db

# Follow live logs
docker compose logs -f app
```

### Inspect the Database

```bash
# Via Prisma Studio (browser-based GUI)
npm run db:studio

# Direct SQL queries
docker exec -it $(docker compose ps -q db) psql -U pm_user -d pm_db

# List projects
SELECT id, name, "createdAt", "_count" FROM "Project";

# Count tasks per project
SELECT "projectId", COUNT(*) FROM "Task" GROUP BY "projectId";
```

### Test Endpoints Manually

```bash
# Health check
curl -s http://localhost:3000/api/health | jq

# List projects (no auth)
curl -s http://localhost:3000/api/projects | jq

# Create task (with auth)
curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"projectId":"<uuid>","title":"Test","assignee":"Debug"}' | jq

# Connect to SSE (shows live events)
curl -N http://localhost:3000/api/events
```

### Docker Troubleshooting

```bash
# View running containers
docker compose ps

# Restart services
docker compose restart

# Rebuild from scratch
docker compose down -v && docker compose up --build

# Check resource usage
docker stats --no-stream
```

---

Still stuck? Check the [API documentation](../api/) for detailed endpoint specifications, or contact your project administrator for assistance.
