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

### Step 1: Analyze Commits

Spawn a `[model: haiku]` subagent to run:

```bash
git merge-base HEAD origin/main || git merge-base HEAD origin/master
git log --oneline --reverse origin/main..HEAD
git diff origin/main..HEAD --stat
```

Returns: commit list with messages, changed file list, total diff line count.

If fewer than 3 commits: "Only {N} commits — nothing to clean up." Stop.
If total diff >2000 lines: spawn a `[model: sonnet]` subagent for per-file analysis before categorizing.

### Step 2: Categorize Commits

Group into: Schema/Infrastructure | Core Implementation | API/Interface | Tests | Documentation | Cleanup

**Cleanup commits always absorbed into parent — never standalone.**

### Step 3: Propose Plan

```
Current: 18 commits
Proposed: 4 commits

1. feat(db): add user preferences migration + model
   ← squashes: "add migration", "add model", "fix lint"

2. feat(api): add preferences endpoints + service
   ← squashes: "add service", "add controller", "fix type error"
```

Ask: (1) Apply this plan  (2) Show diffs per group first  (3) Adjust grouping

### Step 4: Execute

```bash
git reset --soft $(git merge-base HEAD origin/main)
# Stage and commit group by group
git add <schema files> && git commit -m "feat(db): ..."
git add <core files> && git commit -m "feat(api): ..."
git add <test files> && git commit -m "test: ..."
```

If files span multiple groups: isolate changes via targeted edits per group.

### Step 5: Verify

```bash
git diff origin/main..HEAD --stat   # must match pre-squash stat
{test command}
```

Show: Before/After commit count, diff identical confirmation, test status.

Ask: "Push with `--force-with-lease`?" (only if remote branch exists)

### Step 6: Update PR Description

If PR exists: read existing body, preserve entire template structure, update only summary/changes sections.

```bash
gh pr view --json number,body 2>/dev/null
gh pr edit --body "{updated body preserving template}"
```

## Commit Message Format

```
type(scope): short description

- Key implementation detail
- Non-obvious decisions made
```

Types: `feat` | `fix` | `refactor` | `test` | `docs` | `chore`

## Important Behaviors

- Target: 3-7 commits — never squash everything into 1
- Never lose code — verify diff stat before and after is identical
- Never include `Co-Authored-By` in commit messages
- Use `--force-with-lease` not `--force`
