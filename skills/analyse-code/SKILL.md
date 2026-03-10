---
name: analyse-code
description: Use when the user asks to analyze, audit, review, or check code quality across the project. Performs full codebase analysis — detects bad patterns, security flaws, performance issues, misconfigurations — and generates a prioritized report in docs/ANALYSIS-{date}.md.
---

# /analyse-code — Codebase Analysis

You are PolyForge's code analyst. Perform a thorough analysis and produce a prioritized report.

## Usage

```
/analyse-code                        Analyze entire project
/analyse-code src/                   Analyze specific directory
/analyse-code --focus security       Focus on security only
/analyse-code --focus performance    Focus on performance only
```

## Analysis Categories

1. **Architecture & Patterns** — violations, circular deps, god classes, tight coupling, leaky abstractions
2. **Security** — hardcoded secrets, injection vectors (SQL/XSS/command), missing auth, CSRF, CORS, unvalidated input
3. **Performance** — N+1 queries, unbounded queries, missing cache, memory leaks, sync ops that should be async
4. **Code Quality** — dead code, duplication, high complexity, swallowed errors, magic numbers, TODO/FIXME inventory
5. **Configuration** — env validation, Docker misconfig, CI gaps, outdated deps, dev deps in prod
6. **Testing** — untested critical paths, meaningless assertions, flaky patterns, missing integration tests

## Process

### Step 1: Load Context

Read `.claude/polyforge.json` and `CLAUDE.md`. Determine which categories are relevant to the stack.

### Step 2: Scan (MANDATORY parallel subagents)

For each relevant category, spawn a `[model: sonnet]` subagent scoped to its category:
- Each subagent receives only its category's pattern definitions and relevant file types
- Returns structured findings: `[{ file, line, category, severity, description, fix }]`

Simultaneously, spawn a `[model: haiku]` subagent to return file/directory list and count only.

Run all subagents in parallel. Exclude `vendor/`, `node_modules/`, `tmp/`, `.git/`.

### Step 3: Generate Report

Merge all subagent findings. Create `docs/ANALYSIS-{YYYY-MM-DD}.md` using the structure at @skills/analyse-code/report-template.md

If a previous `docs/ANALYSIS-*.md` exists, compare findings — mark `[NEW]` vs `[RECURRING]`.

### Step 4: Post-Report Actions

Ask:
"Report saved to `docs/ANALYSIS-{date}.md`. Found {N} issues ({critical} critical, {high} high). Create issues?
(a) One issue per finding  (b) One issue for all  (c) One per category  (d) No — keep report only"

If creating issues, use `/report-issue`.

## Context Management

- All category subagents run in parallel — each returns structured JSON findings only
- Parent merges JSON and formats the report — no raw file content in parent context
- After generating the report, compact the conversation — the report is the deliverable
