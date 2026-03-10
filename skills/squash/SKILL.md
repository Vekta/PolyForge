---
name: squash
description: Use when the user asks to clean up, squash, reorganize, or rewrite commit history on the current branch before a PR. Groups messy commits into logical, reviewable units while preserving meaningful history.
---

# /squash — Commit Cleanup

You are PolyForge's commit organizer. You take a messy branch with many small commits (fix lint, fix test, retry, etc.) and reorganize them into clean, logical groups that tell a coherent story.

## Usage

```
/squash                     Clean up current branch against main/master
/squash origin/develop      Clean up against a specific base branch
```

## Process

### Step 1: Analyze Current Commits

```bash
# Detect base branch
git merge-base HEAD origin/main || git merge-base HEAD origin/master

# List all commits on this branch
git log --oneline --reverse origin/main..HEAD
```

Count the commits. If there are fewer than 3 commits, tell the user: "Only {N} commits — nothing to clean up." and stop.

### Step 2: Categorize Commits

Read each commit message and diff to understand what it does. Group them into logical categories:

1. **Schema / Infrastructure** — migrations, config changes, Docker, CI
2. **Core implementation** — models, services, business logic, domain
3. **API / Interface layer** — controllers, routes, UI components, views
4. **Tests** — test files, fixtures, test utilities
5. **Documentation** — docs, README, comments, changelogs
6. **Cleanup** — lint fixes, type fixes, formatting, import sorting

Commits in the **Cleanup** category should ALWAYS be squashed into the parent commit they fix — they are never standalone.

### Step 3: Propose a Plan

Present the reorganization plan using `AskUserQuestion` with options:

```
Current: 18 commits
Proposed: 4 commits

1. feat(db): add user preferences migration + model
   ← squashes: "add migration", "add model", "fix migration column type", "fix lint"

2. feat(api): add preferences endpoints + service
   ← squashes: "add service", "add controller", "add routes", "fix type error", "fix auth check"

3. test: add preference service and API tests
   ← squashes: "add tests", "fix test", "add missing fixture", "fix flaky test"

4. docs: update API documentation
   ← squashes: "update docs", "fix typo in docs"
```

Options:
1. Apply this plan
2. Show me the diffs per group first
3. Adjust grouping (describe what to change)

### Step 4: Execute the Rebase

Use a non-interactive rebase strategy. For each group, create a single squashed commit:

```bash
# Reset to base, then recommit in logical groups
git reset --soft $(git merge-base HEAD origin/main)

# Now all changes are staged — selectively commit by file groups
# Use git reset HEAD <files> and git add <files> to stage each logical group
```

Alternative approach if files map cleanly to groups:
```bash
git reset $(git merge-base HEAD origin/main)
# Stage and commit group by group
git add <schema files> && git commit -m "feat(db): ..."
git add <core files> && git commit -m "feat(api): ..."
git add <test files> && git commit -m "test: ..."
git add <doc files> && git commit -m "docs: ..."
```

If files don't map cleanly (same file modified across multiple logical changes), use `git add -p` to stage hunks selectively.

### Step 5: Verify

```bash
# Verify the diff is identical to before the rebase
git diff origin/main..HEAD --stat

# Run tests to make sure nothing broke
{test command from polyforge.json or auto-detect}
```

Show the final result:
```
Before: 18 commits
After: 4 commits
Diff: identical (no code changes lost)
Tests: passing
```

Ask: "Push with `--force-with-lease`?" (only if branch already has a remote)

### Step 6: Update PR Description

After pushing, check if a PR exists for this branch:

```bash
gh pr view --json number,title,body 2>/dev/null
```

If a PR exists, update its body to reflect the new commit structure:

1. Read the existing PR body with `gh pr view --json body`
2. **Preserve the entire existing template** — many teams use PR templates with checkboxes, sections, and Jira links. Never remove or reformat these.
3. Only update the sections that describe the changes (e.g., Summary, Changes, Description). Fill in checkboxes where appropriate (e.g., check "Bugfix" if it's a fix).
4. If there's no obvious place for a commit list, add a `## Changes` section right after the summary.
5. Append `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` at the bottom only if not already present.

```bash
gh pr edit --body "{updated body preserving template structure}"
```

**CRITICAL: Never overwrite the PR template.** The template belongs to the team. PolyForge fills it in — it does not replace it.

## Commit Message Format

Use conventional commits with a title AND a body for each squashed commit:

```
feat(scope): short description

- What was added/changed and why
- Key implementation details a reviewer should know
- Any non-obvious decisions made
```

Types:
- `feat(scope)` — new functionality
- `fix(scope)` — bug fix
- `refactor(scope)` — restructuring without behavior change
- `test(scope)` — test additions/changes
- `docs(scope)` — documentation only
- `chore(scope)` — config, CI, dependencies

## Important Behaviors

- NEVER squash everything into 1 commit — the goal is 3-7 logical commits, not 1
- NEVER lose code changes — verify the diff before and after is identical
- NEVER include `Co-Authored-By` in commit messages
- Cleanup commits (lint fix, type fix, formatting) are always absorbed into their parent — they never stand alone
- If a commit introduced a bug and another fixed it, squash them together
- Keep the original author's commit messages as inspiration for the final message — don't invent a different intent
- Use `--force-with-lease` (not `--force`) when pushing after rebase
- If the branch has no remote yet, just rebase locally — no push needed
