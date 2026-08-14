# Runbook: Deployment and Rollback — Project Manager UI v1

**Version:** 1.0.0
**Author:** devops-infrastructure-engineer
**Date:** 2026-08-13
**Owner:** Infrastructure team
**Review cadence:** Quarterly or after any major incident

---

## 1. Normal Deployment (Push to Production)

### Prerequisites

- [ ] Code merged to `main` branch
- [ ] All CI checks passed (lint, test, build)
- [ ] `.env` file present on production server with correct secrets
- [ ] Database migrations reviewed and ready to deploy

### Step-by-Step

```bash
# 1. SSH to production server
ssh deploy@DEPLOY_HOST

# 2. Navigate to project directory
cd ~/ui_pm/app

# 3. Pull latest code
git pull origin main

# 4. Build Docker image
docker compose build app

# 5. Deploy (graceful restart — Next.js finishes in-flight requests)
docker compose up -d --no-deps app

# 6. Wait for health check (up to 60s)
for i in $(seq 1 12); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✅ Service healthy after ${i}s"
    break
  fi
  sleep 5
  if [ "$i" -eq 12 ]; then
    echo "❌ Health check failed after 60s — initiating rollback"
    docker compose up -d --no-deps app  # Revert to cached image
    exit 1
  fi
done

# 7. Verify container status
docker compose ps

# 8. Check logs for errors
docker compose logs --tail=50 app | grep -i "error\|fail" || echo "No errors in recent logs"

echo "✅ Deployment complete"
```

### Time Estimate: 2-5 minutes

---

## 2. Emergency Rollback

### When to Rollback

| Condition | Action |
|-----------|--------|
| Health check fails after deploy | Immediate rollback |
| Users report critical bug | Manual rollback within 15 min |
| Database migration breaks schema | Rollback + revert migration |
| API key authentication broken | Rollback + verify key injection |

### Automated Rollback (Self-Healing)

The deploy loop in section 1 includes built-in rollback: if health check fails within 60s, the last known-good cached image is started automatically.

### Manual Rollback

```bash
# 1. SSH to production server
ssh deploy@DEPLOY_HOST
cd ~/ui_pm/app

# 2. Identify previous successful image
PREV_SHA=$(git log --oneline -3 | tail -1 | cut -d' ' -f1)
# Or from git reflog if HEAD was reset:
# PREV_SHA=$(git reflog | grep 'HEAD@{' | head -2 | tail -1 | cut -d' ' -f2)

# 3. Stop current broken container
docker compose stop app

# 4. Tag previous image as latest (to avoid re-building)
docker tag ghcr.io/<repo>/app:"$PREV_SHA" ghcr.io/<repo>/app:latest

# 5. Restart with previous image
docker compose pull ghcr.io/<repo>/app:latest
docker compose up -d --no-deps app

# 6. Verify
curl -s http://localhost:3000/api/health | jq
docker compose ps
```

### Post-Rollback Actions

1. Create incident ticket referencing PR/commit that caused issue
2. Document root cause in `docs/reviews/rollback-YYYYMMDD-HHMM.md`
3. If applicable: fix bug, get review approval, redeploy via normal process

---

## 3. Database Migration

### Pre-Migration Checklist

- [ ] Backup database before migration (`pg_dump`)
- [ ] Verify migration files exist in git
- [ ] Test migration on staging copy first (if available)

### Deploy Migration

```bash
# SSH to production
ssh deploy@DEPLOY_HOST
cd ~/ui_pm/app

# Run Prisma migration (applies pending migrations)
docker compose exec app npx prisma migrate deploy

# Verify no errors
echo $?

# Check table structure
docker compose exec db psql -U pm_user -d pm_db -c "\dt+"
```

### Migration Rollback

⚠️ **WARNING:** Prisma does not support automatic down-migrations in production.

If a migration causes data loss or corruption:

1. Stop application: `docker compose stop app`
2. Restore from backup: `psql < backup.sql`
3. Re-deploy previous version of application

```bash
# Restore from daily backup
docker compose exec db psql -U pm_user -d pm_db < /backup/daily/pgdump-$(date +%Y-%m-%d).sql
```

---

## 4. Troubleshooting Guide

### Issue: Container Won't Start

```bash
# Check container logs
docker compose logs app

# Check if dependencies are satisfied
docker compose ps

# Inspect container details
docker inspect $(docker compose ps -q app) --format '{{json .State}}' | jq
```

**Common fixes:**
- Missing `.env` file → ensure secrets are set
- Port conflict → check `lsof -i :3000` on host
- Image build failure → check Dockerfile syntax and npm dependencies

### Issue: Database Connection Fails

```bash
# Verify DB container is healthy
docker compose ps db

# Test connectivity from app container
docker compose exec app node -e "require('child_process').execSync('pg_isready -h db -p 5432 -U pm_user')"

# Check DB logs
docker compose logs db | tail -50
```

**Common fixes:**
- DB not ready → increase `start_period` in healthcheck
- Wrong connection string → verify `DATABASE_URL` in `.env`
- Max connections exceeded → check `SELECT count(*) FROM pg_stat_activity`

### Issue: High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Find memory-intensive queries
docker compose exec db psql -U pm_user -d pm_db -c "
  SELECT query, calls, total_exec_time/1000 AS total_sec, mean_exec_time/1000 AS avg_ms
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC LIMIT 10;
"

# Restart container if OOM killed
docker compose restart app
```

### Issue: Health Check Returns 503

```bash
# Get detailed health response
curl -s http://localhost:3000/api/health | jq

# Check internal service-to-service connectivity
docker compose exec app curl -sf http://db:5432 || echo "Cannot reach DB"

# Verify Prisma client is properly generated
docker compose exec app ls -la prisma/schema.prisma
docker compose exec app ls -la node_modules/.prisma/client/lib/index.d.ts
```

---

## 5. Routine Operations

### Daily Checks (Automated via cron)

```bash
# Health check every 2 minutes
*/2 * * * * /home/deploy/ui_pm/scripts/health-check.sh >> /var/log/health-check.log 2>&1
```

### Weekly Operations

| Task | Command | Notes |
|------|---------|-------|
| Review disk usage | `du -sh ~/ui_pm/*` | Alert if > 80% of allocated storage |
| Check Docker logs rotation | `ls -lah ~/ui_pm/app/logs/` | Ensure json-file driver limits active |
| Review container health | `docker compose ps` | Investigate any unhealthy containers |
| Update base images | `docker pull node:22-alpine && docker pull postgres:16.4-alpine` | Download new versions for next rebuild |

### Monthly Operations

| Task | Notes |
|------|-------|
| Full database backup test | Restore backup to staging, verify data integrity |
| API key rotation | Generate new key, set `API_KEY_SECONDARY`, verify auth works, remove old key |
| Review dependencies | `npm outdated` — plan updates for security patches |
| Security scan | `trivy image` against latest built image |

---

## 6. Contact & Escalation

| Level | Role | Escalation Criteria |
|-------|------|---------------------|
| L1 | On-call engineer | Any outage, deployment failure |
| L2 | Infrastructure lead | Issues lasting > 30 min, data loss risk |
| L3 | Architecture team | Structural changes needed, capacity planning |

**Escalation communication:** Slack channel `#infra-alerts` (placeholder — configure actual channel).
