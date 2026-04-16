---
name: routines-manage
description: Use when the user wants to list, suspend, resume, delete, manually run, or promote-from-dry a PolyForge routine. Also for pause-all / resume-all emergency controls.
---

# /routines-manage — Manage Routines

Dispatcher for CRUD operations on installed routines.

## Usage

```
/routines-manage                              List all routines + status
/routines-manage list                         Same as above
/routines-manage suspend <name>               Disable a routine (keep plist)
/routines-manage resume <name>                Re-enable a routine
/routines-manage delete <name>                Remove plist + config entry
/routines-manage run-now <name> [--dry]       Run immediately (bypass schedule+window, NOT preflight)
/routines-manage pause-all                    Create ~/.polyforge/PAUSE
/routines-manage resume-all                   Remove ~/.polyforge/PAUSE
/routines-manage promote-from-dry <name>      Flip first_run_dry=false after reviewing dry run
```

## Subcommand details

### list

- Parse `polyforge.json` section `routines`
- Cross-reference with `npx polyforge _routines-status`
- Render a table: name, enabled, first_run_dry, schedule, model, last run (from logs), last status

### suspend / resume

- `suspend`: set `enabled: false` in config, call `launchctl unload` on the plist
- `resume`: set `enabled: true`, call `launchctl load`
- Confirm via `AskUserQuestion` before executing

### delete

- Call `uninstallRoutinePlist(name)` from `lib/routines/launchd.js`
- Remove the routine from `polyforge.json`
- Confirm via `AskUserQuestion` with explicit warning — this is irreversible

### run-now

- Direct invocation of `bin/polyforge-routine-runner.sh <name> <projectRoot> --run-now`
- Bypasses window + schedule
- Preserves all preflight checks (kill-switch, plan, rate-limit marker, network, disk)
- If `--dry` appended, routine runs in dry mode regardless of `first_run_dry` config
- Stream the output, then show the JSON result

### pause-all / resume-all

- `pause-all`: `touch ~/.polyforge/PAUSE` — preflight will abort every routine
- `resume-all`: `rm ~/.polyforge/PAUSE`
- No per-routine toggles; use `suspend`/`resume` for that

### promote-from-dry

- Only valid if the routine has had at least one successful dry run (check logs)
- Flip `first_run_dry: false` in config via `updateRoutine()`
- Show the user what changed: "Next run will be LIVE (no dry mode)"

## Output

For every operation, end with a single-line summary:

```
✓ {action} {name}: {result}
```

Use `AskUserQuestion` for all confirmations — no `(y/n)` prompts in chat. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".
