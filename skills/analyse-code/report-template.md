# Analysis Report Structure

Generate `docs/ANALYSIS-{YYYY-MM-DD}.md` with the following structure:

---

# Code Analysis Report — {project_name}

> ⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge) on {date}
> Scope: {full project | specific directory}
> Files analyzed: {count}

## Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 0 | 0 | 0 | 0 |
| Performance | 0 | 0 | 0 | 0 |
| Architecture | 0 | 0 | 0 | 0 |
| Code Quality | 0 | 0 | 0 | 0 |
| Config | 0 | 0 | 0 | 0 |
| Testing | 0 | 0 | 0 | 0 |
| **Total** | **0** | **0** | **0** | **0** |

## Critical Findings

### [{category}-{N}] {title} — `{file}:{line}`
**Severity:** Critical | **Category:** {category}
**Description:** {what is happening and why it matters}
**Suggested Fix:** {concrete, actionable fix — not vague}

---

## High Priority Findings
{same format}

## Medium Priority Findings
{same format}

## Low Priority Findings
{same format}

## Positive Observations
- {things done well — reinforce good practices}

## Recommended Action Order
1. Fix all Critical findings immediately
2. Address High findings in next sprint
3. Create tickets for Medium findings
4. Add Low findings to backlog

---

**Notes on findings format:**
- Every finding must include: file, line, category, severity, description, suggested fix
- Mark findings as `[NEW]` or `[RECURRING]` when a previous `docs/ANALYSIS-*.md` exists
- Prioritize by real impact, not theoretical risk
