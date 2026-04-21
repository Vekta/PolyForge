---
name: routines-create
description: Use when the user wants to create a custom PolyForge routine for a project-specific need. Guides through scaffold selection (scan/fix/review/report), asks targeted questions via AskUserQuestion, then generates the prompt + config.
---

# /routines-create — Custom Routine Builder

You are PolyForge's custom routine generator. Single-session guided flow via AskUserQuestion.

## Phase 0: Prerequisites

- `polyforge.json` must have a `routines` section already (run `/polyforge-routines-init` first if not)
- At least one scaffold must exist in `templates/routines/_scaffolds/`

## Phase 1: Intent

Call `AskUserQuestion`:

- Question: "What should the routine DO?"
- Options: "Scan (report findings)" / "Fix (apply changes + PR)" / "Review (check PRs/issues)" / "Report (aggregate data)"
- This maps to the scaffold type.

See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

## Phase 2: Core fields

Ask ONE AskUserQuestion at a time for each of these in order:

1. **Routine name** (kebab-case): "What should the routine be called?" — validate `^[a-z][a-z0-9-]*$`
2. **Target**: scaffold-specific
   - scan → "What to scan?" (files, deps, API endpoints, custom)
   - fix → "What to fix?" (lint, formatting, typos, custom)
   - review → "What to review?" (PRs, issues, branches)
   - report → "What to aggregate?" (logs, metrics, git activity)
3. **Schedule** (cron-like): "When should it run?" — offer: "0 2 * * *" / "0 3 * * 0" (weekly) / "custom"
4. **Model**: "Which model?" — haiku (default) / sonnet / opus (for complex analysis only)
5. **Max turns**: "Max conversation turns?" — 5 / 10 / 20 / 50 / other
6. **Allowed tools**: "Which tools?" multi-select — Read / Write / Edit / Bash(git) / Bash(gh) / Bash(npm) / Glob / Grep

## Phase 3: Scaffold-specific fields

Map the user's answers into the placeholders required by the scaffold template:

### scan
- `SCAN_COMMAND` — specific shell command to run

### fix
- `DETECT_COMMAND`, `AREA`, `AUTO_MERGE_CONDITIONS`, `AUTO_MERGE_ALLOWLIST`

### review
- `TYPE` (pr/issue), `LIST_COMMAND`, `REVIEW_CHECKLIST`, `ALLOWLIST`

### report
- `REPORT_SOURCES`, `SOURCE_LIST` (bulleted list), `GROUPING_DIMENSION`

For each, use a free-form AskUserQuestion with a single "Describe" option + "Other" — per the rules in common-patterns.md.

## Phase 4: Preview + confirm

Show the generated prompt.md preview. Call `AskUserQuestion`:

- Question: "Generate this routine?"
- Options: "Generate & install plist" / "Generate but skip plist (manual install later)" / "Cancel" / "Other"

## Phase 5: Generate

On confirmation, run the generator via a one-off Node invocation (the generator lives in `lib/routines/generator.js` as an ESM export):

```bash
node --input-type=module -e "
  import('./lib/routines/generator.js').then(m =>
    console.log(JSON.stringify(m.generateRoutine({
      projectRoot: process.cwd(),
      scaffoldType: '{scaffoldType}',
      answers: {answersJson}
    }), null, 2))
  );
"
```

This:
- Fills the scaffold, writes `templates/routines/{name}/prompt.md`
- Adds the routine entry to `polyforge.json`

Then, if plist install requested:

```bash
npx polyforge _routines-install-plist --name {name} --schedule "{cron}" --project "$(pwd)"
```

New routine is marked `first_run_dry: true` by default — same safety net as bundled routines.

## Phase 6: Verify

Show:
- Path to the generated prompt.md
- The routine's config JSON
- Next step: "Run `/polyforge-routines-manage run-now {name} --dry` to test it before the nightly schedule picks it up."
