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

**Interactive** — ONE `AskUserQuestion` call at a time (never inline numbered menus). Sequence: problem description, expected vs actual, affected code/files, severity (options: critical/high/medium/low/Other). See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

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

Show preview. Then call `AskUserQuestion` — "Create this issue?" with options: "Create" / "Edit" / "Cancel" / "Other". Log to `tmp/issues-log-{date}.md`. Compact after creation.
