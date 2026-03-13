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

## Process

### Step 1: Gather PR Context (parallel)

```bash
gh pr view {number} --json title,body,additions,deletions,files,commits,reviews,labels
gh pr diff {number} -- ':!*.lock' ':!vendor/' ':!*.generated.*'
gh pr checks {number}
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

### Step 2: Check CI

```bash
gh run list --branch {branch} --limit 3
gh run view {run-id} --log-failed 2>/dev/null | head -300
```

CI fails → report which jobs failed and why. Ask: "Fix CI failures automatically?"

### Step 3: Code Review

**Under 300 lines diff:** Review inline — no subagent needed.

**Over 300 lines diff:** Spawn `[model: sonnet]` subagent with the diff. Returns JSON only:
```json
[{ "file": "", "line": 0, "category": "critical|warning|suggestion", "msg": "" }]
```

Review checklist (inline or subagent):
- **Coherence**: all related files present, no unresolved TODO/FIXME, end-to-end flow works
- **Quality**: single responsibility, no duplication, consistent naming, error handling
- **Cross-file**: API contracts match, schema changes have migrations, test coverage matches
- **Security**: no secrets, input validation on boundaries, no injection vectors
- **Performance**: no N+1, no unbounded loops, indexes for new queries

### Step 4: Report

```markdown
## PR Review: #{number} — {title}

### CI Status
- ✓/✗ {check}: {status}

### Critical (must fix)
- [ ] {finding} — `{file}:{line}`

### Warnings (should fix)
- [ ] {finding} — `{file}:{line}`

### Suggestions (nice to have)
- [ ] {finding} — `{file}:{line}`

### What looks good
- {positive feedback}
```

### Step 5: Post-Review

Ask: "Found {N} issues ({critical} critical). Action?
(a) Fix critical automatically  (b) Fix all  (c) Report only  (d) Post as PR comment"

Compact after report — follow @skills/shared/common-patterns.md
