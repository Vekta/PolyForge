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
- `polyforge.json` and `CLAUDE.md` are pre-loaded at session start — skills must NOT re-read them
- Shared patterns (verification, circuit breaker, subagent rules) live in `skills/shared/common-patterns.md`
- Subagents return structured JSON only — no prose, no markdown
- Subagent thresholds: only spawn when complexity justifies overhead (see per-skill thresholds)
- Max 3 concurrent subagents per skill, max 10 tool calls per subagent
- Max 3 retries on any failing operation — then switch approach or ask for help
- Compact conversation after each deliverable (report, PR, doc)
- Diff exclusions: always use `':!*.lock' ':!vendor/' ':!node_modules/' ':!*.generated.*'`
