---
name: generate-doc
description: "Use when the user asks to generate, update, or refresh project documentation, CLAUDE.md, context files, or scoped rules. Creates Claude-optimized documentation with a short CLAUDE.md (<200 lines), detailed docs/CONTEXT.md, and path-scoped rules."
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
3. **`.claude/rules/`** — scoped rule files with `paths:` frontmatter targeting specific directories (e.g. `paths: src/api/**`).

## Key Concepts

- **PolyForge marker**: A comment (e.g. `<!-- polyforge-managed -->`) embedded in generated files. Presence means PolyForge created the file and can safely update it in-place. Absence means the file is user-managed — ask before overwriting.
- **Compact**: After generating a deliverable, discard working context and reload only from persisted state (`tmp/`, `polyforge.json`). Preserves the context window for multi-file generation.
- **`polyforge.json`**: Project config at `.claude/polyforge.json` containing `stack`, `testFrameworks`, `linters`, `autonomy`, `issueTracker`, and `lastUpdatedAt`. Pre-loaded at session start — do not re-read.

## Process

### Step 1: Analyze Project

Spawn `[model: sonnet]` subagent to scan and return structured JSON only:
```json
{
  "stack": { "language": "TypeScript", "framework": "Next.js", "runtime": "Node 20" },
  "entryPoints": ["src/index.ts", "src/app/page.tsx"],
  "architecture": "monorepo with apps/ and packages/",
  "patterns": ["repository pattern", "dependency injection"],
  "conventions": ["kebab-case files", "barrel exports"],
  "envVars": ["DATABASE_URL", "API_KEY"],
  "knownQuirks": ["custom webpack config overrides tsconfig paths"],
  "keyFiles": ["src/config.ts", "prisma/schema.prisma"],
  "testFrameworks": ["vitest"]
}
```

Subagent reads: entry points, config files, main modules, existing docs. **Discard raw scan data — use only the JSON.**

### Step 2: Handle Existing Files

- Doesn't exist → create
- Exists with PolyForge marker → update in-place
- Exists without marker → ask: "(a) Merge (b) Keep + create separate (c) Replace (backup to tmp/)"

### Step 3: Generate

Show preview with file names and line counts. Ask: "Generate? (y/n/preview {filename})"

Generate each file from structured summary. Compact between files.

**CLAUDE.md** — only: build/test/lint commands, architecture, non-obvious conventions, `@` refs to detailed docs. Example structure:
```markdown
<!-- polyforge-managed -->
# Project Name
## Build & Test
npm run build && npm test
## Architecture
Monorepo: apps/ (Next.js) + packages/ (shared libs)
## Conventions
- kebab-case file names, barrel exports per module
## Commands
/review, /fix, /feature, /diagnose, /analyse-code
@docs/CONTEXT.md for full architecture details
```

**`.claude/rules/`** — scope with `paths:` frontmatter. Example:
```markdown
---
paths: src/api/**
---
<!-- polyforge-managed -->
All API routes validate input with zod schemas before processing
Error responses use the standard ApiError class from src/lib/errors.ts
```

### Step 4: Validate

After generation, verify:
- `CLAUDE.md` is under 200 lines (`wc -l CLAUDE.md`)
- All rule files have valid `paths:` frontmatter
- PolyForge marker (`<!-- polyforge-managed -->`) is present in all generated files
- No duplicate rules across rule files

Fix any violations before completing.

Update `lastUpdatedAt` in `.claude/polyforge.json`. Compact after final file.
