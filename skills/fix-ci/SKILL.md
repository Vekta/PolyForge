---
name: fix-ci
description: Use when CI/CD checks fail on a PR or branch, when the user says "CI is broken", "build failed", "tests fail in CI", or "fix the pipeline". Diagnoses and fixes GitHub Actions / CI failures automatically with a max 3-attempt loop.
---

# /fix-ci — CI Failure Auto-Fix

You are PolyForge's CI debugging specialist. Diagnose and fix CI failures on the current PR or branch.

## Usage

```
/fix-ci                Fix CI on current branch's PR
/fix-ci #123           Fix CI on PR #123
/fix-ci --diagnose     Diagnose only, don't fix
```

## State File

Maintain `tmp/ci-state-{branch}.json` throughout the process:
```json
{ "branch": "...", "attempts": 0, "failures": [], "fixes_applied": [] }
```

## Process (Loop — max 3 iterations)

### Step 1: Verify GitHub CLI Access

```bash
gh auth status
```

If not authenticated, stop and ask the user to run `gh auth login`.

### Step 2: Get CI Status

```bash
gh pr checks
```

If all checks pass, report success and stop.

### Step 3: Inspect Failed Checks

For each failed check:

```bash
gh run view <run-id>
gh run view <run-id> --log-failed 2>/dev/null | head -300
```

If logs exceed 200 lines, spawn a `[model: sonnet]` subagent to extract: first actionable error, failing command, file paths and line numbers.

Categorize: Build | Test | Lint | Type | Security | Config

### Step 4: Confirm Root Cause

For **test failures**, spawn **one `[model: sonnet]` subagent per failure** (parallel, max 5 concurrent). Each subagent follows this strict protocol:

1. Find and read the failing test file
2. Find and read the tested class/function
3. `git diff master -- <tested-file> <test-file>` to see what changed
4. State root cause and proposed fix in ≤5 sentences

**Subagent constraints:**
- Max **10 tool calls** per subagent — if not solved by then, report what you know and stop
- **NEVER read files under `vendor/`** — the bug is in application code, not framework internals
- **NEVER trace through framework source code** (Doctrine internals, Symfony kernel, etc.)
- Stay at the application layer: entities, repositories, services, config, fixtures
- If root cause points to a framework behavior change, state the hypothesis without verifying in vendor code

For **non-test failures** (build, lint, config):

1. Read the failing code locally
2. Run the failing command locally to reproduce if possible
3. `git log --oneline -5` for recent changes
4. Validate hypothesis before editing

If the failure requires secrets, permissions, or manual intervention — report clearly and stop.

### Step 5: Fix

Targeted, minimal changes only. Preserve existing code style. Run the failing command locally to verify the fix.

### Step 6: Push and Monitor

```bash
git add <specific files>
git commit -m "fix(ci): <short description>"
git push
gh pr checks --watch
```

Update `tmp/ci-state-{branch}.json` with attempt count and results.
Then **compact** the conversation, keeping only: current failure, fix applied, new CI status.

### Step 7: Evaluate

- **All checks pass** → Final Report
- **Same failure persists** → re-analyze with new logs, return to Step 3
- **New failure** → analyze the new failure, return to Step 3
- **3 attempts reached** → Final Report with NEEDS_HUMAN status

## Circuit Breaker Rules

- **Max 3 fix attempts.** Stop after 3 pushes without all checks passing.
- **Same error twice with same fix** → switch strategy or report.
- **Environment/permissions issues** → report immediately — cannot be fixed in code.
- **After each iteration**: compact, keeping only current failure + fix applied + CI status.

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

| Failure | Category | Proposed Action |
|---------|----------|-----------------|
| {check} | 🟢 Quick fix | {concrete fix — do it now} |
| {check} | 🟡 Needs investigation | {create issue with `/report-issue`} |
| {check} | 🔴 Infrastructure/config | {create issue assigned to ops} |

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
```

After the report, offer to fix 🟢 quick fixes and create issues for 🟡🔴 failures. Never leave failures unaddressed.

## Context Management

- `[model: sonnet]` subagent for CI logs exceeding 200 lines — returns only errors and context, no raw log
- **Test investigation subagents**: one per failure, parallel, max 10 tool calls each, no vendor/ reads
- **Compact after each push** before fetching new CI results — keep only current failure, fix, status
- After final report, compact the conversation
