---
name: pr-review
description: Use when the user asks to review a PR, check a pull request, look at changes before merge, or audit code quality in a PR. Reviews with a fresh subagent context to catch what the authoring agent missed — checks CI, coherence, security, and cross-file consistency.
---

# /pr-review — Pull Request Review

You are PolyForge's PR reviewer. Review with a FRESH perspective — you are NOT the agent that wrote the code.

## Usage

```
/pr-review                  Review the current branch's PR
/pr-review #123             Review PR #123
/pr-review --focus security Focus on security aspects
```

## Review Process

### Step 1: Gather PR Context (run all 4 in parallel)

```bash
gh pr view {number} --json title,body,additions,deletions,files,commits,reviews,labels
gh pr diff {number}
gh pr checks {number}
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

### Step 2: Check CI/CD Status

```bash
gh run list --branch {branch}
gh run view {run-id} --log-failed 2>/dev/null | head -300
```

If CI fails: report which jobs failed and why. Ask: "Fix CI failures automatically?"

### Step 3: Code Review (MANDATORY subagent — always, no size condition)

Spawn a `[model: sonnet]` subagent with isolated context to review the diff. The subagent checks:

**Coherence & Completeness**
- All related files present (no missing migrations, tests, configs)
- No unresolved TODO/FIXME in the diff
- Feature works end-to-end based on code flow

**Code Quality**
- Single responsibility, no duplication, consistent naming, complete error handling

**Cross-File Consistency**
- API contracts match between caller and callee
- Schema changes have ORM/migration updates
- Test coverage matches the changes

**Security**
- No hardcoded secrets, input validation on boundaries, no injection vectors

**Performance**
- No N+1 queries, no unbounded loops, indexes for new query patterns

If diff > 500 lines: subagent summarizes findings per-file and returns only the summary.

### Step 4: Generate Report

```markdown
## PR Review: #{number} — {title}

### CI Status
- ✓ Build: passed
- ✗ Lint: failed (2 errors)

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
"Found {N} issues ({critical} critical, {warnings} warnings). What do you want to do?
(a) Fix critical issues automatically
(b) Fix all issues automatically
(c) Just show the report — I'll fix manually
(d) Post this review as a PR comment"

## Configuration

Read `.claude/polyforge.json` for `autonomy`, `pipeline.prePR`, `project.linters`.

## Context Management

- Run Step 1 commands in parallel — they are independent
- `[model: sonnet]` subagent for Step 3 — always mandatory, no size condition
- After generating the report, compact the conversation — the report is the deliverable
