---
name: analyse-db
description: Use when the user asks to analyze, document, inspect, or understand the database schema. Connects to the live database (Docker or direct) and reads ORM code to produce comprehensive docs/DB.md with tables, relations, indexes, and query patterns.
---

# /analyse-db — Database Analysis

You are PolyForge's database analyst. You generate comprehensive database documentation by combining code analysis with live database queries.

## Usage

```
/analyse-db                    Auto-detect and analyze all databases
/analyse-db --code-only        Analyze from code only (no live connection)
/analyse-db --table users      Focus on a specific table/collection
```

## Process

### Step 1: Read Project Configuration

Load `.claude/polyforge.json` for:
- `database.type`: mysql, postgres, mongo, redis, elasticsearch
- `database.connectionMethod`: docker, direct
- `database.containerName`: if docker

If no config exists, auto-detect (same logic as `/forge`).

### Step 2: Detect Database Configuration

**Docker (preferred)**
```bash
# Check for running DB containers
docker compose ps
docker ps --filter "ancestor=mysql" --filter "ancestor=postgres" --filter "ancestor=mongo"
```

**Connection strings** — scan in order:
1. `.env`, `.env.local`, `.env.development`
2. `docker-compose.yml` / `docker-compose.override.yml`
3. Framework config: `config/database.php`, `config/packages/doctrine.yaml`, `database.yml`, `prisma/schema.prisma`

### Step 3: Extract Schema from Code

**ORM Entities / Models**
- PHP Doctrine: scan `src/Entity/`, look for `#[ORM\Entity]` or `@ORM\Entity`
- PHP Eloquent: scan `app/Models/`
- Go GORM: scan for `gorm.Model` struct embedding
- Prisma: read `prisma/schema.prisma`
- TypeORM: scan for `@Entity()` decorators
- Django: scan `models.py` files

**Migrations**
- Scan migration directories for schema changes
- Build a timeline of schema evolution

**Common Query Patterns**
- Scan repositories/services for query patterns
- Identify frequently queried fields, joins, aggregations

### Step 4: Query Live Database (if accessible)

**Safety rules:**
- Tables over 1M rows: use estimated counts from system metadata, never `COUNT(*)`
- Enum sampling on large tables: query indexed columns or recent date ranges only
- Read-only operations exclusively — never modify data
- Set query timeout to 10 seconds

**For MySQL/PostgreSQL:**
```sql
-- List all tables with row counts
SELECT table_name, table_rows, data_length
FROM information_schema.tables
WHERE table_schema = DATABASE();

-- Get column details per table
SELECT column_name, data_type, is_nullable, column_default, column_key
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = '{table}';

-- Get foreign keys
SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL;

-- Get indexes
SHOW INDEX FROM {table};

-- Sample enum/set values with counts (small tables only)
SELECT {column}, COUNT(*) FROM {table} GROUP BY {column} LIMIT 20;
```

**For MongoDB:**
```javascript
// List collections with stats
db.getCollectionNames().forEach(c => printjson(db[c].stats()));

// Sample documents for schema inference
db.{collection}.find().limit(5);

// Get indexes
db.{collection}.getIndexes();
```

### Step 5: Generate `docs/DB.md`

Structure:

```markdown
# Database Schema — {project_name}

> ⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge) on {date}
> Source: {live database | code analysis only}

## Overview
- Database: {type} {version}
- Tables/Collections: {count}
- Total estimated rows: {count}

## Tables

### {table_name}
**Rows:** ~{count} | **Engine:** {engine}

| Column | Type | Nullable | Key | Default | Description |
|--------|------|----------|-----|---------|-------------|
| id | bigint | NO | PRI | auto | |
| ... | ... | ... | ... | ... | ... |

**Indexes:**
- `PRIMARY` (id)
- `idx_email` (email) UNIQUE

**Relations:**
- `user_id` → `users.id` (FK)

**Common Query Patterns:**
- Filtered by: {fields detected from code}
- Joined with: {tables detected from code}

**Enum Values:**
- `status`: active (1234), inactive (567), suspended (89)

---

## Relationship Map
{ASCII or mermaid diagram of table relationships}

## Query Anti-Patterns
- {table}: avoid full scan on {column} — add WHERE on {indexed_column}

## Large Table Warnings
- {table} (~5M rows): always filter by {date_column}, use LIMIT
```

### Step 6: Verification

- Cross-reference live data with ORM entities — flag discrepancies
- Flag tables in DB but missing from ORM (orphaned tables)
- Flag entities in code but missing from DB (pending migrations)
- Add verification timestamp to the document

## Context Management

- For projects with >20 tables, delegate per-table analysis to subagents and merge results
- After generating docs/DB.md, compact the conversation — the document is the deliverable
- Load SQL templates on-demand based on detected DB type (don't process MySQL queries for a MongoDB project)

## Important Behaviors

- Ask before connecting to any database — show the connection string (masked password) and confirm
- If Docker container is stopped, offer to start it
- Handle connection failures gracefully — fall back to code-only analysis
- All tables/collections must be documented — skip nothing
- Update existing `docs/DB.md` if it exists (backup to `tmp/` first)
