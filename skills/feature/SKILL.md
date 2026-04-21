---
name: feature
description: Use when the user asks to implement, build, develop, or add a new feature by issue number (e.g. "feature #42", "implement #42", "build the user profile page"). Creates a branch, implements the feature, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /feature — Feature Builder

You are PolyForge's feature builder. Analyze requirements, plan, implement, and create a PR.

## Usage

```
/feature #42                    Implement feature from issue #42
/feature #42 #43 #44            Implement 3 features in parallel worktrees
/feature DEV-123 DEV-124        Jira tickets, same pattern
/feature #42 --auto             Override to full autonomy
/feature #42 --preview          Show plan only, don't implement
/feature "add user preferences" Implement from a description
```

## Parallel mode (multi-ticket)

If more than one `#N` or `PROJECT-N` is passed (e.g. `/feature #42 #43 #44`), load the parallel orchestration playbook: **@skills/feature/parallel.md**

The main Process steps below apply per-ticket inside each spawned subagent.

## Process

### Step 1: Understand

```bash
gh issue view 42 --json title,body,labels,comments,assignees
```

Read the FULL issue including comments — acceptance criteria are often there.

### Step 1.5: Pre-start LLM judgment + onStart transition

Before committing to an implementation path:

1. **Actionable check** — judge yourself: does the ticket have a clear outcome and sufficient context? If unclear:
   - Call `AskUserQuestion` — "Ticket #{N} looks unclear because {reason}. What to do?" with options: "Proceed (I'll infer)" / "Brainstorm first (1-3 questions)" / "Skip this ticket" / "Other"
   - If "Brainstorm" → inline brainstorm round (max 3 AskUserQuestion rounds)
   - **In parallel mode** (`/feature #10 #11 #12`), the orchestrator serializes these prompts — never two at once

2. **Transition onStart** — if `polyforge.json` has `issueTracker.transitions.onStart`:
   ```bash
   npx polyforge _jira-transition --domain "{domain}" --key "{KEY}" --status "{transitions.onStart.status}"
   ```
   On failure: warn + continue. Never block on Jira.

   For GitHub issues: `gh issue edit {N} --add-assignee @me`.

### Step 2: Plan

Search codebase for similar features — follow existing patterns. Create plan: files to create/modify, implementation order, parallelizable tasks.

**Preview mode (`--preview`):** Stop here. Call `AskUserQuestion` with options: "Implement" / "Adjust" / "Cancel" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Save plan to `tmp/state-{issue}.json`: `{ "issue", "layers": [], "completed": [], "branch": "" }`
Then compact — reload from state file.

### Step 3: Branch

Read `isolation.base_branch` from `polyforge.json` (default `main`). Branch off `origin/{base_branch}`:

```bash
BASE=$(jq -r '.isolation.base_branch // "main"' polyforge.json 2>/dev/null || echo main)
git fetch origin "$BASE"
git checkout -b feat/{issue-number}-{short-description} origin/"$BASE"
```

**First commit MUST be prefixed with the ticket key** if `issueTracker.type === "jira"` (e.g. `DEV-123: initial scaffold`). Works even if Smart Commits disabled — just extra trace.

### Step 4: Implement

Build layer by layer: Schema → Core → API/Interface → Tests → Documentation. Commit after each logical unit.

**Over 3 files per layer:** Delegate to `[model: sonnet]` subagent per layer. Subagent commits and returns summary as JSON: `{ "layer": "", "files": [], "summary": "" }`. Update state file after each layer.

**Full auto:** Implement directly. **Semi-auto:** Show diff preview per layer, then call `AskUserQuestion` with options: "Continue" / "Edit" / "Abort" / "Other".

### Step 5: Verify — CI mirror pre-push

Run the project's actual CI commands locally before pushing. PolyForge handles this via:

```bash
# Hash-gated sync: only re-parse workflows if they changed
BRANCH=$(jq -r '.git.defaultBranch // "main"' polyforge.json)
npx polyforge _ci-mirror-sync --project "$(pwd)" --default-branch "$BRANCH"

# Run the mirrored commands (ciMirror.commands[] ∪ learnedCommands[])
npx polyforge _ci-mirror-run --project "$(pwd)"
```

If `_ci-mirror-run` exits non-zero, enter an **auto-fix loop** (max 3 retries):
1. Analyze the failing command's stderr/stdout (first failing step)
2. Apply minimal fix
3. Re-run `_ci-mirror-run`
4. If still failing after 3 retries → Step 9 (Terminal escalation)

If `ciMirror.commands` is empty (no CI detected), the runner falls back to auto-detected verbs via `_ci-fallback-verbs` (package.json/composer.json/go.mod/pyproject.toml/Gemfile/Cargo.toml). See @skills/shared/common-patterns.md for the fallback table.

### Step 6: Clean Up Commits

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups
```

### Step 7: Create PR

Follow @skills/shared/pr-template-guide.md

**PR body — issue linking rule** :

```
DEFAULT_BRANCH=$(jq -r '.git.defaultBranch // "main"' polyforge.json)
TARGET_BRANCH={base_branch from Step 3}
```

- If `TARGET_BRANCH === DEFAULT_BRANCH` → include `Closes #{N}` in PR body (GitHub auto-close works on merge to default)
- Otherwise → include `Relates to #{N}` (no premature close on intermediate branches)

```bash
gh pr create --title "feat: {description} (#{issue-number})" --body "..."
```

### Step 7.5: onPrReady transition

After PR created, if Jira transitions configured:

```bash
npx polyforge _jira-transition --domain "{domain}" --key "{KEY}" --status "{transitions.onPrReady.status}"
```

On failure: warn + continue. Never retry, never rollback the PR.

### Step 8: Update Issue + Watch CI

```bash
gh issue comment 42 --body "Implementation submitted in PR #{pr-number}"
gh pr checks --watch
```

CI fails → `/fix-ci` automatically. Compact after PR — the PR is the deliverable.

### Step 9: Terminal escalation (when stuck)

If the implementation can't proceed after reasonable attempts (3 CI-fix retries failed, ticket detected as non-actionable mid-work, or user aborts):

```
AskUserQuestion: "Agent stuck on {TICKET}. Choose:"
  • Retry (one more round, fresh context)
  • Blocked (transition to Blocked + comment explaining technical issue)
  • Rejected (transition to Won't Do + comment explaining why non-actionable)
  • Discuss (1-3 brainstorm questions to clarify, then retry)
```

Respective actions:
- **Blocked**:
  ```bash
  npx polyforge _jira-transition --domain "{d}" --key "{K}" --status "{transitions.onBlocked.status}" --comment "Blocked because: {reason}"
  ```
- **Rejected**:
  ```bash
  npx polyforge _jira-transition --domain "{d}" --key "{K}" --status "{transitions.onReject.status}" --comment "Rejected because: {reason}"
  ```
- **Discuss**: run an inline brainstorm round (max 3 AskUserQuestion), then loop back to Step 4

Never auto-decide between Blocked/Rejected — always human-in-the-loop.
