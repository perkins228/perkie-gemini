#!/bin/bash
# Shopify Authentication Manager
# Manages Shopify CLI authentication and store sessions
# Usage: ./shopify-auth-manager.sh [login|switch|status] [store-name]

set -e

ACTION=${1:-status}
STORE_NAME=${2}

# Store configuration
declare -A STORES=(
    ["production"]="your-store.myshopify.com"
    ["staging"]="your-store-staging.myshopify.com"
    ["dev"]="your-store-dev.myshopify.com"
)

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

# Check current authentication status
check_auth_status() {
    log "🔍 Checking Shopify authentication status..."
    
    # Check if shopify CLI is installed
    if ! command -v shopify &> /dev/null; then
        error "Shopify CLI not found. Install with: npm install -g @shopify/cli"
        return 1
    fi
    
    # Check current auth status
    local auth_status=$(shopify auth status 2>&1 || echo "not_authenticated")
    
    if echo "$auth_status" | grep -q "You're currently logged in"; then
        echo -e "   Status: ${GREEN}✅ Authenticated${NC}"
        
        # Extract current store
        local current_store=$(echo "$auth_status" | grep -o "[^/]*\.myshopify\.com" | head -1)
        if [[ -n "$current_store" ]]; then
            echo "   Current Store: $current_store"
            
            # Check which environment this represents
            for env in "${!STORES[@]}"; do
                if [[ "${STORES[$env]}" == "$current_store" ]]; then
                    echo -e "   Environment: ${BLUE}$env${NC}"
                    break
                fi
            done
        fi
        
        # Check session validity by testing a simple command
        if shopify theme list &>/dev/null; then
            echo -e "   Session: ${GREEN}✅ Valid${NC}"
        else
            echo -e "   Session: ${YELLOW}⚠️  Expired${NC}"
            warn "Session may have expired. Re-authentication recommended."
        fi
        
    else
        echo -e "   Status: ${RED}❌ Not Authenticated${NC}"
        return 1
    fi
}

# Login to specific store
login_to_store() {
    local store=${1:-production}
    local store_url="${STORES[$store]}"
    
    if [[ -z "$store_url" ]]; then
        error "Unknown store environment: $store"
        echo "Available stores: ${!STORES[@]}"
        return 1
    fi
    
    log "🔑 Logging in to $store store ($store_url)..."
    
    # Logout first to clear any existing session
    shopify auth logout &>/dev/null || true
    
    # Login to specific store
    if shopify auth login --store "$store_url"; then
        log "✅ Successfully authenticated with $store store"
        
        # Verify authentication
        sleep 2
        if check_auth_status &>/dev/null; then
            log "✅ Authentication verified"
            
            # Cache authentication for future use
            cache_auth_info "$store" "$store_url"
        else
            error "Authentication verification failed"
            return 1
        fi
    else
        error "Authentication failed for $store store"
        return 1
    fi
}

# Cache authentication info
cache_auth_info() {
    local store=$1
    local store_url=$2
    local auth_cache_dir="$HOME/.shopify_auth_cache"
    
    mkdir -p "$auth_cache_dir"
    
    cat > "$auth_cache_dir/current_session" << EOF
CURRENT_STORE=$store
STORE_URL=$store_url
LOGIN_TIME=$(date +%s)
SESSION_VALID_UNTIL=$(date -d '+2 hours' +%s)
EOF
    
    log "💾 Cached authentication info for $store"
}

# Check if cached session is still valid
is_cached_session_valid() {
    local auth_cache_dir="$HOME/.shopify_auth_cache"
    local cache_file="$auth_cache_dir/current_session"
    
    if [[ ! -f "$cache_file" ]]; then
        return 1
    fi
    
    source "$cache_file"
    local current_time=$(date +%s)
    
    if [[ $current_time -lt $SESSION_VALID_UNTIL ]]; then
        echo "Cached session for $CURRENT_STORE is valid"
        return 0
    else
        echo "Cached session expired"
        return 1
    fi
}

# Smart authentication - use cache if valid, otherwise re-authenticate
smart_auth() {
    local target_store=${1:-production}
    
    log "🧠 Smart authentication for $target_store..."
    
    # Check if we're already authenticated to the right store
    if check_auth_status &>/dev/null; then
        local current_auth=$(shopify auth status 2>&1)
        local current_store_url=$(echo "$current_auth" | grep -o "[^/]*\.myshopify\.com" | head -1)
        
        if [[ "$current_store_url" == "${STORES[$target_store]}" ]]; then
            log "✅ Already authenticated to correct store ($target_store)"
            return 0
        fi
    fi
    
    # Check cached session
    if is_cached_session_valid && [[ "$CURRENT_STORE" == "$target_store" ]]; then
        log "✅ Using valid cached session for $target_store"
        return 0
    fi
    
    # Need to authenticate
    log "🔄 Authentication required for $target_store"
    login_to_store "$target_store"
}

