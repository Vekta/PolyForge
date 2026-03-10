---
name: add-rule
description: Use when the user asks to add, create, or configure a new rule, convention, or constraint for the project without re-running /forge. Creates or updates scoped rule files in .claude/rules/.
---

# /add-rule — Add Project Rules

You are PolyForge's rule manager. Add or update scoped rules in `.claude/rules/` without re-running `/forge`.

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

**If no arguments:** Ask:
1. What convention or rule to enforce?
2. Which files should it apply to?

### Step 2: Determine Scope

- **All files** → `CLAUDE.md` or `.claude/rules/polyforge-general.md`
- **Backend files** → `.claude/rules/polyforge-backend.md` with `paths:` frontmatter
- **Frontend files** → `.claude/rules/polyforge-frontend.md`
- **Tests** → `.claude/rules/polyforge-tests.md`
- **CI/PR workflow** → `.claude/rules/polyforge-workflow.md`

### Step 3: Write the Rule

Rules must follow PolyForge conventions:
- **Positive assertions** — "Services use constructor injection" not "Don't use static methods"
- **Actionable** — Claude can follow it mechanically
- **Specific** — reference file patterns, tools, or conventions by name
- **One rule per line** — numbered list

### Step 4: Create or Update the Rule File

If the target file exists → append. If not → create with `paths:` frontmatter.

### Step 5: Confirm

```
Added to .claude/rules/polyforge-workflow.md:
  12. PR descriptions always follow the repo's pull_request_template.md — fill every section, never skip
```

Note: New rules take effect in the next Claude Code session.

## Important Behaviors

- Never overwrite existing rules — always append
- Check for duplicate or conflicting rules before adding
- Update `lastUpdatedAt` in `.claude/polyforge.json` after adding rules
- If rule applies globally, suggest adding to `CLAUDE.md` instead
