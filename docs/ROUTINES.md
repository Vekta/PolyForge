# PolyForge Routines

Nocturnal autonomous workflows that use your Claude subscription quota while you sleep — triage issues, review PRs, refacto, maintain deps, groom the backlog.

## TL;DR

```bash
# Install PolyForge (if not done)
npx polyforge install

# In Claude Code, configure routines for the current project:
/polyforge-routines-init

# Inspect what's installed:
/polyforge-routines-logs

# Everything starts in dry-run; promote after review:
/polyforge-routines-manage promote-from-dry deps-security
```

## How it works

1. A **launchd plist** fires at your chosen schedule (e.g. `0 23 * * *`)
2. A **preflight check** runs: kill-switch, plan, time window, rate-limit marker, network, disk
3. Preflight passes → a **serial lock** ensures no overlap with other routines
4. A **git worktree** is created off `origin/{base_branch}` in `~/.polyforge/worktrees/...` — the run is 100% isolated from your working copy
5. `claude -p` runs the routine's prompt with `--max-budget-usd` as a budget circuit-breaker
6. Output (JSON) is parsed → logged to `~/.polyforge/logs/{routine}.jsonl` + telemetry updated
7. If the routine chose to open a PR, it's labeled `routine:auto-merge` or `routine:to-review`
8. A separate **cleanup daemon** removes worktrees whose PR has been closed/merged for N days

## Plan-aware profiles

Your Claude subscription tier determines the default scope:

| Plan | Profile | Routines enabled |
|---|---|---|
| Pro | light | deps-security, release-notes |
| Max / Max 5x | standard | + refacto-scanner, backlog-groomer |
| Max 20x | full | + issue-worker, pr-reviewer |
| Team, Enterprise | unleashed | All bundled + unlimited custom |
| API key | budget-driven | Capped by `--max-budget-usd` |

Override at init time if detection is wrong.

## Budget control

Every routine run is wrapped in `--max-budget-usd {N}`. When exceeded, Claude halts with `subtype: "error_max_budget_usd"` and the runner records the event. This works on both subscription (reference cost) and API-key (actual billing) auth.

Budget defaults per profile (USD equivalent per run):

- light: $0.50
- standard: $1.00
- full: $2.00
- unleashed: $5.00
- budget-driven: user-defined

## Safety model

- **First-run dry**: every routine starts with `first_run_dry: true`. First execution is in dry mode (no push, merge, or PR). Promote manually after reviewing output.
- **Allowlist for auto-merge**: auto-merge is gated by explicit per-routine allowlists (e.g. `patch-version-bump`, `lint-only`). Never broad.
- **Kill switch**: `touch ~/.polyforge/PAUSE` stops ALL routines instantly.
- **Isolation**: routines never touch your checkout — they run in `~/.polyforge/worktrees/`.
- **Rate-limit handling**: a `rate_limit_exceeded` error writes `~/.polyforge/rate-limited-until.json`; subsequent routines skip until reset.

## Commands

| Command | Purpose |
|---|---|
| `/polyforge-routines-init` | First-time setup for a project |
| `/polyforge-routines-create` | Build a custom routine via guided scaffold |
| `/polyforge-routines-manage` | `list / suspend / resume / delete / run-now / pause-all / promote-from-dry` |
| `/polyforge-routines-logs` | Inspect logs, telemetry, worktrees (read-only) |

## Built-in routines

| Routine | Strategy | Model | Autonomy |
|---|---|---|---|
| issue-worker | full | sonnet | pr-review (never auto-merge) |
| pr-reviewer | targeted | sonnet | auto-merge (allowlist-gated) |
| refacto-scanner | targeted | haiku | pr-review |
| deps-security | minimal | haiku | mixed (patch → auto, minor/major → review) |
| backlog-groomer | targeted | haiku | suggest (labels + stale detection only) |
| release-notes | minimal | haiku | pr-review |
| daily-reporter | minimal | haiku | suggest (publishes a daily summary) |

## System prompt strategies

| Strategy | Contents | Overhead |
|---|---|---|
| `full` | Full CLAUDE.md + skills + memory | ~40k tokens |
| `targeted` | Only the files listed in `system_prompt_sources` | ~5-10k tokens |
| `minimal` | Just the routine's template + allowed_tools | ~1-2k tokens |

Chosen per-routine; lighter profiles prefer `minimal`/`targeted`.

## Configuration

Everything lives in `polyforge.json` under the `routines` key. Schema validated at load; invalid config fails fast. See `lib/routines/schema.js` for the full validator.

Minimal example:

```json
{
  "routines": {
    "profile": "standard",
    "detected_plan": "max",
    "window": { "start": "23:00", "end": "07:00" },
    "budget": { "max_budget_usd_per_run": 1.0 },
    "isolation": {
      "strategy": "worktree",
      "base_branch": "main",
      "base_ref": "origin/main",
      "worktree_root": "~/.polyforge/worktrees"
    },
    "concurrency": { "serial_lock": true, "max_parallel": 1 },
    "routines": [
      {
        "name": "deps-security",
        "enabled": true,
        "first_run_dry": true,
        "schedule": "0 0 * * *",
        "template": "builtin:deps-security",
        "autonomy": "mixed",
        "model": "haiku",
        "max_turns": 15,
        "system_prompt_strategy": "minimal",
        "allowed_tools": ["Bash(npm *)", "Bash(git *)", "Bash(gh *)", "Read", "Edit"]
      }
    ]
  }
}
```

## Troubleshooting

### macOS doesn't wake at the scheduled time

- Ensure the Mac is plugged in (not on battery) during the nightly window
- `StartCalendarInterval` queues events while asleep but does not re-fire if the Mac was shut down. Fix: keep it plugged + logged in.
- `pmset -g sched` shows scheduled wakes. If empty, add one: `sudo pmset repeat wakeorpoweron MTWRFSU 22:55:00`

### "claude auth status" returns a plan we don't recognize

The plan-detector logs unknown values to `~/.polyforge/unknown-plans.jsonl` and falls back to `standard`. Override at init via AskUserQuestion.

### Rate-limited mid-window

A marker at `~/.polyforge/rate-limited-until.json` prevents subsequent runs until the timestamp passes. You can clear it manually: `rm ~/.polyforge/rate-limited-until.json`.

### Worktrees accumulating

`/polyforge-routines-logs --worktrees` lists them. Cleanup runs daily but only removes when the associated PR has been closed/merged for ≥3 days. If a PR has been abandoned, close it via GitHub and wait for the next cleanup cycle, or manually `git worktree remove <path>`.

### A routine ran but I can't find its PR

Check `~/.polyforge/logs/{routine}.jsonl` — the `claude-result` event carries cost/turns, and subsequent events from the routine's prompt will show the PR URL (routines emit a final JSON summary line).

### Promote-from-dry blew up

After reviewing a dry run, promote with `/polyforge-routines-manage promote-from-dry <name>`. If you're unsure, you can always `suspend` instead and leave it disabled.

## Out of scope (v1)

- Linux / Windows (macOS only for now)
- GitHub Actions backend — local `launchd` only
- Multi-user mode on the same Mac
- Webhook-driven triggers (push, PR opened) — only scheduled cron

## Tests

```bash
npm test
```

Covers schema validation, window detection, cron → plist translation, telemetry persistence, rate-limit marker lifecycle, and profile builder. Integration with launchd / real `claude -p` is verified manually during dogfood (see `docs/ROUTINES-DOGFOOD.md` once run).
