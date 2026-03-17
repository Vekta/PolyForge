# Shared Patterns

## Verification Pipeline

Read `project.stack`, `project.testFrameworks`, and `project.linters` from pre-loaded `polyforge.json`. If not configured, auto-detect from project files and run ALL applicable tools:

### Tests

| Detected by | Command |
|---|---|
| `package.json` | `npm test 2>&1 \| bash hooks/filter-test-output.sh` |
| `composer.json` | `composer test 2>&1 \| bash hooks/filter-test-output.sh` or `php vendor/bin/phpunit 2>&1 \| bash hooks/filter-test-output.sh` |
| `go.mod` | `go test ./... 2>&1 \| bash hooks/filter-test-output.sh` |
| `requirements.txt` / `pyproject.toml` | `python -m pytest 2>&1 \| bash hooks/filter-test-output.sh` |
| `Gemfile` | `bundle exec rspec 2>&1 \| bash hooks/filter-test-output.sh` |
| `build.gradle` / `pom.xml` | `./gradlew test` or `mvn test` |

### Linting

| Detected by | Command |
|---|---|
| `.eslintrc.*` / `eslint.config.*` | `npx eslint .` |
| `biome.json` / `biome.jsonc` | `npx biome check .` |
| `.prettierrc*` | `npx prettier --check .` |
| `phpstan.neon*` | `php vendor/bin/phpstan analyse` |
| `phpcs.xml*` / `.phpcs.xml*` | `php vendor/bin/phpcs` |
| `.golangci.yml` / `.golangci.yaml` | `golangci-lint run` |
| `.flake8` / `setup.cfg` (flake8) | `flake8 .` |
| `pyproject.toml` (ruff) | `ruff check .` |
| `.rubocop.yml` | `bundle exec rubocop` |

### Type Checking

| Detected by | Command |
|---|---|
| `tsconfig.json` | `npx tsc --noEmit` |
| `pyproject.toml` (mypy) / `mypy.ini` | `mypy .` |
| `pyproject.toml` (pyright) | `pyright` |
| `phpstan.neon*` | _(covered by linting above)_ |

### Security / Vulnerability Check

| Detected by | Command |
|---|---|
| `package.json` | `npm audit --audit-level=high` |
| `composer.json` | `composer audit` |
| `go.mod` | `govulncheck ./...` |
| `requirements.txt` / `pyproject.toml` | `pip-audit` or `safety check` |
| `Gemfile.lock` | `bundle audit check` |

### Execution rules

Run **all** matching tools — a project can have both ESLint and TypeScript, or PHPStan and PHPCS. Fix failures automatically (max 2 retries). Same error + same approach twice → switch strategy. After 3 total attempts, categorize:
- 🟢 Quick fix → fix now
- 🟡 Needs investigation → `/report-issue`
- 🔴 Pre-existing/infra → `/report-issue` tagged infra

## Circuit Breaker

- Max 3 attempts on any operation — then switch strategy or report
- Same error twice with same fix → different approach
- Environment/permissions issues → report immediately, cannot fix in code

## Diff Exclusions

Always exclude from diffs: `':!*.lock' ':!vendor/' ':!node_modules/' ':!*.generated.*'`

## Subagent Rules

- Spawn only when complexity justifies overhead (see per-skill thresholds)
- Return structured JSON only — no prose, no markdown
- Max 3 concurrent subagents per skill
- Max 10 tool calls per subagent unless specified otherwise
- Never read `vendor/`, `node_modules/`, or framework internals

## Context

- `polyforge.json` and `CLAUDE.md` are pre-loaded — skills must NOT re-read them
- Compact after each deliverable (report, PR, doc, plan)
- State files go in `tmp/` for cross-compact persistence
