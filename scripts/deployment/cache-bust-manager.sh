#!/bin/bash
# Cache Busting Manager - Advanced CDN and Browser Cache Management
# Usage: ./cache-bust-manager.sh [clear|bust|verify] [--force]

set -e

ACTION=${1:-bust}
FORCE_FLAG=${2}
TIMESTAMP=$(date +%s)
GIT_HASH=$(git rev-parse --short HEAD)

# Shopify CDN cache-busting strategies
clear_shopify_cdn() {
    echo "🔧 Applying Shopify CDN cache-busting strategies..."
    
    # Strategy 1: Asset versioning with query parameters
    local critical_assets=("effects-v2.js" "core-engine.js" "api-client.js")
    
    for asset in "${critical_assets[@]}"; do
        if [[ -f "assets/$asset" ]]; then
            echo "📝 Adding cache-busting to: $asset"
            
            # Create backup
            cp "assets/$asset" "assets/${asset}.backup"
            
            # Add cache-busting comment at top of file
            {
                echo "/* Cache-bust: v${GIT_HASH}-${TIMESTAMP} */"
                cat "assets/${asset}.backup"
            } > "assets/$asset"
            
            # Create versioned copy for immediate deployment
            cp "assets/$asset" "assets/${asset%.js}-v${GIT_HASH}.js"
        fi
    done
    
    # Strategy 2: Update references in liquid templates
    echo "🔗 Updating asset references in templates..."
    
    # Update core-engine references
    find sections/ snippets/ templates/ -name "*.liquid" -exec sed -i.bak \
        "s/effects-v2\.js/effects-v2.js?v=${GIT_HASH}\&t=${TIMESTAMP}/g" {} \;
    
    # Strategy 3: Meta refresh for immediate effect
    if [[ "$FORCE_FLAG" == "--force" ]]; then
        echo "⚡ Applying force refresh techniques..."
        
        # Add cache-busting meta tags to theme.liquid if not exists
        if ! grep -q "cache-control" layout/theme.liquid; then
            sed -i '/{% comment %}.*styles.*{% endcomment %}/a\
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\
  <meta http-equiv="Pragma" content="no-cache">\
  <meta http-equiv="Expires" content="0">' layout/theme.liquid
        fi
        
        # Force reload of service worker if it exists
        if [[ -f "assets/sw-pet-remover.js" ]]; then
            echo "🔄 Forcing service worker update..."
            sed -i "s/const CACHE_VERSION = .*/const CACHE_VERSION = 'v${GIT_HASH}-${TIMESTAMP}';/" assets/sw-pet-remover.js
        fi
    fi
    
    echo "✅ Shopify CDN cache-busting complete"
}

# Browser cache verification
verify_cache_clearing() {
    echo "🔍 Verifying cache clearing effectiveness..."
    
    # Check if critical assets have new versions
    local verification_failed=0
    
    echo "📊 Cache verification report:"
    echo "================================"
    
    # Test asset accessibility with different cache-busting parameters
    local test_urls=(
        "https://cdn.shopify.com/s/files/1/[STORE_ID]/assets/effects-v2.js?v=${GIT_HASH}"
        "https://cdn.shopify.com/s/files/1/[STORE_ID]/assets/core-engine.js?t=${TIMESTAMP}"
    )
    
    for url in "${test_urls[@]}"; do
        echo "Testing: $url"
        # Note: In production, replace [STORE_ID] with actual store ID
        echo "  - Manual verification required (URL above)"
    done
    
    # Check for successful cache-busting markers
    if grep -q "Cache-bust: v${GIT_HASH}" assets/effects-v2.js; then
        echo "✅ effects-v2.js: Cache-bust marker present"
    else
        echo "❌ effects-v2.js: Cache-bust marker missing"
        verification_failed=1
    fi
    
    if grep -q "Cache-bust: v${GIT_HASH}" assets/core-engine.js; then
        echo "✅ core-engine.js: Cache-bust marker present"
    else
        echo "❌ core-engine.js: Cache-bust marker missing"
        verification_failed=1
    fi
    
    echo "================================"
    
    if [[ $verification_failed -eq 0 ]]; then
        echo "✅ Cache verification passed"
        return 0
    else
        echo "❌ Cache verification failed"
        return 1
    fi
}

# Emergency cache clear
emergency_cache_clear() {
    echo "🚨 Emergency cache clear initiated..."
    
    # Rename critical files with random suffixes
    local random_suffix=$(openssl rand -hex 4)
    
    # Backup and rename effects-v2.js
    cp assets/effects-v2.js "assets/effects-v2-emergency-${random_suffix}.js"
    
    # Update all references
    find sections/ snippets/ templates/ -name "*.liquid" -exec sed -i.emergency \
        "s/effects-v2\.js/effects-v2-emergency-${random_suffix}.js/g" {} \;
    
    # Add aggressive cache-busting headers
    cat >> assets/effects-v2-emergency-${random_suffix}.js << EOF

/* EMERGENCY CACHE CLEAR */
console.log('Emergency cache clear active: ${random_suffix}');
if (window.location.search.indexOf('clear-cache') === -1) {
    window.location.href = window.location.href + '?clear-cache=${random_suffix}&t=' + Date.now();
}
EOF
    
    echo "✅ Emergency cache clear complete"
    echo "⚠️  Remember to revert emergency changes after verification"
    echo "📝 Revert command: git checkout -- sections/ snippets/ templates/ assets/"
}

# Restore from backup
restore_from_backup() {
    echo "🔄 Restoring from backup..."
    
    # Restore backed up files
    for backup in assets/*.backup; do
        if [[ -f "$backup" ]]; then
            original=${backup%.backup}
            mv "$backup" "$original"
            echo "✅ Restored: $(basename "$original")"
        fi
    done
    
    # Restore liquid template backups
    find sections/ snippets/ templates/ -name "*.bak" -o -name "*.emergency" | while read backup; do
        original=${backup%.*}
        mv "$backup" "$original"
        echo "✅ Restored: $original"
    done
    
    echo "✅ Backup restoration complete"
}

# Main function
main() {
    echo "🚀 Cache Bust Manager - Action: $ACTION"
    
    case $ACTION in
        "clear"|"bust")
            clear_shopify_cdn
            ;;
        "verify")
            verify_cache_clearing
            ;;
        "emergency")
            emergency_cache_clear
            ;;
        "restore")
            restore_from_backup
            ;;
        *)
            echo "❌ Invalid action: $ACTION"
            echo "Usage: $0 [clear|bust|verify|emergency|restore] [--force]"
            exit 1
            ;;
    esac
    
    echo "✅ Cache bust operation complete"
}

main "$@"