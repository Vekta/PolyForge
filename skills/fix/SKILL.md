---
name: fix
description: Use when the user asks to fix, resolve, or work on a specific issue by number (e.g. "fix #123", "resolve issue 45"). Creates a branch, implements the fix, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /fix — Issue Fixer

You are PolyForge's issue fixer. Given an issue number, you analyze it, implement a fix, verify it, and create a PR — respecting the project's configured autonomy level.

## Usage

```
/fix #123                    Fix issue #123
/fix #123 --auto             Override to full autonomy for this fix
/fix #123 --preview          Show plan only, don't implement
```

## Process

### Step 1: Fetch Issue Details

**GitHub:**
```bash
gh issue view 123 --json title,body,labels,comments,assignees
```

**Jira:**
```bash
curl "https://{domain}.atlassian.net/rest/api/3/issue/{key}" \
  -H "Authorization: Basic {credentials}"
```

Parse the issue to understand:
- What's broken or requested
- Reproduction steps (if any)
- Severity and priority
- Related files mentioned

### Step 2: Analyze & Plan

1. Read the project context from `CLAUDE.md` and `.claude/polyforge.json`
2. Search the codebase for relevant files (use issue description + keywords)
3. Understand the current behavior by reading the code
4. Create a fix plan:
   - Which files to modify
   - What changes to make
   - Which tests to add/modify
   - Which tasks can be parallelized

**Preview mode (`--preview`):** Stop here and display the plan.

### Step 3: Create Worktree Branch

```bash
# Create a fix branch
git checkout -b fix/{issue-number}-{short-description}
```

Use Claude Code worktree for isolated work when available.

### Step 4: Implement Fix

Based on autonomy level from `.claude/polyforge.json`:

**Full auto (`autonomy: "full"`):**
- Implement the fix directly
- Write/update tests
- Run the full pipeline (test + lint + vulncheck)
- Fix any pipeline failures
- Create the PR

**Semi-auto (`autonomy: "semi"`):**
- Show the proposed changes as a diff preview
- Ask: "Apply these changes? (y/n/edit)"
- After approval, run pipeline
- Show PR preview, ask: "Create this PR? (y/n/edit)"

### Step 5: Verification Pipeline

Run ALL of these before creating the PR:

```bash
# 1. Tests
{detected test command from polyforge.json}

# 2. Linter
{detected lint command}

# 3. Type checking (if applicable)
{detected typecheck command}

# 4. Vulnerability check (if applicable)
{detected vulncheck command}
```

If any step fails:
- Attempt to fix automatically (up to 2 retries)
- Same error with same approach twice → try a different angle, do not repeat
- After 2 failed attempts, compact context before the 3rd try
- If still failing after 3 total attempts, show the error and ask for guidance — do not loop further

### Step 6: Clean Up Commits

Before creating the PR, reorganize commits into logical groups (3-7 commits max). Use `git rebase -i main` to:
- Squash "fix lint", "fix type", "fix test" into the parent commit they correct
- Keep meaningful commits separate: schema/migration, core logic, API layer, tests
- Use `git commit --fixup <SHA>` during development for correction commits, then `git rebase -i --autosquash main` to clean up

Target: each commit in the PR should be one reviewable, revertible logical unit.

### Step 7: Create PR

```bash
gh pr create \
  --title "fix: {short description} (#{issue-number})" \
  --body "$(cat <<'EOF'
## Summary
{what was fixed and how}

## Changes
- `{file}`: {description of change}

## Testing
- {tests added/modified}
- All existing tests pass

## Issue
Closes #{issue-number}

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
EOF
)"
```

### Step 7: Update Issue

**GitHub:**
```bash
gh issue comment 123 --body "Fix submitted in PR #{pr-number}"
```

**Jira:** Update issue status to "In Review" and link the PR.

## Context Management

- If the fix plan identifies independent file groups, delegate implementation of each group to a subagent
- After the PR is created, compact the conversation — the PR is the deliverable
- For large fixes, use worktrees via `EnterWorktree` to isolate changes

## Important Behaviors

- Read the FULL issue including comments — context is often in comments
- Check if someone else is already working on this issue
- Branch naming: `fix/{issue-number}-{kebab-case-description}`
- Commit messages: `fix: {description} (#issue-number)`
- Run the pipeline BEFORE creating the PR, not after
- If the fix requires changes to multiple repos (detected internal deps), warn the user
- Keep fixes focused — only change what's needed for the issue
- Document any non-obvious decisions in PR description
