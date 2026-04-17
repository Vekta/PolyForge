---
name: routines-init
description: Use when the user wants to install, enable, or configure PolyForge nocturnal routines for the first time on a project. Detects the Claude plan, proposes a profile, asks for the nightly window, then installs launchd plists with all routines marked first_run_dry.
---

# /routines-init — Install Nocturnal Routines

You are PolyForge's routines installer. Setup happens in one guided session with AskUserQuestion for every decision.

## Phase 0: Prerequisites

Check silently:
- `claude auth status` — parse JSON to get `subscriptionType` and `authMethod`
- `git --version` + `gh auth status` — required
- `launchctl print user/$(id -u)` — confirm launchd user session available

If `claude auth status` fails or is not logged in → stop with message "Please run `claude auth login` first".

## Phase 1: Plan detection

```bash
npx polyforge _plan-detect
```

This outputs a JSON object:
```json
{"ok": true, "plan": "team", "profile": "unleashed", "fallback": false, "authMethod": "claude.ai"}
```

Known mappings (handled inside `_plan-detect`):

| subscriptionType | Default profile |
|---|---|
| `pro` | light |
| `max`, `max_5x` | standard |
| `max_20x` | full |
| `team`, `enterprise` | unleashed |
| `apiKey` | budget-driven |
| unknown | `standard` + warn + log |

## Phase 2: Profile confirmation

Report the detected plan + proposed profile to the user. Call `AskUserQuestion`:

- Question: "Detected plan **{plan}** → proposed profile **{profile}**. Confirm?"
- Options: "Use {profile} (Recommended)" / "Pick a different profile" / "Other"
- If "Pick different" → second AskUserQuestion with the 5 profiles (light/standard/full/unleashed/budget-driven)

See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

## Phase 3: Nightly window

Call `AskUserQuestion` for the window start/end:

- Question: "When should routines run?"
- Options: "23:00 → 07:00 (Recommended)" / "00:00 → 06:00" / "22:00 → 05:00" / "Other"

If "Other" → user types `HH:MM-HH:MM`.

## Phase 4: Build config

```bash
npx polyforge _routines-build-config --profile {profile} --plan {plan} --start {HH:MM} --end {HH:MM}
```

Show the generated `routines` section. Call `AskUserQuestion`:

- Question: "Install this config?"
- Options: "Install" / "Edit first" / "Cancel" / "Other"

If "Edit first" → show path `polyforge.json`, user edits, re-run validation.

## Phase 5: Install

On confirmation:

1. Merge the generated `routines` block into `polyforge.json` (use Edit/Write tools — the validator runs at next load)
2. For each enabled routine, install the plist:
   ```bash
   npx polyforge _routines-install-plist --name <name> --schedule "<cron>" --project "$(pwd)"
   ```
3. (Optional) Bootstrap the `ready` label used by `issue-worker`:
   ```bash
   gh label create ready --description "Issue ready to be picked up by automation" --color 0E8A16 2>/dev/null || true
   ```
4. Run `launchctl load <plist-path>` for each installed plist (warn but don't fail if already loaded)

## Phase 6: First-run safety

All routines are installed with `first_run_dry: true`. Inform the user:

```
✓ Routines installed with first_run_dry=true.
  Every routine's first execution will run in dry mode.
  Review the output via /polyforge-routines-logs, then promote with:
    /polyforge-routines-manage promote-from-dry <name>
```

## Phase 7: Verify

Run `npx polyforge _routines-status` and show the output. Confirm all plists listed.

If anything fails: report which step, do NOT rollback automatically — ask the user if they want to rollback.
