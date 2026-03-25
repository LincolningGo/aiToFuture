#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "[ERROR] .env not found. Please create it first (cp .env.example .env)."
  exit 1
fi

set -a
source ./.env
set +a

mkdir -p "$ROOT_DIR/logs"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm not found"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[INFO] Installing dependencies..."
  npm install
fi

run_db_init() {
  local status=0

  if [ -n "${DB_PASSWORD:-}" ]; then
    MYSQL_CNF_FILE="$(mktemp)"
    trap 'rm -f "$MYSQL_CNF_FILE"' EXIT

    cat > "$MYSQL_CNF_FILE" <<MYSQL_CNF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
MYSQL_CNF

    chmod 600 "$MYSQL_CNF_FILE"

    if ! mysql --defaults-extra-file="$MYSQL_CNF_FILE" < "$ROOT_DIR/scripts/init_db.sql"; then
      status=1
    fi

    rm -f "$MYSQL_CNF_FILE"
    trap - EXIT
  else
    if ! mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" < "$ROOT_DIR/scripts/init_db.sql"; then
      status=1
    fi
  fi

  return "$status"
}

if command -v mysql >/dev/null 2>&1; then
  echo "[INFO] Initializing database schema..."
  if run_db_init; then
    echo "[OK] Database init done"
  else
    echo "[WARN] Database init skipped (insufficient privilege or DB already managed externally)"
  fi
fi

if pgrep -f "node src/server.js" >/dev/null; then
  echo "[INFO] aiToFuture is already running"
  exit 0
fi

nohup npm run start > "$ROOT_DIR/logs/runtime.log" 2>&1 &
PID=$!
echo "$PID" > "$ROOT_DIR/aiToFuture.pid"

echo "[OK] aiToFuture started (PID: $PID)"
echo "[OK] URL: http://127.0.0.1:${PORT:-4002}"
echo "[OK] Log: $ROOT_DIR/logs/runtime.log"
