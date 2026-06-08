# /smith — Parallel mode (multi-ticket)

Loaded only when `/smith` is invoked with more than one ticket ref. Keep this file focused on the parallel orchestration — the Process steps (1.5 → 9) live in the main `SKILL.md`. Each ticket auto-classifies feat vs fix for its own commits/PR (Step 1.5).

## Trigger

If the invocation has ≥2 `#N` or `PROJECT-N` refs (e.g. `/smith #42 #43 #44` or `/smith DEV-12 DEV-13`), enter parallel mode.

## Plan

```bash
npx polyforge _parallel-plan --project "$(pwd)" --kind smith --tickets "#42,#43,#44"
```

Returns:
- `plan[]` — per-ticket `{ticket, branchName, worktreePath, baseBranch, baseRef, timestamp}`
- `maxConcurrent` — respects `parallelism.maxConcurrent`
- `parallelism` — mode `full` or `serialized`
- `sync` — workflow hash check done ONCE for all tickets

## Create worktrees

```bash
npx polyforge _parallel-create-worktrees --project "$(pwd)" --plan "$(plan JSON)"
```

Single `git fetch origin {baseBranch}` reused across worktrees (performance win).

## Spawn agents

Spawn ONE `[model: sonnet]` subagent per plan entry (capped at `maxConcurrent`). Each agent:

1. `cd` into its worktree path
2. Goes through Steps 1.5 → 9 from main SKILL.md independently
3. Returns `{ ticket, branch, pr, outcome: "opened|blocked|rejected|failed", reason }`

## Brainstorm serialization

**IMPORTANT**: the orchestrator asks AskUserQuestion prompts (actionable check from Step 1.5) in sequence BEFORE spawning agents. Never multiple brainstorms concurrently — a human can't answer parallel questions.

## Test serialization

When `parallelism.mode === "serialized"` (detected at `/forge` time from docker-compose, dev-server scripts, or fixed ports in .env.example), each agent acquires a global lock before running the local CI mirror:

```bash
npx polyforge _test-lock-acquire --owner "feat-{ticketId}"  # blocks up to 15 min
npx polyforge _ci-mirror-run --project "{worktreePath}"
npx polyforge _test-lock-release
```

When `parallelism.mode === "full"` (no shared services detected), each worktree runs its tests independently in parallel. No lock needed.

## After all agents complete

Aggregate results:

```json
{
  "total": 3,
  "opened": [{ "ticket": "#42", "pr": "URL" }, { "ticket": "#43", "pr": "URL" }],
  "blocked": [{ "ticket": "#44", "reason": "..." }],
  "rejected": [],
  "failed": []
}
```

Report to user + cleanup stale worktrees (delegated to routines cleanup daemon on a nightly schedule — worktrees are kept until associated PR is closed/merged for ≥3 days).
