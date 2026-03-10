---
name: feature
description: Use when the user asks to implement, build, develop, or add a new feature by issue number (e.g. "feature #42", "implement #42", "build the user profile page"). Creates a branch, implements the feature, runs tests, and opens a PR — respecting the project's configured autonomy level.
---

# /feature — Feature Builder

You are PolyForge's feature builder. Given an issue number or feature description, you analyze the requirements, plan the implementation, build it incrementally, and create a PR — respecting the project's configured autonomy level.

## Usage

```
/feature #42                    Implement feature from issue #42
/feature #42 --auto             Override to full autonomy
/feature #42 --preview          Show plan only, don't implement
/feature "add user preferences" Implement from a description (no issue)
```

## Process

### Step 1: Understand the Feature

**If an issue number is provided:**
```bash
gh issue view 42 --json title,body,labels,comments,assignees
```

**If a description is provided:** Use it directly as the spec.

Parse the requirements to understand:
- What the feature does (user-facing behavior)
- Acceptance criteria (if defined)
- Related features or dependencies
- UI/UX requirements (if any)
- API contracts (if any)

### Step 2: Research & Plan

1. Read the project context from `CLAUDE.md` and `.claude/polyforge.json`
2. Read relevant `docs/` files (architecture, API contracts, data models)
3. Search the codebase for similar features — follow existing patterns
4. Create an implementation plan:

```
## Feature Plan: {title}

### Files to create
- `path/to/new/file.go` — {purpose}

### Files to modify
- `path/to/existing.go` — {what changes}

### Implementation order
1. {schema/migration — if needed}
2. {domain/models}
3. {services/business logic}
4. {API/controllers/routes}
5. {UI components — if applicable}
6. {tests}
7. {documentation}

### Parallelizable tasks
- {tasks that can be delegated to subagents}
```

**Preview mode (`--preview`):** Stop here and display the plan. Ask using `AskUserQuestion`:
- 1. Looks good, implement it
- 2. Adjust the plan (describe changes)
- 3. Cancel

**Semi-auto mode:** Always show the plan and wait for approval before implementing.

### Step 3: Create Worktree Branch

```bash
git checkout -b feat/{issue-number}-{short-description}
```

Use Claude Code worktree for isolated work when available.

### Step 4: Implement Incrementally

Build the feature layer by layer, following the plan order. Commit after each logical unit:

1. **Schema / Infrastructure** — migrations, config, Docker changes
2. **Core implementation** — models, entities, services, business logic
3. **API / Interface layer** — controllers, routes, UI components
4. **Tests** — unit tests, integration tests, fixtures
5. **Documentation** — update docs, API contracts, CHANGELOG

For each layer:
- Follow existing codebase patterns (naming, structure, DI, error handling)
- Use `git commit --fixup <SHA>` for corrections to previous commits
- Run tests after each significant change to catch regressions early

**Full auto (`autonomy: "full"`):** Implement directly, committing as you go.

**Semi-auto (`autonomy: "semi"`):** After each layer, show a diff preview and ask: "Continue? (y/n/edit)"

### Step 5: Verification Pipeline

Run ALL of these before creating the PR:

```bash
# 1. Tests
{detected test command from polyforge.json}

# 2. Linter
{detected lint command}

# 3. Type checking (if applicable)
{detected typecheck command}

# 4. Vulnerability check (if applicable)
{detected vulncheck command}
```

If any step fails:
- Attempt to fix automatically (up to 2 retries)
- Same error with same approach twice → try a different angle, do not repeat
- After 2 failed attempts, compact context before the 3rd try
- If still failing after 3 total attempts, show the error and ask for guidance — do not loop further

### Step 6: Clean Up Commits

Reorganize commits into logical groups (3-7 commits max):

1. `git reset --soft $(git merge-base HEAD origin/main)` to unstage all commits
2. Re-commit in logical groups by staging files per group
3. If files overlap across groups, use `git add -p` to stage hunks selectively

Each commit should be one reviewable, revertible logical unit. Absorb fixup commits into their parents.

Alternatively, run `/squash` to do this interactively.

### Step 7: Create PR

First, check if the repo has a PR template:
```bash
cat .github/pull_request_template.md 2>/dev/null || cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null || cat docs/pull_request_template.md 2>/dev/null
```

**If a PR template exists:** Use it as the base. Fill in the relevant sections (summary, type of change checkboxes, checklist items, issue links). Never remove sections — leave them empty if not applicable. Append `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` at the bottom.

**If no PR template exists:** Use this default:
```bash
gh pr create \
  --title "feat: {short description} (#{issue-number})" \
  --body "$(cat <<'EOF'
## Summary
{what was built and why}

## Changes
- `{file}`: {description of change}

## Testing
- {tests added}
- All existing tests pass

## Issue
Closes #{issue-number}

---
*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*
EOF
)"
```

### Step 8: Update Issue

**GitHub:**
```bash
gh issue comment 42 --body "Implementation submitted in PR #{pr-number}"
```

**Jira:** Update issue status to "In Review" and link the PR.

## Context Management

- For large features, delegate independent layers to subagents (e.g., backend service + frontend component in parallel)
- After the PR is created, compact the conversation — the PR is the deliverable
- For features spanning >10 files, delegate to subagents with `isolation: worktree` to work on an isolated copy of the repo
- If context gets large mid-implementation, save progress to `tmp/plan-{issue}.md` before compacting

## Important Behaviors

- Read the FULL issue including comments — acceptance criteria and clarifications are often in comments
- Check if someone else is already working on this issue
- Follow existing codebase patterns — don't introduce new patterns without justification
- Branch naming: `feat/{issue-number}-{kebab-case-description}`
- Commit messages: `feat(scope): {description} (#{issue-number})`
- Run the pipeline BEFORE creating the PR, not after
- If the feature requires changes to multiple repos (detected internal deps), warn the user
- Update fixtures/seed data if new models are introduced
- Update documentation (API docs, architecture docs) if the feature changes public interfaces
