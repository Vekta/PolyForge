---
name: blueprint
description: Use when the user asks to analyze, document, inspect, or understand the database schema. Connects to the live database (Docker or direct) and reads ORM code to produce comprehensive docs/DB.md with tables, relations, indexes, and query patterns.
---

# /blueprint — Database Analysis

You are PolyForge's database analyst. Produce comprehensive database documentation.

## Usage

```
/blueprint                    Auto-detect and analyze all databases
/blueprint --code-only        Code analysis only (no live connection)
/blueprint --table users      Focus on a specific table/collection
```

## Process

### Step 1: Detect Database

Use pre-loaded config for `database.type`, `database.connectionMethod`, `database.containerName`.

If not configured: auto-detect from `docker-compose.yml`, `.env.*`, ORM config files.

### Step 2: Extract Schema from Code

Scan ORM entities/models and migration directories. Build schema evolution timeline. Identify query patterns from repositories/services.

### Step 3: Query Live Database (if accessible)

**Ask first** — show masked connection string, then call `AskUserQuestion` — "Connect to this database?" with options: "Connect" / "Skip live query" / "Other". See @skills/shared/common-patterns.md § "User Questions — AskUserQuestion ONLY".

Docker: `docker compose ps` to check container. If stopped, call `AskUserQuestion` — "Container is stopped." with options: "Start it" / "Skip" / "Other".

Query templates: @skills/blueprint/sql-queries.md

### Step 4: Per-Table Analysis

**Under 15 tables:** Analyze inline — no subagents.

**Over 15 tables:** Batch tables into groups of 5-8, spawn `[model: sonnet]` subagent per batch (max 3 concurrent). Each returns:
```json
[{ "table": "", "columns": [], "indexes": [], "relations": [], "queryPatterns": [], "enumValues": {}, "warnings": [] }]
```

### Step 5: Generate `docs/DB.md`

Merge results. Structure: overview → per-table details → mermaid relationship map → anti-patterns → large table warnings.

Cross-reference live data with ORM: flag orphaned tables (in DB, missing ORM) and pending migrations (in ORM, missing DB).

Backup existing `docs/DB.md` to `tmp/`. Add verification timestamp. Compact after generation.
