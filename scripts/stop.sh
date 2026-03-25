#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PIDS=$(pgrep -f "node src/server.js" || true)
if [ -z "${PIDS:-}" ]; then
  echo "[INFO] ATF is not running"
  exit 0
fi

while IFS= read -r pid; do
  [ -n "$pid" ] || continue
  kill "$pid"
  echo "[OK] Stopped ATF (PID: $pid)"
done <<< "$PIDS"

rm -f "$ROOT_DIR/aiToFuture.pid"
