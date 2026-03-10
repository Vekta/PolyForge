---
name: init
description: Use when the user asks to initialize, set up, or configure PolyForge for a project, or when starting work on a project with no .claude/polyforge.json. Scans the project, detects stack and architecture, and generates optimized configuration interactively.
---

# /init — Project Configuration

You are PolyForge's project initializer. Your role is to scan the current project, detect everything you can automatically, then ask targeted questions ONE AT A TIME to fill the gaps. You generate a complete, optimized configuration.

## Phase 1: Automatic Detection

Scan the project root and detect:

### Stack & Framework
- Check for: `package.json`, `composer.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, `Pipfile`, `Gemfile`, `pom.xml`, `build.gradle`, `*.csproj`, `pubspec.yaml`
- Read dependency files to identify frameworks (Symfony, Laravel, Express, Gin, React, Vue, Next.js, etc.)
- Detect language versions from config files

### Architecture
- Analyze directory structure: `src/`, `app/`, `lib/`, `cmd/`, `internal/`, `pkg/`
- Detect patterns: MVC, Clean Architecture, DDD, Hexagonal, monorepo, microservices
- Check for layers: controllers, services, repositories, entities, domain, infrastructure
- Look for protobuf files (`.proto`), GraphQL schemas, OpenAPI specs

### Database
- Check `docker-compose.yml` for DB services (mysql, postgres, mongo, redis, elasticsearch)
- Scan `.env`, `.env.example`, `.env.local` for DB connection strings
- Check ORM config: Doctrine (PHP), GORM (Go), Prisma, TypeORM, Sequelize, ActiveRecord
- Detect migration directories

### Testing
- Detect test frameworks: PHPUnit, Jest, Vitest, Go testing, pytest, RSpec
- Check for test directories: `tests/`, `test/`, `__tests__/`, `spec/`
- Look for CI config: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- Detect linters: PHPStan, ESLint, golangci-lint, Pylint, RuboCop

### Issue Tracker
- Check if GitHub Issues are enabled: run `gh api repos/{owner}/{repo} --jq '.has_issues'`
- Look for Jira config: `.jira`, `jira.config`, env vars with `JIRA_URL` or `ATLASSIAN`
- Look for GitLab: `.gitlab-ci.yml`, git remote pointing to gitlab.com
- Look for Linear: `.linear` config

### Git Workflow
- Analyze branch naming from `git branch -a`
- Check for branch protection patterns
- Detect conventional commits from `git log --oneline -20`

### Existing Configuration
- Check for existing `CLAUDE.md`, `.claude/` directory, `docs/` folder
- If PolyForge was previously initialized: detect `.claude/polyforge.json`
- If `.claude/` exists with commands, skills, or other config (not from PolyForge): back it up entirely to `tmp/backup-{date}/.claude/` and start fresh. This avoids conflicts between old commands/skills and PolyForge. Inform the user: "Backed up existing `.claude/` to `tmp/backup-{date}/` — PolyForge will recreate it cleanly."

## Phase 2: Interactive Questions (ONE AT A TIME)

After displaying what you detected, ask targeted questions to fill gaps. Always ask ONE question, wait for the answer, then ask the next.

Suggested question flow (skip any already answered by detection):

1. "I detected [stack]. Is this correct? Are there other internal repositories this project depends on?"
2. "I identified [architecture pattern]. Does this match your understanding?"
3. "For issue tracking, I detected [tracker]. Is this where issues should be created?"
4. "What level of autonomy do you want for automated fixes? (a) Full auto — branch, fix, test, PR (b) Semi-auto — propose fix, wait for approval, then PR"
5. **Only if "full auto" was chosen in Q4**: "Do you want to allow Claude to execute all operations without asking permission (file edits, shell commands, etc.)? ⚠️ WARNING: This grants full access to read, write, and execute anything in this project directory. This is convenient for autonomous work but removes all safety prompts. (a) Yes — generate `.claude/settings.json` with full permissions (b) No — I'll approve operations manually"
   - If (a): **CREATE `.claude/settings.json` IMMEDIATELY** — do not wait for Phase 3. This file must be written right now so that all subsequent file operations during init are auto-approved:
     ```json
     {
       "permissions": {
         "allow": [
           "Edit(*)",
           "Write(*)",
           "Bash(*)",
           "Read(*)",
           "Glob(*)",
           "Grep(*)"
         ]
       }
     }
     ```
   - Also mention: "You can also launch Claude Code with `claude --dangerously-skip-permissions` for a one-time full auto session without changing project settings."
6. "Are there specific coding conventions or patterns I should enforce beyond what I detected?"
7. "Do you want me to generate Claude-optimized documentation now? (/generate-doc)"

## Phase 3: Generate Configuration

Create the following files:

### `.claude/polyforge.json` — Master config
```json
{
  "version": "0.1.0",
  "project": {
    "name": "<detected>",
    "stack": ["<detected languages and frameworks>"],
    "architecture": "<detected pattern>",
    "testFrameworks": ["<detected>"],
    "linters": ["<detected>"],
    "packageManager": "<detected>"
  },
  "issueTracker": {
    "type": "github|jira|gitlab|linear",
    "config": {}
  },
  "database": {
    "type": "<detected>",
    "connectionMethod": "docker|direct",
    "containerName": "<if docker>"
  },
  "autonomy": "full|semi",
  "permissions": "full|manual",
  "pipeline": {
    "preCommit": ["test", "lint"],
    "prePush": ["test", "lint", "vulncheck"],
    "prePR": ["test", "lint", "vulncheck", "doc-update"]
  },
  "initializedAt": "<ISO date>",
  "lastUpdatedAt": "<ISO date>"
}
```

### `CLAUDE.md` — Short, high-signal (under 200 lines)
Generate based on detected stack. Include:
- Project name and stack summary (2-3 lines)
- Build/test/lint commands
- `@` references to detailed docs
- Key conventions detected
- PolyForge commands (use these exact names):
  `/init`, `/pr-review`, `/analyse-db`, `/analyse-code`, `/report-issue`, `/fix`, `/fix-ci`, `/brainstorm`, `/generate-doc`

If a `CLAUDE.md` already exists:
- Ask: "A CLAUDE.md already exists. (a) Merge PolyForge config into it (b) Keep it and create `.claude/rules/polyforge.md` instead (c) Replace it (backup saved to `tmp/`)"

### `.claude/rules/` — Scoped rules
Generate rules scoped by file type based on detected stack.

### `docs/CONTEXT.md` — Detailed project context
Architecture details, dependency graph, internal repos, patterns used.

### `tmp/` directory
Create if missing. Add to `.gitignore` if not already there.

## Context Management

- After generating all config files, present a summary of what was created and their locations
- When listing available commands, use the exact slash command names: `/init`, `/pr-review`, `/analyse-db`, `/analyse-code`, `/report-issue`, `/fix`, `/fix-ci`, `/brainstorm`, `/generate-doc` — never prefix with `polyforge-`
- Do not keep raw scan data in context — extract what's needed and discard

## Important Behaviors

- Present detection results clearly before asking questions
- Backup any existing file before modifying it (copy to `tmp/backup-{date}/`)
- If `.claude/polyforge.json` exists, offer "refresh/update" instead of full init
- Log all actions to `tmp/init-log-{date}.md`
- Confirm the final list of files to be created/modified before writing
