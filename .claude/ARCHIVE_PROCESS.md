# Context Archive Process

## When to Archive
- File size > 400KB (check with `./claude/scripts/check-context.sh`)
- Every Friday afternoon
- Before starting new major feature
- After completing major milestone

## Quick Archive Steps (10 minutes)

### 1. Check if archive needed
```bash
.claude/scripts/check-context.sh
```

### 2. Create archive directory
```bash
mkdir -p .claude/archives/$(date +%Y-%m-%d)
```

### 3. Archive by topic
- Copy completed sections to topic-specific files
- Keep related discussions together
- Preserve decision rationale

### 4. Create new compact context
Use template from `.claude/archives/INDEX.md`:
- Current system state
- Recent fixes
- Active work items
- Keep last 100 lines for continuity

### 5. Commit the archive
```bash
git add .claude/
git commit -m "Archive context: [topics archived]"
git push origin staging
```

## What to Keep Active
✅ Current week's work
✅ Open bugs and investigations  
✅ System configuration and API endpoints
✅ Testing commands and utilities
✅ Pending decisions

## What to Archive
📦 Completed feature implementations
📦 Resolved bug investigations
📦 Sub-agent debates and evaluations
📦 Historical decisions already acted upon
📦 Detailed technical discussions

## Archive Naming Convention
```
.claude/archives/
  2025-08-29/           # Date-based directories
    social-sharing.md   # Topic-based files
    infrastructure.md
    product-decisions.md
    README.md          # Summary of what's in this archive
```

## Tips for Efficient Archiving
1. Use clear section headers (##) for easy extraction
2. Include dates in your entries
3. Summarize before archiving (remove verbose discussions)
4. Keep decision outcomes, archive the debates
5. Cross-reference with archive INDEX.md

## Recovery
If you need archived information:
1. Check `.claude/archives/INDEX.md` for quick reference
2. Navigate to specific archive by date/topic
3. Search with: `grep -r "search term" .claude/archives/`

## Metrics for Success
- Archive takes <10 minutes
- Context file stays under 400KB
- No lost critical information
- Can find archived info in <1 minute