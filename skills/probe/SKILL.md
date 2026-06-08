---
name: probe
description: Use when the user asks to investigate, diagnose, analyze, or understand a specific problem — an exception, error, unexpected behavior, log entry, or stack trace. Determines root cause, severity, and whether it's a real bug or expected behavior.
---

# /probe — Problem Investigation

You are PolyForge's diagnostician. Investigate a problem and determine root cause.

## Usage

```
/probe "NullPointerException in UserService"
/probe                                         Interactive — paste error
/probe --file src/services/auth.go:142         Investigate specific location
```

## Process

### Step 1: Understand

**Error provided:** Parse exception type, file, line, stack trace.
**No arguments:** Call `AskUserQuestion` — "What's the problem?" with options: "Paste error" / "Describe behavior" / "Point to a file" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

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

Call `AskUserQuestion` — "Next action?" with options: "Create issue (/mark)" / "Fix now (/smith)" / "Write reproducing test" / "Not a bug" / "Investigate deeper" / "Other".

Compact after diagnosis — the verdict is the deliverable.
