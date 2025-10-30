# Context Session Guidelines

## Single Source of Truth Principle

There should be **ONLY ONE** active context session file at any time. This ensures consistency and prevents confusion.

## Current Active Session
- **Active File**: `.claude/tasks/context_session_001.md` (ALWAYS 001)
- **Purpose**: Track all work, decisions, and progress for the current development initiative

## Rules for Context Sessions

1. **DO NOT CREATE NEW SESSION FILES** unless explicitly starting a completely new, unrelated initiative
2. **ALWAYS APPEND** to the existing active session file
3. **NEVER DELETE** previous entries - they provide valuable history
4. **USE TIMESTAMPS** for each new work log entry

## File Naming Convention

### Active Session (Always the Same)
- **Format**: `context_session_001.md` (3-digit zero-padded, ALWAYS 001)
- **Rule**: Only ONE active session file exists at a time
- **Git Tracking**: Only the active session (001) is tracked in git
- **Template**: Use `context_session_template.md` when creating new sessions

### Archive Naming (Date-Based)
- **Format**: `context_session_YYYY-MM-DD_description.md`
- **Example**: `context_session_2025-10-20_delete-functionality.md`
- **Location**: All archived sessions go to `.claude/tasks/archived/`
- **Git Tracking**: Archived sessions are NOT tracked (in .gitignore)

## What Goes in a Context Session
- Overall objectives and goals
- Key decisions and rationale
- Work completed with timestamps
- Files modified with specific line numbers
- Test results and findings
- Next steps and pending tasks

## What Does NOT Go in a Context Session
- Detailed code implementations (those belong in the actual code files)
- Sub-agent specific documentation (they should append their findings)
- Temporary notes or drafts

## Session Lifecycle

### 1. Start New Session
- Check if active session exists (`context_session_001.md`)
- If exists, archive it first (see step 3)
- Create new session from template: `cp context_session_template.md context_session_001.md`
- Fill in session header (date, task, goals)

### 2. During Session
- Append updates with timestamps
- Never edit previous entries (append-only)
- Include commit references for all code changes
- Cross-reference documentation created

### 3. End Session (triggers)
- Major task completion
- Weekly rollover (every Monday)
- File size > 400KB
- Switching to unrelated work

### 4. Archive Process
```bash
# Move current session to archive with descriptive name
mv .claude/tasks/context_session_001.md \
   .claude/tasks/archived/context_session_$(date +%Y-%m-%d)_task-description.md

# Create new session from template
cp .claude/tasks/context_session_template.md \
   .claude/tasks/context_session_001.md
```

## Preventing Proliferation
The `.gitignore` file is configured to:
- Ignore all `context_session_*.md` files by default
- Explicitly track only the current active session (`context_session_001.md`)
- Ignore the archived folder

**Key Points:**
- Active session ALWAYS uses **001** (never increments)
- Archives use **dates** (YYYY-MM-DD) for uniqueness
- This prevents .gitignore pattern conflicts
- Simplifies agent workflow (always look for 001)

## For Sub-Agents
Sub-agents should:
- Read the active context session at the start of their work
- Append their findings to the SAME file
- Never create parallel context files
- Include the context path when delegating to other agents