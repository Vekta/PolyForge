# PolyForge — Architecture & Design Context

> Detailed reference for Claude Code sessions. See `CLAUDE.md` for the short summary.

---

## 1. Project Overview

PolyForge is a Node.js CLI tool distributed via npm under the package name `polyforgeai`. It extends Claude Code with a set of slash commands ("skills") that automate common software development workflows: feature implementation, bug fixing, CI diagnosis, PR review, code analysis, documentation generation, and more.

**Distribution model:** Users run `npx polyforge install` (or install globally). The CLI symlinks the package's `skills/` and `rules/` directories into `~/.claude/skills/` and `~/.claude/rules/`, making them available to every Claude Code session on that machine. No source files are copied — the symlinks point directly into the npm package directory, so `npx polyforge update` (uninstall + reinstall) always picks up the latest version.

**Package metadata:**
- npm name: `polyforgeai`
- Current version: `0.4.0`
- Entry point: `bin/polyforge.js`
- Node.js requirement: `>=18.0.0`
- Module system: ESM (`"type": "module"`)
- Zero runtime dependencies

**Files included in the npm package** (`files` field in `package.json`):
```
bin/
skills/
rules/
hooks/
templates/
LICENSE
```

---

## 2. Architecture

### Directory structure

```
polyforge/
├── bin/
│   └── polyforge.js          # CLI entry point
├── skills/
│   ├── assay/SKILL.md            # /assay
│   ├── blueprint/SKILL.md        # /blueprint
│   ├── embers/SKILL.md           # /embers (light/cast/watch/tend sub-procedures)
│   ├── engrave/SKILL.md          # /engrave
│   ├── fold/SKILL.md             # /fold
│   ├── hallmark/SKILL.md         # /hallmark
│   ├── init/SKILL.md             # invoked as /forge
│   ├── mark/SKILL.md             # /mark
│   ├── probe/SKILL.md            # /probe
│   ├── quench/SKILL.md           # /quench
│   ├── sketch/SKILL.md           # /sketch
│   ├── smith/SKILL.md            # /smith (merges former feature + fix)
│   ├── temper/SKILL.md           # /temper
│   └── shared/
│       ├── common-patterns.md
│       ├── issue-default.md
│       ├── pr-default.md
│       └── pr-template-guide.md
├── rules/
│   ├── golden-principles.md
│   ├── security.md
│   └── testing.md
├── hooks/
│   ├── filter-ci-logs.sh
│   ├── filter-test-output.sh
│   ├── pre-commit-check.sh
│   └── pre-push-verify.sh
├── templates/
│   ├── CLAUDE.md.template
│   └── polyforge.config.json
└── tests/
    └── cli.test.js
```

### How the parts fit together

1. **Install time:** `bin/polyforge.js install` creates symlinks in `~/.claude/skills/polyforge-<name>` and `~/.claude/rules/polyforge-<name>`. All entries get the `polyforge-` prefix to namespace them and enable clean uninstall.

2. **Session time:** Claude Code loads skills from `~/.claude/skills/` and rules from `~/.claude/rules/` at startup. PolyForge skills are available as slash commands immediately.

3. **Project setup:** Running `/forge` in a project creates `.claude/polyforge.json` (project config), a `CLAUDE.md`, and optional `.claude/rules/` files scoped to the project.

4. **Per-session context:** `polyforge.json` and `CLAUDE.md` are pre-loaded by Claude Code. Skills read from these without re-reading the files.

---

## 3. Skill System

### What a skill is

A skill is a directory under `skills/` containing exactly one `SKILL.md` file. The filename is mandatory — Claude Code discovers skills by looking for `SKILL.md` in skill directories. There is no JavaScript or executable code inside a skill; behavior is entirely expressed in markdown instructions.

### Frontmatter

Every `SKILL.md` begins with YAML frontmatter:

```yaml
---
name: <command-name>
description: Use when <trigger condition>. <what it does>.
---
```

