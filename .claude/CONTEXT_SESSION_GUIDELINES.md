# Context Session Guidelines

## Single Source of Truth Principle

There should be **ONLY ONE** active context session file at any time. This ensures consistency and prevents confusion.

## Current Active Session
- **Active File**: `.claude/tasks/context_session_002.md`
- **Purpose**: Track all work, decisions, and progress for the current development initiative

## Rules for Context Sessions

1. **DO NOT CREATE NEW SESSION FILES** unless explicitly starting a completely new, unrelated initiative
2. **ALWAYS APPEND** to the existing active session file
3. **NEVER DELETE** previous entries - they provide valuable history
4. **USE TIMESTAMPS** for each new work log entry

## File Naming Convention
If a new session is absolutely necessary:
- Use format: `context_session_XXX.md` where XXX is a sequential number
- Update `.gitignore` to track only the new active session
- Archive the previous session to `.claude/tasks/archived/`

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

## Preventing Proliferation
The `.gitignore` file is configured to:
- Ignore all `context_session_*.md` files by default
- Explicitly track only the current active session (`context_session_002.md`)
- Ignore the archived folder

When switching to a new session:
1. Archive the current session
2. Create the new session file
3. Update `.gitignore` to track the new file
4. Commit the changes

## For Sub-Agents
Sub-agents should:
- Read the active context session at the start of their work
- Append their findings to the SAME file
- Never create parallel context files
- Include the context path when delegating to other agents