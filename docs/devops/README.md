# Infrastructure & DevOps Documentation

Project Manager UI v1 — deployment infrastructure, CI/CD pipeline, monitoring, and operational runbooks.

## Files

| File | Description |
|------|-------------|
| [`deployment-manifest.md`](deployment-manifest.md) | Deployment architecture, services, environments, commands |
| [`ci-cd-pipeline.md`](ci-cd-pipeline.md) | CI/CD pipeline stages, strategies, rollback procedures |
| [`monitoring-dashboard.md`](monitoring-dashboard.md) | Health checks, metrics, alerting rules, log rotation |
| [`runbook-infra-001_deployment_and_rollback.md`](runbook-infra-001_deployment_and_rollback.md) | Step-by-step deploy, rollback, troubleshooting procedures |
| [`runbook-infra-001_auth-troubleshooting.md`](runbook-infra-001_auth-troubleshooting.md) | JWT authentication issues: missing secret, CORS credentials, token expiration, rate limiting |

## Source Configuration

| File | Purpose |
|------|---------|
| [`../app/Dockerfile`](../app/Dockerfile) | Multi-stage Docker build (deps → builder → runner, non-root) |
| [`../app/docker-compose.yml`](../app/docker-compose.yml) | Service orchestration (app + postgres, internal network) |
| [`../app/.env.example`](../app/.env.example) | Environment variable template with placeholder values |
| [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | GitHub Actions CI/CD workflow |

## Quick Start

```bash
# 1. Copy .env with real secrets
cp app/.env.example app/.env
vim app/.env  # fill in DB_PASSWORD, API_KEY

# 2. Deploy locally
cd app && docker compose up -d --build

# 3. Run migrations
docker compose exec app npx prisma migrate deploy

# 4. Verify health
curl http://localhost:3000/api/health | jq
```

## Production Prerequisites

| Requirement | How to Set |
|-------------|------------|
| SSH access to server | Configure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY` as GitHub secrets |
| Database password ≥ 16 chars | `openssl rand -base64 32` |
| API key 256 bits random | `openssl rand -hex 32` |
| JWT Secret ≥ 96 hex chars | `openssl rand -hex 48` — required by session module at startup |
| CORS origins restricted | No wildcards (`*`) in `CORS_ALLOWED_ORIGINS` |
| Image registry credentials | GHCR uses `GITHUB_TOKEN` automatically |
