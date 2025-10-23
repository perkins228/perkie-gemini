#!/bin/bash
FILE=".claude/tasks/context_session_001.md"
SIZE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE")
LINES=$(wc -l < "$FILE")
SIZE_KB=$((SIZE / 1024))

echo "Context Status:"
echo "  Size: ${SIZE_KB}KB"
echo "  Lines: $LINES"

if [ $SIZE -gt 500000 ]; then
    echo "  🔴 CRITICAL: Archive immediately (>500KB)"
elif [ $SIZE -gt 400000 ]; then
    echo "  🟡 WARNING: Consider archiving soon (>400KB)"
else
    echo "  🟢 OK: Size manageable"
fi