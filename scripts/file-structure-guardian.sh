#!/bin/bash
# File Structure Guardian
# Prevents wrong file edits and maintains clean structure
# Usage: ./file-structure-guardian.sh [check|fix|watch|protect]

set -e

ACTION=${1:-check}
WATCH_INTERVAL=5

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

# Define file structure rules
declare -A ACTIVE_FILES=(
    ["assets/effects-v2.js"]="Main effects processor - ACTIVE"
    ["assets/core-engine.js"]="Core engine - ACTIVE"
    ["assets/api-client.js"]="API client - ACTIVE"
    ["assets/pet-processor-v5.js"]="Pet processor V5 - ACTIVE"
    ["assets/pet-processor-v5.css"]="Pet processor V5 styles - ACTIVE"
    ["sections/ks-pet-processor-v5.liquid"]="Pet processor V5 section - ACTIVE"
    ["backend/inspirenet-api/src/main.py"]="API main - ACTIVE"
)

declare -A DEPRECATED_FILES=(
    ["assets/effects.js"]="OLD - Use effects-v2.js instead"
    ["assets/ks-pet-bg-remover.js"]="OLD - Functionality moved to core-engine.js"
    ["sections/ks-pet-bg-remover.liquid"]="OLD - Use ks-pet-processor-v5.liquid"
    ["sections/pet-processor-v4.liquid"]="ARCHIVED - Use ks-pet-processor-v5.liquid"
)

declare -A DANGEROUS_PATTERNS=(
    ["**/effects-DUPLICATE-*"]="Duplicate file - DO NOT USE"
    ["**/*-backup-*"]="Backup file in wrong location"
    ["assets/*-old*"]="Old file in active directory"
    ["assets/*-legacy*"]="Legacy file in active directory"
)

# Check file structure integrity
check_file_structure() {
    log "🔍 Checking file structure integrity..."
    
    local issues_found=0
    local warnings_found=0
    
    echo "📋 Active Files Status:"
    echo "======================="
    
    for file in "${!ACTIVE_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
            local modified=$(stat -f%Sm "$file" 2>/dev/null || stat -c%y "$file" 2>/dev/null | cut -d' ' -f1)
            echo -e "✅ $file (${size} bytes, modified: $modified)"
        else
            echo -e "❌ $file - ${RED}MISSING${NC}"
            ((issues_found++))
        fi
    done
    
    echo
    echo "⚠️  Deprecated Files Check:"
    echo "=========================="
    
    for file in "${!DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            echo -e "⚠️  $file - ${YELLOW}EXISTS${NC} (${DEPRECATED_FILES[$file]})"
            ((warnings_found++))
        else
            echo -e "✅ $file - Not present (good)"
        fi
    done
    
    echo
    echo "🚨 Dangerous Patterns Check:"
    echo "============================"
    
    for pattern in "${!DANGEROUS_PATTERNS[@]}"; do
        local matches=$(find . -path "./_archive" -prune -o -name "$(basename "$pattern")" -type f -print 2>/dev/null | grep -v "_archive" || true)
        if [[ -n "$matches" ]]; then
            echo -e "🚨 Pattern '$pattern' found:"
            echo "$matches" | while read -r match; do
                echo -e "   ${RED}$match${NC} - ${DANGEROUS_PATTERNS[$pattern]}"
                ((issues_found++))
            done
        fi
    done
    
    echo
    echo "📊 Structure Analysis:"
    echo "====================="
    
    # Count files in _archive
    local archive_count=$(find _archive/ -type f | wc -l || echo "0")
    echo "📦 Archive files: $archive_count"
    
    # Check for files with similar names
    echo "🔍 Similar file name analysis:"
    find assets/ -name "effects*.js" | while read -r file; do
        local basename_file=$(basename "$file")
        if [[ "$basename_file" != "effects-v2.js" ]]; then
            warn "   Similar to active file: $file"
            ((warnings_found++))
        fi
    done
    
    # Summary
    echo
    echo "📈 Summary:"
    echo "==========="
    echo -e "Issues found: ${RED}$issues_found${NC}"
    echo -e "Warnings: ${YELLOW}$warnings_found${NC}"
    
    if [[ $issues_found -eq 0 ]] && [[ $warnings_found -eq 0 ]]; then
        echo -e "Overall status: ${GREEN}✅ Clean${NC}"
        return 0
    elif [[ $issues_found -eq 0 ]]; then
        echo -e "Overall status: ${YELLOW}⚠️  Warnings only${NC}"
        return 1
    else
        echo -e "Overall status: ${RED}❌ Issues require attention${NC}"
        return 2
    fi
}

