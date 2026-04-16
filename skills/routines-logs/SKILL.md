---
name: routines-logs
description: Use when the user wants to inspect PolyForge routine execution logs, token consumption, rate-limit status, or stuck/accumulating worktrees. Reads JSONL logs and telemetry without invoking any runtime.
---

# /routines-logs — Inspect Routine Logs

Read-only inspection of routine state.

## Usage

```
/routines-logs                            Summary of last 24h
/routines-logs <name>                     Detailed log for one routine
/routines-logs --window 5h                Telemetry for rolling 5h window
/routines-logs --tail <name>              Last 20 events for a routine
/routines-logs --worktrees                List active routine worktrees
/routines-logs --errors                   Last 10 errors across all routines
```

## Default view (no args)

Render a markdown report:

```
# Routines Report — {date}

## Rolling 5h telemetry
Runs: {N} | Total tokens: {in+out} | Cost ref: ${cost}

## By routine (last 24h)
| Routine | Runs | Success | Failures | Last | Tokens |
|---|---|---|---|---|---|

## Rate limit: {status}
## Pause file: {present/absent}
## Active worktrees: {count} (warn if >10)
```

Data sources:
- `~/.polyforge/logs/*.jsonl` — per-routine events
- `~/.polyforge/token-window.json` — telemetry
- `~/.polyforge/rate-limited-until.json` — rate limit marker
- `~/.polyforge/PAUSE` — pause file
- `git worktree list --porcelain` in project — active worktrees

## Detail view: `/routines-logs <name>`

```bash
tail -n 50 ~/.polyforge/logs/{name}.jsonl | jq -c '.'
```

Render a chronological summary of the last 50 events, highlighting:
- `preflight-fail` (with the failed check)
- `budget-exceeded`
- `rate-limited`
- `error`

## Errors view: `/routines-logs --errors`

Grep across all `*.jsonl` for `"type":"error"` | `"is_error":true` | `"preflight-fail"`, render top 10 most recent.

## Worktrees view

Call `listRoutineWorktrees(projectRoot)` from `lib/routines/worktree.js`. Cross-reference each worktree's branch with `gh pr list --head {branch}` to show PR state. Flag worktrees with no PR or PR closed >30 days as candidates for manual cleanup.

## Telemetry view

Call `summary(windowMinutes)` from `lib/routines/telemetry.js`. Render tokens + cost per routine within the window.

## Notes

This skill never mutates state — purely read-only. Use `/polyforge-routines-manage` to change state.
