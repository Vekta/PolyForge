# PolyForge

Self-adaptive Claude Code plugin for automated software development workflows.

## Stack
Node.js (ESM) — CLI tool distributed via npm

## Commands
- Test: `node --test tests/**/*.test.js`
- Run CLI: `node bin/polyforge.js`
- Install locally: `npm link`

## Architecture
- `bin/polyforge.js` — CLI entry point (install/uninstall/update/help + internal `_*` subcommands)
- `bin/polyforge-routine-runner.sh` — shell wrapper invoked by launchd for nocturnal routines
- `lib/*.js` — Node ESM modules: workflow parsing, Jira client, CI mirror, parallel orchestrator, config migration, worktree helpers, test lock
- `lib/routines/*.js` — Nocturnal routines framework: plan detection, preflight, launchd generator, runner orchestrator
- `skills/*/SKILL.md` — Claude Code skill definitions (the core user-facing value)
- `rules/*.md` — Golden principles and coding rules
- `hooks/*.sh` — Git/Claude hooks for pipeline enforcement
- `templates/` — Config templates + per-routine prompts

## Conventions
- Skills are markdown-only (SKILL.md) — Claude Code native format
- Rules use positive assertions, never negations
- All interactive flows ask ONE question at a time via AskUserQuestion
- `CLAUDE.md` is pre-loaded at session start. `polyforge.json` is read on-demand by skills (not pre-loaded) — consume it via Read when needed
- Shared patterns (verification, circuit breaker, subagent rules) live in `skills/shared/common-patterns.md`
- Subagents return structured JSON only — no prose, no markdown
- Subagent thresholds: only spawn when complexity justifies overhead (see per-skill thresholds)
- Max 3 concurrent subagents per skill, max 10 tool calls per subagent
- Max 3 retries on any failing operation — then switch approach or ask for help
- Compact conversation after each deliverable (report, PR, doc)
- Diff exclusions: always use `':!*.lock' ':!vendor/' ':!node_modules/' ':!*.generated.*'`
