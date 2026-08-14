# Infrastructure Code Review — Project Manager UI v1

**Review ID:** review-infrastructure
**Date:** 2026-08-13
**Reviewer:** code-reviewer (infrastructure context)
**Iteration:** infrastructure_review_iteration 1/3
**Scope:** Dockerfile, Docker Compose, GitHub Actions, Health checks, Environment config, Documentation

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 4 |
| MEDIUM | 4 |
| LOW | 3 |

**Verdict:** FAIL — 1 critical + 4 high issues must be resolved before proceeding.

---

## CRITICAL Issues

### INFRA-001: PostgreSQL port 5432 exposed to host

**Severity:** CRITICAL
**Location:** `app/docker-compose.yml:11`
**Category:** Security (SR-10.2 violation)

**Description:**
The `db` service has `ports: - "5432:5432"` which publishes the PostgreSQL port to the host machine. This means any process on the host (or any external entity if the host firewall is misconfigured) can directly connect to the database, bypassing application-level security controls.

**Impact:**
Direct database access from outside the Docker network enables SQL injection, data exfiltration, privilege escalation, and complete database compromise if credentials are weak or leaked.

**Evidence — contradicts:**
- Security requirement SR-10.2: *"PostgreSQL MUST listen on internal Docker network only"*
- Deployment manifest §5: *"Host→db | blocked | Port 5432 NOT exposed to host"*
- Deployment manifest §9 checklist item #9: *"Database port 5432 not exposed to host | checked"* (falsely marked as checked)

**Remediation:**
Remove the `ports` mapping from the `db` service entirely. The `db` service is already on the `internal` network and accessible to `app` via `db:5432`.

```yaml
# BEFORE (INSECURE):
db:
  ports:
    - "5432:5432"

# AFTER (SECURE):
db:
  # No ports mapping — accessible only via internal Docker network
  # For local development, use: docker compose exec db psql -U pm_user -d pm_db
```

---

## HIGH Issues

### INFRA-002: Deploy pipeline image variable mismatch — wrong image deployed

**Severity:** HIGH
**Location:** `.github/workflows/deploy.yml:106-108` vs `app/docker-compose.yml:29`
**Category:** Deployment correctness

**Description:**
The deploy job exports `IMAGE_NAME` and `IMAGE_TAG`, but `docker-compose.yml` references `${APP_IMAGE}` and `${APP_TAG}`. These variable names don't match, so the compose file ignores the exported values and falls back to defaults (`localhost:3000/pm-ui:latest`).

