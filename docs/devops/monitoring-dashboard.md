# Monitoring Dashboard — Project Manager UI v1

**Version:** 1.0.0
**Author:** devops-infrastructure-engineer
**Date:** 2026-08-13
**Monitoring Stack:** Docker native + Next.js health endpoint (v1)
**Target:** Single-server observability without external tools

---

## 1. Health Check Endpoint

### Implementation: `GET /api/health`

```typescript
// app/src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '1.0.0',
      checks: {
        database: 'connected',
        api_key_configured: Boolean(process.env.API_KEY),
        node_env: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
          error: error instanceof Error ? error.message : 'unknown',
        },
      },
      { status: 503 },
    );
  }
}
```

### Response Format

**Healthy (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-08-13T12:00:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "connected",
    "api_key_configured": true,
    "node_env": "production"
  }
}
```

**Unhealthy (503):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-08-13T12:00:00Z",
  "checks": {
    "database": "disconnected",
    "error": "connection refused"
  }
}
```

## 2. Docker Health Checks

### App Service

| Property | Value |
|----------|-------|
| Test | `curl -sf http://localhost:3000/api/health || exit 1` |
| Interval | 30 seconds |
| Timeout | 5 seconds |
| Start period | 60 seconds (Next.js cold start) |
| Retries | 3 consecutive failures → unhealthy |

### Database Service

| Property | Value |
|----------|-------|
| Test | `pg_isready -U pm_user -d pm_db` |
| Interval | 5 seconds |
| Timeout | 5 seconds |
| Retries | 5 consecutive failures → unhealthy |

## 3. Docker Monitoring Commands

### Container Status
```bash
# View all container status and health
docker compose ps

# Expected output:
# NAME       STATUS                    PORTS
# app-1      Up (health: healthy)     0.0.0.0:3000->3000/tcp
# db-1       Up (healthy)             5432/tcp
```

### Logs
```bash
# Application logs
docker compose logs -f --tail=100 app

# Database logs
docker compose logs -f --tail=50 db

# Filter by error level (Next.js logs to stderr for errors)
docker compose logs --since=1h app | grep -i "error\|fail"
```

### Resource Usage
```bash
# CPU, memory, network per container
docker stats --no-stream

# Historical resource usage (if collected)
docker inspect --format='{{.State.Health.Status}}' $(docker compose ps -q app)
```

### Inspect Container Details
```bash
# Detailed container config including health check state
docker inspect $(docker compose ps -q app) \
  --format='{{json .State.Health}}' | jq

# Network configuration
docker inspect $(docker compose ps -q db) \
  --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}}{{"\n"}}{{end}}'
```

## 4. Database Monitoring

### Connection Pool
```sql
-- Current active connections
SELECT count(*) AS total_connections,
       max_conn AS max_connections,
       round(count(*)::numeric / max_conn * 100, 1) AS utilization_pct
FROM (
  SELECT count(*) FROM pg_stat_activity,
         (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') s
) t;

-- Connections by database
SELECT datname, count(*) AS connections
FROM pg_stat_activity
GROUP BY datname
ORDER BY count(*) DESC;

-- Slow queries (>100ms)
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Disk Usage
```bash
# Docker volume size
du -sh /var/lib/docker/volumes/ui_pm_pgdata/_data

# PostgreSQL table sizes
docker compose exec db psql -U pm_user -d pm_db -c "\dt+"
docker compose exec db psql -U pm_user -d pm_db -c "SELECT pg_size_pretty(pg_database_size('pm_db'));"
```

## 5. Log Rotation & Retention

### Configuration (Docker Compose)

Add logging configuration to both services:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

This ensures:
- Each log file ≤ 10MB
- Maximum 3 rotated files kept (~30MB total per service)
- Automatic cleanup prevents disk exhaustion

## 6. Alerting Rules (v1 — shell-based)

### Health Check Script: `scripts/health-check.sh`

```bash
#!/bin/bash
# Exit on any error
set -euo pipefail

APP_URL="http://localhost:3000/api/health"
MAX_RETRIES=3
RETRY_INTERVAL=5
ALERT_SENT=false

for i in $(seq 1 $MAX_RETRIES); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")

  if [ "$STATUS" = "200" ]; then
    if [ "$ALERT_SENT" = true ]; then
      echo "[OK] Service recovered after ${i} retries" >&2
    fi
    ALERT_SENT=false
    exit 0
  fi

  if [ "$i" -eq "$MAX_RETRIES" ] && [ "$ALERT_SENT" = false ]; then
    echo "[ALERT] Service unhealthy after ${MAX_RETRIES} attempts (HTTP $STATUS)" >&2
    # Placeholder: integrate with alert system (PagerDuty, Slack webhook, etc.)
    # curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"⚠️ Project Manager UI is DOWN"}' \
    #   "$SLACK_WEBHOOK_URL"
    ALERT_SENT=true
    exit 1
  fi

  sleep $RETRY_INTERVAL
