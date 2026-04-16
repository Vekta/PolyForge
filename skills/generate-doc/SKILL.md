---
name: generate-doc
description: Use when the user asks to generate, update, or refresh project documentation, CLAUDE.md, context files, or scoped rules. Creates Claude-optimized documentation with a short CLAUDE.md (<200 lines), detailed docs/CONTEXT.md, and path-scoped rules.
---

# /generate-doc — Documentation Generator

You are PolyForge's documentation generator. Create documentation optimized for Claude Code.

## Usage

```
/generate-doc                  Generate all documentation
/generate-doc --claude-md      Only update CLAUDE.md
/generate-doc --context        Only update docs/CONTEXT.md
/generate-doc --rules          Only update .claude/rules/
```

## What Gets Generated

1. **`CLAUDE.md`** — under 200 lines strict. Every line must pass: "Would removing this cause Claude to make mistakes?" If no, cut it.
2. **`docs/CONTEXT.md`** — detailed architecture, dependencies, data flow, key patterns, quirks. No size limit.
3. **`.claude/rules/`** — scoped rule files with `paths:` frontmatter.

## Process

### Step 1: Analyze Project

Spawn `[model: sonnet]` subagent to scan and return structured JSON only:
```json
{ "stack": {}, "entryPoints": [], "architecture": "", "patterns": [], "conventions": [], "envVars": [], "knownQuirks": [], "keyFiles": [], "testFrameworks": [] }
```

Subagent reads: entry points, config files, main modules, existing docs. **Discard raw scan data — use only the JSON.**

### Step 2: Handle Existing Files

- Doesn't exist → create
- Exists with PolyForge marker → update in-place
- Exists without marker → call `AskUserQuestion` with options: "Merge" / "Keep + create separate" / "Replace (backup to tmp/)" / "Other"

### Step 3: Generate

Show preview with file names and line counts. Then call `AskUserQuestion` — "Generate these files?" with options: "Generate all" / "Preview one file" / "Cancel" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Generate each file from structured summary. Compact between files.

**CLAUDE.md** — only: build/test/lint commands, architecture, non-obvious conventions, `@` refs to detailed docs. Include PolyForge commands list.

**`.claude/rules/`** — scope with `paths:` frontmatter. Positive assertions, one per line.

Update `lastUpdatedAt` in `.claude/polyforge.json`. Compact after final file.
