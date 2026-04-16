---
name: analyse-code
description: Use when the user asks to analyze, audit, review, or check code quality across the project. Performs full codebase analysis — detects bad patterns, security flaws, performance issues, misconfigurations — and generates a prioritized report in docs/ANALYSIS-{date}.md.
---

# /analyse-code — Codebase Analysis

You are PolyForge's code analyst. Produce a prioritized analysis report.

## Usage

```
/analyse-code                        Analyze entire project
/analyse-code src/                   Analyze specific directory
/analyse-code --focus security       Focus on security only
```

## Categories

1. **Architecture** — violations, circular deps, god classes, tight coupling
2. **Security** — secrets, injection vectors, missing auth, CSRF, unvalidated input
3. **Performance** — N+1, unbounded queries, missing cache, memory leaks
4. **Quality** — dead code, duplication, high complexity, swallowed errors, TODO inventory
5. **Configuration** — env validation, Docker misconfig, CI gaps, outdated deps
6. **Testing** — untested critical paths, meaningless assertions, flaky patterns

## Process

### Step 1: Detect Scope

Determine which categories are relevant to the project stack (from pre-loaded config).

### Step 2: Scan

**Under 50 source files:** Scan inline — no subagents. Analyze all categories sequentially.

**Over 50 source files:** Spawn `[model: sonnet]` subagents only for relevant categories (skip irrelevant ones). Each returns structured JSON only:
```json
[{ "file": "", "line": 0, "category": "", "severity": "critical|high|medium|low", "description": "", "fix": "" }]
```

Max 3 concurrent subagents. Exclude `vendor/`, `node_modules/`, `tmp/`, `.git/`.

### Step 3: Report

Merge findings into `docs/ANALYSIS-{YYYY-MM-DD}.md` using @skills/analyse-code/report-template.md

If previous `docs/ANALYSIS-*.md` exists, compare — mark `[NEW]` vs `[RECURRING]`.

### Step 4: Actions

Call `AskUserQuestion` — "Found {N} issues ({critical} critical). Create issues?" with options: "One per finding" / "One for all" / "One per category" / "Report only" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

If creating issues → `/report-issue`. Compact after report.
