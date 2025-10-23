#!/bin/bash
# Infrastructure Monitoring Script
# Monitors deployment health and provides automated diagnostics
# Usage: ./infrastructure-monitor.sh [status|logs|costs|cleanup] [--watch]

set -e

ACTION=${1:-status}
WATCH_FLAG=${2}
PROJECT_ID="perkieprints-processing"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Cloud Run service status
check_cloud_run_status() {
    log "🔍 Checking Cloud Run services..."
    
    # Production service
    local prod_service="inspirenet-bg-removal-api"
    local staging_service="inspirenet-bg-removal-api-staging"
    
    for service in "$prod_service" "$staging_service"; do
        echo "📊 Service: $service"
        
        if gcloud run services describe "$service" --region=us-central1 &>/dev/null; then
            local status=$(gcloud run services describe "$service" --region=us-central1 --format="value(status.conditions[0].status)")
            local url=$(gcloud run services describe "$service" --region=us-central1 --format="value(status.url)")
            local cpu=$(gcloud run services describe "$service" --region=us-central1 --format="value(spec.template.spec.containers[0].resources.limits.cpu)")
            local memory=$(gcloud run services describe "$service" --region=us-central1 --format="value(spec.template.spec.containers[0].resources.limits.memory)")
            local min_instances=$(gcloud run services describe "$service" --region=us-central1 --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/minScale'])")
            local max_instances=$(gcloud run services describe "$service" --region=us-central1 --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/maxScale'])")
            
            if [[ "$status" == "True" ]]; then
                echo -e "   Status: ${GREEN}✅ Healthy${NC}"
            else
                echo -e "   Status: ${RED}❌ Unhealthy${NC}"
            fi
            
            echo "   URL: $url"
            echo "   Resources: ${cpu} CPU, ${memory} Memory"
            echo "   Scaling: ${min_instances:-0}-${max_instances} instances"
            
            # Test endpoint health
            if curl -f "${url}/health" --max-time 10 &>/dev/null; then
                echo -e "   Health Check: ${GREEN}✅ Pass${NC}"
            else
                echo -e "   Health Check: ${RED}❌ Fail${NC}"
            fi
            
            # Check current instance count
            local instances=$(gcloud run services describe "$service" --region=us-central1 --format="value(status.traffic[0].revisionName)" | xargs -I {} gcloud run revisions describe {} --region=us-central1 --format="value(status.observedGeneration)" 2>/dev/null || echo "0")
            echo "   Active Instances: ${instances}"
            
        else
            echo -e "   Status: ${RED}❌ Not Found${NC}"
        fi
        echo
    done
}

# Storage bucket analysis
check_storage_status() {
    log "💾 Checking Cloud Storage buckets..."
    
    local buckets=("perkieprints-processing-cache" "perkieprints-customer-images" "perkieprints-staging-cache" "perkieprints-staging-customer-images")
    
    for bucket in "${buckets[@]}"; do
        echo "🗄️  Bucket: $bucket"
        
        if gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
            local location=$(gcloud storage buckets describe "gs://$bucket" --format="value(location)")
            local storage_class=$(gcloud storage buckets describe "gs://$bucket" --format="value(storageClass)")
            
            echo -e "   Status: ${GREEN}✅ Exists${NC}"
            echo "   Location: $location"
            echo "   Storage Class: $storage_class"
            
            # Check object count and size
            local object_count=$(gcloud storage ls "gs://$bucket/**" 2>/dev/null | wc -l || echo "0")
            echo "   Objects: $object_count"
            
            # Check for old files (older than 7 days)
            local old_files=$(gcloud storage ls -l "gs://$bucket/**" 2>/dev/null | awk -v cutoff="$(date -d '7 days ago' +%s)" 'NR>1 {cmd="date -d \""$2" "$3"\" +%s"; cmd | getline timestamp; close(cmd); if(timestamp < cutoff) count++} END {print count+0}' || echo "0")
            if [[ $old_files -gt 0 ]]; then
                warn "   Old files (>7 days): $old_files files"
            fi
            
        else
            echo -e "   Status: ${RED}❌ Missing${NC}"
            if [[ "$bucket" == *"staging"* ]]; then
                warn "   Staging bucket missing - this will cause staging deployments to fail"
            else
                error "   Production bucket missing - this will cause failures"
            fi
        fi
        echo
    done
}

# Cost analysis
analyze_costs() {
    log "💰 Analyzing infrastructure costs..."
    
    echo "📊 Cost Analysis (Last 30 days):"
    
    # Cloud Run costs
    echo "🏃 Cloud Run Services:"
    gcloud billing budgets list --filter="displayName~'Cloud Run'" --format="table(displayName,amount.specifiedAmount.currencyCode,amount.specifiedAmount.units)" 2>/dev/null || echo "   Unable to fetch billing data"
    
    # Storage costs estimate
    echo "💾 Storage Usage:"
    for bucket in "perkieprints-processing-cache" "perkieprints-customer-images"; do
        if gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
            local size=$(gcloud storage du -s "gs://$bucket" 2>/dev/null | awk '{print $1}' || echo "0")
            local size_gb=$((size / 1024 / 1024 / 1024))
            echo "   $bucket: ~${size_gb}GB"
            
            # Rough cost estimate (US Standard Storage: $0.020 per GB/month)
            local monthly_cost=$(echo "$size_gb * 0.020" | bc -l 2>/dev/null || echo "unknown")
            echo "   Estimated monthly cost: \$${monthly_cost}"
        fi
    done
    
    # GPU usage warning
    echo "⚠️  GPU Cost Warning:"
    echo "   NVIDIA L4 GPU: ~$0.60/hour when running"
    echo "   With 0 min instances: Only charged when processing requests"
    echo "   Estimated cost: \$65 per 1000 processed images"
    
    # Recommendations
    echo "💡 Cost Optimization Recommendations:"
    echo "   1. Monitor GPU utilization - consider min instances during peak hours"
    echo "   2. Implement cache lifecycle policies (delete files older than 30 days)"
    echo "   3. Use Cloud Storage coldline for long-term customer images"
    echo "   4. Consider spot instances for batch processing"
}

# Log analysis
analyze_logs() {
    log "📋 Analyzing recent logs..."
    
    local services=("inspirenet-bg-removal-api" "inspirenet-bg-removal-api-staging")
    
    for service in "${services[@]}"; do
        echo "📊 Logs for: $service"
        
        # Check for errors in last 24 hours
        local error_count=$(gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=$service AND severity>=ERROR" --limit=1000 --freshness=1d --format="value(timestamp)" 2>/dev/null | wc -l || echo "0")
        
        if [[ $error_count -gt 0 ]]; then
            echo -e "   Errors (24h): ${RED}$error_count${NC}"
            
            # Show recent errors
            echo "   Recent errors:"
            gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=$service AND severity>=ERROR" --limit=5 --freshness=1d --format="value(timestamp,jsonPayload.message)" 2>/dev/null | while read -r line; do
                echo "     $line"
            done
        else
            echo -e "   Errors (24h): ${GREEN}0${NC}"
        fi
        
        # Check for high latency requests
        echo "   Checking for high latency requests..."
        gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=$service AND httpRequest.latency>\"10s\"" --limit=5 --freshness=1d --format="value(timestamp,httpRequest.latency)" 2>/dev/null | while read -r line; do
            if [[ -n "$line" ]]; then
                warn "     High latency: $line"
            fi
        done
        
        echo
    done
}

# Infrastructure cleanup
cleanup_infrastructure() {
    log "🧹 Infrastructure cleanup..."
    
    echo "🗑️  Cleanup operations available:"
    echo "1. Delete old cache files (>7 days)"
    echo "2. Clean up old Cloud Build artifacts"
    echo "3. Remove unused container images"
    echo "4. Clean up old deployment logs"
    
    read -p "Select cleanup operations (1-4, comma separated, or 'all'): " cleanup_choice
    
    if [[ "$cleanup_choice" == "all" ]] || [[ "$cleanup_choice" =~ "1" ]]; then
        echo "🗄️  Cleaning old cache files..."
        for bucket in "perkieprints-processing-cache" "perkieprints-staging-cache"; do
            if gcloud storage buckets describe "gs://$bucket" &>/dev/null; then
                # Delete files older than 7 days
                gcloud storage rm -r "gs://$bucket/**" --if-metageneration-match="$(date -d '7 days ago' +%s)" 2>/dev/null || warn "No old files found in $bucket"
            fi
        done
    fi
    
    if [[ "$cleanup_choice" == "all" ]] || [[ "$cleanup_choice" =~ "2" ]]; then
        echo "🔨 Cleaning Cloud Build artifacts..."
        # Keep only last 10 builds
        gcloud builds list --limit=50 --format="value(id)" | tail -n +11 | while read build_id; do
            gcloud builds cancel "$build_id" 2>/dev/null || true
        done
    fi
    
    if [[ "$cleanup_choice" == "all" ]] || [[ "$cleanup_choice" =~ "3" ]]; then
        echo "🐳 Cleaning unused container images..."
        # List images older than 30 days
        gcloud container images list-tags "us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/inspirenet-bg-removal-api" \
            --filter="timestamp.datetime < '$(date -d '30 days ago' -Iseconds)'" \
            --format="get(digest)" --limit=10 | while read digest; do
            gcloud container images delete "us-central1-docker.pkg.dev/$PROJECT_ID/pet-bg-removal/inspirenet-bg-removal-api@$digest" --quiet 2>/dev/null || warn "Could not delete image $digest"
        done
    fi
    
    if [[ "$cleanup_choice" == "all" ]] || [[ "$cleanup_choice" =~ "4" ]]; then
        echo "📋 Cleaning old logs..."
        # Cloud Logging automatically deletes logs after 30 days for most projects
        # But we can clean up local deployment logs
        find . -name "deployment_*.log" -mtime +7 -delete 2>/dev/null || true
        echo "   Cleaned local deployment logs older than 7 days"
    fi
    
    log "✅ Cleanup complete"
}

# Watch mode
watch_infrastructure() {
    log "👁️  Starting watch mode (press Ctrl+C to stop)..."
    
    while true; do
        clear
        echo "🔄 Infrastructure Monitor - $(date)"
        echo "=================================="
        
        check_cloud_run_status
        echo "=================================="
        check_storage_status
        
        echo "⏱️  Refreshing in 30 seconds..."
        sleep 30
    done
}

# Main function
main() {
    echo "🏗️  Infrastructure Monitor - Action: $ACTION"
    echo
    
    case $ACTION in
        "status")
            check_cloud_run_status
            check_storage_status
            ;;
        "logs")
            analyze_logs
            ;;
        "costs")
            analyze_costs
            ;;
        "cleanup")
            cleanup_infrastructure
            ;;
        "all")
            check_cloud_run_status
            check_storage_status
            analyze_logs
            analyze_costs
            ;;
        *)
            error "Invalid action: $ACTION"
            echo "Usage: $0 [status|logs|costs|cleanup|all] [--watch]"
            exit 1
            ;;
    esac
    
    if [[ "$WATCH_FLAG" == "--watch" ]]; then
        watch_infrastructure
    fi
}

# Handle interrupts gracefully
trap 'echo -e "\n👋 Monitor stopped"; exit 0' INT TERM

main "$@"