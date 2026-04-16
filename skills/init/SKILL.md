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

## Phase 2: Questions (ONE AT A TIME, via AskUserQuestion)

Show detection summary, then ask only what wasn't detected. **Every question is an `AskUserQuestion` tool call** — never emit inline `(1)/(2)` menus in chat. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Sequence (one AskUserQuestion call each, wait for answer before the next):

1. Stack confirmation — options: "Correct" / "Add other repos" / "Different" / "Other"
2. Architecture pattern — options: detected pattern / "Not exactly" / "Other"
3. Issue tracker — options: detected tracker / "Different" / "Other"
4. Autonomy — options: "Full auto (recommended)" / "Semi-auto" / "Other"
5. (Full auto only) File access — options: "Grant full access" / "Decline" / "Other"
6. Additional conventions — options: "None" / "Describe" / "Other"
7. Generate docs now — options: "Yes" / "Skip" / "Other"

## Phase 3: Generate

List the files to create (plain text, no table of choices). Then ask via AskUserQuestion: "Proceed with file generation?" — options: "Proceed" / "Adjust list" / "Cancel" / "Other". Backup existing files to `tmp/backup-{date}/`.

Create:
- `.claude/polyforge.json` — master config
- `CLAUDE.md` — short (<200 lines), `@` refs to detailed docs, include PolyForge commands
- `.claude/rules/` — scoped rules with `paths:` frontmatter
- `docs/CONTEXT.md` — architecture details
- `tmp/` + `.gitignore` entry

Log to `tmp/forge-log-{date}.md`. End with: "**Restart Claude Code** to load new configuration."
