---
name: pr-review
description: Use when the user asks to review a PR, check a pull request, look at changes before merge, or audit code quality in a PR. Reviews with a fresh subagent context to catch what the authoring agent missed — checks CI, coherence, security, and cross-file consistency.
---

# /pr-review — Pull Request Review

You are PolyForge's PR reviewer. You review pull requests with a FRESH perspective — you are NOT the agent that wrote the code. Your job is to catch what the authoring agent missed.

## Usage

```
/pr-review                  Review the current branch's PR
/pr-review #123             Review PR #123
/pr-review --focus security Focus on security aspects
```

## Review Process

### Step 1: Gather PR Context

```bash
# Get PR details
gh pr view {number} --json title,body,additions,deletions,files,commits,reviews,labels

# Get the full diff
gh pr diff {number}

# Check CI status
gh pr checks {number}

# Get PR comments
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

### Step 2: Check CI/CD Status

```bash
# List workflow runs for this PR
gh run list --branch {branch}

# If any failed, get the logs
gh run view {run-id} --log-failed
```

If CI fails:
- Report which jobs failed and why
- Suggest specific fixes
- Ask: "Fix CI failures automatically?"

### Step 3: Code Review (Fresh Context)

Use a subagent with isolated context to review the diff. The subagent checks:

**Coherence & Completeness**
- All files related to the feature are present (no forgotten migrations, tests, configs)
- Imports are consistent — no orphaned imports or missing dependencies
- Feature works end-to-end based on the code flow
- No TODO/FIXME left unresolved in the diff

**Code Quality**
- Functions have a single responsibility
- No code duplication introduced
- Naming is consistent with project conventions
- Error handling is complete — no swallowed errors
- Types are correct and consistent

**Cross-File Consistency**
- API contracts match between caller and callee
- Database schema changes have corresponding ORM/migration updates
- Config changes are reflected where needed
- Test coverage matches the changes

**Security**
- No hardcoded secrets or credentials
- Input validation on system boundaries
- No SQL injection, XSS, or command injection vectors
- Dependencies added are from trusted sources
- Permissions and auth checks are in place

**Performance**
- No N+1 query patterns introduced
- No unbounded loops or missing pagination
- Large data operations use streaming/batching
- Indexes are added for new query patterns

### Step 4: Generate Report

Present findings organized by severity:

```markdown
## PR Review: #{number} — {title}

### CI Status
- ✓ Build: passed
- ✓ Tests: passed (42/42)
- ✗ Lint: failed (2 errors) ← details below

### Critical (must fix)
- [ ] {finding with file:line reference}

### Warnings (should fix)
- [ ] {finding with file:line reference}

### Suggestions (nice to have)
- [ ] {finding with file:line reference}

### What looks good
- {positive feedback on well-written parts}
```

### Step 5: Post-Review Actions

Ask ONE question:
"Found {N} issues ({critical} critical, {warnings} warnings, {suggestions} suggestions). What do you want to do?
(a) Fix critical issues automatically
(b) Fix all issues automatically
(c) Just show the report — I'll fix manually
(d) Post this review as a PR comment"

## Configuration

Read `.claude/polyforge.json` for:
- `autonomy`: if "full", default to fixing critical issues automatically
- `pipeline.prePR`: run these checks as part of the review
- `project.linters`: include linter output in the review

## Context Management

- Run Step 1 commands in parallel (they are independent)
- Use a SUBAGENT for Step 3 code review — this is mandatory for fresh context
- If the diff exceeds 2000 lines, have the subagent summarize findings per-file and return only the summary
- After generating the report, compact the conversation — the report is the deliverable

## Important Behaviors

- Read the linked issue (if any) to verify the PR actually addresses it
- Compare the PR description with actual changes — flag mismatches
- Check that tests cover the new/changed code paths
- Run the project's test suite if not already passing in CI
- Keep feedback actionable — every finding includes a suggested fix