# Fix common file structure issues
fix_file_structure() {
    log "🔧 Fixing file structure issues..."
    
    local fixes_applied=0
    
    # Move deprecated files to archive
    echo "📦 Moving deprecated files to archive..."
    for file in "${!DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            local archive_path="_archive/deprecated/$(dirname "$file")"
            mkdir -p "$archive_path"
            mv "$file" "$archive_path/"
            echo "✅ Moved $file to $archive_path/"
            ((fixes_applied++))
        fi
    done
    
    # Remove dangerous pattern files
    echo "🗑️  Removing dangerous pattern files..."
    for pattern in "${!DANGEROUS_PATTERNS[@]}"; do
        find . -path "./_archive" -prune -o -name "$(basename "$pattern")" -type f -print | grep -v "_archive" | while read -r file; do
            if [[ -f "$file" ]]; then
                echo "🗑️  Removing dangerous file: $file"
                rm "$file"
                ((fixes_applied++))
            fi
        done
    done
    
    # Clean up old backup files in assets
    echo "🧹 Cleaning old backup files..."
    find assets/ -name "*.backup*" -o -name "*.bak" -o -name "*.tmp" | while read -r backup; do
        if [[ -f "$backup" ]]; then
            echo "🗑️  Removing backup file: $backup"
            rm "$backup"
            ((fixes_applied++))
        fi
    done
    
    # Ensure active files exist
    echo "📝 Checking for missing active files..."
    for file in "${!ACTIVE_FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Critical file missing: $file"
            echo "   This requires manual intervention!"
        fi
    done
    
    echo "✅ Applied $fixes_applied fixes"
    
    # Re-run check to verify
    echo
    log "🔍 Re-checking structure after fixes..."
    check_file_structure
}

# Protect files from accidental edits
protect_files() {
    log "🛡️  Setting up file protection..."
    
    # Create .gitattributes for important files
    if [[ ! -f ".gitattributes" ]]; then
        touch ".gitattributes"
    fi
    
    # Add protection rules
    cat >> .gitattributes << EOF

# File Structure Guardian Protection Rules
# Do not modify these files without understanding the implications

# Active Files - Review Required
assets/effects-v2.js diff=javascript
assets/core-engine.js diff=javascript
sections/pet-processor-v4.liquid diff=liquid

# Deprecated Files - Should Not Be Modified
assets/effects.js deprecated
assets/ks-pet-bg-remover.js deprecated
sections/ks-pet-bg-remover.liquid deprecated
EOF
    
    # Create file modification warning system
    cat > scripts/pre-edit-check.sh << 'EOF'
#!/bin/bash
# Pre-edit check - Run before modifying files
FILE=$1

# Check if file is deprecated
if grep -q "deprecated" .gitattributes | grep -q "$FILE"; then
    echo "⚠️  WARNING: $FILE is deprecated!"
    echo "   Consider using the active equivalent instead."
    read -p "Continue editing deprecated file? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if file is in archive
if [[ "$FILE" =~ _archive ]]; then
    echo "🚨 ERROR: Attempting to edit archived file: $FILE"
    echo "   This file should not be modified!"
    exit 1
fi

# Check for similar files
BASENAME=$(basename "$FILE")
if [[ "$BASENAME" =~ effects.*\.js ]]; then
    echo "🔍 Effects file detected: $FILE"
    if [[ "$FILE" != "assets/effects-v2.js" ]]; then
        echo "⚠️  WARNING: You may want to edit assets/effects-v2.js instead"
        echo "   Current file: $FILE"
        echo "   Active file:  assets/effects-v2.js"
        read -p "Continue with current file? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi
EOF
    
    chmod +x scripts/pre-edit-check.sh
    
    echo "✅ File protection configured"
    echo "   Use: ./scripts/pre-edit-check.sh <filename> before editing"
}

