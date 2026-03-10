[![npm version](https://img.shields.io/npm/v/polyforge.svg)](https://www.npmjs.com/package/polyforge)
[![CI](https://github.com/Vekta/polyforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Vekta/polyforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

# PolyForge

Self-adaptive Claude Code plugin for automated software development workflows.

PolyForge scans your project, detects your stack, architecture, and conventions, then provides intelligent slash commands to automate common development tasks.

## Install

```bash
npx polyforge install
```

This symlinks PolyForge skills and rules into `~/.claude/`, making them available in any Claude Code session.

## Quick Start

1. Install PolyForge
2. Open Claude Code in your project
3. Run `/init` — PolyForge scans your project and generates an optimized configuration
4. Use any command: `/pr-review`, `/fix #123`, `/brainstorm`, etc.

## Commands

| Command | Description |
|---------|-------------|
| `/init` | Scan project, detect stack/architecture, generate config interactively |
| `/pr-review` | Review a PR with fresh context — checks CI, code quality, security |
| `/analyse-db` | Connect to DB (Docker or direct), generate `docs/DB.md` schema documentation |
| `/analyse-code` | Full codebase analysis — patterns, security, performance, config issues |
| `/report-issue` | Detect and create issues on GitHub/Jira/GitLab |
| `/fix #N` | Fix an issue — branch, implement, test, PR (autonomy level configurable) |
| `/fix-ci` | Diagnose and fix CI/CD failures — loops max 3 times then reports |
| `/brainstorm` | Free-form brainstorming — produces action plan with parallelizable tasks |
| `/generate-doc` | Generate/update Claude-optimized documentation (CLAUDE.md, docs, rules) |

## How It Works

PolyForge uses Claude Code's native extension points:

- **Skills** (`.claude/skills/`) — Each command is a SKILL.md that Claude Code loads on demand
- **Rules** (`.claude/rules/`) — Golden principles enforced across all interactions
- **Hooks** — Pipeline verification (tests, lint, vulncheck) before push/PR

### Project Configuration

After `/init`, your project gets:

```
.claude/
  polyforge.json         # Project config (stack, tracker, autonomy, pipeline)
  rules/
    polyforge-*.md       # Stack-specific rules (scoped by file path)
  skills/                  # (symlinked from PolyForge install)
CLAUDE.md                  # Short, high-signal project summary (<200 lines)
docs/
  CONTEXT.md               # Detailed architecture and project context
tmp/                       # PolyForge working directory (gitignored)
```

### Autonomy Levels

Configured per project during `/init`:

- **Full auto**: PolyForge branches, fixes, tests, and creates PRs autonomously
- **Semi-auto**: PolyForge proposes changes, waits for approval before applying

### Permissions & Hands-Free Mode

By default, Claude Code asks for permission on every file edit and shell command. If you chose "full auto" during `/init`, you'll be asked whether to grant full permissions for the project.

**Via `/init` (persistent, per-project):**
Generates a `.claude/settings.json` that auto-approves all operations in the project directory. You can revert by deleting the file.

**Via CLI flag (one-time, any project):**
```bash
claude --dangerously-skip-permissions
```
Launches a single session with all permissions granted. Nothing is saved — next session returns to normal.

### Skill Management

Install everything or pick what you need:

```bash
npx polyforge install                  # Install all skills & rules
npx polyforge install --force          # Reinstall, overwriting existing
npx polyforge add-skill pr-review fix  # Install specific skills only
npx polyforge remove-skill analyse-db  # Remove a skill
npx polyforge list                     # See available skills & install status
```

### Issue Tracker Integration

Auto-detected during `/init`:
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
npx polyforge update
```

## Uninstall

```bash
npx polyforge uninstall
```

## Requirements

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- [`gh` CLI](https://cli.github.com/) (for GitHub integration)

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
