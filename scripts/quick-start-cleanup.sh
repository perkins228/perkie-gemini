#!/bin/bash
# Quick Start Infrastructure Cleanup
# One-command solution to get your deployment infrastructure clean
# Usage: ./quick-start-cleanup.sh [--full] [--dry-run]

set -e

FULL_CLEANUP=${1}
DRY_RUN=${2}

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

# Welcome message
show_welcome() {
    echo "🚀 Infrastructure Cleanup Quick Start"
    echo "======================================"
    echo
    echo "This script will:"
    echo "✅ Check file structure integrity"
    echo "✅ Set up deployment automation"
    echo "✅ Configure authentication management"
    echo "✅ Verify cloud infrastructure"
    echo "✅ Set up monitoring tools"
    
    if [[ "$FULL_CLEANUP" == "--full" ]]; then
        echo "✅ Perform full cleanup (including archives)"
    fi
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        echo "🔍 DRY RUN MODE - No changes will be made"
    fi
    
    echo
    read -p "Continue with cleanup? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "👋 Cleanup cancelled"
        exit 0
    fi
}

# Prerequisites check
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    local required_tools=("git" "curl" "find" "sed" "awk")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    # Check optional tools
    if ! command -v "gcloud" &> /dev/null; then
        warn "gcloud CLI not found - Cloud infrastructure checks will be limited"
    fi
    
    if ! command -v "shopify" &> /dev/null; then
        warn "Shopify CLI not found - Theme deployment features will be limited"
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        echo "Please install missing tools and try again"
        exit 1
    fi
    
    log "✅ Prerequisites check complete"
}

