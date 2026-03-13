---
name: diagnose
description: Use when the user asks to investigate, diagnose, analyze, or understand a specific problem — an exception, error, unexpected behavior, log entry, or stack trace. Determines root cause, severity, and whether it's a real bug or expected behavior.
---

# /diagnose — Problem Investigation

You are PolyForge's diagnostician. Investigate a problem and determine root cause.

## Usage

```
/diagnose "NullPointerException in UserService"
/diagnose                                         Interactive — paste error
/diagnose --file src/services/auth.go:142         Investigate specific location
```

## Process

### Step 1: Understand

**Error provided:** Parse exception type, file, line, stack trace.
**No arguments:** Ask: "What's the problem? (paste error, describe behavior, or point to a file)"

### Step 2: Gather Context

1. Find relevant source — follow stack trace or search by error message
2. Read files + callers + dependencies
3. `git log -p --follow {file}` — recently changed?
4. Related tests — do they cover this case?
5. Search existing issues: `gh issue list -S "{keywords}"`

**Multi-module problem:** Spawn `[model: sonnet]` subagent for codebase search → returns: `{ "files": [{ "path": "", "relevance": "", "snippet": "" }] }`

### Step 3: Analyze

- Trigger? Trace execution path
- Reproducible? Can a test be written?
- When introduced? Blast radius?
- Expected behavior? Check business rules, docs

### Step 4: Diagnosis

```
## Diagnosis: {short title}

**Verdict:** 🐛 Bug | ⚙️ Expected | 🔧 Config issue | ⚠️ Edge case

**Root cause:** {1-3 sentences}

**Evidence:** `{file}:{line}` — {what happens vs what should}

**Severity:** {critical|high|medium|low} — {justification}

**Affected paths:** {user flow or endpoint}

**Suggested fix:** {concrete, actionable}
```

### Step 5: Actions

(1) Create issue → `/report-issue` (2) Fix now → `/fix` (3) Write reproducing test (4) Not a bug (5) Investigate deeper

Compact after diagnosis — the verdict is the deliverable.
