# Jira Authentication & Template Discovery

## Authentication (check in order)

1. **`jira` CLI** — run `jira me` to verify. If authenticated, use CLI for all operations (preferred).
2. `JIRA_API_TOKEN` + `JIRA_EMAIL` env vars → use REST API
3. `JIRA_TOKEN` env var
4. `.env` file in project root

If none found — do NOT ask for credentials inline. Instead:
1. Create the issue body as markdown
2. Open: `open "https://{domain}.atlassian.net/secure/CreateIssue.jspa?pid={projectId}"`
3. Tell the user: "Add `JIRA_API_TOKEN` and `JIRA_EMAIL` to your `.env` to enable auto-creation."

## Template Discovery

```bash
# List available issue types
jira issue types 2>/dev/null || \
  curl "https://{domain}.atlassian.net/rest/api/3/issue/createmeta/{projectKey}/issuetypes" \
  -H "Authorization: Basic {credentials}"

# Check recent issues for format conventions
jira issue list --type Bug --plain --columns key,summary -q"ORDER BY created DESC" 2>/dev/null | head -5
jira issue view {recent-key} --raw 2>/dev/null
```

Use a recent issue as reference for the expected description format (headings, sections, acceptance criteria). Match the team's conventions.

## REST API Fallback

```bash
curl -X POST "https://{domain}.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic {base64(email:token)}" \
  -H "Content-Type: application/json" \
  -d '{issue payload respecting required fields and issue type}'
```
