#!/usr/bin/env bash
# Redis durability smoke test for the Bounty marketplace.
#
# Proves the write-through + hydration layer is real:
#   1. Boot the app with REDIS_URL (loaded from .env by Next).
#   2. Wait until Redis is actually CONNECTED (not just "configured").
#   3. POST a bounty with a unique marker — a record that is NOT in the fixture seed.
#   4. Kill the server and boot a fresh process (in-memory state is wiped).
#   5. Fetch the marker bounty by id. It can only exist if it was mirrored to
#      Redis and restored by boot-time hydration => durability proven.
#
# Run from the repo root.  Exit 0 = PASS, 1 = FAIL.
set -uo pipefail

PORT=3137
BASE="http://localhost:${PORT}"
LOG1="/tmp/roko-dev-boot1.log"
LOG2="/tmp/roko-dev-boot2.log"
RESULT="/tmp/roko-smoke-result.txt"
MARKER="redis-smoke-$(date +%s)"

: > "$RESULT"
log() { echo "$@" | tee -a "$RESULT"; }

# Kill whatever is listening on $PORT (Windows-safe, via PowerShell taskkill).
cleanup_port() {
  powershell.exe -NoProfile -Command \
    "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -Expand OwningProcess -Unique | ForEach-Object { taskkill /F /T /PID \$_ }" \
    >/dev/null 2>&1 || true
}

# Poll a seed-triggering route until the server answers (this also kicks off Redis init).
wait_ready() {
  for _ in $(seq 1 60); do
    if curl -sf "${BASE}/api/bounties" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

# Poll /api/health until redis == connected (or give up).
wait_redis_connected() {
  for _ in $(seq 1 20); do
    local h; h=$(curl -s "${BASE}/api/health" 2>/dev/null)
    if printf '%s' "$h" | grep -q '"redis":"connected"'; then return 0; fi
    sleep 2
  done
  return 1
}

log "== Roko Redis durability smoke test =="
log "marker: ${MARKER}  port: ${PORT}"

# ---------- Boot 1 ----------
cleanup_port
( npm run dev -- -p "$PORT" >"$LOG1" 2>&1 ) &
log "[boot1] starting dev server, waiting for ready..."
if ! wait_ready; then log "FAIL: server 1 never became ready (see $LOG1)"; cleanup_port; exit 1; fi

if wait_redis_connected; then
  log "[boot1] redis status: connected"
else
  log "FAIL: Redis never reached 'connected'. health: $(curl -s "${BASE}/api/health")"
  log "       (likely a bad/credential-less REDIS_URL — check .env line 27)"
  cleanup_port; exit 1
fi

# ---------- Create non-seeded marker bounty ----------
CREATE=$(curl -s -X POST "${BASE}/api/bounties" -H 'Content-Type: application/json' \
  -d "{\"title\":\"${MARKER}\",\"description\":\"Durability marker ${MARKER} - find 5 example fintech companies\",\"reward\":42}")
BID=$(printf '%s' "$CREATE" | grep -o '"bountyId":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')
if [ -z "$BID" ]; then log "FAIL: could not create bounty. resp: $CREATE"; cleanup_port; exit 1; fi
log "[boot1] created non-seeded bounty id=${BID}"

PRE=$(curl -s "${BASE}/api/bounties/${BID}")
log "[boot1] pre-restart fetch ok=$(printf '%s' "$PRE" | grep -o '"ok":[a-z]*' | head -1)"

log "[boot1] waiting 3s for fire-and-forget mirror to flush to Redis..."
sleep 3

# ---------- Restart ----------
log "[restart] killing server 1..."
cleanup_port
sleep 3

( npm run dev -- -p "$PORT" >"$LOG2" 2>&1 ) &
log "[boot2] starting fresh dev server (in-memory wiped), waiting for ready..."
if ! wait_ready; then log "FAIL: server 2 never became ready (see $LOG2)"; cleanup_port; exit 1; fi
wait_redis_connected && log "[boot2] redis status: connected"
sleep 2

POST=$(curl -s "${BASE}/api/bounties/${BID}")
log "[boot2] post-restart fetch of ${BID} -> ok=$(printf '%s' "$POST" | grep -o '"ok":[a-z]*' | head -1)"
log "[boot2] hydration/redis log lines from fresh boot:"
grep -iE 'hydrat|\[redis' "$LOG2" | sed 's/^/    /' | tee -a "$RESULT" || true

cleanup_port

if printf '%s' "$POST" | grep -q "$MARKER"; then
  log "RESULT: PASS - non-seeded bounty survived a full server restart via Redis hydration."
  exit 0
else
  log "RESULT: FAIL - marker bounty was gone after restart. resp: $POST"
  exit 1
fi
