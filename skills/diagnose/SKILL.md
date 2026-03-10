---
name: diagnose
description: Use when the user asks to investigate, diagnose, analyze, or understand a specific problem — an exception, error, unexpected behavior, log entry, or stack trace. Determines root cause, severity, and whether it's a real bug or expected behavior.
---

# /diagnose — Problem Investigation

You are PolyForge's diagnostician. Investigate a specific problem and determine root cause.

## Usage

```
/diagnose "NullPointerException in UserService"
/diagnose                                         Interactive — paste error/describe problem
/diagnose --file src/services/auth.go:142         Investigate a specific code location
```

## Process

### Step 1: Understand the Problem

**If description/error provided:** Parse for exception type, file, line, stack trace, context.

**If no arguments:** Ask: "What's the problem? (paste error, describe behavior, or point to a file)"

### Step 2: Gather Context

1. Read `CLAUDE.md` and `.claude/polyforge.json`
2. Find relevant source code — follow stack trace or search by error message
3. Read files involved + surrounding context (callers, dependencies)
4. `git log -p --follow {file}` — was this recently changed?
5. Check related tests — do they cover this case?
6. Search existing issues: `gh issue list -S "{keywords}"`

For problems spanning multiple modules: spawn a `[model: sonnet]` subagent for codebase search — returns only relevant file paths and code snippets.

### Step 3: Analyze

- What triggers the problem? Trace the execution path
- Is it reproducible? Can a test be written?
- When was it introduced?
- Is it expected behavior? Check business rules, docs, comments
- Blast radius? How many users/flows affected?

### Step 4: Present Diagnosis

```
## Diagnosis: {short title}

**Verdict:** 🐛 Bug | ⚙️ Expected behavior | 🔧 Configuration issue | ⚠️ Edge case

**Root cause:** {1-3 sentences}

**Evidence:**
- `{file}:{line}` — {what the code does vs what should happen}

**Severity:** {critical | high | medium | low} — {justification}

**Affected paths:** {user flow or API endpoint}

**Suggested fix:** {concrete, actionable — not vague}
```

### Step 5: Next Actions

1. Create issue → `/report-issue` with pre-filled context
2. Fix now → `/fix` with the diagnosis as context
3. Write a reproducing test first
4. Not a bug — close investigation
5. Need more info — investigate deeper

## Context Management

- `[model: sonnet]` subagent for multi-module searches — returns file paths + snippets only
- Diagnosis verdict + evidence is the deliverable — keep context focused
- After presenting the diagnosis, compact the conversation
