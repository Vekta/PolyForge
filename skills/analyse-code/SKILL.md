---
name: analyse-code
description: Use when the user asks to analyze, audit, review, or check code quality across the project. Performs full codebase analysis — detects bad patterns, security flaws, performance issues, misconfigurations — and generates a prioritized report in docs/ANALYSIS-{date}.md.
---

# /analyse-code — Codebase Analysis

You are PolyForge's code analyst. You perform a thorough analysis of the entire project and produce a prioritized report of findings.

## Usage

```
/analyse-code                        Analyze entire project
/analyse-code src/                   Analyze specific directory
/analyse-code --focus security       Focus on security only
/analyse-code --focus performance    Focus on performance only
```

## Analysis Categories

### 1. Architecture & Patterns
- Detect pattern violations (e.g., domain logic in controllers, infrastructure in domain layer)
- Circular dependencies between modules
- God classes / god functions (>200 lines or >5 responsibilities)
- Inconsistent patterns across similar components
- Missing abstraction layers or leaky abstractions
- Tight coupling between modules that should be independent

### 2. Security
- Hardcoded secrets, API keys, credentials
- SQL injection vectors (raw queries with string concatenation)
- XSS vulnerabilities (unescaped user input in output)
- Command injection (user input in shell commands)
- Missing authentication/authorization checks
- Insecure deserialization
- Missing CSRF protection
- Overly permissive CORS
- Sensitive data in logs
- Missing input validation on system boundaries

### 3. Performance
- N+1 query patterns (ORM lazy loading in loops)
- Missing database indexes for common query patterns
- Unbounded queries (no LIMIT/pagination)
- Synchronous operations that should be async
- Missing caching for expensive operations
- Memory leaks (unclosed resources, growing collections)
- Large payload serialization without streaming

### 4. Code Quality
- Dead code (unreachable branches, unused functions/imports)
- Code duplication (similar blocks across files)
- Overly complex functions (high cyclomatic complexity)
- Missing error handling or swallowed exceptions
- Inconsistent naming conventions
- Magic numbers / hardcoded values that should be constants
- TODO/FIXME/HACK comments (inventory them)

### 5. Configuration & Infrastructure
- Missing or incorrect environment variable validation
- Docker misconfigurations (running as root, no health checks)
- CI/CD pipeline gaps (missing steps, no caching)
- Missing or outdated dependency versions
- Development dependencies in production
- Missing `.gitignore` entries
- Insecure default configurations

### 6. Testing
- Untested critical paths (auth, payments, data mutations)
- Tests that don't assert anything meaningful
- Flaky test patterns (time-dependent, order-dependent)
- Missing integration tests for external service calls
- Test coverage gaps in recently changed code

## Process

### Step 1: Load Context

Read `.claude/polyforge.json` and `CLAUDE.md` for project-specific context. This determines which analysis categories are relevant (e.g., skip DB analysis if no database).

### Step 2: Scan

Systematically scan the codebase:
1. Read project structure and identify key directories
2. Analyze each category relevant to the stack
3. For each finding, record: file, line, category, severity, description, suggested fix

### Step 3: Generate Report

Create `docs/ANALYSIS-{YYYY-MM-DD}.md`:

```markdown
# Code Analysis Report — {project_name}

> ⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge) on {date}
> Scope: {full project | specific directory}
> Files analyzed: {count}

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 2 | 1 | 3 | 0 |
| Performance | 0 | 2 | 4 | 1 |
| Architecture | 0 | 1 | 2 | 3 |
| Code Quality | 0 | 0 | 5 | 8 |
| Config | 1 | 0 | 1 | 2 |
| Testing | 0 | 1 | 3 | 2 |
| **Total** | **3** | **5** | **18** | **16** |

## Critical Findings

### [SEC-001] Hardcoded API key in `src/services/payment.js:42`
**Severity:** Critical
**Category:** Security
**Description:** AWS secret key is hardcoded in source code.
**Suggested Fix:** Move to environment variable, add to `.env.example` as placeholder.

---

## High Priority Findings
...

## Medium Priority Findings
...

## Low Priority Findings
...

## Positive Observations
- {things done well — reinforce good practices}

## Recommended Action Order
1. Fix all Critical findings immediately
2. Address High findings in next sprint
3. Create tickets for Medium findings
4. Add Low findings to backlog
```

### Step 4: Post-Report Actions

Ask:
"Report saved to `docs/ANALYSIS-{date}.md`. Found {N} issues ({critical} critical, {high} high). Create issues?
(a) One issue per finding
(b) One issue that covers all findings
(c) One issue per category
(d) No issues — just keep the report"

If creating issues, use the same mechanism as `/report-issue`.

## Context Management

- For each analysis category, spawn a subagent to analyze in parallel. Each subagent returns findings as: {file, line, category, severity, description, fix}
- For projects with >500 files, partition by directory and delegate to subagents
- After generating the report, compact the conversation — the report is the deliverable

## Important Behaviors

- Scan all directories (except `vendor/`, `node_modules/`, `tmp/`, `.git/`)
- Prioritize findings by real impact, not theoretical risk
- Include positive observations — reinforce good patterns
- Reference actual code with file:line for every finding
- Suggested fixes must be actionable, not vague
- Compare with previous analysis if `docs/ANALYSIS-*.md` exists — highlight new vs resolved findings
