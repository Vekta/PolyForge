# Issue/Ticket Template Usage

## Step 1: Detect tracker type

Use pre-loaded `issueTracker.type` from `polyforge.json`. If not configured, detect:
- GitHub: `gh api repos/{owner}/{repo} --jq '.has_issues'`
- Jira: check `JIRA_BASE_URL` / `JIRA_API_TOKEN` env vars
- GitLab: check git remote for `gitlab`

## Step 2: Check for existing templates

### GitHub

```bash
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
cat .github/ISSUE_TEMPLATE/*.md 2>/dev/null
cat .github/ISSUE_TEMPLATE/*.yml 2>/dev/null
```

If multiple templates exist, pick the one matching the issue type (bug_report, feature_request, etc.).

### Jira

```bash
# Jira projects define issue types with required fields — query them
curl -s "https://{domain}.atlassian.net/rest/api/3/issue/createmeta/{projectKey}/issuetypes" \
  -H "Authorization: Basic {credentials}" | head -100
```

Use the project's configured issue types and required fields. Fill all required fields.

### GitLab

```bash
ls .gitlab/issue_templates/ 2>/dev/null
cat .gitlab/issue_templates/*.md 2>/dev/null
```

## Step 3a: If a template exists — RESPECT IT COMPLETELY

1. Use the template VERBATIM — keep every section, checkbox, and HTML comment
2. Fill in applicable fields (`[x]` for checked boxes, real text for sections)
3. Leave sections empty or unchecked if not applicable — NEVER delete them
4. NEVER append branding, signatures, or footers — the repo's template is the final format
5. For Jira: respect all required fields and field types from the issue type schema
6. The issue must look like a human filled it in, not a bot replacement

## Step 3b: If no template exists

Use the default template at @skills/shared/issue-default.md
