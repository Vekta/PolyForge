---
name: fix-ci
description: Use when CI/CD checks fail on a PR or branch, when the user says "CI is broken", "build failed", "tests fail in CI", or "fix the pipeline". Diagnoses and fixes GitHub Actions / CI failures automatically with a max 3-attempt loop.
---

# /fix-ci — CI Failure Auto-Fix

You are PolyForge's CI debugging specialist. Diagnose and fix CI failures.

## Usage

```
/fix-ci                Fix CI on current branch's PR
/fix-ci #123           Fix CI on PR #123
/fix-ci --diagnose     Diagnose only, don't fix
```

## State

Maintain `tmp/ci-state-{branch}.json`: `{ "branch", "attempts": 0, "failures": [], "fixes_applied": [] }`

## Process (max 3 iterations)

### Step 1: Get CI Status

```bash
gh auth status
gh pr checks
```

All pass → report success and stop. Not authenticated → ask user to `gh auth login`.

### Step 2: Inspect Failures

```bash
gh run view <run-id>
gh run view <run-id> --log-failed 2>/dev/null | head -300
```

Categorize: Build | Test | Lint | Type | Security | Config

**Logs over 200 lines:** Spawn `[model: sonnet]` subagent → returns JSON: `{ "error": "", "command": "", "files": [{ "path": "", "line": 0 }] }`

### Step 3: Root Cause

**Test failures** — spawn parallel `[model: sonnet]` subagents (max 3 concurrent, batch similar failures):
1. Read failing test + tested code + `git diff master -- {files}`
2. Return: `{ "test": "", "cause": "", "fix": "", "confidence": "high|medium|low" }`
3. Max 10 tool calls per subagent. App layer only — skip vendor/framework internals.

**Non-test failures:** Read failing code, reproduce locally, check `git log -5`. Secrets/permissions → report and stop.

### Step 4: Fix

Targeted, minimal changes. Preserve code style. Verify locally.

### Step 5: Push and Monitor

```bash
git add <specific files>
git commit -m "fix(ci): <short description>"
git push
gh pr checks --watch
```

Update state file. Compact — keep only: current failure, fix, CI status.

### Step 6: Evaluate

- All pass → Final Report
- Same failure → re-analyze with new logs (Step 2)
- New failure → analyze new failure (Step 2)
- 3 attempts reached → Final Report with NEEDS_HUMAN

Follow @skills/shared/common-patterns.md for circuit breaker rules.

## Final Report

```markdown
## CI Fix Summary

### Status: RESOLVED | PARTIALLY_RESOLVED | NEEDS_HUMAN

### Failures Found
- {check}: {type} — {root cause}

### Fixes Applied
- `{file}:{line}` — {change and why}

### Remaining Failures

| Failure | Category | Action |
|---------|----------|--------|
| {check} | 🟢 Quick fix | {do it now} |
| {check} | 🟡 Investigate | {`/report-issue`} |
| {check} | 🔴 Infra/config | {issue to ops} |

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
```

Offer to fix 🟢 and create issues for 🟡🔴. Compact after report.