# Switch between stores
switch_store() {
    local target_store=${1:-production}
    
    log "🔄 Switching to $target_store store..."
    
    if [[ -z "${STORES[$target_store]}" ]]; then
        error "Unknown store: $target_store"
        echo "Available stores: ${!STORES[@]}"
        return 1
    fi
    
    smart_auth "$target_store"
}

# Auto-authenticate for deployment
auto_auth_for_deployment() {
    local deployment_type=${1:-staging}
    
    log "🤖 Auto-authenticating for $deployment_type deployment..."
    
    # For production deployments, always require fresh authentication
    if [[ "$deployment_type" == "production" ]]; then
        warn "Production deployment detected - requiring fresh authentication"
        login_to_store "production"
    else
        smart_auth "$deployment_type"
    fi
}

# Session health check
session_health_check() {
    log "🏥 Running session health check..."
    
    local health_score=0
    local max_score=5
    
    # Test 1: Basic auth status
    if check_auth_status &>/dev/null; then
        ((health_score++))
        echo "✅ Authentication status: Pass"
    else
        echo "❌ Authentication status: Fail"
    fi
    
    # Test 2: Theme list access
    if shopify theme list &>/dev/null; then
        ((health_score++))
        echo "✅ Theme access: Pass"
    else
        echo "❌ Theme access: Fail"
    fi
    
    # Test 3: Store info access
    if shopify app info &>/dev/null; then
        ((health_score++))
        echo "✅ Store info access: Pass"
    else
        echo "❌ Store info access: Fail"
    fi
    
    # Test 4: Upload permissions
    if shopify theme push --help &>/dev/null; then
        ((health_score++))
        echo "✅ Upload permissions: Pass"
    else
        echo "❌ Upload permissions: Fail"
    fi
    
    # Test 5: Session freshness (less than 1 hour old)
    if is_cached_session_valid; then
        local auth_cache_dir="$HOME/.shopify_auth_cache"
        source "$auth_cache_dir/current_session" 2>/dev/null || LOGIN_TIME=0
        local current_time=$(date +%s)
        local session_age=$((current_time - LOGIN_TIME))
        
        if [[ $session_age -lt 3600 ]]; then
            ((health_score++))
            echo "✅ Session freshness: Pass ($(($session_age / 60)) minutes old)"
        else
            echo "❌ Session freshness: Fail ($(($session_age / 60)) minutes old)"
        fi
    else
        echo "❌ Session freshness: Fail (no cache)"
    fi
    
    # Health score summary
    echo "🏥 Health Score: $health_score/$max_score"
    
    if [[ $health_score -ge 4 ]]; then
        echo -e "   Overall Health: ${GREEN}✅ Healthy${NC}"
        return 0
    elif [[ $health_score -ge 2 ]]; then
        echo -e "   Overall Health: ${YELLOW}⚠️  Degraded${NC}"
        return 1
    else
        echo -e "   Overall Health: ${RED}❌ Critical${NC}"
        return 2
    fi
}

# Main function
main() {
    echo "🏪 Shopify Auth Manager - Action: $ACTION"
    echo
    
    case $ACTION in
        "status")
            check_auth_status
            session_health_check
            ;;
        "login")
            local store=${STORE_NAME:-production}
            login_to_store "$store"
            ;;
        "switch")
            local store=${STORE_NAME:-production}
            switch_store "$store"
            ;;
        "smart")
            local store=${STORE_NAME:-production}
            smart_auth "$store"
            ;;
        "health")
            session_health_check
            ;;
        "auto")
            local deployment_type=${STORE_NAME:-staging}
            auto_auth_for_deployment "$deployment_type"
            ;;
        *)
            error "Invalid action: $ACTION"
            echo "Usage: $0 [status|login|switch|smart|health|auto] [store-name]"
            echo "Available stores: ${!STORES[@]}"
            exit 1
            ;;
    esac
}

# Export functions for use in other scripts
export -f smart_auth
export -f auto_auth_for_deployment
export -f session_health_check

main "$@"