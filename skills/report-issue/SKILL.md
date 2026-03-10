---
name: report-issue
description: Use when the user wants to file a bug, create an issue, report a problem, or scan code for issues to report. Detects the issue tracker (GitHub/Jira/GitLab) and creates well-structured issues with context, severity, and suggested fixes.
---

# /report-issue — Issue Detection & Reporting

You are PolyForge's issue reporter. Detect problems and create well-structured issues in the project's tracker.

## Usage

```
/report-issue                          Interactive — describe the problem
/report-issue "Login fails on Safari"  Quick issue from description
/report-issue --scan src/              Scan directory for issues to report
```

## Process

### Step 1: Determine Issue Tracker

Read `.claude/polyforge.json` → `issueTracker.type`.

If not configured: check `gh api repos/{owner}/{repo} --jq '.has_issues'`, then Jira env vars, then GitLab remote.

For Jira authentication and template discovery: see @skills/report-issue/jira-auth.md

### Step 2: Gather Issue Details

**Interactive mode** — ONE question at a time:
1. What's the problem?
2. Expected vs actual behavior?
3. Which part of the codebase is affected?
4. Severity? (critical / high / medium / low)

**Scan mode** — spawn a `[model: sonnet]` subagent to analyze the directory and return findings:
- Uncaught exceptions / missing error handling
- TODO/FIXME comments with context
- Dead code / unreachable branches
- Performance anti-patterns (N+1, unbounded loops)
- Security issues (hardcoded secrets, missing validation)

Present all findings as a list, let user pick which to create as issues.

### Step 3: Enrich the Issue

Before creating: find relevant file/line numbers, check git blame, search for duplicates (`gh issue list -S "{keywords}"`), suggest severity label.

### Step 4: Check for Issue Templates

```bash
# GitHub
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
cat .github/ISSUE_TEMPLATE/bug_report.md 2>/dev/null

# GitLab
ls .gitlab/issue_templates/ 2>/dev/null
```

**If a template exists — NON-NEGOTIABLE:** Use VERBATIM, fill in all applicable fields, never delete sections. Append PolyForge footer.

**If no template:** Use default at @skills/shared/issue-default.md

### Step 5: Create the Issue

```bash
# Check for title prefix in polyforge.json → issueTracker.config.titlePrefix

# GitHub
gh issue create --title "{prefix} {title}" --body "{body}" --label "{severity},{type}"

# Jira (CLI preferred, REST fallback — see @skills/report-issue/jira-auth.md)
jira issue create --type "{type}" --summary "{title}" --body "{body}" --priority "{priority}"

# GitLab
glab issue create --title "{title}" --description "{body}" --label "{labels}"
```

### Step 6: Confirm

Show full issue preview. Ask: "Create this issue? (y/n/edit)"

Log created issues to `tmp/issues-log-{date}.md`.

## Context Management

- Scan mode: `[model: sonnet]` subagent for directory scanning — returns findings JSON only
- After creating issues, compact the conversation
