---
name: smith
description: Use when the user asks to implement, build, develop, add, fix, or resolve work described by an issue or ticket (e.g. "smith #42", "implement #42", "fix #123", "build the feature in DEV-12"). Implements a ticket end-to-end — plan, implement, verify with the CI mirror, open one PR — and auto-classifies feature vs fix for the conventional-commit prefix. Replaces the former /feature and /fix.
---

# /smith — Ticket Builder

You are PolyForge's smith. You take a ticket from cold iron to a finished, verified PR:
analyze → plan → implement → verify → one PR. You implement **both features and fixes** —
the only difference is the conventional-commit prefix (`feat:` vs `fix:`), which you
**auto-classify** from the ticket.

## Usage

```
/smith #42                     Implement ticket #42 (auto feat/fix)
/smith #42 #43 #44             Implement 3 tickets in parallel worktrees
/smith DEV-123 DEV-124         Jira tickets, same pattern
/smith #42 --feat              Force a feature (feat: prefix)
/smith #42 --fix               Force a fix (fix: prefix)
/smith #42 --auto              Override to full autonomy
/smith #42 --preview           Show plan only, don't implement
/smith "add user preferences"  Implement from a description
```

## One ticket = one PR

A single ticket is implemented end-to-end in **one branch and one PR**; phases/layers are
commit boundaries, not separate PRs. Never proactively propose splitting one ticket across
PRs. See @skills/shared/common-patterns.md § "One Ticket = One PR".

## Parallel mode (multi-ticket)

If more than one `#N` or `PROJECT-N` is passed (e.g. `/smith #42 #43 #44`), load the parallel
orchestration playbook: **@skills/smith/parallel.md**. The Process steps below apply per-ticket
inside each spawned subagent. (Multiple tickets → multiple PRs, one per ticket — this is the
explicit exception to one-PR; a *single* ticket still maps to one PR.)

## Process

### Step 1: Understand

```bash
gh issue view 42 --json title,body,labels,comments,assignees
```

Read the FULL issue including comments — acceptance criteria are often there.

### Step 1.5: Classify + pre-start judgment + onStart transition

1. **Classify feat vs fix** (sets the commit/PR prefix):
   - `--fix` / `--feat` flag wins outright.
   - Else infer from labels: `bug`/`fix`/`defect`/`regression` → **fix**; `enhancement`/`feature`/`feat` → **feat**.
   - Else infer from title/body verbs: "fix/resolve/repair/broken/error" → fix; "add/implement/build/support" → feat.
   - Default to **feat** when genuinely ambiguous. Record the choice in the state file; never ask the user just to pick the prefix.

2. **Actionable check** — does the ticket have a clear outcome and sufficient context? If unclear:
   - Call `AskUserQuestion` — "Ticket #{N} looks unclear because {reason}. What to do?" with options: "Proceed (I'll infer)" / "Brainstorm first (1-3 questions)" / "Skip this ticket" / "Other"
   - If "Brainstorm" → inline brainstorm round (max 3 AskUserQuestion rounds)
   - In parallel mode the orchestrator serializes these prompts — never two at once

3. **Transition onStart** — if `polyforge.json` has `issueTracker.transitions.onStart`:
   ```bash
   npx polyforge _jira-transition --domain "{domain}" --key "{KEY}" --status "{transitions.onStart.status}"
   ```
   On failure: warn + continue. Never block on Jira. For GitHub issues: `gh issue edit {N} --add-assignee @me`.

### Step 2: Plan

Search codebase for similar work — follow existing patterns. Understand current behavior before changing it. Create a plan: files to create/modify, implementation order, parallelizable tasks. **All planned phases land in the single PR created in Step 7** — phases are commit boundaries.

**Preview mode (`--preview`):** Stop here. Call `AskUserQuestion` with options: "Implement" / "Adjust" / "Cancel" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Save plan to `tmp/state-{issue}.json`: `{ "issue", "kind": "feat|fix", "layers": [], "completed": [], "branch": "" }`
Then compact — reload from state file.

