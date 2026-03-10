#!/bin/bash
# PolyForge pre-commit hook
# Blocks commits with .env files and runs tests

set -e

# Block .env files from being committed
STAGED_ENV=$(git diff --cached --name-only | grep -E '\.env(\..+)?$' || true)
if [ -n "$STAGED_ENV" ]; then
  echo "[PolyForge] Blocked: .env files must not be committed:"
  echo "$STAGED_ENV"
  echo "Add them to .gitignore instead."
  exit 1
fi

# Run tests
if [ -f "package.json" ]; then
  npm test 2>&1 || { echo "[PolyForge] Tests failed — commit blocked"; exit 1; }
elif [ -f "composer.json" ]; then
  composer test 2>&1 || php vendor/bin/phpunit 2>&1 || { echo "[PolyForge] Tests failed — commit blocked"; exit 1; }
elif [ -f "go.mod" ]; then
  go test ./... 2>&1 || { echo "[PolyForge] Tests failed — commit blocked"; exit 1; }
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  python -m pytest 2>&1 || { echo "[PolyForge] Tests failed — commit blocked"; exit 1; }
fi

echo "[PolyForge] ✓ Pre-commit checks passed"
