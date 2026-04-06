---
name: analyse-db
description: "Use when the user asks to analyze, document, inspect, or understand the database schema. Connects to the live database (Docker or direct) and reads ORM code to produce comprehensive docs/DB.md with tables, relations, indexes, and query patterns."
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

### Step 1: Detect Database

Use pre-loaded config for `database.type`, `database.connectionMethod`, `database.containerName`.

If not configured: auto-detect from `docker-compose.yml`, `.env.*`, ORM config files.

### Step 2: Extract Schema from Code

Scan ORM entities/models and migration directories. Build schema evolution timeline. Identify query patterns from repositories/services.

### Step 3: Query Live Database (if accessible)

**Ask first** — show masked connection string, confirm before connecting.

Docker: `docker compose ps` to check container. Offer to start if stopped.

**Error handling:**
- Container won't start → fall back to `--code-only` mode; note in output that live data is unavailable
- Connection refused → verify port/credentials from config, retry once, then fall back to code-only
- Query timeout → cancel query, skip that table's live data, continue with remaining tables

Query templates: @skills/analyse-db/sql-queries.md

### Step 4: Per-Table Analysis

**Under 15 tables:** Analyze inline — no subagents.

**Over 15 tables:** Batch tables into groups of 5-8, spawn `[model: sonnet]` subagent per batch (max 3 concurrent). Each returns:
```json
[{
  "table": "users",
  "columns": [{ "name": "id", "type": "uuid", "nullable": false }],
  "indexes": [{ "name": "idx_users_email", "columns": ["email"], "unique": true }],
  "relations": [{ "to": "orders", "type": "one-to-many", "fk": "user_id" }],
  "queryPatterns": ["findByEmail", "findWithOrders"],
  "enumValues": { "status": ["active", "suspended"] },
  "warnings": ["missing index on frequently queried column: created_at"]
}]
```

### Step 5: Generate `docs/DB.md`

Merge results. Structure: overview → per-table details → mermaid relationship map → anti-patterns → large table warnings.

Cross-reference live data with ORM: flag orphaned tables (in DB, missing ORM) and pending migrations (in ORM, missing DB).

Backup existing `docs/DB.md` to `tmp/`. Add verification timestamp. Compact after generation.
