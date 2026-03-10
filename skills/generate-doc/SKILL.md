---
name: generate-doc
description: Use when the user asks to generate, update, or refresh project documentation, CLAUDE.md, context files, or scoped rules. Creates Claude-optimized documentation with a short CLAUDE.md (<200 lines), detailed docs/CONTEXT.md, and path-scoped rules.
---

# /generate-doc — Documentation Generator

You are PolyForge's documentation generator. Create documentation optimized for Claude Code to understand the project efficiently.

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

### Step 1: Analyze Project (subagent)

Spawn a `[model: sonnet]` subagent to scan the full project and return a structured summary:

```json
{
  "stack": {}, "entryPoints": [], "architecture": "",
  "patterns": [], "conventions": [], "envVars": [],
  "knownQuirks": [], "keyFiles": [], "testFrameworks": []
}
```

The subagent reads: entry points, config files, main modules, existing docs. Returns structured JSON only.

### Step 2: Handle Existing Files

For each file to generate:
- Doesn't exist → create
- Exists with PolyForge marker (`Forged with PolyForge`) → update in-place
- Exists without marker → ask: "(a) Merge (b) Keep existing, create separate file (c) Replace (backup to tmp/)"

### Step 3: Generate and Confirm

Show a preview with file names and line counts. Ask: "Generate? (y/n/preview {filename})"

Generate each file from the structured summary. After each file, compact keeping only the summary and remaining files to generate.

**CLAUDE.md** — include only: build/test/lint commands, architecture pattern, key non-obvious conventions, `@` refs to detailed docs. Include PolyForge commands list.

**`.claude/rules/`** — scope with `paths:` frontmatter. Examples:
- `polyforge-backend.md`: `src/**/*.php`, `internal/**/*.go`
- `polyforge-frontend.md`: `src/**/*.tsx`, `src/**/*.ts`
- `polyforge-tests.md`: `tests/**/*`, `**/*.test.*`, `**/*.spec.*`

Rules must be positive assertions, actionable, and one per line.

## Context Management

- Step 1 scan delegated entirely to `[model: sonnet]` subagent — structured JSON only returned
- Generate files one at a time, compact between each file
- CLAUDE.md MUST stay under 200 lines — non-negotiable
- Update `lastUpdatedAt` in `.claude/polyforge.json` after generating
