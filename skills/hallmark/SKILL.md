---
name: review
description: Use when the user asks to review a PR, check a pull request, review a GitHub issue, review a Jira ticket, look at changes before merge, or audit code quality. Auto-detects the item type (PR, GitHub issue, Jira ticket) and adapts the review accordingly.
---

# /review — Universal Review

You are PolyForge's reviewer. Review with a FRESH perspective — you are NOT the agent that wrote the code or filed the issue.

## Usage

```
/review                     Review the current branch's PR
/review #123                Auto-detect: PR, GitHub issue, or Jira ticket
/review PR #123             Explicitly review a PR
/review issue #123          Explicitly review a GitHub issue
/review PROJ-123            Review a Jira ticket
/review --focus security    Focus on security aspects
```

## Step 1: Detect Item Type

If not explicitly specified, auto-detect:

```bash
# IMPORTANT: Try PR first — on GitHub, PRs are also issues, so `gh issue view`
# would match PR numbers too. Checking PR first avoids misclassification.
gh pr view {number} --json number,title 2>/dev/null && echo "TYPE:pr"
# Only try issue if PR lookup failed
gh issue view {number} --json number,title 2>/dev/null && echo "TYPE:issue"
```

If input matches `[A-Z]+-\d+` pattern → Jira ticket. Use pre-loaded `issueTracker.config` for domain/credentials.

---

## PR Review

### Gather Context (parallel)

```bash
gh pr view {number} --json title,body,additions,deletions,files,commits,reviews,labels
gh pr diff {number} -- ':!*.lock' ':!vendor/' ':!*.generated.*'
gh pr checks {number}
gh api repos/{owner}/{repo}/pulls/{number}/comments
```

### Check CI

```bash
gh run list --branch {branch} --limit 3
gh run view {run-id} --log-failed 2>/dev/null | head -300
```

CI fails → report which jobs failed and why. Call `AskUserQuestion` — "Fix CI failures automatically?" with options: "Fix via /fix-ci" / "Report only" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

### Code Review

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

### Report

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

### Post-Review

Call `AskUserQuestion` — "Found {N} issues ({critical} critical). Action?" with options: "Fix critical" / "Fix all" / "Report only" / "Post as PR comment" / "Other".

---

## GitHub Issue Review

### Gather Context

```bash
gh issue view {number} --json title,body,labels,comments,assignees,state,milestone
```

### Check Issue Template Compliance

Follow @skills/shared/issue-template-guide.md — verify the issue follows the repo's template (if one exists).

### Review Checklist

- **Clarity**: problem is clearly described, expected vs actual behavior stated
- **Reproducibility**: steps to reproduce are present and specific
- **Scope**: issue is focused on a single problem, not a bundle of unrelated items
- **Context**: relevant code references, logs, screenshots, or error messages included
- **Labels & severity**: appropriate labels assigned, severity matches the description
- **Duplicates**: check for similar existing issues (`gh issue list -S "{keywords}"`)
- **Actionability**: enough information for someone to start working on a fix

### Report

```markdown
## Issue Review: #{number} — {title}

### Completeness
- ✓/✗ Clear description
- ✓/✗ Reproduction steps
- ✓/✗ Expected vs actual behavior
- ✓/✗ Relevant context (logs, code refs)

### Issues Found
- [ ] {finding}

### Suggestions
- [ ] {suggestion to improve the issue}

### Duplicate Check
- {similar issues found, if any}
```

### Post-Review

Call `AskUserQuestion` — "Found {N} issues. Action?" with options: "Fix description" / "Add missing info from codebase" / "Report only" / "Post as issue comment" / "Other".

---

## Jira Ticket Review

### Gather Context

```bash
curl -s "https://{domain}.atlassian.net/rest/api/3/issue/{key}" \
  -H "Authorization: Basic {credentials}" | head -500
# Also fetch comments
curl -s "https://{domain}.atlassian.net/rest/api/3/issue/{key}/comment" \
  -H "Authorization: Basic {credentials}" | head -300
```

### Check Ticket Compliance

Query the project's issue type schema to verify required fields are filled:

```bash
curl -s "https://{domain}.atlassian.net/rest/api/3/issue/createmeta/{projectKey}/issuetypes" \
  -H "Authorization: Basic {credentials}" | head -100
```

### Review Checklist

- **Required fields**: all mandatory fields for the issue type are filled
- **Acceptance criteria**: clearly defined and testable
- **Story points / estimate**: present if the project uses estimation
- **Priority**: set and consistent with description
- **Links**: related tickets linked (blocks, is blocked by, relates to)
- **Components**: assigned to the correct component(s)
- **Sprint/epic**: properly placed in the backlog hierarchy
- **Clarity**: description is clear enough for any team member to pick up

### Report

```markdown
## Ticket Review: {key} — {summary}

### Field Completeness
- ✓/✗ {field}: {status}

### Issues Found
- [ ] {finding}

### Suggestions
- [ ] {suggestion to improve the ticket}

### Related Tickets
- {linked or potentially related tickets}
```

### Post-Review

Call `AskUserQuestion` — "Found {N} issues. Action?" with options: "Fix ticket fields via API" / "Add missing context" / "Report only" / "Other".

---

Compact after report — follow @skills/shared/common-patterns.md
