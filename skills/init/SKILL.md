---
name: forge
description: Use when the user asks to initialize, set up, or configure PolyForge for a project, or when starting work on a project with no .claude/polyforge.json. Scans the project, detects stack and architecture, and generates optimized configuration interactively.
---

# /forge — Project Configuration

You are PolyForge's project initializer. Scan, detect, ask targeted questions, generate config.

## Phase 0: Prerequisites

Run silently — warn if missing, stop only if `git` absent:
- `git --version` — required
- `gh auth status` — warn if absent
- `glab auth status` — only if GitLab remote
- Jira — only if `.jira` or `JIRA_URL` detected

## Phase 1: Detection

Spawn `[model: haiku]` subagent → returns detection JSON only:
```json
{ "stack": [], "framework": "", "packageManager": "", "architecture": "", "database": { "type": "", "connectionMethod": "", "containerName": "" }, "testing": { "framework": "", "commands": {} }, "issueTracker": { "type": "", "config": {} }, "ciFile": "", "existingClaude": false, "existingPolyforge": false }
```

Subagent scans: package files, docker-compose, .env.*, framework configs, git log, issue list.
**Discard all raw scan output — use only the JSON.**

If existing `.claude/` (not PolyForge): backup to `tmp/backup-{date}/.claude/`, inform user.

### Phase 1b: Dev-workflow discovery (parallel)

After Phase 1, run these in **parallel** (Bash tool calls in one message):

```bash
npx polyforge _resolve-default-branch "$(pwd)"
npx polyforge _detect-parallelism "$(pwd)"
npx polyforge _detect-migrations "$(pwd)"
```

Then (needs the default branch from the first call):

```bash
npx polyforge _parse-workflows --project "$(pwd)" --default-branch {resolved_default_branch}
```

And, **only if** `issueTracker.type === "jira"` AND `JIRA_API_TOKEN` env is set:

```bash
npx polyforge _fetch-jira-statuses --domain {domain} --project-key {projectKey} --email {email}
```

Parse each JSON output. For the workflow parser, collect any `warnings[]` (third-party actions) — they are **informational only**, the learning loop will cover them later.

## Phase 2: Questions (ONE AT A TIME, via AskUserQuestion)

Show detection summary, then ask only what wasn't detected. **Every question is an `AskUserQuestion` tool call** — never emit inline `(1)/(2)` menus in chat. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Sequence (one AskUserQuestion call each, wait for answer before the next):

1. Stack confirmation — options: "Correct" / "Add other repos" / "Different" / "Other"
2. Architecture pattern — options: detected pattern / "Not exactly" / "Other"
3. Issue tracker — options: detected tracker / "Different" / "Other"
4. Autonomy — options: "Full auto (recommended)" / "Semi-auto" / "Other"
5. (Full auto only) File access — options: "Grant full access" / "Decline" / "Other"
6. **Parallelism mode** — detector proposed `{suggestedMode}` because `{reasons}`. Options: "Use {suggestedMode} (Recommended)" / "Force full parallel" / "Force serialized" / "Other". If `pnpmWarning` present, mention it in the question context.
7. **Jira transitions** (Jira only, 4 sequential questions) — for each of `onStart`, `onPrReady`, `onBlocked`, `onReject`: "Target status for {transition} ?" with options from the statuses list returned by `_fetch-jira-statuses`. If Jira creds missing, skip these and store `transitions: null` (transitions disabled, no-op in /fix /feature).
8. Additional conventions — options: "None" / "Describe" / "Other"
9. Generate docs now — options: "Yes" / "Skip" / "Other"

## Phase 3: Generate

List the files to create (plain text, no table of choices). Then ask via AskUserQuestion: "Proceed with file generation?" — options: "Proceed" / "Adjust list" / "Cancel" / "Other". Backup existing files to `tmp/backup-{date}/`.

Create:
- `polyforge.json` — master config (at repo root, NOT inside `.claude/`)
- `CLAUDE.md` — short (<200 lines), `@` refs to detailed docs, include PolyForge commands
- `.claude/rules/` — scoped rules with `paths:` frontmatter
- `.claude/settings.json` — stack-aware Bash permission allowlist (see below)
- `docs/CONTEXT.md` — architecture details
- `tmp/` + `.gitignore` entry

### Permission allowlist (reduces worktree friction)

Worktree sessions (`/review`, `/fix`, `/feature`) often need `ln`/`rm`/`mkdir`/`touch`
(the vendor-symlink dance) plus the stack's package manager (`composer`, `npm`, `pnpm`, …),
none of which are in the default `allowedTools`. Compute the recommended set from the
Phase 1 detection JSON and **offer** to write it — never write silently:

```bash
npx polyforge _recommend-allowlist --project "$(pwd)" --detection '{detection JSON from Phase 1}'
```

This prints `patterns[]` (dry-run, nothing written). Show the patterns, then call
`AskUserQuestion`: "Add these Bash permissions to `.claude/settings.json`?" — options:
"Add them (Recommended)" / "Skip" / "Other". On "Add them", re-run with `--write`. The
merge is non-destructive: existing `permissions.allow` entries and unrelated keys are kept.

The generated `polyforge.json` includes a new **`schemaVersion: "1.1.0"`** stamp and these new sections derived from Phase 1b:

```json
{
  "schemaVersion": "1.1.0",
  "git": { "defaultBranch": "{resolvedBranch}", "defaultBranchCachedAt": "{ISO}" },
  "pipeline": {
    "ciMirror": {
      "source": "{firstWorkflowFile}",
      "sourceHash": "{hash}",
      "triggerFilter": ["pull_request", "push_default"],
      "commands": [ ... from parser ... ],
      "learnedCommands": [],
      "excludePatterns": ["^deploy", "^release", "^npm publish", "^docker push"],
      "learningConsent": "unasked"
    }
  },
  "parallelism": {
    "mode": "{confirmedMode}",
    "reason": "{reasons joined}",
    "maxConcurrent": {suggestedMaxConcurrent},
    "testLockPath": "~/.polyforge/ci-mirror.lock"
  },
  "issueTracker": {
    "type": "...",
    "transitions": { "onStart": {"status": "..."}, ... }
  }
}
```

Log to `tmp/forge-log-{date}.md`. End with: "**Restart Claude Code** to load new configuration."

## Phase 4: Refresh (2nd+ run)

If `polyforge.json` already exists, do **not** regenerate from scratch. Instead:

1. Run `npx polyforge _detect-migrations "$(pwd)"` — shows any pending schema migration.
2. If migrations needed AND `clean.clean === false`: stop, tell the user "polyforge.json has uncommitted changes. Commit or stash first, then re-run `/forge`."
3. If migrations AND clean: show the `diff` via AskUserQuestion "Apply these migrations? [Apply / Show full diff / Cancel / Other]".
4. On Apply → `npx polyforge _apply-migrations "$(pwd)"`.
5. Re-run Phase 1b to refresh CI-mirror commands (the hash-gate will no-op if nothing changed).
6. AskUserQuestion: "Anything else to refresh? [Parallelism mode / Jira transitions / Nothing, done / Other]"
