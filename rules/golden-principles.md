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
9. Documentation stays in sync with code changes
10. Flag breaking changes explicitly with migration steps

## Resilience
11. Retry a failing approach at most 3 times — then try a different angle or ask for help
12. Same error with same fix twice means the approach is wrong — switch strategy
13. Scope investigations to specific files or directories — avoid reading the entire codebase
