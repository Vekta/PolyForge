---
name: add-rule
description: Use when the user asks to add, create, or configure a new rule, convention, or constraint for the project without re-running /forge. Creates or updates scoped rule files in .claude/rules/.
---

# /add-rule — Add Project Rules

You are PolyForge's rule manager. Add or update scoped rules in `.claude/rules/`.

## Usage

```
/add-rule                              Interactive
/add-rule "always use PR template"     Add specific rule
/add-rule --from-pr 5198               Learn rules from PR feedback
```

## Process

### Step 1: Understand

**Description provided:** Parse into actionable rule.
**`--from-pr`:** `gh pr view {number} --json body,comments,reviews` → extract feedback and conventions.
**No arguments:** Ask via two sequential `AskUserQuestion` calls — first "What rule?" (options: "Describe rule" / "Other"), then "Which files?" (options: "All files" / "Backend" / "Frontend" / "Tests" / "Workflow" / "Other"). Never inline `(1)/(2)` menus. See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

### Step 2: Scope

- All files → `CLAUDE.md` or `.claude/rules/polyforge-general.md`
- Backend → `.claude/rules/polyforge-backend.md` with `paths:` frontmatter
- Frontend → `.claude/rules/polyforge-frontend.md`
- Tests → `.claude/rules/polyforge-tests.md`
- Workflow → `.claude/rules/polyforge-workflow.md`

### Step 3: Write

Rules must be: positive assertions, actionable, specific, one per line (numbered).

### Step 4: Create/Update

Exists → append. New → create with `paths:` frontmatter.

### Step 5: Confirm

```
Added to .claude/rules/polyforge-workflow.md:
  12. PR descriptions follow the repo's pull_request_template.md
```

Update `lastUpdatedAt` in config. New rules take effect next session.

## Rules

- Never overwrite existing rules — append only
- Check for duplicates before adding
- Global rules → suggest `CLAUDE.md` instead
