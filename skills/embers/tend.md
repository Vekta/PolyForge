
# /embers tend — Manage Routines

Dispatcher for CRUD operations on installed routines.

## Usage

```
/embers tend                              List all routines + status
/embers tend list                         Same as above
/embers tend suspend <name>               Disable a routine (keep plist)
/embers tend resume <name>                Re-enable a routine
/embers tend delete <name>                Remove plist + config entry
/embers tend run-now <name> [--dry]       Run immediately (bypass schedule+window, NOT preflight)
/embers tend pause-all                    Create ~/.polyforge/PAUSE
/embers tend resume-all                   Remove ~/.polyforge/PAUSE
/embers tend promote-from-dry <name>      Flip first_run_dry=false after reviewing dry run
```

## Subcommand details

### list

- Parse `polyforge.json` section `routines`
- Cross-reference with `npx polyforge _routines-status`
- Render a table: name, enabled, first_run_dry, schedule, model, last run (from logs), last status

### suspend / resume

- `suspend`: set `enabled: false` in `polyforge.json` routine entry, then `launchctl unload ~/Library/LaunchAgents/com.polyforge.routine.{name}.plist`
- `resume`: set `enabled: true`, then `launchctl load ~/Library/LaunchAgents/com.polyforge.routine.{name}.plist`
- Confirm via `AskUserQuestion` before executing

### delete

- Remove the routine from `polyforge.json` (Edit tool)
- Uninstall the plist:
  ```bash
  npx polyforge _routines-uninstall-plist <name>
  ```
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

- Only valid if the routine has had at least one successful dry run (check `~/.polyforge/logs/{name}.jsonl` for a `claude-result` event)
- Flip `first_run_dry: false` in `polyforge.json` via Edit tool
- Show the user what changed: "Next run will be LIVE (no dry mode)"

## Output

For every operation, end with a single-line summary:

```
✓ {action} {name}: {result}
```

Use `AskUserQuestion` for all confirmations — no `(y/n)` prompts in chat. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".
