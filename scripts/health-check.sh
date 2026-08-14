#!/bin/bash
# Health check script for Project Manager UI v1
# Usage: ./scripts/health-check.sh
# Can be run via cron: */2 * * * * /home/deploy/ui_pm/scripts/health-check.sh >> /var/log/health-check.log 2>&1

set -euo pipefail

APP_URL="http://localhost:3000/api/health"
AUTH_URL="http://localhost:3000/api/auth/me"
MAX_RETRIES=3
RETRY_INTERVAL=5
LOG_FILE="/var/log/health-check.log"
STATE_FILE="/tmp/.ui-pm-health-alerted"

log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%dT%H:%M:%S%z')
    echo "$timestamp $1" | tee -a "$LOG_FILE"
}

# Recovery detection: persist alert state across invocations using a state file (FIX INFRA-008)
ALERT_SENT=false
if [ -f "$STATE_FILE" ]; then
    ALERT_SENT=true
fi

check_health() {
    # MEDIUM FIX (INFRA-009): Added --max-time 10 to prevent curl from hanging on unresponsive endpoints
    local STATUS
    STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")

    if [ "$STATUS" = "200" ]; then
        # AUTH-INFRA-001: Verify auth endpoint returns 401 (not 500) without credentials.
        # A 500 here means JWT_SECRET is misconfigured or session module crashed.
        local AUTH_STATUS
        AUTH_STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$AUTH_URL" 2>/dev/null || echo "000")

        if [ "$AUTH_STATUS" != "401" ] && [ "$AUTH_STATUS" != "200" ]; then
            log "[WARN] Auth endpoint returned HTTP $AUTH_STATUS (expected 401 or 200) — possible JWT_SECRET issue"
        else
            log "[OK] Auth endpoint healthy (HTTP $AUTH_STATUS)"
        fi
        return 0
    fi

    # Get detailed response for logging
    local BODY
    BODY=$(curl -sf --max-time 10 "$APP_URL" 2>/dev/null || echo "unreachable")
    echo "$BODY" | python3 -m json.tool 2>/dev/null || true

    return 1
}

for i in $(seq 1 $MAX_RETRIES); do
    if check_health; then
        if [ "$ALERT_SENT" = true ]; then
            # Recovery detected: remove state file and log recovery
            rm -f "$STATE_FILE"
            log "[OK] Service recovered after outage (resolved on attempt $i)"
        else
            log "[OK] Service healthy"
        fi
        exit 0
    fi

    if [ "$i" -eq "$MAX_RETRIES" ] && [ "$ALERT_SENT" = false ]; then
        # First alert — create state file for recovery detection
        touch "$STATE_FILE"
        log "[ALERT] Service unhealthy after ${MAX_RETRIES} attempts — HTTP status check failed"
        ALERT_SENT=true
        exit 1
    fi

    sleep $RETRY_INTERVAL
done

exit 1