# Make scripts executable
setup_scripts() {
    log "🔧 Setting up deployment scripts..."
    
    local scripts=(
        "scripts/deployment/production-deployment-v2.sh"
        "scripts/deployment/cache-bust-manager.sh"
        "scripts/deployment/infrastructure-monitor.sh"
        "scripts/deployment/shopify-auth-manager.sh"
        "scripts/file-structure-guardian.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            chmod +x "$script"
            log "✅ Made executable: $script"
        else
            error "Script not found: $script"
        fi
    done
    
    # Create scripts directory if it doesn't exist
    mkdir -p scripts/deployment
    
    log "✅ Scripts setup complete"
}

# File structure cleanup
run_file_structure_check() {
    log "🛡️  Running file structure analysis..."
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "🔍 DRY RUN: Would check file structure"
        return
    fi
    
    if [[ -f "scripts/file-structure-guardian.sh" ]]; then
        ./scripts/file-structure-guardian.sh check
        
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            error "Critical file structure issues found"
            read -p "Auto-fix issues? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                ./scripts/file-structure-guardian.sh fix
            fi
        elif [[ $exit_code -eq 1 ]]; then
            warn "File structure warnings found - consider running: ./scripts/file-structure-guardian.sh fix"
        fi
    else
        error "File structure guardian not found"
    fi
}

# Infrastructure verification
verify_infrastructure() {
    log "🏗️  Verifying cloud infrastructure..."
    
    if ! command -v "gcloud" &> /dev/null; then
        warn "Skipping cloud infrastructure check - gcloud not available"
        return
    fi
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "🔍 DRY RUN: Would verify infrastructure"
        return
    fi
    
    if [[ -f "scripts/deployment/infrastructure-monitor.sh" ]]; then
        ./scripts/deployment/infrastructure-monitor.sh status
    else
        error "Infrastructure monitor not found"
    fi
    
    # Check for missing staging buckets
    local missing_buckets=()
    local staging_buckets=("perkieprints-staging-cache" "perkieprints-staging-customer-images")
    
    for bucket in "${staging_buckets[@]}"; do
        if ! gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
            missing_buckets+=("$bucket")
        fi
    done
    
    if [[ ${#missing_buckets[@]} -gt 0 ]]; then
        warn "Missing staging buckets: ${missing_buckets[*]}"
        read -p "Create missing buckets? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            for bucket in "${missing_buckets[@]}"; do
                gcloud storage buckets create "gs://$bucket" --location=us-central1
                log "✅ Created bucket: $bucket"
            done
        fi
    fi
}

# Authentication setup
setup_authentication() {
    log "🔑 Setting up authentication management..."
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "🔍 DRY RUN: Would set up authentication"
        return
    fi
    
    if [[ -f "scripts/deployment/shopify-auth-manager.sh" ]]; then
        ./scripts/deployment/shopify-auth-manager.sh status
        
        if [[ $? -ne 0 ]]; then
            warn "Authentication issues detected"
            read -p "Run authentication health check? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                ./scripts/deployment/shopify-auth-manager.sh health
            fi
        fi
    else
        error "Auth manager not found"
    fi
}

# Create deployment aliases
create_aliases() {
    log "🔗 Creating deployment aliases..."
    
    local alias_file="scripts/aliases.sh"
    
    cat > "$alias_file" << 'EOF'
#!/bin/bash
# Deployment Aliases - Source this file to get convenient shortcuts
# Usage: source scripts/aliases.sh

# File Structure Management
alias check-files='./scripts/file-structure-guardian.sh check'
alias fix-files='./scripts/file-structure-guardian.sh fix'
alias watch-files='./scripts/file-structure-guardian.sh watch'

# Cache Management
alias bust-cache='./scripts/deployment/cache-bust-manager.sh bust'
alias emergency-cache='./scripts/deployment/cache-bust-manager.sh emergency'
alias verify-cache='./scripts/deployment/cache-bust-manager.sh verify'

# Authentication
alias check-auth='./scripts/deployment/shopify-auth-manager.sh status'
alias login-prod='./scripts/deployment/shopify-auth-manager.sh login production'
alias login-staging='./scripts/deployment/shopify-auth-manager.sh login staging'
alias auth-health='./scripts/deployment/shopify-auth-manager.sh health'

# Deployment
alias deploy-full='./scripts/deployment/production-deployment-v2.sh full'
alias deploy-api='./scripts/deployment/production-deployment-v2.sh api'
alias deploy-theme='./scripts/deployment/production-deployment-v2.sh theme'
alias deploy-staging='./scripts/deployment/production-deployment-v2.sh full staging'

# Infrastructure Monitoring
alias infra-status='./scripts/deployment/infrastructure-monitor.sh status'
alias infra-watch='./scripts/deployment/infrastructure-monitor.sh status --watch'
alias infra-logs='./scripts/deployment/infrastructure-monitor.sh logs'
alias infra-costs='./scripts/deployment/infrastructure-monitor.sh costs'
alias infra-cleanup='./scripts/deployment/infrastructure-monitor.sh cleanup'

echo "🚀 Deployment aliases loaded!"
echo "Available commands:"
echo "  File Structure: check-files, fix-files, watch-files"
echo "  Cache: bust-cache, emergency-cache, verify-cache"  
echo "  Auth: check-auth, login-prod, login-staging, auth-health"
echo "  Deploy: deploy-full, deploy-api, deploy-theme, deploy-staging"
echo "  Monitor: infra-status, infra-watch, infra-logs, infra-costs, infra-cleanup"
EOF
    
    chmod +x "$alias_file"
    log "✅ Created deployment aliases: $alias_file"
    log "   To use: source scripts/aliases.sh"
}

# Generate summary report
generate_summary() {
    local summary_file="cleanup_summary_$(date +%Y%m%d_%H%M%S).txt"
    
    log "📊 Generating cleanup summary..."
    
    cat > "$summary_file" << EOF
Infrastructure Cleanup Summary
Generated: $(date)
==============================

Scripts Created:
✅ Production Deployment Script: scripts/deployment/production-deployment-v2.sh
✅ Cache Bust Manager: scripts/deployment/cache-bust-manager.sh  
✅ Infrastructure Monitor: scripts/deployment/infrastructure-monitor.sh
✅ Authentication Manager: scripts/deployment/shopify-auth-manager.sh
✅ File Structure Guardian: scripts/file-structure-guardian.sh
✅ Deployment Aliases: scripts/aliases.sh

Quick Commands:
---------------
# Start with file structure check
./scripts/file-structure-guardian.sh check

# Deploy safely to staging first
./scripts/deployment/production-deployment-v2.sh full staging

# Deploy to production
./scripts/deployment/production-deployment-v2.sh full production

# Monitor infrastructure
./scripts/deployment/infrastructure-monitor.sh status --watch

# Emergency cache clear
./scripts/deployment/cache-bust-manager.sh emergency

# Load convenient aliases
source scripts/aliases.sh

Next Steps:
-----------
1. Review file structure issues: ./scripts/file-structure-guardian.sh check
2. Test staging deployment
3. Set up monitoring
4. Review cost optimization recommendations

Documentation:
--------------
See: INFRASTRUCTURE_CLEANUP_RECOMMENDATIONS.md for detailed guidance

EOF
    
    log "📝 Summary saved: $summary_file"
    echo
    echo "📋 Quick Start Complete!"
    echo "======================="
    echo "✅ All deployment scripts are ready"
    echo "✅ Infrastructure tools configured"  
    echo "✅ Authentication management set up"
    echo
    echo "🚀 Next steps:"
    echo "1. Review: $summary_file"
    echo "2. Load aliases: source scripts/aliases.sh"
    echo "3. Check files: check-files"
    echo "4. Test deploy: deploy-staging"
    echo
    echo "📚 Full documentation: INFRASTRUCTURE_CLEANUP_RECOMMENDATIONS.md"
}

# Archive cleanup (full mode only)
full_archive_cleanup() {
    if [[ "$FULL_CLEANUP" != "--full" ]]; then
        return
    fi
    
    log "🧹 Running full archive cleanup..."
    
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "🔍 DRY RUN: Would clean up archives"
        return
    fi
    
    # Move files from nested archive levels to main archive
    find _archive/ -name "*.js" -path "*/_archive/*" | while read -r nested_file; do
        local relative_path=${nested_file#_archive/}
        local target_dir="_archive/consolidated/$(dirname "$relative_path")"
        mkdir -p "$target_dir"
        mv "$nested_file" "$target_dir/"
        log "📦 Consolidated: $nested_file"
    done
    
    # Remove empty archive directories
    find _archive/ -type d -empty -delete 2>/dev/null || true
    
    log "✅ Archive cleanup complete"
}

# Main execution
main() {
    show_welcome
    check_prerequisites
    setup_scripts
    run_file_structure_check
    verify_infrastructure
    setup_authentication
    create_aliases
    full_archive_cleanup
    generate_summary
}

# Handle interrupts gracefully
trap 'echo -e "\n👋 Cleanup interrupted"; exit 1' INT TERM

# Run main function
main "$@"