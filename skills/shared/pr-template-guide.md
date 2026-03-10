# PR Template Usage

## Step 1: Check for existing template

```bash
cat .github/pull_request_template.md 2>/dev/null || \
  cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null || \
  cat .github/PULL_REQUEST_TEMPLATE/*.md 2>/dev/null || \
  cat docs/pull_request_template.md 2>/dev/null
```

## Step 2a: If a template exists — NON-NEGOTIABLE

1. Use the template VERBATIM — keep every section, checkbox, and HTML comment
2. Fill in applicable fields (`[x]` for checked boxes, real text for sections)
3. Leave sections empty or unchecked if not applicable — NEVER delete them
4. Append `*⚒ Forged with [PolyForge](https://github.com/Vekta/polyforge)*` at the very bottom
5. The PR must look like a human filled it in, not a bot replacement

## Step 2b: If no template exists

Use the default template at @skills/shared/pr-default.md