# Watch for file structure changes
watch_file_structure() {
    log "👁️  Starting file structure watch mode..."
    echo "   Monitoring for changes every ${WATCH_INTERVAL} seconds"
    echo "   Press Ctrl+C to stop"
    
    local last_check=""
    
    while true; do
        local current_check=$(find assets/ sections/ backend/inspirenet-api/src/ -type f -name "*.js" -o -name "*.liquid" -o -name "*.py" | sort | md5sum | cut -d' ' -f1)
        
        if [[ -n "$last_check" ]] && [[ "$current_check" != "$last_check" ]]; then
            echo
            warn "File structure changed detected at $(date)"
            
            # Quick check for problematic changes
            if find assets/ -name "effects.js" | grep -q .; then
                error "Deprecated effects.js detected!"
            fi
            
            if find . -path "./_archive" -prune -o -name "*DUPLICATE*" -type f -print | grep -v "_archive" | grep -q .; then
                error "Duplicate files detected outside archive!"
            fi
            
            echo "   Run './file-structure-guardian.sh check' for full analysis"
        fi
        
        last_check="$current_check"
        sleep $WATCH_INTERVAL
    done
}

# Generate file structure report
generate_report() {
    local report_file="file_structure_report_$(date +%Y%m%d_%H%M%S).md"
    
    log "📊 Generating file structure report: $report_file"
    
    cat > "$report_file" << EOF
# File Structure Report
Generated: $(date)

## Active Files Status
| File | Status | Size | Last Modified |
|------|--------|------|---------------|
EOF
    
    for file in "${!ACTIVE_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
            local modified=$(stat -f%Sm "$file" 2>/dev/null || stat -c%y "$file" 2>/dev/null | cut -d' ' -f1)
            echo "| $file | ✅ Present | ${size} bytes | $modified |" >> "$report_file"
        else
            echo "| $file | ❌ Missing | - | - |" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Deprecated Files Status
| File | Status | Description |
|------|--------|-------------|
EOF
    
    for file in "${!DEPRECATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            echo "| $file | ⚠️ Exists | ${DEPRECATED_FILES[$file]} |" >> "$report_file"
        else
            echo "| $file | ✅ Not Present | ${DEPRECATED_FILES[$file]} |" >> "$report_file"
        fi
    done
    
    echo >> "$report_file"
    echo "## Archive Statistics" >> "$report_file"
    echo "- Total archived files: $(find _archive/ -type f | wc -l)" >> "$report_file"
    echo "- Archive size: $(du -sh _archive/ | cut -f1)" >> "$report_file"
    
    echo "📝 Report generated: $report_file"
}

# Main function
main() {
    echo "🛡️  File Structure Guardian - Action: $ACTION"
    echo
    
    case $ACTION in
        "check")
            check_file_structure
            ;;
        "fix")
            fix_file_structure
            ;;
        "protect")
            protect_files
            ;;
        "watch")
            watch_file_structure
            ;;
        "report")
            generate_report
            ;;
        *)
            error "Invalid action: $ACTION"
            echo "Usage: $0 [check|fix|protect|watch|report]"
            exit 1
            ;;
    esac
}

# Handle interrupts gracefully
trap 'echo -e "\n👋 Guardian stopped"; exit 0' INT TERM

main "$@"