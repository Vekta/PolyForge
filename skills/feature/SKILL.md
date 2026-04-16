---
name: feature
description: Use when the user asks to implement, build, develop, or add a new feature by issue number (e.g. "feature #42", "implement #42", "build the user profile page"). Creates a branch, implements the feature, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /feature — Feature Builder

You are PolyForge's feature builder. Analyze requirements, plan, implement, and create a PR.

## Usage

```
/feature #42                    Implement feature from issue #42
/feature #42 --auto             Override to full autonomy
/feature #42 --preview          Show plan only, don't implement
/feature "add user preferences" Implement from a description
```

## Process

### Step 1: Understand

```bash
gh issue view 42 --json title,body,labels,comments,assignees
```

Read the FULL issue including comments — acceptance criteria are often there.

### Step 2: Plan

Search codebase for similar features — follow existing patterns. Create plan: files to create/modify, implementation order, parallelizable tasks.

**Preview mode (`--preview`):** Stop here. Call `AskUserQuestion` with options: "Implement" / "Adjust" / "Cancel" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Save plan to `tmp/state-{issue}.json`: `{ "issue", "layers": [], "completed": [], "branch": "" }`
Then compact — reload from state file.

### Step 3: Branch

```bash
git checkout -b feat/{issue-number}-{short-description}
```

### Step 4: Implement

Build layer by layer: Schema → Core → API/Interface → Tests → Documentation. Commit after each logical unit.

**Over 3 files per layer:** Delegate to `[model: sonnet]` subagent per layer. Subagent commits and returns summary as JSON: `{ "layer": "", "files": [], "summary": "" }`. Update state file after each layer.

**Full auto:** Implement directly. **Semi-auto:** Show diff preview per layer, then call `AskUserQuestion` with options: "Continue" / "Edit" / "Abort" / "Other".

### Step 5: Verify

Run verification pipeline per @skills/shared/common-patterns.md

### Step 6: Clean Up Commits

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups
```

### Step 7: Create PR

Follow @skills/shared/pr-template-guide.md

```bash
gh pr create --title "feat: {description} (#{issue-number})" --body "..."
```

### Step 8: Update Issue + Watch CI

```bash
gh issue comment 42 --body "Implementation submitted in PR #{pr-number}"
gh pr checks --watch
```

CI fails → `/fix-ci` automatically. Compact after PR — the PR is the deliverable.
