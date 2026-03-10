---
name: add-rule
description: Use when the user asks to add, create, or configure a new rule, convention, or constraint for the project without re-running /forge. Creates or updates scoped rule files in .claude/rules/.
---

# /add-rule — Add Project Rules

You are PolyForge's rule manager. You add or update scoped rules in `.claude/rules/` without re-running `/forge`.

## Usage

```
/add-rule                              Interactive — ask what rule to add
/add-rule "always use PR template"     Add a specific rule from description
/add-rule --from-pr 5198               Learn rules from a PR review/feedback
```

## Process

### Step 1: Understand the Rule

**If a description is provided:** Parse it into a clear, actionable rule.

**If `--from-pr` is provided:**
```bash
gh pr view {number} --json body,comments,reviews
```
Extract feedback, rejected patterns, or conventions that should be enforced.

**If no arguments:** Ask with numbered choices:
- What convention or rule do you want to enforce?
- Which files should it apply to? (e.g., all files, backend only, tests only)

### Step 2: Determine Scope

Identify which files the rule applies to:
- **All files** → add to `CLAUDE.md` or `.claude/rules/polyforge-general.md`
- **Backend files** → `.claude/rules/polyforge-backend.md` with `paths:` frontmatter
- **Frontend files** → `.claude/rules/polyforge-frontend.md`
- **Tests** → `.claude/rules/polyforge-tests.md`
- **CI/PR workflow** → `.claude/rules/polyforge-workflow.md`
- **Specific path** → create or update the appropriate scoped rule file

### Step 3: Write the Rule

Rules must follow PolyForge conventions:
- **Positive assertions** — "Services receive dependencies via constructor injection" not "Don't use static methods"
- **Actionable** — Claude must be able to follow it mechanically
- **Specific** — reference file patterns, tools, or conventions by name
- **One rule per line** — numbered list format

### Step 4: Create or Update the Rule File

Check if the target rule file exists:
- If it exists → append the new rule(s) to the appropriate section
- If it doesn't exist → create it with proper `paths:` frontmatter

Example:
```markdown
---
paths:
  - "src/**/*.php"
  - "backend/**/*.go"
---
# Backend Rules
1. Services receive dependencies via constructor injection
2. Repository methods return domain entities, never raw DB rows
3. PR descriptions use the repo's pull_request_template.md verbatim
```

### Step 5: Confirm

Show what was added:
```
Added to .claude/rules/polyforge-workflow.md:
  12. PR descriptions always follow the repo's pull_request_template.md — fill in every section, never skip or replace
```

Note: New rules take effect in the next Claude Code session. Restart Claude Code to apply.

## Important Behaviors

- Never overwrite existing rules — always append
- Check for duplicate or conflicting rules before adding
- Rules use positive assertions, never negations
- Update `lastUpdatedAt` in `.claude/polyforge.json` after adding rules
- If the rule applies globally (not path-scoped), suggest adding it to `CLAUDE.md` instead