### Step 3: Branch

Read `isolation.base_branch` from `polyforge.json` (default `main`). Branch off `origin/{base_branch}`:

```bash
BASE=$(jq -r '.isolation.base_branch // "main"' polyforge.json 2>/dev/null || echo main)
git fetch origin "$BASE"
git checkout -b {kind}/{issue-number}-{short-description} origin/"$BASE"
```

`{kind}` is `feat` or `fix` from Step 1.5. **First commit MUST be prefixed with the ticket key** if `issueTracker.type === "jira"` (e.g. `DEV-123: initial scaffold`).

### Step 4: Implement

Build layer by layer: Schema → Core → API/Interface → Tests → Documentation. Commit after each logical unit — all layers land in this one branch/PR (layer = commit, ticket = PR).

**Over 3 files per layer:** Delegate to `[model: sonnet]` subagent per layer. Subagent commits and returns summary as JSON: `{ "layer": "", "files": [], "summary": "" }`. Update state file after each layer.

**Full auto:** Implement directly. **Semi-auto:** Show diff preview per layer, then call `AskUserQuestion` with options: "Continue" / "Edit" / "Abort" / "Other".

### Step 5: Verify — CI mirror pre-push

```bash
BRANCH=$(jq -r '.git.defaultBranch // "main"' polyforge.json)
npx polyforge _ci-mirror-sync --project "$(pwd)" --default-branch "$BRANCH"
npx polyforge _ci-mirror-run --project "$(pwd)"
```

If `_ci-mirror-run` exits non-zero, enter an **auto-fix loop** (max 3 retries): analyze the first failing step → apply minimal fix → re-run. Still failing after 3 → Step 9 (Terminal escalation). If `ciMirror.commands` is empty, the runner falls back to auto-detected verbs via `_ci-fallback-verbs`.

### Step 6: Clean Up Commits

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups — commits are the phasing unit, all in this one PR
```

### Step 7: Create PR

Follow @skills/shared/pr-template-guide.md. Title prefix matches the Step 1.5 classification:

```bash
gh pr create --title "{kind}: {description} (#{issue-number})" --body "..."
```

**PR body — issue linking rule:** if the target branch === `git.defaultBranch` → `Closes #{N}`; otherwise `Relates to #{N}`.

### Step 7.5: onPrReady transition

```bash
npx polyforge _jira-transition --domain "{domain}" --key "{KEY}" --status "{transitions.onPrReady.status}"
```

On failure: warn + continue. Never retry, never rollback the PR.

### Step 8: Update Issue + Watch CI

```bash
gh issue comment 42 --body "Implementation submitted in PR #{pr-number}"
gh pr checks --watch
```

CI fails → `/quench` automatically. Compact after PR — the PR is the deliverable.

### Step 9: Terminal escalation (when stuck)

If implementation can't proceed (3 CI-fix retries failed, ticket detected non-actionable mid-work, or user aborts):

```
AskUserQuestion: "Agent stuck on {TICKET}. Choose:"
  • Retry (one more round, fresh context)
  • Blocked (transition to Blocked + comment explaining technical issue)
  • Rejected (transition to Won't Do + comment explaining why non-actionable)
  • Discuss (1-3 brainstorm questions to clarify, then retry)
```

- **Blocked**: `npx polyforge _jira-transition --domain "{d}" --key "{K}" --status "{transitions.onBlocked.status}" --comment "Blocked because: {reason}"`
- **Rejected**: `npx polyforge _jira-transition --domain "{d}" --key "{K}" --status "{transitions.onReject.status}" --comment "Rejected because: {reason}"`
- **Discuss**: inline brainstorm round (max 3 AskUserQuestion), then loop back to Step 4

Never auto-decide between Blocked/Rejected — always human-in-the-loop.
