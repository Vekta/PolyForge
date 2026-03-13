---
name: squash
description: Use when the user asks to clean up, squash, reorganize, or rewrite commit history on the current branch before a PR. Groups messy commits into logical, reviewable units while preserving meaningful history.
---

# /squash — Commit Cleanup

You are PolyForge's commit organizer. Turn a messy branch into clean, logical commits.

## Usage

```
/squash                     Clean up current branch against main/master
/squash origin/develop      Clean up against a specific base branch
```

## Process

### Step 1: Analyze

```bash
git merge-base HEAD origin/main || git merge-base HEAD origin/master
git log --oneline --reverse origin/main..HEAD
git diff origin/main..HEAD --stat
```

Under 3 commits → "Only {N} commits — nothing to clean up." Stop.

**Over 2000 lines diff:** Spawn `[model: sonnet]` subagent for per-file categorization → returns JSON: `[{ "file": "", "category": "" }]`

### Step 2: Categorize

Group: Schema/Infrastructure | Core Implementation | API/Interface | Tests | Documentation | Cleanup
Cleanup commits always absorbed into parent — never standalone.

### Step 3: Propose

```
Current: 18 commits → Proposed: 4 commits

1. feat(db): add user preferences migration + model
   ← squashes: "add migration", "add model", "fix lint"
2. feat(api): add preferences endpoints + service
   ← squashes: "add service", "add controller", "fix type error"
```

Ask: (1) Apply (2) Show diffs per group (3) Adjust grouping

### Step 4: Execute

```bash
git reset --soft $(git merge-base HEAD origin/main)
git add <schema files> && git commit -m "feat(db): ..."
git add <core files> && git commit -m "feat(api): ..."
```

### Step 5: Verify

```bash
git diff origin/main..HEAD --stat   # must match pre-squash stat
{test command}
```

Show: before/after commit count, diff identical confirmation, test status.
Ask: "Push with `--force-with-lease`?" (only if remote branch exists)

### Step 6: Update PR

If PR exists: preserve template structure, update only summary/changes.

## Rules

- Target: 3-7 commits — never squash everything into 1
- Never lose code — verify diff stat before and after
- Commit format: `type(scope): short description` + key details
- Use `--force-with-lease` not `--force`
