#!/bin/bash
# Production Deployment Script v2 - Enhanced with infrastructure validation
# Usage: ./production-deployment-v2.sh [api|theme|full] [--skip-cache-clear]

set -e

DEPLOYMENT_TYPE=${1:-full}
SKIP_CACHE_CLEAR=${2}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="deployment_${TIMESTAMP}.log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOGFILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOGFILE"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOGFILE"
}

# Pre-deployment validation
validate_environment() {
    log "🔍 Validating deployment environment..."
    
    # Check required tools
    local required_tools=("gcloud" "shopify" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check GCP authentication
    if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" | grep -q "."; then
        error "No active GCP authentication found. Run: gcloud auth login"
        exit 1
    fi
    
    # Check Git status
    if [[ -n $(git status --porcelain) ]]; then
        warn "Uncommitted changes detected"
        read -p "Continue with uncommitted changes? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Validate current branch
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]] && [[ "$current_branch" != "staging" ]]; then
        warn "Deploying from branch: $current_branch (not main/staging)"
        read -p "Continue from $current_branch? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log "✅ Environment validation complete"
}

# File integrity check
check_file_integrity() {
    log "🔍 Checking file integrity..."
    
    # Check for correct effects file
    if [[ ! -f "assets/effects-v2.js" ]]; then
        error "Critical file missing: assets/effects-v2.js"
        exit 1
    fi
    
    # Verify no duplicate effects files in assets
    local effects_files=$(find assets/ -name "effects*.js" | wc -l)
    if [[ $effects_files -gt 1 ]]; then
        warn "Multiple effects files detected in assets/:"
        find assets/ -name "effects*.js"
        read -p "Continue with multiple effects files? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check for archive pollution in assets
    if find assets/ -path "*archive*" -o -path "*backup*" | grep -q "."; then
        error "Archive/backup files found in assets/ directory"
        find assets/ -path "*archive*" -o -path "*backup*"
        exit 1
    fi
    
    log "✅ File integrity check complete"
}

# Cloud infrastructure validation
validate_cloud_infrastructure() {
    log "🔍 Validating cloud infrastructure..."
    
    # Check Cloud Run service status
    local service_status=$(gcloud run services describe inspirenet-bg-removal-api --region=us-central1 --format="value(status.conditions[0].status)" 2>/dev/null || echo "NotFound")
    
    if [[ "$service_status" != "True" ]]; then
        warn "Cloud Run service not healthy. Status: $service_status"
    fi
    
    # Check required storage buckets
    local required_buckets=("perkieprints-processing-cache" "perkieprints-customer-images")
    for bucket in "${required_buckets[@]}"; do
        if ! gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
            error "Required bucket not found: $bucket"
            exit 1
        fi
    done
    
    # Check if staging buckets exist (create if needed)
    local staging_buckets=("perkieprints-staging-cache" "perkieprints-staging-customer-images")
    for bucket in "${staging_buckets[@]}"; do
        if ! gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
            warn "Staging bucket missing: $bucket"
            read -p "Create staging bucket $bucket? (Y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                gcloud storage buckets create "gs://$bucket" --location=us-central1
                log "✅ Created staging bucket: $bucket"
            fi
        fi
    done
    
    log "✅ Cloud infrastructure validation complete"
}

# Cache busting implementation
implement_cache_busting() {
    if [[ "$SKIP_CACHE_CLEAR" == "--skip-cache-clear" ]]; then
        log "🔧 Skipping cache busting (--skip-cache-clear flag)"
        return
    fi
    
    log "🔧 Implementing cache busting strategies..."
    
    # Create versioned assets
    local version_hash=$(git rev-parse --short HEAD)
    
    # Backup original core-engine.js
    cp assets/core-engine.js "assets/core-engine.backup.${TIMESTAMP}.js"
    
    # Update asset references with cache-busting parameters
    sed -i.tmp "s/effects-v2\.js/effects-v2.js?v=${version_hash}&t=${TIMESTAMP}/g" assets/core-engine.js
    
    # Create cache-busted filenames for critical assets
    local critical_files=("effects-v2.js" "core-engine.js" "api-client.js")
    
    for file in "${critical_files[@]}"; do
        if [[ -f "assets/$file" ]]; then
            # Create timestamped version
            cp "assets/$file" "assets/${file%.js}-${version_hash}.js"
            log "✅ Created cache-busted version: ${file%.js}-${version_hash}.js"
        fi
    done
    
    log "✅ Cache busting implementation complete"
}

