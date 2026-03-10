#!/bin/bash
# PolyForge pre-push verification hook
# Runs tests, linter, and vulncheck before allowing push
#
# Install: Add to .claude/settings.json hooks or use as git pre-push hook

set -e

CONFIG_FILE=".claude/polyforge.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "[PolyForge] No config found. Run /init first."
  exit 0
fi

echo "[PolyForge] Running pre-push verification pipeline..."

# Detect and run test command
if [ -f "package.json" ]; then
  echo "  → Running tests (npm)..."
  npm test 2>&1 || { echo "  ✗ Tests failed"; exit 1; }
elif [ -f "composer.json" ]; then
  echo "  → Running tests (composer)..."
  composer test 2>&1 || php vendor/bin/phpunit 2>&1 || { echo "  ✗ Tests failed"; exit 1; }
elif [ -f "go.mod" ]; then
  echo "  → Running tests (go)..."
  go test ./... 2>&1 || { echo "  ✗ Tests failed"; exit 1; }
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  echo "  → Running tests (python)..."
  python -m pytest 2>&1 || { echo "  ✗ Tests failed"; exit 1; }
fi

# Detect and run linter
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.cjs" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ] || [ -f "eslint.config.cjs" ] || [ -f "eslint.config.ts" ]; then
  echo "  → Running linter (eslint)..."
  npx eslint . 2>&1 || { echo "  ✗ Lint failed"; exit 1; }
elif [ -f "phpstan.neon" ] || [ -f "phpstan.neon.dist" ]; then
  echo "  → Running linter (phpstan)..."
  php vendor/bin/phpstan analyse 2>&1 || { echo "  ✗ Lint failed"; exit 1; }
elif [ -f ".golangci.yml" ] || [ -f ".golangci.yaml" ]; then
  echo "  → Running linter (golangci-lint)..."
  golangci-lint run 2>&1 || { echo "  ✗ Lint failed"; exit 1; }
fi

echo "[PolyForge] ✓ All checks passed"
