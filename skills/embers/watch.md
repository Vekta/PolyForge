
# /embers watch — Inspect Routine Logs

Read-only inspection of routine state.

## Usage

```
/embers watch                            Summary of last 24h
/embers watch <name>                     Detailed log for one routine (last 50 events)
/embers watch --window 5h                Telemetry for rolling 5h window
/embers watch --worktrees                List active routine worktrees
/embers watch --errors                   Last 10 errors across all routines
```

## Default view (no args)

Render a markdown report:

```
# Routines Report — {date}

## Rolling 5h telemetry
Runs: {N} | Total tokens: {in+out} | Cache hit rate: {pct}% | Cost ref: ${cost}

## By routine (last 24h)
| Routine | Runs | Success | Failures | Last | Tokens | Cache hit | Skipped |
|---|---|---|---|---|---|---|---|

## Rate limit: {status}
## Pause file: {present/absent}
## Active worktrees: {count} (warn if >10)
## Cost regressions: {list any `cost-regression` events — routine, ratio vs baseline}
```

**Cache hit rate** comes from `summary().cacheHitRate` (and per-routine
`byRoutine[name].cacheHitRate`) — the fraction of input tokens served from cache.
A low/zero rate across the nightly window means routines aren't sharing a warm
cache; check whether their schedules fall within one cache TTL. **Skipped** counts
`skip` events with `reason: "no-work"`. **Cost regressions** are `cost-regression`
events emitted when a run costs ≥1.5× the routine's rolling average.

Data sources (assemble via Read + bash):
- `~/.polyforge/logs/*.jsonl` — per-routine events
- `~/.polyforge/token-window.json` — telemetry
- `~/.polyforge/rate-limited-until.json` — rate limit marker
- `~/.polyforge/PAUSE` — pause file
- `git worktree list --porcelain` in project — active worktrees

Telemetry summary available via:
```bash
npx polyforge _routines-status
```

## Detail view: `/embers watch <name>`

```bash
tail -n 50 ~/.polyforge/logs/{name}.jsonl | jq -c '.'
```

Render a chronological summary of the last 50 events, highlighting:
- `preflight-fail` (with the failed check)
- `budget-exceeded`
- `rate-limited`
- `error`

## Errors view: `/embers watch --errors`

Grep across all `*.jsonl` for `"type":"error"` | `"is_error":true` | `"preflight-fail"`, render top 10 most recent.

## Worktrees view

```bash
git worktree list --porcelain | grep -E '^(worktree|branch refs/heads/routine/)'
```

Cross-reference each worktree's branch with `gh pr list --head {branch}` to show PR state. Flag worktrees with no PR or PR closed >30 days as candidates for manual cleanup.

## Telemetry view

```bash
npx polyforge _routines-status
```

Renders tokens + cost per routine for the rolling 5h window.

## Notes

This skill never mutates state — purely read-only. Use `/embers tend` to change state.
