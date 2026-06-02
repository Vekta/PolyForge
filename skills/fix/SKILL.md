---
name: fix
description: Use when the user asks to fix, resolve, or work on a specific issue by number (e.g. "fix #123", "resolve issue 45"). Creates a branch, implements the fix, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /fix — Issue Fixer

You are PolyForge's issue fixer. Analyze the issue, implement a fix, verify it, and create a PR.

## Usage

```
/fix #123                    Fix issue #123
/fix #123 #124 #125          Fix 3 issues in parallel worktrees
/fix DEV-42 DEV-43           Jira tickets, same pattern
/fix #123 --auto             Override to full autonomy
/fix #123 --preview          Show plan only, don't implement
```

## Parallel mode

Same mechanism as `/feature` parallel mode — see `skills/feature/SKILL.md` section "Parallel mode (multi-ticket)". Use `--kind fix` with `_parallel-plan`. Brainstorms serialized, tests gated by `parallelism.mode`.

## Process

### Step 1: Fetch Issue

```bash
# GitHub
gh issue view 123 --json title,body,labels,comments,assignees
# Jira
curl "https://{domain}.atlassian.net/rest/api/3/issue/{key}" -H "Authorization: Basic {credentials}"
```

Read full issue including comments.

### Step 1.5: Pre-start LLM judgment + onStart transition

1. **Actionable check** — is the issue clear enough to fix? If unclear (vague repro, missing context), call `AskUserQuestion` — "Issue #{N} looks unclear because {reason}. What to do?" with options "Proceed (I'll infer)" / "Brainstorm first" / "Skip" / "Other". In parallel mode orchestrator sequentializes.
2. **Transition onStart** — if `polyforge.json` has `issueTracker.transitions.onStart`:
   ```bash
   npx polyforge _jira-transition --domain "{domain}" --key "{KEY}" --status "{transitions.onStart.status}"
   ```
   On failure: warn + continue.

### Step 2: Plan

Search codebase for relevant files (use issue keywords). Understand current behavior before planning.

Save to `tmp/state-{issue}.json`: `{ "issue", "files_to_modify": [], "tests_to_add": [], "branch": "" }`
Then compact — reload from state file.

**Preview mode (`--preview`):** Stop here and display the plan.

### Step 3: Branch + Implement

Read `isolation.base_branch` from `polyforge.json` (default `main`). Branch off `origin/{base_branch}`:

```bash
BASE=$(jq -r '.isolation.base_branch // "main"' polyforge.json 2>/dev/null || echo main)
git fetch origin "$BASE"
git checkout -b fix/{issue-number}-{short-description} origin/"$BASE"
```

**First commit prefixed with `{TICKET-KEY}:` if Jira.**

**Full auto:** Implement directly + write tests. **Semi-auto:** Show diff, then call `AskUserQuestion` with options: "Apply" / "Edit" / "Abort" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

**Independent file groups (>3 files):** Delegate each group to `[model: sonnet]` subagent. Returns: `{ "group": "", "files": [], "summary": "" }`

**One ticket = one PR.** Implement the whole fix — every phase — in this single branch/PR. Phases are commit boundaries, not separate PRs; never propose splitting one ticket across PRs. See @skills/shared/common-patterns.md § "One Ticket = One PR".

### Step 4: Verify — CI mirror pre-push

```bash
BRANCH=$(jq -r '.git.defaultBranch // "main"' polyforge.json)
npx polyforge _ci-mirror-sync --project "$(pwd)" --default-branch "$BRANCH"
npx polyforge _ci-mirror-run --project "$(pwd)"
```

On failure: auto-fix loop (max 3 retries). Still failing → Step 7 (Terminal escalation).

Fallback verbs (package.json/composer.json/go.mod/etc.) kick in if no CI config detected.

### Step 5: Clean Up + PR

All phases land in this one PR — re-group the work into clean atomic commits (the phasing unit), not multiple PRs.

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups
```

Follow @skills/shared/pr-template-guide.md

**PR body — issue linking rule** :
- If `TARGET_BRANCH === git.defaultBranch` → `Closes #{N}` (GitHub auto-close works)
- Otherwise → `Relates to #{N}`

```bash
gh pr create --title "fix: {description} (#{issue-number})" --body "..."
gh issue comment 123 --body "Fix submitted in PR #{pr-number}"
gh pr checks --watch
```

### Step 6: onPrReady transition

```bash
npx polyforge _jira-transition --domain "{d}" --key "{K}" --status "{transitions.onPrReady.status}"
```

On failure: warn + continue.

### Step 7: Terminal escalation (when stuck)

If 3 CI-fix retries fail, or the issue is detected mid-work as non-actionable, or user aborts:

```
AskUserQuestion: "Agent stuck on {TICKET}. Choose:"
  • Retry / Blocked (transition) / Rejected (transition) / Discuss (brainstorm round)
```

Blocked / Rejected both use `_jira-transition` with the appropriate status + `--comment "Reason: ..."`. Never auto-decide — always human-in-the-loop.

CI fails → `/fix-ci` automatically. Compact after PR — the PR is the deliverable.