**Impact:**
After `docker pull ghcr.io/.../app:<sha>`, the deploy starts `docker compose up -d --no-deps app` which uses the **wrong image** (default fallback, not the just-pulled SHA-tagged image). The deployment appears successful but runs stale or non-existent code. Health check would likely fail (image doesn't exist locally) or run an old version.

**Remediation:**
Align variable names. Either rename the compose variables or the export:

```yaml
# Option A: Fix docker-compose.yml to match the deploy script
image: ${IMAGE_NAME:-localhost:3000/pm-ui}:${IMAGE_TAG:-latest}

# Option B: Fix the deploy script to match docker-compose.yml
export APP_IMAGE="$IMAGE_NAME"
export APP_TAG="$IMAGE_TAG"
docker compose --env-file .env up -d --no-deps app
```

### INFRA-003: Resource limits commented out in production compose

**Severity:** HIGH
**Location:** `app/docker-compose.yml:42-50`
**Category:** Reliability / Production readiness

**Description:**
The `deploy.resources` section is entirely commented out with `# TODO: Uncomment and adjust resource limits for production`. Both `app` and `db` services have no memory or CPU limits.

**Impact:**
Without resource limits:
- A memory leak in the app can consume all host memory, crashing both the app AND the database
- A runaway query can starve the app of CPU
- Docker daemon may OOM-kill containers unpredictably
- No isolation between services

**Remediation:**
Uncomment and configure resource limits for both services:

```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M

db:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 256M
      reservations:
        cpus: '0.25'
        memory: 128M
```

### INFRA-004: Trivy security scan does not block pipeline

**Severity:** HIGH
**Location:** `.github/workflows/deploy.yml:76`
**Category:** Security / CI pipeline

**Description:**
The Trivy image scan step has `continue-on-error: true`. CRITICAL and HIGH vulnerabilities in the base image will produce a warning but won't block the build, push, or deployment.

**Impact:**
Known-vulnerable base images get deployed to production without human intervention. This contradicts the CI/CD pipeline documentation (§2 Stage 3): *"Fail criteria: critical/trivial vulnerabilities found."*

**Remediation:**
Remove `continue-on-error: true` or add a conditional gate:

```yaml
- name: Trivy scan base image
  uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: docker.io/library/node:22-alpine
    severity: CRITICAL,HIGH
    format: table
    exit-code: '1'  # Fail on CRITICAL/HIGH
  # Remove: continue-on-error: true
```

### INFRA-005: Node.js base image not pinned to patch version

**Severity:** HIGH
**Location:** `app/Dockerfile:2,9,16`
**Category:** Reproducibility / Security

**Description:**
All three stages use `node:22-alpine` which is a floating tag. Docker pulls the latest available `22.x` patch on each build, leading to non-reproducible builds. A compromised or buggy patch release would automatically be picked up.

**Impact:**
- Non-reproducible builds (same Dockerfile → different images on different days)
- Unexpected Node.js behavior changes between patch versions
- Security: supply chain risk — compromised patch release auto-deployed

**Remediation:**
Pin to a specific patch version:

```dockerfile
FROM node:22.6.0-alpine3.20 AS deps
FROM node:22.6.0-alpine3.20 AS builder
FROM node:22.6.0-alpine3.20 AS runner
```

---

## MEDIUM Issues

### INFRA-006: Health endpoint leaks deployment information

**Severity:** MEDIUM
**Location:** `app/src/app/api/health/route.ts:20-23`
**Category:** Information disclosure

**Description:**
The health endpoint returns `api_key_configured: Boolean(process.env.API_KEY)` and `node_env: process.env.NODE_ENV` in its public response. Any unauthenticated user can determine whether the API key is configured and the runtime environment.

**Impact:**
An attacker can determine: (a) the deployment is in production/development mode, (b) whether API key auth is active. This aids attack planning.

**Remediation:**
Remove sensitive fields from the public health response. Keep only `status`, `timestamp`, and `version`:

```typescript
return NextResponse.json({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: process.env.APP_VERSION ?? '1.0.0',
  // Remove: checks.api_key_configured, checks.node_env
});
```

### INFRA-007: Dockerfile APP_VERSION ARG not propagated to runner stage

**Severity:** MEDIUM
**Location:** `app/Dockerfile:10,19`
**Category:** Build correctness

**Description:**
`ARG APP_VERSION=unknown` is declared in the `builder` stage (line 10) and used for `LABEL` and `ENV`. In the `runner` stage (line 19), `ENV APP_VERSION=${APP_VERSION:-1.0.0}` references `APP_VERSION` but no `ARG APP_VERSION` is declared in that stage. Docker ARGs are stage-scoped, so `${APP_VERSION}` resolves to empty string, and the fallback `1.0.0` is always used.

**Impact:**
The `/api/health` endpoint always reports `version: "1.0.0"` regardless of the actual deployed commit SHA. This makes it impossible to verify which version is running in production.

**Remediation:**
Add `ARG APP_VERSION=unknown` before or within the runner stage:

```dockerfile
# Stage 3: Production
FROM node:22-alpine AS runner
ARG APP_VERSION=unknown    # ← ADD THIS
WORKDIR /app
ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}
```

### INFRA-008: Health check script recovery detection is non-functional

**Severity:** MEDIUM
**Location:** `scripts/health-check.sh:10,28-30,36`
**Category:** Monitoring correctness

**Description:**
The `ALERT_SENT` variable is initialized to `false` on every script invocation (every cron run). The recovery message (`Service recovered after N retries`) can never fire because:
1. If the last retry fails → `ALERT_SENT=true` → `exit 1` → variable lost
2. Next cron run → `ALERT_SENT=false` again → recovery message unreachable

**Impact:**
Operators never receive a recovery notification after a service outage is resolved. Only the initial alert is functional.

**Remediation:**
Use a state file to persist alert status across invocations:

```bash
STATE_FILE="/tmp/health-check-alerted"

if [ -f "$STATE_FILE" ]; then
    ALERT_SENT=true
else
    ALERT_SENT=false
fi

# On alert:
touch "$STATE_FILE"

# On recovery:
rm -f "$STATE_FILE"
log "[OK] Service recovered"
```

### INFRA-009: Health check curl has no explicit timeout

**Severity:** MEDIUM
**Location:** `scripts/health-check.sh:20`
**Category:** Monitoring reliability

**Description:**
`curl -sf -o /dev/null -w "%{http_code}" "$APP_URL"` has no `--max-time` option. If the health endpoint hangs (e.g., database connection pool exhausted), curl may block for the system default timeout (often 300 seconds).

**Impact:**
With `RETRY_INTERVAL=5` and no curl timeout, a hanging endpoint could cause a single health check invocation to take 15+ minutes (3 retries × 300s timeout), far exceeding the cron interval. Cron will stack multiple overlapping instances.

**Remediation:**
Add an explicit timeout:

```bash
STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")
```

---

## LOW Issues

### INFRA-010: Docker Compose uses obsolete `version` field

**Severity:** LOW
**Location:** `app/docker-compose.yml:1`
**Category:** Code hygiene

**Description:**
`version: '3.9'` is obsolete in Docker Compose v2+. It generates a deprecation warning and serves no functional purpose.

**Remediation:**
Remove the `version` line.

### INFRA-011: CI/CD documentation typo

**Severity:** LOW
**Location:** `docs/devops/ci-cd-pipeline.md:§7`
**Category:** Documentation accuracy

**Description:**
Pipeline Optimization table references `npm ci --prefer-official` — should be `npm ci --prefer-offline`.

**Remediation:**
Fix typo: `--prefer-official` → `--prefer-offline`.

### INFRA-012: Missing OCI standard labels in Dockerfile

**Severity:** LOW
**Location:** `app/Dockerfile` (all stages)
**Category:** Container best practices

**Description:**
Only `org.opencontainers.image.version` and `org.opencontainers.image.description` are set. Standard OCI labels like `org.opencontainers.image.source`, `org.opencontainers.image.created`, `org.opencontainers.image.revision`, and `org.opencontainers.image.licenses` are missing.

**Note:** The `docker/metadata-action@v5` in GitHub Actions adds labels at build time via `docker build-push-action`, partially mitigating this for CI-built images. However, locally-built images lack these labels.

**Remediation:**
Add standard OCI labels in the runner stage or rely on CI metadata injection:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/<org>/<repo>"
LABEL org.opencontainers.image.licenses="MIT"
```

---

## Positive Aspects

1. **Excellent multi-stage Docker build** — Three-stage build (deps → builder → runner) with proper layer separation. Only production-required files are copied to the runner stage, resulting in a minimal image.

2. **Non-root container execution** — The `nextjs` user (uid 1001) with proper `chown` and `USER` directive is correctly implemented.

3. **PostgreSQL version pinned** — `postgres:16.4-alpine` is a specific, pinned version (unlike the Node.js image).

4. **Comprehensive health check implementation** — The `/api/health` endpoint checks database connectivity and returns proper 200/503 status codes. The Docker health check for app correctly uses Node.js HTTP module (since Alpine doesn't include curl).

5. **Well-structured deployment pipeline** — The GitHub Actions workflow has proper job dependencies (validate → test → build → push → deploy), PR-only validation, and conditional production deployment.

6. **Auto-rollback on health check failure** — The deploy script includes a 60-second health check loop with automatic rollback to the previous image, including a fallback to rebuild if no previous image exists.

7. **Proper secrets management** — `.env` is in `.gitignore`, `.env.example` contains only placeholder values, API key generation command is documented (`openssl rand -hex 32`), and key rotation is supported via `API_KEY_SECONDARY`.

8. **Logging configuration** — Both services have `json-file` logging driver with `max-size: 10m` and `max-file: 3`, preventing disk exhaustion from log growth.

9. **Security headers** — Next.js config includes comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.) aligned with SR-05.

10. **Excellent documentation** — Deployment manifest, CI/CD pipeline, monitoring dashboard, and runbook are thorough, well-structured, and actionable. The production checklist and known limitations sections are particularly valuable.

---

## Quality Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Critical issues | 0 | 1 | ❌ |
| High priority issues | ≤ 3 | 4 | ❌ |
| Security requirements compliance | 100% | ~90% (SR-10.2 violated) | ❌ |
| Health checks configured | All services | All services | ✅ |
| Non-root container | Required | Implemented | ✅ |
| Multi-stage build | Required | 3 stages | ✅ |
| Secrets in code | 0 | 0 | ✅ |
| Documentation completeness | ≥ 90% | ~95% | ✅ |

---

## Iteration

- **infrastructure_review_iteration:** 1 / 3
- **Decision:** FAIL — Critical and high issues require remediation before proceeding.
