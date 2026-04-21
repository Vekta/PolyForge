[![npm version](https://img.shields.io/npm/v/polyforgeai.svg)](https://www.npmjs.com/package/polyforgeai)
[![npm downloads](https://img.shields.io/npm/dm/polyforgeai.svg)](https://www.npmjs.com/package/polyforgeai)
[![CI](https://github.com/Vekta/polyforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Vekta/polyforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

# PolyForge

Self-adaptive Claude Code plugin for automated software development workflows.

PolyForge scans your project, detects your stack, architecture, and conventions, then provides intelligent slash commands to automate common development tasks.

## Install

```bash
npx polyforgeai install
```

This symlinks PolyForge skills and rules into `~/.claude/`, making them available in any Claude Code session.

> **Restart Claude Code** after installing or updating PolyForge — skills are loaded at session start.

## Quick Start

1. Install PolyForge and restart Claude Code
2. If your project already has a `.claude/` directory with custom commands or skills, back it up first (`mv .claude .claude-backup`) — `/forge` will recreate it cleanly
3. Open Claude Code in your project
4. Run `/forge` — PolyForge scans your project and generates an optimized configuration
5. Use any command: `/review`, `/fix #123`, `/brainstorm`, etc.

## Commands

### Core workflow

| Command | Description |
|---------|-------------|
| `/forge` | Scan project, detect stack/architecture/CI workflows/parallelism, generate config interactively |
| `/review` | Review a PR, GitHub issue, or Jira ticket — checks CI, quality, security |
| `/feature #N [#M ...]` | Build a feature from an issue — plan, implement, run CI mirror locally, transition tickets, PR. Supports multi-ticket parallel execution via git worktrees |
| `/fix #N [#M ...]` | Fix an issue — branch, implement, CI mirror, transition tickets, PR. Same parallel support |
| `/fix-ci` | Diagnose and fix CI/CD failures — max 3 retries. Learns unmirrored CI commands via informed-consent flow |
| `/brainstorm` | Free-form brainstorming — produces action plan with parallelizable tasks |
| `/generate-doc` | Generate/update Claude-optimized documentation |
| `/squash` | Clean up commit history before PR |
| `/add-rule` | Add project rules or conventions without re-running `/forge` |
| `/report-issue` | Detect and create issues on GitHub/Jira/GitLab |
| `/analyse-db` | Connect to DB, generate `docs/DB.md` schema documentation |
| `/analyse-code` | Full codebase analysis — patterns, security, performance, config issues |
| `/diagnose` | Investigate a specific error or behavior — determine root cause |

### Nocturnal routines

Autonomous workflows that run during your sleep window to exploit unused Claude subscription quota:

| Command | Description |
|---------|-------------|
| `/routines-init` | Install nocturnal routines: detects your Claude plan, proposes a profile (light/standard/full/unleashed), installs launchd plists |
| `/routines-create` | Scaffold-guided creator for custom routines (scan / fix / review / report templates) |
| `/routines-manage` | `list / suspend / resume / delete / run-now / pause-all / promote-from-dry` |
| `/routines-logs` | Read-only inspection of logs, telemetry, rate-limit state, worktrees |

See `docs/ROUTINES.md` for the nocturnal routines quickstart and `docs/DEV-WORKFLOW-SYNC.md` for ticket transitions / CI mirror / parallel fix deep-dive.

### Dev workflow integration

`/fix` and `/feature` integrate with your project's real workflow:

- **Ticket transitions** — Jira tickets move through `In Progress` → `Code Review` automatically. Terminal decisions (Blocked / Rejected) always require human confirmation via AskUserQuestion
- **CI mirror** — before each push, PolyForge runs your actual CI commands locally (extracted from `.github/workflows/*.yml`) with a 3-retry auto-fix loop. Unmirrored CI commands are learned via `/fix-ci`
- **Parallel processing** — `/fix #10 #11 #12` spawns isolated worktrees, orchestrator serializes user prompts, test execution can be gated by a global lock for projects with shared services (detected automatically)

## How It Works

PolyForge uses Claude Code's native extension points:

- **Skills** (`.claude/skills/`) — Each command is a SKILL.md that Claude Code loads on demand
- **Rules** (`.claude/rules/`) — Golden principles enforced across all interactions
- **Hooks** — Pipeline verification (tests, lint, vulncheck) before push/PR

### Project Configuration

After `/forge`, your project gets:

```
polyforge.json             # Project config at repo root: stack, tracker, autonomy,
                           # CI mirror, parallelism, Jira transitions, git defaults
.claude/
  rules/
    polyforge-*.md         # Stack-specific rules (scoped by file path)
CLAUDE.md                  # Short, high-signal project summary (<200 lines)
docs/
  CONTEXT.md               # Detailed architecture and project context
tmp/                       # PolyForge working directory (gitignored)
```

Skills live at `~/.claude/skills/polyforge-*` (installed globally by `npx polyforgeai install`) and are shared across all PolyForge-configured projects.

### Autonomy Levels

Configured per project during `/forge`:

- **Full auto**: PolyForge branches, fixes, tests, and creates PRs autonomously
- **Semi-auto**: PolyForge proposes changes, waits for approval before applying

### Permissions & Hands-Free Mode

By default, Claude Code asks for permission on every file edit and shell command. If you chose "full auto" during `/forge`, you'll be asked whether to grant full permissions for the project.

**Via `/forge` (persistent, per-project):**
Generates a `.claude/settings.json` that auto-approves all operations in the project directory. You can revert by deleting the file.

**Via CLI flag (one-time, any project):**
```bash
claude --dangerously-skip-permissions
```
Launches a single session with all permissions granted. Nothing is saved — next session returns to normal.

### Skill Management

Install everything or pick what you need:

```bash
npx polyforgeai install                  # Install all skills & rules
npx polyforgeai install --force          # Reinstall, overwriting existing
npx polyforgeai add-skill review fix     # Install specific skills only
npx polyforgeai remove-skill analyse-db  # Remove a skill
npx polyforgeai list                     # See available skills & install status
```

### Issue Tracker Integration

Auto-detected during `/forge`:
- **GitHub Issues** — detected via `gh api`
- **Jira** — detected from `.env`, `.jira` config
- **GitLab** — detected from git remote

## Design Principles

- **Positive rules** — all golden principles are phrased as assertions, not negations (proven more effective with LLMs)
- **Fresh context** — PR reviews use isolated subagents to avoid author bias
- **Circuit breakers** — max 3 retries on any failing operation, then switch strategy or ask for help
- **Progressive disclosure** — context is loaded on-demand, not upfront, to preserve the context window
- **Hooks enforce, rules guide** — deterministic checks (tests, lint) are hooks; advisory guidance stays in rules

## Update

```bash
npx polyforgeai update
```

## Uninstall

```bash
npx polyforgeai uninstall
```

## Requirements

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

**Issue tracker CLIs (install only what you use):**
- [GitHub CLI](https://cli.github.com/) — GitHub Issues
- [GitLab CLI](https://gitlab.com/gitlab-org/cli) — GitLab Issues
- [Jira CLI](https://github.com/ankitpokhrel/jira-cli) or API token — Jira

> **Note:** PolyForge is built on Claude Code's native extension system (skills, rules, hooks). It requires Claude Code as its runtime and does not support other AI models or providers. The skills are plain markdown and could be adapted to other tools in the future, but the orchestration (subagents, worktrees, context management) relies on Claude Code.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run tests (`node --test tests/**/*.test.js`)
4. Commit your changes
5. Open a pull request

## License

[MIT](LICENSE)
