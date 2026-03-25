#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v rg >/dev/null 2>&1; then
  echo "[ERROR] rg is required for security check"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] git is required for security check"
  exit 1
fi

mapfile -t files < <(git ls-files | rg -v '^\.env\.example$')
if [ "${#files[@]}" -eq 0 ]; then
  echo "[OK] no tracked files to scan"
  exit 0
fi

PATTERN='(DB_PASSWORD\s*=\s*[^\s]+|DB_PASS\s*=\s*[^\s]+|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,})'
MATCHES=$(rg -n --no-heading -S "$PATTERN" "${files[@]}" || true)

if [ -n "$MATCHES" ]; then
  echo "[ERROR] potential secrets found in tracked files:"
  echo "$MATCHES"
  exit 1
fi

echo "[OK] no obvious secrets found in tracked files"