The `name` field maps to the slash command (e.g., `name: fix-ci` → `/quench`). The `description` is the text Claude Code uses to match user intent to the correct skill. All descriptions start with "Use when" followed by natural-language trigger phrases.

### Skill loading at install

During `polyforge install`, each skill directory (e.g., `skills/quench/`) is symlinked as `~/.claude/skills/polyforge-quench`. The entire directory is linked — Claude Code reads `SKILL.md` from within it.

### Shared resources

`skills/shared/` contains files referenced by multiple skills via `@skills/shared/<file>` syntax:

- `common-patterns.md` — verification pipeline, circuit breaker rules, subagent constraints, context management
- `pr-template-guide.md` — how to detect and respect existing PR templates
- `pr-default.md` — default PR body when no template exists
- `issue-default.md` — default issue body when no template exists

Skills reference these with `@` notation (e.g., `Follow @skills/shared/common-patterns.md`).

### Subagent pattern

Several skills spawn subagents for expensive work. The conventions are:
- Model: `[model: haiku]` for detection/classification, `[model: sonnet]` for analysis/implementation
- Subagents return structured JSON only — no prose, no markdown
- Maximum 3 concurrent subagents per skill
- Maximum 10 tool calls per subagent (unless the skill specifies otherwise)
- Subagents never read `vendor/`, `node_modules/`, or framework internals
- Raw subagent output is discarded after JSON extraction

### Autonomy modes

Skills that modify code (`/smith`, `/smith`) respect a project-level autonomy setting from `.claude/polyforge.json`:
- `"full"` — implement directly without showing diffs
- `"semi"` — show diff preview per layer and ask "Continue? (y/n/edit)" before applying

Individual commands can override with `--auto`.

### State files

Long-running skills save state to `tmp/` (e.g., `tmp/state-{issue}.json`, `tmp/ci-state-{branch}.json`) to survive context compaction. After saving state, skills compact conversation and reload from the file.

### Circuit breaker

All skills follow the circuit breaker from `common-patterns.md`:
- Max 3 attempts on any operation
- Same error twice with same fix → switch strategy
- Environment or permissions issues → report immediately, do not attempt code fixes

---

## 4. Skill Reference

| Slash command | Skill directory | Purpose |
|---|---|---|
| `/forge` | `init/` | Initialize or reconfigure PolyForge for a project |
| `/smith` | `smith/` | Implement a ticket end-to-end — auto-classifies feat vs fix (merges former `feature/` + `fix/`) |
| `/quench` | `quench/` | Diagnose and fix CI failures (max 3 attempt loop) |
| `/hallmark` | `hallmark/` | Review a PR, GitHub issue, or Jira ticket |
| `/mark` | `mark/` | Create structured issues on GitHub, GitLab, or Jira |
| `/sketch` | `sketch/` | Free-form exploration → structured action plan |
| `/probe` | `probe/` | Root-cause investigation of an error or unexpected behavior |
| `/assay` | `assay/` | Full codebase quality audit → `docs/ANALYSIS-{date}.md` |
| `/blueprint` | `blueprint/` | Database schema documentation → `docs/DB.md` |
| `/engrave` | `engrave/` | Regenerate `CLAUDE.md`, `docs/CONTEXT.md`, and scoped rules |
| `/fold` | `fold/` | Reorganize branch commits into 3-7 logical groups |
| `/temper` | `temper/` | Add scoped rules to `.claude/rules/` without re-running /forge |
| `/embers` | `embers/` | Nocturnal routines: `light` / `cast` / `watch` / `tend` (merges former `routines-*`) |

---

## 5. Rules System

### Global rules (shipped with PolyForge)

Three rule files in `rules/` are installed into `~/.claude/rules/` and apply globally to every project:

- **`golden-principles.md`** — 15 rules covering code quality (single responsibility, explicit error handling), architecture (dependency direction, service layer), workflow (atomic commits, no branding footers), and resilience (max 3 retries, switch strategy on repeated failure)
- **`security.md`** — 9 rules: secrets in env vars only, input validation at boundaries, auth on all mutating endpoints, no sensitive data in logs
- **`testing.md`** — 7 rules: behavior-describing test names, one behavior per test, factory/fixture data, coverage of public service methods and critical paths, no time-dependent or order-dependent fragility

