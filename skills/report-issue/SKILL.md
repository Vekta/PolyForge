---
name: report-issue
description: Use when the user wants to file a bug, create an issue, report a problem, or scan code for issues to report. Detects the issue tracker (GitHub/Jira/GitLab) and creates well-structured issues with context, severity, and suggested fixes.
---

# /report-issue — Issue Detection & Reporting

You are PolyForge's issue reporter. Detect problems and create well-structured issues.

## Usage

```
/report-issue                          Interactive — describe the problem
/report-issue "Login fails on Safari"  Quick issue from description
/report-issue --scan src/              Scan directory for issues to report
```

## Process

### Step 1: Detect Tracker

Use pre-loaded config for `issueTracker.type`. If not configured: check `gh api repos/{owner}/{repo} --jq '.has_issues'`, then Jira env vars, then GitLab remote. Jira auth: @skills/report-issue/jira-auth.md

### Step 2: Gather Details

**Interactive** — ONE question at a time: (1) What's the problem? (2) Expected vs actual? (3) Affected code? (4) Severity?

**Scan mode** — spawn `[model: sonnet]` subagent → returns JSON:
```json
[{ "file": "", "line": 0, "type": "", "severity": "", "description": "", "fix": "" }]
```
Present findings, let user pick which to create as issues.

### Step 3: Enrich

Find file/line numbers, check `git blame`, search duplicates (`gh issue list -S "{keywords}"`), suggest severity.

### Step 4: Templates

Follow @skills/shared/issue-template-guide.md

### Step 5: Create

```bash
# Check titlePrefix in config
# GitHub: gh issue create --title "{prefix} {title}" --body "{body}" --label "{severity},{type}"
# Jira: jira issue create --type "{type}" --summary "{title}" --body "{body}" --priority "{priority}"
# GitLab: glab issue create --title "{title}" --description "{body}" --label "{labels}"
```

### Step 6: Confirm

Show preview. Ask: "Create this issue? (y/n/edit)". Log to `tmp/issues-log-{date}.md`. Compact after creation.
