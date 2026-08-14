# CI/CD Pipeline — Project Manager UI v1

**Version:** 1.0.0
**Author:** devops-infrastructure-engineer
**Date:** 2026-08-13
**Platform:** GitHub Actions
**Pipeline Type:** Push-to-deploy (single-server)

---

## 1. Pipeline Overview

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────────┐
│  Push to  │────►│  Lint +     │────►│  Build +  │────►│  Docker     │
│  main     │     │  Test       │     │  Prisma   │     │  Push Image │
└──────────┘     └─────────────┘     └──────────┘     └──────┬──────┘
                                                             │
                                                    ┌──────▼──────┐
                                                    │ Deploy to   │
                                                    │ Server      │
                                                    └─────────────┘
```

### Branch Strategy

| Branch | Purpose | Pipeline Trigger | Deployment Target |
|--------|---------|------------------|-------------------|
| `main` | Production code | push, PR merge | Production server |
| `develop` | Integration branch | pull_request | Staging (manual) |
| Feature branches | Feature development | pull_request | Preview (no deploy) |

## 2. Pipeline Stages

### Stage 1: Validate (Lint + Type Check)

| Step | Command | Timeout |
|------|---------|---------|
| Install dependencies | `npm ci --prefer-offline` | 5 min |
| TypeScript type check | `npx tsc --noEmit` | 2 min |
| ESLint | `npm run lint` | 3 min |

**Fail criteria:** Any lint error or type error blocks the pipeline.

### Stage 2: Test

| Step | Command | Timeout |
|------|---------|---------|
| Run unit tests | `npm test` | 5 min |
| Coverage gate | Coverage ≥ 80% (configurable) | N/A |

**Fail criteria:** Tests fail or coverage below threshold.

### Stage 3: Build & Security Scan

| Step | Command | Timeout |
|------|---------|---------|
| Build Next.js app | `npm run build` | 5 min |
| Prisma generate | `npx prisma generate` | 1 min |
| Trivy image scan | `trivy image --severity HIGH,CRITICAL node:22-alpine` | 5 min |

**Fail criteria:** Build fails, Prisma generates errors, or critical/trivial vulnerabilities found.

### Stage 4: Docker Build & Push

| Step | Command | Timeout |
|------|---------|---------|
| Login to GHCR | `docker login ghcr.io -u ${{ github.actor }} -p ${{ secrets.GITHUB_TOKEN }}` | 1 min |
| Build multi-stage image | `docker compose build app` | 10 min |
| Tag image | `ghcr.io/${{ github.repository }}/app:${{ github.sha }}` | N/A |
| Push image | `docker push` | 5 min |

### Stage 5: Deploy

| Step | Action | Timeout |
|------|--------|---------|
| SSH to server | Connect via secrets | 1 min |
| Pull new image | `docker pull ghcr.io/...` | 2 min |
| Update compose | `docker compose config` validates YAML | 1 min |
| Graceful restart | `docker compose up -d --no-deps app` | 2 min |
| Health check | Poll `/api/health` until healthy (max 60s) | 60s |
| Migration check | Verify schema matches database | 30s |

**Rollback trigger:** If health check fails after 60s → automatic rollback to previous image.

## 3. Workflow File: `.github/workflows/deploy.yml`

Full implementation in `.github/workflows/deploy.yml`.

### Matrix configuration

```yaml
strategy:
  matrix:
    node-version: [22]
    postgres-version: [16]
```

### Secrets required

| Secret | Description | Generation |
|--------|-------------|------------|
| `DEPLOY_HOST` | SSH hostname/IP of production server | Server admin |
| `DEPLOY_USER` | SSH user (e.g., `deploy`) | Server admin |
| `DEPLOY_KEY` | SSH private key (PEM format) | `ssh-keygen` |
| `DB_PASSWORD` | PostgreSQL password for migrations | `openssl rand -base64 32` |
| `API_KEY` | Agent API key | `openssl rand -hex 32` |
| `JWT_SECRET` | JWT signing secret for browser auth | `openssl rand -hex 48` |
| `TEST_DATABASE_URL` | Test database connection string (CI only) | Per-environment |

**JWT_SECRET note:** Required in all environments (build, test, deploy). If not set in CI secrets, the build will fail because the session module validates JWT_SECRET at module load time. For local testing, use `.env` or set a placeholder ≥ 96 hex characters.

### Environment variables required

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | Connection string for migration | Generated from secrets |
| `CORS_ALLOWED_ORIGINS` | Allowed origins list | Server admin |

## 4. Deployment Strategies

### Current (v1): Direct Deploy

Single-server with `docker compose up -d`. No load balancer, no zero-downtime.

**Downtime estimate:** ~5-15 seconds during container swap.

### Future (v2): Rolling Update

If multiple app replicas are added:

1. Build image → tag as latest + SHA
2. Start new replica with new image
3. Wait for health check → healthy
4. Stop old replica
5. Repeat for each replica

**Downtime estimate:** 0 seconds (one replica at a time).

### Blue-Green (planned for v2)

1. Deploy new version to idle environment
2. Health check passes
3. Switch load balancer pointer
4. Old environment becomes standby

## 5. Rollback Procedure

### Automatic (in pipeline)

If the post-deploy health check fails within 60 seconds:

```bash
# 1. Identify previous successful image
PREV_IMAGE=$(docker images --filter "reference=app" --format '{{.Repository}}:{{.Tag}}' | grep -v 'latest' | sort | tail -2 | head -1)

# 2. Revert to previous image
docker compose pull "$PREV_IMAGE"
docker compose up -d --no-deps app

# 3. Alert on failure
echo "AUTO-ROLLBACK: reverted to $PREV_IMAGE due to health check failure"
```

### Manual

```bash
# 1. SSH to server
ssh deploy@DEPLOY_HOST

# 2. Check current status
cd ~/ui_pm/app && docker compose ps

# 3. Rollback to specific image
docker pull ghcr.io/<repo>/app:v1.0.0
docker compose up -d --no-deps app

# 4. Verify
curl -s http://localhost:3000/api/health | jq
```

## 6. Monitoring Integration

The pipeline reports results back to GitHub checks:

| Status | Visual | Notification |
|--------|--------|-------------|
| ✅ All stages passed | Green check | None |
| ⚠️ Warnings (lint) | Yellow circle | GitHub comment |
| ❌ Failed stage | Red X | Email / Slack webhook |
| 🔄 Deploy failed | Red X with rollback icon | Immediate alert |

## 7. Pipeline Optimization

| Optimization | Impact |
|--------------|--------|
| `npm ci --prefer-offline` | Faster install than `npm install` when lockfile is present |
| Multi-stage Docker build | Smaller final image (~150MB vs ~500MB single-stage) |
| Prisma pre-generated in Dockerfile | No Prisma install needed in runner stage |
| Layer caching (`node_modules` cached) | Subsequent builds skip dependency install |
| Parallel job execution | Lint, test, build run in parallel where possible |
| `prisma migrate deploy` at runtime | No DB schema changes in CI image |

## 8. Future Enhancements

| Enhancement | Priority | Description |
|-------------|----------|-------------|
| GitHub Environments | High | Add staging/prod environment gates with approval |
| Semantic versioning | High | Auto-tag releases, use semver for images |
| Database backup before deploy | Medium | Pre-deploy pg_dump, post-deploy restore if rollback needed |
| Canary deployment | Low | Route 10% traffic to new version first |
| Helm/K8s manifests | Low | Container orchestration for multi-replica |
| Terraform IaC | Medium | Provision server infrastructure automatically |
