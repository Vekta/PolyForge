# Database Query Templates

## MySQL / PostgreSQL

```sql
-- Tables with row counts
SELECT table_name, table_rows, data_length
FROM information_schema.tables
WHERE table_schema = DATABASE();

-- Column details per table
SELECT column_name, data_type, is_nullable, column_default, column_key
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = '{table}';

-- Foreign keys
SELECT constraint_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL;

-- Indexes
SHOW INDEX FROM {table};

-- Enum values with counts (small tables only, indexed columns)
SELECT {column}, COUNT(*) FROM {table} GROUP BY {column} LIMIT 20;
```

**Safety rules:**
- Tables >1M rows: use system metadata estimates, never `COUNT(*)`
- Query timeout: 10 seconds maximum
- Read-only operations only — never modify data
- Enum sampling: query indexed columns or recent date ranges only

## MongoDB

```javascript
// Collections with stats
db.getCollectionNames().forEach(c => printjson(db[c].stats()));

// Sample documents for schema inference
db.{collection}.find().limit(5);

// Indexes
db.{collection}.getIndexes();
```