### Project-scoped rules

`/forge` and `/temper` create rule files under `.claude/rules/` in the project directory. These use `paths:` frontmatter to scope rules to specific file patterns (e.g., backend files, test files). Naming convention: `polyforge-{scope}.md` (e.g., `polyforge-backend.md`, `polyforge-tests.md`).

Rules are written as positive assertions, one per numbered line. `/temper` appends to existing files and never overwrites.

---

## 6. Hooks

Four shell scripts in `hooks/` are provided for use as git hooks or Claude Code pipeline hooks. They are not installed automatically — `/forge` writes references to them into `.claude/settings.json` during project setup.

### `pre-commit-check.sh`

- Blocks any `.env*` file from being committed (checks staged files)
- Detects project type (Node/Composer/Go/Python) and runs the appropriate test command
- Exits non-zero on test failure, blocking the commit

### `pre-push-verify.sh`

- Requires `.claude/polyforge.json` to exist (skips silently if absent)
- Runs tests for the detected stack
- Runs the linter if a config file is found: ESLint (multiple config filename variants), PHPStan, or golangci-lint
- Exits non-zero on any failure

### `filter-test-output.sh`

- Pipe filter: accepts test output on stdin, outputs only failure lines
- Matches: `FAIL`, `✗`, `●`, `not ok`, `✕`, `FAILED`, `Error:`, `AssertionError`
- Includes 10 lines of context after each match, caps at 150 lines
- Used by skills as: `{test command} 2>&1 | bash hooks/filter-test-output.sh`

### `filter-ci-logs.sh`

- Pipe filter: accepts CI log output on stdin, outputs only error/failure lines
- Matches: `error`, `Error`, `ERROR`, `FAIL`, `FAILED`, `fatal`, `Fatal`, `FATAL`, `panic`, `Panic`, `exception`, `Exception`
- Caps at 200 lines
- Used by `/quench` as: `gh run view <id> --log-failed 2>/dev/null | head -300`

---

## 7. Templates

Two files in `templates/` are used by `/forge` when generating project configuration.

### `CLAUDE.md.template`

A mustache-style template with placeholders: `{{PROJECT_NAME}}`, `{{STACK_SUMMARY}}`, `{{BUILD_COMMAND}}`, `{{TEST_COMMAND}}`, `{{LINT_COMMAND}}`, `{{DEV_COMMAND}}`, `{{ARCHITECTURE_SUMMARY}}`, `{{CONVENTIONS}}`. Has a conditional block `{{#HAS_DB}}...{{/HAS_DB}}` for the database doc reference.

The generated `CLAUDE.md` must stay under 200 lines. It always includes:
- `@docs/CONTEXT.md` reference for architecture details
- Context management instructions (compact at 85%, preserve modified files/test status/active plan)
- The full list of PolyForge slash commands
- `.claude/polyforge.json` config reference

### `polyforge.config.json`

The schema template for `.claude/polyforge.json`. Key fields:

```json
{
  "version": "0.1.0",
  "project": { "name", "description", "stack", "architecture", "testFrameworks", "linters", "packageManager", "internalDependencies" },
  "issueTracker": { "type", "config": { "projectKey", "domain", "labels" } },
  "database": { "type", "connectionMethod", "containerName", "host", "port", "name" },
  "autonomy": "semi",
  "permissions": "manual",
  "context": { "compactThreshold": 0.85, "compactInstructions": "..." },
  "pipeline": { "preCommit", "prePush", "prePR" },
  "goldenPrinciples": { "enabled": true, "customRules": [] },
  "initializedAt": "",
  "lastUpdatedAt": ""
}
```

Default autonomy is `"semi"`. `/forge` sets `"full"` when the user grants full file access. The `pipeline` field lists which checks run at each stage; skills read this to know what verification to run.

---

## 8. CLI (`bin/polyforge.js`)

