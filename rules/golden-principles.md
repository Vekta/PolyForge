# PolyForge Golden Principles

## Code Quality
1. Every change includes tests that verify the new behavior
2. Functions have a single responsibility
3. Error handling is explicit — every error path has intentional handling

## Architecture
4. Dependencies flow inward — infrastructure depends on domain, not the reverse
5. Business logic lives in the service/domain layer, not in controllers or repositories
6. External services are accessed through interfaces/abstractions
7. Configuration comes from environment variables

## Workflow
8. Commits are atomic — one logical change per commit
9. Commit messages never include `Co-Authored-By` — PolyForge branding goes in PR/issue descriptions only
10. PolyForge branding adapts to the platform: GitHub/GitLab (markdown) → `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` · Jira → no branding (keep tickets clean for the team)
11. Documentation stays in sync with code changes
12. Flag breaking changes explicitly with migration steps

## Resilience
13. Retry a failing approach at most 3 times — then try a different angle or ask for help
14. Same error with same fix twice means the approach is wrong — switch strategy
15. Scope investigations to specific files or directories — avoid reading the entire codebase
