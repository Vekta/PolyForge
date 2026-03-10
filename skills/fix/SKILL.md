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
- If still failing after 3 total attempts, categorize each remaining failure:
  - 🟢 **Quick fix** → fix it now
  - 🟡 **Needs investigation** → create an issue via `/report-issue`
  - 🔴 **Pre-existing / infra** → create an issue via `/report-issue` tagged as infra
- Never ignore remaining failures — every one gets a fix or an issue

### Step 6: Clean Up Commits

Before creating the PR, reorganize commits into logical groups (3-7 commits max):

1. `git reset --soft $(git merge-base HEAD origin/main)` to unstage all commits
2. Re-commit in logical groups by staging files per group
3. If files overlap across groups, split changes by editing files to isolate each group, commit, then restore

Target: each commit should be one reviewable, revertible logical unit. Absorb "fix lint", "fix type" into their parent commit — they never stand alone.

Alternatively, run `/squash` to do this interactively.

### Step 7: Create PR

**MANDATORY: Check for a PR template before creating the PR:**
```bash
# Check common template locations — read the FULL content
cat .github/pull_request_template.md 2>/dev/null || cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null || cat .github/PULL_REQUEST_TEMPLATE/*.md 2>/dev/null || cat docs/pull_request_template.md 2>/dev/null
```

**If a PR template exists — THIS IS NON-NEGOTIABLE:**
1. Use the template VERBATIM as the structure — keep every section, every checkbox, every HTML comment
2. Fill in the sections with relevant content (write the summary, check applicable boxes with `[x]`, fill Jira/issue links)
3. Leave sections empty or unchecked if not applicable — NEVER delete them
4. Append `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` at the very bottom
5. The PR body must look like the template was filled in by a human, not replaced by a bot

**If no PR template exists:** Use this default:
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

### Step 8: Update Issue

**GitHub:**
```bash
gh issue comment 123 --body "Fix submitted in PR #{pr-number}"
```

**Jira (prefer CLI if available):**
```bash
jira issue move {key} "In Review"
jira issue comment add {key} "Fix submitted in PR #{pr-number}"
```
Fallback to REST API if `jira` CLI is not installed.

### Step 9: Wait for CI and Act on Results

```bash
gh pr checks --watch
```

If CI passes → done, report success.

If CI fails → run `/fix-ci` automatically to diagnose and fix. Do not leave the PR with a failing CI.

## Context Management

- If the fix plan identifies independent file groups, delegate implementation of each group to a subagent
- After the PR is created, compact the conversation — the PR is the deliverable
- For large fixes, delegate independent tasks to subagents to work in parallel

## Important Behaviors

- Read the FULL issue including comments — context is often in comments
- Check if someone else is already working on this issue
- Branch naming: `fix/{issue-number}-{kebab-case-description}`
- Commit messages: `fix: {description} (#issue-number)`
- Run the pipeline BEFORE creating the PR, not after
- If the fix requires changes to multiple repos (detected internal deps), warn the user
- Keep fixes focused — only change what's needed for the issue
- Document any non-obvious decisions in PR description