# API deployment
deploy_api() {
    log "🚀 Deploying API to Cloud Run..."
    
    cd backend/inspirenet-api
    
    # Build and deploy using staging config first for validation
    log "📤 Deploying to staging environment..."
    gcloud run services replace deploy-staging.yaml --region=us-central1
    
    # Wait for staging deployment
    log "⏳ Waiting for staging deployment to stabilize..."
    sleep 30
    
    # Test staging endpoint
    local staging_url="https://inspirenet-bg-removal-api-staging-vqqo2tr3yq-uc.a.run.app"
    if curl -f "${staging_url}/health" &>/dev/null; then
        log "✅ Staging deployment healthy"
    else
        error "Staging deployment failed health check"
        cd - > /dev/null
        exit 1
    fi
    
    # Deploy to production
    log "📤 Deploying to production environment..."
    read -p "🚨 Deploy to PRODUCTION? This will affect live traffic. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gcloud run services replace deploy-production-clean.yaml --region=us-central1
        log "✅ Production API deployment complete"
    else
        warn "Production API deployment cancelled by user"
    fi
    
    cd - > /dev/null
}

# Theme deployment with validation
deploy_theme() {
    log "🎨 Deploying Shopify theme..."
    
    # Pre-upload validation
    shopify theme check --auto-correct || warn "Theme check found issues"
    
    # Deploy to staging first
    log "📤 Deploying to staging theme..."
    shopify theme push --theme staging --allow-live
    
    # Verify staging deployment
    log "⏳ Verifying staging deployment..."
    sleep 15
    
    # Deploy to production
    read -p "🚨 Deploy theme to PRODUCTION? This will affect live store. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create backup first
        local backup_dir="./backup/theme_backup_${TIMESTAMP}"
        mkdir -p "$backup_dir"
        shopify theme pull --theme production --path "$backup_dir" || warn "Backup failed"
        
        # Deploy to production
        shopify theme push --theme production --allow-live
        log "✅ Production theme deployment complete"
    else
        warn "Production theme deployment cancelled by user"
    fi
}

# Post-deployment verification
verify_deployment() {
    log "🔍 Running post-deployment verification..."
    
    # API health checks
    local api_url="https://inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app"
    
    log "Testing API endpoints..."
    if curl -f "${api_url}/health" &>/dev/null; then
        log "✅ API health check passed"
    else
        error "API health check failed"
    fi
    
    if curl -f "${api_url}/model-info" &>/dev/null; then
        log "✅ API model-info endpoint responsive"
    else
        warn "API model-info endpoint not responsive"
    fi
    
    # Theme verification checklist
    log "Theme verification checklist:"
    log "  1. Open store in incognito mode"
    log "  2. Check browser console for errors"
    log "  3. Test pet background remover functionality"
    log "  4. Verify effects-v2.js is loading correctly"
    
    log "✅ Post-deployment verification complete"
}

# Cleanup function
cleanup_deployment() {
    log "🧹 Cleaning up deployment artifacts..."
    
    # Remove temporary files
    rm -f assets/*.tmp
    rm -f assets/core-engine.backup.*.js
    
    # Clean up cache-busted files older than 24 hours
    find assets/ -name "*-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].js" -mtime +1 -delete 2>/dev/null || true
    
    log "✅ Cleanup complete"
}

# Error handling
trap cleanup_deployment EXIT

# Main deployment flow
main() {
    log "🚀 Starting production deployment - Type: $DEPLOYMENT_TYPE"
    
    validate_environment
    check_file_integrity
    validate_cloud_infrastructure
    implement_cache_busting
    
    case $DEPLOYMENT_TYPE in
        "api")
            deploy_api
            ;;
        "theme")
            deploy_theme
            ;;
        "full")
            deploy_api
            deploy_theme
            ;;
        *)
            error "Invalid deployment type: $DEPLOYMENT_TYPE. Use: api, theme, or full"
            exit 1
            ;;
    esac
    
    verify_deployment
    
    log "🎉 Deployment complete! Log saved to: $LOGFILE"
    log "📊 Monitor the deployment for the next 30 minutes"
}

# Run main function
main "$@"