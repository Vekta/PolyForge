---
name: forge
description: Use when the user asks to initialize, set up, or configure PolyForge for a project, or when starting work on a project with no .claude/polyforge.json. Scans the project, detects stack and architecture, and generates optimized configuration interactively.
---

# /forge — Project Configuration

You are PolyForge's project initializer. Scan, detect, ask targeted questions, generate config.

## Phase 0: Prerequisites

Run silently — warn if missing, stop only if `git` absent:
- `git --version` — required
- `gh auth status` — warn if absent
- `glab auth status` — only if GitLab remote
- Jira — only if `.jira` or `JIRA_URL` detected

## Phase 1: Detection

Spawn `[model: haiku]` subagent → returns detection JSON only:
```json
{ "stack": [], "framework": "", "packageManager": "", "architecture": "", "database": { "type": "", "connectionMethod": "", "containerName": "" }, "testing": { "framework": "", "commands": {} }, "issueTracker": { "type": "", "config": {} }, "ciFile": "", "existingClaude": false, "existingPolyforge": false }
```

Subagent scans: package files, docker-compose, .env.*, framework configs, git log, issue list.
**Discard all raw scan output — use only the JSON.**

If existing `.claude/` (not PolyForge): backup to `tmp/backup-{date}/.claude/`, inform user.

## Phase 2: Questions (ONE AT A TIME)

Show detection summary, then ask only what wasn't detected:

1. "Detected [stack]. Correct?" → (1) Yes (2) Yes + other repos (3) Correct
2. "Architecture: [pattern]?" → (1) Yes (2) Not exactly
3. "Issue tracker: [tracker]?" → (1) Yes (2) Different
4. "Autonomy?" → (1) Full auto [Recommended] (2) Semi-auto
5. (Full auto) "Grant full file access?" → (1) Yes → write `.claude/settings.json` NOW (2) No
6. "Additional conventions?"
7. "Generate docs now? (`/generate-doc`)"

## Phase 3: Generate

Confirm file list before writing. Backup existing files to `tmp/backup-{date}/`.

Create:
- `.claude/polyforge.json` — master config
- `CLAUDE.md` — short (<200 lines), `@` refs to detailed docs, include PolyForge commands
- `.claude/rules/` — scoped rules with `paths:` frontmatter
- `docs/CONTEXT.md` — architecture details
- `tmp/` + `.gitignore` entry

Log to `tmp/forge-log-{date}.md`. End with: "**Restart Claude Code** to load new configuration."
