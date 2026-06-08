---
name: embers
description: Use when the user wants to set up, create, inspect, or manage PolyForge nocturnal routines — the banked embers that keep the forge working after hours. Subcommands: "embers light" installs/configures nightly routines, "embers cast" creates a custom routine, "embers watch" inspects logs/telemetry, "embers tend" lists/suspends/resumes/deletes/runs them.
---

# /embers — Nocturnal Routines

Autonomous overnight work = the banked **embers** that keep the forge working after hours.
This command dispatches on its first argument:

| Invocation | Does | Procedure |
|---|---|---|
| `/embers light` | Install / configure nightly routines | @skills/embers/light.md |
| `/embers cast` | Create a custom routine (cast into a mold) | @skills/embers/cast.md |
| `/embers watch` | Inspect logs / telemetry / rate-limit / worktrees | @skills/embers/watch.md |
| `/embers tend [list\|suspend\|resume\|delete\|run-now\|pause-all\|resume-all\|promote-from-dry] <name>` | List / suspend / resume / delete / run / promote | @skills/embers/tend.md |

## Dispatch

1. Read the first argument (`light` / `cast` / `watch` / `tend`).
2. Load and follow the matching procedure file above.
3. `tend` takes its own sub-subcommand (e.g. `/embers tend suspend deps-security`); pass the rest of the args through.
4. No first argument → default to `watch` (read-only status), then tell the user the other subcommands.

All interactive decisions use `AskUserQuestion`. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".
