# PolyForge

Self-adaptive Claude Code plugin for automated software development workflows.

## Stack
Node.js (ESM) — CLI tool distributed via npm

## Commands
- Test: `node --test tests/**/*.test.js`
- Run CLI: `node bin/polyforge.js`
- Install locally: `npm link`

## Architecture
- `bin/polyforge.js` — CLI entry point (install/uninstall/update/help)
- `skills/*/SKILL.md` — Claude Code skill definitions (the core value)
- `rules/*.md` — Golden principles and coding rules
- `hooks/*.sh` — Git/Claude hooks for pipeline enforcement
- `templates/` — Config and CLAUDE.md templates for project generation

## Conventions
- Skills are markdown-only (SKILL.md) — Claude Code native format
- Rules use positive assertions, never negations
- All interactive flows ask ONE question at a time
- Skills reference `.claude/polyforge.json` for project-specific config
- Max 3 retries on any failing operation — then switch approach or ask for help
- Verbose operations (large scans, CI logs) are delegated to subagents
- Compact conversation after each deliverable (report, PR, doc)