The CLI is a single ESM file with no external dependencies. It uses only Node.js built-ins: `path`, `url`, `fs`, `os`.

### Commands

| Command | Function | Behavior |
|---|---|---|
| `install [--force]` | `install()` | Symlinks `skills/*` → `~/.claude/skills/polyforge-*` and `rules/*` → `~/.claude/rules/polyforge-*`. Skips if already correctly linked. `--force` replaces existing symlinks. |
| `uninstall` | `uninstall()` | Removes all entries matching `polyforge-*` from `~/.claude/skills/` and `~/.claude/rules/`. Only removes symlinks or files, never directories. |
| `update` | `update()` | Calls `uninstall()` then `install()`. |
| `add-skill <name>` | `addSkill()` | Installs a single named skill. Validates the name against `/^[a-z0-9-]+$/` and checks it exists in `skills/`. |
| `remove-skill <name>` | `removeSkill()` | Removes a single named skill from `~/.claude/skills/`. |
| `list` | `listSkills()` | Shows all available skill directories with a checkmark if currently installed. |
| `--version` / `-v` | `version()` | Prints `polyforge v{version}`. |
| `help` (default) | `help()` | Prints usage and available slash commands. |

### Symlink naming

All installed entries use the `polyforge-` prefix:
- `skills/quench/` → `~/.claude/skills/polyforge-quench`
- `rules/security.md` → `~/.claude/rules/polyforge-security.md`

Entries that already have the `polyforge-` prefix are not double-prefixed.

### Safety

- `isValidSkillName()` rejects names with anything outside `[a-z0-9-]` and blocks `..` path traversal
- `safeUnlink()` only removes symlinks and regular files, never directories
- `isSymlinkTo()` verifies the existing symlink target before deciding to skip or replace

---

## 9. Testing

### Framework

Node.js built-in test runner (`node:test`). No external test dependencies. Run with:

```
node --test tests/**/*.test.js
```

### Test file

`tests/cli.test.js` — the single test file. Four `describe` blocks:

1. **`polyforge CLI`** — exercises the CLI binary via `execFileSync`. Covers: help output, version flags, unknown command rejection, `add-skill`/`remove-skill` argument validation, `list` output, unknown skill name warning.

2. **`skill files`** — for each of the 13 named skills, asserts that `skills/{name}/SKILL.md` exists and has valid frontmatter (`---`, `name:` field, `description:` field, "Use when" phrase in description).

3. **`rule files`** — asserts that `rules/golden-principles.md`, `rules/security.md`, and `rules/testing.md` exist.

4. **`templates`** — asserts that `templates/CLAUDE.md.template` and `templates/polyforge.config.json` exist.

### Test helper

```js
function run(args = []) {
  return execFileSync('node', [CLI, ...args], { encoding: 'utf-8' });
}
```

Throws on non-zero exit, allowing `assert.throws()` to test error cases.

---

## 10. CI/CD

### Workflow: `.github/workflows/ci.yml`

Triggers on push to `main` and on pull requests targeting `main`.

Single job `test` with a matrix across Node.js versions **18, 20, and 22**.

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with the matrix version
3. Run tests: `node --test tests/cli.test.js`
4. Verify CLI runs: `node bin/polyforge.js --version`
5. Verify CLI help: `node bin/polyforge.js help`

No install step is needed because the package has zero runtime dependencies.

---

## 11. Publishing

### npm distribution

Published as `polyforgeai` on npm. The `files` field in `package.json` controls what is included:

```
bin/
skills/
rules/
hooks/
templates/
LICENSE
```

`tests/`, `.github/`, `.claude/`, `research/`, `polyforge-cloud/`, and `tmp/` are excluded.

### Usage after install

```bash
# One-time global setup
npx polyforge install

# Per-project setup (run inside a project in Claude Code)
/forge

# Upgrade after npm update
npx polyforge update
```

### Selective skill management

Users can install or remove individual skills without a full reinstall:

```bash
npx polyforge add-skill fix-ci
npx polyforge remove-skill analyse-db
npx polyforge list
```
