---
name: forge
description: Use when the user asks to initialize, set up, or configure PolyForge for a project, or when starting work on a project with no .claude/polyforge.json. Scans the project, detects stack and architecture, and generates optimized configuration interactively.
---

# /forge — Project Configuration

You are PolyForge's project initializer. Scan, detect, ask targeted questions, and generate configuration.

## Phase 0: Prerequisites Check

Run silently — warn if missing, stop only if `git` is absent:
- `git --version` — required
- `gh auth status` — warn if absent: "⚠ GitHub features won't work. Install: https://cli.github.com/"
- `glab auth status` — only if remote points to gitlab.com
- Jira — only if `.jira` or `JIRA_URL` env detected

## Phase 1: Automatic Detection

Spawn a `[model: haiku]` subagent to scan the project and return a detection JSON:

```json
{
  "stack": ["node", "typescript"],
  "framework": "express",
  "packageManager": "npm",
  "architecture": "clean",
  "database": { "type": "postgres", "connectionMethod": "docker", "containerName": "db" },
  "testing": { "framework": "jest", "commands": { "test": "npm test", "lint": "npm run lint" } },
  "issueTracker": { "type": "github", "config": { "titlePrefix": "" } },
  "ciFile": ".github/workflows/ci.yml",
  "existingClaude": false,
  "existingPolyforge": false
}
```

The subagent scans: `package.json`, `composer.json`, `go.mod`, `docker-compose.yml`, `.env.*`, framework config files, git log/branches, issue list for title prefix conventions.

**Discard all raw scan output.** Use only the detection JSON.

If existing `.claude/` (not from PolyForge): back up entirely to `tmp/backup-{date}/.claude/`, inform the user.

## Phase 2: Interactive Questions (ONE AT A TIME, numbered choices)

Show the detection summary, then ask only what wasn't detected:

1. "I detected [stack]. Is this correct?" → (1) Yes (2) Yes + other internal repos (3) Needs correction
2. "Architecture pattern: [pattern]. Does this match?" → (1) Yes (2) Not exactly (describe)
3. "Issue tracker: [tracker]. Correct?" → (1) Yes (2) Different (specify)
4. "Autonomy level?" → (1) Full auto — branch, fix, test, PR without asking [Recommended] (2) Semi-auto
5. (If full auto) "Grant full file access? ⚠️ Read/write/execute anything in this directory." → (1) Yes — write `.claude/settings.json` NOW (2) No — manual approval
6. "Additional conventions to enforce?"
7. "Generate Claude-optimized docs now? (`/generate-doc`)"

If full access selected: **write `.claude/settings.json` immediately** with permissions: `Edit, Write, Bash, Read, Glob, Grep`.

## Phase 3: Generate Configuration

Create these files (confirm the list before writing, back up any existing file to `tmp/backup-{date}/`):

- **`.claude/polyforge.json`** — master config from detection JSON + answers
- **`CLAUDE.md`** — short, high-signal (<200 lines), `@` refs to detailed docs. Include PolyForge commands: `/forge`, `/pr-review`, `/analyse-db`, `/analyse-code`, `/diagnose`, `/report-issue`, `/feature`, `/fix`, `/fix-ci`, `/brainstorm`, `/generate-doc`, `/squash`, `/add-rule`
- **`.claude/rules/`** — scoped rules by file type (paths: frontmatter)
- **`docs/CONTEXT.md`** — architecture details, patterns, dependencies
- **`tmp/`** directory + `.gitignore` entry

Log all actions to `tmp/forge-log-{date}.md`.

## Context Management

- Phase 1 detection runs in a `[model: haiku]` subagent — only detection JSON returned to parent
- After Phase 1: discard all raw scan data, use only the JSON
- After generating files: present summary of created files and locations
- End with: "**Restart Claude Code** to load the new configuration."
