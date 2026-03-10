---
name: analyse-db
description: Use when the user asks to analyze, document, inspect, or understand the database schema. Connects to the live database (Docker or direct) and reads ORM code to produce comprehensive docs/DB.md with tables, relations, indexes, and query patterns.
---

# /analyse-db — Database Analysis

You are PolyForge's database analyst. Produce comprehensive database documentation.

## Usage

```
/analyse-db                    Auto-detect and analyze all databases
/analyse-db --code-only        Code analysis only (no live connection)
/analyse-db --table users      Focus on a specific table/collection
```

## Process

### Step 1: Read Configuration

Load `.claude/polyforge.json` for `database.type`, `database.connectionMethod`, `database.containerName`.

If no config: auto-detect from `docker-compose.yml`, `.env.*`, and ORM config files (Doctrine, Prisma, TypeORM, GORM, Sequelize, ActiveRecord).

### Step 2: Extract Schema from Code

Scan ORM entities/models and migration directories. Build a timeline of schema evolution. Identify common query patterns from repositories/services.

### Step 3: Query Live Database (if accessible)

**Ask first** — show masked connection string, confirm before connecting.

For Docker: `docker compose ps` to check if container is running. Offer to start if stopped.

Query templates by database type: see @skills/analyse-db/sql-queries.md

### Step 4: Per-Table Analysis (parallel subagents)

For each table/collection, spawn a `[model: sonnet]` subagent with:
- ORM entity code for that table
- Migration history for that table
- Query patterns referencing that table
- Live schema data (if available)

Each subagent returns:
```json
{ "table": "users", "columns": [...], "indexes": [...], "relations": [...], "queryPatterns": [...], "enumValues": {}, "warnings": [] }
```

Run all table subagents in parallel.

### Step 5: Generate `docs/DB.md`

Merge subagent results. Structure:
- Overview: database type, table count, total estimated rows
- Per-table: columns, indexes, relations, common query patterns, enum values
- Relationship map (mermaid diagram)
- Query anti-patterns detected
- Large table warnings (>1M rows)

Cross-reference live data with ORM entities:
- Flag tables in DB but missing from ORM (orphaned tables)
- Flag entities in code but missing from DB (pending migrations)

Update existing `docs/DB.md` if it exists (backup to `tmp/` first). Add verification timestamp.

## Context Management

- All per-table analysis delegated to `[model: sonnet]` subagents — only structured JSON returned to parent
- Load SQL templates on-demand from @skills/analyse-db/sql-queries.md based on detected DB type
- After generating docs/DB.md, compact the conversation — the document is the deliverable