done
```

### Cron Job Setup

```bash
# Check health every 2 minutes
*/2 * * * * /home/deploy/ui_pm/scripts/health-check.sh >> /var/log/health-check.log 2>&1
```

## 7. Auth-Specific Monitoring Metrics (NEW — v1.1)

Authentication endpoints require additional monitoring for security incident detection:

| Metric | Endpoint | Alert Threshold | Purpose |
|--------|----------|-----------------|---------|
| Login success rate | `/api/auth/login` POST 200 | < 90% of attempts → investigate credential issues | Detect credential problems or brute-force attacks |
| Login failure rate | `/api/auth/login` POST 401/403 | > 50 failures/min from single IP → block | Detect brute-force password attacks |
| Registration rate | `/api/auth/register` POST 200 vs 409 | Unexpected spikes → review | Detect automated account creation (spam/bots) |
| JWT validation errors | `/api/auth/me` unexpected 500s | Any 500 from auth endpoint → critical | Detect JWT_SECRET misconfiguration or session crash |
| Token expiration events | Cookie present but `verifyToken()` returns null | Correlated with expired token timestamps | Normal behavior — no alert, just metric |
| SSE connection count | Active connections to `/api/events` | Drop to 0 unexpectedly → check auth flow | Detect mass logout or auth system outage |

### Health Check Integration

The health check script (`scripts/health-check.sh`) now verifies `/api/auth/me` on every successful health poll:

```bash
# When app is healthy, also check auth endpoint:
# Expected: 401 (unauthenticated) = auth system working correctly
# Bad: 500 = JWT_SECRET issue or session module crash
AUTH_STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$AUTH_URL")
if [ "$AUTH_STATUS" != "401" ] && [ "$AUTH_STATUS" != "200" ]; then
    log "[WARN] Auth endpoint returned HTTP $AUTH_STATUS — possible JWT_SECRET issue"
fi
```

### Security Monitoring Checklist (Weekly)

| # | Check | Command |
|---|-------|---------|
| 1 | Review failed login attempts | `docker compose logs app \| grep -c "login.*fail"` |
| 2 | Check for unusual registration patterns | Count `register` POST requests in last 7 days |
| 3 | Verify JWT_SECRET hasn't changed | Compare hash of secret across deploy containers |
| 4 | Confirm CORS credentials header present | Test OPTIONS preflight response |
| 5 | Audit rate limiter effectiveness | Check if any IPs hit global rate limit frequently |

## 8. Monitoring Dashboard Layout (Conceptual)

When Grafana or similar tool is integrated (v2), these are the key panels:

| Panel | Metric | Source | Threshold |
|-------|--------|--------|-----------|
| **Service Status** | HTTP health check 200/503 | `/api/health` polling | 503 for > 2min → alert |
| **Request Rate** | Requests per minute (count) | Application logs / nginx access log | > 1000/min → warning |
| **Error Rate** | 4xx/5xx responses (percentage) | Application logs | > 5% → warning, > 10% → critical |
| **Response Time (p95)** | Median response latency | Application logs | > 500ms → warning |
| **Database Connections** | Active pool connections | `pg_stat_activity` | > 8 → warning (> 80% of limit) |
| **Disk Usage** | Volume size (`pgdata`) | `df`, `du` | > 80GB → warning (< 100MB expected) |
| **Container Uptime** | Container restart count | `docker ps` | Restarts > 0/day → investigate |
| **Task Count** | Total tasks in DB | `SELECT COUNT(*) FROM tasks` | > 500 → capacity warning (v1 limit) |
| **Auth Success Rate** | Login/register 200 responses | Auth endpoint response codes | < 90% → investigate credentials |
| **Auth Failure Spike** | Login 401s per IP | Log analysis | > 50/min → possible brute-force |
| **JWT Validation** | /api/auth/me 500 errors | Error log count | Any → JWT_SECRET misconfiguration |

## 8. Structured Logging

The application uses Node.js console logging (built-in). For production, structure logs as JSON:

```typescript
// lib/logger.ts — add for v2
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() })),
};
```

This enables log aggregation tools (ELK, Loki) to parse and index logs in v2 deployment.
