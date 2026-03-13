# Shared Patterns

## Verification Pipeline

```bash
{test command} 2>&1 | bash hooks/filter-test-output.sh
{lint command}
{typecheck command}
{vulncheck command}
```

Fix failures automatically (max 2 retries). Same error + same approach twice → switch strategy. After 3 total attempts, categorize:
- 🟢 Quick fix → fix now
- 🟡 Needs investigation → `/report-issue`
- 🔴 Pre-existing/infra → `/report-issue` tagged infra

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
