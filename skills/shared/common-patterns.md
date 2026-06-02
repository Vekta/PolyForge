# Shared Patterns

## One Ticket = One PR

A single ticket is implemented end-to-end in **one branch and one PR**. A single
agent writes the whole ticket in one session — same author, same context — so
splitting it across PRs adds pure overhead (N branches, N descriptions, N CI runs,
forced stacking on cross-phase dependencies) and reduces nothing: it's the identical
code reorganized across branches.

- **Phases/layers are commit boundaries, not PR boundaries.** Preserve reviewability
  with clean, logically-grouped atomic commits inside the one PR.
- **Never proactively propose splitting one ticket into multiple PRs.** Do not offer a
  "how many PRs?" choice.
- **Genuine ambiguity still pauses** via the Step 1.5 actionable check / `AskUserQuestion`
  — ask only when the ticket is truly unclear, never to pick a PR count.
- **Multi-ticket parallel mode is unaffected.** `/smith #42 #43 #44` is legitimately
  many tickets → many PRs (one per ticket). This rule governs a *single* ticket.

**Narrow exceptions** (split one ticket only when one genuinely applies — and even then
surface it as a real decision via `AskUserQuestion`, never as the default):
- Phases ship to users independently / behind separate rollout gates.
- A phase is independently revertable/deployable and incremental rollout is explicitly wanted.
- Different owners are assigned to different phases.

## User Questions — AskUserQuestion ONLY

**Every interactive question in every PolyForge skill MUST use the `AskUserQuestion` tool.** No exceptions.

Banned formats (do NOT emit them in chat):
- Numbered inline choices: `(1) Yes (2) No`, `1. ... 2. ...`
- Letter choices: `(a) Merge (b) Replace`
- Yes/no prompts: `Proceed? (y/n)`, `Apply? (y/n/edit)`, `Continue? (y/n)`
- Markdown tables asking for confirmation
- Any other ad-hoc choice menu rendered as text

Correct pattern — one call per decision point:

```
AskUserQuestion({
  questions: [{
    question: "<short question>",
    header: "<≤12 char header>",
    multiSelect: false,
    options: [
      { label: "<short>", description: "<one-line detail>" },
      { label: "<short>", description: "<one-line detail>" },
      { label: "Other", description: "Let me describe a different option" }
    ]
  }]
})
```

Rules:
- ONE question per call — never batch multiple decisions
- Always include an "Other" option so the user can free-type
- Keep `header` ≤ 12 chars and `label` ≤ 5 words
- For free-form input (no fixed choices), still use AskUserQuestion with a single "Describe" option + "Other"
- Never pair a menu in chat with an AskUserQuestion — the tool IS the menu

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
| `build.gradle` / `pom.xml` | `./gradlew test 2>&1 \| bash hooks/filter-test-output.sh` or `mvn test 2>&1 \| bash hooks/filter-test-output.sh` |

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
- 🟡 Needs investigation → `/mark`
- 🔴 Pre-existing/infra → `/mark` tagged infra

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
