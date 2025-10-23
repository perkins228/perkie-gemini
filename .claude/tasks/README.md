# Session Context Files

This directory contains session context files that track work across agent sessions.

## File Structure

```
.claude/tasks/
├── context_session_001.md          # Active session (git tracked)
├── context_session_template.md     # Template for new sessions
├── archived/                        # Historical sessions (git ignored)
│   ├── context_session_2025-10-20_delete-functionality.md
│   └── ...
└── README.md                        # This file
```

## Active Session: context_session_001.md

**Purpose**: Single source of truth for current work
**Format**: 3-digit zero-padded (always 001 for active)
**Git**: Tracked in version control
**Updates**: Append-only with timestamps

## Archived Sessions

**Purpose**: Historical record of completed work
**Format**: `context_session_YYYY-MM-DD_description.md`
**Git**: NOT tracked (in .gitignore)
**Location**: `.claude/tasks/archived/`

## Session Lifecycle

### When to Archive

Archive the current session when:
1. Major task completed (feature shipped, bug fixed)
2. Weekly rollover (every Monday)
3. File size exceeds 400KB
4. Switching to unrelated work

### How to Archive

```bash
# 1. Move current session to archive with descriptive name
mv .claude/tasks/context_session_001.md \
   .claude/tasks/archived/context_session_$(date +%Y-%m-%d)_task-description.md

# 2. Create new session from template
cp .claude/tasks/context_session_template.md \
   .claude/tasks/context_session_001.md

# 3. Update new session header
# Edit context_session_001.md and fill in:
# - Session start date
# - Task description
# - Initial assessment
```

### Naming Conventions

**Active Session**:
```
context_session_001.md  (always 001, never increments)
```

**Archived Sessions**:
```
context_session_YYYY-MM-DD_short-description.md

Examples:
✅ context_session_2025-10-21_repository-cleanup.md
✅ context_session_2025-10-20_delete-functionality.md
✅ context_session_2025-10-15_api-warmup-optimization.md

❌ context_session_002.md  (don't use numbers for archives)
❌ context_session_oct_21.md  (use ISO date format)
❌ context_session_2025-10-21.md  (missing description)
```

## Git Tracking

**Tracked** (committed to repo):
- `context_session_001.md` (active session only)
- `context_session_template.md` (template)
- `README.md` (this file)

**Ignored** (NOT in repo):
- `context_session_002.md` through `context_session_999.md`
- `archived/context_session_*.md` (all archived sessions)

This ensures:
- Only active work tracked in git history
- Historical sessions preserved locally
- No git conflicts across sessions
- Clean repository state

## Template Usage

When creating a new session:

1. Copy template:
   ```bash
   cp context_session_template.md context_session_001.md
   ```

2. Fill in header:
   - Session start date (YYYY-MM-DD)
   - Task/project description
   - Initial goals/objectives

3. Append work as you go:
   - Timestamp each entry
   - Include commit hashes
   - Link to documentation created
   - Note decisions made

4. Archive when complete (see lifecycle above)

## Best Practices

### During Session
- ✅ Append new entries at the bottom
- ✅ Use timestamps for all updates
- ✅ Include commit references
- ✅ Link to related documentation
- ❌ Don't edit previous entries
- ❌ Don't delete content

### File Organization
- ✅ One active session at a time
- ✅ Archive completed work promptly
- ✅ Use descriptive archive names
- ✅ Keep archives in chronological order
- ❌ Don't accumulate multiple active sessions
- ❌ Don't delete archives (preserve history)

### Cross-References
- Link to context session in documentation
- Reference commits in context session
- Create INDEX.md if >20 archived sessions
- Include context path when delegating to sub-agents

## Questions?

See CLAUDE.md section "Session Context File Management" for full details.
