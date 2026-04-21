#!/usr/bin/env bash
# PolyForge routine runner — invoked by launchd or manually via /polyforge-routines-manage run-now
# Usage: polyforge-routine-runner.sh <routine-name> <project-root> [--dry] [--run-now]
set -euo pipefail

ROUTINE_NAME="${1:-}"
PROJECT_ROOT="${2:-}"
shift 2 || true

DRY=""
RUN_NOW=""
for arg in "$@"; do
  case "$arg" in
    --dry) DRY="--dry" ;;
    --run-now) RUN_NOW="--run-now" ;;
  esac
done

if [ -z "$ROUTINE_NAME" ] || [ -z "$PROJECT_ROOT" ]; then
  echo "Usage: $0 <routine-name> <project-root> [--dry] [--run-now]" >&2
  exit 2
fi

if [ ! -d "$PROJECT_ROOT" ]; then
  echo "Project root does not exist: $PROJECT_ROOT" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin"

# caffeinate prevents sleep during the run
exec caffeinate -i node "$SCRIPT_DIR/polyforge.js" _routine-run \
  --name "$ROUTINE_NAME" \
  --project "$PROJECT_ROOT" \
  ${DRY:+--dry} \
  ${RUN_NOW:+--run-now}
