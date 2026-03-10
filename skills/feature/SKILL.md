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

### Step 1: Understand the Feature

```bash
gh issue view 42 --json title,body,labels,comments,assignees
```

Read the FULL issue including comments — acceptance criteria and clarifications are often there.

### Step 2: Research & Plan

1. Read `CLAUDE.md` and `.claude/polyforge.json`
2. Search the codebase for similar features — follow existing patterns
3. Create a plan: files to create, files to modify, implementation order, parallelizable tasks

**Preview mode (`--preview`):** Stop here. Ask: (1) Looks good → implement (2) Adjust → describe (3) Cancel

**After plan approval:** Save to `tmp/state-{issue}.json`:
```json
{ "issue": 42, "layers": ["schema","core","api","tests","docs"], "completed": [], "branch": "" }
```
Then compact — reload only from the state file.

### Step 3: Create Branch

```bash
git checkout -b feat/{issue-number}-{short-description}
```

### Step 4: Implement Incrementally

Build layer by layer: Schema → Core → API/Interface → Tests → Documentation. Commit after each logical unit.

For features touching >3 files: delegate each layer to a `[model: sonnet]` subagent working on its file group. Subagents commit their layer and return a summary. Update `tmp/state-{issue}.json` after each layer.

**Full auto:** Implement directly.
**Semi-auto:** Show diff preview after each layer, ask "Continue? (y/n/edit)"

### Step 5: Verification Pipeline

```bash
{test command} 2>&1 | bash hooks/filter-test-output.sh
{lint command}
{typecheck command}
{vulncheck command}
```

If any fails: fix automatically (up to 2 retries). Same error + same approach twice → switch strategy. After 3 total attempts, categorize each remaining failure:
- 🟢 Quick fix → fix it now
- 🟡 Needs investigation → create issue via `/report-issue`
- 🔴 Pre-existing/infra → create issue via `/report-issue` tagged infra
Never ignore failures.

### Step 6: Clean Up Commits

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups by staging files per group
```

### Step 7: Create PR

Follow @skills/shared/pr-template-guide.md

```bash
gh pr create --title "feat: {description} (#{issue-number})" --body "..."
```

### Step 8: Update Issue

```bash
gh issue comment 42 --body "Implementation submitted in PR #{pr-number}"
# Jira: jira issue move {key} "In Review" && jira issue comment add {key} "PR #{pr-number}"
```

### Step 9: Watch CI

```bash
gh pr checks --watch
```

CI fails → run `/fix-ci` automatically. Do not leave the PR with failing CI.

## Context Management

- After plan approval: compact, reload from `tmp/state-{issue}.json`
- Subagents `[model: sonnet]` for feature layers touching >3 files — returns layer summary only
- After PR is created, compact — the PR is the deliverable
