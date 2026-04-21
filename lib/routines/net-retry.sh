#!/usr/bin/env bash
# Exponential backoff wrapper for network ops (gh, git push). Max 3 attempts.
# Usage: source net-retry.sh && with_retry gh pr create ...
set -u

with_retry() {
  local max_attempts=3
  local attempt=1
  local delay=2
  while [ $attempt -le $max_attempts ]; do
    if "$@"; then return 0; fi
    local rc=$?
    echo "[net-retry] attempt $attempt/$max_attempts failed (rc=$rc): $*" >&2
    if [ $attempt -eq $max_attempts ]; then return $rc; fi
    sleep $delay
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

export -f with_retry 2>/dev/null || true
