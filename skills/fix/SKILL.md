---
name: fix
description: Use when the user asks to fix, resolve, or work on a specific issue by number (e.g. "fix #123", "resolve issue 45"). Creates a branch, implements the fix, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /fix — Issue Fixer

You are PolyForge's issue fixer. Analyze the issue, implement a fix, verify it, and create a PR.

## Usage

```
/fix #123                    Fix issue #123
/fix #123 --auto             Override to full autonomy
/fix #123 --preview          Show plan only, don't implement
```

## Process

### Step 1: Fetch Issue Details

```bash
# GitHub
gh issue view 123 --json title,body,labels,comments,assignees

# Jira
curl "https://{domain}.atlassian.net/rest/api/3/issue/{key}" -H "Authorization: Basic {credentials}"
```

Read the full issue including comments — context is often in comments.

### Step 2: Analyze & Plan

1. Read `CLAUDE.md` and `.claude/polyforge.json`
2. Search the codebase for relevant files (use issue keywords)
3. Understand current behavior before planning changes
4. Create a plan: files to modify, changes to make, tests to add

**After plan approval:** Save to `tmp/state-{issue}.json`:
```json
{ "issue": 123, "files_to_modify": [], "tests_to_add": [], "branch": "" }
```
Then compact — reload only from the state file.

**Preview mode (`--preview`):** Stop here and display the plan.

### Step 3: Create Branch

```bash
git checkout -b fix/{issue-number}-{short-description}
```

### Step 4: Implement Fix

**Full auto:** Implement directly, write/update tests, run pipeline, create PR.
**Semi-auto:** Show diff preview, ask "Apply? (y/n/edit)", then run pipeline.

If the fix involves independent file groups: delegate each to a `[model: sonnet]` subagent.

### Step 5: Verification Pipeline

```bash
{test command} 2>&1 | bash hooks/filter-test-output.sh
{lint command}
{typecheck command}
{vulncheck command}
```

If any fails: fix (up to 2 retries). Same error + same approach twice → switch strategy. After 3 total attempts:
- 🟢 Quick fix → fix it now
- 🟡 Needs investigation → create issue via `/report-issue`
- 🔴 Pre-existing/infra → create issue via `/report-issue` tagged infra

### Step 6: Clean Up Commits

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups (cleanup commits absorbed into parent)
```

### Step 7: Create PR

Follow @skills/shared/pr-template-guide.md

```bash
gh pr create --title "fix: {description} (#{issue-number})" --body "..."
```

### Step 8: Update Issue

```bash
gh issue comment 123 --body "Fix submitted in PR #{pr-number}"
# Jira: jira issue move {key} "In Review" && jira issue comment add {key} "PR #{pr-number}"
```

### Step 9: Watch CI

```bash
gh pr checks --watch
```

CI fails → run `/fix-ci` automatically.

## Context Management

- After plan approval: compact, reload from `tmp/state-{issue}.json`
- Subagents `[model: sonnet]` for independent file groups — returns summary only
- After PR is created, compact — the PR is the deliverable
