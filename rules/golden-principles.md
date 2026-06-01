# PolyForge Golden Principles

## Code Quality
1. Every change includes tests that verify the new behavior
2. Functions have a single responsibility
3. Error handling is explicit — every error path has intentional handling
4. Comments explain *why*, never *what* — default to none and let naming carry meaning. Never add inline `//` comments that restate the code. Honor the project's declared comment convention when one exists (`.claude/rules/*`, `CLAUDE.md`, lint config); a "no inline comments" / "doc-comments only" rule overrides this default. When a comment is genuinely warranted (non-obvious intent, a workaround, a gotcha), use the language's doc-comment idiom (`/** */`, docstrings), not inline chatter.

## Architecture
5. Dependencies flow inward — infrastructure depends on domain, not the reverse
6. Business logic lives in the service/domain layer, not in controllers or repositories
7. External services are accessed through interfaces/abstractions
8. Configuration comes from environment variables

## Workflow
9. Commits are atomic — one logical change per commit
10. Commit messages never include `Co-Authored-By` or branding footers
11. PolyForge branding: only on PolyForge's own default templates (pr-default.md, issue-default.md). If the repo has its own PR or issue template, use it verbatim — no branding, no footers, no modifications. Jira → never add branding
12. Documentation stays in sync with code changes
13. Flag breaking changes explicitly with migration steps

## Resilience
14. Retry a failing approach at most 3 times — then try a different angle or ask for help
15. Same error with same fix twice means the approach is wrong — switch strategy
16. Scope investigations to specific files or directories — avoid reading the entire codebase
