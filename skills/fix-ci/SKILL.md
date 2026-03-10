---
name: fix-ci
description: Use when CI/CD checks fail on a PR or branch, when the user says "CI is broken", "build failed", "tests fail in CI", or "fix the pipeline". Diagnoses and fixes GitHub Actions / CI failures automatically with a max 3-attempt loop.
---

# /fix-ci — CI Failure Auto-Fix

You are PolyForge's CI debugging specialist. Diagnose and fix CI failures on the current PR or branch. Loop until checks pass or you hit the retry limit.

## Usage

```
/fix-ci                Fix CI on current branch's PR
/fix-ci #123           Fix CI on PR #123
/fix-ci --diagnose     Diagnose only, don't fix
```

## Process (Loop — max 3 iterations)

### Step 1: Verify GitHub CLI Access

```bash
gh auth status
```

If not authenticated, stop and ask the user to run `gh auth login`.

### Step 2: Get CI Status

```bash
# Get all checks for the PR
gh pr view --json statusCheckRollup --jq '.statusCheckRollup[]'

# Alternative: list by branch
gh pr checks
```

If all checks pass, report success and stop.

### Step 3: Inspect Failed Checks

For each failed check:

```bash
# Get run summary
gh run view <run-id>

# Get failed job logs
gh run view <run-id> --log-failed
```

Extract from logs:
- The first actionable error (often earlier in logs, not the last line)
- The failing command (`npm test`, `phpstan`, `go vet`, etc.)
- File paths and line numbers
- Whether it's code vs config vs environment

Categorize the failure:
- **Build** — compilation, syntax errors
- **Test** — unit, integration, e2e failures
- **Lint** — formatting, static analysis
- **Type** — type checking errors
- **Security** — dependency vulnerabilities
- **Config** — CI config, missing env vars, permissions

### Step 4: Confirm Root Cause

1. Read the failing code locally
2. Run the failing command locally to reproduce if possible
3. Check recent commits that might have caused it: `git log --oneline -5`
4. Form a hypothesis and validate before editing

If the failure requires secrets, permissions, or manual intervention — report clearly and stop.

### Step 5: Fix

1. Make targeted, minimal changes — only what's needed to pass CI
2. Preserve existing code style
3. Run the failing command locally to verify the fix

### Step 6: Push and Monitor

```bash
git add <specific files>
git commit -m "fix(ci): <short description of what was fixed>"
git push
```

Then watch:
```bash
gh pr checks --watch
```

### Step 7: Evaluate

- **All checks pass** → go to Final Report
- **Same failure persists** → re-analyze with new logs, return to Step 3
- **New failure** → analyze the new failure, return to Step 3
- **3 attempts reached** → stop, go to Final Report with NEEDS_HUMAN status

## Circuit Breaker Rules

- **Max 3 fix attempts.** After 3 pushes without all checks passing, stop and report.
- **Same error twice** with the same fix approach → do not retry the same approach. Try a different angle or report.
- **Environment/permissions issues** (missing secrets, Docker pull limits, runner issues) → report immediately, these cannot be fixed in code.
- After 2 failed attempts, compact the conversation before the 3rd try to ensure clean context.

## Final Report

```markdown
## CI Fix Summary

### Status: RESOLVED | PARTIALLY_RESOLVED | NEEDS_HUMAN

### Failures Found
- {check name}: {failure type} — {root cause}

### Fixes Applied
- `{file}:{line}` — {what was changed and why}

### Verification
- Local: {command} → {pass/fail}
- CI: {status after push}

### Remaining Failures

For EACH remaining failure, categorize and propose an action:

| Failure | Category | Proposed Action |
|---------|----------|-----------------|
| {test/check name} | 🟢 Quick fix | {concrete fix — do it now} |
| {test/check name} | 🟡 Needs investigation | {what to investigate — create issue with `/report-issue`} |
| {test/check name} | 🔴 Infrastructure/config | {what's missing — create issue assigned to team/ops} |

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
```

After presenting the report, ask for each category:

**🟢 Quick fixes found:** "I can fix {N} failures right now. Proceed?"
- If yes → fix them, re-run pipeline

**🟡 Needs investigation:** "Create `/diagnose` issues for these {N} failures?"
- If yes → create issues via `/report-issue` with the failure context pre-filled

**🔴 Infrastructure/config:** "Create issues for these {N} infra problems?"
- If yes → create issues via `/report-issue` tagged as infra/config

**Never leave failures unaddressed.** Every remaining failure must result in either a fix or an issue.

## Context Management

- Use a subagent to parse large CI logs (>500 lines) — return only errors and context
- After each fix iteration, keep only: current failure, hypothesis, fix applied
- Before pushing, squash fix iterations into a single clean commit (e.g., `fix(ci): resolve lint failures` not 5 separate "try fix" commits)
- After final report, compact the conversation
