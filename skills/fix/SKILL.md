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

### Step 1: Fetch Issue

```bash
# GitHub
gh issue view 123 --json title,body,labels,comments,assignees
# Jira
curl "https://{domain}.atlassian.net/rest/api/3/issue/{key}" -H "Authorization: Basic {credentials}"
```

Read full issue including comments.

### Step 2: Plan

Search codebase for relevant files (use issue keywords). Understand current behavior before planning.

Save to `tmp/state-{issue}.json`: `{ "issue", "files_to_modify": [], "tests_to_add": [], "branch": "" }`
Then compact — reload from state file.

**Preview mode (`--preview`):** Stop here and display the plan.

### Step 3: Branch + Implement

```bash
git checkout -b fix/{issue-number}-{short-description}
```

**Full auto:** Implement directly + write tests. **Semi-auto:** Show diff, ask "Apply? (y/n/edit)".

**Independent file groups (>3 files):** Delegate each group to `[model: sonnet]` subagent. Returns: `{ "group": "", "files": [], "summary": "" }`

### Step 4: Verify

Run verification pipeline per @skills/shared/common-patterns.md

### Step 5: Clean Up + PR

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Re-commit in 3-7 logical groups
```

Follow @skills/shared/pr-template-guide.md

```bash
gh pr create --title "fix: {description} (#{issue-number})" --body "..."
gh issue comment 123 --body "Fix submitted in PR #{pr-number}"
gh pr checks --watch
```

CI fails → `/fix-ci` automatically. Compact after PR — the PR is the deliverable.
