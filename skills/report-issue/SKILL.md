---
name: report-issue
description: Use when the user wants to file a bug, create an issue, report a problem, or scan code for issues to report. Detects the issue tracker (GitHub/Jira/GitLab) and creates well-structured issues with context, severity, and suggested fixes.
---

# /report-issue — Issue Detection & Reporting

You are PolyForge's issue reporter. You detect problems in code or behavior and create well-structured issues in the project's configured tracker.

## Usage

```
/report-issue                          Interactive — describe the problem, I'll create the issue
/report-issue "Login fails on Safari"  Quick issue from description
/report-issue --scan src/              Scan directory for issues to report
```

## Process

### Step 1: Determine Issue Tracker

Read `.claude/polyforge.json` → `issueTracker.type`

If not configured:
1. Check `gh api repos/{owner}/{repo} --jq '.has_issues'` — if true, use GitHub
2. Check for Jira config in `.env`, `.jira`, environment
3. Check git remote for GitLab
4. Ask the user

### Step 2: Gather Issue Details

**Interactive mode** — ask ONE question at a time:
1. "What's the problem?" (title/summary)
2. "Can you describe the expected vs actual behavior?"
3. "Which part of the codebase is affected?" (auto-detect from description if possible)
4. "How severe is this? (critical / high / medium / low)"

**Scan mode** — analyze code and detect:
- Uncaught exceptions / missing error handling
- TODO/FIXME comments with context
- Dead code / unreachable branches
- Performance anti-patterns (N+1 queries, unbounded loops)
- Security issues (hardcoded secrets, missing validation)
- Type mismatches / potential null references

### Step 3: Enrich the Issue

Before creating, automatically:
- Find the relevant source files and line numbers
- Check git blame for who last modified the area
- Look for related existing issues (avoid duplicates)
- Suggest a severity label based on analysis
- Add reproduction context if applicable

### Step 4: Check for Issue Templates

**MANDATORY: Check for issue templates before creating:**

**GitHub:**
```bash
# Check for issue templates
ls .github/ISSUE_TEMPLATE/ 2>/dev/null
cat .github/ISSUE_TEMPLATE/bug_report.md 2>/dev/null
cat .github/ISSUE_TEMPLATE/feature_request.md 2>/dev/null
cat .github/ISSUE_TEMPLATE/config.yml 2>/dev/null
```

**Jira:** Jira templates are server-side (issue type screens). Discover available types and required fields:
```bash
# List available issue types for the project
jira issue types 2>/dev/null || curl "https://{domain}.atlassian.net/rest/api/3/issue/createmeta/{projectKey}/issuetypes" -H "Authorization: Basic {credentials}"

# Check a recent issue of the same type to learn the expected format
jira issue list --type Bug --plain --columns key,summary,priority,status -q"ORDER BY created DESC" 2>/dev/null | head -5
jira issue view {recent-key} --raw 2>/dev/null
```
Use a recent issue as a reference for the expected description format (headings, sections, acceptance criteria structure). Match the team's conventions.

**GitLab:**
```bash
ls .gitlab/issue_templates/ 2>/dev/null
```

**If a template exists — THIS IS NON-NEGOTIABLE:**
1. Use the template VERBATIM as the structure — keep every section, every checkbox, every HTML comment
2. Fill in all applicable fields with relevant content
3. Leave sections empty if not applicable — NEVER delete them
4. Append `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` at the bottom

### Step 5: Create the Issue

**GitHub Issues:**
```bash
# Check for title prefix in polyforge.json → issueTracker.config.titlePrefix
# If set (e.g., "[pnp-api]"), prepend to title: "[pnp-api] {title}"
# If not set, use title as-is

gh issue create \
  --title "{prefix} {title}" \
  --body "{body from template}" \
  --label "{severity},{type}" \
  --assignee "{from git blame if applicable}"
```

**Jira (preferred — via CLI):**
```bash
# Get current user for auto-assignment
JIRA_USER=$(jira me --raw | jq -r '.displayName // .emailAddress')

# Check for title prefix in polyforge.json → issueTracker.config.titlePrefix
jira issue create \
  --type "{Bug|Task|Story}" \
  --summary "{prefix} {title}" \
  --body "{body}" \
  --priority "{priority}" \
  --label "{labels}" \
  --assignee "$JIRA_USER"
```

**Jira (fallback — via REST API):**
```bash
curl -X POST "https://{domain}.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic {base64(email:token)}" \
  -H "Content-Type: application/json" \
  -d '{issue payload respecting required fields and issue type}'
```

**GitLab:**
```bash
glab issue create --title "{title}" --description "{body from template}" --label "{labels}"
```

### Default Issue Template (only if no template exists)

```markdown
## Description
{clear description of the problem}

## Expected Behavior
{what should happen}

## Actual Behavior
{what happens instead}

## Affected Code
- `{file}:{line}` — {brief description}

## Reproduction Steps
1. {step}
2. {step}

## Severity
{critical|high|medium|low} — {justification}

## Suggested Fix
{brief suggestion based on code analysis}

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
```

### Step 6: Confirm

Before creating, show the full issue preview and ask:
"Create this issue? (y/n/edit)"

## Context Management

- In scan mode, delegate directory scanning to a subagent to preserve parent context for issue creation
- After creating issues, compact the conversation

## Jira Authentication

If Jira is the tracker, check authentication in this order:
1. **`jira` CLI** — run `jira me` to check if authenticated. If it works, **use the CLI for all Jira operations** (`jira issue create`, `jira issue list`, etc.). This is the preferred method.
2. `JIRA_API_TOKEN` + `JIRA_EMAIL` env vars — use the REST API
3. `JIRA_TOKEN` env var
4. `.env` file in project root

If none found, **do not ask the user to paste credentials.** Instead:
1. Create the issue body as markdown
2. Open the Jira create issue URL directly in browser: `open "https://{domain}.atlassian.net/secure/CreateIssue.jspa?pid={projectId}"`
3. Tell the user: "Jira credentials not configured. I've opened Jira — paste the issue below. To enable auto-creation, add `JIRA_API_TOKEN` and `JIRA_EMAIL` to your `.env` file."

## Important Behaviors

- Check for duplicate issues before creating (search existing issues by title keywords)
- In scan mode: present all findings as a list, let user pick which to create as issues
- Respect project labeling conventions (detect from existing issues)
- For Jira: respect issue types (Bug, Task, Story) and required fields
- Never ask the user to paste credentials inline — read from env or .env
- Log created issues to `tmp/issues-log-{date}.md`
